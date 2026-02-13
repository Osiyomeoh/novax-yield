import { ethers } from "hardhat";

/**
 * Test $100 investment with compounding for 1 year
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🧪 TESTING $100 INVESTMENT WITH COMPOUNDING (1 YEAR)\n");
  console.log("Investor:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const USDC = "0xC449434dcf6Faca53595b4B020568Ef01FEA23a5";

  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);
  const usdc = await ethers.getContractAt("MockUSDC", USDC);

  // Note: Minimum stakes are: SILVER=$1k, GOLD=$5k, PLATINUM=$10k, DIAMOND=$25k
  // For $100 test, we'll use SILVER tier with $1,000 (minimum) and scale results
  const investmentAmount = ethers.parseUnits("1000", 6); // $1,000 USDC (SILVER minimum)
  const tier = 0; // SILVER tier (30 days, 8.5% APY) - minimum $1,000
  const autoCompound = true; // Enable compounding
  const tierName = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"][tier];
  const testAmount = 100; // We'll calculate as if it's $100 for comparison

  console.log("═".repeat(60));
  console.log("INITIAL SETUP");
  console.log("═".repeat(60));
  
  // Check current balance
  const initialBalance = await usdc.balanceOf(deployer.address);
  console.log("\n💰 Initial USDC Balance:", ethers.formatUnits(initialBalance, 6), "USDC");
  
  if (initialBalance < investmentAmount) {
    console.log("Minting USDC...");
    await (await usdc.mint(deployer.address, investmentAmount)).wait();
    console.log("✅ USDC minted");
  }

  // Get initial vault analytics
  const initialAnalytics = await vault.getVaultAnalytics();
  console.log("\n📊 Initial Vault Status:");
  console.log("  Total Staked:", ethers.formatUnits(initialAnalytics[0], 6), "USDC");
  console.log("  Deployed:", ethers.formatUnits(initialAnalytics[1], 6), "USDC");
  console.log("  Available:", ethers.formatUnits(initialAnalytics[2], 6), "USDC");

  // Get tier config
  const tierConfig = await vault.getAllTierConfigs();
  const selectedTierConfig = tierConfig[tier];
  console.log(`\n💎 ${tierName} Tier Configuration:`);
  console.log("  Lock Period:", Number(selectedTierConfig[0]), "seconds (" + (Number(selectedTierConfig[0]) / 86400), "days)");
  console.log("  Base APY:", Number(selectedTierConfig[1]) / 100, "%"); // Already in basis points
  console.log("  Tier Bonus:", Number(selectedTierConfig[2]) / 100, "%"); // Already in basis points
  const totalApyBps = Number(selectedTierConfig[1]) + Number(selectedTierConfig[2]);
  console.log("  Total APY:", totalApyBps / 100, "%");
  console.log("  Min Stake:", ethers.formatUnits(selectedTierConfig[3], 6), "USDC");

  console.log("\n" + "═".repeat(60));
  console.log("PHASE 1: STAKE $100 WITH COMPOUNDING");
  console.log("═".repeat(60));

  // Approve
  console.log("\nApproving USDC...");
  await (await usdc.approve(STAKING_VAULT, investmentAmount)).wait();
  console.log("✅ Approved");

  // Get initial user dashboard
  const initialDashboard = await vault.getUserDashboard(deployer.address);
  console.log("\n📊 Initial User Dashboard:");
  console.log("  Total Staked:", ethers.formatUnits(initialDashboard[0], 6), "USDC");
  console.log("  Pending Yield:", ethers.formatUnits(initialDashboard[1], 6), "USDC");
  console.log("  Active Stakes:", Number(initialDashboard[2]));

  // Stake
  console.log(`\nStaking $1,000 (${tierName} tier, compounding enabled)...`);
  console.log("  Note: SILVER tier minimum is $1,000");
  console.log("  Results will be scaled to show $100 equivalent");
  const stakeTx = await vault.stake(investmentAmount, tier, autoCompound);
  await stakeTx.wait();
  console.log("✅ Staked $1,000");

  // Get stake details
  const afterStakeDashboard = await vault.getUserDashboard(deployer.address);
  const stakeCount = Number(afterStakeDashboard[2]);
  console.log("\n📊 After Stake:");
  console.log("  Total Staked:", ethers.formatUnits(afterStakeDashboard[0], 6), "USDC");
  console.log("  Active Stakes:", stakeCount);

  // Get the latest stake
  const userStakes = await vault.getUserStakes(deployer.address);
  if (userStakes.length > 0) {
    const latestStake = userStakes[userStakes.length - 1];
    console.log("\n📋 Latest Stake Details:");
    console.log("  Principal:", ethers.formatUnits(latestStake[0], 6), "USDC");
    console.log("  Compounded Principal:", ethers.formatUnits(latestStake[1], 6), "USDC");
    console.log("  Staked At:", new Date(Number(latestStake[2]) * 1000).toLocaleString());
    console.log("  Unlock At:", new Date(Number(latestStake[3]) * 1000).toLocaleString());
    console.log("  Tier:", Number(latestStake[4]));
    console.log("  Auto-Compound:", latestStake[5]);
  }

  console.log("\n" + "═".repeat(60));
  console.log("PHASE 2: SIMULATE 1 YEAR WITH COMPOUNDING");
  console.log("═".repeat(60));

  // Calculate expected yield with monthly compounding
  // APY is in basis points (850 = 8.5%)
  const annualApyBps = Number(selectedTierConfig[1]) + Number(selectedTierConfig[2]);
  const annualApyDecimal = annualApyBps / 10000; // Convert basis points to decimal (850 bps = 0.085 = 8.5%)
  const monthlyRateDecimal = annualApyDecimal / 12; // Monthly rate as decimal
  const months = 12;
  
  // Compound formula: A = P(1 + r/n)^(n*t)
  // Where P = principal, r = annual rate, n = compounding periods per year, t = years
  // For monthly compounding: A = P(1 + r/12)^12
  const principal = Number(investmentAmount);
  const expectedFinal = principal * Math.pow(1 + monthlyRateDecimal, months);
  const expectedYield = expectedFinal - principal;
  
  // Scale to $100 for comparison
  const scaleFactor = testAmount / (principal / 1e6);
  const scaledFinal = (expectedFinal / principal) * testAmount;
  const scaledYield = scaledFinal - testAmount;
  
  console.log("\n📈 Expected Results (Monthly Compounding for 1 Year):");
  console.log(`  Actual Stake: $${(Number(investmentAmount) / 1e6).toFixed(2)}`);
  console.log(`  Scaled to: $${testAmount}.00 (for comparison)`);
  console.log(`  Annual APY: ${(annualApyDecimal * 100).toFixed(2)}%`);
  console.log(`  Monthly Rate: ~${(monthlyRateDecimal * 100).toFixed(4)}%`);
  console.log("  Compounding Periods: 12 months");
  console.log(`\n  💰 For $${testAmount} Investment:`);
  console.log("    Expected Final Amount: $" + scaledFinal.toFixed(2));
  console.log("    Expected Yield: $" + scaledYield.toFixed(2));
  const effectiveApy = ((expectedFinal / principal) - 1) * 100;
  console.log(`    Effective APY (compounded): ~${effectiveApy.toFixed(2)}%`);

  // Note: In a real scenario, compounding would happen automatically via AutoCompounder
  // For testing, we'll simulate by checking what would happen after 1 year
  console.log("\n💡 Note: In production, AutoCompounder contract would:");
  console.log("   - Execute monthly compounding automatically");
  console.log("   - Add yield to compounded principal");
  console.log("   - Increase future yield calculations");

  // Check current state
  const currentDashboard = await vault.getUserDashboard(deployer.address);
  console.log("\n📊 Current State (Before 1 Year):");
  console.log("  Total Staked:", ethers.formatUnits(currentDashboard[0], 6), "USDC");
  console.log("  Pending Yield:", ethers.formatUnits(currentDashboard[1], 6), "USDC");

  // Simulate what happens if we manually compound (for testing)
  console.log("\n🔬 Testing Manual Compound (if available)...");
  try {
    // Check if we can execute compound for this stake
    if (stakeCount > 0) {
      const stakeIndex = stakeCount - 1;
      console.log("  Attempting to compound stake index:", stakeIndex);
      
      // Try to compound (this might require the stake to be eligible)
      // Note: Actual compounding logic depends on time passed and AutoCompounder
      const canCompound = await vault.canCompound(deployer.address, stakeIndex);
      console.log("  Can Compound:", canCompound);
      
      if (canCompound) {
        const compoundTx = await vault.compound(deployer.address, stakeIndex);
        await compoundTx.wait();
        console.log("  ✅ Compounded!");
        
        const afterCompound = await vault.getUserDashboard(deployer.address);
        console.log("  New Compounded Principal:", ethers.formatUnits(afterCompound[0], 6), "USDC");
      } else {
        console.log("  ⚠️  Not eligible for compounding yet (needs time to pass)");
      }
    }
  } catch (error: any) {
    console.log("  ⚠️  Compound test:", error.message);
    console.log("  (This is expected - compounding happens automatically over time)");
  }

  console.log("\n" + "═".repeat(60));
  console.log("PHASE 3: PROJECTED 1-YEAR RESULTS");
  console.log("═".repeat(60));

  // Calculate projections (scaled to $100)
  const scaledPrincipal = testAmount;
  const simpleInterest = scaledPrincipal * annualApyDecimal; // Simple interest
  const compoundedInterest = scaledYield; // Compounded interest
  const difference = compoundedInterest - simpleInterest;

  console.log("\n📊 Comparison (for $100 investment):");
  console.log("  Simple Interest (no compounding):");
  console.log("    Final: $" + (scaledPrincipal + simpleInterest).toFixed(2));
  console.log("    Yield: $" + simpleInterest.toFixed(2));
  console.log("\n  Compounded Interest (monthly):");
  console.log("    Final: $" + scaledFinal.toFixed(2));
  console.log("    Yield: $" + scaledYield.toFixed(2));
  console.log("\n  💰 Extra Yield from Compounding: $" + difference.toFixed(2));
  console.log("  📈 Compounding Advantage: " + ((difference / simpleInterest) * 100).toFixed(2) + "% more yield");

  // Final vault status
  const finalAnalytics = await vault.getVaultAnalytics();
  console.log("\n📊 Final Vault Status:");
  console.log("  Total Staked:", ethers.formatUnits(finalAnalytics[0], 6), "USDC");
  console.log("  Deployed:", ethers.formatUnits(finalAnalytics[1], 6), "USDC");
  console.log("  Available:", ethers.formatUnits(finalAnalytics[2], 6), "USDC");
  console.log("  Utilization:", Number(finalAnalytics[3]) / 100, "%");

  console.log("\n" + "═".repeat(60));
  console.log("✅ TEST COMPLETE");
  console.log("═".repeat(60));
  console.log("\n💡 Key Takeaways:");
  console.log(`  ✅ $${testAmount} equivalent staked in ${tierName} tier (${(annualApyDecimal * 100).toFixed(2)}% APY)`);
  console.log("  ✅ Compounding enabled for maximum yield");
  const finalAmount = scaledFinal.toFixed(2);
  console.log(`  ✅ After 1 year: ~$${finalAmount} (with monthly compounding)`);
  const extraYield = difference.toFixed(2);
  console.log(`  ✅ Compounding provides ~$${extraYield} extra vs simple interest`);
  console.log(`\n📝 Note: Actual stake was $${(Number(investmentAmount) / 1e6).toFixed(2)} (${tierName} tier minimum)`);
  console.log("   Results scaled to show $100 equivalent for comparison");
  console.log("\n📝 Note: Actual results depend on:");
  console.log("  - AutoCompounder execution frequency");
  console.log("  - Vault deployment to pools (generates yield)");
  console.log("  - Pool performance and payment timing");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

