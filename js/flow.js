// The map itself: one screen per step, fixed order, no skipping.
import {
  STEPS, STEP_NAMES, WHEN, BODY_SPOTS, CATEGORIES, CORE_FEARS, CORE_MAX_ROUNDS, CORE_BOTTOM, ODDS, HISTORY,
  FRIEND, COPE, PARK_IT, SKETCH, PARENT_TIPS, SAFETY,
} from './content.js';
import { state, activeMap, getMap, saveMap, saveMapSoon, flushSave, parkWorry, saveSettings, ladderStep } from './store.js';
import { coreResult, coreOptions, stepComplete, stepTexts, cleanWorry, MIN_TEXT, checkOpensText } from './logic.js';
import { isCrisis, anyCrisis } from './safety.js';
import { h, icon, iconButton, choices, slider, textField, askLine, toast, smsHref } from './ui.js';
import { sketchPad, strokesToPng } from './sketch.js';
import { nav } from './nav.js';
import { gameWorld } from './game/index.js';
import { sfx, setSound, unlockAudio } from './game/audio.js';

const fearById = (id) => CORE_FEARS.find((f) => f.id === id);
const nowISO = () => new Date().toISOString();
const section = (title, ...kids) => h('section', { class: 'q' }, h('h2', { class: 'q-title' }, title), kids);

let sketchTab = 'before';
let cleanup = null;

export function mapScreen() {
  cleanup?.();
  cleanup = null;
  const map = activeMap();
  if (!map) {
    queueMicrotask(() => nav.go(''));
    return h('div');
  }
  return buildStep(map);
}

function buildStep(map) {
  const step = STEPS[map.step];
  // The game world on top, the dock (the step's words and controls) below.
  // In Calm mode, or without 3D, the dock is the whole screen.
  const useGame = gameWorld.enabled();
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary btn-next' });
  const refresh = () => {
    nextBtn.disabled = !canNext();
    if (useGame) gameWorld.sync(map);
  };
  const view = RENDER[step](map, { refresh, next: () => goNext() });
  const canNext = () => (view.canNext ? view.canNext() : stepComplete(map, step));
  const gameLabel = step === 'core' && map.core.fear ? 'Go on' : NEXT_LABELS[step];
  nextBtn.append(view.nextLabel || (useGame ? gameLabel : null) || 'Next', icon('next', 20));
  nextBtn.addEventListener('click', () => goNext());
  refresh();

  async function goNext() {
    if (!canNext()) return;
    if (anyCrisis(stepTexts(map, step))) return stopForSafety(map, step);
    if (view.onNext?.() === 'stay') {
      await saveMap(map);
      return nav.render();
    }
    if (step === 'sort' && map.category === 'E') {
      map.safety.push({ at: nowISO(), step, trigger: 'category', continued: false });
      await saveMap(map);
      nav.safety = { mapId: map.id, canContinue: true };
      return nav.go('safety');
    }
    if (step === 'next') {
      map.status = 'done';
      map.finishedAt = nowISO();
      delete map.core.pending;
      await saveMap(map);
      return nav.go(`done/${map.id}`);
    }
    map.step += 1;
    await saveMap(map);
    nav.render();
  }

  async function goBack() {
    const reason = await askLine({
      title: 'Change an earlier answer?',
      text: 'Going back needs a reason. It gets saved with this map.',
      label: 'I’m changing an answer because',
      placeholder: 'One line',
      confirm: 'Go back',
      cancel: 'Stay here',
    });
    if (!reason) return;
    const detour = { at: nowISO(), from: step, to: null, reason };
    map.detours.push(detour);
    if (isCrisis(reason)) return stopForSafety(map, step);
    if (!view.onBack?.()) map.step = Math.max(0, map.step - 1);
    detour.to = STEPS[map.step];
    await saveMap(map);
    nav.render();
  }

  const canGoBack = map.step > 0;
  const header = h('header', { class: 'map-header' },
    iconButton('close', 'Save and leave', async () => {
      await flushSave(map);
      toast('Map saved.');
      nav.go('');
    }),
    progressDots(map.step),
    h('div', { class: 'map-header-actions' },
      useGame ? soundButton() : null,
      iconButton('park', 'Park a new worry', () => parkSheet(map)),
      iconButton('parent', map.withParent ? 'Parent tips: on' : 'Parent tips: off', async () => {
        map.withParent = !map.withParent;
        await saveMap(map);
        toast(map.withParent ? 'Parent tips on' : 'Parent tips off');
        nav.render();
      }, { class: map.withParent ? 'on' : '', attrs: { 'aria-pressed': String(map.withParent) } }),
    ),
  );
  const body = h('main', { class: 'map-body' },
    h('p', { class: 'eyebrow' }, `${useGame ? 'Stage' : 'Step'} ${map.step + 1} of ${STEPS.length} · ${STEP_NAMES[step]}`),
    h('h1', { tabindex: '-1' }, view.title),
    map.withParent ? parentTip(step) : null,
    view.body,
  );
  const footer = h('footer', { class: 'map-footer' },
    canGoBack
      ? h('button', { type: 'button', class: 'btn btn-ghost btn-back', onClick: goBack }, icon('back', 20), 'Back')
      : h('span'),
    h('div', { class: 'footer-right' }, view.extra || null, nextBtn),
  );

  if (!useGame) return h('div', { class: 'screen map-screen', 'data-step': step }, header, body, footer);

  // Game layout: world strip on top, dock below. Tapping a platform presses
  // the matching numbered card in the dock.
  const slot = h('div', { class: 'world-slot', 'aria-hidden': 'true' });
  const dock = h('section', { class: 'dock', 'aria-label': STEP_NAMES[step] }, body, footer);
  numberCards(dock);
  const screen = h('div', { class: `screen map-screen game${step === 'sketch' ? ' flat' : ''}`, 'data-step': step }, header, slot, dock);
  watchTyping(screen);
  gameWorld.show(step, map, { top: header, slot, dock });
  return screen;
}

// Button labels that read like moving through a course.
const NEXT_LABELS = { core: 'Dig', sketch: 'Go on' };

// Number the dock cards so they match the signs in the world.
function numberCards(dock) {
  dock.querySelectorAll('.choices:not(.choices-odds)').forEach((group) => {
    group.querySelectorAll('.choice').forEach((c, i) => {
      if (c.querySelector('.choice-badge')) return;
      c.querySelector('.choice-mark')?.setAttribute('data-num', String(i + 1));
    });
  });
}

// While typing, shrink the world so the keyboard never covers the field.
function watchTyping(screen) {
  let t = null;
  screen.addEventListener('focusin', (e) => {
    if (!e.target.matches('input[type="text"], input[type="tel"], textarea')) return;
    clearTimeout(t);
    screen.classList.add('typing');
  });
  screen.addEventListener('focusout', () => {
    clearTimeout(t);
    t = setTimeout(() => screen.classList.remove('typing'), 120);
  });
}

function soundButton() {
  const on = !!state.settings.sound;
  return iconButton(on ? 'sound' : 'mute', on ? 'Sound: on' : 'Sound: off', async () => {
    const next = !state.settings.sound;
    await saveSettings({ sound: next });
    setSound(next);
    if (next) {
      unlockAudio();
      sfx.select();
    }
    nav.render();
  }, { class: on ? 'on' : '', attrs: { 'aria-pressed': String(on) } });
}

export function parentTip(key) {
  return h('aside', { class: 'parent-tip', 'aria-label': 'Tip for the parent' },
    h('p', { class: 'parent-tip-label' }, icon('parent', 16), 'For the parent'),
    h('p', null, PARENT_TIPS[key]),
  );
}

function progressDots(i) {
  return h('ol', { class: 'dots', 'aria-label': `Step ${i + 1} of ${STEPS.length}` },
    STEPS.map((s, k) => h('li', { class: k < i ? 'done' : k === i ? 'now' : '', title: STEP_NAMES[s] })),
  );
}

async function stopForSafety(map, step) {
  map.status = 'stopped';
  map.stoppedAt = nowISO();
  map.safety.push({ at: nowISO(), step, trigger: 'keyword', continued: false });
  await saveMap(map);
  nav.safety = { mapId: map.id, canContinue: false };
  nav.go('safety');
}

// Shared with the home screen. Pass a map when parking from inside one.
export async function parkSheet(map = null) {
  const text = await askLine({
    title: 'Park a new worry',
    text: 'One worry per map. Save this one for a later map.',
    label: 'The new worry',
    prefix: 'What if',
    placeholder: 'Finish the sentence',
    confirm: 'Park it',
  });
  if (!text) return;
  const clean = cleanWorry(text);
  await parkWorry(clean, map?.id || null);
  if (isCrisis(clean)) {
    if (map) return stopForSafety(map, 'park');
    nav.safety = { mapId: null, canContinue: false };
    return nav.go('safety');
  }
  toast('Parked for later.');
  if (!map) nav.render();
}

// Text field that shows only when a "write your own" option is picked.
function ownTextField({ visible, value, label, placeholder, onInput }) {
  const field = textField({ label, value, placeholder, maxlength: 140, onInput });
  field.hidden = !visible;
  return field;
}

function revealOwn(field, show) {
  const was = field.hidden;
  field.hidden = !show;
  if (show && was) field.querySelector('input').focus();
}

// ---- Steps ----

const RENDER = {
  worry(map, { refresh }) {
    return {
      title: 'What’s the worry?',
      canNext: () => cleanWorry(map.worry.text).trim().length >= MIN_TEXT && !!map.worry.when,
      onNext: () => {
        map.worry.text = cleanWorry(map.worry.text).trim();
      },
      body: [
        textField({
          label: 'Finish the sentence. One worry, one sentence.',
          prefix: 'What if',
          suffix: '?',
          value: map.worry.text,
          placeholder: 'I get called on and freeze',
          maxlength: 140,
          onInput: (v) => {
            map.worry.text = v;
            saveMapSoon(map);
            refresh();
          },
        }),
        section('When would it happen?',
          choices({
            options: WHEN,
            value: map.worry.when,
            layout: 'grid',
            label: 'When would it happen?',
            onChange: (v) => {
              map.worry.when = v;
              saveMapSoon(map);
              refresh();
            },
          }),
        ),
      ],
    };
  },

  body(map, { refresh }) {
    return {
      title: 'Body check',
      body: [
        section('Where do I feel it?',
          h('p', { class: 'hint' }, 'Pick all that fit.'),
          choices({
            options: BODY_SPOTS,
            value: map.body.spots,
            multi: true,
            layout: 'grid',
            label: 'Where do I feel it?',
            onChange: (v) => {
              map.body.spots = v;
              saveMapSoon(map);
              refresh();
            },
          }),
        ),
        h('section', { class: 'q' },
          slider({
            label: 'How strong is it right now?',
            value: map.body.before,
            onChange: (v) => {
              map.body.before = v;
              saveMapSoon(map);
              refresh();
            },
          }),
        ),
      ],
    };
  },

  sort(map, { refresh }) {
    return {
      title: 'What kind of worry is it?',
      body: [
        h('p', { class: 'hint lead' }, 'Not sure? Pick the closest.'),
        choices({
          options: CATEGORIES.map((c) => ({ id: c.id, badge: c.id, label: c.name, desc: c.desc })),
          value: map.category,
          label: 'Kind of worry',
          onChange: (v) => {
            map.category = v;
            saveMapSoon(map);
            refresh();
          },
        }),
      ],
    };
  },

  core(map, { refresh }) {
    const c = map.core;
    if (c.fear) {
      return {
        title: 'That’s your core fear',
        body: [
          h('div', { class: 'core-result' }, fearById(c.fear).label),
          h('p', { class: 'muted' },
            c.method === 'repeat'
              ? 'You came back to this one.'
              : c.method === 'bottom'
                ? 'Nothing was worse than this one.'
                : `After ${CORE_MAX_ROUNDS} rounds, this is where it landed.`),
          chainView(c.chain),
        ],
        onBack: () => {
          // back to the round it ended on, with that answer still picked
          c.pending = c.method === 'bottom' ? CORE_BOTTOM.id : c.chain.pop();
          c.fear = null;
          c.method = null;
          return true;
        },
      };
    }
    const round = c.chain.length;
    const prev = round ? fearById(c.chain[round - 1]) : null;
    return {
      title: 'Dig to the core',
      canNext: () => !!c.pending,
      onNext: () => {
        if (c.pending === CORE_BOTTOM.id) {
          // nothing worse: the last answer is the core
          c.pending = null;
          c.fear = c.chain[c.chain.length - 1];
          c.method = 'bottom';
          return 'stay';
        }
        c.chain.push(c.pending);
        c.pending = null;
        const r = coreResult(c.chain);
        if (r.done) {
          c.fear = r.fear;
          c.method = r.method;
        }
        return 'stay';
      },
      onBack: () => {
        if (!c.chain.length) {
          c.pending = null;
          return false;
        }
        c.pending = c.chain.pop();
        return true;
      },
      body: [
        h('p', { class: 'worry-quote' }, `What if ${map.worry.text}?`),
        round ? chainView(c.chain) : null,
        h('p', { class: 'prompt' },
          round
            ? ['And if ', h('strong', null, prev.ifThat), ', the worst part would be…']
            : 'If that happened, the worst part would be…'),
        h('p', { class: 'hint' }, `Round ${round + 1} of up to ${CORE_MAX_ROUNDS}`),
        choices({
          options: coreOptions(c.chain),
          value: c.pending ?? null,
          label: 'The worst part would be',
          onChange: (v) => {
            c.pending = v;
            refresh();
          },
        }),
      ],
    };
  },

  reality(map, { refresh }) {
    const r = map.reality;
    const own = ownTextField({
      visible: r.friend === 'own',
      value: r.friendText,
      label: 'Their words',
      placeholder: 'What they would say',
      onInput: (v) => {
        r.friendText = v;
        saveMapSoon(map);
        refresh();
      },
    });
    const set = (k) => (v) => {
      r[k] = v;
      saveMapSoon(map);
      refresh();
    };
    return {
      title: 'Reality check',
      body: [
        section('Odds it actually happens',
          choices({ options: ODDS.map((o) => ({ id: o, label: `${o}%` })), value: r.odds, layout: 'odds', label: 'Odds', onChange: set('odds') }),
        ),
        section('How many times has this really happened before?',
          choices({ options: HISTORY, value: r.history, layout: 'grid', label: 'Times it happened before', onChange: set('history') }),
        ),
        section('What would my best friend or cousin say?',
          choices({
            options: FRIEND,
            value: r.friend,
            label: 'What a friend would say',
            onChange: (v) => {
              set('friend')(v);
              revealOwn(own, v === 'own');
            },
          }),
          own,
        ),
      ],
    };
  },

  cope(map, { refresh }) {
    const c = map.cope;
    const own = ownTextField({
      visible: c.picks.includes('own'),
      value: c.ownText,
      label: 'My own plan',
      placeholder: 'What I would do',
      onInput: (v) => {
        c.ownText = v;
        saveMapSoon(map);
        refresh();
      },
    });
    return {
      title: 'If it did happen, I would…',
      body: [
        h('p', { class: 'hint lead' }, 'Pick at least one.'),
        choices({
          options: COPE,
          value: c.picks,
          multi: true,
          label: 'If it happened, I would',
          onChange: (v) => {
            c.picks = v;
            saveMapSoon(map);
            refresh();
            revealOwn(own, v.includes('own'));
          },
        }),
        own,
      ],
    };
  },

  act(map, { refresh }) {
    const a = map.act;
    const yesField = textField({
      label: 'I’ll do this:',
      value: a.text,
      placeholder: 'One thing, right now',
      maxlength: 140,
      onInput: (v) => {
        a.text = v;
        saveMapSoon(map);
        refresh();
      },
    });
    const parkCard = h('div', { class: 'park-card', role: 'note' },
      h('h2', null, PARK_IT.title),
      PARK_IT.lines.map((l) => h('p', null, l)),
    );
    const show = () => {
      yesField.hidden = a.canAct !== 'yes';
      parkCard.hidden = a.canAct !== 'no';
    };
    show();
    return {
      title: 'Can I do something about it right now?',
      body: [
        choices({
          options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
          value: a.canAct,
          layout: 'grid',
          label: 'Can I do something about it right now?',
          onChange: (v) => {
            a.canAct = v;
            saveMapSoon(map);
            show();
            refresh();
            if (v === 'yes') yesField.querySelector('input').focus();
          },
        }),
        yesField,
        parkCard,
      ],
    };
  },

  sketch(map, { next }) {
    const s = map.sketch;
    const holder = h('div', { class: 'sketch-holder' });
    const prompt = h('p', { class: 'prompt' });
    const tabs = ['before', 'after'].map((t) =>
      h('button', {
        type: 'button',
        role: 'tab',
        class: 'seg-btn',
        onClick: () => {
          sketchTab = t;
          showTab();
        },
      }, t === 'before' ? 'Before' : 'After'),
    );
    const skip = h('button', { type: 'button', class: 'btn btn-secondary btn-small', onClick: () => next() }, 'Skip drawing');
    const updateSkip = () => {
      skip.hidden = s.before.length + s.after.length > 0;
    };
    let pad = null;
    function showTab() {
      pad?.destroy();
      tabs.forEach((b, i) => b.setAttribute('aria-selected', String(['before', 'after'][i] === sketchTab)));
      prompt.textContent = SKETCH[sketchTab];
      pad = sketchPad({
        strokes: s[sketchTab],
        onChange: () => {
          saveMapSoon(map);
          updateSkip();
        },
      });
      holder.replaceChildren(pad.el);
    }
    showTab();
    updateSkip();
    cleanup = () => pad?.destroy();
    return {
      title: 'Sketch it',
      onNext: () => {
        s.beforePng = strokesToPng(s.before);
        s.afterPng = strokesToPng(s.after);
        s.skipped = !s.before.length && !s.after.length;
        sketchTab = 'before';
      },
      body: [
        h('div', { class: 'sketch-intro' }, h('p', { class: 'hint lead' }, 'Optional. Draw both, one, or skip.'), skip),
        h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Which drawing' }, tabs),
        prompt,
        holder,
      ],
    };
  },

  next(map, { refresh }) {
    const n = map.next;
    const field = textField({
      label: 'Today I will:',
      value: n.text,
      placeholder: 'One small thing I will do today',
      maxlength: 140,
      onInput: (v) => {
        n.text = v;
        saveMapSoon(map);
        refresh();
      },
    });
    // His ladder step (from his therapist) is often the right next step.
    const step = ladderStep();
    const useStep = step
      ? h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-inline use-step',
          onClick: () => {
            field.querySelector('input').value = step.text;
            n.text = step.text;
            saveMapSoon(map);
            refresh();
          },
        }, icon('ladder', 18), `Use my ladder step: ${step.text}`)
      : null;
    return {
      title: 'My next step',
      nextLabel: 'Save map',
      body: [
        field,
        useStep,
        h('section', { class: 'q' },
          slider({
            label: 'Body check now',
            value: n.after,
            onChange: (v) => {
              n.after = v;
              saveMapSoon(map);
              refresh();
            },
          }),
        ),
      ],
    };
  },
};

export function chainView(chain) {
  return h('ol', { class: 'chain', 'aria-label': 'Your path so far' },
    chain.map((id) => h('li', null, fearById(id).label)),
  );
}

// ---- Finish ----

export function doneScreen(id) {
  const map = getMap(id);
  if (!map || map.status !== 'done') {
    queueMicrotask(() => nav.go(''));
    return h('div');
  }
  const s = map.sketch;
  const beforeAfter = h('div', { class: 'before-after', role: 'group', 'aria-label': 'Body check' },
    h('div', null, h('span', { class: 'ba-label' }, 'Body before'), h('span', { class: 'ba-num' }, `${map.body.before}`), h('span', { class: 'ba-of' }, '/10')),
    h('span', { class: 'ba-arrow', 'aria-hidden': 'true' }, icon('next', 28)),
    h('div', null, h('span', { class: 'ba-label' }, 'Body now'), h('span', { class: 'ba-num' }, `${map.next.after}`), h('span', { class: 'ba-of' }, '/10')),
  );
  const doneBtn = h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => nav.go('') }, 'Done');
  // When to come back for the tomorrow check.
  const checkWhen = h('p', { class: 'hint check-when' }, `Check it ${checkOpensText(map)}: did it happen, how bad was it really, and did I do my next step? It will be on Home.`);

  // The finish island: his words on the banner, the before and now towers.
  if (gameWorld.enabled()) {
    const top = h('header', { class: 'map-header' }, h('span', { class: 'stage-pill' }, 'Checkpoint'));
    const slot = h('div', { class: 'world-slot', 'aria-hidden': 'true' });
    const dock = h('section', { class: 'dock', 'aria-label': 'Map saved' },
      h('main', { class: 'map-body' },
        h('h1', { tabindex: '-1' }, 'Map saved.'),
        beforeAfter,
        h('section', { class: 'card' }, h('p', { class: 'card-label' }, 'Today I will'), h('p', { class: 'next-step' }, map.next.text)),
        checkWhen,
      ),
      h('footer', { class: 'map-footer' }, h('span'), h('div', { class: 'footer-right' }, h('button', { type: 'button', class: 'btn btn-primary', onClick: () => nav.go('') }, 'Done'))),
    );
    gameWorld.show('done', map, { top, slot, dock });
    return h('div', { class: 'screen map-screen game done-screen' }, top, slot, dock);
  }
  return h('div', { class: 'screen done-screen' },
    h('main', { class: 'page' },
      h('h1', { tabindex: '-1' }, 'Map saved.'),
      beforeAfter,
      h('section', { class: 'card' },
        h('p', { class: 'card-label' }, 'Today I will'),
        h('p', { class: 'next-step' }, map.next.text),
      ),
      s.beforePng || s.afterPng
        ? h('div', { class: 'thumbs' },
            s.beforePng ? h('figure', null, h('img', { src: s.beforePng, alt: 'Before drawing' }), h('figcaption', null, 'Before')) : null,
            s.afterPng ? h('figure', null, h('img', { src: s.afterPng, alt: 'After drawing' }), h('figcaption', null, 'After')) : null,
          )
        : null,
      checkWhen,
      doneBtn,
    ),
  );
}

// ---- Safety ----

export function safetyScreen() {
  const ctx = nav.safety || { mapId: null, canContinue: false };
  const map = ctx.mapId ? getMap(ctx.mapId) : null;
  const contacts = state.settings.contacts.filter((c) => c.phone);
  const canContinue = ctx.canContinue && map?.status === 'active' && map.category === 'E';

  const textButtons = contacts.length
    ? contacts.map((c) =>
        h('a', { class: 'btn btn-primary btn-block', href: smsHref(c.phone, SAFETY.smsBody) }, icon('message'), `Text ${c.name || 'mom or dad'}`),
      )
    : [
        h('a', { class: 'btn btn-primary btn-block', href: `sms:?&body=${encodeURIComponent(SAFETY.smsBody)}` }, icon('message'), 'Text mom or dad'),
        h('p', { class: 'hint center' }, 'A parent can add their number in Settings.'),
      ];

  return h('div', { class: 'screen safety-screen' },
    h('main', { class: 'page' },
      h('h1', { tabindex: '-1' }, SAFETY.title),
      h('p', { class: 'safety-body' }, SAFETY.body),
      map?.withParent ? parentTip('safety') : null,
      h('div', { class: 'stack' }, textButtons),
      h('div', { class: 'lifeline' },
        h('p', { class: 'lifeline-label' }, SAFETY.lifeline),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn-secondary', href: 'tel:988' }, icon('phone'), 'Call 988'),
          h('a', { class: 'btn btn-secondary', href: 'sms:988' }, icon('message'), 'Text 988'),
        ),
        h('p', { class: 'hint' }, SAFETY.emergency),
      ),
      canContinue
        ? h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-block',
            onClick: async () => {
              const last = map.safety[map.safety.length - 1];
              if (last) last.continued = true;
              map.step = STEPS.indexOf('core');
              await saveMap(map);
              nav.safety = null;
              nav.go('map');
            },
          }, 'Continue my map')
        : null,
      h('button', {
        type: 'button',
        class: 'btn btn-ghost btn-block',
        onClick: () => {
          nav.safety = null;
          nav.go('');
        },
      }, 'Back to home'),
    ),
  );
}
