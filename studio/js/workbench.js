'use strict';
/* ================= POCKET BILLIES STUDIO · Art workbench (studio track ST-3: Sheet mode) =================
   One workbench for art, in modes: Sheet (here), Part (workbench-part.js, ST-4), then Pixels and Model (ST-6 to
   ST-8). Sheet mode cuts a sheet into parts: drop PNGs anywhere on the Studio (and an Aseprite JSON beside its PNG),
   pick how the parts are found (a phase 16 kit's rows, islands of art, a template grid, or Aseprite's frames and
   slices), snap art drawn big back to its pixels, name the parts from a template, match front and back, and write
   them to the game: the pictures to art/next/parts/<view>/<id>.png and the parts to partKits.json (one undo step for
   the pictures, one for the data). The numbers are in game/js/logic/sheet-slice.js and pixel-snap.js; the sheet shows
   on the shared pixel canvas. Dropped sheets stay in this browser tab only: the kits' sources live in
   tools/art-source/part-kit, outside the game, and dropping the same sheet again with the kit's saved settings gives
   the same parts. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { wbPartSection } from '../../game/js/hooks.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelHex, pixelRgba } from '../../game/js/logic/pixel-ops.js';
import { snapDetect, snapToPixels } from '../../game/js/logic/pixel-snap.js';
import {
  asepriteBoxes,
  sheetArtBox,
  sheetAutoSockets,
  sheetCellIsland,
  sheetCrop,
  sheetEdgeColor,
  sheetGridBoxes,
  sheetIslands,
  sheetKitEntry,
  sheetMask,
  sheetMatchViews,
  sheetName,
  sheetPiece,
  sheetSliceKit,
} from '../../game/js/logic/sheet-slice.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  changed,
  commit,
  openSection,
  paneRoot,
  render,
  sectionShown,
  studioState,
  toast,
} from './studio-app.js';
import {
  artSteps,
  drawPixelCanvas,
  pictureImage,
  pixelCanvas,
  pixelCanvasFit,
  pixelCanvasZoom,
} from './pixel-canvas.js';
import { atlasGet, fileToCanvas, markArt } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  WB_DEFAULTS: [() => WB_DEFAULTS],
  WB_JOINT_KEYS: [() => WB_JOINT_KEYS],
  WB_METHODS: [() => WB_METHODS],
  WB_RENDER_KEYS: [() => WB_RENDER_KEYS],
  WB_VIEWS: [() => WB_VIEWS],
  wbAddFiles: [() => wbAddFiles, v => (wbAddFiles = v)],
  wbGuess: [() => wbGuess, v => (wbGuess = v)],
  wbHasFiles: [() => wbHasFiles],
  wbInput: [() => wbInput, v => (wbInput = v)],
  wbKeepJoints: [() => wbKeepJoints, v => (wbKeepJoints = v)],
  wbKey: [() => wbKey, v => (wbKey = v)],
  wbKinds: [() => wbKinds],
  wbKits: [() => wbKits],
  wbMount: [() => wbMount, v => (wbMount = v)],
  wbNameParts: [() => wbNameParts, v => (wbNameParts = v)],
  wbNum: [() => wbNum],
  wbOverlay: [() => wbOverlay, v => (wbOverlay = v)],
  wbPartHTML: [() => wbPartHTML, v => (wbPartHTML = v)],
  wbParts: [() => wbParts, v => (wbParts = v)],
  wbPartsHTML: [() => wbPartsHTML, v => (wbPartsHTML = v)],
  wbPixelsCanvas: [() => wbPixelsCanvas, v => (wbPixelsCanvas = v)],
  wbRefresh: [() => wbRefresh, v => (wbRefresh = v)],
  wbRefreshSide: [() => wbRefreshSide, v => (wbRefreshSide = v)],
  wbSamePicture: [() => wbSamePicture],
  wbSel: [() => wbSel],
  wbSettingsHTML: [() => wbSettingsHTML, v => (wbSettingsHTML = v)],
  wbSheet: [() => wbSheet],
  wbSliceSheet: [() => wbSliceSheet, v => (wbSliceSheet = v)],
  wbSplitView: [() => wbSplitView, v => (wbSplitView = v)],
  wbThumbs: [() => wbThumbs, v => (wbThumbs = v)],
  wbWrite: [() => wbWrite, v => (wbWrite = v)],
  workbench: [() => workbench],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const WB_VIEWS = ['front', 'back'];
const WB_METHODS = [
  ['kit', 'Kit rows (animals × kinds, then extras)'],
  ['islands', 'Islands of art'],
  ['grid', 'Template grid'],
  ['aseprite', 'Aseprite frames and slices'],
];
const WB_DEFAULTS = {
  method: 'islands',
  key: 'edge',
  outside: true,
  keyColor: '#ff00ff',
  tol: 24,
  clean: 0,
  gap: 2,
  minArea: 4,
  conn: 8,
  scale: 'none',
  snapScale: 4,
  snapX: 0,
  snapY: 0,
  trim: true,
  name: '{kit}_{n}',
  cols: 4,
  rows: 4,
  gx: 0,
  gy: 0,
  cellW: 32,
  cellH: 32,
  gapX: 0,
  gapY: 0,
};
export const workbench = {
  sheets: [] /* { name, view, c (a canvas), img (its pixels), json (Aseprite, or null) } */,
  cur: 0,
  kit: '',
  o: { ...WB_DEFAULTS },
  names: {} /* a part's id typed by hand, by its key */,
  kinds: {} /* a part's kind picked by hand, by its key */,
  sel: null /* the part picked (its key) */,
  cache: null /* the parts of every sheet, made again after a change */,
  pc: null,
  zoom: 0,
  mode: 'sheet' /* or 'part' (studio track ST-4, workbench-part.js) */,
};
export const wbKits = () => {
  const P = studioState.D.partKits || (studioState.D.partKits = { parts: {} });
  return P;
};
const wbKinds = () => Object.keys(wbKits().slots || {});
const wbSheet = () => workbench.sheets[workbench.cur] || null;
export function wbPixelsCanvas(p) {
  const c = makeCanvas(p.width, p.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}
/* ---------- sheets in ---------- */
/* '<kit>-<view>.png' names a kit and a view; any name ending in front or back names the view */
function wbNameParts(file) {
  const base = file.replace(/\.[a-z0-9]+$/i, ''),
    m = base.match(/^(.*?)[-_ ]?(front|back)$/i);
  return { base, stem: m ? m[1] : base, view: m ? m[2].toLowerCase() : null };
}
async function wbAddFiles(files) {
  const list = [...files],
    pngs = list.filter(f => /\.(png|webp|jpe?g|gif)$/i.test(f.name) || /^image\//.test(f.type)),
    jsons = list.filter(f => /\.json$/i.test(f.name));
  if (!pngs.length) return toast('Drop a PNG (and its Aseprite JSON, if it has one) to slice it.', 'err');
  for (const f of pngs) {
    const c = await fileToCanvas(f),
      n = wbNameParts(f.name),
      jf = jsons.find(j => wbNameParts(j.name).base === n.base) || (pngs.length === 1 ? jsons[0] : null);
    let json = null;
    if (jf)
      try {
        json = JSON.parse(await jf.text());
      } catch (e) {
        toast(`${jf.name} isn’t JSON: ${e.message}`, 'err');
      }
    const old = workbench.sheets.findIndex(s => s.name === f.name);
    const sheet = { name: f.name, view: n.view || 'front', c, img: pictureImage(c), json };
    if (old >= 0) workbench.sheets[old] = sheet;
    else workbench.sheets.push(sheet);
    workbench.cur = old >= 0 ? old : workbench.sheets.length - 1;
    wbGuess(sheet, n);
  }
  workbench.cache = null;
  workbench.zoom = 0;
  workbench.mode = 'sheet';
  if (!sectionShown('workbench')) openSection('workbench');
  else render();
}
/* the first sheet sets how it is sliced: a kit's sheet takes the kit's settings; anything else a guess from the art */
function wbGuess(sheet, n) {
  const kits = wbKits().kits || {};
  if (kits[n.stem]) {
    workbench.kit = n.stem;
    workbench.o = { ...WB_DEFAULTS, ...(kits[n.stem].slice || {}), method: kits[n.stem].rows ? 'kit' : 'islands' };
    return;
  }
  if (workbench.sheets.length > 1) return;
  workbench.kit = sheetName('{s}', { s: n.stem }) || 'kit';
  const o = { ...WB_DEFAULTS };
  if (sheet.json) Object.assign(o, { method: 'aseprite', name: '{name}' });
  let clear = 0;
  for (let i = 3; i < sheet.img.data.length; i += 4) if (sheet.img.data[i] < 128) clear++;
  if (clear > sheet.img.width * sheet.img.height * 0.05) o.key = 'clear';
  const snap = snapDetect(sheet.img);
  if (snap.scale > 1) Object.assign(o, { scale: 'snap', snapScale: snap.scale, snapX: snap.ox, snapY: snap.oy });
  workbench.o = o;
}
/* ---------- slicing ---------- */
function wbKey(o, sheet) {
  if (o.key === 'magenta' || o.key === 'clear') return o.key;
  if (o.key === 'edge') return { rgb: sheetEdgeColor(sheet.img) || [255, 0, 255], tol: o.tol };
  const h = pixelRgba(o.keyColor);
  return { rgb: [h[0], h[1], h[2]], tol: o.tol };
}
/* a sheet's view from a part's name ('head_back'), else the sheet's own */
function wbSplitView(id, view) {
  const m = id.match(/^(.*?)_(front|back)$/);
  return m ? { id: m[1], view: m[2] } : { id, view };
}
function wbSliceSheet(sheet, si) {
  const o = workbench.o,
    kits = wbKits();
  if (o.method === 'kit') {
    const K = (kits.kits || {})[workbench.kit];
    if (!K || !K.rows)
      return { parts: [], problem: `${workbench.kit} is not a kit with rows; pick another way to find parts.` };
    const r = sheetSliceKit(
      sheet.img,
      { name: workbench.kit, ...K },
      { slots: kits.slots || {}, sockets: kits.sockets },
      sheet.view
    );
    return {
      problem: r.problem,
      parts: r.parts.map((p, k) => ({ ...p, key: `${si}:${k}`, view: sheet.view, src: p.box, scaled: true })),
    };
  }
  /* everything else: snap (optional), find boxes, cut */
  const s = o.scale === 'snap' ? Math.max(1, Math.round(o.snapScale)) : 1,
    x0 = s > 1 ? (o.snapX % s) - (o.snapX % s ? s : 0) : 0,
    y0 = s > 1 ? (o.snapY % s) - (o.snapY % s ? s : 0) : 0,
    base = s > 1 ? snapToPixels(sheet.img, s, o.snapX, o.snapY) : sheet.img,
    key = wbKey(o, sheet),
    toSrc = b => ({ x: b.x * s + x0, y: b.y * s + y0, w: b.w * s, h: b.h * s });
  let found = [];
  if (o.method === 'islands')
    found = sheetIslands(base, {
      key,
      outside: o.outside,
      clean: o.clean,
      gap: o.gap,
      minArea: o.minArea,
      conn: o.conn,
    }).map((it, k) => ({
      it,
      vars: { n: k + 1 },
    }));
  else {
    const boxes =
      o.method === 'grid'
        ? sheetGridBoxes({
            cols: o.cols,
            rows: o.rows,
            x: o.gx,
            y: o.gy,
            cellW: o.cellW,
            cellH: o.cellH,
            gapX: o.gapX,
            gapY: o.gapY,
          })
        : asepriteBoxes(sheet.json).map(b => ({
            ...b,
            x: Math.floor((b.x - x0) / s),
            y: Math.floor((b.y - y0) / s),
            w: Math.max(1, Math.round(b.w / s)),
            h: Math.max(1, Math.round(b.h / s)),
          }));
    if (o.method === 'aseprite' && !sheet.json)
      return { parts: [], problem: 'This sheet has no Aseprite JSON. Drop the PNG and its JSON together.' };
    boxes.forEach((b, k) => {
      let it = sheetCellIsland(base, b, key, o.outside);
      if (it && !o.trim) {
        const full = { x: Math.max(0, b.x), y: Math.max(0, b.y) };
        full.w = Math.min(base.width, b.x + b.w) - full.x;
        full.h = Math.min(base.height, b.y + b.h) - full.y;
        it = {
          ...full,
          cx: full.x + full.w / 2,
          cy: full.y + full.h / 2,
          area: it.area,
          mask: sheetMask(sheetCrop(base, full), key, o.outside),
        };
      }
      if (it) found.push({ it, vars: { n: k + 1, row: b.row ?? '', col: b.col ?? '', name: b.name || '' } });
    });
  }
  const kinds = wbKinds(),
    slots = kits.slots || {};
  const parts = found.map(({ it: found1, vars }, k) => {
    /* islands carry the margin their merge gap grew; trimmed to the art (a template cell only when asked) */
    const whole = sheetPiece(base, found1),
      ab = (o.method === 'islands' || o.trim) && sheetArtBox(whole),
      it = ab ? { ...found1, x: found1.x + ab.x, y: found1.y + ab.y, w: ab.w, h: ab.h } : found1,
      key = `${si}:${k}`,
      img = ab ? sheetCrop(whole, ab) : whole,
      named = wbSplitView(
        sheetName(o.name, { kit: workbench.kit, view: sheet.view, ...vars }) || `${workbench.kit}_${k + 1}`,
        sheet.view
      ),
      kind = workbench.kinds[key] || kinds.find(t => named.id.split('_').includes(t)) || kinds[0] || 'torso';
    return {
      key,
      id: named.id,
      view: named.view,
      kind,
      animal: 'any',
      img,
      sockets: sheetAutoSockets(kind, slots[kind] || '', img, named.view),
      src: toSrc(it),
      cx: it.cx,
      cy: it.cy,
    };
  });
  return { parts, problem: found.length ? '' : 'No parts found. Check the background colour and the minimum size.' };
}
/* every sheet sliced, then front and back matched: a back part matched by position takes its front part's id */
function wbParts() {
  if (workbench.cache) return workbench.cache;
  const per = workbench.sheets.map((s, i) => wbSliceSheet(s, i)),
    all = per.flatMap(r => r.parts);
  for (const p of all) if (workbench.names[p.key]) p.id = sheetName('{s}', { s: workbench.names[p.key] }) || p.id;
  const pairs = sheetMatchViews(
    all.filter(p => p.view === 'front'),
    all.filter(p => p.view === 'back')
  );
  for (const q of pairs) if (q.by === 'position' && !workbench.names[q.back.key]) q.back.id = q.front.id;
  const seen = new Map(),
    dupes = new Set();
  for (const p of all) {
    const k = p.view + ':' + p.id;
    if (seen.has(k)) dupes.add(p.id);
    seen.set(k, p);
  }
  workbench.cache = { per, all, pairs, dupes };
  return workbench.cache;
}
/* ---------- the section ---------- */
const wbNum = (label, k, o = {}) =>
  `<label class="fld"><span>${label}</span><input type="number" data-wb="${k}" value="${workbench.o[k]}" step="${o.step || 1}" ${o.min != null ? `min="${o.min}"` : ''}>${o.help ? `<small class="help">${o.help}</small>` : ''}</label>`;
const wbSel = (label, k, opts) =>
  `<label class="fld"><span>${label}</span><select data-wb="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(workbench.o[k]) === String(v) ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label>`;
function wbSettingsHTML() {
  const o = workbench.o,
    kits = Object.keys(wbKits().kits || {}),
    S = wbSheet();
  const how = `<div class="px-sec"><h4>Kit</h4><label class="fld"><span>The parts go in kit</span><input type="text" data-wb-kit list="wbKitList" value="${escapeHtml(workbench.kit)}"><datalist id="wbKitList">${kits.map(k => `<option value="${escapeHtml(k)}">`).join('')}</datalist><small class="help">A kit groups parts; a new name makes a new kit.</small></label>${wbSel('Find the parts by', 'method', WB_METHODS)}</div>`;
  if (o.method === 'kit')
    return (
      how +
      `<div class="px-sec"><h4>Kit rows</h4><p class="help">As the phase 16 kits are drawn: a magenta background, one animal a column, one kind a row, then a row of extras; cut at a quarter of the size, pieces 6 px apart joined, specks under 800 px left out. The kit’s animals, kinds and extras are in partKits.json.</p></div>`
    );
  const key = `<div class="px-sec"><h4>Background</h4>${wbSel('Background is', 'key', [
    ['edge', 'The colour around the edge'],
    ['clear', 'Clear pixels'],
    ['magenta', 'Magenta (the kits)'],
    ['color', 'This colour'],
  ])}${o.key === 'color' ? `<label class="fld"><span>Colour</span><input type="color" data-wb="keyColor" value="${escapeHtml(o.keyColor)}"><small class="help">Or Pick background above the sheet, then click it.</small></label>` : ''}${o.key === 'edge' || o.key === 'color' ? wbNum('Colours this close count (0–255)', 'tol', { min: 0 }) : ''}<label class="fld chk"><input type="checkbox" data-wb="outside" ${o.outside ? 'checked' : ''}><span>Only background that joins the edge</span><small class="help">Background colour inside a part (a cream belly on a cream sheet) stays in the part. Off: gaps between strands are cut out too.</small></label></div>`;
  const snap = `<div class="px-sec"><h4>Snap to pixels</h4>${wbSel('Size', 'scale', [
    ['none', 'As drawn (true-scale pixel art)'],
    ['snap', 'Drawn big: snap to its pixels'],
  ])}${
    o.scale === 'snap'
      ? `<div class="grid">${wbNum('Pixel size', 'snapScale', { min: 2 })}${wbNum('Grid starts at x', 'snapX', { min: 0 })}${wbNum('y', 'snapY', { min: 0 })}</div><div class="seg-row"><button class="btn sm" data-act="wbDetect">Find it again</button></div><p class="help">Each cell becomes one pixel of its most common colour. The grid shows over the sheet; nudge it until it sits on the big pixels.</p>`
      : `<div class="seg-row"><button class="btn sm" data-act="wbDetect">Is it drawn big?</button></div>`
  }</div>`;
  let find = '';
  if (o.method === 'islands')
    find = `<div class="px-sec"><h4>Islands</h4>${wbSel('Pixels touch', 'conn', [
      [8, 'At edges and corners (8)'],
      [4, 'At edges only (4)'],
    ])}<div class="grid">${wbNum('Join pieces this close', 'gap', { min: 0 })}${wbNum('Smallest part (pixels)', 'minArea', { min: 1 })}${wbNum('Clean specks (steps)', 'clean', { min: 0 })}</div></div>`;
  if (o.method === 'grid')
    find = `<div class="px-sec"><h4>Template grid</h4><div class="grid">${wbNum('Columns', 'cols', { min: 1 })}${wbNum('Rows', 'rows', { min: 1 })}${wbNum('Cell width', 'cellW', { min: 1 })}${wbNum('Cell height', 'cellH', { min: 1 })}${wbNum('Starts at x', 'gx')}${wbNum('y', 'gy')}${wbNum('Gap across', 'gapX', { min: 0 })}${wbNum('Gap down', 'gapY', { min: 0 })}</div><label class="fld chk"><input type="checkbox" data-wb="trim" ${o.trim ? 'checked' : ''}><span>Trim each part to its art</span></label></div>`;
  if (o.method === 'aseprite')
    find = `<div class="px-sec"><h4>Aseprite</h4><p class="help">${S && S.json ? `${asepriteBoxes(S.json).length} boxes from ${escapeHtml(S.name.replace(/\.[a-z]+$/i, ''))}.json (its slices, else its frames), named by them.` : 'Drop the PNG and its JSON (File → Export Sprite Sheet → JSON data) together.'}</p><label class="fld chk"><input type="checkbox" data-wb="trim" ${o.trim ? 'checked' : ''}><span>Trim each part to its art</span></label></div>`;
  const names = `<div class="px-sec"><h4>Names</h4><label class="fld"><span>Name template</span><input type="text" data-wb="name" value="${escapeHtml(o.name)}"><small class="help">{kit} {n} {row} {col} {name} {view}. A name ending in _front or _back puts the part in that view (front and back on one sheet). Click a part to rename it.</small></label></div>`;
  return how + key + snap + find + names;
}
function wbPartsHTML() {
  const { all, per, dupes } = wbParts(),
    problems = per
      .map((r, i) =>
        r.problem ? `<p class="wb-warn">⚠ ${escapeHtml(workbench.sheets[i].name)}: ${escapeHtml(r.problem)}</p>` : ''
      )
      .join(''),
    ids = [...new Set(all.map(p => p.id))],
    have = wbKits().parts || {};
  const rows = ids
    .map(id => {
      const v = Object.fromEntries(all.filter(p => p.id === id).map(p => [p.view, p])),
        any = v.front || v.back,
        on = workbench.sel && (v.front?.key === workbench.sel || v.back?.key === workbench.sel);
      return `<div class="wb-part ${on ? 'on' : ''} ${dupes.has(id) ? 'bad' : ''}" data-act="wbPick" data-k="${any.key}">${WB_VIEWS.map(
        w => `<span class="wb-thumb">${v[w] ? `<canvas data-wbthumb="${v[w].key}"></canvas>` : '<i>—</i>'}</span>`
      ).join(
        ''
      )}<span class="wb-pid"><b class="mono">${escapeHtml(id)}</b><small>${escapeHtml(any.kind)}${have[id] ? ' · replaces' : ' · new'}${dupes.has(id) ? ' · twice in a view!' : ''}</small></span></div>`;
    })
    .join('');
  return `${problems}<div class="wb-parts-h"><span>Front</span><span>Back</span><span>${ids.length} part${ids.length === 1 ? '' : 's'}</span></div>${rows || '<p class="help">No parts yet.</p>'}`;
}
function wbPartHTML() {
  const p = workbench.sel && wbParts().all.find(q => q.key === workbench.sel);
  if (!p) return '';
  const kinds = wbKinds();
  return `<div class="px-sec"><h4>Part ${escapeHtml(p.id)} (${p.view})</h4><label class="fld"><span>Id</span><input type="text" data-wb-name="${p.key}" value="${escapeHtml(p.id)}"></label>${
    workbench.o.method === 'kit'
      ? `<p class="help">Kind ${escapeHtml(p.kind)}, animal ${escapeHtml(p.animal)}: from the kit’s rows.</p>`
      : `<label class="fld"><span>Kind</span><select data-wb-kind="${p.key}">${kinds.map(k => `<option ${k === p.kind ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}</select><small class="help">The slot it fills: ${escapeHtml((wbKits().slots || {})[p.kind] || '?')}.</small></label>`
  }<p class="help">${p.img.width} × ${p.img.height} px · sockets ${Object.keys(p.sockets).map(escapeHtml).join(', ') || 'none'} (Part mode moves them, once written).</p></div>`;
}
SECTIONS.workbench = () => {
  const S = wbSheet(),
    modes = [
      ['sheet', 'Sheet', 'Cut sheets into parts'],
      ['part', 'Part', 'Pivots, sockets, turn limits, draw order, test fit, mirror, S and L'],
      ['pixels', 'Pixels', 'Painting on the shared canvas (ST-6)'],
      ['model', 'Model', '3D models in and out (ST-7, ST-8)'],
    ],
    on = workbench.mode;
  const head = `<div class="ed-head"><div><small class="mono">partKits.json · art/next/parts</small><h2>Art workbench</h2><p class="sub">${on === 'part' ? 'A part’s joints: drag the pivot and sockets, test it on a body.' : 'Drop sheets anywhere on the Studio to cut them into parts.'}</p></div><div class="seg-row">${modes
    .map(([k, l, t]) =>
      k === 'sheet' || k === 'part'
        ? `<button class="seg ${k === on ? 'on' : ''}" data-act="wbMode" data-m="${k}" title="${t}">${l}</button>`
        : `<button class="seg" disabled title="${t}">${l}</button>`
    )
    .join('')}</div></div>`;
  if (on === 'part') return wbPartSection(head);
  const sheets = workbench.sheets
    .map(
      (s, i) =>
        `<div class="wb-sheet ${i === workbench.cur ? 'on' : ''}"><button class="lcard ${i === workbench.cur ? 'on' : ''}" data-act="wbSheet" data-i="${i}"><b>${escapeHtml(s.name)}</b><small>${s.img.width} × ${s.img.height}${s.json ? ' · JSON' : ''}</small></button><select data-wb-view="${i}">${WB_VIEWS.map(v => `<option ${v === s.view ? 'selected' : ''}>${v}</option>`).join('')}</select><button class="btn sm subtle" data-act="wbDrop" data-i="${i}" title="Put this sheet away">✕</button></div>`
    )
    .join('');
  const list = `<aside class="list-col wb-list"><div class="seg-row"><button class="btn sm primary" data-act="wbOpen">Open sheets…</button></div><div class="wb-sheets">${sheets || '<p class="help">Drop PNGs here or anywhere on the Studio. Kit sheets (beasts-front.png) take their kit’s settings.</p>'}</div>${S ? `<div class="wb-partlist" id="wbParts">${wbPartsHTML()}</div>` : ''}</aside>`;
  const n = S ? new Set(wbParts().all.map(p => p.id)).size : 0;
  const side = `<aside class="px-side wb-side">${wbSettingsHTML()}<div id="wbPart">${wbPartHTML()}</div><div class="px-sec"><button class="btn primary" data-act="wbWrite" ${n ? '' : 'disabled'}>Write ${n} part${n === 1 ? '' : 's'} to the game</button><p class="help">Pictures to art/next/parts/&lt;view&gt;/&lt;id&gt;.png, parts to partKits.json; then Save. One undo takes the pictures back, one more the parts.</p></div></aside>`;
  const stage = S
    ? `<div class="wb-mid"><div class="seg-row wb-tools"><button class="seg" data-act="wbZoom" data-z="-1" title="Zoom out">−</button><span id="wbZoom"></span><button class="seg" data-act="wbZoom" data-z="1" title="Zoom in">+</button><button class="seg" data-act="wbZoom" data-z="0" title="Fit the sheet">Fit</button><button class="seg ${workbench.pick ? 'on' : ''}" data-act="wbPickKey" title="Click the sheet to make that colour the background">Pick background</button></div><div class="px-stage wb-stage" id="wbStage"></div></div>`
    : `<div class="wb-mid wb-empty"><div class="wb-drop"><b>Drop a sheet here</b><span>PNG, plus its Aseprite JSON if it has one. Front and back as two sheets (…-front.png, …-back.png) or one.</span></div></div>`;
  afterRender(wbMount);
  return `<div class="wb">${head}<div class="wb-body">${list}${stage}${side}</div></div>`;
};
function wbMount() {
  const st = paneRoot().querySelector('#wbStage');
  wbThumbs();
  if (!st) return;
  const S = wbSheet();
  workbench.pc = pixelCanvas(st, {
    ids: 'wb',
    tool: 'part',
    get: () => (wbSheet() ? wbSheet().c : null),
    overlay: P => wbOverlay(P),
    hostTool: (P, t, x, y) => {
      if (workbench.pick) {
        const d = S.img.data,
          i = (y * S.img.width + x) * 4;
        workbench.o.key = 'color';
        workbench.o.keyColor = pixelHex(d[i], d[i + 1], d[i + 2]);
        workbench.pick = false;
        workbench.cache = null;
        render();
        return true;
      }
      const p = wbParts().all.find(
        q =>
          q.key.startsWith(workbench.cur + ':') &&
          x >= q.src.x &&
          y >= q.src.y &&
          x < q.src.x + q.src.w &&
          y < q.src.y + q.src.h
      );
      workbench.sel = p ? p.key : null;
      wbRefreshSide();
      drawPixelCanvas(P);
      return true;
    },
    drawn: P => {
      const z = paneRoot().querySelector('#wbZoom');
      if (z) z.textContent = P.zoom + '×';
    },
  });
  workbench.pc.showGrid = false;
  workbench.pc.zoom = workbench.zoom || pixelCanvasFit(workbench.pc, 1, 16);
  workbench.zoom = workbench.pc.zoom;
  drawPixelCanvas(workbench.pc);
}
function wbOverlay(P) {
  const { all } = wbParts(),
    o = workbench.o,
    S = wbSheet(),
    fs = Math.max(6, 11 / (P.zoom || 1));
  let g = '';
  if (o.method !== 'kit' && o.scale === 'snap' && S && o.snapScale > 1 && P.zoom * o.snapScale >= 8) {
    const s = Math.round(o.snapScale),
      lines = [];
    for (let x = o.snapX % s; x <= S.img.width; x += s) lines.push(`M${x} 0V${S.img.height}`);
    for (let y = o.snapY % s; y <= S.img.height; y += s) lines.push(`M0 ${y}H${S.img.width}`);
    g += `<path class="wb-snap" d="${lines.join('')}"/>`;
  }
  if (o.method === 'grid' && S) {
    const s = o.scale === 'snap' ? Math.round(o.snapScale) : 1,
      x0 = s > 1 ? (o.snapX % s) - (o.snapX % s ? s : 0) : 0,
      y0 = s > 1 ? (o.snapY % s) - (o.snapY % s ? s : 0) : 0;
    g += sheetGridBoxes({
      cols: o.cols,
      rows: o.rows,
      x: o.gx,
      y: o.gy,
      cellW: o.cellW,
      cellH: o.cellH,
      gapX: o.gapX,
      gapY: o.gapY,
    })
      .map(
        b => `<rect class="wb-cell" x="${b.x * s + x0}" y="${b.y * s + y0}" width="${b.w * s}" height="${b.h * s}"/>`
      )
      .join('');
  }
  for (const p of all) {
    if (!p.key.startsWith(workbench.cur + ':')) continue;
    const b = p.src;
    g += `<rect class="${p.key === workbench.sel ? 'hov' : ''}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/><text class="wb-label" x="${b.x}" y="${b.y - fs * 0.3}" font-size="${fs}">${escapeHtml(p.id)}${p.view !== wbSheet().view ? ' (' + p.view + ')' : ''}</text>`;
  }
  return g;
}
function wbThumbs() {
  const { all } = workbench.cache || { all: [] };
  paneRoot()
    .querySelectorAll('canvas[data-wbthumb]')
    .forEach(cv => {
      const p = all.find(q => q.key === cv.dataset.wbthumb);
      if (!p) return;
      cv.width = p.img.width;
      cv.height = p.img.height;
      cv.getContext('2d').putImageData(
        new ImageData(new Uint8ClampedArray(p.img.data), p.img.width, p.img.height),
        0,
        0
      );
    });
}
/* after a setting changes: slice again and redraw the parts, the picked part and the outlines (the settings stay) */
function wbRefresh() {
  workbench.cache = null;
  const root = paneRoot(),
    L = root.querySelector('#wbParts');
  if (L) L.innerHTML = wbPartsHTML();
  wbThumbs();
  wbRefreshSide();
  const btn = root.querySelector('[data-act=wbWrite]'),
    n = wbSheet() ? new Set(wbParts().all.map(p => p.id)).size : 0;
  if (btn) {
    btn.disabled = !n;
    btn.textContent = `Write ${n} part${n === 1 ? '' : 's'} to the game`;
  }
  if (workbench.pc && workbench.pc.cv.isConnected) drawPixelCanvas(workbench.pc);
}
function wbRefreshSide() {
  const root = paneRoot(),
    E = root.querySelector('#wbPart');
  if (E) E.innerHTML = wbPartHTML();
  root.querySelectorAll('.wb-part').forEach(el => {
    const keys = [...el.querySelectorAll('canvas[data-wbthumb]')].map(c => c.dataset.wbthumb);
    el.classList.toggle('on', keys.includes(workbench.sel));
  });
}
/* ---------- writing to the game ---------- */
export const wbSamePicture = (a, b) => {
  if (!a || a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i + 3] !== b.data[i + 3]) return false;
    if (
      a.data[i + 3] &&
      (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2])
    )
      return false;
  }
  return true;
};
async function wbWrite() {
  const { all, dupes, per } = wbParts();
  if (dupes.size)
    return toast(`Two parts in one view are called ${[...dupes].slice(0, 3).join(', ')}. Rename one first.`, 'err');
  if (
    per.some(r => r.problem) &&
    !(await ask('Some sheets could not be sliced. Write the parts that were found?', 'Write'))
  )
    return;
  const kits = wbKits(),
    have = kits.parts || (kits.parts = {}),
    slots = kits.slots || {},
    pivots = kits.pivots || {},
    replaced = all.filter(p => have[p.id] && have[p.id].kit !== workbench.kit);
  if (
    replaced.length &&
    !(await ask(
      `${replaced.length} part${replaced.length === 1 ? ' is' : 's are'} already in another kit (${escapeHtml([...new Set(replaced.map(p => p.id))].slice(0, 4).join(', '))}). Replace ${replaced.length === 1 ? 'it' : 'them'}?`,
      'Replace'
    ))
  )
    return;
  toast('Writing…');
  /* the pictures, as one undo step (a picture that was not there before goes away on undo) */
  const steps = [];
  await Promise.all(
    all.map(async p => {
      const path = `art/next/parts/${p.view}/${p.id}.png`;
      let old = null;
      if (studioState.artDirty.has(path) || (studioState.files || []).some(f => f.path === path))
        try {
          old = pictureImage(await atlasGet(path));
        } catch (e) {}
      if (wbSamePicture(old, p.img)) return;
      const c = wbPixelsCanvas(p.img);
      markArt(path, c);
      steps.push([path, old, pictureImage(c)]);
    })
  );
  artSteps(steps);
  /* then the parts: the kit's rows keep the slicer's order and fields; other ways take their kind's slot and pivot */
  const entries = {};
  for (const p of all) {
    const e = (entries[p.id] =
      entries[p.id] ||
      (workbench.o.method === 'kit'
        ? sheetKitEntry(null, { name: workbench.kit }, { slots, pivots }, p, p.view)
        : {
            kit: workbench.kit,
            animal: p.animal,
            kind: p.kind,
            slot: slots[p.kind] || 'body',
            pivot: pivots[p.kind] || [0.5, 0.5],
            size: 'M',
            views: {},
          }));
    /* sockets placed by hand in Part mode (partKits `sockets`) win over the ones worked out from the outline */
    const hand = ((kits.sockets || {})[p.id] || {})[p.view];
    e.views[p.view] = {
      file: `next/parts/${p.view}/${p.id}.png`,
      w: p.img.width,
      h: p.img.height,
      sockets: hand ? { ...p.sockets, ...hand } : p.sockets,
    };
  }
  for (const [id, e] of Object.entries(entries)) {
    const old = have[id];
    /* a view not on these sheets stays as it was */
    if (old) for (const v of WB_VIEWS) if (!e.views[v] && old.views[v]) e.views[v] = old.views[v];
    /* what Part mode set stays: the pivot per view, the S and L pictures, draw order, turn limits, socket rules */
    if (old) wbKeepJoints(old, e);
    e.views = Object.fromEntries(WB_VIEWS.filter(v => e.views[v]).map(v => [v, e.views[v]]));
    if (JSON.stringify(old) !== JSON.stringify(e)) have[id] = e;
  }
  const K = (kits.kits = kits.kits || {});
  if (workbench.o.method !== 'kit') {
    const {
      method,
      key,
      keyColor,
      tol,
      outside,
      clean,
      gap,
      minArea,
      conn,
      scale,
      snapScale,
      snapX,
      snapY,
      trim,
      name,
    } = workbench.o;
    const slice = {
      method,
      key,
      keyColor,
      tol,
      outside,
      clean,
      gap,
      minArea,
      conn,
      scale,
      snapScale,
      snapX,
      snapY,
      trim,
      name,
    };
    if (method === 'grid')
      Object.assign(slice, {
        cols: workbench.o.cols,
        rows: workbench.o.rows,
        gx: workbench.o.gx,
        gy: workbench.o.gy,
        cellW: workbench.o.cellW,
        cellH: workbench.o.cellH,
        gapX: workbench.o.gapX,
        gapY: workbench.o.gapY,
      });
    K[workbench.kit] = { ...(K[workbench.kit] || {}), slice };
  }
  changed();
  commit(true);
  render();
  const n = Object.keys(entries).length;
  toast(
    `${n} part${n === 1 ? '' : 's'} written, ${steps.length} picture${steps.length === 1 ? '' : 's'} changed. Save to put them in the game.`,
    'ok'
  );
}
/* Part mode's work on a part carried over to its entry written again from a sheet (studio track ST-4) */
const WB_JOINT_KEYS = ['z', 'turn', 'accepts', 'mirrorOf'];
function wbKeepJoints(old, e) {
  if (old.kind === e.kind) e.pivot = old.pivot;
  if (old.size) e.size = old.size;
  for (const k of WB_JOINT_KEYS) if (old[k] !== undefined) e[k] = old[k];
  for (const v of WB_VIEWS) {
    const O = old.views[v],
      V = e.views[v];
    if (!O || !V || O === V) continue;
    if (O.pivot) V.pivot = O.pivot;
    if (O.sizes) V.sizes = O.sizes;
  }
}
/* ---------- actions and inputs ---------- */
ACTIONS.wbOpen = async () => {
  const i = document.createElement('input');
  i.type = 'file';
  i.multiple = true;
  i.accept = 'image/png,image/webp,image/jpeg,.json';
  i.onchange = () => i.files.length && wbAddFiles(i.files);
  i.click();
};
ACTIONS.wbSheet = d => {
  workbench.cur = +d.i;
  workbench.zoom = 0;
  workbench.sel = null;
  render();
};
ACTIONS.wbDrop = d => {
  workbench.sheets.splice(+d.i, 1);
  workbench.cur = Math.min(workbench.cur, workbench.sheets.length - 1);
  workbench.cache = null;
  workbench.sel = null;
  render();
};
ACTIONS.wbPick = d => {
  const p = wbParts().all.find(q => q.key === d.k);
  if (!p) return;
  workbench.sel = p.key;
  const si = +p.key.split(':')[0];
  if (si !== workbench.cur) {
    workbench.cur = si;
    workbench.zoom = 0;
    return render();
  }
  wbRefreshSide();
  if (workbench.pc && workbench.pc.cv.isConnected) {
    drawPixelCanvas(workbench.pc);
    const st = workbench.pc.stage,
      Z = workbench.pc.zoom;
    st.scrollTo({
      left: p.src.x * Z - st.clientWidth / 2 + (p.src.w * Z) / 2,
      top: p.src.y * Z - st.clientHeight / 2 + (p.src.h * Z) / 2,
    });
  }
};
ACTIONS.wbZoom = d => {
  if (!workbench.pc) return;
  const z = +d.z;
  pixelCanvasZoom(
    workbench.pc,
    z === 0 ? pixelCanvasFit(workbench.pc, 1, 16) : z > 0 ? workbench.pc.zoom + 1 : workbench.pc.zoom - 1
  );
  workbench.zoom = workbench.pc.zoom;
};
ACTIONS.wbPickKey = () => {
  workbench.pick = !workbench.pick;
  render();
};
ACTIONS.wbDetect = () => {
  const S = wbSheet();
  if (!S) return;
  const d = snapDetect(S.img);
  if (d.scale > 1) Object.assign(workbench.o, { scale: 'snap', snapScale: d.scale, snapX: d.ox, snapY: d.oy });
  else workbench.o.scale = 'none';
  toast(d.scale > 1 ? `Drawn at ${d.scale} px a pixel.` : 'It looks drawn at true scale.');
  workbench.cache = null;
  render();
};
ACTIONS.wbWrite = () => wbWrite().catch(e => toast('Writing failed: ' + e.message, 'err'));
const WB_RENDER_KEYS = ['method', 'key', 'scale'];
function wbInput(ev) {
  const el = ev.target;
  if (!el.closest || !el.closest('.wb')) return;
  if (el.dataset.wb) {
    const k = el.dataset.wb,
      v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    if (el.type === 'number' && !Number.isFinite(v)) return;
    workbench.o[k] = k === 'conn' ? Number(v) : v;
    if (WB_RENDER_KEYS.includes(k)) {
      workbench.cache = null;
      if (ev.type === 'change') render();
      return;
    }
    clearTimeout(wbInput.t);
    wbInput.t = setTimeout(wbRefresh, ev.type === 'change' ? 0 : 250);
  } else if (el.dataset.wbKit !== undefined && ev.type === 'change') {
    const name = sheetName('{s}', { s: el.value });
    if (!name) return;
    workbench.kit = name;
    const K = (wbKits().kits || {})[name];
    if (K)
      workbench.o = {
        ...WB_DEFAULTS,
        ...(K.slice || {}),
        method: K.rows ? 'kit' : (K.slice || {}).method || workbench.o.method,
      };
    workbench.cache = null;
    render();
  } else if (el.dataset.wbView !== undefined && ev.type === 'change') {
    workbench.sheets[+el.dataset.wbView].view = el.value;
    workbench.cache = null;
    render();
  } else if (el.dataset.wbName !== undefined && ev.type === 'change') {
    workbench.names[el.dataset.wbName] = el.value;
    wbRefresh();
  } else if (el.dataset.wbKind !== undefined && ev.type === 'change') {
    workbench.kinds[el.dataset.wbKind] = el.value;
    wbRefresh();
  }
}
document.addEventListener('input', wbInput);
document.addEventListener('change', wbInput);
/* drop anywhere: sheets go to the workbench */
const wbHasFiles = ev => ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes('Files');
document.addEventListener('dragover', ev => {
  if (!wbHasFiles(ev) || !studioState.D) return;
  ev.preventDefault();
  document.body.classList.add('wb-dropping');
});
document.addEventListener('dragleave', ev => {
  if (!ev.relatedTarget) document.body.classList.remove('wb-dropping');
});
document.addEventListener('drop', ev => {
  document.body.classList.remove('wb-dropping');
  if (!wbHasFiles(ev) || !studioState.D) return;
  ev.preventDefault();
  wbAddFiles(ev.dataTransfer.files).catch(e => toast('Could not open that: ' + e.message, 'err'));
});
