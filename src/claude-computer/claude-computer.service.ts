import * as dotenv from 'dotenv';

dotenv.config();

import { Injectable } from '@nestjs/common';
import * as fs from "fs";
import Anthropic from '@anthropic-ai/sdk';
import * as sharp from 'sharp';
import { 
    screen,
    mouse,
    keyboard,
    Button,
    Point,
    straightTo,
    Key
} from '@nut-tree-fork/nut-js';
import { Message, MessageParam } from '@anthropic-ai/sdk/resources';

const anthropic = new Anthropic({
    "apiKey": process.env.ANTHROPIC_API_KEY
});

enum ScalingSource {
    COMPUTER = "computer",
    API = "api"
}

@Injectable()
export class ClaudeComputerService {
    private actualWidth: number;
    private actualHeight: number;
    private displayWidth: number;
    private displayHeight: number;
    private readonly MAX_SCALING_TARGETS = [
        { name: 'XGA', width: 1024, height: 768 },
        { name: 'WXGA', width: 1280, height: 800 },
        { name: 'FWXGA', width: 1366, height: 768 },
    ];
    private scalingEnabled = true;

    constructor() {
        this.actualWidth = parseInt(process.env.WIDTH || '0', 10);
        this.actualHeight = parseInt(process.env.HEIGHT || '0', 10);
        if (!this.actualWidth || !this.actualHeight) {
            throw new Error("WIDTH and HEIGHT environment variables must be set");
        }

        const { width, height } = this.computeScaledDimensions();
        console.log({ width, height });
        this.displayWidth = width;
        this.displayHeight = height;
    }

    private computeScaledDimensions(): { width: number; height: number } {
        const actualRatio = this.actualWidth / this.actualHeight;
        let targetDimension = null;

        for (const target of this.MAX_SCALING_TARGETS) {
            const targetRatio = target.width / target.height;
            if (Math.abs(targetRatio - actualRatio) < 0.02) {
                if (target.width < this.actualWidth) {
                    targetDimension = target;
                    break;
                }
            }
        }

        return targetDimension || { width: this.actualWidth, height: this.actualHeight };
    }

    private scaleCoordinates(source: ScalingSource, x: number, y: number): { x: number; y: number } {
        if (source === ScalingSource.API) {
            if (x > this.displayWidth || y > this.displayHeight) {
                throw new Error(`Coordinates ${x}, ${y} are out of bounds`);
            }
        }

        if (!this.scalingEnabled) {
            return { x, y };
        }

        const xScalingFactor = this.displayWidth / this.actualWidth;
        const yScalingFactor = this.displayHeight / this.actualHeight;

        if (source === ScalingSource.API) {
            return {
                x: Math.round(x / xScalingFactor),
                y: Math.round(y / yScalingFactor),
            };
        } else {
            return {
                x: Math.round(x * xScalingFactor),
                y: Math.round(y * yScalingFactor),
            };
        }
    }

    private async executeAction(action: string, text: string, coordinates?: number[]) {
        switch (action) {
            case 'mouse_move':
                if (!coordinates) throw new Error('Coordinates required for mouse_move');
                const scaledCoords = this.scaleCoordinates(ScalingSource.API, coordinates[0], coordinates[1]);
                await mouse.move(straightTo(new Point(scaledCoords.x, scaledCoords.y)));
                break;

            case "key":
                const commands = text.split(' ').map((key) => Key[key]);
                await Promise.all(commands.map((command) => keyboard.pressKey(command)));
                break;

            case 'left_click':
                await mouse.click(Button.LEFT);
                break;

            case 'double_click':
                await mouse.doubleClick(Button.LEFT);
                break;

            case 'type':
                await keyboard.type(text);
                break;

            case 'screenshot':
                const shotPath = 'screenshot.png';
                await screen.capture(shotPath);
                await sharp(shotPath)
                    .resize(this.displayWidth, this.displayHeight)
                    .toFile('resized.png');
                return { screenshot_path: 'resized.png' };

            default:
                throw new Error(`Unsupported action: ${action}`);
        }
        return { success: true };
    }

    async interactWithClaude(userPrompt: string) {
        let messages: MessageParam[] = [{
            "content": [{
                "type": "text",
                "text": "Use computer tool for mouse movements, clicks, keyboard typing and screenshots. \n" + userPrompt
            }],
            "role": "user",
        }];

        let response: Anthropic.Beta.Messages.BetaMessage & { _request_id?: string | null };

        do {
            response = await anthropic.beta.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
                tools: [{
                    type: "computer_20241022",
                    name: "computer",
                    display_width_px: this.displayWidth,
                    display_height_px: this.displayHeight,
                    display_number: 1
                },
                {
                    type: "text_editor_20241022",
                    name: "str_replace_editor"
                },
                {
                    type: "bash_20241022",
                    name: "bash"
                }],
                messages: messages,
                betas: ["computer-use-2024-10-22"],
            });

            console.log({ content: JSON.stringify(response.content, null, 2) });

            if (response.stop_reason === "tool_use") {
                const tool = response.content.find((content) => content.type === "tool_use");
                messages.push({
                    role: "assistant",
                    content: [{
                        "id": tool.id,
                        "input": tool.input,
                        name: tool.name,
                        type: tool.type,
                    }]
                });

                // @ts-ignore
                const result = await this.executeAction(tool.input.action, tool.input.text, tool.input.coordinate);

                if (result.screenshot_path) {
                    messages.push({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": tool.id,
                            "content": [{
                                "type": "image",
                                "source": {
                                    "media_type": "image/png",
                                    "data": fs.readFileSync(result.screenshot_path).toString('base64'),
                                    "type": "base64"
                                }
                            }]
                        }]
                    });
                } else {
                    messages.push({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": tool.id
                        }]
                    });
                }
            } else if (response.stop_reason === "stop_sequence" || response.stop_reason === "end_turn") {
                break;
            }
        } while (response.stop_reason === "tool_use");

        return response;
    }
}