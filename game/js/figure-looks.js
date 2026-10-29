'use strict';
/* ================= YOUR LOOK AS A FIGURE (characters track CH-7) =================
   The dressing room's figures: the look you are trying on (not saved yet, so not lookOf('me')) and each tile's (that
   look wearing one item), built by the figure kit as you are (figures.js figureFromLook for 'me': your picks win)
   and baked in the studio light (figures.js bakeFigure) as canvases for the page.
   - A figure's mesh is built on the helper thread (figure-meshes.js) and named by what shapes it: the body, the build
     and what is worn, less the face's pieces (eyes, brows, mouth and glasses are painted marks). Colours, skin and the
     face are painted at the bake from the look itself (its own figure, made on the page), on the same mesh, so trying
     a colour or a face costs no build.
   - A tile's figure is built at a lower detail, one at a time (the next only once the last is in), so the tiles the
     room asks for first come first; the look you wear (`now`) is built ahead of any tile. At most one tile is baked
     every FIGURE_LOOK_GAP ms; tiles' pictures are kept (FIGURE_LOOK_PICTURES).
   - At most FIGURE_LOOK_KEEP figures are kept, the longest unused let go (their meshes and the baker's buffers);
     figureLooksForget lets every one go when the room closes. Nothing here reads or sends a save. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { figureFaceState, figurePose, figureView, jointMatrices } from './logic/figure-pose.js';
import { figureSeed } from './logic/figure-kit.js';
import { makeCanvas } from './art.js';
import { figureMeshBuilding, figureMeshDrop, figureMeshGet } from './figure-meshes.js';
import {
  FIGURE_LOOKS,
  bakeFigure,
  figureDesign,
  figureFromLook,
  figureItems,
  figureKitNow,
  figureKitRevision,
  figureResForget,
  figureStyle,
} from './figures.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_LOOK_GAP: [() => FIGURE_LOOK_GAP],
  FIGURE_LOOK_KEEP: [() => FIGURE_LOOK_KEEP],
  FIGURE_LOOK_PAINTED: [() => FIGURE_LOOK_PAINTED],
  FIGURE_LOOK_PAINTS: [() => FIGURE_LOOK_PAINTS],
  FIGURE_LOOK_PICTURES: [() => FIGURE_LOOK_PICTURES],
  figureLookCrop: [() => figureLookCrop, v => (figureLookCrop = v)],
  figureLookCut: [() => figureLookCut, v => (figureLookCut = v)],
  figureLookDef: [() => figureLookDef, v => (figureLookDef = v)],
  figureLookDesign: [() => figureLookDesign, v => (figureLookDesign = v)],
  figureLookDetail: [() => figureLookDetail, v => (figureLookDetail = v)],
  figureLookDrop: [() => figureLookDrop, v => (figureLookDrop = v)],
  figureLookKept: [() => figureLookKept, v => (figureLookKept = v)],
  figureLookKey: [() => figureLookKey, v => (figureLookKey = v)],
  figureLookPaint: [() => figureLookPaint, v => (figureLookPaint = v)],
  figureLookPaintKey: [() => figureLookPaintKey, v => (figureLookPaintKey = v)],
  figureLookPicture: [() => figureLookPicture, v => ((figureLookPicture = v), provide({ figureLookPicture }))],
  figureLookShape: [() => figureLookShape, v => (figureLookShape = v)],
  figureLooks: [() => figureLooks],
  figureLooksForget: [() => figureLooksForget, v => ((figureLooksForget = v), provide({ figureLooksForget }))],
  figureLooksReport: [() => figureLooksReport, v => ((figureLooksReport = v), provide({ figureLooksReport }))],
});
/* eslint-enable no-func-assign */
provide({ figureLookPicture, figureLooksForget, figureLooksReport });
/* to-module: end */
/** the figures kept (each a mesh on the helper thread's side and buffers in the baker's context) */
const FIGURE_LOOK_KEEP = 16;
/** the tiles' pictures kept */
const FIGURE_LOOK_PICTURES = 240;
/** the painted figures kept (a look's colours and face on its shape: about 30 ms each to make on a desktop) */
const FIGURE_LOOK_PAINTS = 48;
/** at most one tile baked this often (ms) */
const FIGURE_LOOK_GAP = 30;
/** the worn pieces that are only painted on the face, so they don't change a figure's mesh */
const FIGURE_LOOK_PAINTED = ['eyes', 'brows', 'mouth', 'glasses'];

const figureLooks = {
  /** name -> the built figure, the longest unused first */
  defs: new Map(),
  /** name -> its figure while the mesh is built */
  pending: new Map(),
  /** the mesh key of the tile being built (one at a time) */
  building: '',
  /** a look's key -> its painted figure */
  paints: new Map(),
  /** picture key -> canvas */
  pictures: new Map(),
  tileAt: -Infinity,
  builds: 0,
  bakes: 0,
  bakeMs: 0,
  waitedMs: 0,
  /** name -> when its build was asked for */
  asked: new Map(),
};

/** what shapes a look's figure: its body, build and what is worn, less the face's painted pieces @param {any} L */
function figureLookShape(L) {
  const wear = { ...(L.wear || {}) };
  for (const k of FIGURE_LOOK_PAINTED) delete wear[k];
  return JSON.stringify([L.body || {}, L.build || null, wear]);
}
/** a direction's detail for the look you wear, or a tile's (lower: a tile is small) */
function figureLookDetail(style, tile) {
  const LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel,
    d = LK.detail || 1;
  return tile ? Math.round(Math.min(d, 1) * 80) / 100 : d;
}
/** the direction's design for you (its extras), when it has one */
function figureLookDesign(style) {
  return figureDesign(style) ? FIGURE_LOOKS[style] : null;
}
/** let a kept figure go: its buffers in the baker and its mesh */
function figureLookDrop(name) {
  const D = figureLooks.defs.get(name);
  figureLooks.defs.delete(name);
  figureResForget(name);
  if (D) figureMeshDrop(name + '|' + D.detail);
}
/**
 * the built figure of a look's shape (null while its mesh is built: ask again); a tile's waits its turn
 * @param {any} look @param {string} style @param {boolean} tile
 */
function figureLookDef(look, style, tile) {
  const L = figureLooks,
    detail = figureLookDetail(style, tile),
    name =
      'dress:' +
      figureSeed(figureLookShape(look) + '|' + figureKitRevision()).toString(36) +
      '@' +
      style +
      (tile ? ':t' : ''),
    key = name + '|' + detail;
  let D = L.defs.get(name);
  if (D) {
    L.defs.delete(name);
    L.defs.set(name, D);
    return D;
  }
  /* tiles one at a time: another tile's build under way keeps this one waiting */
  if (tile && L.building && L.building !== key && figureMeshBuilding(L.building)) return null;
  const items = figureItems();
  if (!items) return null;
  let F = L.pending.get(name);
  if (!F) {
    F = figureFromLook(name, 'me', look, figureLookDesign(style), items, figureKitNow());
    L.pending.set(name, F);
    L.asked.set(name, performance.now());
  }
  const M = figureMeshGet(key, F, detail, true);
  if (!M) {
    if (tile) L.building = key;
    return null;
  }
  L.pending.delete(name);
  if (L.building === key) L.building = '';
  L.builds++;
  L.waitedMs += performance.now() - (L.asked.get(name) || performance.now());
  L.asked.delete(name);
  D = { kind: 'code', name, F, height: F.height, ext: M.ext, detail, paint: figureLookPaintKey(look, style) };
  L.defs.set(name, D);
  while (L.defs.size > FIGURE_LOOK_KEEP) figureLookDrop(L.defs.keys().next().value);
  return D;
}
/** what a look's paint is made from: the whole look, the direction and the kit */
function figureLookPaintKey(look, style) {
  return figureSeed(JSON.stringify([look, style, figureKitRevision()])).toString(36);
}
/** the figure painted as this look (its colours and face) on a built shape's mesh */
function figureLookPaint(D, look, style) {
  const L = figureLooks,
    k = figureLookPaintKey(look, style);
  if (k === D.paint) return D.F;
  const pk = D.name + '#' + k;
  let F = L.paints.get(pk);
  if (F) {
    L.paints.delete(pk);
    L.paints.set(pk, F);
    return F;
  }
  F = figureFromLook(D.name, 'me', look, figureLookDesign(style), figureItems(), figureKitNow());
  L.paints.set(pk, F);
  while (L.paints.size > FIGURE_LOOK_PAINTS) L.paints.delete(L.paints.keys().next().value);
  return F;
}
/**
 * where a crop of a figure is, in metres: x across from its middle, y up from the ground; the dressing room's tiles
 * (wardrobe.json crops, the 2D rig's): the head with its hair and hat, the face, the body, the legs, the feet, the
 * head and shoulders (bust), or the whole figure
 * @param {any} F @param {{ top: number }} ext @param {string} crop
 * @returns {{ x0: number, x1: number, y0: number, y1: number }}
 */
function figureLookCrop(F, ext, crop) {
  const J = jointMatrices(F, figurePose(F, 'idle', 0), 0),
    at = (/** @type {string} */ id, /** @type {number} */ d) => {
      const i = F.parts.findIndex((/** @type {any} */ p) => p.id === id);
      return i >= 0 ? J[i * 16 + 13] : d;
    },
    top = ext.top,
    head = at('head', F.height * 0.53),
    neck = at('neck', head - 0.08),
    hips = at('hips', F.height * 0.25),
    knee = at('shinA', hips * 0.53),
    box = (/** @type {number} */ y0, /** @type {number} */ y1, /** @type {number} */ aspect) => {
      const w = (y1 - y0) * aspect;
      return { x0: -w / 2, x1: w / 2, y0, y1 };
    };
  switch (crop) {
    case 'head':
      return box(neck - 0.05, top + 0.02, 0.86);
    case 'face':
      return box(head - 0.05, head + 0.72 * (F.height - head), 1.03);
    case 'body':
      return box(hips - 0.1, neck + 0.08, 0.87);
    case 'legs':
      return box(-0.04, hips + 0.1, 0.52);
    case 'feet':
      return box(-0.04, knee * 0.62, 2.2);
    case 'bust':
      return box(F.kit && F.kit.bust != null ? F.kit.bust : hips + 0.3, top + 0.02, 0.82);
    default:
      return box(-0.04, top + 0.02, 0.45);
  }
}
/** a crop of a baked picture (its ground point `ax`, `ay`), as a new canvas */
function figureLookCut(im, F, ext, crop, ppm) {
  const C = figureLookCrop(F, ext, crop),
    x0 = Math.round(im.ax + C.x0 * ppm),
    y0 = Math.round(im.ay - C.y1 * ppm),
    w = Math.max(4, Math.round((C.x1 - C.x0) * ppm)),
    h = Math.max(4, Math.round((C.y1 - C.y0) * ppm)),
    out = makeCanvas(w, h),
    x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(im, -x0, -y0);
  out.ppm = ppm;
  out.figure = im.figure;
  return out;
}
/**
 * CH-7: a look as a figure, baked in the studio light, as a canvas (its ground point `ax`, `ay` when whole); null
 * while its figure is built or the baker can't draw: ask again. `o`: tile (a tile's picture: a lower detail, built in
 * turn, kept), clip ('idle'), frame (0), turn (1: facing you; 0 from behind), tilt (radians, 4 degrees), ppm (64), crop
 * ('whole', 'head', 'face', 'body', 'legs', 'feet' or 'bust'), face (a face state's options: blink, expr), style (the
 * figures' direction).
 * @param {any} look
 * @param {{ tile?: boolean, clip?: string, frame?: number, turn?: number, tilt?: number, ppm?: number, crop?: string,
 *   face?: { blink?: number, expr?: string }, style?: string }} [o]
 */
function figureLookPicture(look, o = {}) {
  const L = figureLooks,
    style = o.style || figureStyle(),
    tile = !!o.tile,
    clip = o.clip || 'idle',
    frame = o.frame || 0,
    turn = o.turn ?? 1,
    tilt = o.tilt ?? (4 * Math.PI) / 180,
    ppm = o.ppm || 64,
    crop = o.crop || 'whole',
    V = figureView(Math.PI * turn, 0, tilt, 32),
    key = tile ? figureLookKey(look, style, o) : '';
  if (tile) {
    const kept = L.pictures.get(key);
    if (kept) {
      L.pictures.delete(key);
      L.pictures.set(key, kept);
      return kept;
    }
  }
  /* its build is asked for at once; a tile's bake waits for the gap */
  const D = figureLookDef(look, style, tile);
  if (!D || (tile && performance.now() - L.tileAt < FIGURE_LOOK_GAP)) return null;
  const F = figureLookPaint(D, look, style),
    Fig = F === D.F ? D : { ...D, F },
    t0 = performance.now(),
    face = F.faceSet ? figureFaceState(F, o.face || {}) : null;
  let im = bakeFigure(Fig, clip, frame, V, ppm, true, style, { face });
  if (!im) return null;
  L.bakes++;
  L.bakeMs += performance.now() - t0;
  if (crop !== 'whole') im = figureLookCut(im, F, D.ext, crop, ppm);
  if (tile) {
    L.tileAt = performance.now();
    L.pictures.set(key, im);
    while (L.pictures.size > FIGURE_LOOK_PICTURES) L.pictures.delete(L.pictures.keys().next().value);
  }
  return im;
}
/** a tile's picture's key: what it is painted from and how it is seen */
function figureLookKey(look, style, o) {
  const V = figureView(Math.PI * (o.turn ?? 1), 0, o.tilt ?? (4 * Math.PI) / 180, 32);
  return [
    figureLookPaintKey(look, style),
    o.clip || 'idle',
    o.frame || 0,
    V.k,
    V.tiltStep,
    o.ppm || 64,
    o.crop || 'whole',
    JSON.stringify(o.face || null),
  ].join('|');
}
/** whether a tile's picture of this look is kept already (no bake needed) */
function figureLookKept(look, o = {}) {
  return figureLooks.pictures.has(figureLookKey(look, o.style || figureStyle(), o));
}
/** let every figure, painted figure and picture go (the dressing room closed) */
function figureLooksForget() {
  const L = figureLooks;
  for (const name of [...L.defs.keys()]) figureLookDrop(name);
  L.pending.clear();
  L.paints.clear();
  L.pictures.clear();
  L.asked.clear();
  L.building = '';
  L.tileAt = -Infinity;
}
/** the dressing room's figures for the debug log (numbers only): built, kept, waiting, pictures and their times */
function figureLooksReport() {
  const L = figureLooks;
  return {
    builds: L.builds,
    waitMs: L.builds ? Math.round(L.waitedMs / L.builds) : 0,
    kept: L.defs.size,
    waiting: L.pending.size,
    pictures: L.pictures.size,
    bakes: L.bakes,
    bakeMs: L.bakes ? Math.round((L.bakeMs / L.bakes) * 10) / 10 : 0,
  };
}
