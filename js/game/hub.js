// The hub: the game world outside a map. Home is "Base", one island the
// avatar lives on; every other screen is a smaller island on a ring around it,
// always in the same place, so the layout becomes a map he learns once.
//
//   Trail (My maps)  behind-left      Lookout (Scoreboard)  behind-right
//   Field (Patterns) far behind       Workshop (Settings)   left
//   Bench (tomorrow check) right      Base                  center
//
// Like the course, the world mirrors the DOM dock and presses its buttons;
// the dock stays the single source of truth. Honesty rules for data: one map
// is one block, all blocks the same size, no color means good or bad, and no
// number appears in the world that the dock doesn't show.
//
// Signs keep their size on screen at any distance, so each screen frames only
// the props that matter, shows only its own island, and keeps a small sign
// budget: when two signs collide, the less important one steps aside.
import * as THREE from '../vendor/three.module.min.js';
import { CATEGORIES, CORE_FEARS, HUB_SIGNS, HAPPENED_LABEL, CHECK_HAPPENED, CHECK_NOT_YET, CHECK_COPED, CHECK_STEP, SIGN_LABELS } from '../content.js';
import { ground, pad, signpost, stairTower, creature, parkingBox, tickPads } from './props.js';
import { brick, makeSign, signPx } from './kit.js';
import { sfx } from './audio.js';
import { prefersReduced } from '../mind/index.js';
import { moodColor } from './course.js';
import { nav } from '../nav.js';
import { fmtShort } from '../ui.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PITCH = 0.62;
const DIRT = -3.8;
const HUB = V(0, 0, 700); // far from the course, so the two never share a frame
const ZONE = { A: 0xd99ab8, B: 0xe8c56f, C: 0x86c79a, D: 0x8ea6d8, E: 0xc9a97a };
// Outcome hues, the same on the scoreboard and the check pads; none means
// good or bad. The dock's color key uses the same values (css/game.css).
const OUT = { no: 0x8ea6d8, partly: 0xe8c56f, yes: 0xd99ab8, unchecked: 0xd9cdb8 };
const STONE = 0xd9cdb8;
const SLATE = 0x6f7f95;
const LAVENDER = 0xb7a3d9;
const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

const ISLANDS = {
  base: { at: V(0, 0, 0), w: 26, d: 24 },
  trail: { at: V(-38, 0, -42), w: 18, d: 44 },
  lookout: { at: V(38, 0, -42), w: 28, d: 28 },
  field: { at: V(0, -2, -84), w: 34, d: 34 },
  workshop: { at: V(-42, 0, 6), w: 14, d: 14 },
  bench: { at: V(42, 0, 8), w: 30, d: 22 },
};
const ROUTE_ISLAND = {
  home: 'base', share: 'base', cap: 'base', onboarding: 'base',
  maps: 'trail', score: 'lookout', patterns: 'field', settings: 'workshop', check: 'bench',
};
// Below this height (px) the world strip shows no signs at all.
const FLAT_STRIP = 180;

// Framing boxes: the camera fits these points into the world strip.
function islandPts(w, d, top = 4, at = V(0, 0, 0)) {
  const x0 = at.x - w / 2;
  const x1 = at.x + w / 2;
  const zf = at.z + d / 2;
  const zb = at.z - d / 2;
  return [V(x0, at.y, zf), V(x1, at.y, zf), V(x0, at.y + DIRT, zf), V(x1, at.y + DIRT, zf), V(x0, at.y + top, zb), V(x1, at.y + top, zb)];
}
const around = (c, r, h = 5) => [V(c.x - r, c.y, c.z + r), V(c.x + r, c.y, c.z + r), V(c.x - r, c.y + h, c.z - r), V(c.x + r, c.y + h, c.z - r)];
const span = (x0, x1, zBack, zFront, h = 4) => [V(x0, 0, zFront), V(x1, 0, zFront), V(x0, h, zBack), V(x1, h, zBack)];

const lam = (color) => new THREE.MeshLambertMaterial({ color });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function block(w, h, d, color) {
  const m = new THREE.Mesh(boxGeo, lam(color));
  m.scale.set(w, h, d);
  return m;
}
const sign = (text, opts = {}) => makeSign(text, { maxLines: 2, small: true, ...opts });
// How much a sign matters when signs collide: higher stays. 9 never steps aside.
function prio(obj, n) {
  obj.traverse((o) => {
    if (o.isSprite) o.userData.priority = n;
  });
  return obj;
}

// ---------- Small props ----------

function gate() {
  const g = new THREE.Group();
  const wood = 0xa57c52;
  const postL = block(0.7, 5.4, 0.7, wood);
  postL.position.set(-6.6, 2.7, 0);
  const postR = postL.clone();
  postR.position.x = 6.6;
  const beam = block(14.2, 0.8, 0.9, wood);
  beam.position.y = 5.6;
  g.add(postL, postR, beam);
  return g;
}

function bench() {
  const g = new THREE.Group();
  const wood = 0xb58a5e;
  const seat = block(3.8, 0.35, 1.5, wood);
  seat.position.y = 1.55;
  const back = block(3.8, 1.2, 0.3, wood);
  back.position.set(0, 2.4, -0.65);
  g.add(seat, back);
  for (const x of [-1.6, 1.6]) {
    const leg = block(0.3, 1.4, 1.2, 0x7b5a3a);
    leg.position.set(x, 0.7, 0);
    g.add(leg);
  }
  return g;
}

function mailbox(flagUp, envelopes) {
  const g = new THREE.Group();
  const post = block(0.35, 3, 0.35, 0x7b5a3a);
  post.position.y = 1.5;
  const box = block(1.3, 1.1, 2, 0x8ea6d8);
  box.position.y = 3.4;
  const flagPole = block(0.12, 1.2, 0.12, 0xe6ecf1);
  flagPole.position.set(0.75, 3.6 + (flagUp ? 0.5 : 0), 0.4);
  const flag = block(0.08, 0.45, 0.6, 0xe39b7b);
  flag.position.set(0.8, flagUp ? 4.5 : 3.4, flagUp ? 0.4 : 0.75);
  if (!flagUp) flag.rotation.x = Math.PI / 2;
  g.add(post, box, flagPole, flag);
  for (let i = 0; i < envelopes; i++) {
    const e = block(1.1, 0.12, 0.75, 0xfaf6ec);
    e.position.set(0, 4.02 + i * 0.14, -0.4 + i * 0.25);
    e.rotation.y = (i - 1) * 0.15;
    g.add(e);
  }
  return g;
}

function mirror() {
  const g = new THREE.Group();
  const wood = 0xa57c52;
  const frameL = block(0.4, 6, 0.4, wood);
  frameL.position.set(-2.1, 3, 0);
  const frameR = frameL.clone();
  frameR.position.x = 2.1;
  const top = block(4.6, 0.4, 0.4, wood);
  top.position.y = 6;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 5.4), new THREE.MeshLambertMaterial({ color: 0xcfe9f7, emissive: 0x6fa8c8, emissiveIntensity: 0.25 }));
  glass.position.set(0, 3.1, 0.05);
  g.add(frameL, frameR, top, glass);
  return g;
}

function miniFlag(color) {
  const g = new THREE.Group();
  const pole = block(0.12, 2.2, 0.12, 0xe6ecf1);
  pole.position.y = 1.1;
  const f = block(0.08, 0.7, 1.1, color);
  f.position.set(0, 1.85, 0.58);
  g.add(pole, f);
  return g;
}

// ---------- The hub stage ----------

export function createHub(game) {
  const { scene, avatar } = game;
  const root = new THREE.Group();
  root.position.copy(HUB);
  root.visible = false;
  scene.add(root);
  const W = (v) => v.clone().add(HUB);

  let els = null;
  let route = null;
  let islandKey = null;
  const isl = {};
  const buddy = creature();
  buddy.visible = false;
  root.add(buddy);
  let buddyWant = 0.7;

  // Ground for every island, built once.
  for (const [k, def] of Object.entries(ISLANDS)) {
    const group = new THREE.Group();
    group.position.copy(def.at);
    group.add(ground({ w: def.w, d: def.d }));
    root.add(group);
    isl[k] = { group, content: null, key: null, taps: [], stands: {}, points: islandPts(def.w, def.d, 5) };
  }

  // ---------- Dock helpers ----------
  const smooth = () => (prefersReduced() ? 'auto' : 'smooth');
  const dockButton = (text) => [...(els?.dock?.querySelectorAll('button, a') || [])].find((b) => b.textContent.trim().includes(text));
  function pressText(text) {
    const b = dockButton(text);
    if (!b || b.disabled) return;
    sfx.tap();
    b.scrollIntoView({ block: 'nearest', behavior: smooth() });
    b.click();
  }
  function reveal(el) {
    if (!el) return;
    sfx.tap();
    el.scrollIntoView({ block: 'start', behavior: smooth() });
  }
  // A card in the dock whose text contains `text`.
  const dockCard = (text) => [...(els?.dock?.querySelectorAll('.card, section') || [])].find((c) => c.textContent.includes(text));
  // The row of a dock bar chart (Patterns) whose label starts with `text`.
  const barRow = (listIndex, text) =>
    [...(els?.dock?.querySelectorAll('.bars')[listIndex]?.children || [])].find((li) => li.querySelector('.bar-label')?.textContent.startsWith(text));

  // Rebuild an island's content group; returns it.
  function fresh(k) {
    const I = isl[k];
    if (I.content) I.group.remove(I.content);
    I.content = new THREE.Group();
    I.group.add(I.content);
    I.taps = [];
    I.sync = null;
    return I.content;
  }
  // A tap on an island prop (anchor in the prop's local space).
  const tapEntry = (obj, fn, local = V(0, 0, 0), id = null) => [obj, fn, () => obj.localToWorld(local.clone()), id];
  function tapOn(k, obj, fn, local, id) {
    isl[k].taps.push(tapEntry(obj, fn, local, id));
  }
  // An invisible, thumb-sized hit box.
  function hitBox(parent, w, h, d, at) {
    const hb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.copy(at);
    parent.add(hb);
    return hb;
  }

  // ---------- Islands ----------

  const BUILD = {
    // Base: start a map; the help sign right there; the bench, parked
    // worries and the mailbox around the edges.
    base(d) {
      const g = fresh('base');
      const b = d.base;
      // Start gate: the same whether he made 0 or 3 maps today. The start
      // pads stand on a stone step under it, so they read against the grass.
      const gt = gate();
      gt.position.set(0, 0, -5.2);
      const step = brick({ w: 12.6, h: 0.5, d: 4.6, color: STONE });
      step.position.set(0, 0.5, -2);
      g.add(gt, step);
      const pads = b.active
        ? [[HUB_SIGNS.continueMap, 'Continue my map', V(0, 0.8, -2), 0xf0a868]]
        : [[HUB_SIGNS.newMap, 'New worry map', V(-3.4, 0.8, -2), 0xf0a868], [HUB_SIGNS.withParent, 'Map it with a parent', V(3.4, 0.8, -2), 0x7fa7e0]];
      pads.forEach(([label, text, at, color], i) => {
        const p = prio(pad({ label, number: null, color, w: 3.4, d: 3.4, maxWidthPx: 300 }), 4);
        p.position.copy(at);
        g.add(p);
        tapOn('base', p.userData.hit, () => pressText(text), V(0, 0.5, 0.5), `gate:${i}`);
      });
      // The help sign, front-left: the crisis route is one tap from the world.
      const help = prio(sign(HUB_SIGNS.help, { color: '#7ec2bd', maxWidthPx: 300 }), 9);
      help.position.set(-7.5, 1.2, 5.5);
      const helpPost = block(0.3, 1.4, 0.3, 0x8a6a4a);
      helpPost.position.set(-7.5, 0.7, 5.5);
      g.add(help, helpPost);
      tapOn('base', hitBox(g, 4, 3, 2, V(-7.5, 1.5, 5.5)), () => nav.go('help'), V(0, 0, 0), 'help');
      // Bench: always there (he sits on it when the day's maps are done).
      const bn = bench();
      bn.position.set(7, 0, 3.2);
      g.add(bn);
      isl.base.stands.cap = V(7, 0.05, 3.45);
      if (b.check) {
        const s = prio(sign(HUB_SIGNS.bench, { color: '#e8c56f', maxWidthPx: 300 }), 3);
        s.position.set(7, 0.9, 5.6);
        const sPost = block(0.3, 1, 0.3, 0x8a6a4a);
        sPost.position.set(7, 0.5, 5.6);
        g.add(s, sPost);
        tapOn('base', hitBox(g, 4.4, 3.4, 4.4, V(7, 1.6, 4.4)), () => pressText('Check it'), V(0, 0, 0), 'bench');
      }
      // Parking lot down the left edge: one box per parked worry, no text,
      // no count, no badge.
      const shown = Math.min(Math.max(b.parked, 1), 5);
      for (let i = 0; i < shown; i++) {
        const box = parkingBox({ letter: false });
        box.scale.setScalar(0.55);
        box.position.set(-10.5, 0, -4 + i * 2.1);
        g.add(box);
        if (b.parked) {
          tapOn('base', hitBox(g, 2, 2, 2, V(-10.5, 1, -4 + i * 2.1)), () => reveal(els?.dock?.querySelectorAll('.parked-list li')[i] || dockCard('Parked worries')), V(0, 0, 0), `parked:${i}`);
        }
      }
      if (b.parked > 5) {
        const more = prio(sign(HUB_SIGNS.more(b.parked - 5)), 1);
        more.position.set(-10.5, 0.8, 6.4);
        g.add(more);
      }
      // Mailbox: flag up when a weekly summary is due; an envelope per waiting summary.
      const mb = mailbox(b.due, Math.min(b.outbox, 3));
      mb.position.set(10, 0, -3.5);
      g.add(mb);
      tapOn('base', hitBox(g, 2.4, 5, 2.6, V(10, 2.5, -3.5)), () => reveal(dockCard('Summary waiting') || dockCard('Weekly summary')), V(0, 0, 0), 'mailbox');
      isl.base.stands.home = V(0, 0, 3.2);
      isl.base.stands.onboarding = V(0, 0, 1);
      isl.base.stands.share = V(7.8, 0, -2);
      isl.base.views = {
        home: span(-11.5, 11.5, -7.5, 8, 6.5),
        onboarding: around(V(0, 0, 1), 3.6, 4.6),
        share: around(V(9.4, 0, -3), 3.4, 5),
        cap: around(V(7, 0, 3.2), 3.6, 3.6),
      };
      isl.base.hideFor = { onboarding: true };
    },

    // My maps: a path of stones, newest at the front, one stone per map.
    // No signs; the dock list has the words.
    trail(d) {
      const g = fresh('trail');
      const list = d.trail.slice(0, 12);
      const at = (i) => V(Math.sin(i * 0.9) * 3.4, 0, 17 - i * 3.4);
      list.forEach((m, i) => {
        const p = at(i);
        const st = brick({ w: 3.2, h: 0.5, d: 3.2, color: STONE });
        st.position.copy(p).add(V(0, 0.5, 0));
        g.add(st);
        if (m.status === 'done' && ZONE[m.category]) {
          const f = miniFlag(ZONE[m.category]);
          f.position.copy(p).add(V(1, 0.5, -0.9));
          g.add(f);
        } else if (m.status === 'stopped') {
          const stake = block(0.18, 1.5, 0.18, 0x8a6a4a);
          stake.position.copy(p).add(V(1, 1.25, -0.9));
          g.add(stake);
        }
        tapOn('trail', hitBox(g, 3.6, 2.6, 3.6, p.clone().add(V(0, 1, 0))), () => {
          sfx.tap();
          nav.go(`maps/${m.id}`);
        }, V(0, 0, 0), `stone:${m.id}`);
      });
      if (d.trail.length > list.length) {
        const more = prio(sign(HUB_SIGNS.more(d.trail.length - list.length)), 1);
        more.position.copy(at(list.length - 1)).add(V(0, 1.2, -2.6));
        g.add(more);
      }
      isl.trail.stands.maps = V(0, 0, 20);
      // frame the newest six stones and him; older ones trail off behind
      const back = list.length ? at(Math.min(list.length, 6) - 1).z - 2 : 14;
      isl.trail.views = { maps: span(-5.5, 5.5, back, 21.5, 3) };
    },

    // Scoreboard: the tally fence up front left (the hero), the two odds
    // towers front right, and a skyline of weeks behind.
    lookout(d) {
      const g = fresh('lookout');
      const s = d.score;
      // Tally fence: one post per checked map, in fives, ten to a rail.
      const outcomes = s.outcomes || [];
      outcomes.slice(0, 40).forEach((o, i) => {
        const k = i % 10;
        const p = block(0.7, 3, 0.7, OUT[o]);
        p.position.set(-10 + k * 1.1 + Math.floor(k / 5) * 0.7, 1.5, 5 + Math.floor(i / 10) * 1.5);
        g.add(p);
      });
      // the hero sign stands in front of the fence, low, so the weeks behind stay in view
      const fenceSign = prio(sign(HUB_SIGNS.wolf(s.wolf), { small: false, maxWidthPx: 420 }), 5);
      fenceSign.position.set(-5, 0.2, 10.6);
      g.add(fenceSign);
      if (outcomes.length > 40) {
        const more = prio(sign(HUB_SIGNS.more(outcomes.length - 40)), 1);
        more.position.set(0.4, 1, 11);
        g.add(more);
      }
      // Weeks, oldest left to newest right: a column per week, one block per
      // mapped worry, by outcome. The dock table has the dates.
      const n = s.weeks.length;
      s.weeks.forEach((w, i) => {
        const at = V(-9.1 + (n - 1 - i) * 2.6, 0, -6);
        const plinth = brick({ w: 2.2, h: 0.4, d: 2.2, color: STONE });
        plinth.position.copy(at).add(V(0, 0.4, 0));
        g.add(plinth);
        const kinds = [...Array(w.yes).fill('yes'), ...Array(w.partly).fill('partly'), ...Array(w.no).fill('no'), ...Array(w.unchecked).fill('unchecked')];
        kinds.slice(0, 12).forEach((kind, j) => {
          const c = block(0.9, 0.9, 0.9, OUT[kind]);
          c.position.copy(at).add(V(0, 0.85 + j * 0.95, 0));
          g.add(c);
        });
        if (kinds.length > 12) {
          const more = prio(sign(HUB_SIGNS.more(kinds.length - 12)), 1);
          more.position.copy(at).add(V(0, 12.4, 0));
          g.add(more);
        }
        tapOn('lookout', hitBox(g, 2.6, 6, 2.6, at.clone().add(V(0, 2.5, 0))), () => reveal(els?.dock?.querySelectorAll('.score-table tbody tr')[i]), V(0, 1, 0), `week:${i}`);
      });
      if (n) {
        const bw = prio(sign(HUB_SIGNS.byWeek), 2);
        bw.position.set(1.5, 0.2, -3.6);
        g.add(bw);
      }
      // Odds: what he predicted on average, and how often it came true.
      if (s.odds) {
        // narrow value signs, so each wraps to two short lines
        const pred = prio(stairTower({ size: 0.42, numbers: false, lift: 4, valueWidth: 300 }), 3);
        pred.position.set(4, 0, 9);
        const real = prio(stairTower({ size: 0.42, numbers: false, lift: 4, valueWidth: 300 }), 3);
        real.position.set(8.2, 0, 9);
        g.add(pred, real);
        pred.userData.set(Math.round(s.odds.avgPredicted / 10), SLATE, HUB_SIGNS.oddsPredicted(s.odds.avgPredicted));
        real.userData.set(Math.round((s.odds.yes / s.odds.checked) * 10), SLATE, HUB_SIGNS.oddsCameTrue(s.odds.yes, s.odds.checked));
        tapOn('lookout', hitBox(g, 2, 5, 9, V(4, 2, 4.8)), () => reveal(dockCard('I predicted')), V(0, 0, 3), 'odds:predicted');
        tapOn('lookout', hitBox(g, 2, 5, 9, V(8.2, 2, 4.8)), () => reveal(dockCard('I predicted')), V(0, 0, 3), 'odds:true');
      }
      isl.lookout.stands.score = V(1.5, 0, 11.5);
      isl.lookout.views = { score: span(-11, 11, -7, 12.5, 7) };
    },

    // Patterns: five plots (A-E) with a block per map, and six fear posts
    // with a ring per map. Letters only; the dock has the names.
    field(d) {
      const g = fresh('field');
      const f = d.field;
      CATEGORIES.forEach((cat, i) => {
        const id = cat.id;
        const at = V(-9.6 + i * 4.8, 0, -3);
        const p = brick({ w: 4, h: 0.4, d: 4, color: ZONE[id] });
        p.position.copy(at).add(V(0, 0.4, 0));
        g.add(p);
        const n = f.categories[id] || 0;
        for (let j = 0; j < Math.min(n, 15); j++) {
          const c = block(0.95, 0.95, 0.95, new THREE.Color(ZONE[id]).offsetHSL(0, 0, -0.08).getHex());
          c.position.copy(at).add(V(-1.05 + (j % 3) * 1.05, 0.9 + Math.floor(j / 3) * 1.0, 0));
          g.add(c);
        }
        if (n > 15) {
          const more = prio(sign(HUB_SIGNS.more(n - 15)), 1);
          more.position.copy(at).add(V(0, 6.2, 0));
          g.add(more);
        }
        const badge = prio(makeSign('', { number: id, color: hex(new THREE.Color(ZONE[id]).offsetHSL(0, 0, -0.2)), maxLines: 1 }), 3);
        badge.position.copy(at).add(V(0, 0.45, 2.4));
        g.add(badge);
        tapOn('field', hitBox(g, 4.4, 4, 4.4, at.clone().add(V(0, 1.5, 0))), () => reveal(barRow(0, `${id}.`)), V(0, 0, 0), `plot:${id}`);
      });
      const most = Math.max(0, ...CORE_FEARS.map((x) => f.fears[x.id] || 0));
      const tallest = CORE_FEARS.filter((x) => (f.fears[x.id] || 0) === most);
      CORE_FEARS.forEach((fear, i) => {
        const at = V(-10 + i * 4, 0, -10);
        const post = block(0.35, 6.5, 0.35, 0x8a6a4a);
        post.position.copy(at).add(V(0, 3.25, 0));
        g.add(post);
        const n = f.fears[fear.id] || 0;
        for (let j = 0; j < Math.min(n, 12); j++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.2, 8, 20), lam(LAVENDER));
          ring.rotation.x = Math.PI / 2;
          ring.position.copy(at).add(V(0, 0.3 + j * 0.44, 0));
          g.add(ring);
        }
        if (n > 12) {
          const more = prio(sign(HUB_SIGNS.more(n - 12)), 1);
          more.position.copy(at).add(V(0, 6.8, 0));
          g.add(more);
        }
        // only the one tallest post is named (no name on a tie)
        if (most > 0 && tallest.length === 1 && tallest[0] === fear) {
          const ls = prio(makeSign(SIGN_LABELS.core[fear.id], { maxLines: 1, small: true }), 2);
          ls.position.copy(at).add(V(0, 7, 0));
          g.add(ls);
        }
        tapOn('field', hitBox(g, 2.4, 7, 2.4, at.clone().add(V(0, 3.2, 0))), () => reveal(barRow(1, fear.label)), V(0, 3, 0), `fear:${fear.id}`);
      });
      isl.field.stands.patterns = V(11, 0, 5.5);
      isl.field.views = { patterns: around(V(0, 0, -5), 12, 7) };
    },

    workshop() {
      const g = fresh('workshop');
      const m = mirror();
      m.position.set(0, 0, -3.5);
      g.add(m);
      isl.workshop.stands.settings = V(0, 0, 1.5);
      isl.workshop.views = { settings: around(V(0, 0, -0.5), 4.8, 7.6) };
    },

    // The tomorrow check: his worry on a signpost, the creature at the size it
    // felt, and one question at a time (the dock shows all three).
    bench(d) {
      const g = fresh('bench');
      const c = d.check;
      const m = c.map;
      const post = prio(signpost(`What if ${m.worry.text}?`), 2);
      post.position.set(0, 0, -8);
      g.add(post);
      isl.bench.creatureAt = V(-9.5, 0, -3);
      if (c.result) {
        // The one honest "odds vs reality" moment. Only his own number moves.
        post.position.z = -6;
        const a = prio(sign(HUB_SIGNS.resultPredicted(m.reality.odds), { small: false, maxWidthPx: 420 }), 4);
        a.position.set(-4, 0.4, 1);
        const b = prio(sign(HUB_SIGNS.resultHappened(HAPPENED_LABEL[c.result.happened]), { small: false, maxWidthPx: 420 }), 4);
        b.position.set(5, 0.4, 1);
        g.add(a, b);
        isl.bench.stands.check = V(1, 0, 5);
        isl.bench.views = { check: span(-11, 9, -8, 6.5, 5) };
        buddyWant = 0.45 + (c.result.howBad / 10) * 0.75;
        return;
      }
      buddyWant = 0.45 + ((m.body.before ?? 5) / 10) * 0.75;
      isl.bench.stands.check = V(8.5, 0, 6);
      isl.bench.views = { check: span(-11, 10, -9.5, 7.5, 6) };
      const question = prio(sign(HUB_SIGNS.checkQs.happened, { small: false }), 3);
      question.position.set(0, 0.2, 6.2); // a placard in front of the pads
      g.add(question);

      // One row of pads per question, all in the same spot, in the dock's
      // order: did it happen, how bad (the tower), did I cope, the next step.
      const hasStep = !!m.next?.text?.trim();
      const ORDER = ['happened', 'howBad', 'coped', ...(hasStep ? ['stepDone'] : [])];
      const QUESTION = { ...HUB_SIGNS.checkQs, stepDone: HUB_SIGNS.checkQs.step };
      const rows = {};
      const rowTaps = {};
      const makeRow = (key, list, groupIndex, colors) => {
        const row = new THREE.Group();
        g.add(row);
        rowTaps[key] = [];
        const gap = list.length > 3 ? 5 : 6;
        rows[key] = list.map((opt, i) => {
          const label = opt.id === CHECK_NOT_YET.id ? HUB_SIGNS.notYet : opt.label;
          const p = prio(pad({ label, number: null, color: colors[i], w: 3.4, d: 3.4, maxWidthPx: 300 }), 4);
          p.position.set((i - (list.length - 1) / 2) * gap, 0.3, 2);
          row.add(p);
          const press = () => {
            const card = els?.dock?.querySelectorAll('.choices')[groupIndex]?.querySelector(`.choice[data-id="${opt.id}"]`);
            if (!card) return;
            sfx.tap();
            card.click();
            card.scrollIntoView({ block: 'nearest', behavior: smooth() });
          };
          rowTaps[key].push(tapEntry(p.userData.hit, press, V(0, 0.5, 0.5), `${key}:${opt.id}`));
          return { id: opt.id, obj: p };
        });
        rows[key].group = row;
      };
      makeRow('happened', [...CHECK_HAPPENED, CHECK_NOT_YET], 0, [...CHECK_HAPPENED.map((o) => OUT[o.id]), STONE]);
      makeRow('coped', CHECK_COPED, 1, [0xa9b8d9, 0xc9b3e0, 0xb8c9a9, STONE]);
      if (hasStep) makeRow('stepDone', CHECK_STEP, 2, [0x9fd0c8, 0xc9b3e0, STONE]);
      // How bad it really was: a 0-10 tower; its steps set the dock slider.
      const tower = prio(stairTower({ size: 0.5, lift: 4 }), 4);
      tower.position.set(4, 0, 5);
      g.add(tower);
      rowTaps.howBad = tower.userData.steps.map((s, v) => tapEntry(s, () => {
        const input = els?.dock?.querySelector('input[type="range"]');
        if (!input) return;
        sfx.tap();
        input.value = String(v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, V(0, 0, 0), `bad:${v}`));

      let stage = null;
      function show(next) {
        stage = next;
        for (const k of Object.keys(rows)) rows[k].group.visible = next === k;
        tower.visible = next === 'howBad';
        question.userData.sign.set({ text: QUESTION[next] });
        isl.bench.taps = rowTaps[next];
        if (islandKey === 'bench') registerTaps();
      }
      // A first answer moves on to the next question; changing an earlier
      // answer in the dock brings its row back. "Hasn't come up yet" ends the
      // check, so its row stays. The slider sends a stream of changes while
      // it's dragged: stay on the tower, and move on once it has settled.
      let before = {};
      let token = 0;
      let settle = null;
      const nextOpen = () => ORDER.find((k) => before[k] == null);
      isl.bench.sync = (answer) => {
        for (const k of Object.keys(rows)) rows[k].forEach((p) => p.obj.userData.set({ selected: p.id === answer[k] }));
        tower.userData.set(answer.howBad ?? null, moodColor((answer.howBad ?? 5) / 10));
        const last = answer.last;
        const notYet = answer.happened === CHECK_NOT_YET.id;
        const firstTime = last && before[last] == null;
        before = { ...answer };
        clearTimeout(settle);
        let want;
        if (notYet) want = 'happened';
        else if (last === 'howBad') {
          want = 'howBad';
          settle = setTimeout(() => {
            const n = nextOpen();
            if (stage === 'howBad' && n && n !== 'howBad') show(n);
          }, 1400);
        } else want = last && !firstTime ? last : nextOpen() ?? last ?? 'happened';
        const spot = last === 'howBad'
          ? (answer.howBad != null ? tower.userData.stepTop(answer.howBad) : null)
          : rows[last]?.find((p) => p.id === answer[last])?.obj.userData.top();
        const t = ++token;
        if (!spot) return show(want);
        if (want === stage) show(want);
        // land on the pick, then the next question's pads come up
        game.jumpTo(spot, { height: 2 }).then(() => {
          if (t === token && want !== stage) show(want);
        });
      };
      show('happened');
      isl.bench.sync(c.answer || {});
    },
  };

  // Which islands need a rebuild for this data.
  function keyOf(k, d) {
    switch (k) {
      case 'base': return JSON.stringify(d.base);
      case 'trail': return JSON.stringify(d.trail.slice(0, 13));
      case 'lookout': return JSON.stringify(d.score);
      case 'field': return JSON.stringify({ c: d.field.categories, f: d.field.fears });
      case 'workshop': return 'w';
      case 'bench': return d.check ? `${d.check.map.id}:${d.check.result ? 'r' : 'q'}` : null;
      default: return null;
    }
  }

  function frame(snap) {
    const I = isl[islandKey];
    const pts = (I.views?.[route] || I.points).map((p) => W(p.clone().add(ISLANDS[islandKey].at)));
    const f = game.fit(pts, { yaw: 0, pitch: PITCH });
    game.shot({ target: f.target, dist: f.dist, yaw: 0, pitch: PITCH, snap });
  }

  function registerTaps() {
    game.clearTappables();
    for (const t of isl[islandKey].taps) game.addTappable(...t);
  }

  // The sign budget: most important first; a sign that would overlap one
  // already shown steps aside (layer 1 isn't drawn). Flat strips show none.
  const _p = new THREE.Vector3();
  const shownUp = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const rank = (o) => (o.material.depthTest === false ? 8 : o.userData.priority ?? 2);
  function cull() {
    const I = isl[islandKey];
    if (!I?.content) return;
    const { top, bottom } = game.strip();
    const flat = bottom - top < FLAT_STRIP;
    const signs = [];
    I.group.traverse((o) => {
      if (o.isSprite && o.userData.sign) signs.push(o);
    });
    const kept = [];
    signs.filter(shownUp).sort((a, b) => rank(b) - rank(a)).forEach((o) => {
      let show = !flat;
      if (show) {
        const s = game.screenOf(o.getWorldPosition(_p));
        const { w, h } = signPx(o);
        const r = { x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h, y1: s.y };
        show = rank(o) >= 9 || !kept.some((k) => r.x0 < k.x1 && r.x1 > k.x0 && r.y0 < k.y1 && r.y1 > k.y0);
        if (show) kept.push(r);
      }
      o.layers.set(show ? 0 : 1);
    });
  }

  return {
    update(dt, t, motion) {
      tickPads(dt);
      if (buddy.visible) {
        buddy.userData.setSize(buddyWant);
        buddy.userData.update(dt, t, motion);
      }
      cull();
    },
    onView() {
      if (islandKey) frame(false);
    },
    hide() {
      root.visible = false;
    },
    wake() {
      root.visible = true;
    },
    dispose() {},

    async enter(name, d, newEls) {
      els = newEls;
      game.setViewEls(els.top, els.dock);
      game.attach(els.slot);
      const prevIsland = islandKey;
      route = name;
      islandKey = ROUTE_ISLAND[name] || 'base';
      // rebuild islands whose data changed
      for (const k of Object.keys(ISLANDS)) {
        const key = keyOf(k, d);
        if (key == null || key === isl[k].key) continue;
        if (k === 'bench' && name !== 'check') continue;
        BUILD[k](d);
        isl[k].key = key;
      }
      // Only this island's props show (the base's hide during onboarding:
      // an empty island to start).
      for (const k of Object.keys(ISLANDS)) {
        if (isl[k].content) isl[k].content.visible = k === islandKey && !(isl[k].hideFor?.[route]);
      }
      root.updateMatrixWorld(true);
      registerTaps();
      game.sky.setMood(0.4);
      game.clouds.centerOn(W(ISLANDS[islandKey].at));
      // the creature only appears on the tomorrow-check island
      buddy.visible = islandKey === 'bench';
      if (buddy.visible) {
        buddy.position.copy(isl.bench.creatureAt.clone().add(ISLANDS.bench.at));
        buddy.userData.setColor(moodColor(buddyWant > 0.9 ? 0.8 : 0.5));
        buddy.lookAt(W(ISLANDS.bench.at).add(V(0, 0, 40)));
      }
      const stand = W((isl[islandKey].stands[route] || V(0, 0, 3)).clone().add(ISLANDS[islandKey].at));
      avatar.state.mode = 'idle';
      const far = !prevIsland || game.motion() < 1 || avatar.root.position.distanceTo(stand) > 70 || prevIsland === islandKey && route === 'cap';
      if (far) {
        await game.cut(() => {
          game.place(stand);
          avatar.state.heading = 0.6;
          avatar.root.rotation.y = 0.6;
          frame(true);
        }, { out: prevIsland ? 160 : 0 });
      } else {
        frame(false);
        await game.jumpTo(stand, { height: prevIsland === islandKey ? 2 : 7 });
      }
      if (route === 'cap') {
        avatar.state.mode = 'sit';
        avatar.state.heading = 0;
      }
    },

    // Small updates without a re-render: his look, the check answers.
    apply(d) {
      if (d?.avatar) avatar.setStyle(d.avatar);
      if (d?.answer && route === 'check') isl.bench.sync?.(d.answer);
    },
  };
}
