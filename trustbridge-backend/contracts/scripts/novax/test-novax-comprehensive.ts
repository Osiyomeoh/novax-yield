import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, investor1, investor2, verifier, amc] = await ethers.getSigners();
  console.log("🧪 Comprehensive Novax Contracts Testing");
  console.log("==========================================\n");
  console.log("Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  Investor 1:", investor1.address);
  console.log("  Investor 2:", investor2.address);
  console.log("  Verifier:", verifier.address);
  console.log("  AMC:", amc.address);

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../../deployments/novax-local.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Please deploy contracts first:");
    console.error("   npm run deploy:novax:local");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Contract Addresses:");
  console.log("  RWA Factory:", contracts.NovaxRwaFactory);
  console.log("  Receivable Factory:", contracts.NovaxReceivableFactory);
  console.log("  Pool Manager:", contracts.NovaxPoolManager);
  console.log("  Mock USDC:", contracts.MockUSDC);
  console.log("  NVX Token:", contracts.NVXToken);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.MockUSDC);

  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  const NVXToken = await ethers.getContractFactory("NVXToken");
  const nvxToken = NVXToken.attach(contracts.NVXToken);

  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");

  let testResults = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ name: string; status: string; details?: string }>
  };

  function logTest(name: string, passed: boolean, details?: string) {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    testResults.tests.push({ name, status, details });
    console.log(`${status} - ${name}`);
    if (details) console.log(`   ${details}`);
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("TEST SUITE 1: RWA Asset Management");
  console.log("=".repeat(50));

  // Test 1.1: Create RWA Asset
  try {
    const metadataCID1 = ethers.id("test-rwa-asset-1-ipfs-cid");
    const createRwaTx = await rwaFactory.createRwa(
      1, // AGRICULTURE
      ethers.parseUnits("500", 6), // 500 USDC
      75, // 75% max LTV
      metadataCID1
    );
    const receipt = await createRwaTx.wait();
    const eventLog = receipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId1 = eventLog ? eventLog.topics[1] : null;
    const asset1 = await rwaFactory.getAsset(assetId1!);
    
    logTest("1.1 Create RWA Asset", asset1.id === assetId1 && asset1.valueUSD === ethers.parseUnits("500", 6),
      `Asset ID: ${assetId1}, Value: 500 USDC, LTV: 75%`);
  } catch (error: any) {
    logTest("1.1 Create RWA Asset", false, error.message);
  }

  // Test 1.2: Create Multiple RWA Assets
  try {
    const assetIds = [];
    for (let i = 0; i < 3; i++) {
      const metadataCID = ethers.id(`test-rwa-asset-${i}-ipfs-cid`);
      const tx = await rwaFactory.createRwa(
        i % 3, // Different categories
        ethers.parseUnits(`${100 + i * 50}`, 6),
        70 + i * 5, // Different LTVs
        metadataCID
      );
      const receipt = await tx.wait();
      const eventLog = receipt?.logs.find(
        (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
      );
      if (eventLog) assetIds.push(eventLog.topics[1]);
    }
    logTest("1.2 Create Multiple RWA Assets", assetIds.length === 3,
      `Created ${assetIds.length} assets`);
  } catch (error: any) {
    logTest("1.2 Create Multiple RWA Assets", false, error.message);
  }

  // Test 1.3: Get User Assets
  try {
    const userAssets = await rwaFactory.getUserAssets(deployer.address);
    logTest("1.3 Get User Assets", userAssets.length >= 4,
      `User has ${userAssets.length} assets`);
  } catch (error: any) {
    logTest("1.3 Get User Assets", false, error.message);
  }

  // Test 1.4: Verify Asset (as verifier)
  try {
    const metadataCID = ethers.id("test-rwa-asset-1-ipfs-cid");
    const createTx = await rwaFactory.createRwa(0, ethers.parseUnits("200", 6), 80, metadataCID);
    const receipt = await createTx.wait();
    const eventLog = receipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = eventLog ? eventLog.topics[1] : null;
    
    const verifyTx = await rwaFactory.connect(verifier).verifyAsset(assetId!, 25); // 25% risk
    await verifyTx.wait();
    const asset = await rwaFactory.getAsset(assetId!);
    
    logTest("1.4 Verify Asset", asset.riskScore === 25n && asset.status === 1n,
      `Risk Score: ${asset.riskScore}, Status: ${asset.status}`);
  } catch (error: any) {
    logTest("1.4 Verify Asset", false, error.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("TEST SUITE 2: Trade Receivables");
  console.log("=".repeat(50));

  // Test 2.1: Create Receivable
  try {
    const dueDate = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60; // 60 days from now
    const metadataCID = ethers.id("test-invoice-1-ipfs-cid");
    const createTx = await receivableFactory.createReceivable(
      investor1.address, // importer
      ethers.parseUnits("1000", 6), // 1000 USDC
      dueDate,
      metadataCID
    );
    const receipt = await createTx.wait();
    const eventLog = receipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("ReceivableCreated(bytes32,address,address,uint256,bytes32,uint256)")
    );
    const receivableId1 = eventLog ? eventLog.topics[1] : null;
    const receivable = await receivableFactory.getReceivable(receivableId1!);
    
    logTest("2.1 Create Receivable", receivable.amountUSD === ethers.parseUnits("1000", 6),
      `Receivable ID: ${receivableId1}, Amount: 1000 USDC`);
  } catch (error: any) {
    logTest("2.1 Create Receivable", false, error.message);
  }

  // Test 2.2: Verify Receivable
  try {
    const dueDate = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
    const metadataCID = ethers.id("test-invoice-2-ipfs-cid");
    const createTx = await receivableFactory.createReceivable(
      investor2.address,
      ethers.parseUnits("2000", 6),
      dueDate,
      metadataCID
    );
    const receipt = await createTx.wait();
    const eventLog = receipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("ReceivableCreated(bytes32,address,address,uint256,bytes32,uint256)")
    );
    const receivableId = eventLog ? eventLog.topics[1] : null;
    
    const verifyTx = await receivableFactory.connect(verifier).verifyReceivable(
      receivableId!,
      30, // 30% risk
      1500 // 15% APR
    );
    await verifyTx.wait();
    const receivable = await receivableFactory.getReceivable(receivableId!);
    
    logTest("2.2 Verify Receivable", receivable.riskScore === 30n && receivable.apr === 1500n,
      `Risk: ${receivable.riskScore}%, APR: ${receivable.apr} bps`);
  } catch (error: any) {
    logTest("2.2 Verify Receivable", false, error.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("TEST SUITE 3: Investment Pools");
  console.log("=".repeat(50));

  // Test 3.1: Create RWA Pool
  try {
    const metadataCID = ethers.id("test-rwa-pool-asset");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("10000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, // RWA pool
      assetId!,
      ethers.parseUnits("5000", 6), // 5000 USDC target
      ethers.parseUnits("50", 6), // 50 USDC min
      ethers.parseUnits("500", 6), // 500 USDC max
      1200, // 12% APR
      "Test RWA Pool",
      "TRWA"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId1 = poolEventLog ? poolEventLog.topics[1] : null;
    const pool = await poolManager.getPool(poolId1!);
    
    logTest("3.1 Create RWA Pool", pool.poolType === 0n && pool.targetAmount === ethers.parseUnits("5000", 6),
      `Pool ID: ${poolId1}, Target: 5000 USDC, APR: 12%`);
  } catch (error: any) {
    logTest("3.1 Create RWA Pool", false, error.message);
  }

  // Test 3.2: Create Receivable Pool
  try {
    const dueDate = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60;
    const metadataCID = ethers.id("test-receivable-pool");
    const createRecTx = await receivableFactory.createReceivable(
      investor1.address,
      ethers.parseUnits("3000", 6),
      dueDate,
      metadataCID
    );
    const recReceipt = await createRecTx.wait();
    const recEventLog = recReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("ReceivableCreated(bytes32,address,address,uint256,bytes32,uint256)")
    );
    const receivableId = recEventLog ? recEventLog.topics[1] : null;
    
    const verifyTx = await receivableFactory.connect(verifier).verifyReceivable(receivableId!, 20, 1000);
    await verifyTx.wait();
    
    const createPoolTx = await poolManager.createPool(
      1, // Receivable pool
      receivableId!,
      ethers.parseUnits("3000", 6),
      ethers.parseUnits("100", 6),
      ethers.parseUnits("1000", 6),
      1000, // 10% APR
      "Test Receivable Pool",
      "TREC"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId2 = poolEventLog ? poolEventLog.topics[1] : null;
    const pool = await poolManager.getPool(poolId2!);
    
    logTest("3.2 Create Receivable Pool", pool.poolType === 1n,
      `Pool ID: ${poolId2}, Type: Receivable`);
  } catch (error: any) {
    logTest("3.2 Create Receivable Pool", false, error.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("TEST SUITE 4: Investments");
  console.log("=".repeat(50));

  // Test 4.1: Single Investor Investment
  try {
    const metadataCID = ethers.id("test-investment-asset");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("2000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, assetId!, ethers.parseUnits("2000", 6),
      ethers.parseUnits("10", 6), ethers.parseUnits("200", 6), 1200,
      "Investment Pool", "INV"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId = poolEventLog ? poolEventLog.topics[1] : null;
    const pool = await poolManager.getPool(poolId!);
    
    // Mint and invest
    await mockUSDC.mint(investor1.address, ethers.parseUnits("500", 6));
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("200", 6));
    const investTx = await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("200", 6));
    await investTx.wait();
    
    const userInvestment = await poolManager.getUserInvestment(poolId!, investor1.address);
    const poolToken = PoolToken.attach(pool.poolToken);
    const balance = await poolToken.balanceOf(investor1.address);
    
    logTest("4.1 Single Investor Investment", userInvestment === ethers.parseUnits("200", 6) && balance > 0n,
      `Investment: 200 USDC, Pool Tokens: ${ethers.formatUnits(balance, 18)}`);
  } catch (error: any) {
    logTest("4.1 Single Investor Investment", false, error.message);
  }

  // Test 4.2: Multiple Investors
  try {
    const metadataCID = ethers.id("test-multi-investor");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("5000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, assetId!, ethers.parseUnits("5000", 6),
      ethers.parseUnits("50", 6), ethers.parseUnits("1000", 6), 1200,
      "Multi Investor Pool", "MULTI"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId = poolEventLog ? poolEventLog.topics[1] : null;
    
    // Investor 1
    await mockUSDC.mint(investor1.address, ethers.parseUnits("1000", 6));
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("500", 6));
    await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("500", 6));
    
    // Investor 2
    await mockUSDC.mint(investor2.address, ethers.parseUnits("1000", 6));
    await mockUSDC.connect(investor2).approve(contracts.NovaxPoolManager, ethers.parseUnits("300", 6));
    await poolManager.connect(investor2).invest(poolId!, ethers.parseUnits("300", 6));
    
    const pool = await poolManager.getPool(poolId!);
    const inv1Investment = await poolManager.getUserInvestment(poolId!, investor1.address);
    const inv2Investment = await poolManager.getUserInvestment(poolId!, investor2.address);
    
    logTest("4.2 Multiple Investors", 
      inv1Investment === ethers.parseUnits("500", 6) && 
      inv2Investment === ethers.parseUnits("300", 6) &&
      pool.totalInvested === ethers.parseUnits("800", 6),
      `Investor 1: 500 USDC, Investor 2: 300 USDC, Total: 800 USDC`);
  } catch (error: any) {
    logTest("4.2 Multiple Investors", false, error.message);
  }

  // Test 4.3: Withdrawal
  try {
    const metadataCID = ethers.id("test-withdrawal");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("1000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, assetId!, ethers.parseUnits("1000", 6),
      ethers.parseUnits("10", 6), ethers.parseUnits("500", 6), 1200,
      "Withdrawal Pool", "WTH"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId = poolEventLog ? poolEventLog.topics[1] : null;
    const pool = await poolManager.getPool(poolId!);
    
    // Invest
    await mockUSDC.mint(investor1.address, ethers.parseUnits("500", 6));
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("300", 6));
    await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("300", 6));
    
    const poolToken = PoolToken.attach(pool.poolToken);
    const balanceBefore = await poolToken.balanceOf(investor1.address);
    
    // Withdraw half
    const withdrawAmount = balanceBefore / 2n;
    await poolManager.connect(investor1).withdraw(poolId!, withdrawAmount);
    
    const balanceAfter = await poolToken.balanceOf(investor1.address);
    const poolAfter = await poolManager.getPool(poolId!);
    
    logTest("4.3 Withdrawal", balanceAfter === balanceBefore - withdrawAmount,
      `Balance before: ${ethers.formatUnits(balanceBefore, 18)}, After: ${ethers.formatUnits(balanceAfter, 18)}`);
  } catch (error: any) {
    logTest("4.3 Withdrawal", false, error.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("TEST SUITE 5: Edge Cases & Validation");
  console.log("=".repeat(50));

  // Test 5.1: Minimum Investment
  try {
    const metadataCID = ethers.id("test-min-investment");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("1000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, assetId!, ethers.parseUnits("1000", 6),
      ethers.parseUnits("100", 6), // Min 100 USDC
      ethers.parseUnits("500", 6), 1200,
      "Min Investment Pool", "MIN"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId = poolEventLog ? poolEventLog.topics[1] : null;
    
    await mockUSDC.mint(investor1.address, ethers.parseUnits("500", 6));
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("50", 6));
    
    try {
      await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("50", 6)); // Below minimum
      logTest("5.1 Minimum Investment Validation", false, "Should have failed but didn't");
    } catch (error: any) {
      logTest("5.1 Minimum Investment Validation", error.message.includes("minimum") || error.message.includes("Amount below"),
        "Correctly rejected investment below minimum");
    }
  } catch (error: any) {
    logTest("5.1 Minimum Investment Validation", false, error.message);
  }

  // Test 5.2: Maximum Investment
  try {
    const metadataCID = ethers.id("test-max-investment");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("2000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, assetId!, ethers.parseUnits("2000", 6),
      ethers.parseUnits("10", 6),
      ethers.parseUnits("200", 6), // Max 200 USDC
      1200, "Max Investment Pool", "MAX"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId = poolEventLog ? poolEventLog.topics[1] : null;
    
    await mockUSDC.mint(investor1.address, ethers.parseUnits("500", 6));
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("150", 6));
    await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("150", 6)); // First investment OK
    
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("100", 6));
    try {
      await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("100", 6)); // Would exceed max
      logTest("5.2 Maximum Investment Validation", false, "Should have failed but didn't");
    } catch (error: any) {
      logTest("5.2 Maximum Investment Validation", error.message.includes("maximum") || error.message.includes("Exceeds"),
        "Correctly rejected investment exceeding maximum");
    }
  } catch (error: any) {
    logTest("5.2 Maximum Investment Validation", false, error.message);
  }

  // Test 5.3: Pool Target Limit
  try {
    const metadataCID = ethers.id("test-target-limit");
    const createAssetTx = await rwaFactory.createRwa(1, ethers.parseUnits("1000", 6), 70, metadataCID);
    const assetReceipt = await createAssetTx.wait();
    const assetEventLog = assetReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    const assetId = assetEventLog ? assetEventLog.topics[1] : null;
    
    const createPoolTx = await poolManager.createPool(
      0, assetId!, ethers.parseUnits("1000", 6), // Target 1000
      ethers.parseUnits("10", 6), ethers.parseUnits("500", 6), 1200,
      "Target Limit Pool", "TGT"
    );
    const poolReceipt = await createPoolTx.wait();
    const poolEventLog = poolReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
    );
    const poolId = poolEventLog ? poolEventLog.topics[1] : null;
    
    await mockUSDC.mint(investor1.address, ethers.parseUnits("2000", 6));
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("1000", 6));
    await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("1000", 6)); // Reaches target
    
    await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, ethers.parseUnits("100", 6));
    try {
      await poolManager.connect(investor1).invest(poolId!, ethers.parseUnits("100", 6)); // Would exceed target
      logTest("5.3 Pool Target Limit", false, "Should have failed but didn't");
    } catch (error: any) {
      logTest("5.3 Pool Target Limit", error.message.includes("target") || error.message.includes("Exceeds"),
        "Correctly rejected investment exceeding target");
    }
  } catch (error: any) {
    logTest("5.3 Pool Target Limit", false, error.message);
  }

  // Print Summary
  console.log("\n" + "=".repeat(50));
  console.log("TEST SUMMARY");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total:  ${testResults.passed + testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  console.log("\n📋 Detailed Results:");
  testResults.tests.forEach((test, index) => {
    console.log(`  ${index + 1}. ${test.status} - ${test.name}`);
    if (test.details) console.log(`     ${test.details}`);
  });

  if (testResults.failed === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Please review the details above.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

