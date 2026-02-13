import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useAdmin } from '../../contexts/AdminContext';
import { novaxContractService } from '../../services/novaxContractService';
import { ethers } from 'ethers';
import Button from '../UI/Button';
import Card from '../UI/Card';
import { useToast } from '../../hooks/useToast';

interface Pool {
  poolId: string;
  targetAmount: bigint;
  totalInvested: bigint;
  totalPaid: bigint;
  status: number;
  apr: number;
  maturityDate: number;
  createdAt: number;
  paymentStatus: number;
}

const NovaxYieldDistribution: React.FC = () => {
  const { address, signer, isConnected, provider } = useWallet();
  const { isAmcAdmin, isSuperAdmin, isPlatformAdmin } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState<string | null>(null);

  useEffect(() => {
    if (signer && provider) {
      novaxContractService.initialize(signer, provider);
    }
  }, [signer, provider]);

  useEffect(() => {
    if (isConnected && provider) {
      fetchPools();
    }
  }, [isConnected, provider]);

  const fetchPools = async () => {
    if (!provider) return;

    setLoading(true);
    try {
      if (signer && provider) {
        novaxContractService.initialize(signer, provider);
      } else if (provider) {
        novaxContractService.initialize(null as any, provider);
      }

      // Get all pool IDs from events
      const poolIds = await novaxContractService.getAllPools();
      
      // Fetch details for each pool
      const poolsData = await Promise.all(
        poolIds.map(async (id) => {
          try {
            const pool = await novaxContractService.getPool(id);
            return {
              poolId: id,
              targetAmount: pool.targetAmount || BigInt(0),
              totalInvested: pool.totalInvested || BigInt(0),
              totalPaid: pool.totalPaid || BigInt(0),
              status: Number(pool.status || 0),
              apr: Number(pool.apr || 0),
              maturityDate: Number(pool.maturityDate || 0),
              createdAt: Number(pool.createdAt || 0),
              paymentStatus: Number(pool.paymentStatus || 0),
            } as Pool;
          } catch {
            return null;
          }
        })
      );

      // Filter for pools that are PAID and ready for yield distribution
      const readyPools = poolsData.filter(
        (pool): pool is Pool => pool !== null && pool.status === 3 // PAID
      );

      setPools(readyPools);
    } catch (error: any) {
      console.error('Error fetching pools:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch pools: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeYield = async (poolId: string) => {
    if (!signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to distribute yield.',
        variant: 'destructive'
      });
      return;
    }

    setDistributing(poolId);
    try {
      const result = await novaxContractService.distributeYield(poolId);

      toast({
        title: 'Yield Distributed Successfully!',
        description: `Yield distributed for pool. Transaction: ${result.txHash.slice(0, 10)}...`,
        variant: 'default'
      });

      // Refresh pools
      await fetchPools();
    } catch (error: any) {
      console.error('Error distributing yield:', error);
      toast({
        title: 'Distribution Failed',
        description: error.message || 'Failed to distribute yield. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setDistributing(null);
    }
  };

  const formatAmount = (amount: bigint) => {
    return ethers.formatUnits(amount, 6); // USDC has 6 decimals
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateYield = (pool: Pool) => {
    const daysHeld = (pool.maturityDate - pool.createdAt) / (24 * 60 * 60);
    const totalYield = (Number(pool.apr) * daysHeld * Number(pool.totalInvested)) / (365 * 10000);
    return totalYield;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Not Connected</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to distribute yield.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard/admin')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Yield Distribution</h1>
                <p className="text-gray-600 mt-1">Distribute yield to investors for paid pools</p>
              </div>
            </div>
            <Button
              onClick={fetchPools}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Pools List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading pools...</span>
          </div>
        ) : pools.length === 0 ? (
          <Card className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pools Ready for Distribution</h3>
            <p className="text-gray-600 mb-6">
              Pools must be PAID (payment status FULL) before yield can be distributed.
            </p>
            <Button onClick={fetchPools} variant="outline">
              Refresh
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pools.map((pool) => {
              const yieldAmount = calculateYield(pool);
              const totalReturn = Number(formatAmount(pool.totalInvested)) + yieldAmount;

              return (
                <motion.div
                  key={pool.poolId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                            Ready for Distribution
                          </span>
                          <span className="text-sm text-gray-500 font-mono">
                            {pool.poolId.slice(0, 16)}...
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Total Invested</p>
                            <p className="text-lg font-semibold text-gray-900">
                              ${formatAmount(pool.totalInvested)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Total Paid</p>
                            <p className="text-lg font-semibold text-green-600">
                              ${formatAmount(pool.totalPaid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Yield Amount</p>
                            <p className="text-lg font-semibold text-blue-600">
                              ${yieldAmount.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Total Return</p>
                            <p className="text-lg font-semibold text-gray-900">
                              ${totalReturn.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">APR</p>
                            <p className="font-medium text-gray-900">{(pool.apr / 100).toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Maturity Date</p>
                            <p className="font-medium text-gray-900">{formatDate(pool.maturityDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Payment Status</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              pool.paymentStatus === 2 ? 'bg-green-100 text-green-800' :
                              pool.paymentStatus === 1 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {pool.paymentStatus === 2 ? 'FULL' : pool.paymentStatus === 1 ? 'PARTIAL' : 'PENDING'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-6">
                        <Button
                          onClick={() => handleDistributeYield(pool.poolId)}
                          disabled={distributing === pool.poolId || pool.paymentStatus !== 2}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {distributing === pool.poolId ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Distributing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Distribute Yield
                            </>
                          )}
                        </Button>
                        {pool.paymentStatus !== 2 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Payment must be FULL
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NovaxYieldDistribution;

