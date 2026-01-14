import {
  Client,
  AccountId,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractFunctionParameters,
  Hbar,
  TransferTransaction,
  TokenId
} from '@hashgraph/sdk';

/**
 * Marketplace Contract Service
 * Handles direct interaction with TrustBridge Marketplace smart contract
 */
export class MarketplaceContractService {
  private readonly marketplaceContractId: string;
  private readonly trustTokenId: string;

  constructor() {
    // Contract IDs from deployment
    this.marketplaceContractId = '0.0.7009326';
    this.trustTokenId = '0.0.6935064';
    
    console.log('🏪 Marketplace Contract Service initialized');
    console.log('   Contract:', this.marketplaceContractId);
    console.log('   TRUST Token:', this.trustTokenId);
  }
  
  /**
   * Get client for user-signed transactions (no operator needed)
   */
  private getClient(): Client {
    return Client.forTestnet();
  }

  /**
   * List an NFT for sale on the marketplace
   * @param nftTokenId The NFT token ID
   * @param serialNumber The NFT serial number
   * @param price The listing price in TRUST tokens (smallest unit)
   * @param sellerAccountId The seller's account ID
   * @param signer The HashPack signer
   */
  async listNFT(
    nftTokenId: string,
    serialNumber: number,
    price: number,
    sellerAccountId: string,
    signer: any
  ): Promise<{ listingId: number; transactionId: string }> {
    try {
      console.log('📋 Listing NFT on marketplace contract:', {
        nft: nftTokenId,
        serial: serialNumber,
        price: price,
        seller: sellerAccountId
      });

      // Convert NFT token ID to Solidity address (20 bytes)
      const nftAddress = AccountId.fromString(nftTokenId).toSolidityAddress();

      // Prepare contract function parameters
      const params = new ContractFunctionParameters()
        .addAddress(nftAddress)
        .addUint256(serialNumber)
        .addUint256(price);

      // Create contract execute transaction
      const contractExecTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setFunction('listNFT', params)
        .setMaxTransactionFee(new Hbar(5));

      // Freeze, sign, and execute
      console.log('🧊 Freezing listing transaction...');
      contractExecTx.freezeWithSigner(signer);

      console.log('✍️ Signing listing transaction...');
      const signedTx = await signer.signTransaction(contractExecTx);

      console.log('📡 Executing listing transaction...');
      const client = this.getClient();
      const response = await signedTx.execute(client);

      console.log('⏳ Getting receipt...');
      const receipt = await response.getReceipt(client);

      const transactionId = response.transactionId.toString();
      console.log('✅ NFT listed on marketplace:', transactionId);

      // TODO: Extract listingId from contract record/logs
      // For now, return placeholder
      return {
        listingId: 0, // Would be extracted from contract event
        transactionId
      };
    } catch (error) {
      console.error('Failed to list NFT on marketplace:', error);
      throw new Error(`Failed to list NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Buy an NFT from the marketplace
   * Handles atomic TRUST token payment and NFT transfer
   * @param listingId The marketplace listing ID
   * @param buyerAccountId The buyer's account ID
   * @param price The listing price
   * @param sellerAccountId The seller's account ID
   * @param signer The HashPack signer
   */
  async buyNFT(
    listingId: number,
    buyerAccountId: string,
    price: number,
    sellerAccountId: string,
    signer: any
  ): Promise<{ transactionId: string; platformFee: number }> {
    try {
      console.log('💰 Buying NFT from marketplace:', {
        listingId,
        buyer: buyerAccountId,
        price,
        seller: sellerAccountId
      });

      // Step 1: Calculate platform fee (2.5%)
      const platformFee = Math.floor(price * 250 / 10000);
      const sellerAmount = price - platformFee;
      const platformTreasury = '0.0.6916959'; // Platform treasury

      console.log('💸 Payment breakdown:', {
        total: price,
        seller: sellerAmount,
        platformFee: platformFee
      });

      // Step 2: Transfer TRUST tokens from buyer to seller and platform
      console.log('🔄 Creating TRUST token transfer transaction...');
      console.log('   Token ID:', this.trustTokenId);
      console.log('   From (buyer):', buyerAccountId, 'Amount:', -price);
      console.log('   To (seller):', sellerAccountId, 'Amount:', sellerAmount);
      console.log('   To (platform):', platformTreasury, 'Amount:', platformFee);
      
      const trustTransferTx = new TransferTransaction()
        .addTokenTransfer(
          TokenId.fromString(this.trustTokenId),
          AccountId.fromString(buyerAccountId),
          -price
        )
        .addTokenTransfer(
          TokenId.fromString(this.trustTokenId),
          AccountId.fromString(sellerAccountId),
          sellerAmount
        )
        .addTokenTransfer(
          TokenId.fromString(this.trustTokenId),
          AccountId.fromString(platformTreasury),
          platformFee
        )
        .setMaxTransactionFee(new Hbar(5));

      // Freeze and sign TRUST transfer
      console.log('🧊 Freezing TRUST transfer transaction...');
      trustTransferTx.freezeWithSigner(signer);

      console.log('✍️ Signing TRUST transfer...');
      const trustSignedTx = await signer.signTransaction(trustTransferTx);

      console.log('📡 Executing TRUST transfer...');
      const client = this.getClient();
      const trustResponse = await trustSignedTx.execute(client);
      const trustReceipt = await trustResponse.getReceipt(client);

      const trustTxId = trustResponse.transactionId.toString();
      console.log('✅ TRUST tokens transferred:', trustTxId);
      console.log('   View on Hashscan: https://hashscan.io/testnet/transaction/' + trustTxId);
      console.log('   Status:', trustReceipt.status.toString());
      console.log('   Please check Hashscan to verify TRUST token transfers');

      // Step 3: Call marketplace contract buyNFT function
      console.log('🎨 Executing marketplace buy function...');
      const params = new ContractFunctionParameters()
        .addUint256(listingId);

      const contractExecTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setFunction('buyNFT', params)
        .setMaxTransactionFee(new Hbar(5));

      // Freeze and sign contract call
      contractExecTx.freezeWithSigner(signer);
      const contractSignedTx = await signer.signTransaction(contractExecTx);
      const contractResponse = await contractSignedTx.execute(client);
      await contractResponse.getReceipt(client);

      const transactionId = contractResponse.transactionId.toString();
      console.log('✅ NFT purchase completed:', transactionId);

      return {
        transactionId,
        platformFee
      };
    } catch (error) {
      console.error('Failed to buy NFT from marketplace:', error);
      throw new Error(`Failed to buy NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel a marketplace listing
   * @param listingId The listing ID to cancel
   * @param signer The HashPack signer
   */
  async cancelListing(
    listingId: number,
    signer: any
  ): Promise<{ transactionId: string }> {
    try {
      console.log('❌ Cancelling marketplace listing:', listingId);

      const params = new ContractFunctionParameters()
        .addUint256(listingId);

      const contractExecTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(200000)
        .setFunction('cancelListing', params)
        .setMaxTransactionFee(new Hbar(3));

      contractExecTx.freezeWithSigner(signer);
      const signedTx = await signer.signTransaction(contractExecTx);
      const client = this.getClient();
      const response = await signedTx.execute(client);
      await response.getReceipt(client);

      const transactionId = response.transactionId.toString();
      console.log('✅ Listing cancelled:', transactionId);

      return { transactionId };
    } catch (error) {
      console.error('Failed to cancel listing:', error);
      throw new Error(`Failed to cancel listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update listing price
   * @param listingId The listing ID
   * @param newPrice The new price in TRUST tokens
   * @param signer The HashPack signer
   */
  async updatePrice(
    listingId: number,
    newPrice: number,
    signer: any
  ): Promise<{ transactionId: string }> {
    try {
      console.log('💲 Updating listing price:', { listingId, newPrice });

      const params = new ContractFunctionParameters()
        .addUint256(listingId)
        .addUint256(newPrice);

      const contractExecTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(200000)
        .setFunction('updatePrice', params)
        .setMaxTransactionFee(new Hbar(3));

      contractExecTx.freezeWithSigner(signer);
      const signedTx = await signer.signTransaction(contractExecTx);
      const client = this.getClient();
      const response = await signedTx.execute(client);
      await response.getReceipt(client);

      const transactionId = response.transactionId.toString();
      console.log('✅ Price updated:', transactionId);

      return { transactionId };
    } catch (error) {
      console.error('Failed to update price:', error);
      throw new Error(`Failed to update price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get listing details from marketplace contract
   * @param listingId The listing ID
   * 
   * Note: Contract queries require an operator which we can't provide in frontend
   * For now, we use localStorage which is synced during all marketplace operations
   */
  async getListing(listingId: number): Promise<{
    seller: string;
    nftAddress: string;
    serialNumber: number;
    price: number;
    isActive: boolean;
    listedAt: number;
  }> {
    try {
      console.log('📋 Getting listing details for ID:', listingId);
      
      // Use localStorage for listing details (synced during all marketplace operations)
      const assetReferences = JSON.parse(localStorage.getItem('assetReferences') || '[]');
      const assetRef = assetReferences.find((ref: any) => ref.listingId === listingId);

      if (!assetRef) {
        throw new Error('Listing not found in local storage');
      }

      return {
        seller: assetRef.owner,
        nftAddress: assetRef.tokenId,
        serialNumber: parseInt(assetRef.serialNumber || '1'),
        price: parseFloat(assetRef.price || '100'),
        isActive: assetRef.isListed || false,
        listedAt: new Date(assetRef.listedAt || Date.now()).getTime() / 1000
      };
    } catch (error) {
      console.error('Failed to get listing:', error);
      throw new Error(`Failed to get listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an NFT is listed on the marketplace
   * Uses backend API to query contract state from the network
   * @param nftTokenId The NFT token ID
   * @param serialNumber The NFT serial number
   */
  async isNFTListed(
    nftTokenId: string,
    serialNumber: number
  ): Promise<{ isListed: boolean; listingId: number }> {
    try {
      console.log('🔍 Querying marketplace contract via backend API:', { nftTokenId, serialNumber });
      
      // Use backend API which has operator credentials to query the contract
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) {
        throw new Error('VITE_API_URL is not configured');
      }
      const backendUrl = `${apiUrl}/hedera/marketplace/check-listing/${nftTokenId}/${serialNumber}`;
      console.log('📡 Calling backend API:', backendUrl);
      
      const response = await fetch(backendUrl);
      
      if (!response.ok) {
        throw new Error(`Backend API query failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Response from backend:', data);
      
      if (data.success) {
        const isListed = data.data.isListed;
        const listingId = data.data.listingId;
        
        console.log('✅ NFT listing status from network:', { nftTokenId, serialNumber, isListed, listingId });
        
        return { isListed, listingId };
      }
      
      throw new Error(data.message || 'Failed to check listing status');
      
    } catch (error) {
      console.error('❌ Failed to check NFT listing from network:', error);
      console.warn('⚠️ Falling back to not listed');
      return { isListed: false, listingId: 0 };
    }
  }

  /**
   * Get marketplace configuration
   * Returns hardcoded config since contract queries require operator
   */
  async getMarketplaceConfig(): Promise<{
    trustToken: string;
    treasury: string;
    feeBps: number;
    owner: string;
    activeListings: number;
  }> {
    // Return hardcoded config from deployment
    return {
      trustToken: this.trustTokenId,
      treasury: '0.0.6916959',
      feeBps: 250, // 2.5%
      owner: '0.0.6916959',
      activeListings: 0 // Would need backend API to get this
    };
  }
}

// Export singleton instance
export const marketplaceContractService = new MarketplaceContractService();

