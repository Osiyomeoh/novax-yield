import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ChainlinkFunctionsService } from './chainlink-functions.service';

/**
 * Chainlink Functions Verification Endpoint
 * 
 * This endpoint is called by Chainlink Functions to verify invoices
 * Must return compact response (<256 bytes) for on-chain use
 */
@ApiTags('Chainlink Functions')
@Controller('chainlink/functions')
export class ChainlinkFunctionsController {
  private readonly logger = new Logger(ChainlinkFunctionsController.name);

  constructor(
    private readonly chainlinkFunctionsService: ChainlinkFunctionsService
  ) {}

  @Post('verify-invoice')
  @ApiOperation({ 
    summary: 'Chainlink Functions endpoint for invoice verification',
    description: 'Called by Chainlink Functions to verify invoice authenticity. Returns compact CSV response for on-chain use.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification result in compact CSV format',
    schema: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          example: '1,25,A'
        }
      }
    }
  })
  async verifyInvoice(
    @Body() body: { 
      receivableId?: string; 
      metadataCID?: string;
      commodity?: string;
      amount?: number;
      supplierCountry?: string;
      buyerCountry?: string;
      exporterName?: string;
      buyerName?: string;
    },
    @Headers('user-agent') userAgent?: string
  ) {
    this.logger.log('🔗 Chainlink Functions verification request received');
    
    // Detect if this is a Chainlink Functions request
    const isChainlinkRequest = userAgent?.includes('Chainlink') || 
                              userAgent?.includes('Functions') ||
                              !userAgent; // Chainlink might not send user-agent

    if (isChainlinkRequest) {
      this.logger.log('✅ Detected Chainlink Functions request');
    }

    try {
      const { 
        receivableId, 
        metadataCID,
        commodity,
        amount,
        supplierCountry,
        buyerCountry,
        exporterName,
        buyerName
      } = body;

      if (!receivableId || !metadataCID) {
        this.logger.warn('⚠️ Missing required parameters');
        return { result: '0,99,ERROR' }; // Return failure response
      }

      // Perform verification
      const result = await this.chainlinkFunctionsService.verifyInvoice(
        receivableId,
        metadataCID,
        commodity,
        amount,
        supplierCountry,
        buyerCountry,
        exporterName,
        buyerName
      );

      // Return compact CSV response: "isValid,riskScore,creditRating"
      // Format: 1 or 0 (isValid), 0-100 (riskScore), AAA/AA/A/BBB/BB/B/D/ERROR (creditRating)
      const isValid = result.verified ? 1 : 0;
      const creditRating = this.getCreditRating(result.riskScore);
      const response = `${isValid},${result.riskScore},${creditRating}`;
      
      this.logger.log(`✅ Verification result: ${response}`);
      
      // Ensure response is under 256 bytes (Chainlink Functions limit)
      if (Buffer.from(response).length > 256) {
        this.logger.warn('⚠️ Response too long, truncating');
        return { result: response.substring(0, 200) };
      }

      return { result: response };
    } catch (error: any) {
      this.logger.error('❌ Verification error:', error);
      // Return failure in compact CSV format
      return { result: '0,99,ERROR' };
    }
  }

  /**
   * Get credit rating based on risk score
   */
  private getCreditRating(riskScore: number): string {
    if (riskScore <= 20) return 'AAA';
    if (riskScore <= 30) return 'AA';
    if (riskScore <= 40) return 'A';
    if (riskScore <= 50) return 'BBB';
    if (riskScore <= 60) return 'BB';
    if (riskScore <= 80) return 'B';
    return 'D';
  }

  @Post('health')
  @ApiOperation({ summary: 'Health check for Chainlink Functions endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      success: true,
      message: 'Chainlink Functions verification service is operational',
      timestamp: new Date().toISOString()
    };
  }
}

