import * as fs from "fs";
import * as path from "path";

/**
 * Clean flattened contract files for verification
 * Removes duplicate license identifiers and pragma statements
 */

function cleanFlattenedFile(filePath: string): void {
  console.log(`Cleaning ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, "utf-8");
  const originalLength = content.length;
  
  // Remove duplicate license identifiers (keep only the first one)
  const licenseRegex = /\/\/\s*SPDX-License-Identifier[^\n]*\n/gi;
  const licenses = content.match(licenseRegex);
  if (licenses && licenses.length > 1) {
    // Keep first license, remove others
    const firstLicense = licenses[0];
    content = content.replace(licenseRegex, "");
    content = firstLicense + "\n" + content;
  }
  
  // Remove duplicate pragma statements (keep only the first one)
  const pragmaRegex = /pragma\s+solidity[^;]*;/gi;
  const pragmas = content.match(pragmaRegex);
  if (pragmas && pragmas.length > 1) {
    // Keep first pragma, remove others
    const firstPragma = pragmas[0];
    content = content.replace(pragmaRegex, "");
    // Insert first pragma after license
    const licenseMatch = content.match(/\/\/\s*SPDX-License-Identifier[^\n]*\n/);
    if (licenseMatch) {
      const licenseIndex = content.indexOf(licenseMatch[0]) + licenseMatch[0].length;
      content = content.slice(0, licenseIndex) + "\n" + firstPragma + "\n" + content.slice(licenseIndex);
    } else {
      content = firstPragma + "\n" + content;
    }
  }
  
  // Remove "Sources flattened with hardhat" comment (optional)
  content = content.replace(/\/\/\s*Sources flattened with[^\n]*\n/gi, "");
  
  // Remove "Original license" comments that are duplicates
  content = content.replace(/\/\/\s*Original license:[^\n]*\n/gi, "");
  
  // Ensure file starts with license and pragma
  if (!content.trim().startsWith("// SPDX-License-Identifier")) {
    content = "// SPDX-License-Identifier: MIT\n" + content;
  }
  
  if (!content.includes("pragma solidity")) {
    const licenseIndex = content.indexOf("// SPDX-License-Identifier");
    if (licenseIndex !== -1) {
      const nextLine = content.indexOf("\n", licenseIndex);
      content = content.slice(0, nextLine + 1) + "\npragma solidity ^0.8.20;\n" + content.slice(nextLine + 1);
    }
  }
  
  // Clean up excessive blank lines (more than 2 consecutive)
  content = content.replace(/\n{3,}/g, "\n\n");
  
  // Write cleaned content
  fs.writeFileSync(filePath, content);
  
  const newLength = content.length;
  console.log(`  ✅ Cleaned: ${originalLength} → ${newLength} bytes (${((1 - newLength/originalLength) * 100).toFixed(1)}% reduction)`);
}

async function main() {
  console.log("🧹 Cleaning flattened contract files...\n");
  
  const flattenedDir = path.join(__dirname, "../../flattened");
  
  if (!fs.existsSync(flattenedDir)) {
    console.error("❌ Flattened directory not found. Run 'npm run flatten:novax' first.");
    process.exit(1);
  }
  
  const files = fs.readdirSync(flattenedDir)
    .filter(f => f.endsWith("_flattened.sol"));
  
  if (files.length === 0) {
    console.error("❌ No flattened contract files found.");
    process.exit(1);
  }
  
  console.log(`Found ${files.length} flattened contract(s)\n`);
  
  for (const file of files) {
    const filePath = path.join(flattenedDir, file);
    try {
      cleanFlattenedFile(filePath);
    } catch (error: any) {
      console.log(`  ⚠️  Error cleaning ${file}: ${error.message}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Cleaning complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Next steps:");
  console.log("1. Try verifying with cleaned flattened files");
  console.log("2. Use these settings:");
  console.log("   - Compiler: 0.8.20");
  console.log("   - EVM Version: Leave empty or try 'london'");
  console.log("   - Optimization: Enabled, Runs: 200");
  console.log("   - Method: Solidity (Single file)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

