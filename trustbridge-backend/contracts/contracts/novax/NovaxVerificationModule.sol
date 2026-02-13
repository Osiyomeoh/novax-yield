// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Use mock interfaces for local testing, or real Chainlink for production
// import "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/FunctionsClientInterface.sol";
// import "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/FunctionsOracleInterface.sol";
import "./mocks/MockFunctions.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NovaxVerificationModule
 * @dev Chainlink Functions integration for invoice verification
 * @notice Calls off-chain APIs to verify invoice authenticity
 */
contract NovaxVerificationModule is FunctionsClientInterface, AccessControl {
    FunctionsOracleInterface public immutable i_oracle;
    bytes32 public immutable i_sourceHash;
    uint64 public immutable i_subscriptionId;
    uint32 public immutable i_gasLimit;

    // Mapping from request ID to receivable ID
    mapping(bytes32 => bytes32) public requestToReceivable;
    mapping(bytes32 => VerificationResult) public receivableVerification;

    struct VerificationResult {
        bool verified;
        uint256 riskScore;
        uint256 apr;
        string reason;
        uint256 timestamp;
    }

    // Events
    event VerificationRequested(bytes32 indexed requestId, bytes32 indexed receivableId);
    event VerificationCompleted(
        bytes32 indexed receivableId,
        bool verified,
        uint256 riskScore,
        uint256 apr
    );

    constructor(
        address _oracle,
        bytes32 _sourceHash,
        uint64 _subscriptionId,
        uint32 _gasLimit
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        i_oracle = FunctionsOracleInterface(_oracle);
        i_sourceHash = _sourceHash;
        i_subscriptionId = _subscriptionId;
        i_gasLimit = _gasLimit;
    }

    /**
     * @notice Request invoice verification via Chainlink Functions
     * @param _receivableId Receivable ID
     * @param _metadataCID IPFS CID of invoice metadata
     * @return requestId Chainlink Functions request ID
     */
    function requestVerification(
        bytes32 _receivableId,
        bytes32 _metadataCID
    ) external returns (bytes32 requestId) {
        // For local testing: generate mock request ID
        // In production with Chainlink Functions, this would call i_oracle.sendRequest()
        bytes32 requestIdBytes;
        
        if (address(i_oracle) == address(0)) {
            // Mock mode for local testing
            requestIdBytes = keccak256(
                abi.encodePacked(_receivableId, _metadataCID, block.timestamp)
            );
        } else {
            // Production mode with Chainlink Functions
            bytes memory requestData = abi.encode(
                _bytes32ToString(_receivableId),
                _bytes32ToString(_metadataCID)
            );
            requestIdBytes = i_oracle.sendRequest(
                i_subscriptionId,
                i_gasLimit,
                requestData
            );
        }

        requestToReceivable[requestIdBytes] = _receivableId;
        emit VerificationRequested(requestIdBytes, _receivableId);

        return requestIdBytes;
    }

    /**
     * @notice Handle Chainlink Functions response
     * @param _requestId Request ID
     * @param _response Response data
     * @param _err Error data (if any)
     */
    function handleOracleFulfillment(
        bytes32 _requestId,
        bytes memory _response,
        bytes memory _err
    ) external override {
        // For local testing, allow anyone to call (or use zero address check)
        if (address(i_oracle) != address(0)) {
            require(msg.sender == address(i_oracle), "Only oracle can fulfill");
        }

        bytes32 receivableId = requestToReceivable[_requestId];
        require(receivableId != bytes32(0), "Invalid request ID");

        if (_err.length > 0) {
            receivableVerification[receivableId] = VerificationResult({
                verified: false,
                riskScore: 100,
                apr: 0,
                reason: string(_err),
                timestamp: block.timestamp
            });
        } else {
            // Parse response (format: "verified,riskScore,apr")
            (bool verified, uint256 riskScore, uint256 apr) = _parseResponse(_response);

            receivableVerification[receivableId] = VerificationResult({
                verified: verified,
                riskScore: riskScore,
                apr: apr,
                reason: "",
                timestamp: block.timestamp
            });

            emit VerificationCompleted(receivableId, verified, riskScore, apr);
        }
    }

    /**
     * @notice Get verification result for a receivable
     * @param _receivableId Receivable ID
     * @return result Verification result
     */
    function getVerificationResult(
        bytes32 _receivableId
    ) external view returns (VerificationResult memory result) {
        return receivableVerification[_receivableId];
    }

    /**
     * @notice Parse Chainlink Functions response
     * @param _response Response bytes from Chainlink Functions
     * @return verified Whether invoice is verified
     * @return riskScore Risk score (0-100)
     * @return apr Annual Percentage Rate (basis points)
     */
    function _parseResponse(
        bytes memory _response
    ) internal pure returns (bool verified, uint256 riskScore, uint256 apr) {
        // Parse response format: "verified,riskScore,apr"
        // Example: "true,25,1200" -> verified=true, riskScore=25, apr=1200
        
        if (_response.length == 0) {
            return (false, 100, 0);
        }

        // Find comma positions in bytes
        uint256 firstComma = 0;
        uint256 secondComma = 0;
        
        for (uint256 i = 0; i < _response.length; i++) {
            if (_response[i] == bytes1(",")) {
                if (firstComma == 0) {
                    firstComma = i;
                } else if (secondComma == 0) {
                    secondComma = i;
                    break;
                }
            }
        }

        if (firstComma == 0 || secondComma == 0) {
            return (false, 100, 0);
        }

        // Extract verified (before first comma)
        // Check if starts with "true" (bytes: 0x74 0x72 0x75 0x65)
        if (_response.length >= 4 && 
            _response[0] == bytes1("t") && 
            _response[1] == bytes1("r") && 
            _response[2] == bytes1("u") && 
            _response[3] == bytes1("e")) {
            verified = true;
        } else {
            verified = false;
        }

        // Extract riskScore (between commas)
        riskScore = _parseUint(_response, firstComma + 1, secondComma);

        // Extract apr (after second comma)
        apr = _parseUint(_response, secondComma + 1, _response.length);

        return (verified, riskScore, apr);
    }

    /**
     * @notice Parse uint from bytes
     */
    function _parseUint(bytes memory data, uint256 start, uint256 end) internal pure returns (uint256) {
        uint256 result = 0;
        for (uint256 i = start; i < end && i < data.length; i++) {
            uint8 char = uint8(data[i]);
            if (char >= 48 && char <= 57) { // '0' to '9'
                result = result * 10 + (char - 48);
            }
        }
        return result;
    }

    /**
     * @notice Convert bytes32 to string
     */
    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while (i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}


