// Building blocks for the game world: tweens, signs, studded bricks, sky,
// clouds and little particle effects. Everything is procedural (no image
// files) and cheap enough for mid-range phones.
import * as THREE from '../vendor/three.module.min.js';

// ---------- Easing + tweens ----------

export const ease = {
  linear: (k) => k,
  out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2,
};

export function createTweens() {
  const list = [];
  return {
    // fn(k) is called with eased progress 0..1. Resolves when done.
    run(duration, fn, easing = ease.inOut) {
      return new Promise((resolve) => {
        if (duration <= 0) {
          fn(1);
          resolve();
          return;
        }
        list.push({ t: 0, duration, fn, easing, resolve });
      });
    },
    wait(seconds) {
      return this.run(seconds, () => {});
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const tw = list[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.duration);
        tw.fn(tw.easing(k));
        if (k >= 1) {
          list.splice(i, 1);
          tw.resolve();
        }
      }
    },
    clear() {
      for (const tw of list.splice(0)) tw.resolve();
    },
    get busy() {
      return list.length > 0;
    },
  };
}

// ---------- Signs (billboards that always face the camera) ----------

const SIGN_FONT = '700 46px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function wrap(g, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Signs are pixel-locked (like a Roblox billboard): their lettering is the
// same size on screen however far the camera is. The engine tells us the
// screen height and field of view; px is the on-screen letter size.
export const SIGN_PX = { pad: 15, small: 13, post: 16, hero: 24 };
let pxScale = 0.002; // sprite scale per screen pixel (sizeAttenuation off)
export function setSignViewport(fovDeg, screenH) {
  pxScale = (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / screenH;
}
// A sign's size on screen in CSS px (parent scale included).
const _ws = new THREE.Vector3();
export function signPx(sprite) {
  sprite.getWorldScale(_ws);
  return { w: _ws.x / pxScale, h: _ws.y / pxScale };
}
// Re-scale every sign under `root` (after a resize).
export function rescaleSigns(root) {
  root.traverse((o) => o.userData.sign?.rescale());
}

// A sign: optional number badge + wrapped text, sized to fit.
export function makeSign(text, { number = null, color = '#7cc3c6', maxWidthPx = 520, maxLines = 3, small = false, px = small ? SIGN_PX.small : SIGN_PX.pad } = {}) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  const fontPx = small ? 40 : 46;
  const rescale = () => {
    const k = (px / fontPx) * pxScale;
    sprite.scale.set(canvas.width * k, canvas.height * k, 1);
  };

  let state = { text, active: false, dim: false };
  function draw() {
    const pad = 26;
    const badge = number != null ? 72 : 0;
    g.font = small ? SIGN_FONT.replace('46px', '40px') : SIGN_FONT;
    const room = maxWidthPx - pad * 2 - (badge ? badge + 18 : 0);
    const lines = wrap(g, state.text, room, maxLines);
    const textW = Math.max(...lines.map((l) => g.measureText(l).width), 0);
    const W = Math.ceil(Math.max(badge ? 120 : 90, pad * 2 + (badge ? badge + (textW ? 18 : 0) : 0) + textW));
    const lh = small ? 50 : 56;
    const H = Math.max(badge + pad * 2 - 16, lines.length * lh + pad * 2 - 12);
    // A texture keeps the size it was first uploaded at; drawing a different
    // size into it squashes the new text and leaves bits of the old. Drop
    // the GPU copy so it's rebuilt at the new size.
    if (canvas.width !== W || canvas.height !== H + 14) tex.dispose();
    canvas.width = W;
    canvas.height = H + 14;
    g.font = small ? SIGN_FONT.replace('46px', '40px') : SIGN_FONT;
    // drop shadow
    g.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(g, 6, 14, W - 12, H - 4, 30);
    g.fill();
    // board
    g.fillStyle = state.active ? color : 'rgba(250,250,247,0.97)';
    roundRect(g, 4, 4, W - 8, H - 4, 30);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = state.active ? '#ffffff' : color;
    g.stroke();
    let x = pad;
    if (badge) {
      g.fillStyle = state.active ? '#ffffff' : color;
      g.beginPath();
      g.arc(pad + badge / 2, H / 2, badge / 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = state.active ? color : '#ffffff';
      g.font = '800 44px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(number), pad + badge / 2, H / 2 + 2);
      x += badge + 18;
    }
    g.font = small ? SIGN_FONT.replace('46px', '40px') : SIGN_FONT;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = state.active ? '#0b1a1f' : '#1c232a';
    const top = H / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, x, top + i * lh + 2));
    tex.needsUpdate = true;
    rescale();
    sprite.material.opacity = state.dim ? 0.55 : 1;
  }
  draw();
  sprite.userData.sign = {
    rescale,
    set(next) {
      const before = JSON.stringify(state);
      state = { ...state, ...next };
      if (JSON.stringify(state) !== before) draw();
    },
  };
  return sprite;
}

// ---------- Studded bricks ----------

const studCache = new Map();
function studTexture(hex) {
  if (studCache.has(hex)) return studCache.get(hex);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const base = new THREE.Color(hex);
  const css = (col) => `#${col.getHexString()}`;
  g.fillStyle = css(base);
  g.fillRect(0, 0, 64, 64);
  // stud: darker ring, lighter top
  g.fillStyle = css(base.clone().offsetHSL(0, 0, -0.1));
  g.beginPath();
  g.arc(33, 34, 19, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(base.clone().offsetHSL(0, 0, 0.06));
  g.beginPath();
  g.arc(31, 31, 17, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.arc(26, 26, 6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  studCache.set(hex, t);
  return t;
}

// A brick with studs on top. Top surface is at y = 0 (so things stand on it).
export function brick({ w = 3, h = 1, d = 3, color = 0x4caf50, studs = true } = {}) {
  const side = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.06) });
  let top = new THREE.MeshLambertMaterial({ color });
  if (studs) {
    const t = studTexture(color).clone();
    t.needsUpdate = true;
    t.repeat.set(w, d);
    top = new THREE.MeshLambertMaterial({ map: t });
  }
  const bottom = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.15) });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, bottom, side, side]);
  mesh.position.y = -h / 2;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.brick = { mesh, materials: [side, top, bottom], w, d, h };
  return g;
}

// Tint a brick (selection glow) by setting emissive on all its materials.
export function glowBrick(group, color, level) {
  for (const m of group.userData.brick.materials) {
    m.emissive.set(color);
    m.emissive.multiplyScalar(level);
  }
}

// ---------- Sky + weather ----------

const SKY = {
  calm: ['#8fd3ff', '#cdeffd', '#fdf6e3'],
  mid: ['#7aa7d9', '#b7cbe3', '#efe3d0'],
  // heaviest is overcast, never dark or stormy
  storm: ['#8f9bb0', '#b9c3d1', '#d8d4cf'],
};

export function createSky(scene) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  scene.fog = new THREE.Fog(0xcdeffd, 70, 260);
  const mix = (a, b, k) => {
    const ca = new THREE.Color(a);
    return `#${ca.lerp(new THREE.Color(b), k).getHexString()}`;
  };
  let last = -1;
  // mood: 0 calm .. 1 storm
  function setMood(m) {
    const q = Math.round(m * 20) / 20;
    if (q === last) return;
    last = q;
    const [a, b] = q < 0.5 ? [SKY.calm, SKY.mid] : [SKY.mid, SKY.storm];
    const k = q < 0.5 ? q * 2 : (q - 0.5) * 2;
    const top = mix(a[0], b[0], k);
    const midC = mix(a[1], b[1], k);
    const bot = mix(a[2], b[2], k);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(0.6, midC);
    grad.addColorStop(1, bot);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    tex.needsUpdate = true;
    scene.fog.color.set(midC);
  }
  setMood(0.4);
  return { setMood };
}

// Puffy low-poly clouds made of boxes.
export function createClouds(scene, count = 9, rng = Math.random) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      const b = new THREE.Mesh(geo, mat);
      b.scale.set(3 + rng() * 4, 1.6 + rng() * 1.6, 2.5 + rng() * 2.5);
      b.position.set(j * 2.6 - n, rng() * 1.2, rng() * 1.5);
      cloud.add(b);
    }
    // Behind and to the sides of the island, below its level, never between
    // the camera and the ground.
    const a = Math.PI * (1.05 + rng() * 0.9);
    const r = 45 + rng() * 70;
    cloud.position.set(Math.cos(a) * r, -16 + rng() * 20, Math.sin(a) * r);
    cloud.userData.speed = 0.08 + rng() * 0.1;
    group.add(cloud);
  }
  scene.add(group);
  return {
    group,
    mat,
    // Keep the clouds around whichever island is in play.
    centerOn(v) {
      group.position.copy(v);
    },
    update(dt) {
      for (const c of group.children) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 110) c.position.x = -110;
      }
    },
  };
}

// ---------- Particles ----------

export function createPuffs(scene) {
  const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const pool = [];
  const live = [];
  function spawn(pos, { color = 0xffffff, count = 8, speed = 3, life = 0.5, up = 1.5, size = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const m = pool.pop() || new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true }));
      m.material.color.set(color);
      m.material.opacity = 0.9;
      m.position.copy(pos);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      m.userData.v = new THREE.Vector3(Math.cos(a) * speed, up * (0.6 + Math.random() * 0.8), Math.sin(a) * speed);
      m.userData.life = life;
      m.userData.age = 0;
      m.userData.size = size;
      m.scale.setScalar(size);
      scene.add(m);
      live.push(m);
    }
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const m = live[i];
      m.userData.age += dt;
      const k = m.userData.age / m.userData.life;
      if (k >= 1) {
        scene.remove(m);
        live.splice(i, 1);
        pool.push(m);
        continue;
      }
      m.position.addScaledVector(m.userData.v, dt);
      m.userData.v.multiplyScalar(1 - dt * 3);
      m.rotation.x += dt * 4;
      m.rotation.y += dt * 3;
      m.scale.setScalar(m.userData.size * (1 - k * 0.6));
      m.material.opacity = 0.9 * (1 - k);
    }
  }
  return { spawn, update };
}

// ---------- Landing ring ----------
// A flat ring that spreads and fades where the avatar lands.
export function createRings(scene) {
  const geo = new THREE.RingGeometry(0.75, 1, 32);
  const live = [];
  return {
    spawn(pos, color = 0xffffff) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(pos).add(new THREE.Vector3(0, 0.08, 0));
      m.userData.age = 0;
      scene.add(m);
      live.push(m);
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i];
        m.userData.age += dt;
        const k = m.userData.age / 0.38;
        if (k >= 1) {
          scene.remove(m);
          m.material.dispose();
          live.splice(i, 1);
          continue;
        }
        m.scale.setScalar(0.8 + k * 1.8);
        m.material.opacity = 0.55 * (1 - k);
      }
    },
  };
}
