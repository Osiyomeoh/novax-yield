import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useAdmin } from '../../contexts/AdminContext';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Calendar, 
  Target,
  Shield,
  Activity,
  BarChart3,
  Settings,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Info,
  ArrowLeft,
  Home,
  ChevronRight,
  Package,
  X
} from 'lucide-react';
import Button from '../UI/Button';

interface AMCPool {
  poolId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  totalValue: number;
  tokenSupply: number;
  tokenPrice: number;
  minimumInvestment: number;
  expectedAPY: number;
  maturityDate: string;
  totalInvested: number;
  totalInvestors: number;
  assets: any[];
  hederaTokenId: string;
  isTradeable: boolean;
  currentPrice: number;
  priceChange24h: number;
  tradingVolume: number;
  createdAt: string;
}

interface CreatePoolForm {
  name: string;
  description: string;
  type: string;
  assets: any[];
  totalValue: number;
  tokenSupply: number;
  tokenPrice: number;
  minimumInvestment: number;
  expectedAPY: number;
  maturityDate: string;
  riskFactors: string[];
  terms: string[];
  isTradeable: boolean;
  imageURI: string;
}

const AMCPoolManagement: React.FC = () => {
  const navigate = useNavigate();
  const [pools, setPools] = useState<AMCPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPool, setSelectedPool] = useState<AMCPool | null>(null);
  const [createForm, setCreateForm] = useState<CreatePoolForm>({
    name: '',
    description: '',
    type: 'REAL_ESTATE',
    assets: [],
    totalValue: 0,
    tokenSupply: 1000000,
    tokenPrice: 1,
    minimumInvestment: 100,
    expectedAPY: 12,
    maturityDate: '',
    riskFactors: [],
    terms: [],
    isTradeable: true,
    imageURI: ''
  });
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [usedAssetIds, setUsedAssetIds] = useState<Set<string>>(new Set());
  const [launchingPools, setLaunchingPools] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const { isAmcAdmin, isSuperAdmin, isPlatformAdmin, loading: adminLoading } = useAdmin();

  useEffect(() => {
    fetchPools();
    fetchUsedAssetIds();
  }, []);

  const fetchUsedAssetIds = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/amc-pools`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const usedIds = new Set<string>();
        
        // Extract asset IDs from all existing pools
        const pools = Array.isArray(data) ? data : data.data?.pools || [];
        pools.forEach((pool: any) => {
          if (pool.assets && Array.isArray(pool.assets)) {
            pool.assets.forEach((asset: any) => {
              if (asset.assetId) {
                usedIds.add(asset.assetId);
              }
            });
          }
        });
        
        setUsedAssetIds(usedIds);
        console.log('📊 Used asset IDs:', Array.from(usedIds));
      }
    } catch (error) {
      console.error('Failed to fetch used asset IDs:', error);
    }
  };

  const fetchPools = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) return;
      
      const response = await fetch(`${apiUrl}/amc-pools`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPools(data);
      }
    } catch (error) {
      console.error('Failed to fetch pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAssets = async () => {
    try {
      setLoadingAssets(true);
      
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      // Fetch both RWA assets and existing pools in parallel
      const [assetsResponse, poolsResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/hedera/rwa/trustbridge-assets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/amc-pools`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      if (assetsResponse.ok && poolsResponse.ok) {
        const [assetsData, poolsData] = await Promise.all([
          assetsResponse.json(),
          poolsResponse.json()
        ]);
        
        console.log('🔍 Pools data:', poolsData);
        console.log('🔍 Assets data:', assetsData);
        
        // Extract used asset IDs from existing pools
        const usedIds = new Set<string>();
        // poolsData is already an array, not an object with data.pools
        const pools = Array.isArray(poolsData) ? poolsData : poolsData.data?.pools || [];
        pools.forEach((pool: any) => {
          console.log('🔍 Processing pool:', pool.poolId, 'assets:', pool.assets);
          if (pool.assets && Array.isArray(pool.assets)) {
            pool.assets.forEach((asset: any, index: number) => {
              console.log(`🔍 Pool asset ${index}:`, asset);
              if (asset.assetId) {
                usedIds.add(asset.assetId);
                console.log('🔍 Found used asset in pool:', asset.assetId, 'from pool:', pool.poolId);
              } else {
                console.log('⚠️ Pool asset missing assetId field:', asset);
              }
            });
          } else {
            console.log('⚠️ Pool has no assets array or assets is not array:', pool.assets);
          }
        });
        
        // Debug: Log all RWA asset IDs
        console.log('🔍 All RWA asset IDs:', assetsData.data?.assets?.map((a: any) => a.rwaTokenId));
        
        // Filter for approved assets only and exclude assets already in pools
        const approvedAssets = assetsData.data?.assets?.filter((asset: any) => {
          const isApproved = asset.status === 'APPROVED';
          const isNotUsed = !usedIds.has(asset.rwaTokenId);
          console.log(`🔍 Asset ${asset.rwaTokenId}: approved=${isApproved}, notUsed=${isNotUsed}, usedIds=${Array.from(usedIds)}`);
          return isApproved && isNotUsed;
        }) || [];
        
        setAvailableAssets(approvedAssets);
        setUsedAssetIds(usedIds);
        console.log('📊 Available assets (filtered):', approvedAssets.length, 'out of', assetsData.data?.assets?.length || 0);
        console.log('📊 Used asset IDs:', Array.from(usedIds));
      }
    } catch (error) {
      console.error('Failed to fetch available assets:', error);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleCreatePool = async () => {
    try {
      // Check if user has admin privileges
      if (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) {
        toast({
          title: "Admin Access Required",
          description: "Only AMC Admins can create pools. Please contact an administrator.",
          variant: "destructive"
        });
        return;
      }

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to create pools.",
          variant: "destructive"
        });
        return;
      }

      // Validate that assets are added
      if (!createForm.assets || createForm.assets.length === 0) {
        toast({
          title: "No Assets Selected",
          description: "Please add at least one asset to the pool before creating it.",
          variant: "destructive"
        });
        return;
      }

      console.log('Creating pool with form data:', createForm);
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) return;
      
      const response = await fetch(`${apiUrl}/amc-pools`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createForm)
      });

      if (response.ok) {
        const newPool = await response.json();
        setPools([newPool, ...pools]);
        setShowCreateForm(false);
        resetForm();
        toast({
          title: "Pool Created Successfully",
          description: `Pool "${newPool.name}" has been created and is ready for launch.`,
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        console.error('Failed to create pool:', errorData);
        
        if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please log in with an admin account to create pools.",
            variant: "destructive"
          });
        } else if (response.status === 400) {
          toast({
            title: "Asset Already in Pool",
            description: errorData.message || 'One or more assets are already assigned to another pool.',
            variant: "destructive"
          });
        } else {
          toast({
            title: "Failed to Create Pool",
            description: errorData.message || 'Unknown error occurred',
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Failed to create pool:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to the server. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleLaunchPool = async (poolId: string) => {
    try {
      // Check if already launching this pool
      if (launchingPools.has(poolId)) {
        return;
      }

      // Check if user has admin privileges
      if (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) {
        toast({
          title: "Admin Access Required",
          description: "Only AMC Admins can launch pools.",
          variant: "destructive"
        });
        return;
      }

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to launch pools.",
          variant: "destructive"
        });
        return;
      }

      // Set loading state
      setLaunchingPools(prev => new Set(prev).add(poolId));

      // Show loading state
      toast({
        title: "Launching Pool",
        description: "Creating Hedera token and launching pool...",
        variant: "default"
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/amc-pools/${poolId}/launch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Pool launch successful:', result);
        await fetchPools(); // Refresh pools
        
        toast({
          title: "Pool Launched Successfully!",
          description: `Pool "${result.name || poolId}" is now live and accepting investments.`,
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to launch pool:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please log in with an admin account to launch pools.",
            variant: "destructive"
          });
        } else if (response.status === 400) {
          toast({
            title: "Launch Failed",
            description: errorData.message || 'Pool cannot be launched. Please check pool configuration.',
            variant: "destructive"
          });
        } else {
          toast({
            title: "Launch Failed",
            description: errorData.message || 'Failed to launch pool. Please try again.',
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('❌ Network error during pool launch:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to the server. Please try again.",
        variant: "destructive"
      });
    } finally {
      // Clear loading state
      setLaunchingPools(prev => {
        const newSet = new Set(prev);
        newSet.delete(poolId);
        return newSet;
      });
    }
  };

  const handleClosePool = async (poolId: string) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) return;
      
      const response = await fetch(`${apiUrl}/amc-pools/${poolId}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchPools(); // Refresh pools
      } else {
        console.error('Failed to close pool');
      }
    } catch (error) {
      console.error('Failed to close pool:', error);
    }
  };

  const resetForm = () => {
    setCreateForm({
      name: '',
      description: '',
      type: 'REAL_ESTATE',
      assets: [],
      totalValue: 0,
      tokenSupply: 1000000,
      tokenPrice: 1,
      minimumInvestment: 100,
      expectedAPY: 12,
      maturityDate: '',
      riskFactors: [],
      terms: [],
      isTradeable: true,
      imageURI: ''
    });
  };

  const addAssetToPool = (asset: any, value: number) => {
    const newAsset = {
      assetId: asset.rwaTokenId,
      name: asset.assetData?.name || `Asset ${asset.rwaTokenId}`,
      value: value,
      percentage: 0 // Will be calculated later
    };
    
    const updatedAssets = [...createForm.assets, newAsset];
    const totalValue = updatedAssets.reduce((sum, a) => sum + a.value, 0);
    
    // Calculate percentages
    const assetsWithPercentage = updatedAssets.map(a => ({
      ...a,
      percentage: (a.value / totalValue) * 100
    }));
    
    // Calculate recommended token pricing
    const recommendations = calculateTokenRecommendations(totalValue, updatedAssets);
    
    setCreateForm({
      ...createForm,
      assets: assetsWithPercentage,
      totalValue: totalValue,
      // Apply recommendations
      tokenSupply: recommendations.recommendedTokenSupply,
      tokenPrice: recommendations.recommendedTokenPrice,
      minimumInvestment: recommendations.recommendedMinimumInvestment
    });
    
    setShowAssetSelector(false);
  };

  const removeAssetFromPool = (assetId: string) => {
    const updatedAssets = createForm.assets.filter(a => a.assetId !== assetId);
    const totalValue = updatedAssets.reduce((sum, a) => sum + a.value, 0);
    
    // Recalculate percentages
    const assetsWithPercentage = updatedAssets.map(a => ({
      ...a,
      percentage: totalValue > 0 ? (a.value / totalValue) * 100 : 0
    }));
    
    // Recalculate recommendations
    const recommendations = calculateTokenRecommendations(totalValue, updatedAssets);
    
    setCreateForm({
      ...createForm,
      assets: assetsWithPercentage,
      totalValue: totalValue,
      // Apply updated recommendations
      tokenSupply: recommendations.recommendedTokenSupply,
      tokenPrice: recommendations.recommendedTokenPrice,
      minimumInvestment: recommendations.recommendedMinimumInvestment
    });
  };

  // Calculate smart token recommendations based on assets
  const calculateTokenRecommendations = (totalValue: number, assets: any[]) => {
    if (totalValue === 0) {
      return {
        recommendedTokenSupply: 1000000,
        recommendedTokenPrice: 1,
        recommendedMinimumInvestment: 100
      };
    }

    // Calculate asset diversity score (more diverse = more tokens)
    const diversityScore = Math.min(assets.length, 5); // Max 5 for diversity
    
    // Calculate risk-adjusted token supply
    // Higher value pools get more tokens for better liquidity
    const baseTokens = Math.max(100000, Math.floor(totalValue / 100)); // $100 per token base
    const diversityMultiplier = 1 + (diversityScore * 0.2); // 20% more tokens per additional asset
    const recommendedTokenSupply = Math.floor(baseTokens * diversityMultiplier);
    
    // Calculate token price (total value / token supply)
    const recommendedTokenPrice = totalValue / recommendedTokenSupply;
    
    // Calculate minimum investment (1% of total value, min $100, max $10,000)
    const onePercent = totalValue * 0.01;
    const recommendedMinimumInvestment = Math.max(100, Math.min(10000, Math.floor(onePercent)));
    
    // Round token price to reasonable decimal places
    const roundedTokenPrice = Math.round(recommendedTokenPrice * 1000) / 1000; // 3 decimal places
    
    console.log('📊 Token Recommendations:', {
      totalValue,
      assetCount: assets.length,
      diversityScore,
      recommendedTokenSupply,
      recommendedTokenPrice: roundedTokenPrice,
      recommendedMinimumInvestment
    });
    
    return {
      recommendedTokenSupply,
      recommendedTokenPrice: roundedTokenPrice,
      recommendedMinimumInvestment
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-primary-blue bg-primary-blue';
      case 'DRAFT': return 'text-yellow-500 bg-yellow-100';
      case 'CLOSED': return 'text-red-500 bg-red-100';
      case 'MATURED': return 'text-blue-500 bg-blue-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="w-4 h-4" />;
      case 'DRAFT': return <AlertCircle className="w-4 h-4" />;
      case 'CLOSED': return <Pause className="w-4 h-4" />;
      case 'MATURED': return <CheckCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-off-white p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-800 rounded-lg p-6">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Navigation Header */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <button
              onClick={() => navigate('/dashboard/admin')}
              className="flex items-center gap-1 hover:text-gray-900 dark:text-gray-200 transition-colors"
            >
              <Home className="w-4 h-4" />
              Admin Dashboard
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white font-medium">AMC Pool Management</span>
          </nav>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/admin')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Button>
            <div className="flex-1" />
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              AMC Pool Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Create and manage investment pools backed by RWA assets
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/dashboard/admin/create-pool')}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Create Novax Pool
            </Button>
            <Button
              onClick={() => setShowCreateForm(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Create RWA Pool
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Total Pools</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{pools.length}</p>
              </div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Active Pools</p>
                <p className="text-xl sm:text-2xl font-bold text-primary-blue dark:text-primary-blue">{pools.filter(p => p.status === 'ACTIVE').length}</p>
              </div>
              <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-primary-blue dark:text-primary-blue" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Total Value</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">${pools.reduce((sum, p) => sum + p.totalValue, 0).toLocaleString()}</p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Total Investors</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{pools.reduce((sum, p) => sum + p.totalInvestors, 0)}</p>
              </div>
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
      </div>

        {/* Pools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {pools.map((pool) => (
            <div key={pool.poolId} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
              {/* Pool Header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">{pool.name}</h3>
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pool.status)}`}>
                    {getStatusIcon(pool.status)}
                    {pool.status}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">APY</p>
                  <p className="text-lg sm:text-xl font-bold text-primary-blue dark:text-primary-blue">{pool.expectedAPY}%</p>
                </div>
              </div>

              {/* Pool Details */}
              <div className="space-y-2 sm:space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total Value</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${pool.totalValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Invested</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${pool.totalInvested.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Investors</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{pool.totalInvestors}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Min. Investment</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${pool.minimumInvestment}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Funding Progress</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{Math.round((pool.totalInvested / pool.totalValue) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((pool.totalInvested / pool.totalValue) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                {pool.status === 'DRAFT' && (
                  <button
                    onClick={() => handleLaunchPool(pool.poolId)}
                    disabled={launchingPools.has(pool.poolId) || adminLoading || (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin)}
                    className={`flex-1 px-3 py-2 rounded text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                      launchingPools.has(pool.poolId) || adminLoading || (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {launchingPools.has(pool.poolId) ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                        Launching...
                      </>
                    ) : adminLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                        Checking...
                      </>
                    ) : (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) ? (
                      <>
                        <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                        Admin Required
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                        Launch
                      </>
                    )}
                  </button>
                )}
                {pool.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleClosePool(pool.poolId)}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                    Close
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPool(pool)}
                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded text-xs sm:text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                    Manage
                  </button>
                  {(pool.status === 'FUNDED' || pool.status === 'MATURED') && (
                    <button
                      onClick={() => navigate(`/dashboard/admin/pools/${pool.poolId}/payment`)}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Pool Modal */}
      {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Create New AMC Pool</h2>
            
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pool Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter pool name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter pool description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pool Display Image URL</label>
                  <input
                    type="url"
                    value={createForm.imageURI}
                    onChange={(e) => setCreateForm({...createForm, imageURI: e.target.value})}
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/pool-image.jpg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Provide a URL for the pool's display image</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pool Type</label>
                    <select
                      value={createForm.type}
                      onChange={(e) => setCreateForm({...createForm, type: e.target.value})}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <option value="REAL_ESTATE">Real Estate</option>
                    <option value="AGRICULTURAL">Agricultural</option>
                    <option value="COMMODITIES">Commodities</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Total Value ($)</label>
                  <input
                    type="number"
                    value={createForm.totalValue}
                    onChange={(e) => setCreateForm({...createForm, totalValue: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                    placeholder="1000000"
                    readOnly
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-calculated from selected assets</p>
                </div>
              </div>

              {/* Asset Selection Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pool Assets ({createForm.assets.length})
                  </label>
                  <Button
                    type="button"
                    onClick={() => {
                      fetchAvailableAssets();
                      setShowAssetSelector(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Asset
                  </Button>
                </div>

                {/* Selected Assets List */}
                {createForm.assets.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {createForm.assets.map((asset, index) => (
                      <div key={asset.assetId} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{asset.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            ${asset.value.toLocaleString()} ({asset.percentage.toFixed(1)}%)
                          </p>
                        </div>
                        <button
                          onClick={() => removeAssetFromPool(asset.assetId)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
                    <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No assets selected</p>
                    <p className="text-sm text-gray-400">Click "Add Asset" to select RWA assets for this pool</p>
                  </div>
                )}
              </div>

              {/* AI Recommendations Section */}
              {createForm.assets.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">AI Token Recommendations</h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Smart pricing based on your ${createForm.totalValue.toLocaleString()} pool with {createForm.assets.length} asset{createForm.assets.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const recommendations = calculateTokenRecommendations(createForm.totalValue, createForm.assets);
                        setCreateForm({
                          ...createForm,
                          tokenSupply: recommendations.recommendedTokenSupply,
                          tokenPrice: recommendations.recommendedTokenPrice,
                          minimumInvestment: recommendations.recommendedMinimumInvestment
                        });
                      }}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      Apply Recommendations
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium">Token Supply</label>
                    {createForm.assets.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        AI Recommended
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={createForm.tokenSupply}
                    onChange={(e) => setCreateForm({...createForm, tokenSupply: parseInt(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                    placeholder="1000000"
                  />
                  {createForm.assets.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Based on ${createForm.totalValue.toLocaleString()} total value and {createForm.assets.length} asset{createForm.assets.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium">Token Price ($)</label>
                    {createForm.assets.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        AI Recommended
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    value={createForm.tokenPrice}
                    onChange={(e) => setCreateForm({...createForm, tokenPrice: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                    placeholder="1.00"
                  />
                  {createForm.assets.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      ${createForm.tokenPrice.toFixed(3)} per token
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium">Min. Investment ($)</label>
                    {createForm.assets.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        AI Recommended
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={createForm.minimumInvestment}
                    onChange={(e) => setCreateForm({...createForm, minimumInvestment: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                    placeholder="100"
                  />
                  {createForm.assets.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      1% of total value (${createForm.totalValue.toLocaleString()})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Expected APY (%)</label>
                  <input
                    type="number"
                    value={createForm.expectedAPY}
                    onChange={(e) => setCreateForm({...createForm, expectedAPY: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                    placeholder="12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Maturity Date</label>
                <input
                  type="date"
                  value={createForm.maturityDate}
                  onChange={(e) => setCreateForm({...createForm, maturityDate: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isTradeable"
                  checked={createForm.isTradeable}
                  onChange={(e) => setCreateForm({...createForm, isTradeable: e.target.checked})}
                  className="w-4 h-4 text-primary-blue bg-gray-700 border-gray-600 rounded focus:ring-primary-blue"
                />
                <label htmlFor="isTradeable" className="text-sm">Enable secondary market trading</label>
              </div>
            </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={handleCreatePool}
                    disabled={!createForm.assets || createForm.assets.length === 0 || adminLoading || (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin)}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                      (!createForm.assets || createForm.assets.length === 0 || adminLoading || (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin))
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {adminLoading 
                      ? 'Checking Admin Status...'
                      : (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin)
                        ? 'Admin Access Required'
                        : (!createForm.assets || createForm.assets.length === 0) 
                          ? 'Add Assets First' 
                          : 'Create Pool'
                    }
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                </div>
          </div>
        </div>
      )}

      {/* Asset Selector Modal */}
      {showAssetSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Select RWA Assets</h2>
              <button
                onClick={() => setShowAssetSelector(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white self-end sm:self-auto"
              >
                ✕
              </button>
            </div>

            {loadingAssets ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading available assets...</p>
              </div>
            ) : availableAssets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableAssets.map((asset) => (
                  <AssetSelectorCard 
                    key={asset.rwaTokenId} 
                    asset={asset} 
                    onAdd={addAssetToPool}
                    isAlreadyAdded={createForm.assets.some(a => a.assetId === asset.rwaTokenId)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">No approved assets available</p>
                <p className="text-sm text-gray-500">Assets need to be approved by AMC before they can be added to pools</p>
              </div>
            )}
          </div>
        </div>
      )}

        {/* Pool Details Modal */}
        {selectedPool && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{selectedPool.name}</h2>
                <button
                  onClick={() => setSelectedPool(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white self-end sm:self-auto"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Pool Information</h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPool.status)}`}>
                        {selectedPool.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Type</span>
                      <span className="text-gray-900 dark:text-white">{selectedPool.type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Total Value</span>
                      <span className="text-gray-900 dark:text-white">${selectedPool.totalValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Expected APY</span>
                      <span className="text-primary-blue dark:text-primary-blue">{selectedPool.expectedAPY}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Maturity Date</span>
                      <span className="text-gray-900 dark:text-white">{new Date(selectedPool.maturityDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Investment Statistics</h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Total Invested</span>
                      <span className="text-gray-900 dark:text-white">${selectedPool.totalInvested.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Total Investors</span>
                      <span className="text-gray-900 dark:text-white">{selectedPool.totalInvestors}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Min. Investment</span>
                      <span className="text-gray-900 dark:text-white">${selectedPool.minimumInvestment}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Token Price</span>
                      <span className="text-gray-900 dark:text-white">${selectedPool.tokenPrice}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Trading Volume</span>
                      <span className="text-gray-900 dark:text-white">${selectedPool.tradingVolume.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
            </div>

              {selectedPool.hederaTokenId && (
                <div className="mt-4 sm:mt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Hedera Integration</h3>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Hedera Token ID</p>
                    <p className="font-mono text-blue-600 dark:text-blue-400 text-sm sm:text-base">{selectedPool.hederaTokenId}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

// Asset Selector Card Component
const AssetSelectorCard: React.FC<{
  asset: any;
  onAdd: (asset: any, value: number) => void;
  isAlreadyAdded: boolean;
}> = ({ asset, onAdd, isAlreadyAdded }) => {
  // Initialize with asset's actual value from asset details
  const assetValue = asset.assetData?.totalValue || asset.assetData?.value || 0;
  const [value, setValue] = useState<number>(assetValue);
  const [showValueInput, setShowValueInput] = useState(false);

  const handleAdd = () => {
    if (value > 0) {
      onAdd(asset, value);
      setValue(0);
      setShowValueInput(false);
    }
  };

  return (
    <div className={`p-4 border rounded-lg ${isAlreadyAdded ? 'bg-gray-100 dark:bg-gray-700 border-gray-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
            {asset.assetData?.name || `Asset ${asset.rwaTokenId}`}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {asset.assetData?.type || 'RWA'} • {asset.assetData?.category || 'Asset'}
          </p>
        </div>
        {isAlreadyAdded && (
          <span className="text-xs bg-primary-blue text-primary-blue px-2 py-1 rounded-full">
            Added
          </span>
        )}
      </div>

      {asset.assetData?.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {asset.assetData.description}
        </p>
      )}

      {/* Asset Value Display */}
      <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Asset Value:</span> ${assetValue.toLocaleString()}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          You can adjust this value for pool allocation
        </p>
      </div>

      <div className="space-y-2">
        {!showValueInput ? (
          <Button
            onClick={() => setShowValueInput(true)}
            disabled={isAlreadyAdded}
            className="w-full text-xs"
            size="sm"
          >
            {isAlreadyAdded ? 'Already Added' : 'Add to Pool'}
          </Button>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Asset Value ($)
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                className="w-full text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={`Enter value (Asset worth: $${assetValue.toLocaleString()})`}
                min="0"
                step="1000"
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => setValue(assetValue)}
                  variant="outline"
                  className="flex-1 text-xs"
                  size="sm"
                >
                  Use Full Value
                </Button>
                <Button
                  onClick={() => setValue(assetValue * 0.5)}
                  variant="outline"
                  className="flex-1 text-xs"
                  size="sm"
                >
                  Use 50%
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAdd}
                  disabled={value <= 0}
                  className="flex-1 text-xs"
                  size="sm"
                >
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setShowValueInput(false);
                    setValue(assetValue);
                  }}
                  variant="outline"
                  className="flex-1 text-xs"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AMCPoolManagement;
