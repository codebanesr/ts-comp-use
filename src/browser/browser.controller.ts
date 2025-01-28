import { Controller, Post, Body, Res, Get } from '@nestjs/common';
import { Response } from 'express';
import { BrowserService } from './browser.service';

@Controller('browser')
export class BrowserController {
  constructor(private readonly browserService: BrowserService) {}

  @Post('capture-screenshot')
  async captureScreenshot(@Body('url') url: string, @Res() res: Response) {
    if (!url) {
      return res.status(400).send('URL is required');
    }

    try {
      const screenshotBuffer = await this.browserService.captureScreenshot(url);
      res.setHeader('Content-Type', 'image/png');
      res.send(screenshotBuffer);
    } catch (error) {
      res.status(500).send('Failed to capture screenshot');
    }
  }

  @Get()
  async checkStatus() {
    return { success: true };
  }
}
