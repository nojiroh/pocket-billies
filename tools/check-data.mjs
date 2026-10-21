// Phase 04b: checks the game data files (game/data). Fast (no browser), run by CI on every push.
//   node tools/check-data.mjs          (npm run check:data)
//   node tools/check-data.mjs --fix    also rewrites files that are laid out differently from how the Studio writes them
// - index.json lists exactly the files there are (none missing, none left over),
// - every file is JSON, laid out as game/js/data-files.js writes it (so a Studio save doesn't reformat it),
// - every map, line, trainer and person matches its schema (game/data/schema/*.schema.json), robots.json and story.json
//   their own (story.json's speakers and start presets name real people, places, trainers and Billies),
// - what refers to what exists: moves a line learns, species in pools and teams, a stop's map and wild pool, the
//   ground kinds and props a map uses, the stops of links and trainers, a trainer's look,
// - a map's ground is h rows of w, its heights (h+1) rows of w+1,
// - phase 07: portraits.json against its schema, and every picture, part and frame it names exists,
// - studio track ST-3: partKits.json against its schema, and every part's picture is there at its size,
// - phase 08b: the links between places (roads.json) join them as the walk needs, and every door opens a room (below),
// - UI-1: uiTheme.json against its schema, and its text reads on its ground and surface (4.5:1, light and dark).
import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, PB_DATA } from './data-files.mjs';
import { contrastRatio } from '../game/js/logic/colors.js';

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
const read = path => {
  const file = join(DATA, path);
  if (!existsSync(file)) {
    problem(path, 'listed in index.json but missing');
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
// phase 08b: the links. A seam's two exits face each other (east to west, north to south), are as wide, and meet
// within half a metre once the view puts the second map on whole metres (seamless-world.js seamlessJoin); the ground
// at each exit is walkable (the walk's own rule: water only where the place is ridden). Every edge exit of a place's
// map is used by exactly one link; a side has at most two exits, 44 m apart or more. A lift: a lift prop at each end
// goes to the other. A link that joins nothing walkable is an error, not a road the game draws.
{
  const OPPOSITE = { E: 'W', W: 'E', N: 'S', S: 'N' },
    T = (D.scenery && D.scenery.terrains) || {},
    along = (sc, e) => Math.round(e.t * (e.side === 'N' || e.side === 'S' ? sc.w : sc.h) * 100) / 100,
    at = (sc, e) => {
      const n = e.in == null ? 1.1 : e.in;
      return e.side === 'N'
        ? [e.t * sc.w, sc.h - n]
        : e.side === 'S'
          ? [e.t * sc.w, n]
          : e.side === 'E'
            ? [sc.w - n, e.t * sc.h]
            : [n, e.t * sc.h];
    },
    walkable = (sc, [x, z]) => {
      const ch = ((sc.tiles || [])[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)] || sc.edge || 'g',
        t = T[ch];
      return t && t.walk != null ? !!t.walk : !'wd'.includes(ch) || !!sc.ride;
    },
    used = new Map(),
    ids = new Set();
  (D.roads || []).forEach((L, i) => {
    const l = PB_DATA.road(D, L),
      name = l.id || `link ${i}`;
    if (!route[l.a] || !route[l.b])
      return problem('roads.json', `${name} joins ${L.a && L.a.map} and ${L.b && L.b.map}, not two places`);
    if (l.a === l.b) problem('roads.json', `${name} joins ${route[l.a].id} to itself`);
    if (ids.has(l.id)) problem('roads.json', `two links are ${l.id}`);
    ids.add(l.id);
    const ends = [
      [l.a, l.exitA],
      [l.b, l.exitB],
    ].map(([n, x]) => {
      const sc = S[route[n].mapId];
      return {
        place: route[n].id,
        mapId: route[n].mapId,
        sc,
        x,
        e: sc && x ? (sc.edgeExits || []).find(q => q.id === x) : null,
      };
    });
    if (l.kind === 'lift') {
      for (const [E, O] of [ends, [...ends].reverse()])
        if (!E.sc || !(E.sc.props || []).some(p => p.act === 'lift' && p.to === O.place))
          problem('roads.json', `${name}: ${E.mapId} has no lift going to ${O.place}`);
      return;
    }
    for (const E of ends) {
      if (!E.e) {
        problem('roads.json', `${name}: ${E.mapId} has no exit ${E.x} (a road that joins nothing)`);
        continue;
      }
      used.set(`${E.mapId}:${E.e.id}`, (used.get(`${E.mapId}:${E.e.id}`) || []).concat(name));
      if (!walkable(E.sc, at(E.sc, E.e)))
        problem('roads.json', `${name}: the ground at ${E.mapId}'s exit ${E.e.id} can't be walked on`);
    }
    const [A, B] = ends;
    if (!A.e || !B.e) return;
    if (OPPOSITE[A.e.side] !== B.e.side)
      problem(
        'roads.json',
        `${name}: the exits don't face each other (${A.mapId} ${A.e.side}, ${B.mapId} ${B.e.side})`
      );
    if ((A.e.width || 2) !== (B.e.width || 2))
      problem('roads.json', `${name}: the exits are ${A.e.width || 2} m and ${B.e.width || 2} m wide`);
    const d = along(A.sc, A.e) - along(B.sc, B.e);
    if (Math.abs(d - Math.round(d)) >= 0.5)
      problem('roads.json', `${name}: the exits miss each other by ${Math.abs(d - Math.round(d)).toFixed(2)} m`);
  });
  for (const r of route) {
    const sc = S[r.mapId];
    if (!sc) continue;
    const E = sc.edgeExits || [];
    for (const e of E) {
      const u = used.get(`${r.mapId}:${e.id}`) || [];
      if (u.length !== 1)
        problem(`maps/${r.mapId}.json`, `exit ${e.id} is used by ${u.length ? u.join(' and ') : 'no link'}`);
    }
    for (const side of ['N', 'S', 'E', 'W']) {
      const xs = E.filter(e => e.side === side)
        .map(e => along(sc, e))
        .sort((a, b) => a - b);
      if (xs.length > 2) problem(`maps/${r.mapId}.json`, `${xs.length} exits on its ${side} side (two at most)`);
      for (let k = 1; k < xs.length; k++)
        if (xs[k] - xs[k - 1] < 44)
          problem(
            `maps/${r.mapId}.json`,
            `two exits on its ${side} side ${(xs[k] - xs[k - 1]).toFixed(1)} m apart (44 m at least)`
          );
    }
  }
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
    RATES = ['money', 'itemShare', 'released', 'node', 'win', 'winSeals'];
  if (!pay || typeof pay !== 'object') problem('rules.json', 'run.payout missing');
  else {
    for (const k of RATES)
      if (typeof pay[k] !== 'number' || !(pay[k] >= 0)) problem('rules.json', `run.payout.${k} is not a number of 0 or more`);
    for (const k of Object.keys(pay)) if (!RATES.includes(k)) problem('rules.json', `run.payout.${k}: no such rate`);
    if (pay.itemShare > 1) problem('rules.json', 'run.payout.itemShare is more than 1 (items would pay over their price)');
    if (!Number.isInteger(pay.winSeals)) problem('rules.json', 'run.payout.winSeals is not a whole number');
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
// UI-1: the UI's look: the schema, then text and quiet text read at 4.5:1 on the ground and on a solid surface, in the
// defaults and in every preset (each with the defaults under it), on both sides
if (D.uiTheme && check('uiTheme.schema.json', D.uiTheme, 'uiTheme.json')) {
  const T = D.uiTheme;
  for (const name of ['', ...Object.keys(T.presets || {})])
    for (const side of ['light', 'dark']) {
      const pal = { ...T.defaults.color?.[side], ...(name ? T.presets[name].color?.[side] : {}) };
      for (const fg of ['text', 'text2'])
        for (const bg of ['ground', 'surface'])
          if (pal[fg] && pal[bg] && contrastRatio(pal[fg], pal[bg]) < 4.5)
            problem('uiTheme.json', `${name || 'defaults'} ${side}: ${fg} on ${bg} reads at ${contrastRatio(pal[fg], pal[bg]).toFixed(2)}:1, under 4.5`);
    }
}
// map generator MG-1: the biome recipes: the schema, then the ground letters, prop kinds and life they name
if (D.biomes && check('biomes.schema.json', D.biomes, 'biomes.json')) {
  const terr = (D.scenery && D.scenery.terrains) || {},
    props = (D.scenery && D.scenery.props) || {},
    life = (D.scenery && D.scenery.life) || {};
  for (const [b, B] of Object.entries(D.biomes)) {
    const G = B.ground;
    for (const [f, ch] of [...Object.entries(G).filter(([f]) => f !== 'patches'), ['road', B.road]])
      if (!terr[ch]) problem('biomes.json', `${b}.${f}: no terrain "${ch}" (scenery.json terrains)`);
    for (const ch of Object.keys(G.patches || {})) if (!terr[ch]) problem('biomes.json', `${b}.ground.patches: no terrain "${ch}"`);
    for (const pool of ['trees', 'shrubs', 'plants', 'rocks', 'waterPlants', 'tall'])
      for (const k of Object.keys(B[pool] || {})) if (!props[k]) problem('biomes.json', `${b}.${pool}: no prop ${k}`);
    for (const L of B.life || []) if (!life[L.k]) problem('biomes.json', `${b}.life: no animal ${L.k}`);
  }
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
