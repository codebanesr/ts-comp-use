import * as dotenv from 'dotenv';
dotenv.config();

import * as shellEscape from 'shell-escape';

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources';
import { sleep } from '@anthropic-ai/sdk/core';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are utilising an Ubuntu virtual machine using {platform.machine()} architecture with internet access.
* You can feel free to install Ubuntu applications with your bash tool. Use curl instead of wget.
* To open firefox, please just click on the firefox icon.  Note, firefox-esr is what is installed on your system.
* Using bash tool you can start GUI applications, but you need to set export DISPLAY=:1 and use a subshell. For example "(DISPLAY=:1 xterm &)". GUI apps run with bash tool will appear within your desktop environment, but they may take some time to appear. Take a screenshot to confirm it did.
* When using your bash tool with commands that are expected to output very large quantities of text, redirect into a tmp file and use str_replace_editor or \`grep -n -B <lines before> -A <lines after> <query> <filename>\` to confirm output.
* When viewing a page it can be helpful to zoom out so that you can see everything on the page.  Either that, or make sure you scroll down to see everything before deciding something isn't available.
* When using your computer function calls, they take a while to run and send back to you.  Where possible/feasible, try to chain multiple of these calls all into one function calls request.
* The current date is {datetime.today().strftime('%A, %B %-d, %Y')}.
</SYSTEM_CAPABILITY>

<IMPORTANT>
* When using Firefox, if a startup wizard appears, IGNORE IT.  Do not even click "skip this step".  Instead, click on the address bar where it says "Search or enter address", and enter the appropriate search term or URL there.
* If the item you are looking at is a pdf, if after taking a single screenshot of the pdf it seems that you want to read the entire document instead of trying to continue to read the pdf from your screenshots + navigation, determine the URL, use curl to download the pdf, install and use pdftotext to convert it to a text file, and then read that text file directly with your StrReplaceEditTool.
</IMPORTANT>`;

enum ScalingSource {
  COMPUTER = 'computer',
  API = 'api',
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
  private displayPrefix: string;

  constructor() {
    const displayNum = process.env.DISPLAY_NUM || '1';
    this.displayPrefix = `DISPLAY=:${displayNum} `;

    this.actualWidth = parseInt(process.env.WIDTH || '0', 10);
    this.actualHeight = parseInt(process.env.HEIGHT || '0', 10);
    if (!this.actualWidth || !this.actualHeight) {
      throw new Error('WIDTH and HEIGHT environment variables must be set');
    }

    const { width, height } = this.computeScaledDimensions();
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

    return (
      targetDimension || { width: this.actualWidth, height: this.actualHeight }
    );
  }

  private scaleCoordinates(
    source: ScalingSource,
    x: number,
    y: number,
  ): { x: number; y: number } {
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

  private async executeAction(
    action: string,
    text: string,
    coordinates?: number[],
  ) {
    try {
      console.log(`Starting action: ${action}`);
      switch (action) {
        case 'mouse_move':
          if (!coordinates || coordinates.length < 2)
            throw new Error('Coordinates required for mouse_move');
          const scaledCoords = this.scaleCoordinates(
            ScalingSource.API,
            coordinates[0],
            coordinates[1],
          );
          console.log(`Moving mouse to: ${scaledCoords.x}, ${scaledCoords.y}`);
          execSync(
            `${this.displayPrefix}xdotool mousemove --sync ${scaledCoords.x} ${scaledCoords.y}`,
          );
          break;

        case 'key':
          console.log(`Pressing key: ${text}`);
          execSync(
            `${this.displayPrefix}xdotool key -- ${shellEscape([text])}`,
          );
          break;

        case 'type':
          console.log(`Typing text: ${text}`);
          const escapedText = shellEscape([text]);
          execSync(
            `${this.displayPrefix}xdotool type --delay 0 -- ${escapedText}`,
          );
          break;

        case 'left_click':
          console.log('Performing left click');
          execSync(`${this.displayPrefix}xdotool click 1`);
          break;

        case 'left_click_drag':
          if (!coordinates || coordinates.length < 2)
            throw new Error('Coordinates required for left_click_drag');
          const [endX, endY] = coordinates;
          const scaledEnd = this.scaleCoordinates(
            ScalingSource.API,
            endX,
            endY,
          );
          console.log(`Dragging to ${scaledEnd.x}, ${scaledEnd.y}`);
          execSync(
            `${this.displayPrefix}xdotool mousedown 1 mousemove --sync ${scaledEnd.x} ${scaledEnd.y} mouseup 1`,
          );
          break;

        case 'right_click':
          console.log('Performing right click');
          execSync(`${this.displayPrefix}xdotool click 3`);
          break;

        case 'middle_click':
          console.log('Performing middle click');
          execSync(`${this.displayPrefix}xdotool click 2`);
          break;

        case 'double_click':
          console.log('Performing double click');
          execSync(
            `${this.displayPrefix}xdotool click --repeat 2 --delay 500 1`,
          );
          break;

        case 'screenshot':
          console.log('Taking screenshot');
          try {
            execSync(`${this.displayPrefix}scrot -f screenshot.png -p`);
          } catch (e) {
            execSync(`${this.displayPrefix}scrot screenshot.png`);
          }
          const scaledDims = this.scaleCoordinates(
            ScalingSource.COMPUTER,
            this.displayWidth,
            this.displayHeight,
          );
          execSync(
            `convert screenshot.png -resize ${scaledDims.x}x${scaledDims.y}! resized.png`,
          );
          return { screenshot_path: 'resized.png' };

        case 'cursor_position':
          const position = execSync(
            `${this.displayPrefix}xdotool getmouselocation --shell`,
          ).toString();
          const match = position.match(/X=(\d+)\s+Y=(\d+)/);
          if (!match) throw new Error('Failed to get cursor position');
          const [x, y] = [parseInt(match[1], 10), parseInt(match[2], 10)];
          const scaledPosition = this.scaleCoordinates(
            ScalingSource.COMPUTER,
            x,
            y,
          );
          return { x: scaledPosition.x, y: scaledPosition.y };

        default:
          throw new Error(`Unsupported action: ${action}`);
      }
      console.log(`Action ${action} completed successfully`);
      return { success: true };
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
      throw error;
    }
  }

  async interactWithClaude(userPrompt: string) {
    console.log('Starting interaction with Claude');
    let messages: MessageParam[] = [
      {
        content: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
          },
          {
            type: 'text',
            text:
              'Use computer tool for mouse movements, clicks, keyboard typing and screenshots. \n' +
              userPrompt,
          },
        ],
        role: 'user',
      },
    ];

    let response: Anthropic.Beta.Messages.BetaMessage & {
      _request_id?: string | null;
    };

    do {
      await sleep(1000);
      response = await anthropic.beta.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        tools: [
          {
            type: 'computer_20241022',
            name: 'computer',
            display_width_px: this.displayWidth,
            display_height_px: this.displayHeight,
            display_number: 1,
          },
          {
            type: 'text_editor_20241022',
            name: 'str_replace_editor',
          },
          {
            type: 'bash_20241022',
            name: 'bash',
          },
        ],
        messages: messages,
        betas: ['computer-use-2024-10-22'],
      });

      if (response.stop_reason === 'tool_use') {
        console.log('Claude requested a tool use');
        const tool = response.content.find(
          (content) => content.type === 'tool_use',
        );
        messages.push({
          role: 'assistant',
          content: [
            {
              id: tool.id,
              input: tool.input,
              name: tool.name,
              type: tool.type,
            },
          ],
        });

        const result = await this.executeAction(
          // @ts-expect-error
          tool.input.action,
          // @ts-expect-error
          tool.input.text,
          // @ts-expect-error
          tool.input.coordinate,
        );

        if (result.screenshot_path) {
          console.log('Sending screenshot result back to Claude');
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: tool.id,
                content: [
                  {
                    type: 'image',
                    source: {
                      media_type: 'image/png',
                      data: fs
                        .readFileSync(result.screenshot_path)
                        .toString('base64'),
                      type: 'base64',
                    },
                  },
                ],
              },
            ],
          });
        } else if (result.x !== undefined && result.y !== undefined) {
          console.log(
            `Sending cursor position result back to Claude: ${result.x}, ${result.y}`,
          );
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: tool.id,
                content: [
                  {
                    type: 'text',
                    text: `Cursor position: ${result.x}, ${result.y}`,
                  },
                ],
              },
            ],
          });
        } else {
          console.log('Sending tool result back to Claude');
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: tool.id,
              },
            ],
          });
        }
      } else if (
        response.stop_reason === 'stop_sequence' ||
        response.stop_reason === 'end_turn'
      ) {
        console.log('Claude interaction completed');
        break;
      }
    } while (response.stop_reason === 'tool_use');

    return response;
  }
}
