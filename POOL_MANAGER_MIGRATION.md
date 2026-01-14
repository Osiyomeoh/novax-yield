# PoolManager Contract Migration Guide

## Problem
You deployed a new PoolManager contract, but:
- ❌ Can't see pools you created before
- ❌ Can't create new pools
- ❌ ABI copy failed during deployment

## Root Cause
- **Old PoolManager**: `0x03060EE3a1fAF00f9F57abCD07De73a971d8699C`
- **New PoolManager**: `0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80`

Pools created on the old contract won't appear when querying the new contract.

## Solution Steps

### 1. Copy ABI to Frontend
```bash
cd trustbridge-backend/contracts
cp artifacts/contracts/PoolManager.sol/PoolManager.json \
   ../../trustbridge-frontend/src/contracts/PoolManager.json
```

### 2. Update Frontend Environment Variables
Add to `trustbridge-frontend/.env`:
```env
VITE_POOL_MANAGER_ADDRESS=0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80
```

### 3. Update Backend Environment Variables
Add to `trustbridge-backend/.env`:
```env
POOL_MANAGER_ADDRESS=0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80
```

### 4. Restart Services
- Restart backend server
- Rebuild and restart frontend

## What Happened to Old Pools?

**Old pools are still on-chain** but on the old contract address. They won't show up when querying the new contract.

### Options:

#### Option 1: Recreate Pools (Recommended)
- Create new pools on the new contract
- Old pools remain on old contract (can't interact with them)

#### Option 2: Query Both Contracts (Advanced)
Modify the frontend to query both old and new contracts and merge results.

## Verification

After updating:
1. ✅ Check frontend can read pools from new contract
2. ✅ Check pool creation works
3. ✅ Verify ABI is loaded correctly

## Current Status

- ✅ Backend code updated (default address set)
- ✅ Frontend `poolService.ts` fixed (uses env var)
- ✅ Frontend `mantleContractService.ts` uses `getContractAddress()` (reads env)
- ⚠️ Need to copy ABI manually
- ⚠️ Need to set environment variables
- ⚠️ Old pools won't show up (need to recreate)

