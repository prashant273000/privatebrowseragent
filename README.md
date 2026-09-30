# Private Browser Agent (Frontend Prototype)

This is the first prototype stage of the **Private Browser Agent** Chrome extension. 
It implements a minimal, local-first UI in the Chrome Side Panel.

> **Note:** NLP and backend functionality are intentionally not implemented yet. 
> There are no network requests, backend servers, or actual AI models in this prototype.

## Features

- Clean, modern Manifest V3 side panel UI.
- Example prompt selection.
- Simulated task analysis delay.
- Placeholder result cards for future NLP processing.
- Debug section for raw input viewing.
- Keyboard shortcuts (`Ctrl/Cmd + Enter` to analyze, `Esc` to clear).

## Installation & Build

No build step is required. This extension is built with pure HTML, CSS, and JavaScript to keep it completely lightweight. (Vite and package.json have been intentionally omitted).

## How to load the unpacked extension in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** (toggle switch in the top right corner).
4. Click the **Load unpacked** button in the top left.
5. Select the `private-browser-agent` directory on your computer.

## How to open the Side Panel

1. Pin the extension to your toolbar by clicking the puzzle icon (🧩) and then the pin icon next to "Private Browser Agent".
2. Click the extension icon in your toolbar, and the side panel will automatically open.
3. Alternatively, you can open Chrome's side panel button and select "Private Browser Agent" from the dropdown menu.
