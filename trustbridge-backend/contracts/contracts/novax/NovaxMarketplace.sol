// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title NovaxMarketplace
 * @dev Secondary market for trading pool tokens
 * @notice Enables investors to buy/sell pool tokens on secondary markets
 */
contract NovaxMarketplace is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Listing {
        bytes32 listingId;          // Unique listing ID
        address seller;              // Token seller
        address poolToken;           // PoolToken contract address
        bytes32 poolId;              // Pool ID
        uint256 amount;               // Amount of pool tokens for sale
        uint256 pricePerToken;       // Price per token in USDC (6 decimals)
        uint256 totalPrice;           // Total price (amount * pricePerToken)
        uint256 minPurchase;         // Minimum purchase amount
        uint256 maxPurchase;         // Maximum purchase amount (0 = no limit)
        uint256 deadline;             // Listing expiration timestamp
        bool active;                  // Listing status
        uint256 createdAt;            // Creation timestamp
    }

    struct Order {
        bytes32 orderId;             // Unique order ID
        address buyer;                // Token buyer
        bytes32 listingId;            // Associated listing ID
        uint256 amount;               // Amount of tokens purchased
        uint256 totalPrice;           // Total price paid
        uint256 timestamp;            // Order timestamp
    }

    // Storage mappings
    mapping(bytes32 => Listing) public listings;
    mapping(bytes32 => bool) public listingExists;
    mapping(address => bytes32[]) public userListings; // user => listingIds[]
    mapping(bytes32 => bytes32[]) public poolListings; // poolId => listingIds[]
    mapping(bytes32 => Order[]) public listingOrders; // listingId => orders[]

    // Fee configuration
    uint256 public platformFeeBps = 250; // 2.5% (250 basis points)
    uint256 public royaltyFeeBps = 100;  // 1% (100 basis points) - goes to pool
    address public feeRecipient;         // Platform fee recipient
    address public poolManager;         // NovaxPoolManager address

    uint256 public totalListings;
    uint256 public totalOrders;
    uint256 public totalVolume; // Total trading volume in USDC

    // Events
    event ListingCreated(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed poolToken,
        bytes32 poolId,
        uint256 amount,
        uint256 pricePerToken,
        uint256 deadline
    );

    event ListingUpdated(
        bytes32 indexed listingId,
        uint256 newPricePerToken,
        uint256 newAmount
    );

    event ListingCancelled(
        bytes32 indexed listingId,
        address indexed seller
    );

    event OrderExecuted(
        bytes32 indexed orderId,
        bytes32 indexed listingId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 totalPrice,
        uint256 platformFee,
        uint256 royaltyFee
    );

    event FeesUpdated(
        uint256 platformFeeBps,
        uint256 royaltyFeeBps
    );

    constructor(address _poolManager, address _feeRecipient) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        require(_poolManager != address(0), "Invalid pool manager");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        poolManager = _poolManager;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Create a listing to sell pool tokens
     * @param _poolToken PoolToken contract address
     * @param _poolId Pool ID
     * @param _amount Amount of pool tokens to sell
     * @param _pricePerToken Price per token in USDC (6 decimals)
     * @param _minPurchase Minimum purchase amount
     * @param _maxPurchase Maximum purchase amount (0 = no limit)
     * @param _deadline Listing expiration timestamp (0 = no expiration)
     * @return listingId The created listing ID
     */
    function createListing(
        address _poolToken,
        bytes32 _poolId,
        uint256 _amount,
        uint256 _pricePerToken,
        uint256 _minPurchase,
        uint256 _maxPurchase,
        uint256 _deadline
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(_poolToken != address(0), "Invalid pool token");
        require(_amount > 0, "Amount must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        require(_minPurchase <= _amount, "Min purchase exceeds amount");
        require(_maxPurchase == 0 || _maxPurchase >= _minPurchase, "Invalid max purchase");
        require(_deadline == 0 || _deadline > block.timestamp, "Invalid deadline");

        // Check seller has enough tokens
        require(
            IERC20(_poolToken).balanceOf(msg.sender) >= _amount,
            "Insufficient pool tokens"
        );

        // Generate unique listing ID
        bytes32 listingId = keccak256(
            abi.encodePacked(
                msg.sender,
                _poolToken,
                _poolId,
                _amount,
                _pricePerToken,
                block.timestamp,
                block.prevrandao
            )
        );

        require(!listingExists[listingId], "Listing ID collision");

        uint256 totalPrice = (_amount * _pricePerToken) / 1e18; // Adjust for decimals

        // Create listing
        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            poolToken: _poolToken,
            poolId: _poolId,
            amount: _amount,
            pricePerToken: _pricePerToken,
            totalPrice: totalPrice,
            minPurchase: _minPurchase,
            maxPurchase: _maxPurchase,
            deadline: _deadline,
            active: true,
            createdAt: block.timestamp
        });

        listingExists[listingId] = true;
        userListings[msg.sender].push(listingId);
        poolListings[_poolId].push(listingId);
        totalListings++;

        emit ListingCreated(
            listingId,
            msg.sender,
            _poolToken,
            _poolId,
            _amount,
            _pricePerToken,
            _deadline
        );

        return listingId;
    }

    /**
     * @notice Update listing price or amount
     * @param _listingId Listing ID
     * @param _newPricePerToken New price per token (0 = keep current)
     * @param _newAmount New amount (0 = keep current)
     */
    function updateListing(
        bytes32 _listingId,
        uint256 _newPricePerToken,
        uint256 _newAmount
    ) external nonReentrant {
        require(listingExists[_listingId], "Listing does not exist");
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing is not active");
        require(listing.seller == msg.sender, "Not the seller");
        require(
            listing.deadline == 0 || listing.deadline > block.timestamp,
            "Listing expired"
        );

        if (_newPricePerToken > 0) {
            listing.pricePerToken = _newPricePerToken;
        }

        if (_newAmount > 0) {
            require(
                IERC20(listing.poolToken).balanceOf(msg.sender) >= _newAmount,
                "Insufficient pool tokens"
            );
            listing.amount = _newAmount;
            listing.totalPrice = (_newAmount * listing.pricePerToken) / 1e18;
        }

        emit ListingUpdated(_listingId, listing.pricePerToken, listing.amount);
    }

    /**
     * @notice Cancel a listing
     * @param _listingId Listing ID
     */
    function cancelListing(bytes32 _listingId) external nonReentrant {
        require(listingExists[_listingId], "Listing does not exist");
        Listing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing already cancelled");

        listing.active = false;

        emit ListingCancelled(_listingId, msg.sender);
    }

    /**
     * @notice Buy pool tokens from a listing
     * @param _listingId Listing ID
     * @param _amount Amount of pool tokens to buy
     */
    function buyTokens(
        bytes32 _listingId,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        require(listingExists[_listingId], "Listing does not exist");
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing is not active");
        require(
            listing.deadline == 0 || listing.deadline > block.timestamp,
            "Listing expired"
        );
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= listing.amount, "Amount exceeds available");
        require(_amount >= listing.minPurchase, "Amount below minimum");
        require(
            listing.maxPurchase == 0 || _amount <= listing.maxPurchase,
            "Amount exceeds maximum"
        );
        require(listing.seller != msg.sender, "Cannot buy from yourself");

        // Calculate total price
        uint256 totalPrice = (_amount * listing.pricePerToken) / 1e18;

        // Calculate fees
        uint256 platformFee = (totalPrice * platformFeeBps) / 10000;
        uint256 royaltyFee = (totalPrice * royaltyFeeBps) / 10000;
        uint256 sellerAmount = totalPrice - platformFee - royaltyFee;

        // Get USDC token address
        address usdcTokenAddress = getUSDCFromPoolManager();
        require(usdcTokenAddress != address(0), "USDC token not found");

        // Transfer USDC from buyer
        IERC20(usdcTokenAddress).safeTransferFrom(msg.sender, address(this), totalPrice);

        // Transfer fees
        IERC20(usdcTokenAddress).safeTransfer(feeRecipient, platformFee);
        IERC20(usdcTokenAddress).safeTransfer(poolManager, royaltyFee); // Royalty goes to pool

        // Transfer payment to seller
        IERC20(usdcTokenAddress).safeTransfer(listing.seller, sellerAmount);

        // Transfer pool tokens from seller to buyer
        // Seller must have approved this contract to transfer tokens
        // Note: PoolToken is standard ERC20, so safeTransferFrom works
        IERC20(listing.poolToken).safeTransferFrom(listing.seller, msg.sender, _amount);

        // Update listing
        listing.amount -= _amount;
        if (listing.amount == 0) {
            listing.active = false;
        }

        // Create order record
        bytes32 orderId = keccak256(
            abi.encodePacked(
                _listingId,
                msg.sender,
                _amount,
                block.timestamp,
                block.prevrandao
            )
        );

        listingOrders[_listingId].push(Order({
            orderId: orderId,
            buyer: msg.sender,
            listingId: _listingId,
            amount: _amount,
            totalPrice: totalPrice,
            timestamp: block.timestamp
        }));

        totalOrders++;
        totalVolume += totalPrice;

        emit OrderExecuted(
            orderId,
            _listingId,
            msg.sender,
            listing.seller,
            _amount,
            totalPrice,
            platformFee,
            royaltyFee
        );
    }

    // USDC token address (set during initialization)
    address public usdcToken;

    /**
     * @notice Set USDC token address
     * @param _usdcToken USDC token address
     */
    function setUSDCAddress(address _usdcToken) external onlyRole(ADMIN_ROLE) {
        require(_usdcToken != address(0), "Invalid address");
        usdcToken = _usdcToken;
    }

    /**
     * @notice Get USDC token address
     * @return USDC token address
     */
    function getUSDCFromPoolManager() internal view returns (address) {
        if (usdcToken != address(0)) {
            return usdcToken;
        }
        // Fallback: Try to get from pool manager
        (bool success, bytes memory data) = poolManager.staticcall(
            abi.encodeWithSignature("usdcToken()")
        );
        if (success && data.length > 0) {
            return abi.decode(data, (address));
        }
        return address(0);
    }

    /**
     * @notice Set fee configuration
     * @param _platformFeeBps Platform fee in basis points
     * @param _royaltyFeeBps Royalty fee in basis points
     */
    function setFees(
        uint256 _platformFeeBps,
        uint256 _royaltyFeeBps
    ) external onlyRole(ADMIN_ROLE) {
        require(_platformFeeBps <= 1000, "Platform fee too high (max 10%)");
        require(_royaltyFeeBps <= 500, "Royalty fee too high (max 5%)");

        platformFeeBps = _platformFeeBps;
        royaltyFeeBps = _royaltyFeeBps;

        emit FeesUpdated(_platformFeeBps, _royaltyFeeBps);
    }

    /**
     * @notice Set fee recipient address
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyRole(ADMIN_ROLE) {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Set pool manager address
     * @param _poolManager New pool manager address
     */
    function setPoolManager(address _poolManager) external onlyRole(ADMIN_ROLE) {
        require(_poolManager != address(0), "Invalid address");
        poolManager = _poolManager;
    }

    /**
     * @notice Get listing details
     * @param _listingId Listing ID
     * @return listing The listing struct
     */
    function getListing(bytes32 _listingId) external view returns (Listing memory) {
        require(listingExists[_listingId], "Listing does not exist");
        return listings[_listingId];
    }

    /**
     * @notice Get all listings for a user
     * @param _user User address
     * @return Array of listing IDs
     */
    function getUserListings(address _user) external view returns (bytes32[] memory) {
        return userListings[_user];
    }

    /**
     * @notice Get all listings for a pool
     * @param _poolId Pool ID
     * @return Array of listing IDs
     */
    function getPoolListings(bytes32 _poolId) external view returns (bytes32[] memory) {
        return poolListings[_poolId];
    }

    /**
     * @notice Get orders for a listing
     * @param _listingId Listing ID
     * @return Array of orders
     */
    function getListingOrders(bytes32 _listingId) external view returns (Order[] memory) {
        return listingOrders[_listingId];
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

