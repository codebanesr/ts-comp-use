import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
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

    // Launch the browser with the desired configuration
    this.browser = await chromium.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--window-size=1920,1080', // Initial window size
            '--start-maximized', // Start the browser maximized
        ],
    });

    // Create a new browser context
    const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        permissions: ['geolocation'],
        colorScheme: 'dark',
        locale: 'en-US',
        deviceScaleFactor: 1,
        hasTouch: false,
    });

    // Create a new page
    this.page = await context.newPage();

    // Override navigator.webdriver
    await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    // Make the browser go full screen
    await this.page.evaluate(() => {
        // Use the Fullscreen API to request full screen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
            // For older versions of Chrome/Safari
            (document.documentElement as any).webkitRequestFullscreen();
        }
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

    // await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle', {timeout: 3000}).catch(() => { 
      console.log("Timeout waiting for network idle @ setupPage")
    });

    await this.page.evaluate(() => {
      document
        .querySelectorAll('.highlight-overlay, .number-label')
        .forEach((overlay) => overlay.remove());
    });
  }

  async markClickableElements() {
    if (!this.page) return;
    this.elementMap = {};

    await sleep(1000); // Wait for the page to load
    const elements = await this.page.$$(
      [
        // Standard form elements
        'button',
        'input:not([type="hidden"])',
        'textarea',
        'select',
        
        // Interactive elements
        'a[href]',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[role="switch"]',
        '[role="tab"]',
        
        // Form controls
        'label',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="combobox"]',
        '[role="slider"]',
        '[role="spinbutton"]',
        
        // Custom interactive elements
        '[contenteditable="true"]',
        '[tabindex]:not([tabindex="-1"])',
        
        // Controls with click handlers
        '[onClick]',
        '[onKeyPress]',
        '[onKeyDown]',
        '[onKeyUp]',
        
        // Common interactive class names
        '.clickable',
        '.interactive',
        '.button',
        '.btn'
      ].join(', ').trim()
    );
    
    const occupiedPositions = new Set();

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const box = await element.boundingBox();

      // Define an array of high-contrast colors
      const colors = [
        '#FF0000', // Red
        '#00FF00', // Lime Green
        '#0000FF', // Blue
        '#FFA500', // Orange
        '#800080', // Purple
        '#008080', // Teal
        '#FF69B4', // Hot Pink
        '#4B0082', // Indigo
        '#006400', // Dark Green
        '#8B0000', // Dark Red
        '#4169E1', // Royal Blue
        '#FFD700', // Gold
      ];

      // Get color for current element (cycle through colors array)
      const currentColor = colors[i % colors.length];

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
        ({ box, i, currentColor }) => {
          const highlight = document.createElement('div');
          highlight.className = 'highlight-overlay';
          highlight.style.position = 'absolute';
          highlight.style.left = `${box.x}px`;
          highlight.style.top = `${box.y}px`;
          highlight.style.width = `${box.width}px`;
          highlight.style.height = `${box.height}px`;
          highlight.style.border = `3px solid ${currentColor}`; // Thicker border
          highlight.style.zIndex = '99999';
          highlight.style.pointerEvents = 'none';

          // Add ARIA label for accessibility
          highlight.setAttribute('role', 'presentation');
          highlight.setAttribute('aria-label', `Highlighted element ${i + 1}`);

          const label = document.createElement('div');
          label.className = 'number-label';
          label.textContent = (i + 1).toString();
          label.style.position = 'absolute';
          label.style.left = `${box.x}px`;
          label.style.top = `${box.y - 20}px`;
          label.style.color = currentColor;
          label.style.fontSize = '16px'; // Larger font size
          label.style.fontWeight = 'bold';
          label.style.zIndex = '100000';
          label.style.backgroundColor = '#FFFFFF'; // White background
          label.style.padding = '2px 6px';
          label.style.borderRadius = '3px';
          label.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';

          // Add ARIA label for accessibility
          label.setAttribute('role', 'presentation');
          label.setAttribute('aria-label', `Element number ${i + 1}`);

          document.body.appendChild(highlight);
          document.body.appendChild(label);
        },
        { box, i, currentColor },
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
        text: `You are a browser automation assistant using Playwright. You are currently on ${this.page.url()}, if you find yourself in the wrong url, use navigate action to go back to the correct url. Analyze the screenshot and the Original Instruction and follow these rules:

  Rules:
  1. Examine the screenshot with numbered interactive elements (the boxes and numbers are color coded so you know which number belongs to which box). **You must use the colors to identify the element indexes **
  2. Generate actions in JSON format with:
     - "actions": Array of Playwright commands (use only allowed actions)
     - "summary": Concise step description (1-2 sentences)
     - "status": "continue" or "finish"
  3. You are working alongside the user as an assistant, so part of the work might already be done, you need to finish the remaining. Only generate actions for what is still pending
  4. You may have multiple options to choose from, reflect on what the user said and then take the best course of action. For example, the first link isn't always the best option to choose from.

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
  4. Use 'wait' strategically between actions, for example when filling out a form, wait for the dropdown to appear before taking a screenshot again and selecting it, wait should always be followed by screenshot
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

      await this.removeMarkings();
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

      const assistantResponse = result.choices[0].message.content;

      try {
        const response = JSON.parse(assistantResponse);

        const actions: AutomationAction[] = response.actions || [];
        const status = response.status || 'continue';

        if (actions.length > 0) {
          // this function should return what actions were taken so we can append it to the messages array
          await this.executeActions(actions);
          await this.page?.waitForLoadState('networkidle');
        }

        if (status === 'finish') {
          return assistantResponse;
        }
      } catch (error) {
        console.error(error)
        console.error("We don't care, pass on to the next iteration ...");
      }

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
