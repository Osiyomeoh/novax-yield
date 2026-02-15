import { ethers } from 'ethers';
import { novaxContractAddresses } from '../config/contracts';
import { waitForTransaction } from '../utils/transactionUtils';

// Import Novax contract ABIs
import NovaxRwaFactoryABI from '../contracts/NovaxRwaFactory.json';
import NovaxReceivableFactoryABI from '../contracts/NovaxReceivableFactory.json';
import NovaxPoolManagerABI from '../contracts/NovaxPoolManager.json';
import NovaxMarketplaceABI from '../contracts/NovaxMarketplace.json';
import PoolTokenABI from '../contracts/PoolToken.json';
import NVXTokenABI from '../contracts/NVXToken.json';
import MockUSDCABI from '../contracts/MockUSDC.json';

/**
 * Novax Contract Service
 * Handles all smart contract interactions for Novax Yield on Etherlink
 */
export class NovaxContractService {
  private signer: ethers.Signer | null = null;
  private provider: ethers.Provider | null = null;
  
  // RPC endpoints with fallback support
  private readonly rpcEndpoints = [
    import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com',
    'https://node.shadownet.etherlink.com',
  ].filter(Boolean);

  // Etherlink network configuration
  private readonly ETHERLINK_CHAIN_ID = '0x1F2EF'; // 127823 in hex
  private readonly ETHERLINK_CHAIN_ID_DECIMAL = 127823;
  // Alternative chain IDs that MetaMask might use for Etherlink
  private readonly ETHERLINK_CHAIN_ID_ALT = '0x1f34f'; // Alternative format (127823 in hex, lowercase)
  private readonly ETHERLINK_RPC_URL = import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com';
  private readonly ETHERLINK_CHAIN_NAME = 'Etherlink Shadownet';
  private readonly ETHERLINK_EXPLORER = import.meta.env.VITE_EXPLORER_URL || 'https://shadownet.explorer.etherlink.com';

  /**
   * Initialize with signer and provider
   */
  initialize(signer: ethers.Signer, provider: ethers.Provider) {
    this.signer = signer;
    this.provider = provider;
  }

  // Track pending network switch requests to avoid duplicates
  private pendingNetworkSwitch: Promise<void> | null = null;

  /**
   * Ensure we're connected to Etherlink network (for MetaMask/external wallets)
   * This should ONLY be called before WRITE operations (transactions), NOT read operations
   * 
   * IMPORTANT: This function will trigger MetaMask prompts, so it should NEVER be called for:
   * - Read operations (getReceivable, getExporterReceivables, getAllReceivables, etc.)
   * - Page load/refresh
   * - Component initialization
   * 
   * Only call this before actual write operations like createReceivable, verifyReceivable, etc.
   */
  private async ensureEtherlinkNetwork(): Promise<void> {
    // Only check for external wallets (MetaMask)
    // Embedded wallets (Privy) don't need network switching - they use Privy's RPC
    // If we don't have window.ethereum, we're likely using an embedded wallet, so skip
    if (typeof window === 'undefined' || !window.ethereum) {
      console.log('⏭️ Skipping network check - no window.ethereum (likely embedded wallet)');
      return;
    }
    
    // Check if we're using an embedded wallet by checking if provider is from Privy
    // Privy embedded wallets don't use window.ethereum, so if provider exists but window.ethereum
    // is not the source, we're likely using Privy's embedded wallet
    // We can detect this by checking if the provider was created from window.ethereum
    const isEmbeddedWallet = this.provider && 
      !(this.provider instanceof ethers.BrowserProvider && 
        (this.provider as any).provider === window.ethereum);
    
    if (isEmbeddedWallet) {
      console.log('⏭️ Skipping network check - using embedded wallet (Privy)');
      return;
    }
    
    // Only proceed if we have window.ethereum (MetaMask/external wallet)
    if (window.ethereum) {
      // If there's already a pending request, wait for it
      if (this.pendingNetworkSwitch) {
        console.log('⏳ Waiting for pending network switch request...');
        try {
          await this.pendingNetworkSwitch;
          console.log('✅ Pending network switch completed');
        } catch (error) {
          console.warn('⚠️ Pending network switch failed:', error);
          // Continue to try again
        }
        this.pendingNetworkSwitch = null;
      }

      try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        // Normalize chain IDs for comparison (handle case differences)
        const normalizedCurrent = currentChainId.toLowerCase();
        const normalizedRequired = this.ETHERLINK_CHAIN_ID.toLowerCase();
        const normalizedAlt = this.ETHERLINK_CHAIN_ID_ALT.toLowerCase();
        
        // Check if we're already on Etherlink (either format)
        const isOnEtherlink = normalizedCurrent === normalizedRequired || normalizedCurrent === normalizedAlt;
        
        if (isOnEtherlink) {
          console.log('✅ Already on Etherlink network', {
            chainId: currentChainId,
            normalized: normalizedCurrent
          });
        } else {
          console.log('🔄 MetaMask is on wrong network, switching to Etherlink...', {
            current: currentChainId,
            required: this.ETHERLINK_CHAIN_ID
          });
          
          // Create a promise for the network switch
          this.pendingNetworkSwitch = (async () => {
            try {
              // Try to switch to our preferred chain ID first
              try {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: this.ETHERLINK_CHAIN_ID }],
                });
                // Verify the switch was successful
                const verifyChainId = await window.ethereum.request({ method: 'eth_chainId' });
                console.log('✅ Successfully switched to Etherlink network', {
                  previousChainId: currentChainId,
                  newChainId: verifyChainId,
                  chainIdDecimal: this.ETHERLINK_CHAIN_ID_DECIMAL
                });
              } catch (switchError: any) {
                if (switchError.code === 4902) {
                  // Chain not added, try to add it
                  console.log('➕ Adding Etherlink network to MetaMask...');
                  try {
                    await window.ethereum.request({
                      method: 'wallet_addEthereumChain',
                      params: [{
                        chainId: this.ETHERLINK_CHAIN_ID,
                        chainName: this.ETHERLINK_CHAIN_NAME,
                        rpcUrls: [this.ETHERLINK_RPC_URL],
                        nativeCurrency: {
                          name: 'XTZ',
                          symbol: 'XTZ',
                          decimals: 18,
                        },
                        blockExplorerUrls: [this.ETHERLINK_EXPLORER],
                      }],
                    });
                    // Verify the network was added and we're on it
                    const verifyChainId = await window.ethereum.request({ method: 'eth_chainId' });
                    console.log('✅ Successfully added and switched to Etherlink network', {
                      chainId: verifyChainId,
                      chainIdDecimal: this.ETHERLINK_CHAIN_ID_DECIMAL,
                      networkName: this.ETHERLINK_CHAIN_NAME
                    });
                  } catch (addError: any) {
                    // If add fails because network already exists with different chain ID
                    if (addError.code === -32603 && addError.message?.includes('same RPC endpoint')) {
                      console.log('⚠️ Network already exists with different chain ID, trying to switch to existing network...');
                      // Try switching to the alternative chain ID that MetaMask knows about
                      try {
                        await window.ethereum.request({
                          method: 'wallet_switchEthereumChain',
                          params: [{ chainId: this.ETHERLINK_CHAIN_ID_ALT }],
                        });
                        // Verify the switch was successful
                        const verifyChainId = await window.ethereum.request({ method: 'eth_chainId' });
                        console.log('✅ Successfully switched to existing Etherlink network', {
                          chainId: verifyChainId,
                          chainIdDecimal: this.ETHERLINK_CHAIN_ID_DECIMAL,
                          note: 'Network was already added with different chain ID format'
                        });
                      } catch (altSwitchError: any) {
                        // If that also fails, check if we're already on the right network
                        const checkChainId = await window.ethereum.request({ method: 'eth_chainId' });
                        const normalizedCheck = checkChainId.toLowerCase();
                        if (normalizedCheck === normalizedRequired || normalizedCheck === normalizedAlt) {
                          console.log('✅ Successfully on Etherlink network (different chain ID format)', {
                            chainId: checkChainId,
                            chainIdDecimal: this.ETHERLINK_CHAIN_ID_DECIMAL,
                            note: 'Network was already configured in MetaMask'
                          });
                        } else {
                          throw new Error('Network already exists in MetaMask but could not switch to it. Please manually switch to Etherlink network.');
                        }
                      }
                    } else {
                      throw addError;
                    }
                  }
                } else if (switchError.code === -32002) {
                  // Request already pending - wait a bit and check again
                  console.log('⏳ Network switch request already pending, waiting...');
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  // Check if we're on the right network now
                  const newChainId = await window.ethereum.request({ method: 'eth_chainId' });
                  const normalizedNew = newChainId.toLowerCase();
                  if (normalizedNew === normalizedRequired || normalizedNew === normalizedAlt) {
                    console.log('✅ Network switch completed successfully', {
                      chainId: newChainId,
                      chainIdDecimal: this.ETHERLINK_CHAIN_ID_DECIMAL,
                      note: 'Pending request was approved'
                    });
                  } else {
                    throw new Error('Network switch is still pending. Please approve the request in MetaMask.');
                  }
                } else {
                  throw new Error(`Failed to switch to Etherlink network: ${switchError.message}`);
                }
              }
            } finally {
              this.pendingNetworkSwitch = null;
            }
          })();

          await this.pendingNetworkSwitch;
          
          // Final verification after switch
          const finalChainId = await window.ethereum.request({ method: 'eth_chainId' });
          const normalizedFinal = finalChainId.toLowerCase();
          if (normalizedFinal === normalizedRequired || normalizedFinal === normalizedAlt) {
            console.log('✅ Network switch verified - ready to proceed', {
              chainId: finalChainId,
              chainIdDecimal: this.ETHERLINK_CHAIN_ID_DECIMAL
            });
          }
        }
      } catch (error: any) {
        this.pendingNetworkSwitch = null;
        console.error('⚠️ Failed to ensure Etherlink network:', error);
        
        // Provide more helpful error messages
        if (error.code === -32002) {
          throw new Error('Network switch request is already pending in MetaMask. Please approve or reject the request in MetaMask and try again.');
        }
        throw new Error(`Network error: Please switch MetaMask to Etherlink network (Chain ID: ${this.ETHERLINK_CHAIN_ID_DECIMAL})`);
      }
    }
    
    // Also verify provider chain ID if available
    if (this.provider && 'getNetwork' in this.provider) {
      try {
        const network = await this.provider.getNetwork();
        if (network.chainId !== BigInt(this.ETHERLINK_CHAIN_ID_DECIMAL)) {
          console.warn('⚠️ Provider chain ID mismatch:', {
            provider: network.chainId.toString(),
            required: this.ETHERLINK_CHAIN_ID_DECIMAL.toString()
          });
        }
      } catch (err) {
        // Provider might not support getNetwork, that's OK
        console.log('Provider does not support getNetwork()');
      }
    }
  }

  /**
   * Get contract instance
   */
  private getContract(address: string, abi: any): ethers.Contract {
    if (!this.signer && !this.provider) {
      throw new Error('Signer or provider not initialized. Please connect wallet first.');
    }
    const abiArray = Array.isArray(abi) ? abi : abi.abi || abi;
    return new ethers.Contract(address, abiArray, this.signer || this.provider!);
  }

  // ==================== RWA FACTORY METHODS ====================

  /**
   * Create RWA asset
   * @param category Asset category (0-5: REAL_ESTATE, AGRICULTURE, INFRASTRUCTURE, COMMODITY, EQUIPMENT, OTHER)
   * @param valueUSD Asset value in USDC (6 decimals)
   * @param maxLTV Maximum Loan-to-Value percentage (0-100)
   * @param metadataCID IPFS CID as bytes32
   */
  async createRwa(
    category: number,
    valueUSD: bigint,
    maxLTV: number,
    metadataCID: string | Uint8Array
  ): Promise<{ assetId: string; txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const factory = this.getContract(
      novaxContractAddresses.RWA_FACTORY,
      NovaxRwaFactoryABI
    );

    // Convert metadataCID to bytes32 if it's a string
    let metadataCIDBytes32: string;
    if (typeof metadataCID === 'string') {
      // If it's already a hex string (0x...), use it directly
      if (metadataCID.startsWith('0x') && metadataCID.length === 66) {
        metadataCIDBytes32 = metadataCID;
      } else {
        // Otherwise, hash it to bytes32
        metadataCIDBytes32 = ethers.id(metadataCID);
      }
    } else {
      // If it's Uint8Array, convert to hex
      metadataCIDBytes32 = ethers.hexlify(metadataCID);
    }

    console.log('🚀 Creating RWA asset:', {
      category,
      valueUSD: ethers.formatUnits(valueUSD, 6),
      maxLTV,
      metadataCID: metadataCIDBytes32,
    });

    const tx = await factory.createRwa(category, valueUSD, maxLTV, metadataCIDBytes32);
    console.log('⏳ Transaction submitted:', tx.hash);

    const receipt = await waitForTransaction(tx, this.provider, 180);
    if (!receipt) {
      throw new Error('Transaction receipt not available');
    }

    // Parse event to get asset ID
    const eventLog = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'RwaAssetCreated';
      } catch {
        return false;
      }
    });

    if (!eventLog) {
      throw new Error('RwaAssetCreated event not found in transaction receipt');
    }

    const parsedEvent = factory.interface.parseLog({
      topics: eventLog.topics,
      data: eventLog.data,
    });

    const assetId = parsedEvent?.args[0] || eventLog.topics[1];
    
    console.log('✅ RWA asset created:', {
      assetId,
      txHash: receipt.hash,
    });

    return {
      assetId: typeof assetId === 'string' ? assetId : ethers.hexlify(assetId),
      txHash: receipt.hash,
    };
  }

  /**
   * Get RWA asset details
   */
  async getAsset(assetId: string): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const factory = this.getContract(
      novaxContractAddresses.RWA_FACTORY,
      NovaxRwaFactoryABI
    );

    // Convert assetId to bytes32 if needed
    const assetIdBytes32 = assetId.startsWith('0x') && assetId.length === 66
      ? assetId
      : ethers.id(assetId);

    const asset = await factory.getAsset(assetIdBytes32);
    return asset;
  }

  /**
   * Approve asset (AMC only)
   * @param assetId Asset ID
   * @param riskScore Risk score (0-100)
   */
  async approveAsset(assetId: string, riskScore: number): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const factory = this.getContract(
      novaxContractAddresses.RWA_FACTORY,
      NovaxRwaFactoryABI
    );

    const assetIdBytes32 = assetId.startsWith('0x') && assetId.length === 66
      ? assetId
      : ethers.id(assetId);

    const tx = await factory.approveAsset(assetIdBytes32, riskScore);
    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }

  // ==================== RECEIVABLE FACTORY METHODS ====================

  /**
   * Create trade receivable
   * @param importer Importer address
   * @param amountUSD Receivable amount in USDC (6 decimals)
   * @param dueDate Due date (Unix timestamp)
   * @param metadataCID IPFS CID as bytes32
   */
  async createReceivable(
    importer: string,
    amountUSD: bigint,
    dueDate: number,
    metadataCID: string | Uint8Array
  ): Promise<{ receivableId: string; txHash: string }> {
    // For Privy embedded wallets, signer might be null but provider should be available
    if (!this.signer && !this.provider) {
      throw new Error('Wallet not initialized. Please connect wallet first.');
    }

    // Try to get signer from provider if not available
    if (!this.signer && this.provider) {
      try {
        if ('getSigner' in this.provider && typeof this.provider.getSigner === 'function') {
          this.signer = await this.provider.getSigner();
          console.log('✅ Got signer from provider');
        }
      } catch (err) {
        console.warn('Could not get signer from provider:', err);
      }
    }

    // Signer is required for write operations
    if (!this.signer) {
      throw new Error('Signer not available. Please ensure your wallet is fully connected and try again.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const factory = this.getContract(
      novaxContractAddresses.RECEIVABLE_FACTORY,
      NovaxReceivableFactoryABI
    );

    // Convert metadataCID to bytes32
    let metadataCIDBytes32: string;
    if (typeof metadataCID === 'string') {
      metadataCIDBytes32 = metadataCID.startsWith('0x') && metadataCID.length === 66
        ? metadataCID
        : ethers.id(metadataCID);
    } else {
      metadataCIDBytes32 = ethers.hexlify(metadataCID);
    }

    // createReceivable requires 5 parameters: importer, amountUSD, dueDate, metadataCID, importerApprovalId
    // importerApprovalId can be zero (bytes32(0)) if not using ImporterApproval contract
    const importerApprovalId = ethers.ZeroHash; // Default to zero if not provided
    
    const tx = await factory.createReceivable(
      importer,
      amountUSD,
      dueDate,
      metadataCIDBytes32,
      importerApprovalId
    );

    const receipt = await waitForTransaction(tx, this.provider, 180);
    if (!receipt) {
      throw new Error('Transaction receipt not available');
    }

    // Parse event
    const eventLog = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'ReceivableCreated';
      } catch {
        return false;
      }
    });

    if (!eventLog) {
      throw new Error('ReceivableCreated event not found');
    }

    const parsedEvent = factory.interface.parseLog({
      topics: eventLog.topics,
      data: eventLog.data,
    });

    const receivableId = parsedEvent?.args[0] || eventLog.topics[1];
    const formattedReceivableId = typeof receivableId === 'string' ? receivableId : ethers.hexlify(receivableId);

    console.log('✅✅✅ RECEIVABLE CREATED SUCCESSFULLY ✅✅✅', {
      receivableId: formattedReceivableId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      importer,
      amountUSD: amountUSD.toString(),
      dueDate: new Date(dueDate * 1000).toISOString(),
      metadataCID: typeof metadataCID === 'string' ? metadataCID : 'bytes',
      timestamp: new Date().toISOString()
    });

    return {
      receivableId: formattedReceivableId,
      txHash: receipt.hash,
    };
  }

  /**
   * Get receivable details
   */
  async getReceivable(receivableId: string): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const factory = this.getContract(
      novaxContractAddresses.RECEIVABLE_FACTORY,
      NovaxReceivableFactoryABI
    );

    const receivableIdBytes32 = receivableId.startsWith('0x') && receivableId.length === 66
      ? receivableId
      : ethers.id(receivableId);

    return await factory.getReceivable(receivableIdBytes32);
  }

  /**
   * Verify receivable (AMC only)
   */
  async verifyReceivable(
    receivableId: string,
    riskScore: number,
    apr: number
  ): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const factory = this.getContract(
      novaxContractAddresses.RECEIVABLE_FACTORY,
      NovaxReceivableFactoryABI
    );

    const receivableIdBytes32 = receivableId.startsWith('0x') && receivableId.length === 66
      ? receivableId
      : ethers.id(receivableId);

    const tx = await factory.verifyReceivable(receivableIdBytes32, riskScore, apr);
    
    // Use polling for Etherlink (slow network)
    const receipt = await waitForTransaction(tx, this.provider, 180);
    
    if (!receipt) {
      throw new Error('Transaction not confirmed. Please check the explorer.');
    }

    return { txHash: receipt.hash };
  }

  /**
   * Get all receivables using contract getter (much faster than querying events!)
   * Uses the allReceivables array from the contract
   * @returns Array of receivable IDs
   */
  async getAllReceivables(): Promise<string[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const factory = this.getContract(
      novaxContractAddresses.RECEIVABLE_FACTORY,
      NovaxReceivableFactoryABI
    );

    try {
      console.log('🔍 Fetching all receivables using contract getter (allReceivables array)...');
      
      // Use the allReceivables public array getter - much faster than querying events!
      // Read totalReceivables first to know how many to fetch
      const totalReceivables = await factory.totalReceivables();
      console.log(`📊 Total receivables: ${totalReceivables}`);
      
      if (totalReceivables === 0n) {
        console.log('✅ No receivables found');
        return [];
      }
      
      // Use getAllReceivableIds() - same as test scripts
      const receivableIds = await factory.getAllReceivableIds();
      console.log(`✅ Found ${receivableIds.length} receivables using getAllReceivableIds()`);
      
      // Convert bytes32[] to string[]
      return receivableIds.map((id: any) => 
        typeof id === 'string' ? id : ethers.hexlify(id)
      );
    } catch (error) {
      console.error('Error querying receivables:', error);
      throw new Error(`Failed to fetch receivables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get receivables for a specific exporter using the contract's mapping (MUCH FASTER!)
   * @param exporterAddress Exporter wallet address
   * @returns Array of receivable IDs
   */
  async getExporterReceivables(exporterAddress: string): Promise<string[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const factory = this.getContract(
      novaxContractAddresses.RECEIVABLE_FACTORY,
      NovaxReceivableFactoryABI
    );

    try {
      console.log('📥 Fetching receivables for exporter:', exporterAddress);
      // Use the contract's built-in mapping - much more efficient than querying events!
      const receivableIds = await factory.getExporterReceivables(exporterAddress);
      console.log(`✅ Found ${receivableIds.length} receivables for exporter`);
      
      // Convert bytes32[] to string[]
      return receivableIds.map(id => typeof id === 'string' ? id : ethers.hexlify(id));
    } catch (error) {
      console.error('Error fetching exporter receivables:', error);
      throw new Error(`Failed to fetch exporter receivables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  // ==================== POOL MANAGER METHODS ====================

  /**
   * Create investment pool (AMC only)
   * @param poolType 0 = RWA, 1 = RECEIVABLE
   * @param assetId Asset ID or Receivable ID
   * @param targetAmount Target funding amount in USDC (6 decimals)
   * @param minInvestment Minimum investment in USDC (6 decimals)
   * @param maxInvestment Maximum investment per user in USDC (6 decimals)
   * @param apr Annual Percentage Rate in basis points (e.g., 1200 = 12%)
   * @param maturityDate Maturity date (Unix timestamp)
   * @param rewardPool NVX reward pool amount (18 decimals, optional, default 0)
   * @param tokenName Pool token name
   * @param tokenSymbol Pool token symbol
   */
  async createPool(
    poolType: number,
    assetId: string,
    targetAmount: bigint,
    minInvestment: bigint,
    maxInvestment: bigint,
    apr: number,
    maturityDate: number,
    rewardPool: bigint,
    tokenName: string,
    tokenSymbol: string
  ): Promise<{ poolId: string; txHash: string; poolToken: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const assetIdBytes32 = assetId.startsWith('0x') && assetId.length === 66
      ? assetId
      : ethers.id(assetId);

    console.log('🏊 Creating pool:', {
      poolType: poolType === 1 ? 'RECEIVABLE' : 'RWA',
      assetId: assetIdBytes32,
      targetAmount: ethers.formatUnits(targetAmount, 6),
      minInvestment: ethers.formatUnits(minInvestment, 6),
      maxInvestment: ethers.formatUnits(maxInvestment, 6),
      apr: apr / 100 + '%',
      maturityDate: new Date(maturityDate * 1000).toISOString(),
      rewardPool: ethers.formatUnits(rewardPool, 18),
    });

    const tx = await poolManager.createPool(
      poolType,
      assetIdBytes32,
      targetAmount,
      minInvestment,
      maxInvestment,
      apr,
      maturityDate,
      rewardPool,
      tokenName,
      tokenSymbol
    );

    const receipt = await waitForTransaction(tx, this.provider, 180);
    if (!receipt) {
      throw new Error('Transaction receipt not available');
    }

    // Parse event
    const eventLog = receipt.logs.find((log: any) => {
      try {
        const parsed = poolManager.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'PoolCreated';
      } catch {
        return false;
      }
    });

    if (!eventLog) {
      throw new Error('PoolCreated event not found');
    }

    const parsedEvent = poolManager.interface.parseLog({
      topics: eventLog.topics,
      data: eventLog.data,
    });

    const poolId = parsedEvent?.args[0] || eventLog.topics[1];
    const pool = await poolManager.getPool(poolId);
    const poolToken = pool.poolToken;

    return {
      poolId: typeof poolId === 'string' ? poolId : ethers.hexlify(poolId),
      txHash: receipt.hash,
      poolToken,
    };
  }

  /**
   * Invest in pool
   * @param poolId Pool ID
   * @param usdcAmount Investment amount in USDC (6 decimals)
   */
  async invest(poolId: string, usdcAmount: bigint): Promise<{ txHash: string; shares: bigint }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    // First, approve USDC spending
    const usdc = this.getContract(novaxContractAddresses.USDC, MockUSDCABI);
    const userAddress = await this.signer.getAddress();
    
    const allowance = await usdc.allowance(userAddress, novaxContractAddresses.POOL_MANAGER);
    if (allowance < usdcAmount) {
      console.log('📝 Approving USDC spending...');
      const approveTx = await usdc.approve(novaxContractAddresses.POOL_MANAGER, usdcAmount);
      await waitForTransaction(approveTx, this.provider, 180);
      console.log('✅ USDC approved');
    }

    // Invest in pool
    const tx = await poolManager.invest(poolIdBytes32, usdcAmount);
    const receipt = await waitForTransaction(tx, this.provider, 180);

    // Get shares from event or pool
    let shares = 0n;
    const eventLog = receipt.logs.find((log: any) => {
      try {
        const parsed = poolManager.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'InvestmentMade';
      } catch {
        return false;
      }
    });

    if (eventLog) {
      const parsedEvent = poolManager.interface.parseLog({
        topics: eventLog.topics,
        data: eventLog.data,
      });
      shares = parsedEvent?.args[3] || 0n; // sharesMinted
    } else {
      // Fallback: get user investment and calculate shares
      const userInvestment = await poolManager.getUserInvestment(poolIdBytes32, userAddress);
      const pool = await poolManager.getPool(poolIdBytes32);
      if (pool.totalShares > 0n && pool.totalInvested > 0n) {
        shares = (userInvestment * pool.totalShares) / pool.totalInvested;
      }
    }

    return {
      txHash: receipt.hash,
      shares,
    };
  }

  /**
   * Withdraw from pool
   */
  async withdraw(poolId: string, shares: bigint): Promise<{ txHash: string; usdcAmount: bigint }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    const tx = await poolManager.withdraw(poolIdBytes32, shares);
    const receipt = await tx.wait();

    // Get USDC amount from event
    let usdcAmount = 0n;
    const eventLog = receipt.logs.find((log: any) => {
      try {
        const parsed = poolManager.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'WithdrawalMade';
      } catch {
        return false;
      }
    });

    if (eventLog) {
      const parsedEvent = poolManager.interface.parseLog({
        topics: eventLog.topics,
        data: eventLog.data,
      });
      usdcAmount = parsedEvent?.args[2] || 0n; // usdcAmount
    }

    return {
      txHash: receipt.hash,
      usdcAmount,
    };
  }

  /**
   * Get pool details
   */
  async getPool(poolId: string): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    return await poolManager.getPool(poolIdBytes32);
  }

  /**
   * Get user investment in pool
   */
  async getUserInvestment(poolId: string, userAddress: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    return await poolManager.getUserInvestment(poolIdBytes32, userAddress);
  }

  /**
   * Record payment for a pool (AMC only)
   * @param poolId Pool ID
   * @param paymentAmount Payment amount in USDC (6 decimals)
   */
  async recordPayment(poolId: string, paymentAmount: bigint): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    console.log('💰 Recording payment:', {
      poolId: poolIdBytes32,
      paymentAmount: ethers.formatUnits(paymentAmount, 6),
    });

    const tx = await poolManager.recordPayment(poolIdBytes32, paymentAmount);
    const receipt = await waitForTransaction(tx, this.provider, 180);
    
    if (!receipt) {
      throw new Error('Transaction not confirmed. Please check the explorer.');
    }

    return { txHash: receipt.hash };
  }

  /**
   * Distribute yield (AMC only) - automatically calculates yield
   * @param poolId Pool ID
   */
  async distributeYield(poolId: string): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    // Ensure we're on Etherlink network before signing
    await this.ensureEtherlinkNetwork();

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    console.log('💰 Distributing yield for pool:', poolIdBytes32);

    const tx = await poolManager.distributeYield(poolIdBytes32);
    const receipt = await waitForTransaction(tx, this.provider, 180);
    
    if (!receipt) {
      throw new Error('Transaction not confirmed. Please check the explorer.');
    }

    return { txHash: receipt.hash };
  }

  /**
   * Get all pools using contract getter (much faster than querying events!)
   * Uses the allPools array from the contract
   * @returns Array of pool IDs
   */
  async getAllPools(): Promise<string[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    try {
      console.log('🔍 Fetching all pools using getPoolsPaginated()...');
      
      // Use getPoolsPaginated() - same as test scripts
      const [allPools] = await poolManager.getPoolsPaginated(0, 100);
      const poolIds = allPools.map((pool: any) => {
        const id = pool.id || pool.poolId;
        return typeof id === 'string' ? id : ethers.hexlify(id);
      });
      
      console.log(`✅ Found ${poolIds.length} pools using getPoolsPaginated()`);
      return poolIds;
    } catch (error) {
      console.error('Error fetching pools:', error);
      throw new Error(`Failed to fetch pools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pools by status using pagination and frontend filtering
   * @param status Pool status to filter
   * @returns Array of pools with the specified status
   */
  async getPoolsByStatus(status: number): Promise<any[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    try {
      const allPools: any[] = [];
      let offset = 0;
      const pageSize = 100;
      let total = 0;

      // Fetch all pools using pagination
      while (true) {
        const [pools, totalCount] = await poolManager.getPoolsPaginated(offset, pageSize);
        allPools.push(...pools);
        total = Number(totalCount);

        if (pools.length < pageSize || allPools.length >= total) {
          break;
        }
        offset += pageSize;
      }

      // Filter by status on frontend
      return allPools.filter((pool: any) => pool.status === status);
    } catch (error) {
      console.error('Error fetching pools by status:', error);
      throw new Error(`Failed to fetch pools by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pools that need payment recording (for AMC)
   * Uses getPoolsPaginated and filters on frontend
   * @returns Array of pools needing payment
   */
  async getPoolsNeedingPayment(): Promise<any[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    try {
      const allPools: any[] = [];
      let offset = 0;
      const pageSize = 100;
      let total = 0;

      // Fetch all pools using pagination
      while (true) {
        const [pools, totalCount] = await poolManager.getPoolsPaginated(offset, pageSize);
        allPools.push(...pools);
        total = Number(totalCount);

        if (pools.length < pageSize || allPools.length >= total) {
          break;
        }
        offset += pageSize;
      }

      // Filter: (status == FUNDED || status == MATURED) && paymentStatus != FULL
      // FUNDED = 1, MATURED = 2, FULL = 2
      return allPools.filter((pool: any) => 
        (pool.status === 1 || pool.status === 2) && pool.paymentStatus !== 2
      );
    } catch (error) {
      console.error('Error fetching pools needing payment:', error);
      throw new Error(`Failed to fetch pools needing payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pools ready for yield distribution (for Admin)
   * Uses getPoolsPaginated and filters on frontend
   * @returns Array of pools ready for yield
   */
  async getPoolsReadyForYield(): Promise<any[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolManager = this.getContract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI
    );

    try {
      const allPools: any[] = [];
      let offset = 0;
      const pageSize = 100;
      let total = 0;

      // Fetch all pools using pagination
      while (true) {
        const [pools, totalCount] = await poolManager.getPoolsPaginated(offset, pageSize);
        allPools.push(...pools);
        total = Number(totalCount);

        if (pools.length < pageSize || allPools.length >= total) {
          break;
        }
        offset += pageSize;
      }

      // Filter: status == PAID && paymentStatus == FULL
      // PAID = 3, FULL = 2
      return allPools.filter((pool: any) => 
        pool.status === 3 && pool.paymentStatus === 2
      );
    } catch (error) {
      console.error('Error fetching pools ready for yield:', error);
      throw new Error(`Failed to fetch pools ready for yield: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== MARKETPLACE METHODS ====================

  /**
   * Create marketplace listing
   */
  async createListing(
    poolToken: string,
    poolId: string,
    amount: bigint,
    pricePerToken: bigint,
    minPurchase: bigint,
    maxPurchase: bigint,
    deadline: number
  ): Promise<{ listingId: string; txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const marketplace = this.getContract(
      novaxContractAddresses.MARKETPLACE,
      NovaxMarketplaceABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    // Approve pool tokens
    const poolTokenContract = this.getContract(poolToken, PoolTokenABI);
    const userAddress = await this.signer.getAddress();
    
    const allowance = await poolTokenContract.allowance(userAddress, novaxContractAddresses.MARKETPLACE);
    if (allowance < amount) {
      const approveTx = await poolTokenContract.approve(novaxContractAddresses.MARKETPLACE, amount);
      await approveTx.wait();
    }

    const tx = await marketplace.createListing(
      poolToken,
      poolIdBytes32,
      amount,
      pricePerToken,
      minPurchase,
      maxPurchase,
      deadline
    );

    const receipt = await waitForTransaction(tx, this.provider, 180);
    if (!receipt) {
      throw new Error('Transaction receipt not available');
    }

    // Parse event
    const eventLog = receipt.logs.find((log: any) => {
      try {
        const parsed = marketplace.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'ListingCreated';
      } catch {
        return false;
      }
    });

    if (!eventLog) {
      throw new Error('ListingCreated event not found');
    }

    const parsedEvent = marketplace.interface.parseLog({
      topics: eventLog.topics,
      data: eventLog.data,
    });

    const listingId = parsedEvent?.args[0] || eventLog.topics[1];

    return {
      listingId: typeof listingId === 'string' ? listingId : ethers.hexlify(listingId),
      txHash: receipt.hash,
    };
  }

  /**
   * Buy tokens from marketplace
   */
  async buyTokens(listingId: string, amount: bigint): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const marketplace = this.getContract(
      novaxContractAddresses.MARKETPLACE,
      NovaxMarketplaceABI
    );

    const listingIdBytes32 = listingId.startsWith('0x') && listingId.length === 66
      ? listingId
      : ethers.id(listingId);

    // Get listing to calculate total price
    const listing = await marketplace.getListing(listingIdBytes32);
    const totalPrice = (amount * listing.pricePerToken) / ethers.parseUnits('1', 18);

    // Approve USDC
    const usdc = this.getContract(novaxContractAddresses.USDC, MockUSDCABI);
    const userAddress = await this.signer.getAddress();
    
    const allowance = await usdc.allowance(userAddress, novaxContractAddresses.MARKETPLACE);
    if (allowance < totalPrice) {
      const approveTx = await usdc.approve(novaxContractAddresses.MARKETPLACE, totalPrice);
      await approveTx.wait();
    }

    const tx = await marketplace.buyTokens(listingIdBytes32, amount);
    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }

  /**
   * Get marketplace listing
   */
  async getListing(listingId: string): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const marketplace = this.getContract(
      novaxContractAddresses.MARKETPLACE,
      NovaxMarketplaceABI
    );

    const listingIdBytes32 = listingId.startsWith('0x') && listingId.length === 66
      ? listingId
      : ethers.id(listingId);

    return await marketplace.getListing(listingIdBytes32);
  }

  /**
   * Get all listings for a pool
   */
  async getPoolListings(poolId: string): Promise<any[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const marketplace = this.getContract(
      novaxContractAddresses.MARKETPLACE,
      NovaxMarketplaceABI
    );

    const poolIdBytes32 = poolId.startsWith('0x') && poolId.length === 66
      ? poolId
      : ethers.id(poolId);

    const listingIds = await marketplace.getPoolListings(poolIdBytes32);
    const listings = [];

    for (const listingId of listingIds) {
      try {
        const listing = await marketplace.getListing(listingId);
        if (listing.active) {
          listings.push({
            listingId: listingId,
            ...listing,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch listing ${listingId}:`, error);
      }
    }

    return listings;
  }

  /**
   * Get user's listings
   */
  async getUserListings(userAddress: string): Promise<any[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const marketplace = this.getContract(
      novaxContractAddresses.MARKETPLACE,
      NovaxMarketplaceABI
    );

    const listingIds = await marketplace.getUserListings(userAddress);
    const listings = [];

    for (const listingId of listingIds) {
      try {
        const listing = await marketplace.getListing(listingId);
        listings.push({
          listingId: listingId,
          ...listing,
        });
      } catch (error) {
        console.warn(`Failed to fetch listing ${listingId}:`, error);
      }
    }

    return listings;
  }

  /**
   * Cancel marketplace listing
   */
  async cancelListing(listingId: string): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const marketplace = this.getContract(
      novaxContractAddresses.MARKETPLACE,
      NovaxMarketplaceABI
    );

    const listingIdBytes32 = listingId.startsWith('0x') && listingId.length === 66
      ? listingId
      : ethers.id(listingId);

    const tx = await marketplace.cancelListing(listingIdBytes32);
    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }

  // ==================== TOKEN METHODS ====================

  /**
   * Get USDC balance
   */
  async getUSDCBalance(address: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const usdc = this.getContract(novaxContractAddresses.USDC, MockUSDCABI);
    return await usdc.balanceOf(address);
  }

  /**
   * Approve USDC spending
   */
  async approveUSDC(spender: string, amount: bigint): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const usdc = this.getContract(novaxContractAddresses.USDC, MockUSDCABI);
    const tx = await usdc.approve(spender, amount);
    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }

  /**
   * Get PoolToken balance
   */
  async getPoolTokenBalance(poolToken: string, address: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const poolTokenContract = this.getContract(poolToken, PoolTokenABI);
    return await poolTokenContract.balanceOf(address);
  }

  /**
   * Get native token (XTZ) balance for gas
   */
  async getXTZBalance(address?: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    let walletAddress: string;
    if (address) {
      walletAddress = address;
    } else if (this.signer) {
      walletAddress = await this.signer.getAddress();
    } else {
      throw new Error('Signer not initialized and no address provided');
    }

    return await this.provider.getBalance(walletAddress);
  }

  /**
   * Get NVX token balance
   */
  async getNVXBalance(address: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized. Please call initialize() first.');
    }

    try {
      const nvxToken = this.getContract(novaxContractAddresses.NVX_TOKEN, NVXTokenABI);
      return await nvxToken.balanceOf(address);
    } catch (error: any) {
      // If contract not deployed or wrong address, return 0
      if (error.code === 'BAD_DATA' || error.message?.includes('decode') || error.message?.includes('0x')) {
        console.warn('NVX token contract may not be deployed or ABI mismatch');
        return BigInt(0);
      }
      throw error;
    }
  }

  /**
   * Approve NVX token spending
   */
  async approveNVX(spender: string, amount: bigint): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Please connect wallet first.');
    }

    const nvxToken = this.getContract(novaxContractAddresses.NVX_TOKEN, NVXTokenABI);
    const tx = await nvxToken.approve(spender, amount);
    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }
}

// Export singleton instance
export const novaxContractService = new NovaxContractService();

