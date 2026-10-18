'use strict';
/* ================= POCKET BILLIES STUDIO · skeleton builder =================
   A billionaire is a tree of parts (bones). Each part has a picture cut from the sprite sheet, a pivot it turns
   around, a parent it hangs from, a draw layer and an animation role (which motion of its body plan it follows).
   Front and back views have their own skeletons and sheets; the Gold-Plated sheets share the same layout. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { hexToRgb, makeCanvas, shadeHex } from '../../game/js/art.js';
import { ANIM } from '../../game/js/body-plan-animation.js';
import { drawRig, rigAudit, rigMatrices, rigPose } from '../../game/js/skeleton-rig.js';
import { esc } from './game-stand-ins.js';
import {
  ask,
  changed,
  checkboxField,
  clone,
  commit,
  dialog,
  numberField,
  redo,
  render,
  speciesName,
  studioState,
  toast,
  undo,
} from './studio-app.js';
import {
  atlasGet,
  atlasPath,
  fileToCanvas,
  goldFrom,
  loadImage,
  loadedAtlas,
  markArt,
  openPixelEditor,
  pickFile,
  pixelEditor,
  previewsDirty,
  rigFor,
  spriteCacheClear,
} from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  BODY_TEMPLATES: [() => BODY_TEMPLATES],
  PLAN_INFO: [() => PLAN_INFO],
  PLAN_MOTION_FIELDS: [() => PLAN_MOTION_FIELDS],
  ROLE_HELP: [() => ROLE_HELP],
  addPart: [() => addPart, v => (addPart = v)],
  allocRect: [() => allocRect, v => (allocRect = v)],
  applyBodyPlan: [() => applyBodyPlan, v => (applyBodyPlan = v)],
  applyLinear2x2: [() => applyLinear2x2],
  bindSkeletonCanvas: [() => bindSkeletonCanvas, v => (bindSkeletonCanvas = v)],
  blobPart: [() => blobPart, v => (blobPart = v)],
  bonesUsingImage: [() => bonesUsingImage],
  cutRect: [() => cutRect, v => (cutRect = v)],
  drawSkeleton: [() => drawSkeleton, v => (drawSkeleton = v)],
  flipped: [() => flipped, v => (flipped = v)],
  importPieceSheet: [() => importPieceSheet, v => (importPieceSheet = v)],
  invert2x2: [() => invert2x2],
  loadSkeletonView: [() => loadSkeletonView, v => (loadSkeletonView = v)],
  makeBlankBody: [() => makeBlankBody, v => ((makeBlankBody = v), provide({ makeBlankBody }))],
  mirrorPart: [() => mirrorPart, v => (mirrorPart = v)],
  neutralPose: [() => neutralPose, v => ((neutralPose = v), provide({ neutralPose }))],
  openSkeleton: [() => openSkeleton, v => ((openSkeleton = v), provide({ openSkeleton }))],
  placeholderPart: [() => placeholderPart, v => (placeholderPart = v)],
  planRoles: [() => planRoles, v => (planRoles = v)],
  putPart: [() => putPart, v => (putPart = v)],
  renameBone: [() => renameBone, v => (renameBone = v)],
  reparentBone: [() => reparentBone, v => (reparentBone = v)],
  scaled: [() => scaled, v => (scaled = v)],
  skeletonAlphaAt: [() => skeletonAlphaAt, v => (skeletonAlphaAt = v)],
  skeletonChanged: [() => skeletonChanged, v => (skeletonChanged = v)],
  skeletonClick: [() => skeletonClick, v => (skeletonClick = v)],
  skeletonEditor: [() => skeletonEditor],
  skeletonFraming: [() => skeletonFraming, v => (skeletonFraming = v)],
  skeletonHitTest: [() => skeletonHitTest, v => (skeletonHitTest = v)],
  skeletonLoop: [() => skeletonLoop, v => (skeletonLoop = v)],
  skeletonMeta: [() => skeletonMeta, v => (skeletonMeta = v)],
  skeletonPose: [() => skeletonPose, v => (skeletonPose = v)],
  skeletonSidePanel: [() => skeletonSidePanel, v => (skeletonSidePanel = v)],
  skeletonTree: [() => skeletonTree, v => (skeletonTree = v)],
  sortBonesParentsFirst: [() => sortBonesParentsFirst, v => (sortBonesParentsFirst = v)],
  swapLeftRight: [() => swapLeftRight],
  uniqueBoneName: [() => uniqueBoneName],
});
/* eslint-enable no-func-assign */
provide({ makeBlankBody, neutralPose, openSkeleton });
/* to-module: end */
const skeletonEditor = {
  sp: null,
  view: 'front',
  sel: null,
  zoom: 2.5,
  anim: false,
  act: null,
  t0: 0,
  drag: null,
  raf: 0,
  alpha: new WeakMap(),
  both: true,
  grid12: false,
  paused: false,
  tick: 0,
  onion: false,
};
const PLAN_INFO = {
  bird: 'Two legs, two wings, a crest and a tail; hops',
  insect: 'Six legs, antennae, wings and an abdomen',
  crab: 'Sideways legs and two claws',
  hopper: 'Big hind legs, long ears; crouches and jumps',
  plant: 'A stem that sways, leaves that lift',
  biped: 'Two legs, two arms, a head',
  quad: 'Four legs and a long body',
  flyer: 'Hovers and beats its wings',
  fish: 'Floats and swims through the air',
  serpent: 'A coil with a long neck',
  worm: 'A row of rippling segments',
  octo: 'Six three-part tentacles',
  blob: 'A wobbling body with small arms',
  shell: 'A shell with a soft body and little legs',
};
provide({ PLAN_INFO }); /* to-module */
const PLAN_MOTION_FIELDS = {
  bird: [
    ['per', 'Wing beat (ms)', 60, 900, 10],
    ['hop', 'Hop height', 0, 6, 0.2],
  ],
  biped: [
    ['lift', 'Hover height', 0, 40, 0.5],
    ['flapMs', 'Wing flap time, if it has wings (ms)', 60, 900, 10],
  ],
  flyer: [
    ['lift', 'Hover height', 0, 60, 0.5],
    ['per', 'Wing beat (ms)', 30, 900, 5],
    ['flapAmp', 'Flap size (0 = automatic)', 0, 1.5, 0.05],
  ],
  fish: [
    ['lift', 'Float height', 0, 40, 0.5],
    ['bh', 'Body height', 1, 30, 0.5],
  ],
  serpent: [['n', 'Neck segments (n0, n1…)', 1, 8, 1]],
  worm: [['n', 'Segments (s0, s1…)', 2, 10, 1]],
  octo: [['tl', 'Tentacle length', 1, 12, 0.2]],
};
const ROLE_HELP = {
  neck: 'turns with the head',
  crest: 'lifts with the head',
  abdomen: 'sways',
  antL: 'antenna',
  antR: 'antenna',
  clawL: 'claw',
  clawR: 'claw',
  thighL: 'hind leg',
  thighR: 'hind leg',
  footL: 'foot',
  footR: 'foot',
  earL: 'ear',
  earR: 'ear',
  leafL: 'leaf',
  leafR: 'leaf',
  torso: 'body sway',
  body: 'body sway',
  head: 'nods, looks around, reacts',
  armL: 'front arm swing',
  armR: 'back arm swing',
  legL: 'leg',
  legR: 'leg',
  legFN: 'near front leg',
  legFF: 'far front leg',
  legBN: 'near back leg',
  legBF: 'far back leg',
  tail: 'wags',
  wingL: 'flaps',
  wingR: 'flaps',
  wing2L: 'second wing pair',
  wing2R: 'second wing pair',
  fly: 'hover bob (whole body)',
  hover: 'floating bits',
  mane: 'counter-sways with the head',
  neckS: 'neck sway',
  coil: 'breathing coil',
  hood: 'flares when attacking',
  shell: 'shell bounce',
  foot: 'foot squash',
  l1: 'little leg',
  l2: 'little leg',
  l3: 'little leg',
  puddle: 'still',
};
function planRoles(plan, q) {
  try {
    return Object.keys(ANIM[plan](neutralPose(), q || {})).sort();
  } catch (e) {
    return [];
  }
}
function skeletonMeta(view = skeletonEditor.view) {
  return studioState.rigs[skeletonEditor.sp] && studioState.rigs[skeletonEditor.sp][view];
}
export function neutralPose() {
  const P = rigPose(null, 0, 0, 0);
  Object.assign(P, {
    sy: 1,
    sx: 1,
    head: 0,
    hdy: 0,
    hdx: 0,
    aL: 0,
    aR: 0,
    tail: 0,
    face: 'idle',
    hov: { dx: 0, dy: 0, r: 0 },
  });
  return P;
}
function skeletonPose(ts, tickOff = 0) {
  if (!skeletonEditor.anim) return neutralPose();
  let tau = ts - skeletonEditor.t0;
  if (skeletonEditor.paused) tau = (skeletonEditor.tick * 1000) / 12;
  if (skeletonEditor.grid12 || skeletonEditor.paused) tau = Math.floor(tau / (1000 / 12)) * (1000 / 12);
  tau += (tickOff * 1000) / 12;
  const t2 = skeletonEditor.paused || skeletonEditor.grid12 ? skeletonEditor.t0 + tau : ts;
  const act =
    skeletonEditor.act && (skeletonEditor.act === 'faint' ? tau < 1600 : tau < 1100) ? skeletonEditor.act : null;
  if (skeletonEditor.act && !act && !skeletonEditor.paused) skeletonEditor.t0 = ts;
  return rigPose(act, Math.max(0, tau), t2, 1);
}
const invert2x2 = m => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
};
const applyLinear2x2 = (inv, x, y) => [inv[0] * x + inv[2] * y, inv[1] * x + inv[3] * y];
const bonesUsingImage = (meta, i) => meta.bones.filter(b => b.i === i).map(b => b.n);
const uniqueBoneName = (meta, base) => {
  if (!meta.bones.some(b => b.n === base)) return base;
  let n = 2;
  while (meta.bones.some(b => b.n === base + n)) n++;
  return base + n;
};
/* ---------- sheet space: new parts get a strip at the bottom of both the normal and gold sheets ---------- */
function allocRect(sp, view, w, h) {
  const pN = atlasPath(sp, view, false),
    pG = atlasPath(sp, view, true),
    N = loadedAtlas(pN),
    G = loadedAtlas(pG);
  if (!N) throw new Error('Sheet not loaded');
  const x = 1,
    y = N.height + 1,
    W = Math.max(N.width, w + 2),
    Hh = N.height + h + 2;
  const grow = c => {
    const n = makeCanvas(W, Hh);
    if (c) n.getContext('2d').drawImage(c, 0, 0);
    return n;
  };
  markArt(pN, grow(N));
  markArt(pG, grow(G || N));
  const meta = studioState.rigs[sp][view];
  meta.size = [W, Hh];
  return [x, y, w, h];
}
/* paint pixels into a rect of the normal sheet, and a gold version into the gold sheet */
function putPart(sp, view, rect, src) {
  const pN = atlasPath(sp, view, false),
    pG = atlasPath(sp, view, true);
  for (const [p, gold] of [
    [pN, 0],
    [pG, 1],
  ]) {
    const c = loadedAtlas(p);
    if (!c) continue;
    const x = c.getContext('2d');
    x.clearRect(rect[0], rect[1], rect[2], rect[3]);
    x.drawImage(gold ? goldFrom(src, 0.6) : src, rect[0], rect[1]);
    markArt(p, c);
  }
}
function cutRect(sp, view, rect, gold = false) {
  const c = loadedAtlas(atlasPath(sp, view, gold)),
    o = makeCanvas(rect[2], rect[3]);
  if (c) o.getContext('2d').drawImage(c, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3]);
  return o;
}
function scaled(src, k) {
  const o = makeCanvas(Math.max(1, Math.round(src.width * k)), Math.max(1, Math.round(src.height * k))),
    x = o.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, o.width, o.height);
  return o;
}
function flipped(src) {
  const o = makeCanvas(src.width, src.height),
    x = o.getContext('2d');
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return o;
}
/* keep parents ahead of their children in the list (the game assembles bones in order) */
function sortBonesParentsFirst(meta) {
  const out = [],
    seen = new Set(),
    byPar = {};
  meta.bones.forEach(b => {
    const p = b.par && b.par !== 'root' && meta.bones.some(x => x.n === b.par) ? b.par : 'root';
    (byPar[p] = byPar[p] || []).push(b);
  });
  const walk = p =>
    (byPar[p] || []).forEach(b => {
      if (seen.has(b)) return;
      seen.add(b);
      out.push(b);
      walk(b.n);
    });
  walk('root');
  meta.bones.forEach(b => {
    if (!seen.has(b)) {
      b.par = 'root';
      out.push(b);
    }
  });
  meta.bones = out;
}
/* shadow width, body center and top for battle framing */
function skeletonFraming(sp) {
  for (const view of ['front', 'back']) {
    const meta = studioState.rigs[sp] && studioState.rigs[sp][view];
    if (!meta) continue;
    const R = rigFor(sp, view, false);
    if (!R) continue;
    const { list } = rigMatrices(R, neutralPose(), view);
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    for (const [z, m, img] of list) {
      const c = img.c,
        w = c.width,
        h = c.height;
      for (const [px, py] of [
        [img.ox, img.oy],
        [img.ox + w, img.oy],
        [img.ox, img.oy + h],
        [img.ox + w, img.oy + h],
      ]) {
        const X = m[0] * px + m[2] * py + m[4],
          Y = m[1] * px + m[3] * py + m[5];
        x0 = Math.min(x0, X);
        x1 = Math.max(x1, X);
        y0 = Math.min(y0, Y);
        y1 = Math.max(y1, Y);
      }
    }
    if (x0 > x1) continue;
    const g = (meta.geo = meta.geo || {});
    const lift = ((meta.q && meta.q.lift) || 0) * meta.k;
    Object.assign(g, {
      cx: meta.cx,
      base: meta.base,
      k: meta.k,
      top: +y0.toFixed(2),
      mid: +((y0 + y1) / 2).toFixed(2),
      hw: +((x1 - x0) / 2).toFixed(2),
      lift: +lift.toFixed(2),
      cy: +((y0 + y1) / 2).toFixed(2),
    });
  }
}
/* ---------- open ---------- */
async function openSkeleton(sp, view = 'front') {
  skeletonEditor.sp = sp;
  skeletonEditor.view = view;
  skeletonEditor.sel = null;
  skeletonEditor.anim = false;
  skeletonEditor.act = null;
  try {
    await Promise.all(
      ['front', 'back'].flatMap(v => [
        atlasGet(atlasPath(sp, v, false)),
        atlasGet(atlasPath(sp, v, true)).catch(() => null),
      ])
    );
  } catch (e) {
    toast(e.message, 'err');
    return;
  }
  if (!studioState.rigs[sp]) {
    toast('This Billie has no skeleton yet.', 'err');
    return;
  }
  const m = $('#modal');
  m.innerHTML = `<div class="pxed skel" role="dialog" aria-modal="true" aria-label="Skeleton builder">
 <header class="px-top"><b>${esc(speciesName(sp))}</b><span class="px-tabs">${['front', 'back'].map(v => `<button class="seg" data-sk="view" data-v="${v}">${v === 'front' ? 'Front view' : 'Back view'}</button>`).join('')}</span>
  <span class="px-tools"><button class="seg" data-sk="anim" title="Play the body plan’s motion">Animate</button>${['attack', 'cast', 'hurt', 'cheer', 'faint'].map(a => `<button class="seg sm" data-sk="act" data-a="${a}">${a}</button>`).join('')}</span>
  <span class="px-tools sk-scrub" title="v35: step the pose on the 12 fps clock. Pause, then scrub a tick at a time; Onion shows the two ticks before as ghosts"><button class="seg" data-sk="grid12">12 fps</button><button class="seg" data-sk="pause">Pause</button><button class="seg sm" data-sk="tick" data-d="-1">◀</button><input type="range" id="skScrub" min="0" max="23" value="0" step="1"><span id="skTick">tick 0</span><button class="seg sm" data-sk="tick" data-d="1">▶</button><button class="seg" data-sk="onion">Onion</button></span>
  <span class="px-tools"><button class="seg" data-sk="zoom" data-z="-.5">−</button><span id="skZoom"></span><button class="seg" data-sk="zoom" data-z=".5">+</button></span>
  <span class="grow"></span><button class="btn" data-sk="paint">Paint pixels</button><button class="btn primary" data-sk="close">Done</button></header>
 <div class="sk-body"><aside class="sk-tree"><div class="sk-tree-head"><b>Parts</b><small>Drag a part to move it. Drag its dot to move only the pivot. Shift-drag to tilt.</small></div><div id="skTree"></div>
  <div class="sk-adds"><button class="btn" data-sk="add">+ Blank part</button><button class="btn" data-sk="addPng">+ Part from PNG</button><button class="btn" data-sk="importSheet" title="v35: a piece sheet (one PNG) with its layout JSON: every piece becomes a part">Import piece sheet</button><label class="fld chk"><input type="checkbox" id="skBoth" ${skeletonEditor.both ? 'checked' : ''}><span>Also add to the other view</span></label></div></aside>
  <div class="px-stage sk-stage" id="skStage"><canvas id="skCv"></canvas></div>
  <aside class="px-side" id="skSide"></aside></div></div>`;
  $('#skBoth').addEventListener('change', e => (skeletonEditor.both = e.target.checked));
  $('#skScrub').addEventListener('input', e => {
    skeletonEditor.paused = true;
    $('[data-sk=pause]').classList.add('on');
    skeletonEditor.anim = true;
    $('[data-sk=anim]').classList.add('on');
    skeletonEditor.tick = +e.target.value;
    drawSkeleton();
  });
  m.querySelector('.skel').addEventListener('click', skeletonClick);
  bindSkeletonCanvas();
  loadSkeletonView();
  cancelAnimationFrame(skeletonEditor.raf);
  skeletonEditor.raf = requestAnimationFrame(skeletonLoop);
}
function loadSkeletonView() {
  $$('[data-sk=view]').forEach(b => b.classList.toggle('on', b.dataset.v === skeletonEditor.view));
  const meta = skeletonMeta();
  if (skeletonEditor.sel && !meta.bones.some(b => b.n === skeletonEditor.sel)) skeletonEditor.sel = null;
  skeletonTree();
  skeletonSidePanel();
  drawSkeleton(performance.now());
}
function skeletonLoop(ts) {
  if (!$('.skel')) return;
  if ((skeletonEditor.anim && !skeletonEditor.paused) || skeletonEditor.drag) drawSkeleton(ts);
  skeletonEditor.raf = requestAnimationFrame(skeletonLoop);
}
/* ---------- canvas ---------- */
function drawSkeleton(ts) {
  const c = $('#skCv');
  if (!c) return;
  const R = rigFor(skeletonEditor.sp, skeletonEditor.view, false);
  if (!R) return;
  const Z = skeletonEditor.zoom,
    W = R.BW * Z,
    Hh = R.BH * Z;
  if (c.width !== W || c.height !== Hh) {
    c.width = W;
    c.height = Hh;
  }
  $('#skZoom').textContent = Z + '×';
  const buf = skeletonEditor.buf || (skeletonEditor.buf = makeCanvas(1, 1));
  if (buf.width !== R.BW || buf.height !== R.BH) {
    buf.width = R.BW;
    buf.height = R.BH;
  }
  const bx = buf.getContext('2d');
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.clearRect(0, 0, R.BW, R.BH);
  bx.imageSmoothingEnabled = false;
  const now = ts || performance.now(),
    x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, W, Hh);
  x.imageSmoothingEnabled = false;
  if (skeletonEditor.onion && skeletonEditor.anim) {
    for (const [off, al] of [
      [-2, 0.18],
      [-1, 0.32],
    ]) {
      bx.clearRect(0, 0, R.BW, R.BH);
      drawRig(bx, R, skeletonPose(now, off), skeletonEditor.view);
      bx.save();
      bx.globalCompositeOperation = 'source-atop';
      bx.fillStyle = off === -1 ? '#C8323C' : '#1F6E6F';
      bx.fillRect(0, 0, R.BW, R.BH);
      bx.restore();
      x.globalAlpha = al;
      x.drawImage(buf, 0, 0, W, Hh);
      x.globalAlpha = 1;
    }
    bx.clearRect(0, 0, R.BW, R.BH);
  }
  const P = skeletonPose(now);
  drawRig(bx, R, P, skeletonEditor.view);
  x.drawImage(buf, 0, 0, W, Hh);
  const tk = $('#skTick');
  if (tk)
    tk.textContent =
      'tick ' +
      (skeletonEditor.paused ? skeletonEditor.tick : Math.floor(((now - skeletonEditor.t0) / (1000 / 12)) % 24));
  if (skeletonEditor.paused && $('#skScrub')) $('#skScrub').value = skeletonEditor.tick;
  x.strokeStyle = 'rgba(31,110,111,.5)';
  x.setLineDash([6, 4]);
  x.strokeRect(0.5, 0.5, W - 1, Hh - 1);
  x.beginPath();
  x.moveTo(0, R.base * Z + 0.5);
  x.lineTo(W, R.base * Z + 0.5);
  x.stroke();
  x.setLineDash([]);
  const { W: Wm, list } = rigMatrices(R, P, skeletonEditor.view),
    meta = skeletonMeta();
  if (skeletonEditor.sel) {
    const e = list.find(l => l[5].n === skeletonEditor.sel);
    if (e) {
      const [z, m, img] = e,
        w = img.c.width,
        h = img.c.height;
      x.strokeStyle = '#C8323C';
      x.lineWidth = 2;
      x.beginPath();
      [
        [img.ox, img.oy],
        [img.ox + w, img.oy],
        [img.ox + w, img.oy + h],
        [img.ox, img.oy + h],
      ].forEach(([px, py], i) => {
        const X = (m[0] * px + m[2] * py + m[4]) * Z,
          Y = (m[1] * px + m[3] * py + m[5]) * Z;
        i ? x.lineTo(X, Y) : x.moveTo(X, Y);
      });
      x.closePath();
      x.stroke();
      x.lineWidth = 1;
    }
  }
  for (const b of meta.bones) {
    const m = Wm[b.n];
    if (!m) continue;
    const pm = Wm[b.par || 'root'] || Wm.root,
      X = m[4] * Z,
      Y = m[5] * Z;
    x.strokeStyle = 'rgba(31,46,54,.45)';
    x.beginPath();
    x.moveTo(pm[4] * Z, pm[5] * Z);
    x.lineTo(X, Y);
    x.stroke();
    const on = b.n === skeletonEditor.sel;
    x.fillStyle = on ? '#C8323C' : b.i < 0 ? '#9C8CD8' : '#F2C14E';
    x.strokeStyle = '#1F2E36';
    x.beginPath();
    x.arc(X, Y, on ? 6 : 4.5, 0, 7);
    x.fill();
    x.stroke();
    if (on) {
      x.font = '600 12px Chakra Petch, sans-serif';
      x.fillStyle = '#1F2E36';
      x.fillText(b.n, X + 9, Y - 8);
    }
  }
  const rm = Wm.root;
  x.strokeStyle = '#1F6E6F';
  x.beginPath();
  x.moveTo(rm[4] * Z - 8, rm[5] * Z);
  x.lineTo(rm[4] * Z + 8, rm[5] * Z);
  x.moveTo(rm[4] * Z, rm[5] * Z - 8);
  x.lineTo(rm[4] * Z, rm[5] * Z + 8);
  x.stroke();
}
function skeletonAlphaAt(c, x, y) {
  let d = skeletonEditor.alpha.get(c);
  if (!d) {
    d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    skeletonEditor.alpha.set(c, d);
  }
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return 0;
  return d[(y * c.width + x) * 4 + 3];
}
function skeletonHitTest(bx, by) {
  const R = rigFor(skeletonEditor.sp, skeletonEditor.view, false),
    { W, list } = rigMatrices(R, neutralPose(), skeletonEditor.view),
    meta = skeletonMeta();
  for (const b of meta.bones) {
    const m = W[b.n];
    if (m && Math.hypot(m[4] - bx, m[5] - by) * skeletonEditor.zoom < 9) return { b, mode: 'pivot' };
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const [z, m, img, v, al, b] = list[i],
      inv = invert2x2(m),
      [lx, ly] = applyLinear2x2(inv, bx - m[4], by - m[5]);
    const c = img.c;
    if (
      lx >= img.ox &&
      ly >= img.oy &&
      lx < img.ox + c.width &&
      ly < img.oy + c.height &&
      skeletonAlphaAt(c, lx - img.ox, ly - img.oy) > 20
    )
      return { b: meta.bones.find(x => x.n === b.n) || b, mode: 'part' };
  }
  return null;
}
function bindSkeletonCanvas() {
  const c = $('#skCv');
  const pos = ev => {
    const r = c.getBoundingClientRect();
    return [
      (((ev.clientX - r.left) / r.width) * c.width) / skeletonEditor.zoom,
      (((ev.clientY - r.top) / r.height) * c.height) / skeletonEditor.zoom,
    ];
  };
  c.addEventListener('pointerdown', ev => {
    const [x, y] = pos(ev),
      h = skeletonHitTest(x, y);
    if (!h) {
      skeletonEditor.sel = null;
      skeletonTree();
      skeletonSidePanel();
      drawSkeleton();
      return;
    }
    c.setPointerCapture(ev.pointerId);
    skeletonEditor.sel = h.b.n;
    let mode = ev.shiftKey ? 'rotate' : h.mode;
    const meta = skeletonMeta();
    if (mode === 'pivot' && h.b.i >= 0 && bonesUsingImage(meta, h.b.i).length > 1) {
      meta.imgs.push(clone(meta.imgs[h.b.i]));
      h.b.i = meta.imgs.length - 1;
      studioState.rigVer = (studioState.rigVer || 0) + 1;
    }
    skeletonEditor.drag = { b: h.b, mode, last: [x, y], ang: null, moved: false };
    skeletonTree();
    skeletonSidePanel();
    drawSkeleton();
  });
  c.addEventListener('pointermove', ev => {
    const D = skeletonEditor.drag;
    if (!D) return;
    const [x, y] = pos(ev),
      dx = x - D.last[0],
      dy = y - D.last[1];
    if (!dx && !dy) return;
    D.last = [x, y];
    D.moved = true;
    const meta = skeletonMeta(),
      b = D.b,
      k = meta.k,
      R = rigFor(skeletonEditor.sp, skeletonEditor.view, false),
      { W } = rigMatrices(R, neutralPose(), skeletonEditor.view);
    const pm = W[b.par || 'root'] || W.root,
      pinv = invert2x2(pm),
      [pdx, pdy] = applyLinear2x2(pinv, dx, dy);
    if (D.mode === 'part') {
      b.at = [+(b.at[0] + pdx / k).toFixed(3), +(b.at[1] + pdy / k).toFixed(3)];
    } else if (D.mode === 'pivot') {
      const m = W[b.n],
        [ldx, ldy] = applyLinear2x2(invert2x2(m), dx, dy);
      b.at = [+(b.at[0] + pdx / k).toFixed(3), +(b.at[1] + pdy / k).toFixed(3)];
      const im = meta.imgs[b.i];
      if (im) {
        im.ox = Math.round((im.ox - ldx) * 100) / 100;
        im.oy = Math.round((im.oy - ldy) * 100) / 100;
      }
      meta.bones
        .filter(ch => ch.par === b.n)
        .forEach(ch => {
          ch.at = [+(ch.at[0] - ldx / k).toFixed(3), +(ch.at[1] - ldy / k).toFixed(3)];
        });
    } else {
      const m = W[b.n],
        cx = m[4],
        cy = m[5],
        a0 = Math.atan2(y - dy - cy, x - dx - cx),
        a1 = Math.atan2(y - cy, x - cx);
      let d = a1 - a0;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      const det = pm[0] * pm[3] - pm[1] * pm[2];
      b.rr = +((b.rr || 0) + (det < 0 ? -d : d)).toFixed(4);
    }
    studioState.rigVer = (studioState.rigVer || 0) + 1;
    studioState.rigsDirty = true;
  });
  const up = () => {
    const D = skeletonEditor.drag;
    skeletonEditor.drag = null;
    if (D && D.moved) {
      skeletonFraming(skeletonEditor.sp);
      changed(true);
      commit(true);
      skeletonSidePanel();
    }
    drawSkeleton();
  };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  $('#skStage').addEventListener(
    'wheel',
    ev => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      skeletonEditor.zoom = clamp(skeletonEditor.zoom + (ev.deltaY < 0 ? 0.5 : -0.5), 1, 8);
      drawSkeleton();
    },
    { passive: false }
  );
}
/* ---------- part list ---------- */
function skeletonTree() {
  const meta = skeletonMeta(),
    roles = planRoles(meta.plan, meta.q),
    kids = {};
  meta.bones.forEach(b => {
    const p = b.par && b.par !== 'root' ? b.par : 'root';
    (kids[p] = kids[p] || []).push(b);
  });
  const row = (b, d) => {
    const role = b.a || b.n,
      anim = roles.includes(role);
    return (
      `<button class="sk-row ${b.n === skeletonEditor.sel ? 'on' : ''}" data-sk="sel" data-n="${esc(b.n)}" style="padding-left:${8 + d * 14}px"><span class="sk-dot ${b.i < 0 ? 'piv' : ''}"></span><b>${esc(b.n)}</b>${b.a && b.a !== b.n ? `<small>moves as ${esc(b.a)}</small>` : anim ? '' : '<small>still</small>'}${skeletonEditor.view === 'back' && b.hideB ? '<small>hidden</small>' : ''}</button>` +
      (kids[b.n] || []).map(c => row(c, d + 1)).join('')
    );
  };
  $('#skTree').innerHTML = (kids.root || []).map(b => row(b, 0)).join('');
}
/* ---------- properties ---------- */
function skeletonSidePanel() {
  const meta = skeletonMeta(),
    base = `@rigs.${skeletonEditor.sp}.${skeletonEditor.view}`,
    roles = planRoles(meta.plan, meta.q),
    side = $('#skSide');
  if (!side) return;
  let h = '';
  if (skeletonEditor.sel) {
    const bi = meta.bones.findIndex(b => b.n === skeletonEditor.sel),
      b = meta.bones[bi],
      p = `${base}.bones.${bi}`,
      desc = new Set();
    const addD = n =>
      meta.bones
        .filter(x => x.par === n)
        .forEach(x => {
          desc.add(x.n);
          addD(x.n);
        });
    addD(b.n);
    const parents = [
        ['root', 'Ground (root)'],
        ...meta.bones.filter(x => x !== b && !desc.has(x.n)).map(x => [x.n, x.n]),
      ],
      img = meta.imgs[b.i],
      users = b.i >= 0 ? bonesUsingImage(meta, b.i) : [];
    const variants = img ? Object.keys(img.f) : [];
    h += `<div class="px-sec"><h4>Part “${esc(b.n)}”</h4>
   <label class="fld"><span>Name</span><input type="text" id="skName" value="${esc(b.n)}" maxlength="16"></label>
   <label class="fld"><span>Hangs from</span><select id="skPar">${parents.map(([v, n]) => `<option value="${esc(v)}" ${(b.par || 'root') === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
   <label class="fld"><span>Moves like</span><select id="skRole"><option value="">${roles.includes(b.n) ? `Its own name (${esc(b.n)})` : 'Nothing: follows its parent'}</option>${roles
     .filter(r => r !== b.n)
     .map(
       r =>
         `<option value="${r}" ${b.a === r ? 'selected' : ''}>${r}${ROLE_HELP[r.replace(/\d+$/, '')] ? ' · ' + ROLE_HELP[r.replace(/\d+$/, '')] : ''}</option>`
     )
     .join(
       ''
     )}<option value="-" ${b.a === '-' ? 'selected' : ''}>Nothing: stays still</option></select><small class="help">Each body plan animates parts by role. Pick one to borrow a motion.</small></label>
   <div class="grid sk-grid">${numberField('Across', `${p}.at.0`, { step: 0.25 })}${numberField('Up / down', `${p}.at.1`, { step: 0.25 })}${numberField('Tilt', `${p}.rr`, { step: 0.02, opt: 1, ph: '0' })}${numberField(skeletonEditor.view === 'back' ? 'Layer (back)' : 'Layer', `${p}.${skeletonEditor.view === 'back' ? 'zb' : 'z'}`, { step: 0.5, help: 'Higher draws on top.' })}</div>
   ${skeletonEditor.view === 'back' ? checkboxField('Hidden in the back view', `${p}.hideB`, { num: 1 }) : ''}
   <div class="seg-row"><button class="btn sm" data-sk="dup">Duplicate</button><button class="btn sm" data-sk="mirror">Mirror copy</button><button class="btn sm" data-sk="child">+ Child part</button><button class="btn sm danger" data-sk="del">Delete</button></div></div>`;
    if (b.i >= 0 && img) {
      const r = img.f.idle || img.f.main || Object.values(img.f)[0];
      h += `<div class="px-sec"><h4>Picture</h4><div class="sk-pic"><canvas id="skPic"></canvas><div><small class="mono">${r[2]}×${r[3]} px · ${variants.length > 1 ? variants.length + ' expressions' : 'one picture'}</small>${users.length > 1 ? `<p class="help">Shared with ${esc(users.filter(n => n !== b.n).join(', '))}. Repainting changes all of them.</p><button class="btn sm" data-sk="unshare">Give it its own copy</button>` : ''}</div></div>
   <div class="grid sk-grid">${numberField('Picture offset X', `${base}.imgs.${b.i}.ox`, { step: 1 })}${numberField('Picture offset Y', `${base}.imgs.${b.i}.oy`, { step: 1 })}</div>
   <div class="seg-row"><button class="btn sm primary" data-sk="paintPart">Paint this part</button><button class="btn sm" data-sk="replace">Replace from PNG…</button><button class="btn sm" data-sk="resize">Resize…</button></div>
   ${checkboxField('Has expressions (blink, happy, hurt, shout)', `${p}.face`, { num: 1 })}${b.face && variants.length < 5 ? `<button class="btn sm" data-sk="faces">Add the missing expression pictures</button>` : ''}</div>`;
    } else
      h += `<div class="px-sec"><h4>Picture</h4><p class="help">A pivot without a picture. Other parts hang from it (flyers use one called “fly” to hover).</p><button class="btn sm" data-sk="givePic">Give it a picture</button></div>`;
  } else
    h += `<div class="px-sec"><h4>No part selected</h4><p class="help">Click a part or a dot on the creature, or pick one from the list.</p></div>`;
  try {
    const au = typeof rigAudit === 'function' ? rigAudit(skeletonEditor.sp, skeletonEditor.view) : null;
    if (au) {
      const top = Object.entries(au.poses)
        .map(
          ([a, m]) =>
            `<li><b>${a}</b> ${
              Object.entries(m)
                .filter(([k, v]) => v > 0.5)
                .sort((x, y) => y[1] - x[1])
                .slice(0, 5)
                .map(([k, v]) => k)
                .join(', ') || '<i>nothing moves</i>'
            }</li>`
        )
        .join('');
      h += `<div class="px-sec"><h4>Motion check</h4><p class="help">${au.still.length ? `<b>Never moves:</b> ${esc(au.still.join(', '))}. Give each a role below, or hang it from a part that moves.` : 'Every part moves in at least one pose.'}</p><ul class="sk-audit">${top}</ul></div>`;
    }
  } catch (e) {}
  h += `<div class="px-sec"><h4>Body plan</h4><label class="fld"><span>How it moves</span><select id="skPlan">${Object.keys(
    ANIM
  )
    .map(k => `<option value="${k}" ${meta.plan === k ? 'selected' : ''}>${k} · ${PLAN_INFO[k] || ''}</option>`)
    .join('')}</select></label>
  ${(PLAN_MOTION_FIELDS[meta.plan] || []).map(([k, l, mn, mx, st]) => numberField(l, `${base}.q.${k}`, { min: mn, max: mx, step: st })).join('')}
  <p class="help">Parts animate when their name or “Moves like” matches one of: ${roles.map(esc).join(', ')}.</p>
  <button class="btn sm" data-sk="copyView">Copy this layout to the ${skeletonEditor.view === 'front' ? 'back' : 'front'} view</button></div>`;
  side.innerHTML = h;
  const pc = $('#skPic');
  if (pc && skeletonEditor.sel) {
    const b = meta.bones.find(x => x.n === skeletonEditor.sel),
      img = meta.imgs[b.i],
      r = img.f.idle || img.f.main || Object.values(img.f)[0],
      src = cutRect(skeletonEditor.sp, skeletonEditor.view, r);
    pc.width = src.width;
    pc.height = src.height;
    pc.getContext('2d').drawImage(src, 0, 0);
  }
  const nm = $('#skName');
  if (nm) nm.addEventListener('change', () => renameBone(nm.value));
  const par = $('#skPar');
  if (par) par.addEventListener('change', () => reparentBone(par.value));
  const ro = $('#skRole');
  if (ro)
    ro.addEventListener('change', () => {
      const b = skeletonMeta().bones.find(x => x.n === skeletonEditor.sel);
      if (ro.value) b.a = ro.value;
      else delete b.a;
      skeletonChanged();
    });
  $('#skPlan').addEventListener('change', e => applyBodyPlan(e.target.value));
}
studioState.hooks._skel = null;
function skeletonChanged() {
  studioState.rigVer = (studioState.rigVer || 0) + 1;
  skeletonFraming(skeletonEditor.sp);
  changed(true);
  commit(true);
  skeletonTree();
  skeletonSidePanel();
  drawSkeleton();
  previewsDirty();
}
/* field edits inside the builder go through the normal data binding; refresh the drawing after them */
document.addEventListener('input', ev => {
  if (ev.target.closest('.skel') && ev.target.dataset.p) {
    studioState.rigVer = (studioState.rigVer || 0) + 1;
    drawSkeleton();
  }
});
document.addEventListener('change', ev => {
  if (ev.target.closest('.skel') && ev.target.dataset.p) {
    skeletonFraming(skeletonEditor.sp);
    skeletonTree();
    if (ev.target.type === 'checkbox') skeletonSidePanel();
    drawSkeleton();
  }
});
/* undo and redo work inside the builder too */
document.addEventListener(
  'keydown',
  ev => {
    if (!$('.skel') || $('#dlg').innerHTML || ev.target.closest('input,select,textarea')) return;
    const k = ev.key.toLowerCase(),
      mod = ev.ctrlKey || ev.metaKey;
    if (mod && (k === 'z' || k === 'y')) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      k === 'y' || ev.shiftKey ? redo() : undo();
      loadSkeletonView();
    } else if (!mod && (k === 'delete' || k === 'backspace') && skeletonEditor.sel) {
      ev.preventDefault();
      $('[data-sk=del]') && $('[data-sk=del]').click();
    }
  },
  true
);
/* ---------- edits ---------- */
function renameBone(n) {
  n = n.trim().replace(/[^A-Za-z0-9_]/g, '');
  const meta = skeletonMeta(),
    b = meta.bones.find(x => x.n === skeletonEditor.sel);
  if (!n || n === b.n) return;
  if (meta.bones.some(x => x.n === n)) return toast('Another part already has that name.', 'err');
  const roles = planRoles(meta.plan, meta.q);
  if (!b.a && roles.includes(b.n) && !roles.includes(n)) b.a = b.n;
  meta.bones.forEach(x => {
    if (x.par === b.n) x.par = n;
  });
  b.n = n;
  skeletonEditor.sel = n;
  skeletonChanged();
}
function reparentBone(p) {
  const meta = skeletonMeta(),
    b = meta.bones.find(x => x.n === skeletonEditor.sel),
    R = rigFor(skeletonEditor.sp, skeletonEditor.view, false),
    { W } = rigMatrices(R, neutralPose(), skeletonEditor.view),
    me = W[b.n],
    np = W[p] || W.root;
  const inv = invert2x2(np),
    [lx, ly] = applyLinear2x2(inv, me[4] - np[4], me[5] - np[5]);
  b.par = p === 'root' ? 'root' : p;
  b.at = [+(lx / meta.k).toFixed(3), +(ly / meta.k).toFixed(3)];
  sortBonesParentsFirst(meta);
  skeletonChanged();
}
function applyBodyPlan(plan) {
  const meta = skeletonMeta();
  meta.plan = plan;
  meta.q = meta.q || {};
  (PLAN_MOTION_FIELDS[plan] || []).forEach(([k, l, mn, mx]) => {
    if (meta.q[k] == null) meta.q[k] = k === 'n' ? 3 : k === 'per' ? 300 : k === 'flapMs' ? 300 : mn;
  });
  const other = studioState.rigs[skeletonEditor.sp][skeletonEditor.view === 'front' ? 'back' : 'front'];
  if (other) {
    other.plan = plan;
    other.q = clone(meta.q);
  }
  skeletonChanged();
  toast('Body plan changed for both views. Parts move when their names match the plan’s roles.');
}
/* mirror a part and everything hanging from it: left/right names swap, pictures flip, positions and tilts reflect */
const swapLeftRight = n =>
  n
    .replace(/L(\d*)$/, '\u0000$1')
    .replace(/R(\d*)$/, 'L$1')
    .replace('\u0000', 'R');
function mirrorPart(meta, b, par, orig) {
  const roles = planRoles(meta.plan, meta.q),
    sw = swapLeftRight(b.n),
    n = clone(b),
    role0 = b.a || b.n,
    roleM = roles.includes(swapLeftRight(role0)) ? swapLeftRight(role0) : role0;
  n.n = uniqueBoneName(meta, sw !== b.n ? sw : b.n + 'M');
  n.par = par;
  delete n.a;
  if (b.a === '-') n.a = '-';
  else if (!(roles.includes(n.n) && n.n === roleM) && roles.includes(roleM)) n.a = roleM;
  n.at = [-b.at[0], b.at[1]];
  if (b.rr) n.rr = -b.rr;
  if (b.i >= 0) {
    const img = meta.imgs[b.i],
      f = {};
    for (const [v, r] of Object.entries(img.f)) {
      const src = flipped(cutRect(skeletonEditor.sp, skeletonEditor.view, r)),
        nr = allocRect(skeletonEditor.sp, skeletonEditor.view, r[2], r[3]);
      putPart(skeletonEditor.sp, skeletonEditor.view, nr, src);
      f[v] = nr;
    }
    const r0 = img.f.idle || img.f.main || Object.values(img.f)[0];
    meta.imgs.push({ ox: -(img.ox + r0[2]), oy: img.oy, f });
    n.i = meta.imgs.length - 1;
  }
  meta.bones.push(n);
  [...orig].filter(c => c.par === b.n).forEach(c => mirrorPart(meta, c, n.n, orig));
  return n;
}
function placeholderPart(w, h, col = '#B8A8E0') {
  const c = makeCanvas(w, h),
    x = c.getContext('2d');
  x.fillStyle = col;
  x.beginPath();
  x.ellipse(w / 2, h / 2, Math.max(1, w / 2 - 1), Math.max(1, h / 2 - 1), 0, 0, 7);
  x.fill();
  x.strokeStyle = '#2A1E2E';
  x.lineWidth = 1;
  x.stroke();
  const d = x.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
  x.putImageData(d, 0, 0);
  return c;
}
/* add a part: a new picture strip, a new bone, optionally mirrored into the other view */
function addPart(src, opts = {}) {
  const meta = skeletonMeta(),
    sp = skeletonEditor.sp,
    view = skeletonEditor.view,
    k = meta.k;
  const par = opts.par || skeletonEditor.sel || 'root',
    name = uniqueBoneName(meta, opts.name || 'part');
  const rect = allocRect(sp, view, src.width, src.height);
  putPart(sp, view, rect, src);
  const img = {
    ox: opts.ox ?? -Math.round(src.width / 2),
    oy: opts.oy ?? -Math.round(src.height / 2),
    f: { main: rect },
  };
  if (opts.faces) {
    img.f = { idle: rect };
    for (const [fk, fc] of Object.entries(opts.faces)) {
      const fr = allocRect(sp, view, fc.width, fc.height);
      putPart(sp, view, fr, fc);
      img.f[fk] = fr;
    }
  }
  meta.imgs.push(img);
  let at = opts.at || [0, -6];
  if (opts.abs) {
    try {
      const R = rigFor(sp, view, false),
        { W } = rigMatrices(R, neutralPose(), view),
        pm = W[par] || W.root;
      at = [(at[0] - pm[4]) / k, (at[1] - pm[5]) / k];
    } catch (e) {
      at = [0, -6];
    }
  }
  const z = Math.max(0, ...meta.bones.map(b => b.z || 0)) + 1,
    zb = Math.max(0, ...meta.bones.map(b => b.zb ?? b.z ?? 0)) + 1;
  const b = { n: name, par, at, z, zb, i: meta.imgs.length - 1 };
  if (opts.faces) b.face = true;
  meta.bones.push(b);
  sortBonesParentsFirst(meta);
  if (skeletonEditor.both && !opts.abs) {
    const ov = view === 'front' ? 'back' : 'front',
      om = studioState.rigs[sp][ov];
    if (om && !om.bones.some(x => x.n === name)) {
      const s2 = scaled(src, om.k / k),
        r2 = allocRect(sp, ov, s2.width, s2.height);
      putPart(sp, ov, r2, s2);
      om.imgs.push({ ox: -Math.round(s2.width / 2), oy: -Math.round(s2.height / 2), f: { main: r2 } });
      om.bones.push({
        n: name,
        par: om.bones.some(x => x.n === par) ? par : 'root',
        at: b.at.slice(),
        z,
        zb,
        i: om.imgs.length - 1,
      });
      sortBonesParentsFirst(om);
    }
  }
  skeletonEditor.sel = name;
  skeletonChanged();
  return b;
}
function skeletonClick(ev) {
  const el = ev.target.closest('[data-sk]');
  if (!el) return;
  const a = el.dataset.sk,
    meta = skeletonMeta(),
    b = skeletonEditor.sel && meta.bones.find(x => x.n === skeletonEditor.sel);
  const run = {
    view: () => {
      skeletonEditor.view = el.dataset.v;
      loadSkeletonView();
    },
    anim: () => {
      skeletonEditor.anim = !skeletonEditor.anim;
      el.classList.toggle('on', skeletonEditor.anim);
      skeletonEditor.t0 = performance.now();
      drawSkeleton();
    },
    act: () => {
      skeletonEditor.anim = true;
      $('[data-sk=anim]').classList.add('on');
      skeletonEditor.act = el.dataset.a;
      skeletonEditor.t0 = performance.now();
    },
    grid12: () => {
      skeletonEditor.grid12 = !skeletonEditor.grid12;
      el.classList.toggle('on', skeletonEditor.grid12);
      drawSkeleton();
    },
    pause: () => {
      skeletonEditor.paused = !skeletonEditor.paused;
      el.classList.toggle('on', skeletonEditor.paused);
      if (skeletonEditor.paused) {
        skeletonEditor.anim = true;
        $('[data-sk=anim]').classList.add('on');
        skeletonEditor.tick = Math.floor(((performance.now() - skeletonEditor.t0) / (1000 / 12)) % 24);
      } else skeletonEditor.t0 = performance.now() - (skeletonEditor.tick * 1000) / 12;
      drawSkeleton();
    },
    tick: () => {
      skeletonEditor.paused = true;
      $('[data-sk=pause]').classList.add('on');
      skeletonEditor.anim = true;
      $('[data-sk=anim]').classList.add('on');
      skeletonEditor.tick = (skeletonEditor.tick + +el.dataset.d + 24) % 24;
      drawSkeleton();
    },
    onion: () => {
      skeletonEditor.onion = !skeletonEditor.onion;
      el.classList.toggle('on', skeletonEditor.onion);
      drawSkeleton();
    },
    importSheet: () => importPieceSheet(),
    zoom: () => {
      skeletonEditor.zoom = clamp(skeletonEditor.zoom + +el.dataset.z, 1, 8);
      drawSkeleton();
    },
    sel: () => {
      skeletonEditor.sel = el.dataset.n;
      skeletonTree();
      skeletonSidePanel();
      drawSkeleton();
    },
    close: () => {
      cancelAnimationFrame(skeletonEditor.raf);
      $('#modal').innerHTML = '';
      previewsDirty();
      render();
    },
    paint: () => {
      const sp = skeletonEditor.sp,
        v = skeletonEditor.view;
      openPixelEditor(sp, v, false).then(() => {
        pixelEditor.back = () => openSkeleton(sp, v);
      });
    },
    paintPart: () => {
      const sp = skeletonEditor.sp,
        v = skeletonEditor.view;
      openPixelEditor(sp, v, false, { i: b.i, v: b.face ? 'idle' : null }).then(() => {
        pixelEditor.back = () => {
          openSkeleton(sp, v).then(() => {
            skeletonEditor.sel = b.n;
            loadSkeletonView();
          });
        };
      });
    },
    add: async () => {
      const r = await dialog(
        'New blank part',
        `<div class="grid"><label class="fld"><span>Name</span><input id="npName" value="part" maxlength="16"></label><label class="fld"><span>Width (px)</span><input id="npW" type="number" value="${Math.round(10 * meta.k)}" min="2" max="200"></label><label class="fld"><span>Height (px)</span><input id="npH" type="number" value="${Math.round(10 * meta.k)}" min="2" max="200"></label></div><p class="help">It hangs from ${esc(skeletonEditor.sel || 'the ground')}. You’ll paint it next.</p>`,
        [
          { l: 'Cancel', v: false },
          {
            l: 'Add',
            c: 'primary',
            f: () => ({
              n: $('#npName').value,
              w: clamp(+$('#npW').value || 20, 2, 200),
              h: clamp(+$('#npH').value || 20, 2, 200),
            }),
          },
        ]
      );
      if (!r) return;
      addPart(placeholderPart(r.w, r.h), { name: r.n.replace(/[^A-Za-z0-9_]/g, '') || 'part' });
      toast('Part added. Click “Paint this part” to draw it.');
    },
    addPng: async () => {
      const f = await pickFile('image/png');
      if (!f) return;
      const c = await fileToCanvas(f);
      if (c.width > 256 || c.height > 256) return toast('Keep parts under 256×256 pixels.', 'err');
      addPart(c, {
        name:
          f.name
            .replace(/\.png$/i, '')
            .replace(/[^A-Za-z0-9_]/g, '')
            .slice(0, 16) || 'part',
      });
    },
    child: () => {
      if (!b) return;
      addPart(placeholderPart(Math.round(8 * meta.k), Math.round(8 * meta.k)), {
        par: b.n,
        at: [0, -4],
        name: b.n + 'Tip',
      });
    },
    dup: () => {
      if (!b) return;
      const n = clone(b);
      n.n = uniqueBoneName(meta, b.n.replace(/\d+$/, ''));
      delete n.a;
      if (planRoles(meta.plan, meta.q).includes(b.a || b.n)) n.a = b.a || b.n;
      n.at = [+(b.at[0] + 3).toFixed(3), b.at[1]];
      meta.bones.push(n);
      sortBonesParentsFirst(meta);
      skeletonEditor.sel = n.n;
      skeletonChanged();
    },
    mirror: () => {
      if (!b) return;
      const n = mirrorPart(meta, b, b.par || 'root', new Set(meta.bones));
      sortBonesParentsFirst(meta);
      skeletonEditor.sel = n.n;
      skeletonChanged();
      toast('Mirrored copy added' + (meta.bones.some(x => x.par === n.n) ? ' with its child parts' : '') + '.');
    },
    del: async () => {
      if (!b) return;
      if (
        !(await ask(`Delete “${esc(b.n)}”? Parts hanging from it move up to ${esc(b.par || 'the ground')}.`, 'Delete'))
      )
        return;
      meta.bones
        .filter(x => x.par === b.n)
        .forEach(x => {
          x.par = b.par || 'root';
          x.at = [+(x.at[0] + b.at[0]).toFixed(3), +(x.at[1] + b.at[1]).toFixed(3)];
        });
      meta.bones = meta.bones.filter(x => x !== b);
      skeletonEditor.sel = null;
      skeletonChanged();
    },
    unshare: () => {
      if (!b) return;
      const img = meta.imgs[b.i],
        f = {};
      for (const [v, r] of Object.entries(img.f)) {
        const nr = allocRect(skeletonEditor.sp, skeletonEditor.view, r[2], r[3]);
        putPart(skeletonEditor.sp, skeletonEditor.view, nr, cutRect(skeletonEditor.sp, skeletonEditor.view, r));
        f[v] = nr;
      }
      meta.imgs.push({ ox: img.ox, oy: img.oy, f });
      b.i = meta.imgs.length - 1;
      skeletonChanged();
      toast('It has its own picture now.');
    },
    givePic: () => {
      if (!b) return;
      const src = placeholderPart(Math.round(10 * meta.k), Math.round(10 * meta.k)),
        r = allocRect(skeletonEditor.sp, skeletonEditor.view, src.width, src.height);
      putPart(skeletonEditor.sp, skeletonEditor.view, r, src);
      meta.imgs.push({ ox: -src.width / 2, oy: -src.height / 2, f: { main: r } });
      b.i = meta.imgs.length - 1;
      skeletonChanged();
    },
    replace: async () => {
      if (!b) return;
      const f = await pickFile('image/png');
      if (!f) return;
      const c = await fileToCanvas(f),
        img = meta.imgs[b.i],
        v = b.face ? 'idle' : Object.keys(img.f)[0],
        r = img.f[v];
      if (c.width <= r[2] && c.height <= r[3]) {
        const t = makeCanvas(r[2], r[3]);
        t.getContext('2d').drawImage(c, 0, 0);
        putPart(skeletonEditor.sp, skeletonEditor.view, r, t);
      } else {
        const nr = allocRect(skeletonEditor.sp, skeletonEditor.view, c.width, c.height);
        putPart(skeletonEditor.sp, skeletonEditor.view, nr, c);
        img.f[v] = nr;
      }
      skeletonChanged();
      toast('Picture replaced' + (b.face ? ' (the open-eyes expression)' : '') + '.');
    },
    resize: async () => {
      if (!b) return;
      const img = meta.imgs[b.i],
        r0 = img.f.idle || img.f.main || Object.values(img.f)[0];
      const r = await dialog(
        'Resize the picture',
        `<p class="help">The pixels stay where they are; new space is added on the right and bottom.</p><div class="grid"><label class="fld"><span>Width</span><input id="rzW" type="number" value="${r0[2]}" min="2" max="256"></label><label class="fld"><span>Height</span><input id="rzH" type="number" value="${r0[3]}" min="2" max="256"></label></div>`,
        [
          { l: 'Cancel', v: false },
          {
            l: 'Resize',
            c: 'primary',
            f: () => ({ w: clamp(+$('#rzW').value || r0[2], 2, 256), h: clamp(+$('#rzH').value || r0[3], 2, 256) }),
          },
        ]
      );
      if (!r) return;
      for (const [v, rr] of Object.entries(img.f)) {
        const src = cutRect(skeletonEditor.sp, skeletonEditor.view, rr),
          nr = allocRect(skeletonEditor.sp, skeletonEditor.view, r.w, r.h),
          t = makeCanvas(r.w, r.h);
        t.getContext('2d').drawImage(src, 0, 0);
        putPart(skeletonEditor.sp, skeletonEditor.view, nr, t);
        img.f[v] = nr;
      }
      skeletonChanged();
    },
    faces: () => {
      if (!b) return;
      const img = meta.imgs[b.i];
      if (img.f.main && !img.f.idle) {
        img.f.idle = img.f.main;
        delete img.f.main;
      }
      const r0 = img.f.idle;
      for (const v of ['blink', 'happy', 'hurt', 'shout'])
        if (!img.f[v]) {
          const nr = allocRect(skeletonEditor.sp, skeletonEditor.view, r0[2], r0[3]);
          putPart(skeletonEditor.sp, skeletonEditor.view, nr, cutRect(skeletonEditor.sp, skeletonEditor.view, r0));
          img.f[v] = nr;
        }
      b.face = 1;
      skeletonChanged();
      toast('Expression pictures added as copies. Paint the eyes and mouth for each one.');
    },
    copyView: async () => {
      const ov = skeletonEditor.view === 'front' ? 'back' : 'front',
        om = studioState.rigs[skeletonEditor.sp][ov];
      if (
        !(await ask(
          `Copy part positions, parents and tilts to the ${ov} view? Parts it doesn’t have yet are added with scaled copies of these pictures.`,
          'Copy'
        ))
      )
        return;
      for (const b2 of meta.bones) {
        let t = om.bones.find(x => x.n === b2.n);
        if (!t) {
          let i = -1;
          if (b2.i >= 0) {
            const img = meta.imgs[b2.i],
              f = {};
            for (const [v, r] of Object.entries(img.f)) {
              const s2 = scaled(cutRect(skeletonEditor.sp, skeletonEditor.view, r), om.k / meta.k),
                nr = allocRect(skeletonEditor.sp, ov, s2.width, s2.height);
              putPart(skeletonEditor.sp, ov, nr, s2);
              f[v] = nr;
            }
            om.imgs.push({ ox: Math.round((img.ox * om.k) / meta.k), oy: Math.round((img.oy * om.k) / meta.k), f });
            i = om.imgs.length - 1;
          }
          t = { n: b2.n, i, z: b2.z, zb: b2.zb };
          om.bones.push(t);
        }
        t.par = b2.par;
        t.at = b2.at.slice();
        if (b2.rr) t.rr = b2.rr;
        else delete t.rr;
        if (b2.a) t.a = b2.a;
        else delete t.a;
        if (b2.face) t.face = 1;
      }
      sortBonesParentsFirst(om);
      om.plan = meta.plan;
      om.q = clone(meta.q || {});
      skeletonChanged();
      toast(`Copied to the ${ov} view.`);
    },
  };
  const f = run[a];
  if (f) f();
}
/* ================= BLANK BODIES (new billionaires that don’t copy anyone) ================= */
const BODY_TEMPLATES = {
  biped: {
    q: { lift: 0, flapMs: 300 },
    parts: [
      ['legR', 'root', [4, -8], [9, 10], [0.5, 0.15], 1, 2, 'dark'],
      ['legL', 'root', [-4, -8], [9, 10], [0.5, 0.15], 2, 1, 'dark'],
      ['torso', 'root', [0, -5], [26, 24], [0.5, 0.92], 4, 4, 'main'],
      ['armR', 'torso', [9, -14], [7, 13], [0.5, 0.12], 1.5, 3, 'main', -0.2],
      ['armL', 'torso', [-9, -14], [7, 13], [0.5, 0.12], 6, 3.1, 'main', 0.2],
      ['tail', 'torso', [10, -4], [12, 6], [0.1, 0.5], 0, 9, 'accent'],
      ['head', 'torso', [0, -19], [24, 20], [0.5, 0.9], 7, 7, 'main', 0, 1],
    ],
  },
  quad: {
    q: {},
    parts: [
      ['body', 'root', [0, -13], [34, 18], [0.5, 0.5], 4, 4, 'main'],
      ['legBF', 'body', [9, 4], [7, 12], [0.5, 0.1], 1, 1, 'dark'],
      ['legFF', 'body', [-9, 4], [7, 12], [0.5, 0.1], 1.5, 1.5, 'dark'],
      ['legBN', 'body', [11, 5], [7, 12], [0.5, 0.1], 5, 5, 'main'],
      ['legFN', 'body', [-11, 5], [7, 12], [0.5, 0.1], 5.5, 5.5, 'main'],
      ['tail', 'body', [16, -4], [12, 6], [0.05, 0.5], 3, 9, 'accent'],
      ['head', 'body', [-15, -7], [20, 18], [0.6, 0.7], 7, 7, 'main', 0, 1],
    ],
  },
  flyer: {
    q: { lift: 16, per: 300, flapAmp: 0 },
    parts: [
      ['fly', 'root', [0, -16], null],
      ['legR', 'fly', [2, -1], [5, 8], [0.5, 0.1], 1, 1, 'dark'],
      ['legL', 'fly', [-2, -1], [5, 8], [0.5, 0.1], 2, 2, 'dark'],
      ['torso', 'fly', [0, 0], [20, 22], [0.5, 0.9], 4, 4, 'main'],
      ['wingL', 'torso', [-3, -12], [22, 12], [0.95, 0.6], 0.5, 8, 'accent'],
      ['wingR', 'torso', [3, -12], [22, 12], [0.05, 0.6], 0.4, 8, 'accent'],
      ['head', 'torso', [-1, -17], [18, 16], [0.5, 0.85], 7, 7, 'main', 0, 1],
    ],
  },
  fish: {
    q: { lift: 12, bh: 8 },
    parts: [
      ['fly', 'root', [0, -12], null],
      ['torso', 'fly', [0, 0], [30, 18], [0.5, 0.5], 4, 4, 'main', 0, 1],
      ['tail', 'torso', [13, 0], [12, 14], [0.05, 0.5], 3, 5, 'accent'],
      ['wingL', 'torso', [-2, 4], [8, 7], [0.5, 0.1], 5, 3, 'accent'],
      ['wingR', 'torso', [3, 4], [8, 7], [0.5, 0.1], 2, 6, 'accent'],
    ],
  },
  blob: {
    q: {},
    parts: [
      ['head', 'root', [0, 0], [34, 28], [0.5, 0.96], 4, 4, 'main', 0, 1],
      ['armL', 'head', [-15, -8], [7, 10], [0.5, 0.1], 6, 2, 'main', 0.4],
      ['armR', 'head', [15, -8], [7, 10], [0.5, 0.1], 6, 2, 'main', -0.4],
    ],
  },
  worm: {
    q: { n: 5 },
    parts: [
      ['s4', 'root', [16, -5], [10, 10], [0.5, 0.5], 1, 5, 'main'],
      ['s3', 'root', [10, -5], [11, 11], [0.5, 0.5], 2, 4, 'accent'],
      ['s2', 'root', [4, -6], [12, 12], [0.5, 0.5], 3, 3, 'main'],
      ['s1', 'root', [-2, -6], [12, 12], [0.5, 0.5], 4, 2, 'accent'],
      ['s0', 'root', [-8, -7], [13, 13], [0.5, 0.5], 5, 1, 'main'],
      ['head', 's0', [-5, -6], [16, 15], [0.5, 0.6], 7, 7, 'main', 0, 1],
    ],
  },
};
provide({ BODY_TEMPLATES }); /* to-module */
function blobPart(w, h, col, face, back) {
  const c = makeCanvas(w, h),
    x = c.getContext('2d'),
    d = x.createImageData(w, h),
    a = d.data,
    base = hexToRgb(col),
    dark = hexToRgb(shadeHex(col, 0.62)),
    lite = hexToRgb(shadeHex(col, 1.25)),
    ink = [42, 30, 46];
  const inside = (i, j) => {
    const u = (i + 0.5 - w / 2) / (w / 2 - 0.5),
      v = (j + 0.5 - h / 2) / (h / 2 - 0.5);
    return u * u + v * v <= 1;
  };
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (!inside(i, j)) continue;
      const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
      const t = j / h;
      const c = edge ? ink : t < 0.3 && i < w * 0.65 ? lite : t > 0.72 ? dark : base;
      const o = (j * w + i) * 4;
      a[o] = c[0];
      a[o + 1] = c[1];
      a[o + 2] = c[2];
      a[o + 3] = 255;
    }
  x.putImageData(d, 0, 0);
  if (face && !back) {
    const ex = [Math.round(w * 0.26), Math.round(w * 0.52)],
      ey = Math.round(h * 0.42),
      s = Math.max(2, Math.round(w / 12));
    x.fillStyle = '#2A1E2E';
    if (face === 'blink') ex.forEach(e => x.fillRect(e - s, ey, s * 2, 1));
    else if (face === 'happy')
      ex.forEach(e => {
        x.fillRect(e - s, ey, 1, 1);
        x.fillRect(e - s + 1, ey - 1, s * 2 - 2, 1);
        x.fillRect(e + s - 1, ey, 1, 1);
      });
    else if (face === 'hurt')
      ex.forEach((e, k) => {
        for (let q = 0; q < s; q++) {
          x.fillRect(e - s + q, ey - s / 2 + (k ? s - q : q) * 0.6, 1, 1);
        }
      });
    else
      ex.forEach(e => {
        x.fillStyle = '#FFFFFF';
        x.fillRect(e - s / 2, ey - s, s + 1, s + 2);
        x.fillStyle = '#2A1E2E';
        x.fillRect(e - s / 2 + 1, ey - s + 1, Math.max(1, s - 1), s);
        x.fillStyle = '#FFFFFF';
        x.fillRect(e - s / 2 + 1, ey - s + 1, 1, 1);
      });
    x.fillStyle = '#2A1E2E';
    if (face === 'shout') {
      x.fillRect(
        Math.round(w * 0.36),
        Math.round(h * 0.64),
        Math.max(2, Math.round(w * 0.14)),
        Math.max(2, Math.round(h * 0.14))
      );
    } else x.fillRect(Math.round(w * 0.36), Math.round(h * 0.68), Math.max(2, Math.round(w * 0.12)), 1);
  }
  return c;
}
/* build both views and all four sheets for a blank body; scale grows with evolution stage */
function makeBlankBody(id, plan, col, scale = 1) {
  const T = BODY_TEMPLATES[plan] || BODY_TEMPLATES.biped,
    cols = { main: col, dark: shadeHex(col, 0.6), accent: shadeHex(col, 1.3) },
    gcols = { main: '#D6A23A', dark: '#8E6420', accent: '#F2CE6E' },
    rig = {};
  for (const [view, k, BW, BH, cx, base] of [
    ['front', 2, 224, 208, 112, 200],
    ['back', 2.8, 314, 291, 157, 280],
  ]) {
    const parts = [],
      imgs = [],
      bones = [];
    let pk = [];
    for (const [n, par, at, box, piv, z, zb, colK, rr, face] of T.parts) {
      if (!box) {
        bones.push({ n, par, at: at.map(v => +(v * scale).toFixed(3)), i: -1 });
        continue;
      }
      const w = Math.max(3, Math.round(box[0] * k * scale)),
        h = Math.max(3, Math.round(box[1] * k * scale)),
        vs = face ? ['idle', 'blink', 'happy', 'hurt', 'shout'] : ['main'];
      const f = {};
      vs.forEach(v => {
        const c = blobPart(w, h, cols[colK] || col, face ? v : null, view === 'back'),
          g = blobPart(w, h, gcols[colK] || gcols.main, face ? v : null, view === 'back');
        pk.push({ c, g, w, h, ref: [f, v] });
      });
      imgs.push({ ox: -Math.round(piv[0] * w), oy: -Math.round(piv[1] * h), f });
      const b = { n, par, at: at.map(v => +(v * scale).toFixed(3)), z, zb, i: imgs.length - 1 };
      if (rr) b.rr = rr;
      if (face) b.face = 1;
      bones.push(b);
    }
    let x = 1,
      y = 1,
      rowH = 0;
    const W = 256;
    pk.forEach(p => {
      if (x + p.w + 1 > W) {
        x = 1;
        y += rowH + 1;
        rowH = 0;
      }
      p.x = x;
      p.y = y;
      x += p.w + 1;
      rowH = Math.max(rowH, p.h);
    });
    const Hh = y + rowH + 1,
      sheet = makeCanvas(W, Hh),
      sx = sheet.getContext('2d'),
      gold = makeCanvas(W, Hh),
      gx = gold.getContext('2d');
    pk.forEach(p => {
      sx.drawImage(p.c, p.x, p.y);
      gx.drawImage(p.g, p.x, p.y);
      p.ref[0][p.ref[1]] = [p.x, p.y, p.w, p.h];
    });
    rig[view] = { k, BW, BH, cx, base, tipX: 0, plan, q: clone(T.q), geo: {}, size: [W, Hh], imgs, bones };
    markArt(atlasPath(id, view, false), sheet);
    markArt(atlasPath(id, view, true), gold);
  }
  studioState.rigs[id] = rig;
  studioState.rigVer = (studioState.rigVer || 0) + 1;
  skeletonFraming(id);
}

/* ---------- v35: a piece sheet in, as parts ----------
   One PNG with every piece of a billionaire and a layout JSON beside it:
   {"w":96,"h":96,"pieces":[{"n":"head","x":0,"y":0,"w":40,"h":36,"px":28,"py":4,"par":"torso","group":"front"|"back",
     "face":"idle"|"blink"|"happy"|"hurt" (face pieces go onto the head as its face variants), "pivot":[20,34]}]}
   px,py = where the piece sits on the canvas at rest (so the rig can be built from it); par = the part it hangs from. */
async function importPieceSheet() {
  const png = await pickFile('image/png');
  if (!png) return;
  const json = await pickFile('application/json,.json');
  if (!json) return;
  let lay;
  try {
    lay = JSON.parse(await json.text());
  } catch (e) {
    toast('The layout file is not JSON.', 'err');
    return;
  }
  const im = await loadImage(URL.createObjectURL(png));
  const view = skeletonEditor.view,
    group = view;
  const L = (lay.pieces || []).filter(p => (p.group || 'front') === group && !p.face);
  if (!L.length) {
    toast('No pieces for the ' + view + ' view in that layout.', 'err');
    return;
  }
  const meta = skeletonMeta();
  if (
    meta.bones.length &&
    !(await ask(
      `Replace the ${meta.bones.length} parts of the ${view} view with the ${L.length} pieces from the sheet?`,
      'Replace',
      'Keep'
    ))
  )
    return;
  meta.bones = [];
  meta.imgs = [];
  skeletonEditor.sel = null;
  const faces = (lay.pieces || []).filter(p => p.face && (p.group || 'front') === group);
  const order = [];
  const seen = new Set();
  const put = p => {
    if (seen.has(p.n)) return;
    const par = L.find(q => q.n === p.par);
    if (par) put(par);
    seen.add(p.n);
    order.push(p);
  };
  L.forEach(put);
  for (const p of order) {
    const c = makeCanvas(p.w, p.h);
    c.getContext('2d').drawImage(im, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h);
    const opts = {
      name: p.n,
      par: p.par && seen.has(p.par) ? p.par : 'root',
      at: [(p.px ?? 0) + (p.pivot ? p.pivot[0] : p.w / 2), (p.py ?? 0) + (p.pivot ? p.pivot[1] : p.h / 2)],
      ox: -(p.pivot ? p.pivot[0] : p.w / 2),
      oy: -(p.pivot ? p.pivot[1] : p.h / 2),
    };
    const vars = {};
    if (p.n === 'head')
      for (const f of faces) {
        const fc = makeCanvas(p.w, p.h),
          fx = fc.getContext('2d');
        fx.drawImage(c, 0, 0);
        fx.drawImage(
          im,
          f.x,
          f.y,
          f.w,
          f.h,
          (f.px ?? p.px ?? 0) - (p.px ?? 0),
          (f.py ?? p.py ?? 0) - (p.py ?? 0),
          f.w,
          f.h
        );
        vars[f.face] = fc;
      }
    skeletonEditor.sel = opts.par === 'root' ? null : opts.par;
    opts.abs = true;
    spriteCacheClear();
    addPart(c, Object.assign(opts, Object.keys(vars).length ? { faces: vars } : {}));
  }
  if (lay.w && lay.h) {
    meta.BW = lay.w;
    meta.BH = lay.h;
    meta.cx = lay.cx ?? lay.w / 2;
    meta.base = lay.base ?? lay.h - 2;
  }
  skeletonChanged();
  toast(`${order.length} pieces imported as parts${faces.length ? ' with ' + faces.length + ' face pieces' : ''}.`);
}
