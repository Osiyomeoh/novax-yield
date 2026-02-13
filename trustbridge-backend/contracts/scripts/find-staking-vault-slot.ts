import { ethers } from "hardhat";

/**
 * Find the correct storage slot for stakingVault
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔍 FINDING STAKING VAULT STORAGE SLOT\n");

  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";
  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";

  // Check multiple storage slots
  console.log("Checking storage slots 0-10...\n");
  
  for (let i = 0; i <= 10; i++) {
    try {
      const value = await ethers.provider.getStorage(POOL_MANAGER, i);
      if (value !== ethers.ZeroHash && value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        const address = "0x" + value.slice(-40);
        console.log(`Slot ${i}: ${value}`);
        console.log(`  Extracted address: ${address}`);
        
        // Check if it matches our staking vault address
        if (address.toLowerCase() === STAKING_VAULT.toLowerCase()) {
          console.log(`  ✅ FOUND! stakingVault is at slot ${i}`);
        }
        
        // Also check if it's a valid address format
        if (ethers.isAddress(address)) {
          console.log(`  (Valid address format)`);
        }
        console.log();
      }
    } catch (error) {
      // Skip errors
    }
  }

  console.log("✅ Storage scan complete!");
  console.log("\n💡 If stakingVault wasn't found, the contract structure might be different");
  console.log("   or the value needs to be set with proper permissions.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

