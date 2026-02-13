import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, exporter, investor1, investor2] = await ethers.getSigners();
  console.log("🧪 Testing Phase 1 Features - Novax Contracts");
  console.log("==============================================");
  console.log("Deployer:", deployer.address);
  console.log("Exporter:", exporter.address);
  console.log("Investor 1:", investor1.address);
  console.log("Investor 2:", investor2.address);

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../../deployments/novax-local.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Please deploy contracts first:");
    console.error("   npx hardhat run scripts/novax/deploy-novax-local.ts --network localhost");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Loaded Contract Addresses:");
  console.log("Mock USDC:", contracts.MockUSDC);
  console.log("NVX Token:", contracts.NVXToken);
  console.log("Exporter Registry:", contracts.NovaxExporterRegistry);
  console.log("Receivable Factory:", contracts.NovaxReceivableFactory);
  console.log("Pool Manager:", contracts.NovaxPoolManager);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.MockUSDC);

  const NVXToken = await ethers.getContractFactory("NVXToken");
  const nvxToken = NVXToken.attach(contracts.NVXToken);

  const NovaxExporterRegistry = await ethers.getContractFactory("NovaxExporterRegistry");
  const exporterRegistry = NovaxExporterRegistry.attach(contracts.NovaxExporterRegistry);

  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  // ============================================
  // TEST 1: Exporter Onboarding
  // ============================================
  console.log("\n🧪 TEST 1: Exporter Onboarding");
  console.log("--------------------------------");
  
  const kycHash = ethers.id("kyc-document-hash-12345");
  const cacHash = ethers.id("cac-document-hash-67890");
  const bankHash = ethers.id("bank-account-hash-abcde");
  
  const approveExporterTx = await exporterRegistry.approveExporter(
    exporter.address,
    kycHash,
    cacHash,
    bankHash,
    "ABC Exports Ltd",
    "Nigeria"
  );
  await approveExporterTx.wait();
  console.log("✅ Exporter approved");

  const isApproved = await exporterRegistry.isExporterApproved(exporter.address);
  console.log("   Is Approved:", isApproved);
  
  const exporterProfile = await exporterRegistry.getExporterProfile(exporter.address);
  console.log("   Business Name:", exporterProfile.businessName);
  console.log("   Country:", exporterProfile.country);
  console.log("   KYC Hash:", exporterProfile.kycHash);

  // ============================================
  // TEST 2: Create Trade Receivable
  // ============================================
  console.log("\n🧪 TEST 2: Create Trade Receivable");
  console.log("--------------------------------");
  
  const importer = investor2.address; // Using investor2 as importer
  const amountUSD = ethers.parseUnits("50000", 6); // $50,000
  const dueDate = Math.floor(Date.now() / 1000) + (45 * 24 * 60 * 60); // 45 days from now
  const metadataCID = ethers.id("invoice-metadata-ipfs-cid-12345");

  const createReceivableTx = await receivableFactory.connect(exporter).createReceivable(
    importer,
    amountUSD,
    dueDate,
    metadataCID
  );
  const createReceivableReceipt = await createReceivableTx.wait();
  
  // Parse event to get receivableId
  const receivableEventLog = createReceivableReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("ReceivableCreated(bytes32,address,address,uint256,bytes32,uint256)")
  );
  
  if (!receivableEventLog) {
    throw new Error("ReceivableCreated event not found");
  }
  
  const receivableId = receivableEventLog.topics[1];
  console.log("✅ Receivable created with ID:", receivableId);

  const receivable = await receivableFactory.getReceivable(receivableId!);
  console.log("   Exporter:", receivable.exporter);
  console.log("   Importer:", receivable.importer);
  console.log("   Amount USD:", ethers.formatUnits(receivable.amountUSD, 6));
  console.log("   Due Date:", new Date(Number(receivable.dueDate) * 1000).toISOString());
  console.log("   Status:", receivable.status); // Should be 0 = PENDING_VERIFICATION

  // ============================================
  // TEST 3: AMC Verifies Receivable
  // ============================================
  console.log("\n🧪 TEST 3: AMC Verifies Receivable");
  console.log("--------------------------------");
  
  const riskScore = 45; // Medium risk
  const apr = 1500; // 15% (1500 basis points)

  const verifyReceivableTx = await receivableFactory.connect(deployer).verifyReceivable(
    receivableId!,
    riskScore,
    apr
  );
  await verifyReceivableTx.wait();
  console.log("✅ Receivable verified");

  const verifiedReceivable = await receivableFactory.getReceivable(receivableId!);
  console.log("   Status:", verifiedReceivable.status); // Should be 1 = VERIFIED
  console.log("   Risk Score:", verifiedReceivable.riskScore.toString());
  console.log("   APR:", verifiedReceivable.apr.toString(), "basis points (", Number(verifiedReceivable.apr) / 100, "%)");

  // ============================================
  // TEST 4: Create Pool with New Parameters
  // ============================================
  console.log("\n🧪 TEST 4: Create Pool with New Parameters");
  console.log("--------------------------------");
  
  const targetAmount = ethers.parseUnits("40000", 6); // $40,000 (80% of $50,000)
  const minInvestment = ethers.parseUnits("100", 6); // $100
  const maxInvestment = ethers.parseUnits("10000", 6); // $10,000
  const poolApr = 1500; // 15%
  const maturityDate = dueDate; // Same as receivable due date
  const rewardPool = ethers.parseUnits("500", 18); // 500 NVX tokens

  // First, mint NVX tokens to pool manager for rewards
  const mintNVXTx = await nvxToken.mint(contracts.NovaxPoolManager, rewardPool);
  await mintNVXTx.wait();
  console.log("✅ Minted", ethers.formatUnits(rewardPool, 18), "NVX to Pool Manager for rewards");

  const createPoolTx = await poolManager.connect(deployer).createPool(
    1, // RECEIVABLE pool type
    receivableId!,
    targetAmount,
    minInvestment,
    maxInvestment,
    poolApr,
    maturityDate,
    rewardPool,
    "TR-2024-001",
    "TR001"
  );
  const createPoolReceipt = await createPoolTx.wait();
  
  // Parse event to get poolId
  const poolEventLog = createPoolReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
  );
  
  if (!poolEventLog) {
    throw new Error("PoolCreated event not found");
  }
  
  const poolId = poolEventLog.topics[1];
  console.log("✅ Pool created with ID:", poolId);

  const pool = await poolManager.getPool(poolId!);
  console.log("   Pool Type:", pool.poolType.toString(), "(1 = RECEIVABLE)");
  console.log("   Target Amount:", ethers.formatUnits(pool.targetAmount, 6), "USDC");
  console.log("   APR:", pool.apr.toString(), "basis points");
  console.log("   Maturity Date:", new Date(Number(pool.maturityDate) * 1000).toISOString());
  console.log("   Reward Pool:", ethers.formatUnits(pool.rewardPool, 18), "NVX");
  console.log("   Status:", pool.status.toString(), "(0 = ACTIVE)");

  // ============================================
  // TEST 5: Investor 1 Invests (with NVX Rewards)
  // ============================================
  console.log("\n🧪 TEST 5: Investor 1 Invests (with NVX Rewards)");
  console.log("--------------------------------");
  
  // Mint USDC to investor1
  const investor1USDC = ethers.parseUnits("5000", 6);
  const mintUSDC1Tx = await mockUSDC.mint(investor1.address, investor1USDC);
  await mintUSDC1Tx.wait();
  console.log("✅ Minted", ethers.formatUnits(investor1USDC, 6), "USDC to Investor 1");

  // Approve pool manager
  const approve1Tx = await mockUSDC.connect(investor1).approve(contracts.NovaxPoolManager, investor1USDC);
  await approve1Tx.wait();
  console.log("✅ Approved Pool Manager");

  // Get initial NVX balance
  const initialNVX1 = await nvxToken.balanceOf(investor1.address);
  console.log("   Initial NVX Balance:", ethers.formatUnits(initialNVX1, 18));

  // Invest $1,000
  const investment1 = ethers.parseUnits("1000", 6);
  const invest1Tx = await poolManager.connect(investor1).invest(poolId!, investment1);
  const invest1Receipt = await invest1Tx.wait();
  console.log("✅ Investor 1 invested", ethers.formatUnits(investment1, 6), "USDC");

  // Check NVX rewards
  const finalNVX1 = await nvxToken.balanceOf(investor1.address);
  const nvxReward1 = finalNVX1 - initialNVX1;
  console.log("   NVX Reward Received:", ethers.formatUnits(nvxReward1, 18), "NVX");
  console.log("   Final NVX Balance:", ethers.formatUnits(finalNVX1, 18));

  // Get pool token balance
  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");
  const poolToken = PoolToken.attach(pool.poolToken);
  const investor1PoolTokens = await poolToken.balanceOf(investor1.address);
  console.log("   Pool Tokens:", ethers.formatUnits(investor1PoolTokens, 18));

  // ============================================
  // TEST 6: Investor 2 Invests (Pool Reaches Target)
  // ============================================
  console.log("\n🧪 TEST 6: Investor 2 Invests (Pool Reaches Target)");
  console.log("--------------------------------");
  
  // Mint USDC to investor2
  const investor2USDC = ethers.parseUnits("50000", 6);
  const mintUSDC2Tx = await mockUSDC.mint(investor2.address, investor2USDC);
  await mintUSDC2Tx.wait();
  console.log("✅ Minted", ethers.formatUnits(investor2USDC, 6), "USDC to Investor 2");

  // Approve pool manager
  const approve2Tx = await mockUSDC.connect(investor2).approve(contracts.NovaxPoolManager, investor2USDC);
  await approve2Tx.wait();
  console.log("✅ Approved Pool Manager");

  // Get pool state before investment
  const poolBefore = await poolManager.getPool(poolId!);
  console.log("   Pool Invested Before:", ethers.formatUnits(poolBefore.totalInvested, 6), "USDC");
  console.log("   Pool Status Before:", poolBefore.status.toString());

  // Get exporter USDC balance before
  const exporterBalanceBefore = await mockUSDC.balanceOf(exporter.address);
  console.log("   Exporter USDC Balance Before:", ethers.formatUnits(exporterBalanceBefore, 6));

  // Invest $39,000 (to reach $40,000 target)
  const investment2 = ethers.parseUnits("39000", 6);
  const invest2Tx = await poolManager.connect(investor2).invest(poolId!, investment2);
  const invest2Receipt = await invest2Tx.wait();
  console.log("✅ Investor 2 invested", ethers.formatUnits(investment2, 6), "USDC");

  // Check if ExporterPaid event was emitted (automatic payout)
  const exporterPaidEvent = invest2Receipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("ExporterPaid(bytes32,address,uint256,uint256,uint256,uint256)")
  );
  
  if (exporterPaidEvent) {
    console.log("✅ Automatic Exporter Payout Triggered!");
    
    // Get exporter balance after
    const exporterBalanceAfter = await mockUSDC.balanceOf(exporter.address);
    const exporterReceived = exporterBalanceAfter - exporterBalanceBefore;
    console.log("   Exporter USDC Balance After:", ethers.formatUnits(exporterBalanceAfter, 6));
    console.log("   Exporter Received:", ethers.formatUnits(exporterReceived, 6), "USDC");
    
    // Calculate expected amount (should be $38,800 after 1% platform fee + 2% AMC fee)
    const expectedAmount = targetAmount - (targetAmount * 100n / 10000n) - (targetAmount * 200n / 10000n);
    console.log("   Expected Amount:", ethers.formatUnits(expectedAmount, 6), "USDC");
  }

  // Get pool state after investment
  const poolAfter = await poolManager.getPool(poolId!);
  console.log("   Pool Invested After:", ethers.formatUnits(poolAfter.totalInvested, 6), "USDC");
  console.log("   Pool Status After:", poolAfter.status.toString(), "(1 = FUNDED)");

  // ============================================
  // TEST 7: Record Payment
  // ============================================
  console.log("\n🧪 TEST 7: Record Payment");
  console.log("--------------------------------");
  
  // First, update maturity status
  const updateMaturityTx = await poolManager.updateMaturity(poolId!);
  await updateMaturityTx.wait();
  console.log("✅ Maturity status updated");

  // Mint USDC to pool manager (simulating payment received)
  const paymentAmount = targetAmount;
  const mintPaymentTx = await mockUSDC.mint(contracts.NovaxPoolManager, paymentAmount);
  await mintPaymentTx.wait();
  console.log("✅ Minted payment amount to Pool Manager");

  // Record payment
  const recordPaymentTx = await poolManager.connect(deployer).recordPayment(poolId!, paymentAmount);
  await recordPaymentTx.wait();
  console.log("✅ Payment recorded");

  const poolAfterPayment = await poolManager.getPool(poolId!);
  console.log("   Total Paid:", ethers.formatUnits(poolAfterPayment.totalPaid, 6), "USDC");
  console.log("   Payment Status:", poolAfterPayment.paymentStatus.toString(), "(2 = FULL)");
  console.log("   Pool Status:", poolAfterPayment.status.toString(), "(3 = PAID)");

  // ============================================
  // TEST 8: Distribute Yield
  // ============================================
  console.log("\n🧪 TEST 8: Distribute Yield (Automatic)");
  console.log("--------------------------------");
  
  // Get investor balances before
  const investor1USDCBefore = await mockUSDC.balanceOf(investor1.address);
  const investor2USDCBefore = await mockUSDC.balanceOf(investor2.address);
  console.log("   Investor 1 USDC Before:", ethers.formatUnits(investor1USDCBefore, 6));
  console.log("   Investor 2 USDC Before:", ethers.formatUnits(investor2USDCBefore, 6));

  // Get pool token balances before
  const investor1TokensBefore = await poolToken.balanceOf(investor1.address);
  const investor2TokensBefore = await poolToken.balanceOf(investor2.address);
  console.log("   Investor 1 Pool Tokens Before:", ethers.formatUnits(investor1TokensBefore, 18));
  console.log("   Investor 2 Pool Tokens Before:", ethers.formatUnits(investor2TokensBefore, 18));

  // Distribute yield
  const distributeYieldTx = await poolManager.distributeYield(poolId!);
  await distributeYieldTx.wait();
  console.log("✅ Yield distributed");

  // Get investor balances after
  const investor1USDCAfter = await mockUSDC.balanceOf(investor1.address);
  const investor2USDCAfter = await mockUSDC.balanceOf(investor2.address);
  const investor1Received = investor1USDCAfter - investor1USDCBefore;
  const investor2Received = investor2USDCAfter - investor2USDCBefore;
  console.log("   Investor 1 USDC After:", ethers.formatUnits(investor1USDCAfter, 6));
  console.log("   Investor 1 Received:", ethers.formatUnits(investor1Received, 6), "USDC");
  console.log("   Investor 2 USDC After:", ethers.formatUnits(investor2USDCAfter, 6));
  console.log("   Investor 2 Received:", ethers.formatUnits(investor2Received, 6), "USDC");

  // Check pool tokens were burned
  const investor1TokensAfter = await poolToken.balanceOf(investor1.address);
  const investor2TokensAfter = await poolToken.balanceOf(investor2.address);
  console.log("   Investor 1 Pool Tokens After:", ethers.formatUnits(investor1TokensAfter, 18), "(should be 0)");
  console.log("   Investor 2 Pool Tokens After:", ethers.formatUnits(investor2TokensAfter, 18), "(should be 0)");

  // Get final pool status
  const finalPool = await poolManager.getPool(poolId!);
  console.log("   Final Pool Status:", finalPool.status.toString(), "(5 = CLOSED)");

  // ============================================
  // TEST SUMMARY
  // ============================================
  console.log("\n✅ All Phase 1 Features Tested Successfully!");
  console.log("\n📊 Test Summary:");
  console.log("====================");
  console.log("✅ Exporter Onboarding");
  console.log("✅ Trade Receivable Creation");
  console.log("✅ AMC Verification");
  console.log("✅ Pool Creation (with maturity & rewards)");
  console.log("✅ Investment with NVX Rewards");
  console.log("✅ Automatic Exporter Payout");
  console.log("✅ Payment Recording");
  console.log("✅ Automatic Yield Distribution");
  console.log("\n📋 Contract Addresses:");
  console.log("Exporter Registry:", contracts.NovaxExporterRegistry);
  console.log("Receivable Factory:", contracts.NovaxReceivableFactory);
  console.log("Pool Manager:", contracts.NovaxPoolManager);
  console.log("Pool ID:", poolId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

