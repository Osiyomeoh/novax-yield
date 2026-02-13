import { ethers } from "hardhat";

/**
 * Fix auto-deployment by granting PoolManager the POOL_MANAGER_ROLE in StakingVault
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔧 FIXING AUTO-DEPLOYMENT\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";

  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);
  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);

  // Check if PoolManager has the role
  const POOL_MANAGER_ROLE = await vault.POOL_MANAGER_ROLE();
  const hasRole = await vault.hasRole(POOL_MANAGER_ROLE, POOL_MANAGER);
  
  console.log("Current Status:");
  console.log("  PoolManager address:", POOL_MANAGER);
  console.log("  Has POOL_MANAGER_ROLE:", hasRole);
  
  if (hasRole) {
    console.log("\n✅ PoolManager already has POOL_MANAGER_ROLE!");
    console.log("   Auto-deployment should work.");
  } else {
    console.log("\n❌ PoolManager does NOT have POOL_MANAGER_ROLE");
    console.log("   Granting role now...");
    
    // Grant the role
    const grantTx = await vault.grantRole(POOL_MANAGER_ROLE, POOL_MANAGER);
    await grantTx.wait();
    console.log("✅ Role granted!");
    console.log("   Transaction hash:", grantTx.hash);
    
    // Verify
    const nowHasRole = await vault.hasRole(POOL_MANAGER_ROLE, POOL_MANAGER);
    if (nowHasRole) {
      console.log("✅ Verified: PoolManager now has POOL_MANAGER_ROLE");
    } else {
      console.log("❌ Verification failed - role not granted");
    }
  }

  // Also check if PoolManager has stakingVault set
  console.log("\nChecking PoolManager configuration...");
  try {
    const stakingVaultInPoolManager = await poolManager.stakingVault();
    console.log("  PoolManager.stakingVault:", stakingVaultInPoolManager);
    
    if (stakingVaultInPoolManager.toLowerCase() === STAKING_VAULT.toLowerCase()) {
      console.log("  ✅ PoolManager correctly references StakingVault");
    } else {
      console.log("  ⚠️  PoolManager references different vault!");
      console.log("     Expected:", STAKING_VAULT);
      console.log("     Actual:", stakingVaultInPoolManager);
    }
  } catch (error: any) {
    console.log("  ⚠️  Could not read stakingVault from PoolManager:", error.message);
  }

  // Check if StakingVault has PoolManager set
  console.log("\nChecking StakingVault configuration...");
  try {
    // Check available amount
    const analytics = await vault.getVaultAnalytics();
    console.log("  Vault Analytics:");
    console.log("    Total Staked:", ethers.formatUnits(analytics[0], 6), "USDC");
    console.log("    Deployed:", ethers.formatUnits(analytics[1], 6), "USDC");
    console.log("    Available:", ethers.formatUnits(analytics[2], 6), "USDC");
    console.log("    Utilization:", Number(analytics[3]) / 100, "%");
    
    if (Number(analytics[2]) > 0) {
      console.log("  ✅ Vault has available capital for deployment");
    } else {
      console.log("  ⚠️  Vault has no available capital");
    }
  } catch (error: any) {
    console.log("  ⚠️  Error reading vault analytics:", error.message);
  }

  console.log("\n✅ Auto-deployment fix complete!");
  console.log("\n📝 Next Steps:");
  console.log("  1. Create a new pool");
  console.log("  2. Auto-deployment should trigger automatically");
  console.log("  3. Check vault analytics to confirm deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

