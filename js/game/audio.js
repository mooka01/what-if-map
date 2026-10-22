// Soft synthesized sound effects (no audio files) and light haptics.
// Quiet by design: short, rounded tones; nothing harsh or alarming.

let ctx = null;
let master = null;
let enabled = true;
let volume = 0.35;

function ensure() {
  if (ctx || !enabled) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  return ctx;
}

// Browsers only allow audio after a user gesture; call from a tap handler.
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.value = on ? volume : 0;
}

function tone({ type = 'sine', from = 440, to = from, dur = 0.12, gain = 0.25, delay = 0, attack = 0.01 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.15, gain = 0.12, from = 800, to = 200, delay = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// Haptics follow the sound switch: off means no buzzing either.
const buzz = (ms) => enabled && navigator.vibrate?.(ms);

export const sfx = {
  tap() {
    tone({ type: 'sine', from: 620, to: 760, dur: 0.07, gain: 0.12 });
    buzz(8);
  },
  jump() {
    tone({ type: 'triangle', from: 260, to: 520, dur: 0.16, gain: 0.16 });
  },
  land() {
    noise({ dur: 0.1, gain: 0.1, from: 600, to: 120 });
    tone({ type: 'sine', from: 160, to: 90, dur: 0.1, gain: 0.12 });
    buzz(12);
  },
  select() {
    tone({ type: 'sine', from: 523, dur: 0.12, gain: 0.14 });
    tone({ type: 'sine', from: 659, dur: 0.16, gain: 0.12, delay: 0.07 });
    buzz(10);
  },
  deselect() {
    tone({ type: 'sine', from: 520, to: 390, dur: 0.12, gain: 0.1 });
  },
  whoosh() {
    noise({ dur: 0.35, gain: 0.07, from: 300, to: 1600 });
  },
  step() {
    tone({ type: 'sine', from: 392, dur: 0.14, gain: 0.1 });
    tone({ type: 'sine', from: 523, dur: 0.18, gain: 0.1, delay: 0.09 });
  },
  // Two soft notes: a place reached, not a "level complete" fanfare.
  checkpoint() {
    tone({ type: 'sine', from: 392, dur: 0.18, gain: 0.08 });
    tone({ type: 'sine', from: 523, dur: 0.22, gain: 0.08, delay: 0.12 });
  },
  // Steady, neutral tones (no falling "fail" sounds).
  core() {
    tone({ type: 'sine', from: 330, dur: 0.4, gain: 0.1, attack: 0.06 });
  },
  park() {
    noise({ dur: 0.08, gain: 0.08, from: 500, to: 200 });
  },
};
