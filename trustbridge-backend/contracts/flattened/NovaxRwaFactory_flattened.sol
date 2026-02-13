
// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4;

// File @openzeppelin/contracts/access/IAccessControl.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.4.0) (access/IAccessControl.sol)

/**
 * @dev External interface of AccessControl declared to support ERC-165 detection.
 */
interface IAccessControl {
    /**
     * @dev The `account` is missing a role.
     */
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

    /**
     * @dev The caller of a function is not the expected one.
     *
     * NOTE: Don't confuse with {AccessControlUnauthorizedAccount}.
     */
    error AccessControlBadConfirmation();

    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted to signal this.
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call. This account bears the admin role (for the granted role).
     * Expected in cases where the role was granted using the internal {AccessControl-_grantRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {AccessControl-_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     */
    function renounceRole(bytes32 role, address callerConfirmation) external;
}

// File @openzeppelin/contracts/utils/Context.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// File @openzeppelin/contracts/utils/introspection/ERC165.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/ERC165.sol)

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC-165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 */
abstract contract ERC165 is IERC165 {
    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

// File @openzeppelin/contracts/access/AccessControl.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.4.0) (access/AccessControl.sol)

/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```solidity
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```solidity
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it. We recommend using {AccessControlDefaultAdminRules}
 * to enforce additional security measures for this role.
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    mapping(bytes32 role => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with an {AccessControlUnauthorizedAccount} error including the required role.
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view virtual returns (bool) {
        return _roles[role].hasRole[account];
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `_msgSender()`
     * is missing `role`. Overriding this function changes the behavior of the {onlyRole} modifier.
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `account`
     * is missing `role`.
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view virtual returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != _msgSender()) {
            revert AccessControlBadConfirmation();
        }

        _revokeRole(role, callerConfirmation);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev Attempts to grant `role` to `account` and returns a boolean indicating if `role` was granted.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal virtual returns (bool) {
        if (!hasRole(role, account)) {
            _roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Attempts to revoke `role` from `account` and returns a boolean indicating if `role` was revoked.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal virtual returns (bool) {
        if (hasRole(role, account)) {
            _roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }
}

// File @openzeppelin/contracts/utils/Pausable.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.3.0) (utils/Pausable.sol)

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    bool private _paused;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.4.0

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// File contracts/novax/NovaxRwaFactory.sol

/**
 * @title NovaxRwaFactory
 * @dev Minimal on-chain RWA asset creation with IPFS CID storage
 * @notice Only essential data stored on-chain, all metadata stored on IPFS
 */
contract NovaxRwaFactory is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant AMC_ROLE = keccak256("AMC_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

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
        VERIFIED_PENDING_AMC,
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
        _grantRole(VERIFIER_ROLE, msg.sender);
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
     * @notice Verify an asset (called by verifier)
     * @param _assetId Asset ID to verify
     * @param _riskScore Risk score (0-100)
     */
    function verifyAsset(
        bytes32 _assetId,
        uint256 _riskScore
    ) external onlyRole(VERIFIER_ROLE) {
        require(assetExists[_assetId], "Asset does not exist");
        require(_riskScore <= 100, "Risk score must be <= 100");

        RwaAsset storage asset = assets[_assetId];
        require(
            asset.status == uint8(AssetStatus.PENDING_VERIFICATION),
            "Asset not pending verification"
        );

        asset.riskScore = _riskScore;
        asset.verifiedAt = block.timestamp;
        asset.status = uint8(AssetStatus.VERIFIED_PENDING_AMC);

        emit AssetVerified(_assetId, msg.sender, _riskScore, block.timestamp);
        emit AssetStatusUpdated(
            _assetId,
            AssetStatus.PENDING_VERIFICATION,
            AssetStatus.VERIFIED_PENDING_AMC,
            block.timestamp
        );
    }

    /**
     * @notice Approve asset for AMC management (called by AMC)
     * @param _assetId Asset ID to approve
     */
    function approveAsset(bytes32 _assetId) external onlyRole(AMC_ROLE) {
        require(assetExists[_assetId], "Asset does not exist");

        RwaAsset storage asset = assets[_assetId];
        require(
            asset.status == uint8(AssetStatus.VERIFIED_PENDING_AMC),
            "Asset not verified"
        );

        asset.currentAMC = msg.sender;
        asset.status = uint8(AssetStatus.AMC_APPROVED);
        amcManagedAssets[msg.sender].push(_assetId);

        emit AssetApproved(_assetId, msg.sender, block.timestamp);
        emit AssetStatusUpdated(
            _assetId,
            AssetStatus.VERIFIED_PENDING_AMC,
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
    ) external onlyRole(VERIFIER_ROLE) {
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
