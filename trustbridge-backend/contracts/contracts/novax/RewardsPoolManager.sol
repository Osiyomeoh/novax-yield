// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NVXStaking.sol";
import "./DEXIntegration.sol";
import "./RevenueCollector.sol";

/**
 * @title RewardsPoolManager
 * @dev Manages automatic funding of staking rewards pool
 * @notice Handles conversion of USDC to NVX and funding staking contract
 */
contract RewardsPoolManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    address public revenueCollector;      // RevenueCollector contract address
    address public stakingContract;       // NVXStaking contract address
    address public usdcToken;             // USDC token address
    address public nvxToken;              // NVX token address
    address public dexIntegration;        // DEXIntegration contract for USDC → NVX conversion

    // Funding schedule
    uint256 public fundingInterval;       // Time between funding (e.g., 30 days)
    uint256 public lastFundingTime;      // Last funding timestamp
    uint256 public minFundingAmount;      // Minimum USDC amount to trigger funding
    uint256 public targetPoolHealthDays; // Target pool health in days (e.g., 90 days)

    // Pool health tracking
    uint256 public totalFunded;           // Total NVX funded to staking
    uint256 public fundingCount;          // Number of funding events

    // Events
    event FundingExecuted(
        uint256 usdcAmount,
        uint256 nvxAmount,
        uint256 poolHealthDays,
        uint256 timestamp
    );

    event FundingScheduleUpdated(
        uint256 oldInterval,
        uint256 newInterval,
        uint256 timestamp
    );

    event PoolHealthChecked(
        uint256 currentBalance,
        uint256 projectedMonthlyRewards,
        uint256 poolHealthDays,
        uint256 timestamp
    );

    constructor(
        address _revenueCollector,
        address _stakingContract,
        address _usdcToken,
        address _nvxToken,
        address _dexIntegration,
        uint256 _fundingInterval
    ) {
        require(_revenueCollector != address(0), "Invalid revenue collector");
        require(_stakingContract != address(0), "Invalid staking contract");
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_nvxToken != address(0), "Invalid NVX address");
        require(_fundingInterval > 0, "Invalid funding interval");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        revenueCollector = _revenueCollector;
        stakingContract = _stakingContract;
        usdcToken = _usdcToken;
        nvxToken = _nvxToken;
        dexIntegration = _dexIntegration; // Can be zero if using direct minting
        fundingInterval = _fundingInterval;
        lastFundingTime = block.timestamp;
        minFundingAmount = 1000 * 10**6; // 1000 USDC (6 decimals)
        targetPoolHealthDays = 90; // Target 90 days of rewards
    }

    /**
     * @notice Check pool health and execute funding if needed
     * @return poolHealthDays Current pool health in days
     */
    function checkPoolHealth() external view returns (uint256 poolHealthDays) {
        return _checkPoolHealth();
    }

    /**
     * @notice Internal function to check pool health
     * @return poolHealthDays Current pool health in days
     */
    function _checkPoolHealth() internal view returns (uint256 poolHealthDays) {
        NVXStaking staking = NVXStaking(stakingContract);
        uint256 currentBalance = staking.rewardsPool();
        uint256 totalStaked = staking.totalStakedAmount();
        
        // Calculate average APY (weighted by staked amounts)
        // For simplicity, assume 12% average APY
        // In production, calculate based on actual tier distribution
        uint256 averageAPYBps = 1200; // 12%
        uint256 monthlyRewards = (totalStaked * averageAPYBps) / (10000 * 12);
        
        if (monthlyRewards == 0) {
            return type(uint256).max; // Infinite health if no staking
        }
        
        poolHealthDays = (currentBalance * 30) / monthlyRewards;
        return poolHealthDays;
    }

    /**
     * @notice Execute funding (convert USDC to NVX and fund staking)
     * @param _usdcAmount Amount of USDC to convert (6 decimals)
     * @param _nvxAmount Expected NVX amount (18 decimals)
     * @dev Can be called manually or by keeper/automation
     */
    function executeFunding(uint256 _usdcAmount, uint256 _nvxAmount) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_usdcAmount >= minFundingAmount, "Amount below minimum");
        require(_nvxAmount > 0, "NVX amount must be > 0");

        // Get USDC from revenue collector
        // Note: RevenueCollector has payable fallback, so we use interface
        IERC20 usdc = IERC20(usdcToken);
        uint256 availableUSDC = usdc.balanceOf(revenueCollector);
        require(availableUSDC >= _usdcAmount, "Insufficient USDC in revenue collector");

        // In production: Convert USDC to NVX via DEX
        // For now, we'll assume NVX is minted or available
        // Step 1: Transfer USDC to exchange/DEX
        // Step 2: Swap USDC for NVX
        // Step 3: Transfer NVX to staking contract
        
        // Convert USDC to NVX via DEX (if DEX integration is set)
        uint256 nvxAmountToFund = _nvxAmount;
        
        if (dexIntegration != address(0)) {
            // Use DEX to swap USDC for NVX
            // Get expected NVX amount from DEX
            uint256 expectedNVX = DEXIntegration(dexIntegration).getExpectedNVXAmount(_usdcAmount);
            uint256 minNVX = DEXIntegration(dexIntegration).getMinNVXAmount(_usdcAmount);
            
            // Transfer USDC to DEX integration contract
            IERC20(usdcToken).safeTransferFrom(revenueCollector, dexIntegration, _usdcAmount);
            
            // Execute swap
            uint256 nvxReceived = DEXIntegration(dexIntegration).swapUSDCForNVX(_usdcAmount, minNVX);
            
            // Transfer NVX from DEX integration to this contract
            DEXIntegration(dexIntegration).transferNVX(address(this), nvxReceived);
            
            nvxAmountToFund = nvxReceived;
        } else {
            // Fallback: Direct minting or manual transfer
            // In production, this would require NVX to be minted or transferred manually
        }
        
        // Fund staking contract with NVX
        IERC20 nvx = IERC20(nvxToken);
        nvx.safeTransfer(stakingContract, nvxAmountToFund);
        
        // Call addRewardsPool on staking contract
        NVXStaking staking = NVXStaking(stakingContract);
        staking.addRewardsPool(nvxAmountToFund);

        // Update tracking
        totalFunded += nvxAmountToFund;
        fundingCount++;
        lastFundingTime = block.timestamp;

        // Check pool health
        uint256 poolHealth = _checkPoolHealth();

        emit FundingExecuted(_usdcAmount, nvxAmountToFund, poolHealth, block.timestamp);
    }

    /**
     * @notice Auto-funding check (can be called by keeper network)
     * @return shouldFund Whether funding should be executed
     * @return requiredAmount Amount of NVX needed
     */
    function shouldFund() external view returns (bool shouldFund, uint256 requiredAmount) {
        // Check if enough time has passed
        if (block.timestamp < lastFundingTime + fundingInterval) {
            return (false, 0);
        }

        // Check pool health
        uint256 poolHealth = _checkPoolHealth();
        if (poolHealth >= targetPoolHealthDays) {
            return (false, 0); // Pool is healthy
        }

        // Calculate required amount to reach target health
        NVXStaking staking = NVXStaking(stakingContract);
        uint256 totalStaked = staking.totalStakedAmount();
        uint256 averageAPYBps = 1200; // 12%
        uint256 monthlyRewards = (totalStaked * averageAPYBps) / (10000 * 12);
        uint256 currentBalance = staking.rewardsPool();
        uint256 targetBalance = (monthlyRewards * targetPoolHealthDays) / 30;
        
        if (targetBalance > currentBalance) {
            requiredAmount = targetBalance - currentBalance;
            return (true, requiredAmount);
        }

        return (false, 0);
    }

    /**
     * @notice Update funding schedule
     */
    function setFundingInterval(uint256 _interval) external onlyRole(ADMIN_ROLE) {
        require(_interval > 0, "Interval must be > 0");
        uint256 oldInterval = fundingInterval;
        fundingInterval = _interval;
        emit FundingScheduleUpdated(oldInterval, _interval, block.timestamp);
    }

    /**
     * @notice Update minimum funding amount
     */
    function setMinFundingAmount(uint256 _amount) external onlyRole(ADMIN_ROLE) {
        minFundingAmount = _amount;
    }

    /**
     * @notice Update target pool health
     */
    function setTargetPoolHealthDays(uint256 _days) external onlyRole(ADMIN_ROLE) {
        require(_days > 0, "Days must be > 0");
        targetPoolHealthDays = _days;
    }

    /**
     * @notice Update DEX integration contract
     */
    function setDEXIntegration(address _dexIntegration) external onlyRole(ADMIN_ROLE) {
        dexIntegration = _dexIntegration; // Can be zero to disable DEX
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}

