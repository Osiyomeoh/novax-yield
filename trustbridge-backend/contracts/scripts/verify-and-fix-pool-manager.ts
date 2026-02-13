import { ethers } from "hardhat";

/**
 * Verify and fix PoolManager configuration for auto-deployment
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔍 VERIFYING POOL MANAGER CONFIGURATION\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";
  const CAPACITY_MANAGER = "0xB1F97FF54F34e0552a889f4C841d6637574Ea554";

  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);
  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);

  console.log("Checking PoolManager configuration...\n");

  // Check if stakingVault is set (try different methods)
  let stakingVaultSet = false;
  let currentStakingVault = ethers.ZeroAddress;
  
  try {
    // Try public getter
    currentStakingVault = await poolManager.stakingVault();
    if (currentStakingVault !== ethers.ZeroAddress) {
      stakingVaultSet = true;
      console.log("✅ stakingVault is set:", currentStakingVault);
    } else {
      console.log("❌ stakingVault is NOT set (zero address)");
    }
  } catch (error: any) {
    console.log("⚠️  Could not read stakingVault getter:", error.message);
    console.log("   Trying to set it anyway...");
  }

  // Set stakingVault if not set correctly
  if (!stakingVaultSet || currentStakingVault.toLowerCase() !== STAKING_VAULT.toLowerCase()) {
    console.log("\n📝 Setting stakingVault in PoolManager...");
    try {
      const setVaultTx = await poolManager.setStakingVault(STAKING_VAULT);
      await setVaultTx.wait();
      console.log("✅ stakingVault set!");
      console.log("   Transaction hash:", setVaultTx.hash);
    } catch (error: any) {
      console.log("❌ Failed to set stakingVault:", error.message);
      if (error.message.includes("AccessControl")) {
        console.log("   ⚠️  Need ADMIN_ROLE to set stakingVault");
      }
    }
  }

  // Check capacity manager
  console.log("\nChecking capacity manager...");
  try {
    const currentCapacityManager = await poolManager.vaultCapacityManager();
    if (currentCapacityManager.toLowerCase() === CAPACITY_MANAGER.toLowerCase()) {
      console.log("✅ vaultCapacityManager is set:", currentCapacityManager);
    } else {
      console.log("⚠️  vaultCapacityManager is different:");
      console.log("   Expected:", CAPACITY_MANAGER);
      console.log("   Actual:", currentCapacityManager);
      
      console.log("\n📝 Setting vaultCapacityManager...");
      try {
        const setCapTx = await poolManager.setVaultCapacityManager(CAPACITY_MANAGER);
        await setCapTx.wait();
        console.log("✅ vaultCapacityManager set!");
      } catch (error: any) {
        console.log("❌ Failed to set vaultCapacityManager:", error.message);
      }
    }
  } catch (error: any) {
    console.log("⚠️  Could not read vaultCapacityManager:", error.message);
  }

  // Verify role in vault
  console.log("\nVerifying role in StakingVault...");
  const POOL_MANAGER_ROLE = await vault.POOL_MANAGER_ROLE();
  const hasRole = await vault.hasRole(POOL_MANAGER_ROLE, POOL_MANAGER);
  console.log("  PoolManager has POOL_MANAGER_ROLE:", hasRole);
  
  if (!hasRole) {
    console.log("  📝 Granting role...");
    try {
      const grantTx = await vault.grantRole(POOL_MANAGER_ROLE, POOL_MANAGER);
      await grantTx.wait();
      console.log("  ✅ Role granted!");
    } catch (error: any) {
      console.log("  ❌ Failed to grant role:", error.message);
    }
  }

  // Final verification
  console.log("\n" + "=".repeat(60));
  console.log("📊 FINAL STATUS");
  console.log("=".repeat(60));
  
  const vaultAnalytics = await vault.getVaultAnalytics();
  console.log("\nVault Status:");
  console.log("  Total Staked:", ethers.formatUnits(vaultAnalytics[0], 6), "USDC");
  console.log("  Deployed:", ethers.formatUnits(vaultAnalytics[1], 6), "USDC");
  console.log("  Available:", ethers.formatUnits(vaultAnalytics[2], 6), "USDC");
  console.log("  Utilization:", Number(vaultAnalytics[3]) / 100, "%");
  
  console.log("\n✅ Configuration check complete!");
  console.log("\n📝 Next: Create a pool and auto-deployment should trigger");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

