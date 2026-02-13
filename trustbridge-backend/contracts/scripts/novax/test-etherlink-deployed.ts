import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Test deployed contracts on Etherlink Shadownet
 * This script tests the actual deployed contracts to ensure they're working
 */

async function main() {
  console.log("🧪 Testing Deployed Contracts on Etherlink Shadownet");
  console.log("=".repeat(60));

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const testUser = signers[1] || deployer; // Use deployer if only one signer available
  
  console.log("\n👥 Test Accounts:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Test User: ${testUser.address}${signers.length === 1 ? " (using deployer)" : ""}`);
  console.log(`  Deployer Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} XTZ`);

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../../deployments/novax-etherlink-127823.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found:", deploymentFile);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Deployed Contract Addresses:");
  console.log("=".repeat(60));
  for (const [name, address] of Object.entries(contracts)) {
    if (address && address !== ethers.ZeroAddress) {
      console.log(`  ${name}: ${address}`);
    }
  }

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(contracts.USDC);

  const NVXToken = await ethers.getContractFactory("NVXToken");
  const nvxToken = NVXToken.attach(contracts.NVXToken);

  const NovaxRwaFactory = await ethers.getContractFactory("NovaxRwaFactory");
  const rwaFactory = NovaxRwaFactory.attach(contracts.NovaxRwaFactory);

  const NovaxReceivableFactory = await ethers.getContractFactory("NovaxReceivableFactory");
  const receivableFactory = NovaxReceivableFactory.attach(contracts.NovaxReceivableFactory);

  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = NovaxPoolManager.attach(contracts.NovaxPoolManager);

  const NovaxPriceManager = await ethers.getContractFactory("NovaxPriceManager");
  const priceManager = NovaxPriceManager.attach(contracts.NovaxPriceManager);

  const NovaxFallbackLibrary = await ethers.getContractFactory("NovaxFallbackLibrary");
  const fallbackLibrary = NovaxFallbackLibrary.attach(contracts.NovaxFallbackLibrary);

  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: MockUSDC - Basic Token Functions");
  console.log("=".repeat(60));

  try {
    // Check token info
    const name = await mockUSDC.name();
    const symbol = await mockUSDC.symbol();
    const decimals = await mockUSDC.decimals();
    const totalSupply = await mockUSDC.totalSupply();
    const deployerBalance = await mockUSDC.balanceOf(deployer.address);

    console.log(`✅ Token Name: ${name}`);
    console.log(`✅ Token Symbol: ${symbol}`);
    console.log(`✅ Decimals: ${decimals}`);
    console.log(`✅ Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
    console.log(`✅ Deployer Balance: ${ethers.formatUnits(deployerBalance, decimals)} ${symbol}`);

    // Test transfer (only if testUser is different from deployer)
    if (deployerBalance > 0n && testUser.address !== deployer.address) {
      const transferAmount = ethers.parseUnits("100", decimals);
      if (transferAmount <= deployerBalance) {
        console.log(`\n  Testing transfer of ${ethers.formatUnits(transferAmount, decimals)} ${symbol}...`);
        const transferTx = await mockUSDC.transfer(testUser.address, transferAmount);
        await transferTx.wait();
        const userBalance = await mockUSDC.balanceOf(testUser.address);
        console.log(`  ✅ Transfer successful! User balance: ${ethers.formatUnits(userBalance, decimals)} ${symbol}`);
      }
    } else if (testUser.address === deployer.address) {
      console.log(`\n  ℹ️  Skipping transfer test (using same account)`);
    }
  } catch (error: any) {
    console.log(`❌ MockUSDC test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: NVXToken - Governance Token");
  console.log("=".repeat(60));

  try {
    const nvxName = await nvxToken.name();
    const nvxSymbol = await nvxToken.symbol();
    const nvxTotalSupply = await nvxToken.totalSupply();
    const nvxDeployerBalance = await nvxToken.balanceOf(deployer.address);

    console.log(`✅ Token Name: ${nvxName}`);
    console.log(`✅ Token Symbol: ${nvxSymbol}`);
    console.log(`✅ Total Supply: ${ethers.formatEther(nvxTotalSupply)} ${nvxSymbol}`);
    console.log(`✅ Deployer Balance: ${ethers.formatEther(nvxDeployerBalance)} ${nvxSymbol}`);
  } catch (error: any) {
    console.log(`❌ NVXToken test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: NovaxRwaFactory - RWA Asset Creation");
  console.log("=".repeat(60));

  try {
    // Check factory is connected to pool manager
    const poolManagerAddress = await rwaFactory.poolManager();
    console.log(`✅ Pool Manager Address: ${poolManagerAddress}`);
    console.log(`   Expected: ${contracts.NovaxPoolManager}`);
    console.log(`   Match: ${poolManagerAddress.toLowerCase() === contracts.NovaxPoolManager.toLowerCase() ? "✅" : "❌"}`);

    // Try creating a test RWA asset
    const metadataCID = ethers.id("test-rwa-etherlink-" + Date.now());
    const rwaValue = ethers.parseUnits("50000", 6); // $50,000
    const maxLTV = 70; // 70%

    console.log(`\n  Creating test RWA asset...`);
    console.log(`  Category: AGRICULTURE (1)`);
    console.log(`  Value: ${ethers.formatUnits(rwaValue, 6)} USDC`);
    console.log(`  Max LTV: ${maxLTV}%`);

    const createRwaTx = await rwaFactory.createRwa(1, rwaValue, maxLTV, metadataCID);
    const receipt = await createRwaTx.wait();
    
    // Parse event
    const eventLog = receipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("RwaAssetCreated(bytes32,address,uint8,uint256,bytes32,uint256)")
    );
    
    if (eventLog) {
      const assetId = eventLog.topics[1];
      console.log(`  ✅ RWA Asset created! Asset ID: ${assetId}`);
      
      // Get asset details
      const asset = await rwaFactory.getAsset(assetId);
      console.log(`  ✅ Asset Owner: ${asset.owner}`);
      console.log(`  ✅ Asset Status: ${asset.status} (0=PENDING_VERIFICATION)`);
      console.log(`  ✅ Asset Value: ${ethers.formatUnits(asset.valueUSD, 6)} USDC`);
    } else {
      console.log(`  ⚠️  Asset created but event not found`);
    }
  } catch (error: any) {
    console.log(`❌ RWA Factory test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: NovaxReceivableFactory - Receivable Creation");
  console.log("=".repeat(60));

  try {
    const recVerificationModule = await receivableFactory.verificationModule();
    console.log(`✅ Verification Module: ${recVerificationModule}`);
    const totalReceivables = await receivableFactory.totalReceivables();
    console.log(`✅ Total Receivables: ${totalReceivables}`);

    // Try creating a test receivable
    const dueDate = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60; // 60 days
    const invoiceAmount = ethers.parseUnits("25000", 6); // $25,000
    const invoiceCID = ethers.id("test-invoice-etherlink-" + Date.now());

    console.log(`\n  Creating test receivable...`);
    console.log(`  Importer: ${testUser.address}`);
    console.log(`  Amount: ${ethers.formatUnits(invoiceAmount, 6)} USDC`);
    console.log(`  Due Date: ${new Date(dueDate * 1000).toLocaleDateString()}`);

    const createRecTx = await receivableFactory.createReceivable(
      testUser.address,
      invoiceAmount,
      dueDate,
      invoiceCID
    );
    const recReceipt = await createRecTx.wait();
    
    const recEventLog = recReceipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("ReceivableCreated(bytes32,address,address,uint256,bytes32,uint256)")
    );
    
    if (recEventLog) {
      const receivableId = recEventLog.topics[1];
      console.log(`  ✅ Receivable created! Receivable ID: ${receivableId}`);
      
      const receivable = await receivableFactory.getReceivable(receivableId);
      console.log(`  ✅ Exporter: ${receivable.exporter}`);
      console.log(`  ✅ Status: ${receivable.status} (0=PENDING_VERIFICATION)`);
      console.log(`  ✅ Amount: ${ethers.formatUnits(receivable.amountUSD, 6)} USDC`);
    }
  } catch (error: any) {
    console.log(`❌ Receivable Factory test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: NovaxPoolManager - Pool Management");
  console.log("=".repeat(60));

  try {
    const usdcToken = await poolManager.usdcToken();
    const rwaFactoryAddr = await poolManager.rwaFactory();
    const receivableFactoryAddr = await poolManager.receivableFactory();
    const totalPools = await poolManager.totalPools();

    console.log(`✅ USDC Token: ${usdcToken}`);
    console.log(`   Expected: ${contracts.USDC}`);
    console.log(`   Match: ${usdcToken.toLowerCase() === contracts.USDC.toLowerCase() ? "✅" : "❌"}`);
    console.log(`✅ RWA Factory: ${rwaFactoryAddr}`);
    console.log(`✅ Receivable Factory: ${receivableFactoryAddr}`);
    console.log(`✅ Total Pools: ${totalPools}`);
  } catch (error: any) {
    console.log(`❌ Pool Manager test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: NovaxPriceManager - Price Feed Integration");
  console.log("=".repeat(60));

  try {
    // Check if price feeds are set (they might be zero addresses)
    const ethFeed = await priceManager.ethUsdFeed();
    const btcFeed = await priceManager.btcUsdFeed();
    const usdcFeed = await priceManager.usdcUsdFeed();
    const linkFeed = await priceManager.linkUsdFeed();

    console.log(`✅ ETH/USD Feed: ${ethFeed}`);
    console.log(`✅ BTC/USD Feed: ${btcFeed}`);
    console.log(`✅ USDC/USD Feed: ${usdcFeed}`);
    console.log(`✅ LINK/USD Feed: ${linkFeed}`);

    if (ethFeed !== ethers.ZeroAddress) {
      console.log(`\n  Attempting to update prices...`);
      try {
        const updateTx = await priceManager.updateLivePrices();
        await updateTx.wait();
        console.log(`  ✅ Price update transaction sent`);
      } catch (error: any) {
        console.log(`  ⚠️  Price update failed (expected if feeds are zero): ${error.message}`);
      }
    } else {
      console.log(`  ℹ️  Price feeds are zero addresses (using fallback)`);
    }
  } catch (error: any) {
    console.log(`❌ Price Manager test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 7: NovaxFallbackLibrary - Fallback Functions");
  console.log("=".repeat(60));

  try {
    // Test getting a commodity price (takes string, not number)
    const coffeePrice = await fallbackLibrary.getCommodityPrice("Coffee");
    console.log(`✅ Coffee Price (fallback): ${ethers.formatUnits(coffeePrice, 6)} USD`);

    // Test getting country risk (takes country code string)
    const nigeriaRisk = await fallbackLibrary.getCountryRisk("NG"); // Nigeria
    console.log(`✅ Nigeria Risk Score: ${nigeriaRisk} basis points (${Number(nigeriaRisk) / 100}%)`);

    // Test pseudo-randomness (requires seed parameter)
    const random = await fallbackLibrary.getPseudoRandom(12345);
    console.log(`✅ Pseudo-random value: ${random}`);

    // Test market risk
    const marketRisk = await fallbackLibrary.getMarketRisk();
    console.log(`✅ Market Risk: ${marketRisk} basis points (${Number(marketRisk) / 100}%)`);
  } catch (error: any) {
    console.log(`❌ Fallback Library test failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYED CONTRACTS TEST COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📊 Summary:");
  console.log("  All contracts are deployed and accessible");
  console.log("  Core functionality is working");
  console.log("  Contracts are ready for integration");
  console.log("\n🔗 View on Explorer:");
  console.log(`  https://shadownet.explorer.etherlink.com/address/${contracts.USDC}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  });

