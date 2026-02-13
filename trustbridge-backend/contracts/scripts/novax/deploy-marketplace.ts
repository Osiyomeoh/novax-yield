import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

/**
 * Deploy NovaxMarketplace contract
 * This script can be run separately to deploy just the marketplace
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NovaxMarketplace with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Load existing deployment to get Pool Manager address
  const deploymentsDir = path.join(__dirname, "../../deployments");
  
  // Get network to find the right deployment file
  const currentNetwork = await ethers.provider.getNetwork();
  const chainId = Number(currentNetwork.chainId);
  
  // Try to find deployment file for current network
  let deploymentFile: string | null = null;
  
  // For Etherlink testnet (chainId 127823), look for etherlink deployment
  if (chainId === 127823) {
    const etherlinkFile = path.join(deploymentsDir, `novax-etherlink-${chainId}.json`);
    if (fs.existsSync(etherlinkFile)) {
      deploymentFile = etherlinkFile;
    }
  }
  
  // Fallback: find latest deployment file
  if (!deploymentFile) {
    const deploymentFiles = fs.readdirSync(deploymentsDir)
      .filter((f) => f.startsWith("novax-") && f.endsWith(".json"))
      .sort()
      .reverse();
    
    if (deploymentFiles.length === 0) {
      console.error("❌ No deployment file found. Please deploy contracts first:");
      console.error("   npm run deploy:novax:etherlink");
      process.exit(1);
    }
    
    deploymentFile = path.join(deploymentsDir, deploymentFiles[0]);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log(`📋 Using deployment: ${path.basename(deploymentFile)}`);
  console.log(`🌐 Network: ${deployment.network || "unknown"} (Chain ID: ${chainId})`);

  // Get addresses
  const poolManagerAddress = contracts.NovaxPoolManager;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address; // Default to deployer

  if (!poolManagerAddress || poolManagerAddress === ethers.ZeroAddress) {
    console.error("❌ NovaxPoolManager address not found in deployment file");
    process.exit(1);
  }

  console.log("\n📦 Deploying NovaxMarketplace...");
  console.log("   Pool Manager:", poolManagerAddress);
  console.log("   Fee Recipient:", feeRecipient);

  const NovaxMarketplace = await ethers.getContractFactory("NovaxMarketplace");
  const marketplace = await NovaxMarketplace.deploy(
    poolManagerAddress,
    feeRecipient
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ Marketplace deployed to:", marketplaceAddress);

  // Set USDC address
  console.log("\n⚙️  Configuring marketplace...");
  const usdcAddress = contracts.USDC || contracts.MockUSDC;
  if (usdcAddress && usdcAddress !== ethers.ZeroAddress) {
    const setUSDCTx = await marketplace.setUSDCAddress(usdcAddress);
    await setUSDCTx.wait();
    console.log("✅ USDC address set to:", usdcAddress);
  } else {
    console.log("⚠️  USDC address not found, set manually with setUSDCAddress()");
  }

  // Update deployment file
  deployment.contracts.NovaxMarketplace = marketplaceAddress;
  deployment.marketplace = {
    feeRecipient: feeRecipient,
    platformFeeBps: 250, // 2.5%
    royaltyFeeBps: 100,  // 1%
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log(`\n💾 Deployment info updated in: ${path.basename(deploymentFile)}`);

  console.log("\n✅ Marketplace deployment complete!");

  const explorerUrl = currentNetwork.chainId === 127823n 
    ? "https://shadownet.explorer.etherlink.com/address/"
    : "https://explorer.etherlink.com/address/";

  console.log("\n📋 Contract Address:");
  console.log("====================");
  console.log(`NovaxMarketplace: ${marketplaceAddress}`);
  console.log(`\n🔗 View on Explorer:`);
  console.log(`${explorerUrl}${marketplaceAddress}`);
  console.log("\n📝 Next Steps:");
  console.log("1. Grant ADMIN_ROLE to admin address (if needed)");
  console.log("2. Adjust fees with setFees() if needed");
  console.log("3. Start creating listings!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

