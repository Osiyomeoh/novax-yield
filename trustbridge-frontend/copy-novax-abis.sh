#!/bin/bash
# Script to copy Novax contract ABIs from backend to frontend

BACKEND_CONTRACTS_DIR="../trustbridge-backend/contracts/artifacts/contracts/novax"
FRONTEND_CONTRACTS_DIR="src/contracts"

echo "📋 Copying Novax contract ABIs..."

# Copy ABIs (excluding debug files)
cp "$BACKEND_CONTRACTS_DIR/NovaxRwaFactory.sol/NovaxRwaFactory.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ NovaxRwaFactory.json" || echo "❌ Failed: NovaxRwaFactory.json"
cp "$BACKEND_CONTRACTS_DIR/NovaxReceivableFactory.sol/NovaxReceivableFactory.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ NovaxReceivableFactory.json" || echo "❌ Failed: NovaxReceivableFactory.json"
cp "$BACKEND_CONTRACTS_DIR/NovaxPoolManager.sol/NovaxPoolManager.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ NovaxPoolManager.json" || echo "❌ Failed: NovaxPoolManager.json"
cp "$BACKEND_CONTRACTS_DIR/NovaxMarketplace.sol/NovaxMarketplace.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ NovaxMarketplace.json" || echo "❌ Failed: NovaxMarketplace.json"
cp "$BACKEND_CONTRACTS_DIR/PoolToken.sol/PoolToken.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ PoolToken.json" || echo "❌ Failed: PoolToken.json"
cp "$BACKEND_CONTRACTS_DIR/NVXToken.sol/NVXToken.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ NVXToken.json" || echo "❌ Failed: NVXToken.json"
cp "$BACKEND_CONTRACTS_DIR/MockUSDC.sol/MockUSDC.json" "$FRONTEND_CONTRACTS_DIR/" 2>/dev/null && echo "✅ MockUSDC.json" || echo "❌ Failed: MockUSDC.json"

echo ""
echo "✅ ABI copy complete!"
echo "📝 Note: If any files failed, ensure the backend contracts are compiled first:"
echo "   cd ../trustbridge-backend/contracts && npx hardhat compile"

