// browser-automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

export interface AutomationAction {
  index: number;
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

  async executeAction(
    page: Page,
    action: AutomationAction,
    elementMap: { [key: number]: { xpath: string; text: string } },
  ): Promise<void> {
    let elementXPath: string | null = null;

    // Handle element-based actions
    if (!['navigate', 'wait', 'scroll'].includes(action.action)) {
      elementXPath = elementMap[action.index]?.xpath;
      if (!elementXPath) {
        throw new Error(`No element found for index ${action.index}`);
      }
    }

    this.logger.log(
      `Executing ${action.action}${elementXPath ? ` on element ${action.index} (${elementXPath})` : ''} - Reason: ${action.reason}`,
    );

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
        await this.handlePressKey(page, elementXPath!, action.value);
        break;
      case 'drag':
        await this.handleDrag(page, elementXPath!, action.value, elementMap);
        break;
      default:
        throw new Error(`Unsupported action: ${action.action}`);
    }

    await page.waitForLoadState('networkidle');
  }

  private async handleClick(page: Page, xpath: string): Promise<void> {
    const element = await this.getVisibleElement(page, xpath);
    await element.scrollIntoViewIfNeeded();
    await element.click();
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
    await element.type(value, { delay: 100 });
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

  private async handleHover(page: Page, xpath: string): Promise<void> {
    const element = await this.getVisibleElement(page, xpath);
    await element.hover();
  }

  private async handleWait(waitTime?: string): Promise<void> {
    const duration = parseInt(waitTime || '1', 10) * 1000;
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  private async handleNavigate(page: Page, url?: string): Promise<void> {
    if (!url) throw new Error('URL required for navigate action');
    await page.goto(url);
  }

  private async handleScroll(page: Page, value?: string): Promise<void> {
    const scrollValue = value || '0';
    let scrollAmount = 0;

    if (scrollValue === 'up') scrollAmount = -500;
    else if (scrollValue === 'down') scrollAmount = 500;
    else scrollAmount = parseInt(scrollValue, 10);

    await page.mouse.wheel(0, scrollAmount);
  }

  private async handlePressKey(
    page: Page,
    xpath: string,
    value?: string,
  ): Promise<void> {
    if (!value) throw new Error('Key value required for press_key action');
    const element = await this.getVisibleElement(page, xpath);
    await element.press(value);
  }

  private async handleDrag(
    page: Page,
    sourceXpath: string,
    targetIndex: string,
    elementMap: { [key: number]: { xpath: string; text: string } },
  ): Promise<void> {
    const targetXpath = elementMap[parseInt(targetIndex, 10)]?.xpath;
    if (!targetXpath) throw new Error(`Invalid target index: ${targetIndex}`);

    // Get source and target elements using locators
    const sourceLocator = page.locator(`xpath=${sourceXpath}`);
    const targetLocator = page.locator(`xpath=${targetXpath}`);

    // Wait for both elements to be visible
    await sourceLocator.waitFor({ state: 'visible' });
    await targetLocator.waitFor({ state: 'visible' });

    // Get the bounding boxes of both elements
    const sourceBoundingBox = await sourceLocator.boundingBox();
    const targetBoundingBox = await targetLocator.boundingBox();

    if (!sourceBoundingBox || !targetBoundingBox) {
      throw new Error('Unable to get element positions for drag operation');
    }

    // Perform the drag and drop operation
    await page.mouse.move(
      sourceBoundingBox.x + sourceBoundingBox.width / 2,
      sourceBoundingBox.y + sourceBoundingBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBoundingBox.x + targetBoundingBox.width / 2,
      targetBoundingBox.y + targetBoundingBox.height / 2,
      { steps: 10 }, // Makes the drag movement smoother
    );
    await page.mouse.up();
  }

  private async getVisibleElement(page: Page, xpath: string) {
    const locator = page.locator(`xpath=${xpath}`);
    await locator.waitFor({ state: 'visible' });
    const element = await locator.elementHandle();
    if (!element) throw new Error(`Element not found: ${xpath}`);
    return element;
  }

  async verifyActionResult(
    page: Page,
    action: AutomationAction,
  ): Promise<boolean> {
    try {
      await page.waitForTimeout(500);

      switch (action.action) {
        case 'navigate':
          return page.url().includes(action.value || '');

        case 'scroll':
          // Could verify scroll position if needed
          return true;

        case 'drag':
          // Verify using application-specific logic
          return true;

        default:
          return true;
      }
    } catch (error) {
      this.logger.error(`Verification failed for ${action.action}`, error);
      return false;
    }
  }
}
