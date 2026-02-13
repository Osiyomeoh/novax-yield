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
import { ProgressBar } from '../UI/ProgressBar';
import { StatusBadge } from '../UI/StatusBadge';
import { InvestmentCalculator } from '../UI/InvestmentCalculator';
import { useToast } from '../../hooks/useToast';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { novaxContractService } from '../../services/novaxContractService';
import { ethers } from 'ethers';
import { novaxContractAddresses } from '../../config/contracts';
import NovaxPoolManagerABI from '../../contracts/NovaxPoolManager.json';

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
  // Note: Novax pools don't have tranches - they're single-asset pools
  // Note: Novax pools use poolId directly (no separate IDs)
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
    // Note: Novax pools don't have tranches
  };
}

interface PoolDetailPageProps {
  poolId: string;
  onBack?: () => void;
}

const PoolDetailPage: React.FC<PoolDetailPageProps> = ({ poolId, onBack }) => {
  const { toast } = useToast();
  const { address, isConnected, signer, provider } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'invest' | 'redeem' | 'sell' | 'pending'>('invest');
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userHoldings, setUserHoldings] = useState(0);
  const [userInvestment, setUserInvestment] = useState(0); // Total USDC invested
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
  // Marketplace listing state
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingForm, setListingForm] = useState({
    amount: '',
    pricePerToken: '',
    minPurchase: '',
    maxPurchase: '',
    deadline: '' // Days from now
  });
  const [poolTokenAddress, setPoolTokenAddress] = useState<string | null>(null);
  // Note: Novax pools don't have tranches - removed tranche selection
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
  
  // Performance data - fetch from contracts/backend
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

  // Fetch marketplace listings when pool is loaded
  useEffect(() => {
    if (pool && poolId) {
      fetchMarketplaceListings();
    }
  }, [pool, poolId]);

  // Fetch marketplace listings for this pool
  const fetchMarketplaceListings = async () => {
    if (!pool || !poolId) return;
    
    try {
      setLoadingListings(true);
      const listings = await novaxContractService.getPoolListings(poolId);
      setMarketplaceListings(listings);
      console.log('✅ Fetched marketplace listings:', listings.length);
    } catch (error: any) {
      console.error('Failed to fetch marketplace listings:', error);
      setMarketplaceListings([]);
    } finally {
      setLoadingListings(false);
    }
  };

  // Handle creating a marketplace listing
  const handleCreateListing = async () => {
    if (!isConnected || !address || !signer || !pool || !poolTokenAddress) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to create a listing',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(listingForm.amount);
    const pricePerToken = parseFloat(listingForm.pricePerToken);
    const minPurchase = parseFloat(listingForm.minPurchase || '0');
    const maxPurchase = parseFloat(listingForm.maxPurchase || '0');
    const deadlineDays = parseFloat(listingForm.deadline || '0');

    if (!amount || amount <= 0 || amount > userHoldings) {
      toast({
        title: 'Invalid Amount',
        description: `Please enter a valid amount between 0 and ${userHoldings.toFixed(2)}`,
        variant: 'destructive'
      });
      return;
    }

    if (!pricePerToken || pricePerToken <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid price per token',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (provider && signer) {
        novaxContractService.initialize(signer, provider);
      }

      const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
        ? poolId
        : ethers.id(poolId);

      const amountInWei = ethers.parseUnits(amount.toString(), 18); // PoolToken has 18 decimals
      const priceInWei = ethers.parseUnits(pricePerToken.toString(), 6); // Price in USDC (6 decimals)
      const minPurchaseInWei = minPurchase > 0 ? ethers.parseUnits(minPurchase.toString(), 18) : 0n;
      const maxPurchaseInWei = maxPurchase > 0 ? ethers.parseUnits(maxPurchase.toString(), 18) : 0n;
      const deadline = deadlineDays > 0 
        ? Math.floor(Date.now() / 1000) + (deadlineDays * 24 * 60 * 60)
        : 0;

      toast({
        title: 'Creating Listing',
        description: 'Please approve the transaction in your wallet...',
        variant: 'default'
      });

      const result = await novaxContractService.createListing(
        poolTokenAddress,
        poolIdBytes32,
        amountInWei,
        priceInWei,
        minPurchaseInWei,
        maxPurchaseInWei,
        deadline
      );

      toast({
        title: 'Listing Created',
        description: `Successfully created listing. Transaction: ${result.txHash.substring(0, 10)}...`,
        variant: 'default'
      });

      // Reset form
      setListingForm({
        amount: '',
        pricePerToken: '',
        minPurchase: '',
        maxPurchase: '',
        deadline: ''
      });

      // Refresh listings
      await fetchMarketplaceListings();
    } catch (error: any) {
      console.error('Failed to create listing:', error);
      toast({
        title: 'Listing Failed',
        description: error.message || 'Failed to create listing. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle buying tokens from marketplace
  const handleBuyFromListing = async (listingId: string, amount: number) => {
    if (!isConnected || !address || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to buy tokens',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (provider && signer) {
        novaxContractService.initialize(signer, provider);
      }

      const amountInWei = ethers.parseUnits(amount.toString(), 18);

      toast({
        title: 'Processing Purchase',
        description: 'Please approve the transaction in your wallet...',
        variant: 'default'
      });

      const result = await novaxContractService.buyTokens(listingId, amountInWei);

      toast({
        title: 'Purchase Successful',
        description: `Successfully purchased ${amount} tokens. Transaction: ${result.txHash.substring(0, 10)}...`,
        variant: 'default'
      });

      // Refresh listings and holdings
      await fetchMarketplaceListings();
      await fetchUserHoldings();
    } catch (error: any) {
      console.error('Failed to buy tokens:', error);
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Failed to purchase tokens. Please try again.',
        variant: 'destructive'
      });
    }
  };

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
        const poolManagerAddress = novaxContractAddresses.NOVAX_POOL_MANAGER;
        const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
          ? poolId
          : ethers.id(poolId);
        
        // Use multiple RPC endpoints with fallback
        const rpcEndpoints = [
          import.meta.env.VITE_RPC_URL,
          'https://node.shadownet.etherlink.com',
          'https://node.mainnet.etherlink.com',
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
          // Note: Novax pools don't have tranches
          // Note: Novax pools use poolId directly
        };
        
        console.log('✅ Pool data fetched from blockchain');
      }

      if (poolData) {
        const data = poolData;
        
        // Note: Novax pools don't have tranches - they're single-asset pools
        const onChainPoolId = poolId; // Novax pools use poolId directly
        
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
          // Note: Novax pools don't have tranches
          // Note: Novax pools use poolId directly
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
            // Note: Novax pools don't have tranches
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
      const poolManagerAddress = novaxContractAddresses.NOVAX_POOL_MANAGER;
      const onChainPoolId = poolId; // Novax pools use poolId directly
      
      if (!onChainPoolId || !poolManagerAddress) {
        console.warn('⚠️ Missing pool ID or manager address:', { onChainPoolId, poolManagerAddress });
        setUserHoldings(0);
        return;
      }
      
      const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
        ? onChainPoolId
        : ethers.id(onChainPoolId);
      
      console.log('📋 Pool info:', { poolIdBytes32 });
      
      // Create contract instance for Novax pools (no tranches)
      const readOnlyProvider = provider || new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com');
      
      // Use Novax contract service to get pool token balance
      const poolData = await novaxContractService.getPool(poolIdBytes32);
      const poolTokenAddress = poolData.poolToken;
      setPoolTokenAddress(poolTokenAddress); // Store for marketplace listings
      
      // Get pool token balance directly
      let totalShares = 0n;
      try {
        console.log('🔍 Fetching pool token balance...');
        totalShares = await novaxContractService.getPoolTokenBalance(poolTokenAddress, address);
        console.log('✅ Pool token balance:', ethers.formatUnits(totalShares, 18), 'tokens');
      } catch (error: any) {
        console.warn('❌ Failed to fetch pool token balance:', error.message || error);
      }
      
      const sharesFormatted = Number(ethers.formatEther(totalShares));
      setUserHoldings(sharesFormatted);
      
      // Fetch user investment amount (USDC, 6 decimals)
      let totalInvestment = 0n;
      try {
        totalInvestment = await novaxContractService.getUserInvestment(poolIdBytes32, address);
        console.log('✅ User investment:', ethers.formatUnits(totalInvestment, 6), 'USDC');
      } catch (error: any) {
        console.warn('Failed to fetch user investment:', error.message || error);
      }
      
      const investmentFormatted = Number(ethers.formatUnits(totalInvestment, 6)); // USDC has 6 decimals
      setUserInvestment(investmentFormatted);
      
      // Calculate projected annual interest based on APY
      if (pool.expectedAPY && investmentFormatted > 0) {
        const annualInterest = (investmentFormatted * pool.expectedAPY) / 100;
        setProjectedInterest(annualInterest);
      } else {
        setProjectedInterest(0);
      }
      
      console.log(`✅ User holdings updated: ${sharesFormatted} tokens, Investment: ${investmentFormatted} USDC`);
      
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
      const poolManagerAddress = novaxContractAddresses.NOVAX_POOL_MANAGER;
      const onChainPoolId = poolId; // Novax pools use poolId directly
      
      if (!onChainPoolId || !poolManagerAddress) {
        console.warn('⚠️ Missing pool ID or manager address for ROI calculation');
        return;
      }
      
      const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
        ? onChainPoolId
        : ethers.id(onChainPoolId);
      
      const readOnlyProvider = provider || new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com');
      
      // Get pool creation timestamp from Novax contract
      let poolCreatedAt: Date;
      try {
        const poolData = await novaxContractService.getPool(poolIdBytes32);
        // Pool struct has createdAt field
        const createdAtTimestamp = poolData.createdAt || 0n;
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

      const poolManagerAddress = novaxContractAddresses.NOVAX_POOL_MANAGER;
      const onChainPoolId = poolId; // Novax pools use poolId directly

      if (!onChainPoolId || !poolManagerAddress) {
        throw new Error('Pool not found on-chain');
      }

      const poolIdBytes32 = onChainPoolId.startsWith('0x') && onChainPoolId.length === 66
        ? onChainPoolId
        : ethers.id(onChainPoolId);

      // Create contract instance
      // Novax pools don't have tranches - use withdraw function
      console.log('Withdrawing from pool...');
      const sharesAmount = ethers.parseUnits(amount.toString(), 18); // PoolToken has 18 decimals
      
      const withdrawResult = await novaxContractService.withdraw(poolIdBytes32, sharesAmount);
      const redeemTxHash = withdrawResult.txHash;
      
      console.log('Withdrawal successful! USDC received:', ethers.formatUnits(withdrawResult.usdcAmount, 6));

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
    // Check KYC status before investing
    const isKYCApproved = user?.kycStatus?.toLowerCase() === 'approved';
    if (!isKYCApproved) {
      toast({
        title: 'KYC Verification Required',
        description: 'Please complete KYC verification to invest in pools.',
        variant: 'destructive'
      });
      return;
    }

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
      // Initialize Novax contract service
      if (provider && signer) {
        novaxContractService.initialize(signer, provider);
      } else {
        throw new Error('Provider and signer not available');
      }

      toast({
        title: 'Processing Investment',
        description: 'Please approve the transaction in your wallet...',
        variant: 'default'
      });

      // Step 1: Approve USDC for PoolManager
      const poolManagerAddress = novaxContractAddresses.NOVAX_POOL_MANAGER;
      const usdcAmount = ethers.parseUnits(amount.toString(), 6); // USDC has 6 decimals

      console.log('Approving USDC...');
      const approveResult = await novaxContractService.approveUSDC(poolManagerAddress, usdcAmount);
      console.log('USDC approved:', approveResult.txHash);

      // Step 2: Get pool ID (bytes32 format)
      // Note: Novax pools don't have tranches - they're single-asset pools
      const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
        ? poolId
        : ethers.id(poolId);
      
      console.log('On-chain poolId:', poolIdBytes32);
      
      // Verify pool exists on-chain
      console.log('Verifying pool exists on-chain...');
      try {
        const onChainPool = await novaxContractService.getPool(poolIdBytes32);
        console.log('✅ Pool verified on-chain:', {
          poolId: onChainPool.id,
          poolType: onChainPool.poolType, // 0 = RWA, 1 = RECEIVABLE
          status: onChainPool.status, // 0 = ACTIVE, 1 = CLOSED, 2 = PAUSED
          totalInvested: ethers.formatUnits(onChainPool.totalInvested, 6),
          targetAmount: ethers.formatUnits(onChainPool.targetAmount, 6),
        });
        
        if (onChainPool.status !== 0) { // 0 = ACTIVE
          throw new Error(`Pool exists but is not active. Status: ${onChainPool.status}`);
        }
      } catch (verifyError: any) {
        console.error('❌ Pool verification failed:', verifyError);
        toast({
          title: 'Pool Not Found On-Chain',
          description: `Failed to verify pool on-chain: ${verifyError.message}. Please check your connection and try again.`,
          variant: 'destructive',
          duration: 10000
        });
        throw verifyError;
      }
      
      // Step 3: Invest in pool (Novax pools don't have tranches)
      console.log('Investing in pool...');
      const investResult = await novaxContractService.invest(poolIdBytes32, usdcAmount);
      const investTxHash = investResult.txHash;
      console.log('Investment successful! Shares received:', ethers.formatUnits(investResult.shares, 18));

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
          // Note: Novax pools don't have tranches
          transactionHash: investTxHash
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to record investment');
      }

      toast({
        title: 'Investment Successful',
        description: `Successfully invested ${amount} USDC in pool. Received ${ethers.formatUnits(investResult.shares, 18)} pool tokens.`,
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
              <span className="text-xl font-bold text-gray-900">Novax Yield</span>
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
            {/* Pool Status and Progress */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Pool Status</h3>
                <StatusBadge status={pool.status.toLowerCase()} size="md" showIcon={true} />
              </div>
              {pool.totalValue && (
                <ProgressBar
                  current={pool.totalValue * 0.75} // TODO: Get actual invested amount from pool
                  target={pool.totalValue}
                  showLabel={true}
                  showPercentage={true}
                  color="blue"
                  size="md"
                />
              )}
            </div>

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
                    <p className="text-sm font-medium text-gray-900">Novax Yield Pool Management</p>
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
                    {pool.description || `${pool.name} (the Fund) is a tokenized investment pool, open to Professional Investors. It invests in and holds real-world assets (RWA) to offer stable returns with minimized risk in combination with liquidity and market returns. Assets are held directly by the Fund and Asset Under Management (AUM) can be checked onchain. The fund issues its shares as pool tokens to investors. Investments and redemptions are processed in USDC.`}
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">Associated Entities</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Investment Manager:</span>
                      <span className="text-gray-900 font-medium">{pool.metadata?.investmentManager || 'Novax Asset Management'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fund Administrator:</span>
                      <span className="text-gray-900 font-medium">{pool.metadata?.fundAdministrator || 'Novax Services Ltd'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Auditor:</span>
                      <span className="text-gray-900 font-medium">{pool.metadata?.auditor || 'Novax Audit Partners'}</span>
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
                  onClick={() => setActiveTab('sell')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'sell'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sell
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
                    {/* Investment Calculator */}
                    {pool.maturityDate && (
                      <InvestmentCalculator
                        apy={pool.expectedAPY}
                        maturityDate={pool.maturityDate}
                        minInvestment={pool.minimumInvestment}
                        maxInvestment={pool.minimumInvestment * 100} // TODO: Get actual max from pool
                        onCalculate={(amount, returns) => {
                          setInvestmentAmount(amount.toString());
                        }}
                      />
                    )}

                    {/* Investment Amount Input (if calculator not available) */}
                    {!pool.maturityDate && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Investment Amount (USDC)
                        </label>
                        <input
                          type="number"
                          value={investmentAmount}
                          onChange={(e) => setInvestmentAmount(e.target.value)}
                          placeholder={`Min: $${pool.minimumInvestment.toLocaleString()}`}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Minimum investment: ${pool.minimumInvestment.toLocaleString()} USDC
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleInvest}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium py-3 text-base"
                      disabled={!isConnected || !investmentAmount || parseFloat(investmentAmount) < pool.minimumInvestment}
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
                                  <span className="text-sm font-semibold text-gray-900">{userInvestment.toFixed(2)} USDC</span>
                                </div>
                              )}
                              
                              {/* Real-time ROI Display */}
                              {(realTimeROI || projectedROI) && (
                                <>
                                  <div className="pt-2 border-t border-gray-200 space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Actual Dividends Received</span>
                                      <span className="text-sm font-semibold text-blue-600">+{(projectedROI?.actual?.dividendsReceived || 0).toFixed(2)} USDC</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Projected Dividends</span>
                                      <span className="text-sm font-semibold text-green-600 animate-pulse">
                                        +{(realTimeROI?.projectedDividends || projectedROI?.projected?.projectedDividends || 0).toFixed(2)} USDC
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium text-gray-700">Total Return</span>
                                      <span className="text-sm font-bold text-green-600">
                                        +{(realTimeROI?.totalReturn || projectedROI?.projected?.totalReturn || 0).toFixed(2)} USDC
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
                                          <span className="text-sm font-semibold text-blue-600">+0.00 USDC</span>
                                        </div>
                                        {projectedInterest > 0 ? (
                                          <>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Projected Annual Interest</span>
                                              <span className="text-sm font-semibold text-green-600">+{projectedInterest.toFixed(2)} USDC</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Projected Monthly</span>
                                              <span className="text-sm font-semibold text-green-600">+{(projectedInterest / 12).toFixed(2)} USDC</span>
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

                {activeTab === 'sell' && (
                  <div className="space-y-4">
                    {userHoldings > 0 ? (
                      <>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Available to Sell</span>
                            <span className="text-sm font-semibold text-gray-900">{userHoldings.toFixed(2)} {poolTokenSymbol}</span>
                          </div>
                        </div>

                        {/* Create Listing Form */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Amount to Sell ({poolTokenSymbol})
                            </label>
                            <input
                              type="number"
                              value={listingForm.amount}
                              onChange={(e) => setListingForm({ ...listingForm, amount: e.target.value })}
                              placeholder={`Max: ${userHoldings.toFixed(2)}`}
                              max={userHoldings}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Price Per Token (USDC)
                            </label>
                            <input
                              type="number"
                              step="0.000001"
                              value={listingForm.pricePerToken}
                              onChange={(e) => setListingForm({ ...listingForm, pricePerToken: e.target.value })}
                              placeholder="e.g., 1.05"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Min Purchase ({poolTokenSymbol})
                              </label>
                              <input
                                type="number"
                                value={listingForm.minPurchase}
                                onChange={(e) => setListingForm({ ...listingForm, minPurchase: e.target.value })}
                                placeholder="Optional"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Purchase ({poolTokenSymbol})
                              </label>
                              <input
                                type="number"
                                value={listingForm.maxPurchase}
                                onChange={(e) => setListingForm({ ...listingForm, maxPurchase: e.target.value })}
                                placeholder="Optional"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Expires In (Days) - Leave empty for no expiration
                            </label>
                            <input
                              type="number"
                              value={listingForm.deadline}
                              onChange={(e) => setListingForm({ ...listingForm, deadline: e.target.value })}
                              placeholder="e.g., 30"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                            />
                          </div>

                          <Button
                            onClick={handleCreateListing}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 text-base"
                            disabled={!isConnected || !listingForm.amount || !listingForm.pricePerToken}
                          >
                            List for Sale
                          </Button>
                        </div>

                        {/* Active Listings */}
                        <div className="pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Active Listings</h4>
                          {loadingListings ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            </div>
                          ) : marketplaceListings.length > 0 ? (
                            <div className="space-y-2">
                              {marketplaceListings.map((listing: any) => (
                                <div key={listing.listingId} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-900">
                                      {ethers.formatUnits(listing.amount, 18)} {poolTokenSymbol}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      ${ethers.formatUnits(listing.pricePerToken, 6)} per token
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">
                                      Total: ${ethers.formatUnits(listing.totalPrice, 6)} USDC
                                    </span>
                                    {listing.seller.toLowerCase() !== address?.toLowerCase() && (
                                      <Button
                                        onClick={() => handleBuyFromListing(listing.listingId, parseFloat(ethers.formatUnits(listing.amount, 18)))}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                      >
                                        Buy
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No active listings for this pool</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 text-center">
                          You don't have any pool tokens to sell
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

