'use strict';
/* ================= THE STUDIO'S WATER TOOLS (water track WA-9, lane G) =================
   Generate card (Walk scenes → Generate…), on the "From above" map: a river brush (click its points from the source to
   the mouth, double-click to end), a waterfall placer (click its lip on water and drag the way it falls; width, drop,
   pool, climb) and a water-kind painter (drag a rectangle). They write the draft's dials, `params.hand`
   (logic/water-gen.js waterGenHand), so every remake of the draft (a dial, a new seed, a part's reroll) makes them
   again: a hand river is an extra river with its bed carved as the generated one's, a hand fall a `falls` entry with
   its pool, a hand kind a `waters` rectangle laid last. The 3D preview and the map redraw as you edit (the live
   preview); "Look at it" puts the walker beside the one picked. Added as a scene, they stay in its `gen`.
   Map editor (Walk scenes → Kinds of water, Q): the painter's Rivers and Falls modes edit a saved scene's `streams`
   and `falls` directly; "Carve the bed" makes a river's bed again from its line (waterGenSceneRiver), one undo step.
   The hub island is never written to (its fall waits for the hub track's HB-4b). */
/** the Generate card's tool, the kind it paints, the river being drawn, what is picked and the drag under way */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { waterGenSceneRiver, waterGenSegDist } from '../../game/js/logic/water-gen.js';
import { walkView } from '../../game/js/walk-view.js';
import { escapeHtml } from './game-stand-ins.js';
import { groundLockRefusal } from '../../game/js/logic/hub-island.js';
import { ACTIONS, ask, render, studioState, toast } from './studio-app.js';
import {
  PAINTED_WATER_KINDS,
  currentMap,
  drawEditorMap,
  mapEditor,
  waterToolRefusal,
  watersChanged,
} from './map-editor.js';
import { genDrawMap, genSoon, mapGen } from './map-generate.js';
/* eslint-disable no-func-assign */
expose({
  WATER_TOOLS_GEN: [() => WATER_TOOLS_GEN],
  WATER_TOOLS_LIST: [() => WATER_TOOLS_LIST],
  WATER_TOOLS_MOUTH: [() => WATER_TOOLS_MOUTH],
  WATER_TOOLS_SRC: [() => WATER_TOOLS_SRC],
  waterToolsBarRefresh: [() => waterToolsBarRefresh, v => (waterToolsBarRefresh = v)],
  waterToolsChanged: [() => waterToolsChanged, v => (waterToolsChanged = v)],
  waterToolsDrawHand: [() => waterToolsDrawHand, v => (waterToolsDrawHand = v)],
  waterToolsDryNear: [() => waterToolsDryNear, v => (waterToolsDryNear = v)],
  waterToolsFallDir: [() => waterToolsFallDir, v => (waterToolsFallDir = v)],
  waterToolsFallMade: [() => waterToolsFallMade, v => (waterToolsFallMade = v)],
  waterToolsGenBarHTML: [
    () => waterToolsGenBarHTML,
    v => ((waterToolsGenBarHTML = v), provide({ waterToolsGenBarHTML })),
  ],
  waterToolsGenDown: [() => waterToolsGenDown, v => (waterToolsGenDown = v)],
  waterToolsGenMap: [() => waterToolsGenMap, v => ((waterToolsGenMap = v), provide({ waterToolsGenMap }))],
  waterToolsGenMove: [() => waterToolsGenMove, v => (waterToolsGenMove = v)],
  waterToolsHand: [() => waterToolsHand, v => (waterToolsHand = v)],
  waterToolsHit: [() => waterToolsHit, v => (waterToolsHit = v)],
  waterToolsPicked: [() => waterToolsPicked, v => (waterToolsPicked = v)],
  waterToolsRound: [() => waterToolsRound],
  waterToolsSceneBarHTML: [
    () => waterToolsSceneBarHTML,
    v => ((waterToolsSceneBarHTML = v), provide({ waterToolsSceneBarHTML })),
  ],
  waterToolsSceneBarRefresh: [() => waterToolsSceneBarRefresh, v => (waterToolsSceneBarRefresh = v)],
  waterToolsSceneClick: [() => waterToolsSceneClick, v => (waterToolsSceneClick = v)],
  waterToolsSceneDown: [() => waterToolsSceneDown, v => ((waterToolsSceneDown = v), provide({ waterToolsSceneDown }))],
  waterToolsSceneDraw: [() => waterToolsSceneDraw, v => ((waterToolsSceneDraw = v), provide({ waterToolsSceneDraw }))],
  waterToolsSceneFinish: [() => waterToolsSceneFinish, v => (waterToolsSceneFinish = v)],
  waterToolsSceneMove: [() => waterToolsSceneMove, v => ((waterToolsSceneMove = v), provide({ waterToolsSceneMove }))],
  waterToolsScenePicked: [() => waterToolsScenePicked, v => (waterToolsScenePicked = v)],
  waterToolsSceneRefresh: [() => waterToolsSceneRefresh, v => (waterToolsSceneRefresh = v)],
  waterToolsSceneState: [() => waterToolsSceneState],
  waterToolsSceneUp: [() => waterToolsSceneUp, v => ((waterToolsSceneUp = v), provide({ waterToolsSceneUp }))],
  waterToolsSelHTML: [() => waterToolsSelHTML, v => (waterToolsSelHTML = v)],
  waterToolsSelRefresh: [() => waterToolsSelRefresh, v => (waterToolsSelRefresh = v)],
  waterToolsSnapSide: [() => waterToolsSnapSide, v => (waterToolsSnapSide = v)],
  waterToolsState: [() => waterToolsState],
  waterToolsStatus: [() => waterToolsStatus, v => (waterToolsStatus = v)],
  waterToolsTidy: [() => waterToolsTidy, v => (waterToolsTidy = v)],
});
/* eslint-enable no-func-assign */
provide({
  waterToolsGenBarHTML,
  waterToolsGenMap,
  waterToolsSceneBarHTML,
  waterToolsSceneDown,
  waterToolsSceneDraw,
  waterToolsSceneMove,
  waterToolsSceneUp,
});
/* to-module: end */
const waterToolsState = {
  tool: '',
  kind: 'hotspring',
  draw: /** @type {number[][] | null} */ (null),
  /** @type {{ t: string, i: number } | null} */
  sel: null,
  /** @type {any} */
  drag: null,
  /* the last click (a double-click ends a river: two clicks on one spot within 350 ms) */
  last: 0,
};
const WATER_TOOLS_GEN = [
  ['', 'Walk', 'Click the map to walk there in the preview.'],
  [
    'river',
    'River brush',
    'Click from the source to the mouth, double-click to end (Esc: cancel). Start or end by a side for a river that crosses it, in water for a lake or the sea; else a spring and a pool. Drag a point to move it; Alt-click one to remove it. The river is an extra river, its bed carved as the generated one is.',
  ],
  [
    'fall',
    'Waterfall',
    'Click its lip on a river and drag the way it falls. Drag a lip to move it; Alt-click one to remove it. It replaces a generated fall within 2 m.',
  ],
  [
    'kind',
    'Water kinds',
    'Drag a rectangle over the water for the kind picked; Alt-click one to remove it. Laid last, so it wins.',
  ],
];
/* ---------- the dials' hand water ---------- */
function waterToolsHand() {
  const P = mapGen.params;
  return P.hand || (P.hand = {});
}
/** empty lists dropped, so a draft without hand water keeps the dials it always had */
function waterToolsTidy() {
  const H = mapGen.params.hand;
  if (!H) return;
  for (const k of ['rivers', 'falls', 'waters']) if (H[k] && !H[k].length) delete H[k];
  if (!Object.keys(H).length) delete mapGen.params.hand;
}
const waterToolsRound = v => Math.round(v * 100) / 100;
const WATER_TOOLS_LIST = { river: 'rivers', fall: 'falls', kind: 'waters' };
function waterToolsPicked() {
  const S = waterToolsState.sel;
  if (!S) return null;
  const it = ((mapGen.params.hand || {})[WATER_TOOLS_LIST[S.t]] || [])[S.i];
  if (!it) waterToolsState.sel = null;
  return it || null;
}
/** a point on a side within 2 m of it moved onto it, so the river crosses that side */
function waterToolsSnapSide(d, p) {
  const [x, z] = p,
    m = Math.min(x, z, d.w - x, d.h - z);
  if (m >= 2) return p;
  if (m === x) return [0, z];
  if (m === z) return [x, 0];
  if (m === d.w - x) return [d.w, z];
  return [x, d.h];
}
/** the way a fall placed at (x, z) faces at first: along the nearest stream's line, else south */
function waterToolsFallDir(d, x, z) {
  let best = 3,
    dir = [0, -1];
  for (const st of d.streams || [])
    for (let i = 1; i < st.pts.length; i++) {
      const a = st.pts[i - 1],
        b = st.pts[i],
        dd = waterGenSegDist(x, z, a, b),
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dd < best && L > 0) {
        best = dd;
        dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      }
    }
  return dir.map(waterToolsRound);
}
/** the nearest dry, walkable cell's middle to (x, z), for the preview's walker */
function waterToolsDryNear(d, x, z) {
  for (let r = 0; r < 20; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const i = Math.floor(x) + dx,
          j = Math.floor(z) + dz;
        if (i < 0 || j < 0 || i >= d.w || j >= d.h) continue;
        if (!'wd'.includes(d.tiles[d.h - 1 - j][i])) return [i + 0.5, j + 0.5];
      }
  return d.hub;
}
/** what the draft made of the hand fall picked: its entry (pool and climb as made), or null */
function waterToolsFallMade(f) {
  return ((mapGen.draft || {}).falls || []).find(e => Math.hypot(e.x - f.x, e.z - f.z) < 0.05) || null;
}
/* ---------- the bar over the map ---------- */
function waterToolsGenBarHTML() {
  const S = waterToolsState,
    H = mapGen.params.hand || {},
    n = k => (H[k] || []).length,
    T = WATER_TOOLS_GEN.find(t => t[0] === S.tool) || WATER_TOOLS_GEN[0],
    kinds =
      S.tool === 'kind'
        ? `<div class="seg-row">${PAINTED_WATER_KINDS.map(([k, nm, c]) => `<button class="seg ${S.kind === k ? 'on' : ''}" data-act="wtKind" data-k="${k}"><span class="sc-swatch" style="background:${c}"></span>${escapeHtml(nm)}</button>`).join('')}</div>`
        : '',
    /* there all the while the brush is picked, so the map never moves under the pointer */
    drawing =
      S.tool === 'river'
        ? ` <button class="btn sm primary" data-act="wtFinish" ${S.draw ? '' : 'disabled'}>End the river${S.draw ? ` (${S.draw.length} points)` : ''}</button><button class="btn sm subtle" data-act="wtCancel" ${S.draw ? '' : 'disabled'}>Cancel</button>`
        : '',
    any = n('rivers') + n('falls') + n('waters');
  return `<div class="gen-water"><div class="seg-row">${WATER_TOOLS_GEN.map(([k, nm]) => `<button class="seg ${S.tool === k ? 'on' : ''}" data-act="wtTool" data-k="${k}">${escapeHtml(nm)}</button>`).join('')}${drawing}${any ? `<button class="btn sm subtle" data-act="wtClear" title="Remove every hand river, fall and kind from the dials">Clear hand water (${n('rivers')} rivers, ${n('falls')} falls, ${n('waters')} kinds)</button>` : ''}</div>${kinds}<p class="help">${escapeHtml(T[2])}</p><div id="wtSel">${waterToolsSelHTML()}</div></div>`;
}
/** the picked river, fall or kind: its fields, what the draft made of it, Look at it and Remove */
function waterToolsSelHTML() {
  const S = waterToolsState,
    it = waterToolsPicked();
  if (!it || !S.sel) return '';
  const num = (f, label, v, min, max, step, title) =>
      `<label class="mp-size" title="${escapeHtml(title)}"><span>${escapeHtml(label)}</span><input type="number" data-wt="${f}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`,
    tail = `<button class="btn sm subtle" data-act="wtLook">Look at it</button><button class="btn sm subtle" data-act="wtDel">Remove</button>`;
  if (S.sel.t === 'river')
    return `<div class="seg-row"><b>Hand river ${S.sel.i + 1}</b>${num('w', 'Width at the mouth (m, 0: the dial’s)', it.w || 0, 0, 8, 0.1, 'Its width where it ends; it narrows upstream')}${tail}</div><p class="help" id="wtStatus">${escapeHtml(waterToolsStatus())}</p>`;
  if (S.sel.t === 'fall')
    return `<div class="seg-row"><b>Hand fall ${S.sel.i + 1}</b>${num('w', 'Width (m)', it.w, 0.5, 12, 0.1, 'Across the lip')}${num('h', 'Drop (m, 0: from the ground)', it.h || 0, 0, 15, 0.1, 'How far it falls; 0 measures the ground')}${num('pool', 'Pool (m)', it.pool || 0, 0, 4, 0.1, 'The plunge pool’s radius; 0 none')}<label class="eng-chk"><input type="checkbox" data-wt="climb" ${it.climb ? 'checked' : ''}><span>Climbed (Waterfall)</span></label><label class="mp-size"><span>Kind at the lip</span><select data-wt="k"><option value="">Stream</option>${PAINTED_WATER_KINDS.filter(
      w => w[0] !== 'stream'
    )
      .map(([k, nm]) => `<option value="${k}" ${it.k === k ? 'selected' : ''}>${escapeHtml(nm)}</option>`)
      .join('')}</select></label>${tail}</div><p class="help" id="wtStatus">${escapeHtml(waterToolsStatus())}</p>`;
  return `<div class="seg-row"><b>Hand kind ${S.sel.i + 1}</b><label class="mp-size"><span>Kind</span><select data-wt="k">${PAINTED_WATER_KINDS.map(([k, nm]) => `<option value="${k}" ${it.k === k ? 'selected' : ''}>${escapeHtml(nm)}</option>`).join('')}</select></label>${tail}</div>`;
}
/** what the draft made of the river or fall picked, in words */
function waterToolsStatus() {
  const S = waterToolsState,
    it = waterToolsPicked(),
    d = mapGen.draft;
  if (!it || !S.sel || !d) return '';
  if (S.sel.t === 'river') {
    const a = it.pts[0],
      b = it.pts[it.pts.length - 1],
      st = (d.streams || []).find(
        q =>
          Math.hypot(q.pts[0][0] - a[0], q.pts[0][1] - a[1]) < 1 &&
          Math.hypot(q.pts[q.pts.length - 1][0] - b[0], q.pts[q.pts.length - 1][1] - b[1]) < 1
      );
    if (!st) return 'Not made (see the notes under the preview).';
    const len = st.pts.reduce(
      (s, p, i) => (i ? s + Math.hypot(p[0] - st.pts[i - 1][0], p[1] - st.pts[i - 1][1]) : 0),
      0
    );
    return `From a ${st.src} to a ${st.mouth}, ${Math.round(len)} m, ${st.w[0]}-${st.w[st.w.length - 1]} m wide${st.rapids ? `, ${st.rapids.length} stretch(es) of rapids` : ''}.`;
  }
  if (S.sel.t === 'fall') {
    const e = waterToolsFallMade(it);
    if (!e) return 'Not made (see the notes under the preview).';
    const lip = (d.tiles[d.h - 1 - Math.floor(e.z - e.dir[1] * 0.3)] || '')[Math.floor(e.x - e.dir[0] * 0.3)];
    const out = [`Drops ${e.h} m`];
    if (!'wd'.includes(lip || '')) out.push('its lip is not on water');
    if (it.pool) out.push(e.pool ? `its pool ${e.pool} m` : 'no room for its pool');
    if (it.climb)
      out.push(
        e.climb ? 'climbed with Waterfall' : 'not climbed: it needs 2 m, a pool, and its top and foot walked to'
      );
    return out.join('; ') + '.';
  }
  return '';
}
/* ---------- the map: the overlay and the tools' pointer ---------- */
/**
 * map-generate.js genDrawMap: the hand water drawn over the map, and with a tool picked the map's pointer is the
 * tool's (true: the map's own click-to-walk is off)
 * @param {HTMLCanvasElement} cv @param {any} d the draft @param {number} k pixels a metre
 */
function waterToolsGenMap(cv, d, k) {
  const x = cv.getContext('2d'),
    S = waterToolsState,
    H = mapGen.params.hand || {},
    on = !!S.tool,
    px = p => [p[0] * k, (d.h - p[1]) * k];
  if (x) waterToolsDrawHand(x, H, px, k, on, S.sel, S.draw, (S.drag || {}).k === 'rect' ? S.drag : null);
  const st = document.getElementById('wtStatus');
  if (st) st.textContent = waterToolsStatus();
  if (!on) {
    cv.onpointerdown = cv.onpointermove = cv.onpointerup = cv.ondblclick = null;
    cv.style.cursor = '';
    return false;
  }
  cv.style.cursor = 'crosshair';
  cv.onclick = null;
  const at = ev => {
    const R = cv.getBoundingClientRect();
    return [
      waterToolsRound(((ev.clientX - R.left) / R.width) * d.w),
      waterToolsRound(d.h - ((ev.clientY - R.top) / R.height) * d.h),
    ];
  };
  cv.onpointerdown = ev => {
    cv.setPointerCapture(ev.pointerId);
    waterToolsGenDown(d, at(ev), ev, k);
    genDrawMap();
  };
  cv.onpointermove = ev => {
    if (!S.drag) return;
    waterToolsGenMove(at(ev));
    genDrawMap();
  };
  cv.ondblclick = () => {
    if (S.tool === 'river' && S.draw) ACTIONS.wtFinish();
  };
  /* the bar is drawn again when the pointer is let go (above the map, it would move the map under a drag) */
  cv.onpointerup = () => {
    const D = S.drag;
    S.drag = null;
    if (!D) return void waterToolsBarRefresh();
    if (D.k === 'rect') {
      const x0 = Math.round(Math.min(D.a[0], D.b[0]) * 2) / 2,
        x1 = Math.round(Math.max(D.a[0], D.b[0]) * 2) / 2,
        z0 = Math.round(Math.min(D.a[1], D.b[1]) * 2) / 2,
        z1 = Math.round(Math.max(D.a[1], D.b[1]) * 2) / 2;
      if (x1 - x0 >= 0.5 && z1 - z0 >= 0.5) {
        const W = waterToolsHand().waters || (waterToolsHand().waters = []);
        W.push({ x: x0, z: z0, w: x1 - x0, h: z1 - z0, k: S.kind });
        S.sel = { t: 'kind', i: W.length - 1 };
        waterToolsChanged(true);
      } else genDrawMap();
      return;
    }
    if (D.moved || D.made) waterToolsChanged(true);
    else waterToolsBarRefresh();
  };
  return true;
}
/** a hand point, lip or rectangle under p: { t, i, n } */
function waterToolsHit(H, p, k) {
  const near = Math.max(1, 8 / k);
  if (waterToolsState.tool === 'river')
    for (let i = (H.rivers || []).length - 1; i >= 0; i--)
      for (let n = 0; n < H.rivers[i].pts.length; n++) {
        const q = H.rivers[i].pts[n];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < near) return { t: 'river', i, n };
      }
  if (waterToolsState.tool === 'fall')
    for (let i = (H.falls || []).length - 1; i >= 0; i--) {
      const f = H.falls[i];
      if (Math.hypot(f.x - p[0], f.z - p[1]) < near) return { t: 'fall', i, n: 0 };
    }
  if (waterToolsState.tool === 'kind')
    for (let i = (H.waters || []).length - 1; i >= 0; i--) {
      const r = H.waters[i];
      if (p[0] >= r.x && p[1] >= r.z && p[0] < r.x + r.w && p[1] < r.z + r.h) return { t: 'kind', i, n: 0 };
    }
  return null;
}
function waterToolsGenDown(d, p, ev, k) {
  const S = waterToolsState,
    H = mapGen.params.hand || {},
    hit = waterToolsHit(H, p, k),
    now = performance.now(),
    prev = S.draw && S.draw[S.draw.length - 1],
    q = waterToolsSnapSide(d, p),
    double = now - S.last < 350 && !!prev && Math.hypot(prev[0] - q[0], prev[1] - q[1]) < Math.max(1, 8 / k);
  S.last = now;
  if (S.tool === 'river' && S.draw) {
    if (double) return void ACTIONS.wtFinish();
    S.draw.push(waterToolsSnapSide(d, p));
    return;
  }
  if (hit && (ev.altKey || ev.button === 2)) {
    const L = H[WATER_TOOLS_LIST[hit.t]];
    if (hit.t === 'river' && L[hit.i].pts.length > 2) L[hit.i].pts.splice(hit.n, 1);
    else L.splice(hit.i, 1);
    S.sel = null;
    return void waterToolsChanged(true);
  }
  if (hit) {
    S.sel = { t: hit.t, i: hit.i };
    if (hit.t !== 'kind') S.drag = { k: hit.t, i: hit.i, n: hit.n };
    return;
  }
  if (ev.altKey) return;
  if (S.tool === 'river') {
    S.draw = [waterToolsSnapSide(d, p)];
    S.sel = null;
    return;
  }
  if (S.tool === 'fall') {
    const F = waterToolsHand().falls || (waterToolsHand().falls = []);
    F.push({ x: p[0], z: p[1], dir: waterToolsFallDir(d, p[0], p[1]), w: 2, pool: 2, climb: 0 });
    S.sel = { t: 'fall', i: F.length - 1 };
    S.drag = { k: 'aim', i: F.length - 1, made: true };
    return;
  }
  if (S.tool === 'kind') S.drag = { k: 'rect', a: p, b: p };
}
function waterToolsGenMove(p) {
  const S = waterToolsState,
    D = S.drag,
    H = mapGen.params.hand || {};
  if (D.k === 'rect') D.b = p;
  else if (D.k === 'river') {
    const R = (H.rivers || [])[D.i];
    if (R) R.pts[D.n] = waterToolsSnapSide(mapGen.draft, p);
  } else if (D.k === 'fall') {
    const f = (H.falls || [])[D.i];
    if (f) [f.x, f.z] = p;
  } else if (D.k === 'aim') {
    const f = (H.falls || [])[D.i],
      L = f ? Math.hypot(p[0] - f.x, p[1] - f.z) : 0;
    if (f && L > 0.5) f.dir = [waterToolsRound((p[0] - f.x) / L), waterToolsRound((p[1] - f.z) / L)];
  }
  D.moved = true;
}
/**
 * the hand water drawn on a map (the Generate card's and the map editor's): rivers (their points when the tool is
 * on), falls (the lip across, the way it falls, its pool), kinds (outlined)
 */
function waterToolsDrawHand(x, H, px, k, on, sel, draw, rect) {
  const pick = (t, i) => !!sel && sel.t === t && sel.i === i;
  x.save();
  x.lineCap = x.lineJoin = 'round';
  (H.waters || []).forEach((r, i) => {
    const c = (PAINTED_WATER_KINDS.find(w => w[0] === r.k) || PAINTED_WATER_KINDS[0])[2],
      [X, Y] = px([r.x, r.z + r.h]);
    x.strokeStyle = pick('kind', i) ? '#ffd84a' : c;
    x.lineWidth = on ? 2 : 1;
    x.setLineDash([4, 3]);
    x.strokeRect(X, Y, r.w * k, r.h * k);
    x.setLineDash([]);
    if (on) {
      x.font = '700 10px system-ui';
      x.fillStyle = '#fff';
      x.fillText(r.k, X + 3, Y + 11);
    }
  });
  const line = (pts, col, wd, dash) => {
    x.strokeStyle = col;
    x.lineWidth = wd;
    x.setLineDash(dash);
    x.beginPath();
    pts.forEach((p, n) => (n ? x.lineTo(...px(p)) : x.moveTo(...px(p))));
    x.stroke();
    x.setLineDash([]);
  };
  (H.rivers || []).forEach((R, i) => {
    line(R.pts, 'rgba(0,0,0,.55)', Math.max(3, k * 0.9), []);
    line(R.pts, pick('river', i) ? '#ffd84a' : '#5fe0ff', Math.max(2, k * 0.5), []);
    if (on)
      for (const p of R.pts) {
        const [X, Y] = px(p);
        x.fillStyle = '#fff';
        x.fillRect(X - 3, Y - 3, 6, 6);
      }
  });
  if (draw && draw.length) line(draw, '#fff', 2, [5, 4]);
  (H.falls || []).forEach((f, i) => {
    const [X, Y] = px([f.x, f.z]),
      [dx, dz] = f.dir,
      nx = -dz,
      nz = dx,
      half = (f.w / 2) * k,
      col = pick('fall', i) ? '#ffd84a' : '#ffffff';
    x.strokeStyle = 'rgba(0,0,0,.6)';
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(X - nx * half, Y + nz * half);
    x.lineTo(X + nx * half, Y - nz * half);
    x.stroke();
    x.strokeStyle = col;
    x.lineWidth = 3;
    x.stroke();
    /* the way it falls */
    const L = Math.max(10, k * 1.6);
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(X, Y);
    x.lineTo(X + dx * L, Y - dz * L);
    x.lineTo(X + dx * L * 0.7 + nx * L * 0.2, Y - dz * L * 0.7 - nz * L * 0.2);
    x.moveTo(X + dx * L, Y - dz * L);
    x.lineTo(X + dx * L * 0.7 - nx * L * 0.2, Y - dz * L * 0.7 + nz * L * 0.2);
    x.stroke();
    if (f.pool > 0) {
      const c = px([f.x + dx * (f.pool + 0.25), f.z + dz * (f.pool + 0.25)]);
      x.setLineDash([4, 3]);
      x.beginPath();
      x.arc(c[0], c[1], f.pool * k, 0, Math.PI * 2);
      x.stroke();
      x.setLineDash([]);
    }
    if (f.climb) {
      x.font = '700 12px system-ui';
      x.fillStyle = col;
      x.fillText('⇡', X + nx * half + 3, Y - nz * half);
    }
  });
  if (rect) {
    const X = Math.min(rect.a[0], rect.b[0]),
      Z = Math.max(rect.a[1], rect.b[1]),
      [PX, PY] = px([X, Z]);
    x.strokeStyle = '#fff';
    x.lineWidth = 2;
    x.setLineDash([6, 4]);
    x.strokeRect(PX, PY, Math.abs(rect.b[0] - rect.a[0]) * k, Math.abs(rect.b[1] - rect.a[1]) * k);
    x.setLineDash([]);
  }
  x.restore();
}
/* ---------- refreshing ---------- */
/** the dials changed: the draft made again (the live preview); bar too when something was added or removed */
function waterToolsChanged(bar) {
  waterToolsTidy();
  if (bar) waterToolsBarRefresh();
  genSoon();
}
function waterToolsBarRefresh() {
  const el = document.querySelector('.gen-water');
  if (el) el.outerHTML = waterToolsGenBarHTML();
}
function waterToolsSelRefresh() {
  const el = document.getElementById('wtSel');
  if (el) el.innerHTML = waterToolsSelHTML();
  else waterToolsBarRefresh();
}
/* ---------- actions ---------- */
ACTIONS.wtTool = d => {
  waterToolsState.tool = d.k;
  waterToolsState.draw = null;
  waterToolsState.drag = null;
  if (!d.k) waterToolsState.sel = null;
  waterToolsBarRefresh();
  genDrawMap();
};
ACTIONS.wtKind = d => {
  waterToolsState.kind = d.k;
  const it = waterToolsPicked();
  if (it && waterToolsState.sel && waterToolsState.sel.t === 'kind') {
    it.k = d.k;
    waterToolsChanged(false);
  }
  waterToolsBarRefresh();
};
ACTIONS.wtFinish = () => {
  const S = waterToolsState,
    pts = [];
  for (const p of S.draw || [])
    if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.3) pts.push(p);
  S.draw = null;
  if (pts.length < 2) {
    toast('A river needs two points at least.');
    return void waterToolsBarRefresh();
  }
  const R = waterToolsHand().rivers || (waterToolsHand().rivers = []);
  R.push({ pts });
  S.sel = { t: 'river', i: R.length - 1 };
  waterToolsChanged(true);
};
ACTIONS.wtCancel = () => {
  waterToolsState.draw = null;
  waterToolsBarRefresh();
  genDrawMap();
};
ACTIONS.wtClear = async () => {
  if (!(await ask('Remove every hand river, waterfall and kind from the dials?', 'Remove'))) return;
  delete mapGen.params.hand;
  waterToolsState.sel = null;
  waterToolsChanged(true);
};
ACTIONS.wtDel = () => {
  const S = waterToolsState;
  if (!S.sel) return;
  (mapGen.params.hand[WATER_TOOLS_LIST[S.sel.t]] || []).splice(S.sel.i, 1);
  S.sel = null;
  waterToolsChanged(true);
};
ACTIONS.wtLook = () => {
  const S = waterToolsState,
    it = waterToolsPicked(),
    d = mapGen.draft;
  if (!it || !S.sel || !d) return;
  let p;
  if (S.sel.t === 'river') p = it.pts[Math.floor(it.pts.length / 2)];
  else if (S.sel.t === 'fall') p = [it.x + it.dir[0] * (it.pool * 2 + 2), it.z + it.dir[1] * (it.pool * 2 + 2)];
  else p = [it.x + it.w / 2, it.z - 1];
  mapGen.pvPos = waterToolsDryNear(d, p[0], p[1]);
  walkView.pl.fresh = true;
};
/* a picked item's fields (data-wt): written to the dials, the draft made again */
document.addEventListener('change', ev => {
  const t = /** @type {HTMLInputElement} */ (ev.target);
  if (!mapGen.on || !t || !t.dataset || !t.dataset.wt) return;
  const it = waterToolsPicked(),
    f = t.dataset.wt;
  if (!it) return;
  if (f === 'climb') it.climb = t.checked ? 1 : 0;
  else if (f === 'k') {
    if (t.value) it.k = t.value;
    else delete it.k;
  } else {
    const v = parseFloat(t.value);
    if (!Number.isFinite(v)) return;
    if (v > 0 || f === 'pool') it[f] = waterToolsRound(v);
    else delete it[f];
  }
  waterToolsChanged(false);
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || !mapGen.on || !waterToolsState.draw) return;
  ACTIONS.wtCancel();
});
/* ---------- the map editor: a saved scene's rivers (streams) and falls ---------- */
/* what is picked there and the river being drawn: { t: 'stream' | 'fall', i } */
const waterToolsSceneState = {
  /** @type {{ t: string, i: number } | null} */
  sel: null,
  draw: /** @type {number[][] | null} */ (null),
  last: 0,
};
const WATER_TOOLS_SRC = ['spring', 'edge', 'lake'];
const WATER_TOOLS_MOUTH = ['sea', 'lake', 'edge', 'pool'];
function waterToolsScenePicked(sc) {
  const S = waterToolsSceneState.sel;
  if (!S) return null;
  const it = ((S.t === 'stream' ? sc.streams : sc.falls) || [])[S.i];
  if (!it) waterToolsSceneState.sel = null;
  return it || null;
}
function waterToolsSceneBarHTML(sc, mode) {
  const S = waterToolsSceneState,
    it = waterToolsScenePicked(sc),
    num = (f, label, v, min, max, step) =>
      `<label class="mp-size"><span>${escapeHtml(label)}</span><input type="number" data-wts="${f}" min="${min}" max="${max}" step="${step}" value="${v ?? ''}"></label>`,
    sel = (f, label, list, v, none) =>
      `<label class="mp-size"><span>${escapeHtml(label)}</span><select data-wts="${f}"><option value="">${none}</option>${list.map(k => `<option ${v === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`;
  let body = '';
  if (mode === 'rivers') {
    body = `<p class="help">${(sc.streams || []).length} stream line(s). Click away from a line to draw a new one from its source to its mouth, double-click to end. Drag a point to move it; Alt-click one to remove it; click a line to pick it.</p><div class="seg-row"><button class="btn sm primary" data-act="wtsFinish" ${S.draw ? '' : 'disabled'}>End the stream${S.draw ? ` (${S.draw.length} points)` : ''}</button></div>`;
    if (it && S.sel && S.sel.t === 'stream')
      body += `<div class="seg-row"><b>Stream ${S.sel.i + 1}</b>${num('speed', 'Speed', it.speed, 0.1, 3, 0.05)}${num('wm', 'Width at the mouth (m)', it.w ? it.w[it.w.length - 1] : '', 1, 8, 0.1)}${sel('src', 'Source', WATER_TOOLS_SRC, it.src, '(none)')}${sel('mouth', 'Mouth', WATER_TOOLS_MOUTH, it.mouth, '(none)')}<button class="btn sm" data-act="wtsCarve" title="Its bed made again from its line, as the generator's rivers are (logic/water-gen.js): the level never rising, wider downstream, the banks eased. One undo step.">Carve the bed</button><button class="btn sm subtle" data-act="wtsDel">Remove</button></div>`;
  } else {
    body = `<p class="help">${(sc.falls || []).length} waterfall(s). Click a lip on water and drag the way it falls; drag a lip to move it; Alt-click one to remove it. An entry replaces the automatic sheets across its width.</p>`;
    if (it && S.sel && S.sel.t === 'fall') {
      const lip = (sc.tiles[sc.h - 1 - Math.floor(it.z - it.dir[1] * 0.3)] || '')[Math.floor(it.x - it.dir[0] * 0.3)];
      body += `<div class="seg-row"><b>Fall ${S.sel.i + 1}</b>${num('w', 'Width (m)', it.w, 0.5, 12, 0.1)}${num('h', 'Drop (m, empty: from the ground)', it.h, 0, 15, 0.1)}${num('pool', 'Pool (m)', it.pool || 0, 0, 4, 0.1)}<label class="eng-chk"><input type="checkbox" data-wts="climb" ${it.climb ? 'checked' : ''}><span>Climbed (Waterfall)</span></label>${sel(
        'k',
        'Kind at the lip',
        PAINTED_WATER_KINDS.map(w => w[0]).filter(k => k !== 'stream'),
        it.k,
        'stream'
      )}<button class="btn sm subtle" data-act="wtsDel">Remove</button></div>${'wd'.includes(lip || '') ? '' : '<p class="help warn">Its lip is not on water.</p>'}`;
    }
  }
  return `<div class="sc-hbar wt-scene">${body}</div>`;
}
function waterToolsSceneDraw(x, sc, Z, mode) {
  const px = p => [p[0] * Z, (sc.h - p[1]) * Z],
    S = waterToolsSceneState,
    sel = S.sel ? { t: S.sel.t === 'stream' ? 'river' : 'fall', i: S.sel.i } : null;
  waterToolsDrawHand(
    x,
    mode === 'rivers' ? { rivers: sc.streams || [] } : { falls: sc.falls || [] },
    px,
    Z,
    true,
    sel,
    S.draw,
    null
  );
}
function waterToolsSceneDown(sc, m, ev) {
  const S = waterToolsSceneState,
    mode = mapEditor.wmode,
    p = [waterToolsRound(m.x), waterToolsRound(m.z)],
    near = Math.max(0.5, 8 / mapEditor.zoom),
    now = performance.now(),
    prev = S.draw && S.draw[S.draw.length - 1],
    q = waterToolsSnapSide(sc, p),
    double = now - S.last < 350 && !!prev && Math.hypot(prev[0] - q[0], prev[1] - q[1]) < near;
  S.last = now;
  if (mode === 'rivers') {
    if (S.draw) {
      if (double) return void waterToolsSceneFinish(sc);
      S.draw.push(waterToolsSnapSide(sc, p));
      return void waterToolsSceneClick();
    }
    const L = sc.streams || [];
    for (let i = L.length - 1; i >= 0; i--)
      for (let n = 0; n < L[i].pts.length; n++)
        if (Math.hypot(L[i].pts[n][0] - p[0], L[i].pts[n][1] - p[1]) < near) {
          if (ev.altKey || ev.button === 2) {
            if (L[i].pts.length > 2) {
              L[i].pts.splice(n, 1);
              if (L[i].w) L[i].w.splice(n, 1);
            } else L.splice(i, 1);
            if (!L.length) delete sc.streams;
            S.sel = null;
            watersChanged();
            return void waterToolsSceneClick();
          }
          S.sel = { t: 'stream', i };
          mapEditor.drag = { k: 'wtpt', i, n };
          return void drawEditorMap();
        }
    for (let i = L.length - 1; i >= 0; i--)
      for (let n = 1; n < L[i].pts.length; n++)
        if (waterGenSegDist(p[0], p[1], L[i].pts[n - 1], L[i].pts[n]) < near) {
          S.sel = { t: 'stream', i };
          return void waterToolsSceneClick();
        }
    if (ev.altKey) return;
    S.draw = [waterToolsSnapSide(sc, p)];
    S.sel = null;
    return void waterToolsSceneClick();
  }
  const F = sc.falls || [];
  for (let i = F.length - 1; i >= 0; i--)
    if (Math.hypot(F[i].x - p[0], F[i].z - p[1]) < near) {
      if (ev.altKey || ev.button === 2) {
        F.splice(i, 1);
        if (!F.length) delete sc.falls;
        S.sel = null;
        watersChanged();
        return void waterToolsSceneClick();
      }
      S.sel = { t: 'fall', i };
      mapEditor.drag = { k: 'wtfall', i };
      return void drawEditorMap();
    }
  if (ev.altKey) return;
  const f = { x: p[0], z: p[1], dir: waterToolsFallDir(sc, p[0], p[1]), w: 1.6, pool: 0 };
  (sc.falls || (sc.falls = [])).push(f);
  S.sel = { t: 'fall', i: sc.falls.length - 1 };
  mapEditor.drag = { k: 'wtaim', i: sc.falls.length - 1, made: true };
  drawEditorMap();
}
/** a click with no drag: its bar is drawn again when the pointer is let go (waterToolsSceneUp) */
function waterToolsSceneClick() {
  mapEditor.drag = mapEditor.drag || { k: 'wtclick' };
  drawEditorMap();
}
function waterToolsSceneMove(sc, m, D) {
  const p = [waterToolsRound(m.x), waterToolsRound(m.z)];
  if (D.k === 'wtpt') {
    const st = (sc.streams || [])[D.i];
    if (st) st.pts[D.n] = waterToolsSnapSide(sc, p);
  } else if (D.k === 'wtfall') {
    const f = (sc.falls || [])[D.i];
    if (f) [f.x, f.z] = p;
  } else if (D.k === 'wtaim') {
    const f = (sc.falls || [])[D.i],
      L = f ? Math.hypot(p[0] - f.x, p[1] - f.z) : 0;
    if (f && L > 0.5) f.dir = [waterToolsRound((p[0] - f.x) / L), waterToolsRound((p[1] - f.z) / L)];
  }
  D.moved = true;
}
function waterToolsSceneUp(sc, D) {
  if (D.moved || D.made) waterToolsSceneRefresh();
  waterToolsSceneBarRefresh(sc);
}
/** the scene's water changed: the preview's water and ground made again, one undo step */
function waterToolsSceneRefresh() {
  walkView.gkey = '';
  watersChanged();
}
function waterToolsSceneFinish(sc) {
  const S = waterToolsSceneState,
    pts = [];
  for (const p of S.draw || [])
    if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.3) pts.push(p);
  S.draw = null;
  if (pts.length < 2) {
    toast('A stream needs two points at least.');
    return void waterToolsSceneBarRefresh(sc);
  }
  (sc.streams || (sc.streams = [])).push({ pts, speed: 0.8 });
  S.sel = { t: 'stream', i: sc.streams.length - 1 };
  waterToolsSceneRefresh();
  waterToolsSceneBarRefresh(sc);
  toast('Stream line added. "Carve the bed" makes its water and bed from the line.');
}
/** the Rivers or Falls bar drawn again in place (a redraw of the whole pane would drop the map under the pointer) */
function waterToolsSceneBarRefresh(sc) {
  const el = document.querySelector('.wt-scene');
  if (el) el.outerHTML = waterToolsSceneBarHTML(sc, mapEditor.wmode);
  drawEditorMap();
}
ACTIONS.wtsFinish = () => {
  const sc = currentMap();
  if (sc && waterToolsSceneState.draw && !waterToolRefusal(sc)) waterToolsSceneFinish(sc);
};
ACTIONS.wtsDel = () => {
  const sc = currentMap(),
    S = waterToolsSceneState;
  if (!sc || !S.sel || waterToolRefusal(sc)) return;
  const key = S.sel.t === 'stream' ? 'streams' : 'falls',
    L = sc[key] || [];
  L.splice(S.sel.i, 1);
  if (!L.length) delete sc[key];
  S.sel = null;
  waterToolsSceneRefresh();
  render();
};
ACTIONS.wtsCarve = () => {
  const sc = currentMap(),
    S = waterToolsSceneState,
    st = waterToolsScenePicked(sc);
  if (!sc || !st || !S.sel) return;
  if (waterToolRefusal(sc)) return void toast(waterToolRefusal(sc));
  if (groundLockRefusal(sc)) return void toast(groundLockRefusal(sc));
  const B = ((studioState.D.biomes || {})[sc.biome] || {}).ground || {},
    r = waterGenSceneRiver(sc, st.pts, { w: st.w ? st.w[st.w.length - 1] : 2.4, bank: B.bank || 's' });
  if (!r) return void toast('The line is under 2 m.');
  sc.tiles = r.tiles;
  sc.heights = r.heights;
  sc.streams[S.sel.i] = { ...r.stream, speed: st.speed ?? r.stream.speed };
  waterToolsSceneRefresh();
  render();
  toast(`Carved: from a ${r.stream.src} to a ${r.stream.mouth}${r.stream.rapids ? ', with rapids' : ''}.`);
};
/* a picked stream's or fall's fields (data-wts): written to the scene, one undo step each */
document.addEventListener('change', ev => {
  const t = /** @type {HTMLInputElement} */ (ev.target);
  if (!t || !t.dataset || !t.dataset.wts) return;
  const sc = currentMap(),
    it = sc && waterToolsScenePicked(sc),
    f = t.dataset.wts;
  if (!it || waterToolRefusal(sc)) return;
  if (f === 'climb') {
    if (t.checked) it.climb = 1;
    else delete it.climb;
  } else if (f === 'k' || f === 'src' || f === 'mouth') {
    if (t.value) it[f] = t.value;
    else delete it[f];
  } else {
    const v = parseFloat(t.value);
    if (f === 'wm') {
      if (Number.isFinite(v) && v > 0) {
        const w0 = it.w ? it.w[it.w.length - 1] : v;
        it.w = it.pts.map((_, i) => waterToolsRound(it.w ? (it.w[i] * v) / w0 : v));
      } else delete it.w;
    } else if (Number.isFinite(v) && (v > 0 || f === 'pool')) it[f] = waterToolsRound(v);
    else if (f === 'h') delete it.h;
    else return;
  }
  waterToolsSceneRefresh();
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || !waterToolsSceneState.draw) return;
  waterToolsSceneState.draw = null;
  drawEditorMap();
});
document.addEventListener('dblclick', ev => {
  const t = /** @type {HTMLElement} */ (ev.target);
  if (t && t.id === 'scMap' && mapEditor.tool === 'water' && waterToolsSceneState.draw) ACTIONS.wtsFinish();
});
