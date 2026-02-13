import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying NVX Tokenomics Contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  // Configuration
  const EXCHANGE_RATE = ethers.parseEther("100"); // 1 XTZ = 100 NVX
  const EXCHANGE_FEE_BPS = 200; // 2%
  const MIN_EXCHANGE = ethers.parseEther("0.1"); // 0.1 XTZ
  const MAX_EXCHANGE = ethers.parseEther("1000"); // 1000 XTZ
  
  // Addresses (update these after deployment)
  const PLATFORM_TREASURY = deployer.address; // TODO: Update to actual treasury
  const LIQUIDITY_POOL = deployer.address; // TODO: Update to actual liquidity pool

  // 1. Deploy NVXToken
  console.log("1️⃣ Deploying NVXToken...");
  const NVXToken = await ethers.getContractFactory("NVXToken");
  const nvxToken = await NVXToken.deploy();
  await nvxToken.waitForDeployment();
  const nvxTokenAddress = await nvxToken.getAddress();
  console.log("✅ NVXToken deployed to:", nvxTokenAddress);

  // Grant MINTER_ROLE to deployer for initial distribution
  console.log("🔐 Granting MINTER_ROLE to deployer...");
  const MINTER_ROLE = await nvxToken.MINTER_ROLE();
  await nvxToken.grantRole(MINTER_ROLE, deployer.address);
  console.log("✅ MINTER_ROLE granted");

  // 2. Deploy NVXExchange
  console.log("\n2️⃣ Deploying NVXExchange...");
  const NVXExchange = await ethers.getContractFactory("NVXExchange");
  const nvxExchange = await NVXExchange.deploy(
    nvxTokenAddress,
    PLATFORM_TREASURY,
    LIQUIDITY_POOL,
    EXCHANGE_RATE,
    EXCHANGE_FEE_BPS,
    MIN_EXCHANGE,
    MAX_EXCHANGE
  );
  await nvxExchange.waitForDeployment();
  const nvxExchangeAddress = await nvxExchange.getAddress();
  console.log("✅ NVXExchange deployed to:", nvxExchangeAddress);

  // Grant MINTER_ROLE to exchange contract
  console.log("🔐 Granting MINTER_ROLE to NVXExchange...");
  await nvxToken.grantRole(MINTER_ROLE, nvxExchangeAddress);
  console.log("✅ MINTER_ROLE granted to exchange");

  // Set exchange as burn exempt
  console.log("🔐 Setting exchange as burn exempt...");
  await nvxToken.setBurnExempt(nvxExchangeAddress, true);
  console.log("✅ Exchange set as burn exempt");

  // 3. Deploy NVXStaking
  console.log("\n3️⃣ Deploying NVXStaking...");
  const NVXStaking = await ethers.getContractFactory("NVXStaking");
  const nvxStaking = await NVXStaking.deploy(nvxTokenAddress);
  await nvxStaking.waitForDeployment();
  const nvxStakingAddress = await nvxStaking.getAddress();
  console.log("✅ NVXStaking deployed to:", nvxStakingAddress);

  // Grant MINTER_ROLE to staking contract
  console.log("🔐 Granting MINTER_ROLE to NVXStaking...");
  await nvxToken.grantRole(MINTER_ROLE, nvxStakingAddress);
  console.log("✅ MINTER_ROLE granted to staking");

  // Set staking as burn exempt
  console.log("🔐 Setting staking as burn exempt...");
  await nvxToken.setBurnExempt(nvxStakingAddress, true);
  console.log("✅ Staking set as burn exempt");

  // 4. Initial Distribution (if needed)
  console.log("\n4️⃣ Setting up initial distribution...");
  // Example: Mint initial rewards pool for staking
  const INITIAL_STAKING_REWARDS = ethers.parseEther("10000000"); // 10M NVX
  await nvxToken.mint(nvxStakingAddress, INITIAL_STAKING_REWARDS);
  console.log("✅ Initial staking rewards pool:", ethers.formatEther(INITIAL_STAKING_REWARDS), "NVX");

  // Save deployment addresses
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      NVXToken: {
        address: nvxTokenAddress,
        exchangeRate: ethers.formatEther(EXCHANGE_RATE),
        maxSupply: ethers.formatEther(await nvxToken.MAX_SUPPLY()),
        burnRate: "1%",
      },
      NVXExchange: {
        address: nvxExchangeAddress,
        exchangeRate: ethers.formatEther(EXCHANGE_RATE),
        fee: `${EXCHANGE_FEE_BPS / 100}%`,
        minExchange: ethers.formatEther(MIN_EXCHANGE),
        maxExchange: ethers.formatEther(MAX_EXCHANGE),
      },
      NVXStaking: {
        address: nvxStakingAddress,
        tiers: {
          "1_month": { apy: "5%", minStake: "100 NVX" },
          "3_month": { apy: "10%", minStake: "500 NVX" },
          "6_month": { apy: "15%", minStake: "1000 NVX" },
          "12_month": { apy: "25%", minStake: "5000 NVX" },
        },
      },
    },
  };

  const deploymentPath = path.join(__dirname, "../deployments/nvx-tokenomics.json");
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", deploymentPath);
  console.log("\n✅ All NVX Tokenomics contracts deployed successfully!\n");
  console.log("📋 Summary:");
  console.log("   NVXToken:", nvxTokenAddress);
  console.log("   NVXExchange:", nvxExchangeAddress);
  console.log("   NVXStaking:", nvxStakingAddress);
  console.log("\n⚠️  Next Steps:");
  console.log("   1. Update PLATFORM_TREASURY and LIQUIDITY_POOL addresses");
  console.log("   2. Set up initial token distribution");
  console.log("   3. Add liquidity to DEX pools");
  console.log("   4. Update frontend with new contract addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

