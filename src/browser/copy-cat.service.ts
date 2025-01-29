// copy-cat.service.ts
import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

@Injectable()
export class CopyCatService {
  private browser: Browser | null = null;

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

  private async markClickableElements(page: Page): Promise<void> {
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

    await page.waitForTimeout(10000);
  }

  private async captureScreenshot(page: Page): Promise<string> {
    const screenshotPath = 'screenshot.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
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
