import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying MockUSDC with account:", deployer.address);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  
  console.log("✅ MockUSDC deployed to:", usdcAddress);
  
  // Test mint
  const mintAmount = ethers.parseUnits("1000000", 6); // $1M
  const mintTx = await usdc.mint(deployer.address, mintAmount);
  await mintTx.wait();
  
  const balance = await usdc.balanceOf(deployer.address);
  console.log("✅ Minted:", ethers.formatUnits(balance, 6), "USDC");
  
  console.log("\n💾 Update this address in your .env and frontend:");
  console.log(`USDC_ADDRESS=${usdcAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

