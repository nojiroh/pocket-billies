'use strict';
/* ================= POCKET BILLIES STUDIO · Hub island (island track IS-6a) =================
   The hub's own editor (the owner, 2026-10-22: the island is the main hub, never a run node; it gets its own editor
   with an orbiting camera and is locked once it is right). The logic is in game/js/logic/hub-island.js.
     Orbit view  the game's renderer (mountWalkView) through a camera of its own that looks at the island's middle:
                 drag turns round it, Shift-drag (or the right button) tilts, the wheel or a pinch zooms; auto-orbit,
                 a side (S, W, N, E), "Whole island"; "Walk the coast" walks the walker round it under the game's own
                 walk camera (IS-1's orbit camera once it is merged)
     Map         the ground, its heights (a contour every 2 m), the coast, the zones by kind (locked ones hatched), the
                 orbit's pivot and its dead zone, where the camera stands. Tools: Paint ground and Shape the land
                 (map-editor.js's brushes), Coast & zones (move, add and remove points; a zone's kind and lock), Pivot
     Lock        "Lock the ground" stores islandGen.lock and the ground's hash (logic/island.js islandGroundHash); the
                 tools here go read-only and Walk scenes' ground tools refuse the map; props stay free (Walk scenes).
                 "Unlock" asks first.
   A map with no coast yet (Copperleaf until IS-5) is only shown here. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { previewViewport } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { ISLAND_ZONE_KINDS, islandGroundHash, islandPointIn, islandProblems } from '../../game/js/logic/island.js';
import { makeCanvas } from '../../game/js/art.js';
import { artImage, mapHub, setWalkData, walkData, walkView, walkablePointNear } from '../../game/js/walk-view.js';
import { groundHeightAt, rawHeightAt } from '../../game/js/walk/heights.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { escapeHtml } from './game-stand-ins.js';
import { FREE_CAM, freeCamCopy, freeCamGlide, freeCamLook, freeCamZoom } from '../../game/js/logic/free-camera.js';
import {
  ISLAND_GEN_BUILT,
  ISLAND_GEN_DEFAULTS,
  ISLAND_GEN_STAGES,
  islandGenerate,
} from '../../game/js/logic/island-gen.js';
import {
  HUB_SIDES,
  HUB_VIEW,
  groundLockRefusal,
  hubCoastLap,
  hubDefaultMap,
  hubGenRefusal,
  hubGenStart,
  hubGenStats,
  hubGenWalkProblems,
  hubGroundLocked,
  hubInsertPoint,
  hubIslandCentre,
  hubIslandMaps,
  hubLockGround,
  hubMovePoint,
  hubNearestPoint,
  hubRemovePoint,
  hubSideOf,
  hubUnlockGround,
  hubUseIsland,
  hubViewDrag,
  hubViewFrame,
  hubViewOnlyReason,
  hubYawNear,
  hubZoneSquare,
} from '../../game/js/logic/hub-island.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  commit,
  openSection,
  render,
  studioState,
  toast,
} from './studio-app.js';
import { atlasGet } from './sprites.js';
import { drawSceneryThumbs, paintGroundBrush, sceneryArtPaths, sceneryCatalog, sculptHeights } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  HUB_DRAFT_ID: [() => HUB_DRAFT_ID],
  HUB_GEN_ANGLE: [() => HUB_GEN_ANGLE],
  HUB_GEN_DIALS: [() => HUB_GEN_DIALS],
  HUB_GEN_STAGE_NAMES: [() => HUB_GEN_STAGE_NAMES],
  HUB_TOOLS: [() => HUB_TOOLS],
  ZONE_COLOURS: [() => ZONE_COLOURS],
  bindHubFields: [() => bindHubFields, v => (bindHubFields = v)],
  bindHubMap: [() => bindHubMap, v => (bindHubMap = v)],
  drawHubCamera: [() => drawHubCamera, v => (drawHubCamera = v)],
  drawHubMap: [() => drawHubMap, v => (drawHubMap = v)],
  hubBrushHTML: [() => hubBrushHTML],
  hubEd: [() => hubEd],
  hubGen: [() => hubGen],
  hubGenArcsHTML: [() => hubGenArcsHTML, v => (hubGenArcsHTML = v)],
  hubGenCard: [() => hubGenCard],
  hubGenCopy: [() => hubGenCopy],
  hubGenDefault: [() => hubGenDefault],
  hubGenDialHTML: [() => hubGenDialHTML, v => (hubGenDialHTML = v)],
  hubGenGet: [() => hubGenGet],
  hubGenGroupHTML: [() => hubGenGroupHTML, v => (hubGenGroupHTML = v)],
  hubGenHTML: [() => hubGenHTML, v => (hubGenHTML = v)],
  hubGenInput: [() => hubGenInput, v => (hubGenInput = v)],
  hubGenNum: [() => hubGenNum],
  hubGenNumIn: [() => hubGenNumIn],
  hubGenOwn: [() => hubGenOwn],
  hubGenRun: [() => hubGenRun, v => (hubGenRun = v)],
  hubGenSet: [() => hubGenSet, v => (hubGenSet = v)],
  hubGenShowing: [() => hubGenShowing],
  hubGenSoon: [() => hubGenSoon, v => (hubGenSoon = v)],
  hubGenStatsHTML: [() => hubGenStatsHTML, v => (hubGenStatsHTML = v)],
  hubGenStatus: [() => hubGenStatus],
  hubGenStop: [() => hubGenStop, v => (hubGenStop = v)],
  hubGenTimer: [() => hubGenTimer, v => (hubGenTimer = v)],
  hubGenValue: [() => hubGenValue],
  hubGenZonesHTML: [() => hubGenZonesHTML, v => (hubGenZonesHTML = v)],
  hubGroundChanged: [() => hubGroundChanged],
  hubLockHTML: [() => hubLockHTML, v => (hubLockHTML = v)],
  hubLook: [() => hubLook, v => (hubLook = v)],
  hubMap: [() => hubMap],
  hubMapId: [() => hubMapId],
  hubPivotMove: [() => hubPivotMove, v => (hubPivotMove = v)],
  hubPointer: [() => hubPointer, v => (hubPointer = v)],
  hubPointsDown: [() => hubPointsDown, v => (hubPointsDown = v)],
  hubPolyOf: [() => hubPolyOf],
  hubRefusal: [() => hubRefusal],
  hubShown: [() => hubShown],
  hubToolBarHTML: [() => hubToolBarHTML, v => (hubToolBarHTML = v)],
  hubViewBar: [() => hubViewBar],
  hubViewBarHTML: [() => hubViewBarHTML, v => (hubViewBarHTML = v)],
  hubViewEnd: [() => hubViewEnd],
  hubZoom: [() => hubZoom],
  mountHubIsland: [() => mountHubIsland, v => (mountHubIsland = v)],
  mountHubView: [() => mountHubView, v => (mountHubView = v)],
  onHubView: [() => onHubView],
  polyPath: [() => polyPath],
  refreshLockCard: [() => refreshLockCard, v => (refreshLockCard = v)],
  tileColour: [() => tileColour, v => (tileColour = v)],
  tileColours: [() => tileColours],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const hubEd = {
  tool: 'paint',
  ter: 'g',
  brush: 2,
  hmode: 'raise',
  hstr: 0.5,
  hflat: 0,
  /* the height brush's floor and ceiling: room for the island's mountain (the track's peak is ~22 m; Walk scenes keeps
     its own -8 to 12 m) */
  hmin: -8,
  hmax: 40,
  zoom: 0,
  poly: 'coast',
  addKind: '',
  spin: false,
  walk: false,
  mapId: null,
  goal: null,
  cur: null,
  at: 0,
  drag: null,
  view: null,
  pts: new Map(),
  pinch: null,
};
const ZONE_COLOURS = {
  town: '#E0A050',
  barn: '#B05A3A',
  pasture: '#9CCF5A',
  forest: '#2F7A3A',
  mountain: '#8A8A9A',
  cove: '#3AA0C8',
  beach: '#F0D890',
  path: '#C8A070',
};
const HUB_TOOLS = [
  ['paint', 'Paint ground', 'B'],
  ['height', 'Shape the land', 'H'],
  ['points', 'Coast & zones', 'Z'],
  ['pivot', 'Pivot', 'V'],
];

/* ---------- which map ---------- */
const hubMapId = () => {
  const M = studioState.D.maps || {};
  let id = studioState.sel.hub;
  if (!id || !hubIslandMaps(M).includes(id)) id = studioState.sel.hub = hubDefaultMap(M);
  return id;
};
const hubMap = () => {
  const id = hubMapId();
  return id ? studioState.D.maps[id] : null;
};
/** why the map can't be edited here now ('' when it can): no coast, a locked ground, or a draft from the dials shown */
const hubRefusal = sc =>
  hubViewOnlyReason(sc) ||
  groundLockRefusal(sc) ||
  (hubGenShowing() ? 'The map shows a draft from the dials: Use this island or discard it to edit by hand.' : '');
/* the map's pixels a metre: as set with − and +, else the whole map in the card's width and the window's height */
const hubZoom = sc => {
  if (hubEd.zoom) return hubEd.zoom;
  const st = $('.hub-stage');
  const w = st && st.clientWidth > 100 ? st.clientWidth - 4 : 560,
    h = Math.max(240, innerHeight * 0.68);
  return clamp(Math.floor(Math.min(w / sc.w, h / sc.h)), 2, 12);
};
const hubPolyOf = (sc, k = hubEd.poly) =>
  k === 'coast' ? sc.island && sc.island.coast : sc.zones && sc.zones[k] ? sc.zones[k].poly : null;

/* ---------- the section ---------- */
SECTIONS.hub = () => {
  const M = studioState.D.maps || {},
    id = hubMapId(),
    sc = hubMap();
  if (!sc)
    return `<div class="ed-col solo"><div class="ed-head"><h2>Hub island</h2></div><p class="help">No map has an island yet.</p></div>`;
  afterRender(mountHubIsland);
  if (hubEd.poly !== 'coast' && !(sc.zones || [])[hubEd.poly]) hubEd.poly = 'coast';
  const ro = hubViewOnlyReason(sc),
    why = hubRefusal(sc),
    pick = hubIslandMaps(M)
      .map(
        k =>
          `<button class="seg ${k === id ? 'on' : ''}" data-act="hubPick" data-k="${escapeHtml(k)}" title="${escapeHtml(hubViewOnlyReason(M[k]) || 'An island')}">${escapeHtml(M[k].name || k)}${hubViewOnlyReason(M[k]) ? ' (view only)' : hubGroundLocked(M[k]) ? ' 🔒' : ''}</button>`
      )
      .join('');
  const tools = HUB_TOOLS.map(
    ([t, n, k]) =>
      `<button class="seg ${hubEd.tool === t ? 'on' : ''}" data-act="hubTool" data-t="${t}" title="${n} (${k})" ${why ? 'disabled' : ''}>${n}</button>`
  ).join('');
  return `<div class="ed-col solo hub-ed"><div class="ed-head"><div><small class="mono">${escapeHtml(id)}</small><h2>Hub island</h2></div><div class="seg-row"><button class="btn subtle" data-act="hubProps" title="Props, people and buildings stay free when the ground is locked">Props in Walk scenes</button></div></div>
<p class="help">The hub's own island: turn round it, shape its ground, coast and zones by hand, then lock the ground. The island is the hub, never a run node.</p>
<div class="seg-row hub-pick">${pick}</div>
${ro ? `<p class="hub-note">${escapeHtml(ro)}</p>` : ''}
<div class="hub-grid">
${card('Orbit view', `<div class="hub-pv"><canvas id="hubPv"></canvas><div class="sc-pv-load" id="hubPvLoad">Loading…</div></div><div class="seg-row hub-vbar" id="hubViewBar">${hubViewBarHTML()}</div>`, { sub: 'Drag turns round the middle · Shift-drag or the right button tilts · the wheel or a pinch zooms' })}
${card(
  'Map',
  `<div class="sc-bar"><span class="px-tools">${tools}</span><span class="px-tools"><button class="seg" data-act="hubZoom" data-z="-1" aria-label="Smaller">−</button><span id="hubZ">${hubZoom(sc)} px/m</span><button class="seg" data-act="hubZoom" data-z="1" aria-label="Bigger">+</button></span></div>
${why ? '' : hubToolBarHTML(sc)}
<div class="hub-stage"><div class="hub-map-in"><canvas id="hubMap"></canvas><canvas id="hubMapCam" aria-hidden="true"></canvas></div></div>
<div class="hub-legend">${ISLAND_ZONE_KINDS.map(k => `<span><i style="background:${ZONE_COLOURS[k]}"></i>${k}</span>`).join('')}<span><i class="hub-hatch"></i>locked zone</span><span><i class="hub-pivot"></i>pivot and dead zone</span></div>`
)}
</div>
${card('Dials', `<div id="hubGen">${hubGenHTML(sc)}</div>`)}
${card('Ground lock', `<div id="hubLock">${hubLockHTML(sc)}</div>`)}
</div>`;
};

function hubViewBarHTML() {
  const side = hubEd.goal ? hubSideOf(hubEd.goal.yaw) : 'S';
  return `<button class="seg ${hubEd.spin ? 'on' : ''}" data-act="hubSpin" aria-pressed="${hubEd.spin}" ${hubEd.walk ? 'disabled' : ''}>Auto-orbit</button>${Object.keys(
    HUB_SIDES
  )
    .map(
      k =>
        `<button class="seg ${!hubEd.walk && !hubEd.spin && side === k ? 'on' : ''}" data-act="hubSide" data-s="${k}" title="Look from the ${{ S: 'south', W: 'west', N: 'north', E: 'east' }[k]}" ${hubEd.walk ? 'disabled' : ''}>${k}</button>`
    )
    .join(
      ''
    )}<button class="btn sm" data-act="hubFrame" ${hubEd.walk ? 'disabled' : ''}>Whole island</button><button class="seg ${hubEd.walk ? 'on' : ''}" data-act="hubWalk" aria-pressed="${hubEd.walk}" title="The walker goes round the coast under the game's own walk camera">Walk the coast</button>`;
}

function hubToolBarHTML(sc) {
  const T = sceneryCatalog().terrains;
  if (hubEd.tool === 'paint')
    return `<div class="sc-ters">${Object.entries(T)
      .map(
        ([ch, t]) =>
          `<button class="sc-ter ${hubEd.ter === ch ? 'on' : ''}" data-act="hubTer" data-c="${escapeHtml(ch)}" title="${escapeHtml(t.name)} (${escapeHtml(ch)})"><canvas data-tile="${escapeHtml(ch)}" width="16" height="16"></canvas><small>${escapeHtml(t.name)}</small></button>`
      )
      .join('')}</div>${hubBrushHTML()}<p class="help">Alt-click picks the ground under the pointer.</p>`;
  if (hubEd.tool === 'height')
    return `<div class="seg-row">${[
      ['raise', 'Raise'],
      ['lower', 'Lower'],
      ['flatten', 'Flatten'],
      ['smooth', 'Smooth'],
    ]
      .map(
        ([m, n]) =>
          `<button class="seg ${hubEd.hmode === m ? 'on' : ''}" data-act="hubHMode" data-m="${m}">${n}</button>`
      )
      .join(
        ''
      )}</div>${hubBrushHTML()}<label class="mp-size"><span>Strength</span><input type="range" id="hubHStr" min="0.1" max="1" step="0.05" value="${hubEd.hstr}"><output>${hubEd.hstr}</output></label><p class="help">Flatten levels to the height where the stroke starts.</p>`;
  if (hubEd.tool === 'points') {
    const Z = sc.zones || [],
      sel = hubEd.poly === 'coast' ? null : Z[hubEd.poly],
      opts = [['coast', 'The coast']].concat(Z.map((z, k) => [String(k), `${k + 1}. ${z.k}${z.lock ? ' 🔒' : ''}`]));
    return `<div class="seg-row hub-polys"><label class="fld"><span>Editing</span><select id="hubPoly">${opts.map(([v, n]) => `<option value="${v}" ${String(hubEd.poly) === v ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label>${
      sel
        ? `<label class="fld"><span>Kind</span><select id="hubZoneKind">${ISLAND_ZONE_KINDS.map(k => `<option ${sel.k === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label class="fld chk"><input type="checkbox" id="hubZoneLock" ${sel.lock ? 'checked' : ''}><span>Locked zone</span></label><button class="btn sm danger subtle" data-act="hubZoneDel">Remove this zone</button>`
        : ''
    }</div><div class="seg-row"><span>Add a zone:</span>${ISLAND_ZONE_KINDS.map(k => `<button class="seg ${hubEd.addKind === k ? 'on' : ''}" data-act="hubZoneAdd" data-k="${k}">${k}</button>`).join('')}</div><p class="help">${
      hubEd.addKind
        ? `Click the map to put a ${hubEd.addKind} zone there.`
        : 'Drag a point to move it · click near an edge to add a point · Alt-click or right-click a point to remove it · click inside a zone to edit it. A locked zone is left alone when the island is made again.'
    }</p>`;
  }
  const O = sc.cam && sc.cam.orbit,
    max = Math.floor(Math.min(sc.w, sc.h) / 2 - 1);
  return `${O ? `<label class="mp-size"><span>Dead zone</span><input type="range" id="hubDead" min="0" max="${max}" step="0.5" value="${O.dead}"><output id="hubDeadO">${O.dead} m</output></label>` : ''}<p class="help">Drag the pivot (the cross: what the orbit camera turns round) · Shift-drag the island's middle (the diamond). Inside the dead zone the camera holds still.${O ? '' : ' The map has no orbit yet: dragging puts one there.'}</p>`;
}
const hubBrushHTML = () =>
  `<label class="mp-size"><span>Brush</span><input type="range" id="hubBrush" min="1" max="8" value="${hubEd.brush}"><output>${hubEd.brush}</output></label>`;

function hubLockHTML(sc) {
  const ro = hubViewOnlyReason(sc),
    G = sc.islandGen || {},
    P = islandProblems(sc);
  if (ro) return `<p class="help">${escapeHtml(ro)}</p>`;
  const list = P.length ? `<ul class="hub-probs">${P.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : '';
  if (G.lock)
    return `<p class="hub-locked">🔒 The ground is locked <small class="mono">${escapeHtml(G.hash || '')}</small>: its letters, heights, steps, coast and zones are frozen and a change fails the data check. Props, people and buildings stay free (Walk scenes).</p>${list}<button class="btn" data-act="hubUnlock">Unlock…</button>`;
  return `<p class="help">Lock the ground once the island is right: its letters, heights, steps, coast and zones freeze (the hash goes in islandGen), the tools here go read-only and Walk scenes' ground tools refuse it. Props stay free.</p>${list}<button class="btn primary" data-act="hubLock" ${P.length ? 'disabled title="Fix the problems above first"' : ''}>Lock the ground</button>`;
}

/* ---------- mounting ---------- */
async function mountHubIsland() {
  const sc = hubMap();
  if (!sc) return;
  await Promise.all(sceneryArtPaths().map(p => atlasGet('art/' + p).catch(() => null)));
  if (studioState.sec !== 'hub') return;
  drawSceneryThumbs();
  drawHubMap();
  bindHubMap();
  bindHubFields();
  mountHubView();
}
function mountHubView() {
  const cv = $('#hubPv'),
    id = hubMapId();
  if (!cv || !id) return;
  if (hubEd.mapId !== id) {
    hubEd.mapId = id;
    hubEd.goal = null;
    hubEd.walk = false;
    hubEd.spin = false;
  }
  /* a walk round the coast stops when the section is left: back here, the button is off again */
  if (hubEd.walk && !walkView.pl.route) hubEd.walk = false;
  walkView.pl.t = -1;
  mountWalkView(cv, hubGenShowing() ? HUB_DRAFT_ID : id, {
    state: () => ({ mode: 'roam', roam: true, pos: mapHub(hubShown() || walkView.sc), who: 'boy', enc: [], npcs: [] }),
    keys: () => hubEd.walk,
    onPick: () => {},
    cap: () => (studioState.sec === 'hub' ? 30 : 0),
    look: hubLook,
  }).then(() => {
    const l = $('#hubPvLoad');
    if (l) l.hidden = true;
  });
}
/** each frame: where the orbit view looks from (null while walking the coast: the game's walk camera) */
function hubLook(dt) {
  const sc = walkView.sc;
  if (hubEd.walk || !sc || !sc.w) return null;
  const now = performance.now();
  dt = Math.min(0.25, Math.max(dt, (now - (hubEd.at || now)) / 1000));
  hubEd.at = now;
  if (!hubEd.goal) {
    const [cx, cz] = hubIslandCentre(sc);
    hubEd.goal = hubViewFrame(sc, groundHeightAt(cx, cz));
    hubEd.cur = freeCamCopy(hubEd.goal);
  }
  if (hubEd.spin) hubEd.goal.yaw += HUB_VIEW.spin * dt;
  freeCamGlide(hubEd.cur, hubEd.goal, dt);
  drawHubCamera();
  return freeCamLook(hubEd.cur);
}
const hubViewBar = () => {
  const b = $('#hubViewBar');
  if (b) b.innerHTML = hubViewBarHTML();
};

/* ---------- the orbit view's pointer (caught before the walk view's own, as the free camera's is) ---------- */
const onHubView = ev => !hubEd.walk && ev.target && ev.target.id === 'hubPv';
document.addEventListener(
  'pointerdown',
  ev => {
    if (!onHubView(ev) || !hubEd.goal) return;
    ev.stopPropagation();
    ev.preventDefault();
    try {
      ev.target.setPointerCapture(ev.pointerId);
    } catch (e) {}
    hubEd.pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (hubEd.spin) {
      hubEd.spin = false;
      hubViewBar();
    }
    if (hubEd.pts.size === 2) {
      const [a, b] = [...hubEd.pts.values()];
      hubEd.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
      hubEd.view = null;
      return;
    }
    hubEd.view = { x: ev.clientX, y: ev.clientY, tilt: ev.shiftKey || ev.button === 2 };
  },
  true
);
document.addEventListener(
  'pointermove',
  ev => {
    if (!hubEd.pts.has(ev.pointerId)) return;
    ev.stopPropagation();
    hubEd.pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    const g = hubEd.goal;
    if (!g) return;
    if (hubEd.pts.size === 2 && hubEd.pinch) {
      const [a, b] = [...hubEd.pts.values()],
        d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      freeCamZoom(g, hubEd.pinch / Math.max(20, d));
      hubEd.pinch = d;
      return;
    }
    const V = hubEd.view;
    if (!V) return;
    hubViewDrag(g, ev.clientX - V.x, ev.clientY - V.y, V.tilt || ev.shiftKey, FREE_CAM);
    V.x = ev.clientX;
    V.y = ev.clientY;
  },
  true
);
const hubViewEnd = ev => {
  if (!hubEd.pts.has(ev.pointerId)) return;
  hubEd.pts.delete(ev.pointerId);
  if (hubEd.pts.size < 2) hubEd.pinch = null;
  if (!hubEd.pts.size) {
    hubEd.view = null;
    hubViewBar();
  }
  ev.stopPropagation();
};
document.addEventListener('pointerup', hubViewEnd, true);
document.addEventListener('pointercancel', hubViewEnd, true);
for (const t of ['click', 'dblclick', 'contextmenu'])
  document.addEventListener(
    t,
    ev => {
      if (!onHubView(ev)) return;
      ev.stopPropagation();
      ev.preventDefault();
    },
    true
  );
document.addEventListener(
  'wheel',
  ev => {
    if (!onHubView(ev) || !hubEd.goal) return;
    ev.preventDefault();
    ev.stopPropagation();
    freeCamZoom(hubEd.goal, Math.exp(ev.deltaY * 0.0015));
  },
  { capture: true, passive: false }
);

/* ---------- the map ---------- */
const tileColours = {};
/** a ground letter's colour on the small map: its tile's average */
function tileColour(ch) {
  const T = sceneryCatalog().terrains[ch],
    im = T && artImage(T.tile);
  if (!im || !(im.width || im.naturalWidth)) return '#F0F';
  if (tileColours[T.tile]) return tileColours[T.tile];
  const c = makeCanvas(1, 1),
    x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = true;
  x.drawImage(im, 0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return (tileColours[T.tile] = `rgb(${d[0]},${d[1]},${d[2]})`);
}
const polyPath = (x, P, Z, H) => {
  x.beginPath();
  P.forEach(([a, b], k) => (k ? x.lineTo(a * Z, (H - b) * Z) : x.moveTo(a * Z, (H - b) * Z)));
  x.closePath();
};
function drawHubMap() {
  const cv = $('#hubMap'),
    sc = hubShown();
  if (!cv || !sc) return;
  const Z = hubZoom(sc),
    W = sc.w,
    H = sc.h,
    x = cv.getContext('2d');
  cv.width = W * Z;
  cv.height = H * Z;
  for (let j = 0; j < H; j++) {
    const row = sc.tiles[j] || '';
    for (let i = 0; i < W; i++) {
      x.fillStyle = tileColour(row[i] || sc.edge);
      x.fillRect(i * Z, j * Z, Z, Z);
    }
  }
  if (sc.heights && sc.heights.length) {
    const hAt = (i, j) => rawHeightAt(sc, i + 0.5, H - j - 0.5);
    x.strokeStyle = 'rgba(50,30,10,.45)';
    x.lineWidth = 1;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const h = hAt(i, j);
        if (Math.abs(h) >= 0.05) {
          x.fillStyle =
            h > 0 ? `rgba(255,255,255,${Math.min(0.4, h * 0.03)})` : `rgba(0,0,40,${Math.min(0.4, -h * 0.1)})`;
          x.fillRect(i * Z, j * Z, Z, Z);
        }
        const a = Math.floor(h / 2);
        if (i + 1 < W && a !== Math.floor(hAt(i + 1, j) / 2)) {
          x.beginPath();
          x.moveTo((i + 1) * Z, j * Z);
          x.lineTo((i + 1) * Z, (j + 1) * Z);
          x.stroke();
        }
        if (j + 1 < H && a !== Math.floor(hAt(i, j + 1) / 2)) {
          x.beginPath();
          x.moveTo(i * Z, (j + 1) * Z);
          x.lineTo((i + 1) * Z, (j + 1) * Z);
          x.stroke();
        }
      }
  }
  const pts = hubEd.tool === 'points';
  (sc.zones || []).forEach((zn, k) => {
    if (!Array.isArray(zn.poly) || zn.poly.length < 3) return;
    const col = ZONE_COLOURS[zn.k] || '#FFF',
      on = pts && hubEd.poly === k;
    polyPath(x, zn.poly, Z, H);
    x.globalAlpha = 0.22;
    x.fillStyle = col;
    x.fill();
    x.globalAlpha = 1;
    if (zn.lock) {
      x.save();
      polyPath(x, zn.poly, Z, H);
      x.clip();
      x.strokeStyle = 'rgba(30,20,40,.45)';
      x.lineWidth = 1;
      for (let d = -H * Z; d < W * Z; d += 8) {
        x.beginPath();
        x.moveTo(d, H * Z);
        x.lineTo(d + H * Z, 0);
        x.stroke();
      }
      x.restore();
    }
    polyPath(x, zn.poly, Z, H);
    x.strokeStyle = col;
    x.lineWidth = on ? 3 : 1.5;
    x.stroke();
    const cx = zn.poly.reduce((s, p) => s + p[0], 0) / zn.poly.length,
      cz = zn.poly.reduce((s, p) => s + p[1], 0) / zn.poly.length;
    x.font = '600 11px system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillStyle = 'rgba(20,16,30,.85)';
    x.fillText(`${zn.k}${zn.lock ? ' 🔒' : ''}`, cx * Z, (H - cz) * Z + 4);
  });
  const C = sc.island && sc.island.coast;
  if (Array.isArray(C) && C.length > 2) {
    polyPath(x, C, Z, H);
    x.strokeStyle = 'rgba(10,20,40,.6)';
    x.lineWidth = 4;
    x.stroke();
    x.strokeStyle = '#FFF';
    x.lineWidth = pts && hubEd.poly === 'coast' ? 2.5 : 1.5;
    x.stroke();
  }
  if (pts) {
    const P = hubPolyOf(sc) || [];
    for (const [a, b] of P) {
      x.beginPath();
      x.arc(a * Z, (H - b) * Z, 4, 0, Math.PI * 2);
      x.fillStyle = '#FFF';
      x.fill();
      x.strokeStyle = '#1E1A34';
      x.lineWidth = 1.5;
      x.stroke();
    }
  }
  const O = sc.cam && sc.cam.orbit;
  if (O && Array.isArray(O.c)) {
    const px = O.c[0] * Z,
      py = (H - O.c[1]) * Z;
    x.save();
    x.setLineDash([5, 4]);
    x.strokeStyle = '#E23D6E';
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(px, py, Math.max(2, O.dead * Z), 0, Math.PI * 2);
    x.stroke();
    x.restore();
    x.strokeStyle = '#E23D6E';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(px - 7, py);
    x.lineTo(px + 7, py);
    x.moveTo(px, py - 7);
    x.lineTo(px, py + 7);
    x.stroke();
  }
  if (sc.island && Array.isArray(sc.island.c)) {
    const px = sc.island.c[0] * Z,
      py = (H - sc.island.c[1]) * Z;
    x.beginPath();
    x.moveTo(px, py - 5);
    x.lineTo(px + 5, py);
    x.lineTo(px, py + 5);
    x.lineTo(px - 5, py);
    x.closePath();
    x.fillStyle = '#FFE14D';
    x.fill();
    x.strokeStyle = '#1E1A34';
    x.lineWidth = 1;
    x.stroke();
  }
  const zEl = $('#hubZ');
  if (zEl) zEl.textContent = Z + ' px/m';
  hubEd.camKey = '';
  drawHubCamera();
}
/** the layer over the map: where the orbit camera stands and looks, or the walker while it walks the coast */
function drawHubCamera() {
  const cv = $('#hubMapCam'),
    base = $('#hubMap'),
    sc = hubShown();
  if (!cv || !base || !sc) return;
  const Z = hubZoom(sc),
    H = sc.h,
    s = hubEd.cur,
    P = walkView.pl,
    key = hubEd.walk
      ? `w${Math.round(P.x * 4)},${Math.round(P.z * 4)}`
      : s
        ? `${s.yaw.toFixed(3)},${s.dist.toFixed(1)},${s.pitch.toFixed(1)}`
        : '';
  if (key === hubEd.camKey && cv.width === base.width) return;
  hubEd.camKey = key;
  cv.width = base.width;
  cv.height = base.height;
  const x = cv.getContext('2d');
  if (hubEd.walk) {
    x.beginPath();
    x.arc(P.x * Z, (H - P.z) * Z, 5, 0, Math.PI * 2);
    x.fillStyle = '#FFE14D';
    x.fill();
    x.strokeStyle = '#1E1A34';
    x.stroke();
    return;
  }
  if (!s) return;
  const L = freeCamLook(s),
    tx = L.tgt[0] * Z,
    ty = (H - L.tgt[2]) * Z,
    ex = clamp(L.eye[0] * Z, 6, cv.width - 6),
    ey = clamp((H - L.eye[2]) * Z, 6, cv.height - 6);
  x.strokeStyle = 'rgba(255,225,77,.9)';
  x.lineWidth = 2;
  x.setLineDash([6, 4]);
  x.beginPath();
  x.moveTo(ex, ey);
  x.lineTo(tx, ty);
  x.stroke();
  x.setLineDash([]);
  x.beginPath();
  x.arc(ex, ey, 6, 0, Math.PI * 2);
  x.fillStyle = '#FFE14D';
  x.fill();
  x.strokeStyle = '#1E1A34';
  x.lineWidth = 1.5;
  x.stroke();
}
function hubPointer(ev) {
  const cv = $('#hubMap'),
    r = cv.getBoundingClientRect(),
    sc = hubShown(),
    Z = hubZoom(sc),
    mx = ((ev.clientX - r.left) / r.width) * cv.width,
    my = ((ev.clientY - r.top) / r.height) * cv.height;
  return { mx, my, x: mx / Z, z: sc.h - my / Z, i: Math.floor(mx / Z), j: Math.floor(my / Z), tol: 10 / Z };
}
/* a ground change: the preview's ground or heights are made again */
const hubGroundChanged = () => {
  walkView.gkey = '';
  walkView.nav = null;
  walkView.cand = null;
};
function bindHubMap() {
  const cv = $('#hubMap');
  if (!cv || cv._b) return;
  cv._b = 1;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', ev => {
    const sc = hubMap(),
      m = hubPointer(ev),
      why = hubRefusal(sc);
    if (why) return void toast(why);
    cv.setPointerCapture(ev.pointerId);
    if (hubEd.tool === 'paint') {
      if (ev.altKey) {
        const ch = (sc.tiles[m.j] || '')[m.i];
        if (ch) {
          hubEd.ter = ch;
          $$('.hub-ed .sc-ter').forEach(b => b.classList.toggle('on', b.dataset.c === ch));
        }
        return;
      }
      hubEd.drag = { k: 'paint' };
      if (paintGroundBrush(sc, m.i, m.j, hubEd.ter, hubEd.brush)) {
        hubGroundChanged();
        drawHubMap();
      }
      return;
    }
    if (hubEd.tool === 'height') {
      hubEd.hflat = rawHeightAt(sc, m.x, m.z);
      hubEd.drag = { k: 'height' };
      sculptHeights(sc, m, hubEd);
      drawHubMap();
      return;
    }
    if (hubEd.tool === 'points') return void hubPointsDown(sc, m, ev);
    if (hubEd.tool === 'pivot') {
      if (ev.shiftKey) {
        if (!sc.island) return void toast('The map has no island, so no middle to move.');
        hubEd.drag = { k: 'centre' };
      } else {
        sc.cam = sc.cam || {};
        if (!sc.cam.orbit) sc.cam.orbit = { c: hubIslandCentre(sc), dead: 3, lag: 0.6, turn: 30 };
        hubEd.drag = { k: 'pivot' };
      }
      hubPivotMove(sc, m);
    }
  });
  cv.addEventListener('pointermove', ev => {
    const D = hubEd.drag;
    if (!D) return;
    const sc = hubMap(),
      m = hubPointer(ev);
    if (D.k === 'paint') {
      if (paintGroundBrush(sc, m.i, m.j, hubEd.ter, hubEd.brush)) {
        hubGroundChanged();
        drawHubMap();
      }
    } else if (D.k === 'height') {
      sculptHeights(sc, m, hubEd);
      drawHubMap();
    } else if (D.k === 'pt') {
      hubMovePoint(hubPolyOf(sc), D.n, m.x, m.z, sc);
      D.moved = 1;
      drawHubMap();
    } else if (D.k === 'pivot' || D.k === 'centre') hubPivotMove(sc, m);
  });
  const up = () => {
    const D = hubEd.drag;
    hubEd.drag = null;
    if (!D) return;
    if (D.k === 'pt' && !D.moved && !D.added) return;
    changed();
    commit(true);
    if (D.k === 'pt' || D.k === 'pivot' || D.k === 'centre') refreshLockCard();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}
function hubPointsDown(sc, m, ev) {
  if (hubEd.addKind) {
    const Z = sc.zones || (sc.zones = []);
    Z.push({ k: hubEd.addKind, poly: hubZoneSquare(m.x, m.z, 12, sc) });
    hubEd.poly = Z.length - 1;
    hubEd.addKind = '';
    changed();
    commit(true);
    render();
    return;
  }
  const P = hubPolyOf(sc);
  if (P) {
    const n = hubNearestPoint(P, m.x, m.z, m.tol);
    if (n >= 0 && (ev.altKey || ev.button === 2)) {
      if (!hubRemovePoint(P, n)) return void toast('A coast or zone keeps at least three points.');
      changed();
      commit(true);
      drawHubMap();
      refreshLockCard();
      return;
    }
    if (n >= 0) {
      hubEd.drag = { k: 'pt', n };
      return;
    }
    const k = hubInsertPoint(P, m.x, m.z, m.tol);
    if (k >= 0) {
      hubEd.drag = { k: 'pt', n: k, added: 1 };
      drawHubMap();
      return;
    }
  }
  /* inside a zone (the last drawn first), else the coast: edit that one */
  const Z = sc.zones || [];
  for (let k = Z.length - 1; k >= 0; k--)
    if (Array.isArray(Z[k].poly) && islandPointIn(Z[k].poly, m.x, m.z)) {
      if (hubEd.poly !== k) {
        hubEd.poly = k;
        render();
      }
      return;
    }
  if (hubEd.poly !== 'coast' && sc.island && islandPointIn(sc.island.coast, m.x, m.z)) {
    hubEd.poly = 'coast';
    render();
  }
}
function hubPivotMove(sc, m) {
  const p = [+clamp(m.x, 0, sc.w).toFixed(2), +clamp(m.z, 0, sc.h).toFixed(2)];
  if (hubEd.drag.k === 'centre') sc.island.c = p;
  else sc.cam.orbit.c = p;
  drawHubMap();
}
function refreshLockCard() {
  const el = $('#hubLock'),
    sc = hubMap();
  if (el && sc) el.innerHTML = hubLockHTML(sc);
}
function bindHubFields() {
  const on = (id, f) => {
    const el = $('#' + id);
    if (el) el.addEventListener('input', () => f(el));
  };
  const out = el => {
    const o = el.parentElement.querySelector('output');
    if (o) o.textContent = el.value;
  };
  on('hubBrush', el => {
    hubEd.brush = +el.value;
    out(el);
  });
  on('hubHStr', el => {
    hubEd.hstr = +el.value;
    out(el);
  });
  on('hubDead', el => {
    const sc = hubMap();
    if (hubRefusal(sc) || !sc.cam || !sc.cam.orbit) return;
    sc.cam.orbit.dead = +el.value;
    $('#hubDeadO').textContent = el.value + ' m';
    drawHubMap();
    changed();
  });
  const dead = $('#hubDead');
  if (dead) dead.addEventListener('change', () => commit(true));
  const pick = $('#hubPoly');
  if (pick)
    pick.addEventListener('change', () => {
      hubEd.poly = pick.value === 'coast' ? 'coast' : +pick.value;
      render();
    });
  const kind = $('#hubZoneKind'),
    lock = $('#hubZoneLock');
  const zoneSet = f => {
    const sc = hubMap(),
      zn = (sc.zones || [])[hubEd.poly];
    if (!zn || hubRefusal(sc)) return;
    f(zn);
    changed();
    commit(true);
    render();
  };
  if (kind) kind.addEventListener('change', () => zoneSet(zn => (zn.k = kind.value)));
  if (lock)
    lock.addEventListener('change', () =>
      zoneSet(zn => {
        if (lock.checked) zn.lock = true;
        else delete zn.lock;
      })
    );
}

/* ---------- actions ---------- */
ACTIONS.hubPick = d => {
  if (d.k !== studioState.sel.hub) hubGenStop();
  studioState.sel.hub = d.k;
  render();
};
ACTIONS.hubTool = d => {
  hubEd.tool = d.t;
  hubEd.addKind = '';
  render();
};
ACTIONS.hubTer = d => {
  hubEd.ter = d.c;
  $$('.hub-ed .sc-ter').forEach(b => b.classList.toggle('on', b.dataset.c === d.c));
};
ACTIONS.hubHMode = d => {
  hubEd.hmode = d.m;
  render();
};
ACTIONS.hubZoom = d => {
  const sc = hubShown();
  hubEd.zoom = clamp(hubZoom(sc) + +d.z, 2, 16);
  drawHubMap();
};
ACTIONS.hubZoneAdd = d => {
  hubEd.addKind = hubEd.addKind === d.k ? '' : d.k;
  render();
};
ACTIONS.hubZoneDel = async () => {
  const sc = hubMap(),
    zn = (sc.zones || [])[hubEd.poly];
  if (!zn || hubRefusal(sc) || !(await ask(`Remove the ${zn.k} zone?`, 'Remove'))) return;
  sc.zones.splice(hubEd.poly, 1);
  if (!sc.zones.length) delete sc.zones;
  hubEd.poly = 'coast';
  changed();
  commit(true);
  render();
};
ACTIONS.hubProps = () => openSection('scenes', { scene: hubMapId() });
ACTIONS.hubSpin = () => {
  hubEd.spin = !hubEd.spin;
  hubViewBar();
};
ACTIONS.hubSide = d => {
  if (!hubEd.goal) return;
  hubEd.spin = false;
  hubEd.goal.yaw = hubYawNear(hubEd.goal.yaw, HUB_SIDES[d.s]);
  hubViewBar();
};
ACTIONS.hubFrame = () => {
  const sc = walkView.sc;
  if (!sc || !hubEd.goal) return;
  const [cx, cz] = hubIslandCentre(sc),
    f = hubViewFrame(sc, groundHeightAt(cx, cz));
  f.yaw = hubEd.goal.yaw;
  hubEd.goal = f;
};
ACTIONS.hubWalk = () => {
  const sc = hubShown(),
    P = walkView.pl;
  if (hubEd.walk) {
    hubEd.walk = false;
    P.route = null;
    P.goal = null;
    hubEd.at = 0;
    hubViewBar();
    return;
  }
  const lap = hubCoastLap(sc);
  if (!lap.length) return void toast('The map has no coast to walk round.');
  hubEd.walk = true;
  hubEd.spin = false;
  const start = walkablePointNear(lap[0][0], lap[0][1]);
  P.x = start[0];
  P.z = start[1];
  const go = () => {
    if (!hubEd.walk || studioState.sec !== 'hub') return;
    P.route = [[P.x, P.z]].concat(lap.slice(1));
    P.ri = 1;
    P.rush = 1;
    P.goal = go;
  };
  go();
  hubViewBar();
};
ACTIONS.hubLock = () => {
  const sc = hubMap();
  if (hubGenShowing()) return void toast('Use this island or discard the draft first.');
  if (hubViewOnlyReason(sc) || islandProblems(sc).length) return;
  hubLockGround(sc, islandGroundHash);
  changed();
  commit(true);
  render();
  toast('The ground is locked. Props stay free.');
};
ACTIONS.hubUnlock = async () => {
  const sc = hubMap();
  if (
    !(await ask(
      "Unlock the island's ground? Its letters, heights, steps, coast and zones can change again until you lock it again.",
      'Unlock'
    ))
  )
    return;
  hubUnlockGround(sc);
  changed();
  commit(true);
  render();
};
document.addEventListener('keydown', ev => {
  if (
    studioState.sec !== 'hub' ||
    ev.target.closest('input,select,textarea') ||
    $('#modal').innerHTML ||
    $('#dlg').innerHTML ||
    ev.ctrlKey ||
    ev.metaKey ||
    ev.altKey ||
    (previewViewport.hover && hubEd.walk)
  )
    return;
  const t = { b: 'paint', h: 'height', z: 'points', v: 'pivot' }[ev.key.toLowerCase()];
  if (t && !hubRefusal(hubMap())) {
    hubEd.tool = t;
    hubEd.addKind = '';
    render();
  }
});

/* ================= the generator's dials (island track IS-6b) =================
   IS-2's islandGenerate in the editor: the map's own dials and seed to start, a draft made 0.5 s after a dial stops
   moving (about 2 s of work on the page), shown in the orbit view and on the map under the id `_hubgen` (the draft is
   not game data: never in D.maps, Undo or a save). "Use this island" puts its ground on the map in one undo step
   (logic/hub-island.js hubUseIsland): the generator keeps the locked zones (and their plots), the map keeps its
   props, people and look. A locked ground shows its dials read-only and is never made again. */
const HUB_DRAFT_ID = '_hubgen';
const hubGen = {
  on: false,
  mapId: /** @type {string|null} */ (null),
  dials: /** @type {any} */ ({}),
  seed: '',
  draft: /** @type {any} */ (null),
  notes: /** @type {string[]} */ ([]),
  err: '',
  busy: false,
  ms: 0,
  n: 0,
  walk: /** @type {string[]|null} */ (null),
  open: /** @type {Record<string, boolean>} */ ({ size: true }),
};
const HUB_GEN_ANGLE = 'Degrees: 0 east, 90 north, 180 west, 270 south (the town’s side)';
/* [path, label, min, max, step, help] a slider; [path, label, 'bool'|'sel'|'arcs'|'zones', ...] */
const HUB_GEN_DIALS = [
  [
    'size',
    'Size and coast',
    [
      [
        'size.r',
        'Land radius (m)',
        20,
        120,
        1,
        'The land round the middle; the coast is pushed out further round the zones',
      ],
      ['size.wobble', 'Coast wobble', 0, 1, 0.05],
      ['size.stretch', 'Longer island', 0, 1, 0.05, 'Up to 1.3 times as long as it is wide'],
      ['size.lobes', 'Lobes and a peninsula', 0, 1, 0.05],
      ['size.sea', 'Open sea past the coast (m)', 4, 40, 1],
      [
        'organic',
        'Natural shapes',
        0,
        1,
        0.05,
        '0: plain geometry (a round coast, rectangles, a cone, straight paths)',
      ],
      ['shore', 'Narrow shore (m)', 1, 10, 0.5, 'The beach’s width where no long beach is'],
    ],
  ],
  [
    'mountain',
    'Mountain and hills',
    [
      ['mountain.r', 'Foot radius (m)', 0, 72, 1, 'At most 0.6 of the land radius'],
      ['mountain.peak', 'Peak (m)', 0, 40, 0.5],
      ['mountain.cliffs', 'Shelf height', 0, 1, 0.05, '0.8 m shelves up to 2 m cliffs'],
      ['mountain.stretch', 'Long ridge', 0, 1, 0.05],
      ['mountain.shoulder', 'Shoulder peak', 0, 1, 0.05],
      ['mountain.range', 'Range round it', 0, 1, 0.05, '2 to 6 lower peaks and ridges'],
      ['hills', 'Rolling land', 0, 1, 0.05, 'Up to 1.6 m'],
    ],
  ],
  [
    'cove',
    'Cove',
    [
      ['cove.on', 'A cove', 'bool'],
      ['cove.a', 'Where (°)', 0, 359, 1, HUB_GEN_ANGLE],
      ['cove.span', 'Width (°)', 10, 90, 1],
      ['cove.depth', 'Depth (m)', 4, 60, 1, 'At most half the land radius'],
      ['cove.channel', 'Deep channel from the dock (m)', 0, 12, 0.5],
      ['cove.beach', 'Inner beach (m)', 0, 16, 0.5],
      ['cove.shape', 'Shape', 'sel', { bay: 'A wide bay', cove: 'A horseshoe cove' }],
    ],
  ],
  [
    'shore',
    'Beaches, cliffs, dunes, heath',
    [
      ['beaches', 'Long beaches', 'arcs', ['w', 'Width (m)', 0, 30, 1]],
      ['cliffs', 'Cliffs', 'arcs', ['h', 'Height (m)', 0, 20, 0.5]],
      ['dunes.a', 'Dunes: where (°)', 0, 359, 1, HUB_GEN_ANGLE],
      ['dunes.span', 'Dunes: width (°)', 0, 360, 1],
      ['heath.a', 'Heath: where (°)', 0, 359, 1, HUB_GEN_ANGLE],
      ['heath.span', 'Heath: width (°)', 0, 360, 1],
    ],
  ],
  [
    'forest',
    'Forest',
    [
      ['forest.a', 'Where (°)', 0, 359, 1, HUB_GEN_ANGLE],
      ['forest.span', 'Arc (°)', 0, 360, 1],
      ['forest.deep', 'Depth from the mountain’s foot (m)', 0, 60, 1],
      ['forest.density', 'Density', 0, 1, 0.05],
    ],
  ],
  [
    'stream',
    'Stream',
    [
      ['stream.on', 'A stream from a pond to the cove', 'bool'],
      ['stream.pond', 'Pond (m)', 0, 12, 0.5],
      ['stream.fall', 'Fall (m)', 0, 2, 0.1],
    ],
  ],
  [
    'paths',
    'Paths',
    [
      ['paths.width', 'Width (m)', 1.2, 5, 0.1],
      ['paths.inland', 'Coast road inland (m)', 0, 12, 0.5],
      ['paths.wander', 'Wander', 0, 1, 0.05],
    ],
  ],
  [
    'town',
    'Town, hamlet, barn',
    [
      ['town.on', 'The town on the river', 'bool'],
      ['town.houses', 'Houses', 0, 40, 1],
      ['town.lanes', 'Side lanes', 0, 6, 1],
      ['hamlet.on', 'A hamlet', 'bool'],
      ['hamlet.houses', 'Hamlet houses', 0, 10, 1],
      ['level', 'Flat zones’ level (m)', 0.3, 6, 0.1],
      ['zones', 'Flat zones', 'zones'],
    ],
  ],
];
const HUB_GEN_STAGE_NAMES = {
  coast: 'Coast',
  heights: 'Land',
  mountain: 'Mountain',
  water: 'Water',
  paths: 'Paths',
  trail: 'Trail',
  ground: 'Ground',
};
const hubGenGet = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const hubGenCopy = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const hubGenDefault = path => hubGenGet(ISLAND_GEN_DEFAULTS, path);
const hubGenValue = path => hubGenGet(hubGen.dials, path) ?? hubGenDefault(path);
/** a dial set by path; a list (beaches, cliffs, zones) is copied into the dials whole before one of its rows changes */
function hubGenSet(path, v) {
  const ks = path.split('.'),
    last = ks.pop();
  if (Array.isArray(hubGenDefault(ks[0] || last)) && !Array.isArray(hubGen.dials[ks[0] || last]))
    hubGen.dials[ks[0] || last] = hubGenCopy(hubGenValue(ks[0] || last));
  let t = hubGen.dials;
  for (const k of ks) t = t[k] == null ? (t[k] = {}) : t[k];
  t[last] = v;
}
const hubGenOwn = path => JSON.stringify(hubGenValue(path)) !== JSON.stringify(hubGenDefault(path));
const hubGenNum = (v, step) => (typeof v === 'number' ? +v.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0) : v);
/** the draft is what the orbit view and the map show */
const hubGenShowing = () => !!(hubGen.on && hubGen.draft && hubGen.mapId === studioState.sel.hub);
/** what the view and the map draw: the draft, else the map */
const hubShown = () => (hubGenShowing() ? hubGen.draft : hubMap());

/* the renderer reads scenes through walkData: the Studio's (Walk scenes' draft included), with this draft on top */
{
  const base = walkData;
  let view = { scenes: null, draft: null, out: null };
  setWalkData(() => {
    const r = base();
    if (!hubGenShowing()) return r;
    if (view.scenes !== r.scenes || view.draft !== hubGen.draft)
      view = {
        scenes: r.scenes,
        draft: hubGen.draft,
        out: Object.assign(Object.create(r.scenes), { [HUB_DRAFT_ID]: hubGen.draft }),
      };
    return { ...r, scenes: view.out };
  });
}

/* ---------- the card ---------- */
function hubGenHTML(sc) {
  const ro = hubViewOnlyReason(sc);
  if (ro) return `<p class="help">${escapeHtml(ro)}</p>`;
  const locked = hubGroundLocked(sc);
  if (!hubGen.on || hubGen.mapId !== hubMapId())
    return `<p class="help">IS-2's island generator: the coast, the mountain, the cove, beaches, forest, stream, paths, the town and the hamlet from dials and a seed. The draft shows in the orbit view and on the map; <b>Use this island</b> puts its ground on the map (one undo step). Locked zones and their plots are left as they are; props, people and the look stay.</p>
<div class="seg-row"><button class="btn" data-act="hubGenOpen">${locked ? 'Show the dials it was made with' : 'Make it again from dials…'}</button></div>`;
  const dis = locked ? 'disabled' : '',
    kept = (sc.zones || []).filter(Z => Z.lock).map(Z => Z.k),
    S = hubGen.dials.seeds || {};
  return `${locked ? `<p class="hub-note">${escapeHtml(hubGenRefusal(sc))}</p>` : ''}
<div class="seg-row hub-gen-acts">${locked ? '' : `<button class="btn primary" data-act="hubGenUse" ${hubGen.draft && !hubGen.busy ? '' : 'disabled'} title="The draft's ground onto the map (one undo step; Ctrl+S saves it)">Use this island</button>`}<button class="btn subtle" data-act="hubGenClose">${hubGen.draft ? 'Discard the draft' : 'Close the dials'}</button></div>
${locked ? '' : `<div id="hubGenStats">${hubGenStatsHTML()}</div>`}
<p class="help">${kept.length ? `Kept as they are (locked zones): ${kept.map(escapeHtml).join(', ')}.` : 'No locked zones: the whole ground is made again.'}</p>
<section class="card eng-g open"><div class="card-b eng-fields">
 <div class="eng-f"><span class="eng-lab">Seed</span><div class="gen-wh"><input type="text" id="hubGenSeed" value="${escapeHtml(hubGen.seed)}" aria-label="Seed" ${dis}><button class="btn sm" data-act="hubGenSeed" title="A new seed for everything" ${dis}>🎲 New seed</button></div>
 <div class="gen-reroll"><small class="help">New seed for one part only (Alt-click: back to the main seed):</small>${ISLAND_GEN_STAGES.map(
   st =>
     `<button class="btn sm subtle ${S[st] != null ? 'on' : ''}" data-act="hubGenReroll" data-st="${st}" title="${S[st] != null ? 'Its own seed ' + escapeHtml(String(S[st])) : 'Uses the main seed'}" ${dis}>🎲 ${HUB_GEN_STAGE_NAMES[st] || st}</button>`
 ).join('')}</div></div>
</div></section>
${HUB_GEN_DIALS.map(g => hubGenGroupHTML(g, dis)).join('')}`;
}
function hubGenGroupHTML([g, title, fields], dis) {
  const open = !!hubGen.open[g],
    set = fields.filter(f => hubGenOwn(f[0])).length;
  return `<section class="card eng-g ${open ? 'open' : ''}"><header><button class="eng-gh" data-act="hubGenG" data-g="${g}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${escapeHtml(title)}</h3>${set ? `<span class="badge">${set} set</span>` : ''}</button>${set && !dis ? `<button class="btn sm subtle" data-act="hubGenResetG" data-g="${g}">Reset</button>` : ''}</header>
${open ? `<div class="card-b eng-fields">${fields.map(f => hubGenDialHTML(f, dis)).join('')}</div>` : ''}</section>`;
}
function hubGenDialHTML(f, dis) {
  const [path, label] = f,
    typ = typeof f[2] === 'string' ? f[2] : 'range',
    v = hubGenValue(path),
    def = hubGenDefault(path);
  const reset = dis
    ? ''
    : `<button class="eng-reset" data-act="hubGenReset" data-path="${path}" title="Back to ${escapeHtml(Array.isArray(def) ? 'the defaults' : typ === 'sel' ? f[3][def] : String(def))}">↺</button>`;
  let body = '';
  if (typ === 'range')
    body = `<span class="eng-lab">${escapeHtml(label)} <output data-hubgen-out="${path}">${hubGenNum(v, f[4])}</output></span><input type="range" data-hubgen="${path}" data-k="num" value="${v}" min="${f[2]}" max="${f[3]}" step="${f[4]}" ${dis}>`;
  else if (typ === 'bool')
    body = `<label class="eng-chk"><input type="checkbox" data-hubgen="${path}" data-k="bool" ${v ? 'checked' : ''} ${dis}><span>${escapeHtml(label)}</span></label>`;
  else if (typ === 'sel')
    body = `<span class="eng-lab">${escapeHtml(label)}</span><select data-hubgen="${path}" data-k="sel" ${dis}>${Object.entries(
      f[3]
    )
      .map(([a, n]) => `<option value="${a}" ${v === a ? 'selected' : ''}>${escapeHtml(n)}</option>`)
      .join('')}</select>`;
  else if (typ === 'arcs') body = hubGenArcsHTML(path, label, v || [], f[3], dis);
  else if (typ === 'zones') body = hubGenZonesHTML(v || [], dis);
  return `<div class="eng-f ${hubGenOwn(path) ? 'own' : ''}">${body}${reset}${f[5] ? `<small class="help">${escapeHtml(f[5])}</small>` : ''}</div>`;
}
const hubGenNumIn = (path, v, lo, hi, st, name, dis) =>
  `<label><small>${escapeHtml(name)}</small><input type="number" data-hubgen="${path}" data-k="num" value="${v}" min="${lo}" max="${hi}" step="${st}" ${dis}></label>`;
function hubGenArcsHTML(path, label, L, [k, name, lo, hi, st], dis) {
  return `<span class="eng-lab">${escapeHtml(label)}</span>${L.map(
    (b, i) =>
      `<div class="hub-gen-row">${hubGenNumIn(`${path}.${i}.a`, b.a, 0, 359, 1, 'Where (°)', dis)}${hubGenNumIn(`${path}.${i}.span`, b.span, 4, 180, 1, 'Width (°)', dis)}${hubGenNumIn(`${path}.${i}.${k}`, b[k], lo, hi, st, name, dis)}${dis ? '' : `<button class="btn sm subtle" data-act="hubGenRowDel" data-path="${path}" data-i="${i}" aria-label="Remove">×</button>`}</div>`
  ).join('')}${dis ? '' : `<button class="btn sm subtle" data-act="hubGenRowAdd" data-path="${path}">+ Add</button>`}`;
}
function hubGenZonesHTML(L, dis) {
  return `<span class="eng-lab">Flat zones (a town here makes the old flat town instead of the river town)</span>${L.map(
    (Z, i) =>
      `<div class="hub-gen-row"><b>${escapeHtml(Z.k)}</b>${hubGenNumIn(`zones.${i}.a`, Z.a, 0, 359, 1, 'Where (°)', dis)}${hubGenNumIn(`zones.${i}.d`, Z.d, 0, 200, 1, 'Out (m)', dis)}${hubGenNumIn(`zones.${i}.w`, Z.w, 4, 120, 1, 'Across (m)', dis)}${hubGenNumIn(`zones.${i}.h`, Z.h, 4, 120, 1, 'Deep (m)', dis)}${dis ? '' : `<button class="btn sm subtle" data-act="hubGenRowDel" data-path="zones" data-i="${i}" aria-label="Remove">×</button>`}</div>`
  ).join(
    ''
  )}${dis ? '' : `<div class="seg-row">${ISLAND_GEN_BUILT.map(k => `<button class="btn sm subtle" data-act="hubGenZoneAdd" data-k="${k}">+ ${k}</button>`).join('')}</div>`}`;
}
function hubGenStatsHTML() {
  if (hubGen.busy) return '<p class="help">Generating…</p>';
  if (hubGen.err) return `<p class="help warn">${escapeHtml(hubGen.err)}</p>`;
  const d = hubGen.draft;
  if (!d) return '<p class="help">Move a dial to make a draft.</p>';
  const s = hubGenStats(d),
    plots = Object.entries(s.plots)
      .map(([k, n]) => `${n} ${k}`)
      .join(', '),
    P = islandProblems(d),
    W = hubGen.walk;
  return `<p class="hub-note">Draft, not saved: the orbit view and the map show it.</p>
<p class="help">${s.w} × ${s.h} m scene · land ${s.land[0]} × ${s.land[1]} m · the coast walk ${s.lap} m (about ${s.lapS} s) · ${(d.bridges || []).length} bridges${plots ? ' · plots: ' + escapeHtml(plots) : ''} · made in ${Math.round(hubGen.ms)} ms</p>
${hubGen.notes.length ? `<p class="help warn">${hubGen.notes.map(escapeHtml).join('; ')}</p>` : ''}
${P.length ? `<p class="help warn">The island's own problems (Lock the ground refuses them):</p><ul class="hub-probs">${P.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
<div class="seg-row"><button class="btn sm" data-act="hubGenWalk" title="From the hub: every zone, the summit, the dock and every plot's front walked to, and nowhere you get stuck (about a second)">Check the walks</button>${W ? (W.length ? '' : '<span class="help">Every zone, the summit, the dock and every plot can be walked to.</span>') : ''}</div>
${W && W.length ? `<ul class="hub-probs">${W.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}`;
}
const hubGenCard = () => {
  const el = $('#hubGen'),
    sc = hubMap();
  if (el && sc) el.innerHTML = hubGenHTML(sc);
};
const hubGenStatus = () => {
  const el = $('#hubGenStats');
  if (el) el.innerHTML = hubGenStatsHTML();
  const u = $('[data-act="hubGenUse"]');
  if (u) u.disabled = !hubGen.draft || hubGen.busy;
};

/* ---------- making the draft ---------- */
let hubGenTimer = 0;
/** a draft soon: the card says "Generating…" first, so it shows before the page is busy */
function hubGenSoon(ms = 500) {
  clearTimeout(hubGenTimer);
  hubGen.busy = true;
  hubGenStatus();
  hubGenTimer = setTimeout(hubGenRun, ms);
}
function hubGenRun() {
  const sc = hubMap();
  hubGen.busy = false;
  if (!sc || !hubGen.on || hubGenRefusal(sc)) return hubGenStatus();
  const t = performance.now(),
    was = hubGenShowing();
  try {
    const r = islandGenerate(hubGen.dials, hubGen.seed, { scenery: sceneryCatalog() }, sc);
    /* a new draft is new ground (the ground cache reads stepsV) */
    r.scene.stepsV = ++hubGen.n;
    r.scene.name = 'Draft';
    hubGen.draft = r.scene;
    hubGen.notes = r.notes;
    hubGen.err = '';
  } catch (e) {
    hubGen.draft = null;
    hubGen.notes = [];
    hubGen.err = /no longer fits/.test(e.message)
      ? 'This island doesn’t fit round the map’s middle: its coast would cross the map’s west or south edge. The map keeps its middle, so its locked zones, props and people stay where they are. Try another seed (or one part’s), a smaller land radius or open sea, or less stretch and lobes.'
      : `The generator stopped: ${e.message}`;
  }
  hubGen.ms = performance.now() - t;
  hubGen.walk = null;
  hubGroundChanged();
  if (studioState.sec !== 'hub') return;
  /* a draft shown or gone: the map's tools turn off or on again with the whole section */
  if (was !== hubGenShowing()) return void render();
  hubGenStatus();
  drawHubMap();
  mountHubView();
}

/* ---------- the dials' fields ---------- */
function hubGenInput(ev, settle) {
  const t = ev.target;
  if (!t || !t.dataset || (!t.dataset.hubgen && t.id !== 'hubGenSeed') || !hubGen.on) return;
  if (t.id === 'hubGenSeed') {
    if (!settle) return;
    hubGen.seed = t.value.trim() || hubMapId();
    return void hubGenSoon(30);
  }
  const path = t.dataset.hubgen,
    k = t.dataset.k,
    v = k === 'bool' ? (t.checked ? 1 : 0) : k === 'num' ? parseFloat(t.value) : t.value;
  if (k === 'num' && !Number.isFinite(v)) return;
  hubGenSet(path, v);
  const o = document.querySelector(`[data-hubgen-out="${path}"]`);
  if (o) o.textContent = String(hubGenNum(v, +(t.step || 1)));
  const f = t.closest('.eng-f');
  const top = path.split('.')[0];
  if (f) f.classList.toggle('own', hubGenOwn(Array.isArray(hubGenDefault(top)) ? top : path));
  if (settle && k !== 'num') hubGenCard();
  hubGenSoon();
}
document.addEventListener('input', ev => hubGenInput(ev, false));
document.addEventListener('change', ev => hubGenInput(ev, true));

/* ---------- actions ---------- */
function hubGenStop() {
  clearTimeout(hubGenTimer);
  const had = hubGen.draft;
  Object.assign(hubGen, { on: false, draft: null, notes: [], err: '', busy: false, walk: null });
  if (had) hubGroundChanged();
}
ACTIONS.hubGenOpen = () => {
  const sc = hubMap(),
    id = hubMapId();
  if (!sc || hubViewOnlyReason(sc)) return;
  const g = hubGenStart(sc, id);
  Object.assign(hubGen, { on: true, mapId: id, dials: g.dials, seed: g.seed, draft: null, err: '', walk: null });
  hubGenCard();
  if (!hubGenRefusal(sc)) hubGenSoon(30);
};
ACTIONS.hubGenClose = () => {
  hubGenStop();
  render();
};
ACTIONS.hubGenG = d => {
  hubGen.open[d.g] = !hubGen.open[d.g];
  hubGenCard();
};
ACTIONS.hubGenReset = d => {
  const ks = d.path.split('.'),
    last = ks.pop();
  let t = hubGen.dials;
  for (const k of ks) t = t && t[k];
  if (t) delete t[last];
  hubGenCard();
  hubGenSoon(30);
};
ACTIONS.hubGenResetG = d => {
  const G = HUB_GEN_DIALS.find(g => g[0] === d.g);
  if (G) for (const f of G[2]) ACTIONS.hubGenReset({ path: f[0] });
};
ACTIONS.hubGenRowDel = d => {
  hubGenSet(
    d.path,
    hubGenValue(d.path).filter((_, i) => i !== +d.i)
  );
  hubGenCard();
  hubGenSoon(30);
};
ACTIONS.hubGenRowAdd = d => {
  const row = d.path === 'cliffs' ? { a: 0, span: 20, h: 4 } : { a: 0, span: 30, w: 10 };
  hubGenSet(d.path, hubGenValue(d.path).concat([row]));
  hubGenCard();
  hubGenSoon(30);
};
ACTIONS.hubGenZoneAdd = d => {
  hubGenSet('zones', hubGenValue('zones').concat([{ k: d.k, a: 270, d: 50, w: 20, h: 16 }]));
  hubGenCard();
  hubGenSoon(30);
};
ACTIONS.hubGenSeed = () => {
  hubGen.seed = String(Math.floor(Math.random() * 1e6));
  hubGen.dials.seeds = {};
  hubGenCard();
  hubGenSoon(30);
};
ACTIONS.hubGenReroll = (d, el, ev) => {
  const S = hubGen.dials.seeds || (hubGen.dials.seeds = {});
  if (ev && ev.altKey) delete S[d.st];
  else S[d.st] = String(Math.floor(Math.random() * 1e6));
  hubGenCard();
  hubGenSoon(30);
};
ACTIONS.hubGenWalk = () => {
  if (!hubGen.draft) return;
  hubGen.walk = hubGenWalkProblems(hubGen.draft, sceneryCatalog());
  hubGenStatus();
};
ACTIONS.hubGenUse = () => {
  const sc = hubMap(),
    d = hubGen.draft;
  if (!sc || !d || hubGen.busy) return;
  const why = hubGenRefusal(sc);
  if (why) return void toast(why);
  const { wet } = hubUseIsland(sc, d);
  hubGen.draft = null;
  hubGen.walk = null;
  hubGroundChanged();
  changed();
  commit(true);
  render();
  const more = [];
  if (wet.length)
    more.push(
      `${wet.length} prop${wet.length > 1 ? 's are' : ' is'} now out at sea (${[...new Set(wet.map(p => p.k))].slice(0, 4).join(', ')}): move ${wet.length > 1 ? 'them' : 'it'} in Walk scenes`
    );
  if (Array.isArray(sc.checks) && sc.checks.length)
    more.push("the map's in-game checks were written for the old ground");
  toast(
    `The island's ground is the draft's now (Undo takes it back).${more.length ? ' ' + more.join('; ') + '.' : ''}`
  );
};
