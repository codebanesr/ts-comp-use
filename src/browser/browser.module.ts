import { Module } from '@nestjs/common';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';
import { HumanToolPlaywrightService } from './human-tool.service';
import { CopyCatService } from './copy-cat.service';

@Module({
  controllers: [BrowserController],
  providers: [BrowserService, HumanToolPlaywrightService, CopyCatService],
})
export class BrowserModule {}
