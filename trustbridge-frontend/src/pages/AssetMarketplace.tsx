import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Star, 
  Heart, 
  Package, 
  Building2,
  Globe,
  Users,
  DollarSign,
  CheckCircle,
  Grid3X3,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Layers,
  BarChart3
} from 'lucide-react';
import { Card, CardContent } from '../components/UI/Card';
import Button from '../components/UI/Button';
import { ProgressBar } from '../components/UI/ProgressBar';
import { StatusBadge } from '../components/UI/StatusBadge';
import { FilterBar } from '../components/UI/FilterBar';
import { SortDropdown, SortOption } from '../components/UI/SortDropdown';
import MarketplaceAssetModal from '../components/Assets/MarketplaceAssetModal';
import ActivityFeed from '../components/Activity/ActivityFeed';
import { getAllCollectionStats, CollectionStats } from '../utils/collectionUtils';
import { ipfsService } from '../services/ipfs';
import { getUseTranslation } from '../utils/i18n-helpers';
import { useWallet } from '../contexts/WalletContext';
import { novaxContractService } from '../services/novaxContractService';
import { ethers } from 'ethers';

// TrustBridge categories - RWA only
// Note: Names will be translated in the component using t()
const CATEGORIES = [
  { id: 'all', nameKey: 'marketplace.allAssets', icon: Package },
  { id: 'rwa', nameKey: 'marketplace.realWorldAssets', icon: Building2 },
  { id: 'verified', nameKey: 'marketplace.verifiedAssets', icon: CheckCircle },
  { id: 'trading', nameKey: 'marketplace.tradingPools', icon: TrendingUp },
  { id: 'spv', nameKey: 'marketplace.spvInvestments', icon: Users }
];

// Time filters
const TIME_FILTERS = [
  { id: 'all', name: 'All' },
  { id: '30d', name: '30d' },
  { id: '7d', name: '7d' },
  { id: '1d', name: '1d' },
  { id: '1h', name: '1h' },
  { id: '15m', name: '15m' },
  { id: '5m', name: '5m' },
  { id: '1m', name: '1m' }
];

// Sort options
const SORT_OPTIONS = [
  { id: 'floor', name: 'Floor Price', icon: DollarSign },
  { id: 'volume', name: 'Volume', icon: TrendingUp },
  { id: 'sales', name: 'Sales', icon: Star },
  { id: 'items', name: 'Items', icon: Package }
];

const AssetMarketplace: React.FC = () => {
  console.log('🎯 AssetMarketplace component rendered');
  
  // i18n
  const useTranslation = getUseTranslation();
  const { t } = useTranslation();
  const { address, isConnected, provider: walletProvider } = useWallet();
  const navigate = useNavigate();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('1d');
  const [sortBy, setSortBy] = useState('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [amcPools, setAmcPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showAssetDetail, setShowAssetDetail] = useState(false);
  const [priceFilter, setPriceFilter] = useState({ min: '', max: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'listed' | 'unlisted'>('all');
  const [viewType, setViewType] = useState<'assets' | 'collections'>('assets');
  const [collections, setCollections] = useState<CollectionStats[]>([]);

  // Fetch Novax pools from Etherlink
  const fetchAmcPools = async () => {
    try {
      console.log('🚀 fetchAmcPools() - Fetching Novax pools from Etherlink...');
      
      if (!provider) {
        console.warn('⚠️ No provider available, cannot fetch pools');
        setAmcPools([]);
        return;
      }

      // Initialize Novax contract service
      const readOnlyProvider = provider;
      novaxContractService.initialize(null as any, readOnlyProvider);

      // Get all pools from Novax PoolManager
      const poolIds = await novaxContractService.getAllPools();
      console.log(`📋 Found ${poolIds.length} pools on Etherlink`);

      // Fetch pool details
      const pools = await Promise.all(
        poolIds.map(async (poolId: string) => {
          try {
            const pool = await novaxContractService.getPool(poolId);
            
            // Convert pool data to marketplace format
            return {
              poolId: poolId,
              name: pool.name || `Pool ${poolId.slice(0, 8)}`,
              description: pool.description || 'Novax Yield Investment Pool',
              totalValue: Number(ethers.formatUnits(pool.targetAmount || '0', 6)),
              totalInvested: Number(ethers.formatUnits(pool.totalInvested || '0', 6)),
              tokenPrice: pool.totalInvested && pool.totalShares 
                ? Number(ethers.formatUnits(pool.totalInvested, 6)) / Number(ethers.formatUnits(pool.totalShares, 18))
                : 1,
              tokenSupply: Number(ethers.formatUnits(pool.totalShares || '0', 18)),
              expectedAPY: pool.apr ? Number(pool.apr) / 100 : 0,
              minimumInvestment: Number(ethers.formatUnits(pool.minInvestment || '0', 6)),
              maximumInvestment: Number(ethers.formatUnits(pool.maxInvestment || '0', 6)),
              status: pool.status === 0 ? 'ACTIVE' : pool.status === 1 ? 'FUNDED' : 'INACTIVE',
              isActive: pool.status === 0,
              isTradeable: pool.status === 0,
              isListed: pool.status === 0,
              location: 'Etherlink Network',
              createdAt: new Date().toISOString(),
              assets: [],
              category: 'Novax Yield Pool',
              type: 'novax-pool',
              assetType: 'Novax Yield Pool',
              maturityDate: pool.maturityDate ? Number(pool.maturityDate) * 1000 : null,
              apr: pool.apr ? Number(pool.apr) / 100 : 0,
            };
          } catch (error) {
            console.error(`Failed to fetch pool ${poolId}:`, error);
            return null;
          }
        })
      );

      // Filter out nulls and only active pools
      const activePools = pools.filter((p: any) => p !== null && p.isActive);
      console.log(`✅ Found ${activePools.length} active Novax pools`);
      
      setAmcPools(activePools);
    } catch (error) {
      console.error('❌ Failed to fetch Novax pools:', error);
      setAmcPools([]);
    }
  };

  // Fetch ALL assets from Mantle blockchain only
  const fetchMarketplaceData = useCallback(async () => {
    // Add timeout safeguard - ensure loading doesn't hang forever
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    try {
      setLoading(true);
      setError(null);
      console.log('🔗 Fetching ALL assets from Mantle blockchain only...');
      console.log(`📊 Current amcPools state: ${amcPools.length} pools`);
      
      // Set timeout safeguard
      loadingTimeout = setTimeout(() => {
        console.warn('⚠️ fetchMarketplaceData taking too long, forcing completion');
        setLoading(false);
      }, 30000); // 30 second max
      
      // Mantle contract service removed - using Etherlink/Novax contracts instead
      // TODO: Replace with Novax contract calls for Etherlink
      console.log('🔗 Mantle service removed - use Novax contracts for Etherlink');
      
      // Fetch from blockchain only
      const marketplaceAssets: any[] = [];
      
      // Add active pools as tradeable items
      console.log(`🏊 Processing ${amcPools.length} AMC pools for marketplace...`);
      if (amcPools.length === 0) {
        console.warn('⚠️ No AMC pools available - amcPools array is empty');
        console.warn('   This might mean pools are still loading or fetchAmcPools failed');
      }
      const poolItems = amcPools.map((pool: any) => {
        const poolItem = {
          id: `pool-${pool.poolId || pool._id}`,
          poolId: pool.poolId || pool._id,
          name: pool.name || pool.poolName || 'Unnamed Pool',
          description: pool.description || pool.poolDescription || 'Investment pool',
          imageURI: pool.imageURI || '',
          price: pool.tokenPrice || (pool.totalValue / pool.tokenSupply) || '0',
          totalValue: pool.totalValue || pool.totalPoolValue || 0,
          owner: pool.createdBy || pool.creator || '',
          category: 'Trading Pool',
          type: 'pool',
          assetType: 'Trading Pool',
          status: pool.status || 'ACTIVE',
          isActive: pool.status === 'ACTIVE',
          isTradeable: true,
          isListed: pool.status === 'ACTIVE',
        location: 'Etherlink Network',
        createdAt: pool.createdAt || pool.launchedAt || new Date().toISOString(),
        expectedAPY: pool.expectedAPY || 0,
        assets: pool.assets || pool.assetNFTs || [],
        minimumInvestment: pool.minimumInvestment || 100,
        tokenSupply: pool.tokenSupply || 0,
        // Pool-specific fields
        seniorTrancheId: pool.seniorTrancheId,
        juniorTrancheId: pool.juniorTrancheId,
        // poolId already set above (line 267), removed duplicate
        tranches: {
          senior: { percentage: 70, apy: 8 },
          junior: { percentage: 30, apy: 15 }
        }
      };
        console.log(`✅ Created pool item: ${poolItem.name} (${poolItem.poolId})`);
        return poolItem;
      });
      
      marketplaceAssets.push(...poolItems);
      console.log(`🏊 Added ${poolItems.length} pools to marketplace (total assets: ${marketplaceAssets.length})`);
      
      try {
        // Mantle service removed - using Etherlink/Novax contracts instead
        // TODO: Replace with Novax contract calls for Etherlink
        console.log('🔗 Mantle service removed - use Novax contracts for Etherlink');
        const activeListings: any[] = [];
        
        // Process active listings from blockchain - only RWA assets
        const processedListings = activeListings
          .filter((listing: any) => {
            // Filter out invalid token IDs (bytes32 hashes instead of uint256)
            const tokenIdStr = listing.tokenId?.toString() || '0';
            const isValidTokenId = tokenIdStr.length <= 10 && !isNaN(parseInt(tokenIdStr)) && parseInt(tokenIdStr) > 0;
            
            if (!isValidTokenId) {
              console.log(`🚫 Filtering out listing with invalid token ID: ${tokenIdStr}`);
              return false;
            }
            
            // Only include RWA assets
            const isRWA = listing.assetType === 'RWA' || 
                         listing.category === 'RWA' || 
                         listing.type === 'rwa' ||
                         listing.category === 'Real Estate' ||
                         listing.category === 'Commodities' ||
                         listing.category === 'Infrastructure' ||
                         listing.category === 'Agriculture' ||
                         listing.category === 'Farm' ||
                         listing.category === 'Property';
            
            if (!isRWA) {
              console.log(`🚫 Filtering out non-RWA asset: ${listing.name || listing.assetId}`);
              return false;
            }
            
            return true;
          })
          .map((listing: any) => {
            return {
              id: listing.id || listing.listingId?.toString() || listing.assetId,
              tokenId: listing.tokenId?.toString() || listing.assetId,
              name: listing.name || `Asset #${listing.tokenId || listing.assetId}`,
              description: listing.description || 'RWA Asset',
              imageURI: listing.imageURI || listing.image || '',
              price: listing.price || listing.totalValue || '0',
              totalValue: listing.totalValue || listing.price || '0',
              owner: listing.seller || listing.owner,
              category: 'RWA',
              type: 'rwa',
              status: 'listed',
              isActive: listing.isActive !== false,
              isTradeable: true,
              isListed: true,
              location: listing.location || 'Mantle Network',
              createdAt: listing.createdAt || new Date().toISOString(),
              listingId: listing.listingId?.toString()
            };
          });
        
        marketplaceAssets.push(...processedListings);
        console.log(`🔗 Processed ${processedListings.length} RWA listings from Mantle blockchain`);
      } catch (blockchainError) {
        console.error('❌ Error fetching from Mantle blockchain:', blockchainError);
      }
      
      // No API fetching - using Etherlink/Novax contracts
      console.log(`🔗 Total assets from Mantle blockchain: ${marketplaceAssets.length}`);
      
      // Deduplicate assets by ID
      const uniqueAssets = marketplaceAssets.filter((asset, index, self) => {
        if (!asset || !asset.id) return false;
        return index === self.findIndex((a) => a && a.id === asset.id);
      });
      
      console.log('📊 Unique assets from blockchain:', uniqueAssets.length);
      setAssets(uniqueAssets);
      
      // Calculate collection stats
      const collectionStats = getAllCollectionStats(uniqueAssets);
      setCollections(collectionStats);
      console.log('📦 Collections calculated:', collectionStats.length);
    } catch (err) {
      console.error('Error fetching marketplace data:', err);
      setError('Failed to load marketplace data from blockchain');
      setAssets([]);
      setCollections([]);
    } finally {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      setLoading(false);
      console.log('✅ fetchMarketplaceData completed, loading set to false');
    }
  }, [amcPools]);

  // Refresh marketplace data
  const refreshMarketplaceData = async () => {
    await fetchAmcPools();
    setRefreshing(true);
    await fetchMarketplaceData();
    setRefreshing(false);
  };


  useEffect(() => {
    console.log('🔄 AssetMarketplace useEffect triggered - fetching pools...');
    console.log('   Current amcPools state:', amcPools.length);
    
    const loadData = async () => {
      try {
        console.log('🚀 Starting loadData() - calling fetchAmcPools()...');
        await fetchAmcPools();
        console.log('✅ fetchAmcPools() completed');
        // Note: fetchMarketplaceData() will be called automatically by the useEffect that watches amcPools
      } catch (error) {
        console.error('❌ Error in loadData():', error);
      }
    };
    loadData();
  }, []);

  // Refetch marketplace data when pools are loaded
  useEffect(() => {
    // Always fetch marketplace data when amcPools changes (even if empty)
    // This ensures we show loading/empty states correctly
    console.log(`🔄 amcPools changed (${amcPools.length} pools), fetching marketplace data...`);
    fetchMarketplaceData();
  }, [amcPools, fetchMarketplaceData]);

  // Filter to only show Novax pools
  const filteredAssets = React.useMemo(() => {
    // Only return Novax pools - no other assets
    const filtered = assets.filter((asset: any) => {
      if (!asset) return false;
      const isPool = asset.type === 'pool' || asset.type === 'novax-pool' || 
                     asset.category === 'Trading Pool' || asset.category === 'Novax Yield Pool' || 
                     asset.assetType === 'Trading Pool' || asset.assetType === 'Novax Yield Pool';
      if (isPool) {
        console.log(`✅ Novax pool found: ${asset.name} (${asset.poolId})`);
      }
      return isPool;
    });
    console.log(`📊 Filtered assets: ${filtered.length} Novax pools out of ${assets.length} total assets`);
    return filtered;
  }, [assets, amcPools]);

  const formatPrice = (price: string, currency: string) => {
    const numPrice = parseFloat(price);
    if (currency === 'USDC') {
        if (numPrice < 1) {
        return `${numPrice.toFixed(2)} USDC`;
      } else if (numPrice < 1000) {
        return `${numPrice.toFixed(0)} USDC`;
      } else if (numPrice < 1000000) {
        return `${(numPrice / 1000).toFixed(1)}K USDC`;
      } else {
        return `${(numPrice / 1000000).toFixed(1)}M USDC`;
      }
    } else {
      if (numPrice < 0.01) {
        return `< 0.01 ${currency}`;
      }
      return `${numPrice.toFixed(4)} ${currency}`;
    }
  };

  // Calculate total TVL from pools
  const totalTVL = filteredAssets
    .filter(a => a.type === 'pool' || a.category === 'Trading Pool')
    .reduce((sum, pool) => sum + (parseFloat(pool.totalValue?.toString() || '0') || 0), 0);

  // Get current date for TVL display
  const currentDate = new Date().toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  // Filter and sort pools
  const pools = useMemo(() => {
    let result = filteredAssets.filter(asset => 
      asset.type === 'pool' || 
      asset.type === 'novax-pool' || 
      asset.category === 'Trading Pool' || 
      asset.category === 'Novax Yield Pool'
    );

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(pool => 
        pool.name?.toLowerCase().includes(query) ||
        pool.poolId?.toLowerCase().includes(query) ||
        pool.description?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(pool => {
        if (statusFilter === 'listed') return pool.isListed === true;
        if (statusFilter === 'unlisted') return pool.isListed === false;
        return true;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'apy':
          comparison = (b.expectedAPY || b.apr || 0) - (a.expectedAPY || a.apr || 0);
          break;
        case 'tvl':
          comparison = (b.totalInvested || b.totalValue || 0) - (a.totalInvested || a.totalValue || 0);
          break;
        case 'maturity':
          const aMaturity = a.maturityDate || 0;
          const bMaturity = b.maturityDate || 0;
          comparison = aMaturity - bMaturity;
          break;
        case 'newest':
          const aDate = new Date(a.createdAt || 0).getTime();
          const bDate = new Date(b.createdAt || 0).getTime();
          comparison = bDate - aDate;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [filteredAssets, searchQuery, statusFilter, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-8 sm:py-12">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
            <p className="ml-4 text-gray-600">Loading pools...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium mb-2">Error loading marketplace</p>
            <p className="text-red-600 text-sm">{error}</p>
            <Button
              onClick={refreshMarketplaceData}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && pools.length === 0 && (
          <div className="text-center py-20">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Novax Yield Pools</h2>
              <p className="text-gray-600">
                Decentralized real-world asset tokens. Freely transferable tokens with on-chain transparency and liquidity.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 max-w-md mx-auto">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No pools available</h3>
              <p className="text-gray-600 text-sm mb-6">
                There are currently no active investment pools. Check back later or create a new pool.
              </p>
              <Button
                onClick={refreshMarketplaceData}
                variant="outline"
                className="mx-auto"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Novax Yield Pools Section */}
        {!loading && !error && pools.length > 0 && (
          <div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Novax Yield Pools</h2>
                  <p className="text-gray-600">
                    Trade receivable investment pools on Etherlink. Earn yield from verified trade receivables with on-chain transparency.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SortDropdown
                    options={[
                      { id: 'newest', label: 'Newest First' },
                      { id: 'apy', label: 'APY (High to Low)' },
                      { id: 'tvl', label: 'TVL (High to Low)' },
                      { id: 'maturity', label: 'Maturity Date' }
                    ]}
                    selectedOption={sortBy}
                    sortOrder={sortOrder}
                    onOptionChange={setSortBy}
                    onOrderChange={setSortOrder}
                  />
                </div>
              </div>

              {/* Filter Bar */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={{
                  status: [
                    { id: 'all', label: 'All Status' },
                    { id: 'active', label: 'Active' },
                    { id: 'funded', label: 'Funded' },
                    { id: 'matured', label: 'Matured' }
                  ],
                  apy: [
                    { id: 'all', label: 'All APY' },
                    { id: 'high', label: '10%+', value: 10 },
                    { id: 'medium', label: '5-10%', value: 5 },
                    { id: 'low', label: '<5%', value: 0 }
                  ]
                }}
                activeFilters={statusFilter !== 'all' ? { status: statusFilter } : {}}
                onFilterChange={(key, value) => {
                  if (key === 'status') {
                    setStatusFilter(value as 'all' | 'listed' | 'unlisted' || 'all');
                  }
                }}
                onClearFilters={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                placeholder="Search pools by name or ID..."
              />
            </div>
            
            {/* Pool Cards Grid - Centrifuge Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pools.map((pool, index) => {
                // Generate pool logo initials (like "JH JTRSY")
                const poolName = pool.name || 'Pool';
                const words = poolName.split(' ');
                const logoText = words.length >= 2 
                  ? `${words[0].substring(0, 3).toUpperCase()} ${words[1].substring(0, 5).toUpperCase()}`
                  : poolName.substring(0, 8).toUpperCase();
                
                return (
                  <motion.div
                    key={pool.id || pool.poolId || `pool-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => {
                      // Navigate to pool detail page instead of opening modal
                      navigate(`/dashboard/pool/${pool.poolId || pool.id}`);
                    }}
                  >
                    {/* Logo - Centrifuge Style */}
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center border border-gray-200 mb-3">
                        <span className="text-lg font-bold text-blue-600">
                          {words.length >= 2 
                            ? `${words[0].charAt(0)}${words[1].charAt(0)}`
                            : poolName.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {logoText}
                      </p>
                    </div>

                    {/* Pool Title */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 leading-tight">
                      {pool.name}
                    </h3>

                    {/* Key Metrics - Centrifuge Style */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">TVL(USD)</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${(pool.totalValue || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">APY</p>
                        <p className="text-xl font-bold text-blue-600">
                          {pool.expectedAPY || 0}%
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">
                      {pool.description || 'Tokenized real-world assets offering stable returns through diversified investment pools.'}
                    </p>

                    {/* Pool Details - Centrifuge Style */}
                    <div className="space-y-2 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Asset type</span>
                        <span className="text-gray-900 font-medium">Trade Receivables</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Network</span>
                        <span className="text-gray-900 font-medium">Etherlink</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Min. investment</span>
                        <span className="text-gray-900 font-medium">
                          ${(pool.minimumInvestment || 100).toLocaleString()} USD
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Marketplace Asset Modal */}
      <MarketplaceAssetModal
        isOpen={showAssetDetail}
        onClose={() => {
          setShowAssetDetail(false);
          setSelectedAsset(null);
        }}
        asset={selectedAsset}
        onAssetUpdate={() => {
          fetchMarketplaceData();
        }}
      />
    </div>
  );
};

export default AssetMarketplace;
