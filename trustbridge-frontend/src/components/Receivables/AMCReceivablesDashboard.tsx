import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Calendar,
  DollarSign,
  ArrowLeft,
  Shield,
  User,
  Building2,
  Loader2
} from 'lucide-react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useAdmin } from '../../contexts/AdminContext';
import { novaxContractService } from '../../services/novaxContractService';
import { hasAMCRoleOnReceivableFactory } from '../../services/contractRoleService';
import { ethers } from 'ethers';
import Button from '../UI/Button';
import Card from '../UI/Card';
import Input from '../UI/Input';
import { useToast } from '../../hooks/useToast';

interface Receivable {
  receivableId: string;
  importer: string;
  exporter: string;
  amountUSD: bigint;
  dueDate: number;
  status: number; // 0 = PENDING, 1 = VERIFIED, 2 = REJECTED, 3 = PAID
  riskScore?: number;
  apr?: number;
  createdAt?: number;
  verifiedAt?: number;
  metadataCID?: string;
}

const AMCReceivablesDashboard: React.FC = () => {
  const { address, signer, isConnected, provider } = useWallet();
  const { isAmcAdmin, isSuperAdmin, isPlatformAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'paid'>('pending');
  const [hasOnChainAMCRole, setHasOnChainAMCRole] = useState<boolean>(false);
  
  // Verification form state
  const [riskScore, setRiskScore] = useState<string>('');
  const [apr, setApr] = useState<string>('');

  useEffect(() => {
    if (signer && provider) {
      novaxContractService.initialize(signer, provider);
    }
  }, [signer, provider]);

  useEffect(() => {
    if (isConnected && address && (isAmcAdmin || isSuperAdmin || isPlatformAdmin)) {
      checkOnChainAMCRole();
      fetchReceivables();
    }
  }, [isConnected, address, isAmcAdmin, isSuperAdmin, isPlatformAdmin, provider]);

  const checkOnChainAMCRole = async () => {
    if (!address || !provider) return;
    
    try {
      const hasRole = await hasAMCRoleOnReceivableFactory(address, provider);
      setHasOnChainAMCRole(hasRole);
      
      if (!hasRole && (isAmcAdmin || isSuperAdmin || isPlatformAdmin)) {
        toast({
          title: 'On-Chain Role Missing',
          description: 'You have backend admin access but not on-chain AMC_ROLE. Please contact an admin to grant the role.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to check on-chain AMC role:', error);
    }
  };

  // Check admin access
  if (!adminLoading && !isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You need AMC Admin privileges to access this page.
          </p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const fetchReceivables = async () => {
    if (!address || !provider) {
      return;
    }

    setLoading(true);
    try {
      // Initialize service
      if (signer && provider) {
        novaxContractService.initialize(signer, provider);
      } else if (provider) {
        novaxContractService.initialize(null as any, provider);
      }

      // Get all receivable IDs from events
      console.log('📋 Fetching all receivables...');
      const receivableIds = await novaxContractService.getAllReceivables();
      console.log('✅ Found', receivableIds.length, 'receivables');

      if (receivableIds.length === 0) {
        setReceivables([]);
        toast({
          title: 'No Receivables Found',
          description: 'No receivables have been created yet.',
          variant: 'default'
        });
        return;
      }

      // Fetch details for each receivable
      console.log('📥 Fetching receivable details...');
      const receivablesData = await Promise.all(
        receivableIds.map(async (id) => {
          try {
            const rec = await novaxContractService.getReceivable(id);
            
            // Convert contract response to our interface
            return {
              receivableId: id,
              importer: rec.importer || '',
              exporter: rec.exporter || '',
              amountUSD: rec.amountUSD || BigInt(0),
              dueDate: Number(rec.dueDate || 0),
              status: Number(rec.status || 0),
              riskScore: rec.riskScore ? Number(rec.riskScore) : undefined,
              apr: rec.apr ? Number(rec.apr) : undefined,
              createdAt: rec.createdAt ? Number(rec.createdAt) : undefined,
              verifiedAt: rec.verifiedAt ? Number(rec.verifiedAt) : undefined,
              metadataCID: rec.metadataCID || undefined,
            } as Receivable;
          } catch (error) {
            console.error(`Error fetching receivable ${id}:`, error);
            return null;
          }
        })
      );

      // Filter out null values (failed fetches)
      const validReceivables = receivablesData.filter((rec): rec is Receivable => rec !== null);
      
      console.log('✅ Loaded', validReceivables.length, 'valid receivables');
      setReceivables(validReceivables);
      
      if (validReceivables.length === 0) {
        toast({
          title: 'No Receivables Found',
          description: 'No receivables could be loaded.',
          variant: 'default'
        });
      }
    } catch (error: any) {
      console.error('Error fetching receivables:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch receivables: ${error.message || 'Unknown error'}`,
        variant: 'destructive'
      });
      setReceivables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReceivables();
    setRefreshing(false);
  };

  const handleVerify = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setShowVerifyModal(true);
    // Pre-fill APR if receivable has one
    if (receivable.apr) {
      setApr((receivable.apr / 100).toString()); // Convert basis points to percentage
    }
  };

  const handleVerifySubmit = async () => {
    if (!selectedReceivable || !signer) {
      toast({
        title: 'Error',
        description: 'Please connect wallet and select a receivable',
        variant: 'destructive'
      });
      return;
    }

    // Check on-chain AMC role before verifying
    if (!hasOnChainAMCRole && address && provider) {
      const hasRole = await hasAMCRoleOnReceivableFactory(address, provider);
      if (!hasRole) {
        toast({
          title: 'Access Denied',
          description: 'You do not have AMC_ROLE on the contract. Only AMC admins can verify receivables.',
          variant: 'destructive'
        });
        return;
      }
      setHasOnChainAMCRole(true);
    }

    const riskScoreNum = parseInt(riskScore);
    const aprNum = parseFloat(apr);

    // Validation
    if (isNaN(riskScoreNum) || riskScoreNum < 0 || riskScoreNum > 100) {
      toast({
        title: 'Invalid Risk Score',
        description: 'Risk score must be between 0 and 100',
        variant: 'destructive'
      });
      return;
    }

    if (isNaN(aprNum) || aprNum < 0 || aprNum > 50) {
      toast({
        title: 'Invalid APR',
        description: 'APR must be between 0% and 50%',
        variant: 'destructive'
      });
      return;
    }

    setVerifying(true);
    try {
      // Convert APR percentage to basis points (e.g., 15% = 1500)
      const aprBasisPoints = Math.round(aprNum * 100);

      const result = await novaxContractService.verifyReceivable(
        selectedReceivable.receivableId,
        riskScoreNum,
        aprBasisPoints
      );

      toast({
        title: 'Success',
        description: `Receivable verified successfully! Transaction: ${result.txHash.slice(0, 10)}...`,
        variant: 'default'
      });

      // Close modal and refresh
      setShowVerifyModal(false);
      setSelectedReceivable(null);
      setRiskScore('');
      setApr('');
      await fetchReceivables();
    } catch (error: any) {
      console.error('Error verifying receivable:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify receivable. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setVerifying(false);
    }
  };

  const getStatusInfo = (status: number) => {
    switch (status) {
      case 0:
        return {
          label: 'Pending Verification',
          icon: Clock,
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200'
        };
      case 1:
        return {
          label: 'Verified',
          icon: CheckCircle,
          color: 'text-green-600 bg-green-50 border-green-200'
        };
      case 2:
        return {
          label: 'Rejected',
          icon: XCircle,
          color: 'text-red-600 bg-red-50 border-red-200'
        };
      case 3:
        return {
          label: 'Paid',
          icon: CheckCircle,
          color: 'text-blue-600 bg-blue-50 border-blue-200'
        };
      default:
        return {
          label: 'Unknown',
          icon: AlertCircle,
          color: 'text-gray-600 bg-gray-50 border-gray-200'
        };
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = (amount: bigint) => {
    return ethers.formatUnits(amount, 6); // USDC has 6 decimals
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Filter receivables
  const filteredReceivables = receivables.filter(rec => {
    const matchesSearch = 
      rec.receivableId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.exporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.importer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'pending' && rec.status === 0) ||
      (statusFilter === 'verified' && rec.status === 1) ||
      (statusFilter === 'paid' && rec.status === 3);
    
    return matchesSearch && matchesStatus;
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Not Connected</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to view receivables.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
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
                <h1 className="text-3xl font-bold text-gray-900">Receivables Management</h1>
                <p className="text-gray-600 mt-1">View and verify trade receivables for pool creation</p>
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search by ID, exporter, or importer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'verified' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('verified')}
              >
                Verified
              </Button>
              <Button
                variant={statusFilter === 'paid' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('paid')}
              >
                Paid
              </Button>
            </div>
          </div>
        </div>

        {/* Receivables List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading receivables...</span>
          </div>
        ) : filteredReceivables.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Receivables Found</h3>
            <p className="text-gray-600 mb-6">
              {statusFilter === 'pending' 
                ? 'No receivables are currently pending verification.'
                : 'No receivables match your filters.'}
            </p>
            <Button onClick={handleRefresh} variant="outline">
              Refresh
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredReceivables.map((receivable) => {
              const statusInfo = getStatusInfo(receivable.status);
              const StatusIcon = statusInfo.icon;

              return (
                <motion.div
                  key={receivable.receivableId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-2 ${statusInfo.color}`}>
                            <StatusIcon className="w-4 h-4" />
                            {statusInfo.label}
                          </div>
                          <span className="text-sm text-gray-500 font-mono">
                            {receivable.receivableId.slice(0, 16)}...
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Amount</p>
                            <p className="text-lg font-semibold text-gray-900">
                              ${formatAmount(receivable.amountUSD)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Due Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(receivable.dueDate)}
                            </p>
                          </div>
                          {receivable.riskScore !== undefined && receivable.apr !== undefined && (
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Risk Score / APR</p>
                              <p className="text-sm font-medium text-gray-900">
                                {receivable.riskScore} / {(receivable.apr / 100).toFixed(2)}%
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Exporter</p>
                            <p className="font-mono text-gray-900">{formatAddress(receivable.exporter)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Importer</p>
                            <p className="font-mono text-gray-900">{formatAddress(receivable.importer)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-6 flex flex-col gap-2">
                        {receivable.status === 0 && (
                          <Button
                            onClick={() => handleVerify(receivable)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            Verify
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Navigate to receivable detail page
                            toast({
                              title: 'Receivable Details',
                              description: `Receivable ID: ${receivable.receivableId}`,
                              variant: 'default'
                            });
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Verify Modal */}
        {showVerifyModal && selectedReceivable && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Verify Receivable</h2>
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Receivable ID</p>
                <p className="font-mono text-sm text-gray-900">{selectedReceivable.receivableId.slice(0, 32)}...</p>
                <p className="text-sm text-gray-600 mt-3 mb-1">Amount</p>
                <p className="text-lg font-semibold text-gray-900">${formatAmount(selectedReceivable.amountUSD)}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Risk Score (0-100)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={riskScore}
                    onChange={(e) => setRiskScore(e.target.value)}
                    placeholder="e.g., 75"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower score = higher risk</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    APR (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={apr}
                    onChange={(e) => setApr(e.target.value)}
                    placeholder="e.g., 15.0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Annual Percentage Rate (0-50%)</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowVerifyModal(false);
                    setSelectedReceivable(null);
                    setRiskScore('');
                    setApr('');
                  }}
                  className="flex-1"
                  disabled={verifying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifySubmit}
                  disabled={verifying || !riskScore || !apr}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Verify Receivable
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AMCReceivablesDashboard;

