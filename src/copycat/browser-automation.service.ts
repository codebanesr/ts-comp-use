// browser-automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { sleep } from 'openai/core';
import { Page } from 'playwright';

export interface AutomationAction {
  index?: number;
  action:
    | 'click'
    | 'double_click'
    | 'right_click'
    | 'type'
    | 'select'
    | 'hover'
    | 'wait'
    | 'navigate'
    | 'scroll'
    | 'press_key'
    | 'drag';
  value?: string;
  reason: string;
  next_action?: string;
}

@Injectable()
export class BrowserAutomationService {
  private readonly logger = new Logger(BrowserAutomationService.name);
  private readonly indexedActions = new Set([
    'click',
    'double_click',
    'right_click',
    'type',
    'select',
    'hover',
    'drag',
  ]);

  private async handleClick(page: Page, xpath: string): Promise<void> {
    try {
      const element = await this.getVisibleElement(page, xpath);

      // Optional: Check if the element is in viewport
      const isInViewport = await element.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <=
            (window.innerWidth || document.documentElement.clientWidth)
        );
      });

      if (!isInViewport) {
        await element.scrollIntoViewIfNeeded();
      }

      await element.click({ force: true });

      // Wait for network idle if necessary
      await page
        .waitForLoadState('networkidle', { timeout: 3000 })
        .catch(() => {
          /* Ignore timeout if no navigation occurs */
        });
    } catch (error) {
      console.error(
        `Error clicking element with xpath ${xpath}: ${error.message}`,
      );
      // You can add custom error handling here if needed
      return; // Continue execution after logging the error
    }
  }

  private async handleDoubleClick(page: Page, xpath: string): Promise<void> {
    const element = await this.getVisibleElement(page, xpath);
    await element.scrollIntoViewIfNeeded();
    await element.dblclick();
  }

  private async handleRightClick(page: Page, xpath: string): Promise<void> {
    const element = await this.getVisibleElement(page, xpath);
    await element.scrollIntoViewIfNeeded();
    await element.click({ button: 'right' });
  }

  private async handleType(
    page: Page,
    xpath: string,
    value?: string,
  ): Promise<void> {
    if (!value) throw new Error('Value required for type action');
    const element = await this.getVisibleElement(page, xpath);
    await element.click({ clickCount: 3 });
    await element.press('Backspace');
    await page.keyboard.type(value);
  }

  private async handleSelect(
    page: Page,
    xpath: string,
    value?: string,
  ): Promise<void> {
    if (!value) throw new Error('Value required for select action');
    const element = await this.getVisibleElement(page, xpath);
    await element.selectOption({ label: value });
  }

  private async handleWait(waitTime?: string): Promise<void> {
    const duration = parseInt(waitTime || '1', 10) * 1000;
    await sleep(duration);
  }

  private async handleNavigate(page: Page, url?: string): Promise<void> {
    if (!url) throw new Error('URL required for navigate action');
    await page.goto(url);
    await page.waitForLoadState('networkidle', { timeout: 3000 }); // Wait for navigation to complete
  }

  private async handleHover(page: Page, xpath: string): Promise<void> {
    const element = await this.getVisibleElement(page, xpath);
    await element.hover();
  }

  async executeAction(
    page: Page,
    action: AutomationAction,
    elementMap: { [key: number]: { xpath: string; text: string } },
  ): Promise<void> {
    let elementXPath: string | null = null;

    // Validate element-based actions
    if (this.indexedActions.has(action.action)) {
      if (action.index === undefined) {
        throw new Error(`${action.action} requires element index`);
      }
      elementXPath = elementMap[action.index]?.xpath;
      if (!elementXPath) {
        throw new Error(`No element found for index ${action.index}`);
      }
    }

    // Handle press_key separately for element/page context
    if (action.action === 'press_key' && action.index !== undefined) {
      elementXPath = elementMap[action.index]?.xpath;
      if (!elementXPath) {
        throw new Error(`No element found for index ${action.index}`);
      }
    }

    this.logActionExecution(action, elementXPath);

    switch (action.action) {
      case 'click':
        await this.handleClick(page, elementXPath!);
        break;
      case 'double_click':
        await this.handleDoubleClick(page, elementXPath!);
        break;
      case 'right_click':
        await this.handleRightClick(page, elementXPath!);
        break;
      case 'type':
        await this.handleType(page, elementXPath!, action.value);
        break;
      case 'select':
        await this.handleSelect(page, elementXPath!, action.value);
        break;
      case 'hover':
        await this.handleHover(page, elementXPath!);
        break;
      case 'wait':
        await this.handleWait(action.value);
        break;
      case 'navigate':
        await this.handleNavigate(page, action.value);
        break;
      case 'scroll':
        await this.handleScroll(page, action.value);
        break;
      case 'press_key':
        await this.handlePressKey(page, elementXPath, action.value);
        break;
      case 'drag':
        await this.handleDrag(page, elementXPath!, action.value, elementMap);
        break;
      default:
        throw new Error(`Unsupported action: ${action.action}`);
    }

    await page.waitForLoadState('networkidle', { timeout: 3000 });
  }

  private logActionExecution(
    action: AutomationAction,
    elementXPath: string | null,
  ) {
    const actionDetails = [];
    if (elementXPath) actionDetails.push(`element ${action.index}`);
    if (action.value) actionDetails.push(`value: ${action.value}`);

    this.logger.log(
      `Executing ${action.action}${actionDetails.length ? ` (${actionDetails.join(', ')})` : ''} - ${action.reason}`,
    );
  }

  private async handlePressKey(
    page: Page,
    elementXPath: string | null,
    value?: string,
  ): Promise<void> {
    if (!value) throw new Error('Key value required for press_key action');

    if (elementXPath) {
      const element = await this.getVisibleElement(page, elementXPath);
      await element.press(value);
    } else {
      await page.keyboard.press(value, { delay: 100 });
    }
  }

  // Updated drag handler with improved positioning
  private async handleDrag(
    page: Page,
    sourceXpath: string,
    targetIndex: string,
    elementMap: { [key: number]: { xpath: string; text: string } },
  ): Promise<void> {
    const targetXpath = elementMap[parseInt(targetIndex, 10)]?.xpath;
    if (!targetXpath) throw new Error(`Invalid target index: ${targetIndex}`);

    const sourceLocator = page.locator(`xpath=${sourceXpath}`);
    const targetLocator = page.locator(`xpath=${targetXpath}`);

    await sourceLocator.waitFor({ state: 'visible', timeout: 2000 });
    await targetLocator.waitFor({ state: 'visible', timeout: 2000 });

    // Use Playwright's built-in dragTo method
    await sourceLocator.dragTo(targetLocator, {
      sourcePosition: { x: 2, y: 2 }, // Avoid edge click issues
      targetPosition: { x: 2, y: 2 },
    });
  }

  // Updated scroll handler with precision control
  private async handleScroll(page: Page, value?: string): Promise<void> {
    const scrollValue = value || '0';

    // Get the current viewport dimensions
    const viewport = page.viewportSize();
    const viewportHeight = viewport.height || 0;

    if (scrollValue === 'up') {
      await page.mouse.wheel(0, -viewportHeight * 0.8);
    } else if (scrollValue === 'down') {
      await page.mouse.wheel(0, viewportHeight * 0.8);
    } else {
      const pixels = parseInt(scrollValue, 10);
      await page.mouse.wheel(0, pixels);
    }
  }

  // Enhanced verification for keyboard actions
  private async getVisibleElement(page: Page, xpath: string) {
    const locator = page.locator(`xpath=${xpath}`);
    await locator.waitFor({ state: 'visible', timeout: 2000 });
    const element = await locator.elementHandle();
    if (!element) throw new Error(`Element not found: ${xpath}`);
    return element;
  }

  async verifyActionResult(
    page: Page,
    action: AutomationAction,
    elementMap: { [key: number]: { xpath: string; text: string } },
  ): Promise<boolean> {
    try {
      await page.waitForTimeout(1000); // Allow UI updates

      switch (action.action) {
        case 'press_key':
          // Verify using application state changes
          return true; // Implementation specific checks

        case 'type':
          if (action.index) {
            const element = await this.getVisibleElement(
              page,
              `xpath=${elementMap[action.index].xpath}`,
            );
            return (await element.inputValue()) === action.value;
          }
          return true;

        // Other verification cases...

        default:
          console.log({ unverified: action.action });
          return true;
      }
    } catch (error) {
      this.logger.error(`Verification failed for ${action.action}`, error);
      return false;
    }
  }
}
