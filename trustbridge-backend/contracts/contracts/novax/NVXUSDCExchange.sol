// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NVXToken.sol";

/**
 * @title NVXUSDCExchange
 * @dev Exchange contract for swapping NVX tokens and USDC
 * @notice Handles bidirectional exchanges: NVX ↔ USDC
 */
contract NVXUSDCExchange is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for NVXToken;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    NVXToken public nvxToken;
    IERC20 public usdcToken;
    
    // Exchange parameters
    uint256 public nvxToUsdcRate; // 1 NVX = nvxToUsdcRate USDC (in 6 decimals, e.g., 0.1 USDC = 100000)
    uint256 public usdcToNvxRate; // 1 USDC = usdcToNvxRate NVX (in 18 decimals, e.g., 10 NVX = 10 * 10^18)
    uint256 public exchangeFeeBps; // Exchange fee in basis points (e.g., 200 = 2%)
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Limits
    uint256 public minExchangeAmount; // Minimum exchange amount
    uint256 public maxExchangeAmount; // Maximum exchange amount per transaction
    
    // Addresses
    address public platformTreasury;
    address public liquidityPool;
    address public revenueCollector;
    
    // Reserves
    uint256 public nvxReserves; // NVX reserves for USDC → NVX exchanges
    uint256 public usdcReserves; // USDC reserves for NVX → USDC exchanges
    
    // Treasury split
    uint256 public treasurySplitBps;
    uint256 public liquiditySplitBps;
    
    // Statistics
    uint256 public totalNVXExchanged; // Total NVX exchanged for USDC
    uint256 public totalUSDCExchanged; // Total USDC exchanged for NVX
    mapping(address => uint256) public userNVXExchanges; // User => total NVX exchanged
    mapping(address => uint256) public userUSDCExchanges; // User => total USDC exchanged
    
    // Events
    event NVXToUSDCExchange(
        address indexed user,
        uint256 nvxAmount,
        uint256 usdcAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    event USDCToNVXExchange(
        address indexed user,
        uint256 usdcAmount,
        uint256 nvxAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    event RatesUpdated(uint256 nvxToUsdcRate, uint256 usdcToNvxRate);
    event ExchangeFeeUpdated(uint256 oldFee, uint256 newFee);
    event ReservesDeposited(uint256 nvxAmount, uint256 usdcAmount);
    
    constructor(
        address _nvxToken,
        address _usdcToken,
        address _platformTreasury,
        address _liquidityPool,
        uint256 _nvxToUsdcRate, // e.g., 100000 = 0.1 USDC per NVX (6 decimals)
        uint256 _usdcToNvxRate, // e.g., 10 * 10^18 = 10 NVX per USDC (18 decimals)
        uint256 _exchangeFeeBps, // e.g., 200 for 2%
        uint256 _minExchangeAmount,
        uint256 _maxExchangeAmount
    ) {
        require(_nvxToken != address(0), "Invalid NVX token address");
        require(_usdcToken != address(0), "Invalid USDC token address");
        require(_platformTreasury != address(0), "Invalid treasury address");
        require(_liquidityPool != address(0), "Invalid liquidity pool address");
        require(_nvxToUsdcRate > 0, "NVX to USDC rate must be greater than 0");
        require(_usdcToNvxRate > 0, "USDC to NVX rate must be greater than 0");
        require(_exchangeFeeBps < FEE_DENOMINATOR, "Fee cannot exceed 100%");
        
        nvxToken = NVXToken(_nvxToken);
        usdcToken = IERC20(_usdcToken);
        platformTreasury = _platformTreasury;
        liquidityPool = _liquidityPool;
        nvxToUsdcRate = _nvxToUsdcRate;
        usdcToNvxRate = _usdcToNvxRate;
        exchangeFeeBps = _exchangeFeeBps;
        minExchangeAmount = _minExchangeAmount;
        maxExchangeAmount = _maxExchangeAmount;
        
        treasurySplitBps = 5000;
        liquiditySplitBps = 5000;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Exchange NVX for USDC
     * @param _nvxAmount Amount of NVX to exchange (18 decimals)
     */
    function exchangeNVXForUSDC(uint256 _nvxAmount) external nonReentrant whenNotPaused {
        require(_nvxAmount >= minExchangeAmount, "Amount below minimum");
        require(_nvxAmount <= maxExchangeAmount, "Amount exceeds maximum");
        require(usdcReserves > 0, "Insufficient USDC reserves");
        
        // Calculate USDC amount: NVX * rate (accounting for decimals)
        // NVX has 18 decimals, USDC has 6 decimals
        // nvxToUsdcRate is in 6 decimals (e.g., 100000 = 0.1 USDC)
        uint256 usdcAmountBeforeFee = (_nvxAmount * nvxToUsdcRate) / 1e18;
        require(usdcAmountBeforeFee > 0, "USDC amount too small");
        
        // Calculate fee
        uint256 feeAmount = (usdcAmountBeforeFee * exchangeFeeBps) / FEE_DENOMINATOR;
        uint256 netUsdcAmount = usdcAmountBeforeFee - feeAmount;
        
        require(netUsdcAmount <= usdcReserves, "Insufficient USDC reserves");
        
        // Transfer NVX from user (will be burned or added to reserves)
        nvxToken.safeTransferFrom(msg.sender, address(this), _nvxAmount);
        
        // Update reserves
        nvxReserves += _nvxAmount;
        usdcReserves -= netUsdcAmount;
        
        // Split fee
        _distributeFee(feeAmount, true); // true = USDC fee
        
        // Transfer USDC to user
        usdcToken.safeTransfer(msg.sender, netUsdcAmount);
        
        // Update statistics
        totalNVXExchanged += _nvxAmount;
        userNVXExchanges[msg.sender] += _nvxAmount;
        
        emit NVXToUSDCExchange(
            msg.sender,
            _nvxAmount,
            netUsdcAmount,
            feeAmount,
            block.timestamp
        );
    }
    
    /**
     * @notice Exchange USDC for NVX
     * @param _usdcAmount Amount of USDC to exchange (6 decimals)
     */
    function exchangeUSDCForNVX(uint256 _usdcAmount) external nonReentrant whenNotPaused {
        require(_usdcAmount >= minExchangeAmount, "Amount below minimum");
        require(_usdcAmount <= maxExchangeAmount, "Amount exceeds maximum");
        require(nvxReserves > 0, "Insufficient NVX reserves");
        
        // Calculate NVX amount: USDC * rate (accounting for decimals)
        // USDC has 6 decimals, NVX has 18 decimals
        // usdcToNvxRate is in 18 decimals (e.g., 10 * 10^18 = 10 NVX)
        uint256 nvxAmountBeforeFee = (_usdcAmount * usdcToNvxRate) / 1e6;
        require(nvxAmountBeforeFee > 0, "NVX amount too small");
        
        // Calculate fee
        uint256 feeAmount = (nvxAmountBeforeFee * exchangeFeeBps) / FEE_DENOMINATOR;
        uint256 netNvxAmount = nvxAmountBeforeFee - feeAmount;
        
        require(netNvxAmount <= nvxReserves, "Insufficient NVX reserves");
        
        // Transfer USDC from user
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmount);
        
        // Update reserves
        usdcReserves += _usdcAmount;
        nvxReserves -= netNvxAmount;
        
        // Split fee (in NVX)
        _distributeFee(feeAmount, false); // false = NVX fee
        
        // Mint NVX to user
        nvxToken.mint(msg.sender, netNvxAmount);
        
        // Update statistics
        totalUSDCExchanged += _usdcAmount;
        userUSDCExchanges[msg.sender] += _usdcAmount;
        
        emit USDCToNVXExchange(
            msg.sender,
            _usdcAmount,
            netNvxAmount,
            feeAmount,
            block.timestamp
        );
    }
    
    /**
     * @notice Deposit reserves (NVX and/or USDC)
     * @param _nvxAmount Amount of NVX to deposit (18 decimals)
     * @param _usdcAmount Amount of USDC to deposit (6 decimals)
     */
    function depositReserves(uint256 _nvxAmount, uint256 _usdcAmount) external onlyRole(OPERATOR_ROLE) {
        if (_nvxAmount > 0) {
            nvxToken.safeTransferFrom(msg.sender, address(this), _nvxAmount);
            nvxReserves += _nvxAmount;
        }
        if (_usdcAmount > 0) {
            usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmount);
            usdcReserves += _usdcAmount;
        }
        emit ReservesDeposited(_nvxAmount, _usdcAmount);
    }
    
    /**
     * @notice Distribute fees
     * @param _feeAmount Fee amount
     * @param _isUSDC Whether fee is in USDC (true) or NVX (false)
     */
    function _distributeFee(uint256 _feeAmount, bool _isUSDC) internal {
        if (revenueCollector != address(0)) {
            if (_isUSDC) {
                usdcToken.safeTransfer(revenueCollector, _feeAmount);
            } else {
                nvxToken.safeTransfer(revenueCollector, _feeAmount);
            }
        } else {
            uint256 treasuryAmount = (_feeAmount * treasurySplitBps) / FEE_DENOMINATOR;
            uint256 liquidityAmount = _feeAmount - treasuryAmount;
            
            if (_isUSDC) {
                usdcToken.safeTransfer(platformTreasury, treasuryAmount);
                usdcToken.safeTransfer(liquidityPool, liquidityAmount);
            } else {
                nvxToken.safeTransfer(platformTreasury, treasuryAmount);
                nvxToken.safeTransfer(liquidityPool, liquidityAmount);
            }
        }
    }
    
    /**
     * @notice Set exchange rates
     * @param _nvxToUsdcRate New NVX to USDC rate (6 decimals)
     * @param _usdcToNvxRate New USDC to NVX rate (18 decimals)
     */
    function setRates(uint256 _nvxToUsdcRate, uint256 _usdcToNvxRate) external onlyRole(ADMIN_ROLE) {
        require(_nvxToUsdcRate > 0, "NVX to USDC rate must be greater than 0");
        require(_usdcToNvxRate > 0, "USDC to NVX rate must be greater than 0");
        nvxToUsdcRate = _nvxToUsdcRate;
        usdcToNvxRate = _usdcToNvxRate;
        emit RatesUpdated(_nvxToUsdcRate, _usdcToNvxRate);
    }
    
    /**
     * @notice Set exchange fee
     * @param _newFeeBps New fee in basis points
     */
    function setExchangeFee(uint256 _newFeeBps) external onlyRole(ADMIN_ROLE) {
        require(_newFeeBps < FEE_DENOMINATOR, "Fee cannot exceed 100%");
        uint256 oldFee = exchangeFeeBps;
        exchangeFeeBps = _newFeeBps;
        emit ExchangeFeeUpdated(oldFee, _newFeeBps);
    }
    
    /**
     * @notice Calculate USDC amount for given NVX amount
     * @param _nvxAmount NVX amount (18 decimals)
     * @return usdcAmount USDC amount (6 decimals)
     * @return feeAmount Fee amount (6 decimals)
     */
    function calculateNVXToUSDC(uint256 _nvxAmount) external view returns (uint256 usdcAmount, uint256 feeAmount) {
        uint256 usdcAmountBeforeFee = (_nvxAmount * nvxToUsdcRate) / 1e18;
        feeAmount = (usdcAmountBeforeFee * exchangeFeeBps) / FEE_DENOMINATOR;
        usdcAmount = usdcAmountBeforeFee - feeAmount;
    }
    
    /**
     * @notice Calculate NVX amount for given USDC amount
     * @param _usdcAmount USDC amount (6 decimals)
     * @return nvxAmount NVX amount (18 decimals)
     * @return feeAmount Fee amount (18 decimals)
     */
    function calculateUSDCToNVX(uint256 _usdcAmount) external view returns (uint256 nvxAmount, uint256 feeAmount) {
        uint256 nvxAmountBeforeFee = (_usdcAmount * usdcToNvxRate) / 1e6;
        feeAmount = (nvxAmountBeforeFee * exchangeFeeBps) / FEE_DENOMINATOR;
        nvxAmount = nvxAmountBeforeFee - feeAmount;
    }
    
    /**
     * @notice Get reserves
     * @return nvxReserves_ Current NVX reserves
     * @return usdcReserves_ Current USDC reserves
     */
    function getReserves() external view returns (uint256 nvxReserves_, uint256 usdcReserves_) {
        return (nvxReserves, usdcReserves);
    }
    
    /**
     * @notice Set revenue collector
     * @param _revenueCollector RevenueCollector contract address
     */
    function setRevenueCollector(address _revenueCollector) external onlyRole(ADMIN_ROLE) {
        revenueCollector = _revenueCollector;
    }
    
    /**
     * @notice Pause exchange
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause exchange
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}

