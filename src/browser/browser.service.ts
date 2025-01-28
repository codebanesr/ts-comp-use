import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BrowserService {
  async captureScreenshot(url: string): Promise<{
    screenshotPath: string;
    dimensions: { width: number; height: number };
  }> {
    // Launch the browser
    const browser = await chromium.launch({ headless: false }); // Use headless: true for production
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });

      // Maximize the browser window to full screen
      await page.setViewportSize({ width: 1920, height: 1080 }); // Set to a large size to simulate full screen
      await page.evaluate(() => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      });

      // Wait for a short period to ensure the page is fully loaded and in full screen
      await page.waitForTimeout(1000);

      // Take a screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage: true,
        type: 'png',
      }); // Explicitly set type to PNG

      // Get the dimensions of the viewport (window)
      const dimensions = await page.evaluate(() => {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
        };
      });

      // Save the screenshot to a file
      const screenshotPath = path.join(__dirname, 'screenshot.png');
      fs.writeFileSync(screenshotPath, screenshotBuffer);

      console.log(`Screenshot saved at: ${screenshotPath}`);
      console.log(
        `Window dimensions: ${dimensions.width}x${dimensions.height}`,
      );

      return { screenshotPath, dimensions };
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      throw error;
    } finally {
      // Close the browser
      await browser.close();
    }
  }
}
