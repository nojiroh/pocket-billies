'use strict';
/* ================= POCKET BILLIES STUDIO · Art workbench, Part mode: the species sheets (studio track ST-6) =================
   Part mode's Billies source: a species' rig (art/next/rigs-next.js) shown as parts, one per bone with a picture
   (logic/rig-joints.js rigKit). Each view shows the picture's box on the species sheet with a little of the sheet
   around it: the pivot crosshair, the children's joints as labelled sockets, and the box's edges. Dragging the pivot
   keeps the figure where it is drawn (the skeleton builder's pivot drag, rigSetPivot); a socket moves the child
   there; an edge or the box itself changes which pixels of the sheet the picture takes, the pivot staying on its sheet
   pixel (squash and stretch, blink, happy and hurt move with it unless one frame is picked). Draw order per view (the
   back by zb). Beside it the species as the game draws it, front and back. Every change is one step of the Studio's
   undo and is saved with the rigs. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { partForSide, partJoint } from '../../game/js/logic/part-joints.js';
import { kitBlinkFrame, kitSquashFrames } from '../../game/js/logic/kit-pixels.js';
import { coatArt } from '../../game/js/logic/coats.js';
import { makeCanvas } from '../../game/js/art.js';
import { animFor } from '../../game/js/body-plan-animation.js';
import { boneSlot, drawRig, rigFrame, rigFromMeta, rigMatrices } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  rigBox,
  rigGeo,
  rigKit,
  rigSetBox,
  rigSetPivot,
  rigSetSocket,
  rigSetZ,
} from '../../game/js/logic/rig-joints.js';
import {
  rigRepack,
  rigSwapApply,
  rigSwapMisfit,
  rigSwapNeeds,
  rigSwapPair,
  rigSwapSide,
  rigSwapSlot,
  rigSwapSocketsAt,
} from '../../game/js/logic/rig-swap.js';
import {
  ACTIONS,
  changed,
  commit,
  openSection,
  render,
  sectionShown,
  snapshotParts,
  speciesName,
  studioState,
  toast,
} from './studio-app.js';
import { artSteps, drawPixelCanvas, pictureImage, pixelCanvasPointF } from './pixel-canvas.js';
import { atlasGet, atlasPath, loadedAtlas, markArt, openPixelEditor, rigFor } from './sprites.js';
import { neutralPose, openSkeleton } from './skeleton.js';
import { WB_VIEWS, workbench } from './workbench.js';
import { wbPart, wbpColor, wbpN, wbpRefreshSide, wbpRoot } from './workbench-part.js';
import { kitFormOf, kitRecipeHTML } from './kit-recipe.js';
import { placeholderPanelHTML } from './placeholder-sheets.js';
/* eslint-disable no-func-assign */
expose({
  WBS_CROPS: [() => WBS_CROPS],
  WBS_MARGIN: [() => WBS_MARGIN],
  wbsBone: [() => wbsBone],
  wbsCrop: [() => wbsCrop, v => (wbsCrop = v)],
  wbsDone: [() => wbsDone, v => (wbsDone = v)],
  wbsDrawFit: [() => wbsDrawFit, v => ((wbsDrawFit = v), provide({ wbsDrawFit }))],
  wbsEdge: [() => wbsEdge],
  wbsFitHTML: [() => wbsFitHTML, v => ((wbsFitHTML = v), provide({ wbsFitHTML }))],
  wbsHandles: [() => wbsHandles, v => (wbsHandles = v)],
  wbsHost: [() => wbsHost, v => ((wbsHost = v), provide({ wbsHost }))],
  wbsInput: [() => wbsInput, v => (wbsInput = v)],
  wbsKit: [() => wbsKit],
  wbsLibrary: [() => wbsLibrary],
  wbsLin: [() => wbsLin, v => (wbsLin = v)],
  wbsList: [() => wbsList, v => ((wbsList = v), provide({ wbsList }))],
  wbsLoad: [() => wbsLoad, v => ((wbsLoad = v), provide({ wbsLoad }))],
  wbsMeta: [() => wbsMeta],
  wbsMove: [() => wbsMove, v => (wbsMove = v)],
  wbsNudge: [() => wbsNudge, v => ((wbsNudge = v), provide({ wbsNudge }))],
  wbsOverlay: [() => wbsOverlay, v => ((wbsOverlay = v), provide({ wbsOverlay }))],
  wbsPicture: [() => wbsPicture, v => ((wbsPicture = v), provide({ wbsPicture }))],
  wbsPlay: [() => wbsPlay, v => ((wbsPlay = v), provide({ wbsPlay }))],
  wbsRig: [() => wbsRig],
  wbsSideHTML: [() => wbsSideHTML, v => ((wbsSideHTML = v), provide({ wbsSideHTML }))],
  wbsSp: [() => wbsSp],
  wbsThumb: [() => wbsThumb, v => ((wbsThumb = v), provide({ wbsThumb }))],
  wbsZoomFit: [() => wbsZoomFit],
});
/* eslint-enable no-func-assign */
provide({
  wbsDrawFit,
  wbsFitHTML,
  wbsHost,
  wbsList,
  wbsLoad,
  wbsNudge,
  wbsOverlay,
  wbsPicture,
  wbsPlay,
  wbsSideHTML,
  wbsThumb,
});
/* to-module: end */
/** the sheet shown around a picture's box, in pixels */
const WBS_MARGIN = 6;
/** the species shown: the one picked, else the first with a rig */
const wbsSp = () =>
  studioState.rigs[wbPart.sp] ? wbPart.sp : (wbPart.sp = Object.keys(studioState.rigs || {})[0] || '');
provide({ wbsSp }); /* to-module */
const wbsRig = () => studioState.rigs[wbsSp()] || null;
const wbsMeta = view => wbsRig()?.[view] || null;
const wbsKit = () => rigKit(wbsRig() || {});
provide({ wbsKit }); /* to-module */
const wbsBone = (view, n = wbPart.id) => wbsMeta(view)?.bones.find(b => b.n === n) || null;
/** the parts the list shows: the species' bones with a picture, by role and a search */
function wbsList() {
  const q = wbPart.q.toLowerCase();
  return Object.entries(wbsKit().parts)
    .filter(([id, P]) => (!wbPart.kind || P.kind === wbPart.kind) && (!q || id.toLowerCase().includes(q)))
    .map(([id]) => id);
}
/** both views' sheets, loaded */
async function wbsLoad() {
  const sp = wbsSp();
  if (!sp) return;
  await Promise.all(WB_VIEWS.map(v => atlasGet(atlasPath(sp, v)).catch(() => null)));
}
/* ---------- the picture: its box on the sheet, with the sheet around it ---------- */
/** what a view shows of the sheet: the crop (x0, y0, w, h) and the picture's box in it (the frame picked, else the
 * shown one); null when the part has no picture in that view. While an edge is dragged the crop stays put. */
function wbsCrop(view, id = wbPart.id) {
  const M = wbsMeta(view),
    b = wbsBone(view, id),
    P = b && b.i >= 0 && M.imgs[b.i];
  if (!P) return null;
  const box = rigBox(P, wbPart.frame),
    [SW, SH] = M.size || [Infinity, Infinity],
    hold = wbPart.cropHold?.[view];
  if (hold) return { ...hold, box, P, M, b };
  const x0 = Math.max(0, box[0] - WBS_MARGIN),
    y0 = Math.max(0, box[1] - WBS_MARGIN),
    x1 = Math.min(SW, box[0] + box[2] + WBS_MARGIN),
    y1 = Math.min(SH, box[1] + box[3] + WBS_MARGIN);
  return { x0, y0, w: x1 - x0, h: y1 - y0, box, P, M, b };
}
const WBS_CROPS = new Map();
/** the crop as a canvas (made again when the sheet or the box changes) */
function wbsPicture(view) {
  const C = wbsCrop(view),
    sheet = C && loadedAtlas(atlasPath(wbsSp(), view));
  if (!sheet) return null;
  const key = `${wbsSp()}:${view}:${C.x0},${C.y0},${C.w},${C.h}:${sheet._ver || 0}:${studioState.artDirty.has(atlasPath(wbsSp(), view))}`,
    hit = WBS_CROPS.get(view);
  if (hit && hit.key === key && hit.sheet === sheet) return hit.c;
  const c = makeCanvas(Math.max(1, C.w), Math.max(1, C.h)),
    x = c.getContext('2d');
  x.drawImage(sheet, C.x0, C.y0, C.w, C.h, 0, 0, C.w, C.h);
  WBS_CROPS.set(view, { key, sheet, c });
  return c;
}
/** a thumbnail of a part in a view (its shown frame), as a data URL */
function wbsThumb(id, view) {
  const M = wbsMeta(view),
    b = wbsBone(view, id),
    sheet = loadedAtlas(atlasPath(wbsSp(), view));
  if (!M || !b || b.i < 0 || !sheet) return '';
  const [x, y, w, h] = rigBox(M.imgs[b.i]),
    c = makeCanvas(Math.max(1, w), Math.max(1, h));
  c.getContext('2d').drawImage(sheet, x, y, w, h, 0, 0, w, h);
  try {
    return c.toDataURL();
  } catch (e) {
    return '';
  }
}
/** a zoom that fits the crop in the stage */
const wbsZoomFit = P => {
  const c = P.o.get(),
    st = P.stage.getBoundingClientRect();
  return c
    ? Math.max(2, Math.min(24, Math.floor(Math.min((st.width - 40) / c.width, (st.height - 40) / c.height))))
    : 4;
};
provide({ wbsZoomFit }); /* to-module */
/* ---------- handles ---------- */
/** the view's handles in the crop's pixels: the pivot, the children's joints, the box's edges (mid points) */
function wbsHandles(view) {
  const C = wbsCrop(view);
  if (!C) return [];
  const [bx, by, bw, bh] = C.box,
    ox = bx - C.x0,
    oy = by - C.y0,
    px = ox - C.P.ox,
    py = oy - C.P.oy,
    H = [['pivot', px, py]];
  for (const c of C.M.bones) if (c.par === C.b.n) H.push([c.n, px + c.at[0] * C.M.k, py + c.at[1] * C.M.k]);
  H.push(
    ['edgeL', ox, oy + bh / 2],
    ['edgeR', ox + bw, oy + bh / 2],
    ['edgeT', ox + bw / 2, oy],
    ['edgeB', ox + bw / 2, oy + bh]
  );
  return H;
}
const wbsEdge = h => /^edge[LRTB]$/.test(h);
function wbsOverlay(view, P) {
  const C = wbsCrop(view);
  if (!C) return '';
  const u = 1 / (P.zoom || 1),
    sel = wbPart.sel && wbPart.sel.view === view ? wbPart.sel.h : null,
    [bx, by, bw, bh] = C.box;
  let g = `<rect class="wbs-box ${sel === 'box' ? 'on' : ''}" x="${bx - C.x0}" y="${by - C.y0}" width="${bw}" height="${bh}" fill="none" stroke="#1f6e6f" stroke-width="${(sel === 'box' ? 2 : 1) * u}" stroke-dasharray="${4 * u} ${3 * u}"/>`;
  for (const [h, x, y] of wbsHandles(view)) {
    if (h === 'pivot') {
      const r = 7 * u,
        l = 12 * u;
      g += `<g class="wbp-pivot ${sel === 'pivot' ? 'on' : ''}"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x - l} ${y}H${x + l}M${x} ${y - l}V${y + l}"/></g>`;
    } else if (wbsEdge(h)) {
      const s = (sel === h ? 5 : 3.5) * u;
      g += `<rect class="wbs-edge ${sel === h ? 'on' : ''}" x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" fill="${sel === h ? '#c8323c' : '#1f6e6f'}"/>`;
    } else {
      const c = wbpColor(h);
      g += `<circle class="wbp-sock-dot ${sel === h ? 'on' : ''}" cx="${x}" cy="${y}" r="${(sel === h ? 6 : 4.5) * u}" fill="${c}"/><text class="wbp-label" x="${x + 7 * u}" y="${y - 6 * u}" font-size="${11 * u}" stroke-width="${3 * u}" fill="${c}">${escapeHtml(h)}</text>`;
    }
  }
  return g;
}
/** the bone's turn and stretch in its parent in the neutral pose (as the skeleton builder moves a pivot) */
function wbsLin(view, n) {
  const R = rigFor(wbsSp(), view);
  if (!R) return undefined;
  const { W } = rigMatrices(R, neutralPose(), view),
    b = wbsBone(view, n),
    pm = W[b.par || 'root'] || W.root,
    m = W[n];
  if (!m) return undefined;
  const d = pm[0] * pm[3] - pm[1] * pm[2],
    I = [pm[3] / d, -pm[1] / d, -pm[2] / d, pm[0] / d],
    f = (x, y) => [I[0] * x + I[2] * y, I[1] * x + I[3] * y];
  return [...f(m[0], m[1]), ...f(m[2], m[3])];
}
/** moves handle h of a view to (x, y) in the crop's pixels; true when the rig changed (no undo step: the caller) */
function wbsMove(view, h, x, y) {
  const C = wbsCrop(view);
  if (!C) return false;
  const [bx, by, bw, bh] = C.box,
    hx = x - (bx - C.x0),
    hy = y - (by - C.y0);
  if (h === 'pivot') {
    const dx = hx + C.P.ox,
      dy = hy + C.P.oy;
    if (!dx && !dy) return false;
    return rigSetPivot(C.M, C.b.n, dx, dy, wbsLin(view, C.b.n));
  }
  if (h === 'box') {
    const d = wbPart.drag;
    if (!d) return false;
    const nx = d.box[0] + Math.round(x - d.at[0]),
      ny = d.box[1] + Math.round(y - d.at[1]);
    return rigSetBox(C.M, C.b.i, [nx, ny, bw, bh], wbPart.frame || undefined);
  }
  if (wbsEdge(h)) {
    const sx = Math.max(C.x0, Math.min(C.x0 + C.w, Math.round(x + C.x0))),
      sy = Math.max(C.y0, Math.min(C.y0 + C.h, Math.round(y + C.y0)));
    let [nx, ny, nw, nh] = C.box;
    if (h === 'edgeL') {
      nx = Math.min(sx, bx + bw - 1);
      nw = bx + bw - nx;
    } else if (h === 'edgeR') nw = Math.max(1, sx - bx);
    else if (h === 'edgeT') {
      ny = Math.min(sy, by + bh - 1);
      nh = by + bh - ny;
    } else nh = Math.max(1, sy - by);
    return rigSetBox(C.M, C.b.i, [nx, ny, nw, nh], wbPart.frame || undefined);
  }
  return rigSetSocket(C.M, h, hx, hy);
}
/** after a change to the rig: one undo step, saved with the rigs, every drawing of the species made again */
function wbsDone() {
  changed(true);
  commit(true);
}
/* a click on a view: pick the nearest handle (within 10 screen pixels), else the box when inside it, and follow the
   drag (the pivot and sockets by half pixels, edges and the box by whole ones) */
function wbsHost(view, P, t, ev) {
  if (t !== 'part') return false;
  const [fx, fy] = pixelCanvasPointF(P, ev),
    near = 10 / (P.zoom || 1),
    C = wbsCrop(view);
  if (!C) return true;
  let best = null,
    bd = near;
  for (const [h, x, y] of wbsHandles(view)) {
    const d = Math.hypot(x - fx, y - fy);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  const [bx, by, bw, bh] = C.box;
  if (!best && fx >= bx - C.x0 && fy >= by - C.y0 && fx < bx - C.x0 + bw && fy < by - C.y0 + bh) best = 'box';
  wbPart.sel = best ? { view, h: best } : null;
  for (const Q of Object.values(wbPart.pcs)) if (Q.cv.isConnected) drawPixelCanvas(Q);
  wbpRefreshSide();
  if (!best) return true;
  /* the crop stays put while the box changes under the pointer */
  wbPart.cropHold = { [view]: { x0: C.x0, y0: C.y0, w: C.w, h: C.h } };
  wbPart.drag = { box: [...C.box], at: [fx, fy] };
  let moved = false;
  return {
    move: (P2, x, y) => {
      const q = best === 'pivot' || !wbsEdge(best) ? 2 : 1;
      if (!wbsMove(view, best, Math.round(x * q) / q, Math.round(y * q) / q)) return;
      moved = true;
      studioState.rigVer = (studioState.rigVer || 0) + 1;
      drawPixelCanvas(P2);
      wbsDrawFit();
    },
    up: () => {
      wbPart.cropHold = null;
      wbPart.drag = null;
      if (moved) wbsDone();
      for (const Q of Object.values(wbPart.pcs)) if (Q.cv.isConnected) drawPixelCanvas(Q);
      wbsDrawFit();
      wbpRefreshSide();
    },
  };
}
/** the arrow keys move the picked handle a pixel (Shift: half a pixel for the pivot and sockets) */
function wbsNudge(ev) {
  const { view, h } = wbPart.sel,
    H = wbsHandles(view),
    C = wbsCrop(view);
  if (!C) return;
  const step = ev.shiftKey && (h === 'pivot' || !(wbsEdge(h) || h === 'box')) ? 0.5 : 1,
    dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0,
    dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0;
  let ok;
  if (h === 'box') {
    const [x, y, w, hh] = C.box;
    ok = rigSetBox(C.M, C.b.i, [x + dx, y + dy, w, hh], wbPart.frame || undefined);
  } else {
    const p = H.find(([n]) => n === h);
    if (!p) return;
    ok = wbsMove(view, h, p[1] + dx, p[2] + dy);
  }
  ev.preventDefault();
  if (!ok) return;
  wbsDone();
  render();
}
/* ---------- the inspector ---------- */
function wbsSideHTML() {
  const id = wbPart.id,
    K = wbsKit(),
    Pt = K.parts[id],
    sp = wbsSp();
  if (!Pt)
    return (
      '<div class="px-sec"><p class="help">Pick a part on the left.</p></div>' +
      kitRecipeHTML(sp) +
      placeholderPanelHTML(sp)
    );
  const fb = wbsBone('front') || wbsBone('back'),
    frames = [...new Set(WB_VIEWS.flatMap(v => Pt.rig[v]?.frames || []))];
  const head = `<div class="px-sec"><h4 class="mono">${escapeHtml(id)}</h4><p class="help">${escapeHtml(speciesName(sp))} (<span class="mono">${escapeHtml(sp)}</span>) · hangs from <b class="mono">${escapeHtml(fb.par || 'root')}</b>${fb.a && fb.a !== id ? ` · moves as ${escapeHtml(fb.a)}` : ''}. rigs-next.js; the back view is drawn mirrored in the game.</p><div class="seg-row"><button class="btn sm" data-act="wbsSkeleton">Skeleton builder</button><button class="btn sm" data-act="wbsPaint">Paint pixels</button><button class="btn sm" data-act="wbsRepack" title="Pack the sheet again without the pixels no frame shows (the Billie is drawn the same)">Repack sheet</button></div></div>`;
  const frame =
    frames.length > 1
      ? `<div class="px-sec"><h4>Frame</h4><div class="seg-row">${['', ...frames].map(f => `<button class="seg sm ${f === wbPart.frame ? 'on' : ''}" data-act="wbsFrame" data-f="${escapeHtml(f)}">${f ? escapeHtml(f) : 'all frames'}</button>`).join('')}</div><p class="help">All frames: a box change moves every frame’s edges by as much. One frame: only its box changes.</p></div>`
      : '';
  const views = WB_VIEWS.map(v => {
    const C = wbsCrop(v);
    if (!C)
      return `<div class="px-sec"><h4>${v === 'front' ? 'Front' : 'Back'}</h4><p class="help">No picture in this view.</p></div>`;
    const on = h => (wbPart.sel && wbPart.sel.view === v && wbPart.sel.h === h ? 'on' : ''),
      kids = C.M.bones.filter(c => c.par === id),
      has = !wbPart.frame || wbPart.frame in C.P.f,
      [x, y, w, h] = C.box;
    return `<div class="px-sec"><h4>${v === 'front' ? 'Front' : 'Back'} <small>${w} × ${h}</small></h4><div class="wbp-row ${on('pivot')}"><span class="wbp-name">pivot</span><input type="number" step="0.5" data-wbs="pivot" data-v="${v}" data-i="0" value="${wbpN(-C.P.ox)}"><input type="number" step="0.5" data-wbs="pivot" data-v="${v}" data-i="1" value="${wbpN(-C.P.oy)}"></div><div class="wbp-row wbs-boxrow ${on('box')}"><span class="wbp-name">box</span>${[x, y, w, h].map((n, i) => `<input type="number" step="1" data-wbs="box" data-v="${v}" data-i="${i}" value="${n}" title="${['x', 'y', 'width', 'height'][i]} on the sheet" ${has ? '' : 'disabled'}>`).join('')}</div>${has ? '' : `<p class="help">No ${escapeHtml(wbPart.frame)} frame in this view: its box is the ${escapeHtml(Object.keys(C.P.f).join(', '))} one, not changed here.</p>`}${kids
      .map(
        c =>
          `<div class="wbp-row ${on(c.n)}"><i class="wbp-dot" style="background:${wbpColor(c.n)}"></i><span class="wbp-name mono">${escapeHtml(c.n)}</span><small class="mono">${wbpN(-C.P.ox + c.at[0] * C.M.k)}, ${wbpN(-C.P.oy + c.at[1] * C.M.k)}</small></div>`
      )
      .join(
        ''
      )}<div class="wbp-row"><span class="wbp-name">z</span><input type="number" step="1" data-wbs="z" data-v="${v}" value="${Pt.z[v]}"><small class="help">${v === 'back' ? 'zb' : 'z'}</small></div></div>`;
  }).join('');
  return (
    head +
    kitRecipeHTML(sp) +
    placeholderPanelHTML(sp) +
    wbsLibrary.html() +
    frame +
    views +
    `<div class="px-sec"><p class="help">Pixels from the picture’s top left. Moving the pivot keeps the figure where it is (its picture and what hangs on it stay); a socket is where a child hangs (dragging it moves the child). The box’s edges, or the box itself, change which pixels of the sheet it takes; the pivot stays on its sheet pixel. Higher z is drawn in front.</p></div>`
  );
}
/* ---------- the species as the game draws it ---------- */
function wbsFitHTML() {
  if (!wbPart.id) return '';
  return `<div class="wbp-fit"><div class="seg-row"><b>As drawn</b><label class="chk"><input type="checkbox" data-wbs="play" ${wbPart.play ? 'checked' : ''}> Move</label><small class="help">the body plan’s idle; the pivot of the part picked is marked</small></div><div class="wbp-fitviews">${WB_VIEWS.map(v => `<figure><canvas id="wbsFit${v}"></canvas><figcaption>${v}</figcaption></figure>`).join('')}</div></div>`;
}
function wbsDrawFit(ts) {
  for (const v of WB_VIEWS) {
    const cv = wbpRoot().querySelector('#wbsFit' + v),
      baseRig = cv && rigFor(wbsSp(), v),
      R = baseRig && wbsLibrary.preview(baseRig, v);
    if (!R) continue;
    const Z = Math.max(1, Math.min(4, Math.floor(260 / Math.max(R.BW, R.BH)))),
      s = wbsLibrary.active(),
      act = s?.action === 'idle' ? null : s?.action,
      clock = ts || performance.now(),
      P = wbPart.play ? rigFrame(R, act || null, act === 'walk' ? clock : clock % 1200, clock, 1) : neutralPose();
    if (cv.width !== R.BW * Z || cv.height !== R.BH * Z) {
      cv.width = R.BW * Z;
      cv.height = R.BH * Z;
    }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, cv.width, cv.height);
    x.imageSmoothingEnabled = false;
    x.setTransform(Z, 0, 0, Z, 0, 0);
    const { W, list } = rigMatrices(R, P, v);
    /* drawRig places pictures on whole pixels; scaled here so the zoom stays crisp */
    const c = makeCanvas(R.BW, R.BH);
    drawRig(c.getContext('2d'), R, P, v);
    x.drawImage(c, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const m = W[wbPart.id];
    if (m) {
      x.strokeStyle = '#c8323c';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(m[4] * Z - 6, m[5] * Z);
      x.lineTo(m[4] * Z + 6, m[5] * Z);
      x.moveTo(m[4] * Z, m[5] * Z - 6);
      x.lineTo(m[4] * Z, m[5] * Z + 6);
      x.stroke();
    }
    cv.dataset.parts = String(list.length);
  }
}
function wbsPlay(ts) {
  if (!wbPart.play || wbPart.src !== 'species') return;
  if (!sectionShown('workbench') || workbench.mode !== 'part' || !wbpRoot().querySelector('#wbsFitfront')) {
    wbPart.play = false;
    return;
  }
  wbsDrawFit(ts);
  requestAnimationFrame(wbsPlay);
}
/* ---------- actions and inputs ---------- */
ACTIONS.wbsSp = d => {
  wbPart.sp = d.sp;
  wbPart.id = '';
  wbPart.sel = null;
  wbPart.frame = '';
  wbPart.zoom = { front: 0, back: 0 };
  render();
};
ACTIONS.wbsFrame = d => {
  wbPart.frame = d.f || '';
  wbPart.sel = null;
  wbPart.zoom = { front: 0, back: 0 };
  render();
};
ACTIONS.wbsSkeleton = () => openSkeleton(wbsSp(), 'front');
/* Studio plan Phase 5 (T5.4): the species' sheet packed again without the pixels no frame shows (logic/rig-swap.js
   rigRepack), the boxes copied canvas to canvas so the Billie is drawn pixel for pixel the same; one undo step */
ACTIONS.wbsRepack = async () => {
  const sp = wbsSp(),
    R = studioState.rigs[sp];
  if (!R) return;
  if (kitFormOf(sp))
    return toast('A kit Billie’s sheet is baked from its recipe (Kit recipe): Write Billie packs it.', 'err');
  const own = Object.entries(studioState.D.coats || {}).find(([, C]) => WB_VIEWS.some(v => coatArt(C, sp, v)));
  if (own) return toast(`The ${own[0]} coat has its own sheet laid out like this one, so it can’t be repacked.`, 'err');
  let rig = R,
    before = 0,
    after = 0;
  const steps = [],
    made = [];
  for (const sheet of new Set(WB_VIEWS.map(v => R[v]?.sheet).filter(Boolean))) {
    const path = 'art/' + sheet,
      old = await atlasGet(path),
      pack = rigRepack(rig, sheet, old.width);
    if (pack.size[0] * pack.size[1] >= old.width * old.height) continue;
    const c = makeCanvas(pack.size[0], pack.size[1]),
      x = c.getContext('2d');
    for (const [bx, by, w, h, nx, ny] of pack.moves) x.drawImage(old, bx, by, w, h, nx, ny, w, h);
    before += old.width * old.height;
    after += pack.size[0] * pack.size[1];
    rig = pack.rig;
    steps.push([path, pictureImage(old), pictureImage(c)]);
    made.push([path, c]);
  }
  if (!made.length) return toast('Already packed: no pixels to drop.');
  if (studioState.rigs[sp] !== R) return toast('The rig changed meanwhile. Repack again.', 'err');
  commit(true);
  for (const [path, c] of made) markArt(path, c);
  studioState.rigs = { ...studioState.rigs, [sp]: rig };
  window.RIGS = studioState.rigs;
  changed(true);
  artSteps(steps, snapshotParts());
  render();
  toast(`Sheet repacked: ${before} → ${after} pixels, drawn the same. Undo puts it back.`);
};
ACTIONS.wbsPaint = () => openPixelEditor(wbsSp(), wbPart.sel?.view || 'front');
/* opens Part mode on a species (the Billies section's button) */
ACTIONS.wbsOpen = d => {
  Object.assign(wbPart, { src: 'species', sp: d.sp, id: '', kit: '', kind: '', q: '', size: 'M', sel: null });
  Object.assign(wbPart, { tool: 'part', frame: '', zoom: { front: 0, back: 0 } });
  workbench.mode = 'part';
  if (studioState.sec2 === 'billionaires') ACTIONS.openBeside({ s: 'workbench' });
  else openSection('workbench');
};
function wbsInput(ev) {
  const el = ev.target;
  if (el.dataset?.wbsLib !== undefined) return wbsLibrary.input(ev);
  if (!el.dataset || el.dataset.wbs === undefined || !el.closest('.wbp') || wbPart.src !== 'species') return;
  const k = el.dataset.wbs;
  if (k === 'sp') {
    if (ev.type === 'change') ACTIONS.wbsSp({ sp: el.value });
    return;
  }
  if (k === 'play') {
    wbPart.play = el.checked;
    if (el.checked) requestAnimationFrame(wbsPlay);
    else wbsDrawFit();
    return;
  }
  if (ev.type !== 'change') return;
  const v = el.dataset.v,
    num = Number(el.value),
    C = wbsCrop(v);
  if (!C || !Number.isFinite(num)) return;
  let ok = false;
  if (k === 'pivot') {
    const p = [-C.P.ox, -C.P.oy];
    p[+el.dataset.i] = Math.round(num * 2) / 2;
    ok = rigSetPivot(C.M, C.b.n, p[0] + C.P.ox, p[1] + C.P.oy, wbsLin(v, C.b.n));
  } else if (k === 'box') {
    const b = [...C.box];
    b[+el.dataset.i] = Math.round(num);
    ok = rigSetBox(C.M, C.b.i, /** @type {any} */ (b), wbPart.frame || undefined);
  } else if (k === 'z') ok = rigSetZ(C.M, C.b.n, v, Math.max(-50, Math.min(50, Math.round(num))));
  if (!ok) return toast('Nothing changed.');
  wbsDone();
  render();
}
document.addEventListener('input', wbsInput);
document.addEventListener('change', wbsInput);

/* A staged replacement never mutates the species until Apply. The packed sheet and its
   skeleton are committed together, so one Undo restores both. */
const wbsLibrary = {
  state: null,
  slot(b) {
    return rigSwapSlot(b, boneSlot);
  },
  pair(M, name) {
    return rigSwapPair(M, name);
  },
  active() {
    const s = this.state;
    return s &&
      s.sp === wbsSp() &&
      s.bone === wbPart.id &&
      s.version === studioState.rigVer &&
      s.rig === studioState.rigs[s.sp]
      ? s
      : null;
  },
  async open() {
    await wbsLoad();
    const b = wbsBone('front') || wbsBone('back');
    if (!b) return;
    this.state = {
      sp: wbsSp(),
      bone: wbPart.id,
      version: studioState.rigVer,
      rig: wbsRig(),
      slot: this.slot(b),
      kit: '',
      kind: '',
      selected: '',
      both: false,
      scale: 100,
      angle: 0,
      x: 0,
      y: 0,
      recolor: false,
      keep: false,
      action: 'idle',
      prepared: [],
      warnings: [],
      busy: false,
      serial: 0,
    };
    render();
  },
  entries() {
    const s = this.active(),
      K = studioState.D.partKits;
    if (!s || !K) return [];
    return Object.entries(K.parts || {}).filter(
      ([, p]) =>
        !p.hidden && (!s.slot || p.slot === s.slot) && (!s.kit || p.kit === s.kit) && (!s.kind || p.kind === s.kind)
    );
  },
  html() {
    const s = this.active();
    if (!s) return '<button class="btn sm" data-act="wbsLibraryOpen">Replace from Parts Library</button>';
    const K = studioState.D.partKits || { parts: {} },
      esc = escapeHtml,
      opts = (values, current) =>
        values
          .map(
            v =>
              '<option value="' +
              esc(v) +
              '"' +
              (v === current ? ' selected' : '') +
              '>' +
              esc(v || 'All') +
              '</option>'
          )
          .join(''),
      field = (label, key, values) =>
        '<label class="fld"><span>' +
        label +
        '</span><select data-wbs-lib="' +
        key +
        '">' +
        opts(values, s[key]) +
        '</select></label>',
      pair = this.pair(wbsMeta('front'), s.bone) || this.pair(wbsMeta('back'), s.bone),
      rows = this.entries();
    return (
      '<div class="px-sec"><h4>Parts Library</h4>' +
      field('Body group', 'slot', ['', ...new Set(Object.values(K.parts).map(p => p.slot))]) +
      field('Kit', 'kit', ['', ...new Set(Object.values(K.parts).map(p => p.kit))]) +
      field('Part type', 'kind', [
        '',
        ...new Set(
          Object.values(K.parts)
            .filter(p => !s.slot || p.slot === s.slot)
            .map(p => p.kind)
        ),
      ]) +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:240px;overflow:auto">' +
      rows
        .map(([id, p]) => {
          const v = p.views.front || p.views.back,
            thumb = v && loadedAtlas('art/' + v.file),
            why = this.misfit(s, id);
          return (
            '<button class="btn sm ' +
            (s.selected === id ? 'on' : '') +
            '" data-act="wbsLibraryPick" data-id="' +
            esc(id) +
            '" aria-pressed="' +
            (s.selected === id) +
            '"' +
            (why ? ' disabled data-misfit="1" title="' + esc(why) + '" style="opacity:.45"' : '') +
            '>' +
            (v
              ? '<img alt="" src="' +
                (thumb ? thumb.toDataURL() : '../game/art/' + esc(v.file)) +
                '" style="width:56px;height:56px;object-fit:contain;image-rendering:pixelated">'
              : '') +
            '<br>' +
            esc(id) +
            (!p.views.back ? '<br><small>No back image</small>' : '') +
            (why ? '<br><small>' + esc(why) + '</small>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      (!rows.length ? '<p>No matching parts.</p>' : '') +
      (pair
        ? '<label class="chk"><input type="checkbox" data-wbs-lib="both"' +
          (s.both ? ' checked' : '') +
          '> Replace both sides (' +
          esc(pair.n) +
          ' too)</label>'
        : '') +
      '<label class="chk"><input type="checkbox" data-wbs-lib="recolor"' +
      (s.recolor ? ' checked' : '') +
      '> Match current part’s palette</label>' +
      '<label class="chk"><input type="checkbox" data-wbs-lib="keep"' +
      (s.keep ? ' checked' : '') +
      '> Keep the old blink, happy and hurt frames (else the blink is made again)</label>' +
      [
        ['Scale %', 'scale', 25, 200],
        ['Rotation °', 'angle', -180, 180],
        ['Offset X', 'x', -64, 64],
        ['Offset Y', 'y', -64, 64],
      ]
        .map(
          ([label, key, min, max]) =>
            '<label class="fld"><span>' +
            label +
            '</span><input type="number" data-wbs-lib="' +
            key +
            '" value="' +
            s[key] +
            '" min="' +
            min +
            '" max="' +
            max +
            '" step="1"></label>'
        )
        .join('') +
      field('Preview motion', 'action', ['idle', 'walk', 'attack', 'hurt']) +
      '<div class="wbs-swap">' +
      WB_VIEWS.map(view =>
        s.strip?.[view]
          ? '<figure><figcaption>' +
            view +
            ': before (top) and after, idle · blink · happy · hurt</figcaption><img alt="' +
            view +
            ' before and after" data-wbs-swap="' +
            view +
            '" src="' +
            s.strip[view] +
            '" style="width:100%;image-rendering:pixelated"></figure>'
          : ''
      ).join('') +
      '</div>' +
      '<p class="help">The preview below shows the Billie with the new part, both views. Scale starts fitted to the current piece. What hangs on a named socket (a torso’s neck, shoulders, hips, tail) moves to the new part’s socket; anything else keeps its place in proportion. Parts without a socket a child needs are greyed out. The size the Billie stands in the world moves by what the part changed. The separate portrait is unchanged.</p>' +
      s.warnings.map(w => '<p class="help">' + esc(w) + '</p>').join('') +
      '<div class="seg-row"><button class="btn" data-act="wbsLibraryApply"' +
      (s.busy || !s.prepared.length ? ' disabled' : '') +
      '>' +
      (s.busy ? 'Loading…' : 'Apply replacement') +
      '</button><button class="btn sm" data-act="wbsLibraryCancel">Cancel</button></div></div>'
    );
  },
  paint(source, old, j, flip, s) {
    const factor = (Math.min(old.width / source.width, old.height / source.height) * s.scale) / 100,
      w = Math.max(1, Math.round(source.width * factor)),
      h = Math.max(1, Math.round(source.height * factor)),
      px = (flip ? 1 - j.pivot[0] : j.pivot[0]) * w,
      py = j.pivot[1] * h,
      r = (s.angle * Math.PI) / 180,
      cs = Math.cos(r),
      sn = Math.sin(r),
      corners = [
        [-px, -py],
        [w - px, -py],
        [-px, h - py],
        [w - px, h - py],
      ].map(([x, y]) => [cs * x - sn * y, sn * x + cs * y]),
      left = Math.floor(Math.min(...corners.map(p => p[0]))),
      top = Math.floor(Math.min(...corners.map(p => p[1]))),
      right = Math.ceil(Math.max(...corners.map(p => p[0]))),
      bottom = Math.ceil(Math.max(...corners.map(p => p[1]))),
      c = makeCanvas(Math.max(1, right - left), Math.max(1, bottom - top)),
      x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.translate(-left, -top);
    x.rotate(r);
    x.translate(-px, -py);
    if (flip) {
      x.translate(w, 0);
      x.scale(-1, 1);
    }
    x.drawImage(source, 0, 0, w, h);
    if (s.recolor) {
      const oldPixels = pictureImage(old),
        im = pictureImage(c),
        counts = new Map();
      for (let i = 0; i < oldPixels.data.length; i += 4) {
        const d = oldPixels.data;
        if (!d[i + 3]) continue;
        const key = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const palette = [...counts]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 24)
          .map(([key]) => key.split(',').map(Number)),
        lum = a => a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      if (palette.length) {
        for (let i = 0; i < im.data.length; i += 4) {
          if (!im.data[i + 3]) continue;
          const l = lum(im.data.slice(i, i + 3)),
            color = palette.reduce((best, p) => (Math.abs(lum(p) - l) < Math.abs(lum(best) - l) ? p : best));
          im.data.set(color, i);
        }
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.putImageData(im, 0, 0);
      }
    }
    return { c, ox: left + s.x, oy: top + s.y, w, h };
  },
  /** what the bone's children need from a new part, per view (logic/rig-swap.js) */
  needs(s, view) {
    const M = wbsMeta(view),
      b = M?.bones.find(x => x.n === s.bone);
    if (!b) return [];
    return rigSwapNeeds(studioState.D.partKits, M, s.bone, x => rigSwapSlot(x, boneSlot), this.slot(b), view);
  },
  /** why a library part can't replace the bone (in either view), else '' */
  misfit(s, id) {
    const K = studioState.D.partKits;
    return WB_VIEWS.filter(v => wbsMeta(v)?.bones.some(b => b.n === s.bone && b.i >= 0))
      .map(v => {
        const why = rigSwapMisfit(K, id, v, this.needs(s, v));
        return why && !(why.startsWith('no ') && why.endsWith(' picture')) ? `${v}: ${why}` : '';
      })
      .filter(Boolean)
      .join('; ');
  },
  async prepare() {
    const s = this.active();
    if (!s || !s.selected) return;
    const serial = ++s.serial,
      D = studioState.D,
      K = D.partKits,
      bake = D.kitBuilds?.bake;
    s.busy = true;
    s.prepared = [];
    s.after = null;
    s.warnings = [];
    render();
    const prepared = [],
      warnings = [],
      misfit = this.misfit(s, s.selected);
    try {
      if (misfit) throw new Error(misfit);
      for (const view of WB_VIEWS) {
        const M = wbsMeta(view),
          bone = M?.bones.find(b => b.n === s.bone);
        if (!bone || bone.i < 0) continue;
        const pair = s.both && this.pair(M, bone.n),
          bones = pair ? [bone, pair] : [bone],
          path = atlasPath(s.sp, view),
          sheet = await atlasGet(path),
          needs = this.needs(s, view);
        for (const b of bones) {
          const side = this.pair(M, b.n) ? rigSwapSide(b.n) : '',
            use = partForSide(K, s.selected, side),
            j = partJoint(K, use.id, view);
          if (!j) {
            warnings.push('No ' + view + ' image for ' + use.id + ': existing ' + b.n + ' is kept.');
            continue;
          }
          const source = await atlasGet('art/' + j.file),
            [bx, by, bw, bh] = rigBox(M.imgs[b.i]),
            old = makeCanvas(bw, bh),
            had = Object.keys(M.imgs[b.i].f);
          old.getContext('2d').drawImage(sheet, bx, by, bw, bh, 0, 0, bw, bh);
          const picture = this.paint(source, old, j, use.flip, s),
            at = rigSwapSocketsAt(j.sockets || {}, j.pivot, picture.w, picture.h, use.flip, (s.angle * Math.PI) / 180, [
              s.x,
              s.y,
            ]),
            px = pictureImage(picture.c),
            frames = {},
            item = {
              view,
              bone: b.n,
              path,
              sheet,
              version: sheet._ver,
              c: picture.c,
              ox: picture.ox,
              oy: picture.oy,
              at,
              needs,
              frames,
            };
          if (had.includes('squash') && bake) {
            /* a torso: padded, with its squash and stretch made again (the kit baker's) */
            for (const [n, f] of Object.entries(kitSquashFrames(px, bake.pad, bake.squash))) frames[n] = f;
            item.ox -= bake.pad;
            item.oy -= bake.pad;
          } else if (had.includes('idle')) {
            frames.idle = px;
            if (s.keep) {
              item.keepFrames = had.filter(f => f !== 'idle');
              if (item.keepFrames.length)
                warnings.push(
                  `${view} ${b.n}: keeps its old ${item.keepFrames.join(', ')} frames (drawn for the old part).`
                );
            } else if (had.includes('blink')) {
              const blink = kitBlinkFrame(px);
              if (blink) frames.blink = blink;
              warnings.push(
                blink
                  ? `${view} ${b.n}: its blink is made again from the new picture${had.some(f => f === 'happy' || f === 'hurt') ? '; happy and hurt show the new picture' : ''}.`
                  : `${view} ${b.n}: no eyes found on the new picture, so it has no blink.`
              );
            }
          } else frames[had[0] || 'main'] = px;
          prepared.push(item);
        }
      }
      if (prepared.length) {
        const rig = studioState.rigs[s.sp],
          pathOf = v => atlasPath(s.sp, v),
          P = neutralPose(),
          geoOf = (M, v) => rigGeo(M, v, animFor(M.plan, M.q || {})(P, v === 'back') || {}, P),
          sheets = new Map(prepared.map(p => [p.path, pictureImage(p.sheet)])),
          after = rigSwapApply(rig, sheets, pathOf, prepared, geoOf),
          canvases = new Map();
        /* the new sheets: the old one drawn whole (no pixel of it goes through ImageData) and the new frames below */
        for (const p of prepared) {
          let c = canvases.get(p.path);
          if (!c) {
            const [w, h] = after.rig[p.view].size;
            c = makeCanvas(w, h);
            c.getContext('2d').drawImage(p.sheet, 0, 0);
            canvases.set(p.path, c);
          }
          const M = after.rig[p.view],
            f = M.imgs[M.bones.find(b => b.n === p.bone).i].f;
          for (const [n, px] of Object.entries(p.frames))
            c.getContext('2d').putImageData(
              new ImageData(new Uint8ClampedArray(px.data), px.width, px.height),
              f[n][0],
              f[n][1]
            );
        }
        const moved = Object.entries(after.how).flatMap(([k, m]) => Object.entries(m).map(([c, w]) => `${c} → ${w}`));
        if (moved.length) warnings.push('Children refit: ' + [...new Set(moved)].join(', ') + '.');
        s.after = { rig: after.rig, sheets: canvases };
      }
    } catch (e) {
      warnings.push('Could not replace: ' + e.message);
      prepared.length = 0;
    }
    if (this.active() !== s || serial !== s.serial) return;
    s.prepared = prepared;
    s.warnings = warnings;
    s.busy = false;
    s.strip = s.after ? this.strip(s) : null;
    render();
  },
  /** the Billie before and after, front and back, as the game draws it (rigFromMeta, rigFrame): idle, blink, happy,
   * hurt; one picture per view, the top row before, the bottom row after */
  strip(s) {
    const out = {};
    for (const view of WB_VIEWS) {
      const before = rigFor(s.sp, view),
        M = s.after.rig[view];
      if (!before || !M) continue;
      const after = rigFromMeta(M, s.after.sheets.get(atlasPath(s.sp, view)) || loadedAtlas(atlasPath(s.sp, view))),
        faces = ['idle', 'blink', 'happy', 'hurt'],
        W = Math.max(before.BW, after.BW),
        H = Math.max(before.BH, after.BH),
        c = makeCanvas(W * faces.length, H * 2),
        x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      [before, after].forEach((R, row) =>
        faces.forEach((face, i) => {
          const P = rigFrame(R, null, 0, 1000, 1),
            one = makeCanvas(R.BW, R.BH);
          P.face = face;
          drawRig(one.getContext('2d'), R, P, view); /* drawRig sets its own transform */
          x.drawImage(one, i * W, row * H);
        })
      );
      out[view] = c.toDataURL();
    }
    return out;
  },
  preview(R, view) {
    const s = this.active();
    if (!s?.after?.rig[view]) return R;
    return rigFromMeta(
      s.after.rig[view],
      s.after.sheets.get(atlasPath(s.sp, view)) || loadedAtlas(atlasPath(s.sp, view))
    );
  },
  apply() {
    const s = this.active();
    if (!s || s.busy || !s.prepared.length || !s.after) return;
    if (s.prepared.some(p => loadedAtlas(p.path) !== p.sheet || p.sheet._ver !== p.version))
      return toast('The sheet changed. Pick the library part again to refresh the preview.', 'err');
    // Finish earlier edits before taking the paired data/art snapshot.
    commit(true);
    const steps = [];
    for (const [path, c] of s.after.sheets) steps.push([path, pictureImage(loadedAtlas(path)), pictureImage(c)]);
    for (const [path, c] of s.after.sheets) markArt(path, c);
    studioState.rigs = { ...studioState.rigs, [s.sp]: s.after.rig };
    window.RIGS = studioState.rigs;
    changed(true);
    artSteps(steps, snapshotParts());
    this.state = null;
    wbPart.frame = '';
    wbPart.sel = null;
    render();
    toast('Part replaced: children refit, frames and size updated. Undo restores the pictures and skeleton together.');
  },
  input(ev) {
    const el = ev.target,
      key = el.dataset?.wbsLib,
      s = this.active();
    if (!key || !s || ev.type !== 'change') return;
    if (['both', 'recolor', 'keep'].includes(key)) s[key] = el.checked;
    else if (['scale', 'angle', 'x', 'y'].includes(key)) {
      const value = Number(el.value);
      if (!Number.isFinite(value)) return;
      s[key] = Math.max(Number(el.min), Math.min(Number(el.max), Math.round(value)));
    } else if (['slot', 'kit', 'kind', 'action'].includes(key)) s[key] = el.value;
    else return;
    if (key === 'slot' || key === 'kit' || key === 'kind') {
      if (key !== 'kind') s.kind = '';
      s.serial++;
      s.selected = '';
      s.prepared = [];
      s.busy = false;
      s.warnings = [];
      render();
    } else if (key === 'action') {
      wbPart.play = true;
      render();
    } else this.prepare();
  },
};
ACTIONS.wbsLibraryOpen = () => wbsLibrary.open();
ACTIONS.wbsLibraryPick = d => {
  const s = wbsLibrary.active();
  if (s) {
    s.selected = d.id;
    wbsLibrary.prepare();
  }
};
ACTIONS.wbsLibraryCancel = () => {
  wbsLibrary.state = null;
  render();
};
ACTIONS.wbsLibraryApply = () => wbsLibrary.apply();
