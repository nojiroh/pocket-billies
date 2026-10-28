// Phase 04b: checks the game data files (game/data). Fast (no browser), run by CI on every push.
//   node tools/check-data.mjs          (npm run check:data)
//   node tools/check-data.mjs --fix    also rewrites files that are laid out differently from how the Studio writes them
// - index.json lists exactly the files there are (none missing, none left over),
// - every file is JSON, laid out as game/js/data-files.js writes it (so a Studio save doesn't reformat it),
// - every map, line, trainer and person matches its schema (game/data/schema/*.schema.json), robots.json and story.json
//   their own (story.json's speakers and start presets name real people, places, trainers and Billies),
// - what refers to what exists: moves a line learns, species in pools and teams, a stop's map and wild pool, the
//   ground kinds and props a map uses, the stops of links and trainers, a trainer's look,
// - a map's ground is h rows of w, its heights (h+1) rows of w+1, its island fields sound (island track),
// - TC-3 (was check-quick's Data step): a map's step grid is its size, a room names its building, a place says whether
//   it is a town or a route (as its scene and its town mark do) under its scene's id, a road has a name, and every
//   picture the scenery names exists,
// - phase 07: portraits.json against its schema, and every picture, part and frame it names exists,
// - studio track ST-3: partKits.json against its schema, and every part's picture is there at its size,
// - phase 08b: the links between places (roads.json) join them as the walk needs, and every door opens a room (below),
// - UI-1: uiTheme.json against its schema, and its text reads on its ground and surface (4.5:1, light and dark; UI-3:
//   danger and primary at 3:1, screens' overrides too; UI-11: the colour code's shades and fills on every palette, and
//   each screen's set of colours, the types included, apart),
// - Studio plan T1.3: the Studio's scene and road checks (game/js/logic/data-checks.js); their warnings are printed.
import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, PB_DATA } from './data-files.mjs';
import { musicFindings } from '../game/js/logic/music-studio.js';
import { seamRulesLinks, seamRulesPlaces } from '../game/js/logic/seam-rules.js';
import { islandProblems } from '../game/js/logic/island.js';
import { POSES_BY_PLAN } from '../game/js/body-plan-animation.js';
import { formProblems, lineSpeciesIds } from '../game/js/logic/forms.js';
// CAM-4b: the zoom stops reach data-checks.js through hooks.js (the page's load order), so they are loaded first
import '../game/js/logic/camera-zoom.js';
import {
  dataBattleRules,
  dataBiomes,
  dataCameraStops,
  dataBuildings,
  dataCatchArt,
  dataPerkArt,
  dataCurrencies,
  dataNodeTypes,
  dataRanchRules,
  dataRegions,
  dataFieldMoves,
  dataSetPieces,
  dataArenas,
  dataModifiers,
  dataFactions,
  dataBosses,
  dataHeldItems,
  dataGenes,
  dataQuests,
  dataResidents,
  dataFestivals,
  dataPerks,
  dataEvents,
  dataBanter,
  dataRelations,
  dataShowcase,
  dataRewards,
  dataRoadFindings,
  dataRobotProblems,
  dataRigs,
  dataRobots,
  dataRunClock,
  dataRunLoop,
  dataRunMapRules,
  dataRunPayout,
  dataRunScene,
  dataSceneFindings,
  dataSquareRules,
  dataSpeciesKind,
  dataUiTheme,
  dataUnderscoreKeys,
  dataUnlocks,
} from '../game/js/logic/data-checks.js';

const FIX = process.argv.includes('--fix');
const bad = [];
const problem = (where, what) => bad.push(`${where}: ${what}`);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const SCHEMA = join(DATA, 'schema');
for (const f of readdirSync(SCHEMA)) ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA, f), 'utf8')));
const check = (schema, value, where) => {
  const ok = ajv.validate(schema, value);
  if (!ok) for (const e of ajv.errors.slice(0, 5)) problem(where, `${e.instancePath || '(top)'} ${e.message}`);
  return ok;
};
const ENTRY = {
  maps: 'map.schema.json',
  lines: 'line.schema.json',
  trainers: 'trainer.schema.json',
  people: 'person.schema.json',
  cutscenes: 'cutscene.schema.json',
};

// the files: listed, present, JSON, laid out the Studio's way
const index = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
check('index.schema.json', index, 'index.json');
const listed = new Set(['index.json', ...PB_DATA.files(index).map(f => f.path)]);
const D = {};
let fixed = 0;
const read = (path, ix = 'index.json') => {
  const file = join(DATA, path);
  if (!existsSync(file)) {
    problem(path, `listed in ${ix} but missing`);
    return undefined;
  }
  const text = readFileSync(file, 'utf8');
  let v;
  try {
    v = JSON.parse(text);
  } catch (e) {
    problem(path, 'not JSON: ' + e.message);
    return undefined;
  }
  /* Studio plan T1.6 (F7): the Studio drops keys starting with _ on every save */
  for (const k of dataUnderscoreKeys(v))
    problem(path, `${k}: a key starting with _ is dropped by every Studio save; rename it`);
  if (PB_DATA.text(v) !== text) {
    if (FIX) {
      writeFileSync(file, PB_DATA.text(v));
      fixed++;
    } else problem(path, 'laid out differently from how the Studio writes it (node tools/check-data.mjs --fix)');
  }
  return v;
};
read('index.json');
Object.assign(D, PB_DATA.assemble(index, read));
for (const f of readdirSync(DATA)) if (f.endsWith('.json') && !listed.has(f)) problem(f, 'not listed in index.json');
for (const dir of Object.keys(index.split))
  if (existsSync(join(DATA, dir)))
    for (const f of readdirSync(join(DATA, dir)))
      if (!listed.has(`${dir}/${f}`)) problem(`${dir}/${f}`, 'not listed in index.json');
for (const key of Object.keys(PB_DATA.SPLIT))
  if (index.keys.includes(key) && !index.split[key]) problem('index.json', `${key} should have a file per entry`);

// the entries against their schemas
for (const [section, schema] of Object.entries(ENTRY)) {
  const v = D[section];
  if (!v) {
    problem(section, 'missing');
    continue;
  }
  const entries = Array.isArray(v) ? v.map(e => [e.id, e]) : Object.entries(v);
  for (const [id, e] of entries) if (e) check(schema, e, `${section}/${id}.json`);
}

// RL-5: the parked world, game/data/legacy/index.json (the same layout; the game never loads it, the Studio's Legacy
// section reads it): every file it lists is there, reads and is laid out the Studio's way, nothing unlisted lies
// there, and its maps and trainers still match their schemas, so a map copied back into the game is one the checks
// here can take. What they refer to is not checked: it is the old world's
if (existsSync(join(DATA, 'legacy', 'index.json'))) {
  const at = p => 'legacy/' + p,
    LI = read(at('index.json'), 'legacy') || { keys: [], split: {} };
  check('index.schema.json', LI, 'legacy/index.json');
  const files = PB_DATA.files(LI),
    here = new Set(['index.json', 'README.json', ...files.map(f => f.path)]);
  for (const f of files) {
    const v = read(at(f.path), 'legacy/index.json');
    if (v && f.id !== null && (f.section === 'maps' || f.section === 'trainers'))
      check(ENTRY[f.section], v, at(f.path));
  }
  for (const f of readdirSync(join(DATA, 'legacy')))
    if (f.endsWith('.json') && !here.has(f)) problem(at(f), 'not listed in legacy/index.json');
  for (const dir of Object.keys(LI.split || {}))
    if (existsSync(join(DATA, 'legacy', dir)))
      for (const f of readdirSync(join(DATA, 'legacy', dir)))
        if (!here.has(`${dir}/${f}`)) problem(at(`${dir}/${f}`), 'not listed in legacy/index.json');
}

// test cleanup TC lane C: a map parked in game/data/legacy (the Legacy section copies it back into the game), by id;
// a cutscene may be filmed on one and a kind of building's room may be one, kept for the story or the Studio
const parkedMaps = (() => {
  const file = join(DATA, 'legacy', 'index.json');
  if (!existsSync(file)) return new Map();
  const ids = ((JSON.parse(readFileSync(file, 'utf8')).split || {}).maps || {}).ids || [];
  return new Map(
    ids
      .filter(id => existsSync(join(DATA, 'legacy', 'maps', id + '.json')))
      .map(id => [id, JSON.parse(readFileSync(join(DATA, 'legacy', 'maps', id + '.json'), 'utf8'))])
  );
})();
// cutscenes: the map each is filmed on, the spots its paths join (their scripts: the story checks below)
for (const [id, C] of Object.entries(D.cutscenes || {})) {
  if (!(D.maps || {})[C.map] && !parkedMaps.has(C.map))
    problem(`cutscenes/${id}.json`, `filmed on map ${C.map}, no such map`);
  for (const [a, b] of (C.clear && C.clear.paths) || [])
    for (const s of [a, b])
      if (!C.spots[s]) problem(`cutscenes/${id}.json`, `clear path names spot ${s}, no such spot`);
}

// what refers to what
const S = D.maps || {},
  route = D.locations || [],
  moves = D.moves || {},
  pools = D.pools || {},
  people = D.people || {},
  scenery = D.scenery || { terrains: {}, props: {} };
const species = new Set();
for (const L of D.lines || []) {
  for (const id of lineSpeciesIds(L)) species.add(id);
  // RO-1: regional forms: a coat marked form, swaps between real types, a change to some stage's types
  for (const p of formProblems(
    L,
    D.coats || {},
    (D.types || []).map(t => t.id)
  ))
    problem(`lines/${L.id}.json`, p);
  for (const [lv, m] of L.learn || [])
    if (!moves[m]) problem(`lines/${L.id}.json`, `learns ${m} at ${lv}, no such move`);
  // phase 16: native parts: one per stage, every slot filled with a part the kits have
  if (L.parts) {
    if (L.parts.length !== (L.names || []).length)
      problem(`lines/${L.id}.json`, `${L.parts.length} stages of parts, ${(L.names || []).length} names`);
    const slots = (D.rules && D.rules.parts && D.rules.parts.slots) || [],
      kit = (D.partKits && D.partKits.parts) || {};
    L.parts.forEach((P, i) => {
      for (const s of slots) if (!P[s]) problem(`lines/${L.id}.json`, `stage ${i}: no native part for slot ${s}`);
      for (const [s, id] of Object.entries(P)) {
        if (!slots.includes(s)) problem(`lines/${L.id}.json`, `stage ${i}: ${s} is not a part slot`);
        if (!kit[id]) problem(`lines/${L.id}.json`, `stage ${i}: native ${s} part ${id}, no such kit part`);
      }
    });
  }
}
// phase 16: a species from a line kept in game/data/legacy is fine; the game stands in a new line's Billie for it
// (logic/data-checks.js dataSpeciesKind, the Studio's Check's rule too)
const legacyLines = existsSync(join(DATA, 'legacy', 'lines'))
  ? readdirSync(join(DATA, 'legacy', 'lines'))
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(DATA, 'legacy', 'lines', f), 'utf8')))
  : [];
const speciesKind = dataSpeciesKind(D.lines || [], legacyLines),
  known = sp => !!speciesKind(sp);
for (const [k, P] of Object.entries(pools))
  for (const [sp] of P.list || []) if (!known(sp)) problem('pools.json', `${k} has ${sp}, no such species`);
// RO-3e: a line never met wild (the fossils) is in no biome pool (SA-3: walk eggs are gone): an event gives it
const notWild = new Set((D.lines || []).filter(L => L.wild === false).map(L => L.id)),
  lineOfSp = sp => (D.lines || []).find(L => notWild.has(L.id) && lineSpeciesIds(L).includes(sp));
for (const [k, P] of Object.entries(pools))
  for (const [sp] of P.list || [])
    if (lineOfSp(sp)) problem('pools.json', `${k} has ${sp}, of a line never met wild (wild: false)`);
route.forEach((r, i) => {
  if (r.mapId && !S[r.mapId]) problem('locations.json', `stop ${i} (${r.name}) has map ${r.mapId}, no such map`);
  if (r.pool && !pools[r.pool]) problem('locations.json', `stop ${i} (${r.name}) has pool ${r.pool}, no such pool`);
  // phase 10: a spot on the bowl (a in degrees, r from the floor's centre 0 to the rim 1). The game's places all have
  // one; a spot under another place (bowl.under) was only for the parked Pearlantis
  const B = r.bowl;
  if (!B) problem('locations.json', `stop ${i} (${r.name}) has no bowl spot`);
  else if (!(B.a >= 0 && B.a < 360 && B.r >= 0 && B.r <= 1))
    problem('locations.json', `stop ${i} (${r.name}) has bowl spot a ${B.a}, r ${B.r}: a must be 0-360, r 0-1`);
});
check('roads.schema.json', D.roads || [], 'roads.json');
// phase 08b: the links between places join them as the walk needs (game/js/logic/seam-rules.js, one copy of the
// rules since map generator MG-2: the map generator's tests run them too): a seam's two exits face each other, are as
// wide and meet a whole number of metres apart, the ground at each exit is walkable, every edge exit of a place's
// map is used by exactly one link, a side has at most two exits 44 m apart, a lift has a lift prop at each end
{
  const links = seamRulesLinks({
    roads: D.roads || [],
    roadOf: L => PB_DATA.road(D, L),
    locations: route,
    maps: S,
    terrains: (D.scenery && D.scenery.terrains) || {},
  });
  for (const [where, what] of links.problems) problem(where, what);
  for (const [where, what] of seamRulesPlaces({ locations: route, maps: S, used: links.used })) problem(where, what);
}
// phase 08b: the doors. A kind of building's room is a room; every door on a place (a building or sign that opens a
// shop, the clinic, the lab, a house or your room) leads to a room that exists, has a doorway (its exit 0) at its
// front, and the door lies on the building's front.
{
  const P = scenery.props || {},
    ppu = scenery.ppu || 34,
    isRoom = id => S[id] && S[id].kind === 'room',
    seen = new Set();
  for (const [k, M] of Object.entries(P))
    if (M && M.room && !isRoom(M.room) && (parkedMaps.get(M.room) || {}).kind !== 'room')
      problem('scenery.json', `${k}'s room ${M.room} isn't a room`);
  for (const r of route) {
    const sc = S[r.mapId];
    if (!sc || sc.kind === 'room') continue;
    for (const p of sc.props || []) {
      if (!PB_DATA.opensRoom(p.act)) continue;
      const M = P[p.k],
        at = `maps/${r.mapId}.json`,
        id = PB_DATA.doorRooms(p, M, p.act).find(isRoom),
        R = S[id];
      if (p.room && !isRoom(p.room)) problem(at, `${p.k} at ${p.x}, ${p.z} opens ${p.room}, not a room`);
      if (!R) {
        problem(at, `${p.k} at ${p.x}, ${p.z} opens no room`);
        continue;
      }
      const ex = (R.exits || [])[0];
      if (!seen.has(id) && (!ex || ex[1] > 1.5)) problem(`maps/${id}.json`, 'has no doorway at its front (exit 0)');
      if (!seen.has(p.k) && M && M.box && M.door && Math.abs((M.door.x || 0) / ppu) > M.box[0] / 2)
        problem(
          'scenery.json',
          `${p.k}'s door is off its front (${((M.door.x || 0) / ppu).toFixed(2)} m from the middle)`
        );
      seen.add(id).add(p.k);
    }
  }
}
// Studio plan T1.3: the battle, run, ranch, robot, UI look, biome, node type, relic, currency, building and unlock
// checks are game/js/logic/data-checks.js's (the Studio's Check runs them too), in this order; the schema checks are
// this file's (check), handed in
for (const family of [
  dataBattleRules,
  dataRunPayout,
  dataRanchRules,
  dataSquareRules,
  dataRunMapRules,
  dataRunClock,
  dataRunScene,
  dataRunLoop,
  dataRobots,
  dataUiTheme,
  dataCameraStops,
  dataBiomes,
  dataRegions,
  dataFieldMoves,
  dataSetPieces,
  dataArenas,
  dataModifiers,
  dataFactions,
  dataBosses,
  dataHeldItems,
  dataGenes,
  dataQuests,
  dataResidents,
  dataFestivals,
  dataNodeTypes,
  dataPerks,
  dataEvents,
  dataBanter,
  dataRelations,
  dataShowcase,
  dataRewards,
  dataCurrencies,
  dataBuildings,
  dataUnlocks,
])
  for (const [where, what] of family(D, check)) problem(where, what);
// SND-2: the music: the schema, then every song a where-rule or a place names is a song, and the where table ends in a
// rule that always matches (so something always plays). SND-3: the rules are logic/music-studio.js musicFindings, which
// the Studio's Check shows too (its own way, so it is not one of data-checks.js's families); its warnings (a song nothing
// plays) are the quick check's Unused report here
if (D.music && check('music.schema.json', D.music, 'music.json')) {
  for (const F of musicFindings(D.music, {
    nodeTypes: D.nodeTypes || {},
    biomes: D.biomes || {},
    locations: D.locations || [],
  }))
    if (F.lvl === 'error') problem(F.place ? 'locations.json' : 'music.json', F.msg);
  // SND-3: a species' own cry names a base that exists
  const bases = (D.music.cries || {}).bases || {};
  for (const L of D.lines || [])
    (L.cry || []).forEach((C, st) => {
      if (C && C.base != null && !bases[C.base])
        problem(
          `lines/${L.id}.json`,
          `cry ${st}: no base "${C.base}" (music.json cries.bases has ${Object.keys(bases).join(', ')})`
        );
    });
}
// phase 10: the world map's look: the schema, then the terrain keys it names and the regions it covers
if (D.worldmap && check('worldmap.schema.json', D.worldmap, 'worldmap.json')) {
  const terr = new Set(Object.keys((D.scenery && D.scenery.terrains) || {}));
  const keysOk = (where, s) => {
    for (const ch of s)
      if (!terr.has(ch)) problem('worldmap.json', `${where}: no terrain "${ch}" (scenery.json terrains)`);
  };
  for (const [r, R] of Object.entries(D.worldmap.regions))
    for (const f of ['ground', 'wet', 'dry', 'high']) keysOk(`regions.${r}.${f}`, R[f]);
  for (const [k, s] of Object.entries(D.worldmap.kinds)) keysOk(`kinds.${k}`, s);
  for (const l of D.locations || [])
    if (l.region && !D.worldmap.regions[l.region]) problem('worldmap.json', `no region ${l.region} (place ${l.id})`);
}
// studio track ST-0: coats: the schema, then the palette ramps, Billies and pictures they name
if (D.coats && check('coats.schema.json', D.coats, 'coats.json')) {
  const pal = JSON.parse(
    readFileSync(join(DATA, '..', 'art', 'next', 'palette.js'), 'utf8')
      .replace(/^[^=]*=/, '')
      .replace(/;\s*$/, '')
  );
  const species = new Set((D.lines || []).flatMap(L => lineSpeciesIds(L)));
  for (const [id, C] of Object.entries(D.coats)) {
    for (const [a, b] of Object.entries(C.ramps || {}))
      for (const r of [a, b])
        if (!pal.ramps[r]) problem('coats.json', `coat ${id} swaps ramp ${r}, no such palette ramp`);
    for (const [sp, views] of Object.entries(C.art || {})) {
      if (!species.has(sp)) problem('coats.json', `coat ${id} has art for ${sp}, no such Billie`);
      for (const p of Object.values(views))
        if (!existsSync(join(DATA, '..', 'art', p))) problem('coats.json', `coat ${id}: no picture ${p}`);
    }
  }
}
// RF-2: the catch pyramids' icons and models
for (const [where, what] of dataCatchArt(D.pyramids, p => {
  const f = join(DATA, '..', 'art', p);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}))
  problem(where, what);
// PK-2: the Perks' pictures (an img that is there and is an icon; a Perk without one warns)
for (const f of dataPerkArt(D.perks, p => {
  const f = join(DATA, '..', 'art', p);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}))
  if (f.lvl === 'error') problem(f.where, f.msg);
  else console.log(`  warning: ${f.where}: ${f.msg}`);
// studio track ST-3: the part kits: the schema, then every picture they name is there with the size given
// (ST-4: and the S/L pictures, turn limits that run least to most, slots the socket rules name, the part mirrored)
if (D.partKits && check('partKits.schema.json', D.partKits, 'partKits.json')) {
  const K = D.partKits,
    picture = (id, view, V) => {
      const png = join(DATA, '..', 'art', V.file);
      if (!existsSync(png)) problem('partKits.json', `part ${id} ${view}: no picture ${V.file}`);
      else {
        const b = readFileSync(png);
        if (b.readUInt32BE(16) !== V.w || b.readUInt32BE(20) !== V.h)
          problem(
            'partKits.json',
            `part ${id} ${view}: ${V.file} is ${b.readUInt32BE(16)} x ${b.readUInt32BE(20)}, not ${V.w} x ${V.h}`
          );
      }
      if (!V.file.includes(`/${view}/`))
        problem('partKits.json', `part ${id}: its ${view} picture is in another view's folder`);
    },
    turnOk = (where, t) =>
      t && t[0] > t[1] && problem('partKits.json', `${where}: turn limits ${t[0]} to ${t[1]} run backwards`);
  for (const [k, t] of Object.entries(K.turns || {})) turnOk(`turns.${k}`, t);
  for (const [id, P] of Object.entries(K.parts)) {
    for (const [view, V] of Object.entries(P.views)) {
      picture(id, view, V);
      for (const [size, S] of Object.entries(V.sizes || {})) {
        picture(id, `${view} ${size}`, S);
        if (!S.file.endsWith(`/${id}_${size.toLowerCase()}.png`))
          problem('partKits.json', `part ${id} ${view}: its ${size} picture should be ${id}_${size.toLowerCase()}.png`);
      }
    }
    turnOk(`part ${id}`, P.turn);
    if (P.mirrorOf && !K.parts[P.mirrorOf]) problem('partKits.json', `part ${id} mirrors ${P.mirrorOf}, no such part`);
  }
}
// roster track RO-3a: the body plans and the placeholder Billies: the schema, then every bone's parent and mirror
// there, the plans the animation knows, a form's plan, and no name or rig twice
if (D.bodyPlans && check('bodyPlans.schema.json', D.bodyPlans, 'bodyPlans.json')) {
  const B = D.bodyPlans,
    at = 'bodyPlans.json',
    known = Object.keys(POSES_BY_PLAN),
    bonesOk = (where, bones) => {
      const names = new Set(['root']);
      for (const b of bones) {
        if (names.has(b.n)) problem(at, `${where}: bone ${b.n} twice`);
        const src = b.mirror ? bones.find(x => x.n === b.mirror) : b;
        if (b.mirror && !src) problem(at, `${where}: ${b.n} mirrors ${b.mirror}, which isn't there`);
        else if (!b.mirror && (!b.par || !b.c)) problem(at, `${where}: ${b.n} needs par and c`);
        else if (!b.mirror && !names.has(b.par))
          problem(at, `${where}: ${b.n} hangs on ${b.par}, not a bone before it`);
        names.add(b.n);
      }
    };
  for (const [id, plan] of Object.entries(B.plans)) {
    if (!known.includes(id)) problem(at, `plans.${id}: body-plan-animation.js has no such plan (${known.join(', ')})`);
    bonesOk(`plans.${id}`, plan.bones);
    // RO-3c: splicing maps parts by slot, so every slot has a bone (its own, or one that answers to it as `also`)
    const has = new Set(plan.bones.flatMap(b => [b.slot, b.also]));
    for (const s of (D.rules && D.rules.parts && D.rules.parts.slots) || [])
      if (!has.has(s)) problem(at, `plans.${id}: no bone for the ${s} slot (give one, or \`also\` on another)`);
    for (const b of plan.bones)
      if (b.also && (b.also === b.slot || !b.slot))
        problem(at, `plans.${id}: ${b.n}: also ${b.also} needs a slot of its own, a different one`);
  }
  for (const id of known) if (!B.plans[id]) problem(at, `plans: no ${id} (body-plan-animation.js animates it)`);
  const seen = { name: new Set(), rig: new Set() };
  for (const f of B.forms) {
    if (!B.plans[f.plan]) problem(at, `form ${f.name}: no plan ${f.plan}`);
    else
      bonesOk(
        `form ${f.name}`,
        [...B.plans[f.plan].bones, ...(f.add || [])].filter(b => !(f.drop || []).includes(b.n))
      );
    for (const k of ['name', 'rig']) {
      if (seen[k].has(f[k])) problem(at, `${k} ${f[k]} twice`);
      seen[k].add(f[k]);
    }
    if (f.line && D.lines && !D.lines.some(L => L.id === f.line)) problem(at, `form ${f.name}: no line ${f.line}`);
  }
}
// Studio plan Phase 5 (T5.1): the kit Billies' recipes: the schema, then the parts, colours, anchors, rigs and lines
// they name, one recipe per line stage, and each stage's native parts as the recipe gives them (else: bake again,
// node tools/bake-kit-billies.mjs). Phase 1c moves these into logic/data-checks.js.
if (D.kitBuilds && check('kitBuilds.schema.json', D.kitBuilds, 'kitBuilds.json')) {
  const B = D.kitBuilds,
    kit = (D.partKits && D.partKits.parts) || {},
    slotNames = new Set(((D.rules && D.rules.parts) || {}).slots || []),
    at = 'kitBuilds.json',
    seen = { name: new Set(), rig: new Set(), stage: new Set() },
    lines = {};
  for (const id of Object.keys(B.bake.tailAim)) if (!kit[id]) problem(at, `bake.tailAim: ${id}, no such part`);
  const colourOk = (where, c) =>
    typeof c === 'string' && !B.colours[c] && problem(at, `${where}: colour ${c}, not in colours`);
  for (const f of B.forms) {
    const where = `form ${f.name}`;
    for (const [k, v] of [
      ['name', f.name],
      ['rig', f.rig],
      ['stage', `${f.line} ${f.stage}${f.form ? ' ' + f.form : ''}`],
    ])
      if (seen[k].has(v)) problem(at, `${where}: a second form for ${k} ${v}`);
      else seen[k].add(v);
    const line = (D.lines || []).find(l => l.id === f.line);
    if (!line) problem(at, `${where}: line ${f.line}, no such line`);
    else if (f.stage >= line.names.length)
      problem(at, `${where}: stage ${f.stage}, ${f.line} has ${line.names.length}`);
    else if (!f.form) (lines[f.line] ||= { line, forms: [] }).forms.push(f);
    else if (!(line.forms || []).some(F => F.id === f.form))
      problem(at, `${where}: form ${f.form}, ${f.line} has no such regional form`);
    for (const [kind, [pid, , col]] of Object.entries(f.parts)) {
      if (!kit[pid]) problem(at, `${where} ${kind}: part ${pid}, not in partKits.json`);
      colourOk(`${where} ${kind}`, col);
    }
    (f.extras || []).forEach(([pid, anchor, , col, , slot], i) => {
      if (!kit[pid]) problem(at, `${where} extra ${i + 1}: part ${pid}, not in partKits.json`);
      if (!B.bake.anchors[anchor]) problem(at, `${where} extra ${i + 1}: anchor ${anchor}, not in bake.anchors`);
      colourOk(`${where} extra ${i + 1}`, col);
      if (slot && !slotNames.has(slot))
        problem(at, `${where} extra ${i + 1}: slot ${slot}, not in rules.json parts.slots`);
    });
    for (const [kind, slot] of Object.entries(f.slots || {})) {
      if (!f.parts[kind]) problem(at, `${where}: slots.${kind}, the form has no ${kind}`);
      if (!slotNames.has(slot)) problem(at, `${where}: slots.${kind} is ${slot}, not in rules.json parts.slots`);
    }
  }
  const { kitNativeParts } = await import('../game/js/logic/kit-assemble.js');
  for (const [id, { line, forms }] of Object.entries(lines)) {
    if (forms.length !== line.names.length)
      problem(
        at,
        `line ${id}: recipes for stages ${forms.map(f => f.stage).sort()}, the line has ${line.names.length}`
      );
    for (const f of forms) {
      let want;
      try {
        want = kitNativeParts(f, D.partKits.slots || {}, [...slotNames]);
      } catch (e) {
        problem(at, e.message);
        continue;
      }
      if (JSON.stringify((line.parts || [])[f.stage]) !== JSON.stringify(want))
        problem(
          `lines/${id}.json`,
          `parts[${f.stage}] is not what kitBuilds.json's ${f.name} gives (bake again: node tools/bake-kit-billies.mjs)`
        );
    }
  }
}
// phase 07: portraits: the schema, then every picture named is there and every face uses parts that exist
if (D.portraits) {
  const P = D.portraits,
    where = 'portraits.json',
    art = join(DATA, '..', 'art', 'next', 'portraits'),
    has = img => existsSync(join(art, img + '.png')),
    pics = v => (typeof v === 'string' ? [v] : Object.values(v)),
    slots = new Set((P.slots || []).map(s => s.id));
  if (check('portraits.schema.json', P, where)) {
    for (const [id, H] of Object.entries(P.heads))
      for (const img of [H.img, H.body]) if (!has(img)) problem(where, `head ${id}: no picture ${img}.png`);
    for (const [id, I] of Object.entries(P.items)) {
      if (!slots.has(I.slot)) problem(where, `part ${id} is in slot ${I.slot}, no such slot`);
      for (const img of [...pics(I.img), ...(I.back ? [I.back.img] : [])])
        if (!has(img)) problem(where, `part ${id}: no picture ${img}.png`);
    }
    for (const [id, E] of Object.entries(P.eyes))
      for (const img of Object.values(E.frames))
        for (const s of ['_l', '_r']) if (!has(img + s)) problem(where, `eyes ${id}: no picture ${img + s}.png`);
    for (const [id, M] of Object.entries(P.mouths))
      for (const img of Object.values(M.frames)) if (!has(img)) problem(where, `mouth ${id}: no picture ${img}.png`);
    for (const [id, X] of Object.entries(P.expressions)) {
      for (const k of [X.mouth, ...(X.talk || [])])
        for (const [m, M] of Object.entries(P.mouths))
          if (!M.frames[k]) problem(where, `expression ${id}: mouth ${m} has no ${k}`);
      for (const [e, E] of Object.entries(P.eyes))
        if (!E.frames[X.eyes] && !E.frames[P.eyeFallback[X.eyes]])
          problem(where, `expression ${id}: eyes ${e} have no ${X.eyes}`);
    }
    for (const [id, F] of Object.entries(P.faces)) {
      if (!P.heads[F.head]) problem(where, `face ${id}: no head ${F.head}`);
      if (!P.eyes[F.eyes]) problem(where, `face ${id}: no eyes ${F.eyes}`);
      if (!P.mouths[F.mouth]) problem(where, `face ${id}: no mouth ${F.mouth}`);
      for (const i of F.items) if (!P.items[i]) problem(where, `face ${id}: no part ${i}`);
    }
  }
} else problem('portraits.json', 'missing');
for (const [id, T] of Object.entries(D.trainers || {})) {
  /* RL-5: a tutorial trainer and a mini-boss stand on no stop */
  if (!T.tutorial && !T.miniboss && !route[T.node])
    problem(`trainers/${id}.json`, `waits at stop ${T.node}, no such stop`);
  if (T.who && !people[T.who]) problem(`trainers/${id}.json`, `looks like ${T.who}, no such person`);
  for (const m of T.team || [])
    if (m.sp === 'robot') for (const p of dataRobotProblems(D, m.robot)) problem(`trainers/${id}.json`, p);
    else if (!known(m.sp) && !String(m.sp).startsWith('@'))
      problem(`trainers/${id}.json`, `has ${m.sp}, no such species`);
}
for (const [id, sc] of Object.entries(S)) {
  const where = `maps/${id}.json`,
    rows = sc.tiles || [];
  if (rows.length !== sc.h || rows.some(r => r.length !== sc.w))
    problem(where, `the ground isn't ${sc.h} rows of ${sc.w}`);
  if (sc.heights && (sc.heights.length !== sc.h + 1 || sc.heights.some(r => r.length !== sc.w + 1)))
    problem(where, `the heights aren't ${sc.h + 1} rows of ${sc.w + 1}`);
  const kinds = new Set(rows.join('') + (sc.edge || ''));
  for (const c of kinds)
    if (!scenery.terrains[c]) problem(where, `ground kind ${JSON.stringify(c)} isn't in scenery.terrains`);
  const props = new Set((sc.props || []).map(p => p.k));
  for (const k of props) if (!scenery.props[k]) problem(where, `prop ${k} isn't in scenery.props`);
  // island track IS-0: the island fields beyond their shapes (logic/island.js)
  for (const p of islandProblems(sc)) problem(where, p);
  // TC-3 (was check-quick's Data step): the step grid is two half-metre cells a metre each way, two bytes a cell
  if (sc.steps && Buffer.from(sc.steps, 'base64').length !== sc.w * 2 * sc.h * 2 * 2)
    problem(where, `the step grid isn't ${sc.w * 2} by ${sc.h * 2} cells`);
  // and what the Studio's Check only warns about fails here: a room says which building it is the inside of, and a
  // town or route scene is the kind its place is
  if (sc.kind === 'room' && !sc.building) problem(where, 'a room without a building');
  const pl = route.find(r => r.mapId === id);
  if (pl && ['town', 'route'].includes(sc.kind) && pl.kind !== sc.kind)
    problem(where, `a ${sc.kind} scene, its place ${pl.id} is a ${pl.kind}`);
}
// TC-3 (was check-quick's Data step): every place says whether it is a town or a route, as its town mark does, and
// its id is its scene's; every road has a name
route.forEach((p, n) => {
  const where = `locations.json place ${n} (${p.name})`;
  if (!['town', 'route'].includes(p.kind)) problem(where, 'no kind (town or route)');
  if (p.id !== p.mapId) problem(where, `id ${p.id} is not its scene ${p.mapId}`);
  if ((p.kind === 'town') !== !!p.town) problem(where, `kind ${p.kind} but ${p.town ? '' : 'not '}marked town`);
});
(D.roads || []).forEach((L, i) => {
  if (!PB_DATA.road(D, L).id) problem('roads.json', `road ${i}: no name`);
});
// TC-3 (was check-quick's Data step): every picture the scenery names exists
{
  const ART = join(DATA, '..', 'art'),
    need = (/** @type {string | undefined} */ p, /** @type {string} */ what) => {
      if (p && !existsSync(join(ART, p))) problem('scenery.json', `${what}: no picture ${p}`);
    };
  for (const [k, T] of Object.entries(scenery.terrains || {})) {
    need(T.tile, `ground ${k}`);
    for (const v of T.vars || []) need(v, `ground ${k}`);
  }
  for (const [k, P] of Object.entries(scenery.props || {})) {
    need(P.img, `prop ${k}`);
    for (const l of P.layers || []) if (l && typeof l === 'object') need(l.img, `prop ${k}`);
  }
  need(scenery.wallArt || 'scene/build/walls.png', 'the walls');
  for (const k of ['detail', 'rooms']) need((scenery.buildArt || {})[k], `buildArt.${k}`);
}

// Studio plan Phase 5 (T5.3): the rigs (game/art/next/rigs-next.js and art/rigs.js) hold together: boxes inside their
// sheets, sizes, parents, front and back, geo (logic/data-checks.js dataRigs, the Studio's Check runs it too)
{
  const vm = await import('node:vm'),
    { rigGeo, RIG_NEUTRAL_POSE } = await import('../game/js/logic/rig-joints.js'),
    { animFor } = await import('../game/js/body-plan-animation.js'),
    ART = join(DATA, '..', 'art'),
    rigsOf = (/** @type {string} */ f, /** @type {string} */ name) => {
      const box = { window: {} };
      vm.runInNewContext(readFileSync(join(ART, f), 'utf8'), box);
      return box.window[name] || {};
    },
    /* a PNG's width and height from its header */
    sheetSize = (/** @type {string} */ sheet) => {
      const f = join(ART, sheet);
      if (!existsSync(f)) return null;
      const b = readFileSync(f).subarray(16, 24);
      return [b.readUInt32BE(0), b.readUInt32BE(4)];
    },
    geoOf = (M, view) =>
      rigGeo(M, view, animFor(M.plan, M.q || {})(RIG_NEUTRAL_POSE, view === 'back') || {}, RIG_NEUTRAL_POSE);
  for (const [f, name] of [
    ['next/rigs-next.js', 'RIGS_NEXT'],
    ['rigs.js', 'RIGS'],
  ])
    for (const [where, what] of dataRigs(rigsOf(f, name), sheetSize, geoOf)) problem(where, what);
}
// Studio plan T1.3: the Studio's scene and road checks (logic/data-checks.js), so CI runs what the Studio's Check
// shows: an error fails here (each is one of the rules above too), a warning is printed and never fails
for (const f of [...dataSceneFindings(D, PB_DATA.road), ...dataRoadFindings(D, PB_DATA.road)])
  if (f.lvl === 'error') problem(f.where, f.msg);
  else console.log(`  warning: ${f.where}: ${f.msg}`);
const n = listed.size;
if (fixed) console.log(`${fixed} file(s) laid out again`);
// Project Story: story.json, the schema, then the people, places, trainers, Billies and pyramids it names
if (D.story) {
  check('story.schema.json', D.story, 'story.json');
  const places = new Set(route.map(r => r.id)),
    trainers = D.trainers || {};
  for (const [name, who] of Object.entries(D.story.speakers || {}))
    if (who !== 'me' && !people[who]) problem('story.json', `speaker ${name} is ${who}, no such person`);
  for (const [id, P] of Object.entries(D.story.presets || {})) {
    const at = `story.json preset ${id}`;
    if (!places.has(P.place)) problem(at, `starts in ${P.place}, no such place`);
    for (const t of P.beaten || []) if (!trainers[t]) problem(at, `has beaten ${t}, no such trainer`);
    for (const m of P.team || []) if (!species.has(m.sp)) problem(at, `has ${m.sp}, no such species`);
    for (const c of Object.keys(P.pyramids || {}))
      if (!(D.pyramids || {})[c]) problem(at, `has coin ${c}, no such coin`);
    for (const i of Object.keys(P.items || {})) if (!(D.items || {})[i]) problem(at, `has item ${i}, no such item`);
  }
} else problem('story.json', 'missing');
// Project Story S2: the story checks (tools/story-checks.mjs) on the game data, with the game's own parser and
// conditions (loaded as the tests load them)
{
  const { readGameData } = await import('./data-files.mjs');
  const { loadLogic } = await import('./test/load-logic.mjs');
  const { storyChecks } = await import('./story-checks.mjs');
  const G = readGameData(),
    quiet = { log: console.log, warn: console.warn, info: console.info };
  /* the loader's own notes (legacy stand-ins) are the game's business, not the data check's */
  console.log = console.warn = console.info = () => {};
  const { fn } = await loadLogic(G).finally(() => Object.assign(console, quiet));
  const L = Object.fromEntries(
    ['parseScript', 'conditionTree', 'conditionProblem', 'conditionNames'].map(k => [k, fn(k)])
  );
  const R = storyChecks(G, L);
  for (const p of R.problems) bad.push(`story: ${p}`);
  for (const w of R.warnings) console.log(`  story warning: ${w}`);
}
if (bad.length) {
  for (const b of bad.slice(0, 60)) console.log('  ' + b);
  console.log(`game data: ${bad.length} problem(s) in ${n} files`);
  process.exit(1);
}
console.log(`game data: ${n} files, all fine`);
