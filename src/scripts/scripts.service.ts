import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ClaudeComputerService } from 'src/claude-computer/claude-computer.service';


const execAsync = promisify(exec);

@Injectable()
export class ScriptsService {
    constructor(private readonly computerUserService: ClaudeComputerService) {}
    
    async runScriptOne() {
        await this.computerUserService.interactWithClaude('Help me scroll 100 pixels down, take a screenshot and describe it. then click on the package.json tab. Use xdotool commands for keyboard please');
    }
}