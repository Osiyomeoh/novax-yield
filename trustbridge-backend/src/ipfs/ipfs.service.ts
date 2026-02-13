import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';

export interface IPFSFileMetadata {
  name?: string;
  description?: string;
  location?: string;
  [key: string]: any;
}

export interface IPFSUploadResult {
  cid: string;
  ipfsUrl: string;
  pinSize: number;
  timestamp: string;
}

export interface IPFSPresignedUrlResult {
  presignedUrl: string;
  fields: Record<string, string>;
  cid?: string;
  ipfsUrl?: string;
}

@Injectable()
export class IPFSService {
  private readonly logger = new Logger(IPFSService.name);
  private readonly pinataApiKey: string;
  private readonly pinataSecretKey: string;
  private readonly pinataJwt: string;
  private readonly pinataGatewayUrl: string;

  constructor(private configService: ConfigService) {
    this.pinataApiKey = this.configService.get<string>('PINATA_API_KEY') || '';
    this.pinataSecretKey = this.configService.get<string>('PINATA_SECRET_KEY') || '';
    this.pinataJwt = this.configService.get<string>('PINATA_JWT') || '';
    this.pinataGatewayUrl = this.configService.get<string>('PINATA_GATEWAY_URL') || 'gateway.pinata.cloud';

    if (!this.pinataApiKey || !this.pinataSecretKey) {
      this.logger.warn('Pinata credentials not configured. IPFS uploads will fail.');
    }
  }

  /**
   * Generate presigned URL for file upload
   */
  async generatePresignedUrl(
    fileName: string,
    fileType: string,
    metadata?: IPFSFileMetadata
  ): Promise<IPFSPresignedUrlResult> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        throw new BadRequestException('Pinata credentials not configured');
      }

      // For now, return a simple presigned URL structure
      // In a real implementation, you would generate this with Pinata
      const cid = `QmPresigned${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      const ipfsUrl = `https://${this.pinataGatewayUrl}/ipfs/${cid}`;

      // Ensure all metadata values are strings or numbers for Pinata compatibility
      const sanitizedMetadata = metadata ? Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key, 
          typeof value === 'string' || typeof value === 'number' ? value : String(value)
        ])
      ) : {};

      return {
        presignedUrl: `https://api.pinata.cloud/pinning/pinFileToIPFS`,
        fields: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
          'pinataMetadata': JSON.stringify({
            name: fileName,
            keyvalues: {
              originalName: fileName,
              fileType: fileType,
              uploadTime: new Date().toISOString(),
              ...sanitizedMetadata
            }
          }),
          'pinataOptions': JSON.stringify({
            cidVersion: 1
          })
        },
        cid,
        ipfsUrl
      };
    } catch (error) {
      this.logger.error('Failed to generate presigned URL:', error);
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Upload file to IPFS using Pinata
   */
  async uploadFile(
    file: Buffer,
    fileName: string,
    fileType: string,
    metadata?: IPFSFileMetadata
  ): Promise<IPFSUploadResult> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        throw new BadRequestException('Pinata credentials not configured');
      }

      const formData = new FormData();
      formData.append('file', file, {
        filename: fileName,
        contentType: fileType
      });

      // Ensure all metadata values are strings or numbers for Pinata compatibility
      const sanitizedMetadata = metadata ? Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key, 
          typeof value === 'string' || typeof value === 'number' ? value : String(value)
        ])
      ) : {};

      formData.append('pinataMetadata', JSON.stringify({
        name: fileName,
        keyvalues: {
          originalName: fileName,
          fileType: fileType,
          uploadTime: new Date().toISOString(),
          ...sanitizedMetadata
        }
      }));

      formData.append('pinataOptions', JSON.stringify({
        cidVersion: 1
      }));

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            'pinata_api_key': this.pinataApiKey,
            'pinata_secret_api_key': this.pinataSecretKey,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      const { IpfsHash, PinSize } = response.data;
      const ipfsUrl = `https://${this.pinataGatewayUrl}/ipfs/${IpfsHash}`;

      this.logger.log(`File uploaded to IPFS: ${IpfsHash}`);

      return {
        cid: IpfsHash,
        ipfsUrl,
        pinSize: PinSize,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('IPFS upload failed:', error);
      if (error.response) {
        this.logger.error('Pinata API error:', error.response.data);
        throw new BadRequestException(`IPFS upload failed: ${error.response.data?.error || error.response.statusText}`);
      }
      throw new BadRequestException(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Pin a file to IPFS using Pinata
   */
  async pinFile(cid: string, name?: string): Promise<IPFSUploadResult> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        throw new BadRequestException('Pinata credentials not configured');
      }

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinByHash',
        {
          hashToPin: cid,
          pinataMetadata: {
            name: name || `pinned-${cid}`,
            keyvalues: {
              pinnedAt: new Date().toISOString()
            }
          }
        },
        {
          headers: {
            'pinata_api_key': this.pinataApiKey,
            'pinata_secret_api_key': this.pinataSecretKey,
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.log(`File pinned to IPFS: ${cid}`);

      return {
        cid,
        ipfsUrl: `https://${this.pinataGatewayUrl}/ipfs/${cid}`,
        pinSize: 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('IPFS pin failed:', error);
      if (error.response) {
        this.logger.error('Pinata API error:', error.response.data);
        throw new BadRequestException(`IPFS pin failed: ${error.response.data?.error || error.response.statusText}`);
      }
      throw new BadRequestException(`IPFS pin failed: ${error.message}`);
    }
  }

  /**
   * Upload JSON data to IPFS using Pinata
   */
  async uploadJson(data: any, fileName?: string, metadata?: IPFSFileMetadata): Promise<IPFSUploadResult> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        throw new BadRequestException('Pinata credentials not configured');
      }

      const pinataMetadata = {
        name: fileName || `json-${Date.now()}.json`,
        keyvalues: {
          type: 'json',
          uploadTime: new Date().toISOString(),
          ...(metadata || {})
        }
      };

      const pinataOptions = {
        cidVersion: 1
      };

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataContent: data,
          pinataMetadata,
          pinataOptions
        },
        {
          headers: {
            'pinata_api_key': this.pinataApiKey,
            'pinata_secret_api_key': this.pinataSecretKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const { IpfsHash, PinSize } = response.data;
      const ipfsUrl = `https://${this.pinataGatewayUrl}/ipfs/${IpfsHash}`;

      this.logger.log(`JSON uploaded to IPFS: ${IpfsHash}`);

      return {
        cid: IpfsHash,
        ipfsUrl,
        pinSize: PinSize,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('IPFS JSON upload failed:', error);
      if (error.response) {
        this.logger.error('Pinata API error:', error.response.data);
        throw new BadRequestException(`IPFS JSON upload failed: ${error.response.data?.error?.details || error.response.data?.error || error.response.statusText}`);
      }
      throw new BadRequestException(`IPFS JSON upload failed: ${error.message}`);
    }
  }

  /**
   * Unpin a file from IPFS using Pinata
   */
  async unpinFile(cid: string): Promise<boolean> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        throw new BadRequestException('Pinata credentials not configured');
      }

      await axios.delete(
        `https://api.pinata.cloud/pinning/unpin/${cid}`,
        {
          headers: {
            'pinata_api_key': this.pinataApiKey,
            'pinata_secret_api_key': this.pinataSecretKey
          }
        }
      );

      this.logger.log(`File unpinned from IPFS: ${cid}`);
      return true;
    } catch (error) {
      this.logger.error('IPFS unpin failed:', error);
      if (error.response) {
        this.logger.error('Pinata API error:', error.response.data);
        throw new BadRequestException(`IPFS unpin failed: ${error.response.data?.error || error.response.statusText}`);
      }
      throw new BadRequestException(`IPFS unpin failed: ${error.message}`);
    }
  }

  /**
   * Get file from IPFS
   */
  async getFile(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(
        `https://${this.pinataGatewayUrl}/ipfs/${cid}`,
        {
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Failed to get file from IPFS:', error);
      throw new BadRequestException(`Failed to get file from IPFS: ${error.message}`);
    }
  }

  /**
   * Get file metadata from IPFS
   */
  async getFileMetadata(cid: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://${this.pinataGatewayUrl}/ipfs/${cid}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get file metadata from IPFS:', error);
      throw new BadRequestException(`Failed to get file metadata from IPFS: ${error.message}`);
    }
  }

  /**
   * List pinned files from Pinata
   */
  async listFiles(): Promise<any[]> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        throw new BadRequestException('Pinata credentials not configured');
      }

      const response = await axios.get(
        'https://api.pinata.cloud/data/pinList',
        {
          headers: {
            'pinata_api_key': this.pinataApiKey,
            'pinata_secret_api_key': this.pinataSecretKey
          }
        }
      );

      return response.data.rows || [];
    } catch (error) {
      this.logger.error('Failed to list files from IPFS:', error);
      throw new BadRequestException(`Failed to list files from IPFS: ${error.message}`);
    }
  }

  /**
   * Get IPFS URL for a CID
   */
  getIPFSUrl(cid: string): string {
    return `https://${this.pinataGatewayUrl}/ipfs/${cid}`;
  }
}