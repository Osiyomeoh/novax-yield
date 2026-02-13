import { Controller, Get, Post, Body, Param, HttpException, HttpStatus, UseInterceptors, UploadedFile, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsObject, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationService } from './verification.service';
import { TradeVerificationService } from './trade-verification.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { IPFSService } from '../services/ipfs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export class AttestationDataDto {
  @ApiProperty({ example: 92 })
  @IsNumber()
  confidence: number;

  @ApiProperty({ example: 'High-quality coffee farm with excellent management' })
  @IsString()
  comments: string;

  @ApiProperty({ example: { siteVisit: { findings: 'Farm is well-maintained' } } })
  @IsObject()
  evidence: any;
}

export class SubmitAttestationDto {
  @ApiProperty({ example: 'verification_123' })
  @IsString()
  verificationId: string;

  @ApiProperty({ example: 'attestor_456' })
  @IsString()
  attestorId: string;

  @ApiProperty({ type: AttestationDataDto })
  @ValidateNested()
  @Type(() => AttestationDataDto)
  attestation: AttestationDataDto;
}

export class IPFSFileDto {
  @ApiProperty({ example: 'QmYourFileHash' })
  @IsString()
  cid: string;

  @ApiProperty({ example: 'https://gateway.pinata.cloud/ipfs/QmYourFileHash' })
  @IsString()
  ipfsUrl: string;

  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  fileType: string;

  @ApiProperty({ example: 1024000 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ example: 'Ownership document', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'verification_document', required: false })
  @IsOptional()
  @IsString()
  category?: string;
}

export class SubmitVerificationWithFilesDto {
  @ApiProperty({ example: 'asset_123' })
  @IsString()
  assetId: string;

  @ApiProperty({ example: 'Coffee farm verification' })
  @IsString()
  description: string;

  @ApiProperty({ type: [IPFSFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IPFSFileDto)
  documents: IPFSFileDto[];

  @ApiProperty({ type: [IPFSFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IPFSFileDto)
  photos: IPFSFileDto[];

  @ApiProperty({ example: { location: { lat: 6.5244, lng: 3.3792 } } })
  @IsObject()
  evidence: any;
}

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly tradeVerificationService: TradeVerificationService,
    private readonly ipfsService: IPFSService,
  ) {}

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint' })
  @ApiResponse({ status: 200, description: 'Test successful' })
  async test() {
    return {
      success: true,
      message: 'Verification API is working',
      timestamp: new Date().toISOString()
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all verification requests' })
  @ApiResponse({ status: 200, description: 'Verification requests retrieved successfully' })
  async getAllVerifications() {
    try {
      const verifications = await this.verificationService.getAllVerifications();
      return {
        success: true,
        data: verifications,
        message: `Found ${verifications.length} verification requests`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('user')
  @ApiOperation({ summary: 'Get verification requests for current user' })
  @ApiResponse({ status: 200, description: 'User verification requests retrieved successfully' })
  async getUserVerifications(@Req() req: any) {
    try {
      // For now, get all verifications since we don't have proper auth
      // In production, this should use the authenticated user's ID
      const verifications = await this.verificationService.getAllVerifications();
      
      return {
        success: true,
        data: verifications,
        message: `Found ${verifications.length} verification requests`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }


  @Post('bulk-create-minimal')
  @ApiOperation({ summary: 'Create minimal verification requests (blockchain-first approach)' })
  @ApiResponse({ status: 201, description: 'Minimal verification requests created successfully' })
  async createBulkMinimalVerifications(@Body() body: { verifications: any[] }) {
    try {
      const { verifications } = body;
      
      const createdVerifications = await this.verificationService.createBulkMinimalVerifications(verifications);
      
      return {
        success: true,
        data: createdVerifications,
        message: `Successfully created ${createdVerifications.length} minimal verification requests`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('bulk-create')
  @ApiOperation({ summary: 'Create multiple verification requests' })
  @ApiResponse({ status: 201, description: 'Verification requests created successfully' })
  async createBulkVerifications(@Body() body: { verifications: any[] }) {
    try {
      const { verifications } = body;
      
      const createdVerifications = await this.verificationService.createBulkVerifications(verifications);
      
      return {
        success: true,
        data: createdVerifications,
        message: `Successfully created ${createdVerifications.length} verification requests`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status/:assetId')
  @ApiOperation({ summary: 'Get verification status for asset' })
  @ApiResponse({ status: 200, description: 'Verification status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Verification request not found' })
  async getVerificationStatus(@Param('assetId') assetId: string) {
    try {
      const verification = await this.verificationService.getVerificationStatus(assetId);
      return {
        success: true,
        data: verification,
        message: 'Verification status retrieved successfully'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('attestor')
  @ApiOperation({ summary: 'Get verification requests for attestors' })
  @ApiResponse({ status: 200, description: 'Attestor verification requests retrieved successfully' })
  async getAttestorVerifications(@Req() req: any) {
    try {
      // Get all verifications from database and transform to frontend format
      const verifications = await this.verificationService.getAllVerifications();
      
      // Transform database verifications to frontend format
      const transformedVerifications = verifications.map((verification: any) => ({
        requestId: verification._id,
        assetId: verification.assetId,
        status: verification.status.toLowerCase(),
        requiredType: 0, // Default attestor type
        evidenceHashes: verification.evidence?.map((e: any) => e.hash || '') || [],
        documentTypes: verification.evidence?.map((e: any) => e.type || 'Document') || [],
        fee: '0.1', // Default fee
        deadline: verification.createdAt ? new Date(verification.createdAt).getTime() + (7 * 24 * 60 * 60 * 1000) : Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from creation
        submittedAt: verification.createdAt ? new Date(verification.createdAt).getTime() : Date.now(),
        score: verification.scoring?.finalScore || 0,
        owner: verification.submittedBy || '0x0000000000000000000000000000000000000000',
        attestors: []
      }));

      console.log(`📋 Found ${transformedVerifications.length} verification requests for attestor`);
      
      return {
        success: true,
        data: transformedVerifications,
        message: `Found ${transformedVerifications.length} verification requests for attestor`
      };
    } catch (error) {
      console.error('Error getting attestor verifications:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get verification request by ID' })
  @ApiResponse({ status: 200, description: 'Verification request retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Verification request not found' })
  async getVerificationById(@Param('id') id: string) {
    try {
      const verification = await this.verificationService.getVerificationById(id);
      return {
        success: true,
        data: verification,
        message: 'Verification request retrieved successfully'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit asset for verification' })
  @ApiBody({ type: SubmitVerificationDto })
  @ApiResponse({ status: 201, description: 'Verification request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid verification request' })
  async submitVerification(@Body() submitVerificationDto: SubmitVerificationDto) {
    try {
      const verification = await this.verificationService.submitVerificationRequest(
        submitVerificationDto.assetId,
        submitVerificationDto.evidence
      );

      return {
        success: true,
        data: verification,
        message: 'Verification request submitted successfully'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('attestation')
  @ApiOperation({ summary: 'Submit attestation for verification' })
  @ApiBody({ type: SubmitAttestationDto })
  @ApiResponse({ status: 200, description: 'Attestation submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid attestation' })
  async submitAttestation(@Body() submitAttestationDto: SubmitAttestationDto) {
    try {
      await this.verificationService.submitAttestation(
        submitAttestationDto.verificationId,
        submitAttestationDto.attestorId,
        submitAttestationDto.attestation
      );

      return {
        success: true,
        message: 'Attestation submitted successfully'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('submit-with-files')
  @ApiOperation({ summary: 'Submit verification with IPFS files' })
  @ApiBody({ type: SubmitVerificationWithFilesDto })
  @ApiResponse({ status: 201, description: 'Verification with files submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid verification request' })
  async submitVerificationWithFiles(@Body() submitDto: SubmitVerificationWithFilesDto) {
    try {
      const verification = await this.verificationService.submitVerificationWithFiles(
        submitDto.assetId,
        submitDto.description,
        submitDto.documents,
        submitDto.photos,
        submitDto.evidence
      );

      return {
        success: true,
        data: verification,
        message: 'Verification with files submitted successfully'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('upload-document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload verification document to IPFS' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      category?: string;
      description?: string;
      tags?: string;
    }
  ) {
    try {
      if (!file) {
        throw new HttpException(
          { success: false, message: 'No file provided' },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.ipfsService.uploadFile(file, {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        category: body.category || 'verification_document',
        description: body.description || '',
        tags: body.tags ? body.tags.split(',').map(tag => tag.trim()) : []
      });

      return {
        success: true,
        data: result,
        message: 'Document uploaded successfully to IPFS'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload verification photo to IPFS' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Photo uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      description?: string;
      tags?: string;
    }
  ) {
    try {
      if (!file) {
        throw new HttpException(
          { success: false, message: 'No file provided' },
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate image file
      if (!file.mimetype.startsWith('image/')) {
        throw new HttpException(
          { success: false, message: 'File must be an image' },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.ipfsService.uploadFile(file, {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        category: 'verification_photo',
        description: body.description || '',
        tags: body.tags ? body.tags.split(',').map(tag => tag.trim()) : []
      });

      return {
        success: true,
        data: result,
        message: 'Photo uploaded successfully to IPFS'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('verify-trade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify trade transaction (exporter, importer, and trade documents)' })
  @ApiResponse({ status: 200, description: 'Trade verification completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyTrade(@Body() body: any) {
    const result = await this.tradeVerificationService.verifyTrade(body);
    
    return {
      success: result.verified,
      verified: result.verified,
      riskScore: result.riskScore,
      apr: result.apr,
      reason: result.reason,
      details: result.details,
      message: result.verified 
        ? 'Trade verified successfully' 
        : `Trade verification failed: ${result.reason}`,
    };
  }
}
