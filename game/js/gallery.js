'use strict';
/* ================= GRAPHICS GALLERY (alpha 0.5) =================
   Settings → Graphics → Expert → "See it" takes you to a small place built to show each dial (made by tools/build-gallery.py, now on the legacy branch):
   you stand at the station for that dial, and a panel over the scene holds the dial itself, so you can switch it and
   watch what changes. Day and night swap at a tap (lamps need the dark). "Leave" brings you back to your settings. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, openSettings, provide, render, renderOverlay, toast } from './hooks.js';
import { uiState } from './game-state.js';
import { GFX_DIALS, gfxDial } from './settings-screen.js';
import { mapById, walkView } from './walk-view.js';
import { environment } from './environment.js';
/* eslint-disable no-func-assign */
expose({
  GAL: [() => GAL],
  GALLERY_AT: [() => GALLERY_AT],
  galleryClose: [() => galleryClose, v => (galleryClose = v)],
  galleryOpen: [() => galleryOpen, v => ((galleryOpen = v), provide({ galleryOpen }))],
  galleryPanel: [() => galleryPanel, v => (galleryPanel = v)],
});
/* eslint-enable no-func-assign */
provide({ galleryOpen });
/* to-module: end */
const GALLERY_AT = {
  'shadows.strength': 'grove',
  'shadows.selfShade': 'grove',
  'sun.shafts': 'grove',
  'air.godRays': 'grove',
  'lights.brightness': 'cottage',
  'color.bloom': 'cottage',
  'water.reflection': 'pond',
  'grass.density': 'meadow',
  'air.particles': 'meadow',
  'sun.clouds': 'sky',
  'sun.cloudShadows': 'sky',
  'air.mist': 'sky',
  'lens.blur': 'view',
  'world.farProps': 'view',
  'lens.vignette': 'view',
  'lens.grain': 'view',
  'quality.resolution': 'view',
};
const GAL = { on: false, key: null, night: false };
function galleryOpen(gk) {
  const sc = mapById && mapById('gallery');
  if (!sc) {
    toast('The Graphics gallery isn’t in this build.');
    return;
  }
  GAL.on = true;
  GAL.key = gk;
  GAL.night = gk === 'lights.brightness' || gk === 'color.bloom';
  closeModal();
  uiState.modal = null;
  uiState.mq = [];
  renderOverlay();
  if (typeof environment !== 'undefined')
    environment.force = GAL.night
      ? { time: 22, weather: 'clear', season: 'summer' }
      : { time: 15, weather: 'clear', season: 'summer' };
  uiState.bench = { id: 'gallery', test: 1 };
  uiState.tab = 'walk';
  render();
  const st = (sc.stations || {})[GALLERY_AT[gk] || 'grove'] || sc.hub,
    t0 = performance.now();
  const place = () => {
    if (!GAL.on) return;
    if (
      typeof walkView !== 'undefined' &&
      walkView.ready &&
      (walkView.id === 'gallery' || (walkView.sc && walkView.sc.baseId === 'gallery'))
    ) {
      const o = (walkView.sc && walkView.sc.baseOff) || [0, 0];
      walkView.pl.x = st[0] + o[0];
      walkView.pl.z = st[1] + o[1];
      walkView.pl.route = null;
      walkView.pl.fresh = false;
      galleryPanel();
      return;
    }
    if (performance.now() - t0 < 20000) setTimeout(place, 150);
  };
  place();
}
function galleryPanel() {
  let el = document.getElementById('gfxPanel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gfxPanel';
    el.className = 'px glass gfx-panel';
    document.body.appendChild(el);
  }
  const D = GFX_DIALS.flatMap(x => x[1]).find(d => d[0] === GAL.key);
  if (!D) {
    el.remove();
    return;
  }
  const near = GFX_DIALS.flatMap(x => x[1]).filter(d => GALLERY_AT[d[0]] === GALLERY_AT[GAL.key]);
  el.innerHTML = `<div class="gfx-ph"><b>Graphics gallery</b><button type="button" class="pb small quiet" data-a="gal-night">${GAL.night ? 'Day' : 'Night'}</button><button type="button" class="pb small" data-a="gal-leave">Leave</button></div>
  ${near.length > 1 ? `<div class="gfx-near">${near.map(d => `<button type="button" data-a="gal-pick" data-k="${d[0]}" aria-pressed="${d[0] === GAL.key}">${d[1]}</button>`).join('')}</div>` : ''}${gfxDial(D).replace(/<button type="button" class="gfx-see"[^>]*>See it<\/button>/, '')}`;
}
function galleryClose() {
  GAL.on = false;
  const el = document.getElementById('gfxPanel');
  if (el) el.remove();
  if (typeof environment !== 'undefined') environment.force = null;
  uiState.bench = null;
  render();
  uiState.setTab = 'graphics';
  openSettings();
}
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="gal-"]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'gal-leave') galleryClose();
  else if (a === 'gal-night') {
    GAL.night = !GAL.night;
    if (typeof environment !== 'undefined')
      environment.force = { time: GAL.night ? 22 : 15, weather: 'clear', season: 'summer' };
    galleryPanel();
  } else if (a === 'gal-pick') {
    GAL.key = el.dataset.k;
    galleryPanel();
  }
});
/* the dial in the panel works like the one in Settings (settings-screen.js listens for data-eng); keep the panel's value fresh */
document.addEventListener('change', ev => {
  if (GAL.on && ev.target.dataset && ev.target.dataset.eng) setTimeout(galleryPanel, 0);
});
