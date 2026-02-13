/**
 * Automated Yield Distribution Service
 * Implements dividend distribution, yield tracking, and yield dashboard
 * Compatible with existing pool system
 */

export interface YieldDistribution {
  id: string;
  poolId: string;
  amount: number;
  currency: string;
  distributionDate: Date;
  recordDate: Date;
  exDividendDate: Date;
  status: 'PENDING' | 'DISTRIBUTED' | 'FAILED';
  totalHolders: number;
  totalTokens: number;
  yieldRate: number; // Annual percentage yield
  transactionId?: string;
}

export interface YieldHistory {
  poolId: string;
  distributions: YieldDistribution[];
  totalYieldDistributed: number;
  averageYieldRate: number;
  lastDistributionDate?: Date;
  nextDistributionDate?: Date;
}

export interface UserYieldPosition {
  userId: string;
  poolId: string;
  tokenBalance: number;
  totalYieldEarned: number;
  lastYieldClaimed?: Date;
  pendingYield: number;
  yieldHistory: {
    distributionId: string;
    amount: number;
    date: Date;
    status: 'CLAIMED' | 'PENDING';
  }[];
}

export class YieldDistributionService {
  private yieldDistributions: Map<string, YieldDistribution[]> = new Map();
  private userPositions: Map<string, UserYieldPosition[]> = new Map();
  private yieldHistory: Map<string, YieldHistory> = new Map();

  constructor() {
    // No initialization needed - data will be fetched from contracts/backend
  }

  /**
   * Create a new yield distribution for a pool
   */
  createYieldDistribution(
    poolId: string,
    amount: number,
    currency: string = 'TRUST',
    yieldRate: number = 12.5
  ): YieldDistribution {
    const distribution: YieldDistribution = {
      id: `yield_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      poolId,
      amount,
      currency,
      distributionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      recordDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      exDividendDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      status: 'PENDING',
      totalHolders: 0, // Will be calculated
      totalTokens: 0, // Will be calculated
      yieldRate
    };

    // Add to distributions
    const existingDistributions = this.yieldDistributions.get(poolId) || [];
    existingDistributions.push(distribution);
    this.yieldDistributions.set(poolId, existingDistributions);

    // Update yield history
    this.updateYieldHistory(poolId);

    return distribution;
  }

  /**
   * Distribute yield to all token holders
   */
  async distributeYield(distributionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the distribution
      let distribution: YieldDistribution | null = null;
      for (const distributions of this.yieldDistributions.values()) {
        const found = distributions.find(d => d.id === distributionId);
        if (found) {
          distribution = found;
          break;
        }
      }

      if (!distribution) {
        return { success: false, error: 'Distribution not found' };
      }

      if (distribution.status !== 'PENDING') {
        return { success: false, error: 'Distribution already processed' };
      }

      // Calculate distribution per token
      const distributionPerToken = distribution.amount / distribution.totalTokens;
      
      // Update all user positions
      for (const [userId, positions] of this.userPositions.entries()) {
        const position = positions.find(p => p.poolId === distribution.poolId);
        if (position) {
          const yieldAmount = position.tokenBalance * distributionPerToken;
          position.pendingYield += yieldAmount;
          position.yieldHistory.push({
            distributionId: distribution.id,
            amount: yieldAmount,
            date: distribution.distributionDate,
            status: 'PENDING'
          });
        }
      }

      // Update distribution status
      distribution.status = 'DISTRIBUTED';
      distribution.transactionId = `0.0.${Math.floor(Math.random() * 1000000)}@${Date.now()}`;

      // Update yield history
      this.updateYieldHistory(distribution.poolId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Claim yield for a user
   */
  async claimYield(userId: string, poolId: string): Promise<{ success: boolean; amount: number; error?: string }> {
    try {
      const positions = this.userPositions.get(userId) || [];
      const position = positions.find(p => p.poolId === poolId);
      
      if (!position) {
        return { success: false, amount: 0, error: 'No position found' };
      }

      if (position.pendingYield <= 0) {
        return { success: false, amount: 0, error: 'No pending yield to claim' };
      }

      const claimAmount = position.pendingYield;
      
      // Update position
      position.totalYieldEarned += claimAmount;
      position.pendingYield = 0;
      position.lastYieldClaimed = new Date();

      // Update yield history status
      position.yieldHistory.forEach(history => {
        if (history.status === 'PENDING') {
          history.status = 'CLAIMED';
        }
      });

      return { success: true, amount: claimAmount };
    } catch (error) {
      return { success: false, amount: 0, error: error.message };
    }
  }

  /**
   * Get yield history for a pool
   */
  getYieldHistory(poolId: string): YieldHistory | null {
    return this.yieldHistory.get(poolId) || null;
  }

  /**
   * Get user's yield positions
   */
  getUserYieldPositions(userId: string): UserYieldPosition[] {
    return this.userPositions.get(userId) || [];
  }

  /**
   * Get pending distributions for a pool
   */
  getPendingDistributions(poolId: string): YieldDistribution[] {
    const distributions = this.yieldDistributions.get(poolId) || [];
    return distributions.filter(d => d.status === 'PENDING');
  }

  /**
   * Get upcoming distributions for a pool
   */
  getUpcomingDistributions(poolId: string): YieldDistribution[] {
    const distributions = this.yieldDistributions.get(poolId) || [];
    const now = new Date();
    return distributions.filter(d => d.distributionDate > now);
  }

  /**
   * Calculate yield metrics for a pool
   */
  getYieldMetrics(poolId: string): {
    totalYieldDistributed: number;
    averageYieldRate: number;
    lastDistributionDate?: Date;
    nextDistributionDate?: Date;
    totalHolders: number;
    yieldPerToken: number;
  } {
    const history = this.yieldHistory.get(poolId);
    if (!history) {
      return {
        totalYieldDistributed: 0,
        averageYieldRate: 0,
        totalHolders: 0,
        yieldPerToken: 0
      };
    }

    const distributions = this.yieldDistributions.get(poolId) || [];
    const totalYieldDistributed = distributions
      .filter(d => d.status === 'DISTRIBUTED')
      .reduce((sum, d) => sum + d.amount, 0);

    const averageYieldRate = distributions.length > 0 
      ? distributions.reduce((sum, d) => sum + d.yieldRate, 0) / distributions.length
      : 0;

    const lastDistribution = distributions
      .filter(d => d.status === 'DISTRIBUTED')
      .sort((a, b) => b.distributionDate.getTime() - a.distributionDate.getTime())[0];

    const nextDistribution = distributions
      .filter(d => d.status === 'PENDING' && d.distributionDate > new Date())
      .sort((a, b) => a.distributionDate.getTime() - b.distributionDate.getTime())[0];

    const totalHolders = lastDistribution?.totalHolders || 0;
    const yieldPerToken = totalHolders > 0 ? totalYieldDistributed / totalHolders : 0;

    return {
      totalYieldDistributed,
      averageYieldRate,
      lastDistributionDate: lastDistribution?.distributionDate,
      nextDistributionDate: nextDistribution?.distributionDate,
      totalHolders,
      yieldPerToken
    };
  }

  /**
   * Update yield history for a pool
   */
  private updateYieldHistory(poolId: string) {
    const distributions = this.yieldDistributions.get(poolId) || [];
    const totalYieldDistributed = distributions
      .filter(d => d.status === 'DISTRIBUTED')
      .reduce((sum, d) => sum + d.amount, 0);

    const averageYieldRate = distributions.length > 0 
      ? distributions.reduce((sum, d) => sum + d.yieldRate, 0) / distributions.length
      : 0;

    const lastDistribution = distributions
      .filter(d => d.status === 'DISTRIBUTED')
      .sort((a, b) => b.distributionDate.getTime() - a.distributionDate.getTime())[0];

    const nextDistribution = distributions
      .filter(d => d.status === 'PENDING' && d.distributionDate > new Date())
      .sort((a, b) => a.distributionDate.getTime() - b.distributionDate.getTime())[0];

    this.yieldHistory.set(poolId, {
      poolId,
      distributions,
      totalYieldDistributed,
      averageYieldRate,
      lastDistributionDate: lastDistribution?.distributionDate,
      nextDistributionDate: nextDistribution?.distributionDate
    });
  }

  /**
   * Schedule automatic yield distribution
   */
  scheduleAutomaticDistribution(
    poolId: string,
    amount: number,
    frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY',
    yieldRate: number = 12.5
  ): YieldDistribution[] {
    const distributions: YieldDistribution[] = [];
    const now = new Date();
    
    // Create distributions for the next 12 months
    for (let i = 1; i <= 12; i++) {
      let distributionDate: Date;
      
      switch (frequency) {
        case 'MONTHLY':
          distributionDate = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
          break;
        case 'QUARTERLY':
          distributionDate = new Date(now.getFullYear(), now.getMonth() + (i * 3), now.getDate());
          break;
        case 'ANNUALLY':
          distributionDate = new Date(now.getFullYear() + i, now.getMonth(), now.getDate());
          break;
        default:
          distributionDate = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
      }

      const distribution: YieldDistribution = {
        id: `yield_${poolId}_${i}_${Date.now()}`,
        poolId,
        amount,
        currency: 'TRUST',
        distributionDate,
        recordDate: new Date(distributionDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days before
        exDividendDate: new Date(distributionDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        status: 'PENDING',
        totalHolders: 0,
        totalTokens: 0,
        yieldRate
      };

      distributions.push(distribution);
    }

    // Add to existing distributions
    const existingDistributions = this.yieldDistributions.get(poolId) || [];
    existingDistributions.push(...distributions);
    this.yieldDistributions.set(poolId, existingDistributions);

    // Update yield history
    this.updateYieldHistory(poolId);

    return distributions;
  }
}

// Export singleton instance
export const yieldDistributionService = new YieldDistributionService();
