import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

/**
 * Deploy NovaxVerificationModule with Chainlink Functions configuration
 * This script can be run separately to deploy just the verification module
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NovaxVerificationModule with account:", deployer.address);
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

  // Chainlink Functions configuration
  const FUNCTIONS_ORACLE = process.env.ETHERLINK_FUNCTIONS_ORACLE || ethers.ZeroAddress;
  const FUNCTIONS_SOURCE_HASH = process.env.ETHERLINK_FUNCTIONS_SOURCE_HASH || ethers.ZeroHash;
  const FUNCTIONS_SUBSCRIPTION_ID = process.env.ETHERLINK_FUNCTIONS_SUBSCRIPTION_ID || "0";
  const FUNCTIONS_GAS_LIMIT = process.env.ETHERLINK_FUNCTIONS_GAS_LIMIT || "100000";

  if (FUNCTIONS_ORACLE === ethers.ZeroAddress) {
    console.error("❌ ETHERLINK_FUNCTIONS_ORACLE not set in .env");
    console.error("   Please set Chainlink Functions Oracle address");
    process.exit(1);
  }

  console.log("\n📦 Deploying NovaxVerificationModule...");
  console.log("   Oracle:", FUNCTIONS_ORACLE);
  console.log("   Source Hash:", FUNCTIONS_SOURCE_HASH);
  console.log("   Subscription ID:", FUNCTIONS_SUBSCRIPTION_ID);
  console.log("   Gas Limit:", FUNCTIONS_GAS_LIMIT);

  const NovaxVerificationModule = await ethers.getContractFactory("NovaxVerificationModule");
  const verificationModule = await NovaxVerificationModule.deploy(
    FUNCTIONS_ORACLE,
    FUNCTIONS_SOURCE_HASH,
    BigInt(FUNCTIONS_SUBSCRIPTION_ID),
    parseInt(FUNCTIONS_GAS_LIMIT)
  );
  await verificationModule.waitForDeployment();
  const verificationModuleAddress = await verificationModule.getAddress();
  console.log("✅ Verification Module deployed to:", verificationModuleAddress);

  // Link to Receivable Factory
  console.log("\n🔗 Linking to Receivable Factory...");
  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);
  
  const setVerificationModuleTx = await receivableFactory.setVerificationModule(verificationModuleAddress);
  await setVerificationModuleTx.wait();
  console.log("✅ Linked Verification Module to Receivable Factory");

  // Update deployment file
  deployment.contracts.NovaxVerificationModule = verificationModuleAddress;
  deployment.chainlink.FUNCTIONS_ORACLE = FUNCTIONS_ORACLE;
  deployment.chainlink.FUNCTIONS_SOURCE_HASH = FUNCTIONS_SOURCE_HASH;
  deployment.chainlink.FUNCTIONS_SUBSCRIPTION_ID = FUNCTIONS_SUBSCRIPTION_ID;
  deployment.chainlink.FUNCTIONS_GAS_LIMIT = FUNCTIONS_GAS_LIMIT;

  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log("\n💾 Updated deployment file:", deploymentFile);

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Verification Module Address:");
  console.log("   ", verificationModuleAddress);
  console.log("\n🔗 View on Explorer:");
  console.log(`   https://shadownet.explorer.etherlink.com/address/${verificationModuleAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

