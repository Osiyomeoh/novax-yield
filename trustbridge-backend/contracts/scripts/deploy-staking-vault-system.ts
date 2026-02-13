import { ethers } from "hardhat";

/**
 * Deploy complete staking vault system
 * - NovaxStakingVault
 * - VaultCapacityManager
 * - Update NovaxPoolManager integration
 * - Update AMCPaymentCollector integration
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying Staking Vault System with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Get existing contract addresses (from previous deployments)
  const USDC_ADDRESS = "0xC449434dcf6Faca53595b4B020568Ef01FEA23a5"; // NEW MockUSDC
  const NVX_TOKEN_ADDRESS = process.env.NVX_TOKEN_ADDRESS || "";
  const POOL_MANAGER_ADDRESS = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d"; // Lowercase checksum
  const RECEIVABLE_FACTORY_ADDRESS = "0x742240799d0ad23832fa7d60ca092adc0092b894"; // Lowercase checksum

  if (!USDC_ADDRESS || !POOL_MANAGER_ADDRESS) {
    throw new Error("Missing required contract addresses in .env");
  }

  console.log("\n📋 Existing Contracts:");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  NVX Token:", NVX_TOKEN_ADDRESS);
  console.log("  Pool Manager:", POOL_MANAGER_ADDRESS);
  console.log("  Receivable Factory:", RECEIVABLE_FACTORY_ADDRESS);

  // ==================== DEPLOY STAKING VAULT ====================
  console.log("\n🚀 Deploying NovaxStakingVault...");
  
  const NovaxStakingVault = await ethers.getContractFactory("NovaxStakingVault");
  const stakingVault = await NovaxStakingVault.deploy(USDC_ADDRESS);
  await stakingVault.waitForDeployment();
  const stakingVaultAddress = await stakingVault.getAddress();
  
  console.log("✅ NovaxStakingVault deployed to:", stakingVaultAddress);

  // ==================== DEPLOY CAPACITY MANAGER ====================
  console.log("\n🚀 Deploying VaultCapacityManager...");
  
  const initialCapacity = ethers.parseUnits("1000000", 6); // $1M initial capacity
  
  console.log("  Deploying with params:");
  console.log("    stakingVault:", stakingVaultAddress);
  console.log("    poolManager:", POOL_MANAGER_ADDRESS);
  console.log("    nvxToken:", NVX_TOKEN_ADDRESS || ethers.ZeroAddress);
  console.log("    usdc:", USDC_ADDRESS);
  console.log("    initialCapacity:", ethers.formatUnits(initialCapacity, 6));
  
  const VaultCapacityManager = await ethers.getContractFactory("VaultCapacityManager");
  const capacityManager = await VaultCapacityManager.deploy(
    stakingVaultAddress,
    POOL_MANAGER_ADDRESS,
    NVX_TOKEN_ADDRESS || ethers.ZeroAddress, // Use zero address if not deployed yet
    USDC_ADDRESS,
    initialCapacity
  );
  await capacityManager.waitForDeployment();
  const capacityManagerAddress = await capacityManager.getAddress();
  
  console.log("✅ VaultCapacityManager deployed to:", capacityManagerAddress);

  // ==================== CONFIGURE STAKING VAULT ====================
  console.log("\n⚙️  Configuring NovaxStakingVault...");
  
  // Set capacity manager
  const setCapacityTx = await stakingVault.setVaultCapacityManager(capacityManagerAddress);
  await setCapacityTx.wait();
  console.log("  ✅ Set capacity manager");

  // Grant POOL_MANAGER_ROLE to PoolManager
  const POOL_MANAGER_ROLE = await stakingVault.POOL_MANAGER_ROLE();
  const grantRoleTx = await stakingVault.grantRole(POOL_MANAGER_ROLE, POOL_MANAGER_ADDRESS);
  await grantRoleTx.wait();
  console.log("  ✅ Granted POOL_MANAGER_ROLE to PoolManager");

  // ==================== CONFIGURE POOL MANAGER ====================
  console.log("\n⚙️  Configuring NovaxPoolManager...");
  
  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER_ADDRESS);
  
  // Set staking vault
  const setVaultTx = await poolManager.setStakingVault(stakingVaultAddress);
  await setVaultTx.wait();
  console.log("  ✅ Set staking vault");

  // Set capacity manager
  const setCapMgrTx = await poolManager.setVaultCapacityManager(capacityManagerAddress);
  await setCapMgrTx.wait();
  console.log("  ✅ Set capacity manager");

  // ==================== VERIFY INTEGRATION ====================
  console.log("\n🔍 Verifying Integration...");
  
  const vaultStatus = await stakingVault.getVaultStatus();
  console.log("  Vault Status:");
  console.log("    Total Staked:", ethers.formatUnits(vaultStatus[0], 6), "USDC");
  console.log("    Deployed:", ethers.formatUnits(vaultStatus[1], 6), "USDC");
  console.log("    Available:", ethers.formatUnits(vaultStatus[2], 6), "USDC");
  console.log("    Utilization:", Number(vaultStatus[3]) / 100, "%");

  const capacityStatus = await capacityManager.getVaultStatus();
  console.log("\n  Capacity Status:");
  console.log("    Capacity:", ethers.formatUnits(capacityStatus[0], 6), "USDC");
  console.log("    Staked:", ethers.formatUnits(capacityStatus[1], 6), "USDC");
  console.log("    Available:", ethers.formatUnits(capacityStatus[2], 6), "USDC");
  console.log("    Utilization:", Number(capacityStatus[3]) / 100, "%");
  console.log("    Waitlist:", ethers.formatUnits(capacityStatus[4], 6), "USDC");

  // ==================== SUMMARY ====================
  console.log("\n" + "=".repeat(60));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("\n✅ New Contracts:");
  console.log("  NovaxStakingVault:", stakingVaultAddress);
  console.log("  VaultCapacityManager:", capacityManagerAddress);
  
  console.log("\n✅ Integration Complete:");
  console.log("  PoolManager → StakingVault: Configured");
  console.log("  PoolManager → CapacityManager: Configured");
  console.log("  StakingVault → CapacityManager: Configured");
  
  console.log("\n📝 Next Steps:");
  console.log("  1. Update .env with new addresses");
  console.log("  2. Test staking flow: stake() → pool creation → auto-deploy");
  console.log("  3. Test capacity management: check canStake()");
  console.log("  4. Test payment flow: recordPayment() → distributeYield()");
  console.log("  5. Deploy frontend integration");
  
  console.log("\n💾 Save these addresses:");
  console.log(`STAKING_VAULT_ADDRESS=${stakingVaultAddress}`);
  console.log(`VAULT_CAPACITY_MANAGER_ADDRESS=${capacityManagerAddress}`);
  
  console.log("\n✅ Deployment Complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

