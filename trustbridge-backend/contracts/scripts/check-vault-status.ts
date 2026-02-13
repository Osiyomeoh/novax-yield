import { ethers } from "hardhat";

/**
 * Check vault status to see why deployToPool might be failing
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔍 CHECKING VAULT STATUS\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";

  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);

  console.log("1. Checking if vault is paused...");
  try {
    const isPaused = await vault.paused();
    console.log("   Paused:", isPaused);
    if (isPaused) {
      console.log("   ❌ Vault is PAUSED - this will prevent deployToPool!");
      console.log("   📝 Need to unpause the vault");
    } else {
      console.log("   ✅ Vault is not paused");
    }
  } catch (error: any) {
    console.log("   ⚠️  Error checking pause status:", error.message);
  }

  console.log("\n2. Checking available capital...");
  const analytics = await vault.getVaultAnalytics();
  console.log("   Total Staked:", ethers.formatUnits(analytics[0], 6), "USDC");
  console.log("   Deployed:", ethers.formatUnits(analytics[1], 6), "USDC");
  console.log("   Available:", ethers.formatUnits(analytics[2], 6), "USDC");
  
  if (Number(analytics[2]) < 10000) {
    console.log("   ❌ Not enough capital for $10k deployment");
  } else {
    console.log("   ✅ Enough capital available");
  }

  console.log("\n3. Checking role...");
  const POOL_MANAGER_ROLE = await vault.POOL_MANAGER_ROLE();
  const hasRole = await vault.hasRole(POOL_MANAGER_ROLE, POOL_MANAGER);
  console.log("   PoolManager has POOL_MANAGER_ROLE:", hasRole);

  console.log("\n✅ Status check complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

