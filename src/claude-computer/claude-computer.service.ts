import * as dotenv from 'dotenv';
dotenv.config();

import * as shellEscape from 'shell-escape';

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources';
import { sleep } from '@anthropic-ai/sdk/core';
import { keys, modifierKeys } from './mac-utils';
import { join } from 'path';

// Define return type interfaces
interface SuccessResult {
  success: boolean;
  screenshot_path?: string;
}

interface ScreenshotResult {
  screenshot_path?: string;
}

interface CursorPositionResult {
  x: number;
  y: number;
  screenshot_path?: string;
}

// Union type for all possible return types
type ActionResult = SuccessResult | ScreenshotResult | CursorPositionResult;


const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/* const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are utilising an Ubuntu virtual machine using {platform.machine()} architecture with internet access.
* You can feel free to install Ubuntu applications with your bash tool. Use curl instead of wget.
* To open firefox, please just click on the firefox icon.  Note, firefox-esr is what is installed on your system.
* Using bash tool you can start GUI applications, use a subshell. For example "(xterm &)". GUI apps run with bash tool will appear within your desktop environment, but they may take some time to appear. Take a screenshot to confirm it did.
* When using your bash tool with commands that are expected to output very large quantities of text, redirect into a tmp file and use str_replace_editor or \`grep -n -B <lines before> -A <lines after> <query> <filename>\` to confirm output.
* When viewing a page it can be helpful to zoom out so that you can see everything on the page.  Either that, or make sure you scroll down to see everything before deciding something isn't available.
* When using your computer function calls, they take a while to run and send back to you.  Where possible/feasible, try to chain multiple of these calls all into one function calls request.
* The current date is {datetime.today().strftime('%A, %B %-d, %Y')}.
</SYSTEM_CAPABILITY>

<IMPORTANT>
* When using Firefox, if a startup wizard appears, IGNORE IT.  Do not even click "skip this step".  Instead, click on the address bar where it says "Search or enter address", and enter the appropriate search term or URL there.
* If the item you are looking at is a pdf, if after taking a single screenshot of the pdf it seems that you want to read the entire document instead of trying to continue to read the pdf from your screenshots + navigation, determine the URL, use curl to download the pdf, install and use pdftotext to convert it to a text file, and then read that text file directly with your StrReplaceEditTool.
</IMPORTANT>`; */



const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are utilizing a macOS virtual machine using {platform.machine()} architecture with internet access.
* You can feel free to install macOS applications with your terminal tool using Homebrew. Use curl instead of wget where applicable.
* To open Firefox, press Command (⌘) + Space, type "Firefox," and click on firefox to open. Note, Firefox is the installed version on your system.
* When you return a key press instruction make sure you use the names from this name list ${modifierKeys.join(',')} , ${keys.join(',')} 
* Using your terminal tool, you can start GUI applications by running the \`open\` command. For example, \`open -a Firefox\`. GUI apps run with this method will appear within your desktop environment, but they may take some time to appear. Take a screenshot to confirm it did.
* to close a app, you can use cmd+w
* When using your terminal tool with commands that are expected to output very large quantities of text, redirect into a tmp file and use \`grep -n -B <lines before> -A <lines after> <query> <filename>\` to confirm output.
* When viewing a page it can be helpful to zoom out so that you can see everything on the page. Either that, or make sure you scroll down to see everything before deciding something isn't available.
* When using your computer function calls, they take a while to run and send back to you. Where possible/feasible, try to chain multiple of these calls all into one function calls request.
* The current date is {datetime.today().strftime('%A, %B %-d, %Y')}.
</SYSTEM_CAPABILITY>

<IMPORTANT>
* When using Firefox, if a startup wizard appears, IGNORE IT. Do not even click "skip this step." Instead, click on the address bar where it says "Search or enter address," and enter the appropriate search term or URL there.
* If the item you are looking at is a PDF, and after taking a single screenshot of the PDF it seems that you want to read the entire document, instead of trying to continue to read the PDF from your screenshots + navigation, determine the URL, use curl to download the PDF, install and use \`pdftotext\` to convert it to a text file, and then read that text file directly with your preferred text processing tools.
</IMPORTANT>`;


@Injectable()
export class ClaudeComputerService {
  private displayPrefix: string;

  constructor() {
    const displayNum = process.env.DISPLAY_NUM || '1';
    this.displayPrefix = `DISPLAY=:${displayNum} `;
  }

  private generateUniqueFileName(prefix = 'screenshot', extension = 'png') {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${randomString}.${extension}`;
  }

  /*   private async executeActionLinux(
      action: string,
      text: string,
      coordinates?: number[],
    ) {
      try {
        console.log(`Starting action: ${action}`);
        let c;
        switch (action) {
          case 'mouse_move':
            if (!coordinates || coordinates.length < 2)
              throw new Error('Coordinates required for mouse_move');
            console.log(`Moving mouse to: ${coordinates[0]}, ${coordinates[1]}`);
            execSync(
              `${this.displayPrefix}xdotool mousemove --sync ${coordinates[0]} ${coordinates[1]}`,
            );
            break;
  
          case 'key':
            console.log(`Pressing key: ${text}`);
            execSync(
              `${this.displayPrefix}xdotool key -- ${shellEscape([text])}`,
            );
            break;
  
          case 'type':
            console.log(`Typing text: ${text}`);
            const escapedText = shellEscape([text]);
            execSync(
              `${this.displayPrefix}xdotool type --delay 0 -- ${escapedText}`,
            );
            break;
  
          case 'left_click':
            console.log('Performing left click');
            execSync(`${this.displayPrefix}xdotool click 1`);
            break;
  
          case 'left_click_drag':
            if (!coordinates || coordinates.length < 2)
              throw new Error('Coordinates required for left_click_drag');
            const [endX, endY] = coordinates;
            console.log(`Dragging to ${endX}, ${endY}`);
            execSync(
              `${this.displayPrefix}xdotool mousedown 1 mousemove --sync ${endX} ${endY} mouseup 1`,
            );
            break;
  
          case 'right_click':
            console.log('Performing right click');
            execSync(`${this.displayPrefix}xdotool click 3`);
            break;
  
          case 'middle_click':
            console.log('Performing middle click');
            execSync(`${this.displayPrefix}xdotool click 2`);
            break;
  
          case 'double_click':
            console.log('Performing double click');
            execSync(
              `${this.displayPrefix}xdotool click --repeat 2 --delay 500 1`,
            );
            break;
  
          case 'screenshot':
            console.log('Taking screenshot');
            let screenshotName = this.generateUniqueFileName();
            try {
              execSync(`${this.displayPrefix}scrot -f ${screenshotName} -p`);
            } catch (e) {
              execSync(`${this.displayPrefix}scrot ${screenshotName}`);
            }
            screenshotName = this.generateUniqueFileName(); // Ensure it generates a valid file name
            try {
              // Use screencapture command for macOS
              execSync(`screencapture -x ${screenshotName}`);
            } catch (e) {
              console.error('Failed to take screenshot:', e.message);
              throw e; // Rethrow the error if needed
            }
            await sleep(1000); // Wait for 1 second after screenshot
            return { screenshot_path: screenshotName };
  
          case 'cursor_position':
            const position = execSync(
              `${this.displayPrefix}xdotool getmouselocation --shell`,
            ).toString();
            const match = position.match(/X=(\d+)\s+Y=(\d+)/);
            if (!match) throw new Error('Failed to get cursor position');
            const [x, y] = [parseInt(match[1], 10), parseInt(match[2], 10)];
            return { x, y };
  
          default:
            throw new Error(`Unsupported action: ${action}`);
        }
        console.log(`Action ${action} completed successfully`);
        return { success: true };
      } catch (error) {
        console.error(`Error executing action ${action}:`, error);
        throw error;
      }
    } */
  /* 
    private async executeAction(
      action: string,
      text: string,
      coordinates?: number[],
    ) {
      try {
        console.log(`Starting action: ${action}`);
        let c, one;
        switch (action) {
          case 'mouse_move':
            if (!coordinates || coordinates.length < 2)
              throw new Error('Coordinates required for mouse_move');
            console.log(`Moving mouse to: ${coordinates[0]}, ${coordinates[1]}`);
            c = `cliclick m:${coordinates[0]},${coordinates[1]}`
            console.log(c)
            execSync(c);
            break;
  
          case 'key':
            console.log(`Pressing key: ${text}`);
            const keyMapping = {
              Return: 'enter',
              Tab: 'tab',
              Command: 'cmd',
              Meta: 'cmd',
              Shift: 'shift',
              Control: 'ctrl',
              Alt: 'alt',
              Space: 'space',
            };
  
            // Split the input text by "+" to handle combinations
            const keys = text.split('+').map((key) => keyMapping[key] || key.toLowerCase());
            const kdAllowed = [
              "alt",
              "cmd",
              "ctrl",
              "fn",
              "shift",
            ]
            if (keys.length > 1) {
              // Handle combinations
              const modifierKeys = keys.filter(k => kdAllowed.includes(k.toLowerCase())).slice(0, -1).map((key) => `kd:${key}`).join(' ');
              const mainKey = keys[keys.length - 1];
  
              c = `cliclick ${modifierKeys} kp:${mainKey} ${keys.reverse().filter(k => kdAllowed.includes(k.toLowerCase())).map((key) => `ku:${key}`).join(' ')}`;
            } else {
              // Handle single key
              const keyToPress = keys[0];
              c = `cliclick kd:${keyToPress} wu:${keyToPress}`;
            }
            // const args = this.generateCliclickArgs([{ action, text }]);
  
            // one = text.includes('+') ? "keyCombo" : "keyPress";
            // this.generateCliclickCommand(one, args)
            const c1 = `cliclick kd:cmd kp:space ku:cmd`
            if (text.toLowerCase() == "command+space" || text.toLowerCase() == "super+space")
              c = c1
            if (text.toLowerCase() == 'return')
              c = 'cliclick kp:enter'
            console.log(c)
            execSync(c);
            break;
  
  
          case 'type':
            console.log(`Typing text: ${text}`);
            const escapedText = shellEscape([text]);
            c = `cliclick t:${escapedText}`
            console.log(c)
            execSync(c);
            break;
  
          case 'left_click':
            console.log('Performing left click');
            c = `cliclick c:.`
            console.log(c)
            execSync(c);
            break;
  
          case 'left_click_drag':
            if (!coordinates || coordinates.length < 2)
              throw new Error('Coordinates required for left_click_drag');
            const [endX, endY] = coordinates;
            console.log(`Dragging to ${endX}, ${endY}`);
            c = `cliclick dd:. m:${endX},${endY} du:.`
            console.log(c)
            execSync(c);
            break;
  
          case 'right_click':
            console.log('Performing right click');
            c = `cliclick rc:.`
            console.log(c)
            execSync(c);
            break;
  
          case 'middle_click':
            console.log('Performing middle click');
            c = `cliclick mc:.`
            console.log(c)
            execSync(c);
            break;
  
          case 'double_click':
            console.log('Performing double click');
            c = `cliclick dc:.`
            console.log(c)
            execSync(c);
            break;
  
          case 'screenshot':
            console.log('Taking screenshot');
            const screenshotName = this.generateUniqueFileName(); // Ensure it generates a valid file name
            try {
              // Use screencapture command for macOS
              c = `screencapture -x ${screenshotName}`
              execSync(c);
            } catch (e) {
              console.error('Failed to take screenshot:', e.message);
              throw e; // Rethrow the error if needed
            }
            await sleep(1000); // Wait for 1 second after screenshot
            return { screenshot_path: screenshotName };
  
          case 'cursor_position':
            const position = execSync(`cliclick p`).toString().trim();
            const match = position.match(/^x:(\d+)\s+y:(\d+)$/);
            if (!match) throw new Error('Failed to get cursor position');
            const [x, y] = [parseInt(match[1], 10), parseInt(match[2], 10)];
            return { x, y };
  
          default:
            throw new Error(`Unsupported action: ${action}`);
        }
        console.log(`Action ${action} completed successfully`);
        return { success: true };
      } catch (error) {
        console.error(`Error executing action ${action}:`, error);
        throw error;
      }
    } */

  private async executeActionMac(
    action: string,
    text: string,
    coordinates?: number[],
  ): Promise<ActionResult> {
    try {
      console.log(`Starting action: ${action}`);

      // Helper function to execute cliclick commands
      const runCliclick = (cmd: string) => {
        console.log(`Running command: ${cmd}`);
        execSync(`cliclick ${cmd}`)
      };

      switch (action) {
        case 'mouse_move':
          if (!coordinates || coordinates.length < 2)
            throw new Error('Coordinates required for mouse_move');
          console.log(`Moving mouse to: ${coordinates[0]}, ${coordinates[1]}`);
          runCliclick(`m:${coordinates[0]},${coordinates[1]}`);
          break;

        case 'key':
          console.log(`Pressing key: ${text}`);
          // Convert common key names to cliclick format
          const keyMap: { [key: string]: string } = {
            'return': 'kp:enter kp:return',
            'tab': 'kp:tab',
            'space': 'kp:space',
            'left': 'kp:arrow-left',
            'right': 'kp:arrow-right',
            'up': 'kp:arrow-up',
            'down': 'kp:arrow-down',
            'escape': 'kp:esc',
            'delete': 'kp:delete',
            'backspace': 'kp:backspace',
            'home': 'kp:home',
            'end': 'kp:end',
            'page_up': 'kp:page-up',
            'page_down': 'kp:page-down',
            'cmd+space': "kd:cmd kp:space ku:cmd",
            'cmd+w': 'kd:cmd t:w'
          };

          // cliclick kd:cmd kp:space ku:cmd
          if (text.toLowerCase() in keyMap) {
            runCliclick(keyMap[text.toLowerCase()]);
          } else {
            // For regular characters, use the type command
            runCliclick(`t:${text}`);
          }
          break;

        case 'type':
          console.log(`Typing text: ${text}`);
          // Split into characters and type them individually to ensure reliability
          // const chars = text.split('');
          // for (const char of chars) {
          //   if (char == ' ') {
          //     runCliclick(`t:num-plus`);
          //   } else {
          runCliclick(`t:"${text}"`);
          //   }

          //   await sleep(10); // Small delay between characters
          // }
          break;

        case 'left_click':
          console.log('Performing left click');
          runCliclick('c:.');
          break;

        case 'left_click_drag':
          if (!coordinates || coordinates.length < 2)
            throw new Error('Coordinates required for left_click_drag');
          const [endX, endY] = coordinates;
          console.log(`Dragging to ${endX}, ${endY}`);
          // Get current position first
          const currentPos = await this.getCurrentPosition();
          runCliclick(`dd:${currentPos.x},${currentPos.y},${endX},${endY}`);
          break;

        case 'right_click':
          console.log('Performing right click');
          runCliclick('rc:.');
          break;

        case 'middle_click':
          console.log('Performing middle click');
          // Note: cliclick doesn't directly support middle click
          // You might need to use alternative methods or third-party tools
          console.warn('Middle click not directly supported in cliclick');
          break;

        case 'double_click':
          console.log('Performing double click');
          runCliclick('dc:.');
          break;

        case 'screenshot':
          let c;
          console.log('Taking screenshot');
          const screenshotName = this.generateUniqueFileName(); // Ensure it generates a valid file name
          try {
            // Use screencapture command for macOS
            c = `screencapture -x ${screenshotName}`
            execSync(c);
          } catch (e) {
            console.error('Failed to take screenshot:', e.message);
            throw e; // Rethrow the error if needed
          }
          await sleep(1000); // Wait for 1 second after screenshot
          return { screenshot_path: screenshotName };

        case 'cursor_position':
          return this.getCurrentPosition();

        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      console.log(`Action ${action} completed successfully`);
      return { success: true };
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
      throw error;
    }
  }

  // Helper method to get current cursor position
  private async getCurrentPosition(): Promise<{ x: number, y: number }> {
    try {
      const output = execSync('cliclick p').toString();
      const match = output.match(/(\d+),(\d+)/);
      if (!match) throw new Error('Failed to get cursor position');
      return {
        x: parseInt(match[1], 10),
        y: parseInt(match[2], 10)
      };
    } catch (error) {
      console.error('Error getting cursor position:', error);
      throw error;
    }
  }



  async interactWithClaude(userPrompt: string) {
    console.log('Starting interaction with Claude');
    let messages: MessageParam[] = [
      {
        content: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
          },
          {
            type: 'text',
            text:
              'Use computer tool for mouse movements, clicks, keyboard typing and screenshots. \n' +
              userPrompt,
          },
        ],
        role: 'user',
      },
    ];

    let response: Anthropic.Beta.Messages.BetaMessage & {
      _request_id?: string | null;
    };

    do {
      await sleep(1000);
      response = await anthropic.beta.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        tools: [
          {
            type: 'computer_20241022',
            name: 'computer',
            display_width_px: parseInt(process.env.WIDTH || '0', 10),
            display_height_px: parseInt(process.env.HEIGHT || '0', 10),
            display_number: 1,
          },
          {
            type: 'text_editor_20241022',
            name: 'str_replace_editor',
          },
          {
            type: 'bash_20241022',
            name: 'bash',
          },
        ],
        messages: messages,
        betas: ['computer-use-2024-10-22'],
      });

      if (response.stop_reason === 'tool_use') {
        console.log('Claude requested a tool use');
        const tools = response.content.filter(
          (content) => content.type === 'tool_use',
        );

        const text = response.content.filter((x) => {
          return x.type === 'text';
        });

        console.log('Claude says: ' + text[0]?.text);
        console.log('Tools requested: ' + JSON.stringify(tools, null, 2));

        for (const tool of tools) {
          messages.push({
            role: 'assistant',
            content: [
              {
                id: tool.id,
                input: tool.input,
                name: tool.name,
                type: tool.type,
              },
            ],
          });

          // Execute action
          const result: ActionResult = await this.executeActionMac(
            // @ts-expect-error
            tool.input.action,

            // @ts-expect-error
            tool.input.text,

            // @ts-expect-error
            tool.input.coordinate,
          );

          // Add tool result message
          if (result.screenshot_path) {
            console.log('Sending screenshot result back to Claude');
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: tool.id,
                  content: [
                    {
                      type: 'image',
                      source: {
                        media_type: 'image/png',
                        data: fs
                          .readFileSync(result.screenshot_path)
                          .toString('base64'),
                        type: 'base64',
                      },
                    },
                  ],
                },
              ],
            });
          } else {
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: tool.id,
                  content: [
                    {
                      type: 'text',
                      text: 'Success',
                    },
                  ],
                },
              ],
            });
          }
        }
      } else if (
        response.stop_reason === 'stop_sequence' ||
        response.stop_reason === 'end_turn'
      ) {
        console.log('Claude interaction completed');
        break;
      }
    } while (response.stop_reason === 'tool_use');

    return response;
  }
}
