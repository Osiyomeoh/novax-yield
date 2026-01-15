import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../UI/Card';
import Button from '../UI/Button';
import Input from '../UI/Input';
import { Badge } from '../UI/Badge';
import { useToast } from '@/hooks/useToast';
import { useWallet } from '@/contexts/WalletContext';
import { useAdmin } from '@/contexts/AdminContext';
import { mantleContractService } from '@/services/mantleContractService';
import { ethers } from 'ethers';
import { getContractAddress } from '@/config/contracts';
import { Loader2, Plus, Building2, Coins, TrendingUp, Shield, AlertTriangle } from 'lucide-react';

interface RWANFT {
  nftTokenId: string;
  nftSerialNumber: string;
  propertyId: string;
  name: string;
  description: string;
  totalValue: number;
  expectedAPY: number;
  assetType: string;
  status: string;
  isInPool?: boolean; // Whether asset is already in a pool
  poolId?: string; // Pool ID if asset is in a pool
}

interface PoolFormData {
  poolName: string;
  poolDescription: string;
  selectedNFTs: string[];
  assetTokenizationAmounts: Record<string, number>; // Map of assetId -> tokenization amount
  totalPoolValue: number;
  tokenSupply: number;
  expectedAPY: number;
  tranches: {
    senior: {
      percentage: number;
      apy: number;
    };
    junior: {
      percentage: number;
      apy: number;
    };
  };
}

export default function PoolManagement() {
  const { accountId, address, hederaClient, signer, provider } = useWallet();
  const { isAmcAdmin, isSuperAdmin, isPlatformAdmin } = useAdmin();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [rwaNFTs, setRwaNFTs] = useState<RWANFT[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [formData, setFormData] = useState<PoolFormData>({
    poolName: '',
    poolDescription: '',
    selectedNFTs: [],
    assetTokenizationAmounts: {}, // Track tokenization amount per asset
    totalPoolValue: 0,
    tokenSupply: 1000000, // 1M tokens default
    expectedAPY: 10,
    tranches: {
      senior: {
        percentage: 70,
        apy: 8
      },
      junior: {
        percentage: 30,
        apy: 15
      }
    }
  });

  useEffect(() => {
    loadRwaNFTs();
    loadPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRwaNFTs = async () => {
    try {
      setIsLoading(true);
      
      // ALWAYS fetch from blockchain - no localStorage fallback
      // This ensures we only show assets that are actually status 6 on-chain
      const { mantleContractService } = await import('../../services/mantleContractService');
      const { ethers } = await import('ethers');
      
      // Initialize provider for read-only operations
      const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      mantleContractService.initialize(null as any, provider);
      
      // Get wallet address from context (use address for EVM/Mantle, accountId is for Hedera)
      const walletAddress = address || accountId || (window as any).ethereum?.selectedAddress || localStorage.getItem('walletAddress');
      
      if (!walletAddress) {
        console.warn('No wallet address available for fetching assets');
        setRwaNFTs([]);
        return;
      }

      console.log('🔍 Fetching assets from blockchain for pool creation...');
      const assets = await mantleContractService.getUserAssetsFromFactory(walletAddress);
      console.log(`📦 Found ${assets.length} total assets from blockchain`);
      
      // CRITICAL: Filter for ONLY status 6 (ACTIVE_AMC_MANAGED) assets
      // This is the ONLY status that allows pooling
      const activeRwaAssets = assets.filter((asset: any) => {
        const status = typeof asset.status === 'bigint' ? Number(asset.status) : Number(asset.status || 0);
        const isActive = status === 6; // ACTIVE_AMC_MANAGED
        
        if (!isActive) {
          console.log(`⚠️ Asset ${asset.assetId || asset.id} (${asset.name}) has status ${status}, not 6 (ACTIVE_AMC_MANAGED). Skipping.`);
          console.log(`   Asset details:`, {
            assetId: asset.assetId || asset.id,
            name: asset.name,
            status: status,
            statusType: typeof asset.status,
            rawStatus: asset.status
          });
        } else {
          console.log(`✅ Asset ${asset.assetId || asset.id} (${asset.name}) has status 6 - ready for pooling`);
        }
        
        return isActive;
      });
      
      console.log(`✅ Found ${activeRwaAssets.length} assets with status 6 (ACTIVE_AMC_MANAGED) - ready for pooling`);
      
      // CRITICAL: Filter out assets that are already in pools
      // Check assetToPool mapping for each asset
      const poolManagerAddress = getContractAddress('POOL_MANAGER');
      const poolManagerContract = new ethers.Contract(
        poolManagerAddress,
        [
          'function assetToPool(bytes32) external view returns (bytes32)',
        ],
        provider
      );
      
      // Check which assets are already in pools (but keep all assets visible)
      const assetsWithPoolStatus: any[] = [];
      for (const asset of activeRwaAssets) {
        try {
          const assetId = asset.assetId || asset.id;
          // Convert to bytes32 if needed
          const assetIdBytes32 = assetId.startsWith('0x') && assetId.length === 66
            ? assetId
            : ethers.id(assetId);
          
          // Check if asset is already in a pool
          const poolId = await poolManagerContract.assetToPool(assetIdBytes32);
          
          // If poolId is zero hash, asset is not in any pool
          const isInPool = poolId && poolId !== '0x0000000000000000000000000000000000000000000000000000000000000000' && poolId !== ethers.ZeroHash;
          
          assetsWithPoolStatus.push({
            ...asset,
            isInPool: isInPool,
            poolId: isInPool ? poolId : undefined
          });
          
          if (isInPool) {
            console.log(`⚠️ Asset ${assetId.slice(0, 10)}... is already in pool ${poolId.slice(0, 10)}...`);
          } else {
            console.log(`✅ Asset ${assetId.slice(0, 10)}... is available for pooling (not in any pool)`);
          }
        } catch (error: any) {
          console.warn(`⚠️ Could not check if asset ${asset.assetId || asset.id} is in a pool: ${error.message}`);
          // If we can't check, assume it's available (better to show it than hide it)
          assetsWithPoolStatus.push({
            ...asset,
            isInPool: false,
            poolId: undefined
          });
        }
      }
      
      const assetsInPools = assetsWithPoolStatus.filter(a => a.isInPool).length;
      console.log(`✅ Found ${assetsWithPoolStatus.length} assets: ${assetsWithPoolStatus.length - assetsInPools} available, ${assetsInPools} already in pools`);
      
      // Convert to RWANFT format (include ALL assets, not just available ones)
      const rwaNFTs = assetsWithPoolStatus.map((asset: any) => {
        const totalValue = typeof asset.totalValue === 'bigint' ? Number(asset.totalValue) / 1e18 : Number(asset.totalValue || 0);
        const maxInvestablePercentage = asset.maxInvestablePercentage !== undefined 
          ? Number(asset.maxInvestablePercentage) 
          : (asset.metadata?.maxInvestablePercentage !== undefined 
            ? Number(asset.metadata.maxInvestablePercentage) 
            : 100); // Default to 100% if not specified
        const maxInvestableValue = (totalValue * maxInvestablePercentage) / 100;
        
        return {
          nftTokenId: asset.assetId || asset.id,
          nftSerialNumber: asset.tokenId?.toString() || '0',
          propertyId: asset.assetId || asset.id,
          name: asset.name || `Asset ${(asset.assetId || asset.id || '').slice(0, 8)}`,
          description: asset.description || '',
          totalValue: totalValue,
          maxInvestablePercentage: maxInvestablePercentage,
          maxInvestableValue: maxInvestableValue, // Maximum value that can be tokenized
          expectedAPY: 10, // Default
          assetType: asset.assetTypeString || 'RWA',
          status: 'ACTIVE',
          isInPool: asset.isInPool || false, // Whether asset is already in a pool
          poolId: asset.poolId // Pool ID if asset is in a pool
        };
      });
      
      setRwaNFTs(rwaNFTs);
      
      if (rwaNFTs.length === 0) {
        console.warn('⚠️ No assets with status 6 (ACTIVE_AMC_MANAGED) found. Assets must complete the AMC workflow to be poolable.');
      }
    } catch (error: any) {
      console.error('❌ Failed to load RWA NFTs from blockchain:', error);
      toast({
        title: 'Error Loading Assets',
        description: `Failed to fetch assets from blockchain: ${error.message || 'Unknown error'}. Only assets with status 6 (ACTIVE_AMC_MANAGED) can be pooled.`,
        variant: 'destructive',
        duration: 8000
      });
      setRwaNFTs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPools = async () => {
    try {
      setIsLoading(true);
      
      // Fetch pools directly from blockchain contract only
      console.log('🔍 Fetching pools from blockchain contract...');
      const blockchainPools = await mantleContractService.getAllPoolsFromBlockchain();
      console.log(`📊 Found ${blockchainPools.length} total pools from contract`);
      
      // Filter to only active pools
      const activePools = blockchainPools.filter((pool: any) => {
        return pool.isActive !== false && pool.status !== 'INACTIVE';
      });
      
      console.log(`✅ Found ${activePools.length} active pools from contract`);
      setPools(activePools);
    } catch (error) {
      console.error('❌ Failed to fetch pools from contract:', error);
      setPools([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNFTSelection = (nftTokenId: string, checked: boolean) => {
    const nft = rwaNFTs.find(n => n.nftTokenId === nftTokenId);
    
    // Prevent selecting assets that are already in pools
    if (nft?.isInPool) {
      toast({
        title: 'Asset Already in Pool',
        description: `This asset is already in a pool and cannot be added to another pool.`,
        variant: 'destructive',
        duration: 5000
      });
      return;
    }
    
    if (checked) {
      // When selecting, initialize with maxInvestableValue (or totalValue if no limit)
      const maxInvestableValue = nft?.maxInvestableValue || nft?.totalValue || 0;
      setFormData(prev => ({
        ...prev,
        selectedNFTs: [...prev.selectedNFTs, nftTokenId],
        assetTokenizationAmounts: {
          ...prev.assetTokenizationAmounts,
          [nftTokenId]: maxInvestableValue // Default to max investable value
        }
      }));
    } else {
      setFormData(prev => {
        const newAmounts = { ...prev.assetTokenizationAmounts };
        delete newAmounts[nftTokenId];
        return {
          ...prev,
          selectedNFTs: prev.selectedNFTs.filter(id => id !== nftTokenId),
          assetTokenizationAmounts: newAmounts
        };
      });
    }
  };

  const handleTokenizationAmountChange = (nftTokenId: string, amount: number) => {
    const nft = rwaNFTs.find(n => n.nftTokenId === nftTokenId);
    const maxInvestableValue = nft?.maxInvestableValue || nft?.totalValue || Infinity;
    
    // Cap at max investable value
    const cappedAmount = Math.min(amount, maxInvestableValue);
    
    setFormData(prev => ({
      ...prev,
      assetTokenizationAmounts: {
        ...prev.assetTokenizationAmounts,
        [nftTokenId]: cappedAmount
      }
    }));
  };

  // Calculate pool value using useMemo to avoid infinite loops
  // Use tokenization amounts from formData instead of totalValue
  const poolValue = useMemo(() => {
    return formData.selectedNFTs.reduce((sum, assetId) => {
      const tokenizationAmount = formData.assetTokenizationAmounts[assetId] || 0;
      return sum + tokenizationAmount;
    }, 0);
  }, [formData.selectedNFTs, formData.assetTokenizationAmounts]);
  
  // Update totalPoolValue when poolValue changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, totalPoolValue: poolValue }));
  }, [poolValue]);

  const handleCreatePool = async () => {
    // Check admin permissions
    if (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) {
      toast({
        title: 'Admin Access Required',
        description: 'Only AMC Admins can create pools. Please contact an administrator.',
        variant: 'destructive'
      });
      return;
    }

    // Check authentication
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to create pools.',
        variant: 'destructive'
      });
      return;
    }

    // Validate assets before creating pool
    if (formData.selectedNFTs.length === 0) {
      toast({
        title: 'No Assets Selected',
        description: 'Please select at least one asset to add to the pool.',
        variant: 'destructive'
      });
      return;
    }

    // Double-check asset status before creating pool
    // Use the already-loaded rwaNFTs which are already filtered for status 6
    try {
      const selectedAssets = rwaNFTs.filter(nft => formData.selectedNFTs.includes(nft.nftTokenId));
      
      // Verify all selected assets exist in the filtered list (which only contains status 6 assets)
      const missingAssets: string[] = [];
      for (const selectedId of formData.selectedNFTs) {
        const found = selectedAssets.find(asset => asset.nftTokenId === selectedId);
        if (!found) {
          const nft = rwaNFTs.find(n => n.nftTokenId === selectedId);
          missingAssets.push(nft?.name || selectedId?.substring(0, 10) || 'Unknown');
        }
      }

      if (missingAssets.length > 0) {
        toast({
          title: 'Invalid Asset Status',
          description: `The following assets are not in ACTIVE_AMC_MANAGED status (status 6): ${missingAssets.join(', ')}. Please ensure all assets have completed the AMC activation process before creating a pool.`,
          variant: 'destructive',
          duration: 10000
        });
        return;
      }

      // Additional validation: ensure we have valid asset IDs
      if (selectedAssets.length === 0) {
        toast({
          title: 'No Valid Assets',
          description: 'No valid assets found. Please refresh and select assets again.',
          variant: 'destructive'
        });
        return;
      }

      // Verify all assets have valid IDs
      const invalidIds = selectedAssets.filter(asset => !asset.nftTokenId && !asset.propertyId);
      if (invalidIds.length > 0) {
        toast({
          title: 'Invalid Asset IDs',
          description: 'Some selected assets have invalid IDs. Please refresh and select assets again.',
          variant: 'destructive'
        });
        return;
      }
    } catch (error) {
      console.warn('Failed to validate assets before pool creation:', error);
      // Continue anyway - backend will validate
    }

    setIsLoading(true);
    try {
      console.log('🏊 Creating pool via backend API...');

      // Get selected assets with their details
      const selectedAssets = rwaNFTs.filter(nft => formData.selectedNFTs.includes(nft.nftTokenId));
      
      // Calculate asset percentages
      // CRITICAL: Verify asset IDs are in correct format (bytes32)
      // CRITICAL: Respect maxInvestablePercentage limit
      // Use tokenization amounts from formData
      const assets = selectedAssets.map((asset) => {
        const assetId = asset.nftTokenId || asset.propertyId || asset.assetId || asset.id;
        const maxInvestablePercentage = asset.maxInvestablePercentage || 100;
        const maxInvestableValue = asset.maxInvestableValue || asset.totalValue;
        const requestedValue = formData.assetTokenizationAmounts[assetId] || asset.totalValue; // Use user-specified amount
        
        // Check if requested value exceeds max investable
        if (requestedValue > maxInvestableValue) {
          const errorMsg = `Cannot tokenize ${requestedValue} TRUST of asset "${asset.name}". Maximum investable: ${maxInvestableValue} TRUST (${maxInvestablePercentage}% of total value).`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        if (requestedValue <= 0) {
          throw new Error(`Tokenization amount must be greater than 0 for asset "${asset.name}"`);
        }
        
        console.log(`📋 Preparing asset for pool:`, {
          name: asset.name,
          assetId: assetId,
          assetIdLength: assetId?.length,
          isBytes32: assetId?.startsWith('0x') && assetId.length === 66,
          totalValue: asset.totalValue,
          maxInvestablePercentage: maxInvestablePercentage,
          maxInvestableValue: maxInvestableValue,
          requestedValue: requestedValue
        });
        
        return {
          assetId: assetId, // Use the asset ID directly (should be bytes32 format)
          name: asset.name,
          value: requestedValue, // Use user-specified tokenization amount
          percentage: (requestedValue / formData.totalPoolValue) * 100
        };
      });

      // Prepare pool data for backend API
      const poolData = {
        name: formData.poolName,
        description: formData.poolDescription,
        type: 'REAL_ESTATE' as const, // Default type, could be made configurable
        assets: assets,
        totalValue: formData.totalPoolValue,
        tokenSupply: formData.tokenSupply,
        tokenPrice: formData.totalPoolValue / formData.tokenSupply, // Calculate price per token
        minimumInvestment: 100, // Default minimum
        expectedAPY: formData.expectedAPY,
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        isTradeable: true,
        metadata: {
          riskLevel: 'MEDIUM' as const,
          liquidity: 'MEDIUM' as const,
          diversification: assets.length,
          geographicDistribution: [],
          sectorDistribution: {}
        }
      };

      console.log('📊 Pool Data:', poolData);

      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const response = await fetch(`${apiUrl}/amc-pools`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(poolData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const newPool = await response.json();
      console.log('✅ Pool Created:', newPool);

      // Reload data
      await loadRwaNFTs();
      await loadPools();

      toast({
        title: 'Pool Created Successfully!',
        description: `Pool "${formData.poolName}" has been created and is ready for launch.`,
        variant: 'default'
      });

      // Reset form
      setFormData({
        poolName: '',
        poolDescription: '',
        selectedNFTs: [],
        assetTokenizationAmounts: {},
        totalPoolValue: 0,
        tokenSupply: 1000000,
        expectedAPY: 10,
        tranches: {
          senior: { percentage: 70, apy: 8 },
          junior: { percentage: 30, apy: 15 }
        }
      });

    } catch (error) {
      console.error('❌ Pool creation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Check if the error mentions assets not being ACTIVE_AMC_MANAGED
      if (errorMessage.includes('ACTIVE_AMC_MANAGED') || errorMessage.includes('status 6')) {
        toast({
          title: 'Asset Status Error',
          description: 'Selected assets must be in ACTIVE_AMC_MANAGED status (status 6) before they can be added to a pool. Please ensure all assets have completed the AMC activation process.',
          variant: 'destructive',
          duration: 10000 // Show longer for important errors
        });
      } else if (errorMessage.includes('Pool created on-chain but no assets')) {
        // Extract pool ID from error message if present
        const poolIdMatch = errorMessage.match(/Pool ID: (0x[a-fA-F0-9]+)/);
        const poolId = poolIdMatch ? poolIdMatch[1] : null;
        
        toast({
          title: 'Pool Created But Empty',
          description: poolId 
            ? `Pool was created on-chain but no assets could be added. Pool ID: ${poolId.substring(0, 10)}... Please ensure assets are ACTIVE_AMC_MANAGED (status 6) and try again.`
            : 'Pool was created on-chain but no assets could be added. Please ensure all selected assets are in ACTIVE_AMC_MANAGED status (status 6).',
          variant: 'destructive',
          duration: 10000
        });
      } else {
        toast({
          title: 'Pool Creation Failed',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchPool = async (poolId: string) => {
    // Check admin permissions
    if (!isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) {
      toast({
        title: 'Admin Access Required',
        description: 'Only AMC Admins can launch pools.',
        variant: 'destructive'
      });
      return;
    }

    // Check authentication
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to launch pools.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🚀 Launching pool on Mantle...');

      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      // Note: The backend launch endpoint currently creates Hedera tokens
      // For Mantle, we should create pool tokens on-chain using smart contracts
      // TODO: Update backend to support Mantle pool creation
      const response = await fetch(`${apiUrl}/amc-pools/${poolId}/launch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const updatedPool = await response.json();
      console.log('✅ Pool Launched:', updatedPool);

      // Reload pools
      await loadPools();

      toast({
        title: 'Pool Launched Successfully!',
        description: `Pool "${updatedPool.name || poolId}" is now active and ready for investments.`,
        variant: 'default'
      });

    } catch (error) {
      console.error('❌ Pool launch failed:', error);
      toast({
        title: 'Pool Launch Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pool Management</h2>
          <p className="text-muted-foreground">
            Create and manage RWA pools following Centrifuge model
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          AMC Dashboard
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Pool Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Pool
            </CardTitle>
            <CardDescription>
              Create a pool with RWA NFTs and issue fungible pool tokens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="poolName" className="block text-sm font-medium text-gray-300">Pool Name</label>
              <Input
                id="poolName"
                value={formData.poolName}
                onChange={(e) => setFormData(prev => ({ ...prev, poolName: e.target.value }))}
                placeholder="e.g., Commercial Real Estate Pool #1"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="poolDescription" className="block text-sm font-medium text-gray-300">Description</label>
              <textarea
                id="poolDescription"
                value={formData.poolDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, poolDescription: e.target.value }))}
                placeholder="Describe the pool's investment strategy and focus..."
                rows={3}
                className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:border-primary-blue focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="tokenSupply" className="block text-sm font-medium text-gray-300">Token Supply</label>
                <Input
                  id="tokenSupply"
                  type="number"
                  value={formData.tokenSupply}
                  onChange={(e) => setFormData(prev => ({ ...prev, tokenSupply: parseInt(e.target.value) || 0 }))}
                  placeholder="1000000"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="expectedAPY" className="block text-sm font-medium text-gray-300">Expected APY (%)</label>
                <Input
                  id="expectedAPY"
                  type="number"
                  value={formData.expectedAPY}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedAPY: parseFloat(e.target.value) || 0 }))}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="border-t border-gray-600 my-4"></div>

            <div className="space-y-4">
              <h4 className="font-medium">Tranching Structure</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Shield className="h-4 w-4 text-primary-blue" />
                    Senior Tranche
                  </label>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      value={formData.tranches.senior.percentage}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        tranches: {
                          ...prev.tranches,
                          senior: { ...prev.tranches.senior, percentage: parseInt(e.target.value) || 0 }
                        }
                      }))}
                      placeholder="70"
                    />
                    <Input
                      type="number"
                      value={formData.tranches.senior.apy}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        tranches: {
                          ...prev.tranches,
                          senior: { ...prev.tranches.senior, apy: parseFloat(e.target.value) || 0 }
                        }
                      }))}
                      placeholder="8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Junior Tranche
                  </label>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      value={formData.tranches.junior.percentage}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        tranches: {
                          ...prev.tranches,
                          junior: { ...prev.tranches.junior, percentage: parseInt(e.target.value) || 0 }
                        }
                      }))}
                      placeholder="30"
                    />
                    <Input
                      type="number"
                      value={formData.tranches.junior.apy}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        tranches: {
                          ...prev.tranches,
                          junior: { ...prev.tranches.junior, apy: parseFloat(e.target.value) || 0 }
                        }
                      }))}
                      placeholder="15"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCreatePool} 
              disabled={isLoading || formData.selectedNFTs.length === 0}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Pool...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Pool
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Available RWA NFTs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              RWA NFTs
            </CardTitle>
            <CardDescription>
              Select RWA NFTs to include in the pool. Assets already in pools are marked and disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {rwaNFTs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No RWA NFTs available for pooling
                </div>
              ) : (
                rwaNFTs.map((nft) => {
                  const isSelected = formData.selectedNFTs.includes(nft.nftTokenId);
                  const tokenizationAmount = formData.assetTokenizationAmounts[nft.nftTokenId] || 0;
                  const maxInvestableValue = nft.maxInvestableValue || nft.totalValue;
                  const maxInvestablePercentage = nft.maxInvestablePercentage || 100;
                  const isInPool = nft.isInPool || false;
                  
                  return (
                    <div
                      key={nft.nftTokenId}
                      className={`p-3 border rounded-lg transition-colors ${
                        isInPool
                          ? 'border-gray-500 bg-gray-500/10 opacity-60'
                          : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1 flex-1">
                          <h4 className="font-medium">{nft.name}</h4>
                          <p className="text-sm text-muted-foreground">{nft.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              Total: ${nft.totalValue.toLocaleString()}
                            </span>
                            {maxInvestablePercentage < 100 && (
                              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                Max: ${maxInvestableValue.toLocaleString()} ({maxInvestablePercentage}%)
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {nft.expectedAPY}% APY
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{nft.assetType}</Badge>
                          {isInPool && (
                            <Badge variant="destructive" className="text-xs">
                              In Pool
                            </Badge>
                          )}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleNFTSelection(nft.nftTokenId, e.target.checked)}
                            disabled={isInPool}
                            className="rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={(e) => e.stopPropagation()}
                            title={isInPool ? `This asset is already in pool ${nft.poolId?.slice(0, 10)}...` : 'Select asset for pool'}
                          />
                        </div>
                      </div>
                      
                      {/* Tokenization Amount Input (shown when selected) */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <label className="block text-sm font-medium mb-1">
                            Tokenization Amount ($)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max={maxInvestableValue}
                              step="100"
                              value={tokenizationAmount}
                              onChange={(e) => handleTokenizationAmountChange(nft.nftTokenId, parseFloat(e.target.value) || 0)}
                              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder={`Max: $${maxInvestableValue.toLocaleString()}`}
                            />
                            <button
                              type="button"
                              onClick={() => handleTokenizationAmountChange(nft.nftTokenId, maxInvestableValue)}
                              className="px-3 py-2 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              Max
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Maximum investable: ${maxInvestableValue.toLocaleString()} ({maxInvestablePercentage}% of ${nft.totalValue.toLocaleString()})
                          </p>
                          {tokenizationAmount > maxInvestableValue && (
                            <p className="text-xs text-destructive mt-1">
                              ⚠️ Amount exceeds maximum investable value
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {formData.selectedNFTs.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {formData.selectedNFTs.length} NFTs selected
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Total Value: ${poolValue.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Existing Pools */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Pools ({pools.length})</CardTitle>
          <CardDescription>
            Manage your created pools and their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pools.length > 0 ? (
            <div className="space-y-4">
              {pools.map((pool: any) => (
                <div key={pool.poolId || pool._id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <h4 className="font-medium">{pool.name || pool.poolName}</h4>
                      <p className="text-sm text-muted-foreground">{pool.description || pool.poolDescription}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Assets: {(pool.assets?.length || pool.assetNFTs?.length || 0)}</span>
                        <span>Value: ${(pool.totalValue || pool.totalPoolValue || 0).toLocaleString()}</span>
                        <span>APY: {pool.expectedAPY}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{pool.status}</Badge>
                      {pool.status === 'DRAFT' && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleLaunchPool(pool.poolId || pool._id)}
                          disabled={isLoading}
                        >
                          Launch Pool
                        </Button>
                      )}
                      {pool.status === 'ACTIVE' && (
                        <Button size="sm" variant="outline">
                          Manage
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No pools created yet.</p>
              <p className="text-sm mt-2">Create a new pool above to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
