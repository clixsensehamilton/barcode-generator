# Multi-Feature Extension Design
**Date:** 2026-04-11
**Status:** Approved

---

## Overview

Expand the Barcode Generator Chrome Extension from a single-purpose tool into a multi-feature side panel. Features are selected via a dropdown at the top of the panel. The first new feature is an Arduino Bluetooth Controller ported from `docs/arduino/ESP32_ScaleCheck.html`.

---

## 1. Architecture

### Feature Registry Pattern

`sidepanel.js` is reorganized into clearly separated sections using a feature registry:

```
sidepanel.js
  ├── FEATURES registry  — array of { id, label, init, mount, unmount }
  ├── Shell logic        — dropdown rendering, feature switching, startup
  ├── Feature: barcode   — all existing QR/barcode generation logic (unchanged behavior)
  └── Feature: arduino   — all BT connection, manual send, sequence logic
```

Each feature object exposes three lifecycle hooks:
- `init()` — called once at `DOMContentLoaded` for **all** features regardless of which is active; sets up event listeners. Must be idempotent (safe to call once, never twice).
- `mount()` — called when the feature becomes active (on load for the default feature, or on dropdown change). Restores focus/state.
- `unmount()` — called when switching away. For Arduino: aborts any running sequence. Does **not** disconnect an active BT session — the connection persists in the background so the user can switch back to the Arduino feature and continue. If the page is closed, the browser handles BT cleanup.

### File Changes

| File | Change |
|---|---|
| `sidepanel.html` | Add feature dropdown to header; wrap barcode UI in `<section id="feature-barcode">`; add new `<section id="feature-arduino">` |
| `sidepanel.css` | Add styles for feature dropdown and Arduino section; system fonts only |
| `sidepanel.js` | Reorganize into registry pattern; add Arduino feature module |
| `manifest.json` | Add `bluetooth` permission |
| `gemini.md` | Update to reflect new architecture, new permission, new feature scope |

No new files are created. No libraries are added.

---

## 2. Shell & Navigation

- The `BARCODEGEN` logo/header remains as-is
- A `<select>` dropdown sits below the header with options:
  - `BARCODE GENERATOR`
  - `ARDUINO BT CONTROLLER`
- On change:
  1. Call `unmount()` on the currently active feature
  2. Hide current feature `<section>`
  3. Show selected feature `<section>`
  4. Call `mount()` on the new feature
- Default feature on load: `BARCODE GENERATOR` (preserves existing UX)

---

## 3. Arduino BT Controller Feature

### 3.1 Device Configuration

- **Device name field:** Editable text input, default value `ESP32_WS`. The current value is read at connection time (both Test and Connect). Changing the field does not update any button text dynamically.
- **Test Connection button:** Attempts a full Web Bluetooth connect using the current device name field value. On success: logs "Connected to [name]" then immediately disconnects and logs "Test complete — disconnected". On failure: logs the error. Does not change the main connected state. Disabled while a full session is active.

### 3.2 Connection

- **Connect / Disconnect button:** Full BT session toggle
- **Status indicator:** Dot in the header area — grey (disconnected), green pulsing (connected), red (error)
- Uses Nordic UART Service (NUS):
  - Service UUID: `6e400001-b5b4-f393-e0a9-e50e24dcca9e`
  - TX characteristic: `6e400002-b5b4-f393-e0a9-e50e24dcca9e`
  - RX characteristic: `6e400003-b5b4-f393-e0a9-e50e24dcca9e`
- On unexpected disconnect: abort any running sequence, update UI state to disconnected, log error
- After any error or disconnect, the Connect button is re-enabled so the user can retry immediately — no reload required
- If `navigator.bluetooth` is unavailable (non-Chrome or flag disabled): show an inline compatibility warning, disable Connect and Test buttons. This is checked once on `init()`.

### 3.3 Manual Send

- Plain text input field + **SEND** button
- Enter key triggers send
- Disabled when not connected
- Sends value as UTF-8 text with `\n` appended
- Logs sent value to activity log

### 3.4 Sequence Mode

**Fields (all editable):**

| Field | Type | Default | Notes |
|---|---|---|---|
| Increment | number | 10 | Step size; must be > 0 |
| Max Value | number | 100 | Sequence ceiling; must be > 0 |
| Threshold | number | 0 | Added to each step value before sending; may be negative |
| Delay (ms) | number | 3000 | Wait between steps; 0 is allowed (no pacing) |

**Validation (on START):**
- `increment` must be > 0 (prevents infinite loop)
- `max` must be > 0
- `max % increment === 0` — if not, show an inline error message below the sequence fields ("Max value must be evenly divisible by increment") and block run
- `delay` must be >= 0; if `delay=0`, steps are dispatched via `setTimeout(fn, 0)` to keep the UI responsive
- Must be connected
- Threshold may be any number including negative; no validation — the Arduino receives whatever value is sent

**On unexpected disconnect mid-sequence:** sequence is aborted, Connect button re-enabled, user must manually reconnect. No automatic reconnect.

**Sequence execution:**
- Build forward steps: `[0, increment, 2*increment, ... max]`
- Build reverse steps: `[max - increment, ..., 0]` (excludes repeated max)
- Full sequence: `[...forward, ...reverse]`
- Each value sent: `step + threshold`
- Delay applied between steps (skipped after the final step)
- Abortable at any point via STOP button

**Progress:**
- Progress bar showing `(current step / total steps) * 100%`
- Step counter label: `N/total`
- Direction label: "Going up..." / "Returning..."
- Bar color: green (forward), blue (returning)

**START / STOP button:**
- START: begins sequence, button becomes STOP
- STOP: sets abort flag, sequence halts after current step completes

### 3.5 Activity Log

- Timestamped entries with color-coded types: `sent` (blue), `recv` (green), `info` (muted italic), `err` (red), `seq` (purple)
- Fixed height with scroll
- CLEAR button
- All log entries built via DOM APIs (`createElement`, `textContent`) — no `innerHTML` anywhere in the Arduino feature, including the log function. The original HTML's `innerHTML + escHtml()` pattern is replaced entirely.

### 3.6 Font Rule

All fonts use system stacks only:
- Monospace: `ui-monospace, 'Cascadia Code', 'Courier New', monospace`
- Sans-serif: `system-ui, -apple-system, sans-serif`

No CDN font loads. No bundled font files. Extension remains fully offline.

---

## 4. Manifest Changes

```json
"permissions": ["sidePanel", "bluetooth"]
```

The `bluetooth` permission is required for `navigator.bluetooth.requestDevice()`.

A compatibility warning is shown in the Arduino panel if `navigator.bluetooth` is not available (e.g., non-Chrome browser).

---

## 5. Constraints & Rules (No Changes)

All existing hard rules from `gemini.md` remain in effect:
- No network requests at runtime
- No data storage
- Dynamic code execution is forbidden (MV3 CSP)
- All DOM output uses textContent or safe DOM APIs only
- No CDN libraries

The Arduino feature adds one new runtime API (`navigator.bluetooth`) which operates entirely client-side and sends no data off-device.

---

## 6. Out of Scope

- Saving device name or sequence settings across sessions (no storage rule)
- More than 2 features in this iteration
- Any changes to barcode/QR generation logic
