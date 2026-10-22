// The game engine: one WebGL canvas behind the app, a sky world, the player
// avatar, a camera that eases between "shots", and tap picking. Stages
// (js/game/stages.js) build the world and react to taps; the DOM dock below
// the world carries the words and the real buttons.
import * as THREE from '../vendor/three.module.min.js';
import { createAvatar } from './avatar.js';
import { createTweens, createSky, createClouds, createPuffs, createRings, setSignViewport, rescaleSigns, ease } from './kit.js';
import { sfx } from './audio.js';
import { prefersReduced } from '../mind/index.js';

export function createGame() {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  // near 0.5 (not 0.1): five times the depth precision, so surfaces close
  // together don't flicker when the camera is far away.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
  const sky = createSky(scene);
  const clouds = createClouds(scene);
  scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6b5a48, 1.25));
  const sun = new THREE.DirectionalLight(0xfff3dc, 1.6);
  sun.position.set(12, 30, 18);
  scene.add(sun);

  const tweens = createTweens();
  const puffs = createPuffs(scene);
  const rings = createRings(scene);
  const avatar = createAvatar();
  avatar.root.scale.setScalar(0.72);
  scene.add(avatar.root);

  const motion = () => (prefersReduced() ? 0.2 : 1);

  // ---------- Viewport: the strip of screen the world shows in ----------
  let W = 1;
  let H = 1;
  const view = { top: 0, bottom: 0, topEl: null, bottomEl: null }; // px; bottom = top of the dock
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w !== W || h !== H) {
      W = w;
      H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      setSignViewport(camera.fov, h);
      rescaleSigns(scene);
    }
    if (view.topEl?.isConnected) view.top = view.topEl.getBoundingClientRect().bottom;
    if (view.bottomEl?.isConnected) view.bottom = view.bottomEl.getBoundingClientRect().top;
    const top = view.top || 0;
    const bottom = view.bottom || h;
    camera.setViewOffset(w, h, 0, h / 2 - (top + bottom) / 2, w, h);
    camera.updateProjectionMatrix();
  }

  // ---------- Camera shots ----------
  // A shot looks at `target` from `dist` away at (yaw, pitch). Moving between
  // shots eases smoothly; fit() picks a distance that frames a set of points.
  const cam = { target: new THREE.Vector3(), dist: 18, yaw: 0, pitch: 0.42 };
  const want = { target: new THREE.Vector3(), dist: 18, yaw: 0, pitch: 0.42 };
  let followAvatar = 0; // 0..1 how much the target leans toward the avatar
  function shot({ target, dist, yaw, pitch, snap = false, follow = 0 }) {
    if (target) want.target.copy(target);
    if (dist != null) want.dist = dist;
    if (yaw != null) want.yaw = yaw;
    if (pitch != null) want.pitch = pitch;
    followAvatar = follow;
    if (snap) Object.assign(cam, { dist: want.dist, yaw: want.yaw, pitch: want.pitch }), cam.target.copy(want.target);
  }
  // Aim and distance so that all points fill the world strip (between the
  // header and the dock) with a margin. Iterative: place a probe camera,
  // project the points, correct, repeat. Handles perspective exactly.
  const probe = new THREE.PerspectiveCamera();
  function fit(points, { yaw = want.yaw, pitch = want.pitch, pad = 16, padTop = 30 } = {}) {
    resize();
    const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    let dist = 40;
    const top = (view.top || 0) + padTop;
    const bottom = (view.bottom || H) - pad;
    const left = pad;
    const right = W - pad;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const p = new THREE.Vector3();
    const xAxis = new THREE.Vector3();
    const yAxis = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      probe.copy(camera);
      probe.position.set(
        target.x + dist * Math.cos(pitch) * Math.sin(yaw),
        target.y + dist * Math.sin(pitch),
        target.z + dist * Math.cos(pitch) * Math.cos(yaw),
      );
      probe.lookAt(target);
      probe.updateMatrixWorld();
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const pt of points) {
        p.copy(pt).project(probe);
        const x = (p.x + 1) * 0.5 * W;
        const y = (1 - p.y) * 0.5 * H;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const s = Math.max((maxX - minX) / (right - left), (maxY - minY) / (bottom - top));
      const worldPerPx = (2 * dist * tan) / H;
      probe.matrixWorld.extractBasis(xAxis, yAxis, p);
      target.addScaledVector(xAxis, ((minX + maxX) / 2 - (left + right) / 2) * worldPerPx);
      target.addScaledVector(yAxis, -((minY + maxY) / 2 - (top + bottom) / 2) * worldPerPx);
      dist = Math.max(6, dist * (0.35 + 0.65 * s));
    }
    return { target, dist };
  }
  const tmp = new THREE.Vector3();
  function updateCamera(dt) {
    const k = 1 - Math.exp(-dt * 4.5);
    tmp.copy(want.target);
    if (followAvatar > 0) tmp.lerp(avatar.root.position, followAvatar);
    cam.target.lerp(tmp, k);
    cam.dist += (want.dist - cam.dist) * k;
    cam.yaw += (want.yaw - cam.yaw) * k;
    cam.pitch += (want.pitch - cam.pitch) * k;
    camera.position.set(
      cam.target.x + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
      cam.target.y + cam.dist * Math.sin(cam.pitch),
      cam.target.z + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw),
    );
    camera.lookAt(cam.target);
    // Fog follows the camera distance, so big islands never wash out.
    if (scene.fog) {
      scene.fog.near = cam.dist * 1.15;
      scene.fog.far = cam.dist * 4;
    }
    return Math.abs(want.dist - cam.dist) > 0.01 || cam.target.distanceToSquared(tmp) > 0.0001;
  }

  // ---------- Moving the avatar ----------
  // After landing, turn three-quarters toward the camera so we see his face.
  function faceCamera() {
    const p = avatar.root.position;
    avatar.state.heading = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) + 0.6;
  }

  async function jumpTo(pos, { height = 3, speed = 1, sound = true, color = 0xffffff } = {}) {
    const from = avatar.root.position.clone();
    const to = pos.clone();
    avatar.face(to);
    if (motion() < 1) {
      // Reduced motion: a short hop in place of the arc.
      avatar.root.position.copy(to);
      avatar.setGround(to.y);
      puffs.spawn(to, { color, count: 6, speed: 2, life: 0.35 });
      faceCamera();
      if (sound) sfx.land();
      return;
    }
    avatar.kick(1.3); // crouch
    if (sound) sfx.jump();
    await tweens.wait(0.07);
    avatar.state.mode = 'air';
    const dist = from.distanceTo(to);
    const dur = Math.min(0.85, 0.32 + dist * 0.035) / speed;
    const top = Math.max(from.y, to.y) + height;
    await tweens.run(dur, (k) => {
      avatar.root.position.lerpVectors(from, to, k);
      // parabola through from.y -> top -> to.y
      const a = from.y;
      const c = to.y;
      const b = top;
      avatar.root.position.y = (1 - k) * (1 - k) * a + 2 * (1 - k) * k * (2 * b - (a + c) / 2) + k * k * c;
    }, ease.linear);
    avatar.state.mode = 'idle';
    avatar.setGround(to.y);
    avatar.kick(1.5); // land squash
    puffs.spawn(to.clone().add(new THREE.Vector3(0, 0.1, 0)), { color, count: 6, speed: 2.2, life: 0.35, up: 0.8, size: 0.7 });
    rings.spawn(to, color);
    faceCamera();
    if (sound) sfx.land();
  }

  async function runTo(pos, { speed = 12 } = {}) {
    const from = avatar.root.position.clone();
    const to = pos.clone();
    avatar.face(to);
    const dist = from.distanceTo(to);
    if (dist < 0.05) return;
    if (motion() < 1) {
      avatar.root.position.copy(to);
      avatar.setGround(to.y);
      return;
    }
    avatar.state.mode = 'run';
    await tweens.run(dist / speed, (k) => avatar.root.position.lerpVectors(from, to, k), ease.linear);
    avatar.state.mode = 'idle';
    avatar.setGround(to.y);
  }

  function place(pos, faceTo) {
    avatar.root.position.copy(pos);
    avatar.setGround(pos.y);
    if (faceTo) {
      avatar.face(faceTo);
      avatar.root.rotation.y = avatar.state.heading;
    }
  }

  // ---------- Tapping ----------
  // A tappable is any Object3D with a handler. Taps hit the 3D shape first,
  // then fall back to the nearest tappable within a thumb's reach on screen.
  const tappables = new Map(); // object -> { onTap, anchor }
  const raycaster = new THREE.Raycaster();
  function addTappable(object, onTap, anchor = null, id = null) {
    tappables.set(object, { onTap, anchor, id });
  }
  // Where each tappable sits on screen (tests use this to tap like a thumb).
  function tapTargets() {
    return [...tappables.entries()].map(([o, t]) => {
      const a = typeof t.anchor === 'function' ? t.anchor() : t.anchor;
      return { id: t.id, ...screenOf(a || o.getWorldPosition(new THREE.Vector3())) };
    });
  }
  function clearTappables() {
    tappables.clear();
  }
  function screenOf(v) {
    const p = v.clone().project(camera);
    return { x: (p.x + 1) * 0.5 * W, y: (1 - p.y) * 0.5 * H, behind: p.z > 1 };
  }
  function pick(x, y) {
    const ndc = new THREE.Vector2((x / W) * 2 - 1, -(y / H) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const objs = [...tappables.keys()];
    const hit = raycaster.intersectObjects(objs, true)[0];
    if (hit) {
      let o = hit.object;
      while (o && !tappables.has(o)) o = o.parent;
      if (o) return tappables.get(o);
    }
    let best = null;
    let bestD = 60;
    for (const [o, t] of tappables) {
      const a = typeof t.anchor === 'function' ? t.anchor() : t.anchor;
      const s = screenOf(a || o.getWorldPosition(new THREE.Vector3()));
      if (s.behind) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
  let surface = null;
  function attach(el) {
    if (surface === el) return;
    surface = el;
    if (!el) return;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      activeAt = performance.now();
    });
    el.addEventListener('pointerup', (e) => {
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 12) return;
      const t = pick(e.clientX, e.clientY);
      if (t) t.onTap();
    });
  }

  // ---------- Loop ----------
  let running = false;
  let last = 0;
  let time = 0;
  let stage = null;
  let slowFrames = 0;
  let skip = 0;
  let activeAt = 0;
  const locks = document.getElementsByClassName('lock-screen'); // live
  let lastStripH = 0;
  let stripChangedAt = 0;
  let lastReframe = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt * motion();
    resize();
    tweens.update(dt);
    avatar.update(dt, time, motion());
    puffs.update(dt);
    rings.update(dt);
    // When the world strip changes height (typing, sketch, dock sliding), re-frame.
    const stripH = (view.bottom || H) - (view.top || 0);
    if (Math.abs(stripH - lastStripH) > 3) {
      lastStripH = stripH;
      stripChangedAt = time;
      if (time - lastReframe > 0.1) {
        lastReframe = time;
        stage?.onView?.();
      }
    } else if (stripChangedAt && time - stripChangedAt > 0.3) {
      stripChangedAt = 0;
      stage?.onView?.();
    }
    clouds.update(dt * motion());
    stage?.update?.(dt, time, motion());
    const camMoving = updateCamera(dt);
    // Battery: when nothing is moving, draw every other frame; after 8 quiet
    // seconds, every fourth. Nothing draws under the lock screen.
    const still = !tweens.busy && !camMoving && avatar.state.mode === 'idle' && !stripChangedAt;
    if (!still) activeAt = now;
    const every = !still ? 1 : now - activeAt > 8000 ? 4 : 2;
    skip = (skip + 1) % every;
    if (!skip && !locks.length) renderer.render(scene, camera);
    // Adaptive resolution: drop pixel ratio if frames run long.
    if (dt > 0.034) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 45 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.5);
      renderer.setPixelRatio(dpr);
      W = 0;
      slowFrames = 0;
    }
  }
  function setRunning(on) {
    if (on === running) return;
    running = on;
    canvas.style.display = on ? 'block' : 'none';
    if (on) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }
  document.addEventListener('visibilitychange', () => setRunning(!document.hidden && !!stage));

  return {
    THREE, scene, camera, avatar, tweens, puffs, sky, clouds,
    jumpTo, runTo, place, shot, fit, faceCamera, addTappable, clearTappables, attach, screenOf, tapTargets,
    motion,
    // The world strip on screen, in CSS px.
    strip: () => ({ top: view.top || 0, bottom: view.bottom || H, width: W }),
    setView(top, bottom) {
      view.top = top;
      view.bottom = bottom;
    },
    // The world shows between the bottom of topEl and the top of bottomEl.
    setViewEls(topEl, bottomEl) {
      view.topEl = topEl;
      view.bottomEl = bottomEl;
    },
    // Cross-fade helper: fade the world out, run fn (a cut), fade back in.
    async cut(fn, { out = 180, back = 260 } = {}) {
      if (out > 0) {
        canvas.style.transition = `opacity ${out}ms ease`;
        canvas.style.opacity = '0';
        await new Promise((r) => setTimeout(r, out));
      }
      await fn();
      canvas.style.transition = `opacity ${back}ms ease`;
      canvas.style.opacity = '1';
    },
    canvas,
    // Swap the active stage. The old one tears itself down.
    setStage(next) {
      if (stage && stage !== next) {
        stage.hide?.();
        stage.dispose?.();
      }
      if (next && next !== stage) next.wake?.();
      stage = next;
      setRunning(!!stage && !document.hidden);
    },
    get stage() {
      return stage;
    },
  };
}
