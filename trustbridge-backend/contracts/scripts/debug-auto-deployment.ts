import { ethers } from "hardhat";

/**
 * Debug why auto-deployment isn't working
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🐛 DEBUGGING AUTO-DEPLOYMENT\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";

  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);
  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);

  console.log("1. Checking if stakingVault is set in PoolManager...");
  // Try to read the storage slot directly
  try {
    // Storage slot for stakingVault (assuming it's after other address variables)
    // This is a hack - we'll try slot 4 (after usdcToken, nvxToken, platformTreasury, amc)
    const stakingVaultSlot = 4;
    const stakingVaultValue = await ethers.provider.getStorage(POOL_MANAGER, stakingVaultSlot);
    console.log("   Storage slot", stakingVaultSlot, ":", stakingVaultValue);
    
    if (stakingVaultValue === ethers.ZeroHash || stakingVaultValue === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("   ❌ stakingVault is ZERO (not set!)");
      console.log("   📝 Setting it now...");
      
      // Check if deployer has admin role
      const DEFAULT_ADMIN_ROLE = await poolManager.DEFAULT_ADMIN_ROLE();
      const hasAdminRole = await poolManager.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
      console.log("   Deployer has ADMIN_ROLE:", hasAdminRole);
      
      if (hasAdminRole) {
        const setTx = await poolManager.setStakingVault(STAKING_VAULT);
        await setTx.wait();
        console.log("   ✅ Set stakingVault!");
        
        // Verify
        const newValue = await ethers.provider.getStorage(POOL_MANAGER, stakingVaultSlot);
        console.log("   New value:", newValue);
        if (newValue.toLowerCase().slice(-40) === STAKING_VAULT.toLowerCase().slice(2)) {
          console.log("   ✅ Verified: stakingVault is now set!");
        }
      } else {
        console.log("   ❌ Deployer doesn't have ADMIN_ROLE to set stakingVault");
      }
    } else {
      const extractedAddress = "0x" + stakingVaultValue.slice(-40);
      console.log("   ✅ stakingVault is set:", extractedAddress);
      if (extractedAddress.toLowerCase() !== STAKING_VAULT.toLowerCase()) {
        console.log("   ⚠️  But it's different from expected:", STAKING_VAULT);
      }
    }
  } catch (error: any) {
    console.log("   ⚠️  Error reading storage:", error.message);
  }

  console.log("\n2. Checking vault permissions...");
  const POOL_MANAGER_ROLE = await vault.POOL_MANAGER_ROLE();
  const hasRole = await vault.hasRole(POOL_MANAGER_ROLE, POOL_MANAGER);
  console.log("   PoolManager has POOL_MANAGER_ROLE:", hasRole);
  
  console.log("\n3. Checking vault capital...");
  const analytics = await vault.getVaultAnalytics();
  console.log("   Available:", ethers.formatUnits(analytics[2], 6), "USDC");
  
  console.log("\n✅ Debug complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

