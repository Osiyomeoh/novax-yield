import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerificationRequest, VerificationRequestDocument, VerificationStatus } from '../schemas/verification-request.schema';
import { Asset, AssetDocument } from '../schemas/asset.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
// import { HederaService } from '../hedera/hedera.service'; // Removed - use Novax contracts for Etherlink

export interface VerificationTier {
  name: 'INSTANT' | 'FAST' | 'STANDARD';
  maxAssetValue: number;
  maxProcessingTime: number; // in minutes
  requiresManualReview: boolean;
  confidenceThreshold: number;
  description: string;
}

export interface SmartVerificationResult {
  tier: VerificationTier;
  approved: boolean;
  confidence: number;
  processingTime: number;
  reasons: string[];
  nextSteps?: string[];
}

@Injectable()
export class SmartVerificationService {
  private readonly logger = new Logger(SmartVerificationService.name);

  // Verification tiers based on asset value and risk
  private readonly verificationTiers: VerificationTier[] = [
    {
      name: 'INSTANT',
      maxAssetValue: 10000, // $10k and below
      maxProcessingTime: 5, // 5 minutes
      requiresManualReview: false,
      confidenceThreshold: 0.85,
      description: 'Instant verification for low-value, high-confidence assets'
    },
    {
      name: 'FAST',
      maxAssetValue: 100000, // $100k and below
      maxProcessingTime: 30, // 30 minutes
      requiresManualReview: false,
      confidenceThreshold: 0.75,
      description: 'Fast verification for medium-value assets with good documentation'
    },
    {
      name: 'STANDARD',
      maxAssetValue: Infinity, // All other assets
      maxProcessingTime: 1440, // 24 hours
      requiresManualReview: true,
      confidenceThreshold: 0.6,
      description: 'Standard verification with manual review for high-value or complex assets'
    }
  ];

  constructor(
    @InjectModel(VerificationRequest.name) private verificationModel: Model<VerificationRequestDocument>,
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
    private eventEmitter: EventEmitter2,
    // private hederaService: HederaService, // Removed - use Novax contracts for Etherlink
  ) {}

  /**
   * Smart verification that determines the appropriate tier and processes accordingly
   */
  async processSmartVerification(assetId: string, evidence: any): Promise<SmartVerificationResult> {
    const startTime = Date.now();
    
    try {
      // Get asset details
      const asset = await this.assetModel.findOne({ assetId });
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Determine verification tier
      const tier = this.determineVerificationTier(asset.totalValue, evidence);
      this.logger.log(`Asset ${assetId} assigned to ${tier.name} verification tier`);

      // Run automated verification based on tier
      const result = await this.runTierBasedVerification(asset, evidence, tier);
      
      const processingTime = (Date.now() - startTime) / 1000 / 60; // minutes
      
      // Update asset status based on result
      if (result.approved) {
        await this.updateAssetStatus(assetId, 'VERIFIED', result.confidence);
        await this.createVerificationRecord(assetId, tier, result, processingTime);
        
        // Emit success event
        this.eventEmitter.emit('verification.completed', {
          assetId,
          tier: tier.name,
          confidence: result.confidence,
          processingTime
        });
      } else {
        await this.updateAssetStatus(assetId, 'PENDING_MANUAL_REVIEW', result.confidence);
        
        // Emit review required event
        this.eventEmitter.emit('verification.requires_review', {
          assetId,
          tier: tier.name,
          reasons: result.reasons
        });
      }

      return {
        ...result,
        tier,
        processingTime
      };

    } catch (error) {
      this.logger.error(`Smart verification failed for asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Determine the appropriate verification tier based on asset value and evidence quality
   */
  private determineVerificationTier(assetValue: number, evidence: any): VerificationTier {
    // Find the appropriate tier based on asset value
    const tier = this.verificationTiers.find(t => assetValue <= t.maxAssetValue) || this.verificationTiers[2];
    
    // Adjust tier based on evidence quality
    const evidenceQuality = this.assessEvidenceQuality(evidence);
    
    // Downgrade tier if evidence quality is poor
    if (evidenceQuality < 0.7 && tier.name === 'INSTANT') {
      return this.verificationTiers[1]; // Downgrade to FAST
    }
    
    if (evidenceQuality < 0.5 && tier.name === 'FAST') {
      return this.verificationTiers[2]; // Downgrade to STANDARD
    }

    return tier;
  }

  /**
   * Assess the quality of submitted evidence
   */
  private assessEvidenceQuality(evidence: any): number {
    let score = 0;
    let factors = 0;

    // Document completeness
    if (evidence.documents && evidence.documents.length > 0) {
      score += 0.3;
      factors++;
    }

    // Photo evidence
    if (evidence.photos && evidence.photos.length > 0) {
      score += 0.2;
      factors++;
    }

    // GPS location data
    if (evidence.location && evidence.location.coordinates) {
      score += 0.2;
      factors++;
    }

    // Ownership documentation
    if (evidence.ownership && evidence.ownership.ownerName) {
      score += 0.2;
      factors++;
    }

    // Valuation documentation
    if (evidence.valuation && evidence.valuation.estimatedValue) {
      score += 0.1;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Run verification based on the assigned tier
   */
  private async runTierBasedVerification(
    asset: AssetDocument, 
    evidence: any, 
    tier: VerificationTier
  ): Promise<Omit<SmartVerificationResult, 'tier' | 'processingTime'>> {
    
    const confidence = await this.calculateConfidenceScore(asset, evidence);
    const reasons: string[] = [];
    const nextSteps: string[] = [];

    // Check if confidence meets tier threshold
    if (confidence >= tier.confidenceThreshold) {
      reasons.push(`High confidence score: ${(confidence * 100).toFixed(1)}%`);
      reasons.push(`Meets ${tier.name} tier requirements`);
      
      return {
        approved: true,
        confidence,
        reasons,
        nextSteps: ['Asset will be tokenized immediately', 'Available for investment within minutes']
      };
    } else {
      reasons.push(`Low confidence score: ${(confidence * 100).toFixed(1)}%`);
      reasons.push(`Below ${tier.name} tier threshold: ${(tier.confidenceThreshold * 100).toFixed(1)}%`);
      
      if (tier.requiresManualReview) {
        nextSteps.push('Asset will be reviewed by our verification team');
        nextSteps.push('You will receive updates via email and dashboard');
      } else {
        nextSteps.push('Please provide additional documentation');
        nextSteps.push('Resubmit with more complete evidence');
      }

      return {
        approved: false,
        confidence,
        reasons,
        nextSteps
      };
    }
  }

  /**
   * Calculate confidence score based on multiple factors
   */
  private async calculateConfidenceScore(asset: AssetDocument, evidence: any): Promise<number> {
    let score = 0;
    let factors = 0;

    // Evidence completeness (40% weight)
    const evidenceQuality = this.assessEvidenceQuality(evidence);
    score += evidenceQuality * 0.4;
    factors += 0.4;

    // Asset value reasonableness (20% weight)
    const valueReasonableness = this.assessValueReasonableness(asset, evidence);
    score += valueReasonableness * 0.2;
    factors += 0.2;

    // Documentation quality (20% weight)
    const docQuality = this.assessDocumentationQuality(evidence);
    score += docQuality * 0.2;
    factors += 0.2;

    // Location verification (10% weight)
    const locationScore = this.assessLocationVerification(evidence);
    score += locationScore * 0.1;
    factors += 0.1;

    // Ownership verification (10% weight)
    const ownershipScore = this.assessOwnershipVerification(evidence);
    score += ownershipScore * 0.1;
    factors += 0.1;

    return factors > 0 ? score / factors : 0;
  }

  private assessValueReasonableness(asset: AssetDocument, evidence: any): number {
    // Simple heuristic - can be enhanced with market data
    const declaredValue = asset.totalValue;
    const estimatedValue = evidence.valuation?.estimatedValue || 0;
    
    if (estimatedValue > 0) {
      const variance = Math.abs(declaredValue - estimatedValue) / declaredValue;
      return variance < 0.2 ? 1.0 : Math.max(0, 1 - variance);
    }
    
    return 0.5; // Neutral if no estimated value
  }

  private assessDocumentationQuality(evidence: any): number {
    let score = 0;
    let factors = 0;

    // Check for required document types
    const requiredDocs = ['ownership', 'valuation', 'survey'];
    const providedDocs = evidence.documents?.map((d: any) => d.type) || [];
    
    requiredDocs.forEach(docType => {
      if (providedDocs.includes(docType)) {
        score += 1;
      }
      factors += 1;
    });

    return factors > 0 ? score / factors : 0.3;
  }

  private assessLocationVerification(evidence: any): number {
    if (evidence.location?.coordinates) {
      return 1.0; // GPS coordinates provided
    }
    if (evidence.location?.address) {
      return 0.7; // Address provided
    }
    return 0.3; // Basic location info
  }

  private assessOwnershipVerification(evidence: any): number {
    if (evidence.ownership?.ownerName && evidence.ownership?.ownershipPercentage) {
      return 1.0; // Complete ownership info
    }
    if (evidence.ownership?.ownerName) {
      return 0.6; // Partial ownership info
    }
    return 0.2; // Minimal ownership info
  }

  /**
   * Update asset status in database
   */
  private async updateAssetStatus(assetId: string, status: string, confidence: number): Promise<void> {
    await this.assetModel.findOneAndUpdate(
      { assetId },
      { 
        status,
        verificationScore: confidence * 100,
        updatedAt: new Date()
      }
    );
  }

  /**
   * Create verification record
   */
  private async createVerificationRecord(
    assetId: string, 
    tier: VerificationTier, 
    result: any, 
    processingTime: number
  ): Promise<void> {
    const verificationRecord = new this.verificationModel({
      assetId,
      status: result.approved ? VerificationStatus.VERIFIED : VerificationStatus.SUBMITTED,
      scoring: {
        automatedScore: result.confidence * 100,
        attestorScore: 0,
        finalScore: result.confidence * 100,
        breakdown: {
          tier: tier.name,
          processingTime,
          reasons: result.reasons
        }
      },
      metadata: {
        tier: tier.name,
        processingTime,
        automated: true
      }
    });

    await verificationRecord.save();
  }

  /**
   * Get verification status for an asset
   */
  async getVerificationStatus(assetId: string): Promise<any> {
    const verification = await this.verificationModel.findOne({ assetId });
    const asset = await this.assetModel.findOne({ assetId });
    
    if (!verification || !asset) {
      return null;
    }

    return {
      assetId,
      status: asset.status,
      tier: 'STANDARD', // Default tier
      confidence: verification.scoring?.finalScore || 0,
      processingTime: 0, // Default processing time
      reasons: [], // Default empty reasons
      nextSteps: [] // Default empty next steps
    };
  }
}
