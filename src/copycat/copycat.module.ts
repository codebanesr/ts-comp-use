import { Module } from '@nestjs/common';
import { CopycatController } from './copycat.controller';
import { CopyCatService } from './copycat.service';

@Module({
  controllers: [CopycatController],
  providers: [CopyCatService],
})
export class CopycatModule {}
