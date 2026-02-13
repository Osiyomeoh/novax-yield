import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument, PaymentStatus, PaymentMethod, PaymentType } from '../schemas/payment.schema';
// MantleService removed - using Etherlink/Novax contracts directly
import { NotificationsService } from '../notifications/notifications.service';
import { ethers } from 'ethers';
import Stripe from 'stripe';
import axios from 'axios';

export interface PaymentRequest {
  userId: string;
  assetId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  type: PaymentType;
  description?: string;
  metadata?: any;
}

export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  externalTransactionId?: string;
  blockchainTxId?: string;
  paymentUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
}

export interface EscrowRequest {
  buyerId: string;
  sellerId: string;
  assetId: string;
  amount: number;
  currency: string;
  deliveryDeadline: Date;
  conditions: string[];
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;
  private readonly feeRates = {
    tokenization: 0.02, // 2% of asset value
    verification: 0.01, // 1% of asset value
    platform: 0.005,   // 0.5% of transaction
    attestor: 0.01,     // 1% of asset value
  };

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private configService: ConfigService,
    // MantleService removed - using Etherlink/Novax contracts directly
    private notificationsService: NotificationsService,
  ) {
    // Initialize Stripe
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });
    }
  }

  async createPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    try {
      const paymentId = this.generatePaymentId();
      
      // Calculate fees
      const feeAmount = this.calculateFee(paymentRequest.amount, paymentRequest.type);
      const netAmount = paymentRequest.amount - feeAmount;

      const payment = new this.paymentModel({
        paymentId,
        userId: paymentRequest.userId,
        assetId: paymentRequest.assetId,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        method: paymentRequest.method,
        type: paymentRequest.type,
        status: PaymentStatus.PENDING,
        description: paymentRequest.description,
        feeAmount,
        netAmount,
        metadata: paymentRequest.metadata,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      await payment.save();

      // Process payment based on method
      let result: PaymentResult;
      switch (paymentRequest.method) {
        case PaymentMethod.HBAR:
        case PaymentMethod.TRUST: // TRUST tokens replace HBAR
          result = await this.processTrustTokenPayment(payment);
          break;
        case PaymentMethod.STRIPE:
          result = await this.processStripePayment(payment);
          break;
        case PaymentMethod.PAYPAL:
          result = await this.processPayPalPayment(payment);
          break;
        case PaymentMethod.MOBILE_MONEY:
          result = await this.processMobileMoneyPayment(payment);
          break;
        default:
          throw new BadRequestException(`Unsupported payment method: ${paymentRequest.method}`);
      }

      // Update payment with result
      payment.status = result.status;
      payment.externalTransactionId = result.externalTransactionId;
      payment.blockchainTxId = result.blockchainTxId;
      await payment.save();

      return result;
    } catch (error) {
      this.logger.error('Failed to create payment:', error);
      throw error;
    }
  }

  /**
   * Process TRUST token payment (replaces HBAR payment)
   * TRUST token economy enables payment of gas fees and transactions
   */
  async processTrustTokenPayment(payment: PaymentDocument): Promise<PaymentResult> {
    try {
      // Get platform treasury address from config
      const platformTreasury = this.configService.get<string>('PLATFORM_TREASURY_ADDRESS') || 
                                this.configService.get<string>('SUPER_ADMIN_WALLET');
      
      if (!platformTreasury) {
        throw new Error('Platform treasury address not configured');
      }

      // Convert payment amount to wei (TRUST tokens use 18 decimals)
      const amountWei = ethers.parseEther(payment.amount.toString());

      // Transfer TRUST tokens from user to platform treasury
      // TODO: Replace with Novax/Etherlink token transfer
      // Note: User must have approved the transfer or this will fail
      // In production, this should be done via a payment contract that handles approvals
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      const transferResult = { txHash: '' } as any; // Placeholder

      this.logger.log(`TRUST token payment processed: ${payment.paymentId} - TX: ${transferResult.txHash}`);

      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.COMPLETED,
        blockchainTxId: transferResult.txHash,
      };
    } catch (error) {
      this.logger.error('TRUST token payment failed:', error);
      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.FAILED,
      };
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   * Now redirects to TRUST token payment
   */
  async processHbarPayment(payment: PaymentDocument): Promise<PaymentResult> {
    this.logger.log('processHbarPayment called - redirecting to TRUST token payment');
    return this.processTrustTokenPayment(payment);
  }

  async processStripePayment(payment: PaymentDocument): Promise<PaymentResult> {
    try {
      if (!this.stripe) {
        throw new BadRequestException('Stripe not configured');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: payment.currency.toLowerCase(),
        metadata: {
          paymentId: payment.paymentId,
          userId: payment.userId,
          type: payment.type,
        },
        description: payment.description,
      });

      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.PROCESSING,
        externalTransactionId: paymentIntent.id,
        paymentUrl: `https://checkout.stripe.com/pay/${paymentIntent.client_secret}`,
      };
    } catch (error) {
      this.logger.error('Stripe payment failed:', error);
      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async processPayPalPayment(payment: PaymentDocument): Promise<PaymentResult> {
    try {
      // TODO: Implement PayPal integration
      const paypalOrderId = `paypal_${Date.now()}`;
      
      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.PROCESSING,
        externalTransactionId: paypalOrderId,
        paymentUrl: `https://paypal.com/checkout/${paypalOrderId}`,
      };
    } catch (error) {
      this.logger.error('PayPal payment failed:', error);
      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async processMobileMoneyPayment(payment: PaymentDocument): Promise<PaymentResult> {
    try {
      // Integrate with Africa's Talking or similar mobile money provider
      const mobileMoneyResponse = await axios.post('https://api.africastalking.com/version1/payments/mobile/checkout/request', {
        username: this.configService.get<string>('AT_USERNAME'),
        productName: 'TrustBridge',
        phoneNumber: (payment.metadata as any)?.phoneNumber,
        currencyCode: payment.currency,
        amount: payment.amount,
        metadata: {
          paymentId: payment.paymentId,
          userId: payment.userId,
        },
      }, {
        headers: {
          'apiKey': this.configService.get<string>('AT_API_KEY'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.PROCESSING,
        externalTransactionId: mobileMoneyResponse.data.transactionId,
        qrCode: mobileMoneyResponse.data.qrCode,
      };
    } catch (error) {
      this.logger.error('Mobile money payment failed:', error);
      return {
        paymentId: payment.paymentId,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async createEscrow(escrowRequest: EscrowRequest): Promise<PaymentResult> {
    try {
      const paymentId = this.generatePaymentId();
      
      const escrowPayment = new this.paymentModel({
        paymentId,
        userId: escrowRequest.buyerId,
        assetId: escrowRequest.assetId,
        amount: escrowRequest.amount,
        currency: escrowRequest.currency,
        method: PaymentMethod.HBAR,
        type: PaymentType.ESCROW,
        status: PaymentStatus.PENDING,
        description: `Escrow for asset ${escrowRequest.assetId}`,
        metadata: {
          sellerId: escrowRequest.sellerId,
          deliveryDeadline: escrowRequest.deliveryDeadline,
          conditions: escrowRequest.conditions,
        },
        expiresAt: escrowRequest.deliveryDeadline,
      });

      await escrowPayment.save();

      // Create escrow using TRUST token transfer to platform (escrow holder)
      // Note: In production, this should use a dedicated Escrow smart contract
      // For now, we use platform treasury as escrow holder
      const platformTreasury = this.configService.get<string>('PLATFORM_TREASURY_ADDRESS') || 
                                this.configService.get<string>('SUPER_ADMIN_WALLET');
      
      if (!platformTreasury) {
        throw new Error('Platform treasury address not configured');
      }

      // Transfer TRUST tokens from buyer to platform (escrow)
      const escrowAmountWei = ethers.parseEther(escrowRequest.amount.toString());
      // TODO: Replace with Novax/Etherlink token transfer
      // When Novax integration is complete, uncomment and update the following code:
      // const escrowResult = await this.novaxService.transferTrustTokens(
      //   escrowRequest.buyerId.toLowerCase(),
      //   platformTreasury.toLowerCase(),
      //   escrowAmountWei
      // );
      // const escrowTxId = escrowResult.txHash;
      
      // For now, use placeholder until Novax contracts are integrated
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      const escrowTxId = ''; // Placeholder

      escrowPayment.status = PaymentStatus.COMPLETED;
      escrowPayment.blockchainTxId = escrowTxId;
      await escrowPayment.save();

      return {
        paymentId,
        status: PaymentStatus.COMPLETED,
        blockchainTxId: escrowTxId,
      };
    } catch (error) {
      this.logger.error('Failed to create escrow:', error);
      throw error;
    }
  }

  async releaseEscrow(paymentId: string, buyerConfirmation: boolean): Promise<void> {
    try {
      const payment = await this.paymentModel.findOne({ paymentId });
      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (payment.type !== PaymentType.ESCROW) {
        throw new BadRequestException('Payment is not an escrow');
      }

      // Get platform treasury and seller/buyer addresses
      const platformTreasury = this.configService.get<string>('PLATFORM_TREASURY_ADDRESS') || 
                                this.configService.get<string>('SUPER_ADMIN_WALLET');
      
      if (!platformTreasury) {
        throw new Error('Platform treasury address not configured');
      }

      const sellerAddress = (payment.metadata as any)?.sellerId;
      const buyerAddress = payment.userId;
      const escrowAmountWei = ethers.parseEther(payment.amount.toString());

      if (buyerConfirmation) {
        // Release funds to seller (transfer from platform to seller)
        // TODO: Replace with Novax/Etherlink token transfer
        // When Novax integration is complete, uncomment and update the following code:
        // const releaseResult = await this.novaxService.transferTrustTokens(
        //   platformTreasury.toLowerCase(),
        //   sellerAddress.toLowerCase(),
        //   escrowAmountWei
        // );
        // payment.status = PaymentStatus.COMPLETED;
        // payment.completedAt = new Date();
        // payment.blockchainTxId = releaseResult.txHash;
        
        // For now, use placeholder until Novax contracts are integrated
        throw new Error('Mantle service removed - use Novax contracts for Etherlink');
        payment.status = PaymentStatus.COMPLETED;
        payment.completedAt = new Date();
        payment.blockchainTxId = ''; // Placeholder
      } else {
        // Refund to buyer (transfer from platform back to buyer)
        // TODO: Replace with Novax/Etherlink token transfer
        // When Novax integration is complete, uncomment and update the following code:
        // const refundResult = await this.novaxService.transferTrustTokens(
        //   platformTreasury.toLowerCase(),
        //   buyerAddress.toLowerCase(),
        //   escrowAmountWei
        // );
        // payment.status = PaymentStatus.REFUNDED;
        // payment.refundedAt = new Date();
        // payment.blockchainTxId = refundResult.txHash;
        
        // For now, use placeholder until Novax contracts are integrated
        throw new Error('Mantle service removed - use Novax contracts for Etherlink');
        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAt = new Date();
        payment.blockchainTxId = ''; // Placeholder
      }

      await payment.save();

      // Notify parties
      await this.notificationsService.sendNotification({
        to: (payment.metadata as any)?.sellerId,
        type: 'email',
        templateId: buyerConfirmation ? 'escrow_released' : 'escrow_refunded',
        message: `Escrow ${buyerConfirmation ? 'released' : 'refunded'} for payment ${paymentId}`,
      });
    } catch (error) {
      this.logger.error('Failed to release escrow:', error);
      throw error;
    }
  }

  async processWebhook(provider: string, payload: any): Promise<void> {
    try {
      switch (provider) {
        case 'stripe':
          await this.processStripeWebhook(payload);
          break;
        case 'paypal':
          await this.processPayPalWebhook(payload);
          break;
        case 'mobile_money':
          await this.processMobileMoneyWebhook(payload);
          break;
        default:
          this.logger.warn(`Unknown webhook provider: ${provider}`);
      }
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw error;
    }
  }

  private async processStripeWebhook(payload: any): Promise<void> {
    const { type, data } = payload;
    
    if (type === 'payment_intent.succeeded') {
      const paymentIntent = data.object;
      const payment = await this.paymentModel.findOne({
        externalTransactionId: paymentIntent.id,
      });

      if (payment) {
        payment.status = PaymentStatus.COMPLETED;
        payment.completedAt = new Date();
        await payment.save();

        // Notify user
        await this.notificationsService.sendNotification({
          to: payment.userId,
          type: 'email',
          templateId: 'payment_completed',
          message: `Payment of ${payment.amount} ${payment.currency} completed successfully`,
        });
      }
    }
  }

  private async processPayPalWebhook(payload: any): Promise<void> {
    // TODO: Implement PayPal webhook processing
    this.logger.log('PayPal webhook received:', payload);
  }

  private async processMobileMoneyWebhook(payload: any): Promise<void> {
    // TODO: Implement mobile money webhook processing
    this.logger.log('Mobile money webhook received:', payload);
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }
    return payment;
  }

  async getUserPayments(userId: string, limit: number = 50): Promise<PaymentDocument[]> {
    return this.paymentModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async refundPayment(paymentId: string, reason: string): Promise<void> {
    try {
      const payment = await this.paymentModel.findOne({ paymentId });
      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Only completed payments can be refunded');
      }

      // Process refund based on payment method
      let refundTxId: string;
      switch (payment.method) {
        case PaymentMethod.HBAR:
        case PaymentMethod.TRUST: // TRUST tokens replace HBAR
          // Get platform treasury address
          const platformTreasury = this.configService.get<string>('PLATFORM_TREASURY_ADDRESS') || 
                                    this.configService.get<string>('SUPER_ADMIN_WALLET');
          
          if (!platformTreasury) {
            throw new Error('Platform treasury address not configured');
          }

          // Refund TRUST tokens from platform treasury to user
          const refundAmountWei = ethers.parseEther(payment.amount.toString());
          // TODO: Replace with Novax/Etherlink token transfer
          // When Novax integration is complete, uncomment and update the following code:
          // const refundResult = await this.novaxService.transferTrustTokens(
          //   platformTreasury.toLowerCase(), // from platform
          //   payment.userId.toLowerCase(), // to user
          //   refundAmountWei
          // );
          // refundTxId = refundResult.txHash;
          
          // For now, use placeholder until Novax contracts are integrated
          throw new Error('Mantle service removed - use Novax contracts for Etherlink');
          refundTxId = ''; // Placeholder
          break;
        case PaymentMethod.STRIPE:
          if (this.stripe) {
            const refund = await this.stripe.refunds.create({
              payment_intent: payment.externalTransactionId!,
              reason: 'requested_by_customer',
            });
            refundTxId = refund.id;
          }
          break;
        default:
          throw new BadRequestException(`Refund not supported for ${payment.method}`);
      }

      payment.status = PaymentStatus.REFUNDED;
      payment.refundAmount = payment.amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      payment.blockchainTxId = refundTxId;
      await payment.save();

      // Notify user
      await this.notificationsService.sendNotification({
        to: payment.userId,
        type: 'email',
        templateId: 'payment_refunded',
        message: `Payment refunded: ${payment.amount} ${payment.currency}`,
      });
    } catch (error) {
      this.logger.error('Failed to refund payment:', error);
      throw error;
    }
  }

  // Utility methods
  private generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateFee(amount: number, type: PaymentType): number {
    switch (type) {
      case PaymentType.TOKENIZATION_FEE:
        return amount * this.feeRates.tokenization;
      case PaymentType.VERIFICATION_FEE:
        return amount * this.feeRates.verification;
      case PaymentType.INVESTMENT:
        return amount * this.feeRates.platform;
      default:
        return 0;
    }
  }

  async getPaymentStats(): Promise<{
    totalPayments: number;
    totalVolume: number;
    successRate: number;
    averageAmount: number;
    methodBreakdown: { [method: string]: number };
  }> {
    const stats = await this.paymentModel.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalVolume: { $sum: '$amount' },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          },
          averageAmount: { $avg: '$amount' },
        }
      }
    ]);

    const methodStats = await this.paymentModel.aggregate([
      { $group: { _id: '$method', count: { $sum: 1 } } }
    ]);

    const methodBreakdown: { [method: string]: number } = {};
    methodStats.forEach(stat => {
      methodBreakdown[stat._id] = stat.count;
    });

    const result = stats[0] || {
      totalPayments: 0,
      totalVolume: 0,
      successfulPayments: 0,
      averageAmount: 0,
    };

    return {
      totalPayments: result.totalPayments,
      totalVolume: result.totalVolume,
      successRate: result.totalPayments > 0 ? (result.successfulPayments / result.totalPayments) * 100 : 0,
      averageAmount: result.averageAmount,
      methodBreakdown,
    };
  }
}
