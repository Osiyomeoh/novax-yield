import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core modules
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

// Feature modules - Only Novax Yield related modules
import { VerificationModule } from './verification/verification.module';
import { AMCModule } from './amc/amc.module';
import { AMCPoolsModule } from './amc-pools/amc-pools.module';

// Service modules - Only essential services for Novax Yield
import { ChainlinkModule } from './chainlink/chainlink.module';
import { UsersModule } from './users/users.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AdminModule } from './admin/admin.module';
import { IPFSModule } from './ipfs/ipfs.module';
import { HealthModule } from './health/health.module';
import { KycModule } from './kyc/kyc.module';

import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/trustbridge',
      {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      }
    ),


    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Event emitter
    EventEmitterModule.forRoot(),

    // Core modules
    DatabaseModule,
    AuthModule,

    // Feature modules - Only Novax Yield related
    VerificationModule,
    AMCModule,
    AMCPoolsModule,

    // Service modules - Only essential services
    ChainlinkModule,
    UsersModule,
    FileUploadModule,
    NotificationsModule,
    WebSocketModule,
    AdminModule,
    IPFSModule,
    HealthModule,
    KycModule,
  ],
})
export class AppModule {}
