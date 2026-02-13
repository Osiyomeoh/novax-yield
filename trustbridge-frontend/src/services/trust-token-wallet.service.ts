// Hedera contract service removed - using Etherlink/Novax contracts instead
// import { hederaContractService, ContractConfig } from './hedera-contract.service';
import { 
  TransferTransaction, 
  PrivateKey, 
  AccountId,
  Hbar,
  Client
} from '@hashgraph/sdk';

export interface ExchangeResult {
  transactionId: string;
  trustAmount: number;
  distribution: any;
}

export interface BurnResult {
  transactionId: string;
}

export interface StakeResult {
  transactionId: string;
}

export class TrustTokenWalletService {
  // Hedera contract service removed - using Etherlink/Novax contracts instead
  // private contractService = hederaContractService;
  private contractService = null as any;

  /**
   * Check if wallet is connected
   */
  isWalletConnected(accountId: string | null): boolean {
    return accountId !== null && accountId !== undefined;
  }

  /**
   * Get user's account ID
   */
  getUserAccountId(accountId: string | null): string | null {
    return accountId;
  }

  /**
   * Exchange HBAR for TRUST tokens with user wallet signing
   */
  async exchangeHbarForTrust(
    accountId: string | null,
    hbarAmount: number,
    treasuryAccountId: string,
    operationsAccountId: string,
    stakingAccountId: string,
    signer: any
  ): Promise<ExchangeResult> {
    if (!this.isWalletConnected(accountId)) {
      throw new Error('User wallet not connected. Please connect your wallet to exchange HBAR for TRUST tokens.');
    }

    if (!signer) {
      throw new Error('Wallet signer not available. Please reconnect your wallet.');
    }

    try {
      const userAccountId = accountId!;
      
      // Check if user is trying to transfer to themselves (same account as operator)
      if (userAccountId === treasuryAccountId) {
        throw new Error('Cannot transfer HBAR to the same account. Please use a different account for the exchange.');
      }
      
      // Step 1: Get exchange information from contract
      const exchangeInfo = await this.contractService.getExchangeInfo();
      
      // Step 2: Calculate TRUST token amount
      const trustAmount = await this.contractService.calculateExchange(hbarAmount);
      
      console.log(`🔄 Exchange: ${hbarAmount} HBAR from ${userAccountId} -> ${trustAmount} TRUST tokens`);
      
      // Step 3: Create HBAR transfer transaction
      const hbarTransferTx = this.contractService.createHbarTransferTransaction(
        userAccountId,
        hbarAmount
      );

      console.log('🔍 Transaction Debug:');
      console.log('- From Account:', userAccountId);
      console.log('- HBAR Amount:', hbarAmount, 'HBAR');
      console.log('- Treasury Account:', this.contractService['config'].treasuryAccountId);
      console.log('- Transaction Fee:', hbarTransferTx.maxTransactionFee?.toString());
      console.log('- Transfer Amount (Hbar object):', new Hbar(hbarAmount).toString());

      // Step 4: Sign and execute HBAR transfer using wallet signer
      let signedTx;
      try {
        signedTx = await signer.signTransaction(hbarTransferTx);
      } catch (signError: any) {
        if (signError.message?.includes('session') || signError.message?.includes('deleted')) {
          throw new Error('Wallet session expired. Please disconnect and reconnect your wallet.');
        }
        throw signError;
      }
      
      const response = await signedTx.execute(this.contractService['client']);
      const receipt = await response.getReceipt(this.contractService['client']);
      const hbarTransferId = response.transactionId.toString();
      
      console.log(`✅ HBAR transfer successful: ${hbarTransferId}`);

      // Step 5: Associate TRUST token with user account (if not already associated)
      console.log(`🔗 Step 5/6: Associating TRUST token with user account...`);
      try {
        const hederaClient = this.contractService['client'];
        await this.contractService.associateTrustToken(userAccountId, signer, hederaClient);
        console.log(`✅ TRUST token associated with user account`);
      } catch (associateError: any) {
        // If already associated, that's fine - continue
        if (associateError.message?.includes('TOKEN_ALREADY_ASSOCIATED')) {
          console.log(`✅ TRUST token already associated`);
        } else {
          console.error('❌ Token association failed:', associateError);
          throw new Error(`Token association failed: ${associateError.message}`);
        }
      }

      // Step 6: Mint TRUST tokens to user
      console.log(`🔨 Step 6/6: Minting and transferring TRUST tokens...`);
      const mintId = await this.contractService.mintTrustTokens(userAccountId, trustAmount);
      console.log(`✅ TRUST tokens minted: ${mintId}`);

      return {
        transactionId: hbarTransferId,
        trustAmount,
        distribution: exchangeInfo.distribution
      };
    } catch (error) {
      console.error('Failed to exchange HBAR for TRUST tokens:', error);
      throw error;
    }
  }

  /**
   * Burn TRUST tokens with user wallet signing
   */
  async burnTrustTokens(
    accountId: string | null,
    amount: number,
    reason: string = 'NFT_CREATION',
    signer: any
  ): Promise<BurnResult> {
    if (!this.isWalletConnected(accountId)) {
      throw new Error('User wallet not connected. Please connect your wallet to burn TRUST tokens.');
    }

    if (!signer) {
      throw new Error('Wallet signer not available. Please reconnect your wallet.');
    }

    try {
      const userAccountId = accountId!;
      
      // Step 1: Create TRUST token transfer transaction (user to treasury)
      const transferTx = this.contractService.createTrustTokenTransferTransaction(
        userAccountId,
        '0.0.6916959', // Treasury account
        amount
      );

      // Step 2: Sign and execute transfer using wallet signer
      const signedTx = await signer.signTransaction(transferTx);
      const response = await signedTx.execute(this.contractService['client']);
      const receipt = await response.getReceipt(this.contractService['client']);
      const transferId = response.transactionId.toString();

      // Step 3: Burn tokens from treasury
      const burnId = await this.contractService.burnTrustTokens(amount);

      return {
        transactionId: transferId
      };
    } catch (error) {
      console.error('Failed to burn TRUST tokens:', error);
      throw error;
    }
  }

  /**
   * Stake TRUST tokens with user wallet signing
   */
  async stakeTrustTokens(
    amount: number,
    duration: number
  ): Promise<StakeResult> {
    const userAccountId = this.getUserAccountId();
    if (!userAccountId) {
      throw new Error('User wallet not connected. Please connect your wallet to stake TRUST tokens.');
    }

    const userPrivateKey = WalletService.getPrivateKey();
    if (!userPrivateKey) {
      throw new Error('User private key not available. Please reconnect your wallet.');
    }

    try {
      // Step 1: Create TRUST token transfer transaction (user to staking contract)
      const transferTx = this.contractService.createTrustTokenTransferTransaction(
        userAccountId,
        '0.0.6916959', // Staking account
        amount
      );

      // Step 2: Sign and execute transfer
      const transferId = await this.contractService.executeTrustTokenTransfer(
        transferTx,
        userPrivateKey
      );

      return {
        transactionId: transferId
      };
    } catch (error) {
      console.error('Failed to stake TRUST tokens:', error);
      throw error;
    }
  }

  /**
   * Get TRUST token balance
   */
  async getTrustTokenBalance(accountId: string | null): Promise<number> {
    if (!this.isWalletConnected(accountId)) {
      throw new Error('User wallet not connected. Please connect your wallet to check TRUST token balance.');
    }

    try {
      return await this.contractService.getTrustTokenBalance(accountId!);
    } catch (error) {
      console.error('Failed to get TRUST token balance:', error);
      throw error;
    }
  }

  /**
   * Calculate NFT creation fee
   */
  async calculateNftCreationFee(
    verificationLevel: string,
    rarity: string
  ): Promise<number> {
    try {
      return await this.contractService.calculateNftCreationFee(
        verificationLevel,
        rarity
      );
    } catch (error) {
      console.error('Failed to calculate NFT creation fee:', error);
      // Fallback calculation
      const baseCost = 50;
      const verificationMultiplier = verificationLevel === 'premium' ? 2 : 1;
      const rarityMultiplier = rarity === 'legendary' ? 3 :
                              rarity === 'epic' ? 2 : 1;
      return baseCost * verificationMultiplier * rarityMultiplier;
    }
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(): Promise<any> {
    try {
      return await this.contractService.getExchangeInfo();
    } catch (error) {
      console.error('Failed to get exchange info:', error);
      // Fallback data
      return {
        exchangeRate: 100,
        exchangeFeeRate: 0.01,
        minExchange: 0.5,
        distribution: {
          treasury: 0.6,
          operations: 0.25,
          staking: 0.1,
          fees: 0.05
        }
      };
    }
  }
}

// Create singleton instance
export const trustTokenWalletService = new TrustTokenWalletService();
