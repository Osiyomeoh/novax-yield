import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🔄 Updating APY Rates to Sustainable Levels...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Updating with account:", deployer.address);
  console.log("");

  // Load tokenomics deployment
  const tokenomicsDeploymentPath = path.join(__dirname, "../deployments/nvx-tokenomics.json");
  let tokenomicsInfo: any = {};

  try {
    const tokenomicsData = fs.readFileSync(tokenomicsDeploymentPath, "utf-8");
    tokenomicsInfo = JSON.parse(tokenomicsData);
    console.log("✅ Loaded tokenomics deployment");
  } catch (error) {
    console.error("❌ Failed to load tokenomics deployment");
    process.exit(1);
  }

  const stakingAddress = tokenomicsInfo.contracts?.NVXStaking?.address;
  if (!stakingAddress || stakingAddress === ethers.ZeroAddress) {
    console.error("❌ NVXStaking address not found");
    process.exit(1);
  }

  console.log("📋 Staking Contract:", stakingAddress);
  console.log("");

  // Get contract instance
  const NVXStaking = await ethers.getContractFactory("NVXStaking");
  const staking = NVXStaking.attach(stakingAddress);

  // Check current rates
  console.log("📊 Current APY Rates:");
  const oneMonth = await staking.stakingConfigs(0);
  const threeMonth = await staking.stakingConfigs(1);
  const sixMonth = await staking.stakingConfigs(2);
  const twelveMonth = await staking.stakingConfigs(3);

  console.log("   1 Month:", Number(oneMonth.apyBps) / 100, "%");
  console.log("   3 Months:", Number(threeMonth.apyBps) / 100, "%");
  console.log("   6 Months:", Number(sixMonth.apyBps) / 100, "%");
  console.log("   12 Months:", Number(twelveMonth.apyBps) / 100, "%");
  console.log("");

  // New sustainable rates
  const newRates = {
    0: { apyBps: 300, lockPeriod: 30 * 24 * 60 * 60, minStake: 100n * 10n**18n, penalty: 5000 }, // 3%
    1: { apyBps: 600, lockPeriod: 90 * 24 * 60 * 60, minStake: 500n * 10n**18n, penalty: 5000 }, // 6%
    2: { apyBps: 900, lockPeriod: 180 * 24 * 60 * 60, minStake: 1000n * 10n**18n, penalty: 5000 }, // 9%
    3: { apyBps: 1500, lockPeriod: 365 * 24 * 60 * 60, minStake: 5000n * 10n**18n, penalty: 5000 }, // 15%
  };

  console.log("🔄 Updating to Sustainable APY Rates:");
  console.log("   1 Month: 3%");
  console.log("   3 Months: 6%");
  console.log("   6 Months: 9%");
  console.log("   12 Months: 15%");
  console.log("");

  // Update each tier
  for (let tier = 0; tier < 4; tier++) {
    const config = newRates[tier as keyof typeof newRates];
    const currentConfig = await staking.stakingConfigs(tier);
    
    if (Number(currentConfig.apyBps) !== config.apyBps) {
      console.log(`   Updating tier ${tier}...`);
      try {
        const tx = await staking.updateStakingConfig(tier, {
          lockPeriod: config.lockPeriod,
          apyBps: config.apyBps,
          minStake: config.minStake,
          earlyUnstakePenaltyBps: config.penalty,
        });
        await tx.wait();
        console.log(`   ✅ Tier ${tier} updated successfully`);
      } catch (error: any) {
        console.log(`   ❌ Failed to update tier ${tier}:`, error.message);
      }
    } else {
      console.log(`   ✅ Tier ${tier} already at target rate`);
    }
  }

  // Verify new rates
  console.log("\n📊 Updated APY Rates:");
  const newOneMonth = await staking.stakingConfigs(0);
  const newThreeMonth = await staking.stakingConfigs(1);
  const newSixMonth = await staking.stakingConfigs(2);
  const newTwelveMonth = await staking.stakingConfigs(3);

  console.log("   1 Month:", Number(newOneMonth.apyBps) / 100, "%");
  console.log("   3 Months:", Number(newThreeMonth.apyBps) / 100, "%");
  console.log("   6 Months:", Number(newSixMonth.apyBps) / 100, "%");
  console.log("   12 Months:", Number(newTwelveMonth.apyBps) / 100, "%");
  console.log("");

  console.log("✅ APY rates updated successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Update failed:", error);
    process.exit(1);
  });

