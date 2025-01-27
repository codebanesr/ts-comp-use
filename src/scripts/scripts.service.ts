import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ClaudeComputerService } from 'src/claude-computer/claude-computer.service';


const execAsync = promisify(exec);

@Injectable()
export class ScriptsService {
    constructor(private readonly computerUserService: ClaudeComputerService) {}
    
    async runScriptOne() {
        await this.computerUserService.interactWithClaude('Scroll down to 200px');
    }
}