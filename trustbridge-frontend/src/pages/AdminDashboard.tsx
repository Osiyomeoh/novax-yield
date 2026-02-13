import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, 
  Shield, 
  UserCheck, 
  Users, 
  BarChart3, 
  Settings, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Package,
  DollarSign,
  Building2,
  FileText,
  Eye
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { useWallet } from '../contexts/WalletContext';
import { AdminGuard } from '../contexts/AdminContext';
import { contractService } from '../services/contractService';
// Mantle service removed - using Etherlink/Novax contracts instead
import { ethers } from 'ethers';
import Card, { CardContent } from '../components/UI/Card';
import Button from '../components/UI/Button';
import AdminManagement from '../components/Admin/AdminManagement';

const AdminDashboard: React.FC = () => {
  const { 
    isAdmin, 
    isVerifier, 
    isSuperAdmin, 
    isPlatformAdmin, 
    isAmcAdmin, 
    adminRole, 
    adminRoles, 
    loading 
  } = useAdmin();
  const { address } = useWallet();
  const navigate = useNavigate();
  const hasAdminAccess = isAdmin || isAmcAdmin || isSuperAdmin || isPlatformAdmin;
  const [stats, setStats] = useState({
    totalVerifications: 0,
    activeVerifications: 0,
    totalAssets: 0,
    pendingAssets: 0
  });

  useEffect(() => {
    // Load admin statistics
    loadAdminStats();
  }, []);

  const loadAdminStats = async () => {
    try {
      // Mantle service removed - using Etherlink/Novax contracts instead
      // TODO: Replace with Etherlink/Novax asset fetching
      const blockchainAssets: any[] = [];
      
      const stats = {
        totalAssets: blockchainAssets.length,
        pendingAssets: blockchainAssets.filter((a: any) => {
          const status = typeof a.status === 'bigint' ? Number(a.status) : (typeof a.status === 'string' ? parseInt(a.status) : Number(a.status || 0));
          return status === 0; // PENDING_VERIFICATION
        }).length,
        totalVerifications: blockchainAssets.filter((a: any) => {
          const status = typeof a.status === 'bigint' ? Number(a.status) : (typeof a.status === 'string' ? parseInt(a.status) : Number(a.status || 0));
          return status >= 1 && status <= 6; // VERIFIED to ACTIVE
        }).length,
        activeVerifications: blockchainAssets.filter((a: any) => {
          const status = typeof a.status === 'bigint' ? Number(a.status) : (typeof a.status === 'string' ? parseInt(a.status) : Number(a.status || 0));
          return status === 6; // ACTIVE_AMC_MANAGED
        }).length
      };
      
      setStats(stats);
    } catch (error) {
      console.error('Failed to load admin stats:', error);
      // Set empty stats on error
      setStats({
        totalAssets: 0,
        pendingAssets: 0,
        totalVerifications: 0,
        activeVerifications: 0
      });
    }
  };

  // Organize admin actions by category and role
  const adminActions: Array<{
    id: string;
    title: string;
    description: string;
    icon: any;
    href: string;
    available: boolean;
    category: 'core' | 'amc' | 'system';
    priority: number;
  }> = [
    // Novax Yield - Receivables Management (AMC Admins)
    {
      id: 'receivables-management',
      title: 'Receivables Management',
      description: 'View and verify trade receivables for pool creation',
      icon: FileText,
      href: '/dashboard/admin/receivables',
      available: isAmcAdmin || isSuperAdmin || isPlatformAdmin,
      category: 'amc',
      priority: 1
    },
    
    // AMC Management (AMC Admins & Super Admins)
    {
      id: 'amc-pool-management',
      title: 'Pool Management',
      description: 'Create and manage investment pools',
      icon: BarChart3,
      href: '/dashboard/admin/amc-pools',
      available: isAmcAdmin || isSuperAdmin || isPlatformAdmin,
      category: 'amc',
      priority: 2
    },
    {
      id: 'dividend-management',
      title: 'Yield Distribution',
      description: 'Distribute yield to investors after payment received',
      icon: DollarSign,
      href: '/dashboard/admin/dividend-management',
      available: isAmcAdmin || isSuperAdmin || isPlatformAdmin,
      category: 'amc',
      priority: 3
    },
    
    // Removed RWA-related actions (not needed for Novax Yield receivables flow)
    // - Asset Management (RWA)
    // - Verification Dashboard (RWA)
    // - AMC Dashboard (RWA)
    
    // User & System Management (Super Admins & Platform Admins)
    {
      id: 'user-management',
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: Users,
      href: '/dashboard/admin/users',
      available: false,
      category: 'system',
      priority: 1
    },
    {
      id: 'system-settings',
      title: 'System Settings',
      description: 'Configure platform settings and parameters',
      icon: Settings,
      href: '/dashboard/settings',
      available: isSuperAdmin || isPlatformAdmin,
      category: 'system',
      priority: 2
    },
    {
      id: 'analytics',
      title: 'Admin Analytics',
      description: 'View platform analytics and reports',
      icon: TrendingUp,
      href: '/dashboard/analytics', // Use general analytics page for now
      available: isAdmin || isVerifier || isAmcAdmin,
      category: 'system',
      priority: 3
    }
  ];

  // Filter and sort admin actions by availability and priority
  const availableActions = adminActions
    .filter(action => action.available)
    .sort((a, b) => {
      // Sort by category first, then priority
      const categoryOrder = { core: 1, amc: 2, system: 3 };
      const categoryDiff = (categoryOrder[a.category as keyof typeof categoryOrder] || 99) - (categoryOrder[b.category as keyof typeof categoryOrder] || 99);
      if (categoryDiff !== 0) return categoryDiff;
      return a.priority - b.priority;
    });

  const statCards = [
    {
      title: 'Total Assets',
      value: stats.totalAssets,
      icon: Package
    },
    {
      title: 'Pending Assets',
      value: stats.pendingAssets,
      icon: Clock
    },
    {
      title: 'Total Verifications',
      value: stats.totalVerifications,
      icon: CheckCircle
    },
    {
      title: 'Active Verifications',
      value: stats.activeVerifications,
      icon: Activity
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard 
      requireVerifier={true}
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Admin privileges required to access this page.
            </p>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 text-black p-8 sm:p-12 lg:p-16">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
        {/* Header - Simple black and white style */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-medium text-black mb-2">Admin Dashboard</h1>
          <p className="text-gray-600 text-sm sm:text-base">Manage and monitor the TrustBridge platform</p>
          {hasAdminAccess && (
            <div className="flex items-center gap-2 mt-3">
              <span className="px-2 py-0.5 bg-black text-white text-xs font-medium rounded">
                ADMIN ACCESS
              </span>
              {(isAmcAdmin || isSuperAdmin || isPlatformAdmin) && (
                <span className="px-2 py-0.5 bg-gray-800 text-white text-xs font-medium rounded">
                  {isSuperAdmin ? 'SUPER ADMIN' : isAmcAdmin ? 'AMC ADMIN' : 'PLATFORM ADMIN'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Admin Status Banner - Simple black and white */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-medium text-black mb-1">
                  Admin Access Active
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  {isAdmin 
                    ? 'Full administrative access granted. You can manage all platform functions.'
                    : 'Verifier access granted. You can review and approve attestor applications.'
                  }
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-lg sm:text-xl font-medium text-black">
                {adminRoles.isAdmin ? 'ADMIN' : 'VERIFIER'}
              </div>
              <div className="text-xs text-gray-500">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} variant="default">
                <CardContent className="p-4 sm:p-6">
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

        {/* Admin Actions - Organized by Category */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-xl font-medium text-black mb-6">Admin Actions</h2>
          
          {/* Core Asset Management Section */}
          {(isAdmin || isVerifier || isAmcAdmin) && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-4">Core Asset Management</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {availableActions
                  .filter(action => action.category === 'core')
                  .map((action) => {
                    const Icon = action.icon;
                    return (
                      <Card 
                        key={action.id}
                        variant="default"
                        className="h-full transition-all duration-200 hover:shadow-md cursor-pointer border-gray-300"
                        onClick={() => navigate(action.href)}
                      >
                        <CardContent className="p-6">
                          <div className="text-center h-full flex flex-col">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-gray-600" />
                            </div>
                            <h3 className="text-base font-medium text-black mb-2 min-h-[2.5rem] flex items-center justify-center">
                              {action.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-2">
                              {action.description}
                            </p>
                            <Button 
                              variant="default"
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(action.href);
                              }}
                            >
                              Access
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* AMC Management Section */}
          {(isAmcAdmin || isSuperAdmin || isPlatformAdmin) && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-4">AMC Management</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {availableActions
                  .filter(action => action.category === 'amc')
                  .map((action) => {
                    const Icon = action.icon;
                    return (
                      <Card 
                        key={action.id}
                        variant="default"
                        className="h-full transition-all duration-200 hover:shadow-md cursor-pointer border-gray-300"
                        onClick={() => navigate(action.href)}
                      >
                        <CardContent className="p-6">
                          <div className="text-center h-full flex flex-col">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-gray-600" />
                            </div>
                            <h3 className="text-base font-medium text-black mb-2 min-h-[2.5rem] flex items-center justify-center">
                              {action.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-2">
                              {action.description}
                            </p>
                            <Button 
                              variant="default"
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(action.href);
                              }}
                            >
                              Access
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* System Management Section */}
          {(isAdmin || isSuperAdmin || isPlatformAdmin) && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-4">System Management</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {availableActions
                  .filter(action => action.category === 'system')
                  .map((action) => {
                    const Icon = action.icon;
                    return (
                      <Card 
                        key={action.id}
                        variant="default"
                        className="h-full transition-all duration-200 hover:shadow-md cursor-pointer border-gray-300"
                        onClick={() => navigate(action.href)}
                      >
                        <CardContent className="p-6">
                          <div className="text-center h-full flex flex-col">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-gray-600" />
                            </div>
                            <h3 className="text-base font-medium text-black mb-2 min-h-[2.5rem] flex items-center justify-center">
                              {action.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-2">
                              {action.description}
                            </p>
                            <Button 
                              variant="default"
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(action.href);
                              }}
                            >
                              Access
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions - Based on Role and Stats */}
        <div>
          <h2 className="text-xl font-medium text-black mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Asset Management Quick Action */}
            {(isAdmin || isVerifier || isAmcAdmin) && (
              <Card variant="default">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Package className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-black mb-1">
                        Manage Assets
                      </h3>
                      <p className="text-sm text-gray-600">
                        {stats.pendingAssets} pending {stats.pendingAssets === 1 ? 'asset' : 'assets'}
                      </p>
                    </div>
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => {
                        navigate('/dashboard/admin/assets');
                      }}
                    >
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AMC Dashboard Quick Action */}
            {(isAmcAdmin || isSuperAdmin || isPlatformAdmin) && (
              <Card variant="default">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Building2 className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-black mb-1">
                        AMC Dashboard
                      </h3>
                      <p className="text-sm text-gray-600">
                        Complete inspections & transfers
                      </p>
                    </div>
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => {
                        navigate('/dashboard/amc-dashboard');
                      }}
                    >
                      Access
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analytics Quick Action */}
            {(isAdmin || isVerifier || isAmcAdmin) && (
              <Card variant="default">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-black mb-1">
                        Platform Analytics
                      </h3>
                      <p className="text-sm text-gray-600">
                        View detailed reports
                      </p>
                    </div>
                  <Button 
                    variant="default"
                    size="sm"
                      onClick={() => {
                        navigate('/dashboard/analytics');
                      }}
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Settings - Only for Super/Platform Admins */}
            {(isSuperAdmin || isPlatformAdmin) && (
              <Card variant="default">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Settings className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-black mb-1">
                        System Settings
                      </h3>
                      <p className="text-sm text-gray-600">
                        Configure platform
                      </p>
                    </div>
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => {
                        navigate('/dashboard/settings');
                      }}
                    >
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Admin Management Section */}
        {isSuperAdmin && (
          <div className="mt-8">
            <AdminManagement />
          </div>
        )}
        </div>
      </div>
    </AdminGuard>
  );
};

export default AdminDashboard;
