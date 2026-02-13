// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NovaxRwaFactory.sol";
import "./NovaxReceivableFactory.sol";
import "./NovaxPoolManager.sol";
import "./NovaxExporterRegistry.sol";
import "./PoolToken.sol";
import "./NVXToken.sol";
import "./NovaxPriceManager.sol";
import "./NovaxVRFModule.sol";
import "./NovaxVerificationModule.sol";

/**
 * @title RemixTestSetup
 * @dev Comprehensive contract to deploy and test all Novax contracts in Remix
 * @notice Use this contract to deploy all Novax contracts with proper initialization
 */
contract RemixTestSetup {
    // Contract instances
    NovaxRwaFactory public rwaFactory;
    NovaxReceivableFactory public receivableFactory;
    NovaxExporterRegistry public exporterRegistry;
    NovaxPoolManager public poolManager;
    NVXToken public nvxToken;
    NovaxPriceManager public priceManager;
    NovaxVRFModule public vrfModule;
    NovaxVerificationModule public verificationModule;

    // Mock USDC for testing (you'll need to deploy a mock ERC20)
    address public mockUSDC;

    // Deployment events
    event ContractsDeployed(
        address rwaFactory,
        address receivableFactory,
        address exporterRegistry,
        address poolManager,
        address nvxToken,
        address priceManager,
        address vrfModule,
        address verificationModule
    );

    /**
     * @notice Deploy all Novax contracts
     * @param _mockUSDC Mock USDC token address (deploy separately)
     * @param _ethUsdFeed Chainlink ETH/USD feed address (use zero address for testing)
     * @param _btcUsdFeed Chainlink BTC/USD feed address (use zero address for testing)
     * @param _usdcUsdFeed Chainlink USDC/USD feed address (use zero address for testing)
     * @param _linkUsdFeed Chainlink LINK/USD feed address (use zero address for testing)
     * @param _vrfCoordinator Chainlink VRF Coordinator address (use zero address for testing)
     * @param _vrfKeyHash VRF key hash (use zero bytes32 for testing)
     * @param _vrfSubscriptionId VRF subscription ID (use 0 for testing)
     * @param _functionsOracle Chainlink Functions Oracle address (use zero address for testing)
     * @param _functionsSourceHash Functions source code hash (use zero bytes32 for testing)
     * @param _functionsSubscriptionId Functions subscription ID (use 0 for testing)
     * @param _functionsGasLimit Functions gas limit (use 100000 for testing)
     */
    function deployAll(
        address _mockUSDC,
        address _ethUsdFeed,
        address _btcUsdFeed,
        address _usdcUsdFeed,
        address _linkUsdFeed,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint64 _vrfSubscriptionId,
        address _functionsOracle,
        bytes32 _functionsSourceHash,
        uint64 _functionsSubscriptionId,
        uint32 _functionsGasLimit
    ) external {
        // Deploy NVX Token
        nvxToken = new NVXToken();

        // Deploy RWA Factory
        rwaFactory = new NovaxRwaFactory();

        // Deploy Receivable Factory
        receivableFactory = new NovaxReceivableFactory();

        // Deploy Exporter Registry
        exporterRegistry = new NovaxExporterRegistry();

        // Deploy Pool Manager (with new constructor parameters)
        // Using deployer address as treasury and AMC for testing
        address platformTreasury = msg.sender; // Use deployer as treasury
        address amcAddress = msg.sender; // Use deployer as AMC
        uint256 platformFeeBps = 100; // 1%
        uint256 amcFeeBps = 200; // 2%
        
        poolManager = new NovaxPoolManager(
            _mockUSDC,
            address(nvxToken),
            platformTreasury,
            amcAddress,
            platformFeeBps,
            amcFeeBps
        );
        mockUSDC = _mockUSDC;

        // Deploy Price Manager (use zero addresses if not available)
        if (_ethUsdFeed != address(0)) {
            priceManager = new NovaxPriceManager(
                _ethUsdFeed,
                _btcUsdFeed,
                _usdcUsdFeed,
                _linkUsdFeed
            );
        }

        // Deploy VRF Module (use zero address if not available)
        if (_vrfCoordinator != address(0)) {
            vrfModule = new NovaxVRFModule(
                _vrfCoordinator,
                _vrfKeyHash,
                _vrfSubscriptionId
            );
        }

        // Deploy Verification Module (use zero address if not available)
        if (_functionsOracle != address(0)) {
            verificationModule = new NovaxVerificationModule(
                _functionsOracle,
                _functionsSourceHash,
                _functionsSubscriptionId,
                _functionsGasLimit
            );
        }

        // Link contracts
        rwaFactory.setPoolManager(address(poolManager));
        if (address(verificationModule) != address(0)) {
            receivableFactory.setVerificationModule(address(verificationModule));
        }
        poolManager.setRwaFactory(address(rwaFactory));
        poolManager.setReceivableFactory(address(receivableFactory));
        poolManager.setNvxToken(address(nvxToken));

        emit ContractsDeployed(
            address(rwaFactory),
            address(receivableFactory),
            address(exporterRegistry),
            address(poolManager),
            address(nvxToken),
            address(priceManager),
            address(vrfModule),
            address(verificationModule)
        );
    }

    /**
     * @notice Get all deployed contract addresses
     * @return addresses Array of contract addresses
     */
    function getContractAddresses() external view returns (address[] memory addresses) {
        addresses = new address[](8);
        addresses[0] = address(rwaFactory);
        addresses[1] = address(receivableFactory);
        addresses[2] = address(exporterRegistry);
        addresses[3] = address(poolManager);
        addresses[4] = address(nvxToken);
        addresses[5] = address(priceManager);
        addresses[6] = address(vrfModule);
        addresses[7] = address(verificationModule);
        return addresses;
    }

    /**
     * @notice Test RWA creation
     * @param _category Asset category (0-5)
     * @param _valueUSD Asset value in USD (6 decimals)
     * @param _maxLTV Maximum LTV (0-100)
     * @param _metadataCID IPFS CID (as bytes32)
     * @return assetId Created asset ID
     */
    function testCreateRwa(
        uint8 _category,
        uint256 _valueUSD,
        uint8 _maxLTV,
        bytes32 _metadataCID
    ) external returns (bytes32 assetId) {
        require(address(rwaFactory) != address(0), "RWA Factory not deployed");
        return rwaFactory.createRwa(
            NovaxRwaFactory.AssetCategory(_category),
            _valueUSD,
            _maxLTV,
            _metadataCID
        );
    }

    /**
     * @notice Test Receivable creation
     * @param _importer Importer address
     * @param _amountUSD Invoice amount (6 decimals)
     * @param _dueDate Due date (timestamp)
     * @param _metadataCID IPFS CID (as bytes32)
     * @return receivableId Created receivable ID
     */
    function testCreateReceivable(
        address _importer,
        uint256 _amountUSD,
        uint256 _dueDate,
        bytes32 _metadataCID
    ) external returns (bytes32 receivableId) {
        require(address(receivableFactory) != address(0), "Receivable Factory not deployed");
        return receivableFactory.createReceivable(
            _importer,
            _amountUSD,
            _dueDate,
            _metadataCID,
            bytes32(0) // importerApprovalId
        );
    }
}

