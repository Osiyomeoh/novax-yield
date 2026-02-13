import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Check deployed contract bytecode to determine compiler settings
 */

async function main() {
  console.log("🔍 Checking deployed contract bytecode...\n");

  // Load deployment info
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const deploymentFiles = fs.readdirSync(deploymentsDir)
    .filter((f) => f.startsWith("novax-etherlink-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment file found.");
    process.exit(1);
  }

  const deploymentFile = path.join(deploymentsDir, deploymentFiles[0]);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log(`📋 Using deployment: ${deploymentFiles[0]}\n`);

  // Check MockUSDC
  if (contracts.USDC) {
    console.log("📝 Checking MockUSDC bytecode...");
    console.log(`   Address: ${contracts.USDC}`);
    
    try {
      const code = await ethers.provider.getCode(contracts.USDC);
      console.log(`   Bytecode length: ${code.length} characters`);
      console.log(`   Bytecode size: ${(code.length - 2) / 2} bytes`);
      
      // Extract compiler metadata (last bytes)
      // Solidity compiler metadata is typically at the end
      const metadataStart = code.lastIndexOf("a2646970667358221220");
      if (metadataStart !== -1) {
        console.log(`   ✅ Found compiler metadata`);
        const metadata = code.slice(metadataStart);
        console.log(`   Metadata length: ${metadata.length} characters`);
        
        // Try to decode metadata to get compiler version
        // Metadata format: 0xa2 0x64 'ipfs' 0x12 0x20 <32 bytes hash>
        // Then: 0x64 'solc' <version> <settings>
        console.log(`\n   💡 Metadata found - this contains compiler version info`);
        console.log(`   The explorer should be able to extract this automatically`);
      } else {
        console.log(`   ⚠️  No compiler metadata found in bytecode`);
      }
      
      // Check if bytecode matches local compilation
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const localBytecode = MockUSDC.bytecode;
      console.log(`\n   Local bytecode length: ${localBytecode.length} characters`);
      console.log(`   Local bytecode size: ${(localBytecode.length - 2) / 2} bytes`);
      
      if (code === localBytecode) {
        console.log(`   ✅ Bytecode matches local compilation!`);
      } else {
        console.log(`   ⚠️  Bytecode does NOT match local compilation`);
        console.log(`   This means deployment used different compiler settings`);
        console.log(`\n   🔧 Try these compiler versions:`);
        console.log(`   1. 0.8.20 (current)`);
        console.log(`   2. 0.8.28 (with viaIR)`);
        console.log(`   3. Check if optimization was different`);
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("💡 Recommendations:");
  console.log("=".repeat(60));
  console.log("\n1. Try compiler version 0.8.28 (with viaIR enabled)");
  console.log("2. Try without optimization (temporarily)");
  console.log("3. Check if EVM version needs to be specified differently");
  console.log("4. Try 'london' or 'paris' EVM version explicitly");
  console.log("5. Use Standard JSON Input method for more control");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

