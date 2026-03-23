'use strict';

// ── State ──────────────────────────────────────────────────
let currentMode   = 'qr';      // 'qr' | 'barcode'
let currentFormat = 'CODE128';
let currentScale  = 3;
let hasOutput     = false;
let debounceTimer = null;

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
};

// Format-specific input hints
const PLACEHOLDERS = {
  QR:      'Enter text, URL, or any value…',
  CODE128: 'Any printable text (ASCII)…',
  EAN13:   '13 digits  e.g. 5901234123457',
  EAN8:    '8 digits  e.g. 96385074',
  UPCA:    '12 digits  e.g. 012345678905',
  CODE39:  'A–Z / 0–9  e.g. HELLO-WORLD',
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
  const canvas = outputArea.querySelector('canvas');
  if (!canvas) return;

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

// ── Event Listeners ────────────────────────────────────────
btnQr.addEventListener('click', () => setMode('qr'));
btnBarcode.addEventListener('click', () => setMode('barcode'));

formatSelect.addEventListener('change', () => {
  currentFormat = formatSelect.value;
  valueInput.placeholder = PLACEHOLDERS[currentFormat];
  clearOutput();
  clearError();
});

// Enter key → immediate generate
valueInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(debounceTimer);
    generate();
  }
});

// Typing → 3-second debounce
valueInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  clearError();

  if (!valueInput.value) {
    clearOutput();
    return;
  }

  debounceTimer = setTimeout(generate, 3000);
});

// Generate button → immediate
genBtn.addEventListener('click', () => {
  clearTimeout(debounceTimer);
  generate();
});

// Size slider → regenerate if output exists
sizeSlider.addEventListener('input', () => {
  currentScale = parseInt(sizeSlider.value, 10);
  sliderBadge.textContent = SCALE[currentScale].label;

  if (hasOutput) {
    clearTimeout(debounceTimer);
    generate();
  }
});

dlBtn.addEventListener('click', downloadPNG);

// ── Init ───────────────────────────────────────────────────
setMode('qr');
sliderBadge.textContent = SCALE[currentScale].label;
valueInput.focus();
