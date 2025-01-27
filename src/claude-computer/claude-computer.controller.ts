import { Controller, Post, Body, Get } from '@nestjs/common';
import { ClaudeComputerService } from './claude-computer.service';

@Controller('claude-computer')
export class ClaudeComputerController {
    constructor(private readonly claudeComputerService: ClaudeComputerService) {}

    @Post('interact')
    async interactWithClaude(@Body('message') message: string) {
        return await this.claudeComputerService.interactWithClaude(message);
    }

    @Get()
    async getClaudeStatus() {
        return { status: 'active' };
    }
}
