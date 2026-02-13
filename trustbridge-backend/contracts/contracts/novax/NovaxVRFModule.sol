// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Use mock interfaces for local testing, or real Chainlink for production
// import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
// import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "./mocks/MockVRF.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NovaxVRFModule
 * @dev Chainlink VRF for verifiable randomness in APR calculations
 * @notice Provides fair, tamper-proof randomness for yield calculations
 */
contract NovaxVRFModule is VRFConsumerBaseV2, AccessControl {
    bytes32 public immutable i_keyHash;
    uint64 public immutable i_vrfSubscriptionId;
    uint32 public constant CALLBACK_GAS_LIMIT = 100000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;

    // Mapping from request ID to invoice/receivable ID
    mapping(uint256 => bytes32) public vrfRequestToReceivable;
    mapping(bytes32 => uint256) public receivableToRandomValue;

    // Events
    event RandomnessRequested(uint256 indexed requestId, bytes32 indexed receivableId);
    event RandomnessFulfilled(uint256 indexed requestId, bytes32 indexed receivableId, uint256 randomValue);

    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        i_keyHash = _keyHash;
        i_vrfSubscriptionId = _subscriptionId;
    }

    /**
     * @notice Request randomness for a receivable APR calculation
     * @param _receivableId Receivable ID
     * @return requestId VRF request ID
     */
    function requestRandomAPR(bytes32 _receivableId) external returns (uint256 requestId) {
        requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_vrfSubscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );

        vrfRequestToReceivable[requestId] = _receivableId;
        emit RandomnessRequested(requestId, _receivableId);
        return requestId;
    }

    /**
     * @notice Callback function called by VRF Coordinator
     * @param _requestId VRF request ID
     * @param _randomWords Array of random words
     */
    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal {
        bytes32 receivableId = vrfRequestToReceivable[_requestId];
        require(receivableId != bytes32(0), "Invalid request ID");

        uint256 randomValue = _randomWords[0];
        receivableToRandomValue[receivableId] = randomValue;

        emit RandomnessFulfilled(_requestId, receivableId, randomValue);
    }

    /**
     * @notice Get random value for a receivable
     * @param _receivableId Receivable ID
     * @return randomValue Random value (0 if not yet fulfilled)
     */
    function getRandomValue(bytes32 _receivableId) external view returns (uint256 randomValue) {
        return receivableToRandomValue[_receivableId];
    }

    /**
     * @notice Check if randomness has been fulfilled for a receivable
     * @param _receivableId Receivable ID
     * @return fulfilled Whether randomness has been fulfilled
     */
    function isRandomnessFulfilled(bytes32 _receivableId) external view returns (bool fulfilled) {
        return receivableToRandomValue[_receivableId] > 0;
    }
}

