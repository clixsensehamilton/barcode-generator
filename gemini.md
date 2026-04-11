# gemini.md — Project Constitution
# Barcode & QR Code Chrome Extension
# This file is LAW. Do not modify unless a schema, rule, or architecture changes.

---

## 1. Project Identity

- **Name:** Barcode Generator Chrome Extension
- **Type:** Chrome Extension (Manifest V3) — Side Panel
- **Runtime:** 100% client-side. No backend. No network calls. No data storage of any kind.
- **Privacy Contract:** Zero data collection. Zero telemetry. No external requests after install.

---

## 2. Functional Scope

### Feature: Generate
- User types or pastes a value (text, URL, number) into an input field
- User selects output type: QR Code or Barcode
- User selects barcode format (when Barcode is selected): CODE128, EAN-13, EAN-8, UPC-A, CODE39, ITF-14
- Extension renders the barcode/QR code in the side panel
- The side panel stays open persistently so the user can aim a physical barcode scanner at the screen
- User can download the output as PNG

### Physical Scan Workflow
- The generated barcode/QR code is displayed large and clear in the side panel
- The user uses an external physical barcode scanner (USB or Bluetooth HID device)
- The scanner reads the code off the screen and outputs the decoded text into whatever input field is focused in the browser or OS
- The side panel does NOT close when the user clicks elsewhere — this is the core UX benefit

### Feature: Arduino BT Controller
- User selects "Arduino BT Controller" from the feature dropdown
- User enters a Bluetooth device name (default: ESP32_WS) and can test the connection
- User connects to an ESP32 via Web Bluetooth (Nordic UART Service)
- Manual send: user types a value and sends it as plain text over BLE
- Sequence mode: user sets Increment, Max Value, Threshold, and Delay (ms)
  - Steps: [0, inc, 2*inc, ... max] forward then reverse
  - Each value sent = step + threshold; validates max % increment === 0 before running
- Activity log shows timestamped sent/received/error entries (DOM API only)

### NOT in scope
- Camera scanning (no getUserMedia)
- Decoding/reading barcodes via software
- Any network requests
- Any data storage

---

## 3. Data Schema

### Input Payload
```json
{
  "type": "qrcode" | "barcode",
  "barcodeFormat": "CODE128" | "EAN13" | "EAN8" | "UPCA" | "CODE39" | "ITF14",
  "value": "string",
  "options": {
    "qr": {
      "width": 256,
      "height": 256,
      "colorDark": "#000000",
      "colorLight": "#ffffff",
      "correctLevel": "H"
    },
    "barcode": {
      "width": 2,
      "height": 100,
      "displayValue": true,
      "background": "#ffffff",
      "lineColor": "#000000",
      "fontSize": 14
    }
  }
}
```

### Output Payload
```json
{
  "status": "ok" | "error",
  "renderedElement": "SVG | Canvas in DOM",
  "errorMessage": "string | null"
}
```

---

## 4. Architecture

```
barcode-generator/
├── manifest.json          # MV3 manifest — sidePanel permission
├── background.js          # Service worker — opens side panel on action click
├── sidepanel.html         # Side panel UI
├── sidepanel.css          # Styles
├── sidepanel.js           # All UI logic — shell (feature registry) + barcode feature + arduino feature
├── icons/                 # 16, 48, 128px PNG icons
├── libs/
│   ├── jsbarcode.min.js   # Barcode generation (JsBarcode — MIT)
│   └── qrcode.min.js      # QR code generation (qrcode.js — MIT)
├── docs/
│   └── arduino/
│       └── ESP32_ScaleCheck.html   # Reference only — not loaded at runtime
├── gemini.md
├── task_plan.md
├── findings.md
└── progress.md
```

---

## 5. Approved Libraries (Open Source, Client-Side Only)

| Purpose | Library | License | Source |
|---|---|---|---|
| Barcode generation | JsBarcode | MIT | github.com/lindell/JsBarcode |
| QR code generation | qrcode.js (davidshimjs) | MIT | github.com/davidshimjs/qrcodejs |

All libraries must be **vendored locally** in `libs/`. No CDN calls at runtime.

ZXing-js is NOT used — no camera/scan feature.

---

## 6. Behavioral Rules (DO / DO NOT)

### DO
- Render everything inside the Chrome Side Panel (`chrome.sidePanel`)
- Vendor all JS dependencies locally — no external fetches
- Display generated barcode/QR code large and clearly for physical scanner use
- Allow download of generated barcode/QR as PNG
- Gracefully handle invalid input with a user-friendly inline error message
- Support barcode formats: CODE128, EAN-13, EAN-8, UPC-A, CODE39, ITF-14
- Support QR code with error correction level H (highest) by default
- Keep the side panel open persistently (this is by default with sidePanel API)
- Support multiple features via a dropdown selector
- Use feature registry pattern: { id, label, init(), mount(), unmount() }
- Use system fonts only (no CDN, no bundled font files)

### DO NOT
- Make any network requests at runtime
- Store, log, or transmit user input anywhere
- Use `eval()` or `innerHTML` with unsanitized input (use DOM APIs or textContent)
- Use remote CDN for any library
- Implement any camera or scanning functionality
- Request permissions beyond: `sidePanel`

---

## 7. Chrome Extension Constraints

- **Manifest Version:** 3 (MV3)
- **Side Panel API:** Requires Chrome 114+
- **Required Permissions:** `sidePanel`, `bluetooth`
- **CSP:** `script-src 'self'; object-src 'self'` — no inline scripts, no eval
- **Service Worker:** `background.js` calls `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`

---

## 8. Maintenance Log

| Date | Change | Reason |
|---|---|---|
| 2026-03-23 | Initial constitution created | Project kickoff |
| 2026-03-23 | Removed scan/camera feature; ZXing dropped | User clarified: physical scanner only, no camera needed |
| 2026-04-11 | Added multi-feature shell + Arduino BT Controller | User request |
| 2026-04-11 | Added bluetooth permission | Required for Web Bluetooth API (Arduino feature) |
