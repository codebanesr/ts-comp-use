import { Module } from '@nestjs/common';
import { ScriptsService } from './scripts.service';
import { ClaudeComputerService } from 'src/claude-computer/claude-computer.service';
import { ClaudeComputerController } from 'src/claude-computer/claude-computer.controller';

@Module({
  controllers: [ClaudeComputerController],
  providers: [ScriptsService, ClaudeComputerService]
})
export class ScriptsModule {}
