const { ethers } = require('ethers');

async function main() {
  console.log('🔍 Checking pools on-chain...\n');

  const rpcUrl = 'https://rpc.sepolia.mantle.xyz';
  const poolManagerAddress = '0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80';
  
  console.log('RPC:', rpcUrl);
  console.log('PoolManager:', poolManagerAddress);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    const poolManagerABI = [
      'event PoolCreated(bytes32 indexed poolId, address indexed creator, string name, uint256 totalValue)',
      'function getPool(bytes32) view returns (tuple(bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[]))'
    ];

    const poolManager = new ethers.Contract(poolManagerAddress, poolManagerABI, provider);
    
    // Query events in chunks
    const fromBlock = Math.max(0, currentBlock - 100000);
    const filter = poolManager.filters.PoolCreated();
    
    console.log(`Querying events from block ${fromBlock} to ${currentBlock}...`);
    
    const events = await poolManager.queryFilter(filter, fromBlock, currentBlock);
    console.log(`\n✅ Found ${events.length} PoolCreated events\n`);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const poolId = event.args.poolId;
      console.log(`Pool ${i + 1}: ${poolId}`);
      
      try {
        const poolInfo = await poolManager.getPool(poolId);
        const name = poolInfo[2] || poolInfo.name;
        const isActive = poolInfo[8] !== undefined ? poolInfo[8] : poolInfo.isActive;
        const assets = poolInfo[11] || poolInfo.assets || [];
        console.log(`  Name: ${name}`);
        console.log(`  Active: ${isActive}`);
        console.log(`  Assets: ${assets.length}`);
      } catch (e) {
        console.log(`  ⚠️ Could not fetch details: ${e.message}`);
      }
    }
    
    console.log(`\n✅ Total: ${events.length} pools found on-chain`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

