import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Wallet, Lock, TrendingUp, Clock, DollarSign, AlertCircle, CheckCircle, Info, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../UI/Card';
import Button from '../UI/Button';
import { useToast } from '../../hooks/useToast';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { stakingVaultService } from '../../services/stakingVaultService';

interface TierConfig {
  id: number;
  name: string;
  lockDays: number;
  apy: number;
  minStake: number;
  icon: string;
  color: string;
  benefits: string[];
}

const TIERS: TierConfig[] = [
  {
    id: 0,
    name: 'SILVER',
    lockDays: 30,
    apy: 8.5,
    minStake: 1000,
    icon: '🥈',
    color: 'from-gray-400 to-gray-600',
    benefits: ['Flexible 30-day lock', 'Auto-deployment to pools', 'Monthly compounding']
  },
  {
    id: 1,
    name: 'GOLD',
    lockDays: 90,
    apy: 9.5,
    minStake: 5000,
    icon: '🥇',
    color: 'from-yellow-400 to-yellow-600',
    benefits: ['90-day lock', 'Higher yield', 'Priority allocation', 'Auto-compounding']
  },
  {
    id: 2,
    name: 'PLATINUM',
    lockDays: 180,
    apy: 10.5,
    minStake: 10000,
    icon: '💎',
    color: 'from-cyan-400 to-cyan-600',
    benefits: ['180-day lock', 'Premium yield', 'VIP benefits', 'Advanced compounding']
  },
  {
    id: 3,
    name: 'DIAMOND',
    lockDays: 365,
    apy: 12,
    minStake: 25000,
    icon: '💍',
    color: 'from-purple-400 to-purple-600',
    benefits: ['365-day lock', 'Maximum yield', 'Exclusive perks', 'Optimal compounding']
  }
];

export const StakingVault: React.FC = () => {
  const { address, signer, isConnected, provider } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<any>(null);
  const [userStakes, setUserStakes] = useState<any[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierConfig>(TIERS[1]); // Default to GOLD
  const [stakeAmount, setStakeAmount] = useState('');
  const [autoCompound, setAutoCompound] = useState(true);
  const [canStake, setCanStake] = useState<boolean | null>(null);
  const [waitlistInfo, setWaitlistInfo] = useState<any>(null);

  useEffect(() => {
    if (signer && provider) {
      stakingVaultService.initialize(signer, provider);
      loadVaultData();
    }
  }, [signer, provider]);

  useEffect(() => {
    if (address) {
      loadUserStakes();
    }
  }, [address]);

  const loadVaultData = async () => {
    try {
      const status = await stakingVaultService.getVaultStatus();
      setVaultStatus(status);
    } catch (error) {
      console.error('Error loading vault status:', error);
    }
  };

  const loadUserStakes = async () => {
    if (!address) return;
    
    try {
      // Use efficient getter for user dashboard
      const dashboard = await stakingVaultService.getUserDashboard(address);
      setUserStakes(dashboard.stakes || []);
    } catch (error) {
      console.error('Error loading user stakes:', error);
      // Fallback to old method
      try {
        const stakes = await stakingVaultService.getUserStakes(address);
        setUserStakes(stakes);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  };

  const checkCapacity = async () => {
    if (!stakeAmount) return;
    
    try {
      const amount = ethers.parseUnits(stakeAmount, 6);
      const result = await stakingVaultService.canStake(amount);
      setCanStake(result.canStake);
      
      if (!result.canStake && result.shouldWaitlist) {
        const waitlist = await stakingVaultService.getWaitlistPosition(address!);
        setWaitlistInfo(waitlist);
      }
    } catch (error) {
      console.error('Error checking capacity:', error);
    }
  };

  const handleStake = async () => {
    if (!address || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to stake.',
        variant: 'destructive'
      });
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) < selectedTier.minStake) {
      toast({
        title: 'Invalid Amount',
        description: `Minimum stake for ${selectedTier.name} is $${selectedTier.minStake.toLocaleString()}`,
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const amount = ethers.parseUnits(stakeAmount, 6);

      toast({
        title: 'Staking...',
        description: 'Please confirm the transaction in your wallet.',
        variant: 'default'
      });

      const result = await stakingVaultService.stake(
        amount,
        selectedTier.id,
        autoCompound
      );

      toast({
        title: 'Stake Successful!',
        description: `Staked $${stakeAmount} at ${selectedTier.apy}% APY`,
        variant: 'default'
      });

      // Refresh data
      await loadVaultData();
      await loadUserStakes();
      setStakeAmount('');

    } catch (error: any) {
      console.error('Error staking:', error);
      toast({
        title: 'Staking Failed',
        description: error.message || 'Failed to stake. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (stakeIndex: number) => {
    try {
      setLoading(true);

      toast({
        title: 'Unstaking...',
        description: 'Please confirm the transaction in your wallet.',
        variant: 'default'
      });

      await stakingVaultService.unstake(stakeIndex);

      toast({
        title: 'Unstake Successful!',
        description: 'Your funds have been returned to your wallet.',
        variant: 'default'
      });

      await loadVaultData();
      await loadUserStakes();

    } catch (error: any) {
      console.error('Error unstaking:', error);
      toast({
        title: 'Unstaking Failed',
        description: error.message || 'Failed to unstake. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const utilizationPercent = vaultStatus 
    ? ((vaultStatus.deployed / vaultStatus.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-midnight-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-off-white mb-2">Staking Vault</h1>
          <p className="text-text-secondary">
            Stake USDC to earn yield from trade receivables. Auto-deployed to pools, yield distributed proportionally.
          </p>
        </motion.div>

        {/* Vault Status Card */}
        {vaultStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-midnight-800/50 border-medium-gray/30">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-off-white mb-6">Vault Status</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Total Staked</p>
                    <p className="text-2xl font-bold text-off-white">
                      ${vaultStatus.total.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Deployed</p>
                    <p className="text-2xl font-bold text-green-400">
                      ${vaultStatus.deployed.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Available</p>
                    <p className="text-2xl font-bold text-blue-400">
                      ${vaultStatus.available.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Utilization</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {utilizationPercent}%
                    </p>
                  </div>
                </div>

                {/* Utilization Bar */}
                <div className="mt-6">
                  <div className="h-3 bg-midnight-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-green-400 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${utilizationPercent}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    {parseFloat(utilizationPercent) >= 70
                      ? '✅ Optimal utilization - Full APY'
                      : parseFloat(utilizationPercent) >= 50
                      ? '⚠️ Moderate utilization - Reduced APY'
                      : '❌ Low utilization - Significantly reduced APY'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Tier Selection & Staking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tier Selection */}
            <Card className="bg-midnight-800/50 border-medium-gray/30">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-off-white mb-4">Select Tier</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TIERS.map((tier) => (
                    <motion.div
                      key={tier.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedTier(tier)}
                      className={`p-6 rounded-lg cursor-pointer transition-all ${
                        selectedTier.id === tier.id
                          ? 'bg-gradient-to-br ' + tier.color + ' text-white'
                          : 'bg-midnight-700/50 border border-medium-gray/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-4xl">{tier.icon}</span>
                        <span className="text-2xl font-bold">{tier.apy}%</span>
                      </div>
                      
                      <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                      
                      <div className="space-y-1 text-sm opacity-90">
                        <p className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {tier.lockDays} days lock
                        </p>
                        <p className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Min: ${tier.minStake.toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Staking Form */}
            <Card className="bg-midnight-800/50 border-medium-gray/30">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-off-white mb-6">Stake to Vault</h2>
                
                {/* Selected Tier Info */}
                <div className="bg-midnight-700/50 p-4 rounded-lg mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{selectedTier.icon}</span>
                      <div>
                        <h3 className="text-lg font-bold text-off-white">{selectedTier.name}</h3>
                        <p className="text-sm text-text-secondary">{selectedTier.lockDays} days • {selectedTier.apy}% APY</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">{selectedTier.apy}%</p>
                      <p className="text-xs text-text-secondary">APY</p>
                    </div>
                  </div>
                  
                  <ul className="space-y-2">
                    {selectedTier.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Amount Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-off-white mb-2">
                    Stake Amount (USDC)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      onBlur={checkCapacity}
                      placeholder={`Min: $${selectedTier.minStake.toLocaleString()}`}
                      className="w-full px-4 py-3 bg-midnight-700 border border-medium-gray/30 rounded-lg text-off-white focus:ring-2 focus:ring-primary-blue focus:border-primary-blue"
                    />
                    <DollarSign className="absolute right-3 top-3.5 w-5 h-5 text-text-secondary" />
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Minimum: ${selectedTier.minStake.toLocaleString()} USDC
                  </p>
                </div>

                {/* Auto-Compound Toggle */}
                <div className="mb-6">
                  <div className="flex items-center justify-between p-4 bg-midnight-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="font-medium text-off-white">Auto-Compound</p>
                        <p className="text-xs text-text-secondary">
                          Automatically restake yield for higher returns (+0.5-0.75% APY)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoCompound(!autoCompound)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        autoCompound ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <motion.div
                        className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full"
                        animate={{ x: autoCompound ? 24 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>

                {/* Capacity Warning */}
                {canStake === false && (
                  <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-400 mb-1">Vault Full</p>
                        <p className="text-sm text-yellow-300/80">
                          The vault is currently at capacity. You will be added to the waitlist and earn 5% APY while waiting.
                          {waitlistInfo && ` Current position: #${waitlistInfo.position + 1}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Projected Returns with Compounding Calculator */}
                {stakeAmount && parseFloat(stakeAmount) >= selectedTier.minStake && (
                  <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <h4 className="font-semibold text-blue-400 mb-3">Projected Returns</h4>
                    
                    {/* Lock Period Returns */}
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-text-secondary">Lock Period</p>
                        <p className="font-bold text-off-white">{selectedTier.lockDays} days</p>
                      </div>
                      <div>
                        <p className="text-text-secondary">APY</p>
                        <p className="font-bold text-green-400">{selectedTier.apy}%</p>
                      </div>
                      <div>
                        <p className="text-text-secondary">Simple Interest Yield</p>
                        <p className="font-bold text-off-white">
                          ${((parseFloat(stakeAmount) * selectedTier.apy / 100) * (selectedTier.lockDays / 365)).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-secondary">Total Return (Simple)</p>
                        <p className="font-bold text-off-white">
                          ${(parseFloat(stakeAmount) + (parseFloat(stakeAmount) * selectedTier.apy / 100) * (selectedTier.lockDays / 365)).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* 1-Year Compounding Projection */}
                    {autoCompound && (
                      <div className="mt-4 pt-4 border-t border-blue-500/20">
                        <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          1-Year Compounding Projection
                        </h5>
                        {(() => {
                          const principal = parseFloat(stakeAmount);
                          const annualApy = selectedTier.apy / 100;
                          const monthlyRate = annualApy / 12;
                          const months = 12;
                          
                          // Compound formula: A = P(1 + r/n)^(n*t)
                          const compoundedFinal = principal * Math.pow(1 + monthlyRate, months);
                          const compoundedYield = compoundedFinal - principal;
                          const simpleYield = principal * annualApy;
                          const extraYield = compoundedYield - simpleYield;
                          const effectiveApy = ((compoundedFinal / principal) - 1) * 100;
                          
                          return (
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Initial Investment:</span>
                                <span className="font-bold text-off-white">${principal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Simple Interest (1 year):</span>
                                <span className="text-off-white">${simpleYield.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Compounded (monthly):</span>
                                <span className="font-bold text-green-400">${compoundedYield.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-blue-500/10">
                                <span className="text-text-secondary">Extra from Compounding:</span>
                                <span className="font-bold text-green-400">+${extraYield.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Final Amount (1 year):</span>
                                <span className="font-bold text-green-400">${compoundedFinal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Effective APY:</span>
                                <span className="font-bold text-green-400">{effectiveApy.toFixed(2)}%</span>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="text-xs text-blue-300/80 mt-3 flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Monthly compounding automatically reinvests yield for higher returns
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stake Button */}
                <Button
                  onClick={handleStake}
                  disabled={!isConnected || loading || !stakeAmount}
                  className="w-full bg-gradient-to-r from-primary-blue to-primary-blue-light hover:opacity-90 text-midnight-900 font-semibold py-4 text-lg"
                >
                  {loading ? 'Staking...' : canStake === false ? 'Join Waitlist' : 'Stake Now'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: User Stakes */}
          <div className="space-y-6">
            {/* Your Stakes */}
            <Card className="bg-midnight-800/50 border-medium-gray/30">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-off-white mb-4">Your Stakes</h2>
                
                {userStakes.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                    <p className="text-text-secondary">No active stakes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userStakes.map((stake, idx) => {
                      const tier = TIERS.find(t => t.id === stake.tier) || TIERS[0];
                      const unlockDate = new Date(Number(stake.unlockAt) * 1000);
                      const isUnlocked = Date.now() >= unlockDate.getTime();
                      const principal = Number(ethers.formatUnits(stake.principal, 6));
                      
                      return (
                        <div
                          key={idx}
                          className="p-4 bg-midnight-700/50 border border-medium-gray/30 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{tier.icon}</span>
                              <div>
                                <p className="font-semibold text-off-white">{tier.name}</p>
                                <p className="text-xs text-text-secondary">{tier.apy}% APY</p>
                              </div>
                            </div>
                            {stake.autoCompound && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                Auto-Compound
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Staked</span>
                              <span className="text-off-white font-medium">${principal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Unlock Date</span>
                              <span className={isUnlocked ? 'text-green-400' : 'text-yellow-400'}>
                                {unlockDate.toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {isUnlocked && stake.active && (
                            <Button
                              onClick={() => handleUnstake(idx)}
                              disabled={loading}
                              variant="outline"
                              className="w-full mt-4"
                            >
                              Unstake
                            </Button>
                          )}
                          
                          {!isUnlocked && (
                            <div className="mt-3 text-xs text-text-secondary text-center">
                              <Lock className="w-4 h-4 inline mr-1" />
                              Locked for {Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} more days
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card className="bg-midnight-800/50 border-medium-gray/30">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-off-white mb-4">How It Works</h2>
                
                <div className="space-y-3 text-sm text-text-secondary">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-blue flex items-center justify-center text-midnight-900 font-bold flex-shrink-0">
                      1
                    </div>
                    <p>You stake USDC to the vault</p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-blue flex items-center justify-center text-midnight-900 font-bold flex-shrink-0">
                      2
                    </div>
                    <p>Vault auto-deploys your capital to trade receivable pools</p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-blue flex items-center justify-center text-midnight-900 font-bold flex-shrink-0">
                      3
                    </div>
                    <p>Earn yield from verified invoices (8-12% APY)</p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-blue flex items-center justify-center text-midnight-900 font-bold flex-shrink-0">
                      4
                    </div>
                    <p>Yield distributed proportionally to all stakers</p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-blue flex items-center justify-center text-midnight-900 font-bold flex-shrink-0">
                      5
                    </div>
                    <p>Unstake after lock period with principal + yield</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

