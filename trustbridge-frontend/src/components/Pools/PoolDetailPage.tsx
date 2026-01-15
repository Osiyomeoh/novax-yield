import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Shield,
  BarChart3,
  Info,
  CheckCircle,
  ExternalLink,
  Mail,
  Globe,
  FileText,
  Activity,
  PieChart,
  Award,
  ChevronDown,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
// Card components removed - using direct div styling to match Centrifuge
import Button from '../UI/Button';
import { useToast } from '../../hooks/useToast';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useNavigate } from 'react-router-dom';
import { mantleContractService } from '../../services/mantleContractService';
import { ethers } from 'ethers';
import { getContractAddress } from '../../config/contracts';
import PoolManagerABI from '../../contracts/PoolManager.json';

interface PoolDetail {
  poolId: string;
  name: string;
  description: string;
  status: string;
  totalValue: number;
  tokenPrice: number;
  expectedAPY: number;
  minimumInvestment: number;
  totalInvestors: number;
  assets: Array<{
    assetId: string;
    name: string;
    value: number;
    percentage: number;
    cusip?: string;
    maturityDate?: string;
    tradeDateQuantity?: number;
  }>;
  tranches: {
    senior: { percentage: number; apy: number };
    junior: { percentage: number; apy: number };
  };
  hasTranches?: boolean;
  seniorTrancheId?: string;
  juniorTrancheId?: string;
  mantlePoolId?: string;
  hederaContractId?: string;
  createdAt: string;
  launchedAt?: string;
  metadata?: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    liquidity: 'HIGH' | 'MEDIUM' | 'LOW';
    assetType?: string;
    investorType?: string;
    poolStructure?: string;
    expenseRatio?: number;
    investmentManager?: string;
    fundAdministrator?: string;
    auditor?: string;
    seniorTrancheId?: string;
    juniorTrancheId?: string;
  };
}

interface PoolDetailPageProps {
  poolId: string;
  onBack?: () => void;
}

const PoolDetailPage: React.FC<PoolDetailPageProps> = ({ poolId, onBack }) => {
  const { toast } = useToast();
  const { address, isConnected, signer, provider } = useWallet();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'invest' | 'redeem' | 'pending'>('invest');
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userHoldings, setUserHoldings] = useState(0);
  const [userInvestment, setUserInvestment] = useState(0); // Total TRUST invested
  const [projectedInterest, setProjectedInterest] = useState(0); // Projected annual interest
  const [projectedROI, setProjectedROI] = useState<{
    projected: {
      projectedDividends: number;
      projectedROI: number;
      totalReturn: number;
      totalROI: number;
      projectedAPY: number;
      daysSinceInvestment: number;
    };
    actual: {
      dividendsReceived: number;
      actualROI: number;
    };
  } | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [selectedTranche, setSelectedTranche] = useState<'senior' | 'junior'>('senior');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [investmentTimestamp, setInvestmentTimestamp] = useState<Date | null>(null);
  const [realTimeROI, setRealTimeROI] = useState<{
    projectedDividends: number;
    totalReturn: number;
    totalROI: number;
    projectedAPY: number;
    timeElapsed: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
      totalSeconds: number;
    };
  } | null>(null);
  
  // Generate sample performance data (30 days)
  const performanceData = React.useMemo(() => {
    const days = 30;
    const data = [];
    const basePrice = pool?.tokenPrice || 1.0;
    
    for (let i = 0; i < days; i++) {
      // Simulate price movement with slight upward trend
      const variation = (Math.random() - 0.4) * 0.05; // Small random variation
      const trend = (i / days) * 0.1; // Slight upward trend
      const price = basePrice * (1 + trend + variation);
      data.push({
        day: i,
        price: Math.max(0.95, Math.min(1.15, price)), // Keep within reasonable bounds
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
      });
    }
    return data;
  }, [pool?.tokenPrice]);

  useEffect(() => {
    fetchPoolDetails();
  }, [poolId]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (!isConnected || !address || !pool) return;
    
    setIsRefreshing(true);
    try {
      await fetchUserHoldings();
      await fetchPoolDetails();
      setTimeout(() => {
        calculateOnChainROI();
        setIsRefreshing(false);
      }, 500);
    } catch (error) {
      console.error('Failed to refresh:', error);
      setIsRefreshing(false);
    }
  };

  // Real-time ROI calculation that updates every second
  useEffect(() => {
    if (!pool || !userInvestment || userInvestment === 0) {
      setRealTimeROI(null);
      return;
    }

    // Get investment timestamp - prioritize investmentTimestamp, then projectedROI, then use pool creation
    let investDate: Date;
    if (investmentTimestamp) {
      investDate = investmentTimestamp;
    } else if (projectedROI?.investment?.investedAt) {
      investDate = new Date(projectedROI.investment.investedAt);
      setInvestmentTimestamp(investDate);
    } else if (pool.launchedAt) {
      investDate = new Date(pool.launchedAt);
    } else {
      // Fallback: use current time (for new investments)
      investDate = new Date();
    }

    const apy = pool.expectedAPY || 0;
    if (apy === 0) {
      setRealTimeROI(null);
      return;
    }

    // Calculate real-time ROI every second
    const calculateRealTime = () => {
      const now = new Date();
      const elapsedMs = now.getTime() - investDate.getTime();
      
      if (elapsedMs < 0) {
        setRealTimeROI(null);
        return;
      }

      const totalSeconds = Math.floor(elapsedMs / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      // Calculate days with fractional precision for accurate ROI (includes seconds)
      const daysPrecise = elapsedMs / (1000 * 60 * 60 * 24);

      // Calculate projected dividends: (Investment × APY / 100) × (Days / 365)
      // This accumulates continuously as time passes
      const annualReturn = (userInvestment * apy) / 100;
      const projectedDividends = (annualReturn * daysPrecise) / 365;
      
      // Actual dividends (from projectedROI if available)
      const actualDividends = projectedROI?.actual?.dividendsReceived || 0;
      const totalReturn = actualDividends + projectedDividends;
      
      // Calculate ROI percentages
      const projectedROIPercent = userInvestment > 0 
        ? (projectedDividends / userInvestment) * 100 
        : 0;
      
      const totalROI = userInvestment > 0 
        ? (totalReturn / userInvestment) * 100 
        : 0;

      // Projected APY (annualized) - this will stabilize as time passes
      const projectedAPY = daysPrecise > 0 && userInvestment > 0
        ? (projectedDividends / userInvestment) * (365 / daysPrecise) * 100
        : apy;

      // Cap projected APY at 1.5x expected to prevent unrealistic projections
      const cappedProjectedAPY = Math.min(projectedAPY, apy * 1.5);

      setRealTimeROI({
        projectedDividends,
        totalReturn,
        totalROI,
        projectedAPY: cappedProjectedAPY,
        timeElapsed: {
          days,
          hours,
          minutes,
          seconds,
          totalSeconds
        }
      });
    };

    // Calculate immediately
    calculateRealTime();

    // Update every second for real-time accumulation
    const interval = setInterval(calculateRealTime, 1000);

    return () => clearInterval(interval);
  }, [pool, userInvestment, projectedROI, investmentTimestamp]);

  // Fetch holdings when pool is loaded and wallet is connected
  useEffect(() => {
    if (isConnected && address && pool) {
      // Initial fetch
      const initialFetch = async () => {
        await fetchUserHoldings();
        setTimeout(() => {
          calculateOnChainROI();
        }, 300);
      };
      
      // Small delay to ensure pool state is fully set
      const timer = setTimeout(initialFetch, 500);
      
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      // Set up automatic refresh every 10 seconds
      refreshIntervalRef.current = setInterval(async () => {
        if (isConnected && address && pool) {
          console.log('🔄 Auto-refreshing holdings and ROI...');
          await fetchUserHoldings();
          setTimeout(() => {
            calculateOnChainROI();
          }, 300);
        }
      }, 10000); // Refresh every 10 seconds
      
      return () => {
        clearTimeout(timer);
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    } else {
      // Clear interval when disconnected
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [pool, isConnected, address]);

  const fetchPoolDetails = async () => {
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    try {
      setLoading(true);
      
      // Add timeout safeguard
      loadingTimeout = setTimeout(() => {
        console.warn('⚠️ fetchPoolDetails taking too long, forcing completion');
        setLoading(false);
      }, 15000); // 15 second max
      
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL;
      
      // Try API first with timeout
      let poolData: any = null;
      if (apiUrl && token) {
        try {
          console.log('🔍 Fetching pool from API...');
          const apiPromise = fetch(`${apiUrl}/amc-pools/${poolId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const timeoutPromise = new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('API timeout')), 5000)
          );
          
          const response = await Promise.race([apiPromise, timeoutPromise]);
          
          if (response.ok) {
            poolData = await response.json();
            console.log('✅ Pool data fetched from API');
          } else {
            console.warn(`⚠️ API returned ${response.status}, will try blockchain fallback`);
          }
        } catch (apiError: any) {
          console.warn('⚠️ API call failed, using blockchain fallback:', apiError.message);
          // Continue to blockchain fallback
        }
      } else {
        console.warn('⚠️ API not configured or no token, using blockchain fallback');
      }
      
      // Fallback: Fetch directly from blockchain if API failed or not available
      if (!poolData) {
        console.log('🔍 Fetching pool directly from blockchain...');
        const poolManagerAddress = getContractAddress('POOL_MANAGER');
        const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
          ? poolId
          : ethers.id(poolId);
        
        // Use multiple RPC endpoints with fallback
        const rpcEndpoints = [
          import.meta.env.VITE_MANTLE_TESTNET_RPC_URL,
          'https://mantle-rpc.publicnode.com',
          'https://mantle.drpc.org',
          'https://rpc.sepolia.mantle.xyz',
        ].filter(Boolean);
        
        let readOnlyProvider: ethers.Provider | null = null;
        for (const rpcUrl of rpcEndpoints) {
          try {
            readOnlyProvider = new ethers.JsonRpcProvider(rpcUrl);
            await readOnlyProvider.getBlockNumber();
            console.log(`✅ Connected to RPC: ${rpcUrl}`);
            break;
          } catch (error) {
            console.warn(`⚠️ Failed to connect to ${rpcUrl}`);
          }
        }
        
        if (!readOnlyProvider) {
          throw new Error('Failed to connect to any RPC endpoint');
        }
        
        const poolManagerContract = new ethers.Contract(
          poolManagerAddress,
          ["function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])"],
          readOnlyProvider
        );
        
        const poolInfo = await poolManagerContract.getPool(poolIdBytes32);
        
        // Parse pool data from blockchain
        poolData = {
          poolId: poolId,
          name: poolInfo[2] || poolInfo.name || 'Pool',
          description: poolInfo[3] || poolInfo.description || '',
          status: poolInfo[8] ? 'ACTIVE' : 'INACTIVE',
          totalValue: Number(ethers.formatEther(poolInfo[4] || poolInfo.totalValue || 0n)),
          tokenSupply: Number(ethers.formatEther(poolInfo[5] || poolInfo.totalShares || 0n)),
          tokenPrice: 1.0, // Default
          expectedAPY: 10, // Default
          minimumInvestment: 100,
          totalInvestors: 0,
          assets: [],
          hasTranches: poolInfo[9] || poolInfo.hasTranches || false,
          hederaContractId: poolId,
          mantlePoolId: poolId,
        };
        
        console.log('✅ Pool data fetched from blockchain');
      }

      if (poolData) {
        const data = poolData;
        
        // Fetch tranche IDs from blockchain if not in API response
        let seniorTrancheId = data.seniorTrancheId || data.metadata?.seniorTrancheId;
        let juniorTrancheId = data.juniorTrancheId || data.metadata?.juniorTrancheId;
        const hasTranches = data.hasTranches || data.tranches?.length > 0;
        const onChainPoolId = data.mantlePoolId || data.metadata?.mantlePoolId || data.hederaContractId || poolId;
        
        // If pool has tranches but IDs are missing, fetch from blockchain
        if (hasTranches && onChainPoolId && (!seniorTrancheId || !juniorTrancheId)) {
          try {
            console.log('🔍 Fetching tranche IDs from blockchain...');
            const poolManagerAddress = getContractAddress('POOL_MANAGER');
            const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
              ? onChainPoolId
              : ethers.id(onChainPoolId);
            
            const readOnlyProvider = provider || new ethers.JsonRpcProvider(import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz');
            const poolManagerContract = new ethers.Contract(
              poolManagerAddress,
              ["function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])"],
              readOnlyProvider
            );
            
            const poolInfo = await poolManagerContract.getPool(poolIdBytes32);
            const tranchesArray = poolInfo[12] || poolInfo.tranches || [];
            
            if (tranchesArray.length > 0) {
              // Fetch tranche details to determine which is senior/junior
              for (let i = 0; i < tranchesArray.length; i++) {
                const trancheId = tranchesArray[i];
                try {
                  const getTrancheABI = ["function getTranche(bytes32) external view returns (bytes32,uint8,string,address,uint256,uint256,uint256,uint256,bool)"];
                  const trancheContract = new ethers.Contract(poolManagerAddress, getTrancheABI, readOnlyProvider);
                  const trancheInfo = await trancheContract.getTranche(trancheId);
                  const trancheType = Number(trancheInfo[1] || trancheInfo.trancheType || 0);
                  
                  if (trancheType === 0 && !seniorTrancheId) {
                    seniorTrancheId = trancheId;
                  } else if (trancheType === 1 && !juniorTrancheId) {
                    juniorTrancheId = trancheId;
                  }
                } catch (error) {
                  console.warn(`Failed to fetch tranche ${i} details:`, error);
                  // Fallback: use order (first = senior, second = junior)
                  if (i === 0 && !seniorTrancheId) {
                    seniorTrancheId = trancheId;
                  } else if (i === 1 && !juniorTrancheId) {
                    juniorTrancheId = trancheId;
                  }
                }
              }
              console.log('✅ Fetched tranche IDs from blockchain:', { seniorTrancheId, juniorTrancheId });
            }
          } catch (error) {
            console.warn('Failed to fetch tranche IDs from blockchain:', error);
          }
        }
        
        setPool({
          poolId: data.poolId || data._id,
          name: data.name || data.poolName,
          description: data.description || data.poolDescription,
          status: data.status,
          totalValue: data.totalValue || data.totalPoolValue || 0,
          tokenPrice: data.tokenPrice || (data.totalValue / data.tokenSupply) || 0,
          expectedAPY: data.expectedAPY || 0,
          minimumInvestment: data.minimumInvestment || 100,
          totalInvestors: data.totalInvestors || 0,
          assets: (data.assets || data.assetNFTs || []).map((asset: any) => ({
            assetId: asset.assetId || asset.id,
            name: asset.name || 'Unknown Asset',
            value: asset.value || asset.totalValue || 0,
            percentage: asset.percentage || 0,
            cusip: asset.cusip || asset.assetId || '',
            maturityDate: asset.maturityDate || '-',
            tradeDateQuantity: asset.tradeDateQuantity || asset.value || 0
          })),
          tranches: {
            senior: { percentage: 70, apy: 8 },
            junior: { percentage: 30, apy: 15 }
          },
          hasTranches: hasTranches,
          seniorTrancheId: seniorTrancheId,
          juniorTrancheId: juniorTrancheId,
          mantlePoolId: onChainPoolId,
          hederaContractId: data.hederaContractId || onChainPoolId, // On-chain poolId (bytes32)
          createdAt: data.createdAt,
          launchedAt: data.launchedAt,
          metadata: {
            ...data.metadata,
            riskLevel: data.metadata?.riskLevel || 'MEDIUM',
            liquidity: data.metadata?.liquidity || 'MEDIUM',
            assetType: data.type || 'Real Estate',
            investorType: 'Professional Investors',
            poolStructure: 'Revolving',
            expenseRatio: 0.25,
            investmentManager: data.metadata?.investmentManager || 'TrustBridge Asset Management',
            fundAdministrator: data.metadata?.fundAdministrator || 'TrustBridge Services Ltd',
            auditor: data.metadata?.auditor || 'TrustBridge Audit Partners',
            seniorTrancheId: seniorTrancheId,
            juniorTrancheId: juniorTrancheId
          }
        });
      } else {
        throw new Error('Failed to fetch pool data from both API and blockchain');
      }
    } catch (error: any) {
      console.error('Failed to fetch pool details:', error);
      const errorMessage = error.message || 'Failed to load pool details';
      
      toast({
        title: 'Error Loading Pool',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      setLoading(false);
      console.log('✅ fetchPoolDetails completed, loading set to false');
    }
  };

  const fetchUserHoldings = async () => {
    if (!isConnected || !address || !pool) {
      console.log('⚠️ Cannot fetch holdings: isConnected=', isConnected, 'address=', address, 'pool=', !!pool);
      return;
    }
    
    try {
      console.log('🔍 Fetching user holdings for:', address);
      const poolManagerAddress = getContractAddress('POOL_MANAGER');
      const onChainPoolId = pool.hederaContractId || pool.mantlePoolId;
      
      if (!onChainPoolId || !poolManagerAddress) {
        console.warn('⚠️ Missing pool ID or manager address:', { onChainPoolId, poolManagerAddress });
        setUserHoldings(0);
        return;
      }
      
      const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
        ? onChainPoolId
        : ethers.id(onChainPoolId);
      
      console.log('📋 Pool info:', { poolIdBytes32, hasTranches: pool.hasTranches, seniorTrancheId: pool.seniorTrancheId, juniorTrancheId: pool.juniorTrancheId });
      
      // Create contract instance
      const getUserSharesABI = [
        "function getUserShares(bytes32 _poolId, address _user) external view returns (uint256)",
        "function getUserTrancheShares(bytes32 _trancheId, address _user) external view returns (uint256)",
        "function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])"
      ];
      
      const readOnlyProvider = provider || new ethers.JsonRpcProvider(import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz');
      const poolManagerContract = new ethers.Contract(
        poolManagerAddress,
        getUserSharesABI,
        readOnlyProvider
      );
      
      // First, ALWAYS check on-chain if pool has tranches (more reliable than API state)
      let hasTranchesOnChain = false;
      let tranchesArray: string[] = [];
      
      try {
        console.log('🔍 Checking pool on-chain for tranches...');
        const poolInfo = await poolManagerContract.getPool(poolIdBytes32);
        // getPool returns: (poolId, creator, name, description, totalValue, totalShares, targetValue, minimumInvestment, hasTranches, isActive, createdAt, assets[], tranches[])
        hasTranchesOnChain = poolInfo[8] || poolInfo.hasTranches || false; // Index 8 is hasTranches
        tranchesArray = poolInfo[12] || poolInfo.tranches || [];
        console.log('📊 On-chain pool check:', { 
          hasTranchesOnChain, 
          tranchesCount: tranchesArray.length,
          tranches: tranchesArray.map((t: string) => t.substring(0, 10) + '...')
        });
      } catch (error: any) {
        console.error('❌ Failed to check pool on-chain:', error.message || error);
      }
      
      // Use on-chain data if available, otherwise fall back to pool state
      // If tranches array has items, definitely has tranches
      const actualHasTranches = hasTranchesOnChain || tranchesArray.length > 0 || pool.hasTranches;
      
      console.log('📊 Final decision:', { 
        actualHasTranches, 
        hasTranchesOnChain, 
        tranchesArrayLength: tranchesArray.length,
        poolHasTranches: pool.hasTranches
      });
      
      let totalShares = 0n;
      
      if (actualHasTranches) {
        // For pools with tranches, get shares from each tranche
        // First try to get tranche IDs from pool state
        let seniorTrancheId = pool.seniorTrancheId || pool.metadata?.seniorTrancheId;
        let juniorTrancheId = pool.juniorTrancheId || pool.metadata?.juniorTrancheId;
        
        // If not in state, use the tranchesArray we just fetched
        if ((!seniorTrancheId || !juniorTrancheId) && tranchesArray.length > 0) {
          console.log('⚠️ Tranche IDs not in pool state, using on-chain tranches...');
          console.log('📊 Found tranches on-chain:', tranchesArray.length);
          
          // If we don't have IDs, fetch tranche details to determine senior/junior
          if (tranchesArray.length > 0 && !seniorTrancheId) {
            // Try to determine which is senior by checking tranche type
            for (const trancheId of tranchesArray) {
              try {
                const getTrancheABI = ["function getTranche(bytes32) external view returns (bytes32,uint8,string,address,uint256,uint256,uint256,uint256,bool)"];
                const trancheContract = new ethers.Contract(poolManagerAddress, getTrancheABI, readOnlyProvider);
                const trancheInfo = await trancheContract.getTranche(trancheId);
                const trancheType = Number(trancheInfo[1] || trancheInfo.trancheType || 0);
                
                if (trancheType === 0 && !seniorTrancheId) {
                  seniorTrancheId = trancheId;
                  console.log('✅ Found Senior tranche:', seniorTrancheId);
                } else if (trancheType === 1 && !juniorTrancheId) {
                  juniorTrancheId = trancheId;
                  console.log('✅ Found Junior tranche:', juniorTrancheId);
                }
              } catch (error) {
                console.warn('Failed to check tranche type, using order:', error);
                // Fallback: use order
                if (!seniorTrancheId) {
                  seniorTrancheId = tranchesArray[0];
                  console.log('✅ Using first tranche as Senior (fallback):', seniorTrancheId);
                }
                if (tranchesArray.length > 1 && !juniorTrancheId) {
                  juniorTrancheId = tranchesArray[1];
                  console.log('✅ Using second tranche as Junior (fallback):', juniorTrancheId);
                }
                break; // Exit loop after fallback
              }
            }
            
            // Final fallback: just use order if still not set
            if (!seniorTrancheId && tranchesArray.length > 0) {
              seniorTrancheId = tranchesArray[0];
            }
            if (!juniorTrancheId && tranchesArray.length > 1) {
              juniorTrancheId = tranchesArray[1];
            }
          }
        }
        
        console.log('📊 Checking tranche shares:', { seniorTrancheId, juniorTrancheId });
        
        if (seniorTrancheId) {
          try {
            // Ensure tranche ID is bytes32 format
            const seniorTrancheIdBytes32 = seniorTrancheId.startsWith('0x') && seniorTrancheId.length === 66
              ? seniorTrancheId
              : (seniorTrancheId.startsWith('0x') ? seniorTrancheId : `0x${seniorTrancheId}`);
            
            // If still not 66 chars, hash it
            const finalSeniorId = seniorTrancheIdBytes32.length === 66 
              ? seniorTrancheIdBytes32 
              : ethers.id(seniorTrancheId);
            
            console.log('🔍 Fetching senior tranche shares:', { original: seniorTrancheId, bytes32: finalSeniorId });
            const seniorShares = await poolManagerContract.getUserTrancheShares(finalSeniorId, address);
            const sharesNum = BigInt(seniorShares.toString());
            totalShares += sharesNum;
            console.log('✅ Senior tranche shares:', ethers.formatEther(sharesNum), 'tokens');
          } catch (error: any) {
            console.error('❌ Failed to fetch senior tranche shares:', error.message || error);
          }
        } else {
          console.warn('⚠️ Senior tranche ID not found');
        }
        
        if (juniorTrancheId) {
          try {
            // Ensure tranche ID is bytes32 format
            const juniorTrancheIdBytes32 = juniorTrancheId.startsWith('0x') && juniorTrancheId.length === 66
              ? juniorTrancheId
              : (juniorTrancheId.startsWith('0x') ? juniorTrancheId : `0x${juniorTrancheId}`);
            
            // If still not 66 chars, hash it
            const finalJuniorId = juniorTrancheIdBytes32.length === 66 
              ? juniorTrancheIdBytes32 
              : ethers.id(juniorTrancheId);
            
            console.log('🔍 Fetching junior tranche shares:', { original: juniorTrancheId, bytes32: finalJuniorId });
            const juniorShares = await poolManagerContract.getUserTrancheShares(finalJuniorId, address);
            const sharesNum = BigInt(juniorShares.toString());
            totalShares += sharesNum;
            console.log('✅ Junior tranche shares:', ethers.formatEther(sharesNum), 'tokens');
          } catch (error: any) {
            console.error('❌ Failed to fetch junior tranche shares:', error.message || error);
          }
        } else {
          console.warn('⚠️ Junior tranche ID not found');
        }
        
        console.log('📊 Total shares from all tranches:', ethers.formatEther(totalShares), 'tokens');
      } else {
        // For simple pools, get shares directly
        try {
          console.log('🔍 Fetching simple pool shares...');
          const shares = await poolManagerContract.getUserShares(poolIdBytes32, address);
          totalShares = BigInt(shares.toString());
          console.log('✅ Simple pool shares:', ethers.formatEther(totalShares));
        } catch (error) {
          console.warn('❌ Failed to fetch pool shares:', error);
        }
      }
      
      const sharesFormatted = Number(ethers.formatEther(totalShares));
      setUserHoldings(sharesFormatted);
      
      // Also fetch user investment amount
      const getUserInvestmentABI = [
        "function getUserTrancheInvestment(bytes32 _trancheId, address _user) external view returns (uint256)",
        "function getUserInvestment(bytes32 _poolId, address _user) external view returns (uint256)"
      ];
      
      const poolManagerInvestmentContract = new ethers.Contract(
        poolManagerAddress,
        getUserInvestmentABI,
        readOnlyProvider
      );
      
      let totalInvestment = 0n;
      
      if (pool.hasTranches) {
        const seniorTrancheId = pool.seniorTrancheId || pool.metadata?.seniorTrancheId;
        const juniorTrancheId = pool.juniorTrancheId || pool.metadata?.juniorTrancheId;
        
        if (seniorTrancheId) {
          try {
            const seniorTrancheIdBytes32 = seniorTrancheId.startsWith('0x') && seniorTrancheId.length === 66
              ? seniorTrancheId
              : ethers.id(seniorTrancheId);
            const seniorInvestment = await poolManagerInvestmentContract.getUserTrancheInvestment(seniorTrancheIdBytes32, address);
            totalInvestment += BigInt(seniorInvestment.toString());
          } catch (error) {
            console.warn('Failed to fetch senior tranche investment:', error);
          }
        }
        
        if (juniorTrancheId) {
          try {
            const juniorTrancheIdBytes32 = juniorTrancheId.startsWith('0x') && juniorTrancheId.length === 66
              ? juniorTrancheId
              : ethers.id(juniorTrancheId);
            const juniorInvestment = await poolManagerInvestmentContract.getUserTrancheInvestment(juniorTrancheIdBytes32, address);
            totalInvestment += BigInt(juniorInvestment.toString());
          } catch (error) {
            console.warn('Failed to fetch junior tranche investment:', error);
          }
        }
      } else {
        try {
          const investment = await poolManagerInvestmentContract.getUserInvestment(poolIdBytes32, address);
          totalInvestment = BigInt(investment.toString());
        } catch (error) {
          console.warn('Failed to fetch pool investment:', error);
        }
      }
      
      const investmentFormatted = Number(ethers.formatEther(totalInvestment));
      setUserInvestment(investmentFormatted);
      
      // Calculate projected annual interest based on APY
      if (pool.expectedAPY && investmentFormatted > 0) {
        const annualInterest = (investmentFormatted * pool.expectedAPY) / 100;
        setProjectedInterest(annualInterest);
      } else {
        setProjectedInterest(0);
      }
      
      console.log(`✅ User holdings updated: ${sharesFormatted} tokens, Investment: ${investmentFormatted} TRUST`);
      
      if (totalShares === 0n && totalInvestment === 0n) {
        console.warn('⚠️ No shares or investment found. This might be normal if you just invested and blockchain state hasn\'t updated yet.');
      }
      
      // Recalculate ROI after updating holdings (automatic)
      setTimeout(() => {
        calculateOnChainROI();
      }, 300);
      
      // Trigger a re-render to ensure UI updates
      setUserHoldings(sharesFormatted);
      setUserInvestment(investmentFormatted);
    } catch (error: any) {
      console.error('❌ Failed to fetch user holdings:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data
      });
      setUserHoldings(0);
      setUserInvestment(0);
      setProjectedInterest(0);
      setProjectedROI(null);
    }
  };

  /**
   * Calculate ROI directly from on-chain data
   * No backend dependency - uses blockchain as source of truth
   */
  const calculateOnChainROI = async () => {
    if (!isConnected || !address || !pool) {
      console.log('⚠️ Cannot calculate ROI: missing connection, address, or pool');
      return;
    }
    
    // Need either investment amount or holdings to calculate ROI
    if (userInvestment === 0 && userHoldings === 0) {
      console.log('ℹ️ No investment or holdings found yet, ROI will appear once data is available');
      return;
    }
    
    // Use investment amount if available, otherwise estimate from holdings
    const investmentAmount = userInvestment > 0 
      ? userInvestment 
      : (userHoldings > 0 && pool.tokenPrice > 0 
          ? userHoldings * pool.tokenPrice 
          : 0);
    
    if (investmentAmount === 0) {
      console.log('ℹ️ Cannot calculate ROI: investment amount is 0');
      return;
    }
    
    try {
      console.log('📊 Calculating ROI from on-chain data...');
      
      // Get pool launch date from on-chain or use current date as fallback
      const poolManagerAddress = getContractAddress('POOL_MANAGER');
      const onChainPoolId = pool.hederaContractId || pool.mantlePoolId;
      
      if (!onChainPoolId || !poolManagerAddress) {
        console.warn('⚠️ Missing pool ID or manager address for ROI calculation');
        return;
      }
      
      const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
        ? onChainPoolId
        : ethers.id(onChainPoolId);
      
      const readOnlyProvider = provider || new ethers.JsonRpcProvider(import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz');
      
      // Get pool creation timestamp from contract
      const getPoolABI = [
        "function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])"
      ];
      const poolManagerContract = new ethers.Contract(poolManagerAddress, getPoolABI, readOnlyProvider);
      
      let poolCreatedAt: Date;
      try {
        const poolInfo = await poolManagerContract.getPool(poolIdBytes32);
        // Index 10 is createdAt (uint256 timestamp)
        const createdAtTimestamp = poolInfo[10] || poolInfo.createdAt || 0n;
        poolCreatedAt = createdAtTimestamp > 0n 
          ? new Date(Number(createdAtTimestamp) * 1000)
          : (pool.launchedAt ? new Date(pool.launchedAt) : new Date());
      } catch (error) {
        console.warn('⚠️ Could not fetch pool creation time, using pool launch date');
        poolCreatedAt = pool.launchedAt ? new Date(pool.launchedAt) : new Date();
      }
      
      // Calculate days since investment (use pool creation date as proxy for investment date)
      const now = new Date();
      const daysSinceLaunch = Math.floor(
        (now.getTime() - poolCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLaunch < 0) {
        console.log('ℹ️ Pool not yet launched');
        setProjectedROI(null);
        return;
      }
      
      // Calculate projected ROI based on APY
      const apy = pool.expectedAPY || 0;
      if (apy === 0) {
        console.warn('⚠️ Pool APY is 0, cannot calculate ROI');
        setProjectedROI(null);
        return;
      }
      
      // Calculate projected dividends: (Investment × APY / 100) × (Days / 365)
      const annualReturn = (investmentAmount * apy) / 100;
      const projectedDividends = (annualReturn * daysSinceLaunch) / 365;
      const projectedROIPercent = investmentAmount > 0 
        ? (projectedDividends / investmentAmount) * 100 
        : 0;
      
      // Projected APY (annualized)
      const projectedAPY = daysSinceLaunch > 0 && investmentAmount > 0
        ? (projectedDividends / investmentAmount) * (365 / daysSinceLaunch) * 100
        : apy;
      
      // Cap projected APY at 1.5x expected to prevent unrealistic projections
      const cappedProjectedAPY = Math.min(projectedAPY, apy * 1.5);
      
      // Check dividend distribution events on-chain
      const actualDividends = 0;
      const actualROI = investmentAmount > 0 
        ? (actualDividends / investmentAmount) * 100 
        : 0;
      
      const totalReturn = actualDividends + projectedDividends;
      const totalROI = investmentAmount > 0 
        ? (totalReturn / investmentAmount) * 100 
        : 0;
      
      const roiData = {
        investment: {
          amount: investmentAmount,
          tokens: userHoldings,
          investedAt: poolCreatedAt
        },
        projected: {
          projectedDividends,
          projectedROI: projectedROIPercent,
          totalReturn,
          totalROI,
          projectedAPY: cappedProjectedAPY,
          daysSinceInvestment: daysSinceLaunch
        },
        actual: {
          dividendsReceived: actualDividends,
          actualROI
        }
      };
      
      setProjectedROI(roiData);
      // Set investment timestamp if not already set
      if (!investmentTimestamp && roiData.investment.investedAt) {
        setInvestmentTimestamp(new Date(roiData.investment.investedAt));
      }
      console.log('✅ Calculated ROI from on-chain data:', roiData);
      
    } catch (error) {
      console.error('❌ Error calculating on-chain ROI:', error);
      setProjectedROI(null);
    }
  };

  // Use on-chain calculation instead of backend API
  const fetchProjectedROI = calculateOnChainROI;

  const handleRedeem = async () => {
    if (!isConnected || !address || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to redeem',
        variant: 'destructive'
      });
      return;
    }

    if (!pool) {
      toast({
        title: 'Pool Not Loaded',
        description: 'Please wait for pool data to load',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(redeemAmount);
    if (!amount || amount <= 0 || amount > userHoldings) {
      toast({
        title: 'Invalid Amount',
        description: `Please enter a valid amount between 0 and ${userHoldings.toFixed(2)}`,
        variant: 'destructive'
      });
      return;
    }

    try {
      console.log('🚀 Starting redemption process...');
      console.log('Pool ID:', pool.poolId);
      console.log('Redeem Amount:', amount, 'tokens');

      const poolManagerAddress = getContractAddress('POOL_MANAGER');
      const onChainPoolId = pool.hederaContractId || pool.mantlePoolId;

      if (!onChainPoolId || !poolManagerAddress) {
        throw new Error('Pool not found on-chain');
      }

      const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
        ? onChainPoolId
        : ethers.id(onChainPoolId);

      const amountInWei = ethers.parseEther(amount.toString());

      // Create contract instance
      const poolManagerContract = new ethers.Contract(
        poolManagerAddress,
        PoolManagerABI,
        signer
      );

      let redeemTx;
      let redeemTxHash: string;

      if (pool.hasTranches) {
        // For pools with tranches, need to determine which tranche to redeem from
        const trancheIdToUse = selectedTranche === 'senior'
          ? (pool.seniorTrancheId || pool.metadata?.seniorTrancheId)
          : (pool.juniorTrancheId || pool.metadata?.juniorTrancheId);

        if (!trancheIdToUse) {
          throw new Error(`${selectedTranche} tranche ID not found. Please refresh the page.`);
        }

        const trancheIdBytes32 = trancheIdToUse.startsWith('0x')
          ? trancheIdToUse
          : `0x${trancheIdToUse}`;

        console.log('Redeeming from tranche:', trancheIdBytes32);
        redeemTx = await poolManagerContract.redeemTrancheTokens(
          poolIdBytes32,
          trancheIdBytes32,
          amountInWei
        );
      } else {
        // For simple pools
        console.log('Redeeming from simple pool...');
        redeemTx = await poolManagerContract.redeemPoolTokens(
          poolIdBytes32,
          amountInWei
        );
      }

      const redeemReceipt = await redeemTx.wait();
      redeemTxHash = redeemReceipt.hash;

      console.log('✅ Redemption successful! Transaction hash:', redeemTxHash);

      toast({
        title: 'Redemption Successful',
        description: `Successfully redeemed ${amount} tokens. Transaction: ${redeemTxHash.substring(0, 10)}...`,
        variant: 'default'
      });

      // Wait for blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh holdings and ROI
      await fetchUserHoldings();
      setTimeout(() => {
        calculateOnChainROI();
      }, 500);

      // Reset form
      setRedeemAmount('');

    } catch (error: any) {
      console.error('Redemption failed:', error);
      toast({
        title: 'Redemption Failed',
        description: error.message || 'Failed to redeem tokens. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleInvest = async () => {
    if (!isConnected || !address || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to invest',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(investmentAmount);
    if (!amount || amount < pool!.minimumInvestment) {
      toast({
        title: 'Invalid Amount',
        description: `Minimum investment is $${pool!.minimumInvestment}`,
        variant: 'destructive'
      });
      return;
    }

    try {
      // Initialize contract service
      if (provider) {
        mantleContractService.initialize(signer, provider);
      } else {
        throw new Error('Provider not available');
      }

      toast({
        title: 'Processing Investment',
        description: 'Please approve the transaction in your wallet...',
        variant: 'default'
      });

      // Step 1: Approve TRUST tokens for PoolManager
      const poolManagerAddress = getContractAddress('POOL_MANAGER');
      const trustTokenAddress = getContractAddress('TRUST_TOKEN');
      const amountInWei = ethers.parseEther(amount.toString());

      console.log('Approving TRUST tokens...');
      const approveTxHash = await mantleContractService.approveTrust(poolManagerAddress, amountInWei);
      console.log('TRUST tokens approved:', approveTxHash);

      // Step 2: Verify pool exists on-chain and get pool details
      // Get the on-chain poolId (bytes32) - stored in hederaContractId or mantlePoolId
      const onChainPoolId = pool!.hederaContractId || pool!.mantlePoolId;
      if (!onChainPoolId) {
        console.error('Pool data:', {
          poolId: pool!.poolId,
          status: pool!.status,
          hederaContractId: pool!.hederaContractId,
          mantlePoolId: pool!.mantlePoolId,
          launchedAt: pool!.launchedAt
        });
        toast({
          title: 'Pool Not Launched',
          description: `This pool (${pool!.name}) has not been launched on-chain yet. Status: ${pool!.status}. Please launch it from the Pool Management dashboard (AMC Dashboard > Pool Management) before investing.`,
          variant: 'destructive'
        });
        throw new Error(`Pool has not been launched on-chain yet. Status: ${pool!.status}. Please launch the pool first from Pool Management.`);
      }
      
      // The on-chain poolId should already be bytes32 format (0x...)
      const poolIdBytes32 = onChainPoolId.startsWith('0x') 
        ? onChainPoolId 
        : `0x${onChainPoolId}`;
      
      console.log('On-chain poolId:', poolIdBytes32);
      
      // Define the function ABIs we need
      const getPoolABI = [
        "function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])"
      ];
      const getTrancheABI = [
        "function getTranche(bytes32) external view returns (bytes32,uint8,string,address,uint256,uint256,uint256,uint256,bool)"
      ];
      const investInPoolABI = [
        "function investInPool(bytes32 _poolId, uint256 _amount) external"
      ];
      const investInTrancheABI = [
        "function investInTranche(bytes32 _poolId, bytes32 _trancheId, uint256 _amount) external",
        "event TrancheTokenIssued(bytes32 indexed poolId, bytes32 indexed trancheId, address indexed investor, uint256 amount)"
      ];
      
      // Create PoolManager contract instance with the correct ABI
      const poolManagerContract = new ethers.Contract(
        poolManagerAddress,
        [...getPoolABI, ...getTrancheABI, ...investInPoolABI, ...investInTrancheABI],
        signer
      );
      
      // Also create read-only contract for fetching tranche info (use provider from signer or create new one)
      const readOnlyProvider = signer?.provider || provider || new ethers.JsonRpcProvider(import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz');
      const poolManagerReadOnly = new ethers.Contract(
        poolManagerAddress,
        [...getPoolABI, ...getTrancheABI],
        readOnlyProvider
      );
      
      // Verify pool exists on-chain
      console.log('Verifying pool exists on-chain...');
      let onChainPool: any;
      let hasTranches = false;
      let seniorTrancheId: string | undefined;
      let juniorTrancheId: string | undefined;
      let tranchesArray: string[] = [];
      
      try {
        onChainPool = await poolManagerContract.getPool(poolIdBytes32);
        console.log('Raw on-chain pool data:', onChainPool);
        
        // Check if pool exists (poolId should not be zero hash)
        const returnedPoolId = onChainPool[0] || onChainPool.poolId;
        const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        if (!returnedPoolId || returnedPoolId === ethers.ZeroHash || returnedPoolId === zeroHash || returnedPoolId === '0x') {
          throw new Error(`Pool not found on-chain. Returned poolId: ${returnedPoolId}`);
        }
        
        // Extract pool data (getPool returns a tuple)
        const poolId = onChainPool[0] || returnedPoolId;
        const creator = onChainPool[1] || onChainPool.creator;
        const name = onChainPool[2] || onChainPool.name;
        const isActive = onChainPool[8] || onChainPool.isActive;
        hasTranches = onChainPool[9] === true || onChainPool.hasTranches === true;
        
        // Extract tranches array (index 12 in the tuple)
        tranchesArray = Array.isArray(onChainPool[12]) ? onChainPool[12] : (Array.isArray(onChainPool.tranches) ? onChainPool.tranches : []);
        
        console.log('✅ Pool verified on-chain:', {
          poolId: poolId,
          name: name,
          creator: creator,
          hasTranches: hasTranches,
          isActive: isActive,
          tranchesCount: Array.isArray(tranchesArray) ? tranchesArray.length : 0
        });
        
        if (!isActive) {
          throw new Error('Pool exists but is not active');
        }
        
        // If pool has tranches, fetch tranche IDs
        if (hasTranches && Array.isArray(tranchesArray) && tranchesArray.length > 0) {
          console.log('Fetching tranche details...', { tranchesCount: tranchesArray.length });
          
          // Fetch each tranche to determine which is senior and which is junior
          for (let i = 0; i < tranchesArray.length; i++) {
            const trancheId = tranchesArray[i];
            try {
              const trancheInfo = await poolManagerReadOnly.getTranche(trancheId);
              console.log(`Tranche ${i} (${trancheId.substring(0, 10)}...):`, trancheInfo);
              
              // getTranche returns: (bytes32, uint8, string, address, uint256, uint256, uint256, uint256, bool)
              // Index 1 is trancheType: 0 = SENIOR, 1 = JUNIOR
              let trancheTypeRaw = trancheInfo[1];
              if (trancheTypeRaw === undefined && trancheInfo.trancheType !== undefined) {
                trancheTypeRaw = trancheInfo.trancheType;
              }
              
              const trancheType = typeof trancheTypeRaw === 'bigint' 
                ? Number(trancheTypeRaw) 
                : (typeof trancheTypeRaw === 'number' 
                  ? trancheTypeRaw 
                  : Number(trancheTypeRaw || 0));
              
              // Also check the name field (index 2) - "Senior" or "Junior"
              const trancheName = trancheInfo[2] || trancheInfo.name || '';
              
              console.log(`Tranche ${i}: id=${trancheId.substring(0, 10)}..., type=${trancheType} (raw: ${trancheTypeRaw}), name="${trancheName}"`);
              
              // Determine tranche type from both enum value and name
              const isSenior = trancheType === 0 || trancheName.toLowerCase().includes('senior');
              const isJunior = trancheType === 1 || trancheName.toLowerCase().includes('junior');
              
              if (isSenior && !seniorTrancheId) {
                seniorTrancheId = trancheId;
                console.log('✅ Found Senior Tranche ID:', seniorTrancheId);
              } else if (isJunior && !juniorTrancheId) {
                juniorTrancheId = trancheId;
                console.log('✅ Found Junior Tranche ID:', juniorTrancheId);
              } else if (isSenior && seniorTrancheId) {
                console.warn(`Multiple senior tranches found! Keeping first: ${seniorTrancheId}, ignoring: ${trancheId}`);
              } else if (isJunior && juniorTrancheId) {
                console.warn(`Multiple junior tranches found! Keeping first: ${juniorTrancheId}, ignoring: ${trancheId}`);
              } else {
                // Fallback: use order (first = senior, second = junior) if type detection fails
                if (i === 0 && !seniorTrancheId) {
                  seniorTrancheId = trancheId;
                  console.log('⚠️ Using first tranche as Senior (fallback):', seniorTrancheId);
                } else if (i === 1 && !juniorTrancheId) {
                  juniorTrancheId = trancheId;
                  console.log('⚠️ Using second tranche as Junior (fallback):', juniorTrancheId);
                } else {
                  console.warn(`Could not determine tranche type for ${trancheId}: type=${trancheType}, name="${trancheName}"`);
                }
              }
            } catch (trancheError) {
              console.warn(`Failed to fetch tranche ${trancheId}:`, trancheError);
            }
          }
          
          console.log('Final tranche IDs after type detection:', { seniorTrancheId, juniorTrancheId });
          
          // If we still don't have both, use fallback: order-based assignment
          // First tranche = Senior, Second tranche = Junior (this matches contract creation order)
          if (!seniorTrancheId && tranchesArray.length > 0) {
            seniorTrancheId = tranchesArray[0];
            console.log('⚠️ Fallback: Using first tranche as Senior (by order):', seniorTrancheId);
          }
          if (!juniorTrancheId && tranchesArray.length > 1) {
            juniorTrancheId = tranchesArray[1];
            console.log('⚠️ Fallback: Using second tranche as Junior (by order):', juniorTrancheId);
          } else if (!juniorTrancheId && tranchesArray.length === 1 && seniorTrancheId === tranchesArray[0]) {
            // Edge case: only one tranche found, but we need both
            console.warn('⚠️ Only one tranche found, cannot determine junior tranche');
          }
          
          console.log('Final tranche IDs (with fallbacks):', { seniorTrancheId, juniorTrancheId });
          
          // Update pool state with tranche IDs if found
          if (seniorTrancheId || juniorTrancheId) {
            setPool(prevPool => {
              if (!prevPool) return prevPool;
              return {
                ...prevPool,
                seniorTrancheId: seniorTrancheId || prevPool.seniorTrancheId,
                juniorTrancheId: juniorTrancheId || prevPool.juniorTrancheId,
                metadata: {
                  ...prevPool.metadata,
                  seniorTrancheId: seniorTrancheId || prevPool.metadata?.seniorTrancheId,
                  juniorTrancheId: juniorTrancheId || prevPool.metadata?.juniorTrancheId,
                }
              };
            });
            console.log('Updated pool with tranche IDs:', { seniorTrancheId, juniorTrancheId });
          }
        }
      } catch (verifyError: any) {
        console.error('❌ Pool verification failed:', verifyError);
        console.error('PoolId being checked:', poolIdBytes32);
        console.error('Full error:', verifyError);
        
        // Check if it's a revert error or zero hash (pool doesn't exist)
        if (verifyError.reason || verifyError.data || verifyError.message?.includes('revert') || verifyError.message?.includes('zero hash') || verifyError.message?.includes('Pool not found')) {
          toast({
            title: 'Pool Not Found On-Chain',
            description: `This pool exists in the database but does not exist on-chain. This usually happens if the pool was created before on-chain creation was implemented, or if the creation transaction failed. Please delete this pool and create a new one from the Pool Management dashboard. Pool ID: ${poolIdBytes32.slice(0, 16)}...`,
            variant: 'destructive',
            duration: 15000
          });
          throw new Error(`Pool not found on-chain. Please delete this pool from the database and create a new one. Error: ${verifyError.reason || verifyError.message}`);
        }
        
        toast({
          title: 'Pool Verification Failed',
          description: `Failed to verify pool on-chain: ${verifyError.message}. Please check your connection and try again.`,
          variant: 'destructive',
          duration: 10000
        });
        throw verifyError;
      }
      
      // Step 3: Invest in pool or tranche (hasTranches is already set above)
      let investTxHash: string;
      
      if (hasTranches) {
        // Pool has tranches - MUST use investInTranche
        console.log(`Investing in ${selectedTranche} tranche...`);
        
        // Get tranche ID - prefer the ones we just fetched from on-chain
        // Also try extracting from tranches array if needed
        let trancheIdToUse = selectedTranche === 'senior' 
          ? (seniorTrancheId || pool!.seniorTrancheId || pool!.metadata?.seniorTrancheId)
          : (juniorTrancheId || pool!.juniorTrancheId || pool!.metadata?.juniorTrancheId);
        
        // Fallback: if still not found and we have tranches array, use order (first = senior, second = junior)
        if (!trancheIdToUse && hasTranches && Array.isArray(tranchesArray) && tranchesArray.length > 0) {
          if (selectedTranche === 'senior' && tranchesArray.length > 0) {
            trancheIdToUse = tranchesArray[0];
            console.log('⚠️ Fallback: Using first tranche as Senior:', trancheIdToUse);
          } else if (selectedTranche === 'junior' && tranchesArray.length > 1) {
            trancheIdToUse = tranchesArray[1];
            console.log('⚠️ Fallback: Using second tranche as Junior:', trancheIdToUse);
          }
        }
        
        if (!trancheIdToUse) {
          throw new Error(`${selectedTranche} tranche ID not found in pool data. Pool has tranches but tranche IDs are missing. Found tranches: ${tranchesArray?.length || 0}. Please refresh the page to reload pool data.`);
        }
        
        const trancheIdBytes32 = trancheIdToUse.startsWith('0x') 
          ? trancheIdToUse 
          : `0x${trancheIdToUse}`;
        
        console.log('On-chain poolId:', poolIdBytes32);
        console.log(`${selectedTranche} Tranche ID:`, trancheIdBytes32);
        
        const investTx = await poolManagerContract.investInTranche(
          poolIdBytes32,
          trancheIdBytes32,
          amountInWei
        );
        const investReceipt = await investTx.wait();
        investTxHash = investReceipt.hash;
        
        // Extract tranche ID from event if available
        const trancheTokenIssuedEvent = investReceipt.logs.find((log: any) => {
          try {
            const parsed = poolManagerContract.interface.parseLog(log);
            return parsed && parsed.name === 'TrancheTokenIssued';
          } catch {
            return false;
          }
        });
        
        if (trancheTokenIssuedEvent) {
          const parsed = poolManagerContract.interface.parseLog(trancheTokenIssuedEvent);
          const eventTrancheId = parsed?.args[1]; // trancheId from event
          console.log('✅ Investment event found, tranche ID:', eventTrancheId);
          
          // Update pool state with tranche ID if not already set
          if (selectedTranche === 'senior' && !pool.seniorTrancheId) {
            setPool(prevPool => prevPool ? { ...prevPool, seniorTrancheId: eventTrancheId } : prevPool);
          } else if (selectedTranche === 'junior' && !pool.juniorTrancheId) {
            setPool(prevPool => prevPool ? { ...prevPool, juniorTrancheId: eventTrancheId } : prevPool);
          }
        }
      } else {
        // Simple pool without tranches - use investInPool
        console.log('Investing in pool (no tranches)...');
        
        const investTx = await poolManagerContract.investInPool(
          poolIdBytes32,
          amountInWei
        );
        const investReceipt = await investTx.wait();
        investTxHash = investReceipt.hash;
      }

      console.log('Investment transaction hash:', investTxHash);

      // Step 3: Wait for transaction confirmation and update UI
      // The contract has already updated shares on-chain, so we just need to refresh
      
      // Set investment timestamp for real-time ROI calculation
      setInvestmentTimestamp(new Date());
      
      // Wait a moment for blockchain state to update
      console.log('⏳ Waiting for blockchain state to update...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh user holdings immediately
      console.log('🔄 Refreshing user holdings...');
      await fetchUserHoldings();
      await fetchProjectedROI();
      
      // Also refresh pool details to get updated totals
      await fetchPoolDetails();

      // Step 4: Record investment in backend (optional - blockchain is source of truth)
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(`${apiUrl}/amc-pools/${poolId}/invest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          trancheType: selectedTranche === 'senior' ? 'SENIOR' : 'JUNIOR',
          transactionHash: investTxHash
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to record investment');
      }

      toast({
        title: 'Investment Successful',
        description: `Successfully invested ${amount} TRUST tokens in ${selectedTranche} tranche`,
        variant: 'default'
      });

      // Set investment timestamp for real-time ROI calculation
      setInvestmentTimestamp(new Date());
      
      // Reset form and refresh data
      setInvestmentAmount('');
      
      // Wait for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh all data
      await fetchPoolDetails();
      if (isConnected && address) {
        await fetchUserHoldings();
        setTimeout(() => {
          calculateOnChainROI();
        }, 500);
      }
      
      // Set up retry mechanism for blockchain state updates
      let refreshAttempts = 0;
      const maxAttempts = 5;
      const retryInterval = setInterval(async () => {
        refreshAttempts++;
        console.log(`🔄 Retry ${refreshAttempts}/${maxAttempts}: Checking for updated holdings...`);
        if (isConnected && address) {
          await fetchUserHoldings();
          setTimeout(() => {
            calculateOnChainROI();
          }, 300);
        }
        
        if (refreshAttempts >= maxAttempts) {
          clearInterval(retryInterval);
        }
      }, 3000);
    } catch (error: any) {
      console.error('Investment failed:', error);
      toast({
        title: 'Investment Failed',
        description: error.message || 'Failed to process investment. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Pool not found</p>
          <Button onClick={onBack || (() => navigate(-1))}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Generate pool token symbol (e.g., "JTRSY" from pool name)
  const poolTokenSymbol = pool.name
    .split(' ')
    .map(word => word.substring(0, 1).toUpperCase())
    .join('')
    .substring(0, 5) || 'POOL';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Centrifuge Style */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Logo and Wallet */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-gray-900">TrustBridge</span>
            </div>
            {address && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Your current holdings in {pool.name}</p>
                  <p className="text-sm font-semibold text-gray-900">{userHoldings.toFixed(2)} {poolTokenSymbol}</p>
                  {projectedROI && projectedROI.projected.totalROI > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      ROI: +{projectedROI.projected.totalROI.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Bottom Row: Back Arrow and Pool Name */}
          <div className="flex items-center gap-4 pb-4">
            <button
              onClick={onBack || (() => navigate(-1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{pool.name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Key Facts (Centrifuge Style) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Metrics - Centrifuge Style */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">TVL (USD)</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${pool.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">Token price (USD)</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${pool.tokenPrice.toFixed(6)}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">APY</p>
                <p className="text-2xl font-bold text-blue-600">
                  {pool.expectedAPY}%
                </p>
              </div>
            </div>

            {/* Performance Chart - Centrifuge Style */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Performance</h3>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span className="text-sm text-gray-600">Token price</span>
                  <span className="text-sm font-medium text-gray-900">{pool.tokenPrice.toFixed(6)}</span>
                </div>
              </div>
              <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 p-4">
                {performanceData.length > 0 && (() => {
                  const minPrice = Math.min(...performanceData.map(d => d.price));
                  const maxPrice = Math.max(...performanceData.map(d => d.price));
                  const priceRange = maxPrice - minPrice || 0.1; // Avoid division by zero
                  const chartHeight = 200;
                  const chartWidth = 600;
                  
                  return (
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="w-full h-full"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#FCD34D" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line
                          key={`grid-${i}`}
                          x1="0"
                          y1={20 + i * 40}
                          x2={chartWidth}
                          y2={20 + i * 40}
                          stroke="#E5E7EB"
                          strokeWidth="1"
                          strokeDasharray="2,2"
                        />
                      ))}
                      
                      {/* Price area fill */}
                      <path
                        d={`M 0 ${chartHeight - ((performanceData[0].price - minPrice) / priceRange) * (chartHeight - 40) - 20} ${performanceData.map((point, index) => {
                          const x = (index / (performanceData.length - 1)) * chartWidth;
                          const y = chartHeight - ((point.price - minPrice) / priceRange) * (chartHeight - 40) - 20;
                          return `L ${x} ${y}`;
                        }).join(' ')} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                        fill="url(#priceGradient)"
                      />
                      
                      {/* Price line */}
                      <path
                        d={`M ${performanceData.map((point, index) => {
                          const x = (index / (performanceData.length - 1)) * chartWidth;
                          const y = chartHeight - ((point.price - minPrice) / priceRange) * (chartHeight - 40) - 20;
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')}`}
                        fill="none"
                        stroke="#FCD34D"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      
                      {/* Current price point */}
                      {(() => {
                        const lastPoint = performanceData[performanceData.length - 1];
                        const x = chartWidth;
                        const y = chartHeight - ((lastPoint.price - minPrice) / priceRange) * (chartHeight - 40) - 20;
                        return (
                          <circle
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#FCD34D"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                        );
                      })()}
                    </svg>
                  );
                })()}
                
                {/* X-axis labels */}
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            </div>

            {/* Overview Section - Centrifuge Style */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Overview</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Asset type</p>
                    <p className="font-medium text-gray-900">
                      {pool.metadata?.assetType === 'Real Estate' 
                        ? 'Real Estate - Tokenized Property Assets'
                        : pool.metadata?.assetType === 'Public Credit'
                        ? 'Public Credit - AAA-rated Collateralized Loan Obligations'
                        : `${pool.metadata?.assetType || 'Real Estate'} - Tokenized Assets`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">APY</p>
                    <p className="font-medium text-gray-900">{pool.expectedAPY}% target</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Average asset maturity</p>
                    <p className="font-medium text-gray-900">target</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Min. investment</p>
                    <p className="font-medium text-gray-900">${pool.minimumInvestment.toLocaleString()} USD</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Investor type</p>
                    <p className="font-medium text-gray-900">{pool.metadata?.investorType || 'Non-US Professional Investors'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Available networks</p>
                    <div className="flex gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center" title="Ethereum">
                        <span className="text-xs text-white font-bold">E</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center" title="Arbitrum">
                        <span className="text-xs text-white font-bold">A</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center" title="Polygon">
                        <span className="text-xs text-white font-bold">P</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pool structure</p>
                    <p className="font-medium text-gray-900">{pool.metadata?.poolStructure || 'Revolving'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Rating</p>
                    <div className="flex gap-2 mt-1">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-300">
                        <span className="text-xs font-semibold text-gray-700">AAA</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Expense ratio</p>
                    <p className="font-medium text-gray-900">{pool.metadata?.expenseRatio || 0.50}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Facts - Centrifuge Style */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Key facts</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center border border-gray-200">
                    <Award className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">TrustBridge Pool Management</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Globe className="w-4 h-4 mr-2" />
                    Website
                  </Button>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Forum
                  </Button>
                  <Button variant="outline" size="sm">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Summary
                  </Button>
                </div>
                <div className="pt-2">
                  <p className="text-sm font-medium text-gray-900">TrustBridge Pool Management</p>
                </div>
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <p className="text-sm text-gray-600 mb-3">Fund Description</p>
                  <p className="text-gray-900 leading-relaxed">
                    {pool.description || `${pool.name} (the Fund) is a tokenized investment pool, open to Professional Investors. It invests in and holds real-world assets (RWA) to offer stable returns with minimized risk in combination with liquidity and market returns. Assets are held directly by the Fund and Asset Under Management (AUM) can be checked onchain. The fund issues its shares as pool tokens to investors. Investments and redemptions are processed in TRUST tokens.`}
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">Associated Entities</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Investment Manager:</span>
                      <span className="text-gray-900 font-medium">{pool.metadata?.investmentManager || 'TrustBridge Asset Management'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fund Administrator:</span>
                      <span className="text-gray-900 font-medium">{pool.metadata?.fundAdministrator || 'TrustBridge Services Ltd'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Auditor:</span>
                      <span className="text-gray-900 font-medium">{pool.metadata?.auditor || 'TrustBridge Audit Partners'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Holdings - Centrifuge Style */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Holdings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Holdings shown are the approximate market value of invested assets only and do not reflect the total NAV of the pool.
              </p>
              <div>
                {pool.assets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Cusip</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Market Value (Position CCY)</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Trade Date Quantity</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Maturity Date</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">% of Portfolio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pool.assets.map((asset, index) => (
                          <tr key={asset.assetId || index} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-sm text-gray-900">{asset.cusip || asset.assetId || `ASSET${index + 1}`}</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-900">
                              ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-900">
                              ${(asset.tradeDateQuantity || asset.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600">{asset.maturityDate || '-'}</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600">
                              {asset.percentage.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50" disabled>
                        ← Previous
                      </button>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">1</button>
                        <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900">2</button>
                      </div>
                      <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900">
                        Next →
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No assets in pool yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Investment Panel (All Sections Visible) */}
          <div className="space-y-6">
            {/* Invest Section */}
            <div className="bg-white border border-gray-100 rounded-lg p-6 sticky top-4 shadow-sm">
              <div className="flex gap-2 border-b border-gray-200 pb-4 mb-6">
                <button
                  onClick={() => setActiveTab('invest')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'invest'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Invest
                </button>
                <button
                  onClick={() => setActiveTab('redeem')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'redeem'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Redeem
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'pending'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pending
                </button>
              </div>

              {/* Tab Content - Switchable */}
              <div>
                {activeTab === 'invest' && (
                  <div className="space-y-4">
                    {/* Tranche Selection */}
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">Select Tranche</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSelectedTranche('senior')}
                        type="button"
                        data-tranche-button="true"
                        className={`p-4 rounded-lg border transition-all text-left focus:outline-none ${
                          selectedTranche === 'senior'
                            ? 'border-blue-400'
                            : 'border-gray-200'
                        }`}
                        style={{ 
                          backgroundColor: 'white',
                          color: '#111827'
                        } as React.CSSProperties}
                      >
                        <p className="text-sm font-medium text-gray-900">Senior</p>
                        <p className="text-xs text-gray-600 mt-1">{pool.tranches.senior.apy}% APY</p>
                        <p className="text-xs text-gray-500 mt-1">{pool.tranches.senior.percentage}% allocation</p>
                      </button>
                      <button
                        onClick={() => setSelectedTranche('junior')}
                        type="button"
                        data-tranche-button="true"
                        className={`p-4 rounded-lg border transition-all text-left focus:outline-none ${
                          selectedTranche === 'junior'
                            ? 'border-blue-400'
                            : 'border-gray-200'
                        }`}
                        style={{ 
                          backgroundColor: 'white',
                          color: '#111827'
                        } as React.CSSProperties}
                      >
                        <p className="text-sm font-medium text-gray-900">Junior</p>
                        <p className="text-xs text-gray-600 mt-1">{pool.tranches.junior.apy}% APY</p>
                        <p className="text-xs text-gray-500 mt-1">{pool.tranches.junior.percentage}% allocation</p>
                      </button>
                    </div>
                    </div>

                    {/* Investment Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Investment Amount (TRUST)
                      </label>
                      <input
                        type="number"
                        value={investmentAmount}
                        onChange={(e) => setInvestmentAmount(e.target.value)}
                        placeholder={`Min: $${pool.minimumInvestment.toLocaleString()}`}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum investment: ${pool.minimumInvestment.toLocaleString()} TRUST
                      </p>
                    </div>

                    <Button
                      onClick={handleInvest}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium py-3 text-base"
                      disabled={!isConnected}
                    >
                      Invest
                    </Button>
                  </div>
                )}

                {activeTab === 'redeem' && (
                  <div className="space-y-4">
                    {/* Current Holdings */}
                    {userHoldings > 0 ? (
                      <>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Your Holdings</span>
                            <span className="text-sm font-semibold text-gray-900">{userHoldings.toFixed(2)} {poolTokenSymbol}</span>
                          </div>
                          {(userInvestment > 0 || userHoldings > 0) && (
                            <>
                              {userInvestment > 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                  <span className="text-sm text-gray-600">Total Invested</span>
                                  <span className="text-sm font-semibold text-gray-900">{userInvestment.toFixed(2)} TRUST</span>
                                </div>
                              )}
                              
                              {/* Real-time ROI Display */}
                              {(realTimeROI || projectedROI) && (
                                <>
                                  <div className="pt-2 border-t border-gray-200 space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Actual Dividends Received</span>
                                      <span className="text-sm font-semibold text-blue-600">+{(projectedROI?.actual?.dividendsReceived || 0).toFixed(2)} TRUST</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Projected Dividends</span>
                                      <span className="text-sm font-semibold text-green-600 animate-pulse">
                                        +{(realTimeROI?.projectedDividends || projectedROI?.projected?.projectedDividends || 0).toFixed(2)} TRUST
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium text-gray-700">Total Return</span>
                                      <span className="text-sm font-bold text-green-600">
                                        +{(realTimeROI?.totalReturn || projectedROI?.projected?.totalReturn || 0).toFixed(2)} TRUST
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                                      <span className="text-sm font-medium text-gray-700">Total ROI</span>
                                      <span className={`text-sm font-bold ${(realTimeROI?.totalROI || projectedROI?.projected?.totalROI || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(realTimeROI?.totalROI || projectedROI?.projected?.totalROI || 0) >= 0 ? '+' : ''}
                                        {(realTimeROI?.totalROI || projectedROI?.projected?.totalROI || 0).toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-500">Projected APY</span>
                                      <span className="text-xs text-gray-500">{(realTimeROI?.projectedAPY || projectedROI?.projected?.projectedAPY || 0).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-500">Time Since Investment</span>
                                      <span className="text-xs text-gray-500 font-mono">
                                        {realTimeROI?.timeElapsed ? (
                                          <>
                                            {realTimeROI.timeElapsed.days > 0 && `${realTimeROI.timeElapsed.days}d `}
                                            {realTimeROI.timeElapsed.hours > 0 && `${realTimeROI.timeElapsed.hours}h `}
                                            {realTimeROI.timeElapsed.minutes > 0 && `${realTimeROI.timeElapsed.minutes}m `}
                                            {realTimeROI.timeElapsed.seconds}s
                                          </>
                                        ) : (
                                          `${projectedROI?.projected?.daysSinceInvestment || 0} days`
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500">
                                      💡 Projected dividends are calculated based on the pool's APY ({pool.expectedAPY}%) and time elapsed. Actual dividends are distributed when assets generate revenue.
                                    </p>
                                  </div>
                                </>
                              )}
                              
                              {/* Fallback to manual calculation if API data not available */}
                              {!projectedROI && (projectedInterest > 0 || (userInvestment > 0 && pool.expectedAPY > 0)) && (
                                <>
                                  <div className="pt-2 border-t border-gray-200 space-y-2">
                                    {userInvestment > 0 && (
                                      <>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">Actual Dividends Received</span>
                                          <span className="text-sm font-semibold text-blue-600">+0.00 TRUST</span>
                                        </div>
                                        {projectedInterest > 0 ? (
                                          <>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Projected Annual Interest</span>
                                              <span className="text-sm font-semibold text-green-600">+{projectedInterest.toFixed(2)} TRUST</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Projected Monthly</span>
                                              <span className="text-sm font-semibold text-green-600">+{(projectedInterest / 12).toFixed(2)} TRUST</span>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Projected Dividends</span>
                                            <span className="text-sm font-semibold text-green-600">Calculating...</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    <div className="pt-2 border-t border-gray-200">
                                      <p className="text-xs text-gray-500">
                                        💡 {projectedInterest > 0 
                                          ? `Interest is calculated based on the pool's expected APY (${pool.expectedAPY}%) and is distributed when assets generate revenue.`
                                          : `ROI is calculated based on the pool's APY (${pool.expectedAPY}%) and time elapsed. Refresh the page to see updated projections.`
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </>
                              )}
                              
                              {/* Show message if no investment data available */}
                              {!projectedROI && !projectedInterest && userInvestment === 0 && userHoldings === 0 && (
                                <div className="pt-2 border-t border-gray-200">
                                  <p className="text-xs text-gray-500">
                                    💡 ROI information will appear here once you have investments in this pool.
                                  </p>
                                </div>
                              )}
                              
                              {/* Show loading/calculating message if we have holdings but ROI not calculated yet */}
                              {!projectedROI && (userInvestment > 0 || userHoldings > 0) && (
                                <div className="pt-2 border-t border-gray-200">
                                  <p className="text-xs text-gray-500">
                                    💡 Calculating ROI from on-chain data...
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Redeem Amount ({poolTokenSymbol})
                          </label>
                          <input
                            type="number"
                            value={redeemAmount}
                            onChange={(e) => setRedeemAmount(e.target.value)}
                            placeholder="Enter amount to redeem"
                            max={userHoldings}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Maximum: {userHoldings.toFixed(2)} {poolTokenSymbol}
                          </p>
                        </div>
                        
                        <Button
                          onClick={handleRedeem}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 text-base"
                          disabled={!isConnected || !redeemAmount || parseFloat(redeemAmount) <= 0 || parseFloat(redeemAmount) > userHoldings}
                        >
                          Redeem
                        </Button>
                      </>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 text-center">
                          You don't have any pool tokens to redeem
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pending' && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 text-center">No pending transactions</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoolDetailPage;

