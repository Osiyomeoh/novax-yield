import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import WalletConnect from '../components/Auth/WalletConnect';
import ProfileCompletion from '../components/Auth/ProfileCompletion';
import EmailVerification from '../components/Auth/EmailVerification';
import KYCVerification from '../components/Auth/KYCVerification';
import AnimatedBackground from '../components/UI/AnimatedBackground';

const Auth: React.FC = () => {
  const { authStep, isAuthenticated, user } = useAuth();
  const { isConnected, address } = useWallet();
  const navigate = useNavigate();

  console.log('Auth page render - authStep:', authStep, 'isAuthenticated:', isAuthenticated, 'user:', user);
  
  // Debug: Log when user changes
  React.useEffect(() => {
    console.log('Auth.tsx - User changed:', user);
  }, [user]);

  // Add timeout to prevent getting stuck on loading screen
  React.useEffect(() => {
    if (isConnected && address && !isAuthenticated && authStep === 'wallet') {
      const timer = setTimeout(() => {
        console.log('Loading timeout reached, forcing profile step');
        window.location.reload();
      }, 5000); // 5 second timeout

      return () => clearTimeout(timer);
    }
  }, [isConnected, address, isAuthenticated, authStep]);

  // If user is already authenticated, redirect to dashboard
  React.useEffect(() => {
    if (isAuthenticated && authStep === 'complete') {
      console.log('✅ User is verified, redirecting to dashboard');
      console.log('User verification status:', user?.emailVerificationStatus);
      navigate('/dashboard');
    }
  }, [isAuthenticated, authStep, user?.emailVerificationStatus, navigate]);

  // Debug: Log current location and prevent unwanted redirects
  console.log('Auth page - Current location:', window.location.pathname);

  // Show loading screen when wallet is connected but we're still checking authentication
  if (isConnected && address && !isAuthenticated && authStep === 'wallet') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900">
        <div className="text-center">
          <div className="relative mb-8">
            {/* Animated TrustBridge Logo */}
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-blue to-primary-blue-light rounded-2xl animate-pulse"></div>
              <div className="absolute inset-2 bg-midnight-900 rounded-xl flex items-center justify-center">
                <span className="text-3xl font-bold text-primary-blue">🌍</span>
              </div>
            </div>
            
            {/* Animated Loading Spinner */}
            <div className="relative">
              <div className="w-16 h-16 border-4 border-midnight-700 border-t-primary-blue rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-primary-blue-light rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
          </div>
          
          {/* Loading Text */}
          <h2 className="text-2xl font-bold text-off-white mb-4">
            TrustBridge
          </h2>
          <p className="text-lg text-midnight-300 mb-2">
            Universal Asset Protocol for Africa
          </p>
          <p className="text-midnight-400 mb-8">
            Checking your account status...
          </p>
          
          {/* Loading Steps */}
          <div className="space-y-3 text-left max-w-md mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-primary-blue rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-midnight-900" />
              </div>
              <span className="text-midnight-300">Wallet Connected</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-primary-blue rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-primary-blue rounded-full animate-pulse"></div>
              </div>
              <span className="text-midnight-300">Verifying Account</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-midnight-600 rounded-full"></div>
              <span className="text-midnight-500">Preparing Experience</span>
            </div>
          </div>
          
          {/* Manual Continue Button */}
          <div className="mt-8">
            <button
              onClick={() => {
                console.log('Manual continue clicked, forcing profile step');
                window.location.reload();
              }}
              className="px-6 py-3 bg-primary-blue text-midnight-900 rounded-lg hover:bg-primary-blue-light transition-colors font-medium"
            >
              Continue to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderAuthStep = () => {
    console.log('Auth.tsx - Current authStep:', authStep);
    console.log('Auth.tsx - isAuthenticated:', isAuthenticated);
    console.log('Auth.tsx - user:', user);
    
    switch (authStep) {
      case 'wallet':
        return <WalletConnect />;
      case 'profile':
        return <ProfileCompletion />;
      case 'email':
        return <EmailVerification />;
      case 'kyc':
        return <KYCVerification />;
      case 'complete':
        // User is fully authenticated, show loading while redirect happens
        console.log('User authentication complete, preparing redirect to dashboard');
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue mx-auto mb-4"></div>
            <p className="text-off-white">Redirecting to dashboard...</p>
          </div>
        );
      default:
        console.log('Auth.tsx - Unknown authStep, defaulting to wallet');
        return <WalletConnect />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-gray via-black to-dark-gray relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Page Header */}
      <div className="relative z-10 pt-8 pb-4">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold text-off-white mb-2">
              Novax Yield
            </h1>
            <p className="text-gray-300 dark:text-gray-300">
              Real-World Asset Tokenization Platform
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {renderAuthStep()}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-gray-300 dark:text-gray-300 text-sm"
          >
            <p>
              Secure • Transparent • Global DeFi
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;