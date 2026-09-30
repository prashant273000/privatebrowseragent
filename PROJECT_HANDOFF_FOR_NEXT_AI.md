# PROJECT HANDOFF: PRIVATE BROWSER AGENT

## 1. PROJECT PURPOSE
**Project Name**: Private Browser Agent
**Problem**: A privacy-preserving browser agent that uses local ML processing (NLP and Vision) to understand and protect browser context before sanitizing it and sending it to a server-side Reasoning Engine (LLM/VLM).
**Goal (SIH Hackathon)**: Demonstrate an end-to-end architecture featuring local browser vision, robust dynamic PII detection, visual redaction, and local browser execution based on AI reasoning over sanitized context.

## 2. ORIGINAL ARCHITECTURE
### Standard Architecture
USER PROMPT
    ↓
STEP 1 — LOCAL NLP
    ↓
STEP 2 — LOCAL TASK / INTENT / SLOT UNDERSTANDING
    ↓
STEP 3 — LOCAL PII DETECTION + TOKENIZATION + SANITIZATION
    ↓
SAFE CONTEXT
    ↓
NETWORK GATE
    ↓
STEP 4 — SERVER-SIDE REASONING
    ↓
ACTION / TOOL CALL
    ↓
STEP 5 — LOCAL BROWSER PERCEPTION + GROUNDING + EXECUTION
    ↓
OBSERVE AGAIN
    ↓
RESULT

### SIH Visual Extension (Current Implementation)
CURRENT ACTIVE WEBPAGE
    ↓
LOCAL SCREEN CAPTURE
    ↓
LOCAL VISION
    +
LOCAL DOM / SEMANTIC PERCEPTION
    ↓
LOCAL PRIVACY SANITIZATION
    ↓
SANITIZED VISUAL CONTEXT
    ↓
SERVER REASONING (Groq VLM)
    ↓
LOCAL BROWSER EXECUTION

## 3. CURRENT HIGH-LEVEL STATUS
| COMPONENT | STATUS | ACTUAL EVIDENCE | IMPORTANT LIMITATION |
|---|---|---|---|
| Chrome Extension | IMPLEMENTED | Loads in Chrome side panel | None |
| Side Panel UI | IMPLEMENTED | `extension/sidepanel.html` rebuilt | Fixed metrics/states |
| Step 1 (NLP) | IMPLEMENTED | `winkNLP` executes locally | Predefined custom entities |
| Step 2 (Intent) | IMPLEMENTED | `mobilebert-uncased-mnli` | Runs WASM locally |
| Step 3 (Privacy) | IMPLEMENTED | Vault + model + rules | `bert-small-pii-detection-ONNX` |
| SafeContext | IMPLEMENTED | `SafeContext` JSON dumped in UI | - |
| Network Gate | IMPLEMENTED | `serverClient.ts` blocks leakage | Fails closed on raw PII leak |
| Step 4 (Server) | IMPLEMENTED | Express server on port 3000 | - |
| Groq | IMPLEMENTED | `qwen/qwen3.8-27b` configured | Groq VLM natively processes image |
| Step 5 (DOM) | IMPLEMENTED | `perception.ts` reads `document` | Requires standard semantic HTML |
| Local Vision | IMPLEMENTED | `YOLOS-tiny` executes locally | Threshold 0.1; WASM heavy |
| Screenshot Capture | IMPLEMENTED | `chrome.tabs.captureVisibleTab` | Requires `<all_urls>` permission |
| Visual Redaction | IMPLEMENTED | Canvas masking working | Uses basic gray/black rects |
| Tool-Calling Loop | IMPLEMENTED | `agentController.ts` | Iterative; Max timeout NOT strict |
| Browser Execution | IMPLEMENTED | `actionExecutor.ts` | Dispatches `MouseEvent` |
| SIH Demo Page | IMPLEMENTED | `sih_demo.html` available | Synthetic PII / test data |
| SIH Metrics | IMPLEMENTED | Local timer metrics printed | Precision/Recall not strictly calculated |
| Real Chrome E2E | IMPLEMENTED | Verified manually via UI logs | Automated `e2e.test.ts` is BROKEN |
| Firefox Compat | NOT TESTED | MV3 background service worker | Likely fails due to WASM CSP |

## 4. COMPLETE FILE / DIRECTORY INVENTORY
\`\`\`
.
├── extension/
│   ├── manifest.json         # Extension config. Main Export: MV3 definition with <all_urls>.
│   ├── sidepanel.html        # UI entrypoint. Includes UI structure for SIH demo metrics.
│   ├── sidepanel.js          # UI controller. Emits agent lifecycle events visually.
│   ├── content.ts            # Content script. Grounding + observation execution in the browser tab.
│   ├── background.js         # Service worker. Mostly proxy/empty in current architecture.
│   └── public/               # Static models, WASM runtimes, and icons.
├── server/
│   ├── .env                  # Environment config containing GROQ_API_KEY. (DO NOT COMMIT).
│   └── src/
│       ├── index.ts          # Express server entry point. Defines /agent/tool.
│       └── reasoning.ts      # Instantiates Groq SDK, parses SafeContext + Image, returns Tool Call.
├── src/local-agent/
│   ├── agentController.ts    # Central Orchestrator. Manages steps 1-5, handles network boundary, timeouts.
│   ├── execution/            # Browser tools. actionExecutor.ts executes clicks/typing.
│   ├── network/              # serverClient.ts. Validates payload vs Vault before fetch.
│   ├── nlp/                  # Step 1. winkNLP implementation.
│   ├── privacy/              # Step 3. TokenVault, PII models, redaction rules.
│   ├── task-understanding/   # Step 2. MobileBERT MNLI local mapping and slot extraction.
│   └── vision/               # Local visual pipeline (YOLOS-tiny) and canvas redactor.
├── tests/                    # Vitest suite. (e2e.test.ts is BROKEN due to UI rewrite).
├── package.json              # Dependencies (winkNLP, transformers, groq-sdk, express).
├── sih_demo.html             # The primary SIH Hackathon local target page.
└── vite.config.js            # Build configuration for Vite (ESM bundles).
\`\`\`

## 5. STEP 1 — LOCAL NLP
- **Library**: `wink-nlp` with `wink-eng-lite-web-model`
- **Behavior**: Extracts sentences, normalizes text, handles POS tagging, extracts custom entities (WEBSITE, ACTION_WORD).
- **Network**: Raw prompt is NEVER sent over the network. Step 1 runs purely in WASM.

## 6. STEP 2 — TASK UNDERSTANDING
- **Model**: `Xenova/mobilebert-uncased-mnli` (ONNX WASM)
- **Behavior**: Zero-shot classification mapping user prompt to categories (`TRAVEL`, `SHOPPING`, `COMMUNICATION`) and tasks (`SEARCH_PRODUCT`, `BOOK_FLIGHT`).
- **Extraction**: Rule-based slot extraction (e.g., `SEND_EMAIL` extracts recipient and message).
- **Known weaknesses**: High ambiguity for short phrases ("book it"). Fallback requires explicit clarification logic.

## 7. STEP 3 — PRIVACY ARCHITECTURE
- **Model**: `Xenova/bert-small-pii-detection-ONNX`
- **Flow**: RAW PII → DETECT (Model + Regex) → SANITIZE (Tokenize/Block) → TOKEN VAULT → SAFE CONTEXT → NETWORK
- **Vault**: Local `sessionVault` in memory mapping `<PERSON_1> → Rahul`.
- **Validation**: `serverClient.ts` physically scans the serialized JSON payload for any string matching a known raw vault value before allowing `fetch()`. It fails closed throwing `Privacy Violation`.

## 8. STEP 4 — SERVER & GROQ
- **Framework**: Express (Port 3000)
- **Model**: `qwen/qwen3.8-27b` via Groq SDK (`groq-sdk`).
- **Status**: IMPLEMENTED and ACTIVE.
- **Environment**: Requires `GROQ_API_KEY`, `REASONING_PROVIDER=groq`, `GROQ_MODEL=qwen/qwen3.8-27b` inside `server/.env`. (Key is valid/present in local test).
- **Gemini**: Removed. Code contains no `@google/genai` references.
- **Timeout**: `GROQ_TIMEOUT_MS = 30000` enforced.

## 9. STEP 5 — LOCAL BROWSER PERCEPTION & EXECUTION
- **Perception**: `browser.observe` scans DOM, generating semantic representation, filtering invisible/disabled nodes, identifying interactive `button` / `input` / `a` tags.
- **ElementRef**: Opaque IDs (`el_1`, `el_2`) mapped in the Content Script's local Map. Server NEVER receives CSS selectors or XPath.
- **Screenshot**: `chrome.tabs.captureVisibleTab` is called dynamically. Local privacy masking applies gray/black boxes over sensitive bounding boxes on an HTML canvas.

## 10. CURRENT ISSUES & RESOLUTIONS
1. **CONTENT_SCRIPT_UNAVAILABLE**: Fixed by migrating tests to `http://localhost:3000/sih_demo.html`.
2. **Active-Tab DevTools Bug**: Fixed using `currentWindow: true`.
3. **Indefinite Hang (`RUNNING...`)**: Fixed. Added `VISION_TIMEOUT_MS = 15000`, lowered YOLOS threshold to `0.1`, removed spinlocks.
4. **Screenshot Permissions**: Fixed. Changed manifest to require explicit `<all_urls>` because `activeTab` cannot be dynamically triggered inside Side Panel without user click. `MAX_AGENT_RUNTIME_MS` (global timeout) was requested but the source replacement script failed, so it DOES NOT currently exist.

## 11. SIH DEMO PAGE
- **URL**: `http://localhost:3000/sih_demo.html`
- **Products**: Laptop A (8GB RAM, ₹55K), Laptop B (16GB RAM, ₹60K), Laptop C (8GB RAM, ₹48K).
- **Synthetic PII**: Rahul, rahul@example.com, 9876543210, password, credit card. (For local redaction testing).

## 12. EXTENSION UI & METRICS
- **Developer JSON**: Exposes real-time JSON for Intent, SafeContext, Visual Detections, Groq Request, and Tool Results.
- **Privacy Preview**: Displays Side-by-Side Original (Local) vs Sanitized (Network) Base64 images.
- **Metrics**: Total Latency, Memory, and Inference Time are REAL (`performance.now()`). SIH precision/recall metrics are NOT strictly calculated/validated automatically in UI.

## 13. NETWORK AUDIT
- `serverClient.ts` uses `fetch` to `http://localhost:3000/agent/tool`.
- Data includes JSON Stringified `SafeContext` (DOM, Task, visualDetections) and `screenshotBase64` (sanitized image).
- **Raw PII & Screenshot**: Physically blocked by `privacyValidator.ts` and `serverClient.ts` gate.

## 14. DEPENDENCIES
- `@xenova/transformers`
- `onnxruntime-web`
- `wink-nlp`
- `groq-sdk`
- `express`

## 15. EXACT COMMANDS
- **Install**: `npm install`
- **Build**: `npm run build`
- **Start Backend**: `npx tsx server/src/index.ts`
- **Load Extension**: Open Chrome -> `chrome://extensions` -> Load Unpacked -> select `dist/` directory.

## 16. SIH OBJECTIVE MAPPING
| SIH Objective | Current Implementation | Status | Evidence | Gap |
|---|---|---|---|---|
| Local Vision | `Xenova/yolos-tiny` ONNX | IMPLEMENTED | Local WASM init | Heavy WASM |
| Privacy Filter | ONNX MobileBERT + Rules | IMPLEMENTED | Vault verification | - |
| Visual Redaction | Canvas Masking | IMPLEMENTED | Base64 Redacted img | Basic rects |
| Server LLM/VLM | Groq SDK (`qwen3.8-27b`) | IMPLEMENTED | Valid tool calls | API limit |
| Local Execution | DOM events | IMPLEMENTED | Button clicks | JS Frameworks |

## 17. FINAL HANDOFF SUMMARY
PROJECT: Private Browser Agent
PURPOSE: Privacy-preserving local agent preventing data leakage while executing autonomous browser tasks via VLM backend.
CURRENT ACTIVE SERVER MODEL: `qwen/qwen3.8-27b` via Groq
CURRENT ACTIVE LOCAL VISION MODEL: `Xenova/yolos-tiny` (WASM)
LOCAL PRIVACY: MobileBERT PII Model + Token Vault + Canvas Redaction. Verified to block raw string leakage.
REAL CHROME STATUS: Extension functional in Side Panel, E2E functional.
MAIN CURRENT BLOCKER: High latency on WASM Vision; automated testing `e2e.test.ts` is broken.
SIH OBJECTIVES ALREADY PROVEN: Visual Redaction, SafeContext transfer, Image multimodal tool calling.
SIH OBJECTIVES NOT YET PROVEN: Quantitative SIH metric calculations (Precision/Recall).
DEMO PAGE: `http://localhost:3000/sih_demo.html`
SERVER START COMMAND: `npx tsx server/src/index.ts`
EXTENSION BUILD COMMAND: `npm run build`
MOST IMPORTANT NEXT ACTION: Fix automated tests and implement strict SIH quantitative metric logging.
