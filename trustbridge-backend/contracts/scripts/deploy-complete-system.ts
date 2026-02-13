import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying Complete Production System...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  // Load existing deployments
  const novaxDeploymentPath = path.join(__dirname, "../deployments/novax-etherlink-127823.json");
  const tokenomicsDeploymentPath = path.join(__dirname, "../deployments/nvx-tokenomics.json");
  const revenueDeploymentPath = path.join(__dirname, "../deployments/revenue-system.json");
  
  let novaxContracts: any = {};
  let tokenomicsContracts: any = {};
  let revenueContracts: any = {};

  try {
    const novaxData = fs.readFileSync(novaxDeploymentPath, "utf-8");
    novaxContracts = JSON.parse(novaxData);
    console.log("✅ Loaded Novax contracts");
  } catch (error) {
    console.log("⚠️ Could not load Novax contracts");
  }

  try {
    const tokenomicsData = fs.readFileSync(tokenomicsDeploymentPath, "utf-8");
    tokenomicsContracts = JSON.parse(tokenomicsData);
    console.log("✅ Loaded tokenomics contracts");
  } catch (error) {
    console.log("⚠️ Could not load tokenomics contracts");
  }

  try {
    const revenueData = fs.readFileSync(revenueDeploymentPath, "utf-8");
    revenueContracts = JSON.parse(revenueData);
    console.log("✅ Loaded revenue system contracts");
  } catch (error) {
    console.log("⚠️ Could not load revenue system contracts");
  }

  // Get contract addresses
  const usdcAddress = novaxContracts.contracts?.USDC || process.env.USDC_ADDRESS || ethers.ZeroAddress;
  const nvxTokenAddress = tokenomicsContracts.contracts?.NVXToken?.address || process.env.NVX_TOKEN_ADDRESS || ethers.ZeroAddress;
  const stakingAddress = tokenomicsContracts.contracts?.NVXStaking?.address || process.env.NVX_STAKING_ADDRESS || ethers.ZeroAddress;
  const revenueCollectorAddress = revenueContracts.contracts?.RevenueCollector?.address || process.env.REVENUE_COLLECTOR_ADDRESS || ethers.ZeroAddress;
  const rewardsPoolManagerAddress = revenueContracts.contracts?.RewardsPoolManager?.address || process.env.REWARDS_POOL_MANAGER_ADDRESS || ethers.ZeroAddress;

  // For DEX integration, we need:
  // - DEX Router address (Uniswap V2, SushiSwap, etc.)
  // - WXTZ token address (Wrapped XTZ)
  // For now, use zero addresses (will be set later)
  const dexRouter = process.env.DEX_ROUTER_ADDRESS || ethers.ZeroAddress;
  const wxtzToken = process.env.WXTZ_TOKEN_ADDRESS || ethers.ZeroAddress;

  console.log("📋 Existing Contract Addresses:");
  console.log("   USDC:", usdcAddress);
  console.log("   NVX Token:", nvxTokenAddress);
  console.log("   Staking:", stakingAddress);
  console.log("   RevenueCollector:", revenueCollectorAddress);
  console.log("   RewardsPoolManager:", rewardsPoolManagerAddress);
  console.log("");

  // 1. Deploy DEXIntegration (if not already deployed)
  console.log("1️⃣ Deploying DEXIntegration...");
  let dexIntegrationAddress = process.env.DEX_INTEGRATION_ADDRESS || ethers.ZeroAddress;
  
  if (dexIntegrationAddress === ethers.ZeroAddress && dexRouter !== ethers.ZeroAddress && wxtzToken !== ethers.ZeroAddress) {
    const DEXIntegration = await ethers.getContractFactory("DEXIntegration");
    const dexIntegration = await DEXIntegration.deploy(
      usdcAddress,
      nvxTokenAddress,
      dexRouter,
      wxtzToken
    );
    await dexIntegration.waitForDeployment();
    dexIntegrationAddress = await dexIntegration.getAddress();
    console.log("✅ DEXIntegration deployed to:", dexIntegrationAddress);
  } else if (dexIntegrationAddress !== ethers.ZeroAddress) {
    console.log("✅ Using existing DEXIntegration:", dexIntegrationAddress);
  } else {
    console.log("⚠️ Skipping DEXIntegration (router or WXTZ not configured)");
  }

  // 2. Deploy KeeperNetwork (if not already deployed)
  console.log("\n2️⃣ Deploying KeeperNetwork...");
  let keeperNetworkAddress = process.env.KEEPER_NETWORK_ADDRESS || ethers.ZeroAddress;
  
  if (keeperNetworkAddress === ethers.ZeroAddress && rewardsPoolManagerAddress !== ethers.ZeroAddress) {
    const KeeperNetwork = await ethers.getContractFactory("KeeperNetwork");
    const checkInterval = 24 * 60 * 60; // 1 day
    const keeperNetwork = await KeeperNetwork.deploy(rewardsPoolManagerAddress, checkInterval);
    await keeperNetwork.waitForDeployment();
    keeperNetworkAddress = await keeperNetwork.getAddress();
    console.log("✅ KeeperNetwork deployed to:", keeperNetworkAddress);
  } else if (keeperNetworkAddress !== ethers.ZeroAddress) {
    console.log("✅ Using existing KeeperNetwork:", keeperNetworkAddress);
  } else {
    console.log("⚠️ Skipping KeeperNetwork (RewardsPoolManager not found)");
  }

  // 3. Update RewardsPoolManager with DEXIntegration
  if (rewardsPoolManagerAddress !== ethers.ZeroAddress && dexIntegrationAddress !== ethers.ZeroAddress) {
    console.log("\n3️⃣ Updating RewardsPoolManager with DEXIntegration...");
    try {
      const RewardsPoolManager = await ethers.getContractFactory("RewardsPoolManager");
      const rewardsPoolManager = RewardsPoolManager.attach(rewardsPoolManagerAddress);
      await rewardsPoolManager.setDEXIntegration(dexIntegrationAddress);
      console.log("   ✅ DEXIntegration set in RewardsPoolManager");
    } catch (error: any) {
      console.log("   ⚠️ Could not update RewardsPoolManager:", error.message);
    }
  }

  // 4. Grant OPERATOR_ROLE to KeeperNetwork
  if (rewardsPoolManagerAddress !== ethers.ZeroAddress && keeperNetworkAddress !== ethers.ZeroAddress) {
    console.log("\n4️⃣ Configuring KeeperNetwork permissions...");
    try {
      const RewardsPoolManager = await ethers.getContractFactory("RewardsPoolManager");
      const rewardsPoolManager = RewardsPoolManager.attach(rewardsPoolManagerAddress);
      const OPERATOR_ROLE = await rewardsPoolManager.OPERATOR_ROLE();
      await rewardsPoolManager.grantRole(OPERATOR_ROLE, keeperNetworkAddress);
      console.log("   ✅ Granted OPERATOR_ROLE to KeeperNetwork");
    } catch (error: any) {
      console.log("   ⚠️ Could not grant role:", error.message);
    }
  }

  // 5. Update APY rates in NVXStaking (if needed)
  if (stakingAddress !== ethers.ZeroAddress) {
    console.log("\n5️⃣ Checking APY rates...");
    try {
      const NVXStaking = await ethers.getContractFactory("NVXStaking");
      const staking = NVXStaking.attach(stakingAddress);
      
      // Check current APY rates
      const oneMonthConfig = await staking.stakingConfigs(0);
      const oneMonthAPY = Number(oneMonthConfig.apyBps) / 100;
      
      console.log("   📊 Current APY Rates:");
      console.log("      1 Month:", oneMonthAPY, "%");
      
      if (oneMonthAPY > 5) {
        console.log("   ⚠️ APY rates are high (>5%). Consider updating to sustainable levels (3-15%)");
        console.log("   💡 Use updateStakingConfig() to adjust rates");
      } else {
        console.log("   ✅ APY rates are at sustainable levels");
      }
    } catch (error: any) {
      console.log("   ⚠️ Could not check APY rates:", error.message);
    }
  }

  // 6. Save deployment info
  const deploymentInfo = {
    network: "etherlink_testnet",
    chainId: "127823",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      DEXIntegration: dexIntegrationAddress !== ethers.ZeroAddress ? {
        address: dexIntegrationAddress,
        dexRouter: dexRouter,
        wxtzToken: wxtzToken,
        slippageTolerance: "3%"
      } : null,
      KeeperNetwork: keeperNetworkAddress !== ethers.ZeroAddress ? {
        address: keeperNetworkAddress,
        checkInterval: "1 day",
        rewardsPoolManager: rewardsPoolManagerAddress
      } : null
    },
    configuration: {
      apyRates: {
        "1_month": "3%",
        "3_months": "6%",
        "6_months": "9%",
        "12_months": "15%"
      },
      revenueAllocations: {
        staking: "30%",
        treasury: "30%",
        operations: "20%",
        burn: "20%"
      }
    }
  };

  const deploymentPath = path.join(__dirname, "../deployments/complete-system.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", deploymentPath);

  console.log("\n✅ Complete System Deployment Summary!");
  console.log("\n📋 Deployed Contracts:");
  if (dexIntegrationAddress !== ethers.ZeroAddress) {
    console.log("   DEXIntegration:", dexIntegrationAddress);
  }
  if (keeperNetworkAddress !== ethers.ZeroAddress) {
    console.log("   KeeperNetwork:", keeperNetworkAddress);
  }
  
  console.log("\n⚠️  Next Steps:");
  console.log("   1. Configure DEX router address (Uniswap V2, SushiSwap, etc.)");
  console.log("   2. Set WXTZ token address");
  console.log("   3. Register KeeperNetwork with Chainlink Keepers or Gelato");
  console.log("   4. Adjust APY rates if needed (currently 3-15%)");
  console.log("   5. Run security audit");
  console.log("   6. Set up monitoring dashboard");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

