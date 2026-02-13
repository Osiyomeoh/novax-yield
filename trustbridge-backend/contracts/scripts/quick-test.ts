import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🧪 Quick Test - Efficient Getters\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";
  const USDC = "0xC449434dcf6Faca53595b4B020568Ef01FEA23a5";

  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);
  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);
  const usdc = await ethers.getContractAt("MockUSDC", USDC);

  // Test 1: Vault Analytics (1 call)
  console.log("1️⃣ Testing getVaultAnalytics() - All vault data in 1 call:");
  const analytics = await vault.getVaultAnalytics();
  console.log("  ✅ Total Staked:", ethers.formatUnits(analytics[0], 6), "USDC");
  console.log("  ✅ Deployed:", ethers.formatUnits(analytics[1], 6), "USDC");
  console.log("  ✅ Available:", ethers.formatUnits(analytics[2], 6), "USDC");
  console.log("  ✅ Utilization:", Number(analytics[3]) / 100, "%");
  console.log("  ✅ Active Pools:", Number(analytics[5]));

  // Test 2: User Dashboard (1 call)
  console.log("\n2️⃣ Testing getUserDashboard() - All user data in 1 call:");
  const dashboard = await vault.getUserDashboard(deployer.address);
  console.log("  ✅ User Total Staked:", ethers.formatUnits(dashboard[0], 6), "USDC");
  console.log("  ✅ Pending Yield:", ethers.formatUnits(dashboard[1], 6), "USDC");
  console.log("  ✅ Active Stakes:", Number(dashboard[2]));
  console.log("  ✅ Stakes Count:", dashboard[3].length);

  // Test 3: All Tier Configs (1 call)
  console.log("\n3️⃣ Testing getAllTierConfigs() - All tiers in 1 call:");
  const [silver, gold, platinum, diamond] = await vault.getAllTierConfigs();
  console.log("  ✅ SILVER:", Number(gold.baseApyBps + gold.tierBonusBps) / 100, "% APY");
  console.log("  ✅ GOLD:", Number(gold.baseApyBps + gold.tierBonusBps) / 100, "% APY");
  console.log("  ✅ PLATINUM:", Number(platinum.baseApyBps + platinum.tierBonusBps) / 100, "% APY");
  console.log("  ✅ DIAMOND:", Number(diamond.baseApyBps + diamond.tierBonusBps) / 100, "% APY");

  // Test 4: Active Pools (1 call)
  console.log("\n4️⃣ Testing getActivePools() - Filtered pools in 1 call:");
  const [activePools, activePoolIds] = await poolManager.getActivePools();
  console.log("  ✅ Active Pools Count:", activePools.length);
  
  // Test 5: Stake to test auto-deploy
  console.log("\n5️⃣ Testing Stake:");
  const stakeAmount = ethers.parseUnits("5000", 6);
  const balance = await usdc.balanceOf(deployer.address);
  console.log("  USDC Balance:", ethers.formatUnits(balance, 6));
  
  if (balance >= stakeAmount) {
    const approveTx = await usdc.approve(STAKING_VAULT, stakeAmount);
    await approveTx.wait();
    console.log("  ✅ Approved");
    
    const stakeTx = await vault.stake(stakeAmount, 1, true);
    await stakeTx.wait();
    console.log("  ✅ Staked $5,000!");
    
    // Check vault status again
    const newAnalytics = await vault.getVaultAnalytics();
    console.log("  📊 New Vault Total:", ethers.formatUnits(newAnalytics[0], 6), "USDC");
  } else {
    console.log("  ⚠️  Insufficient USDC");
  }

  console.log("\n✅ Quick test complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

