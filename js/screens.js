// Everything outside the map flow.
import {
  APP_NAME, DISCLAIMER, PRIVACY, STEP_NAMES, CATEGORIES, CORE_FEARS, CHECK_HAPPENED, CHECK_COPED, CHECK_NOT_YET, CHECK_STEP,
  HAPPENED_LABEL, STEP_RESULT, PARENT_TIPS, PARENT_GUIDE, SAFETY, HUB_SIGNS,
} from './content.js';
import {
  state, activeMap, getMap, newMap, saveMap, saveSettings, openParked, updateParked, removeParked,
  exportAll, importAll, wipeAll, stepId, ladderStep, triesFor,
} from './store.js';
import {
  mapsStartedToday, pendingChecks, checkOpen, awaitingCheck, checkOpensText, checkAgainAfter, therapistNamed, weeklyScore, criedWolf, oddsCheck,
  behaviorCheck, patterns, categoriesByWeek, summaryDue, startOfDay, DAY,
} from './logic.js';
import { summaryText, summaryRange, drawingAttachments, printReport } from './report.js';
import { emailReady, therapistName, refreshServer, sendSummary, queueSummary, discardQueued, flushOutbox } from './home.js';
import { h, icon, iconButton, choices, slider, textField, confirmDialog, toast, fmtDate, fmtDateTime, fmtShort, smsHref } from './ui.js';
import { parkSheet, parentTip } from './flow.js';
import { hasPin, setPin, clearPin, choosePin } from './lock.js';
import { applyTheme } from './theme.js';
import { nav } from './nav.js';
import { mind } from './mind/index.js';
import { storyTimeline } from './storyView.js';
import { replayScreen } from './game/replay.js';
import { gameWorld } from './game/index.js';
import { times } from './ladder.js';

const page = (cls, ...kids) => h('div', { class: `screen ` }, h('main', { class: 'page' }, kids));

// Hub screens say which island they belong to; the router wraps them into
// the game world (or leaves them as plain pages in Calm mode).
let hubSpec = null;
const asHub = (name, opts = {}) => (hubSpec = { name, ...opts });
export function takeHub() {
  const s = hubSpec;
  hubSpec = null;
  return s;
}
const pageHeader = (title, ...actions) =>
  h('header', { class: 'page-header' }, h('h1', { tabindex: '-1' }, title), actions.length ? h('div', { class: 'page-actions' }, actions) : null);
const backLink = (route, text = 'Back') =>
  h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onClick: () => nav.go(route) }, icon('back', 20), text);
const fearLabel = (id) => CORE_FEARS.find((f) => f.id === id)?.label;
const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name;

// ---- Starting a map ----

export async function startMap({ withParent = false, parked = null } = {}) {
  if (activeMap()) return nav.go('map');
  if (mapsStartedToday(state.maps) >= state.settings.cap) return nav.go('cap');
  const map = newMap({ withParent, worryText: parked?.text || '', parkedId: parked?.id || null });
  if (parked) {
    parked.usedMapId = map.id;
    await updateParked(parked);
  }
  await saveMap(map);
  nav.go('map');
}

// ---- Home ----

export function homeScreen() {
  asHub('home', { world: 'normal' });
  const active = activeMap();
  const checks = pendingChecks(state.maps);
  const today = mapsStartedToday(state.maps);
  const cap = state.settings.cap;
  const parked = openParked();

  return page('home',
    pageHeader(APP_NAME,
      h('button', { type: 'button', class: 'btn btn-secondary btn-small', onClick: () => nav.go('now') }, icon('breathe', 18), 'Right now'),
      iconButton('settings', 'Settings', () => nav.go('settings'))),

    checks.map((m) =>
      h('section', { class: 'card card-check' },
        h('p', { class: 'card-label' }, checkTitle(m)),
        h('p', { class: 'card-worry' }, `What if ${m.worry.text}?`),
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => nav.go(`check/${m.id}`) }, 'Check it'),
      ),
    ),

    ladderCard(),
    setupCard(),
    outboxCards(),
    weeklyCard(),

    active
      ? h('section', { class: 'card card-active' },
          h('p', { class: 'card-label' }, `Unfinished map · Step ${active.step + 1}: ${STEP_NAMES[stepId(active)]}`),
          active.worry.text ? h('p', { class: 'card-worry' }, `What if ${active.worry.text}?`) : null,
          h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => nav.go('map') }, 'Continue my map', icon('next', 20)),
        )
      : h('section', { class: 'start' },
          h('button', { type: 'button', class: 'btn btn-primary btn-block btn-big', onClick: () => startMap() }, 'New worry map'),
          h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: () => startMap({ withParent: true }) }, icon('parent', 20), 'Map it with a parent'),
          h('p', { class: 'hint center' }, `Maps today: ${Math.min(today, cap)} of ${cap}`),
        ),

    h('section', { class: 'parked' },
      h('div', { class: 'section-head' },
        h('h2', null, 'Parked worries'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onClick: () => parkSheet() }, icon('park', 20), 'Park one'),
      ),
      parked.length
        ? h('ul', { class: 'parked-list' },
            parked.map((p) =>
              h('li', null,
                h('span', { class: 'parked-text' }, `What if ${p.text}?`),
                h('div', { class: 'parked-actions' },
                  h('button', {
                    type: 'button',
                    class: 'btn btn-secondary btn-small',
                    disabled: !!active,
                    title: active ? 'Finish your current map first' : null,
                    onClick: () => startMap({ parked: p }),
                  }, 'Map this'),
                  iconButton('close', 'Remove this parked worry', async () => {
                    await removeParked(p.id);
                    nav.render();
                  }),
                ),
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'A new worry that shows up in the middle of a map goes here for later.'),
    ),

    h('nav', { class: 'home-links', 'aria-label': 'More' },
      ladderStep() ? null : h('a', { href: '#/ladder', class: 'link-row' }, icon('ladder', 20), 'Working on a ladder with my therapist'),
      h('a', { href: '#/help', class: 'link-row' }, icon('message', 20), 'Need to talk to someone?'),
      h('a', { href: '#/guide', class: 'link-row' }, icon('book', 20), 'Parent guide: doing a map together'),
    ),
    h('p', { class: 'disclaimer' }, DISCLAIMER),
  );
}

// The step he's on in his therapist's ladder, with a quick way to log a try.
function ladderCard() {
  const step = ladderStep();
  if (!step) return null;
  const n = triesFor(step.id).length;
  return h('section', { class: 'card card-ladder' },
    h('p', { class: 'card-label' }, 'My ladder step'),
    h('p', { class: 'card-worry' }, step.text),
    h('p', { class: 'muted' }, n ? `Tried ${times(n)}` : 'Not tried yet'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => nav.go('ladder/try') }, 'I tried it'),
      h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => nav.go('ladder') }, 'Open'),
    ),
  );
}

// One setup card at a time, most important first:
// 1. a parent adds the "Text mom or dad" numbers;
// 2. on iPhone, add the app to the Home Screen (Safari can clear a website's
//    data after 7 days without use; an installed app keeps it);
// 3. back up the maps every couple of weeks.
const isIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function setupCard() {
  const s = state.settings;
  const now = Date.now();
  const snoozed = (k) => s.snooze?.[k] && new Date(s.snooze[k]).getTime() > now;
  const notNow = (k, days, label = 'Not now') =>
    h('button', {
      type: 'button',
      class: 'btn btn-ghost',
      onClick: async () => {
        await saveSettings({ snooze: { ...s.snooze, [k]: new Date(now + days * DAY).toISOString() } });
        nav.render();
      },
    }, label);
  const card = (label, text, ...buttons) =>
    h('section', { class: 'card card-setup' }, h('p', { class: 'card-label' }, label), h('p', null, text), h('div', { class: 'row' }, buttons));

  if (!s.contacts.some((c) => c.phone) && !snoozed('contacts')) {
    return card('For a parent',
      'Add a phone number for the “Text mom or dad” buttons. They show on the safety screen and the Right now screen.',
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => nav.go('settings') }, 'Set up'),
      notNow('contacts', 14));
  }
  if (isIOS() && !isInstalled() && !snoozed('install')) {
    return card('Keep your maps',
      'On iPhone, Safari can clear a website’s data after a week without use. Add this app to your Home Screen: tap Share, then “Add to Home Screen.”',
      notNow('install', 30, 'Got it'));
  }
  const finished = state.maps.filter((m) => m.status === 'done').length;
  const stale = !s.lastBackupAt || now - new Date(s.lastBackupAt).getTime() > 14 * DAY;
  if (finished >= 3 && stale && !snoozed('backup')) {
    return card('Back up',
      `Save a copy of your maps in case this phone is lost or replaced.${s.lastBackupAt ? ` Last backup: ${fmtDate(s.lastBackupAt)}.` : ''}`,
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: async () => { if (await backupNow()) nav.render(); } }, icon('download', 18), 'Back up now'),
      notNow('backup', 7));
  }
  return null;
}

// Summaries the teen sent while the home computer couldn't be reached.
function outboxCards() {
  return state.outbox.map((item) =>
    h('section', { class: 'card' },
      h('p', { class: 'card-label' }, 'Summary waiting to send'),
      h('p', null, `For ${therapistName()}${item.payload.range ? `, ${item.payload.range}` : ''}.`),
      item.lastError ? h('p', { class: 'hint' }, item.lastError) : null,
      h('div', { class: 'row' },
        h('button', {
          type: 'button',
          class: 'btn btn-secondary',
          onClick: async () => {
            const sent = await flushOutbox();
            toast(sent ? `Sent to ${therapistName()}.` : 'Still waiting. It sends when the app can reach the home computer.');
            nav.render();
          },
        }, 'Try now'),
        h('button', {
          type: 'button',
          class: 'btn btn-ghost',
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Discard this summary?',
              text: 'It won’t be sent. You can make a new one from Share.',
              confirm: 'Discard',
            });
            if (!ok) return;
            await discardQueued(item.id);
            nav.render();
          },
        }, 'Discard'),
      ),
    ),
  );
}

function weeklyCard() {
  const due = summaryDue(state.settings, state.maps);
  if (!due) return null;
  return h('section', { class: 'card card-check' },
    h('p', { class: 'card-label' }, 'Weekly summary'),
    h('p', { class: 'card-worry' }, `Send this week’s summary to ${therapistName()}?`),
    h('p', { class: 'muted' }, `${due.count} map${due.count === 1 ? '' : 's'} since the last one. You pick what goes in.`),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-primary', onClick: () => nav.go('share') }, 'Review and send'),
      h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        onClick: async () => {
          await saveSettings({ summarySkippedFor: due.due.toISOString() });
          nav.render();
        },
      }, 'Not this week'),
    ),
  );
}

export function capScreen() {
  asHub('cap', { world: 'flat' });
  const contacts = state.settings.contacts.filter((c) => c.phone);
  return page('cap',
    h('h1', { tabindex: '-1' }, `That’s ${state.settings.cap} map${state.settings.cap === 1 ? '' : 's'} today.`),
    h('p', { class: 'lead' }, 'Take a break. If you need more than that today, tell an adult.'),
    h('div', { class: 'stack' },
      contacts.map((c) => h('a', { class: 'btn btn-secondary btn-block', href: smsHref(c.phone, SAFETY.smsBody) }, icon('message'), `Text ${c.name || 'mom or dad'}`)),
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => nav.go('') }, 'Back to home'),
    ),
  );
}

// ---- Onboarding ----

export function onboardingScreen() {
  asHub('onboarding', { world: 'tall' });
  return page('onboarding',
    h('div', { class: 'onboard-mark', 'aria-hidden': 'true' }, h('img', { src: 'icons/icon.svg', alt: '', width: '72', height: '72' })),
    h('h1', { tabindex: '-1' }, APP_NAME),
    h('p', { class: 'lead' }, 'Write the worry. Follow the same steps every time. End with one next step.'),
    // his avatar, first thing (optional: the defaults work)
    gameWorld.enabled() ? avatarSection({ title: 'My look' }) : null,
    h('ul', { class: 'points' },
      h('li', null, DISCLAIMER),
      h('li', null, PRIVACY),
      h('li', null, 'If you’re ever in crisis, call or text 988, or tell an adult right away.'),
    ),
    h('button', {
      type: 'button',
      class: 'btn btn-primary btn-block btn-big',
      onClick: async () => {
        await saveSettings({ onboarded: true });
        nav.go('');
      },
    }, 'Start'),
    h('a', { href: '#/guide', class: 'link-row' }, icon('book', 20), 'For parents: how to do a map together'),
  );
}

// ---- Maps ----

const statusChip = (m) => {
  if (m.status === 'active') return h('span', { class: 'chip' }, 'Unfinished');
  if (m.status === 'stopped') return h('span', { class: 'chip' }, 'Stopped');
  if (m.check) return h('span', { class: 'chip chip-accent' }, HAPPENED_LABEL[m.check.happened]);
  if (checkOpen(m)) return h('span', { class: 'chip chip-ready' }, 'Ready to check');
  return h('span', { class: 'chip chip-quiet' }, `Check ${checkOpensText(m, new Date(), { short: true })}`);
};

export function mapsScreen() {
  asHub('maps', { world: 'short' });
  return page('maps',
    pageHeader('My maps', h('button', { type: 'button', class: 'btn btn-secondary btn-small', onClick: () => nav.go('share') }, icon('share', 18), 'Share')),
    state.maps.length
      ? h('ul', { class: 'map-list' },
          state.maps.map((m) =>
            h('li', null,
              h('a', { href: m.status === 'active' ? '#/map' : `#/maps/${m.id}`, class: 'map-item' },
                h('span', { class: 'map-item-top' }, h('span', { class: 'map-date' }, fmtDate(m.createdAt)), statusChip(m)),
                h('span', { class: 'map-worry' }, m.worry.text ? `What if ${m.worry.text}?` : 'No worry written yet'),
                m.status === 'done'
                  ? h('span', { class: 'map-meta' }, `${catName(m.category)} · ${fearLabel(m.core.fear)}`)
                  : null,
              ),
            ),
          ),
        )
      : h('p', { class: 'muted' }, 'No maps yet.'),
  );
}

export function mapDetailScreen(id) {
  const m = getMap(id);
  if (!m) return page('detail', backLink('maps'), h('p', null, 'That map isn’t here.'));
  // The tomorrow check: the button once it's open, and when it opens before that.
  const checkBtn = checkOpen(m)
    ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: () => nav.go(`check/${m.id}`) }, 'Check this worry')
    : awaitingCheck(m)
      ? h('p', { class: 'hint check-when' }, `The check opens ${checkOpensText(m)}. Then I mark if it happened, how bad it really was, and if I did my next step.`)
      : null;
  const title = h('h1', { tabindex: '-1', class: 'detail-title' }, `What if ${m.worry.text || '…'}?`);

  // His map as a replay of his run through the course, not a report.
  if (gameWorld.enabled()) return replayScreen(m, { extra: checkBtn });
  const why = mind.status();
  return page('detail',
    backLink('maps', 'My maps'),
    title,
    h('p', { class: 'muted' }, fmtDateTime(m.createdAt)),
    // Say why it's flat, unless flat was his choice.
    why.reason !== 'calm' ? h('p', { class: 'hint' }, mind.statusText()) : null,
    checkBtn,
    storyTimeline(m),
    m.status === 'done' ? h('p', { class: 'hint' }, 'Finished maps stay as they are. A new worry gets a new map.') : null,
  );
}

// ---- Tomorrow check ----

// "Check yesterday's worry", or today's, or (for a later worry) "this worry".
function checkTitle(m, now = new Date()) {
  const days = Math.round((startOfDay(now) - startOfDay(m.finishedAt)) / DAY);
  return days === 0 ? 'Check today’s worry' : days === 1 ? 'Check yesterday’s worry' : 'Check this worry';
}

export function checkScreen(id) {
  const m = getMap(id);
  if (!m || m.status !== 'done') return page('check', backLink(''), h('p', null, 'That map isn’t here.'));
  if (m.check) return checkResult(m);

  const step = m.next?.text?.trim();
  const answer = { happened: null, howBad: null, coped: null, stepDone: null };
  const notYet = () => answer.happened === CHECK_NOT_YET.id;
  const save = h('button', { type: 'button', class: 'btn btn-primary btn-block', disabled: true }, 'Save check');
  const later = h('p', { class: 'hint', hidden: true }, 'Nothing gets counted. The check comes back later.');
  const rest = h('div', { class: 'check-rest' });
  const refresh = () => {
    rest.hidden = notYet();
    later.hidden = !notYet();
    save.textContent = notYet() ? 'Ask me again later' : 'Save check';
    save.disabled = !notYet() && (!answer.happened || answer.howBad == null || !answer.coped || (step && !answer.stepDone));
  };
  save.addEventListener('click', async () => {
    if (notYet()) {
      // not an outcome: ask again later, count nothing
      m.checkAgainAt = checkAgainAfter(m).toISOString();
      await saveMap(m);
      toast(`The check comes back ${checkOpensText(m)}.`);
      nav.go('');
      return;
    }
    const { happened, howBad, coped, stepDone } = answer;
    m.check = { at: new Date().toISOString(), happened, howBad, coped, ...(step ? { stepDone } : {}) };
    await saveMap(m);
    nav.render();
  });
  const set = (k) => (v) => {
    answer[k] = v;
    refresh();
    gameWorld.update({ answer: { ...answer, last: k } });
  };
  asHub('check', { world: 'tall', extra: { check: { map: m, answer: { ...answer } } } });

  rest.append(
    h('section', { class: 'q' }, slider({ label: 'How bad was it really?', value: null, low: 'not at all', high: 'the worst', onChange: set('howBad') })),
    h('section', { class: 'q' }, h('h2', { class: 'q-title' }, 'Did I cope?'),
      choices({ options: CHECK_COPED, value: null, layout: 'grid', label: 'Did I cope?', onChange: set('coped') })),
    step
      ? h('section', { class: 'q' }, h('h2', { class: 'q-title' }, 'Did I do my next step?'),
          h('p', { class: 'step-quote' }, `Today I will: ${step}`),
          choices({ options: CHECK_STEP, value: null, layout: 'grid', label: 'Did I do my next step?', onChange: set('stepDone') }))
      : null,
  );
  return page('check',
    backLink(''),
    h('h1', { tabindex: '-1' }, checkTitle(m)),
    h('p', { class: 'worry-quote' }, `What if ${m.worry.text}?`),
    h('p', { class: 'muted' }, `Mapped ${fmtDateTime(m.createdAt)}`),
    m.withParent ? parentTip('check') : null,
    h('section', { class: 'q' }, h('h2', { class: 'q-title' }, 'Did it happen?'),
      choices({ options: [...CHECK_HAPPENED, CHECK_NOT_YET], value: null, layout: 'grid', label: 'Did it happen?', onChange: set('happened') })),
    later,
    rest,
    save,
  );
}

function checkResult(m) {
  asHub('check', { world: 'tall', extra: { check: { map: m, result: m.check } } });
  const c = m.check;
  return page('check',
    h('h1', { tabindex: '-1' }, 'Check saved.'),
    h('p', { class: 'worry-quote' }, `What if ${m.worry.text}?`),
    h('div', { class: 'compare' },
      h('div', null, h('span', { class: 'ba-label' }, 'I predicted'), h('span', { class: 'ba-num' }, `${m.reality.odds}%`)),
      h('div', null, h('span', { class: 'ba-label' }, 'What happened'), h('span', { class: 'compare-text' }, HAPPENED_LABEL[c.happened])),
    ),
    h('p', null, `How bad it really was: ${c.howBad}/10. Before the map it felt like ${m.body.before}/10.`),
    c.stepDone ? h('p', null, `My next step, “${m.next.text}”: ${STEP_RESULT[c.stepDone]}.`) : null,
    // the next step was his ladder step: log it there too, with its numbers
    c.stepDone && c.stepDone !== 'no' && ladderStep()?.text === m.next.text.trim()
      ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: () => nav.go('ladder/try') }, icon('ladder', 20), 'Log it as a ladder try')
      : null,
    c.happened === 'no' ? h('p', { class: 'card' }, `My brain cried wolf: ${criedWolf(state.maps)} times so far.`) : null,
    h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => nav.go('') }, 'Done'),
  );
}

// ---- Scoreboard ----

export function scoreScreen() {
  asHub('score', { world: 'short' });
  const weeks = weeklyScore(state.maps);
  const wolf = criedWolf(state.maps);
  const odds = oddsCheck(state.maps);
  const did = behaviorCheck(state.maps);
  const step = ladderStep();
  const stepTries = step ? triesFor(step.id) : [];
  return page('score',
    pageHeader('Scoreboard'),
    h('section', { class: 'hero' },
      h('span', { class: 'hero-num' }, String(wolf)),
      h('span', { class: 'hero-label' }, 'My brain cried wolf'),
      h('span', { class: 'hint' }, 'Checked worries that didn’t happen'),
    ),
    odds
      ? h('p', { class: 'card' },
          `On ${odds.checked} checked map${odds.checked === 1 ? '' : 's'}, I predicted ${odds.avgPredicted}% odds on average. ` +
            `Came true: ${odds.yes}. Partly: ${odds.partly}. Didn’t happen: ${odds.no}.`)
      : null,
    // The behavior side: coping when it did happen, and doing the next step.
    did.cameTrue
      ? h('p', { class: 'card' },
          `When it came true or partly came true (${times(did.cameTrue)}), I coped: ${did.coped.yes}. ` +
            `Partly: ${did.coped.partly}. Not really: ${did.coped.notreally}.${did.coped.notneeded ? ` Didn’t need to: ${did.coped.notneeded}.` : ''}`)
      : null,
    did.steps
      ? h('p', { class: 'card' },
          `My next steps, on ${did.steps} checked map${did.steps === 1 ? '' : 's'}: done ${did.step.yes}. Partly: ${did.step.partly}. Not yet: ${did.step.no}.`)
      : null,
    // His ladder step: how hard he thought each try would be, and how hard it was.
    stepTries.length
      ? h('p', { class: 'card' },
          `My ladder step: tried ${times(stepTries.length)}. I thought → it was: ` +
            `${stepTries.slice(-5).map((t) => `${t.thought} → ${t.was}`).join(', ')}.`)
      : null,
    // In the game, the fence and the week blocks are colored by outcome;
    // this says what each color means.
    gameWorld.enabled() && weeks.length
      ? h('p', { class: 'world-key', 'aria-hidden': 'true' },
          ['yes', 'partly', 'no', 'unchecked'].map((k) => h('span', null, h('i', { class: `swatch out-${k}` }), HUB_SIGNS.outcomes[k])))
      : null,
    h('h2', null, 'By week'),
    weeks.length
      ? h('div', { class: 'table-wrap' },
          h('table', { class: 'score-table' },
            h('thead', null, h('tr', null,
              h('th', { scope: 'col' }, 'Week of'),
              h('th', { scope: 'col' }, 'Mapped'),
              h('th', { scope: 'col' }, 'Came true'),
              h('th', { scope: 'col' }, 'Partly'),
              h('th', { scope: 'col' }, 'Didn’t happen'),
              h('th', { scope: 'col' }, 'Not checked'),
            )),
            h('tbody', null, weeks.map((w) =>
              h('tr', null,
                h('th', { scope: 'row' }, fmtShort(w.weekStart)),
                h('td', null, w.mapped), h('td', null, w.yes), h('td', null, w.partly), h('td', null, w.no), h('td', null, w.unchecked),
              ),
            )),
          ),
        )
      : h('p', { class: 'muted' }, 'Finish a map, then check it the next day. The numbers show up here.'),
  );
}

// ---- Patterns ----

let patternRange = 'month';
const RANGES = [
  { id: 'month', label: '4 weeks', days: 28 },
  { id: 'quarter', label: '3 months', days: 91 },
  { id: 'all', label: 'All time', days: null },
];

function bars(rows, label) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return h('ul', { class: 'bars', 'aria-label': label },
    rows.map((r) =>
      h('li', { class: 'bar-row', title: `${r.label}: ${r.n}` },
        h('span', { class: 'bar-label' }, r.label),
        h('span', { class: 'bar-line' },
          h('span', { class: 'bar-track' }, r.n ? h('span', { class: 'bar', style: `width:${(r.n / max) * 100}%` }) : null),
          h('span', { class: 'bar-value' }, String(r.n)),
        ),
      ),
    ),
  );
}

function weekGrid(maps) {
  const rows = categoriesByWeek(maps, 8);
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(r.counts)));
  return [h('div', { class: 'table-wrap' },
    h('table', { class: 'heat' },
      h('caption', { class: 'hint' }, 'Kinds of worry by week, last 8 weeks. Darker means more maps.'),
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, 'Week of'),
        CATEGORIES.map((c) => h('th', { scope: 'col', title: c.name, 'aria-label': c.name }, c.id)),
      )),
      h('tbody', null, rows.map((r) =>
        h('tr', null,
          h('th', { scope: 'row' }, fmtShort(r.weekStart)),
          CATEGORIES.map((c) => {
            const n = r.counts[c.id] || 0;
            const level = n ? Math.ceil((n / max) * 4) : 0;
            return h('td', { class: `heat-cell l${level}`, title: `Week of ${fmtShort(r.weekStart)}, ${c.name}: ${n}` }, n ? String(n) : '');
          }),
        ),
      )),
    ),
  ),
  h('p', { class: 'heat-key' }, CATEGORIES.map((c) => `${c.id} ${c.name}`).join(' · '))];
}

export function patternsScreen() {
  const range = RANGES.find((r) => r.id === patternRange);
  const since = range.days ? new Date(Date.now() - range.days * DAY) : null;
  const p = patterns(state.maps, since);
  asHub('patterns', { world: 'short', extra: { range: range.days } });
  return page('patterns',
    pageHeader('Patterns'),
    h('p', { class: 'muted' }, 'What shows up again and again. Good to bring to therapy.'),
    choices({
      options: RANGES,
      value: patternRange,
      layout: 'segmented',
      label: 'Time range',
      onChange: (v) => {
        patternRange = v;
        nav.render();
      },
    }),
    p.total
      ? [
          h('div', { class: 'kpis' },
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, 'Maps'), h('span', { class: 'kpi-value' }, String(p.total))),
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, 'Body, average'), h('span', { class: 'kpi-value' }, `${p.avgBefore} → ${p.avgAfter}`)),
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, 'With a parent'), h('span', { class: 'kpi-value' }, String(p.withParent))),
          ),
          h('h2', null, 'Kinds of worry'),
          bars(CATEGORIES.map((c) => ({ label: `${c.id}. ${c.name}`, n: p.categories[c.id] || 0 })), 'Kinds of worry'),
          h('h2', null, 'Core fears'),
          bars(
            CORE_FEARS.map((f) => ({ label: f.label, n: p.fears[f.id] || 0 })).sort((a, b) => b.n - a.n),
            'Core fears',
          ),
          h('h2', null, 'Over time'),
          weekGrid(state.maps),
        ]
      : h('p', { class: 'muted' }, 'No finished maps in this range yet.'),
    h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: () => nav.go('share') }, icon('share', 20), 'Share with my therapist'),
  );
}

// ---- Share ----

let shareRange = null;
const SHARE_RANGES = [
  { id: 'since', label: 'Since last share' },
  { id: 'week', label: 'Last 7 days', days: 7 },
  { id: 'month', label: 'Last 30 days', days: 30 },
  { id: 'all', label: 'All' },
];

export function shareScreen() {
  asHub('share', { world: 'flat' });
  const last = state.settings.lastSharedAt;
  const ranges = SHARE_RANGES.filter((r) => r.id !== 'since' || last);
  if (!ranges.find((r) => r.id === shareRange)) shareRange = last ? 'since' : 'week';
  const r = ranges.find((x) => x.id === shareRange);
  const from = r.id === 'since' ? new Date(last) : r.days ? new Date(Date.now() - r.days * DAY) : null;
  const inRange = state.maps.filter((m) => !from || new Date(m.createdAt) >= from);
  const picked = new Set(inRange.map((m) => m.id));
  let withParked = false;
  // his ladder step and the tries in this range (in by default; he can take it out)
  const hasLadder = !!ladderStep();
  let withLadder = hasLadder;
  const ladder = () => (withLadder ? { steps: state.ladder.steps, tries: state.ladder.tries.filter((t) => !from || new Date(t.at) >= from) } : null);

  const preview = h('pre', { class: 'preview', tabindex: '0', 'aria-label': 'Summary preview' });
  const selected = () => inRange.filter((m) => picked.has(m.id));
  const text = () => summaryText(selected(), withParked ? openParked() : [], ladder());
  const update = () => {
    preview.textContent = text();
    actions.forEach((b) => (b.disabled = picked.size === 0));
    drawingsRow.hidden = !selected().some((m) => m.sketch?.beforePng || m.sketch?.afterPng);
  };

  const markShared = () => saveSettings({ lastSharedAt: new Date().toISOString() });

  // Email through the home computer, when the app is hosted there.
  const server = state.settings.server;
  const email = emailReady();
  let withDrawings = true;
  const drawingsCb = h('input', { type: 'checkbox', id: 'pick-drawings', checked: true });
  drawingsCb.addEventListener('change', () => (withDrawings = drawingsCb.checked));
  const drawingsRow = h('label', { for: 'pick-drawings', class: 'pick' }, drawingsCb, h('span', null, 'Attach my drawings'));
  const sendStatus = h('p', { class: 'hint', role: 'status' });
  const emailBtn = h('button', {
    type: 'button',
    class: 'btn btn-primary btn-block',
    onClick: async () => {
      emailBtn.disabled = true;
      sendStatus.textContent = 'Sending…';
      const payload = {
        range: summaryRange(selected()),
        text: text(),
        attachments: withDrawings ? drawingAttachments(selected()) : [],
      };
      const res = await sendSummary(payload);
      if (res.ok) {
        await markShared();
        toast(`Sent to ${therapistName()}.`);
        return nav.go('');
      }
      if (res.retry) {
        await queueSummary(payload, res.error);
        await markShared();
        toast('Saved. It sends when the app can reach the home computer.');
        return nav.go('');
      }
      sendStatus.textContent = res.error;
      emailBtn.disabled = false;
    },
  }, icon('mail', 20), `Email to ${therapistName()}`);

  const actions = [
    email ? emailBtn : null,
    h('button', {
      type: 'button',
      class: `btn ${email ? 'btn-secondary' : 'btn-primary'} btn-block`,
      onClick: async () => {
        const t = text();
        if (navigator.share) {
          try {
            await navigator.share({ title: `${APP_NAME} summary`, text: t });
            await markShared();
            toast('Shared.');
          } catch (e) {
            if (e.name !== 'AbortError') toast('That didn’t work. Try Copy instead.');
          }
        } else if (await copy(t)) {
          await markShared();
          toast('Copied. Paste it in a message or email.');
        }
      },
    }, icon('share', 20), email ? 'Share another way…' : 'Share…'),
    h('button', {
      type: 'button',
      class: 'btn btn-secondary btn-block',
      onClick: async () => {
        if (await copy(text())) {
          await markShared();
          toast('Copied.');
        }
      },
    }, icon('copy', 20), 'Copy text'),
    h('button', {
      type: 'button',
      class: 'btn btn-secondary btn-block',
      onClick: async () => {
        const root = document.getElementById('print-root');
        root.replaceChildren(printReport(selected(), withParked ? openParked() : [], ladder()));
        await markShared();
        window.print();
      },
    }, icon('print', 20), 'Print or save as PDF'),
  ].filter(Boolean);

  const list = inRange.length
    ? h('ul', { class: 'pick-list' },
        inRange.map((m) => {
          const cb = h('input', { type: 'checkbox', checked: true, id: `pick-${m.id}` });
          cb.addEventListener('change', () => {
            if (cb.checked) picked.add(m.id);
            else picked.delete(m.id);
            update();
          });
          return h('li', null, h('label', { for: `pick-${m.id}`, class: 'pick' }, cb,
            h('span', null, h('span', { class: 'map-date' }, fmtDate(m.createdAt)), h('span', { class: 'pick-text' }, m.worry.text ? `What if ${m.worry.text}?` : 'No worry written yet'))));
        }),
      )
    : h('p', { class: 'muted' }, 'No maps in this range.');

  const parkedCb = h('input', { type: 'checkbox', id: 'pick-parked' });
  parkedCb.addEventListener('change', () => {
    withParked = parkedCb.checked;
    update();
  });
  const ladderCb = h('input', { type: 'checkbox', id: 'pick-ladder', checked: withLadder });
  ladderCb.addEventListener('change', () => {
    withLadder = ladderCb.checked;
    update();
  });

  const el = page('share',
    backLink('maps', 'My maps'),
    h('h1', { tabindex: '-1' }, 'Share with my therapist'),
    h('p', { class: 'muted' }, `You choose what goes in. Nothing is sent until you tap ${email ? 'Email, ' : ''}Share, Copy, or Print.`),
    choices({ options: ranges, value: shareRange, layout: 'wrap', label: 'Which maps', onChange: (v) => { shareRange = v; nav.render(); } }),
    list,
    openParked().length ? h('label', { for: 'pick-parked', class: 'pick' }, parkedCb, h('span', null, 'Include my parked worries')) : null,
    hasLadder ? h('label', { for: 'pick-ladder', class: 'pick' }, ladderCb, h('span', null, 'Include my ladder step and tries')) : null,
    email ? drawingsRow : null,
    h('h2', null, 'What they will see'),
    preview,
    email
      ? h('div', { class: 'send-to' },
          h('p', null, h('strong', null, 'To: '), `${server.toName ? `${server.toName} ` : ''}<${server.to}>`),
          h('p', null, h('strong', null, 'From: '), server.from),
          h('p', { class: 'hint' }, 'Sent from that email account, so a copy stays in its Sent folder.'),
        )
      : null,
    h('div', { class: 'stack' }, actions),
    sendStatus,
  );
  update();
  return el;
}

async function copy(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = h('textarea', { class: 'sr-only' });
    ta.value = t;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) toast('Copy didn’t work on this phone.');
    return ok;
  }
}

// ---- Settings ----

export function settingsScreen() {
  asHub('settings', { world: 'short' });
  const s = state.settings;
  const contacts = [0, 1].map((i) => ({ name: s.contacts[i]?.name || '', phone: s.contacts[i]?.phone || '' }));
  const saveContacts = async () => {
    await saveSettings({ contacts: contacts.filter((c) => c.phone.trim()).map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })) });
    toast('Saved.');
  };
  const contactFields = contacts.map((c, i) => {
    const name = textField({ label: i ? 'Second contact name' : 'Name', value: c.name, placeholder: i ? 'Dad' : 'Mom', maxlength: 30, onInput: (v) => (c.name = v) });
    const phone = textField({ label: 'Phone number', value: c.phone, placeholder: '555 123 4567', maxlength: 20, onInput: (v) => (c.phone = v) });
    const input = phone.querySelector('input');
    input.type = 'tel';
    input.autocomplete = 'tel';
    name.querySelector('input').addEventListener('change', saveContacts);
    input.addEventListener('change', saveContacts);
    return h('div', { class: 'contact' }, name, phone);
  });

  const capValue = h('output', { class: 'stepper-value' }, String(s.cap));
  const visualsStatus = h('p', { class: 'hint', role: 'status' }, mind.statusText());
  const setCap = async (d) => {
    const v = Math.min(10, Math.max(1, s.cap + d));
    await saveSettings({ cap: v });
    capValue.textContent = String(v);
  };

  return page('settings',
    backLink('', 'Home'),
    h('h1', { tabindex: '-1' }, 'Settings'),

    h('section', { class: 'setting' },
      h('h2', null, 'Text mom or dad'),
      h('p', { class: 'hint' }, 'Used by the “Text mom or dad” button on the safety screen. A parent should set this up.'),
      contactFields,
    ),

    h('section', { class: 'setting' },
      h('h2', null, 'PIN lock'),
      h('p', { class: 'hint' }, 'Asks for a 4-digit PIN when the app opens. It keeps casual eyes out; it doesn’t encrypt anything.'),
      hasPin()
        ? h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn btn-secondary', onClick: async () => { const p = await choosePin(); if (p) { await setPin(p); toast('PIN changed.'); } } }, 'Change PIN'),
            h('button', { type: 'button', class: 'btn btn-ghost', onClick: async () => { await clearPin(); toast('PIN off.'); nav.render(); } }, 'Turn off'),
          )
        : h('button', { type: 'button', class: 'btn btn-secondary', onClick: async () => { const p = await choosePin(); if (p) { await setPin(p); toast('PIN on.'); nav.render(); } } }, icon('lock', 20), 'Turn on PIN'),
    ),

    h('section', { class: 'setting' },
      h('h2', null, 'Maps per day'),
      h('p', { class: 'hint' }, 'After this many maps in a day, the app suggests a break and talking to an adult.'),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'icon-btn stepper-btn', 'aria-label': 'Fewer', onClick: () => setCap(-1) }, '−'),
        capValue,
        h('button', { type: 'button', class: 'icon-btn stepper-btn', 'aria-label': 'More', onClick: () => setCap(1) }, '+'),
      ),
    ),

    h('section', { class: 'setting' },
      h('h2', null, 'Weekly summary reminder'),
      h('p', { class: 'hint' }, 'On this day, Home shows a card to review and send a summary to the therapist. It stays off until the therapist is named here.'),
      therapistField(),
      choices({
        options: [{ id: 'off', label: 'Off' }, ...['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => ({ id: i, label: d }))],
        value: s.summaryDay ?? 'off',
        layout: 'wrap',
        label: 'Reminder day',
        onChange: (v) => saveSettings({ summaryDay: v === 'off' ? null : v, summarySkippedFor: null }),
      }),
    ),

    s.server ? homeComputerSection() : null,

    h('section', { class: 'setting' },
      h('h2', null, 'Thought world'),
      h('p', { class: 'hint' }, '3D turns each map into a short game course with your avatar. Calm keeps everything flat and still.'),
      choices({
        options: [{ id: 'auto', label: '3D' }, { id: 'calm', label: 'Calm (2D)' }],
        value: s.visuals === 'calm' ? 'calm' : 'auto',
        layout: 'segmented',
        label: 'Thought world',
        onChange: async (v) => {
          await saveSettings({ visuals: v });
          visualsStatus.textContent = mind.statusText();
        },
      }),
      h('p', { class: 'field-label motion-label' }, 'Motion'),
      choices({
        options: [{ id: 'auto', label: 'Match phone' }, { id: 'full', label: 'Full' }, { id: 'less', label: 'Less' }],
        value: s.motion || 'auto',
        layout: 'segmented',
        label: 'Motion',
        onChange: async (v) => {
          await saveSettings({ motion: v });
          visualsStatus.textContent = mind.statusText();
        },
      }),
      visualsStatus,
    ),

    avatarSection(),

    h('section', { class: 'setting' },
      h('h2', null, 'Theme'),
      choices({
        options: [{ id: 'system', label: 'Match phone' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }],
        value: s.theme,
        layout: 'segmented',
        label: 'Theme',
        onChange: async (v) => {
          await saveSettings({ theme: v });
          applyTheme(v);
        },
      }),
    ),

    h('section', { class: 'setting' },
      h('h2', null, 'For parents'),
      h('a', { href: '#/guide', class: 'link-row' }, icon('book', 20), 'Parent guide: doing a map together'),
    ),

    h('section', { class: 'setting' },
      h('h2', null, 'My data'),
      h('p', { class: 'hint' }, PRIVACY),
      h('p', { class: 'hint' }, s.lastBackupAt
        ? `Last backup: ${fmtDate(s.lastBackupAt)}.`
        : 'No backup yet. A backup is one file with every map. Keep it somewhere safe, like Files or a computer, so a lost or new phone doesn’t lose your maps.'),
      h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: async () => { if (await backupNow()) nav.render(); } }, icon('download', 20), 'Back up my maps'),
        restoreButton(),
        h('button', {
          type: 'button',
          class: 'btn btn-danger-ghost btn-block',
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Delete all data?',
              text: 'Every map, drawing, parked worry, and setting on this phone will be erased. This can’t be undone.',
              confirm: 'Delete everything',
              danger: true,
              typeToConfirm: 'DELETE',
            });
            if (!ok) return;
            await wipeAll();
            applyTheme('system');
            toast('All data deleted.');
            nav.go('');
          },
        }, icon('trash', 20), 'Delete all data'),
      ),
    ),

    h('section', { class: 'setting' },
      h('h2', null, 'About'),
      h('p', null, DISCLAIMER),
      h('p', { class: 'hint' }, 'In a crisis, call or text 988 (US). In an emergency, call 911.'),
    ),
  );
}

// His look in the game. Always available; nothing is unlocked by playing.
const SHIRTS = [
  ['#3d7fd9', 'Blue'], ['#d9534f', 'Red'], ['#3aa76d', 'Green'], ['#7a5cc4', 'Purple'],
  ['#e8893c', 'Orange'], ['#2aa6a0', 'Teal'], ['#e07aa6', 'Pink'], ['#2b3440', 'Black'],
];
const PANTS = [['#2f4f6f', 'Navy'], ['#3a5f9a', 'Denim'], ['#23272e', 'Black'], ['#6c7680', 'Gray'], ['#a08a62', 'Khaki']];
const HATS = [{ id: 'none', label: 'None' }, { id: 'cap', label: 'Cap' }, { id: 'beanie', label: 'Beanie' }, { id: 'headphones', label: 'Headphones' }];

function avatarSection({ title = 'My avatar' } = {}) {
  const a = { shirt: '#3d7fd9', pants: '#2f4f6f', hat: 'none', ...state.settings.avatar };
  const preview = h('div', { class: 'avatar-preview', 'aria-hidden': 'true' },
    h('span', { class: 'av-hat' }), h('span', { class: 'av-head' }), h('span', { class: 'av-arm av-l' }),
    h('span', { class: 'av-torso' }), h('span', { class: 'av-arm av-r' }), h('span', { class: 'av-legs' }),
  );
  const paint = () => {
    preview.style.setProperty('--shirt', a.shirt);
    preview.style.setProperty('--pants', a.pants);
    preview.dataset.hat = a.hat;
  };
  const save = () => {
    paint();
    saveSettings({ avatar: { ...a } });
    gameWorld.update({ avatar: { ...a } });
  };
  const swatches = (key, list, label) => {
    const group = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label });
    const buttons = list.map(([color, name]) =>
      h('button', {
        type: 'button', class: 'swatch-btn', role: 'radio', 'aria-label': name, style: `--sw:${color}`,
        'aria-checked': String(a[key] === color),
        onClick: () => {
          a[key] = color;
          buttons.forEach((b, i) => b.setAttribute('aria-checked', String(list[i][0] === color)));
          save();
        },
      }));
    group.append(...buttons);
    return group;
  };
  paint();
  return h('section', { class: 'setting' },
    h('h2', null, title),
    h('div', { class: 'avatar-edit' },
      preview,
      h('div', { class: 'avatar-options' },
        h('p', { class: 'field-label' }, 'Shirt'), swatches('shirt', SHIRTS, 'Shirt color'),
        h('p', { class: 'field-label' }, 'Pants'), swatches('pants', PANTS, 'Pants color'),
      ),
    ),
    h('p', { class: 'field-label' }, 'Hat'),
    choices({ options: HATS, value: a.hat, layout: 'wrap', label: 'Hat', onChange: (v) => { a.hat = v; save(); } }),
  );
}

// Shown once the app has talked to the home computer at least once.
function homeComputerSection() {
  const about = h('p');
  const line = h('p', { class: 'hint', role: 'status' });
  const paint = (result) => {
    const srv = state.settings.server;
    about.textContent = !srv
      ? ''
      : srv.configured
        ? `Summaries are emailed to ${srv.toName || 'the therapist'} (${srv.to}) from ${srv.from}.`
        : 'Email isn’t set up on the home computer yet. Run the setup on that PC.';
    line.textContent = {
      checking: 'Checking…',
      online: 'Connected.',
      offline: 'Can’t reach it right now. The computer may be asleep, or Tailscale may be off on this phone.',
      none: 'This copy of the app isn’t running from the home computer.',
    }[result];
  };
  const check = async () => {
    paint('checking');
    paint(await refreshServer());
  };
  check();
  return h('section', { class: 'setting' },
    h('h2', null, 'Home computer'),
    about,
    line,
    h('button', { type: 'button', class: 'btn btn-secondary', onClick: check }, 'Check again'),
  );
}

function therapistField() {
  const f = textField({
    label: 'Therapist’s name',
    value: state.settings.therapistName || '',
    placeholder: 'Dr. Lee',
    maxlength: 40,
    onInput: () => {},
  });
  f.querySelector('input').addEventListener('change', async (e) => {
    await saveSettings({ therapistName: e.target.value.trim() });
    toast('Saved.');
  });
  return f;
}

// ---- Backup and restore ----
// A backup is one JSON file with every map. On a phone it goes through the
// share sheet ("Save to Files", or email it to yourself); elsewhere it
// downloads. Nothing leaves the phone unless he picks where it goes.
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function backupNow() {
  const name = `what-if-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'What-If Map backup' });
    } else {
      download(blob, name);
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false; // closed the share sheet
    download(blob, name);
  }
  await saveSettings({ lastBackupAt: new Date().toISOString() });
  toast('Backup made. Keep the file somewhere safe.');
  return true;
}

function restoreButton() {
  const notBackup = () => toast('That file isn’t a What-If Map backup.');
  const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return notBackup();
    }
    if (data?.app !== 'what-if-map' || !Array.isArray(data.maps)) return notBackup();
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      text: `${data.maps.length} map${data.maps.length === 1 ? '' : 's'}${data.exportedAt ? ` from ${fmtDate(data.exportedAt)}` : ''}. Maps already on this phone stay. If a map is in both, the newer copy is kept.`,
      confirm: 'Restore',
    });
    if (!ok) return;
    const r = await importAll(data);
    toast(`Restored: ${r.added} new, ${r.updated} updated.${r.skipped ? ` ${r.skipped} skipped.` : ''}`);
    nav.render();
  });
  return h('div', null,
    input,
    h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: () => input.click() }, icon('upload', 20), 'Restore from a backup'),
  );
}

// ---- Parent guide ----

export function guideScreen() {
  const g = PARENT_GUIDE;
  return page('guide',
    backLink('', 'Home'),
    h('h1', { tabindex: '-1' }, g.title),
    h('p', { class: 'lead' }, g.intro),
    g.sections.map((s) => h('section', { class: 'guide-section' }, h('h2', null, s.title), h('ul', null, s.items.map((i) => h('li', null, i))))),
    h('section', { class: 'guide-section' },
      h('h2', null, g.phrasesTitle),
      h('ul', { class: 'phrases' },
        g.phrases.map(([say, not]) =>
          h('li', null,
            h('p', { class: 'say' }, h('span', { class: 'phrase-tag' }, 'Say'), say),
            h('p', { class: 'not' }, h('span', { class: 'phrase-tag' }, 'Instead of'), not),
          ),
        ),
      ),
    ),
    h('section', { class: 'guide-section urgent' }, h('h2', null, g.urgentTitle), h('p', null, g.urgent)),
    h('h2', null, 'Tips on each step'),
    h('p', { class: 'hint' }, 'When “Map it with a parent” is on, these show at the top of each step.'),
    h('dl', { class: 'detail-list' },
      Object.entries(PARENT_TIPS)
        .filter(([k]) => STEP_NAMES[k])
        .map(([k, v]) => [h('dt', null, STEP_NAMES[k]), h('dd', null, v)]),
    ),
    h('p', { class: 'hint' }, g.footnote),
  );
}
