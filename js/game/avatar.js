// The player: a blocky R6-style avatar with jointed shoulders and hips, so it
// can idle, run and jump with a bit of squash and stretch. Units are "studs":
// the avatar stands about 5.4 tall with its feet at y = 0, facing +Z.
import * as THREE from '../vendor/three.module.min.js';

const SKIN = 0xf2d16b;
const SHIRT = 0x3d7fd9;
const PANTS = 0x2f4f6f;

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#F2D16B';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#26221d';
  // eyes
  g.beginPath();
  g.ellipse(44, 54, 8, 12, 0, 0, Math.PI * 2);
  g.ellipse(84, 54, 8, 12, 0, 0, Math.PI * 2);
  g.fill();
  // small calm mouth
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.strokeStyle = '#26221d';
  g.beginPath();
  g.arc(64, 78, 16, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const mat = (color) => new THREE.MeshLambertMaterial({ color, emissive: 0x000000 });

export function createAvatar({ shirt = SHIRT, pants = PANTS } = {}) {
  const root = new THREE.Group(); // position = feet on the ground
  const body = new THREE.Group(); // squash & stretch + bob
  root.add(body);
  const parts = {};
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // Legs (pivot at hips)
  const legs = [-0.5, 0.5].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2, 0);
    const leg = box(0.98, 2, 1, mat(pants));
    leg.position.y = -1;
    pivot.add(leg);
    body.add(pivot);
    return pivot;
  });

  // Torso, split so chest and stomach can glow separately
  const shirtMat = () => mat(shirt);
  const stomach = box(2, 0.95, 1, shirtMat());
  stomach.position.y = 2.475;
  const chest = box(2, 1.05, 1, shirtMat());
  chest.position.y = 3.475;
  body.add(stomach, chest);

  // Neck (throat) and head
  const throat = box(0.6, 0.25, 0.6, mat(SKIN));
  throat.position.y = 4.12;
  const headMat = mat(SKIN);
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(), emissive: 0x000000 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), [headMat, headMat, headMat, headMat, faceMat, headMat]);
  head.position.y = 4.85;
  body.add(throat, head);

  // Arms (pivot at shoulders) with hands
  const hands = [];
  const arms = [-1.5, 1.5].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 4, 0);
    const arm = box(0.98, 1.5, 1, shirtMat());
    arm.position.y = -0.75;
    const hand = box(0.98, 0.5, 1, mat(SKIN));
    hand.position.y = -1.75;
    pivot.add(arm, hand);
    hands.push(hand);
    body.add(pivot);
    return pivot;
  });

  parts.head = [head];
  parts.throat = [throat];
  parts.chest = [chest];
  parts.stomach = [stomach];
  parts.hands = hands;

  // Soft round shadow under the feet (no shadow maps: cheap on phones)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const state = {
    mode: 'idle', // idle | run | air
    phase: 0,
    squash: 0, // >0 squashed, <0 stretched
    squashV: 0,
    heading: 0,
    groundY: 0,
  };

  // Body-check glow: level 0..1 per part
  function setHeat(name, level, color) {
    for (const p of parts[name] || []) {
      const mats = Array.isArray(p.material) ? p.material : [p.material];
      for (const m of mats) {
        m.emissive.set(color);
        m.emissive.multiplyScalar(level * 0.9);
      }
    }
  }

  function partCenter(name, target = new THREE.Vector3()) {
    const list = parts[name] || [];
    target.set(0, 0, 0);
    for (const p of list) target.add(p.getWorldPosition(new THREE.Vector3()));
    return list.length ? target.divideScalar(list.length) : target;
  }

  function kick(amount) {
    state.squashV += amount;
  }

  // Called every frame with real dt and a motion factor (0.2 when reducing motion).
  function update(dt, t, motion = 1) {
    // squash spring
    const k = 220;
    const damp = 16;
    state.squashV += (-k * state.squash - damp * state.squashV) * dt;
    state.squash += state.squashV * dt;
    const s = THREE.MathUtils.clamp(state.squash, -0.35, 0.35);
    body.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);

    if (state.mode === 'run') {
      state.phase += dt * 11;
      const sw = Math.sin(state.phase) * 0.9 * motion;
      legs[0].rotation.x = sw;
      legs[1].rotation.x = -sw;
      arms[0].rotation.x = -sw * 0.9;
      arms[1].rotation.x = sw * 0.9;
      arms[0].rotation.z = 0;
      arms[1].rotation.z = 0;
      body.position.y = Math.abs(Math.sin(state.phase)) * 0.22 * motion;
    } else if (state.mode === 'air') {
      legs[0].rotation.x = THREE.MathUtils.lerp(legs[0].rotation.x, -0.5, dt * 12);
      legs[1].rotation.x = THREE.MathUtils.lerp(legs[1].rotation.x, 0.35, dt * 12);
      arms[0].rotation.x = THREE.MathUtils.lerp(arms[0].rotation.x, -2.6, dt * 14);
      arms[1].rotation.x = THREE.MathUtils.lerp(arms[1].rotation.x, -2.6, dt * 14);
      body.position.y = 0;
    } else if (state.mode === 'sit') {
      // sitting on a bench: legs forward, hands resting
      for (const l of legs) l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, -1.5, dt * 8);
      for (const a of arms) a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, -0.35, dt * 8);
      arms[0].rotation.z = -0.06;
      arms[1].rotation.z = 0.06;
      body.position.y = THREE.MathUtils.lerp(body.position.y, -1.55, dt * 8);
    } else {
      // idle: settle limbs, slow breathing
      for (const p of [...legs, ...arms]) p.rotation.x = THREE.MathUtils.lerp(p.rotation.x, 0, dt * 10);
      const breathe = Math.sin(t * 2.2) * 0.04 * motion;
      arms[0].rotation.z = -0.06 - breathe;
      arms[1].rotation.z = 0.06 + breathe;
      body.position.y = breathe * 0.5;
    }

    // ease toward heading
    const d = ((state.heading - root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    root.rotation.y += d * Math.min(1, dt * 12);

    // shadow stays on the ground and shrinks with height
    const h = Math.max(0, root.position.y - state.groundY);
    shadow.position.y = -h + 0.02;
    const sc = Math.max(0.35, 1 - h / 9);
    shadow.scale.setScalar(sc);
    shadow.material.opacity = 0.22 * sc;
  }

  // Face a world point.
  function face(point) {
    state.heading = Math.atan2(point.x - root.position.x, point.z - root.position.z);
  }

  // His look: shirt and pants colors and a hat (none | cap | beanie | headphones).
  const shirtMats = [chest.material, stomach.material, ...arms.map((a) => a.children[0].material)];
  const pantsMats = legs.map((l) => l.children[0].material);
  let hat = null;
  function setStyle({ shirt: s, pants: p, hat: kind = 'none' } = {}) {
    if (s != null) shirtMats.forEach((m) => m.color.set(s));
    if (p != null) pantsMats.forEach((m) => m.color.set(p));
    if (hat) body.remove(hat);
    hat = makeHat(kind, s ?? SHIRT);
    if (hat) body.add(hat);
  }

  return { root, parts, state, update, setHeat, partCenter, kick, face, setStyle, setGround: (y) => (state.groundY = y) };
}

function makeHat(kind, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.08) });
  const add = (w, h, d, x, y, z, mat = m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z);
    g.add(b);
  };
  if (kind === 'cap') {
    add(1.36, 0.4, 1.36, 0, 5.62, 0);
    add(1.2, 0.12, 0.7, 0, 5.46, 0.9);
  } else if (kind === 'beanie') {
    add(1.38, 0.62, 1.38, 0, 5.62, 0);
    add(1.42, 0.2, 1.42, 0, 5.36, 0, new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, 0.12) }));
    add(0.3, 0.3, 0.3, 0, 6.05, 0);
  } else if (kind === 'headphones') {
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b3440 });
    add(1.5, 0.16, 0.3, 0, 5.58, 0, dark);
    add(0.2, 0.55, 0.62, -0.74, 4.9, 0, m);
    add(0.2, 0.55, 0.62, 0.74, 4.9, 0, m);
  } else {
    return null;
  }
  return g;
}
