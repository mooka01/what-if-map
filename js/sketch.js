// Finger-drawing pad. Strokes are stored as normalized points (0..1), so a
// drawing redraws at any size and can be turned into a PNG for sharing.
import { h, icon } from './ui.js';

export const PAPER = '#FBFAF6';
const COLORS = [
  { id: '#1E2226', name: 'Black' },
  { id: '#2F6DB5', name: 'Blue' },
  { id: '#C2412D', name: 'Red' },
  { id: '#2E8B57', name: 'Green' },
  { id: '#E0A100', name: 'Yellow' },
  { id: '#7A4FB5', name: 'Purple' },
];
const SIZES = { thin: 0.012, thick: 0.035 };

export function sketchPad({ strokes, onChange }) {
  let tool = { color: COLORS[0].id, size: 'thin', erase: false };
  let current = null;
  const canvas = h('canvas', { class: 'sketch-canvas', 'aria-label': 'Drawing area', role: 'img' });
  const ctx = canvas.getContext('2d');

  function fit() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    redraw();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s, canvas.width, canvas.height);
    if (current) drawStroke(ctx, current, canvas.width, canvas.height);
  }

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Some pens and synthetic events have no capturable pointer; drawing still works.
    }
    current = { c: tool.color, w: SIZES[tool.size], e: tool.erase ? 1 : 0, p: [point(e)] };
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) current.p.push(point(ev));
    redraw();
  });
  const end = () => {
    if (!current) return;
    strokes.push(current);
    current = null;
    redraw();
    onChange();
    paintTools();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // ---- Toolbar ----
  const swatches = COLORS.map((c) =>
    h('button', {
      type: 'button',
      class: 'swatch',
      style: `--swatch:${c.id}`,
      'aria-label': c.name,
      onClick: () => {
        tool = { ...tool, color: c.id, erase: false };
        paintTools();
      },
    }),
  );
  const sizeBtn = h('button', {
    type: 'button',
    class: 'tool-btn',
    onClick: () => {
      tool = { ...tool, size: tool.size === 'thin' ? 'thick' : 'thin' };
      paintTools();
    },
  });
  const eraseBtn = h('button', {
    type: 'button',
    class: 'tool-btn',
    'aria-label': 'Eraser',
    onClick: () => {
      tool = { ...tool, erase: !tool.erase };
      paintTools();
    },
  }, icon('eraser'), h('span', null, 'Eraser'));
  const undoBtn = h('button', {
    type: 'button',
    class: 'tool-btn',
    'aria-label': 'Undo',
    onClick: () => {
      strokes.pop();
      redraw();
      onChange();
      paintTools();
    },
  }, icon('undo'), h('span', null, 'Undo'));

  function paintTools() {
    swatches.forEach((b, i) => b.setAttribute('aria-pressed', String(!tool.erase && tool.color === COLORS[i].id)));
    eraseBtn.setAttribute('aria-pressed', String(tool.erase));
    sizeBtn.replaceChildren(
      h('span', { class: `size-dot size-${tool.size}`, 'aria-hidden': 'true' }),
      h('span', null, tool.size === 'thin' ? 'Thin' : 'Thick'),
    );
    sizeBtn.setAttribute('aria-label', `Line size: ${tool.size}`);
    undoBtn.disabled = strokes.length === 0;
  }
  paintTools();

  const wrap = h('div', { class: 'sketch' },
    h('div', { class: 'sketch-paper' }, canvas),
    h('div', { class: 'sketch-colors' }, swatches),
    h('div', { class: 'sketch-tools' }, sizeBtn, eraseBtn, undoBtn),
  );

  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  return { el: wrap, destroy: () => ro.disconnect() };
}

function drawStroke(ctx, s, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  ctx.lineWidth = s.w * W;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [x0, y0] = s.p[0];
  if (s.p.length === 1) {
    ctx.beginPath();
    ctx.arc(x0 * W, y0 * H, (s.w * W) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x0 * W, y0 * H);
    for (let i = 1; i < s.p.length; i++) ctx.lineTo(s.p[i][0] * W, s.p[i][1] * H);
    ctx.stroke();
  }
  ctx.restore();
}

// Flatten strokes onto paper and return a PNG data URL (null if empty).
export function strokesToPng(strokes, size = 600) {
  if (!strokes.length) return null;
  const ink = document.createElement('canvas');
  ink.width = ink.height = size;
  const ictx = ink.getContext('2d');
  for (const s of strokes) drawStroke(ictx, s, size, size);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d');
  octx.fillStyle = PAPER;
  octx.fillRect(0, 0, size, size);
  octx.drawImage(ink, 0, 0);
  return out.toDataURL('image/png');
}
