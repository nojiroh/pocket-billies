'use strict';
/* ================= WALK SCENE TOOLS (v29) =================
   More ways to build a scene on the map:
   - Select several props: shift-drag a box around them (or shift-click), drag one to move them all, Ctrl/Cmd+C to
     copy, Ctrl/Cmd+V to paste where the mouse is, Delete to remove.
   - Building blocks: save a selection under a name, then stamp it anywhere (in any scene) with “Stamp a block”.
   - Scatter brush: drag to sprinkle the chosen prop (or its whole group) at a density you set; Alt-drag clears them.
   - Curved road: click points, double-click (or Enter) to lay the chosen ground along a smooth curve.
   - Smooth the path: turns the walker's path into a gentle curve.
   Hooks: scenes.js calls scxDown / scxMove / scxUp from the map's pointer events and scxDraw after drawing. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/bridge.js';
import { VP, provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { DIO } from '../../game/js/diorama.js';
import { esc } from './shims.js';
import { ACTS, ST, ask, changed, clone, commit, dialog, render, toast, uidKey } from './core.js';
import { SCN, scCur, scD, scMapDraw, scPropAt, scSetTile } from './scenes.js';
/* eslint-disable no-func-assign */
expose({
  scxBlocks: [() => scxBlocks],
  scxBlocksBar: [() => scxBlocksBar, v => (scxBlocksBar = v)],
  scxCopy: [() => scxCopy, v => (scxCopy = v)],
  scxCurve: [() => scxCurve, v => (scxCurve = v)],
  scxDeleteMulti: [() => scxDeleteMulti, v => (scxDeleteMulti = v)],
  scxDown: [() => scxDown, v => (scxDown = v)],
  scxDraw: [() => scxDraw, v => (scxDraw = v)],
  scxHint: [() => scxHint, v => (scxHint = v)],
  scxMove: [() => scxMove, v => (scxMove = v)],
  scxMultiCard: [() => scxMultiCard, v => (scxMultiCard = v)],
  scxPaste: [() => scxPaste, v => (scxPaste = v)],
  scxPickKind: [() => scxPickKind, v => (scxPickKind = v)],
  scxR: [() => scxR],
  scxRoadLay: [() => scxRoadLay, v => (scxRoadLay = v)],
  scxScatter: [() => scxScatter, v => (scxScatter = v)],
  scxScatterBar: [() => scxScatterBar, v => (scxScatterBar = v)],
  scxScatterKinds: [() => scxScatterKinds, v => (scxScatterKinds = v)],
  scxSelBoxes: [() => scxSelBoxes, v => (scxSelBoxes = v)],
  scxStampAt: [() => scxStampAt, v => (scxStampAt = v)],
  scxTools: [() => scxTools, v => (scxTools = v)],
  scxUp: [() => scxUp, v => (scxUp = v)],
});
/* eslint-enable no-func-assign */
provide({ scxBlocksBar, scxDown, scxDraw, scxHint, scxMove, scxMultiCard, scxScatterBar, scxTools, scxUp });
/* to-module: end */
SCN.multi = SCN.multi || new Set();
SCN.scat = SCN.scat || { dens: 0.5, mix: true, vary: 0.18 };
SCN.road = null;
const scxBlocks = () => {
  const C = scD();
  return C.blocks || (C.blocks = {});
};
const scxR = (k, s) => {
  const M = scD().props[k] || {};
  if (M.box) return (Math.max(...M.box) / 2) * (s || 1);
  return Math.max(0.25, M.solid || M.shadow * 0.5 || 0.3) * (s || 1);
};
function scxTools() {
  return [
    ['scatter', 'Scatter brush', 'S'],
    ['stamp', 'Stamp a block', 'K'],
    ['road', 'Curved road', 'R'],
  ];
}
function scxHint(t) {
  return (
    {
      scatter: 'Drag to scatter the chosen prop (or its group). Alt-drag clears them. Brush size and density below.',
      stamp: 'Pick a block below, then click the map to place it. Shift-click places it mirrored.',
      road: 'Click to add points along the road, double-click or press Enter to lay it with the chosen ground and the brush’s width. Escape cancels.',
    }[t] || ''
  );
}
/* ---------- several props at once ---------- */
function scxSelBoxes(a, b) {
  const x0 = Math.min(a[0], b[0]),
    x1 = Math.max(a[0], b[0]),
    y0 = Math.min(a[1], b[1]),
    y1 = Math.max(a[1], b[1]);
  return (SCN.boxes || []).filter(B => B.x1 >= x0 && B.x0 <= x1 && B.y1 >= y0 && B.y0 <= y1).map(B => B.i);
}
function scxDown(sc, m, ev) {
  const t = SCN.tool;
  if (t === 'props') {
    const hit = scPropAt(m);
    if (ev.shiftKey) {
      if (hit != null) {
        if (SCN.multi.has(hit)) SCN.multi.delete(hit);
        else {
          SCN.multi.add(hit);
          if (SCN.sel != null && SCN.sel !== hit) SCN.multi.add(SCN.sel);
        }
        SCN.sel = null;
        render();
        return true;
      }
      SCN.drag = { k: 'band', a: [m.mx, m.my], b: [m.mx, m.my] };
      return true;
    }
    if (hit != null && SCN.multi.size > 1 && SCN.multi.has(hit)) {
      SCN.drag = { k: 'group', a: [m.x, m.z], orig: [...SCN.multi].map(i => [i, sc.props[i].x, sc.props[i].z]) };
      return true;
    }
    if (SCN.multi.size) {
      SCN.multi.clear();
      scMapDraw();
    }
    return false;
  }
  if (t === 'scatter') {
    SCN.drag = { k: 'scatter', erase: ev.altKey || ev.button === 2, n: 0 };
    scxScatter(sc, m, SCN.drag);
    return true;
  }
  if (t === 'stamp') {
    const b = scxBlocks()[SCN.block];
    if (!b) {
      toast('Pick a block first (save one from a selection of props).');
      return true;
    }
    scxStampAt(sc, b, m.x, m.z, ev.shiftKey);
    return true;
  }
  if (t === 'road') {
    if (ev.detail >= 2 && SCN.road && SCN.road.length > 1) {
      scxRoadLay(sc);
      return true;
    }
    (SCN.road = SCN.road || []).push([+m.x.toFixed(2), +m.z.toFixed(2)]);
    scMapDraw();
    return true;
  }
  return false;
}
function scxMove(sc, m, D, ev) {
  SCN.mouse = [m.x, m.z];
  if (!D) return false;
  if (D.k === 'band') {
    D.b = [m.mx, m.my];
    scMapDraw();
    return true;
  }
  if (D.k === 'group') {
    let dx = m.x - D.a[0],
      dz = m.z - D.a[1];
    if (!ev.shiftKey) {
      dx = Math.round(dx * 4) / 4;
      dz = Math.round(dz * 4) / 4;
    }
    for (const [i, x, z] of D.orig) {
      const p = sc.props[i];
      if (p) {
        p.x = +(x + dx).toFixed(2);
        p.z = +(z + dz).toFixed(2);
      }
    }
    D.moved = 1;
    scMapDraw();
    return true;
  }
  if (D.k === 'scatter') {
    scxScatter(sc, m, D);
    return true;
  }
  return false;
}
function scxUp(sc, D) {
  if (!D) return false;
  if (D.k === 'band') {
    for (const i of scxSelBoxes(D.a, D.b)) SCN.multi.add(i);
    SCN.sel = null;
    render();
    return true;
  }
  if (D.k === 'group') {
    if (D.moved) {
      DIO.cand = null;
      DIO.nav = null;
      changed();
      commit(true);
    }
    return true;
  }
  if (D.k === 'scatter') {
    if (D.n) {
      DIO.cand = null;
      DIO.nav = null;
      changed();
      commit(true);
      render();
    }
    return true;
  }
  return false;
}
function scxCopy() {
  const sc = scCur();
  if (!sc) return;
  const L = [...SCN.multi].map(i => sc.props[i]).filter(Boolean);
  if (!L.length && SCN.sel != null && sc.props[SCN.sel]) L.push(sc.props[SCN.sel]);
  if (!L.length) return;
  const cx = L.reduce((a, p) => a + p.x, 0) / L.length,
    cz = L.reduce((a, p) => a + p.z, 0) / L.length;
  SCN.clip = L.map(p => Object.assign(clone(p), { x: +(p.x - cx).toFixed(2), z: +(p.z - cz).toFixed(2) }));
  toast(`Copied ${L.length} prop${L.length > 1 ? 's' : ''}.`);
}
function scxPaste() {
  const sc = scCur();
  if (!sc || !SCN.clip || !SCN.clip.length) return;
  const at = SCN.mouse || [sc.w / 2, sc.h / 2],
    n0 = sc.props.length;
  for (const p of SCN.clip)
    sc.props.push(Object.assign(clone(p), { x: +(at[0] + p.x).toFixed(2), z: +(at[1] + p.z).toFixed(2) }));
  SCN.multi = new Set(sc.props.map((_, i) => i).filter(i => i >= n0));
  SCN.sel = null;
  DIO.cand = null;
  DIO.nav = null;
  changed();
  commit(true);
  render();
}
function scxDeleteMulti() {
  const sc = scCur();
  if (!sc || !SCN.multi.size) return;
  const del = SCN.multi;
  sc.props = sc.props.filter((_, i) => !del.has(i));
  SCN.multi = new Set();
  SCN.sel = null;
  DIO.cand = null;
  DIO.nav = null;
  changed();
  commit(true);
  render();
}
document.addEventListener(
  'keydown',
  ev => {
    if (
      (typeof VP !== 'undefined' && VP.hover) ||
      ST.sec !== 'scenes' ||
      ev.target.closest('input,select,textarea') ||
      $('#modal').innerHTML ||
      $('#dlg').innerHTML
    )
      return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'c') {
      scxCopy();
      ev.preventDefault();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && k === 'v') {
      scxPaste();
      ev.preventDefault();
      return;
    }
    if (SCN.multi.size && (k === 'delete' || k === 'backspace')) {
      scxDeleteMulti();
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }
    if (k === 'escape') {
      if (SCN.road) {
        SCN.road = null;
        scMapDraw();
      }
      if (SCN.multi.size) {
        SCN.multi.clear();
        render();
      }
    }
    if (k === 'enter' && SCN.road && SCN.road.length > 1) {
      scxRoadLay(scCur());
      ev.preventDefault();
    }
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const T = { s: 'scatter', k: 'stamp', r: 'road' }[k];
      if (T) {
        SCN.tool = T;
        render();
      }
    }
  },
  true
);
function scxMultiCard() {
  const sc = scCur(),
    n = [...SCN.multi].filter(i => sc.props[i]).length;
  if (n < 2) return '';
  return `<div class="sc-sel"><b>${n} props selected</b><p class="help">Drag one of them to move them all. Ctrl/Cmd+C copies them, Ctrl/Cmd+V pastes where the mouse is, Delete removes them. Escape clears the selection.</p>
  <div class="seg-row"><button class="btn sm" data-act="scxCopy">Copy</button><button class="btn sm" data-act="scxPaste" ${SCN.clip ? '' : 'disabled'}>Paste</button><button class="btn sm primary" data-act="scxSaveBlock">Save as a building block</button><button class="btn sm danger subtle" data-act="scxDelMulti">Remove them</button></div></div>`;
}
ACTS.scxCopy = () => scxCopy();
ACTS.scxPaste = () => scxPaste();
ACTS.scxDelMulti = () => scxDeleteMulti();
/* ---------- building blocks ---------- */
ACTS.scxSaveBlock = async () => {
  const sc = scCur(),
    L = [...SCN.multi].map(i => sc.props[i]).filter(Boolean);
  if (L.length < 2) return;
  const r = await dialog(
    'Save a building block',
    `<label class="fld"><span>Name</span><input id="blkName" value="${esc((scD().props[L[0].k] || {}).name || 'Block')} group"></label><p class="help">It keeps the props and where they stand relative to each other. Stamp it in any scene with “Stamp a block”.</p>`,
    'Save'
  );
  if (!r) return;
  const name = ($('#blkName') || {}).value || 'Block',
    B = scxBlocks(),
    key = uidKey(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'block',
      x => !!B[x]
    );
  const cx = L.reduce((a, p) => a + p.x, 0) / L.length,
    cz = Math.min(...L.map(p => p.z));
  B[key] = {
    name,
    props: L.map(p => {
      const q = clone(p);
      q.x = +(p.x - cx).toFixed(2);
      q.z = +(p.z - cz).toFixed(2);
      return q;
    }),
  };
  SCN.block = key;
  changed();
  commit(true);
  toast(`Saved “${name}”.`);
  render();
};
function scxStampAt(sc, b, x, z, mirror) {
  const n0 = sc.props.length;
  for (const p of b.props) {
    const q = clone(p);
    q.x = +(x + (mirror ? -p.x : p.x)).toFixed(2);
    q.z = +(z + p.z).toFixed(2);
    if (mirror) q.f = q.f ? 0 : 1;
    if (!q.f) delete q.f;
    sc.props.push(q);
  }
  SCN.multi = new Set(sc.props.map((_, i) => i).filter(i => i >= n0));
  DIO.cand = null;
  DIO.nav = null;
  changed();
  commit(true);
  scMapDraw();
}
function scxBlocksBar() {
  const B = scxBlocks(),
    ks = Object.keys(B);
  return `<div class="sc-hbar">${ks.length ? ks.map(k => `<button class="seg ${SCN.block === k ? 'on' : ''}" data-act="scxBlock" data-k="${esc(k)}">${esc(B[k].name || k)} <small>(${B[k].props.length})</small></button>`).join('') : '<span class="help">No blocks yet. Select some props (shift-drag with “Place & move props”) and save them as a block.</span>'}${SCN.block && B[SCN.block] ? `<button class="btn sm danger subtle" data-act="scxBlockDel">Delete “${esc(B[SCN.block].name)}”</button>` : ''}</div>`;
}
ACTS.scxBlock = d => {
  SCN.block = d.k;
  render();
};
ACTS.scxBlockDel = async () => {
  const B = scxBlocks();
  if (
    !B[SCN.block] ||
    !(await ask(`Delete the block “${B[SCN.block].name}”? Scenes that used it keep their props.`, 'Delete'))
  )
    return;
  delete B[SCN.block];
  SCN.block = null;
  changed();
  commit(true);
  render();
};
/* ---------- scatter brush ---------- */
function scxScatterKinds() {
  const C = scD(),
    k = SCN.prop;
  if (!k || !C.props[k]) return [];
  if (SCN.scat.fam && C.props[k].family) {
    const f = C.props[k].family;
    return Object.keys(C.props).filter(q => C.props[q].family === f);
  }
  if (!SCN.scat.mix) return [k];
  const g = C.props[k].group || k;
  return Object.keys(C.props).filter(q => (C.props[q].group || q) === g);
}
/* v42: a nature prop says which ground it grows on ("grow"); the brush only puts it there, weighted by how common it is */
function scxPickKind(kinds, ch) {
  const C = scD(),
    ok = kinds.filter(q => {
      const g = C.props[q].grow;
      return g ? g.includes(ch) : !(ch === 'w' || ch === 'd');
    });
  if (!ok.length) return null;
  const w = ok.map(q => C.props[q].weight || 1),
    t = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * t;
  for (let i = 0; i < ok.length; i++) {
    r -= w[i];
    if (r <= 0) return ok[i];
  }
  return ok[ok.length - 1];
}
function scxScatter(sc, m, D) {
  const kinds = scxScatterKinds();
  if (!kinds.length) {
    if (!D.warned) {
      D.warned = 1;
      toast('Pick a prop in the Props card to scatter.');
    }
    return;
  }
  const R = Math.max(0.6, SCN.brush * 0.9);
  if (D.erase) {
    const before = sc.props.length;
    sc.props = sc.props.filter(p => !(kinds.includes(p.k) && Math.hypot(p.x - m.x, p.z - m.z) < R));
    if (sc.props.length !== before) {
      D.n++;
      SCN.sel = null;
      SCN.multi.clear();
      scMapDraw();
    }
    return;
  }
  const want = Math.max(1, Math.round(Math.PI * R * R * SCN.scat.dens * 0.25));
  let placed = 0;
  for (let t = 0; t < want * 6 && placed < want; t++) {
    const a = Math.random() * 6.283,
      r = Math.sqrt(Math.random()) * R,
      x = m.x + Math.cos(a) * r,
      z = m.z + Math.sin(a) * r;
    if (x < 0.2 || z < 0.2 || x > sc.w - 0.2 || z > sc.h - 0.2) continue;
    const ch = (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)],
      k = scxPickKind(kinds, ch);
    if (!k) continue;
    const s = 1 + (Math.random() * 2 - 1) * SCN.scat.vary,
      rr = scxR(k, s);
    if (sc.props.some(p => Math.hypot(p.x - x, p.z - z) < rr + scxR(p.k, p.s || 1) * 0.8)) continue;
    const q = { k, x: +x.toFixed(2), z: +z.toFixed(2) };
    if (Math.abs(s - 1) > 0.01) q.s = +s.toFixed(2);
    if (Math.random() < 0.45) q.f = 1;
    sc.props.push(q);
    placed++;
  }
  if (placed) {
    D.n += placed;
    scMapDraw();
  }
}
function scxScatterBar() {
  const C = scD(),
    k = SCN.prop,
    nm = k && C.props[k] ? C.props[k].name || k : null,
    kinds = scxScatterKinds();
  return `<div class="sc-hbar"><span class="help">${nm ? `Scattering <b>${esc(nm)}</b>${(SCN.scat.mix || SCN.scat.fam) && kinds.length > 1 ? ` and ${kinds.length - 1} more like it` : ''}` : 'Pick a prop in the Props card'}</span><label class="fld chk"><input type="checkbox" id="scxMix" ${SCN.scat.mix ? 'checked' : ''}><span>Mix its whole group</span></label>${k && C.props[k] && C.props[k].family ? `<label class="fld chk" title="Every nature prop of this family that grows on the ground under the brush (flowers, ground cover, shrubs, trees, water plants, rocks, seasons)"><input type="checkbox" id="scxFam" ${SCN.scat.fam ? 'checked' : ''}><span>Whole ${esc(C.props[k].family)} family, by ground</span></label>` : ''}
  <label class="mp-size"><span>Density</span><input type="range" id="scxDens" min=".1" max="2" step=".1" value="${SCN.scat.dens}"></label><label class="mp-size"><span>Size variety</span><input type="range" id="scxVary" min="0" max=".5" step=".02" value="${SCN.scat.vary}"></label></div>`;
}
document.addEventListener('input', ev => {
  const t = ev.target;
  if (!t || !t.id) return;
  if (t.id === 'scxDens') SCN.scat.dens = +t.value;
  else if (t.id === 'scxVary') SCN.scat.vary = +t.value;
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t && t.id === 'scxMix') {
    SCN.scat.mix = t.checked;
    render();
  } else if (t && t.id === 'scxFam') {
    SCN.scat.fam = t.checked;
    render();
  }
});
/* ---------- curves: roads and the walker's path ---------- */
function scxCurve(P, step = 0.25) {
  if (P.length < 3) return P.slice();
  const out = [],
    g = i => P[Math.max(0, Math.min(P.length - 1, i))];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = g(i - 1),
      p1 = g(i),
      p2 = g(i + 1),
      p3 = g(i + 2),
      L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
      n = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t,
        f = (a, b, c, d) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1].slice());
  return out;
}
function scxRoadLay(sc) {
  const P = SCN.road;
  SCN.road = null;
  if (!sc || !P || P.length < 2) return;
  const C = scxCurve(P, 0.2),
    w = Math.max(0.7, SCN.brush * 0.6);
  let any = false;
  for (const [x, z] of C)
    for (let dx = -w; dx <= w; dx += 0.35)
      for (let dz = -w; dz <= w; dz += 0.35) {
        if (dx * dx + dz * dz > w * w) continue;
        const i = Math.floor(x + dx),
          j = sc.h - 1 - Math.floor(z + dz);
        any = scSetTile(sc, i, j, SCN.ter) || any;
      }
  if (any) {
    DIO.gkey = '';
    DIO.nav = null;
    DIO.cand = null;
    changed();
    commit(true);
  }
  scMapDraw();
  toast('Road laid.');
}
ACTS.scxSmoothPath = () => {
  const sc = scCur();
  if (!sc || !sc.path || sc.path.length < 3) return toast('The path needs at least three points to curve.');
  sc.path = scxCurve(sc.path, 1.2).map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]);
  DIO.cand = null;
  DIO.nav = null;
  changed();
  commit(true);
  scMapDraw();
};
/* ---------- drawn over the map ---------- */
function scxDraw(x, sc, Z) {
  const H = sc.h;
  if (SCN.multi.size) {
    x.strokeStyle = '#E2B92C';
    x.lineWidth = 2;
    x.setLineDash([4, 3]);
    for (const B of SCN.boxes || []) if (SCN.multi.has(B.i)) x.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    x.setLineDash([]);
  }
  const D = SCN.drag;
  if (D && D.k === 'band') {
    x.fillStyle = 'rgba(226,185,44,.12)';
    x.strokeStyle = '#E2B92C';
    x.lineWidth = 1.5;
    const a = D.a,
      b = D.b;
    x.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    x.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  }
  if (SCN.road && SCN.road.length) {
    const C = scxCurve(SCN.road.concat(SCN.mouse ? [SCN.mouse] : []), 0.3);
    x.strokeStyle = 'rgba(255,236,170,.9)';
    x.lineWidth = Math.max(2, SCN.brush * 0.6 * 2 * Z);
    x.globalAlpha = 0.35;
    x.lineCap = 'round';
    x.beginPath();
    C.forEach(([a, b], k) => (k ? x.lineTo(a * Z, (H - b) * Z) : x.moveTo(a * Z, (H - b) * Z)));
    x.stroke();
    x.globalAlpha = 1;
    SCN.road.forEach(([a, b]) => {
      x.fillStyle = '#fff';
      x.strokeStyle = '#1F2E36';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(a * Z, (H - b) * Z, 5, 0, 7);
      x.fill();
      x.stroke();
    });
  }
  if ((SCN.tool === 'scatter' || SCN.tool === 'road') && SCN.mouse) {
    x.strokeStyle = 'rgba(255,255,255,.8)';
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(
      SCN.mouse[0] * Z,
      (H - SCN.mouse[1]) * Z,
      (SCN.tool === 'scatter' ? Math.max(0.6, SCN.brush * 0.9) : Math.max(0.7, SCN.brush * 0.6)) * Z,
      0,
      7
    );
    x.stroke();
  }
}
