'use strict';

// ============================================================
// Shell — Feature Registry
// ============================================================

const FEATURES = [];
let activeFeature = null;

function registerFeature(feature) {
  FEATURES.push(feature);
}

function switchFeature(id) {
  if (activeFeature) {
    activeFeature.unmount();
    document.getElementById('feature-' + activeFeature.id).classList.add('hidden');
  }
  const feature = FEATURES.find(f => f.id === id);
  if (!feature) return;
  document.getElementById('feature-' + id).classList.remove('hidden');
  feature.mount();
  activeFeature = feature;
}

document.addEventListener('DOMContentLoaded', () => {
  FEATURES.forEach(f => f.init());
  const featureSelect = document.getElementById('feature-select');
  featureSelect.addEventListener('change', () => switchFeature(featureSelect.value));
  switchFeature('barcode');
});

// ── Pin Icon SVGs (developer-controlled strings, not user data) ──────────
const PIN_ICON_OFF = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1.5L10.5 3.5L7.5 6.5L8 9L6 7L3 10L2 9L5 6L3 4L5.5 4.5L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const PIN_ICON_ON  = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1.5L10.5 3.5L7.5 6.5L8 9L6 7L3 10L2 9L5 6L3 4L5.5 4.5L8.5 1.5Z"/></svg>`;

// ── State ──────────────────────────────────────────────────
let currentMode   = 'qr';      // 'qr' | 'barcode'
let currentFormat = 'CODE128';
let currentScale  = 3;
let hasOutput     = false;
let debounceTimer = null;
let history = []; // [{ value:string, mode:'qr'|'barcode', format:string, pinned:bool, ts:number(ms) }]

// ── Scale Map ──────────────────────────────────────────────
const SCALE = {
  1: { label: 'XS', qrSize: 140, barWidth: 1.5, barHeight:  55 },
  2: { label: 'S',  qrSize: 190, barWidth: 2,   barHeight:  75 },
  3: { label: 'M',  qrSize: 250, barWidth: 2.5, barHeight: 100 },
  4: { label: 'L',  qrSize: 300, barWidth: 3,   barHeight: 128 },
  5: { label: 'XL', qrSize: 320, barWidth: 3.5, barHeight: 155 },
};

// ── Validators ─────────────────────────────────────────────
// Returns { valid: bool, hint: string }
const VALIDATORS = {
  QR:      v => ({ valid: v.trim().length > 0,                            hint: 'Value cannot be empty' }),
  CODE128: v => ({ valid: v.length > 0 && /^[\x20-\x7E]+$/.test(v),      hint: 'Printable ASCII characters only' }),
  EAN13:   v => ({ valid: /^\d{13}$/.test(v),                             hint: 'Exactly 13 digits required' }),
  EAN8:    v => ({ valid: /^\d{8}$/.test(v),                              hint: 'Exactly 8 digits required' }),
  UPCA:    v => ({ valid: /^\d{12}$/.test(v),                             hint: 'Exactly 12 digits required' }),
  CODE39:  v => ({ valid: v.length > 0 && /^[A-Z0-9 \-.$\/+%*]+$/.test(v), hint: 'A–Z, 0–9, and  - . $ / + % *  only' }),
  ITF14:   v => ({ valid: /^\d{14}$/.test(v),                              hint: 'Exactly 14 digits required' }),
};

// Format-specific input hints
const PLACEHOLDERS = {
  QR:      'Enter text, URL, or any value…',
  CODE128: 'Any printable text (ASCII)…',
  EAN13:   '13 digits  e.g. 5901234123457',
  EAN8:    '8 digits  e.g. 96385074',
  UPCA:    '12 digits  e.g. 012345678905',
  CODE39:  'A–Z / 0–9  e.g. HELLO-WORLD',
  ITF14:   '14 digits  e.g. 00012345678905',
};

// ── DOM Refs ───────────────────────────────────────────────
const btnQr        = document.getElementById('btn-qr');
const btnBarcode   = document.getElementById('btn-barcode');
const toggleThumb  = document.getElementById('toggle-thumb');
const formatRow    = document.getElementById('format-row');
const formatSelect = document.getElementById('format-select');
const valueInput   = document.getElementById('value-input');
const errorLine    = document.getElementById('error-line');
const genBtn       = document.getElementById('gen-btn');
const scanWindow   = document.getElementById('scan-window');
const placeholder  = document.getElementById('scan-placeholder');
const outputArea   = document.getElementById('output-area');
const sizeSlider   = document.getElementById('size-slider');
const sliderBadge  = document.getElementById('slider-badge');
const dlBtn        = document.getElementById('dl-btn');
const historySection = document.getElementById('history-section');
const historyHeader  = document.getElementById('history-header');
const historyCount   = document.getElementById('history-count');
const historyList    = document.getElementById('history-list');

// ── Mode ───────────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;

  btnQr.classList.toggle('active', mode === 'qr');
  btnQr.setAttribute('aria-pressed', String(mode === 'qr'));
  btnBarcode.classList.toggle('active', mode === 'barcode');
  btnBarcode.setAttribute('aria-pressed', String(mode === 'barcode'));

  toggleThumb.classList.toggle('right', mode === 'barcode');
  formatRow.classList.toggle('hidden', mode === 'qr');

  if (mode === 'barcode') {
    currentFormat = formatSelect.value;
  }

  valueInput.placeholder = PLACEHOLDERS[mode === 'qr' ? 'QR' : currentFormat];
  clearOutput();
  clearError();
}

// ── Output helpers ─────────────────────────────────────────
function clearOutput() {
  outputArea.innerHTML = '';
  outputArea.classList.add('hidden');
  placeholder.classList.remove('hidden');
  dlBtn.disabled = true;
  hasOutput = false;
}

function showOutput() {
  placeholder.classList.add('hidden');
  outputArea.classList.remove('hidden');
  dlBtn.disabled = false;
  hasOutput = true;
}

function clearError() {
  errorLine.textContent = '';
  errorLine.classList.add('hidden');
  valueInput.classList.remove('input-error');
}

function showError(msg) {
  errorLine.textContent = msg;
  errorLine.classList.remove('hidden');
  valueInput.classList.add('input-error');
}

// ── History ────────────────────────────────────────────────
const MAX_HISTORY = 10;

function addToHistory(value, mode, format) {
  const existing = history.find(
    e => e.value === value && e.mode === mode && e.format === format
  );

  if (existing) {
    existing.ts = Date.now();
  } else {
    history.push({ value, mode, format, pinned: false, ts: Date.now() });
  }

  // Evict oldest unpinned entries beyond MAX_HISTORY
  const unpinned = history.filter(e => !e.pinned);
  if (unpinned.length > MAX_HISTORY) {
    const oldest = unpinned.reduce((a, b) => (a.ts < b.ts ? a : b));
    history.splice(history.indexOf(oldest), 1);
  }

  renderHistory();
}

function renderHistory() {
  historyCount.textContent = '(' + history.length + ')';
  historyList.innerHTML = '';

  const pinned   = history.filter(e =>  e.pinned).sort((a, b) => b.ts - a.ts);
  const unpinned = history.filter(e => !e.pinned).sort((a, b) => b.ts - a.ts);

  pinned.forEach(entry => historyList.appendChild(makeHistoryItem(entry)));

  if (pinned.length > 0 && unpinned.length > 0) {
    const div = document.createElement('li');
    div.className = 'history-divider';
    historyList.appendChild(div);
  }

  unpinned.forEach(entry => historyList.appendChild(makeHistoryItem(entry)));
}

function makeHistoryItem(entry) {
  const li = document.createElement('li');
  li.className = 'history-item';

  // Pin button — innerHTML is safe here (PIN_ICON_OFF/ON are developer constants, not user data)
  const pin = document.createElement('button');
  pin.className = 'history-pin' + (entry.pinned ? ' pinned' : '');
  pin.setAttribute('aria-label', entry.pinned ? 'Unpin' : 'Pin');
  pin.innerHTML = entry.pinned ? PIN_ICON_ON : PIN_ICON_OFF;
  pin.addEventListener('click', function (e) {
    e.stopPropagation();
    entry.pinned = !entry.pinned;
    renderHistory();
  });

  // Value text — textContent to avoid XSS (user-supplied data)
  const span = document.createElement('span');
  span.className = 'history-value';
  span.textContent = entry.value;

  span.addEventListener('click', function () {
    restoreFromHistory(entry);
  });

  li.appendChild(pin);
  li.appendChild(span);
  return li;
}

function restoreFromHistory(entry) {
  // Update mode state and UI directly — do NOT call setMode() because it calls clearOutput()
  currentMode = entry.mode;
  btnQr.classList.toggle('active', entry.mode === 'qr');
  btnQr.setAttribute('aria-pressed', String(entry.mode === 'qr'));
  btnBarcode.classList.toggle('active', entry.mode === 'barcode');
  btnBarcode.setAttribute('aria-pressed', String(entry.mode === 'barcode'));
  toggleThumb.classList.toggle('right', entry.mode === 'barcode');
  formatRow.classList.toggle('hidden', entry.mode === 'qr');

  if (entry.mode === 'barcode') {
    currentFormat = entry.format;
    formatSelect.value = entry.format;
  }

  valueInput.value = entry.value;
  valueInput.placeholder = PLACEHOLDERS[entry.mode === 'qr' ? 'QR' : entry.format];

  clearError();
  generate();
}

// ── Validate ───────────────────────────────────────────────
function validate(value) {
  const key = currentMode === 'qr' ? 'QR' : currentFormat;
  return VALIDATORS[key](value);
}

// ── Generate ───────────────────────────────────────────────
function generate() {
  const value = valueInput.value;
  clearError();

  if (!value) {
    clearOutput();
    return;
  }

  const { valid, hint } = validate(value);
  if (!valid) {
    showError(hint);
    clearOutput();
    return;
  }

  outputArea.innerHTML = '';

  try {
    const scale = SCALE[currentScale];
    if (currentMode === 'qr') {
      generateQR(value, scale);
    } else {
      generateBarcode(value, scale);
    }
    showOutput();
    addToHistory(value, currentMode, currentFormat);
  } catch (err) {
    showError('Could not generate — check your input value.');
    clearOutput();
  }
}

function generateQR(value, scale) {
  const wrap = document.createElement('div');
  outputArea.appendChild(wrap);

  // Cap at 320px so it always fits within the panel
  const size = Math.min(scale.qrSize, 320);

  new QRCode(wrap, {
    text:         value,
    width:        size,
    height:       size,
    colorDark:    '#000000',
    colorLight:   '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
}

function generateBarcode(value, scale) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  outputArea.appendChild(svg);

  JsBarcode(svg, value, {
    format:       currentFormat,
    width:        scale.barWidth,
    height:       scale.barHeight,
    displayValue: false,
    background:   '#ffffff',
    lineColor:    '#000000',
    margin:       12,
  });
}

// ── Download ───────────────────────────────────────────────
function downloadPNG() {
  if (!hasOutput) return;

  if (currentMode === 'qr') {
    downloadQRPNG();
  } else {
    downloadBarcodePNG();
  }
}

function downloadQRPNG() {
  const src = outputArea.querySelector('canvas');
  if (!src) return;

  // Draw onto a white-filled canvas so the PNG background is never transparent
  const canvas = document.createElement('canvas');
  canvas.width  = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0);

  const link = document.createElement('a');
  link.download = 'barcode.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function downloadBarcodePNG() {
  const svg = outputArea.querySelector('svg');
  if (!svg) return;

  const w = parseFloat(svg.getAttribute('width'))  || 300;
  const h = parseFloat(svg.getAttribute('height')) || 150;

  const svgData = new XMLSerializer().serializeToString(svg);
  const blob    = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url     = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const link = document.createElement('a');
    link.download = 'barcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    URL.revokeObjectURL(url);
  };
  img.onerror = function () {
    URL.revokeObjectURL(url);
    showError('PNG export failed — please try again.');
  };
  img.src = url;
}

// ============================================================
// Feature: Barcode Generator
// ============================================================

registerFeature({
  id: 'barcode',
  label: 'Barcode Generator',

  init() {
    btnQr.addEventListener('click', () => setMode('qr'));
    btnBarcode.addEventListener('click', () => setMode('barcode'));

    formatSelect.addEventListener('change', () => {
      currentFormat = formatSelect.value;
      valueInput.placeholder = PLACEHOLDERS[currentFormat];
      clearOutput();
      clearError();
    });

    valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { clearTimeout(debounceTimer); generate(); }
    });

    valueInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      clearError();
      if (!valueInput.value) { clearOutput(); return; }
      debounceTimer = setTimeout(generate, 3000);
    });

    genBtn.addEventListener('click', () => { clearTimeout(debounceTimer); generate(); });

    sizeSlider.addEventListener('input', () => {
      currentScale = parseInt(sizeSlider.value, 10);
      sliderBadge.textContent = SCALE[currentScale].label;
      if (hasOutput) { clearTimeout(debounceTimer); generate(); }
    });

    dlBtn.addEventListener('click', downloadPNG);

    historyHeader.addEventListener('click', function () {
      const collapsed = historySection.classList.toggle('collapsed');
      document.getElementById('history-chevron').setAttribute('aria-pressed', String(!collapsed));
    });
  },

  mount() {
    setMode('qr');
    sliderBadge.textContent = SCALE[currentScale].label;
    valueInput.focus();
  },

  unmount() {
    clearTimeout(debounceTimer);
  },
});

// ============================================================
// Feature: Arduino BT Controller
// ============================================================

registerFeature((function () {
  let pairPort   = null; // port to the pair.html popup
  let seqRunning = false;
  let seqAbort   = false;

  // DOM refs — assigned in init()
  let elDeviceName, elBtnTest, elBtnConnect, elStatusDot, elCompatWarn;
  let elValueInput, elBtnSend;
  let elIncrement, elMaxValue, elThreshold, elDelay;
  let elSeqError, elBtnStart, elSeqProgress;
  let elProgressFill, elProgressLabel, elProgressStep;
  let elLogBox, elBtnClearLog;

  // Build a log entry using safe DOM APIs only
  function log(msg, type) {
    type = type || 'info';
    const time = new Date().toTimeString().slice(0, 8);
    const entry = document.createElement('div');
    entry.className = 'ard-log-entry';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'ard-log-time';
    timeSpan.textContent = time;
    const textSpan = document.createElement('span');
    textSpan.className = 'ard-log-' + type;
    textSpan.textContent = msg;
    entry.appendChild(timeSpan);
    entry.appendChild(textSpan);
    elLogBox.appendChild(entry);
    elLogBox.scrollTop = elLogBox.scrollHeight;
  }

  function setConnected(state, isError) {
    elStatusDot.className = 'ard-status-dot' + (state ? ' connected' : (isError ? ' error' : ''));
    elBtnConnect.textContent = state ? 'DISCONNECT' : 'CONNECT';
    elBtnConnect.classList.toggle('connected', state);
    elBtnTest.disabled    = state;
    elValueInput.disabled = !state;
    elBtnSend.disabled    = !state;
    elIncrement.disabled  = !state;
    elMaxValue.disabled   = !state;
    elThreshold.disabled  = !state;
    elDelay.disabled      = !state;
    elBtnStart.disabled   = !state;
    if (state) elValueInput.focus();
    if (!state && seqRunning) {
      seqAbort   = true;
      seqRunning = false;
      setSeqRunning(false);
    }
  }

  function setSeqRunning(running) {
    elBtnStart.textContent = running ? 'STOP' : 'START';
    elBtnStart.classList.toggle('running', running);
    elIncrement.disabled  = running;
    elMaxValue.disabled   = running;
    elThreshold.disabled  = running;
    elDelay.disabled      = running;
    elValueInput.disabled = running;
    elBtnSend.disabled    = running;
    elBtnConnect.disabled = running;
  }

  function connect() {
    const name = elDeviceName.value.trim() || 'EB The Best';
    elBtnConnect.disabled = true;
    log('Opening Bluetooth pairing window for ' + name + '...', 'info');
    const url = chrome.runtime.getURL('pair.html') + '?device=' + encodeURIComponent(name);
    chrome.tabs.create({ url: url, active: true });
  }

  function disconnect() {
    if (pairPort) {
      pairPort.postMessage({ type: 'disconnect' });
      pairPort = null;
    }
    setConnected(false);
    log('Disconnecting...', 'info');
  }

  function sendValue() {
    const val = elValueInput.value.trim();
    if (!val || !pairPort) return;
    pairPort.postMessage({ type: 'send', value: val });
    log('-> ' + val, 'sent');
    elValueInput.value = '';
    elValueInput.focus();
  }

  function validateSequence() {
    const inc   = parseFloat(elIncrement.value);
    const max   = parseFloat(elMaxValue.value);
    const delay = parseFloat(elDelay.value);
    if (!inc   || inc <= 0)        return 'Increment must be greater than 0';
    if (!max   || max <= 0)        return 'Max value must be greater than 0';
    if (isNaN(delay) || delay < 0) return 'Delay must be 0 or greater';
    const remainder = max % inc;
    if (remainder > 1e-9 && (inc - remainder) > 1e-9)
                                   return 'Max value must be evenly divisible by increment';
    return null;
  }

  function sleep(ms) {
    if (ms <= 0) return new Promise(function (resolve) { setTimeout(resolve, 0); });
    return new Promise(function (resolve) {
      var tick = setInterval(function () { if (seqAbort) { clearInterval(tick); resolve(); } }, 50);
      setTimeout(function () { clearInterval(tick); resolve(); }, ms);
    });
  }

  async function runSequence() {
    var error = validateSequence();
    if (error) {
      elSeqError.textContent = error;
      elSeqError.classList.remove('hidden');
      return;
    }
    elSeqError.classList.add('hidden');

    var inc       = parseFloat(elIncrement.value);
    var max       = parseFloat(elMaxValue.value);
    var threshold = parseFloat(elThreshold.value) || 0;
    var delayMs   = parseFloat(elDelay.value);

    var forward = [];
    for (var i = 0; i * inc <= max + 1e-9; i++) forward.push(+(i * inc).toFixed(10));
    var reverse = forward.slice(0, -1).reverse();
    var full    = forward.concat([forward[forward.length - 1]]).concat(reverse);

    seqRunning = true;
    seqAbort   = false;
    setSeqRunning(true);
    elSeqProgress.classList.remove('hidden');

    log('Sequence 0->' + max + ' (' + full.length + ' steps, +' + threshold + ' threshold, ' + delayMs + 'ms delay)', 'seq');

    for (var i = 0; i < full.length; i++) {
      if (seqAbort) break;

      var isReturning = i >= forward.length;
      var sent = (full[i] + threshold).toFixed(2);

      elProgressFill.style.width  = ((i + 1) / full.length * 100) + '%';
      elProgressFill.className    = 'ard-progress-fill' + (isReturning ? ' returning' : '');
      elProgressLabel.textContent = isReturning ? 'Returning...' : 'Going up...';
      elProgressStep.textContent  = (i + 1) + '/' + full.length;

      if (!pairPort) { seqAbort = true; break; }
      pairPort.postMessage({ type: 'send', value: sent });
      log('-> ' + sent + (isReturning ? '  return' : '  up'), 'sent');

      if (i < full.length - 1 && !seqAbort) await sleep(delayMs);
    }

    log(seqAbort ? 'Sequence stopped.' : 'Sequence complete!', 'seq');

    elProgressFill.style.width  = '0%';
    elProgressFill.className    = 'ard-progress-fill';
    elProgressLabel.textContent = 'Sequence progress';
    elProgressStep.textContent  = '';
    elSeqProgress.classList.add('hidden');

    seqRunning = false;
    seqAbort   = false;
    setSeqRunning(false);
  }

  return {
    id:    'arduino',
    label: 'Arduino BT Controller',

    init() {
      elDeviceName    = document.getElementById('ard-device-name');
      elBtnTest       = document.getElementById('ard-btn-test');
      elBtnConnect    = document.getElementById('ard-btn-connect');
      elStatusDot     = document.getElementById('ard-status-dot');
      elCompatWarn    = document.getElementById('ard-compat-warn');
      elValueInput    = document.getElementById('ard-value-input');
      elBtnSend       = document.getElementById('ard-btn-send');
      elIncrement     = document.getElementById('ard-increment');
      elMaxValue      = document.getElementById('ard-max-value');
      elThreshold     = document.getElementById('ard-threshold');
      elDelay         = document.getElementById('ard-delay');
      elSeqError      = document.getElementById('ard-seq-error');
      elBtnStart      = document.getElementById('ard-btn-start');
      elSeqProgress   = document.getElementById('ard-seq-progress');
      elProgressFill  = document.getElementById('ard-progress-fill');
      elProgressLabel = document.getElementById('ard-progress-label');
      elProgressStep  = document.getElementById('ard-progress-step');
      elLogBox        = document.getElementById('ard-log-box');
      elBtnClearLog   = document.getElementById('ard-btn-clear-log');

      if (!navigator.bluetooth) {
        elCompatWarn.classList.remove('hidden');
        elBtnConnect.disabled = true;
        elBtnTest.disabled    = true;
        log('Web Bluetooth not available. Use Chrome on desktop or Android.', 'err');
      } else {
        log('Ready. Enter device name and press CONNECT.', 'info');
      }

      // TEST button opens the same pairing popup
      elBtnTest.addEventListener('click', function () {
        connect();
      });

      elBtnConnect.addEventListener('click', function () {
        if (pairPort) disconnect();
        else connect();
      });

      // Messages from pair.html popup
      chrome.runtime.onConnect.addListener(function (port) {
        if (port.name !== 'ble-pair') return;
        pairPort = port;
        port.onMessage.addListener(function (msg) {
          switch (msg.type) {
            case 'connected':
              setConnected(true);
              log('Ready — connected to ' + msg.name, 'recv');
              break;
            case 'recv':
              log('<- ' + msg.value, 'recv');
              break;
            case 'disconnected':
              pairPort = null;
              setConnected(false);
              log('Disconnected unexpectedly.', 'err');
              elBtnConnect.disabled = false;
              break;
            case 'cancelled':
              pairPort = null;
              setConnected(false);
              log('Pairing cancelled.', 'info');
              elBtnConnect.disabled = false;
              break;
            case 'error':
              log('BLE error: ' + msg.message, 'err');
              break;
          }
        });
        port.onDisconnect.addListener(function () {
          if (pairPort === port) {
            pairPort = null;
            setConnected(false);
            log('Pairing window closed.', 'info');
            elBtnConnect.disabled = false;
          }
        });
      });

      elValueInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendValue();
      });
      elBtnSend.addEventListener('click', sendValue);

      elBtnStart.addEventListener('click', function () {
        if (seqRunning) seqAbort = true;
        else runSequence();
      });

      elBtnClearLog.addEventListener('click', function () {
        while (elLogBox.firstChild) elLogBox.removeChild(elLogBox.firstChild);
      });
    },

    mount() {
      // BT connection persists across feature switches — nothing to restore
    },

    unmount() {
      if (seqRunning) seqAbort = true;
    },
  };
})());
