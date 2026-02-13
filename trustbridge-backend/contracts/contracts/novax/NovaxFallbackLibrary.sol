// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NovaxFallbackLibrary
 * @dev Fallback data when Chainlink services are unavailable
 * @notice Provides static data for risk calculations when oracles fail
 */
contract NovaxFallbackLibrary is AccessControl {
    // Commodity prices (in USD, 6 decimals)
    struct CommodityPrice {
        uint256 price;
        uint256 lastUpdated;
    }

    // Country risk scores (basis points, e.g., 125 = 1.25%)
    struct CountryRisk {
        uint256 riskBps;
        uint256 lastUpdated;
    }

    // Commodity prices fallback data
    mapping(string => CommodityPrice) public commodityPrices;
    
    // Country risk scores fallback data
    mapping(string => CountryRisk) public countryRisks;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        initialize();
    }

    /**
     * @notice Initialize fallback data
     */
    function initialize() public {
        // Initialize commodity prices (example values)
        commodityPrices["COFFEE"] = CommodityPrice(2500000, block.timestamp); // $2.50
        commodityPrices["COCOA"] = CommodityPrice(3200000, block.timestamp); // $3.20
        commodityPrices["TEA"] = CommodityPrice(1800000, block.timestamp); // $1.80
        commodityPrices["COTTON"] = CommodityPrice(850000, block.timestamp); // $0.85
        commodityPrices["RICE"] = CommodityPrice(1500000, block.timestamp); // $1.50
        commodityPrices["WHEAT"] = CommodityPrice(600000, block.timestamp); // $0.60
        commodityPrices["GOLD"] = CommodityPrice(200000000, block.timestamp); // $2000.00
        commodityPrices["SILVER"] = CommodityPrice(2500000, block.timestamp); // $25.00
        commodityPrices["OIL"] = CommodityPrice(75000000, block.timestamp); // $75.00
        commodityPrices["VANILLA"] = CommodityPrice(50000000, block.timestamp); // $500.00
        commodityPrices["SAFFRON"] = CommodityPrice(5000000000, block.timestamp); // $5000.00

        // Initialize country risk scores (basis points)
        countryRisks["NG"] = CountryRisk(450, block.timestamp); // Nigeria: 4.5%
        countryRisks["KE"] = CountryRisk(350, block.timestamp); // Kenya: 3.5%
        countryRisks["GH"] = CountryRisk(300, block.timestamp); // Ghana: 3.0%
        countryRisks["ET"] = CountryRisk(400, block.timestamp); // Ethiopia: 4.0%
        countryRisks["ZA"] = CountryRisk(250, block.timestamp); // South Africa: 2.5%
        countryRisks["TZ"] = CountryRisk(375, block.timestamp); // Tanzania: 3.75%
        countryRisks["UG"] = CountryRisk(425, block.timestamp); // Uganda: 4.25%
        countryRisks["RW"] = CountryRisk(350, block.timestamp); // Rwanda: 3.5%
    }

    /**
     * @notice Get commodity price (fallback)
     * @param _commodity Commodity name
     * @return price Price in USD (6 decimals)
     */
    function getCommodityPrice(string memory _commodity) external view returns (uint256 price) {
        CommodityPrice memory commodityPrice = commodityPrices[_commodity];
        if (commodityPrice.price > 0) {
            return commodityPrice.price;
        }
        // Default fallback price
        return 1000000; // $1.00
    }

    /**
     * @notice Get country risk score (fallback)
     * @param _countryCode Country code (ISO 2-letter)
     * @return riskBps Risk in basis points
     */
    function getCountryRisk(string memory _countryCode) external view returns (uint256 riskBps) {
        CountryRisk memory countryRisk = countryRisks[_countryCode];
        if (countryRisk.riskBps > 0) {
            return countryRisk.riskBps;
        }
        // Default fallback risk (medium-high)
        return 500; // 5.0%
    }

    /**
     * @notice Generate pseudo-random number from block data (fallback for VRF)
     * @param _seed Additional seed value
     * @return randomValue Pseudo-random number
     */
    function getPseudoRandom(uint256 _seed) external view returns (uint256 randomValue) {
        return uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    block.number,
                    _seed
                )
            )
        );
    }

    /**
     * @notice Calculate market risk (time-based cyclical model)
     * @return riskBps Market risk in basis points
     */
    function getMarketRisk() external view returns (uint256 riskBps) {
        // Simple cyclical model based on block timestamp
        // Risk varies between 100-300 bps (1-3%) over time
        uint256 cycle = (block.timestamp / 86400) % 365; // Daily cycle over a year
        uint256 baseRisk = 200; // 2% base
        uint256 variation = (cycle * 200) / 365; // 0-200 bps variation
        return baseRisk + (variation % 200);
    }
}

