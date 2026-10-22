// Is the 3D game on? 3D unless Calm (2D) is chosen, the device can't do WebGL,
// or the game failed to start. "Reduce motion" keeps 3D but makes it nearly
// still (handled in the game engine and CSS).
import { state } from '../store.js';
import { nav } from '../nav.js';

let webgl = null;
let loadError = null;

function hasWebGL() {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

// Less motion? The Motion setting wins; 'auto' follows the device's
// reduce-motion setting.
export function prefersReduced() {
  const pref = state.settings.motion || 'auto';
  if (pref === 'full') return false;
  if (pref === 'less') return true;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// reason: 'calm' | 'webgl' | 'error'
export function mindStatus() {
  if ((state.settings.visuals || 'auto') === 'calm') return { on: false, reason: 'calm' };
  if (loadError) return { on: false, reason: 'error', error: loadError };
  if (!hasWebGL()) return { on: false, reason: 'webgl' };
  return { on: true, reduced: prefersReduced() };
}

export const mindEnabled = () => mindStatus().on;

// One line explaining the current state, for Settings and fallbacks.
export function mindStatusText() {
  const s = mindStatus();
  if (s.on) {
    if (!s.reduced) return 'On.';
    return (state.settings.motion || 'auto') === 'less' ? 'On, with less motion.' : 'On, with less motion, because this device asks for reduced motion. Set Motion to Full to change that.';
  }
  if (s.reason === 'calm') return 'Off. Showing the calm, flat version.';
  if (s.reason === 'webgl') return '3D isn’t available on this device (no WebGL), so it shows the calm version.';
  return `3D couldn’t start (${s.error}), so it shows the calm version.`;
}

// The game reports a failed start here; the app then shows 2D and says why.
export function markMindFailed(err) {
  console.error('3D could not start:', err);
  loadError = String(err?.message || err);
  window.__mindError = String(err?.stack || err);
  document.body.classList.remove('game-on');
  nav.render();
}

export const mind = {
  enabled: mindEnabled,
  status: mindStatus,
  statusText: mindStatusText,
};
