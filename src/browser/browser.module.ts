import { Module } from '@nestjs/common';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';

@Module({
  controllers: [BrowserController],
  providers: [BrowserService],
})
export class BrowserModule {}
