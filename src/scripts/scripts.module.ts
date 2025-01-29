import { Module } from '@nestjs/common';
import { ScriptsService } from './scripts.service';
import { ClaudeComputerService } from 'src/claude-computer/claude-computer.service';
import { ClaudeComputerController } from 'src/claude-computer/claude-computer.controller';
import { BrowserModule } from 'src/browser/browser.module';
import { CopycatModule } from 'src/copycat/copycat.module';

@Module({
  imports: [BrowserModule, CopycatModule],
  controllers: [ClaudeComputerController],
  providers: [ScriptsService, ClaudeComputerService],
})
export class ScriptsModule {}
