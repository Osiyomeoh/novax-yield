import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  Eye, 
  Star, 
  Tag, 
  DollarSign, 
  Calendar, 
  Zap, 
  Shield, 
  Award, 
  MessageCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Flag, 
  MoreHorizontal, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Plus, 
  ShoppingCart, 
  CreditCard, 
  Wallet, 
  History, 
  BarChart3, 
  Activity,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  RefreshCw,
  Settings,
  Bell,
  Heart,
  Share2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';
import { contractService } from '../services/contractService';

interface MarketData {
  id: string;
  name: string;
  type: 'auction' | 'fixed' | 'offer' | 'bundle';
  status: 'active' | 'ended' | 'cancelled' | 'sold';
  asset: {
    id: string;
    name: string;
    imageURI: string;
    category: string;
    attributes: Array<{
      trait_type: string;
      value: string;
      rarity: string;
    }>;
  };
  seller: string;
  currentPrice: string;
  startingPrice?: string;
  reservePrice?: string;
  buyNowPrice?: string;
  highestBid?: string;
  bidCount: number;
  endTime?: number;
  timeLeft?: string;
  volume: string;
  floorPrice: string;
  priceChange: number;
  priceChangePercent: number;
  views: number;
  likes: number;
  offers: Array<{
    id: string;
    bidder: string;
    amount: string;
    timestamp: number;
  }>;
}

const SecondaryMarkets: React.FC = () => {
  const { toast } = useToast();
  const { address, isConnected } = useWallet();
  const { user } = useAuth();
  
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'auctions' | 'fixed' | 'offers' | 'bundles'>('auctions');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'volume' | 'popularity'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPrice, setFilterPrice] = useState({ min: '', max: '' });
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const categories = [
    'All', 'Digital Art', 'NFT', 'Cryptocurrency', 'Digital Collectibles', 
    'Virtual Real Estate', 'Digital Music', 'Digital Books', 'Digital Games'
  ];


  useEffect(() => {
    loadMarkets();
  }, [activeTab, sortBy, sortOrder, filterPrice, filterCategory, searchQuery]);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      // TODO: Fetch markets from contracts/backend
      // For now, return empty array - data should come from actual sources
      setMarkets([]);
    } catch (error) {
      console.error('Error loading markets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load market data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (marketId: string) => {
    if (!isConnected || !address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to place a bid',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      await contractService.placeBid(marketId, bidAmount);
      toast({
        title: 'Bid Placed',
        description: `Your bid of ${bidAmount} TRUST has been placed`,
        variant: 'default'
      });
      setShowBidModal(false);
      setBidAmount('');
      loadMarkets();
    } catch (error) {
      console.error('Error placing bid:', error);
      toast({
        title: 'Error',
        description: 'Failed to place bid',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuyNow = async (marketId: string, price: string) => {
    if (!isConnected || !address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to buy',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      await contractService.buyAsset(marketId, price);
      toast({
        title: 'Purchase Successful',
        description: 'Asset purchased successfully',
        variant: 'default'
      });
      loadMarkets();
    } catch (error) {
      console.error('Error buying asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to purchase asset',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredMarkets = markets.filter(market => {
    const matchesTab = market.type === activeTab || (activeTab === 'auctions' && market.type === 'auction');
    const matchesSearch = market.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || market.asset.category === filterCategory;
    const matchesPrice = (!filterPrice.min || parseFloat(market.currentPrice) >= parseFloat(filterPrice.min)) &&
                       (!filterPrice.max || parseFloat(market.currentPrice) <= parseFloat(filterPrice.max));
    
    return matchesTab && matchesSearch && matchesCategory && matchesPrice;
  });

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'price':
        aValue = parseFloat(a.currentPrice);
        bValue = parseFloat(b.currentPrice);
        break;
      case 'time':
        aValue = a.endTime || 0;
        bValue = b.endTime || 0;
        break;
      case 'volume':
        aValue = parseFloat(a.volume);
        bValue = parseFloat(b.volume);
        break;
      case 'popularity':
        aValue = a.views + a.likes;
        bValue = b.views + b.likes;
        break;
      default:
        return 0;
    }
    
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const tabs = [
    { id: 'auctions', label: 'Live Auctions', icon: Clock, count: markets.filter(m => m.type === 'auction').length },
    { id: 'fixed', label: 'Fixed Price', icon: Tag, count: markets.filter(m => m.type === 'fixed').length },
    { id: 'offers', label: 'Offers', icon: MessageCircle, count: markets.filter(m => m.type === 'offer').length },
    { id: 'bundles', label: 'Bundles', icon: Package, count: markets.filter(m => m.type === 'bundle').length }
  ];

  return (
    <div className="min-h-screen bg-black text-off-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-off-white mb-2">Secondary Markets</h1>
          <p className="text-sm text-primary-blue-light">Trade digital assets in real-time auctions and fixed-price listings</p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex gap-1 border-b border-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary-blue border-b-2 border-primary-blue'
                      : 'text-gray-400 hover:text-off-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets..."
                  className="pl-10 text-sm"
                />
              </div>
              
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="text-sm"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-primary-blue text-black' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-primary-blue text-black' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-off-white focus:border-primary-blue"
              >
                <option value="time-desc">Ending Soon</option>
                <option value="time-asc">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="volume-desc">Most Volume</option>
                <option value="popularity-desc">Most Popular</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">Category</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-off-white"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">Min Price (TRUST)</label>
                    <Input
                      type="number"
                      value={filterPrice.min}
                      onChange={(e) => setFilterPrice(prev => ({ ...prev, min: e.target.value }))}
                      placeholder="0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">Max Price (TRUST)</label>
                    <Input
                      type="number"
                      value={filterPrice.max}
                      onChange={(e) => setFilterPrice(prev => ({ ...prev, max: e.target.value }))}
                      placeholder="100"
                      className="text-sm"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Market Grid/List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
            </div>
          ) : (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
            }>
              {sortedMarkets.map((market) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="group"
                >
                  <Card className="overflow-hidden hover:border-primary-blue/50 transition-all duration-300">
                    <div className="relative">
                      <img
                        src={market.asset.imageURI}
                        alt={market.asset.name}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          market.type === 'auction' ? 'bg-yellow-500/90 text-black' :
                          market.type === 'fixed' ? 'bg-primary-blue/90 text-black' :
                          'bg-blue-500/90 text-black'
                        }`}>
                          {market.type === 'auction' ? 'Auction' :
                           market.type === 'fixed' ? 'Fixed Price' :
                           market.type === 'offer' ? 'Offer' : 'Bundle'}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3 flex gap-1">
                        <button className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors">
                          <Heart className="w-3 h-3 text-white" />
                        </button>
                        <button className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors">
                          <Share2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      {market.endTime && market.endTime > Date.now() && (
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="bg-black/50 backdrop-blur-sm rounded px-2 py-1">
                            <div className="flex items-center gap-1 text-xs text-white">
                              <Clock className="w-3 h-3" />
                              <span>{market.timeLeft}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-medium text-off-white group-hover:text-primary-blue transition-colors truncate">
                            {market.name}
                          </h3>
                          <p className="text-xs text-gray-400">{market.asset.category}</p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-off-white">{market.currentPrice} TRUST</p>
                            <p className="text-xs text-primary-blue-light">
                              {market.priceChange >= 0 ? '+' : ''}{market.priceChangePercent}%
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-400">
                            <p>{market.bidCount} bids</p>
                            <p>{market.views} views</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {market.type === 'auction' ? (
                            <Button
                              onClick={() => {
                                setSelectedMarket(market);
                                setShowBidModal(true);
                              }}
                              className="flex-1 bg-primary-blue text-black hover:bg-primary-blue-light text-xs"
                            >
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Place Bid
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleBuyNow(market.id, market.currentPrice)}
                              disabled={isProcessing}
                              className="flex-1 bg-primary-blue text-black hover:bg-primary-blue-light text-xs"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <ShoppingCart className="w-3 h-3 mr-1" />
                              )}
                              Buy Now
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Bid Modal */}
        <AnimatePresence>
          {showBidModal && selectedMarket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 rounded-lg p-6 w-full max-w-md"
              >
                <h3 className="text-lg font-semibold text-off-white mb-4">Place a Bid</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                    <img
                      src={selectedMarket.asset.imageURI}
                      alt={selectedMarket.asset.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-medium text-off-white">{selectedMarket.asset.name}</h4>
                      <p className="text-xs text-gray-400">{selectedMarket.asset.category}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">
                      Bid Amount (TRUST)
                    </label>
                    <Input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Enter bid amount"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Current highest bid: {selectedMarket.highestBid} TRUST
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowBidModal(false)}
                      variant="outline"
                      className="flex-1 text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleBid(selectedMarket.id)}
                      disabled={!bidAmount || isProcessing}
                      className="flex-1 bg-primary-blue text-black hover:bg-primary-blue-light text-sm"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Place Bid
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SecondaryMarkets;
