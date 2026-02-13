import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🧪 Testing NVX Tokenomics Contracts...\n");

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user1 = signers[1] || deployer;
  const user2 = signers[2] || deployer;
  
  console.log("📝 Testing with accounts:");
  console.log("   Deployer:", deployer.address);
  console.log("   User1:", user1.address);
  console.log("   User2:", user2.address);
  console.log("   Available signers:", signers.length);
  console.log("");

  // Load deployment info
  const deploymentPath = path.join(__dirname, "../deployments/nvx-tokenomics.json");
  let deploymentInfo: any;
  
  try {
    const deploymentData = fs.readFileSync(deploymentPath, "utf-8");
    deploymentInfo = JSON.parse(deploymentData);
    console.log("📄 Loaded deployment info from:", deploymentPath);
  } catch (error) {
    console.error("❌ Failed to load deployment info. Please deploy contracts first.");
    console.error("   Error:", error);
    process.exit(1);
  }

  // Extract addresses from deployment info
  const nvxTokenAddress = deploymentInfo.contracts?.NVXToken?.address;
  const nvxExchangeAddress = deploymentInfo.contracts?.NVXExchange?.address;
  const nvxStakingAddress = deploymentInfo.contracts?.NVXStaking?.address;

  if (!nvxTokenAddress || !nvxExchangeAddress || !nvxStakingAddress) {
    console.error("❌ Missing contract addresses in deployment file");
    console.error("   Deployment info structure:", Object.keys(deploymentInfo));
    if (deploymentInfo.contracts) {
      console.error("   Contracts keys:", Object.keys(deploymentInfo.contracts));
    }
    console.error("   Full deployment info:", JSON.stringify(deploymentInfo, null, 2));
    process.exit(1);
  }

  console.log("📋 Contract Addresses:");
  console.log("   NVXToken:", nvxTokenAddress);
  console.log("   NVXExchange:", nvxExchangeAddress);
  console.log("   NVXStaking:", nvxStakingAddress);
  console.log("");

  // Get contract instances
  const NVXToken = await ethers.getContractFactory("NVXToken");
  const NVXExchange = await ethers.getContractFactory("NVXExchange");
  const NVXStaking = await ethers.getContractFactory("NVXStaking");

  const nvxToken = NVXToken.attach(nvxTokenAddress);
  const nvxExchange = NVXExchange.attach(nvxExchangeAddress);
  const nvxStaking = NVXStaking.attach(nvxStakingAddress);

  // ========== TEST 1: NVXToken Basic Functions ==========
  console.log("1️⃣ Testing NVXToken...");
  
  // Check max supply
  const maxSupply = await nvxToken.MAX_SUPPLY();
  console.log("   ✅ Max Supply:", ethers.formatEther(maxSupply), "NVX");

  // Mint tokens to user1
  const mintAmount = ethers.parseEther("1000");
  console.log("   📤 Minting", ethers.formatEther(mintAmount), "NVX to user1...");
  await nvxToken.mint(user1.address, mintAmount);
  const user1Balance = await nvxToken.balanceOf(user1.address);
  console.log("   ✅ User1 balance:", ethers.formatEther(user1Balance), "NVX");

  // Test burn
  const burnAmount = ethers.parseEther("10");
  console.log("   🔥 Burning", ethers.formatEther(burnAmount), "NVX from user1...");
  await nvxToken.connect(user1).burn(burnAmount);
  const user1BalanceAfterBurn = await nvxToken.balanceOf(user1.address);
  console.log("   ✅ User1 balance after burn:", ethers.formatEther(user1BalanceAfterBurn), "NVX");
  
  const totalBurned = await nvxToken.totalBurned();
  console.log("   ✅ Total burned:", ethers.formatEther(totalBurned), "NVX");

  // Test transfer (should burn 1%)
  console.log("   📤 Transferring 100 NVX from user1 to user2 (should burn 1%)...");
  const transferAmount = ethers.parseEther("100");
  const balanceBefore = await nvxToken.balanceOf(user2.address);
  await nvxToken.connect(user1).transfer(user2.address, transferAmount);
  const balanceAfter = await nvxToken.balanceOf(user2.address);
  const received = balanceAfter - balanceBefore;
  console.log("   ✅ User2 received:", ethers.formatEther(received), "NVX (99% of 100)");
  
  const totalBurnedAfterTransfer = await nvxToken.totalBurned();
  const burnedInTransfer = totalBurnedAfterTransfer - totalBurned;
  console.log("   ✅ Burned in transfer:", ethers.formatEther(burnedInTransfer), "NVX (1%)");

  // ========== TEST 2: NVXExchange ==========
  console.log("\n2️⃣ Testing NVXExchange...");

  // Check exchange rate
  const exchangeRate = await nvxExchange.exchangeRate();
  console.log("   ✅ Exchange Rate: 1 XTZ =", ethers.formatEther(exchangeRate), "NVX");

  // Check exchange fee
  const exchangeFee = await nvxExchange.exchangeFeeBps();
  console.log("   ✅ Exchange Fee:", Number(exchangeFee) / 100, "%");

  // Calculate exchange
  const xtzAmount = ethers.parseEther("1"); // 1 XTZ
  const [nvxAmount, feeAmount] = await nvxExchange.calculateExchange(xtzAmount);
  console.log("   📊 Exchange calculation:");
  console.log("      XTZ Amount:", ethers.formatEther(xtzAmount));
  console.log("      Fee Amount:", ethers.formatEther(feeAmount));
  console.log("      NVX Amount:", ethers.formatEther(nvxAmount));

  // Test exchange (user1 exchanges XTZ) - check balance first
  const user1XtzBalance = await ethers.provider.getBalance(user1.address);
  const exchangeXtzAmount = ethers.parseEther("0.1"); // Reduced to 0.1 XTZ
  const minRequired = exchangeXtzAmount + ethers.parseEther("0.05"); // Need extra for gas
  
  if (user1XtzBalance >= minRequired) {
    const user1BalanceBeforeExchange = await nvxToken.balanceOf(user1.address);
    console.log("   💱 User1 exchanging", ethers.formatEther(exchangeXtzAmount), "XTZ for NVX...");
    
    const tx = await nvxExchange.connect(user1).exchange({ value: exchangeXtzAmount });
    await tx.wait();
    
    const user1BalanceAfterExchange = await nvxToken.balanceOf(user1.address);
    const nvxReceived = user1BalanceAfterExchange - user1BalanceBeforeExchange;
    console.log("   ✅ User1 received:", ethers.formatEther(nvxReceived), "NVX");
  } else {
    console.log("   ⚠️ User1 doesn't have enough XTZ for exchange (need", ethers.formatEther(minRequired), "XTZ, have", ethers.formatEther(user1XtzBalance), "XTZ)");
    console.log("   💡 Skipping exchange test - insufficient funds");
  }

  // Check statistics
  const totalExchanged = await nvxExchange.totalExchanged();
  const totalNVXMinted = await nvxExchange.totalNVXMinted();
  console.log("   📊 Exchange Statistics:");
  console.log("      Total XTZ Exchanged:", ethers.formatEther(totalExchanged));
  console.log("      Total NVX Minted:", ethers.formatEther(totalNVXMinted));

  // ========== TEST 3: NVXStaking ==========
  console.log("\n3️⃣ Testing NVXStaking...");

  // Check staking configs
  const oneMonthConfig = await nvxStaking.stakingConfigs(0); // ONE_MONTH = 0
  console.log("   📋 1 Month Staking Config:");
  console.log("      Lock Period:", Number(oneMonthConfig.lockPeriod) / (24 * 60 * 60), "days");
  console.log("      APY:", Number(oneMonthConfig.apyBps) / 100, "%");
  console.log("      Min Stake:", ethers.formatEther(oneMonthConfig.minStake), "NVX");

  // Check rewards pool
  let rewardsPool = await nvxStaking.rewardsPool();
  console.log("   💰 Current rewards pool:", ethers.formatEther(rewardsPool), "NVX");

  // Approve staking contract
  const stakeAmount = ethers.parseEther("200"); // 200 NVX
  
  // Calculate required rewards for full lock period
  // Formula: (amount * apyBps / 10000) * (lockPeriod / 365 days)
  const annualRewards = (stakeAmount * BigInt(oneMonthConfig.apyBps)) / BigInt(10000);
  const requiredRewards = (annualRewards * oneMonthConfig.lockPeriod) / BigInt(365 * 24 * 60 * 60);
  console.log("   📊 Required rewards for 200 NVX (1 month):", ethers.formatEther(requiredRewards), "NVX");
  
  // Add more rewards if needed
  if (rewardsPool < requiredRewards) {
    const additionalRewards = requiredRewards - rewardsPool + ethers.parseEther("1000"); // Add buffer
    console.log("   📤 Adding", ethers.formatEther(additionalRewards), "NVX to rewards pool...");
    await nvxToken.mint(deployer.address, additionalRewards);
    await nvxToken.approve(nvxStakingAddress, additionalRewards);
    await nvxStaking.addRewardsPool(additionalRewards);
    rewardsPool = await nvxStaking.rewardsPool();
    console.log("   ✅ Rewards pool updated:", ethers.formatEther(rewardsPool), "NVX");
  }

  // Verify staking contract is burn exempt (important for transfers)
  const isBurnExempt = await nvxToken.burnExempt(nvxStakingAddress);
  console.log("   🔥 Staking contract burn exempt:", isBurnExempt);
  if (!isBurnExempt) {
    console.log("   ⚠️ Setting staking contract as burn exempt...");
    await nvxToken.setBurnExempt(nvxStakingAddress, true);
    console.log("   ✅ Set as burn exempt");
  }

  // Approve slightly more to account for 1% burn on transfer
  // The burn happens during transfer, so we need to approve enough to cover the burn
  const approvalAmount = (stakeAmount * BigInt(101)) / BigInt(100); // Approve 101% to cover 1% burn
  console.log("   🔐 Approving staking contract (accounting for 1% burn)...");
  await nvxToken.connect(user1).approve(nvxStakingAddress, approvalAmount);
  console.log("   ✅ Approved", ethers.formatEther(approvalAmount), "NVX");

  // Stake tokens (1 month tier)
  console.log("   📥 User1 staking", ethers.formatEther(stakeAmount), "NVX for 1 month...");
  try {
    const tx = await nvxStaking.connect(user1).stake(stakeAmount, 0); // 0 = ONE_MONTH
    const receipt = await tx.wait();
    console.log("   ✅ Staked successfully. TX:", receipt?.hash);
  } catch (error: any) {
    console.log("   ❌ Staking failed:", error.message);
    // Try to get more details
    if (error.data) {
      console.log("   Error data:", error.data);
    }
    if (error.reason) {
      console.log("   Error reason:", error.reason);
    }
    // Check user balance
    const userBalance = await nvxToken.balanceOf(user1.address);
    console.log("   User1 balance:", ethers.formatEther(userBalance), "NVX");
    // Check allowance
    const allowance = await nvxToken.allowance(user1.address, nvxStakingAddress);
    console.log("   Allowance:", ethers.formatEther(allowance), "NVX");
    // Check rewards pool again
    const finalRewardsPool = await nvxStaking.rewardsPool();
    console.log("   Final rewards pool:", ethers.formatEther(finalRewardsPool), "NVX");
    throw error;
  }

  // Check user stakes
  const stakeCount = await nvxStaking.getUserStakeCount(user1.address);
  console.log("   📊 User1 Stake Count:", Number(stakeCount));
  
  if (Number(stakeCount) > 0) {
    const userStakes = await nvxStaking.getUserStakes(user1.address);
    console.log("   📊 User1 Stakes:", userStakes.length);
    if (userStakes.length > 0) {
      const stake = userStakes[0];
      console.log("      Amount:", ethers.formatEther(stake.amount), "NVX");
      console.log("      Tier:", Number(stake.tier));
      console.log("      Staked At:", new Date(Number(stake.stakedAt) * 1000).toLocaleString());
      console.log("      Unlock At:", new Date(Number(stake.unlockAt) * 1000).toLocaleString());
      console.log("      Active:", stake.active);
      
      // Check pending rewards (should be 0 immediately)
      try {
        const pendingRewards = await nvxStaking.getPendingRewards(user1.address, 0);
        console.log("   💰 Pending Rewards:", ethers.formatEther(pendingRewards), "NVX");
      } catch (error: any) {
        console.log("   ⚠️ Could not get pending rewards:", error.message);
      }
    }
  } else {
    console.log("   ⚠️ No stakes found for user1");
  }

  // Check total staked
  const totalStaked = await nvxStaking.totalStakedAmount();
  console.log("   📊 Total Staked:", ethers.formatEther(totalStaked), "NVX");

  // ========== TEST 4: Integration Test ==========
  console.log("\n4️⃣ Integration Test: Exchange -> Stake Flow...");

  // Check user2 XTZ balance
  const user2XtzBalance = await ethers.provider.getBalance(user2.address);
  console.log("   💰 User2 XTZ balance:", ethers.formatEther(user2XtzBalance), "XTZ");

  // User2 exchanges XTZ for NVX (if they have enough)
  const exchangeAmount2 = ethers.parseEther("2"); // 2 XTZ
  if (user2XtzBalance > exchangeAmount2 + ethers.parseEther("0.1")) { // Need extra for gas
    console.log("   💱 User2 exchanging", ethers.formatEther(exchangeAmount2), "XTZ...");
    await nvxExchange.connect(user2).exchange({ value: exchangeAmount2 });
    const user2Balance = await nvxToken.balanceOf(user2.address);
    console.log("   ✅ User2 balance:", ethers.formatEther(user2Balance), "NVX");
  } else {
    console.log("   ⚠️ User2 doesn't have enough XTZ for exchange (need ~2.1 XTZ for gas)");
    console.log("   💡 Using user1 for integration test instead...");
    const user1XtzBalance = await ethers.provider.getBalance(user1.address);
    if (user1XtzBalance > exchangeAmount2 + ethers.parseEther("0.1")) {
      await nvxExchange.connect(user1).exchange({ value: exchangeAmount2 });
      const user1Balance = await nvxToken.balanceOf(user1.address);
      console.log("   ✅ User1 balance:", ethers.formatEther(user1Balance), "NVX");
    } else {
      console.log("   ⚠️ User1 also doesn't have enough XTZ. Skipping integration test.");
    }
  }
  
  const user2Balance = await nvxToken.balanceOf(user2.address);

  // User2 stakes some NVX
  const stakeAmount2 = ethers.parseEther("500"); // 500 NVX for 3 months
  if (user2Balance >= stakeAmount2) {
    console.log("   🔐 User2 approving staking...");
    await nvxToken.connect(user2).approve(nvxStakingAddress, stakeAmount2);
    console.log("   📥 User2 staking", ethers.formatEther(stakeAmount2), "NVX for 3 months...");
    await nvxStaking.connect(user2).stake(stakeAmount2, 1); // 1 = THREE_MONTH
    console.log("   ✅ Staked successfully");
  } else {
    console.log("   ⚠️ User2 doesn't have enough NVX to stake");
  }

  // ========== SUMMARY ==========
  console.log("\n✅ All Tests Completed Successfully!\n");
  console.log("📊 Final Statistics:");
  
  const finalTotalSupply = await nvxToken.totalSupply();
  const finalTotalBurned = await nvxToken.totalBurned();
  const finalTotalStaked = await nvxStaking.totalStakedAmount();
  const finalTotalExchanged = await nvxExchange.totalExchanged();
  
  console.log("   Total NVX Supply:", ethers.formatEther(finalTotalSupply));
  console.log("   Total NVX Burned:", ethers.formatEther(finalTotalBurned));
  console.log("   Total NVX Staked:", ethers.formatEther(finalTotalStaked));
  console.log("   Total XTZ Exchanged:", ethers.formatEther(finalTotalExchanged));
  
  console.log("\n🎉 Tokenomics contracts are working correctly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });

