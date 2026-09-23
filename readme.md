
# zoom-multi-core-api

> Event-driven, lightweight multi-session automation engine for the Zoom Web Client built with Playwright.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-xnodesdevelopers%2Fzoom--multi--core--api-blue?logo=github)](https://github.com/xnodesdevelopers/zoom-multi-core-api/tree/main)

`zoom-multi-core-api` provides a socket-like abstraction for spawning, managing, and automating multiple Zoom Web Client sessions concurrently. To maintain low memory and CPU overhead during multi-session execution, the engine intercepts network traffic to block redundant static assets like images, fonts, media streams, and stylesheets.

---

## Developer

**Tharindu Liyanage (Ｓａｎｋｕ）**  
Undergraduate – Department of Computing, Rajarata University of Sri Lanka (RUSL)  
GitHub: [@xnodesdevelopers](https://github.com/xnodesdevelopers)  
Repository: [xnodesdevelopers/zoom-multi-core-api](https://github.com/xnodesdevelopers/zoom-multi-core-api/tree/main)

---

## Features

- **Concurrent Multi-Session Orchestration:** Join multiple participants to a target meeting simultaneously in isolated browser contexts.
- **Resource Interception:** Aborts requests for images, fonts, media, and stylesheets to keep memory footprint minimal.
- **Automated Flow Handling:** Auto-dismisses cookie banners, bypasses camera/mic permissions, and auto-submits names and passcodes.
- **Event-Driven Architecture:** Track runtime session events such as `connection.update` and `messages.upsert` using an internal event emitter (`ev`).
- **Flexible Chat Automation:** Dispatch chat messages as a global broadcast across all bots or target a specific active session.
- **Cross-Platform Compatibility:** Supports bundled Playwright Chromium or custom system binaries via environment variables.

---

## Installation

Ensure you have Node.js (v18 or higher) installed.

```bash
git clone https://github.com/xnodesdevelopers/zoom-multi-core-api.git
cd zoom-multi-core-api
npm install
```

If you use a distribution-provided Chromium package (e.g., Arch Linux `pacman -S chromium`):

```bash
export CHROMIUM_PATH="/usr/bin/chromium"
```

---

## Quick Start

```javascript
const { makeZoomSocket } = require('./zoom-socket');

async function startZoom() {
  const sock = makeZoomSocket({
    headless: false,                    // important
    chromiumPath: '/usr/bin/chromium'
  });

  sock.ev.on('connection.update', (update) => {
    const { id, name, status, error } = update;
    console.log(`[${status.toUpperCase()}] ${name || id}`, error || '');
  });

  sock.ev.on('messages.upsert', (m) => {
    console.log(`[MESSAGE SENT] ${m.name}: "${m.message}"`);
  });

  const results = await sock.join({
    meetingId: '81601161660',
    passcode: 'mXZzK3',
    participants: ['Sanku_Bot_01', 'Sanku_Bot_02']
  });

  console.log('Join results:', results);

  setTimeout(async () => {
    await sock.sendMessage('all', { text: 'Hello from API!' });
  }, 15000);

  setTimeout(async () => {
    console.log('Terminating...');
    await sock.end();
  }, 60000);
}

startZoom().catch(console.error);
```

---

## API Reference

### `makeZoomSocket(config)`

Initializes the socket client and returns the controller instance.

**Parameters**

- `config` (Object, optional):
  - `config.headless` (boolean, default: `true`): Run sessions in headless mode.
  - `config.chromiumPath` (string, optional): Path to a specific Chromium executable. Falls back to `process.env.CHROMIUM_PATH` if not provided.

**Returns**

- `Object`: Socket controller instance.

### `sock.ev`

An EventEmitter instance providing real-time lifecycle hooks.

**Supported Events**

- `connection.update`: Dispatched on session status change.  
  Payload: `{ id: string, name: string, status: 'connecting' | 'open' | 'close', error?: string, timestamp: number }`

- `messages.upsert`: Dispatched when a message is successfully sent to the meeting chat.  
  Payload: `{ sessionId: string, name: string, message: string, status: 'sent', timestamp: number }`

### `sock.join(payload)`

Joins a list of participants to a meeting simultaneously.

**Parameters**

- `payload` (Object):
  - `payload.meetingId` (string, required): Zoom meeting ID.
  - `payload.participants` (string[], required): Array of display names.
  - `payload.passcode` (string, optional): Zoom meeting passcode.

**Returns**

- `Promise<Array<{ sessionId: string, success: boolean, error?: string }>>`

### `sock.sendMessage(targetSessionId, content)`

Sends a message into the Zoom meeting chat.

**Parameters**

- `targetSessionId` (string): Use `'all'` to broadcast from every active session, or pass a specific `sessionId`.
- `content` (Object):
  - `content.text` (string, required): Message content to type and send.

**Returns**

- `Promise<Array<{ id: string, success: boolean, error?: string }>>`

### `sock.getParticipants()`

Returns a list of currently active sessions tracked in memory.

**Returns**

- `Array<{ id: string, name: string, status: string }>`

### `sock.end(sessionId)`

Terminates a specific session or cleans up the entire instance.

**Parameters**

- `sessionId` (string, optional): Unique identifier of the session to terminate. If omitted, all open contexts and the browser instance will be closed.

**Returns**

- `Promise<void>`

---

## Disclaimer

This project is intended strictly for automated testing, infrastructure load assessment, and educational research. Automating client sessions without the explicit knowledge and permission of the meeting host may violate third-party Terms of Service.

---

## License

Distributed under the MIT License. Copyright (c) 2026 Tharindu Liyanage (Ｓａｎｋｕ）.
```

**Arch terminal එකෙන් file හදන්න (README.md):**

```bash
cat << 'EOF' > README.md
# zoom-multi-core-api

> Event-driven, lightweight multi-session automation engine for the Zoom Web Client built with Playwright.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-xnodesdevelopers%2Fzoom--multi--core--api-blue?logo=github)](https://github.com/xnodesdevelopers/zoom-multi-core-api/tree/main)

`zoom-multi-core-api` provides a socket-like abstraction for spawning, managing, and automating multiple Zoom Web Client sessions concurrently. To maintain low memory and CPU overhead during multi-session execution, the engine intercepts network traffic to block redundant static assets like images, fonts, media streams, and stylesheets.

---

## Developer

**Tharindu Liyanage (Ｓａｎｋｕ）**  
Undergraduate – Department of Computing, Rajarata University of Sri Lanka (RUSL)  
GitHub: [@xnodesdevelopers](https://github.com/xnodesdevelopers)  
Repository: [xnodesdevelopers/zoom-multi-core-api](https://github.com/xnodesdevelopers/zoom-multi-core-api/tree/main)

---

## Features

- **Concurrent Multi-Session Orchestration:** Join multiple participants to a target meeting simultaneously in isolated browser contexts.
- **Resource Interception:** Aborts requests for images, fonts, media, and stylesheets to keep memory footprint minimal.
- **Automated Flow Handling:** Auto-dismisses cookie banners, bypasses camera/mic permissions, and auto-submits names and passcodes.
- **Event-Driven Architecture:** Track runtime session events such as `connection.update` and `messages.upsert` using an internal event emitter (`ev`).
- **Flexible Chat Automation:** Dispatch chat messages as a global broadcast across all bots or target a specific active session.
- **Cross-Platform Compatibility:** Supports bundled Playwright Chromium or custom system binaries via environment variables.

---

## Installation

Ensure you have Node.js (v18 or higher) installed.

```bash
git clone https://github.com/xnodesdevelopers/zoom-multi-core-api.git
cd zoom-multi-core-api
npm install
```

If you use a distribution-provided Chromium package (e.g., Arch Linux `pacman -S chromium`):

```bash
export CHROMIUM_PATH="/usr/bin/chromium"
```

---

## Quick Start

```javascript
const { makeZoomSocket } = require('./zoom-socket');

async function run() {
  const sock = makeZoomSocket({
    headless: true,
    // chromiumPath: '/usr/bin/chromium' // Optional custom binary path
  });

  // Listen to connection lifecycle changes
  sock.ev.on('connection.update', (update) => {
    const { id, name, status, error } = update;
    console.log(`[STATUS: ${status.toUpperCase()}] ${name} (${id})`);
    if (error) {
      console.error(`Error details: ${error}`);
    }
  });

  // Listen to outgoing message confirmations
  sock.ev.on('messages.upsert', (data) => {
    console.log(`[MESSAGE SENT] ${data.name}: ${data.message}`);
  });

  // Connect multiple participants
  await sock.join({
    meetingId: '1234567890',
    passcode: 'pass123',
    participants: ['Client_Bot_01', 'Client_Bot_02']
  });

  // Broadcast message to meeting chat
  setTimeout(async () => {
    await sock.sendMessage('all', { text: 'Automated session active.' });
  }, 10000);

  // Gracefully terminate after execution
  setTimeout(async () => {
    console.log('Closing sessions...');
    await sock.end();
  }, 60000);
}

run();
```

---

## API Reference

### `makeZoomSocket(config)`

Initializes the socket client and returns the controller instance.

**Parameters**

- `config` (Object, optional):
  - `config.headless` (boolean, default: `true`): Run sessions in headless mode.
  - `config.chromiumPath` (string, optional): Path to a specific Chromium executable. Falls back to `process.env.CHROMIUM_PATH` if not provided.

**Returns**

- `Object`: Socket controller instance.

### `sock.ev`

An EventEmitter instance providing real-time lifecycle hooks.

**Supported Events**

- `connection.update`: Dispatched on session status change.  
  Payload: `{ id: string, name: string, status: 'connecting' | 'open' | 'close', error?: string, timestamp: number }`

- `messages.upsert`: Dispatched when a message is successfully sent to the meeting chat.  
  Payload: `{ sessionId: string, name: string, message: string, status: 'sent', timestamp: number }`

### `sock.join(payload)`

Joins a list of participants to a meeting simultaneously.

**Parameters**

- `payload` (Object):
  - `payload.meetingId` (string, required): Zoom meeting ID.
  - `payload.participants` (string[], required): Array of display names.
  - `payload.passcode` (string, optional): Zoom meeting passcode.

**Returns**

- `Promise<Array<{ sessionId: string, success: boolean, error?: string }>>`

### `sock.sendMessage(targetSessionId, content)`

Sends a message into the Zoom meeting chat.

**Parameters**

- `targetSessionId` (string): Use `'all'` to broadcast from every active session, or pass a specific `sessionId`.
- `content` (Object):
  - `content.text` (string, required): Message content to type and send.

**Returns**

- `Promise<Array<{ id: string, success: boolean, error?: string }>>`

### `sock.getParticipants()`

Returns a list of currently active sessions tracked in memory.

**Returns**

- `Array<{ id: string, name: string, status: string }>`

### `sock.end(sessionId)`

Terminates a specific session or cleans up the entire instance.

**Parameters**

- `sessionId` (string, optional): Unique identifier of the session to terminate. If omitted, all open contexts and the browser instance will be closed.

**Returns**

- `Promise<void>`

---

## Disclaimer

This project is intended strictly for automated testing, infrastructure load assessment, and educational research. Automating client sessions without the explicit knowledge and permission of the meeting host may violate third-party Terms of Service.

---

## License

Distributed under the MIT License. Copyright (c) 2026 Tharindu Liyanage (Ｓａｎｋｕ）.
