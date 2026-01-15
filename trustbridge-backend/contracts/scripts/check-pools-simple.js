const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function main() {
  console.log('🔍 === CHECKING POOLS ON-CHAIN ===\n');

  const rpcUrl = process.env.MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
  const poolManagerAddress = '0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80';
  
  console.log('📋 Configuration:');
  console.log('   RPC URL:', rpcUrl);
  console.log('   PoolManager:', poolManagerAddress);
  console.log('');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const poolManagerABI = [
    'function totalPools() view returns (uint256)',
    'event PoolCreated(bytes32 indexed poolId, address indexed creator, string name, uint256 totalValue)',
    'function getPool(bytes32) view returns (tuple(bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[]))'
  ];

  const poolManager = new ethers.Contract(poolManagerAddress, poolManagerABI, provider);

  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);

    // Try to get total pools
    let totalPools = 0;
    try {
      totalPools = Number(await poolManager.totalPools());
      console.log(`📊 Total pools on-chain: ${totalPools}\n`);
    } catch (error) {
      console.warn('⚠️ Could not get totalPools, querying events directly:', error.message);
    }

    // Query PoolCreated events with chunking
    const maxBlockRange = 10000;
    const lookbackBlocks = 100000;
    const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
    
    console.log(`📡 Querying PoolCreated events from block ${fromBlock} to ${currentBlock}...`);
    
    const filter = poolManager.filters.PoolCreated();
    const allEvents = [];
    
    const totalBlocks = currentBlock - fromBlock;
    const chunks = Math.ceil(totalBlocks / maxBlockRange);
    
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
      }
    }
    
    console.log(`\n✅ Found ${allEvents.length} PoolCreated events total\n`);

    if (allEvents.length === 0) {
      console.log('❌ No pools found on-chain');
      return;
    }

    // Get pool details
    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];
      try {
        const poolId = event.args.poolId;
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Pool ${i + 1}/${allEvents.length}`);
        console.log(`Pool ID: ${poolId}`);
        console.log(`Created at block: ${event.blockNumber}`);
        console.log(`Transaction: ${event.transactionHash}`);
        
        // Get pool info
        try {
          const poolInfo = await poolManager.getPool(poolId);
          
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
        } catch (poolError) {
          console.log(`❌ Failed to get pool details: ${poolError.message}`);
        }
      } catch (error) {
        console.error(`❌ Error processing event ${i + 1}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Found ${allEvents.length} pools on-chain`);
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

