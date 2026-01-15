#!/usr/bin/env node

const { ethers } = require('ethers');

const POOL_MANAGER_ADDRESS = '0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80';

// Multiple RPC endpoints with fallback (ordered by speed/reliability)
const RPC_ENDPOINTS = [
  // Fastest endpoints first
  'wss://mantle.drpc.org',
  'wss://mantle-rpc.publicnode.com',
  'https://mantle.drpc.org',
  'https://mantle-rpc.publicnode.com',
  'https://mantle-public.nodies.app',
  'https://mantle.api.onfinality.io/public',
  'https://api.zan.top/mantle-mainnet',
  'https://rpc.owlracle.info/mantle/70d38ce1826c4a60bb2a8e05a6c8b20f',
  'https://rpc.mantle.xyz',
  'https://rpc.sepolia.mantle.xyz',
  'https://1rpc.io/mantle',
];

const POOL_MANAGER_ABI = [
  'function totalPools() view returns (uint256)',
  'event PoolCreated(bytes32 indexed poolId, address indexed creator, string name, uint256 totalValue)',
  'function getPool(bytes32) view returns (tuple(bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[]))'
];

async function connectToRPC() {
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      console.log(`🔗 Trying: ${rpcUrl}`);
      // Use WebSocketProvider for wss:// URLs, JsonRpcProvider for https:// URLs
      const provider = rpcUrl.startsWith('wss://') || rpcUrl.startsWith('ws://')
        ? new ethers.WebSocketProvider(rpcUrl)
        : new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Connected! Current block: ${blockNumber}\n`);
      return provider;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  throw new Error('Failed to connect to any RPC endpoint');
}

async function main() {
  console.log('🔍 === CHECKING POOLS ON-CHAIN ===\n');
  console.log(`PoolManager: ${POOL_MANAGER_ADDRESS}\n`);

  try {
    // Connect to RPC
    const provider = await connectToRPC();
    const poolManager = new ethers.Contract(POOL_MANAGER_ADDRESS, POOL_MANAGER_ABI, provider);

    // Try to get total pools
    let totalPools = 0;
    try {
      totalPools = Number(await poolManager.totalPools());
      console.log(`📊 Total pools on-chain: ${totalPools}\n`);
    } catch (error) {
      console.log(`⚠️ Could not get totalPools(): ${error.message}`);
      console.log(`   Will query events directly...\n`);
    }

    // Query PoolCreated events from block 0 to catch all pools
    const currentBlock = await provider.getBlockNumber();
    
    // Verify contract exists
    const code = await provider.getCode(POOL_MANAGER_ADDRESS);
    if (code === '0x') {
      console.log('❌ Contract not found at this address!');
      console.log('   Please verify the PoolManager address is correct.');
      return;
    }
    
    // Query from block 0 to catch all pools (will be chunked automatically)
    const fromBlock = 0;
    
    console.log(`📡 Querying PoolCreated events from block ${fromBlock} to ${currentBlock} (${currentBlock} blocks)...`);
    console.log(`   This will query in chunks of 10,000 blocks to respect RPC limits...\n`);
    
    const filter = poolManager.filters.PoolCreated();
    const maxBlockRange = 10000;
    const totalBlocks = currentBlock - fromBlock;
    const chunks = Math.ceil(totalBlocks / maxBlockRange);
    
    const allEvents = [];
    
    for (let i = 0; i < chunks; i++) {
      const chunkFrom = fromBlock + (i * maxBlockRange);
      const chunkTo = Math.min(fromBlock + ((i + 1) * maxBlockRange) - 1, currentBlock);
      
      if (chunkFrom > currentBlock) break;
      
      try {
        console.log(`   Chunk ${i + 1}/${chunks}: blocks ${chunkFrom}-${chunkTo}...`);
        const events = await poolManager.queryFilter(filter, chunkFrom, chunkTo);
        allEvents.push(...events);
        console.log(`   ✅ Found ${events.length} events`);
      } catch (error) {
        console.log(`   ⚠️ Error: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Total PoolCreated events: ${allEvents.length}\n`);

    if (allEvents.length === 0) {
      console.log('❌ No pools found on-chain');
      return;
    }

    // Get details for each pool
    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];
      const poolId = event.args.poolId;
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Pool ${i + 1}/${allEvents.length}`);
      console.log(`Pool ID: ${poolId}`);
      console.log(`Block: ${event.blockNumber}`);
      console.log(`Tx: ${event.transactionHash}`);
      
      try {
        const poolInfo = await poolManager.getPool(poolId);
        
        const name = poolInfo[2] || poolInfo.name || 'Unknown';
        const creator = poolInfo[1] || poolInfo.creator || 'Unknown';
        const totalValue = poolInfo[4] || poolInfo.totalValue || 0n;
        const totalShares = poolInfo[5] || poolInfo.totalShares || 0n;
        const isActive = poolInfo[8] !== undefined ? poolInfo[8] : (poolInfo.isActive !== undefined ? poolInfo.isActive : false);
        const assets = poolInfo[11] || poolInfo.assets || [];
        const tranches = poolInfo[12] || poolInfo.tranches || [];
        
        console.log(`✅ Pool Details:`);
        console.log(`   Name: ${name}`);
        console.log(`   Creator: ${creator}`);
        console.log(`   Total Value: ${ethers.formatEther(totalValue)} TRUST`);
        console.log(`   Total Shares: ${ethers.formatEther(totalShares)}`);
        console.log(`   Active: ${isActive}`);
        console.log(`   Assets: ${assets.length}`);
        console.log(`   Tranches: ${tranches.length}`);
        
        if (assets.length > 0) {
          console.log(`   Asset IDs:`);
          assets.forEach((assetId, idx) => {
            console.log(`     ${idx + 1}. ${assetId}`);
          });
        }
      } catch (error) {
        console.log(`❌ Error fetching pool details: ${error.message}`);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Check complete: ${allEvents.length} pools found`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();

