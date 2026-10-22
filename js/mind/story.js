// A map told back in the teen's own voice: first person, plain words, no
// clinical labels. Used for the 3D world captions and the "Read it" view.
// Same house rules as content.js: no reassurance, no praise.
import { WHEN, BODY_SPOTS, CATEGORIES, CORE_FEARS, HISTORY, FRIEND, COPE, STEP_NAMES } from '../content.js';

const find = (list, id) => list.find((x) => x.id === id);
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const listJoin = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const WHEN_TEXT = { today: 'today', tomorrow: 'tomorrow', week: 'this week', later: 'later on' };

// Ordered beats: [{ id, title, text }]. Only beats the map actually has.
export function storyBeats(m) {
  const beats = [];
  const add = (id, title, text) => text && beats.push({ id, title, text });

  if (m.worry.text) {
    add('worry', 'The worry', `What if ${m.worry.text}?${m.worry.when ? ` It felt like it would happen ${WHEN_TEXT[m.worry.when] || lower(find(WHEN, m.worry.when)?.label)}.` : ''}`);
  }
  if (m.body.spots.length && m.body.before != null) {
    const spots = m.body.spots.filter((s) => s !== 'nowhere').map((s) => lower(find(BODY_SPOTS, s)?.label));
    add('body', 'My body', spots.length
      ? `I felt it in my ${listJoin(spots)}. It was a ${m.body.before} out of 10.`
      : `I didn't feel it in my body right then. It was a ${m.body.before} out of 10.`);
  }
  const cat = find(CATEGORIES, m.category);
  if (cat) add('zone', 'Where it lives', `A ${cat.name.toLowerCase()} worry: ${lower(cat.desc)}.`);

  const chain = m.core.chain || [];
  if (chain.length) {
    const steps = chain.map((id) => find(CORE_FEARS, id)?.ifThat).filter(Boolean);
    add('dig', 'Digging down', `If that happened, the worst part would be… ${steps.join('. And then… ')}.`);
  }
  const fear = find(CORE_FEARS, m.core.fear);
  if (fear) {
    const how = { repeat: ' I kept coming back to this one.', bottom: ' Nothing was worse than that.' }[m.core.method] || '';
    add('core', 'Underneath it all', `${fear.label}.${how}`);
  }

  const r = m.reality;
  if (r.odds != null) {
    const parts = [`I gave it ${r.odds}% odds.`];
    if (r.history) parts.push(`It has really happened before: ${lower(find(HISTORY, r.history)?.label)}.`);
    if (r.friend) {
      const said = r.friend === 'own' ? `“${r.friendText}”` : find(FRIEND, r.friend)?.label.replace(/^"|"$/g, '');
      parts.push(`My best friend or cousin would say: ${r.friend === 'own' ? said : `“${said}”`}`);
    }
    add('reality', 'Reality check', parts.join(' '));
  }

  if (m.cope.picks.length) {
    const tools = m.cope.picks.map((p) => (p === 'own' ? m.cope.ownText : lower(find(COPE, p)?.label)));
    add('tools', 'My tools', `If it did happen, I would: ${tools.join('; ')}.`);
  }

  if (m.act.canAct === 'yes') add('act', 'Right then', `I could do something right away: ${m.act.text}.`);
  if (m.act.canAct === 'no') add('act', 'Right then', 'There was nothing to do right then, so I parked it.');

  if (m.next.text) {
    add('next', 'My next step', `Today I will: ${m.next.text}.${m.next.after != null && m.body.before != null ? ` My body went from ${m.body.before} to ${m.next.after}.` : ''}`);
  }

  if (m.detours.length) {
    add('detours', 'Changed my mind', m.detours.length === 1
      ? `I went back once and changed an answer: “${m.detours[0].reason}”.`
      : `I went back ${m.detours.length} times and changed answers: ${m.detours.map((d) => `“${d.reason}”`).join(', ')}.`);
  }

  if (m.check) {
    const happened = { yes: 'It happened.', partly: 'Part of it happened.', no: 'It didn’t happen.' }[m.check.happened];
    const coped = { yes: 'I coped.', partly: 'I partly coped.', notreally: 'I didn’t really cope.', notneeded: 'I didn’t need to cope.' }[m.check.coped];
    const step = { yes: ' I did my next step.', partly: ' I partly did my next step.', no: ' I haven’t done my next step yet.' }[m.check.stepDone] || '';
    add('check', 'The check', `${happened} How bad it really was: ${m.check.howBad} out of 10. ${coped}${step}${m.check.happened === 'no' ? ' My brain cried wolf.' : ''}`);
  }

  if (m.status === 'stopped') {
    const at = m.safety.find((s) => s.trigger === 'keyword');
    add('stopped', 'Stopped here', `This map stopped at “${STEP_NAMES[at?.step] || 'a step'}” and pointed me to a trusted adult.`);
  } else if (m.status === 'active') {
    add('unfinished', 'Not finished', 'This map isn’t finished yet.');
  }
  return beats;
}

// Short tags for nodes in the 3D world.
export function shortTags(m) {
  const fear = find(CORE_FEARS, m.core.fear);
  const cat = find(CATEGORIES, m.category);
  const spots = m.body.spots.filter((s) => s !== 'nowhere').map((s) => find(BODY_SPOTS, s)?.label.split(' ')[0]);
  const chain = m.core.chain || [];
  const steps = m.core.fear ? chain.slice(0, -1) : chain;
  const short = (s, n = 4) => {
    const words = String(s).split(/\s+/);
    return words.length > n ? `${words.slice(0, n).join(' ')}…` : s;
  };
  return {
    worry: m.worry.text ? `What if ${m.worry.text}?` : 'The worry',
    body: m.body.before != null ? `${spots.length ? spots.join(' + ') : 'Body'} · ${m.body.before}/10` : null,
    zone: cat ? `${cat.name} zone` : null,
    core: fear ? fear.label : null,
    digSteps: steps.map((id) => find(CORE_FEARS, id)?.label),
    reality: m.reality.odds != null ? `${m.reality.odds}% odds` : null,
    tools: m.cope.picks.map((p) => short(p === 'own' ? m.cope.ownText : find(COPE, p)?.label)),
    act: m.act.canAct === 'yes' ? 'Did something' : m.act.canAct === 'no' ? 'Parked it' : null,
    next: m.next.text ? `Today: ${m.next.text}` : null,
    check: m.check ? { yes: 'It happened', partly: 'Partly happened', no: 'Didn’t happen' }[m.check.happened] : null,
  };
}
