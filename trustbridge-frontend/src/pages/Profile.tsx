import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Wallet,
  FileText,
  TrendingUp,
  Plus,
  Copy,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Settings,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UI/Card';
import Button from '../components/UI/Button';
import { PortfolioStats } from '../components/UI/PortfolioStats';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../hooks/useToast';
import { usePrivy } from '@privy-io/react-auth';
import { novaxContractService } from '../services/novaxContractService';
import { useNVXBalance } from '../hooks/useNVXBalance';
import { formatUSD } from '../utils/priceUtils';

const Profile: React.FC = () => {
  const { user, startKYC, refreshUser } = useAuth();
  const { address, isConnected, provider } = useWallet();
  const { user: privyUser } = usePrivy();
  const { toast } = useToast();
  const navigate = useNavigate();

  // User info
  const displayName = user?.name || privyUser?.google?.name || 'User';
  const displayEmail = user?.email || privyUser?.google?.email || '';

  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'receivables' | 'investments' | 'activity'>('overview');
  const [receivables, setReceivables] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { balance: nvxBalance, loading: nvxLoading } = useNVXBalance();

  // Tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'receivables', label: 'My Receivables', icon: FileText },
    { id: 'investments', label: 'My Investments', icon: TrendingUp },
    { id: 'activity', label: 'Activity', icon: Activity }
  ];

  // Load data
  useEffect(() => {
    if (isConnected && address && provider) {
      loadUserData();
    }
  }, [isConnected, address, provider]);

  const loadUserData = async () => {
    if (!address || !provider) return;
    
    setLoading(true);
    try {
      // Initialize contract service
      const signer = await provider.getSigner();
      novaxContractService.initialize(signer, provider);

      // Load receivables
      const receivableIds = await novaxContractService.getExporterReceivables(address);
      
      // Fetch full receivable details
      const receivableDetails = await Promise.all(
        receivableIds.map(async (id: string) => {
          try {
            const receivable = await novaxContractService.getReceivable(id);
            return {
              id,
              ...receivable,
              amountUSD: receivable.amountUSD?.toString() || '0',
              dueDate: receivable.dueDate?.toString() || '0',
              status: getReceivableStatus(receivable.status)
            };
          } catch (error) {
            console.error(`Failed to fetch receivable ${id}:`, error);
            return null;
          }
        })
      );
      
      setReceivables(receivableDetails.filter((r: any) => r !== null));

      // Load pools (investments)
      const allPools = await novaxContractService.getAllPools();
      
      // Fetch full pool details
      const poolDetails = await Promise.all(
        allPools.map(async (poolId: string) => {
          try {
            const pool = await novaxContractService.getPool(poolId);
            // Check if user has invested (has pool tokens)
            if (pool.poolToken) {
              // TODO: Check user's pool token balance
              // For now, include all pools
              return {
                poolId,
                ...pool,
                totalInvested: pool.totalInvested?.toString() || '0',
                apr: pool.apr?.toString() || '0',
                maturityDate: pool.maturityDate?.toString() || '0',
                status: getPoolStatus(pool.status)
              };
            }
            return null;
          } catch (error) {
            console.error(`Failed to fetch pool ${poolId}:`, error);
            return null;
          }
        })
      );
      
      setPools(poolDetails.filter((p: any) => p !== null));
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getReceivableStatus = (status: number | string): string => {
    const statusMap: Record<number | string, string> = {
      0: 'PENDING_VERIFICATION',
      1: 'VERIFIED',
      2: 'FUNDED',
      3: 'MATURED',
      4: 'PAID',
      5: 'DEFAULTED',
      6: 'REJECTED'
    };
    return statusMap[status] || 'UNKNOWN';
  };

  const getPoolStatus = (status: number | string): string => {
    const statusMap: Record<number | string, string> = {
      0: 'ACTIVE',
      1: 'FUNDED',
      2: 'MATURED',
      3: 'PAID',
      4: 'DEFAULTED',
      5: 'CLOSED',
      6: 'PAUSED'
    };
    return statusMap[status] || 'UNKNOWN';
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard',
        variant: 'default'
      });
    }
  };

  const handleCreateReceivable = () => {
    navigate('/dashboard/create-receivable');
  };

  const handleStartKYC = async () => {
    try {
      await startKYC();
      toast({
        title: 'KYC Started',
        description: 'Please complete KYC verification to create receivables',
        variant: 'default'
      });
    } catch (error) {
      console.error('KYC error:', error);
      toast({
        title: 'KYC Error',
        description: error instanceof Error ? error.message : 'Failed to start KYC verification',
        variant: 'destructive'
      });
    }
  };

  const handleCheckKYCStatus = async () => {
    try {
      await refreshUser();
      toast({
        title: 'Status Updated',
        description: 'Your KYC status has been refreshed',
        variant: 'default'
      });
    } catch (error) {
      console.error('Failed to refresh KYC status:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh KYC status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Calculate stats
  const totalReceivables = receivables.length;
  const totalReceivablesValue = receivables.reduce((sum, r) => sum + (Number(r.amountUSD) || 0), 0);
  const totalInvestments = pools.length;
  const totalInvested = pools.reduce((sum, p) => sum + (Number(p.totalInvested) || 0), 0);
  const totalYield = pools.reduce((sum, p) => {
    // Calculate yield: (totalInvested * APR / 100) * (days since investment / 365)
    const invested = Number(p.totalInvested) || 0;
    const apr = Number(p.apr) / 100 || 0; // Convert basis points to percentage
    const daysSinceInvestment = p.maturityDate 
      ? Math.max(0, (Number(p.maturityDate) - Date.now() / 1000) / 86400)
      : 0;
    const yieldAmount = invested > 0 && apr > 0 
      ? (invested * apr / 100) * (daysSinceInvestment / 365)
      : 0;
    return sum + yieldAmount;
  }, 0);
  const isKYCApproved = user?.kycStatus?.toLowerCase() === 'approved';
  const kycStatus = user?.kycStatus?.toLowerCase() || 'not_started';

  // Get KYC status info
  const getKYCStatusInfo = () => {
    switch (kycStatus) {
      case 'approved':
        return {
          label: 'KYC Verified',
          description: 'Your identity has been verified',
          icon: CheckCircle,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
          badge: 'Verified'
        };
      case 'pending':
      case 'in_progress':
        return {
          label: 'KYC In Progress',
          description: 'Your verification is being reviewed',
          icon: Clock,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          badge: 'Pending'
        };
      case 'rejected':
        return {
          label: 'KYC Rejected',
          description: 'Your verification was not successful. Please try again.',
          icon: XCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
          badge: 'Rejected'
        };
      default:
        return {
          label: 'KYC Not Started',
          description: 'Complete KYC to create receivables and access all features',
          icon: Shield,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          badge: 'Required'
        };
    }
  };

  const kycInfo = getKYCStatusInfo();
  const KYCIcon = kycInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate(-1)}
                variant="ghost"
                className="flex items-center gap-2 text-text-secondary hover:text-off-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-off-white mb-2">Profile</h1>
                <p className="text-text-secondary">Manage your receivables and investments</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/dashboard/settings')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>

          {/* User Info Card */}
          <Card className="bg-midnight-800/50 border-medium-gray/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-blue to-primary-blue-light rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-midnight-900" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-off-white">{displayName}</h2>
                    <p className="text-text-secondary">{displayEmail}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-text-secondary font-mono">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                      </span>
                      {address && (
                        <button
                          onClick={handleCopyAddress}
                          className="p-1 hover:bg-midnight-700 rounded transition-colors"
                        >
                          <Copy className="w-4 h-4 text-text-secondary" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-text-secondary">NVX Balance</p>
                    <p className="text-2xl font-bold text-off-white">
                      {nvxLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin inline" />
                      ) : (
                        nvxBalance.toLocaleString()
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* KYC Status - Always Visible */}
              <div className={`mt-4 p-4 ${kycInfo.bgColor} border ${kycInfo.borderColor} rounded-lg`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <KYCIcon className={`w-5 h-5 ${kycInfo.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${kycInfo.color}`}>{kycInfo.label}</p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${kycInfo.bgColor} ${kycInfo.color} border ${kycInfo.borderColor}`}>
                          {kycInfo.badge}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        {kycInfo.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(kycStatus === 'pending' || kycStatus === 'in_progress') && (
                      <Button 
                        onClick={handleCheckKYCStatus} 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Loader2 className="w-3 h-3" />
                        Refresh
                      </Button>
                    )}
                    {!isKYCApproved && (
                      <Button onClick={handleStartKYC} variant="default" size="sm">
                        {kycStatus === 'rejected' ? 'Retry KYC' : kycStatus === 'pending' || kycStatus === 'in_progress' ? 'View Status' : 'Start KYC'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex gap-2 border-b border-medium-gray/30">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-blue text-primary-blue'
                      : 'border-transparent text-text-secondary hover:text-off-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KYC Status Card - Prominent */}
              <Card className={`bg-midnight-800/50 border-medium-gray/30 ${!isKYCApproved ? 'ring-2 ring-yellow-500/50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <KYCIcon className={`w-5 h-5 ${kycInfo.color}`} />
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${kycInfo.bgColor} ${kycInfo.color} border ${kycInfo.borderColor}`}>
                      {kycInfo.badge}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-1">KYC Status</p>
                  <p className={`text-lg font-bold ${kycInfo.color} mt-1`}>
                    {kycInfo.label}
                  </p>
                  {!isKYCApproved && (
                    <Button 
                      onClick={handleStartKYC} 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-3"
                    >
                      {kycStatus === 'rejected' ? 'Retry KYC' : kycStatus === 'pending' || kycStatus === 'in_progress' ? 'View Status' : 'Start KYC'}
                    </Button>
                  )}
                  {(kycStatus === 'pending' || kycStatus === 'in_progress') && (
                    <Button 
                      onClick={handleCheckKYCStatus} 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-2 text-xs"
                    >
                      <Loader2 className="w-3 h-3 mr-1 inline" />
                      Refresh Status
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Portfolio Stats */}
              <PortfolioStats
                totalReceivables={totalReceivables}
                totalReceivablesValue={totalReceivablesValue}
                totalInvestments={totalInvestments}
                totalInvested={totalInvested}
                totalYield={totalYield}
                nvxBalance={nvxBalance}
                verifiedCount={receivables.filter((r: any) => r.status === 'VERIFIED').length}
              />
            </div>
          )}

          {/* Receivables Tab */}
          {activeTab === 'receivables' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-off-white">My Receivables</h2>
                <Button onClick={handleCreateReceivable} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Receivable
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
                </div>
              ) : receivables.length === 0 ? (
                <Card className="bg-midnight-800/50 border-medium-gray/30">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-off-white mb-2">No Receivables Yet</h3>
                    <p className="text-text-secondary mb-6">
                      Create your first trade receivable to get started
                    </p>
                    <Button onClick={handleCreateReceivable} className="flex items-center gap-2 mx-auto">
                      <Plus className="w-4 h-4" />
                      Create Receivable
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {receivables.map((receivable: any) => (
                    <Card key={receivable.id} className="bg-midnight-800/50 border-medium-gray/30 hover:border-primary-blue/50 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm text-text-secondary">Invoice #{receivable.invoiceNumber || 'N/A'}</p>
                            <p className="text-2xl font-bold text-off-white mt-1">
                              {formatUSD(Number(receivable.amountUSD) || 0)}
                            </p>
                          </div>
                          {receivable.status === 'VERIFIED' && (
                            <CheckCircle className="w-6 h-6 text-green-400" />
                          )}
                          {receivable.status === 'PENDING_VERIFICATION' && (
                            <Clock className="w-6 h-6 text-yellow-400" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">Status</span>
                            <span className="text-off-white font-medium">{receivable.status}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">Due Date</span>
                            <span className="text-off-white">
                              {receivable.dueDate ? new Date(Number(receivable.dueDate) * 1000).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full mt-4"
                          onClick={() => navigate(`/dashboard/receivables/${receivable.id}`)}
                        >
                          View Details
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Investments Tab */}
          {activeTab === 'investments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-off-white">My Investments</h2>
                <Button onClick={() => navigate('/dashboard/marketplace')} variant="outline">
                  Browse Pools
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
                </div>
              ) : pools.length === 0 ? (
                <Card className="bg-midnight-800/50 border-medium-gray/30">
                  <CardContent className="p-12 text-center">
                    <TrendingUp className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-off-white mb-2">No Investments Yet</h3>
                    <p className="text-text-secondary mb-6">
                      Start investing in trade receivable pools to earn yield
                    </p>
                    <Button onClick={() => navigate('/dashboard/marketplace')} className="flex items-center gap-2 mx-auto">
                      Browse Pools
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pools.map((pool: any) => (
                    <Card key={pool.poolId} className="bg-midnight-800/50 border-medium-gray/30">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm text-text-secondary">Pool #{pool.poolId?.slice(0, 8)}</p>
                            <p className="text-2xl font-bold text-off-white mt-1">
                              {formatUSD(Number(pool.totalInvested) || 0)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-text-secondary">APR</p>
                            <p className="text-xl font-bold text-green-400">
                              {pool.apr ? `${Number(pool.apr) / 100}%` : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-text-secondary">Status</p>
                            <p className="text-sm font-medium text-off-white">{pool.status || 'ACTIVE'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-secondary">Maturity</p>
                            <p className="text-sm font-medium text-off-white">
                              {pool.maturityDate ? new Date(Number(pool.maturityDate) * 1000).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate(`/dashboard/pools/${pool.poolId}`)}
                        >
                          View Pool
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <Card className="bg-midnight-800/50 border-medium-gray/30">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-off-white mb-6">Recent Activity</h2>
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                  <p className="text-text-secondary">Activity history coming soon</p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
