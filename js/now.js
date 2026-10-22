// "Right now": for the moment the worry is loud (the morning at the front
// door), when a nine-step map is too much. One minute of paced breathing,
// a grounding prompt, a text to a parent, and a way to park the worry for
// later. No map, nothing saved unless he parks a worry. No promises about how
// things will turn out.
import { RIGHT_NOW, SAFETY } from './content.js';
import { state } from './store.js';
import { parkSheet } from './flow.js';
import { prefersReduced } from './mind/index.js';
import { h, icon, smsHref } from './ui.js';
import { nav } from './nav.js';

const IN = 4; // seconds breathing in
const OUT = 6; // seconds breathing out: about six breaths a minute
const LENGTH = 60;

function breather() {
  const label = h('p', { class: 'breath-label', 'aria-live': 'polite' }, RIGHT_NOW.breatheIn);
  const clock = h('p', { class: 'breath-clock' });
  const again = h('button', { type: 'button', class: 'btn btn-secondary', hidden: true }, RIGHT_NOW.again);
  const circle = h('div', { class: 'breath-circle', 'aria-hidden': 'true' });
  const el = h('section', { class: `breath${prefersReduced() ? ' still' : ''}` }, circle, label, clock, again);
  let timer = null;
  let started = 0;
  let shown = false;
  const tick = () => {
    // stop once he leaves the screen
    if (el.isConnected) shown = true;
    else if (shown) return clearInterval(timer);
    const t = (Date.now() - started) / 1000;
    if (t >= LENGTH) {
      clearInterval(timer);
      el.classList.remove('on');
      label.textContent = 'One minute.';
      clock.textContent = '';
      again.hidden = false;
      return;
    }
    const inCycle = t % (IN + OUT);
    const breathingIn = inCycle < IN;
    const text = breathingIn ? RIGHT_NOW.breatheIn : RIGHT_NOW.breatheOut;
    if (label.textContent !== text) label.textContent = text;
    el.classList.toggle('in', breathingIn);
    const left = Math.ceil(LENGTH - t);
    clock.textContent = `0:${String(left).padStart(2, '0')}`;
  };
  const start = () => {
    again.hidden = true;
    started = Date.now();
    el.classList.add('on');
    clearInterval(timer);
    tick();
    timer = setInterval(tick, 250);
  };
  again.addEventListener('click', start);
  // start right away: in a hard moment, one less thing to tap
  queueMicrotask(start);
  return el;
}

export function nowScreen() {
  const contacts = state.settings.contacts.filter((c) => c.phone);
  return h('div', { class: 'screen now-screen' },
    h('main', { class: 'page' },
      h('h1', { tabindex: '-1' }, RIGHT_NOW.title),
      h('p', { class: 'lead' }, RIGHT_NOW.lead),
      breather(),
      h('section', { class: 'now-section' },
        h('h2', null, RIGHT_NOW.lookTitle),
        h('ul', { class: 'points' }, RIGHT_NOW.look.map((t) => h('li', null, t))),
      ),
      h('section', { class: 'now-section' },
        h('h2', null, RIGHT_NOW.reachTitle),
        contacts.length
          ? h('div', { class: 'stack' },
              contacts.map((c) => h('a', { class: 'btn btn-secondary btn-block', href: smsHref(c.phone, SAFETY.smsBody) }, icon('message'), `Text ${c.name || 'mom or dad'}`)))
          : h('p', { class: 'hint' }, RIGHT_NOW.noContacts),
        h('a', { href: '#/help', class: 'link-row' }, icon('phone', 20), 'Need to talk to someone?'),
      ),
      h('section', { class: 'now-section' },
        h('h2', null, RIGHT_NOW.parkTitle),
        h('p', { class: 'hint' }, RIGHT_NOW.parkHint),
        h('button', { type: 'button', class: 'btn btn-secondary btn-block', onClick: () => parkSheet() }, icon('park', 20), 'Park this worry'),
      ),
      h('button', { type: 'button', class: 'btn btn-primary btn-block now-home', onClick: () => nav.go('') }, 'Back to home'),
    ),
  );
}
