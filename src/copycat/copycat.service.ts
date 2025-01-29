import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

@Injectable()
export class CopyCatService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private elementMap: { [key: number]: { xpath: string; text: string } } = {};

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

  async analyzeWebsite(url: string): Promise<string> {
    if (!this.isBrowserInitialized()) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Page is not initialized.');
    }

    try {
      await this.setupPage(url);
      await this.markClickableElements();
      return await this.captureScreenshot();
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

    const screenshotPath = 'screenshot.png';
    await this.page.screenshot({
      path: screenshotPath,
      fullPage: false,
      scale: 'css',
    });
    return screenshotPath;
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async runAutomation(url: string, message: string) {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant that can analyze a website and return the text and xpath of the clickable elements.',
      },
      {
        role: 'user',
        content: message,
      },
    ];

    do {
      const result = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_website',
              description:
                'Analyze a website and return the text and xpath of the clickable elements.',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'The URL of the website to analyze.',
                  },
                },
                required: ['url'],
              },
            },
          },
          // function to end the conversation
          {
            function: {
              name: 'finish',
              description: 'Finish the conversation.',
              parameters: {
                type: 'object',
                properties: {
                  input: {
                    type: 'string',
                    description: 'The input to finish the conversation.',
                  },
                },
                required: ['input'],
              },
            },
            type: 'function',
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
          if (tool.function.name === 'analyze_website') {
            const params = JSON.parse(tool.function.arguments);
            const result = await this.analyzeWebsite(params.url);
            messages.push({
              role: 'tool',
              tool_call_id: tool.id,
              content: result,
            });
          } else if (tool.function.name === 'finish') {
            break;
          }
        }
      }
      message = result.choices[0].message.content;
    } while (true);
  }
}
