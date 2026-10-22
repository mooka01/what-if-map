// "Share with my therapist": a readable summary the teen sees before sharing.
import {
  APP_NAME, DISCLAIMER, STEP_NAMES, WHEN, BODY_SPOTS, CATEGORIES, CORE_FEARS, HISTORY, FRIEND, COPE,
  HAPPENED_LABEL, COPED_LABEL, STEP_LABEL, LADDER,
} from './content.js';
import { patterns, oddsCheck, behaviorCheck } from './logic.js';
import { h, fmtDateTime, fmtShort } from './ui.js';

const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;
const cat = (id) => {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? `${c.id}. ${c.name}` : '—';
};
const fear = (id) => label(CORE_FEARS, id);

// One map as labelled lines: [[label, value], ...]
export function mapLines(m) {
  const rows = [];
  const add = (k, v) => v != null && v !== '' && rows.push([k, v]);
  if (m.status === 'stopped') {
    const at = m.safety.find((s) => s.trigger === 'keyword');
    add('Status', `Stopped at "${STEP_NAMES[at?.step] || 'a step'}". The safety screen was shown.`);
  } else if (m.status === 'active') {
    add('Status', 'Not finished yet');
  }
  add('When', m.worry.when && label(WHEN, m.worry.when));
  if (m.body.spots.length) add('Body', `${m.body.spots.map((s) => label(BODY_SPOTS, s)).join(', ')} · ${m.body.before ?? '–'}/10`);
  add('Kind', m.category && cat(m.category));
  if (m.safety.some((s) => s.trigger === 'category')) add('Safety screen', 'Shown (something real happened)');
  if (m.core.chain.length) add('Dig', m.core.chain.map(fear).join(' → '));
  add('Core fear', m.core.fear && fear(m.core.fear));
  if (m.reality.odds != null) {
    add('Odds', `${m.reality.odds}%${m.reality.history ? ` · Happened before: ${label(HISTORY, m.reality.history)}` : ''}`);
  }
  if (m.reality.friend) {
    add('Friend would say', m.reality.friend === 'own' ? `"${m.reality.friendText}"` : label(FRIEND, m.reality.friend));
  }
  if (m.cope.picks.length) {
    add('If it happened, I would', m.cope.picks.map((p) => (p === 'own' ? `My own plan: ${m.cope.ownText}` : label(COPE, p))).join('; '));
  }
  if (m.act.canAct === 'yes') add('Right now', `I’ll do this: ${m.act.text}`);
  if (m.act.canAct === 'no') add('Right now', 'Nothing to do yet, so I parked it');
  if (m.status === 'done') add('Drawings', m.sketch.skipped ? 'Skipped' : [m.sketch.beforePng && 'before', m.sketch.afterPng && 'after'].filter(Boolean).join(' and '));
  add('Today I will', m.next.text);
  if (m.status === 'done') add('Body after', `${m.next.after}/10`);
  if (m.detours.length) {
    add(`Changed answers (${m.detours.length})`, m.detours.map((d) => `"${d.reason}" (${STEP_NAMES[d.from]})`).join('; '));
  }
  if (m.withParent) add('With a parent', 'Yes');
  if (m.check) {
    add('Tomorrow check', [
      HAPPENED_LABEL[m.check.happened], `How bad: ${m.check.howBad}/10`, COPED_LABEL[m.check.coped],
      m.check.stepDone && STEP_LABEL[m.check.stepDone], `I predicted ${m.reality.odds}%`,
    ].filter(Boolean).join(' · '));
  }
  return rows;
}

function numbers(maps) {
  const done = maps.filter((m) => m.status === 'done');
  const p = patterns(done);
  const o = oddsCheck(done);
  const rows = [];
  rows.push(['Maps finished', `${done.length}${p.withParent ? ` (with a parent: ${p.withParent})` : ''}`]);
  const stopped = maps.filter((m) => m.status === 'stopped').length;
  if (stopped) rows.push(['Stopped for the safety screen', String(stopped)]);
  if (o) {
    rows.push(['Tomorrow checks', `${o.checked} (came true ${o.yes} · partly ${o.partly} · didn’t happen ${o.no})`]);
    rows.push(['Average odds I predicted', `${o.avgPredicted}%`]);
  }
  const b = behaviorCheck(done);
  if (b.cameTrue) {
    const notNeeded = b.coped.notneeded ? ` · didn’t need to ${b.coped.notneeded}` : '';
    rows.push(['When it came true, I coped', `yes ${b.coped.yes} · partly ${b.coped.partly} · not really ${b.coped.notreally}${notNeeded} (of ${b.cameTrue})`]);
  }
  if (b.steps) rows.push(['Next steps done', `yes ${b.step.yes} · partly ${b.step.partly} · not yet ${b.step.no} (of ${b.steps} checked)`]);
  if (p.total) {
    rows.push(['Body check, average', `${p.avgBefore}/10 before → ${p.avgAfter}/10 after`]);
    rows.push(['Kinds of worry', countList(p.categories, cat)]);
    rows.push(['Core fears', countList(p.fears, fear)]);
  }
  return rows;
}

// The ladder: the step he's on now, plus any step with tries in the range.
// ladder = { steps, tries }, tries already limited to the range.
function ladderBlocks(ladder) {
  if (!ladder?.steps?.length) return [];
  const now = ladder.steps[ladder.steps.length - 1];
  const ids = [...new Set([...ladder.tries.map((t) => t.stepId), now.id])];
  return ladder.steps
    .filter((s) => ids.includes(s.id))
    .map((s) => {
      const tries = ladder.tries.filter((t) => t.stepId === s.id);
      return {
        title: `${s === now ? 'Step now' : 'Earlier step'}: ${s.text} (since ${fmtShort(s.from)})`,
        lines: tries.length
          ? tries.map((t) => `${fmtShort(t.at)}: ${LADDER.didLabel[t.did]} · thought ${t.thought}, was ${t.was}`)
          : ['No tries logged in this range'],
      };
    });
}

const countList = (counts, name) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${name(id)} ${n}`)
    .join(' · ');

// "Oct 5 to Oct 12", or one date.
export function summaryRange(maps) {
  if (!maps.length) return '';
  const times = maps.map((m) => m.createdAt).sort();
  const a = fmtShort(times[0]);
  const b = fmtShort(times[times.length - 1]);
  return a === b ? a : `${a} to ${b}`;
}

function rangeLine(maps) {
  if (!maps.length) return 'No maps picked';
  return `${maps.length} map${maps.length === 1 ? '' : 's'}, ${summaryRange(maps)}`;
}

// Drawings as email attachments, named by the map's date and time so they
// match the summary text.
export function drawingAttachments(maps) {
  const out = [];
  for (const m of maps) {
    const when = fmtDateTime(m.createdAt).replace(/:/g, '.');
    if (m.sketch?.beforePng) out.push({ name: `${when} before.png`, dataUrl: m.sketch.beforePng });
    if (m.sketch?.afterPng) out.push({ name: `${when} after.png`, dataUrl: m.sketch.afterPng });
  }
  return out;
}

export function summaryText(maps, parked = [], ladder = null) {
  const ordered = [...maps].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const out = [`${APP_NAME} summary`, rangeLine(ordered), DISCLAIMER, ''];
  out.push('IN NUMBERS');
  for (const [k, v] of numbers(ordered)) out.push(`${k}: ${v}`);
  const blocks = ladderBlocks(ladder);
  if (blocks.length) {
    out.push('', 'LADDER (tries: did all or part · how hard I thought it would be, 0-10 · how hard it was)');
    for (const b of blocks) out.push(b.title, ...b.lines.map((l) => `- ${l}`));
  }
  out.push('', 'MAPS');
  for (const m of ordered) {
    out.push('', `— ${fmtDateTime(m.createdAt)} —`, `What if ${m.worry.text || '…'}?`);
    for (const [k, v] of mapLines(m)) out.push(`${k}: ${v}`);
  }
  if (parked.length) {
    out.push('', 'PARKED WORRIES');
    for (const p of parked) out.push(`- What if ${p.text}?`);
  }
  return out.join('\n');
}

// Printable version, with drawings. Rendered into #print-root, then window.print().
export function printReport(maps, parked = [], ladder = null) {
  const ordered = [...maps].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const dl = (rows) => h('dl', null, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
  const blocks = ladderBlocks(ladder);
  return h('article', { class: 'report' },
    h('h1', null, `${APP_NAME} summary`),
    h('p', null, rangeLine(ordered)),
    h('p', { class: 'report-note' }, DISCLAIMER),
    h('h2', null, 'In numbers'),
    dl(numbers(ordered)),
    blocks.length
      ? [h('h2', null, 'Ladder'),
          h('p', { class: 'report-note' }, 'Each try: did all or part · how hard I thought it would be (0–10) · how hard it was.'),
          blocks.map((b) => [h('h3', null, b.title), h('ul', null, b.lines.map((l) => h('li', null, l)))])]
      : null,
    h('h2', null, 'Maps'),
    ordered.map((m) =>
      h('section', { class: 'report-map' },
        h('h3', null, `What if ${m.worry.text || '…'}?`),
        h('p', { class: 'report-date' }, fmtDateTime(m.createdAt)),
        dl(mapLines(m)),
        m.sketch.beforePng || m.sketch.afterPng
          ? h('div', { class: 'report-drawings' },
              m.sketch.beforePng ? h('figure', null, h('img', { src: m.sketch.beforePng, alt: 'Before drawing' }), h('figcaption', null, 'Before')) : null,
              m.sketch.afterPng ? h('figure', null, h('img', { src: m.sketch.afterPng, alt: 'After drawing' }), h('figcaption', null, 'After')) : null,
            )
          : null,
      ),
    ),
    parked.length ? [h('h2', null, 'Parked worries'), h('ul', null, parked.map((p) => h('li', null, `What if ${p.text}?`)))] : null,
  );
}
