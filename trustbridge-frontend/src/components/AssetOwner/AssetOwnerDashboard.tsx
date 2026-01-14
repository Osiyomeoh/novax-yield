import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useToast } from '../../hooks/useToast';
import { DollarSign, TrendingUp, FileText, Upload, CheckCircle, XCircle, Clock } from 'lucide-react';
import Button from '../UI/Button';

interface AssetOwnerData {
  ownerAddress: string;
  totalAssets: number;
  totalCapitalReceived: number;
  totalRevenueReceived: number;
  assets: Array<{
    assetId: string;
    name: string;
    totalValue: string;
    ownershipPercentage: number;
    tokenizedPercentage: number;
    capitalReceived: number;
    totalRevenueReceived: number;
    poolIds: string[];
    status: string;
  }>;
  revenueReports: Array<{
    reportId: string;
    assetId: string;
    periodStart: string;
    periodEnd: string;
    netProfit: number;
    status: string;
  }>;
}

interface RevenueReport {
  reportId: string;
  assetId: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  expenses: number;
  netProfit: number;
  status: string;
  documentHashes: string[];
}

const AssetOwnerDashboard: React.FC = () => {
  const { address, isConnected } = useWallet();
  const { toast } = useToast();
  const [ownerData, setOwnerData] = useState<AssetOwnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [revenueForm, setRevenueForm] = useState({
    periodStart: '',
    periodEnd: '',
    grossRevenue: '',
    expenses: '',
    documentHashes: [] as string[],
  });

  useEffect(() => {
    if (isConnected && address) {
      fetchOwnerData();
    }
  }, [isConnected, address]);

  const fetchOwnerData = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error('VITE_API_URL is not configured. Please set the environment variable.');
      }
      
      const response = await fetch(`${apiUrl}/asset-owners/${address}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOwnerData(data);
      } else {
        // Owner might not exist yet (no assets created)
        setOwnerData({
          ownerAddress: address,
          totalAssets: 0,
          totalCapitalReceived: 0,
          totalRevenueReceived: 0,
          assets: [],
          revenueReports: [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch owner data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load asset owner data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRevenueReport = async () => {
    if (!selectedAsset || !revenueForm.periodStart || !revenueForm.periodEnd || !revenueForm.grossRevenue || !revenueForm.expenses) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error('VITE_API_URL is not configured. Please set the environment variable.');
      }
      
      const response = await fetch(`${apiUrl}/asset-owners/revenue/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetId: selectedAsset,
          periodStart: revenueForm.periodStart,
          periodEnd: revenueForm.periodEnd,
          grossRevenue: parseFloat(revenueForm.grossRevenue),
          expenses: parseFloat(revenueForm.expenses),
          documentHashes: revenueForm.documentHashes,
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Revenue report submitted successfully. Waiting for AMC verification.',
          variant: 'default'
        });
        setShowRevenueForm(false);
        setRevenueForm({
          periodStart: '',
          periodEnd: '',
          grossRevenue: '',
          expenses: '',
          documentHashes: [],
        });
        fetchOwnerData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit revenue report');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit revenue report',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading asset owner data...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please connect your wallet to view your assets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Asset Owner Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your assets, track revenue, and view capital received</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Assets</p>
                <p className="text-2xl font-bold text-gray-900">{ownerData?.totalAssets || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Capital Received</p>
                <p className="text-2xl font-bold text-green-600">
                  {ownerData?.totalCapitalReceived ? ownerData.totalCapitalReceived.toFixed(2) : '0.00'} TRUST
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600">
                  {ownerData?.totalRevenueReceived ? ownerData.totalRevenueReceived.toFixed(2) : '0.00'} TRUST
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue Reports</p>
                <p className="text-2xl font-bold text-gray-900">{ownerData?.revenueReports.length || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        {/* Assets List */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Your Assets</h2>
            <Button
              onClick={() => setShowRevenueForm(!showRevenueForm)}
              className="bg-blue-600 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Submit Revenue Report
            </Button>
          </div>

          {ownerData?.assets && ownerData.assets.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {ownerData.assets.map((asset) => (
                <div key={asset.assetId} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{asset.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">Asset ID: {asset.assetId.substring(0, 16)}...</p>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Value</p>
                          <p className="text-sm font-semibold">{asset.totalValue} TRUST</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Your Ownership</p>
                          <p className="text-sm font-semibold">{asset.ownershipPercentage}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Tokenized</p>
                          <p className="text-sm font-semibold">{asset.tokenizedPercentage}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Capital Received</p>
                          <p className="text-sm font-semibold text-green-600">{asset.capitalReceived.toFixed(2)} TRUST</p>
                        </div>
                      </div>
                      {asset.totalRevenueReceived > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">Total Revenue Received</p>
                          <p className="text-sm font-semibold text-purple-600">{asset.totalRevenueReceived.toFixed(2)} TRUST</p>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        asset.status === 'ACTIVE_AMC_MANAGED' ? 'bg-green-100 text-green-800' :
                        asset.status === 'VERIFIED' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {asset.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No assets found. Create an asset to get started.</p>
            </div>
          )}
        </div>

        {/* Revenue Report Form */}
        {showRevenueForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Submit Revenue Report</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Asset</label>
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Select an asset</option>
                  {ownerData?.assets.map((asset) => (
                    <option key={asset.assetId} value={asset.assetId}>{asset.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Period Start</label>
                  <input
                    type="date"
                    value={revenueForm.periodStart}
                    onChange={(e) => setRevenueForm({ ...revenueForm, periodStart: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Period End</label>
                  <input
                    type="date"
                    value={revenueForm.periodEnd}
                    onChange={(e) => setRevenueForm({ ...revenueForm, periodEnd: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gross Revenue (TRUST)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={revenueForm.grossRevenue}
                    onChange={(e) => setRevenueForm({ ...revenueForm, grossRevenue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expenses (TRUST)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={revenueForm.expenses}
                    onChange={(e) => setRevenueForm({ ...revenueForm, expenses: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {revenueForm.grossRevenue && revenueForm.expenses && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Net Profit:</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(parseFloat(revenueForm.grossRevenue) - parseFloat(revenueForm.expenses)).toFixed(2)} TRUST
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleSubmitRevenueReport}
                  className="bg-blue-600 text-white"
                >
                  Submit Report
                </Button>
                <Button
                  onClick={() => setShowRevenueForm(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Reports History */}
        {ownerData?.revenueReports && ownerData.revenueReports.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Revenue Reports</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {ownerData.revenueReports.map((report) => (
                <div key={report.reportId} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">Report {report.reportId.substring(0, 12)}...</h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                          report.status === 'DISTRIBUTED' ? 'bg-green-100 text-green-800' :
                          report.status === 'VERIFIED' ? 'bg-blue-100 text-blue-800' :
                          report.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                          report.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {report.status === 'DISTRIBUTED' && <CheckCircle className="w-3 h-3" />}
                          {report.status === 'SUBMITTED' && <Clock className="w-3 h-3" />}
                          {report.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                          {report.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Period: {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        Net Profit: {report.netProfit.toFixed(2)} TRUST
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetOwnerDashboard;

