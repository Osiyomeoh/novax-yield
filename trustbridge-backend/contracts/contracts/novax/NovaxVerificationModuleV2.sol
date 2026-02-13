// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Real Chainlink Functions imports (uncomment for production)
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NovaxVerificationModule
 * @dev Chainlink Functions integration for invoice verification
 * @notice Calls off-chain APIs to verify invoice authenticity using Chainlink Functions
 * 
 * This contract follows Chainlink Functions best practices:
 * - Uses FunctionsClient for proper integration
 * - Inline JavaScript source code
 * - Compact CSV response format
 * - Proper error handling
 */
contract NovaxVerificationModule is FunctionsClient, AccessControl {
    using FunctionsRequest for FunctionsRequest.Request;

    // Chainlink Functions Configuration
    uint64 public immutable i_functionsSubscriptionId;
    uint32 public gasLimit;
    bytes32 public donID; // Decentralized Oracle Network ID
    
    // State Variables
    address public coreContract; // ReceivableFactory address
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;
    
    // Mappings
    mapping(bytes32 => bytes32) public functionsRequestToReceivable;
    mapping(bytes32 => VerificationResult) public receivableVerification;
    
    struct VerificationResult {
        bool verified;
        bool isValid;
        uint256 riskScore;
        uint256 apr;
        string creditRating;
        string reason;
        uint256 timestamp;
    }

    // Inline JavaScript source code for Chainlink Functions
    // This code runs on Chainlink Functions nodes
    string private constant VERIFICATION_SOURCE = 
        "const invoiceId = args[0];"
        "const metadataCID = args[1];"
        "const commodity = args[2] || 'Coffee';"
        "const amount = parseInt(args[3]) || 50000;"
        "const supplierCountry = args[4] || 'Kenya';"
        "const buyerCountry = args[5] || 'USA';"
        "const exporterName = args[6] || 'Test Exporter';"
        "const buyerName = args[7] || 'Test Buyer';"
        ""
        "// Make HTTP request to verification API"
        "const apiResponse = await Functions.makeHttpRequest({"
        "  url: 'https://your-backend.com/chainlink/functions/verify-invoice',"
        "  method: 'POST',"
        "  headers: {"
        "    'Content-Type': 'application/json',"
        "    'User-Agent': 'Chainlink-Functions'"
        "  },"
        "  data: {"
        "    receivableId: invoiceId,"
        "    metadataCID: metadataCID,"
        "    commodity: commodity,"
        "    amount: amount,"
        "    supplierCountry: supplierCountry,"
        "    buyerCountry: buyerCountry,"
        "    exporterName: exporterName,"
        "    buyerName: buyerName"
        "  }"
        "});"
        ""
        "if (apiResponse.error) {"
        "  return Functions.encodeString('0,99,ERROR');"
        "}"
        ""
        "// Parse response - should be CSV format: isValid,riskScore,creditRating"
        "const result = apiResponse.data.result || apiResponse.data;"
        "return Functions.encodeString(result);";

    // Events
    event VerificationRequested(bytes32 indexed requestId, bytes32 indexed receivableId);
    event VerificationCompleted(
        bytes32 indexed receivableId,
        bool isValid,
        uint256 riskScore,
        string creditRating
    );
    event FunctionsResponse(bytes32 indexed requestId, bytes response, bytes err);

    /**
     * @notice Constructor
     * @param _functionsRouter Chainlink Functions Router address
     * @param _functionsSubscriptionId Your Chainlink Functions subscription ID
     * @param _donID Decentralized Oracle Network ID
     */
    constructor(
        address _functionsRouter,
        uint64 _functionsSubscriptionId,
        bytes32 _donID
    ) FunctionsClient(_functionsRouter) {
        i_functionsSubscriptionId = _functionsSubscriptionId;
        donID = _donID;
        gasLimit = 300000; // Default gas limit
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Set the core contract (ReceivableFactory) address
     * @param _coreContract Address of ReceivableFactory
     */
    function setCoreContract(address _coreContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_coreContract != address(0), "Invalid address");
        coreContract = _coreContract;
    }

    /**
     * @notice Set gas limit for Functions requests
     * @param _gasLimit New gas limit
     */
    function setGasLimit(uint32 _gasLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        gasLimit = _gasLimit;
    }

    /**
     * @notice Set DON ID
     * @param _donID New DON ID
     */
    function setDonID(bytes32 _donID) external onlyRole(DEFAULT_ADMIN_ROLE) {
        donID = _donID;
    }

    /**
     * @notice Request invoice verification via Chainlink Functions
     * @param _receivableId Receivable ID
     * @param _metadataCID IPFS CID of invoice metadata
     * @param _commodity Commodity type (optional)
     * @param _amount Invoice amount (optional)
     * @param _supplierCountry Supplier country code (optional)
     * @param _buyerCountry Buyer country code (optional)
     * @param _exporterName Exporter name (optional)
     * @param _buyerName Buyer name (optional)
     * @return requestId Chainlink Functions request ID
     */
    function requestVerification(
        bytes32 _receivableId,
        bytes32 _metadataCID,
        string memory _commodity,
        uint256 _amount,
        string memory _supplierCountry,
        string memory _buyerCountry,
        string memory _exporterName,
        string memory _buyerName
    ) external returns (bytes32 requestId) {
        // Only core contract or admin can request verification
        require(
            msg.sender == coreContract || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(VERIFICATION_SOURCE);

        // Set arguments for JavaScript source code
        string[] memory args = new string[](8);
        args[0] = _bytes32ToString(_receivableId);
        args[1] = _bytes32ToString(_metadataCID);
        args[2] = _commodity;
        args[3] = _uint256ToString(_amount);
        args[4] = _supplierCountry;
        args[5] = _buyerCountry;
        args[6] = _exporterName;
        args[7] = _buyerName;
        req.setArgs(args);

        // Send request to Chainlink Functions
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            i_functionsSubscriptionId,
            gasLimit,
            donID
        );

        functionsRequestToReceivable[s_lastRequestId] = _receivableId;

        emit VerificationRequested(s_lastRequestId, _receivableId);

        return s_lastRequestId;
    }

    /**
     * @notice Handle Chainlink Functions response
     * @param requestId Request ID
     * @param response Response data from Chainlink Functions
     * @param err Error data (if any)
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        s_lastResponse = response;
        s_lastError = err;

        emit FunctionsResponse(requestId, response, err);

        bytes32 receivableId = functionsRequestToReceivable[requestId];
        if (receivableId == bytes32(0)) {
            return; // Invalid request ID
        }

        // Mark as verified
        receivableVerification[receivableId].verified = true;
        receivableVerification[receivableId].timestamp = block.timestamp;

        if (err.length == 0 && response.length > 0) {
            // Parse response: format is "isValid,riskScore,creditRating"
            // Example: "1,25,A" or "0,99,ERROR"
            string memory responseStr = string(response);
            
            (bool isValid, uint256 riskScore, string memory creditRating) = 
                _parseResponse(responseStr);

            receivableVerification[receivableId].isValid = isValid;
            receivableVerification[receivableId].riskScore = riskScore;
            receivableVerification[receivableId].creditRating = creditRating;
            receivableVerification[receivableId].apr = _calculateAPR(riskScore);

            emit VerificationCompleted(receivableId, isValid, riskScore, creditRating);

            // Callback to core contract if set
            if (coreContract != address(0)) {
                try INovaxReceivableFactory(coreContract).onVerificationComplete(
                    receivableId,
                    isValid,
                    riskScore,
                    creditRating
                ) {
                    // Success
                } catch {
                    // Failed but continue
                }
            }
        } else {
            // Handle error case
            receivableVerification[receivableId].isValid = false;
            receivableVerification[receivableId].riskScore = 99;
            receivableVerification[receivableId].creditRating = "ERROR";
            receivableVerification[receivableId].apr = 0;
            receivableVerification[receivableId].reason = err.length > 0 
                ? string(err) 
                : "Service error";

            emit VerificationCompleted(receivableId, false, 99, "ERROR");
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
     * @notice Get last Functions response (for debugging)
     * @return requestId Last request ID
     * @return response Last response
     * @return err Last error
     */
    function getLastFunctionsResponse()
        external
        view
        returns (bytes32 requestId, bytes memory response, bytes memory err)
    {
        return (s_lastRequestId, s_lastResponse, s_lastError);
    }

    /**
     * @notice Parse CSV response: "isValid,riskScore,creditRating"
     * @param responseStr Response string
     * @return isValid Whether invoice is valid
     * @return riskScore Risk score (0-100)
     * @return creditRating Credit rating (AAA, AA, A, BBB, BB, B, D, ERROR)
     */
    function _parseResponse(
        string memory responseStr
    ) internal pure returns (bool isValid, uint256 riskScore, string memory creditRating) {
        bytes memory responseBytes = bytes(responseStr);
        
        if (responseBytes.length == 0) {
            return (false, 99, "ERROR");
        }

        // Find comma positions
        uint256 firstComma = 0;
        uint256 secondComma = 0;
        
        for (uint256 i = 0; i < responseBytes.length; i++) {
            if (responseBytes[i] == bytes1(",")) {
                if (firstComma == 0) {
                    firstComma = i;
                } else if (secondComma == 0) {
                    secondComma = i;
                    break;
                }
            }
        }

        if (firstComma == 0 || secondComma == 0) {
            return (false, 99, "ERROR");
        }

        // Parse isValid (before first comma)
        isValid = responseBytes[0] == bytes1("1");

        // Parse riskScore (between commas)
        riskScore = _parseUint(responseBytes, firstComma + 1, secondComma);

        // Parse creditRating (after second comma)
        uint256 ratingLength = responseBytes.length - secondComma - 1;
        bytes memory ratingBytes = new bytes(ratingLength);
        for (uint256 i = 0; i < ratingLength; i++) {
            ratingBytes[i] = responseBytes[secondComma + 1 + i];
        }
        creditRating = string(ratingBytes);

        return (isValid, riskScore, creditRating);
    }

    /**
     * @notice Parse uint from bytes
     */
    function _parseUint(bytes memory data, uint256 start, uint256 end) 
        internal 
        pure 
        returns (uint256) 
    {
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
     * @notice Calculate APR based on risk score
     * @param _riskScore Risk score (0-100)
     * @return apr APR in basis points
     */
    function _calculateAPR(uint256 _riskScore) internal pure returns (uint256) {
        if (_riskScore <= 25) {
            return 1000; // 10% APR for low risk
        } else if (_riskScore <= 40) {
            return 1200; // 12% APR for medium risk
        } else if (_riskScore <= 60) {
            return 1500; // 15% APR for medium-high risk
        } else if (_riskScore <= 80) {
            return 2000; // 20% APR for high risk
        } else {
            return 2500; // 25% APR for very high risk
        }
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

    /**
     * @notice Convert uint256 to string
     */
    function _uint256ToString(uint256 _value) internal pure returns (string memory) {
        if (_value == 0) {
            return "0";
        }
        uint256 temp = _value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (_value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (_value % 10)));
            _value /= 10;
        }
        return string(buffer);
    }
}

/**
 * @notice Interface for ReceivableFactory callback
 */
interface INovaxReceivableFactory {
    function onVerificationComplete(
        bytes32 _receivableId,
        bool _isValid,
        uint256 _riskScore,
        string memory _creditRating
    ) external;
}

