import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from './WalletContext';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { apiService } from '../services/api';
import { useToast } from '../hooks/useToast';

export interface User {
  _id: string;
  walletAddress: string;
  email?: string;
  name?: string;
  phone?: string;
  country?: string;
  profileImage?: string;
  role: string;
  kycStatus: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'not_started';
  kycInquiryId?: string;
  emailVerificationStatus: 'pending' | 'verified' | 'not_verified';
  reputation: number;
  stakingBalance: number;
  totalInvested: number;
  investmentCount: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  authStep: 'wallet' | 'profile' | 'email' | 'kyc' | 'complete';
}

export interface AuthContextType extends AuthState {
  connectWallet: () => Promise<void>;
  completeProfile: (profileData: ProfileData) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  startKYC: () => Promise<void>;
  checkKYCStatus: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAuthState: React.Dispatch<React.SetStateAction<AuthState>>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

export interface ProfileData {
  email: string;
  name: string;
  phone?: string;
  country?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { 
    isConnected, 
    accountId,
    address, 
    signMessage, 
    connectWallet: connectWalletContext,
    loading: walletLoading,
    error: walletError 
  } = useWallet();
  
  // Get Privy user data to access Google login info
  const { user: privyUser, authenticated: privyAuthenticated } = usePrivy();
  // Get wallets to check if it's an embedded wallet (social login) vs external wallet (MetaMask)
  const { wallets } = useWallets();
  const { toast } = useToast();

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    authStep: 'wallet',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConnectedAddress, setLastConnectedAddress] = useState<string | null>(null);

  // Check for existing authentication on mount only if wallet is connected
  useEffect(() => {
    if (isConnected && address) {
      checkExistingAuth();
    }
  }, []);

  // Handle wallet connection/disconnection
  useEffect(() => {
    // Only reset auth if wallet is explicitly disconnected (not just address being null initially)
    if (!isConnected) {
      console.log('Wallet disconnected, resetting authentication...');
      setAuthState({
        isAuthenticated: false,
        user: null,
        authStep: 'wallet',
        accessToken: null,
        refreshToken: null,
      });
      // Clear tokens when wallet is actually disconnected
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setLastConnectedAddress(null);
      return;
    }

    // Check if wallet address has changed (different user connected)
    if (isConnected && address && lastConnectedAddress && address !== lastConnectedAddress) {
      console.log('Different wallet address detected, clearing previous session...');
      console.log('Previous address:', lastConnectedAddress);
      console.log('New address:', address);
      
      // Clear previous user's session
      setAuthState({
        isAuthenticated: false,
        user: null,
        authStep: 'wallet',
        accessToken: null,
        refreshToken: null,
      });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // Update the last connected address
      setLastConnectedAddress(address);
      
      // Check auth for the new wallet
      if (!isCheckingAuth) {
        checkExistingAuth();
      }
      return;
    }

    // Wallet is connected - check authentication
    if (isConnected && address) {
      console.log('Wallet connected with address, checking authentication status...');
      
      // Update last connected address if this is a new connection
      if (!lastConnectedAddress) {
        setLastConnectedAddress(address);
      }
      
      if (!isCheckingAuth) {
        checkExistingAuth();
      }
    } else if (isConnected && !address) {
      // Wallet is connected but address not yet available - wait a bit
      console.log('Wallet connected but address not yet available, waiting...');
      const timer = setTimeout(() => {
        if (isConnected && !address) {
          console.log('Address still not available after delay, checking auth anyway...');
          if (!isCheckingAuth) {
            checkExistingAuth();
          }
        }
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, lastConnectedAddress]);

  // Debug auth state changes
  useEffect(() => {
    console.log('AuthContext - Auth state changed:', {
      isAuthenticated: authState.isAuthenticated,
      authStep: authState.authStep,
      user: authState.user ? `${authState.user.email} (${authState.user.name})` : null,
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      isConnected
    });
  }, [authState, address, isConnected]);

  // Add timeout to prevent getting stuck on wallet step
  useEffect(() => {
    if (authState.authStep === 'wallet' && !isConnected) {
      const timeoutId = setTimeout(() => {
        console.log('Wallet connection timeout - user may need to manually connect');
        // Don't auto-advance, but log for debugging
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeoutId);
    }
  }, [authState.authStep, isConnected]);

  // Auto-complete profile for Google users
  const autoCompleteProfileWithGoogle = async (
    email: string,
    name: string,
    walletAddress: string,
    signMessageFn: (message: string) => Promise<string>
  ) => {
    if (!email || !name || !walletAddress || !signMessageFn) {
      throw new Error('Missing required data for auto-completing profile');
    }

    console.log('AuthContext - Auto-completing profile with Google data:', { email, name });
    setIsLoading(true);
    setError(null);

    try {
      // Create authentication message for profile completion
      const timestamp = Date.now();
      const message = `TrustBridge Profile Completion\nAddress: ${walletAddress}\nEmail: ${email}\nTimestamp: ${timestamp}`;
      
      console.log('AuthContext - Signing message for profile completion...');
      const signature = await signMessageFn(message);
      console.log('AuthContext - Message signed successfully');

      // Send to backend (apiService.completeProfile expects { walletAddress, signature, message, timestamp, email, name, phone, country, isGoogleVerified })
      const requestData = {
        walletAddress,
        signature,
        message,
        timestamp,
        email,
        name,
        phone: '', // Optional
        country: '', // Optional
        isGoogleVerified: true, // Google already verified the email, skip verification
      };

      console.log('AuthContext - Sending profile completion to backend...');
      console.log('AuthContext - Request data:', {
        walletAddress: requestData.walletAddress,
        email: requestData.email,
        name: requestData.name,
        hasSignature: !!requestData.signature,
        signatureLength: requestData.signature?.length,
        hasMessage: !!requestData.message,
        messageLength: requestData.message?.length,
        timestamp: requestData.timestamp,
        isGoogleVerified: requestData.isGoogleVerified
      });
      
      let response;
      try {
        response = await apiService.completeProfile(requestData);
        console.log('AuthContext - Profile completion response:', response);
      } catch (error: any) {
        // Log detailed error information to help debug
        const errorDetails = {
          message: error?.message,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data,
          errorMessage: error?.response?.data?.message || error?.response?.data?.error || error?.message,
          validationErrors: error?.response?.data?.message || error?.response?.data?.errors,
          fullError: error
        };
        console.error('AuthContext - Profile completion error details:', errorDetails);
        
        // Extract the actual error message from the backend
        const errorMessage = error?.response?.data?.message || 
                           error?.response?.data?.error || 
                           (Array.isArray(error?.response?.data?.message) 
                             ? error.response.data.message.join(', ') 
                             : error?.message) ||
                           'Profile completion failed';
        
        // Re-throw with the actual backend error message
        throw new Error(errorMessage);
      }

      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        
        // Normalize user data
        const user: User = {
          ...userData,
          emailVerificationStatus: userData.emailVerificationStatus === 'VERIFIED' ? 'verified' : 
                                 userData.emailVerificationStatus === 'PENDING' ? 'pending' : 'not_verified',
          kycStatus: userData.kycStatus === 'pending' ? 'pending' :
                    userData.kycStatus === 'in_progress' ? 'in_progress' :
                    userData.kycStatus === 'approved' ? 'approved' :
                    userData.kycStatus === 'rejected' ? 'rejected' : 'not_started'
        };

        // Store tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        // Determine auth step
        // For Google users, email is already verified, so set to 'complete'
        // Otherwise, set to 'email' if email needs verification
        const authStep: 'wallet' | 'profile' | 'email' | 'kyc' | 'complete' = 
          user.emailVerificationStatus === 'verified' ? 'complete' : 
          (user.email && user.name) ? 'email' : 'profile';

        setAuthState({
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          authStep,
        });

        console.log('AuthContext - Profile auto-completed successfully:', {
          email: user.email,
          name: user.name,
          authStep,
          fullUser: user,
          userDataFromBackend: userData
        });
        
        // Verify that email and name are actually set
        if (!user.email || !user.name) {
          console.error('AuthContext - WARNING: Profile auto-completed but user missing email or name!', {
            hasEmail: !!user.email,
            hasName: !!user.name,
            userDataFromBackend: userData,
            userDataKeys: userData ? Object.keys(userData) : []
          });
          // If backend didn't return email/name, use the values we sent
          if (!user.email && email) {
            console.log('AuthContext - Using email from request since backend didn\'t return it');
            user.email = email;
          }
          if (!user.name && name) {
            console.log('AuthContext - Using name from request since backend didn\'t return it');
            user.name = name;
          }
        }
        
        // Update state again with corrected user data if needed
        if (user.email && user.name) {
          setAuthState(prev => ({
            ...prev,
            user: {
              ...prev.user,
              ...user,
              email: user.email || prev.user?.email,
              name: user.name || prev.user?.name
            },
            isAuthenticated: true,
            accessToken,
            refreshToken,
            authStep: user.emailVerificationStatus === 'verified' ? 'complete' : 'email'
          }));
        }
      } else {
        throw new Error(response.message || 'Profile completion failed');
      }
    } catch (error) {
      console.error('AuthContext - Auto-complete profile error:', error);
      
      // Handle specific error: Email already registered to another account
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Email already registered to another account')) {
        console.warn('AuthContext - Google email already registered to another account. User must use different email or login method.');
        
        // Show toast notification to user explaining the issue
        toast({
          title: 'Email Already Registered',
          description: 'This email is already registered to another account. Please complete your profile with a different email address, or use a different login method (wallet or email/password).',
          variant: 'destructive',
          duration: 8000 // Show for 8 seconds so user can read it
        });
        
        // Don't set email/name in user state - keep user in profile completion flow
        // This allows them to enter a different email address
        // The "Complete Profile" prompt will remain visible
        console.log('AuthContext - Keeping user in profile completion flow to enter different email');
        
        // Don't throw - we've handled it gracefully, but user needs to complete profile with different email
        return;
      }
      
      // For other errors, throw to let caller handle
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Authenticate with backend using Privy wallet signature
  const authenticateWithBackend = async () => {
    if (!isConnected || !address) {
      console.log('AuthContext - Cannot authenticate: wallet not connected');
      return;
    }
    
    // For embedded wallets, wait for signMessage to be available (signer might still be initializing)
    if (!signMessage) {
      console.log('AuthContext - Signer not ready yet, waiting for embedded wallet to initialize...');
      let attempts = 0;
      const maxWaitAttempts = 20; // 10 seconds
      const waitDelay = 500;
      
      while (!signMessage && attempts < maxWaitAttempts) {
        await new Promise(resolve => setTimeout(resolve, waitDelay));
        attempts++;
        if (signMessage) {
          console.log(`AuthContext - Signer now available after ${attempts * waitDelay}ms`);
          break;
        }
      }
      
      if (!signMessage) {
        console.warn('AuthContext - Signer not available after waiting, skipping authentication for now');
        return;
      }
    }

    // Check if we already have a valid token
    const existingToken = localStorage.getItem('accessToken');
    if (existingToken) {
      console.log('AuthContext - Already have token, skipping backend authentication');
      return;
    }

    // IMPORTANT: DO NOT switch networks during authentication
    // Network switching should ONLY happen when making transactions (write operations)
    // Calling window.ethereum.request() here triggers MetaMask prompts on every refresh
    // 
    // For embedded wallets (Privy): They use Privy's RPC, no network switching needed
    // For external wallets (MetaMask): Network will be switched automatically when needed (in novaxContractService)
    //
    // REMOVED: Network switching code that was causing MetaMask prompts on every refresh
    console.log('⏭️ AuthContext - Skipping network check during authentication (will switch when needed for transactions)');

    console.log('AuthContext - Authenticating with backend using Privy wallet...');
    setIsLoading(true);
    setError(null);

    try {
      // Create authentication message
      const timestamp = Date.now();
      const message = `TrustBridge Authentication\nAddress: ${address}\nTimestamp: ${timestamp}`;
      
      console.log('AuthContext - Signing message for backend authentication...');
      const signature = await signMessage(message);
      console.log('AuthContext - Message signed successfully');

      // Send to backend
      const walletAuthData = {
        address,
        signature,
        message,
        timestamp,
      };

      console.log('AuthContext - Sending wallet authentication to backend...');
      const response = await apiService.loginWithWallet(walletAuthData);
      console.log('AuthContext - Backend authentication response:', response);

      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        
        // Normalize user data
        const user: User = {
          ...userData,
          emailVerificationStatus: userData.emailVerificationStatus === 'VERIFIED' ? 'verified' : 
                                 userData.emailVerificationStatus === 'PENDING' ? 'pending' : 'not_verified',
          kycStatus: userData.kycStatus === 'pending' ? 'pending' :
                    userData.kycStatus === 'in_progress' ? 'in_progress' :
                    userData.kycStatus === 'approved' ? 'approved' :
                    userData.kycStatus === 'rejected' ? 'rejected' : 'not_started'
        };

        // Store tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        // Store tokens only - don't set auth state here
        // Let checkExistingAuth continue and call getProfile to properly determine auth step
        // This ensures consistent logic and prevents state conflicts
        console.log('AuthContext - Backend authentication successful, tokens stored. Will continue with getProfile to determine auth step:', {
          hasEmail: !!user.email,
          hasName: !!user.name,
          emailVerificationStatus: user.emailVerificationStatus,
          userEmail: user.email,
          userName: user.name
        });
        
        // Don't set auth state here - let checkExistingAuth continue with getProfile
        // The getProfile path will properly determine authStep based on user data
      } else {
        throw new Error(response.message || 'Backend authentication failed');
      }
    } catch (error) {
      console.error('AuthContext - Backend authentication error:', error);
      // Don't throw - let checkExistingAuth handle the flow
      // This allows users who don't have backend accounts to still use the app
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingAuth = async () => {
    // Prevent multiple simultaneous calls
    if (isCheckingAuth) {
      console.log('AuthContext - checkExistingAuth already in progress, skipping');
      return;
    }
    
    setIsCheckingAuth(true);
    console.log('AuthContext - checkExistingAuth called', {
      isConnected,
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      hasToken: !!localStorage.getItem('accessToken')
    });
    
    try {
      // Don't check auth if wallet is not connected
      if (!isConnected || !address) {
        console.log('AuthContext - No wallet connection, skipping auth check');
        setAuthState({
          isAuthenticated: false,
          user: null,
          authStep: 'wallet',
          accessToken: null,
          refreshToken: null,
        });
        return;
      }

      // Try to authenticate with backend first (if no token exists)
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('AuthContext - No existing token, attempting backend authentication...');
        await authenticateWithBackend();
        // After backend auth attempt, check if we now have a token
        const newToken = localStorage.getItem('accessToken');
        if (newToken) {
          // Backend auth succeeded, continue with token validation via getProfile
          console.log('AuthContext - Backend authentication succeeded, validating token via getProfile...');
        } else {
          // Backend auth failed or user doesn't exist, continue with existing flow (checkWalletUser)
          console.log('AuthContext - Backend authentication did not create token, checking if user exists with wallet...');
        }
      }
      
      const finalToken = localStorage.getItem('accessToken');
      console.log('AuthContext - Found token:', !!finalToken, 'Length:', finalToken?.length);
      
      if (finalToken) {
        try {
          console.log('AuthContext - Calling getProfile API...');
          const response = await apiService.getProfile();
          console.log('AuthContext - getProfile response:', response);
          
          if (response.success) {
            const userData = response.data;
            
            // Check if the user from token matches the currently connected wallet
            if (userData.walletAddress && address && userData.walletAddress.toLowerCase() !== address.toLowerCase()) {
              console.log('Token user wallet mismatch - clearing session');
              console.log('Token wallet:', userData.walletAddress);
              console.log('Connected wallet:', address);
              
              // Clear tokens and reset auth state
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setAuthState({
                isAuthenticated: false,
                user: null,
                authStep: 'wallet',
                accessToken: null,
                refreshToken: null,
              });
              
              // Check if new wallet has an existing account
              if (!isCheckingAuth) {
                checkExistingAuth();
              }
              return;
            }

            // Normalize user data to match frontend types
            const user: User = {
              ...userData,
              emailVerificationStatus: userData.emailVerificationStatus === 'VERIFIED' ? 'verified' : 
                                     userData.emailVerificationStatus === 'PENDING' ? 'pending' : 'not_verified',
              kycStatus: userData.kycStatus === 'pending' ? 'pending' :
                        userData.kycStatus === 'in_progress' ? 'in_progress' :
                        userData.kycStatus === 'approved' ? 'approved' :
                        userData.kycStatus === 'rejected' ? 'rejected' : 'not_started'
            };
            
            // Log the full user data to debug missing email/name
            console.log('AuthContext - getProfile returned user data:', {
              hasEmail: !!user.email,
              hasName: !!user.name,
              email: user.email,
              name: user.name,
              fullUserData: userData,
              normalizedUser: user,
              userDataKeys: Object.keys(userData || {})
            });
            
            // Check if user logged in with Google and needs profile completion
            // Only auto-complete for embedded wallets (social login), NOT for external wallets (MetaMask)
            const isEmbeddedWallet = wallets[0]?.walletClientType === 'privy' || 
                                    wallets[0]?.clientType === 'privy' ||
                                    wallets[0]?.connectorType === 'embedded' ||
                                    !wallets[0]?.connectorType; // Embedded wallets don't have connectorType
            
            const googleEmail = privyUser?.google?.email;
            const googleName = privyUser?.google?.name || 
                              (privyUser?.google?.givenName && privyUser?.google?.familyName 
                                ? `${privyUser.google.givenName} ${privyUser.google.familyName}`.trim()
                                : privyUser?.google?.givenName || '');
            // Only auto-complete if: Google login detected AND embedded wallet (social login) AND missing email/name
            const isGoogleLogin = !!googleEmail && !!googleName && privyAuthenticated;
            const needsGoogleAutoComplete = isGoogleLogin && isEmbeddedWallet && (!user.email || !user.name);
            
            console.log('AuthContext - getProfile: Checking for Google login:', {
              hasPrivyUser: !!privyUser,
              privyAuthenticated,
              googleEmail,
              googleName,
              isGoogleLogin,
              needsGoogleAutoComplete,
              userEmail: user.email,
              userName: user.name,
              privyUserGoogle: privyUser?.google
            });
            
            if (needsGoogleAutoComplete) {
              console.log('AuthContext - getProfile: User missing email/name, but Google login detected. Attempting auto-complete...', {
                googleEmail,
                googleName,
                existingEmail: user.email,
                existingName: user.name,
                hasAddress: !!address,
                hasSignMessage: !!signMessage
              });
              
              // Try to auto-complete profile with Google data
              if (address && signMessage) {
                // Auto-complete in background (don't block UI)
                (async () => {
                  try {
                    console.log('AuthContext - Attempting auto-complete profile with Google data (from getProfile path)...');
                    await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                    console.log('AuthContext - Profile auto-completed from getProfile path, user state updated');
                  } catch (error) {
                    console.error('AuthContext - Auto-complete profile failed from getProfile path (will retry):', error);
                    // Retry after a delay
                    setTimeout(async () => {
                      if (address && signMessage && googleEmail && googleName) {
                        try {
                          console.log('AuthContext - Retrying auto-complete profile from getProfile path...');
                          await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                          console.log('AuthContext - Profile auto-completed on retry from getProfile path');
                        } catch (retryError) {
                          console.error('AuthContext - Retry auto-complete failed from getProfile path:', retryError);
                        }
                      }
                    }, 10000); // Retry after 10 seconds
                  }
                })();
                
                // Update user state with Google data temporarily (until auto-complete succeeds)
                user.email = googleEmail;
                user.name = googleName;
              }
            }
            
            // If user is missing email/name but we have them in the current state, preserve them
            // This can happen if the backend hasn't fully updated yet or getProfile doesn't return all fields
            if ((!user.email || !user.name) && authState.user) {
              console.log('AuthContext - getProfile missing email/name, preserving from current state:', {
                currentEmail: authState.user.email,
                currentName: authState.user.name,
                backendEmail: user.email,
                backendName: user.name
              });
              user.email = user.email || authState.user.email || '';
              user.name = user.name || authState.user.name || '';
            }
            
            // Determine auth step based on wallet connection and user status
            let authStep: 'wallet' | 'profile' | 'email' | 'kyc' | 'complete' = 'wallet';
            
            console.log('Checking existing auth - wallet and user status:', {
              isConnected,
              accountId,
              email: user.email,
              name: user.name,
              emailVerificationStatus: user.emailVerificationStatus,
              kycStatus: user.kycStatus,
              hasEmail: !!user.email,
              hasName: !!user.name,
              isVerified: user.emailVerificationStatus === 'verified',
              isGoogleLogin,
              needsGoogleAutoComplete
            });
            
            // First check if wallet is connected
            if (!isConnected || !accountId) {
              authStep = 'wallet';
              console.log('🔌 Wallet not connected, staying on wallet step');
            } else if (user.emailVerificationStatus === 'verified') {
              authStep = 'complete'; // User can access dashboard after email verification
              console.log('✅ User email verified, going to complete step');
            } else if (user.email && user.name) {
              // User has completed profile but not verified email
              authStep = 'email';
              console.log('⚠️ User profile complete, going to email verification step');
            } else {
              // User hasn't completed profile yet
              authStep = 'profile';
              console.log('❌ User profile incomplete, going to profile step');
              console.log('Missing fields:', {
                email: user.email ? '✅' : '❌',
                name: user.name ? '✅' : '❌',
                verification: user.emailVerificationStatus
              });
            }

            console.log('AuthContext - Setting auth state:', { isAuthenticated: true, authStep, kycStatus: user.kycStatus, user: user });
            setAuthState({
              isAuthenticated: true,
              user,
              accessToken: finalToken,
              refreshToken: localStorage.getItem('refreshToken'),
              authStep,
            });
            console.log('AuthContext - Auth state set with user:', user);
          } else {
            console.log('AuthContext - getProfile failed:', response);
          }
        } catch (error) {
          console.log('AuthContext - getProfile error:', error);
          // Token is invalid, clear it
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        // Reset to wallet step if no valid auth
        setAuthState(prev => ({ ...prev, authStep: 'wallet', accessToken: null, refreshToken: null }));
        }
      } else {
        console.log('AuthContext - No token found, checking if user exists with wallet address...');
        // No token, but check if user exists with current wallet address
        if (address) {
          try {
            console.log('AuthContext - Checking for existing user with wallet address:', address);
            console.log('AuthContext - About to call apiService.checkWalletUser...');
            
            let response;
            try {
              response = await apiService.checkWalletUser(address);
              console.log('AuthContext - checkWalletUser response received:', response);
            } catch (error) {
              console.error('AuthContext - checkWalletUser failed:', error);
              console.error('AuthContext - checkWalletUser error details:', error.response?.data);
              // If the API call fails, assume no user exists and continue with new user flow
              response = { success: false, message: 'Error checking wallet user' };
            }
            
            if (response.success && response.data) {
              const userData = response.data;
              console.log('AuthContext - Raw userData from backend:', userData);
              // Normalize user data to match frontend types
              const user: User = {
                ...userData,
                emailVerificationStatus: userData.emailVerificationStatus === 'VERIFIED' ? 'verified' : 
                                       userData.emailVerificationStatus === 'PENDING' ? 'pending' : 'not_verified',
                kycStatus: userData.kycStatus === 'pending' ? 'pending' :
                          userData.kycStatus === 'in_progress' ? 'in_progress' :
                          userData.kycStatus === 'approved' ? 'approved' :
                          userData.kycStatus === 'rejected' ? 'rejected' : 'not_started'
              };
              
              console.log('AuthContext - Normalized user data:', {
                originalEmailStatus: userData.emailVerificationStatus,
                normalizedEmailStatus: user.emailVerificationStatus,
                originalKycStatus: userData.kycStatus,
                normalizedKycStatus: user.kycStatus
              });
              console.log('AuthContext - Found existing user:', user);
              console.log('AuthContext - User data details:', {
                email: user.email,
                name: user.name,
                emailVerificationStatus: user.emailVerificationStatus,
                hasEmail: !!user.email,
                hasName: !!user.name,
                isEmailVerified: user.emailVerificationStatus === 'verified'
              });
              
              // Check if user logged in with Google and needs profile completion
              // Only auto-complete for embedded wallets (social login), NOT for external wallets (MetaMask)
              const isEmbeddedWallet = wallets[0]?.walletClientType === 'privy' || 
                                      wallets[0]?.clientType === 'privy' ||
                                      wallets[0]?.connectorType === 'embedded' ||
                                      !wallets[0]?.connectorType; // Embedded wallets don't have connectorType
              
              const googleEmail = privyUser?.google?.email;
              const googleName = privyUser?.google?.name || 
                                (privyUser?.google?.givenName && privyUser?.google?.familyName 
                                  ? `${privyUser.google.givenName} ${privyUser.google.familyName}`.trim()
                                  : privyUser?.google?.givenName || '');
              // Only auto-complete if: Google login detected AND embedded wallet (social login) AND missing email/name
              const isGoogleLogin = !!googleEmail && !!googleName && privyAuthenticated;
              const needsGoogleAutoComplete = isGoogleLogin && isEmbeddedWallet && (!user.email || !user.name);
              
              if (needsGoogleAutoComplete) {
                console.log('AuthContext - Existing user missing email/name, but Google login detected. Attempting auto-complete...', {
                  googleEmail,
                  googleName,
                  existingEmail: user.email,
                  existingName: user.name,
                  hasAddress: !!address,
                  hasSignMessage: !!signMessage
                });
                
                // Try to auto-complete profile with Google data
                if (address && signMessage) {
                  // Auto-complete in background (don't block UI)
                  (async () => {
                    try {
                      console.log('AuthContext - Attempting auto-complete profile with Google data for existing user...');
                      await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                      console.log('AuthContext - Profile auto-completed for existing user, user state updated');
                    } catch (error) {
                      console.error('AuthContext - Auto-complete profile failed for existing user (will retry):', error);
                      // Retry after a delay
                      setTimeout(async () => {
                        if (address && signMessage && googleEmail && googleName) {
                          try {
                            console.log('AuthContext - Retrying auto-complete profile for existing user...');
                            await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                            console.log('AuthContext - Profile auto-completed on retry for existing user');
                          } catch (retryError) {
                            console.error('AuthContext - Retry auto-complete failed for existing user:', retryError);
                          }
                        }
                      }, 10000); // Retry after 10 seconds
                    }
                  })();
                  
                  // Update user state with Google data temporarily (until auto-complete succeeds)
                  user.email = googleEmail;
                  user.name = googleName;
                }
              }
              
              // Determine auth step based on wallet connection and user status
              let authStep: 'wallet' | 'profile' | 'email' | 'kyc' | 'complete' = 'wallet';
              
              console.log('AuthContext - Wallet and user verification status:', {
                isConnected,
                accountId,
                emailVerificationStatus: user.emailVerificationStatus,
                email: user.email,
                name: user.name,
                isGoogleLogin,
                needsGoogleAutoComplete
              });
              
              // First check if wallet is connected
              if (!isConnected || !accountId) {
                authStep = 'wallet';
                console.log('🔌 Wallet not connected, staying on wallet step');
              } else if (user.emailVerificationStatus === 'verified') {
                authStep = 'complete';
                console.log('✅ Existing user email verified, going to complete step');
              } else if (!user.email || !user.name) {
                authStep = 'profile';
                console.log('❌ Existing user profile incomplete, going to profile step');
              } else if (user.email && user.name) {
                authStep = 'email';
                console.log('⚠️ Existing user profile complete, going to email verification step');
              } else {
                authStep = 'profile';
                console.log('❌ Existing user profile incomplete, going to profile step');
              }
              
              setAuthState({
                isAuthenticated: true,
                user,
                authStep,
                accessToken: null,
                refreshToken: null,
              });
              
              // If user is verified, they can access the dashboard directly
              if (authStep === 'complete') {
                console.log('AuthContext - User is verified, allowing dashboard access');
                // For verified users, we need to generate tokens for API access
                try {
                  console.log('AuthContext - Generating token for verified user...');
                  const tokenResponse = await apiService.generateToken(address);
                  
                  if (tokenResponse.success) {
                    const { user: updatedUserData, accessToken, refreshToken } = tokenResponse.data;
                    
                    // Normalize the updated user data
                    const updatedUser: User = {
                      ...updatedUserData,
                      emailVerificationStatus: updatedUserData.emailVerificationStatus === 'VERIFIED' ? 'verified' : 
                                             updatedUserData.emailVerificationStatus === 'PENDING' ? 'pending' : 'not_verified',
                      kycStatus: updatedUserData.kycStatus === 'pending' ? 'pending' :
                                updatedUserData.kycStatus === 'in_progress' ? 'in_progress' :
                                updatedUserData.kycStatus === 'approved' ? 'approved' :
                                updatedUserData.kycStatus === 'rejected' ? 'rejected' : 'not_started'
                    };
                    
                    // Store the tokens
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken);
                    
                    setAuthState({
                      isAuthenticated: true,
                      user: updatedUser,
                      authStep: 'complete',
                      accessToken,
                      refreshToken,
                    });
                    console.log('AuthContext - Verified user authenticated with backend-generated token');
                  } else {
                    throw new Error(tokenResponse.message || 'Failed to generate token');
                  }
                } catch (error) {
                  console.error('Failed to generate token for verified user:', error);
                  // Fallback to no token - user can still access dashboard but API calls will fail
                  setAuthState({
                    isAuthenticated: true,
                    user,
                    authStep: 'complete',
                    accessToken: null,
                    refreshToken: null,
                  });
                  console.log('AuthContext - Verified user authenticated without token (API calls will fail)');
                }
              }
            } else {
              console.log('AuthContext - No existing user found, checking for Google login...');
              console.log('AuthContext - Response was:', response);
              console.log('AuthContext - Response success:', response?.success);
              console.log('AuthContext - Response data:', response?.data);
              
              // Check if user logged in with Google and auto-complete profile
              // Only auto-complete for embedded wallets (social login), NOT for external wallets (MetaMask)
              const isEmbeddedWallet = wallets[0]?.walletClientType === 'privy' || 
                                      wallets[0]?.clientType === 'privy' ||
                                      wallets[0]?.connectorType === 'embedded' ||
                                      !wallets[0]?.connectorType; // Embedded wallets don't have connectorType
              
              const googleEmail = privyUser?.google?.email;
              // Google name might be in different fields - try name, givenName + familyName, or givenName
              const googleName = privyUser?.google?.name || 
                                (privyUser?.google?.givenName && privyUser?.google?.familyName 
                                  ? `${privyUser.google.givenName} ${privyUser.google.familyName}`.trim()
                                  : privyUser?.google?.givenName || '');
              const isGoogleLogin = !!googleEmail && !!googleName && privyAuthenticated;
              
              // Check if user logged in with Google AND has embedded wallet (social login, not MetaMask)
              if (isGoogleLogin && isEmbeddedWallet && googleEmail && googleName) {
                console.log('AuthContext - Google login detected, attempting auto-complete profile...', {
                  email: googleEmail,
                  name: googleName,
                  hasAddress: !!address,
                  hasSignMessage: !!signMessage
                });
                
                // Try to auto-complete profile if we have address and signMessage
                // Note: signMessage will wait for signer internally, so we can call it directly
                if (address && signMessage) {
                  // Auto-complete in background (don't block UI)
                  // signMessage will handle waiting for signer internally
                  (async () => {
                    try {
                      console.log('AuthContext - Attempting auto-complete profile with Google data...');
                      await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                      // After auto-completion, tokens are already stored and user state is updated
                      // No need to call checkExistingAuth - it might overwrite the state
                      console.log('AuthContext - Profile auto-completed, user state updated');
                    } catch (error) {
                      console.error('AuthContext - Auto-complete profile failed (will retry):', error);
                      // Retry after a delay
                      setTimeout(async () => {
                        if (address && signMessage) {
                          try {
                            console.log('AuthContext - Retrying auto-complete profile...');
                            await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                            // After auto-completion, tokens are already stored and user state is updated
                            console.log('AuthContext - Profile auto-completed on retry, user state updated');
                          } catch (retryError) {
                            console.error('AuthContext - Retry auto-complete failed:', retryError);
                          }
                        }
                      }, 10000); // Retry after 10 seconds
                    }
                  })();
                }
                
                // If auto-complete failed or signer not ready, create user with Google data
                // but mark as having profile data (so we don't show "Complete Profile" modal)
                console.log('AuthContext - Creating user with Google data (will retry auto-complete later)');
                const newUser: User = {
                  _id: '', // Will be set when profile is completed
                  walletAddress: address,
                  email: googleEmail,
                  name: googleName,
                  phone: '',
                  country: '',
                  role: 'user',
                  kycStatus: 'not_started',
                  emailVerificationStatus: 'not_verified', // Will be verified when auto-complete succeeds
                  reputation: 0,
                  stakingBalance: 0,
                  totalInvested: 0,
                  investmentCount: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                
                setAuthState(prev => ({ 
                  ...prev, 
                  authStep: 'email', // Skip profile step since we have email/name from Google
                  isAuthenticated: false,
                  user: newUser,
                  accessToken: null,
                  refreshToken: null,
                }));
                
                // Retry auto-complete in background (once signer is ready)
                setTimeout(async () => {
                  if (address && signMessage && googleEmail && googleName) {
                    try {
                      console.log('AuthContext - Retrying auto-complete profile with Google data...');
                      await autoCompleteProfileWithGoogle(googleEmail, googleName, address, signMessage);
                      // After auto-completion, tokens are already stored and user state is updated
                      console.log('AuthContext - Profile auto-completed on background retry, user state updated');
                    } catch (error) {
                      console.error('AuthContext - Retry auto-complete failed:', error);
                    }
                  }
                }, 5000); // Retry after 5 seconds
                
                return;
              }
              
              // Create a basic user object for new users (non-Google)
              const newUser: User = {
                _id: '', // Will be set when profile is completed
                walletAddress: address,
                email: '',
                name: '',
                phone: '',
                country: '',
                role: 'user',
                kycStatus: 'not_started',
                emailVerificationStatus: 'not_verified',
                reputation: 0,
                stakingBalance: 0,
                totalInvested: 0,
                investmentCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              setAuthState(prev => ({ 
                ...prev, 
                authStep: 'profile',
                isAuthenticated: false,
                user: newUser,
                accessToken: null,
                refreshToken: null,
              }));
            }
          } catch (error) {
            console.log('AuthContext - Error checking user by wallet address:', error);
            console.log('AuthContext - Error details:', (error as Error).message, (error as Error).stack);
            
            // Create a basic user object when backend is not available
            const newUser: User = {
              _id: '', // Will be set when profile is completed
              walletAddress: address,
              email: '',
              name: '',
              phone: '',
              country: '',
              role: 'user',
              kycStatus: 'not_started',
              emailVerificationStatus: 'not_verified',
              reputation: 0,
              stakingBalance: 0,
              totalInvested: 0,
              investmentCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            setAuthState(prev => ({ 
              ...prev, 
              authStep: 'profile',
              isAuthenticated: false, // Not authenticated until profile is completed
              user: newUser,
              accessToken: null,
              refreshToken: null,
            }));
          }
        } else {
          console.log('AuthContext - No wallet address, starting with wallet step');
          setAuthState(prev => ({ ...prev, authStep: 'wallet', accessToken: null, refreshToken: null }));
        }
      }
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await connectWalletContext();
      // Don't automatically authenticate - let the user go through the flow
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };


  const completeProfile = async (profileData: ProfileData) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create profile completion message
      const timestamp = Date.now();
      const message = `TrustBridge Profile Completion\nAddress: ${address}\nTimestamp: ${timestamp}`;
      
      console.log('Attempting to sign message for profile completion:', {
        address,
        accountId,
        message: message.substring(0, 50) + '...'
      });
      
      // Sign the message (WalletContext will handle HashPack signature creation)
      console.log('Calling signMessage...');
      const signature = await signMessage(message);
      console.log('signMessage completed, signature received:', signature.substring(0, 20) + '...');
      
      // Send to backend - only include fields the backend expects
      const requestData = {
        walletAddress: address,
        signature,
        message,
        timestamp,
        email: profileData.email,
        name: profileData.name,
        phone: profileData.phone,
        country: profileData.country,
      };
      
      console.log('Sending HashPack profile completion request:', {
        walletAddress: requestData.walletAddress,
        email: requestData.email,
        name: requestData.name,
        phone: requestData.phone,
        country: requestData.country,
        hasSignature: !!requestData.signature,
        hasMessage: !!requestData.message,
        timestamp: requestData.timestamp,
        signature: requestData.signature?.substring(0, 20) + '...',
        message: requestData.message?.substring(0, 50) + '...'
      });
      
      console.log('Making backend request to completeProfile...');
      const response = await apiService.completeProfile(requestData);
      console.log('Backend response received:', response);

      if (response.success) {
        const { user, accessToken, refreshToken } = response.data;
        
        console.log('Profile completion response:', { 
          success: response.success, 
          user: user.email, 
          name: user.name,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken
        });
        
        // Store tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        console.log('Profile completed successfully, moving to email step:', { user: user.email, name: user.name });
        
        setAuthState({
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          authStep: 'email',
        });
        
        console.log('Auth state updated to email step');
      } else {
        console.error('Profile completion failed:', response);
      }
    } catch (err: any) {
      console.error('Profile completion failed:', err);
      console.error('Backend response:', err.response?.data);
      
      // Handle specific error cases
      let errorMessage = 'Profile completion failed';
      
      if (err.response?.data?.message) {
        // Backend error message
        errorMessage = err.response.data.message;
        console.error('Backend error message:', errorMessage);
      } else if (err.message) {
        // Generic error message
        errorMessage = err.message;
      }
      
      // Check for specific error cases
      if (errorMessage.includes('Email already registered') || errorMessage.includes('Email already in use')) {
        errorMessage = 'This email address is already registered to another account. Please use a different email address.';
      } else if (errorMessage.includes('Invalid wallet signature') || errorMessage.includes('signature verification failed')) {
        errorMessage = 'HashPack wallet verification failed. Please ensure your wallet is properly connected and try again.';
      } else if (errorMessage.includes('Wallet not connected')) {
        errorMessage = 'Please connect your HashPack wallet first.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.verifyEmail({ token });
      
      if (response.success) {
        setAuthState(prev => ({
          ...prev,
          authStep: 'complete',
          user: prev.user ? {
            ...prev.user,
            emailVerificationStatus: 'verified'
          } : prev.user,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify email');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const startKYC = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.startKYC();
      
      if (response.success) {
        // Update user with KYC inquiry ID and status
        setAuthState(prev => ({
          ...prev,
          user: prev.user ? {
            ...prev.user,
            kycStatus: 'in_progress',
            kycInquiryId: response.data.inquiryId,
          } : null,
        }));

        // Open KYC verification in new tab
        if (response.data.inquiryUrl) {
          window.open(response.data.inquiryUrl, '_blank');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start KYC verification');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const checkKYCStatus = async () => {
    if (!authState.user?.kycInquiryId) return;

    try {
      const response = await apiService.checkKYCStatus(authState.user.kycInquiryId);
      
      if (response.success) {
        const { status } = response.data;
        
        setAuthState(prev => ({
          ...prev,
          user: prev.user ? {
            ...prev.user,
            kycStatus: status,
          } : null,
          authStep: status === 'approved' ? 'complete' : prev.authStep,
        }));
      }
    } catch (err) {
      console.error('Failed to check KYC status:', err);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await apiService.getProfile();
      
      if (response.success) {
        const user = response.data;
        
        // Normalize user data to match frontend types
        const normalizedUser: User = {
          ...user,
          emailVerificationStatus: user.emailVerificationStatus === 'VERIFIED' ? 'verified' : 
                                 user.emailVerificationStatus === 'PENDING' ? 'pending' : 'not_verified',
          kycStatus: user.kycStatus === 'pending' ? 'pending' :
                    user.kycStatus === 'in_progress' ? 'in_progress' :
                    user.kycStatus === 'approved' ? 'approved' :
                    user.kycStatus === 'rejected' ? 'rejected' : 'not_started'
        };
        
        setAuthState(prev => ({
          ...prev,
          user: normalizedUser,
        }));
        
        console.log('User data refreshed:', normalizedUser);
        console.log('KYC Status after refresh:', normalizedUser.kycStatus);
        
        // If KYC is now approved, generate a token if we don't have one
        if (normalizedUser.kycStatus === 'approved' && !authState.accessToken) {
          console.log('KYC approved but no token, generating token...');
          try {
            const tokenResponse = await apiService.generateToken(normalizedUser.walletAddress);
            if (tokenResponse.success) {
              const { accessToken, refreshToken } = tokenResponse.data;
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', refreshToken);
              setAuthState(prev => ({
                ...prev,
                accessToken,
                refreshToken,
              }));
              console.log('Token generated for approved KYC user');
            }
          } catch (error) {
            console.error('Failed to generate token for approved KYC user:', error);
          }
        }
      } else {
        // If getProfile fails, check if it's a 401 (unauthorized)
        // This might happen if the token is invalid or expired
        console.warn('AuthContext - refreshUser: getProfile failed:', response.message);
      }
    } catch (err: any) {
      // Handle 401 errors gracefully - token might be invalid or expired
      // But don't clear tokens if user just completed profile (token might be valid but backend not ready)
      if (err?.response?.status === 401 || err?.status === 401) {
        console.log('AuthContext - refreshUser: 401 Unauthorized - token may be invalid or backend not ready yet');
        // Don't clear tokens or throw error - just log it
        // The user might have just completed their profile and backend needs time to process
        return;
      }
      console.error('AuthContext - refreshUser: Failed to refresh user data:', err);
    }
  };

  const logout = async () => {
    try {
      if (authState.accessToken) {
        await apiService.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        authStep: 'wallet',
      });
      setError(null);
    }
  };

  const value: AuthContextType = {
    ...authState,
    connectWallet,
    completeProfile,
    verifyEmail,
    startKYC,
    checkKYCStatus,
    refreshUser,
    setAuthState,
    logout,
    isLoading: isLoading || walletLoading,
    error: error || walletError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
