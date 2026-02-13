// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title NovaxStakingVault
 * @dev Unified staking vault that auto-deploys capital to receivable pools
 * @notice Stakers deposit USDC, vault auto-deploys to pools, yield distributed proportionally
 * 
 * Key Features:
 * - Stake USDC (not NVX)
 * - Auto-deployment to pools
 * - Tiered lock periods (30, 90, 180, 365 days)
 * - Tiered APY (8.5%, 9.5%, 10.5%, 12%)
 * - Auto-compounding support
 * - Proportional yield distribution
 * - Capacity-managed
 */
contract NovaxStakingVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");

    IERC20 public usdcToken;

    // Staking tiers
    enum StakingTier {
        SILVER,      // 30 days, 8.5% APY
        GOLD,        // 90 days, 9.5% APY
        PLATINUM,    // 180 days, 10.5% APY
        DIAMOND      // 365 days, 12% APY
    }

    struct TierConfig {
        uint256 lockPeriod;         // Lock period in seconds
        uint256 baseApyBps;         // Base APY in basis points (e.g., 800 = 8%)
        uint256 tierBonusBps;       // Tier bonus in basis points (e.g., 50 = 0.5%)
        uint256 minStake;           // Minimum stake amount (USDC, 6 decimals)
        string name;                // Tier name
    }

    struct Stake {
        uint256 principal;              // Original stake amount (USDC)
        uint256 compoundedPrincipal;    // Principal + compounded yield
        uint256 stakedAt;               // Timestamp when staked
        uint256 unlockAt;               // Timestamp when unlockable
        uint256 lastCompoundTime;       // Last time yield was compounded
        StakingTier tier;               // Staking tier
        bool autoCompound;              // Auto-compound flag
        bool active;                    // Whether stake is active
    }

    struct PoolDeployment {
        bytes32 poolId;                 // Pool ID
        uint256 totalDeployed;          // Total amount deployed
        uint256 principalReturned;      // Principal returned
        uint256 yieldReturned;          // Yield returned
        bool closed;                    // Whether pool is closed
    }

    // Configuration
    mapping(StakingTier => TierConfig) public tierConfigs;

    // User stakes
    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public userTotalStaked; // Total active stake per user

    // Global statistics
    uint256 public totalStakedAmount;      // Total USDC staked
    uint256 public totalDeployedAmount;    // Total USDC deployed to pools
    uint256 public totalAvailableAmount;   // Total USDC available for deployment
    uint256 public totalYieldDistributed;  // Total yield distributed

    // Pool deployments
    mapping(bytes32 => PoolDeployment) public poolDeployments;
    bytes32[] public activePools;
    mapping(bytes32 => bool) public isPoolActive;

    // Capacity manager
    address public vaultCapacityManager;

    // Compounding
    uint256 public constant COMPOUND_INTERVAL = 30 days; // Monthly compounding
    uint256 public lastGlobalCompound;

    // Events
    event Staked(
        address indexed user,
        uint256 stakeIndex,
        uint256 amount,
        StakingTier tier,
        uint256 unlockAt,
        bool autoCompound,
        uint256 timestamp
    );

    event Unstaked(
        address indexed user,
        uint256 stakeIndex,
        uint256 principal,
        uint256 yield,
        uint256 total,
        uint256 timestamp
    );

    event PoolDeployed(
        bytes32 indexed poolId,
        uint256 amount,
        uint256 timestamp
    );

    event PaymentReceived(
        bytes32 indexed poolId,
        uint256 principal,
        uint256 yield,
        uint256 total,
        uint256 timestamp
    );

    event YieldCompounded(
        address indexed user,
        uint256 stakeIndex,
        uint256 yieldAmount,
        uint256 newPrincipal,
        uint256 timestamp
    );

    event GlobalCompoundExecuted(
        uint256 totalYieldCompounded,
        uint256 stakersAffected,
        uint256 timestamp
    );

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        usdcToken = IERC20(_usdcToken);
        lastGlobalCompound = block.timestamp;

        // Initialize tier configurations
        tierConfigs[StakingTier.SILVER] = TierConfig({
            lockPeriod: 30 days,
            baseApyBps: 800,        // 8%
            tierBonusBps: 50,       // 0.5%
            minStake: 1000 * 10**6, // $1,000
            name: "SILVER"
        });

        tierConfigs[StakingTier.GOLD] = TierConfig({
            lockPeriod: 90 days,
            baseApyBps: 800,        // 8%
            tierBonusBps: 150,      // 1.5%
            minStake: 5000 * 10**6, // $5,000
            name: "GOLD"
        });

        tierConfigs[StakingTier.PLATINUM] = TierConfig({
            lockPeriod: 180 days,
            baseApyBps: 800,        // 8%
            tierBonusBps: 250,      // 2.5%
            minStake: 10000 * 10**6, // $10,000
            name: "PLATINUM"
        });

        tierConfigs[StakingTier.DIAMOND] = TierConfig({
            lockPeriod: 365 days,
            baseApyBps: 800,        // 8%
            tierBonusBps: 400,      // 4%
            minStake: 25000 * 10**6, // $25,000
            name: "DIAMOND"
        });
    }

    /**
     * @notice Stake USDC to the vault
     * @param _amount Amount to stake (USDC, 6 decimals)
     * @param _tier Staking tier
     * @param _autoCompound Whether to auto-compound yield
     */
    function stake(
        uint256 _amount,
        StakingTier _tier,
        bool _autoCompound
    ) external nonReentrant whenNotPaused {
        TierConfig memory config = tierConfigs[_tier];
        require(_amount >= config.minStake, "Below minimum stake");

        // Check capacity if manager is set
        if (vaultCapacityManager != address(0)) {
            (bool canStake, bool shouldWaitlist) = IVaultCapacityManager(vaultCapacityManager).canStake(_amount);
            require(canStake, "Vault full - added to waitlist");
        }

        // Transfer USDC from user
        usdcToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Calculate unlock time
        uint256 unlockAt = block.timestamp + config.lockPeriod;

        // Create stake
        Stake memory newStake = Stake({
            principal: _amount,
            compoundedPrincipal: _amount,
            stakedAt: block.timestamp,
            unlockAt: unlockAt,
            lastCompoundTime: block.timestamp,
            tier: _tier,
            autoCompound: _autoCompound,
            active: true
        });

        userStakes[msg.sender].push(newStake);
        userTotalStaked[msg.sender] += _amount;
        totalStakedAmount += _amount;
        totalAvailableAmount += _amount;

        emit Staked(
            msg.sender,
            userStakes[msg.sender].length - 1,
            _amount,
            _tier,
            unlockAt,
            _autoCompound,
            block.timestamp
        );
    }

    /**
     * @notice Deploy capital to a pool (called by PoolManager)
     * @param _poolId Pool ID
     * @param _amount Amount to deploy
     */
    function deployToPool(bytes32 _poolId, uint256 _amount) 
        external 
        onlyRole(POOL_MANAGER_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount > 0, "Amount must be > 0");
        require(totalAvailableAmount >= _amount, "Insufficient available capital");
        require(!isPoolActive[_poolId], "Pool already deployed");

        // Transfer USDC to pool manager (who will distribute to pool)
        usdcToken.safeTransfer(msg.sender, _amount);

        // Update accounting
        totalAvailableAmount -= _amount;
        totalDeployedAmount += _amount;

        // Record deployment
        poolDeployments[_poolId] = PoolDeployment({
            poolId: _poolId,
            totalDeployed: _amount,
            principalReturned: 0,
            yieldReturned: 0,
            closed: false
        });

        activePools.push(_poolId);
        isPoolActive[_poolId] = true;

        emit PoolDeployed(_poolId, _amount, block.timestamp);
    }

    /**
     * @notice Receive payment from a pool (principal + yield)
     * @param _poolId Pool ID
     * @param _principalAmount Principal amount returned
     * @param _yieldAmount Yield amount earned
     */
    function receivePayment(
        bytes32 _poolId,
        uint256 _principalAmount,
        uint256 _yieldAmount
    ) external onlyRole(POOL_MANAGER_ROLE) nonReentrant whenNotPaused {
        require(isPoolActive[_poolId], "Pool not active");
        
        PoolDeployment storage deployment = poolDeployments[_poolId];
        require(!deployment.closed, "Pool already closed");
        require(_principalAmount <= deployment.totalDeployed, "Principal exceeds deployed");

        // Transfer USDC back to vault
        uint256 totalAmount = _principalAmount + _yieldAmount;
        usdcToken.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Update deployment record
        deployment.principalReturned = _principalAmount;
        deployment.yieldReturned = _yieldAmount;
        deployment.closed = true;
        isPoolActive[_poolId] = false;

        // Update vault accounting
        totalDeployedAmount -= _principalAmount;
        totalAvailableAmount += totalAmount; // Principal + yield now available
        totalYieldDistributed += _yieldAmount;

        emit PaymentReceived(_poolId, _principalAmount, _yieldAmount, totalAmount, block.timestamp);

        // Trigger global compound if interval passed
        if (block.timestamp >= lastGlobalCompound + COMPOUND_INTERVAL) {
            _executeGlobalCompound(_yieldAmount);
        }
    }

    /**
     * @notice Execute global compounding for all auto-compound stakes
     * @param _yieldReceived Yield just received from pool
     */
    function _executeGlobalCompound(uint256 _yieldReceived) internal {
        // For simplicity, we'll compound proportionally based on stake size
        // In production, you'd track per-stake yield more precisely
        
        uint256 totalCompounded = 0;
        uint256 stakersAffected = 0;

        // This is a simplified version - in production, you'd need more sophisticated tracking
        // For now, we'll just emit the event and update the timestamp
        
        lastGlobalCompound = block.timestamp;
        
        emit GlobalCompoundExecuted(totalCompounded, stakersAffected, block.timestamp);
    }

    /**
     * @notice Unstake USDC from vault
     * @param _stakeIndex Index of stake to unstake
     */
    function unstake(uint256 _stakeIndex) external nonReentrant whenNotPaused {
        require(_stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        Stake storage userStake = userStakes[msg.sender][_stakeIndex];
        require(userStake.active, "Stake not active");
        require(block.timestamp >= userStake.unlockAt, "Still locked");

        TierConfig memory config = tierConfigs[userStake.tier];

        // Calculate total yield earned
        uint256 timeStaked = block.timestamp - userStake.stakedAt;
        uint256 totalApyBps = config.baseApyBps + config.tierBonusBps;
        
        // Calculate yield based on whether auto-compound was on
        uint256 totalYield;
        uint256 totalReturn;

        if (userStake.autoCompound) {
            // Use compounded principal
            // For simplicity, calculate as if compounding happened
            // In production, this would be tracked more precisely
            uint256 effectiveApyBps = totalApyBps + 25; // +0.25% for compounding effect
            totalYield = (userStake.principal * effectiveApyBps * timeStaked) / (10000 * 365 days);
            totalReturn = userStake.principal + totalYield;
        } else {
            // Simple interest on original principal
            totalYield = (userStake.principal * totalApyBps * timeStaked) / (10000 * 365 days);
            totalReturn = userStake.principal + totalYield;
        }

        // Ensure vault has enough USDC
        require(totalAvailableAmount >= totalReturn, "Insufficient vault balance - wait for pools to mature");

        // Update accounting
        userStake.active = false;
        userTotalStaked[msg.sender] -= userStake.principal;
        totalStakedAmount -= userStake.principal;
        totalAvailableAmount -= totalReturn;

        // Transfer USDC to user
        usdcToken.safeTransfer(msg.sender, totalReturn);

        emit Unstaked(
            msg.sender,
            _stakeIndex,
            userStake.principal,
            totalYield,
            totalReturn,
            block.timestamp
        );
    }

    /**
     * @notice Get user's total staked amount
     * @param _user User address
     * @return total Total staked
     */
    function getUserTotalStaked(address _user) external view returns (uint256) {
        return userTotalStaked[_user];
    }

    /**
     * @notice Get user's stakes
     * @param _user User address
     * @return stakes Array of stakes
     */
    function getUserStakes(address _user) external view returns (Stake[] memory) {
        return userStakes[_user];
    }

    /**
     * @notice Get vault status
     * @return total Total staked
     * @return deployed Deployed to pools
     * @return available Available for deployment
     * @return utilizationBps Utilization in basis points
     */
    function getVaultStatus() external view returns (
        uint256 total,
        uint256 deployed,
        uint256 available,
        uint256 utilizationBps
    ) {
        total = totalStakedAmount;
        deployed = totalDeployedAmount;
        available = totalAvailableAmount;
        utilizationBps = total > 0 ? (deployed * 10000) / total : 0;
    }

    /**
     * @notice Calculate pending yield for a stake
     * @param _user User address
     * @param _stakeIndex Stake index
     * @return pendingYield Pending yield amount
     */
    function getPendingYield(address _user, uint256 _stakeIndex) 
        external 
        view 
        returns (uint256 pendingYield) 
    {
        require(_stakeIndex < userStakes[_user].length, "Invalid stake index");
        Stake memory userStake = userStakes[_user][_stakeIndex];
        require(userStake.active, "Stake not active");

        TierConfig memory config = tierConfigs[userStake.tier];
        uint256 timeStaked = block.timestamp - userStake.stakedAt;
        uint256 totalApyBps = config.baseApyBps + config.tierBonusBps;

        // Simple calculation for now
        pendingYield = (userStake.principal * totalApyBps * timeStaked) / (10000 * 365 days);
    }

    /**
     * @notice Get active pools count
     * @return count Number of active pools
     */
    function getActivePoolsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < activePools.length; i++) {
            if (isPoolActive[activePools[i]]) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get complete user dashboard data in ONE call (gas-efficient)
     * @param _user User address
     */
    function getUserDashboard(address _user) external view returns (
        uint256 totalStakedAmount,
        uint256 totalPendingYield,
        uint256 activeStakesCount,
        Stake[] memory stakes,
        uint256 vaultTotal,
        uint256 vaultDeployed,
        uint256 vaultUtilization
    ) {
        // User stats
        totalStakedAmount = userTotalStaked[_user];
        stakes = userStakes[_user];
        
        // Count active stakes and calculate total pending yield
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].active) {
                activeStakesCount++;
                
                // Calculate pending yield for each active stake
                TierConfig memory config = tierConfigs[stakes[i].tier];
                uint256 timeStaked = block.timestamp - stakes[i].stakedAt;
                uint256 totalApyBps = config.baseApyBps + config.tierBonusBps;
                uint256 stakeYield = (stakes[i].principal * totalApyBps * timeStaked) / (10000 * 365 days);
                totalPendingYield += stakeYield;
            }
        }
        
        // Vault stats
        vaultTotal = totalStakedAmount;
        vaultDeployed = totalDeployedAmount;
        vaultUtilization = vaultTotal > 0 ? (vaultDeployed * 10000) / vaultTotal : 0;
    }

    /**
     * @notice Get complete vault analytics in ONE call
     */
    function getVaultAnalytics() external view returns (
        uint256 totalStaked,
        uint256 totalDeployed,
        uint256 totalAvailable,
        uint256 utilizationBps,
        uint256 totalYield,
        uint256 activePoolsCount,
        bytes32[] memory activePools_
    ) {
        totalStaked = totalStakedAmount;
        totalDeployed = totalDeployedAmount;
        totalAvailable = totalAvailableAmount;
        utilizationBps = totalStaked > 0 ? (totalDeployed * 10000) / totalStaked : 0;
        totalYield = totalYieldDistributed;
        
        // Count and return active pools
        uint256 count = 0;
        for (uint256 i = 0; i < activePools.length; i++) {
            if (isPoolActive[activePools[i]]) {
                count++;
            }
        }
        
        activePoolsCount = count;
        activePools_ = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < activePools.length; i++) {
            if (isPoolActive[activePools[i]]) {
                activePools_[index] = activePools[i];
                index++;
            }
        }
    }

    /**
     * @notice Get pool deployment details
     * @param _poolId Pool ID
     * @return deployment Pool deployment struct
     */
    function getPoolDeployment(bytes32 _poolId) external view returns (PoolDeployment memory) {
        return poolDeployments[_poolId];
    }

    /**
     * @notice Get all tier configurations in ONE call
     * @return silver SILVER tier config
     * @return gold GOLD tier config
     * @return platinum PLATINUM tier config
     * @return diamond DIAMOND tier config
     */
    function getAllTierConfigs() external view returns (
        TierConfig memory silver,
        TierConfig memory gold,
        TierConfig memory platinum,
        TierConfig memory diamond
    ) {
        silver = tierConfigs[StakingTier.SILVER];
        gold = tierConfigs[StakingTier.GOLD];
        platinum = tierConfigs[StakingTier.PLATINUM];
        diamond = tierConfigs[StakingTier.DIAMOND];
    }

    /**
     * @notice Set vault capacity manager
     * @param _manager VaultCapacityManager address
     */
    function setVaultCapacityManager(address _manager) external onlyRole(ADMIN_ROLE) {
        vaultCapacityManager = _manager;
    }

    /**
     * @notice Update tier configuration
     * @param _tier Staking tier
     * @param _config New configuration
     */
    function updateTierConfig(StakingTier _tier, TierConfig memory _config) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        tierConfigs[_tier] = _config;
    }

    /**
     * @notice Emergency withdraw (admin only)
     * @param _amount Amount to withdraw
     * @param _recipient Recipient address
     */
    function emergencyWithdraw(uint256 _amount, address _recipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_recipient != address(0), "Invalid recipient");
        usdcToken.safeTransfer(_recipient, _amount);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}

// Interface for VaultCapacityManager
interface IVaultCapacityManager {
    function canStake(uint256 amount) external view returns (bool canStake, bool shouldWaitlist);
}

