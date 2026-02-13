import { run, ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

async function main() {
  console.log("🔍 Verifying Novax contracts on Etherlink...\n");

  // Load deployment info
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const deploymentFiles = fs.readdirSync(deploymentsDir)
    .filter((f) => f.startsWith("novax-etherlink-") && f.endsWith(".json"))
    .sort()
    .reverse(); // Get most recent deployment

  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment file found. Please deploy contracts first.");
    process.exit(1);
  }

  const deploymentFile = path.join(deploymentsDir, deploymentFiles[0]);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log(`📋 Using deployment: ${deploymentFiles[0]}`);
  console.log(`🌐 Network: ${deployment.network} (Chain ID: ${deployment.chainId})\n`);

  // Etherlink Chainlink addresses from deployment
  const chainlink = deployment.chainlink || {};

  // Verification delay to avoid rate limiting
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Verify MockUSDC (no constructor args)
  if (contracts.USDC && contracts.USDC !== ethers.ZeroAddress) {
    console.log("📝 Verifying MockUSDC...");
    try {
      await run("verify:verify", {
        address: contracts.USDC,
        constructorArguments: [],
        network: "etherlink_testnet",
      });
      console.log("✅ MockUSDC verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ MockUSDC already verified\n");
      } else {
        console.log(`⚠️  MockUSDC verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 2. Verify NVXToken (no constructor args)
  if (contracts.NVXToken && contracts.NVXToken !== ethers.ZeroAddress) {
    console.log("📝 Verifying NVXToken...");
    try {
      await run("verify:verify", {
        address: contracts.NVXToken,
        constructorArguments: [],
        network: "etherlink_testnet",
      });
      console.log("✅ NVXToken verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NVXToken already verified\n");
      } else {
        console.log(`⚠️  NVXToken verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 3. Verify NovaxRwaFactory (no constructor args)
  if (contracts.NovaxRwaFactory && contracts.NovaxRwaFactory !== ethers.ZeroAddress) {
    console.log("📝 Verifying NovaxRwaFactory...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxRwaFactory,
        constructorArguments: [],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxRwaFactory verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxRwaFactory already verified\n");
      } else {
        console.log(`⚠️  NovaxRwaFactory verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 4. Verify NovaxReceivableFactory (no constructor args)
  if (contracts.NovaxReceivableFactory && contracts.NovaxReceivableFactory !== ethers.ZeroAddress) {
    console.log("📝 Verifying NovaxReceivableFactory...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxReceivableFactory,
        constructorArguments: [],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxReceivableFactory verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxReceivableFactory already verified\n");
      } else {
        console.log(`⚠️  NovaxReceivableFactory verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 5. Verify NovaxPoolManager (constructor: usdcToken address)
  if (contracts.NovaxPoolManager && contracts.NovaxPoolManager !== ethers.ZeroAddress) {
    console.log("📝 Verifying NovaxPoolManager...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxPoolManager,
        constructorArguments: [contracts.USDC],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxPoolManager verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxPoolManager already verified\n");
      } else {
        console.log(`⚠️  NovaxPoolManager verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 6. Verify NovaxPriceManager (constructor: 4 price feed addresses)
  if (contracts.NovaxPriceManager && contracts.NovaxPriceManager !== ethers.ZeroAddress) {
    console.log("📝 Verifying NovaxPriceManager...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxPriceManager,
        constructorArguments: [
          chainlink.ETH_USD || ethers.ZeroAddress,
          chainlink.BTC_USD || ethers.ZeroAddress,
          chainlink.USDC_USD || ethers.ZeroAddress,
          chainlink.LINK_USD || ethers.ZeroAddress,
        ],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxPriceManager verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxPriceManager already verified\n");
      } else {
        console.log(`⚠️  NovaxPriceManager verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 7. Verify NovaxFallbackLibrary (no constructor args)
  if (contracts.NovaxFallbackLibrary && contracts.NovaxFallbackLibrary !== ethers.ZeroAddress) {
    console.log("📝 Verifying NovaxFallbackLibrary...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxFallbackLibrary,
        constructorArguments: [],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxFallbackLibrary verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxFallbackLibrary already verified\n");
      } else {
        console.log(`⚠️  NovaxFallbackLibrary verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 8. Verify NovaxVRFModule (if deployed)
  if (
    contracts.NovaxVRFModule &&
    contracts.NovaxVRFModule !== ethers.ZeroAddress &&
    chainlink.VRF_COORDINATOR !== ethers.ZeroAddress
  ) {
    console.log("📝 Verifying NovaxVRFModule...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxVRFModule,
        constructorArguments: [
          chainlink.VRF_COORDINATOR,
          chainlink.VRF_KEY_HASH,
          BigInt(chainlink.VRF_SUBSCRIPTION_ID || "0"),
        ],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxVRFModule verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxVRFModule already verified\n");
      } else {
        console.log(`⚠️  NovaxVRFModule verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  // 9. Verify NovaxVerificationModule (if deployed)
  if (
    contracts.NovaxVerificationModule &&
    contracts.NovaxVerificationModule !== ethers.ZeroAddress &&
    chainlink.FUNCTIONS_ORACLE !== ethers.ZeroAddress
  ) {
    console.log("📝 Verifying NovaxVerificationModule...");
    try {
      await run("verify:verify", {
        address: contracts.NovaxVerificationModule,
        constructorArguments: [
          chainlink.FUNCTIONS_ORACLE,
          chainlink.FUNCTIONS_SOURCE_HASH,
          BigInt(chainlink.FUNCTIONS_SUBSCRIPTION_ID || "0"),
          parseInt(chainlink.FUNCTIONS_GAS_LIMIT || "100000"),
        ],
        network: "etherlink_testnet",
      });
      console.log("✅ NovaxVerificationModule verified\n");
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log("✅ NovaxVerificationModule already verified\n");
      } else {
        console.log(`⚠️  NovaxVerificationModule verification failed: ${error.message}\n`);
      }
    }
    await delay(2000);
  }

  console.log("=".repeat(60));
  console.log("✅ Verification process complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Verified Contract Addresses:");
  console.log("====================");
  if (contracts.USDC) console.log(`MockUSDC: ${contracts.USDC}`);
  if (contracts.NVXToken) console.log(`NVXToken: ${contracts.NVXToken}`);
  if (contracts.NovaxRwaFactory) console.log(`RWA Factory: ${contracts.NovaxRwaFactory}`);
  if (contracts.NovaxReceivableFactory) console.log(`Receivable Factory: ${contracts.NovaxReceivableFactory}`);
  if (contracts.NovaxPoolManager) console.log(`Pool Manager: ${contracts.NovaxPoolManager}`);
  if (contracts.NovaxPriceManager) console.log(`Price Manager: ${contracts.NovaxPriceManager}`);
  if (contracts.NovaxFallbackLibrary) console.log(`Fallback Library: ${contracts.NovaxFallbackLibrary}`);
  if (contracts.NovaxVRFModule && contracts.NovaxVRFModule !== ethers.ZeroAddress) {
    console.log(`VRF Module: ${contracts.NovaxVRFModule}`);
  }
  if (contracts.NovaxVerificationModule && contracts.NovaxVerificationModule !== ethers.ZeroAddress) {
    console.log(`Verification Module: ${contracts.NovaxVerificationModule}`);
  }
  console.log("\n🔗 View on Etherlink Explorer:");
  console.log(`https://shadownet.explorer.etherlink.com/address/`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

