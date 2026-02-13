// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NovaxReceivableFactory.sol";
import "./NovaxPoolManager.sol";

/**
 * @title AMCPaymentCollector
 * @dev Handles off-chain payment collection from importers and on-chain recording
 * @notice AMC collects payments from importers (who may not be on-chain) and records them
 * 
 * Flow:
 * 1. Importer pays AMC off-chain (bank transfer, wire, etc.)
 * 2. AMC receives payment confirmation
 * 3. AMC records payment on-chain via this contract
 * 4. Payment is distributed to investors via PoolManager
 */
contract AMCPaymentCollector is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    NovaxReceivableFactory public receivableFactory;
    NovaxPoolManager public poolManager;
    IERC20 public usdcToken;

    enum PaymentMethod {
        BANK_TRANSFER,      // Traditional bank transfer
        WIRE_TRANSFER,      // Wire transfer
        CHECK,              // Physical check
        CRYPTO,             // Cryptocurrency payment
        OTHER               // Other payment methods
    }

    struct PaymentRecord {
        bytes32 receivableId;      // Receivable ID
        bytes32 poolId;             // Pool ID (if receivable is in a pool)
        address importer;            // Importer address (can be zero for off-chain)
        string importerName;         // Importer business name
        uint256 amountUSD;           // Payment amount (6 decimals)
        PaymentMethod paymentMethod; // Payment method
        string paymentReference;     // Payment reference (transaction ID, check number, etc.)
        bytes32 paymentProofHash;    // IPFS hash of payment proof (bank statement, receipt, etc.)
        address recordedBy;           // AMC address that recorded payment
        uint256 recordedAt;          // Recording timestamp
        bool distributed;            // Whether payment distributed to investors
    }

    // Storage
    mapping(bytes32 => PaymentRecord) public payments; // paymentId => payment
    mapping(bytes32 => bool) public paymentExists;
    mapping(bytes32 => uint256) public receivableTotalPaid; // receivableId => total paid
    mapping(bytes32 => PaymentRecord[]) public receivablePayments; // receivableId => payments[]

    // Events
    event PaymentRecorded(
        bytes32 indexed paymentId,
        bytes32 indexed receivableId,
        bytes32 indexed poolId,
        address importer,
        string importerName,
        uint256 amountUSD,
        PaymentMethod paymentMethod,
        string paymentReference,
        bytes32 paymentProofHash,
        address recordedBy,
        uint256 timestamp
    );

    event PaymentDistributed(
        bytes32 indexed paymentId,
        bytes32 indexed poolId,
        uint256 totalAmount,
        uint256 investorAmount,
        uint256 platformFee,
        uint256 timestamp
    );

    constructor(
        address _receivableFactory,
        address _poolManager,
        address _usdcToken
    ) {
        require(_receivableFactory != address(0), "Invalid receivable factory address");
        require(_poolManager != address(0), "Invalid pool manager address");
        require(_usdcToken != address(0), "Invalid USDC token address");

        receivableFactory = NovaxReceivableFactory(_receivableFactory);
        poolManager = NovaxPoolManager(_poolManager);
        usdcToken = IERC20(_usdcToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(AMC_ROLE, msg.sender);
    }

    /**
     * @notice Record payment from importer (off-chain payment)
     * @param _receivableId Receivable ID
     * @param _poolId Pool ID (if receivable is in a pool)
     * @param _importer Importer address (can be zero for off-chain importers)
     * @param _importerName Importer business name
     * @param _amountUSD Payment amount in USDC (6 decimals)
     * @param _paymentMethod Payment method
     * @param _paymentReference Payment reference (transaction ID, check number, etc.)
     * @param _paymentProofHash IPFS hash of payment proof document
     */
    function recordPayment(
        bytes32 _receivableId,
        bytes32 _poolId,
        address _importer,
        string memory _importerName,
        uint256 _amountUSD,
        PaymentMethod _paymentMethod,
        string memory _paymentReference,
        bytes32 _paymentProofHash
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(_receivableId != bytes32(0), "Invalid receivable ID");
        require(_amountUSD > 0, "Payment amount must be greater than 0");
        require(_paymentProofHash != bytes32(0), "Payment proof hash required");

        // Verify receivable exists
        try receivableFactory.getReceivable(_receivableId) returns (
            NovaxReceivableFactory.Receivable memory receivable
        ) {
            require(receivable.id != bytes32(0), "Receivable does not exist");
        } catch {
            revert("Receivable does not exist");
        }

        // Generate payment ID
        bytes32 paymentId = keccak256(
            abi.encodePacked(
                _receivableId,
                _paymentReference,
                _amountUSD,
                block.timestamp,
                msg.sender
            )
        );

        require(!paymentExists[paymentId], "Payment already recorded");

        // Create payment record
        PaymentRecord memory payment = PaymentRecord({
            receivableId: _receivableId,
            poolId: _poolId,
            importer: _importer,
            importerName: _importerName,
            amountUSD: _amountUSD,
            paymentMethod: _paymentMethod,
            paymentReference: _paymentReference,
            paymentProofHash: _paymentProofHash,
            recordedBy: msg.sender,
            recordedAt: block.timestamp,
            distributed: false
        });

        payments[paymentId] = payment;
        paymentExists[paymentId] = true;
        receivableTotalPaid[_receivableId] += _amountUSD;
        receivablePayments[_receivableId].push(payment);

        // Update receivable status in factory
        receivableFactory.updateReceivableStatus(
            _receivableId,
            NovaxReceivableFactory.ReceivableStatus.PAID
        );

        // If receivable is in a pool, record payment in pool manager
        if (_poolId != bytes32(0)) {
            poolManager.recordPayment(_poolId, _amountUSD);
        }

        emit PaymentRecorded(
            paymentId,
            _receivableId,
            _poolId,
            _importer,
            _importerName,
            _amountUSD,
            _paymentMethod,
            _paymentReference,
            _paymentProofHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Record payment and distribute to investors (if pool is funded)
     * @param _receivableId Receivable ID
     * @param _poolId Pool ID
     * @param _importer Importer address
     * @param _importerName Importer business name
     * @param _amountUSD Payment amount in USDC (6 decimals)
     * @param _paymentMethod Payment method
     * @param _paymentReference Payment reference
     * @param _paymentProofHash IPFS hash of payment proof
     * @param _usdcAmountOnChain USDC amount to transfer on-chain (if importer paid in crypto)
     */
    function recordAndDistributePayment(
        bytes32 _receivableId,
        bytes32 _poolId,
        address _importer,
        string memory _importerName,
        uint256 _amountUSD,
        PaymentMethod _paymentMethod,
        string memory _paymentReference,
        bytes32 _paymentProofHash,
        uint256 _usdcAmountOnChain
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        // Record payment
        bytes32 paymentId = keccak256(
            abi.encodePacked(
                _receivableId,
                _paymentReference,
                _amountUSD,
                block.timestamp,
                msg.sender
            )
        );

        require(!paymentExists[paymentId], "Payment already recorded");

        // If importer paid on-chain (crypto), transfer USDC to this contract
        if (_paymentMethod == PaymentMethod.CRYPTO && _usdcAmountOnChain > 0) {
            require(_usdcAmountOnChain <= _amountUSD, "On-chain amount exceeds total");
            usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmountOnChain);
        }

        // Record payment (same as recordPayment)
        PaymentRecord memory payment = PaymentRecord({
            receivableId: _receivableId,
            poolId: _poolId,
            importer: _importer,
            importerName: _importerName,
            amountUSD: _amountUSD,
            paymentMethod: _paymentMethod,
            paymentReference: _paymentReference,
            paymentProofHash: _paymentProofHash,
            recordedBy: msg.sender,
            recordedAt: block.timestamp,
            distributed: false
        });

        payments[paymentId] = payment;
        paymentExists[paymentId] = true;
        receivableTotalPaid[_receivableId] += _amountUSD;
        receivablePayments[_receivableId].push(payment);

        // Update receivable status
        receivableFactory.updateReceivableStatus(
            _receivableId,
            NovaxReceivableFactory.ReceivableStatus.PAID
        );

        // If pool exists, distribute payment
        if (_poolId != bytes32(0)) {
            // Record payment in pool manager
            poolManager.recordPayment(_poolId, _amountUSD);

            // If AMC has USDC on-chain, distribute it
            // Note: For off-chain payments, AMC must deposit USDC first
            if (_usdcAmountOnChain > 0) {
                // Approve pool manager to spend USDC
                usdcToken.approve(address(poolManager), _usdcAmountOnChain);
                
                // Distribute payment (pool manager will handle investor distribution)
                // This would call poolManager.distributeYield() or similar
            }

            payment.distributed = true;
            payments[paymentId] = payment;

            emit PaymentDistributed(
                paymentId,
                _poolId,
                _amountUSD,
                _usdcAmountOnChain,
                0, // Platform fee calculated by pool manager
                block.timestamp
            );
        }

        emit PaymentRecorded(
            paymentId,
            _receivableId,
            _poolId,
            _importer,
            _importerName,
            _amountUSD,
            _paymentMethod,
            _paymentReference,
            _paymentProofHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Deposit USDC for distribution (when importer paid off-chain)
     * @param _poolId Pool ID
     * @param _amountUSD Amount to deposit (6 decimals)
     */
    function depositForDistribution(
        bytes32 _poolId,
        uint256 _amountUSD
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(_poolId != bytes32(0), "Invalid pool ID");
        require(_amountUSD > 0, "Amount must be greater than 0");

        // Transfer USDC from AMC
        usdcToken.safeTransferFrom(msg.sender, address(this), _amountUSD);

        // Approve pool manager
        usdcToken.approve(address(poolManager), _amountUSD);

        // Distribute via pool manager
        // Note: Pool manager needs a function to accept USDC and distribute
        // This is a placeholder - actual distribution logic in PoolManager
    }

    /**
     * @notice Get payment record
     * @param _paymentId Payment ID
     * @return payment Payment record
     */
    function getPayment(bytes32 _paymentId) external view returns (PaymentRecord memory) {
        require(paymentExists[_paymentId], "Payment does not exist");
        return payments[_paymentId];
    }

    /**
     * @notice Get all payments for a receivable
     * @param _receivableId Receivable ID
     * @return paymentList Array of payment records
     */
    function getReceivablePayments(bytes32 _receivableId) external view returns (PaymentRecord[] memory) {
        return receivablePayments[_receivableId];
    }

    /**
     * @notice Get total paid for a receivable
     * @param _receivableId Receivable ID
     * @return totalPaid Total amount paid
     */
    function getReceivableTotalPaid(bytes32 _receivableId) external view returns (uint256) {
        return receivableTotalPaid[_receivableId];
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
     * @notice Emergency withdraw USDC (admin only)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        usdcToken.safeTransfer(msg.sender, _amount);
    }
}

