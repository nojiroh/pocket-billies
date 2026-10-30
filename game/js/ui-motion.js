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
  PRESS_INNER: [() => PRESS_INNER],
  PRESS_SEL: [() => PRESS_SEL],
  SEL_GROUP: [() => SEL_GROUP],
  SEL_ON: [() => SEL_ON],
  flipSeen: [() => flipSeen],
  gainTarget: [() => gainTarget, v => (gainTarget = v)],
  isDisabled: [() => isDisabled, v => (isDisabled = v)],
  lastPress: [() => lastPress],
  patchKids: [() => patchKids, v => (patchKids = v)],
  patchNode: [() => patchNode, v => (patchNode = v)],
  pbEnterRows: [() => pbEnterRows, v => (pbEnterRows = v)],
  pbFlipFresh: [() => pbFlipFresh, v => (pbFlipFresh = v)],
  pbFlipIn: [() => pbFlipIn, v => (pbFlipIn = v)],
  pbGainFly: [() => pbGainFly, v => (pbGainFly = v)],
  pbPatch: [() => pbPatch, v => (pbPatch = v)],
  pressMs: [() => pressMs],
  pressRelease: [() => pressRelease, v => (pressRelease = v)],
  pressScale: [() => pressScale, v => (pressScale = v)],
  pressTarget: [() => pressTarget, v => (pressTarget = v)],
  pressed: [() => pressed, v => (pressed = v)],
  recentPress: [() => recentPress, v => (recentPress = v)],
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
/* kit parts that hold several buttons: the button pressed squashes, not the whole part (the bottom bar squashed whole,
   its cut outline and all, which read as angular on the owner's phone) */
const PRESS_INNER = new Set(['pb-nav-bar']);
/** the control a pointer is on: a kit part's host when the press is inside its shadow root @param {Event} ev */
function pressTarget(ev) {
  const path = ev.composedPath ? ev.composedPath() : [ev.target];
  for (const el of path) {
    if (!(el instanceof Element) || !el.matches(PRESS_SEL)) continue;
    const root = el.getRootNode();
    return root instanceof ShadowRoot && root.host.localName.startsWith('pb-') && !PRESS_INNER.has(root.host.localName)
      ? root.host
      : el;
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
  const seen = new Map(),
    H = innerHeight;
  /* FL-6: only the rows that start on screen come in (one off screen has nobody to see it, and each animation costs
     the frames while the screen opens); every read (one layout) before the first write */
  const rows = /** @type {HTMLElement[]} */ ([...root.querySelectorAll(ENTER_ROWS)]).filter(
      el => !el.closest('.m-enter') && !el.getAnimations().length
    ),
    on = rows.map(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < H && r.height > 0;
    });
  rows.forEach((el, n) => {
    if (!on[n]) return;
    const p = el.parentElement,
      i = seen.get(p) || 0;
    seen.set(p, i + 1);
    el.style.setProperty('--i', String(i));
    el.classList.add('m-enter');
    el.addEventListener('animationend', () => el.classList.remove('m-enter'), { once: true });
  });
}

/* ---------- FL-6: a part of a screen or sheet drawn again in place ---------- */
/** puts html into el by changing only what differs (text, attributes, the nodes that changed), instead of a whole
 * innerHTML: a tap repaints its row and what it changed, focus, scroll and running animations stay. A kit element
 * (a name with a dash) that differs is replaced whole (its own attributes may have been set by itself). Returns how
 * many nodes were written @param {Element} el @param {string} html */
export function pbPatch(el, html) {
  /* parsed inert (no kit element is made until it is put in the page) */
  return patchKids(el, new DOMParser().parseFromString(`<body>${html}`, 'text/html').body);
}
/** @param {ParentNode & Node} a the live parent @param {ParentNode & Node} b the new one */
function patchKids(a, b) {
  const A = [...a.childNodes],
    B = [...b.childNodes];
  if (A.length !== B.length) {
    /** @type {Element} */ (/** @type {unknown} */ (a)).replaceChildren(...B);
    return 1;
  }
  let n = 0;
  for (let i = 0; i < A.length; i++) n += patchNode(A[i], B[i]);
  return n;
}
/** @param {ChildNode} x live @param {ChildNode} y new */
function patchNode(x, y) {
  if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) {
    x.replaceWith(y);
    return 1;
  }
  if (x.nodeType !== 1) {
    if (x.nodeValue === y.nodeValue) return 0;
    x.nodeValue = y.nodeValue;
    return 1;
  }
  const X = /** @type {Element} */ (x),
    Y = /** @type {Element} */ (y);
  if (X.localName.includes('-')) {
    const same = [...Y.attributes].every(at => X.getAttribute(at.name) === at.value) && X.innerHTML === Y.innerHTML;
    if (same) return 0;
    X.replaceWith(Y);
    return 1;
  }
  let n = 0;
  for (const at of [...X.attributes])
    if (!Y.hasAttribute(at.name)) {
      X.removeAttribute(at.name);
      n++;
    }
  for (const at of [...Y.attributes])
    if (X.getAttribute(at.name) !== at.value) {
      X.setAttribute(at.name, at.value);
      n++;
    }
  n += patchKids(X, Y);
  /* a control's live value follows its new markup (the attribute alone doesn't once it was touched) */
  if (X instanceof HTMLInputElement && Y instanceof HTMLInputElement) {
    if (X.value !== Y.value) X.value = Y.value;
    if (X.checked !== Y.checked) X.checked = Y.checked;
  } else if (X instanceof HTMLSelectElement && Y instanceof HTMLSelectElement) {
    const v = Y.querySelector('option[selected]');
    if (v && X.value !== /** @type {HTMLOptionElement} */ (v).value)
      X.value = /** @type {HTMLOptionElement} */ (v).value;
  }
  return n;
}

/* ---------- pick cards come face down and turn over, one after another, the first time an offer shows ---------- */
const flipSeen = new Set();
/** has this offer's cards been turned over already (a sheet drawn again keeps them face up) @param {string} key */
export function pbFlipFresh(key) {
  return !flipSeen.has(key) && !reduced();
}
/** turns the open sheet's face-down cards over, a beat apart, with the flip sound @param {string} key */
export function pbFlipIn(key) {
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
/** where you pressed last, if it was just now (a gain that comes of a press flies from there) */
export function recentPress() {
  return lastPress.rect && performance.now() - lastPress.at < 1500 ? lastPress.rect : null;
}
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
export function pbGainFly(from, k, icon) {
  const i = document.createElement('i');
  i.className = 'uico';
  i.style.cssText = `--ico:url('${uiIconURL(icon)}');width:28px;height:28px`;
  requestAnimationFrame(() => pbFlyTo(from, gainTarget(k), i));
}
