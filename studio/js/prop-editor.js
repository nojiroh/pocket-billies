'use strict';
/* ================= POCKET BILLIES STUDIO · prop editor =================
   One place for everything about a walk-scene prop: its picture with the base point, effects (lamp glows, windows,
   fires, smoke, spray, sparkles), door and footprint drawn on it and editable by clicking and dragging; extra picture
   layers placed in front of or behind the main one for depth; which way each layer faces; glowing layers; and a 3D
   turntable that shows the result in the game's renderer while you work. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { pedVoxHTML, provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { frameStop, frameTask } from '../../game/js/frame-scheduler.js';
import { artLoad, cnv, setArtLoad } from '../../game/js/art.js';
import { dioData, dioImg, dioLayerM, dioOk, setDioData, walkView } from '../../game/js/walk-view.js';
import { DGL, DGL_MATS, dglMatOf, dglVaryOf, dioMount } from '../../game/js/walk-view-gl.js';
import { BLD_ROOM_NAMES, BLD_TEX_NAMES } from '../../game/js/buildings.js';
import { P3D_AUTO, P3D_KINDS, P3D_PARTS, p3dTreeKind } from '../../game/js/solid-props.js';
import { esc } from './game-stand-ins.js';
import {
  ACTS,
  ST,
  ask,
  card,
  changed,
  clone,
  commit,
  fChk,
  fColor,
  fNum,
  fRange,
  fSel,
  fText,
  grid,
  render,
  toast,
} from './studio-app.js';
import { atlasGet, fileToCanvas, markArt, pickFile } from './sprites.js';
import { SCN, scArt, scD, scOpenPe } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  PED: [() => PED],
  PED_FX: [() => PED_FX],
  PED_KINDS: [() => PED_KINDS],
  PED_PART_COL: [() => PED_PART_COL],
  pedAt: [() => pedAt, v => (pedAt = v)],
  pedBind: [() => pedBind, v => (pedBind = v)],
  pedBounds: [() => pedBounds, v => (pedBounds = v)],
  pedBuildHTML: [() => pedBuildHTML, v => (pedBuildHTML = v)],
  pedCard: [() => pedCard, v => ((pedCard = v), provide({ pedCard }))],
  pedDraw: [() => pedDraw, v => setPedDraw(v)],
  pedHit: [() => pedHit, v => (pedHit = v)],
  pedM: [() => pedM],
  pedMount: [() => pedMount, v => ((pedMount = v), provide({ pedMount }))],
  pedScene: [() => pedScene, v => (pedScene = v)],
  pedSetBase: [() => pedSetBase, v => (pedSetBase = v)],
  pedSplit: [() => pedSplit, v => (pedSplit = v)],
  pedVaryHTML: [() => pedVaryHTML, v => (pedVaryHTML = v)],
  pedVolHTML: [() => pedVolHTML, v => (pedVolHTML = v)],
  setPedDraw: [() => setPedDraw, v => (setPedDraw = v)],
});
/* eslint-enable no-func-assign */
provide({ pedCard, pedDraw, pedMount });
/* to-module: end */
const PED = { tool: 'move', fxk: 'glow', zoom: 0, spin: true, sel: null, drag: null, sc: null, id: null };
const PED_FX = [
  ['glow', 'Lamp glow', '#FFC94A'],
  ['window', 'Lit window', '#FFB35C'],
  ['fire', 'Fire', '#FF6A2A'],
  ['smoke', 'Smoke', '#B9B4C8'],
  ['spray', 'Water spray', '#62C6F0'],
  ['sparkle', 'Sparkle', '#F6F0FF'],
];
export const pedM = () => (SCN.ped ? scD().props[SCN.ped] : null);
/* the turntable scene: a patch of grass with the prop in the middle */
function pedScene(k) {
  const C = scD(),
    M = C.props[k],
    T = C.terrains,
    ppu = C.ppu || 34,
    tk = Object.keys(T).find(c => /grass/i.test(T[c].name)) || Object.keys(T)[0] || 'g';
  const im = dioImg(M.img),
    wM = im ? (im.naturalWidth || im.width) / ppu : 2,
    hM = im ? (im.naturalHeight || im.height) / ppu : 2,
    w = Math.max(12, Math.ceil(wM + 8)),
    h = 12;
  return {
    name: 'Prop turntable',
    w,
    h,
    edge: tk,
    tiles: Array.from({ length: h }, () => tk.repeat(w)),
    props: [{ k, x: w / 2, z: 6.5 }],
    hub: [w / 2, 4.2],
    exits: [],
    folk: 0,
    indoor: 0,
    wind: 1,
    sky: ['#8CC6E6', '#BFE3EE', '#F4E8C8'],
    haze: '#EAD9C0',
    hazeD: 70,
    cam: { pitch: 20, h: Math.max(2.6, hM * 0.85 + 1.4), fov: 0.9 },
    blur: 0.35,
  };
}
{
  const base = dioData;
  setDioData(() => {
    const d = base();
    if (PED.sc) d.scenes = Object.assign({}, d.scenes, { __prop: PED.sc });
    return d;
  });
}
/* ---------- the card ---------- */
function pedCard(k) {
  const C = scD(),
    M = C.props[k],
    b = `scenery.props.${k}`,
    L = M.layers || [];
  const tools = [
    ['move', 'Select & drag'],
    ['add', 'Add an effect'],
    ['door', 'Set the door'],
    ['base', 'Set the base point'],
    ['split', 'Split off a layer'],
  ]
    .map(([t, n]) => `<button class="seg ${PED.tool === t ? 'on' : ''}" data-act="pedTool" data-t="${t}">${n}</button>`)
    .join('');
  const fxk =
    PED.tool === 'add'
      ? `<span class="px-tools">${PED_FX.map(([f, n, c]) => `<button class="seg sm ${PED.fxk === f ? 'on' : ''}" data-act="pedFx" data-k="${f}"><i class="ped-dot" style="background:${c}"></i>${n}</button>`).join('')}</span>`
      : '';
  const sel = PED.sel,
    fx = M.fx || [],
    selRow =
      typeof sel === 'number' && fx[sel]
        ? `<div class="ped-selrow"><b>${esc((PED_FX.find(f => f[0] === fx[sel].k) || [0, fx[sel].k])[1])}</b> at ${fx[sel].x}, ${fx[sel].y}<select id="pedFxK">${PED_FX.map(([f, n]) => `<option value="${f}" ${fx[sel].k === f ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn sm danger subtle" data-act="pedFxDel">Remove</button></div>`
        : '';
  const face = (p, v) =>
    `<select data-p="${p}" data-k="sel" data-opt="1">${[
      ['', 'Stays put in the world'],
      ['billboard', 'Turns to face the camera'],
      ['flat', 'Lies flat on the ground'],
    ]
      .map(([a, n]) => `<option value="${a}" ${(v === 'fixed' ? '' : v || '') === a ? 'selected' : ''}>${n}</option>`)
      .join('')}</select>`;
  const rows = L.map((l, i) => {
    const p = `${b}.layers.${i}`;
    return `<div class="ped-layer ${PED.layer === i ? 'on' : ''}"><canvas class="ped-thumb" data-limg="${esc(l.img || '')}" width="40" height="40"></canvas>
  <div class="ped-lf"><div class="ped-lh"><b>Layer ${i + 1}</b><small class="mono">${esc((l.img || '').split('/').pop())}</small><span class="grow"></span>
   <button class="btn sm subtle" data-act="pedLayerPx" data-i="${i}" title="Edit this layer's pixels">Pixels</button><button class="btn sm subtle" data-act="pedLayerMove" data-i="${i}" data-d="-1" title="Move up the list">↑</button><button class="btn sm subtle" data-act="pedLayerMove" data-i="${i}" data-d="1" title="Move down the list">↓</button><button class="btn sm danger subtle" data-act="pedLayerDel" data-i="${i}">Remove</button></div>
   <div class="grid ped-lg">${fRange('Depth (m, + is behind)', `${p}.dz`, { min: -3, max: 3, step: 0.05, def: 0 })}${fNum('Across (px)', `${p}.dx`, { step: 1, opt: 1 })}${fNum('Up (px)', `${p}.dy`, { step: 1, opt: 1 })}
   <label class="fld"><span>Facing</span>${face(`${p}.face`, l.face)}</label>${fRange('Glow (lights itself)', `${p}.glow`, { min: 0, max: 2, step: 0.05, def: 0 })}${fRange('Sway with the main picture', `${p}.sway`, { min: 0, max: 2, step: 0.05, def: 1 })}</div></div></div>`;
  }).join('');
  const set =
    grid(
      fText('Name', `${b}.name`),
      fText('Variant group', `${b}.group`, { opt: 1 }),
      fNum('Shadow size (m)', `${b}.shadow`, { min: 0, max: 4, step: 0.05 }),
      fRange('Sways in the wind', `${b}.sway`, { min: 0, max: 1, step: 0.05, def: 0 }),
      fNum('Solid radius (m)', `${b}.solid`, {
        opt: 1,
        min: 0,
        max: 4,
        step: 0.05,
        help: 'People walk around this. Empty: guessed from the shadow. 0: walk through.',
      }),
      fNum('Footprint width (m)', `${b}.box.0`, {
        opt: 1,
        min: 0,
        max: 12,
        step: 0.1,
        help: 'Buildings and fences: a box instead of a circle. Buildings also cast solid shadows from it.',
      }),
      fNum('Footprint depth (m)', `${b}.box.1`, { opt: 1, min: 0, max: 12, step: 0.1 }),
      fNum('Walkable radius (m)', `${b}.walk`, {
        opt: 1,
        min: 0,
        max: 4,
        step: 0.1,
        help: 'Stepping stones and bridges: opens water under it.',
      }),
      fChk('Lies flat on the ground', `${b}.flat`, { num: 1 })
    ) +
    `<div class="grid"><label class="fld"><span>Main picture faces</span>${face(`${b}.face`, M.face)}</label><label class="fld"><span>Material</span><select data-p="${b}.mat" data-k="sel" data-opt="1">${[
      ['', 'Automatic (' + (typeof dglMatOf === 'function' ? DGL_MATS[dglMatOf(k, M)].name : 'from the name') + ')'],
    ]
      .concat(Object.entries(typeof DGL_MATS !== 'undefined' ? DGL_MATS : {}).map(([k, m]) => [k, m.name]))
      .map(([a, n]) => `<option value="${a}" ${(M.mat || '') === a ? 'selected' : ''}>${n}</option>`)
      .join('')}</select></label></div>` +
    (M.glow
      ? grid(
          fColor('Glow color', `${b}.glow.c`),
          fNum('Glow size (m)', `${b}.glow.r`, { step: 0.1, min: 0.2, max: 6 }),
          fNum('Glow height (m)', `${b}.glow.y`, { step: 0.1, min: 0, max: 8 })
        ) + '<button class="btn sm subtle danger" data-act="pedGlowDel">Remove the glow</button>'
      : '<button class="btn sm subtle" data-act="scGlowAdd2">Add a light glow</button>');
  return card(
    `Prop editor · ${esc(M.name || k)}`,
    `<div class="ped" id="ped">
  <div class="ped-l"><div class="ped-bar"><span class="px-tools">${tools}</span><span class="px-tools"><button class="seg" data-act="pedZoom" data-z="-1">−</button><button class="seg" data-act="pedZoom" data-z="1">+</button></span></div>${fxk}
   <div class="ped-stage"><canvas id="pedCv"></canvas></div>${selRow}
   <p class="help">${{ move: 'Drag an effect, the door or the base point. Click an effect to select it; Delete removes it.', add: 'Click the picture to add the effect. It moves and flickers in the game exactly where you put it.', door: 'Click where people should walk to when the prop is tapped.', base: 'Click where the prop touches the ground. Effects and the door stay where they are on the picture.', split: 'Drag a box around a part (a roof, a porch, the top of a tree). It moves out of the main picture onto a new layer you can push back or bring forward.' }[PED.tool]}</p>
   <div class="ped-tt"><div class="sc-pv ped-pv"><canvas id="pedPv"></canvas><div class="sc-pv-load" id="pedPvLoad">Loading…</div></div>
   <div class="seg-row"><button class="seg ${PED.spin ? 'on' : ''}" data-act="pedSpin">Turn slowly</button><span class="help">Drag the turntable to turn it yourself. It turns as far as the game camera can; layers show their depth.</span></div></div></div>
  <div class="ped-r"><h4>Layers</h4><p class="help">Extra pictures drawn in front of or behind the main one. Put a porch, a sign or leaves on their own layer and give them a little depth, and the prop gains real depth when the camera moves. A glowing layer lights itself (windows at night, crystals).</p>
   ${rows || '<p class="help"><i>No extra layers yet.</i></p>'}<div class="seg-row"><button class="btn sm" data-act="pedLayerAdd" data-from="png">+ Layer from PNG</button><button class="btn sm" data-act="pedLayerAdd" data-from="copy">+ Copy of the main picture</button><button class="btn sm subtle" data-act="scEditProp" data-k="${esc(k)}">Edit the main picture’s pixels</button></div>
   <h4>Settings</h4>${set}${pedVaryHTML(k)}${typeof pedVoxHTML === 'function' ? pedVoxHTML(k) : ''}${pedVolHTML(k)}${pedBuildHTML(k)}</div></div>`,
    {
      acts: `<button class="btn sm primary" data-act="pedClose">Done</button>`,
      sub: 'Changes show in the turntable and in every scene right away.',
    }
  );
}
/* ---------- picture view ---------- */
function pedBounds(M) {
  const ims = [[dioImg(M.img), M.ox, M.oy]].concat(
    (M.layers || []).map(l => {
      const LM = dioLayerM(M, l);
      return [dioImg(l.img), LM.ox, LM.oy];
    })
  );
  let x0 = -20,
    y0 = -20,
    x1 = 20,
    y1 = 8;
  for (const [im, ox, oy] of ims) {
    if (!dioOk(im)) continue;
    x0 = Math.min(x0, ox);
    y0 = Math.min(y0, oy);
    x1 = Math.max(x1, ox + (im.naturalWidth || im.width));
    y1 = Math.max(y1, oy + (im.naturalHeight || im.height));
  }
  const ppu = scD().ppu || 34;
  if (M.box) {
    x0 = Math.min(x0, (-M.box[0] * ppu) / 2);
    x1 = Math.max(x1, (M.box[0] * ppu) / 2);
  }
  return { x0: x0 - 6, y0: y0 - 6, x1: x1 + 6, y1: y1 + 10 };
}
function pedDraw() {
  const cv = $('#pedCv'),
    M = pedM();
  if (!cv || !M) return;
  const B = pedBounds(M),
    W = B.x1 - B.x0,
    H = B.y1 - B.y0;
  if (!PED.zoom) PED.zoom = clamp(Math.floor(440 / Math.max(W, H)), 2, 10);
  const Z = PED.zoom,
    ppu = scD().ppu || 34;
  cv.width = W * Z;
  cv.height = H * Z;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const X = v => (v - B.x0) * Z,
    Y = v => (v - B.y0) * Z;
  /* far layers first, then the main picture (depth 0), then the near ones */
  const list = [{ im: dioImg(M.img), ox: M.ox, oy: M.oy, dz: 0, i: -1 }]
    .concat(
      (M.layers || []).map((l, i) => {
        const LM = dioLayerM(M, l);
        return { im: dioImg(l.img), ox: LM.ox, oy: LM.oy, dz: l.dz || 0, i };
      })
    )
    .sort((a, b) => b.dz - a.dz);
  for (const o of list) {
    if (!dioOk(o.im)) continue;
    x.globalAlpha = PED.layer != null && PED.layer !== o.i ? 0.55 : 1;
    x.drawImage(o.im, X(o.ox), Y(o.oy), (o.im.naturalWidth || o.im.width) * Z, (o.im.naturalHeight || o.im.height) * Z);
    if (PED.layer === o.i) {
      x.globalAlpha = 1;
      x.strokeStyle = '#1F6E6F';
      x.lineWidth = 2;
      x.setLineDash([5, 4]);
      x.strokeRect(
        X(o.ox) + 1,
        Y(o.oy) + 1,
        (o.im.naturalWidth || o.im.width) * Z - 2,
        (o.im.naturalHeight || o.im.height) * Z - 2
      );
      x.setLineDash([]);
    }
  }
  x.globalAlpha = 1;
  if (PED.box) {
    const b = PED.box;
    x.fillStyle = 'rgba(242,193,78,.25)';
    x.strokeStyle = '#C8862A';
    x.lineWidth = 2;
    x.setLineDash([6, 4]);
    const bx = X(Math.min(b.x0, b.x1)),
      by = Y(Math.min(b.y0, b.y1)),
      bw = Math.abs(b.x1 - b.x0) * Z,
      bh = Math.abs(b.y1 - b.y0) * Z;
    x.fillRect(bx, by, bw, bh);
    x.strokeRect(bx, by, bw, bh);
    x.setLineDash([]);
  }
  /* footprint, solid radius, door, glow, effects, base point */
  x.lineWidth = 2;
  if (M.box) {
    x.strokeStyle = 'rgba(31,110,111,.9)';
    x.beginPath();
    x.moveTo(X((-M.box[0] * ppu) / 2), Y(0) + 0.5);
    x.lineTo(X((M.box[0] * ppu) / 2), Y(0) + 0.5);
    x.stroke();
  } else {
    const r = (M.solid ?? (M.shadow || 0) * 0.62) * ppu;
    if (r > 0) {
      x.strokeStyle = 'rgba(31,110,111,.6)';
      x.beginPath();
      x.ellipse(X(0), Y(0), r * Z, r * Z * 0.35, 0, 0, 7);
      x.stroke();
    }
  }
  if (M.door) {
    const dx = X(M.door.x || 0),
      dy = Y(0);
    x.fillStyle = '#2F8F5B';
    x.beginPath();
    x.moveTo(dx, dy - 14);
    x.lineTo(dx + 8, dy - 2);
    x.lineTo(dx - 8, dy - 2);
    x.closePath();
    x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 10px sans-serif';
    x.textAlign = 'center';
    x.fillText('door', dx, dy + 12);
  }
  if (M.glow) {
    const gy = Y(-M.glow.y * ppu);
    x.strokeStyle = M.glow.c || '#FFD27A';
    x.setLineDash([3, 3]);
    x.beginPath();
    x.arc(X(0), gy, Math.max(6, M.glow.r * ppu * 0.25 * Z), 0, 7);
    x.stroke();
    x.setLineDash([]);
  }
  (M.fx || []).forEach((e, i) => {
    const c = (PED_FX.find(f => f[0] === e.k) || [0, 0, '#fff'])[2],
      px = X(e.x) + Z / 2,
      py = Y(e.y) + Z / 2;
    x.fillStyle = c;
    x.strokeStyle = PED.sel === i ? '#1F6E6F' : '#2A2238';
    x.lineWidth = PED.sel === i ? 3 : 1.5;
    x.beginPath();
    x.arc(px, py, PED.sel === i ? 8 : 6, 0, 7);
    x.fill();
    x.stroke();
  });
  x.strokeStyle = '#C8323C';
  x.lineWidth = 2;
  const ax = X(0),
    ay = Y(0);
  x.beginPath();
  x.moveTo(ax - 9, ay);
  x.lineTo(ax + 9, ay);
  x.moveTo(ax, ay - 9);
  x.lineTo(ax, ay + 9);
  x.stroke();
}
/* phase 04d: the prop editor swaps the preview's drawing while it is open */
function setPedDraw(v) {
  pedDraw = v; // eslint-disable-line no-func-assign
  provide({ pedDraw });
}
function pedAt(ev) {
  const cv = $('#pedCv'),
    M = pedM(),
    B = pedBounds(M),
    r = cv.getBoundingClientRect(),
    Z = PED.zoom;
  return {
    x: (((ev.clientX - r.left) / r.width) * cv.width) / Z + B.x0,
    y: (((ev.clientY - r.top) / r.height) * cv.height) / Z + B.y0,
    k: (Z * r.width) / cv.width,
  };
}
function pedHit(M, p) {
  const ppu = scD().ppu || 34,
    tol = 9 / p.k;
  let best = null,
    bd = tol;
  (M.fx || []).forEach((e, i) => {
    const d = Math.hypot(e.x + 0.5 - p.x, e.y + 0.5 - p.y);
    if (d < bd) {
      bd = d;
      best = { k: 'fx', i };
    }
  });
  if (M.door) {
    const d = Math.hypot((M.door.x || 0) - p.x, -6 - p.y);
    if (d < bd) {
      bd = d;
      best = { k: 'door' };
    }
  }
  if (M.glow) {
    const d = Math.hypot(-p.x, -M.glow.y * ppu - p.y);
    if (d < bd) {
      bd = d;
      best = { k: 'glow' };
    }
  }
  if (Math.hypot(p.x, p.y) < bd) best = { k: 'base' };
  return best;
}
/* move the pixels inside a box out of the main picture onto a new layer (same size, so it lines up) */
async function pedSplit(b) {
  const M = pedM(),
    k = SCN.ped;
  if (!M || !b) return;
  const src = await atlasGet('art/' + M.img).catch(() => null);
  if (!src) return toast('Could not read the picture.', 'err');
  const x0 = Math.max(0, Math.floor(Math.min(b.x0, b.x1) - M.ox)),
    y0 = Math.max(0, Math.floor(Math.min(b.y0, b.y1) - M.oy)),
    x1 = Math.min(src.width, Math.ceil(Math.max(b.x0, b.x1) - M.ox)),
    y1 = Math.min(src.height, Math.ceil(Math.max(b.y0, b.y1) - M.oy));
  if (x1 - x0 < 2 || y1 - y0 < 2) return toast('Drag a bigger box around the part to split off.');
  const lay = cnv(src.width, src.height);
  lay.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  const main = cnv(src.width, src.height),
    mx = main.getContext('2d');
  mx.drawImage(src, 0, 0);
  mx.clearRect(x0, y0, x1 - x0, y1 - y0);
  const L = M.layers || (M.layers = []);
  let n = L.length + 1;
  while (L.some(l => l.img === `scene/props/${k}_layer${n}.png`)) n++;
  const path = `scene/props/${k}_layer${n}.png`;
  markArt('art/' + M.img, main);
  markArt('art/' + path, lay);
  L.push({ img: path, dz: y0 < src.height * 0.5 ? 0.3 : -0.3 });
  PED.layer = L.length - 1;
  changed();
  commit(true);
  render();
  toast('Split off. Set its depth: positive pushes it back, negative brings it forward.');
}
function pedSetBase(M, nx, ny) {
  nx = Math.round(nx);
  ny = Math.round(ny);
  if (!nx && !ny) return;
  M.ox -= nx;
  M.oy -= ny;
  for (const e of M.fx || []) {
    e.x -= nx;
    e.y -= ny;
  }
  if (M.door) M.door.x = Math.round((M.door.x || 0) - nx);
  for (const l of M.layers || []) {
    if (l.ox != null) l.ox -= nx;
    if (l.oy != null) l.oy -= ny;
  }
}
function pedBind() {
  const cv = $('#pedCv');
  if (!cv) return;
  pedDraw();
  cv.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    const M = pedM(),
      h = pedHit(M, pedAt(ev));
    if (h && h.k === 'fx') {
      M.fx.splice(h.i, 1);
      PED.sel = null;
      changed();
      commit(true);
      render();
    }
  });
  cv.addEventListener('pointerdown', ev => {
    if (ev.button === 2) return;
    const M = pedM(),
      p = pedAt(ev),
      ppu = scD().ppu || 34;
    if (PED.tool === 'add') {
      (M.fx || (M.fx = [])).push({ k: PED.fxk, x: Math.round(p.x), y: Math.round(p.y) });
      PED.sel = M.fx.length - 1;
      changed();
      commit(true);
      render();
      return;
    }
    if (PED.tool === 'door') {
      M.door = Object.assign(M.door || {}, { x: Math.round(p.x) });
      changed();
      commit(true);
      pedDraw();
      return;
    }
    if (PED.tool === 'base') {
      pedSetBase(M, p.x, p.y);
      changed();
      commit(true);
      pedDraw();
      return;
    }
    if (PED.tool === 'split') {
      PED.box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      PED.drag = { h: { k: 'box' } };
      cv.setPointerCapture(ev.pointerId);
      return;
    }
    const h = pedHit(M, p);
    if (!h) {
      if (PED.sel != null) {
        PED.sel = null;
        render();
      }
      return;
    }
    if (h.k === 'fx' && PED.sel !== h.i) {
      PED.sel = h.i;
      render();
      return;
    }
    PED.drag = { h, x0: p.x, y0: p.y };
    cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener('pointermove', ev => {
    const D = PED.drag;
    if (!D) return;
    const M = pedM(),
      p = pedAt(ev),
      ppu = scD().ppu || 34;
    if (D.h.k === 'box') {
      PED.box.x1 = p.x;
      PED.box.y1 = p.y;
      pedDraw();
      return;
    }
    if (D.h.k === 'fx') {
      const e = M.fx[D.h.i];
      e.x = Math.round(p.x);
      e.y = Math.round(p.y);
    } else if (D.h.k === 'door') M.door.x = Math.round(p.x);
    else if (D.h.k === 'glow') M.glow.y = +Math.max(0, -p.y / ppu).toFixed(2);
    else if (D.h.k === 'base') {
      pedSetBase(M, p.x - D.x0, p.y - D.y0);
      D.x0 = Math.round(p.x);
      D.y0 = Math.round(p.y);
    }
    pedDraw();
  });
  cv.addEventListener('pointerup', () => {
    if (PED.drag && PED.drag.h.k === 'box') {
      PED.drag = null;
      const b = PED.box;
      PED.box = null;
      pedSplit(b);
      return;
    }
    if (PED.drag) {
      PED.drag = null;
      changed();
      commit(true);
    }
  });
  const k = $('#pedFxK');
  if (k)
    k.onchange = () => {
      const M = pedM();
      M.fx[PED.sel].k = k.value;
      changed();
      commit(true);
      pedDraw();
    };
  $$('.ped-layer').forEach((r, i) =>
    r.addEventListener('pointerdown', ev => {
      if (ev.target.closest('input,select,button')) return;
      if (PED.layer !== i) {
        PED.layer = i;
        $$('.ped-layer').forEach((o, j) => o.classList.toggle('on', j === i));
        pedDraw();
      }
    })
  );
  $$('.ped-thumb').forEach(c => {
    const im = dioImg(c.dataset.limg);
    const x = c.getContext('2d');
    x.clearRect(0, 0, 40, 40);
    if (dioOk(im)) {
      const w = im.naturalWidth || im.width,
        h = im.naturalHeight || im.height,
        s = Math.min(40 / w, 40 / h);
      x.imageSmoothingEnabled = false;
      x.drawImage(im, (40 - w * s) / 2, (40 - h * s) / 2, w * s, h * s);
    }
  });
}
addEventListener('keydown', ev => {
  if (!SCN.ped || PED.sel == null || ev.target.closest('input,textarea,select')) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    const M = pedM();
    if (M && M.fx && M.fx[PED.sel]) {
      ev.preventDefault();
      M.fx.splice(PED.sel, 1);
      PED.sel = null;
      changed();
      commit(true);
      render();
    }
  }
});
/* ---------- turntable ---------- */
async function pedMount() {
  const cv = $('#pedPv'),
    k = SCN.ped,
    M = pedM();
  if (!cv || !M) return;
  const paths = scArt();
  await Promise.all(paths.map(p => atlasGet('art/' + p).catch(() => null)));
  if (!$('#pedPv')) return;
  pedBind();
  if (!PED.sc || PED.id !== k) {
    PED.sc = pedScene(k);
    PED.id = k;
    walkView.id = null;
  } else {
    PED.sc.props[0].k = k;
  }
  dioMount(cv, '__prop', {
    state: () => ({ mode: 'roam', roam: true, pos: PED.sc.hub, who: null, enc: [], npcs: [], exits: [] }),
    keys: () => false,
    onPick: () => {},
    onMove: () => {},
    cap: () => (ST.sec === 'scenes' && SCN.ped ? 40 : 0),
  }).then(() => {
    const l = $('#pedPvLoad');
    if (l) l.hidden = true;
  });
  frameTask('pedSpin', () => {
    if (!SCN.ped || ST.sec !== 'scenes') {
      frameStop('pedSpin');
      return;
    }
    if (PED.spin && typeof DGL !== 'undefined' && !DGL.drag) DGL.yawT = Math.sin(performance.now() / 2600) * 0.6;
  });
}
/* ---------- actions ---------- */
ACTS.pedOpen = d => {
  SCN.ped = d.k;
  PED.sel = null;
  PED.layer = null;
  PED.zoom = 0;
  PED.tool = 'move';
  render();
  setTimeout(() => {
    const e = $('#ped');
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
};
ACTS.pedClose = () => {
  SCN.ped = null;
  PED.sel = null;
  if (typeof DGL !== 'undefined') {
    DGL.yawT = 0;
  }
  walkView.id = null;
  render();
};
ACTS.pedTool = d => {
  PED.tool = d.t;
  render();
};
ACTS.pedFx = d => {
  PED.fxk = d.k;
  render();
};
ACTS.pedFxDel = () => {
  const M = pedM();
  if (M && M.fx && PED.sel != null) {
    M.fx.splice(PED.sel, 1);
    PED.sel = null;
    changed();
    commit(true);
    render();
  }
};
ACTS.pedZoom = d => {
  PED.zoom = clamp((PED.zoom || 4) + +d.z, 1, 14);
  pedDraw();
};
ACTS.pedSpin = () => {
  PED.spin = !PED.spin;
  if (!PED.spin && typeof DGL !== 'undefined') DGL.yawT = 0;
  render();
};
ACTS.pedGlowDel = () => {
  const M = pedM();
  delete M.glow;
  changed();
  commit(true);
  render();
};
ACTS.pedVaryReset = () => {
  const M = pedM();
  delete M.vary;
  delete M.wear;
  changed();
  commit(true);
  render();
};
ACTS.scGlowAdd2 = () => {
  const M = pedM();
  const ppu = scD().ppu || 34,
    im = dioImg(M.img);
  M.glow = { c: '#FFD27A', r: 1.4, y: +((im ? (im.naturalHeight || im.height) * 0.8 : 50) / ppu).toFixed(2) };
  changed();
  commit(true);
  render();
};
ACTS.pedLayerAdd = async d => {
  const M = pedM(),
    k = SCN.ped;
  let c;
  if (d.from === 'png') {
    const f = await pickFile('image/png');
    if (!f) return;
    c = await fileToCanvas(f);
    if (c.width > 400 || c.height > 400) return toast('Keep layers under 400×400 pixels.', 'err');
  } else {
    const src = await atlasGet('art/' + M.img).catch(() => null);
    if (!src) return toast('Could not read the main picture.', 'err');
    c = cnv(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
  }
  const L = M.layers || (M.layers = []);
  let n = L.length + 1;
  while (L.some(l => l.img === `scene/props/${k}_layer${n}.png`)) n++;
  const path = `scene/props/${k}_layer${n}.png`;
  markArt('art/' + path, c);
  const main = dioImg(M.img),
    same = main && (main.naturalWidth || main.width) === c.width && (main.naturalHeight || main.height) === c.height;
  const l = { img: path, dz: d.from === 'copy' ? -0.3 : -0.25 };
  if (!same) {
    l.ox = -Math.floor(c.width / 2);
    l.oy = -(c.height - 1);
  }
  L.push(l);
  PED.layer = L.length - 1;
  changed();
  commit(true);
  render();
  if (d.from === 'copy')
    toast(
      'Copied. Erase what shouldn’t be on this layer with “Pixels”, and from the main picture what should only be here.'
    );
};
ACTS.pedLayerDel = async d => {
  const M = pedM();
  if (!(await ask('Remove this layer? Its picture file stays in art/scene/props.', 'Remove'))) return;
  M.layers.splice(+d.i, 1);
  if (!M.layers.length) delete M.layers;
  PED.layer = null;
  changed();
  commit(true);
  render();
};
ACTS.pedLayerMove = d => {
  const M = pedM(),
    i = +d.i,
    j = i + +d.d;
  if (j < 0 || j >= M.layers.length) return;
  [M.layers[i], M.layers[j]] = [M.layers[j], M.layers[i]];
  PED.layer = j;
  changed();
  commit(true);
  render();
};
ACTS.pedLayerPx = d => {
  const M = pedM(),
    l = M.layers[+d.i];
  PED.layer = +d.i;
  scOpenPe('art/' + l.img, { kind: 'prop', k: SCN.ped, layer: +d.i });
};
/* pictures made here but not saved yet come from the Studio's own copies, not the server */
{
  const base = artLoad;
  setArtLoad(paths => base(paths.filter(p => !(ST.artDirty && ST.artDirty.has('art/' + p)))));
}

/* ---------- v19: a solid body behind the picture (game/js/solid-props.js) ---------- */
/* v32: how each placed copy of this prop varies, and its wear and tear (the game's defaults for its kind show as the
   starting values; anything set here overrides them for this prop everywhere) */
function pedVaryHTML(k) {
  const M = scD().props[k],
    b = `scenery.props.${k}`,
    D = typeof dglVaryOf === 'function' ? dglVaryOf(k, Object.assign({}, M, { vary: null, wear: null })) : { wear: {} },
    W = D.wear || {};
  return (
    `<h4>Variety and wear</h4><p class="help">Each placed copy draws its own values from where it stands, so a row of these doesn't look stamped out. Colour changes touch only the colourful parts (paint, leaves), not outlines, wood grain or faces; a hue window narrows them further (leaves but not trunks).</p>` +
    grid(
      fRange('Size ±', `${b}.vary.size`, { min: 0, max: 0.5, step: 0.01, def: D.size || 0 }),
      fRange('Hue ± (°)', `${b}.vary.hue`, { min: 0, max: 60, step: 1, def: D.hue || 0 }),
      fRange('Saturation ±', `${b}.vary.sat`, { min: 0, max: 0.5, step: 0.01, def: D.sat || 0 }),
      fRange('Brightness ±', `${b}.vary.val`, { min: 0, max: 0.4, step: 0.01, def: D.val || 0 }),
      fRange('Turn ± (°)', `${b}.vary.rot`, { min: 0, max: 45, step: 1, def: D.rot || 0 }),
      fRange('Lean ± (°)', `${b}.vary.lean`, { min: 0, max: 8, step: 0.5, def: D.lean || 0 }),
      fNum('Only colours near hue (°)', `${b}.vary.mask.0`, {
        opt: 1,
        min: 0,
        max: 360,
        step: 1,
        ph: D.mask ? String(D.mask[0]) : 'any',
        help: '0 red, 60 yellow, 120 green, 200 blue, 280 purple.',
      }),
      fNum('… within ± (°)', `${b}.vary.mask.1`, {
        opt: 1,
        min: 0,
        max: 180,
        step: 1,
        ph: D.mask ? String(D.mask[1]) : 'any',
      })
    ) +
    grid(
      fRange('Dirt', `${b}.wear.dirt`, { min: 0, max: 1.5, step: 0.05, def: W.dirt || 0 }),
      fRange('Moss', `${b}.wear.moss`, { min: 0, max: 1.5, step: 0.05, def: W.moss || 0 }),
      fRange('Faded paint', `${b}.wear.fade`, { min: 0, max: 1.5, step: 0.05, def: W.fade || 0 }),
      fRange('Cracks', `${b}.wear.crack`, { min: 0, max: 1.5, step: 0.05, def: W.crack || 0 })
    ) +
    `<div class="seg-row"><button class="btn sm subtle" data-act="pedVaryReset">Back to the defaults for this kind</button></div>`
  );
}
function pedVolHTML(k) {
  const M = scD().props[k],
    b = `scenery.props.${k}`;
  if (!M || M.build || typeof P3D_KINDS === 'undefined') return '';
  const auto = P3D_AUTO[k] || P3D_AUTO[M.group || k],
    names = Object.fromEntries(P3D_KINDS),
    preset = P3D_PARTS[k];
  const head = `<h4>Solid shape</h4><p class="help">The picture stays the front; the body behind it is made from the picture's own pixels.`;
  if (M.parts) {
    const PK = [
      ['lathe', 'Round (turned)'],
      ['flat', 'Laid flat (a top or water)'],
      ['slab', 'Thin slab'],
      ['block', 'Solid block'],
      ['puff', 'Rounded'],
      ['card', 'Flat picture'],
    ];
    const rows = M.parts
      .map(
        (
          q,
          i
        ) => `<div class="ped-part"><b style="color:${PED_PART_COL[i % PED_PART_COL.length]}">${i + 1}</b>${fSel('Shape', `${b}.parts.${i}.k`, PK)}${fNum('Left', `${b}.parts.${i}.r.0`, { step: 1 })}${fNum('Top', `${b}.parts.${i}.r.1`, { step: 1 })}${fNum('Right', `${b}.parts.${i}.r.2`, { step: 1 })}${fNum('Bottom', `${b}.parts.${i}.r.3`, { step: 1 })}
   ${q.k === 'flat' ? fNum('Lies at row', `${b}.parts.${i}.y`, { opt: 1, step: 1, ph: String(q.r[3]) }) : ''}${['slab', 'block', 'puff', 'flat'].includes(q.k) ? fNum('Depth (m)', `${b}.parts.${i}.d`, { opt: 1, min: 0.02, max: 6, step: 0.05, ph: q.k === 'flat' ? 'as wide' : '0.3' }) : ''}${q.k === 'lathe' ? fChk('Open top', `${b}.parts.${i}.open`, { num: 1 }) : ''}<button class="btn sm danger subtle" data-act="pedPartDel" data-i="${i}">Remove</button></div>`
      )
      .join('');
    return `${head} This prop is built from parts: rectangles of the picture in pixels (shown on the picture), each with its own shape. "Laid flat" turns a band drawn in three-quarter view (a basin's water, a table top) into a level surface. Pixels outside every part stay a flat picture.</p>${rows}
   <div class="seg-row"><button class="btn sm" data-act="pedPartAdd">+ Part</button><button class="btn sm subtle" data-act="pedPartsOff">${preset ? 'Back to the built-in parts' : 'One shape for the whole picture'}</button></div>`;
  }
  const tk = typeof p3dTreeKind === 'function' ? p3dTreeKind(k, M) : null;
  return `${head} Automatic here: ${tk === 'pine' ? 'turned whole (a cone of tiers)' : tk ? `a round trunk and a crown of leaf clumps${tk === 'bush' ? ' (no trunk)' : ''}` : preset ? `built-in parts (${preset.length})` : auto ? `${esc(names[auto[0]])}${auto[0] === 'lathe' ? '' : `, ${auto[1]} m deep`}` : 'flat picture'}.</p>
  ${grid(
    fSel(
      'Shape',
      `${b}.vol`,
      P3D_KINDS.filter(o => o[0]),
      { none: 'Automatic', opt: 1 }
    ),
    fNum('Depth (m)', `${b}.volDepth`, {
      opt: 1,
      min: 0.02,
      max: 6,
      step: 0.05,
      ph: auto && auto[0] !== 'lathe' ? String(auto[1]) : '0.3',
      help: 'How thick a slab or block is, or how far a rounded shape bulges. Not used for turned shapes.',
    })
  )}
  <div class="seg-row"><button class="btn sm" data-act="pedPartsOn">Build it from parts…</button></div>`;
}
const PED_PART_COL = ['#E0457B', '#2F9F5B', '#3E8FE0', '#E8A02E', '#8E6CCB', '#1FA8A0', '#C8323C', '#6B8E23'];
ACTS.pedPartsOn = () => {
  const M = pedM();
  if (!M) return;
  const im = dioImg(M.img),
    w = im ? im.naturalWidth || im.width : 40,
    h = im ? im.naturalHeight || im.height : 40;
  M.parts = clone(P3D_PARTS[SCN.ped] || [{ r: [0, 0, w, h], k: 'block', d: 0.5 }]);
  changed();
  commit(true);
  render();
};
ACTS.pedPartsOff = () => {
  const M = pedM();
  if (!M) return;
  delete M.parts;
  changed();
  commit(true);
  render();
};
ACTS.pedPartAdd = () => {
  const M = pedM();
  if (!M || !M.parts) return;
  const im = dioImg(M.img),
    w = im ? im.naturalWidth || im.width : 40,
    h = im ? im.naturalHeight || im.height : 40;
  M.parts.push({ r: [0, Math.round(h / 2), w, h], k: 'lathe' });
  changed();
  commit(true);
  render();
};
ACTS.pedPartDel = d => {
  const M = pedM();
  if (!M || !M.parts) return;
  M.parts.splice(+d.i, 1);
  changed();
  commit(true);
  render();
};
/* the parts' rectangles on the picture */
{
  const _pd = pedDraw;
  /* adds a layer to the drawing on purpose */
  setPedDraw(function () {
    _pd();
    const M = pedM(),
      cv = $('#pedCv');
    if (!M || !cv || typeof P3D_PARTS === 'undefined') return;
    const P = M.parts || P3D_PARTS[SCN.ped];
    if (!P) return;
    const Bd = pedBounds(M),
      Z = PED.zoom,
      X = v => (v - Bd.x0) * Z,
      Y = v => (v - Bd.y0) * Z,
      x = cv.getContext('2d');
    x.save();
    x.lineWidth = 2;
    P.forEach((q, i) => {
      x.strokeStyle = PED_PART_COL[i % PED_PART_COL.length];
      x.setLineDash(q.k === 'flat' ? [5, 3] : []);
      x.strokeRect(X(M.ox + q.r[0]) + 1, Y(M.oy + q.r[1]) + 1, (q.r[2] - q.r[0]) * Z - 2, (q.r[3] - q.r[1]) * Z - 2);
      x.fillStyle = x.strokeStyle;
      x.font = '700 11px system-ui';
      x.fillText(String(i + 1), X(M.ox + q.r[0]) + 4, Y(M.oy + q.r[1]) + 13);
    });
    x.restore();
  });
}
/* ---------- v17: the 3D building plan ---------- */
const PED_KINDS = [
  ['hip', 'Hip roof (slopes on all four sides)'],
  ['gable', 'Gable roof (ridge left to right)'],
  ['gableF', 'Front gable (the gable faces you)'],
  ['flat', 'Flat roof behind a parapet'],
  ['shed', 'Lean-to (one slope rising to the back)'],
];
function pedBuildHTML(k) {
  const M = scD().props[k],
    b = `scenery.props.${k}.build`,
    B = M.build;
  if (!B)
    return M.box
      ? `<h4>3D building</h4><p class="help">Shown as its picture. As a 3D building it gets real side walls, a roof at its pitch and windows you can look into.</p><button class="btn sm" data-act="pedBuildOn">Make it a 3D building</button>`
      : '';
  const tex = BLD_TEX_NAMES.map((n, i) => [i, n]);
  return `<h4>3D building</h4><p class="help">The front is this picture with the roof part cut away (above the eave line) and the glass made see-through. Walls, roof and chimney are built from the settings below. The guides on the picture show the walls (green), the eave (pink) and the windows (blue).</p>
  ${grid(
    fSel('Roof', `${b}.kind`, PED_KINDS, { rr: 1 }),
    B.kind === 'gableF'
      ? fNum('Gable peak (px from the base)', `${b}.apex`, { step: 1 })
      : fRange('Roof pitch (degrees)', `${b}.pitch`, { min: 10, max: 60, step: 1, def: 40 }),
    fNum('Eave (px from the base)', `${b}.eave`, {
      step: 1,
      help: 'Picture rows above this line are roof (cut away). Flat roofs keep anything that isn’t roof colour, like signs.',
    }),
    fNum('Left wall (px)', `${b}.wall.0`, { step: 1 }),
    fNum('Right wall (px)', `${b}.wall.1`, { step: 1 }),
    fNum('Overhang (m)', `${b}.over`, { min: 0, max: 1.2, step: 0.02 }),
    fNum('Storeys', `${b}.floors`, { min: 1, max: 12, step: 1, help: 'Side and back windows per storey.' })
  )}
  <div class="grid colors">${fColor('Walls', `${b}.wallCol`)}${fColor('Roof', `${b}.roofCol`)}${fColor('Trim and frames', `${b}.trimCol`)}</div>
  ${grid(fSel('Wall texture', `${b}.wallTex`, tex, { num: 1 }), fSel('Roof texture', `${b}.roofTex`, tex, { num: 1 }), fChk('Windows on the sides and back', `${b}.sideWin`, { help: 'Off: plain side walls.' }))}
  <p class="help">${(B.win || []).length} see-through panes found in the picture (tools/build-buildings.py finds them by their glass colours). Rooms behind the glass: ${(B.rooms || [0]).map(i => BLD_ROOM_NAMES[i] || i).join(', ')}.</p>
  <div class="seg-row"><button class="btn sm subtle" data-act="pedBuildRooms">Other rooms</button><button class="btn sm subtle" data-act="pedBuildNoWin">No see-through panes</button><button class="btn sm subtle danger" data-act="pedBuildOff">Use the picture instead</button></div>`;
}
ACTS.pedBuildOn = () => {
  const M = pedM(),
    im = dioImg(M.img);
  if (!M || !im) return;
  const w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height,
    ppu = scD().ppu || 34,
    hw = Math.round(((M.box ? M.box[0] : w / ppu) * ppu) / 2);
  M.build = {
    kind: 'hip',
    wall: [-hw, hw],
    eave: Math.round(M.oy + h * 0.42),
    pitch: 38,
    over: 0.25,
    wallCol: '#E8DCC0',
    wallTex: 0,
    roofCol: '#A85448',
    roofTex: 8,
    trimCol: '#7A5440',
    floors: 1,
    sideWin: true,
    rooms: [0, 1, 2],
    win: [],
    glass: [],
    roofRamp: [],
  };
  changed();
  commit(true);
  render();
};
ACTS.pedBuildOff = async () => {
  const M = pedM();
  if (!M || !(await ask('Show this building as its picture again? Its 3D settings are removed.', 'Use the picture')))
    return;
  delete M.build;
  changed();
  commit(true);
  render();
};
ACTS.pedBuildNoWin = () => {
  const M = pedM();
  if (!M || !M.build) return;
  M.build.win = [];
  changed();
  commit(true);
  render();
};
ACTS.pedBuildRooms = () => {
  const M = pedM();
  if (!M || !M.build) return;
  const r = M.build.rooms || [0];
  M.build.rooms = r.map(i => (i + 1) % BLD_ROOM_NAMES.length);
  changed();
  commit(true);
  render();
};
/* guides for the plan on the picture */
{
  const _pd = pedDraw;
  /* adds a layer to the drawing on purpose */
  setPedDraw(function () {
    _pd();
    const M = pedM(),
      cv = $('#pedCv');
    if (!M || !M.build || !cv) return;
    const B = M.build,
      Bd = pedBounds(M),
      Z = PED.zoom,
      X = v => (v - Bd.x0) * Z,
      Y = v => (v - Bd.y0) * Z,
      x = cv.getContext('2d');
    x.save();
    x.lineWidth = 2;
    x.setLineDash([6, 4]);
    x.strokeStyle = '#2F9F5B';
    for (const w of B.wall || []) {
      x.beginPath();
      x.moveTo(X(w), Y(Bd.y0));
      x.lineTo(X(w), Y(0));
      x.stroke();
    }
    x.strokeStyle = '#D0458A';
    x.beginPath();
    x.moveTo(X(Bd.x0), Y(B.eave));
    x.lineTo(X(Bd.x1), Y(B.eave));
    x.stroke();
    if (B.kind === 'gableF' && B.apex != null) {
      x.beginPath();
      x.moveTo(X(B.wall[0]), Y(B.eave));
      x.lineTo(X(0), Y(B.apex));
      x.lineTo(X(B.wall[1]), Y(B.eave));
      x.stroke();
    }
    x.setLineDash([]);
    x.strokeStyle = '#3E8FE0';
    for (const r of B.win || []) x.strokeRect(X(r[0]), Y(r[1]), r[2] * Z, r[3] * Z);
    x.restore();
  });
}
