import { Controller, Post, Get, Param, UseGuards, Request, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KycService } from './kyc.service';
import { KybService } from './kyb.service';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly kybService: KybService,
  ) {}

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start KYC verification process' })
  @ApiResponse({ status: 200, description: 'KYC process started successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startKYC(@Request() req: any) {
    const userId = req.user.sub;
    const result = await this.kycService.startKYC(userId);
    
    return {
      success: true,
      data: result,
      message: 'KYC process started successfully',
    };
  }

  @Get('status/:inquiryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check KYC verification status' })
  @ApiResponse({ status: 200, description: 'KYC status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkKYCStatus(@Param('inquiryId') inquiryId: string) {
    const result = await this.kycService.checkKYCStatus(inquiryId);
    
    return {
      success: true,
      data: result,
      message: 'KYC status retrieved successfully',
    };
  }

  @Get('inquiry/:inquiryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC inquiry details' })
  @ApiResponse({ status: 200, description: 'KYC inquiry details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getKYCInquiry(@Param('inquiryId') inquiryId: string) {
    const result = await this.kycService.getKYCInquiry(inquiryId);
    
    return {
      success: true,
      data: result,
      message: 'KYC inquiry details retrieved successfully',
    };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Persona webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Request() req: any) {
    const result = await this.kycService.handleWebhook(req.body);
    
    return {
      success: true,
      data: result,
      message: 'Webhook processed successfully',
    };
  }

  @Post('start-kyb')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start KYB (Know Your Business) verification for importer' })
  @ApiResponse({ status: 200, description: 'KYB process started successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startKYB(@Request() req: any, @Body() body: {
    businessName: string;
    businessAddress: string;
    country: string;
    walletAddress: string;
    type: 'exporter' | 'importer';
    email?: string;
    phone?: string;
  }) {
    const result = await this.kybService.startKYB(body);
    
    return {
      success: true,
      data: result,
      message: 'KYB process started successfully',
    };
  }

  @Get('kyb-status/:inquiryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check KYB verification status' })
  @ApiResponse({ status: 200, description: 'KYB status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkKYBStatus(@Param('inquiryId') inquiryId: string) {
    const result = await this.kybService.checkKYBStatus(inquiryId);
    
    return {
      success: true,
      data: result,
      message: 'KYB status retrieved successfully',
    };
  }

  @Post('kyb-callback')
  @ApiOperation({ summary: 'Handle DidIt KYB callback events' })
  @ApiResponse({ status: 200, description: 'KYB callback processed successfully' })
  async handleKYBCallback(@Request() req: any) {
    const { session_id, status } = req.body;
    const result = await this.kybService.processDiditCallback(session_id, status);
    
    return {
      success: true,
      data: result,
      message: 'KYB callback processed successfully',
    };
  }
}
