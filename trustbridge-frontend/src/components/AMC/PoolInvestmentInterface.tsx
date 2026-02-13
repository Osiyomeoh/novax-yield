import React, { useState, formatCurrency } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Calendar, 
  Target,
  Shield,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CheckCircle,
  AlertTriangle,
  Lock
} from 'lucide-react';

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
  dividends: any[];
  metadata: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    liquidity: 'HIGH' | 'MEDIUM' | 'LOW';
    diversification: number;
  };
}

interface InvestmentForm {
  amount: number;
  paymentMethod: 'USDC' | 'USD';
}

interface PoolInvestmentInterfaceProps {
  pool: AMCPool;
  onInvest: (investmentData: { poolId: string; amount: number; investorAddress: string }) => Promise<void>;
  onClose: () => void;
}

const PoolInvestmentInterface: React.FC<PoolInvestmentInterfaceProps> = ({ 
  pool, 
  onInvest, 
  onClose 
}) => {
  const [investmentForm, setInvestmentForm] = useState<InvestmentForm>({
    amount: pool.minimumInvestment,
    paymentMethod: 'HBAR'
  });
  const [isInvesting, setIsInvesting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleInvest = async () => {
    if (investmentForm.amount < pool.minimumInvestment) {
      alert(`Minimum investment is $${pool.minimumInvestment}`);
      return;
    }

    setIsInvesting(true);
    try {
      // Get investor address from wallet context or localStorage
      const investorAddress = localStorage.getItem('walletAddress') || '0x0000000000000000000000000000000000000000';
      
      await onInvest({
        poolId: pool.poolId,
        amount: investmentForm.amount,
        investorAddress
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Investment failed:', error);
      alert('Investment failed. Please try again.');
    } finally {
      setIsInvesting(false);
    }
  };

  const calculateTokens = () => {
    return Math.floor(investmentForm.amount / pool.tokenPrice);
  };

  const calculateExpectedReturns = () => {
    const tokens = calculateTokens();
    const annualReturn = (investmentForm.amount * pool.expectedAPY) / 100;
    const monthlyReturn = annualReturn / 12;
    return { annualReturn, monthlyReturn, tokens };
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-primary-blue bg-primary-blue';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-100';
      case 'HIGH': return 'text-red-400 bg-red-100';
      default: return 'text-gray-400 bg-gray-100';
    }
  };

  const getLiquidityColor = (liquidity: string) => {
    switch (liquidity) {
      case 'HIGH': return 'text-primary-blue bg-primary-blue';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-100';
      case 'LOW': return 'text-red-400 bg-red-100';
      default: return 'text-gray-400 bg-gray-100';
    }
  };

  const returns = calculateExpectedReturns();

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-primary-blue mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary-blue mb-2">Investment Successful!</h2>
          <p className="text-text-secondary mb-4">
            You have successfully invested ${investmentForm.amount.toLocaleString()} in {pool.name}
          </p>
          <p className="text-sm text-text-secondary">
            You will receive {returns.tokens.toLocaleString()} pool tokens
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-primary-blue mb-2">{pool.name}</h2>
            <p className="text-text-secondary">{pool.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pool Information */}
          <div className="space-y-6">
            {/* Pool Stats */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Pool Statistics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-text-secondary text-sm">Total Value</p>
                  <p className="text-xl font-bold text-primary-blue">${pool.totalValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">Expected APY</p>
                  <p className="text-xl font-bold text-primary-blue">{pool.expectedAPY}%</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">Total Investors</p>
                  <p className="text-xl font-bold text-blue-400">{pool.totalInvestors}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">Funding Progress</p>
                  <p className="text-xl font-bold text-purple-400">
                    {Math.round((pool.totalInvested / pool.totalValue) * 100)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Risk & Liquidity */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Risk Assessment
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Risk Level</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(pool.metadata.riskLevel)}`}>
                    {pool.metadata.photLevel}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Liquidity</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLiquidityColor(pool.metadata.liquidity)}`}>
                    {pool.metadata.liquidity}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Diversification</span>
                  <span className="text-white">{pool.metadata.diversification} assets</span>
                </div>
              </div>
            </div>

            {/* Pool Assets */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Pool Assets ({pool.assets.length})
              </h3>
              <div className="space-y-2">
                {pool.assets.map((asset, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-600 last:border-b-0">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-text-secondary">{asset.percentage}% of pool</p>
                    </div>
                    <p className="font-semibold">${asset.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Dividends */}
            {pool.dividends && pool.dividends.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Recent Dividends
                </h3>
                <div className="space-y-2">
                  {pool.dividends.slice(0, 3).map((dividend, index) => (
                    <div key={index} className="flex justify-between items-center py-2">
                      <div>
                        <p className="font-medium">${dividend.perToken.toFixed(4)} per token</p>
                        <p className="text-sm text-text-secondary">
                          {new Date(dividend.distributedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-primary-blue font-semibold">
                        ${dividend.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Investment Form */}
          <div className="space-y-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Investment Calculator
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Investment Amount ($)</label>
                  <input
                    type="number"
                    value={investmentForm.amount}
                    onChange={(e) => setInvestmentForm({...investmentForm, amount: parseFloat(e.target.value) || 0})}
                    min={pool.minimumInvestment}
                    step="0.01"
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Minimum: ${pool.minimumInvestment.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Payment Method</label>
                  <select
                    value={investmentForm.paymentMethod}
                    onChange={(e) => setInvestmentForm({...investmentForm, paymentMethod: e.target.value as any})}
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                  >
                    <option value="HBAR">HBAR</option>
                    <option value="USDC">USDC</option>
                    <option value="USD">USD (Stripe)</option>
                  </select>
                </div>

                {/* Investment Summary */}
                <div className="bg-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Investment Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Investment Amount</span>
                      <span className="font-semibold">${investmentForm.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Pool Tokens</span>
                      <span className="font-semibold">{returns.tokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Token Price</span>
                      <span className="font-semibold">${pool.tokenPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Expected Annual Return</span>
                      <span className="font-semibold text-primary-blue">${returns.annualReturn.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Expected Monthly Return</span>
                      <span className="font-semibold text-primary-blue">${returns.monthlyReturn.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Maturity Info */}
                <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">Maturity Date</span>
                  </div>
                  <p className="text-text-secondary">
                    {new Date(pool.maturityDate).toLocaleDateString()} 
                    ({Math.ceil((new Date(pool.maturityDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days)
                  </p>
                </div>

                {/* Investment Button */}
                <button
                  onClick={handleInvest}
                  disabled={isInvesting || investmentForm.amount < pool.minimumInvestment}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                    isInvesting || investmentForm.amount < pool.minimumInvestment
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-blue text-black hover:bg-primary-blue-light'
                  }`}
                >
                  {isInvesting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                      Processing Investment...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Invest ${investmentForm.amount.toLocaleString()}
                    </>
                  )}
                </button>

                {/* Disclaimers */}
                <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-400 mb-1">Investment Disclaimer</p>
                      <ul className="text-text-secondary space-y-1">
                        <li>• Investments are subject to market risks</li>
                        <li>• Past performance does not guarantee future returns</li>
                        <li>• Please read the pool documentation before investing</li>
                        <li>• Your investment may lose value</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoolInvestmentInterface;
