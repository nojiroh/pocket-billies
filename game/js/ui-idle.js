'use strict';
/* ================= UI-17: IDLE LIFE, KEPT TO TWO =================
   The loops that run with no cause (docs/phases/ui-track.md Part 2, rule 5): slow, small and at most two kinds on
   screen. Every 600 ms (and at once when Animation or Flashes change) this looks at which kinds of idle loop the
   screen shows (logic/idle-life.js IDLE_KINDS), keeps the first two and writes them on <html data-idle>; motion.css
   stops the rest, and a kit part's loop reads its keyframes' name from --idle-<kind>. It also writes --sheen-a, the
   glint's and the foil's strength (SY-1's flash rule: softer with Flashes off). Calm and Reduced keep none. The map's
   canvas asks idleOn('map'). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { IDLE_KINDS, idlePick, sheenAlpha } from './logic/idle-life.js';
import { motionNow } from './ui-kit.js';
/* eslint-disable no-func-assign */
expose({
  idleLife: [() => idleLife],
  idleOn: [() => idleOn],
  idlePresent: [() => idlePresent, v => (idlePresent = v)],
  idleScan: [() => idleScan, v => (idleScan = v)],
  idleStart: [() => idleStart, v => (idleStart = v)],
  shows: [() => shows, v => (shows = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const idleLife = { on: /** @type {string[]} */ ([]), timer: 0 };

/** whether an idle kind plays now (the map's canvas asks for 'map') @param {string} k */
const idleOn = k => idleLife.on.includes(k);

/** whether an element shows: in the page, drawn, not hidden @param {Element} el */
function shows(el) {
  const e = /** @type {any} */ (el);
  if (typeof e.checkVisibility === 'function') return e.checkVisibility({ visibilityProperty: true });
  return !!(/** @type {HTMLElement} */ (el).offsetParent);
}

/** the idle kinds on screen now */
function idlePresent() {
  return IDLE_KINDS.filter(K => [...document.querySelectorAll(K.sel)].some(shows)).map(K => K.k);
}

function idleScan() {
  const root = document.documentElement,
    level = motionNow(),
    on = document.hidden ? [] : idlePick(idlePresent(), level),
    want = on.join(' ');
  idleLife.on = on;
  if ((root.dataset.idle || '') !== want) root.dataset.idle = want;
  const a = String(sheenAlpha(level, root.dataset.flash === 'off'));
  if (root.style.getPropertyValue('--sheen-a') !== a) root.style.setProperty('--sheen-a', a);
}

function idleStart() {
  idleScan();
  clearInterval(idleLife.timer);
  idleLife.timer = setInterval(idleScan, 600);
  document.addEventListener('visibilitychange', idleScan);
  /* Settings' Animation and Flashes rows write these on <html>: answer at once */
  new MutationObserver(idleScan).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion', 'data-flash'],
  });
}
if (typeof document !== 'undefined') idleStart();
