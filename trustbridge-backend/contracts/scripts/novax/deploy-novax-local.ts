import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Novax contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy Mock USDC first
  console.log("\n📦 Deploying Mock USDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC deployed to:", mockUSDCAddress);

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
  const platformTreasury = deployer.address; // Use deployer as treasury for local testing
  const amcAddress = deployer.address; // Use deployer as AMC for local testing
  const platformFeeBps = 100n; // 1%
  const amcFeeBps = 200n; // 2%

  // Deploy Pool Manager
  console.log("\n📦 Deploying NovaxPoolManager...");
  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = await NovaxPoolManager.deploy(
    mockUSDCAddress,
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
  console.log("   Platform Fee: 1%");
  console.log("   AMC Fee: 2%");

  // Deploy Price Manager (with zero addresses for local testing)
  console.log("\n📦 Deploying NovaxPriceManager...");
  const NovaxPriceManager = await ethers.getContractFactory("NovaxPriceManager");
  const priceManager = await NovaxPriceManager.deploy(
    ethers.ZeroAddress, // ETH/USD feed
    ethers.ZeroAddress, // BTC/USD feed
    ethers.ZeroAddress, // USDC/USD feed
    ethers.ZeroAddress  // LINK/USD feed
  );
  await priceManager.waitForDeployment();
  const priceManagerAddress = await priceManager.getAddress();
  console.log("✅ Price Manager deployed to:", priceManagerAddress);

  // Deploy VRF Module (with zero addresses for local testing)
  console.log("\n📦 Deploying NovaxVRFModule...");
  const NovaxVRFModule = await ethers.getContractFactory("NovaxVRFModule");
  // Note: VRF requires valid coordinator, so we'll skip for local testing
  // const vrfModule = await NovaxVRFModule.deploy(...);
  console.log("⚠️  VRF Module skipped for local testing (requires Chainlink VRF)");

  // Deploy Verification Module (with zero addresses for local testing)
  console.log("\n📦 Deploying NovaxVerificationModule...");
  const NovaxVerificationModule = await ethers.getContractFactory("NovaxVerificationModule");
  // Note: Functions requires valid oracle, so we'll skip for local testing
  // const verificationModule = await NovaxVerificationModule.deploy(...);
  console.log("⚠️  Verification Module skipped for local testing (requires Chainlink Functions)");

  // Deploy Fallback Library
  console.log("\n📦 Deploying NovaxFallbackLibrary...");
  const NovaxFallbackLibrary = await ethers.getContractFactory("NovaxFallbackLibrary");
  const fallbackLibrary = await NovaxFallbackLibrary.deploy();
  await fallbackLibrary.waitForDeployment();
  const fallbackLibraryAddress = await fallbackLibrary.getAddress();
  console.log("✅ Fallback Library deployed to:", fallbackLibraryAddress);

  // Link contracts
  console.log("\n🔗 Linking contracts...");
  
  // Set pool manager in RWA factory
  const setPoolManagerTx = await rwaFactory.setPoolManager(poolManagerAddress);
  await setPoolManagerTx.wait();
  console.log("✅ Linked Pool Manager to RWA Factory");

  // Set factories in pool manager
  const setRwaFactoryTx = await poolManager.setRwaFactory(rwaFactoryAddress);
  await setRwaFactoryTx.wait();
  console.log("✅ Linked RWA Factory to Pool Manager");

  const setReceivableFactoryTx = await poolManager.setReceivableFactory(receivableFactoryAddress);
  await setReceivableFactoryTx.wait();
  console.log("✅ Linked Receivable Factory to Pool Manager");

  const setNvxTokenTx = await poolManager.setNvxToken(nvxTokenAddress);
  await setNvxTokenTx.wait();
  console.log("✅ Linked NVX Token to Pool Manager");

  // Save deployment addresses
  const deploymentInfo = {
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockUSDC: mockUSDCAddress,
      NVXToken: nvxTokenAddress,
      NovaxRwaFactory: rwaFactoryAddress,
      NovaxReceivableFactory: receivableFactoryAddress,
      NovaxExporterRegistry: exporterRegistryAddress,
      NovaxPoolManager: poolManagerAddress,
      NovaxPriceManager: priceManagerAddress,
      NovaxFallbackLibrary: fallbackLibraryAddress,
    },
    configuration: {
      platformTreasury: platformTreasury,
      amcAddress: amcAddress,
      platformFeeBps: platformFeeBps.toString(),
      amcFeeBps: amcFeeBps.toString(),
    },
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = path.join(deploymentsDir, "novax-local.json");
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Contract Addresses:");
  console.log("====================");
  console.log("Mock USDC:", mockUSDCAddress);
  console.log("NVX Token:", nvxTokenAddress);
  console.log("RWA Factory:", rwaFactoryAddress);
  console.log("Receivable Factory:", receivableFactoryAddress);
  console.log("Exporter Registry:", exporterRegistryAddress);
  console.log("Pool Manager:", poolManagerAddress);
  console.log("Price Manager:", priceManagerAddress);
  console.log("Fallback Library:", fallbackLibraryAddress);
  console.log("\n💾 Deployment info saved to:", filePath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

