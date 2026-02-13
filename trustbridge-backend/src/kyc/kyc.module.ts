import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KybService } from './kyb.service';
import { User, UserSchema } from '../schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AuthModule,
  ],
  controllers: [KycController],
  providers: [KycService, KybService],
  exports: [KycService, KybService],
})
export class KycModule {}
