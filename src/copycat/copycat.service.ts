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

interface ActionResult {
  actionType: string;
  index: number | undefined;
  reason: string;
  succeeded: boolean;
  details?: { value: string };
  error?: string;
}

@Injectable()
export class CopyCatService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private elementMap: { [key: number]: { xpath: string; text: string } } = {};

  private readonly logger = new Logger(CopyCatService.name);
  constructor(
    private readonly browserAutomationService: BrowserAutomationService,
  ) { }

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
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
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
    const os = process.platform;
    const modifierKey = os === 'darwin' ? 'Command' : 'Ctrl';

    return [
      {
        type: 'text',
        text: `▲ BROWSER AUTOMATION AGENT ▲
Analyze SCREENSHOT with COLOR-CODED ELEMENT INDEXES (1-∞). Use ONLY VISIBLE INDEXES.

COMMAND SYNTAX:
1. click(<index>)          - Buttons, links, inputs
2. type(<index>, "text")   - Text fields, editors
3. press_key("<keys>")         - Keyboard actions (${modifierKey}+A, Enter, F5)
4. select(<index>, "text") - Dropdowns, radio buttons
5. navigate("<url>")       - Full URL required
6. wait(<ms>)              - 1000-5000ms pauses
7. scroll("<direction>")   - up|down|top|bottom

STRICT RULES:
• INDEXES MUST MATCH SCREENSHOT COLORS
• Numbering starts at 1 (no index 0)
• Maximum 3 actions per response
• Chain element sequences: click(2)→type(2,"text")
• If no valid index exists, use global actions

JSON SCHEMA:
<json>
{
  "actions": [
    {
      "action": "click|type|press_key|select|navigate|wait|scroll",
      "index": "ONLY if element-specific",
      "value": "required for type/select/navigate/wait",
      "reason": "15-word max explanation"
    }
  ],
  "status": "continue|finish",
  "summary": "25-word max step overview"
}
</json>

FAIL-SAFES:
1. INVALID INDEXES WILL CRASH SYSTEM
2. Action/value requirements:
   ┌─────────────┬───────────┬────────────────────────┐
   │ Action      │ Requires  │ Value Format           │
   ├─────────────┼───────────┼────────────────────────┤
   │ click       │ index     │ -                      │
   │ type        │ index     │ string                 │
   │ press_key   │ -         │ key combo              │
   │ select      │ index     │ option text/value      │
   │ navigate    │ -         │ full URL               │
   │ wait        │ -         │ 1000-5000              │
   │ scroll      │ -         │ direction              │
   └─────────────┴───────────┴────────────────────────┘

EXAMPLE 1 - FORM FILLING:
User: "Order 2 coffee mugs"
<json>
{
  "actions": [
    {"action": "click", "index": 5, "reason": "Select quantity field"},
    {"action": "type", "index": 5, "value": "2", "reason": "Update quantity"},
    {"action": "press_key", "value": "Tab", "reason": "Move to next field"}
  ],
  "status": "continue",
  "summary": "Updated item quantity"
}
</json>

EXAMPLE 2 - NO VISIBLE ELEMENTS:
<json>
{
  "actions": [
    {"action": "press_key", "value": "F5", "reason": "Refresh page"},
    {"action": "wait", "value": 2000, "reason": "Wait for reload"}
  ],
  "status": "continue",
  "summary": "Refreshed page content"
}
</json>

CURRENT TASK: "${originalPrompt}"

SCREENSHOT ANALYSIS:
• Indexes updated in real-time - use LATEST NUMBERS
• Elements without colored numbers CANNOT be used
• Verify index-color matching before responding
• If uncertain, use status:"continue" for next step

RESPOND ONLY WITH VALID JSON IN <json> TAGS.`,
      },
      {
        type: 'image_url',
        image_url: { 
          url: screenshotUrl,
          detail: "high"
        },
      },
    ];
  }

  private extractJSON(content: string): any | null {
    // Try structured formats first
    const structuredMatch = content.match(
      /(?:<json>|```json)(.*?)(?:<\/json>|```)/s
    );

    if (structuredMatch) {
      try {
        return JSON.parse(structuredMatch[1].trim());
      } catch (e) {
        console.warn('Failed to parse structured JSON, trying fallback...');
      }
    }

    // Fallback: Attempt to find first valid JSON in content
    const jsonCandidates = content.match(
      /{(?:[^{}]|{(?:[^{}]|)*})*}/gs
    ) || [];

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate.trim());
        // Basic schema validation
        if (parsed.actions && typeof parsed.status === 'string') {
          return parsed;
        }
      } catch (e) {
        // Continue checking other candidates
      }
    }

    // Final attempt: Try parsing entire content
    try {
      return JSON.parse(content.trim());
    } catch (e) {
      console.error('All JSON extraction attempts failed:', e);
      return null;
    }
  }

  async runAutomation(message: string) {
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

    while (true) {
      const result = await client.chat.completions.create({
        model: 'Qwen/Qwen2-VL-72B-Instruct',
        messages: messages,
      });

      const assistantResponse = result.choices[0].message.content;

      try {
        const response = this.extractJSON(assistantResponse);

        if (response === null) {
          console.error("Invalid JSON:", assistantResponse);
          continue;
        }

        console.log(JSON.stringify(response, null, 2));

        const actions: AutomationAction[] = response.actions || [];
        const status = response.status || 'continue';

        if (actions.length > 0) {
          messages.push({
            role: 'assistant',
            content: "Predicted actions: \n\n" + JSON.stringify(actions)
          });

          const response = await this.executeActions(actions);
          messages.push({
            role: 'user',
            content: "Action summary: \n\n" + response
          });

          await this.page?.waitForLoadState('networkidle');
        }

        // Process existing messages to replace images with text
        messages = messages.map(msg => {
          if (msg.role === 'user') {
            const content = msg.content;
            if (Array.isArray(content)) {
              const hasImage = content.some(part => part.type === 'image_url');
              if (hasImage) {
                return {
                  ...msg,
                  content: 'Screenshot Redacted ...'
                };
              }
            }
          }
          return msg;
        });

        await this.markClickableElements();
        const newScreenshot = await this.captureScreenshot();

        await this.removeMarkings();

        // Add new image message
        messages.push({
          role: 'user',
          content: [
            {
              "type": "text",
              "text": "Here is the most recent screenshot, predict the actions to be taken within <json> tags"
            },
            {
              "image_url": {
                "url": newScreenshot,
              },
              "type": "image_url",
            }]
        });

        if (status === 'finish') {
          return assistantResponse;
        }
      } catch (error) {
        console.error(error)
        console.error("We don't care, pass on to the next iteration ...");
      }
    }
  }

  async executeActions(actions: AutomationAction[]): Promise<string> {
    const actionResults: ActionResult[] = [];

    for await (const action of actions) {
      try {
        await this.browserAutomationService.executeAction(
          this.page,
          action,
          this.elementMap
        );

        await sleep(1000); // Wait for the page to load
        // Assuming executeAction returns a result object
        actionResults.push({
          actionType: action.action,
          index: action.index,
          reason: action.reason,
          succeeded: true,
          details: { value: action.value || '' }
        });
      } catch (error) {
        this.logger.error(
          `Failed to execute action ${action.action} on element ${action.index}`,
          error
        );

        // Collect failure information
        actionResults.push({
          actionType: action.action,
          index: action.index,
          reason: action.reason,
          succeeded: false,
          error: error.toString()
        });
      }
    }

    // Generate the summary of all actions
    const summary = this.generateSummary(actionResults);
    this.logger.debug('Action Execution Summary:');
    this.logger.debug(summary);

    return summary;
  }

  generateSummary(actionResults: ActionResult[]): string {
    return actionResults.map(result => {
      const base = `Action: ${result.actionType}, Index: ${result.index || 'N/A'}, Reason: ${result.reason}`;
      if (result.succeeded) {
        return `${base} - Succeeded. Details: ${result.details?.value || 'N/A'}`;
      } else {
        return `${base} - Failed. Error: ${result.error || 'Unknown error'}`;
      }
    }).join('\n');
  }
}
