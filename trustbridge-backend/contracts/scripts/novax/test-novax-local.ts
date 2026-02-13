import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, investor] = await ethers.getSigners();
  console.log("Testing Novax contracts locally");
  console.log("Deployer:", deployer.address);
  console.log("Investor:", investor.address);

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../../deployments/novax-local.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Please deploy contracts first:");
    console.error("   npm run deploy:novax:local");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Loaded Contract Addresses:");
  console.log("RWA Factory:", contracts.NovaxRwaFactory);
  console.log("Pool Manager:", contracts.NovaxPoolManager);
  console.log("Mock USDC:", contracts.MockUSDC);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.MockUSDC);

  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  // Test 1: Create RWA Asset
  console.log("\n🧪 Test 1: Creating RWA Asset...");
  const metadataCID = ethers.id("test-metadata-ipfs-cid-12345");
  const createRwaTx = await rwaFactory.createRwa(
    1, // AGRICULTURE
    ethers.parseUnits("100", 6), // 100 USDC
    70, // 70% max LTV
    metadataCID
  );
  const createRwaReceipt = await createRwaTx.wait();
  
  // Parse the event to get assetId (first indexed parameter is bytes32)
  const eventLog = createRwaReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
  );
  
  if (!eventLog) {
    throw new Error("RwaAssetCreated event not found");
  }
  
  // assetId is the first indexed parameter (topics[1])
  // topics[0] is the event signature, topics[1] is assetId (bytes32)
  const assetId = eventLog.topics[1];
  console.log("✅ RWA Asset created with ID:", assetId);

  // Get asset details
  const asset = await rwaFactory.getAsset(assetId!);
  console.log("   Owner:", asset.owner);
  console.log("   Category:", asset.category);
  console.log("   Value USD:", ethers.formatUnits(asset.valueUSD, 6));
  console.log("   Max LTV:", asset.maxLTV, "%");
  console.log("   Status:", asset.status);

  // Test 2: Create Investment Pool
  console.log("\n🧪 Test 2: Creating Investment Pool...");
  const createPoolTx = await poolManager.createPool(
    0, // RWA pool
    assetId!,
    ethers.parseUnits("1000", 6), // 1000 USDC target
    ethers.parseUnits("10", 6), // 10 USDC min investment
    ethers.parseUnits("100", 6), // 100 USDC max investment
    1200, // 12% APR (1200 basis points)
    "Test RWA Pool Token",
    "TRPT"
  );
  const createPoolReceipt = await createPoolTx.wait();
  
  // Parse the event to get poolId (first indexed parameter is bytes32)
  const poolEventLog = createPoolReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
  );
  
  if (!poolEventLog) {
    throw new Error("PoolCreated event not found");
  }
  
  // poolId is the first indexed parameter (topics[1])
  // topics[0] is the event signature, topics[1] is poolId (bytes32)
  const poolId = poolEventLog.topics[1];
  console.log("✅ Pool created with ID:", poolId);

  // Get pool details
  const pool = await poolManager.getPool(poolId!);
  console.log("   Pool Type:", pool.poolType);
  console.log("   Asset ID:", pool.assetId);
  console.log("   Target Amount:", ethers.formatUnits(pool.targetAmount, 6), "USDC");
  console.log("   APR:", pool.apr.toString(), "basis points");
  console.log("   Pool Token:", pool.poolToken);

  // Test 3: Investor invests in pool
  console.log("\n🧪 Test 3: Investor investing in pool...");
  
  // Mint USDC to investor
  const mintAmount = ethers.parseUnits("500", 6);
  const mintTx = await mockUSDC.mint(investor.address, mintAmount);
  await mintTx.wait();
  console.log("✅ Minted", ethers.formatUnits(mintAmount, 6), "USDC to investor");

  // Approve pool manager to spend USDC
  const approveTx = await mockUSDC.connect(investor).approve(contracts.NovaxPoolManager, mintAmount);
  await approveTx.wait();
  console.log("✅ Approved Pool Manager to spend USDC");

  // Invest in pool
  const investmentAmount = ethers.parseUnits("50", 6);
  const investTx = await poolManager.connect(investor).invest(poolId!, investmentAmount);
  const investReceipt = await investTx.wait();
  console.log("✅ Investor invested", ethers.formatUnits(investmentAmount, 6), "USDC");

  // Get pool token balance
  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");
  const poolToken = PoolToken.attach(pool.poolToken);
  const investorBalance = await poolToken.balanceOf(investor.address);
  console.log("   Investor pool token balance:", ethers.formatUnits(investorBalance, 18));

  // Get updated pool info
  const updatedPool = await poolManager.getPool(poolId!);
  console.log("   Total Invested:", ethers.formatUnits(updatedPool.totalInvested, 6), "USDC");
  console.log("   Total Shares:", ethers.formatUnits(updatedPool.totalShares, 18));

  // Test 4: Get user investment
  console.log("\n🧪 Test 4: Getting user investment...");
  const userInvestment = await poolManager.getUserInvestment(poolId!, investor.address);
  console.log("✅ User investment:", ethers.formatUnits(userInvestment, 6), "USDC");

  console.log("\n✅ All tests passed!");
  console.log("\n📊 Test Summary:");
  console.log("====================");
  console.log("RWA Asset ID:", assetId);
  console.log("Pool ID:", poolId);
  console.log("Pool Token:", pool.poolToken);
  console.log("Investor:", investor.address);
  console.log("Investment:", ethers.formatUnits(investmentAmount, 6), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

