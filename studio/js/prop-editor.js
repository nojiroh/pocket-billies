'use strict';
/* ================= POCKET BILLIES STUDIO · prop editor =================
   One place for everything about a walk-scene prop: its picture with the base point, effects (lamp glows, windows,
   fires, smoke, spray, sparkles), door and footprint drawn on it and editable by clicking and dragging; extra picture
   layers placed in front of or behind the main one for depth; which way each layer faces; glowing layers; and a 3D
   turntable that shows the result in the game's renderer while you work. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { modelEditorHTML, provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { frameStop, frameTask } from '../../game/js/frame-scheduler.js';
import { artLoad, makeCanvas, setArtLoad } from '../../game/js/art.js';
import { artImage, imageReady, layerAsProp, setWalkData, walkData, walkView } from '../../game/js/walk-view.js';
import { SURFACE_MATERIALS } from '../../game/js/engine/webgl.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { propMaterial, propVariety } from '../../game/js/walk/prop-look.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { BUILDING_ROOM_NAMES, BUILDING_TEXTURE_NAMES } from '../../game/js/buildings.js';
import { SOLID_PROP_BODIES, SOLID_PROP_KINDS, SOLID_PROP_PARTS, solidTreeKind } from '../../game/js/solid-props.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  colorField,
  commit,
  grid,
  numberField,
  rangeField,
  render,
  selectField,
  studioState,
  textField,
  toast,
} from './studio-app.js';
import { atlasGet, fileToCanvas, markArt, pickFile } from './sprites.js';
import { mapEditor, openSceneryPixelEditor, sceneryArtPaths, sceneryCatalog } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  PART_COLORS: [() => PART_COLORS],
  PROP_EFFECT_KINDS: [() => PROP_EFFECT_KINDS],
  ROOF_KINDS: [() => ROOF_KINDS],
  bindPropEditor: [() => bindPropEditor, v => (bindPropEditor = v)],
  buildingPlanHTML: [() => buildingPlanHTML, v => (buildingPlanHTML = v)],
  drawPropEditor: [() => drawPropEditor, v => setDrawPropEditor(v)],
  editedProp: [() => editedProp],
  mountPropTurntable: [() => mountPropTurntable, v => ((mountPropTurntable = v), provide({ mountPropTurntable }))],
  moveBasePoint: [() => moveBasePoint, v => (moveBasePoint = v)],
  propEditor: [() => propEditor],
  propEditorCardHTML: [() => propEditorCardHTML, v => ((propEditorCardHTML = v), provide({ propEditorCardHTML }))],
  propEditorHit: [() => propEditorHit, v => (propEditorHit = v)],
  propEditorOpenHere: [() => propEditorOpenHere, v => (propEditorOpenHere = v)],
  propEditorPoint: [() => propEditorPoint, v => (propEditorPoint = v)],
  propPictureBounds: [() => propPictureBounds, v => (propPictureBounds = v)],
  propVaryHTML: [() => propVaryHTML, v => (propVaryHTML = v)],
  setDrawPropEditor: [() => setDrawPropEditor, v => (setDrawPropEditor = v)],
  solidBodyHTML: [() => solidBodyHTML, v => (solidBodyHTML = v)],
  splitIntoLayer: [() => splitIntoLayer, v => (splitIntoLayer = v)],
  turntableMap: [() => turntableMap, v => (turntableMap = v)],
});
/* eslint-enable no-func-assign */
provide({ drawPropEditor, mountPropTurntable, propEditorCardHTML });
/* to-module: end */
export const propEditor = {
  v: 0,
  tool: 'move',
  fxk: 'glow',
  zoom: 0,
  spin: true,
  sel: null,
  drag: null,
  sc: null,
  id: null,
};
const PROP_EFFECT_KINDS = [
  ['glow', 'Lamp glow', '#FFC94A'],
  ['window', 'Lit window', '#FFB35C'],
  ['fire', 'Fire', '#FF6A2A'],
  ['smoke', 'Smoke', '#B9B4C8'],
  ['spray', 'Water spray', '#62C6F0'],
  ['sparkle', 'Sparkle', '#F6F0FF'],
];
export const editedProp = () => (mapEditor.ped ? sceneryCatalog().props[mapEditor.ped] : null);
/* the turntable scene: a patch of grass with the prop in the middle */
function turntableMap(k) {
  const C = sceneryCatalog(),
    M = C.props[k],
    T = C.terrains,
    ppu = C.ppu || 34,
    tk = Object.keys(T).find(c => /grass/i.test(T[c].name)) || Object.keys(T)[0] || 'g';
  const im = artImage(M.img),
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
    blur: 0,
    plain: 1 /* phase 09 batch 1: no graphic effects on the turntable (engine/settings.js PLAIN_LOOK) */,
  };
}
{
  const base = walkData;
  setWalkData(() => {
    const d = base();
    if (propEditor.sc) d.scenes = Object.assign({}, d.scenes, { __prop: propEditor.sc });
    return d;
  });
}
/* ---------- the card ---------- */
export function propEditorCardHTML(k) {
  const C = sceneryCatalog(),
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
    .map(
      ([t, n]) =>
        `<button class="seg ${propEditor.tool === t ? 'on' : ''}" data-act="pedTool" data-t="${t}">${n}</button>`
    )
    .join('');
  const fxk =
    propEditor.tool === 'add'
      ? `<span class="px-tools">${PROP_EFFECT_KINDS.map(([f, n, c]) => `<button class="seg sm ${propEditor.fxk === f ? 'on' : ''}" data-act="pedFx" data-k="${f}"><i class="ped-dot" style="background:${c}"></i>${n}</button>`).join('')}</span>`
      : '';
  const sel = propEditor.sel,
    fx = M.fx || [],
    selRow =
      typeof sel === 'number' && fx[sel]
        ? `<div class="ped-selrow"><b>${escapeHtml((PROP_EFFECT_KINDS.find(f => f[0] === fx[sel].k) || [0, fx[sel].k])[1])}</b> at ${fx[sel].x}, ${fx[sel].y}<select id="pedFxK">${PROP_EFFECT_KINDS.map(([f, n]) => `<option value="${f}" ${fx[sel].k === f ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn sm danger subtle" data-act="pedFxDel">Remove</button></div>`
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
    return `<div class="ped-layer ${propEditor.layer === i ? 'on' : ''}"><canvas class="ped-thumb" data-limg="${escapeHtml(l.img || '')}" width="40" height="40"></canvas>
  <div class="ped-lf"><div class="ped-lh"><b>Layer ${i + 1}</b><small class="mono">${escapeHtml((l.img || '').split('/').pop())}</small><span class="grow"></span>
   <button class="btn sm subtle" data-act="pedLayerPx" data-i="${i}" title="Edit this layer's pixels">Pixels</button><button class="btn sm subtle" data-act="pedLayerMove" data-i="${i}" data-d="-1" title="Move up the list">↑</button><button class="btn sm subtle" data-act="pedLayerMove" data-i="${i}" data-d="1" title="Move down the list">↓</button><button class="btn sm danger subtle" data-act="pedLayerDel" data-i="${i}">Remove</button></div>
   <div class="grid ped-lg">${rangeField('Depth (m, + is behind)', `${p}.dz`, { min: -3, max: 3, step: 0.05, def: 0 })}${numberField('Across (px)', `${p}.dx`, { step: 1, opt: 1 })}${numberField('Up (px)', `${p}.dy`, { step: 1, opt: 1 })}
   <label class="fld"><span>Facing</span>${face(`${p}.face`, l.face)}</label>${rangeField('Glow (lights itself)', `${p}.glow`, { min: 0, max: 2, step: 0.05, def: 0 })}${rangeField('Sway with the main picture', `${p}.sway`, { min: 0, max: 2, step: 0.05, def: 1 })}</div></div></div>`;
  }).join('');
  const set =
    grid(
      textField('Name', `${b}.name`),
      textField('Variant group', `${b}.group`, { opt: 1 }),
      numberField('Shadow size (m)', `${b}.shadow`, { min: 0, max: 4, step: 0.05 }),
      rangeField('Sways in the wind', `${b}.sway`, { min: 0, max: 1, step: 0.05, def: 0 }),
      numberField('Solid radius (m)', `${b}.solid`, {
        opt: 1,
        min: 0,
        max: 4,
        step: 0.05,
        help: 'People walk around this. Empty: guessed from the shadow. 0: walk through.',
      }),
      numberField('Footprint width (m)', `${b}.box.0`, {
        opt: 1,
        min: 0,
        max: 12,
        step: 0.1,
        help: 'Buildings and fences: a box instead of a circle. Buildings also cast solid shadows from it.',
      }),
      numberField('Footprint depth (m)', `${b}.box.1`, { opt: 1, min: 0, max: 12, step: 0.1 }),
      numberField('Walkable radius (m)', `${b}.walk`, {
        opt: 1,
        min: 0,
        max: 4,
        step: 0.1,
        help: 'Stepping stones and bridges: opens water under it.',
      }),
      checkboxField('Lies flat on the ground', `${b}.flat`, { num: 1 })
    ) +
    `<div class="grid"><label class="fld"><span>Main picture faces</span>${face(`${b}.face`, M.face)}</label><label class="fld"><span>Material</span><select data-p="${b}.mat" data-k="sel" data-opt="1">${[
      [
        '',
        'Automatic (' +
          (typeof propMaterial === 'function' ? SURFACE_MATERIALS[propMaterial(k, M)].name : 'from the name') +
          ')',
      ],
    ]
      .concat(
        Object.entries(typeof SURFACE_MATERIALS !== 'undefined' ? SURFACE_MATERIALS : {}).map(([k, m]) => [k, m.name])
      )
      .map(([a, n]) => `<option value="${a}" ${(M.mat || '') === a ? 'selected' : ''}>${n}</option>`)
      .join('')}</select></label></div>` +
    (M.glow
      ? grid(
          colorField('Glow color', `${b}.glow.c`),
          numberField('Glow size (m)', `${b}.glow.r`, { step: 0.1, min: 0.2, max: 6 }),
          numberField('Glow height (m)', `${b}.glow.y`, { step: 0.1, min: 0, max: 8 })
        ) + '<button class="btn sm subtle danger" data-act="pedGlowDel">Remove the glow</button>'
      : '<button class="btn sm subtle" data-act="scGlowAdd2">Add a light glow</button>');
  return card(
    `Prop editor · ${escapeHtml(M.name || k)}`,
    `<div class="ped" id="ped">
  <div class="ped-l"><div class="ped-bar"><span class="px-tools">${tools}</span><span class="px-tools"><button class="seg" data-act="pedZoom" data-z="-1">−</button><button class="seg" data-act="pedZoom" data-z="1">+</button></span></div>${fxk}
   <div class="ped-stage"><canvas id="pedCv"></canvas></div>${selRow}
   <p class="help">${{ move: 'Drag an effect, the door or the base point. Click an effect to select it; Delete removes it.', add: 'Click the picture to add the effect. It moves and flickers in the game exactly where you put it.', door: 'Click where people should walk to when the prop is tapped.', base: 'Click where the prop touches the ground. Effects and the door stay where they are on the picture.', split: 'Drag a box around a part (a roof, a porch, the top of a tree). It moves out of the main picture onto a new layer you can push back or bring forward.' }[propEditor.tool]}</p>
   <div class="ped-tt"><div class="sc-pv ped-pv"><canvas id="pedPv" data-keep="walk-gl"></canvas><div class="sc-pv-load" id="pedPvLoad">Loading…</div></div>
   <div class="seg-row"><button class="seg ${propEditor.spin ? 'on' : ''}" data-act="pedSpin">Turn slowly</button><span class="help">Drag the turntable to turn it yourself. It turns as far as the game camera can; layers show their depth.</span></div></div></div>
  <div class="ped-r"><h4>Layers</h4><p class="help">Extra pictures drawn in front of or behind the main one. Put a porch, a sign or leaves on their own layer and give them a little depth, and the prop gains real depth when the camera moves. A glowing layer lights itself (windows at night, crystals).</p>
   ${rows || '<p class="help"><i>No extra layers yet.</i></p>'}<div class="seg-row"><button class="btn sm" data-act="pedLayerAdd" data-from="png">+ Layer from PNG</button><button class="btn sm" data-act="pedLayerAdd" data-from="copy">+ Copy of the main picture</button><button class="btn sm subtle" data-act="scEditProp" data-k="${escapeHtml(k)}">Edit the main picture’s pixels</button></div>
   <h4>Settings</h4>${set}${propVaryHTML(k)}${typeof modelEditorHTML === 'function' ? modelEditorHTML(k) : ''}${solidBodyHTML(k)}${buildingPlanHTML(k)}</div></div>`,
    {
      acts: `<button class="btn sm primary" data-act="pedClose">Done</button>`,
      sub: 'Changes show in the turntable and in every scene right away.',
    }
  );
}
/* ---------- picture view ---------- */
function propPictureBounds(M) {
  const ims = [[artImage(M.img), M.ox, M.oy]].concat(
    (M.layers || []).map(l => {
      const LM = layerAsProp(M, l);
      return [artImage(l.img), LM.ox, LM.oy];
    })
  );
  let x0 = -20,
    y0 = -20,
    x1 = 20,
    y1 = 8;
  for (const [im, ox, oy] of ims) {
    if (!imageReady(im)) continue;
    x0 = Math.min(x0, ox);
    y0 = Math.min(y0, oy);
    x1 = Math.max(x1, ox + (im.naturalWidth || im.width));
    y1 = Math.max(y1, oy + (im.naturalHeight || im.height));
  }
  const ppu = sceneryCatalog().ppu || 34;
  if (M.box) {
    x0 = Math.min(x0, (-M.box[0] * ppu) / 2);
    x1 = Math.max(x1, (M.box[0] * ppu) / 2);
  }
  return { x0: x0 - 6, y0: y0 - 6, x1: x1 + 6, y1: y1 + 10 };
}
function drawPropEditor() {
  const cv = $('#pedCv'),
    M = editedProp();
  if (!cv || !M) return;
  const B = propPictureBounds(M),
    W = B.x1 - B.x0,
    H = B.y1 - B.y0;
  if (!propEditor.zoom) propEditor.zoom = clamp(Math.floor(440 / Math.max(W, H)), 2, 10);
  const Z = propEditor.zoom,
    ppu = sceneryCatalog().ppu || 34;
  cv.width = W * Z;
  cv.height = H * Z;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const X = v => (v - B.x0) * Z,
    Y = v => (v - B.y0) * Z;
  /* far layers first, then the main picture (depth 0), then the near ones */
  const list = [{ im: artImage(M.img), ox: M.ox, oy: M.oy, dz: 0, i: -1 }]
    .concat(
      (M.layers || []).map((l, i) => {
        const LM = layerAsProp(M, l);
        return { im: artImage(l.img), ox: LM.ox, oy: LM.oy, dz: l.dz || 0, i };
      })
    )
    .sort((a, b) => b.dz - a.dz);
  for (const o of list) {
    if (!imageReady(o.im)) continue;
    x.globalAlpha = propEditor.layer != null && propEditor.layer !== o.i ? 0.55 : 1;
    x.drawImage(o.im, X(o.ox), Y(o.oy), (o.im.naturalWidth || o.im.width) * Z, (o.im.naturalHeight || o.im.height) * Z);
    if (propEditor.layer === o.i) {
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
  if (propEditor.box) {
    const b = propEditor.box;
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
    const c = (PROP_EFFECT_KINDS.find(f => f[0] === e.k) || [0, 0, '#fff'])[2],
      px = X(e.x) + Z / 2,
      py = Y(e.y) + Z / 2;
    x.fillStyle = c;
    x.strokeStyle = propEditor.sel === i ? '#1F6E6F' : '#2A2238';
    x.lineWidth = propEditor.sel === i ? 3 : 1.5;
    x.beginPath();
    x.arc(px, py, propEditor.sel === i ? 8 : 6, 0, 7);
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
function setDrawPropEditor(v) {
  drawPropEditor = v; // eslint-disable-line no-func-assign
  provide({ drawPropEditor });
}
function propEditorPoint(ev) {
  const cv = $('#pedCv'),
    M = editedProp(),
    B = propPictureBounds(M),
    r = cv.getBoundingClientRect(),
    Z = propEditor.zoom;
  return {
    x: (((ev.clientX - r.left) / r.width) * cv.width) / Z + B.x0,
    y: (((ev.clientY - r.top) / r.height) * cv.height) / Z + B.y0,
    k: (Z * r.width) / cv.width,
  };
}
function propEditorHit(M, p) {
  const ppu = sceneryCatalog().ppu || 34,
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
async function splitIntoLayer(b) {
  const M = editedProp(),
    k = mapEditor.ped;
  if (!M || !b) return;
  const src = await atlasGet('art/' + M.img).catch(() => null);
  if (!src) return toast('Could not read the picture.', 'err');
  const x0 = Math.max(0, Math.floor(Math.min(b.x0, b.x1) - M.ox)),
    y0 = Math.max(0, Math.floor(Math.min(b.y0, b.y1) - M.oy)),
    x1 = Math.min(src.width, Math.ceil(Math.max(b.x0, b.x1) - M.ox)),
    y1 = Math.min(src.height, Math.ceil(Math.max(b.y0, b.y1) - M.oy));
  if (x1 - x0 < 2 || y1 - y0 < 2) return toast('Drag a bigger box around the part to split off.');
  const lay = makeCanvas(src.width, src.height);
  lay.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  const main = makeCanvas(src.width, src.height),
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
  propEditor.layer = L.length - 1;
  changed();
  commit(true);
  render();
  toast('Split off. Set its depth: positive pushes it back, negative brings it forward.');
}
function moveBasePoint(M, nx, ny) {
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
function bindPropEditor() {
  const cv = $('#pedCv');
  if (!cv) return;
  drawPropEditor();
  cv.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    const M = editedProp(),
      h = propEditorHit(M, propEditorPoint(ev));
    if (h && h.k === 'fx') {
      M.fx.splice(h.i, 1);
      propEditor.sel = null;
      changed();
      commit(true);
      render();
    }
  });
  cv.addEventListener('pointerdown', ev => {
    if (ev.button === 2) return;
    const M = editedProp(),
      p = propEditorPoint(ev),
      ppu = sceneryCatalog().ppu || 34;
    if (propEditor.tool === 'add') {
      (M.fx || (M.fx = [])).push({ k: propEditor.fxk, x: Math.round(p.x), y: Math.round(p.y) });
      propEditor.sel = M.fx.length - 1;
      changed();
      commit(true);
      render();
      return;
    }
    if (propEditor.tool === 'door') {
      M.door = Object.assign(M.door || {}, { x: Math.round(p.x) });
      changed();
      commit(true);
      drawPropEditor();
      return;
    }
    if (propEditor.tool === 'base') {
      moveBasePoint(M, p.x, p.y);
      changed();
      commit(true);
      drawPropEditor();
      return;
    }
    if (propEditor.tool === 'split') {
      propEditor.box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      propEditor.drag = { h: { k: 'box' } };
      cv.setPointerCapture(ev.pointerId);
      return;
    }
    const h = propEditorHit(M, p);
    if (!h) {
      if (propEditor.sel != null) {
        propEditor.sel = null;
        render();
      }
      return;
    }
    if (h.k === 'fx' && propEditor.sel !== h.i) {
      propEditor.sel = h.i;
      render();
      return;
    }
    propEditor.drag = { h, x0: p.x, y0: p.y };
    cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener('pointermove', ev => {
    const D = propEditor.drag;
    if (!D) return;
    const M = editedProp(),
      p = propEditorPoint(ev),
      ppu = sceneryCatalog().ppu || 34;
    if (D.h.k === 'box') {
      propEditor.box.x1 = p.x;
      propEditor.box.y1 = p.y;
      drawPropEditor();
      return;
    }
    if (D.h.k === 'fx') {
      const e = M.fx[D.h.i];
      e.x = Math.round(p.x);
      e.y = Math.round(p.y);
    } else if (D.h.k === 'door') M.door.x = Math.round(p.x);
    else if (D.h.k === 'glow') M.glow.y = +Math.max(0, -p.y / ppu).toFixed(2);
    else if (D.h.k === 'base') {
      moveBasePoint(M, p.x - D.x0, p.y - D.y0);
      D.x0 = Math.round(p.x);
      D.y0 = Math.round(p.y);
    }
    drawPropEditor();
  });
  cv.addEventListener('pointerup', () => {
    if (propEditor.drag && propEditor.drag.h.k === 'box') {
      propEditor.drag = null;
      const b = propEditor.box;
      propEditor.box = null;
      splitIntoLayer(b);
      return;
    }
    if (propEditor.drag) {
      propEditor.drag = null;
      changed();
      commit(true);
    }
  });
  const k = $('#pedFxK');
  if (k)
    k.onchange = () => {
      const M = editedProp();
      M.fx[propEditor.sel].k = k.value;
      changed();
      commit(true);
      drawPropEditor();
    };
  $$('.ped-layer').forEach((r, i) =>
    r.addEventListener('pointerdown', ev => {
      if (ev.target.closest('input,select,button')) return;
      if (propEditor.layer !== i) {
        propEditor.layer = i;
        $$('.ped-layer').forEach((o, j) => o.classList.toggle('on', j === i));
        drawPropEditor();
      }
    })
  );
  $$('.ped-thumb').forEach(c => {
    const im = artImage(c.dataset.limg);
    const x = c.getContext('2d');
    x.clearRect(0, 0, 40, 40);
    if (imageReady(im)) {
      const w = im.naturalWidth || im.width,
        h = im.naturalHeight || im.height,
        s = Math.min(40 / w, 40 / h);
      x.imageSmoothingEnabled = false;
      x.drawImage(im, (40 - w * s) / 2, (40 - h * s) / 2, w * s, h * s);
    }
  });
}
addEventListener('keydown', ev => {
  if (!mapEditor.ped || propEditor.sel == null || ev.target.closest('input,textarea,select')) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    const M = editedProp();
    if (M && M.fx && M.fx[propEditor.sel]) {
      ev.preventDefault();
      M.fx.splice(propEditor.sel, 1);
      propEditor.sel = null;
      changed();
      commit(true);
      render();
    }
  }
});
/* ---------- turntable ---------- */
/* phase 09 batch 1: the prop editor opens in Walk scenes or in the Props section */
function propEditorOpenHere() {
  return !!mapEditor.ped && (studioState.sec === 'scenes' || studioState.sec === 'props');
}
export async function mountPropTurntable() {
  const cv = $('#pedPv'),
    k = mapEditor.ped,
    M = editedProp();
  if (!cv || !M) return;
  const paths = sceneryArtPaths();
  await Promise.all(paths.map(p => atlasGet('art/' + p).catch(() => null)));
  if (!$('#pedPv')) return;
  bindPropEditor();
  if (!propEditor.sc || propEditor.id !== k) {
    propEditor.sc = turntableMap(k);
    propEditor.id = k;
    walkView.id = null;
  } else {
    propEditor.sc.props[0].k = k;
  }
  /* phase 09 batch 1: the Props section shows any of the prop's variants on the turntable */
  if (propEditor.v) propEditor.sc.props[0].v = propEditor.v;
  else delete propEditor.sc.props[0].v;
  mountWalkView(cv, '__prop', {
    state: () => ({ mode: 'roam', roam: true, pos: propEditor.sc.hub, who: null, enc: [], npcs: [], exits: [] }),
    keys: () => false,
    onPick: () => {},
    onMove: () => {},
    cap: () => (propEditorOpenHere() ? 40 : 0),
  }).then(() => {
    const l = $('#pedPvLoad');
    if (l) l.hidden = true;
  });
  frameTask('pedSpin', () => {
    if (!propEditorOpenHere()) {
      frameStop('pedSpin');
      return;
    }
    if (propEditor.spin && typeof walkRenderer !== 'undefined' && !walkRenderer.drag)
      walkRenderer.yawT = Math.sin(performance.now() / 2600) * 0.6;
  });
}
/* ---------- actions ---------- */
ACTIONS.pedOpen = d => {
  mapEditor.ped = d.k;
  propEditor.sel = null;
  propEditor.layer = null;
  propEditor.zoom = 0;
  propEditor.tool = 'move';
  render();
  setTimeout(() => {
    const e = $('#ped');
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
};
ACTIONS.pedClose = () => {
  mapEditor.ped = null;
  propEditor.sel = null;
  if (typeof walkRenderer !== 'undefined') {
    walkRenderer.yawT = 0;
  }
  walkView.id = null;
  render();
};
ACTIONS.pedTool = d => {
  propEditor.tool = d.t;
  render();
};
ACTIONS.pedFx = d => {
  propEditor.fxk = d.k;
  render();
};
ACTIONS.pedFxDel = () => {
  const M = editedProp();
  if (M && M.fx && propEditor.sel != null) {
    M.fx.splice(propEditor.sel, 1);
    propEditor.sel = null;
    changed();
    commit(true);
    render();
  }
};
ACTIONS.pedZoom = d => {
  propEditor.zoom = clamp((propEditor.zoom || 4) + +d.z, 1, 14);
  drawPropEditor();
};
ACTIONS.pedSpin = () => {
  propEditor.spin = !propEditor.spin;
  if (!propEditor.spin && typeof walkRenderer !== 'undefined') walkRenderer.yawT = 0;
  render();
};
ACTIONS.pedGlowDel = () => {
  const M = editedProp();
  delete M.glow;
  changed();
  commit(true);
  render();
};
ACTIONS.pedVaryReset = () => {
  const M = editedProp();
  delete M.vary;
  delete M.wear;
  changed();
  commit(true);
  render();
};
ACTIONS.scGlowAdd2 = () => {
  const M = editedProp();
  const ppu = sceneryCatalog().ppu || 34,
    im = artImage(M.img);
  M.glow = { c: '#FFD27A', r: 1.4, y: +((im ? (im.naturalHeight || im.height) * 0.8 : 50) / ppu).toFixed(2) };
  changed();
  commit(true);
  render();
};
ACTIONS.pedLayerAdd = async d => {
  const M = editedProp(),
    k = mapEditor.ped;
  let c;
  if (d.from === 'png') {
    const f = await pickFile('image/png');
    if (!f) return;
    c = await fileToCanvas(f);
    if (c.width > 400 || c.height > 400) return toast('Keep layers under 400×400 pixels.', 'err');
  } else {
    const src = await atlasGet('art/' + M.img).catch(() => null);
    if (!src) return toast('Could not read the main picture.', 'err');
    c = makeCanvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
  }
  const L = M.layers || (M.layers = []);
  let n = L.length + 1;
  while (L.some(l => l.img === `scene/props/${k}_layer${n}.png`)) n++;
  const path = `scene/props/${k}_layer${n}.png`;
  markArt('art/' + path, c);
  const main = artImage(M.img),
    same = main && (main.naturalWidth || main.width) === c.width && (main.naturalHeight || main.height) === c.height;
  const l = { img: path, dz: d.from === 'copy' ? -0.3 : -0.25 };
  if (!same) {
    l.ox = -Math.floor(c.width / 2);
    l.oy = -(c.height - 1);
  }
  L.push(l);
  propEditor.layer = L.length - 1;
  changed();
  commit(true);
  render();
  if (d.from === 'copy')
    toast(
      'Copied. Erase what shouldn’t be on this layer with “Pixels”, and from the main picture what should only be here.'
    );
};
ACTIONS.pedLayerDel = async d => {
  const M = editedProp();
  if (!(await ask('Remove this layer? Its picture file stays in art/scene/props.', 'Remove'))) return;
  M.layers.splice(+d.i, 1);
  if (!M.layers.length) delete M.layers;
  propEditor.layer = null;
  changed();
  commit(true);
  render();
};
ACTIONS.pedLayerMove = d => {
  const M = editedProp(),
    i = +d.i,
    j = i + +d.d;
  if (j < 0 || j >= M.layers.length) return;
  [M.layers[i], M.layers[j]] = [M.layers[j], M.layers[i]];
  propEditor.layer = j;
  changed();
  commit(true);
  render();
};
ACTIONS.pedLayerPx = d => {
  const M = editedProp(),
    l = M.layers[+d.i];
  propEditor.layer = +d.i;
  openSceneryPixelEditor('art/' + l.img, { kind: 'prop', k: mapEditor.ped, layer: +d.i });
};
/* pictures made here but not saved yet come from the Studio's own copies, not the server */
{
  const base = artLoad;
  setArtLoad(paths => base(paths.filter(p => !(studioState.artDirty && studioState.artDirty.has('art/' + p)))));
}

/* ---------- v19: a solid body behind the picture (game/js/solid-props.js) ---------- */
/* v32: how each placed copy of this prop varies, and its wear and tear (the game's defaults for its kind show as the
   starting values; anything set here overrides them for this prop everywhere) */
function propVaryHTML(k) {
  const M = sceneryCatalog().props[k],
    b = `scenery.props.${k}`,
    D =
      typeof propVariety === 'function'
        ? propVariety(k, Object.assign({}, M, { vary: null, wear: null }))
        : { wear: {} },
    W = D.wear || {};
  return (
    `<h4>Variety and wear</h4><p class="help">Each placed copy draws its own values from where it stands, so a row of these doesn't look stamped out. Colour changes touch only the colourful parts (paint, leaves), not outlines, wood grain or faces; a hue window narrows them further (leaves but not trunks).</p>` +
    grid(
      rangeField('Size ±', `${b}.vary.size`, { min: 0, max: 0.5, step: 0.01, def: D.size || 0 }),
      rangeField('Hue ± (°)', `${b}.vary.hue`, { min: 0, max: 60, step: 1, def: D.hue || 0 }),
      rangeField('Saturation ±', `${b}.vary.sat`, { min: 0, max: 0.5, step: 0.01, def: D.sat || 0 }),
      rangeField('Brightness ±', `${b}.vary.val`, { min: 0, max: 0.4, step: 0.01, def: D.val || 0 }),
      rangeField('Turn ± (°)', `${b}.vary.rot`, { min: 0, max: 45, step: 1, def: D.rot || 0 }),
      rangeField('Lean ± (°)', `${b}.vary.lean`, { min: 0, max: 8, step: 0.5, def: D.lean || 0 }),
      numberField('Only colours near hue (°)', `${b}.vary.mask.0`, {
        opt: 1,
        min: 0,
        max: 360,
        step: 1,
        ph: D.mask ? String(D.mask[0]) : 'any',
        help: '0 red, 60 yellow, 120 green, 200 blue, 280 purple.',
      }),
      numberField('… within ± (°)', `${b}.vary.mask.1`, {
        opt: 1,
        min: 0,
        max: 180,
        step: 1,
        ph: D.mask ? String(D.mask[1]) : 'any',
      })
    ) +
    grid(
      rangeField('Dirt', `${b}.wear.dirt`, { min: 0, max: 1.5, step: 0.05, def: W.dirt || 0 }),
      rangeField('Moss', `${b}.wear.moss`, { min: 0, max: 1.5, step: 0.05, def: W.moss || 0 }),
      rangeField('Faded paint', `${b}.wear.fade`, { min: 0, max: 1.5, step: 0.05, def: W.fade || 0 }),
      rangeField('Cracks', `${b}.wear.crack`, { min: 0, max: 1.5, step: 0.05, def: W.crack || 0 })
    ) +
    `<div class="seg-row"><button class="btn sm subtle" data-act="pedVaryReset">Back to the defaults for this kind</button></div>`
  );
}
function solidBodyHTML(k) {
  const M = sceneryCatalog().props[k],
    b = `scenery.props.${k}`;
  if (!M || M.build || typeof SOLID_PROP_KINDS === 'undefined') return '';
  const auto = SOLID_PROP_BODIES[k] || SOLID_PROP_BODIES[M.group || k],
    names = Object.fromEntries(SOLID_PROP_KINDS),
    preset = SOLID_PROP_PARTS[k];
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
        ) => `<div class="ped-part"><b style="color:${PART_COLORS[i % PART_COLORS.length]}">${i + 1}</b>${selectField('Shape', `${b}.parts.${i}.k`, PK)}${numberField('Left', `${b}.parts.${i}.r.0`, { step: 1 })}${numberField('Top', `${b}.parts.${i}.r.1`, { step: 1 })}${numberField('Right', `${b}.parts.${i}.r.2`, { step: 1 })}${numberField('Bottom', `${b}.parts.${i}.r.3`, { step: 1 })}
   ${q.k === 'flat' ? numberField('Lies at row', `${b}.parts.${i}.y`, { opt: 1, step: 1, ph: String(q.r[3]) }) : ''}${['slab', 'block', 'puff', 'flat'].includes(q.k) ? numberField('Depth (m)', `${b}.parts.${i}.d`, { opt: 1, min: 0.02, max: 6, step: 0.05, ph: q.k === 'flat' ? 'as wide' : '0.3' }) : ''}${q.k === 'lathe' ? checkboxField('Open top', `${b}.parts.${i}.open`, { num: 1 }) : ''}<button class="btn sm danger subtle" data-act="pedPartDel" data-i="${i}">Remove</button></div>`
      )
      .join('');
    return `${head} This prop is built from parts: rectangles of the picture in pixels (shown on the picture), each with its own shape. "Laid flat" turns a band drawn in three-quarter view (a basin's water, a table top) into a level surface. Pixels outside every part stay a flat picture.</p>${rows}
   <div class="seg-row"><button class="btn sm" data-act="pedPartAdd">+ Part</button><button class="btn sm subtle" data-act="pedPartsOff">${preset ? 'Back to the built-in parts' : 'One shape for the whole picture'}</button></div>`;
  }
  const tk = typeof solidTreeKind === 'function' ? solidTreeKind(k, M) : null;
  return `${head} Automatic here: ${tk === 'pine' ? 'turned whole (a cone of tiers)' : tk ? `a round trunk and a crown of leaf clumps${tk === 'bush' ? ' (no trunk)' : ''}` : preset ? `built-in parts (${preset.length})` : auto ? `${escapeHtml(names[auto[0]])}${auto[0] === 'lathe' ? '' : `, ${auto[1]} m deep`}` : 'flat picture'}.</p>
  ${grid(
    selectField(
      'Shape',
      `${b}.vol`,
      SOLID_PROP_KINDS.filter(o => o[0]),
      { none: 'Automatic', opt: 1 }
    ),
    numberField('Depth (m)', `${b}.volDepth`, {
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
const PART_COLORS = ['#E0457B', '#2F9F5B', '#3E8FE0', '#E8A02E', '#8E6CCB', '#1FA8A0', '#C8323C', '#6B8E23'];
ACTIONS.pedPartsOn = () => {
  const M = editedProp();
  if (!M) return;
  const im = artImage(M.img),
    w = im ? im.naturalWidth || im.width : 40,
    h = im ? im.naturalHeight || im.height : 40;
  M.parts = clone(SOLID_PROP_PARTS[mapEditor.ped] || [{ r: [0, 0, w, h], k: 'block', d: 0.5 }]);
  changed();
  commit(true);
  render();
};
ACTIONS.pedPartsOff = () => {
  const M = editedProp();
  if (!M) return;
  delete M.parts;
  changed();
  commit(true);
  render();
};
ACTIONS.pedPartAdd = () => {
  const M = editedProp();
  if (!M || !M.parts) return;
  const im = artImage(M.img),
    w = im ? im.naturalWidth || im.width : 40,
    h = im ? im.naturalHeight || im.height : 40;
  M.parts.push({ r: [0, Math.round(h / 2), w, h], k: 'lathe' });
  changed();
  commit(true);
  render();
};
ACTIONS.pedPartDel = d => {
  const M = editedProp();
  if (!M || !M.parts) return;
  M.parts.splice(+d.i, 1);
  changed();
  commit(true);
  render();
};
/* the parts' rectangles on the picture */
{
  const _pd = drawPropEditor;
  /* adds a layer to the drawing on purpose */
  setDrawPropEditor(function () {
    _pd();
    const M = editedProp(),
      cv = $('#pedCv');
    if (!M || !cv || typeof SOLID_PROP_PARTS === 'undefined') return;
    const P = M.parts || SOLID_PROP_PARTS[mapEditor.ped];
    if (!P) return;
    const Bd = propPictureBounds(M),
      Z = propEditor.zoom,
      X = v => (v - Bd.x0) * Z,
      Y = v => (v - Bd.y0) * Z,
      x = cv.getContext('2d');
    x.save();
    x.lineWidth = 2;
    P.forEach((q, i) => {
      x.strokeStyle = PART_COLORS[i % PART_COLORS.length];
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
const ROOF_KINDS = [
  ['hip', 'Hip roof (slopes on all four sides)'],
  ['gable', 'Gable roof (ridge left to right)'],
  ['gableF', 'Front gable (the gable faces you)'],
  ['flat', 'Flat roof behind a parapet'],
  ['shed', 'Lean-to (one slope rising to the back)'],
];
function buildingPlanHTML(k) {
  const M = sceneryCatalog().props[k],
    b = `scenery.props.${k}.build`,
    B = M.build;
  if (!B)
    return M.box
      ? `<h4>3D building</h4><p class="help">Shown as its picture. As a 3D building it gets real side walls, a roof at its pitch and windows you can look into.</p><button class="btn sm" data-act="pedBuildOn">Make it a 3D building</button>`
      : '';
  const tex = BUILDING_TEXTURE_NAMES.map((n, i) => [i, n]);
  return `<h4>3D building</h4><p class="help">The front is this picture with the roof part cut away (above the eave line) and the glass made see-through. Walls, roof and chimney are built from the settings below. The guides on the picture show the walls (green), the eave (pink) and the windows (blue).</p>
  ${grid(
    selectField('Roof', `${b}.kind`, ROOF_KINDS, { rr: 1 }),
    B.kind === 'gableF'
      ? numberField('Gable peak (px from the base)', `${b}.apex`, { step: 1 })
      : rangeField('Roof pitch (degrees)', `${b}.pitch`, { min: 10, max: 60, step: 1, def: 40 }),
    numberField('Eave (px from the base)', `${b}.eave`, {
      step: 1,
      help: 'Picture rows above this line are roof (cut away). Flat roofs keep anything that isn’t roof colour, like signs.',
    }),
    numberField('Left wall (px)', `${b}.wall.0`, { step: 1 }),
    numberField('Right wall (px)', `${b}.wall.1`, { step: 1 }),
    numberField('Overhang (m)', `${b}.over`, { min: 0, max: 1.2, step: 0.02 }),
    numberField('Storeys', `${b}.floors`, { min: 1, max: 12, step: 1, help: 'Side and back windows per storey.' })
  )}
  <div class="grid colors">${colorField('Walls', `${b}.wallCol`)}${colorField('Roof', `${b}.roofCol`)}${colorField('Trim and frames', `${b}.trimCol`)}</div>
  ${grid(selectField('Wall texture', `${b}.wallTex`, tex, { num: 1 }), selectField('Roof texture', `${b}.roofTex`, tex, { num: 1 }), checkboxField('Windows on the sides and back', `${b}.sideWin`, { help: 'Off: plain side walls.' }))}
  <p class="help">${(B.win || []).length} see-through panes found in the picture (tools/build-buildings.py finds them by their glass colours). Rooms behind the glass: ${(B.rooms || [0]).map(i => BUILDING_ROOM_NAMES[i] || i).join(', ')}.</p>
  <div class="seg-row"><button class="btn sm subtle" data-act="pedBuildRooms">Other rooms</button><button class="btn sm subtle" data-act="pedBuildNoWin">No see-through panes</button><button class="btn sm subtle danger" data-act="pedBuildOff">Use the picture instead</button></div>`;
}
ACTIONS.pedBuildOn = () => {
  const M = editedProp(),
    im = artImage(M.img);
  if (!M || !im) return;
  const w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height,
    ppu = sceneryCatalog().ppu || 34,
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
ACTIONS.pedBuildOff = async () => {
  const M = editedProp();
  if (!M || !(await ask('Show this building as its picture again? Its 3D settings are removed.', 'Use the picture')))
    return;
  delete M.build;
  changed();
  commit(true);
  render();
};
ACTIONS.pedBuildNoWin = () => {
  const M = editedProp();
  if (!M || !M.build) return;
  M.build.win = [];
  changed();
  commit(true);
  render();
};
ACTIONS.pedBuildRooms = () => {
  const M = editedProp();
  if (!M || !M.build) return;
  const r = M.build.rooms || [0];
  M.build.rooms = r.map(i => (i + 1) % BUILDING_ROOM_NAMES.length);
  changed();
  commit(true);
  render();
};
/* guides for the plan on the picture */
{
  const _pd = drawPropEditor;
  /* adds a layer to the drawing on purpose */
  setDrawPropEditor(function () {
    _pd();
    const M = editedProp(),
      cv = $('#pedCv');
    if (!M || !M.build || !cv) return;
    const B = M.build,
      Bd = propPictureBounds(M),
      Z = propEditor.zoom,
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
