'use strict';
/* ================= POCKET BILLIES STUDIO · viewport =================
   alpha 0.4.1: every 3D preview (Walk scenes, Engine, Battle preview) gets the same controls: a bar with zoom, turn,
   reset and a bigger view, the plain mouse wheel zooms, the right mouse button (or Q/E) turns all the way round, and
   W A S D or the arrow keys walk while the pointer is over the preview. Keys over the preview never reach the map tools. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { mountWalkView, setMountWalkView } from '../../game/js/walk-view-gl.js';
/* eslint-disable no-func-assign */
expose({
  attachViewportBar: [() => attachViewportBar, v => (attachViewportBar = v)],
  previewViewport: [() => previewViewport],
  scanViewports: [() => scanViewports, v => (scanViewports = v)],
  toggleBigViewport: [() => toggleBigViewport, v => (toggleBigViewport = v)],
  turnViewport: [() => turnViewport],
  zoomViewport: [() => zoomViewport],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const previewViewport = { hover: false, big: null };
provide({ previewViewport }); /* to-module */
if (typeof mountWalkView === 'function') {
  const _dm = mountWalkView;
  setMountWalkView(function (cv, id, o = {}) {
    const k0 = o.keys;
    o = Object.assign({}, o, { freeCam: true, keys: () => previewViewport.hover || !!(k0 && k0()) });
    return _dm(cv, id, o);
  });
}
const turnViewport = a => {
  if (typeof walkRenderer === 'undefined') return;
  let y = walkRenderer.yawT + a;
  if (y > Math.PI) {
    y -= 2 * Math.PI;
    walkRenderer.yaw -= 2 * Math.PI;
  } else if (y < -Math.PI) {
    y += 2 * Math.PI;
    walkRenderer.yaw += 2 * Math.PI;
  }
  walkRenderer.yawT = y;
};
const zoomViewport = k => {
  if (typeof walkRenderer !== 'undefined') walkRenderer.zoomT = clamp(walkRenderer.zoomT * k, 0.3, 3.2);
};
function toggleBigViewport(el) {
  const on = !el.classList.contains('vp-big');
  $$('.sc-pv.vp-big').forEach(e => e.classList.remove('vp-big'));
  if (on) el.classList.add('vp-big');
  previewViewport.big = on ? el : null;
  document.body.classList.toggle('vp-has-big', on);
  const b = el.querySelector('[data-vp="big"]');
  if (b) {
    b.textContent = on ? '⤡' : '⤢';
    b.title = on ? 'Back to the normal size (Esc)' : 'Bigger view (Esc to go back)';
  }
  setTimeout(() => dispatchEvent(new Event('resize')), 30);
}
function attachViewportBar(el) {
  if (el._vp) return;
  el._vp = 1;
  const bar = document.createElement('div');
  bar.className = 'vp-bar';
  bar.innerHTML = `<button data-vp="out" title="Zoom out (wheel)">−</button><button data-vp="in" title="Zoom in (wheel)">+</button><span class="vp-sep"></span><button data-vp="left" title="Turn left (Q, or drag with the right mouse button)">⟲</button><button data-vp="right" title="Turn right (E)">⟳</button><button data-vp="reset" title="Straight on, normal zoom (R)">⌂</button><span class="vp-sep"></span><button data-vp="big" title="Bigger view (Esc to go back)">⤢</button>`;
  const hint = document.createElement('div');
  hint.className = 'vp-hint';
  hint.textContent = 'Click to walk · W A S D walk · wheel zoom · right-drag or Q/E turn';
  el.appendChild(bar);
  el.appendChild(hint);
  bar.addEventListener('click', ev => {
    const b = ev.target.closest('[data-vp]');
    if (!b) return;
    ev.stopPropagation();
    const a = b.dataset.vp;
    if (a === 'in') zoomViewport(1 / 1.25);
    else if (a === 'out') zoomViewport(1.25);
    else if (a === 'left') turnViewport(-Math.PI / 4);
    else if (a === 'right') turnViewport(Math.PI / 4);
    else if (a === 'reset' && typeof walkRenderer !== 'undefined') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    } else if (a === 'big') toggleBigViewport(el);
  });
  bar.addEventListener('pointerdown', ev => ev.stopPropagation());
  el.addEventListener('pointerenter', () => {
    previewViewport.hover = true;
  });
  el.addEventListener('pointerleave', () => {
    previewViewport.hover = false;
  });
} /* the wheel itself is the game's own handler, which zooms without Ctrl in a free-camera preview */
function scanViewports() {
  $$('.sc-pv').forEach(attachViewportBar);
  if (previewViewport.big && !document.body.contains(previewViewport.big)) {
    previewViewport.big = null;
    document.body.classList.remove('vp-has-big');
  }
  if (!$('.sc-pv')) previewViewport.hover = false;
}
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && previewViewport.big && !$('#dlg').innerHTML && !$('#modal').innerHTML)
    toggleBigViewport(previewViewport.big);
});
addEventListener('load', () => {
  const seen = new MutationObserver(() => scanViewports());
  $$('.pane').forEach(m => seen.observe(m, { childList: true, subtree: true }));
  scanViewports();
});
