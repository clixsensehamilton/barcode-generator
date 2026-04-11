'use strict';

// ── Constants ────────────────────────────────────────────
const NUS_SERVICE = '6e400001-b5b4-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR = '6e400002-b5b4-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR = '6e400003-b5b4-f393-e0a9-e50e24dcca9e';

// ── State ────────────────────────────────────────────────
let btDevice = null;
let txChar   = null;

// ── DOM ──────────────────────────────────────────────────
const elLabel  = document.getElementById('device-label');
const elBtn    = document.getElementById('btn-pair');
const elStatus = document.getElementById('status');

// ── Params ───────────────────────────────────────────────
const deviceName = new URLSearchParams(location.search).get('device') || 'ESP32_WS';
elLabel.textContent = deviceName;

// ── Port to side panel ───────────────────────────────────
const port = chrome.runtime.connect({ name: 'ble-pair' });

function setStatus(msg, type) {
  elStatus.textContent = msg;
  elStatus.className = 'status' + (type ? ' ' + type : '');
}

// Commands from side panel
port.onMessage.addListener(function (msg) {
  if (msg.type === 'send' && txChar) {
    txChar.writeValue(new TextEncoder().encode(msg.value))
      .catch(function (err) {
        port.postMessage({ type: 'error', message: err.message });
      });
  } else if (msg.type === 'disconnect') {
    if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
    window.close();
  }
});

port.onDisconnect.addListener(function () {
  // Side panel closed — clean up
  if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
  window.close();
});

// ── Pairing ──────────────────────────────────────────────
elBtn.addEventListener('click', async function () {
  elBtn.disabled = true;
  setStatus('Opening Bluetooth picker…');
  try {
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [NUS_SERVICE],
    });

    setStatus('Connecting to ' + btDevice.name + '…');
    const server = await btDevice.gatt.connect();

    setStatus('Discovering services…');
    const service = await server.getPrimaryService(NUS_SERVICE);
    txChar = await service.getCharacteristic(NUS_TX_CHAR);

    // Subscribe to RX notifications (optional — ESP32 echo)
    try {
      const rxChar = await service.getCharacteristic(NUS_RX_CHAR);
      await rxChar.startNotifications();
      rxChar.addEventListener('characteristicvaluechanged', function (e) {
        const val = new TextDecoder().decode(e.target.value).trim();
        if (val) port.postMessage({ type: 'recv', value: val });
      });
    } catch (_) { /* RX optional */ }

    btDevice.addEventListener('gattserverdisconnected', function () {
      txChar = null;
      port.postMessage({ type: 'disconnected' });
      setStatus('Disconnected', 'err');
      elBtn.textContent = 'Pair Again';
      elBtn.className = '';
      elBtn.disabled = false;
      elBtn.onclick = null;
      elBtn.addEventListener('click', reconnect);
    });

    port.postMessage({ type: 'connected', name: btDevice.name });
    setStatus('Connected to ' + btDevice.name, 'ok');
    elBtn.textContent = 'Disconnect & Close';
    elBtn.className = 'connected';
    elBtn.disabled = false;
    elBtn.addEventListener('click', function onDisconn() {
      elBtn.removeEventListener('click', onDisconn);
      if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
      window.close();
    });

  } catch (err) {
    if (err.name === 'NotFoundError') {
      setStatus('Cancelled — no device selected.', 'err');
      port.postMessage({ type: 'cancelled' });
    } else {
      setStatus(err.message, 'err');
      port.postMessage({ type: 'error', message: err.message });
    }
    elBtn.disabled = false;
  }
});

async function reconnect() {
  elBtn.removeEventListener('click', reconnect);
  elBtn.disabled = true;
  setStatus('Reconnecting…');
  try {
    const server = await btDevice.gatt.connect();
    const service = await server.getPrimaryService(NUS_SERVICE);
    txChar = await service.getCharacteristic(NUS_TX_CHAR);
    port.postMessage({ type: 'connected', name: btDevice.name });
    setStatus('Reconnected to ' + btDevice.name, 'ok');
    elBtn.textContent = 'Disconnect & Close';
    elBtn.className = 'connected';
    elBtn.disabled = false;
  } catch (err) {
    setStatus('Reconnect failed: ' + err.message, 'err');
    port.postMessage({ type: 'error', message: err.message });
    elBtn.textContent = 'Pair Again';
    elBtn.disabled = false;
    elBtn.addEventListener('click', reconnect);
  }
}
