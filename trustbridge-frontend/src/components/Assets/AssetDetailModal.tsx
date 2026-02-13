import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ExternalLink, Copy, Tag, MapPin, Calendar, User, TrendingUp, Share2, Heart, Edit, Send, Loader2, ChevronDown, FileText } from 'lucide-react';
import { Card, CardContent } from '../UI/Card';
import Button from '../UI/Button';
import { useToast } from '../../hooks/useToast';
import { useWallet } from '../../contexts/WalletContext';
import { usePrivy } from '@privy-io/react-auth';
import { marketplaceContractService } from '../../services/marketplace-contract.service';
import { marketplaceV2Service } from '../../services/marketplaceV2Service';
import { trackActivity } from '../../utils/activityTracker';
import { apiService } from '../../services/api';
// Hedera SDK imports removed - now using Mantle/EVM

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
  onAssetUpdate?: () => void; // Callback to refresh assets after listing/unlisting
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ isOpen, onClose, asset, onAssetUpdate }) => {
  const { toast } = useToast();
  const { address } = useWallet();
  const { user } = usePrivy();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get Ethereum address from Privy (for Mantle blockchain assets)
  const ethereumAddress = user?.wallet?.address || null;
  const [isBuying, setIsBuying] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isUnlisting, setIsUnlisting] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerDuration, setOfferDuration] = useState('7'); // Default 7 days
  const [isMakingOffer, setIsMakingOffer] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [assetOffers, setAssetOffers] = useState<any[]>([]);
  const [showOffersSection, setShowOffersSection] = useState(false);
  const [assetMetadata, setAssetMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [showDocumentsSection, setShowDocumentsSection] = useState(false);

  // Check if asset is favorited on mount
  useEffect(() => {
    if (!asset?.tokenId || !address) return;
    
    const favorites = JSON.parse(localStorage.getItem('favoritedAssets') || '{}');
    const userFavorites = favorites[address] || [];
    setIsFavorited(userFavorites.includes(asset.tokenId));
  }, [asset?.tokenId, address]);

  // Load offers for this asset
  useEffect(() => {
    if (!asset?.tokenId || !isOpen) return;
    
    const allOffers = JSON.parse(localStorage.getItem('assetOffers') || '[]');
    const offersForAsset = allOffers.filter((offer: any) => 
      offer.assetTokenId === asset.tokenId && 
      offer.status === 'pending' &&
      new Date(offer.expiresAt) > new Date() // Not expired
    );
    
    // Sort by price (highest first)
    offersForAsset.sort((a: any, b: any) => b.offerPrice - a.offerPrice);
    
    setAssetOffers(offersForAsset);
    console.log('💼 Loaded offers for asset:', offersForAsset.length);
  }, [asset?.tokenId, isOpen]);
  
  // Marketplace listing state
  const [marketplaceListingStatus, setMarketplaceListingStatus] = useState<{
    isListed: boolean;
    listingId: number;
    isLoading: boolean;
  }>({
    isListed: false,
    listingId: 0,
    isLoading: true
  });
  
  // Local state for optimistic UI updates
  const [localListingStatus, setLocalListingStatus] = useState<boolean | null>(null);
  
  // Check if current user is the owner (using Ethereum address for Mantle)
  const isOwner = asset?.owner && address && (
    asset.owner.toLowerCase() === address.toLowerCase() || asset.owner === address
  );
  
  // Debug logging
  console.log('🔍 AssetDetailModal - Owner check:', {
    assetOwner: asset?.owner,
    assetName: asset?.name,
    assetId: asset?.assetId,
    assetTokenId: asset?.tokenId,
    currentAddress: address,
    isOwner,
    ownerMatch: address && asset?.owner && asset.owner.toLowerCase() === address.toLowerCase()
  });
  
  // Check if user is marketplace account
  const isMarketplaceAccount = false; // No longer needed for Mantle
  
  // Determine listing status (prioritize: local optimistic > marketplace contract > localStorage)
  const isListed = localListingStatus !== null 
    ? localListingStatus 
    : marketplaceListingStatus.isListed;

  // Debug logging
  console.log('🔍 Asset listing status check:', {
    assetName: asset?.name,
    localListingStatus,
    marketplaceIsListed: marketplaceListingStatus.isListed,
    marketplaceListingId: marketplaceListingStatus.listingId,
    isLoading: marketplaceListingStatus.isLoading,
    finalIsListed: isListed
  });

  // Check marketplace listing status - ALWAYS query blockchain state
  useEffect(() => {
    const checkMarketplaceStatus = async () => {
      if (!isOpen) {
        return;
      }

      // Check if asset has assetId (Mantle) or tokenId (Hedera)
      const assetId = asset?.assetId;
      const tokenId = asset?.tokenId;
      
      if (!assetId && !tokenId) {
        // No asset identifier available
        setMarketplaceListingStatus({
          isListed: false,
          listingId: 0,
          isLoading: false
        });
        return;
      }

      try {
        // Reset local optimistic state when checking fresh
        setLocalListingStatus(null);
        
        console.log('🔍 Verifying blockchain state for listing status...');
        setMarketplaceListingStatus(prev => ({ ...prev, isLoading: true }));

        // For Mantle assets (assetId exists), query marketplace contract directly
        if (assetId) {
          try {
            const { ethers } = await import('ethers');
            const { getContractAddress } = await import('../../config/contracts');
            
            // Create read-only provider for Mantle
            const rpcUrl = import.meta.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            // Get marketplace contract address
            const marketplaceAddress = getContractAddress('TRUST_MARKETPLACE');
            
            // Minimal ABI for getAssetListings
            const TRUSTMarketplaceABI = [
              'function getAssetListings(bytes32) external view returns (tuple(uint256 listingId, bytes32 assetId, address seller, uint256 price, bool isActive, uint256 createdAt, uint256 expiresAt)[])',
            ];
            
            // Create contract instance
            const marketplace = new ethers.Contract(marketplaceAddress, TRUSTMarketplaceABI, provider);
            
            // Get listings for this asset
            const listings = await marketplace.getAssetListings(assetId);
            
            // Asset is listed if there are any active listings
            const activeListing = listings.find((listing: any) => listing.isActive);
            const isListed = !!activeListing;
            
            console.log('✅ Verified listing status from Mantle marketplace:', {
              assetId,
              isListed,
              listingId: activeListing ? Number(activeListing.listingId) : 0,
              listingsCount: listings.length
            });
            
            setMarketplaceListingStatus({
              isListed,
              listingId: activeListing ? Number(activeListing.listingId) : 0,
              isLoading: false
            });
          } catch (mantleError: any) {
            console.warn('⚠️ Failed to check Mantle marketplace status:', mantleError.message);
            // Fall through to assume not listed
            setMarketplaceListingStatus({
              isListed: false,
              listingId: 0,
              isLoading: false
            });
          }
        } 
        // For Hedera assets (tokenId exists), use backend API
        else if (tokenId) {
          const apiUrl = import.meta.env.VITE_API_URL || '';
          if (!apiUrl) {
            throw new Error('API URL not configured');
          }
          
          const response = await fetch(`${apiUrl}/assets/blockchain-state/${tokenId}/${asset.serialNumber || '1'}`);
          if (!response.ok) {
            throw new Error('Failed to fetch blockchain state');
          }
          
          const data = await response.json();
          if (data.success) {
            console.log('✅ Verified listing status from Hedera blockchain:', data.data);
            
            setMarketplaceListingStatus({
              isListed: data.data.isListed,
              listingId: data.data.isListed ? 1 : 0,
              isLoading: false
            });
          } else {
            throw new Error('Invalid response from blockchain state API');
          }
        }

        // No localStorage - blockchain is source of truth
      } catch (error) {
        console.error('❌ Failed to verify blockchain status:', error);
        console.warn('⚠️ Cannot verify marketplace status - blockchain query failed');
        
        // On query error, assume not listed
        setMarketplaceListingStatus({
          isListed: false,
          listingId: 0,
          isLoading: false
        });
      }
    };

    checkMarketplaceStatus();
  }, [isOpen, asset?.assetId, asset?.tokenId, asset?.serialNumber]);

  // State for asset with fresh imageURI
  const [assetWithImage, setAssetWithImage] = useState<any>(null);

  // Log asset imageURI when modal opens and fetch fresh data if needed
  useEffect(() => {
    if (isOpen && asset) {
      console.log('🖼️ ========== ASSET DETAIL MODAL OPENED ==========');
      console.log('🖼️ Asset ID:', asset.assetId);
      console.log('🖼️ Asset Name:', asset.name);
      console.log('🖼️ Image URI (top level):', asset.imageURI || '❌ EMPTY');
      console.log('🖼️ Display Image:', asset.displayImage || '❌ EMPTY');
      console.log('🖼️ Image:', asset.image || '❌ EMPTY');
      console.log('🖼️ Metadata Image:', asset.metadata?.image || '❌ EMPTY');
      console.log('🖼️ Metadata ImageURI:', asset.metadata?.imageURI || '❌ EMPTY');
      console.log('🖼️ Metadata DisplayImage:', asset.metadata?.displayImage || '❌ EMPTY');
      console.log('🖼️ Complete asset object:', JSON.stringify({
        assetId: asset.assetId,
        name: asset.name,
        imageURI: asset.imageURI,
        displayImage: asset.displayImage,
        image: asset.image,
        metadata: asset.metadata
      }, null, 2));
      
      // Check if imageURI is missing
      const hasImageURI = asset.imageURI || asset.displayImage || asset.image || asset.metadata?.image || asset.metadata?.imageURI;
      
      // Use asset as-is (Mantle contract service removed - using Novax/Etherlink)
      setAssetWithImage(asset);
      
      console.log('🖼️ ========== END ASSET DETAIL MODAL ==========');
    } else {
      setAssetWithImage(null);
    }
  }, [isOpen, asset]);

  // Fetch asset metadata from documentURI when modal opens
  useEffect(() => {
    const fetchAssetMetadata = async () => {
      if (!isOpen || !asset?.documentURI) {
        setAssetMetadata(null);
        return;
      }

      try {
        setLoadingMetadata(true);
        console.log('📥 Fetching asset metadata from documentURI:', asset.documentURI);
        
        // Use normalizeIPFSUrl utility function
        const { normalizeIPFSUrl } = await import('../../utils/imageUtils');
        const normalizedUrl = normalizeIPFSUrl(asset.documentURI);
        
        if (!normalizedUrl) {
          console.warn('⚠️ Could not normalize documentURI:', asset.documentURI);
          return;
        }

        const response = await fetch(normalizedUrl);
        if (response.ok) {
          const metadata = await response.json();
          console.log('✅ Asset metadata fetched:', metadata);
          setAssetMetadata(metadata);
        } else {
          console.warn('⚠️ Failed to fetch metadata:', response.status, response.statusText);
        }
      } catch (error: any) {
        console.error('❌ Error fetching asset metadata:', error);
      } finally {
        setLoadingMetadata(false);
      }
    };

    fetchAssetMetadata();
  }, [isOpen, asset?.documentURI]);

  // Use assetWithImage if available, otherwise use asset
  const displayAsset = assetWithImage || asset;
  
  if (!isOpen || !asset) return null;

  const handleListAsset = async () => {
    try {
      setIsListing(true);
      
      // HEDERA-SPECIFIC CODE - DISABLED FOR MANTLE
      // Listing functionality needs to be updated for Mantle/EVM
      if (!address) {
        throw new Error('Please connect your wallet to list assets');
      }
      throw new Error('Listing functionality is being updated for Mantle. Please check back soon.');

      const assetPrice = parseFloat(asset.price || asset.totalValue || '100');
      const royaltyPercentage = parseFloat(asset.royaltyPercentage || asset.metadata?.royaltyPercentage || '0');

      console.log('📋 Listing asset - transferring to marketplace escrow:', asset.name);

      // ESCROW MODEL: Transfer NFT to marketplace, marketplace holds it until sold
      const marketplaceAccountId = '0.0.6916959'; // Marketplace escrow account

      console.log('🏦 Transferring NFT to marketplace escrow (Hedera code - needs Mantle/EVM implementation):', {
        nft: asset.tokenId,
        serial: asset.serialNumber,
        from: address,
        to: marketplaceAccountId
      });
      
      // TODO: Replace with Mantle/EVM marketplace listing
      throw new Error('Marketplace listing not yet implemented for Mantle/EVM');

      // Transfer NFT from seller to marketplace escrow
      const transferTx = new TransferTransaction()
        .addNftTransfer(
          TokenId.fromString(asset.tokenId),
          parseInt(asset.serialNumber || '1'),
          AccountId.fromString(accountId), // From seller
          AccountId.fromString(marketplaceAccountId) // To marketplace escrow
        )
        .setTransactionMemo(`List for sale: ${asset.name}`)
        .setMaxTransactionFee(new Hbar(2));

      // Freeze the transaction before signing
      console.log('🧊 Freezing transaction...');
      transferTx.freezeWithSigner(signer);
      
      // Sign and execute the transfer
      console.log('✍️ Signing transfer to escrow...');
      let signedTx;
      try {
        signedTx = await signer.signTransaction(transferTx);
      } catch (signError: any) {
        if (signError.message?.includes('session') || signError.message?.includes('deleted')) {
          throw new Error('Wallet session expired. Please disconnect and reconnect your wallet.');
        }
        throw signError;
      }
      
      console.log('📡 Executing transfer...');
      const response = await signedTx.execute(hederaClient);
      console.log('⏳ Getting receipt...');
      const receipt = await response.getReceipt(hederaClient);

      console.log('✅ NFT transferred to marketplace escrow:', response.transactionId.toString());

      // ESCROW MODEL: Transfer to marketplace = Listed
      // No smart contract call needed - the escrow transfer IS the listing
      console.log('✅ Asset is now LISTED (in escrow)');

      // Update UI optimistically
      setLocalListingStatus(true);

      // Update marketplace status state
      setMarketplaceListingStatus({
        isListed: true,
        listingId: 1, // In escrow = listed
        isLoading: false
      });

      // Track activity
      trackActivity({
        type: 'listing',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        assetImage: asset.imageURI || asset.image,
        from: address,
        price: assetPrice,
        transactionId: 'mantle-tx-placeholder'
      });

      // Note: HCS (Hedera Consensus Service) is Hedera-specific, skipping for Mantle
      // TODO: Implement Mantle/EVM transaction logging

      toast({
        title: 'Asset Listed Successfully!',
        description: royaltyPercentage > 0 
          ? `${asset.name} listed with ${royaltyPercentage}% royalty!`
          : `${asset.name} is now listed on the marketplace`,
        variant: 'default'
      });

      // Trigger asset refresh callback
      if (onAssetUpdate) {
        setTimeout(() => {
          onAssetUpdate();
          onClose();
        }, 1500);
      }

    } catch (error: any) {
      console.error('Failed to list asset:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to create blockchain listing';
      let errorTitle = 'Listing Failed';
      
      // Check for session-related errors
      if (error.message?.includes('session') || error.message?.includes('deleted') || error.message?.includes('Record was recently deleted')) {
        errorTitle = '🔄 Wallet Session Expired';
        errorMessage = 'Your wallet session has expired. Please disconnect and reconnect your wallet, then try listing again.';
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 8000 // Show longer for session errors
      });
    } finally {
      setIsListing(false);
    }
  };

  const handleUnlistAsset = async () => {
    try {
      setIsUnlisting(true);

      if (!address || !signer) {
        throw new Error('Please connect your wallet to unlist assets');
      }
      
      // TODO: Replace with Mantle/EVM marketplace unlisting
      throw new Error('Marketplace unlisting not yet implemented for Mantle/EVM');

      console.log('🔓 Unlisting asset:', {
        name: asset.name,
        tokenId: asset.tokenId,
        currentOwner: asset.owner
      });

      // Check where the NFT currently is
      const marketplaceEscrowAccount = '0.0.6916959'; // Marketplace escrow account
      const isInEscrow = asset.owner === marketplaceEscrowAccount;

      if (isInEscrow) {
        // ESCROW MODEL: Transfer NFT back from marketplace to seller
        console.log('🏦 Asset is in escrow - transferring back to seller');

        const transferTx = new TransferTransaction()
          .addNftTransfer(
            TokenId.fromString(asset.tokenId),
            parseInt(asset.serialNumber || '1'),
            AccountId.fromString(marketplaceEscrowAccount), // From marketplace escrow
            AccountId.fromString(accountId) // Back to seller
          )
          .setTransactionMemo(`Unlist from sale: ${asset.name}`)
          .setMaxTransactionFee(new Hbar(2));

        transferTx.freezeWithSigner(signer);
        const signedTx = await signer.signTransaction(transferTx);
        const response = await signedTx.execute(hederaClient);
        await response.getReceipt(hederaClient);

        console.log('✅ NFT transferred back to seller from escrow');
      } else {
        // SMART CONTRACT MODEL: Try to cancel listing on contract
        console.log('📝 Asset is in smart contract - attempting to cancel listing');
        
        try {
          // Try to cancel listing on smart contract
          const cancelResult = await marketplaceV2Service.cancelListing(
            marketplaceListingStatus.listingId || 1,
            accountId,
            signer,
            hederaClient
          );
          
          console.log('✅ Listing cancelled on smart contract:', cancelResult.transactionId);
        } catch (contractError) {
          console.warn('⚠️ Smart contract cancellation failed, trying direct transfer...');
          
          // Fallback: Try direct transfer from current owner
          const transferTx = new TransferTransaction()
            .addNftTransfer(
              TokenId.fromString(asset.tokenId),
              parseInt(asset.serialNumber || '1'),
              AccountId.fromString(asset.owner), // From current owner (could be contract)
              AccountId.fromString(accountId) // Back to seller
            )
            .setTransactionMemo(`Unlist from sale: ${asset.name}`)
            .setMaxTransactionFee(new Hbar(2));

          transferTx.freezeWithSigner(signer);
          const signedTx = await signer.signTransaction(transferTx);
          const response = await signedTx.execute(hederaClient);
          await response.getReceipt(hederaClient);

          console.log('✅ NFT transferred back to seller via direct transfer');
        }
      }

      console.log('✅ Asset is now UNLISTED (returned to seller)');
      
      // Optimistic UI update
      setLocalListingStatus(false);

      // Update marketplace status state
      setMarketplaceListingStatus({
        isListed: false,
        listingId: 0,
        isLoading: false
      });

      // Track activity
      trackActivity({
        type: 'unlisting',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        assetImage: asset.imageURI || asset.image,
        from: address,
        transactionId: 'mantle-unlisted-' + Date.now()
      });

      // Note: HCS (Hedera Consensus Service) is Hedera-specific, skipping for Mantle
      // TODO: Implement Mantle/EVM transaction logging

      toast({
        title: 'Asset Unlisted Successfully!',
        description: `${asset.name} is no longer for sale and has been returned to you.`,
        variant: 'default'
      });

      // Trigger asset refresh callback
      if (onAssetUpdate) {
        setTimeout(() => {
          onAssetUpdate();
          onClose();
        }, 1500);
      }

    } catch (error) {
      console.error('Failed to unlist asset:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to remove blockchain listing';
      
      // Provide helpful error message for common issues
      if (errorMessage.includes('INVALID_SIGNATURE')) {
        errorMessage = 'Unable to unlist this asset. It may be from the old system. Please try listing it again with the new escrow system.';
      }
      
      toast({
        title: 'Unlisting Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsUnlisting(false);
    }
  };

  const handleToggleFavorite = () => {
    if (!address) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to favorite assets',
        variant: 'default'
      });
      return;
    }

    const favorites = JSON.parse(localStorage.getItem('favoritedAssets') || '{}');
    const userFavorites = favorites[address] || [];
    
    if (isFavorited) {
      // Remove from favorites
      favorites[address] = userFavorites.filter((id: string) => id !== asset.tokenId);
      setIsFavorited(false);
      toast({
        title: 'Removed from Favorites',
        description: `${asset.name} removed from your watchlist`,
        variant: 'default'
      });
    } else {
      // Add to favorites
      favorites[address] = [...userFavorites, asset.tokenId];
      setIsFavorited(true);
      toast({
        title: 'Added to Favorites!',
        description: `${asset.name} added to your watchlist`,
        variant: 'default'
      });
    }
    
    localStorage.setItem('favoritedAssets', JSON.stringify(favorites));
  };

  // Helper: Submit event to HCS for immutable audit trail
  const submitToHCS = async (event: any) => {
    try {
      await apiService.post('/hedera/hcs/marketplace/event', event);
      console.log('📋 Event submitted to HCS:', event.type);
    } catch (error) {
      console.warn('⚠️ Failed to submit to HCS (non-critical):', error);
      // Don't throw - HCS submission failure shouldn't block operations
    }
  };

  const handleAcceptOffer = async (offer: any) => {
    try {
      console.log('✅ Accepting offer:', offer);

      // Call marketplace buy with the offer price
      console.log('Accepting offer (Mantle/EVM implementation needed):', {
        listingId: marketplaceListingStatus.listingId,
        buyer: offer.buyer,
        price: offer.offerPrice,
        seller: address
      });
      
      // TODO: Implement Mantle/EVM marketplace buy
      const buyResult = null;

      // Update offer status
      const allOffers = JSON.parse(localStorage.getItem('assetOffers') || '[]');
      const updatedOffers = allOffers.map((o: any) => 
        o.offerId === offer.offerId 
          ? { ...o, status: 'accepted', acceptedAt: new Date().toISOString() }
          : o
      );
      localStorage.setItem('assetOffers', JSON.stringify(updatedOffers));

      // Reload offers
      setAssetOffers(assetOffers.filter(o => o.offerId !== offer.offerId));

      // Note: HCS (Hedera Consensus Service) is Hedera-specific, skipping for Mantle
      // TODO: Implement Mantle/EVM transaction logging
      console.log('Offer accepted (Mantle/EVM logging needed):', {
        type: 'offer_accepted',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        from: address,
        to: offer.buyer,
        price: offer.offerPrice,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Offer Accepted!',
        description: `You accepted the offer of ${offer.offerPrice} USDC from ${offer.buyer.slice(0, 6)}...`,
        variant: 'default'
      });

      // Trigger refresh
      if (onAssetUpdate) {
        setTimeout(() => onAssetUpdate(), 1500);
      }
    } catch (error) {
      console.error('Failed to accept offer:', error);
      toast({
        title: 'Accept Failed',
        description: error instanceof Error ? error.message : 'Failed to accept offer',
        variant: 'destructive'
      });
    }
  };

  const handleRejectOffer = async (offer: any) => {
    console.log('❌ Rejecting offer:', offer);

    // Update offer status
    const allOffers = JSON.parse(localStorage.getItem('assetOffers') || '[]');
    const updatedOffers = allOffers.map((o: any) => 
      o.offerId === offer.offerId 
        ? { ...o, status: 'rejected', rejectedAt: new Date().toISOString() }
        : o
    );
    localStorage.setItem('assetOffers', JSON.stringify(updatedOffers));

    // Reload offers
    setAssetOffers(assetOffers.filter(o => o.offerId !== offer.offerId));

    // Note: HCS (Hedera Consensus Service) is Hedera-specific, skipping for Mantle
    // TODO: Implement Mantle/EVM transaction logging
    console.log('Offer rejected (Mantle/EVM logging needed):', {
      type: 'offer_rejected',
      assetTokenId: asset.tokenId,
      assetName: asset.name,
      from: address,
      to: offer.buyer,
      price: offer.offerPrice,
      timestamp: new Date().toISOString()
    });

    toast({
      title: 'Offer Rejected',
      description: `You rejected the offer of ${offer.offerPrice} USDC`,
      variant: 'default'
    });
  };

  const handleMakeOffer = async () => {
    try {
      setIsMakingOffer(true);

      if (!address) {
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
        buyer: address
      });

      // Store offer in localStorage (will be moved to smart contract or backend)
      const offers = JSON.parse(localStorage.getItem('assetOffers') || '[]');
      const newOffer = {
        offerId: Date.now(),
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        buyer: address,
        seller: asset.owner,
        offerPrice: price,
        duration: parseInt(offerDuration),
        expiresAt: new Date(Date.now() + parseInt(offerDuration) * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'pending' // pending, accepted, rejected, expired
      };

      offers.push(newOffer);
      localStorage.setItem('assetOffers', JSON.stringify(offers));

      // Submit to HCS for immutable audit trail
      // Note: HCS (Hedera Consensus Service) is Hedera-specific, skipping for Mantle
      // await submitToHCS({
      //   type: 'offer',
      //   assetTokenId: asset.tokenId,
      //   assetName: asset.name,
      //   from: address,
      //   to: asset.owner,
      //   price: price,
      //   timestamp: new Date().toISOString()
      // });

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

  const handleBuyAsset = async () => {
    try {
      setIsBuying(true);
      
      if (!address || !signer) {
        throw new Error('Please connect your wallet to buy assets');
      }

      // Check if asset is listed for sale
      if (!asset.isListed) {
        throw new Error('This asset is not currently listed for sale');
      }

      const assetPrice = parseFloat(asset.price || asset.totalValue || '100');
      
      // Note: Token balance check removed - using USDC on Etherlink

      const royaltyPercentage = parseFloat(asset.royaltyPercentage || asset.metadata?.royaltyPercentage || '0');
      
      console.log('💰 Buying asset from marketplace (Mantle/EVM implementation needed):', {
        asset: asset.name,
        price: assetPrice,
        royalty: royaltyPercentage + '%',
        buyer: address
      });

      // ESCROW MODEL: Manual royalty distribution
      const marketplaceAccountId = '0.0.6916959'; // Marketplace escrow account
      const creatorAccountId = asset.owner; // Original creator
      const platformFeePercentage = 2.5; // 2.5% platform fee
      
      // Calculate payments
      const platformFee = (assetPrice * platformFeePercentage) / 100;
      const royaltyAmount = royaltyPercentage > 0 ? (assetPrice * royaltyPercentage) / 100 : 0;
      const sellerAmount = assetPrice - platformFee - royaltyAmount;

      console.log('💸 Payment breakdown:', {
        totalPrice: assetPrice,
        platformFee: platformFee,
        royaltyAmount: royaltyAmount,
        sellerAmount: sellerAmount
      });

      // STEP 1: Transfer USDC to seller (Trust Token removed)
      toast({
        title: 'Processing Payment...',
        description: `Sending ${sellerAmount} USDC to seller`,
        variant: 'default'
      });

      // TODO: Replace with Mantle/EVM token transfers and NFT transfer
      // This Hedera-specific code needs to be replaced with Mantle smart contract calls
      console.log('⚠️ Hedera-specific payment code - needs Mantle/EVM implementation');
      console.log('Purchase details (Mantle implementation needed):', {
        seller: creatorAccountId,
        buyer: address,
        sellerAmount,
        royaltyAmount,
        platformFee,
        asset: asset.name
      });
      
      const nftResponse = {
        transactionId: { toString: () => 'mantle-tx-placeholder-' + Date.now() }
      };
      
      throw new Error('Asset purchase not yet implemented for Mantle/EVM. Smart contract integration needed.');
      
      // Optimistic UI update
      setLocalListingStatus(false);
      setMarketplaceListingStatus({
        isListed: false,
        listingId: 0,
        isLoading: false
      });

      toast({
        title: 'Purchase Successful! 🎉',
        description: royaltyAmount > 0 
          ? `You've successfully purchased ${asset.name}! ${royaltyPercentage}% royalty (${royaltyAmount} USDC) was sent to the creator.`
          : `You've successfully purchased ${asset.name}!`,
        variant: 'default'
      });

      // Track activity
      trackActivity({
        type: 'sale',
        assetTokenId: asset.tokenId,
        assetName: asset.name,
        assetImage: asset.imageURI || asset.image,
        from: asset.owner,
        to: address,
        price: assetPrice,
        transactionId: 'mantle-tx-' + Date.now()
      });

      // Note: HCS (Hedera Consensus Service) is Hedera-specific, skipping for Mantle
      // TODO: Implement Mantle/EVM transaction logging
      // await submitToHCS({
      //   type: 'sale',
      //   assetTokenId: asset.tokenId,
      //   assetName: asset.name,
      //   from: asset.owner,
      //   to: address,
      //   price: assetPrice,
      //   royalty: royaltyAmount,
      //   timestamp: new Date().toISOString(),
      //   transactionId: 'mantle-tx-' + Date.now()
      // });

      // Trigger asset refresh
      if (onAssetUpdate) {
        setTimeout(() => {
          onAssetUpdate();
          sessionStorage.setItem('profileNeedsRefresh', 'true');
          toast({
            title: 'Asset Acquired!',
            description: 'Visit your Profile to see your new asset.',
            variant: 'default'
          });
          onClose();
        }, 5000);
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

  const handleCopyTokenId = () => {
    navigator.clipboard.writeText(asset.tokenId);
    toast({
      title: 'Copied!',
      description: 'Token ID copied to clipboard',
      variant: 'default'
    });
  };

  const handleViewOnMantle = () => {
    // Use assetId (contract address) if available, otherwise use tokenId
    const addressOrId = displayAsset?.assetId || asset?.assetId || asset?.tokenId;
    if (addressOrId) {
      const explorerUrl = `https://explorer.sepolia.mantle.xyz/address/${addressOrId}`;
      console.log('🔗 Opening Mantle Explorer:', explorerUrl);
      window.open(explorerUrl, '_blank');
    } else {
      console.warn('⚠️ No address/tokenId available to view on Mantle Explorer');
      toast({
        title: "Unable to open explorer",
        description: "Asset address not available",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/asset/${asset.tokenId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied!',
      description: 'Asset link copied to clipboard',
      variant: 'default'
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-midnight-900 border border-midnight-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-midnight-900 border-b border-midnight-700 p-6 flex items-center justify-between z-10">
            <h2 className="text-2xl font-bold text-off-white">{asset.name}</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-midnight-800 hover:bg-midnight-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Image */}
              <div className="space-y-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-midnight-800 relative">
                  {(() => {
                    // Use displayAsset instead of asset to get fresh imageURI if fetched
                    // Try multiple image sources
                    const imageUrl = displayAsset.imageURI || displayAsset.displayImage || displayAsset.image || displayAsset.metadata?.image || displayAsset.metadata?.imageURI || displayAsset.metadata?.displayImage;
                    
                    console.log('🖼️ Detail Modal - Image URL resolution:', {
                      'displayAsset.imageURI': displayAsset.imageURI,
                      'displayAsset.displayImage': displayAsset.displayImage,
                      'displayAsset.image': displayAsset.image,
                      'displayAsset.metadata?.image': displayAsset.metadata?.image,
                      'displayAsset.metadata?.imageURI': displayAsset.metadata?.imageURI,
                      'displayAsset.metadata?.displayImage': displayAsset.metadata?.displayImage,
                      'Final imageUrl': imageUrl,
                      'Using fresh asset data': assetWithImage !== null
                    });
                    
                    if (imageUrl) {
                      // Use normalizeIPFSUrl utility function for proper normalization
                      import('../../utils/imageUtils').then(({ normalizeIPFSUrl }) => {
                        const normalizedUrl = normalizeIPFSUrl(imageUrl);
                        console.log('🖼️ Detail Modal - Normalized URL:', {
                          original: imageUrl,
                          normalized: normalizedUrl
                        });
                      });
                      
                      // Normalize IPFS URLs using inline logic (for immediate render)
                      let normalizedUrl = imageUrl;
                      
                      // Use the normalizeIPFSUrl utility function if available
                      try {
                        // Try to use the utility function synchronously (it will be imported async above)
                        if (imageUrl.startsWith('ipfs://')) {
                          const cid = imageUrl.replace('ipfs://', '').replace('ipfs/', '').split('/')[0].split('?')[0].trim();
                          const gateway = import.meta.env.VITE_PINATA_GATEWAY_URL || 'gateway.pinata.cloud';
                          normalizedUrl = `https://${gateway}/ipfs/${cid}`;
                          console.log('🖼️ Detail Modal - Normalized ipfs:// URL:', { original: imageUrl, normalized: normalizedUrl, cid });
                        } else if (!imageUrl.startsWith('http')) {
                          // Assume it's a CID - extract clean CID
                          const cid = imageUrl.split('/')[0].split('?')[0].trim();
                          
                          // Try to normalize - be more lenient with CID validation
                          // Qm CIDs are 46 chars, baf CIDs are 59-62 chars, but also accept any reasonable hash length
                          if (cid && (cid.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56,62})$/) || (cid.length >= 44 && cid.length <= 100))) {
                            const gateway = import.meta.env.VITE_PINATA_GATEWAY_URL || 'gateway.pinata.cloud';
                            normalizedUrl = `https://${gateway}/ipfs/${cid}`;
                            console.log('🖼️ Detail Modal - Normalized CID URL:', { original: imageUrl, normalized: normalizedUrl, cid });
                          } else {
                            console.warn('⚠️ Detail Modal - Suspicious CID format, trying anyway:', cid);
                            // Try to normalize anyway - might still work
                            const gateway = import.meta.env.VITE_PINATA_GATEWAY_URL || 'gateway.pinata.cloud';
                            normalizedUrl = `https://${gateway}/ipfs/${cid}`;
                          }
                        } else if (imageUrl.startsWith('http') && imageUrl.includes('/ipfs/')) {
                          // Already has IPFS gateway URL, but might need to switch gateway
                          const cidMatch = imageUrl.match(/\/ipfs\/([^\/\?]+)/);
                          if (cidMatch && cidMatch[1]) {
                            const cid = cidMatch[1];
                            const gateway = import.meta.env.VITE_PINATA_GATEWAY_URL || 'gateway.pinata.cloud';
                            normalizedUrl = `https://${gateway}/ipfs/${cid}`;
                            console.log('🖼️ Detail Modal - Switched IPFS gateway:', { original: imageUrl, normalized: normalizedUrl, cid });
                          } else {
                            console.log('🖼️ Detail Modal - URL is already HTTP with IPFS:', normalizedUrl);
                          }
                        } else {
                          console.log('🖼️ Detail Modal - URL is already HTTP (not IPFS):', normalizedUrl);
                        }
                      } catch (error: any) {
                        console.error('❌ Error normalizing IPFS URL:', error);
                        // Fallback to original URL
                        normalizedUrl = imageUrl;
                      }
                      
                      return (
                        <>
                          <img
                            src={normalizedUrl}
                            alt={displayAsset.name || 'Asset'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('❌ Detail modal image failed to load:', {
                                normalizedUrl,
                                originalImageUrl: imageUrl,
                                assetName: displayAsset.name,
                                assetId: displayAsset.assetId,
                                usingFreshAsset: assetWithImage !== null
                              });
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                            onLoad={() => {
                              console.log('✅ Detail modal image loaded successfully:', normalizedUrl);
                            }}
                          />
                          {/* Fallback */}
                          <div className="hidden w-full h-full items-center justify-center absolute inset-0">
                            <Tag className="w-24 h-24 text-gray-600" />
                            <p className="text-gray-400 mt-4">Image unavailable</p>
                            <p className="text-gray-500 text-xs mt-2">URL: {imageUrl}</p>
                          </div>
                        </>
                      );
                    }
                    
                    console.warn('⚠️ Detail Modal - No image URL found for asset:', {
                      assetId: displayAsset.assetId,
                      assetName: displayAsset.name,
                      usingFreshAsset: assetWithImage !== null
                    });
                    
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="w-24 h-24 text-gray-600" />
                        <p className="text-gray-400 mt-4">No image</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewOnMantle}
                    className="flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="text-xs">Mantle</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="flex items-center justify-center gap-1"
                  >
                    <Share2 className="w-3 h-3" />
                    <span className="text-xs">Share</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleFavorite}
                    className={`flex items-center justify-center gap-1 transition-all ${
                      isFavorited ? 'bg-red-500/20 border-red-500/40 text-red-400' : ''
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${isFavorited ? 'fill-red-400' : ''}`} />
                    <span className="text-xs">{isFavorited ? 'Favorited' : 'Favorite'}</span>
                  </Button>
                </div>
              </div>

              {/* Right Column - Details */}
              <div className="space-y-6">
                {/* Price Card */}
                <Card className="bg-gradient-to-br from-primary-blue/10 to-primary-blue-light/10 border-primary-blue/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Current Price</span>
                      <TrendingUp className="w-4 h-4 text-primary-blue" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-primary-blue">
                        {asset.price || asset.totalValue || '100'}
                      </span>
                      <span className="text-lg text-primary-blue-light">USDC</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ≈ ${parseFloat(asset.price || asset.totalValue || '100') * 0.01} USD
                    </p>
                  </CardContent>
                </Card>

                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold text-off-white mb-2">Description</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {asset.description || 'No description available'}
                  </p>
                </div>

                {/* Asset Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-off-white">Asset Details</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Token ID */}
                    <div className="bg-midnight-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">Token ID</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-off-white truncate">
                          {asset.tokenId}
                        </span>
                        <button
                          onClick={handleCopyTokenId}
                          className="p-1 hover:bg-midnight-700 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    {/* Serial Number */}
                    {asset.serialNumber && (
                      <div className="bg-midnight-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Tag className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">Serial #</span>
                        </div>
                        <span className="text-xs font-mono text-off-white">
                          #{asset.serialNumber}
                        </span>
                      </div>
                    )}

                    {/* Owner */}
                    <div className="bg-midnight-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">Owner</span>
                      </div>
                      <span className="text-xs font-mono text-off-white truncate">
                        {asset.owner ? `${asset.owner.slice(0, 8)}...${asset.owner.slice(-6)}` : 'Unknown'}
                      </span>
                    </div>

                    {/* Location */}
                    {asset.location && (
                      <div className="bg-midnight-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">Location</span>
                        </div>
                        <span className="text-xs text-off-white">
                          {typeof asset.location === 'string' 
                            ? asset.location 
                            : asset.location.address || `${asset.location.region || ''}, ${asset.location.country || ''}`.trim() || 'N/A'}
                        </span>
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="bg-midnight-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">Created</span>
                      </div>
                      <span className="text-xs text-off-white">
                        {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>

                    {/* Category */}
                    {asset.category && (
                      <div className="bg-midnight-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Tag className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">Category</span>
                        </div>
                        <span className="text-xs text-off-white">
                          {asset.category}
                        </span>
                      </div>
                    )}

                    {/* Creator Royalty */}
                    {asset.royaltyPercentage && parseFloat(asset.royaltyPercentage) > 0 && (
                      <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-3 col-span-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">👑</span>
                          <span className="text-xs text-purple-300 font-semibold">Creator Royalty</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-purple-400">
                            {asset.royaltyPercentage}%
                          </span>
                          <span className="text-xs text-gray-400">
                            paid on every resale
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Creator earns {asset.royaltyPercentage}% of the sale price automatically on all future sales
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Properties */}
                {asset.royaltyPercentage && (
                  <div>
                    <h3 className="text-sm font-semibold text-off-white mb-2">Properties</h3>
                    <div className="bg-midnight-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Royalty</span>
                        <span className="text-xs text-off-white font-medium">
                          {asset.royaltyPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Documents & Evidence Files */}
                {(asset.documentURI || assetMetadata?.evidenceFiles?.length > 0 || asset.metadata?.evidenceFiles?.length > 0) && (
                  <div>
                    <button
                      onClick={() => setShowDocumentsSection(!showDocumentsSection)}
                      className="flex items-center justify-between w-full text-sm font-semibold text-off-white mb-2 hover:text-primary-blue transition-colors"
                    >
                      <span>
                        Documents & Evidence 
                        {(() => {
                          const docCount = assetMetadata?.evidenceFiles?.length || asset.metadata?.evidenceFiles?.length || 0;
                          return docCount > 0 ? ` (${docCount})` : '';
                        })()}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showDocumentsSection ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showDocumentsSection && (
                      <div className="space-y-3">
                        {/* Metadata Document */}
                        {asset.documentURI && (
                          <div className="bg-midnight-800 rounded-lg p-3 border border-gray-700">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary-blue" />
                                <span className="text-sm text-off-white">Asset Metadata</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const { normalizeIPFSUrl } = require('../../utils/imageUtils');
                                  const url = normalizeIPFSUrl(asset.documentURI) || asset.documentURI;
                                  window.open(url, '_blank');
                                }}
                                className="text-xs"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </div>
                            {loadingMetadata && (
                              <p className="text-xs text-gray-400 mt-2">Loading metadata...</p>
                            )}
                            {assetMetadata && (
                              <p className="text-xs text-gray-400 mt-2">
                                Contains: {Object.keys(assetMetadata).filter(k => k !== 'evidenceFiles').join(', ')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Evidence Files */}
                        {(assetMetadata?.evidenceFiles || asset.metadata?.evidenceFiles || []).map((file: any, index: number) => {
                          const fileUrl = file.url || file.cid || file;
                          const fileName = file.name || `Document ${index + 1}`;
                          const fileType = file.type || 'application/octet-stream';
                          
                          // Normalize IPFS URL
                          let normalizedUrl = fileUrl;
                          if (fileUrl.startsWith('ipfs://')) {
                            const cid = fileUrl.replace('ipfs://', '').replace('ipfs/', '');
                            const gateway = import.meta.env.VITE_PINATA_GATEWAY_URL || 'gateway.pinata.cloud';
                            normalizedUrl = `https://${gateway}/ipfs/${cid}`;
                          } else if (!fileUrl.startsWith('http')) {
                            const gateway = import.meta.env.VITE_PINATA_GATEWAY_URL || 'gateway.pinata.cloud';
                            normalizedUrl = `https://${gateway}/ipfs/${fileUrl}`;
                          }

                          return (
                            <div key={index} className="bg-midnight-800 rounded-lg p-3 border border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className="w-4 h-4 text-primary-blue flex-shrink-0" />
                                  <span className="text-sm text-off-white truncate">{fileName}</span>
                                  <span className="text-xs text-gray-400 flex-shrink-0">
                                    ({fileType.split('/')[1]?.toUpperCase() || 'FILE'})
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(normalizedUrl, '_blank')}
                                  className="text-xs ml-2 flex-shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </div>
                              {file.size && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Size: {(file.size / 1024).toFixed(2)} KB
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {(!assetMetadata?.evidenceFiles?.length && !asset.metadata?.evidenceFiles?.length) && (
                          <p className="text-xs text-gray-400 text-center py-4">
                            No evidence files available
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Offers Section - Only show for owners */}
                {isOwner && assetOffers.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowOffersSection(!showOffersSection)}
                      className="flex items-center justify-between w-full text-sm font-semibold text-off-white mb-2 hover:text-primary-blue transition-colors"
                    >
                      <span>Offers ({assetOffers.length})</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showOffersSection ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showOffersSection && (
                      <div className="space-y-2">
                        {assetOffers.map((offer) => (
                          <div
                            key={offer.offerId}
                            className="bg-midnight-800 rounded-lg p-3 border border-gray-700"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-sm font-bold text-primary-blue">
                                  {offer.offerPrice} USDC
                                </p>
                                <p className="text-xs text-gray-400">
                                  from {offer.buyer.slice(0, 6)}...{offer.buyer.slice(-4)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">
                                  Expires in {Math.ceil((new Date(offer.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d
                                </p>
                              </div>
                            </div>
                            
                            {/* Accept/Reject Buttons */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="neon"
                                className="flex-1 text-xs"
                                onClick={() => handleAcceptOffer(offer)}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => handleRejectOffer(offer)}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Trading Status */}
                <div className="flex items-center gap-2">
                  {isListed ? (
                    <span className="px-3 py-1 bg-primary-blue/20 text-primary-blue text-xs font-medium rounded-full">
                      Listed for Sale
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-xs font-medium rounded-full">
                      Not Listed
                    </span>
                  )}
                  {asset.status === 'active' && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  {isOwner ? (
                    // Owner actions
                    <>
                      {/* Only show listing buttons for non-marketplace accounts */}
                      {!isMarketplaceAccount && (
                        <>
                          {isListed ? (
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={handleUnlistAsset}
                              disabled={isUnlisting}
                            >
                              {isUnlisting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Unlisting...
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 mr-2" />
                                  Unlist from Sale
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="neon"
                              className="flex-1"
                              onClick={handleListAsset}
                              disabled={isListing}
                            >
                              {isListing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Listing...
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  List for Sale
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: 'Coming Soon',
                            description: 'Transfer functionality will be available soon',
                            variant: 'default'
                          });
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Transfer
                      </Button>
                    </>
                  ) : (
                    // Buyer actions
                    <>
                      <Button
                        variant="neon"
                        className="flex-1"
                        onClick={handleBuyAsset}
                        disabled={isBuying || !isListed}
                      >
                        {isBuying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Purchasing...
                          </>
                        ) : isListed ? (
                          `Buy for ${asset.price || asset.totalValue || '100'} USDC`
                        ) : (
                          'Not Listed for Sale'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowOfferModal(true)}
                      >
                        Make Offer
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Make Offer Modal */}
      {showOfferModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-midnight-900 rounded-xl border border-gray-800 max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-off-white">Make an Offer</h3>
              <button
                onClick={() => setShowOfferModal(false)}
                className="p-2 hover:bg-midnight-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Asset Info */}
              <div className="bg-midnight-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Making offer on</p>
                <p className="text-lg font-semibold text-off-white">{asset.name}</p>
                {isListed && (
                  <p className="text-sm text-gray-400 mt-2">
                    Current Price: <span className="text-primary-blue font-medium">{asset.price || '100'} USDC</span>
                  </p>
                )}
              </div>

              {/* Offer Price Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Offer Price (USDC)
                </label>
                <input
                  type="number"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="Enter offer amount"
                  min="1"
                  className="w-full px-4 py-3 bg-midnight-800 border border-gray-700 rounded-lg text-off-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 focus:border-primary-blue"
                />
                {isListed && offerPrice && (
                  <p className="text-xs text-gray-400 mt-1">
                    {parseFloat(offerPrice) < parseFloat(asset.price || '100') 
                      ? `${(100 - (parseFloat(offerPrice) / parseFloat(asset.price || '100')) * 100).toFixed(0)}% below listing price`
                      : `${((parseFloat(offerPrice) / parseFloat(asset.price || '100')) * 100 - 100).toFixed(0)}% above listing price`
                    }
                  </p>
                )}
              </div>

              {/* Offer Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Offer Duration
                </label>
                <select
                  value={offerDuration}
                  onChange={(e) => setOfferDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-midnight-800 border border-gray-700 rounded-lg text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue/50 focus:border-primary-blue"
                >
                  <option value="1">1 Day</option>
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>

              {/* Summary */}
              <div className="bg-primary-blue/10 border border-primary-blue/30 rounded-lg p-4">
                <p className="text-sm text-gray-300">
                  Your offer of <span className="text-primary-blue font-bold">{offerPrice || '0'} USDC</span> will be valid for{' '}
                  <span className="text-primary-blue font-bold">{offerDuration} days</span>.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  The seller can accept your offer at any time during this period.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOfferModal(false);
                    setOfferPrice('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="neon"
                  onClick={handleMakeOffer}
                  disabled={isMakingOffer || !offerPrice || parseFloat(offerPrice) <= 0}
                  className="flex-1"
                >
                  {isMakingOffer ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Offer'
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AssetDetailModal;

