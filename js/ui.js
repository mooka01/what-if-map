// Small DOM helpers and shared controls.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}

export function add(el, kids) {
  for (const k of [kids].flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

// ---- Icons (24px stroke icons, currentColor) ----
const ICONS = {
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  maps: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  score: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  patterns: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  park: '<path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M12 7v6M9 10h6"/>',
  parent: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7M5 11l9 9"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  backspace: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6M12 9l6 6"/>',
  breathe: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  ladder: '<path d="M7 2v20M17 2v20M7 6h10M7 11h10M7 16h10"/>',
};

export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

export const iconButton = (name, label, onClick, extra = {}) =>
  h('button', { type: 'button', class: `icon-btn ${extra.class || ''}`, 'aria-label': label, title: label, onClick, ...extra.attrs }, icon(name));

// ---- Choice controls ----

// Single or multi choice as a grid of buttons.
// options: [{ id, label, desc?, exclusive? }]
export function choices({ options, value, multi = false, onChange, layout = 'list', label }) {
  let current = multi ? [...(value || [])] : value;
  const group = h('div', {
    class: `choices choices-${layout}`,
    role: multi ? 'group' : 'radiogroup',
    'aria-label': label,
  });
  const buttons = options.map((opt) => {
    const b = h(
      'button',
      { type: 'button', class: 'choice', role: multi ? 'checkbox' : 'radio', 'data-id': String(opt.id) },
      h('span', { class: 'choice-mark', 'aria-hidden': 'true' }, icon('check', 16)),
      h('span', { class: 'choice-text' },
        opt.badge ? h('span', { class: 'choice-badge' }, opt.badge) : null,
        h('span', { class: 'choice-label' }, opt.label),
        opt.desc ? h('span', { class: 'choice-desc' }, opt.desc) : null,
      ),
    );
    b.addEventListener('click', () => {
      if (multi) {
        const on = current.includes(opt.id);
        if (on) current = current.filter((x) => x !== opt.id);
        else if (opt.exclusive) current = [opt.id];
        else current = [...current.filter((x) => !options.find((o) => o.id === x)?.exclusive), opt.id];
      } else {
        current = opt.id;
      }
      paint();
      onChange(multi ? [...current] : current);
    });
    return b;
  });
  function paint() {
    buttons.forEach((b, i) => {
      const id = options[i].id;
      const on = multi ? current.includes(id) : current === id;
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('on', on);
    });
  }
  paint();
  add(group, buttons);
  return group;
}

// 0-10 slider that starts untouched, so the teen has to choose a number.
export function slider({ value, onChange, label, low = 'calm', high = 'the most ever' }) {
  const id = `s${Math.random().toString(36).slice(2, 7)}`;
  const readout = h('output', { class: 'slider-value', for: id, 'aria-live': 'polite' }, value == null ? '–' : String(value));
  const input = h('input', {
    id,
    type: 'range',
    min: '0',
    max: '10',
    step: '1',
    value: String(value ?? 5),
    class: value == null ? 'untouched' : '',
    'aria-label': label,
  });
  const set = () => {
    input.classList.remove('untouched');
    readout.textContent = input.value;
    input.setAttribute('aria-valuetext', `${input.value} out of 10`);
    onChange(Number(input.value));
  };
  input.addEventListener('input', set);
  input.addEventListener('change', set);
  input.addEventListener('click', set);
  return h('div', { class: 'slider' },
    h('div', { class: 'slider-head' }, h('label', { for: id, class: 'field-label' }, label), readout),
    input,
    h('div', { class: 'slider-ends', 'aria-hidden': 'true' }, h('span', null, `0 ${low}`), h('span', null, `10 ${high}`)),
  );
}

export function textField({ label, value = '', placeholder = '', prefix, suffix, maxlength = 140, onInput, id, hint }) {
  const fid = id || `t${Math.random().toString(36).slice(2, 7)}`;
  const input = h('input', {
    id: fid,
    type: 'text',
    value,
    placeholder,
    maxlength: String(maxlength),
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    spellcheck: 'true',
  });
  input.addEventListener('input', () => onInput(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
  return h('div', { class: 'field' },
    label ? h('label', { class: 'field-label', for: fid }, label) : null,
    h('div', { class: `input-wrap ${prefix ? 'has-prefix' : ''}` },
      prefix ? h('span', { class: 'input-affix' }, prefix) : null,
      input,
      suffix ? h('span', { class: 'input-affix' }, suffix) : null,
    ),
    hint ? h('p', { class: 'hint' }, hint) : null,
  );
}

// ---- Overlays ----

// Bottom sheet. `build(close)` returns the content; resolves with close(value).
export function sheet(build, { label = 'Dialog' } = {}) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const backdrop = h('div', { class: 'sheet-backdrop' });
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    const close = (v) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(undefined);
    };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(undefined);
    });
    document.addEventListener('keydown', onKey);
    add(panel, build(close));
    backdrop.append(panel);
    document.body.append(backdrop);
    requestAnimationFrame(() => (panel.querySelector('input, textarea') || panel.querySelector('button'))?.focus());
  });
}

// One required line of text. Resolves with the text, or undefined if cancelled.
export function askLine({ title, text, label, placeholder, confirm, cancel = 'Cancel', prefix }) {
  return sheet((close) => {
    let val = '';
    const go = h('button', { type: 'button', class: 'btn btn-primary', disabled: true, onClick: () => close(val.trim()) }, confirm);
    const field = textField({
      label,
      placeholder,
      prefix,
      maxlength: 140,
      onInput: (v) => {
        val = v;
        go.disabled = v.trim().length < 3;
      },
    });
    field.querySelector('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !go.disabled) close(val.trim());
    });
    return [
      h('h2', { class: 'sheet-title' }, title),
      text ? h('p', { class: 'muted' }, text) : null,
      field,
      h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => close(undefined) }, cancel), go),
    ];
  }, { label: title });
}

export function confirmDialog({ title, text, confirm, cancel = 'Cancel', danger = false, typeToConfirm }) {
  return sheet((close) => {
    const go = h('button', {
      type: 'button',
      class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
      disabled: !!typeToConfirm,
      onClick: () => close(true),
    }, confirm);
    const field = typeToConfirm
      ? textField({
          label: `Type ${typeToConfirm} to confirm`,
          maxlength: 20,
          onInput: (v) => (go.disabled = v.trim().toUpperCase() !== typeToConfirm),
        })
      : null;
    return [
      h('h2', { class: 'sheet-title' }, title),
      text ? h('p', { class: 'muted' }, text) : null,
      field,
      h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => close(false) }, cancel), go),
    ];
  }, { label: title });
}

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---- Formatting ----
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function smsHref(phone, body) {
  const num = String(phone || '').replace(/[^\d+]/g, '');
  return `sms:${num}?&body=${encodeURIComponent(body)}`;
}
