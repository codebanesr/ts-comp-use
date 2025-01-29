import * as dotenv from 'dotenv';
dotenv.config();

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { ContentBlockParam, MessageParam } from '@anthropic-ai/sdk/resources';
import { sleep } from '@anthropic-ai/sdk/core';
import { HumanToolPlaywrightService } from './human-tool.service';

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

  private context: BrowserContext;

  constructor(private readonly humanToolService: HumanToolPlaywrightService) {}

  async openBrowser() {
    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    // Configure video recording
    const videoDirectory = 'recordings';
    if (!fs.existsSync(videoDirectory)) {
      fs.mkdirSync(videoDirectory);
    }

    // Get updated user agent
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

    this.context = await this.browser.newContext({
      viewport: {
        width: parseInt(process.env.WIDTH || '1366', 10),
        height: parseInt(process.env.HEIGHT || '768', 10),
      },
      userAgent: userAgent,
      permissions: [],
      geolocation: undefined,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      recordVideo: {
        dir: videoDirectory,
        size: {
          width: 1366,
          height: 768,
        },
      },
      // Add evasion measures
      bypassCSP: true,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      // Mask as regular Chrome
      isMobile: false,
      hasTouch: false,
      deviceScaleFactor: 1,
    });

    // Additional anti-detection measures
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    this.page = await this.context.newPage();

    // Randomize navigation timing
    await this.page.goto('https://google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  async closeBrowser() {
    await this.context.close(); // Finalizes video recording
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
          } else if (text == 'Down' || text == 'Page_Down') {
            // do this 5 times at least
            await this.page.keyboard.press('ArrowDown');
          } else if (text == 'Up') {
            await this.page.keyboard.press('ArrowUp');
          } else if (text == 'Left') {
            await this.page.keyboard.press('ArrowLeft');
          } else if (text == 'Right') {
            await this.page.keyboard.press('ArrowRight');
          } else if (text === 'ctrl+a') {
            await this.page.keyboard.press('ControlOrMeta+A');
          } else if (text === 'ctrl+c') {
            await this.page.keyboard.press('Control+C');
          } else if (text === 'ctrl+v') {
            await this.page.keyboard.press('Control+V');
          } else if (text === 'ctrl+x') {
            await this.page.keyboard.press('Control+X');
          } else if (text === 'ctrl+z') {
            await this.page.keyboard.press('Control+Z');
          } else if (text === 'alt+F4') {
            await this.page.keyboard.press('Alt+F4');
          } else if (text === 'ctrl+Delete') {
            await this.page.keyboard.press('ControlOrMeta+Delete');
          }
          // try to execute the key
          else {
            try {
              await this.page.keyboard.press(text);
            } catch (error) {
              console.log({ 'could not execute, unmapped key': text });
            }
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
            fullPage: false,
          });
          return { screenshot_path: screenshotName };

        case 'cursor_position':
          return {
            x: this.currentMouseX,
            y: this.currentMouseY,
          };

        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      console.log(
        `Action ${action} completed successfully, sleep for 1 second`,
      );
      await sleep(1000);

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

    const removeOldestToolUseAndResult = () => {
      while (messages.length > 24) {
        const index = messages.findIndex(
          (message) =>
            message.role === 'assistant' &&
            (message.content[0] as ContentBlockParam)?.type === 'tool_use',
        );

        if (index !== -1) {
          // Remove the tool_use and the corresponding tool_result
          messages.splice(index, 2); // Remove both the tool_use and tool_result
        } else {
          break; // No more tool_use pairs to remove
        }
      }
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
          // {
          //   type: 'custom',
          //   description:
          //     'Call this whenever you want to pause and ask for human input. For example when inputting in youtube search bar',
          //   name: 'human',
          //   input_schema: {
          //     properties: {
          //       prompt: {
          //         title: 'Prompt',
          //         type: 'string',
          //         description: 'The prompt to display to the user.',
          //         default: 'Please provide your input.',
          //       },
          //     },
          //     type: 'object',
          //   },
          // },
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

          if (tool.name === 'human') {
            // here we need to show an input box where user can enter the details. Then that input has to be inputted into
            const humanResponse = await this.humanToolService.displayInputBox(
              // @ts-expect-error
              tool.input.prompt,
              this.page,
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
                      text: humanResponse,
                    },
                  ],
                },
              ],
            });
          }

          // check tool.name == 'computer' then use this function
          else if (tool.name === 'computer') {
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
                        text: tool.input.toString(),
                      },
                    ],
                  },
                ],
              });
            }
          }
          // should be replaced with summarization to handle long contexts
          removeOldestToolUseAndResult();
        }
      }
    } while (response.stop_reason === 'tool_use');

    return response;
  }
}
