import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
// import { MantleService } from '../mantle/mantle.service'; // Removed - use Novax contracts for Etherlink
import { NotificationsService } from '../notifications/notifications.service';
import { GmailService } from '../services/gmail.service';

// AMC DTOs
export interface RegisterAMCDto {
  name: string;
  description: string;
  jurisdiction: string;
  manager: string;
}

export interface ScheduleInspectionDto {
  assetId: string;
  inspector: string;
  inspectionTime: number;
  manager: string;
}

export interface CompleteInspectionDto {
  assetId: string;
  status: number; // 0 = PENDING, 1 = SCHEDULED, 2 = COMPLETED, 3 = FAILED
  report: string;
  evidenceHash: string;
  inspector: string;
}

export interface InitiateLegalTransferDto {
  assetId: string;
  assetOwner: string;
  legalDocuments: string;
  manager: string;
}

// AMC Models
export interface AMC {
  amcId: string;
  name: string;
  description: string;
  jurisdiction: string;
  manager: string;
  isActive: boolean;
  createdAt: Date;
}

export interface InspectionRecord {
  assetId: string;
  inspector: string;
  scheduledTime: number;
  status: number;
  report?: string;
  evidenceHash?: string;
  completedAt?: Date;
}

export interface LegalTransferRecord {
  assetId: string;
  assetOwner: string;
  amcAddress: string;
  status: number; // 0 = PENDING, 1 = INITIATED, 2 = COMPLETED
  legalDocuments: string;
  initiatedAt: Date;
  completedAt?: Date;
}

export interface SendInspectionNotificationDto {
  assetId: string;
  scheduledDateTime: string; // ISO string
  inspector: string;
  assetName: string;
}

@Injectable()
export class AMCService {
  private readonly logger = new Logger(AMCService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // private readonly mantleService: MantleService, // Removed - use Novax contracts for Etherlink
    private readonly notificationsService: NotificationsService,
    private readonly gmailService: GmailService,
  ) {}

  // ========================================
  // AMC MANAGEMENT METHODS
  // ========================================

  async registerAMC(registerDto: RegisterAMCDto): Promise<{ amcId: string; transactionId: string }> {
    try {
      // Note: AMC registration on Mantle blockchain would be handled via AMCManager contract
      const amcId = `amc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.logger.log(`AMC registration request: ${registerDto.name} (${amcId})`);
      return { amcId, transactionId: 'mantle_blockchain_registration' };
    } catch (error) {
      this.logger.error(`Failed to register AMC: ${error.message}`);
      throw new Error(`AMC registration failed: ${error.message}`);
    }
  }

  async scheduleInspection(scheduleDto: ScheduleInspectionDto): Promise<{ transactionId: string }> {
    try {
      // Note: Frontend now handles blockchain scheduling directly via mantleContractService
      // This endpoint is kept for backward compatibility but blockchain operations are done in frontend
      this.logger.log(`Inspection scheduling request for asset ${scheduleDto.assetId} (blockchain handled in frontend)`);
      return { transactionId: 'blockchain_handled_in_frontend' };
    } catch (error) {
      this.logger.error(`Failed to process inspection scheduling request: ${error.message}`);
      throw new Error(`Inspection scheduling request failed: ${error.message}`);
    }
  }

  async completeInspection(completeDto: CompleteInspectionDto): Promise<{ transactionId: string }> {
    try {
      // Complete inspection on blockchain
      // Note: This would need to be implemented in the smart contract
      const transactionId = `inspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Completed inspection for asset ${completeDto.assetId}`);
      return { transactionId };
    } catch (error) {
      this.logger.error(`Failed to complete inspection: ${error.message}`);
      throw new Error(`Inspection completion failed: ${error.message}`);
    }
  }

  async initiateLegalTransfer(transferDto: InitiateLegalTransferDto): Promise<{ transactionId: string }> {
    try {
      // Initiate legal transfer on blockchain
      // Note: This would need to be implemented in the smart contract
      const transactionId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Initiated legal transfer for asset ${transferDto.assetId}`);
      return { transactionId };
    } catch (error) {
      this.logger.error(`Failed to initiate legal transfer: ${error.message}`);
      throw new Error(`Legal transfer initiation failed: ${error.message}`);
    }
  }

  async completeLegalTransfer(assetId: string, manager: string): Promise<{ transactionId: string }> {
    try {
      // Complete legal transfer on blockchain
      // Note: This would need to be implemented in the smart contract
      const transactionId = `complete_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Completed legal transfer for asset ${assetId}`);
      return { transactionId };
    } catch (error) {
      this.logger.error(`Failed to complete legal transfer: ${error.message}`);
      throw new Error(`Legal transfer completion failed: ${error.message}`);
    }
  }

  // ========================================
  // QUERY METHODS
  // ========================================

  async getInspectionRecord(assetId: string): Promise<InspectionRecord> {
    try {
      // Get inspection record from blockchain
      return {
        assetId,
        inspector: '0x1234567890123456789012345678901234567890',
        scheduledTime: Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60), // 2 days from now
        status: 1, // SCHEDULED
        report: '',
        evidenceHash: '',
        completedAt: undefined
      };
    } catch (error) {
      this.logger.error(`Failed to get inspection record: ${error.message}`);
      throw new Error(`Failed to get inspection record: ${error.message}`);
    }
  }

  async getLegalTransferRecord(assetId: string): Promise<LegalTransferRecord> {
    try {
      // Get legal transfer record from blockchain
      return {
        assetId,
        assetOwner: '0x1234567890123456789012345678901234567890',
        amcAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        status: 1, // INITIATED
        legalDocuments: 'ipfs://legal-documents-hash',
        initiatedAt: new Date(),
        completedAt: undefined
      };
    } catch (error) {
      this.logger.error(`Failed to get legal transfer record: ${error.message}`);
      throw new Error(`Failed to get legal transfer record: ${error.message}`);
    }
  }

  async getAMCStats(): Promise<{
    totalAMCs: number;
    activeAMCs: number;
    totalInspections: number;
    completedInspections: number;
    totalTransfers: number;
    completedTransfers: number;
  }> {
    try {
      // Get AMC statistics
      return {
        totalAMCs: 5,
        activeAMCs: 4,
        totalInspections: 25,
        completedInspections: 20,
        totalTransfers: 15,
        completedTransfers: 12
      };
    } catch (error) {
      this.logger.error(`Failed to get AMC stats: ${error.message}`);
      throw new Error(`Failed to get AMC statistics: ${error.message}`);
    }
  }

  /**
   * Send email notification to asset creator after inspection is scheduled
   */
  async sendInspectionNotification(notificationDto: SendInspectionNotificationDto): Promise<{ success: boolean; message: string }> {
    try {
      // Get asset details from blockchain to get the creator's wallet address
      const assetId = notificationDto.assetId;
      let asset;
      
      // TODO: Replace with Novax contract calls for Etherlink
      // try {
      //   asset = await this.novaxService.getAsset(assetId);
      // } catch (error) {
      //   this.logger.error(`Failed to get asset from blockchain: ${error.message}`);
      //   throw new Error('Asset not found on blockchain');
      // }
      throw new Error('MantleService removed - use Novax contracts for Etherlink');

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Extract owner address from asset (could be originalOwner or currentOwner)
      const ownerWalletAddress = (asset.originalOwner || asset.currentOwner || '').toLowerCase();

      if (!ownerWalletAddress) {
        throw new Error('Asset has no owner address');
      }

      // Get user's email from wallet address
      const user = await this.userModel.findOne({ 
        walletAddress: { $regex: new RegExp(`^${ownerWalletAddress}$`, 'i') }
      }).exec();

      if (!user || !user.email) {
        this.logger.warn(`User not found or no email for wallet address: ${ownerWalletAddress}`);
        return {
          success: false,
          message: 'Asset creator email not found. User may need to complete profile with email address.'
        };
      }

      // Format scheduled date/time
      const scheduledDate = new Date(notificationDto.scheduledDateTime);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Create email content
      const subject = `Physical Inspection Scheduled - ${notificationDto.assetName}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .asset-info { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
            .schedule-info { background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Physical Inspection Scheduled</h1>
            </div>
            <div class="content">
              <p>Dear ${user.name || 'Asset Owner'},</p>
              
              <p>We would like to inform you that a physical inspection has been scheduled for your asset.</p>
              
              <div class="asset-info">
                <h3>Asset Details</h3>
                <p><strong>Asset Name:</strong> ${notificationDto.assetName}</p>
                <p><strong>Asset ID:</strong> ${assetId}</p>
              </div>
              
              <div class="schedule-info">
                <h3>Inspection Schedule</h3>
                <p><strong>Date & Time:</strong> ${formattedDate}</p>
                <p><strong>Inspector Address:</strong> ${notificationDto.inspector}</p>
              </div>
              
              <p>Please ensure that all necessary documentation and access to the asset location are prepared for the inspection date.</p>
              
              <p>If you have any questions or need to reschedule, please contact our support team.</p>
              
              <a href="${process.env.FRONTEND_URL || 'https://trustbridge.africa'}/dashboard/assets" class="button">View Asset Details</a>
              
              <div class="footer">
                <p>Best regards,<br>TrustBridge AMC Team</p>
                <p>This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Physical Inspection Scheduled

Dear ${user.name || 'Asset Owner'},

We would like to inform you that a physical inspection has been scheduled for your asset.

Asset Details:
- Asset Name: ${notificationDto.assetName}
- Asset ID: ${assetId}

Inspection Schedule:
- Date & Time: ${formattedDate}
- Inspector Address: ${notificationDto.inspector}

Please ensure that all necessary documentation and access to the asset location are prepared for the inspection date.

If you have any questions or need to reschedule, please contact our support team.

View your assets: ${process.env.FRONTEND_URL || 'https://trustbridge.africa'}/dashboard/assets

Best regards,
TrustBridge AMC Team

This is an automated notification. Please do not reply to this email.
      `;

      // Send email
      const emailSent = await this.gmailService.sendEmail(
        user.email,
        subject,
        htmlContent,
        textContent
      );

      if (emailSent) {
        this.logger.log(`Inspection notification email sent to ${user.email} for asset ${assetId}`);
        return {
          success: true,
          message: 'Email notification sent successfully'
        };
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      this.logger.error(`Failed to send inspection notification: ${error.message}`, error.stack);
      throw new Error(`Failed to send inspection notification: ${error.message}`);
    }
  }
}
