// The therapist's ladder, one step at a time. The app holds only the step he
// is on now (typed the way it's written in his plan) and a short log of
// tries: did all or part of it, how hard he thought it would be, how hard it
// really was. Only tries are logged, never "didn't do it". Moving to the next
// step is a choice he makes with his therapist; earlier steps keep their tries.
import { LADDER } from './content.js';
import { state, ladderStep, setLadderStep, addLadderTry, triesFor } from './store.js';
import { h, icon, choices, slider, textField, toast, fmtDate } from './ui.js';
import { nav } from './nav.js';

const page = (...kids) => h('div', { class: 'screen' }, h('main', { class: 'page' }, kids));
const backLink = (route, text) =>
  h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onClick: () => nav.go(route) }, icon('back', 20), text);
export const times = (n) => `${n} time${n === 1 ? '' : 's'}`;
export const tryLine = (t) => `${fmtDate(t.at)} · ${LADDER.didLabel[t.did]} · thought ${t.thought}, was ${t.was}`;

function stepForm(current) {
  let text = current?.text || '';
  const save = h('button', {
    type: 'button',
    class: 'btn btn-primary btn-block',
    disabled: text.trim().length < 2,
    onClick: async () => {
      await setLadderStep(text);
      toast('Saved.');
      nav.render();
    },
  }, 'Save my step');
  const field = textField({
    label: current ? 'My step now' : 'The step I’m on',
    value: text,
    placeholder: LADDER.placeholder,
    maxlength: 140,
    onInput: (v) => {
      text = v;
      save.disabled = text.trim().length < 2 || text.trim() === current?.text;
    },
  });
  return h('div', { class: 'stack' }, field, save);
}

export function ladderScreen() {
  const step = ladderStep();
  if (!step) {
    return page(
      backLink('', 'Home'),
      h('h1', { tabindex: '-1' }, LADDER.title),
      h('p', { class: 'lead' }, LADDER.intro),
      stepForm(null),
      h('p', { class: 'hint' }, LADDER.changeHint),
    );
  }
  const tries = triesFor(step.id).slice().reverse();
  const earlier = state.ladder.steps.slice(0, -1).reverse();
  const change = h('div', { class: 'ladder-change', hidden: true }, stepForm(step));
  const changeBtn = h('button', {
    type: 'button',
    class: 'btn btn-secondary btn-block',
    onClick: () => {
      change.hidden = false;
      changeBtn.hidden = true;
      change.querySelector('input')?.focus();
    },
  }, 'Change my step');
  return page(
    backLink('', 'Home'),
    h('h1', { tabindex: '-1' }, LADDER.title),
    h('p', { class: 'step-now' }, step.text),
    h('p', { class: 'muted' }, tries.length ? `Tried ${times(tries.length)} since ${fmtDate(step.from)}.` : `Since ${fmtDate(step.from)}. Not tried yet.`),
    h('button', { type: 'button', class: 'btn btn-primary btn-block btn-big', onClick: () => nav.go('ladder/try') }, 'I tried it'),
    tries.length ? [h('h2', null, 'My tries'), h('ul', { class: 'try-list' }, tries.map((t) => h('li', null, tryLine(t))))] : null,
    h('h2', null, 'The next step'),
    h('p', { class: 'hint' }, LADDER.changeHint),
    changeBtn,
    change,
    earlier.length
      ? [h('h2', null, 'Earlier steps'),
          h('ul', { class: 'try-list' }, earlier.map((s) => h('li', null, `${s.text} · from ${fmtDate(s.from)} · tried ${times(triesFor(s.id).length)}`)))]
      : null,
  );
}

export function ladderTryScreen() {
  const step = ladderStep();
  if (!step) return ladderScreen();
  const a = { did: null, thought: null, was: null };
  const save = h('button', { type: 'button', class: 'btn btn-primary btn-block', disabled: true }, 'Save');
  const set = (k) => (v) => {
    a[k] = v;
    save.disabled = !a.did || a.thought == null || a.was == null;
  };
  const body = h('div', { class: 'ladder-try' },
    h('section', { class: 'q' }, h('h2', { class: 'q-title' }, 'Did I do all of it?'),
      choices({ options: LADDER.did, value: null, layout: 'grid', label: 'Did I do all of it?', onChange: set('did') })),
    h('section', { class: 'q' }, slider({ label: LADDER.thought, value: null, low: LADDER.low, high: LADDER.high, onChange: set('thought') })),
    h('section', { class: 'q' }, slider({ label: LADDER.was, value: null, low: LADDER.low, high: LADDER.high, onChange: set('was') })),
    save,
  );
  save.addEventListener('click', async () => {
    save.disabled = true;
    await addLadderTry(a);
    // What he predicted next to what it was. No praise, just his numbers.
    body.replaceChildren(
      h('div', { class: 'compare' },
        h('div', null, h('span', { class: 'ba-label' }, 'I thought'), h('span', { class: 'ba-num' }, String(a.thought)), h('span', { class: 'ba-of' }, '/10')),
        h('div', null, h('span', { class: 'ba-label' }, 'It was'), h('span', { class: 'ba-num' }, String(a.was)), h('span', { class: 'ba-of' }, '/10')),
      ),
      h('p', null, `${LADDER.didLabel[a.did]}. Tried this step ${times(triesFor(step.id).length)}.`),
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => nav.go('') }, 'Done'),
    );
    body.querySelector('button')?.focus();
  });
  return page(
    backLink('ladder', 'My step'),
    h('h1', { tabindex: '-1' }, 'I tried my step'),
    h('p', { class: 'worry-quote' }, step.text),
    body,
  );
}
