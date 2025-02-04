# Copycat Module Documentation

## Overview
The Copycat module is an advanced web automation system built with NestJS and Playwright that enables AI-driven browser automation. It combines visual element recognition, natural language processing, and browser automation to execute user-requested actions on web pages.

## Core Features

### 1. Visual Element Recognition
- Automatically identifies and marks interactive elements on web pages
- Uses color-coded highlighting system for easy element identification
- Maintains an element map with XPath and text content for precise targeting
- Supports various interactive elements including:
  - Standard form elements (buttons, inputs, textareas)
  - Interactive elements (links, buttons, menus)
  - Form controls (checkboxes, radio buttons, dropdowns)
  - Custom elements with click handlers

### 2. AI-Powered Automation
- Integrates with OpenAI/Together.ai for natural language understanding
- Converts user instructions into executable browser actions
- Supports iterative automation with continuous feedback
- Handles complex multi-step operations

### 3. Browser Automation Capabilities
- Click operations (single click, double click, right click)
- Text input and form filling
- Keyboard actions and shortcuts
- Scrolling and navigation
- Element hovering and drag-and-drop operations

## Architecture

### Key Components

1. **CopycatController** (<mcfile name="copycat.controller.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/copycat/copycat.controller.ts"></mcfile>)
   - Handles HTTP endpoints for analysis and automation
   - Manages request/response flow

2. **CopyCatService** (<mcfile name="copycat.service.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/copycat/copycat.service.ts"></mcfile>)
   - Core service managing browser automation
   - Handles element identification and marking
   - Manages AI communication and response processing

3. **BrowserAutomationService**
   - Executes specific browser actions
   - Handles element interaction and navigation

## API Endpoints

1. **Analyze Website** (`POST /copycat/analyze`)
   - Initializes browser session
   - Identifies and marks interactive elements
   - Returns analysis results

2. **Run Automation** (`POST /copycat/run`)
   - Accepts natural language instructions
   - Executes automated actions
   - Provides continuous feedback

## Key Learnings

### 1. Browser Automation Challenges
- Browser detection evasion requires careful configuration
- Element identification needs robust fallback mechanisms
- Timing and state management are critical for reliable automation

### 2. AI Integration Insights
- Natural language processing requires structured prompts
- Visual context improves automation accuracy
- Iterative feedback loops enhance reliability

### 3. Technical Considerations
- Screenshot management affects performance
- Element mapping requires efficient data structures
- Error handling needs comprehensive coverage

### 4. Best Practices
- Use color coding for visual element identification
- Implement robust error recovery mechanisms
- Maintain state across automation steps
- Handle browser lifecycle carefully

## Implementation Notes

### Browser Configuration
```typescript
// Anti-detection measures
await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
    });
});