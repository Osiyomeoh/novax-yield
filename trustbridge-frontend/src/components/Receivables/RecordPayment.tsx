import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  Shield
} from 'lucide-react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useAdmin } from '../../contexts/AdminContext';
import { novaxContractService } from '../../services/novaxContractService';
import { ethers } from 'ethers';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Card from '../UI/Card';
import { useToast } from '../../hooks/useToast';

const RecordPayment: React.FC = () => {
  const { poolId } = useParams<{ poolId: string }>();
  const { address, signer, isConnected, provider } = useWallet();
  const { isAmcAdmin, isSuperAdmin, isPlatformAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');

  useEffect(() => {
    if (signer && provider) {
      novaxContractService.initialize(signer, provider);
    }
  }, [signer, provider]);

  useEffect(() => {
    if (poolId && isConnected && provider) {
      fetchPoolDetails();
    }
  }, [poolId, isConnected, provider]);

  // Check admin access
  if (!adminLoading && !isAmcAdmin && !isSuperAdmin && !isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You need AMC Admin privileges to record payments.
          </p>
          <Button onClick={() => navigate('/dashboard/admin')}>Go to Admin</Button>
        </div>
      </div>
    );
  }

  const fetchPoolDetails = async () => {
    if (!poolId || !provider) {
      return;
    }

    setLoading(true);
    try {
      if (signer && provider) {
        novaxContractService.initialize(signer, provider);
      } else if (provider) {
        novaxContractService.initialize(null as any, provider);
      }

      const poolData = await novaxContractService.getPool(poolId);
      
      // Convert contract data to readable format
      setPool({
        poolId: poolId,
        targetAmount: poolData.targetAmount,
        totalInvested: poolData.totalInvested,
        totalPaid: poolData.totalPaid || BigInt(0),
        status: Number(poolData.status),
        apr: Number(poolData.apr),
        maturityDate: Number(poolData.maturityDate),
        createdAt: Number(poolData.createdAt),
        paymentStatus: Number(poolData.paymentStatus || 0),
      });

      // Pre-fill payment amount with remaining amount
      const remaining = poolData.targetAmount - (poolData.totalPaid || BigInt(0));
      if (remaining > 0) {
        setPaymentAmount(ethers.formatUnits(remaining, 6));
      }
    } catch (error: any) {
      console.error('Error fetching pool:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch pool details: ${error.message || 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!poolId || !signer || !paymentAmount) {
      toast({
        title: 'Error',
        description: 'Please connect wallet and enter payment amount',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Payment amount must be greater than 0',
        variant: 'destructive'
      });
      return;
    }

    setRecording(true);
    try {
      // Convert to USDC (6 decimals)
      const paymentAmountUSDC = ethers.parseUnits(paymentAmount, 6);

      const result = await novaxContractService.recordPayment(poolId, paymentAmountUSDC);

      toast({
        title: 'Success',
        description: `Payment recorded successfully! Transaction: ${result.txHash.slice(0, 10)}...`,
        variant: 'default'
      });

      // Refresh pool details
      await fetchPoolDetails();
      
      // Clear form
      setPaymentAmount('');
      setPaymentDate('');
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Payment Recording Failed',
        description: error.message || 'Failed to record payment. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setRecording(false);
    }
  };

  const formatAmount = (amount: bigint) => {
    return ethers.formatUnits(amount, 6); // USDC has 6 decimals
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return 'ACTIVE';
      case 1: return 'FUNDED';
      case 2: return 'MATURED';
      case 3: return 'PAID';
      case 4: return 'DEFAULTED';
      case 5: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  };

  const getPaymentStatusLabel = (status: number) => {
    switch (status) {
      case 0: return 'PENDING';
      case 1: return 'PARTIAL';
      case 2: return 'FULL';
      default: return 'UNKNOWN';
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Not Connected</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to record payments.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading pool details...</p>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pool Not Found</h2>
          <p className="text-gray-600 mb-6">The pool you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/dashboard/admin/amc-pools')}>Back to Pools</Button>
        </div>
      </div>
    );
  }

  const remainingAmount = pool.targetAmount - pool.totalPaid;
  const canRecordPayment = pool.status === 1 || pool.status === 2; // FUNDED or MATURED

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/admin/amc-pools')}
            className="flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pools
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-gray-600 mt-1">Record payment received for this pool</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pool Details */}
          <div className="lg:col-span-2">
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Pool Details</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Pool ID</p>
                  <p className="font-mono text-sm text-gray-900 break-all">{pool.poolId.slice(0, 32)}...</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      pool.status === 3 ? 'bg-green-100 text-green-800' :
                      pool.status === 1 || pool.status === 2 ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(pool.status)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Payment Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      pool.paymentStatus === 2 ? 'bg-green-100 text-green-800' :
                      pool.paymentStatus === 1 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getPaymentStatusLabel(pool.paymentStatus)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Target Amount</p>
                    <p className="text-lg font-semibold text-gray-900">${formatAmount(pool.targetAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Invested</p>
                    <p className="text-lg font-semibold text-gray-900">${formatAmount(pool.totalInvested)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Paid</p>
                    <p className="text-lg font-semibold text-green-600">${formatAmount(pool.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Remaining</p>
                    <p className="text-lg font-semibold text-gray-900">${formatAmount(remainingAmount)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">APR</p>
                    <p className="text-sm font-medium text-gray-900">{(pool.apr / 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Maturity Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(pool.maturityDate)}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Form */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Record Payment</h2>

              {!canRecordPayment && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Pool Not Ready</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Pool must be FUNDED or MATURED to record payments. Current status: {getStatusLabel(pool.status)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount (USDC)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`Max: $${formatAmount(remainingAmount)}`}
                    disabled={!canRecordPayment || recording}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Remaining amount: ${formatAmount(remainingAmount)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    disabled={recording}
                  />
                </div>

                <Button
                  onClick={handleRecordPayment}
                  disabled={!canRecordPayment || recording || !paymentAmount}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {recording ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Recording Payment...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Record Payment
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Info Sidebar */}
          <div>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">When to Record</p>
                  <p className="text-gray-900">
                    Record payment when the importer pays the invoice. This updates the pool status and enables yield distribution.
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 mb-1">Payment Status</p>
                  <ul className="text-gray-900 space-y-1">
                    <li>• <strong>PENDING:</strong> No payment received</li>
                    <li>• <strong>PARTIAL:</strong> Partial payment received</li>
                    <li>• <strong>FULL:</strong> Full payment received</li>
                  </ul>
                </div>

                <div>
                  <p className="text-gray-500 mb-1">After Recording</p>
                  <p className="text-gray-900">
                    Once payment is recorded, you can distribute yield to investors from the Yield Distribution page.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordPayment;

