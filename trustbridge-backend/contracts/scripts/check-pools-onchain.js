const { ethers } = require('hardhat');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/**
 * Check all pools on-chain
 * Usage: npx hardhat run scripts/check-pools-onchain.js --network mantle_testnet
 */

async function main() {
  console.log('🔍 === CHECKING POOLS ON-CHAIN ===\n');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('👤 Deployer address:', deployer.address);
  console.log('   Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Load contract addresses
  const fs = require('fs');
  const path = require('path');
  const deploymentFile = path.join(__dirname, '../deployments/mantle-sepolia-latest.json');
  
  let POOL_MANAGER_ADDRESS;
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    POOL_MANAGER_ADDRESS = deployment.contracts.PoolManager;
  } else {
    POOL_MANAGER_ADDRESS = process.env.POOL_MANAGER_ADDRESS || '0x56535279704A7936621b84FFD5e9Cc1eD3c4093a';
  }

  console.log('📋 Configuration:');
  console.log('   PoolManager:', POOL_MANAGER_ADDRESS);
  console.log('   Network:', network.name);
  console.log('');

  // Get contract instance
  const PoolManager = await ethers.getContractFactory('PoolManager');
  const poolManager = PoolManager.attach(POOL_MANAGER_ADDRESS);

  try {
    // Get total pools
    const totalPools = Number(await poolManager.totalPools());
    console.log(`📊 Total pools on-chain: ${totalPools}\n`);

    if (totalPools === 0) {
      console.log('ℹ️  No pools found on-chain');
      return;
    }

    // Query PoolCreated events with chunking to respect RPC limits
    const currentBlock = await ethers.provider.getBlockNumber();
    const maxBlockRange = 10000; // RPC limit is usually 10,000 blocks
    const lookbackBlocks = 100000; // Look back 100k blocks max
    const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
    
    console.log(`📡 Querying PoolCreated events from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)...`);
    console.log(`📦 Using chunking (max ${maxBlockRange} blocks per chunk)...`);
    
    const filter = poolManager.filters.PoolCreated();
    const allEvents = [];
    
    // Calculate number of chunks needed
    const totalBlocks = currentBlock - fromBlock;
    const chunks = Math.ceil(totalBlocks / maxBlockRange);
    
    // Query in chunks
    for (let i = 0; i < chunks; i++) {
      const chunkFromBlock = fromBlock + (i * maxBlockRange);
      const chunkToBlock = Math.min(fromBlock + ((i + 1) * maxBlockRange) - 1, currentBlock);
      
      if (chunkFromBlock > currentBlock) break;
      
      try {
        console.log(`📡 Querying chunk ${i + 1}/${chunks}: blocks ${chunkFromBlock} to ${chunkToBlock}...`);
        const chunkEvents = await poolManager.queryFilter(filter, chunkFromBlock, chunkToBlock);
        allEvents.push(...chunkEvents);
        console.log(`✅ Chunk ${i + 1}: Found ${chunkEvents.length} events`);
      } catch (chunkError) {
        console.warn(`⚠️ Error querying chunk ${i + 1}:`, chunkError.message);
        // Try smaller chunks if this fails
        if (chunkToBlock - chunkFromBlock > 1000) {
          const halfChunk = Math.floor((chunkToBlock - chunkFromBlock) / 2);
          const midBlock = chunkFromBlock + halfChunk;
          try {
            const firstHalf = await poolManager.queryFilter(filter, chunkFromBlock, midBlock);
            const secondHalf = await poolManager.queryFilter(filter, midBlock + 1, chunkToBlock);
            allEvents.push(...firstHalf, ...secondHalf);
          } catch (retryError) {
            console.error(`❌ Failed to query chunk even with smaller size, skipping blocks ${chunkFromBlock}-${chunkToBlock}`);
          }
        }
      }
    }
    
    const events = allEvents;
    console.log(`✅ Found ${events.length} PoolCreated events total\n`);

    if (events.length === 0) {
      console.log('❌ No PoolCreated events found');
      return;
    }

    // Get pool details
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        const poolId = event.args.poolId;
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Pool ${i + 1}/${events.length}`);
        console.log(`Pool ID: ${poolId}`);
        console.log(`Created at block: ${event.blockNumber}`);
        console.log(`Transaction: ${event.transactionHash}`);
        
        // Try to get pool info
        try {
          const poolInfo = await poolManager.getPool(poolId);
          
          // Parse the result (it's a tuple)
          const poolIdReturned = poolInfo[0] || poolInfo.poolId;
          const creator = poolInfo[1] || poolInfo.creator;
          const name = poolInfo[2] || poolInfo.name;
          const description = poolInfo[3] || poolInfo.description;
          const totalValue = poolInfo[4] || poolInfo.totalValue;
          const totalShares = poolInfo[5] || poolInfo.totalShares;
          const isActive = poolInfo[8] !== undefined ? poolInfo[8] : poolInfo.isActive;
          const hasTranches = poolInfo[9] !== undefined ? poolInfo[9] : poolInfo.hasTranches;
          const assets = poolInfo[11] || poolInfo.assets || [];
          const tranches = poolInfo[12] || poolInfo.tranches || [];
          
          console.log(`✅ Pool exists on-chain:`);
          console.log(`   Name: ${name}`);
          console.log(`   Description: ${description || 'No description'}`);
          console.log(`   Creator: ${creator}`);
          console.log(`   Total Value: ${ethers.formatEther(totalValue)} TRUST`);
          console.log(`   Total Shares: ${ethers.formatEther(totalShares)}`);
          console.log(`   Is Active: ${isActive}`);
          console.log(`   Has Tranches: ${hasTranches}`);
          console.log(`   Assets Count: ${assets.length}`);
          console.log(`   Tranches Count: ${tranches.length}`);
          
          if (assets.length > 0) {
            console.log(`   Asset IDs:`);
            assets.forEach((assetId, idx) => {
              console.log(`     ${idx + 1}. ${assetId}`);
            });
          }
          
          if (tranches.length > 0) {
            console.log(`   Tranche IDs:`);
            for (const trancheId of tranches) {
              try {
                const trancheInfo = await poolManager.getTranche(trancheId);
                const trancheType = trancheInfo.trancheType === 0 ? 'SENIOR' : 'JUNIOR';
                console.log(`     - ${trancheType}: ${trancheId}`);
              } catch (e) {
                console.log(`     - Unknown: ${trancheId}`);
              }
            }
          }
        } catch (poolError) {
          console.log(`❌ Failed to get pool details:`);
          console.log(`   Error: ${poolError.message}`);
          console.log(`   This pool might not exist or contract might have issues`);
        }
      } catch (error) {
        console.error(`❌ Error processing event ${i + 1}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Pool check complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

