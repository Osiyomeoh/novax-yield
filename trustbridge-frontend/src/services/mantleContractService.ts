import { ethers } from 'ethers';
import { getContractAddress } from '../config/contracts';

// Import contract ABIs
import CoreAssetFactoryABI from '../contracts/CoreAssetFactory.json';
import AssetNFTABI from '../contracts/AssetNFT.json';
import TrustTokenABI from '../contracts/TrustToken.json';
import PoolManagerABI from '../contracts/PoolManager.json';
import TRUSTMarketplaceABI from '../contracts/TRUSTMarketplace.json';
import AMCManagerABI from '../contracts/AMCManager.json';

/**
 * Mantle Contract Service
 * Handles all smart contract interactions on Mantle Network
 */

export class MantleContractService {
  private signer: ethers.Signer | null = null;
  private provider: ethers.Provider | null = null;

  /**
   * Initialize with signer and provider
   */
  initialize(signer: ethers.Signer, provider: ethers.Provider) {
    this.signer = signer;
    this.provider = provider;
  }

  /**
   * Get contract instance
   * Supports both signer (for transactions) and provider (for read-only operations)
   */
  private getContract(address: string, abi: any): ethers.Contract {
    if (!this.signer && !this.provider) {
      throw new Error('Signer or provider not initialized. Please connect wallet first.');
    }
    const abiArray = Array.isArray(abi) ? abi : abi.abi || abi;
    // Use signer if available (for transactions), otherwise use provider (for read-only)
    return new ethers.Contract(address, abiArray, this.signer || this.provider!);
  }

  // CORE ASSET FACTORY METHODS

  /**
   * Check MNT (native token) balance for gas fees
   */
  async checkMNTBalance(address?: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    // Get address from signer if available, otherwise use the address passed
    let walletAddress: string;
    if (address) {
      walletAddress = address;
    } else if (this.signer) {
      walletAddress = await this.signer.getAddress();
    } else {
      throw new Error('Signer not initialized and no address provided. Cannot get balance.');
    }
    
    // Get balance with retry logic for rate limiting
    let balance = 0n;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        balance = await this.provider.getBalance(walletAddress);
        break;
      } catch (error: any) {
        const errorCode = error.code || error.error?.code;
        if ((errorCode === -32002 || error.message?.includes('too many errors')) && attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`⚠️ RPC rate limited for balance check, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    return balance;
  }

  /**
   * Estimate gas fee for transaction (in MNT)
   */
  async estimateGasFee(tx: ethers.TransactionRequest): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const gasEstimate = await this.provider.estimateGas(tx);
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    return gasEstimate * gasPrice;
  }

  /**
   * Exchange MNT for TRUST tokens using TrustTokenExchangeMantle contract
   * 
   * This uses the proper exchange contract with full tokenomics:
   * 1. Receives MNT payment
   * 2. Distributes MNT to treasury (60%), operations (25%), staking (10%), fees (5%)
   * 3. Mints TRUST tokens to user via TrustToken.mint()
   */
  async exchangeMNTForTrust(mntAmount: bigint): Promise<{ txHash: string; trustAmount: bigint }> {
    if (!this.signer || !this.provider) {
      throw new Error('Signer and provider must be initialized');
    }

    const userAddress = await this.signer.getAddress();

    // Get exchange contract address
    const exchangeAddress = getContractAddress('TRUST_TOKEN_EXCHANGE');
    if (exchangeAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(
        'TrustTokenExchange contract not deployed. Please deploy the exchange contract first. ' +
        'Run: npm run deploy:trust-exchange in the contracts directory.'
      );
    }

    // Load exchange contract ABI (we'll create a simple interface)
    const exchangeABI = [
      "function exchangeMntForTrust() payable",
      "function calculateTrustAmount(uint256 mntAmount) view returns (uint256)",
      "function calculateExchangeFee(uint256 mntAmount) view returns (uint256)",
      "function MIN_EXCHANGE() view returns (uint256)",
      "event ExchangeExecuted(address indexed user, uint256 mntAmount, uint256 trustAmount, uint256 exchangeFee, uint256 timestamp)"
    ];

    const exchangeContract = new ethers.Contract(exchangeAddress, exchangeABI, this.signer);

    // Check minimum exchange amount
    const minExchange = await exchangeContract.MIN_EXCHANGE();
    if (mntAmount < minExchange) {
      throw new Error(
        `Minimum exchange amount is ${ethers.formatEther(minExchange)} MNT. ` +
        `You provided ${ethers.formatEther(mntAmount)} MNT.`
      );
    }

    // Calculate expected TRUST amount
    const trustAmount = await exchangeContract.calculateTrustAmount(mntAmount);
    const fee = await exchangeContract.calculateExchangeFee(mntAmount);

    console.log(`🔄 Exchanging ${ethers.formatEther(mntAmount)} MNT for ${ethers.formatEther(trustAmount)} TRUST tokens`);
    console.log(`   Fee: ${ethers.formatEther(fee)} MNT (5%)`);
    console.log(`   Net MNT: ${ethers.formatEther(mntAmount - fee)} MNT`);
    console.log(`   Exchange Contract: ${exchangeAddress}`);
    
    // Execute exchange - send MNT and receive TRUST tokens
    const tx = await exchangeContract.exchangeMntForTrust({ value: mntAmount });
    console.log(`⏳ Transaction submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt not available');
    }

    // Parse event to get actual trust amount
    const exchangeEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = exchangeContract.interface.parseLog(log);
        return parsed && parsed.name === 'ExchangeExecuted';
      } catch {
        return false;
      }
    });

    let actualTrustAmount = trustAmount;
    if (exchangeEvent) {
      try {
        const parsed = exchangeContract.interface.parseLog(exchangeEvent);
        if (parsed && parsed.args) {
          actualTrustAmount = parsed.args.trustAmount;
        }
      } catch (error) {
        console.warn('Could not parse exchange event, using calculated amount:', error);
      }
    }

    console.log(`✅ Exchange successful! Received ${ethers.formatEther(actualTrustAmount)} TRUST tokens`);

    return {
      txHash: receipt.hash,
      trustAmount: actualTrustAmount
    };
  }

  /**
   * Create RWA Asset
   * Calls CoreAssetFactory.createRWAAsset()
   * Flow: Check MNT balance (gas) → Check TRUST balance (payment) → Approve TRUST → Transfer TRUST → Create Asset
   */
  async createRWAAsset(params: {
    category: number; // AssetCategory enum (0 = REAL_ESTATE, etc.)
    assetTypeString: string;
    name: string;
    location: string;
    totalValue: bigint; // Value in TRUST tokens (wei)
    maturityDate: bigint; // Unix timestamp
    maxInvestablePercentage: number; // Maximum percentage that can be tokenized (0-100)
    evidenceHashes: string[]; // IPFS CIDs
    documentTypes: string[]; // Document type names
    imageURI: string; // IPFS URL
    documentURI: string; // IPFS URL
    description: string;
  }): Promise<{ assetId: string; txHash: string }> {
    if (!this.signer || !this.provider) {
      throw new Error('Signer or provider not initialized. Please connect wallet first.');
    }

    const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
    const trustTokenAddress = getContractAddress('TRUST_TOKEN');
    const userAddress = await this.signer.getAddress();

    // Step 1: Check MNT balance for gas fees
    console.log('🔍 Checking MNT balance for gas fees...');
    const mntBalance = await this.checkMNTBalance();
    const minMNTRequired = ethers.parseEther('0.01'); // Minimum 0.01 MNT for gas
    
    if (mntBalance < minMNTRequired) {
      throw new Error(
        `Insufficient MNT for gas fees. You have ${ethers.formatEther(mntBalance)} MNT but need at least ${ethers.formatEther(minMNTRequired)} MNT. ` +
        `Please add MNT to your wallet for transaction gas fees.`
      );
    }
    console.log(`✅ MNT balance: ${ethers.formatEther(mntBalance)} MNT`);

    // Step 2: Check TRUST token balance (payment)
    const trustToken = this.getContract(trustTokenAddress, TrustTokenABI);
    const creationFee = ethers.parseEther('100'); // 100 TRUST tokens
    
    console.log('🔍 Checking TRUST token balance...');
    const trustBalance = await trustToken.balanceOf(userAddress);
    console.log(`💰 TRUST balance: ${ethers.formatEther(trustBalance)} TRUST`);
    
    if (trustBalance < creationFee) {
      throw new Error(
        `Insufficient TRUST tokens. You have ${ethers.formatEther(trustBalance)} TRUST but need ${ethers.formatEther(creationFee)} TRUST for asset creation. ` +
        `Please acquire more TRUST tokens or exchange MNT for TRUST tokens.`
      );
    }

    // Step 3: Approve TRUST tokens
    console.log('🔍 Approving TRUST tokens...');
    const allowance = await trustToken.allowance(userAddress, factoryAddress);
    if (allowance < creationFee) {
      const approvalTx = await trustToken.approve(factoryAddress, creationFee);
      console.log('⏳ Waiting for TRUST approval transaction...');
      await approvalTx.wait();
      console.log('✅ TRUST tokens approved');
    } else {
      console.log('✅ TRUST tokens already approved');
    }

    // Step 4: Transfer TRUST tokens to contract (contract checks balance)
    console.log('🔍 Transferring TRUST tokens to contract...');
    const transferTx = await trustToken.transfer(factoryAddress, creationFee);
    console.log('⏳ Waiting for TRUST transfer transaction...');
    await transferTx.wait();
    console.log('✅ TRUST tokens transferred to contract');

    // Step 5: Get factory contract and estimate gas
    const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
    const factory = this.getContract(factoryAddress, factoryABI);
    
    // Estimate gas for createRWAAsset call
    console.log('🔍 Estimating gas for asset creation...');
    const gasEstimate = await factory.createRWAAsset.estimateGas(
      params.category,
      params.assetTypeString,
      params.name,
      params.location,
      params.totalValue,
      params.maturityDate,
      params.maxInvestablePercentage || 100,
      params.evidenceHashes,
      params.documentTypes,
      params.imageURI,
      params.documentURI,
      params.description
    );
    const feeData = await this.provider.getFeeData();
    const estimatedGasFee = gasEstimate * (feeData.gasPrice || 0n);
    console.log(`⛽ Estimated gas fee: ${ethers.formatEther(estimatedGasFee)} MNT`);

    // Check if user has enough MNT for gas
    if (mntBalance < estimatedGasFee) {
      throw new Error(
        `Insufficient MNT for gas. Estimated gas fee: ${ethers.formatEther(estimatedGasFee)} MNT, ` +
        `Your balance: ${ethers.formatEther(mntBalance)} MNT. Please add more MNT for gas fees.`
      );
    }

    // Step 6: Create RWA asset
    console.log('🚀 Creating RWA asset on-chain...');
    console.log('📋 IPFS URLs being stored:', {
      imageURI: params.imageURI,
      documentURI: params.documentURI,
      evidenceHashes: params.evidenceHashes,
      evidenceCount: params.evidenceHashes.length
    });
    
    const tx = await factory.createRWAAsset(
      params.category,
      params.assetTypeString,
      params.name,
      params.location,
      params.totalValue,
      params.maturityDate,
      params.maxInvestablePercentage || 100, // Default to 100% if not provided
      params.evidenceHashes,
      params.documentTypes,
      params.imageURI,
      params.documentURI,
      params.description
    );
    
    console.log('✅ Asset creation transaction submitted:', tx.hash);

    console.log('⏳ Waiting for asset creation transaction...');
    const receipt = await tx.wait();
    console.log('✅ Asset creation transaction confirmed');
    
    // Extract assetId from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === 'AssetCreated';
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error('AssetCreated event not found in transaction receipt');
    }

    const parsedEvent = factory.interface.parseLog(event);
    const assetId = parsedEvent?.args[0]; // First argument is assetId (bytes32)

    // Sync asset ID to database for fast future lookups (non-blocking)
    try {
      const { hybridAssetService } = await import('./hybridAssetService');
      await hybridAssetService.syncAssetToDatabase({
        assetId: assetId,
        owner: userAddress,
        blockchainAddress: factoryAddress,
        type: 'RWA',
        category: params.assetTypeString || 'RWA',
        name: params.name,
        imageHash: params.imageURI,
        documentHash: params.documentURI
      });
      console.log('✅ Asset ID synced to database for fast lookups');
    } catch (syncError: any) {
      // Don't fail the creation if sync fails - it's just for optimization
      console.warn('⚠️ Failed to sync asset to database (non-critical):', syncError.message);
    }

    return {
      assetId: assetId,
      txHash: receipt.hash,
    };
  }


  /**
   * Get Asset Details
   */
  async getAsset(assetId: string): Promise<any> {
    const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
    const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
    const factory = this.getContract(factoryAddress, factoryABI);
    
    try {
      // Use getAsset() function (more reliable than assets mapping)
      let assetResult;
      try {
        assetResult = await factory.getAsset(assetId);
      } catch (getAssetError: any) {
        // Fallback to assets() mapping if getAsset() is not available
        console.warn(`⚠️ getAsset() failed, trying assets() mapping:`, getAssetError.message);
        if (typeof factory.assets === 'function') {
          assetResult = await factory.assets(assetId);
        } else {
          throw new Error(`Failed to fetch asset: neither getAsset() nor assets() are available`);
        }
      }
      
      console.log(`🔍 Fetching asset ${assetId} details...`);
      console.log(`📦 Raw asset result:`, assetResult);
      
      const asset = assetResult;
      
      // Extract all fields from the struct
      const assetName = asset.name || asset[6] || `Asset ${assetId.slice(0, 8)}`;
      const assetDescription = asset.description || asset[15] || '';
      let assetImageURI = asset.imageURI || asset[13] || '';
      let assetDocumentURI = asset.documentURI || asset[14] || '';
      const assetTypeString = asset.assetTypeString || asset[5] || 'RWA';
      const assetLocation = asset.location || asset[7] || '';
      const assetTotalValue = asset.totalValue || asset[8] || 0n;
      const assetMaturityDate = asset.maturityDate || asset[9] || 0n;
      const assetMaxInvestablePercentage = asset.maxInvestablePercentage !== undefined 
        ? Number(asset.maxInvestablePercentage) 
        : (asset[10] !== undefined ? Number(asset[10]) : 100); // Index 10 is maxInvestablePercentage
      const assetTokenId = asset.tokenId || asset[18] || 0n; // Fixed: tokenId is at index 18
      const assetStatus = asset.status || asset[19] || 0n; // Fixed: status is at index 19
      const assetCreatedAt = asset.createdAt || asset[21] || 0n; // Fixed: createdAt is at index 21
      const assetCurrentOwner = asset.currentOwner || asset[2] || '';
      const assetOriginalOwner = asset.originalOwner || asset[1] || '';
      
      // Normalize IPFS URLs using the utility function
      const { normalizeIPFSUrl } = await import('../utils/imageUtils');
      
      if (assetImageURI) {
        const normalized = normalizeIPFSUrl(assetImageURI);
        assetImageURI = normalized || assetImageURI;
        console.log(`🖼️ Normalized image URI: ${assetImageURI}`);
      }
      
      if (assetDocumentURI) {
        const normalized = normalizeIPFSUrl(assetDocumentURI);
        assetDocumentURI = normalized || assetDocumentURI;
        console.log(`📄 Normalized document URI: ${assetDocumentURI}`);
      }
      
      // Try to fetch metadata from documentURI if it's a JSON file
      let metadata: any = null;
      if (assetDocumentURI && assetDocumentURI.includes('/ipfs/')) {
        try {
          console.log(`📥 Fetching metadata from documentURI: ${assetDocumentURI}`);
          const response = await fetch(assetDocumentURI);
          if (response.ok) {
            metadata = await response.json();
            console.log(`✅ Metadata fetched successfully:`, metadata);
          } else {
            console.warn(`⚠️ Failed to fetch metadata: ${response.status} ${response.statusText}`);
          }
        } catch (metadataError: any) {
          console.warn(`⚠️ Error fetching metadata from documentURI:`, metadataError.message);
        }
      }
      
      const assetData = {
        assetId: assetId,
        tokenId: assetTokenId.toString(),
        name: assetName,
        description: assetDescription,
        imageURI: assetImageURI,
        documentURI: assetDocumentURI,
        assetType: assetTypeString,
        location: assetLocation,
        totalValue: assetTotalValue?.toString() || '0',
        maxInvestablePercentage: assetMaxInvestablePercentage, // Add maxInvestablePercentage
        maturityDate: assetMaturityDate?.toString() || '0',
        verificationScore: '0',
        isActive: assetStatus === 6n || assetStatus === 7n,
        createdAt: assetCreatedAt?.toString() || Date.now().toString(),
        owner: assetCurrentOwner || assetOriginalOwner,
        status: assetStatus,
        metadata: metadata || {
          assetType: assetTypeString,
          type: 'rwa',
          category: 'RWA',
          name: assetName,
          description: assetDescription,
          image: assetImageURI,
          documentURI: assetDocumentURI
        }
      };
      
      // If metadata was fetched, merge it into assetData
      if (metadata) {
        assetData.metadata = {
          ...assetData.metadata,
          ...metadata,
          // Preserve IPFS URLs
          image: assetImageURI,
          displayImage: assetImageURI,
          imageURI: assetImageURI,
          documentURI: assetDocumentURI,
          // Include evidence files if present
          evidenceFiles: metadata.evidenceFiles || []
        };
      }
      
      console.log(`✅ Asset details retrieved:`, {
        assetId,
        name: assetData.name,
        hasImage: !!assetData.imageURI,
        hasDocument: !!assetData.documentURI,
        hasMetadata: !!metadata
      });
      
      return assetData;
    } catch (error: any) {
      console.error(`❌ Error fetching asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Get User's Assets from Factory Contract
   * Returns array of asset IDs owned by the user (before NFT minting)
   */
  async getUserAssetsFromFactory(userAddress: string): Promise<any[]> {
    console.log('🚀 ========== getUserAssetsFromFactory CALLED ==========');
    console.log('🚀 User address:', userAddress);
    console.log('🚀 This function will fetch assets and call getAsset() for each to get imageURI');
    
    let provider = this.provider;
    
    if (!provider) {
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('⚠️ Using read-only provider for getUserAssetsFromFactory');
    }
    
    // Store the provider temporarily so contract calls can use it
    const originalProvider = this.provider;
    this.provider = provider; // Temporarily set so getContract() can use it

    try {
      // Normalize address (checksum)
      const normalizedAddress = ethers.getAddress(userAddress);
      console.log('🔍 Fetching user assets from Factory contract for address:', normalizedAddress);
      console.log('🔍 Original address:', userAddress);
      
      const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
      console.log('🔍 Factory contract address:', factoryAddress);
      
      if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
        console.error('❌ Factory contract address not configured');
        console.error('❌ Please set VITE_CORE_ASSET_FACTORY_CONTRACT_ADDRESS in .env');
        return [];
      }
      
      const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
    const factory = this.getContract(factoryAddress, factoryABI);
      
      // Get asset IDs from factory
      // Note: userAssets mapping getter requires an index, so we'll query events instead
      let assetIds: any[] = [];
      
      // Try getUserAssets function first (if it exists in ABI)
      try {
        if (factory.getUserAssets && typeof factory.getUserAssets === 'function') {
          console.log('🔍 Trying getUserAssets function...');
          assetIds = await factory.getUserAssets(normalizedAddress);
          console.log(`📦 Found ${assetIds.length} asset IDs from getUserAssets function:`, assetIds.map((id: string) => id?.toString() || id));
        }
      } catch (funcError: any) {
        console.log('⚠️ getUserAssets function not available or failed:', funcError.message);
      }
      
      // If getUserAssets didn't work, query AssetCreated events (more reliable)
      if (assetIds.length === 0) {
        console.log('🔍 Querying AssetCreated events as fallback...');
        try {
          const currentBlock = await provider.getBlockNumber();
          console.log(`📡 Current block: ${currentBlock}`);
          
          // Query ALL events in chunks to find ALL assets (no hardcoded limit, no initial query)
          // This ensures we find all assets regardless of when they were created
          console.log(`🔍 Querying all blocks in chunks to find ALL assets for ${normalizedAddress}...`);
          const chunkSize = 10000; // Query 10k blocks at a time (larger chunks for efficiency)
          const maxBlocksBack = 200000; // Go back up to 200k blocks (more than enough)
          const chunks = Math.ceil(maxBlocksBack / chunkSize);
          const foundAssetIds = new Set<string>();
          assetIds = [];
          
          // Query all chunks to ensure we find all assets
          for (let i = 0; i < chunks; i++) {
            const chunkFromBlock = Math.max(0, currentBlock - (i + 1) * chunkSize);
            const chunkToBlock = i === 0 ? currentBlock : Math.min(currentBlock, currentBlock - i * chunkSize);
            
            // Skip invalid ranges
            if (chunkFromBlock >= chunkToBlock) continue;
            
            try {
              console.log(`📡 Querying chunk ${i + 1}/${chunks}: blocks ${chunkFromBlock} to ${chunkToBlock} (${chunkToBlock - chunkFromBlock} blocks)...`);
              
              // Try with owner filter first (more efficient)
              try {
                const chunkFilter = factory.filters.AssetCreated(null, normalizedAddress);
                const chunkEvents = await factory.queryFilter(chunkFilter, chunkFromBlock, chunkToBlock);
                
                if (chunkEvents.length > 0) {
                  chunkEvents.forEach((event: any) => {
                    const id = event.args[0];
                    const idLower = id.toLowerCase();
                    if (!foundAssetIds.has(idLower)) {
                      foundAssetIds.add(idLower);
                      // Store both assetId and full event data for later use
                      assetIds.push({
                        assetId: id,
                        event: event
                      });
                    }
                  });
                  console.log(`✅ Found ${chunkEvents.length} new assets in chunk ${i + 1}! Total: ${assetIds.length}`);
                }
              } catch (filterError: any) {
                // If filtered query fails (e.g., HTTP 413), try without owner filter and filter manually
                console.log(`⚠️ Filtered query failed for chunk ${i + 1} (may be too many events), trying without owner filter...`);
                const allEventsFilter = factory.filters.AssetCreated();
                const allChunkEvents = await factory.queryFilter(allEventsFilter, chunkFromBlock, chunkToBlock);
                
                console.log(`📊 Found ${allChunkEvents.length} total events in chunk ${i + 1}, filtering by owner...`);
                
                const userChunkEvents = allChunkEvents.filter((event: any) => {
                  if (!event.args) return false;
                  const owner = event.args[1]; // Second argument is owner
                  return owner && owner.toLowerCase() === normalizedAddress.toLowerCase();
                });
                
                userChunkEvents.forEach((event: any) => {
                  const id = event.args[0];
                  const idLower = id.toLowerCase();
                  if (!foundAssetIds.has(idLower)) {
                    foundAssetIds.add(idLower);
                    // Store both assetId and full event data for later use
                    assetIds.push({
                      assetId: id,
                      event: event
                    });
                  }
                });
                
                if (userChunkEvents.length > 0) {
                  console.log(`✅ Found ${userChunkEvents.length} new assets in chunk ${i + 1} (manual filter)! Total: ${assetIds.length}`);
                }
              }
            } catch (chunkError: any) {
              console.warn(`⚠️ Chunk ${i + 1} query failed:`, chunkError.message);
              // Continue to next chunk - don't stop on errors, we want to find all assets
            }
          }
          console.log(`📦 Total unique assets found after comprehensive query: ${assetIds.length}`);
        } catch (eventError: any) {
          console.error('❌ Error querying events:', eventError);
          console.error('❌ Event error details:', {
            message: eventError.message,
            code: eventError.code,
            httpStatus: eventError.data?.httpStatus,
            stack: eventError.stack
          });
        }
      }
      
      if (assetIds.length === 0) {
        console.warn('⚠️ No assets found using any method');
        return [];
      }
      
      // Build asset objects directly from event data (since ABI doesn't expose assets mapping)
      const userAssets: any[] = [];
      
      for (const assetEntry of assetIds) {
        try {
          // assetEntry can be either a string (assetId) or an object with assetId and event
          const assetId = typeof assetEntry === 'string' ? assetEntry : assetEntry.assetId;
          const event = typeof assetEntry === 'object' ? assetEntry.event : null;
          
          console.log(`🔍 Processing asset ${assetId}...`);
          
          // If we have event data, use it directly (more reliable and no contract call needed)
          if (event && event.args) {
            const eventArgs = event.args;
            console.log(`📦 Using event data for asset ${assetId}:`, {
              assetId: eventArgs[0],
              owner: eventArgs[1],
              category: eventArgs[2],
              assetType: eventArgs[3],
              name: eventArgs[4],
              totalValue: eventArgs[5],
              status: eventArgs[6]
            });
            
            // Extract data from event
            const assetName = eventArgs[4] || `Asset ${assetId.slice(0, 8)}...`;
            const assetTypeString = eventArgs[3] || 'RWA';
            const totalValueWei = eventArgs[5] || 0n; // This is in wei (smallest unit)
            const status = eventArgs[6] || 0n;
            const owner = eventArgs[1] || userAddress;
            const category = eventArgs[2] || 0n;
            
            // Format totalValue from wei to TRUST tokens (18 decimals)
            const totalValueFormatted = totalValueWei > 0n ? ethers.formatEther(totalValueWei) : '0';
            
            // Try to fetch additional details (imageURI, documentURI) using getAsset()
            let assetImageURI = '';
            let assetDocumentURI = '';
            
            console.log(`🔍 ========== ABOUT TO FETCH IMAGEURI FOR ${assetId} ==========`);
            console.log(`🔍 Provider status:`, {
              hasProvider: !!this.provider,
              providerType: this.provider ? typeof this.provider : 'null'
            });
            
            // Check if provider is available
            if (!this.provider) {
              console.warn(`⚠️ Provider not available, cannot fetch asset details for ${assetId}`);
              console.warn(`⚠️ Will use event data only (no imageURI/documentURI)`);
            } else {
              try {
                console.log(`🔍 ========== FETCHING ASSET DETAILS FOR ${assetId} ==========`);
                console.log(`🔍 Provider available:`, !!this.provider);
                console.log(`🔍 Factory address:`, factoryAddress);
                
                // Use getAsset() function (same as the script that works)
                const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
                console.log(`🔍 Factory ABI type:`, typeof factoryABI, Array.isArray(factoryABI) ? `Array(${factoryABI.length})` : 'Not array');
                
                // Use this.provider (which we temporarily set to the local provider at the start of getUserAssetsFromFactory)
                // This ensures the contract call works even if this.provider was originally null
                if (!this.provider) {
                  throw new Error('No provider available for contract call');
                }
                const factoryWithGetAsset = new ethers.Contract(factoryAddress, factoryABI, this.provider);
                console.log(`🔍 Contract instance created:`, !!factoryWithGetAsset);
                console.log(`🔍 Has getAsset function?`, typeof factoryWithGetAsset.getAsset === 'function');
                
                // Try getAsset() first (proven to work in the script)
                console.log(`📞 Calling factory.getAsset(${assetId})...`);
                let assetResult;
                try {
                  assetResult = await factoryWithGetAsset.getAsset(assetId);
                  console.log(`✅ getAsset() call succeeded!`);
                } catch (getAssetError: any) {
                  console.error(`❌ getAsset() failed:`, getAssetError);
                  console.warn(`⚠️ getAsset() failed, trying assets() mapping:`, getAssetError.message);
                  // Fallback to assets() mapping if getAsset() is not available
                  if (typeof factoryWithGetAsset.assets === 'function') {
                    console.log(`📞 Trying assets() mapping as fallback...`);
                    assetResult = await factoryWithGetAsset.assets(assetId);
                    console.log(`✅ assets() call succeeded!`);
                  } else {
                    throw new Error(`Failed to fetch asset: both getAsset() and assets() failed`);
                  }
                }
              console.log(`📦 ========== RAW ASSET RESULT FOR ${assetId} ==========`);
              console.log(`📦 Raw asset result type:`, typeof assetResult);
              console.log(`📦 Raw asset result:`, assetResult);
              console.log(`📦 Asset result keys:`, Object.keys(assetResult || {}));
              console.log(`📦 Asset result as array indices:`, Array.isArray(assetResult) ? assetResult.map((v: any, i: number) => ({ index: i, value: v, type: typeof v })) : 'Not an array');
              
              // Log ALL fields from the struct to see what we have
              console.log(`📦 ========== ALL ASSET FIELDS ==========`);
              if (assetResult) {
                // Try to log all possible fields
                const allFields: any = {};
                for (let i = 0; i < 30; i++) {
                  if (assetResult[i] !== undefined) {
                    allFields[`[${i}]`] = assetResult[i];
                  }
                }
                // Also try named fields
                const namedFields = ['id', 'originalOwner', 'currentOwner', 'category', 'assetType', 'assetTypeString', 
                  'name', 'location', 'totalValue', 'maturityDate', 'verificationLevel', 'evidenceHashes', 'documentTypes',
                  'imageURI', 'documentURI', 'description', 'nftContract', 'tokenId', 'status', 'currentAMC', 'createdAt',
                  'verifiedAt', 'amcTransferredAt', 'tradingVolume', 'lastSalePrice', 'isTradeable', 'isListed',
                  'listingPrice', 'listingExpiry', 'currentBuyer', 'currentOffer'];
                namedFields.forEach(field => {
                  if (assetResult[field] !== undefined) {
                    allFields[field] = assetResult[field];
                  }
                });
                console.log(`📦 All fields:`, allFields);
              }
              console.log(`📦 ========== END ALL FIELDS ==========`);
              
              // Extract imageURI and documentURI (try both named and indexed access)
              // In Ethers.js v6, structs can be accessed by name or index
              // Based on the ABI, imageURI is at index 13 and documentURI is at index 14
              assetImageURI = assetResult.imageURI || assetResult[13] || assetResult['imageURI'] || '';
              assetDocumentURI = assetResult.documentURI || assetResult[14] || assetResult['documentURI'] || '';
              
              // Also try accessing via toObject if available
              if (!assetImageURI && assetResult.toObject) {
                console.log(`📦 Trying toObject() method...`);
                const obj = assetResult.toObject();
                console.log(`📦 toObject() result:`, obj);
                assetImageURI = obj.imageURI || obj[13] || '';
                assetDocumentURI = obj.documentURI || obj[14] || '';
              }
              
              // If still empty, try converting to array and accessing by index
              if (!assetImageURI && Array.isArray(assetResult)) {
                console.log(`📦 Asset result is an array, accessing by index...`);
                assetImageURI = assetResult[13] || '';
                assetDocumentURI = assetResult[14] || '';
              }
              
              // Log what we found
              console.log(`🔍 ========== EXTRACTION RESULTS ==========`);
              console.log(`🔍 Extracted values:`, {
                'assetResult.imageURI': assetResult.imageURI,
                'assetResult[13]': assetResult[13],
                'assetResult.documentURI': assetResult.documentURI,
                'assetResult[14]': assetResult[14],
                'Final assetImageURI': assetImageURI,
                'Final assetDocumentURI': assetDocumentURI,
                'assetResult type': typeof assetResult,
                'Is array?': Array.isArray(assetResult),
                'Has toObject?': typeof assetResult.toObject === 'function'
              });
              
              console.log(`✅ ========== FETCHED ASSET DETAILS FOR ${assetId} ==========`);
              console.log(`✅ Asset Name:`, assetResult.name || assetResult[6] || 'N/A');
              console.log(`✅ Image URI:`, assetImageURI || '❌ EMPTY');
              console.log(`✅ Document URI:`, assetDocumentURI || '❌ EMPTY');
              console.log(`✅ Raw imageURI (named):`, assetResult.imageURI);
              console.log(`✅ Raw imageURI (index 13):`, assetResult[13]);
              console.log(`✅ Raw documentURI (named):`, assetResult.documentURI);
              console.log(`✅ Raw documentURI (index 14):`, assetResult[14]);
              console.log(`✅ Has imageURI:`, !!assetImageURI);
              console.log(`✅ Has documentURI:`, !!assetDocumentURI);
              console.log(`✅ Full asset result JSON:`, JSON.stringify(assetResult, (key, value) => {
                // Handle BigInt serialization
                if (typeof value === 'bigint') {
                  return value.toString();
                }
                return value;
              }, 2));
              console.log(`✅ ========== END ASSET DETAILS ==========`);
              
              if (!assetImageURI) {
                console.warn(`⚠️ No imageURI found in contract result for ${assetId}. Asset may not have image stored.`);
              }
              } catch (assetsCallError: any) {
                console.warn(`⚠️ Failed to fetch asset details for ${assetId}:`, assetsCallError.message);
                console.warn(`⚠️ Error details:`, {
                  message: assetsCallError.message,
                  code: assetsCallError.code,
                  data: assetsCallError.data
                });
                // Images will remain empty - continue with event data only
              }
            }
            
            // Normalize IPFS URLs if we have them
            const { normalizeIPFSUrl } = await import('../utils/imageUtils');
            
            console.log(`🔍 Normalizing IPFS URLs for ${assetId}:`, {
              rawImageURI: assetImageURI,
              rawDocumentURI: assetDocumentURI
            });
            
            if (assetImageURI) {
              const normalized = normalizeIPFSUrl(assetImageURI);
              if (normalized) {
                assetImageURI = normalized;
                console.log(`✅ Normalized image URI: ${assetImageURI}`);
              } else if (!assetImageURI.startsWith('http')) {
                console.warn(`⚠️ Image URI is not a valid IPFS URL or HTTP URL: ${assetImageURI}`);
                assetImageURI = '';
              } else {
                console.log(`✅ Image URI is already HTTP: ${assetImageURI}`);
              }
            } else {
              console.warn(`⚠️ No image URI found for asset ${assetId}`);
            }
            
            if (assetDocumentURI) {
              const normalized = normalizeIPFSUrl(assetDocumentURI);
              if (normalized) {
                assetDocumentURI = normalized;
                console.log(`✅ Normalized document URI: ${assetDocumentURI}`);
              } else if (!assetDocumentURI.startsWith('http')) {
                assetDocumentURI = '';
              }
            }
            
            const assetData = {
              assetId: assetId,
              tokenId: '0', // Token ID not in event
              name: assetName,
              description: '', // Not in event
              imageURI: assetImageURI, // Set at top level
              displayImage: assetImageURI, // Also set displayImage for compatibility
              image: assetImageURI, // Also set image for compatibility
              documentURI: assetDocumentURI,
              assetType: assetTypeString,
              location: '', // Not in event
              totalValue: totalValueFormatted, // Already formatted as TRUST tokens (not wei)
              maturityDate: '0', // Not in event
              verificationScore: '0',
              isActive: Number(status) === 6 || Number(status) === 7,
              createdAt: event.blockNumber?.toString() || Date.now().toString(),
              owner: owner,
              status: Number(status),
              metadata: {
                assetType: assetTypeString,
                type: 'rwa',
                category: 'RWA',
                name: assetName,
                description: '',
                image: assetImageURI, // Set in metadata too
                imageURI: assetImageURI, // Set in metadata too
                displayImage: assetImageURI, // Set in metadata too
                documentURI: assetDocumentURI,
                price: totalValueFormatted,
                totalValue: totalValueFormatted
              }
            };
            
            console.log(`✅ ========== ADDED ASSET FROM EVENT: ${assetData.name} ==========`);
            console.log(`✅ Asset ID:`, assetId);
            console.log(`✅ Asset Name:`, assetData.name);
            console.log(`✅ Owner:`, assetData.owner);
            console.log(`✅ Asset Type:`, assetData.assetType);
            console.log(`✅ Total Value:`, assetData.totalValue);
            console.log(`✅ Status:`, assetData.status);
            console.log(`✅ Created At Block:`, assetData.createdAt);
            console.log(`🖼️ ========== IMAGE DETAILS ==========`);
            console.log(`🖼️ Image URI (top level):`, assetData.imageURI || '❌ EMPTY');
            console.log(`🖼️ Display Image:`, assetData.displayImage || '❌ EMPTY');
            console.log(`🖼️ Image:`, assetData.image || '❌ EMPTY');
            console.log(`🖼️ Document URI:`, assetData.documentURI || '❌ EMPTY');
            console.log(`🖼️ Metadata Image:`, assetData.metadata?.image || '❌ EMPTY');
            console.log(`🖼️ Metadata ImageURI:`, assetData.metadata?.imageURI || '❌ EMPTY');
            console.log(`🖼️ Metadata DisplayImage:`, assetData.metadata?.displayImage || '❌ EMPTY');
            console.log(`🖼️ Has any image field?`, !!(assetData.imageURI || assetData.displayImage || assetData.image || assetData.metadata?.image || assetData.metadata?.imageURI));
            console.log(`🖼️ ========== END IMAGE DETAILS ==========`);
            console.log(`📦 ========== COMPLETE ASSET DATA STRUCTURE ==========`);
            console.log(`📦 All asset keys:`, Object.keys(assetData));
            console.log(`📦 Complete asset object:`, JSON.stringify(assetData, (key, value) => {
              // Handle BigInt serialization
              if (typeof value === 'bigint') {
                return value.toString();
              }
              return value;
            }, 2));
            console.log(`📦 ========== END COMPLETE ASSET DATA ==========`);
            
            userAssets.push(assetData);
            continue; // Skip the contract call section
          }
          
          // Fallback: If no event data, try to fetch from contract using getAsset()
          console.warn(`⚠️ No event data available for ${assetId}, fetching from contract...`);
          
          let fallbackAsset: any = null;
          let fallbackImageURI = '';
          let fallbackDocumentURI = '';
          
          // Try to fetch full asset details from contract
          if (this.provider) {
            try {
              console.log(`🔍 Fetching asset ${assetId} via getAsset() (no event data)...`);
              const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
              const factoryWithGetAsset = new ethers.Contract(factoryAddress, factoryABI, this.provider);
              
              let assetResult;
              try {
                assetResult = await factoryWithGetAsset.getAsset(assetId);
                console.log(`✅ getAsset() succeeded for ${assetId} (no event data)`);
              } catch (getAssetError: any) {
                console.warn(`⚠️ getAsset() failed, trying assets() mapping:`, getAssetError.message);
                if (typeof factoryWithGetAsset.assets === 'function') {
                  assetResult = await factoryWithGetAsset.assets(assetId);
                  console.log(`✅ assets() call succeeded for ${assetId}`);
                } else {
                  throw new Error(`Both getAsset() and assets() failed`);
                }
              }
              
              // Extract all fields from the contract result
              const assetName = assetResult.name || assetResult[6] || `Asset ${assetId.slice(0, 8)}...`;
              const assetDescription = assetResult.description || assetResult[15] || '';
              fallbackImageURI = assetResult.imageURI || assetResult[13] || '';
              fallbackDocumentURI = assetResult.documentURI || assetResult[14] || '';
              const assetTypeString = assetResult.assetTypeString || assetResult[5] || 'RWA';
              const assetLocation = assetResult.location || assetResult[7] || '';
              const assetTotalValue = assetResult.totalValue || assetResult[8] || 0n;
              const assetMaturityDate = assetResult.maturityDate || assetResult[9] || 0n;
              const assetMaxInvestablePercentage = assetResult.maxInvestablePercentage !== undefined 
                ? Number(assetResult.maxInvestablePercentage) 
                : (assetResult[10] !== undefined ? Number(assetResult[10]) : 100); // Index 10 is maxInvestablePercentage
              const assetTokenId = assetResult.tokenId || assetResult[18] || 0n; // Fixed: tokenId is at index 18
              const assetStatus = assetResult.status || assetResult[19] || 0n; // Fixed: status is at index 19
              const assetCreatedAt = assetResult.createdAt || assetResult[21] || 0n; // Fixed: createdAt is at index 21
              const assetCurrentOwner = assetResult.currentOwner || assetResult[2] || '';
              
              // Format totalValue from wei to TRUST tokens
              const totalValueFormatted = assetTotalValue > 0n ? ethers.formatEther(assetTotalValue) : '0';
              
              // Normalize IPFS URLs
              const { normalizeIPFSUrl } = await import('../utils/imageUtils');
              if (fallbackImageURI) {
                const normalized = normalizeIPFSUrl(fallbackImageURI);
                if (normalized) {
                  fallbackImageURI = normalized;
                } else if (!fallbackImageURI.startsWith('http')) {
                  fallbackImageURI = '';
                }
              }
              
              if (fallbackDocumentURI) {
                const normalized = normalizeIPFSUrl(fallbackDocumentURI);
                if (normalized) {
                  fallbackDocumentURI = normalized;
                } else if (!fallbackDocumentURI.startsWith('http')) {
                  fallbackDocumentURI = '';
                }
              }
              
              fallbackAsset = {
                assetId: assetId,
                tokenId: assetTokenId.toString(),
                name: assetName,
                description: assetDescription,
                imageURI: fallbackImageURI,
                displayImage: fallbackImageURI,
                image: fallbackImageURI,
                documentURI: fallbackDocumentURI,
                assetType: assetTypeString,
                location: assetLocation,
                totalValue: totalValueFormatted,
                maxInvestablePercentage: assetMaxInvestablePercentage, // Add maxInvestablePercentage
                maturityDate: assetMaturityDate.toString(),
                verificationScore: '0',
                isActive: Number(assetStatus) === 6 || Number(assetStatus) === 7,
                createdAt: assetCreatedAt.toString(),
                owner: assetCurrentOwner || userAddress,
                status: Number(assetStatus),
                metadata: {
                  assetType: assetTypeString,
                  type: 'rwa',
                  category: 'RWA',
                  name: assetName,
                  description: assetDescription,
                  image: fallbackImageURI,
                  imageURI: fallbackImageURI,
                  displayImage: fallbackImageURI,
                  documentURI: fallbackDocumentURI,
                  price: totalValueFormatted,
                  totalValue: totalValueFormatted,
                  maxInvestablePercentage: assetMaxInvestablePercentage // Also add to metadata
                }
              };
              
              console.log(`✅ Successfully fetched asset ${assetId} from contract (no event data)`);
              console.log(`🖼️ Image URI:`, fallbackImageURI || '❌ EMPTY');
              console.log(`📄 Document URI:`, fallbackDocumentURI || '❌ EMPTY');
            } catch (contractError: any) {
              console.warn(`⚠️ Failed to fetch asset ${assetId} from contract:`, contractError.message);
            }
          } else {
            console.warn(`⚠️ No provider available to fetch asset ${assetId} from contract`);
          }
          
          // If we successfully fetched from contract, use that; otherwise create minimal entry
          if (fallbackAsset) {
            userAssets.push(fallbackAsset);
          } else {
            console.warn(`⚠️ Creating minimal entry for ${assetId} (could not fetch from contract)`);
            userAssets.push({
              assetId: assetId,
              tokenId: '0',
              name: `Asset ${assetId.slice(0, 8)}...`,
              description: 'Asset details unavailable - event data missing',
              imageURI: '',
              documentURI: '',
              assetType: 'RWA',
              location: '',
              totalValue: '0',
              maturityDate: '0',
              verificationScore: '0',
              isActive: false,
              createdAt: Date.now().toString(),
              owner: userAddress,
              status: 0,
              metadata: {
                assetType: 'RWA',
                type: 'rwa',
                category: 'RWA',
                name: `Asset ${assetId.slice(0, 8)}...`,
                description: 'Asset details unavailable',
                image: '',
                imageURI: '',
                documentURI: '',
                price: '0',
                totalValue: '0'
              }
            });
          }
        } catch (error: any) {
          const assetIdValue = typeof assetEntry === 'string' ? assetEntry : assetEntry?.assetId || 'unknown';
          console.warn(`⚠️ Failed to process asset ${assetIdValue}:`, error.message);
          
          // Try to fetch from contract as fallback
          let errorFallbackAsset: any = null;
          if (this.provider && assetIdValue !== 'unknown') {
            try {
              console.log(`🔍 Attempting to fetch asset ${assetIdValue} from contract after error...`);
              const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
              const factoryWithGetAsset = new ethers.Contract(factoryAddress, factoryABI, this.provider);
              
              let assetResult;
              try {
                assetResult = await factoryWithGetAsset.getAsset(assetIdValue);
              } catch (getAssetError: any) {
                if (typeof factoryWithGetAsset.assets === 'function') {
                  assetResult = await factoryWithGetAsset.assets(assetIdValue);
                } else {
                  throw getAssetError;
                }
              }
              
              // Extract fields from contract result
              const assetName = assetResult.name || assetResult[6] || `Asset ${assetIdValue.slice(0, 8)}...`;
              const assetDescription = assetResult.description || assetResult[15] || '';
              let errorImageURI = assetResult.imageURI || assetResult[13] || '';
              let errorDocumentURI = assetResult.documentURI || assetResult[14] || '';
              const assetTypeString = assetResult.assetTypeString || assetResult[5] || 'RWA';
              const assetLocation = assetResult.location || assetResult[7] || '';
              const assetTotalValue = assetResult.totalValue || assetResult[8] || 0n;
              const assetMaturityDate = assetResult.maturityDate || assetResult[9] || 0n;
              const assetMaxInvestablePercentage = assetResult.maxInvestablePercentage !== undefined 
                ? Number(assetResult.maxInvestablePercentage) 
                : (assetResult[10] !== undefined ? Number(assetResult[10]) : 100); // Index 10 is maxInvestablePercentage
              const assetTokenId = assetResult.tokenId || assetResult[18] || 0n; // Fixed: tokenId is at index 18
              const assetStatus = assetResult.status || assetResult[19] || 0n; // Fixed: status is at index 19
              const assetCreatedAt = assetResult.createdAt || assetResult[21] || 0n; // Fixed: createdAt is at index 21
              const assetCurrentOwner = assetResult.currentOwner || assetResult[2] || '';
              
              const totalValueFormatted = assetTotalValue > 0n ? ethers.formatEther(assetTotalValue) : '0';
              
              // Normalize IPFS URLs
              const { normalizeIPFSUrl } = await import('../utils/imageUtils');
              if (errorImageURI) {
                const normalized = normalizeIPFSUrl(errorImageURI);
                if (normalized) {
                  errorImageURI = normalized;
                } else if (!errorImageURI.startsWith('http')) {
                  errorImageURI = '';
                }
              }
              
              if (errorDocumentURI) {
                const normalized = normalizeIPFSUrl(errorDocumentURI);
                if (normalized) {
                  errorDocumentURI = normalized;
                } else if (!errorDocumentURI.startsWith('http')) {
                  errorDocumentURI = '';
                }
              }
              
              errorFallbackAsset = {
                assetId: assetIdValue,
                tokenId: assetTokenId.toString(),
                name: assetName,
                description: assetDescription,
                imageURI: errorImageURI,
                displayImage: errorImageURI,
                image: errorImageURI,
                documentURI: errorDocumentURI,
                assetType: assetTypeString,
                location: assetLocation,
                totalValue: totalValueFormatted,
                maxInvestablePercentage: assetMaxInvestablePercentage, // Add maxInvestablePercentage
                maturityDate: assetMaturityDate.toString(),
                verificationScore: '0',
                isActive: Number(assetStatus) === 6 || Number(assetStatus) === 7,
                createdAt: assetCreatedAt.toString(),
                owner: assetCurrentOwner || userAddress,
                status: Number(assetStatus),
                metadata: {
                  assetType: assetTypeString,
                  type: 'rwa',
                  category: 'RWA',
                  name: assetName,
                  description: assetDescription,
                  image: errorImageURI,
                  imageURI: errorImageURI,
                  displayImage: errorImageURI,
                  documentURI: errorDocumentURI,
                  price: totalValueFormatted,
                  totalValue: totalValueFormatted
                }
              };
              
              console.log(`✅ Successfully fetched asset ${assetIdValue} from contract after error`);
              console.log(`🖼️ Image URI:`, errorImageURI || '❌ EMPTY');
            } catch (contractError: any) {
              console.warn(`⚠️ Failed to fetch asset ${assetIdValue} from contract after error:`, contractError.message);
            }
          }
          
          // Use contract result if available, otherwise create minimal entry
          if (errorFallbackAsset) {
            userAssets.push(errorFallbackAsset);
          } else {
            // Still add a basic asset entry so user knows it exists
            userAssets.push({
              assetId: assetIdValue,
              tokenId: '0',
              name: `Asset ${assetIdValue.slice(0, 8)}...`,
              description: 'Asset details unavailable',
              imageURI: '',
              documentURI: '',
              assetType: 'RWA',
              location: '',
              totalValue: '0',
              maturityDate: '0',
              verificationScore: '0',
              isActive: false,
              createdAt: Date.now().toString(),
              owner: userAddress,
              status: 0,
              metadata: {
                assetType: 'RWA',
                type: 'rwa',
                category: 'RWA',
                name: `Asset ${assetIdValue.slice(0, 8)}...`,
                description: 'Asset details unavailable',
                image: '',
                imageURI: '',
                documentURI: '',
                price: '0',
                totalValue: '0'
              }
            });
          }
        }
      }
      
      console.log(`✅ Found ${userAssets.length} user assets from Factory`);
      
      // Log all images for debugging
      console.log(`🖼️ ========== FINAL IMAGE LOG FOR ALL ASSETS ==========`);
      userAssets.forEach((asset, index) => {
        console.log(`🖼️ Asset ${index + 1}/${userAssets.length}: ${asset.name || asset.assetId}`);
        console.log(`   Asset ID: ${asset.assetId}`);
        console.log(`   imageURI: ${asset.imageURI || '❌ EMPTY'}`);
        console.log(`   displayImage: ${asset.displayImage || '❌ EMPTY'}`);
        console.log(`   image: ${asset.image || '❌ EMPTY'}`);
        console.log(`   metadata.image: ${asset.metadata?.image || '❌ EMPTY'}`);
        console.log(`   metadata.imageURI: ${asset.metadata?.imageURI || '❌ EMPTY'}`);
        console.log(`   metadata.displayImage: ${asset.metadata?.displayImage || '❌ EMPTY'}`);
        console.log(`   Has any image field? ${!!(asset.imageURI || asset.displayImage || asset.image || asset.metadata?.image || asset.metadata?.imageURI)}`);
        console.log(`   Full asset keys:`, Object.keys(asset));
        console.log('');
      });
      console.log(`🖼️ ========== END IMAGE LOG ==========`);
      
      // Restore original provider before returning
      this.provider = originalProvider;
      
      return userAssets;
    } catch (error: any) {
      console.error('❌ Failed to fetch user assets from Factory:', error);
      // Restore original provider even on error
      if (typeof originalProvider !== 'undefined') {
        this.provider = originalProvider;
      }
      return [];
    }
  }

  /**
   * Get User's Assets (NFTs owned by user)
   * Returns array of asset data for all NFTs owned by the user
   */
  async getUserAssets(userAddress: string): Promise<any[]> {
    // For read-only operations, we can use a provider even if signer is not set
    let provider = this.provider;
    
    if (!provider) {
      // Create a read-only provider if no provider is set
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('⚠️ Using read-only provider for getUserAssets');
    }

    try {
      console.log('🔍 Fetching user assets from Mantle for address:', userAddress);
      
      // Get AssetNFT contract address directly from config (more reliable than calling factory.assetNFT())
      let assetNFTAddress = getContractAddress('ASSET_NFT');
      console.log('📦 AssetNFT contract address from config:', assetNFTAddress);
      console.log('📦 Expected AssetNFT address: 0x8720C1387AF5c6ff28C515FAb2387A95637f5800');
      
      if (!assetNFTAddress || assetNFTAddress === '0x0000000000000000000000000000000000000000') {
        console.warn('⚠️ AssetNFT contract address not configured in env, trying factory...');
        // Try to get it from factory as fallback
        try {
          const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
          const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
    const factory = this.getContract(factoryAddress, factoryABI);
          // Try calling assetNFT() - if it doesn't exist, this will fail gracefully
          const assetNFTFromFactory = await factory.assetNFT();
          console.log('📦 Got AssetNFT address from factory:', assetNFTFromFactory);
          assetNFTAddress = assetNFTFromFactory;
        } catch (error: any) {
          console.error('❌ Could not get AssetNFT address from factory:', error.message);
          console.error('❌ Please set VITE_ASSET_NFT_CONTRACT_ADDRESS in .env');
          return [];
        }
      }
      
      // Get AssetNFT contract
      const assetNFT = this.getContract(assetNFTAddress, AssetNFTABI);
      
      // Get user's NFT balance
      const balance = await assetNFT.balanceOf(userAddress);
      console.log(`📊 User NFT balance: ${balance.toString()}`);
      
      if (balance === 0n) {
        console.log('📭 No NFTs found for user');
        return [];
      }
      
      // Get all token IDs owned by user
      const tokenIds = await assetNFT.getUserAssets(userAddress);
      console.log(`📦 Found ${tokenIds.length} token IDs owned by user:`, tokenIds.map((id: bigint) => id.toString()));
      
      // Fetch asset details for each token
      const userAssets: any[] = [];
      
      for (const tokenId of tokenIds) {
        try {
          // Get NFT metadata from AssetNFT
          // Try getAssetMetadata first (function), fallback to assetMetadata (mapping)
          let metadata;
          try {
            metadata = await assetNFT.getAssetMetadata(tokenId);
          } catch {
            // Fallback to mapping if function doesn't exist
            metadata = await assetNFT.assetMetadata(tokenId);
          }
          
          // Get asset details from CoreAssetFactory using assetId
          // First, we need to find the assetId. Let's try to get it from the factory
          // The factory stores assets by assetId (bytes32), not tokenId
          // We'll need to search through assets or use events
          
          const asset = {
            tokenId: tokenId.toString(),
            name: metadata.name || `Asset #${tokenId.toString()}`,
            description: metadata.description || '',
            imageURI: metadata.imageURI || '',
            documentURI: metadata.documentURI || '',
            assetType: metadata.assetType || '',
            location: metadata.location || '',
            totalValue: metadata.totalValue?.toString() || '0',
            maturityDate: metadata.maturityDate?.toString() || '0',
            verificationScore: metadata.verificationScore?.toString() || '0',
            isActive: metadata.isActive || false,
            createdAt: metadata.createdAt?.toString() || Date.now().toString(),
            owner: userAddress,
            metadata: {
              assetType: metadata.assetType || 'RWA',
              type: 'rwa',
              category: 'RWA',
              name: metadata.name || `Asset #${tokenId.toString()}`,
              description: metadata.description || '',
              image: metadata.imageURI || '',
              price: metadata.totalValue?.toString() || '0',
              totalValue: metadata.totalValue?.toString() || '0'
            }
          };
          
          userAssets.push(asset);
        } catch (error: any) {
          console.warn(`⚠️ Failed to fetch metadata for token ${tokenId.toString()}:`, error.message);
          // Continue with other tokens
        }
      }
      
      console.log(`✅ Found ${userAssets.length} user assets from Mantle`);
      return userAssets;
    } catch (error: any) {
      console.error('❌ Failed to fetch user assets from Mantle:', error);
      throw new Error(`Failed to fetch user assets: ${error.message}`);
    }
  }

  /**
   * Get All RWA Assets from Blockchain
   * Uses the same approach as getUserAssetsFromFactory but for ALL users
   * Queries AssetCreated events in chunks and filters for RWA assets (those with maturityDate > 0)
   */
  async getAllRWAAssets(): Promise<any[]> {
    // For read-only operations, we can use a provider even if signer is not set
    let provider = this.provider;
    
    if (!provider) {
      // Create a read-only provider if no provider is set
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('⚠️ Using read-only provider for getAllRWAAssets');
    }

    try {
      console.log('🔍 Fetching all RWA assets from Mantle blockchain...');
      
      const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
      console.log('📋 CoreAssetFactory address:', factoryAddress);
      
      if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('CoreAssetFactory contract address not configured. Please set VITE_CORE_ASSET_FACTORY_CONTRACT_ADDRESS in .env');
      }
      
      const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
      const factory = this.getContract(factoryAddress, factoryABI);
      
      // Check totalAssets counter to verify contract is working and has assets
      let totalAssetsCount = 0;
      try {
        totalAssetsCount = Number(await factory.totalAssets());
        console.log(`📊 Contract reports totalAssets: ${totalAssetsCount}`);
        if (totalAssetsCount === 0) {
          console.warn('⚠️ Contract shows 0 total assets. No assets have been created yet.');
          return []; // Return empty array early if no assets exist
        }
      } catch (error) {
        console.warn('⚠️ Could not read totalAssets from contract:', error);
      }
      
      // Try to find the contract creation block by querying the contract's first transaction
      // This will help us narrow down the search range
      let contractCreationBlock = 0;
      try {
        // Get contract code to verify it exists
        const code = await provider.getCode(factoryAddress);
        if (!code || code === '0x') {
          throw new Error('Contract does not exist at this address');
        }
        console.log('✅ Contract code found, contract exists');
        
        // Try to get the contract creation block from the provider
        // Note: This might not be available on all providers, so we'll query from 0 if it fails
        try {
          // Some providers support getTransactionReceipt for contract creation
          contractCreationBlock = 0;
        } catch {
          contractCreationBlock = 0;
        }
      } catch (error) {
        console.warn('⚠️ Could not determine contract creation block:', error);
        contractCreationBlock = 0;
      }
      
      // Query AssetCreated events from the contract
      // Use the same chunking approach as getUserAssetsFromFactory
      const currentBlock = await provider.getBlockNumber();
      console.log(`📡 Current block: ${currentBlock}`);
      
      // Query ALL events in chunks to find ALL assets (same style as getUserAssetsFromFactory)
      // This ensures we find all assets regardless of when they were created
      console.log(`🔍 Querying all blocks in chunks to find ALL assets...`);
      const chunkSize = 10000; // Query 10k blocks at a time (same as getUserAssetsFromFactory)
      const maxBlocksBack = 200000; // Go back up to 200k blocks (same as getUserAssetsFromFactory)
      const chunks = Math.ceil(maxBlocksBack / chunkSize);
      const foundAssetIds = new Set<string>();
      let allEvents: any[] = [];
      
      // Query all chunks to ensure we find all assets
      for (let i = 0; i < chunks; i++) {
        const chunkFromBlock = Math.max(0, currentBlock - (i + 1) * chunkSize);
        const chunkToBlock = i === 0 ? currentBlock : Math.min(currentBlock, currentBlock - i * chunkSize);
        
        // Skip invalid ranges
        if (chunkFromBlock >= chunkToBlock) continue;
        
        try {
          console.log(`📡 Querying chunk ${i + 1}/${chunks}: blocks ${chunkFromBlock} to ${chunkToBlock} (${chunkToBlock - chunkFromBlock} blocks)...`);
          
          // Query AssetCreated events (no owner filter - get all assets)
          const chunkFilter = factory.filters.AssetCreated();
          const chunkEvents = await factory.queryFilter(chunkFilter, chunkFromBlock, chunkToBlock);
          
          if (chunkEvents.length > 0) {
            // Deduplicate by assetId
            chunkEvents.forEach((event: any) => {
              const id = event.args[0];
              const idLower = id?.toString()?.toLowerCase();
              if (idLower && !foundAssetIds.has(idLower)) {
                foundAssetIds.add(idLower);
                allEvents.push(event);
              }
            });
            console.log(`✅ Found ${chunkEvents.length} new assets in chunk ${i + 1}! Total: ${allEvents.length}`);
          }
          
          // If we've found all expected assets, we can stop early
          if (totalAssetsCount > 0 && allEvents.length >= totalAssetsCount) {
            console.log(`✅ Found all ${totalAssetsCount} expected assets! Stopping early.`);
            break;
          }
          
          // Small delay to avoid rate limiting
          if (i < chunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (chunkError: any) {
          console.warn(`⚠️ Error querying chunk ${chunkFromBlock}-${chunkToBlock}:`, chunkError.message);
          
          // If chunk is still too large (413 error), split it in half
          const chunkSizeActual = chunkToBlock - chunkFromBlock + 1;
          if (chunkError.code === -32080 || chunkError.message?.includes('413') || chunkError.message?.includes('too large')) {
            if (chunkSizeActual > 100) {
              console.log(`🔄 Chunk too large, splitting in half...`);
              // Split current chunk in half and retry
              const halfChunk = Math.floor(chunkSizeActual / 2);
              const midBlock = chunkFromBlock + halfChunk - 1;
              
              try {
                console.log(`📡 Retrying smaller chunk: blocks ${chunkFromBlock} to ${midBlock}...`);
                const smallChunkFilter = factory.filters.AssetCreated();
                const smallChunkEvents = await factory.queryFilter(smallChunkFilter, chunkFromBlock, midBlock);
                
                if (smallChunkEvents.length > 0) {
                  smallChunkEvents.forEach((event: any) => {
                    const id = event.args[0];
                    const idLower = id?.toString()?.toLowerCase();
                    if (idLower && !foundAssetIds.has(idLower)) {
                      foundAssetIds.add(idLower);
                      allEvents.push(event);
                    }
                  });
                }
                console.log(`✅ Found ${smallChunkEvents.length} events in smaller chunk`);
                
                // Continue with next chunk
                continue;
              } catch (smallError) {
                console.error(`❌ Even smaller chunk failed, skipping blocks ${chunkFromBlock}-${midBlock}`);
                // Continue to next iteration
                continue;
              }
            } else {
              // Chunk is already small, skip it
              console.error(`❌ Failed to query chunk (already small), skipping blocks ${chunkFromBlock}-${chunkToBlock}`);
              continue;
            }
          } else {
            // Other error, skip this chunk and continue
            console.error(`❌ Failed to query chunk, skipping blocks ${chunkFromBlock}-${chunkToBlock}`);
            continue;
          }
        }
      }
      
      const events = allEvents;
      
      console.log(`📊 Found ${events.length} AssetCreated events`);
      
      // Process events - use event data directly, then fetch full details from contract
      const rwaAssets: any[] = [];
      
      for (const event of events) {
        try {
          if (!event.args || !event.args.length) {
            console.warn('⚠️ Event missing args, skipping...');
            continue;
          }
          
          const assetId = event.args[0]; // bytes32 assetId
          const owner = event.args[1]; // address owner
          const category = event.args[2]; // AssetCategory
          const assetType = event.args[3]; // string assetType
          const name = event.args[4]; // string name
          const totalValue = event.args[5]; // uint256 totalValue
          const status = event.args[6]; // AssetStatus
          
          console.log(`📦 Processing asset from event:`, {
            assetId: assetId?.toString()?.slice(0, 10) + '...',
            name: name,
            owner: owner,
            category: Number(category),
            status: Number(status)
          });
          
          // Get full asset details from contract (this will have all the data including maturityDate)
          let fullAssetData: any = null;
          try {
            fullAssetData = await factory.getAsset(assetId);
            console.log(`✅ Fetched full asset data for ${assetId?.toString()?.slice(0, 10)}...`);
          } catch (getAssetError: any) {
            console.warn(`⚠️ Failed to get full asset data, using event data only:`, getAssetError.message);
          }
          
          // Use full asset data if available, otherwise use event data
          const assetData = fullAssetData || {};
          
          // Check if it's an RWA asset (RWA assets have maturityDate > 0)
          const maturityDate = assetData.maturityDate || assetData[9] || 0n;
          const maturityDateNum = typeof maturityDate === 'bigint' ? Number(maturityDate) : Number(maturityDate || 0);
          const isRWA = maturityDateNum > 0;
          
          if (isRWA) {
            // Extract all fields from full asset data or event
            const assetName = assetData.name || assetData[6] || name || 'Unnamed RWA';
            const assetLocation = assetData.location || assetData[7] || '';
            const assetDescription = assetData.description || assetData[15] || '';
            const assetImageURI = assetData.imageURI || assetData[13] || '';
            const assetDocumentURI = assetData.documentURI || assetData[14] || '';
            const assetTotalValue = assetData.totalValue || assetData[8] || totalValue || 0n;
            const assetStatus = assetData.status || assetData[17] || status || 0n;
            const assetCreatedAt = assetData.createdAt || assetData[19] || (event.blockNumber ? (await provider.getBlock(event.blockNumber))?.timestamp || Date.now() : Date.now());
            const assetCurrentOwner = assetData.currentOwner || assetData[2] || owner;
            const assetOriginalOwner = assetData.originalOwner || assetData[1] || owner;
            const assetEvidenceHashes = assetData.evidenceHashes || assetData[11] || [];
            const assetDocumentTypes = assetData.documentTypes || assetData[12] || [];
            
            const rwaAsset = {
              id: assetId,
              assetId: assetId?.toString() || assetId,
              tokenId: assetData.tokenId?.toString() || assetData[16]?.toString() || '0',
              owner: assetCurrentOwner || owner,
              originalOwner: assetOriginalOwner || owner,
              name: assetName,
              assetType: assetData.assetTypeString || assetData[5] || assetType || 'RWA',
              category: this.getCategoryName(Number(category)),
              location: assetLocation,
              totalValue: assetTotalValue?.toString() || '0',
              maturityDate: maturityDateNum,
              imageURI: assetImageURI,
              documentURI: assetDocumentURI,
              description: assetDescription,
              status: Number(assetStatus),
              createdAt: typeof assetCreatedAt === 'bigint' ? Number(assetCreatedAt) : (typeof assetCreatedAt === 'string' ? parseInt(assetCreatedAt) : Number(assetCreatedAt || Date.now())),
              evidenceHashes: assetEvidenceHashes,
              documentTypes: assetDocumentTypes,
              verificationScore: assetData.verificationScore || 0,
              isActive: Number(assetStatus) === 6 || Number(assetStatus) === 7, // ACTIVE_AMC_MANAGED or DIGITAL_ACTIVE
              metadata: {
                assetType: assetData.assetTypeString || assetData[5] || assetType || 'RWA',
                type: 'rwa',
                category: this.getCategoryName(Number(category)),
                name: assetName,
                description: assetDescription,
                image: assetImageURI,
                documentURI: assetDocumentURI,
                price: assetTotalValue?.toString() || '0',
                totalValue: assetTotalValue?.toString() || '0'
              }
            };
            
            console.log(`✅ Added RWA asset: ${assetName} (${assetId?.toString()?.slice(0, 10)}...)`);
            rwaAssets.push(rwaAsset);
          } else {
            console.log(`⏭️ Skipping non-RWA asset (maturityDate = 0): ${name}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to process asset from event:`, error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack
          });
          // Continue with other assets
        }
      }
      
      console.log(`✅ Found ${rwaAssets.length} RWA assets from Mantle blockchain`);
      return rwaAssets;
    } catch (error: any) {
      console.error('❌ Failed to fetch RWA assets from Mantle:', error);
      throw new Error(`Failed to fetch RWA assets: ${error.message}`);
    }
  }

  /**
   * Helper: Get category name from enum value
   */
  private getCategoryName(category: number): string {
    const categories = ['Real Estate', 'Commodity', 'Agriculture', 'Infrastructure', 'Business', 'Other'];
    return categories[category] || 'Other';
  }

  /**
   * Helper: Get status name from enum value
   */
  private getStatusName(status: number): string {
    const statuses = ['PENDING', 'ACTIVE', 'VERIFIED', 'SUSPENDED', 'CLOSED'];
    return statuses[status] || 'PENDING';
  }

  /**
   * Verify Asset (RWA only)
   */
  /**
   * Reject asset on smart contract
   * Sets asset status to REJECTED (9) on the blockchain
   */
  async rejectAsset(assetId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect your wallet.');
    }

    const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
    const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
    const factory = this.getContract(factoryAddress, factoryABI);

    // Convert assetId to bytes32 if needed
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    console.log('❌ Rejecting asset on smart contract:', { assetId, assetIdBytes32 });

    try {
      // Try to call rejectAsset function if it exists
      // Note: This function may not exist in the contract yet, so we'll handle the error gracefully
      if (factory.rejectAsset && typeof factory.rejectAsset === 'function') {
        const tx = await factory.rejectAsset(assetIdBytes32);
        console.log('📝 Reject transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Asset rejected on blockchain:', receipt.transactionHash);
        return receipt.transactionHash;
      } else {
        // If rejectAsset doesn't exist, we can't update the blockchain
        // This is expected until we add the function to the contract
        throw new Error('rejectAsset function not available in contract. Contract update required.');
      }
    } catch (error: any) {
      console.error('❌ Failed to reject asset on blockchain:', error);
      // If the function doesn't exist, throw a specific error
      if (error.message?.includes('rejectAsset') || error.message?.includes('not a function')) {
        throw new Error('Contract does not support rejection on blockchain yet. Only database will be updated.');
      }
      throw error;
    }
  }

  async verifyAsset(assetId: string, verificationLevel: number): Promise<string> {
    const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
    const factoryABI = CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
    const factory = this.getContract(factoryAddress, factoryABI);
    const tx = await factory.verifyAsset(assetId, verificationLevel);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // POOL MANAGER METHODS

  /**
   * Create Investment Pool
   */
  async createPool(params: {
    name: string;
    description: string;
    managementFee: bigint; // Basis points
    performanceFee: bigint; // Basis points
  }): Promise<{ poolId: string; txHash: string }> {
    const poolManagerAddress = getContractAddress('POOL_MANAGER');
    const poolManager = this.getContract(poolManagerAddress, PoolManagerABI);
    
    const tx = await poolManager.createPool(
      params.name,
      params.description,
      params.managementFee,
      params.performanceFee
    );
    
    const receipt = await tx.wait();
    
    // Extract poolId from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = poolManager.interface.parseLog(log);
        return parsed?.name === 'PoolCreated';
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error('PoolCreated event not found');
    }

    const parsedEvent = poolManager.interface.parseLog(event);
    const poolId = parsedEvent?.args[0];

    return {
      poolId: poolId,
      txHash: receipt.hash,
    };
  }

  // MARKETPLACE METHODS

  /**
   * List Asset on Marketplace
   */
  async listAsset(params: {
    assetId: string;
    price: bigint; // Price in TRUST tokens
    expiry: bigint; // Unix timestamp
  }): Promise<string> {
    const marketplaceAddress = getContractAddress('TRUST_MARKETPLACE');
    const marketplace = this.getContract(marketplaceAddress, TRUSTMarketplaceABI);
    
    const tx = await marketplace.createListing(
      params.assetId,
      params.price,
      params.expiry
    );
    
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Buy Asset from Marketplace
   */
  async buyAsset(assetId: string, price: bigint): Promise<string> {
    const marketplaceAddress = getContractAddress('TRUST_MARKETPLACE');
    const marketplace = this.getContract(marketplaceAddress, TRUSTMarketplaceABI);
    
    // Approve TRUST tokens for purchase
    const trustTokenAddress = getContractAddress('TRUST_TOKEN');
    const trustToken = this.getContract(trustTokenAddress, TrustTokenABI);
    
    const approvalTx = await trustToken.approve(marketplaceAddress, price);
    await approvalTx.wait();

    // Buy asset
    const tx = await marketplace.buyAsset(assetId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get All Active Listings from Marketplace
   * Returns all active listings with full details
   */
  async getAllActiveListings(): Promise<any[]> {
    // For read-only operations, we can use a provider even if signer is not set
    let provider = this.provider;
    
    if (!provider) {
      // Create a read-only provider if no provider is set
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('⚠️ Using read-only provider for getAllActiveListings');
    }

    try {
      console.log('🔍 Fetching all active marketplace listings from Mantle...');
      const marketplaceAddress = getContractAddress('TRUST_MARKETPLACE');
      
      // Extract ABI array from JSON object (handles both array and object with abi property)
      const marketplaceABI = Array.isArray(TRUSTMarketplaceABI) 
        ? TRUSTMarketplaceABI 
        : TRUSTMarketplaceABI.abi || TRUSTMarketplaceABI;
      
      const marketplace = new ethers.Contract(
        marketplaceAddress,
        marketplaceABI,
        provider
      );

      // Get all active listing IDs
      const listingIds = await marketplace.getActiveListings();
      console.log(`📊 Found ${listingIds.length} active listing IDs on Mantle`);

      if (listingIds.length === 0) {
        return [];
      }

      // Get details for each listing
      const listings = await Promise.all(
        listingIds.map(async (listingId: any) => {
          try {
            const listingIdNum = typeof listingId === 'bigint' ? Number(listingId) : Number(listingId.toString());
            const listing = await marketplace.getListing(listingIdNum);
            
            // Get asset details from CoreAssetFactory if assetId is available
            let assetData = null;
            if (listing.assetId) {
              try {
                const factoryAddress = getContractAddress('CORE_ASSET_FACTORY');
                
                // Extract ABI array from JSON object (handles both array and object with abi property)
                const factoryABI = Array.isArray(CoreAssetFactoryABI) 
                  ? CoreAssetFactoryABI 
                  : CoreAssetFactoryABI.abi || CoreAssetFactoryABI;
                
                const factory = new ethers.Contract(
                  factoryAddress,
                  factoryABI,
                  provider
                );
                assetData = await factory.getAsset(listing.assetId);
              } catch (assetError) {
                console.warn(`Could not fetch asset data for ${listing.assetId}:`, assetError);
              }
            }

            return {
              listingId: listingIdNum,
              assetId: listing.assetId || listing.tokenId?.toString() || '0',
              tokenId: listing.tokenId?.toString() || '0',
              seller: listing.seller,
              price: ethers.formatUnits(listing.price || 0n, 18),
              priceWei: listing.price?.toString() || '0',
              totalValue: ethers.formatUnits(listing.price || 0n, 18),
              isActive: listing.isActive,
              expiresAt: listing.expiresAt ? Number(listing.expiresAt) : 0,
              createdAt: listing.createdAt ? Number(listing.createdAt) : Date.now(),
              // Asset data from factory
              name: assetData?.name || `Asset #${listing.tokenId || listing.assetId || listingIdNum}`,
              description: assetData?.description || '',
              imageURI: assetData?.imageURI || '',
              category: assetData?.category !== undefined ? Number(assetData.category) : 0,
              assetType: assetData?.assetTypeString || '',
              location: assetData?.location || '',
              status: listing.isActive ? 'listed' : 'inactive',
            };
          } catch (error) {
            console.error(`Error processing listing ${listingId}:`, error);
            return null;
          }
        })
      );

      // Filter out null results
      const validListings = listings.filter((listing): listing is any => listing !== null);
      console.log(`✅ Successfully processed ${validListings.length} active listings from Mantle`);
      
      return validListings;
    } catch (error) {
      console.error('❌ Error fetching active listings from Mantle:', error);
      throw new Error(`Failed to fetch active listings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // POOL METHODS

  /**
   * Get all pools from PoolManager contract
   * Queries PoolCreated events to get all pools on-chain
   */
  async getAllPoolsFromBlockchain(): Promise<any[]> {
    // For read-only operations, we can use a provider even if signer is not set
    let provider = this.provider;
    
    if (!provider) {
      // Create a read-only provider if no provider is set
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('⚠️ Using read-only provider for getAllPoolsFromBlockchain');
    }

    try {
      console.log('🔍 Fetching all pools from PoolManager contract...');
      const poolManagerAddress = getContractAddress('POOL_MANAGER');
      
      // Extract ABI array from JSON object
      const poolManagerABI = Array.isArray(PoolManagerABI) 
        ? PoolManagerABI 
        : PoolManagerABI.abi || PoolManagerABI;
      
      const poolManager = new ethers.Contract(
        poolManagerAddress,
        poolManagerABI,
        provider
      );

      // Get total pools count
      const totalPools = Number(await poolManager.totalPools());
      console.log(`📊 Total pools on-chain: ${totalPools}`);

      if (totalPools === 0) {
        return [];
      }

      // Query PoolCreated events to get all pool IDs
      // Use chunking to respect the 10,000 block limit per query
      const currentBlock = await provider.getBlockNumber();
      const maxBlockRange = 10000; // RPC limit is 10,000 blocks
      const lookbackBlocks = 100000; // Look back 100k blocks max
      const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
      
      console.log(`📡 Querying PoolCreated events from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)...`);
      
      // Calculate number of chunks needed
      const totalBlocks = currentBlock - fromBlock;
      const chunks = Math.ceil(totalBlocks / maxBlockRange);
      
      console.log(`📦 Splitting query into ${chunks} chunks of max ${maxBlockRange} blocks each`);
      
      const filter = poolManager.filters.PoolCreated();
      const allEvents: any[] = [];
      
      // Query in chunks
      for (let i = 0; i < chunks; i++) {
        const chunkFromBlock = fromBlock + (i * maxBlockRange);
        const chunkToBlock = Math.min(fromBlock + ((i + 1) * maxBlockRange) - 1, currentBlock);
        
        if (chunkFromBlock > currentBlock) break;
        
        try {
          console.log(`📡 Querying chunk ${i + 1}/${chunks}: blocks ${chunkFromBlock} to ${chunkToBlock} (${chunkToBlock - chunkFromBlock + 1} blocks)...`);
          const chunkEvents = await poolManager.queryFilter(filter, chunkFromBlock, chunkToBlock);
          allEvents.push(...chunkEvents);
          console.log(`✅ Chunk ${i + 1}: Found ${chunkEvents.length} events`);
        } catch (chunkError: any) {
          console.warn(`⚠️ Error querying chunk ${i + 1} (blocks ${chunkFromBlock}-${chunkToBlock}):`, chunkError.message);
          // If chunk fails, try smaller chunks
          if (chunkToBlock - chunkFromBlock > 1000) {
            const halfChunk = Math.floor((chunkToBlock - chunkFromBlock) / 2);
            const midBlock = chunkFromBlock + halfChunk;
            try {
              console.log(`📡 Retrying smaller chunks: ${chunkFromBlock}-${midBlock} and ${midBlock + 1}-${chunkToBlock}`);
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
      console.log(`✅ Found ${events.length} PoolCreated events total`);

      // Get pool details for each pool
      const pools = await Promise.all(
        events.map(async (event) => {
          try {
            const poolId = event.args.poolId;
            const poolInfo = await poolManager.getPool(poolId);
            
            // Get tranche info if pool has tranches
            let tranches = [];
            let seniorTrancheId: string | undefined;
            let juniorTrancheId: string | undefined;
            
            if (poolInfo.hasTranches && poolInfo.tranches.length > 0) {
              tranches = await Promise.all(
                poolInfo.tranches.map(async (trancheId: string) => {
                  try {
                    const trancheInfo = await poolManager.getTranche(trancheId);
                    const trancheType = trancheInfo.trancheType === 0 ? 'SENIOR' : 'JUNIOR';
                    
                    // Extract senior and junior tranche IDs
                    if (trancheType === 'SENIOR') {
                      seniorTrancheId = trancheId;
                    } else {
                      juniorTrancheId = trancheId;
                    }
                    
                    return {
                      trancheId: trancheId,
                      type: trancheType,
                      name: trancheInfo.name,
                      tokenContract: trancheInfo.tokenContract,
                      percentage: Number(trancheInfo.percentage),
                      expectedAPY: Number(trancheInfo.expectedAPY),
                      totalInvested: ethers.formatEther(trancheInfo.totalInvested),
                      totalShares: ethers.formatEther(trancheInfo.totalShares),
                      isActive: trancheInfo.isActive,
                    };
                  } catch (error) {
                    console.warn(`Failed to fetch tranche ${trancheId}:`, error);
                    return null;
                  }
                })
              );
              tranches = tranches.filter(t => t !== null);
            }

            return {
              poolId: poolId,
              name: poolInfo.name,
              description: poolInfo.description,
              creator: poolInfo.creator,
              totalValue: ethers.formatEther(poolInfo.totalValue),
              totalShares: ethers.formatEther(poolInfo.totalShares),
              managementFee: Number(poolInfo.managementFee),
              performanceFee: Number(poolInfo.performanceFee),
              isActive: poolInfo.isActive,
              hasTranches: poolInfo.hasTranches,
              createdAt: Number(poolInfo.createdAt) * 1000, // Convert to milliseconds
              assets: poolInfo.assets,
              tranches: tranches,
              // Add tranche IDs for frontend compatibility
              seniorTrancheId: seniorTrancheId,
              juniorTrancheId: juniorTrancheId,
              // Also include in metadata for backward compatibility
              metadata: {
                seniorTrancheId: seniorTrancheId,
                juniorTrancheId: juniorTrancheId,
              },
              // Format for frontend compatibility
              status: poolInfo.isActive ? 'ACTIVE' : 'INACTIVE',
              hederaContractId: poolId, // Use poolId as contract ID (legacy field name)
            };
          } catch (error) {
            console.error(`Error processing pool ${event.args.poolId}:`, error);
            return null;
          }
        })
      );

      // Filter out null results
      const validPools = pools.filter((pool): pool is any => pool !== null);
      console.log(`✅ Successfully fetched ${validPools.length} pools from blockchain`);
      
      return validPools;
    } catch (error) {
      console.error('❌ Error fetching pools from blockchain:', error);
      throw new Error(`Failed to fetch pools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // TRUST TOKEN METHODS

  /**
   * Get TRUST Token Balance with retry logic and caching
   */
  async getTrustBalance(address: string, useCache = true): Promise<bigint> {
    // Check cache first
    if (useCache) {
      try {
        const { assetCacheService } = await import('./assetCacheService');
        const cacheKey = `trust_balance_${address.toLowerCase()}`;
        const cached = await assetCacheService.getCachedIPFS(cacheKey);
        if (cached && cached.balance !== undefined) {
          const age = Date.now() - (cached.timestamp || 0);
          // Cache balance for 30 seconds
          if (age < 30 * 1000) {
            console.log(`✅ Using cached TRUST balance for ${address.slice(0, 6)}...`);
            return BigInt(cached.balance);
          }
        }
      } catch (error) {
        // Cache error shouldn't block the call
        console.warn('⚠️ Cache check failed, proceeding with fresh fetch:', error);
      }
    }

    // For read-only operations, we can use a provider even if signer is not set
    let provider = this.provider;
    
    if (!provider) {
      // Create a read-only provider if no provider is set
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('⚠️ Using read-only provider for getTrustBalance');
    }

    const trustTokenAddress = getContractAddress('TRUST_TOKEN');
    
    // Check if contract address is valid (not zero address)
    if (trustTokenAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️ TRUST_TOKEN contract address not configured, returning 0 balance');
      return 0n;
    }

    // Extract ABI array from JSON object (handles both array and object with abi property)
    const abiArray = Array.isArray(TrustTokenABI) ? TrustTokenABI : TrustTokenABI.abi || TrustTokenABI;
    
    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check if contract exists at address (code size > 0)
        const code = await provider.getCode(trustTokenAddress);
        if (code === '0x' || code === '0x0') {
          console.warn(`⚠️ No contract found at TRUST_TOKEN address ${trustTokenAddress}`);
          return 0n;
        }

        const trustToken = new ethers.Contract(trustTokenAddress, abiArray, provider);
        const balance = await trustToken.balanceOf(address);
        
        // Cache the result
        if (useCache) {
          try {
            const { assetCacheService } = await import('./assetCacheService');
            const cacheKey = `trust_balance_${address.toLowerCase()}`;
            await assetCacheService.cacheIPFS(cacheKey, {
              balance: balance.toString(),
              timestamp: Date.now()
            });
          } catch (cacheError) {
            // Cache error shouldn't block the call
            console.warn('⚠️ Failed to cache balance:', cacheError);
          }
        }
        
        return balance;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || String(error);
        const errorCode = error.code || error.error?.code;
        
        // Check if it's a rate limit or too many errors
        if (errorCode === -32002 || errorMessage.includes('too many errors') || errorMessage.includes('rate limit')) {
          if (attempt < maxRetries - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
            console.warn(`⚠️ RPC rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Check if it's a contract call error (contract might not exist or function missing)
        if (errorCode === 'CALL_EXCEPTION' || errorMessage.includes('missing revert data') || errorMessage.includes('execution reverted')) {
          console.warn(`⚠️ Contract call failed for TRUST_TOKEN at ${trustTokenAddress}:`, errorMessage);
          // If it's the last attempt, return 0 instead of throwing
          if (attempt === maxRetries - 1) {
            console.warn('⚠️ Returning 0 balance due to contract call failure');
            return 0n;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // If all retries failed, return 0 instead of throwing
    console.error('❌ Failed to fetch TRUST balance after retries:', lastError);
    return 0n;
  }

  /**
   * Transfer TRUST Tokens
   */
  async transferTrust(to: string, amount: bigint): Promise<string> {
    const trustTokenAddress = getContractAddress('TRUST_TOKEN');
    const trustToken = this.getContract(trustTokenAddress, TrustTokenABI);
    const tx = await trustToken.transfer(to, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Approve TRUST Tokens
   */
  async approveTrust(spender: string, amount: bigint): Promise<string> {
    const trustTokenAddress = getContractAddress('TRUST_TOKEN');
    const trustToken = this.getContract(trustTokenAddress, TrustTokenABI);
    const tx = await trustToken.approve(spender, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // AMC MANAGER METHODS

  /**
   * Schedule physical inspection
   * @param assetId - Asset ID (bytes32)
   * @param inspector - Inspector address (AMC admin address)
   * @param scheduledAt - Scheduled timestamp (0 for immediate, or future timestamp)
   */
  async scheduleInspection(
    assetId: string,
    inspector: string,
    scheduledAt: number = 0 // 0 for immediate, or Unix timestamp for future
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    let amcManagerAddress: string;
    try {
      amcManagerAddress = getContractAddress('AMC_MANAGER');
    } catch (error: any) {
      throw new Error(
        `AMC Manager contract address not configured. Please set VITE_AMC_MANAGER_ADDRESS in your .env file. ` +
        `Latest deployed address: 0xC26f729De8f88e4E59846715f622a1C56334a565 (Mantle Sepolia)`
      );
    }

    if (!amcManagerAddress || amcManagerAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(
        `Invalid AMC Manager contract address: ${amcManagerAddress}. ` +
        `Please set VITE_AMC_MANAGER_ADDRESS=0xC26f729De8f88e4E59846715f622a1C56334a565 in your .env file.`
      );
    }

    console.log(`📍 AMC Manager Contract Address: ${amcManagerAddress}`);
    console.log(`🔍 Environment check:`, {
      'VITE_AMC_MANAGER_CONTRACT_ADDRESS': import.meta.env.VITE_AMC_MANAGER_CONTRACT_ADDRESS,
      'VITE_AMC_MANAGER_ADDRESS': import.meta.env.VITE_AMC_MANAGER_ADDRESS,
      'VITE_AMC_MANAGER_ADDRESS (direct)': import.meta.env.VITE_AMC_MANAGER_ADDRESS,
      'Resolved address': amcManagerAddress
    });
    
    // Verify we're using the NEW address
    if (amcManagerAddress.toLowerCase() === '0x995a59e804c9c53ca1fe7e529ccd6f0da617e36a') {
      console.error('❌ ERROR: Using OLD AMCManager address!');
      console.error('   Expected: 0xC26f729De8f88e4E59846715f622a1C56334a565');
      console.error('   Got: 0x995a59e804c9c53Ca1fe7e529ccd6f0dA617e36A');
      console.error('   Please update VITE_AMC_MANAGER_ADDRESS in .env and RESTART the dev server!');
      throw new Error(
        'Using OLD AMCManager address. Please update VITE_AMC_MANAGER_ADDRESS=0xC26f729De8f88e4E59846715f622a1C56334a565 in .env and restart the dev server.'
      );
    }
    
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    // Convert assetId to bytes32 if needed
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    console.log('✅ Scheduling inspection on AMCManager:', {
      assetId: assetIdBytes32,
      inspector,
      scheduledAt: scheduledAt === 0 ? 'immediate' : new Date(scheduledAt * 1000).toISOString()
    });

    // Convert scheduledAt to BigInt (Unix timestamp in seconds)
    const scheduledAtBigInt = BigInt(scheduledAt);

    const tx = await amcManager.scheduleInspection(
      assetIdBytes32,
      inspector,
      scheduledAtBigInt
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Complete physical inspection
   * @param assetId - Asset ID (bytes32)
   * @param status - Inspection status: 2=COMPLETED, 3=FLAGGED, 4=REJECTED
   * @param comments - Inspection comments
   * @param inspectionReportHash - IPFS hash of inspection report
   */
  async completeInspection(
    assetId: string,
    status: number, // 2=COMPLETED, 3=FLAGGED, 4=REJECTED
    comments: string = '',
    inspectionReportHash: string = ''
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const amcManagerAddress = getContractAddress('AMC_MANAGER');
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    // Convert assetId to bytes32 if needed
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    console.log('✅ Completing inspection on AMCManager:', {
      assetId: assetIdBytes32,
      status,
      comments,
      inspectionReportHash
    });

    const tx = await amcManager.completeInspection(
      assetIdBytes32,
      status,
      comments,
      inspectionReportHash
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Initiate legal transfer
   * @param assetId - Asset ID (bytes32)
   * @param individualOwner - Individual owner address
   * @param legalDocumentHash - IPFS hash of legal document
   */
  async initiateLegalTransfer(
    assetId: string,
    individualOwner: string,
    legalDocumentHash: string = ''
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const amcManagerAddress = getContractAddress('AMC_MANAGER');
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    console.log('✅ Initiating legal transfer on AMCManager:', {
      assetId: assetIdBytes32,
      individualOwner,
      legalDocumentHash
    });

    const tx = await amcManager.initiateLegalTransfer(
      assetIdBytes32,
      individualOwner,
      legalDocumentHash
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Complete legal transfer
   * @param assetId - Asset ID (bytes32)
   */
  async completeLegalTransfer(assetId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const amcManagerAddress = getContractAddress('AMC_MANAGER');
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    console.log('✅ Completing legal transfer on AMCManager:', assetIdBytes32);

    const tx = await amcManager.completeLegalTransfer(assetIdBytes32);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Activate asset after legal transfer
   * @param assetId - Asset ID (bytes32)
   */
  async activateAsset(assetId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const amcManagerAddress = getContractAddress('AMC_MANAGER');
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    console.log('✅ Activating asset on AMCManager:', assetIdBytes32);

    const tx = await amcManager.activateAsset(assetIdBytes32);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get inspection record
   * @param assetId - Asset ID (bytes32)
   */
  async getInspectionRecord(assetId: string): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized.');
    }

    const amcManagerAddress = getContractAddress('AMC_MANAGER');
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    return await amcManager.getInspectionRecord(assetIdBytes32);
  }

  /**
   * Get legal transfer record
   * @param assetId - Asset ID (bytes32)
   */
  async getLegalTransferRecord(assetId: string): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized.');
    }

    const amcManagerAddress = getContractAddress('AMC_MANAGER');
    const amcManager = this.getContract(amcManagerAddress, AMCManagerABI);
    
    let assetIdBytes32: string;
    if (assetId.startsWith('0x') && assetId.length === 66) {
      assetIdBytes32 = assetId;
    } else if (assetId.startsWith('0x') && assetId.length < 66) {
      assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
    } else {
      assetIdBytes32 = ethers.id(assetId);
    }

    return await amcManager.getLegalTransferRecord(assetIdBytes32);
  }
}

// Export singleton instance
export const mantleContractService = new MantleContractService();

