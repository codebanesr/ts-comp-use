import { Injectable } from '@nestjs/common';
import { Page } from 'playwright'; // Assuming Page is being imported from Playwright

@Injectable()
export class HumanToolPlaywrightService {
  constructor() {}

  // Modify this method to accept a message to display above the input box
  async displayInputBox(message: string, page: Page): Promise<string> {
    // Create and show the message on the page (could be a simple text element)
    await page.evaluate((message) => {
      const messageElement = document.createElement('div');
      messageElement.textContent = message;
      messageElement.style.fontSize = '16px';
      messageElement.style.marginBottom = '10px';
      document.body.appendChild(messageElement);
    }, message);

    // Create the input box for user input
    await page.evaluate(() => {
      const inputBox = document.createElement('input');
      inputBox.setAttribute('type', 'text');
      inputBox.setAttribute('id', 'user-input');
      document.body.appendChild(inputBox);
      inputBox.focus();
    });

    // Listen for the user to submit the input and retrieve the value
    const userInput = await page.locator('#user-input').inputValue();

    return userInput;
  }
}
