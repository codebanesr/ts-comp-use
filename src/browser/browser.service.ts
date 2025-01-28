import * as dotenv from 'dotenv';
dotenv.config();

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { chromium, Browser, Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources';
import { sleep } from '@anthropic-ai/sdk/core';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are controlling a Chromium browser using Playwright
* You can navigate to URLs, interact with web elements, click buttons, fill forms, and take screenshots
* Use the computer tool to perform actions like mouse movements, clicks, keyboard input, and taking screenshots
* The viewport is set to ${process.env.WIDTH || '1366'}x${process.env.HEIGHT || '768'} pixels
* When interacting with elements, ensure they are visible and in the viewport. Scroll if necessary
</SYSTEM_CAPABILITY>

<IMPORTANT>
* Wait for page loads to complete before interacting with elements
* Handle dialogs/popups explicitly with clicks or keyboard actions
* For dynamic content, ensure elements are loaded before interacting
* Verify actions using screenshots when uncertain
</IMPORTANT>`;

@Injectable()
export class BrowserService {
  private browser: Browser;
  private page: Page;
  private currentMouseX = 0;
  private currentMouseY = 0;

  async openBrowser() {
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
    const width = parseInt(process.env.WIDTH || '1366', 10);
    const height = parseInt(process.env.HEIGHT || '768', 10);
    await this.page.setViewportSize({ width, height });

    await this.page.goto('https://google.com');
    await sleep(2000);
  }

  async closeBrowser() {
    await this.browser.close();
  }

  private generateUniqueFileName(prefix = 'screenshot', extension = 'png') {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${randomString}.${extension}`;
  }

  private async executeAction(
    action: string,
    text: string,
    coordinates?: number[],
  ) {
    try {
      console.log({ action, text, coordinates });
      switch (action) {
        case 'mouse_move':
          if (!coordinates || coordinates.length < 2)
            throw new Error('Coordinates required for mouse_move');
          await this.page.mouse.move(coordinates[0], coordinates[1]);
          this.currentMouseX = coordinates[0];
          this.currentMouseY = coordinates[1];
          break;

        case 'key':
          if (text == 'Return') {
            await this.page.keyboard.press('Enter');
          } else {
            await this.page.keyboard.press(text);
          }
          break;

        case 'type':
          await this.page.keyboard.type(text);
          break;

        case 'left_click':
          await this.page.mouse.click(this.currentMouseX, this.currentMouseY, {
            button: 'left',
          });
          break;

        case 'left_click_drag':
          if (!coordinates || coordinates.length < 2)
            throw new Error('Coordinates required for left_click_drag');
          const [endX, endY] = coordinates;
          await this.page.mouse.down({ button: 'left' });
          await this.page.mouse.move(endX, endY);
          await this.page.mouse.up({ button: 'left' });
          this.currentMouseX = endX;
          this.currentMouseY = endY;
          break;

        case 'right_click':
          await this.page.mouse.click(this.currentMouseX, this.currentMouseY, {
            button: 'right',
          });
          break;

        case 'middle_click':
          await this.page.mouse.click(this.currentMouseX, this.currentMouseY, {
            button: 'middle',
          });
          break;

        case 'double_click':
          await this.page.mouse.dblclick(
            this.currentMouseX,
            this.currentMouseY,
            { button: 'left' },
          );
          break;

        case 'screenshot':
          const screenshotName = this.generateUniqueFileName();
          await this.page.screenshot({
            path: screenshotName,
            fullPage: true,
          });
          await sleep(1000);
          return { screenshot_path: screenshotName };

        case 'cursor_position':
          return {
            x: this.currentMouseX,
            y: this.currentMouseY,
          };

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
    const messages: MessageParam[] = [
      {
        content: [
          {
            type: 'text',
            text: SYSTEM_PROMPT + '\n' + userPrompt,
          },
        ],
        role: 'user',
      },
    ];

    let response: Anthropic.Beta.Messages.BetaMessage & {
      _request_id?: string | null;
    };

    do {
      response = await anthropic.beta.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        tools: [
          {
            type: 'computer_20241022',
            name: 'computer',
            display_width_px: parseInt(process.env.WIDTH || '1366', 10),
            display_height_px: parseInt(process.env.HEIGHT || '768', 10),
            display_number: 1,
          },
        ],
        messages: messages,
        betas: ['computer-use-2024-10-22'],
      });

      console.log({ content: JSON.stringify(response.content, null, 2) });
      if (response.stop_reason === 'tool_use') {
        const tools = response.content.filter(
          (content) => content.type === 'tool_use',
        );

        for (const tool of tools) {
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
          } else {
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: tool.id,
                  content: [
                    {
                      type: 'text',
                      text: 'Success',
                    },
                  ],
                },
              ],
            });
          }
        }
      }
    } while (response.stop_reason === 'tool_use');

    return response;
  }
}
