import { ethers } from "hardhat";

/**
 * Update PoolManager to reference the new ReceivableFactory address
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔗 UPDATING PoolManager to use new ReceivableFactory\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "XTZ\n");

  const POOL_MANAGER = "0x35fc8f4978084f32865dd4c6c8bdd494c6e05b0d";
  const NEW_RECEIVABLE_FACTORY = "0x8bec56E184A90fd2a9f438b6DBb7d55aF155a453";
  const OLD_RECEIVABLE_FACTORY = "0x742240799d0ad23832fa7d60ca092adc0092b894";

  const poolManager = await ethers.getContractAt("NovaxPoolManager", POOL_MANAGER);
  
  // Update to new address (skip checking current address since getter might not exist)
  console.log("\n📝 Updating PoolManager to use new ReceivableFactory...");
  console.log("  Old address:", OLD_RECEIVABLE_FACTORY);
  console.log("  New address:", NEW_RECEIVABLE_FACTORY);
  
  const updateTx = await poolManager.setReceivableFactory(NEW_RECEIVABLE_FACTORY);
  await updateTx.wait();
  console.log("✅ PoolManager updated!");
  console.log("  Transaction hash:", updateTx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

