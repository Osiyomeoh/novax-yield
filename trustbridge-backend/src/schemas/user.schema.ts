import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  INVESTOR = 'INVESTOR',
  ASSET_OWNER = 'ASSET_OWNER',
  VERIFIER = 'VERIFIER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  AMC_ADMIN = 'AMC_ADMIN',
}

export enum KycStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'approved',
  REJECTED = 'rejected',
  NOT_STARTED = 'not_started',
}

export enum EmailVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  NOT_VERIFIED = 'NOT_VERIFIED',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  walletAddress: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop()
  name?: string;

  @Prop()
  phone?: string;

  @Prop()
  country?: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.INVESTOR })
  role: UserRole;

  @Prop({ required: true, enum: KycStatus, default: KycStatus.NOT_STARTED })
  kycStatus: KycStatus;

  @Prop()
  kycInquiryId?: string;

  @Prop()
  kycProvider?: string;

  @Prop({ enum: KycStatus })
  kybStatus?: KycStatus;

  @Prop()
  kybInquiryId?: string;

  @Prop()
  kybProvider?: string;

  @Prop({ required: true, enum: EmailVerificationStatus, default: EmailVerificationStatus.NOT_VERIFIED })
  emailVerificationStatus: EmailVerificationStatus;

  @Prop({ default: 0 })
  reputation: number;

  @Prop({ default: 0 })
  stakingBalance: number;

  @Prop({ default: 0 })
  stakingRewards: number;

  @Prop({ default: 0 })
  totalInvested: number;

  @Prop({ default: 0 })
  investmentCount: number;

  @Prop({ default: 0 })
  trustTokenBalance: number;

  @Prop({ type: Object })
  aiUsage?: {
    daily: Record<string, number>;
    monthly: Record<string, number>;
    totalQueries: number;
  };

  @Prop()
  lastInvestmentDate?: Date;

  @Prop()
  lastActivity?: Date;

  @Prop()
  region?: string;

  @Prop()
  password?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop({ type: Object })
  profile?: {
    bio?: string;
    avatar?: string;
    website?: string;
    socialLinks?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
    };
  };

  // USSD security PIN (hashed)
  @Prop()
  pinHash?: string;

  // PIN security controls
  @Prop({ default: 0 })
  pinAttempts?: number;

  @Prop()
  pinLockedUntil?: Date;

  @Prop()
  lastPinSetAt?: Date;

  // OTP fields for forgot PIN
  @Prop()
  otpCode?: string;

  @Prop()
  otpExpiresAt?: Date;

  @Prop({ default: 0 })
  otpAttempts?: number;

  @Prop()
  hederaAccountId?: string;

  @Prop()
  hederaPublicKey?: string;

  /**
   * WARNING: For demo/hackathon only. In production encrypt or never store at all!
   */
  @Prop()
  hederaPrivateKey?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
