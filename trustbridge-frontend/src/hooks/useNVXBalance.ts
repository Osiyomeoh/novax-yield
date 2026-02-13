import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { novaxContractService } from '../services/novaxContractService';

export const useNVXBalance = () => {
  const { address, isConnected } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalance();
    } else {
      setBalance(0);
      setLoading(false);
    }
  }, [isConnected, address]);

  const fetchBalance = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const balanceBigInt = await novaxContractService.getNVXBalance(address);
      // NVX token has 18 decimals
      const balanceNumber = Number(balanceBigInt) / 1e18;
      setBalance(balanceNumber);
    } catch (error) {
      console.error('Failed to fetch NVX balance:', error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  return {
    balance,
    loading,
    refreshBalance: fetchBalance
  };
};

