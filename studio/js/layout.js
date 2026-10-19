'use strict';
/* ================= POCKET BILLIES STUDIO · layout (studio track ST-1) =================
   Each pane carries its width class (data-w: narrow, wide or ultra; game/js/logic/studio-layout.js) so the CSS lays a
   section out for the room it has, in a split as in a small window. A CSS container query on the pane would make the
   pane the box that fixed children (the big 3D view, the story reference) are placed in, so a ResizeObserver sets it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $, $$ } from '../../game/js/util.js';
import {
  LAYOUT_LIMITS,
  layoutClamp,
  layoutEmpty,
  layoutPreset,
  layoutRead,
  layoutSizes,
  paneWidthClass,
} from '../../game/js/logic/studio-layout.js';
import { render, setRender, studioState } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  PANE_HANDLES: [() => PANE_HANDLES],
  applyLayout: [() => applyLayout, v => (applyLayout = v)],
  handleColumn: [() => handleColumn],
  handleLabel: [() => handleLabel, v => (handleLabel = v)],
  markPaneWidth: [() => markPaneWidth, v => (markPaneWidth = v)],
  mountHandles: [() => mountHandles, v => (mountHandles = v)],
  paneSection: [() => paneSection],
  paneSizes: [() => paneSizes],
  resetHandle: [() => resetHandle, v => (resetHandle = v)],
  saveLayout: [() => saveLayout, v => (saveLayout = v)],
  setHandleSize: [() => setHandleSize, v => (setHandleSize = v)],
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
  h.setAttribute(
    'aria-label',
    h.dataset.k === 'nav-w'
      ? 'Width of the section list'
      : h.dataset.k === 'list-w'
        ? 'Width of the list'
        : 'Width of the side panel'
  );
  h.tabIndex = 0;
  h.title = 'Drag to resize (or the arrow keys). Double-click to reset.';
  if (c) h.setAttribute('aria-valuenow', String(Math.round(c.getBoundingClientRect().width)));
}
const handleColumn = h =>
  h.dataset.k === 'nav-w'
    ? $('#side')
    : h.dataset.col === 'last'
      ? h.parentElement.lastElementChild.previousElementSibling
      : h.parentElement.firstElementChild;
/* the size a handle's drag or key asks for, kept inside its limits and the room in the pane (an editor keeps 360 px) */
function setHandleSize(h, v) {
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
    L = LAYOUT_LIMITS[h.dataset.k];
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
addEventListener('load', () => {
  const nav = document.createElement('div');
  nav.className = 'lay-h lay-nav';
  nav.dataset.k = 'nav-w';
  $('#studio').appendChild(nav);
  handleLabel(nav);
  applyLayout();
  /* follow the Studio: each section drawn gets its sizes and handles */
  const r0 = render;
  setRender(function () {
    r0.apply(this, arguments);
    applyLayout();
    $$('.pane').forEach(mountHandles);
  });
});
