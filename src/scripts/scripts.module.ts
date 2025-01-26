import { Module } from '@nestjs/common';
import { ScriptsService } from './scripts.service';
import { ClaudeComputerService } from 'src/claude-computer/claude-computer.service';

@Module({
  providers: [ScriptsService, ClaudeComputerService]
})
export class ScriptsModule {}
