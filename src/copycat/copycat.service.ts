// copy-cat.service.ts
import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

@Injectable()
export class CopyCatService {
  private browser: Browser | null = null;
  private elementMap: { [key: number]: { xpath: string; text: string } } = {};

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      executablePath:
        '/Users/shanurrahman/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    });
  }

  async analyzeWebsite(url: string): Promise<string> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser.newPage();
    try {
      await this.setupPage(page, url);
      await this.markClickableElements(page);
      const screenshotPath = await this.captureScreenshot(page);
      return screenshotPath;
    } finally {
      await page.close();
    }
  }

  private async setupPage(page: Page, url: string): Promise<void> {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Clear existing overlays
    await page.evaluate(() => {
      const existingOverlays = document.querySelectorAll(
        '.highlight-overlay, .number-label',
      );
      existingOverlays.forEach((overlay) => overlay.remove());
    });
  }

  private async markClickableElements(page: Page) {
    this.elementMap = {};
    const elements = await page.$$(
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

      // Get XPath and text content for the element
      const { xpath, text } = await page.evaluate((el) => {
        const getXPath = (element: Element): string => {
          if (!element.parentNode) return '';
          if (element === document.body) return '/html/body';

          let pos = 0;
          const siblings = element.parentNode.childNodes;

          for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
              const path = getXPath(element.parentNode as Element);
              const tag = element.tagName.toLowerCase();
              return `${path}/${tag}[${pos + 1}]`;
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

        // Get text content considering different element types
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

        return {
          xpath: getXPath(el),
          text: getText(el),
        };
      }, element);

      // Store element number, xpath, and text in map
      this.elementMap[i + 1] = { xpath, text };

      await page.evaluate(
        ({ box, i }) => {
          // Create box overlay
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

          // Create number label
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

    // Print the element map
    console.log('Element Number to XPath and Text mapping:');
    console.log(JSON.stringify(this.elementMap, null, 2));

    return this.elementMap;
  }

  private async captureScreenshot(page: Page): Promise<string> {
    const screenshotPath = 'screenshot.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      scale: 'css',
    });
    return screenshotPath;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
