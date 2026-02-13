// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NovaxRwaFactory
 * @dev Minimal on-chain RWA asset creation with IPFS CID storage
 * @notice Only essential data stored on-chain, all metadata stored on IPFS
 */
contract NovaxRwaFactory is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE");

    enum AssetCategory {
        REAL_ESTATE,
        AGRICULTURE,
        INFRASTRUCTURE,
        COMMODITY,
        EQUIPMENT,
        OTHER
    }

    enum AssetStatus {
        PENDING_VERIFICATION,
        AMC_APPROVED,
        ACTIVE,
        REJECTED,
        FLAGGED
    }

    /**
     * @dev Minimal on-chain asset structure
     * @notice Only essential data stored on-chain
     */
    struct RwaAsset {
        bytes32 id;                    // Unique asset identifier
        address owner;                 // Asset owner address
        AssetCategory category;        // Asset category
        uint256 valueUSD;              // Asset value in USD (6 decimals for USDC precision)
        uint8 maxLTV;                  // Maximum Loan-to-Value percentage (0-100)
        bytes32 metadataCID;           // IPFS CID for metadata (stored as bytes32)
        uint8 status;                  // Asset status
        uint256 riskScore;             // Risk score (0-100, for calculations)
        uint256 createdAt;             // Creation timestamp
        uint256 verifiedAt;            // Verification timestamp
        address currentAMC;            // Current AMC managing the asset
    }

    // Storage mappings
    mapping(bytes32 => RwaAsset) public assets;
    mapping(address => bytes32[]) public userAssets;
    mapping(address => bytes32[]) public amcManagedAssets;
    mapping(bytes32 => bool) public assetExists;

    uint256 public totalAssets;
    address public poolManager; // NovaxPoolManager contract address

    // Events
    event RwaAssetCreated(
        bytes32 indexed assetId,
        address indexed owner,
        AssetCategory category,
        uint256 valueUSD,
        bytes32 metadataCID,
        uint256 timestamp
    );

    event AssetVerified(
        bytes32 indexed assetId,
        address indexed verifiedBy,
        uint256 riskScore,
        uint256 timestamp
    );

    event AssetApproved(
        bytes32 indexed assetId,
        address indexed amc,
        uint256 timestamp
    );

    event AssetRejected(
        bytes32 indexed assetId,
        address indexed rejectedBy,
        string reason,
        uint256 timestamp
    );

    event AssetStatusUpdated(
        bytes32 indexed assetId,
        AssetStatus oldStatus,
        AssetStatus newStatus,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AMC_ROLE, msg.sender);
    }

    /**
     * @notice Create a new RWA asset with minimal on-chain data
     * @param _category Asset category
     * @param _valueUSD Asset value in USD (6 decimals)
     * @param _maxLTV Maximum Loan-to-Value percentage (0-100)
     * @param _metadataCID IPFS CID for asset metadata (converted to bytes32)
     * @return assetId The created asset ID
     */
    function createRwa(
        AssetCategory _category,
        uint256 _valueUSD,
        uint8 _maxLTV,
        bytes32 _metadataCID
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(_valueUSD > 0, "Value must be greater than 0");
        require(_maxLTV <= 100, "Max LTV must be <= 100");
        require(_metadataCID != bytes32(0), "Metadata CID required");

        // Generate unique asset ID
        bytes32 assetId = keccak256(
            abi.encodePacked(
                msg.sender,
                _category,
                _valueUSD,
                _metadataCID,
                block.timestamp,
                block.prevrandao
            )
        );

        require(!assetExists[assetId], "Asset ID collision");

        // Create asset with minimal on-chain data
        assets[assetId] = RwaAsset({
            id: assetId,
            owner: msg.sender,
            category: _category,
            valueUSD: _valueUSD,
            maxLTV: _maxLTV,
            metadataCID: _metadataCID,
            status: uint8(AssetStatus.PENDING_VERIFICATION),
            riskScore: 0,
            createdAt: block.timestamp,
            verifiedAt: 0,
            currentAMC: address(0)
        });

        assetExists[assetId] = true;
        userAssets[msg.sender].push(assetId);
        totalAssets++;

        emit RwaAssetCreated(
            assetId,
            msg.sender,
            _category,
            _valueUSD,
            _metadataCID,
            block.timestamp
        );

        return assetId;
    }

    /**
     * @notice Approve and verify asset (called by AMC)
     * @param _assetId Asset ID to approve
     * @param _riskScore Risk score (0-100)
     */
    function approveAsset(
        bytes32 _assetId,
        uint256 _riskScore
    ) external onlyRole(AMC_ROLE) {
        require(assetExists[_assetId], "Asset does not exist");
        require(_riskScore <= 100, "Risk score must be <= 100");

        RwaAsset storage asset = assets[_assetId];
        require(
            asset.status == uint8(AssetStatus.PENDING_VERIFICATION),
            "Asset not pending verification"
        );

        asset.riskScore = _riskScore;
        asset.verifiedAt = block.timestamp;
        asset.currentAMC = msg.sender;
        asset.status = uint8(AssetStatus.AMC_APPROVED);
        amcManagedAssets[msg.sender].push(_assetId);

        emit AssetVerified(_assetId, msg.sender, _riskScore, block.timestamp);
        emit AssetApproved(_assetId, msg.sender, block.timestamp);
        emit AssetStatusUpdated(
            _assetId,
            AssetStatus.PENDING_VERIFICATION,
            AssetStatus.AMC_APPROVED,
            block.timestamp
        );
    }

    /**
     * @notice Reject an asset
     * @param _assetId Asset ID to reject
     * @param _reason Rejection reason
     */
    function rejectAsset(
        bytes32 _assetId,
        string memory _reason
    ) external onlyRole(AMC_ROLE) {
        require(assetExists[_assetId], "Asset does not exist");

        RwaAsset storage asset = assets[_assetId];
        AssetStatus oldStatus = AssetStatus(asset.status);
        asset.status = uint8(AssetStatus.REJECTED);

        emit AssetRejected(_assetId, msg.sender, _reason, block.timestamp);
        emit AssetStatusUpdated(
            _assetId,
            oldStatus,
            AssetStatus.REJECTED,
            block.timestamp
        );
    }

    /**
     * @notice Update asset status (called by AMC)
     * @param _assetId Asset ID
     * @param _newStatus New status
     */
    function updateAssetStatus(
        bytes32 _assetId,
        AssetStatus _newStatus
    ) external onlyRole(AMC_ROLE) {
        require(assetExists[_assetId], "Asset does not exist");

        RwaAsset storage asset = assets[_assetId];
        require(
            asset.currentAMC == msg.sender,
            "Only assigned AMC can update status"
        );

        AssetStatus oldStatus = AssetStatus(asset.status);
        asset.status = uint8(_newStatus);

        emit AssetStatusUpdated(_assetId, oldStatus, _newStatus, block.timestamp);
    }

    /**
     * @notice Set PoolManager contract address
     * @param _poolManager PoolManager contract address
     */
    function setPoolManager(address _poolManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_poolManager != address(0), "Invalid address");
        poolManager = _poolManager;
    }

    /**
     * @notice Get asset details
     * @param _assetId Asset ID
     * @return asset The asset struct
     */
    function getAsset(bytes32 _assetId) external view returns (RwaAsset memory) {
        require(assetExists[_assetId], "Asset does not exist");
        return assets[_assetId];
    }

    /**
     * @notice Get user's assets
     * @param _user User address
     * @return Array of asset IDs
     */
    function getUserAssets(address _user) external view returns (bytes32[] memory) {
        return userAssets[_user];
    }

    /**
     * @notice Get AMC's managed assets
     * @param _amc AMC address
     * @return Array of asset IDs
     */
    function getAmcAssets(address _amc) external view returns (bytes32[] memory) {
        return amcManagedAssets[_amc];
    }

    /**
     * @notice Check if asset exists (for external contracts)
     * @param _assetId Asset ID
     * @return True if asset exists
     */
    function doesAssetExist(bytes32 _assetId) external view returns (bool) {
        return assetExists[_assetId];
    }

    /**
     * @notice Check if asset is AMC approved
     * @param _assetId Asset ID
     * @return True if asset is AMC approved
     */
    function isAssetApproved(bytes32 _assetId) external view returns (bool) {
        require(assetExists[_assetId], "Asset does not exist");
        return assets[_assetId].status == uint8(AssetStatus.AMC_APPROVED);
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

