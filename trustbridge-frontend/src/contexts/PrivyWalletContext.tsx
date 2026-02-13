import React, { createContext, useContext, ReactNode } from 'react';
import { usePrivy, useWallets, useCreateWallet, useSignMessage } from '@privy-io/react-auth';
import { ethers } from 'ethers';

interface PrivyWalletContextType {
  isConnected: boolean;
  address: string | null;
  accountId: string | null; // Alias for address (compatibility)
  balance: string | null;
  walletType: 'privy' | null;
  signer: any | null;
  provider: any | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  loading: boolean;
  error: string | null;
}

const PrivyWalletContext = createContext<PrivyWalletContextType | undefined>(undefined);

export const PrivyWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet({
    onSuccess: ({ wallet }) => {
      console.log('✅ Privy - Wallet created successfully:', wallet.address);
    },
    onError: (error) => {
      console.error('❌ Privy - Failed to create wallet:', error);
    }
  });
  // Use Privy's useSignMessage hook for embedded wallets (preferred method)
  const { signMessage: privySignMessage } = useSignMessage();
  const [signer, setSigner] = React.useState<any | null>(null);
  const [provider, setProvider] = React.useState<any | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = React.useState(false);


  const walletAddress = wallets[0]?.address || user?.wallet?.address || null;
  const isConnected = ready && authenticated && !!walletAddress;
  
  // Check if this is an embedded wallet (from Google/email login)
  // Embedded wallets have connectorType 'embedded' or no connectorType
  const isEmbeddedWallet = wallets[0]?.walletClientType === 'privy' || 
                          wallets[0]?.clientType === 'privy' ||
                          user?.wallet?.walletClientType === 'privy' ||
                          wallets[0]?.connectorType === 'embedded' ||
                          !wallets[0]?.connectorType; // Embedded wallets don't have connectorType

  // Automatically create wallet for social login users who don't have one
  React.useEffect(() => {
    const createWalletIfNeeded = async () => {
      // Only create wallet if:
      // 1. User is authenticated
      // 2. No wallet exists yet
      // 3. User logged in with email/social (not wallet)
      // 4. Not already creating
      if (!ready || !authenticated || isCreatingWallet) return;
      
      const hasWallet = wallets.length > 0 || user?.wallet?.address;
      const isEmailOrSocialUser = user?.email?.address || user?.google?.email || user?.twitter?.username || user?.discord?.username;
      
      if (!hasWallet && isEmailOrSocialUser) {
        console.log('🔄 Privy - No wallet found for social login user, creating embedded wallet...');
        setIsCreatingWallet(true);
        
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Wallet creation timeout after 30 seconds')), 30000)
          );
          
          await Promise.race([
            createWallet(),
            timeoutPromise
          ]);
          
          console.log('✅ Privy - Embedded wallet created successfully');
        } catch (error) {
          console.error('❌ Privy - Failed to create embedded wallet:', error);
          // Don't throw - user can still use the app, just won't have a wallet
        } finally {
          setIsCreatingWallet(false);
        }
      }
    };

    createWalletIfNeeded();
  }, [ready, authenticated, wallets.length, user, createWallet, isCreatingWallet]);

  // Get signer and provider when wallet is connected
  React.useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 10; // Increased retries for embedded wallets
    const retryDelay = 3000; // 3 seconds - embedded wallets can take longer

    const getSignerAndProvider = async (attempt: number = 1) => {
      // Wait for wallets to be ready (important for embedded wallets)
      if (!walletsReady) {
        console.log('Privy - Wallets not ready yet, waiting...');
        if (isMounted && attempt < maxRetries) {
          setTimeout(() => {
            if (isMounted) {
              getSignerAndProvider(attempt + 1);
            }
          }, retryDelay);
        }
        return;
      }
      
      if (!authenticated || !walletAddress || wallets.length === 0) {
        setSigner(null);
        setProvider(null);
        return;
      }

      try {
        console.log(`🔄 Privy - Getting signer and provider (attempt ${attempt}/${maxRetries})...`);
        console.log('Privy - Wallet object:', {
          address: wallets[0]?.address,
          walletClientType: wallets[0]?.walletClientType,
          clientType: wallets[0]?.clientType,
          connectorType: wallets[0]?.connectorType,
          hasGetEthersProvider: typeof wallets[0]?.getEthersProvider === 'function',
          hasProvider: !!wallets[0]?.provider,
          walletKeys: wallets[0] ? Object.keys(wallets[0]) : []
        });
        
        // Get the first connected wallet
        const wallet = wallets[0];
        
        let ethersProvider: any = null;
        let ethersSigner: any = null;
        
        // Try different methods to get provider/signer
        // For embedded wallets, we should NOT use window.ethereum (MetaMask)
        const isEmbeddedWallet = wallet.walletClientType === 'privy' || 
                                wallet.clientType === 'privy' ||
                                !wallet.connectorType;
        
        console.log('Privy - Is embedded wallet:', isEmbeddedWallet);
        
        // Method 1: Try getEthersProvider (if available)
        if (typeof wallet.getEthersProvider === 'function') {
          console.log('Privy - Trying getEthersProvider()...');
          try {
            ethersProvider = await wallet.getEthersProvider();
            console.log('Privy - getEthersProvider() succeeded');
          } catch (err) {
            console.warn('Privy - getEthersProvider() failed:', err);
          }
        }
        
        // Method 2: Try accessing provider property directly
        if (!ethersProvider && wallet.provider) {
          console.log('Privy - Using wallet.provider directly');
          ethersProvider = wallet.provider;
        }
        
        // Method 3: For embedded wallets, use Etherlink RPC directly
        // Embedded wallets from Privy don't have a direct provider, so we use Etherlink RPC
        if (!ethersProvider && isEmbeddedWallet) {
          console.log('Privy - Embedded wallet detected, using Etherlink RPC...');
          const etherlinkRpcUrl = import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com';
          ethersProvider = new ethers.JsonRpcProvider(etherlinkRpcUrl);
          console.log('✅ Privy - Created Etherlink provider for embedded wallet');
        }
        
        // Method 4: Only use window.ethereum for external wallets (NOT embedded wallets)
        if (!ethersProvider && !isEmbeddedWallet && window.ethereum) {
          console.log('Privy - Using window.ethereum for external wallet (MetaMask)');
          ethersProvider = new ethers.BrowserProvider(window.ethereum as any);
        }
        
        // Method 5: For embedded wallets, use Etherlink RPC directly
        if (!ethersProvider && isEmbeddedWallet) {
          console.log('Privy - Using Etherlink RPC for embedded wallet');
          const etherlinkRpcUrl = import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com';
          ethersProvider = new ethers.JsonRpcProvider(etherlinkRpcUrl);
          console.log('✅ Privy - Created Etherlink provider for embedded wallet');
        }
        
        if (!ethersProvider) {
          // For embedded wallets, this might be OK - the wallet might still be initializing
          if (isEmbeddedWallet) {
            console.log('⚠️ Privy - Embedded wallet provider not available yet (wallet may still be initializing)');
            // Don't throw error for embedded wallets - just retry
            if (isMounted && attempt < maxRetries) {
              console.log(`⚠️ Privy - Retrying in ${retryDelay}ms...`);
              setTimeout(() => {
                if (isMounted) {
                  getSignerAndProvider(attempt + 1);
                }
              }, retryDelay);
            }
            return;
          }
          throw new Error('Unable to get provider from Privy wallet');
        }

        // Get signer from provider
        // For embedded wallets with JsonRpcProvider, we don't need a signer (signing via Privy)
        if (!isEmbeddedWallet || !(ethersProvider instanceof ethers.JsonRpcProvider)) {
          if (ethersProvider.getSigner) {
            try {
              ethersSigner = await ethersProvider.getSigner(walletAddress);
            } catch (err) {
              console.warn('Privy - getSigner(walletAddress) failed, trying getSigner() without address:', err);
              try {
                ethersSigner = await ethersProvider.getSigner();
              } catch (err2) {
                console.warn('Privy - getSigner() also failed:', err2);
              }
            }
          } else if (typeof ethersProvider.getSigner === 'function') {
            ethersSigner = await ethersProvider.getSigner();
          }
        } else {
          // Embedded wallet with JsonRpcProvider - signing via Privy, no ethers signer needed
          console.log('Privy - Embedded wallet: Will use Privy signing methods (no ethers signer)');
          ethersSigner = null;
        }
        
        // For embedded wallets, we might not have a signer but we have a provider
        // The provider is used for read operations, signing is done via Privy
        if (isMounted) {
          if (ethersSigner) {
            console.log('✅ Privy - Signer obtained successfully');
            setSigner(ethersSigner);
            setProvider(ethersProvider);
          } else if (isEmbeddedWallet && ethersProvider) {
            // For embedded wallets, provider is enough (signing via Privy)
            console.log('✅ Privy - Provider obtained for embedded wallet (signing via Privy)');
            setSigner(null); // Will use Privy signing
            setProvider(ethersProvider);
          } else if (attempt < maxRetries) {
            // Retry if signer not available (wallet might still be initializing)
            console.log(`⚠️ Privy - Signer not available yet, retrying in ${retryDelay}ms...`);
            setTimeout(() => {
              if (isMounted) {
                getSignerAndProvider(attempt + 1);
              }
            }, retryDelay);
          } else {
            console.warn('⚠️ Privy - Signer not available after all retries');
            setSigner(null);
            setProvider(null);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Privy - Failed to get signer/provider (attempt ${attempt}):`, errorMessage);
        
        // Retry on certain errors (wallet might still be creating)
        if (attempt < maxRetries && (
          errorMessage.includes('not a function') || 
          errorMessage.includes('not available') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('Unable to get provider')
        )) {
          console.log(`⚠️ Privy - Retrying in ${retryDelay}ms...`);
          setTimeout(() => {
            if (isMounted) {
              getSignerAndProvider(attempt + 1);
            }
          }, retryDelay);
        } else {
          setSigner(null);
          setProvider(null);
        }
      }
    };

    getSignerAndProvider();

    return () => {
      isMounted = false;
    };
  }, [authenticated, walletAddress, wallets, walletsReady]);

  const connectWallet = async () => {
    if (!ready) {
      throw new Error('Privy is not ready');
    }
    if (!authenticated) {
      await login();
    }
  };

  const disconnectWallet = async () => {
    if (authenticated) {
      await logout();
    }
    setSigner(null);
    setProvider(null);
  };

  const signMessage = async (message: string, attempts: number = 0): Promise<string> => {
    if (!authenticated || !walletAddress) {
      throw new Error('Wallet not connected');
    }
    
    // Wait for wallets to be ready (important for embedded wallets)
    if (!walletsReady && attempts < 20) {
      console.log(`Privy - Wallets not ready yet, waiting... (attempt ${attempts + 1}/20)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return signMessage(message, attempts + 1);
    }
    
    if (!walletsReady) {
      throw new Error('Wallets not ready after waiting. Please try again.');
    }
    
    try {
      // For embedded wallets, use Privy's useSignMessage hook (preferred method)
      if (isEmbeddedWallet || wallets.length === 0 || wallets[0]?.connectorType === 'embedded') {
        console.log('Privy - Using embedded wallet, trying Privy signMessage hook...');
        
        // Try Privy's native signMessage hook first (best for embedded wallets)
        if (privySignMessage) {
          try {
            console.log('Privy - Using Privy signMessage hook for embedded wallet');
            const result = await privySignMessage({ message });
            const signature = result.signature;
            
            console.log('✅ Privy message signed successfully (Privy signMessage hook):', {
              messageLength: message.length,
              signatureLength: signature?.length || 0,
              address: walletAddress
            });
            return signature;
          } catch (privySignErr) {
            console.warn('Privy - Privy signMessage hook failed, trying alternative methods:', privySignErr);
            // Fall through to try other methods
          }
        }
        
        // Fallback: try to use the signer we already have in state
        if (signer) {
          console.log('Privy - Using existing embedded wallet signer');
          try {
            const signature = await signer.signMessage(message);
            
            console.log('Privy message signed successfully (embedded wallet signer):', {
              messageLength: message.length,
              signatureLength: signature.length,
              address: walletAddress
            });
            return signature;
          } catch (signerErr) {
            console.warn('Privy - Signer.signMessage failed, trying alternative methods:', signerErr);
            // Fall through to try other methods
          }
        }
        
        // Try using Privy's wallet methods directly for embedded wallets
        // The wallet object has a 'sign' method (not 'signMessage')
        const wallet = wallets[0];
        console.log('Privy - Checking wallet for native signing methods:', {
          hasWallet: !!wallet,
          walletsReady,
          walletKeys: wallet ? Object.keys(wallet).slice(0, 20) : [],
          hasSign: wallet ? typeof (wallet as any).sign === 'function' : false,
          hasGetEthereumProvider: wallet ? typeof (wallet as any).getEthereumProvider === 'function' : false,
          hasProvider: !!wallet?.provider,
          providerType: wallet?.provider ? typeof wallet.provider : null
        });
        
        if (wallet && walletsReady) {
          // Method 1: Try wallet.sign() - this is Privy's native signing method for embedded wallets
          if (typeof (wallet as any).sign === 'function') {
            console.log('✅ Privy - Found wallet.sign(), trying it...');
            try {
              // Privy's sign method might expect different parameters
              // Try with just the message first
              const signature = await (wallet as any).sign(message);
              console.log('✅ Privy message signed successfully (wallet.sign):', {
                messageLength: message.length,
                signatureLength: signature?.length || 0,
                address: walletAddress
              });
              return signature;
            } catch (signErr) {
              console.warn('❌ Privy - wallet.sign() failed:', signErr);
            }
          }
          
          // Method 2: Try getEthereumProvider to get a provider, then use personal_sign
          if (typeof (wallet as any).getEthereumProvider === 'function') {
            console.log('✅ Privy - Found getEthereumProvider(), trying to get provider...');
            try {
              const provider = await (wallet as any).getEthereumProvider();
              console.log('✅ Privy - Got provider from getEthereumProvider()');
              
              if (provider && typeof provider.request === 'function') {
                console.log('Privy - Trying personal_sign via getEthereumProvider provider...');
                const messageHex = ethers.hexlify(ethers.toUtf8Bytes(message));
                const signature = await provider.request({
                  method: 'personal_sign',
                  params: [messageHex, walletAddress]
                });
                
                console.log('✅ Privy message signed successfully (getEthereumProvider + personal_sign):', {
                  messageLength: message.length,
                  signatureLength: signature?.length || 0,
                  address: walletAddress
                });
                return signature as string;
              }
            } catch (providerErr) {
              console.warn('❌ Privy - getEthereumProvider() failed:', providerErr);
            }
          }
          
          // Method 3: Try wallet.provider.request if available
          if (wallet.provider && typeof wallet.provider.request === 'function') {
            console.log('✅ Privy - Found provider.request(), trying personal_sign...');
            try {
              const messageHex = ethers.hexlify(ethers.toUtf8Bytes(message));
              const signature = await wallet.provider.request({
                method: 'personal_sign',
                params: [messageHex, walletAddress]
              });
              
              console.log('✅ Privy message signed successfully (provider.request + personal_sign):', {
                messageLength: message.length,
                signatureLength: signature?.length || 0,
                address: walletAddress
              });
              return signature as string;
            } catch (personalSignErr) {
              console.error('❌ Privy - personal_sign via provider.request failed:', personalSignErr);
            }
          }
          
          console.log('⚠️ Privy - No working signing method found on wallet');
        } else {
          console.log('⚠️ Privy - Wallet not available or not ready:', {
            hasWallet: !!wallet,
            walletsReady
          });
        }
        
        // Wait for embedded wallet signer (don't use window.ethereum)
        console.log('Privy - Waiting for embedded wallet signer (no MetaMask fallback)');
        let attempts = 0;
        const maxWaitAttempts = 30; // 15 seconds
        const waitDelay = 500;

        while (!signer && attempts < maxWaitAttempts) {
          await new Promise(resolve => setTimeout(resolve, waitDelay));
          attempts++;
          if (signer) {
            console.log(`Privy - Embedded wallet signer now available after ${attempts * waitDelay}ms`);
            break;
          }
        }

        if (signer) {
          try {
            const signature = await signer.signMessage(message);
            console.log('Privy message signed successfully (embedded wallet signer):', {
              messageLength: message.length,
              signatureLength: signature.length,
              address: walletAddress
            });
            return signature;
          } catch (signerErr2) {
            console.warn('Privy - Signer.signMessage failed after wait:', signerErr2);
          }
        }

        throw new Error('Embedded wallet signer not ready yet. Please wait a moment and try again. The wallet is still initializing.');
      }

      // For external wallets, try to use the signer we already have in state
      if (signer) {
        console.log('Privy - Using existing signer for external wallet signing');
        const signature = await signer.signMessage(message);
        
        console.log('Privy message signed successfully:', {
          messageLength: message.length,
          signatureLength: signature.length,
          address: walletAddress
        });

        return signature;
      }

      // If no signer in state, wait for it to be set (external wallet might still be initializing)
      console.log('Privy - Signer not in state, waiting for external wallet signer to be available...');
      let attempts = 0;
      const maxWaitAttempts = 10; // 5 seconds for external wallets
      const waitDelay = 500; // 500ms

      while (!signer && attempts < maxWaitAttempts) {
        await new Promise(resolve => setTimeout(resolve, waitDelay));
        attempts++;
        if (signer) {
          console.log(`Privy - Signer now available after ${attempts * waitDelay}ms`);
          break;
        }
      }

      if (signer) {
        console.log('Privy - Signer now available, signing message...');
        const signature = await signer.signMessage(message);
        
        console.log('Privy message signed successfully:', {
          messageLength: message.length,
          signatureLength: signature.length,
          address: walletAddress
        });

        return signature;
      }

      // Only use window.ethereum fallback for external wallets (not embedded)
      // This should rarely happen since external wallets usually have signer ready immediately
      if (wallets[0]?.connectorType && window.ethereum) {
        console.log('Privy - Using window.ethereum for external wallet signing (fallback)');
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const ethersSigner = await provider.getSigner(walletAddress);
        const signature = await ethersSigner.signMessage(message);
        
        console.log('Privy message signed successfully (external wallet fallback):', {
          messageLength: message.length,
          signatureLength: signature.length,
          address: walletAddress
        });

        return signature;
      }

      throw new Error('Unable to get signer. Please wait for wallet to initialize and try again.');
    } catch (error) {
      console.error('Privy message signing failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sign message with Privy');
    }
  };

  const value: PrivyWalletContextType = {
    isConnected: isConnected || false,
    address: walletAddress,
    accountId: walletAddress, // Compatibility: accountId = address
    balance: null, // Balance would need to be fetched separately
    walletType: isConnected ? 'privy' : null,
    signer: signer as any, // Privy signer
    provider: provider as any, // Privy provider
    connectWallet,
    disconnectWallet,
    signMessage,
    loading: !ready,
    error: null,
  };

  return (
    <PrivyWalletContext.Provider value={value}>
      {children}
    </PrivyWalletContext.Provider>
  );
};

export const usePrivyWallet = () => {
  const context = useContext(PrivyWalletContext);
  if (context === undefined) {
    throw new Error('usePrivyWallet must be used within a PrivyWalletProvider');
  }
  return context;
};

// Export as useWallet for compatibility
export const useWallet = usePrivyWallet;

