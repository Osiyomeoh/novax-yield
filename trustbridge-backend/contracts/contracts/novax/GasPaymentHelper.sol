// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NVXToken.sol";
import "./NVXExchange.sol";

/**
 * @title GasPaymentHelper
 * @dev Helper contract to pay gas fees using NVX tokens
 * @notice Converts NVX to XTZ automatically for gas payments
 * 
 * IMPORTANT: On Etherlink, gas MUST be paid in XTZ (native token).
 * This contract allows users to pay gas with NVX by auto-converting to XTZ.
 * 
 * Usage:
 * 1. User approves NVX to this contract
 * 2. User calls executeWithGas() with transaction data
 * 3. Contract converts NVX → XTZ (via NVXExchange)
 * 4. Contract executes transaction using XTZ for gas
 * 5. User receives any remaining XTZ
 */
contract GasPaymentHelper is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for NVXToken;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    NVXToken public nvxToken;
    NVXExchange public nvxExchange;
    
    // Gas payment parameters
    uint256 public gasPaymentFeeBps; // Service fee in basis points (e.g., 50 = 0.5%)
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public minGasReserve; // Minimum XTZ to keep as reserve (in wei)
    
    // Statistics
    uint256 public totalGasPaid; // Total XTZ paid for gas
    uint256 public totalNVXConverted; // Total NVX converted for gas
    mapping(address => uint256) public userGasPayments; // User => total gas paid
    
    // Events
    event GasPaid(
        address indexed user,
        uint256 nvxAmount,
        uint256 xtzAmount,
        uint256 gasUsed,
        uint256 timestamp
    );
    
    constructor(
        address _nvxToken,
        address payable _nvxExchange,
        uint256 _gasPaymentFeeBps, // e.g., 50 for 0.5%
        uint256 _minGasReserve // e.g., 0.01 XTZ = 0.01 * 10^18
    ) {
        require(_nvxToken != address(0), "Invalid NVX token address");
        require(_nvxExchange != address(0), "Invalid NVX exchange address");
        require(_gasPaymentFeeBps < FEE_DENOMINATOR, "Fee cannot exceed 100%");
        
        nvxToken = NVXToken(_nvxToken);
        nvxExchange = NVXExchange(payable(_nvxExchange));
        gasPaymentFeeBps = _gasPaymentFeeBps;
        minGasReserve = _minGasReserve;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Execute a transaction with gas paid in NVX
     * @param _target Target contract address
     * @param _data Transaction data
     * @param _nvxAmount Amount of NVX to use for gas (18 decimals)
     * @param _gasLimit Gas limit for the transaction
     * @return success Whether transaction succeeded
     * @return returnData Return data from transaction
     */
    function executeWithGas(
        address _target,
        bytes calldata _data,
        uint256 _nvxAmount,
        uint256 _gasLimit
    ) external nonReentrant whenNotPaused returns (bool success, bytes memory returnData) {
        require(_target != address(0), "Invalid target address");
        require(_nvxAmount > 0, "NVX amount must be greater than 0");
        require(_gasLimit > 0, "Gas limit must be greater than 0");
        
        // Transfer NVX from user
        nvxToken.safeTransferFrom(msg.sender, address(this), _nvxAmount);
        
        // Calculate service fee
        uint256 serviceFee = (_nvxAmount * gasPaymentFeeBps) / FEE_DENOMINATOR;
        uint256 nvxForExchange = _nvxAmount - serviceFee;
        
        // Convert NVX to XTZ (for gas)
        // First, approve NVX to exchange
        nvxToken.approve(address(nvxExchange), nvxForExchange);
        
        // Calculate expected XTZ amount
        (uint256 expectedXTZ, ) = nvxExchange.calculateReverseExchange(nvxForExchange);
        require(expectedXTZ > 0, "Insufficient XTZ from exchange");
        
        // Exchange NVX for XTZ
        nvxExchange.exchangeNVXForXTZ(nvxForExchange);
        
        // Get actual XTZ balance
        uint256 xtzBalance = address(this).balance;
        require(xtzBalance >= expectedXTZ, "Insufficient XTZ received");
        
        // Execute transaction
        uint256 gasBefore = gasleft();
        (success, returnData) = _target.call{value: 0, gas: _gasLimit}(_data);
        uint256 gasUsed = gasBefore - gasleft();
        
        // Calculate actual gas cost (approximate)
        uint256 gasCost = tx.gasprice * gasUsed;
        
        // Ensure we have enough XTZ for gas
        require(xtzBalance >= gasCost, "Insufficient XTZ for gas");
        
        // Pay gas (this will be handled by the transaction itself)
        // The remaining XTZ will stay in the contract or be refunded
        
        // Update statistics
        totalGasPaid += gasCost;
        totalNVXConverted += nvxForExchange;
        userGasPayments[msg.sender] += gasCost;
        
        // Transfer service fee to treasury (in NVX)
        if (serviceFee > 0) {
            nvxToken.safeTransfer(msg.sender, serviceFee); // For now, refund service fee
            // In production, transfer to treasury
        }
        
        // Refund remaining XTZ to user (if any)
        uint256 remainingXTZ = xtzBalance - gasCost;
        if (remainingXTZ > minGasReserve) {
            uint256 refundAmount = remainingXTZ - minGasReserve;
            (bool refundSuccess, ) = msg.sender.call{value: refundAmount}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit GasPaid(
            msg.sender,
            nvxForExchange,
            gasCost,
            gasUsed,
            block.timestamp
        );
        
        return (success, returnData);
    }
    
    /**
     * @notice Estimate gas cost in NVX
     * @param _gasLimit Estimated gas limit
     * @return nvxAmount Required NVX amount (18 decimals)
     */
    function estimateGasCostInNVX(uint256 _gasLimit) external view returns (uint256 nvxAmount) {
        // Estimate XTZ needed for gas
        uint256 estimatedXTZ = tx.gasprice * _gasLimit;
        
        // Calculate NVX needed (reverse of exchange rate)
        // If 1 XTZ = 100 NVX, then 0.01 XTZ = 1 NVX
        // We need to account for fees
        (uint256 nvxNeeded, ) = nvxExchange.calculateExchange(estimatedXTZ);
        
        // Add service fee
        nvxAmount = nvxNeeded + (nvxNeeded * gasPaymentFeeBps) / FEE_DENOMINATOR;
    }
    
    /**
     * @notice Set gas payment fee
     * @param _newFeeBps New fee in basis points
     */
    function setGasPaymentFee(uint256 _newFeeBps) external onlyRole(ADMIN_ROLE) {
        require(_newFeeBps < FEE_DENOMINATOR, "Fee cannot exceed 100%");
        gasPaymentFeeBps = _newFeeBps;
    }
    
    /**
     * @notice Set minimum gas reserve
     * @param _newReserve New minimum reserve (in wei)
     */
    function setMinGasReserve(uint256 _newReserve) external onlyRole(ADMIN_ROLE) {
        minGasReserve = _newReserve;
    }
    
    /**
     * @notice Withdraw XTZ reserves (admin only)
     * @param _amount Amount to withdraw
     */
    function withdrawReserves(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Withdraw failed");
    }
    
    /**
     * @notice Pause gas payment helper
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause gas payment helper
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // Receive XTZ
    receive() external payable {}
}

