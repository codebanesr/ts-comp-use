http://localhost:6080/vnc.html?&resize=scale&autoconnect=1&view_only=1&reconnect=1&reconnect_delay=2000


Install chromium:
npx playwright install chromium


---

# Add a human layer tool, this should popup a message window for user to resume execution of the code. Use playwright alert for
getting user input.

```js
if (tool.name === 'human') {
  // call playwright with a popup that has a button that user can click to continue
  const [popup] = await Promise.all([
    this.page.waitForEvent('popup'), // Wait for the popup event
    this.page.click('button#trigger-popup')  // Trigger the popup by clicking a button (adjust selector)
  ]);
}
```
