import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { 
    screen,
    mouse,
    keyboard,
    Button,
    Point,
    Region
} from '@nut-tree-fork/nut-js';

const anthropic = new Anthropic();

@Injectable()
export class ClaudeComputerService {
    private async executeAction(action: any) {
        switch (action.action) {
            case 'mouse_move':
                await mouse.move(straightTo(new Point(action.coordinate[0], action.coordinate[1])));
                break;
            case 'left_click':
                await mouse.click(Button.LEFT);
                break;
            case 'double_click':
                await mouse.doubleClick(Button.LEFT);
                break;
            case 'type':
                await keyboard.type(action.text);
                break;
            case 'screenshot':
                const shot = await screen.capture('screenshot.png');
                return { screenshot_path: shot };
            // Add more cases as needed
            default:
                throw new Error(`Unsupported action: ${action.action}`);
        }
        return { success: true };
    }

    async interactWithClaude(userPrompt: string) {
        let messages = [{ role: "user", content: userPrompt }];
        let response;

        do {
            response = await anthropic.beta.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
                tools: [
                    {
                        type: "computer_20241022",
                        name: "computer",
                        display_width_px: 1024,
                        display_height_px: 768,
                        display_number: 1
                    }
                ],
                messages: messages,
                betas: ["computer-use-2024-10-22"],
            });

            if (response.stop_reason === "tool_use") {
                const toolUse = response.tool_use;
                const result = await this.executeAction(toolUse.input);
                messages.push({
                    role: "assistant",
                    content: JSON.stringify(result)
                });
            }
        } while (response.stop_reason === "tool_use");

        return response;
    }
}