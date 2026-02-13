import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploy NovaxPoolManager with latest code (includes stakingVault support)
 * This will fix the auto-deployment issue
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔄 REDEPLOYING NovaxPoolManager with Staking Vault Support\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  // Get existing contract addresses
  const USDC_ADDRESS = "0xC449434dcf6Faca53595b4B020568Ef01FEA23a5";
  const NVX_TOKEN_ADDRESS = process.env.NVX_TOKEN_ADDRESS || ethers.ZeroAddress;
  const PLATFORM_TREASURY = deployer.address; // Default to deployer
  const AMC_ADDRESS = deployer.address; // Default to deployer
  const PLATFORM_FEE_BPS = 100n; // 1%
  const AMC_FEE_BPS = 200n; // 2%
  
  const STAKING_VAULT = "0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5";
  const CAPACITY_MANAGER = "0xB1F97FF54F34e0552a889f4C841d6637574Ea554";
  const RECEIVABLE_FACTORY = "0x8bec56E184A90fd2a9f438b6DBb7d55aF155a453"; // New one with getters
  const OLD_POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";

  console.log("📋 Configuration:");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  NVX Token:", NVX_TOKEN_ADDRESS || "Not set");
  console.log("  Platform Treasury:", PLATFORM_TREASURY);
  console.log("  AMC Address:", AMC_ADDRESS);
  console.log("  Staking Vault:", STAKING_VAULT);
  console.log("  Capacity Manager:", CAPACITY_MANAGER);
  console.log("  Receivable Factory:", RECEIVABLE_FACTORY);
  console.log("  Old Pool Manager:", OLD_POOL_MANAGER);

  // Deploy new PoolManager
  console.log("\n📦 Deploying NovaxPoolManager...");
  const NovaxPoolManager = await ethers.getContractFactory("NovaxPoolManager");
  const poolManager = await NovaxPoolManager.deploy(
    USDC_ADDRESS,
    NVX_TOKEN_ADDRESS || ethers.ZeroAddress,
    PLATFORM_TREASURY,
    AMC_ADDRESS,
    PLATFORM_FEE_BPS,
    AMC_FEE_BPS
  );
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log("✅ New PoolManager deployed to:", poolManagerAddress);

  // Configure new PoolManager
  console.log("\n⚙️  Configuring new PoolManager...");
  
  // Set staking vault
  const setVaultTx = await poolManager.setStakingVault(STAKING_VAULT);
  await setVaultTx.wait();
  console.log("  ✅ Set staking vault");

  // Set capacity manager
  const setCapTx = await poolManager.setVaultCapacityManager(CAPACITY_MANAGER);
  await setCapTx.wait();
  console.log("  ✅ Set capacity manager");

  // Set receivable factory
  const setRecTx = await poolManager.setReceivableFactory(RECEIVABLE_FACTORY);
  await setRecTx.wait();
  console.log("  ✅ Set receivable factory");

  // Grant AMC_ROLE to deployer (for testing)
  const AMC_ROLE = await poolManager.AMC_ROLE();
  const grantAmcTx = await poolManager.grantRole(AMC_ROLE, deployer.address);
  await grantAmcTx.wait();
  console.log("  ✅ Granted AMC_ROLE to deployer");

  // Grant POOL_MANAGER_ROLE in StakingVault
  console.log("\n⚙️  Configuring StakingVault...");
  const vault = await ethers.getContractAt("NovaxStakingVault", STAKING_VAULT);
  const POOL_MANAGER_ROLE = await vault.POOL_MANAGER_ROLE();
  const grantRoleTx = await vault.grantRole(POOL_MANAGER_ROLE, poolManagerAddress);
  await grantRoleTx.wait();
  console.log("  ✅ Granted POOL_MANAGER_ROLE to new PoolManager");

  // Verify configuration
  console.log("\n🔍 Verifying configuration...");
  try {
    const stakingVaultSet = await poolManager.stakingVault();
    console.log("  stakingVault:", stakingVaultSet);
    if (stakingVaultSet.toLowerCase() === STAKING_VAULT.toLowerCase()) {
      console.log("  ✅ stakingVault correctly set!");
    } else {
      console.log("  ❌ stakingVault mismatch!");
    }
  } catch (error: any) {
    console.log("  ⚠️  Could not verify stakingVault:", error.message);
  }

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  
  const deploymentInfo = {
    network: "etherlink_testnet",
    chainId: chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      NovaxPoolManager: poolManagerAddress,
      OldPoolManager: OLD_POOL_MANAGER,
      StakingVault: STAKING_VAULT,
      CapacityManager: CAPACITY_MANAGER,
      ReceivableFactory: RECEIVABLE_FACTORY,
      USDC: USDC_ADDRESS,
    },
    note: "Redeployed with stakingVault support for auto-deployment"
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, "etherlink_testnet.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentFile);

  console.log("\n" + "=".repeat(60));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("\n✅ New PoolManager:", poolManagerAddress);
  console.log("   Old PoolManager:", OLD_POOL_MANAGER);
  console.log("\n⚠️  IMPORTANT: Update all references to use new address!");
  console.log("   - Update test scripts");
  console.log("   - Update frontend/backend services");
  console.log("   - Update any other contracts that reference PoolManager");
  
  console.log("\n✅ Auto-deployment should now work!");
  console.log("   Next: Create a pool and it should auto-deploy from vault");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

