import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

/**
 * Deploy NovaxVerificationModuleV2 with Chainlink Functions configuration
 * This uses the production-ready contract with FunctionsClient
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NovaxVerificationModuleV2 with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Load existing deployment to get Receivable Factory address
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const deploymentFiles = fs.readdirSync(deploymentsDir)
    .filter((f) => f.startsWith("novax-etherlink-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment file found. Please deploy contracts first:");
    console.error("   npm run deploy:novax:etherlink");
    process.exit(1);
  }

  const deploymentFile = path.join(deploymentsDir, deploymentFiles[0]);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log(`📋 Using deployment: ${deploymentFiles[0]}`);

  // Chainlink Functions configuration (V2 uses Router, not Oracle)
  const FUNCTIONS_ROUTER = process.env.ETHERLINK_FUNCTIONS_ROUTER || 
                           process.env.ETHERLINK_FUNCTIONS_ORACLE || 
                           ethers.ZeroAddress;
  const FUNCTIONS_SUBSCRIPTION_ID = process.env.ETHERLINK_FUNCTIONS_SUBSCRIPTION_ID || "0";
  const FUNCTIONS_DON_ID = process.env.ETHERLINK_FUNCTIONS_DON_ID || 
                           ethers.ZeroHash; // Default DON ID if not set
  const FUNCTIONS_GAS_LIMIT = process.env.ETHERLINK_FUNCTIONS_GAS_LIMIT || "300000";

  if (FUNCTIONS_ROUTER === ethers.ZeroAddress) {
    console.error("❌ ETHERLINK_FUNCTIONS_ROUTER not set in .env");
    console.error("\n📋 How to get Chainlink Functions addresses:");
    console.error("   1. Check: https://docs.chain.link/chainlink-functions/supported-networks");
    console.error("   2. Check: https://functions.chain.link/ (switch to Etherlink network)");
    console.error("   3. Contact Chainlink support: support@chain.link");
    console.error("   4. See: contracts/novax/HOW_TO_GET_ETHERLINK_ADDRESSES.md");
    console.error("\n💡 For testing, use Sepolia testnet:");
    console.error("   Router: 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0");
    console.error("   DON ID: 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000");
    process.exit(1);
  }

  // Check if DON ID is set
  if (FUNCTIONS_DON_ID === ethers.ZeroHash) {
    console.warn("⚠️  ETHERLINK_FUNCTIONS_DON_ID not set");
    console.warn("   Using zero hash - this may not work!");
    console.warn("   See: contracts/novax/HOW_TO_GET_ETHERLINK_ADDRESSES.md");
    console.warn("\n💡 For Sepolia testnet:");
    console.warn("   DON ID: 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000");
  }

  console.log("\n📦 Deploying NovaxVerificationModuleV2...");
  console.log("   Functions Router:", FUNCTIONS_ROUTER);
  console.log("   Subscription ID:", FUNCTIONS_SUBSCRIPTION_ID);
  console.log("   DON ID:", FUNCTIONS_DON_ID);
  console.log("   Gas Limit:", FUNCTIONS_GAS_LIMIT);

  const NovaxVerificationModuleV2 = await ethers.getContractFactory("NovaxVerificationModuleV2");
  const verificationModule = await NovaxVerificationModuleV2.deploy(
    FUNCTIONS_ROUTER,
    BigInt(FUNCTIONS_SUBSCRIPTION_ID),
    FUNCTIONS_DON_ID
  );
  await verificationModule.waitForDeployment();
  const verificationModuleAddress = await verificationModule.getAddress();
  console.log("✅ Verification Module V2 deployed to:", verificationModuleAddress);

  // Configure gas limit if different from default
  if (FUNCTIONS_GAS_LIMIT !== "300000") {
    console.log("\n⚙️  Setting gas limit...");
    const setGasLimitTx = await verificationModule.setGasLimit(parseInt(FUNCTIONS_GAS_LIMIT));
    await setGasLimitTx.wait();
    console.log("✅ Gas limit set to:", FUNCTIONS_GAS_LIMIT);
  }

  // Set core contract (ReceivableFactory)
  console.log("\n🔗 Linking to Receivable Factory...");
  const setCoreContractTx = await verificationModule.setCoreContract(contracts.NovaxReceivableFactory);
  await setCoreContractTx.wait();
  console.log("✅ Core contract set to Receivable Factory");

  // Link to Receivable Factory
  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);
  
  const setVerificationModuleTx = await receivableFactory.setVerificationModule(verificationModuleAddress);
  await setVerificationModuleTx.wait();
  console.log("✅ Linked Verification Module to Receivable Factory");

  // Update deployment file
  deployment.contracts.NovaxVerificationModule = verificationModuleAddress;
  deployment.contracts.NovaxVerificationModuleV2 = verificationModuleAddress; // Also save as V2
  if (!deployment.chainlink) {
    deployment.chainlink = {};
  }
  deployment.chainlink.FUNCTIONS_ROUTER = FUNCTIONS_ROUTER;
  deployment.chainlink.FUNCTIONS_SUBSCRIPTION_ID = FUNCTIONS_SUBSCRIPTION_ID;
  deployment.chainlink.FUNCTIONS_DON_ID = FUNCTIONS_DON_ID;
  deployment.chainlink.FUNCTIONS_GAS_LIMIT = FUNCTIONS_GAS_LIMIT;

  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log("\n💾 Updated deployment file:", deploymentFile);

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Verification Module V2 Address:");
  console.log("   ", verificationModuleAddress);
  console.log("\n📝 Next Steps:");
  console.log("   1. Add this contract as a consumer in your Chainlink Functions subscription");
  console.log("   2. Fund your subscription with LINK tokens");
  console.log("   3. Test verification with a sample receivable");
  console.log("\n🔗 View on Explorer:");
  console.log(`   https://shadownet.explorer.etherlink.com/address/${verificationModuleAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

