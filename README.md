# Computer & Browser Use Agent Implementations

NodeComp is a sophisticated system that combines multiple modules to enable AI-driven computer interaction, web automation, and virtual display management. The system provides a comprehensive solution for automated computer control and web interaction through various specialized modules.

## Core Modules

### 1. [Computer Use Module](computer_use/DOCUMENTATION.md)
Virtual display environment enabling browser-based access to X11 sessions. Features:
- Virtual display server (Xvfb) for headless operation
- Window management with Mutter
- Panel system using Tint2
- Remote access via X11VNC and noVNC

### 2. [Browser Module](src/browser/DOCUMENTATION.md)
Advanced web automation system with AI integration. Features:
- Chromium-based automation using Playwright
- Claude AI integration for intelligent decision making
- Anti-detection mechanisms
- Video recording capabilities
- Interactive human input collection

### 3. [Claude Computer Module](src/claude-computer/DOCUMENTATION.md)
Cross-platform system control interface for AI. Features:
- Platform-specific system interaction (Linux/macOS)
- Mouse and keyboard control
- Screenshot capabilities
- Window management
- Real-time AI-driven system interaction

### 4. [Copycat Module](src/copycat/DOCUMENTATION.md)
Intelligent web automation with visual recognition. Features:
- Visual element recognition and marking
- AI-powered automation decisions
- Complex browser interaction capabilities
- Comprehensive element mapping
- Robust error handling

## System Architecture

The system integrates these modules to provide:
- Seamless AI-driven computer control
- Web automation capabilities
- Virtual display management
- Cross-platform compatibility
- Real-time interaction processing

## Getting Started
This project is built with [NestJS](https://nestjs.com/), a progressive Node.js framework for building efficient and scalable server-side applications.

## License
See [LICENSE](LICENSE) for details.





