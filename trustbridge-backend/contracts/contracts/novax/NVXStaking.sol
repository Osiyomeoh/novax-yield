// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NVXToken.sol";

/**
 * @title NVXStaking
 * @dev Staking contract for NVX tokens with lock periods and APY rewards
 * @notice Users can stake NVX tokens for 1, 3, 6, or 12 months to earn rewards
 */
contract NVXStaking is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    NVXToken public nvxToken;

    // Staking tiers
    enum StakingTier {
        ONE_MONTH,   // 1 month
        THREE_MONTH, // 3 months
        SIX_MONTH,   // 6 months
        TWELVE_MONTH // 12 months
    }

    struct StakingConfig {
        uint256 lockPeriod;      // Lock period in seconds
        uint256 apyBps;          // APY in basis points (e.g., 500 = 5%)
        uint256 minStake;        // Minimum stake amount (in wei)
        uint256 earlyUnstakePenaltyBps; // Early unstake penalty (e.g., 5000 = 50%)
    }

    struct Stake {
        uint256 amount;          // Staked amount
        StakingTier tier;        // Staking tier
        uint256 stakedAt;        // Timestamp when staked
        uint256 unlockAt;        // Timestamp when unlockable
        uint256 rewardsClaimed;  // Total rewards claimed
        bool active;             // Whether stake is active
    }

    // Staking configurations
    mapping(StakingTier => StakingConfig) public stakingConfigs;
    
    // User stakes
    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public totalStaked; // Total staked per user
    
    // Global statistics
    uint256 public totalStakedAmount; // Total NVX staked across all users
    uint256 public totalRewardsDistributed; // Total rewards distributed
    
    // Rewards pool
    uint256 public rewardsPool; // Available rewards pool
    
    // Events
    event Staked(
        address indexed user,
        uint256 amount,
        StakingTier tier,
        uint256 unlockAt,
        uint256 timestamp
    );
    
    event Unstaked(
        address indexed user,
        uint256 stakeIndex,
        uint256 amount,
        uint256 rewards,
        bool earlyUnstake,
        uint256 timestamp
    );
    
    event RewardsClaimed(
        address indexed user,
        uint256 stakeIndex,
        uint256 amount,
        uint256 timestamp
    );
    
    event RewardsPoolUpdated(uint256 oldAmount, uint256 newAmount);
    event StakingConfigUpdated(StakingTier tier, StakingConfig config);

    constructor(address _nvxToken) {
        require(_nvxToken != address(0), "Invalid NVX token address");
        nvxToken = NVXToken(_nvxToken);
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        // Initialize staking configurations with sustainable APY rates
        // 1 month: 3% APY, 100 NVX min, 50% early penalty
        stakingConfigs[StakingTier.ONE_MONTH] = StakingConfig({
            lockPeriod: 30 days,
            apyBps: 300, // 3% (reduced from 5%)
            minStake: 100 * 10**18, // 100 NVX
            earlyUnstakePenaltyBps: 5000 // 50%
        });
        
        // 3 months: 6% APY, 500 NVX min, 50% early penalty
        stakingConfigs[StakingTier.THREE_MONTH] = StakingConfig({
            lockPeriod: 90 days,
            apyBps: 600, // 6% (reduced from 10%)
            minStake: 500 * 10**18, // 500 NVX
            earlyUnstakePenaltyBps: 5000 // 50%
        });
        
        // 6 months: 9% APY, 1000 NVX min, 50% early penalty
        stakingConfigs[StakingTier.SIX_MONTH] = StakingConfig({
            lockPeriod: 180 days,
            apyBps: 900, // 9% (reduced from 15%)
            minStake: 1000 * 10**18, // 1000 NVX
            earlyUnstakePenaltyBps: 5000 // 50%
        });
        
        // 12 months: 15% APY, 5000 NVX min, 50% early penalty
        stakingConfigs[StakingTier.TWELVE_MONTH] = StakingConfig({
            lockPeriod: 365 days,
            apyBps: 1500, // 15% (reduced from 25%)
            minStake: 5000 * 10**18, // 5000 NVX
            earlyUnstakePenaltyBps: 5000 // 50%
        });
    }

    /**
     * @notice Stake NVX tokens
     * @param _amount Amount to stake (in wei)
     * @param _tier Staking tier
     */
    function stake(uint256 _amount, StakingTier _tier) external nonReentrant whenNotPaused {
        StakingConfig memory config = stakingConfigs[_tier];
        require(_amount >= config.minStake, "Amount below minimum");
        // Calculate maximum potential rewards for the full lock period
        uint256 maxRewards = _calculateRewards(_amount, config.apyBps, config.lockPeriod);
        require(rewardsPool >= maxRewards, "Insufficient rewards pool");
        
        // Transfer NVX from user
        IERC20 token = IERC20(address(nvxToken));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        
        // Calculate unlock time
        uint256 unlockAt = block.timestamp + config.lockPeriod;
        
        // Create stake
        Stake memory newStake = Stake({
            amount: _amount,
            tier: _tier,
            stakedAt: block.timestamp,
            unlockAt: unlockAt,
            rewardsClaimed: 0,
            active: true
        });
        
        userStakes[msg.sender].push(newStake);
        totalStaked[msg.sender] += _amount;
        totalStakedAmount += _amount;
        
        emit Staked(msg.sender, _amount, _tier, unlockAt, block.timestamp);
    }

    /**
     * @notice Unstake NVX tokens
     * @param _stakeIndex Index of stake to unstake
     */
    function unstake(uint256 _stakeIndex) external nonReentrant whenNotPaused {
        require(_stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        Stake storage userStake = userStakes[msg.sender][_stakeIndex];
        require(userStake.active, "Stake already unstaked");
        
        StakingConfig memory config = stakingConfigs[userStake.tier];
        bool earlyUnstake = block.timestamp < userStake.unlockAt;
        
        // Calculate rewards
        uint256 rewards = _calculateRewards(
            userStake.amount,
            config.apyBps,
            block.timestamp - userStake.stakedAt
        );
        
        uint256 amountToReturn = userStake.amount;
        
        // Apply early unstake penalty
        if (earlyUnstake) {
            uint256 penalty = (rewards * config.earlyUnstakePenaltyBps) / 10000;
            rewards -= penalty;
        }
        
        // Mark stake as inactive
        userStake.active = false;
        userStake.rewardsClaimed = rewards;
        
        // Update statistics
        totalStaked[msg.sender] -= userStake.amount;
        totalStakedAmount -= userStake.amount;
        totalRewardsDistributed += rewards;
        rewardsPool -= rewards;
        
        // Transfer staked amount back
        IERC20 token = IERC20(address(nvxToken));
        token.safeTransfer(msg.sender, amountToReturn);
        
        // Mint and transfer rewards
        if (rewards > 0) {
            nvxToken.mint(msg.sender, rewards);
        }
        
        emit Unstaked(msg.sender, _stakeIndex, amountToReturn, rewards, earlyUnstake, block.timestamp);
    }

    /**
     * @notice Calculate rewards for a stake
     * @param _amount Staked amount
     * @param _apyBps APY in basis points
     * @param _duration Duration in seconds
     * @return rewards Calculated rewards
     */
    function _calculateRewards(
        uint256 _amount,
        uint256 _apyBps,
        uint256 _duration
    ) internal pure returns (uint256) {
        // Formula: amount * (APY / 10000) * (duration / 365 days)
        // APY is annual, so we prorate based on duration
        uint256 annualRewards = (_amount * _apyBps) / 10000;
        uint256 rewards = (annualRewards * _duration) / 365 days;
        return rewards;
    }

    /**
     * @notice Get pending rewards for a stake
     * @param _user User address
     * @param _stakeIndex Stake index
     * @return rewards Pending rewards
     */
    function getPendingRewards(address _user, uint256 _stakeIndex) external view returns (uint256) {
        require(_stakeIndex < userStakes[_user].length, "Invalid stake index");
        Stake memory userStake = userStakes[_user][_stakeIndex];
        require(userStake.active, "Stake not active");
        
        StakingConfig memory config = stakingConfigs[userStake.tier];
        uint256 duration = block.timestamp - userStake.stakedAt;
        
        uint256 rewards = _calculateRewards(userStake.amount, config.apyBps, duration);
        return rewards - userStake.rewardsClaimed;
    }

    /**
     * @notice Get all stakes for a user
     * @param _user User address
     * @return stakes Array of stakes
     */
    function getUserStakes(address _user) external view returns (Stake[] memory) {
        return userStakes[_user];
    }

    /**
     * @notice Get stake count for a user
     * @param _user User address
     * @return count Number of stakes
     */
    function getUserStakeCount(address _user) external view returns (uint256) {
        return userStakes[_user].length;
    }

    /**
     * @notice Add rewards to the rewards pool
     * @param _amount Amount to add (in wei)
     */
    function addRewardsPool(uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        IERC20 token = IERC20(address(nvxToken));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 oldAmount = rewardsPool;
        rewardsPool += _amount;
        emit RewardsPoolUpdated(oldAmount, rewardsPool);
    }

    /**
     * @notice Update staking configuration
     * @param _tier Staking tier
     * @param _config New configuration
     */
    function updateStakingConfig(StakingTier _tier, StakingConfig memory _config) external onlyRole(ADMIN_ROLE) {
        stakingConfigs[_tier] = _config;
        emit StakingConfigUpdated(_tier, _config);
    }

    /**
     * @notice Pause staking
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause staking
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (only admin)
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = nvxToken.balanceOf(address(this));
        IERC20 token = IERC20(address(nvxToken));
        token.safeTransfer(msg.sender, balance);
    }
}

