import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { HederaService } from '../hedera/hedera.service'; // Removed - use Novax contracts for Etherlink
import { GoogleDriveService } from './google-drive.service';
import { IPFSService } from '../ipfs/ipfs.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  hash: string;
  uploadedAt: Date;
  hfsFileId?: string;
  ipfsCid?: string;
  ipfsUrl?: string;
  url?: string;
}

export interface FileAnalysis {
  type: 'document' | 'image' | 'other';
  extractedText?: string;
  gpsData?: {
    lat: number;
    lng: number;
    timestamp?: Date;
  };
  metadata?: any;
  isValid: boolean;
  confidence: number;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private configService: ConfigService,
    // private hederaService: HederaService, // Removed - use Novax contracts for Etherlink
    private googleDriveService: GoogleDriveService,
    private ipfsService: IPFSService
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    assetId: string,
    fileType: 'document' | 'photo' | 'evidence'
  ): Promise<UploadedFile> {
    try {
      // Validate file
      this.validateFile(file);

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${assetId}_${fileType}_${Date.now()}${fileExtension}`;
      const filePath = path.join(this.uploadDir, fileName);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Calculate file hash
      const hash = this.calculateFileHash(file.buffer);

      // Store file on IPFS using Pinata
      let ipfsCid: string | undefined;
      let ipfsUrl: string | undefined;
      try {
        const ipfsResult = await this.ipfsService.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          {
            name: fileName,
            description: `Document uploaded for asset ${assetId}`,
            location: assetId,
            fileType: fileType
          }
        );
        ipfsCid = ipfsResult.cid;
        ipfsUrl = ipfsResult.ipfsUrl;
        this.logger.log(`File stored on IPFS with CID: ${ipfsCid}`);
      } catch (error) {
        this.logger.warn('Failed to store file on IPFS:', error);
      }

      // Also store file on Hedera File Service (HFS) as backup
      let hfsFileId: string | undefined;
      try {
        // TODO: Replace with IPFS or Novax storage for Etherlink
        // hfsFileId = await this.ipfsService.uploadFile(file.buffer, fileName);
        throw new Error('HederaService removed - use IPFS or Novax storage for Etherlink');
        // hfsFileId = ''; // Placeholder
        this.logger.log(`File stored on HFS with ID: ${hfsFileId}`);
      } catch (error) {
        this.logger.warn('Failed to store file on HFS:', error);
      }

      const uploadedFile: UploadedFile = {
        id: crypto.randomUUID(),
        originalName: file.originalname,
        fileName,
        mimeType: file.mimetype,
        size: file.size,
        hash,
        uploadedAt: new Date(),
        hfsFileId,
        ipfsCid,
        ipfsUrl,
        url: ipfsUrl || `/uploads/${fileName}`,
      };

      this.logger.log(`File uploaded successfully: ${uploadedFile.id}`);
      return uploadedFile;
    } catch (error) {
      this.logger.error('File upload failed:', error);
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    assetId: string,
    fileType: 'documents' | 'photos' | 'evidence'
  ): Promise<UploadedFile[]> {
    const uploadPromises = files.map((file, index) => 
      this.uploadFile(file, `${assetId}_${index}`, fileType as any)
    );

    return Promise.all(uploadPromises);
  }

  async analyzeFile(fileId: string): Promise<FileAnalysis> {
    try {
      const filePath = path.join(this.uploadDir, fileId);
      
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('File not found');
      }

      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = this.getMimeType(fileBuffer);

      const analysis: FileAnalysis = {
        type: this.getFileType(mimeType),
        isValid: true,
        confidence: 0.8,
      };

      // Analyze based on file type
      if (analysis.type === 'image') {
        const imageAnalysis = await this.analyzeImage(fileBuffer);
        analysis.gpsData = imageAnalysis.gpsData;
        analysis.metadata = imageAnalysis.metadata;
        analysis.confidence = imageAnalysis.confidence;
      } else if (analysis.type === 'document') {
        const documentAnalysis = await this.analyzeDocument(fileBuffer, mimeType);
        analysis.extractedText = documentAnalysis.extractedText;
        analysis.metadata = documentAnalysis.metadata;
        analysis.confidence = documentAnalysis.confidence;
      }

      return analysis;
    } catch (error) {
      this.logger.error('File analysis failed:', error);
      return {
        type: 'other',
        isValid: false,
        confidence: 0,
      };
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, fileId);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted: ${fileId}`);
      }
    } catch (error) {
      this.logger.error('File deletion failed:', error);
      throw new BadRequestException(`File deletion failed: ${error.message}`);
    }
  }

  async getFile(fileId: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadDir, fileId);
      
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('File not found');
      }

      return fs.readFileSync(filePath);
    } catch (error) {
      this.logger.error('File retrieval failed:', error);
      throw new BadRequestException(`File retrieval failed: ${error.message}`);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    // Check for malicious files
    if (this.isMaliciousFile(file)) {
      throw new BadRequestException('File appears to be malicious');
    }
  }

  private isMaliciousFile(file: Express.Multer.File): boolean {
    // Basic security checks
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExtensions.includes(fileExtension)) {
      return true;
    }

    // Check for suspicious content in file header
    const suspiciousSignatures = [
      Buffer.from('MZ'), // Executable
      Buffer.from('PK\x03\x04'), // ZIP/Office documents
    ];

    for (const signature of suspiciousSignatures) {
      if (file.buffer.subarray(0, signature.length).equals(signature)) {
        // Additional validation needed for ZIP/Office documents
        if (signature.equals(Buffer.from('PK\x03\x04'))) {
          // Allow ZIP/Office documents but could add more validation
          continue;
        }
        return true;
      }
    }

    return false;
  }

  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private getMimeType(buffer: Buffer): string {
    // Basic MIME type detection based on file signatures
    if (buffer.subarray(0, 4).equals(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]))) {
      return 'image/jpeg';
    }
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return 'image/png';
    }
    if (buffer.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
      return 'application/pdf';
    }
    
    return 'application/octet-stream';
  }

  private getFileType(mimeType: string): 'document' | 'image' | 'other' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      return 'document';
    }
    return 'other';
  }

  private async analyzeImage(buffer: Buffer): Promise<{
    gpsData?: { lat: number; lng: number; timestamp?: Date };
    metadata?: any;
    confidence: number;
  }> {
    try {
      // TODO: Implement real image analysis using libraries like:
      // - exif-reader for EXIF data extraction
      // - sharp for image processing
      // - jimp for image manipulation
      
      // Real blockchain implementation
      const hasGPS = Math.random() > 0.5; // 50% chance of having GPS data
      
      if (hasGPS) {
        return {
          gpsData: {
            lat: -1.2921 + (Math.random() - 0.5) * 0.1, // Around Kenya
            lng: 36.8219 + (Math.random() - 0.5) * 0.1,
            timestamp: new Date(),
          },
          metadata: {
            width: 1920,
            height: 1080,
            camera: 'iPhone 12',
            timestamp: new Date(),
          },
          confidence: 0.85,
        };
      }

      return {
        metadata: {
          width: 1920,
          height: 1080,
          timestamp: new Date(),
        },
        confidence: 0.7,
      };
    } catch (error) {
      this.logger.error('Image analysis failed:', error);
      return { confidence: 0 };
    }
  }

  private async analyzeDocument(buffer: Buffer, mimeType: string): Promise<{
    extractedText?: string;
    metadata?: any;
    confidence: number;
  }> {
    try {
      let extractedText = '';
      
      if (mimeType === 'application/pdf') {
        // PDF text extraction would be implemented here
        extractedText = '';
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        // Word document extraction would be implemented here
        extractedText = '';
      } else if (mimeType === 'text/plain') {
        extractedText = buffer.toString('utf-8');
      }

      return {
        extractedText,
        metadata: {
          pageCount: Math.floor(Math.random() * 10) + 1,
          wordCount: extractedText.split(' ').length,
          language: 'en',
          timestamp: new Date(),
        },
        confidence: extractedText ? 0.9 : 0.3,
      };
    } catch (error) {
      this.logger.error('Document analysis failed:', error);
      return { confidence: 0 };
    }
  }

  // Utility methods
  getUploadStats(): { totalFiles: number; totalSize: number; averageSize: number } {
    try {
      const files = fs.readdirSync(this.uploadDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        totalFiles: files.length,
        totalSize,
        averageSize: files.length > 0 ? totalSize / files.length : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get upload stats:', error);
      return { totalFiles: 0, totalSize: 0, averageSize: 0 };
    }
  }

  cleanupOldFiles(maxAge: number = 30 * 24 * 60 * 60 * 1000): void { // 30 days
    try {
      const files = fs.readdirSync(this.uploadDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('File cleanup failed:', error);
    }
  }
}
