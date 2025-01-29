// browser-automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

// Types for our automation
export interface AutomationAction {
  index: number;
  action: 'click' | 'type' | 'select' | 'hover' | 'wait';
  value?: string;
  reason: string;
  next_action?: string;
}

@Injectable()
export class BrowserAutomationService {
  private readonly logger = new Logger(BrowserAutomationService.name);

  constructor() {}

  async executeAction(
    page: Page,
    action: AutomationAction,
    elementMap: { [key: number]: { xpath: string; text: string } },
  ): Promise<void> {
    const elementXPath = elementMap[action.index]?.xpath;
    if (!elementXPath) {
      throw new Error(`No element found for index ${action.index}`);
    }

    this.logger.log(
      `Executing ${action.action} on element ${action.index} (${elementXPath}) - Reason: ${action.reason}`,
    );

    switch (action.action) {
      case 'click':
        await this.handleClick(page, elementXPath);
        break;
      case 'type':
        await this.handleType(page, elementXPath, action.value);
        break;
      case 'select':
        await this.handleSelect(page, elementXPath, action.value);
        break;
      case 'hover':
        await this.handleHover(page, elementXPath);
        break;
      case 'wait':
        await this.handleWait(page);
        break;
      default:
        throw new Error(`Unsupported action: ${action.action}`);
    }

    // Wait for any network requests to complete
    await page.waitForLoadState('networkidle');
  }

  private async handleClick(page: Page, xpath: string): Promise<void> {
    await page.locator(`xpath=${xpath}`).waitFor({ state: 'visible' });
    const element = await page.$(`xpath=${xpath}`);
    if (!element) {
      throw new Error(`Element not found: ${xpath}`);
    }

    // Scroll element into view before clicking
    await element.scrollIntoViewIfNeeded();
    await element.click();
  }

  private async handleType(
    page: Page,
    xpath: string,
    value?: string,
  ): Promise<void> {
    if (!value) {
      throw new Error('Value is required for type action');
    }

    await page.locator(`xpath=${xpath}`).waitFor({ state: 'visible' });
    const element = await page.$(`xpath=${xpath}`);
    if (!element) {
      throw new Error(`Element not found: ${xpath}`);
    }

    // Clear existing value first
    await element.click({ clickCount: 3 }); // Triple click to select all text
    await element.press('Backspace');
    await element.type(value, { delay: 100 }); // Add slight delay between keystrokes
  }

  private async handleSelect(
    page: Page,
    xpath: string,
    value?: string,
  ): Promise<void> {
    if (!value) {
      throw new Error('Value is required for select action');
    }

    await page.locator(`xpath=${xpath}`).waitFor({ state: 'visible' });
    const element = await page.$(`xpath=${xpath}`);
    if (!element) {
      throw new Error(`Element not found: ${xpath}`);
    }

    await element.selectOption({ label: value });
  }

  private async handleHover(page: Page, xpath: string): Promise<void> {
    await page.locator(`xpath=${xpath}`).waitFor({ state: 'visible' });
    const element = await page.$(`xpath=${xpath}`);
    if (!element) {
      throw new Error(`Element not found: ${xpath}`);
    }

    await element.hover();
  }

  private async handleWait(page: Page): Promise<void> {
    // Wait for network requests to complete and a brief pause
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  }

  async verifyActionResult(
    page: Page,
    action: AutomationAction,
  ): Promise<boolean> {
    try {
      // Wait for any animations to complete
      await page.waitForTimeout(500);

      // Basic verification based on action type
      switch (action.action) {
        case 'click':
          // Could verify if a new element appeared or if URL changed
          await page.waitForLoadState('networkidle');
          return true;

        case 'type':
          // Could verify if the value was actually set
          return true;

        case 'select':
          // Could verify if the selection was made
          return true;

        default:
          return true;
      }
    } catch (error) {
      this.logger.error(
        `Failed to verify action ${action.action} result`,
        error,
      );
      return false;
    }
  }
}
