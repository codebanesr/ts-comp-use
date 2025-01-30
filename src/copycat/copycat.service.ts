import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import {
  AutomationAction,
  BrowserAutomationService,
} from './browser-automation.service';
import { sleep } from '@anthropic-ai/sdk/core';
import { ChatCompletionUserMessageParam } from 'openai/resources';

const client = new OpenAI({
  apiKey: '9047ff792d95f758d6f21cc2440e37272951b5e4b86541f0f5083fe9c7cd84a4', // This is the default and can be omitted,
  baseURL: 'https://api.together.xyz/v1',
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
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ],
    });

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      permissions: ['geolocation'],
      colorScheme: 'dark',
      locale: 'en-US',
      deviceScaleFactor: 1,
      hasTouch: false,
    });

    this.page = await context.newPage();

    // Override navigator.webdriver
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
  }

  async initWebsiteStart(url: string): Promise<void> {
    if (!this.isBrowserInitialized()) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Page is not initialized.');
    }

    try {
      await this.setupPage(url);
      await this.markClickableElements();
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
          label.style.fontWeight = 'normal';
          label.style.zIndex = '100000';

          document.body.appendChild(highlight);
          document.body.appendChild(label);
        },
        { box, i },
      );
    }
  }

  async removeMarkings() {
    await this.page.evaluate(() => {
      document
        .querySelectorAll('.highlight-overlay')
        .forEach((highlight) => highlight.remove());
      document
        .querySelectorAll('.number-label')
        .forEach((label) => label.remove());
    });
  }

  async captureScreenshot(): Promise<string> {
    console.log("taking a screenshot")
    if (!this.page) throw new Error('Page is not initialized.');
    // Define the folder where screenshots will be saved
    const screenshotFolder = 'screenshots';

    // Capture the screenshot as a Buffer
    const buffer = await this.page.screenshot({
      fullPage: false,
      path: path.join(screenshotFolder, `screenshot_${new Date().getTime()}.png`),
      scale: 'css',
    });

    // Convert to base64 encoded string with data URL prefix
    const base64String = buffer.toString('base64');
    return `data:image/png;base64,${base64String}`;
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

  private createSystemMessageContent(
    screenshotUrl: string,
    originalPrompt: string,
  ): ChatCompletionUserMessageParam['content'] {
    // Detect platform architecture
    const os = process.platform;
    const isMac = os === 'darwin';

    return [
      {
        type: 'text',
        text: `You are a browser automation assistant using Playwright. Analyze the screenshot and follow these rules:

  Rules:
  1. Examine the screenshot with numbered interactive elements
  2. Generate actions in JSON format with:
     - "actions": Array of Playwright commands (use only allowed actions)
     - "summary": Concise step description (1-2 sentences)
     - "status": "continue" or "finish"
  3. You are working alongside the user as an assistant, so part of the work might already be done, you need to finish the remaining. Only generate actions for what is still pending

  Allowed Actions (Playwright-specific):
  - click(index): Left-click element
  - double_click(index): Double left-click
  - right_click(index): Right-click context menu
  - type(index, value): Input text (supports Unicode)
  - select(index, value): Select dropdown option
  - hover(index): Mouse hover
  - wait(value): Pause in seconds
  - navigate(value): Load URL
  - scroll(value): Scroll ('up', 'down', or pixels)
  - press_key(value): Keyboard action (single key or modifier combo)
  - drag(index, targetIndex): Drag and drop

  3. Only output the actions you can take on this screenshot. We will ask you for more instructions once we navigate to the next page.

  Keyboard Specifics:
  - Use Playwright key names: 'ArrowUp', 'Enter', 'Control', etc.
  - Combine modifiers with '+': 'Control+V', 'Shift+ArrowDown'
  - Common combinations:
    - Copy: '${isMac ? 'Command' : 'Control'}+C'
    - Paste: '${isMac ? 'Command' : 'Control'}+V'
    - Select All: '${isMac ? 'Command' : 'Control'}+A'
    - Tab Navigation: 'Control+Tab'
    - Refresh: 'F5'

  Response Requirements:
  1. ** index are numbers that we have given to each element after adding a box around them, this is what we use to tell each other what element to interact with **
  2. For text input, include exact values
  3. Chain related actions (click -> type -> press_key)
  4. Use 'wait' strategically between actions
  5. Make sure to not use enter and click for the same action.

  Example Workflow:
  User: "Search for playwright docs and open first result"
  Response:
  {
    "actions": [
      { "index": 12, "action": "click", "reason": "Focus search field" },
      { "index": 12, "action": "type", "value": "playwright docs", "reason": "Enter query" },
      { "action": "press_key", "value": "Enter", "reason": "Submit search" },
      { "index": 5, "action": "click", "reason": "Open first result" }
    ],
    "status": "finish"
  }

  Current Platform: ${os === 'darwin' ? 'macOS' : 'Linux'}


  Original Instruction:
  ${originalPrompt}
  `,
      },
      {
        type: 'image_url',
        image_url: { url: screenshotUrl },
      },
    ];
  }

  async runAutomation(message: string) {
    while (true) {
      await this.markClickableElements();
      const screenshot = await this.captureScreenshot();
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: this.createSystemMessageContent(
            screenshot,
            message,
          ),
        },
      ];


      const result = await client.chat.completions.create({
        model: 'Qwen/Qwen2-VL-72B-Instruct',
        messages: messages,
      });

      await this.removeMarkings();

      const assistantResponse = result.choices[0].message.content;

      try {
        const response = JSON.parse(assistantResponse);

        const actions: AutomationAction[] = response.actions || [];
        const status = response.status || 'continue';

        if (actions.length > 0) {
          // this function should return what actions were taken so we can append it to the messages array
          await this.executeActions(actions);
        } 

        if (status === 'finish') {
          console.log('Automation completed successfully');

          // verify the result, then either exit or continue;
          // break;
        }
      } catch (error) {
        console.error("We don't care, pass on to the next iteration ...");
      }

      await sleep(1000);
    }
  }

  async executeActions(actions: AutomationAction[]): Promise<void> {
    for await (const action of actions) {
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
