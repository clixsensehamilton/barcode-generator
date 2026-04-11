# Multi-Feature Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Chrome side-panel extension to support multiple features via a dropdown selector, and add an Arduino Bluetooth Controller as the second feature.

**Architecture:** Single-file approach — all HTML in `sidepanel.html` (barcode and arduino sections shown/hidden), all JS in `sidepanel.js` reorganized into a feature registry pattern (`{ id, init, mount, unmount }`). The shell wires the dropdown to `switchFeature()`.

**Tech Stack:** Chrome MV3 Side Panel, Web Bluetooth API (navigator.bluetooth), vanilla JS (no new libraries), existing JsBarcode + qrcode.js.

**Spec:** `docs/superpowers/specs/2026-04-11-multi-feature-extension-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `manifest.json` | Modify | Add `bluetooth` permission |
| `sidepanel.html` | Modify | Feature dropdown; wrap barcode in `<section>`; add Arduino `<section>` |
| `sidepanel.css` | Modify | Feature dropdown styles; Arduino panel styles (dark theme, system fonts) |
| `sidepanel.js` | Modify | Shell + feature registry; barcode feature; arduino feature |
| `gemini.md` | Modify | Update constitution: new architecture, bluetooth permission, arduino feature |

---

### Task 1: Add bluetooth permission to manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add bluetooth permission**

Open `manifest.json`. Change:
```json
"permissions": ["sidePanel"],
```
to:
```json
"permissions": ["sidePanel", "bluetooth"],
```

Also update `"version"` from `"1.0.0"` to `"1.2.0"`.

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat: add bluetooth permission and bump version to 1.2.0"
```

---

### Task 2: Update gemini.md

**Files:**
- Modify: `gemini.md`

- [ ] **Step 1: Update Section 2 — add Arduino feature scope**

After the `### Feature: Generate` block, add:

```markdown
### Feature: Arduino BT Controller
- User selects "Arduino BT Controller" from the feature dropdown
- User enters a Bluetooth device name (default: ESP32_WS) and can test the connection
- User connects to an ESP32 via Web Bluetooth (Nordic UART Service)
- Manual send: user types a value and sends it as plain text over BLE
- Sequence mode: user sets Increment, Max Value, Threshold, and Delay (ms)
  - Steps: [0, inc, 2*inc, ... max] forward then reverse
  - Each value sent = step + threshold; validates max % increment === 0 before running
- Activity log shows timestamped sent/received/error entries (DOM API only, no innerHTML)
```

- [ ] **Step 2: Update Section 4 — architecture tree**

Add `docs/arduino/ESP32_ScaleCheck.html` as a reference-only file (not loaded at runtime).
Change the file description for `sidepanel.js` to: "Shell (feature registry + switchFeature) + barcode feature + arduino feature"

- [ ] **Step 3: Update Section 6 — add to DO list and DO NOT list**

Add to DO:
```
- Support multiple features via a dropdown selector in the header
- Use feature registry pattern: { id, label, init(), mount(), unmount() }
- Use system fonts only (no CDN, no bundled font files)
```

Add to DO NOT:
```
- Load external fonts or any resources at runtime
```

- [ ] **Step 4: Update Section 7 — permissions**

Change `Required Permissions: sidePanel` to `Required Permissions: sidePanel, bluetooth`

- [ ] **Step 5: Add to Maintenance Log**

```
| 2026-04-11 | Added multi-feature shell + Arduino BT Controller | User request |
| 2026-04-11 | Added bluetooth permission | Required for Web Bluetooth API |
```

- [ ] **Step 6: Commit**

```bash
git add gemini.md
git commit -m "docs: update project constitution for multi-feature architecture"
```

---

### Task 3: Restructure sidepanel.html

**Files:**
- Modify: `sidepanel.html`

- [ ] **Step 1: Add feature dropdown after `</header>`**

Insert after the closing `</header>` tag (line 26):

```html
    <!-- Feature Selector -->
    <div class="feature-select-wrap">
      <select id="feature-select" class="feature-select" aria-label="Select feature">
        <option value="barcode">Barcode Generator</option>
        <option value="arduino">Arduino BT Controller</option>
      </select>
    </div>
```

- [ ] **Step 2: Wrap all barcode UI in a section**

Insert `<section id="feature-barcode">` on the line after the feature dropdown closing tag.

Insert `</section> <!-- /feature-barcode -->` after the closing `</div>` of `id="history-section"` and before the closing `</div>` of `.app`.

- [ ] **Step 3: Add the Arduino section**

After the barcode `</section>`, insert the complete Arduino panel. The section must contain these elements (in order):

```html
<section id="feature-arduino" class="hidden">
  <div class="ard-panel">

    <!-- Device Config: text input id="ard-device-name" value="ESP32_WS"
         + button id="ard-btn-test" -->
    <div class="ard-config-row">
      <div class="ard-field-group">
        <label class="field-label" for="ard-device-name">DEVICE NAME</label>
        <input type="text" id="ard-device-name" class="ard-input" value="ESP32_WS"
               autocomplete="off" spellcheck="false" aria-label="Bluetooth device name">
      </div>
      <button class="ard-btn-secondary" id="ard-btn-test">TEST</button>
    </div>

    <!-- Compatibility warning (hidden by default) -->
    <div class="ard-compat-warn hidden" id="ard-compat-warn" role="alert">
      Web Bluetooth requires Chrome on desktop or Android.
    </div>

    <!-- Connect row: status dot + connect button -->
    <div class="ard-connect-row">
      <div class="ard-status-dot" id="ard-status-dot" aria-hidden="true"></div>
      <button class="ard-btn-connect" id="ard-btn-connect">CONNECT</button>
    </div>

    <div class="ard-divider"></div>

    <!-- Manual send -->
    <label class="field-label" for="ard-value-input">VALUE TO SEND</label>
    <div class="ard-send-row">
      <input type="text" id="ard-value-input" class="ard-input"
             placeholder="Enter value..." disabled autocomplete="off" spellcheck="false">
      <button class="ard-btn-send" id="ard-btn-send" disabled>SEND</button>
    </div>

    <div class="ard-divider"></div>

    <!-- Sequence mode -->
    <div class="field-label" style="margin-bottom:8px">SEQUENCE MODE</div>
    <div class="ard-seq-grid">
      <div class="ard-field-group">
        <label class="field-label" for="ard-increment">INCREMENT</label>
        <input type="number" id="ard-increment" class="ard-input" value="10" min="1" disabled>
      </div>
      <div class="ard-field-group">
        <label class="field-label" for="ard-max-value">MAX VALUE</label>
        <input type="number" id="ard-max-value" class="ard-input" value="100" min="1" disabled>
      </div>
      <div class="ard-field-group">
        <label class="field-label" for="ard-threshold">THRESHOLD</label>
        <input type="number" id="ard-threshold" class="ard-input" value="0" disabled>
      </div>
      <div class="ard-field-group">
        <label class="field-label" for="ard-delay">DELAY (MS)</label>
        <input type="number" id="ard-delay" class="ard-input" value="3000" min="0" disabled>
      </div>
    </div>

    <!-- Validation error (hidden by default) -->
    <div class="ard-seq-error hidden" id="ard-seq-error" role="alert"></div>

    <!-- Start/stop button -->
    <button class="ard-btn-start" id="ard-btn-start" disabled>START</button>

    <!-- Progress bar (hidden until sequence runs) -->
    <div class="ard-seq-progress hidden" id="ard-seq-progress">
      <div class="ard-progress-header">
        <span id="ard-progress-label">Sequence progress</span>
        <span id="ard-progress-step"></span>
      </div>
      <div class="ard-progress-track">
        <div class="ard-progress-fill" id="ard-progress-fill"></div>
      </div>
    </div>

    <div class="ard-divider"></div>

    <!-- Activity log -->
    <div class="ard-log-header">
      <span class="field-label">ACTIVITY LOG</span>
      <button class="ard-btn-clear-log" id="ard-btn-clear-log">CLEAR</button>
    </div>
    <div class="ard-log-box" id="ard-log-box" aria-live="polite"></div>

  </div>
</section>
```

- [ ] **Step 4: Commit**

```bash
git add sidepanel.html
git commit -m "feat: add feature dropdown shell and Arduino section to HTML"
```

---

### Task 4: Add styles to sidepanel.css

**Files:**
- Modify: `sidepanel.css`

- [ ] **Step 1: Append feature dropdown styles to the end of sidepanel.css**

```css
/* ============================================================
   Feature Sections — layout container for each feature panel
   ============================================================ */

section {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  flex: 1;
  min-height: 0; /* allows inner overflow-y: auto to work */
}

/* ============================================================
   Feature Selector Dropdown
   ============================================================ */

.feature-select-wrap { flex-shrink: 0; }

.feature-select {
  width: 100%;
  background: var(--c-raised);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  color: var(--c-text);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 9px 32px 9px 11px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23505050' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 11px center;
  transition: border-color 0.18s;
}

.feature-select:focus {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-lo);
}

.feature-select option { background: var(--c-surface); color: var(--c-text); }

/* ============================================================
   Arduino BT Controller Feature
   ============================================================ */

.ard-panel { display: flex; flex-direction: column; gap: 10px; }

.ard-config-row { display: flex; gap: 8px; align-items: flex-end; }

.ard-field-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }

.ard-input {
  width: 100%;
  background: var(--c-raised);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 9px 11px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  caret-color: var(--c-accent);
}

.ard-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
.ard-input:disabled { opacity: 0.4; cursor: not-allowed; }
.ard-input::placeholder { color: var(--c-muted); font-family: var(--font-ui); }
.ard-input[type="number"]::-webkit-inner-spin-button,
.ard-input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
.ard-input[type="number"] { -moz-appearance: textfield; }

.ard-btn-secondary {
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  color: var(--c-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  padding: 9px 12px;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-end;
}
.ard-btn-secondary:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-accent); }
.ard-btn-secondary:disabled { opacity: 0.35; cursor: not-allowed; }

.ard-compat-warn {
  font-size: 11px;
  color: var(--c-err);
  background: var(--c-err-lo);
  border-left: 2px solid var(--c-err);
  border-radius: 0 4px 4px 0;
  padding: 7px 11px;
  line-height: 1.5;
}

.ard-connect-row { display: flex; align-items: center; gap: 10px; }

.ard-status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--c-muted);
  flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}
.ard-status-dot.connected {
  background: #00cc66;
  box-shadow: 0 0 8px rgba(0, 204, 102, 0.55);
  animation: ardPulse 2s infinite;
}
.ard-status-dot.error { background: var(--c-err); box-shadow: 0 0 8px rgba(255, 76, 76, 0.55); }

@keyframes ardPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.ard-btn-connect {
  flex: 1;
  background: transparent;
  border: 1px solid var(--c-accent);
  border-radius: var(--radius);
  color: var(--c-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.10em;
  padding: 10px;
  cursor: pointer;
  transition: all 0.18s;
}
.ard-btn-connect:hover:not(:disabled) { background: var(--c-accent-lo); }
.ard-btn-connect.connected { border-color: var(--c-err); color: var(--c-err); }
.ard-btn-connect.connected:hover:not(:disabled) { background: var(--c-err-lo); }
.ard-btn-connect:disabled { opacity: 0.35; cursor: not-allowed; }

.ard-divider { height: 1px; background: var(--c-border); margin: 2px 0; }

.ard-send-row { display: flex; gap: 8px; }

.ard-btn-send {
  background: var(--c-accent);
  border: none;
  border-radius: var(--radius);
  color: var(--c-bg);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 9px 14px;
  cursor: pointer;
  transition: opacity 0.18s;
  white-space: nowrap;
  flex-shrink: 0;
}
.ard-btn-send:hover:not(:disabled) { opacity: 0.85; }
.ard-btn-send:disabled { opacity: 0.25; cursor: not-allowed; }

.ard-seq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.ard-seq-error {
  font-size: 11px;
  color: var(--c-err);
  background: var(--c-err-lo);
  border-left: 2px solid var(--c-err);
  border-radius: 0 4px 4px 0;
  padding: 7px 11px;
}

.ard-btn-start {
  width: 100%;
  background: #00cc66;
  border: none;
  border-radius: var(--radius);
  color: #000;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 11px;
  cursor: pointer;
  transition: opacity 0.18s;
}
.ard-btn-start:hover:not(:disabled) { opacity: 0.85; }
.ard-btn-start:disabled { opacity: 0.30; cursor: not-allowed; }
.ard-btn-start.running { background: var(--c-err); color: #fff; animation: ardRunPulse 1s infinite; }

@keyframes ardRunPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }

.ard-seq-progress { display: flex; flex-direction: column; gap: 5px; }

.ard-progress-header {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--c-muted);
  letter-spacing: 0.05em;
}

.ard-progress-track { height: 3px; background: var(--c-border); border-radius: 2px; overflow: hidden; }

.ard-progress-fill {
  height: 100%;
  background: #00cc66;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s;
  width: 0%;
}
.ard-progress-fill.returning { background: var(--c-accent); }

.ard-log-header { display: flex; justify-content: space-between; align-items: center; }

.ard-btn-clear-log {
  background: none; border: none;
  color: var(--c-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.18s;
  padding: 0;
}
.ard-btn-clear-log:hover { color: var(--c-err); }

.ard-log-box {
  background: var(--c-raised);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 10px;
  height: 150px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.7;
  scrollbar-width: thin;
  scrollbar-color: var(--c-border) transparent;
}

.ard-log-entry { display: flex; gap: 8px; }
.ard-log-time  { color: var(--c-muted); flex-shrink: 0; }
.ard-log-sent  { color: var(--c-accent); }
.ard-log-recv  { color: #00cc66; }
.ard-log-info  { color: var(--c-muted); font-style: italic; }
.ard-log-err   { color: var(--c-err); }
.ard-log-seq   { color: #b08aff; }
```

- [ ] **Step 2: Commit**

```bash
git add sidepanel.css
git commit -m "feat: add feature dropdown and Arduino panel styles"
```

---

### Task 5: Refactor sidepanel.js into feature registry (barcode feature)

**Files:**
- Modify: `sidepanel.js`

This task reorganizes the existing code without changing any barcode behavior. All existing functions stay identical. Event listeners and init code move into `init()` / `mount()` / `unmount()` lifecycle hooks.

**Important timing note:** The barcode feature's DOM refs (lines 46–63 of the current `sidepanel.js`) are assigned at module level — they execute synchronously when the script is parsed. This is safe because the `<script>` tag is at the end of `<body>`, so the DOM elements already exist. Do NOT move the script tag or the barcode DOM ref declarations. The registry `init()` / `mount()` calls happen at `DOMContentLoaded` which fires after these top-level assignments.

- [ ] **Step 1: Add the shell block at the very top of sidepanel.js (before the existing code)**

Insert these lines before the `'use strict';` declaration (or right after it):

```js
// ============================================================
// Shell — Feature Registry
// ============================================================

const FEATURES = [];
let activeFeature = null;

function registerFeature(feature) {
  FEATURES.push(feature);
}

function switchFeature(id) {
  if (activeFeature) {
    activeFeature.unmount();
    document.getElementById('feature-' + activeFeature.id).classList.add('hidden');
  }
  const feature = FEATURES.find(f => f.id === id);
  if (!feature) return;
  document.getElementById('feature-' + id).classList.remove('hidden');
  feature.mount();
  activeFeature = feature;
}

document.addEventListener('DOMContentLoaded', () => {
  FEATURES.forEach(f => f.init());
  const featureSelect = document.getElementById('feature-select');
  featureSelect.addEventListener('change', () => switchFeature(featureSelect.value));
  switchFeature('barcode');
});
```

- [ ] **Step 2: Remove the old init block at the bottom**

Delete these three lines at the very bottom of the file:

```js
setMode('qr');
sliderBadge.textContent = SCALE[currentScale].label;
valueInput.focus();
```

- [ ] **Step 3: Remove the event listener block at the bottom**

Delete all lines from `// ── Event Listeners ─────────` down to and including `dlBtn.addEventListener('click', downloadPNG);` and the `historyHeader.addEventListener` block. These will move into the feature's `init()`.

- [ ] **Step 4: Add the barcode feature registration at the bottom of the file**

Append after all existing functions:

```js
// ============================================================
// Feature: Barcode Generator
// ============================================================

registerFeature({
  id: 'barcode',
  label: 'Barcode Generator',

  init() {
    btnQr.addEventListener('click', () => setMode('qr'));
    btnBarcode.addEventListener('click', () => setMode('barcode'));

    formatSelect.addEventListener('change', () => {
      currentFormat = formatSelect.value;
      valueInput.placeholder = PLACEHOLDERS[currentFormat];
      clearOutput();
      clearError();
    });

    valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { clearTimeout(debounceTimer); generate(); }
    });

    valueInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      clearError();
      if (!valueInput.value) { clearOutput(); return; }
      debounceTimer = setTimeout(generate, 3000);
    });

    genBtn.addEventListener('click', () => { clearTimeout(debounceTimer); generate(); });

    sizeSlider.addEventListener('input', () => {
      currentScale = parseInt(sizeSlider.value, 10);
      sliderBadge.textContent = SCALE[currentScale].label;
      if (hasOutput) { clearTimeout(debounceTimer); generate(); }
    });

    dlBtn.addEventListener('click', downloadPNG);

    historyHeader.addEventListener('click', function () {
      const collapsed = historySection.classList.toggle('collapsed');
      document.getElementById('history-chevron').setAttribute('aria-pressed', String(!collapsed));
    });
  },

  mount() {
    setMode('qr');
    sliderBadge.textContent = SCALE[currentScale].label;
    valueInput.focus();
  },

  unmount() {
    clearTimeout(debounceTimer);
  },
});

// ============================================================
// Feature: Arduino BT Controller — added in Task 6
// ============================================================
```

- [ ] **Step 5: Load extension in Chrome and verify barcode feature is fully working**

1. Reload extension at `chrome://extensions`
2. Open the side panel
3. Confirm feature dropdown shows "Barcode Generator" selected
4. Generate a QR code — confirm it renders
5. Switch to barcode mode — confirm format selector appears
6. Test history, size slider, PNG download

- [ ] **Step 6: Commit**

```bash
git add sidepanel.js
git commit -m "refactor: reorganize sidepanel.js into feature registry pattern"
```

---

### Task 6: Implement Arduino feature JS

**Files:**
- Modify: `sidepanel.js`

Replace the `// Feature: Arduino BT Controller — added in Task 6` comment at the bottom with the complete implementation. All log entries use `document.createElement` + `textContent` only — no dynamic HTML evaluation anywhere.

- [ ] **Step 1: Append the Arduino feature to sidepanel.js**

Replace the placeholder comment with:

```js
// ============================================================
// Feature: Arduino BT Controller
// ============================================================

registerFeature((function () {
  const NUS_SERVICE = '6e400001-b5b4-f393-e0a9-e50e24dcca9e';
  const NUS_TX_CHAR = '6e400002-b5b4-f393-e0a9-e50e24dcca9e';
  const NUS_RX_CHAR = '6e400003-b5b4-f393-e0a9-e50e24dcca9e';

  let btDevice   = null;
  let txChar     = null;
  let seqRunning = false;
  let seqAbort   = false;

  // DOM refs — assigned in init()
  let elDeviceName, elBtnTest, elBtnConnect, elStatusDot, elCompatWarn;
  let elValueInput, elBtnSend;
  let elIncrement, elMaxValue, elThreshold, elDelay;
  let elSeqError, elBtnStart, elSeqProgress;
  let elProgressFill, elProgressLabel, elProgressStep;
  let elLogBox, elBtnClearLog;

  // Build a log entry using safe DOM APIs (no dynamic HTML evaluation)
  function log(msg, type) {
    type = type || 'info';
    const time = new Date().toTimeString().slice(0, 8);
    const entry = document.createElement('div');
    entry.className = 'ard-log-entry';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'ard-log-time';
    timeSpan.textContent = time;
    const textSpan = document.createElement('span');
    textSpan.className = 'ard-log-' + type;
    textSpan.textContent = msg;
    entry.appendChild(timeSpan);
    entry.appendChild(textSpan);
    elLogBox.appendChild(entry);
    elLogBox.scrollTop = elLogBox.scrollHeight;
  }

  function setConnected(state) {
    elStatusDot.className = 'ard-status-dot' + (state ? ' connected' : '');
    elBtnConnect.textContent = state ? 'DISCONNECT' : 'CONNECT';
    elBtnConnect.classList.toggle('connected', state);
    elBtnTest.disabled    = state;
    elValueInput.disabled = !state;
    elBtnSend.disabled    = !state;
    elIncrement.disabled  = !state;
    elMaxValue.disabled   = !state;
    elThreshold.disabled  = !state;
    elDelay.disabled      = !state;
    elBtnStart.disabled   = !state;
    if (state) elValueInput.focus();
    if (!state && seqRunning) {
      seqAbort   = true;
      seqRunning = false;
      setSeqRunning(false);
    }
  }

  function setSeqRunning(running) {
    elBtnStart.textContent = running ? 'STOP' : 'START';
    elBtnStart.classList.toggle('running', running);
    elIncrement.disabled  = running;
    elMaxValue.disabled   = running;
    elThreshold.disabled  = running;
    elDelay.disabled      = running;
    elValueInput.disabled = running;
    elBtnSend.disabled    = running;
    elBtnConnect.disabled = running;
  }

  async function testConnection() {
    const name = elDeviceName.value.trim() || 'ESP32_WS';
    elBtnTest.disabled = true;
    log('Testing connection to ' + name + '...', 'info');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name }],
        optionalServices: [NUS_SERVICE],
      });
      await device.gatt.connect();
      log('Connected to ' + device.name, 'recv');
      device.gatt.disconnect();
      log('Test complete — disconnected.', 'info');
    } catch (err) {
      if (err.name !== 'NotFoundError') log('Test failed: ' + err.message, 'err');
      else log('Test cancelled.', 'info');
    } finally {
      elBtnTest.disabled = false;
    }
  }

  async function connect() {
    const name = elDeviceName.value.trim() || 'ESP32_WS';
    log('Connecting to ' + name + '...', 'info');
    try {
      btDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name }],
        optionalServices: [NUS_SERVICE],
      });
      btDevice.addEventListener('gattserverdisconnected', onDisconnected);
      const server  = await btDevice.gatt.connect();
      log('Connected. Discovering services...', 'info');
      const service = await server.getPrimaryService(NUS_SERVICE);
      txChar = await service.getCharacteristic(NUS_TX_CHAR);
      try {
        const rxChar = await service.getCharacteristic(NUS_RX_CHAR);
        await rxChar.startNotifications();
        rxChar.addEventListener('characteristicvaluechanged', onReceive);
      } catch (_) { /* RX notifications optional */ }
      setConnected(true);
      log('Ready — connected to ' + btDevice.name, 'recv');
    } catch (err) {
      if (err.name !== 'NotFoundError') log('Connection error: ' + err.message, 'err');
      else log('Connection cancelled.', 'info');
      btDevice = null;
      txChar   = null;
      setConnected(false);
    }
  }

  function disconnect() {
    if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
  }

  function onDisconnected() {
    seqAbort = true;
    txChar   = null;
    setConnected(false);
    log('Disconnected.', 'err');
  }

  function onReceive(event) {
    const val = new TextDecoder().decode(event.target.value).trim();
    if (val) log('<- ' + val, 'recv');
  }

  async function sendValue() {
    const val = elValueInput.value.trim();
    if (!val || !txChar) return;
    try {
      await txChar.writeValue(new TextEncoder().encode(val + '\n'));
      log('-> ' + val, 'sent');
      elValueInput.value = '';
      elValueInput.focus();
    } catch (err) {
      log('Send failed: ' + err.message, 'err');
    }
  }

  function validateSequence() {
    const inc   = parseFloat(elIncrement.value);
    const max   = parseFloat(elMaxValue.value);
    const delay = parseFloat(elDelay.value);
    if (!inc   || inc <= 0)        return 'Increment must be greater than 0';
    if (!max   || max <= 0)        return 'Max value must be greater than 0';
    if (isNaN(delay) || delay < 0) return 'Delay must be 0 or greater';
    if (max % inc !== 0)           return 'Max value must be evenly divisible by increment';
    return null;
  }

  function sleep(ms) {
    if (ms <= 0) return new Promise(function (resolve) { setTimeout(resolve, 0); });
    return new Promise(function (resolve) {
      var tick = setInterval(function () { if (seqAbort) { clearInterval(tick); resolve(); } }, 50);
      setTimeout(function () { clearInterval(tick); resolve(); }, ms);
    });
  }

  async function runSequence() {
    var error = validateSequence();
    if (error) {
      elSeqError.textContent = error;
      elSeqError.classList.remove('hidden');
      return;
    }
    elSeqError.classList.add('hidden');

    var inc       = parseFloat(elIncrement.value);
    var max       = parseFloat(elMaxValue.value);
    var threshold = parseFloat(elThreshold.value) || 0;
    var delayMs   = parseFloat(elDelay.value);

    var forward = [];
    for (var v = 0; v <= max; v += inc) forward.push(v);
    var reverse = forward.slice(0, -1).reverse();
    var full    = forward.concat(reverse);

    seqRunning = true;
    seqAbort   = false;
    setSeqRunning(true);
    elSeqProgress.classList.remove('hidden');

    log('Sequence 0->' + max + ' (' + full.length + ' steps, +' + threshold + ' threshold, ' + delayMs + 'ms delay)', 'seq');

    for (var i = 0; i < full.length; i++) {
      if (seqAbort) break;

      var isReturning = i >= forward.length;
      var sent = (full[i] + threshold).toFixed(2);

      elProgressFill.style.width  = ((i + 1) / full.length * 100) + '%';
      elProgressFill.className    = 'ard-progress-fill' + (isReturning ? ' returning' : '');
      elProgressLabel.textContent = isReturning ? 'Returning...' : 'Going up...';
      elProgressStep.textContent  = (i + 1) + '/' + full.length;

      try {
        await txChar.writeValue(new TextEncoder().encode(sent + '\n'));
        log('-> ' + sent + (isReturning ? '  return' : '  up'), 'sent');
      } catch (err) {
        log('Send failed: ' + err.message, 'err');
        break;
      }

      if (i < full.length - 1 && !seqAbort) await sleep(delayMs);
    }

    log(seqAbort ? 'Sequence stopped.' : 'Sequence complete!', 'seq');

    elProgressFill.style.width  = '0%';
    elProgressFill.className    = 'ard-progress-fill';
    elProgressLabel.textContent = 'Sequence progress';
    elProgressStep.textContent  = '';
    elSeqProgress.classList.add('hidden');

    seqRunning = false;
    seqAbort   = false;
    setSeqRunning(false);
  }

  return {
    id:    'arduino',
    label: 'Arduino BT Controller',

    init() {
      elDeviceName    = document.getElementById('ard-device-name');
      elBtnTest       = document.getElementById('ard-btn-test');
      elBtnConnect    = document.getElementById('ard-btn-connect');
      elStatusDot     = document.getElementById('ard-status-dot');
      elCompatWarn    = document.getElementById('ard-compat-warn');
      elValueInput    = document.getElementById('ard-value-input');
      elBtnSend       = document.getElementById('ard-btn-send');
      elIncrement     = document.getElementById('ard-increment');
      elMaxValue      = document.getElementById('ard-max-value');
      elThreshold     = document.getElementById('ard-threshold');
      elDelay         = document.getElementById('ard-delay');
      elSeqError      = document.getElementById('ard-seq-error');
      elBtnStart      = document.getElementById('ard-btn-start');
      elSeqProgress   = document.getElementById('ard-seq-progress');
      elProgressFill  = document.getElementById('ard-progress-fill');
      elProgressLabel = document.getElementById('ard-progress-label');
      elProgressStep  = document.getElementById('ard-progress-step');
      elLogBox        = document.getElementById('ard-log-box');
      elBtnClearLog   = document.getElementById('ard-btn-clear-log');

      if (!navigator.bluetooth) {
        elCompatWarn.classList.remove('hidden');
        elBtnConnect.disabled = true;
        elBtnTest.disabled    = true;
        log('Web Bluetooth not available. Use Chrome on desktop or Android.', 'err');
      } else {
        log('Ready. Enter device name and press CONNECT.', 'info');
      }

      elBtnTest.addEventListener('click', testConnection);

      elBtnConnect.addEventListener('click', function () {
        if (btDevice && btDevice.gatt.connected) disconnect();
        else connect();
      });

      elValueInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendValue();
      });
      elBtnSend.addEventListener('click', sendValue);

      elBtnStart.addEventListener('click', function () {
        if (seqRunning) seqAbort = true;
        else runSequence();
      });

      elBtnClearLog.addEventListener('click', function () {
        while (elLogBox.firstChild) elLogBox.removeChild(elLogBox.firstChild);
      });
    },

    mount() {
      // BT connection persists across feature switches — nothing to restore
    },

    unmount() {
      if (seqRunning) seqAbort = true;
    },
  };
})());
```

- [ ] **Step 2: Test all Arduino scenarios in Chrome**

**Switching:**
1. Open side panel, select "Arduino BT Controller" in dropdown — Arduino panel appears
2. Select "Barcode Generator" — barcode panel appears; switch back to Arduino — panel state preserved

**Compat warning (test in non-BT environment):**
3. In a context where `navigator.bluetooth` is undefined, confirm compat warning appears, Connect and Test are disabled

**Sequence validation:**
4. Click START without connecting — button should be disabled (greyed out)
5. Connect, then set increment=10, max=111 — click START — expect error: "Max value must be evenly divisible by increment"
6. Set increment=0, max=100 — click START — expect error: "Increment must be greater than 0"
7. Set increment=10, max=100, threshold=5, delay=3000 — click START — sequence runs, sends 5.00, 15.00, 25.00 ... 105.00 then returns

**Activity log:**
8. Confirm each sent value appears as a blue timestamped entry
9. Received data from Arduino appears in green
10. Click CLEAR — log empties

**BT state persistence:**
11. Connect to device, switch to Barcode feature, switch back to Arduino — confirm still connected (no reconnect needed)

- [ ] **Step 3: Commit**

```bash
git add sidepanel.js
git commit -m "feat: implement Arduino BT Controller feature"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full walkthrough**

1. Both features accessible, switching works in both directions
2. Barcode: QR, barcode formats, history, size slider, PNG download — no regressions
3. Arduino: device name editable, test connection, connect/disconnect, manual send (Enter key + button), sequence with all 4 fields, validation inline, progress bar, log
4. Sequence mid-run: click STOP — sequence halts, button resets, fields re-enable

- [ ] **Step 2: Final commit if any loose ends**

```bash
git add -A
git commit -m "chore: v1.2 multi-feature extension complete"
```
