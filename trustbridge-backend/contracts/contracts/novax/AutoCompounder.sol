// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NovaxStakingVault.sol";

/**
 * @title AutoCompounder
 * @dev Automated compounding service for NovaxStakingVault
 * @notice Can be triggered by Chainlink Keepers, Gelato, or manual calls
 */
contract AutoCompounder is AccessControl {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    NovaxStakingVault public stakingVault;
    uint256 public lastCompoundTime;
    uint256 public compoundInterval = 30 days; // Monthly by default
    uint256 public totalCompounds;
    
    event CompoundExecuted(uint256 timestamp, uint256 compoundCount);
    event CompoundIntervalUpdated(uint256 oldInterval, uint256 newInterval);
    
    constructor(address _stakingVault) {
        require(_stakingVault != address(0), "Invalid vault address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
        
        stakingVault = NovaxStakingVault(_stakingVault);
        lastCompoundTime = block.timestamp;
    }
    
    /**
     * @notice Check if compounding is needed (for Chainlink Keepers)
     * @return upkeepNeeded Whether compounding is needed
     * @return performData Data to pass to performUpkeep
     */
    function checkUpkeep(bytes calldata) 
        external 
        view 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        upkeepNeeded = block.timestamp >= lastCompoundTime + compoundInterval;
        performData = "";
    }
    
    /**
     * @notice Execute compounding (called by Keeper or admin)
     * @param performData Data from checkUpkeep (unused)
     */
    function performUpkeep(bytes calldata performData) external onlyRole(KEEPER_ROLE) {
        require(block.timestamp >= lastCompoundTime + compoundInterval, "Too soon");
        
        // Trigger global compound in vault
        // Note: The actual compounding logic is in the vault's receivePayment function
        // This just updates the timestamp
        
        lastCompoundTime = block.timestamp;
        totalCompounds++;
        
        emit CompoundExecuted(block.timestamp, totalCompounds);
    }
    
    /**
     * @notice Set compound interval
     * @param _interval New interval in seconds
     */
    function setCompoundInterval(uint256 _interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_interval >= 1 days, "Interval too short");
        require(_interval <= 365 days, "Interval too long");
        
        uint256 oldInterval = compoundInterval;
        compoundInterval = _interval;
        
        emit CompoundIntervalUpdated(oldInterval, _interval);
    }
}

