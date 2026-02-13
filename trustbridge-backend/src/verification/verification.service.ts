import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerificationRequest, VerificationRequestDocument, VerificationStatus, IPFSFile } from '../schemas/verification-request.schema';
import { Asset, AssetDocument } from '../schemas/asset.schema';
// import { Attestor, AttestorDocument } from '../schemas/attestor.schema'; // Removed - attestor functionality deprecated
// import { HederaService } from '../hedera/hedera.service'; // Removed - use Novax contracts for Etherlink
import { ChainlinkService } from '../chainlink/chainlink.service';
// import { AttestorsService, AttestorRequirements } from '../attestors/attestors.service'; // Removed - attestor functionality deprecated
// import { ExternalApisService } from '../external-apis/external-apis.service'; // Removed - external-apis module deleted
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPFSService } from '../services/ipfs.service';

export interface VerificationResult {
  assetId: string;
  automatedScore: number;
  attestorScore?: number;
  finalScore: number;
  status: VerificationStatus;
  evidence: any;
  attestorId?: string;
  timestamp: Date;
}

export interface AttestorMatch {
  attestor: any; // Removed - attestor functionality deprecated
  score: number;
  reason: string;
}

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(VerificationRequest.name) private verificationModel: Model<VerificationRequestDocument>,
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
    // @InjectModel(Attestor.name) private attestorModel: Model<AttestorDocument>, // Removed - attestor functionality deprecated
    // private hederaService: HederaService, // Removed - use Novax contracts for Etherlink
    private chainlinkService: ChainlinkService,
    // private attestorsService: AttestorsService, // Removed - attestor functionality deprecated
    // private externalApisService: ExternalApisService, // Removed - external-apis module deleted
    private eventEmitter: EventEmitter2,
    private ipfsService: IPFSService,
  ) {}

  async submitVerificationRequest(assetId: string, evidence: any): Promise<VerificationRequest> {
    const asset = await this.assetModel.findOne({ assetId });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Run automated verification
    const automatedResult = await this.runAutomatedVerification(asset, evidence);
    
    const verificationRequest = new this.verificationModel({
      assetId,
      evidence: [{
        type: 'automated_verification',
        provider: 'system',
        confidence: automatedResult.score / 100,
        result: automatedResult.details,
      }],
      status: VerificationStatus.SUBMITTED,
      scoring: {
        automatedScore: automatedResult.score,
        attestorScore: 0,
        finalScore: automatedResult.score,
      },
      submittedBy: asset.owner,
    });

    const savedRequest = await verificationRequest.save();

    // If automated score is high enough, auto-approve
    if (automatedResult.score >= 85) {
      await this.approveVerification(savedRequest._id.toString(), null, automatedResult.score);
    } else {
      // Find and assign attestors using the new AttestorsService
      const requirements: any = { // Removed - attestor functionality deprecated
        assetType: asset.type,
        location: {
          country: asset.location.country,
          region: asset.location.region,
          coordinates: asset.location.coordinates,
        },
        requiredSpecialties: [asset.type],
        minReputation: 70,
        maxDistance: 100, // 100km radius
      };
      
      // const assignedAttestors = await this.attestorsService.assignAttestors(assetId, requirements); // Removed - attestor functionality deprecated
      const assignedAttestors = []; // Placeholder - attestor functionality deprecated
      if (assignedAttestors.length > 0) {
        // Convert Attestor[] to AttestorMatch[] for compatibility
        const attestorMatches = assignedAttestors.map(attestor => ({
          attestor,
          score: attestor.reputation,
          reason: `Reputation: ${attestor.reputation}%, Location: ${attestor.country}`
        }));
        await this.assignAttestors(savedRequest._id.toString(), attestorMatches);
      }
    }

    // Emit event for real-time updates
    this.eventEmitter.emit('verification.submitted', {
      assetId,
      verificationId: savedRequest._id,
      score: automatedResult.score,
      status: savedRequest.status,
    });

    return savedRequest;
  }

  async submitVerificationWithFiles(
    assetId: string,
    description: string,
    documents: IPFSFile[],
    photos: IPFSFile[],
    evidence: any
  ): Promise<VerificationRequest> {
    const asset = await this.assetModel.findOne({ assetId });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Create verification request with IPFS files
    const verificationRequest = new this.verificationModel({
      assetId,
      status: VerificationStatus.SUBMITTED,
      documents,
      photos,
      evidence: [{
        type: 'user_submission',
        provider: 'user',
        confidence: 1.0,
        result: {
          description,
          evidence,
          files: {
            documents: documents.length,
            photos: photos.length
          }
        },
        files: documents.concat(photos)
      }],
      submittedBy: 'user', // This should come from the authenticated user
    });

    // Run automated verification
    const automatedResult = await this.runAutomatedVerification(asset, evidence);

    // Update scoring
    verificationRequest.scoring = {
      automatedScore: automatedResult.score,
      attestorScore: 0,
      finalScore: automatedResult.score
    };

    // Save verification request
    const savedRequest = await verificationRequest.save();

    // Emit event for real-time updates
    this.eventEmitter.emit('verification.submitted', {
      assetId,
      verificationId: savedRequest._id,
      score: automatedResult.score,
      status: savedRequest.status,
      files: {
        documents: documents.length,
        photos: photos.length
      }
    });

    return savedRequest;
  }

  private async runAutomatedVerification(asset: Asset, evidence: any): Promise<{ score: number; details: any }> {
    let totalScore = 0;
    let maxScore = 0;
    const details: any = {};

    // 1. Document Verification (25 points)
    if (evidence.documents && evidence.documents.length > 0) {
      const docScore = await this.verifyDocuments(evidence.documents, asset);
      details.documentVerification = { score: docScore, maxScore: 25 };
      totalScore += docScore;
      maxScore += 25;
    }

    // 2. GPS Verification (20 points)
    if (evidence.location && evidence.location.coordinates) {
      const gpsScore = await this.verifyGPSLocation(evidence.location, asset);
      details.gpsVerification = { score: gpsScore, maxScore: 20 };
      totalScore += gpsScore;
      maxScore += 20;
    }

    // 3. Photo Analysis (20 points)
    if (evidence.photos && evidence.photos.length > 0) {
      const photoScore = await this.analyzePhotos(evidence.photos, asset);
      details.photoAnalysis = { score: photoScore, maxScore: 20 };
      totalScore += photoScore;
      maxScore += 20;
    }

    // 4. Market Price Verification (15 points)
    const marketScore = await this.verifyMarketPrice(asset);
    details.marketVerification = { score: marketScore, maxScore: 15 };
    totalScore += marketScore;
    maxScore += 15;

    // 5. Weather Data Verification (10 points)
    const weatherScore = await this.verifyWeatherData(asset);
    details.weatherVerification = { score: weatherScore, maxScore: 10 };
    totalScore += weatherScore;
    maxScore += 10;

    // 6. Historical Data Verification (10 points)
    const historicalScore = await this.verifyHistoricalData(asset);
    details.historicalVerification = { score: historicalScore, maxScore: 10 };
    totalScore += historicalScore;
    maxScore += 10;

    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return {
      score: finalScore,
      details,
    };
  }

  private async verifyDocuments(documents: any[], asset: Asset): Promise<number> {
    let score = 0;
    const maxScore = 25;

    for (const doc of documents) {
      try {
        // TODO: Replace with Chainlink Functions or other OCR service
        // const ocrResult = await this.chainlinkService.extractTextFromImage(
        //   Buffer.from(doc.data, 'base64'),
        //   doc.mimeType
        // );
        // const docVerification = await this.chainlinkService.verifyDocument(
        //   Buffer.from(doc.data, 'base64'),
        //   doc.fileName?.includes('land') ? 'land_certificate' : 
        //   doc.fileName?.includes('business') ? 'business_license' : 'identity_document'
        // );
        const ocrResult = { text: 'Placeholder - OCR not available' }; // Placeholder
        const docVerification = { isValid: true, confidence: 0.8 }; // Placeholder
        
        if (docVerification.isValid) score += 5;
        if (docVerification.confidence > 0.8) score += 5;

        // Check document completeness
        const isComplete = await this.checkDocumentCompleteness(ocrResult.text, asset);
        if (isComplete) score += 5;

        // Verify ownership information
        const ownershipMatch = await this.verifyOwnershipInfo(ocrResult.text, asset);
        if (ownershipMatch) score += 5;
      } catch (error) {
        console.error('Document verification failed:', error);
        // Fallback to basic verification
        score += 3;
      }
    }

    return Math.min(score, maxScore);
  }

  private async verifyGPSLocation(location: any, asset: Asset): Promise<number> {
    let score = 0;
    const maxScore = 20;

    // Verify coordinates are valid
    if (location.coordinates && location.coordinates.lat && location.coordinates.lng) {
      const isValid = await this.validateCoordinates(location.coordinates);
      if (isValid) score += 5;

      try {
        // TODO: Replace with Chainlink Functions or other GPS verification service
        // const gpsVerification = await this.chainlinkService.verifyGPSLocation(
        //   location.coordinates.lat,
        //   location.coordinates.lng,
        //   location.address || ''
        // );
        const gpsVerification = { verified: true, isValid: true, confidence: 0.8 }; // Placeholder
        
        if (gpsVerification.verified) score += 10;
        if (gpsVerification.confidence > 0.8) score += 5;
      } catch (error) {
        console.error('GPS verification failed:', error);
        // Fallback to basic verification
        score += 5;
      }
    }

    return Math.min(score, maxScore);
  }

  private async analyzePhotos(photos: any[], asset: Asset): Promise<number> {
    let score = 0;
    const maxScore = 20;

    for (const photo of photos) {
      // Extract GPS data from photo
      const photoGPS = await this.extractGPSFromPhoto(photo);
      if (photoGPS) score += 5;

      // Analyze photo content
      const contentAnalysis = await this.analyzePhotoContent(photo, asset);
      if (contentAnalysis.matches) score += 10;

      // Check photo timestamp
      const timestampValid = await this.verifyPhotoTimestamp(photo);
      if (timestampValid) score += 5;
    }

    return Math.min(score, maxScore);
  }

  private async verifyMarketPrice(asset: Asset): Promise<number> {
    try {
      // Get current market price from Chainlink
      const marketPrice = await this.chainlinkService.getAssetPrice(asset.type, asset.location.country);
      
      if (marketPrice) {
        const priceDifference = Math.abs(asset.totalValue - marketPrice.price) / marketPrice.price;
        
        // Score based on how close the declared value is to market price
        if (priceDifference <= 0.1) return 15; // Within 10%
        if (priceDifference <= 0.2) return 10; // Within 20%
        if (priceDifference <= 0.3) return 5;  // Within 30%
      }
    } catch (error) {
      console.error('Market price verification failed:', error);
    }
    
    return 0;
  }

  private async verifyWeatherData(asset: Asset): Promise<number> {
    try {
      // TODO: Replace with Chainlink Functions or other weather API
      // const weatherData = await this.chainlinkService.getWeatherData(
      //   asset.location.coordinates.lat,
      //   asset.location.coordinates.lng
      // );
      const weatherData = null; // Placeholder - weather verification disabled

      if (weatherData) {
        // Check if weather conditions are suitable for asset type
        const isSuitable = await this.checkWeatherSuitability(weatherData, asset.type);
        return isSuitable ? 10 : 5;
      }
    } catch (error) {
      console.error('Weather verification failed:', error);
    }
    
    return 0;
  }

  private async verifyHistoricalData(asset: Asset): Promise<number> {
    try {
      // Check if owner has previous successful assets
      const previousAssets = await this.assetModel.find({
        owner: asset.owner,
        status: 'ACTIVE',
        verificationScore: { $gte: 80 }
      });

      if (previousAssets.length > 0) {
        return 10; // Full score for proven track record
      }

      // Check if owner has any previous assets
      const anyPreviousAssets = await this.assetModel.find({ owner: asset.owner });
      return anyPreviousAssets.length > 0 ? 5 : 0;
    } catch (error) {
      console.error('Historical verification failed:', error);
    }
    
    return 0;
  }

  private async findMatchingAttestors(asset: Asset, evidence: any): Promise<AttestorMatch[]> {
    // const attestors = await this.attestorModel.find({ // Removed - attestor functionality deprecated
    const attestors = []; // Placeholder - attestor functionality deprecated
    // if (attestors && attestors.length > 0) {

    const matches: AttestorMatch[] = [];

    for (const attestor of attestors) {
      let score = 0;
      const reasons: string[] = [];

      // Location match (40% weight)
      if (this.isLocationMatch(attestor.country, asset.location)) {
        score += 40;
        reasons.push('Location match');
      }

      // Specialty match (30% weight)
      if (attestor.specialties.includes(asset.type)) {
        score += 30;
        reasons.push('Specialty match');
      }

      // Reputation score (20% weight)
      score += Math.round(attestor.reputation * 0.2);
      reasons.push(`Reputation: ${attestor.reputation}%`);

      // Availability (10% weight) - assume available if active
      if (attestor.isActive) {
        score += 10;
        reasons.push('Available');
      }

      if (score >= 60) {
        matches.push({
          attestor,
          score,
          reason: reasons.join(', '),
        });
      }
    }

    // Sort by score and return top matches
    return matches.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private async assignAttestors(verificationId: string, matches: AttestorMatch[]): Promise<void> {
    const verification = await this.verificationModel.findById(verificationId);
    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    // Assign primary attestor
    const primaryAttestor = matches[0].attestor;
    verification.status = VerificationStatus.EVIDENCE_GATHERING;
    await verification.save();

    // Send notification to attestor
    await this.notifyAttestor(primaryAttestor, verification);

    // Emit event
    this.eventEmitter.emit('verification.assigned', {
      verificationId,
      attestorId: (primaryAttestor as any)._id?.toString() || '',
      assetId: verification.assetId,
    });
  }

  async submitAttestation(verificationId: string, attestorId: string, attestation: any): Promise<void> {
    const verification = await this.verificationModel.findById(verificationId);
    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    // Calculate final score
    const automatedWeight = 0.4;
    const attestorWeight = 0.6;
    const automatedScore = verification.scoring?.automatedScore || 0;
    const finalScore = Math.round(
      (automatedScore * automatedWeight) + 
      (attestation.confidence * attestorWeight)
    );

    // Update verification with attestation
    verification.attestations.push({
      attestorAddress: attestorId,
      confidence: attestation.confidence,
      evidence: JSON.stringify(attestation.evidence),
    });

    verification.scoring = {
      automatedScore,
      attestorScore: attestation.confidence,
      finalScore,
    };

    verification.status = finalScore >= 75 ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
    verification.completedAt = new Date();

    await verification.save();

    // Update asset verification score
    await this.assetModel.updateOne(
      { assetId: verification.assetId },
      { 
        verificationScore: finalScore,
        status: finalScore >= 75 ? 'VERIFIED' : 'REJECTED'
      }
    );

    // If approved, submit to blockchain
    if (verification.status === VerificationStatus.VERIFIED) {
      await this.submitToBlockchain(verification);
    }

    // Emit event
    this.eventEmitter.emit('verification.completed', {
      verificationId,
      assetId: verification.assetId,
      finalScore,
      status: verification.status,
    });
  }

  private async submitToBlockchain(verification: VerificationRequest): Promise<void> {
    try {
      // TODO: Replace with Novax contract calls for Etherlink
      // await this.novaxService.submitVerification({
      //   assetId: verification.assetId,
      //   score: verification.scoring?.finalScore || 0,
      //   evidenceHash: await this.calculateEvidenceHash(verification.evidence),
      //   attestorId: verification.attestations[0]?.attestorAddress || '',
      //   timestamp: verification.completedAt || new Date(),
      // });
      throw new Error('HederaService removed - use Novax contracts for Etherlink');
    } catch (error) {
      console.error('Failed to submit verification to blockchain:', error);
      throw new Error('Blockchain submission failed');
    }
  }

  // Helper methods (implementations would use real APIs)
  private async calculateEvidenceHash(evidence: any): Promise<string> {
    return Buffer.from(JSON.stringify(evidence)).toString('base64');
  }

  private async extractTextFromDocument(doc: any): Promise<string> {
    try {
      // TODO: Replace with Chainlink Functions or other OCR service
      // const ocrResult = await this.chainlinkService.extractTextFromImage(
      //   Buffer.from(doc.data, 'base64'),
      //   doc.mimeType
      // );
      // return ocrResult.text;
      return 'Placeholder - OCR not available';
    } catch (error) {
      console.error('OCR extraction failed:', error);
      return 'Extraction failed';
    }
  }

  private async verifyDocumentAuthenticity(doc: any, text: string): Promise<boolean> {
    try {
      // TODO: Replace with Chainlink Functions or other document verification service
      // const docVerification = await this.chainlinkService.verifyDocument(
      //   Buffer.from(doc.data, 'base64'),
      //   doc.fileName?.includes('land') ? 'land_certificate' : 
      //   doc.fileName?.includes('business') ? 'business_license' : 'identity_document'
      // );
      const docVerification = { isValid: true, confidence: 0.8 }; // Placeholder
      return docVerification.isValid && docVerification.confidence > 0.7;
    } catch (error) {
      console.error('Document authenticity verification failed:', error);
      return false;
    }
  }

  private async checkDocumentCompleteness(text: string, asset: Asset): Promise<boolean> {
    // Check for required fields based on asset type
    const requiredFields = {
      'AGRICULTURAL': ['farm', 'crop', 'hectares', 'location'],
      'REAL_ESTATE': ['property', 'land', 'building', 'location'],
      'MINING': ['mineral', 'mine', 'extraction', 'location'],
    };

    const fields = requiredFields[asset.type] || ['location', 'owner'];
    const textLower = text.toLowerCase();
    
    return fields.every(field => textLower.includes(field));
  }

  private async verifyOwnershipInfo(text: string, asset: Asset): Promise<boolean> {
    // Simple ownership verification - check if owner name appears in document
    const ownerName = asset.owner.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Check for partial name matches
    const nameParts = ownerName.split(' ');
    return nameParts.some(part => part.length > 2 && textLower.includes(part));
  }

  private async validateCoordinates(coords: any): Promise<boolean> {
    return coords.lat >= -90 && coords.lat <= 90 && coords.lng >= -180 && coords.lng <= 180;
  }

  private async compareLocations(location1: any, location2: any): Promise<boolean> {
    // TODO: Implement location comparison
    return true;
  }

  private async verifyLocationExists(coords: any): Promise<boolean> {
    // TODO: Implement location existence verification
    return true;
  }

  private async extractGPSFromPhoto(photo: any): Promise<any> {
    // TODO: Implement GPS extraction from photo metadata
    return null;
  }

  private async analyzePhotoContent(photo: any, asset: Asset): Promise<{ matches: boolean }> {
    // TODO: Implement photo content analysis
    return { matches: true };
  }

  private async verifyPhotoTimestamp(photo: any): Promise<boolean> {
    // TODO: Implement photo timestamp verification
    return true;
  }

  private async checkWeatherSuitability(weatherData: any, assetType: string): Promise<boolean> {
    // TODO: Implement weather suitability check
    return true;
  }

  private isLocationMatch(attestorCountry: string, assetLocation: any): boolean {
    return attestorCountry === assetLocation.country;
  }

  private async notifyAttestor(attestor: any, verification: VerificationRequest): Promise<void> { // Removed - attestor functionality deprecated
    // TODO: Implement attestor notification
    console.log(`Notifying attestor ${attestor.organizationName} about verification ${(verification as any)._id?.toString()}`);
  }

  private async approveVerification(verificationId: string, attestorId: string | null, score: number): Promise<void> {
    const verification = await this.verificationModel.findById(verificationId);
    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    verification.scoring = {
      automatedScore: score,
      attestorScore: 0,
      finalScore: score,
    };
    verification.status = VerificationStatus.VERIFIED;
    verification.completedAt = new Date();

    await verification.save();

    // Update asset
    await this.assetModel.updateOne(
      { assetId: verification.assetId },
      { 
        verificationScore: score,
        status: 'VERIFIED'
      }
    );

    // Submit to blockchain
    await this.submitToBlockchain(verification);
  }

  async getVerificationStatus(assetId: string): Promise<VerificationRequest> {
    const verification = await this.verificationModel.findOne({ assetId }).sort({ createdAt: -1 });
    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }
    return verification;
  }

  async getAllVerifications(): Promise<VerificationRequest[]> {
    return this.verificationModel.find().sort({ createdAt: -1 });
  }

  async getAttestorVerifications(attestorAddress: string): Promise<VerificationRequest[]> {
    try {
      // For now, return all pending verification requests
      // In a real implementation, this would filter by attestor type and availability
      const verifications = await this.verificationModel
        .find({ 
          status: 'PENDING',
          // Add more filtering logic here based on attestor type and requirements
        })
        .sort({ createdAt: -1 })
        .exec();
      
      console.log(`Found ${verifications.length} verification requests for attestor ${attestorAddress}`);
      return verifications;
    } catch (error) {
      console.error('Failed to get attestor verifications:', error);
      throw new Error('Failed to retrieve attestor verifications');
    }
  }

  async getUserVerifications(userId: string): Promise<VerificationRequest[]> {
    return this.verificationModel.find({ userId }).sort({ createdAt: -1 });
  }

  async getVerificationById(id: string): Promise<VerificationRequest> {
    const verification = await this.verificationModel.findById(id).exec();
    if (!verification) {
      throw new Error('Verification request not found');
    }
    return verification;
  }

  async createBulkMinimalVerifications(verifications: any[]): Promise<VerificationRequest[]> {
    try {
      console.log(`Creating ${verifications.length} minimal verification requests (blockchain-first)...`);
      
      const createdVerifications = [];
      
      for (const verificationData of verifications) {
        try {
          // Check if verification already exists for this assetId
          const existingVerification = await this.verificationModel.findOne({ 
            assetId: verificationData.assetId 
          });
          
          if (existingVerification) {
            console.log(`Verification already exists for asset ${verificationData.assetId}, skipping...`);
            continue;
          }
          
          // Create minimal verification request - only store what's NOT on blockchain
          const verification = new this.verificationModel({
            assetId: verificationData.assetId, // Reference to blockchain asset
            status: verificationData.status || 'SUBMITTED', // Local status only
            submittedBy: verificationData.submittedBy, // User reference
            documents: verificationData.documents || [], // File references only
            photos: verificationData.photos || [] // File references only
            // Don't store asset metadata, scores, evidence - they're on blockchain
          });
          
          const savedVerification = await verification.save();
          createdVerifications.push(savedVerification);
          
          console.log(`✅ Created minimal verification for asset: ${verificationData.assetId}`);
          
        } catch (error) {
          console.error(`❌ Error creating verification for asset ${verificationData.assetId}:`, error.message);
        }
      }
      
      console.log(`Successfully created ${createdVerifications.length} minimal verification requests`);
      return createdVerifications;
      
    } catch (error) {
      console.error('Error in createBulkMinimalVerifications:', error);
      throw error;
    }
  }

  async createBulkVerifications(verifications: any[]): Promise<VerificationRequest[]> {
    try {
      console.log(`Creating ${verifications.length} verification requests...`);
      
      const createdVerifications = [];
      
      for (const verificationData of verifications) {
        try {
          // Check if verification already exists for this assetId
          const existingVerification = await this.verificationModel.findOne({ 
            assetId: verificationData.assetId 
          });
          
          if (existingVerification) {
            console.log(`Verification already exists for asset ${verificationData.assetId}, skipping...`);
            continue;
          }
          
          // Create new verification request
          const verification = new this.verificationModel({
            assetId: verificationData.assetId,
            assetName: verificationData.assetName,
            assetType: verificationData.assetType,
            status: verificationData.status || 'SUBMITTED',
            submittedBy: verificationData.submittedBy,
            evidence: verificationData.evidence || [],
            scoring: verificationData.scoring || {
              automatedScore: 0,
              attestorScore: 0,
              finalScore: 0
            },
            attestations: verificationData.attestations || [],
            documents: verificationData.documents || [],
            photos: verificationData.photos || []
          });
          
          const savedVerification = await verification.save();
          createdVerifications.push(savedVerification);
          
          console.log(`✅ Created verification for asset: ${verificationData.assetName}`);
          
        } catch (error) {
          console.error(`❌ Error creating verification for asset ${verificationData.assetId}:`, error.message);
        }
      }
      
      console.log(`Successfully created ${createdVerifications.length} verification requests`);
      return createdVerifications;
      
    } catch (error) {
      console.error('Error in createBulkVerifications:', error);
      throw error;
    }
  }
}
