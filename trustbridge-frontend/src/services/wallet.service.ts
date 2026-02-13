import { 
  AccountId, 
  PrivateKey, 
  Client,
  Transaction
} from '@hashgraph/sdk';

export interface WalletInfo {
  accountId: string;
  privateKey?: PrivateKey;
  isConnected: boolean;
}

export interface WalletProvider {
  connect(): Promise<WalletInfo>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  getAccountId(): string | null;
  isConnected(): boolean;
}

export class WalletService {
  private static walletInfo: WalletInfo | null = null;
  private static provider: WalletProvider | null = null;

  /**
   * Set wallet provider (HashPack, Blade, etc.)
   */
  static setProvider(provider: WalletProvider): void {
    this.provider = provider;
  }

  /**
   * Connect to wallet
   */
  static async connect(): Promise<WalletInfo> {
    if (!this.provider) {
      throw new Error('No wallet provider set');
    }

    try {
      this.walletInfo = await this.provider.connect();
      return this.walletInfo;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  static async disconnect(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      await this.provider.disconnect();
      this.walletInfo = null;
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }

  /**
   * Sign a transaction
   */
  static async signTransaction(transaction: Transaction): Promise<Transaction> {
    if (!this.provider) {
      throw new Error('No wallet provider set');
    }

    if (!this.walletInfo?.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      return await this.provider.signTransaction(transaction);
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  }

  /**
   * Get current wallet info
   */
  static getWalletInfo(): WalletInfo | null {
    return this.walletInfo;
  }

  /**
   * Get current account ID
   */
  static getAccountId(): string | null {
    return this.walletInfo?.accountId || null;
  }

  /**
   * Check if wallet is connected
   */
  static isConnected(): boolean {
    return this.walletInfo?.isConnected || false;
  }

  /**
   * Get user's private key (if available)
   */
  static getPrivateKey(): PrivateKey | null {
    return this.walletInfo?.privateKey || null;
  }
}

// HashPack Wallet Provider
export class HashPackWalletProvider implements WalletProvider {
  private accountId: string | null = null;
  private privateKey: PrivateKey | null = null;
  private isConnectedFlag: boolean = false;

  async connect(): Promise<WalletInfo> {
    try {
      // Check if HashPack is available
      if (typeof window !== 'undefined' && (window as any).hashpack) {
        const hashpack = (window as any).hashpack;
        
        // Request connection
        const result = await hashpack.request({
          method: 'hashpack_connect',
          params: {}
        });

        if (result.success) {
          this.accountId = result.accountId;
          this.isConnectedFlag = true;
          
          return {
            accountId: this.accountId,
            isConnected: true
          };
        } else {
          throw new Error('Failed to connect to HashPack');
        }
      } else {
        throw new Error('HashPack wallet not found');
      }
    } catch (error) {
      console.error('HashPack connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).hashpack) {
        const hashpack = (window as any).hashpack;
        await hashpack.request({
          method: 'hashpack_disconnect',
          params: {}
        });
      }
      
      this.accountId = null;
      this.privateKey = null;
      this.isConnectedFlag = false;
    } catch (error) {
      console.error('HashPack disconnection failed:', error);
      throw error;
    }
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      if (typeof window !== 'undefined' && (window as any).hashpack) {
        const hashpack = (window as any).hashpack;
        
        // Convert transaction to bytes for signing
        const transactionBytes = transaction.toBytes();
        
        const result = await hashpack.request({
          method: 'hashpack_signTransaction',
          params: {
            transactionBytes: Array.from(transactionBytes)
          }
        });

        if (result.success) {
          // Create new transaction with signature
          const signedTransaction = Transaction.fromBytes(result.signedTransaction);
          return signedTransaction;
        } else {
          throw new Error('Failed to sign transaction');
        }
      } else {
        throw new Error('HashPack wallet not available');
      }
    } catch (error) {
      console.error('Transaction signing failed:', error);
      throw error;
    }
  }

  getAccountId(): string | null {
    return this.accountId;
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }
}

// Mock Wallet Provider for testing

// Initialize with HashPack provider for production
WalletService.setProvider(new HashPackWalletProvider());
