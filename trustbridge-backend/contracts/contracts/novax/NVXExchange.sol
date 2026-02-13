// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./NVXToken.sol";

/**
 * @title NVXExchange
 * @dev Exchange contract for swapping XTZ (native token) to NVX tokens
 * @notice Handles XTZ to NVX exchanges with configurable rates and fees
 */
contract NVXExchange is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    NVXToken public nvxToken;
    
    // Exchange parameters
    uint256 public exchangeRate; // 1 XTZ = exchangeRate NVX (in wei, 18 decimals)
    uint256 public exchangeFeeBps; // Exchange fee in basis points (e.g., 200 = 2%)
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Limits
    uint256 public minExchangeAmount; // Minimum XTZ amount (in wei)
    uint256 public maxExchangeAmount; // Maximum XTZ amount per transaction (in wei)
    
    // Addresses
    address public platformTreasury; // Platform treasury address
    address public liquidityPool; // Liquidity pool address
    address public revenueCollector; // RevenueCollector contract address (optional)
    
    // Treasury split (in basis points)
    uint256 public treasurySplitBps; // Percentage of XTZ to treasury (e.g., 5000 = 50%)
    uint256 public liquiditySplitBps; // Percentage of XTZ to liquidity (e.g., 5000 = 50%)
    
    // Reverse exchange (NVX → XTZ) parameters
    uint256 public reverseExchangeFeeBps; // Reverse exchange fee in basis points (e.g., 200 = 2%)
    uint256 public xtzReserves; // XTZ reserves for reverse exchanges
    
    // Statistics
    uint256 public totalExchanged; // Total XTZ exchanged
    uint256 public totalNVXMinted; // Total NVX minted
    uint256 public totalReverseExchanged; // Total NVX exchanged back to XTZ
    uint256 public totalXTZPaidOut; // Total XTZ paid out in reverse exchanges
    mapping(address => uint256) public userExchanges; // User => total XTZ exchanged
    mapping(address => uint256) public userReverseExchanges; // User => total NVX exchanged back
    
    // Events
    event ExchangeExecuted(
        address indexed user,
        uint256 xtzAmount,
        uint256 nvxAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    event ReverseExchangeExecuted(
        address indexed user,
        uint256 nvxAmount,
        uint256 xtzAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event ExchangeFeeUpdated(uint256 oldFee, uint256 newFee);
    event ReverseExchangeFeeUpdated(uint256 oldFee, uint256 newFee);
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount);
    event TreasurySplitUpdated(uint256 treasurySplit, uint256 liquiditySplit);
    event XTZReservesDeposited(uint256 amount, uint256 newReserves);
    
    constructor(
        address _nvxToken,
        address _platformTreasury,
        address _liquidityPool,
        uint256 _exchangeRate, // e.g., 100 * 10^18 for 1 XTZ = 100 NVX
        uint256 _exchangeFeeBps, // e.g., 200 for 2%
        uint256 _minExchangeAmount, // e.g., 0.1 * 10^18
        uint256 _maxExchangeAmount // e.g., 1000 * 10^18
    ) {
        require(_nvxToken != address(0), "Invalid NVX token address");
        require(_platformTreasury != address(0), "Invalid treasury address");
        require(_liquidityPool != address(0), "Invalid liquidity pool address");
        require(_exchangeRate > 0, "Exchange rate must be greater than 0");
        require(_exchangeFeeBps < FEE_DENOMINATOR, "Fee cannot exceed 100%");
        require(_minExchangeAmount > 0, "Min amount must be greater than 0");
        require(_maxExchangeAmount >= _minExchangeAmount, "Max must be >= min");
        
        nvxToken = NVXToken(_nvxToken);
        platformTreasury = _platformTreasury;
        liquidityPool = _liquidityPool;
        exchangeRate = _exchangeRate;
        exchangeFeeBps = _exchangeFeeBps;
        reverseExchangeFeeBps = _exchangeFeeBps; // Same fee for reverse exchange
        minExchangeAmount = _minExchangeAmount;
        maxExchangeAmount = _maxExchangeAmount;
        
        // Default split: 50% treasury, 50% liquidity
        treasurySplitBps = 5000;
        liquiditySplitBps = 5000;
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Exchange XTZ for NVX tokens
     * @dev User sends XTZ, receives NVX tokens
     */
    function exchange() external payable nonReentrant whenNotPaused {
        require(msg.value >= minExchangeAmount, "Amount below minimum");
        require(msg.value <= maxExchangeAmount, "Amount exceeds maximum");
        
        // Calculate fee
        uint256 feeAmount = (msg.value * exchangeFeeBps) / FEE_DENOMINATOR;
        uint256 netXtzAmount = msg.value - feeAmount;
        
        // Calculate NVX amount (net XTZ * exchange rate)
        // exchangeRate is in 18 decimals, so we need to account for that
        uint256 nvxAmount = (netXtzAmount * exchangeRate) / 1e18;
        
        require(nvxAmount > 0, "NVX amount must be greater than 0");
        
        // Mint NVX tokens to user
        nvxToken.mint(msg.sender, nvxAmount);
        
        // Split XTZ: fee goes to revenue collector (if set), otherwise to treasury and liquidity pool
        // Add remaining XTZ to reserves for reverse exchanges
        if (revenueCollector != address(0)) {
            // Send all fees to revenue collector for allocation
            (bool success, ) = revenueCollector.call{value: feeAmount}("");
            require(success, "Revenue collector transfer failed");
        } else {
            // Fallback to original split
            uint256 treasuryAmount = (feeAmount * treasurySplitBps) / FEE_DENOMINATOR;
            uint256 liquidityAmount = feeAmount - treasuryAmount;
            
            (bool treasurySuccess, ) = platformTreasury.call{value: treasuryAmount}("");
            require(treasurySuccess, "Treasury transfer failed");
            
            (bool liquiditySuccess, ) = liquidityPool.call{value: liquidityAmount}("");
            require(liquiditySuccess, "Liquidity transfer failed");
        }
        
        // Add net XTZ to reserves (for reverse exchanges)
        xtzReserves += netXtzAmount;
        
        // Update statistics
        totalExchanged += msg.value;
        totalNVXMinted += nvxAmount;
        userExchanges[msg.sender] += msg.value;
        
        emit ExchangeExecuted(
            msg.sender,
            msg.value,
            nvxAmount,
            feeAmount,
            block.timestamp
        );
    }
    
    /**
     * @notice Set exchange rate (1 XTZ = rate NVX)
     * @param _newRate New exchange rate (in wei, 18 decimals)
     */
    function setExchangeRate(uint256 _newRate) external onlyRole(ADMIN_ROLE) {
        require(_newRate > 0, "Rate must be greater than 0");
        uint256 oldRate = exchangeRate;
        exchangeRate = _newRate;
        emit ExchangeRateUpdated(oldRate, _newRate);
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
     * @notice Set reverse exchange fee
     * @param _newFeeBps New fee in basis points
     */
    function setReverseExchangeFee(uint256 _newFeeBps) external onlyRole(ADMIN_ROLE) {
        require(_newFeeBps < FEE_DENOMINATOR, "Fee cannot exceed 100%");
        uint256 oldFee = reverseExchangeFeeBps;
        reverseExchangeFeeBps = _newFeeBps;
        emit ReverseExchangeFeeUpdated(oldFee, _newFeeBps);
    }
    
    /**
     * @notice Set exchange limits
     * @param _minAmount Minimum exchange amount (in wei)
     * @param _maxAmount Maximum exchange amount (in wei)
     */
    function setLimits(uint256 _minAmount, uint256 _maxAmount) external onlyRole(ADMIN_ROLE) {
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount >= _minAmount, "Max must be >= min");
        minExchangeAmount = _minAmount;
        maxExchangeAmount = _maxAmount;
        emit LimitsUpdated(_minAmount, _maxAmount);
    }
    
    /**
     * @notice Set treasury split
     * @param _treasurySplitBps Treasury split in basis points
     * @param _liquiditySplitBps Liquidity split in basis points
     */
    function setTreasurySplit(uint256 _treasurySplitBps, uint256 _liquiditySplitBps) external onlyRole(ADMIN_ROLE) {
        require(_treasurySplitBps + _liquiditySplitBps == FEE_DENOMINATOR, "Splits must sum to 100%");
        treasurySplitBps = _treasurySplitBps;
        liquiditySplitBps = _liquiditySplitBps;
        emit TreasurySplitUpdated(_treasurySplitBps, _liquiditySplitBps);
    }
    
    /**
     * @notice Set platform treasury address
     * @param _newTreasury New treasury address
     */
    function setPlatformTreasury(address _newTreasury) external onlyRole(ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid address");
        platformTreasury = _newTreasury;
    }
    
    /**
     * @notice Set liquidity pool address
     * @param _newLiquidityPool New liquidity pool address
     */
    function setLiquidityPool(address _newLiquidityPool) external onlyRole(ADMIN_ROLE) {
        require(_newLiquidityPool != address(0), "Invalid address");
        liquidityPool = _newLiquidityPool;
    }
    
    /**
     * @notice Exchange NVX back to XTZ (reverse exchange)
     * @dev User sends NVX, receives XTZ
     * @param _nvxAmount Amount of NVX to exchange (in wei, 18 decimals)
     */
    function exchangeNVXForXTZ(uint256 _nvxAmount) external nonReentrant whenNotPaused {
        require(_nvxAmount > 0, "Amount must be greater than 0");
        require(xtzReserves > 0, "Insufficient XTZ reserves");
        
        // Calculate XTZ amount: NVX / exchangeRate (accounting for decimals)
        // If 1 XTZ = 100 NVX, then 100 NVX = 1 XTZ
        uint256 xtzAmountBeforeFee = (_nvxAmount * 1e18) / exchangeRate;
        require(xtzAmountBeforeFee > 0, "XTZ amount too small");
        
        // Calculate fee
        uint256 feeAmount = (xtzAmountBeforeFee * reverseExchangeFeeBps) / FEE_DENOMINATOR;
        uint256 netXtzAmount = xtzAmountBeforeFee - feeAmount;
        
        require(netXtzAmount <= xtzReserves, "Insufficient XTZ reserves");
        require(netXtzAmount >= minExchangeAmount, "Amount below minimum");
        require(netXtzAmount <= maxExchangeAmount, "Amount exceeds maximum");
        
        // Transfer NVX from user
        nvxToken.burnFrom(msg.sender, _nvxAmount);
        
        // Update reserves
        xtzReserves -= netXtzAmount;
        
        // Split fee: same as forward exchange
        if (revenueCollector != address(0)) {
            (bool success, ) = revenueCollector.call{value: feeAmount}("");
            require(success, "Revenue collector transfer failed");
        } else {
            uint256 treasuryAmount = (feeAmount * treasurySplitBps) / FEE_DENOMINATOR;
            uint256 liquidityAmount = feeAmount - treasuryAmount;
            
            (bool treasurySuccess, ) = platformTreasury.call{value: treasuryAmount}("");
            require(treasurySuccess, "Treasury transfer failed");
            
            (bool liquiditySuccess, ) = liquidityPool.call{value: liquidityAmount}("");
            require(liquiditySuccess, "Liquidity transfer failed");
        }
        
        // Transfer XTZ to user
        (bool userSuccess, ) = msg.sender.call{value: netXtzAmount}("");
        require(userSuccess, "XTZ transfer failed");
        
        // Update statistics
        totalReverseExchanged += _nvxAmount;
        totalXTZPaidOut += netXtzAmount;
        userReverseExchanges[msg.sender] += _nvxAmount;
        
        emit ReverseExchangeExecuted(
            msg.sender,
            _nvxAmount,
            netXtzAmount,
            feeAmount,
            block.timestamp
        );
    }
    
    /**
     * @notice Deposit XTZ to reserves (for reverse exchanges)
     * @dev Admin/operator can deposit XTZ to enable reverse exchanges
     */
    function depositXTZReserves() external payable onlyRole(OPERATOR_ROLE) {
        require(msg.value > 0, "Amount must be greater than 0");
        xtzReserves += msg.value;
        emit XTZReservesDeposited(msg.value, xtzReserves);
    }
    
    /**
     * @notice Calculate XTZ amount for given NVX amount (reverse exchange)
     * @param _nvxAmount NVX amount (in wei)
     * @return xtzAmount XTZ amount (in wei)
     * @return feeAmount Fee amount (in wei)
     */
    function calculateReverseExchange(uint256 _nvxAmount) external view returns (uint256 xtzAmount, uint256 feeAmount) {
        uint256 xtzAmountBeforeFee = (_nvxAmount * 1e18) / exchangeRate;
        feeAmount = (xtzAmountBeforeFee * reverseExchangeFeeBps) / FEE_DENOMINATOR;
        xtzAmount = xtzAmountBeforeFee - feeAmount;
    }
    
    /**
     * @notice Calculate NVX amount for given XTZ amount
     * @param _xtzAmount XTZ amount (in wei)
     * @return nvxAmount NVX amount (in wei)
     * @return feeAmount Fee amount (in wei)
     */
    function calculateExchange(uint256 _xtzAmount) external view returns (uint256 nvxAmount, uint256 feeAmount) {
        feeAmount = (_xtzAmount * exchangeFeeBps) / FEE_DENOMINATOR;
        uint256 netXtzAmount = _xtzAmount - feeAmount;
        nvxAmount = (netXtzAmount * exchangeRate) / 1e18;
    }
    
    /**
     * @notice Get exchange statistics for a user
     * @param _user User address
     * @return totalExchanged Total XTZ exchanged by user
     * @return totalReverseExchanged Total NVX exchanged back by user
     */
    function getUserStats(address _user) external view returns (uint256 totalExchanged, uint256 totalReverseExchanged) {
        return (userExchanges[_user], userReverseExchanges[_user]);
    }
    
    /**
     * @notice Get XTZ reserves available for reverse exchanges
     * @return reserves Current XTZ reserves
     */
    function getXTZReserves() external view returns (uint256) {
        return xtzReserves;
    }
    
    /**
     * @notice Set revenue collector address
     * @param _revenueCollector RevenueCollector contract address
     */
    function setRevenueCollector(address _revenueCollector) external onlyRole(ADMIN_ROLE) {
        revenueCollector = _revenueCollector; // Can be zero to disable
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
    
    /**
     * @notice Emergency withdraw XTZ (only admin)
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool success, ) = platformTreasury.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
    
    // Receive XTZ
    receive() external payable {
        revert("Use exchange() function");
    }
    
    // Fallback
    fallback() external payable {
        revert("Use exchange() function");
    }
}

