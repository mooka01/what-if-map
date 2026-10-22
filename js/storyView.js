// A map told as a vertical timeline in his own words: the "Read it" sheet,
// and the map page in Calm (2D) mode.
import { h } from './ui.js';
import { storyBeats } from './mind/story.js';

const BEAT_COLORS = {
  worry: '#F2A65A', body: '#F28CB1', zone: '#8FA8FF', dig: '#FF9A6B', core: '#FF7A59', reality: '#8FA8FF',
  tools: '#6EE7A8', act: '#46D39A', next: '#46D39A', detours: '#B8C2CC', check: '#5FD0C8', stopped: '#B8C2CC', unfinished: '#B8C2CC',
};

export function storyTimeline(m) {
  const beats = storyBeats(m);
  const pic = (src, alt) => h('img', { class: 'story-pic', src, alt });
  return h('ol', { class: 'story' },
    beats.map((b) =>
      h('li', { class: 'story-beat', style: `--c:${BEAT_COLORS[b.id] || '#8FA8FF'}` },
        h('span', { class: 'story-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'story-body' },
          h('p', { class: 'story-title' }, b.title),
          h('p', { class: 'story-text' }, b.text),
          b.id === 'worry' && m.sketch.beforePng ? pic(m.sketch.beforePng, 'My before drawing') : null,
          b.id === 'reality' && m.sketch.afterPng ? pic(m.sketch.afterPng, 'My after drawing') : null,
        ),
      ),
    ),
  );
}
