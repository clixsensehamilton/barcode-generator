# CLAUDE.md — Barcode Generator Chrome Extension

## Project Overview

A Chrome Extension (Manifest V3) that opens as a Side Panel and generates QR codes and barcodes client-side. The user types a value, selects a format, and a physical barcode scanner reads the rendered code off the screen. No backend. No camera. No data collection.

## Protocol

This project follows the **B.L.A.S.T.** protocol. The Project Constitution is in `gemini.md` — it is law. Read it before making any changes. Update it when schemas, rules, or architecture change.

- `gemini.md` — Project Constitution (schemas, rules, architecture)
- `task_plan.md` — Phases and checklists
- `findings.md` — Research and discovered constraints
- `progress.md` — Work log, errors, completed steps

## Architecture

```
barcode-generator/
├── manifest.json       # MV3, sidePanel permission
├── background.js       # Service worker — opens side panel on action click
├── sidepanel.html      # Side panel UI
├── sidepanel.css       # Styles
├── sidepanel.js        # All UI logic
├── icons/              # 16, 48, 128px PNG icons
└── libs/
    ├── jsbarcode.min.js
    └── qrcode.min.js
```

## Approved Libraries

| Library | Purpose | License |
|---|---|---|
| JsBarcode | Barcode generation | MIT |
| qrcode.js (davidshimjs) | QR code generation | MIT |

All libraries are **vendored locally** in `libs/`. Never load from a CDN at runtime.

## Hard Rules

- **No network requests at runtime** — extension is fully offline after install
- **No data storage** — never write to `localStorage`, `chrome.storage`, cookies, or any persistence layer
- **No camera** — `getUserMedia` is not used; scanning is done by a physical USB/BT HID scanner
- **No `eval()`** — MV3 CSP forbids it; do not use it
- **No unsanitized `innerHTML`** — use `textContent` or DOM APIs
- **No CDN** — all JS must be in `libs/`
- **Permissions:** `sidePanel` only — do not add permissions without updating `gemini.md` first

## Supported Barcode Formats

CODE128, EAN-13, EAN-8, UPC-A, CODE39, ITF-14, QR Code (error correction level H)

## Chrome Extension Constraints

- Manifest V3 only
- Side Panel API requires Chrome 114+
- CSP: `script-src 'self'; object-src 'self'`
- Service worker (`background.js`) must call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`

## Before Making Changes

1. Read `gemini.md` to confirm the current schema and rules
2. If a schema or rule changes, update `gemini.md` first, then update code
3. Log completed work and any errors in `progress.md`
4. Log new discoveries or constraints in `findings.md`

## Mandatory Skill Invocations

Before writing ANY code or documentation, invoke these skills in order:
1. `superpowers:using-superpowers` — project management and workflow
2. `claude-md-management:revise-claude-md` — after any session with learnings
3. `frontend-design:frontend-design` — before any UI work
4. `feature-dev:feature-dev` — before implementing any feature

## Phase Gate

No code in `libs/`, `sidepanel.*`, `background.js`, or `manifest.json` until:
- Phase 2 (Link) is complete: JsBarcode and qrcode.js are vendored in `libs/`
- Both libraries verified to load and render in a browser context

## Key Scope Decisions (Do Not Revert)

- **No camera / no ZXing** — scan feature was explicitly removed; do not re-add
- **Physical scanner workflow** — side panel stays open so a USB/BT HID barcode
  scanner can read the generated code off the screen
- **Side panel over popup** — popup closes on blur; side panel persists — this
  is the core UX reason for the side panel choice
