import { Body, Controller, Post } from '@nestjs/common';
import { CopyCatService } from './copycat.service';

@Controller('copycat')
export class CopycatController {
  constructor(private readonly copyCatService: CopyCatService) {}

  @Post('analyze')
  async copyCat(@Body('url') url: string) {
    const result = await this.copyCatService.analyzeWebsite(url);
    return result;
  }

  @Post('run')
  async run(@Body('url') url: string) {
    const result = await this.copyCatService.run(url);
    return result;
  }
}
