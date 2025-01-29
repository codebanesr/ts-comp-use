import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import {
  AutomationAction,
  BrowserAutomationService,
} from './browser-automation.service';

const client = new OpenAI({
  apiKey: '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', // This is the default and can be omitted,
  baseURL: 'https://api.groq.com/openai/v1',
});

@Injectable()
export class CopyCatService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private elementMap: { [key: number]: { xpath: string; text: string } } = {};

  private readonly logger = new Logger(CopyCatService.name);
  constructor(
    private readonly browserAutomationService: BrowserAutomationService,
  ) {}

  isBrowserInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }

  async initialize(): Promise<void> {
    if (this.isBrowserInitialized()) return;

    this.browser = await chromium.launch({
      headless: false,
      executablePath:
        '/Users/shanurrahman/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    });

    this.page = await this.browser.newPage();
  }

  async initWebsiteStart(url: string): Promise<string> {
    if (!this.isBrowserInitialized()) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Page is not initialized.');
    }

    try {
      await this.setupPage(url);
      await this.markClickableElements();
      return this.captureScreenshot();
    } catch (error) {
      console.error('Error analyzing website:', error);
      throw error;
    }
  }

  private async setupPage(url: string): Promise<void> {
    if (!this.page) return;

    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');

    await this.page.evaluate(() => {
      document
        .querySelectorAll('.highlight-overlay, .number-label')
        .forEach((overlay) => overlay.remove());
    });
  }

  async markClickableElements() {
    if (!this.page) return;

    this.elementMap = {};
    const elements = await this.page.$$(
      'a, button, input, textarea, select, [role=button], [onclick]',
    );

    const occupiedPositions = new Set();

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const box = await element.boundingBox();

      if (!box) continue;

      const positionKey = `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`;

      if (occupiedPositions.has(positionKey)) continue;
      occupiedPositions.add(positionKey);

      const { xpath, text } = await this.page.evaluate((el) => {
        const getXPath = (element: Element): string => {
          if (!element.parentNode) return '';
          if (element === document.body) return '/html/body';

          let pos = 0;
          const siblings = element.parentNode.childNodes;

          for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
              const path = getXPath(element.parentNode as Element);
              return `${path}/${element.tagName.toLowerCase()}[${pos + 1}]`;
            }
            if (
              sibling.nodeType === 1 &&
              (sibling as Element).tagName.toLowerCase() ===
                element.tagName.toLowerCase()
            ) {
              pos++;
            }
          }
          return '';
        };

        const getText = (element: Element): string => {
          if (element instanceof HTMLInputElement) {
            return element.value || element.placeholder || element.type;
          } else if (element instanceof HTMLTextAreaElement) {
            return element.value || element.placeholder;
          } else if (element instanceof HTMLSelectElement) {
            return element.options[element.selectedIndex]?.text || '';
          } else {
            return element.textContent?.trim() || '';
          }
        };

        return { xpath: getXPath(el), text: getText(el) };
      }, element);

      this.elementMap[i + 1] = { xpath, text };

      await this.page.evaluate(
        ({ box, i }) => {
          const highlight = document.createElement('div');
          highlight.className = 'highlight-overlay';
          highlight.style.position = 'absolute';
          highlight.style.left = `${box.x}px`;
          highlight.style.top = `${box.y}px`;
          highlight.style.width = `${box.width}px`;
          highlight.style.height = `${box.height}px`;
          highlight.style.border = '2px solid red';
          highlight.style.zIndex = '99999';
          highlight.style.pointerEvents = 'none';

          const label = document.createElement('div');
          label.className = 'number-label';
          label.textContent = (i + 1).toString();
          label.style.position = 'absolute';
          label.style.left = `${box.x}px`;
          label.style.top = `${box.y - 20}px`;
          label.style.color = 'red';
          label.style.fontSize = '14px';
          label.style.fontWeight = 'bold';
          label.style.zIndex = '100000';

          document.body.appendChild(highlight);
          document.body.appendChild(label);
        },
        { box, i },
      );
    }

    console.log('Element Number to XPath and Text mapping:', this.elementMap);
  }

  async captureScreenshot(): Promise<string> {
    if (!this.page) throw new Error('Page is not initialized.');

    // Define the folder where screenshots will be saved
    const screenshotFolder = 'screenshots';

    // Create the folder if it doesn't exist
    if (!fs.existsSync(screenshotFolder)) {
      fs.mkdirSync(screenshotFolder);
    }

    // Generate a unique filename using a timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotName = `screenshot-${timestamp}.png`;
    const screenshotPath = path.join(screenshotFolder, screenshotName);

    // Capture the screenshot and save it to the specified path
    await this.page.screenshot({
      path: screenshotPath,
      fullPage: false,
      scale: 'css',
    });

    return screenshotPath;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async runAutomation(message: string) {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a helpful assistant that can run browser automation actions on a website. The way you do it is by taking a screenshot of the page and then predicting next actions
          To make your job easier the screenshots will have all the elements labelled with a number. so your job is to give me back that number along with the actions as defined in the schema.`,
      },
      {
        role: 'user',
        content: message,
      },
    ];

    do {
      const result = await client.chat.completions.create({
        function_call: 'auto',
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'capture_screenshot',
              description:
                'Use this to take screenshot of the current page. Then you can decide what action to take next',
              parameters: {},
            },
          },
          {
            type: 'function',
            function: {
              name: 'propose_actions',
              description:
                'Propose a list of automation actions to execute (click, type, select, etc). Returns an array of actions with element indices, action types, values, and execution reasons.',
              parameters: {
                type: 'object',
                properties: {
                  actions: {
                    type: 'array',
                    description: 'Array of automation actions to execute',
                    items: {
                      type: 'object',
                      properties: {
                        index: {
                          type: 'number',
                          description:
                            'Index of the element in the screenshot to interact with',
                        },
                        action: {
                          type: 'string',
                          enum: ['click', 'type', 'select', 'hover', 'wait'],
                          description: 'Type of action to perform',
                        },
                        value: {
                          type: 'string',
                          description:
                            'Optional value for actions like typing or selecting',
                        },
                        reason: {
                          type: 'string',
                          description:
                            'Explanation why this action should be executed',
                        },
                        next_action: {
                          type: 'string',
                          description:
                            'Optional description of subsequent action',
                        },
                      },
                      required: ['index', 'action', 'reason'],
                    },
                  },
                },
                required: ['actions'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'finish',
              description:
                'Use this tool to end the conversation once the user request has been met.',
              parameters: {
                type: 'object',
                properties: {},
                required: [],
              },
            },
          },
        ],
      });

      if (result.choices[0].finish_reason === 'tool_calls') {
        const tools = result.choices[0].message.tool_calls;
        messages.push({
          role: 'assistant',
          tool_calls: tools,
        });

        for (const tool of tools) {
          if (tool.function.name === 'capture_screenshot') {
            // update the dictionary and send it to execute actions
            await this.markClickableElements();
            const result = await this.captureScreenshot();
            messages.push({
              role: 'tool',
              tool_call_id: tool.id,
              content: result,
            });
          } else if (tool.function.name === 'propose_actions') {
            const actions = JSON.parse(
              tool.function.arguments,
            ) as AutomationAction[];

            const result = await this.executeActions(actions);

            messages.push({
              role: 'tool',
              tool_call_id: tool.id,
              content: 'Ran all tools successfully',
            });
          } else if (tool.function.name === 'finish') {
            break;
          }
        }
      }
      message = result.choices[0].message.content;
    } while (true);
  }

  async executeActions(actions: AutomationAction[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.browserAutomationService.executeAction(
          this.page,
          action,
          this.elementMap,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute action ${action.action} on element ${action.index}`,
          error,
        );
        throw error;
      }
    }
  }
}
