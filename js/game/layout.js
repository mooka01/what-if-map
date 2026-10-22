// Shared layout for game screens outside a map: a header floating over the
// sky, the tappable world strip, and the dock with the words and buttons.
import { h } from '../ui.js';

// world: 'short' | 'normal' | 'tall' — how much of the screen the world gets.
export function gameScreen({ cls = '', top, body, footer = null, label = '', world = 'normal' }) {
  const slot = h('div', { class: 'world-slot', 'aria-hidden': 'true' });
  const dock = h('section', { class: 'dock', 'aria-label': label },
    h('main', { class: 'map-body' }, body),
    footer ? h('footer', { class: 'map-footer' }, footer) : null,
  );
  const el = h('div', { class: `screen map-screen game hub-screen ${cls}`, 'data-world': world }, top, slot, dock);
  return { el, top, slot, dock };
}

// In the game, a hub screen's page moves into the dock under its island.
// The page's own DOM is kept as-is (same buttons, same text), so tests,
// screen readers and Calm mode all see the same thing.
export function wrapHub(pageEl, { name, world = 'short', extra = {} }, { gameWorld, hubData }) {
  const main = pageEl.querySelector('main.page');
  const kids = [...(main || pageEl).childNodes];
  const top = h('header', { class: 'map-header hub-top' });
  const { el, slot, dock } = gameScreen({ cls: `hub-${name}`, top, body: kids, world, label: name });
  gameWorld.scene(name, hubData(extra), { top, slot, dock });
  return el;
}
