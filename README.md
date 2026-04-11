# BarcodeGen — Chrome Extension

Generate QR codes and barcodes in a persistent side panel. 100% offline — no data collected, no network requests, no camera.

---

## Features

- **Barcode Generator** — QR codes and 7 barcode formats rendered client-side
- **Arduino BT Controller** — send values to an ESP32 over BLE (Web Bluetooth)

---

## Installation

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `barcode-generator/` folder
5. The extension icon appears in your toolbar

> Requires Chrome 114 or later.

---

## Barcode Generator

1. Click the extension icon — the side panel opens
2. Select **Barcode Generator** from the dropdown
3. Type a value in the input field
4. Choose **QR CODE** or **BARCODE** using the toggle
5. If Barcode is selected, choose a format from the format dropdown
6. Click **GENERATE** (or press Enter)
7. A physical USB or Bluetooth HID barcode scanner can read the code directly off the screen

### Supported Formats

| Format | Notes |
|--------|-------|
| QR Code | Error correction level H |
| CODE128 | General purpose, alphanumeric |
| EAN-13 | 12 digits + check digit |
| EAN-8 | 7 digits + check digit |
| UPC-A | 11 digits + check digit |
| CODE39 | Alphanumeric, supports `-`, `.`, space |
| ITF-14 | 13 digits + check digit, for shipping |

### Download

Click **↓ PNG** to save the generated barcode as an image file.

---

## Arduino BT Controller

Control an ESP32 over Bluetooth Low Energy directly from the side panel.

### Requirements

- ESP32 dev board (CH340 USB chip is fine — just for flashing)
- Chrome on desktop or Android (Web Bluetooth is not supported on iOS)

### Step 1 — Flash the firmware

Open `docs/arduino/ESP32_NUS.ino` in Arduino IDE and upload it to your ESP32.

If you haven't set up Arduino IDE for ESP32 before:

1. **Install Arduino IDE 2** — arduino.cc/en/software
2. Open **File → Preferences** and add this URL to "Additional boards manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools → Board → Boards Manager**, search `esp32`, install **esp32 by Espressif Systems**
4. Select **Tools → Board → esp32 → ESP32 Dev Module**
5. Select **Tools → Port** → the port labelled CH340
6. Open `docs/arduino/ESP32_NUS.ino` and click **Upload**
7. Open **Tools → Serial Monitor** at `115200` baud — you should see:
   ```
   [BLE] Advertising as: ESP32_WS
   ```

### Step 2 — Connect from the extension

1. Click the extension icon → side panel opens
2. Select **Arduino BT Controller** from the dropdown
3. Leave **DEVICE NAME** as `ESP32_WS` (or change it to match your sketch)
4. Click **CONNECT** — Chrome shows a Bluetooth picker
5. Select **ESP32_WS** from the list
6. The status dot turns green — you're connected

### Step 3 — Send values

**Manual send**
- Type any value in the input field → click **SEND**
- The ESP32 receives it and prints `[RX] <value>` to Serial Monitor
- The value is also echoed back and appears in the Activity Log

**Sequence mode**
- Set **Increment**, **Max Value**, **Threshold**, and **Delay (ms)**
- Click **START** — the extension sends values stepping from 0 → max → 0 at the set interval
- Click **STOP** to cancel

### Customising the firmware

Edit the `onWrite()` function in `ESP32_NUS.ino` to act on received values:

```cpp
void onWrite(BLECharacteristic *c) {
  String val = c->getValue().c_str();

  float f = val.toFloat();
  // e.g. set a PWM output, trigger a relay, move a servo...
}
```

---

## Privacy

- No network requests at runtime
- No data stored (no localStorage, no chrome.storage, no cookies)
- All barcode generation happens locally in the browser
- Bluetooth data stays between your browser and your device
