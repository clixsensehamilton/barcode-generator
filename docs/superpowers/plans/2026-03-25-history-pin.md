# History & Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session-only, collapsible history list below the controls row that lets the user pin entries and restore any past barcode or QR code with one click.

**Architecture:** All state lives in a single in-memory `history` array in `sidepanel.js`. `addToHistory()` manages eviction and dedup; `renderHistory()` rebuilds the DOM from scratch on every state change. The history section is a `flex-shrink: 0` block appended to `.app` — it sits below the scan window and is reachable via `.app`'s existing `overflow-y: auto` scroll.

**Tech Stack:** Vanilla JS (ES5-compatible, MV3 CSP), inline SVG constants, existing CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-03-25-history-pin-design.md`

> **No test framework exists in this project.** All verification steps are manual — load the extension in Chrome and follow the checklist exactly.

---

### Task 1: Add HTML structure

**Files:**
- Modify: `sidepanel.html` — add `#history-section` block after `.controls-row`

- [ ] **Step 1: Add history section markup**

In `sidepanel.html`, insert the block **inside `.app`**, between the closing `</div>` of `.controls-row` (line 107) and the closing `</div>` of `.app` (line 109). Do not insert after line 109.

```html
    <!-- History -->
    <div class="history-section" id="history-section">
      <div class="history-header" id="history-header">
        <span class="field-label">HISTORY</span>
        <span class="history-count" id="history-count">(0)</span>
        <button class="history-chevron" id="history-chevron" aria-label="Toggle history">&#9660;</button>
      </div>
      <ul class="history-list" id="history-list"></ul>
    </div>
```

- [ ] **Step 2: Verify HTML is valid**

Open `sidepanel.html` in a browser (file://) or load the extension. Confirm:
- No console errors
- The history section header ("HISTORY (0) ▼") is visible below the SIZE slider row
- The list is empty (no items)

- [ ] **Step 3: Commit**

```bash
git add sidepanel.html
git commit -m "feat: add history section HTML skeleton"
```

---

### Task 2: Add CSS styles

**Files:**
- Modify: `sidepanel.css` — append history styles at the end of the file

- [ ] **Step 1: Append history CSS**

At the very end of `sidepanel.css`, add:

```css
/* ── History Section ── */
.history-section {
  flex-shrink: 0;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}

.history-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--c-muted);
}

.history-chevron {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--c-muted);
  font-size: 10px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.history-section.collapsed .history-chevron {
  transform: rotate(-90deg);
}

.history-section.collapsed .history-list {
  display: none;
}

.history-list {
  list-style: none;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  margin-top: 4px;
}

.history-list:empty {
  display: none;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 34px;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: var(--c-raised);
}

.history-pin {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--c-muted);
  cursor: pointer;
  padding: 0;
  border-radius: 4px;
  transition: color 0.15s;
}

.history-pin:hover {
  color: var(--c-text);
}

.history-pin.pinned {
  color: var(--c-accent);
}

.history-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.history-divider {
  height: 0;
  border: none;
  border-top: 1px solid var(--c-border);
  margin: 0;
  padding: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Verify styles render**

Reload the extension. Confirm:
- "HISTORY (0) ▼" header is visible and styled (muted label, muted chevron)
- Clicking the header has no effect yet (JS not wired)
- No layout shift — scan window and controls row are unaffected

- [ ] **Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "feat: add history section CSS"
```

---

### Task 3: JS — constants, data model, addToHistory()

**Files:**
- Modify: `sidepanel.js` — add constants, history array, and addToHistory() function

- [ ] **Step 1: Add SVG pin icon constants**

At the top of `sidepanel.js`, directly after the `'use strict';` line, add:

```js
// ── Pin Icon SVGs (developer-controlled strings, not user data) ──────────
const PIN_ICON_OFF = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1.5L10.5 3.5L7.5 6.5L8 9L6 7L3 10L2 9L5 6L3 4L5.5 4.5L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const PIN_ICON_ON  = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1.5L10.5 3.5L7.5 6.5L8 9L6 7L3 10L2 9L5 6L3 4L5.5 4.5L8.5 1.5Z"/></svg>`;
```

- [ ] **Step 2: Add history state array**

In the `// ── State ──` section (after line 8, `let debounceTimer = null;`), add:

```js
let history = []; // [{ value, mode, format, pinned, ts }]
```

- [ ] **Step 3: Add addToHistory() function**

After the `clearError()` function block (~line 97), add:

```js
// ── History ────────────────────────────────────────────────
const MAX_HISTORY = 10;

function addToHistory(value, mode, format) {
  const existing = history.find(
    e => e.value === value && e.mode === mode && e.format === format
  );

  if (existing) {
    existing.ts = Date.now();
  } else {
    history.push({ value, mode, format, pinned: false, ts: Date.now() });
  }

  // Evict oldest unpinned entries beyond MAX_HISTORY
  const unpinned = history.filter(e => !e.pinned);
  if (unpinned.length > MAX_HISTORY) {
    const oldest = unpinned.reduce((a, b) => (a.ts < b.ts ? a : b));
    history.splice(history.indexOf(oldest), 1);
  }

  renderHistory();
}
```

- [ ] **Step 4: Manual verify — no errors yet**

Reload the extension. Open DevTools console. Confirm no errors on load. The history section still shows `(0)` and is empty (renderHistory not yet defined, but addToHistory isn't called yet so no crash).

- [ ] **Step 5: Commit**

```bash
git add sidepanel.js
git commit -m "feat: add history data model and addToHistory()"
```

---

### Task 4: JS — renderHistory()

**Files:**
- Modify: `sidepanel.js` — add renderHistory() function and DOM refs

- [ ] **Step 1: Add history DOM refs**

In the `// ── DOM Refs ──` section, after the `dlBtn` line (~line 54), add:

```js
const historySection = document.getElementById('history-section');
const historyHeader  = document.getElementById('history-header');
const historyCount   = document.getElementById('history-count');
const historyList    = document.getElementById('history-list');
```

- [ ] **Step 2: Add renderHistory() function**

Directly after `addToHistory()`, add:

```js
function renderHistory() {
  historyCount.textContent = '(' + history.length + ')';
  historyList.innerHTML = '';

  const pinned   = history.filter(e =>  e.pinned).sort((a, b) => b.ts - a.ts);
  const unpinned = history.filter(e => !e.pinned).sort((a, b) => b.ts - a.ts);

  pinned.forEach(entry => historyList.appendChild(makeHistoryItem(entry)));

  if (pinned.length > 0 && unpinned.length > 0) {
    const div = document.createElement('li');
    div.className = 'history-divider';
    historyList.appendChild(div);
  }

  unpinned.forEach(entry => historyList.appendChild(makeHistoryItem(entry)));
}

function makeHistoryItem(entry) {
  const li = document.createElement('li');
  li.className = 'history-item';

  // Pin button
  const pin = document.createElement('button');
  pin.className = 'history-pin' + (entry.pinned ? ' pinned' : '');
  pin.setAttribute('aria-label', entry.pinned ? 'Unpin' : 'Pin');
  pin.innerHTML = entry.pinned ? PIN_ICON_ON : PIN_ICON_OFF;
  pin.addEventListener('click', function (e) {
    e.stopPropagation();
    entry.pinned = !entry.pinned;
    renderHistory();
  });

  // Value text
  const span = document.createElement('span');
  span.className = 'history-value';
  span.textContent = entry.value;

  span.addEventListener('click', function () {
    restoreFromHistory(entry);
  });

  li.appendChild(pin);
  li.appendChild(span);
  return li;
}
```

- [ ] **Step 3: Verify render works**

Open DevTools console and run:
```js
addToHistory('https://example.com', 'qr', 'CODE128');
addToHistory('HELLO-WORLD', 'barcode', 'CODE39');
```
Confirm:
- Two rows appear in the history list
- Count badge updates to `(2)`
- Values are truncated correctly if long
- Pin icon is outline (unpinned) on both rows

- [ ] **Step 4: Verify pin toggle**

Click a pin icon. Confirm:
- Icon turns filled cyan (pinned)
- Click again — icon returns to outline muted (unpinned)

- [ ] **Step 5: Commit**

```bash
git add sidepanel.js
git commit -m "feat: add renderHistory() and makeHistoryItem()"
```

---

### Task 5: JS — restore handler, collapse toggle, wire into generate()

**Files:**
- Modify: `sidepanel.js` — add restoreFromHistory(), collapse toggle, call addToHistory() in generate()

- [ ] **Step 1: Add restoreFromHistory() function**

After `makeHistoryItem()`, add:

```js
function restoreFromHistory(entry) {
  // Update mode state and UI directly (do NOT call setMode — it calls clearOutput)
  currentMode = entry.mode;
  btnQr.classList.toggle('active', entry.mode === 'qr');
  btnQr.setAttribute('aria-pressed', String(entry.mode === 'qr'));
  btnBarcode.classList.toggle('active', entry.mode === 'barcode');
  btnBarcode.setAttribute('aria-pressed', String(entry.mode === 'barcode'));
  toggleThumb.classList.toggle('right', entry.mode === 'barcode');
  formatRow.classList.toggle('hidden', entry.mode === 'qr');

  if (entry.mode === 'barcode') {
    currentFormat = entry.format;
    formatSelect.value = entry.format;
  }

  valueInput.value = entry.value;
  valueInput.placeholder = PLACEHOLDERS[entry.mode === 'qr' ? 'QR' : entry.format];

  clearError();
  generate();
}
```

- [ ] **Step 2: Add collapse toggle**

After the event listeners block, before `// ── Init ──`, add:

```js
historyHeader.addEventListener('click', function () {
  historySection.classList.toggle('collapsed');
});
```

- [ ] **Step 3: Wire addToHistory() into generate()**

In the `generate()` function, find the `showOutput()` call (~line 137). Replace:

```js
    showOutput();
```

with:

```js
    showOutput();
    addToHistory(value, currentMode, currentFormat);
```

- [ ] **Step 4: Verify full flow**

Reload the extension. Run through these checks:

**Basic add:**
- Type `https://test.com` → press Enter → confirm row appears in history
- Type `HELLO` in CODE39 mode → press Enter → confirm second row appears
- Count badge shows `(2)`

**Restore:**
- Click the value text of the first history row
- Confirm: input is populated, correct mode/format is set, barcode/QR re-generates

**Duplicate dedup:**
- Generate the same value again
- Confirm only one entry exists, count stays the same, entry moves to top

**Pinning:**
- Pin an item → confirm it floats above the divider
- Unpin → confirm it returns to unpinned section

**Collapse:**
- Click the "HISTORY" header → list collapses, chevron rotates
- Click again → list expands

**Eviction (10-item cap):**
In DevTools console, run:
```js
for (let i = 1; i <= 12; i++) addToHistory('item-' + i, 'qr', 'CODE128');
```
Confirm only 10 unpinned items are shown (item-3 through item-12; item-1 and item-2 evicted).

**Pin survives eviction:**
```js
history = [];
addToHistory('pinned-forever', 'qr', 'CODE128');
history[0].pinned = true;
renderHistory();
for (let i = 1; i <= 11; i++) addToHistory('item-' + i, 'qr', 'CODE128');
```
Confirm `pinned-forever` is still present in the pinned section, and only 10 unpinned items exist.

- [ ] **Step 5: Commit**

```bash
git add sidepanel.js
git commit -m "feat: wire history restore, collapse toggle, and generate() integration"
```

---

### Task 6: Final polish and version bump

**Files:**
- Modify: `sidepanel.html` — bump version tag from `v1.0` to `v1.1`

- [ ] **Step 1: Bump version tag**

In `sidepanel.html` line 25, change:
```html
<span class="version-tag">v1.0</span>
```
to:
```html
<span class="version-tag">v1.1</span>
```

- [ ] **Step 2: Final end-to-end verification**

Load the packed extension in Chrome (`chrome://extensions` → Load unpacked). Run through:
- [ ] Generate a QR code → appears in history
- [ ] Generate a barcode (CODE128) → appears in history
- [ ] Pin the QR entry → floats to top with cyan icon
- [ ] Click the barcode history row → restores value, switches to barcode mode, regenerates
- [ ] Click the QR history row → restores value, switches to QR mode, regenerates
- [ ] Collapse history → list hidden, chevron rotated
- [ ] Expand history → list visible again
- [ ] Download PNG → still works (history doesn't break download)
- [ ] No console errors throughout

- [ ] **Step 3: Commit**

```bash
git add sidepanel.html
git commit -m "chore: bump version to v1.1 (history & pin feature)"
```
