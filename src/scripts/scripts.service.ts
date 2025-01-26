import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
    Region, 
    screen,
    mouse,
    keyboard,
    singleWord,
    sleep,
    useConsoleLogger,
    ConsoleLogLevel,
    straightTo,
    centerOf,
    Button,
    getActiveWindow, 
    Point
} from '@nut-tree-fork/nut-js'; // Ensure this import is correct


const execAsync = promisify(exec);

@Injectable()
export class ScriptsService {
    async runScriptOne() {
        try {
            // Open Google Chrome (macOS-specific command)
            // await execAsync('open -a "Google Chrome"');
            await new Promise(resolve => setTimeout(resolve, 2000));

            await screen.highlight(new Region(100, 100, 200, 200)); 
            const shot = await screen.capture('screenshot.png'); 

            // print the path to screenshot.png
            console.log(shot);
            await mouse.move([new Point(100, 100), new Point(300, 300), new Point(400, 400)]);
            await mouse.click(Button.LEFT);
            await mouse.doubleClick(Button.LEFT);

            await mouse.scrollDown(100);

            keyboard.config.autoDelayMs = 1;
            await keyboard.type("Hello, World! 👋");
            

        } catch (error) {
            console.error('Error running script:', error);
            throw error; // Re-throw the error to handle it elsewhere if needed
        }
    }
}