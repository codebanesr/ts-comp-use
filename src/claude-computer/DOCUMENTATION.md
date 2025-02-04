# Claude Computer Module Documentation

## Overview
The Claude Computer module is a sophisticated system that enables Claude AI to interact with computer systems through a NestJS-based API. It provides cross-platform support for both Linux and macOS, allowing automated control of mouse movements, keyboard inputs, and system interactions.

## Core Features

### 1. Cross-Platform Support
- **Linux Support**: Uses xdotool for system interaction
- **macOS Support**: Implements cliclick for system control
- Platform-specific command handling and optimization
- Unified API interface across platforms

### 2. System Interaction Capabilities
- Mouse control (movement, clicks, dragging)
- Keyboard input (typing, key combinations)
- Screenshot capture
- Cursor position tracking
- Window management

### 3. AI Integration
- Direct integration with Anthropic's Claude AI
- Real-time system interaction based on AI decisions
- Support for complex multi-step operations
- Visual feedback through screenshots

## Architecture

### Key Components

1. **ClaudeComputerController** (<mcfile name="claude-computer.controller.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/claude-computer/claude-computer.controller.ts"></mcfile>)
   - Handles HTTP endpoints
   - Manages AI interaction requests
   - Provides system status information

2. **ClaudeComputerService** (<mcfile name="claude-computer.service.ts" path="/Users/shanurrahman/Documents/spc/nodecomp/src/claude-computer/claude-computer.service.ts"></mcfile>)
   - Core service managing system interactions
   - Implements platform-specific actions
   - Handles AI communication

### Supported Actions

1. **Mouse Operations**
   - Move cursor
   - Left/right/middle click
   - Double click
   - Click and drag

2. **Keyboard Operations**
   - Single key press
   - Key combinations
   - Text input
   - Special key handling

3. **System Operations**
   - Screenshot capture
   - Window management
   - System commands execution

## API Endpoints

1. **Interact with Claude** (`POST /claude-computer/interact`)
   - Accepts natural language instructions
   - Returns AI-driven interaction results

2. **System Status** (`GET /claude-computer`)
   - Provides system availability status
   - Monitors service health

## Implementation Details

### Platform Detection
```typescript
const isMac = process.env.PLATFORM == 'MAC';