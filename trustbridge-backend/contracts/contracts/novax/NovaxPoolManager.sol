// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PoolToken.sol";
import "./NovaxRwaFactory.sol";
import "./NovaxReceivableFactory.sol";

// Interfaces for integration
interface INovaxStakingVault {
    function deployToPool(bytes32 poolId, uint256 amount) external;
    function receivePayment(bytes32 poolId, uint256 principal, uint256 yield) external;
}

interface IVaultCapacityManager {
    function recordDealVolume(uint256 amount) external;
}

/**
 * @title NovaxPoolManager
 * @dev USDC-based pool management for RWA and Receivable pools
 * @notice Handles investments, withdrawals, and yield distribution
 */
contract NovaxPoolManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE"); // AMC role for managing tradable assets

    enum PoolType {
        RWA,
        RECEIVABLE
    }

    enum PoolStatus {
        ACTIVE,
        FUNDED,      // Pool fully funded, exporter paid
        MATURED,     // Maturity date reached
        PAID,        // Payment received
        DEFAULTED,   // Payment overdue
        CLOSED,      // Pool closed, yield distributed
        PAUSED
    }

    enum PaymentStatus {
        PENDING,
        PARTIAL,
        FULL
    }

    struct Pool {
        bytes32 id;                    // Unique pool identifier
        PoolType poolType;              // RWA or Receivable pool
        bytes32 assetId;                // RWA asset ID or Receivable ID
        address assetFactory;           // NovaxRwaFactory or NovaxReceivableFactory
        address poolToken;              // PoolToken contract address
        address usdcToken;               // USDC token address
        uint256 totalInvested;          // Total USDC invested
        uint256 totalShares;            // Total pool tokens minted
        uint256 targetAmount;           // Target funding amount
        uint256 minInvestment;          // Minimum investment amount
        uint256 maxInvestment;          // Maximum investment per user
        uint8 status;                   // Pool status
        uint256 apr;                    // Annual Percentage Rate (basis points)
        uint256 createdAt;              // Creation timestamp
        uint256 closedAt;               // Closing timestamp
        address creator;                // Pool creator
        uint256 maturityDate;           // Maturity date (timestamp)
        uint256 totalPaid;              // Total payment received
        uint8 paymentStatus;            // Payment status (PENDING, PARTIAL, FULL)
        uint256 rewardPool;             // NVX reward pool amount (18 decimals)
    }

    // Storage mappings
    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => bool) public poolExists;
    mapping(bytes32 => mapping(address => uint256)) public userInvestments; // poolId => user => amount
    mapping(bytes32 => address[]) public poolInvestors; // poolId => investors[]
    mapping(address => bytes32[]) public userPools; // user => poolIds[]
    bytes32[] public allPools; // Array of all pool IDs

    uint256 public totalPools;
    address public usdcToken; // USDC token address
    address public rwaFactory; // NovaxRwaFactory address
    address public receivableFactory; // NovaxReceivableFactory address
    address public nvxToken; // NVX token address
    address public platformTreasury; // Platform treasury address
    address public amc; // AMC address for fee distribution
    address public revenueCollector; // RevenueCollector contract address (optional)
    address public stakingVault; // NovaxStakingVault contract for auto-deployment
    address public vaultCapacityManager; // VaultCapacityManager contract
    uint256 public platformFeeBps; // Platform fee in basis points (e.g., 100 = 1%)
    uint256 public amcFeeBps; // AMC fee in basis points (e.g., 200 = 2%)

    // Events
    event PoolCreated(
        bytes32 indexed poolId,
        PoolType poolType,
        bytes32 indexed assetId,
        address indexed creator,
        uint256 targetAmount,
        uint256 apr,
        uint256 timestamp
    );

    event InvestmentMade(
        bytes32 indexed poolId,
        address indexed investor,
        uint256 usdcAmount,
        uint256 sharesMinted,
        uint256 timestamp
    );

    event WithdrawalMade(
        bytes32 indexed poolId,
        address indexed investor,
        uint256 usdcAmount,
        uint256 sharesBurned,
        uint256 timestamp
    );

    event YieldDistributed(
        bytes32 indexed poolId,
        uint256 totalYield,
        uint256 timestamp
    );

    event PoolClosed(
        bytes32 indexed poolId,
        uint256 totalInvested,
        uint256 timestamp
    );

    event ExporterPaid(
        bytes32 indexed poolId,
        address indexed exporter,
        uint256 exporterAmount,
        uint256 platformFee,
        uint256 amcFee,
        uint256 timestamp
    );

    event TokenRewardDistributed(
        bytes32 indexed poolId,
        address indexed investor,
        uint256 nvxAmount,
        uint256 timestamp
    );

    event PaymentRecorded(
        bytes32 indexed poolId,
        uint256 paymentAmount,
        uint256 totalPaid,
        uint256 timestamp
    );

    event PoolMatured(
        bytes32 indexed poolId,
        uint256 maturityDate,
        uint256 timestamp
    );

    event PoolDefaulted(
        bytes32 indexed poolId,
        uint256 timestamp
    );

    event FeePaidInToken(
        bytes32 indexed poolId,
        address indexed exporter,
        uint256 feeAmount,
        uint256 discount,
        uint256 timestamp
    );

    constructor(
        address _usdcToken,
        address _nvxToken,
        address _platformTreasury,
        address _amc,
        uint256 _platformFeeBps,
        uint256 _amcFeeBps
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(AMC_ROLE, msg.sender); // Deployer gets AMC role initially
        usdcToken = _usdcToken;
        nvxToken = _nvxToken;
        platformTreasury = _platformTreasury;
        amc = _amc;
        platformFeeBps = _platformFeeBps;
        amcFeeBps = _amcFeeBps;
    }

    /**
     * @notice Create a new investment pool
     * @notice For RWA pools: Only AMC can create pools for assets they've approved
     * @notice For Receivable pools: Only AMC can create pools (tradable assets)
     * @param _poolType RWA or RECEIVABLE
     * @param _assetId RWA asset ID or Receivable ID
     * @param _targetAmount Target funding amount in USDC (6 decimals)
     * @param _minInvestment Minimum investment in USDC (6 decimals)
     * @param _maxInvestment Maximum investment per user in USDC (6 decimals)
     * @param _apr Annual Percentage Rate (basis points, e.g., 1200 = 12%)
     * @param _maturityDate Maturity date (timestamp)
     * @param _rewardPool NVX reward pool amount (18 decimals)
     * @param _poolTokenName Pool token name
     * @param _poolTokenSymbol Pool token symbol
     * @return poolId The created pool ID
     */
    function createPool(
        PoolType _poolType,
        bytes32 _assetId,
        uint256 _targetAmount,
        uint256 _minInvestment,
        uint256 _maxInvestment,
        uint256 _apr,
        uint256 _maturityDate,
        uint256 _rewardPool,
        string memory _poolTokenName,
        string memory _poolTokenSymbol
    ) external nonReentrant whenNotPaused onlyRole(AMC_ROLE) returns (bytes32) {
        require(_targetAmount > 0, "Target amount must be greater than 0");
        require(_minInvestment > 0, "Min investment must be greater than 0");
        require(_maxInvestment >= _minInvestment, "Max investment must be >= min investment");
        require(_apr <= 5000, "APR must be <= 50% (5000 basis points)");
        require(_maturityDate > block.timestamp, "Maturity date must be in the future");

        address assetFactory;
        if (_poolType == PoolType.RWA) {
            require(rwaFactory != address(0), "RWA Factory not set");
            assetFactory = rwaFactory;
            
            // Verify asset is AMC approved and AMC is the one who approved it
            NovaxRwaFactory rwaFactoryContract = NovaxRwaFactory(rwaFactory);
            require(rwaFactoryContract.doesAssetExist(_assetId), "RWA asset does not exist");
            
            // Get asset details
            NovaxRwaFactory.RwaAsset memory asset = rwaFactoryContract.getAsset(_assetId);
            require(
                asset.status == uint8(NovaxRwaFactory.AssetStatus.AMC_APPROVED),
                "Asset must be AMC approved"
            );
            require(
                asset.currentAMC == msg.sender,
                "Only the AMC who approved this asset can create pool"
            );
        } else {
            require(receivableFactory != address(0), "Receivable Factory not set");
            assetFactory = receivableFactory;
            
            // Verify receivable is verified (AMC can create pool for verified receivables)
            NovaxReceivableFactory receivableFactoryContract = NovaxReceivableFactory(receivableFactory);
            require(
                receivableFactoryContract.receivableExists(_assetId),
                "Receivable does not exist"
            );
            NovaxReceivableFactory.Receivable memory receivable = receivableFactoryContract.getReceivable(_assetId);
            require(
                receivable.status == uint8(NovaxReceivableFactory.ReceivableStatus.VERIFIED),
                "Receivable must be verified"
            );
            // Use receivable due date as maturity date if not provided
            if (_maturityDate == 0) {
                _maturityDate = receivable.dueDate;
            }
        }

        // Generate unique pool ID
        bytes32 poolId = keccak256(
            abi.encodePacked(
                _poolType,
                _assetId,
                _targetAmount,
                block.timestamp,
                block.prevrandao,
                msg.sender
            )
        );

        require(!poolExists[poolId], "Pool ID collision");

        // Deploy pool token
        PoolToken poolToken = new PoolToken(_poolTokenName, _poolTokenSymbol, address(this));

        // Create pool
        pools[poolId] = Pool({
            id: poolId,
            poolType: _poolType,
            assetId: _assetId,
            assetFactory: assetFactory,
            poolToken: address(poolToken),
            usdcToken: usdcToken,
            totalInvested: 0,
            totalShares: 0,
            targetAmount: _targetAmount,
            minInvestment: _minInvestment,
            maxInvestment: _maxInvestment,
            status: uint8(PoolStatus.ACTIVE),
            apr: _apr,
            createdAt: block.timestamp,
            closedAt: 0,
            creator: msg.sender,
            maturityDate: _maturityDate,
            totalPaid: 0,
            paymentStatus: uint8(PaymentStatus.PENDING),
            rewardPool: _rewardPool
        });

        poolExists[poolId] = true;
        allPools.push(poolId); // Add to global array
        userPools[msg.sender].push(poolId);
        totalPools++;

        emit PoolCreated(poolId, _poolType, _assetId, msg.sender, _targetAmount, _apr, block.timestamp);

        // Record deal volume for capacity management
        if (vaultCapacityManager != address(0)) {
            try IVaultCapacityManager(vaultCapacityManager).recordDealVolume(_targetAmount) {
                // Successfully recorded
            } catch {
                // Failed to record, continue anyway
            }
        }

        // Trigger auto-deployment from staking vault if configured
        if (stakingVault != address(0)) {
            _tryVaultDeployment(poolId, _targetAmount);
        }

        return poolId;
    }

    /**
     * @notice Try to deploy from staking vault
     * @param _poolId Pool ID
     * @param _amount Amount needed
     */
    function _tryVaultDeployment(bytes32 _poolId, uint256 _amount) internal {
        Pool storage pool = pools[_poolId];
        
        try INovaxStakingVault(stakingVault).deployToPool(_poolId, _amount) {
            // Vault deployed successfully - USDC received
            pool.totalInvested = _amount;
            pool.totalShares = _amount * 1e12; // 1:1 ratio scaled to 18 decimals
            
            // Mint pool tokens to vault to track ownership
            PoolToken(pool.poolToken).mint(stakingVault, pool.totalShares);
            
            // Auto-release to exporter if target reached
            if (pool.totalInvested >= pool.targetAmount) {
                _releaseToExporter(_poolId);
            }
            
            emit InvestmentMade(_poolId, stakingVault, _amount, pool.totalShares, block.timestamp);
        } catch (bytes memory) {
            // Vault deployment failed - pool remains ACTIVE for manual investment
            // This is OK - means vault doesn't have capacity or is not configured
        }
    }

    /**
     * @notice Invest USDC in a pool
     * @param _poolId Pool ID
     * @param _usdcAmount Amount of USDC to invest (6 decimals)
     */
    function invest(bytes32 _poolId, uint256 _usdcAmount) external nonReentrant whenNotPaused {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(pool.status == uint8(PoolStatus.ACTIVE), "Pool is not active");
        require(_usdcAmount >= pool.minInvestment, "Amount below minimum investment");
        require(
            userInvestments[_poolId][msg.sender] + _usdcAmount <= pool.maxInvestment,
            "Exceeds maximum investment"
        );
        require(pool.totalInvested + _usdcAmount <= pool.targetAmount, "Exceeds target amount");

        // Transfer USDC from investor
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), _usdcAmount);

        // Calculate shares (1:1 ratio, but scale for 18 decimals)
        // USDC has 6 decimals, PoolToken has 18 decimals
        // So we multiply by 10^12 to maintain 1:1 ratio
        uint256 shares = _usdcAmount * 1e12;

        // Mint pool tokens
        PoolToken(pool.poolToken).mint(msg.sender, shares);

        // Update pool state
        pool.totalInvested += _usdcAmount;
        pool.totalShares += shares;
        userInvestments[_poolId][msg.sender] += _usdcAmount;

        // Track investors
        if (userInvestments[_poolId][msg.sender] == _usdcAmount) {
            poolInvestors[_poolId].push(msg.sender);
            userPools[msg.sender].push(_poolId);
        }

        // Distribute NVX rewards
        if (nvxToken != address(0) && pool.rewardPool > 0) {
            uint256 rewardAmount = calculateNVXReward(_usdcAmount, pool.targetAmount, pool.rewardPool);
            if (rewardAmount > 0) {
                IERC20(nvxToken).safeTransfer(msg.sender, rewardAmount);
                emit TokenRewardDistributed(_poolId, msg.sender, rewardAmount, block.timestamp);
            }
        }

        // Auto-release to exporter if target reached
        if (pool.totalInvested >= pool.targetAmount && pool.status == uint8(PoolStatus.ACTIVE)) {
            _releaseToExporter(_poolId);
        }

        emit InvestmentMade(_poolId, msg.sender, _usdcAmount, shares, block.timestamp);
    }

    /**
     * @notice Calculate NVX reward for investment
     * @param _investment Investment amount in USDC (6 decimals)
     * @param _targetAmount Pool target amount in USDC (6 decimals)
     * @param _rewardPool Total reward pool in NVX (18 decimals)
     * @return rewardAmount NVX reward amount (18 decimals)
     */
    function calculateNVXReward(
        uint256 _investment,
        uint256 _targetAmount,
        uint256 _rewardPool
    ) internal pure returns (uint256) {
        if (_rewardPool == 0 || _targetAmount == 0) {
            return 0;
        }
        // Calculate reward: (investment / target) * rewardPool * 0.5%
        // 0.5% = 50 basis points = 0.005
        // Formula: (investment * rewardPool * 50) / (targetAmount * 10000)
        return (_investment * _rewardPool * 50) / (_targetAmount * 10000);
    }

    /**
     * @notice Release funds to exporter (internal, called automatically)
     * @param _poolId Pool ID
     */
    function _releaseToExporter(bytes32 _poolId) internal {
        Pool storage pool = pools[_poolId];
        require(pool.totalInvested >= pool.targetAmount, "Pool not fully funded");
        require(pool.status == uint8(PoolStatus.ACTIVE), "Pool not active");

        // Get exporter address from asset
        address exporter = _getExporterFromAsset(pool.assetId, pool.poolType, pool.assetFactory);

        // Calculate fees
        uint256 platformFee = (pool.totalInvested * platformFeeBps) / 10000;
        uint256 amcFeeAmount = (pool.totalInvested * amcFeeBps) / 10000;
        uint256 exporterAmount = pool.totalInvested - platformFee - amcFeeAmount;

        // Transfer funds
        IERC20(usdcToken).safeTransfer(exporter, exporterAmount);
        
        // Send platform fee to revenue collector (if set), otherwise to treasury
        if (platformFee > 0) {
            if (revenueCollector != address(0)) {
                // Transfer to revenue collector for allocation
                IERC20(usdcToken).safeTransfer(revenueCollector, platformFee);
                // RevenueCollector will handle allocation (30% to staking, etc.)
            } else if (platformTreasury != address(0)) {
                // Fallback to direct treasury transfer
                IERC20(usdcToken).safeTransfer(platformTreasury, platformFee);
            }
        }
        
        if (amcFeeAmount > 0 && amc != address(0)) {
            IERC20(usdcToken).safeTransfer(amc, amcFeeAmount);
        }

        pool.status = uint8(PoolStatus.FUNDED);

        emit ExporterPaid(_poolId, exporter, exporterAmount, platformFee, amcFeeAmount, block.timestamp);
    }

    /**
     * @notice Release funds to exporter (public, can be called manually if needed)
     * @param _poolId Pool ID
     */
    function releaseToExporter(bytes32 _poolId) external nonReentrant whenNotPaused {
        Pool storage pool = pools[_poolId];
        require(pool.totalInvested >= pool.targetAmount, "Pool not fully funded");
        require(pool.status == uint8(PoolStatus.ACTIVE), "Pool not active");
        _releaseToExporter(_poolId);
    }

    /**
     * @notice Get exporter address from asset
     * @param _assetId Asset ID
     * @param _poolType Pool type
     * @param _assetFactory Asset factory address
     * @return exporter Exporter address
     */
    function _getExporterFromAsset(
        bytes32 _assetId,
        PoolType _poolType,
        address _assetFactory
    ) internal view returns (address) {
        if (_poolType == PoolType.RWA) {
            NovaxRwaFactory rwaFactoryContract = NovaxRwaFactory(_assetFactory);
            NovaxRwaFactory.RwaAsset memory asset = rwaFactoryContract.getAsset(_assetId);
            return asset.owner;
        } else {
            NovaxReceivableFactory receivableFactoryContract = NovaxReceivableFactory(_assetFactory);
            NovaxReceivableFactory.Receivable memory receivable = receivableFactoryContract.getReceivable(_assetId);
            return receivable.exporter;
        }
    }

    /**
     * @notice Withdraw investment from a pool
     * @param _poolId Pool ID
     * @param _shares Amount of pool tokens to burn
     */
    function withdraw(bytes32 _poolId, uint256 _shares) external nonReentrant {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(_shares > 0, "Shares must be greater than 0");
        require(
            PoolToken(pool.poolToken).balanceOf(msg.sender) >= _shares,
            "Insufficient pool tokens"
        );

        // Calculate USDC amount (1:1 ratio, but scale back from 18 decimals)
        // PoolToken has 18 decimals, USDC has 6 decimals
        // So we divide by 10^12 to get back to USDC amount
        uint256 usdcAmount = _shares / 1e12;

        // Burn pool tokens
        PoolToken(pool.poolToken).burnFrom(msg.sender, _shares);

        // Update pool state
        pool.totalInvested -= usdcAmount;
        pool.totalShares -= _shares;
        userInvestments[_poolId][msg.sender] -= usdcAmount;

        // Transfer USDC to investor
        IERC20(usdcToken).safeTransfer(msg.sender, usdcAmount);

        emit WithdrawalMade(_poolId, msg.sender, usdcAmount, _shares, block.timestamp);
    }

    /**
     * @notice Distribute yield to pool investors (automatic calculation)
     * @param _poolId Pool ID
     */
    function distributeYield(bytes32 _poolId) external nonReentrant whenNotPaused {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(pool.status == uint8(PoolStatus.PAID), "Payment not complete");
        require(pool.totalPaid >= pool.targetAmount, "Full payment not received");
        require(pool.totalShares > 0, "No shares to distribute");

        // Calculate total yield
        uint256 daysHeld = (pool.maturityDate - pool.createdAt) / 1 days;
        uint256 totalYield = (pool.apr * daysHeld * pool.totalInvested) / (365 * 10000);
        uint256 totalDistribution = pool.totalInvested + totalYield;

        // Ensure contract has enough USDC
        require(
            IERC20(usdcToken).balanceOf(address(this)) >= totalDistribution,
            "Insufficient USDC in contract"
        );

        // Check if staking vault is the investor
        address[] memory investors = poolInvestors[_poolId];
        bool isVaultInvestor = false;
        
        for (uint256 i = 0; i < investors.length; i++) {
            if (investors[i] == stakingVault) {
                isVaultInvestor = true;
                break;
            }
        }

        if (isVaultInvestor && stakingVault != address(0)) {
            // Staking vault is the investor - send everything to vault
            // Vault will handle distribution to all stakers
            IERC20(usdcToken).safeTransfer(stakingVault, totalDistribution);
            
            // Notify vault of payment received
            try INovaxStakingVault(stakingVault).receivePayment(
                _poolId,
                pool.totalInvested,
                totalYield
            ) {
                // Successfully notified vault
            } catch {
                // Failed to notify, but funds transferred
            }
            
            // Burn pool tokens from vault
            uint256 vaultShares = PoolToken(pool.poolToken).balanceOf(stakingVault);
            if (vaultShares > 0) {
                PoolToken(pool.poolToken).burnFrom(stakingVault, vaultShares);
            }
        } else {
            // Traditional distribution to individual investors
            for (uint256 i = 0; i < investors.length; i++) {
                address investor = investors[i];
                uint256 shares = PoolToken(pool.poolToken).balanceOf(investor);
                if (shares > 0) {
                    uint256 shareRatio = (shares * 1e18) / pool.totalShares;
                    uint256 investorPrincipal = (pool.totalInvested * shareRatio) / 1e18;
                    uint256 investorYield = (totalYield * shareRatio) / 1e18;
                    uint256 investorTotal = investorPrincipal + investorYield;

                    // Transfer USDC
                    IERC20(usdcToken).safeTransfer(investor, investorTotal);

                    // Burn pool tokens
                    PoolToken(pool.poolToken).burnFrom(investor, shares);
                }
            }
        }

        pool.status = uint8(PoolStatus.CLOSED);
        pool.closedAt = block.timestamp;

        emit YieldDistributed(_poolId, totalYield, block.timestamp);
        // Burn 0.1% of reward pool when pool closes (tokenomics)
        if (pool.rewardPool > 0 && nvxToken != address(0)) {
            uint256 burnAmount = (pool.rewardPool * 10) / 10000; // 0.1%
            if (burnAmount > 0) {
                // Burn tokens by transferring to zero address
                IERC20(nvxToken).safeTransfer(address(0), burnAmount);
            }
        }
        
        emit PoolClosed(_poolId, totalDistribution, block.timestamp);
    }

    /**
     * @notice Record payment for a pool (called by AMC)
     * @param _poolId Pool ID
     * @param _paymentAmount Payment amount in USDC (6 decimals)
     */
    function recordPayment(bytes32 _poolId, uint256 _paymentAmount) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(pool.status == uint8(PoolStatus.FUNDED) || pool.status == uint8(PoolStatus.MATURED), "Pool not funded or matured");
        require(_paymentAmount > 0, "Payment amount must be greater than 0");

        pool.totalPaid += _paymentAmount;

        if (pool.totalPaid >= pool.targetAmount) {
            pool.paymentStatus = uint8(PaymentStatus.FULL);
            pool.status = uint8(PoolStatus.PAID);
        } else if (pool.totalPaid > 0) {
            pool.paymentStatus = uint8(PaymentStatus.PARTIAL);
        }

        emit PaymentRecorded(_poolId, _paymentAmount, pool.totalPaid, block.timestamp);
    }

    /**
     * @notice Update pool maturity status
     * @param _poolId Pool ID
     */
    function updateMaturity(bytes32 _poolId) external {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        if (block.timestamp >= pool.maturityDate && pool.status == uint8(PoolStatus.FUNDED)) {
            pool.status = uint8(PoolStatus.MATURED);
            emit PoolMatured(_poolId, pool.maturityDate, block.timestamp);
        }
    }

    /**
     * @notice Mark pool as defaulted (called by AMC)
     * @param _poolId Pool ID
     */
    function markDefault(bytes32 _poolId) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(block.timestamp > pool.maturityDate + 7 days, "Grace period");
        require(pool.status == uint8(PoolStatus.MATURED), "Must be matured");

        pool.status = uint8(PoolStatus.DEFAULTED);
        emit PoolDefaulted(_poolId, block.timestamp);
    }

    /**
     * @notice Get multiple pools in ONE call (gas-efficient batch read)
     * @param _poolIds Array of pool IDs
     * @return pools_ Array of pool structs
     */
    function getPoolsBatch(bytes32[] calldata _poolIds) external view returns (Pool[] memory pools_) {
        pools_ = new Pool[](_poolIds.length);
        for (uint256 i = 0; i < _poolIds.length; i++) {
            if (poolExists[_poolIds[i]]) {
                pools_[i] = pools[_poolIds[i]];
            }
        }
    }

    /**
     * @notice Get all pools with pagination (gas-efficient)
     * @param _offset Starting index
     * @param _limit Number of pools to return
     * @return pools_ Array of pool structs
     * @return total Total number of pools
     */
    function getPoolsPaginated(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (Pool[] memory pools_, uint256 total) 
    {
        total = allPools.length;
        
        if (_offset >= total) {
            return (new Pool[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        uint256 length = end - _offset;
        pools_ = new Pool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            bytes32 poolId = allPools[_offset + i];
            pools_[i] = pools[poolId];
        }
    }

    /**
     * @notice Get user's complete portfolio in ONE call
     * @param _user User address
     * @return userPoolIds Array of pool IDs user invested in
     * @return userPools_ Array of pool structs
     * @return userInvestments_ Array of investment amounts
     * @return totalInvested Total amount user has invested
     */
    function getUserPortfolio(address _user) external view returns (
        bytes32[] memory userPoolIds,
        Pool[] memory userPools_,
        uint256[] memory userInvestments_,
        uint256 totalInvested
    ) {
        userPoolIds = userPools[_user];
        userPools_ = new Pool[](userPoolIds.length);
        userInvestments_ = new uint256[](userPoolIds.length);
        
        for (uint256 i = 0; i < userPoolIds.length; i++) {
            bytes32 poolId = userPoolIds[i];
            userPools_[i] = pools[poolId];
            userInvestments_[i] = userInvestments[poolId][_user];
            totalInvested += userInvestments_[i];
        }
    }

    /**
     * @notice Get active pools only (gas-efficient filter)
     * @return activePools_ Array of active pool structs
     * @return poolIds Array of corresponding pool IDs
     */
    function getActivePools() external view returns (
        Pool[] memory activePools_,
        bytes32[] memory poolIds
    ) {
        // Count active pools
        uint256 count = 0;
        for (uint256 i = 0; i < allPools.length; i++) {
            if (pools[allPools[i]].status == uint8(PoolStatus.ACTIVE)) {
                count++;
            }
        }
        
        activePools_ = new Pool[](count);
        poolIds = new bytes32[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPools.length; i++) {
            bytes32 poolId = allPools[i];
            if (pools[poolId].status == uint8(PoolStatus.ACTIVE)) {
                activePools_[index] = pools[poolId];
                poolIds[index] = poolId;
                index++;
            }
        }
    }

    /**
     * @notice Get pool analytics in ONE call
     * @param _poolId Pool ID
     * @return pool Pool struct
     * @return investorsCount Number of investors
     * @return investors Array of investor addresses
     * @return investments Array of investment amounts
     */
    function getPoolAnalytics(bytes32 _poolId) external view returns (
        Pool memory pool,
        uint256 investorsCount,
        address[] memory investors,
        uint256[] memory investments
    ) {
        require(poolExists[_poolId], "Pool does not exist");
        
        pool = pools[_poolId];
        investors = poolInvestors[_poolId];
        investorsCount = investors.length;
        investments = new uint256[](investorsCount);
        
        for (uint256 i = 0; i < investorsCount; i++) {
            investments[i] = userInvestments[_poolId][investors[i]];
        }
    }

    /**
     * @notice Pay platform fee in NVX (with discount)
     * @param _poolId Pool ID
     * @param _feeAmount Fee amount in USDC (6 decimals)
     */
    function payFeeInNVX(bytes32 _poolId, uint256 _feeAmount) external nonReentrant whenNotPaused {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        address exporter = _getExporterFromAsset(pool.assetId, pool.poolType, pool.assetFactory);
        require(msg.sender == exporter, "Only exporter can pay fees");
        require(nvxToken != address(0), "NVX token not set");

        // Calculate discount (30%)
        uint256 discount = (_feeAmount * 30) / 100;
        uint256 discountedAmount = _feeAmount - discount;

        // Calculate NVX equivalent (assuming 1:1 for simplicity, or use oracle)
        // For now: 1 USDC = 1 NVX (can be updated with price oracle)
        uint256 nvxAmount = discountedAmount * 1e12; // Convert from 6 decimals to 18 decimals

        // Transfer NVX
        IERC20(nvxToken).safeTransferFrom(exporter, platformTreasury, nvxAmount);

        emit FeePaidInToken(_poolId, exporter, _feeAmount, discount, block.timestamp);
    }

    /**
     * @notice Close a pool
     * @param _poolId Pool ID
     */
    function closePool(bytes32 _poolId) external onlyRole(ADMIN_ROLE) {
        require(poolExists[_poolId], "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(pool.status == uint8(PoolStatus.ACTIVE), "Pool is not active");

        pool.status = uint8(PoolStatus.CLOSED);
        pool.closedAt = block.timestamp;

        emit PoolClosed(_poolId, pool.totalInvested, block.timestamp);
    }

    /**
     * @notice Set RWA factory address
     * @param _rwaFactory NovaxRwaFactory address
     */
    function setRwaFactory(address _rwaFactory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_rwaFactory != address(0), "Invalid address");
        rwaFactory = _rwaFactory;
    }

    /**
     * @notice Set Receivable factory address
     * @param _receivableFactory NovaxReceivableFactory address
     */
    function setReceivableFactory(address _receivableFactory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_receivableFactory != address(0), "Invalid address");
        receivableFactory = _receivableFactory;
    }

    /**
     * @notice Set NVX token address
     * @param _nvxToken NVX token address
     */
    function setNvxToken(address _nvxToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_nvxToken != address(0), "Invalid address");
        nvxToken = _nvxToken;
    }

    /**
     * @notice Set platform treasury address
     * @param _platformTreasury Platform treasury address
     */
    function setPlatformTreasury(address _platformTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_platformTreasury != address(0), "Invalid address");
        platformTreasury = _platformTreasury;
    }

    /**
     * @notice Set AMC address
     * @param _amc AMC address
     */
    function setAmc(address _amc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amc != address(0), "Invalid address");
        amc = _amc;
    }

    /**
     * @notice Set platform fee (basis points)
     * @param _platformFeeBps Platform fee in basis points (e.g., 100 = 1%)
     */
    function setPlatformFeeBps(uint256 _platformFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_platformFeeBps <= 1000, "Fee must be <= 10%");
        platformFeeBps = _platformFeeBps;
    }

    /**
     * @notice Set AMC fee (basis points)
     * @param _amcFeeBps AMC fee in basis points (e.g., 200 = 2%)
     */
    function setAmcFeeBps(uint256 _amcFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amcFeeBps <= 1000, "Fee must be <= 10%");
        amcFeeBps = _amcFeeBps;
    }

    /**
     * @notice Set staking vault address
     * @param _stakingVault NovaxStakingVault address
     */
    function setStakingVault(address _stakingVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stakingVault = _stakingVault;
    }

    /**
     * @notice Set vault capacity manager address
     * @param _vaultCapacityManager VaultCapacityManager address
     */
    function setVaultCapacityManager(address _vaultCapacityManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultCapacityManager = _vaultCapacityManager;
    }

    /**
     * @notice Get pool details
     * @param _poolId Pool ID
     * @return pool The pool struct
     */
    function getPool(bytes32 _poolId) external view returns (Pool memory) {
        require(poolExists[_poolId], "Pool does not exist");
        return pools[_poolId];
    }

    /**
     * @notice Get user's investment in a pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return Investment amount in USDC
     */
    function getUserInvestment(bytes32 _poolId, address _user) external view returns (uint256) {
        return userInvestments[_poolId][_user];
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

