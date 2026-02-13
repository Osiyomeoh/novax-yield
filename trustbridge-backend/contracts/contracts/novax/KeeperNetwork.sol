// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RewardsPoolManager.sol";

/**
 * @title KeeperNetwork
 * @dev Interface for keeper network integration (Chainlink Keepers, Gelato, etc.)
 * @notice This contract can be called by keeper networks to trigger automatic funding
 */
contract KeeperNetwork is AccessControl {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    address public rewardsPoolManager;
    uint256 public lastCheckTime;
    uint256 public checkInterval; // Time between checks (e.g., 1 day)

    event FundingTriggered(uint256 timestamp, bool shouldFund, uint256 requiredAmount);
    event FundingExecuted(uint256 usdcAmount, uint256 nvxAmount, uint256 timestamp);

    constructor(address _rewardsPoolManager, uint256 _checkInterval) {
        require(_rewardsPoolManager != address(0), "Invalid manager address");
        require(_checkInterval > 0, "Invalid interval");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);

        rewardsPoolManager = _rewardsPoolManager;
        checkInterval = _checkInterval;
        lastCheckTime = block.timestamp;
    }

    /**
     * @notice Check if funding should be executed (called by keeper)
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Encoded data for performUpkeep
     */
    function checkUpkeep(bytes calldata) 
        external 
        view 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        // Check if enough time has passed
        if (block.timestamp < lastCheckTime + checkInterval) {
            return (false, "");
        }

        // Check if funding is needed
        RewardsPoolManager manager = RewardsPoolManager(rewardsPoolManager);
        (bool shouldFund, uint256 requiredAmount) = manager.shouldFund();

        if (!shouldFund) {
            return (false, "");
        }

        // Encode data for performUpkeep
        performData = abi.encode(requiredAmount);
        return (true, performData);
    }

    /**
     * @notice Execute funding (called by keeper)
     * @param performData Encoded data from checkUpkeep
     */
    function performUpkeep(bytes calldata performData) external onlyRole(KEEPER_ROLE) {
        // Decode data
        uint256 requiredAmount = abi.decode(performData, (uint256));

        // Get pool health to determine funding amount
        RewardsPoolManager manager = RewardsPoolManager(rewardsPoolManager);
        uint256 poolHealth = manager.checkPoolHealth();

        // Calculate USDC amount needed (simplified - in production use oracle)
        // Assuming 1 USDC = 10 NVX (adjust based on actual price)
        uint256 usdcAmount = (requiredAmount / 10) * 1e12; // Convert to 6 decimals

        // Execute funding
        try manager.executeFunding(usdcAmount, requiredAmount) {
            lastCheckTime = block.timestamp;
            emit FundingExecuted(usdcAmount, requiredAmount, block.timestamp);
        } catch {
            // Funding failed, but don't revert (keeper can retry)
            emit FundingTriggered(block.timestamp, true, requiredAmount);
        }
    }

    /**
     * @notice Manual trigger (for testing or backup)
     */
    function manualTrigger() external onlyRole(DEFAULT_ADMIN_ROLE) {
        RewardsPoolManager manager = RewardsPoolManager(rewardsPoolManager);
        (bool shouldFund, uint256 requiredAmount) = manager.shouldFund();
        
        emit FundingTriggered(block.timestamp, shouldFund, requiredAmount);
        
        if (shouldFund) {
            uint256 usdcAmount = (requiredAmount / 10) * 1e12;
            manager.executeFunding(usdcAmount, requiredAmount);
            lastCheckTime = block.timestamp;
            emit FundingExecuted(usdcAmount, requiredAmount, block.timestamp);
        }
    }

    /**
     * @notice Set check interval
     */
    function setCheckInterval(uint256 _interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_interval > 0, "Interval must be > 0");
        checkInterval = _interval;
    }

    /**
     * @notice Grant keeper role (for Chainlink Keepers, Gelato, etc.)
     */
    function grantKeeperRole(address _keeper) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(KEEPER_ROLE, _keeper);
    }
}

