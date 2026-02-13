import { ethers } from 'ethers';
import { novaxContractAddresses } from '../config/contracts';
import NovaxPoolManagerABI from '../contracts/NovaxPoolManager.json';

export class PoolManagerService {
  private static instance: PoolManagerService;
  private signer: ethers.Signer | null = null;
  private provider: ethers.Provider | null = null;

  private constructor() {}

  public static getInstance(): PoolManagerService {
    if (!PoolManagerService.instance) {
      PoolManagerService.instance = new PoolManagerService();
    }
    return PoolManagerService.instance;
  }

  initialize(signer: ethers.Signer | null, provider: ethers.Provider) {
    this.signer = signer;
    this.provider = provider;
  }

  private getContract() {
    if (!this.signer && !this.provider) {
      throw new Error('Service not initialized');
    }
    return new ethers.Contract(
      novaxContractAddresses.POOL_MANAGER,
      NovaxPoolManagerABI,
      this.signer || this.provider!
    );
  }

  /**
   * Get multiple pools in ONE call (efficient batch read)
   */
  async getPoolsBatch(poolIds: string[]): Promise<any[]> {
    const poolManager = this.getContract();
    const pools = await poolManager.getPoolsBatch(poolIds);
    return pools;
  }

  /**
   * Get all pools with pagination (efficient)
   */
  async getPoolsPaginated(offset: number, limit: number): Promise<{
    pools: any[];
    total: number;
  }> {
    const poolManager = this.getContract();
    const [pools, total] = await poolManager.getPoolsPaginated(offset, limit);
    
    return {
      pools: pools,
      total: Number(total)
    };
  }

  /**
   * Get user's complete portfolio in ONE call (efficient!)
   */
  async getUserPortfolio(address: string): Promise<{
    poolIds: string[];
    pools: any[];
    investments: number[];
    totalInvested: number;
  }> {
    const poolManager = this.getContract();
    
    const [poolIds, pools, investments, totalInvested] = 
      await poolManager.getUserPortfolio(address);

    return {
      poolIds: poolIds,
      pools: pools,
      investments: investments.map((inv: bigint) => Number(ethers.formatUnits(inv, 6))),
      totalInvested: Number(ethers.formatUnits(totalInvested, 6))
    };
  }

  /**
   * Get active pools only in ONE call (efficient filter)
   */
  async getActivePools(): Promise<{
    pools: any[];
    poolIds: string[];
  }> {
    const poolManager = this.getContract();
    const [pools, poolIds] = await poolManager.getActivePools();
    
    return {
      pools: pools,
      poolIds: poolIds
    };
  }

  /**
   * Get pool analytics in ONE call (efficient!)
   */
  async getPoolAnalytics(poolId: string): Promise<{
    pool: any;
    investorsCount: number;
    investors: string[];
    investments: number[];
  }> {
    const poolManager = this.getContract();
    
    const [pool, investorsCount, investors, investments] = 
      await poolManager.getPoolAnalytics(poolId);

    return {
      pool: pool,
      investorsCount: Number(investorsCount),
      investors: investors,
      investments: investments.map((inv: bigint) => Number(ethers.formatUnits(inv, 6)))
    };
  }
}

export const poolManagerService = PoolManagerService.getInstance();

