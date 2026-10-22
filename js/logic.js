// Pure rules and numbers. No DOM here, so tests can call these directly.
import { CORE_MAX_ROUNDS, CORE_FEARS, CORE_BOTTOM, STEPS } from './content.js';

export const MIN_TEXT = 2;
const filled = (s) => String(s || '').trim().length >= MIN_TEXT;

// ---- Step 4: the downward arrow ----
// The choices for the next round. The first round has every fear. After that,
// the answer just picked is left out (the question already names it, so
// picking it again would read in a circle) and "Nothing worse" ends the dig.
export function coreOptions(chain) {
  if (!chain.length) return CORE_FEARS;
  const last = chain[chain.length - 1];
  return [...CORE_FEARS.filter((f) => f.id !== last), CORE_BOTTOM];
}

// Ends when "Nothing worse" is picked (method 'bottom', handled by the step),
// when an earlier answer comes back, or after CORE_MAX_ROUNDS picks.
// With no repeat, the most-picked answer wins and ties go to the latest
// (deepest) pick.
export function coreResult(chain) {
  if (!chain.length) return { done: false };
  const counts = {};
  for (const id of chain) counts[id] = (counts[id] || 0) + 1;
  const last = chain[chain.length - 1];
  if (counts[last] >= 2) return { done: true, fear: last, method: 'repeat' };
  if (chain.length >= CORE_MAX_ROUNDS) {
    let best = null;
    let bestN = 0;
    for (const id of chain) {
      if (counts[id] >= bestN) {
        best = id;
        bestN = counts[id];
      }
    }
    return { done: true, fear: best, method: 'rounds' };
  }
  return { done: false };
}

// ---- What each step needs before Next ----
export function stepComplete(map, step = STEPS[map.step]) {
  switch (step) {
    case 'worry':
      return filled(map.worry.text) && !!map.worry.when;
    case 'body':
      return map.body.spots.length > 0 && map.body.before != null;
    case 'sort':
      return !!map.category;
    case 'core':
      return !!map.core.fear;
    case 'reality': {
      const r = map.reality;
      return r.odds != null && !!r.history && !!r.friend && (r.friend !== 'own' || filled(r.friendText));
    }
    case 'cope':
      return map.cope.picks.length > 0 && (!map.cope.picks.includes('own') || filled(map.cope.ownText));
    case 'act':
      return map.act.canAct === 'no' || (map.act.canAct === 'yes' && filled(map.act.text));
    case 'sketch':
      return true;
    case 'next':
      return filled(map.next.text) && map.next.after != null;
    default:
      return false;
  }
}

// Text the teen typed on a step; each one goes through the crisis check.
export function stepTexts(map, step = STEPS[map.step]) {
  switch (step) {
    case 'worry':
      return [map.worry.text];
    case 'reality':
      return map.reality.friend === 'own' ? [map.reality.friendText] : [];
    case 'cope':
      return map.cope.picks.includes('own') ? [map.cope.ownText] : [];
    case 'act':
      return map.act.canAct === 'yes' ? [map.act.text] : [];
    case 'next':
      return [map.next.text];
    default:
      return [];
  }
}

// "What if I fail?" -> "I fail"
export function cleanWorry(text) {
  return String(text || '')
    .replace(/^\s*what\s*if\s*/i, '')
    .replace(/[?\s]+$/, '')
    .replace(/\s+/g, ' ');
}

// ---- Dates ----
export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Weeks start on Monday.
export function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function mapsStartedToday(maps, now = new Date()) {
  const day = startOfDay(now).getTime();
  return maps.filter((m) => startOfDay(m.createdAt).getTime() === day).length;
}

// The tomorrow check opens once the worry has had its chance to happen, so
// "Didn't happen" means something. By the worry's "when":
//   Today: 12 hours after the map. Tomorrow: 6 PM the next day (at least
//   12 hours). This week: 2 days. Later: 7 days.
// "Hasn't come up yet" pushes it back (checkAgainAt) without counting.
export const CHECK_WAIT = 12 * HOUR;
const WAIT_BY_WHEN = { today: CHECK_WAIT, week: 2 * DAY, later: 7 * DAY };
const NOT_YET_WAIT = { today: DAY, tomorrow: DAY, week: 2 * DAY, later: 7 * DAY };
export function checkOpensAt(m) {
  const done = new Date(m.finishedAt);
  let at;
  if (m.worry?.when === 'tomorrow') {
    const evening = startOfDay(done);
    evening.setDate(evening.getDate() + 1);
    evening.setHours(18);
    at = new Date(Math.max(evening.getTime(), done.getTime() + CHECK_WAIT));
  } else {
    at = new Date(done.getTime() + (WAIT_BY_WHEN[m.worry?.when] ?? CHECK_WAIT));
  }
  if (m.checkAgainAt && new Date(m.checkAgainAt) > at) at = new Date(m.checkAgainAt);
  return at;
}
// After "Hasn't come up yet": when to ask again.
export const checkAgainAfter = (m, now = new Date()) => new Date(now.getTime() + (NOT_YET_WAIT[m.worry?.when] ?? DAY));
export const awaitingCheck = (m) => m.status === 'done' && !m.check && !!m.finishedAt;
export const checkOpen = (m, now = new Date()) => awaitingCheck(m) && now >= checkOpensAt(m);
// When it opens, in words. Short (chips): `after 7:05 PM`, `tomorrow`, `Thu`
// or `Oct 30`. Long: `after 7:05 PM`, `tomorrow after 6 PM`, `on Thu, Oct 23`.
export function checkOpensText(m, now = new Date(), { short = false } = {}) {
  const at = checkOpensAt(m);
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  if (days <= 0) return `after ${time}`;
  if (days === 1) return short ? 'tomorrow' : `tomorrow after ${time}`;
  if (short) return at.toLocaleDateString(undefined, days < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' });
  return `on ${at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

// Finished maps whose tomorrow check is open and not done yet.
export function pendingChecks(maps, now = new Date()) {
  return maps
    .filter((m) => checkOpen(m, now))
    .sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : 1));
}

// The weekly "send a summary" card. It shows from the chosen weekday until a
// summary is shared or the teen picks "Not this week", and only when there
// are maps since the last share. It stays off until there's a therapist to
// send to (named in Settings, or set up on the home computer).
export const therapistNamed = (settings) => !!(settings.therapistName?.trim() || settings.server?.toName);
export function summaryDue(settings, maps, now = new Date()) {
  if (settings.summaryDay == null || !therapistNamed(settings)) return null;
  const due = startOfDay(now);
  due.setDate(due.getDate() - ((due.getDay() - settings.summaryDay + 7) % 7));
  const last = settings.lastSharedAt ? new Date(settings.lastSharedAt) : null;
  if (last && last >= due) return null;
  if (settings.summarySkippedFor && new Date(settings.summarySkippedFor).getTime() === due.getTime()) return null;
  const count = maps.filter((m) => m.status !== 'active' && (!last || new Date(m.createdAt) > last)).length;
  return count ? { due, count } : null;
}

// ---- Scoreboard ----
export function weeklyScore(maps) {
  const weeks = new Map();
  for (const m of maps) {
    if (m.status !== 'done') continue;
    const key = startOfWeek(m.finishedAt).getTime();
    if (!weeks.has(key)) weeks.set(key, { weekStart: new Date(key), mapped: 0, yes: 0, partly: 0, no: 0, unchecked: 0 });
    const w = weeks.get(key);
    w.mapped++;
    if (m.check) w[m.check.happened]++;
    else w.unchecked++;
  }
  return [...weeks.values()].sort((a, b) => b.weekStart - a.weekStart);
}

export const criedWolf = (maps) => maps.filter((m) => m.check?.happened === 'no').length;

// Predicted odds against what happened, over checked maps.
export function oddsCheck(maps) {
  const checked = maps.filter((m) => m.status === 'done' && m.check && m.reality.odds != null);
  if (!checked.length) return null;
  const avg = Math.round(checked.reduce((s, m) => s + m.reality.odds, 0) / checked.length);
  const count = (h) => checked.filter((m) => m.check.happened === h).length;
  return { checked: checked.length, avgPredicted: avg, yes: count('yes'), partly: count('partly'), no: count('no') };
}

// The behavior side of the checks: when the worry came true (fully or
// partly), did he cope; and did he do the next step he wrote down.
// Older checks without these answers are left out of each count.
export function behaviorCheck(maps) {
  const checked = maps.filter((m) => m.status === 'done' && m.check);
  const tally = (list, key, ids) => Object.fromEntries(ids.map((id) => [id, list.filter((m) => m.check[key] === id).length]));
  const cameTrue = checked.filter((m) => m.check.happened !== 'no' && m.check.coped);
  const stepAsked = checked.filter((m) => m.check.stepDone);
  return {
    cameTrue: cameTrue.length,
    coped: tally(cameTrue, 'coped', ['yes', 'partly', 'notreally', 'notneeded']),
    steps: stepAsked.length,
    step: tally(stepAsked, 'stepDone', ['yes', 'partly', 'no']),
  };
}

// ---- Patterns ----
export function patterns(maps, since = null) {
  const done = maps.filter((m) => m.status === 'done' && (!since || new Date(m.finishedAt) >= since));
  const categories = {};
  const fears = {};
  let before = 0;
  let after = 0;
  for (const m of done) {
    categories[m.category] = (categories[m.category] || 0) + 1;
    fears[m.core.fear] = (fears[m.core.fear] || 0) + 1;
    before += m.body.before;
    after += m.next.after;
  }
  const n = done.length;
  return {
    total: n,
    categories,
    fears,
    avgBefore: n ? Math.round((before / n) * 10) / 10 : null,
    avgAfter: n ? Math.round((after / n) * 10) / 10 : null,
    withParent: done.filter((m) => m.withParent).length,
    detours: done.reduce((s, m) => s + m.detours.length, 0),
  };
}

// Category counts for each of the last `weeks` weeks, newest first.
export function categoriesByWeek(maps, weeks = 8, now = new Date()) {
  const rows = [];
  const thisWeek = startOfWeek(now);
  for (let i = 0; i < weeks; i++) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const counts = {};
    for (const m of maps) {
      if (m.status !== 'done') continue;
      const t = new Date(m.finishedAt);
      if (t >= start && t < end) counts[m.category] = (counts[m.category] || 0) + 1;
    }
    rows.push({ weekStart: start, counts });
  }
  return rows;
}
