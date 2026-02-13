import { Module } from '@nestjs/common';
import { ChainlinkController } from './chainlink.controller';
import { ChainlinkService } from './chainlink.service';
import { ChainlinkExternalService } from './chainlink-external.service';
import { ChainlinkFunctionsController } from './chainlink-functions.controller';
import { ChainlinkFunctionsService } from './chainlink-functions.service';

@Module({
  controllers: [ChainlinkController, ChainlinkFunctionsController],
  providers: [ChainlinkService, ChainlinkExternalService, ChainlinkFunctionsService],
  exports: [ChainlinkService, ChainlinkExternalService, ChainlinkFunctionsService],
})
export class ChainlinkModule {}
