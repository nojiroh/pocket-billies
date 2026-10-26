'use strict';
/* ================= POCKET BILLIES STUDIO · the ground tile set (Studio art track SA-2a) =================
   The full-mode ground is art/next/tiles47: twelve 32 px tiles for each kind in the catalogue (scenery.terrains).
   The twelve are roles, picked by the game's ground painter (walk-view.js groundTileRole): 1, 7 and 8 plain; 2-6 and
   10 detail; 9 the damp one (in the detail pool); 11 and 12 worn, where people walk. Here a kind's twelve are painted
   on the shared pixel canvas (repeating round itself, so the seams show) beside a tiled live preview: a patch of
   ground laid with the game's own pick and soft patches of light and shade, drawn again on every stroke.
   The Lite tiles (art/scene/tiles: Lite mode and Walk scenes' thumbnails) are made from tiles 1-6 (logic/lite-tile.js,
   the owner's choice, 2026-10-26): a stroke on one of them makes its Lite tile again, in the same undo step. A kind
   whose Lite tiles were drawn by hand at 16 px (the older kinds) keeps them until "Make the Lite tiles from this set".
   tools/build-terrain-v47.py drew the set and retired here (decision 1): these PNGs are the source now.
   Opened from the Art browser (the next/tiles47 folder, or Open in Ground tile set on one of its tiles) and from
   Walk scenes' tile painter. It is the Art browser's section (`art`) while open (artBrowser.tiles). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { applyGroundTone, bigTilePaths, groundTileRole, groundToneAt, walkView } from '../../game/js/walk-view.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelKeyAction } from '../../game/js/logic/pixel-ops.js';
import {
  LITE_FROM,
  LITE_SAME,
  liteDiff,
  liteKindName,
  liteTile,
  liteTilePlan,
  liteToneK,
  sameTiles,
} from '../../game/js/logic/lite-tile.js';
import { ACTIONS, SECTIONS, afterRender, ask, card, openSection, render, studioState, toast } from './studio-app.js';
import {
  artSteps,
  drawPixelCanvas,
  pictureImage,
  pixelCanvas,
  pixelCanvasAct,
  pixelCanvasColor,
  pixelCanvasDeselect,
  pixelCanvasPanel,
  pixelCanvasPanelHTML,
  pixelCanvasToolsHTML,
} from './pixel-canvas.js';
import { atlasGet, loadedAtlas, markArt } from './sprites.js';
import { artBrowser, artPictures } from './art-browser.js';
/* eslint-disable no-func-assign */
expose({
  TILE_ROLES: [() => TILE_ROLES],
  TS_H: [() => TS_H],
  TS_PATH: [() => TS_PATH],
  TS_TONE: [() => TS_TONE],
  TS_W: [() => TS_W],
  artSectionBase: [() => artSectionBase],
  mountTileSet: [() => mountTileSet, v => (mountTileSet = v)],
  tileSet: [() => tileSet],
  tileSetHTML: [() => tileSetHTML, v => (tileSetHTML = v)],
  tileSetKinds: [() => tileSetKinds, v => (tileSetKinds = v)],
  tileSetOpen: [() => tileSetOpen, v => ((tileSetOpen = v), provide({ tileSetOpen }))],
  tileSetPreview: [() => tileSetPreview, v => (tileSetPreview = v)],
  tsBig: [() => tsBig],
  tsDraw: [() => tsDraw, v => (tsDraw = v)],
  tsDrawLite: [() => tsDrawLite, v => (tsDrawLite = v)],
  tsDrawThumbs: [() => tsDrawThumbs, v => (tsDrawThumbs = v)],
  tsKind: [() => tsKind],
  tsLinked: [() => tsLinked, v => (tsLinked = v)],
  tsLite: [() => tsLite],
  tsLiteOf: [() => tsLiteOf],
  tsSame: [() => tsSame, v => (tsSame = v)],
  tsSet: [() => tsSet],
});
/* eslint-enable no-func-assign */
provide({ tileSetOpen });
/* to-module: end */
/* the open kind and tile, the view's switches and the painter's tool */
const tileSet = {
  on: false,
  name: '',
  n: 1,
  tone: true,
  path: true,
  /** @type {Record<string, boolean>} whether a kind's Lite tiles are made from its set (checked when it opens) */
  linked: {},
  pc: null,
  keep: {},
  tool: 'pen',
  color: '#000000',
  same: [],
  from: null,
};
/* the twelve tiles' roles, as the game picks them */
const TILE_ROLES = [
  'plain',
  'detail',
  'detail',
  'detail',
  'detail',
  'detail',
  'plain',
  'plain',
  'damp',
  'detail',
  'worn',
  'worn',
];
/* the preview: metres across and deep, and the row a path runs along */
const TS_W = 8,
  TS_H = 6,
  TS_PATH = 3;

/* ---------- the kinds and their pictures ---------- */
const tsSet = () => (studioState.D.scenery || {}).tileSet || 'tiles47';
/* the catalogue's kinds that have a 32 px set: [{ name, label, t (the catalogue entry) }], by name */
function tileSetKinds() {
  const T = (studioState.D.scenery || {}).terrains || {},
    have = new Set(artPictures()),
    seen = new Set(),
    out = [];
  for (const t of Object.values(T)) {
    if (!t || !t.tile || seen.has(t.tile)) continue;
    seen.add(t.tile);
    const name = liteKindName(t.tile);
    if (have.has('art/' + bigTilePaths(t.tile, tsSet())[0])) out.push({ name, label: t.name || name, t });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
const tsKind = name => tileSetKinds().find(k => k.name === name) || null;
/* a kind's twelve 32 px tiles (art/...) */
const tsBig = K => bigTilePaths(K.t.tile, tsSet()).map(p => 'art/' + p);
/* its Lite tiles' plan, art/ paths */
const tsLite = K =>
  liteTilePlan(K.t, bigTilePaths(K.t.tile, tsSet())).map(p => ({ from: 'art/' + p.from, to: 'art/' + p.to, k: p.k }));
const TS_TONE = { toneAt: groundToneAt, applyTone: applyGroundTone };
/* the Lite tile a 32 px picture makes, as pixels */
const tsLiteOf = (K, im, k) => liteTile(im, k, liteToneK(K.t), TS_TONE);

/* opens a kind (its name), at a tile (1-12); loads its pictures and checks whether its Lite tiles are made from it */
async function tileSetOpen(name, n = 1, from = null) {
  const K = tsKind(name) || tileSetKinds()[0];
  if (!K) return toast('No ground kind has a 32 px tile set.', 'err');
  try {
    await Promise.all([...tsBig(K), ...tsLite(K).map(p => p.to)].map(p => atlasGet(p)));
  } catch (e) {
    return toast('Could not load the tiles of ' + K.label, 'err');
  }
  artBrowser.tiles = true;
  Object.assign(tileSet, { name: K.name, n: Math.max(1, Math.min(12, n | 0 || 1)), pc: null });
  if (from) tileSet.from = from;
  if (!(K.name in tileSet.linked)) tileSet.linked[K.name] = tsLinked(K);
  tsSame(K);
  if (studioState.sec !== 'art') openSection('art');
  else render();
}
/* a kind's Lite tiles are made from its set when each is what its 32 px tile makes */
function tsLinked(K) {
  return tsLite(K).every(p => {
    const a = loadedAtlas(p.from),
      b = loadedAtlas(p.to);
    return a && b && liteDiff(tsLiteOf(K, pictureImage(a), p.k), pictureImage(b)) <= LITE_SAME;
  });
}
/* the tiles of the kind that are the same as an earlier one (the quick check's Ground step wants twelve different) */
function tsSame(K) {
  tileSet.same = sameTiles(tsBig(K).map(p => pictureImage(loadedAtlas(p))));
}

/* ---------- the section ---------- */
const artSectionBase = SECTIONS.art;
SECTIONS.art = () => (artBrowser.tiles ? tileSetHTML() : artSectionBase());
function tileSetHTML() {
  const K = tsKind(tileSet.name);
  if (!K) {
    artBrowser.tiles = false;
    return artSectionBase();
  }
  afterRender(mountTileSet);
  const big = tsBig(K),
    lite = tsLite(K),
    path = big[tileSet.n - 1],
    L = lite.find(p => p.k === tileSet.n - 1),
    linked = tileSet.linked[K.name];
  const tiles = big
    .map(
      (p, i) =>
        `<button class="ts-tile${i + 1 === tileSet.n ? ' on' : ''}" data-act="tsTile" data-n="${i + 1}" title="${escapeHtml(p)}"><canvas class="pix ts-thumb" data-p="${escapeHtml(p)}" width="32" height="32"></canvas><small>${i + 1} · ${TILE_ROLES[i]}${i < 6 ? ' · Lite' : ''}</small></button>`
    )
    .join('');
  const liteNote = linked
    ? `<p class="help">Tiles 1-6 make this kind’s Lite tiles (Lite mode and Walk scenes’ thumbnails): each stroke on them makes its Lite tile again, in the same undo step.</p>`
    : `<p class="help warn">This kind’s Lite tiles were drawn by hand at 16 px, apart from this set, so painting here leaves them as they are.</p><button class="btn sm" data-act="tsLiteMake">Make the Lite tiles from this set</button>`;
  const same = tileSet.same.length
    ? `<p class="help warn">Tiles ${tileSet.same.map(([a, b]) => `${b} and ${a}`).join(', ')} are the same: the quick check’s Ground step wants twelve different tiles a kind.</p>`
    : '';
  return `<div class="ed-col solo"><div class="ed-head"><h2>Ground tile set</h2><button class="btn" data-act="tsClose">${tileSet.from ? 'Back' : 'Back to the Art browser'}</button></div>
  <div class="seg-row ts-bar"><label class="fld ts-kind"><span>Kind</span><select id="tsKind">${tileSetKinds()
    .map(
      k =>
        `<option value="${escapeHtml(k.name)}"${k.name === K.name ? ' selected' : ''}>${escapeHtml(k.label)}</option>`
    )
    .join(
      ''
    )}</select></label><span class="help mono">art/next/${escapeHtml(tsSet())}/${escapeHtml(K.name)}_1..12.png</span></div>
  <div class="ts-tiles">${tiles}</div>${same}
  ${card(
    `Tile ${tileSet.n} (${TILE_ROLES[tileSet.n - 1]}): ${escapeHtml(K.label)}`,
    `<div class="sc-pe" id="tsPe"><div class="sc-pe-bar">${pixelCanvasToolsHTML()}<span class="colw"><input type="color" id="tsColor" value="${tileSet.color}"></span></div>
  <div class="sc-pe-body"><div class="sc-pe-stage" id="tsStage"></div><div class="sc-pe-side">
  <h4>The ground, as the game lays it</h4><canvas class="pix ts-prev" id="tsPrev" width="${TS_W * LITE_FROM}" height="${TS_H * LITE_FROM}"></canvas>
  <div class="seg-row"><label class="chk"><input type="checkbox" id="tsTone"${tileSet.tone ? ' checked' : ''}> Soft patches</label><label class="chk"><input type="checkbox" id="tsPath"${tileSet.path ? ' checked' : ''}> A path across</label></div>
  <p class="help">${TS_W} × ${TS_H} m of ${escapeHtml(K.label)}, each metre’s tile picked as the game picks it; the tile you paint is outlined.</p>
  <h4>Lite tile</h4>${
    L
      ? `<div class="seg-row ts-lite"><canvas class="pix" id="tsLite1" width="16" height="16"></canvas><canvas class="pix ts-lite4" id="tsLite4" width="16" height="16"></canvas><span class="help mono">${escapeHtml(L.to)}</span></div>`
      : '<p class="help">Tiles 7-12 make no Lite tile.</p>'
  }${liteNote}
  ${pixelCanvasPanelHTML()}<p class="help">The tile repeats in every direction, so keep the edges matching. Each stroke is a step of the Studio’s undo; Save to game writes the pictures.</p></div></div></div>`
  )}</div>`;
}

/* ---------- drawing: the thumbnails, the preview and the Lite tile ---------- */
function tsDrawThumbs() {
  document.querySelectorAll('canvas.ts-thumb').forEach(c => {
    const src = loadedAtlas(c.dataset.p),
      x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    if (src) x.drawImage(src, 0, 0, c.width, c.height);
  });
}
/* the patch of ground: each metre's tile by the game's pick (a path's worn tiles along one row, if on), then the
   soft patches over it in world metres, as the ground painter lays them */
function tileSetPreview(K, cv) {
  if (!cv) return null;
  const big = tsBig(K).map(p => loadedAtlas(p)),
    S = LITE_FROM,
    W = TS_W * S,
    H = TS_H * S,
    x = cv.getContext('2d');
  if (big.some(c => !c)) return null;
  const px = big.map(c => new Uint32Array(pictureImage(c).data.buffer)),
    out = x.createImageData(W, H),
    o = new Uint32Array(out.data.buffer),
    k = tileSet.tone ? liteToneK(K.t) : 0,
    picks = [];
  for (let j = 0; j < TS_H; j++)
    for (let i = 0; i < TS_W; i++) {
      const t = groundTileRole(i, j, 0, tileSet.path && j === TS_PATH, true),
        src = px[t];
      picks.push(t);
      for (let y = 0; y < S; y++)
        for (let xx = 0; xx < S; xx++) {
          let c = src[y * S + xx];
          if (k > 0)
            c = applyGroundTone(
              c,
              groundToneAt(i + (xx + 0.5) / S, j + (y + 0.5) / S),
              (i * S + xx + j * S + y) % 2 === 1,
              k
            );
          o[(j * S + y) * W + i * S + xx] = c;
        }
    }
  x.putImageData(out, 0, 0);
  /* the painted tile's metres, outlined */
  x.strokeStyle = 'rgba(255,255,255,.85)';
  x.lineWidth = 1;
  picks.forEach((t, q) => {
    if (t === tileSet.n - 1) x.strokeRect((q % TS_W) * S + 0.5, Math.floor(q / TS_W) * S + 0.5, S - 1, S - 1);
  });
  return picks;
}
function tsDrawLite(K) {
  const L = tsLite(K).find(p => p.k === tileSet.n - 1),
    src = L && loadedAtlas(L.to);
  for (const id of ['#tsLite1', '#tsLite4']) {
    const c = $(id);
    if (!c || !src) continue;
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0);
  }
}
function tsDraw() {
  const K = tsKind(tileSet.name);
  if (!K) return;
  tsDrawThumbs();
  tileSetPreview(K, $('#tsPrev'));
  tsDrawLite(K);
}

/* ---------- painting ---------- */
function mountTileSet() {
  const st = $('#tsStage'),
    K = tsKind(tileSet.name);
  if (!st || !K) return;
  const path = tsBig(K)[tileSet.n - 1];
  const P = pixelCanvas(st, {
    get: () => loadedAtlas(path),
    path: () => path,
    repeat: 3,
    tool: tileSet.tool,
    color: tileSet.color,
    /* a stroke on tiles 1-6 of a kind whose Lite tiles are made from its set makes its Lite tile again, one step */
    companions: (P, before, after) => {
      const L = tsLite(K).find(p => p.from === path);
      if (!L || !tileSet.linked[K.name]) return [];
      const c = loadedAtlas(L.to);
      if (!c) return [];
      const was = pictureImage(c),
        made = tsLiteOf(K, after, L.k),
        im = new ImageData(made.data, made.width, made.height);
      c.getContext('2d').putImageData(im, 0, 0);
      markArt(L.to, c);
      return [[L.to, was, pictureImage(c)]];
    },
    changed: () => {
      markArt(path, loadedAtlas(path));
      walkView.gkey = '';
      tsSame(K);
      tsDraw();
    },
    toolChanged: P => (tileSet.tool = P.tool),
    colorChanged: P => {
      tileSet.color = P.color;
      const c = $('#tsColor');
      if (c) c.value = P.color;
    },
    drawn: P => {
      tileSet.keep = {
        zoom: P.zoom,
        showGrid: P.showGrid,
        symMode: P.symMode,
        symShift: P.symShift,
        lock: P.lock,
        showOff: P.showOff,
      };
    },
  });
  Object.assign(P, { zoom: 5 }, tileSet.keep);
  tileSet.pc = P;
  pixelCanvasPanel(P, $('#tsPe'));
  drawPixelCanvas(P);
  tsDraw();
  const col = $('#tsColor');
  col.addEventListener('input', () => pixelCanvasColor(P, col.value));
  $('#tsKind').addEventListener('change', e => tileSetOpen(e.target.value, tileSet.n));
  $('#tsTone').addEventListener('change', e => {
    tileSet.tone = e.target.checked;
    tsDraw();
  });
  $('#tsPath').addEventListener('change', e => {
    tileSet.path = e.target.checked;
    tsDraw();
  });
}
/* an undo or redo of a tile (or its Lite tile) draws the view again */
document.addEventListener('studio-art', ev => {
  if (!artBrowser.tiles || studioState.sec !== 'art') return;
  const K = tsKind(tileSet.name),
    p = ev.detail && ev.detail.path;
  if (!K || !p || !(tsBig(K).includes(p) || tsLite(K).some(L => L.to === p))) return;
  tsSame(K);
  if (tileSet.pc) drawPixelCanvas(tileSet.pc);
  tsDraw();
});
/* the painter's keys while the pointer is over it (as the other painters') */
document.addEventListener(
  'keydown',
  ev => {
    const pe = $('#tsPe'),
      P = tileSet.pc;
    if (!pe || !P || !P.cv.isConnected || !pe.matches(':hover') || $('#dlg').innerHTML) return;
    if (ev.target.closest('input,select,textarea')) return;
    const a = pixelKeyAction(ev);
    if (!a || a === 'undo' || a === 'redo' || a === 'onion') return;
    if (a === 'deselect' ? !pixelCanvasDeselect(P) : !pixelCanvasAct(P, a)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  },
  true
);

/* ---------- actions ---------- */
ACTIONS.tsOpen = d => tileSetOpen(d.name || '', +d.n || 1, d.from || null);
ACTIONS.tsTile = d => {
  tileSet.n = +d.n || 1;
  tileSet.pc = null;
  render();
};
ACTIONS.tsClose = () => {
  const from = tileSet.from;
  artBrowser.tiles = false;
  Object.assign(tileSet, { pc: null, from: null });
  if (from === 'scenes') openSection('scenes');
  else render();
};
/* a kind drawn by hand at 16 px: its six Lite tiles made from its set, one step of the undo */
ACTIONS.tsLiteMake = async () => {
  const K = tsKind(tileSet.name);
  if (!K) return;
  if (
    !(await ask(
      `Make ${escapeHtml(K.label)}’s six Lite tiles from its 32 px set? The 16 px tiles drawn by hand are replaced (Undo puts them back), and from then on painting tiles 1-6 here keeps them in step.`,
      'Make them'
    ))
  )
    return;
  const steps = [];
  for (const L of tsLite(K)) {
    const c = loadedAtlas(L.to),
      src = loadedAtlas(L.from);
    if (!c || !src) continue;
    const was = pictureImage(c),
      made = tsLiteOf(K, pictureImage(src), L.k);
    c.getContext('2d').putImageData(new ImageData(made.data, made.width, made.height), 0, 0);
    markArt(L.to, c);
    steps.push([L.to, was, pictureImage(c)]);
  }
  artSteps(steps);
  tileSet.linked[K.name] = true;
  walkView.gkey = '';
  toast(`${K.label}: the Lite tiles are made from the 32 px set.`);
  render();
};
