// Island props, all procedural boxes. Each returns a THREE.Group whose
// userData holds what the islands need to animate it.
import * as THREE from '../vendor/three.module.min.js';
import { brick, glowBrick, makeSign, SIGN_PX } from './kit.js';
import { createAvatar } from './avatar.js';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
export const hex = (n) => `#${new THREE.Color(n).getHexString()}`;

// Muted option colors (low chroma, readable numbers on top).
export const PAD_COLORS = [0xe39b7b, 0xe8c56f, 0x86c79a, 0x8ea6d8, 0xd99ab8, 0x7ec2bd, 0xb7a3d9];

// ---------- Ground ----------

export function ground({ w = 22, d = 20, color = 0x8fcf86 } = {}) {
  const g = brick({ w, h: 2, d, color });
  // the grass loses depth ties, so flat things lying on it never flicker
  const top = g.userData.brick.materials[1];
  top.polygonOffset = true;
  top.polygonOffsetFactor = 1;
  top.polygonOffsetUnits = 1;
  // a darker dirt band under the grass
  const dirt = box(w - 0.4, 2.4, d - 0.4, lam(0x9b7653));
  dirt.position.y = -2.6;
  g.add(dirt);
  return g;
}

// ---------- Lantern (lights up a chosen pad) ----------

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glow(color = 0xffe39a, size = 2) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

export function lantern() {
  const g = new THREE.Group();
  const post = box(0.18, 1.4, 0.18, lam(0x6b5a48));
  post.position.y = 0.7;
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2c4, emissive: 0xffd36e, emissiveIntensity: 0 });
  const lamp = box(0.55, 0.55, 0.55, lampMat);
  lamp.position.y = 1.65;
  const halo = glow(0xffd36e, 2.4);
  halo.position.y = 1.65;
  halo.material.opacity = 0;
  g.add(post, lamp, halo);
  g.userData.set = (on) => {
    g.visible = on;
    lampMat.emissiveIntensity = on ? 1 : 0;
    halo.material.opacity = on ? 0.75 : 0;
  };
  return g;
}

// ---------- Numbered pad: a platform with its sign floating at the back ----------
// He stands on the front half; the chosen pad's sign rises above his head, so
// the avatar never covers the label he just picked. Pressing a pad makes it
// dip and spring back up.

const livePads = new Set();
// Called every frame by the course: springs and sign heights.
export function tickPads(dt) {
  for (const p of livePads) {
    if (!p.parent) {
      livePads.delete(p);
      continue;
    }
    p.userData.tick(dt);
  }
}

// Pads stand a little proud of the ground: a top face level with the grass
// z-fights (flickers) while the camera moves.
export const PAD_LIFT = 0.3;

// compact: show only the number badge until chosen (busy islands), then the full label.
export function pad({ label, number, color = PAD_COLORS[0], w = 3.6, d = 3.6, h = 0.8, maxWidthPx = 370, signLow = 1.0, signHigh = 2.6, compact = false, maxLines = 2 }) {
  const g = new THREE.Group();
  const b = brick({ w, h, d, color });
  let labelText = label;
  const sign = makeSign(compact ? '' : label, { number, color: hex(color), maxLines, maxWidthPx });
  const SIGN_LOW = signLow;
  const SIGN_HIGH = signHigh;
  sign.position.set(0, SIGN_LOW, -d / 2 - 0.1);
  const lamp = lantern();
  lamp.position.set(w / 2 - 0.35, PAD_LIFT, -d / 2 + 0.35);
  // invisible, generous hit box for thumbs
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 3.5, d + 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 1, 0.2);
  g.add(b, sign, lamp, hit);
  // spring: y offset of the brick, and its velocity
  let y = PAD_LIFT;
  let v = 0;
  let rest = PAD_LIFT;
  let signY = SIGN_LOW;
  let wantSign = SIGN_LOW;
  let wasSelected = false;
  g.userData = {
    hit,
    top: () => g.localToWorld(new THREE.Vector3(0, rest, 0.5)),
    // quiet: hide the label (e.g. pads that no longer matter on a result)
    set({ selected = false, dim = false, lit = selected, quiet = false } = {}) {
      sign.visible = !quiet;
      glowBrick(b, color, selected ? 0.35 : 0);
      const showText = !compact || (compact !== 'always' && (selected || lit));
      sign.userData.sign.set({ active: selected, dim, text: showText ? labelText : '' });
      // the chosen sign draws over its neighbours so it always reads
      sign.material.depthTest = !selected;
      sign.renderOrder = selected ? 20 : 10;
      lamp.userData.set(lit);
      rest = PAD_LIFT + (selected ? 0.12 : 0);
      wantSign = selected && compact !== 'always' ? SIGN_HIGH : SIGN_LOW;
      if (selected && !wasSelected) v = -2.2; // dip, then spring up
      wasSelected = selected;
    },
    setLabel(text) {
      labelText = text;
      if (!compact || (compact !== 'always' && wasSelected)) sign.userData.sign.set({ text });
    },
    tick(dt) {
      v += (-90 * (y - rest) - 11 * v) * dt;
      y += v * dt;
      b.position.y = y;
      signY += (wantSign - signY) * Math.min(1, dt * 9);
      sign.position.y = signY;
    },
  };
  g.userData.set();
  livePads.add(g);
  return g;
}

// ---------- Signpost with live text ----------

export function signpost(text, { color = 0xe8c56f } = {}) {
  const g = new THREE.Group();
  const post = box(0.35, 2.4, 0.35, lam(0x8a6a4a));
  post.position.y = 1.2;
  const sign = makeSign(text, { color: hex(color), maxWidthPx: 560, maxLines: 3, px: SIGN_PX.post });
  sign.position.y = 2.2;
  g.add(post, sign);
  // redraws only when the text actually changes
  g.userData.setText = (t) => sign.userData.sign.set({ text: t });
  return g;
}

// ---------- Doors (Sort it) ----------

export function door({ letter, label, color }) {
  const g = new THREE.Group();
  const frameMat = lam(0xd9cdb8);
  const left = box(0.4, 4.4, 0.6, frameMat);
  left.position.set(-1.5, 2.2, 0);
  const right = left.clone();
  right.position.x = 1.5;
  const top = box(3.4, 0.5, 0.6, frameMat);
  top.position.y = 4.6;
  const hinge = new THREE.Group();
  hinge.position.set(-1.3, 0, 0);
  const panel = box(2.6, 4.2, 0.25, lam(color));
  panel.position.set(1.3, 2.1, 0);
  const knob = box(0.25, 0.25, 0.25, lam(0x6b5a48));
  knob.position.set(2.2, 2.1, 0.2);
  hinge.add(panel, knob);
  const sign = makeSign(label, { number: letter, color: hex(color), maxLines: 2, maxWidthPx: 440 });
  sign.position.set(0, 5.0, 0.2);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 2.5;
  g.add(left, right, top, hinge, sign, hit);
  let open = 0;
  g.userData = {
    hit,
    front: () => g.localToWorld(new THREE.Vector3(0, 0, 2.2)),
    set({ selected = false } = {}) {
      open = selected ? 1 : 0;
      sign.userData.sign.set({ active: selected });
      glowBrick({ userData: { brick: { materials: [panel.material] } } }, color, selected ? 0.25 : 0);
    },
    update(dt) {
      hinge.rotation.y += (-open * 0.85 - hinge.rotation.y) * Math.min(1, dt * 6);
    },
  };
  return g;
}

// ---------- Stair tower (0-10, mirrors the slider) ----------

// Lit steps take a solid color (not a faint glow) and the top lit step
// carries a big "8/10" sign, so the number reads at a glance.
const UNLIT = new THREE.Color(0xb9c4cf);
// size: overall scale (its signs keep their normal size on screen);
// numbers: the 0 and 10 marks; lift: how far the value sign floats above;
// valueWidth: the value sign's wrap width (canvas px); valuePx: its text size.
export function stairTower({ size = 1, numbers = true, lift = 5.6, valueWidth = 420, valuePx = SIGN_PX.post } = {}) {
  const g = new THREE.Group();
  const steps = [];
  const stepY = (i) => 0.5 + i * 0.5;
  for (let i = 0; i <= 10; i++) {
    const s = brick({ w: 2.4, h: stepY(i), d: 2.2, color: 0xffffff });
    s.position.set(0, stepY(i), -i * 2.0);
    g.add(s);
    steps.push(s);
  }
  (numbers ? [0, 10] : []).forEach((n) => {
    const s = makeSign(String(n), { maxLines: 1, small: true, px: SIGN_PX.small / size });
    s.position.set(-1.9, stepY(n) + 0.1, -n * 2.0);
    g.add(s);
  });
  const value = makeSign('–', { maxLines: 2, maxWidthPx: valueWidth, px: valuePx / size, color: '#2e6a6e' });
  value.visible = false;
  g.add(value);
  const paint = (s, c) => s.userData.brick.materials.forEach((m, k) => m.color.copy(c).multiplyScalar(k === 0 ? 0.88 : k === 2 ? 0.75 : 1));
  steps.forEach((s) => paint(s, UNLIT));
  g.userData = {
    steps,
    stepTop: (i) => g.localToWorld(new THREE.Vector3(0, stepY(i), -i * 2.0 + 0.3)),
    // text: optional exact label for the value sign (default "v/10")
    set(v, color, text) {
      const c = new THREE.Color(color);
      steps.forEach((s, i) => paint(s, v != null && i <= v ? c : UNLIT));
      value.visible = v != null;
      if (v != null) {
        value.userData.sign.set({ text: text ?? `${v}/10`, active: true });
        value.position.set(0, stepY(v) + lift, -v * 2.0);
      }
    },
  };
  g.scale.setScalar(size);
  return g;
}

// ---------- The worry creature ----------
// A chunky, slightly goofy block creature. Its face can be his "before" drawing.

function creatureFace(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (img) {
    g.fillStyle = '#FBFAF6';
    g.fillRect(0, 0, 128, 128);
    g.drawImage(img, 0, 0, 128, 128);
  } else {
    g.fillStyle = '#f7f1e8';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2b2b2b';
    g.beginPath();
    g.ellipse(40, 56, 12, 16, 0, 0, Math.PI * 2);
    g.ellipse(88, 56, 12, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(44, 50, 4, 5, 0, 0, Math.PI * 2);
    g.ellipse(92, 50, 4, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2b2b2b';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(52, 92);
    g.quadraticCurveTo(64, 86, 76, 92);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creature() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const bodyMat = lam(0xe39b7b);
  const faceMat = new THREE.MeshLambertMaterial({ map: creatureFace(null) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2), [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat]);
  torso.position.y = 1.5;
  const earL = box(0.5, 0.7, 0.5, bodyMat);
  earL.position.set(-0.7, 2.75, 0);
  const earR = earL.clone();
  earR.position.x = 0.7;
  const footL = box(0.7, 0.5, 0.9, lam(0x6b5a48));
  footL.position.set(-0.55, 0.25, 0.1);
  const footR = footL.clone();
  footR.position.x = 0.55;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  body.add(torso, earL, earR, footL, footR);
  g.add(shadow);
  let size = 0.7;
  let wantSize = 0.7;
  let hopT = 1;
  let faceSrc = null;
  g.userData = {
    setSize(s) {
      wantSize = s;
    },
    setColor(c) {
      bodyMat.color.set(c);
    },
    setFace(dataUrl) {
      if (!dataUrl || dataUrl === faceSrc) return;
      faceSrc = dataUrl;
      const img = new Image();
      img.onload = () => {
        faceMat.map = creatureFace(img);
        faceMat.needsUpdate = true;
      };
      img.src = dataUrl;
    },
    // A small hop when he picks something.
    hop() {
      hopT = 0;
    },
    update(dt, t, motion) {
      size += (wantSize - size) * Math.min(1, dt * 4);
      g.scale.setScalar(size);
      hopT = Math.min(1, hopT + dt * 2.8);
      const hop = Math.sin(hopT * Math.PI) * 0.6 * motion;
      body.position.y = Math.abs(Math.sin(t * 2.5)) * 0.08 * motion + hop;
    },
  };
  return g;
}

// ---------- Big figure for the body check ----------

export function bigFigure() {
  const g = new THREE.Group();
  const plinth = brick({ w: 4, h: 1.2, d: 3, color: 0xd9cdb8 });
  plinth.position.y = 1.2;
  const fig = createAvatar({ shirt: 0xcfd6dc, pants: 0xaab4bd });
  fig.root.position.y = 1.2;
  fig.root.scale.setScalar(0.95);
  g.add(plinth, fig.root);
  g.userData = { fig };
  return g;
}

// ---------- Gear bench props (coping tools) ----------

export function gearProp(kind) {
  const g = new THREE.Group();
  const add = (m, x, y, z) => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  switch (kind) {
    case 'teacher': // a book
      add(box(1.3, 0.35, 1.0, lam(0x8ea6d8)), 0, 0.3, 0);
      add(box(1.2, 0.28, 0.9, lam(0xfaf6ec)), 0.05, 0.3, 0);
      break;
    case 'text': // a phone
      add(box(0.75, 1.3, 0.14, lam(0x2f3a45)), 0, 0.8, 0);
      add(box(0.62, 1.05, 0.02, new THREE.MeshLambertMaterial({ color: 0x9fd8ff, emissive: 0x5fa8d8, emissiveIntensity: 0.5 })), 0, 0.82, 0.08);
      break;
    case 'breathe': // a little cloud
      [-0.45, 0, 0.45].forEach((x, i) => add(box(0.7, 0.55 + (i === 1 ? 0.2 : 0), 0.6, lam(0xffffff)), x, 0.9 + (i === 1 ? 0.1 : 0), 0));
      break;
    case 'nurse': // first-aid box
      add(box(1.1, 0.8, 0.8, lam(0xffffff)), 0, 0.5, 0);
      add(box(0.6, 0.16, 0.02, lam(0xd9534f)), 0, 0.55, 0.41);
      add(box(0.16, 0.6, 0.02, lam(0xd9534f)), 0, 0.55, 0.41);
      break;
    case 'ride': // a wave
      [0, 1, 2, 3].forEach((i) => add(box(0.35, 0.3 + Math.sin(i * 1.1) * 0.3 + 0.3, 0.6, lam(0x7ec2bd)), -0.55 + i * 0.37, 0.5, 0));
      break;
    default: // own plan: notebook + pencil
      add(box(1.0, 0.18, 1.3, lam(0xe8c56f)), 0, 0.25, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), lam(0xd98e4a)), 0.2, 0.45, 0).rotation.z = Math.PI / 2;
  }
  return g;
}

// ---------- Parking box (Park it) ----------

export function parkingBox({ letter = true } = {}) {
  const g = new THREE.Group();
  const m = lam(0xc9a97a);
  const floor = box(3.2, 0.2, 3.2, m);
  floor.position.y = 0.1;
  const walls = [
    [0, 0.8, 1.5, 3.2, 1.4, 0.2],
    [0, 0.8, -1.5, 3.2, 1.4, 0.2],
    [1.5, 0.8, 0, 0.2, 1.4, 3.2],
    [-1.5, 0.8, 0, 0.2, 1.4, 3.2],
  ].map(([x, y, z, w, h, d]) => {
    const b = box(w, h, d, m);
    b.position.set(x, y, z);
    return b;
  });
  const post = box(0.25, 3, 0.25, lam(0x8a6a4a));
  post.position.set(-1.9, 1.5, 1.6);
  g.add(floor, ...walls, post);
  if (letter) {
    const p = makeSign('P', { maxLines: 1, color: '#8ea6d8' });
    p.position.set(-1.9, 3.0, 1.6);
    g.add(p);
  }
  return g;
}

// ---------- Flag with a banner (finish) ----------

export function bannerFlag(text) {
  const g = new THREE.Group();
  const base = brick({ w: 2.6, h: 0.6, d: 2.6, color: 0xd9cdb8 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 10), lam(0xe6ecf1));
  pole.position.y = 3;
  const clothGeo = new THREE.PlaneGeometry(2.4, 1.4, 12, 4);
  const clothMat = new THREE.MeshLambertMaterial({ color: 0x86c79a, side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.set(1.3, 5.2, 0);
  const basePos = clothGeo.attributes.position.array.slice();
  const banner = makeSign(text, { maxWidthPx: 600, maxLines: 3, color: '#86c79a', px: SIGN_PX.post });
  banner.position.set(0, 9.2, 0);
  g.add(base, pole, cloth, banner);
  g.userData = {
    setText(t) {
      banner.userData.sign.set({ text: t });
    },
    flush(t) {
      banner.userData.sign.set({ text: t });
    },
    update(dt, t, motion) {
      const pos = clothGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = basePos[i * 3];
        pos.setZ(i, Math.sin(t * 2.4 + x * 2.5) * (x + 1.2) * 0.12 * motion);
      }
      pos.needsUpdate = true;
    },
    setColor(c) {
      clothMat.color.set(c);
    },
  };
  return g;
}

// ---------- Easel (sketch) ----------

export function easel() {
  const g = new THREE.Group();
  const wood = lam(0xa57c52);
  [-0.8, 0.8].forEach((x) => {
    const leg = box(0.18, 4, 0.18, wood);
    leg.position.set(x, 2, 0);
    leg.rotation.z = x > 0 ? -0.12 : 0.12;
    g.add(leg);
  });
  const board = box(2.6, 2.2, 0.15, lam(0xfbfaf6));
  board.position.set(0, 2.8, 0.15);
  g.add(board);
  return g;
}

// ---------- Footprint marker (a pad he already stood on) ----------

export function footprint() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x3a2f25, transparent: true, opacity: 0.35, depthWrite: false });
  [-0.35, 0.35].forEach((x, i) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.8), m);
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, 0.02, i ? -0.3 : 0.2);
    g.add(f);
  });
  return g;
}
