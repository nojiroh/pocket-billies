'use strict';
/* ================= GENERATE (map generator track MG-1) =================
   Walk scenes → Generate…: a whole route from dials and a seed (game/js/logic/mapgen.js), shown live as a draft in
   the 3D preview and a top-down overview. The draft is not game data: it never reaches D.maps, the undo history,
   Save, the Check or the game tab until "Add as a new scene" makes it a scene (one undo step; Ctrl+S saves it as
   usual). The renderer finds it under the id `_gen` through walkData (a view of D.maps with the draft on top).
   The dials are UI state (data-gen, not data-p, so the Studio's field listener never writes them into the data);
   the scene it makes keeps them in `gen` so a later session can open it again (MG-4).
   MG-2: an exit can join an exit of an existing scene ("Joins…"): the draft's exit turns to face it, a whole number
   of metres along from it and as wide, and the draft takes the neighbour's edge (its heights, step raise and natural
   ground, mapgenEdgeStrip into params.edges); the stats say how well the two meet (mapgenSeamAgreement), and
   "Preview the pair" shows both laid side by side as the game lays them (mapgenPairScene). Also the hub's buildings
   (props dials mast, clinic, shop). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { ART_CACHE } from '../../game/js/art.js';
import { imageReady, setWalkData, walkView } from '../../game/js/walk-view.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  MAPGEN_DEFAULTS,
  MAPGEN_FEATURES,
  MAPGEN_OPPOSITE,
  MAPGEN_SHAPES,
  MAPGEN_SIZES,
  MAPGEN_WATER,
  mapgenEdgeStrip,
  mapgenPairScene,
  mapgenParams,
  mapgenScene,
  mapgenSeamAgreement,
} from '../../game/js/logic/mapgen.js';
import { seamRulesSides } from '../../game/js/logic/seam-rules.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  card,
  changed,
  clone,
  commit,
  dialog,
  render,
  studioState,
  toast,
  uniqueKey,
} from './studio-app.js';
import { atlasGet, loadedAtlas } from './sprites.js';
import { freeCameraLook } from './free-camera.js';
import { sceneryArtPaths, sceneryCatalog } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  GEN_DIALS: [() => GEN_DIALS],
  GEN_DRAFT_ID: [() => GEN_DRAFT_ID],
  GEN_REROLL: [() => GEN_REROLL],
  genAgreeHTML: [() => genAgreeHTML, v => (genAgreeHTML = v)],
  genBaseScenes: [() => genBaseScenes],
  genBasicsHTML: [() => genBasicsHTML, v => (genBasicsHTML = v)],
  genColour: [() => genColour, v => (genColour = v)],
  genDefault: [() => genDefault],
  genDialHTML: [() => genDialHTML, v => (genDialHTML = v)],
  genDialValue: [() => genDialValue],
  genDrawMap: [() => genDrawMap, v => (genDrawMap = v)],
  genExitsHTML: [() => genExitsHTML, v => (genExitsHTML = v)],
  genGet: [() => genGet],
  genGroundColour: [() => genGroundColour],
  genGroupHTML: [() => genGroupHTML, v => (genGroupHTML = v)],
  genInput: [() => genInput, v => (genInput = v)],
  genJoinHTML: [() => genJoinHTML, v => (genJoinHTML = v)],
  genRun: [() => genRun, v => (genRun = v)],
  genScenes: [() => genScenes, v => (genScenes = v)],
  genScenesView: [() => genScenesView, v => (genScenesView = v)],
  genSet: [() => genSet, v => (genSet = v)],
  genShow: [() => genShow, v => (genShow = v)],
  genShowWhich: [() => genShowWhich, v => (genShowWhich = v)],
  genSoon: [() => genSoon, v => (genSoon = v)],
  genStatsHTML: [() => genStatsHTML, v => (genStatsHTML = v)],
  genTimer: [() => genTimer, v => (genTimer = v)],
  genViewHTML: [() => genViewHTML, v => (genViewHTML = v)],
  mapGen: [() => mapGen],
  mountGenView: [() => mountGenView, v => (mountGenView = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const mapGen = {
  on: false,
  params: mapgenParams({}),
  draft: /** @type {any} */ (null),
  notes: /** @type {string[]} */ ([]),
  ms: 0,
  gen: 0,
  pvPos: /** @type {number[] | null} */ (null),
  /** @type {Record<string, boolean>} */
  open: { nature: false, feature: false, props: false },
  /* MG-2: the exits joined to a scene's exit, by exit row: {map, exit} */
  /** @type {Record<number, { map: string, exit: string }>} */
  joins: {},
  /* MG-2: how each joined exit meets its neighbour (genRun), and the pair shown instead of the draft */
  agree: /** @type {any[]} */ ([]),
  pair: false,
  shown: /** @type {any} */ (null),
};
const GEN_DRAFT_ID = '_gen';
/* the renderer reads scenes through walkData: D.maps, with the draft on top while the Generate view is open */
let genScenesView = { maps: null, draft: null, out: null };
function genScenes() {
  const maps = (studioState.D && studioState.D.maps) || {};
  const shown = mapGen.shown || mapGen.draft;
  if (!mapGen.on || !shown) return maps;
  if (genScenesView.maps !== maps || genScenesView.draft !== shown)
    genScenesView = {
      maps,
      draft: shown,
      out: Object.assign(Object.create(maps), { [GEN_DRAFT_ID]: shown }),
    };
  return genScenesView.out;
}
setWalkData(() => ({
  scenes: genScenes(),
  sc: (studioState.D && studioState.D.scenery) || { terrains: {}, props: {} },
}));
/* the dials: [path, label, min, max, step, help] for a slider, or [path, label, 'sel', {value: name}], [.., 'bool'] */
const GEN_DIALS = [
  [
    'land',
    'Land',
    [
      ['land.hills', 'Hilliness', 0, 1, 0.05, 'Flat to rolling hills, up to about 2.5 m'],
      [
        'land.terraces',
        'Terraces',
        0,
        1,
        0.05,
        'None, then one to three steps rising toward the back; the road ramps through them',
      ],
      ['land.cliffs', 'Terrace height', 0, 1, 0.05, 'A low bank (0.4 m) up to a cliff (1.6 m)'],
      ['land.water', 'Water', 'sel', MAPGEN_WATER],
      ['land.waterAmount', 'Water amount', 0, 1, 0.05, 'How wide the stream, how big the pond, how deep the sea'],
    ],
  ],
  [
    'road',
    'Road',
    [
      ['road.exits', 'Entry and exit', 'exits'],
      ['road.shape', 'Shape', 'sel', MAPGEN_SHAPES],
      ['road.wobble', 'Wobble', 0, 1, 0.05, 'How far the shape swings, and small bends along it'],
      ['road.width', 'Width (m)', 1.2, 6, 0.1],
      ['road.surface', 'Surface', 'sel', { dirt: 'Dirt', gravel: 'Gravel', cobbles: 'Cobbles', pavers: 'Pavers' }],
      ['road.verge', 'Verge softness', 0, 1, 0.05, 'A crisp edge, or a ragged worn strip beside the road'],
    ],
  ],
  [
    'nature',
    'Nature',
    [
      ['nature.trees', 'Trees', 0, 1, 0.05, 'Groves and a belt along the edges (open at the exits)'],
      ['nature.growth', 'Wild growth', 0, 1, 0.05, 'Flowers, ground plants, shrubs and rocks by the grow-wild rules'],
      ['nature.tall', 'Tall grass', 0, 1, 0.05, 'Drifts beside the road: where encounters happen'],
      ['nature.clearings', 'Clearings', 0, 1, 0.05, 'Open patches where no tree grows'],
    ],
  ],
  ['feature', 'Feature', [['feature', 'Feature', 'sel', MAPGEN_FEATURES]]],
  [
    'props',
    'Props',
    [
      ['props.signs', 'Signposts at the exits', 'bool'],
      ['props.lamps', 'Lamps', 0, 1, 0.05, 'None, then one every 80 m down to every 20 m'],
      ['props.benches', 'Benches', 0, 1, 0.05],
      ['props.bins', 'Bins by the benches', 0, 1, 0.05],
      ['props.folk', 'Townsfolk spots', 0, 1, 0.05],
      ['props.mast', 'Airship mast at the hub', 'bool'],
      ['props.clinic', 'Clinic at the hub', 'bool'],
      ['props.shop', 'Shop at the hub', 'bool'],
    ],
  ],
];
const GEN_REROLL = [
  ['heights', 'Land and water'],
  ['ground', 'Ground'],
  ['road', 'Road'],
  ['plants', 'Plants'],
  ['feature', 'Feature'],
  ['props', 'Props'],
  ['lots', 'Buildings'],
];
const genGet = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
function genSet(o, path, v) {
  const ks = path.split('.'),
    last = ks.pop();
  let t = o;
  for (const k of ks) t = t[k] == null ? (t[k] = {}) : t[k];
  t[last] = v;
}
const genDefault = path => genGet(MAPGEN_DEFAULTS, path);
const genDialValue = (v, step) => (typeof v === 'number' ? +v.toFixed(step < 0.1 ? 2 : 1) : v);
function genDialHTML(f) {
  const [path, label] = f,
    typ = typeof f[2] === 'string' ? f[2] : 'range',
    v = genGet(mapGen.params, path),
    def = genDefault(path),
    own = JSON.stringify(v) !== JSON.stringify(def);
  const reset = `<button class="eng-reset" data-act="genReset" data-path="${path}" title="Back to ${escapeHtml(String(typ === 'exits' ? 'west and east' : typ === 'sel' ? f[3][def] : genDialValue(def, f[4] || 1)))}">↺</button>`;
  let body = '';
  if (typ === 'range')
    body = `<span class="eng-lab">${escapeHtml(label)} <output data-gen-out="${path}">${genDialValue(v, f[4])}</output></span><input type="range" data-gen="${path}" data-k="num" value="${v}" min="${f[2]}" max="${f[3]}" step="${f[4]}">`;
  else if (typ === 'bool')
    body = `<label class="eng-chk"><input type="checkbox" data-gen="${path}" data-k="bool" ${v ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  else if (typ === 'sel')
    body = `<span class="eng-lab">${escapeHtml(label)}</span><select data-gen="${path}" data-k="sel">${Object.entries(
      f[3]
    )
      .map(([a, n]) => `<option value="${a}" ${v === a ? 'selected' : ''}>${escapeHtml(n)}</option>`)
      .join('')}</select>`;
  else if (typ === 'exits') body = genExitsHTML();
  return `<div class="eng-f ${own ? 'own' : ''}">${body}${reset}${f[5] ? `<small class="help">${escapeHtml(f[5])}</small>` : ''}</div>`;
}
function genExitsHTML() {
  const E = mapGen.params.road.exits;
  return `<span class="eng-lab">Entry and exit (written to edgeExits)</span>${E.map((e, i) => {
    const J = mapGen.joins[i],
      lock = J ? 'disabled' : '';
    return `<div class="gen-exit"><select data-gen="road.exits.${i}.side" data-k="sel" aria-label="Side" ${lock}>${[
      ['N', 'North'],
      ['S', 'South'],
      ['E', 'East'],
      ['W', 'West'],
    ]
      .map(([a, n]) => `<option value="${a}" ${e.side === a ? 'selected' : ''}>${n}</option>`)
      .join(
        ''
      )}</select><input type="range" data-gen="road.exits.${i}.t" data-k="num" min="0.08" max="0.92" step="0.01" value="${e.t}" title="Where along that side" aria-label="Where along the side" ${lock}><input type="number" data-gen="road.exits.${i}.width" data-k="num" min="1" max="6" step="0.5" value="${e.width}" title="Exit width (m); a neighbour's exit must have the same" aria-label="Exit width" ${lock}><button class="eng-x" data-act="genExitDel" data-i="${i}" title="Remove this exit" ${E.length < 2 ? 'disabled' : ''}>×</button></div>
 <div class="gen-exit gen-join">${genJoinHTML(i)}</div>`;
  }).join('')}${E.length < 4 ? '<button class="btn sm subtle" data-act="genExitAdd">+ Add an exit</button>' : ''}`;
}
/* MG-2: an exit row's join: a scene and one of its exits; the draft's exit then faces it and takes its edge */
function genJoinHTML(i) {
  const J = mapGen.joins[i],
    D = studioState.D,
    side = { N: 'north', S: 'south', E: 'east', W: 'west' };
  if (J) {
    const nb = D.maps[J.map];
    return `<small class="help">Joins <b>${escapeHtml((nb && nb.name) || J.map)}</b>'s exit ${escapeHtml(J.exit)}: this exit faces it and takes its edge</small><button class="btn sm subtle" data-act="genUnjoin" data-i="${i}" title="Back to an exit of its own">Unjoin</button>`;
  }
  const groups = Object.entries(D.maps || {})
    .filter(([id, sc]) => id !== GEN_DRAFT_ID && sc && sc.kind !== 'room' && (sc.edgeExits || []).length && sc.tiles)
    .map(
      ([id, sc]) =>
        `<optgroup label="${escapeHtml(sc.name || id)}">${sc.edgeExits.map(e => `<option value="${escapeHtml(id)}|${escapeHtml(e.id)}">${escapeHtml(sc.name || id)} · ${escapeHtml(e.id)} (${side[e.side] || e.side})</option>`).join('')}</optgroup>`
    )
    .join('');
  return `<select data-gen-join="${i}" aria-label="Join this exit to a scene's exit" title="Join this exit to an exit of a scene: it turns to face it and the draft meets that scene's edge"><option value="">Joins… (none)</option>${groups}</select>`;
}
function genGroupHTML([g, title, fields]) {
  const open = mapGen.open[g] !== false,
    set = fields.filter(f => JSON.stringify(genGet(mapGen.params, f[0])) !== JSON.stringify(genDefault(f[0]))).length;
  return `<section class="card eng-g ${open ? 'open' : ''}"><header><button class="eng-gh" data-act="genOpenG" data-g="${g}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${escapeHtml(title)}</h3>${set ? `<span class="badge">${set} set</span>` : ''}</button>${set ? `<button class="btn sm subtle" data-act="genResetG" data-g="${g}">Reset</button>` : ''}</header>
 ${open ? `<div class="card-b eng-fields">${fields.map(genDialHTML).join('')}</div>` : ''}</section>`;
}
function genBasicsHTML() {
  const P = mapGen.params,
    B = studioState.D.biomes || {};
  return `<section class="card eng-g open"><header><h3 style="padding:6px">Basics</h3></header><div class="card-b eng-fields">
 <div class="eng-f"><span class="eng-lab">Kind</span><div class="seg-row"><button class="seg on">Route</button><button class="seg" disabled title="Towns come in the next session of the map generator track (MG-3)">Town</button></div></div>
 <div class="eng-f ${P.biome !== MAPGEN_DEFAULTS.biome ? 'own' : ''}"><span class="eng-lab">Biome</span><select data-gen="biome" data-k="sel">${Object.entries(
   B
 )
   .map(([k, b]) => `<option value="${k}" ${P.biome === k ? 'selected' : ''}>${escapeHtml(b.name || k)}</option>`)
   .join(
     ''
   )}</select><button class="eng-reset" data-act="genReset" data-path="biome" title="Back to ${escapeHtml((B[MAPGEN_DEFAULTS.biome] || {}).name || '')}">↺</button><small class="help">Sets the ground, the plants, the water kind, the sky and the animals (game/data/biomes.json)</small></div>
 <div class="eng-f"><span class="eng-lab">Size (m)</span><div class="seg-row">${Object.entries(MAPGEN_SIZES)
   .map(
     ([k, s]) =>
       `<button class="seg ${P.w === s.w && P.h === s.h ? 'on' : ''}" data-act="genSize" data-k="${k}">${escapeHtml(s.name)} ${s.w}×${s.h}</button>`
   )
   .join(
     ''
   )}</div><div class="gen-wh"><input type="number" data-gen="w" data-k="num" min="24" max="200" step="1" value="${P.w}" aria-label="Width (m)"> × <input type="number" data-gen="h" data-k="num" min="24" max="200" step="1" value="${P.h}" aria-label="Depth (m)"></div></div>
 <div class="eng-f"><span class="eng-lab">Seed</span><div class="gen-wh"><input type="number" data-gen="seed" data-k="num" min="0" step="1" value="${P.seed}" aria-label="Seed"><button class="btn sm" data-act="genSeed" title="A new seed for everything">🎲 New seed</button></div>
 <div class="gen-reroll"><small class="help">New seed for one part only:</small>${GEN_REROLL.map(
   ([st, n]) =>
     `<button class="btn sm subtle ${P.seeds && P.seeds[st] != null ? 'on' : ''}" data-act="genReroll" data-st="${st}" title="${P.seeds && P.seeds[st] != null ? 'Its own seed ' + P.seeds[st] + ' (Alt-click: back to the main seed)' : 'Uses the main seed'}">🎲 ${escapeHtml(n)}</button>`
 ).join('')}</div></div></div></section>`;
}
function genStatsHTML() {
  const d = mapGen.draft;
  if (!d) return '<p class="help">Generating…</p>';
  const plants = d.props.filter(p => p.w).length,
    tall = (d.tiles.join('').match(/t/g) || []).length;
  return `<p class="help">${d.w} × ${d.h} m · ${d.props.length} props (${plants} wild plants) · ${tall} m² of tall grass · ${(d.bridges || []).length} bridges · made in ${Math.round(mapGen.ms)} ms</p>
 <p class="help">Exits: ${d.edgeExits.map(e => `<b>${escapeHtml(e.id)}</b> (${e.side}, ${e.len} m from the hub)`).join(', ')}</p>
 ${genAgreeHTML(d)}
 ${mapGen.notes.length ? `<p class="help warn">${mapGen.notes.map(escapeHtml).join('; ')}</p>` : ''}`;
}
/* MG-2: how each joined exit meets its neighbour, the exits against the data's rules, the hub's buildings */
function genAgreeHTML(d) {
  const out = mapGen.agree.map(g => {
    const nb = studioState.D.maps[g.map],
      name = escapeHtml((nb && nb.name) || g.map),
      a = g.a;
    if (!a) return `<p class="help warn">The joined exit didn't come out (four exits at most).</p>`;
    const ok = a.dhBand <= 0.05 && Math.abs(a.raiseExit) <= 0.05 && !a.walk;
    return `<p class="help ${ok ? '' : 'warn'}"><b>${escapeHtml(g.id)}</b> meets ${name}'s ${escapeHtml(g.exit)}: heights ${a.dhBand.toFixed(2)} m apart along the band (${a.dhNear.toFixed(2)} m by the exit), step ${a.raiseExit.toFixed(2)} m${a.raiseBand ? ` (up to ${a.raiseBand.toFixed(2)} m along it: ${name}'s edge is up on a shelf; the game ramps up to it)` : ''}, ${a.walk ? `the walk across: ${escapeHtml(a.walk)}` : 'a straight walk across'}</p>`;
  });
  const rules = seamRulesSides(d);
  if (rules.length) out.push(`<p class="help warn">As a place's map: ${rules.map(escapeHtml).join('; ')}</p>`);
  const built = d.props
    .filter(p => ['clinic', 'shop', 'airship_station'].includes(p.k))
    .map(p => p.k.replace('airship_station', 'airship mast'));
  if (built.length) out.push(`<p class="help">At the hub: ${built.join(', ')}</p>`);
  return out.join('');
}
function genViewHTML() {
  return `<div class="split sc-split gen-split"><aside class="list-col gen-dials"><div class="list-head"><button class="btn subtle" data-act="genClose">← Back to the scenes</button></div><div class="llist">${genBasicsHTML()}${GEN_DIALS.map(genGroupHTML).join('')}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">draft, not saved</small><h2>Generate a route</h2></div><div class="seg-row"><button class="btn primary" data-act="genAccept" title="Adds it to the Walk scenes as a new scene (one undo step); Ctrl+S saves it">Add as a new scene</button></div></div>
 ${card(
   'Preview',
   `<div class="sc-pv"><canvas id="genPv"></canvas><div class="sc-pv-load" id="genPvLoad">Loading…</div></div>
  <div class="seg-row"><button class="btn sm subtle" data-act="genHub">Back to the hub</button>${Object.keys(mapGen.joins).length ? `<button class="btn sm ${mapGen.pair ? 'on' : 'subtle'}" data-act="genPair" title="Both scenes side by side, as the game lays them, nothing eased">${mapGen.pair ? 'Show the draft alone' : 'Preview the pair'}</button>` : ''}</div><div id="genStats">${genStatsHTML()}</div>`,
   {
     sub: 'The draft as the game draws it. Walk with W A S D or click the ground; the dials change it as you move them.',
   }
 )}
 ${card('From above', '<canvas id="genMap" class="gen-map"></canvas>', { sub: 'Click to walk there in the preview. Red: the road from the hub to each exit.' })}
 </div></div>`;
}
/* the Walk scenes section shows the Generate view instead of the editor while it is open */
const genBaseScenes = SECTIONS.scenes;
SECTIONS.scenes = () => {
  if (!mapGen.on) return genBaseScenes();
  afterRender(mountGenView);
  return genViewHTML();
};
async function mountGenView() {
  const C = sceneryCatalog();
  await Promise.all(sceneryArtPaths(C).map(p => atlasGet('art/' + p).catch(() => null)));
  if (!mapGen.draft) genRun();
  else genShow();
}
function genRun() {
  const D = studioState.D,
    P = mapGen.params,
    edges = [],
    joined = [];
  /* MG-2: each joined exit faces its neighbour's exit and takes its edge; the locked dials follow */
  for (const [i, J] of Object.entries(mapGen.joins)) {
    const e = P.road.exits[+i],
      nb = D.maps[J.map],
      strip = e && nb ? mapgenEdgeStrip(nb, J.exit, { w: P.w, h: P.h }, e.t) : null;
    if (!strip) continue;
    strip.from.map = J.map;
    Object.assign(e, { side: strip.side, t: strip.t, width: strip.width });
    edges.push(strip);
    joined.push({ ...J, strip });
  }
  const t = performance.now(),
    r = mapgenScene({ ...P, edges }, { scenery: sceneryCatalog(), biomes: D.biomes || {} });
  mapGen.ms = performance.now() - t;
  mapGen.notes = r.notes;
  const d = r.scene;
  /* a new draft is new ground (groundKey reads stepsV) */
  d.stepsV = ++mapGen.gen;
  if (mapGen.draft && (mapGen.draft.w !== d.w || mapGen.draft.h !== d.h)) mapGen.pvPos = null;
  mapGen.draft = d;
  mapGen.agree = joined.map(J => {
    const e = d.edgeExits.find(q => q.side === J.strip.side && Math.abs(q.t - J.strip.t) < 1e-3);
    return {
      map: J.map,
      exit: J.exit,
      id: e ? e.id : '',
      a: e ? mapgenSeamAgreement(D.maps[J.map], J.exit, d, e.id, D.scenery) : null,
    };
  });
  genShowWhich();
  genShow();
}
/* the draft, or the draft and its first neighbour side by side */
function genShowWhich() {
  const g = mapGen.agree.find(q => q.a),
    d = mapGen.draft;
  mapGen.shown = mapGen.pair && g && d ? mapgenPairScene(studioState.D.maps[g.map], g.exit, d, g.id) : null;
  if (mapGen.shown) mapGen.shown.stepsV = ++mapGen.gen;
}
function genShow() {
  const d = mapGen.draft,
    cv = $('#genPv');
  const st = $('#genStats');
  if (st) st.innerHTML = genStatsHTML();
  genDrawMap();
  if (!cv || !d) return;
  const S = mapGen.shown || d;
  if (mapGen.pvPos && (mapGen.pvPos[0] > S.w || mapGen.pvPos[1] > S.h)) mapGen.pvPos = null;
  walkView.nav = null;
  walkView.cand = null;
  walkView.gkey = '';
  walkView.pl.fresh = true;
  mountWalkView(cv, GEN_DRAFT_ID, {
    state: () => ({
      mode: 'roam',
      roam: true,
      pos: mapGen.pvPos || ((mapGen.shown || mapGen.draft || {}).hub ?? [0, 0]),
      who: 'boy',
      enc: [],
      npcs: [],
      exits: mapGen.shown
        ? mapGen.shown.exits.map((p, i) => ({ i, name: mapGen.shown.exitNames[i] }))
        : (mapGen.draft ? mapGen.draft.edgeExits : []).map((e, i) => ({ i, name: e.id })),
    }),
    onMove: (x, z) => {
      mapGen.pvPos = [x, z];
    },
    keys: () => false,
    onPick: h =>
      toast(
        h.k === 'exit'
          ? "Here the road leaves for the next place (join it to a scene's exit under Entry and exit)."
          : 'Click the ground to walk there.'
      ),
    cap: () => (studioState.sec === 'scenes' && mapGen.on ? 30 : 0),
    look: freeCameraLook,
  }).then(() => {
    const l = $('#genPvLoad');
    if (l) l.hidden = true;
  });
}
/* the overview: each ground's colour (the average of its tile picture), the props as dots, the roads in red */
const genGroundColour = {};
function genColour(ch) {
  if (genGroundColour[ch]) return genGroundColour[ch];
  const T = sceneryCatalog().terrains[ch],
    im = T && (loadedAtlas('art/' + T.tile) || ART_CACHE.img[T.tile]);
  if (!im || !imageReady(im)) return '#888';
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const x = c.getContext('2d');
  if (!x) return '#888';
  x.drawImage(im, 0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return (genGroundColour[ch] = `rgb(${r},${g},${b})`);
}
function genDrawMap() {
  const cv = /** @type {HTMLCanvasElement|null} */ ($('#genMap')),
    d = mapGen.draft;
  if (!cv || !d) return;
  const k = Math.max(2, Math.min(6, Math.floor((cv.parentElement ? cv.parentElement.clientWidth : 600) / d.w)));
  cv.width = d.w * k;
  cv.height = d.h * k;
  const x = cv.getContext('2d');
  if (!x) return;
  for (let j = 0; j < d.h; j++)
    for (let i = 0; i < d.w; i++) {
      const ch = d.tiles[j][i],
        z = d.h - 1 - j + 0.5,
        lava =
          (ch === 'w' || ch === 'd') &&
          (d.waters || []).some(r => r.k === 'lava' && i >= r.x && z >= r.z && i < r.x + r.w && z < r.z + r.h);
      x.fillStyle = lava ? '#e2662c' : genColour(ch);
      x.fillRect(i * k, j * k, k, k);
    }
  const C = sceneryCatalog().props;
  for (const p of d.props) {
    const M = C[p.k] || {},
      big = M.family === 'trees' || /^tree_|^palm/.test(p.k);
    const small = !!p.w || !!M.family || /^tallgrass|^bush_|rock|stone|scree/.test(p.k);
    x.fillStyle = big ? 'rgba(20,60,25,.85)' : small ? 'rgba(30,40,20,.45)' : '#ffd84a';
    const r = big ? k * 0.9 : small ? k * 0.3 : k * 0.6;
    x.fillRect(p.x * k - r / 2, (d.h - p.z) * k - r / 2, r, r);
  }
  x.lineWidth = Math.max(1, k / 3);
  x.strokeStyle = '#e0303a';
  for (const e of d.edgeExits) {
    x.beginPath();
    e.path.forEach(([px, pz], i) => (i ? x.lineTo(px * k, (d.h - pz) * k) : x.moveTo(px * k, (d.h - pz) * k)));
    x.stroke();
  }
  x.strokeStyle = '#fff';
  x.beginPath();
  x.arc(d.hub[0] * k, (d.h - d.hub[1]) * k, k * 1.6, 0, Math.PI * 2);
  x.stroke();
  cv.onclick = ev => {
    const R = cv.getBoundingClientRect(),
      px = ((ev.clientX - R.left) / R.width) * d.w,
      pz = d.h - ((ev.clientY - R.top) / R.height) * d.h;
    mapGen.pvPos = [px, pz];
    walkView.pl.fresh = true;
  };
}
/* ---------- dials ---------- */
let genTimer = 0;
function genSoon() {
  clearTimeout(genTimer);
  genTimer = setTimeout(genRun, 180);
}
function genInput(ev, settle) {
  const t = /** @type {HTMLInputElement} */ (ev.target);
  if (!t || !t.dataset || !t.dataset.gen) return;
  const path = t.dataset.gen,
    k = t.dataset.k;
  let v = k === 'bool' ? (t.checked ? 1 : 0) : k === 'num' ? parseFloat(t.value) : t.value;
  if (k === 'num' && !Number.isFinite(v)) return;
  genSet(mapGen.params, path, v);
  if (path === 'w' || path === 'h' || path === 'seed') mapGen.params = mapgenParams(mapGen.params);
  const o = document.querySelector(`[data-gen-out="${path}"]`);
  if (o) o.textContent = String(genDialValue(v, +(t.step || 1)));
  const f = t.closest('.eng-f');
  if (f && !path.startsWith('road.exits'))
    f.classList.toggle('own', JSON.stringify(genGet(mapGen.params, path)) !== JSON.stringify(genDefault(path)));
  if (settle && (k === 'sel' || path === 'w' || path === 'h')) render();
  genSoon();
}
document.addEventListener('input', ev => mapGen.on && genInput(ev, false));
document.addEventListener('change', ev => mapGen.on && genInput(ev, true));
/* MG-2: an exit row joined to a scene's exit (its side turns to face it; genRun takes the rest) */
document.addEventListener('change', ev => {
  const t = /** @type {HTMLSelectElement} */ (ev.target);
  if (!mapGen.on || !t || !t.dataset || t.dataset.genJoin == null || !t.value) return;
  const i = +t.dataset.genJoin,
    [map, exit] = t.value.split('|'),
    nb = studioState.D.maps[map],
    e = nb && (nb.edgeExits || []).find(q => q.id === exit),
    row = mapGen.params.road.exits[i];
  if (!e || !row) return;
  row.side = MAPGEN_OPPOSITE[e.side];
  mapGen.joins[i] = { map, exit };
  render();
  genRun();
});
/* ---------- actions ---------- */
ACTIONS.genOpen = () => {
  mapGen.on = true;
  mapGen.draft = null;
  mapGen.shown = null;
  mapGen.pvPos = null;
  render();
};
ACTIONS.genClose = () => {
  mapGen.on = false;
  mapGen.draft = null;
  mapGen.shown = null;
  render();
};
ACTIONS.genOpenG = d => {
  mapGen.open[d.g] = mapGen.open[d.g] === false;
  render();
};
ACTIONS.genReset = d => {
  genSet(mapGen.params, d.path, clone(genDefault(d.path)));
  render();
  genRun();
};
ACTIONS.genResetG = d => {
  const G = GEN_DIALS.find(g => g[0] === d.g);
  if (G) for (const f of G[2]) genSet(mapGen.params, f[0], clone(genDefault(f[0])));
  render();
  genRun();
};
ACTIONS.genSize = d => {
  const s = MAPGEN_SIZES[d.k];
  Object.assign(mapGen.params, { w: s.w, h: s.h });
  render();
  genRun();
};
ACTIONS.genSeed = () => {
  mapGen.params.seed = Math.floor(Math.random() * 1e6);
  mapGen.params.seeds = {};
  render();
  genRun();
};
ACTIONS.genReroll = (d, el, ev) => {
  const S = mapGen.params.seeds || (mapGen.params.seeds = {});
  if (ev && ev.altKey) delete S[d.st];
  else S[d.st] = Math.floor(Math.random() * 1e6);
  render();
  genRun();
};
ACTIONS.genExitAdd = () => {
  const E = mapGen.params.road.exits,
    free = ['N', 'S', 'E', 'W'].find(s => !E.some(e => e.side === s)) || 'S';
  E.push({ side: free, t: 0.5, width: 2 });
  render();
  genRun();
};
ACTIONS.genExitDel = d => {
  mapGen.params.road.exits.splice(+d.i, 1);
  /* the joins move with their rows */
  const J = {};
  for (const [k, v] of Object.entries(mapGen.joins)) if (+k !== +d.i) J[+k > +d.i ? +k - 1 : +k] = v;
  mapGen.joins = J;
  if (!Object.keys(J).length) mapGen.pair = false;
  render();
  genRun();
};
ACTIONS.genUnjoin = d => {
  delete mapGen.joins[+d.i];
  if (!Object.keys(mapGen.joins).length) mapGen.pair = false;
  render();
  genRun();
};
ACTIONS.genPair = () => {
  mapGen.pair = !mapGen.pair;
  mapGen.pvPos = null;
  genShowWhich();
  render();
};
ACTIONS.genHub = () => {
  mapGen.pvPos = null;
  walkView.pl.fresh = true;
};
/* the draft becomes a scene (no place or roads yet: World & encounters → Route stops, or MG-2's Accept) */
ACTIONS.genAccept = async () => {
  const d = mapGen.draft;
  if (!d) return;
  const D = studioState.D,
    name = await dialog(
      'Add as a new scene',
      `<label class="fld"><span>Name</span><input id="genName" value="${escapeHtml(d.name)}"></label><p class="help">It becomes a walk scene of its own (kind ${escapeHtml(d.kind)}, biome ${escapeHtml(d.biome)}), with its dials kept in it${mapGen.agree.length ? ` and the edge of the scene it joins (${mapGen.agree.map(g => escapeHtml(g.map + ' ' + g.exit)).join(', ')})` : ''}. No place or roads yet.</p>`,
      [
        { l: 'Cancel', v: null },
        { l: 'Add', c: 'primary', f: () => $('#genName').value.trim() },
      ]
    );
  if (name == null) return;
  const id = uniqueKey(name, k => !!D.maps[k]),
    sc = clone(d);
  delete sc.stepsV;
  sc.name = name || d.name;
  D.maps[id] = sc;
  studioState.sel.scene = id;
  mapGen.on = false;
  mapGen.draft = null;
  mapGen.shown = null;
  changed();
  commit(true);
  render();
  toast(`Added ${id}. Pick it for a place under World & encounters → Route stops; Ctrl+S saves it.`);
};
