<div align="center">

# 🛡️ Private Browser Agent

### Privacy-Preserving Vision Browser Agent for Smart India Hackathon 2024

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Groq](https://img.shields.io/badge/Powered%20by-Groq-orange?style=flat)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

> A Chrome extension that lets an AI agent automate browser tasks while ensuring **all sensitive data stays on your device**. Raw PII is detected and masked locally — only sanitized, anonymized context is ever sent to the server.

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure the Server](#3-configure-the-server)
  - [4. Build the Extension](#4-build-the-extension)
  - [5. Load in Chrome](#5-load-in-chrome)
  - [6. Start the Reasoning Server](#6-start-the-reasoning-server)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [How the Privacy Pipeline Works](#how-the-privacy-pipeline-works)
- [Models Used](#models-used)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

Modern AI agents need access to your screen to be useful — but sending raw screenshots and personal data to cloud servers is a fundamental privacy violation.

**Private Browser Agent** solves this by running two AI models **entirely in your browser**:

1. **BERT NER** — detects names, emails, phone numbers, credit cards in your text
2. **YOLOS-tiny** — detects visual objects (faces, laptops, etc.) in your screen

Before anything leaves the browser, all detected PII is replaced with anonymous tokens (e.g. `"Rahul"` → `"<PERSON_1>"`), and all sensitive screen regions are masked with grey/black boxes. Only this sanitized representation is sent to the server for reasoning.

```
Your Screen
    ↓
[BERT + YOLOS run locally]  ← no network call
    ↓
PII replaced, faces masked
    ↓
Sanitized context → Server → Groq AI → Tool Call
    ↓
Tool executes in your browser (click, type, navigate...)
```

---

## Architecture

```
┌─────────────────────── BROWSER (trusted) ────────────────────────┐
│                                                                    │
│  User Prompt → NLP → Task Understanding → Privacy Pipeline        │
│                                                 ↓                  │
│  Raw Screenshot → YOLOS-tiny → Visual Detections                  │
│                                                 ↓                  │
│  BERT NER + Regex Rules → PII detected                            │
│                                                 ↓                  │
│  Token Vault: "Rahul" → <PERSON_1>  [LOCAL ONLY]                 │
│  Canvas Masking: Password fields → ████                           │
│                                                 ↓                  │
│  Privacy Gate (triple-check before any send)                      │
│                                                                    │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ Sanitized context only
                              ▼
┌─────────────────── LOCAL SERVER (port 3000) ────────────────────┐
│                                                                   │
│  Express.js → Groq API → qwen/qwen3.8-27b (multimodal VLM)      │
│  Returns: { name: "browser.click", arguments: { ref: "el_3" } }  │
│                                                                   │
└─────────────────────────────┬─────────────────────────────────────┘
                              │ Tool call
                              ▼
              Browser executes action on current page
```

---

## Features

- 🔒 **Local PII Detection** — BERT model runs in-browser via ONNX Runtime Web
- 👁️ **Local Vision** — YOLOS-tiny detects objects in screenshots without any cloud call
- 🎭 **Visual Masking** — Canvas API blacks out passwords, masks faces and PII regions
- 🔑 **Token Vault** — Session-scoped map of `<PLACEHOLDER>` → raw value, never leaves browser
- ✅ **Triple Privacy Gate** — String scan + BERT + Regex on every outbound payload
- 🤖 **Multimodal Reasoning** — Groq's `qwen/qwen3.8-27b` reasons over sanitized screenshot + DOM
- 🌐 **Works on Any Website** — Not hardcoded to any domain or page structure
- 📊 **Live Evidence Panel** — Developer view shows exactly what is and isn't sent to the server
- 🛠️ **Full Tool Loop** — observe, click, type, navigate, scroll, select, wait, finish

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Requirement | Version | Check |
|-------------|---------|-------|
| **Node.js** | ≥ 18.0.0 | `node --version` |
| **npm** | ≥ 9.0.0 | `npm --version` |
| **Google Chrome** | Latest stable | — |
| **Groq API Key** | Free at [console.groq.com](https://console.groq.com) | — |

> **Note:** Firefox is not supported — the extension uses Chrome-specific APIs (`chrome.tabs.captureVisibleTab`, `chrome.scripting`, Manifest V3 service workers).

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/prashant273000/privatebrowseragent.git
cd privatebrowseragent
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including:
- `@huggingface/transformers` — BERT NER model runtime (ONNX)
- `@xenova/transformers` — YOLOS-tiny vision model runtime
- `wink-nlp` — local NLP for prompt parsing
- `groq-sdk` — Groq API client
- `express` — local reasoning server
- `vite` — bundler for the Chrome extension

> **About model files:** The large ONNX model weights (`*.onnx`, `*.wasm`) are **not stored in this repo** — they are automatically downloaded by `transformers.js` from HuggingFace CDN on first use and cached in your browser's IndexedDB. No manual download required.

### 3. Configure the Server

Create the server environment file:

```bash
cp server/.env.example server/.env
```

Open `server/.env` and add your Groq API key:

```env
GROQ_API_KEY=gsk_your_actual_key_here
REASONING_PROVIDER=groq
GROQ_MODEL=qwen/qwen3.8-27b
```

**Getting a Groq API Key:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to **API Keys** → **Create API Key**
4. Copy the key and paste it into `server/.env`

> ⚠️ **Never commit `server/.env`** — it is listed in `.gitignore` and will never be pushed to git.

### 4. Build the Extension

```bash
npm run build
```

This runs two Vite builds:
1. Builds the **sidepanel** (UI + all local ML models bundled)
2. Builds the **content script** (injected into active tabs)

Output goes to the `dist/` directory. Build time: ~15-30 seconds.

You should see:

```
✓ built in 1.51s    ← sidepanel bundle
✓ built in 20ms     ← content.js
```

### 5. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside the project directory
5. The extension "Private Browser Agent" will appear in your extensions list

**Pin the extension:**
- Click the puzzle icon 🧩 in the Chrome toolbar
- Click the pin 📌 next to "Private Browser Agent"
- The shield icon will appear in your toolbar

### 6. Start the Reasoning Server

In a separate terminal, start the local Express server:

```bash
cd /path/to/privatebrowseragent
npx tsx server/src/index.ts
```

You should see:

```
◇ injected env (3) from server/.env
[Server] REASONING_PROVIDER=groq
[Reasoning] Provider: GROQ
[Reasoning] Model: qwen/qwen3.8-27b
[Reasoning] API key present: true
Server listening on port 3000
```

> The extension communicates with this server at `http://localhost:3000`. Keep this terminal running while using the extension.

---

## Usage

### Running a Task

1. Navigate to any webpage (e.g., Google, YouTube, or `http://localhost:3000/sih_demo.html`)
2. Click the **Private Browser Agent** icon in the Chrome toolbar
3. The side panel opens on the right
4. Type a natural language task, for example:
   - `"Search Google for laptops under 50000"`
   - `"Select the laptop with the highest RAM"`
   - `"Send email to Rahul at rahul@example.com about the project meeting"`
5. Click **Run Task** or press `Ctrl+Enter`

### Understanding the UI

The sidepanel has two sections:

**Status Pipeline** (top) — shows each step's progress in real-time:
```
✅ Step 1: NLP Parsing
✅ Step 2: Task Understanding  
✅ Step 3: Privacy Sanitization
✅ Screenshot Captured (Local)
✅ Vision Inference (YOLOS-tiny)
✅ Redaction Applied
✅ Privacy Gate (NO PII leaked)
🔄 Groq Reasoning...
✅ Tool Executed
```

**Developer Evidence Panel** (bottom, collapsible) — shows:
- `LOCAL PRIVACY JSON` — raw token vault mapping *(never transmitted)*
- `SANITIZED NETWORK CONTEXT` — exactly what the server receives
- `PRIVACY GATE STATUS` — confirmation: Token Vault Sent: NO / Raw PII Sent: NO
- `VISUAL REDACTION JSON` — per-region masking coordinates
- `Original vs Sanitized` screenshot preview

### Demo Page

A controlled demo page is included for SIH presentations:

```bash
# The server also serves sih_demo.html
# With the server running, open:
http://localhost:3000/sih_demo.html
```

Try: `"Select the laptop with the highest RAM"` — the agent will read the product listings and click the correct one.

---

## Project Structure

```
privatebrowseragent/
│
├── 📄 README.md                    # This file
├── 📄 SIH_ARCHITECTURE.md          # Full system architecture documentation
├── 📄 setup.sh                     # Quick setup helper script
├── 📄 package.json                 # npm scripts and dependencies
├── 📄 vite.config.js               # Vite build config (sidepanel)
├── 📄 vite.content.config.js       # Vite build config (content script)
├── 📄 .gitignore                   # Excludes .env, dist, *.onnx, *.wasm
│
├── 📁 extension/                   # Extension source files
│   ├── 📄 sidepanel.html           # Main UI markup
│   ├── 📄 sidepanel.js             # UI logic, privacy evidence rendering
│   ├── 📄 sidepanel.css            # Styling
│   ├── 📄 background.js            # Service worker (opens side panel)
│   ├── 📄 content.ts               # Content script (DOM + tool execution)
│   └── 📁 public/
│       ├── 📄 manifest.json        # Chrome extension manifest v3
│       ├── 📁 icons/               # Extension icons (16/32/48/128px)
│       └── 📁 models/              # Local AI model config files
│           ├── Xenova/mobilebert-uncased-mnli/     # Intent classifier configs
│           └── onnx-community/bert-small-pii-*/    # PII model configs
│
├── 📁 src/                         # TypeScript source
│   ├── 📁 local-agent/
│   │   ├── 📄 agentController.ts   # ⭐ Main orchestrator — runs the full pipeline
│   │   │
│   │   ├── 📁 nlp/                 # Natural language processing
│   │   │   ├── index.ts            # parsePrompt() entry point
│   │   │   ├── promptParser.ts     # wink-nlp POS tagging
│   │   │   └── wink.ts             # wink-nlp initializer
│   │   │
│   │   ├── 📁 task-understanding/  # Intent + slot extraction
│   │   │   ├── taskUnderstanding.ts    # Main orchestrator
│   │   │   ├── intentClassifier.ts     # Rule-based intent
│   │   │   ├── massiveIntentClassifier.ts  # Zero-shot NLI classifier
│   │   │   ├── slotExtractor.ts        # Extract task parameters
│   │   │   └── config.ts               # Intent → action mappings
│   │   │
│   │   ├── 📁 privacy/             # ⭐ Privacy pipeline (core feature)
│   │   │   ├── privacyPipeline.ts  # Main pipeline orchestrator
│   │   │   ├── piiDetector.ts      # BERT NER inference (ONNX in-browser)
│   │   │   ├── privacyRules.ts     # Regex rules (email, phone, CC, password)
│   │   │   ├── tokenVault.ts       # Local-only token ↔ raw value map
│   │   │   ├── sensitivityPolicy.ts # BLOCK/TOKENIZE/ALLOW per PII type
│   │   │   ├── sanitizer.ts        # Replace raw values with tokens in objects
│   │   │   └── privacyValidator.ts # Validate SafeContext before network send
│   │   │
│   │   ├── 📁 vision/              # ⭐ Local vision pipeline
│   │   │   ├── visionModel.ts      # YOLOS-tiny inference (Xenova/transformers)
│   │   │   └── visualMasking.ts    # Canvas API masking + redaction evidence
│   │   │
│   │   ├── 📁 execution/           # Browser control
│   │   │   ├── perception.ts       # DOM observer (semantic element extraction)
│   │   │   └── actionExecutor.ts   # DOM action executor (click, type, scroll...)
│   │   │
│   │   └── 📁 network/
│   │       └── serverClient.ts     # Privacy gate + HTTP POST to server
│   │
│   └── 📁 shared/
│       ├── schemas.ts              # Zod schemas: ToolCall, SafeContext, etc.
│       └── messages.ts             # Chrome message type definitions
│
├── 📁 server/                      # Local reasoning server
│   ├── 📄 .env.example             # Template for server config
│   └── 📁 src/
│       ├── index.ts                # Express server, routing, error handling
│       └── reasoning.ts            # Groq VLM integration + error classification
│
├── 📁 tests/                       # Test suite
│   ├── privacy.test.ts             # Privacy pipeline unit tests
│   ├── promptParser.test.ts        # NLP parser tests
│   ├── taskUnderstanding.test.ts   # Intent classification tests
│   └── e2e.test.ts                 # End-to-end task tests
│
└── 📄 sih_demo.html                # Controlled SIH demo page (laptop store)
```

---

## Environment Variables

All server configuration lives in `server/.env` (never committed to git).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | ✅ Yes | — | Your Groq API key from [console.groq.com](https://console.groq.com) |
| `REASONING_PROVIDER` | ✅ Yes | `mock` | Set to `groq` to use real AI; `mock` for testing |
| `GROQ_MODEL` | No | `qwen/qwen3.8-27b` | Groq model ID to use |

**Example `server/.env`:**
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
REASONING_PROVIDER=groq
GROQ_MODEL=qwen/qwen3.8-27b
```

---

## Available Scripts

Run these from the project root:

| Command | Description |
|---------|-------------|
| `npm run build` | Build the extension to `dist/` (production) |
| `npm run dev` | Build in watch mode — auto-rebuilds on file changes |
| `npm test` | Run all unit tests with Vitest |
| `npx tsx server/src/index.ts` | Start the local reasoning server |

**Development workflow:**

```bash
# Terminal 1 — Auto-rebuild extension on changes
npm run dev

# Terminal 2 — Run reasoning server
npx tsx server/src/index.ts

# In Chrome — After any rebuild:
# Go to chrome://extensions/ → Click the refresh ↺ button on the extension
```

---

## How the Privacy Pipeline Works

Every task goes through this pipeline before anything reaches the server:

### Step 1 — Natural Language Parsing
```
"Send email to Rahul at rahul@example.com about the meeting"
     ↓ wink-nlp (runs locally)
{ verb: "send", object: "email", entities: ["Rahul", "rahul@example.com"] }
```

### Step 2 — Task Understanding
```
     ↓ Intent classifier + slot extractor (runs locally)
{
  intent: "SEND_EMAIL",
  slots: { recipient: "Rahul", address: "rahul@example.com", subject: "meeting" }
}
```

### Step 3 — PII Detection (two layers)
```
     ↓ BERT NER model (ONNX, runs locally in browser)
{ type: "PERSON", value: "Rahul", confidence: 0.94 }

     ↓ Regex rules (runs locally)
{ type: "EMAIL_ADDRESS", value: "rahul@example.com", confidence: 1.0 }
```

### Step 4 — Tokenization
```
     ↓ Token Vault (in-memory, never leaves browser)
"Rahul"             → <PERSON_1>
"rahul@example.com" → <EMAIL_ADDRESS_1>

Vault state (LOCAL ONLY, never transmitted):
{
  "<PERSON_1>":         "Rahul",
  "<EMAIL_ADDRESS_1>":  "rahul@example.com"
}
```

### Step 5 — Visual Masking
```
     ↓ chrome.tabs.captureVisibleTab() → raw JPEG
     ↓ YOLOS-tiny detects objects (local)
     ↓ Canvas API draws grey/black boxes over sensitive regions
     ↓ Output: sanitized JPEG (max 1280px, JPEG quality 0.6)
```

### Step 6 — Privacy Gate (triple check)
```
     ↓ String scan: is any vault raw value in the payload? → NO ✅
     ↓ BERT NER on outbound text: any residual PII? → NO ✅
     ↓ Regex on outbound text: any pattern match? → NO ✅
     → CLEAR TO SEND
```

### Step 7 — What the server receives
```json
{
  "task": {
    "intent": "SEND_EMAIL",
    "slots": {
      "recipient": "<PERSON_1>",
      "address": "<EMAIL_ADDRESS_1>",
      "subject": "meeting"
    }
  },
  "privacy": { "sanitized": true, "piiDetected": true },
  "pageData": {
    "elements": [...],
    "screenshotBase64": "data:image/jpeg;base64,..."
  }
}
```
> ✅ No raw names. No raw emails. No raw screenshot. Only sanitized, anonymized context.

### Step 8 — Token resolution (local, at execution time)
```
Server returns: { name: "browser.type", arguments: { text: "<PERSON_1>" } }
                                                          ↓
agentController: vault.getRawValue("<PERSON_1>") → "Rahul"
                                                          ↓
Content script types "Rahul" into the DOM field
```

---

## Models Used

| Model | Purpose | Runtime | Size | Where it runs |
|-------|---------|---------|------|--------------|
| `onnx-community/bert-small-pii-detection-ONNX` | PII detection (NER) | ONNX Runtime Web | ~15 MB | Browser (IndexedDB cache) |
| `Xenova/yolos-tiny` | Object detection (vision) | ONNX Runtime Web | ~28 MB | Browser (IndexedDB cache) |
| `cartesinus/multilingual_minilm-amazon-massive-intent` | Intent classification | ONNX Runtime Web | ~90 MB | Browser (IndexedDB cache) |
| `qwen/qwen3.8-27b` | Multimodal reasoning | Groq Cloud (LPU) | 27B params | Groq server |

> **Model caching:** On first run, `transformers.js` downloads ONNX models from HuggingFace CDN and stores them in browser IndexedDB. Subsequent runs load from cache instantly. No files need to be manually downloaded.

---

## Troubleshooting

### ❌ Extension not appearing in side panel
- Make sure you loaded the **`dist/`** folder, not the root project folder
- Check `chrome://extensions/` for any errors shown on the extension card
- Click the refresh ↺ icon on the extension after rebuilding

### ❌ `NO_WEBPAGE_TAB` error
- The agent needs an active `http://` or `https://` tab to operate
- Make sure a regular webpage (not `chrome://` or `chrome-extension://`) is open and focused
- Click on the webpage tab before clicking Run Task

### ❌ `GROQ_REQUEST_FAILED` or server errors
- Confirm the server is running: `npx tsx server/src/index.ts`
- Check `server/.env` has a valid `GROQ_API_KEY`
- If you see `GROQ_CONTEXT_TOO_LARGE`: the page has too many elements; the agent will auto-trim
- If you see `GROQ_RATE_LIMITED`: you've hit Groq's free tier limit; wait a few seconds

### ❌ `npm run build` fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### ❌ Vision model never loads / times out
- First load downloads ~28MB from HuggingFace — this requires internet and takes 10-30 seconds
- If behind a firewall, the model may fail to download
- Check Chrome DevTools Console on the sidepanel page for `[Vision]` log messages

### ❌ Push to GitHub still fails with large files
```bash
# Check what git is tracking
git ls-files | xargs -I{} du -sh {} | sort -rh | head -10

# If any *.onnx or *.wasm files appear, remove them:
git rm --cached path/to/file.onnx
git commit -m "Remove large binary"
git push --force origin main
```

---

## Contributing

This project was built for **Smart India Hackathon 2024**. Contributions welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test: `npm test`
4. Build and verify: `npm run build`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

---

<div align="center">

**Built for Smart India Hackathon 2024**

*Local AI • Privacy First • No raw data leaves your browser*

</div>
