'use strict';
/* ================= POCKET BILLIES STUDIO · walk scenes =================
   Each route stop shows a tilt-shift diorama on the Walk screen (game/js/walk-view.js). A scene is a grid of ground
   tiles (one character per tile), a list of props, a walking path and a camera. Props and ground tiles are PNG files
   in art/scene/ that can be painted here. The live preview runs the game's own renderer on your unsaved changes. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  VP,
  pedCard,
  pedDraw,
  pedMount,
  provide,
  scxBlocksBar,
  scxDown,
  scxDraw,
  scxHint,
  scxMove,
  scxMultiCard,
  scxScatterBar,
  scxTools,
  scxUp,
} from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { ART, cnv } from '../../game/js/art.js';
import {
  DIO_RISE,
  artImage,
  dioFind,
  dioNav,
  dioPass,
  dioSteps,
  dioStepsNew,
  dioStepsStore,
  exitEdge,
  exitPoint,
  mapHub,
  pointAlongMapPath,
  setArtImage,
  setWalkData,
  walkView,
} from '../../game/js/walk-view.js';
import { ENV } from '../../game/js/environment.js';
import { DGL_WALL_MATS, dioHRaw, dioMount, walkRenderer } from '../../game/js/walk-view-gl.js';
import { esc } from './game-stand-ins.js';
import {
  ACTS,
  SECTIONS,
  ST,
  after,
  ask,
  card,
  changed,
  clone,
  commit,
  dialog,
  fChk,
  fColor,
  fNum,
  fRange,
  fSel,
  fText,
  grid,
  peopleOpts,
  render,
  toast,
  uidKey,
} from './studio-app.js';
import { ATL_VER, atlasGet, atlasNow, fileToCanvas, markArt, pickFile } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  SCN: [() => SCN],
  SC_TER_KEYS: [() => SC_TER_KEYS],
  SC_WK: [() => SC_WK],
  blankScene: [() => blankScene, v => (blankScene = v)],
  dioArtVer: [() => dioArtVer, v => ((dioArtVer = v), provide({ dioArtVer }))],
  scAddProp: [() => scAddProp, v => (scAddProp = v)],
  scArt: [() => scArt, v => ((scArt = v), provide({ scArt }))],
  scBindMap: [() => scBindMap, v => (scBindMap = v)],
  scCur: [() => scCur],
  scD: [() => scD],
  scDrawSteps: [() => scDrawSteps, v => (scDrawSteps = v)],
  scDrawWaters: [() => scDrawWaters, v => (scDrawWaters = v)],
  scEnvApply: [() => scEnvApply, v => (scEnvApply = v)],
  scExitChecks: [() => scExitChecks, v => (scExitChecks = v)],
  scExitId: [() => scExitId, v => (scExitId = v)],
  scExitJoinsDrop: [() => scExitJoinsDrop, v => (scExitJoinsDrop = v)],
  scExitName: [() => scExitName, v => (scExitName = v)],
  scExitNames: [() => scExitNames, v => (scExitNames = v)],
  scExitSync: [() => scExitSync, v => (scExitSync = v)],
  scFlood: [() => scFlood, v => (scFlood = v)],
  scHGrid: [() => scHGrid, v => (scHGrid = v)],
  scHeightAt: [() => scHeightAt, v => (scHeightAt = v)],
  scHint: [() => scHint, v => (scHint = v)],
  scId: [() => scId],
  scLifeParse: [() => scLifeParse, v => (scLifeParse = v)],
  scLifeText: [() => scLifeText, v => (scLifeText = v)],
  scMapDraw: [() => scMapDraw, v => (scMapDraw = v)],
  scMount: [() => scMount, v => (scMount = v)],
  scOpenPe: [() => scOpenPe, v => (scOpenPe = v)],
  scPeDone: [() => scPeDone, v => (scPeDone = v)],
  scPeDraw: [() => scPeDraw, v => (scPeDraw = v)],
  scPeFill: [() => scPeFill, v => (scPeFill = v)],
  scPeMount: [() => scPeMount, v => (scPeMount = v)],
  scPePalette: [() => scPePalette, v => (scPePalette = v)],
  scPePlot: [() => scPePlot, v => (scPePlot = v)],
  scPixelCard: [() => scPixelCard, v => (scPixelCard = v)],
  scPos: [() => scPos, v => (scPos = v)],
  scPreview: [() => scPreview, v => (scPreview = v)],
  scPropAt: [() => scPropAt, v => (scPropAt = v)],
  scPropSettings: [() => scPropSettings, v => (scPropSettings = v)],
  scResizeReport: [() => scResizeReport, v => (scResizeReport = v)],
  scSetTile: [() => scSetTile, v => (scSetTile = v)],
  scStepsBar: [() => scStepsBar, v => (scStepsBar = v)],
  scStepsDown: [() => scStepsDown, v => (scStepsDown = v)],
  scStepsPaint: [() => scStepsPaint, v => (scStepsPaint = v)],
  scStepsUp: [() => scStepsUp, v => (scStepsUp = v)],
  scStepsWork: [() => scStepsWork, v => (scStepsWork = v)],
  scTerKeyOk: [() => scTerKeyOk],
  scThumbs: [() => scThumbs, v => (scThumbs = v)],
  scUsers: [() => scUsers],
  scWaterAt: [() => scWaterAt, v => (scWaterAt = v)],
  scWaterBar: [() => scWaterBar, v => (scWaterBar = v)],
  scWaterChanged: [() => scWaterChanged, v => (scWaterChanged = v)],
  scWaterUp: [() => scWaterUp, v => (scWaterUp = v)],
  segDist: [() => segDist, v => (segDist = v)],
});
/* eslint-enable no-func-assign */
provide({ dioArtVer, scArt });
/* to-module: end */
setWalkData(() => ({ scenes: (ST.D && ST.D.scenes) || {}, sc: (ST.D && ST.D.scenery) || { terrains: {}, props: {} } }));
setArtImage(path => atlasNow('art/' + path) || ART.img[path]);
function dioArtVer() {
  return ATL_VER;
}
export const SCN = {
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
  peUndo: [],
};
/* every picture a scene can use: ground tiles and their variants, props and their layers, 3D building textures, life */
export function scArt(C) {
  C = C || scD();
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
export const scD = () => ST.D.scenery || (ST.D.scenery = { ppu: 34, tile: 16, terrains: {}, props: {}, person: 1.75 });
provide({ scD }); /* to-module */
export const scId = () => {
  const S = ST.D.scenes || (ST.D.scenes = {});
  if (!S[ST.sel.scene]) ST.sel.scene = Object.keys(S)[0] || null;
  return ST.sel.scene;
};
export const scCur = () => {
  const id = scId();
  return id ? ST.D.scenes[id] : null;
};
const scUsers = id => ST.D.route.map((r, i) => [r, i]).filter(([r]) => r.scene === id);
/* ---------- section ---------- */
SECTIONS.scenes = () => {
  const D = ST.D,
    id = scId(),
    sc = scCur();
  after(scMount);
  /* v46: each scene says what it is (kind: town, route, room, test); the list is grouped by kind and can be filtered */
  const kindOf = ([k, s]) =>
      s.kind || (s.test ? 'test' : s.room ? 'room' : scUsers(k).some(([r]) => r.town) ? 'town' : 'route'),
    KN = { town: 'Town', route: 'Route', room: 'Room', test: 'Test' };
  const row = ([k, s]) =>
      `<button class="lrow ${k === id ? 'on' : ''}" data-act="scPick" data-k="${esc(k)}"><b>${esc(s.name || k)} <span class="kind-badge k-${kindOf([k, s])}">${KN[kindOf([k, s])] || '?'}</span></b><small>${
        s.test
          ? `Test scene · ${(s.checks || []).length} checks`
          : s.room
            ? `Inside a ${esc(s.building || s.room)}`
            : scUsers(k)
                .map(([r, i]) => `${i + 1}. ${esc(r.name)}`)
                .join(', ') || 'Not used by a stop'
      }</small></button>`,
    all = Object.entries(D.scenes || {});
  const kf = SCN.kindF || '',
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
  const p = `scenes.${id}`,
    T = scD().terrains;
  const terr = Object.entries(T)
    .map(
      ([ch, t]) =>
        `<button class="sc-ter ${SCN.ter === ch ? 'on' : ''}" data-act="scTer" data-c="${esc(ch)}" title="${esc(t.name)} (${esc(ch)})"><canvas data-tile="${esc(ch)}" width="16" height="16"></canvas><small>${esc(t.name)}</small></button>`
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
    ...(typeof scxTools === 'function' ? scxTools() : []),
  ]
    .map(
      ([k, n, s]) =>
        `<button class="seg ${SCN.tool === k ? 'on' : ''}" data-act="scTool" data-t="${k}" title="${n} (${s})">${n}</button>`
    )
    .join('');
  const tags = [...new Set(Object.values(scD().props).flatMap(P => P.tags || []))].sort();
  const props = Object.entries(scD().props)
    .filter(([k, P]) => !SCN.tag || (P.tags || []).includes(SCN.tag))
    .map(
      ([k, P]) =>
        `<button class="sc-prop ${SCN.prop === k ? 'on' : ''}" data-act="scProp" data-k="${esc(k)}" title="${esc(P.name || k)}"><span class="sc-thumb" data-img="${esc(P.img)}"></span><small>${esc(P.name || k)}</small></button>`
    )
    .join('');
  const sel = SCN.sel != null && sc.props[SCN.sel] && !(SCN.multi && SCN.multi.size > 1) ? sc.props[SCN.sel] : null;
  const selCard = sel
    ? `<div class="sc-sel"><b>${esc((scD().props[sel.k] || {}).name || sel.k)}</b>${grid(fNum('Across', `${p}.props.${SCN.sel}.x`, { step: 0.1 }), fNum('Depth', `${p}.props.${SCN.sel}.z`, { step: 0.1 }), fNum('Size', `${p}.props.${SCN.sel}.s`, { step: 0.05, min: 0.2, max: 4, opt: 1, ph: '1' }))}
  ${grid(
    fSel(
      'When tapped',
      `${p}.props.${SCN.sel}.act`,
      [
        ['shop', 'Open the shop'],
        ['clinic', 'Heal the team (clinic)'],
        ['lab', 'Show a message (lab)'],
        ['house', 'Show a message (house)'],
        ['home', 'Your room (walk into it)'],
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
          fText('Label above it', `${p}.props.${SCN.sel}.label`, {
            opt: 1,
            ph: sel.act === 'shop' ? 'Shop' : sel.act === 'clinic' ? 'Clinic' : 'none',
          }),
          fText('What it says', `${p}.props.${SCN.sel}.say`, { opt: 1 }),
        ]
      : []),
    ...(sel.act === 'lift'
      ? [
          fSel(
            'Goes to',
            `${p}.props.${SCN.sel}.to`,
            (ST.D.route || []).map(r => [r.id, r.name]),
            { opt: 1 }
          ),
        ]
      : []),
    ...(sel.act === 'shop'
      ? [
          fSel(
            'Which shop',
            `${p}.props.${SCN.sel}.shop`,
            Object.entries(ST.D.shops || {}).map(([k, v]) => [k, v.name]),
            { none: 'The stop’s shop', opt: 1 }
          ),
        ]
      : [])
  )}
  <details class="sc-look"><summary>Look: tint, wear and variety</summary>${grid(fColor('Tint', `${p}.props.${SCN.sel}.tint`, { help: 'Black for none. Tints the painted parts only (not outlines, windows or lights).' }), fRange('Tint strength', `${p}.props.${SCN.sel}.tintAmt`, { min: 0, max: 1, step: 0.05, def: 0.6 }), fRange('Wear and tear (× usual)', `${p}.props.${SCN.sel}.wear`, { min: 0, max: 3, step: 0.05, def: 1, help: 'Dirt, moss, faded paint and cracks. The kinds and amounts are set per prop in the prop editor.' }), fChk('Exactly as drawn (no size, colour or turn variety)', `${p}.props.${SCN.sel}.plain`, { num: 1 }))}</details>
  ${(() => {
    const P0 = scD().props[sel.k] || {};
    if (!P0.build) return '';
    return grid(
      fSel(
        'Roof',
        `${p}.props.${SCN.sel}.roof`,
        [
          ['moss', 'A green moss roof'],
          ['solar', 'Solar shingles'],
          ['chrome', 'Chrome (Pearlantis)'],
        ],
        { none: 'Its own roof', opt: 1, rr: 1 }
      ),
      fRange('Turned (degrees)', `${p}.props.${SCN.sel}.rot`, {
        min: -30,
        max: 30,
        step: 1,
        def: 0,
        help: 'alpha 0.4: a building turned a little along its street; its footprint, door and room turn with it.',
      })
    );
  })()}
  ${(() => {
    const P0 = scD().props[sel.k] || {};
    if (!P0.build && !P0.box) return '';
    const rooms = Object.entries(ST.D.scenes)
      .filter(([k, v]) => v.kind === 'room' || /^int_/.test(k))
      .map(([k, v]) => [k, v.name || k]);
    const kindRoom =
      {
        bakery: 'int_bakery',
        inn: 'int_inn',
        bank: 'int_bank',
        library: 'int_library',
        school: 'int_school',
        station: 'int_station',
        fire_station: 'int_fire_station',
        mansion: 'int_mansion',
        barn: 'int_barn',
        greenhouse: 'int_greenhouse',
        ski_lodge: 'int_ski_lodge',
        market_hall: 'int_market_hall',
      }[sel.k] ||
      { shop: 'int_shop', clinic: 'int_clinic', lab: 'int_lab', house: 'int_house', home: 'int_home' }[sel.act] ||
      '';
    return `<div class="sc-room">${grid(fSel('Room inside', `${p}.props.${SCN.sel}.room`, rooms, { none: kindRoom ? 'The one for its kind (' + ((ST.D.scenes[kindRoom] || {}).name || kindRoom) + ')' : 'None', opt: 1, rr: 1, help: 'Where you walk in when you tap it (it needs “When tapped” set). Rooms open in place, larger than the building, with the town dimmed around them.' }))}<div class="seg-row"><button class="btn sm" data-act="scOwnRoom">Give it a room of its own</button>${sel.room || kindRoom ? `<button class="btn sm subtle" data-act="scPick" data-k="${esc(sel.room || kindRoom)}">Open its room</button>` : ''}</div></div>`;
  })()}
  ${(() => {
    const V = ((scD().props[sel.k] || {}).build || {}).variants;
    if (!V || !V.length) return '';
    const P0 = scD().props[sel.k];
    return `<div class="fld sc-var"><span>Colours</span><div class="sc-var-row">${[{ img: P0.img, wallCol: P0.build.wallCol, roofCol: P0.build.roofCol }, ...V].map((v, i) => `<button class="sc-var-b ${(sel.v | 0) === i ? 'on' : ''}" data-act="scVar" data-v="${i}" title="${i ? 'Variant ' + i : 'As drawn'}"><span class="sc-thumb" data-img="${esc(v.img)}"></span><i style="background:${esc(v.roofCol || '#888')}"></i><i style="background:${esc(v.wallCol || '#ccc')}"></i></button>`).join('')}</div><small class="help">The same building in other colours. It keeps its shape, roof and rooms.</small></div>`;
  })()}
  <div class="seg-row">${fChk('Mirrored', `${p}.props.${SCN.sel}.f`, { num: 1 })}<button class="btn sm" data-act="scDupProp">Duplicate</button><button class="btn sm danger subtle" data-act="scDelProp">Remove</button><button class="btn sm subtle" data-act="scEditProp" data-k="${esc(sel.k)}">Edit this prop’s pixels</button></div></div>`
    : SCN.multi && SCN.multi.size > 1 && typeof scxMultiCard === 'function'
      ? scxMultiCard()
      : '<p class="help">Click a prop on the map to select it. Arrow keys nudge it, Delete removes it. Shift-drag a box (or shift-click) to select several.</p>';
  return `<div class="split sc-split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="scNew">+ New scene</button></div><div class="llist">${list}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${esc(id)}</small><h2>${esc(sc.name || id)}</h2></div><div class="seg-row"><button class="btn subtle" data-act="scDup">Duplicate</button><button class="btn danger" data-act="scDel">Delete</button></div></div>
 ${card(
   'Preview',
   `<div class="sc-pv"><canvas id="scPv"></canvas><div class="sc-pv-load" id="scPvLoad">Loading…</div></div>
  <div class="seg-row"><button class="seg ${SCN.pv === 'roam' ? 'on' : ''}" data-act="scPv" data-m="roam">Walk around</button><button class="seg ${SCN.pv === 'path' ? 'on' : ''}" data-act="scPv" data-m="path">Follow the path</button><button class="btn sm subtle" data-act="scPvHub">Back to the hub</button>${typeof wrHubScene === 'function' ? `<button class="seg ${SCN.joined ? 'on' : ''}" data-act="scJoined" title="The place with its neighbours joined at its edges, as the game shows it">With its neighbours</button>` : ''}<button class="btn sm" data-act="scTestRun" title="Opens the game in a new tab, straight into this scene, with a throwaway save. Your edits show up there as you make them.">Test run in the game</button></div>
  <div class="seg-row sc-env"><select id="scEnvT" data-act-change="scEnv" aria-label="Time of day">${[
    ['', 'Midday'],
    ['7', 'Morning'],
    ['20.6', 'Sunset'],
    ['23.5', 'Night'],
  ]
    .map(([v, n]) => `<option value="${v}" ${String((SCN.env || {}).time ?? '') === v ? 'selected' : ''}>${n}</option>`)
    .join('')}</select><select id="scEnvW" data-act-change="scEnv" aria-label="Weather">${[
    ['', 'Fair'],
    ['cloudy', 'Cloudy'],
    ['rain', 'Rain'],
    ['storm', 'Storm'],
    ['fog', 'Fog'],
    ['snow', 'Snow'],
    ['ash', 'Falling ash'],
  ]
    .map(([v, n]) => `<option value="${v}" ${((SCN.env || {}).weather || '') === v ? 'selected' : ''}>${n}</option>`)
    .join('')}</select><select id="scEnvS" data-act-change="scEnv" aria-label="Season">${[
    ['', 'No season'],
    ['spring', 'Spring'],
    ['summer', 'Summer'],
    ['autumn', 'Autumn'],
    ['winter', 'Winter'],
  ]
    .map(([v, n]) => `<option value="${v}" ${((SCN.env || {}).season || '') === v ? 'selected' : ''}>${n}</option>`)
    .join(
      ''
    )}</select><span class="hint">How it looks at other times and in other weather (the game follows the clock)</span></div>
  <div class="grid">${SCN.pv === 'path' ? `<label class="fld range"><span>Walker position <output id="scTO">${Math.round(SCN.t * 100)}%</output></span><input type="range" id="scT" min="0" max="1" step=".01" value="${SCN.t}"></label>` : ''}
  <label class="fld chk"><input type="checkbox" id="scEnc" ${SCN.enc ? 'checked' : ''}><span>Show hidden encounters</span></label><label class="fld chk"><input type="checkbox" id="scNpc" ${SCN.npc ? 'checked' : ''}><span>Show a trainer</span></label></div>`,
   {
     sub: 'The game’s Walk screen renderer with your unsaved changes. In “Walk around”, click the preview to walk, and click buildings, signs and exits to see what they do.',
   }
 )}
 ${card(
   'Map',
   `<div class="sc-bar"><span class="px-tools">${tools}</span><span class="px-tools"><button class="seg" data-act="scZoom" data-z="-4">−</button><span id="scZ">${SCN.zoom}px</span><button class="seg" data-act="scZoom" data-z="4">+</button></span>
   <label class="mp-size"><span>Brush</span><input type="range" id="scBrush" min="1" max="5" value="${SCN.brush}"><output id="scBrushO">${SCN.brush}</output></label></div>
  ${
    SCN.tool === 'steps'
      ? scStepsBar()
      : SCN.tool === 'water'
        ? scWaterBar(p)
        : SCN.tool === 'scatter' && typeof scxScatterBar === 'function'
          ? scxScatterBar()
          : SCN.tool === 'stamp' && typeof scxBlocksBar === 'function'
            ? scxBlocksBar()
            : SCN.tool === 'height'
              ? `<div class="sc-hbar">${[
                  ['raise', 'Raise'],
                  ['lower', 'Lower'],
                  ['smooth', 'Smooth'],
                  ['flatten', 'Flatten'],
                ]
                  .map(
                    ([k, n]) =>
                      `<button class="seg ${SCN.hmode === k ? 'on' : ''}" data-act="scHMode" data-m="${k}">${n}</button>`
                  )
                  .join(
                    ''
                  )}<label class="mp-size"><span>Strength</span><input type="range" id="scHStr" min=".05" max=".8" step=".05" value="${SCN.hstr}"></label><button class="btn sm subtle" data-act="scHFlat">Make it all flat</button></div>`
              : `<div class="sc-ters">${terr}</div>`
  }
  <div class="sc-stage" id="scStage"><canvas id="scMap"></canvas></div>
  <p class="help" id="scHint">${scHint()}</p>${SCN.tool === 'path' ? `<div class="seg-row"><button class="btn sm" data-act="scxSmoothPath">Smooth the path into a curve</button></div>` : ''}${selCard}`,
   {
     sub: 'Top is far away, bottom is close to the camera. The gold star is where you stand when you stay; green dots are the exits roads leave through.',
   }
 )}
 ${card(
   'Props',
   `<div class="seg-row"><button class="seg ${!SCN.tag ? 'on' : ''}" data-act="scTag" data-t="">All</button>${tags.map(t => `<button class="seg sm ${SCN.tag === t ? 'on' : ''}" data-act="scTag" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
  <div class="sc-props">${props}</div><div class="seg-row"><button class="btn" data-act="scNewProp">+ New blank prop</button><button class="btn" data-act="scImportProp">+ Prop from PNG</button>${SCN.prop ? `<button class="btn subtle" data-act="scEditProp" data-k="${esc(SCN.prop)}">Edit ${esc((scD().props[SCN.prop] || {}).name || SCN.prop)}</button>` : ''}</div>
  <p class="help">Pick a prop, then click the map with “Place & move props”. Prop pictures live in art/scene/props.</p>${SCN.prop && scD().props[SCN.prop] ? `<div class="seg-row"><button class="btn primary" data-act="pedOpen" data-k="${esc(SCN.prop)}">Open ${esc(scD().props[SCN.prop].name || SCN.prop)} in the prop editor</button><span class="help">Effects, door, layers for depth, facing, glow and a 3D turntable.</span></div>` : ''}`
 )}
 ${SCN.ped && scD().props[SCN.ped] ? pedCard(SCN.ped) : ''}
 ${SCN.pe ? scPixelCard() : ''}
 ${sc.kind === 'town' || sc.kind === 'route' ? `<div class="seg-row sc-keep">${fChk('Keep this layout: the v46 rework tool (tools/build-places-v46.py) never rebuilds it', `${p}.keep`, { num: 1 })}</div>` : ''}
 ${card(
   'Look and camera',
   `${grid(
     fText('Name', `${p}.name`, { rr: 1 }),
     fSel(
       'Outside the map',
       `${p}.edge`,
       Object.entries(T).map(([c, t]) => [c, t.name]),
       { help: 'Ground shown past the edges.' }
     ),
     fSel('In the air', `${p}.amb`, [
       ['pollen', 'Pollen'],
       ['spore', 'Spores'],
       ['drip', 'Drips'],
       ['sand', 'Blowing sand'],
       ['dust', 'Sparkling dust'],
       ['none', 'Nothing'],
     ]),
     fChk('Indoors or underground (no clouds)', `${p}.indoor`, { num: 1 }),
     fChk('You ride over the water here', `${p}.ride`, { num: 1 }),
     fChk('Open water to the horizon', `${p}.flatFar`, { num: 1 }),
     fSel(
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
     fNum('Darkness away from lights', `${p}.dark`, {
       opt: 1,
       min: 0,
       max: 1,
       step: 0.05,
       ph: 'auto',
       help: '0 = lit as usual, 1 = only your lantern, lamps and glowing things light it. Empty: caves are dark, everywhere else is lit.',
     }),
     ...(sc.room
       ? [
           fText('Who stands behind the counter', `${p}.keeper`, {
             help:
               'A person from People (their id), or folk:<number> for a townsperson. This is a room you walk into from a ' +
               esc(sc.room) +
               '.',
           }),
         ]
       : [])
   )}
  ${grid(
    fSel(
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
    fRange('Distant hills height', `${p}.farH`, { min: 3, max: 16, step: 0.5, def: 8 }),
    fNum('Townsfolk walking around', `${p}.folk`, { min: 0, max: 12, step: 1 }),
    fSel(
      'Town flag',
      `${p}.flag`,
      [['default', 'The coin ring'], ...(scD().flags || []).map(k => [k, ((D.scenes[k] || {}).name || k) + '’s flag'])],
      {
        none: 'This town’s own',
        opt: 1,
        help: 'What the flag poles here fly (art/scene/flags/<name>.png, made by tools/build-flags.py).',
      }
    ),
    fRange('Wind', `${p}.wind`, { min: 0, max: 3, step: 0.1, def: 1 }),
    fRange('Prop variety', `${p}.variety`, {
      min: 0,
      max: 2,
      step: 0.05,
      def: 1,
      help: 'How much props differ from their neighbours in size, colour and turn.',
    }),
    fRange('Wear and tear', `${p}.wear`, {
      min: 0,
      max: 2,
      step: 0.05,
      def: 1,
      help: 'Dirt, moss, faded paint and cracks on buildings and props here.',
    }),
    fNum('Look seed', `${p}.lookSeed`, {
      opt: 1,
      min: 0,
      step: 1,
      help: 'Change it for a different random look; the same number always gives the same look.',
    }),
    fChk('Sun rays', `${p}.rays`, { num: 1 })
  )}
  <label class="fld wide"><span>What townsfolk say (one line each)</span><textarea id="scChat" rows="3" placeholder="Lovely day for a walk.">${esc((sc.chat || []).join('\n'))}</textarea></label>
  <div class="grid colors">${fColor('Sky top', `${p}.sky.0`)}${fColor('Sky middle', `${p}.sky.1`)}${fColor('Horizon', `${p}.sky.2`)}${fColor('Haze', `${p}.haze`)}${fColor('Shade (caves, malls)', `${p}.tint`, { help: 'Leave black for none.' })}</div>
  ${grid(fRange('Haze distance', `${p}.hazeD`, { min: 8, max: 80, step: 1 }), fRange('Tilt-shift blur', `${p}.blur`, { min: 0, max: 1.5, step: 0.05, def: 1 }), fRange('Camera tilt (degrees)', `${p}.cam.pitch`, { min: 20, max: 70, step: 1 }), fRange('Camera height', `${p}.cam.h`, { min: 4, max: 20, step: 0.5 }), fRange('Zoom', `${p}.cam.fov`, { min: 0.5, max: 2, step: 0.05, def: 1 }), fRange('Where you arrive on the path', `${p}.start`, { min: 0, max: 0.95, step: 0.01, def: 0.42 }))}
  <div class="seg-row"><span class="help">Size</span><input type="number" id="scW" min="10" max="240" value="${sc.w}" class="sm-num"> × <input type="number" id="scH" min="8" max="200" value="${sc.h}" class="sm-num"><button class="btn sm" data-act="scResize">Resize the map</button><span class="help">Used by: ${
    scUsers(id)
      .map(([r, i]) => `${i + 1}. ${esc(r.name)}`)
      .join(', ') || 'no stop yet (pick it under World & encounters → Route stops)'
  }</span></div>`
 )}
 ${card(
   'Life',
   `<p class="help">Animals and traffic that move around this scene. One per line: <span class="mono">duck 4</span>, <span class="mono">pigeon 6 at 24 17 41 27</span> (an area: left, near, right, far), <span class="mono">chicken 5 at …</span>, <span class="mono">sheep 3 at …</span>, <span class="mono">car 3 along 20 13, 44 13, 44 31, 20 31</span> (a loop of points the cars drive round; they stop for you). Also <span class="mono">rabbit</span>, <span class="mono">squirrel</span>, <span class="mono">frog</span> (they live on the bank and leap in when you come close), <span class="mono">gull</span>, <span class="mono">goat</span>, <span class="mono">cat</span>, <span class="mono">crab</span> and <span class="mono">lizard</span>.</p>
  <label class="fld wide"><span>What moves here</span><textarea id="scLife" rows="4" class="mono">${esc(scLifeText(sc))}</textarea></label>`
 )}
 ${card(
   'People who talk',
   `<p class="help">alpha 0.4: someone who stands here and talks when you tap them (no battle), like Granny Juniper in Copperleaf. What they say the first time, then one of the other lines each time after; a line can start with an expression like <span class="mono">[happy]</span>.</p>
  ${(sc.people || [])
    .map(
      (
        q,
        i
      ) => `<div class="sc-person">${grid(fSel('Look', `${p}.people.${i}.who`, peopleOpts()), fText('Name', `${p}.people.${i}.name`), fNum('Across (m)', `${p}.people.${i}.x`, { step: 0.1 }), fNum('Depth (m)', `${p}.people.${i}.z`, { step: 0.1 }))}
   <label class="fld wide"><span>The first time (one line each)</span><textarea data-scppl="${i}" data-f="first" rows="3">${esc((q.first || []).join('\n'))}</textarea></label>
   <label class="fld wide"><span>After that (one line each, one at a time)</span><textarea data-scppl="${i}" data-f="lines" rows="3">${esc((q.lines || []).join('\n'))}</textarea></label>
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
         `<tr><td><canvas data-tile="${esc(c)}" width="16" height="16" class="sc-tilebig"></canvas></td><td class="mono">${esc(c)}</td><td><input type="text" data-p="scenery.terrains.${c}.name" data-k="text" value="${esc(t.name)}"></td><td><input type="number" data-p="scenery.terrains.${c}.z" data-k="num" value="${t.z}" min="0" max="9" class="sm-num" title="Higher layers draw their edge line over lower ones"></td><td><span class="colw"><input type="color" data-p="scenery.terrains.${c}.edge" data-k="color" value="${t.edge}"></span></td><td><button class="btn sm" data-act="scEditTile" data-c="${esc(c)}">Edit pixels</button></td></tr>`
     )
     .join('')}</tbody></table>
  <div class="seg-row"><button class="btn" data-act="scNewTer">+ New ground type</button></div><p class="help">Tiles are 16×16 and repeat seamlessly. Where two ground types meet, the higher layer draws a thin edge line in its edge color.</p>`
 )}
 </div></div>`;
};
function scPropSettings(k) {
  const P = scD().props[k],
    b = `scenery.props.${k}`;
  return `<h4>${esc(P.name || k)} settings</h4>${grid(
    fText('Name', `${b}.name`),
    fText('Variant group', `${b}.group`, { opt: 1, help: 'Props in the same group are variants of each other.' }),
    fNum('Shadow size (m)', `${b}.shadow`, { min: 0, max: 4, step: 0.05 }),
    fNum('Sway in the wind', `${b}.sway`, { min: 0, max: 1, step: 0.05 }),
    fNum('Solid radius (m)', `${b}.solid`, {
      opt: 1,
      min: 0,
      max: 4,
      step: 0.05,
      help: 'People walk around this. Empty: guessed from the shadow. 0: walk through.',
    }),
    fNum('Footprint width (m)', `${b}.box.0`, {
      opt: 1,
      min: 0,
      max: 12,
      step: 0.1,
      help: 'For buildings and fences: a box instead of a circle.',
    }),
    fNum('Footprint depth (m)', `${b}.box.1`, { opt: 1, min: 0, max: 12, step: 0.1 }),
    fNum('Door across (px)', `${b}.door.x`, {
      opt: 1,
      step: 1,
      help: 'Where people walk to when it’s tapped, from the bottom middle.',
    }),
    fNum('Walkable radius (m)', `${b}.walk`, {
      opt: 1,
      min: 0,
      max: 4,
      step: 0.1,
      help: 'For stepping stones and bridges: opens water under it.',
    }),
    fChk('Lies flat on the ground', `${b}.flat`, { num: 1 })
  )}
  <p class="help">Effects (${(P.fx || []).map(f => f.k).join(', ') || 'none'}) are set in art/scene/props.json and the scenery catalog.</p>`;
}
function scHint() {
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
      }[SCN.smode],
      height:
        'Drag to raise or lower the ground. Smooth softens bumps, Flatten levels everything to the height where you started. Steep slopes become cliffs nobody can climb; roads should stay gentle.',
      water:
        'Drag a rectangle over water to make it a pond, stream, canal, spring, swamp or lake. Later rectangles win where they overlap; right-click (or Alt-click) one to remove it. Water you don’t cover uses the scene’s own kind, and running water (a stream path) is a stream.',
      exits:
        'Drag the gold star (where you stand when you stay) or a green exit. Click empty ground to add an exit; right-click (or Alt-click) an exit to remove it. Roads leave through the exit that points their way on the world map.',
      erase: 'Click a prop to remove it.',
    }[SCN.tool] || (typeof scxHint === 'function' ? scxHint(SCN.tool) : '')
  );
}
/* ---------- mount ---------- */
async function scMount() {
  const sc = scCur();
  if (!sc) return;
  const C = scD();
  const paths = scArt(C);
  await Promise.all(paths.map(p => atlasGet('art/' + p).catch(() => null)));
  scThumbs();
  scMapDraw();
  scBindMap();
  if (SCN.ped && scD().props[SCN.ped] && typeof pedMount === 'function') {
    const l = $('#scPvLoad');
    if (l) {
      l.hidden = false;
      l.textContent = 'Paused while the prop editor’s turntable runs';
    }
    pedMount();
  } else scPreview();
  const tr = $('#scT');
  if (tr)
    tr.addEventListener('input', () => {
      SCN.t = +tr.value;
      $('#scTO').textContent = Math.round(SCN.t * 100) + '%';
    });
  const e = $('#scEnc');
  if (e) e.addEventListener('change', () => (SCN.enc = e.checked));
  const n = $('#scNpc');
  if (n) n.addEventListener('change', () => (SCN.npc = n.checked));
  const hs = $('#scHStr');
  if (hs)
    hs.addEventListener('input', () => {
      SCN.hstr = +hs.value;
    });
  const br = $('#scBrush');
  if (br)
    br.addEventListener('input', () => {
      SCN.brush = +br.value;
      $('#scBrushO').textContent = SCN.brush;
    });
  const lf = $('#scLife');
  if (lf)
    lf.addEventListener('change', () => {
      const sc = scCur(),
        L = scLifeParse(lf.value);
      if (L.length) sc.life = L;
      else delete sc.life;
      changed();
      commit(true);
    });
  for (const ta of document.querySelectorAll('[data-scppl]'))
    ta.addEventListener('change', () => {
      const sc = scCur(),
        q = (sc.people || [])[+ta.dataset.scppl];
      if (!q) return;
      q[ta.dataset.f] = ta.value
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);
      changed();
      commit(true);
    });
  const ch = $('#scChat');
  if (ch)
    ch.addEventListener('change', () => {
      const sc = scCur(),
        L = ch.value
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean);
      if (L.length) sc.chat = L;
      else delete sc.chat;
      changed();
      commit(true);
    });
  if (SCN.pe) scPeMount();
}
function scThumbs() {
  const C = scD();
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
      c = cnv(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = k < 1;
    x.drawImage(im, 0, 0, c.width, c.height);
    s.appendChild(c);
  });
}
export function scExitNames(id) {
  const D = ST.D,
    sc = D.scenes[id],
    ex = (sc && sc.exits) || [],
    u = scUsers(id)[0];
  if (!u) return ex.map((e, k) => ({ i: k, name: scExitId(sc, k) || `Exit ${k + 1}` }));
  const i = u[1],
    me = D.route[i],
    hub = mapHub(sc),
    pairs = [],
    out = {},
    E = sc.edgeExits || [];
  /* v42: the join table first: a road that names its exit here keeps it */
  (D.links || []).forEach(l => {
    const o = l[0] === i ? l[1] : l[1] === i ? l[0] : null,
      J = l[3];
    if (o == null || !D.route[o] || !J) return;
    const id = l[0] === i ? J.a : J.b,
      k = id ? E.findIndex(q => q.id === id) : -1;
    if (k >= 0 && !(o in out)) out[o] = k;
  });
  (D.links || []).forEach(l => {
    const o = l[0] === i ? l[1] : l[1] === i ? l[0] : null;
    if (o == null || !D.route[o] || o in out) return;
    const a = Math.atan2((D.route[o].lat || 0) - (me.lat || 0), (D.route[o].lon || 0) - (me.lon || 0));
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
  const L = Object.entries(out).map(([o, k]) => ({ i: k, to: +o, name: D.route[o].name }));
  ex.forEach((e, k) => {
    if (!L.some(x => x.i === k))
      L.push({ i: k, name: `${scExitId(sc, k) || 'Exit ' + (k + 1)} (no road)`, locked: true });
  });
  return L;
}
/* v42: edge-relative exits. scExitSync keeps sc.edgeExits in step with sc.exits after the exits tool moved, added or removed one */
function scExitId(sc, k) {
  const e = sc && sc.edgeExits && sc.edgeExits[k];
  return e ? e.id : null;
}
function scExitName(sc, side) {
  const base = { N: 'north', S: 'south', E: 'east', W: 'west' }[side] || 'exit',
    used = new Set((sc.edgeExits || []).map(e => e.id));
  let n = base,
    i = 2;
  while (used.has(n)) n = base + i++;
  return n;
}
function scExitSync(sc, k, removed) {
  const E = sc.edgeExits || (sc.edgeExits = []);
  if (removed != null) {
    E.splice(removed, 1);
    scExitJoinsDrop(sc);
    sc._exk = '';
    return;
  }
  if (k != null) {
    const old = E[k],
      e = exitEdge(sc, sc.exits[k], old);
    if (!e.id || (old && old.side !== e.side && E.some((q, j) => j !== k && q.id === e.id)))
      e.id = scExitName(sc, e.side);
    E[k] = e;
  } else
    sc.exits.forEach((p, j) => {
      const e = exitEdge(sc, p, E[j]);
      if (!e.id) e.id = scExitName(sc, e.side);
      E[j] = e;
    });
  sc._exk = sc.w + 'x' + sc.h + '/' + E.length;
}
function scExitJoinsDrop(sc) {
  const D = ST.D,
    ids = new Set((sc.edgeExits || []).map(e => e.id)),
    users = scUsers(scId()).map(([, i]) => i);
  (D.links || []).forEach(l => {
    const J = l[3];
    if (!J) return;
    if (users.includes(l[0]) && J.a && !ids.has(J.a)) delete J.a;
    if (users.includes(l[1]) && J.b && !ids.has(J.b)) delete J.b;
    if (!J.a && !J.b) l.length = 3;
  });
}
function scPreview() {
  const cv = $('#scPv'),
    id0 = scId();
  if (!cv || !id0) return;
  walkView.pl.t = -1;
  if (SCN.pvId !== id0) {
    SCN.pvId = id0;
    SCN.pvPos = null;
  }
  /* alpha 0.4: the place with its neighbours joined at its edges, as the game shows it (saved edits; Refresh after changing the edges) */
  let id = id0,
    off = [0, 0];
  if (SCN.joined && typeof wrHubScene === 'function') {
    try {
      const u = scUsers(id0)[0],
        h = u && wrHubScene(u[1]);
      if (h && h.id) {
        id = h.id;
        off = h.baseOff || [0, 0];
      }
    } catch (e) {}
  }
  const enc = () =>
    SCN.enc
      ? [
          { id: 'pv1', lvl: 5 },
          { id: 'pv2', lvl: 7 },
          { id: 'pv3', lvl: 4 },
        ]
      : [];
  dioMount(cv, id, {
    state: () => {
      const sc = scCur();
      if (SCN.pv === 'path' || !sc)
        return {
          t: SCN.t,
          who: 'boy',
          enc: enc(),
          npcs: SCN.npc ? [{ who: 'gini', id: 'pv', done: false, t: Math.min(0.95, SCN.t + 0.12), dz: 1.6 }] : [],
        };
      return {
        mode: 'roam',
        roam: true,
        pos:
          SCN.pvPos ||
          (() => {
            const h = mapHub(sc);
            return [h[0] + off[0], h[1] + off[1]];
          })(),
        who: 'boy',
        enc: enc(),
        npcs: SCN.npc ? [{ who: 'gini', id: 'pv', done: false }] : [],
        exits: scExitNames(id),
      };
    },
    onMove: (x, z) => {
      SCN.pvPos = [x, z];
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
    cap: () => (ST.sec === 'scenes' ? 30 : 0),
  }).then(() => {
    const l = $('#scPvLoad');
    if (l) l.hidden = true;
  });
}
ACTS.scPv = d => {
  SCN.pv = d.m;
  walkView.pl.fresh = true;
  walkView.pl.pk = '';
  render();
};
ACTS.scPvHub = () => {
  SCN.pvPos = null;
  walkView.pl.fresh = true;
  walkView.pl.route = null;
};
/* ---------- map ---------- */
export function scMapDraw() {
  const cv = $('#scMap'),
    sc = scCur();
  if (!cv || !sc) return;
  const Z = SCN.zoom,
    C = scD(),
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
    const strong = SCN.tool === 'height';
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const h = dioHRaw(sc, i + 0.5, H - j - 0.5);
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
          const a = Math.floor(dioHRaw(sc, i + 0.5, H - j - 0.5)),
            b = Math.floor(dioHRaw(sc, i + 1.5, H - j - 0.5)),
            c = Math.floor(dioHRaw(sc, i + 0.5, H - j + 0.5));
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
  scDrawSteps(x, sc, Z);
  const order = sc.props.map((p, i) => [p, i]).sort((a, b) => b[0].z - a[0].z);
  SCN.boxes = [];
  for (const [p, i] of order) {
    const M = C.props[p.k],
      im = M && artImage(M.img);
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
    if (p.f) x.scale(-1, 1);
    x.imageSmoothingEnabled = k < 1;
    if (M.flat) {
      x.scale(1, 0.6);
    }
    x.drawImage(im, M.ox * k, M.oy * k, w, h);
    x.restore();
    const bx = p.f ? px + M.ox * k * -1 - w : px + M.ox * k;
    SCN.boxes.push({
      i,
      x0: Math.min(bx, bx + w),
      x1: Math.max(bx, bx + w),
      y0: py + M.oy * k * (M.flat ? 0.6 : 1),
      y1: py + 4,
    });
    x.fillStyle = 'rgba(30,26,52,.5)';
    x.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  if (SCN.sel != null && sc.props[SCN.sel]) {
    const b = SCN.boxes.find(b => b.i === SCN.sel);
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
      x.arc(a * Z, (H - b) * Z, SCN.tool === 'path' ? 7 : 4, 0, 7);
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
  if (sc.hub || SCN.tool === 'exits') {
    const hb = mapHub(sc),
      HX = hb[0] * Z,
      HY = (H - hb[1]) * Z,
      big = SCN.tool === 'exits';
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
  scDrawWaters(x, sc, Z);
  if (typeof scxDraw === 'function') scxDraw(x, sc, Z);
  const zEl = $('#scZ');
  if (zEl) zEl.textContent = Z + 'px';
}
function scPos(ev) {
  const cv = $('#scMap'),
    r = cv.getBoundingClientRect(),
    sc = scCur(),
    mx = ((ev.clientX - r.left) / r.width) * cv.width,
    my = ((ev.clientY - r.top) / r.height) * cv.height;
  return {
    mx,
    my,
    x: mx / SCN.zoom,
    z: sc.h - my / SCN.zoom,
    i: Math.floor(mx / SCN.zoom),
    j: Math.floor(my / SCN.zoom),
  };
}
export function scSetTile(sc, i, j, ch) {
  if (i < 0 || j < 0 || i >= sc.w || j >= sc.h) return false;
  const row = sc.tiles[j] || ''.padEnd(sc.w, sc.edge);
  if (row[i] === ch) return false;
  sc.tiles[j] = row.slice(0, i) + ch + row.slice(i + 1);
  return true;
}
export function scPropAt(m) {
  const L = SCN.boxes || [];
  for (let k = L.length - 1; k >= 0; k--) {
    const b = L[k];
    if (m.mx >= b.x0 && m.mx <= b.x1 && m.my >= b.y0 && m.my <= b.y1) return b.i;
  }
  return null;
}
function scBindMap() {
  const cv = $('#scMap');
  if (!cv || cv._b) return;
  cv._b = 1;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const paint = m => {
    const sc = scCur(),
      r = SCN.brush - 1;
    let any = false;
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++) {
        if (a * a + b * b > r * r + r) continue;
        any = scSetTile(sc, m.i + a, m.j + b, SCN.ter) || any;
      }
    if (any) {
      walkView.gkey = '';
      scMapDraw();
    }
  };
  cv.addEventListener('pointerdown', ev => {
    const sc = scCur(),
      m = scPos(ev);
    cv.setPointerCapture(ev.pointerId);
    if (typeof scxDown === 'function' && scxDown(sc, m, ev)) return;
    if (SCN.tool === 'paint' || SCN.tool === 'fill') {
      if (ev.altKey) {
        const ch = (sc.tiles[m.j] || '')[m.i];
        if (ch) {
          SCN.ter = ch;
          $$('.sc-ter').forEach(b => b.classList.toggle('on', b.dataset.c === ch));
        }
        return;
      }
      if (SCN.tool === 'fill') {
        scFlood(sc, m.i, m.j, SCN.ter);
        walkView.gkey = '';
        scMapDraw();
        changed();
        commit(true);
        return;
      }
      SCN.drag = { k: 'paint' };
      paint(m);
      return;
    }
    if (SCN.tool === 'height') {
      SCN.hflat = dioHRaw(sc, m.x, m.z);
      SCN.drag = { k: 'height' };
      scHeightAt(sc, m);
      return;
    }
    if (SCN.tool === 'steps') {
      scStepsDown(sc, m, ev);
      return;
    }
    if (SCN.tool === 'water') {
      const R = sc.waters || [],
        n = scWaterAt(sc, m);
      if (n >= 0 && (ev.button === 2 || ev.altKey || SCN.wk === 'erase')) {
        R.splice(n, 1);
        if (!R.length) delete sc.waters;
        scWaterChanged();
        return;
      }
      if (SCN.wk === 'erase') return;
      SCN.drag = { k: 'wrect', a: [m.x, m.z], b: [m.x, m.z] };
      return;
    }
    if (SCN.tool === 'exits') {
      const hb = mapHub(sc),
        E = sc.exits || (sc.exits = []),
        hit = k => Math.hypot(k[0] * SCN.zoom - m.mx, (sc.h - k[1]) * SCN.zoom - m.my) < 11;
      if (hit(hb)) {
        SCN.drag = { k: 'hub' };
        return;
      }
      const n = E.findIndex(hit);
      if (n >= 0 && (ev.button === 2 || ev.altKey)) {
        E.splice(n, 1);
        scExitSync(sc, null, n);
        scMapDraw();
        changed();
        commit(true);
        return;
      }
      if (n >= 0) {
        SCN.drag = { k: 'exit', n };
        return;
      }
      E.push([+m.x.toFixed(2), +m.z.toFixed(2)]);
      scExitSync(sc, E.length - 1);
      SCN.drag = { k: 'exit', n: E.length - 1 };
      scMapDraw();
      return;
    }
    if (SCN.tool === 'path') {
      const P =
        sc.path ||
        (sc.path = [
          [1, sc.h / 2],
          [sc.w - 1, sc.h / 2],
        ]);
      const near = P.findIndex(([a, b]) => Math.hypot(a * SCN.zoom - m.mx, (sc.h - b) * SCN.zoom - m.my) < 10);
      if (near >= 0 && (ev.button === 2 || ev.altKey)) {
        if (P.length > 2) {
          P.splice(near, 1);
          walkView.cand = null;
          walkView.nav = null;
          scMapDraw();
          changed();
          commit(true);
        }
        return;
      }
      if (near >= 0) {
        SCN.drag = { k: 'pt', n: near };
        return;
      }
      let best = -1,
        bd = 1e9;
      for (let k = 0; k < P.length - 1; k++) {
        const d = segDist(m.x, m.z, P[k], P[k + 1]);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (bd * SCN.zoom < 12) {
        P.splice(best + 1, 0, [+m.x.toFixed(2), +m.z.toFixed(2)]);
        SCN.drag = { k: 'pt', n: best + 1 };
        scMapDraw();
      }
      return;
    }
    const hit = scPropAt(m);
    if (SCN.tool === 'erase') {
      if (hit != null) {
        sc.props.splice(hit, 1);
        SCN.sel = null;
        scMapDraw();
        changed();
        commit(true);
      }
      return;
    }
    if (SCN.tool === 'props') {
      if (hit != null) {
        SCN.sel = hit;
        const p = sc.props[hit];
        SCN.drag = { k: 'prop', dx: p.x - m.x, dz: p.z - m.z };
        render();
        return;
      }
      if (!SCN.prop) {
        toast('Pick a prop from the Props card first.');
        return;
      }
      {
        const q = { k: SCN.prop, x: +m.x.toFixed(2), z: +m.z.toFixed(2) },
          M0 = scD().props[SCN.prop] || {};
        if (M0.act) {
          q.act = M0.act;
          if (M0.name) q.label = M0.name;
        }
        sc.props.push(q);
      }
      SCN.sel = sc.props.length - 1;
      walkView.cand = null;
      walkView.nav = null;
      changed();
      commit(true);
      render();
    }
  });
  cv.addEventListener('pointermove', ev => {
    const D = SCN.drag,
      sc = scCur(),
      m = scPos(ev);
    if (typeof scxMove === 'function' && scxMove(sc, m, D, ev)) return;
    if (!D) {
      if (SCN.road || SCN.tool === 'scatter') scMapDraw();
      return;
    }
    if (D.k === 'paint') paint(m);
    else if (D.k === 'height') scHeightAt(sc, m);
    else if (D.k === 'steps') {
      scStepsPaint(sc, m, D);
      scMapDraw();
    } else if (D.k === 'stairs' || D.k === 'bridge' || D.k === 'wrect') {
      D.b = [m.x, m.z];
      scMapDraw();
    } else if (D.k === 'hub' || D.k === 'exit') {
      const q = +clamp(m.x, 0.3, sc.w - 0.3).toFixed(2),
        r = +clamp(m.z, 0.3, sc.h - 0.3).toFixed(2);
      if (D.k === 'hub') sc.hub = [q, r];
      else {
        sc.exits[D.n] = [q, r];
        scExitSync(sc, D.n);
      }
      D.moved = 1;
      walkView.cand = null;
      walkView.nav = null;
      scMapDraw();
    } else if (D.k === 'pt') {
      const q = clamp(m.x, 0, sc.w),
        r = clamp(m.z, 0, sc.h);
      sc.path[D.n] = [+q.toFixed(2), +r.toFixed(2)];
      D.moved = 1;
      walkView.cand = null;
      walkView.nav = null;
      scMapDraw();
    } else if (D.k === 'prop') {
      const p = sc.props[SCN.sel];
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
      scMapDraw();
    }
  });
  const up = () => {
    const D = SCN.drag;
    SCN.drag = null;
    if (!D) return;
    if (typeof scxUp === 'function' && scxUp(scCur(), D)) return;
    if (D.k === 'steps' || D.k === 'stairs' || D.k === 'bridge') {
      scStepsUp(scCur(), D);
      return;
    }
    if (D.k === 'wrect') {
      scWaterUp(scCur(), D);
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
      SCN.zoom = clamp(SCN.zoom + (ev.deltaY < 0 ? 2 : -2), 8, 48);
      scMapDraw();
    },
    { passive: false }
  );
}
function scHGrid(sc) {
  if (!sc.heights || sc.heights.length !== sc.h + 1)
    sc.heights = Array.from({ length: sc.h + 1 }, (_, r) =>
      Array.from({ length: sc.w + 1 }, (_, i) => (sc.heights && sc.heights[r] && +sc.heights[r][i]) || 0)
    );
  return sc.heights;
}
function scHeightAt(sc, m) {
  const H = scHGrid(sc),
    R = Math.max(1, SCN.brush * 0.9),
    k = SCN.hstr * 0.35;
  for (let r = 0; r <= sc.h; r++)
    for (let i = 0; i <= sc.w; i++) {
      const z = sc.h - r,
        d = Math.hypot(i - m.x, z - m.z);
      if (d > R) continue;
      const w = (1 - d / R) ** 2,
        v = H[r][i];
      let n = v;
      if (SCN.hmode === 'raise') n = v + k * w;
      else if (SCN.hmode === 'lower') n = v - k * w;
      else if (SCN.hmode === 'flatten') n = v + (SCN.hflat - v) * Math.min(1, w * k * 4);
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
      H[r][i] = Math.round(clamp(n, -8, 12) * 100) / 100;
    }
  sc._hv = (sc._hv || 0) + 1;
  /* alpha 0.2: the game's smoothed land (dioHGrid) is made again */ walkView.nav = null;
  walkView.cand = null;
  walkView.nav = null;
  clearTimeout(SCN.hT);
  SCN.hT = setTimeout(() => {
    if (typeof walkRenderer !== 'undefined') walkRenderer.hkey = '';
  }, 120);
  scMapDraw();
}
ACTS.scHMode = d => {
  SCN.hmode = d.m;
  render();
};
ACTS.scHFlat = async () => {
  const sc = scCur();
  if (!(await ask('Make the whole scene flat?', 'Flatten'))) return;
  delete sc.heights;
  walkView.nav = null;
  if (typeof walkRenderer !== 'undefined') walkRenderer.hkey = '';
  changed();
  commit(true);
  render();
};
function segDist(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = dx * dx + dz * dz || 1,
    t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L, 0, 1);
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}
function scFlood(sc, i, j, ch) {
  const from = (sc.tiles[j] || '')[i];
  if (from == null || from === ch) return;
  const st = [[i, j]];
  let n = 0;
  while (st.length && n < 5000) {
    const [a, b] = st.pop();
    if ((sc.tiles[b] || '')[a] !== from) continue;
    scSetTile(sc, a, b, ch);
    n++;
    st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
}
document.addEventListener('keydown', ev => {
  if (
    (typeof VP !== 'undefined' && VP.hover) ||
    ST.sec !== 'scenes' ||
    ev.target.closest('input,select,textarea') ||
    $('#modal').innerHTML ||
    $('#dlg').innerHTML ||
    ev.ctrlKey ||
    ev.metaKey
  )
    return;
  const sc = scCur();
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
    SCN.tool = T;
    render();
    return;
  }
  if (SCN.sel == null || !sc.props[SCN.sel]) return;
  const p = sc.props[SCN.sel],
    s = ev.shiftKey ? 1 : 0.25;
  if (k === 'Delete' || k === 'Backspace') {
    ev.preventDefault();
    sc.props.splice(SCN.sel, 1);
    SCN.sel = null;
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
    scMapDraw();
  }
});
/* field edits for the current scene update the map and preview */
ST.hooks.scenes = path => {
  if (SCN.ped && typeof pedDraw === 'function') pedDraw();
  if (path.startsWith('scenes.') || path.startsWith('scenery.')) {
    walkView.nav = null;
    walkView.cand = null;
    if (/\.(edge|w|h)$/.test(path) || path.startsWith('scenery.terrains')) walkView.gkey = '';
    scMapDraw();
    if (path.startsWith('scenery.terrains')) scThumbs();
  }
};
/* ---------- actions ---------- */
ACTS.scPick = d => {
  ST.sel.scene = d.k;
  SCN.sel = null;
  render();
};
ACTS.scKindF = d => {
  SCN.kindF = d.k || '';
  render();
};
ACTS.scTool = d => {
  SCN.tool = d.t;
  render();
};
/* v26: preview the scene at another hour, in other weather or season (environment.js); nothing is saved */
function scEnvApply() {
  if (typeof ENV === 'undefined') return;
  const e = SCN.env || {},
    f = {};
  if (e.time != null && e.time !== '') f.time = +e.time;
  if (e.weather) f.weather = e.weather;
  if (e.season) f.season = e.season;
  ENV.force = Object.keys(f).length ? Object.assign({ time: 13, weather: 'clear', now: 1 }, f) : null;
}
ACTS.scEnv = () => {
  SCN.env = { time: $('#scEnvT').value, weather: $('#scEnvW').value, season: $('#scEnvS').value };
  scEnvApply();
};
ACTS.scTer = d => {
  SCN.ter = d.c;
  SCN.tool = SCN.tool === 'fill' ? 'fill' : 'paint';
  render();
};
ACTS.scProp = d => {
  SCN.prop = d.k;
  if (SCN.tool !== 'props') SCN.tool = 'props';
  render();
};
ACTS.scTag = d => {
  SCN.tag = d.t;
  render();
};
ACTS.scZoom = d => {
  SCN.zoom = clamp(SCN.zoom + +d.z, 8, 48);
  scMapDraw();
};
ACTS.scDupProp = () => {
  const sc = scCur(),
    p = sc.props[SCN.sel];
  if (!p) return;
  sc.props.push({ ...p, x: +(p.x + 1).toFixed(2) });
  SCN.sel = sc.props.length - 1;
  changed();
  commit(true);
  render();
};
ACTS.scOwnRoom = () => {
  const D = ST.D,
    id = scId(),
    sc = scCur(),
    p = sc.props[SCN.sel];
  if (!p) return;
  const kr =
    {
      bakery: 'int_bakery',
      inn: 'int_inn',
      bank: 'int_bank',
      library: 'int_library',
      school: 'int_school',
      station: 'int_station',
      fire_station: 'int_fire_station',
      mansion: 'int_mansion',
      barn: 'int_barn',
      greenhouse: 'int_greenhouse',
      ski_lodge: 'int_ski_lodge',
      market_hall: 'int_market_hall',
    }[p.k] ||
    { shop: 'int_shop', clinic: 'int_clinic', lab: 'int_lab', home: 'int_home' }[p.act] ||
    'int_house';
  const from = D.scenes[p.room] || D.scenes[kr];
  if (!from) return;
  const k = uidKey('int_' + id + '_' + p.k, x => !!D.scenes[x]);
  D.scenes[k] = { ...clone(from), name: (from.name || k) + ' (' + (sc.name || id) + ')', place: id, vary: 0 };
  p.room = k;
  if (!p.act) p.act = 'house';
  changed();
  commit(true);
  ST.sel.scene = k;
  SCN.sel = null;
  render();
};
ACTS.scVar = d => {
  const sc = scCur(),
    p = sc.props[SCN.sel];
  if (!p) return;
  const v = +d.v | 0;
  if (v) p.v = v;
  else delete p.v;
  changed();
  commit(true);
  render();
};
ACTS.scDelProp = () => {
  const sc = scCur();
  if (SCN.sel == null) return;
  sc.props.splice(SCN.sel, 1);
  SCN.sel = null;
  changed();
  commit(true);
  render();
};
function blankScene(name) {
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
ACTS.scNew = async () => {
  const D = ST.D,
    r = await dialog(
      'New scene',
      `<label class="fld"><span>Name</span><input id="scnName" value="New place"></label><label class="fld"><span>Start from</span><select id="scnFrom"><option value="">A blank grass field</option>${Object.entries(
        D.scenes || {}
      )
        .map(([k, s]) => `<option value="${esc(k)}">A copy of ${esc(s.name || k)}</option>`)
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
  const id = uidKey(r.n, k => !!(D.scenes || {})[k]);
  D.scenes = D.scenes || {};
  D.scenes[id] = r.from ? { ...clone(D.scenes[r.from]), name: r.n } : blankScene(r.n);
  D.scenes[id].kind = r.kind || 'route';
  if (r.kind === 'room') D.scenes[id].building = D.scenes[id].building || 'house';
  ST.sel.scene = id;
  SCN.sel = null;
  changed();
  commit(true);
  render();
  toast('Scene created. Pick it for a stop under World & encounters → Route stops.');
};
ACTS.scDup = () => {
  const D = ST.D,
    id = scId(),
    k = uidKey(id + 'b', x => !!D.scenes[x]);
  D.scenes[k] = { ...clone(D.scenes[id]), name: (D.scenes[id].name || id) + ' (copy)' };
  ST.sel.scene = k;
  changed();
  commit(true);
  render();
};
ACTS.scDel = async () => {
  const D = ST.D,
    id = scId(),
    u = scUsers(id);
  if (u.length)
    return toast(
      `${u.map(([r]) => r.name).join(', ')} still use this scene. Pick another scene for ${u.length > 1 ? 'them' : 'it'} first.`,
      'err'
    );
  if (!(await ask('Delete this scene?', 'Delete'))) return;
  delete D.scenes[id];
  ST.sel.scene = null;
  changed();
  commit(true);
  render();
};
ACTS.scResize = () => {
  const sc = scCur(),
    w = clamp(+$('#scW').value || sc.w, 10, 240),
    h = clamp(+$('#scH').value || sc.h, 8, 200);
  if (w === sc.w && h === sc.h) return;
  const oldE = dioSteps(sc),
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
  if (sc.edgeExits) scExitSync(sc);
  /* cliffs and stairs: the near rows and left columns stay where they are */
  if (oldE) {
    delete sc.steps;
    delete sc.stepm;
    const E = dioStepsNew(sc);
    for (let j = 0; j < Math.min(E.h, oldE.h); j++)
      for (let i = 0; i < Math.min(E.w, oldE.w); i++) {
        E.H[j * E.w + i] = oldE.H[j * oldE.w + i];
        E.M[j * E.w + i] = oldE.M[j * oldE.w + i];
      }
    dioStepsStore(sc, E);
  }
  walkView.gkey = '';
  walkView.nav = null;
  walkView.cand = null;
  changed();
  commit(true);
  render();
  scResizeReport(sc, before);
};
/* v42: after a resize, three checks on every exit: it stands on walkable ground, the hub can reach it, and the exit it is
   joined to on the far side faces this one. Problems are listed; the resize can be undone from the same dialog. */
function scExitChecks(sc) {
  const D = ST.D,
    C = scD(),
    out = [],
    E = sc.edgeExits || [],
    ex = sc.exits || [],
    hub = mapHub(sc),
    users = scUsers(scId()).map(([, i]) => i),
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
        path = dioFind(hub[0], hub[1], p[0], p[1]);
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
    (D.links || []).forEach(l => {
      const J = l[3];
      if (!J) return;
      const here = users.includes(l[0]) && J.a === e.id ? 'a' : users.includes(l[1]) && J.b === e.id ? 'b' : null;
      if (!here) return;
      const o = here === 'a' ? l[1] : l[0],
        osc = D.scenes[(D.route[o] || {}).scene],
        oid = here === 'a' ? J.b : J.a,
        oe = osc && (osc.edgeExits || []).find(q => q.id === oid);
      if (!oe) out.push({ ok: 0, t: `${nm}: the road to ${D.route[o].name} names no exit on that side` });
      else
        out.push(
          oe.side === opp[e.side]
            ? { ok: 1, t: `${nm}: faces ${D.route[o].name}'s ${oe.id}, a straight road` }
            : {
                ok: 1,
                t: `${nm} (${e.side}) meets ${D.route[o].name}'s ${oe.id} (${oe.side}): the road bends to join them`,
              }
        );
    });
  });
  return out;
}
async function scResizeReport(sc, before) {
  const r = scExitChecks(sc),
    bad = r.filter(x => !x.ok).length;
  const html = `<p class="help">${sc.w} × ${sc.h} m. ${bad ? `${bad} thing${bad > 1 ? 's' : ''} to look at:` : 'Every exit checks out.'}</p><ul class="exit-chk">${r.map(x => `<li class="${x.ok ? 'ok' : 'bad'}">${x.ok ? '✓' : '!'} ${esc(x.t)}</li>`).join('')}</ul>`;
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
const SC_TER_KEYS =
  'qyzhjvuaeiQYZHJVUAEIbcdfgklmnoprstwxBCDFGKLMNOPRSTWX0123456789$()-./?@[]^{|}' +
  String.fromCharCode(
    ...Array.from({ length: 0x180 - 0xc0 }, (_, i) => 0xc0 + i).filter(c => c !== 0xd7 && c !== 0xf7)
  );
const scTerKeyOk = k => k.length === 1 && SC_TER_KEYS.includes(k);
ACTS.scNewTer = async () => {
  const C = scD(),
    used = Object.keys(C.terrains).join('');
  const r = await dialog(
    'New ground type',
    `<div class="grid"><label class="fld"><span>Name</span><input id="ntName" value="Moss"></label><label class="fld"><span>Key (one character; a free one is filled in)</span><input id="ntKey" maxlength="1" value="${SC_TER_KEYS.split('').find(c => !used.includes(c)) || ''}"></label>
 <label class="fld"><span>Start from</span><select id="ntFrom">${Object.entries(C.terrains)
   .map(([c, t]) => `<option value="${esc(c)}">${esc(t.name)}</option>`)
   .join('')}</select></label></div>`,
    [
      { l: 'Cancel', v: false },
      {
        l: 'Create',
        c: 'primary',
        f: () => {
          const k = $('#ntKey').value;
          if (!k || used.includes(k) || !scTerKeyOk(k)) {
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
    file = uidKey(r.n, f => Object.values(C.terrains).some(t => t.tile === `scene/tiles/${f}.png`)),
    path = `scene/tiles/${file}.png`;
  const src = await atlasGet('art/' + base.tile).catch(() => null),
    c = cnv(16, 16);
  if (src) c.getContext('2d').drawImage(src, 0, 0);
  markArt('art/' + path, c);
  C.terrains[r.k] = { name: r.n, tile: path, z: base.z, edge: base.edge };
  SCN.ter = r.k;
  changed();
  commit(true);
  render();
  scOpenPe('art/' + path, { kind: 'tile', c: r.k });
};
ACTS.scEditTile = d => scOpenPe('art/' + scD().terrains[d.c].tile, { kind: 'tile', c: d.c });
ACTS.scEditProp = d => {
  const M = scD().props[d.k];
  if (M) scOpenPe('art/' + M.img, { kind: 'prop', k: d.k });
};
ACTS.scNewProp = async () => {
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
  const c = cnv(r.w, r.h),
    x = c.getContext('2d');
  x.fillStyle = '#B8A8E0';
  x.fillRect(Math.round(r.w * 0.2), Math.round(r.h * 0.1), Math.round(r.w * 0.6), Math.round(r.h * 0.9));
  scAddProp(r.n, c);
};
ACTS.scImportProp = async () => {
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f);
  if (c.width > 400 || c.height > 400) return toast('Keep props under 400×400 pixels.', 'err');
  scAddProp(f.name.replace(/\.png$/i, ''), c);
};
function scAddProp(name, c) {
  const C = scD(),
    k = uidKey(name, x => !!C.props[x]),
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
  SCN.prop = k;
  changed();
  commit(true);
  render();
  scOpenPe('art/' + path, { kind: 'prop', k });
}
/* ---------- a small pixel editor for props and ground tiles ---------- */
export async function scOpenPe(path, o) {
  const c = await atlasGet(path).catch(() => null);
  if (!c) return toast('Could not open ' + path, 'err');
  SCN.pe = { path, ...o };
  SCN.peUndo = [];
  SCN.peZoom = o.kind === 'tile' ? 16 : clamp(Math.floor(420 / Math.max(c.width, c.height)), 2, 16);
  render();
  setTimeout(() => {
    const e = $('#scPe');
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
}
function scPixelCard() {
  const pe = SCN.pe,
    C = scD(),
    M = pe.kind === 'prop' ? C.props[pe.k] : null,
    base = pe.kind === 'prop' ? `scenery.props.${pe.k}` : '';
  return card(
    pe.kind === 'prop'
      ? `Prop: ${esc(M ? M.name : pe.k)}`
      : `Ground tile: ${esc((C.terrains[pe.c] || {}).name || pe.c)}`,
    `<div class="sc-pe" id="scPe"><div class="sc-pe-bar"><span class="px-tools">${[
      ['pen', 'Pencil'],
      ['erase', 'Eraser'],
      ['fill', 'Fill'],
      ['pick', 'Pick color'],
    ]
      .concat(pe.kind === 'prop' && pe.layer == null ? [['anchor', 'Set the base point']] : [])
      .map(
        ([k, n]) =>
          `<button class="seg ${SCN.peTool === k ? 'on' : ''}" data-act="scPeTool" data-t="${k}">${n}</button>`
      )
      .join('')}</span>
  <span class="colw"><input type="color" id="scPeColor" value="${SCN.peColor}"></span><span class="px-tools"><button class="seg" data-act="scPeZoom" data-z="-1">−</button><button class="seg" data-act="scPeZoom" data-z="1">+</button><button class="seg" data-act="scPeUndo" title="Undo">↶</button></span>
  ${pe.kind === 'prop' && pe.layer == null ? '<button class="btn sm" data-act="scPeResize">Resize…</button><button class="btn sm" data-act="scPeReplace">Replace from PNG…</button>' : ''}<span class="grow"></span><button class="btn sm primary" data-act="scPeClose">Done</button></div>
  <div class="sc-pe-body"><div class="sc-pe-stage"><canvas id="scPeCv"></canvas></div><div class="sc-pe-side"><div class="px-pal" id="scPePal"></div>
  ${
    M
      ? grid(
          fText('Name', `${base}.name`),
          fNum('Shadow size (m)', `${base}.shadow`, { min: 0, max: 4, step: 0.05 }),
          fRange('Sways in the wind', `${base}.sway`, { min: 0, max: 1, step: 0.05 }),
          fChk('Lies flat on the ground', `${base}.flat`, { num: 1 }),
          fText('Tags', `${base}.tagsTxt`, {
            opt: 1,
            ph: (M.tags || []).join(', '),
            help: 'Comma-separated, for the Props filter.',
          })
        ) +
        `<p class="help">Base point: ${-M.ox}, ${-M.oy}. Pick “Set the base point” and click where the prop touches the ground.</p>${M.glow ? '' : '<button class="btn sm subtle" data-act="scGlowAdd">Add a light glow</button>'}${M.glow ? grid(fColor('Glow color', `${base}.glow.c`), fNum('Glow size (m)', `${base}.glow.r`, { step: 0.1, min: 0.2, max: 6 }), fNum('Glow height (m)', `${base}.glow.y`, { step: 0.1, min: 0, max: 8 })) : ''}`
      : '<p class="help">The tile repeats in every direction, so keep the edges matching.</p>'
  }</div></div></div>`
  );
}
function scPeMount() {
  const cv = $('#scPeCv');
  if (!cv) return;
  scPeDraw();
  scPePalette();
  const col = $('#scPeColor');
  col.addEventListener('input', () => (SCN.peColor = col.value.toUpperCase()));
  const tg = $('[data-p$=".tagsTxt"]');
  if (tg)
    tg.addEventListener('change', () => {
      const M = scD().props[SCN.pe.k];
      M.tags = tg.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      delete M.tagsTxt;
      changed();
      commit(true);
    });
  let down = false;
  const pos = ev => {
    const r = cv.getBoundingClientRect(),
      c = atlasNow(SCN.pe.path),
      Z = SCN.peZoom,
      m = (v, n) => ((v % n) + n) % n,
      x = Math.floor((((ev.clientX - r.left) / r.width) * cv.width) / Z),
      y = Math.floor((((ev.clientY - r.top) / r.height) * cv.height) / Z);
    return SCN.pe.kind === 'tile' ? [m(x, c.width), m(y, c.height)] : [x, y];
  };
  cv.addEventListener('pointerdown', ev => {
    const [x, y] = pos(ev),
      c = atlasNow(SCN.pe.path),
      X = c.getContext('2d');
    if (SCN.peTool === 'pick') {
      const d = X.getImageData(x, y, 1, 1).data;
      if (d[3]) {
        SCN.peColor =
          '#' +
          [d[0], d[1], d[2]]
            .map(v => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
        $('#scPeColor').value = SCN.peColor;
      }
      return;
    }
    if (SCN.peTool === 'anchor') {
      const M = scD().props[SCN.pe.k];
      M.ox = -x;
      M.oy = -y;
      changed();
      commit(true);
      render();
      return;
    }
    SCN.peUndo.push(X.getImageData(0, 0, c.width, c.height));
    if (SCN.peUndo.length > 40) SCN.peUndo.shift();
    if (SCN.peTool === 'fill') {
      scPeFill(c, x, y);
      scPeDone();
      return;
    }
    down = true;
    cv.setPointerCapture(ev.pointerId);
    scPePlot(x, y);
  });
  cv.addEventListener('pointermove', ev => {
    if (!down) return;
    const [x, y] = pos(ev);
    scPePlot(x, y);
  });
  const up = () => {
    if (down) {
      down = false;
      scPeDone();
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}
function scPePlot(x, y) {
  const c = atlasNow(SCN.pe.path),
    X = c.getContext('2d');
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  if (SCN.peTool === 'erase') X.clearRect(x, y, 1, 1);
  else {
    X.fillStyle = SCN.peColor;
    X.fillRect(x, y, 1, 1);
  }
  scPeDraw();
}
function scPeFill(c, x, y) {
  const X = c.getContext('2d'),
    im = X.getImageData(0, 0, c.width, c.height),
    d = new Uint32Array(im.data.buffer),
    W = c.width,
    H = c.height,
    t = d[y * W + x],
    n = parseInt(SCN.peColor.slice(1), 16),
    col = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
  if (t === col) return;
  const st = [[x, y]];
  while (st.length) {
    const [a, b] = st.pop();
    if (a < 0 || b < 0 || a >= W || b >= H || d[b * W + a] !== t) continue;
    d[b * W + a] = col;
    st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
  X.putImageData(im, 0, 0);
  scPeDraw();
}
function scPeDone() {
  const c = atlasNow(SCN.pe.path);
  markArt(SCN.pe.path, c);
  if (SCN.ped && typeof pedDraw === 'function') pedDraw();
  if (SCN.pe.kind === 'tile') walkView.gkey = '';
  scThumbs();
  scMapDraw();
  scPePalette();
}
function scPeDraw() {
  const cv = $('#scPeCv'),
    c = atlasNow(SCN.pe && SCN.pe.path);
  if (!cv || !c) return;
  const Z = SCN.peZoom,
    rep = SCN.pe.kind === 'tile' ? 3 : 1;
  cv.width = c.width * Z * rep;
  cv.height = c.height * Z * rep;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  for (let a = 0; a < rep; a++)
    for (let b = 0; b < rep; b++) {
      x.globalAlpha = rep > 1 && !(a === 1 && b === 1) ? 0.45 : 1;
      x.drawImage(c, a * c.width * Z, b * c.height * Z, c.width * Z, c.height * Z);
    }
  x.globalAlpha = 1;
  if (Z >= 6) {
    x.strokeStyle = 'rgba(0,0,0,.1)';
    for (let i = 0; i <= c.width * rep; i++) {
      x.beginPath();
      x.moveTo(i * Z + 0.5, 0);
      x.lineTo(i * Z + 0.5, cv.height);
      x.stroke();
    }
    for (let j = 0; j <= c.height * rep; j++) {
      x.beginPath();
      x.moveTo(0, j * Z + 0.5);
      x.lineTo(cv.width, j * Z + 0.5);
      x.stroke();
    }
  }
  if (SCN.pe.kind === 'prop') {
    const M = scD().props[SCN.pe.k];
    if (M) {
      x.strokeStyle = '#C8323C';
      x.lineWidth = 2;
      const ax = -M.ox * Z + Z / 2,
        ay = -M.oy * Z + Z / 2;
      x.beginPath();
      x.moveTo(ax - 8, ay);
      x.lineTo(ax + 8, ay);
      x.moveTo(ax, ay - 8);
      x.lineTo(ax, ay + 8);
      x.stroke();
    }
  }
  /* tile edits are drawn in the middle copy: map clicks there */
  if (rep > 1 && !cv._rep) {
    cv._rep = 1;
  }
}
function scPePalette() {
  const el = $('#scPePal'),
    c = atlasNow(SCN.pe && SCN.pe.path);
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
ACTS.scPeSw = d => {
  SCN.peColor = d.c;
  const c = $('#scPeColor');
  if (c) c.value = d.c;
  if (SCN.peTool === 'pick' || SCN.peTool === 'erase') {
    SCN.peTool = 'pen';
    render();
  }
};
ACTS.scPeTool = d => {
  SCN.peTool = d.t;
  $$('[data-act=scPeTool]').forEach(b => b.classList.toggle('on', b.dataset.t === d.t));
};
ACTS.scPeZoom = d => {
  SCN.peZoom = clamp(SCN.peZoom + +d.z * (SCN.peZoom >= 8 ? 2 : 1), 1, 32);
  scPeDraw();
};
ACTS.scPeUndo = () => {
  const c = atlasNow(SCN.pe.path),
    u = SCN.peUndo.pop();
  if (!u) return toast('Nothing to undo in this picture.');
  c.getContext('2d').putImageData(u, 0, 0);
  scPeDone();
  scPeDraw();
};
ACTS.scPeClose = () => {
  SCN.pe = null;
  render();
};
ACTS.scGlowAdd = () => {
  scD().props[SCN.pe.k].glow = { c: '#FFD27A', r: 1.4, y: 1.6 };
  changed();
  commit(true);
  render();
};
ACTS.scPeResize = async () => {
  const c = atlasNow(SCN.pe.path),
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
  const n = cnv(r.w, r.h),
    dx = Math.round((r.w - c.width) / 2),
    dy = r.h - c.height;
  n.getContext('2d').drawImage(c, dx, dy);
  const M = scD().props[SCN.pe.k];
  M.ox -= dx;
  M.oy -= dy;
  markArt(SCN.pe.path, n);
  changed();
  commit(true);
  render();
};
ACTS.scPeReplace = async () => {
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f),
    M = scD().props[SCN.pe.k];
  markArt(SCN.pe.path, c);
  M.ox = -Math.floor(c.width / 2);
  M.oy = -(c.height - 1);
  changed();
  commit(true);
  render();
};

/* v17: the scene's life as text and back */
function scLifeText(sc) {
  return (sc.life || [])
    .map(
      L =>
        `${L.k} ${L.n || 1}` +
        (L.area ? ` at ${L.area.join(' ')}` : '') +
        (L.path ? ` along ${L.path.map(p => p.join(' ')).join(', ')}` : '')
    )
    .join('\n');
}
function scLifeParse(t) {
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
function scStepsBar() {
  const mats = (typeof DGL_WALL_MATS !== 'undefined' ? DGL_WALL_MATS : ['Scene rock'])
    .map(
      (n, i) =>
        `<option value="${i}" ${SCN.smat === i ? 'selected' : ''}>${i ? esc(n) : 'The scene’s own rock'}</option>`
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
      ([k, n]) => `<button class="seg ${SCN.smode === k ? 'on' : ''}" data-act="scSMode" data-m="${k}">${n}</button>`
    )
    .join('');
  const opt =
    SCN.smode === 'cliff'
      ? `<label class="mp-size"><span>Height (m)</span><input type="number" id="scSH" step=".25" min="-6" max="10" value="${SCN.sh}" class="sm-num"></label><label class="mp-size"><span>Face</span><select id="scSMat">${mats}</select></label>`
      : SCN.smode === 'stairs'
        ? `<label class="mp-size"><span>Steps</span><select id="scSMat">${mats}</select></label>`
        : SCN.smode === 'bridge'
          ? `<label class="mp-size"><span>Kind</span><select id="scBK">${[
              ['wood', 'Wooden'],
              ['stone', 'Stone arch'],
              ['rope', 'Rope'],
              ['pier', 'Jetty (flat, over water, from the bank out)'],
            ]
              .map(([k, n]) => `<option value="${k}" ${SCN.bkind === k ? 'selected' : ''}>${n}</option>`)
              .join(
                ''
              )}</select></label><label class="mp-size"><span>Width (m)</span><input type="number" id="scBW" step=".1" min=".8" max="5" value="${SCN.bw}" class="sm-num"></label>`
          : '';
  return `<div class="sc-hbar">${modes}${opt}<label class="fld chk"><input type="checkbox" id="scWalkOv" ${SCN.walkOv ? 'checked' : ''}><span>Can I walk there?</span></label></div>`;
}
ACTS.scSMode = d => {
  SCN.smode = d.m;
  render();
};
document.addEventListener('change', ev => {
  const t = ev.target;
  if (!t || !t.id) return;
  if (t.id === 'scSH') SCN.sh = clamp(+t.value || 0, -6, 10);
  else if (t.id === 'scSMat') SCN.smat = +t.value || 0;
  else if (t.id === 'scBK') SCN.bkind = t.value;
  else if (t.id === 'scBW') SCN.bw = clamp(+t.value || 1.6, 0.8, 5);
  else if (t.id === 'scWalkOv') {
    SCN.walkOv = t.checked;
    scMapDraw();
  }
});
function scStepsWork(sc) {
  if (SCN.stE) return SCN.stE;
  const E = dioSteps(sc);
  SCN.stE = E ? { w: E.w, h: E.h, H: new Float32Array(E.H), M: new Uint8Array(E.M) } : dioStepsNew(sc);
  return SCN.stE;
}
function scStepsDown(sc, m, ev) {
  const E = scStepsWork(sc),
    ci = clamp(Math.floor(m.x * 2), 0, E.w - 1),
    cj = clamp(Math.floor(m.z * 2), 0, E.h - 1);
  if (SCN.smode === 'cliff' && ev.shiftKey) {
    SCN.sh = Math.round(E.H[cj * E.w + ci] * 4) / 4;
    SCN.stE = null;
    const i = $('#scSH');
    if (i) i.value = SCN.sh;
    return;
  }
  if (SCN.smode === 'bridge') {
    if (ev.altKey || ev.button === 2) {
      const L = sc.bridges || [],
        k = L.findIndex(b => segDist(m.x, m.z, b.a, b.b) < (b.w || 1.6) / 2 + 0.3);
      SCN.stE = null;
      if (k >= 0) {
        L.splice(k, 1);
        if (!L.length) delete sc.bridges;
        walkView.nav = null;
        changed();
        commit(true);
        scMapDraw();
      }
      return;
    }
    SCN.stE = null;
    SCN.drag = { k: 'bridge', a: [m.x, m.z], b: [m.x, m.z] };
    return;
  }
  if (SCN.smode === 'stairs' || SCN.smode === 'ramp') {
    SCN.drag = { k: 'stairs', ramp: SCN.smode === 'ramp', a: [m.x, m.z], b: [m.x, m.z] };
    return;
  }
  SCN.drag = { k: 'steps', alt: ev.altKey || ev.button === 2 };
  scStepsPaint(sc, m, SCN.drag);
  scMapDraw();
}
function scStepsPaint(sc, m, D) {
  const E = scStepsWork(sc),
    r = Math.max(0.3, SCN.brush * 0.5);
  for (let j = Math.floor((m.z - r) * 2); j <= Math.ceil((m.z + r) * 2); j++)
    for (let i = Math.floor((m.x - r) * 2); i <= Math.ceil((m.x + r) * 2); i++) {
      if (i < 0 || j < 0 || i >= E.w || j >= E.h) continue;
      if (Math.hypot((i + 0.5) / 2 - m.x, (j + 0.5) / 2 - m.z) > r) continue;
      const q = j * E.w + i;
      if (SCN.smode === 'cliff') {
        E.H[q] = SCN.sh;
        E.M[q] = (E.M[q] & 16) | (SCN.smat & 15);
      } else if (SCN.smode === 'erase') {
        E.H[q] = 0;
        E.M[q] = 0;
      } else if (SCN.smode === 'ledge') {
        E.M[q] = D.alt ? E.M[q] & 15 : E.M[q] | 16;
      }
    }
}
function scStepsUp(sc, D) {
  if (D.k === 'bridge') {
    SCN.stE = null;
    const L = Math.hypot(D.b[0] - D.a[0], D.b[1] - D.a[1]);
    if (L >= 0.8) {
      (sc.bridges || (sc.bridges = [])).push(
        Object.assign(
          {
            a: [+D.a[0].toFixed(2), +D.a[1].toFixed(2)],
            b: [+D.b[0].toFixed(2), +D.b[1].toFixed(2)],
            w: SCN.bw,
            kind: SCN.bkind === 'pier' ? 'wood' : SCN.bkind,
          },
          SCN.bkind === 'pier' ? { pier: 1 } : {}
        )
      );
      walkView.nav = null;
      changed();
      commit(true);
    }
    scMapDraw();
    return;
  }
  const E = SCN.stE || scStepsWork(sc);
  if (D.k === 'stairs') {
    /* a straight flight along the longer direction of the drag, from the ground at its start to the ground at its end */
    const ax = Math.abs(D.b[0] - D.a[0]) >= Math.abs(D.b[1] - D.a[1]) ? 'x' : 'z',
      a0 = ax === 'x' ? Math.floor(D.a[0] * 2) : Math.floor(D.a[1] * 2),
      a1 = ax === 'x' ? Math.floor(D.b[0] * 2) : Math.floor(D.b[1] * 2),
      sg = a1 >= a0 ? 1 : -1,
      n = Math.abs(a1 - a0) - 1;
    const across = ax === 'x' ? D.a[1] : D.a[0],
      nw = SCN.brush + 1,
      b0 = Math.floor(across * 2 - nw / 2 + 0.5);
    const cell = (a, b) => (ax === 'x' ? [a, b] : [b, a]),
      tot = (a, b) => {
        const [i, j] = cell(a, b),
          q = clamp(j, 0, E.h - 1) * E.w + clamp(i, 0, E.w - 1);
        return dioHRaw(sc, (i + 0.5) / 2, (j + 0.5) / 2) + E.H[q];
      };
    if (n < 1) {
      toast('Drag further: from the low ground, across the slope, to the high ground.');
      SCN.stE = null;
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
        E.H[q] = Math.round((y - dioHRaw(sc, (i + 0.5) / 2, (j + 0.5) / 2)) * 20) / 20;
        E.M[q] = D.ramp ? (E.M[q] & 15) | 32 : SCN.smat || 8;
      }
    }
    /* v23: a ramp is a smooth slope (flag 32): no risers, the ground leans from one end to the other */
    if (rise > DIO_RISE)
      toast(
        D.ramp
          ? `The ramp climbs ${Math.round(rise * 200)} cm per metre, too steep to walk up. Make it longer.`
          : `Each step rises ${Math.round(rise * 100)} cm, too tall to walk up. Make the flight longer.`
      );
  }
  dioStepsStore(sc, E);
  SCN.stE = null;
  walkView.nav = null;
  walkView.cand = null;
  changed();
  commit(true);
  scMapDraw();
}
function scDrawSteps(x, sc, Z) {
  const E = SCN.stE || dioSteps(sc),
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
          x.strokeStyle = d > DIO_RISE ? 'rgba(40,24,12,.9)' : 'rgba(40,24,12,.35)';
          x.lineWidth = d > DIO_RISE ? 2 : 1;
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
  const D = SCN.drag;
  if (D && (D.k === 'stairs' || D.k === 'bridge')) {
    x.setLineDash([6, 4]);
    line(D.a, D.b, D.k === 'bridge' ? SCN.bw * Z : (SCN.brush + 1) * hz, 'rgba(200,50,60,.5)');
    x.setLineDash([]);
  }
  /* where you can walk: red where you can't, gold arrows where you can hop down */
  if (SCN.walkOv && SCN.tool === 'steps' && walkView.sc === sc && !SCN.stE) {
    const G = dioNav(),
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
          if (!dioPass(G, q, n) && !dioPass(G, n, q)) {
            x.fillStyle = 'rgba(200,40,50,.25)';
            x.fillRect(X + k * 0.3, Y + k * 0.3, k * 0.4, k * 0.4);
          }
        }
      }
  }
}

/* ---------- v22: kinds of water, painted as rectangles over the water ---------- */
const SC_WK = [
  ['pond', 'Pond', '#4FA6C0'],
  ['stream', 'Stream', '#7FD0E6'],
  ['canal', 'Canal', '#5E8C84'],
  ['spring', 'Spring', '#3FD6D0'],
  ['swamp', 'Swamp', '#6B7A34'],
  ['lake', 'Lake', '#2E6FB0'],
];
function scWaterBar(p) {
  const sc = scCur();
  SCN.wk = SCN.wk || 'pond';
  return `<div class="sc-hbar">${SC_WK.map(([k, n, c]) => `<button class="seg ${SCN.wk === k ? 'on' : ''}" data-act="scWK" data-k="${k}"><span class="sc-swatch" style="background:${c}"></span>${n}</button>`).join('')}<button class="seg ${SCN.wk === 'erase' ? 'on' : ''}" data-act="scWK" data-k="erase">Remove</button>
 <label class="mp-size"><span>The rest of the water</span><select id="scWDef">${[['', 'Guess (caves: spring, towns: canal, else pond)'], ...SC_WK.filter(w => w[0] !== 'stream').map(([k, n]) => [k, n])].map(([k, n]) => `<option value="${k}" ${(sc.waterKind || '') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
 ${(sc.waters || []).length ? `<button class="btn sm subtle" data-act="scWClear">Remove all ${(sc.waters || []).length}</button>` : ''}</div>`;
}
ACTS.scWK = d => {
  SCN.wk = d.k;
  render();
};
ACTS.scWClear = async () => {
  const sc = scCur();
  if (!(await ask('Remove every water rectangle in this scene?', 'Remove'))) return;
  delete sc.waters;
  scWaterChanged();
  render();
};
document.addEventListener('change', ev => {
  if (ev.target.id !== 'scWDef') return;
  const sc = scCur();
  if (!sc) return;
  if (ev.target.value) sc.waterKind = ev.target.value;
  else delete sc.waterKind;
  scWaterChanged();
});
function scWaterAt(sc, m) {
  const R = sc.waters || [];
  for (let i = R.length - 1; i >= 0; i--) {
    const r = R[i];
    if (m.x >= r.x && m.z >= r.z && m.x < r.x + r.w && m.z < r.z + r.h) return i;
  }
  return -1;
}
function scWaterChanged() {
  if (typeof walkRenderer !== 'undefined') walkRenderer.hkey = '';
  changed();
  commit(true);
  scMapDraw();
}
function scWaterUp(sc, D) {
  const snap = v => Math.round(v * 2) / 2,
    x0 = snap(Math.min(D.a[0], D.b[0])),
    x1 = snap(Math.max(D.a[0], D.b[0])),
    z0 = snap(Math.min(D.a[1], D.b[1])),
    z1 = snap(Math.max(D.a[1], D.b[1]));
  if (x1 - x0 < 0.5 || z1 - z0 < 0.5) {
    scMapDraw();
    return;
  }
  (sc.waters || (sc.waters = [])).push({ x: x0, z: z0, w: x1 - x0, h: z1 - z0, k: SCN.wk || 'pond' });
  scWaterChanged();
}
function scDrawWaters(x, sc, Z) {
  const on = SCN.tool === 'water',
    H = sc.h,
    R = sc.waters || [];
  if (!R.length && !on) return;
  const col = k => (SC_WK.find(w => w[0] === k) || SC_WK[0])[2];
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
      const t = (SC_WK.find(w => w[0] === r.k) || [0, r.k])[1];
      x.strokeText(t, X + 4, Y + 3);
      x.fillText(t, X + 4, Y + 3);
    }
  });
  const D = SCN.drag;
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
  if (ev.target && ev.target.dataset && ev.target.dataset.actChange === 'scEnv') ACTS.scEnv();
});
ACTS.scTestRun = () => {
  const id = scId();
  if (!id) return;
  window.open(`../game/index.html?test=1&scene=${encodeURIComponent(id)}`, '_blank');
  toast('Opening a test run. Edits here show up there as you make them.');
};

/* alpha 0.4: people who stand in a scene and talk (scene.people) */
ACTS.scPplAdd = () => {
  const sc = scCur(),
    h = sc.hub || [sc.w / 2, sc.h / 2],
    ids = new Set((sc.people || []).map(q => q.id));
  let n = 1;
  while (ids.has('person' + n)) n++;
  (sc.people || (sc.people = [])).push({
    id: 'person' + n,
    who: Object.keys(ST.D.people)[0],
    name: 'Someone',
    x: +(h[0] + 1.5).toFixed(2),
    z: +(h[1] + 1).toFixed(2),
    dir: 'down',
    first: ['Hello there.'],
    lines: ['Nice day for it.'],
  });
  changed();
  commit(true);
  render();
};
ACTS.scPplDel = d => {
  const sc = scCur();
  if (!sc.people) return;
  sc.people.splice(+d.i, 1);
  if (!sc.people.length) delete sc.people;
  changed();
  commit(true);
  render();
};

ACTS.scJoined = () => {
  SCN.joined = !SCN.joined;
  SCN.pvPos = null;
  SCN.pvId = null;
  walkView.pl.fresh = true;
  render();
};
