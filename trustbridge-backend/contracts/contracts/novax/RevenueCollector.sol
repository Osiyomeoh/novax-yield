// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RevenueCollector
 * @dev Collects platform revenue from various sources and allocates to different pools
 * @notice Centralized revenue collection and distribution system
 */
contract RevenueCollector is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant COLLECTOR_ROLE = keccak256("COLLECTOR_ROLE");

    // Revenue allocation percentages (in basis points, 10000 = 100%)
    uint256 public stakingAllocationBps = 3000;      // 30% to staking rewards
    uint256 public treasuryAllocationBps = 3000;    // 30% to treasury
    uint256 public operationsAllocationBps = 2000;  // 20% to operations
    uint256 public burnAllocationBps = 2000;         // 20% to buyback & burn
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // Addresses
    address public usdcToken;              // USDC token address
    address public nvxToken;               // NVX token address
    address public stakingContract;        // NVXStaking contract address
    address public platformTreasury;       // Platform treasury address
    address public operationsWallet;       // Operations wallet address
    address public burnAddress;           // Address for buyback & burn (or zero address for direct burn)

    // Revenue tracking
    mapping(address => uint256) public revenueBySource; // source => total revenue collected
    uint256 public totalRevenueCollected;                // Total revenue collected (USDC)
    uint256 public totalAllocatedToStaking;             // Total allocated to staking (USDC)
    uint256 public totalAllocatedToTreasury;            // Total allocated to treasury (USDC)
    uint256 public totalAllocatedToOperations;          // Total allocated to operations (USDC)
    uint256 public totalAllocatedToBurn;                // Total allocated to burn (USDC)

    // Events
    event RevenueCollected(
        address indexed source,
        uint256 amount,
        string sourceType,
        uint256 timestamp
    );

    event RevenueAllocated(
        address indexed destination,
        uint256 amount,
        string allocationType,
        uint256 timestamp
    );

    event AllocationUpdated(
        string allocationType,
        uint256 oldBps,
        uint256 newBps,
        uint256 timestamp
    );

    event StakingFunded(
        uint256 usdcAmount,
        uint256 nvxAmount,
        uint256 timestamp
    );

    constructor(
        address _usdcToken,
        address _nvxToken,
        address _platformTreasury,
        address _operationsWallet
    ) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_nvxToken != address(0), "Invalid NVX address");
        require(_platformTreasury != address(0), "Invalid treasury address");
        require(_operationsWallet != address(0), "Invalid operations wallet");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(COLLECTOR_ROLE, msg.sender);

        usdcToken = _usdcToken;
        nvxToken = _nvxToken;
        platformTreasury = _platformTreasury;
        operationsWallet = _operationsWallet;
        burnAddress = address(0); // Direct burn by default
    }

    /**
     * @notice Collect revenue from pool creation fees
     * @param _amount Amount in USDC (6 decimals)
     * @param _source Source address (e.g., NovaxPoolManager)
     */
    function collectPoolCreationFee(uint256 _amount, address _source) 
        external 
        onlyRole(COLLECTOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount > 0, "Amount must be > 0");
        require(_source != address(0), "Invalid source");

        IERC20(usdcToken).safeTransferFrom(_source, address(this), _amount);
        
        revenueBySource[_source] += _amount;
        totalRevenueCollected += _amount;

        _allocateRevenue(_amount);

        emit RevenueCollected(_source, _amount, "PoolCreationFee", block.timestamp);
    }

    /**
     * @notice Collect revenue from exchange fees
     * @param _amount Amount in XTZ (native token, will be converted to USDC equivalent)
     * @param _source Source address (e.g., NVXExchange)
     */
    function collectExchangeFee(uint256 _amount, address _source) 
        external 
        payable 
        onlyRole(COLLECTOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount > 0 || msg.value > 0, "Amount must be > 0");
        require(_source != address(0), "Invalid source");

        uint256 amount = msg.value > 0 ? msg.value : _amount;
        
        // For now, we'll store XTZ amount separately
        // In production, you'd convert XTZ to USDC via DEX or oracle
        // For simplicity, we'll track it separately
        revenueBySource[_source] += amount;
        totalRevenueCollected += amount; // Note: This is XTZ, not USDC

        // Allocate XTZ directly (in production, convert to USDC first)
        _allocateNativeRevenue(amount);

        emit RevenueCollected(_source, amount, "ExchangeFee", block.timestamp);
    }

    /**
     * @notice Collect revenue from trading fees
     * @param _amount Amount in USDC (6 decimals)
     * @param _source Source address (e.g., Marketplace)
     */
    function collectTradingFee(uint256 _amount, address _source) 
        external 
        onlyRole(COLLECTOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount > 0, "Amount must be > 0");
        require(_source != address(0), "Invalid source");

        IERC20(usdcToken).safeTransferFrom(_source, address(this), _amount);
        
        revenueBySource[_source] += _amount;
        totalRevenueCollected += _amount;

        _allocateRevenue(_amount);

        emit RevenueCollected(_source, _amount, "TradingFee", block.timestamp);
    }

    /**
     * @notice Collect revenue from yield distribution fees
     * @param _amount Amount in USDC (6 decimals)
     * @param _source Source address (e.g., NovaxPoolManager)
     */
    function collectYieldFee(uint256 _amount, address _source) 
        external 
        onlyRole(COLLECTOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount > 0, "Amount must be > 0");
        require(_source != address(0), "Invalid source");

        IERC20(usdcToken).safeTransferFrom(_source, address(this), _amount);
        
        revenueBySource[_source] += _amount;
        totalRevenueCollected += _amount;

        _allocateRevenue(_amount);

        emit RevenueCollected(_source, _amount, "YieldFee", block.timestamp);
    }

    /**
     * @notice Allocate collected revenue to different pools
     * @param _amount Amount in USDC (6 decimals)
     */
    function _allocateRevenue(uint256 _amount) internal {
        uint256 stakingAmount = (_amount * stakingAllocationBps) / BASIS_POINTS_DENOMINATOR;
        uint256 treasuryAmount = (_amount * treasuryAllocationBps) / BASIS_POINTS_DENOMINATOR;
        uint256 operationsAmount = (_amount * operationsAllocationBps) / BASIS_POINTS_DENOMINATOR;
        uint256 burnAmount = (_amount * burnAllocationBps) / BASIS_POINTS_DENOMINATOR;

        // Transfer to treasury
        if (treasuryAmount > 0 && platformTreasury != address(0)) {
            IERC20(usdcToken).safeTransfer(platformTreasury, treasuryAmount);
            totalAllocatedToTreasury += treasuryAmount;
            emit RevenueAllocated(platformTreasury, treasuryAmount, "Treasury", block.timestamp);
        }

        // Transfer to operations
        if (operationsAmount > 0 && operationsWallet != address(0)) {
            IERC20(usdcToken).safeTransfer(operationsWallet, operationsAmount);
            totalAllocatedToOperations += operationsAmount;
            emit RevenueAllocated(operationsWallet, operationsAmount, "Operations", block.timestamp);
        }

        // Handle burn allocation (buyback & burn)
        if (burnAmount > 0) {
            if (burnAddress != address(0)) {
                // Transfer to burn address (for buyback contract)
                IERC20(usdcToken).safeTransfer(burnAddress, burnAmount);
            } else {
                // Keep in contract for manual burn
                // In production, this would trigger a buyback & burn mechanism
            }
            totalAllocatedToBurn += burnAmount;
            emit RevenueAllocated(burnAddress, burnAmount, "Burn", block.timestamp);
        }

        // Staking allocation stays in contract for conversion to NVX
        totalAllocatedToStaking += stakingAmount;
        emit RevenueAllocated(stakingContract, stakingAmount, "Staking", block.timestamp);
    }

    /**
     * @notice Allocate native token (XTZ) revenue
     * @param _amount Amount in XTZ (18 decimals)
     */
    function _allocateNativeRevenue(uint256 _amount) internal {
        uint256 stakingAmount = (_amount * stakingAllocationBps) / BASIS_POINTS_DENOMINATOR;
        uint256 treasuryAmount = (_amount * treasuryAllocationBps) / BASIS_POINTS_DENOMINATOR;
        uint256 operationsAmount = (_amount * operationsAllocationBps) / BASIS_POINTS_DENOMINATOR;
        uint256 burnAmount = (_amount * burnAllocationBps) / BASIS_POINTS_DENOMINATOR;

        // Transfer to treasury
        if (treasuryAmount > 0 && platformTreasury != address(0)) {
            (bool success, ) = platformTreasury.call{value: treasuryAmount}("");
            require(success, "Treasury transfer failed");
            totalAllocatedToTreasury += treasuryAmount;
            emit RevenueAllocated(platformTreasury, treasuryAmount, "Treasury", block.timestamp);
        }

        // Transfer to operations
        if (operationsAmount > 0 && operationsWallet != address(0)) {
            (bool success, ) = operationsWallet.call{value: operationsAmount}("");
            require(success, "Operations transfer failed");
            totalAllocatedToOperations += operationsAmount;
            emit RevenueAllocated(operationsWallet, operationsAmount, "Operations", block.timestamp);
        }

        // Handle burn allocation
        if (burnAmount > 0) {
            if (burnAddress != address(0)) {
                (bool success, ) = burnAddress.call{value: burnAmount}("");
                require(success, "Burn transfer failed");
            }
            totalAllocatedToBurn += burnAmount;
            emit RevenueAllocated(burnAddress, burnAmount, "Burn", block.timestamp);
        }

        // Staking allocation stays in contract for conversion
        totalAllocatedToStaking += stakingAmount;
        emit RevenueAllocated(stakingContract, stakingAmount, "Staking", block.timestamp);
    }

    /**
     * @notice Fund staking contract with NVX (converts USDC to NVX)
     * @param _usdcAmount Amount of USDC to convert (6 decimals)
     * @param _nvxAmount Amount of NVX to fund (18 decimals)
     * @dev In production, this would use a DEX or oracle for conversion
     */
    function fundStakingContract(uint256 _usdcAmount, uint256 _nvxAmount) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_usdcAmount > 0, "USDC amount must be > 0");
        require(_nvxAmount > 0, "NVX amount must be > 0");
        require(stakingContract != address(0), "Staking contract not set");

        // Check we have enough USDC allocated for staking
        uint256 availableForStaking = IERC20(usdcToken).balanceOf(address(this));
        require(availableForStaking >= _usdcAmount, "Insufficient USDC for staking");

        // In production: Convert USDC to NVX via DEX or exchange
        // For now, we assume NVX is already available or minted
        // Transfer USDC out (to DEX or exchange contract)
        // Receive NVX back
        
        // For simplicity, we'll mint NVX directly (requires MINTER_ROLE)
        // In production, use DEX swap
        IERC20(nvxToken).safeTransfer(stakingContract, _nvxAmount);

        emit StakingFunded(_usdcAmount, _nvxAmount, block.timestamp);
    }

    /**
     * @notice Set staking contract address
     */
    function setStakingContract(address _stakingContract) external onlyRole(ADMIN_ROLE) {
        require(_stakingContract != address(0), "Invalid address");
        stakingContract = _stakingContract;
    }

    /**
     * @notice Update allocation percentages
     */
    function updateAllocations(
        uint256 _stakingBps,
        uint256 _treasuryBps,
        uint256 _operationsBps,
        uint256 _burnBps
    ) external onlyRole(ADMIN_ROLE) {
        require(
            _stakingBps + _treasuryBps + _operationsBps + _burnBps == BASIS_POINTS_DENOMINATOR,
            "Allocations must sum to 100%"
        );

        emit AllocationUpdated("Staking", stakingAllocationBps, _stakingBps, block.timestamp);
        emit AllocationUpdated("Treasury", treasuryAllocationBps, _treasuryBps, block.timestamp);
        emit AllocationUpdated("Operations", operationsAllocationBps, _operationsBps, block.timestamp);
        emit AllocationUpdated("Burn", burnAllocationBps, _burnBps, block.timestamp);

        stakingAllocationBps = _stakingBps;
        treasuryAllocationBps = _treasuryBps;
        operationsAllocationBps = _operationsBps;
        burnAllocationBps = _burnBps;
    }

    /**
     * @notice Update addresses
     */
    function setAddresses(
        address _platformTreasury,
        address _operationsWallet,
        address _burnAddress
    ) external onlyRole(ADMIN_ROLE) {
        if (_platformTreasury != address(0)) {
            platformTreasury = _platformTreasury;
        }
        if (_operationsWallet != address(0)) {
            operationsWallet = _operationsWallet;
        }
        burnAddress = _burnAddress; // Can be zero for direct burn
    }

    /**
     * @notice Get current USDC balance allocated for staking
     */
    function getStakingAllocationBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this));
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

    /**
     * @notice Emergency withdraw (only admin)
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) {
            // Native token
            payable(msg.sender).transfer(_amount);
        } else {
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
    }

    receive() external payable {
        // Allow receiving native tokens (XTZ)
    }
}

