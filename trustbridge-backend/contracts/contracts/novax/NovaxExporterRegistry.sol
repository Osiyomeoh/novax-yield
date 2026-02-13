// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NovaxExporterRegistry
 * @dev Registry for approved exporters with KYC/KYB verification
 * @notice Tracks exporter onboarding and approval status on-chain
 */
contract NovaxExporterRegistry is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE");

    /**
     * @dev Exporter profile structure
     */
    struct ExporterProfile {
        address exporter;              // Exporter wallet address
        bytes32 kycHash;               // KYC verification hash (IPFS CID or hash)
        bytes32 cacHash;               // CAC document hash (IPFS CID or hash)
        bytes32 bankAccountHash;       // Bank account verification hash
        uint256 approvedAt;            // Approval timestamp
        bool isActive;                 // Active status
        string businessName;           // Business/company name
        string country;                // Country of operation
    }

    // Storage mappings
    mapping(address => bool) public approvedExporters;
    mapping(address => bytes32) public exporterKYCHash;
    mapping(address => ExporterProfile) public exporterProfiles;
    mapping(address => bool) public exporterExists;

    address[] public allExporters; // Array of all exporter addresses

    uint256 public totalExporters;

    // Events
    event ExporterApproved(
        address indexed exporter,
        bytes32 indexed kycHash,
        bytes32 indexed cacHash,
        uint256 timestamp
    );

    event ExporterRejected(
        address indexed exporter,
        string reason,
        uint256 timestamp
    );

    event ExporterSuspended(
        address indexed exporter,
        string reason,
        uint256 timestamp
    );

    event ExporterReactivated(
        address indexed exporter,
        uint256 timestamp
    );

    event ExporterProfileUpdated(
        address indexed exporter,
        bytes32 indexed kycHash,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AMC_ROLE, msg.sender);
    }

    /**
     * @notice Approve an exporter (called by AMC or Admin)
     * @param _exporter Exporter wallet address
     * @param _kycHash KYC verification hash (IPFS CID or hash)
     * @param _cacHash CAC document hash (IPFS CID or hash)
     * @param _bankAccountHash Bank account verification hash
     * @param _businessName Business/company name
     * @param _country Country of operation
     */
    function approveExporter(
        address _exporter,
        bytes32 _kycHash,
        bytes32 _cacHash,
        bytes32 _bankAccountHash,
        string memory _businessName,
        string memory _country
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(_exporter != address(0), "Invalid exporter address");
        require(_kycHash != bytes32(0), "KYC hash required");
        require(_cacHash != bytes32(0), "CAC hash required");
        require(_bankAccountHash != bytes32(0), "Bank account hash required");
        require(bytes(_businessName).length > 0, "Business name required");
        require(bytes(_country).length > 0, "Country required");

        // If exporter already exists, update profile
        if (exporterExists[_exporter]) {
            ExporterProfile storage profile = exporterProfiles[_exporter];
            profile.kycHash = _kycHash;
            profile.cacHash = _cacHash;
            profile.bankAccountHash = _bankAccountHash;
            profile.businessName = _businessName;
            profile.country = _country;
            profile.approvedAt = block.timestamp;
            profile.isActive = true;

            approvedExporters[_exporter] = true;
            exporterKYCHash[_exporter] = _kycHash;

            emit ExporterProfileUpdated(_exporter, _kycHash, block.timestamp);
        } else {
            // Create new exporter profile
            exporterProfiles[_exporter] = ExporterProfile({
                exporter: _exporter,
                kycHash: _kycHash,
                cacHash: _cacHash,
                bankAccountHash: _bankAccountHash,
                approvedAt: block.timestamp,
                isActive: true,
                businessName: _businessName,
                country: _country
            });

            exporterExists[_exporter] = true;
            approvedExporters[_exporter] = true;
            exporterKYCHash[_exporter] = _kycHash;
            allExporters.push(_exporter);
            totalExporters++;

            emit ExporterApproved(_exporter, _kycHash, _cacHash, block.timestamp);
        }
    }

    /**
     * @notice Reject an exporter application
     * @param _exporter Exporter wallet address
     * @param _reason Rejection reason
     */
    function rejectExporter(
        address _exporter,
        string memory _reason
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(_exporter != address(0), "Invalid exporter address");
        
        if (exporterExists[_exporter]) {
            exporterProfiles[_exporter].isActive = false;
            approvedExporters[_exporter] = false;
        }

        emit ExporterRejected(_exporter, _reason, block.timestamp);
    }

    /**
     * @notice Suspend an approved exporter
     * @param _exporter Exporter wallet address
     * @param _reason Suspension reason
     */
    function suspendExporter(
        address _exporter,
        string memory _reason
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(_exporter != address(0), "Invalid exporter address");
        require(exporterExists[_exporter], "Exporter does not exist");
        require(approvedExporters[_exporter], "Exporter not approved");

        exporterProfiles[_exporter].isActive = false;
        approvedExporters[_exporter] = false;

        emit ExporterSuspended(_exporter, _reason, block.timestamp);
    }

    /**
     * @notice Reactivate a suspended exporter
     * @param _exporter Exporter wallet address
     */
    function reactivateExporter(
        address _exporter
    ) external onlyRole(AMC_ROLE) nonReentrant whenNotPaused {
        require(_exporter != address(0), "Invalid exporter address");
        require(exporterExists[_exporter], "Exporter does not exist");
        require(!exporterProfiles[_exporter].isActive, "Exporter already active");

        exporterProfiles[_exporter].isActive = true;
        approvedExporters[_exporter] = true;

        emit ExporterReactivated(_exporter, block.timestamp);
    }

    /**
     * @notice Check if exporter is approved and active
     * @param _exporter Exporter wallet address
     * @return bool True if approved and active
     */
    function isExporterApproved(address _exporter) external view returns (bool) {
        return approvedExporters[_exporter] && 
               exporterExists[_exporter] && 
               exporterProfiles[_exporter].isActive;
    }

    /**
     * @notice Get exporter profile
     * @param _exporter Exporter wallet address
     * @return profile ExporterProfile struct
     */
    function getExporterProfile(address _exporter) external view returns (ExporterProfile memory) {
        require(exporterExists[_exporter], "Exporter does not exist");
        return exporterProfiles[_exporter];
    }

    /**
     * @notice Get all exporter addresses
     * @return Array of exporter addresses
     */
    function getAllExporters() external view returns (address[] memory) {
        return allExporters;
    }

    /**
     * @notice Get total number of approved exporters
     * @return count Number of approved exporters
     */
    function getApprovedExporterCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < allExporters.length; i++) {
            if (approvedExporters[allExporters[i]] && exporterProfiles[allExporters[i]].isActive) {
                count++;
            }
        }
        return count;
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

