import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, KycStatus } from '../schemas/user.schema';
import axios from 'axios';

@Injectable()
export class KybService {
  private readonly logger = new Logger(KybService.name);
  private readonly diditApiKey = process.env.DIDIT_API_KEY;
  private readonly diditWorkflowId = process.env.DIDIT_KYB_WORKFLOW_ID || process.env.DIDIT_WORKFLOW_ID;
  private readonly diditBaseUrl = 'https://verification.didit.me/v2';

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Start KYB (Know Your Business) verification for a business
   */
  async startKYB(businessData: {
    businessName: string;
    businessAddress: string;
    country: string;
    walletAddress: string;
    type: 'exporter' | 'importer';
    email?: string;
    phone?: string;
  }) {
    try {
      this.logger.log(`Starting KYB for business: ${businessData.businessName}`);

      // Create DidIt session for business verification
      const sessionData = {
        vendor_data: JSON.stringify({
          businessName: businessData.businessName,
          businessAddress: businessData.businessAddress,
          country: businessData.country,
          walletAddress: businessData.walletAddress,
          type: businessData.type,
        }),
        workflow_id: this.diditWorkflowId,
        callback: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/kyb-callback`,
      };

      const response = await axios.post(
        `${this.diditBaseUrl}/session/`,
        sessionData,
        {
          headers: {
            'x-api-key': this.diditApiKey,
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
        }
      );

      const session = response.data;

      // Store KYB session in database (create or update user)
      let user = await this.userModel.findOne({ walletAddress: businessData.walletAddress });
      
      if (!user) {
        // Create new user for business
        user = new this.userModel({
          walletAddress: businessData.walletAddress,
          name: businessData.businessName,
          email: businessData.email,
          phone: businessData.phone,
          country: businessData.country,
          kybInquiryId: session.session_id,
          kybStatus: 'in_progress',
          kybProvider: 'didit',
          role: businessData.type === 'exporter' ? 'exporter' : 'importer',
        });
      } else {
        // Update existing user
        user.kybInquiryId = session.session_id;
        user.kybStatus = KycStatus.IN_PROGRESS;
        user.kybProvider = 'didit';
        if (businessData.email) user.email = businessData.email;
        if (businessData.phone) user.phone = businessData.phone;
        if (businessData.country) user.country = businessData.country;
      }

      await user.save();

      this.logger.log(`KYB started for business ${businessData.businessName}, session ID: ${session.session_id}`);

      return {
        inquiryId: session.session_id,
        inquiryUrl: session.url,
        status: 'in_progress',
        provider: 'didit',
        sessionToken: session.session_token,
      };
    } catch (error) {
      this.logger.error(`Failed to start KYB for business ${businessData.businessName}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('KYB service is currently unavailable. Please contact support.');
      }
      
      if (error.response?.status === 400) {
        throw new Error('Invalid KYB request. Please check your business information.');
      }
      
      throw new Error(`Failed to start KYB: ${error.message}`);
    }
  }

  /**
   * Check KYB status
   */
  async checkKYBStatus(inquiryId: string) {
    try {
      const response = await axios.get(
        `${this.diditBaseUrl}/session/${inquiryId}`,
        {
          headers: {
            'x-api-key': this.diditApiKey,
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
        }
      );

      const session = response.data;
      const status = session.status || 'unknown';

      // Map DidIt status to our internal status
      let internalStatus: KycStatus;
      switch (status) {
        case 'Not Started':
          internalStatus = KycStatus.NOT_STARTED;
          break;
        case 'In Progress':
        case 'Pending':
          internalStatus = KycStatus.IN_PROGRESS;
          break;
        case 'Completed':
        case 'Approved':
          internalStatus = KycStatus.VERIFIED;
          break;
        case 'Failed':
        case 'Rejected':
        case 'Declined':
          internalStatus = KycStatus.REJECTED;
          break;
        default:
          internalStatus = KycStatus.PENDING;
      }

      // Update user status if changed
      const user = await this.userModel.findOne({ kybInquiryId: inquiryId });
      if (user && (internalStatus === KycStatus.VERIFIED || internalStatus === KycStatus.REJECTED)) {
        user.kybStatus = internalStatus;
        await user.save();
      }

      return {
        status: internalStatus,
        diditStatus: status,
        inquiryId: session.session_id,
        completedAt: session.completed_at,
      };
    } catch (error) {
      this.logger.error(`Failed to check KYB status for session ${inquiryId}:`, error);
      throw new Error(`Failed to check KYB status: ${error.message}`);
    }
  }

  /**
   * Process KYB callback from DidIt
   */
  async processDiditCallback(verificationSessionId: string, status: string) {
    try {
      this.logger.log(`Processing DidIt KYB callback for session ${verificationSessionId} with status ${status}`);

      const user = await this.userModel.findOne({ 
        kybInquiryId: verificationSessionId 
      });

      if (!user) {
        this.logger.warn(`No user found for KYB verification session ${verificationSessionId}`);
        return {
          success: false,
          message: 'User not found for this verification session',
        };
      }

      // Map DidIt status to our internal status
      let internalStatus: KycStatus;
      switch (status) {
        case 'Not Started':
          internalStatus = KycStatus.NOT_STARTED;
          break;
        case 'In Progress':
        case 'Pending':
          internalStatus = KycStatus.IN_PROGRESS;
          break;
        case 'Completed':
        case 'Approved':
          internalStatus = KycStatus.VERIFIED;
          break;
        case 'Failed':
        case 'Rejected':
        case 'Declined':
          internalStatus = KycStatus.REJECTED;
          break;
        default:
          internalStatus = KycStatus.PENDING;
      }

      const oldStatus = user.kybStatus;
      user.kybStatus = internalStatus;
      await user.save();

      this.logger.log(`Updated KYB status for user ${user.walletAddress} from '${oldStatus}' to '${internalStatus}'`);

      return {
        success: true,
        userId: user._id,
        walletAddress: user.walletAddress,
        status: internalStatus,
      };
    } catch (error) {
      this.logger.error(`Failed to process KYB callback:`, error);
      throw error;
    }
  }
}

