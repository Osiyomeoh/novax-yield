import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';

// Load full ABI from compiled contract artifacts
let CoreAssetFactoryABI: any[] = [];
try {
  const artifactPath = path.join(__dirname, '../../contracts/artifacts/contracts/CoreAssetFactory.sol/CoreAssetFactory.json');
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    CoreAssetFactoryABI = artifact.abi;
  } else {
    // Fallback to minimal ABI if artifact not found
    throw new Error('Artifact not found');
  }
} catch (error) {
  // Fallback to minimal ABI if loading fails (should not happen in production)
  CoreAssetFactoryABI = [
    'function createRWAAsset(uint8,string,string,string,uint256,uint256,uint256,string[],string[],string,string,string) external returns (bytes32)',
    'function createDigitalAsset(uint8,string,string,string,uint256,string,string,uint256) external returns (bytes32)',
    'function getAsset(bytes32) external view returns (bytes32,address,address,uint8,uint8,string,string,string,uint256,uint256,uint256,uint8,string[],string[],string,string,string,address,uint256,uint8,address,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256,uint256,address,uint256)',
    'function verifyAsset(bytes32,uint8) external',
    'event AssetCreated(bytes32 indexed,address indexed,uint8,string,string,uint256,uint8)',
  ];
}

const PoolManagerABI = [
  'function createPool(string,string,uint256,uint256) external returns (bytes32)',
  'function createPoolWithTranches(string,string,uint256,uint256,uint256,uint256,uint256,string,string) external returns (bytes32,bytes32,bytes32)',
  'function investInPool(bytes32,uint256) external',
  'function investInTranche(bytes32,bytes32,uint256) external',
  'function addAssetToPool(bytes32,bytes32) external',
  'function getPool(bytes32) external view returns (bytes32,address,string,string,uint256,uint256,uint256,uint256,bool,bool,uint256,bytes32[],bytes32[])',
  'function getTranche(bytes32) external view returns (bytes32,uint8,string,address,uint256,uint256,uint256,uint256,bool)',
  'function getUserShares(bytes32,address) external view returns (uint256)',
  'function getUserInvestment(bytes32,address) external view returns (uint256)',
  'function getUserTrancheShares(bytes32,address) external view returns (uint256)',
  'function getUserTrancheInvestment(bytes32,address) external view returns (uint256)',
  'event PoolCreated(bytes32 indexed,address indexed,string,uint256)',
  'event TrancheCreated(bytes32 indexed,bytes32 indexed,uint8,address)',
  'event PoolTokenIssued(bytes32 indexed,address indexed,uint256)',
  'event TrancheTokenIssued(bytes32 indexed,bytes32 indexed,address indexed,uint256)',
];

const TrustTokenABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function transfer(address,uint256) external returns (bool)',
  'function approve(address,uint256) external returns (bool)',
  'function allowance(address,address) external view returns (uint256)',
];

const AssetNFTABI = [
  'event AssetMinted(uint256 indexed,address indexed,bytes32)',
];

const TRUSTMarketplaceABI = [
  'function listAsset(address,uint256,uint256,uint256) external returns (uint256)',
  'function buyAsset(uint256) external',
  'function cancelListing(uint256) external',
  'function makeOffer(uint256,uint256,uint256) external',
  'function acceptOffer(uint256,address) external',
  'function getListing(uint256) external view returns (tuple)',
  'function getOffer(uint256,address) external view returns (tuple)',
  'event AssetListed(uint256 indexed,address indexed,address indexed,uint256,uint256)',
  'event AssetSold(uint256 indexed,address indexed,address indexed,uint256)',
];

export interface MantleConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  contractAddresses: {
    trustToken: string;
    assetNFT: string;
    coreAssetFactory: string;
    trustAssetFactory: string;
    poolManager: string;
    verificationRegistry: string;
    trustMarketplace: string;
    trustFaucet: string;
    amcManager: string;
  };
}

export interface CreateRWAAssetParams {
  category: number; // AssetCategory enum
  assetTypeString: string;
  name: string;
  location: string;
  totalValue: bigint;
  maturityDate: bigint;
  maxInvestablePercentage?: number; // Maximum percentage that can be tokenized (0-100, default: 100)
  evidenceHashes: string[];
  documentTypes: string[];
  imageURI: string;
  documentURI: string;
  description: string;
}

export interface CreateDigitalAssetParams {
  category: number;
  assetTypeString: string;
  name: string;
  location: string;
  totalValue: bigint;
  imageURI: string;
  description: string;
  royaltyPercentage: number;
}

export interface CreatePoolParams {
  name: string;
  description: string;
  managementFee: number; // basis points
  performanceFee: number; // basis points
}

export interface CreatePoolWithTranchesParams extends CreatePoolParams {
  seniorPercentage: number; // basis points (e.g., 7000 = 70%)
  seniorAPY: number; // basis points (e.g., 800 = 8%)
  juniorAPY: number; // basis points (e.g., 1500 = 15%)
  seniorSymbol: string;
  juniorSymbol: string;
}

export interface InvestInPoolParams {
  poolId: string;
  amount: bigint; // TRUST tokens
}

export interface InvestInTrancheParams {
  poolId: string;
  trancheId: string;
  amount: bigint; // TRUST tokens
}

@Injectable()
export class MantleService {
  private readonly logger = new Logger(MantleService.name);
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private config: MantleConfig;

  // Contract instances
  private trustToken: ethers.Contract;
  private assetNFT: ethers.Contract;
  private coreAssetFactory: any; // Using any to handle tuple returns
  private trustAssetFactory: ethers.Contract;
  private poolManager: ethers.Contract | null = null;
  private verificationRegistry: ethers.Contract;
  private trustMarketplace: ethers.Contract;

  constructor(private configService: ConfigService) {
    // Initialize synchronously - contract setup doesn't need await
    this.initialize();
  }

  private initialize() {
    try {
      // Load configuration
      this.config = {
        rpcUrl: this.configService.get<string>('MANTLE_RPC_URL') || 'https://rpc.sepolia.mantle.xyz',
        chainId: parseInt(this.configService.get<string>('MANTLE_CHAIN_ID') || '5001'),
        privateKey: this.configService.get<string>('MANTLE_PRIVATE_KEY') || '',
        contractAddresses: {
          // Updated to match mantle-sepolia-latest.json deployment (2026-01-14)
          trustToken: this.configService.get<string>('TRUST_TOKEN_ADDRESS') || '0x239e59B9E6d2257CA68a3cb6509E7EBc54c90546',
          assetNFT: this.configService.get<string>('ASSET_NFT_ADDRESS') || '0x2Eb2533fcc327CdF670200683A7CEa14b6bA8edb',
          coreAssetFactory: this.configService.get<string>('CORE_ASSET_FACTORY_ADDRESS') || '0x546d33A647Efa9fd363a908741803bF75302e7D0',
          trustAssetFactory: this.configService.get<string>('TRUST_ASSET_FACTORY_ADDRESS') || '0x55cdfcA8f6ac9C848A6EB8Df45F285db3a03276a',
          poolManager: this.configService.get<string>('POOL_MANAGER_ADDRESS') || '0x06bb375127a9D3cBA7aAE9C108078bf31A67ab80',
          verificationRegistry: this.configService.get<string>('VERIFICATION_REGISTRY_ADDRESS') || '0x875153894Fc3a7C3D6f6e2d383Aad09ad5bb5204',
          trustMarketplace: this.configService.get<string>('TRUST_MARKETPLACE_ADDRESS') || '0x64bd7B3ecF990915416C7bd2152798bFEea19AB7',
          trustFaucet: this.configService.get<string>('TRUST_FAUCET_ADDRESS') || '0x0CB9218389C0718144395B218532362d9F990264',
          amcManager: this.configService.get<string>('AMC_MANAGER_ADDRESS') || '0xC26f729De8f88e4E59846715f622a1C56334a565',
        },
      };

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

      // Initialize signer (if private key provided)
      if (this.config.privateKey) {
        this.signer = new ethers.Wallet(this.config.privateKey, this.provider);
        // Get address asynchronously (getAddress() is async in ethers v6)
        this.signer.getAddress().then(address => {
          this.logger.log(`MantleService initialized with signer: ${address}`);
        }).catch(err => {
          this.logger.warn(`MantleService initialized but could not get signer address: ${err.message}`);
        });
      } else {
        this.logger.warn('No private key provided - MantleService initialized in read-only mode');
      }

      // Initialize contract instances
      this.trustToken = new ethers.Contract(
        this.config.contractAddresses.trustToken,
        TrustTokenABI,
        this.provider
      );

      this.assetNFT = new ethers.Contract(
        this.config.contractAddresses.assetNFT,
        AssetNFTABI,
        this.provider
      );

      this.coreAssetFactory = new ethers.Contract(
        this.config.contractAddresses.coreAssetFactory,
        CoreAssetFactoryABI,
        this.provider
      );

      this.trustAssetFactory = new ethers.Contract(
        this.config.contractAddresses.trustAssetFactory,
        CoreAssetFactoryABI, // Same ABI as CoreAssetFactory
        this.provider
      );

      // Initialize PoolManager contract with full ABI
      if (this.config.contractAddresses.poolManager) {
        this.poolManager = new ethers.Contract(
          this.config.contractAddresses.poolManager,
          PoolManagerABI,
          this.provider
        );
        this.logger.log(`✅ PoolManager initialized at ${this.config.contractAddresses.poolManager}`);
      } else {
        this.logger.warn('⚠️ POOL_MANAGER_ADDRESS not configured');
      }

      this.trustMarketplace = new ethers.Contract(
        this.config.contractAddresses.trustMarketplace,
        TRUSTMarketplaceABI,
        this.provider
      );

      this.logger.log('MantleService initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize MantleService: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a contract instance with signer
   */
  private getContractWithSigner(address: string, abi: any): ethers.Contract {
    if (!this.signer) {
      throw new Error('No signer available - cannot execute transactions');
    }
    return new ethers.Contract(address, abi, this.signer) as any;
  }

  /**
   * Create RWA asset
   */
  async createRWAAsset(params: CreateRWAAssetParams, ownerAddress: string): Promise<{ assetId: string; txHash: string }> {
    try {
      // Get signer for the owner
      const ownerSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(ownerAddress),
        this.provider
      );

      const factory = this.getContractWithSigner(
        this.config.contractAddresses.coreAssetFactory,
        CoreAssetFactoryABI
      ).connect(ownerSigner) as any;

      // Approve TRUST tokens first (100 TRUST minimum fee)
      const trustToken = this.getContractWithSigner(
        this.config.contractAddresses.trustToken,
        TrustTokenABI
      ).connect(ownerSigner) as any;

      const creationFee = ethers.parseEther('100'); // 100 TRUST tokens
      
      // Check balance
      const balance = await trustToken.balanceOf(ownerAddress);
      if (balance < creationFee) {
        throw new Error(`Insufficient TRUST tokens. Need ${ethers.formatEther(creationFee)} TRUST, have ${ethers.formatEther(balance)}`);
      }

      // Approve and transfer
      const approveTx = await trustToken.approve(this.config.contractAddresses.coreAssetFactory, creationFee);
      await approveTx.wait();

      const transferTx = await trustToken.transfer(this.config.contractAddresses.coreAssetFactory, creationFee);
      await transferTx.wait();

      // Create RWA asset
      const tx = await factory.createRWAAsset(
        params.category,
        params.assetTypeString,
        params.name,
        params.location,
        params.totalValue,
        params.maturityDate,
        params.maxInvestablePercentage || 100, // Default to 100% if not provided
        params.evidenceHashes,
        params.documentTypes,
        params.imageURI,
        params.documentURI,
        params.description
      );

      const receipt = await tx.wait();

      // Extract assetId from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === 'AssetCreated';
        } catch {
          return false;
        }
      });

      if (!event) {
        throw new Error('AssetCreated event not found in transaction receipt');
      }

      const parsedEvent = factory.interface.parseLog(event);
      const assetId = parsedEvent?.args[0]; // First argument is assetId (bytes32)

      this.logger.log(`Created RWA asset: ${assetId}, tx: ${receipt.hash}`);

      return {
        assetId: assetId,
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to create RWA asset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create digital asset
   */
  async createDigitalAsset(params: CreateDigitalAssetParams, ownerAddress: string): Promise<{ assetId: string; tokenId: bigint; txHash: string }> {
    try {
      const ownerSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(ownerAddress),
        this.provider
      );

      const factory = this.getContractWithSigner(
        this.config.contractAddresses.coreAssetFactory,
        CoreAssetFactoryABI
      ).connect(ownerSigner) as any;

      const trustToken = this.getContractWithSigner(
        this.config.contractAddresses.trustToken,
        TrustTokenABI
      ).connect(ownerSigner) as any;

      const creationFee = ethers.parseEther('10'); // 10 TRUST tokens for digital assets

      // Approve and transfer
      const approveTx = await trustToken.approve(this.config.contractAddresses.coreAssetFactory, creationFee);
      await approveTx.wait();

      const transferTx = await trustToken.transfer(this.config.contractAddresses.coreAssetFactory, creationFee);
      await transferTx.wait();

      // Create digital asset
      const tx = await factory.createDigitalAsset(
        params.category,
        params.assetTypeString,
        params.name,
        params.location,
        params.totalValue,
        params.imageURI,
        params.description,
        params.royaltyPercentage
      );

      const receipt = await tx.wait();

      // Extract assetId and tokenId from events
      const assetCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === 'AssetCreated';
        } catch {
          return false;
        }
      });

      const assetMintedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.assetNFT.interface.parseLog(log);
          return parsed?.name === 'AssetMinted';
        } catch {
          return false;
        }
      });

      if (!assetCreatedEvent || !assetMintedEvent) {
        throw new Error('Required events not found in transaction receipt');
      }

      const parsedAssetEvent = factory.interface.parseLog(assetCreatedEvent);
      const parsedMintEvent = this.assetNFT.interface.parseLog(assetMintedEvent);

      const assetId = parsedAssetEvent?.args[0];
      const tokenId = parsedMintEvent?.args[0]; // tokenId from AssetMinted event

      this.logger.log(`Created digital asset: ${assetId}, tokenId: ${tokenId}, tx: ${receipt.hash}`);

      return {
        assetId: assetId,
        tokenId: tokenId,
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to create digital asset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create pool
   */
  async createPool(params: CreatePoolParams, amcAddress: string): Promise<{ poolId: string; txHash: string }> {
    try {
      const amcSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(amcAddress),
        this.provider
      );

      const poolManager = this.getContractWithSigner(
        this.config.contractAddresses.poolManager,
        PoolManagerABI
      ).connect(amcSigner) as any;

      const tx = await poolManager.createPool(
        params.name,
        params.description,
        params.managementFee,
        params.performanceFee
      );

      const receipt = await tx.wait();

      // Extract poolId from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = poolManager.interface.parseLog(log);
          return parsed?.name === 'PoolCreated';
        } catch {
          return false;
        }
      });

      if (!event) {
        throw new Error('PoolCreated event not found');
      }

      const parsedEvent = poolManager.interface.parseLog(event);
      const poolId = parsedEvent?.args[0]; // poolId

      this.logger.log(`Created pool: ${poolId}, tx: ${receipt.hash}`);

      return {
        poolId: poolId,
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to create pool: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create pool with tranches
   */
  async createPoolWithTranches(params: CreatePoolWithTranchesParams, amcAddress: string): Promise<{
    poolId: string;
    seniorTrancheId: string;
    juniorTrancheId: string;
    txHash: string;
  }> {
    try {
      const amcSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(amcAddress),
        this.provider
      );

      const poolManager = this.getContractWithSigner(
        this.config.contractAddresses.poolManager,
        PoolManagerABI
      ).connect(amcSigner) as any;

      const tx = await poolManager.createPoolWithTranches(
        params.name,
        params.description,
        params.managementFee,
        params.performanceFee,
        params.seniorPercentage,
        params.seniorAPY,
        params.juniorAPY,
        params.seniorSymbol,
        params.juniorSymbol
      );

      const receipt = await tx.wait();

      // Extract poolId and tranche IDs from events
      const poolCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = poolManager.interface.parseLog(log);
          return parsed?.name === 'PoolCreated';
        } catch {
          return false;
        }
      });

      const trancheEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = poolManager.interface.parseLog(log);
          return parsed?.name === 'TrancheCreated';
        } catch {
          return false;
        }
      });

      if (!poolCreatedEvent || trancheEvents.length !== 2) {
        throw new Error(`Required events not found. PoolCreated: ${!!poolCreatedEvent}, TrancheEvents: ${trancheEvents.length}`);
      }

      const parsedPoolEvent = poolManager.interface.parseLog(poolCreatedEvent);
      const poolId = parsedPoolEvent?.args[0];

      // Parse all tranche events and log their details for debugging
      const parsedTrancheEvents = trancheEvents.map((log: any) => {
        try {
          const parsed = poolManager.interface.parseLog(log);
          return {
            log,
            parsed,
            trancheType: parsed?.args[2],
            trancheId: parsed?.args[1],
          };
        } catch (error) {
          this.logger.error(`Failed to parse tranche event: ${error.message}`);
          return null;
        }
      }).filter((item: any) => item !== null);

      // Log parsed tranche events (convert BigInt to string for JSON serialization)
      const trancheEventsSummary = parsedTrancheEvents.map((e: any) => ({
        trancheType: typeof e.trancheType === 'bigint' ? Number(e.trancheType) : e.trancheType,
        trancheId: typeof e.trancheId === 'bigint' ? e.trancheId.toString() : e.trancheId,
      }));
      this.logger.log(`Found ${parsedTrancheEvents.length} parsed tranche events: ${JSON.stringify(trancheEventsSummary)}`);

      // Find senior and junior tranches by TrancheType (0 = SENIOR, 1 = JUNIOR)
      const seniorTranche = parsedTrancheEvents.find((item: any) => {
        const trancheType = typeof item.parsed.args[2] === 'bigint' ? Number(item.parsed.args[2]) : Number(item.parsed.args[2] || 0);
        return trancheType === 0; // TrancheType.SENIOR = 0
      });

      const juniorTranche = parsedTrancheEvents.find((item: any) => {
        const trancheType = typeof item.parsed.args[2] === 'bigint' ? Number(item.parsed.args[2]) : Number(item.parsed.args[2] || 1);
        return trancheType === 1; // TrancheType.JUNIOR = 1
      });

      if (!seniorTranche || !juniorTranche) {
        this.logger.error(`Tranche events parsing failed. Found ${parsedTrancheEvents.length} parsed events. Senior: ${!!seniorTranche}, Junior: ${!!juniorTranche}`);
        const trancheTypes = parsedTrancheEvents.map((e: any) => {
          const type = typeof e.trancheType === 'bigint' ? Number(e.trancheType) : e.trancheType;
          return type;
        });
        this.logger.error(`Tranche types found: ${trancheTypes.join(', ')}`);
        throw new Error(`Tranche events not found. Found ${trancheEvents.length} tranche events, but senior or junior is missing.`);
      }

      const parsedSenior = seniorTranche.parsed;
      const parsedJunior = juniorTranche.parsed;

      this.logger.log(`Created pool with tranches: ${poolId}, tx: ${receipt.hash}`);

      return {
        poolId: poolId,
        seniorTrancheId: parsedSenior?.args[1], // trancheId
        juniorTrancheId: parsedJunior?.args[1], // trancheId
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to create pool with tranches: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invest in pool
   */
  async investInPool(params: InvestInPoolParams, investorAddress: string): Promise<{ txHash: string; tokensReceived: bigint }> {
    try {
      const investorSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(investorAddress),
        this.provider
      );

      const poolManager = this.getContractWithSigner(
        this.config.contractAddresses.poolManager,
        PoolManagerABI
      ).connect(investorSigner) as any;

      const trustToken = this.getContractWithSigner(
        this.config.contractAddresses.trustToken,
        TrustTokenABI
      ).connect(investorSigner) as any;

      // Approve TRUST tokens
      const approveTx = await trustToken.approve(this.config.contractAddresses.poolManager, params.amount);
      await approveTx.wait();

      // Invest
      const tx = await poolManager.investInPool(params.poolId, params.amount);
      const receipt = await tx.wait();

      // Extract tokens received from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = poolManager.interface.parseLog(log);
          return parsed?.name === 'PoolTokenIssued';
        } catch {
          return false;
        }
      });

      const tokensReceived = event
        ? poolManager.interface.parseLog(event)?.args[2] // amount
        : BigInt(0);

      this.logger.log(`Invested in pool: ${params.poolId}, tokens: ${tokensReceived}, tx: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        tokensReceived: tokensReceived,
      };
    } catch (error) {
      this.logger.error(`Failed to invest in pool: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invest in tranche
   */
  async investInTranche(params: InvestInTrancheParams, investorAddress: string): Promise<{ txHash: string; tokensReceived: bigint }> {
    try {
      const investorSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(investorAddress),
        this.provider
      );

      const poolManager = this.getContractWithSigner(
        this.config.contractAddresses.poolManager,
        PoolManagerABI
      ).connect(investorSigner) as any;

      const trustToken = this.getContractWithSigner(
        this.config.contractAddresses.trustToken,
        TrustTokenABI
      ).connect(investorSigner) as any;

      // Approve TRUST tokens
      const approveTx = await trustToken.approve(this.config.contractAddresses.poolManager, params.amount);
      await approveTx.wait();

      // Invest in tranche
      const tx = await poolManager.investInTranche(params.poolId, params.trancheId, params.amount);
      const receipt = await tx.wait();

      // Extract tokens received from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = poolManager.interface.parseLog(log);
          return parsed?.name === 'TrancheTokenIssued';
        } catch {
          return false;
        }
      });

      const tokensReceived = event
        ? poolManager.interface.parseLog(event)?.args[3] // amount
        : BigInt(0);

      this.logger.log(`Invested in tranche: ${params.trancheId}, tokens: ${tokensReceived}, tx: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        tokensReceived: tokensReceived,
      };
    } catch (error) {
      this.logger.error(`Failed to invest in tranche: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get asset details
   * Uses Contract instance for automatic struct decoding (like frontend)
   */
  async getAsset(assetId: string): Promise<any> {
    try {
      // Convert assetId to bytes32 if needed
      let assetIdBytes32: string;
      if (assetId.startsWith('0x') && assetId.length === 66) {
        assetIdBytes32 = assetId;
      } else if (assetId.startsWith('0x') && assetId.length < 66) {
        assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
      } else {
        assetIdBytes32 = ethers.id(assetId);
      }
      
      this.logger.log(`🔍 Fetching asset: ${assetId} -> bytes32: ${assetIdBytes32}`);
      
      // Use Contract instance for automatic struct decoding (same as frontend)
      // This is more reliable than manual encoding/decoding
      const factoryContract = new ethers.Contract(
        this.config.contractAddresses.coreAssetFactory,
        CoreAssetFactoryABI,
        this.provider
      );
      
      // Call getAsset() - ethers will automatically decode the struct
      let assetResult: any;
      try {
        assetResult = await factoryContract.getAsset(assetIdBytes32);
        this.logger.log(`✅ getAsset() succeeded for ${assetIdBytes32}`);
      } catch (getAssetError: any) {
        // Check if asset doesn't exist (zero ID) or if there's a decode error
        if (getAssetError.message?.includes('could not decode') || 
            getAssetError.message?.includes('BAD_DATA') ||
            getAssetError.code === 'BAD_DATA') {
          // This might mean the asset doesn't exist or ABI mismatch
          // Try to check if asset exists by checking for zero ID
          this.logger.error(`❌ Failed to decode asset result for ${assetIdBytes32}: ${getAssetError.message}`);
          this.logger.error(`   This usually means the asset doesn't exist or there's an ABI mismatch`);
          throw new Error(`Asset ${assetIdBytes32} not found or could not be decoded. The asset may not exist on-chain or the contract ABI may be outdated.`);
        }
        // For other errors, re-throw with context
        this.logger.error(`❌ getAsset() failed for ${assetIdBytes32}: ${getAssetError.message}`);
        throw new Error(`Failed to fetch asset ${assetIdBytes32}: ${getAssetError.message}`);
      }
      
      // Log raw result for debugging
      this.logger.log(`📦 Raw asset result for ${assetId}:`, {
        hasStatus: assetResult.status !== undefined,
        statusValue: assetResult.status,
        statusType: typeof assetResult.status,
        statusIndex19: assetResult[19],
        statusIndex19Type: typeof assetResult[19],
        hasId: assetResult.id !== undefined,
        idValue: assetResult.id,
        isArray: Array.isArray(assetResult),
        resultKeys: Object.keys(assetResult || {}).slice(0, 20), // First 20 keys
        resultLength: Array.isArray(assetResult) ? assetResult.length : 'N/A',
        // Log all numeric indices that might contain status
        indices: Array.isArray(assetResult) ? {
          '[18]': assetResult[18],
          '[19]': assetResult[19],
          '[20]': assetResult[20]
        } : 'Not an array'
      });
      
      // Extract fields from the decoded struct
      // In ethers v6, structs are returned as objects with named properties
      const asset: any = {
        id: assetResult.id || assetResult[0] || assetIdBytes32,
        originalOwner: assetResult.originalOwner || assetResult[1] || '',
        currentOwner: assetResult.currentOwner || assetResult[2] || '',
        category: typeof assetResult.category === 'bigint' ? Number(assetResult.category) : (assetResult[3] || 0),
        assetType: typeof assetResult.assetType === 'bigint' ? Number(assetResult.assetType) : (assetResult[4] || 0),
        assetTypeString: assetResult.assetTypeString || assetResult[5] || '',
        name: assetResult.name || assetResult[6] || '',
        location: assetResult.location || assetResult[7] || '',
        totalValue: assetResult.totalValue || assetResult[8] || 0n,
        maturityDate: assetResult.maturityDate || assetResult[9] || 0n,
        maxInvestablePercentage: assetResult.maxInvestablePercentage !== undefined ? Number(assetResult.maxInvestablePercentage) : (assetResult[10] !== undefined ? Number(assetResult[10]) : 100),
        verificationLevel: typeof assetResult.verificationLevel === 'bigint' ? Number(assetResult.verificationLevel) : (assetResult[11] || 0),
        evidenceHashes: assetResult.evidenceHashes || assetResult[12] || [],
        documentTypes: assetResult.documentTypes || assetResult[13] || [],
        imageURI: assetResult.imageURI || assetResult[14] || '',
        documentURI: assetResult.documentURI || assetResult[15] || '',
        description: assetResult.description || assetResult[16] || '',
        nftContract: assetResult.nftContract || assetResult[17] || '',
        tokenId: assetResult.tokenId || assetResult[18] || 0n,
        // Status is at index 19 in the struct (after tokenId at 18)
        // Try named property first, then array indices 17, 18, 19 (in case of struct order mismatch)
        status: (() => {
          // First try named property (most reliable)
          if (assetResult.status !== undefined && assetResult.status !== null) {
            if (typeof assetResult.status === 'bigint') return Number(assetResult.status);
            if (typeof assetResult.status === 'number') return assetResult.status;
            if (typeof assetResult.status === 'string') return parseInt(assetResult.status, 10);
          }
          // Try index 19 (correct position according to struct)
          if (assetResult[19] !== undefined && assetResult[19] !== null) {
            if (typeof assetResult[19] === 'bigint') return Number(assetResult[19]);
            if (typeof assetResult[19] === 'number') return assetResult[19];
            if (typeof assetResult[19] === 'string') return parseInt(assetResult[19], 10);
          }
          // Try index 17 (frontend uses this - might be old struct or different ABI)
          if (assetResult[17] !== undefined && assetResult[17] !== null) {
            const val17 = assetResult[17];
            // Check if it's a valid status (0-10) and not an address (nftContract should be at 17)
            if (typeof val17 === 'bigint' && val17 <= 10n) {
              this.logger.warn(`⚠️ Using index 17 for status (might be wrong struct order): ${val17}`);
              return Number(val17);
            }
            if (typeof val17 === 'number' && val17 <= 10) {
              this.logger.warn(`⚠️ Using index 17 for status (might be wrong struct order): ${val17}`);
              return val17;
            }
          }
          // If all fail, log warning and return 0
          this.logger.warn(`⚠️ Could not extract status for asset ${assetId}. assetResult.status=${assetResult.status}, assetResult[17]=${assetResult[17]}, assetResult[19]=${assetResult[19]}`);
          return 0;
        })(),
        currentAMC: assetResult.currentAMC || assetResult[20] || '',
        createdAt: assetResult.createdAt || assetResult[21] || 0n,
        verifiedAt: assetResult.verifiedAt || assetResult[22] || 0n,
        amcTransferredAt: assetResult.amcTransferredAt || assetResult[23] || 0n,
        tradingVolume: assetResult.tradingVolume || assetResult[24] || 0n,
        lastSalePrice: assetResult.lastSalePrice || assetResult[25] || 0n,
        isTradeable: assetResult.isTradeable !== undefined ? assetResult.isTradeable : (assetResult[26] || false),
        isListed: assetResult.isListed !== undefined ? assetResult.isListed : (assetResult[27] || false),
        listingPrice: assetResult.listingPrice || assetResult[28] || 0n,
        listingExpiry: assetResult.listingExpiry || assetResult[29] || 0n,
        currentBuyer: assetResult.currentBuyer || assetResult[30] || '',
        currentOffer: assetResult.currentOffer || assetResult[31] || 0n,
        // Metadata (stored off-chain in database, but accessible via asset lookup)
        metadata: assetResult.metadata || {},
      };
      
      // Ensure status is a number (critical for validation)
      // Status should already be a number from the extraction above, but double-check
      if (typeof asset.status === 'bigint') {
        asset.status = Number(asset.status);
      } else if (typeof asset.status === 'string') {
        asset.status = parseInt(asset.status, 10);
      } else if (asset.status === null || asset.status === undefined) {
        // Try to extract from raw result again
        this.logger.warn(`Asset ${assetId} status is null/undefined, attempting re-extraction...`);
        if (assetResult.status !== undefined) {
          asset.status = typeof assetResult.status === 'bigint' ? Number(assetResult.status) : Number(assetResult.status || 0);
        } else if (assetResult[19] !== undefined) {
          asset.status = typeof assetResult[19] === 'bigint' ? Number(assetResult[19]) : Number(assetResult[19] || 0);
        }
      }
      
      // Final validation
      if (isNaN(asset.status) || asset.status === null || asset.status === undefined) {
        this.logger.error(`❌ Asset ${assetId} status is invalid after extraction: ${asset.status}`);
        this.logger.error(`   Raw assetResult.status: ${assetResult.status}, type: ${typeof assetResult.status}`);
        this.logger.error(`   Raw assetResult[19]: ${assetResult[19]}, type: ${typeof assetResult[19]}`);
        this.logger.error(`   Asset ID from result: ${asset.id || assetResult.id || assetResult[0]}`);
        this.logger.error(`   Full assetResult keys: ${Object.keys(assetResult || {}).join(', ')}`);
        
        // Check if asset exists (if id is zero or empty, asset doesn't exist)
        const assetIdFromResult = asset.id || assetResult.id || assetResult[0];
        if (!assetIdFromResult || assetIdFromResult === ethers.ZeroHash || assetIdFromResult === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          throw new Error(`Asset ${assetId} (bytes32: ${assetIdBytes32}) not found on blockchain. Asset ID from contract is zero/empty.`);
        }
        
        // If asset exists but status is invalid, this is a parsing issue
        this.logger.error(`⚠️ Asset exists but status extraction failed. Using fallback: 0`);
        asset.status = 0; // Default fallback - but this will cause validation to fail
      }
      
      this.logger.log(`✅ Asset ${assetId} fetched successfully: status=${asset.status} (${typeof asset.status}), name=${asset.name}`);
      
      this.logger.log(`Retrieved asset ${assetId} - status: ${asset.status}, name: ${asset.name}`);
      return asset;
    } catch (error) {
      this.logger.error(`Failed to get asset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pool details
   */
  async getPool(poolId: string): Promise<any> {
    try {
      // Ensure poolManager is initialized
      if (!this.poolManager) {
        this.logger.error('PoolManager contract not initialized');
        throw new Error('PoolManager contract not initialized');
      }

      // Check if getPool method exists
      if (!this.poolManager.getPool || typeof this.poolManager.getPool !== 'function') {
        this.logger.error('getPool method not found on PoolManager contract');
        // Try to recreate the contract instance
        this.poolManager = new ethers.Contract(
          this.config.contractAddresses.poolManager,
          PoolManagerABI,
          this.provider
        );
      }

      const pool = await this.poolManager.getPool(poolId);
      return pool;
    } catch (error: any) {
      this.logger.error(`Failed to get pool: ${error.message}`);
      // Re-throw with more context
      if (error.message?.includes('not a function')) {
        throw new Error(`PoolManager.getPool is not available. Contract address: ${this.config.contractAddresses.poolManager}. Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Verify asset
   */
  async verifyAsset(assetId: string, verificationLevel: number, verifierAddress: string): Promise<{ txHash: string }> {
    try {
      const verifierSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(verifierAddress),
        this.provider
      );

      const factory = this.getContractWithSigner(
        this.config.contractAddresses.coreAssetFactory,
        CoreAssetFactoryABI
      ).connect(verifierSigner) as any;

      const tx = await factory.verifyAsset(assetId, verificationLevel);
      const receipt = await tx.wait();

      this.logger.log(`Verified asset: ${assetId}, level: ${verificationLevel}, tx: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to verify asset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add asset to pool
   */
  async addAssetToPool(poolId: string, assetId: string, amcAddress: string): Promise<{ txHash: string }> {
    try {
      const amcSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(amcAddress),
        this.provider
      );

      const poolManager = this.getContractWithSigner(
        this.config.contractAddresses.poolManager,
        PoolManagerABI
      ).connect(amcSigner) as any;

      const tx = await poolManager.addAssetToPool(poolId, assetId);
      const receipt = await tx.wait();

      this.logger.log(`Added asset ${assetId} to pool ${poolId}, tx: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to add asset to pool: ${error.message}`);
      throw error;
    }
  }

  /**
   * Distribute dividends (for AMC)
   */
  async distributeDividends(poolId: string, amount: bigint, amcAddress: string): Promise<{ txHash: string }> {
    // Note: Dividend distribution is currently handled off-chain
    // This would need to be implemented based on the dividend distribution mechanism
    // For now, AMC can transfer TRUST tokens directly to investors
    throw new Error('Dividend distribution via smart contract not yet implemented');
  }

  /**
   * Get TRUST token balance
   */
  async getTrustTokenBalance(address: string): Promise<bigint> {
    try {
      const balance = await this.trustToken.balanceOf(address);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to get TRUST token balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer TRUST tokens
   */
  async transferTrustTokens(fromAddress: string, toAddress: string, amount: bigint): Promise<{ txHash: string }> {
    try {
      const fromSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(fromAddress),
        this.provider
      );

      const trustToken = this.getContractWithSigner(
        this.config.contractAddresses.trustToken,
        TrustTokenABI
      ).connect(fromSigner) as any;

      const tx = await trustToken.transfer(toAddress, amount);
      const receipt = await tx.wait();

      this.logger.log(`Transferred ${ethers.formatEther(amount)} TRUST from ${fromAddress} to ${toAddress}, tx: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to transfer TRUST tokens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer pool tokens (ERC20) between addresses
   * Used for trading pool shares
   */
  async transferPoolTokens(
    poolTokenAddress: string,
    fromAddress: string,
    toAddress: string,
    amount: bigint
  ): Promise<{ txHash: string }> {
    try {
      const fromSigner = new ethers.Wallet(
        await this.getPrivateKeyForAddress(fromAddress),
        this.provider
      );

      // Pool tokens are ERC20 tokens, use same ABI as TRUST token
      const poolToken = this.getContractWithSigner(
        poolTokenAddress,
        TrustTokenABI
      ).connect(fromSigner) as any;

      const tx = await poolToken.transfer(toAddress, amount);
      const receipt = await tx.wait();

      this.logger.log(`Transferred ${ethers.formatEther(amount)} pool tokens from ${fromAddress} to ${toAddress}, tx: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to transfer pool tokens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Get private key for address (from config or database)
   * TODO: Implement proper key management
   * 
   * Note: In production, this should use secure key management (AWS KMS, HashiCorp Vault, etc.)
   * For now, we use a single private key from config for backend operations
   */
  private async getPrivateKeyForAddress(address: string): Promise<string> {
    // For backend-initiated transactions, use the configured private key
    // For user-initiated transactions, the frontend should handle signing
    if (this.config.privateKey) {
      // Verify the address matches (optional check)
      const wallet = new ethers.Wallet(this.config.privateKey);
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        this.logger.warn(`Address mismatch: requested ${address}, signer is ${wallet.address}`);
      }
      return this.config.privateKey;
    }
    throw new Error(`No private key available for address ${address}. Backend operations require MANTLE_PRIVATE_KEY in .env`);
  }

  /**
   * Get provider (read-only)
   */
  getProvider(): ethers.Provider {
    return this.provider;
  }

  /**
   * Get signer (if available)
   */
  getSigner(): ethers.Signer | null {
    return this.signer || null;
  }
}

