/**
 * Script to remove pools that are not on-chain
 * Run this with: npx ts-node scripts/remove-non-on-chain-pools.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AMCPoolsService } from '../src/amc-pools/amc-pools.service';

async function removeNonOnChainPools() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const poolsService = app.get(AMCPoolsService);

  try {
    console.log('🔍 Searching for pools that are not on-chain...');
    const result = await poolsService.removeNonOnChainPools();
    
    if (result.deletedCount > 0) {
      console.log(`✅ Removed ${result.deletedCount} pools that were not on-chain:`);
      result.pools.forEach(poolId => {
        console.log(`   - ${poolId}`);
      });
    } else {
      console.log('✅ No pools found that are not on-chain. All pools are properly on-chain.');
    }
  } catch (error) {
    console.error('❌ Error removing non-on-chain pools:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

removeNonOnChainPools();







