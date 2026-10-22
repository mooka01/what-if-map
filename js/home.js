// The home computer. When the app is hosted by the family's PC (over
// Tailscale), the PC can email a summary to the therapist after the teen taps
// Send. Hosted anywhere else, none of this shows up.
import { state, saveSettings, saveOutbox, uid } from './store.js';

// Relative to this script, so it works whichever page loaded the app.
const api = (name) => new URL(`../api/${name}`, import.meta.url);
const HEADERS = { 'Content-Type': 'application/json', 'X-WhatIf': '1' };
const OFFLINE = 'Couldn’t reach the home computer.';

export const emailReady = () => !!state.settings.server?.configured;
export const therapistName = () => state.settings.server?.toName || state.settings.therapistName?.trim() || 'your therapist';

// Returns 'online', 'offline' (keep the last known setup), or 'none' (no home server).
export async function refreshServer() {
  let res;
  try {
    res = await fetch(api('status'), { cache: 'no-store' });
  } catch {
    return 'offline';
  }
  if (res.status === 404) {
    if (state.settings.server) await saveSettings({ server: null });
    return 'none';
  }
  try {
    const s = await res.json();
    if (!s.ok) return 'offline';
    await saveSettings({
      server: { configured: !!s.configured, to: s.to, toName: s.toName, from: s.from, checkedAt: new Date().toISOString() },
    });
    return 'online';
  } catch {
    return 'offline';
  }
}

// { ok } or { ok: false, retry, offline, error }
export async function sendSummary(payload) {
  let res;
  try {
    res = await fetch(api('send'), { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
  } catch {
    return { ok: false, retry: true, offline: true, error: OFFLINE };
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok) return { ok: true };
  return {
    ok: false,
    retry: res.status >= 500 || res.status === 429,
    error: data.error || `The home computer answered with an error (${res.status}).`,
  };
}

export async function queueSummary(payload, error = OFFLINE) {
  state.outbox.push({ id: uid('o'), at: new Date().toISOString(), payload, lastError: error });
  await saveOutbox();
}

export async function discardQueued(id) {
  state.outbox = state.outbox.filter((x) => x.id !== id);
  await saveOutbox();
}

// Sends whatever is waiting. Returns how many went out.
let flushing = false;
export async function flushOutbox() {
  if (flushing || !state.outbox.length) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of [...state.outbox]) {
      const res = await sendSummary(item.payload);
      if (res.ok) {
        state.outbox = state.outbox.filter((x) => x.id !== item.id);
        sent++;
      } else {
        item.lastError = res.error;
      }
      await saveOutbox();
      if (!res.ok) break;
    }
  } finally {
    flushing = false;
  }
  return sent;
}
