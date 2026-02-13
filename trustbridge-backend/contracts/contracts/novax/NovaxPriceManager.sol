// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Use mock interface for local testing, or real Chainlink for production
// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./mocks/MockAggregatorV3.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NovaxPriceManager
 * @dev Chainlink Price Feeds integration for real-time market data
 * @notice Provides price feeds for risk and yield calculations
 */
contract NovaxPriceManager is AccessControl {
    // Chainlink Price Feed interfaces
    AggregatorV3Interface public ethUsdFeed;
    AggregatorV3Interface public btcUsdFeed;
    AggregatorV3Interface public usdcUsdFeed;
    AggregatorV3Interface public linkUsdFeed;

    // Cached prices with staleness check
    int256 public lastETHPrice;
    int256 public lastBTCPrice;
    int256 public lastUSDCPrice;
    int256 public lastLINKPrice;
    uint256 public lastPriceUpdate;

    uint256 public constant STALENESS_THRESHOLD = 3600; // 1 hour in seconds

    // Events
    event PriceUpdated(string feed, int256 price, uint256 timestamp);
    event PriceFeedError(string feed, string reason);

    constructor(
        address _ethUsdFeed,
        address _btcUsdFeed,
        address _usdcUsdFeed,
        address _linkUsdFeed
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        btcUsdFeed = AggregatorV3Interface(_btcUsdFeed);
        usdcUsdFeed = AggregatorV3Interface(_usdcUsdFeed);
        linkUsdFeed = AggregatorV3Interface(_linkUsdFeed);
    }

    /**
     * @notice Update all price feeds
     * @return success Whether any feed was successfully updated
     */
    function updateLivePrices() external returns (bool success) {
        bool anySuccess = false;

        // Update ETH/USD
        try ethUsdFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (price > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                lastETHPrice = price;
                lastPriceUpdate = block.timestamp;
                anySuccess = true;
                emit PriceUpdated("ETH/USD", price, block.timestamp);
            }
        } catch Error(string memory reason) {
            emit PriceFeedError("ETH/USD", reason);
        } catch {
            emit PriceFeedError("ETH/USD", "Unknown error");
        }

        // Update BTC/USD
        try btcUsdFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (price > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                lastBTCPrice = price;
                anySuccess = true;
                emit PriceUpdated("BTC/USD", price, block.timestamp);
            }
        } catch Error(string memory reason) {
            emit PriceFeedError("BTC/USD", reason);
        } catch {
            emit PriceFeedError("BTC/USD", "Unknown error");
        }

        // Update USDC/USD
        try usdcUsdFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (price > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                lastUSDCPrice = price;
                anySuccess = true;
                emit PriceUpdated("USDC/USD", price, block.timestamp);
            }
        } catch Error(string memory reason) {
            emit PriceFeedError("USDC/USD", reason);
        } catch {
            emit PriceFeedError("USDC/USD", "Unknown error");
        }

        // Update LINK/USD
        try linkUsdFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (price > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                lastLINKPrice = price;
                anySuccess = true;
                emit PriceUpdated("LINK/USD", price, block.timestamp);
            }
        } catch Error(string memory reason) {
            emit PriceFeedError("LINK/USD", reason);
        } catch {
            emit PriceFeedError("LINK/USD", "Unknown error");
        }

        return anySuccess;
    }

    /**
     * @notice Get ETH price in USD (with 8 decimals)
     * @return price ETH price, or cached price if feed fails
     */
    function getETHPrice() external view returns (int256 price) {
        try ethUsdFeed.latestRoundData() returns (
            uint80,
            int256 latestPrice,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (latestPrice > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                return latestPrice;
            }
        } catch {}
        return lastETHPrice;
    }

    /**
     * @notice Get BTC price in USD (with 8 decimals)
     * @return price BTC price, or cached price if feed fails
     */
    function getBTCPrice() external view returns (int256 price) {
        try btcUsdFeed.latestRoundData() returns (
            uint80,
            int256 latestPrice,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (latestPrice > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                return latestPrice;
            }
        } catch {}
        return lastBTCPrice;
    }

    /**
     * @notice Get USDC price in USD (with 8 decimals)
     * @return price USDC price, or cached price if feed fails
     */
    function getUSDCPrice() external view returns (int256 price) {
        try usdcUsdFeed.latestRoundData() returns (
            uint80,
            int256 latestPrice,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (latestPrice > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                return latestPrice;
            }
        } catch {}
        return lastUSDCPrice;
    }

    /**
     * @notice Get LINK price in USD (with 8 decimals)
     * @return price LINK price, or cached price if feed fails
     */
    function getLINKPrice() external view returns (int256 price) {
        try linkUsdFeed.latestRoundData() returns (
            uint80,
            int256 latestPrice,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (latestPrice > 0 && block.timestamp - updatedAt < STALENESS_THRESHOLD) {
                return latestPrice;
            }
        } catch {}
        return lastLINKPrice;
    }

    /**
     * @notice Update price feed addresses
     */
    function updatePriceFeeds(
        address _ethUsdFeed,
        address _btcUsdFeed,
        address _usdcUsdFeed,
        address _linkUsdFeed
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_ethUsdFeed != address(0)) ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        if (_btcUsdFeed != address(0)) btcUsdFeed = AggregatorV3Interface(_btcUsdFeed);
        if (_usdcUsdFeed != address(0)) usdcUsdFeed = AggregatorV3Interface(_usdcUsdFeed);
        if (_linkUsdFeed != address(0)) linkUsdFeed = AggregatorV3Interface(_linkUsdFeed);
    }
}

