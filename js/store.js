// In-memory copy of everything on the device, written through to storage.
import { openDB } from './db.js';
import { STEPS } from './content.js';

const DEFAULT_SETTINGS = {
  id: 'settings',
  onboarded: false,
  contacts: [], // [{ name, phone }], at most 2
  pinHash: null,
  pinSalt: null,
  cap: 3,
  theme: 'system', // system | light | dark
  visuals: 'auto', // auto (3D game) | calm (2D)
  sound: false, // game sounds; off by default (school, quiet places)
  motion: 'auto', // auto (follow the device) | full | less
  avatar: { shirt: '#3d7fd9', pants: '#2f4f6f', hat: 'none' }, // his look in the game
  lastSharedAt: null,
  summaryDay: 0, // weekday for the "send a summary" card (0 = Sunday), or null for off
  summarySkippedFor: null, // the due date the teen chose "Not this week" for
  therapistName: '', // turns the weekly card on; the home computer's name wins if set
  lastBackupAt: null,
  snooze: {}, // Home setup cards put off with "Not now": { contacts, install, backup: ISO date }
  server: null, // last answer from the home computer: { configured, to, toName, from, checkedAt }
};

export const state = {
  db: null,
  settings: { ...DEFAULT_SETTINGS },
  maps: [],
  parked: [],
  outbox: [], // summaries waiting to reach the home computer: [{ id, at, payload, lastError }]
  // the therapist's ladder: steps [{ id, text, from }] (the last is the one he's on),
  // tries [{ id, stepId, at, did: 'all' | 'part', thought: 0-10, was: 0-10 }]
  ladder: { steps: [], tries: [] },
};

export async function initStore(dbName) {
  state.db = await openDB(dbName);
  const [maps, parked, kv] = await Promise.all([
    state.db.getAll('maps'),
    state.db.getAll('parked'),
    state.db.getAll('kv'),
  ]);
  state.maps = maps.sort(byNewest);
  state.parked = parked.sort(byNewest);
  state.settings = { ...DEFAULT_SETTINGS, ...(kv.find((k) => k.id === 'settings') || {}) };
  state.outbox = kv.find((k) => k.id === 'outbox')?.items || [];
  const ladder = kv.find((k) => k.id === 'ladder');
  state.ladder = { steps: ladder?.steps || [], tries: ladder?.tries || [] };
}

export const saveOutbox = () => state.db.put('kv', { id: 'outbox', items: state.outbox });

const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

export const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await state.db.put('kv', state.settings);
}

// ---- Maps ----

export function newMap({ withParent = false, worryText = '', parkedId = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: uid('m'),
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    status: 'active', // active | done | stopped
    step: 0,
    withParent,
    parkedId,
    worry: { text: worryText, when: null },
    body: { spots: [], before: null },
    category: null,
    core: { chain: [], fear: null, method: null },
    reality: { odds: null, history: null, friend: null, friendText: '' },
    cope: { picks: [], ownText: '' },
    act: { canAct: null, text: '' },
    sketch: { before: [], after: [], beforePng: null, afterPng: null, skipped: false },
    next: { text: '', after: null },
    detours: [],
    safety: [],
    check: null,
  };
}

export async function saveMap(map) {
  map.updatedAt = new Date().toISOString();
  const i = state.maps.findIndex((m) => m.id === map.id);
  if (i === -1) {
    state.maps.unshift(map);
    requestPersistence();
  } else {
    state.maps[i] = map;
  }
  await state.db.put('maps', map);
}

let saveTimer = null;
export function saveMapSoon(map) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveMap(map), 500);
}
export function flushSave(map) {
  clearTimeout(saveTimer);
  return map ? saveMap(map) : Promise.resolve();
}

export const activeMap = () => state.maps.find((m) => m.status === 'active') || null;
export const getMap = (id) => state.maps.find((m) => m.id === id) || null;
export const stepId = (map) => STEPS[map.step];

// ---- Parked worries ----

export async function parkWorry(text, fromMapId = null) {
  const p = { id: uid('p'), text, createdAt: new Date().toISOString(), fromMapId, usedMapId: null };
  state.parked.unshift(p);
  await state.db.put('parked', p);
  return p;
}

export async function updateParked(p) {
  await state.db.put('parked', p);
}

export async function removeParked(id) {
  state.parked = state.parked.filter((p) => p.id !== id);
  await state.db.del('parked', id);
}

export const openParked = () => state.parked.filter((p) => !p.usedMapId);

// ---- Ladder ----

const saveLadder = () => state.db.put('kv', { id: 'ladder', steps: state.ladder.steps, tries: state.ladder.tries });
export const ladderStep = () => state.ladder.steps[state.ladder.steps.length - 1] || null;
export const triesFor = (stepId) => state.ladder.tries.filter((t) => t.stepId === stepId);

// A new step keeps the old one and its tries. Fixing the wording of a step
// with no tries yet just edits it.
export async function setLadderStep(text) {
  const t = text.trim();
  const cur = ladderStep();
  if (!t || cur?.text === t) return;
  if (cur && !triesFor(cur.id).length) cur.text = t;
  else state.ladder.steps.push({ id: uid('s'), text: t, from: new Date().toISOString() });
  await saveLadder();
  requestPersistence();
}

export async function addLadderTry({ did, thought, was }) {
  const step = ladderStep();
  if (!step) return null;
  const t = { id: uid('t'), stepId: step.id, at: new Date().toISOString(), did, thought, was };
  state.ladder.tries.push(t);
  await saveLadder();
  requestPersistence();
  return t;
}

// ---- Everything ----

export function exportAll() {
  return {
    app: 'what-if-map',
    exportedAt: new Date().toISOString(),
    settings: { ...state.settings, pinHash: undefined, pinSalt: undefined },
    maps: state.maps,
    parked: state.parked,
    ladder: state.ladder,
  };
}

// Restore a backup into what's already here. Maps and parked worries are
// matched by id and the newer copy wins. Settings only fill in what is still
// at its default here (a new phone), so nothing set on this phone is undone.
// A second unfinished map is skipped: one map at a time.
const STATUSES = ['active', 'done', 'stopped'];
const RESTORE_SETTINGS = ['contacts', 'therapistName', 'summaryDay', 'lastSharedAt', 'lastBackupAt', 'cap', 'theme', 'visuals', 'motion', 'sound', 'avatar'];
function fillMap(m) {
  // fill any missing parts from a blank map, so an old or partial backup can't break a screen
  const base = newMap();
  const out = { ...base, ...m };
  for (const [k, v] of Object.entries(base)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...v, ...(m[k] && typeof m[k] === 'object' ? m[k] : {}) };
    else if (Array.isArray(v) && !Array.isArray(m[k])) out[k] = v;
  }
  out.check = m.check && typeof m.check === 'object' ? m.check : null;
  return out;
}
export async function importAll(data) {
  const r = { added: 0, updated: 0, skipped: 0 };
  for (const raw of Array.isArray(data.maps) ? data.maps : []) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.createdAt !== 'string' || !STATUSES.includes(raw.status)) {
      r.skipped++;
      continue;
    }
    const m = fillMap(raw);
    const i = state.maps.findIndex((x) => x.id === m.id);
    if (i !== -1) {
      if ((m.updatedAt || '') > (state.maps[i].updatedAt || '')) {
        state.maps[i] = m;
        await state.db.put('maps', m);
        r.updated++;
      }
      continue;
    }
    if (m.status === 'active' && activeMap()) {
      r.skipped++;
      continue;
    }
    state.maps.push(m);
    await state.db.put('maps', m);
    r.added++;
  }
  state.maps.sort(byNewest);
  for (const p of Array.isArray(data.parked) ? data.parked : []) {
    if (!p || typeof p.id !== 'string' || typeof p.text !== 'string' || state.parked.some((x) => x.id === p.id)) continue;
    const item = { createdAt: new Date().toISOString(), fromMapId: null, usedMapId: null, ...p };
    state.parked.push(item);
    await state.db.put('parked', item);
  }
  state.parked.sort(byNewest);
  // ladder steps and tries, by id
  const L = data.ladder || {};
  const addNew = (list, items, ok) => {
    for (const x of Array.isArray(items) ? items : []) if (ok(x) && !list.some((y) => y.id === x.id)) list.push(x);
  };
  addNew(state.ladder.steps, L.steps, (s) => s && typeof s.id === 'string' && typeof s.text === 'string');
  addNew(state.ladder.tries, L.tries, (t) => t && typeof t.id === 'string' && typeof t.stepId === 'string');
  state.ladder.steps.sort((a, b) => ((a.from || '') < (b.from || '') ? -1 : 1));
  state.ladder.tries.sort((a, b) => ((a.at || '') < (b.at || '') ? -1 : 1));
  await saveLadder();
  const patch = {};
  for (const k of RESTORE_SETTINGS) {
    const v = data.settings?.[k];
    if (v !== undefined && JSON.stringify(state.settings[k]) === JSON.stringify(DEFAULT_SETTINGS[k])) patch[k] = v;
  }
  await saveSettings(patch);
  requestPersistence();
  return r;
}

export async function wipeAll() {
  await state.db.clearAll();
  state.maps = [];
  state.parked = [];
  state.outbox = [];
  state.ladder = { steps: [], tries: [] };
  state.settings = { ...DEFAULT_SETTINGS };
}

let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  // Ask the browser not to evict the journal under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
}
