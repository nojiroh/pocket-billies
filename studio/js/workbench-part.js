'use strict';
/* ================= POCKET BILLIES STUDIO · Art workbench, Part mode (studio track ST-4) =================
   A kit part's joints, its front and back side by side on the shared pixel canvas: the pivot crosshair and the
   labelled sockets (drag them, or pick one and nudge it with the arrow keys; Shift for a quarter pixel), the slots
   each socket takes, how far the part turns, its draw order per view, a test fit onto a body (turn it through its
   limits), Mirror to other side (a copy <id>_r, pictures flipped and sockets swapped), and S and L: M scaled about the
   pivot, or a hand-painted picture beside M (<id>_s.png, <id>_l.png). The numbers are in
   game/js/logic/part-joints.js; the parts are in partKits.json (Sheet mode writes them). Every change is one step of
   the Studio's undo.
   Studio track ST-5: the Robots source shows robots.json the same way (logic/robot-joints.js robotKit): each part's
   pictures with the points the game joins them at (stored, else worked out from the picture), a torso's sockets by
   the socket standard, the test fit on a torso. Moving a point stores it in the part's art.joints (a head's in its
   torso's art.headJoints), in whole pixels; Back to computed drops a view's stored points. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { robotFrac, robotJointSet, robotKit, robotKitPart, robotPx } from '../../game/js/logic/robot-joints.js';
import { setRobotRigData } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelFlip } from '../../game/js/logic/pixel-ops.js';
import {
  PART_ATTACH,
  partAccepts,
  partClampTurn,
  partDrawBounds,
  partDrawnSide,
  partFit,
  partJoint,
  partMirror,
  partMirrorId,
  partScaledPixels,
  partSizeScale,
  partSocketsFor,
  partTurn,
  partZ,
} from '../../game/js/logic/part-joints.js';
import {
  ACTIONS,
  afterRender,
  ask,
  changed,
  commit,
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
  pixelCanvasColor,
  pixelCanvasFit,
  pixelCanvasPointF,
  pixelCanvasTool,
  pixelCanvasZoom,
} from './pixel-canvas.js';
import { atlasGet, loadedAtlas, markArt } from './sprites.js';
import { WB_VIEWS, wbKits, wbPixelsCanvas, wbSamePicture, workbench } from './workbench.js';
/* eslint-disable no-func-assign */
expose({
  WBP_COLORS: [() => WBP_COLORS],
  WBP_ROBOT_KINDS: [() => WBP_ROBOT_KINDS],
  WBP_SIZES: [() => WBP_SIZES],
  WBP_SLOTS: [() => WBP_SLOTS],
  wbPart: [() => wbPart],
  wbPartSection: [() => wbPartSection, v => ((wbPartSection = v), provide({ wbPartSection }))],
  wbpAttach: [() => wbpAttach],
  wbpBodies: [() => wbpBodies, v => (wbpBodies = v)],
  wbpBodySlot: [() => wbpBodySlot],
  wbpColor: [() => wbpColor],
  wbpDrawFit: [() => wbpDrawFit, v => (wbpDrawFit = v)],
  wbpEditable: [() => wbpEditable],
  wbpEntry: [() => wbpEntry],
  wbpFitBody: [() => wbpFitBody, v => (wbpFitBody = v)],
  wbpFitHTML: [() => wbpFitHTML, v => (wbpFitHTML = v)],
  wbpFitPart: [() => wbpFitPart, v => (wbpFitPart = v)],
  wbpFitSockets: [() => wbpFitSockets, v => (wbpFitSockets = v)],
  wbpHand: [() => wbpHand, v => (wbpHand = v)],
  wbpHost: [() => wbpHost, v => (wbpHost = v)],
  wbpInput: [() => wbpInput, v => (wbpInput = v)],
  wbpIsBody: [() => wbpIsBody],
  wbpJoint: [() => wbpJoint],
  wbpKeys: [() => wbpKeys, v => (wbpKeys = v)],
  wbpKits: [() => wbpKits],
  wbpList: [() => wbpList, v => (wbpList = v)],
  wbpListHTML: [() => wbpListHTML, v => (wbpListHTML = v)],
  wbpLoad: [() => wbpLoad, v => (wbpLoad = v)],
  wbpMount: [() => wbpMount, v => (wbpMount = v)],
  wbpN: [() => wbpN],
  wbpOverlay: [() => wbpOverlay, v => (wbpOverlay = v)],
  wbpPath: [() => wbpPath],
  wbpPicSize: [() => wbpPicSize],
  wbpPicture: [() => wbpPicture, v => (wbpPicture = v)],
  wbpRedraw: [() => wbpRedraw, v => (wbpRedraw = v)],
  wbpRefreshSide: [() => wbpRefreshSide, v => (wbpRefreshSide = v)],
  wbpRobotData: [() => wbpRobotData],
  wbpRobotDone: [() => wbpRobotDone, v => (wbpRobotDone = v)],
  wbpRobotFiles: [() => wbpRobotFiles],
  wbpRobotSet: [() => wbpRobotSet, v => (wbpRobotSet = v)],
  wbpRobotSideHTML: [() => wbpRobotSideHTML, v => (wbpRobotSideHTML = v)],
  wbpRobotStore: [() => wbpRobotStore, v => (wbpRobotStore = v)],
  wbpRobots: [() => wbpRobots],
  wbpRoot: [() => wbpRoot],
  wbpRound: [() => wbpRound],
  wbpRules: [() => wbpRules],
  wbpSetPoint: [() => wbpSetPoint, v => (wbpSetPoint = v)],
  wbpSideHTML: [() => wbpSideHTML, v => (wbpSideHTML = v)],
  wbpSizeOf: [() => wbpSizeOf],
  wbpSockRename: [() => wbpSockRename, v => (wbpSockRename = v)],
  wbpSwing: [() => wbpSwing, v => (wbpSwing = v)],
  wbpThumb: [() => wbpThumb, v => (wbpThumb = v)],
  wbpToolsHTML: [() => wbpToolsHTML, v => (wbpToolsHTML = v)],
  wbpViewsHTML: [() => wbpViewsHTML, v => (wbpViewsHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ wbPartSection });
/* to-module: end */
const WBP_SIZES = ['S', 'M', 'L'];
const WBP_SLOTS = ['head', 'head-extra', 'body', 'body-extra', 'front', 'back', 'signature'];
/* one colour per socket name, the same in both views */
const WBP_COLORS = ['#c8323c', '#1f6e6f', '#6a3fb5', '#c77a12', '#2f7d32', '#b23a8a', '#2b5fb8', '#7a5c2e'];
export const wbPart = {
  src: 'kits' /* or 'robots' (studio track ST-5) */,
  id: '',
  kit: '' /* the list's filters */,
  kind: '',
  q: '',
  size: 'M',
  sel: null /* the handle picked: { view, h } (h 'pivot' or a socket name) */,
  tool: 'part' /* 'part' moves points; the paint tools paint a hand-painted S or L */,
  color: '#2A1E2E',
  fit: { other: '', socket: '', angle: 0, swing: false },
  zoom: { front: 0, back: 0 },
  pcs: {} /* the canvas of each view */,
  scaled: new Map() /* M scaled to S or L, by path, size and version */,
};
/* ---------- the source: the kits, or robots.json shown as a kit (its points the ones the game draws) ---------- */
const wbpRobots = () => wbPart.src === 'robots';
const wbpRobotData = () => studioState.D.robots || { parts: {}, gems: {} };
const wbpPicSize = file => {
  const c = loadedAtlas(wbpPath(file));
  return c ? [c.width, c.height] : null;
};
/* the pane Part mode is in: paneRoot() is that pane only while it is drawn, and Part mode looks things up later too
   (after loading pictures, on a drag, a key or an input), when it may be the second pane */
const wbpRoot = () => document.querySelector('.wbp')?.closest('#main, #main2') || paneRoot();
const wbpKits = () => (wbpRobots() ? robotKit(wbpRobotData(), wbpPicSize) : wbKits());
const WBP_ROBOT_KINDS = ['torso', 'head', 'arm', 'legs', 'gem'];
/* every picture robots.json names */
const wbpRobotFiles = () => {
  const D = wbpRobotData(),
    f = [
      ...Object.values(D.parts || {}).flatMap(P => [P.art.img, P.art.imgB, P.art.head, P.art.headB]),
      ...Object.values(D.gems || {}).map(G => G.img),
    ];
  return [...new Set(f.filter(Boolean))];
};
/* where a robot kit part's points are stored: its robots.json art, under joints (a head: its torso's headJoints);
   null for a gem (it sits on its centre) */
function wbpRobotStore(id = wbPart.id) {
  const R = robotKitPart(wbpRobotData(), id);
  return R && { art: R.part.art, key: R.head ? 'headJoints' : 'joints', turn: R.head ? 'headTurn' : 'turn' };
}
/* sets (or with null drops) one stored point or draw order of a view */
function wbpRobotSet(view, key, value) {
  const S = wbpRobotStore();
  if (!S) return;
  const J = robotJointSet(S.art[S.key], view, key, value);
  if (J) S.art[S.key] = J;
  else delete S.art[S.key];
}
/* after a robot edit: one undo step, and every robot is drawn again (the battle preview, the Robots section) */
function wbpRobotDone() {
  setRobotRigData(wbpRobotData());
  changed();
  commit(true);
}
const wbpEntry = (id = wbPart.id) => wbpKits().parts?.[id] || null;
const wbpRules = () => studioState.D.rules;
const wbpJoint = (view, id = wbPart.id, size = wbPart.size) => partJoint(wbpKits(), id, view, size, wbpRules());
const wbpColor = name =>
  WBP_COLORS[[...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % WBP_COLORS.length];
const wbpSizeOf = (view, size = wbPart.size) => wbpEntry()?.views[view]?.sizes?.[size] || null;
/* the parts the list shows, by kit, kind and a search */
function wbpList() {
  const q = wbPart.q.toLowerCase();
  return Object.entries(wbpKits().parts || {})
    .filter(
      ([id, P]) =>
        !P.hidden &&
        (!wbPart.kit || wbpRobots() || P.kit === wbPart.kit) &&
        (!wbPart.kind || P.kind === wbPart.kind) &&
        (!q || id.includes(q) || P.animal.includes(q))
    )
    .map(([id]) => id);
}
/* ---------- pictures: M and painted sizes from the art, other sizes M scaled (made here, not saved) ---------- */
const wbpPath = file => 'art/' + file;
function wbpPicture(view) {
  const j = wbpJoint(view);
  if (!j) return null;
  const c = loadedAtlas(wbpPath(j.file));
  if (!c || j.painted || wbPart.size === 'M') return c || null;
  const key = `${j.file}:${wbPart.size}:${c._ver || 0}`;
  if (!wbPart.scaled.has(key)) {
    const im = partScaledPixels(pictureImage(c), j.scale);
    wbPart.scaled.set(key, wbPixelsCanvas(im));
  }
  return wbPart.scaled.get(key);
}
/* every picture the part and the test fit need, loaded before they are drawn */
async function wbpLoad() {
  if (wbpRobots()) {
    await Promise.all(wbpRobotFiles().map(f => atlasGet(wbpPath(f)).catch(() => null)));
    wbPart.robotsLoaded = wbpRobotFiles().join();
    return;
  }
  const K = wbpKits(),
    files = new Set();
  for (const id of [
    wbPart.id,
    wbpFitBody(),
    wbpFitPart(),
    ...Object.keys(K.parts).filter(k => k === wbPart.id + '_r'),
  ]) {
    const P = id && K.parts[id];
    if (!P) continue;
    for (const V of Object.values(P.views)) {
      files.add(V.file);
      for (const S of Object.values(V.sizes || {})) files.add(S.file);
    }
  }
  await Promise.all([...files].map(f => atlasGet(wbpPath(f)).catch(() => null)));
}
/* ---------- the section ---------- */
function wbpListHTML() {
  const K = wbpKits(),
    robots = wbpRobots(),
    kits = Object.keys(K.kits || {}),
    kinds = robots ? WBP_ROBOT_KINDS : Object.keys(K.slots || {}),
    ids = wbpList();
  const opt = (v, n, on) => `<option value="${escapeHtml(v)}" ${on ? 'selected' : ''}>${escapeHtml(n)}</option>`;
  const src = `<div class="seg-row wbp-src">${[
    ['kits', 'Kits', 'partKits.json: the phase 16 kit parts'],
    ['robots', 'Robots', 'robots.json: robot parts, heads and gems'],
  ]
    .map(
      ([k, n, t]) =>
        `<button class="seg ${k === wbPart.src ? 'on' : ''}" data-act="wbpSrc" data-s="${k}" title="${t}">${n}</button>`
    )
    .join('')}</div>`;
  return `${src}<div class="wbp-filter">${robots ? '' : `<select data-wbp="kit">${opt('', 'Every kit', !wbPart.kit)}${kits.map(k => opt(k, k, k === wbPart.kit)).join('')}</select>`}<select data-wbp="kind">${opt('', 'Every kind', !wbPart.kind)}${kinds.map(k => opt(k, k, k === wbPart.kind)).join('')}</select><input type="search" data-wbp="q" placeholder="Find a part" value="${escapeHtml(wbPart.q)}"></div><div class="wb-parts-h"><span>Front</span><span>Back</span><span>${ids.length} part${ids.length === 1 ? '' : 's'}</span></div><div class="wb-partlist">${
    ids
      .map(id => {
        const P = K.parts[id];
        return `<div class="wb-part ${id === wbPart.id ? 'on' : ''}" data-act="wbpPick" data-id="${escapeHtml(id)}">${WB_VIEWS.map(v => `<span class="wb-thumb">${P.views[v] ? `<img src="${escapeHtml(wbpThumb(P.views[v].file))}" alt="">` : '<i>—</i>'}</span>`).join('')}<span class="wb-pid"><b class="mono">${escapeHtml(id)}</b><small>${robots ? `${escapeHtml(P.kind)} · ${escapeHtml(P.robot)}` : `${escapeHtml(P.kind)} · ${escapeHtml(P.slot)}${P.mirrorOf ? ' · mirrored' : ''}`}</small></span></div>`;
      })
      .join('') ||
    (robots
      ? '<p class="help">No robot pictures (Robots section: a part’s Pictures).</p>'
      : '<p class="help">No parts. Write some in Sheet mode first.</p>')
  }</div>`;
}
/* a thumbnail: the picture as the Studio has it now (changed and unsaved ones too) */
function wbpThumb(file) {
  const c = loadedAtlas(wbpPath(file));
  if (c)
    try {
      return c.toDataURL();
    } catch (e) {}
  return '../game/' + wbpPath(file);
}
function wbpToolsHTML() {
  if (wbpRobots())
    return `<div class="seg-row wb-tools"><span class="px-tools"><button class="seg" data-act="wbpZoom" data-z="-1" title="Zoom out">−</button><span id="wbpZoom"></span><button class="seg" data-act="wbpZoom" data-z="1" title="Zoom in">+</button><button class="seg" data-act="wbpZoom" data-z="0" title="Fit">Fit</button></span><span class="help wbp-hint">Drag the crosshair (pivot) or a socket; arrows nudge the one picked a pixel.</span></div>`;
  const painted = WB_VIEWS.some(v => wbpSizeOf(v)),
    T = [
      ['part', 'Points'],
      ['pen', 'Pencil'],
      ['erase', 'Eraser'],
      ['fill', 'Fill'],
      ['pick', 'Pick'],
    ];
  return `<div class="seg-row wb-tools"><span class="px-tools">${WBP_SIZES.map(s => `<button class="seg ${s === wbPart.size ? 'on' : ''}" data-act="wbpSize" data-s="${s}" title="${s === 'M' ? 'M: as drawn' : `${s}: ${wbpSizeOf('front', s) || wbpSizeOf('back', s) ? 'hand-painted' : 'M scaled'}`}">${s}</button>`).join('')}</span><span class="px-tools"><button class="seg" data-act="wbpZoom" data-z="-1" title="Zoom out">−</button><span id="wbpZoom"></span><button class="seg" data-act="wbpZoom" data-z="1" title="Zoom in">+</button><button class="seg" data-act="wbpZoom" data-z="0" title="Fit">Fit</button></span>${
    painted
      ? `<span class="px-tools">${T.map(([k, n]) => `<button class="seg ${k === wbPart.tool ? 'on' : ''}" data-act="wbpTool" data-t="${k}">${n}</button>`).join('')}<input type="color" data-wbp="color" value="${escapeHtml(wbPart.color.toLowerCase())}" title="Colour"></span>`
      : ''
  }<span class="help wbp-hint">Drag the crosshair (pivot) or a socket; arrows nudge the one picked (Shift: ¼ px).</span></div>`;
}
function wbpViewsHTML() {
  return `<div class="wbp-views">${WB_VIEWS.map(v => {
    const j = wbpJoint(v),
      S = wbpSizeOf(v);
    return `<div class="wbp-view"><h4>${v === 'front' ? 'Front' : 'Back'} <small>${j ? `${j.w} × ${j.h}${wbPart.size === 'M' ? '' : S ? ' · hand-painted' : ' · M scaled'}` : 'no picture'}</small></h4>${j ? `<div class="px-stage wbp-stage" id="wbp${v}Stage"></div>` : '<p class="help">This part has no picture for this view.</p>'}</div>`;
  }).join('')}</div>`;
}
/* ---------- the inspector ---------- */
const wbpN = v => (Math.round(v * 1000) / 1000).toString();
function wbpSideHTML() {
  if (wbpRobots()) return wbpRobotSideHTML();
  const P = wbpEntry(),
    K = wbpKits();
  if (!P) return '<div class="px-sec"><p class="help">Pick a part on the left.</p></div>';
  const id = wbPart.id,
    turn = partTurn(K, id),
    own = !!P.turn;
  const head = `<div class="px-sec"><h4 class="mono">${escapeHtml(id)}</h4><p class="help">${escapeHtml(P.kind)} · slot ${escapeHtml(P.slot)} · kit ${escapeHtml(P.kit)} · ${escapeHtml(P.animal)}${P.mirrorOf ? ` · the other side of <b class="mono">${escapeHtml(P.mirrorOf)}</b>` : ''}. Drawn for the ${partDrawnSide(K, id) === 'L' ? 'left' : 'right'} side.</p></div>`;
  const pivot = `<div class="px-sec"><h4>Pivot</h4>${WB_VIEWS.filter(v => P.views[v])
    .map(v => {
      const j = wbpJoint(v),
        S = wbpSizeOf(v),
        set = wbPart.size === 'M' ? P.views[v].pivot : S && S.pivot;
      return `<div class="wbp-row ${wbPart.sel && wbPart.sel.view === v && wbPart.sel.h === 'pivot' ? 'on' : ''}"><span class="wbp-name">${v}</span><input type="number" step="0.01" data-wbp="pivot" data-v="${v}" data-i="0" value="${wbpN(j.pivot[0])}" ${wbpEditable(v) ? '' : 'disabled'}><input type="number" step="0.01" data-wbp="pivot" data-v="${v}" data-i="1" value="${wbpN(j.pivot[1])}" ${wbpEditable(v) ? '' : 'disabled'}>${set ? `<button class="btn sm subtle" data-act="wbpPivotReset" data-v="${v}" title="Back to its joint socket (or the part's pivot)">↺</button>` : `<small class="help">${wbpAttach(j)}</small>`}</div>`;
    })
    .join(
      ''
    )}<p class="help">Fractions of the picture, x right, y down. Each view has its own; until moved it is the joint (a limb), chin (a head) or base (a tail) socket, else the part’s pivot.</p></div>`;
  const names = [...new Set(WB_VIEWS.flatMap(v => Object.keys(wbpJoint(v)?.sockets || {})))];
  const sockets = `<div class="px-sec"><h4>Sockets</h4>${
    names
      .map(n => {
        const acc = partAccepts(K, id, n),
          mine = !!P.accepts?.[n];
        return `<div class="wbp-sock ${wbPart.sel && wbPart.sel.h === n ? 'on' : ''}"><div class="wbp-row"><i class="wbp-dot" style="background:${wbpColor(n)}"></i><input type="text" class="mono" data-wbp="rename" data-n="${escapeHtml(n)}" value="${escapeHtml(n)}" ${wbPart.size === 'M' ? '' : 'disabled'}>${WB_VIEWS.map(
          v => {
            const p = wbpJoint(v)?.sockets[n];
            return `<small class="mono" title="${v}">${p ? `${wbpN(p[0])}, ${wbpN(p[1])}` : '—'}</small>`;
          }
        ).join(
          ''
        )}<button class="btn sm subtle" data-act="wbpSockDel" data-n="${escapeHtml(n)}" title="Remove this socket" ${wbPart.size === 'M' ? '' : 'disabled'}>✕</button></div><div class="wbp-slots" title="The slots that may attach here${mine ? ' (this part’s own rule)' : ' (the kit’s rule for this name)'}">${WBP_SLOTS.map(s => `<button class="seg sm ${acc.includes(s) ? 'on' : ''}" data-act="wbpAccept" data-n="${escapeHtml(n)}" data-s="${s}">${s}</button>`).join('')}${mine ? `<button class="btn sm subtle" data-act="wbpAcceptReset" data-n="${escapeHtml(n)}" title="Back to the kit’s rule for ${escapeHtml(n)}">↺</button>` : ''}</div></div>`;
      })
      .join('') || '<p class="help">No sockets.</p>'
  }${wbPart.size === 'M' ? `<div class="wbp-row"><input type="text" class="mono" id="wbpNewSock" placeholder="new socket name"><button class="btn sm" data-act="wbpSockAdd">Add</button></div><p class="help">A new socket starts on the pivot in both views. A name ending in L or R is on that side; Mirror swaps them.</p>` : '<p class="help">Sockets are added and named at M; a hand-painted size places its own.</p>'}</div>`;
  const joint = `<div class="px-sec"><h4>Turn and draw order</h4><div class="wbp-row"><span class="wbp-name">turns</span><input type="number" step="1" data-wbp="turn" data-i="0" value="${turn[0]}" title="Least (degrees)"><input type="number" step="1" data-wbp="turn" data-i="1" value="${turn[1]}" title="Most (degrees)">${own ? `<button class="btn sm subtle" data-act="wbpTurnReset" title="Back to the ${escapeHtml(P.kind)} default">↺</button>` : '<small class="help">kind’s</small>'}</div><div class="wbp-row"><span class="wbp-name">z</span>${WB_VIEWS.map(v => `<label class="wbp-z">${v}<input type="number" step="1" data-wbp="z" data-v="${v}" value="${partZ(K, id, v)}"></label>`).join('')}${P.z ? `<button class="btn sm subtle" data-act="wbpZReset" title="Back to the ${escapeHtml(P.kind)} default">↺</button>` : '<small class="help">kind’s</small>'}</div><p class="help">Degrees about the pivot, clockwise positive. Higher z is drawn in front; from behind, arms go under the body.</p></div>`;
  const sizes = `<div class="px-sec"><h4>Sizes</h4>${['S', 'L']
    .map(s => {
      const has = WB_VIEWS.some(v => wbpSizeOf(v, s));
      return `<div class="wbp-row"><span class="wbp-name">${s}</span><small class="help">${has ? 'hand-painted' : `M at ${Math.round(partSizeScale(s, wbpRules()) * 100)}%`}</small>${has ? `<button class="btn sm" data-act="wbpSizeDrop" data-s="${s}">Back to scaled</button>` : `<button class="btn sm" data-act="wbpPaint" data-s="${s}">Paint ${s}</button>`}</div>`;
    })
    .join(
      ''
    )}<p class="help">Paint starts from M scaled, saved beside it (${escapeHtml(id)}_s.png, _l.png). Points then belong to that size.</p></div>`;
  const mirror = `<div class="px-sec"><h4>Other side</h4><button class="btn" data-act="wbpMirror">Mirror to other side</button><p class="help">Makes <b class="mono">${escapeHtml(partMirrorId(K, id))}</b>: the pictures flipped, sockets swapped (shoulderL ↔ shoulderR), so that side can be repainted. Without it the part is mirrored when drawn.</p></div>`;
  return head + pivot + sockets + joint + sizes + mirror;
}
/* a robot part's inspector: its points per view (stored or computed), turn and draw order */
function wbpRobotSideHTML() {
  const P = wbpEntry(),
    K = wbpKits(),
    id = wbPart.id;
  if (!P) return '<div class="px-sec"><p class="help">Pick a part on the left.</p></div>';
  const S = wbpRobotStore(),
    stored = (S && S.art[S.key]) || {},
    head = id.endsWith(':head'),
    where = S
      ? `robots.json → parts → <b class="mono">${escapeHtml(P.robot)}</b> → art.${S.key}`
      : `robots.json → gems → <b class="mono">${escapeHtml(P.robot)}</b>`;
  const top = `<div class="px-sec"><h4 class="mono">${escapeHtml(id)}</h4><p class="help">${escapeHtml(head ? 'the head of a torso' : P.kind)} · ${where}. Drawn the same on both sides (not mirrored).${S ? '' : ' A gem sits on its centre in the chest’s gem socket; it has nothing to store.'}</p></div>`;
  const views = WB_VIEWS.filter(v => P.views[v])
    .map(v => {
      const j = wbpJoint(v),
        own = stored[v] || {},
        dis = S ? '' : 'disabled',
        socks = Object.entries(j.sockets)
          .map(
            ([n, p]) =>
              `<div class="wbp-row ${wbPart.sel && wbPart.sel.view === v && wbPart.sel.h === n ? 'on' : ''}"><i class="wbp-dot" style="background:${wbpColor(n)}"></i><span class="wbp-name mono">${escapeHtml(n)}</span><small class="mono">${wbpN(p[0])}, ${wbpN(p[1])}</small><small class="help">→ ${escapeHtml(partAccepts(K, id, n).join(', '))}${own.sockets?.[n] ? ' · set' : ''}</small></div>`
          )
          .join('');
      return `<div class="px-sec"><h4>${v === 'front' ? 'Front' : 'Back'} <small>${stored[v] ? 'stored' : 'computed'} · ${j.w} × ${j.h}</small></h4><div class="wbp-row ${wbPart.sel && wbPart.sel.view === v && wbPart.sel.h === 'pivot' ? 'on' : ''}"><span class="wbp-name">pivot</span><input type="number" step="0.01" data-wbp="pivot" data-v="${v}" data-i="0" value="${wbpN(j.pivot[0])}" ${dis}><input type="number" step="0.01" data-wbp="pivot" data-v="${v}" data-i="1" value="${wbpN(j.pivot[1])}" ${dis}>${own.pivot ? `<button class="btn sm subtle" data-act="wbpPivotReset" data-v="${v}" title="Back to computed">↺</button>` : ''}</div>${socks}${stored[v] ? `<button class="btn sm" data-act="wbpRobotReset" data-v="${v}">Back to computed</button>` : ''}</div>`;
    })
    .join('');
  const turn = partTurn(K, id),
    zOwn = WB_VIEWS.some(v => stored[v]?.z != null);
  const joint = S
    ? `<div class="px-sec"><h4>Turn and draw order</h4><div class="wbp-row"><span class="wbp-name">turns</span><input type="number" step="1" data-wbp="turn" data-i="0" value="${turn[0]}" title="Least (degrees)"><input type="number" step="1" data-wbp="turn" data-i="1" value="${turn[1]}" title="Most (degrees)">${S.art[S.turn] ? `<button class="btn sm subtle" data-act="wbpTurnReset" title="Back to free">↺</button>` : '<small class="help">free</small>'}</div><div class="wbp-row"><span class="wbp-name">z</span>${WB_VIEWS.filter(
        v => P.views[v]
      )
        .map(
          v =>
            `<label class="wbp-z">${v}<input type="number" step="1" data-wbp="z" data-v="${v}" value="${partZ(K, id, v)}"></label>`
        )
        .join(
          ''
        )}${zOwn ? `<button class="btn sm subtle" data-act="wbpZReset" title="Back to the ${escapeHtml(P.kind)} default">↺</button>` : '<small class="help">default</small>'}</div><p class="help">Turn limits are for the test fit (the game’s poses don’t read them yet). Higher z is drawn in front; from behind, arms go under the body.</p></div>`
    : '';
  return (
    top +
    views +
    joint +
    `<div class="px-sec"><p class="help">Points are fractions of the picture, stored in whole pixels. A back point not stored keeps the front’s offset from the pivot. Stand-ins (a part without a picture) always use computed points.</p></div>`
  );
}
/* where an unmoved pivot comes from */
const wbpAttach = j => {
  const by = PART_ATTACH.find(n => j.sockets[n]);
  return by ? `at ${by}` : 'the part’s';
};
/* the points of a view can be moved: at M, or on a hand-painted size; a robot part's, except a gem's */
const wbpEditable = view => (wbpRobots() ? !!wbpRobotStore() : wbPart.size === 'M' || !!wbpSizeOf(view));
/* ---------- test fit ---------- */
const wbpBodySlot = () => (wbpRobots() ? 'torso' : 'body');
const wbpIsBody = () => wbpEntry()?.slot === wbpBodySlot();
function wbpBodies() {
  return Object.entries(wbpKits().parts || {})
    .filter(([, P]) => P.slot === wbpBodySlot())
    .map(([id]) => id);
}
/* the body in the test fit: the part itself, or the one picked (the same animal's torso first) */
function wbpFitBody() {
  if (!wbPart.id) return '';
  if (wbpIsBody()) return wbPart.id;
  const B = wbpBodies(),
    P = wbpEntry();
  if (B.includes(wbPart.fit.other)) return wbPart.fit.other;
  return (
    B.find(b => b === P.robot) ||
    B.find(b => wbpKits().parts[b].animal === P.animal) ||
    B.find(b => wbpKits().parts[b].kit === P.kit) ||
    B[0] ||
    ''
  );
}
/* the part in the test fit: this one, or (for a body) the one picked */
function wbpFitPart() {
  if (!wbpIsBody()) return wbPart.id;
  const K = wbpKits(),
    o = wbPart.fit.other;
  return o && K.parts[o] && K.parts[o].slot !== wbpBodySlot() && !K.parts[o].hidden ? o : '';
}
function wbpFitSockets() {
  const b = wbpFitBody(),
    p = wbpFitPart();
  if (!b || !p) return [];
  return [...new Set(WB_VIEWS.flatMap(v => partSocketsFor(wbpKits(), b, p, v)))];
}
function wbpFitHTML() {
  if (!wbPart.id) return '';
  const K = wbpKits(),
    body = wbpIsBody(),
    choices = body
      ? Object.keys(K.parts).filter(k => K.parts[k].slot !== wbpBodySlot() && !K.parts[k].hidden && k !== wbPart.id)
      : wbpBodies(),
    pick = body ? wbpFitPart() : wbpFitBody(),
    socks = wbpFitSockets(),
    sock = socks.includes(wbPart.fit.socket) ? wbPart.fit.socket : socks[0] || '',
    t = partTurn(K, wbpFitPart() || wbPart.id);
  return `<div class="wbp-fit"><div class="seg-row"><b>Test fit</b><label>${body ? 'Part' : 'On body'} <select data-wbp="fitOther"><option value="">${body ? '— pick a part —' : '—'}</option>${choices.map(k => `<option ${k === pick ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}</select></label><label>at <select data-wbp="fitSocket">${socks.map(s => `<option ${s === sock ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('') || '<option value="">no socket takes it</option>'}</select></label><label>turn <input type="range" data-wbp="fitAngle" min="${t[0]}" max="${t[1]}" step="1" value="${partClampTurn(K, wbpFitPart() || wbPart.id, wbPart.fit.angle)}"><span id="wbpAngle">${partClampTurn(K, wbpFitPart() || wbPart.id, wbPart.fit.angle)}°</span></label><label class="chk"><input type="checkbox" data-wbp="fitSwing" ${wbPart.fit.swing ? 'checked' : ''}> Swing</label></div><div class="wbp-fitviews">${WB_VIEWS.map(v => `<figure><canvas id="wbpFit${v}"></canvas><figcaption>${v}</figcaption></figure>`).join('')}</div></div>`;
}
/* the test fit drawn at a whole zoom, both views */
function wbpDrawFit() {
  const K = wbpKits(),
    b = wbpFitBody(),
    p = wbpFitPart(),
    socks = wbpFitSockets(),
    sock = socks.includes(wbPart.fit.socket) ? wbPart.fit.socket : socks[0];
  for (const v of WB_VIEWS) {
    const cv = wbpRoot().querySelector('#wbpFit' + v);
    if (!cv) continue;
    const x = cv.getContext('2d'),
      f =
        b && p && sock
          ? partFit(K, b, sock, p, v, { angle: wbPart.fit.angle, size: wbPart.size, rules: wbpRules() })
          : null;
    if (!f) {
      cv.width = cv.height = 1;
      continue;
    }
    const B = partDrawBounds(f.draws),
      Z = Math.max(1, Math.min(4, Math.floor(220 / Math.max(B.w, B.h)))),
      pad = 4;
    cv.width = Math.ceil(B.w * Z) + pad * 2;
    cv.height = Math.ceil(B.h * Z) + pad * 2;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, cv.width, cv.height);
    for (const d of f.draws) {
      const img = d.id === wbPart.id && !d.body ? wbpPicture(v) : loadedAtlas(wbpPath(d.file));
      if (!img) continue;
      x.save();
      x.translate(pad + (d.x - B.x) * Z, pad + (d.y - B.y) * Z);
      x.rotate((d.rot * Math.PI) / 180);
      x.translate(-d.px[0] * Z, -d.px[1] * Z);
      if (d.flip) {
        x.translate(d.w * Z, 0);
        x.scale(-1, 1);
      }
      x.drawImage(img, 0, 0, d.w * Z, d.h * Z);
      x.restore();
    }
    cv.dataset.z = f.draws.map(d => (d.body ? 'body' : 'part')).join(',');
    cv.dataset.flip = String(f.flip);
    cv.dataset.angle = String(f.angle);
  }
  const a = wbpRoot().querySelector('#wbpAngle');
  if (a) a.textContent = partClampTurn(K, p || wbPart.id, wbPart.fit.angle) + '°';
}
function wbpSwing() {
  if (!wbPart.fit.swing) return;
  if (!sectionShown('workbench') || workbench.mode !== 'part' || !wbpRoot().querySelector('#wbpFitfront')) {
    wbPart.fit.swing = false;
    return;
  }
  const t = partTurn(wbpKits(), wbpFitPart() || wbPart.id),
    s = Math.sin(performance.now() / 600);
  wbPart.fit.angle = Math.round((t[0] + t[1]) / 2 + ((t[1] - t[0]) / 2) * s);
  const r = wbpRoot().querySelector('[data-wbp=fitAngle]');
  if (r) r.value = String(wbPart.fit.angle);
  wbpDrawFit();
  requestAnimationFrame(wbpSwing);
}
/* ---------- the section's parts, mounted ---------- */
function wbPartSection(head) {
  if (wbpRobots()) {
    setRobotRigData(wbpRobotData());
    if (wbPart.robotsLoaded !== wbpRobotFiles().join()) {
      afterRender(() => wbpLoad().then(() => sectionShown('workbench') && render()));
      return `<div class="wb wbp">${head}<div class="wb-body"><aside class="list-col wb-list wbp-list">${wbpListHTML()}</aside><div class="wb-mid wb-empty"><div class="wb-drop"><b>Loading the robot pictures…</b></div></div></div></div>`;
    }
  }
  if (wbPart.id && !wbpEntry()) wbPart.id = '';
  if (!wbPart.id) wbPart.id = wbpList()[0] || '';
  const list = `<aside class="list-col wb-list wbp-list">${wbpListHTML()}</aside>`,
    mid = wbPart.id
      ? `<div class="wb-mid wbp-mid">${wbpToolsHTML()}${wbpViewsHTML()}${wbpFitHTML()}</div>`
      : `<div class="wb-mid wb-empty"><div class="wb-drop"><b>No part picked</b><span>${wbpRobots() ? 'Robot parts come from the Robots section.' : 'Parts come from Sheet mode: drop a sheet, then Write.'}</span></div></div>`,
    side = `<aside class="px-side wb-side wbp-side" id="wbpSide">${wbpSideHTML()}</aside>`;
  afterRender(() => wbpMount().catch(e => toast('Could not show the part: ' + e.message, 'err')));
  return `<div class="wb wbp">${head}<div class="wb-body">${list}${mid}${side}</div></div>`;
}
async function wbpMount() {
  const id = wbPart.id;
  await wbpLoad();
  if (id !== wbPart.id || workbench.mode !== 'part') return;
  wbPart.pcs = {};
  for (const v of WB_VIEWS) {
    const st = wbpRoot().querySelector(`#wbp${v}Stage`);
    if (!st) continue;
    const j = wbpJoint(v),
      painted = !!wbpSizeOf(v),
      P = pixelCanvas(st, {
        ids: 'wbp' + v[0],
        tool: painted ? wbPart.tool : 'part',
        color: wbPart.color,
        get: () => wbpPicture(v),
        path: painted ? () => wbpPath(j.file) : undefined,
        overlay: P => wbpOverlay(v, P),
        hostTool: (P, t, x, y, ev) => wbpHost(v, P, t, ev),
        changed: () => wbpDrawFit(),
        drawn: P => {
          wbPart.zoom[v] = P.zoom;
          const z = wbpRoot().querySelector('#wbpZoom');
          if (z) z.textContent = P.zoom + '×';
        },
      });
    P.showGrid = true;
    P.zoom = wbPart.zoom[v] || pixelCanvasFit(P, 2, 24);
    wbPart.pcs[v] = P;
    drawPixelCanvas(P);
  }
  wbpDrawFit();
  if (wbPart.fit.swing) requestAnimationFrame(wbpSwing);
}
function wbpRedraw() {
  for (const P of Object.values(wbPart.pcs)) if (P.cv.isConnected) drawPixelCanvas(P);
  wbpDrawFit();
}
function wbpRefreshSide() {
  const s = wbpRoot().querySelector('#wbpSide');
  if (s) s.innerHTML = wbpSideHTML();
}
/* the pivot crosshair and the sockets, in the picture's pixels; sizes on screen stay the same at any zoom */
function wbpOverlay(view, P) {
  const j = wbpJoint(view);
  if (!j) return '';
  const u = 1 / (P.zoom || 1),
    sel = wbPart.sel && wbPart.sel.view === view ? wbPart.sel.h : null;
  let g = '';
  for (const [n, p] of Object.entries(j.sockets)) {
    const x = p[0] * j.w,
      y = p[1] * j.h,
      c = wbpColor(n),
      acc = partAccepts(wbpKits(), wbPart.id, n);
    g += `<circle class="wbp-sock-dot ${sel === n ? 'on' : ''}" cx="${x}" cy="${y}" r="${(sel === n ? 6 : 4.5) * u}" fill="${c}"/><text class="wbp-label" x="${x + 7 * u}" y="${y - 6 * u}" font-size="${11 * u}" stroke-width="${3 * u}" fill="${c}">${escapeHtml(n)}${acc.length ? ' → ' + escapeHtml(acc.join(', ')) : ''}</text>`;
  }
  const [px, py] = j.px,
    r = 7 * u,
    l = 12 * u;
  g += `<g class="wbp-pivot ${sel === 'pivot' ? 'on' : ''}"><circle cx="${px}" cy="${py}" r="${r}"/><path d="M${px - l} ${py}H${px + l}M${px} ${py - l}V${py + l}"/></g>`;
  return g;
}
/* a click on a view: pick the handle under it (the nearest within 10 screen pixels; the pivot first, as it often
   sits on the joint socket) and follow the drag */
function wbpHost(view, P, t, ev) {
  if (t !== 'part') return false;
  const j = wbpJoint(view),
    [fx, fy] = pixelCanvasPointF(P, ev),
    near = 10 / (P.zoom || 1);
  let best = null,
    bd = near;
  const hs = [['pivot', j.px], ...Object.entries(j.sockets).map(([n, p]) => [n, [p[0] * j.w, p[1] * j.h]])];
  for (const [h, [x, y]] of hs) {
    const d = Math.hypot(x - fx, y - fy);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  wbPart.sel = best ? { view, h: best } : null;
  wbpRedraw();
  wbpRefreshSide();
  if (!best) return true;
  if (!wbpEditable(view)) {
    toast(`Paint ${wbPart.size} to give it points of its own; a scaled size uses M’s.`);
    return true;
  }
  let moved = false;
  return {
    move: (P2, x, y) => {
      /* half pixels: the pivot can sit between two pixels, as the kits' do (a robot's: whole pixels) */
      const q = wbpRobots() ? 1 : 2;
      wbpSetPoint(view, best, Math.round(x * q) / q / j.w, Math.round(y * q) / q / j.h);
      moved = true;
      drawPixelCanvas(P2);
      wbpDrawFit();
    },
    up: () => {
      if (!moved) return;
      if (wbpRobots()) wbpRobotDone();
      else {
        changed();
        commit(true);
      }
      wbpRefreshSide();
    },
  };
}
const wbpRound = v => Math.round(v * 10000) / 10000;
/* moves a point of a view (no undo step: the caller makes one): at M the view's own pivot or socket (and the hand
   socket that Sheet mode keeps), on a hand-painted size that size's */
function wbpSetPoint(view, h, fx, fy) {
  if (wbpRobots()) {
    const j = wbpJoint(view),
      px = robotPx([Math.min(1.5, Math.max(-0.5, fx)), Math.min(1.5, Math.max(-0.5, fy))], j.w, j.h);
    return wbpRobotSet(view, h, robotFrac(px, j.w, j.h));
  }
  const P = wbpEntry(),
    V = P.views[view],
    S = wbpSizeOf(view),
    pt = [wbpRound(Math.min(1.5, Math.max(-0.5, fx))), wbpRound(Math.min(1.5, Math.max(-0.5, fy)))];
  if (wbPart.size !== 'M') {
    if (!S) return;
    if (h === 'pivot') S.pivot = pt;
    else (S.sockets = S.sockets || { ...(V.sockets || {}) })[h] = pt;
    return;
  }
  if (h === 'pivot') V.pivot = pt;
  else {
    (V.sockets = V.sockets || {})[h] = pt;
    wbpHand(wbPart.id, view)[h] = pt;
  }
}
/* the part's sockets given by hand in a view (partKits `sockets`), made when missing */
function wbpHand(id, view) {
  const K = wbpKits(),
    H = (K.sockets = K.sockets || {});
  return ((H[id] = H[id] || {})[view] = H[id][view] || {});
}
/* the arrow keys move the picked point a pixel (Shift: a quarter) */
function wbpKeys(ev) {
  if (!ev.key.startsWith('Arrow') || !wbPart.sel || workbench.mode !== 'part' || !sectionShown('workbench')) return;
  if (ev.target.closest && ev.target.closest('input, select, textarea, [contenteditable]')) return;
  if (document.querySelector('#dlg')?.innerHTML || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const { view, h } = wbPart.sel,
    j = wbpJoint(view);
  if (!j || !wbpEditable(view)) return;
  ev.preventDefault();
  const step = ev.shiftKey && !wbpRobots() ? 0.25 : 1,
    dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0,
    dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0,
    p = h === 'pivot' ? j.pivot : j.sockets[h];
  if (!p) return;
  wbpSetPoint(view, h, (p[0] * j.w + dx) / j.w, (p[1] * j.h + dy) / j.h);
  if (wbpRobots()) wbpRobotDone();
  else {
    changed();
    commit(true);
  }
  wbpRedraw();
  wbpRefreshSide();
}
document.addEventListener('keydown', wbpKeys);
/* ---------- sockets, rules, turns, draw order ---------- */
function wbpSockRename(from, to) {
  const P = wbpEntry(),
    K = wbpKits();
  to = String(to || '').trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(to))
    return toast('A socket name is letters and digits, starting with a letter.', 'err');
  if (to === from) return;
  const ren = o => {
    if (!o || !(from in o)) return;
    if (to in o) return;
    o[to] = o[from];
    delete o[from];
  };
  for (const v of WB_VIEWS) {
    const V = P.views[v];
    if (!V) continue;
    if (V.sockets && to in V.sockets) return toast(`${to} is already a socket.`, 'err');
    ren(V.sockets);
    for (const S of Object.values(V.sizes || {})) ren(S.sockets);
    ren(K.sockets?.[wbPart.id]?.[v]);
  }
  ren(P.accepts);
  if (wbPart.sel && wbPart.sel.h === from) wbPart.sel.h = to;
  changed();
  commit(true);
  render();
}
ACTIONS.wbpSockAdd = () => {
  if (wbpRobots()) return;
  const el = wbpRoot().querySelector('#wbpNewSock'),
    n = String(el?.value || '').trim(),
    P = wbpEntry();
  if (!P) return;
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(n))
    return toast('A socket name is letters and digits, starting with a letter.', 'err');
  if (WB_VIEWS.some(v => P.views[v]?.sockets?.[n])) return toast(`${n} is already a socket.`, 'err');
  for (const v of WB_VIEWS) {
    const V = P.views[v];
    if (!V) continue;
    const pv = V.pivot || P.pivot;
    (V.sockets = V.sockets || {})[n] = [...pv];
    wbpHand(wbPart.id, v)[n] = [...pv];
  }
  wbPart.sel = { view: 'front', h: n };
  changed();
  commit(true);
  render();
};
ACTIONS.wbpSockDel = d => {
  if (wbpRobots()) return;
  const P = wbpEntry(),
    K = wbpKits(),
    n = d.n;
  for (const v of WB_VIEWS) {
    const V = P.views[v];
    if (!V) continue;
    if (V.sockets) delete V.sockets[n];
    for (const S of Object.values(V.sizes || {})) if (S.sockets) delete S.sockets[n];
    const H = K.sockets?.[wbPart.id];
    if (H?.[v]) {
      delete H[v][n];
      if (!Object.keys(H[v]).length) delete H[v];
    }
  }
  if (K.sockets?.[wbPart.id] && !Object.keys(K.sockets[wbPart.id]).length) delete K.sockets[wbPart.id];
  if (P.accepts) {
    delete P.accepts[n];
    if (!Object.keys(P.accepts).length) delete P.accepts;
  }
  if (wbPart.sel?.h === n) wbPart.sel = null;
  changed();
  commit(true);
  render();
};
/* a slot on or off at a socket: the part's own rule from then on (it starts as the kit's rule for that name) */
ACTIONS.wbpAccept = d => {
  if (wbpRobots()) return;
  const P = wbpEntry(),
    have = partAccepts(wbpKits(), wbPart.id, d.n),
    next = have.includes(d.s) ? have.filter(s => s !== d.s) : WBP_SLOTS.filter(s => s === d.s || have.includes(s));
  (P.accepts = P.accepts || {})[d.n] = next;
  changed();
  commit(true);
  render();
};
ACTIONS.wbpAcceptReset = d => {
  if (wbpRobots()) return;
  const P = wbpEntry();
  if (!P.accepts) return;
  delete P.accepts[d.n];
  if (!Object.keys(P.accepts).length) delete P.accepts;
  changed();
  commit(true);
  render();
};
ACTIONS.wbpPivotReset = d => {
  if (wbpRobots()) {
    wbpRobotSet(d.v, 'pivot', null);
    wbpRobotDone();
    return render();
  }
  const P = wbpEntry(),
    S = wbpSizeOf(d.v);
  if (wbPart.size === 'M') delete P.views[d.v].pivot;
  else if (S) delete S.pivot;
  changed();
  commit(true);
  render();
};
ACTIONS.wbpTurnReset = () => {
  if (wbpRobots()) {
    const S = wbpRobotStore();
    if (S) delete S.art[S.turn];
    wbpRobotDone();
    return render();
  }
  delete wbpEntry().turn;
  changed();
  commit(true);
  render();
};
ACTIONS.wbpZReset = () => {
  if (wbpRobots()) {
    for (const v of WB_VIEWS) wbpRobotSet(v, 'z', null);
    wbpRobotDone();
    return render();
  }
  delete wbpEntry().z;
  changed();
  commit(true);
  render();
};
/* ---------- S and L: paint from M scaled, or go back to scaled ---------- */
ACTIONS.wbpPaint = async d => {
  if (wbpRobots()) return;
  const P = wbpEntry(),
    id = wbPart.id,
    s = d.s,
    steps = [];
  if (!P) return;
  await wbpLoad();
  const made = {};
  for (const v of WB_VIEWS) {
    const V = P.views[v];
    if (!V || V.sizes?.[s]) continue;
    const m = loadedAtlas(wbpPath(V.file));
    if (!m) continue;
    const im = partScaledPixels(pictureImage(m), partSizeScale(s, wbpRules())),
      file = `next/parts/${v}/${id}_${s.toLowerCase()}.png`,
      c = wbPixelsCanvas(im);
    markArt(wbpPath(file), c);
    steps.push([wbpPath(file), null, pictureImage(c)]);
    made[v] = { file, w: im.width, h: im.height };
  }
  if (!steps.length) return;
  /* the pictures, then the data: one undo takes the entry back, one more the pictures */
  artSteps(steps);
  for (const [v, S] of Object.entries(made)) (P.views[v].sizes = P.views[v].sizes || {})[s] = S;
  wbPart.size = s;
  wbPart.tool = 'pen';
  changed();
  commit(true);
  render();
  toast(`${s} is now its own picture: paint it, then Save.`, 'ok');
};
ACTIONS.wbpSizeDrop = async d => {
  if (wbpRobots()) return;
  const P = wbpEntry();
  if (
    !(await ask(
      `Go back to M scaled for ${d.s}? The painted ${d.s} pictures stay in art/ but the part no longer uses them.`,
      'Back to scaled'
    ))
  )
    return;
  for (const v of WB_VIEWS) {
    const V = P.views[v];
    if (!V?.sizes) continue;
    delete V.sizes[d.s];
    if (!Object.keys(V.sizes).length) delete V.sizes;
  }
  if (wbPart.size === d.s) wbPart.tool = 'part';
  changed();
  commit(true);
  render();
};
/* ---------- Mirror to other side ---------- */
ACTIONS.wbpMirror = async () => {
  if (wbpRobots()) return;
  const K = wbpKits(),
    m = partMirror(K, wbPart.id);
  if (!m) return;
  if (
    K.parts[m.id] &&
    !(await ask(`${m.id} is already there. Replace it with ${wbPart.id} mirrored (pictures and points)?`, 'Replace'))
  )
    return;
  await wbpLoad();
  const P = wbpEntry(),
    steps = [];
  for (const v of WB_VIEWS) {
    const V = P.views[v],
      E = m.entry.views[v];
    if (!V || !E) continue;
    const pairs = [[V.file, E.file], ...Object.keys(V.sizes || {}).map(s => [V.sizes[s].file, E.sizes[s].file])];
    for (const [from, to] of pairs) {
      const src = loadedAtlas(wbpPath(from)) || (await atlasGet(wbpPath(from)));
      const im = pictureImage(src);
      pixelFlip(im, null, 'h');
      let old = null;
      if (studioState.artDirty.has(wbpPath(to)) || (studioState.files || []).some(f => f.path === wbpPath(to)))
        try {
          old = pictureImage(await atlasGet(wbpPath(to)));
        } catch (e) {}
      if (wbSamePicture(old, im)) continue;
      const c = wbPixelsCanvas(im);
      markArt(wbpPath(to), c);
      steps.push([wbpPath(to), old, pictureImage(c)]);
    }
  }
  artSteps(steps);
  K.parts[m.id] = m.entry;
  if (m.sockets) (K.sockets = K.sockets || {})[m.id] = m.sockets;
  else if (K.sockets) delete K.sockets[m.id];
  changed();
  commit(true);
  render();
  toast(`${m.id} made: ${steps.length} picture${steps.length === 1 ? '' : 's'}. Save to put it in the game.`, 'ok');
};
/* ---------- actions and inputs ---------- */
ACTIONS.wbpSrc = d => {
  if (d.s === wbPart.src) return;
  Object.assign(wbPart, { src: d.s === 'robots' ? 'robots' : 'kits', id: '', kit: '', kind: '', size: 'M', sel: null });
  Object.assign(wbPart, {
    tool: 'part',
    zoom: { front: 0, back: 0 },
    fit: { other: '', socket: '', angle: 0, swing: false },
  });
  render();
};
/* a robot part's view back to computed: its stored points and draw order go */
ACTIONS.wbpRobotReset = d => {
  const S = wbpRobotStore();
  if (!S?.art[S.key]?.[d.v]) return;
  const J = { ...S.art[S.key] };
  delete J[d.v];
  if (Object.keys(J).length) S.art[S.key] = J;
  else delete S.art[S.key];
  wbPart.sel = null;
  wbpRobotDone();
  render();
};
ACTIONS.wbMode = d => {
  workbench.mode = d.m === 'part' ? 'part' : 'sheet';
  render();
};
ACTIONS.wbpPick = d => {
  if (d.id === wbPart.id) return;
  wbPart.id = d.id;
  wbPart.sel = null;
  wbPart.zoom = { front: 0, back: 0 };
  if (!wbpSizeOf('front') && !wbpSizeOf('back')) wbPart.tool = 'part';
  render();
};
ACTIONS.wbpSize = d => {
  wbPart.size = d.s;
  wbPart.sel = null;
  wbPart.zoom = { front: 0, back: 0 };
  if (!wbpSizeOf('front') && !wbpSizeOf('back')) wbPart.tool = 'part';
  render();
};
ACTIONS.wbpZoom = d => {
  const z = +d.z;
  for (const P of Object.values(wbPart.pcs)) {
    if (!P.cv.isConnected) continue;
    pixelCanvasZoom(P, z === 0 ? pixelCanvasFit(P, 2, 24) : P.zoom + z);
  }
};
ACTIONS.wbpTool = d => {
  wbPart.tool = d.t;
  for (const P of Object.values(wbPart.pcs)) if (P.cv.isConnected && P.o.path) pixelCanvasTool(P, d.t);
  wbpRoot()
    .querySelectorAll('[data-act=wbpTool]')
    .forEach(b => b.classList.toggle('on', b.dataset.t === d.t));
};
function wbpInput(ev) {
  const el = ev.target;
  if (!el.dataset || el.dataset.wbp === undefined || !el.closest('.wbp')) return;
  const k = el.dataset.wbp,
    P = wbpEntry(),
    num = Number(el.value),
    done = () => {
      changed();
      commit(true);
    };
  if (k === 'kit' || k === 'kind' || k === 'q') {
    wbPart[k] = el.value;
    if (k !== 'q' || ev.type === 'change') return render();
    const L = wbpRoot().querySelector('.wbp-list');
    if (L) L.innerHTML = wbpListHTML();
    const q = wbpRoot().querySelector('[data-wbp=q]');
    if (q) {
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
    }
    return;
  }
  if (k === 'color') {
    wbPart.color = el.value.toUpperCase();
    for (const C of Object.values(wbPart.pcs)) if (C.cv.isConnected) pixelCanvasColor(C, wbPart.color);
    return;
  }
  if (k === 'fitOther' || k === 'fitSocket') {
    if (ev.type !== 'change') return;
    wbPart.fit[k === 'fitOther' ? 'other' : 'socket'] = el.value;
    return wbpLoad().then(render);
  }
  if (k === 'fitAngle') {
    wbPart.fit.angle = num;
    wbPart.fit.swing = false;
    const s = wbpRoot().querySelector('[data-wbp=fitSwing]');
    if (s) s.checked = false;
    return wbpDrawFit();
  }
  if (k === 'fitSwing') {
    wbPart.fit.swing = el.checked;
    if (el.checked) requestAnimationFrame(wbpSwing);
    return;
  }
  if (!P || ev.type !== 'change') return;
  if (k === 'rename') return wbpSockRename(el.dataset.n, el.value);
  if (!Number.isFinite(num)) return;
  if (k === 'pivot') {
    const v = el.dataset.v,
      j = wbpJoint(v),
      p = [...j.pivot];
    p[+el.dataset.i] = num;
    wbpSetPoint(v, 'pivot', p[0], p[1]);
  } else if (k === 'turn') {
    const t = [...partTurn(wbpKits(), wbPart.id)];
    t[+el.dataset.i] = Math.max(-180, Math.min(180, Math.round(num)));
    if (t[0] > t[1]) return toast('The least turn must not be more than the most.', 'err');
    if (wbpRobots()) {
      const S = wbpRobotStore();
      if (S) S.art[S.turn] = t;
    } else P.turn = /** @type {[number, number]} */ (t);
  } else if (k === 'z' && wbpRobots()) {
    wbpRobotSet(el.dataset.v, 'z', Math.max(-50, Math.min(50, Math.round(num))));
  } else if (k === 'z') {
    const z = { front: partZ(wbpKits(), wbPart.id, 'front'), back: partZ(wbpKits(), wbPart.id, 'back') };
    z[el.dataset.v] = Math.max(-50, Math.min(50, Math.round(num)));
    P.z = z;
  } else return;
  if (wbpRobots()) wbpRobotDone();
  else done();
  render();
}
document.addEventListener('input', wbpInput);
document.addEventListener('change', wbpInput);
