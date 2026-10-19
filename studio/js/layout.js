'use strict';
/* ================= POCKET BILLIES STUDIO · layout (studio track ST-1) =================
   Each pane carries its width class (data-w: narrow, wide or ultra; game/js/logic/studio-layout.js) so the CSS lays a
   section out for the room it has, in a split as in a small window. A CSS container query on the pane would make the
   pane the box that fixed children (the big 3D view, the story reference) are placed in, so a ResizeObserver sets it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $, $$ } from '../../game/js/util.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  LAYOUT_LIMITS,
  layoutClamp,
  layoutEmpty,
  layoutPreset,
  layoutRead,
  layoutSizes,
  paneWidthClass,
} from '../../game/js/logic/studio-layout.js';
import {
  ACTIONS,
  PANE2_REFUSED,
  SECTIONS,
  SECTION_LIST,
  besideRefusal,
  openSection,
  render,
  renderPane,
  renderSide,
  setRender,
  studioState,
  toast,
} from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  HANDLE_LABELS: [() => HANDLE_LABELS],
  PANE_HANDLES: [() => PANE_HANDLES],
  applyLayout: [() => applyLayout, v => (applyLayout = v)],
  handleColumn: [() => handleColumn],
  handleLabel: [() => handleLabel, v => (handleLabel = v)],
  markPaneWidth: [() => markPaneWidth, v => (markPaneWidth = v)],
  mountHandles: [() => mountHandles, v => (mountHandles = v)],
  paneSection: [() => paneSection],
  paneSizes: [() => paneSizes],
  panesWidth: [() => panesWidth],
  renderSecondPane: [() => renderSecondPane, v => (renderSecondPane = v)],
  resetHandle: [() => resetHandle, v => (resetHandle = v)],
  saveLayout: [() => saveLayout, v => (saveLayout = v)],
  setHandleSize: [() => setHandleSize, v => (setHandleSize = v)],
  setSecond: [() => setSecond, v => (setSecond = v)],
  studioLayout: [() => studioLayout],
  updateLayoutButton: [() => updateLayoutButton, v => (updateLayoutButton = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
function markPaneWidth(p) {
  const c = paneWidthClass(p.clientWidth);
  if ((p.dataset.w || '') === c) return;
  if (c) p.dataset.w = c;
  else delete p.dataset.w;
}
const paneSizes = new ResizeObserver(es => es.forEach(e => markPaneWidth(e.target)));
addEventListener('load', () =>
  $$('.pane').forEach(p => {
    markPaneWidth(p);
    paneSizes.observe(p);
  })
);

/* ---------- sizes: dragged on a handle, saved per section, put on the page as custom properties ---------- */
const studioLayout = { lay: layoutEmpty() };
try {
  studioLayout.lay = layoutRead(localStorage.getItem('studio-layout'));
} catch (e) {}
function saveLayout() {
  try {
    localStorage.setItem('studio-layout', JSON.stringify(studioLayout.lay));
  } catch (e) {}
}
const paneSection = p => (p.dataset.pane === '2' ? studioState.sec2 : studioState.sec);
function applyLayout() {
  const lay = studioLayout.lay,
    st = $('#studio');
  if (lay.nav) st.style.setProperty('--nav-w', lay.nav + 'px');
  else st.style.removeProperty('--nav-w');
  const f = lay.split || 0.5;
  st.style.setProperty('--pane-cols', `minmax(0, ${f}fr) minmax(0, ${Math.round((1 - f) * 1000) / 1000}fr)`);
  $$('.pane').forEach(p => {
    const z = layoutSizes(lay, paneSection(p));
    for (const k of ['list-w', 'side-w'])
      if (z[k]) p.style.setProperty('--' + k, z[k] + 'px');
      else p.style.removeProperty('--' + k);
  });
}
/* a handle sits on the left edge of a grid column (grid-column puts the absolute box on that column): the list's
   right edge is the next column's left edge. [grid, size, column it sits on, column it sizes] */
const PANE_HANDLES = [
  ['.split', 'list-w', 2, 'first'],
  ['.props-sec', 'list-w', 2, 'first'],
  ['.bp-wrap', 'side-w', -2, 'last'],
];
function mountHandles(root) {
  for (const [sel, key, gc, col] of PANE_HANDLES)
    root.querySelectorAll(sel).forEach(g => {
      if (g.querySelector(':scope > .lay-h')) return;
      const h = document.createElement('div');
      h.className = 'lay-h';
      h.style.gridColumn = gc > 0 ? String(gc) : `${gc} / ${gc + 1}`;
      Object.assign(h.dataset, { k: key, col });
      g.appendChild(h);
    });
  $$('.lay-h', root).forEach(handleLabel);
}
function handleLabel(h) {
  const c = handleColumn(h);
  h.setAttribute('role', 'separator');
  h.setAttribute('aria-orientation', 'vertical');
  h.setAttribute('aria-label', HANDLE_LABELS[h.dataset.k]);
  h.tabIndex = 0;
  h.title = 'Drag to resize (or the arrow keys). Double-click to reset.';
  if (c) h.setAttribute('aria-valuenow', String(Math.round(c.getBoundingClientRect().width)));
}
const HANDLE_LABELS = {
  'nav-w': 'Width of the section list',
  'list-w': 'Width of the list',
  'side-w': 'Width of the side panel',
  split: 'Width of the two panes',
};
const handleColumn = h =>
  h.dataset.k === 'nav-w'
    ? $('#side')
    : h.dataset.k === 'split'
      ? $('#main')
      : h.dataset.col === 'last'
        ? h.parentElement.lastElementChild.previousElementSibling
        : h.parentElement.firstElementChild;
/* the size a handle's drag or key asks for, kept inside its limits and the room in the pane (an editor keeps 360 px) */
function setHandleSize(h, v) {
  if (h.dataset.k === 'split') {
    studioLayout.lay.split = layoutClamp('split', v / panesWidth());
    applyLayout();
    handleLabel(h);
    return updateLayoutButton();
  }
  const key = h.dataset.k,
    nav = key === 'nav-w',
    p = h.closest('.pane'),
    c = layoutClamp(key, v, nav ? innerWidth - 640 : p.clientWidth - 360);
  if (c === null) return;
  const lay = studioLayout.lay;
  if (nav) lay.nav = c;
  else {
    const sec = paneSection(p);
    (lay.sizes[sec] = lay.sizes[sec] || {})[key] = c;
  }
  applyLayout();
  handleLabel(h);
  updateLayoutButton();
}
function resetHandle(h) {
  const key = h.dataset.k,
    lay = studioLayout.lay;
  if (key === 'nav-w') lay.nav = layoutPreset(lay, lay.preset).nav;
  else if (key === 'split') lay.split = layoutPreset(lay, lay.preset).split;
  else {
    const sec = paneSection(h.closest('.pane')),
      s = lay.sizes[sec];
    if (s) delete s[key];
    if (s && !Object.keys(s).length) delete lay.sizes[sec];
  }
  applyLayout();
  saveLayout();
  handleLabel(h);
  updateLayoutButton();
}
document.addEventListener('pointerdown', ev => {
  const h = ev.target.closest && ev.target.closest('.lay-h');
  if (!h || ev.button) return;
  ev.preventDefault();
  const w0 = handleColumn(h).getBoundingClientRect().width,
    x0 = ev.clientX,
    sgn = h.dataset.col === 'last' ? -1 : 1,
    move = e => setHandleSize(h, w0 + sgn * (e.clientX - x0)),
    up = () => {
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerup', up);
      h.removeEventListener('pointercancel', up);
      document.body.classList.remove('lay-drag');
      saveLayout();
    };
  h.setPointerCapture(ev.pointerId);
  document.body.classList.add('lay-drag');
  h.addEventListener('pointermove', move);
  h.addEventListener('pointerup', up);
  h.addEventListener('pointercancel', up);
});
document.addEventListener('dblclick', ev => {
  const h = ev.target.closest && ev.target.closest('.lay-h');
  if (h) resetHandle(h);
});
/* the keys: arrows move the edge 8 px (Shift: 32), Home and End go to the smallest and largest, Delete resets */
document.addEventListener('keydown', ev => {
  const h = ev.target.closest && ev.target.closest('.lay-h');
  if (!h) return;
  const w = handleColumn(h).getBoundingClientRect().width,
    sgn = h.dataset.col === 'last' ? -1 : 1,
    step = ev.shiftKey ? 32 : 8,
    L = LAYOUT_LIMITS[h.dataset.k].map(x => (h.dataset.k === 'split' ? x * panesWidth() : x));
  let v = null;
  if (ev.key === 'ArrowRight') v = w + sgn * step;
  else if (ev.key === 'ArrowLeft') v = w - sgn * step;
  else if (ev.key === 'Home') v = L[0];
  else if (ev.key === 'End') v = L[1];
  else if (ev.key === 'Delete' || ev.key === 'Backspace') {
    ev.preventDefault();
    return resetHandle(h);
  }
  if (v === null) return;
  ev.preventDefault();
  setHandleSize(h, v);
  saveLayout();
});
/* the layout button in the top bar says which preset is on (presets come in a later step) */
function updateLayoutButton() {}

/* ---------- the split: a second section beside the first (studioState.sec2) ---------- */
const panesWidth = () => $('#main').getBoundingClientRect().width + $('#main2').getBoundingClientRect().width;
function renderSecondPane() {
  const m2 = $('#main2'),
    s = studioState.sec2;
  $('#studio').classList.toggle('two', !!s);
  m2.hidden = !s;
  if (!s) return void (m2.innerHTML = '');
  renderPane(m2, s);
  const n = (SECTION_LIST.find(x => x[0] === s) || [s, s])[1],
    swap = PANE2_REFUSED[studioState.sec]
      ? 'disabled title="The left section has a 3D view, so it stays on the left"'
      : 'title="Swap the two sections"';
  m2.insertAdjacentHTML(
    'afterbegin',
    `<div class="pane-bar"><b>${escapeHtml(n)}</b><span><button class="btn sm" data-act="paneSwap" ${swap}>⇄ Swap</button> <button class="btn sm" data-act="paneClose" title="Close this pane">✕ Close</button></span></div>`
  );
}
function setSecond(s) {
  studioState.sec2 = s;
  studioLayout.lay.sec2 = s;
  saveLayout();
  renderSide();
  render();
  $('#main2').scrollTop = 0;
}
ACTIONS.openBeside = d => {
  const why = besideRefusal(d.s);
  if (why) return toast(why);
  setSecond(d.s);
};
ACTIONS.paneClose = () => setSecond(null);
ACTIONS.paneSwap = () => {
  if (studioState.sec2 && !PANE2_REFUSED[studioState.sec]) openSection(studioState.sec2);
};
addEventListener('load', () => {
  for (const [cls, k] of [
    ['lay-nav', 'nav-w'],
    ['lay-panes', 'split'],
  ]) {
    const h = document.createElement('div');
    h.className = 'lay-h ' + cls;
    h.dataset.k = k;
    $('#studio').appendChild(h);
    handleLabel(h);
  }
  applyLayout();
  /* follow the Studio: each section drawn gets its sizes and handles, and the second pane is drawn too. The split
     you left comes back with the first drawing */
  let first = true;
  const r0 = render;
  setRender(function () {
    if (first) {
      first = false;
      const s = studioLayout.lay.sec2;
      if (s && SECTIONS[s] && !besideRefusal(s)) {
        studioState.sec2 = s;
        renderSide();
      }
    }
    r0.apply(this, arguments);
    if (studioLayout.lay.sec2 !== studioState.sec2) {
      studioLayout.lay.sec2 = studioState.sec2; // a swap moved it
      saveLayout();
    }
    renderSecondPane();
    applyLayout();
    $$('.pane').forEach(mountHandles);
  });
});
