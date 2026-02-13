// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockFunctions
 * @dev Mock Chainlink Functions interfaces for local testing
 */
interface FunctionsClientInterface {
    function handleOracleFulfillment(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external;
}

interface FunctionsOracleInterface {
    function sendRequest(
        uint64 subscriptionId,
        uint32 gasLimit,
        bytes memory request
    ) external returns (bytes32 requestId);
}

// Mock oracle for local testing (optional)
contract MockFunctionsOracle is FunctionsOracleInterface {
    function sendRequest(
        uint64,
        uint32,
        bytes memory
    ) external pure override returns (bytes32) {
        return bytes32(uint256(1)); // Return mock request ID
    }
}

