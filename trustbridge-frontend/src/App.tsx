import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import { PrivyWalletProvider as WalletProvider } from './contexts/PrivyWalletContext';
import { AuthProvider } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { AdminStatusPersistent } from './components/Admin/AdminStatusPersistent';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { ProfileCompletionProvider } from './contexts/ProfileCompletionContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navigation from './components/Layout/Navigation';
import UniversalHeader from './components/Layout/UniversalHeader';
import { Toaster } from './components/UI/Toaster';
import AIChatbot from './components/AI/AIChatbot';
import { ButtonHoverFix } from './components/UI/ButtonHoverFix';
import Landing from './pages/Landing';
import AIStudio from './pages/AIStudio';
import Auth from './pages/Auth';
import Portfolio from './pages/Portfolio';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AssetVerification from './pages/AssetVerification';
import PublicAssetViewer from './pages/PublicAssetViewer';
import AssetTradingInterface from './pages/AssetTradingInterface';
import VerificationDashboard from './pages/VerificationDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminAssets from './pages/AdminAssets';
import AssetMarketplace from './pages/AssetMarketplace';
import Profile from './pages/Profile';
import ProfileSimple from './pages/ProfileSimple';
import ProfileCompletionModal from './components/Auth/ProfileCompletionModal';
import RWAAssetSubmission from './components/RWA/CreateRWAAsset';
import RWATradingInterface from './components/Trading/RWATradingInterface';
import { StakingVault } from './components/Staking/StakingVault';
import SecondaryMarkets from './pages/SecondaryMarkets';
import SPVManagement from './pages/SPVManagement';
import DAOGovernance from './pages/DAOGovernance';
import PoolDashboard from './components/Pools/PoolDashboard';
import PoolDetailPage from './components/Pools/PoolDetailPage';
import TradingInterface from './components/Trading/TradingInterface';
import GetTestTokens from './pages/GetTestTokens';
import DiditCallback from './pages/DiditCallback';
import Collections from './pages/Collections';
import Activity from './pages/Activity';
import CreateRWAAsset from './components/RWA/CreateRWAAsset';
import SecondaryTradingInterface from './components/Trading/SecondaryTradingInterface';
import KYCCallback from './pages/KYCCallback';
import AMCDashboard from './components/RWA/AMCDashboard';
import RWAAssetManagement from './components/RWA/RWAAssetManagement';
import AMCPoolManagement from './components/AMC/AMCPoolManagement';
import CreateNovaxPool from './components/AMC/CreateNovaxPool';
import NovaxYieldDistribution from './components/AMC/NovaxYieldDistribution';
import PoolMarketplace from './components/AMC/PoolMarketplace';
import PoolTradingInterface from './components/Trading/PoolTradingInterface';
import PoolTradingDashboard from './components/Trading/PoolTradingDashboard';
import PoolTokenPortfolio from './components/Trading/PoolTokenPortfolio';
import DividendManagement from './components/AMC/DividendManagement';
import AssetOwnerDashboard from './components/AssetOwner/AssetOwnerDashboard';
import GovernmentIdRequirements from './pages/help/GovernmentIdRequirements';
import ProofOfAddressRequirements from './pages/help/ProofOfAddressRequirements';
import ProfessionalLicenseRequirements from './pages/help/ProfessionalLicenseRequirements';
import ResumeRequirements from './pages/help/ResumeRequirements';
import Exchange from './pages/Exchange';
import Documentation from './pages/Documentation';
import CreateReceivable from './components/Receivables/CreateReceivable';
import ReceivablesDashboard from './components/Receivables/ReceivablesDashboard';
import AMCReceivablesDashboard from './components/Receivables/AMCReceivablesDashboard';
import RecordPayment from './components/Receivables/RecordPayment';
import AssetTypeSelector from './components/Assets/AssetTypeSelector';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Global auth guard component - now just renders children since header handles profile completion
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Wrapper component to extract poolId from route params
const PoolDetailPageWrapper = () => {
  const { poolId } = useParams<{ poolId: string }>();
  return <PoolDetailPage poolId={poolId || ''} />;
};

// Component that adjusts main content margin based on sidebar state
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isCollapsed } = useSidebar();
  const location = useLocation();
  
  // Don't show header for landing page since it has its own header
  const showHeader = location.pathname !== '/';
  
  return (
    <div className="min-h-screen bg-gray-50 text-black font-secondary relative overflow-hidden">
      <Navigation />
      {showHeader && <UniversalHeader />}
      <div className={`pt-16 sm:pt-20 lg:pt-0 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'lg:ml-16' : 'lg:ml-56 xl:ml-64'
      }`}>
        {children}
      </div>
      
      {/* AI Components - Available on all dashboard pages */}
      <AIChatbot />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
        <LanguageProvider>
        <WalletProvider>
          <AuthProvider>
            <AdminProvider>
              <AdminStatusPersistent />
              <ProfileCompletionProvider>
                <SidebarProvider>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true
                }}
              >
                <Routes>
                  {/* Landing Page - No Navigation */}
                  <Route path="/" element={<Landing />} />
                  
                  {/* Authentication Page - Redirect to Marketplace */}
                  <Route path="/auth" element={
                    <Navigate to="/marketplace" replace />
                  } />
                  
                  {/* Didit KYC Callback */}
                  <Route path="/api/auth/didit/callback" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <DiditCallback />
                    </div>
                  } />
                  
                  {/* Public Asset Viewer - No Authentication Required */}
                  <Route path="/asset/:assetId" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <PublicAssetViewer />
                    </div>
                  } />
                  
                  {/* Marketplace - No Authentication Required for Browsing */}
                  <Route path="/marketplace" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <AssetMarketplace />
                    </div>
                  } />
                  
                  {/* Collections - Browse NFT Collections */}
                  <Route path="/collections" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <Collections />
                    </div>
                  } />
                  
                  {/* Activity Feed - Recent Marketplace Activity */}
                  <Route path="/activity" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <Activity />
                    </div>
                  } />
                  
                  {/* Profile Page - Standalone */}
                  <Route path="/profile" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <AuthGuard>
                        <ProfileSimple />
                      </AuthGuard>
                    </div>
                  } />
                  
                  
                  {/* Help Pages - No Authentication Required */}
                  <Route path="/documentation" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <Documentation />
                    </div>
                  } />
                  <Route path="/help/government-id-requirements" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <GovernmentIdRequirements />
                    </div>
                  } />
                  <Route path="/help/proof-of-address-requirements" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <ProofOfAddressRequirements />
                    </div>
                  } />
                  <Route path="/help/professional-license-requirements" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <ProfessionalLicenseRequirements />
                    </div>
                  } />
                  <Route path="/help/resume-requirements" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <ResumeRequirements />
                    </div>
                  } />
                  
                  {/* Isolated Test Pages - No Wallet Context */}
                  {/* KYC Callback - Public Access (No Auth Required) */}
                  <Route path="/kyc-callback" element={
                    <div className="min-h-screen bg-gray-50 text-black">
                      <UniversalHeader />
                      <KYCCallback />
                    </div>
                  } />
                  
                  {/* Dashboard Pages - Public Access */}
                  <Route path="/dashboard/*" element={
                    <DashboardLayout>
                      <AuthGuard>
                        <Routes>
                        <Route path="/" element={<Profile />} />
                        <Route path="/marketplace" element={<AssetMarketplace />} />
                        <Route path="/portfolio" element={<Portfolio />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/settings" element={<Settings />} />
                        {/* Removed RWA routes - not needed for Novax Yield (receivables flow) */}
                        {/* <Route path="/verify-asset" element={<AssetVerification />} /> */}
                        {/* <Route path="/verification" element={<VerificationDashboard />} /> */}
                        {/* <Route path="/admin/assets" element={<AdminAssets />} /> */}
                        {/* <Route path="/amc-dashboard" element={<AMCDashboard />} /> */}
                        
                        {/* Core Admin Routes for Novax Yield */}
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="/admin/receivables" element={<AMCReceivablesDashboard />} />
                        <Route path="/admin/amc-pools" element={<AMCPoolManagement />} />
                        <Route path="/admin/create-pool" element={<CreateNovaxPool />} />
                        <Route path="/admin/pools/:poolId/payment" element={<RecordPayment />} />
                        <Route path="/admin/dividend-management" element={<DividendManagement />} />
                        <Route path="/admin/yield-distribution" element={<NovaxYieldDistribution />} />
                        <Route path="/pools" element={<PoolMarketplace />} />
                        <Route path="/pool/:poolId" element={<PoolDetailPageWrapper />} />
                        <Route path="/pool-dashboard" element={<PoolDashboard />} />
                        <Route path="/pool-trading" element={<PoolTradingInterface />} />
                        <Route path="/pool-trading-dashboard" element={<PoolTradingDashboard />} />
                        <Route path="/pool-token-portfolio" element={<PoolTokenPortfolio />} />
                        <Route path="/trading" element={<TradingInterface />} />
                        <Route path="/exchange" element={<Exchange />} />
                        <Route path="/get-test-tokens" element={<GetTestTokens />} />
                        <Route path="/spv" element={<SPVManagement />} />
                        <Route path="/governance" element={<DAOGovernance />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/create-asset" element={<AssetTypeSelector />} />
                        <Route path="/create-rwa-asset" element={<CreateRWAAsset />} />
                        <Route path="/create-receivable" element={<CreateReceivable />} />
                        <Route path="/receivables" element={<ReceivablesDashboard />} />
                        <Route path="/submit-rwa-asset" element={<RWAAssetSubmission />} />
                        <Route path="/ai-studio" element={<AIStudio />} />
                        <Route path="/rwa-trading" element={<RWATradingInterface />} />
                        <Route path="/secondary-trading" element={<SecondaryTradingInterface />} />
                        <Route path="/rwa-management" element={<RWAAssetManagement />} />
                        <Route path="/amc-dashboard" element={<AMCDashboard />} />
                        <Route path="/asset-owner" element={<AssetOwnerDashboard />} />
                        <Route path="/asset/:assetId/trade" element={<AssetTradingInterface />} />
                        <Route path="/secondary-markets" element={<SecondaryMarkets />} />
                        <Route path="/staking" element={<StakingVault />} />
                        </Routes>
                      </AuthGuard>
                    </DashboardLayout>
                  } />
                </Routes>
              </BrowserRouter>
              <ButtonHoverFix />
              <Toaster />
              <ProfileCompletionModal />
              </SidebarProvider>
              </ProfileCompletionProvider>
            </AdminProvider>
          </AuthProvider>
        </WalletProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;