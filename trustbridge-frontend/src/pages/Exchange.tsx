import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import { useToast } from '../hooks/useToast';
import { useWallet } from '../contexts/WalletContext';
import { novaxContractService } from '../services/novaxContractService';
import { ethers } from 'ethers';
import { 
  ArrowLeftRight, 
  ArrowDownUp,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Coins,
  TrendingUp,
  Info
} from 'lucide-react';

const Exchange: React.FC = () => {
  const { address, isConnected, provider } = useWallet();
  const { toast } = useToast();
  
  const [nvxBalance, setNvxBalance] = useState<number>(0);
  const [xtzBalance, setXtzBalance] = useState<string>('0');
  const [xtzAmount, setXtzAmount] = useState<string>('');
  const [nvxAmount, setNvxAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeDirection, setExchangeDirection] = useState<'XTZ_TO_NVX' | 'NVX_TO_XTZ'>('XTZ_TO_NVX');
  const [exchangeRate] = useState(100); // 1 XTZ = 100 NVX tokens
  const [exchangeFee] = useState(0.1); // 0.1 XTZ fee
  
  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
    }
  }, [isConnected, address]);

  const fetchBalances = async () => {
    await Promise.all([fetchNVXBalance(), fetchXtzBalance()]);
  };

  const fetchNVXBalance = async () => {
    try {
      setIsLoading(true);
      if (!address) return;
      console.log('🔍 Fetching NVX balance for address:', address);
      const balanceBigInt = await novaxContractService.getNVXBalance(address);
      const balanceNumber = Number(balanceBigInt) / 1e18; // NVX has 18 decimals
      console.log('📊 NVX balance received:', balanceNumber);
      setNvxBalance(balanceNumber);
    } catch (error) {
      console.error('Failed to fetch NVX balance:', error);
      setNvxBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchXtzBalance = async () => {
    try {
      if (!address || !provider) return;
      const balance = await provider.getBalance(address);
      const balanceInXtz = ethers.formatEther(balance);
      setXtzBalance(balanceInXtz);
    } catch (error) {
      console.error('Failed to fetch XTZ balance:', error);
      setXtzBalance('0');
    }
  };

  const calculateNVXAmount = (xtz: string) => {
    const xtzNum = parseFloat(xtz) || 0;
    if (xtzNum <= exchangeFee) return 0;
    const nvx = Math.floor((xtzNum - exchangeFee) * exchangeRate);
    return Math.max(0, nvx);
  };

  const calculateXtzAmount = (nvx: string) => {
    const nvxNum = parseFloat(nvx) || 0;
    const xtz = (nvxNum / exchangeRate) + exchangeFee;
    return xtz;
  };

  const handleAmountChange = (value: string) => {
    if (exchangeDirection === 'XTZ_TO_NVX') {
      setXtzAmount(value);
      setNvxAmount(calculateNVXAmount(value));
    } else {
      setNvxAmount(parseFloat(value) || 0);
      setXtzAmount(calculateXtzAmount(value).toFixed(6));
    }
  };

  const handleSwap = () => {
    setExchangeDirection(prev => prev === 'XTZ_TO_NVX' ? 'NVX_TO_XTZ' : 'XTZ_TO_NVX');
    setXtzAmount('');
    setNvxAmount(0);
  };

  const handleExchange = async () => {
    if (!address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to exchange tokens',
        variant: 'destructive'
      });
      return;
    }

    if (!provider) {
      toast({
        title: 'Provider Not Available',
        description: 'Please reconnect your wallet',
        variant: 'destructive'
      });
      return;
    }

    if (exchangeDirection === 'XTZ_TO_NVX') {
      if (!xtzAmount || parseFloat(xtzAmount) <= 0) {
        toast({
          title: 'Invalid Amount',
          description: 'Please enter a valid XTZ amount',
          variant: 'destructive'
        });
        return;
      }

      if (parseFloat(xtzAmount) > parseFloat(xtzBalance || '0')) {
        toast({
          title: 'Insufficient Balance',
          description: 'You do not have enough XTZ for this exchange',
          variant: 'destructive'
        });
        return;
      }

      setIsExchanging(true);

      try {
        console.log(`Exchanging ${xtzAmount} XTZ for ${nvxAmount} NVX tokens`);
        
        // TODO: Implement XTZ to NVX exchange using novaxContractService
        // This would require a swap contract or DEX integration
        toast({
          title: 'Coming Soon',
          description: 'XTZ to NVX exchange will be available soon. Please use a DEX to swap XTZ for NVX.',
          variant: 'default'
        });

        // Refresh balances
        await fetchBalances();
        setXtzAmount('');
        setNvxAmount(0);
      } catch (error: any) {
        console.error('Exchange failed:', error);
        toast({
          title: 'Exchange Failed',
          description: error.message || 'Failed to exchange tokens',
          variant: 'destructive'
        });
      } finally {
        setIsExchanging(false);
      }
    } else {
      // NVX_TO_XTZ - Not implemented yet
      toast({
        title: 'Coming Soon',
        description: 'NVX to XTZ exchange will be available soon',
        variant: 'default'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-blue to-primary-blue-light rounded-full mb-4">
            <ArrowLeftRight className="w-8 h-8 text-midnight-900" />
          </div>
          <h1 className="text-4xl font-bold text-off-white mb-2">
            Token Exchange
          </h1>
          <p className="text-off-white/70 text-lg">
            Exchange XTZ for NVX tokens
          </p>
        </div>

        {/* Exchange Card */}
        <Card className="bg-midnight-800/50 border-medium-gray/30">
          <CardContent className="p-8">
            {/* Balances */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-midnight-900/50 rounded-lg p-4 border border-medium-gray/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-primary-blue/20 rounded-full flex items-center justify-center">
                    <Coins className="w-4 h-4 text-primary-blue" />
                  </div>
                  <span className="text-sm text-text-secondary">XTZ Balance</span>
                </div>
                <div className="text-2xl font-bold text-off-white">
                  {parseFloat(xtzBalance || '0').toFixed(4)}
                </div>
              </div>

              <div className="bg-midnight-900/50 rounded-lg p-4 border border-medium-gray/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-primary-blue-light/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary-blue-light" />
                  </div>
                  <span className="text-sm text-text-secondary">NVX Balance</span>
                </div>
                <div className="text-2xl font-bold text-off-white">
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary-blue" />
                  ) : (
                    nvxBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })
                  )}
                </div>
              </div>
            </div>

            {/* Exchange Form */}
            <div className="bg-midnight-900/30 rounded-xl p-6 border border-medium-gray/20">
              <div className="space-y-4">
                {/* From */}
                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {exchangeDirection === 'XTZ_TO_NVX' ? 'From (XTZ)' : 'From (NVX)'}
                  </label>
                  <Input
                    type="number"
                    value={exchangeDirection === 'XTZ_TO_NVX' ? xtzAmount : nvxAmount.toString()}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="text-lg pr-12"
                    disabled={isExchanging}
                  />
                  <button
                    onClick={fetchBalances}
                    className="absolute right-3 top-9 p-1 text-text-secondary hover:text-primary-blue transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center -my-2">
                  <button
                    onClick={handleSwap}
                    className="p-3 bg-gradient-to-r from-primary-blue/20 to-primary-blue-light/20 rounded-full border border-primary-blue/40 hover:from-primary-blue/30 hover:to-primary-blue-light/30 transition-all duration-200 transform hover:scale-110"
                    disabled={isExchanging}
                  >
                    <ArrowDownUp className="w-6 h-6 text-primary-blue" />
                  </button>
                </div>

                {/* To */}
                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {exchangeDirection === 'XTZ_TO_NVX' ? 'To (NVX)' : 'To (XTZ)'}
                  </label>
                  <Input
                    type="number"
                    value={exchangeDirection === 'XTZ_TO_NVX' ? nvxAmount.toString() : xtzAmount}
                    readOnly
                    className="text-lg bg-midnight-900/50"
                  />
                </div>
              </div>

              {/* Exchange Rate */}
              <div className="mt-6 p-4 bg-primary-blue/10 rounded-lg border border-primary-blue/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary-blue mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-text-secondary">
                    <p className="font-medium mb-1">Exchange Rate</p>
                    <p className="text-off-white">1 XTZ = {exchangeRate} NVX</p>
                    <p className="mt-1">Fee: {exchangeFee} XTZ per transaction</p>
                  </div>
                </div>
              </div>

              {/* Exchange Button */}
              <Button
                onClick={handleExchange}
                disabled={isExchanging || !address || (exchangeDirection === 'XTZ_TO_NVX' && (!xtzAmount || parseFloat(xtzAmount) <= 0)) || (exchangeDirection === 'NVX_TO_XTZ' && (!nvxAmount || nvxAmount <= 0))}
                className="w-full mt-6"
                variant="default"
              >
                {isExchanging ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Exchanging...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-5 h-5 mr-2" />
                    Exchange Tokens
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="mt-6 bg-midnight-800/50 border-medium-gray/30">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-off-white mb-4">About the Exchange</h3>
            <div className="space-y-3 text-text-secondary">
              <p className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary-blue mt-0.5 flex-shrink-0" />
                <span>Exchange XTZ for NVX tokens at a fixed rate of 1:100</span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary-blue mt-0.5 flex-shrink-0" />
                <span>All exchanges are executed on-chain for transparency and security</span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary-blue mt-0.5 flex-shrink-0" />
                <span>NVX tokens are used for governance, staking, and platform rewards</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Exchange;
