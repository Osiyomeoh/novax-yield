import { ethers } from 'ethers';

// Note: This service is for Ethereum-based pool operations
// TrustBridge uses Hedera HTS/HCS for pool management, not Ethereum contracts
// This file is kept for reference but not used in production

// Deployed contract addresses from hedera-universal-system.json
// PoolManager address - should be loaded from environment variables
// Updated to latest deployment: 0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80
const POOL_MANAGER_ADDRESS = import.meta.env.VITE_POOL_MANAGER_ADDRESS || "0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80";
const POOL_TOKEN_ADDRESS = "0x17c1041bDe225E45399F048191152BaD19006548";

export interface Pool {
  id: string;
  manager: string;
  name: string;
  description: string;
  totalValue: string;
  targetValue: string;
  currentValue: string;
  minInvestment: string;
  maxInvestment: string;
  managementFee: string;
  performanceFee: string;
  isActive: boolean;
  createdAt: string;
  maturityDate: string;
  poolToken: string;
  totalInvestors: string;
}

export interface PoolCreationParams {
  name: string;
  description: string;
  targetValue: string;
  minInvestment: string;
  maxInvestment: string;
  managementFee: string;
  performanceFee: string;
  maturityDate: string;
}

export interface InvestmentParams {
  poolId: string;
  amount: string;
}

class PoolService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private poolManagerContract: ethers.Contract | null = null;
  private poolTokenContract: ethers.Contract | null = null;
  private isConnected = false;

  public initialize(provider: ethers.BrowserProvider | null, signer: ethers.Signer | null) {
    this.provider = provider;
    this.signer = signer;
    this.isConnected = !!provider && !!signer;

    if (this.isConnected && this.signer) {
      this.poolManagerContract = new ethers.Contract(POOL_MANAGER_ADDRESS, PoolManagerABI.abi, this.signer);
      this.poolTokenContract = new ethers.Contract(POOL_TOKEN_ADDRESS, PoolTokenABI.abi, this.signer);
    } else {
      this.poolManagerContract = null;
      this.poolTokenContract = null;
    }
    console.log('PoolService initialized:', this.isConnected);
  }

  public async ensureHederaTestnet(): Promise<boolean> {
    if (!window.ethereum) {
      console.error("MetaMask is not installed!");
      return false;
    }

    const HEDERA_TESTNET_CHAIN_ID = '0x128'; // 296 in decimal
    const HEDERA_TESTNET_RPC_URL = 'https://testnet.hashio.io/api';
    const HEDERA_TESTNET_CHAIN_NAME = 'Hedera Testnet';
    const HEDERA_TESTNET_CURRENCY_SYMBOL = 'HBAR';

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });

      if (chainId !== HEDERA_TESTNET_CHAIN_ID) {
        console.log('Switching to Hedera Testnet...');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: HEDERA_TESTNET_CHAIN_ID }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: HEDERA_TESTNET_CHAIN_ID,
                    chainName: HEDERA_TESTNET_CHAIN_NAME,
                    rpcUrls: [HEDERA_TESTNET_RPC_URL],
                    nativeCurrency: {
                      name: HEDERA_TESTNET_CURRENCY_SYMBOL,
                      symbol: HEDERA_TESTNET_CURRENCY_SYMBOL,
                      decimals: 18,
                    },
                    blockExplorerUrls: ['https://hashscan.io/testnet/'],
                  },
                ],
              });
            } catch (addError) {
              console.error('Failed to add Hedera Testnet:', addError);
              return false;
            }
          } else {
            console.error('Failed to switch to Hedera Testnet:', switchError);
            return false;
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error ensuring Hedera Testnet:', error);
      return false;
    }
  }

  public async createPool(params: PoolCreationParams): Promise<{ success: boolean; poolId?: string; transactionHash?: string; error?: string }> {
    if (!this.poolManagerContract || !this.signer || !this.isConnected) {
      return { success: false, error: 'Wallet not connected or contract not initialized.' };
    }

    const isHederaTestnet = await this.ensureHederaTestnet();
    if (!isHederaTestnet) {
      return { success: false, error: 'Failed to connect to Hedera Testnet.' };
    }

    try {
      console.log('Creating pool with params:', params);

      const tx = await this.poolManagerContract.createPool(
        params.name,
        params.description,
        ethers.parseEther(params.targetValue),
        ethers.parseEther(params.minInvestment),
        ethers.parseEther(params.maxInvestment),
        ethers.parseUnits(params.managementFee, 2), // Convert percentage to basis points
        ethers.parseUnits(params.performanceFee, 2), // Convert percentage to basis points
        Math.floor(new Date(params.maturityDate).getTime() / 1000) // Convert to Unix timestamp
      );

      console.log('Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Extract pool ID from events
      let poolId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const parsedLog = this.poolManagerContract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === 'PoolCreated') {
            poolId = parsedLog.args.poolId;
            break;
          }
        } catch (e) {
          // Not a PoolCreated event, continue
        }
      }

      return {
        success: true,
        poolId: poolId,
        transactionHash: tx.hash,
      };
    } catch (error) {
      console.error('Pool creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async investInPool(params: InvestmentParams): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.poolManagerContract || !this.signer || !this.isConnected) {
      return { success: false, error: 'Wallet not connected or contract not initialized.' };
    }

    const isHederaTestnet = await this.ensureHederaTestnet();
    if (!isHederaTestnet) {
      return { success: false, error: 'Failed to connect to Hedera Testnet.' };
    }

    try {
      console.log('Investing in pool:', params);

      const tx = await this.poolManagerContract.invest(
        params.poolId,
        { value: ethers.parseEther(params.amount) }
      );

      console.log('Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      console.error('Pool investment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getPool(poolId: string): Promise<Pool | null> {
    if (!this.poolManagerContract) {
      return null;
    }

    try {
      const pool = await this.poolManagerContract.getPool(poolId);
      return {
        id: pool.id,
        manager: pool.manager,
        name: pool.name,
        description: pool.description,
        totalValue: ethers.formatEther(pool.totalValue),
        targetValue: ethers.formatEther(pool.targetValue),
        currentValue: ethers.formatEther(pool.currentValue),
        minInvestment: ethers.formatEther(pool.minInvestment),
        maxInvestment: ethers.formatEther(pool.maxInvestment),
        managementFee: ethers.formatUnits(pool.managementFee, 2),
        performanceFee: ethers.formatUnits(pool.performanceFee, 2),
        isActive: pool.isActive,
        createdAt: new Date(Number(pool.createdAt) * 1000).toISOString(),
        maturityDate: new Date(Number(pool.maturityDate) * 1000).toISOString(),
        poolToken: pool.poolToken,
        totalInvestors: pool.totalInvestors.toString(),
      };
    } catch (error) {
      console.error('Failed to get pool:', error);
      return null;
    }
  }

  public async getUserPools(userAddress: string): Promise<string[]> {
    if (!this.poolManagerContract) {
      return [];
    }

    try {
      return await this.poolManagerContract.getUserPools(userAddress);
    } catch (error) {
      console.error('Failed to get user pools:', error);
      return [];
    }
  }

  public async getUserInvestment(userAddress: string, poolId: string): Promise<string> {
    if (!this.poolManagerContract) {
      return '0';
    }

    try {
      const investment = await this.poolManagerContract.getUserInvestment(userAddress, poolId);
      return ethers.formatEther(investment);
    } catch (error) {
      console.error('Failed to get user investment:', error);
      return '0';
    }
  }

  public async getTotalPools(): Promise<number> {
    if (!this.poolManagerContract) {
      return 0;
    }

    try {
      return Number(await this.poolManagerContract.totalPools());
    } catch (error) {
      console.error('Failed to get total pools:', error);
      return 0;
    }
  }

  public async getTotalValueLocked(): Promise<string> {
    if (!this.poolManagerContract) {
      return '0';
    }

    try {
      const tvl = await this.poolManagerContract.totalValueLocked();
      return ethers.formatEther(tvl);
    } catch (error) {
      console.error('Failed to get total value locked:', error);
      return '0';
    }
  }
}

export const poolService = new PoolService();
