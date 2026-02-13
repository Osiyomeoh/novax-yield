/**
 * Activity Tracker
 * Tracks marketplace activities (sales, listings, transfers)
 */

export interface Activity {
  id: string;
  type: 'sale' | 'listing' | 'unlisting' | 'offer' | 'offer_accepted' | 'offer_rejected' | 'transfer';
  assetTokenId: string;
  assetName: string;
  assetImage?: string;
  from?: string;
  to?: string;
  price?: number;
  timestamp: string;
  transactionId?: string;
}

/**
 * Track a new activity
 * Note: Activities are now stored on HCS (Hedera Consensus Service), not localStorage
 */
export const trackActivity = (activity: Omit<Activity, 'id' | 'timestamp'>): Activity => {
  const newActivity: Activity = {
    ...activity,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  };

  // Activities are submitted to HCS in the component calling this function
  // No localStorage storage needed
  console.log('📊 Activity tracked (HCS):', newActivity.type, newActivity.assetName);
  
  return newActivity;
};

/**
 * Get all activities from Mantle blockchain only
 * Queries recent transactions from smart contracts on Mantle
 */
export const getAllActivities = async (): Promise<Activity[]> => {
  try {
    console.log('🔗 Fetching activities from blockchain...');
    
    // Mantle contract service removed - using Etherlink/Novax contracts instead
    // TODO: Replace with Novax contract calls for Etherlink
    console.warn('⚠️ Mantle service removed - activity fetching not available');
    
    const activities: Activity[] = [];
    
    try {
      // Mantle service removed - return empty activities for now
      // const activeListings = await mantleContractService.getAllActiveListings();
      const activeListings: any[] = [];
      console.log(`🔗 Found ${activeListings.length} active listings on Mantle blockchain`);
      
      // Convert listings to activities
      for (const listing of activeListings) {
        if (listing.createdAt) {
          activities.push({
            id: listing.listingId?.toString() || `listing-${Date.now()}`,
            type: 'listing',
            assetTokenId: listing.tokenId?.toString() || '0',
            assetName: listing.name || `Asset #${listing.tokenId || listing.assetId}`,
            assetImage: listing.imageURI || listing.image,
            from: listing.seller,
            price: parseFloat(listing.price || listing.totalValue || '0'),
            timestamp: listing.createdAt,
            transactionId: listing.listingId?.toString()
          });
        }
      }
      
      // TODO: Fetch actual sales/transfers from Mantle blockchain events
      // This would require listening to Transfer, Sale, and Listing events from the smart contracts
      // For now, we only show listings since we can query them directly
      
      console.log(`🔗 Total activities from Mantle blockchain: ${activities.length}`);
      
      return activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (blockchainError) {
      console.error('❌ Error fetching activities from Mantle blockchain:', blockchainError);
      return [];
    }
  } catch (error) {
    console.error('❌ Failed to fetch activities from Mantle blockchain:', error);
    return [];
  }
};

/**
 * Get recent activities (last N)
 */
export const getRecentActivities = async (limit: number = 20): Promise<Activity[]> => {
  const activities = await getAllActivities();
  return activities.slice(0, limit);
};

/**
 * Get activities for a specific asset
 */
export const getAssetActivities = async (assetTokenId: string): Promise<Activity[]> => {
  const activities = await getAllActivities();
  return activities.filter(a => a.assetTokenId === assetTokenId);
};

/**
 * Get activities by type
 */
export const getActivitiesByType = async (type: Activity['type']): Promise<Activity[]> => {
  const activities = await getAllActivities();
  return activities.filter(a => a.type === type);
};

/**
 * Get activities for a user (as buyer or seller)
 */
export const getUserActivities = async (accountId: string): Promise<Activity[]> => {
  const activities = await getAllActivities();
  return activities.filter(a => 
    a.from?.toLowerCase() === accountId.toLowerCase() || 
    a.to?.toLowerCase() === accountId.toLowerCase()
  );
};

/**
 * Get activity statistics
 */
export const getActivityStats = async () => {
  const activities = await getAllActivities();
  
  const sales = activities.filter(a => a.type === 'sale');
  const listings = activities.filter(a => a.type === 'listing');
  const offers = activities.filter(a => a.type === 'offer');
  
  const totalVolume = sales.reduce((sum, a) => sum + (a.price || 0), 0);
  const avgSalePrice = sales.length > 0 ? totalVolume / sales.length : 0;
  
  // Get unique traders
  const traders = new Set<string>();
  activities.forEach(a => {
    if (a.from) traders.add(a.from);
    if (a.to) traders.add(a.to);
  });
  
  return {
    totalSales: sales.length,
    totalListings: listings.length,
    totalOffers: offers.length,
    totalVolume,
    avgSalePrice,
    uniqueTraders: traders.size,
    last24hSales: sales.filter(a => 
      new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length
  };
};

/**
 * Format activity for display
 */
export const formatActivity = (activity: Activity): string => {
  switch (activity.type) {
    case 'sale':
      return `${activity.assetName} sold for ${activity.price} USDC`;
    case 'listing':
      return `${activity.assetName} listed for ${activity.price} USDC`;
    case 'unlisting':
      return `${activity.assetName} unlisted`;
    case 'offer':
      return `Offer of ${activity.price} USDC made on ${activity.assetName}`;
    case 'offer_accepted':
      return `Offer accepted for ${activity.assetName}`;
    case 'offer_rejected':
      return `Offer rejected for ${activity.assetName}`;
    case 'transfer':
      return `${activity.assetName} transferred`;
    default:
      return `Activity on ${activity.assetName}`;
  }
};

/**
 * Get time ago string
 */
export const getTimeAgo = (timestamp: string): string => {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

