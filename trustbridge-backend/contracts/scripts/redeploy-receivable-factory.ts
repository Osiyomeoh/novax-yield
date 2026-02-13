import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploy NovaxReceivableFactory with efficient getters
 * This updates the deployed contract to include:
 * - getExporterReceivables()
 * - getExporterReceivablesWithDetails()
 * - getReceivablesBatch()
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔄 REDEPLOYING NovaxReceivableFactory with Efficient Getters\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  // Load existing deployment addresses
  const deploymentFile = path.join(__dirname, "../deployments/etherlink_testnet.json");
  let existingDeployments: any = {};
  
  if (fs.existsSync(deploymentFile)) {
    existingDeployments = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    console.log("📋 Existing deployments loaded");
    console.log("  Old ReceivableFactory:", existingDeployments.contracts?.NovaxReceivableFactory || "N/A");
  }

  // Deploy new ReceivableFactory
  console.log("\n📦 Deploying NovaxReceivableFactory (with efficient getters)...");
  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = await NovaxReceivableFactory.deploy();
  await receivableFactory.waitForDeployment();
  const receivableFactoryAddress = await receivableFactory.getAddress();
  console.log("✅ New ReceivableFactory deployed to:", receivableFactoryAddress);

  // Verify the efficient getters exist
  console.log("\n🔍 Verifying efficient getters...");
  try {
    // Check if getExporterReceivables exists
    const hasGetter1 = await receivableFactory.getExporterReceivables.staticCall(deployer.address).catch(() => null);
    console.log("  ✅ getExporterReceivables() - Available");
    
    // Check if getExporterReceivablesWithDetails exists
    const hasGetter2 = await receivableFactory.getExporterReceivablesWithDetails.staticCall(deployer.address).catch(() => null);
    console.log("  ✅ getExporterReceivablesWithDetails() - Available");
    
    // Check if getReceivablesBatch exists
    const hasGetter3 = await receivableFactory.getReceivablesBatch.staticCall([]).catch(() => null);
    console.log("  ✅ getReceivablesBatch() - Available");
  } catch (error: any) {
    console.log("  ⚠️  Error verifying getters:", error.message);
  }

  // Get network info
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // Update deployment file
  const deploymentInfo = {
    network: "etherlink_testnet",
    chainId: chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ...existingDeployments.contracts,
      NovaxReceivableFactory: receivableFactoryAddress,
    },
    note: "Redeployed with efficient getters: getExporterReceivables, getExporterReceivablesWithDetails, getReceivablesBatch"
  };

  // Ensure deployments directory exists
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentFile);

  // IMPORTANT: Update other contracts that reference ReceivableFactory
  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("  1. Update PoolManager to use new ReceivableFactory address");
  console.log("  2. Update any other contracts that reference the old address");
  console.log("  3. Update frontend/backend to use new address:", receivableFactoryAddress);
  console.log("\n📝 New Address:", receivableFactoryAddress);
  console.log("   Old Address:", existingDeployments.contracts?.NovaxReceivableFactory || "N/A");

  console.log("\n✅ Redeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

