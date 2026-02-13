import { ethers } from "hardhat";

/**
 * Force set stakingVault in PoolManager
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔧 FORCE SETTING STAKING VAULT\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";

  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);

  console.log("Attempting to set stakingVault...");
  console.log("  PoolManager:", POOL_MANAGER);
  console.log("  StakingVault:", STAKING_VAULT);
  
  try {
    const setTx = await poolManager.setStakingVault(STAKING_VAULT);
    console.log("  Transaction sent:", setTx.hash);
    const receipt = await setTx.wait();
    console.log("  ✅ Transaction confirmed!");
    console.log("    Block:", receipt.blockNumber);
    console.log("    Gas used:", receipt.gasUsed.toString());
    
    // Try to verify by checking if we can now call a function that uses stakingVault
    console.log("\n✅ stakingVault should now be set!");
    console.log("   Next pool creation should trigger auto-deployment");
  } catch (error: any) {
    console.log("❌ Error:", error.message);
    if (error.message.includes("AccessControl") || error.message.includes("role")) {
      console.log("\n⚠️  Permission denied - deployer doesn't have ADMIN_ROLE");
      console.log("   Need to grant DEFAULT_ADMIN_ROLE to deployer first");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

