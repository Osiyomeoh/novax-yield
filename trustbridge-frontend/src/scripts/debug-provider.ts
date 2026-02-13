/**
 * Provider Debugging Script
 * 
 * This script helps diagnose why the provider is not available in PrivyWalletContext
 * Run this in the browser console or as a React component
 */

interface ProviderDebugInfo {
  timestamp: string;
  privyState: {
    ready: boolean;
    authenticated: boolean;
    user: any;
    wallets: any[];
    walletsReady: boolean;
  };
  walletState: {
    address: string | null;
    hasProvider: boolean;
    hasSigner: boolean;
    isConnected: boolean;
    loading: boolean;
  };
  providerMethods: {
    getEthersProvider: boolean;
    directProvider: boolean;
    windowEthereum: boolean;
    embeddedWallet: boolean;
  };
  errors: string[];
  recommendations: string[];
}

export function debugProvider(): ProviderDebugInfo {
  const debugInfo: ProviderDebugInfo = {
    timestamp: new Date().toISOString(),
    privyState: {
      ready: false,
      authenticated: false,
      user: null,
      wallets: [],
      walletsReady: false,
    },
    walletState: {
      address: null,
      hasProvider: false,
      hasSigner: false,
      isConnected: false,
      loading: false,
    },
    providerMethods: {
      getEthersProvider: false,
      directProvider: false,
      windowEthereum: false,
      embeddedWallet: false,
    },
    errors: [],
    recommendations: [],
  };

  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      debugInfo.errors.push('Not in browser environment');
      return debugInfo;
    }

    // Check if Privy is available
    const privy = (window as any).privy;
    if (!privy) {
      debugInfo.errors.push('Privy not found on window object');
      debugInfo.recommendations.push('Ensure PrivyProvider is properly initialized');
      return debugInfo;
    }

    // Get Privy state
    try {
      const privyState = privy.getPrivyState?.() || {};
      debugInfo.privyState = {
        ready: privyState.ready || false,
        authenticated: privyState.authenticated || false,
        user: privyState.user || null,
        wallets: privyState.wallets || [],
        walletsReady: privyState.walletsReady || false,
      };
    } catch (error: any) {
      debugInfo.errors.push(`Failed to get Privy state: ${error.message}`);
    }

    // Check wallet state
    const wallet = debugInfo.privyState.wallets?.[0];
    if (wallet) {
      debugInfo.walletState.address = wallet.address || null;
      
      // Check provider methods
      debugInfo.providerMethods.getEthersProvider = typeof wallet.getEthersProvider === 'function';
      debugInfo.providerMethods.directProvider = !!wallet.provider;
      debugInfo.providerMethods.windowEthereum = !!(window as any).ethereum;
      
      // Check if embedded wallet
      debugInfo.providerMethods.embeddedWallet = 
        wallet.walletClientType === 'privy' ||
        wallet.clientType === 'privy' ||
        !wallet.connectorType;

      // Try to get provider
      if (debugInfo.providerMethods.getEthersProvider) {
        try {
          wallet.getEthersProvider().then((provider: any) => {
            if (provider) {
              debugInfo.walletState.hasProvider = true;
              console.log('✅ Provider obtained via getEthersProvider()');
            }
          }).catch((err: any) => {
            debugInfo.errors.push(`getEthersProvider() failed: ${err.message}`);
          });
        } catch (error: any) {
          debugInfo.errors.push(`getEthersProvider() error: ${error.message}`);
        }
      }

      if (debugInfo.providerMethods.directProvider) {
        debugInfo.walletState.hasProvider = true;
        console.log('✅ Provider available via wallet.provider');
      }
    }

    // Check window.ethereum
    if (debugInfo.providerMethods.windowEthereum) {
      console.log('✅ window.ethereum is available');
    }

    // Generate recommendations
    if (!debugInfo.privyState.ready) {
      debugInfo.recommendations.push('Privy is not ready yet. Wait for initialization.');
    }

    if (!debugInfo.privyState.authenticated) {
      debugInfo.recommendations.push('User is not authenticated. Call login() first.');
    }

    if (debugInfo.privyState.wallets.length === 0) {
      debugInfo.recommendations.push('No wallets found. Create a wallet or connect one.');
    }

    if (!debugInfo.privyState.walletsReady) {
      debugInfo.recommendations.push('Wallets are not ready yet. Wait for walletsReady to be true.');
    }

    if (!debugInfo.walletState.address) {
      debugInfo.recommendations.push('Wallet address is not available. Ensure wallet is connected.');
    }

    if (!debugInfo.walletState.hasProvider && !debugInfo.providerMethods.embeddedWallet) {
      debugInfo.recommendations.push('Provider not available and not an embedded wallet. Check wallet connection.');
    }

    if (debugInfo.providerMethods.embeddedWallet && !debugInfo.walletState.hasProvider) {
      debugInfo.recommendations.push('Embedded wallet detected but provider not available. May need to create fallback provider with Etherlink RPC.');
    }

  } catch (error: any) {
    debugInfo.errors.push(`Debug script error: ${error.message}`);
  }

  return debugInfo;
}

// React hook version for use in components
export function useProviderDebug() {
  const [debugInfo, setDebugInfo] = React.useState<ProviderDebugInfo | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  const runDebug = React.useCallback(() => {
    setIsRunning(true);
    const info = debugProvider();
    setDebugInfo(info);
    setIsRunning(false);
    
    // Log to console
    console.group('🔍 Provider Debug Report');
    console.log('Timestamp:', info.timestamp);
    console.log('Privy State:', info.privyState);
    console.log('Wallet State:', info.walletState);
    console.log('Provider Methods:', info.providerMethods);
    if (info.errors.length > 0) {
      console.error('Errors:', info.errors);
    }
    if (info.recommendations.length > 0) {
      console.warn('Recommendations:', info.recommendations);
    }
    console.groupEnd();
    
    return info;
  }, []);

  return { debugInfo, runDebug, isRunning };
}

// Browser console version
if (typeof window !== 'undefined') {
  (window as any).debugProvider = debugProvider;
  console.log('🔍 Provider debug script loaded. Run debugProvider() in console to check provider status.');
}

