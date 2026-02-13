import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Plus, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Loader2,
  Eye,
  Clock,
  ExternalLink,
  Shield
} from 'lucide-react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { novaxContractService } from '../../services/novaxContractService';
import { ethers } from 'ethers';
import { networkConfig, novaxContractAddresses } from '../../config/contracts';
import Button from '../UI/Button';
import Card from '../UI/Card';
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
}

const ReceivablesDashboard: React.FC = () => {
  const { address, signer, isConnected, provider } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (signer && provider) {
      novaxContractService.initialize(signer, provider);
    }
  }, [signer, provider]);

  useEffect(() => {
    if (isConnected && address) {
      fetchReceivables();
    }
  }, [isConnected, address]);

  // Check for refresh flag from navigation
  useEffect(() => {
    const shouldRefresh = sessionStorage.getItem('refreshReceivables');
    if (shouldRefresh === 'true') {
      console.log('🔄 Refreshing receivables after creation...');
      setTimeout(() => {
        fetchReceivables();
        sessionStorage.removeItem('refreshReceivables');
      }, 2000); // Wait 2 seconds for blockchain state to update
    }
  }, []);

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

      console.log('📥 Fetching receivables for exporter:', address);
      console.log('🔗 Contract Address:', novaxContractAddresses.RECEIVABLE_FACTORY);
      console.log('🌐 Network:', networkConfig.name);
      console.log('✅ Using REAL on-chain contract mapping (NOT mocked data)');
      
      // Use the contract's built-in mapping - MUCH FASTER and no block range limits!
      // This is a REAL on-chain call to the contract's storage mapping
      const receivableIds = await novaxContractService.getExporterReceivables(address);
      
      console.log(`📊 Found ${receivableIds.length} receivables for exporter (ON-CHAIN DATA)`);
      console.log('📋 Receivable IDs:', receivableIds);

      if (receivableIds.length === 0) {
        setReceivables([]);
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
            } as Receivable;
          } catch (error) {
            console.error(`Error fetching receivable ${id}:`, error);
            return null;
          }
        })
      );

      // Filter out null values (failed fetches)
      const validReceivables = receivablesData.filter((rec): rec is Receivable => rec !== null);
      
      console.log(`✅ Loaded ${validReceivables.length} receivables for user ${address}`);
      setReceivables(validReceivables);
      
      if (validReceivables.length === 0 && receivableIds.length > 0) {
        toast({
          title: 'No Receivables Found',
          description: 'You have no receivables yet. Create your first receivable to get started.',
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

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="p-8">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Not Connected</h2>
            <p className="text-gray-600 mb-6">Please connect your wallet to view your trade receivables.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Trade Receivables</h1>
            <p className="text-gray-600">Manage your invoice receivables and track their status</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => navigate('/dashboard/create-receivable')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Receivable
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Total Receivables</p>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : receivables.length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Pending</p>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {receivables.filter(r => r.status === 0).length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Verified</p>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">
                {receivables.filter(r => r.status === 1).length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Total Value</p>
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `$${receivables.reduce((sum, r) => sum + Number(formatAmount(r.amountUSD)), 0).toLocaleString()}`
                )}
              </p>
            </div>
          </Card>
        </div>

        {/* Receivables List */}
        {loading ? (
          <Card className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading receivables...</p>
          </Card>
        ) : receivables.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
              <FileText className="w-16 h-16 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">No Receivables Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start by creating your first trade receivable. Tokenize your invoices for immediate liquidity.
            </p>
            <Button
              onClick={() => navigate('/dashboard/create-receivable')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Receivable
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {receivables.map((receivable) => {
              const statusInfo = getStatusInfo(receivable.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <motion.div
                  key={receivable.receivableId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="hover:shadow-lg transition-shadow relative">
                    <div className="p-6">
                      {/* On-Chain Verification Badge */}
                      <div className="absolute top-4 right-4 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                        <Shield className="w-3 h-3" />
                        <span>On-Chain</span>
                      </div>
                      
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  Receivable #{receivable.receivableId.slice(0, 10)}...
                                </h3>
                                <a
                                  href={`${networkConfig.explorer}/address/${novaxContractAddresses.RECEIVABLE_FACTORY}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="View on Etherlink Explorer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                              <p className="text-sm text-gray-500">
                                Importer: {receivable.importer.slice(0, 6)}...{receivable.importer.slice(-4)}
                              </p>
                              {receivable.createdAt && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Created: {formatDate(receivable.createdAt)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Amount</p>
                              <p className="text-lg font-semibold text-gray-900">
                                ${formatAmount(receivable.amountUSD)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Due Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatDate(receivable.dueDate)}
                              </p>
                            </div>
                            {receivable.riskScore !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {receivable.riskScore}/100
                                </p>
                              </div>
                            )}
                            {receivable.apr !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">APR</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {receivable.apr / 100}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Navigate to receivable detail page
                              toast({
                                title: 'Receivable Details',
                                description: 'Receivable detail view coming soon.',
                                variant: 'default'
                              });
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Info Box */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How Trade Receivables Work:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Create an invoice receivable that can be tokenized and financed</li>
                  <li>AMC will verify the receivable before it can be added to a pool</li>
                  <li>Once verified, investors can invest in pools backed by your receivables</li>
                  <li>You receive immediate liquidity while investors earn yield</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReceivablesDashboard;

