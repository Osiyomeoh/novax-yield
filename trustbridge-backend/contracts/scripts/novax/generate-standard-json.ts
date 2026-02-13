import * as fs from "fs";
import * as path from "path";

/**
 * Generate Standard JSON Input for verification from Hardhat build artifacts
 */

async function main() {
  console.log("📦 Generating Standard JSON Input for verification...\n");

  const artifactsDir = path.join(__dirname, "../../artifacts");
  const buildInfoDir = path.join(artifactsDir, "build-info");

  if (!fs.existsSync(buildInfoDir)) {
    console.error("❌ Build info directory not found. Please compile first:");
    console.error("   npx hardhat compile --force");
    process.exit(1);
  }

  const buildInfoFiles = fs.readdirSync(buildInfoDir)
    .filter((f) => f.endsWith(".json"));

  if (buildInfoFiles.length === 0) {
    console.error("❌ No build info files found. Please compile first:");
    console.error("   npx hardhat compile --force");
    process.exit(1);
  }

  console.log(`Found ${buildInfoFiles.length} build info file(s)\n`);

  // Find MockUSDC build info
  let mockUSDCBuildInfo: any = null;
  
  for (const file of buildInfoFiles) {
    const filePath = path.join(buildInfoDir, file);
    const buildInfo = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    // Check if this build info contains MockUSDC
    if (buildInfo.output?.contracts?.["contracts/novax/MockUSDC.sol"]?.MockUSDC) {
      mockUSDCBuildInfo = buildInfo;
      console.log(`✅ Found MockUSDC in: ${file}\n`);
      break;
    }
  }

  if (!mockUSDCBuildInfo) {
    console.error("❌ MockUSDC not found in build info. Please compile:");
    console.error("   npx hardhat compile --force");
    process.exit(1);
  }

  // Extract the input JSON
  const standardJsonInput = mockUSDCBuildInfo.input;

  if (!standardJsonInput) {
    console.error("❌ No input found in build info");
    process.exit(1);
  }

  // Save to file
  const outputDir = path.join(__dirname, "../../flattened");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "MockUSDC_standard_json.json");
  fs.writeFileSync(outputPath, JSON.stringify(standardJsonInput, null, 2));

  console.log("✅ Standard JSON Input generated!");
  console.log(`   Saved to: ${outputPath}\n`);

  // Display key settings
  console.log("📋 Compiler Settings from Build Info:");
  console.log("=".repeat(60));
  console.log(`   Language: ${standardJsonInput.language}`);
  console.log(`   Compiler Version: ${standardJsonInput.settings?.compiler?.version || "Not specified"}`);
  console.log(`   EVM Version: ${standardJsonInput.settings?.evmVersion || "Not specified"}`);
  console.log(`   Optimization: ${standardJsonInput.settings?.optimizer?.enabled ? "Enabled" : "Disabled"}`);
  if (standardJsonInput.settings?.optimizer?.enabled) {
    console.log(`   Optimizer Runs: ${standardJsonInput.settings?.optimizer?.runs || "Not specified"}`);
  }
  console.log(`   viaIR: ${standardJsonInput.settings?.viaIR ? "Enabled" : "Disabled"}`);
  console.log("=".repeat(60));

  console.log("\n📝 How to use:");
  console.log("1. Go to Etherlink Explorer");
  console.log("2. Select: 'Solidity (Standard JSON Input)'");
  console.log("3. Open the generated JSON file");
  console.log("4. Copy the ENTIRE contents");
  console.log("5. Paste into the verification form");
  console.log("6. Set compiler version (from settings above)");
  console.log("7. Leave constructor args empty for MockUSDC");
  console.log("8. Click 'Verify & publish'");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

