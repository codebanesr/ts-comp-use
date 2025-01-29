import { Module } from '@nestjs/common';
import { CopycatController } from './copycat.controller';
import { CopyCatService } from './copycat.service';
import { BrowserAutomationService } from './browser-automation.service';

@Module({
  controllers: [CopycatController],
  providers: [CopyCatService, BrowserAutomationService],
})
export class CopycatModule {}
