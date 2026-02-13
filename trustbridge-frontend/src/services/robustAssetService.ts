/**
 * Robust Asset Service
 * A comprehensive system for accurately retrieving and persisting assets from the blockchain
 * 
 * Features:
 * - Multiple retrieval strategies with fallbacks
 * - Asset validation and deduplication
 * - Persistent caching (IndexedDB + localStorage)
 * - Asset reconciliation to ensure all assets are found
 * - Automatic cache synchronization
 */

// Mantle contract service removed - using Novax/Etherlink
// import { mantleContractService } from './mantleContractService';
import { assetCacheService } from './assetCacheService';
import { apiService } from './api-blockchain-first';

interface AssetRecord {
  assetId: string;
  tokenId: string;
  name: string;
  description?: string;
  imageURI?: string;
  documentURI?: string;
  owner: string;
  createdAt: string;
  status: number;
  totalValue: string;
  location?: string;
  assetType?: string;
  [key: string]: any;
}

interface RobustAssetResult {
  assets: AssetRecord[];
  source: 'cache' | 'getUserAssets' | 'events' | 'database' | 'hybrid';
  cached: boolean;
  foundViaStrategies: {
    getUserAssets: number;
    events: number;
    database: number;
    cache: number;
  };
}

class RobustAssetService {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  /**
   * Main method: Get all assets for a user with multiple strategies
   */
  async getUserAssets(
    userAddress: string,
    options: {
      useCache?: boolean;
      forceRefresh?: boolean;
      validateCount?: boolean;
    } = {}
  ): Promise<RobustAssetResult> {
    const {
      useCache = true,
      forceRefresh = false,
      validateCount = true
    } = options;

    const normalizedAddress = userAddress.toLowerCase();
    const strategiesResult = {
      getUserAssets: 0,
      events: 0,
      database: 0,
      cache: 0
    };

    console.log('🔍 ========== ROBUST ASSET RETRIEVAL ==========');
    console.log('🔍 Address:', normalizedAddress);
    console.log('🔍 Options:', { useCache, forceRefresh, validateCount });

    // Clear cache if forcing refresh
    if (forceRefresh) {
      console.log('🔄 Force refresh enabled - clearing cache for fresh data');
      try {
        await assetCacheService.clearCache(normalizedAddress);
        console.log('✅ Cache cleared successfully');
      } catch (error: any) {
        console.warn('⚠️ Failed to clear cache (non-critical):', error.message);
      }
    }

    // Step 1: Try cache first (if enabled and not forcing refresh)
    if (useCache && !forceRefresh) {
      try {
        const cachedAssets = await assetCacheService.getCachedAssets(normalizedAddress);
        if (cachedAssets && cachedAssets.length > 0) {
          console.log(`⚡ Found ${cachedAssets.length} assets in cache`);
          strategiesResult.cache = cachedAssets.length;
          
          // Validate cache is still fresh (not expired)
          const cacheAge = await this.getCacheAge(normalizedAddress);
          if (cacheAge < this.CACHE_TTL) {
            // CRITICAL: Check if cached assets have imageURI
            const assetsWithImages = cachedAssets.filter(asset => 
              asset.imageURI && asset.imageURI.trim() !== '' && asset.imageURI !== '❌ EMPTY'
            );
            
            if (assetsWithImages.length === 0 && cachedAssets.length > 0) {
              console.warn(`⚠️ Cached assets have no imageURI - cache is stale!`);
              console.warn(`⚠️ Clearing stale cache and fetching fresh data...`);
              await assetCacheService.clearCache(normalizedAddress);
              // Continue to fetch fresh data below
            } else {
              console.log(`✅ Cache is fresh (age: ${Math.round(cacheAge / 1000)}s)`);
              console.log(`✅ ${assetsWithImages.length}/${cachedAssets.length} cached assets have imageURI`);
              
              // Even with cache, fetch fresh data in background
              this.refreshAssetsInBackground(normalizedAddress).catch(err => {
                console.warn('⚠️ Background refresh failed (non-critical):', err);
              });
              
              return {
                assets: cachedAssets,
                source: 'cache',
                cached: true,
                foundViaStrategies: strategiesResult
              };
            }
          } else {
            console.log(`🔄 Cache expired (age: ${Math.round(cacheAge / 1000)}s), fetching fresh data`);
          }
        }
      } catch (error: any) {
        console.warn('⚠️ Cache check failed, continuing to blockchain:', error.message);
      }
    }

    // Step 2: Multi-strategy retrieval (run in parallel for speed)
    console.log('🔄 Fetching assets using multiple strategies...');
    const [getUserAssetsResult, eventsResult, databaseResult] = await Promise.allSettled([
      this.fetchViaGetUserAssets(normalizedAddress),
      this.fetchViaEvents(normalizedAddress),
      this.fetchViaDatabase(normalizedAddress)
    ]);

    // Step 3: Collect results from all strategies
    const allAssets = new Map<string, AssetRecord>(); // Use Map to deduplicate by assetId

    // Process getUserAssets result (this should have imageURI from getAsset() calls)
    if (getUserAssetsResult.status === 'fulfilled' && getUserAssetsResult.value.length > 0) {
      console.log(`✅ getUserAssets: Found ${getUserAssetsResult.value.length} assets`);
      strategiesResult.getUserAssets = getUserAssetsResult.value.length;
      getUserAssetsResult.value.forEach(asset => {
        const key = asset.assetId.toLowerCase();
        const existing = allAssets.get(key);
        // Always prefer getUserAssets result if it has imageURI, or if no existing asset
        if (!existing || (asset.imageURI && !existing.imageURI) || this.isAssetMoreComplete(asset, existing)) {
          allAssets.set(key, asset);
          if (asset.imageURI) {
            console.log(`✅ getUserAssets asset ${asset.name} has imageURI: ${asset.imageURI.substring(0, 50)}...`);
          }
        }
      });
    }

    // Process events result
    if (eventsResult.status === 'fulfilled' && eventsResult.value.length > 0) {
      console.log(`✅ Events: Found ${eventsResult.value.length} assets`);
      strategiesResult.events = eventsResult.value.length;
      eventsResult.value.forEach(asset => {
        const key = asset.assetId.toLowerCase();
        const existing = allAssets.get(key);
        // Only add if not already present or if this one has more complete data (especially imageURI)
        if (!existing || (asset.imageURI && !existing.imageURI) || this.isAssetMoreComplete(asset, existing)) {
          allAssets.set(key, asset);
          if (asset.imageURI && existing && !existing.imageURI) {
            console.log(`✅ Events asset ${asset.name} replaced existing (has imageURI)`);
          }
        }
      });
    }

    // Process database result
    if (databaseResult.status === 'fulfilled' && databaseResult.value.length > 0) {
      console.log(`✅ Database: Found ${databaseResult.value.length} asset IDs`);
      strategiesResult.database = databaseResult.value.length;
      
      // Fetch full details for database IDs that we don't have yet
      const missingIds = databaseResult.value
        .map((r: any) => r.assetId?.toLowerCase())
        .filter((id: string) => !allAssets.has(id));
      
      if (missingIds.length > 0) {
        console.log(`🔄 Fetching details for ${missingIds.length} assets from database...`);
        const missingAssets = await this.fetchAssetDetailsByIds(normalizedAddress, missingIds);
        missingAssets.forEach(asset => {
          allAssets.set(asset.assetId.toLowerCase(), asset);
        });
      }
    }

    const finalAssets = Array.from(allAssets.values());

    // Step 4: Validate asset count (if enabled)
    if (validateCount && finalAssets.length > 0) {
      console.log(`🔍 Validating asset count...`);
      const validationResult = await this.validateAssetCount(normalizedAddress, finalAssets.length);
      if (!validationResult.isValid) {
        console.warn(`⚠️ Asset count mismatch! Expected: ${validationResult.expected}, Found: ${finalAssets.length}`);
        // If we're missing assets, try one more comprehensive fetch
        if (validationResult.missingIds && validationResult.missingIds.length > 0) {
          console.log(`🔄 Fetching ${validationResult.missingIds.length} missing assets...`);
          const missingAssets = await this.fetchAssetDetailsByIds(normalizedAddress, validationResult.missingIds);
          missingAssets.forEach(asset => {
            if (!allAssets.has(asset.assetId.toLowerCase())) {
              allAssets.set(asset.assetId.toLowerCase(), asset);
            }
          });
        }
      }
    }

    // Step 5: Sort assets by creation date (newest first)
    const sortedAssets = Array.from(allAssets.values()).sort((a, b) => {
      const aTime = parseInt(a.createdAt || '0');
      const bTime = parseInt(b.createdAt || '0');
      return bTime - aTime;
    });

    console.log(`✅ Total unique assets found: ${sortedAssets.length}`);
    console.log(`📊 Strategies breakdown:`, strategiesResult);

    // Step 6: Cache the results (ensure imageURI is included)
    if (sortedAssets.length > 0) {
      try {
        // Log assets before caching to verify imageURI is present
        console.log(`💾 ========== CACHING ASSETS IN ROBUST SERVICE ==========`);
        sortedAssets.forEach((asset, index) => {
          console.log(`💾 Asset ${index + 1}/${sortedAssets.length}: ${asset.name || asset.assetId}`);
          console.log(`💾   imageURI: ${asset.imageURI || '❌ EMPTY'}`);
          console.log(`💾   displayImage: ${asset.displayImage || '❌ EMPTY'}`);
        });
        console.log(`💾 ========== END CACHING ASSETS ==========`);
        
        await assetCacheService.cacheAssets(normalizedAddress, sortedAssets);
        console.log(`✅ Cached ${sortedAssets.length} assets for persistence (with imageURI)`);
      } catch (error: any) {
        console.warn('⚠️ Failed to cache assets (non-critical):', error.message);
      }
    }

    // Determine source
    let source: 'getUserAssets' | 'events' | 'database' | 'hybrid' = 'hybrid';
    if (strategiesResult.getUserAssets === sortedAssets.length) {
      source = 'getUserAssets';
    } else if (strategiesResult.events === sortedAssets.length) {
      source = 'events';
    } else if (strategiesResult.database === sortedAssets.length) {
      source = 'database';
    }

    return {
      assets: sortedAssets,
      source,
      cached: false,
      foundViaStrategies: strategiesResult
    };
  }

  /**
   * Strategy 1: Fetch via getUserAssetsFromFactory (uses getUserAssets function or events)
   */
  private async fetchViaGetUserAssets(address: string): Promise<AssetRecord[]> {
    try {
      console.log(`📞 Calling getUserAssetsFromFactory for ${address}...`);
      // Mantle contract service removed - using Novax/Etherlink
      // TODO: Replace with Novax contract service for receivables/RWA assets
      console.warn('⚠️ Mantle contract service removed - getUserAssetsFromFactory not available');
      const assets: any[] = [];
      console.log(`📦 getUserAssetsFromFactory returned ${assets.length} assets`);
      
      // Log imageURI status of raw assets before normalization
      assets.forEach((asset, idx) => {
        console.log(`📦 Raw asset ${idx + 1}/${assets.length}: ${asset.name || asset.assetId}`, {
          imageURI: asset.imageURI || '❌ EMPTY',
          displayImage: asset.displayImage || '❌ EMPTY',
          image: asset.image || '❌ EMPTY',
          metadataImage: asset.metadata?.image || '❌ EMPTY',
          metadataImageURI: asset.metadata?.imageURI || '❌ EMPTY'
        });
      });
      
      const normalized = (assets || []).map(asset => this.normalizeAsset(asset, address));
      
      // Log imageURI status after normalization
      normalized.forEach((asset, idx) => {
        console.log(`✅ Normalized asset ${idx + 1}/${normalized.length}: ${asset.name}`, {
          imageURI: asset.imageURI || '❌ EMPTY',
          displayImage: asset.displayImage || '❌ EMPTY'
        });
      });
      
      return normalized;
    } catch (error: any) {
      console.warn('⚠️ getUserAssetsFromFactory failed:', error.message);
      return [];
    }
  }

  /**
   * Strategy 2: Fetch via event queries (most reliable fallback)
   * Note: getUserAssetsFromFactory already uses events as fallback, but we can also try direct event queries
   */
  private async fetchViaEvents(address: string): Promise<AssetRecord[]> {
    try {
      // Mantle contract service removed - using Novax/Etherlink
      // TODO: Replace with Novax contract service for receivables/RWA assets
      console.warn('⚠️ Mantle contract service removed - fetchViaEvents not available');
      const assets: any[] = [];
      console.log(`📡 Events query returned ${assets.length} assets`);
      return (assets || []).map(asset => this.normalizeAsset(asset, address));
    } catch (error: any) {
      console.warn('⚠️ Events query failed:', error.message);
      return [];
    }
  }

  /**
   * Strategy 3: Fetch via database (fast lookup)
   */
  private async fetchViaDatabase(address: string): Promise<any[]> {
    try {
      const response = await apiService.get(`/assets/owner/${address}`);
      if (response.success && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error: any) {
      console.warn('⚠️ Database query failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch asset details by asset IDs
   */
  private async fetchAssetDetailsByIds(address: string, assetIds: string[]): Promise<AssetRecord[]> {
    console.log(`🔍 fetchAssetDetailsByIds: Fetching ${assetIds.length} assets by ID...`);
    const assets: AssetRecord[] = [];
    const batchSize = 5;

    for (let i = 0; i < assetIds.length; i += batchSize) {
      const batch = assetIds.slice(i, i + batchSize);
      console.log(`🔍 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(assetIds.length / batchSize)}: ${batch.length} assets`);
      
      const batchPromises = batch.map(async (assetId) => {
        try {
          console.log(`🔍 Fetching asset ${assetId} via getAsset()...`);
          // Mantle contract service removed - using Novax/Etherlink
          // TODO: Replace with Novax contract service for receivables/RWA assets
          console.warn(`⚠️ Mantle contract service removed - getAsset(${assetId}) not available`);
          const asset = null;
          if (asset) {
            console.log(`✅ getAsset(${assetId}) returned asset:`, {
              name: asset.name || 'N/A',
              imageURI: asset.imageURI || '❌ EMPTY',
              displayImage: asset.displayImage || '❌ EMPTY',
              image: asset.image || '❌ EMPTY'
            });
            const normalized = this.normalizeAsset(asset, address);
            console.log(`✅ Normalized asset ${assetId} imageURI:`, normalized.imageURI || '❌ EMPTY');
            return normalized;
          } else {
            console.warn(`⚠️ getAsset(${assetId}) returned null`);
          }
        } catch (error: any) {
          console.warn(`⚠️ Failed to fetch asset ${assetId}:`, error.message);
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      const validAssets = batchResults.filter(Boolean) as AssetRecord[];
      console.log(`✅ Batch complete: ${validAssets.length}/${batch.length} assets fetched successfully`);
      assets.push(...validAssets);

      // Small delay between batches
      if (i + batchSize < assetIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ fetchAssetDetailsByIds complete: ${assets.length}/${assetIds.length} assets retrieved`);
    assets.forEach((asset, idx) => {
      console.log(`📦 Asset ${idx + 1}/${assets.length} (${asset.name || asset.assetId}): imageURI = ${asset.imageURI || '❌ EMPTY'}`);
    });

    return assets;
  }

  /**
   * Normalize asset data to consistent format
   */
  private normalizeAsset(asset: any, owner: string): AssetRecord {
    // Extract imageURI from multiple possible sources
    const imageURI = asset.imageURI || asset.displayImage || asset.image || asset.metadata?.image || asset.metadata?.imageURI || '';
    
    // Log imageURI extraction at each step
    console.log(`🖼️ ========== NORMALIZE ASSET: ${asset.name || asset.assetId} ==========`);
    console.log(`🖼️ Step 1 - Raw asset.imageURI:`, asset.imageURI || '❌ EMPTY');
    console.log(`🖼️ Step 2 - Raw asset.displayImage:`, asset.displayImage || '❌ EMPTY');
    console.log(`🖼️ Step 3 - Raw asset.image:`, asset.image || '❌ EMPTY');
    console.log(`🖼️ Step 4 - Raw asset.metadata?.image:`, asset.metadata?.image || '❌ EMPTY');
    console.log(`🖼️ Step 5 - Raw asset.metadata?.imageURI:`, asset.metadata?.imageURI || '❌ EMPTY');
    console.log(`🖼️ Step 6 - EXTRACTED imageURI:`, imageURI || '❌ EMPTY');
    
    if (!imageURI && (asset.assetId || asset.name)) {
      console.warn(`⚠️ normalizeAsset: No imageURI found for asset ${asset.name || asset.assetId}`);
    } else if (imageURI) {
      console.log(`✅ normalizeAsset: Successfully extracted imageURI for ${asset.name || asset.assetId}: ${imageURI.substring(0, 50)}...`);
    }
    console.log(`🖼️ ========== END NORMALIZE ASSET ==========`);
    
    // Create normalized asset - spread asset first, then override with normalized values
    const normalized: AssetRecord = {
      // Spread asset to preserve all fields first
      ...asset,
      // Then override with normalized values (this ensures no duplicates)
      assetId: asset.assetId || asset.tokenId || '',
      tokenId: asset.tokenId?.toString() || asset.assetId || '0',
      name: asset.name || `Asset ${(asset.assetId || '').slice(0, 8)}`,
      description: asset.description || '',
      imageURI: imageURI, // Override with extracted imageURI
      displayImage: imageURI, // Also set displayImage for compatibility
      documentURI: asset.documentURI || asset.metadata?.documentURI || '',
      owner: asset.owner || asset.currentOwner || owner,
      createdAt: asset.createdAt?.toString() || Date.now().toString(),
      status: typeof asset.status === 'number' ? asset.status : parseInt(asset.status) || 0,
      totalValue: asset.totalValue?.toString() || '0',
      location: asset.location || '',
      assetType: asset.assetType || asset.assetTypeString || 'RWA'
    };
    
    // Log final normalized result
    console.log(`🖼️ Final normalized asset imageURI:`, normalized.imageURI || '❌ EMPTY');
    console.log(`🖼️ Final normalized asset displayImage:`, normalized.displayImage || '❌ EMPTY');
    
    return normalized;
  }

  /**
   * Check if one asset has more complete data than another
   */
  private isAssetMoreComplete(asset1: AssetRecord, asset2: AssetRecord): boolean {
    const fields = ['name', 'description', 'imageURI', 'documentURI'];
    let asset1Completeness = 0;
    let asset2Completeness = 0;

    fields.forEach(field => {
      if (asset1[field]) asset1Completeness++;
      if (asset2[field]) asset2Completeness++;
    });

    return asset1Completeness > asset2Completeness;
  }

  /**
   * Validate asset count by querying ALL events to get true expected count
   */
  private async validateAssetCount(address: string, foundCount: number): Promise<{
    isValid: boolean;
    expected: number;
    missingIds?: string[];
  }> {
    try {
      // Mantle contract service removed - using Novax/Etherlink
      // TODO: Replace with Novax contract service for receivables/RWA assets
      console.warn('⚠️ Mantle contract service removed - validateAssetCount not available');
      const expectedAssets: any[] = [];
      const expectedCount = expectedAssets.length;

      console.log(`🔍 Validation: Found ${foundCount} assets, expected (from blockchain query): ${expectedCount}`);

      if (foundCount === expectedCount && foundCount > 0) {
        console.log(`✅ Asset count validation passed: ${foundCount} assets`);
        return { isValid: true, expected: expectedCount };
      }

      // Find missing asset IDs
      const foundIds = new Set(
        expectedAssets.map((a: any) => ((a.assetId || a.tokenId || '').toString()).toLowerCase())
      );
      const allExpectedIds = expectedAssets.map((a: any) => (a.assetId || a.tokenId || '').toString());
      const missingIds = allExpectedIds.filter((id: string) => !foundIds.has(id.toLowerCase()));

      console.warn(`⚠️ Asset count mismatch! Expected: ${expectedCount}, Found: ${foundCount}`);
      console.warn(`⚠️ Missing ${missingIds.length} assets:`, missingIds);

      return {
        isValid: false,
        expected: expectedCount,
        missingIds
      };
    } catch (error: any) {
      console.warn('⚠️ Asset count validation failed:', error.message);
      return { isValid: true, expected: foundCount }; // Assume valid if validation fails
    }
  }

  /**
   * Get cache age for an address
   */
  private async getCacheAge(address: string): Promise<number> {
    try {
      // This would need to be implemented in assetCacheService
      // For now, return 0 to indicate cache is always fresh if it exists
      return 0;
    } catch {
      return Infinity; // Cache doesn't exist or expired
    }
  }

  /**
   * Refresh assets in background (non-blocking)
   */
  private async refreshAssetsInBackground(address: string): Promise<void> {
    setTimeout(async () => {
      try {
        console.log('🔄 Background refresh: Fetching fresh assets...');
        const result = await this.getUserAssets(address, {
          useCache: false,
          forceRefresh: true,
          validateCount: true
        });
        console.log(`✅ Background refresh complete: ${result.assets.length} assets`);
      } catch (error: any) {
        console.warn('⚠️ Background refresh failed:', error.message);
      }
    }, 1000); // Start refresh after 1 second
  }
}

export const robustAssetService = new RobustAssetService();

