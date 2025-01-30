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
import {
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources';

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

    // Capture the screenshot as a Buffer
    const buffer = await this.page.screenshot({
      path: screenshotPath, // Save to file
      fullPage: false,
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

  async runAutomation(message: string) {
    let conversationSummary = 'Conversation History:\n';
    await this.markClickableElements();
    let currentScreenshot = await this.captureScreenshot();

    const systemMessage: ChatCompletionUserMessageParam = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are a browser automation assistant. Follow these rules:
  1. Analyze the current screenshot with numbered elements
  2. Respond with JSON containing:
     - "actions": Array of { index: number, action: string, value?: string, reason: string }
     - "summary": Brief summary of this step (1-2 sentences)
     - "status": "continue" or "finish"
  3. Consider this conversation history: ${conversationSummary}
  4. Never refer to previous screenshots - only use the current one

  Example response:
  {
    "actions": [{ "index": 1, "action": "click", "reason": "Open login" }],
    "summary": "Clicked login button to access form",
    "status": "continue"
  }\n\n${message}`,
        },
        {
          type: 'image_url',
          image_url: { url: currentScreenshot },
        },
      ],
    };

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      systemMessage,
    ];

    while (true) {
      const result = await client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: messages,
      });

      const assistantResponse = result.choices[0].message.content;

      try {
        const response = JSON.parse(assistantResponse);
        const actions: AutomationAction[] = response.actions || [];
        const status = response.status || 'continue';
        const stepSummary = response.summary || 'No summary provided';

        // Update conversation history
        conversationSummary += `- ${stepSummary}\n`;

        if (status === 'finish') {
          console.log('Automation completed successfully');
          break;
        }

        if (actions.length > 0) {
          await this.executeActions(actions);

          // Update screenshot after actions
          await this.markClickableElements();
          currentScreenshot = await this.captureScreenshot();

          // Reset messages with updated summary and new screenshot
          messages.length = 0; // Clear previous messages
          messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                // Use a template string with explicit placeholder
                text: `You are a browser automation assistant. Follow these rules:
          1. Analyze the current screenshot with numbered elements
          2. Respond with JSON containing:
             - "actions": Array of { index: number, action: string, value?: string, reason: string }
             - "summary": Brief summary of this step (1-2 sentences)
             - "status": "continue" or "finish"
          3. Consider this conversation history:
          ${conversationSummary}
          4. Never refer to previous screenshots - only use the current one

          Example response:
          {
            "actions": [{ "index": 1, "action": "click", "reason": "Open login" }],
            "summary": "Clicked login button to access form",
            "status": "continue"
          }\n\n${message}`,
              },
              {
                type: 'image_url',
                image_url: { url: currentScreenshot },
              },
            ],
          });
        } else {
          messages.push({
            role: 'user',
            content:
              'No valid actions received. Please provide actions in JSON format.',
          });
        }
      } catch (error) {
        console.error('JSON parse error:', error);
        messages.push({
          role: 'user',
          content:
            'Invalid response format. Please use the specified JSON format.',
        });
      }

      await sleep(1000);
    }
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
