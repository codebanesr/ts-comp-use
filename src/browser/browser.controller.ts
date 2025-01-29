import { Controller, Post, Body, Get } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { CopyCatService } from './copy-cat.service';

@Controller('browser')
export class BrowserController {
  constructor(
    private readonly browserService: BrowserService,
    private readonly copyCatService: CopyCatService,
  ) {}

  @Post('interact')
  async interactWithClaude(@Body('message') message: string) {
    await this.browserService.openBrowser();
    const result = await this.browserService.interactWithClaude(message);

    await this.browserService.closeBrowser();
    return result;
  }

  @Get('check')
  async checkStatus() {
    return { success: true };
  }

  @Post('copy-cat')
  async copyCat(@Body('url') url: string) {
    const result = await this.copyCatService.analyzeWebsite(url);
    return result;
  }
}
