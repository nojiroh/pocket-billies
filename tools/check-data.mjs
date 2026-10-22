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
// - phase 07: portraits.json against its schema, and every picture, part and frame it names exists,
// - studio track ST-3: partKits.json against its schema, and every part's picture is there at its size,
// - phase 08b: the links between places (roads.json) join them as the walk needs, and every door opens a room (below),
// - UI-1: uiTheme.json against its schema, and its text reads on its ground and surface (4.5:1, light and dark; UI-3:
//   danger and primary at 3:1, screens' overrides too).
import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, PB_DATA } from './data-files.mjs';
import { uiThemeContrast } from '../game/js/logic/ui-theme.js';
import { seamRulesLinks, seamRulesPlaces } from '../game/js/logic/seam-rules.js';
import { CLIMATE_WEATHER_ODDS } from '../game/js/logic/weather.js';
import { RUN_MARK_TYPES } from '../game/js/logic/run-marks.js';
import { runMapRowsFit } from '../game/js/logic/run-map.js';
import { islandProblems } from '../game/js/logic/island.js';
import { dataUnderscoreKeys } from '../game/js/logic/data-checks.js';
import { conditionNames, conditionProblem, conditionTree } from '../game/js/logic/conditions.js';
import { MAPGEN_DEFAULTS, MAPGEN_FEATURES, MAPGEN_SHAPES, MAPGEN_SURFACES, MAPGEN_WATER } from '../game/js/logic/mapgen.js';

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
    if (v && f.id !== null && (f.section === 'maps' || f.section === 'trainers')) check(ENTRY[f.section], v, at(f.path));
  }
  for (const f of readdirSync(join(DATA, 'legacy')))
    if (f.endsWith('.json') && !here.has(f)) problem(at(f), 'not listed in legacy/index.json');
  for (const dir of Object.keys(LI.split || {}))
    if (existsSync(join(DATA, 'legacy', dir)))
      for (const f of readdirSync(join(DATA, 'legacy', dir)))
        if (!here.has(`${dir}/${f}`)) problem(at(`${dir}/${f}`), 'not listed in legacy/index.json');
}

// cutscenes: the map each is filmed on, the spots its paths join (their scripts: the story checks below)
for (const [id, C] of Object.entries(D.cutscenes || {})) {
  if (!(D.maps || {})[C.map]) problem(`cutscenes/${id}.json`, `filmed on map ${C.map}, no such map`);
  for (const [a, b] of (C.clear && C.clear.paths) || [])
    for (const s of [a, b]) if (!C.spots[s]) problem(`cutscenes/${id}.json`, `clear path names spot ${s}, no such spot`);
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
  (L.names || []).forEach((n, i) => species.add(L.id + i));
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
const legacy = new Set();
if (existsSync(join(DATA, 'legacy', 'lines')))
  for (const f of readdirSync(join(DATA, 'legacy', 'lines')).filter(f => f.endsWith('.json'))) {
    const L = JSON.parse(readFileSync(join(DATA, 'legacy', 'lines', f), 'utf8'));
    (L.names || []).forEach((n, i) => legacy.add(L.id + i));
  }
const known = sp => species.has(sp) || legacy.has(sp);
for (const [k, P] of Object.entries(pools))
  for (const [sp] of P.list || []) if (!known(sp)) problem('pools.json', `${k} has ${sp}, no such species`);
route.forEach((r, i) => {
  if (r.mapId && !S[r.mapId]) problem('locations.json', `stop ${i} (${r.name}) has map ${r.mapId}, no such map`);
  if (r.pool && !pools[r.pool]) problem('locations.json', `stop ${i} (${r.name}) has pool ${r.pool}, no such pool`);
  // phase 10: a spot on the bowl (a in degrees, r from the floor's centre 0 to the rim 1), or under another place
  const B = r.bowl;
  if (!B) problem('locations.json', `stop ${i} (${r.name}) has no bowl spot`);
  else if ('under' in B) {
    const P = route.find(o => o.id === B.under);
    if (!P) problem('locations.json', `stop ${i} (${r.name}) is under ${B.under}, no such place`);
    else if (!P.bowl || 'under' in P.bowl) problem('locations.json', `stop ${i} (${r.name}) is under ${B.under}, which has no spot of its own`);
  } else if (!(B.a >= 0 && B.a < 360 && B.r >= 0 && B.r <= 1))
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
    if (M && M.room && !isRoom(M.room)) problem('scenery.json', `${k}'s room ${M.room} isn't a room`);
  for (const r of route) {
    const sc = S[r.mapId];
    if (!sc || sc.kind === 'room') continue;
    for (const p of sc.props || []) {
      if (!PB_DATA.ROOM_BY_USE[p.act]) continue;
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
        problem('scenery.json', `${p.k}'s door is off its front (${((M.door.x || 0) / ppu).toFixed(2)} m from the middle)`);
      seen.add(id).add(p.k);
    }
  }
}
// roguelite track RL-4: the turn cap, a whole number of turns, at least 10 (a short cap would end ordinary battles)
{
  const cap = D.rules && D.rules.battle && D.rules.battle.turnCap;
  if (!Number.isInteger(cap) || cap < 10) problem('rules.json', 'battle.turnCap is not a whole number of 10 or more');
}
// roguelite track RL-3: what a run pays when it ends (logic/run-state.js payoutOf): every rate a number, none below 0,
// the items' share of their price at most 1, the seals for a win a whole number
{
  const pay = D.rules && D.rules.run && D.rules.run.payout,
    RATES = ['money', 'itemShare', 'released', 'node', 'win', 'winSeals', 'scrapNode', 'scrapWin'];
  if (!pay || typeof pay !== 'object') problem('rules.json', 'run.payout missing');
  else {
    for (const k of RATES)
      if (typeof pay[k] !== 'number' || !(pay[k] >= 0)) problem('rules.json', `run.payout.${k} is not a number of 0 or more`);
    for (const k of Object.keys(pay)) if (!RATES.includes(k)) problem('rules.json', `run.payout.${k}: no such rate`);
    if (pay.itemShare > 1) problem('rules.json', 'run.payout.itemShare is more than 1 (items would pay over their price)');
    for (const k of ['winSeals', 'scrapNode', 'scrapWin'])
      if (!Number.isInteger(pay[k])) problem('rules.json', `run.payout.${k} is not a whole number`);
  }
}
// RL-9: the ranch (logic/ranch.js): training slots by ranch level (1-12 levels, each 1-20 slots, never fewer than the
// level before), the level cap (capBase at level 1, capStep more a level; at most the game's maxLevel), the hours a
// trainee banks (1-168), levels an hour (above 0, at most 10), the Scrap to start (0-10,000), the clock's slack for a
// rollback (0-1 hour); nothing else
{
  const RA = D.rules && D.rules.ranch,
    whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
    KEYS = ['slots', 'capBase', 'capStep', 'bankHours', 'levelsPerHour', 'trainCost', 'guardMs', 'breed'];
  if (!RA || typeof RA !== 'object' || Array.isArray(RA)) problem('rules.json', 'ranch missing');
  else {
    for (const k of Object.keys(RA)) if (!KEYS.includes(k)) problem('rules.json', `ranch.${k}: no such rule`);
    const S = RA.slots;
    if (!Array.isArray(S) || S.length < 1 || S.length > 12 || !S.every((n, i) => whole(n, 1, 20) && (!i || n >= S[i - 1])))
      problem('rules.json', 'ranch.slots is not a list of 1-12 whole numbers (1-20), none fewer than the one before');
    const most = (D.rules.progression && D.rules.progression.maxLevel) || 100;
    if (!whole(RA.capBase, 2, most) || !whole(RA.capStep, 0, most))
      problem('rules.json', `ranch.capBase (2-${most}) and capStep (0-${most}) are not whole levels`);
    if (!whole(RA.bankHours, 1, 168)) problem('rules.json', 'ranch.bankHours is not a whole number of hours (1-168)');
    if (typeof RA.levelsPerHour !== 'number' || !(RA.levelsPerHour > 0 && RA.levelsPerHour <= 10))
      problem('rules.json', 'ranch.levelsPerHour is not a number above 0 and at most 10');
    if (!whole(RA.trainCost, 0, 10000)) problem('rules.json', 'ranch.trainCost is not a whole number of Scrap (0-10,000)');
    if (!whole(RA.guardMs, 0, 3600000)) problem('rules.json', 'ranch.guardMs is not a whole number of ms (0-3,600,000)');
    // RL-10: breeding (logic/breeding.js): nests by ranch level as slots are, the two costs (a risky pair never costs
    // more than a safe one), the hours to hatch (1-168), the level it hatches at, the risky odds adding up to 1, the
    // abomination's spike (1-3) and drawback (0.1-1); nothing else
    const B = RA.breed,
      BKEYS = ['nests', 'safeCost', 'riskyCost', 'hours', 'lvl', 'odds', 'abomUp', 'abomDown'];
    if (!B || typeof B !== 'object' || Array.isArray(B)) problem('rules.json', 'ranch.breed missing');
    else {
      for (const k of Object.keys(B)) if (!BKEYS.includes(k)) problem('rules.json', `ranch.breed.${k}: no such rule`);
      const N = B.nests;
      if (!Array.isArray(N) || N.length < 1 || N.length > 12 || !N.every((n, i) => whole(n, 1, 20) && (!i || n >= N[i - 1])))
        problem('rules.json', 'ranch.breed.nests is not a list of 1-12 whole numbers (1-20), none fewer than the one before');
      if (!whole(B.safeCost, 0, 10000) || !whole(B.riskyCost, 0, 10000) || B.riskyCost > B.safeCost)
        problem('rules.json', 'ranch.breed.safeCost and riskyCost are not whole Scrap (0-10,000), risky at most safe');
      if (!whole(B.hours, 1, 168)) problem('rules.json', 'ranch.breed.hours is not a whole number of hours (1-168)');
      if (!whole(B.lvl, 1, most)) problem('rules.json', `ranch.breed.lvl is not a whole level (1-${most})`);
      const O = B.odds,
        OK = ['safe', 'quirk', 'abom'];
      if (
        !O ||
        typeof O !== 'object' ||
        Object.keys(O).length !== 3 ||
        !OK.every(k => typeof O[k] === 'number' && O[k] >= 0 && O[k] <= 1) ||
        Math.abs(OK.reduce((a, k) => a + O[k], 0) - 1) > 1e-9
      )
        problem('rules.json', 'ranch.breed.odds is not safe, quirk and abom (each 0-1) adding up to 1');
      if (typeof B.abomUp !== 'number' || !(B.abomUp >= 1 && B.abomUp <= 3))
        problem('rules.json', 'ranch.breed.abomUp is not a number from 1 to 3');
      if (typeof B.abomDown !== 'number' || !(B.abomDown >= 0.1 && B.abomDown <= 1))
        problem('rules.json', 'ranch.breed.abomDown is not a number from 0.1 to 1');
    }
  }
}
// RL-6: how a run's node map is laid out (logic/run-map.js): 5 to 12 rows, mini-bosses that fit (each on a row of
// its own, a town's row before it, after the landing's row and before the boss's), the four types it names in
// nodeTypes.json, chances from 0 to 1, biomes that exist with something to pick
{
  const M = D.rules && D.rules.run && D.rules.run.map,
    KEYS = ['rows', 'minibosses', 'first', 'rest', 'guard', 'last', 'wide', 'cross', 'biomes'];
  if (!M || typeof M !== 'object') problem('rules.json', 'run.map missing');
  else {
    for (const k of Object.keys(M)) if (!KEYS.includes(k)) problem('rules.json', `run.map.${k}: no such rule`);
    if (!Number.isInteger(M.rows) || M.rows < 5 || M.rows > 12) problem('rules.json', 'run.map.rows is not a whole number from 5 to 12');
    else if (!Number.isInteger(M.minibosses) || M.minibosses < 0 || !runMapRowsFit(M))
      problem('rules.json', `run.map: ${M.rows} rows can't hold ${M.minibosses} mini-bosses (each on a row of its own with a town's row before it)`);
    for (const k of ['first', 'rest', 'guard', 'last'])
      if (!(D.nodeTypes || {})[M[k]]) problem('rules.json', `run.map.${k}: no node type "${M[k]}" (nodeTypes.json)`);
    for (const k of ['wide', 'cross'])
      if (typeof M[k] !== 'number' || !(M[k] >= 0 && M[k] <= 1)) problem('rules.json', `run.map.${k} is not a chance from 0 to 1`);
    const B = M.biomes && typeof M.biomes === 'object' ? Object.entries(M.biomes) : [];
    if (!B.some(([, w]) => w > 0)) problem('rules.json', 'run.map.biomes has no biome to pick');
    for (const [b, w] of B) {
      if (!(D.biomes || {})[b]) problem('rules.json', `run.map.biomes: no biome "${b}" (biomes.json)`);
      if (typeof w !== 'number' || !(w >= 0)) problem('rules.json', `run.map.biomes.${b} is not a weight of 0 or more`);
    }
  }
}
// RL-6: the run's clock and what its map shows: whole days of slack (0-30) and of forecast ahead (1-30), whole rows
// shown ahead with their type (1-12) and as '?' (at least as far, up to 12); nothing else in rules.json run
{
  const R = (D.rules && D.rules.run) || {},
    C = R.clock,
    V = R.reveal,
    whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  for (const k of Object.keys(R))
    if (!['payout', 'map', 'clock', 'reveal', 'scene', 'wild', 'seamIn', 'start', 'home', 'pack', 'healCost', 'shop', 'foes', 'relics'].includes(k)) problem('rules.json', `run.${k}: no such rule`);
  if (!C || typeof C !== 'object' || !whole(C.slack, 0, 30) || !whole(C.ahead, 1, 30))
    problem('rules.json', 'run.clock: slack (0-30) and ahead (1-30) are not whole numbers of days');
  else for (const k of Object.keys(C)) if (!['slack', 'ahead'].includes(k)) problem('rules.json', `run.clock.${k}: no such rule`);
  if (!V || typeof V !== 'object' || !whole(V.icons, 1, 12) || !whole(V.unknown, V.icons, 12))
    problem('rules.json', "run.reveal: icons (1-12) and unknown (icons to 12) are not whole numbers of rows");
  else for (const k of Object.keys(V)) if (!['icons', 'unknown'].includes(k)) problem('rules.json', `run.reveal.${k}: no such rule`);
}
// RL-7: how a run node's scene varies (logic/run-scenes.js): mapgen's dials, a [low, high] range from 0 to 1 for a
// number the generator keeps from 0 to 1 (land, nature and props, the road's wobble and verge), weights for a choice
// (water, the road's shape and surface, the feature) with something to pick; nothing the run sets itself (size, kind,
// biome, seed, exits, edges). Wild levels: whole numbers from 1 to 100, low to high, a whole number more a row and
// again on a node walked back to; the metres past a seam before a crossing counts (1-30)
{
  const R = (D.rules && D.rules.run) || {},
    SC = R.scene,
    CHOICES = { 'land.water': MAPGEN_WATER, 'road.shape': MAPGEN_SHAPES, 'road.surface': MAPGEN_SURFACES, feature: MAPGEN_FEATURES },
    RANGED = path => /^(land|nature|props)\.[a-z]+$|^road\.(wobble|verge)$/i.test(path),
    walk = (rule, def, path) => {
      for (const [k, v] of Object.entries(rule)) {
        const at = path ? `${path}.${k}` : k,
          d = def && typeof def === 'object' && !Array.isArray(def) ? def[k] : undefined;
        if (CHOICES[at]) {
          const W = v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : [];
          if (!W.some(([, w]) => w > 0)) problem('rules.json', `run.scene.${at} has nothing to pick`);
          for (const [c, w] of W) {
            if (!Object.hasOwn(CHOICES[at], c)) problem('rules.json', `run.scene.${at}: no such choice "${c}" (logic/mapgen.js)`);
            if (typeof w !== 'number' || !(w >= 0)) problem('rules.json', `run.scene.${at}.${c} is not a weight of 0 or more`);
          }
        } else if (typeof d === 'number' && RANGED(at)) {
          if (!Array.isArray(v) || v.length !== 2 || !v.every(x => typeof x === 'number' && x >= 0 && x <= 1) || v[0] > v[1])
            problem('rules.json', `run.scene.${at} is not a range [low, high] from 0 to 1`);
        } else if (d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' && !Array.isArray(v) && !path)
          walk(v, d, at);
        else problem('rules.json', `run.scene.${at}: not a dial a run varies (logic/mapgen.js MAPGEN_DEFAULTS)`);
      }
    };
  if (!SC || typeof SC !== 'object' || Array.isArray(SC)) problem('rules.json', 'run.scene missing');
  else walk(SC, MAPGEN_DEFAULTS, '');
  const W = R.wild,
    whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (
    !W ||
    typeof W !== 'object' ||
    !Array.isArray(W.lv) ||
    W.lv.length !== 2 ||
    !whole(W.lv[0], 1, 100) ||
    !whole(W.lv[1], W.lv[0], 100) ||
    !whole(W.perRow, 0, 20) ||
    !whole(W.back, 0, 20)
  )
    problem('rules.json', 'run.wild: lv [low, high] (1-100), perRow (0-20) and back (0-20) are not whole numbers');
  else for (const k of Object.keys(W)) if (!['lv', 'perRow', 'back'].includes(k)) problem('rules.json', `run.wild.${k}: no such rule`);
  if (!whole(R.seamIn, 1, 30)) problem('rules.json', 'run.seamIn is not a whole number of metres from 1 to 30');
}
// RL-8: the run loop's numbers (placeholders): what a run starts with (money, known coins and items, whole counts), a
// run town's heal price per hurt Billie, its shop (wares that exist: an item id or coin:<id>; `more` drawn by weight
// from `pick`, with something to pick when more is above 0), a mini-boss's and the boss's levels over their row and
// their reward; nothing else in each
{
  const R = (D.rules && D.rules.run) || {},
    whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
    rec = v => !!v && typeof v === 'object' && !Array.isArray(v),
    only = (o, keys, at) => { for (const k of Object.keys(o)) if (!keys.includes(k)) problem('rules.json', `${at}.${k}: no such rule`); },
    ware = w => typeof w === 'string' && (w.startsWith('coin:') ? !!(D.coins || {})[w.slice(5)] : !!(D.items || {})[w]),
    ST = R.start,
    SH = R.shop,
    F = R.foes;
  if (!rec(ST) || !whole(ST.se, 0, 1e6) || !rec(ST.coins) || !rec(ST.items))
    problem('rules.json', 'run.start: se (whole, 0-1,000,000), coins and items (records) are needed');
  else {
    only(ST, ['se', 'coins', 'items'], 'run.start');
    for (const [k, n] of Object.entries(ST.coins)) if (!(D.coins || {})[k] || !whole(n, 0, 999)) problem('rules.json', `run.start.coins.${k}: no such coin, or not a whole count`);
    for (const [k, n] of Object.entries(ST.items)) if (!(D.items || {})[k] || !whole(n, 0, 999)) problem('rules.json', `run.start.items.${k}: no such item, or not a whole count`);
  }
  // RL-9b: by Bracket (index 0 = Bracket I; past the end, the last): Billies from home a run takes (1-6, never fewer
  // than the Bracket before) and the things packed from Copperleaf's bag (0-99 items and coins in all)
  for (const [k, lo, hi, what] of [['home', 1, 6, 'Billies from home'], ['pack', 0, 99, 'things packed']]) {
    const L = R[k];
    if (!Array.isArray(L) || L.length < 1 || L.length > 9 || !L.every((n, i) => whole(n, lo, hi) && (!i || n >= L[i - 1])))
      problem('rules.json', `run.${k} is not a list of 1-9 whole numbers (${what}, ${lo}-${hi}), one a Bracket, none fewer than the one before`);
  }
  if (!whole(R.healCost, 0, 100000)) problem('rules.json', 'run.healCost is not a whole number of $ (0-100,000)');
  if (!rec(SH) || !Array.isArray(SH.always) || !whole(SH.more, 0, 12) || !rec(SH.pick))
    problem('rules.json', 'run.shop: always (a list), more (whole, 0-12) and pick (weights) are needed');
  else {
    only(SH, ['always', 'more', 'pick'], 'run.shop');
    for (const w of SH.always) if (!ware(w)) problem('rules.json', `run.shop.always: no such ware "${w}"`);
    for (const [w, n] of Object.entries(SH.pick)) {
      if (!ware(w)) problem('rules.json', `run.shop.pick: no such ware "${w}"`);
      if (typeof n !== 'number' || !(n >= 0)) problem('rules.json', `run.shop.pick.${w} is not a weight of 0 or more`);
    }
    if (SH.more > 0 && !Object.values(SH.pick).some(n => n > 0)) problem('rules.json', 'run.shop.pick has nothing to pick');
  }
  if (!rec(F)) problem('rules.json', 'run.foes missing');
  else {
    only(F, ['miniboss', 'boss'], 'run.foes');
    for (const k of ['miniboss', 'boss']) {
      const f = F[k];
      if (!rec(f) || !whole(f.up, -20, 50) || !whole(f.reward, 0, 1e6))
        problem('rules.json', `run.foes.${k}: up (whole, -20-50) and reward (whole $, 0-1,000,000) are needed`);
      else only(f, ['up', 'reward'], `run.foes.${k}`);
    }
  }
}
// phase 17: robot parts and gems: the schema, then the moves and types they name and the slot each part fits
const robots = D.robots || { parts: {}, gems: {} },
  types = new Set([...(D.types || []).map(t => t.id), 'None']);
if (D.robots) check('robots.schema.json', D.robots, 'robots.json');
else problem('robots.json', 'missing');
for (const [id, P] of Object.entries(robots.parts || {})) {
  if (!types.has(P.type)) problem('robots.json', `part ${id} is type ${P.type}, no such type`);
  if (P.slot !== 'torso' && !moves[P.move]) problem('robots.json', `part ${id} gives ${P.move}, no such move`);
  if (P.slot === 'legs' && !(P.carry > 0)) problem('robots.json', `legs ${id} carry nothing (carry)`);
  // studio track ST-5: stored joints belong to a picture in that view; only a torso has sockets and a head
  const A = P.art || {};
  for (const [key, pics] of [
    ['joints', { front: A.img, back: A.imgB }],
    ['headJoints', { front: A.head, back: A.headB }],
  ])
    for (const [view, J] of Object.entries(A[key] || {})) {
      if (!pics[view]) problem('robots.json', `part ${id} has ${key}.${view} but no ${view} picture`);
      if (J.sockets && (P.slot !== 'torso' || key === 'headJoints'))
        problem('robots.json', `part ${id} ${key}.${view} has sockets; only a torso has sockets`);
    }
  if (P.slot !== 'torso' && (A.headJoints || A.headTurn)) problem('robots.json', `part ${id} is not a torso but has a head`);
}
for (const [id, G] of Object.entries(robots.gems || {})) {
  if (!types.has(G.type)) problem('robots.json', `gem ${id} is type ${G.type}, no such type`);
  if (!moves[G.move]) problem('robots.json', `gem ${id} gives ${G.move}, no such move`);
}
// UI-1: the UI's look: the schema, then the colours read on the ground and on a solid surface (UI-3: text and quiet
// text at 4.5:1, danger and primary at 3:1) in the defaults, every preset and every screen's override, both sides
// (logic/ui-theme.js uiThemeContrast, which the Studio's Check uses too)
if (D.uiTheme && check('uiTheme.schema.json', D.uiTheme, 'uiTheme.json'))
  for (const f of uiThemeContrast(D.uiTheme))
    problem('uiTheme.json', `${f.where || 'defaults'} ${f.side}: ${f.fg} on ${f.bg} reads at ${f.ratio.toFixed(2)}:1, under ${f.min}`);
// map generator MG-1: the biome recipes: the schema, then the ground letters, prop kinds and life they name
if (D.biomes && check('biomes.schema.json', D.biomes, 'biomes.json')) {
  const terr = (D.scenery && D.scenery.terrains) || {},
    props = (D.scenery && D.scenery.props) || {},
    life = (D.scenery && D.scenery.life) || {};
  for (const [b, B] of Object.entries(D.biomes)) {
    const G = B.ground;
    // RL-6: the weather it gets outdoors (none is for rooms)
    if (!Object.hasOwn(CLIMATE_WEATHER_ODDS, B.climate) || B.climate === 'none')
      problem('biomes.json', `${b}.climate: "${B.climate}" is not an outdoor climate (logic/weather.js)`);
    // RL-7: a run node's Billies, battle stage and colour grade
    if (!(D.pools || {})[B.pool]) problem('biomes.json', `${b}.pool: no pool "${B.pool}" (pools.json)`);
    if (!(D.battleStages || {})[B.battleStage]) problem('biomes.json', `${b}.battleStage: no stage "${B.battleStage}" (battleStages.json)`);
    if (!(D.moods || {})[B.mood]) problem('biomes.json', `${b}.mood: no mood "${B.mood}" (moods.json)`);
    for (const [f, ch] of [...Object.entries(G).filter(([f]) => f !== 'patches'), ['road', B.road]])
      if (!terr[ch]) problem('biomes.json', `${b}.${f}: no terrain "${ch}" (scenery.json terrains)`);
    for (const ch of Object.keys(G.patches || {})) if (!terr[ch]) problem('biomes.json', `${b}.ground.patches: no terrain "${ch}"`);
    for (const pool of ['trees', 'shrubs', 'plants', 'rocks', 'waterPlants', 'tall'])
      for (const k of Object.keys(B[pool] || {})) if (!props[k]) problem('biomes.json', `${b}.${pool}: no prop ${k}`);
    for (const L of B.life || []) if (!life[L.k]) problem('biomes.json', `${b}.life: no animal ${L.k}`);
  }
}
// RL-6: the kinds of node on a run's map: the schema, a marker for each, and something to fill the free rows with
if (D.nodeTypes && check('nodeTypes.schema.json', D.nodeTypes, 'nodeTypes.json')) {
  for (const [k, T] of Object.entries(D.nodeTypes)) {
    const mark = T.mark || k;
    if (!RUN_MARK_TYPES.includes(mark) || mark === 'unknown')
      problem('nodeTypes.json', `${k}: no marker "${mark}" (logic/run-marks.js: ${RUN_MARK_TYPES.filter(t => t !== 'unknown').join(', ')})`);
  }
  if (!Object.values(D.nodeTypes).some(T => (T.weight || 0) > 0))
    problem('nodeTypes.json', 'no type has a weight, so nothing can fill a free row of the run map');
}
// RL-12: Loopholes (relics): the schema, the types their damage rows name; rules.json run.relics: a cap of 1-12 held, a
// pick of 1-5 (run.offer holds up to 5), a weight of 0 or more and a whole price ($0-100,000) for each rarity, and
// something to offer
{
  const RR = D.rules && D.rules.run && D.rules.run.relics,
    RARITIES = ['common', 'uncommon', 'rare'],
    whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
    types = new Set((D.types || []).map(t => t.id));
  if (D.relics && check('relics.schema.json', D.relics, 'relics.json'))
    for (const [k, R] of Object.entries(D.relics))
      R.fx.forEach((f, n) => {
        if (f.type && !types.has(f.type)) problem('relics.json', `${k}.fx[${n}].type: no type "${f.type}" (types.json)`);
      });
  if (!RR || typeof RR !== 'object' || Array.isArray(RR)) problem('rules.json', 'run.relics missing');
  else {
    for (const k of Object.keys(RR)) if (!['cap', 'pick', 'rarity', 'price'].includes(k)) problem('rules.json', `run.relics.${k}: no such rule`);
    if (!whole(RR.cap, 1, 12)) problem('rules.json', 'run.relics.cap is not a whole number from 1 to 12');
    if (!whole(RR.pick, 1, 5)) problem('rules.json', 'run.relics.pick is not a whole number from 1 to 5');
    for (const g of ['rarity', 'price']) {
      const G = RR[g] && typeof RR[g] === 'object' ? RR[g] : {};
      for (const k of Object.keys(G)) if (!RARITIES.includes(k)) problem('rules.json', `run.relics.${g}.${k}: no such rarity`);
      for (const r of RARITIES)
        if (g === 'rarity' ? !(typeof G[r] === 'number' && G[r] >= 0) : !whole(G[r], 0, 100000))
          problem('rules.json', `run.relics.${g}.${r} is not ${g === 'rarity' ? 'a weight of 0 or more' : 'a whole price ($0-100,000)'}`);
    }
    if (D.relics && !Object.values(D.relics).some(R => (RR.rarity || {})[R.rarity] > 0))
      problem('rules.json', 'run.relics.rarity gives every Loophole in relics.json a weight of 0: nothing can be offered');
  }
}
// RL-11: the four currencies (the schema refuses a fifth or a missing one); money is the run's, the others meta's,
// each read by its id from saveData.meta (logic/meta-state.js)
if (D.currencies && check('currencies.schema.json', D.currencies, 'currencies.json')) {
  for (const [k, C] of Object.entries(D.currencies))
    if ((C.kept === 'run') !== (k === 'money')) problem('currencies.json', `${k}.kept: ${k === 'money' ? 'money is the run\'s' : 'kept between runs (meta)'}`);
}
// RL-11: the hub's buildings: a meta currency each, an act some Copperleaf prop has, and the ranch's levels within what
// rules.json ranch gives slots for
if (D.buildings && check('buildings.schema.json', D.buildings, 'buildings.json')) {
  const hub = ((D.maps || {}).copperleaf || {}).props || [],
    slots = (((D.rules || {}).ranch || {}).slots || []).length;
  for (const [k, B] of Object.entries(D.buildings)) {
    if (D.currencies && !(D.currencies[B.currency] && D.currencies[B.currency].kept === 'meta'))
      problem('buildings.json', `${k}.currency: "${B.currency}" is not a currency kept between runs (currencies.json)`);
    if (B.act && !hub.some(p => p.act === B.act)) problem('buildings.json', `${k}.act: no prop in Copperleaf has act "${B.act}"`);
    if (B.soon && B.levels > 1) problem('buildings.json', `${k}: a building that is coming later has no levels to sell`);
  }
  if (D.buildings.ranch && slots && D.buildings.ranch.levels > slots)
    problem('buildings.json', `ranch.levels: ${D.buildings.ranch.levels}, but rules.json ranch.slots has ${slots} levels`);
}
// RL-11: the unlock table: sold at a building that is built, or earned by a condition that reads and names real
// unlocks; what it needs exists and goes round in no circle; every building level above 1 sold once, at its own
// building, after the level below; a shop item or biome it opens is one the run's rules can draw, and the rules keep
// something always open (a biome; the shop's always-stocked wares are never locked)
if (D.unlocks && check('unlocks.schema.json', D.unlocks, 'unlocks.json')) {
  const U = D.unlocks,
    B = D.buildings || {},
    run = (D.rules || {}).run || {},
    pick = (run.shop || {}).pick || {},
    always = (run.shop || {}).always || [],
    biomes = (run.map || {}).biomes || {},
    levelRow = {};
  for (const [k, R] of Object.entries(U)) {
    if (R.at && !B[R.at]) problem('unlocks.json', `${k}.at: no building "${R.at}" (buildings.json)`);
    else if (R.at && B[R.at].soon) problem('unlocks.json', `${k}.at: ${R.at} is coming later and sells nothing yet`);
    if (R.when) {
      const p = conditionProblem(R.when);
      if (p) problem('unlocks.json', `${k}.when: ${p.message}`);
      else for (const u of conditionNames(conditionTree(R.when)).unlock || []) if (!U[u]) problem('unlocks.json', `${k}.when: unlock:${u}, no such unlock`);
    }
    for (const r of R.requires || []) if (!U[r] || r === k) problem('unlocks.json', `${k}.requires: no unlock "${r}"`);
    const G = R.grant;
    if (G.building) {
      const b = B[G.building];
      if (!b) problem('unlocks.json', `${k}.grant.building: no building "${G.building}"`);
      else if (G.level > b.levels) problem('unlocks.json', `${k}.grant: ${G.building} goes up to level ${b.levels}`);
      else if (R.at !== G.building) problem('unlocks.json', `${k}: a level of ${G.building} is sold at ${G.building}`);
      const key = `${G.building}:${G.level}`;
      if (levelRow[key]) problem('unlocks.json', `${k}: ${G.building} level ${G.level} is sold by ${levelRow[key]} already`);
      levelRow[key] = k;
    }
    if (G.shop && !(G.shop in pick)) problem('unlocks.json', `${k}.grant.shop: "${G.shop}" is not in rules.json run.shop.pick`);
    if (G.shop && always.includes(G.shop)) problem('unlocks.json', `${k}.grant.shop: "${G.shop}" is always stocked (run.shop.always)`);
    if (G.biome && !(G.biome in biomes)) problem('unlocks.json', `${k}.grant.biome: "${G.biome}" is not in rules.json run.map.biomes`);
  }
  for (const [b, Bd] of Object.entries(B))
    for (let n = 2; n <= Bd.levels; n++) {
      const k = levelRow[`${b}:${n}`];
      if (!k) problem('unlocks.json', `no row sells ${b} level ${n} (buildings.json ${b}.levels ${Bd.levels})`);
      else if (n > 2 && !(U[k].requires || []).includes(levelRow[`${b}:${n - 1}`]))
        problem('unlocks.json', `${k}: ${b} level ${n} requires the level below (${levelRow[`${b}:${n - 1}`] || 'none sold'})`);
    }
  const seen = {},
    loop = (k, path) => {
      if (seen[k] === 2 || !U[k]) return;
      if (seen[k] === 1) return problem('unlocks.json', `${k}.requires goes round in a circle: ${[...path, k].join(' -> ')}`);
      seen[k] = 1;
      for (const r of U[k].requires || []) loop(r, [...path, k]);
      seen[k] = 2;
    };
  for (const k of Object.keys(U)) loop(k, []);
  const locked = new Set(Object.values(U).map(R => R.grant.biome).filter(Boolean));
  if (Object.keys(biomes).length && Object.keys(biomes).every(b => locked.has(b)))
    problem('unlocks.json', 'every biome of rules.json run.map.biomes is locked: a new player\'s run map would have none');
}
// phase 10: the world map's look: the schema, then the terrain keys it names and the regions it covers
if (D.worldmap && check('worldmap.schema.json', D.worldmap, 'worldmap.json')) {
  const terr = new Set(Object.keys((D.scenery && D.scenery.terrains) || {}));
  const keysOk = (where, s) => {
    for (const ch of s) if (!terr.has(ch)) problem('worldmap.json', `${where}: no terrain "${ch}" (scenery.json terrains)`);
  };
  for (const [r, R] of Object.entries(D.worldmap.regions))
    for (const f of ['ground', 'wet', 'dry', 'high']) keysOk(`regions.${r}.${f}`, R[f]);
  for (const [k, s] of Object.entries(D.worldmap.kinds)) keysOk(`kinds.${k}`, s);
  for (const l of D.locations || [])
    if (l.region && !D.worldmap.regions[l.region]) problem('worldmap.json', `no region ${l.region} (place ${l.id})`);
}
// studio track ST-0: coats: the schema, then the palette ramps, Billies and pictures they name
if (D.coats && check('coats.schema.json', D.coats, 'coats.json')) {
  const pal = JSON.parse(readFileSync(join(DATA, '..', 'art', 'next', 'palette.js'), 'utf8').replace(/^[^=]*=/, '').replace(/;\s*$/, ''));
  const species = new Set((D.lines || []).flatMap(L => L.names.map((_, i) => L.id + i)));
  for (const [id, C] of Object.entries(D.coats)) {
    for (const [a, b] of Object.entries(C.ramps || {}))
      for (const r of [a, b]) if (!pal.ramps[r]) problem('coats.json', `coat ${id} swaps ramp ${r}, no such palette ramp`);
    for (const [sp, views] of Object.entries(C.art || {})) {
      if (!species.has(sp)) problem('coats.json', `coat ${id} has art for ${sp}, no such Billie`);
      for (const p of Object.values(views))
        if (!existsSync(join(DATA, '..', 'art', p))) problem('coats.json', `coat ${id}: no picture ${p}`);
    }
  }
}
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
          problem('partKits.json', `part ${id} ${view}: ${V.file} is ${b.readUInt32BE(16)} x ${b.readUInt32BE(20)}, not ${V.w} x ${V.h}`);
      }
      if (!V.file.includes(`/${view}/`)) problem('partKits.json', `part ${id}: its ${view} picture is in another view's folder`);
    },
    turnOk = (where, t) => t && t[0] > t[1] && problem('partKits.json', `${where}: turn limits ${t[0]} to ${t[1]} run backwards`);
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
      ['stage', `${f.line} ${f.stage}`],
    ])
      if (seen[k].has(v)) problem(at, `${where}: a second form for ${k} ${v}`);
      else seen[k].add(v);
    const line = (D.lines || []).find(l => l.id === f.line);
    if (!line) problem(at, `${where}: line ${f.line}, no such line`);
    else if (f.stage >= line.names.length) problem(at, `${where}: stage ${f.stage}, ${f.line} has ${line.names.length}`);
    else (lines[f.line] ||= { line, forms: [] }).forms.push(f);
    for (const [kind, [pid, , col]] of Object.entries(f.parts)) {
      if (!kit[pid]) problem(at, `${where} ${kind}: part ${pid}, not in partKits.json`);
      colourOk(`${where} ${kind}`, col);
    }
    (f.extras || []).forEach(([pid, anchor, , col, , slot], i) => {
      if (!kit[pid]) problem(at, `${where} extra ${i + 1}: part ${pid}, not in partKits.json`);
      if (!B.bake.anchors[anchor]) problem(at, `${where} extra ${i + 1}: anchor ${anchor}, not in bake.anchors`);
      colourOk(`${where} extra ${i + 1}`, col);
      if (slot && !slotNames.has(slot)) problem(at, `${where} extra ${i + 1}: slot ${slot}, not in rules.json parts.slots`);
    });
    for (const [kind, slot] of Object.entries(f.slots || {})) {
      if (!f.parts[kind]) problem(at, `${where}: slots.${kind}, the form has no ${kind}`);
      if (!slotNames.has(slot)) problem(at, `${where}: slots.${kind} is ${slot}, not in rules.json parts.slots`);
    }
  }
  const { kitNativeParts } = await import('../game/js/logic/kit-assemble.js');
  for (const [id, { line, forms }] of Object.entries(lines)) {
    if (forms.length !== line.names.length)
      problem(at, `line ${id}: recipes for stages ${forms.map(f => f.stage).sort()}, the line has ${line.names.length}`);
    for (const f of forms) {
      let want;
      try {
        want = kitNativeParts(f);
      } catch (e) {
        problem(at, e.message);
        continue;
      }
      if (JSON.stringify((line.parts || [])[f.stage]) !== JSON.stringify(want))
        problem(`lines/${id}.json`, `parts[${f.stage}] is not what kitBuilds.json's ${f.name} gives (bake again: node tools/bake-kit-billies.mjs)`);
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
const ROBOT_FITS = { torso: 'torso', armL: 'arm', armR: 'arm', legs: 'legs' };
const robotProblems = R => {
  if (!R) return ['is a robot with no parts (robot)'];
  const out = [];
  if (!(robots.gems || {})[R.gem]) out.push(`has robot gem ${R.gem}, no such gem`);
  for (const [k, slot] of Object.entries(ROBOT_FITS)) {
    const P = (robots.parts || {})[R[k]];
    if (!P) out.push(`has robot ${k} ${R[k]}, no such part`);
    else if (P.slot !== slot) out.push(`has ${R[k]} as ${k}, but it is a ${P.slot} part`);
  }
  return out;
};
for (const [id, T] of Object.entries(D.trainers || {})) {
  /* RL-5: a tutorial trainer and a mini-boss stand on no stop */
  if (!T.tutorial && !T.miniboss && !route[T.node])
    problem(`trainers/${id}.json`, `waits at stop ${T.node}, no such stop`);
  if (T.who && !people[T.who]) problem(`trainers/${id}.json`, `looks like ${T.who}, no such person`);
  for (const m of T.team || [])
    if (m.sp === 'robot') for (const p of robotProblems(m.robot)) problem(`trainers/${id}.json`, p);
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
}

const n = listed.size;
if (fixed) console.log(`${fixed} file(s) laid out again`);
// Project Story: story.json, the schema, then the people, places, trainers, Billies and coins it names
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
    for (const c of Object.keys(P.coins || {})) if (!(D.coins || {})[c]) problem(at, `has coin ${c}, no such coin`);
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
