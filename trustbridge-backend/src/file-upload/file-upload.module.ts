import { Module } from '@nestjs/common';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { GoogleDriveService } from './google-drive.service';
// HederaModule removed - using Etherlink/Novax
import { IPFSModule } from '../ipfs/ipfs.module';

@Module({
  imports: [/* HederaModule removed */ IPFSModule],
  controllers: [FileUploadController],
  providers: [FileUploadService, GoogleDriveService],
  exports: [FileUploadService, GoogleDriveService],
})
export class FileUploadModule {}
