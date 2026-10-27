'use strict';
/* ================= POCKET BILLIES STUDIO · scene art previews (Studio art track SA-2b) =================
   Pictures the game doesn't show as they are get a preview of how it uses them, in the Art browser's picture panel
   and beside the painter (drawn again after each stroke):
   - walls (art/scene/build/walls.png) and the building sheet (scenery.buildArt.detail): greyscale cells the shaders
     colour (logic/wall-ramp.js); a cell repeats over a patch of wall in the colour you pick, the cells outlined on
     the painter, with a note of pixels between the five levels;
   - rooms (rooms.png): each room as the little box seen through a window, by day and lit at night;
   - flags (scene/flags, and the legacy towns' in legacy/scene/flags): waving on a mast by the game's ripple, the postcard stamp, and who flies it;
   - far backdrops (scene/far): over a sky, wrapped so the seam shows. The game loads these but doesn't draw them
     (walk-view.js only preloads scene/far/<far>.png; `far` still picks the sound, water and default walls).
   Lighting is flat: the shaders' sun, shadows and bumps are left out. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { WALL_COLORS } from '../../game/js/walk/heights.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  BUILD_CELL_NAMES,
  ROOM_NAMES,
  WALL_CELL_NAMES,
  flagRipple,
  wallCellColoured,
  wallHex,
  wallOffLevels,
} from '../../game/js/logic/wall-ramp.js';
import { studioState } from './studio-app.js';
import { drawPixelCanvas } from './pixel-canvas.js';
import { atlasGet, loadedAtlas } from './sprites.js';
import { artBrowser, artPicSrc } from './art-browser.js';
/* eslint-disable no-func-assign */
expose({
  SP_CELL: [() => SP_CELL],
  mountScenePreviews: [() => mountScenePreviews, v => ((mountScenePreviews = v), provide({ mountScenePreviews }))],
  scenePreviewHTML: [() => scenePreviewHTML, v => ((scenePreviewHTML = v), provide({ scenePreviewHTML }))],
  scenePreviewKind: [() => scenePreviewKind, v => (scenePreviewKind = v)],
  scenePreviewOverlay: [() => scenePreviewOverlay, v => ((scenePreviewOverlay = v), provide({ scenePreviewOverlay }))],
  scenePv: [() => scenePv],
  spBuildLive: [() => spBuildLive],
  spColour: [() => spColour, v => (spColour = v)],
  spDraw: [() => spDraw, v => (spDraw = v)],
  spDrawFar: [() => spDrawFar, v => (spDrawFar = v)],
  spDrawFlag: [() => spDrawFlag, v => (spDrawFlag = v)],
  spDrawRoom: [() => spDrawRoom, v => (spDrawRoom = v)],
  spDrawWall: [() => spDrawWall, v => (spDrawWall = v)],
  spLoop: [() => spLoop, v => (spLoop = v)],
  spNames: [() => spNames],
  spRunning: [() => spRunning, v => (spRunning = v)],
});
/* eslint-enable no-func-assign */
provide({ mountScenePreviews, scenePreviewHTML, scenePreviewOverlay });
/* to-module: end */
const scenePv = { cell: 0, col: {}, lean: 0.35, vers: new Map() };
const SP_CELL = 64;
/* what kind of preview a picture gets: 'walls', 'build', 'rooms', 'flag', 'far' or '' */
function scenePreviewKind(path) {
  const S = studioState.D.scenery || {},
    p = String(path || '').replace(/^art\//, ''),
    B = S.buildArt || { detail: 'scene/build/detail.png', rooms: 'scene/build/rooms.png' };
  if (p === (S.wallArt || 'scene/build/walls.png')) return 'walls';
  if (/^scene\/build\/detail[\w-]*\.png$/.test(p)) return 'build';
  if (p === B.rooms) return 'rooms';
  if (/^(legacy\/)?scene\/flags\/[\w-]+\.png$/.test(p)) return 'flag'; /* SA-5: legacy towns' flags in art/legacy */
  if (/^scene\/far\/[\w-]+\.png$/.test(p)) return 'far';
  return '';
}
const spBuildLive = p => p.replace(/^art\//, '') === ((studioState.D.scenery || {}).buildArt || {}).detail;
const spNames = kind => (kind === 'walls' ? WALL_CELL_NAMES : BUILD_CELL_NAMES);
/* a cell's colour to preview with: the one picked, else the game's (WALL_COLORS) or a plain one by kind */
function spColour(kind, i) {
  const k = kind + i;
  if (scenePv.col[k]) return scenePv.col[k];
  if (kind === 'walls')
    return (
      '#' +
      WALL_COLORS[i]
        .map(v =>
          Math.round(v * 255)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    );
  return i >= 8 && i <= 13 ? '#a0573f' : i < 8 ? '#d6c3a0' : '#9a8f80';
}

/** the preview for a picture in the Art browser ('' when it has none) */
function scenePreviewHTML(path) {
  const kind = scenePreviewKind(path);
  if (!kind) return '';
  const P = escapeHtml(path);
  if (kind === 'walls' || kind === 'build') {
    const names = spNames(kind),
      i = Math.min(scenePv.cell, names.length - 1),
      note =
        kind === 'build' && !spBuildLive(path)
          ? '<p class="help warn">The game doesn’t read this sheet (scenery.buildArt.detail names another): the builders copy from it.</p>'
          : '';
    return `<div class="sp-scene" data-sp="${P}" data-kind="${kind}"><h4>${kind === 'walls' ? 'As a wall' : 'On a building'}</h4>${note}
    <div class="seg-row"><label class="fld"><span>Cell</span><select class="sp-cell">${names
      .map((n, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${k} · ${escapeHtml(n)}</option>`)
      .join(
        ''
      )}</select></label><label class="fld color"><span>Colour</span><span class="colw"><input type="color" class="sp-col" value="${spColour(kind, i)}"></span></label></div>
    <canvas class="pix sp-wall" width="${SP_CELL * 3}" height="${SP_CELL * 2}"></canvas>
    <p class="help sp-note"></p></div>`;
  }
  if (kind === 'rooms')
    return `<div class="sp-scene" data-sp="${P}" data-kind="rooms"><h4>Behind a window</h4><div class="sp-rooms">${ROOM_NAMES.map(
      (n, k) =>
        `<figure><canvas class="pix sp-room" data-r="${k}" width="96" height="72"></canvas><canvas class="pix sp-room" data-r="${k}" data-night="1" width="96" height="72"></canvas><figcaption>${escapeHtml(n)}</figcaption></figure>`
    ).join(
      ''
    )}</div><p class="help">Each room by day and lit at night: back wall, side walls, floor and ceiling (columns of the sheet), a row a room.</p></div>`;
  if (kind === 'flag') {
    const id = path
        .split('/')
        .pop()
        .replace(/\.png$/, ''),
      maps = Object.keys(studioState.D.maps || {}).filter(m => (studioState.D.maps[m].flag || m) === id),
      towns = ((studioState.D.scenery || {}).flags || []).includes(id);
    return `<div class="sp-scene" data-sp="${P}" data-kind="flag"><h4>On the mast</h4><canvas class="pix sp-flag" width="160" height="120"></canvas>
    <label class="fld range"><span>Wind</span><input type="range" class="sp-lean" min="0" max="1" step="0.05" value="${scenePv.lean}"></label>
    <div class="seg-row"><span class="help">Postcard stamp</span><img class="pix sp-stamp" alt="" src="${escapeHtml(artPicSrc(path.replace(/^art\//, '')))}"></div>
    <p class="help">${id === 'default' ? 'Flown where a place has no flag of its own.' : maps.length ? 'Flown by ' + maps.map(escapeHtml).join(', ') + '.' : towns ? 'A town’s flag (scenery.flags); no map here flies it now.' : 'No map flies it.'} The game waves it on the flag pole prop’s mast.</p></div>`;
  }
  const id = path
      .split('/')
      .pop()
      .replace(/\.png$/, ''),
    maps = Object.keys(studioState.D.maps || {}).filter(m => studioState.D.maps[m].far === id);
  return `<div class="sp-scene" data-sp="${P}" data-kind="far"><h4>Along the horizon</h4><p class="help warn">The game loads this backdrop but doesn’t draw it: <code>far</code> only picks a place’s sound, water and default walls now.</p>
  <canvas class="pix sp-far" width="960" height="200"></canvas><p class="help">Drawn one and a half times across, so the seam shows. ${maps.length ? `Places with far: ${escapeHtml(id)}: ${maps.length}.` : 'No place has it as its far.'}</p></div>`;
}

/* ---------- drawing ---------- */
function spDraw(el) {
  const path = el.dataset.sp,
    kind = el.dataset.kind,
    src = loadedAtlas(path);
  if (!src) {
    atlasGet(path)
      .then(() => spDraw(el))
      .catch(() => {});
    return;
  }
  if (kind === 'walls' || kind === 'build') spDrawWall(el, src, kind);
  else if (kind === 'rooms') el.querySelectorAll('canvas.sp-room').forEach(c => spDrawRoom(c, src));
  else if (kind === 'far') spDrawFar(el.querySelector('canvas.sp-far'), src);
  /* a flag animates (spLoop) */
}
function spDrawWall(el, src, kind) {
  const cols = Math.floor(src.width / SP_CELL),
    n = Math.min(spNames(kind).length, cols * Math.floor(src.height / SP_CELL)),
    i = Math.min(scenePv.cell, n - 1),
    box = [(i % cols) * SP_CELL, Math.floor(i / cols) * SP_CELL, SP_CELL, SP_CELL],
    im = src.getContext('2d').getImageData(0, 0, src.width, src.height),
    px = wallCellColoured(im.data, src.width, box, wallHex(spColour(kind, i))),
    tile = new ImageData(px, SP_CELL, SP_CELL),
    cv = el.querySelector('canvas.sp-wall'),
    x = cv.getContext('2d');
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 3; tx++) x.putImageData(tile, tx * SP_CELL, ty * SP_CELL);
  const off = wallOffLevels(im.data, src.width, box),
    note = el.querySelector('.sp-note');
  if (note)
    note.textContent = `6 × 4 m of ${spNames(kind)[i]} (one cell is 2 m, 32 px a metre), flat light.${off ? ` ${off} pixels sit between the five levels: the game rounds them to the nearest.` : ''}`;
}
/* a room seen through a window: the back wall in the middle, the side walls, floor and ceiling drawn as strips */
function spDrawRoom(c, src) {
  const r = +c.dataset.r,
    x = c.getContext('2d'),
    W = c.width,
    H = c.height,
    S = 32,
    face = f => [f * S, r * S],
    bx0 = W * 0.25,
    bx1 = W * 0.75,
    by0 = H * 0.25,
    by1 = H * 0.75;
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, W, H);
  const [sx, sy] = face(1);
  for (let i = 0; i < bx0; i++) {
    const t = (bx0 - i) / bx0,
      col = Math.min(S - 1, Math.floor((1 - t) * S)),
      y0 = by0 - by0 * t,
      y1 = by1 + (H - by1) * t;
    x.drawImage(src, sx + col, sy, 1, S, i, y0, 1, y1 - y0);
    x.drawImage(src, sx + S - 1 - col, sy, 1, S, W - 1 - i, y0, 1, y1 - y0);
  }
  for (const [f, top] of [
    [2, false],
    [3, true],
  ]) {
    const [fx, fy] = face(f);
    for (let j = 0; j < by0; j++) {
      const t = (by0 - j) / by0,
        row = Math.min(S - 1, Math.floor((1 - t) * S)),
        x0 = bx0 - bx0 * t,
        x1 = bx1 + (W - bx1) * t,
        y = top ? j : H - 1 - j;
      x.drawImage(src, fx, fy + (top ? row : S - 1 - row), S, 1, x0, y, x1 - x0, 1);
    }
  }
  const [bxs, bys] = face(0);
  x.drawImage(src, bxs, bys, S, S, bx0, by0, bx1 - bx0, by1 - by0);
  if (c.dataset.night) {
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = '#ffcf8a';
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
  }
}
function spDrawFar(c, src) {
  const x = c.getContext('2d'),
    g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#8fc3e8');
  g.addColorStop(1, '#e8f1f2');
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingEnabled = false;
  const y = c.height - src.height;
  for (let at = 0; at < c.width; at += src.width) x.drawImage(src, at, y);
  x.strokeStyle = 'rgba(200,40,40,.6)';
  x.setLineDash([4, 4]);
  x.beginPath();
  x.moveTo(src.width + 0.5, 0);
  x.lineTo(src.width + 0.5, c.height);
  x.stroke();
  x.setLineDash([]);
}
/* the flag, column by column, rippled as the game ripples it */
function spDrawFlag(c, src, t) {
  const x = c.getContext('2d'),
    W = c.width,
    H = c.height,
    s = 2,
    mast = 24,
    top = 16,
    fw = src.width * s,
    fh = src.height * s,
    mpp = 1.41 / fw; /* the flag pole's cloth is 1.41 m across */
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#6b6f78';
  x.fillRect(mast - 3, top - 4, 3, H - top + 4);
  x.imageSmoothingEnabled = false;
  for (let i = 0; i < fw; i++) {
    const u = i / fw,
      R = flagRipple(u, t, scenePv.lean),
      dx = -R.back / mpp,
      dy = -R.up / mpp;
    x.globalAlpha = 1;
    x.drawImage(src, Math.floor(i / s), 0, 1, src.height, mast + i + dx, top + dy, 1.4, fh);
    if (R.light !== 1) {
      x.fillStyle =
        R.light > 1 ? `rgba(255,255,255,${Math.min(0.5, R.light - 1)})` : `rgba(0,0,0,${Math.min(0.5, 1 - R.light)})`;
      x.globalCompositeOperation = 'source-atop';
      x.fillRect(mast + i + dx, top + dy, 1.4, fh);
      x.globalCompositeOperation = 'source-over';
    }
  }
}
let spRunning = false;
function spLoop() {
  const flags = [...document.querySelectorAll('.sp-scene[data-kind="flag"]')];
  const all = [...document.querySelectorAll('.sp-scene')];
  if (!all.length) {
    spRunning = false;
    return;
  }
  const t = performance.now();
  for (const el of flags) {
    const src = loadedAtlas(el.dataset.sp),
      c = el.querySelector('canvas.sp-flag');
    if (src && c) spDrawFlag(c, src, t);
  }
  /* a stroke in the painter (or an undo) changes the picture's version: draw the others again */
  for (const el of all) {
    if (el.dataset.kind === 'flag') continue;
    const src = loadedAtlas(el.dataset.sp),
      v = src ? `${src._ver || 0}|${scenePv.cell}|${JSON.stringify(scenePv.col)}` : '';
    if (scenePv.vers.get(el) !== v) {
      scenePv.vers.set(el, v);
      spDraw(el);
    }
  }
  requestAnimationFrame(spLoop);
}
/** starts the previews under root: their controls and the drawing loop */
function mountScenePreviews(root = document) {
  root.querySelectorAll('.sp-scene').forEach(el => {
    if (el._sp) return;
    el._sp = 1;
    const cell = el.querySelector('.sp-cell'),
      col = el.querySelector('.sp-col'),
      lean = el.querySelector('.sp-lean');
    if (cell)
      cell.addEventListener('change', () => {
        scenePv.cell = +cell.value;
        if (col) col.value = spColour(el.dataset.kind, scenePv.cell);
        spDraw(el);
        if (artBrowser.pc) drawPixelCanvas(artBrowser.pc);
      });
    if (col)
      col.addEventListener('input', () => {
        scenePv.col[el.dataset.kind + scenePv.cell] = col.value;
        spDraw(el);
      });
    if (lean) lean.addEventListener('input', () => (scenePv.lean = +lean.value));
    spDraw(el);
  });
  if (!spRunning) {
    spRunning = true;
    requestAnimationFrame(spLoop);
  }
}
/** the painter's outlines for a cell sheet: every cell, the previewed one brighter (pixel-canvas overlay) */
function scenePreviewOverlay(path) {
  const kind = scenePreviewKind(path),
    src = loadedAtlas(path);
  if (!src || (kind !== 'walls' && kind !== 'build' && kind !== 'rooms')) return '';
  const S = kind === 'rooms' ? 32 : SP_CELL,
    cols = Math.floor(src.width / S),
    rows = Math.floor(src.height / S),
    out = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const on = kind !== 'rooms' && j * cols + i === scenePv.cell;
      out.push(
        `<rect x="${i * S}" y="${j * S}" width="${S}" height="${S}" fill="none" stroke="${on ? 'rgba(255,154,31,.95)' : 'rgba(255,255,255,.35)'}" stroke-width="${on ? 0.6 : 0.25}"/>`
      );
    }
  return out.join('');
}
