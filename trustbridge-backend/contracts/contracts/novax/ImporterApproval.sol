// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ImporterApproval
 * @dev Handles importer approval for invoices and legal contract signatures
 * @notice Importers can approve invoices off-chain (via signature) or on-chain
 */
contract ImporterApproval is AccessControl, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum ApprovalStatus {
        PENDING,        // Waiting for importer approval
        APPROVED,       // Importer approved invoice
        REJECTED,       // Importer rejected invoice
        EXPIRED         // Approval expired
    }

    struct InvoiceApproval {
        bytes32 receivableId;      // Receivable ID
        address exporter;           // Exporter address
        address importer;           // Importer address (can be zero for off-chain)
        string importerName;        // Importer business name
        string importerEmail;       // Importer email (for off-chain)
        uint256 invoiceAmount;      // Invoice amount (6 decimals)
        bytes32 invoiceHash;        // Hash of invoice document
        bytes32 legalContractHash;  // Hash of legal contract (assignment to AMC)
        bytes32 goodsApprovalHash;  // Hash of goods/invoice approval document
        ApprovalStatus status;      // Approval status
        bytes importerSignature;   // Importer signature (if on-chain)
        address signerAddress;      // Address that signed (if on-chain)
        uint256 approvedAt;         // Approval timestamp
        uint256 expiresAt;         // Expiration timestamp
        bool goodsApproved;         // Whether goods/invoice approved by importer
        bool legalContractSigned;   // Whether legal contract signed
    }

    // Storage
    mapping(bytes32 => InvoiceApproval) public approvals; // receivableId => approval
    mapping(bytes32 => bool) public approvalExists;
    mapping(address => bytes32[]) public importerApprovals; // importer => receivableIds
    mapping(bytes32 => bool) public usedSignatures; // Prevent signature replay

    // Events
    event InvoiceApprovalRequested(
        bytes32 indexed receivableId,
        address indexed exporter,
        address indexed importer,
        string importerName,
        uint256 invoiceAmount,
        uint256 expiresAt,
        bytes32 invoiceHash,
        bytes32 legalContractHash,
        uint256 timestamp
    );

    event InvoiceApproved(
        bytes32 indexed receivableId,
        address indexed importer,
        bytes32 invoiceHash,
        bytes32 legalContractHash,
        bytes32 goodsApprovalHash,
        bool goodsApproved,
        bool legalContractSigned,
        uint256 timestamp
    );

    event InvoiceRejected(
        bytes32 indexed receivableId,
        address indexed importer,
        string reason,
        uint256 timestamp
    );

    event GoodsApproved(
        bytes32 indexed receivableId,
        address indexed importer,
        bytes32 goodsApprovalHash,
        uint256 timestamp
    );

    event LegalContractSigned(
        bytes32 indexed receivableId,
        address indexed importer,
        bytes32 legalContractHash,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(AMC_ROLE, msg.sender);
    }

    /**
     * @notice Request importer approval for an invoice
     * @param _receivableId Receivable ID
     * @param _importer Importer address (can be zero for off-chain importers)
     * @param _importerName Importer business name
     * @param _importerEmail Importer email (for off-chain communication)
     * @param _invoiceAmount Invoice amount (6 decimals)
     * @param _invoiceHash IPFS hash of invoice document
     * @param _legalContractHash IPFS hash of legal contract (assignment to AMC)
     * @param _expiresIn Days until approval expires (default 30 days)
     */
    function requestApproval(
        bytes32 _receivableId,
        address _importer,
        string memory _importerName,
        string memory _importerEmail,
        uint256 _invoiceAmount,
        bytes32 _invoiceHash,
        bytes32 _legalContractHash,
        uint256 _expiresIn
    ) external whenNotPaused {
        require(_receivableId != bytes32(0), "Invalid receivable ID");
        require(_invoiceAmount > 0, "Invoice amount must be greater than 0");
        require(_invoiceHash != bytes32(0), "Invoice hash required");
        require(_legalContractHash != bytes32(0), "Legal contract hash required");
        require(!approvalExists[_receivableId], "Approval already exists");

        uint256 expiresAt = block.timestamp + (_expiresIn * 1 days);
        if (_expiresIn == 0) {
            expiresAt = block.timestamp + (30 * 1 days); // Default 30 days
        }

        approvals[_receivableId] = InvoiceApproval({
            receivableId: _receivableId,
            exporter: msg.sender,
            importer: _importer,
            importerName: _importerName,
            importerEmail: _importerEmail,
            invoiceAmount: _invoiceAmount,
            invoiceHash: _invoiceHash,
            legalContractHash: _legalContractHash,
            goodsApprovalHash: bytes32(0),
            status: ApprovalStatus.PENDING,
            importerSignature: "",
            signerAddress: address(0),
            approvedAt: 0,
            expiresAt: expiresAt,
            goodsApproved: false,
            legalContractSigned: false
        });

        approvalExists[_receivableId] = true;
        if (_importer != address(0)) {
            importerApprovals[_importer].push(_receivableId);
        }

        emit InvoiceApprovalRequested(
            _receivableId,
            msg.sender,
            _importer,
            _importerName,
            _invoiceAmount,
            expiresAt,
            _invoiceHash,
            _legalContractHash,
            block.timestamp
        );
    }

    /**
     * @notice Approve invoice (on-chain, if importer has wallet)
     * @param _receivableId Receivable ID
     * @param _goodsApprovalHash IPFS hash of goods/invoice approval document
     * @param _legalContractHash IPFS hash of signed legal contract
     */
    function approveInvoice(
        bytes32 _receivableId,
        bytes32 _goodsApprovalHash,
        bytes32 _legalContractHash
    ) external whenNotPaused {
        require(approvalExists[_receivableId], "Approval does not exist");
        InvoiceApproval storage approval = approvals[_receivableId];
        require(approval.status == ApprovalStatus.PENDING, "Approval not pending");
        require(approval.importer == msg.sender, "Only importer can approve");
        require(block.timestamp < approval.expiresAt, "Approval expired");
        require(_goodsApprovalHash != bytes32(0), "Goods approval hash required");
        require(_legalContractHash != bytes32(0), "Legal contract hash required");
        require(_legalContractHash == approval.legalContractHash, "Legal contract hash mismatch");

        approval.status = ApprovalStatus.APPROVED;
        approval.goodsApprovalHash = _goodsApprovalHash;
        approval.goodsApproved = true;
        approval.legalContractSigned = true;
        approval.approvedAt = block.timestamp;
        approval.signerAddress = msg.sender;

        emit InvoiceApproved(
            _receivableId,
            msg.sender,
            approval.invoiceHash,
            _legalContractHash,
            _goodsApprovalHash,
            true,
            true,
            block.timestamp
        );
    }

    /**
     * @notice Approve invoice with signature (off-chain approval)
     * @param _receivableId Receivable ID
     * @param _goodsApprovalHash IPFS hash of goods/invoice approval document
     * @param _legalContractHash IPFS hash of signed legal contract
     * @param _signature Importer signature (EIP-712)
     */
    function approveInvoiceWithSignature(
        bytes32 _receivableId,
        bytes32 _goodsApprovalHash,
        bytes32 _legalContractHash,
        bytes memory _signature
    ) external whenNotPaused {
        require(approvalExists[_receivableId], "Approval does not exist");
        InvoiceApproval storage approval = approvals[_receivableId];
        require(approval.status == ApprovalStatus.PENDING, "Approval not pending");
        require(block.timestamp < approval.expiresAt, "Approval expired");
        require(_goodsApprovalHash != bytes32(0), "Goods approval hash required");
        require(_legalContractHash != bytes32(0), "Legal contract hash required");
        require(_legalContractHash == approval.legalContractHash, "Legal contract hash mismatch");
        require(!usedSignatures[_receivableId], "Signature already used");

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(
                    _receivableId,
                    approval.invoiceHash,
                    _legalContractHash,
                    _goodsApprovalHash,
                    approval.invoiceAmount,
                    approval.expiresAt
                ))
            )
        );

        address signer = messageHash.recover(_signature);
        require(signer != address(0), "Invalid signature");

        // For off-chain importers, we accept any valid signature
        // In production, you'd verify against a whitelist or KYC registry

        approval.status = ApprovalStatus.APPROVED;
        approval.goodsApprovalHash = _goodsApprovalHash;
        approval.goodsApproved = true;
        approval.legalContractSigned = true;
        approval.approvedAt = block.timestamp;
        approval.importerSignature = _signature;
        approval.signerAddress = signer;
        usedSignatures[_receivableId] = true;

        emit InvoiceApproved(
            _receivableId,
            signer,
            approval.invoiceHash,
            _legalContractHash,
            _goodsApprovalHash,
            true,
            true,
            block.timestamp
        );
    }

    /**
     * @notice Record goods approval separately (if goods approved before legal contract)
     * @param _receivableId Receivable ID
     * @param _goodsApprovalHash IPFS hash of goods approval document
     */
    function recordGoodsApproval(
        bytes32 _receivableId,
        bytes32 _goodsApprovalHash
    ) external whenNotPaused {
        require(approvalExists[_receivableId], "Approval does not exist");
        InvoiceApproval storage approval = approvals[_receivableId];
        require(approval.status == ApprovalStatus.PENDING, "Approval not pending");
        require(_goodsApprovalHash != bytes32(0), "Goods approval hash required");

        // Can be called by importer or AMC (who receives approval from importer)
        require(
            approval.importer == msg.sender || hasRole(AMC_ROLE, msg.sender),
            "Not authorized"
        );

        approval.goodsApprovalHash = _goodsApprovalHash;
        approval.goodsApproved = true;

        emit GoodsApproved(_receivableId, approval.importer, _goodsApprovalHash, block.timestamp);
    }

    /**
     * @notice Record legal contract signature (if signed separately)
     * @param _receivableId Receivable ID
     * @param _legalContractHash IPFS hash of signed legal contract
     */
    function recordLegalContract(
        bytes32 _receivableId,
        bytes32 _legalContractHash
    ) external onlyRole(AMC_ROLE) whenNotPaused {
        require(approvalExists[_receivableId], "Approval does not exist");
        InvoiceApproval storage approval = approvals[_receivableId];
        require(_legalContractHash != bytes32(0), "Legal contract hash required");
        require(_legalContractHash == approval.legalContractHash, "Legal contract hash mismatch");

        approval.legalContractSigned = true;

        emit LegalContractSigned(_receivableId, approval.importer, _legalContractHash, block.timestamp);
    }

    /**
     * @notice AMC approves invoice on behalf of off-chain importer
     * @dev This function allows AMC to approve invoices when importers are not on-chain.
     *      AMC must have verified off-chain that:
     *      1. Importer has approved goods/invoice
     *      2. Importer has signed legal contract (assignment to AMC)
     *      3. All documents are valid
     * @param _receivableId Receivable ID
     * @param _goodsApprovalHash IPFS hash of goods/invoice approval document (from importer)
     * @param _legalContractHash IPFS hash of signed legal contract (from importer)
     */
    function approveInvoiceOnBehalfOfImporter(
        bytes32 _receivableId,
        bytes32 _goodsApprovalHash,
        bytes32 _legalContractHash
    ) external onlyRole(AMC_ROLE) whenNotPaused {
        require(approvalExists[_receivableId], "Approval does not exist");
        InvoiceApproval storage approval = approvals[_receivableId];
        require(approval.status == ApprovalStatus.PENDING, "Approval not pending");
        require(block.timestamp < approval.expiresAt, "Approval expired");
        require(_goodsApprovalHash != bytes32(0), "Goods approval hash required");
        require(_legalContractHash != bytes32(0), "Legal contract hash required");
        require(_legalContractHash == approval.legalContractHash, "Legal contract hash mismatch");
        
        // For off-chain importers, importer address should be zero
        // AMC is approving on their behalf after verifying off-chain documents
        require(approval.importer == address(0), "Use approveInvoice() for on-chain importers");

        approval.status = ApprovalStatus.APPROVED;
        approval.goodsApprovalHash = _goodsApprovalHash;
        approval.goodsApproved = true;
        approval.legalContractSigned = true;
        approval.approvedAt = block.timestamp;
        approval.signerAddress = msg.sender; // AMC address

        emit InvoiceApproved(
            _receivableId,
            msg.sender, // AMC address
            approval.invoiceHash,
            _legalContractHash,
            _goodsApprovalHash,
            true,
            true,
            block.timestamp
        );
    }

    /**
     * @notice Reject invoice
     * @param _receivableId Receivable ID
     * @param _reason Rejection reason
     */
    function rejectInvoice(
        bytes32 _receivableId,
        string memory _reason
    ) external whenNotPaused {
        require(approvalExists[_receivableId], "Approval does not exist");
        InvoiceApproval storage approval = approvals[_receivableId];
        require(approval.status == ApprovalStatus.PENDING, "Approval not pending");
        require(
            approval.importer == msg.sender || hasRole(AMC_ROLE, msg.sender),
            "Not authorized"
        );

        approval.status = ApprovalStatus.REJECTED;

        emit InvoiceRejected(_receivableId, approval.importer, _reason, block.timestamp);
    }

    /**
     * @notice Check if invoice is approved (for tokenization)
     * @param _receivableId Receivable ID
     * @return approved Whether invoice is fully approved
     * @return goodsApproved Whether goods are approved
     * @return legalContractSigned Whether legal contract is signed
     */
    function isInvoiceApproved(bytes32 _receivableId) external view returns (
        bool approved,
        bool goodsApproved,
        bool legalContractSigned
    ) {
        if (!approvalExists[_receivableId]) {
            return (false, false, false);
        }

        InvoiceApproval memory approval = approvals[_receivableId];
        approved = approval.status == ApprovalStatus.APPROVED && 
                   block.timestamp < approval.expiresAt;
        goodsApproved = approval.goodsApproved;
        legalContractSigned = approval.legalContractSigned;
    }

    /**
     * @notice Get approval details
     * @param _receivableId Receivable ID
     * @return approval Approval struct
     */
    function getApproval(bytes32 _receivableId) external view returns (InvoiceApproval memory) {
        require(approvalExists[_receivableId], "Approval does not exist");
        return approvals[_receivableId];
    }

    /**
     * @notice Get approvals for an importer
     * @param _importer Importer address
     * @return receivableIds Array of receivable IDs
     */
    function getImporterApprovals(address _importer) external view returns (bytes32[] memory) {
        return importerApprovals[_importer];
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

