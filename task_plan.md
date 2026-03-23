# task_plan.md — Blueprint & Phase Checklist

## Project: Barcode & QR Code Chrome Extension

---

## Phase 1: B — Blueprint (COMPLETE)
- [x] 5 Discovery Questions answered
- [x] Scope clarified: pure generator, no camera, physical scanner workflow
- [x] Project Constitution (gemini.md) written and updated
- [x] Data schema defined
- [x] Architecture defined
- [x] Library selection finalized (JsBarcode + qrcode.js only)

---

## Phase 2: L — Link (Connectivity)
- [ ] Download JsBarcode minified bundle → `libs/jsbarcode.min.js`
- [ ] Download qrcode.js minified bundle → `libs/qrcode.min.js`
- [ ] Verify both libraries load and render correctly

---

## Phase 3: A — Architect (3-Layer Build)
- [ ] `manifest.json` — MV3, sidePanel permission, icons, background, side_panel path
- [ ] `background.js` — service worker, setPanelBehavior openPanelOnActionClick
- [ ] `sidepanel.html` — UI structure
  - [ ] Text input for value
  - [ ] Type selector: QR Code / Barcode toggle
  - [ ] Format dropdown (shown only when Barcode selected)
  - [ ] Generate button
  - [ ] Output display area (large, clear for physical scanning)
  - [ ] Download PNG button
  - [ ] Error message area
- [ ] `sidepanel.css` — clean, minimal, ~400px wide layout
- [ ] `sidepanel.js` — all logic
  - [ ] Toggle between QR / Barcode mode
  - [ ] Show/hide format selector based on mode
  - [ ] Generate QR code via qrcode.js
  - [ ] Generate barcode via JsBarcode
  - [ ] Validate input per format (e.g. EAN-13 must be 13 digits)
  - [ ] Render output large and centered
  - [ ] Download PNG via canvas export
  - [ ] Clear/reset button
- [ ] `icons/` — create 3 icon sizes (16, 48, 128px)

---

## Phase 4: S — Stylize (UI/UX)
- [ ] High-contrast output area (white background, black barcode — optimal for scanning)
- [ ] Large clear display of generated code
- [ ] Smooth toggle between QR and Barcode mode
- [ ] Inline validation errors (no popups/alerts)
- [ ] Download button only shown after successful generation

---

## Phase 5: T — Trigger (Deployment)
- [ ] Load unpacked in Chrome — full integration test
- [ ] Test CODE128 generation and physical scan
- [ ] Test QR code generation and physical scan
- [ ] Test EAN-13 validation (rejects wrong length)
- [ ] Test download PNG
- [ ] Final README with load instructions

---

## Approved Blueprint
- Architecture: Chrome MV3 Side Panel extension
- Libraries: JsBarcode + qrcode.js (vendored locally)
- No backend. No network. No storage. No camera.
- Physical scanner reads the generated code off the screen
- Status: APPROVED
