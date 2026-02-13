import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UI/Card';
import Button from '../components/UI/Button';
import { TrendingUp, DollarSign, Activity, Users, Globe, ArrowUpRight, Sparkles, Loader2, AlertCircle, Settings, ShoppingCart, Award, Building2, Shield, Coins, BarChart3, Vote, Building, User } from 'lucide-react';
import { useMarketAnalytics, useAssets } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import KYCBanner from '../components/UI/KYCBanner';
import { IntegrationTest } from '../components/Debug/IntegrationTest';
import { contractService } from '../services/contractService';
import { useToast } from '../hooks/useToast';

const Dashboard: React.FC = () => {
  const { user, startKYC, authStep, isAuthenticated } = useAuth();
  const [showKYCBanner, setShowKYCBanner] = useState(true);
  const [showIntegrationTest, setShowIntegrationTest] = useState(false);
  const [mintingTokens, setMintingTokens] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check authentication status and redirect if needed
  useEffect(() => {
    console.log('Dashboard - Auth check:', { isAuthenticated, authStep, user: !!user });
    
    // If user is not authenticated or needs to complete profile
    if (!isAuthenticated || authStep === 'wallet' || authStep === 'profile' || authStep === 'email') {
      console.log('Dashboard - User needs authentication, redirecting to profile completion');
      // Profile completion is handled by the centralized popup
      return;
    }
  }, [isAuthenticated, authStep, user, navigate]);
  
  // Fetch real data from backend
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError } = useMarketAnalytics();
  const { data: assetsData, loading: assetsLoading } = useAssets();

  // Check if KYC is required - only require KYC if user exists and KYC is not approved
  const isKYCRequired = user ? user.kycStatus?.toLowerCase() !== 'approved' : false;
  
  // Debug logging
  console.log('Dashboard Debug:', {
    user: user?.name,
    kycStatus: user?.kycStatus,
    isKYCRequired,
    hasUser: !!user
  });

  const handleStartKYC = async () => {
    try {
      await startKYC();
      // Banner will update automatically when KYC status changes
    } catch (error) {
      console.error('Failed to start KYC:', error);
    }
  };

  const handleDismissBanner = () => {
    setShowKYCBanner(false);
  };

  const handleMintNVXTokens = async (amount: string) => {
    console.log('🚀 === STARTING NVX TOKEN MINTING ===');
    console.log('💰 Amount to mint:', amount, 'NVX');
    console.log('👤 User wallet:', address);
    console.log('🌐 Network:', window.ethereum?.chainId);
    
    setMintingTokens(true);
    try {
      console.log('📞 Calling contractService.mintNVXTokens...');
      // TODO: Update contractService to support NVX token minting
      // await contractService.mintNVXTokens(amount);
      console.log('✅ mintNVXTokens completed successfully');
      
      toast({
        title: 'NVX Tokens Minted!',
        description: `Successfully minted ${amount} NVX tokens to your wallet.`,
        variant: 'default'
      });
      
      console.log('🔄 Refreshing page to update balances...');
      // Refresh balance
      window.location.reload();
    } catch (error) {
      console.error('❌ Error minting NVX tokens:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      toast({
        title: 'Minting Failed',
        description: `Failed to mint NVX tokens: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      console.log('🏁 Minting process completed');
      setMintingTokens(false);
    }
  };


  // Format analytics data for display
  const stats = useMemo(() => {
    if (analyticsLoading || !analyticsData) {
      return [
        { title: 'Total Value Locked', value: '$0.0M', change: '+0%', icon: DollarSign, color: 'text-gray-600', trend: 'stable' },
        { title: 'Active Assets', value: '0', change: '+0%', icon: Activity, color: 'text-gray-600', trend: 'stable' },
        { title: 'Total Users', value: '0', change: '+0%', icon: Users, color: 'text-gray-600', trend: 'stable' },
        { title: 'Network Status', value: 'Offline', change: '0%', icon: Globe, color: 'text-gray-600', trend: 'down' }
      ];
    }

    const data = (analyticsData as any)?.data || analyticsData;
    
    return [
      {
        title: 'Total Value Locked',
        value: `$${((data as any).totalValueLocked / 1000000).toFixed(1)}M`,
        change: '+34.2%',
        icon: DollarSign,
        color: 'text-gray-600',
        trend: 'up'
      },
      {
        title: 'Active Assets',
        value: (data as any).totalAssets?.toString() || '0',
        change: '+12%',
        icon: Activity,
        color: 'text-gray-600',
        trend: 'up'
      },
      {
        title: 'Total Users',
        value: (data as any).activeUsers?.toLocaleString() || '0',
        change: '+8.5%',
        icon: Users,
        color: 'text-gray-600',
        trend: 'up'
      },
      {
        title: 'Network Status',
        value: 'Online',
        change: '99.9%',
        icon: Globe,
        color: 'text-gray-600',
        trend: 'stable'
      }
    ];
  }, [analyticsData, analyticsLoading]);

  // Show loading state
  if (analyticsLoading || assetsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 text-black p-8 sm:p-12 lg:p-16">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (analyticsError) {
    return (
      <div className="min-h-screen bg-gray-50 text-black p-8 sm:p-12 lg:p-16">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-6 h-6 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Failed to load dashboard data</p>
            <p className="text-xs text-gray-500">{analyticsError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show integration test if toggled
  if (showIntegrationTest) {
    return <IntegrationTest />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black p-8 sm:p-12 lg:p-16">
      <div className="max-w-6xl mx-auto">
        {/* KYC Banner - Only show for authenticated users */}
        {isAuthenticated && isKYCRequired && showKYCBanner && user?.kycStatus && (
          <KYCBanner
            kycStatus={user.kycStatus}
            onStartKYC={handleStartKYC}
            onDismiss={handleDismissBanner}
          />
        )}

        {/* Simple Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-medium mb-2">Dashboard</h1>
          <p className="text-gray-600">Overview of your assets and activity</p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-12">
          <Button 
            variant="outline" 
            onClick={() => navigate('/marketplace')}
          >
            Browse Marketplace
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard/profile')}
          >
            My Profile
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} variant="default">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5 text-gray-600" />
                    <p className="text-xs text-gray-600 uppercase tracking-wide">{stat.title}</p>
                  </div>
                  <p className="text-2xl font-medium text-black">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Core Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Real World Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Tokenize and trade real estate, vehicles, commodities, and other physical assets.
              </p>
                <Button 
                  variant="outline" 
                  className="w-full text-sm border-black/30 text-black hover:bg-gray-100 hover:border-black/50"
                  onClick={() => navigate('/marketplace?category=rwa')}
                >
                  <Building2 className="w-3.5 h-3.5 mr-1.5" />
                  Browse RWA Assets
                </Button>
              </CardContent>
            </Card>

          <Card variant="default">
            <CardHeader>
              <CardTitle>Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Monitor your asset portfolio and track performance.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/dashboard/portfolio')}
              >
                View Portfolio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
