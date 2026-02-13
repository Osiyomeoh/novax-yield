import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Copy, Tag, MapPin, Calendar, User, TrendingUp, Share2, Heart, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../UI/Card';
import Button from '../UI/Button';
import { useToast } from '../../hooks/useToast';
import { useWallet } from '../../contexts/WalletContext';
import { TransferTransaction, TokenId, AccountId, Hbar, TokenMintTransaction, TokenBurnTransaction, AccountBalanceQuery } from '@hashgraph/sdk';
import { marketplaceContractService } from '../../services/marketplace-contract.service';
import { trackActivity } from '../../utils/activityTracker';
import { apiService } from '../../services/api';
import { AdvancedOrderBook } from '../Trading/AdvancedOrderBook';
import { YieldDashboard } from '../Trading/YieldDashboard';
import { RiskDashboard } from '../Trading/RiskDashboard';

/**
 * Marketplace Asset Modal
 * Optimized for DISCOVERY - focused on buying, viewing, and making offers
 * Used in AssetMarketplace.tsx
 */

interface MarketplaceAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
  onAssetUpdate?: () => void;
}

const MarketplaceAssetModal: React.FC<MarketplaceAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  onAssetUpdate
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, accountId, signer, hederaClient } = useWallet();
  
  const [isBuying, setIsBuying] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerDuration, setOfferDuration] = useState('7');
  const [isMakingOffer, setIsMakingOffer] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showPoolTrading, setShowPoolTrading] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [redeemAmount, setRedeemAmount] = useState<string>('');
  const [userPoolBalance, setUserPoolBalance] = useState<number>(0);
  const [isInvesting, setIsInvesting] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showPoolDetails, setShowPoolDetails] = useState(false);
  const [showAdvancedTrading, setShowAdvancedTrading] = useState(false);
  const [showYieldDashboard, setShowYieldDashboard] = useState(false);
  const [showRiskDashboard, setShowRiskDashboard] = useState(false);
  const [marketplaceListingStatus, setMarketplaceListingStatus] = useState<{
    isListed: boolean;
    listingId: number;
    isLoading: boolean;
    seller?: string;
  }>({ isListed: false, listingId: 0, isLoading: true });
  const [actualOwner, setActualOwner] = useState<string | null>(null);

  // Use owner from blockchain data only (no localStorage)
  useEffect(() => {
    if (!asset?.tokenId || !isOpen) return;
    setActualOwner(asset.owner);
  }, [asset?.tokenId, asset?.owner, isOpen]);

  // Check if current user is the owner or seller
  // If listed: check against seller (who listed it)
  // If not listed: check against current owner
  const isOwner = accountId && (
    (marketplaceListingStatus.isListed && marketplaceListingStatus.seller && 
     (marketplaceListingStatus.seller.toLowerCase() === accountId.toLowerCase() || 
      marketplaceListingStatus.seller === accountId)) ||
    (!marketplaceListingStatus.isListed && actualOwner && 
     (actualOwner.toLowerCase() === accountId.toLowerCase() || 
      actualOwner === accountId))
  );

  // Check marketplace listing status - ALWAYS query blockchain state
  useEffect(() => {
    const checkMarketplaceStatus = async () => {
      if (!asset?.tokenId || !isOpen) return;
      
      try {
        setMarketplaceListingStatus(prev => ({ ...prev, isLoading: true }));
        
        // Query backend for verified blockchain state
        const apiUrl = import.meta.env.VITE_API_URL || '';
        if (!apiUrl) return;
        const response = await fetch(`${apiUrl}/assets/blockchain-state/${asset.tokenId}/${asset.serialNumber || '1'}`);
        if (!response.ok) {
          throw new Error('Failed to fetch blockchain state');
        }
        
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Verified listing status from blockchain:`, data.data);
          
          // Update actual owner based on blockchain
          setActualOwner(data.data.owner);
          
          setMarketplaceListingStatus({
            isListed: data.data.isListed,
            listingId: data.data.isListed ? 1 : 0, // If in escrow, it's listed
            seller: data.data.seller, // Track who listed it
            isLoading: false
          });
        } else {
          throw new Error('Invalid response from blockchain state API');
        }
      } catch (error) {
        console.error('Failed to check marketplace status:', error);
        setMarketplaceListingStatus({
          isListed: false,
          listingId: 0,
          isLoading: false
        });
      }
    };
    
    checkMarketplaceStatus();
  }, [isOpen, asset?.tokenId, asset?.serialNumber]);

  // Check if favorited
  useEffect(() => {
    // TODO: Load favorites from backend/Hedera (not localStorage)
    setIsFavorited(false);
  }, [asset?.tokenId, accountId]);

  // Helper: Submit event to HCS
  const submitToHCS = async (event: any) => {
    try {
      // Use marketplace HCS endpoint for all events (pool and marketplace events)
      await apiService.post('/hedera/hcs/marketplace/event', event);
      console.log('📋 Event submitted to HCS:', event.type);
    } catch (error) {
      console.warn('⚠️ Failed to submit to HCS (non-critical):', error);
    }
  };

  const handleToggleFavorite = () => {
    // TODO: Store favorites on backend/Hedera (not localStorage)
    toast({
      title: 'Coming Soon',
      description: 'Favorites feature will be implemented with blockchain storage',
      variant: 'default'
    });
  };

  const handleInvest = async () => {
    if (!isInvesting) {
      // First click - show investment form
      setIsInvesting(true);
      return;
    }

    try {
      const amount = parseFloat(investmentAmount);
      
      if (!amount || amount < (asset.minimumInvestment || 100)) {
        toast({
          title: 'Invalid Investment Amount',
          description: `Minimum investment is ${asset.minimumInvestment || 100} USDC`,
          variant: 'destructive'
        });
        return;
      }

      // Check wallet connection
      if (!isConnected || !accountId || !signer || !hederaClient) {
        toast({
          title: 'Wallet Not Connected',
          description: 'Please connect your HashPack wallet to invest.',
          variant: 'destructive'
        });
        return;
      }

      // Skip wallet responsiveness check to avoid protobuf errors
      console.log('🔧 Skipping wallet balance check to avoid protobuf errors');

      // Validate account ID format
      if (!accountId || !accountId.match(/^\d+\.\d+\.\d+$/)) {
        console.error('❌ Invalid account ID format:', accountId);
        toast({
          title: 'Invalid Account ID',
          description: 'Account ID must be in format X.Y.Z (e.g., 0.0.123456)',
          variant: 'destructive'
        });
        return;
      }

      // Check user's USDC balance before investment (removed Trust Token check)
      // TODO: Implement USDC balance check for Etherlink
      try {
        console.log('🔧 Checking user USDC balance...');
        // Trust Token removed - using USDC on Etherlink
        const trustBalanceAmount = 0; // Placeholder
        
        console.log('🔧 User USDC balance:', trustBalanceAmount);
        console.log('🔧 Investment amount requested:', amount);
        
        if (trustBalanceAmount < amount) {
          toast({
            title: 'Insufficient USDC Balance',
            description: `You have ${trustBalanceAmount.toFixed(2)} USDC but need ${amount} USDC for this investment.`,
            variant: 'destructive'
          });
          return;
        }
        
        console.log('✅ Sufficient USDC balance confirmed');
      } catch (balanceError) {
        console.warn('⚠️ Could not check balance, proceeding with investment:', (balanceError as Error).message);
        // Continue with investment attempt even if balance check fails
      }

      console.log('🚀 Starting pool investment process...');
      console.log('Pool ID:', asset.poolId);
      console.log('Investment Amount:', amount, 'USDC');
      console.log('User Account:', accountId);

      // Step 1: Transfer USDC from user to pool (removed Trust Token logic)
      console.log('🔧 Creating USDC transfer transaction...');
      
      // USDC has 6 decimals
      const tokenAmount = Math.floor(amount * 1000000); // Convert to USDC units (6 decimals)
      console.log('🔧 Investment amount (USDC):', amount);
      console.log('🔧 Token amount (no conversion needed):', tokenAmount);
      console.log('🔧 Token amount check:', tokenAmount, 'should equal', amount);
      
      // Trust Token removed - using USDC on Etherlink
      // TODO: Implement USDC transfer for Etherlink using novaxContractService
      console.log('🔧 USDC transfer for Etherlink (Trust Token removed)');
      
      // Placeholder - Hedera-specific code removed
      let transferTx = null as any;
      transferTx = transferTx.setTransactionMemo(`Pool Investment: ${asset.poolId}`);
      transferTx = transferTx.setMaxTransactionFee(new Hbar(5));
      transferTx = transferTx.setTransactionValidDuration(120);
      
      console.log('🔧 Transaction constructed successfully');

      // Final balance check right before transaction execution
      try {
        console.log('🔧 Final balance check before transaction execution...');
        const finalBalanceQuery = new AccountBalanceQuery().setAccountId(userAccountId);
        const finalBalance = await finalBalanceQuery.execute(hederaClient);
        // Trust Token removed - using USDC on Etherlink
        const finalTrustBalanceAmount = 0; // Placeholder
        
        console.log('🔧 Final TRUST balance before transaction:', finalTrustBalanceAmount);
        console.log('🔧 Required amount for transaction:', amount);
        
        if (finalTrustBalanceAmount < amount) {
          toast({
            title: 'Balance Changed',
            description: `Your balance changed to ${finalTrustBalanceAmount.toFixed(2)} TRUST. Please try again.`,
            variant: 'destructive'
          });
          return;
        }
      } catch (finalBalanceError) {
        console.warn('⚠️ Final balance check failed, proceeding with transaction:', (finalBalanceError as Error).message);
      }

      console.log('🔧 Freezing transaction with signer...');
      transferTx.freezeWithSigner(signer);
      
      console.log('🔧 Requesting signature from HashPack...');
      const signedTx = await signer.signTransaction(transferTx);
      
      if (!signedTx) {
        throw new Error('Transaction signing failed - no signed transaction received');
      }
      
      console.log('🔧 Executing TRUST transfer...');
      const transferResponse = await signedTx.execute(hederaClient);
      
      if (!transferResponse) {
        throw new Error('Transaction execution failed - no response received');
      }
      
      console.log('✅ Transaction submitted, getting receipt...');
      console.log('🔧 Transaction response:', transferResponse);
      console.log('🔧 Transaction ID from response:', transferResponse.transactionId?.toString());
      
      // Add timeout for receipt retrieval
      const transferReceipt = await Promise.race([
        transferResponse.getReceipt(hederaClient),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Receipt timeout after 30 seconds')), 30000)
        )
      ]) as any;
      
      console.log('🔧 Transaction receipt:', transferReceipt);
      console.log('🔧 Receipt transaction ID:', transferReceipt.transactionId?.toString());
      console.log('🔧 Receipt status:', transferReceipt.status);
      console.log('🔧 Receipt keys:', Object.keys(transferReceipt));
      
      if (!transferReceipt) {
        throw new Error('Transaction receipt failed - no receipt received');
      }
      
      // Try different ways to get the transaction ID
      let transactionId = null;
      if (transferReceipt.transactionId) {
        transactionId = transferReceipt.transactionId.toString();
      } else if (transferReceipt.transactionId) {
        transactionId = transferReceipt.transactionId.toString();
      } else if (transferResponse.transactionId) {
        transactionId = transferResponse.transactionId.toString();
      }
      
      console.log('🔧 Extracted transaction ID:', transactionId);
      
      // Check if transaction was successful
      const receiptStatus = transferReceipt.status?.toString();
      console.log('🔧 Receipt status string:', receiptStatus);
      
      if (receiptStatus && receiptStatus !== 'SUCCESS' && receiptStatus !== '22') {
        throw new Error(`Transaction failed with status: ${receiptStatus}`);
      }
      
      if (!transactionId) {
        // If we can't get transaction ID from receipt, use the response transaction ID
        if (transferResponse.transactionId) {
          transactionId = transferResponse.transactionId.toString();
          console.log('⚠️ Using transaction ID from response instead of receipt:', transactionId);
        } else {
          throw new Error('Transaction receipt failed - no transaction ID found in receipt or response');
        }
      }
      
      console.log('✅ TRUST transfer successful:', transactionId);

      // Step 2: Mint pool tokens to user
      console.log('🔧 Creating pool token mint transaction...');
      
      const poolTokenAmount = Math.floor(amount / (asset.price || 1)); // Calculate pool tokens
      const poolTokenId = asset.hederaTokenId || asset.poolTokenId || '0.0.123456'; // Pool token ID
      
      console.log('🔧 Pool token amount:', poolTokenAmount);
      console.log('🔧 Pool token ID:', poolTokenId);
      
      // Create pool token ID and user account ID
      const poolTokenIdObj = TokenId.fromString(poolTokenId);
      const userAccountIdObj = AccountId.fromString(accountId);
      
      // Create mint transaction
      let mintTx = new TokenMintTransaction();
      mintTx = mintTx.setTokenId(poolTokenIdObj);
      mintTx = mintTx.setAmount(poolTokenAmount);
      mintTx = mintTx.setTransactionMemo(`Pool Token Mint: ${asset.poolId}`);
      mintTx = mintTx.setMaxTransactionFee(new Hbar(5));
      mintTx = mintTx.setTransactionValidDuration(120);
      
      console.log('🔧 Pool token mint transaction constructed successfully');
      
      // Execute pool token mint
      console.log('🔧 Freezing pool token mint transaction...');
      mintTx.freezeWithSigner(signer);
      
      console.log('🔧 Requesting signature for pool token mint...');
      const signedMintTx = await signer.signTransaction(mintTx);
      
      if (!signedMintTx) {
        throw new Error('Pool token mint signing failed');
      }
      
      console.log('🔧 Executing pool token mint...');
      const mintResponse = await signedMintTx.execute(hederaClient);
      
      if (!mintResponse) {
        throw new Error('Pool token mint execution failed');
      }
      
      console.log('✅ Pool token mint successful');
      
      // Step 3: Transfer minted pool tokens to user
      console.log('🔧 Creating pool token transfer transaction...');
      
      let transferPoolTx = new TransferTransaction();
      transferPoolTx = transferPoolTx.addTokenTransfer(poolTokenIdObj, treasuryAccountId, -poolTokenAmount);
      transferPoolTx = transferPoolTx.addTokenTransfer(poolTokenIdObj, userAccountIdObj, poolTokenAmount);
      transferPoolTx = transferPoolTx.setTransactionMemo(`Pool Token Transfer: ${asset.poolId}`);
      transferPoolTx = transferPoolTx.setMaxTransactionFee(new Hbar(5));
      transferPoolTx = transferPoolTx.setTransactionValidDuration(120);
      
      console.log('🔧 Pool token transfer transaction constructed successfully');
      
      // Execute pool token transfer
      console.log('🔧 Freezing pool token transfer transaction...');
      transferPoolTx.freezeWithSigner(signer);
      
      console.log('🔧 Requesting signature for pool token transfer...');
      const signedTransferPoolTx = await signer.signTransaction(transferPoolTx);
      
      if (!signedTransferPoolTx) {
        throw new Error('Pool token transfer signing failed');
      }
      
      console.log('🔧 Executing pool token transfer...');
      const transferPoolResponse = await signedTransferPoolTx.execute(hederaClient);
      
      if (!transferPoolResponse) {
        throw new Error('Pool token transfer execution failed');
      }
      
      console.log('✅ Pool token transfer successful');

      // Step 3: Record investment on HCS
      console.log('📋 Recording investment on HCS...');
      
      const investmentEvent = {
        type: 'pool_investment',
        poolId: asset.poolId,
        investorAccount: accountId,
        trustAmount: amount,
        poolTokensReceived: poolTokenAmount,
        transactionId: transactionId,
        timestamp: new Date().toISOString()
      };

      await submitToHCS(investmentEvent);
      
      // Step 4: Update local state
      setUserPoolBalance(prev => prev + poolTokenAmount);
      
      toast({
        title: 'Investment Successful!',
        description: `Invested ${amount} USDC and received ${poolTokenAmount.toFixed(2)} pool tokens. Transaction: ${transactionId}`,
        variant: 'default'
      });
      
      setInvestmentAmount('');
      setIsInvesting(false);
      
    } catch (error) {
      console.error('❌ Investment failed:', error);
      toast({
        title: 'Investment Failed',
        description: (error as Error).message || 'Please try again later',
        variant: 'destructive'
      });
      setIsInvesting(false);
    }
  };

  const handleRedeem = async () => {
    if (!isRedeeming && userPoolBalance > 0) {
      // First click - show redeem form
      setIsRedeeming(true);
      return;
    }

    try {
      const amount = parseFloat(redeemAmount);
      
      if (!amount || amount > userPoolBalance) {
        toast({
          title: 'Invalid Redeem Amount',
          description: 'Amount exceeds your holdings',
          variant: 'destructive'
        });
        return;
      }

      // Check wallet connection
      if (!isConnected || !accountId || !signer || !hederaClient) {
        toast({
          title: 'Wallet Not Connected',
          description: 'Please connect your HashPack wallet to redeem.',
          variant: 'destructive'
        });
        return;
      }

      // Skip wallet responsiveness check to avoid protobuf errors
      console.log('🔧 Skipping wallet balance check to avoid protobuf errors');

      // Validate account ID format
      if (!accountId || !accountId.match(/^\d+\.\d+\.\d+$/)) {
        console.error('❌ Invalid account ID format:', accountId);
        toast({
          title: 'Invalid Account ID',
          description: 'Account ID must be in format X.Y.Z (e.g., 0.0.123456)',
          variant: 'destructive'
        });
        return;
      }

      console.log('🚀 Starting pool redemption process...');
      console.log('Pool ID:', asset.poolId);
      console.log('Redeem Amount:', amount, 'pool tokens');
      console.log('User Account:', accountId);

      // Step 1: Calculate USDC to return
      const usdcAmount = amount * (asset.price || 1);
      console.log('🔧 USDC to return:', usdcAmount);

      // Step 2: Transfer USDC from treasury to user (removed Trust Token logic)
      console.log('🔧 Creating USDC transfer transaction...');
      
      // USDC has 6 decimals
      const tokenAmount = Math.floor(usdcAmount * 1000000); // Convert to USDC units (6 decimals)
      console.log('🔧 Token amount (no conversion needed):', tokenAmount);
      
      // Trust Token removed - using USDC on Etherlink
      // TODO: Implement USDC transfer for Etherlink using novaxContractService
      console.log('🔧 USDC transfer for Etherlink (Trust Token removed)');
      
      // Placeholder - Hedera-specific code removed
      let transferTx = null as any;
      transferTx = transferTx.setTransactionMemo(`Pool Redemption: ${asset.poolId}`);
      transferTx = transferTx.setMaxTransactionFee(new Hbar(5));
      transferTx = transferTx.setTransactionValidDuration(120);
      
      console.log('🔧 Transaction constructed successfully');

      console.log('🔧 Freezing transaction with signer...');
      transferTx.freezeWithSigner(signer);
      
      console.log('🔧 Requesting signature from HashPack...');
      const signedTx = await signer.signTransaction(transferTx);
      
      if (!signedTx) {
        throw new Error('Transaction signing failed - no signed transaction received');
      }
      
      console.log('🔧 Executing TRUST transfer...');
      const transferResponse = await signedTx.execute(hederaClient);
      
      if (!transferResponse) {
        throw new Error('Transaction execution failed - no response received');
      }
      
      console.log('✅ Transaction submitted, getting receipt...');
      const transferReceipt = await transferResponse.getReceipt(hederaClient);
      
      if (!transferReceipt || !transferReceipt.transactionId) {
        throw new Error('Transaction receipt failed - no transaction ID received');
      }
      
      console.log('✅ TRUST transfer successful:', transferReceipt.transactionId.toString());

      // Step 3: Burn pool tokens from user
      console.log('🔧 Pool tokens to burn:', amount);
      
      const poolTokenId = asset.hederaTokenId || asset.poolTokenId || '0.0.123456'; // Pool token ID
      const poolTokenIdObj = TokenId.fromString(poolTokenId);
      const userAccountIdObj = AccountId.fromString(accountId);
      
      console.log('🔧 Pool token ID:', poolTokenId);
      console.log('🔧 Pool tokens to burn:', amount);
      
      // Create burn transaction
      let burnTx = new TokenBurnTransaction();
      burnTx = burnTx.setTokenId(poolTokenIdObj);
      burnTx = burnTx.setAmount(amount);
      burnTx = burnTx.setTransactionMemo(`Pool Token Burn: ${asset.poolId}`);
      burnTx = burnTx.setMaxTransactionFee(new Hbar(5));
      burnTx = burnTx.setTransactionValidDuration(120);
      
      console.log('🔧 Pool token burn transaction constructed successfully');
      
      // Execute pool token burn
      console.log('🔧 Freezing pool token burn transaction...');
      burnTx.freezeWithSigner(signer);
      
      console.log('🔧 Requesting signature for pool token burn...');
      const signedBurnTx = await signer.signTransaction(burnTx);
      
      if (!signedBurnTx) {
        throw new Error('Pool token burn signing failed');
      }
      
      console.log('🔧 Executing pool token burn...');
      const burnResponse = await signedBurnTx.execute(hederaClient);
      
      if (!burnResponse) {
        throw new Error('Pool token burn execution failed');
      }
      
      console.log('✅ Pool token burn successful');
      
      // Step 4: Record redemption on HCS
      console.log('📋 Recording redemption on HCS...');
      
      const redemptionEvent = {
        type: 'pool_redemption',
        poolId: asset.poolId,
        investorAccount: accountId,
        poolTokensRedeemed: amount,
        trustAmountReceived: trustAmount,
        transactionId: transferReceipt.transactionId.toString(),
        timestamp: new Date().toISOString()
      };

      await submitToHCS(redemptionEvent);
      
      // Step 5: Update local state
      setUserPoolBalance(prev => prev - amount);
      
      toast({
        title: 'Redemption Successful!',
        description: `Redeemed ${amount} pool tokens and received ${usdcAmount.toFixed(2)} USDC`,
        variant: 'default'
      });
      
      setRedeemAmount('');
      setIsRedeeming(false);
      
    } catch (error) {
      console.error('❌ Redemption failed:', error);
      toast({
        title: 'Redemption Failed',
        description: (error as Error).message || 'Please try again later',
        variant: 'destructive'
      });
      setIsRedeeming(false);
    }
  };

  const handleBuyAsset = async () => {
    try {
      setIsBuying(true);
      
      if (!accountId || !signer || !hederaClient) {
        throw new Error('Please connect your wallet to buy assets');
      }

      // Check if asset is actually listed on marketplace
      if (!marketplaceListingStatus.isListed || marketplaceListingStatus.listingId === 0) {
        throw new Error('This asset is not currently listed for sale on the marketplace.');
      }

      // Prevent seller from buying their own listing
      if (marketplaceListingStatus.seller && 
          (marketplaceListingStatus.seller.toLowerCase() === accountId.toLowerCase() || 
           marketplaceListingStatus.seller === accountId)) {
        throw new Error('You cannot buy your own listing. Please unlist it first if you want to remove it from sale.');
      }

      const assetPrice = parseFloat(asset.price || asset.totalValue || '100');
      const listingId = marketplaceListingStatus.listingId;
      
      // Check buyer's USDC balance (removed Trust Token check)
      // TODO: Implement USDC balance check for Etherlink
      const buyerBalance = 0;
      
      console.log('🔍 Balance check:', {
        buyerBalance: buyerBalance,
        assetPrice: assetPrice,
        hasEnough: buyerBalance >= assetPrice
      });
      
      if (buyerBalance < assetPrice) {
        throw new Error(`Insufficient USDC. You need ${assetPrice} USDC but only have ${buyerBalance} USDC.`);
      }

      console.log('💰 Buying asset:', {
        asset: asset.name,
        price: assetPrice,
        listingId: listingId,
        from: accountId,
        to: asset.owner
      });

      // Use HTS direct transfer (marketplace contract doesn't work for HTS NFTs)
      console.log('🛒 Executing buy with HTS direct transfer:');
      console.log('   Token:', asset.tokenId, 'Serial:', asset.serialNumber);
      console.log('   From:', asset.owner, 'To:', accountId);
      
      const { TransferTransaction, TokenId, AccountId, TokenAssociateTransaction } = await import('@hashgraph/sdk');
      
      // Calculate fees and royalties
      const platformFeePercent = 2.5; // 2.5% platform fee
      const royaltyPercentage = parseFloat(asset.royaltyPercentage || asset.metadata?.royaltyPercentage || '0');
      const totalPrice = typeof assetPrice === 'string' ? parseFloat(assetPrice) : assetPrice;
      
      // Trust Token removed - using USDC on Etherlink
      // TODO: Implement USDC transfer for Etherlink using novaxContractService
      console.log('💸 Step 1/3: Transferring USDC (Trust Token removed)...');
      
      const { Hbar } = await import('@hashgraph/sdk');
      
      // Create USDC transfers with royalty distribution (Hedera-specific code removed)
      // Use toFixed(8) to ensure exactly 8 decimal places
      const exactPlatformFee = Number.parseFloat(((totalPrice * platformFeePercent) / 100).toFixed(8));
      const exactRoyaltyAmount = Number.parseFloat(((totalPrice * royaltyPercentage) / 100).toFixed(8));
      
      // Calculate seller amount as exact remainder to guarantee zero-sum
      const exactSellerAmount = Number.parseFloat((totalPrice - exactPlatformFee - exactRoyaltyAmount).toFixed(8));
      
      // Debug transfer amounts
      console.log('🔍 Transfer amounts:', {
        fromBuyer: -totalPrice,
        toSeller: exactSellerAmount,
        toSellerRoyalty: exactRoyaltyAmount,
        toPlatform: exactPlatformFee,
        sum: -totalPrice + exactSellerAmount + exactRoyaltyAmount + exactPlatformFee,
        zeroSumCheck: {
          totalPrice: totalPrice,
          exactPlatformFee: exactPlatformFee,
          exactRoyaltyAmount: exactRoyaltyAmount,
          exactSellerAmount: exactSellerAmount,
          calculated: totalPrice - exactPlatformFee - exactRoyaltyAmount,
          remainder: totalPrice - exactPlatformFee - exactRoyaltyAmount - exactSellerAmount,
          isExactlyZero: (-totalPrice + exactSellerAmount + exactRoyaltyAmount + exactPlatformFee) === 0
        },
        percentageCheck: {
          royaltyPercentage: royaltyPercentage + '%',
          platformFeePercent: platformFeePercent + '%',
          royaltyCalculation: `${totalPrice} * ${royaltyPercentage} / 100 = ${exactRoyaltyAmount}`,
          platformCalculation: `${totalPrice} * ${platformFeePercent} / 100 = ${exactPlatformFee}`
        }
      });
      
      // Trust Token removed - using USDC on Etherlink
      // TODO: Implement USDC transfers for Etherlink using novaxContractService
      // Placeholder - Hedera-specific code removed
      const sellerTransferTx = null as any;
      const platformTransferTx = null as any;

      if (exactRoyaltyAmount > 0) {
        const totalSellerAmount = exactSellerAmount + exactRoyaltyAmount;
        console.log(`👑 Seller receives ${exactSellerAmount.toFixed(8)} USDC base + ${exactRoyaltyAmount.toFixed(8)} USDC royalty = ${totalSellerAmount.toFixed(8)} USDC total`);
        sellerTransferTx.setTransactionMemo(`Buy: ${asset.name} | Seller: ${exactSellerAmount.toFixed(8)} + Royalty: ${exactRoyaltyAmount.toFixed(8)}`);
        platformTransferTx.setTransactionMemo(`Buy: ${asset.name} | Platform: ${exactPlatformFee.toFixed(8)}`);
      } else {
        console.log(`💵 Seller receives ${exactSellerAmount.toFixed(8)} USDC (no royalty)`);
        sellerTransferTx.setTransactionMemo(`Buy: ${asset.name} | Seller: ${exactSellerAmount.toFixed(8)}`);
        platformTransferTx.setTransactionMemo(`Buy: ${asset.name} | Platform: ${exactPlatformFee.toFixed(8)}`);
      }
      
      // Execute seller transfer
      sellerTransferTx.freezeWithSigner(signer);
      const signedSellerTx = await signer.signTransaction(sellerTransferTx);
      const sellerTxResponse = await signedSellerTx.execute(hederaClient);
      await sellerTxResponse.getReceipt(hederaClient);
      
      // Execute platform transfer
      platformTransferTx.freezeWithSigner(signer);
      const signedPlatformTx = await signer.signTransaction(platformTransferTx);
      const platformTxResponse = await signedPlatformTx.execute(hederaClient);
      await platformTxResponse.getReceipt(hederaClient);
      console.log('✅ USDC paid:', sellerTxResponse.transactionId.toString(), platformTxResponse.transactionId.toString());
      
      // Step 2: Associate token
      console.log('🔗 Step 2/3: Associating NFT token...');
      try {
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(accountId)
          .setTokenIds([TokenId.fromString(asset.tokenId)])
          .setMaxTransactionFee(new Hbar(2));
        
        associateTx.freezeWithSigner(signer);
        const signedAssociateTx = await signer.signTransaction(associateTx);
        const associateResponse = await signedAssociateTx.execute(hederaClient);
        await associateResponse.getReceipt(hederaClient);
        console.log('✅ Token associated:', associateResponse.transactionId.toString());
      } catch (associateError: any) {
        if (associateError.message?.includes('TOKEN_ALREADY_ASSOCIATED')) {
          console.log('✅ Token already associated');
        } else {
          console.error('❌ Association failed:', associateError.message);
          throw new Error(`Token association failed: ${associateError.message}`);
        }
      }
      
      // Step 3: Call backend to transfer NFT from marketplace escrow to buyer
      console.log('🎨 Step 3/3: Requesting NFT transfer from marketplace escrow...');
      console.log('   NFT is held by marketplace (0.0.6916959)');
      console.log('   Backend will transfer from marketplace → buyer');
      
      const nftTransferResult = await apiService.post('/hedera/marketplace/transfer-nft', {
        nftTokenId: asset.tokenId,
        serialNumber: asset.serialNumber,
        buyerAccountId: accountId,
        listingId: listingId
      });
      
      console.log('✅ NFT transferred from escrow:', nftTransferResult.data.transactionId);
      
      const buyResult = {
        transactionId: nftTransferResult.data.transactionId,
        sellerTransactionId: sellerTxResponse.transactionId.toString(),
        platformTransactionId: platformTxResponse.transactionId.toString(),
        platformFee: exactPlatformFee.toString()
      };

      console.log('🎉 Purchase completed:', buyResult);
      
      // Show royalty information in console
      if (exactRoyaltyAmount > 0) {
        const totalSellerAmount = exactSellerAmount + exactRoyaltyAmount;
        console.log(`👑 Royalty included: ${exactRoyaltyAmount.toFixed(2)} USDC in seller payment`);
        console.log(`💵 Seller received: ${exactSellerAmount.toFixed(2)} USDC base + ${exactRoyaltyAmount.toFixed(2)} USDC royalty = ${totalSellerAmount.toFixed(2)} USDC total`);
      } else {
        console.log(`💵 Seller received: ${exactSellerAmount.toFixed(2)} USDC`);
      }
      console.log(`💰 Platform fee: ${exactPlatformFee.toFixed(2)} USDC`);

      // Track activity
      trackActivity({
        type: 'sale',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        assetImage: asset.imageURI || asset.image,
        from: asset.owner,
        to: accountId,
        price: assetPrice,
        transactionId: buyResult.transactionId
      });

      // Submit to HCS
      await submitToHCS({
        type: 'sale',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        from: asset.owner,
        to: accountId,
        price: assetPrice,
        royalty: exactRoyaltyAmount,
        timestamp: new Date().toISOString(),
        transactionId: buyResult.transactionId
      });

      // No localStorage - blockchain is source of truth
      
      // Update actualOwner state immediately
      setActualOwner(accountId);

      toast({
        title: 'Purchase Successful! 🎉',
        description: exactRoyaltyAmount > 0 
          ? `You've successfully purchased ${asset.name}! ${royaltyPercentage}% royalty (${exactRoyaltyAmount.toFixed(2)} USDC) was sent to the creator.`
          : `You've successfully purchased ${asset.name} for ${assetPrice} USDC!`,
        variant: 'default'
      });

      // Close modal immediately
      onClose();
      
      // Refresh marketplace after modal closes
      if (onAssetUpdate) {
        setTimeout(() => {
          onAssetUpdate();
        }, 500);
      }

    } catch (error) {
      console.error('Failed to buy asset:', error);
      toast({
        title: 'Purchase Failed',
        description: error instanceof Error ? error.message : 'Failed to purchase asset',
        variant: 'destructive'
      });
    } finally {
      setIsBuying(false);
    }
  };

  const handleMakeOffer = async () => {
    try {
      setIsMakingOffer(true);

      if (!accountId) {
        throw new Error('Please connect your wallet to make an offer');
      }

      const price = parseFloat(offerPrice);
      if (!price || price <= 0) {
        throw new Error('Please enter a valid offer price');
      }

      console.log('💼 Making offer on asset:', {
        asset: asset.name,
        offerPrice: price,
        duration: offerDuration,
        buyer: accountId
      });

      // Store offer on HCS only (no localStorage)

      // Submit to HCS
      await submitToHCS({
        type: 'offer',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        from: accountId,
        to: asset.owner,
        price: price,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Offer Submitted!',
        description: `Your offer of ${price} USDC for ${asset.name} has been sent to the seller.`,
        variant: 'default'
      });

      setShowOfferModal(false);
      setOfferPrice('');

    } catch (error) {
      console.error('Failed to make offer:', error);
      toast({
        title: 'Offer Failed',
        description: error instanceof Error ? error.message : 'Failed to submit offer',
        variant: 'destructive'
      });
    } finally {
      setIsMakingOffer(false);
    }
  };

  if (!isOpen || !asset) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-off-white">{asset.name}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-full transition-colors ${
                    isFavorited
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'bg-gray-800 text-gray-400 hover:text-pink-400'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-off-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            {asset.assetType === 'Trading Pool' ? (
              /* Pool Trading Interface */
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-primary-blue mb-2">Pool Trading</h3>
                  <p className="text-text-secondary">Trade pool tokens on the secondary market</p>
                </div>
                
                {/* Pool Information */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                  <div className="flex items-start gap-6">
                    {/* Pool Image */}
                    <div className="flex-shrink-0">
                      <img
                        src={asset.imageUrl || asset.imageURI || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%231a1a1a"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="%2300ff88" text-anchor="middle" dy=".3em">POOL</text></svg>'}
                        alt="Pool Image"
                        className="w-24 h-24 object-cover rounded-lg border border-gray-600"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%231a1a1a"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="%2300ff88" text-anchor="middle" dy=".3em">POOL</text></svg>';
                        }}
                      />
                    </div>
                    
                    {/* Pool Details */}
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-primary-blue mb-2">{asset.name}</h4>
                      <p className="text-text-secondary mb-4">{asset.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-text-secondary text-sm">Total Value</p>
                          <p className="text-lg font-bold text-primary-blue">
                            ${asset.totalValue?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-secondary text-sm">Token Price</p>
                          <p className="text-lg font-bold text-blue-400">
                            ${asset.price || '0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-secondary text-sm">Expected APY</p>
                          <p className="text-lg font-bold text-primary-blue">
                            {asset.expectedAPY || '0'}%
                          </p>
                        </div>
                        <div>
                          <p className="text-text-secondary text-sm">Status</p>
                          <p className={`text-lg font-bold ${asset.status === 'ACTIVE' ? 'text-primary-blue' : 'text-yellow-400'}`}>
                            {asset.status || 'UNKNOWN'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Pool Investment Interface - Centrifuge Style */}
                <div className="space-y-6">
                  {/* Main Action Buttons - Prominent */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-primary-blue mb-4">Pool Investment</h3>
                    
                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-text-secondary text-sm">Token Price</p>
                        <p className="text-xl font-bold text-primary-blue">
                          {asset.price || '1.00'} USDC
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-text-secondary text-sm">Total Value</p>
                        <p className="text-xl font-bold text-blue-400">
                          ${(asset.totalValue || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-text-secondary text-sm">Expected APY</p>
                        <p className="text-xl font-bold text-primary-blue">
                          {asset.expectedAPY || '0'}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-text-secondary text-sm">Status</p>
                        <p className={`text-xl font-bold ${asset.status === 'ACTIVE' ? 'text-primary-blue' : 'text-yellow-400'}`}>
                          {asset.status || 'UNKNOWN'}
                        </p>
                      </div>
                    </div>

                    {/* Main Action Buttons */}
                    <div className="flex gap-3 justify-center">
                      <button 
                        onClick={handleInvest}
                        className="bg-primary-blue text-black px-4 py-2 rounded-lg font-medium hover:bg-primary-blue transition-colors text-sm"
                      >
                        {isInvesting ? 'Complete Investment' : 'Invest'}
                      </button>
                      
                      <button 
                        onClick={handleRedeem}
                        disabled={userPoolBalance === 0}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {isRedeeming ? 'Complete Redemption' : userPoolBalance === 0 ? 'No Holdings' : 'Redeem'}
                      </button>

                      <button
                        onClick={() => setShowAdvancedTrading(!showAdvancedTrading)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors text-sm"
                      >
                        {showAdvancedTrading ? 'Hide Trading' : 'Advanced Trading'}
                      </button>

                      <button
                        onClick={() => setShowYieldDashboard(!showYieldDashboard)}
                        className="bg-primary-blue text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-blue transition-colors text-sm"
                      >
                        {showYieldDashboard ? 'Hide Yield' : 'Yield Dashboard'}
                      </button>

                      <button
                        onClick={() => setShowRiskDashboard(!showRiskDashboard)}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-500 transition-colors text-sm"
                      >
                        {showRiskDashboard ? 'Hide Risk' : 'Risk Assessment'}
                      </button>
                    </div>

                    {/* Advanced Trading */}
                    {showAdvancedTrading && (
                      <div className="mt-6">
                        <AdvancedOrderBook
                          poolId={asset.poolId}
                          poolName={asset.name}
                          currentPrice={asset.tokenPrice || 1}
                          onTradeExecuted={(trade) => {
                            console.log('Trade executed:', trade);
                            // Update user balance or trigger refresh
                          }}
                        />
                      </div>
                    )}

                    {/* Yield Dashboard */}
                    {showYieldDashboard && (
                      <div className="mt-6">
                        <YieldDashboard
                          poolId={asset.poolId}
                          poolName={asset.name}
                        />
                      </div>
                    )}

                    {/* Risk Assessment */}
                    {showRiskDashboard && (
                      <div className="mt-6">
                        <RiskDashboard
                          poolId={asset.poolId}
                          poolName={asset.name}
                        />
                      </div>
                    )}

                    {/* Details Toggle */}
                    <div className="text-center">
                      <button 
                        onClick={() => setShowPoolDetails(!showPoolDetails)}
                        className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 mx-auto"
                      >
                        {showPoolDetails ? 'Hide Details' : 'Show Details'}
                        <span className={`transform transition-transform ${showPoolDetails ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Pool Details */}
                  {showPoolDetails && (
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-white mb-4">Pool Details</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-md font-semibold text-white mb-3">Pool Information</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Asset Type:</span>
                              <span className="text-white">Real World Assets</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Min Investment:</span>
                              <span className="text-white">{asset.minimumInvestment || '100'} USDC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Investors:</span>
                              <span className="text-white">{asset.totalInvestors || '0'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Pool Type:</span>
                              <span className="text-white">{asset.poolType || 'REAL_ESTATE'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-md font-semibold text-white mb-3">Your Holdings</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Pool Tokens:</span>
                              <span className="text-white">{userPoolBalance.toFixed(2)} {asset.poolId?.substring(5, 10) || 'POOL'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Value (USD):</span>
                              <span className="text-white">${(userPoolBalance * (asset.price || 1)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Unrealized P&L:</span>
                              <span className="text-white">$0.00</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Investment Form - Only shown when investing */}
                  {isInvesting && (
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-white mb-4">Investment Details</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Investment Amount (USDC)
                          </label>
                          <input
                            type="number"
                            placeholder="100"
                            value={investmentAmount}
                            onChange={(e) => setInvestmentAmount(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                          />
                        </div>
                        
                        <div className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">You will receive:</span>
                            <span className="text-white">
                              {investmentAmount ? (parseFloat(investmentAmount) / (asset.price || 1)).toFixed(2) : '0.00'} Pool Tokens
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Estimated APY:</span>
                            <span className="text-primary-blue">{asset.expectedAPY || '0'}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Redeem Form - Only shown when redeeming */}
                  {isRedeeming && userPoolBalance > 0 && (
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-white mb-4">Redemption Details</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Redeem Amount (Pool Tokens)
                          </label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={redeemAmount}
                            onChange={(e) => setRedeemAmount(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-blue"
                          />
                        </div>
                        
                        <div className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">You will receive:</span>
                            <span className="text-white">
                              {redeemAmount ? (parseFloat(redeemAmount) * (asset.price || 1)).toFixed(2) : '0.00'} USDC
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Current Value:</span>
                            <span className="text-white">
                              ${redeemAmount ? (parseFloat(redeemAmount) * (asset.price || 1)).toFixed(2) : '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pool Performance Chart Placeholder */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Pool Performance</h4>
                    <div className="h-32 bg-gray-700 rounded-lg flex items-center justify-center">
                      <p className="text-gray-400">Performance chart coming soon</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Regular Asset Content */
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Image */}
              <div className="space-y-4">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-800">
                  <img
                    src={asset.imageURI || asset.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="%231a1a1a"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="%2300ff88" text-anchor="middle" dy=".3em">NFT</text></svg>'}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="%231a1a1a"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="%2300ff88" text-anchor="middle" dy=".3em">NFT</text></svg>';
                    }}
                  />
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-midnight-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">Owner</p>
                    <p className="text-sm font-bold text-off-white truncate">
                      {actualOwner?.slice(0, 6)}...{actualOwner?.slice(-4) || ''}
                    </p>
                  </div>
                  <div className="bg-midnight-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">Token ID</p>
                    <p className="text-sm font-bold text-primary-blue truncate">
                      {asset.tokenId?.slice(4, 10)}
                    </p>
                  </div>
                  <div className="bg-midnight-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">Status</p>
                    <p className={`text-sm font-bold ${marketplaceListingStatus.isListed ? 'text-primary-blue' : 'text-gray-400'}`}>
                      {marketplaceListingStatus.isLoading ? '...' : marketplaceListingStatus.isListed ? 'For Sale' : 'Not Listed'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column - Details & Actions */}
              <div className="space-y-4">
                {/* Price */}
                <div className="bg-gradient-to-br from-primary-blue/10 to-primary-blue-light/10 rounded-xl p-4 border border-primary-blue/30">
                  <p className="text-sm text-gray-400 mb-1">Price</p>
                  <p className="text-3xl font-bold text-primary-blue">
                    {asset.price || asset.totalValue || '100'} USDC
                  </p>
                </div>

                {/* Description */}
                {asset.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-off-white mb-2">Description</h3>
                    <p className="text-sm text-gray-400">{asset.description}</p>
                  </div>
                )}

                {/* Details */}
                <div>
                  <h3 className="text-sm font-semibold text-off-white mb-2">Details</h3>
                  <div className="space-y-2">
                    {asset.category && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Category</span>
                        <span className="text-off-white">{asset.category}</span>
                      </div>
                    )}
                    {asset.location && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Location</span>
                        <span className="text-off-white">{asset.location}</span>
                      </div>
                    )}
                    {asset.createdAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Created</span>
                        <span className="text-off-white">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - BUYER FOCUSED */}
                <div className="flex flex-col gap-3 pt-4">
                  {isOwner ? (
                    // If owner, show minimal message
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-xs text-blue-400 text-center">
                        You own this asset. Go to your Profile to manage it.
                      </p>
                    </div>
                  ) : (
                    // Buyer actions
                    <>
                      <Button
                        variant="neon"
                        className="w-full"
                        onClick={handleBuyAsset}
                        disabled={isBuying || !marketplaceListingStatus.isListed || marketplaceListingStatus.isLoading}
                      >
                        {isBuying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Buying...
                          </>
                        ) : marketplaceListingStatus.isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Checking availability...
                          </>
                        ) : !marketplaceListingStatus.isListed ? (
                          'Not Listed for Sale'
                        ) : (
                          <>
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Buy Now for {asset.price || asset.totalValue || '100'} USDC
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowOfferModal(true)}
                      >
                        <Tag className="w-4 h-4 mr-2" />
                        Make Offer
                      </Button>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            const publicUrl = `${window.location.origin}/asset/${asset.tokenId}`;
                            navigator.clipboard.writeText(publicUrl);
                            toast({
                              title: 'Link Copied!',
                              description: 'Asset link copied to clipboard',
                              variant: 'default'
                            });
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>

                        <a
                          href={`https://hashscan.io/testnet/token/${asset.tokenId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Hashscan
                          </Button>
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Offer Modal */}
            {showOfferModal && (
              <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-700">
                  <h3 className="text-xl font-bold text-off-white mb-4">Make an Offer</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Offer Price (USDC)
                      </label>
                      <input
                        type="number"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        className="w-full px-4 py-2 bg-midnight-800 border border-gray-700 rounded-lg text-off-white"
                        placeholder="Enter offer amount"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Offer Duration
                      </label>
                      <select
                        value={offerDuration}
                        onChange={(e) => setOfferDuration(e.target.value)}
                        className="w-full px-4 py-2 bg-midnight-800 border border-gray-700 rounded-lg text-off-white"
                      >
                        <option value="1">1 Day</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowOfferModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="neon"
                        className="flex-1"
                        onClick={handleMakeOffer}
                        disabled={isMakingOffer}
                      >
                        {isMakingOffer ? 'Submitting...' : 'Submit Offer'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MarketplaceAssetModal;

