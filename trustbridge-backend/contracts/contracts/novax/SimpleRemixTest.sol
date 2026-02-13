// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NovaxRwaFactory.sol";
import "./NVXToken.sol";

/**
 * @title SimpleRemixTest
 * @dev Simple contract to test individual Novax contracts in Remix
 * @notice Use this for quick testing of individual contracts
 */
contract SimpleRemixTest {
    NovaxRwaFactory public rwaFactory;
    NVXToken public nvxToken;

    /**
     * @notice Deploy RWA Factory
     */
    function deployRwaFactory() external {
        rwaFactory = new NovaxRwaFactory();
    }

    /**
     * @notice Deploy NVX Token
     */
    function deployNVXToken() external {
        nvxToken = new NVXToken();
    }

    /**
     * @notice Test creating an RWA asset
     * @param _category Asset category (0-5: REAL_ESTATE, AGRICULTURE, INFRASTRUCTURE, COMMODITY, EQUIPMENT, OTHER)
     * @param _valueUSD Asset value in USD (6 decimals, e.g., 1000000 = $1.00)
     * @param _maxLTV Maximum Loan-to-Value (0-100, e.g., 70 = 70%)
     * @param _metadataCID IPFS CID as bytes32 (convert IPFS CID to bytes32)
     * @return assetId Created asset ID
     */
    function testCreateRwa(
        uint8 _category,
        uint256 _valueUSD,
        uint8 _maxLTV,
        bytes32 _metadataCID
    ) external returns (bytes32 assetId) {
        require(address(rwaFactory) != address(0), "Deploy RWA Factory first");
        return rwaFactory.createRwa(
            NovaxRwaFactory.AssetCategory(_category),
            _valueUSD,
            _maxLTV,
            _metadataCID
        );
    }

    /**
     * @notice Get RWA asset details
     * @param _assetId Asset ID
     * @return asset Asset struct
     */
    function getRwaAsset(bytes32 _assetId) external view returns (NovaxRwaFactory.RwaAsset memory asset) {
        require(address(rwaFactory) != address(0), "Deploy RWA Factory first");
        return rwaFactory.getAsset(_assetId);
    }

    /**
     * @notice Get NVX token balance
     * @param _account Account address
     * @return balance Token balance
     */
    function getNVXBalance(address _account) external view returns (uint256 balance) {
        require(address(nvxToken) != address(0), "Deploy NVX Token first");
        return nvxToken.balanceOf(_account);
    }

    /**
     * @notice Get contract addresses
     * @return _rwaFactory RWA Factory address
     * @return _nvxToken NVX Token address
     */
    function getAddresses() external view returns (address _rwaFactory, address _nvxToken) {
        return (address(rwaFactory), address(nvxToken));
    }
}

