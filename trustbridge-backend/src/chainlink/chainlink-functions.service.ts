import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface InvoiceVerificationResult {
  verified: boolean;
  riskScore: number; // 0-100
  apr: number; // Basis points (e.g., 1200 = 12%)
  reason?: string;
}

@Injectable()
export class ChainlinkFunctionsService {
  private readonly logger = new Logger(ChainlinkFunctionsService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Verify invoice authenticity and calculate risk/APR
   * This is called by Chainlink Functions
   */
  async verifyInvoice(
    receivableId: string,
    metadataCID: string,
    commodity?: string,
    amount?: number,
    supplierCountry?: string,
    buyerCountry?: string,
    exporterName?: string,
    buyerName?: string
  ): Promise<InvoiceVerificationResult> {
    this.logger.log(`Verifying invoice: ${receivableId}, CID: ${metadataCID}`);

    try {
      // Step 1: Fetch invoice metadata from IPFS
      const invoiceData = await this.fetchIPFSData(metadataCID);
      
      if (!invoiceData) {
        return {
          verified: false,
          riskScore: 100,
          apr: 0,
          reason: 'Failed to fetch invoice from IPFS'
        };
      }

      // Step 2: Extract invoice details (use provided params or fallback to IPFS data)
      const invoiceCommodity = commodity || invoiceData.commodity;
      const invoiceAmount = amount || invoiceData.amount;
      const invoiceSupplierCountry = supplierCountry || invoiceData.supplierCountry || invoiceData.country;
      const invoiceBuyerCountry = buyerCountry || invoiceData.buyerCountry;
      const invoiceExporterName = exporterName || invoiceData.exporterName || invoiceData.exporter;
      const invoiceBuyerName = buyerName || invoiceData.buyerName || invoiceData.importer;
      
      const {
        exporter,
        importer,
        dueDate,
        invoiceNumber,
        documents,
        billOfLading,
        certificateOfOrigin
      } = invoiceData;

      // Step 3: Perform verification checks
      let verified = true;
      let riskScore = 25; // Start with low risk
      const reasons: string[] = [];

      // Check 1: Required fields
      if (!exporter || !importer || !amount || !dueDate) {
        verified = false;
        reasons.push('Missing required fields');
      }

      // Check 2: Amount validation
      if (invoiceAmount && (invoiceAmount <= 0 || invoiceAmount > 100000000)) {
        verified = false;
        reasons.push('Invalid invoice amount');
      }

      // Check 3: Due date validation
      const currentDate = Math.floor(Date.now() / 1000);
      if (dueDate && dueDate <= currentDate) {
        verified = false;
        reasons.push('Due date must be in the future');
      }

      // Check 4: Document completeness
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        riskScore += 20;
        reasons.push('Missing supporting documents');
      }

      // Check 5: Country risk assessment
      if (invoiceSupplierCountry) {
        const countryRisk = this.getCountryRiskScore(invoiceSupplierCountry);
        riskScore = Math.max(riskScore, countryRisk);
      }

      // Check 6: Commodity validation
      if (invoiceCommodity) {
        // Could validate commodity price against market data
        const commodityRisk = this.getCommodityRisk(invoiceCommodity);
        riskScore = Math.max(riskScore, commodityRisk);
      }

      // Check 7: Sanctions check (simplified - in production, call sanctions API)
      if (invoiceExporterName || exporter) {
        const entityToCheck = invoiceExporterName || exporter;
        const isSanctioned = await this.checkSanctions(entityToCheck);
        if (isSanctioned) {
          verified = false;
          reasons.push('Exporter on sanctions list');
        }
      }

      // Check 8: Fraud detection patterns
      const fraudIndicators = this.detectFraudPatterns(invoiceData);
      if (fraudIndicators.length > 0) {
        riskScore += fraudIndicators.length * 10;
        reasons.push(...fraudIndicators);
      }

      // Calculate APR based on risk score
      const apr = this.calculateAPR(riskScore);

      // If verification failed, set maximum risk
      if (!verified) {
        riskScore = 100;
        return {
          verified: false,
          riskScore: 100,
          apr: 0,
          reason: reasons.join('; ')
        };
      }

      return {
        verified: true,
        riskScore: Math.min(riskScore, 100), // Cap at 100
        apr,
        reason: reasons.length > 0 ? reasons.join('; ') : undefined
      };

    } catch (error: any) {
      this.logger.error('Invoice verification error:', error);
      return {
        verified: false,
        riskScore: 100,
        apr: 0,
        reason: `Verification error: ${error.message}`
      };
    }
  }

  /**
   * Fetch data from IPFS
   */
  private async fetchIPFSData(cid: string): Promise<any> {
    try {
      // Try multiple IPFS gateways
      const gateways = [
        `https://ipfs.io/ipfs/${cid}`,
        `https://gateway.pinata.cloud/ipfs/${cid}`,
        `https://cloudflare-ipfs.com/ipfs/${cid}`,
        `https://dweb.link/ipfs/${cid}`
      ];

      for (const gateway of gateways) {
        try {
          const response = await axios.get(gateway, { timeout: 5000 });
          return response.data;
        } catch (error) {
          continue; // Try next gateway
        }
      }

      return null;
    } catch (error) {
      this.logger.error('IPFS fetch error:', error);
      return null;
    }
  }

  /**
   * Get country risk score (0-100)
   */
  private getCountryRiskScore(countryCode: string): number {
    const countryRisks: Record<string, number> = {
      'NG': 45, // Nigeria: 4.5%
      'KE': 35, // Kenya: 3.5%
      'GH': 30, // Ghana: 3.0%
      'ET': 40, // Ethiopia: 4.0%
      'ZA': 25, // South Africa: 2.5%
      'TZ': 38, // Tanzania: 3.8%
      'UG': 42, // Uganda: 4.2%
      'RW': 35, // Rwanda: 3.5%
      'SN': 32, // Senegal: 3.2%
      'CI': 40, // Côte d'Ivoire: 4.0%
    };

    return countryRisks[countryCode.toUpperCase()] || 50; // Default: 5.0%
  }

  /**
   * Get commodity risk
   */
  private getCommodityRisk(commodity: string): number {
    // Lower risk for established commodities
    const lowRiskCommodities = ['coffee', 'cocoa', 'tea', 'cotton', 'gold'];
    const commodityLower = commodity.toLowerCase();
    
    if (lowRiskCommodities.includes(commodityLower)) {
      return 25; // Low risk
    }
    
    return 40; // Medium risk for other commodities
  }

  /**
   * Check if address is on sanctions list
   */
  private async checkSanctions(address: string): Promise<boolean> {
    // In production, this would call a sanctions API
    // For now, return false (not sanctioned)
    // TODO: Integrate with OFAC or similar sanctions API
    return false;
  }

  /**
   * Detect fraud patterns in invoice data
   */
  private detectFraudPatterns(invoiceData: any): string[] {
    const indicators: string[] = [];

    // Pattern 1: Suspiciously round numbers
    if (invoiceData.amount && invoiceData.amount % 10000 === 0) {
      indicators.push('Round number amount');
    }

    // Pattern 2: Very short due date
    const currentDate = Math.floor(Date.now() / 1000);
    if (invoiceData.dueDate && (invoiceData.dueDate - currentDate) < 7 * 24 * 60 * 60) {
      indicators.push('Very short payment term');
    }

    // Pattern 3: Missing critical documents
    if (!invoiceData.billOfLading && !invoiceData.certificateOfOrigin) {
      indicators.push('Missing trade documents');
    }

    return indicators;
  }

  /**
   * Calculate APR based on risk score
   */
  private calculateAPR(riskScore: number): number {
    // APR in basis points (100 = 1%)
    if (riskScore <= 25) {
      return 1000; // 10% APR for low risk
    } else if (riskScore <= 40) {
      return 1200; // 12% APR for medium risk
    } else if (riskScore <= 60) {
      return 1500; // 15% APR for medium-high risk
    } else if (riskScore <= 80) {
      return 2000; // 20% APR for high risk
    } else {
      return 2500; // 25% APR for very high risk
    }
  }
}

