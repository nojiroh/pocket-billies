'use strict';
/* ================= POCKET BILLIES STUDIO · viewport =================
   alpha 0.4.1: every 3D preview (Walk scenes, Engine, Battle preview) gets the same controls: a bar with zoom, turn,
   reset and a bigger view, the plain mouse wheel zooms, the right mouse button (or Q/E) turns all the way round, and
   W A S D or the arrow keys walk while the pointer is over the preview. Keys over the preview never reach the map tools. */
const VP = { hover: false, big: null };
if (typeof dioMount === 'function') {
  const _dm = dioMount;
  dioMount = function (cv, id, o = {}) {
    const k0 = o.keys;
    o = Object.assign({}, o, { freeCam: true, keys: () => VP.hover || !!(k0 && k0()) });
    return _dm(cv, id, o);
  };
}
const vpTurn = a => {
  if (typeof DGL === 'undefined') return;
  let y = DGL.yawT + a;
  if (y > Math.PI) {
    y -= 2 * Math.PI;
    DGL.yaw -= 2 * Math.PI;
  } else if (y < -Math.PI) {
    y += 2 * Math.PI;
    DGL.yaw += 2 * Math.PI;
  }
  DGL.yawT = y;
};
const vpZoom = k => {
  if (typeof DGL !== 'undefined') DGL.zoomT = clamp(DGL.zoomT * k, 0.3, 3.2);
};
function vpBig(el) {
  const on = !el.classList.contains('vp-big');
  $$('.sc-pv.vp-big').forEach(e => e.classList.remove('vp-big'));
  if (on) el.classList.add('vp-big');
  VP.big = on ? el : null;
  document.body.classList.toggle('vp-has-big', on);
  const b = el.querySelector('[data-vp="big"]');
  if (b) {
    b.textContent = on ? '⤡' : '⤢';
    b.title = on ? 'Back to the normal size (Esc)' : 'Bigger view (Esc to go back)';
  }
  setTimeout(() => dispatchEvent(new Event('resize')), 30);
}
function vpAttach(el) {
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
    if (a === 'in') vpZoom(1 / 1.25);
    else if (a === 'out') vpZoom(1.25);
    else if (a === 'left') vpTurn(-Math.PI / 4);
    else if (a === 'right') vpTurn(Math.PI / 4);
    else if (a === 'reset' && typeof DGL !== 'undefined') {
      DGL.yawT = 0;
      DGL.zoomT = 1;
    } else if (a === 'big') vpBig(el);
  });
  bar.addEventListener('pointerdown', ev => ev.stopPropagation());
  el.addEventListener('pointerenter', () => {
    VP.hover = true;
  });
  el.addEventListener('pointerleave', () => {
    VP.hover = false;
  });
} /* the wheel itself is the game's own handler, which zooms without Ctrl in a free-camera preview */
function vpScan() {
  $$('.sc-pv').forEach(vpAttach);
  if (VP.big && !document.body.contains(VP.big)) {
    VP.big = null;
    document.body.classList.remove('vp-has-big');
  }
  if (!$('.sc-pv')) VP.hover = false;
}
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && VP.big && !$('#dlg').innerHTML && !$('#modal').innerHTML) vpBig(VP.big);
});
addEventListener('load', () => {
  const m = $('#main');
  if (m) new MutationObserver(() => vpScan()).observe(m, { childList: true, subtree: true });
  vpScan();
});
