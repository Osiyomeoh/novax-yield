import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Flatten contracts for manual verification on Etherlink Explorer
 * 
 * This script flattens all Novax contracts so they can be manually verified
 * on https://shadownet.explorer.etherlink.com/
 * 
 * Uses: npx hardhat flatten <file>
 */

async function main() {
  console.log("📦 Flattening Novax contracts for manual verification...\n");

  const contracts = [
    { name: "MockUSDC", path: "contracts/novax/MockUSDC.sol" },
    { name: "NVXToken", path: "contracts/novax/NVXToken.sol" },
    { name: "NovaxRwaFactory", path: "contracts/novax/NovaxRwaFactory.sol" },
    { name: "NovaxReceivableFactory", path: "contracts/novax/NovaxReceivableFactory.sol" },
    { name: "NovaxPoolManager", path: "contracts/novax/NovaxPoolManager.sol" },
    { name: "NovaxPriceManager", path: "contracts/novax/NovaxPriceManager.sol" },
    { name: "NovaxFallbackLibrary", path: "contracts/novax/NovaxFallbackLibrary.sol" },
  ];

  const flattenedDir = path.join(__dirname, "../../flattened");
  if (!fs.existsSync(flattenedDir)) {
    fs.mkdirSync(flattenedDir, { recursive: true });
  }

  console.log("📋 Flattening contracts...\n");

  for (const contract of contracts) {
    try {
      console.log(`  Flattening ${contract.name}...`);
      const output = execSync(`npx hardhat flatten ${contract.path}`, {
        cwd: path.join(__dirname, "../.."),
        encoding: "utf-8",
      });

      const outputPath = path.join(flattenedDir, `${contract.name}_flattened.sol`);
      fs.writeFileSync(outputPath, output);
      console.log(`  ✅ ${contract.name} flattened → ${outputPath}\n`);
    } catch (error: any) {
      console.log(`  ⚠️  Failed to flatten ${contract.name}: ${error.message}\n`);
      console.log(`  💡 Try manually: npx hardhat flatten ${contract.path}\n`);
    }
  }

  // Load deployment info to get contract addresses
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const deploymentFiles = fs.readdirSync(deploymentsDir)
    .filter((f) => f.startsWith("novax-etherlink-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (deploymentFiles.length > 0) {
    const deploymentFile = path.join(deploymentsDir, deploymentFiles[0]);
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
    const contractAddresses = deployment.contracts;

    // Create verification guide
    const guidePath = path.join(flattenedDir, "VERIFICATION_GUIDE.md");
    const guide = createVerificationGuide(contractAddresses, deployment.chainlink || {});
    fs.writeFileSync(guidePath, guide);
    console.log(`📝 Verification guide created → ${guidePath}\n`);
  }

  console.log("=".repeat(60));
  console.log("✅ Contract flattening complete!");
  console.log("=".repeat(60));
  console.log("\n📁 Flattened contracts saved to: flattened/");
  console.log("\n📋 Next steps:");
  console.log("1. Go to https://shadownet.explorer.etherlink.com/");
  console.log("2. Find your contract address");
  console.log("3. Click 'Verify & publish' on the Contract tab");
  console.log("4. Use the flattened source code from the flattened/ directory");
  console.log("5. See VERIFICATION_GUIDE.md for detailed instructions");
}

function createVerificationGuide(contracts: any, chainlink: any): string {
  return `# Etherlink Contract Verification Guide

## 📋 Contract Addresses (Shadownet Testnet)

${Object.entries(contracts)
  .filter(([_, addr]: [string, any]) => addr && addr !== "0x0000000000000000000000000000000000000000")
  .map(([name, addr]: [string, any]) => `- **${name}**: \`${addr}\``)
  .join("\n")}

## 🔧 Compiler Settings

- **Compiler Version**: 0.8.20
- **EVM Version**: Osaka (Etherlink default)
- **Optimization**: Enabled
- **Optimizer Runs**: 200
- **viaIR**: Enabled (for contracts using 0.8.28)

## 📝 Manual Verification Steps

### For each contract:

1. **Go to Etherlink Explorer**
   - Shadownet: https://shadownet.explorer.etherlink.com/
   - Find your contract by address

2. **Click "Verify & publish"**
   - On the Contract tab of the contract page

3. **Select Verification Method**
   - Choose: **Solidity (Single file)**
   - This is the simplest method for most contracts

4. **Configure Compiler Settings**
   - **License**: MIT (or your chosen license)
   - **Compiler Version**: \`0.8.20\` (or \`0.8.28\` if using viaIR)
   - **EVM Version**: \`Osaka\`
   - **Optimization**: ✅ Enabled
   - **Runs**: \`200\`

5. **Paste Source Code**
   - Open the flattened contract file from \`flattened/\` directory
   - Copy the entire contents
   - Paste into the "Contract code" field

6. **Constructor Arguments** (if applicable)
   - See constructor arguments below for each contract

7. **Click "Verify & publish"**

## 🔨 Constructor Arguments

### MockUSDC
- **No constructor arguments** (empty)

### NVXToken
- **No constructor arguments** (empty)

### NovaxRwaFactory
- **No constructor arguments** (empty)

### NovaxReceivableFactory
- **No constructor arguments** (empty)

### NovaxPoolManager
- **Constructor Arguments**:
  \`\`\`
  ["${contracts.USDC}"]
  \`\`\`
  - Format: Array with USDC token address

### NovaxPriceManager
- **Constructor Arguments**:
  \`\`\`
  ["${chainlink.ETH_USD || "0x0000000000000000000000000000000000000000"}", "${chainlink.BTC_USD || "0x0000000000000000000000000000000000000000"}", "${chainlink.USDC_USD || "0x0000000000000000000000000000000000000000"}", "${chainlink.LINK_USD || "0x0000000000000000000000000000000000000000"}"]
  \`\`\`
  - Format: Array with 4 price feed addresses (ETH/USD, BTC/USD, USDC/USD, LINK/USD)
  - Note: If addresses are zero, use zero addresses

### NovaxFallbackLibrary
- **No constructor arguments** (empty)

## 🔗 Explorer Links

${Object.entries(contracts)
  .filter(([_, addr]: [string, any]) => addr && addr !== "0x0000000000000000000000000000000000000000")
  .map(([name, addr]: [string, any]) => `- [${name}](https://shadownet.explorer.etherlink.com/address/${addr})`)
  .join("\n")}

## ⚠️ Important Notes

1. **Compiler Version**: Make sure to use the exact compiler version (0.8.20) that was used during deployment
2. **EVM Version**: Etherlink uses Osaka EVM version
3. **Optimization**: Must match deployment settings (enabled, 200 runs)
4. **Flattened Code**: Use the flattened source code files, not the original multi-file structure
5. **Constructor Args**: If the contract has constructor arguments, they must be provided in the correct format

## 🐛 Troubleshooting

If verification fails:
- Check that compiler version matches exactly
- Verify optimization settings match deployment
- Ensure EVM version is set to Osaka
- Check that constructor arguments are correct (if any)
- Make sure the flattened source code is complete

## 📚 Additional Resources

- Etherlink Explorer: https://shadownet.explorer.etherlink.com/
- Etherlink Docs: https://docs.etherlink.com/
`;

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

