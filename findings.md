# findings.md — Research, Discoveries & Constraints

## Date: 2026-03-23

---

## Chrome Side Panel API

- Available since **Chrome 114** (released May 2023)
- Declared in manifest: `"permissions": ["sidePanel"]`
- Side panel is registered in background service worker:
  ```js
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  ```
- Side panel HTML is declared in manifest under `"side_panel": { "default_path": "sidepanel.html" }`
- Side panel opens at ~400px wide by default, user can resize
- Side panel persists across tab navigations (unlike popups which close)
- Side panel CANNOT use `alert()`, `confirm()` — use DOM-based modals instead
- Content Security Policy for MV3 forbids `eval()` and inline scripts

---

## Library Research

### JsBarcode
- Repo: github.com/lindell/JsBarcode
- License: MIT
- Supports: CODE128, EAN-13, EAN-8, UPC-A, UPC-E, CODE39, ITF-14, pharmacode, codabar, MSI
- Output: SVG, Canvas, or IMG element
- Usage: `JsBarcode("#barcode", "value", { format: "CODE128" })`
- Bundle size: ~50KB minified
- No external dependencies

### qrcode.js (davidshimjs)
- Repo: github.com/davidshimjs/qrcodejs
- License: MIT
- Output: Canvas or Table (use Canvas for PNG export)
- Usage: `new QRCode(document.getElementById("qrcode"), { text: "value" })`
- Supports error correction: L, M, Q, H
- Bundle size: ~20KB minified
- No external dependencies
- NOTE: davidshimjs/qrcodejs is unmaintained but stable and widely used.
  Alternative: `qrcode` by soldair (Node-first, also has browser build) — may prefer this.

### ZXing-js
- Repo: github.com/zxing-js/library
- License: Apache 2.0
- Supports decode: QR Code, Code 128, EAN-13, EAN-8, UPC-A, Data Matrix, Aztec, PDF417
- Browser UMD bundle: `@zxing/library/umd/index.min.js`
- Usage: `BrowserMultiFormatReader` for live camera decode
- Bundle size: ~350KB minified (heavier — acceptable for local vendor)
- Requires: camera access via `navigator.mediaDevices.getUserMedia`

---

## Constraints Discovered

1. **MV3 CSP:** `script-src 'self'` — all JS must be in local files, no CDN, no inline `<script>` tags with code
2. **Camera permission:** Not declared in `manifest.json` — browser prompts the user automatically via `getUserMedia`. No special manifest permission needed for camera in extensions.
3. **Download as PNG:** Use `<canvas>` to render, then `canvas.toDataURL('image/png')` and trigger an anchor download. For SVG-based JsBarcode output, must first draw SVG to Canvas via `Image` + `drawImage`.
4. **Side panel width:** Typically 400px; UI should be designed for narrow portrait layout.
5. **No `<all_urls>` permission needed** — extension is self-contained, no content scripts injected into pages.

---

## Architecture Decision: QR Library

Chose **qrcode.js (davidshimjs)** over soldair/qrcode because:
- Pure browser, no Node.js build step required
- Simpler API for this use case
- Single minified file drop-in

If maintenance becomes an issue in future, migration path is straightforward.
