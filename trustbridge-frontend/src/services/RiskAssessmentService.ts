/**
 * Risk Assessment Service
 * Implements automated risk scoring, risk-based pool categorization, and risk warnings
 * Compatible with existing pool system
 */

export interface RiskFactors {
  liquidityRisk: number; // 0-100
  marketRisk: number; // 0-100
  creditRisk: number; // 0-100
  operationalRisk: number; // 0-100
  regulatoryRisk: number; // 0-100
  concentrationRisk: number; // 0-100
}

export interface RiskAssessment {
  poolId: string;
  overallRiskScore: number; // 0-100 (0 = low risk, 100 = high risk)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  riskFactors: RiskFactors;
  riskWarnings: string[];
  riskMitigations: string[];
  lastAssessmentDate: Date;
  assessmentVersion: string;
}

export interface PoolRiskProfile {
  poolId: string;
  assetType: string;
  geographicRegion: string;
  sector: string;
  maturityDate: Date;
  minimumInvestment: number;
  expectedAPY: number;
  totalValue: number;
  diversificationScore: number; // 0-100
  liquidityScore: number; // 0-100
  transparencyScore: number; // 0-100
}

export class RiskAssessmentService {
  private riskAssessments: Map<string, RiskAssessment> = new Map();
  private poolProfiles: Map<string, PoolRiskProfile> = new Map();

  constructor() {
    // No initialization needed - data will be fetched from contracts/backend
  }

  /**
   * Assess risk for a pool
   */
  assessPoolRisk(poolId: string, profile: PoolRiskProfile): RiskAssessment {
    const riskFactors = this.calculateRiskFactors(profile);
    const overallRiskScore = this.calculateOverallRiskScore(riskFactors);
    const riskLevel = this.determineRiskLevel(overallRiskScore);
    const riskWarnings = this.generateRiskWarnings(riskFactors, profile);
    const riskMitigations = this.generateRiskMitigations(riskFactors, profile);

    const assessment: RiskAssessment = {
      poolId,
      overallRiskScore,
      riskLevel,
      riskFactors,
      riskWarnings,
      riskMitigations,
      lastAssessmentDate: new Date(),
      assessmentVersion: '1.0'
    };

    this.riskAssessments.set(poolId, assessment);
    return assessment;
  }

  /**
   * Calculate individual risk factors
   */
  private calculateRiskFactors(profile: PoolRiskProfile): RiskFactors {
    return {
      liquidityRisk: this.calculateLiquidityRisk(profile),
      marketRisk: this.calculateMarketRisk(profile),
      creditRisk: this.calculateCreditRisk(profile),
      operationalRisk: this.calculateOperationalRisk(profile),
      regulatoryRisk: this.calculateRegulatoryRisk(profile),
      concentrationRisk: this.calculateConcentrationRisk(profile)
    };
  }

  private calculateLiquidityRisk(profile: PoolRiskProfile): number {
    // Based on liquidity score and asset type
    let risk = 100 - profile.liquidityScore;
    
    // Adjust based on asset type
    switch (profile.assetType) {
      case 'REAL_ESTATE':
        risk += 10; // Real estate is less liquid
        break;
      case 'EQUIPMENT':
        risk += 15; // Equipment is less liquid
        break;
      case 'AGRICULTURAL':
        risk += 5; // Agricultural assets have seasonal liquidity
        break;
    }

    // Adjust based on geographic region
    switch (profile.geographicRegion) {
      case 'AFRICA':
        risk += 10; // Emerging market risk
        break;
      case 'ASIA':
        risk += 5;
        break;
      case 'NORTH_AMERICA':
        risk -= 5; // More liquid markets
        break;
    }

    return Math.max(0, Math.min(100, risk));
  }

  private calculateMarketRisk(profile: PoolRiskProfile): number {
    let risk = 50; // Base market risk

    // Adjust based on expected APY (higher APY = higher risk)
    if (profile.expectedAPY > 15) {
      risk += 20;
    } else if (profile.expectedAPY > 10) {
      risk += 10;
    }

    // Adjust based on sector
    switch (profile.sector) {
      case 'COMMERCIAL':
        risk += 5;
        break;
      case 'RESIDENTIAL':
        risk -= 5;
        break;
      case 'INDUSTRIAL':
        risk += 10;
        break;
    }

    return Math.max(0, Math.min(100, risk));
  }

  private calculateCreditRisk(profile: PoolRiskProfile): number {
    let risk = 30; // Base credit risk

    // Adjust based on minimum investment (higher minimum = potentially higher credit risk)
    if (profile.minimumInvestment > 1000) {
      risk += 10;
    }

    // Adjust based on transparency score
    risk += (100 - profile.transparencyScore) * 0.3;

    return Math.max(0, Math.min(100, risk));
  }

  private calculateOperationalRisk(profile: PoolRiskProfile): number {
    let risk = 40; // Base operational risk

    // Adjust based on diversification score
    risk += (100 - profile.diversificationScore) * 0.2;

    // Adjust based on transparency score
    risk += (100 - profile.transparencyScore) * 0.2;

    return Math.max(0, Math.min(100, risk));
  }

  private calculateRegulatoryRisk(profile: PoolRiskProfile): number {
    let risk = 30; // Base regulatory risk

    // Adjust based on geographic region
    switch (profile.geographicRegion) {
      case 'AFRICA':
        risk += 20; // Emerging markets have higher regulatory risk
        break;
      case 'ASIA':
        risk += 10;
        break;
      case 'NORTH_AMERICA':
        risk -= 5; // More stable regulatory environment
        break;
      case 'EUROPE':
        risk -= 10;
        break;
    }

    return Math.max(0, Math.min(100, risk));
  }

  private calculateConcentrationRisk(profile: PoolRiskProfile): number {
    // Based on diversification score
    return 100 - profile.diversificationScore;
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(riskFactors: RiskFactors): number {
    const weights = {
      liquidityRisk: 0.20,
      marketRisk: 0.25,
      creditRisk: 0.15,
      operationalRisk: 0.15,
      regulatoryRisk: 0.15,
      concentrationRisk: 0.10
    };

    return Math.round(
      riskFactors.liquidityRisk * weights.liquidityRisk +
      riskFactors.marketRisk * weights.marketRisk +
      riskFactors.creditRisk * weights.creditRisk +
      riskFactors.operationalRisk * weights.operationalRisk +
      riskFactors.regulatoryRisk * weights.regulatoryRisk +
      riskFactors.concentrationRisk * weights.concentrationRisk
    );
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    if (score < 25) return 'LOW';
    if (score < 50) return 'MEDIUM';
    if (score < 75) return 'HIGH';
    return 'VERY_HIGH';
  }

  /**
   * Generate risk warnings
   */
  private generateRiskWarnings(riskFactors: RiskFactors, profile: PoolRiskProfile): string[] {
    const warnings: string[] = [];

    if (riskFactors.liquidityRisk > 60) {
      warnings.push('High liquidity risk - limited secondary market for asset trading');
    }

    if (riskFactors.marketRisk > 60) {
      warnings.push('High market risk - returns may be volatile due to market conditions');
    }

    if (riskFactors.creditRisk > 50) {
      warnings.push('Moderate to high credit risk - counterparty default risk exists');
    }

    if (riskFactors.regulatoryRisk > 50) {
      warnings.push('Regulatory risk - changes in local regulations may affect returns');
    }

    if (riskFactors.concentrationRisk > 60) {
      warnings.push('High concentration risk - limited diversification in asset portfolio');
    }

    if (profile.expectedAPY > 15) {
      warnings.push('High expected returns may indicate higher underlying risk');
    }

    return warnings;
  }

  /**
   * Generate risk mitigations
   */
  private generateRiskMitigations(riskFactors: RiskFactors, profile: PoolRiskProfile): string[] {
    const mitigations: string[] = [];

    if (riskFactors.liquidityRisk > 40) {
      mitigations.push('Professional asset management with liquidity planning');
    }

    if (riskFactors.marketRisk > 40) {
      mitigations.push('Diversified investment strategy to reduce market exposure');
    }

    if (riskFactors.creditRisk > 30) {
      mitigations.push('Credit enhancement mechanisms and insurance coverage');
    }

    if (profile.transparencyScore > 70) {
      mitigations.push('Regular reporting and transparency mechanisms in place');
    }

    if (profile.diversificationScore > 60) {
      mitigations.push('Well-diversified asset portfolio reduces concentration risk');
    }

    mitigations.push('Professional risk management team with proven track record');
    mitigations.push('Regular monitoring and assessment of risk factors');

    return mitigations;
  }

  /**
   * Get risk assessment for a pool
   */
  getRiskAssessment(poolId: string): RiskAssessment | null {
    return this.riskAssessments.get(poolId) || null;
  }

  /**
   * Get pool risk profile
   */
  getPoolRiskProfile(poolId: string): PoolRiskProfile | null {
    return this.poolProfiles.get(poolId) || null;
  }

  /**
   * Update pool risk profile
   */
  updatePoolRiskProfile(poolId: string, profile: Partial<PoolRiskProfile>): PoolRiskProfile {
    const existingProfile = this.poolProfiles.get(poolId);
    const updatedProfile = { ...existingProfile, ...profile, poolId };
    this.poolProfiles.set(poolId, updatedProfile);
    
    // Reassess risk with updated profile
    this.assessPoolRisk(poolId, updatedProfile);
    
    return updatedProfile;
  }

  /**
   * Get risk comparison across pools
   */
  getRiskComparison(poolIds: string[]): Array<{
    poolId: string;
    riskScore: number;
    riskLevel: string;
    assetType: string;
  }> {
    return poolIds.map(poolId => {
      const assessment = this.getRiskAssessment(poolId);
      const profile = this.getPoolRiskProfile(poolId);
      
      return {
        poolId,
        riskScore: assessment?.overallRiskScore || 0,
        riskLevel: assessment?.riskLevel || 'UNKNOWN',
        assetType: profile?.assetType || 'UNKNOWN'
      };
    }).sort((a, b) => a.riskScore - b.riskScore);
  }

  /**
   * Get risk-adjusted returns
   */
  getRiskAdjustedReturns(poolId: string): {
    expectedAPY: number;
    riskScore: number;
    riskAdjustedReturn: number;
    sharpeRatio: number;
  } {
    const assessment = this.getRiskAssessment(poolId);
    const profile = this.getPoolRiskProfile(poolId);
    
    if (!assessment || !profile) {
      return {
        expectedAPY: 0,
        riskScore: 0,
        riskAdjustedReturn: 0,
        sharpeRatio: 0
      };
    }

    const expectedAPY = profile.expectedAPY;
    const riskScore = assessment.overallRiskScore;
    const riskFreeRate = 5; // Assume 5% risk-free rate
    
    // Risk-adjusted return (simplified calculation)
    const riskAdjustedReturn = expectedAPY - (riskScore / 100) * 10;
    
    // Sharpe ratio (simplified)
    const sharpeRatio = (expectedAPY - riskFreeRate) / (riskScore / 10);

    return {
      expectedAPY,
      riskScore,
      riskAdjustedReturn: Math.max(0, riskAdjustedReturn),
      sharpeRatio: Math.max(0, sharpeRatio)
    };
  }
}

// Export singleton instance
export const riskAssessmentService = new RiskAssessmentService();
