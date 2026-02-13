import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Novax contracts to Etherlink with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Etherlink Chainlink addresses (testnet)
  // Note: Update these with actual Etherlink Chainlink addresses when available
  const ETHLINK_CHAINLINK = {
    // Price Feeds (update with actual Etherlink addresses)
    ETH_USD: process.env.ETHERLINK_ETH_USD_FEED || ethers.ZeroAddress,
    BTC_USD: process.env.ETHERLINK_BTC_USD_FEED || ethers.ZeroAddress,
    USDC_USD: process.env.ETHERLINK_USDC_USD_FEED || ethers.ZeroAddress,
    LINK_USD: process.env.ETHERLINK_LINK_USD_FEED || ethers.ZeroAddress,
    // VRF (update with actual Etherlink addresses)
    VRF_COORDINATOR: process.env.ETHERLINK_VRF_COORDINATOR || ethers.ZeroAddress,
    VRF_KEY_HASH: process.env.ETHERLINK_VRF_KEY_HASH || ethers.ZeroHash,
    VRF_SUBSCRIPTION_ID: process.env.ETHERLINK_VRF_SUBSCRIPTION_ID || "0",
    // Functions (update with actual Etherlink addresses)
    FUNCTIONS_ORACLE: process.env.ETHERLINK_FUNCTIONS_ORACLE || ethers.ZeroAddress,
    FUNCTIONS_SOURCE_HASH: process.env.ETHERLINK_FUNCTIONS_SOURCE_HASH || ethers.ZeroHash,
    FUNCTIONS_SUBSCRIPTION_ID: process.env.ETHERLINK_FUNCTIONS_SUBSCRIPTION_ID || "0",
    FUNCTIONS_GAS_LIMIT: process.env.ETHERLINK_FUNCTIONS_GAS_LIMIT || "100000",
  };

  // USDC address on Etherlink (use real USDC or deploy mock)
  const USDC_ADDRESS = process.env.ETHERLINK_USDC_ADDRESS || ethers.ZeroAddress;
  let usdcAddress: string;

  if (USDC_ADDRESS === ethers.ZeroAddress) {
    console.log("\n⚠️  No USDC address provided. Deploying Mock USDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log("✅ Mock USDC deployed to:", usdcAddress);
  } else {
    console.log("\n✅ Using existing USDC at:", USDC_ADDRESS);
    usdcAddress = USDC_ADDRESS;
  }

  // Deploy NVX Token
  console.log("\n📦 Deploying NVX Token...");
  const NVXToken = await ethers.getContractFactory("NVXToken");
  const nvxToken = await NVXToken.deploy();
  await nvxToken.waitForDeployment();
  const nvxTokenAddress = await nvxToken.getAddress();
  console.log("✅ NVX Token deployed to:", nvxTokenAddress);

  // Deploy RWA Factory
  console.log("\n📦 Deploying NovaxRwaFactory...");
  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = await NovaxRwaFactory.deploy();
  await rwaFactory.waitForDeployment();
  const rwaFactoryAddress = await rwaFactory.getAddress();
  console.log("✅ RWA Factory deployed to:", rwaFactoryAddress);

  // Deploy Receivable Factory
  console.log("\n📦 Deploying NovaxReceivableFactory...");
  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = await NovaxReceivableFactory.deploy();
  await receivableFactory.waitForDeployment();
  const receivableFactoryAddress = await receivableFactory.getAddress();
  console.log("✅ Receivable Factory deployed to:", receivableFactoryAddress);

  // Deploy Exporter Registry
  console.log("\n📦 Deploying NovaxExporterRegistry...");
  const NovaxExporterRegistry = await ethers.getContractFactory("NovaxExporterRegistry");
  const exporterRegistry = await NovaxExporterRegistry.deploy();
  await exporterRegistry.waitForDeployment();
  const exporterRegistryAddress = await exporterRegistry.getAddress();
  console.log("✅ Exporter Registry deployed to:", exporterRegistryAddress);

  // Configuration for Pool Manager
  const platformTreasury = process.env.PLATFORM_TREASURY || deployer.address; // Default to deployer
  const amcAddress = process.env.AMC_ADDRESS || deployer.address; // Default to deployer
  const platformFeeBps = process.env.PLATFORM_FEE_BPS ? BigInt(process.env.PLATFORM_FEE_BPS) : 100n; // 1% default
  const amcFeeBps = process.env.AMC_FEE_BPS ? BigInt(process.env.AMC_FEE_BPS) : 200n; // 2% default

  // Deploy Pool Manager
  console.log("\n📦 Deploying NovaxPoolManager...");
  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = await NovaxPoolManager.deploy(
    usdcAddress,
    nvxTokenAddress,
    platformTreasury,
    amcAddress,
    platformFeeBps,
    amcFeeBps
  );
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log("✅ Pool Manager deployed to:", poolManagerAddress);
  console.log("   Platform Treasury:", platformTreasury);
  console.log("   AMC Address:", amcAddress);
  console.log("   Platform Fee:", platformFeeBps.toString(), "bps (", Number(platformFeeBps) / 100, "%)");
  console.log("   AMC Fee:", amcFeeBps.toString(), "bps (", Number(amcFeeBps) / 100, "%)");

  // Deploy Price Manager
  console.log("\n📦 Deploying NovaxPriceManager...");
  const NovaxPriceManager = await ethers.getContractFactory("NovaxPriceManager");
  const priceManager = await NovaxPriceManager.deploy(
    ETHLINK_CHAINLINK.ETH_USD,
    ETHLINK_CHAINLINK.BTC_USD,
    ETHLINK_CHAINLINK.USDC_USD,
    ETHLINK_CHAINLINK.LINK_USD
  );
  await priceManager.waitForDeployment();
  const priceManagerAddress = await priceManager.getAddress();
  console.log("✅ Price Manager deployed to:", priceManagerAddress);

  // Deploy VRF Module (if coordinator address provided)
  let vrfModuleAddress = ethers.ZeroAddress;
  if (ETHLINK_CHAINLINK.VRF_COORDINATOR !== ethers.ZeroAddress) {
    console.log("\n📦 Deploying NovaxVRFModule...");
    const NovaxVRFModule = await ethers.getContractFactory("NovaxVRFModule");
    const vrfModule = await NovaxVRFModule.deploy(
      ETHLINK_CHAINLINK.VRF_COORDINATOR,
      ETHLINK_CHAINLINK.VRF_KEY_HASH,
      BigInt(ETHLINK_CHAINLINK.VRF_SUBSCRIPTION_ID)
    );
    await vrfModule.waitForDeployment();
    vrfModuleAddress = await vrfModule.getAddress();
    console.log("✅ VRF Module deployed to:", vrfModuleAddress);
  } else {
    console.log("\n⚠️  VRF Module skipped (no coordinator address provided)");
  }

  // Deploy Verification Module (if oracle address provided)
  let verificationModuleAddress = ethers.ZeroAddress;
  if (ETHLINK_CHAINLINK.FUNCTIONS_ORACLE !== ethers.ZeroAddress) {
    console.log("\n📦 Deploying NovaxVerificationModule...");
    const NovaxVerificationModule = await ethers.getContractFactory("NovaxVerificationModule");
    const verificationModule = await NovaxVerificationModule.deploy(
      ETHLINK_CHAINLINK.FUNCTIONS_ORACLE,
      ETHLINK_CHAINLINK.FUNCTIONS_SOURCE_HASH,
      BigInt(ETHLINK_CHAINLINK.FUNCTIONS_SUBSCRIPTION_ID),
      parseInt(ETHLINK_CHAINLINK.FUNCTIONS_GAS_LIMIT)
    );
    await verificationModule.waitForDeployment();
    verificationModuleAddress = await verificationModule.getAddress();
    console.log("✅ Verification Module deployed to:", verificationModuleAddress);
  } else {
    console.log("\n⚠️  Verification Module skipped (no oracle address provided)");
  }

  // Deploy Fallback Library
  console.log("\n📦 Deploying NovaxFallbackLibrary...");
  const NovaxFallbackLibrary = await ethers.getContractFactory("NovaxFallbackLibrary");
  const fallbackLibrary = await NovaxFallbackLibrary.deploy();
  await fallbackLibrary.waitForDeployment();
  const fallbackLibraryAddress = await fallbackLibrary.getAddress();
  console.log("✅ Fallback Library deployed to:", fallbackLibraryAddress);

  // Link contracts
  console.log("\n🔗 Linking contracts...");
  
  const setPoolManagerTx = await rwaFactory.setPoolManager(poolManagerAddress);
  await setPoolManagerTx.wait();
  console.log("✅ Linked Pool Manager to RWA Factory");

  if (verificationModuleAddress !== ethers.ZeroAddress) {
    const setVerificationModuleTx = await receivableFactory.setVerificationModule(verificationModuleAddress);
    await setVerificationModuleTx.wait();
    console.log("✅ Linked Verification Module to Receivable Factory");
  }

  const setRwaFactoryTx = await poolManager.setRwaFactory(rwaFactoryAddress);
  await setRwaFactoryTx.wait();
  console.log("✅ Linked RWA Factory to Pool Manager");

  const setReceivableFactoryTx = await poolManager.setReceivableFactory(receivableFactoryAddress);
  await setReceivableFactoryTx.wait();
  console.log("✅ Linked Receivable Factory to Pool Manager");

  const setNvxTokenTx = await poolManager.setNvxToken(nvxTokenAddress);
  await setNvxTokenTx.wait();
  console.log("✅ Linked NVX Token to Pool Manager");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // Save deployment addresses
  const deploymentInfo = {
    network: "etherlink_testnet",
    chainId: chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      USDC: usdcAddress,
      NVXToken: nvxTokenAddress,
      NovaxRwaFactory: rwaFactoryAddress,
      NovaxReceivableFactory: receivableFactoryAddress,
      NovaxExporterRegistry: exporterRegistryAddress,
      NovaxPoolManager: poolManagerAddress,
      NovaxPriceManager: priceManagerAddress,
      NovaxVRFModule: vrfModuleAddress !== ethers.ZeroAddress ? vrfModuleAddress : null,
      NovaxVerificationModule: verificationModuleAddress !== ethers.ZeroAddress ? verificationModuleAddress : null,
      NovaxFallbackLibrary: fallbackLibraryAddress,
    },
    configuration: {
      platformTreasury: platformTreasury,
      amcAddress: amcAddress,
      platformFeeBps: platformFeeBps.toString(),
      amcFeeBps: amcFeeBps.toString(),
    },
    chainlink: ETHLINK_CHAINLINK,
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = path.join(deploymentsDir, `novax-etherlink-${chainId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Contract Addresses:");
  console.log("====================");
  console.log("USDC:", usdcAddress);
  console.log("NVX Token:", nvxTokenAddress);
  console.log("RWA Factory:", rwaFactoryAddress);
  console.log("Receivable Factory:", receivableFactoryAddress);
  console.log("Exporter Registry:", exporterRegistryAddress);
  console.log("Pool Manager:", poolManagerAddress);
  console.log("Price Manager:", priceManagerAddress);
  if (vrfModuleAddress !== ethers.ZeroAddress) {
    console.log("VRF Module:", vrfModuleAddress);
  }
  if (verificationModuleAddress !== ethers.ZeroAddress) {
    console.log("Verification Module:", verificationModuleAddress);
  }
  console.log("Fallback Library:", fallbackLibraryAddress);
  console.log("\n💾 Deployment info saved to:", filePath);
  console.log("\n🔗 Etherlink Explorer: https://shadownet.explorer.etherlink.com/address/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

