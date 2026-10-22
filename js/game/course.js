// The Worry Obby: one small floating island per step. Each island mirrors the
// dock below it. Tapping a numbered platform clicks the matching dock card;
// the island then re-reads the map (sync) and moves the avatar, lights
// lanterns, sizes the worry creature and sets the weather. The dock is the
// source of truth, so the crisis check, Back-with-a-reason and saving are
// unchanged.
import * as THREE from '../vendor/three.module.min.js';
import {
  WHEN, BODY_SPOTS, CATEGORIES, CORE_FEARS, CORE_BOTTOM, ODDS, HISTORY, FRIEND, COPE, SIGN_LABELS, STEPS,
} from '../content.js';
import {
  ground, pad, signpost, stairTower, creature, bigFigure, gearProp, parkingBox, bannerFlag, easel, footprint, glow, tickPads, PAD_COLORS, PAD_LIFT,
} from './props.js';
import { brick, glowBrick, makeSign, SIGN_PX } from './kit.js';
import { sfx } from './audio.js';
import { prefersReduced } from '../mind/index.js';
import { coreOptions } from '../logic.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PITCH = 0.62; // about 36 degrees down: islands read as islands
const DIRT = -3.8; // bottom of an island's dirt layer
const HEAT = new THREE.Color(0xff6a3d);
const ZONE = { A: 0xd99ab8, B: 0xe8c56f, C: 0x86c79a, D: 0x8ea6d8, E: 0xc9a97a };

// 0 calm (teal) .. 1 heavy (coral)
const CALM = new THREE.Color(0x7ec2bd);
const MID = new THREE.Color(0xe8c56f);
const HEAVY = new THREE.Color(0xe08a6d);
export function moodColor(m) {
  const t = Math.min(1, Math.max(0, m));
  return t < 0.5 ? CALM.clone().lerp(MID, t * 2) : MID.clone().lerp(HEAVY, (t - 0.5) * 2);
}

// Positions for n items in a grid of `cols` columns; rows go away from the camera.
function grid(n, { cols = 2, dx = 7.6, dz = 6.2, z0 = 0, at = V(0, 0, 0) } = {}) {
  const out = [];
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i % cols;
    out.push(V(at.x + (col - (inRow - 1) / 2) * dx, at.y, at.z + z0 - row * dz));
  }
  return out;
}

// Framing points for an island: its ground corners, the dirt underneath at
// the front, and how high things reach at the back.
function islandPts(w, d, top = 4, at = V(0, 0, 0)) {
  const x0 = at.x - w / 2;
  const x1 = at.x + w / 2;
  const zf = at.z + d / 2;
  const zb = at.z - d / 2;
  return [V(x0, at.y, zf), V(x1, at.y, zf), V(x0, at.y + DIRT, zf), V(x1, at.y + DIRT, zf), V(x0, at.y + top, zb), V(x1, at.y + top, zb)];
}

const clean = (t) => String(t || '').replace(/^\s*what\s*if\s*/i, '').replace(/[?\s]+$/, '').trim();

export function createCourse(game) {
  const { scene, avatar } = game;
  const root = new THREE.Group();
  scene.add(root);
  const buddy = creature();
  scene.add(buddy);

  let mapId = null;
  let els = null;
  let current = null; // the island being played
  const islands = new Map();
  let ghost = null; // the next island, seen in the distance
  let buddyTarget = null;

  const stepIndex = (step) => STEPS.indexOf(step === 'done' ? 'next' : step);
  const originFor = (kind) => {
    const i = stepIndex(kind);
    return V(Math.sin(i * 1.4) * 9, -i * 5, -i * 56);
  };
  const smooth = () => (prefersReduced() ? 'auto' : 'smooth');

  // A tap in the world presses the matching dock card (and shows it).
  function press(id) {
    const card = els?.dock?.querySelector(`.choice[data-id="${CSS.escape(String(id))}"]`);
    if (!card) return;
    sfx.tap();
    card.click();
    card.scrollIntoView({ block: 'nearest', behavior: smooth() });
  }
  // Bring a dock section (by one of its card ids) into view.
  function revealDock(id) {
    const card = els?.dock?.querySelector(`.choice[data-id="${CSS.escape(String(id))}"]`);
    (card?.closest('.q') || card)?.scrollIntoView({ block: 'start', behavior: smooth() });
  }

  // ---------- Avatar movement: a short queue, always heading for the latest plan ----------
  let route = [];
  let routeKey = null;
  let routeColor = 0xffffff;
  let moving = false;
  async function go(points, key, color = 0xffffff) {
    if (key === routeKey) return;
    routeKey = key;
    route = points.map((p) => p.clone());
    routeColor = color;
    buddy.userData.hop();
    if (moving) return;
    moving = true;
    game.shot({ follow: 0.25 });
    while (route.length) {
      const next = route.shift();
      if (avatar.root.position.distanceTo(next) < 0.05) continue;
      const drop = next.y < avatar.root.position.y - 2;
      await game.jumpTo(next, { height: drop ? 1 : 2.2, color: routeColor });
    }
    game.shot({ follow: 0 });
    moving = false;
  }

  // ---------- Island builders ----------
  // build(group, isl) adds props to `group` (already placed in the world) and
  // fills in isl: entrance, buddySpot, points (for framing), sync(map) -> plan.
  // A plan is { key, path: [world positions], color } for the avatar.

  function padsOn(group, list, labels, positions, { badge, colorOf, maxWidthPx, signLow, signHigh, compact, maxLines } = {}) {
    return list.map((opt, i) => {
      const color = colorOf ? colorOf(opt, i) : PAD_COLORS[i % PAD_COLORS.length];
      const p = pad({ label: labels[opt.id] ?? opt.label, number: badge ? badge(opt, i) : i + 1, color, maxWidthPx, signLow, signHigh, compact, maxLines });
      p.position.copy(positions[i]);
      group.add(p);
      game.addTappable(p.userData.hit, () => press(opt.id), () => p.userData.top(), opt.id);
      return { id: opt.id, obj: p, color, top: () => p.userData.top() };
    });
  }
  const find = (pads, id) => pads.find((p) => p.id === id);
  const planFor = (key, p) => ({ key, path: [p.top()], color: p.color });

  const BUILD = {
    worry(g, isl) {
      g.add(ground({ w: 20, d: 22 }));
      const post = signpost('What if …?');
      post.position.set(-4.5, 0, 8.5);
      g.add(post);
      const pads = padsOn(g, WHEN, SIGN_LABELS.when, grid(4, { z0: -2.5 }));
      isl.entrance = V(2, 0, 7.5);
      isl.buddySpot = V(7, 0, 6);
      isl.points = [...islandPts(20, 22, 4), V(-4.5, 6, 8.5)];
      isl.sync = (m) => {
        post.userData.setText(`What if ${clean(m.worry.text) || '…'}?`);
        pads.forEach((p) => p.obj.userData.set({ selected: p.id === m.worry.when }));
        const sel = find(pads, m.worry.when);
        return sel ? planFor(`when:${sel.id}`, sel) : { key: 'start', path: [isl.w(isl.entrance)] };
      };
    },

    body(g, isl) {
      g.add(ground({ w: 24, d: 26 }));
      // The big figure at the back; its parts glow where he feels it.
      const fig = bigFigure();
      fig.scale.setScalar(1.1);
      fig.position.set(0, 0, -9);
      g.add(fig);
      g.updateMatrixWorld(true);
      const halos = {};
      for (const part of ['head', 'throat', 'chest', 'stomach', 'hands']) {
        const at = g.worldToLocal(fig.userData.fig.partCenter(part, V(0, 0, 0)));
        const s = glow(0xff7a45, part === 'hands' ? 2.4 : 3.2);
        s.position.copy(at).add(V(0, 0, 1.2));
        s.material.opacity = 0;
        g.add(s);
        halos[part] = s;
      }
      // His 0-10 number shows big above the figure (the stairs come on the finish island).
      const meter = makeSign('Pick your number', { maxLines: 1, px: SIGN_PX.hero });
      meter.position.set(0, 8.4, -9);
      g.add(meter);
      const pads = padsOn(g, BODY_SPOTS, SIGN_LABELS.body, grid(6, { cols: 3, dx: 7, dz: 7.4, z0: 7.5 }), { compact: 'always' });
      isl.entrance = V(0, 0, 12);
      isl.buddySpot = V(-8, 0, 11);
      isl.points = [...islandPts(22, 26, 8.5)];
      let prev = null;
      isl.sync = (m) => {
        const strength = m.body.before;
        const col = moodColor(strength == null ? 0.5 : strength / 10);
        const level = 0.7 + ((strength ?? 5) / 10) * 0.3;
        pads.forEach((p) => p.obj.userData.set({ selected: m.body.spots.includes(p.id) }));
        for (const part of ['head', 'throat', 'chest', 'stomach', 'hands']) {
          const on = m.body.spots.includes(part);
          fig.userData.fig.setHeat(part, on ? level : 0, HEAT);
          halos[part].material.opacity = on ? 0.5 : 0;
        }
        meter.userData.sign.set({ text: strength == null ? 'Pick your number' : `${strength}/10`, active: strength != null });
        let plan = null;
        if (!prev && m.body.spots.length) {
          const last = find(pads, m.body.spots[m.body.spots.length - 1]);
          plan = planFor(`spot-start:${last.id}`, last);
        }
        if (prev) {
          const id = m.body.spots.find((s) => !prev.spots.includes(s)) || prev.spots.find((s) => !m.body.spots.includes(s));
          if (id) plan = { ...planFor(`spot:${id}:${m.body.spots.join()}`, find(pads, id)) };
          // a new number: he steps up to the figure to check in
          else if (strength != null && strength !== prev.strength) plan = { key: `meter:${strength}`, path: [isl.w(V(0, 0, -5.4))], color: col.getHex() };
        }
        prev = { spots: [...m.body.spots], strength };
        return plan;
      };
    },

    sort(g, isl) {
      g.add(ground({ w: 24, d: 20 }));
      // A zigzag: A C E in front, B D behind. Every door the same size; none alone.
      const zig = [V(-8, 0, 3.5), V(-4, 0, -3.5), V(0, 0, 3.5), V(4, 0, -3.5), V(8, 0, 3.5)];
      const pads = padsOn(g, CATEGORIES, SIGN_LABELS.sort, zig, {
        badge: (c) => c.id,
        colorOf: (c) => ZONE[c.id],
        maxWidthPx: 400,
        signLow: 4.1,
        signHigh: 4.7,
        compact: true,
      });
      // a door on each pad that swings open when chosen
      const doors = pads.map((p) => {
        const frame = new THREE.Group();
        const m = new THREE.MeshLambertMaterial({ color: 0xece4d6 });
        const post = (x) => {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), m);
          b.position.set(x, 1.8, -1.45);
          return b;
        };
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 0.3), m);
        top.position.set(0, 3.6, -1.45);
        const hinge = new THREE.Group();
        hinge.position.set(-1.1, 0, -1.45);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.16), new THREE.MeshLambertMaterial({ color: new THREE.Color(ZONE[p.id]).offsetHSL(0, -0.05, -0.12) }));
        panel.position.set(1.1, 1.75, 0);
        hinge.add(panel);
        frame.add(post(-1.25), post(1.25), top, hinge);
        p.obj.add(frame);
        return { id: p.id, hinge };
      });
      isl.entrance = V(0, 0, 8.5);
      isl.buddySpot = V(-9, 0, 8);
      isl.points = islandPts(24, 20, 7);
      let open = null;
      isl.update = (dt) => {
        for (const d of doors) d.hinge.rotation.y += ((d.id === open ? -1.15 : 0) - d.hinge.rotation.y) * Math.min(1, dt * 5);
      };
      isl.sync = (m) => {
        open = m.category;
        pads.forEach((p) => p.obj.userData.set({ selected: p.id === m.category }));
        const sel = find(pads, m.category);
        return sel ? planFor(`sort:${sel.id}`, sel) : { key: 'start', path: [isl.w(isl.entrance)] };
      };
    },

    // Dig: a terraced pit. Each round is a ledge lower and nearer the camera;
    // the pads he chose stay lit above and behind as the path he came down.
    core(g, isl) {
      const ledges = [];
      const ledgeAt = (r) => V(0, -r * 9, r * 22);
      // A ledge's pads are that round's choices, numbered like the dock's
      // cards: every fear but the one just picked, then "Nothing worse".
      const optionsKey = (chain, r) => coreOptions(chain.slice(0, r)).map((o) => o.id).join();
      const addLedge = (r, chain) => {
        if (ledges[r]) g.remove(ledges[r].group);
        const L = new THREE.Group();
        L.position.copy(ledgeAt(r));
        g.add(L);
        L.add(ground({ w: 19, d: 18, color: r % 2 ? 0x9fd09a : 0x8fcf86 }));
        const pos = grid(6, { cols: 3, dx: 7, dz: 7.4, z0: 3.5 });
        const pads = coreOptions(chain.slice(0, r)).map((f, i) => {
          // each fear keeps its color on every ledge; "Nothing worse" is plain stone
          const color = f.id === CORE_BOTTOM.id ? 0xd9cdb8 : PAD_COLORS[CORE_FEARS.findIndex((x) => x.id === f.id)];
          const p = pad({ label: SIGN_LABELS.core[f.id], number: i + 1, color, compact: true });
          p.position.copy(pos[i]);
          L.add(p);
          const mark = footprint();
          mark.position.set(-0.7, PAD_LIFT + 0.06, 0.6);
          mark.visible = false;
          p.add(mark);
          return { id: f.id, obj: p, mark, color, top: () => p.userData.top() };
        });
        L.updateMatrixWorld(true);
        ledges[r] = { group: L, pads, key: optionsKey(chain, r) };
      };
      addLedge(0, []);
      isl.entrance = V(0, 0, 8.5);
      isl.buddySpot = V(-7.8, 0, 8);
      isl.points = islandPts(19, 18, 4);
      let shown = 0;
      isl.sync = (m) => {
        const c = m.core;
        const done = !!c.fear;
        const round = done ? c.chain.length - 1 : c.chain.length;
        // (re)build ledges whose choices changed, e.g. after Back and a different pick
        for (let r = 0; r <= round; r++) if (!ledges[r] || ledges[r].key !== optionsKey(c.chain, r)) addLedge(r, c.chain);
        game.clearTappables();
        if (!done) ledges[round].pads.forEach((p) => game.addTappable(p.obj.userData.hit, () => press(p.id), p.top, p.id));
        ledges.forEach((L, r) => {
          L.group.visible = r <= round;
          L.pads.forEach((p) => {
            const chosen = r < c.chain.length && c.chain[r] === p.id;
            const pending = r === round && !done && c.pending === p.id;
            const isCore = done && r === round && p.id === c.fear;
            p.obj.visible = r === round || chosen;
            // on the result only the core fear and the lit path keep their labels
            p.obj.userData.set({ selected: pending || isCore, lit: chosen || isCore, quiet: done && r === round && !isCore });
            p.mark.visible = r === round && !done && c.chain.includes(p.id);
          });
        });
        const at = ledgeAt(round);
        isl.points = islandPts(19, 18, 4, at);
        // On the result, keep the ledge above in the frame: the path down is lit.
        if (done && round > 0) isl.points.push(...islandPts(19, 18, 4, ledgeAt(round - 1)).slice(4));
        if (round !== shown || done !== isl.wasDone) {
          shown = round;
          if (done && isl.wasDone === false) sfx.core();
          isl.wasDone = done;
          isl.reframe();
        }
        if (done) return planFor(`core:${round}:${c.fear}`, find(ledges[round].pads, c.fear));
        if (c.pending) return planFor(`pick:${round}:${c.pending}`, find(ledges[round].pads, c.pending));
        return { key: `ledge:${round}`, path: [isl.w(V(at.x, at.y, at.z + 8))] };
      };
    },

    // Reality: three small station islands, left to right. Answer one and the
    // avatar lands on it, then jumps across to the next station that still
    // needs an answer. The dock scrolls to the matching question.
    reality(g, isl) {
      const ORDER = ['odds', 'history', 'friend'];
      const st = { odds: V(-20, 0, 0), history: V(0, 0, 0), friend: V(20, 0, 0) };
      const firstCard = { odds: 0, history: 'never', friend: 'unlikely' };
      for (const k of ORDER) {
        const island = ground({ w: 16, d: 22 });
        island.position.copy(st[k]);
        g.add(island);
      }
      const odds = ODDS.map((v, i) => {
        const p = pad({ label: `${v}%`, number: null, color: 0x8ea6d8, w: 2.6, d: 2.6, h: 0.6 });
        const row = i < 4 ? 0 : 1;
        const col = row ? i - 4 : i;
        const n = row ? 3 : 4;
        p.position.set(st.odds.x + (col - (n - 1) / 2) * 3.5, 0, st.odds.z + 1.5 - row * 5.6);
        g.add(p);
        game.addTappable(p.userData.hit, () => press(v), () => p.userData.top(), v);
        return { id: v, obj: p, color: 0x8ea6d8, top: () => p.userData.top() };
      });
      const hist = padsOn(g, HISTORY, SIGN_LABELS.history, grid(4, { at: st.history, z0: 3, dz: 7.2 }));
      const friend = padsOn(g, FRIEND, SIGN_LABELS.friend, grid(4, { at: st.friend, z0: 3, dz: 7.2 }), { maxWidthPx: 460, compact: true, maxLines: 3 });
      const scale = brick({ w: 4, h: 0.5, d: 4, color: 0xd9cdb8 });
      scale.position.set(st.odds.x - 5, 0.5, 7.5);
      g.add(scale);
      isl.entrance = V(st.odds.x, 0, 6.5);
      isl.buddySpot = V(st.odds.x - 5, 0.5, 7.5);
      isl.buddySize = (m) => (m.reality.odds == null ? null : 0.3 + (m.reality.odds / 100) * 1.05);
      const frameFor = (k) => [...islandPts(16, 22, 3, st[k]), V(st[k].x, 6, 7.5)];
      isl.points = frameFor('odds');
      let prev = null;
      let active = null;
      const value = (r, k) => r[k] ?? null;
      const selPad = (r, k) => (k === 'odds' ? find(odds, r.odds) : k === 'history' ? find(hist, r.history) : find(friend, r.friend));
      isl.sync = (m) => {
        const r = m.reality;
        odds.forEach((p) => p.obj.userData.set({ selected: p.id === r.odds }));
        hist.forEach((p) => p.obj.userData.set({ selected: p.id === r.history }));
        friend.forEach((p) => p.obj.userData.set({ selected: p.id === r.friend }));
        // his friend's own words go right on the "Their words" platform
        find(friend, 'own').obj.userData.setLabel(r.friend === 'own' && r.friendText.trim() ? `“${r.friendText.trim()}”` : SIGN_LABELS.friend.own);
        const changed = prev ? ORDER.find((k) => prev[k] !== value(r, k)) : null;
        const open = ORDER.filter((k) => value(r, k) == null);
        const was = active;
        if (changed) {
          const after = open.find((k) => ORDER.indexOf(k) > ORDER.indexOf(changed));
          active = after || changed;
        } else if (!active) {
          active = open[0] || 'friend';
        }
        prev = Object.fromEntries(ORDER.map((k) => [k, value(r, k)]));
        isl.points = frameFor(active);
        if (was && active !== was) {
          isl.reframe();
          revealDock(firstCard[active]);
        }
        if (!changed) {
          const sel = selPad(r, active);
          return sel ? planFor(`st:${active}:${sel.id}`, sel) : { key: `st:${active}`, path: [isl.w(V(st[active].x, 0, 6.5))] };
        }
        const landed = selPad(r, changed);
        const path = landed ? [landed.top()] : [];
        if (active !== changed) path.push(isl.w(V(st[active].x, 0, 6.5)));
        return { key: `chg:${changed}:${value(r, changed)}:${active}`, path, color: landed?.color };
      };
    },

    cope(g, isl) {
      g.add(ground({ w: 24, d: 24 }));
      const pads = padsOn(g, COPE, SIGN_LABELS.cope, grid(6, { cols: 3, dx: 7, dz: 7.4, z0: 3.5 }), { compact: 'always' });
      pads.forEach((p) => {
        // the tool sits beside where he stands
        const prop = gearProp(p.id);
        prop.position.set(-1.05, 0, 0.6);
        prop.scale.setScalar(0.85);
        p.obj.add(prop);
      });
      // the rail of slots on the front edge fills in the order he picks
      const slots = Array.from({ length: 6 }, (_, i) => {
        const s = brick({ w: 2.3, h: 0.5, d: 2.3, color: 0x6f7f95 });
        s.position.set((i - 2.5) * 2.75, 0.5, 9.5);
        g.add(s);
        return { s, item: null };
      });
      isl.entrance = V(0, 0, 7.2);
      isl.buddySpot = V(-9, 0, 7.5);
      isl.points = islandPts(24, 24, 4);
      let prev = null;
      isl.sync = (m) => {
        const picks = m.cope.picks;
        pads.forEach((p) => p.obj.userData.set({ selected: picks.includes(p.id) }));
        slots.forEach((slot, i) => {
          const id = picks[i];
          if (slot.item && slot.item.userData.id !== id) {
            slot.s.remove(slot.item);
            slot.item = null;
          }
          if (id && !slot.item) {
            slot.item = gearProp(id);
            slot.item.userData.id = id;
            slot.item.scale.setScalar(0.8);
            slot.s.add(slot.item);
          }
          glowBrick(slot.s, 0x86c79a, id ? 0.32 : 0);
        });
        let plan = null;
        if (!prev && picks.length) plan = planFor(`cope-start:${picks[picks.length - 1]}`, find(pads, picks[picks.length - 1]));
        if (prev) {
          const id = picks.find((x) => !prev.includes(x)) || prev.find((x) => !picks.includes(x));
          if (id) plan = planFor(`cope:${id}:${picks.join()}`, find(pads, id));
        }
        prev = [...picks];
        return plan;
      };
    },

    act(g, isl) {
      g.add(ground({ w: 24, d: 22 }));
      const pads = padsOn(g, [{ id: 'yes' }, { id: 'no' }], SIGN_LABELS.act, [V(-5, 0, 1), V(5, 0, 1)], {
        colorOf: (opt) => (opt.id === 'yes' ? 0x86c79a : 0x8ea6d8),
      });
      const post = signpost('I’ll do this: …', { color: 0x86c79a });
      post.position.set(-5, 0, -6);
      post.visible = false;
      g.add(post);
      const box = parkingBox();
      box.position.set(5, 0, -6.5);
      g.add(box);
      isl.entrance = V(0, 0, 7.5);
      isl.buddySpot = V(-8.5, 0, 6.5);
      isl.points = [...islandPts(24, 22, 5), V(-5, 5.5, -6)];
      isl.buddyAt = (m) => (m.act.canAct === 'no' ? isl.w(V(5, 0.2, -6.5)) : null);
      let was = null;
      isl.sync = (m) => {
        pads.forEach((p) => p.obj.userData.set({ selected: p.id === m.act.canAct }));
        post.visible = m.act.canAct === 'yes';
        if (post.visible) post.userData.setText(`I’ll do this: ${m.act.text || '…'}`);
        // the "set down" sound only when he chooses No, not on every redraw
        if (was !== null && was !== 'no' && m.act.canAct === 'no') sfx.park();
        was = m.act.canAct;
        const sel = find(pads, m.act.canAct);
        return sel ? planFor(`act:${sel.id}`, sel) : { key: 'start', path: [isl.w(isl.entrance)] };
      };
    },

    sketch(g, isl) {
      g.add(ground({ w: 16, d: 14 }));
      const e = easel();
      e.position.set(2.5, 0, -2);
      g.add(e);
      isl.entrance = V(-1.5, 0, 2);
      isl.buddySpot = V(-6, 0, 2);
      // the world is a thin strip here: frame just the easel and him
      isl.points = [V(-3.5, 0, 2.5), V(4.5, 0, -2), V(-1.5, 4.2, 2), V(2.5, 5.2, -2)];
      isl.sync = () => null;
    },

    next(g, isl) {
      g.add(ground({ w: 26, d: 24, color: 0x9ed69a }));
      const flag = bannerFlag('Today I will: …');
      flag.position.set(0, 0, -7);
      g.add(flag);
      // size (not scale), so the numbers stay big enough to read
      const before = stairTower({ size: 0.6, valuePx: SIGN_PX.hero });
      before.position.set(-8, 0, 7);
      const now = stairTower({ size: 0.6, valuePx: SIGN_PX.hero });
      now.position.set(8, 0, 7);
      g.add(before, now);
      [['Before', before], ['Now', now]].forEach(([t, tw]) => {
        const s = makeSign(t, { maxLines: 1 });
        s.position.set(tw.position.x, 0.3, 9.6);
        g.add(s);
      });
      isl.entrance = V(0, 0, 7.5);
      isl.buddySpot = V(-4, 0, 3);
      isl.points = [...islandPts(26, 24, 8), V(0, 12.5, -7)];
      isl.update = (dt, t, motion) => flag.userData.update(dt, t, motion);
      let prevAfter;
      isl.sync = (m) => {
        const text = m.next.text.trim();
        flag.userData.setText(`Today I will: ${text || '…'}`);
        flag.userData.setColor(text.length >= 2 && m.next.after != null ? 0x86c79a : 0xd9cdb8);
        before.userData.set(m.body.before, moodColor((m.body.before ?? 5) / 10));
        const nowCol = moodColor((m.next.after ?? 5) / 10);
        now.userData.set(m.next.after, nowCol);
        let plan = null;
        // stand on his "now" number: on arrival, and whenever it changes
        if (m.next.after != null && prevAfter !== m.next.after) {
          plan = { key: `now:${m.next.after}`, path: [now.userData.stepTop(m.next.after)], color: nowCol.getHex() };
        }
        prevAfter = m.next.after;
        if (m.status === 'done') flag.userData.flush(`Today I will: ${text}`);
        return plan;
      };
    },
  };

  // ---------- Entering, framing, syncing ----------

  function build(step) {
    const kind = step === 'done' ? 'next' : step;
    const o = originFor(kind);
    const g = new THREE.Group();
    g.position.copy(o);
    root.add(g);
    g.updateMatrixWorld(true);
    game.clearTappables();
    game.clouds.centerOn(o);
    const isl = { step, kind, group: g, w: (v) => v.clone().add(o) };
    isl.reframe = () => frame(isl, false);
    BUILD[kind](g, isl);
    g.updateMatrixWorld(true);
    // the next island, out ahead in the distance, so the course reads as a course
    if (ghost) root.remove(ghost);
    ghost = null;
    const nextStep = STEPS[stepIndex(kind) + 1];
    if (nextStep) {
      ghost = ground({ w: 18, d: 18 });
      ghost.position.copy(originFor(nextStep));
      root.add(ghost);
    }
    return isl;
  }

  function frame(isl, snap) {
    const pts = isl.points.map((p) => isl.w(p));
    const f = game.fit(pts, { yaw: 0, pitch: PITCH });
    game.shot({ target: f.target, dist: f.dist, yaw: 0, pitch: PITCH, snap });
  }

  function moodOf(m, step) {
    const n = step === 'next' || step === 'done' ? m.next.after ?? m.body.before : m.body.before;
    return (n ?? 5) / 10;
  }

  function syncNow(m) {
    if (!current) return;
    const isl = current;
    const plan = isl.sync(m);
    const mood = moodOf(m, isl.step);
    game.sky.setMood(mood);
    buddy.userData.setColor(moodColor(mood));
    buddy.userData.setSize(isl.buddySize?.(m) ?? 0.45 + mood * 0.75);
    if (m.sketch?.beforePng) buddy.userData.setFace(m.sketch.beforePng);
    buddyTarget = (isl.buddyAt?.(m) || isl.w(isl.buddySpot)).clone();
    if (plan) go(plan.path, plan.key, plan.color);
  }

  return {
    update(dt, t, motion) {
      current?.update?.(dt, t, motion);
      tickPads(dt);
      buddy.userData.update(dt, t, motion);
      if (buddyTarget) {
        buddy.position.lerp(buddyTarget, Math.min(1, dt * 2.5));
        buddy.lookAt(avatar.root.position.x, buddy.position.y, avatar.root.position.z);
      }
    },
    // The world strip changed height (typing, sketch, dock sliding): re-frame.
    onView() {
      if (current) frame(current, false);
    },
    dispose() {},
    // Only one world shows at a time (the course or a hub scene).
    hide() {
      root.visible = false;
      buddy.visible = false;
    },
    wake() {
      root.visible = true;
      buddy.visible = true;
    },

    async enter(step, map, newEls) {
      els = newEls;
      game.setViewEls(els.top, els.dock);
      game.attach(els.slot);
      if (map.id !== mapId) this.reset();
      mapId = map.id;
      if (current && current.step === step) {
        syncNow(map);
        return;
      }
      const forward = !current || stepIndex(step) >= stepIndex(current.step);
      if (current && forward && game.motion() === 1) {
        // a quick dash off the island before the cut
        avatar.state.mode = 'run';
        avatar.face(avatar.root.position.clone().add(V(0, 0, -10)));
        sfx.whoosh();
        await game.tweens.wait(0.2);
        avatar.state.mode = 'idle';
      }
      await game.cut(() => {
        const kind = step === 'done' ? 'next' : step;
        const old = islands.get(kind);
        if (old) root.remove(old.group);
        const isl = build(step);
        islands.set(kind, isl);
        current = isl;
        route = [];
        routeKey = null;
        // first sync without moving: stand where the state says
        const plan = isl.sync(map);
        const startAt = plan?.path?.length ? plan.path[plan.path.length - 1] : isl.w(isl.entrance);
        game.place(startAt);
        // three-quarters toward where the camera will be (it sits on the +z side)
        avatar.state.heading = 0.6;
        avatar.root.rotation.y = 0.6;
        routeKey = plan?.key ?? null;
        buddy.position.copy(isl.buddyAt?.(map) || isl.w(isl.buddySpot));
        frame(isl, true);
        syncNow(map);
      }, { out: current ? 180 : 0 });
      if (step === 'done') sfx.checkpoint();
    },

    sync(map) {
      if (current && map.id === mapId) syncNow(map);
    },

    reset() {
      for (const isl of islands.values()) root.remove(isl.group);
      islands.clear();
      if (ghost) root.remove(ghost);
      ghost = null;
      current = null;
      route = [];
      routeKey = null;
      buddyTarget = null;
    },
  };
}
