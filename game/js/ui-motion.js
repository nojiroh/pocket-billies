'use strict';
/* ================= UI-16a: THE FEEDBACK MOTIONS, WIRED =================
   What makes the screens answer you (docs/phases/ui-track.md "Alive, without clutter"): a press squashes and springs
   back; a press on a disabled control nudges it (sound.js's own listener plays the can't buzz); the selection bar slides
   to its new tab or segment; rows come in one after another on a new screen or sheet; pick cards come face down and
   turn over; gains fly to where they go and the target bumps. The kit's pb-sound requests play through sound.js's
   uiSound (music.json ui), which this file leaves as it is. Transform and opacity only; Reduced keeps fades; Calm keeps
   all of this (it is feedback, not idle motion). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { uiIconURL, uiSound } from './hooks.js';
import { pbFlyTo, pbNudge, pbSlideBar, pbSound, reduced } from './ui-kit.js';
/* eslint-disable no-func-assign */
expose({
  ENTER_ROWS: [() => ENTER_ROWS],
  PRESS_SEL: [() => PRESS_SEL],
  SEL_GROUP: [() => SEL_GROUP],
  SEL_ON: [() => SEL_ON],
  flipSeen: [() => flipSeen],
  gainTarget: [() => gainTarget, v => (gainTarget = v)],
  isDisabled: [() => isDisabled, v => (isDisabled = v)],
  lastPress: [() => lastPress],
  pbEnterRows: [() => pbEnterRows, v => (pbEnterRows = v)],
  pbFlipFresh: [() => pbFlipFresh, v => (pbFlipFresh = v)],
  pbFlipIn: [() => pbFlipIn, v => (pbFlipIn = v)],
  pbGainFly: [() => pbGainFly, v => (pbGainFly = v)],
  pressMs: [() => pressMs],
  pressRelease: [() => pressRelease, v => (pressRelease = v)],
  pressScale: [() => pressScale, v => (pressScale = v)],
  pressTarget: [() => pressTarget, v => (pressTarget = v)],
  pressed: [() => pressed, v => (pressed = v)],
  sameControl: [() => sameControl, v => (sameControl = v)],
  soundAt: [() => soundAt],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- press: squash on the way down, a spring on the way back (--m-press, 80-120 ms) ---------- */
/* the controls; the classes are the ones whose CSS :active squash this replaced (some aren't buttons) */
const PRESS_SEL =
  'button, [role="button"], [role="tab"], [role="radio"], a[href], .k-card, .bag-row, .pickrow, .mon, .bx, .ccard, ' +
  '.pick, .option, .fchip, .qb, .pc-thumb, .gfx-pre, .tb-me, .ttl-cont, .pk-arrow, .ware';
/** the control a pointer is on: a kit part's host when the press is inside its shadow root @param {Event} ev */
function pressTarget(ev) {
  const path = ev.composedPath ? ev.composedPath() : [ev.target];
  for (const el of path) {
    if (!(el instanceof Element) || !el.matches(PRESS_SEL)) continue;
    const root = el.getRootNode();
    return root instanceof ShadowRoot && root.host.localName.startsWith('pb-') ? root.host : el;
  }
  return null;
}
/** how far a control squashes: a small button more, a big card less (about 8 px of give either way) */
function pressScale(/** @type {Element} */ el) {
  const r = el.getBoundingClientRect(),
    s = Math.min(0.985, Math.max(0.94, 1 - 8 / Math.max(r.width, r.height, 1)));
  return { x: +(1 - (1 - s) * 0.6).toFixed(3), y: +s.toFixed(3) };
}
const pressMs = () => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--m-press'));
  return Number.isFinite(v) ? v : 100;
};
let pressed = /** @type {{ el: Element, k: { x: number, y: number }, a: Animation } | null} */ (null);
/** where the last press was, for a gain that comes of it (coins fly from there to Moneys) */
const lastPress = { rect: /** @type {DOMRect | null} */ (null), at: 0 };
function isDisabled(/** @type {Element} */ el) {
  const e = /** @type {any} */ (el);
  return !!(e.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'));
}
document.addEventListener(
  'pointerdown',
  ev => {
    if (ev.button > 0) return;
    const el = pressTarget(ev);
    if (!el) return;
    /* the inner button of a kit part is what is disabled */
    const inner = /** @type {Element} */ (ev.composedPath()[0]);
    if (isDisabled(el) || (inner instanceof Element && inner.closest('button:disabled'))) {
      pbNudge(el);
      return;
    }
    lastPress.rect = el.getBoundingClientRect();
    lastPress.at = performance.now();
    if (reduced() || !(/** @type {any} */ (el).animate)) return;
    pressRelease();
    const k = pressScale(el);
    pressed = {
      el,
      k,
      a: el.animate([{ scale: '1 1' }, { scale: `${k.x} ${k.y}` }], {
        duration: pressMs(),
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'forwards',
      }),
    };
  },
  true
);
function pressRelease() {
  if (!pressed) return;
  const { el, k, a } = pressed;
  pressed = null;
  a.cancel();
  if (el.isConnected)
    el.animate([{ scale: `${k.x} ${k.y}` }, { scale: '1 1' }], {
      duration: pressMs() * 1.2,
      easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
    });
}
for (const t of ['pointerup', 'pointercancel', 'dragstart']) document.addEventListener(t, pressRelease, true);

/* ---------- the selection bar slides to its new tab or segment ---------- */
const SEL_GROUP = '[role="tablist"], [role="radiogroup"], .seg',
  SEL_ON = '[aria-selected="true"], [aria-checked="true"], [aria-current="page"], [aria-current="true"], .on';
/** a selector that finds the same control again after the screen is drawn anew (its data-* attributes) */
function sameControl(/** @type {Element} */ el) {
  const a = [...el.attributes].filter(x => x.name.startsWith('data-'));
  return a.length ? el.localName + a.map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('') : '';
}
document.addEventListener(
  'click',
  ev => {
    const t = /** @type {Element} */ (ev.target),
      c = t instanceof Element ? t.closest('[role="tab"], [role="radio"], .seg > button') : null,
      g = c && c.parentElement && c.parentElement.closest(SEL_GROUP);
    if (!c || !g) return;
    const was = [...g.querySelectorAll(':scope > *')].find(x => x.matches(SEL_ON));
    if (!was || was === c) return;
    const from = was.getBoundingClientRect(),
      sel = sameControl(c);
    requestAnimationFrame(() => {
      const now = c.isConnected ? c : sel ? document.querySelector(sel) : null;
      if (now && now.matches(SEL_ON)) pbSlideBar(from, now.getBoundingClientRect());
    });
  },
  true
);

/* ---------- sounds the kit asks for (pb-sound), played as the buttons' are ---------- */
const soundAt = /** @type {Record<string, number>} */ ({});
document.addEventListener('pb-sound', ev => {
  const k = /** @type {CustomEvent} */ (ev).detail && /** @type {CustomEvent} */ (ev).detail.k,
    now = performance.now();
  /* a few chips ending their counts together ping once */
  if (!k || now - (soundAt[k] || -1e9) < 120) return;
  soundAt[k] = now;
  if (typeof uiSound === 'function') uiSound(k);
});

/* ---------- enter: rows come in one after another (--stagger; past the 4th they come together) ---------- */
const ENTER_ROWS =
  '.list > *, .bag-row, .lrow, .pickrow, .set-row, .u-row, .ranch-card, .inbox-list > *, pb-pick-card, .qrow, .tpanel';
/** marks a new screen's or sheet's rows to come in (motion.css m-enter); the screen's or sheet's own wipe carries the
 * rest. Each row's --i is its place among the rows beside it @param {ParentNode | null} root */
export function pbEnterRows(root) {
  if (!root) return;
  const seen = new Map();
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(ENTER_ROWS))) {
    if (el.closest('.m-enter') || el.getAnimations().length) continue;
    const p = el.parentElement,
      i = seen.get(p) || 0;
    seen.set(p, i + 1);
    el.style.setProperty('--i', String(i));
    el.classList.add('m-enter');
    el.addEventListener('animationend', () => el.classList.remove('m-enter'), { once: true });
  }
}

/* ---------- pick cards come face down and turn over, one after another, the first time an offer shows ---------- */
const flipSeen = new Set();
/** has this offer's cards been turned over already (a sheet drawn again keeps them face up) @param {string} key */
function pbFlipFresh(key) {
  return !flipSeen.has(key) && !reduced();
}
/** turns the open sheet's face-down cards over, a beat apart, with the flip sound @param {string} key */
function pbFlipIn(key) {
  flipSeen.add(key);
  const cards = /** @type {any[]} */ ([...document.querySelectorAll('#ov pb-pick-card[facedown]')]);
  cards.forEach((c, i) =>
    setTimeout(
      () => {
        if (!c.isConnected || !c.facedown) return;
        c.reveal();
        pbSound('flip');
      },
      260 + i * 140
    )
  );
}

/* ---------- gains fly to where they go ---------- */
/** the Moneys chip in the top bar, or a tab of the bottom bar (bag, perks, team...) @param {string} k */
function gainTarget(k) {
  if (k === 'money') {
    const n = document.querySelector('.topbar [data-count="tse"]');
    return n ? n.closest('.tb-chip') || n : null;
  }
  const nav = /** @type {any} */ (document.getElementById('nav'));
  return (nav && nav.tabEl && nav.tabEl(k)) || null;
}
/** a gain from a card or row (its rect, taken before the sheet closed) flies to its place @param {DOMRect | null} from
 * @param {string} k money, bag, perks... @param {string} icon a ui icon id */
function pbGainFly(from, k, icon) {
  const i = document.createElement('i');
  i.className = 'uico';
  i.style.cssText = `--ico:url('${uiIconURL(icon)}');width:28px;height:28px`;
  requestAnimationFrame(() => pbFlyTo(from, gainTarget(k), i));
}
