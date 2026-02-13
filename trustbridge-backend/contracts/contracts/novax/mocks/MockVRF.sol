// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockVRF
 * @dev Mock Chainlink VRF interfaces for local testing
 */
interface VRFCoordinatorV2Interface {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}

abstract contract VRFConsumerBaseV2 {
    VRFCoordinatorV2Interface public immutable i_vrfCoordinator;

    constructor(address _vrfCoordinator) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
    }
}

