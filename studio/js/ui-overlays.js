'use strict';
/* ================= POCKET BILLIES STUDIO · overlays (UI track, UI-3b) =================
   Three switches on the UI look section's preview mark what breaks the UI rules on what it shows, as boxes drawn over
   the frame (never in the way of a tap): tap targets under 44 px, text under its contrast on what is behind it (4.5:1,
   3:1 for large text; worked out through the see-through layers down to the first solid one, a gradient by its worst
   stop; an image behind can't be told), and glass (each blurred surface, red when more than two stack, with the count
   on screen against the budget of 3). The rules are logic/ui-inspect.js's; a line under the preview counts them. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import {
  UI_BLUR_BUDGET,
  UI_GLASS_STACK,
  UI_TAP_MIN,
  backgroundLayerColours,
  parseCssColour,
  splitSelectors,
  uiGlassTooDeep,
  uiLayeredContrast,
  uiTapTooSmall,
  uiTextMin,
} from '../../game/js/logic/ui-inspect.js';
import { ACTIONS } from './studio-app.js';
import { uiFrameBoxes, uiPreviewWin } from './ui-inspect.js';
/* eslint-disable no-func-assign */
expose({
  UI_TAP_TARGETS: [() => UI_TAP_TARGETS],
  uiAllElements: [() => uiAllElements, v => (uiAllElements = v)],
  uiAnyOverlay: [() => uiAnyOverlay],
  uiLayersBehind: [() => uiLayersBehind, v => (uiLayersBehind = v)],
  uiOverlayBoxes: [() => uiOverlayBoxes, v => (uiOverlayBoxes = v)],
  uiOverlayT: [() => uiOverlayT, v => (uiOverlayT = v)],
  uiOverlays: [() => uiOverlays],
  uiOverlaysFollow: [() => uiOverlaysFollow, v => ((uiOverlaysFollow = v), provide({ uiOverlaysFollow }))],
  uiOverlaysRefresh: [() => uiOverlaysRefresh, v => (uiOverlaysRefresh = v)],
  uiOverlaysScan: [() => uiOverlaysScan, v => (uiOverlaysScan = v)],
  uiOverlaysSoon: [() => uiOverlaysSoon, v => ((uiOverlaysSoon = v), provide({ uiOverlaysSoon }))],
  uiShown: [() => uiShown],
  uiUp: [() => uiUp],
});
/* eslint-enable no-func-assign */
provide({ uiOverlaysFollow, uiOverlaysSoon });
/* to-module: end */
const uiOverlays = {
  tap: false,
  contrast: false,
  glass: false,
  /** the last scan: {tap, contrast, unknown, glass, blurOnScreen} */
  last: /** @type {any} */ (null),
};
provide({ uiOverlays }); /* to-module */
const UI_TAP_TARGETS =
  'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [tabindex]:not([tabindex="-1"]), pb-button';

/** every element of a document, shadow roots opened */
function uiAllElements(doc) {
  const out = [];
  const walk = root => {
    for (const el of root.querySelectorAll('*')) {
      out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(doc);
  return out;
}
/** the element above, out through a shadow root */
const uiUp = el => el.parentElement || (el.parentNode && el.parentNode.host) || null;
const uiShown = (el, cs) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
};

/** what is behind an element's text, nearest first: the colours of each layer under the text (a background image's
 * entries top first, then the background colour; ::after and ::before above their element's own); null when an
 * image is in the way */
function uiLayersBehind(el, w) {
  const layers = [],
    tr = el.getBoundingClientRect();
  /** a box's backgrounds as layers; false when an image is there */
  const take = (cs, r) => {
    const area = { x0: tr.left - r.left, y0: tr.top - r.top, x1: tr.right - r.left, y1: tr.bottom - r.top },
      box = { w: r.width, h: r.height };
    for (const img of splitSelectors(cs.backgroundImage)) {
      const c = backgroundLayerColours(img, box, area);
      if (c === null) return false;
      if (c.some(x => x.a > 0)) layers.push(c);
    }
    const bg = parseCssColour(cs.backgroundColor);
    if (bg && bg.a > 0) layers.push([bg]);
    return true;
  };
  for (let n = el; n; n = uiUp(n)) {
    const r = n.getBoundingClientRect();
    for (const p of ['::after', '::before']) {
      const ps = w.getComputedStyle(n, p);
      // an edge ring (a clip-path with a hole) draws a line round the part, not under its text
      if (ps.content === 'none' || /evenodd/.test(ps.clipPath)) continue;
      if (!take(ps, r)) return null;
    }
    if (!take(w.getComputedStyle(n), r)) return null;
  }
  layers.push([{ hex: '#ffffff', a: 1 }]); // the frame's own canvas
  return layers;
}

/** look over the preview frame */
function uiOverlaysScan(w) {
  const doc = w.document,
    all = uiAllElements(doc),
    out = { tap: [], contrast: [], unknown: 0, glass: [], blurOnScreen: 0 };
  for (const el of doc.querySelectorAll(UI_TAP_TARGETS)) {
    const cs = w.getComputedStyle(el);
    if (!uiShown(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (uiTapTooSmall(r)) out.tap.push({ el, w: Math.round(r.width), h: Math.round(r.height) });
  }
  for (const el of all) {
    if (el.closest('#studioLayer, #studioInspect, #studioFlash, #studioOverlay')) continue;
    const cs = w.getComputedStyle(el);
    if (cs.backdropFilter && cs.backdropFilter !== 'none' && uiShown(el, cs)) {
      let depth = 1;
      for (let n = uiUp(el); n; n = uiUp(n)) {
        const f = w.getComputedStyle(n).backdropFilter;
        if (f && f !== 'none') depth++;
      }
      out.glass.push({ el, depth });
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < w.innerHeight) out.blurOnScreen++;
    }
    const text = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!text || !uiShown(el, cs)) continue;
    const fg = parseCssColour(cs.color);
    if (!fg || !fg.a) continue;
    const layers = uiLayersBehind(el, w),
      ratio = layers && uiLayeredContrast(fg, layers);
    if (ratio == null) {
      out.unknown++;
      continue;
    }
    const min = uiTextMin(parseFloat(cs.fontSize), parseInt(cs.fontWeight, 10) || 400);
    if (ratio < min) out.contrast.push({ el, ratio, min });
  }
  return out;
}

/** the boxes for the switches that are on */
function uiOverlayBoxes(S) {
  const boxes = [];
  if (uiOverlays.glass)
    for (const g of S.glass) {
      const deep = uiGlassTooDeep(g.depth);
      boxes.push({
        el: g.el,
        style: `border:2px ${deep ? 'solid #d83a3a' : 'dashed #3a7bd8'};`,
        label: deep ? `glass ×${g.depth}` : g.depth > 1 ? `glass ×${g.depth}` : 'glass',
        labelStyle: `background:${deep ? '#d83a3a' : '#3a7bd8'};color:#fff;`,
      });
    }
  if (uiOverlays.tap)
    for (const t of S.tap)
      boxes.push({
        el: t.el,
        style: 'outline:2px dashed #e07b00;outline-offset:-1px;background:rgba(224,123,0,.12);',
        label: `${t.w}×${t.h}`,
        labelStyle: 'background:#e07b00;color:#fff;',
      });
  if (uiOverlays.contrast)
    for (const c of S.contrast)
      boxes.push({
        el: c.el,
        style: 'outline:2px solid #d83a3a;outline-offset:1px;background:rgba(216,58,58,.12);',
        label: `${c.ratio.toFixed(1)}:1 < ${c.min}`,
        labelStyle: 'background:#d83a3a;color:#fff;',
      });
  return boxes;
}

const uiAnyOverlay = () => uiOverlays.tap || uiOverlays.contrast || uiOverlays.glass;
/** scan again and draw (after a look change, a switch, the frame loading) */
function uiOverlaysRefresh() {
  const w = uiPreviewWin(),
    note = $('#uiOvNote');
  if (!w || !w.document || !w.document.body) return;
  if (!uiAnyOverlay()) {
    uiOverlays.last = null;
    uiFrameBoxes(w, [], 'studioOverlay');
    if (note) note.hidden = true;
    return;
  }
  const S = (uiOverlays.last = uiOverlaysScan(w));
  uiFrameBoxes(w, uiOverlayBoxes(S), 'studioOverlay');
  if (note) {
    const deep = S.glass.filter(g => uiGlassTooDeep(g.depth)).length,
      bits = [];
    if (uiOverlays.tap) bits.push(`Tap targets under ${UI_TAP_MIN} px: ${S.tap.length}`);
    if (uiOverlays.contrast)
      bits.push(
        `Text under its contrast: ${S.contrast.length}${S.unknown ? ` (${S.unknown} over an image: can’t tell); text shadows not counted` : ''}`
      );
    if (uiOverlays.glass)
      bits.push(
        `Blurred surfaces on screen: ${S.blurOnScreen} (budget ${UI_BLUR_BUDGET})${deep ? `, ${deep} stacked more than ${UI_GLASS_STACK} deep` : ''}`
      );
    note.hidden = false;
    note.textContent = bits.join(' · ');
  }
}
let uiOverlayT = 0;
/** a scan soon (the look has just changed: the frame draws it first) */
function uiOverlaysSoon() {
  if (!uiAnyOverlay()) return;
  clearTimeout(uiOverlayT);
  uiOverlayT = setTimeout(uiOverlaysRefresh, 120);
}
/** the boxes follow the page as it scrolls (no new scan) */
function uiOverlaysFollow() {
  const w = uiPreviewWin();
  if (w && uiOverlays.last && uiAnyOverlay()) uiFrameBoxes(w, uiOverlayBoxes(uiOverlays.last), 'studioOverlay');
}
ACTIONS.uiOverlay = (d, el) => {
  const k = d.k;
  uiOverlays[k] = !uiOverlays[k];
  if (el) el.classList.toggle('on', uiOverlays[k]);
  uiOverlaysRefresh();
};
