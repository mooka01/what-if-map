// Optional 4-digit PIN. It keeps casual eyes out; it does not encrypt data.
import { state, saveSettings, wipeAll } from './store.js';
import { h, icon, sheet, confirmDialog } from './ui.js';

const LEN = 4;

async function hashPin(pin, salt) {
  const text = `${salt}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Non-secure contexts (plain http on a LAN) have no crypto.subtle.
  let x = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `fnv${x.toString(16)}`;
}

export const hasPin = () => !!state.settings.pinHash;

export async function setPin(pin) {
  const salt = Math.random().toString(36).slice(2);
  await saveSettings({ pinSalt: salt, pinHash: await hashPin(pin, salt) });
}

export const clearPin = () => saveSettings({ pinHash: null, pinSalt: null });

const checkPin = async (pin) => (await hashPin(pin, state.settings.pinSalt)) === state.settings.pinHash;

// Keypad. onComplete(pin) resolves to true (accept) or an error message.
function pinPad({ title, text, onComplete }) {
  let pin = '';
  let busy = false;
  const dots = h('div', { class: 'pin-dots', 'aria-hidden': 'true' }, Array.from({ length: LEN }, () => h('span')));
  const status = h('p', { class: 'pin-error', role: 'alert' });
  const paint = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));

  async function press(d) {
    if (busy || pin.length >= LEN) return;
    pin += d;
    status.textContent = '';
    paint();
    if (pin.length < LEN) return;
    busy = true;
    const res = await onComplete(pin);
    busy = false;
    if (res === true) return;
    status.textContent = res || 'Try again.';
    dots.classList.remove('shake');
    void dots.offsetWidth;
    dots.classList.add('shake');
    pin = '';
    paint();
  }
  const back = () => {
    pin = pin.slice(0, -1);
    paint();
  };

  const key = (d) => h('button', { type: 'button', class: 'pin-key', onClick: () => press(d) }, d);
  const pad = h('div', { class: 'pin-pad' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key),
    h('span'),
    key('0'),
    h('button', { type: 'button', class: 'pin-key pin-key-icon', 'aria-label': 'Delete', onClick: back }, icon('backspace')),
  );
  const el = h('div', { class: 'pin' },
    h('h2', { class: 'pin-title' }, title),
    text ? h('p', { class: 'muted center' }, text) : null,
    dots,
    status,
    pad,
  );
  el.addEventListener('keydown', (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    if (e.key === 'Backspace') back();
  });
  return el;
}

// Full-screen lock. Resolves once the right PIN is entered.
export function showLock() {
  if (document.querySelector('.lock-screen')) return Promise.resolve();
  return new Promise((resolve) => {
    let fails = 0;
    let lockedUntil = 0;
    const overlay = h('div', { class: 'lock-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Locked' });
    const pad = pinPad({
      title: 'Enter your PIN',
      onComplete: async (pin) => {
        if (Date.now() < lockedUntil) return 'Wait a moment, then try again.';
        if (await checkPin(pin)) {
          overlay.remove();
          resolve();
          return true;
        }
        fails++;
        if (fails >= 5) {
          lockedUntil = Date.now() + 30000;
          fails = 0;
          return 'Too many tries. Wait 30 seconds.';
        }
        return 'That’s not it. Try again.';
      },
    });
    const forgot = h('button', {
      type: 'button',
      class: 'btn btn-ghost',
      onClick: async () => {
        const ok = await confirmDialog({
          title: 'Forgot the PIN?',
          text: 'The PIN can’t be recovered. The only way in is to erase everything in this app and start over.',
          confirm: 'Erase everything',
          danger: true,
          typeToConfirm: 'ERASE',
        });
        if (!ok) return;
        await wipeAll();
        location.reload();
      },
    }, 'Forgot PIN?');
    overlay.append(h('div', { class: 'lock-inner' }, icon('lock', 28), pad, forgot));
    document.body.append(overlay);
    overlay.tabIndex = -1;
    overlay.focus();
  });
}

// Pick a new PIN (enter twice). Resolves with the PIN or undefined.
export function choosePin() {
  return sheet((close) => {
    let first = null;
    const holder = h('div');
    const ask = () =>
      holder.replaceChildren(
        pinPad({
          title: first ? 'Enter it again' : 'Choose a 4-digit PIN',
          text: first ? null : 'Pick something a parent can also know, in case it’s forgotten.',
          onComplete: async (pin) => {
            if (!first) {
              first = pin;
              ask();
              return true;
            }
            if (pin === first) {
              close(pin);
              return true;
            }
            first = null;
            setTimeout(ask, 900);
            return 'They didn’t match. Start again.';
          },
        }),
      );
    ask();
    return [holder, h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => close(undefined) }, 'Cancel'))];
  }, { label: 'Set a PIN' });
}
