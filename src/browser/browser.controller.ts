import { Controller, Post, Body, Get } from '@nestjs/common';
import { BrowserService } from './browser.service';

@Controller('browser')
export class BrowserController {
  constructor(private readonly browserService: BrowserService) {}

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
}
