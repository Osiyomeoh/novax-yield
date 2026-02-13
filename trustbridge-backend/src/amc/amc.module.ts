import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AMCService } from './amc.service';
import { AMCController } from './amc.controller';
// MantleModule removed - using Etherlink/Novax
import { NotificationsModule } from '../notifications/notifications.module';
import { GmailService } from '../services/gmail.service';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    // MantleModule removed
    NotificationsModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AMCController],
  providers: [AMCService, GmailService],
  exports: [AMCService],
})
export class AMCModule {}
