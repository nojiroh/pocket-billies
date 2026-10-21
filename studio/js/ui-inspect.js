'use strict';
/* ================= POCKET BILLIES STUDIO · inspect (UI track, UI-3b) =================
   The UI look section's Inspect: with it on, a tap in the preview frame picks a part instead of pressing it. The
   panel under the preview names the part (its kit component or classes, the gallery section or the screen it is on)
   and lists the variables its rules read (its own, its ::before and ::after, and its component's :host rules), each
   with its value and the dials that write it (logic/ui-dials.js uiVarDials), which open the dial. A box outlines the
   part in the frame. The frame is the same page as the Studio (same origin), so its style sheets can be read. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, uiOverlaysFollow } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { escapeHtml } from './game-stand-ins.js';
import { UI_DIALS, UI_DIAL_ALSO, uiDialList, uiDialReach, uiGet, uiVarDials } from '../../game/js/logic/ui-dials.js';
import { cssVarNames, hostSelector, matchableSelector, splitSelectors } from '../../game/js/logic/ui-inspect.js';
import { ACTIONS } from './studio-app.js';
import { findUi, uiData, uiEditor, uiScreenName } from './ui-editor.js';
/* eslint-disable no-func-assign */
expose({
  uiComponentOf: [() => uiComponentOf, v => (uiComponentOf = v)],
  uiDialConnections: [() => uiDialConnections, v => (uiDialConnections = v)],
  uiDialTitle: [() => uiDialTitle],
  uiFlashParts: [() => uiFlashParts, v => (uiFlashParts = v)],
  uiFrameBoxes: [() => uiFrameBoxes, v => (uiFrameBoxes = v)],
  uiFrameLayer: [() => uiFrameLayer, v => (uiFrameLayer = v)],
  uiInspect: [() => uiInspect],
  uiInspectAlive: [() => uiInspectAlive],
  uiInspectDials: [() => uiInspectDials, v => (uiInspectDials = v)],
  uiInspectInfo: [() => uiInspectInfo, v => (uiInspectInfo = v)],
  uiInspectMount: [() => uiInspectMount, v => ((uiInspectMount = v), provide({ uiInspectMount }))],
  uiInspectOutline: [() => uiInspectOutline, v => ((uiInspectOutline = v), provide({ uiInspectOutline }))],
  uiInspectPanel: [() => uiInspectPanel, v => ((uiInspectPanel = v), provide({ uiInspectPanel }))],
  uiInspectPick: [() => uiInspectPick, v => (uiInspectPick = v)],
  uiInspectWins: [() => uiInspectWins],
  uiPartLabel: [() => uiPartLabel, v => (uiPartLabel = v)],
  uiPartName: [() => uiPartName, v => (uiPartName = v)],
  uiPartsUsing: [() => uiPartsUsing, v => (uiPartsUsing = v)],
  uiPreviewWin: [() => uiPreviewWin, v => (uiPreviewWin = v)],
  uiRulesOf: [() => uiRulesOf, v => (uiRulesOf = v)],
  uiVarsOn: [() => uiVarsOn, v => (uiVarsOn = v)],
});
/* eslint-enable no-func-assign */
provide({ uiInspectMount, uiInspectOutline, uiInspectPanel });
/* to-module: end */
const uiInspect = {
  on: false,
  /** @type {Element | null} */
  el: null,
  /** the dials per variable for the look they were worked out on */
  dials: /** @type {Record<string, string[]> | null} */ (null),
  dialsFor: '',
};
provide({ uiInspect }); /* to-module */
const uiInspectWins = new WeakSet();

/** the preview frame's window (the look being edited) */
export function uiPreviewWin() {
  const f = /** @type {HTMLIFrameElement | null} */ ($('#uiPv'));
  return f && f.contentWindow;
}

/** a box drawn over parts inside a frame: one layer on top, never in the way of a tap */
function uiFrameLayer(w, id = 'studioLayer') {
  const d = w.document;
  let L = d.getElementById(id);
  if (!L) {
    L = d.createElement('div');
    L.id = id;
    L.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    d.body.appendChild(L);
  }
  return L;
}
/** outline elements in a frame's layer: [{el, cls, tip}] */
export function uiFrameBoxes(w, boxes, id = 'studioLayer') {
  const L = uiFrameLayer(w, id);
  L.innerHTML = '';
  for (const b of boxes) {
    const r = b.el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const x = w.document.createElement('div');
    x.className = b.cls || '';
    x.title = b.tip || '';
    x.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;box-sizing:border-box;${b.style || ''}`;
    if (b.label) {
      const t = w.document.createElement('span');
      t.textContent = b.label;
      t.style.cssText =
        'position:absolute;left:0;top:-15px;font:600 10px/14px system-ui,sans-serif;padding:0 3px;white-space:nowrap;' +
        (b.labelStyle || '');
      x.appendChild(t);
    }
    L.appendChild(x);
  }
}

/** watch a preview frame: taps pick a part while Inspect is on */
function uiInspectMount() {
  const w = uiPreviewWin();
  if (!w || !w.document || uiInspectWins.has(w)) return;
  uiInspectWins.add(w);
  const stop = ev => {
    if (!uiInspect.on) return false;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    return true;
  };
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup']) w.addEventListener(t, stop, true);
  w.addEventListener(
    'click',
    ev => {
      if (!stop(ev)) return;
      // the first part with a box (a slot or a display: contents wrapper has none)
      const el = ev
        .composedPath()
        .find(
          n =>
            n &&
            n.nodeType === 1 &&
            n !== w.document.documentElement &&
            n.localName !== 'slot' &&
            n.getBoundingClientRect().width > 0
        );
      if (el) uiInspectPick(/** @type {Element} */ (el));
    },
    true
  );
  const again = () => {
    uiInspectOutline();
    uiOverlaysFollow();
  };
  w.addEventListener('scroll', again, true);
  w.addEventListener('resize', again);
  uiInspect.el = null;
  uiInspectPanel();
}

/** is the picked part still on the preview showing now? (the frame is made again when the section is drawn) */
const uiInspectAlive = el => !!el && el.isConnected && el.ownerDocument.defaultView === uiPreviewWin();

/** the element a part belongs to: the nearest kit component (a custom element) out through shadow roots */
function uiComponentOf(el) {
  for (let n = el; n; n = n.parentNode && n.parentNode.nodeType === 11 ? n.parentNode.host : n.parentNode)
    if (n.nodeType === 1 && n.localName.includes('-')) return n;
  return null;
}
/** how a part is named: <pb-card selected> or div.u-row.sel */
function uiPartName(el) {
  if (el.localName.includes('-'))
    return `<${el.localName}${[...el.attributes]
      .filter(a => !['class', 'style', 'id'].includes(a.name))
      .slice(0, 3)
      .map(a => ' ' + a.name + (a.value ? `="${a.value}"` : ''))
      .join('')}>`;
  return (
    el.localName +
    [...el.classList]
      .slice(0, 4)
      .map(c => '.' + c)
      .join('')
  );
}

/** a part's name for a list: a bare tag (i, span) or one class is named with its parent's (button.tab › i.on) */
function uiPartLabel(el) {
  const own = uiPartName(el);
  if (el.localName.includes('-') || el.classList.length > 1) return own;
  const up = el.parentElement || (el.parentNode && el.parentNode.host);
  return up && up.localName !== 'body' && up.localName !== 'main' ? `${uiPartName(up)} › ${own}` : own;
}
/** the style rules in a root's sheets (media that applies, supports, layers and nested rules opened) */
function uiRulesOf(root, w) {
  const out = [];
  const walk = list => {
    for (const r of list) {
      if (r.selectorText !== undefined) {
        out.push(r);
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
      } else if (r.media && r.cssRules) {
        if (w.matchMedia(r.media.mediaText).matches) walk(r.cssRules);
      } else if (r.cssRules) walk(r.cssRules);
    }
  };
  const sheets = [...(root.styleSheets || []), ...(root.adoptedStyleSheets || [])];
  for (const s of sheets) {
    try {
      walk(s.cssRules);
    } catch (e) {
      /* a sheet from another origin can't be read */
    }
  }
  return out;
}
/** the variables the rules on an element read: [{name, sel, pseudo}] */
function uiVarsOn(el, w) {
  const out = [];
  const take = (r, sel, pseudo) => {
    for (const name of cssVarNames(r.style.cssText)) out.push({ name, sel, pseudo });
  };
  for (const r of uiRulesOf(el.getRootNode(), w))
    for (const part of splitSelectors(r.selectorText)) {
      const m = matchableSelector(part);
      try {
        if (el.matches(m.sel)) take(r, part, m.pseudo);
      } catch (e) {
        /* a selector this browser can't match */
      }
    }
  if (el.shadowRoot)
    for (const r of uiRulesOf(el.shadowRoot, w))
      for (const part of splitSelectors(r.selectorText)) {
        const h = hostSelector(part);
        try {
          if (h && el.matches(h)) take(r, part, matchableSelector(part).pseudo);
        } catch (e) {
          /* as above */
        }
      }
  const inline = el.getAttribute('style');
  if (inline) for (const name of cssVarNames(inline)) out.push({ name, sel: 'style=""', pseudo: '' });
  return out;
}

/** the dials per variable for the look being edited (worked out again when the look changes) */
function uiInspectDials() {
  const T = uiData(),
    key = JSON.stringify(T && T.defaults);
  if (uiInspect.dialsFor !== key) {
    uiInspect.dials = uiVarDials(T);
    uiInspect.dialsFor = key;
  }
  return uiInspect.dials || {};
}

/** what the panel shows for a part: {name, comp, where, vars: [{name, value, sels, dials}]} */
function uiInspectInfo(el) {
  const w = el.ownerDocument.defaultView,
    comp = uiComponentOf(el),
    top = comp || el,
    sec = top.closest && top.closest('.g-sec'),
    scr = top.closest && top.closest('[data-ui-screen]'),
    found = [...uiVarsOn(el, w), ...(comp && comp !== el ? uiVarsOn(comp, w) : [])],
    dials = uiInspectDials(),
    cs = w.getComputedStyle(el),
    byName = new Map();
  for (const v of found) {
    const e = byName.get(v.name) || { name: v.name, sels: [], dials: dials[v.name] || [] };
    const s = v.sel + (v.pseudo && !v.sel.includes(v.pseudo) ? ' ' + v.pseudo : '');
    if (!e.sels.includes(s)) e.sels.push(s);
    byName.set(v.name, e);
  }
  const vars = [...byName.values()].map(v => ({ ...v, value: cs.getPropertyValue(v.name).trim() }));
  // the ones a dial writes first, then the rest (tokens.css only)
  vars.sort((a, b) => (b.dials.length ? 1 : 0) - (a.dials.length ? 1 : 0) || a.name.localeCompare(b.name));
  const h2 = sec && sec.querySelector('h2');
  return {
    name: uiPartName(el),
    comp: comp && comp !== el ? uiPartName(comp) : '',
    where: scr ? `the ${uiScreenName(scr.dataset.uiScreen)} screen` : h2 ? `${h2.textContent} (gallery)` : '',
    vars,
  };
}

/** pick a part: outline it and list its variables */
function uiInspectPick(el) {
  uiInspect.el = el;
  uiInspectOutline();
  uiInspectPanel();
}
function uiInspectOutline() {
  const w = uiPreviewWin();
  if (!w || !w.document || !w.document.body) return;
  const el = uiInspect.el;
  uiFrameBoxes(
    w,
    uiInspect.on && uiInspectAlive(el)
      ? [
          {
            el,
            style: 'outline:2px solid #1e9bd7;outline-offset:1px;background:rgba(30,155,215,.12);',
            label: uiPartName(el),
            labelStyle: 'background:#1e9bd7;color:#fff;',
          },
        ]
      : [],
    'studioInspect'
  );
}

const uiDialTitle = rel => {
  const e = uiDialList().find(x => x.path === rel),
    G = UI_DIALS.find(g => g.id === rel.split('.')[0]);
  return `${G ? G.title.replace(/ \(.*\)$/, '') : ''} › ${e ? e.label : rel}`;
};
/** the panel under the preview */
function uiInspectPanel() {
  const P = $('#uiInspect');
  if (!P) return;
  P.hidden = !uiInspect.on;
  if (!uiInspect.on) return;
  const el = uiInspect.el;
  if (!uiInspectAlive(el)) {
    P.innerHTML = '<p class="help">Tap a part in the preview to see what it is and which dials reach it.</p>';
    return;
  }
  const I = uiInspectInfo(el);
  const swatch = v => (/^(#|rgb|hsl)/.test(v) ? `<span class="ui-sw" style="background:${escapeHtml(v)}"></span>` : '');
  P.innerHTML = `<div class="ui-insp-h"><code>${escapeHtml(I.name)}</code>${I.comp ? ` in <code>${escapeHtml(I.comp)}</code>` : ''}${I.where ? ` · ${escapeHtml(I.where)}` : ''}</div>
 ${
   I.vars.length
     ? `<table class="ui-insp">${I.vars
         .map(
           v =>
             `<tr data-var="${v.name}"><td><code title="${escapeHtml(v.sels.join('\n'))}">${v.name}</code></td><td>${swatch(v.value)}<span class="ui-val">${escapeHtml(v.value.length > 60 ? v.value.slice(0, 57) + '…' : v.value)}</span></td><td>${
               v.dials.length
                 ? v.dials
                     .slice(0, 4)
                     .map(
                       r =>
                         `<button class="btn sm subtle" data-act="uiInspectGo" data-r="${r}">${escapeHtml(uiDialTitle(r))}</button>`
                     )
                     .join('') + (v.dials.length > 4 ? ` <span class="help">+${v.dials.length - 4}</span>` : '')
                 : '<span class="help">tokens.css (no dial)</span>'
             }</td></tr>`
         )
         .join('')}</table>`
     : '<p class="help">Its rules read no variables: raw values only (the Rule check lists them).</p>'
 }`;
}
ACTIONS.uiInspectOn = () => {
  uiInspect.on = !uiInspect.on;
  const b = $('#uiInsp');
  if (b) b.classList.toggle('on', uiInspect.on);
  uiInspectMount();
  uiInspectOutline();
  uiInspectPanel();
};
ACTIONS.uiInspectGo = d => {
  const rel = d.r,
    G = UI_DIALS.find(g => g.id === rel.split('.')[0]);
  findUi(rel, G && G.screen ? uiEditor.scope : 'game');
};

/* ---- UI-3b: Connections (Ctrl+L) on a UI dial: where its value comes from, the variables it writes and the parts
   in the preview that read them (the reverse of inspect) ---- */
/** the parts in a frame whose rules read any of these variables: [{name, els, vars}] by part name */
function uiPartsUsing(w, vars) {
  const want = new Set(vars),
    groups = new Map();
  const add = (el, v) => {
    if (!el.getBoundingClientRect().width) return;
    const name = uiPartLabel(el),
      g = groups.get(name) || { name, els: [], vars: [] };
    if (!g.els.includes(el)) g.els.push(el);
    for (const x of v) if (!g.vars.includes(x)) g.vars.push(x);
    groups.set(name, g);
  };
  const scan = (root, hostOf) => {
    for (const r of uiRulesOf(root, w)) {
      const v = cssVarNames(r.style.cssText).filter(x => want.has(x));
      if (!v.length) continue;
      for (const part of splitSelectors(r.selectorText)) {
        try {
          if (hostOf) {
            const h = hostSelector(part);
            if (h && hostOf.matches(h)) add(hostOf, v);
            else if (!h) root.querySelectorAll(matchableSelector(part).sel).forEach(el => add(hostOf, v));
          } else w.document.querySelectorAll(matchableSelector(part).sel).forEach(el => add(el, v));
        } catch (e) {
          /* a selector this browser can't match */
        }
      }
    }
  };
  scan(w.document, null);
  for (const el of w.document.querySelectorAll('*')) if (el.shadowRoot) scan(el.shadowRoot, el);
  return [...groups.values()].sort((a, b) => b.els.length - a.els.length);
}

/** outline these parts in the preview for a moment and bring the first into view */
function uiFlashParts(els) {
  const w = uiPreviewWin();
  if (!w || !els.length) return;
  els[0].scrollIntoView({ block: 'center' });
  const draw = () =>
    uiFrameBoxes(
      w,
      els.map(el => ({ el, style: 'outline:2px solid #e8a33a;outline-offset:1px;background:rgba(232,163,58,.15);' })),
      'studioFlash'
    );
  requestAnimationFrame(draw);
  clearTimeout(uiFlashParts.t);
  uiFlashParts.t = setTimeout(() => uiFrameBoxes(w, [], 'studioFlash'), 2400);
}

/** what Connections shows for a UI dial at a level: {label, chain, pre, vars, parts} */
export function uiDialConnections(rel, scope = 'game') {
  const T = uiData(),
    e = uiDialList().find(x => x.path === rel),
    G = UI_DIALS.find(g => g.id === rel.split('.')[0]),
    fmt = v => (v === undefined ? 'not set' : Array.isArray(v) ? v.join(' ') : String(v)),
    open = sc => () => findUi(rel, sc);
  const chain = [
    {
      kind: 'src',
      id: 'game',
      label: 'Whole game',
      sub: fmt(uiGet(T.defaults, rel)),
      on: scope === 'game',
      go: open('game'),
    },
  ];
  const screens = G && G.screen ? Object.entries(T.overrides || {}).filter(([, o]) => uiGet(o, rel) !== undefined) : [];
  const shown = screens.map(([k, o]) => ({
    kind: 'screen',
    id: k,
    label: 'Only ' + uiScreenName(k),
    sub: fmt(uiGet(o, rel)),
    on: scope === k,
    go: open(k),
  }));
  const pre = Object.entries(T.presets || {})
    .filter(([, P]) => uiGet(P, rel) !== undefined)
    .map(([k, P]) => ({
      kind: 'preset',
      id: k,
      label: 'Preset: ' + (P.name || k),
      sub: 'sets it to ' + fmt(uiGet(P, rel)),
      go: open(scope),
    }));
  const reach = uiDialReach(T, rel),
    w = uiPreviewWin(),
    parts = w && w.document && w.document.body ? uiPartsUsing(w, reach) : [];
  return {
    label: `${G ? G.title : ''} › ${e ? e.label : rel}`,
    chain: [...chain, ...shown],
    pre,
    vars: reach.map(v => ({ kind: 'var', id: v, label: v, sub: UI_DIAL_ALSO[rel] ? 'through its @font-face' : '' })),
    parts: parts.slice(0, 12).map(p => ({
      kind: 'part',
      id: p.name,
      label: p.name,
      sub: `${p.els.length} in the preview · ${p.vars.slice(0, 2).join(' ')}`,
      go: () => uiFlashParts(p.els),
    })),
    more: Math.max(0, parts.length - 12),
  };
}
