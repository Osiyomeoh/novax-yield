import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Search, Wallet, LogOut, User, Menu, X, ChevronDown, UserPlus, Copy, Check } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { ConnectWalletButton } from '../UI/ConnectWalletButton';
import Button from '../UI/Button';
import Input from '../UI/Input';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProfileCompletion } from '../../contexts/ProfileCompletionContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAdmin } from '../../contexts/AdminContext';
import { useToast } from '../../hooks/useToast';
import { LanguageSwitcher } from '../UI/LanguageSwitcher';
import { getUseTranslation } from '../../utils/i18n-helpers';
import { Crown } from 'lucide-react';
import NVXTokenBalance from '../NVX/NVXTokenBalance';
import NovaxLogo from '../UI/NovaxLogo';

interface UniversalHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  className?: string;
}

const UniversalHeader: React.FC<UniversalHeaderProps> = ({
  searchQuery = '',
  onSearchChange,
  showSearch = true,
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, address, connectWallet, disconnectWallet } = useWallet();
  const { user, isAuthenticated, authStep, logout } = useAuth();
  const { user: privyUser } = usePrivy(); // Get Privy user data (includes Google login info)
  const { toast } = useToast();
  const { openProfileCompletion } = useProfileCompletion();
  const { toggleSidebar } = useSidebar();
  const { isAdmin, isAmcAdmin, isSuperAdmin, isPlatformAdmin } = useAdmin();
  const useTranslation = getUseTranslation();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = React.useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const [copiedAddress, setCopiedAddress] = React.useState(false);
  
  const hasAdminAccess = isAdmin || isAmcAdmin || isSuperAdmin || isPlatformAdmin;
  const adminRoleLabel = isSuperAdmin ? 'Super Admin' : isPlatformAdmin ? 'Platform Admin' : isAmcAdmin ? 'AMC Admin' : isAdmin ? 'Admin' : '';
  
  // Get user display info - prefer backend user data, fallback to Privy Google data
  const displayName = user?.name || 
                     privyUser?.google?.name || 
                     (privyUser?.google?.givenName && privyUser?.google?.familyName 
                       ? `${privyUser.google.givenName} ${privyUser.google.familyName}`.trim()
                       : privyUser?.google?.givenName) || 
                     'User';
  const displayEmail = user?.email || 
                      privyUser?.google?.email || 
                      privyUser?.email?.address || 
                      '';
  
  // Debug logging to verify Google data is available
  React.useEffect(() => {
    if (isConnected && privyUser) {
      console.log('UniversalHeader - User data sources:', {
        backendUser: {
          name: user?.name,
          email: user?.email,
          hasData: !!(user?.name && user?.email)
        },
        privyUser: {
          googleName: privyUser?.google?.name,
          googleGivenName: privyUser?.google?.givenName,
          googleFamilyName: privyUser?.google?.familyName,
          googleEmail: privyUser?.google?.email,
          emailAddress: privyUser?.email?.address,
          hasGoogleData: !!(privyUser?.google?.email || privyUser?.google?.name),
          fullGoogleData: privyUser?.google
        },
        displayName,
        displayEmail,
        source: user?.name ? 'backend' : (privyUser?.google?.email ? 'privy-google' : 'privy-email')
      });
    }
  }, [isConnected, privyUser, user, displayName, displayEmail]);

  const handleDisconnectWallet = async () => {
    try {
      // Disconnect wallet first (this should always work regardless of profile status)
      await disconnectWallet();
      
      // Try to logout from backend (non-blocking - don't fail if this errors)
      // Users without completed profiles may not have valid tokens, so this might fail
      try {
        await logout();
      } catch (logoutError) {
        console.warn('Logout failed (this is OK if user hasn\'t completed profile):', logoutError);
        // Still clear local auth state even if backend logout fails
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
      
      // Navigate to home page
      navigate('/');
      
      toast({
        title: 'Disconnected',
        description: 'Wallet disconnected successfully.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      // Even if disconnect fails, try to clear local state and navigate
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      navigate('/');
      toast({
        title: 'Disconnected',
        description: 'Wallet has been disconnected.',
        variant: 'default'
      });
    }
  };

  const handleCompleteProfile = () => {
    console.log('UniversalHeader - Opening profile completion popup');
    openProfileCompletion();
  };

  const isDashboardPage = location.pathname.startsWith('/dashboard');
  
  // Check if user needs to complete profile
  // If user has both email and name (e.g., from Google login), they don't need to complete profile
  // Only show "Complete Profile" if user is connected but missing email or name
  const hasProfileData = !!(user?.email && user?.name);
  const needsProfileCompletion = isConnected && !hasProfileData && (!isAuthenticated || authStep === 'profile');
  
  // Debug logging
  if (isConnected) {
    console.log('UniversalHeader - Profile completion check:', {
      hasProfileData,
      isAuthenticated,
      authStep,
      needsProfileCompletion,
      userEmail: user?.email,
      userName: user?.name,
      hasUser: !!user
    });
  }

  return (
    <div className={`sticky top-0 z-50 bg-white backdrop-blur-md border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Left Side - Sidebar Toggle (Desktop) + Logo */}
          <div className="flex items-center space-x-4">
            {/* Desktop Sidebar Toggle Button */}
            {isDashboardPage && (
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Toggle sidebar"
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>
            )}
            {/* Logo - Novax Yield */}
            <NovaxLogo size="lg" showText={true} />
          </div>

          {/* Search Bar - Only show on Discovery page */}
          {showSearch && isDashboardPage && location.pathname === '/dashboard/marketplace' && (
            <div className="hidden sm:flex flex-1 max-w-md mx-4 lg:mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder={t('header.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="pl-10 bg-white border-gray-300 text-black placeholder-gray-400 focus:border-black focus:ring-black/20 text-sm"
                />
              </div>
            </div>
          )}

          {/* Right Side - Universal Wallet Connection */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <LanguageSwitcher className="hidden sm:block" />
            {/* NVX Token Balance */}
            {isConnected && (
              <div className="hidden sm:flex relative z-10">
                <NVXTokenBalance 
                  className=""
                  showPurchaseButton={true}
                />
              </div>
            )}
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-2 lg:space-x-3 relative z-0">
              {(() => {
                if (!isConnected) {
                  return <ConnectWalletButton />;
                }
                
                // User is connected - show dropdown with address, name, and email
                const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';
                
                return (
                  <div className="relative">
                    {/* Account Dropdown Button */}
                    <button
                      onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                      className={`flex items-center space-x-2 lg:space-x-3 hover:opacity-80 transition-opacity rounded-lg px-2 lg:px-3 py-1.5 lg:py-2 border ${
                        hasAdminAccess
                          ? 'bg-gradient-to-r from-purple-600 to-purple-700 border-purple-500 shadow-lg'
                          : 'bg-black border-black hover:border-black'
                      }`}
                    >
                      {hasAdminAccess && <Crown className="w-4 h-4 text-white" />}
                      <User className={`w-4 h-4 ${hasAdminAccess ? 'text-white' : 'text-white'}`} />
                      <span className="text-xs lg:text-sm text-white font-medium">
                        {displayAddress}
                      </span>
                      {hasAdminAccess && (
                        <span className="px-1.5 py-0.5 bg-white/20 text-white text-xs font-bold rounded">
                          ADMIN
                        </span>
                      )}
                      <ChevronDown className="w-4 h-4 text-white" />
                    </button>

                    {/* Profile Dropdown Menu */}
                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {/* User Info Header */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200">
                          <div className="flex items-start space-x-3">
                            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                              <User className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {displayName}
                                </p>
                                {hasAdminAccess && (
                                  <span className="px-2 py-0.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                    <Crown className="w-3 h-3" />
                                    {adminRoleLabel}
                                  </span>
                                )}
                              </div>
                              {displayEmail && (
                                <p className="text-xs text-gray-600 truncate mb-2">
                                  {displayEmail}
                                </p>
                              )}
                              {address && (
                                <div className="flex items-center space-x-2 mt-2">
                                  <p className="text-xs text-gray-500 font-mono truncate flex-1">
                                    {address.slice(0, 6)}...{address.slice(-4)}
                                  </p>
                                  <button
                                    onClick={async () => {
                                      if (address) {
                                        await navigator.clipboard.writeText(address);
                                        setCopiedAddress(true);
                                        setTimeout(() => setCopiedAddress(false), 2000);
                                      }
                                    }}
                                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors flex-shrink-0"
                                    title="Copy full address"
                                  >
                                    {copiedAddress ? (
                                      <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="py-1.5">
                          {/* Complete Profile Button - Show if profile is incomplete */}
                          {needsProfileCompletion && (
                            <button
                              onClick={() => {
                                handleCompleteProfile();
                                setIsProfileDropdownOpen(false);
                              }}
                              className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors mx-1.5 rounded-lg"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span>Complete Profile</span>
                            </button>
                          )}
                          
                          {/* Profile Link */}
                          <button
                            onClick={() => {
                              navigate('/dashboard/profile');
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors mx-1.5 rounded-lg"
                          >
                            <User className="w-4 h-4" />
                            <span>View Profile</span>
                          </button>
                          
                          {/* Admin Dashboard Link - Show if user has admin access */}
                          {hasAdminAccess && (
                            <>
                              <div className="my-1.5 border-t border-gray-100"></div>
                              <button
                                onClick={() => {
                                  navigate('/dashboard/admin');
                                  setIsProfileDropdownOpen(false);
                                }}
                                className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition-all mx-1.5 rounded-lg shadow-md"
                              >
                                <Crown className="w-4 h-4" />
                                <span>Admin Dashboard</span>
                                <span className="ml-auto px-1.5 py-0.5 bg-white/20 text-xs font-bold rounded">
                                  {adminRoleLabel}
                                </span>
                              </button>
                            </>
                          )}
                          
                          {/* Divider */}
                          <div className="my-1.5 border-t border-gray-100"></div>
                          
                          {/* Disconnect Option */}
                          <button
                            onClick={() => {
                              handleDisconnectWallet();
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors mx-1.5 rounded-lg"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Disconnect Wallet</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Backdrop to close dropdown */}
                    {isProfileDropdownOpen && (
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (location.pathname.startsWith('/dashboard')) {
                    const event = new CustomEvent('toggleMobileSidebar');
                    window.dispatchEvent(event);
                  } else {
                    setIsMobileMenuOpen(!isMobileMenuOpen);
                  }
                }}
                className="p-2"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-3">
              {isConnected ? (
                <>
                  {/* User Info Section */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {displayName}
                        </p>
                        {displayEmail && (
                          <p className="text-xs text-gray-500 truncate">
                            {displayEmail}
                          </p>
                        )}
                      </div>
                    </div>
                    {address && (
                      <p className="text-xs text-gray-500 font-mono mt-2 truncate">
                        {address}
                      </p>
                    )}
                  </div>
                  
                  {/* Complete Profile Button - Show if profile is incomplete */}
                  {needsProfileCompletion && (
                    <Button
                      onClick={() => {
                        handleCompleteProfile();
                        setIsMobileMenuOpen(false);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2 w-full justify-start text-orange-600 border-orange-400 hover:bg-orange-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Complete Profile</span>
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => {
                      navigate('/dashboard/profile');
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 w-full justify-start"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </Button>
                  <Button
                    onClick={() => {
                      handleDisconnectWallet();
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 w-full justify-start text-red-600 border-red-400 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect</span>
                  </Button>
                </>
              ) : (
                <ConnectWalletButton />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalHeader;
