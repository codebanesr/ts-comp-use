export const clickHelper = {
  generateCliclickArgs(actions) {
    const keyMapping = {
      Return: 'return',
      Space: 'space',
      Command: 'cmd',
      Meta: 'cmd',
      Shift: 'shift',
      Control: 'ctrl',
      Alt: 'alt',
    };

    return actions.map((actionObj) => {
      const { action, text } = actionObj;

      if (action === 'key') {
        const keys = text
          .split('+')
          .map((key) => keyMapping[key] || key.toLowerCase());
        if (keys.length > 1) {
          return {
            action: 'keyCombo',
            args: {
              modifiers: keys.slice(0, -1),
              mainKey: keys[keys.length - 1],
            },
          };
        } else {
          return {
            action: 'keyPress',
            args: {
              key: keys[0],
            },
          };
        }
      } else if (action === 'type') {
        return {
          action: 'typeText',
          args: {
            text: text,
          },
        };
      } else {
        throw new Error(`Unsupported action: ${action}`);
      }
    });
  },
  generateCliclickCommand(action, args) {
    switch (action) {
      case 'keyPress':
        // Simulates pressing a single key
        return `cliclick kp:${args.key}`;

      case 'keyCombo':
        // Simulates pressing and releasing key combinations (e.g., Command+Space)
        const modifierKeys = args.modifiers.map((key) => `kd:${key}`).join(' ');
        const mainKey = `kp:${args.mainKey}`;
        const releaseModifiers = args.modifiers
          .reverse()
          .map((key) => `ku:${key}`)
          .join(' ');
        return `cliclick ${modifierKeys} ${mainKey} ${releaseModifiers}`;

      case 'click':
        // Simulates a mouse click at specific coordinates
        return `cliclick c:${args.x},${args.y}`;

      case 'doubleClick':
        // Simulates a double-click at specific coordinates
        return `cliclick dc:${args.x},${args.y}`;

      case 'rightClick':
        // Simulates a right-click at specific coordinates
        return `cliclick rc:${args.x},${args.y}`;

      case 'tripleClick':
        // Simulates a triple-click at specific coordinates
        return `cliclick tc:${args.x},${args.y}`;

      case 'mouseMove':
        // Moves the mouse to a specific location
        return `cliclick m:${args.x},${args.y}`;

      case 'dragStart':
        // Starts dragging at specific coordinates
        return `cliclick dd:${args.x},${args.y}`;

      case 'dragMove':
        // Continues dragging to specific coordinates
        return `cliclick dm:${args.x},${args.y}`;

      case 'dragEnd':
        // Ends dragging at specific coordinates
        return `cliclick du:${args.x},${args.y}`;

      case 'wait':
        // Pauses for a specific number of milliseconds
        return `cliclick w:${args.ms}`;

      case 'printMousePosition':
        // Prints the current mouse position
        return `cliclick p`;

      case 'printColor':
        // Prints the color at specific screen coordinates
        return `cliclick cp:${args.x},${args.y}`;

      case 'typeText':
        // Types the provided text
        return `cliclick t:'${args.text}'`;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  },
};
