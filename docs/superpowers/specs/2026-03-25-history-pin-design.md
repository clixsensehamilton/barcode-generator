# History & Pin Feature — Design Spec
**Date:** 2026-03-25
**Status:** Draft

---

## Overview

Add a session-only history list below the controls row in the side panel. Users can pin entries to keep them permanently visible and quickly restore any past barcode or QR code with a single click.

---

## Constraints

- **No persistence.** History is in-memory only. It resets when the panel reloads or Chrome restarts. This is required by the project's hard rule against any data storage (`localStorage`, `chrome.storage`, cookies, etc.).
- **No `innerHTML` with user data.** The value text in list items must be set via `textContent`, never `innerHTML`. Hard-coded developer-controlled SVG strings (the pin icon markup) may be set via `innerHTML` on the icon button since they are not user-supplied.
- **No CDN / no new libraries.** Pin icons must be inline SVG strings defined as JS constants in `sidepanel.js`. Do not load icon fonts or external icon libraries.
- **Format token naming.** `format` values must match what the `<select>` element emits in `sidepanel.html`: `CODE128`, `EAN13`, `EAN8`, `UPCA`, `CODE39`. Note: `gemini.md` schema uses hyphenated forms (`EAN-13`) but the actual code uses the hyphen-free tokens — implementation must use the code tokens. `ITF14` is listed in `gemini.md` but has no `<option>` in the current select; it is out of scope for this feature.
- **Mode token naming.** `mode` values stored in history entries are `'qr'` and `'barcode'` — matching `currentMode` in `sidepanel.js`. Note: `gemini.md`'s Input Payload schema uses `"qrcode"` for this value; the code and this spec use `'qr'`.
- No new permissions required.
- No new libraries required.

---

## UI Layout

```
[ controls-row: SIZE slider + ↓ PNG ]
──────────────────────────────────────
[ HISTORY  (3) ▾ ]           ← header row, always visible
┌─────────────────────────────────────┐
│ 📌 https://pinned-item.com          │  ← pinned section
│ ─────────────────────────────────── │  ← divider (only when both sections exist)
│ 📍 https://recent-item.com          │  ← unpinned recent items
│ 📍 HELLO-WORLD                      │
└─────────────────────────────────────┘  ← scrollable, max-height ~180px
```

The `#history-section` is a `flex-shrink: 0` block appended after `.controls-row` inside `.app`. Because `.app` already has `overflow-y: auto`, the history section is naturally reachable by scrolling the panel — no layout restructuring required. The scan window (`flex: 1`) retains its flexible height above; the history section does not compress it.

---

## Components

### History Section (`#history-section`)

- A `<div>` wrapping a header row and the collapsible list.
- Sits directly after `.controls-row` in `sidepanel.html`.
- `flex-shrink: 0` so it does not compress the scan window.

### Header Row

- Left: `HISTORY` label in `field-label` style + item count badge `(n)` in muted color.
- Right: chevron `▾` / `▸` button — clicking toggles collapse.
- Chevron rotates 90° (CSS transition) when collapsed.
- Clicking anywhere on the header row toggles collapse.

### History List (`#history-list`)

- `<ul>` with `max-height: ~180px`, `overflow-y: auto`, hidden scrollbar until hover.
- Collapsed via `display: none` (toggled by `.collapsed` class on `#history-section`).

### History Item (`<li>`)

Each row contains two zones:

| Zone | Width | Behaviour |
|---|---|---|
| Pin icon button | 24px, fixed | Click → toggle pinned state |
| Value text span | flex: 1 | Click → restore + regenerate; truncated with ellipsis |

**Pin icon states:**

- **Unpinned:** outline thumbtack SVG, color `var(--c-muted)` (`#505050`)
- **Pinned:** filled thumbtack SVG, color `var(--c-accent)` (`#00D4FF`)

Pin icons are defined as two hard-coded SVG string constants in `sidepanel.js` and set on the button via `innerHTML` (safe: not user-supplied data). Example:

```js
const PIN_ICON_OFF = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" ...>...</svg>`;
const PIN_ICON_ON  = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" ...>...</svg>`;
```

No labels, no tooltips — icon color/fill communicates state.

### Section Divider

A single `<li class="history-divider">` rendered as `border-top: 1px solid var(--c-border)` with no height/padding, inserted between the last pinned item and the first unpinned item when both groups are non-empty.

---

## Data Model

```js
// In-memory array in sidepanel.js
let history = [];

// Entry shape
// mode: matches currentMode values ('qr'|'barcode'), NOT gemini.md schema ("qrcode")
// format: matches <select> option values (CODE128|EAN13|EAN8|UPCA|CODE39), NOT gemini.md schema strings
{
  value:   string,          // the barcode/QR value
  mode:    'qr'|'barcode',  // output type at time of generation
  format:  string,          // 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'CODE39'; ignored when mode='qr'
  pinned:  boolean,
  ts:      number,          // Date.now() — used for ordering and eviction
}
```

---

## Behaviour Rules

### Adding to History

- Triggered on every **successful** `generate()` call — including calls triggered by restoring a history item (see Restore interaction below).
- **Duplicate check:** if an entry with the same `value` + `mode` + `format` already exists:
  - Update its `ts` to `Date.now()`.
  - If it was **unpinned**, it moves to the top of the unpinned section (newest-first ordering).
  - If it was **pinned**, it stays pinned and moves to the top of the pinned section (newest-first ordering).
  - Do not insert a second entry.
- New entries are always added as **unpinned**.

### Eviction

- Only unpinned items are subject to eviction.
- Cap: **10 unpinned items** maximum.
- When a new unpinned item would exceed the cap, remove the unpinned item with the oldest `ts`.
- Pinned items are never evicted.

### Ordering

Render order within each group: **newest first** (highest `ts` at top). This applies to both pinned and unpinned sections.

### Restoring an Entry

Clicking the value text of a history item:

1. **Do NOT call `setMode()`** — `setMode()` calls `clearOutput()` which would erase the display before `generate()` runs. Instead, update state and DOM directly:
   - Set `currentMode = entry.mode`
   - Toggle button classes and `aria-pressed` on `#btn-qr` / `#btn-barcode`
   - Toggle `.right` class on `#toggle-thumb`
   - Show/hide `#format-row`
2. If `entry.mode === 'barcode'`: set `currentFormat = entry.format` and `formatSelect.value = entry.format`.
3. Set `valueInput.value = entry.value`.
4. Update `valueInput.placeholder` via `PLACEHOLDERS[...]`.
5. Call `generate()` — unconditionally, even if the displayed output already matches. Do not short-circuit. (`generate()` clears `outputArea` and re-renders; the brief re-render is acceptable.)
6. `generate()` on success calls `addToHistory()`, which hits the duplicate check and updates `ts`. This is intentional — restore counts as a fresh use.

### Pinning / Unpinning

Clicking the pin icon button:
1. Toggles `entry.pinned`.
2. Calls `renderHistory()` to rebuild the list using DOM APIs.
3. No re-generation triggered.

### Collapse / Expand

- Default state: **expanded**.
- Toggled by clicking anywhere on the header row.
- State is in-memory only (resets on reload).

### Empty State

- When `history` is empty, `#history-list` renders no items. The header row remains visible with count `(0)`.
- No empty-state placeholder text required.

---

## Styling Notes

- Matches the existing dark terminal theme (`--c-bg`, `--c-surface`, `--c-raised`, `--c-border`, `--c-accent`, `--c-muted`).
- History items use `font-family: var(--font-mono)` for the value text, consistent with the input field.
- Row height: ~34px. Hover state: `background: var(--c-raised)`.
- Item count badge: `font-family: var(--font-mono)`, `font-size: 10px`, `color: var(--c-muted)`.

---

## Files Changed

| File | Change |
|---|---|
| `sidepanel.html` | Add `#history-section` block after `.controls-row` |
| `sidepanel.css` | Add history section, list, item, pin icon, divider, collapse styles |
| `sidepanel.js` | Add `history` array, `addToHistory`, `renderHistory`, pin toggle, restore, collapse logic; add `PIN_ICON_OFF` / `PIN_ICON_ON` SVG constants |

No new files. No new libraries. No manifest changes.
