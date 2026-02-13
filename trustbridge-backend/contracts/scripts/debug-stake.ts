import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔍 Debugging Stake Function");
  console.log("Account:", deployer.address, "\n");

  const STAKING_VAULT = "0xE89511C2c2E56a5e6e1718e4f130463247dc4622";
  const CAPACITY_MANAGER = "0x828d9581e0607a2f91D5c2954C82f40693319230";
  const USDC = "0xC449434dcf6Faca53595b4B020568Ef01FEA23a5";

  const stakingVault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);
  const capacityManager = await ethers.getContractAt("VaultCapacityManager", CAPACITY_MANAGER);
  const usdc = await ethers.getContractAt("MockUSDC", USDC);

  const amount = ethers.parseUnits("5000", 6);

  console.log("1. Check USDC balance...");
  const balance = await usdc.balanceOf(deployer.address);
  console.log("  Balance:", ethers.formatUnits(balance, 6), "USDC");

  console.log("\n2. Check USDC allowance...");
  const allowance = await usdc.allowance(deployer.address, STAKING_VAULT);
  console.log("  Allowance:", ethers.formatUnits(allowance, 6), "USDC");

  console.log("\n3. Check capacity manager...");
  const capacityMgrAddress = await stakingVault.vaultCapacityManager();
  console.log("  Set in vault:", capacityMgrAddress);
  console.log("  Matches deployment:", capacityMgrAddress.toLowerCase() === CAPACITY_MANAGER.toLowerCase());

  console.log("\n4. Check canStake...");
  try {
    const [canStake, shouldWaitlist] = await capacityManager.canStake(amount);
    console.log("  Can Stake:", canStake);
    console.log("  Should Waitlist:", shouldWaitlist);
  } catch (error: any) {
    console.log("  ❌ canStake failed:", error.message);
  }

  console.log("\n5. Check tier config...");
  try {
    const tierConfig = await stakingVault.tierConfigs(1); // GOLD
    console.log("  GOLD tier:");
    console.log("    Lock Period:", Number(tierConfig.lockPeriod) / (24 * 60 * 60), "days");
    console.log("    Base APY:", Number(tierConfig.baseApyBps) / 100, "%");
    console.log("    Bonus:", Number(tierConfig.tierBonusBps) / 100, "%");
    console.log("    Min Stake:", ethers.formatUnits(tierConfig.minStake, 6), "USDC");
  } catch (error: any) {
    console.log("  ❌ Failed:", error.message);
  }

  console.log("\n6. Try calling stake with call (no transaction)...");
  try {
    await stakingVault.stake.staticCall(amount, 1, true);
    console.log("  ✅ Static call succeeded - should work!");
  } catch (error: any) {
    console.log("  ❌ Static call failed:", error);
    
    // Try to decode error
    if (error.data) {
      console.log("  Error data:", error.data);
    }
  }

  console.log("\n7. Checking if vault is paused...");
  try {
    const isPaused = await stakingVault.paused();
    console.log("  Paused:", isPaused);
  } catch (error: any) {
    console.log("  ❌ Failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

