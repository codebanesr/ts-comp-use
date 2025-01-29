import { Body, Controller, Post } from '@nestjs/common';
import { CopyCatService } from './copycat.service';

@Controller('copycat')
export class CopycatController {
  constructor(private readonly copyCatService: CopyCatService) {}

  @Post('analyze')
  async copyCat(@Body('url') url: string) {
    const result = await this.copyCatService.initWebsiteStart(url);
    return result;
  }

  // Write a controller called run, this endpoint will take a url and a message, then it will open the browser, call markClickableElements, then
  // call openai function to ask it what action to be taken next, then use BrowserAutomationService execution method to execute the action

  @Post('run')
  async run(@Body('url') url: string, @Body('message') message: string) {
    await this.copyCatService.initWebsiteStart(url);

    const result = await this.copyCatService.runAutomation(message);
    return result;
  }
}
