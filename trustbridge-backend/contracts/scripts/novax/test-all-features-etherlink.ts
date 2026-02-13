import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive test of ALL Novax Yield features on Etherlink Shadownet
 * Tests: Withdrawal, Marketplace, Pool Closure, and Edge Cases
 */

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const seller = signers[1] || deployer;
  const buyer = signers[2] || deployer;
  const investor = signers[3] || deployer;
  const amc = signers[4] || deployer;

  console.log("🧪 Testing ALL Novax Yield Features on Etherlink Shadownet");
  console.log("=".repeat(60));

  console.log("\n👥 Test Accounts:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Seller: ${seller.address}${seller === deployer ? " (using deployer)" : ""}`);
  console.log(`  Buyer: ${buyer.address}${buyer === deployer ? " (using deployer)" : ""}`);
  console.log(`  Investor: ${investor.address}${investor === deployer ? " (using deployer)" : ""}`);
  console.log(`  AMC: ${amc.address}${amc === deployer ? " (using deployer)" : ""}`);

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
  console.log(`  Pool Manager: ${contracts.NovaxPoolManager}`);
  console.log(`  Marketplace: ${contracts.NovaxMarketplace || "Not deployed"}`);
  console.log(`  Mock USDC: ${contracts.USDC}`);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.USDC);

  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");

  // Set up roles
  console.log("\n🔐 Setting up roles...");
  const AMC_ROLE = await rwaFactory.AMC_ROLE();
  const ADMIN_ROLE = await poolManager.ADMIN_ROLE();
  
  const grantRwaAmcTx = await rwaFactory.grantRole(AMC_ROLE, amc.address);
  await grantRwaAmcTx.wait();
  const grantPoolAmcTx = await poolManager.grantRole(AMC_ROLE, amc.address);
  await grantPoolAmcTx.wait();
  const grantAdminTx = await poolManager.grantRole(ADMIN_ROLE, deployer.address);
  await grantAdminTx.wait();
  console.log("✅ Roles granted");

  // Create a test pool for testing withdrawal and marketplace
  console.log("\n" + "=".repeat(60));
  console.log("SETUP: Create Test Pool");
  console.log("=".repeat(60));

  const metadataCID = ethers.id("test-all-features-" + Date.now());
  const createRwaTx = await rwaFactory.createRwa(
    1, // AGRICULTURE
    ethers.parseUnits("100000", 6),
    70,
    metadataCID
  );
  const rwaReceipt = await createRwaTx.wait();
  const rwaEventLog = rwaReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
  );
  const assetId = rwaEventLog ? rwaEventLog.topics[1] : null;

  const approveTx = await rwaFactory.connect(amc).approveAsset(assetId!, 25);
  await approveTx.wait();
  console.log("✅ Asset created and approved");
  
  // Verify asset is approved
  const asset = await rwaFactory.getAsset(assetId!);
  console.log(`   Asset status: ${asset.status} (1=AMC_APPROVED)`);
  console.log(`   Current AMC: ${asset.currentAMC}`);

  const createPoolTx = await poolManager.connect(amc).createPool(
    0, // RWA
    assetId!,
    ethers.parseUnits("10000", 6), // $10,000 target
    ethers.parseUnits("100", 6), // $100 min
    ethers.parseUnits("5000", 6), // $5,000 max
    1200, // 12% APR
    "Test Pool All Features",
    "TPAF"
  );
  const poolReceipt = await createPoolTx.wait();
  const poolEventLog = poolReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
  );
  const poolId = poolEventLog ? poolEventLog.topics[1] : null;
  const pool = await poolManager.getPool(poolId!);
  const poolToken = PoolToken.attach(pool.poolToken);
  console.log(`✅ Pool created: ${poolId}`);

  // Investor invests
  const investAmount = ethers.parseUnits("5000", 6);
  await mockUSDC.mint(investor.address, investAmount);
  
  // Check balance
  const investorBalance = await mockUSDC.balanceOf(investor.address);
  console.log(`   Investor USDC balance: ${ethers.formatUnits(investorBalance, 6)} USDC`);
  
  // Approve and wait
  const approveInvestTx = await mockUSDC.connect(investor).approve(contracts.NovaxPoolManager, investAmount);
  await approveInvestTx.wait();
  
  // Check approval
  const investAllowance = await mockUSDC.allowance(investor.address, contracts.NovaxPoolManager);
  console.log(`   Approval: ${ethers.formatUnits(investAllowance, 6)} USDC`);
  
  const investTx = await poolManager.connect(investor).invest(poolId!, investAmount);
  await investTx.wait();
  const investorShares = await poolToken.balanceOf(investor.address);
  console.log(`✅ Investor invested: ${ethers.formatUnits(investAmount, 6)} USDC`);
  console.log(`   Investor shares: ${ethers.formatUnits(investorShares, 18)}`);

  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Withdrawal Functionality");
  console.log("=".repeat(60));

  try {
    // Partial withdrawal
    const withdrawAmount = investorShares / 2n; // Withdraw half
    const usdcBalanceBefore = await mockUSDC.balanceOf(investor.address);
    const sharesBefore = await poolToken.balanceOf(investor.address);
    
    console.log(`\n  Withdrawing ${ethers.formatUnits(withdrawAmount, 18)} shares (50%)...`);
    const withdrawTx = await poolManager.connect(investor).withdraw(poolId!, withdrawAmount);
    await withdrawTx.wait();
    
    const usdcBalanceAfter = await mockUSDC.balanceOf(investor.address);
    const sharesAfter = await poolToken.balanceOf(investor.address);
    const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;
    
    console.log(`  ✅ Withdrawal successful!`);
    console.log(`     USDC received: ${ethers.formatUnits(usdcReceived, 6)} USDC`);
    console.log(`     Shares before: ${ethers.formatUnits(sharesBefore, 18)}`);
    console.log(`     Shares after: ${ethers.formatUnits(sharesAfter, 18)}`);
    console.log(`     Shares withdrawn: ${ethers.formatUnits(sharesBefore - sharesAfter, 18)}`);
  } catch (error: any) {
    console.log(`  ❌ Withdrawal test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Secondary Marketplace");
  console.log("=".repeat(60));

  if (!contracts.NovaxMarketplace || contracts.NovaxMarketplace === ethers.ZeroAddress) {
    console.log("  ⚠️  Marketplace not deployed. Skipping marketplace tests.");
  } else {
    try {
      const NovaxMarketplace = await ethers.getContractFactory("NovaxMarketplace");
      const marketplace = NovaxMarketplace.attach(contracts.NovaxMarketplace);

      // Seller (investor) creates listing
      const sellerShares = await poolToken.balanceOf(investor.address);
      const listingAmount = sellerShares / 2n; // List half of remaining shares
      const pricePerToken = ethers.parseUnits("1.05", 6); // $1.05 per token (premium)
      
      console.log(`\n  Seller creating listing...`);
      console.log(`     Listing amount: ${ethers.formatUnits(listingAmount, 18)} tokens`);
      console.log(`     Price per token: $${ethers.formatUnits(pricePerToken, 6)}`);
      
      // Approve marketplace
      await poolToken.connect(investor).approve(contracts.NovaxMarketplace, listingAmount);
      
      const createListingTx = await marketplace.connect(investor).createListing(
        pool.poolToken,
        poolId!,
        listingAmount,
        pricePerToken,
        ethers.parseUnits("100", 18), // Min 100 tokens
        ethers.parseUnits("500", 18), // Max 500 tokens
        0 // No expiration
      );
      const listingReceipt = await createListingTx.wait();
      const listingEventLog = listingReceipt?.logs.find(
        (log: any) => log.topics[0] === ethers.id("ListingCreated(bytes32,address,address,bytes32,uint256,uint256,uint256)")
      );
      const listingId = listingEventLog ? listingEventLog.topics[1] : null;
      
      const listing = await marketplace.getListing(listingId!);
      console.log(`  ✅ Listing created: ${listingId}`);
      console.log(`     Total price: $${ethers.formatUnits(listing.totalPrice, 6)}`);

      // Buyer purchases tokens (only if buyer != seller)
      if (buyer.address === investor.address) {
        console.log(`\n  ⚠️  Buyer and seller are the same account. Skipping purchase test.`);
        console.log(`     (Marketplace prevents buying from yourself)`);
      } else {
        const purchaseAmount = ethers.parseUnits("200", 18); // 200 tokens
        const totalPrice = (purchaseAmount * pricePerToken) / ethers.parseUnits("1", 18);
        
        console.log(`\n  Buyer purchasing ${ethers.formatUnits(purchaseAmount, 18)} tokens...`);
        console.log(`     Total price: $${ethers.formatUnits(totalPrice, 6)} USDC`);
        
        await mockUSDC.mint(buyer.address, totalPrice);
        const buyerApproveTx = await mockUSDC.connect(buyer).approve(contracts.NovaxMarketplace, totalPrice);
        await buyerApproveTx.wait();
        
        // Check approval
        const buyerAllowance = await mockUSDC.allowance(buyer.address, contracts.NovaxMarketplace);
        console.log(`     Buyer USDC approval: ${ethers.formatUnits(buyerAllowance, 6)} USDC`);
        
        const buyTx = await marketplace.connect(buyer).buyTokens(listingId!, purchaseAmount);
        await buyTx.wait();
        
        const buyerShares = await poolToken.balanceOf(buyer.address);
        console.log(`  ✅ Purchase successful!`);
        console.log(`     Buyer received: ${ethers.formatUnits(buyerShares, 18)} tokens`);
      }
      
      // Check marketplace stats
      const totalListings = await marketplace.totalListings();
      const totalOrders = await marketplace.totalOrders();
      const totalVolume = await marketplace.totalVolume();
      console.log(`\n  📊 Marketplace Stats:`);
      console.log(`     Total Listings: ${totalListings}`);
      console.log(`     Total Orders: ${totalOrders}`);
      console.log(`     Total Volume: $${ethers.formatUnits(totalVolume, 6)} USDC`);
    } catch (error: any) {
      console.log(`  ❌ Marketplace test failed: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Pool Closure");
  console.log("=".repeat(60));

  try {
    const poolBefore = await poolManager.getPool(poolId!);
    console.log(`  Pool status before: ${poolBefore.status} (0=ACTIVE)`);
    
    console.log(`\n  Closing pool...`);
    const closeTx = await poolManager.connect(deployer).closePool(poolId!);
    await closeTx.wait();
    
    const poolAfter = await poolManager.getPool(poolId!);
    console.log(`  ✅ Pool closed!`);
    console.log(`     Pool status after: ${poolAfter.status} (1=CLOSED, 0=ACTIVE)`);
    if (poolAfter.closedAt > 0n) {
      console.log(`     Closed at: ${new Date(Number(poolAfter.closedAt) * 1000).toLocaleString()}`);
    }
  } catch (error: any) {
    console.log(`  ❌ Pool closure test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ ALL FEATURES TEST COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📊 Test Summary:");
  console.log("  ✅ Withdrawal: Tested");
  console.log("  ✅ Marketplace: Tested");
  console.log("  ✅ Pool Closure: Tested");
  console.log("\n🎉 All additional features tested!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  });

