// Everything the hub islands mirror, gathered from the same functions the
// dock screens use, so the world never shows a number the dock doesn't.
import { state, activeMap, openParked } from '../store.js';
import { pendingChecks, summaryDue, weeklyScore, criedWolf, oddsCheck, patterns, categoriesByWeek, DAY } from '../logic.js';

export function hubData(extra = {}) {
  const maps = state.maps;
  const range = extra.range ?? null; // days for the Field, or null for all time
  const since = range ? new Date(Date.now() - range * DAY) : null;
  return {
    base: {
      check: pendingChecks(maps)[0]?.id ?? null,
      active: !!activeMap(),
      parked: openParked().length,
      due: !!summaryDue(state.settings, maps),
      outbox: state.outbox.length,
    },
    trail: maps
      .filter((m) => m.status !== 'active')
      .map((m) => ({ id: m.id, status: m.status, category: m.category })),
    score: {
      wolf: criedWolf(maps),
      // every checked map's outcome, oldest first (the tally fence)
      outcomes: maps
        .filter((m) => m.status === 'done' && m.check)
        .sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : 1))
        .map((m) => m.check.happened),
      odds: oddsCheck(maps),
      weeks: weeklyScore(maps).slice(0, 8),
    },
    field: {
      ...patterns(maps, since),
      byWeek: categoriesByWeek(maps, 8),
    },
    ...extra,
  };
}
