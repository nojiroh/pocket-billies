'use strict';
/* ================= POCKET BILLIES STUDIO · walk scenes =================
   Each route stop shows a tilt-shift diorama on the Walk screen (game/js/walk-view.js). A scene is a grid of ground
   tiles (one character per tile), a list of props, a walking path and a camera. Props and ground tiles are PNG files
   in art/scene/ that can be painted here. The live preview runs the game's own renderer on your unsaved changes. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  blocksToolBarHTML,
  camZoneToolBarHTML,
  drawExtraTools,
  drawPropEditor,
  extraMapTools,
  extraToolHint,
  extraToolPointerDown,
  extraToolPointerMove,
  extraToolPointerUp,
  mountPropTurntable,
  multiSelectCardHTML,
  previewViewport,
  propEditorCardHTML,
  provide,
  scatterToolBarHTML,
  waterToolsSceneBarHTML,
  waterToolsSceneDown,
  waterToolsSceneDraw,
  waterToolsSceneMove,
  waterToolsSceneUp,
} from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { turnedPoint } from '../../game/js/logic/prop-turn.js';
import { roomTurnOf } from '../../game/js/logic/room-turn.js';
import { WATER_KINDS } from '../../game/js/logic/water-kinds.js';
import {
  storyNamesIn,
  storyPreviewAllows,
  storyPreviewSave,
  storySwitchesText,
} from '../../game/js/logic/story-checks.js';
import { ART_CACHE, makeCanvas } from '../../game/js/art.js';
import {
  MAX_STEP_RISE,
  ROOM_BY_USE,
  artImage,
  canStepBetween,
  exitEdge,
  exitPoint,
  findPath,
  mapHub,
  navGrid,
  newStepGrid,
  pointAlongMapPath,
  setArtImage,
  setWalkData,
  stepGrid,
  storeStepGrid,
  walkView,
} from '../../game/js/walk-view.js';
import { environment } from '../../game/js/environment.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { WALL_MATERIALS, rawHeightAt } from '../../game/js/walk/heights.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { PEOPLE, escapeHtml } from './game-stand-ins.js';
import { pixelKeyAction } from '../../game/js/logic/pixel-ops.js';
import { groundLockRefusal } from '../../game/js/logic/hub-island.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  colorField,
  commit,
  dialog,
  drawSoon,
  grid,
  numberField,
  peopleOptions,
  rangeField,
  render,
  selectField,
  studioBroadcast,
  studioState,
  textField,
  toast,
  uniqueKey,
} from './studio-app.js';
import {
  artStep,
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
import { conditionField, lineIdHash, scriptField } from './story-editor.js';
import { atlasGet, atlasVersion, fileToCanvas, loadedAtlas, markArt, pickFile } from './sprites.js';
import { freeCameraBarHTML, freeCameraLook, freeCameraSpot } from './free-camera.js';
/* eslint-disable no-func-assign */
expose({
  GROUND_KEYS: [() => GROUND_KEYS],
  LOCKED_GROUND_TOOLS: [() => LOCKED_GROUND_TOOLS],
  PAINTED_WATER_KINDS: [() => PAINTED_WATER_KINDS],
  WATER_KIND_SWATCHES: [() => WATER_KIND_SWATCHES],
  WATER_TOOL_MODES: [() => WATER_TOOL_MODES],
  addSceneryProp: [() => addSceneryProp, v => (addSceneryProp = v)],
  applyPreviewEnvironment: [() => applyPreviewEnvironment, v => (applyPreviewEnvironment = v)],
  artCacheVersion: [() => artCacheVersion, v => ((artCacheVersion = v), provide({ artCacheVersion }))],
  bindEditorMap: [() => bindEditorMap, v => (bindEditorMap = v)],
  blankMap: [() => blankMap, v => (blankMap = v)],
  currentMap: [() => currentMap],
  currentMapId: [() => currentMapId],
  drawEditorMap: [() => drawEditorMap, v => (drawEditorMap = v)],
  drawPropFacing: [() => drawPropFacing, v => (drawPropFacing = v)],
  drawScenePeople: [() => drawScenePeople, v => (drawScenePeople = v)],
  drawSceneryThumbs: [() => drawSceneryThumbs, v => (drawSceneryThumbs = v)],
  drawStepsOverlay: [() => drawStepsOverlay, v => (drawStepsOverlay = v)],
  drawWatersOverlay: [() => drawWatersOverlay, v => (drawWatersOverlay = v)],
  dropStaleExitJoins: [() => dropStaleExitJoins, v => (dropStaleExitJoins = v)],
  edgeExitId: [() => edgeExitId, v => (edgeExitId = v)],
  ensureHeightGrid: [() => ensureHeightGrid, v => (ensureHeightGrid = v)],
  exitChecks: [() => exitChecks, v => (exitChecks = v)],
  floodFillGround: [() => floodFillGround, v => (floodFillGround = v)],
  isGroundKey: [() => isGroundKey],
  locationsUsingMap: [() => locationsUsingMap],
  mapEditor: [() => mapEditor],
  mapExitNames: [() => mapExitNames, v => (mapExitNames = v)],
  mapLifeText: [() => mapLifeText, v => (mapLifeText = v)],
  mapPointer: [() => mapPointer, v => (mapPointer = v)],
  mapToolHint: [() => mapToolHint, v => (mapToolHint = v)],
  mountMapEditor: [() => mountMapEditor, v => (mountMapEditor = v)],
  mountMapPreview: [() => mountMapPreview, v => (mountMapPreview = v)],
  mountSceneryPixelEditor: [() => mountSceneryPixelEditor, v => (mountSceneryPixelEditor = v)],
  newEdgeExitName: [() => newEdgeExitName, v => (newEdgeExitName = v)],
  openSceneryPixelEditor: [() => openSceneryPixelEditor, v => (openSceneryPixelEditor = v)],
  paintGroundBrush: [() => paintGroundBrush, v => (paintGroundBrush = v)],
  paintMapTile: [() => paintMapTile, v => (paintMapTile = v)],
  paintStepCells: [() => paintStepCells, v => (paintStepCells = v)],
  parseMapLife: [() => parseMapLife, v => (parseMapLife = v)],
  playFromHereURL: [() => playFromHereURL, v => (playFromHereURL = v)],
  playSpot: [() => playSpot, v => (playSpot = v)],
  previewPeople: [() => previewPeople, v => (previewPeople = v)],
  propAtPointer: [() => propAtPointer, v => (propAtPointer = v)],
  resizeReport: [() => resizeReport, v => (resizeReport = v)],
  sceneryArtPaths: [() => sceneryArtPaths, v => ((sceneryArtPaths = v), provide({ sceneryArtPaths }))],
  sceneryCatalog: [() => sceneryCatalog],
  sceneryPixelCardHTML: [() => sceneryPixelCardHTML, v => (sceneryPixelCardHTML = v)],
  sceneryPixelPalette: [() => sceneryPixelPalette, v => (sceneryPixelPalette = v)],
  sceneryPixelsChanged: [() => sceneryPixelsChanged, v => (sceneryPixelsChanged = v)],
  sculptHeights: [() => sculptHeights, v => (sculptHeights = v)],
  segmentDistance: [() => segmentDistance, v => (segmentDistance = v)],
  stepsPointerDown: [() => stepsPointerDown, v => (stepsPointerDown = v)],
  stepsPointerUp: [() => stepsPointerUp, v => (stepsPointerUp = v)],
  stepsToolBarHTML: [() => stepsToolBarHTML, v => (stepsToolBarHTML = v)],
  storyAllows: [() => storyAllows, v => ((storyAllows = v), provide({ storyAllows }))],
  storyPreviewBarHTML: [() => storyPreviewBarHTML, v => (storyPreviewBarHTML = v)],
  storyPreviewChanged: [() => storyPreviewChanged, v => (storyPreviewChanged = v)],
  storyPvAt: [() => storyPvAt, v => (storyPvAt = v)],
  storyPvNow: [() => storyPvNow],
  storyPvSave: [() => storyPvSave, v => (storyPvSave = v)],
  syncEdgeExits: [() => syncEdgeExits, v => (syncEdgeExits = v)],
  waterPointerUp: [() => waterPointerUp, v => (waterPointerUp = v)],
  waterRectAt: [() => waterRectAt, v => (waterRectAt = v)],
  waterToolBarHTML: [() => waterToolBarHTML, v => (waterToolBarHTML = v)],
  waterToolRefusal: [() => waterToolRefusal],
  watersChanged: [() => watersChanged, v => (watersChanged = v)],
  workingStepGrid: [() => workingStepGrid, v => (workingStepGrid = v)],
});
/* eslint-enable no-func-assign */
provide({ artCacheVersion, sceneryArtPaths, storyAllows });
/* to-module: end */
setWalkData(() => ({
  scenes: (studioState.D && studioState.D.maps) || {},
  sc: (studioState.D && studioState.D.scenery) || { terrains: {}, props: {} },
}));
setArtImage(path => loadedAtlas('art/' + path) || ART_CACHE.img[path]);
function artCacheVersion() {
  return atlasVersion;
}
export const mapEditor = {
  smode: 'cliff',
  sh: 1.5,
  smat: 0,
  bkind: 'wood',
  bw: 1.6,
  walkOv: false,
  stE: null,
  hmode: 'raise',
  hstr: 0.25,
  pv: 'roam',
  pvPos: null,
  tool: 'paint',
  ter: 'g',
  brush: 1,
  prop: null,
  sel: null,
  zoom: 22,
  drag: null,
  t: 0.42,
  enc: true,
  npc: false,
  tag: '',
  pe: null,
  peZoom: 12,
  peTool: 'pen',
  peColor: '#2A2238',
  peKeep: null /* studio track ST-2: the painter's zoom, grid, symmetry and palette lock across redraws */,
  pePc: null,
  /* Project Story S3: the story preview (a start preset and flags switched on or off; v counts the changes) */
  story: { on: false, preset: '', flags: {}, faded: true, v: 0 },
};
/* every picture a scene can use: ground tiles and their variants, props and their layers, 3D building textures, life */
export function sceneryArtPaths(C) {
  C = C || sceneryCatalog();
  const L = new Set();
  for (const t of Object.values(C.terrains)) {
    L.add(t.tile);
    for (const v of t.vars || []) L.add(v);
  }
  for (const P of Object.values(C.props)) {
    L.add(P.img);
    if (P.blades) L.add(P.blades.img);
    for (const l of P.layers || []) if (l.img) L.add(l.img);
  }
  const A = C.buildArt || { detail: 'scene/build/detail.png', rooms: 'scene/build/rooms.png' };
  L.add(A.detail);
  L.add(A.rooms);
  L.add(C.wallArt || 'scene/build/walls.png');
  for (const m of Object.values(C.life || {})) L.add(m.img);
  return [...L].filter(Boolean);
}
export const sceneryCatalog = () =>
  studioState.D.scenery || (studioState.D.scenery = { ppu: 34, tile: 16, terrains: {}, props: {}, person: 1.75 });
provide({ sceneryCatalog }); /* to-module */
export const currentMapId = () => {
  const S = studioState.D.maps || (studioState.D.maps = {});
  if (!S[studioState.sel.scene]) studioState.sel.scene = Object.keys(S)[0] || null;
  return studioState.sel.scene;
};
export const currentMap = () => {
  const id = currentMapId();
  return id ? studioState.D.maps[id] : null;
};
const locationsUsingMap = id => studioState.D.locations.map((r, i) => [r, i]).filter(([r]) => r.mapId === id);
/* ---------- section ---------- */
SECTIONS.scenes = () => {
  const D = studioState.D,
    id = currentMapId(),
    sc = currentMap();
  afterRender(mountMapEditor);
  /* v46: each scene says what it is (kind: town, route, room, test); the list is grouped by kind and can be filtered */
  const kindOf = ([k, s]) =>
      s.kind || (s.test ? 'test' : s.room ? 'room' : locationsUsingMap(k).some(([r]) => r.town) ? 'town' : 'route'),
    KN = { town: 'Town', route: 'Route', room: 'Room', test: 'Test' };
  const row = ([k, s]) =>
      `<button class="lrow ${k === id ? 'on' : ''}" data-act="scPick" data-k="${escapeHtml(k)}"><b>${escapeHtml(s.name || k)} <span class="kind-badge k-${kindOf([k, s])}">${KN[kindOf([k, s])] || '?'}</span></b><small>${
        s.test
          ? `Test scene · ${(s.checks || []).length} checks`
          : s.room
            ? `Inside a ${escapeHtml(s.building || s.room)}`
            : locationsUsingMap(k)
                .map(([r, i]) => `${i + 1}. ${escapeHtml(r.name)}`)
                .join(', ') || 'Not used by a stop'
      }</small></button>`,
    all = Object.entries(D.maps || {});
  const kf = mapEditor.kindF || '',
    filt = `<div class="seg-row sc-kinds">${[
      ['', 'All'],
      ['town', 'Towns'],
      ['route', 'Routes'],
      ['room', 'Rooms'],
      ['test', 'Tests'],
    ]
      .map(([v, n]) => `<button class="seg ${kf === v ? 'on' : ''}" data-act="scKindF" data-k="${v}">${n}</button>`)
      .join('')}</div>`;
  const list =
    filt +
    ['town', 'route', 'room', 'test']
      .filter(g => !kf || kf === g)
      .map(g => {
        const L = all.filter(e => kindOf(e) === g);
        return L.length
          ? `<div class="list-sub">${{ town: 'Towns', route: 'Routes', room: 'Rooms', test: 'Test scenes (tools/build-test-scenes.py)' }[g]}</div>` +
              L.map(row).join('')
          : '';
      })
      .join('');
  if (!sc)
    return `<div class="ed-col solo"><div class="ed-head"><h2>Walk scenes</h2><button class="btn primary" data-act="scNew">+ New scene</button></div><p class="help">No scenes yet.</p></div>`;
  const p = `maps.${id}`,
    T = sceneryCatalog().terrains;
  const terr = Object.entries(T)
    .map(
      ([ch, t]) =>
        `<button class="sc-ter ${mapEditor.ter === ch ? 'on' : ''}" data-act="scTer" data-c="${escapeHtml(ch)}" title="${escapeHtml(t.name)} (${escapeHtml(ch)})"><canvas data-tile="${escapeHtml(ch)}" width="16" height="16"></canvas><small>${escapeHtml(t.name)}</small></button>`
    )
    .join('');
  const tools = [
    ['paint', 'Paint ground', 'B'],
    ['fill', 'Fill', 'F'],
    ['props', 'Place & move props', 'P'],
    ['height', 'Shape the land', 'H'],
    ['steps', 'Cliffs & stairs', 'C'],
    ['exits', 'Hub & exits', 'X'],
    ['path', 'Edit the path', 'W'],
    ['water', 'Kinds of water', 'Q'],
    ['erase', 'Remove props', 'E'],
    ...(typeof extraMapTools === 'function' ? extraMapTools() : []),
  ]
    .map(
      ([k, n, s]) =>
        `<button class="seg ${mapEditor.tool === k ? 'on' : ''}" data-act="scTool" data-t="${k}" title="${n} (${s})">${n}</button>`
    )
    .join('');
  const tags = [...new Set(Object.values(sceneryCatalog().props).flatMap(P => P.tags || []))].sort();
  const props = Object.entries(sceneryCatalog().props)
    .filter(([k, P]) => !mapEditor.tag || (P.tags || []).includes(mapEditor.tag))
    .map(
      ([k, P]) =>
        `<button class="sc-prop ${mapEditor.prop === k ? 'on' : ''}" data-act="scProp" data-k="${escapeHtml(k)}" title="${escapeHtml(P.name || k)}"><span class="sc-thumb" data-img="${escapeHtml(P.img)}"></span><small>${escapeHtml(P.name || k)}</small></button>`
    )
    .join('');
  const sel =
    mapEditor.sel != null && sc.props[mapEditor.sel] && !(mapEditor.multi && mapEditor.multi.size > 1)
      ? sc.props[mapEditor.sel]
      : null;
  const selCard = sel
    ? `<div class="sc-sel"><b>${escapeHtml((sceneryCatalog().props[sel.k] || {}).name || sel.k)}</b>${grid(numberField('Across', `${p}.props.${mapEditor.sel}.x`, { step: 0.1 }), numberField('Depth', `${p}.props.${mapEditor.sel}.z`, { step: 0.1 }), numberField('Size', `${p}.props.${mapEditor.sel}.s`, { step: 0.05, min: 0.2, max: 4, opt: 1, ph: '1' }), numberField('Turn', `${p}.props.${mapEditor.sel}.rot`, { step: 15, min: -180, max: 180, opt: 1, ph: '0', unit: '°' }))}
  <div class="seg-row sc-turn"><button class="btn sm" data-act="scxTurn" data-by="-15" title="Turn left 15° ([)">⟲ 15°</button><button class="btn sm" data-act="scxTurn" data-by="15" title="Turn right 15° (])">⟳ 15°</button><button class="btn sm" data-act="scxTurn" data-by="90" title="A quarter turn (Shift+])">⟳ 90°</button>${sel.rot ? '<button class="btn sm subtle" data-act="scxTurn" data-to="0">Straight</button>' : ''}<small class="help">[ and ] turn it 15°, with Shift 90°, with Alt 1°. It turns about its base point, the middle of its front.${(() => {
    const P0 = sceneryCatalog().props[sel.k] || {};
    /* rooms face four ways (IS-5, logic/room-turn.js): the room is laid by the quarter turn nearest the building's */
    const off = Math.abs((sel.rot || 0) - roomTurnOf(sel.rot) * 90 + 540) % 360;
    return (P0.door || sel.room) && Math.abs(off - 180) > 15
      ? ' <b>Its room inside is laid square to the nearest quarter turn:</b> keep buildings you walk into within a few degrees of 0, 90, 180 or 270.'
      : '';
  })()}</small></div>
  ${grid(
    selectField(
      'When tapped',
      `${p}.props.${mapEditor.sel}.act`,
      [
        ['shop', 'Open the shop'],
        ['clinic', 'Heal the team (clinic)'],
        ['lab', 'Show a message (lab)'],
        ['house', 'Show a message (house)'],
        ['home', 'Granny Juniper’s cottage (no room)'],
        ['ranch', 'The ranch (walk in; training and storage)'],
        ['enter', 'Walk in (the room set on it or its kind)'],
        ['pasture', 'The pasture’s gate (opens the ranch’s sheet)'],
        ['board', 'The Lab’s unlock board (opens the Lab tab)'],
        ['climb', 'A ladder to climb'],
        ['sign', 'Show a message (sign)'],
        ['talk', 'Show a message'],
        ['fly', 'Airships (fly to a town you’ve been to)'],
        ['lift', 'A lift to another place (set “Goes to”)'],
        ['read', 'A book or a paper to read'],
      ],
      { none: 'Nothing', opt: 1, rr: 1 }
    ),
    ...(sel.act
      ? [
          textField('Label above it', `${p}.props.${mapEditor.sel}.label`, {
            opt: 1,
            ph: sel.act === 'shop' ? 'Shop' : sel.act === 'clinic' ? 'Clinic' : 'none',
          }),
          textField('What it says', `${p}.props.${mapEditor.sel}.say`, { opt: 1 }),
        ]
      : []),
    ...(sel.act === 'lift'
      ? [
          selectField(
            'Goes to',
            `${p}.props.${mapEditor.sel}.to`,
            (studioState.D.locations || []).map(r => [r.id, r.name]),
            { opt: 1 }
          ),
        ]
      : []),
    ...(sel.act === 'shop'
      ? [
          selectField(
            'Which shop',
            `${p}.props.${mapEditor.sel}.shop`,
            Object.entries(studioState.D.shops || {}).map(([k, v]) => [k, v.name]),
            { none: 'The stop’s shop', opt: 1 }
          ),
        ]
      : [])
  )}
  <details class="sc-look"><summary>Look: tint, wear and variety</summary>${grid(colorField('Tint', `${p}.props.${mapEditor.sel}.tint`, { help: 'Black for none. Tints the painted parts only (not outlines, windows or lights).' }), rangeField('Tint strength', `${p}.props.${mapEditor.sel}.tintAmt`, { min: 0, max: 1, step: 0.05, def: 0.6 }), rangeField('Wear and tear (× usual)', `${p}.props.${mapEditor.sel}.wear`, { min: 0, max: 3, step: 0.05, def: 1, help: 'Dirt, moss, faded paint and cracks. The kinds and amounts are set per prop in the prop editor.' }), checkboxField('Exactly as drawn (no size, colour or turn variety)', `${p}.props.${mapEditor.sel}.plain`, { num: 1 }))}</details>
  ${(() => {
    const P0 = sceneryCatalog().props[sel.k] || {};
    if (!P0.build) return '';
    return grid(
      selectField(
        'Roof',
        `${p}.props.${mapEditor.sel}.roof`,
        [
          ['moss', 'A green moss roof'],
          ['solar', 'Solar shingles'],
          ['chrome', 'Chrome (Pearlantis)'],
        ],
        { none: 'Its own roof', opt: 1, rr: 1 }
      ),
      rangeField('Turned (degrees)', `${p}.props.${mapEditor.sel}.rot`, {
        min: -30,
        max: 30,
        step: 1,
        def: 0,
        help: 'alpha 0.4: a building turned a little along its street; its footprint, door and room turn with it.',
      })
    );
  })()}
  ${(() => {
    const P0 = sceneryCatalog().props[sel.k] || {};
    if (!P0.build && !P0.box) return '';
    const rooms = Object.entries(studioState.D.maps)
      .filter(([k, v]) => v.kind === 'room' || /^int_/.test(k))
      .map(([k, v]) => [k, v.name || k]);
    const kindRoom =
      ((studioState.D.scenery.props || {})[sel.k] || {}).room ||
      ROOM_BY_USE[sel.act] ||
      ''; /* walk-view.js doorLinkOf */
    return `<div class="sc-room">${grid(selectField('Room inside', `${p}.props.${mapEditor.sel}.room`, rooms, { none: kindRoom ? 'The one for its kind (' + ((studioState.D.maps[kindRoom] || {}).name || kindRoom) + ')' : 'None', opt: 1, rr: 1, help: 'Where you walk in when you tap it (it needs “When tapped” set). Rooms open in place, larger than the building, with the town dimmed around them.' }))}<div class="seg-row"><button class="btn sm" data-act="scOwnRoom">Give it a room of its own</button>${sel.room || kindRoom ? `<button class="btn sm subtle" data-act="scPick" data-k="${escapeHtml(sel.room || kindRoom)}">Open its room</button>` : ''}</div></div>`;
  })()}
  ${(() => {
    const V = ((sceneryCatalog().props[sel.k] || {}).build || {}).variants;
    if (!V || !V.length) return '';
    const P0 = sceneryCatalog().props[sel.k];
    return `<div class="fld sc-var"><span>Colours</span><div class="sc-var-row">${[{ img: P0.img, wallCol: P0.build.wallCol, roofCol: P0.build.roofCol }, ...V].map((v, i) => `<button class="sc-var-b ${(sel.v | 0) === i ? 'on' : ''}" data-act="scVar" data-v="${i}" title="${i ? 'Variant ' + i : 'As drawn'}"><span class="sc-thumb" data-img="${escapeHtml(v.img)}"></span><i style="background:${escapeHtml(v.roofCol || '#888')}"></i><i style="background:${escapeHtml(v.wallCol || '#ccc')}"></i></button>`).join('')}</div><small class="help">The same building in other colours. It keeps its shape, roof and rooms.</small></div>`;
  })()}
  <div class="seg-row">${checkboxField('Mirrored', `${p}.props.${mapEditor.sel}.f`, { num: 1 })}<button class="btn sm" data-act="scDupProp">Duplicate</button><button class="btn sm danger subtle" data-act="scDelProp">Remove</button><button class="btn sm subtle" data-act="scEditProp" data-k="${escapeHtml(sel.k)}">Edit this prop’s pixels</button></div></div>`
    : mapEditor.multi && mapEditor.multi.size > 1 && typeof multiSelectCardHTML === 'function'
      ? multiSelectCardHTML()
      : '<p class="help">Click a prop on the map to select it. Arrow keys nudge it, Delete removes it. Shift-drag a box (or shift-click) to select several.</p>';
  return `<div class="split sc-split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="scNew">+ New scene</button><button class="btn" data-act="genOpen" title="Make a whole route from dials and a seed, as a draft">Generate…</button></div><div class="llist">${list}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${escapeHtml(id)}</small><h2>${escapeHtml(sc.name || id)}</h2></div><div class="seg-row"><button class="btn subtle" data-act="scDup">Duplicate</button><button class="btn danger" data-act="scDel">Delete</button></div></div>
 ${card(
   'Preview',
   `<div class="sc-pv"><canvas id="scPv" data-keep="walk-gl"></canvas><div class="sc-pv-load" id="scPvLoad">Loading…</div></div>
  <div class="seg-row"><button class="seg ${mapEditor.pv === 'roam' ? 'on' : ''}" data-act="scPv" data-m="roam">Walk around</button><button class="seg ${mapEditor.pv === 'path' ? 'on' : ''}" data-act="scPv" data-m="path">Follow the path</button><button class="btn sm subtle" data-act="scPvHub">Back to the hub</button><button class="btn sm" data-act="scTestRun" title="Opens the game in a new tab, straight into this scene, with a throwaway save. Your edits show up there as you make them.">Test run in the game</button></div>
  <div class="seg-row sc-env"><select id="scEnvT" data-act-change="scEnv" aria-label="Time of day">${[
    ['', 'Midday'],
    ['7', 'Morning'],
    ['20.6', 'Sunset'],
    ['23.5', 'Night'],
  ]
    .map(
      ([v, n]) =>
        `<option value="${v}" ${String((mapEditor.env || {}).time ?? '') === v ? 'selected' : ''}>${n}</option>`
    )
    .join('')}</select><select id="scEnvW" data-act-change="scEnv" aria-label="Weather">${[
    ['', 'Fair'],
    ['cloudy', 'Cloudy'],
    ['rain', 'Rain'],
    ['storm', 'Storm'],
    ['fog', 'Fog'],
    ['snow', 'Snow'],
    ['ash', 'Falling ash'],
  ]
    .map(
      ([v, n]) => `<option value="${v}" ${((mapEditor.env || {}).weather || '') === v ? 'selected' : ''}>${n}</option>`
    )
    .join('')}</select><select id="scEnvS" data-act-change="scEnv" aria-label="Season">${[
    ['', 'No season'],
    ['spring', 'Spring'],
    ['summer', 'Summer'],
    ['autumn', 'Autumn'],
    ['winter', 'Winter'],
  ]
    .map(
      ([v, n]) => `<option value="${v}" ${((mapEditor.env || {}).season || '') === v ? 'selected' : ''}>${n}</option>`
    )
    .join(
      ''
    )}</select><span class="hint">How it looks at other times and in other weather (the game follows the clock)</span></div>
  <div class="sc-free seg-row" id="scFreeCam">${freeCameraBarHTML()}</div>
  <div class="sc-story" id="scStory">${storyPreviewBarHTML()}</div>
  <div class="grid">${mapEditor.pv === 'path' ? `<label class="fld range"><span>Walker position <output id="scTO">${Math.round(mapEditor.t * 100)}%</output></span><input type="range" id="scT" min="0" max="1" step=".01" value="${mapEditor.t}"></label>` : ''}
  <label class="fld chk"><input type="checkbox" id="scEnc" ${mapEditor.enc ? 'checked' : ''}><span>Show hidden encounters</span></label><label class="fld chk"><input type="checkbox" id="scNpc" ${mapEditor.npc ? 'checked' : ''}><span>Show a trainer</span></label></div>`,
   {
     sub: 'The game’s Walk screen renderer with your unsaved changes. In “Walk around”, click the preview to walk, and click buildings, signs and exits to see what they do.',
   }
 )}
 ${card(
   'Map',
   `<div class="sc-bar"><span class="px-tools">${tools}</span><span class="px-tools"><button class="seg" data-act="scZoom" data-z="-4">−</button><span id="scZ">${mapEditor.zoom}px</span><button class="seg" data-act="scZoom" data-z="4">+</button></span>
   <label class="mp-size"><span>Brush</span><input type="range" id="scBrush" min="1" max="5" value="${mapEditor.brush}"><output id="scBrushO">${mapEditor.brush}</output></label></div>
  ${groundLockRefusal(sc) ? `<p class="hub-note">🔒 ${escapeHtml(groundLockRefusal(sc))} Paint, Fill, Shape the land, Cliffs & stairs, Curved road, Resize and Flatten are off.</p>` : ''}
  ${
    mapEditor.tool === 'steps'
      ? stepsToolBarHTML()
      : mapEditor.tool === 'water'
        ? waterToolBarHTML(p)
        : mapEditor.tool === 'scatter' && typeof scatterToolBarHTML === 'function'
          ? scatterToolBarHTML()
          : mapEditor.tool === 'stamp' && typeof blocksToolBarHTML === 'function'
            ? blocksToolBarHTML()
            : mapEditor.tool === 'camzone' && typeof camZoneToolBarHTML === 'function'
              ? camZoneToolBarHTML()
              : mapEditor.tool === 'height'
                ? `<div class="sc-hbar">${[
                    ['raise', 'Raise'],
                    ['lower', 'Lower'],
                    ['smooth', 'Smooth'],
                    ['flatten', 'Flatten'],
                  ]
                    .map(
                      ([k, n]) =>
                        `<button class="seg ${mapEditor.hmode === k ? 'on' : ''}" data-act="scHMode" data-m="${k}">${n}</button>`
                    )
                    .join(
                      ''
                    )}<label class="mp-size"><span>Strength</span><input type="range" id="scHStr" min=".05" max=".8" step=".05" value="${mapEditor.hstr}"></label><button class="btn sm subtle" data-act="scHFlat">Make it all flat</button></div>`
                : `<div class="sc-ters">${terr}</div>`
  }
  <div class="sc-stage" id="scStage"><canvas id="scMap"></canvas></div>
  <p class="help" id="scHint">${mapToolHint()}</p>${mapEditor.tool === 'path' ? `<div class="seg-row"><button class="btn sm" data-act="scxSmoothPath">Smooth the path into a curve</button></div>` : ''}${selCard}`,
   {
     sub: 'Top is far away, bottom is close to the camera. The gold star is where you stand when you stay; green dots are the exits roads leave through.',
   }
 )}
 ${card(
   'Props',
   `<div class="seg-row"><button class="seg ${!mapEditor.tag ? 'on' : ''}" data-act="scTag" data-t="">All</button>${tags.map(t => `<button class="seg sm ${mapEditor.tag === t ? 'on' : ''}" data-act="scTag" data-t="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>
  <div class="sc-props">${props}</div><div class="seg-row"><button class="btn" data-act="scNewProp">+ New blank prop</button><button class="btn" data-act="scImportProp">+ Prop from PNG</button>${mapEditor.prop ? `<button class="btn subtle" data-act="scEditProp" data-k="${escapeHtml(mapEditor.prop)}">Edit ${escapeHtml((sceneryCatalog().props[mapEditor.prop] || {}).name || mapEditor.prop)}</button>` : ''}</div>
  <p class="help">Pick a prop, then click the map with “Place & move props”. Prop pictures live in art/scene/props.</p>${mapEditor.prop && sceneryCatalog().props[mapEditor.prop] ? `<div class="seg-row"><button class="btn primary" data-act="pedOpen" data-k="${escapeHtml(mapEditor.prop)}">Open ${escapeHtml(sceneryCatalog().props[mapEditor.prop].name || mapEditor.prop)} in the prop editor</button><span class="help">Effects, door, layers for depth, facing, glow and a 3D turntable.</span></div>` : ''}`
 )}
 ${mapEditor.ped && sceneryCatalog().props[mapEditor.ped] ? propEditorCardHTML(mapEditor.ped) : ''}
 ${mapEditor.pe ? sceneryPixelCardHTML() : ''}
 ${sc.kind === 'town' || sc.kind === 'route' ? `<div class="seg-row sc-keep">${checkboxField('Keep this layout: the v46 rework tool (tools/build-places-v46.py) never rebuilds it', `${p}.keep`, { num: 1 })}</div>` : ''}
 ${card(
   'Look and camera',
   `${grid(
     textField('Name', `${p}.name`, { rr: 1 }),
     selectField(
       'Outside the map',
       `${p}.edge`,
       Object.entries(T).map(([c, t]) => [c, t.name]),
       { help: 'Ground shown past the edges.' }
     ),
     selectField('In the air', `${p}.amb`, [
       ['pollen', 'Pollen'],
       ['spore', 'Spores'],
       ['drip', 'Drips'],
       ['sand', 'Blowing sand'],
       ['dust', 'Sparkling dust'],
       ['none', 'Nothing'],
     ]),
     checkboxField('Indoors or underground (no clouds)', `${p}.indoor`, { num: 1 }),
     checkboxField('You ride over the water here', `${p}.ride`, { num: 1 }),
     checkboxField('Open water to the horizon', `${p}.flatFar`, { num: 1 }),
     selectField(
       'Weather here',
       `${p}.climate`,
       [
         ['mild', 'Mild: sun, cloud, rain and fog'],
         ['coast', 'Coast: more rain, fog and storms'],
         ['alpine', 'Mountains: often snow'],
         ['volcano', 'Volcano: falling ash'],
         ['dry', 'Dry: hardly ever rains'],
         ['none', 'Always fair'],
       ],
       {
         none: 'Guess from the place',
         opt: 1,
         help: 'The weather changes every few hours (v26). Indoors it never rains.',
       }
     ),
     numberField('Darkness away from lights', `${p}.dark`, {
       opt: 1,
       min: 0,
       max: 1,
       step: 0.05,
       ph: 'auto',
       help: '0 = lit as usual, 1 = only your lantern, lamps and glowing things light it. Empty: caves are dark, everywhere else is lit.',
     }),
     ...(sc.room
       ? [
           textField('Who stands behind the counter', `${p}.keeper`, {
             help:
               'A person from People (their id), or folk:<number> for a townsperson. This is a room you walk into from a ' +
               escapeHtml(sc.room) +
               '.',
           }),
         ]
       : [])
   )}
  ${grid(
    selectField(
      'Hills in the distance',
      `${p}.far`,
      [
        ['hills', 'Rolling hills'],
        ['forest', 'Forest edge'],
        ['mountains', 'Snowy mountains'],
        ['canyon', 'Canyon mesas'],
        ['cave', 'Cave wall'],
        ['mall', 'Mall interior'],
        ['town', 'Distant town'],
        ['farm', 'Farmland'],
      ],
      { none: 'None', opt: 1 }
    ),
    rangeField('Distant hills height', `${p}.farH`, { min: 3, max: 16, step: 0.5, def: 8 }),
    numberField('Townsfolk walking around', `${p}.folk`, { min: 0, max: 12, step: 1 }),
    selectField(
      'Town flag',
      `${p}.flag`,
      [
        ['default', 'The coin ring'],
        ...(sceneryCatalog().flags || []).map(k => [k, ((D.maps[k] || {}).name || k) + '’s flag']),
      ],
      {
        none: 'This town’s own',
        opt: 1,
        help: 'What the flag poles here fly (art/scene/flags/<name>.png, made by tools/build-flags.py).',
      }
    ),
    rangeField('Wind', `${p}.wind`, { min: 0, max: 3, step: 0.1, def: 1 }),
    rangeField('Prop variety', `${p}.variety`, {
      min: 0,
      max: 2,
      step: 0.05,
      def: 1,
      help: 'How much props differ from their neighbours in size, colour and turn.',
    }),
    rangeField('Wear and tear', `${p}.wear`, {
      min: 0,
      max: 2,
      step: 0.05,
      def: 1,
      help: 'Dirt, moss, faded paint and cracks on buildings and props here.',
    }),
    numberField('Look seed', `${p}.lookSeed`, {
      opt: 1,
      min: 0,
      step: 1,
      help: 'Change it for a different random look; the same number always gives the same look.',
    }),
    checkboxField('Sun rays', `${p}.rays`, { num: 1 })
  )}
  <label class="fld wide"><span>What townsfolk say (one line each)</span><textarea id="scChat" rows="3" placeholder="Lovely day for a walk.">${escapeHtml((sc.chat || []).join('\n'))}</textarea></label>
  <div class="grid colors">${colorField('Sky top', `${p}.sky.0`)}${colorField('Sky middle', `${p}.sky.1`)}${colorField('Horizon', `${p}.sky.2`)}${colorField('Haze', `${p}.haze`)}${colorField('Shade (caves, malls)', `${p}.tint`, { help: 'Leave black for none.' })}</div>
  ${grid(rangeField('Haze distance', `${p}.hazeD`, { min: 8, max: 80, step: 1 }), rangeField('Tilt-shift blur', `${p}.blur`, { min: 0, max: 1.5, step: 0.05, def: 1 }), rangeField('Camera tilt (degrees)', `${p}.cam.pitch`, { min: 20, max: 70, step: 1 }), rangeField('Camera height', `${p}.cam.h`, { min: 4, max: 20, step: 0.5 }), rangeField('Zoom', `${p}.cam.fov`, { min: 0.5, max: 2, step: 0.05, def: 1 }), rangeField('Where you arrive on the path', `${p}.start`, { min: 0, max: 0.95, step: 0.01, def: 0.42 }))}
  <div class="seg-row"><span class="help">Size</span><input type="number" id="scW" min="10" max="240" value="${sc.w}" class="sm-num"> × <input type="number" id="scH" min="8" max="200" value="${sc.h}" class="sm-num"><button class="btn sm" data-act="scResize">Resize the map</button><span class="help">Used by: ${
    locationsUsingMap(id)
      .map(([r, i]) => `${i + 1}. ${escapeHtml(r.name)}`)
      .join(', ') || 'no stop yet (pick it under World & encounters → Route stops)'
  }</span></div>`
 )}
 ${card(
   'Life',
   `<p class="help">Animals and traffic that move around this scene. One per line: <span class="mono">duck 4</span>, <span class="mono">pigeon 6 at 24 17 41 27</span> (an area: left, near, right, far), <span class="mono">chicken 5 at …</span>, <span class="mono">sheep 3 at …</span>, <span class="mono">car 3 along 20 13, 44 13, 44 31, 20 31</span> (a loop of points the cars drive round; they stop for you). Also <span class="mono">rabbit</span>, <span class="mono">squirrel</span>, <span class="mono">frog</span> (they live on the bank and leap in when you come close), <span class="mono">gull</span>, <span class="mono">goat</span>, <span class="mono">cat</span>, <span class="mono">crab</span> and <span class="mono">lizard</span>.</p>
  <label class="fld wide"><span>What moves here</span><textarea id="scLife" rows="4" class="mono">${escapeHtml(mapLifeText(sc))}</textarea></label>`
 )}
 ${card(
   'People who talk',
   `<p class="help">Someone who stands here and talks when you tap them (no battle), like Granny Juniper in Copperleaf. What they say is a script (docs/SCRIPTS.md); their id is what <span class="mono">visits:id</span> and <span class="mono">met_id</span> count by. The story preview above shows who is here for the flags you pick.</p>
  ${(sc.people || [])
    .map(
      (q, i) => `<div class="sc-person">${grid(
        textField('Id', `${p}.people.${i}.id`, { cls: 'mono' }),
        selectField('Look', `${p}.people.${i}.who`, peopleOptions()),
        textField('Name', `${p}.people.${i}.name`),
        numberField('Across (m)', `${p}.people.${i}.x`, { step: 0.1 }),
        numberField('Depth (m)', `${p}.people.${i}.z`, { step: 0.1 }),
        selectField('Facing', `${p}.people.${i}.dir`, [
          ['down', 'Down'],
          ['up', 'Up'],
          ['left', 'Left'],
          ['right', 'Right'],
        ])
      )}
   ${grid(conditionField('Only here when', `${p}.people.${i}.when`, 'person:' + q.id, 'when', { ph: 'always' }), conditionField('Gone when', `${p}.people.${i}.unless`, 'person:' + q.id, 'unless', { ph: 'never' }))}
   ${scriptField('What they say', 'person:' + q.id, { rows: 8 })}
   <div class="seg-row"><button class="btn sm danger subtle" data-act="scPplDel" data-i="${i}">Remove</button></div></div>`
    )
    .join('')}
  <div class="seg-row"><button class="btn sm" data-act="scPplAdd">+ Someone to talk to</button></div>`
 )}
 ${card(
   'Ground types',
   `<table class="tbl"><thead><tr><th>Tile</th><th>Key</th><th>Name</th><th>Layer</th><th>Edge</th><th></th></tr></thead><tbody>${Object.entries(
     T
   )
     .map(
       ([c, t]) =>
         `<tr><td><canvas data-tile="${escapeHtml(c)}" width="16" height="16" class="sc-tilebig"></canvas></td><td class="mono">${escapeHtml(c)}</td><td><input type="text" data-p="scenery.terrains.${c}.name" data-k="text" value="${escapeHtml(t.name)}"></td><td><input type="number" data-p="scenery.terrains.${c}.z" data-k="num" value="${t.z}" min="0" max="9" class="sm-num" title="Higher layers draw their edge line over lower ones"></td><td><span class="colw"><input type="color" data-p="scenery.terrains.${c}.edge" data-k="color" value="${t.edge}"></span></td><td><button class="btn sm" data-act="scEditTile" data-c="${escapeHtml(c)}">Edit pixels</button></td></tr>`
     )
     .join('')}</tbody></table>
  <div class="seg-row"><button class="btn" data-act="scNewTer">+ New ground type</button></div><p class="help">Tiles are 16×16 and repeat seamlessly. Where two ground types meet, the higher layer draws a thin edge line in its edge color.</p>`
 )}
 </div></div>`;
};
function mapToolHint() {
  return (
    {
      paint: 'Paint ground with the selected type. Alt-click picks the type under the cursor.',
      fill: 'Fill a connected area of one ground type.',
      props: 'Click to place the selected prop. Drag a prop to move it. Shift-drag to move it without snapping.',
      path: 'Drag the white dots. Click the line to add a point; right-click (or Alt-click) a dot to remove it. The path is only used by the “Follow the path” preview.',
      steps: {
        cliff:
          'Paint ground to a height: a cliff or terrace with a vertical face where it meets lower ground. Shift-click picks the height under the cursor. Anything more than 30 cm up is too tall to step onto, so give it stairs.',
        stairs:
          'Drag from the low ground to the high ground: a straight flight of stairs between them, as wide as the brush. Each step should rise 30 cm or less, so a 1.5 m terrace needs about 3 m of stairs.',
        ramp: 'Drag from the low ground to the high ground: a smooth slope between them, as wide as the brush, with no steps. It may climb at most 60 cm per metre; a gentle path climbs 20 to 30.',
        ledge:
          'Paint the top edge of a step to make it a ledge you can hop down from (but not climb). Alt-click to remove.',
        bridge:
          'Drag from one bank to the other for a bridge you can walk over, above water or a drop. Alt-click a bridge to remove it.',
        erase: 'Paint to take cliffs, stairs and ledges away (back to the land underneath).',
      }[mapEditor.smode],
      height:
        'Drag to raise or lower the ground. Smooth softens bumps, Flatten levels everything to the height where you started. Steep slopes become cliffs nobody can climb; roads should stay gentle.',
      water:
        'Kinds: drag a rectangle over water to give it a kind (pond, stream, lake, sea, lava, ice, rapids, hot spring…). Later rectangles win where they overlap; right-click (or Alt-click) one to remove it. Water you don’t cover uses the scene’s own kind, and running water (a stream path) is a stream. Rivers and Falls: the scene’s stream lines and waterfalls (water-tools.js).',
      exits:
        'Drag the gold star (where you stand when you stay) or a green exit. Click empty ground to add an exit; right-click (or Alt-click) an exit to remove it. Roads leave through the exit that points their way on the world map.',
      erase: 'Click a prop to remove it.',
    }[mapEditor.tool] || (typeof extraToolHint === 'function' ? extraToolHint(mapEditor.tool) : '')
  );
}
/* ---------- mount ---------- */
async function mountMapEditor() {
  const sc = currentMap();
  if (!sc) return;
  const C = sceneryCatalog();
  const paths = sceneryArtPaths(C);
  await Promise.all(paths.map(p => atlasGet('art/' + p).catch(() => null)));
  drawSceneryThumbs();
  drawEditorMap();
  bindEditorMap();
  if (mapEditor.ped && sceneryCatalog().props[mapEditor.ped] && typeof mountPropTurntable === 'function') {
    const l = $('#scPvLoad');
    if (l) {
      l.hidden = false;
      l.textContent = 'Paused while the prop editor’s turntable runs';
    }
    mountPropTurntable();
  } else mountMapPreview();
  const tr = $('#scT');
  if (tr)
    tr.addEventListener('input', () => {
      mapEditor.t = +tr.value;
      $('#scTO').textContent = Math.round(mapEditor.t * 100) + '%';
    });
  const e = $('#scEnc');
  if (e) e.addEventListener('change', () => (mapEditor.enc = e.checked));
  const n = $('#scNpc');
  if (n) n.addEventListener('change', () => (mapEditor.npc = n.checked));
  const hs = $('#scHStr');
  if (hs)
    hs.addEventListener('input', () => {
      mapEditor.hstr = +hs.value;
    });
  const br = $('#scBrush');
  if (br)
    br.addEventListener('input', () => {
      mapEditor.brush = +br.value;
      $('#scBrushO').textContent = mapEditor.brush;
    });
  const lf = $('#scLife');
  if (lf)
    lf.addEventListener('change', () => {
      const sc = currentMap(),
        L = parseMapLife(lf.value);
      if (L.length) sc.life = L;
      else delete sc.life;
      changed();
      commit(true);
    });
  const ch = $('#scChat');
  if (ch)
    ch.addEventListener('change', () => {
      const sc = currentMap(),
        L = ch.value
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean);
      if (L.length) sc.chat = L;
      else delete sc.chat;
      changed();
      commit(true);
    });
  if (mapEditor.pe) mountSceneryPixelEditor();
}
export function drawSceneryThumbs() {
  const C = sceneryCatalog();
  $$('canvas[data-tile]').forEach(c => {
    const T = C.terrains[c.dataset.tile];
    const im = T && artImage(T.tile);
    const x = c.getContext('2d');
    x.clearRect(0, 0, 16, 16);
    if (im && (im.width || im.naturalWidth)) x.drawImage(im, 0, 0, 16, 16);
  });
  $$('.sc-thumb[data-img]').forEach(s => {
    const im = artImage(s.dataset.img);
    s.innerHTML = '';
    if (!im) return;
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      k = Math.min(1, 56 / Math.max(w, h, 1)),
      c = makeCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = k < 1;
    x.drawImage(im, 0, 0, c.width, c.height);
    s.appendChild(c);
  });
}
export function mapExitNames(id) {
  const D = studioState.D,
    sc = D.maps[id],
    ex = (sc && sc.exits) || [],
    u = locationsUsingMap(id)[0];
  if (!u) return ex.map((e, k) => ({ i: k, name: edgeExitId(sc, k) || `Exit ${k + 1}` }));
  const i = u[1],
    me = D.locations[i],
    hub = mapHub(sc),
    pairs = [],
    out = {},
    E = sc.edgeExits || [];
  /* v42: the links first: a road that names its exit here keeps it */
  (D.roads || []).forEach(L => {
    const l = PB_DATA.road(D, L),
      o = l.kind === 'seam' ? (l.a === i ? l.b : l.b === i ? l.a : null) : null;
    if (o == null || !D.locations[o]) return;
    const id = l.a === i ? l.exitA : l.exitB,
      k = id ? E.findIndex(q => q.id === id) : -1;
    if (k >= 0 && !(o in out)) out[o] = k;
  });
  (D.roads || []).forEach(L => {
    const l = PB_DATA.road(D, L),
      o = l.kind === 'seam' ? (l.a === i ? l.b : l.b === i ? l.a : null) : null;
    if (o == null || !D.locations[o] || o in out) return;
    /* phase 10: the other place's direction in this map's own compass on the bowl (north faces the centre, east runs
       counter-clockwise; game/js/logic/bowl.js) */
    const xy = r =>
        r && r.bowl && 'a' in r.bowl
          ? [r.bowl.r * Math.cos((r.bowl.a * Math.PI) / 180), r.bowl.r * Math.sin((r.bowl.a * Math.PI) / 180)]
          : [0, 0],
      P = xy(me),
      Q = xy(D.locations[o]),
      pr = Math.hypot(P[0], P[1]),
      no = pr < 1e-6 ? [0, 1] : [-P[0] / pr, -P[1] / pr],
      ea = [no[1], -no[0]],
      a = Math.atan2((Q[0] - P[0]) * no[0] + (Q[1] - P[1]) * no[1], (Q[0] - P[0]) * ea[0] + (Q[1] - P[1]) * ea[1]);
    ex.forEach((p, k) => {
      let d = Math.abs(a - Math.atan2(p[1] - hub[1], p[0] - hub[0])) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      pairs.push([d, o, k]);
    });
  });
  pairs.sort((a, b) => a[0] - b[0]);
  const taken = new Set(Object.values(out));
  for (const [, o, k] of pairs) {
    if (o in out || taken.has(k)) continue;
    out[o] = k;
    taken.add(k);
  }
  const L = Object.entries(out).map(([o, k]) => ({ i: k, to: +o, name: D.locations[o].name }));
  ex.forEach((e, k) => {
    if (!L.some(x => x.i === k))
      L.push({ i: k, name: `${edgeExitId(sc, k) || 'Exit ' + (k + 1)} (no road)`, locked: true });
  });
  return L;
}
/* v42: edge-relative exits. syncEdgeExits keeps sc.edgeExits in step with sc.exits after the exits tool moved, added or removed one */
function edgeExitId(sc, k) {
  const e = sc && sc.edgeExits && sc.edgeExits[k];
  return e ? e.id : null;
}
function newEdgeExitName(sc, side) {
  const base = { N: 'north', S: 'south', E: 'east', W: 'west' }[side] || 'exit',
    used = new Set((sc.edgeExits || []).map(e => e.id));
  let n = base,
    i = 2;
  while (used.has(n)) n = base + i++;
  return n;
}
function syncEdgeExits(sc, k, removed) {
  const E = sc.edgeExits || (sc.edgeExits = []);
  if (removed != null) {
    E.splice(removed, 1);
    dropStaleExitJoins(sc);
    sc._exk = '';
    return;
  }
  if (k != null) {
    const old = E[k],
      e = exitEdge(sc, sc.exits[k], old);
    if (!e.id || (old && old.side !== e.side && E.some((q, j) => j !== k && q.id === e.id)))
      e.id = newEdgeExitName(sc, e.side);
    E[k] = e;
  } else
    sc.exits.forEach((p, j) => {
      const e = exitEdge(sc, p, E[j]);
      if (!e.id) e.id = newEdgeExitName(sc, e.side);
      E[j] = e;
    });
  sc._exk = sc.w + 'x' + sc.h + '/' + E.length;
}
function dropStaleExitJoins(sc) {
  const D = studioState.D,
    ids = new Set((sc.edgeExits || []).map(e => e.id)),
    users = locationsUsingMap(currentMapId()).map(([, i]) => i);
  (D.roads || []).forEach(L => {
    const l = PB_DATA.road(D, L);
    if (users.includes(l.a) && l.exitA && !ids.has(l.exitA)) PB_DATA.setRoadEnd(D, L, 'a', null, null);
    if (users.includes(l.b) && l.exitB && !ids.has(l.exitB)) PB_DATA.setRoadEnd(D, L, 'b', null, null);
  });
}
/* ---------- Project Story S3: the story preview ----------
   Pick a start preset (story.json) and switch flags on or off: people and props whose when / unless don't let them be
   there are hidden in the 3D preview and drawn faded with a red dashed outline on the map. Off, everything shows. */
let storyPvSave = null,
  storyPvAt = -1;
const storyPvNow = () => {
  if (storyPvAt !== mapEditor.story.v || !storyPvSave) {
    storyPvSave = storyPreviewSave(studioState.D, mapEditor.story);
    storyPvAt = mapEditor.story.v;
  }
  return storyPvSave;
};
/* the walk view asks this of every prop with a when or unless (in the game: logic/script.js) */
function storyAllows(thing) {
  if (!thing) return false;
  if (!mapEditor.story.on) return true;
  return storyPreviewAllows(studioState.D, thing, storyPvNow());
}
/* the scene's people as the walk view takes them (as ui.js walkState does in the game) */
function previewPeople(sc) {
  return (sc.people || [])
    .filter(P => PEOPLE[P.who] && storyAllows(P))
    .map(P => ({
      who: P.who,
      id: '_talk:' + P.id,
      talk: P,
      done: true,
      exit: null,
      dir: P.dir || 'down',
      at: [P.x, P.z],
    }));
}
/* the people on the map: a dot and their name, faded when the preview hides them */
function drawScenePeople(x, sc, Z, H) {
  for (const P of sc.people || []) {
    const gone = !storyAllows(P);
    if (gone && !mapEditor.story.faded) continue;
    const px = P.x * Z,
      py = (H - P.z) * Z;
    x.save();
    x.globalAlpha = gone ? 0.35 : 1;
    x.fillStyle = '#1f6e6f';
    x.strokeStyle = '#fff';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(px, py, Math.max(5, Z * 0.35), 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.font = '600 11px system-ui, sans-serif';
    x.textAlign = 'center';
    x.lineWidth = 3;
    x.strokeStyle = 'rgba(0,0,0,.6)';
    x.strokeText(P.name || P.id, px, py - Math.max(8, Z * 0.5));
    x.fillStyle = '#fff';
    x.fillText(P.name || P.id, px, py - Math.max(8, Z * 0.5));
    x.restore();
  }
}
function storyPreviewBarHTML() {
  const D = studioState.D,
    S = D.story || {},
    st = mapEditor.story,
    sc = currentMap() || {},
    things = [...(sc.people || []), ...(sc.props || [])],
    N = storyNamesIn(things),
    save = storyPvNow(),
    more = Object.keys(S.flags || {}).filter(f => !N.flags.includes(f)),
    chip = (f, on) =>
      `<button class="seg sm ${on ? 'on' : ''}" data-act="scStoryFlag" data-f="${escapeHtml(f)}" aria-pressed="${on}">${escapeHtml(f)}</button>`,
    flagChip = f => chip(f, save.story[f] != null && save.story[f] !== 0 && save.story[f] !== false),
    beatChip = b => chip('beat:' + b, !!save.flags[b]),
    hid = things.filter(t => (t.when || t.unless) && !storyAllows(t)).length;
  return `<label class="fld chk"><input type="checkbox" id="scStoryOn" ${st.on ? 'checked' : ''}><span>Story preview</span></label><select id="scStoryPreset" aria-label="Start preset"><option value="">A new game</option>${Object.entries(
    S.presets || {}
  )
    .map(
      ([k, P]) =>
        `<option value="${escapeHtml(k)}" ${st.preset === k ? 'selected' : ''} title="${escapeHtml(P.about || '')}">${escapeHtml(k)}</option>`
    )
    .join(
      ''
    )}</select><label class="fld chk"><input type="checkbox" id="scStoryFaded" ${st.faded ? 'checked' : ''}><span>Show hidden faded on the map</span></label><button class="btn sm primary" data-act="scPlayHere" title="Open the game here, at the preview's preset and flags, with your unsaved changes">▶ Play from here</button><button class="btn sm ${mapEditor.pickPlay ? 'primary' : ''}" data-act="scPlaySpot" aria-pressed="${!!mapEditor.pickPlay}">${mapEditor.pickPlay ? 'Click the map…' : 'Pick the spot'}</button><span class="hint">${playSpot().why}</span>
  ${st.on ? `<div class="sc-story-flags"><span class="hint">${N.flags.length || N.beat.length ? 'Read here:' : 'Nothing here has a when or unless.'}</span>${N.flags.map(flagChip).join('')}${N.beat.map(beatChip).join('')}${more.length ? `<details><summary class="hint">More story flags</summary>${more.map(flagChip).join('')}</details>` : ''}<span class="hint">${hid ? `${hid} hidden for these flags` : 'Everyone is here'}</span></div>` : ''}`;
}
/* after a change: the bar, the map and (it asks each frame) the 3D preview */
function storyPreviewChanged() {
  mapEditor.story.v++;
  const el = $('#scStory');
  if (el) el.innerHTML = storyPreviewBarHTML();
  drawEditorMap();
}
/* Play from here: the game in this scene's place, on the spot you picked on the map, else where the preview's walker
   stands, else the hub; at the preview's preset and flags, with your unsaved changes (a scene no stop uses, like a
   room, opens as a scene test run) */
function playSpot() {
  const sc = currentMap() || {},
    id = currentMapId(),
    P = mapEditor.playAt && mapEditor.playAt.id === id ? mapEditor.playAt : null;
  if (P) return { at: [P.x, P.z], why: `Starts on the spot you picked (${P.x}, ${P.z}).` };
  const F = freeCameraSpot();
  if (F) return { at: F.map(v => +v.toFixed(1)), why: 'Starts where the free camera looks.' };
  if (mapEditor.pvPos && mapEditor.pvId === id)
    return { at: mapEditor.pvPos.map(v => +v.toFixed(1)), why: 'Starts where the preview’s walker stands.' };
  return { at: sc.w ? mapHub(sc).map(v => +(+v).toFixed(1)) : null, why: 'Starts on the hub.' };
}
function playFromHereURL(D, sceneId, at, story) {
  const loc = (D.locations || []).find(l => l.mapId === sceneId),
    q = new URLSearchParams({ test: '1' });
  if (story.on && story.preset) q.set('story', story.preset);
  if (loc) q.set('place', loc.id);
  else q.set('scene', sceneId);
  if (at) q.set('at', at.join(','));
  const F = story.on ? storySwitchesText(story.flags || {}) : '';
  if (F) q.set('flags', F);
  q.set('draft', '1');
  return '../game/index.html?' + q.toString();
}
ACTIONS.scPlayHere = () => {
  const id = currentMapId();
  if (!id) return;
  studioBroadcast();
  window.open(playFromHereURL(studioState.D, id, playSpot().at, mapEditor.story), 'networth-game');
  toast('Opening the game here with your unsaved changes. Nothing there is saved.');
};
/* the free camera's Walker here: the walker stands where the camera looks */
ACTIONS.fcWalker = () => {
  const F = freeCameraSpot();
  if (!F) return;
  mapEditor.pvPos = F;
  walkView.pl.fresh = true;
};
ACTIONS.scPlaySpot = () => {
  mapEditor.pickPlay = !mapEditor.pickPlay;
  storyPreviewChanged();
};
ACTIONS.scStoryFlag = d => {
  const save = storyPvNow(),
    f = d.f,
    on = f.startsWith('beat:') ? !!save.flags[f.slice(5)] : save.story[f] != null && save.story[f] !== 0;
  mapEditor.story.flags = { ...mapEditor.story.flags, [f]: !on };
  storyPreviewChanged();
};
document.addEventListener('change', ev => {
  const el = ev.target;
  if (!el || !el.id) return;
  if (el.id === 'scStoryOn') mapEditor.story.on = el.checked;
  else if (el.id === 'scStoryFaded') mapEditor.story.faded = el.checked;
  else if (el.id === 'scStoryPreset') {
    mapEditor.story.preset = el.value;
    mapEditor.story.flags = {};
  } else return;
  storyPreviewChanged();
});
function mountMapPreview() {
  const cv = $('#scPv'),
    id0 = currentMapId();
  if (!cv || !id0) return;
  walkView.pl.t = -1;
  if (mapEditor.pvId !== id0) {
    mapEditor.pvId = id0;
    mapEditor.pvPos = null;
  }
  const id = id0,
    off = [0, 0];
  const enc = () =>
    mapEditor.enc
      ? [
          { id: 'pv1', lvl: 5 },
          { id: 'pv2', lvl: 7 },
          { id: 'pv3', lvl: 4 },
        ]
      : [];
  mountWalkView(cv, id, {
    state: () => {
      const sc = currentMap();
      if (mapEditor.pv === 'path' || !sc)
        return {
          t: mapEditor.t,
          who: 'boy',
          enc: enc(),
          npcs: mapEditor.npc
            ? [{ who: 'chosen', id: 'pv', done: false, t: Math.min(0.95, mapEditor.t + 0.12), dz: 1.6 }]
            : [],
        };
      return {
        mode: 'roam',
        roam: true,
        pos:
          mapEditor.pvPos ||
          (() => {
            const h = mapHub(sc);
            return [h[0] + off[0], h[1] + off[1]];
          })(),
        who: 'boy',
        enc: enc(),
        npcs: [...(mapEditor.npc ? [{ who: 'chosen', id: 'pv', done: false }] : []), ...previewPeople(sc)],
        exits: mapExitNames(id),
      };
    },
    onMove: (x, z) => {
      mapEditor.pvPos = [x, z];
    },
    keys: () => false,
    onPick: h =>
      toast(
        h.k === 'enc'
          ? 'In the game this starts a battle.'
          : h.k === 'npc'
            ? 'In the game this starts the trainer battle.'
            : h.k === 'exit'
              ? `In the game this asks: walk to ${h.e.name}?`
              : h.k === 'act'
                ? `${{ shop: 'Opens the shop', clinic: 'Heals the team', lab: 'Shows what it says', house: 'Shows what it says', sign: 'Shows what it says', talk: 'Shows what it says' }[h.act] || h.act}${h.p.say ? ': “' + h.p.say + '”' : ''}`
                : 'Click the ground to walk there.'
      ),
    cap: () => (studioState.sec === 'scenes' ? 30 : 0),
    look: freeCameraLook,
  }).then(() => {
    const l = $('#scPvLoad');
    if (l) l.hidden = true;
  });
}
ACTIONS.scPv = d => {
  mapEditor.pv = d.m;
  walkView.pl.fresh = true;
  render();
};
ACTIONS.scPvHub = () => {
  mapEditor.pvPos = null;
  walkView.pl.fresh = true;
  walkView.pl.route = null;
};
/* ---------- map ---------- */
export function drawEditorMap() {
  const cv = $('#scMap'),
    sc = currentMap();
  if (!cv || !sc) return;
  const Z = mapEditor.zoom,
    C = sceneryCatalog(),
    PPU = C.ppu || 34,
    W = sc.w,
    H = sc.h;
  cv.width = W * Z;
  cv.height = H * Z;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  for (let j = 0; j < H; j++) {
    const row = sc.tiles[j] || '';
    for (let i = 0; i < W; i++) {
      const ch = row[i] || sc.edge,
        T = C.terrains[ch],
        im = T && artImage(T.tile);
      if (im && (im.width || im.naturalWidth)) x.drawImage(im, i * Z, j * Z, Z, Z);
      else {
        x.fillStyle = '#f0f';
        x.fillRect(i * Z, j * Z, Z, Z);
      }
    }
  }
  x.strokeStyle = 'rgba(0,0,0,.08)';
  x.lineWidth = 1;
  for (let i = 0; i <= W; i++) {
    x.beginPath();
    x.moveTo(i * Z + 0.5, 0);
    x.lineTo(i * Z + 0.5, H * Z);
    x.stroke();
  }
  for (let j = 0; j <= H; j++) {
    x.beginPath();
    x.moveTo(0, j * Z + 0.5);
    x.lineTo(W * Z, j * Z + 0.5);
    x.stroke();
  }
  if (sc.heights && sc.heights.length) {
    const strong = mapEditor.tool === 'height';
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const h = rawHeightAt(sc, i + 0.5, H - j - 0.5);
        if (Math.abs(h) < 0.05) continue;
        x.fillStyle =
          h > 0
            ? `rgba(255,255,255,${Math.min(0.5, h * 0.08) * (strong ? 1.6 : 1)})`
            : `rgba(0,0,40,${Math.min(0.5, -h * 0.12) * (strong ? 1.6 : 1)})`;
        x.fillRect(i * Z, j * Z, Z, Z);
      }
    if (strong) {
      x.strokeStyle = 'rgba(60,40,20,.55)';
      x.lineWidth = 1;
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const a = Math.floor(rawHeightAt(sc, i + 0.5, H - j - 0.5)),
            b = Math.floor(rawHeightAt(sc, i + 1.5, H - j - 0.5)),
            c = Math.floor(rawHeightAt(sc, i + 0.5, H - j + 0.5));
          if (a !== b) {
            x.beginPath();
            x.moveTo((i + 1) * Z, j * Z);
            x.lineTo((i + 1) * Z, (j + 1) * Z);
            x.stroke();
          }
          if (a !== c) {
            x.beginPath();
            x.moveTo(i * Z, j * Z);
            x.lineTo((i + 1) * Z, j * Z);
            x.stroke();
          }
        }
    }
  }
  drawStepsOverlay(x, sc, Z);
  const order = sc.props.map((p, i) => [p, i]).sort((a, b) => b[0].z - a[0].z);
  mapEditor.boxes = [];
  for (const [p, i] of order) {
    const M = C.props[p.k],
      im = M && artImage(M.img),
      gone = (p.when || p.unless) && !storyAllows(p);
    if (gone && !mapEditor.story.faded) continue;
    const px = p.x * Z,
      py = (H - p.z) * Z;
    if (!im) {
      x.fillStyle = '#f0f';
      x.fillRect(px - 4, py - 4, 8, 8);
      continue;
    }
    const k = (Z / PPU) * (p.s || 1),
      w = (im.naturalWidth || im.width) * k,
      h = (im.naturalHeight || im.height) * k;
    x.save();
    x.translate(px, py);
    if (gone) x.globalAlpha = 0.28;
    if (p.f) x.scale(-1, 1);
    x.imageSmoothingEnabled = k < 1;
    if (M.flat) {
      x.scale(1, 0.6);
    }
    x.drawImage(im, M.ox * k, M.oy * k, w, h);
    x.restore();
    const bx = p.f ? px + M.ox * k * -1 - w : px + M.ox * k;
    mapEditor.boxes.push({
      i,
      x0: Math.min(bx, bx + w),
      x1: Math.max(bx, bx + w),
      y0: py + M.oy * k * (M.flat ? 0.6 : 1),
      y1: py + 4,
    });
    x.fillStyle = 'rgba(30,26,52,.5)';
    x.fillRect(px - 1.5, py - 1.5, 3, 3);
    if (p.rot || i === mapEditor.sel) drawPropFacing(x, p, M, Z, H);
    if (gone) {
      const b = mapEditor.boxes[mapEditor.boxes.length - 1];
      x.save();
      x.strokeStyle = 'rgba(200,50,60,.85)';
      x.setLineDash([4, 3]);
      x.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      x.restore();
    }
  }
  drawScenePeople(x, sc, Z, H);
  const PA = mapEditor.playAt && mapEditor.playAt.id === currentMapId() ? mapEditor.playAt : null;
  if (PA) {
    /* the spot Play from here starts on */
    const px = PA.x * Z,
      py = (H - PA.z) * Z;
    x.save();
    x.fillStyle = '#f2c14e';
    x.strokeStyle = '#1f2e36';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px - 7, py - 14);
    x.lineTo(px + 7, py - 14);
    x.closePath();
    x.fill();
    x.stroke();
    x.restore();
  }
  if (mapEditor.sel != null && sc.props[mapEditor.sel]) {
    const b = mapEditor.boxes.find(b => b.i === mapEditor.sel);
    if (b) {
      x.strokeStyle = '#C8323C';
      x.lineWidth = 2;
      x.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
  }
  const P = sc.path || [];
  if (P.length) {
    x.strokeStyle = 'rgba(255,255,255,.95)';
    x.lineWidth = 3;
    x.setLineDash([8, 5]);
    x.beginPath();
    P.forEach(([a, b], k) => {
      const X = a * Z,
        Y = (H - b) * Z;
      k ? x.lineTo(X, Y) : x.moveTo(X, Y);
    });
    x.stroke();
    x.setLineDash([]);
    P.forEach(([a, b], k) => {
      x.fillStyle = k === 0 ? '#2F8F5B' : k === P.length - 1 ? '#C8323C' : '#fff';
      x.strokeStyle = '#1F2E36';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(a * Z, (H - b) * Z, mapEditor.tool === 'path' ? 7 : 4, 0, 7);
      x.fill();
      x.stroke();
    });
    const s0 = pointAlongMapPath(sc, sc.start ?? 0.42);
    x.fillStyle = '#F2C14E';
    x.beginPath();
    x.arc(s0.x * Z, (H - s0.z) * Z, 6, 0, 7);
    x.fill();
    x.stroke();
  }
  if (sc.hub || mapEditor.tool === 'exits') {
    const hb = mapHub(sc),
      HX = hb[0] * Z,
      HY = (H - hb[1]) * Z,
      big = mapEditor.tool === 'exits';
    (sc.exits || []).forEach((e, k) => {
      const X = e[0] * Z,
        Y = (H - e[1]) * Z;
      x.strokeStyle = 'rgba(47,143,91,.75)';
      x.lineWidth = 2;
      x.setLineDash([5, 4]);
      x.beginPath();
      x.moveTo(HX, HY);
      x.lineTo(X, Y);
      x.stroke();
      x.setLineDash([]);
      x.fillStyle = '#2F8F5B';
      x.strokeStyle = '#fff';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(X, Y, big ? 9 : 6, 0, 7);
      x.fill();
      x.stroke();
      x.fillStyle = '#fff';
      x.font = '700 11px system-ui';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(String(k + 1), X, Y + 0.5);
    });
    x.fillStyle = '#F2C14E';
    x.strokeStyle = '#1F2E36';
    x.lineWidth = 2;
    x.beginPath();
    for (let a = 0; a < 10; a++) {
      const r = a % 2 ? (big ? 5 : 4) : big ? 11 : 8,
        t = (a * Math.PI) / 5 - Math.PI / 2;
      x.lineTo(HX + Math.cos(t) * r, HY + Math.sin(t) * r);
    }
    x.closePath();
    x.fill();
    x.stroke();
  }
  drawWatersOverlay(x, sc, Z);
  if (typeof drawExtraTools === 'function') drawExtraTools(x, sc, Z);
  const zEl = $('#scZ');
  if (zEl) zEl.textContent = Z + 'px';
}
function mapPointer(ev) {
  const cv = $('#scMap'),
    r = cv.getBoundingClientRect(),
    sc = currentMap(),
    mx = ((ev.clientX - r.left) / r.width) * cv.width,
    my = ((ev.clientY - r.top) / r.height) * cv.height;
  return {
    mx,
    my,
    x: mx / mapEditor.zoom,
    z: sc.h - my / mapEditor.zoom,
    i: Math.floor(mx / mapEditor.zoom),
    j: Math.floor(my / mapEditor.zoom),
  };
}
export function paintMapTile(sc, i, j, ch) {
  if (i < 0 || j < 0 || i >= sc.w || j >= sc.h) return false;
  const row = sc.tiles[j] || ''.padEnd(sc.w, sc.edge);
  if (row[i] === ch) return false;
  sc.tiles[j] = row.slice(0, i) + ch + row.slice(i + 1);
  return true;
}
/* the round ground brush (Walk scenes and the Hub island editor): paints the tiles within the brush's size round
   tile (i, j) (rows from the far edge); true when a tile changed */
export function paintGroundBrush(sc, i, j, ch, brush) {
  const r = brush - 1;
  let any = false;
  for (let a = -r; a <= r; a++)
    for (let b = -r; b <= r; b++) {
      if (a * a + b * b > r * r + r) continue;
      any = paintMapTile(sc, i + a, j + b, ch) || any;
    }
  return any;
}
export function propAtPointer(m) {
  const L = mapEditor.boxes || [];
  for (let k = L.length - 1; k >= 0; k--) {
    const b = L[k];
    if (m.mx >= b.x0 && m.mx <= b.x1 && m.my >= b.y0 && m.my <= b.y1) return b.i;
  }
  return null;
}
/* the tools that change what the ground lock covers (logic/island.js islandGroundHash) */
const LOCKED_GROUND_TOOLS = { paint: 1, fill: 1, height: 1, steps: 1, road: 1 };
function bindEditorMap() {
  const cv = $('#scMap');
  if (!cv || cv._b) return;
  cv._b = 1;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const paint = m => {
    if (paintGroundBrush(currentMap(), m.i, m.j, mapEditor.ter, mapEditor.brush)) {
      walkView.gkey = '';
      drawEditorMap();
    }
  };
  cv.addEventListener('pointerdown', ev => {
    const sc = currentMap(),
      m = mapPointer(ev);
    cv.setPointerCapture(ev.pointerId);
    if (mapEditor.pickPlay) {
      mapEditor.pickPlay = false;
      mapEditor.playAt = { id: currentMapId(), x: +m.x.toFixed(1), z: +m.z.toFixed(1) };
      storyPreviewChanged();
      return;
    }
    /* IS-6a: a locked island's ground (letters, heights, steps) can't change here; props, water, exits still can */
    if (LOCKED_GROUND_TOOLS[mapEditor.tool] && groundLockRefusal(sc)) return void toast(groundLockRefusal(sc));
    if (typeof extraToolPointerDown === 'function' && extraToolPointerDown(sc, m, ev)) return;
    if (mapEditor.tool === 'paint' || mapEditor.tool === 'fill') {
      if (ev.altKey) {
        const ch = (sc.tiles[m.j] || '')[m.i];
        if (ch) {
          mapEditor.ter = ch;
          $$('.sc-ter').forEach(b => b.classList.toggle('on', b.dataset.c === ch));
        }
        return;
      }
      if (mapEditor.tool === 'fill') {
        floodFillGround(sc, m.i, m.j, mapEditor.ter);
        walkView.gkey = '';
        drawEditorMap();
        changed();
        commit(true);
        return;
      }
      mapEditor.drag = { k: 'paint' };
      paint(m);
      return;
    }
    if (mapEditor.tool === 'height') {
      mapEditor.hflat = rawHeightAt(sc, m.x, m.z);
      mapEditor.drag = { k: 'height' };
      sculptHeights(sc, m);
      return;
    }
    if (mapEditor.tool === 'steps') {
      stepsPointerDown(sc, m, ev);
      return;
    }
    if (mapEditor.tool === 'water') {
      if (waterToolRefusal(sc)) return void toast(waterToolRefusal(sc));
      if ((mapEditor.wmode || 'kinds') !== 'kinds' && typeof waterToolsSceneDown === 'function')
        return void waterToolsSceneDown(sc, m, ev);
      const R = sc.waters || [],
        n = waterRectAt(sc, m);
      if (n >= 0 && (ev.button === 2 || ev.altKey || mapEditor.wk === 'erase')) {
        R.splice(n, 1);
        if (!R.length) delete sc.waters;
        watersChanged();
        return;
      }
      if (mapEditor.wk === 'erase') return;
      mapEditor.drag = { k: 'wrect', a: [m.x, m.z], b: [m.x, m.z] };
      return;
    }
    if (mapEditor.tool === 'exits') {
      const hb = mapHub(sc),
        E = sc.exits || (sc.exits = []),
        hit = k => Math.hypot(k[0] * mapEditor.zoom - m.mx, (sc.h - k[1]) * mapEditor.zoom - m.my) < 11;
      if (hit(hb)) {
        mapEditor.drag = { k: 'hub' };
        return;
      }
      const n = E.findIndex(hit);
      if (n >= 0 && (ev.button === 2 || ev.altKey)) {
        E.splice(n, 1);
        syncEdgeExits(sc, null, n);
        drawEditorMap();
        changed();
        commit(true);
        return;
      }
      if (n >= 0) {
        mapEditor.drag = { k: 'exit', n };
        return;
      }
      E.push([+m.x.toFixed(2), +m.z.toFixed(2)]);
      syncEdgeExits(sc, E.length - 1);
      mapEditor.drag = { k: 'exit', n: E.length - 1 };
      drawEditorMap();
      return;
    }
    if (mapEditor.tool === 'path') {
      const P =
        sc.path ||
        (sc.path = [
          [1, sc.h / 2],
          [sc.w - 1, sc.h / 2],
        ]);
      const near = P.findIndex(
        ([a, b]) => Math.hypot(a * mapEditor.zoom - m.mx, (sc.h - b) * mapEditor.zoom - m.my) < 10
      );
      if (near >= 0 && (ev.button === 2 || ev.altKey)) {
        if (P.length > 2) {
          P.splice(near, 1);
          walkView.cand = null;
          walkView.nav = null;
          drawEditorMap();
          changed();
          commit(true);
        }
        return;
      }
      if (near >= 0) {
        mapEditor.drag = { k: 'pt', n: near };
        return;
      }
      let best = -1,
        bd = 1e9;
      for (let k = 0; k < P.length - 1; k++) {
        const d = segmentDistance(m.x, m.z, P[k], P[k + 1]);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (bd * mapEditor.zoom < 12) {
        P.splice(best + 1, 0, [+m.x.toFixed(2), +m.z.toFixed(2)]);
        mapEditor.drag = { k: 'pt', n: best + 1 };
        drawEditorMap();
      }
      return;
    }
    const hit = propAtPointer(m);
    if (mapEditor.tool === 'erase') {
      if (hit != null) {
        sc.props.splice(hit, 1);
        mapEditor.sel = null;
        drawEditorMap();
        changed();
        commit(true);
      }
      return;
    }
    if (mapEditor.tool === 'props') {
      if (hit != null) {
        mapEditor.sel = hit;
        const p = sc.props[hit];
        mapEditor.drag = { k: 'prop', dx: p.x - m.x, dz: p.z - m.z };
        render();
        return;
      }
      if (!mapEditor.prop) {
        toast('Pick a prop from the Props card first.');
        return;
      }
      {
        const q = { k: mapEditor.prop, x: +m.x.toFixed(2), z: +m.z.toFixed(2) },
          M0 = sceneryCatalog().props[mapEditor.prop] || {};
        if (M0.act) {
          q.act = M0.act;
          if (M0.name) q.label = M0.name;
        }
        sc.props.push(q);
      }
      mapEditor.sel = sc.props.length - 1;
      walkView.cand = null;
      walkView.nav = null;
      changed();
      commit(true);
      render();
    }
  });
  cv.addEventListener('pointermove', ev => {
    const D = mapEditor.drag,
      sc = currentMap(),
      m = mapPointer(ev);
    if (typeof extraToolPointerMove === 'function' && extraToolPointerMove(sc, m, D, ev)) return;
    if (!D) {
      if (mapEditor.road || mapEditor.tool === 'scatter') drawEditorMap();
      return;
    }
    if (D.k === 'paint') paint(m);
    else if (D.k === 'height') sculptHeights(sc, m);
    else if (D.k === 'steps') {
      paintStepCells(sc, m, D);
      drawEditorMap();
    } else if (D.k === 'stairs' || D.k === 'bridge' || D.k === 'wrect') {
      D.b = [m.x, m.z];
      drawEditorMap();
    } else if (D.k.startsWith('wt') && typeof waterToolsSceneMove === 'function') {
      waterToolsSceneMove(sc, m, D);
      drawEditorMap();
    } else if (D.k === 'hub' || D.k === 'exit') {
      const q = +clamp(m.x, 0.3, sc.w - 0.3).toFixed(2),
        r = +clamp(m.z, 0.3, sc.h - 0.3).toFixed(2);
      if (D.k === 'hub') sc.hub = [q, r];
      else {
        sc.exits[D.n] = [q, r];
        syncEdgeExits(sc, D.n);
      }
      D.moved = 1;
      walkView.cand = null;
      walkView.nav = null;
      drawEditorMap();
    } else if (D.k === 'pt') {
      const q = clamp(m.x, 0, sc.w),
        r = clamp(m.z, 0, sc.h);
      sc.path[D.n] = [+q.toFixed(2), +r.toFixed(2)];
      D.moved = 1;
      walkView.cand = null;
      walkView.nav = null;
      drawEditorMap();
    } else if (D.k === 'prop') {
      const p = sc.props[mapEditor.sel];
      if (!p) return;
      let nx = m.x + D.dx,
        nz = m.z + D.dz;
      if (!ev.shiftKey) {
        nx = Math.round(nx * 4) / 4;
        nz = Math.round(nz * 4) / 4;
      }
      p.x = +clamp(nx, -4, sc.w + 4).toFixed(2);
      p.z = +clamp(nz, -4, sc.h + 6).toFixed(2);
      D.moved = 1;
      drawEditorMap();
    }
  });
  const up = () => {
    const D = mapEditor.drag;
    mapEditor.drag = null;
    if (!D) return;
    if (typeof extraToolPointerUp === 'function' && extraToolPointerUp(currentMap(), D)) return;
    if (D.k === 'steps' || D.k === 'stairs' || D.k === 'bridge') {
      stepsPointerUp(currentMap(), D);
      return;
    }
    if (D.k === 'wrect') {
      waterPointerUp(currentMap(), D);
      return;
    }
    if (D.k.startsWith('wt') && typeof waterToolsSceneUp === 'function') {
      waterToolsSceneUp(currentMap(), D);
      return;
    }
    if (D.k === 'paint' || D.moved || D.k === 'exit' || D.k === 'height') {
      changed();
      commit(true);
      if (D.k === 'prop') render();
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  $('#scStage').addEventListener(
    'wheel',
    ev => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      mapEditor.zoom = clamp(mapEditor.zoom + (ev.deltaY < 0 ? 2 : -2), 8, 48);
      drawEditorMap();
    },
    { passive: false }
  );
}
function ensureHeightGrid(sc) {
  if (!sc.heights || sc.heights.length !== sc.h + 1)
    sc.heights = Array.from({ length: sc.h + 1 }, (_, r) =>
      Array.from({ length: sc.w + 1 }, (_, i) => (sc.heights && sc.heights[r] && +sc.heights[r][i]) || 0)
    );
  return sc.heights;
}
/* the height brush at m ({x, z} in metres); o: the brush's size, strength, mode (raise, lower, flatten, smooth), the
   height flatten goes to and the lowest and highest it leaves (hmin, hmax: -8 and 12 m unless given). Walk scenes
   passes its own settings; the Hub island editor passes its own, with room for the island's mountain */
export function sculptHeights(sc, m, o = mapEditor) {
  const H = ensureHeightGrid(sc),
    R = Math.max(1, o.brush * 0.9),
    k = o.hstr * 0.35;
  for (let r = 0; r <= sc.h; r++)
    for (let i = 0; i <= sc.w; i++) {
      const z = sc.h - r,
        d = Math.hypot(i - m.x, z - m.z);
      if (d > R) continue;
      const w = (1 - d / R) ** 2,
        v = H[r][i];
      let n = v;
      if (o.hmode === 'raise') n = v + k * w;
      else if (o.hmode === 'lower') n = v - k * w;
      else if (o.hmode === 'flatten') n = v + (o.hflat - v) * Math.min(1, w * k * 4);
      else {
        let s = 0,
          c = 0;
        for (const [a, b] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          const rr = r + a,
            ii = i + b;
          if (H[rr] && H[rr][ii] != null) {
            s += H[rr][ii];
            c++;
          }
        }
        if (c) n = v + (s / c - v) * Math.min(1, w * k * 4);
      }
      H[r][i] = Math.round(clamp(n, o.hmin ?? -8, o.hmax ?? 12) * 100) / 100;
    }
  sc._hv = (sc._hv || 0) + 1;
  /* alpha 0.2: the game's smoothed land (heightGrid) is made again */ walkView.nav = null;
  walkView.cand = null;
  walkView.nav = null;
  clearTimeout(mapEditor.hT);
  mapEditor.hT = setTimeout(() => {
    if (typeof walkRenderer !== 'undefined') walkRenderer.hkey = '';
  }, 120);
  drawEditorMap();
}
ACTIONS.scHMode = d => {
  mapEditor.hmode = d.m;
  render();
};
ACTIONS.scHFlat = async () => {
  const sc = currentMap();
  if (groundLockRefusal(sc)) return void toast(groundLockRefusal(sc));
  if (!(await ask('Make the whole scene flat?', 'Flatten'))) return;
  delete sc.heights;
  walkView.nav = null;
  if (typeof walkRenderer !== 'undefined') walkRenderer.hkey = '';
  changed();
  commit(true);
  render();
};
function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = dx * dx + dz * dz || 1,
    t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L, 0, 1);
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}
function floodFillGround(sc, i, j, ch) {
  const from = (sc.tiles[j] || '')[i];
  if (from == null || from === ch) return;
  const st = [[i, j]];
  let n = 0;
  while (st.length && n < 5000) {
    const [a, b] = st.pop();
    if ((sc.tiles[b] || '')[a] !== from) continue;
    paintMapTile(sc, a, b, ch);
    n++;
    st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
}
document.addEventListener('keydown', ev => {
  if (
    (typeof previewViewport !== 'undefined' && previewViewport.hover) ||
    studioState.sec !== 'scenes' ||
    ev.target.closest('input,select,textarea') ||
    $('#modal').innerHTML ||
    $('#dlg').innerHTML ||
    ev.ctrlKey ||
    ev.metaKey
  )
    return;
  const sc = currentMap();
  if (!sc) return;
  const k = ev.key;
  const T = {
    b: 'paint',
    f: 'fill',
    p: 'props',
    h: 'height',
    c: 'steps',
    x: 'exits',
    w: 'path',
    q: 'water',
    e: 'erase',
  }[k.toLowerCase()];
  if (T) {
    mapEditor.tool = T;
    render();
    return;
  }
  if (mapEditor.sel == null || !sc.props[mapEditor.sel]) return;
  const p = sc.props[mapEditor.sel],
    s = ev.shiftKey ? 1 : 0.25;
  if (k === 'Delete' || k === 'Backspace') {
    ev.preventDefault();
    sc.props.splice(mapEditor.sel, 1);
    mapEditor.sel = null;
    changed();
    commit(true);
    render();
    return;
  }
  const mv = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[k];
  if (mv) {
    ev.preventDefault();
    p.x = +(p.x + mv[0]).toFixed(2);
    p.z = +(p.z + mv[1]).toFixed(2);
    walkView.nav = null;
    changed();
    drawEditorMap();
  }
});
/* field edits for the current scene update the map and preview */
/* Studio plan T6.1: the 2D map (and the prop editor, the terrain thumbnails) redraw in the next frame, once however
   many events came; the walk view rebuilds its paths and ground once the field has been still for 300 ms */
studioState.hooks.scenes = path => {
  if (mapEditor.ped && typeof drawPropEditor === 'function') drawSoon('propEditor', drawPropEditor);
  if (path.startsWith('maps.') || path.startsWith('scenery.')) {
    const ground = /\.(edge|w|h)$/.test(path) || path.startsWith('scenery.terrains');
    mapEditor.rebuildGround = mapEditor.rebuildGround || ground;
    clearTimeout(mapEditor.rebuildT);
    mapEditor.rebuildT = setTimeout(() => {
      walkView.nav = null;
      walkView.cand = null;
      if (mapEditor.rebuildGround) walkView.gkey = '';
      mapEditor.rebuildGround = false;
    }, 300);
    drawSoon('editorMap', drawEditorMap);
    if (path.startsWith('scenery.terrains')) drawSoon('sceneryThumbs', drawSceneryThumbs);
  }
};
/* ---------- actions ---------- */
ACTIONS.scPick = d => {
  studioState.sel.scene = d.k;
  mapEditor.sel = null;
  render();
};
ACTIONS.scKindF = d => {
  mapEditor.kindF = d.k || '';
  render();
};
ACTIONS.scTool = d => {
  mapEditor.tool = d.t;
  render();
};
/* v26: preview the scene at another hour, in other weather or season (environment.js); nothing is saved */
function applyPreviewEnvironment() {
  if (typeof environment === 'undefined') return;
  const e = mapEditor.env || {},
    f = {};
  if (e.time != null && e.time !== '') f.time = +e.time;
  if (e.weather) f.weather = e.weather;
  if (e.season) f.season = e.season;
  environment.force = Object.keys(f).length ? Object.assign({ time: 13, weather: 'clear', now: 1 }, f) : null;
}
ACTIONS.scEnv = () => {
  mapEditor.env = { time: $('#scEnvT').value, weather: $('#scEnvW').value, season: $('#scEnvS').value };
  applyPreviewEnvironment();
};
ACTIONS.scTer = d => {
  mapEditor.ter = d.c;
  mapEditor.tool = mapEditor.tool === 'fill' ? 'fill' : 'paint';
  render();
};
ACTIONS.scProp = d => {
  mapEditor.prop = d.k;
  if (mapEditor.tool !== 'props') mapEditor.tool = 'props';
  render();
};
ACTIONS.scTag = d => {
  mapEditor.tag = d.t;
  render();
};
ACTIONS.scZoom = d => {
  mapEditor.zoom = clamp(mapEditor.zoom + +d.z, 8, 48);
  drawEditorMap();
};
ACTIONS.scDupProp = () => {
  const sc = currentMap(),
    p = sc.props[mapEditor.sel];
  if (!p) return;
  sc.props.push({ ...p, x: +(p.x + 1).toFixed(2) });
  mapEditor.sel = sc.props.length - 1;
  changed();
  commit(true);
  render();
};
ACTIONS.scOwnRoom = () => {
  const D = studioState.D,
    id = currentMapId(),
    sc = currentMap(),
    p = sc.props[mapEditor.sel];
  if (!p) return;
  const kr = ((D.scenery.props || {})[p.k] || {}).room || ROOM_BY_USE[p.act] || 'int_house';
  const from = D.maps[p.room] || D.maps[kr];
  if (!from) return;
  const k = uniqueKey('int_' + id + '_' + p.k, x => !!D.maps[x]);
  D.maps[k] = { ...clone(from), name: (from.name || k) + ' (' + (sc.name || id) + ')', locationId: id, vary: 0 };
  p.room = k;
  if (!p.act) p.act = 'house';
  changed();
  commit(true);
  studioState.sel.scene = k;
  mapEditor.sel = null;
  render();
};
ACTIONS.scVar = d => {
  const sc = currentMap(),
    p = sc.props[mapEditor.sel];
  if (!p) return;
  const v = +d.v | 0;
  if (v) p.v = v;
  else delete p.v;
  changed();
  commit(true);
  render();
};
ACTIONS.scDelProp = () => {
  const sc = currentMap();
  if (mapEditor.sel == null) return;
  sc.props.splice(mapEditor.sel, 1);
  mapEditor.sel = null;
  changed();
  commit(true);
  render();
};
function blankMap(name) {
  const w = 30,
    h = 22;
  return {
    name,
    w,
    h,
    edge: 'g',
    tiles: Array.from({ length: h }, () => 'g'.repeat(w)),
    props: [],
    path: [
      [0.6, 8],
      [8, 8.6],
      [15, 7.6],
      [22, 8.4],
      [29.4, 8],
    ],
    sky: ['#8CC6E6', '#BFE3EE', '#F4E8C8'],
    haze: '#EAD9C0',
    hazeD: 34,
    cam: { pitch: 34, h: 9, fov: 1 },
    blur: 1,
    amb: 'pollen',
    tint: null,
    indoor: 0,
    start: 0.42,
    hub: [15, 8.4],
    exits: [
      [1.1, 8],
      [28.9, 8],
    ],
    far: 'hills',
    farH: 8,
    folk: 0,
  };
}
ACTIONS.scNew = async () => {
  const D = studioState.D,
    r = await dialog(
      'New scene',
      `<label class="fld"><span>Name</span><input id="scnName" value="New place"></label><label class="fld"><span>Start from</span><select id="scnFrom"><option value="">A blank grass field</option>${Object.entries(
        D.maps || {}
      )
        .map(([k, s]) => `<option value="${escapeHtml(k)}">A copy of ${escapeHtml(s.name || k)}</option>`)
        .join(
          ''
        )}</select></label><label class="fld"><span>What it is</span><select id="scnKind"><option value="route">A route (wild, with tall grass)</option><option value="town">A town</option><option value="room">A room inside a building</option><option value="test">A test scene</option></select></label>`,
      [
        { l: 'Cancel', v: false },
        {
          l: 'Create',
          c: 'primary',
          f: () => ({
            n: $('#scnName').value.trim() || 'New place',
            from: $('#scnFrom').value,
            kind: $('#scnKind').value,
          }),
        },
      ]
    );
  if (!r) return;
  const id = uniqueKey(r.n, k => !!(D.maps || {})[k]);
  D.maps = D.maps || {};
  D.maps[id] = r.from ? { ...clone(D.maps[r.from]), name: r.n } : blankMap(r.n);
  D.maps[id].kind = r.kind || 'route';
  if (r.kind === 'room') D.maps[id].building = D.maps[id].building || 'house';
  studioState.sel.scene = id;
  mapEditor.sel = null;
  changed();
  commit(true);
  render();
  toast('Scene created. Pick it for a stop under World & encounters → Route stops.');
};
ACTIONS.scDup = () => {
  const D = studioState.D,
    id = currentMapId(),
    k = uniqueKey(id + 'b', x => !!D.maps[x]);
  D.maps[k] = { ...clone(D.maps[id]), name: (D.maps[id].name || id) + ' (copy)' };
  studioState.sel.scene = k;
  changed();
  commit(true);
  render();
};
ACTIONS.scDel = async () => {
  const D = studioState.D,
    id = currentMapId(),
    u = locationsUsingMap(id);
  if (u.length)
    return toast(
      `${u.map(([r]) => r.name).join(', ')} still use this scene. Pick another scene for ${u.length > 1 ? 'them' : 'it'} first.`,
      'err'
    );
  if (!(await ask('Delete this scene?', 'Delete'))) return;
  delete D.maps[id];
  studioState.sel.scene = null;
  changed();
  commit(true);
  render();
};
ACTIONS.scResize = () => {
  const sc = currentMap(),
    w = clamp(+$('#scW').value || sc.w, 10, 240),
    h = clamp(+$('#scH').value || sc.h, 8, 200);
  if (w === sc.w && h === sc.h) return;
  if (groundLockRefusal(sc)) return void toast(groundLockRefusal(sc));
  const oldE = stepGrid(sc),
    before = clone(sc);
  /* v42: an exit on the north or east edge moves out with that edge (the rest of the map keeps its place); its id and width stay */
  if (sc.edgeExits && sc.exits)
    sc.exits = sc.edgeExits.map((e, k) => {
      const p = sc.exits[k] || exitPoint(sc, e),
        n = e.in == null ? 1.1 : e.in;
      return e.side === 'N' ? [p[0], h - n] : e.side === 'E' ? [w - n, p[1]] : p;
    });
  /* keep the near (bottom) rows and the left columns where they are */
  const rows = sc.tiles.slice(),
    dh = h - sc.h;
  let nr = dh > 0 ? Array.from({ length: dh }, () => sc.edge.repeat(w)).concat(rows) : rows.slice(-dh);
  nr = nr.map(r => (r + sc.edge.repeat(Math.max(0, w))).slice(0, w));
  sc.tiles = nr;
  sc.w = w;
  sc.h = h;
  sc.path = (sc.path || []).map(([x, z]) => [clamp(x, 0, w), clamp(z, 0, h)]);
  if (sc.heights) {
    const old = sc.heights,
      oh = old.length - 1,
      dh2 = h - oh;
    sc.heights = Array.from({ length: h + 1 }, (_, r) => {
      const src = old[r - dh2];
      return Array.from({ length: w + 1 }, (_, i) => (src && src[i] != null ? src[i] : 0));
    });
  }
  if (sc.hub) sc.hub = [clamp(sc.hub[0], 0.3, w - 0.3), clamp(sc.hub[1], 0.3, h - 0.3)];
  if (sc.exits) sc.exits = sc.exits.map(([x, z]) => [clamp(x, 0.3, w - 0.3), clamp(z, 0.3, h - 0.3)]);
  if (sc.edgeExits) syncEdgeExits(sc);
  /* cliffs and stairs: the near rows and left columns stay where they are */
  if (oldE) {
    delete sc.steps;
    delete sc.stepm;
    const E = newStepGrid(sc);
    for (let j = 0; j < Math.min(E.h, oldE.h); j++)
      for (let i = 0; i < Math.min(E.w, oldE.w); i++) {
        E.H[j * E.w + i] = oldE.H[j * oldE.w + i];
        E.M[j * E.w + i] = oldE.M[j * oldE.w + i];
      }
    storeStepGrid(sc, E);
  }
  walkView.gkey = '';
  walkView.nav = null;
  walkView.cand = null;
  changed();
  commit(true);
  render();
  resizeReport(sc, before);
};
/* v42: after a resize, three checks on every exit: it stands on walkable ground, the hub can reach it, and the exit it is
   joined to on the far side faces this one. Problems are listed; the resize can be undone from the same dialog. */
function exitChecks(sc) {
  const D = studioState.D,
    C = sceneryCatalog(),
    out = [],
    E = sc.edgeExits || [],
    ex = sc.exits || [],
    hub = mapHub(sc),
    users = locationsUsingMap(currentMapId()).map(([, i]) => i),
    opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const walk = (x, z) => {
    const ch = (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)],
      T = C.terrains[ch];
    if (!ch) return false;
    if (T && T.walk != null) return !!T.walk;
    return !'wd'.includes(ch) || !!sc.ride;
  };
  const blocked = (x, z) =>
    (sc.props || []).some(p => {
      const M = C.props[p.k];
      if (!M) return false;
      const s = p.s || 1;
      if (M.box) return Math.abs(p.x - x) < (M.box[0] * s) / 2 && z > p.z - 0.3 && z < p.z + M.box[1] * s;
      const r = M.solid != null ? M.solid * s : M.flat ? 0 : (M.shadow || 0) * 0.42 * s;
      return r > 0.05 && Math.hypot(p.x - x, p.z + r * 0.2 - z) < r;
    });
  ex.forEach((p, k) => {
    const e = E[k] || {},
      nm = e.id || `exit ${k + 1}`;
    if (!walk(p[0], p[1])) out.push({ ok: 0, t: `${nm}: stands on water or off the map` });
    else if (blocked(p[0], p[1])) out.push({ ok: 0, t: `${nm}: something solid stands on it` });
    else out.push({ ok: 1, t: `${nm}: on walkable ground` });
    let path = null;
    try {
      if (walkView.sc === sc) {
        walkView.nav = null;
        path = findPath(hub[0], hub[1], p[0], p[1]);
      }
    } catch (err) {
      path = null;
    }
    if (walkView.sc === sc) {
      const end = path && path[path.length - 1];
      out.push(
        end && Math.hypot(end[0] - p[0], end[1] - p[1]) <= 1.6
          ? { ok: 1, t: `${nm}: the hub can reach it` }
          : { ok: 0, t: `${nm}: no way to walk there from the hub` }
      );
    }
    (D.roads || []).forEach(L => {
      const l = PB_DATA.road(D, L),
        here = users.includes(l.a) && l.exitA === e.id ? 'a' : users.includes(l.b) && l.exitB === e.id ? 'b' : null;
      if (!here) return;
      const o = here === 'a' ? l.b : l.a,
        osc = D.maps[(D.locations[o] || {}).mapId],
        oid = here === 'a' ? l.exitB : l.exitA,
        oe = osc && (osc.edgeExits || []).find(q => q.id === oid);
      if (!oe) out.push({ ok: 0, t: `${nm}: the road to ${D.locations[o].name} names no exit on that side` });
      else
        out.push(
          oe.side === opp[e.side]
            ? { ok: 1, t: `${nm}: faces ${D.locations[o].name}'s ${oe.id}, a straight road` }
            : {
                ok: 0,
                t: `${nm} (${e.side}) meets ${D.locations[o].name}'s ${oe.id} (${oe.side}): they don't face each other, so the places can't join`,
              }
        );
    });
  });
  return out;
}
async function resizeReport(sc, before) {
  const r = exitChecks(sc),
    bad = r.filter(x => !x.ok).length;
  const html = `<p class="help">${sc.w} × ${sc.h} m. ${bad ? `${bad} thing${bad > 1 ? 's' : ''} to look at:` : 'Every exit checks out.'}</p><ul class="exit-chk">${r.map(x => `<li class="${x.ok ? 'ok' : 'bad'}">${x.ok ? '✓' : '!'} ${escapeHtml(x.t)}</li>`).join('')}</ul>`;
  const keep = await dialog('Map resized', html, [
    { l: 'Undo the resize', v: false },
    { l: 'Keep it', c: 'primary', v: true },
  ]);
  if (keep !== false) return;
  Object.keys(sc).forEach(k => delete sc[k]);
  Object.assign(sc, before);
  walkView.gkey = '';
  walkView.nav = null;
  walkView.cand = null;
  changed();
  commit(true);
  render();
  toast('Resize undone.');
}
/* v47: every letter and digit is taken by now, so a ground type may also use a sign (not a space, quote, backslash or <>&);
   alpha 0.2: and then any of 190 accented letters (À to ſ), so there is room for many more kinds. A map row is a string
   with one character per square, so nothing else changes: the game looks every character up the same way. */
const GROUND_KEYS =
  'qyzhjvuaeiQYZHJVUAEIbcdfgklmnoprstwxBCDFGKLMNOPRSTWX0123456789$()-./?@[]^{|}' +
  String.fromCharCode(
    ...Array.from({ length: 0x180 - 0xc0 }, (_, i) => 0xc0 + i).filter(c => c !== 0xd7 && c !== 0xf7)
  );
const isGroundKey = k => k.length === 1 && GROUND_KEYS.includes(k);
ACTIONS.scNewTer = async () => {
  const C = sceneryCatalog(),
    used = Object.keys(C.terrains).join('');
  const r = await dialog(
    'New ground type',
    `<div class="grid"><label class="fld"><span>Name</span><input id="ntName" value="Moss"></label><label class="fld"><span>Key (one character; a free one is filled in)</span><input id="ntKey" maxlength="1" value="${GROUND_KEYS.split('').find(c => !used.includes(c)) || ''}"></label>
 <label class="fld"><span>Start from</span><select id="ntFrom">${Object.entries(C.terrains)
   .map(([c, t]) => `<option value="${escapeHtml(c)}">${escapeHtml(t.name)}</option>`)
   .join('')}</select></label></div>`,
    [
      { l: 'Cancel', v: false },
      {
        l: 'Create',
        c: 'primary',
        f: () => {
          const k = $('#ntKey').value;
          if (!k || used.includes(k) || !isGroundKey(k)) {
            toast('Pick an unused key: a letter, a digit, one of $()-./?@[]^{|} or an accented letter.');
            return false;
          }
          return { n: $('#ntName').value.trim() || 'Ground', k, from: $('#ntFrom').value };
        },
      },
    ]
  );
  if (!r) return;
  const base = C.terrains[r.from],
    file = uniqueKey(r.n, f => Object.values(C.terrains).some(t => t.tile === `scene/tiles/${f}.png`)),
    path = `scene/tiles/${file}.png`;
  const src = await atlasGet('art/' + base.tile).catch(() => null),
    c = makeCanvas(16, 16);
  if (src) c.getContext('2d').drawImage(src, 0, 0);
  markArt('art/' + path, c);
  C.terrains[r.k] = { name: r.n, tile: path, z: base.z, edge: base.edge };
  mapEditor.ter = r.k;
  changed();
  commit(true);
  render();
  openSceneryPixelEditor('art/' + path, { kind: 'tile', c: r.k });
};
ACTIONS.scEditTile = d =>
  openSceneryPixelEditor('art/' + sceneryCatalog().terrains[d.c].tile, { kind: 'tile', c: d.c });
ACTIONS.scEditProp = d => {
  const M = sceneryCatalog().props[d.k];
  if (M) openSceneryPixelEditor('art/' + M.img, { kind: 'prop', k: d.k });
};
ACTIONS.scNewProp = async () => {
  const r = await dialog(
    'New prop',
    `<div class="grid"><label class="fld"><span>Name</span><input id="npN" value="Lamp"></label><label class="fld"><span>Width (px)</span><input id="npW" type="number" value="40" min="4" max="320"></label><label class="fld"><span>Height (px)</span><input id="npH" type="number" value="60" min="4" max="320"></label></div><p class="help">34 pixels is one meter in the scene. A person is about 58 pixels tall.</p>`,
    [
      { l: 'Cancel', v: false },
      {
        l: 'Create',
        c: 'primary',
        f: () => ({
          n: $('#npN').value.trim() || 'Prop',
          w: clamp(+$('#npW').value || 40, 4, 320),
          h: clamp(+$('#npH').value || 60, 4, 320),
        }),
      },
    ]
  );
  if (!r) return;
  const c = makeCanvas(r.w, r.h),
    x = c.getContext('2d');
  x.fillStyle = '#B8A8E0';
  x.fillRect(Math.round(r.w * 0.2), Math.round(r.h * 0.1), Math.round(r.w * 0.6), Math.round(r.h * 0.9));
  addSceneryProp(r.n, c);
};
ACTIONS.scImportProp = async () => {
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f);
  if (c.width > 400 || c.height > 400) return toast('Keep props under 400×400 pixels.', 'err');
  addSceneryProp(f.name.replace(/\.png$/i, ''), c);
};
function addSceneryProp(name, c) {
  const C = sceneryCatalog(),
    k = uniqueKey(name, x => !!C.props[x]),
    path = `scene/props/${k}.png`;
  markArt('art/' + path, c);
  C.props[k] = {
    name,
    img: path,
    ox: -Math.floor(c.width / 2),
    oy: -(c.height - 1),
    shadow: +Math.min(2, (c.width / 34) * 0.4).toFixed(2),
    sway: 0,
    flat: 0,
    tags: ['custom'],
  };
  mapEditor.prop = k;
  changed();
  commit(true);
  render();
  openSceneryPixelEditor('art/' + path, { kind: 'prop', k });
}
/* ---------- a small pixel editor for props and ground tiles ---------- */
export async function openSceneryPixelEditor(path, o) {
  const c = await atlasGet(path).catch(() => null);
  if (!c) return toast('Could not open ' + path, 'err');
  mapEditor.pe = { path, ...o };
  mapEditor.peKeep = null;
  mapEditor.peZoom = o.kind === 'tile' ? 16 : clamp(Math.floor(420 / Math.max(c.width, c.height)), 2, 16);
  render();
  setTimeout(() => {
    const e = $('#scPe');
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
}
export function sceneryPixelCardHTML() {
  const pe = mapEditor.pe,
    C = sceneryCatalog(),
    M = pe.kind === 'prop' ? C.props[pe.k] : null,
    base = pe.kind === 'prop' ? `scenery.props.${pe.k}` : '';
  return card(
    pe.kind === 'prop'
      ? `Prop: ${escapeHtml(M ? M.name : pe.k)}`
      : `Ground tile: ${escapeHtml((C.terrains[pe.c] || {}).name || pe.c)}`,
    `<div class="sc-pe" id="scPe"><div class="sc-pe-bar">${pixelCanvasToolsHTML(
      pe.kind === 'prop' && pe.layer == null ? [['anchor', 'Set the base point']] : []
    )}
  <span class="colw"><input type="color" id="scPeColor" value="${mapEditor.peColor}"></span>
  ${pe.kind === 'prop' && pe.layer == null ? '<button class="btn sm" data-act="scPeResize">Resize…</button><button class="btn sm" data-act="scPeReplace">Replace from PNG…</button>' : ''}<span class="grow"></span><button class="btn sm primary" data-act="scPeClose">Done</button></div>
  <div class="sc-pe-body"><div class="sc-pe-stage" id="scPeStage"></div><div class="sc-pe-side"><div class="px-pal" id="scPePal"></div>${pixelCanvasPanelHTML()}
  ${
    M
      ? grid(
          textField('Name', `${base}.name`),
          numberField('Shadow size (m)', `${base}.shadow`, { min: 0, max: 4, step: 0.05 }),
          rangeField('Sways in the wind', `${base}.sway`, { min: 0, max: 1, step: 0.05 }),
          checkboxField('Lies flat on the ground', `${base}.flat`, { num: 1 }),
          textField('Tags', `${base}.tagsTxt`, {
            opt: 1,
            ph: (M.tags || []).join(', '),
            help: 'Comma-separated, for the Props filter.',
          })
        ) +
        `<p class="help">Base point: ${-M.ox}, ${-M.oy}. Pick “Set the base point” and click where the prop touches the ground.</p>${M.glow ? '' : '<button class="btn sm subtle" data-act="scGlowAdd">Add a light glow</button>'}${M.glow ? grid(colorField('Glow color', `${base}.glow.c`), numberField('Glow size (m)', `${base}.glow.r`, { step: 0.1, min: 0.2, max: 6 }), numberField('Glow height (m)', `${base}.glow.y`, { step: 0.1, min: 0, max: 8 })) : ''}`
      : '<p class="help">The tile repeats in every direction, so keep the edges matching.</p>'
  }</div></div></div>`
  );
}
export function mountSceneryPixelEditor() {
  const st = $('#scPeStage');
  if (!st) return;
  const pe = mapEditor.pe,
    keep = mapEditor.peKeep || {};
  const P = pixelCanvas(st, {
    get: () => loadedAtlas(pe.path),
    path: () => pe.path,
    repeat: pe.kind === 'tile' ? 3 : 1,
    tool: mapEditor.peTool,
    color: mapEditor.peColor,
    overlay: () => {
      const M = pe.kind === 'prop' ? sceneryCatalog().props[pe.k] : null;
      if (!M || pe.layer != null) return '';
      const x = -M.ox + 0.5,
        y = -M.oy + 0.5;
      return `<path class="pc-base" d="M${x - 3} ${y}H${x + 3}M${x} ${y - 3}V${y + 3}"/>`;
    },
    hostTool: (P, t, x, y) => {
      if (t !== 'anchor') return false;
      const M = sceneryCatalog().props[pe.k];
      M.ox = -x;
      M.oy = -y;
      changed();
      commit(true);
      render();
      return true;
    },
    changed: sceneryPixelsChanged,
    toolChanged: P => (mapEditor.peTool = P.tool),
    colorChanged: P => {
      mapEditor.peColor = P.color;
      const c = $('#scPeColor');
      if (c) c.value = P.color;
    },
    drawn: P => {
      mapEditor.peKeep = {
        zoom: P.zoom,
        showGrid: P.showGrid,
        symMode: P.symMode,
        symShift: P.symShift,
        lock: P.lock,
        showOff: P.showOff,
      };
    },
  });
  Object.assign(P, keep, { zoom: keep.zoom || mapEditor.peZoom });
  mapEditor.pePc = P;
  pixelCanvasPanel(P, $('#scPe'));
  drawPixelCanvas(P);
  sceneryPixelPalette();
  const col = $('#scPeColor');
  col.addEventListener('input', () => pixelCanvasColor(P, col.value));
  const tg = $('[data-p$=".tagsTxt"]');
  if (tg)
    tg.addEventListener('change', () => {
      const M = sceneryCatalog().props[mapEditor.pe.k];
      M.tags = tg.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      delete M.tagsTxt;
      changed();
      commit(true);
    });
}
/* the painter's keys (the pixel canvas's) while the pointer is over it; the map's own keys otherwise */
document.addEventListener(
  'keydown',
  ev => {
    const pe = $('#scPe'),
      P = mapEditor.pePc;
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
function sceneryPixelsChanged() {
  const c = loadedAtlas(mapEditor.pe.path);
  markArt(mapEditor.pe.path, c);
  if (mapEditor.ped && typeof drawPropEditor === 'function') drawPropEditor();
  if (mapEditor.pe.kind === 'tile') walkView.gkey = '';
  drawSceneryThumbs();
  drawEditorMap();
  sceneryPixelPalette();
}
function sceneryPixelPalette() {
  const el = $('#scPePal'),
    c = loadedAtlas(mapEditor.pe && mapEditor.pe.path);
  if (!el || !c) return;
  const d = new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer),
    cnt = new Map();
  for (const v of d) if (v >>> 24 > 0) cnt.set(v, (cnt.get(v) || 0) + 1);
  el.innerHTML = [...cnt.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 36)
    .map(([v]) => {
      const h =
        '#' +
        [v & 255, (v >> 8) & 255, (v >> 16) & 255]
          .map(q => q.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
      return `<button class="sw" style="background:${h}" data-act="scPeSw" data-c="${h}" title="${h}"></button>`;
    })
    .join('');
}
ACTIONS.scPeSw = d => {
  if (mapEditor.pePc) pixelCanvasColor(mapEditor.pePc, d.c);
};
ACTIONS.scPeClose = () => {
  mapEditor.pe = null;
  render();
};
ACTIONS.scGlowAdd = () => {
  sceneryCatalog().props[mapEditor.pe.k].glow = { c: '#FFD27A', r: 1.4, y: 1.6 };
  changed();
  commit(true);
  render();
};
ACTIONS.scPeResize = async () => {
  const c = loadedAtlas(mapEditor.pe.path),
    r = await dialog(
      'Resize the picture',
      `<p class="help">New space is added evenly on the left and right and at the top, so the base stays put.</p><div class="grid"><label class="fld"><span>Width</span><input id="rsW" type="number" value="${c.width}" min="4" max="400"></label><label class="fld"><span>Height</span><input id="rsH" type="number" value="${c.height}" min="4" max="400"></label></div>`,
      [
        { l: 'Cancel', v: false },
        {
          l: 'Resize',
          c: 'primary',
          f: () => ({ w: clamp(+$('#rsW').value || c.width, 4, 400), h: clamp(+$('#rsH').value || c.height, 4, 400) }),
        },
      ]
    );
  if (!r) return;
  const n = makeCanvas(r.w, r.h),
    dx = Math.round((r.w - c.width) / 2),
    dy = r.h - c.height;
  n.getContext('2d').drawImage(c, dx, dy);
  const M = sceneryCatalog().props[mapEditor.pe.k];
  M.ox -= dx;
  M.oy -= dy;
  markArt(mapEditor.pe.path, n);
  artStep(mapEditor.pe.path, pictureImage(c), pictureImage(n));
  changed();
  commit(true);
  render();
};
ACTIONS.scPeReplace = async () => {
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f),
    M = sceneryCatalog().props[mapEditor.pe.k],
    before = pictureImage(loadedAtlas(mapEditor.pe.path));
  markArt(mapEditor.pe.path, c);
  artStep(mapEditor.pe.path, before, pictureImage(c));
  M.ox = -Math.floor(c.width / 2);
  M.oy = -(c.height - 1);
  changed();
  commit(true);
  render();
};

/* v17: the scene's life as text and back */
function mapLifeText(sc) {
  return (sc.life || [])
    .map(
      L =>
        `${L.k} ${L.n || 1}` +
        (L.area ? ` at ${L.area.join(' ')}` : '') +
        (L.path ? ` along ${L.path.map(p => p.join(' ')).join(', ')}` : '')
    )
    .join('\n');
}
function parseMapLife(t) {
  const out = [];
  for (const line of t.split('\n')) {
    const m =
      /^\s*(duck|pigeon|chicken|sheep|car|rabbit|squirrel|frog|gull|goat|cat|crab|lizard)\s+(\d+)\s*(?:at\s+([-\d.\s]+))?\s*(?:along\s+(.+))?$/i.exec(
        line
      );
    if (!m) continue;
    const e = { k: m[1].toLowerCase(), n: Math.max(1, Math.min(20, +m[2])) };
    if (m[3]) {
      const a = m[3].trim().split(/\s+/).map(Number);
      if (a.length === 4 && a.every(isFinite)) e.area = a;
    }
    if (m[4]) {
      const P = m[4]
        .split(',')
        .map(q => q.trim().split(/\s+/).map(Number))
        .filter(q => q.length === 2 && q.every(isFinite));
      if (P.length >= 2) e.path = P;
    }
    if (e.k === 'car' && !e.path) continue;
    out.push(e);
  }
  return out;
}

/* ---------- v18: cliffs, terraces, stairs, ledges and bridges (the step field, half-metre cells) ---------- */
function stepsToolBarHTML() {
  const mats = (typeof WALL_MATERIALS !== 'undefined' ? WALL_MATERIALS : ['Scene rock'])
    .map(
      (n, i) =>
        `<option value="${i}" ${mapEditor.smat === i ? 'selected' : ''}>${i ? escapeHtml(n) : 'The scene’s own rock'}</option>`
    )
    .join('');
  const modes = [
    ['cliff', 'Cliff & terrace'],
    ['stairs', 'Stairs'],
    ['ramp', 'Ramp'],
    ['ledge', 'Ledge'],
    ['bridge', 'Bridge'],
    ['erase', 'Erase'],
  ]
    .map(
      ([k, n]) =>
        `<button class="seg ${mapEditor.smode === k ? 'on' : ''}" data-act="scSMode" data-m="${k}">${n}</button>`
    )
    .join('');
  const opt =
    mapEditor.smode === 'cliff'
      ? `<label class="mp-size"><span>Height (m)</span><input type="number" id="scSH" step=".25" min="-6" max="10" value="${mapEditor.sh}" class="sm-num"></label><label class="mp-size"><span>Face</span><select id="scSMat">${mats}</select></label>`
      : mapEditor.smode === 'stairs'
        ? `<label class="mp-size"><span>Steps</span><select id="scSMat">${mats}</select></label>`
        : mapEditor.smode === 'bridge'
          ? `<label class="mp-size"><span>Kind</span><select id="scBK">${[
              ['wood', 'Wooden'],
              ['stone', 'Stone arch'],
              ['rope', 'Rope'],
              ['pier', 'Jetty (flat, over water, from the bank out)'],
            ]
              .map(([k, n]) => `<option value="${k}" ${mapEditor.bkind === k ? 'selected' : ''}>${n}</option>`)
              .join(
                ''
              )}</select></label><label class="mp-size"><span>Width (m)</span><input type="number" id="scBW" step=".1" min=".8" max="5" value="${mapEditor.bw}" class="sm-num"></label>`
          : '';
  return `<div class="sc-hbar">${modes}${opt}<label class="fld chk"><input type="checkbox" id="scWalkOv" ${mapEditor.walkOv ? 'checked' : ''}><span>Can I walk there?</span></label></div>`;
}
ACTIONS.scSMode = d => {
  mapEditor.smode = d.m;
  render();
};
document.addEventListener('change', ev => {
  const t = ev.target;
  if (!t || !t.id) return;
  if (t.id === 'scSH') mapEditor.sh = clamp(+t.value || 0, -6, 10);
  else if (t.id === 'scSMat') mapEditor.smat = +t.value || 0;
  else if (t.id === 'scBK') mapEditor.bkind = t.value;
  else if (t.id === 'scBW') mapEditor.bw = clamp(+t.value || 1.6, 0.8, 5);
  else if (t.id === 'scWalkOv') {
    mapEditor.walkOv = t.checked;
    drawEditorMap();
  }
});
function workingStepGrid(sc) {
  if (mapEditor.stE) return mapEditor.stE;
  const E = stepGrid(sc);
  mapEditor.stE = E ? { w: E.w, h: E.h, H: new Float32Array(E.H), M: new Uint8Array(E.M) } : newStepGrid(sc);
  return mapEditor.stE;
}
function stepsPointerDown(sc, m, ev) {
  const E = workingStepGrid(sc),
    ci = clamp(Math.floor(m.x * 2), 0, E.w - 1),
    cj = clamp(Math.floor(m.z * 2), 0, E.h - 1);
  if (mapEditor.smode === 'cliff' && ev.shiftKey) {
    mapEditor.sh = Math.round(E.H[cj * E.w + ci] * 4) / 4;
    mapEditor.stE = null;
    const i = $('#scSH');
    if (i) i.value = mapEditor.sh;
    return;
  }
  if (mapEditor.smode === 'bridge') {
    if (ev.altKey || ev.button === 2) {
      const L = sc.bridges || [],
        k = L.findIndex(b => segmentDistance(m.x, m.z, b.a, b.b) < (b.w || 1.6) / 2 + 0.3);
      mapEditor.stE = null;
      if (k >= 0) {
        L.splice(k, 1);
        if (!L.length) delete sc.bridges;
        walkView.nav = null;
        changed();
        commit(true);
        drawEditorMap();
      }
      return;
    }
    mapEditor.stE = null;
    mapEditor.drag = { k: 'bridge', a: [m.x, m.z], b: [m.x, m.z] };
    return;
  }
  if (mapEditor.smode === 'stairs' || mapEditor.smode === 'ramp') {
    mapEditor.drag = { k: 'stairs', ramp: mapEditor.smode === 'ramp', a: [m.x, m.z], b: [m.x, m.z] };
    return;
  }
  mapEditor.drag = { k: 'steps', alt: ev.altKey || ev.button === 2 };
  paintStepCells(sc, m, mapEditor.drag);
  drawEditorMap();
}
function paintStepCells(sc, m, D) {
  const E = workingStepGrid(sc),
    r = Math.max(0.3, mapEditor.brush * 0.5);
  for (let j = Math.floor((m.z - r) * 2); j <= Math.ceil((m.z + r) * 2); j++)
    for (let i = Math.floor((m.x - r) * 2); i <= Math.ceil((m.x + r) * 2); i++) {
      if (i < 0 || j < 0 || i >= E.w || j >= E.h) continue;
      if (Math.hypot((i + 0.5) / 2 - m.x, (j + 0.5) / 2 - m.z) > r) continue;
      const q = j * E.w + i;
      if (mapEditor.smode === 'cliff') {
        E.H[q] = mapEditor.sh;
        E.M[q] = (E.M[q] & 16) | (mapEditor.smat & 15);
      } else if (mapEditor.smode === 'erase') {
        E.H[q] = 0;
        E.M[q] = 0;
      } else if (mapEditor.smode === 'ledge') {
        E.M[q] = D.alt ? E.M[q] & 15 : E.M[q] | 16;
      }
    }
}
function stepsPointerUp(sc, D) {
  if (D.k === 'bridge') {
    mapEditor.stE = null;
    const L = Math.hypot(D.b[0] - D.a[0], D.b[1] - D.a[1]);
    if (L >= 0.8) {
      (sc.bridges || (sc.bridges = [])).push(
        Object.assign(
          {
            a: [+D.a[0].toFixed(2), +D.a[1].toFixed(2)],
            b: [+D.b[0].toFixed(2), +D.b[1].toFixed(2)],
            w: mapEditor.bw,
            kind: mapEditor.bkind === 'pier' ? 'wood' : mapEditor.bkind,
          },
          mapEditor.bkind === 'pier' ? { pier: 1 } : {}
        )
      );
      walkView.nav = null;
      changed();
      commit(true);
    }
    drawEditorMap();
    return;
  }
  const E = mapEditor.stE || workingStepGrid(sc);
  if (D.k === 'stairs') {
    /* a straight flight along the longer direction of the drag, from the ground at its start to the ground at its end */
    const ax = Math.abs(D.b[0] - D.a[0]) >= Math.abs(D.b[1] - D.a[1]) ? 'x' : 'z',
      a0 = ax === 'x' ? Math.floor(D.a[0] * 2) : Math.floor(D.a[1] * 2),
      a1 = ax === 'x' ? Math.floor(D.b[0] * 2) : Math.floor(D.b[1] * 2),
      sg = a1 >= a0 ? 1 : -1,
      n = Math.abs(a1 - a0) - 1;
    const across = ax === 'x' ? D.a[1] : D.a[0],
      nw = mapEditor.brush + 1,
      b0 = Math.floor(across * 2 - nw / 2 + 0.5);
    const cell = (a, b) => (ax === 'x' ? [a, b] : [b, a]),
      tot = (a, b) => {
        const [i, j] = cell(a, b),
          q = clamp(j, 0, E.h - 1) * E.w + clamp(i, 0, E.w - 1);
        return rawHeightAt(sc, (i + 0.5) / 2, (j + 0.5) / 2) + E.H[q];
      };
    if (n < 1) {
      toast('Drag further: from the low ground, across the slope, to the high ground.');
      mapEditor.stE = null;
      return;
    }
    const tA = tot(a0, b0 + (nw >> 1)),
      tB = tot(a1, b0 + (nw >> 1)),
      rise = Math.abs(tB - tA) / (n + 1);
    for (let k = 1; k <= n; k++) {
      const a = a0 + sg * k,
        y = tA + ((tB - tA) * k) / (n + 1);
      for (let b = b0; b < b0 + nw; b++) {
        const [i, j] = cell(a, b);
        if (i < 0 || j < 0 || i >= E.w || j >= E.h) continue;
        const q = j * E.w + i;
        E.H[q] = Math.round((y - rawHeightAt(sc, (i + 0.5) / 2, (j + 0.5) / 2)) * 20) / 20;
        E.M[q] = D.ramp ? (E.M[q] & 15) | 32 : mapEditor.smat || 8;
      }
    }
    /* v23: a ramp is a smooth slope (flag 32): no risers, the ground leans from one end to the other */
    if (rise > MAX_STEP_RISE)
      toast(
        D.ramp
          ? `The ramp climbs ${Math.round(rise * 200)} cm per metre, too steep to walk up. Make it longer.`
          : `Each step rises ${Math.round(rise * 100)} cm, too tall to walk up. Make the flight longer.`
      );
  }
  storeStepGrid(sc, E);
  mapEditor.stE = null;
  walkView.nav = null;
  walkView.cand = null;
  changed();
  commit(true);
  drawEditorMap();
}
/* phase 09 batch 9: which way a turned prop faces, on the map: its footprint turned (a box) and an arrow out of its
   front. The map shows the land from above with z up the screen, so a point's screen y is (H - z) * Z. */
function drawPropFacing(x, p, M, Z, H) {
  const S = (a, b) => {
      const q = turnedPoint(p, a, b);
      return [q[0] * Z, (H - q[1]) * Z];
    },
    s = p.s || 1;
  x.save();
  x.strokeStyle = 'rgba(242,193,78,.95)';
  x.fillStyle = 'rgba(242,193,78,.95)';
  x.lineWidth = 1.5;
  if (M && M.box) {
    const w = (M.box[0] * s) / 2,
      d = M.box[1] * s;
    x.setLineDash([3, 2]);
    x.beginPath();
    for (const [j, [a, b]] of [
      [-w, -0.1],
      [w, -0.1],
      [w, d],
      [-w, d],
    ].entries()) {
      const [u, v] = S(a, b);
      if (j) x.lineTo(u, v);
      else x.moveTo(u, v);
    }
    x.closePath();
    x.stroke();
    x.setLineDash([]);
  }
  const L = Math.max(0.6, M && M.box ? Math.min(M.box[0], M.box[1]) * s * 0.5 : 0.6),
    [ax, ay] = S(0, 0),
    [bx, by] = S(0, -L),
    [lx, ly] = S(-0.18, -L + 0.25),
    [rx, ry] = S(0.18, -L + 0.25);
  x.beginPath();
  x.moveTo(ax, ay);
  x.lineTo(bx, by);
  x.stroke();
  x.beginPath();
  x.moveTo(bx, by);
  x.lineTo(lx, ly);
  x.lineTo(rx, ry);
  x.closePath();
  x.fill();
  x.restore();
}
function drawStepsOverlay(x, sc, Z) {
  const E = mapEditor.stE || stepGrid(sc),
    hz = Z / 2,
    H = sc.h;
  if (E) {
    const at = (i, j) => E.H[clamp(j, 0, E.h - 1) * E.w + clamp(i, 0, E.w - 1)];
    for (let j = 0; j < E.h; j++)
      for (let i = 0; i < E.w; i++) {
        const h = E.H[j * E.w + i],
          m = E.M[j * E.w + i],
          X = i * hz,
          Y = (H - (j + 1) / 2) * Z;
        if (Math.abs(h) > 0.02) {
          x.fillStyle =
            h > 0
              ? `rgba(255,250,235,${Math.min(0.55, 0.12 + h * 0.09)})`
              : `rgba(10,20,60,${Math.min(0.5, 0.12 - h * 0.12)})`;
          x.fillRect(X, Y, hz, hz);
        }
        if ((m & 15) === 8 || ((m & 15) === 7 && Math.abs(h) > 0.02)) {
          x.fillStyle = 'rgba(60,40,20,.35)';
          x.fillRect(X, Y + hz * 0.45, hz, Math.max(1, hz * 0.12));
        }
        if (m & 32) {
          x.strokeStyle = 'rgba(255,255,255,.55)';
          x.lineWidth = 1;
          x.beginPath();
          x.moveTo(X, Y + hz);
          x.lineTo(X + hz, Y);
          x.stroke();
        }
        if (m & 16) {
          x.fillStyle = 'rgba(242,193,78,.85)';
          x.beginPath();
          x.moveTo(X + hz * 0.2, Y + hz * 0.35);
          x.lineTo(X + hz * 0.8, Y + hz * 0.35);
          x.lineTo(X + hz * 0.5, Y + hz * 0.75);
          x.closePath();
          x.fill();
        }
      }
    /* faces: a dark line where the ground steps; thick where it is too tall to walk up */
    for (let j = 0; j < E.h; j++)
      for (let i = 0; i < E.w; i++) {
        const h = at(i, j),
          X = i * hz,
          Y = (H - (j + 1) / 2) * Z;
        for (const [di, dj] of [
          [1, 0],
          [0, 1],
        ]) {
          const d = Math.abs(h - at(i + di, j + dj));
          if (d < 0.03 || i + di >= E.w || j + dj >= E.h) continue;
          x.strokeStyle = d > MAX_STEP_RISE ? 'rgba(40,24,12,.9)' : 'rgba(40,24,12,.35)';
          x.lineWidth = d > MAX_STEP_RISE ? 2 : 1;
          x.beginPath();
          if (di) {
            x.moveTo(X + hz, Y);
            x.lineTo(X + hz, Y + hz);
          } else {
            x.moveTo(X, Y);
            x.lineTo(X + hz, Y);
          }
          x.stroke();
        }
      }
  }
  /* bridges, rails, arches, escalators */
  const line = (a, b, w, col) => {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.lineCap = 'butt';
    x.beginPath();
    x.moveTo(a[0] * Z, (H - a[1]) * Z);
    x.lineTo(b[0] * Z, (H - b[1]) * Z);
    x.stroke();
  };
  for (const b of sc.bridges || []) {
    line(b.a, b.b, (b.w || 1.6) * Z, b.kind === 'stone' ? 'rgba(150,144,132,.9)' : 'rgba(132,88,52,.9)');
    line(b.a, b.b, 2, 'rgba(40,24,12,.8)');
  }
  for (const r of sc.rails || [])
    for (let k = 0; k < (r.pts || []).length - 1; k++) line(r.pts[k], r.pts[k + 1], 2, 'rgba(30,30,40,.85)');
  for (const a of sc.arches || []) {
    const w = (a.w || 2.4) + 1.1,
      d = a.d || 1,
      z = (a.dir || 'z') === 'z';
    x.fillStyle = 'rgba(120,70,50,.75)';
    if (z) x.fillRect((a.x - w / 2) * Z, (H - a.z - d) * Z, w * Z, d * Z);
    else x.fillRect(a.x * Z, (H - a.z - w / 2) * Z, d * Z, w * Z);
  }
  for (const e of sc.escalators || []) {
    line(e.a, e.b, (e.w || 1.4) * Z, 'rgba(120,200,220,.55)');
  }
  const D = mapEditor.drag;
  if (D && (D.k === 'stairs' || D.k === 'bridge')) {
    x.setLineDash([6, 4]);
    line(D.a, D.b, D.k === 'bridge' ? mapEditor.bw * Z : (mapEditor.brush + 1) * hz, 'rgba(200,50,60,.5)');
    x.setLineDash([]);
  }
  /* where you can walk: red where you can't, gold arrows where you can hop down */
  if (mapEditor.walkOv && mapEditor.tool === 'steps' && walkView.sc === sc && !mapEditor.stE) {
    const G = navGrid(),
      k = Z / G.N;
    for (let j = 0; j < G.gh; j++)
      for (let i = 0; i < G.gw; i++) {
        const q = j * G.gw + i,
          X = i * k,
          Y = (H - (j + 1) / G.N) * Z;
        if (G.blk[q]) {
          x.fillStyle = 'rgba(200,40,50,.38)';
          x.fillRect(X, Y, k, k);
          continue;
        }
        const up = j + 1 < G.gh ? q + G.gw : -1,
          dn = j > 0 ? q - G.gw : -1,
          rt = i + 1 < G.gw ? q + 1 : -1,
          lf = i > 0 ? q - 1 : -1;
        for (const n of [up, dn, rt, lf]) {
          if (n < 0 || G.blk[n]) continue;
          if (!canStepBetween(G, q, n) && !canStepBetween(G, n, q)) {
            x.fillStyle = 'rgba(200,40,50,.25)';
            x.fillRect(X + k * 0.3, Y + k * 0.3, k * 0.4, k * 0.4);
          }
        }
      }
  }
}

/* ---------- v22: kinds of water, painted as rectangles over the water ---------- */
/* each kind's name and swatch; the list is logic/water-kinds.js WATER_KINDS (WA-9: sea, lava and ice were missing) */
const WATER_KIND_SWATCHES = {
  pond: ['Pond', '#4FA6C0'],
  stream: ['Stream', '#7FD0E6'],
  canal: ['Canal', '#5E8C84'],
  spring: ['Spring', '#3FD6D0'],
  swamp: ['Swamp', '#6B7A34'],
  lake: ['Lake', '#2E6FB0'],
  sea: ['Sea', '#1F5E9A'],
  lava: ['Lava', '#E2662C'],
  ice: ['Ice', '#CFE8F2'],
  /* water track WA-5a: the appended kinds */
  rapids: ['Rapids', '#D8F0F4'],
  hotspring: ['Hot spring', '#7FD8C8'],
  oasis: ['Oasis', '#3FB8A8'],
  bog: ['Bog', '#5A5A2A'],
  reef: ['Reef', '#3FD0C8'],
  cave: ['Cave', '#2A5A70'],
};
export const PAINTED_WATER_KINDS = WATER_KINDS.map(k => [k, ...(WATER_KIND_SWATCHES[k] || [k, '#888888'])]);
/* WA-9: the water tool's modes: kinds (rectangles), a saved scene's rivers (streams) and falls (studio/js/water-tools.js) */
const WATER_TOOL_MODES = [
  ['kinds', 'Kinds'],
  ['rivers', 'Rivers'],
  ['falls', 'Falls'],
];
/** the hub island's water is not changed here (its fall waits for the hub track's HB-4b): why, or '' */
export const waterToolRefusal = sc =>
  sc && sc.islandGen
    ? "The hub island's water stays as it is: its waterfall waits for the hub track (HB-4b), so the water tools don't change it."
    : '';
function waterToolBarHTML(p) {
  const sc = currentMap();
  mapEditor.wk = mapEditor.wk || 'pond';
  if (waterToolRefusal(sc))
    return `<div class="sc-hbar"><p class="help warn">${escapeHtml(waterToolRefusal(sc))}</p></div>`;
  const mode = mapEditor.wmode || 'kinds',
    modes = `<div class="seg-row">${WATER_TOOL_MODES.map(([k, n]) => `<button class="seg ${mode === k ? 'on' : ''}" data-act="scWMode" data-k="${k}">${n}</button>`).join('')}</div>`;
  if (mode !== 'kinds' && typeof waterToolsSceneBarHTML === 'function') return modes + waterToolsSceneBarHTML(sc, mode);
  return `${modes}<div class="sc-hbar">${PAINTED_WATER_KINDS.map(([k, n, c]) => `<button class="seg ${mapEditor.wk === k ? 'on' : ''}" data-act="scWK" data-k="${k}"><span class="sc-swatch" style="background:${c}"></span>${n}</button>`).join('')}<button class="seg ${mapEditor.wk === 'erase' ? 'on' : ''}" data-act="scWK" data-k="erase">Remove</button>
 <label class="mp-size"><span>The rest of the water</span><select id="scWDef">${[['', 'Guess (caves: spring, towns: canal, else pond)'], ...PAINTED_WATER_KINDS.filter(w => w[0] !== 'stream').map(([k, n]) => [k, n])].map(([k, n]) => `<option value="${k}" ${(sc.waterKind || '') === k ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label>
 ${(sc.waters || []).length ? `<button class="btn sm subtle" data-act="scWClear">Remove all ${(sc.waters || []).length}</button>` : ''}</div>`;
}
ACTIONS.scWMode = d => {
  mapEditor.wmode = d.k;
  render();
};
ACTIONS.scWK = d => {
  mapEditor.wk = d.k;
  render();
};
ACTIONS.scWClear = async () => {
  const sc = currentMap();
  if (waterToolRefusal(sc)) return void toast(waterToolRefusal(sc));
  if (!(await ask('Remove every water rectangle in this scene?', 'Remove'))) return;
  delete sc.waters;
  watersChanged();
  render();
};
document.addEventListener('change', ev => {
  if (ev.target.id !== 'scWDef') return;
  const sc = currentMap();
  if (!sc || waterToolRefusal(sc)) return;
  if (ev.target.value) sc.waterKind = ev.target.value;
  else delete sc.waterKind;
  watersChanged();
});
function waterRectAt(sc, m) {
  const R = sc.waters || [];
  for (let i = R.length - 1; i >= 0; i--) {
    const r = R[i];
    if (m.x >= r.x && m.z >= r.z && m.x < r.x + r.w && m.z < r.z + r.h) return i;
  }
  return -1;
}
export function watersChanged() {
  if (typeof walkRenderer !== 'undefined') walkRenderer.hkey = '';
  changed();
  commit(true);
  drawEditorMap();
}
function waterPointerUp(sc, D) {
  const snap = v => Math.round(v * 2) / 2,
    x0 = snap(Math.min(D.a[0], D.b[0])),
    x1 = snap(Math.max(D.a[0], D.b[0])),
    z0 = snap(Math.min(D.a[1], D.b[1])),
    z1 = snap(Math.max(D.a[1], D.b[1]));
  if (x1 - x0 < 0.5 || z1 - z0 < 0.5) {
    drawEditorMap();
    return;
  }
  (sc.waters || (sc.waters = [])).push({ x: x0, z: z0, w: x1 - x0, h: z1 - z0, k: mapEditor.wk || 'pond' });
  watersChanged();
}
function drawWatersOverlay(x, sc, Z) {
  const on = mapEditor.tool === 'water',
    H = sc.h,
    R = sc.waters || [];
  if (on && (mapEditor.wmode || 'kinds') !== 'kinds' && typeof waterToolsSceneDraw === 'function')
    waterToolsSceneDraw(x, sc, Z, mapEditor.wmode);
  if (!R.length && !on) return;
  const col = k => (PAINTED_WATER_KINDS.find(w => w[0] === k) || PAINTED_WATER_KINDS[0])[2];
  R.forEach(r => {
    const X = r.x * Z,
      Y = (H - r.z - r.h) * Z,
      w = r.w * Z,
      h = r.h * Z;
    x.globalAlpha = on ? 0.38 : 0.14;
    x.fillStyle = col(r.k);
    x.fillRect(X, Y, w, h);
    x.globalAlpha = 1;
    x.strokeStyle = col(r.k);
    x.lineWidth = on ? 2 : 1;
    x.setLineDash(on ? [] : [4, 4]);
    x.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1);
    x.setLineDash([]);
    if (on) {
      x.fillStyle = '#fff';
      x.strokeStyle = 'rgba(0,0,0,.6)';
      x.lineWidth = 3;
      x.font = '700 11px system-ui';
      x.textAlign = 'left';
      x.textBaseline = 'top';
      const t = (PAINTED_WATER_KINDS.find(w => w[0] === r.k) || [0, r.k])[1];
      x.strokeText(t, X + 4, Y + 3);
      x.fillText(t, X + 4, Y + 3);
    }
  });
  const D = mapEditor.drag;
  if (D && D.k === 'wrect') {
    const X = Math.min(D.a[0], D.b[0]) * Z,
      Y = (H - Math.max(D.a[1], D.b[1])) * Z;
    x.strokeStyle = '#fff';
    x.lineWidth = 2;
    x.setLineDash([6, 4]);
    x.strokeRect(X, Y, Math.abs(D.b[0] - D.a[0]) * Z, Math.abs(D.b[1] - D.a[1]) * Z);
    x.setLineDash([]);
  }
}
document.addEventListener('change', ev => {
  if (ev.target && ev.target.dataset && ev.target.dataset.actChange === 'scEnv') ACTIONS.scEnv();
});
ACTIONS.scTestRun = () => {
  const id = currentMapId();
  if (!id) return;
  window.open(`../game/index.html?test=1&scene=${encodeURIComponent(id)}`, '_blank');
  toast('Opening a test run. Edits here show up there as you make them.');
};

/* alpha 0.4: people who stand in a scene and talk (scene.people); Project Story S3: what they say is a script, and
   their id is unique in the whole game (the checks and visits:id name them by it) */
ACTIONS.scPplAdd = () => {
  const sc = currentMap(),
    h = sc.hub || [sc.w / 2, sc.h / 2],
    ids = new Set(Object.values(studioState.D.maps || {}).flatMap(M => (M.people || []).map(q => q.id)));
  let n = 1;
  while (ids.has('person' + n)) n++;
  (sc.people || (sc.people = [])).push({
    id: 'person' + n,
    who: Object.keys(studioState.D.people)[0],
    name: 'Someone',
    x: +(h[0] + 1.5).toFixed(2),
    z: +(h[1] + 1).toFixed(2),
    dir: 'down',
    script: ['Hello there. #l:' + lineIdHash(currentMapId() + '|person' + n).slice(0, 4)],
  });
  changed();
  commit(true);
  render();
};
ACTIONS.scPplDel = d => {
  const sc = currentMap();
  if (!sc.people) return;
  sc.people.splice(+d.i, 1);
  if (!sc.people.length) delete sc.people;
  changed();
  commit(true);
  render();
};
