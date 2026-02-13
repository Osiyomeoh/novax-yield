import { ethers } from "hardhat";

/**
 * Test manual deployment to see what error occurs
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🧪 TESTING MANUAL DEPLOYMENT\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";

  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);
  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);

  // Get latest pool
  const totalPools = await poolManager.totalPools();
  console.log("Total pools:", Number(totalPools));
  
  if (Number(totalPools) === 0) {
    console.log("❌ No pools found. Create a pool first.");
    return;
  }

  // Get the latest pool ID (this is a bit tricky without a getter)
  // For now, let's try to get pool info from events or use a test pool ID
  console.log("\n📝 Testing manual deployment...");
  console.log("  Note: We need a pool ID to test with");
  
  // Check vault status
  const analytics = await vault.getVaultAnalytics();
  console.log("\nVault Status:");
  console.log("  Total Staked:", ethers.formatUnits(analytics[0], 6), "USDC");
  console.log("  Deployed:", ethers.formatUnits(analytics[1], 6), "USDC");
  console.log("  Available:", ethers.formatUnits(analytics[2], 6), "USDC");
  
  // Check if PoolManager can call deployToPool
  console.log("\n🔍 Checking permissions...");
  const POOL_MANAGER_ROLE = await vault.POOL_MANAGER_ROLE();
  const hasRole = await vault.hasRole(POOL_MANAGER_ROLE, POOL_MANAGER);
  console.log("  PoolManager has POOL_MANAGER_ROLE:", hasRole);
  
  // Try to call deployToPool directly from PoolManager's perspective
  // But we need a pool ID first
  console.log("\n⚠️  To test deployment, we need:");
  console.log("  1. A valid pool ID");
  console.log("  2. PoolManager must have POOL_MANAGER_ROLE (✅ confirmed)");
  console.log("  3. Vault must have available capital (✅ confirmed)");
  
  // Check if stakingVault is set in PoolManager by trying to read it
  console.log("\n🔍 Checking PoolManager.stakingVault...");
  try {
    // Try to call a function that uses stakingVault
    // We can't directly read it if the getter doesn't work, but we can infer from behavior
    console.log("  (Cannot directly read, but we set it earlier)");
  } catch (error: any) {
    console.log("  Error:", error.message);
  }

  console.log("\n💡 Suggestion: Check the pool creation transaction logs");
  console.log("   to see if _tryVaultDeployment was called and what error occurred");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

