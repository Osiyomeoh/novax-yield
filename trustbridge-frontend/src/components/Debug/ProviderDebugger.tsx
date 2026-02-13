import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/Card';
import Button from '../UI/Button';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface DebugInfo {
  timestamp: string;
  privyReady: boolean;
  privyAuthenticated: boolean;
  privyUser: any;
  privyWallets: any[];
  privyWalletsReady: boolean;
  walletAddress: string | null;
  walletProvider: boolean;
  walletSigner: boolean;
  walletIsConnected: boolean;
  walletLoading: boolean;
  windowEthereum: boolean;
  errors: string[];
  recommendations: string[];
}

const ProviderDebugger: React.FC = () => {
  const { ready, authenticated, user, wallets, walletsReady } = usePrivy();
  const { address, provider, signer, isConnected, loading } = useWallet();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDebug = () => {
    setIsRunning(true);
    
    // Safely get wallets array
    const walletsArray = Array.isArray(wallets) ? wallets : [];
    
    const info: DebugInfo = {
      timestamp: new Date().toISOString(),
      privyReady: ready,
      privyAuthenticated: authenticated,
      privyUser: user,
      privyWallets: walletsArray,
      privyWalletsReady: walletsReady || false,
      walletAddress: address,
      walletProvider: !!provider,
      walletSigner: !!signer,
      walletIsConnected: isConnected,
      walletLoading: loading,
      windowEthereum: !!(window as any).ethereum,
      errors: [],
      recommendations: [],
    };

    // Check for issues
    if (!ready) {
      info.errors.push('Privy is not ready');
      info.recommendations.push('Wait for Privy to initialize');
    }

    if (!authenticated) {
      info.errors.push('User is not authenticated');
      info.recommendations.push('Call login() to authenticate');
    }

    if (!walletsReady) {
      info.errors.push('Wallets are not ready');
      info.recommendations.push('Wait for walletsReady to be true');
    }

    if (walletsArray.length === 0) {
      info.errors.push('No wallets found');
      info.recommendations.push('Create or connect a wallet');
    }

    if (!address) {
      info.errors.push('Wallet address is not available');
      info.recommendations.push('Ensure wallet is connected');
    }

    if (!provider) {
      info.errors.push('Provider is not available');
      
      // Check wallet type
      const wallet = walletsArray[0];
      if (wallet) {
        const isEmbedded = 
          wallet.walletClientType === 'privy' ||
          wallet.clientType === 'privy' ||
          !wallet.connectorType;
        
        if (isEmbedded) {
          info.recommendations.push('Embedded wallet detected - provider should be created with Etherlink RPC');
          info.recommendations.push('Check PrivyWalletContext useEffect for provider creation');
        } else {
          info.recommendations.push('External wallet - check if getEthersProvider() is working');
          info.recommendations.push('Check if window.ethereum is available');
        }
      } else {
        info.recommendations.push('No wallet found - cannot determine wallet type');
      }
    }

    if (!signer && provider) {
      info.recommendations.push('Provider available but signer is null - this is OK for embedded wallets');
    }

    // Log to console
    console.group('🔍 Provider Debug Report');
    console.log('Timestamp:', info.timestamp);
    console.log('Privy State:', {
      ready: info.privyReady,
      authenticated: info.privyAuthenticated,
      walletsReady: info.privyWalletsReady,
      walletsCount: info.privyWallets?.length || 0,
    });
    console.log('Wallet State:', {
      address: info.walletAddress,
      hasProvider: info.walletProvider,
      hasSigner: info.walletSigner,
      isConnected: info.walletIsConnected,
      loading: info.walletLoading,
    });
    console.log('Environment:', {
      windowEthereum: info.windowEthereum,
    });
    if (walletsArray.length > 0) {
      console.log('Wallet Details:', {
        walletClientType: walletsArray[0]?.walletClientType,
        clientType: walletsArray[0]?.clientType,
        connectorType: walletsArray[0]?.connectorType,
        hasGetEthersProvider: typeof walletsArray[0]?.getEthersProvider === 'function',
        hasProvider: !!walletsArray[0]?.provider,
      });
    }
    if (info.errors.length > 0) {
      console.error('❌ Errors:', info.errors);
    }
    if (info.recommendations.length > 0) {
      console.warn('💡 Recommendations:', info.recommendations);
    }
    console.groupEnd();

    setDebugInfo(info);
    setIsRunning(false);
  };

  useEffect(() => {
    // Auto-run debug on mount
    runDebug();
  }, [ready, authenticated, walletsReady, address, provider, signer]);

  return (
    <Card className="bg-midnight-800 border-medium-gray/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Provider Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runDebug}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Running Debug...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Debug
            </>
          )}
        </Button>

        {debugInfo && (
          <div className="space-y-4">
            {/* Privy State */}
            <div>
              <h3 className="text-sm font-semibold text-off-white mb-2">Privy State</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {debugInfo.privyReady ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-text-secondary">Ready: {String(debugInfo.privyReady)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {debugInfo.privyAuthenticated ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-text-secondary">Authenticated: {String(debugInfo.privyAuthenticated)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {debugInfo.privyWalletsReady ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-text-secondary">Wallets Ready: {String(debugInfo.privyWalletsReady)}</span>
                </div>
                <div className="text-text-secondary">
                  Wallets: {debugInfo.privyWallets.length}
                </div>
              </div>
            </div>

            {/* Wallet State */}
            <div>
              <h3 className="text-sm font-semibold text-off-white mb-2">Wallet State</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {debugInfo.walletAddress ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-text-secondary">Address: {debugInfo.walletAddress || 'Not available'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {debugInfo.walletProvider ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-text-secondary">Provider: {debugInfo.walletProvider ? 'Available' : 'Not available'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {debugInfo.walletSigner ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-yellow-400" />
                  )}
                  <span className="text-text-secondary">Signer: {debugInfo.walletSigner ? 'Available' : 'Not available (OK for embedded wallets)'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {debugInfo.walletIsConnected ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-text-secondary">Connected: {String(debugInfo.walletIsConnected)}</span>
                </div>
              </div>
            </div>

            {/* Errors */}
            {debugInfo.errors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-2">Errors</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-300">
                  {debugInfo.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {debugInfo.recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-300">
                  {debugInfo.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Wallet Details */}
            {debugInfo.privyWallets && debugInfo.privyWallets.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-off-white mb-2">Wallet Details</h3>
                <pre className="text-xs bg-midnight-700 p-2 rounded overflow-auto text-text-secondary">
                  {JSON.stringify(debugInfo.privyWallets[0], null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProviderDebugger;

