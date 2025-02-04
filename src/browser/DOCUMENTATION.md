# Browser Module Documentation

## Overview
The Browser module is a sophisticated web automation system built with NestJS and Playwright, providing AI-driven browser control through Claude AI integration. It enables automated web interactions with advanced anti-detection features and video recording capabilities.

## Core Features

### 1. Browser Automation
- Chromium-based automation using Playwright
- Anti-detection mechanisms
- Video recording of automation sessions
- Viewport and user agent customization
- Advanced browser context management

### 2. AI Integration
- Seamless integration with Claude AI
- Natural language instruction processing
- Context-aware automation decisions
- Screenshot-based visual feedback
- Message history management

### 3. Human Interaction Support
- Interactive input collection during automation
- Dynamic UI element creation
- User prompt handling
- Seamless integration with automation flow

## Architecture

### Key Components

1. **BrowserController** (<mcfile name="browser.controller.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/browser/browser.controller.ts"></mcfile>)
   - Handles HTTP endpoints
   - Manages browser lifecycle
   - Processes interaction requests

2. **BrowserService** (<mcfile name="browser.service.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/browser/browser.service.ts"></mcfile>)
   - Core automation service
   - Manages browser sessions
   - Handles AI communication
   - Executes automation actions

3. **HumanToolPlaywrightService** (<mcfile name="human-tool.service.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/browser/human-tool.service.ts"></mcfile>)
   - Manages human interaction
   - Handles user input collection
   - Creates dynamic UI elements

## Implementation Details

### Browser Configuration
```typescript
const browserConfig = {
  headless: false,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ]
};