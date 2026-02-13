import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req, Res, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IPFSService, IPFSUploadResult, IPFSFileMetadata } from './ipfs.service';
import { Response } from 'express';

export class PresignedUrlRequestDto {
  fileName: string;
  fileSize: number;
  fileType: string;
  metadata?: IPFSFileMetadata;
}

export class PinFileRequestDto {
  cid: string;
  metadata?: IPFSFileMetadata;
}

@ApiTags('IPFS')
@Controller('ipfs')
export class IPFSController {
  constructor(private readonly ipfsService: IPFSService) {}

  @Post('presigned-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate presigned URL for file upload' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async generatePresignedUrl(@Body() request: PresignedUrlRequestDto) {
    try {
      const result = await this.ipfsService.generatePresignedUrl(
        request.fileName,
        request.fileType,
        request.metadata
      );

      return {
        success: true,
        data: result,
        message: 'Presigned URL generated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate presigned URL',
        error: error.message
      };
    }
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload file to IPFS' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Upload failed' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('fileName') fileName: string,
    @Body('fileType') fileType: string,
    @Body('metadata') metadata?: string
  ) {
    try {
      if (!file) {
        return {
          success: false,
          message: 'No file provided'
        };
      }

      // Parse metadata if provided
      let parsedMetadata: IPFSFileMetadata | undefined;
      if (metadata) {
        try {
          parsedMetadata = JSON.parse(metadata);
        } catch (e) {
          console.warn('Failed to parse metadata:', e);
        }
      }

      const result = await this.ipfsService.uploadFile(
        file.buffer,
        fileName || file.originalname,
        fileType || file.mimetype,
        parsedMetadata
      );

      return {
        success: true,
        data: result,
        message: 'File uploaded successfully'
      };
    } catch (error) {
      console.error('IPFS upload error in controller:', error);
      return {
        success: false,
        message: `Upload failed: ${error.message}`,
        error: error.message
      };
    }
  }

  @Post('upload-json')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload JSON data to IPFS' })
  @ApiResponse({ status: 200, description: 'JSON uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Upload failed' })
  async uploadJson(
    @Body() body: { data: any; fileName?: string; metadata?: IPFSFileMetadata }
  ) {
    try {
      if (!body.data) {
        return {
          success: false,
          message: 'No JSON data provided'
        };
      }

      const result = await this.ipfsService.uploadJson(
        body.data,
        body.fileName,
        body.metadata
      );

      return {
        success: true,
        cid: result.cid,
        data: result,
        message: 'JSON uploaded successfully'
      };
    } catch (error) {
      console.error('IPFS JSON upload error in controller:', error);
      return {
        success: false,
        message: `Upload failed: ${error.message}`,
        error: error.message
      };
    }
  }

  @Post('pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pin file to IPFS' })
  @ApiResponse({ status: 200, description: 'File pinned successfully' })
  @ApiResponse({ status: 400, description: 'Pin failed' })
  async pinFile(@Body() request: PinFileRequestDto) {
    try {
      const result = await this.ipfsService.pinFile(request.cid, request.metadata?.name);

      return {
        success: true,
        data: result,
        message: 'File pinned successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Pin failed',
        error: error.message
      };
    }
  }

  @Delete('unpin/:cid')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpin file from IPFS' })
  @ApiResponse({ status: 200, description: 'File unpinned successfully' })
  @ApiResponse({ status: 400, description: 'Unpin failed' })
  async unpinFile(@Param('cid') cid: string) {
    try {
      const success = await this.ipfsService.unpinFile(cid);

      return {
        success,
        message: success ? 'File unpinned successfully' : 'Failed to unpin file'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Unpin failed',
        error: error.message
      };
    }
  }

  @Get('file/:cid')
  @ApiOperation({ summary: 'Get file from IPFS' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(@Param('cid') cid: string, @Res() res: Response) {
    try {
      const fileUrl = this.ipfsService.getIPFSUrl(cid);
      
      // Redirect to the IPFS URL
      res.redirect(fileUrl);
    } catch (error) {
      throw new BadRequestException('File not found');
    }
  }

  @Get('metadata/:cid')
  @ApiOperation({ summary: 'Get file metadata from IPFS' })
  @ApiResponse({ status: 200, description: 'Metadata retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileMetadata(@Param('cid') cid: string) {
    try {
      const metadata = await this.ipfsService.getFileMetadata(cid);

      if (!metadata) {
        return {
          success: false,
          message: 'File not found'
        };
      }

      return {
        success: true,
        data: metadata,
        message: 'Metadata retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get metadata',
        error: error.message
      };
    }
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all pinned files' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  @ApiResponse({ status: 400, description: 'Failed to list files' })
  async listPinnedFiles() {
    try {
      const files = await this.ipfsService.listFiles();

      return {
        success: true,
        data: files,
        message: 'Files listed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to list files',
        error: error.message
      };
    }
  }

  @Get('url/:cid')
  @ApiOperation({ summary: 'Get file URL from IPFS' })
  @ApiResponse({ status: 200, description: 'URL retrieved successfully' })
  async getFileUrl(@Param('cid') cid: string) {
    try {
      const url = this.ipfsService.getIPFSUrl(cid);

      return {
        success: true,
        data: { url },
        message: 'URL retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get URL',
        error: error.message
      };
    }
  }
}
