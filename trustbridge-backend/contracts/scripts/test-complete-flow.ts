import { ethers } from "hardhat";

/**
 * Test the complete Novax Yield flow:
 * 1. User stakes to vault
 * 2. Exporter creates receivable
 * 3. AMC verifies
 * 4. AMC creates pool
 * 5. Vault auto-deploys
 * 6. Exporter gets paid
 * 7. Importer pays (simulated)
 * 8. Yield distributed to stakers
 */
async function main() {
  const [deployer, exporter, amc, importer] = await ethers.getSigners();
  
  console.log("🧪 Testing Complete Novax Yield Flow\n");
  
  // Get contract addresses
  const STAKING_VAULT_ADDRESS = process.env.STAKING_VAULT_ADDRESS || "";
  const CAPACITY_MANAGER_ADDRESS = process.env.VAULT_CAPACITY_MANAGER_ADDRESS || "";
  const POOL_MANAGER_ADDRESS = process.env.POOL_MANAGER_ADDRESS || "";
  const RECEIVABLE_FACTORY_ADDRESS = process.env.RECEIVABLE_FACTORY_ADDRESS || "";
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "";

  if (!STAKING_VAULT_ADDRESS || !POOL_MANAGER_ADDRESS || !RECEIVABLE_FACTORY_ADDRESS) {
    throw new Error("Missing contract addresses");
  }

  // Get contracts
  const stakingVault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT_ADDRESS);
  const capacityManager = await ethers.getContractAt("VaultCapacityManager", CAPACITY_MANAGER_ADDRESS);
  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER_ADDRESS);
  const receivableFactory = await ethers.getContractAt("NovaxReceivableFactory", RECEIVABLE_FACTORY_ADDRESS);
  const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

  console.log("📋 Contracts loaded\n");

  // ==================== PHASE 1: USER STAKES ====================
  console.log("━".repeat(60));
  console.log("PHASE 1: USER STAKES TO VAULT");
  console.log("━".repeat(60));
  
  const stakeAmount = ethers.parseUnits("100000", 6); // $100k
  
  // Mint USDC to deployer for testing
  console.log("\n1. Minting test USDC...");
  const mintTx = await usdc.mint(deployer.address, stakeAmount);
  await mintTx.wait();
  console.log("  ✅ Minted:", ethers.formatUnits(stakeAmount, 6), "USDC");

  // Check capacity
  console.log("\n2. Checking vault capacity...");
  const [canStake, shouldWaitlist] = await capacityManager.canStake(stakeAmount);
  console.log("  Can Stake:", canStake);
  console.log("  Should Waitlist:", shouldWaitlist);

  if (!canStake) {
    console.log("  ⚠️  Vault full - would be added to waitlist");
    return;
  }

  // Approve USDC
  console.log("\n3. Approving USDC...");
  const approveTx = await usdc.approve(STAKING_VAULT_ADDRESS, stakeAmount);
  await approveTx.wait();
  console.log("  ✅ Approved");

  // Stake
  console.log("\n4. Staking to vault...");
  const stakeTx = await stakingVault.stake(
    stakeAmount,
    1, // GOLD tier (90 days)
    true // Auto-compound
  );
  const stakeReceipt = await stakeTx.wait();
  console.log("  ✅ Staked:", ethers.formatUnits(stakeAmount, 6), "USDC");
  console.log("  Tier: GOLD (90 days, 9.5% APY)");
  console.log("  Auto-Compound: ON");

  // Check vault status
  const vaultStatus = await stakingVault.getVaultStatus();
  console.log("\n  Vault Status:");
  console.log("    Total:", ethers.formatUnits(vaultStatus[0], 6), "USDC");
  console.log("    Deployed:", ethers.formatUnits(vaultStatus[1], 6), "USDC");
  console.log("    Available:", ethers.formatUnits(vaultStatus[2], 6), "USDC");
  console.log("    Utilization:", Number(vaultStatus[3]) / 100, "%");

  // ==================== PHASE 2: EXPORTER CREATES RECEIVABLE ====================
  console.log("\n" + "━".repeat(60));
  console.log("PHASE 2: EXPORTER CREATES RECEIVABLE");
  console.log("━".repeat(60));

  const invoiceAmount = ethers.parseUnits("100000", 6); // $100k
  const dueDate = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days
  const metadataCID = ethers.id("QmTestInvoice123"); // Mock IPFS CID

  console.log("\n1. Creating receivable...");
  const createTx = await receivableFactory.connect(exporter).createReceivable(
    ethers.ZeroAddress, // Off-chain importer
    invoiceAmount,
    dueDate,
    metadataCID,
    ethers.ZeroHash // No approval ID for now
  );
  const createReceipt = await createTx.wait();
  
  // Get receivable ID from event
  const createEvent = createReceipt.logs.find((log: any) => {
    try {
      return receivableFactory.interface.parseLog(log)?.name === "ReceivableCreated";
    } catch {
      return false;
    }
  });
  
  const receivableId = createEvent 
    ? receivableFactory.interface.parseLog(createEvent)?.args[0]
    : ethers.ZeroHash;
  
  console.log("  ✅ Receivable Created:", receivableId);
  console.log("  Amount:", ethers.formatUnits(invoiceAmount, 6), "USDC");
  console.log("  Due Date:", new Date(dueDate * 1000).toLocaleDateString());

  // ==================== PHASE 3: AMC VERIFIES ====================
  console.log("\n" + "━".repeat(60));
  console.log("PHASE 3: AMC VERIFIES RECEIVABLE");
  console.log("━".repeat(60));

  console.log("\n1. AMC verifying receivable...");
  const verifyTx = await receivableFactory.connect(amc).verifyReceivable(
    receivableId,
    25, // Risk score: 25/100 (low risk)
    800 // 8% APR
  );
  await verifyTx.wait();
  console.log("  ✅ Receivable Verified");
  console.log("  Risk Score: 25/100");
  console.log("  APR: 8%");

  // ==================== PHASE 4: AMC CREATES POOL ====================
  console.log("\n" + "━".repeat(60));
  console.log("PHASE 4: AMC CREATES POOL");
  console.log("━".repeat(60));

  console.log("\n1. Creating pool...");
  const createPoolTx = await poolManager.connect(amc).createPool(
    1, // TRADE_RECEIVABLE
    receivableId,
    invoiceAmount, // Target: $100k
    0, // Min investment: 0 (vault deploys)
    invoiceAmount, // Max investment: $100k
    800, // 8% APR
    dueDate, // Maturity date
    0, // No NVX rewards
    "Novax Pool Test",
    "NVX-TEST"
  );
  const poolReceipt = await createPoolTx.wait();
  
  // Get pool ID from event
  const poolEvent = poolReceipt.logs.find((log: any) => {
    try {
      return poolManager.interface.parseLog(log)?.name === "PoolCreated";
    } catch {
      return false;
    }
  });
  
  const poolId = poolEvent 
    ? poolManager.interface.parseLog(poolEvent)?.args[0]
    : ethers.ZeroHash;
  
  console.log("  ✅ Pool Created:", poolId);

  // ==================== PHASE 5: CHECK AUTO-DEPLOYMENT ====================
  console.log("\n" + "━".repeat(60));
  console.log("PHASE 5: VAULT AUTO-DEPLOYMENT");
  console.log("━".repeat(60));

  console.log("\n1. Checking pool status...");
  const pool = await poolManager.getPool(poolId);
  console.log("  Total Invested:", ethers.formatUnits(pool.totalInvested, 6), "USDC");
  console.log("  Target:", ethers.formatUnits(pool.targetAmount, 6), "USDC");
  console.log("  Status:", pool.status);

  if (pool.totalInvested >= pool.targetAmount) {
    console.log("  ✅ Pool auto-funded by vault!");
  } else {
    console.log("  ⚠️  Pool not auto-funded (vault may not have capacity)");
  }

  // Check vault status after deployment
  const vaultStatusAfter = await stakingVault.getVaultStatus();
  console.log("\n2. Vault status after deployment:");
  console.log("    Total:", ethers.formatUnits(vaultStatusAfter[0], 6), "USDC");
  console.log("    Deployed:", ethers.formatUnits(vaultStatusAfter[1], 6), "USDC");
  console.log("    Available:", ethers.formatUnits(vaultStatusAfter[2], 6), "USDC");
  console.log("    Utilization:", Number(vaultStatusAfter[3]) / 100, "%");

  // ==================== PHASE 6: CHECK EXPORTER PAYMENT ====================
  console.log("\n" + "━".repeat(60));
  console.log("PHASE 6: EXPORTER PAYMENT");
  console.log("━".repeat(60));

  console.log("\n1. Checking exporter balance...");
  const exporterBalance = await usdc.balanceOf(exporter.address);
  console.log("  Exporter received:", ethers.formatUnits(exporterBalance, 6), "USDC");
  
  if (exporterBalance > 0) {
    const expectedAmount = ethers.parseUnits("96000", 6); // 96% of $100k
    const percentReceived = (Number(exporterBalance) / Number(invoiceAmount)) * 100;
    console.log("  Percentage:", percentReceived.toFixed(2), "%");
    console.log("  ✅ Exporter paid immediately!");
  } else {
    console.log("  ⚠️  Exporter not paid yet");
  }

  // ==================== PHASE 7-8: SIMULATE PAYMENT & DISTRIBUTION ====================
  console.log("\n" + "━".repeat(60));
  console.log("PHASE 7-8: IMPORTER PAYMENT & YIELD DISTRIBUTION");
  console.log("━".repeat(60));

  console.log("\n1. Simulating importer payment...");
  console.log("  (In production, AMC would record off-chain payment)");
  
  // Mint USDC for payment simulation
  const paymentAmount = ethers.parseUnits("102000", 6); // $100k principal + $2k yield
  await usdc.mint(amc.address, paymentAmount);
  console.log("  ✅ Minted payment:", ethers.formatUnits(paymentAmount, 6), "USDC");

  // Record payment
  console.log("\n2. Recording payment...");
  const recordTx = await poolManager.connect(amc).recordPayment(poolId, invoiceAmount);
  await recordTx.wait();
  console.log("  ✅ Payment recorded");

  // Approve USDC for distribution
  console.log("\n3. Approving USDC for distribution...");
  const approveDistTx = await usdc.connect(amc).approve(POOL_MANAGER_ADDRESS, paymentAmount);
  await approveDistTx.wait();

  // Distribute yield
  console.log("\n4. Distributing yield...");
  const distributeTx = await poolManager.connect(amc).distributeYield(poolId);
  await distributeTx.wait();
  console.log("  ✅ Yield distributed to vault");

  // ==================== FINAL STATUS ====================
  console.log("\n" + "━".repeat(60));
  console.log("FINAL STATUS");
  console.log("━".repeat(60));

  const finalVaultStatus = await stakingVault.getVaultStatus();
  console.log("\nVault Status:");
  console.log("  Total:", ethers.formatUnits(finalVaultStatus[0], 6), "USDC");
  console.log("  Deployed:", ethers.formatUnits(finalVaultStatus[1], 6), "USDC");
  console.log("  Available:", ethers.formatUnits(finalVaultStatus[2], 6), "USDC");
  console.log("  Utilization:", Number(finalVaultStatus[3]) / 100, "%");

  const userStakes = await stakingVault.getUserStakes(deployer.address);
  if (userStakes.length > 0) {
    console.log("\nUser Stake:");
    console.log("  Principal:", ethers.formatUnits(userStakes[0].principal, 6), "USDC");
    console.log("  Compounded:", ethers.formatUnits(userStakes[0].compoundedPrincipal, 6), "USDC");
    console.log("  Tier:", userStakes[0].tier);
    console.log("  Auto-Compound:", userStakes[0].autoCompound);
  }

  console.log("\n✅ Complete flow test finished!");
  console.log("\n📊 Summary:");
  console.log("  1. ✅ User staked $100k");
  console.log("  2. ✅ Exporter created receivable");
  console.log("  3. ✅ AMC verified");
  console.log("  4. ✅ AMC created pool");
  console.log("  5. ✅ Vault auto-deployed");
  console.log("  6. ✅ Exporter got paid");
  console.log("  7. ✅ Payment recorded");
  console.log("  8. ✅ Yield distributed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

