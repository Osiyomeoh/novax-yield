import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Test the complete Novax Yield flow on Etherlink Shadownet
 * This tests the full business flow: Asset Creation → AMC Approval → Pool Creation → Investment → Yield Distribution
 */

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  // Use deployer for all roles if only one signer available
  const assetOwner = signers[1] || deployer;
  const investor1 = signers[2] || deployer;
  const investor2 = signers[3] || deployer;
  const amc = signers[4] || deployer;

  console.log("🚀 Testing Complete Novax Yield Flow on Etherlink Shadownet");
  console.log("=".repeat(60));

  console.log("\n👥 Actors:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Asset Owner: ${assetOwner.address}${assetOwner === deployer ? " (using deployer)" : ""}`);
  console.log(`  Investor 1: ${investor1.address}${investor1 === deployer ? " (using deployer)" : ""}`);
  console.log(`  Investor 2: ${investor2.address}${investor2 === deployer ? " (using deployer)" : ""}`);
  console.log(`  AMC: ${amc.address}${amc === deployer ? " (using deployer)" : ""}`);
  console.log(`  Deployer Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} XTZ`);
  
  if (signers.length === 1) {
    console.log("\n⚠️  Note: Using deployer for all roles (only one signer available)");
  }

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../../deployments/novax-etherlink-127823.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Please deploy contracts first:");
    console.error("   npm run deploy:novax:etherlink");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Contract Addresses:");
  console.log(`  RWA Factory: ${contracts.NovaxRwaFactory}`);
  console.log(`  Receivable Factory: ${contracts.NovaxReceivableFactory}`);
  console.log(`  Pool Manager: ${contracts.NovaxPoolManager}`);
  console.log(`  Mock USDC: ${contracts.USDC}`);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.USDC);

  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");

  // Set up roles
  console.log("\n🔐 Setting up roles...");
  console.log("─".repeat(60));
  
  // Grant AMC_ROLE to amc in all contracts
  const AMC_ROLE = await rwaFactory.AMC_ROLE();
  
  console.log(`Granting AMC_ROLE to ${amc.address}...`);
  await rwaFactory.grantRole(AMC_ROLE, amc.address);
  console.log(`✅ AMC_ROLE granted in RWA Factory`);

  await receivableFactory.grantRole(AMC_ROLE, amc.address);
  console.log(`✅ AMC_ROLE granted in Receivable Factory`);

  await poolManager.grantRole(AMC_ROLE, amc.address);
  console.log(`✅ AMC_ROLE granted in Pool Manager`);

  // Grant ADMIN_ROLE to deployer for yield distribution
  const ADMIN_ROLE = await poolManager.ADMIN_ROLE();
  const grantAdminTx = await poolManager.grantRole(ADMIN_ROLE, deployer.address);
  await grantAdminTx.wait();
  console.log(`✅ ADMIN_ROLE granted in Pool Manager`);
  
  // Verify role was granted
  const hasAdminRole = await poolManager.hasRole(ADMIN_ROLE, deployer.address);
  console.log(`   Verified ADMIN_ROLE: ${hasAdminRole ? "✅" : "❌"}`);

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

  // STEP 2: AMC Approves Asset
  console.log("\n✅ STEP 2: AMC Approves Asset");
  console.log("─".repeat(60));
  const riskScore = 25; // 25% risk (low risk)
  console.log(`AMC approving asset with risk score: ${riskScore}%`);
  
  const approveTx = await rwaFactory.connect(amc).approveAsset(rwaAssetId!, riskScore);
  await approveTx.wait();
  
  const rwaAssetApproved = await rwaFactory.getAsset(rwaAssetId!);
  console.log(`✅ Asset Approved by AMC!`);
  console.log(`   Status: AMC_APPROVED (${rwaAssetApproved.status})`);
  console.log(`   Risk Score: ${rwaAssetApproved.riskScore}%`);
  console.log(`   Current AMC: ${rwaAssetApproved.currentAMC}`);

  // STEP 3: AMC Creates Investment Pool
  console.log("\n🏊 STEP 3: AMC Creates Investment Pool");
  console.log("─".repeat(60));
  const poolTarget = ethers.parseUnits("50000", 6); // $50,000 target
  const minInvestment = ethers.parseUnits("100", 6); // $100 minimum
  const maxInvestment = ethers.parseUnits("5000", 6); // $5,000 max per investor
  const apr = 1200; // 12% APR (1200 basis points)
  
  console.log(`Creating investment pool:`);
  console.log(`  Type: RWA`);
  console.log(`  Target Amount: ${ethers.formatUnits(poolTarget, 6)} USDC`);
  console.log(`  Min Investment: ${ethers.formatUnits(minInvestment, 6)} USDC`);
  console.log(`  Max Investment: ${ethers.formatUnits(maxInvestment, 6)} USDC`);
  console.log(`  APR: ${apr / 100}%`);
  
  const createPoolTx = await poolManager.connect(amc).createPool(
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

  // STEP 4: Investors Invest in Pool
  console.log("\n💰 STEP 4: Investors Invest in Pool");
  console.log("─".repeat(60));
  
  // Investment amounts must respect maxInvestment limit ($5,000)
  const investments = [
    { investor: investor1, amount: ethers.parseUnits("5000", 6) }, // $5,000 (max)
    { investor: investor2, amount: ethers.parseUnits("5000", 6) }, // $5,000 (max)
    { investor: investor1, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor2, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor1, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor2, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor1, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor2, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor1, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
    { investor: investor2, amount: ethers.parseUnits("5000", 6) }, // Another $5,000
  ];
  
  // Mint USDC to investors (total needed)
  const totalNeeded = investments.reduce((sum, inv) => sum + inv.amount, 0n);
  await mockUSDC.mint(investor1.address, totalNeeded / 2n);
  await mockUSDC.mint(investor2.address, totalNeeded / 2n);
  console.log(`   Minted ${ethers.formatUnits(totalNeeded / 2n, 6)} USDC to each investor`);
  
  // Investors approve and invest
  let totalInvested = 0n;
  for (let i = 0; i < investments.length; i++) {
    const inv = investments[i];
    const poolBefore = await poolManager.getPool(rwaPoolId!);
    
    // Check if we've reached the target
    if (poolBefore.totalInvested >= poolBefore.targetAmount) {
      console.log(`\n   ✅ Pool target reached! Stopping investments.`);
      break;
    }
    
    // Check user's current investment
    const currentUserInvestment = await poolManager.getUserInvestment(rwaPoolId!, inv.investor.address);
    const remainingUserCapacity = poolBefore.maxInvestment - currentUserInvestment;
    
    // Check remaining pool capacity
    const remainingPoolCapacity = poolBefore.targetAmount - poolBefore.totalInvested;
    
    // Calculate actual investment amount (respect both user max and pool capacity)
    let investAmount = inv.amount;
    if (investAmount > remainingUserCapacity) {
      investAmount = remainingUserCapacity;
    }
    if (investAmount > remainingPoolCapacity) {
      investAmount = remainingPoolCapacity;
    }
    
    if (investAmount <= 0n) {
      if (remainingUserCapacity <= 0n) {
        console.log(`\n   ⚠️  User has reached max investment limit. Skipping...`);
      } else {
        console.log(`\n   ✅ Pool is full!`);
      }
      break;
    }
    
    console.log(`\n   Investment ${i + 1}: ${inv.investor.address.slice(0, 10)}... investing ${ethers.formatUnits(investAmount, 6)} USDC...`);
    console.log(`      Current user investment: ${ethers.formatUnits(currentUserInvestment, 6)} USDC`);
    console.log(`      Remaining user capacity: ${ethers.formatUnits(remainingUserCapacity, 6)} USDC`);
    
    // Check balance
    const usdcBalance = await mockUSDC.balanceOf(inv.investor.address);
    console.log(`      User USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    
    if (usdcBalance < investAmount) {
      console.log(`      ⚠️  Insufficient balance! Minting more USDC...`);
      await mockUSDC.mint(inv.investor.address, investAmount - usdcBalance);
    }
    
    // Approve and wait for confirmation
    console.log(`      Approving Pool Manager to spend USDC...`);
    const approveTx = await mockUSDC.connect(inv.investor).approve(contracts.NovaxPoolManager, investAmount);
    await approveTx.wait();
    
    // Check approval
    const allowance = await mockUSDC.allowance(inv.investor.address, contracts.NovaxPoolManager);
    console.log(`      Approval amount: ${ethers.formatUnits(allowance, 6)} USDC`);
    
    if (allowance < investAmount) {
      throw new Error(`Approval failed! Expected ${ethers.formatUnits(investAmount, 6)}, got ${ethers.formatUnits(allowance, 6)}`);
    }
    
    // Invest
    console.log(`      Investing...`);
    const investTx = await poolManager.connect(inv.investor).invest(rwaPoolId!, investAmount);
    await investTx.wait();
    
    totalInvested += investAmount;
    const userInvestment = await poolManager.getUserInvestment(rwaPoolId!, inv.investor.address);
    const poolToken = PoolToken.attach(rwaPool.poolToken);
    const balance = await poolToken.balanceOf(inv.investor.address);
    
    console.log(`   ✅ Investment successful!`);
    console.log(`      Total Investment: ${ethers.formatUnits(userInvestment, 6)} USDC`);
    console.log(`      Pool Tokens: ${ethers.formatUnits(balance, 18)}`);
  }
  
  const poolAfterInvest = await poolManager.getPool(rwaPoolId!);
  console.log(`\n   📊 Pool Status After Investments:`);
  console.log(`      Total Invested: ${ethers.formatUnits(poolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`      Total Shares: ${ethers.formatUnits(poolAfterInvest.totalShares, 18)}`);
  console.log(`      Target: ${ethers.formatUnits(poolAfterInvest.targetAmount, 6)} USDC`);
  console.log(`      Progress: ${(Number(poolAfterInvest.totalInvested) / Number(poolAfterInvest.targetAmount) * 100).toFixed(1)}%`);

  // STEP 5: Yield Distribution (Simulating 1 year)
  console.log("\n📈 STEP 5: Yield Distribution (After 1 Year)");
  console.log("─".repeat(60));
  const rwaTotalInvested = poolAfterInvest.totalInvested;
  const annualYield = (rwaTotalInvested * BigInt(apr)) / 10000n; // 12% of total invested
  console.log(`Calculating yield:`);
  console.log(`  Total Invested: ${ethers.formatUnits(rwaTotalInvested, 6)} USDC`);
  console.log(`  APR: ${apr / 100}%`);
  console.log(`  Annual Yield: ${ethers.formatUnits(annualYield, 6)} USDC`);
  
  // Mint yield USDC to deployer (simulating asset generating returns)
  await mockUSDC.mint(deployer.address, annualYield);
  
  // Check deployer balance
  const deployerBalance = await mockUSDC.balanceOf(deployer.address);
  console.log(`   Deployer USDC balance: ${ethers.formatUnits(deployerBalance, 6)} USDC`);
  console.log(`   Yield to distribute: ${ethers.formatUnits(annualYield, 6)} USDC`);
  
  // Approve and wait
  console.log(`   Approving Pool Manager for yield distribution...`);
  const approveYieldTx = await mockUSDC.connect(deployer).approve(contracts.NovaxPoolManager, annualYield);
  await approveYieldTx.wait();
  
  // Check approval
  const yieldAllowance = await mockUSDC.allowance(deployer.address, contracts.NovaxPoolManager);
  console.log(`   Yield approval: ${ethers.formatUnits(yieldAllowance, 6)} USDC`);
  
  // Check pool state before distribution
  const poolBeforeYield = await poolManager.getPool(rwaPoolId!);
  console.log(`   Pool total shares: ${ethers.formatUnits(poolBeforeYield.totalShares, 18)}`);
  console.log(`   Pool total invested: ${ethers.formatUnits(poolBeforeYield.totalInvested, 6)} USDC`);
  
  // Get investor addresses from pool token holders
  const poolToken = PoolToken.attach(poolBeforeYield.poolToken);
  const investorShares = await poolToken.balanceOf(investor1.address);
  console.log(`   Investor 1 shares: ${ethers.formatUnits(investorShares, 18)}`);
  
  console.log(`\n   Distributing yield to investors...`);
  try {
    const distributeTx = await poolManager.connect(deployer).distributeYield(rwaPoolId!, annualYield);
    await distributeTx.wait();
    console.log(`   ✅ Yield distributed successfully!`);
  } catch (error: any) {
    console.log(`   ❌ Yield distribution failed: ${error.message}`);
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    throw error;
  }
  
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

  // STEP 2: AMC Verifies Receivable
  console.log("\n🔍 STEP 2: AMC Verifies Receivable");
  console.log("─".repeat(60));
  const recRiskScore = 20; // 20% risk (low risk)
  const recApr = 1000; // 10% APR (1000 basis points)
  
  console.log(`Verifying receivable:`);
  console.log(`  Risk Score: ${recRiskScore}%`);
  console.log(`  APR: ${recApr / 100}%`);
  
  const verifyRecTx = await receivableFactory.connect(amc).verifyReceivable(
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

  // STEP 3: AMC Creates Receivable Pool
  console.log("\n🏊 STEP 3: AMC Creates Receivable Investment Pool");
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
  
  const createRecPoolTx = await poolManager.connect(amc).createPool(
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
  
  // Investment amounts must respect maxInvestment limit ($30,000)
  const recInvestments = [
    { investor: investor1, amount: ethers.parseUnits("30000", 6) }, // $30,000 (max)
    { investor: investor2, amount: ethers.parseUnits("30000", 6) }, // $30,000 (max)
    { investor: investor1, amount: ethers.parseUnits("15000", 6) }, // $15,000 (remaining)
  ];
  
  // Mint and invest
  const recTotalNeeded = recInvestments.reduce((sum, inv) => sum + inv.amount, 0n);
  await mockUSDC.mint(investor1.address, ethers.parseUnits("45000", 6)); // $45,000
  await mockUSDC.mint(investor2.address, ethers.parseUnits("30000", 6)); // $30,000
  
  for (let i = 0; i < recInvestments.length; i++) {
    const inv = recInvestments[i];
    const poolBefore = await poolManager.getPool(recPoolId!);
    
    // Check if we've reached the target
    if (poolBefore.totalInvested >= poolBefore.targetAmount) {
      console.log(`\n   ✅ Pool target reached! Stopping investments.`);
      break;
    }
    
    // Check user's current investment
    const currentUserInvestment = await poolManager.getUserInvestment(recPoolId!, inv.investor.address);
    const remainingUserCapacity = poolBefore.maxInvestment - currentUserInvestment;
    
    // Check remaining pool capacity
    const remainingPoolCapacity = poolBefore.targetAmount - poolBefore.totalInvested;
    
    // Calculate actual investment amount (respect both user max and pool capacity)
    let investAmount = inv.amount;
    if (investAmount > remainingUserCapacity) {
      investAmount = remainingUserCapacity;
    }
    if (investAmount > remainingPoolCapacity) {
      investAmount = remainingPoolCapacity;
    }
    
    if (investAmount <= 0n) {
      if (remainingUserCapacity <= 0n) {
        console.log(`\n   ⚠️  User has reached max investment limit. Skipping...`);
      } else {
        console.log(`\n   ✅ Pool is full!`);
      }
      break;
    }
    
    // Check balance
    const recUsdcBalance = await mockUSDC.balanceOf(inv.investor.address);
    console.log(`   Investor ${i + 1} investing ${ethers.formatUnits(investAmount, 6)} USDC...`);
    console.log(`      Current user investment: ${ethers.formatUnits(currentUserInvestment, 6)} USDC`);
    console.log(`      User USDC balance: ${ethers.formatUnits(recUsdcBalance, 6)} USDC`);
    
    if (recUsdcBalance < investAmount) {
      console.log(`      ⚠️  Insufficient balance! Minting more USDC...`);
      await mockUSDC.mint(inv.investor.address, investAmount - recUsdcBalance);
    }
    
    // Approve and wait for confirmation
    console.log(`      Approving Pool Manager to spend USDC...`);
    const recApproveTx = await mockUSDC.connect(inv.investor).approve(contracts.NovaxPoolManager, investAmount);
    await recApproveTx.wait();
    
    // Check approval
    const recAllowance = await mockUSDC.allowance(inv.investor.address, contracts.NovaxPoolManager);
    console.log(`      Approval amount: ${ethers.formatUnits(recAllowance, 6)} USDC`);
    
    if (recAllowance < investAmount) {
      throw new Error(`Approval failed! Expected ${ethers.formatUnits(investAmount, 6)}, got ${ethers.formatUnits(recAllowance, 6)}`);
    }
    
    // Invest
    console.log(`      Investing...`);
    const investTx = await poolManager.connect(inv.investor).invest(recPoolId!, investAmount);
    await investTx.wait();
    
    const userInvestment = await poolManager.getUserInvestment(recPoolId!, inv.investor.address);
    console.log(`   ✅ Total Investment: ${ethers.formatUnits(userInvestment, 6)} USDC`);
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
  // APR is in basis points (1000 = 10%), so we need to calculate: (principal * APR * days) / (100 * 365)
  // Using basis points: (principal * APR * days) / (10000 * 365)
  const periodYield = (recPoolAfterInvest.totalInvested * BigInt(recApr) * BigInt(daysHeld)) / (10000n * 365n);
  const totalPayout = recPoolAfterInvest.totalInvested + periodYield;
  
  console.log(`  Days Held: ${daysHeld}`);
  console.log(`  Principal: ${ethers.formatUnits(recPoolAfterInvest.totalInvested, 6)} USDC`);
  console.log(`  Yield (${daysHeld} days): ${ethers.formatUnits(periodYield, 6)} USDC`);
  console.log(`  Total Payout: ${ethers.formatUnits(totalPayout, 6)} USDC`);
  
  // Mint payout to deployer (simulating importer payment)
  await mockUSDC.mint(deployer.address, totalPayout);
  
  // Check deployer balance and approval
  const recDeployerBalance = await mockUSDC.balanceOf(deployer.address);
  console.log(`   Deployer USDC balance: ${ethers.formatUnits(recDeployerBalance, 6)} USDC`);
  console.log(`   Total payout to distribute: ${ethers.formatUnits(totalPayout, 6)} USDC`);
  
  // Approve and wait
  console.log(`   Approving Pool Manager for payout distribution...`);
  const recApprovePayoutTx = await mockUSDC.connect(deployer).approve(contracts.NovaxPoolManager, totalPayout);
  await recApprovePayoutTx.wait();
  
  // Check approval
  const recPayoutAllowance = await mockUSDC.allowance(deployer.address, contracts.NovaxPoolManager);
  console.log(`   Payout approval: ${ethers.formatUnits(recPayoutAllowance, 6)} USDC`);
  
  // Check pool state before distribution
  const recPoolBeforePayout = await poolManager.getPool(recPoolId!);
  console.log(`   Pool total shares: ${ethers.formatUnits(recPoolBeforePayout.totalShares, 18)}`);
  
  console.log(`\n   Distributing principal + yield...`);
  try {
    const distributeRecTx = await poolManager.connect(deployer).distributeYield(recPoolId!, totalPayout);
    await distributeRecTx.wait();
    console.log(`   ✅ Payout distributed successfully!`);
  } catch (error: any) {
    console.log(`   ❌ Payout distribution failed: ${error.message}`);
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    throw error;
  }
  
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
  console.log("\n🎉 All flows tested successfully on Etherlink Shadownet!");
  console.log("\n🔗 View contracts on Explorer:");
  console.log(`  RWA Factory: https://shadownet.explorer.etherlink.com/address/${contracts.NovaxRwaFactory}`);
  console.log(`  Pool Manager: https://shadownet.explorer.etherlink.com/address/${contracts.NovaxPoolManager}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

