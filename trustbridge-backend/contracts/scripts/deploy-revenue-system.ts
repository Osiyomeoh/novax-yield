import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying Revenue Collection System...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  // Load existing deployments
  const novaxDeploymentPath = path.join(__dirname, "../deployments/novax-etherlink-127823.json");
  const tokenomicsDeploymentPath = path.join(__dirname, "../deployments/nvx-tokenomics.json");
  
  let novaxContracts: any = {};
  let tokenomicsContracts: any = {};

  try {
    const novaxData = fs.readFileSync(novaxDeploymentPath, "utf-8");
    novaxContracts = JSON.parse(novaxData);
    console.log("✅ Loaded Novax contracts");
  } catch (error) {
    console.log("⚠️ Could not load Novax contracts, using defaults");
  }

  try {
    const tokenomicsData = fs.readFileSync(tokenomicsDeploymentPath, "utf-8");
    tokenomicsContracts = JSON.parse(tokenomicsData);
    console.log("✅ Loaded tokenomics contracts");
  } catch (error) {
    console.log("⚠️ Could not load tokenomics contracts, using defaults");
  }

  // Get contract addresses
  const usdcAddress = novaxContracts.contracts?.USDC || process.env.USDC_ADDRESS || ethers.ZeroAddress;
  const nvxTokenAddress = tokenomicsContracts.contracts?.NVXToken?.address || process.env.NVX_TOKEN_ADDRESS || ethers.ZeroAddress;
  const stakingAddress = tokenomicsContracts.contracts?.NVXStaking?.address || process.env.NVX_STAKING_ADDRESS || ethers.ZeroAddress;
  const poolManagerAddress = novaxContracts.contracts?.NovaxPoolManager?.address || process.env.POOL_MANAGER_ADDRESS || ethers.ZeroAddress;
  const exchangeAddress = tokenomicsContracts.contracts?.NVXExchange?.address || process.env.NVX_EXCHANGE_ADDRESS || ethers.ZeroAddress;

  // For testing, use deployer addresses if not set
  const platformTreasury = deployer.address; // TODO: Update to actual treasury
  const operationsWallet = deployer.address; // TODO: Update to actual operations wallet

  console.log("📋 Contract Addresses:");
  console.log("   USDC:", usdcAddress);
  console.log("   NVX Token:", nvxTokenAddress);
  console.log("   Staking:", stakingAddress);
  console.log("   Pool Manager:", poolManagerAddress);
  console.log("   Exchange:", exchangeAddress);
  console.log("");

  // 1. Deploy RevenueCollector
  console.log("1️⃣ Deploying RevenueCollector...");
  const RevenueCollector = await ethers.getContractFactory("RevenueCollector");
  const revenueCollector = await RevenueCollector.deploy(
    usdcAddress,
    nvxTokenAddress,
    platformTreasury,
    operationsWallet
  );
  await revenueCollector.waitForDeployment();
  const revenueCollectorAddress = await revenueCollector.getAddress();
  console.log("✅ RevenueCollector deployed to:", revenueCollectorAddress);

  // Set staking contract
  console.log("   🔗 Setting staking contract...");
  await revenueCollector.setStakingContract(stakingAddress);
  console.log("   ✅ Staking contract set");

  // 2. Deploy RewardsPoolManager
  console.log("\n2️⃣ Deploying RewardsPoolManager...");
  const RewardsPoolManager = await ethers.getContractFactory("RewardsPoolManager");
  const fundingInterval = 30 * 24 * 60 * 60; // 30 days
  const rewardsPoolManager = await RewardsPoolManager.deploy(
    revenueCollectorAddress,
    stakingAddress,
    usdcAddress,
    nvxTokenAddress,
    exchangeAddress, // Can be zero if using direct minting
    fundingInterval
  );
  await rewardsPoolManager.waitForDeployment();
  const rewardsPoolManagerAddress = await rewardsPoolManager.getAddress();
  console.log("✅ RewardsPoolManager deployed to:", rewardsPoolManagerAddress);

  // 3. Grant roles
  console.log("\n3️⃣ Configuring roles...");
  
  // Grant COLLECTOR_ROLE to PoolManager and Exchange
  const COLLECTOR_ROLE = await revenueCollector.COLLECTOR_ROLE();
  if (poolManagerAddress !== ethers.ZeroAddress) {
    await revenueCollector.grantRole(COLLECTOR_ROLE, poolManagerAddress);
    console.log("   ✅ Granted COLLECTOR_ROLE to PoolManager");
  }
  if (exchangeAddress !== ethers.ZeroAddress) {
    await revenueCollector.grantRole(COLLECTOR_ROLE, exchangeAddress);
    console.log("   ✅ Granted COLLECTOR_ROLE to Exchange");
  }

  // Grant OPERATOR_ROLE to RewardsPoolManager
  const OPERATOR_ROLE = await revenueCollector.OPERATOR_ROLE();
  await revenueCollector.grantRole(OPERATOR_ROLE, rewardsPoolManagerAddress);
  console.log("   ✅ Granted OPERATOR_ROLE to RewardsPoolManager");

  // 4. Update existing contracts
  console.log("\n4️⃣ Updating existing contracts...");
  
  if (poolManagerAddress !== ethers.ZeroAddress) {
    try {
      const PoolManager = await ethers.getContractFactory("NovaxPoolManager");
      const poolManager = PoolManager.attach(poolManagerAddress);
      await poolManager.setRevenueCollector(revenueCollectorAddress);
      console.log("   ✅ Updated PoolManager with RevenueCollector");
    } catch (error: any) {
      console.log("   ⚠️ Could not update PoolManager:", error.message);
    }
  }

  if (exchangeAddress !== ethers.ZeroAddress) {
    try {
      const Exchange = await ethers.getContractFactory("NVXExchange");
      const exchange = Exchange.attach(exchangeAddress);
      await exchange.setRevenueCollector(revenueCollectorAddress);
      console.log("   ✅ Updated Exchange with RevenueCollector");
    } catch (error: any) {
      console.log("   ⚠️ Could not update Exchange:", error.message);
    }
  }

  // 5. Save deployment info
  const deploymentInfo = {
    network: "etherlink_testnet",
    chainId: "127823",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RevenueCollector: {
        address: revenueCollectorAddress,
        allocations: {
          staking: "30%",
          treasury: "30%",
          operations: "20%",
          burn: "20%"
        }
      },
      RewardsPoolManager: {
        address: rewardsPoolManagerAddress,
        fundingInterval: "30 days",
        minFundingAmount: "1000 USDC",
        targetPoolHealthDays: 90
      }
    },
    integrations: {
      poolManager: poolManagerAddress,
      exchange: exchangeAddress,
      staking: stakingAddress
    }
  };

  const deploymentPath = path.join(__dirname, "../deployments/revenue-system.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", deploymentPath);

  console.log("\n✅ Revenue Collection System deployed successfully!");
  console.log("\n📋 Summary:");
  console.log("   RevenueCollector:", revenueCollectorAddress);
  console.log("   RewardsPoolManager:", rewardsPoolManagerAddress);
  console.log("\n⚠️  Next Steps:");
  console.log("   1. Update PoolManager and Exchange to use RevenueCollector");
  console.log("   2. Set up keeper network for automatic funding");
  console.log("   3. Configure DEX integration for USDC → NVX conversion");
  console.log("   4. Monitor pool health and adjust APY if needed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

