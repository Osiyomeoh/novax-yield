import { Injectable, Logger } from '@nestjs/common';
import { ChainlinkFunctionsService } from '../chainlink/chainlink-functions.service';

export interface TradeVerificationRequest {
  exporter: {
    name: string;
    address: string;
    country: string;
    walletAddress: string;
    kycStatus: string;
  };
  importer: {
    name: string;
    address: string;
    country: string;
    walletAddress: string;
    kybStatus: string;
  };
  trade: {
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    commodity: string;
    tradeDate: string;
    shippingTerms: string;
    paymentTerms: string;
    description: string;
  };
  documents: string[]; // IPFS CIDs
}

export interface TradeVerificationResult {
  verified: boolean;
  riskScore: number;
  apr: number;
  reason?: string;
  details?: {
    exporterVerified: boolean;
    importerVerified: boolean;
    documentsValid: boolean;
    tradeConsistent: boolean;
  };
}

@Injectable()
export class TradeVerificationService {
  private readonly logger = new Logger(TradeVerificationService.name);

  constructor(
    private chainlinkFunctionsService: ChainlinkFunctionsService,
  ) {}

  /**
   * Verify a trade transaction
   * Checks: exporter KYC, importer KYB, document authenticity, trade consistency
   */
  async verifyTrade(request: TradeVerificationRequest): Promise<TradeVerificationResult> {
    this.logger.log(`Verifying trade: Invoice ${request.trade.invoiceNumber}`);

    try {
      const details = {
        exporterVerified: false,
        importerVerified: false,
        documentsValid: false,
        tradeConsistent: false,
      };

      // Step 1: Verify Exporter (KYC)
      if (request.exporter.kycStatus === 'approved' || request.exporter.kycStatus === 'verified') {
        details.exporterVerified = true;
        this.logger.log(`Exporter ${request.exporter.name} is verified (KYC: ${request.exporter.kycStatus})`);
      } else {
        this.logger.warn(`Exporter ${request.exporter.name} is not verified (KYC: ${request.exporter.kycStatus})`);
        return {
          verified: false,
          riskScore: 100,
          apr: 0,
          reason: 'Exporter KYC verification required',
          details,
        };
      }

      // Step 2: Verify Importer (KYB)
      if (request.importer.kybStatus === 'verified' || request.importer.kybStatus === 'approved') {
        details.importerVerified = true;
        this.logger.log(`Importer ${request.importer.name} is verified (KYB: ${request.importer.kybStatus})`);
      } else {
        this.logger.warn(`Importer ${request.importer.name} is not verified (KYB: ${request.importer.kybStatus})`);
        return {
          verified: false,
          riskScore: 100,
          apr: 0,
          reason: 'Importer KYB verification required',
          details,
        };
      }

      // Step 3: Verify Documents
      if (request.documents.length >= 3) {
        // At minimum: Invoice, Bill of Lading, Certificate of Origin
        details.documentsValid = true;
        this.logger.log(`Documents valid: ${request.documents.length} documents provided`);
      } else {
        this.logger.warn(`Insufficient documents: ${request.documents.length} provided, minimum 3 required`);
        return {
          verified: false,
          riskScore: 80,
          apr: 0,
          reason: 'Insufficient trade documents. Required: Invoice, Bill of Lading, Certificate of Origin',
          details,
        };
      }

      // Step 4: Verify Trade Consistency using Chainlink Functions
      // This will check invoice authenticity, cross-reference documents, etc.
      const metadataCID = request.documents[0]; // Use invoice document CID as primary
      
      const invoiceVerification = await this.chainlinkFunctionsService.verifyInvoice(
        request.trade.invoiceNumber,
        metadataCID,
        request.trade.commodity,
        parseFloat(request.trade.amount),
        request.exporter.country,
        request.importer.country,
        request.exporter.name,
        request.importer.name
      );

      if (invoiceVerification.verified) {
        details.tradeConsistent = true;
        this.logger.log(`Trade verified successfully. Risk Score: ${invoiceVerification.riskScore}, APR: ${invoiceVerification.apr}`);
      } else {
        this.logger.warn(`Trade verification failed: ${invoiceVerification.reason}`);
        return {
          verified: false,
          riskScore: invoiceVerification.riskScore || 90,
          apr: invoiceVerification.apr || 0,
          reason: invoiceVerification.reason || 'Trade verification failed',
          details,
        };
      }

      // All checks passed
      return {
        verified: true,
        riskScore: invoiceVerification.riskScore,
        apr: invoiceVerification.apr,
        details,
      };
    } catch (error) {
      this.logger.error(`Trade verification error:`, error);
      return {
        verified: false,
        riskScore: 100,
        apr: 0,
        reason: `Verification error: ${error.message}`,
        details: {
          exporterVerified: false,
          importerVerified: false,
          documentsValid: false,
          tradeConsistent: false,
        },
      };
    }
  }
}

