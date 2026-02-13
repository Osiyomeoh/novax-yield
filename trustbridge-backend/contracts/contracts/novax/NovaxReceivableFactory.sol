// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NovaxReceivableFactory
 * @dev Trade receivable/invoice creation with Chainlink Functions verification
 * @notice Minimal on-chain data, all invoice details stored on IPFS
 */
contract NovaxReceivableFactory is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE");

    enum ReceivableStatus {
        PENDING_VERIFICATION,
        VERIFIED,
        FUNDED,
        MATURED,
        PAID,
        DEFAULTED,
        REJECTED
    }

    /**
     * @dev Minimal on-chain receivable structure
     */
    struct Receivable {
        bytes32 id;                    // Unique receivable identifier
        address exporter;              // Exporter (invoice issuer)
        address importer;              // Importer (invoice payer)
        uint256 amountUSD;             // Invoice amount in USD (6 decimals)
        uint256 dueDate;               // Payment due date (timestamp)
        uint8 status;                  // Receivable status
        bytes32 metadataCID;           // IPFS CID for invoice documents
        uint256 riskScore;             // Risk score (0-100)
        uint256 apr;                   // Annual Percentage Rate (basis points, e.g., 1200 = 12%)
        uint256 createdAt;             // Creation timestamp
        uint256 verifiedAt;            // Verification timestamp
        address verificationModule;    // Chainlink Functions verification contract
    }

    // Storage mappings
    mapping(bytes32 => Receivable) public receivables;
    mapping(address => bytes32[]) public exporterReceivables;
    mapping(bytes32 => bool) public receivableExists;

    uint256 public totalReceivables;
    address public verificationModule; // NovaxVerificationModule contract

    // Events
    event ReceivableCreated(
        bytes32 indexed receivableId,
        address indexed exporter,
        address indexed importer,
        uint256 amountUSD,
        bytes32 metadataCID,
        uint256 timestamp
    );

    event ReceivableVerified(
        bytes32 indexed receivableId,
        uint256 riskScore,
        uint256 apr,
        uint256 timestamp
    );

    event ReceivableStatusUpdated(
        bytes32 indexed receivableId,
        ReceivableStatus oldStatus,
        ReceivableStatus newStatus,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AMC_ROLE, msg.sender);
    }

    /**
     * @notice Create a new trade receivable/invoice
     * @param _importer Importer address (invoice payer, can be zero for off-chain importers)
     * @param _amountUSD Invoice amount in USD (6 decimals)
     * @param _dueDate Payment due date (timestamp)
     * @param _metadataCID IPFS CID for invoice documents
     * @param _importerApprovalId Importer approval ID (from ImporterApproval contract, optional)
     * @return receivableId The created receivable ID
     * 
     * @dev IMPORTANT: Before creating receivable:
     * 1. Importer must approve invoice (via ImporterApproval contract)
     * 2. Goods/invoice must be approved by importer
     * 3. Legal contract (assignment to AMC) must be signed
     * 4. All documents must be uploaded to IPFS
     */
    function createReceivable(
        address _importer,
        uint256 _amountUSD,
        uint256 _dueDate,
        bytes32 _metadataCID,
        bytes32 _importerApprovalId
    ) external nonReentrant whenNotPaused returns (bytes32) {
        // Allow zero address for off-chain importers (AMC will handle payment collection)
        // require(_importer != address(0), "Invalid importer address");
        require(_amountUSD > 0, "Amount must be greater than 0");
        require(_dueDate > block.timestamp, "Due date must be in the future");
        require(_metadataCID != bytes32(0), "Metadata CID required");
        
        // If importer approval ID provided, verify approval exists and is approved
        // This would require importing ImporterApproval contract
        // For now, we'll add a separate function to verify approval before creation

        // Generate unique receivable ID
        bytes32 receivableId = keccak256(
            abi.encodePacked(
                msg.sender,
                _importer,
                _amountUSD,
                _dueDate,
                _metadataCID,
                block.timestamp,
                block.prevrandao
            )
        );

        require(!receivableExists[receivableId], "Receivable ID collision");

        // Create receivable with minimal on-chain data
        receivables[receivableId] = Receivable({
            id: receivableId,
            exporter: msg.sender,
            importer: _importer,
            amountUSD: _amountUSD,
            dueDate: _dueDate,
            status: uint8(ReceivableStatus.PENDING_VERIFICATION),
            metadataCID: _metadataCID,
            riskScore: 0,
            apr: 0,
            createdAt: block.timestamp,
            verifiedAt: 0,
            verificationModule: verificationModule
        });

        receivableExists[receivableId] = true;
        exporterReceivables[msg.sender].push(receivableId);
        totalReceivables++;

        emit ReceivableCreated(
            receivableId,
            msg.sender,
            _importer,
            _amountUSD,
            _metadataCID,
            block.timestamp
        );

        return receivableId;
    }

    /**
     * @notice Verify a receivable (called by AMC)
     * @param _receivableId Receivable ID to verify
     * @param _riskScore Risk score (0-100)
     * @param _apr Annual Percentage Rate (basis points)
     */
    function verifyReceivable(
        bytes32 _receivableId,
        uint256 _riskScore,
        uint256 _apr
    ) external onlyRole(AMC_ROLE) {
        require(receivableExists[_receivableId], "Receivable does not exist");
        Receivable storage receivable = receivables[_receivableId];
        require(
            receivable.status == uint8(ReceivableStatus.PENDING_VERIFICATION),
            "Receivable already verified or processed"
        );
        require(_riskScore <= 100, "Risk score must be <= 100");
        require(_apr <= 5000, "APR must be <= 50% (5000 basis points)");

        receivable.status = uint8(ReceivableStatus.VERIFIED);
        receivable.riskScore = _riskScore;
        receivable.apr = _apr;
        receivable.verifiedAt = block.timestamp;

        emit ReceivableVerified(_receivableId, _riskScore, _apr, block.timestamp);
        emit ReceivableStatusUpdated(
            _receivableId,
            ReceivableStatus.PENDING_VERIFICATION,
            ReceivableStatus.VERIFIED,
            block.timestamp
        );
    }

    /**
     * @notice Update receivable status
     * @param _receivableId Receivable ID
     * @param _newStatus New status
     */
    function updateReceivableStatus(
        bytes32 _receivableId,
        ReceivableStatus _newStatus
    ) external onlyRole(AMC_ROLE) {
        require(receivableExists[_receivableId], "Receivable does not exist");
        Receivable storage receivable = receivables[_receivableId];
        ReceivableStatus oldStatus = ReceivableStatus(receivable.status);

        receivable.status = uint8(_newStatus);

        emit ReceivableStatusUpdated(_receivableId, oldStatus, _newStatus, block.timestamp);
    }

    /**
     * @notice Set the verification module address
     * @param _verificationModule Address of NovaxVerificationModule
     */
    function setVerificationModule(address _verificationModule) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_verificationModule != address(0), "Invalid address");
        verificationModule = _verificationModule;
    }

    /**
     * @notice Get receivable details
     * @param _receivableId Receivable ID
     * @return receivable The receivable struct
     */
    function getReceivable(bytes32 _receivableId) external view returns (Receivable memory) {
        require(receivableExists[_receivableId], "Receivable does not exist");
        return receivables[_receivableId];
    }

    /**
     * @notice Get all receivables for an exporter
     * @param _exporter Exporter address
     * @return Array of receivable IDs
     */
    function getExporterReceivables(address _exporter) external view returns (bytes32[] memory) {
        return exporterReceivables[_exporter];
    }

    /**
     * @notice Get exporter's receivables with full details in ONE call (efficient!)
     * @param _exporter Exporter address
     */
    function getExporterReceivablesWithDetails(address _exporter) 
        external 
        view 
        returns (
            bytes32[] memory receivableIds,
            Receivable[] memory receivables_,
            uint256 count
        ) 
    {
        receivableIds = exporterReceivables[_exporter];
        count = receivableIds.length;
        receivables_ = new Receivable[](count);
        
        for (uint256 i = 0; i < count; i++) {
            receivables_[i] = receivables[receivableIds[i]];
        }
    }

    /**
     * @notice Get multiple receivables in ONE call (batch read)
     * @param _receivableIds Array of receivable IDs
     */
    function getReceivablesBatch(bytes32[] calldata _receivableIds) 
        external 
        view 
        returns (Receivable[] memory receivables_) 
    {
        receivables_ = new Receivable[](_receivableIds.length);
        for (uint256 i = 0; i < _receivableIds.length; i++) {
            if (receivableExists[_receivableIds[i]]) {
                receivables_[i] = receivables[_receivableIds[i]];
            }
        }
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

