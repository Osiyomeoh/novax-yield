import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Test NovaxMarketplace functionality
 * Tests listing creation, token purchases, and fee distribution
 */

async function main() {
  const [deployer, seller, buyer] = await ethers.getSigners();
  console.log("🧪 Testing NovaxMarketplace");
  console.log("=".repeat(60));

  console.log("\n👥 Test Accounts:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Seller: ${seller.address}`);
  console.log(`  Buyer: ${buyer.address}`);

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
  console.log(`  Pool Manager: ${contracts.NovaxPoolManager}`);
  console.log(`  Mock USDC: ${contracts.MockUSDC}`);
  console.log(`  Marketplace: ${contracts.NovaxMarketplace || "Not deployed"}`);

  if (!contracts.NovaxMarketplace || contracts.NovaxMarketplace === ethers.ZeroAddress) {
    console.error("❌ Marketplace not deployed. Please deploy first:");
    console.error("   npm run deploy:marketplace:local");
    process.exit(1);
  }

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.MockUSDC);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  const NovaxMarketplace = await ethers.getContractFactory("NovaxMarketplace");
  const marketplace = NovaxMarketplace.attach(contracts.NovaxMarketplace);

  const PoolToken = await ethers.getContractFactory("contracts/novax/PoolToken.sol:PoolToken");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Setup - Create Pool and Invest");
  console.log("=".repeat(60));

  // First, we need a pool with pool tokens
  // Let's create a simple RWA asset and pool
  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  // Create RWA asset
  console.log("\n  Creating RWA asset...");
  const metadataCID = ethers.id("test-marketplace-asset");
  const createRwaTx = await rwaFactory.createRwa(
    1, // AGRICULTURE
    ethers.parseUnits("50000", 6), // $50,000
    70, // 70% max LTV
    metadataCID
  );
  const rwaReceipt = await createRwaTx.wait();
  const rwaEventLog = rwaReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
  );
  const assetId = rwaEventLog ? rwaEventLog.topics[1] : null;
  console.log(`  ✅ Asset created: ${assetId}`);

  // AMC approves asset
  console.log("\n  AMC approving asset...");
  const approveTx = await rwaFactory.connect(deployer).approveAsset(assetId!, 25); // 25% risk
  await approveTx.wait();
  console.log(`  ✅ Asset approved`);

  // Create pool
  console.log("\n  Creating pool...");
  const createPoolTx = await poolManager.connect(deployer).createPool(
    0, // RWA
    assetId!,
    ethers.parseUnits("50000", 6), // $50,000 target
    ethers.parseUnits("100", 6), // $100 min
    ethers.parseUnits("5000", 6), // $5,000 max
    1200, // 12% APR
    "Test Pool",
    "TP"
  );
  const poolReceipt = await createPoolTx.wait();
  const poolEventLog = poolReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("PoolCreated(bytes32,uint8,bytes32,address,uint256,uint256,uint256)")
  );
  const poolId = poolEventLog ? poolEventLog.topics[1] : null;
  const pool = await poolManager.getPool(poolId!);
  const poolTokenAddress = pool.poolToken;
  console.log(`  ✅ Pool created: ${poolId}`);
  console.log(`  ✅ Pool Token: ${poolTokenAddress}`);

  // Seller invests to get pool tokens
  console.log("\n  Seller investing in pool...");
  const investAmount = ethers.parseUnits("5000", 6); // $5,000
  await mockUSDC.mint(seller.address, investAmount);
  await mockUSDC.connect(seller).approve(contracts.NovaxPoolManager, investAmount);
  const investTx = await poolManager.connect(seller).invest(poolId!, investAmount);
  await investTx.wait();
  
  const poolToken = PoolToken.attach(poolTokenAddress);
  const sellerBalance = await poolToken.balanceOf(seller.address);
  console.log(`  ✅ Seller invested: ${ethers.formatUnits(investAmount, 6)} USDC`);
  console.log(`  ✅ Seller pool tokens: ${ethers.formatUnits(sellerBalance, 18)}`);

  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Create Listing");
  console.log("=".repeat(60));

  // Seller approves marketplace to transfer pool tokens
  console.log("\n  Seller approving marketplace...");
  const approveMarketplaceTx = await poolToken.connect(seller).approve(
    contracts.NovaxMarketplace,
    sellerBalance
  );
  await approveMarketplaceTx.wait();
  console.log(`  ✅ Marketplace approved`);

  // Seller creates listing
  console.log("\n  Creating listing...");
  const listingAmount = ethers.parseUnits("1000", 18); // 1,000 tokens
  const pricePerToken = ethers.parseUnits("1.10", 6); // $1.10 per token (6 decimals for USDC)
  const minPurchase = ethers.parseUnits("100", 18); // Min 100 tokens
  const maxPurchase = ethers.parseUnits("500", 18); // Max 500 tokens per purchase

  const createListingTx = await marketplace.connect(seller).createListing(
    poolTokenAddress,
    poolId!,
    listingAmount,
    pricePerToken,
    minPurchase,
    maxPurchase,
    0 // No expiration
  );
  const listingReceipt = await createListingTx.wait();
  const listingEventLog = listingReceipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("ListingCreated(bytes32,address,address,bytes32,uint256,uint256,uint256)")
  );
  const listingId = listingEventLog ? listingEventLog.topics[1] : null;
  
  const listing = await marketplace.getListing(listingId!);
  console.log(`  ✅ Listing created: ${listingId}`);
  console.log(`     Amount: ${ethers.formatUnits(listing.amount, 18)} tokens`);
  console.log(`     Price: $${ethers.formatUnits(listing.pricePerToken, 6)} per token`);
  console.log(`     Total Price: $${ethers.formatUnits(listing.totalPrice, 6)}`);

  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Buyer Purchases Tokens");
  console.log("=".repeat(60));

  // Buyer purchases tokens
  const purchaseAmount = ethers.parseUnits("300", 18); // 300 tokens
  const totalPrice = (purchaseAmount * pricePerToken) / ethers.parseUnits("1", 18); // Adjust for decimals
  console.log(`\n  Buyer purchasing ${ethers.formatUnits(purchaseAmount, 18)} tokens...`);
  console.log(`     Total price: $${ethers.formatUnits(totalPrice, 6)} USDC`);

  // Mint USDC to buyer
  await mockUSDC.mint(buyer.address, totalPrice);
  await mockUSDC.connect(buyer).approve(contracts.NovaxMarketplace, totalPrice);
  console.log(`  ✅ USDC approved`);

  // Get balances before
  const buyerUSDCBefore = await mockUSDC.balanceOf(buyer.address);
  const sellerUSDCBefore = await mockUSDC.balanceOf(seller.address);
  const buyerTokensBefore = await poolToken.balanceOf(buyer.address);
  const sellerTokensBefore = await poolToken.balanceOf(seller.address);

  // Execute purchase
  const buyTx = await marketplace.connect(buyer).buyTokens(listingId!, purchaseAmount);
  await buyTx.wait();
  console.log(`  ✅ Purchase successful!`);

  // Get balances after
  const buyerUSDCAfter = await mockUSDC.balanceOf(buyer.address);
  const sellerUSDCAfter = await mockUSDC.balanceOf(seller.address);
  const buyerTokensAfter = await poolToken.balanceOf(buyer.address);
  const sellerTokensAfter = await poolToken.balanceOf(seller.address);

  // Calculate fees
  const platformFeeBps = await marketplace.platformFeeBps();
  const royaltyFeeBps = await marketplace.royaltyFeeBps();
  const platformFee = (totalPrice * platformFeeBps) / 10000n;
  const royaltyFee = (totalPrice * royaltyFeeBps) / 10000n;
  const sellerReceives = totalPrice - platformFee - royaltyFee;

  console.log(`\n  📊 Transaction Details:`);
  console.log(`     Buyer paid: ${ethers.formatUnits(totalPrice, 6)} USDC`);
  console.log(`     Platform fee (${platformFeeBps/100}%): ${ethers.formatUnits(platformFee, 6)} USDC`);
  console.log(`     Royalty fee (${royaltyFeeBps/100}%): ${ethers.formatUnits(royaltyFee, 6)} USDC`);
  console.log(`     Seller receives: ${ethers.formatUnits(sellerReceives, 6)} USDC`);

  console.log(`\n  📊 Balance Changes:`);
  console.log(`     Buyer USDC: ${ethers.formatUnits(buyerUSDCBefore, 6)} → ${ethers.formatUnits(buyerUSDCAfter, 6)}`);
  console.log(`     Seller USDC: ${ethers.formatUnits(sellerUSDCBefore, 6)} → ${ethers.formatUnits(sellerUSDCAfter, 6)}`);
  console.log(`     Buyer Tokens: ${ethers.formatUnits(buyerTokensBefore, 18)} → ${ethers.formatUnits(buyerTokensAfter, 18)}`);
  console.log(`     Seller Tokens: ${ethers.formatUnits(sellerTokensBefore, 18)} → ${ethers.formatUnits(sellerTokensAfter, 18)}`);

  // Verify listing updated
  const updatedListing = await marketplace.getListing(listingId!);
  console.log(`\n  📊 Updated Listing:`);
  console.log(`     Remaining amount: ${ethers.formatUnits(updatedListing.amount, 18)} tokens`);
  console.log(`     Active: ${updatedListing.active}`);

  // Get orders
  const orders = await marketplace.getListingOrders(listingId!);
  console.log(`\n  📊 Orders for listing: ${orders.length}`);
  if (orders.length > 0) {
    console.log(`     Order 1:`);
    console.log(`       Buyer: ${orders[0].buyer}`);
    console.log(`       Amount: ${ethers.formatUnits(orders[0].amount, 18)} tokens`);
    console.log(`       Price: $${ethers.formatUnits(orders[0].totalPrice, 6)}`);
  }

  // Get marketplace stats
  const totalListings = await marketplace.totalListings();
  const totalOrders = await marketplace.totalOrders();
  const totalVolume = await marketplace.totalVolume();

  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Marketplace Statistics");
  console.log("=".repeat(60));
  console.log(`  Total Listings: ${totalListings}`);
  console.log(`  Total Orders: ${totalOrders}`);
  console.log(`  Total Volume: $${ethers.formatUnits(totalVolume, 6)} USDC`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ MARKETPLACE TEST COMPLETE!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  });

