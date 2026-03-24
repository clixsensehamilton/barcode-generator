# History & Pin Feature — Design Spec
**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Add a session-only history list below the controls row in the side panel. Users can pin entries to keep them permanently visible and quickly restore any past barcode or QR code with a single click.

---

## Constraints

- **No persistence.** History is in-memory only. It resets when the panel reloads or Chrome restarts. This is required by the project's hard rule against any data storage (`localStorage`, `chrome.storage`, cookies, etc.).
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

---

## Components

### History Section (`#history-section`)

- A `<div>` wrapping a header row and the collapsible list.
- Sits directly after `.controls-row` in `sidepanel.html`.

### Header Row

- Left: `HISTORY` label in `field-label` style + item count badge `(n)` in muted color.
- Right: chevron `▾` / `▸` button — clicking toggles collapse.
- Chevron rotates 90° (CSS transition) when collapsed.

### History List (`#history-list`)

- `<ul>` with `max-height: ~180px`, `overflow-y: auto`, hidden scrollbar until hover.
- Collapsed via `display: none` (toggled by `.collapsed` class on `#history-section`).

### History Item (`<li>`)

Each row contains two zones:

| Zone | Width | Behaviour |
|---|---|---|
| Pin icon | 24px, fixed | Click → toggle pinned state |
| Value text | flex: 1 | Click → restore + regenerate; truncated with ellipsis |

**Pin icon states:**

- **Unpinned:** outline thumbtack SVG, color `var(--c-muted)` (`#505050`)
- **Pinned:** filled thumbtack SVG, color `var(--c-accent)` (`#00D4FF`)

No labels, no tooltips — icon color/fill communicates state.

### Section Divider

A single `<li class="history-divider">` rendered as `border-top: 1px solid var(--c-border)` with no height/padding, inserted between the last pinned item and the first unpinned item when both groups are non-empty.

---

## Data Model

```js
// In-memory array in sidepanel.js
let history = [];

// Entry shape
{
  value:   string,          // the barcode/QR value
  mode:    'qr'|'barcode',  // output type at time of generation
  format:  string,          // e.g. 'CODE128', 'EAN13' — ignored when mode is 'qr'
  pinned:  boolean,
  ts:      number,          // Date.now() — used for ordering and eviction
}
```

---

## Behaviour Rules

### Adding to History

- Triggered on every **successful** `generate()` call.
- **Duplicate check:** if an entry with the same `value` + `mode` + `format` already exists, move it to the top of the unpinned section (update `ts`) rather than inserting a duplicate. If it was pinned, leave it pinned and update `ts`.
- New entries are always added as **unpinned**.

### Eviction

- Only unpinned items are subject to eviction.
- Cap: **10 unpinned items** maximum.
- When a new unpinned item would exceed the cap, remove the unpinned item with the oldest `ts`.
- Pinned items are never evicted.

### Ordering

Render order within each group: **newest first** (highest `ts` at top).

### Restoring an Entry

Clicking the value text of a history item:
1. Sets `currentMode` to entry's `mode` and updates the toggle UI.
2. Sets `currentFormat` to entry's `format` and updates the select UI (ignored for QR).
3. Sets `valueInput.value` to entry's `value`.
4. Calls `generate()` immediately.

### Pinning / Unpinning

Clicking the pin icon:
1. Toggles `entry.pinned`.
2. Re-renders the list.
3. No re-generation triggered.

### Collapse / Expand

- Default state: **expanded**.
- Toggled by clicking anywhere on the header row.
- State is in-memory only (resets on reload).

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
| `sidepanel.js` | Add `history` array, `addToHistory`, `renderHistory`, pin toggle, restore, collapse logic |

No new files. No new libraries. No manifest changes.
