/**
 * Check which pool an asset is mapped to
 * Usage: node scripts/check-asset-pool.js <assetId>
 */

const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  const assetId = process.argv[2];
  
  if (!assetId) {
    console.error('❌ Please provide an asset ID');
    console.log('Usage: node scripts/check-asset-pool.js <assetId>');
    process.exit(1);
  }
  
  console.log('🔍 === CHECKING ASSET POOL MAPPING ===\n');
  
  // Get network config
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;
  console.log(`📋 Network: ${network} (Chain ID: ${chainId})\n`);
  
  // Load deployment info
  const deploymentsPath = `./deployments/mantle-sepolia-latest.json`;
  let deployments;
  try {
    deployments = require(`../${deploymentsPath}`);
  } catch (error) {
    console.error('❌ Could not load deployment info:', error.message);
    process.exit(1);
  }
  
  const poolManagerAddress = deployments.contracts.PoolManager;
  console.log(`📋 PoolManager: ${poolManagerAddress}\n`);
  
  // Convert assetId to bytes32
  let assetIdBytes32;
  if (assetId.startsWith('0x') && assetId.length === 66) {
    assetIdBytes32 = assetId;
  } else if (assetId.startsWith('0x') && assetId.length < 66) {
    assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
  } else {
    assetIdBytes32 = ethers.id(assetId);
  }
  
  console.log('📋 Asset ID Conversion:');
  console.log(`   Original: ${assetId}`);
  console.log(`   Bytes32: ${assetIdBytes32}`);
  console.log('');
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Using account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);
  
  // Load PoolManager ABI
  const PoolManagerABI = [
    'function assetToPool(bytes32) external view returns (bytes32)',
    'function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])',
  ];
  
  const poolManager = new ethers.Contract(poolManagerAddress, PoolManagerABI, deployer);
  
  try {
    // Check assetToPool mapping
    console.log('🔍 Checking assetToPool mapping...');
    const mappedPoolId = await poolManager.assetToPool(assetIdBytes32);
    
    if (mappedPoolId === ethers.ZeroHash || mappedPoolId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('✅ Asset is NOT in any pool (mapped to zero)');
      console.log('   Asset is available for pool creation');
    } else {
      console.log(`❌ Asset IS mapped to pool: ${mappedPoolId}`);
      console.log('');
      
      // Try to get pool details
      try {
        console.log('🔍 Fetching pool details...');
        const pool = await poolManager.getPool(mappedPoolId);
        
        const poolName = pool[2]; // name is at index 2
        const isActive = pool[9]; // isActive is at index 9
        const creator = pool[1]; // creator is at index 1
        
        console.log('📊 Pool Details:');
        console.log(`   Pool ID: ${mappedPoolId}`);
        console.log(`   Name: ${poolName}`);
        console.log(`   Creator: ${creator}`);
        console.log(`   Active: ${isActive ? '✅ YES' : '❌ NO'}`);
        console.log(`   Assets in pool: ${pool[11].length}`); // assets array at index 11
        console.log('');
        
        if (isActive) {
          console.log('⚠️  WARNING: Asset is in an ACTIVE pool!');
          console.log('   You cannot add this asset to another pool until it is removed from this one.');
        } else {
          console.log('ℹ️  INFO: Asset is in an INACTIVE pool.');
          console.log('   The pool is not active, but the asset is still mapped to it.');
        }
      } catch (poolError) {
        console.log('⚠️  Could not fetch pool details:');
        console.log(`   Error: ${poolError.message}`);
        console.log('');
        console.log('   This might mean:');
        console.log('   - Pool was created on old contract');
        console.log('   - Pool was deleted but mapping remains');
        console.log('   - Pool ID is invalid');
      }
    }
  } catch (error) {
    console.error('❌ Error checking asset pool:', error.message);
    process.exit(1);
  }
  
  console.log('\n✅ Check complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

