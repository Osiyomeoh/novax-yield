import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, assetOwner, investor1, investor2, investor3, verifier, amc] = await ethers.getSigners();
  
  console.log("🚀 Testing Full Novax Yield Flow");
  console.log("==================================\n");
  console.log("👥 Actors:");
  console.log("  Deployer:", deployer.address);
  console.log("  Asset Owner:", assetOwner.address);
  console.log("  Investor 1:", investor1.address);
  console.log("  Investor 2:", investor2.address);
  console.log("  Investor 3:", investor3.address);
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

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.MockUSDC);

  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");

  // Grant required roles
  console.log("\n🔐 Setting up roles...");
  console.log("─".repeat(60));
  
  const VERIFIER_ROLE = await rwaFactory.VERIFIER_ROLE();
  const AMC_ROLE = await rwaFactory.AMC_ROLE();
  
  console.log(`Granting VERIFIER_ROLE to ${verifier.address}...`);
  const grantVerifierTx = await rwaFactory.grantRole(VERIFIER_ROLE, verifier.address);
  await grantVerifierTx.wait();
  console.log(`✅ VERIFIER_ROLE granted`);
  
  console.log(`Granting VERIFIER_ROLE to verifier in Receivable Factory...`);
  const recVerifierRole = await receivableFactory.VERIFIER_ROLE();
  const grantRecVerifierTx = await receivableFactory.grantRole(recVerifierRole, verifier.address);
  await grantRecVerifierTx.wait();
  console.log(`✅ VERIFIER_ROLE granted in Receivable Factory`);
  
  console.log(`Granting AMC_ROLE to ${amc.address}...`);
  const grantAmcTx = await rwaFactory.grantRole(AMC_ROLE, amc.address);
  await grantAmcTx.wait();
  console.log(`✅ AMC_ROLE granted`);
  
  console.log(`Granting ADMIN_ROLE to deployer in Pool Manager...`);
  const ADMIN_ROLE = await poolManager.ADMIN_ROLE();
  const grantAdminTx = await poolManager.grantRole(ADMIN_ROLE, deployer.address);
  await grantAdminTx.wait();
  console.log(`✅ ADMIN_ROLE granted in Pool Manager`);

  console.log("\n" + "=".repeat(60));
  console.log("FLOW 1: RWA ASSET TOKENIZATION - COMPLETE CYCLE");
  console.log("=".repeat(60));

  // STEP 1: Asset Owner Creates RWA Asset
  console.log("\n📝 STEP 1: Asset Owner Creates RWA Asset");
  console.log("─".repeat(60));
  const rwaMetadataCID = ethers.id("ipfs://QmRWAFarmLand2024");
  const rwaValue = ethers.parseUnits("100000", 6); // $100,000
  const rwaMaxLTV = 70; // 70%
  
  console.log(`Creating RWA Asset:`);
  console.log(`  Category: AGRICULTURE (1)`);
  console.log(`  Value: ${ethers.formatUnits(rwaValue, 6)} USDC`);
  console.log(`  Max LTV: ${rwaMaxLTV}%`);
  console.log(`  Metadata CID: ${rwaMetadataCID}`);
  
  const createRwaTx = await rwaFactory.connect(assetOwner).createRwa(
    1, // AGRICULTURE
    rwaValue,
    rwaMaxLTV,
    rwaMetadataCID
  );
  const rwaReceipt = await createRwaTx.wait();
  const rwaEventLog = rwaReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
  );
  const rwaAssetId = rwaEventLog ? rwaEventLog.topics[1] : null;
  
  const rwaAsset = await rwaFactory.getAsset(rwaAssetId!);
  console.log(`✅ RWA Asset Created!`);
  console.log(`   Asset ID: ${rwaAssetId}`);
  console.log(`   Owner: ${rwaAsset.owner}`);
  console.log(`   Status: PENDING_VERIFICATION (${rwaAsset.status})`);
  console.log(`   Value: ${ethers.formatUnits(rwaAsset.valueUSD, 6)} USDC`);

  // STEP 2: Verifier Reviews and Verifies Asset
  console.log("\n🔍 STEP 2: Verifier Reviews and Verifies Asset");
  console.log("─".repeat(60));
  const riskScore = 25; // 25% risk (low risk)
  console.log(`Verifying asset with risk score: ${riskScore}%`);
  
  const verifyTx = await rwaFactory.connect(verifier).verifyAsset(rwaAssetId!, riskScore);
  await verifyTx.wait();
  
  const rwaAssetVerified = await rwaFactory.getAsset(rwaAssetId!);
  console.log(`✅ Asset Verified!`);
  console.log(`   Status: VERIFIED_PENDING_AMC (${rwaAssetVerified.status})`);
  console.log(`   Risk Score: ${rwaAssetVerified.riskScore}%`);

  // STEP 3: AMC Approves Asset
  console.log("\n✅ STEP 3: AMC Approves Asset");
  console.log("─".repeat(60));
  console.log(`AMC approving asset for pool creation...`);
  
  const approveTx = await rwaFactory.connect(amc).approveAsset(rwaAssetId!);
  await approveTx.wait();
  
  const rwaAssetApproved = await rwaFactory.getAsset(rwaAssetId!);
  console.log(`✅ Asset Approved by AMC!`);
  console.log(`   Status: AMC_APPROVED (${rwaAssetApproved.status})`);
  console.log(`   Current AMC: ${rwaAssetApproved.currentAMC}`);

  // STEP 4: Create Investment Pool
  console.log("\n🏊 STEP 4: Create Investment Pool");
  console.log("─".repeat(60));
  const poolTarget = ethers.parseUnits("15000", 6); // $15,000 target (3 investors × $5,000 max)
  const minInvestment = ethers.parseUnits("100", 6); // $100 minimum
  const maxInvestment = ethers.parseUnits("5000", 6); // $5,000 max per investor
  const apr = 1200; // 12% APR (1200 basis points)
  
  console.log(`Creating investment pool:`);
  console.log(`  Type: RWA`);
  console.log(`  Target Amount: ${ethers.formatUnits(poolTarget, 6)} USDC`);
  console.log(`  Min Investment: ${ethers.formatUnits(minInvestment, 6)} USDC`);
  console.log(`  Max Investment: ${ethers.formatUnits(maxInvestment, 6)} USDC`);
  console.log(`  APR: ${apr / 100}%`);
  
  const createPoolTx = await poolManager.createPool(
    0, // RWA pool
    rwaAssetId!,
    poolTarget,
    minInvestment,
    maxInvestment,
    apr,
    "Farm Land Investment Pool",
    "FLIP"
  );
  const poolReceipt = await createPoolTx.wait();
  const poolEventLog = poolReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
  );
  const rwaPoolId = poolEventLog ? poolEventLog.topics[1] : null;
  
  const rwaPool = await poolManager.getPool(rwaPoolId!);
  console.log(`✅ Pool Created!`);
  console.log(`   Pool ID: ${rwaPoolId}`);
  console.log(`   Pool Token: ${rwaPool.poolToken}`);
  console.log(`   Target: ${ethers.formatUnits(rwaPool.targetAmount, 6)} USDC`);
  console.log(`   APR: ${rwaPool.apr} basis points (${Number(rwaPool.apr) / 100}%)`);

  // STEP 5: Investors Invest in Pool
  console.log("\n💰 STEP 5: Investors Invest in Pool");
  console.log("─".repeat(60));
  
  // Investment amounts must be within min ($100) and max ($5,000) limits
  // Total target is $50,000, so we'll have multiple rounds or adjust amounts
  const investments = [
    { investor: investor1, amount: ethers.parseUnits("5000", 6) }, // $5,000 (max)
    { investor: investor2, amount: ethers.parseUnits("5000", 6) }, // $5,000 (max)
    { investor: investor3, amount: ethers.parseUnits("5000", 6) }, // $5,000 (max)
    // We'll need more investors or multiple rounds to reach $50,000 target
  ];
  
  // Mint USDC to investors
  for (const inv of investments) {
    await mockUSDC.mint(inv.investor.address, inv.amount);
    console.log(`   Minted ${ethers.formatUnits(inv.amount, 6)} USDC to ${inv.investor.address.slice(0, 10)}...`);
  }
  
  // Investors approve and invest
  for (let i = 0; i < investments.length; i++) {
    const inv = investments[i];
    console.log(`\n   Investor ${i + 1} investing ${ethers.formatUnits(inv.amount, 6)} USDC...`);
    
    await mockUSDC.connect(inv.investor).approve(contracts.NovaxPoolManager, inv.amount);
    const investTx = await poolManager.connect(inv.investor).invest(rwaPoolId!, inv.amount);
    await investTx.wait();
    
    const userInvestment = await poolManager.getUserInvestment(rwaPoolId!, inv.investor.address);
    const poolToken = PoolToken.attach(rwaPool.poolToken);
    const balance = await poolToken.balanceOf(inv.investor.address);
    
    console.log(`   ✅ Investment successful!`);
    console.log(`      Investment: ${ethers.formatUnits(userInvestment, 6)} USDC`);
    console.log(`      Pool Tokens: ${ethers.formatUnits(balance, 18)}`);
  }
  
  const poolAfterInvest = await poolManager.getPool(rwaPoolId!);
  console.log(`\n   📊 Pool Status After Investments:`);
  console.log(`      Total Invested: ${ethers.formatUnits(poolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`      Total Shares: ${ethers.formatUnits(poolAfterInvest.totalShares, 18)}`);
  console.log(`      Target: ${ethers.formatUnits(poolAfterInvest.targetAmount, 6)} USDC`);
  console.log(`      Progress: ${(Number(poolAfterInvest.totalInvested) / Number(poolAfterInvest.targetAmount) * 100).toFixed(1)}%`);

  // STEP 6: Yield Distribution (Simulating 1 year)
  console.log("\n📈 STEP 6: Yield Distribution (After 1 Year)");
  console.log("─".repeat(60));
  const totalInvested = poolAfterInvest.totalInvested;
  const annualYield = (totalInvested * BigInt(apr)) / 10000n; // 12% of total invested
  console.log(`Calculating yield:`);
  console.log(`  Total Invested: ${ethers.formatUnits(totalInvested, 6)} USDC`);
  console.log(`  APR: ${apr / 100}%`);
  console.log(`  Annual Yield: ${ethers.formatUnits(annualYield, 6)} USDC`);
  
  // Mint yield USDC to deployer (simulating asset generating returns)
  await mockUSDC.mint(deployer.address, annualYield);
  await mockUSDC.approve(contracts.NovaxPoolManager, annualYield);
  
  console.log(`\n   Distributing yield to investors...`);
  const distributeTx = await poolManager.distributeYield(rwaPoolId!, annualYield);
  await distributeTx.wait();
  
  // Check investor balances after yield
  console.log(`\n   📊 Investor Returns:`);
  for (let i = 0; i < investments.length; i++) {
    const inv = investments[i];
    const userInvestment = await poolManager.getUserInvestment(rwaPoolId!, inv.investor.address);
    const poolToken = PoolToken.attach(rwaPool.poolToken);
    const shares = await poolToken.balanceOf(inv.investor.address);
    const poolAfterYield = await poolManager.getPool(rwaPoolId!);
    const userYield = (annualYield * shares) / poolAfterYield.totalShares;
    const usdcBalance = await mockUSDC.balanceOf(inv.investor.address);
    
    console.log(`   Investor ${i + 1}:`);
    console.log(`      Investment: ${ethers.formatUnits(userInvestment, 6)} USDC`);
    console.log(`      Shares: ${ethers.formatUnits(shares, 18)}`);
    console.log(`      Yield Received: ${ethers.formatUnits(userYield, 6)} USDC`);
    console.log(`      Return Rate: ${(Number(userYield) / Number(userInvestment) * 100).toFixed(2)}%`);
    console.log(`      Total USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("FLOW 2: TRADE RECEIVABLE FINANCING - COMPLETE CYCLE");
  console.log("=".repeat(60));

  // STEP 1: Exporter Creates Receivable
  console.log("\n📝 STEP 1: Exporter Creates Trade Receivable");
  console.log("─".repeat(60));
  const dueDate = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60; // 60 days from now
  const invoiceAmount = ethers.parseUnits("75000", 6); // $75,000 invoice
  const invoiceMetadataCID = ethers.id("ipfs://QmInvoiceCocoaExport2024");
  
  console.log(`Creating trade receivable:`);
  console.log(`  Exporter: ${assetOwner.address}`);
  console.log(`  Importer: ${investor1.address}`);
  console.log(`  Amount: ${ethers.formatUnits(invoiceAmount, 6)} USDC`);
  console.log(`  Due Date: ${new Date(dueDate * 1000).toLocaleDateString()}`);
  console.log(`  Metadata CID: ${invoiceMetadataCID}`);
  
  const createRecTx = await receivableFactory.connect(assetOwner).createReceivable(
    investor1.address, // importer
    invoiceAmount,
    dueDate,
    invoiceMetadataCID
  );
  const recReceipt = await createRecTx.wait();
  const recEventLog = recReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("ReceivableCreated(bytes32,address,address,uint256,bytes32,uint256)")
  );
  const receivableId = recEventLog ? recEventLog.topics[1] : null;
  
  const receivable = await receivableFactory.getReceivable(receivableId!);
  console.log(`✅ Receivable Created!`);
  console.log(`   Receivable ID: ${receivableId}`);
  console.log(`   Status: PENDING_VERIFICATION (${receivable.status})`);
  console.log(`   Amount: ${ethers.formatUnits(receivable.amountUSD, 6)} USDC`);

  // STEP 2: Verifier Verifies Receivable
  console.log("\n🔍 STEP 2: Verifier Verifies Receivable");
  console.log("─".repeat(60));
  const recRiskScore = 20; // 20% risk (low risk)
  const recApr = 1000; // 10% APR (1000 basis points)
  
  console.log(`Verifying receivable:`);
  console.log(`  Risk Score: ${recRiskScore}%`);
  console.log(`  APR: ${recApr / 100}%`);
  
  const verifyRecTx = await receivableFactory.connect(verifier).verifyReceivable(
    receivableId!,
    recRiskScore,
    recApr
  );
  await verifyRecTx.wait();
  
  const receivableVerified = await receivableFactory.getReceivable(receivableId!);
  console.log(`✅ Receivable Verified!`);
  console.log(`   Status: VERIFIED (${receivableVerified.status})`);
  console.log(`   Risk Score: ${receivableVerified.riskScore}%`);
  console.log(`   APR: ${receivableVerified.apr} basis points (${Number(receivableVerified.apr) / 100}%)`);

  // STEP 3: Create Receivable Pool
  console.log("\n🏊 STEP 3: Create Receivable Investment Pool");
  console.log("─".repeat(60));
  const recPoolTarget = ethers.parseUnits("75000", 6); // $75,000 target (full invoice)
  const recMinInvestment = ethers.parseUnits("500", 6); // $500 minimum
  const recMaxInvestment = ethers.parseUnits("30000", 6); // $30,000 max per investor
  
  console.log(`Creating receivable pool:`);
  console.log(`  Type: RECEIVABLE`);
  console.log(`  Target Amount: ${ethers.formatUnits(recPoolTarget, 6)} USDC`);
  console.log(`  Min Investment: ${ethers.formatUnits(recMinInvestment, 6)} USDC`);
  console.log(`  Max Investment: ${ethers.formatUnits(recMaxInvestment, 6)} USDC`);
  console.log(`  APR: ${recApr / 100}%`);
  
  const createRecPoolTx = await poolManager.createPool(
    1, // RECEIVABLE pool
    receivableId!,
    recPoolTarget,
    recMinInvestment,
    recMaxInvestment,
    recApr,
    "Cocoa Export Invoice Pool",
    "CEIP"
  );
  const recPoolReceipt = await createRecPoolTx.wait();
  const recPoolEventLog = recPoolReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
  );
  const recPoolId = recPoolEventLog ? recPoolEventLog.topics[1] : null;
  
  const recPool = await poolManager.getPool(recPoolId!);
  console.log(`✅ Receivable Pool Created!`);
  console.log(`   Pool ID: ${recPoolId}`);
  console.log(`   Pool Token: ${recPool.poolToken}`);

  // STEP 4: Investors Fund Receivable Pool
  console.log("\n💰 STEP 4: Investors Fund Receivable Pool");
  console.log("─".repeat(60));
  
  const recInvestments = [
    { investor: investor1, amount: ethers.parseUnits("30000", 6) }, // $30,000
    { investor: investor2, amount: ethers.parseUnits("25000", 6) }, // $25,000
    { investor: investor3, amount: ethers.parseUnits("20000", 6) }, // $20,000
  ];
  
  // Mint and invest
  for (let i = 0; i < recInvestments.length; i++) {
    const inv = recInvestments[i];
    await mockUSDC.mint(inv.investor.address, inv.amount);
    await mockUSDC.connect(inv.investor).approve(contracts.NovaxPoolManager, inv.amount);
    
    console.log(`   Investor ${i + 1} investing ${ethers.formatUnits(inv.amount, 6)} USDC...`);
    const investTx = await poolManager.connect(inv.investor).invest(recPoolId!, inv.amount);
    await investTx.wait();
    
    const userInvestment = await poolManager.getUserInvestment(recPoolId!, inv.investor.address);
    console.log(`   ✅ Investment: ${ethers.formatUnits(userInvestment, 6)} USDC`);
  }
  
  const recPoolAfterInvest = await poolManager.getPool(recPoolId!);
  console.log(`\n   📊 Pool Status:`);
  console.log(`      Total Invested: ${ethers.formatUnits(recPoolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`      Target: ${ethers.formatUnits(recPoolAfterInvest.targetAmount, 6)} USDC`);

  // STEP 5: Invoice Matures and Payment Distribution
  console.log("\n💵 STEP 5: Invoice Matures - Payment Distribution");
  console.log("─".repeat(60));
  console.log(`Simulating invoice payment after 60 days...`);
  
  // Calculate yield for 60 days (not full year)
  const daysHeld = 60;
  // APR is in basis points (1000 = 10%), so for 60 days: (1000 / 10000) * (60 / 365) = 0.016438 = 1.64%
  const periodYield = (recPoolAfterInvest.totalInvested * BigInt(recApr) * BigInt(daysHeld)) / (10000n * 365n);
  const totalPayout = recPoolAfterInvest.totalInvested + periodYield;
  
  console.log(`  Days Held: ${daysHeld}`);
  console.log(`  Principal: ${ethers.formatUnits(recPoolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`  Yield (${daysHeld} days): ${ethers.formatUnits(periodYield, 6)} USDC`);
  console.log(`  Total Payout: ${ethers.formatUnits(totalPayout, 6)} USDC`);
  
  // Mint payout to deployer (simulating importer payment)
  await mockUSDC.mint(deployer.address, totalPayout);
  await mockUSDC.approve(contracts.NovaxPoolManager, totalPayout);
  
  console.log(`\n   Distributing principal + yield...`);
  const distributeRecTx = await poolManager.distributeYield(recPoolId!, totalPayout);
  await distributeRecTx.wait();
  
  // Check final balances
  console.log(`\n   📊 Final Investor Returns:`);
  for (let i = 0; i < recInvestments.length; i++) {
    const inv = recInvestments[i];
    const userInvestment = await poolManager.getUserInvestment(recPoolId!, inv.investor.address);
    const recPoolToken = PoolToken.attach(recPool.poolToken);
    const shares = await recPoolToken.balanceOf(inv.investor.address);
    const recPoolFinal = await poolManager.getPool(recPoolId!);
    const userPayout = (totalPayout * shares) / recPoolFinal.totalShares;
    const userYield = userPayout - userInvestment;
    const usdcBalance = await mockUSDC.balanceOf(inv.investor.address);
    
    console.log(`   Investor ${i + 1}:`);
    console.log(`      Principal: ${ethers.formatUnits(userInvestment, 6)} USDC`);
    console.log(`      Yield: ${ethers.formatUnits(userYield, 6)} USDC`);
    console.log(`      Total Return: ${ethers.formatUnits(userPayout, 6)} USDC`);
    console.log(`      Return Rate: ${(Number(userYield) / Number(userInvestment) * 100).toFixed(2)}% (${daysHeld} days)`);
    console.log(`      Final USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ FULL FLOW TEST COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📊 Summary:");
  console.log(`  RWA Asset Created: ${rwaAssetId}`);
  console.log(`  RWA Pool ID: ${rwaPoolId}`);
  console.log(`  RWA Total Invested: ${ethers.formatUnits(poolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`  RWA Annual Yield: ${ethers.formatUnits(annualYield, 6)} USDC`);
  console.log(`\n  Receivable Created: ${receivableId}`);
  console.log(`  Receivable Pool ID: ${recPoolId}`);
  console.log(`  Receivable Total Invested: ${ethers.formatUnits(recPoolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`  Receivable Total Payout: ${ethers.formatUnits(totalPayout, 6)} USDC`);
  console.log("\n🎉 All flows tested successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

