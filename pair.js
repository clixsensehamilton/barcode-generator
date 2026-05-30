'use strict';

// ── Constants ────────────────────────────────────────────
const NUS_SERVICE = '6e400001-b5b4-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR = '6e400002-b5b4-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR = '6e400003-b5b4-f393-e0a9-e50e24dcca9e';

const MAX_RECONNECT   = 6;
const RECONNECT_DELAY = [1000, 2000, 3000, 4000, 5000, 5000]; // ms per attempt

// ── State ────────────────────────────────────────────────
let btDevice         = null;
let txChar           = null;
let reconnectAttempt = 0;
let reconnectTimer   = null;
let userDisconnected = false; // set true when user presses Disconnect

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

function showManualReconnect() {
  port.postMessage({ type: 'disconnected' });
  setStatus('Could not reconnect. Re-pair manually.', 'err');
  elBtn.textContent = 'Pair Again';
  elBtn.className   = '';
  elBtn.disabled    = false;
}

// ── Auto-reconnect (no picker needed — reuses btDevice) ──
function scheduleReconnect() {
  if (userDisconnected || reconnectAttempt >= MAX_RECONNECT) {
    showManualReconnect();
    return;
  }
  const delay = RECONNECT_DELAY[reconnectAttempt] || 5000;
  reconnectAttempt++;
  setStatus(
    'Reconnecting… attempt ' + reconnectAttempt + '/' + MAX_RECONNECT +
    ' (in ' + (delay / 1000) + 's)'
  );
  elBtn.textContent = 'Cancel Reconnect';
  elBtn.className   = '';
  elBtn.disabled    = false;

  reconnectTimer = setTimeout(async function () {
    reconnectTimer = null;
    elBtn.disabled = true;
    setStatus('Reconnecting… attempt ' + reconnectAttempt + '/' + MAX_RECONNECT);
    try {
      const server  = await btDevice.gatt.connect();
      const service = await server.getPrimaryService(NUS_SERVICE);
      txChar = await service.getCharacteristic(NUS_TX_CHAR);

      // Re-subscribe notifications
      try {
        const rxChar = await service.getCharacteristic(NUS_RX_CHAR);
        await rxChar.startNotifications();
        rxChar.addEventListener('characteristicvaluechanged', onRxNotify);
      } catch (_) { /* optional */ }

      reconnectAttempt = 0;
      port.postMessage({ type: 'connected', name: btDevice.name });
      setStatus('Reconnected to ' + btDevice.name, 'ok');
      elBtn.textContent = 'Disconnect & Close';
      elBtn.className   = 'connected';
      elBtn.disabled    = false;
    } catch (_) {
      // Stack may not be ready yet — try again
      scheduleReconnect();
    }
  }, delay);
}

// Cancel the in-flight reconnect timer and return to manual mode
function cancelReconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectAttempt = 0;
  showManualReconnect();
}

// ── RX notification handler ───────────────────────────────
function onRxNotify(e) {
  const val = new TextDecoder().decode(e.target.value).trim();
  if (val) port.postMessage({ type: 'recv', value: val });
}

// Commands from side panel
port.onMessage.addListener(function (msg) {
  if (msg.type === 'send' && txChar) {
    txChar.writeValue(new TextEncoder().encode(msg.value))
      .catch(function (err) {
        port.postMessage({ type: 'error', message: err.message });
        // A failed write usually means the GATT link is gone — reconnect
        if (!btDevice.gatt.connected) scheduleReconnect();
      });
  } else if (msg.type === 'disconnect') {
    userDisconnected = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
    window.close();
  }
});

port.onDisconnect.addListener(function () {
  userDisconnected = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
  window.close();
});

// ── Pairing ──────────────────────────────────────────────
elBtn.addEventListener('click', async function () {
  // If reconnect is pending, this button cancels it
  if (reconnectTimer) { cancelReconnect(); return; }

  elBtn.disabled = true;
  setStatus('Opening Bluetooth picker…');
  try {
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [NUS_SERVICE],
    });

    userDisconnected = false;
    reconnectAttempt = 0;

    setStatus('Connecting to ' + btDevice.name + '…');
    const server = await btDevice.gatt.connect();

    setStatus('Discovering services…');
    const service = await server.getPrimaryService(NUS_SERVICE);
    txChar = await service.getCharacteristic(NUS_TX_CHAR);

    // Subscribe to RX notifications (optional — ESP32 echo)
    try {
      const rxChar = await service.getCharacteristic(NUS_RX_CHAR);
      await rxChar.startNotifications();
      rxChar.addEventListener('characteristicvaluechanged', onRxNotify);
    } catch (_) { /* RX optional */ }

    btDevice.addEventListener('gattserverdisconnected', function () {
      txChar = null;
      if (userDisconnected) return; // intentional — don't auto-reconnect
      port.postMessage({ type: 'disconnected' });
      setStatus('Connection lost — auto-reconnecting…', 'err');
      scheduleReconnect();
    });

    port.postMessage({ type: 'connected', name: btDevice.name });
    setStatus('Connected to ' + btDevice.name, 'ok');
    elBtn.textContent = 'Disconnect & Close';
    elBtn.className   = 'connected';
    elBtn.disabled    = false;
    elBtn.addEventListener('click', function onDisconn() {
      elBtn.removeEventListener('click', onDisconn);
      userDisconnected = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
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
