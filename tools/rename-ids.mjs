// Phase 05, one-off: the location ids match their names. Made for the commit after a97f947 (the data keys renamed);
// kept so the change can be read, re-run on that commit and checked.
//
//   node tools/rename-ids.mjs map                  the id map: old id -> new id, the location's name
//   node tools/rename-ids.mjs apply [--dry]        renames: the data, the map files, the art named by an id, the code
//                                                  (the game's and the Studio's scripts then go through Prettier);
//                                                  --dry: prints every changed line, writes nothing (--counts: lists
//                                                  every rule whose number of changes is not the expected one)
//   node tools/rename-ids.mjs verify [--base <rev>]  the proof, for the staged tree (git add -A first) against <rev>
//                                                  (default HEAD); exits 1 on any problem
//   node tools/rename-ids.mjs baseline [<dir>]     renames the quick check's baseline pictures named by an id
//                                                  (default validation/quick-baseline), so they compare again
//
// A location's id is also its map's id (maps/<id>.json, gameData.maps.<id>), the id of its wild pool and its shop where
// those are named by it, and the name of its map miniature, postcard and flag (art/map/mini/<id>.png,
// art/postcards/<id>.webp, art/scene/flags/<id>.png). The new id is the location's name: a town or city without
// "Town"/"City" (marigold), any other place its own word (willowmere, kitewind), or its whole name when that word alone
// is an everyday word or already a name in the game (stepstone_canyon; tallgrass_meadow, since tallgrass is the tall
// grass prop). Ids that already say the name stay (thicket, badlands, innersun, copperleaf, hedgerow, pearlantis).
// Rooms keep int_, tests test_; the one room id holding a renamed location's old id follows it.
//
// What is NOT an id and stays: a location's t, biome and mood, battle stage ids (golf, grotto, mall, volcano, lake are
// stages shared by several places), prop tags, far backdrops, water kinds, the look presets of the engine, the title
// picture art/background/sundown.*, and words in text.
//
// verify proves, for the staged tree:
//   data: the old data with every string and key equal to an old id renamed (but at the paths listed in NOT_IDS) and
//         the two composite ids (road:<a>-<b>, location:<id>) renamed equals the new data, key order included. This is
//         worked out independently of apply's list of id paths (renameData): the two lists must agree. No new id was
//         in use anywhere in the old data;
//   files: the data files and the art only moved by the map (art byte for byte); the one file added is this tool;
//   code: every other changed file differs only in tokens (white space aside), each an old id that became its new id
//         (plus the few changes in EXTRA); it prints every changed line, and the quoted old ids left in the code (none
//         of them an id).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as prettier from 'prettier';
import { DATA, PB_DATA, readGameData, writeFile } from './data-files.mjs';

const ROOT = join(import.meta.dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

// old id -> [new id, the location's name]
const LOCATIONS = {
  sundown: ['marigold', 'Marigold Town'],
  longgrass: ['tallgrass_meadow', 'Tallgrass Meadow'],
  golf: ['old_fairway', 'Old Fairway'],
  grotto: ['fizzwell', 'Fizzwell Town'],
  canyon: ['stepstone_canyon', 'Stepstone Canyon'],
  scrapyard: ['rustgear', 'Rustgear Yard'],
  foodcourt: ['pepperpot', 'Pepperpot Town'],
  mall: ['lanternhall', 'Lanternhall City'],
  pond: ['willowmere', 'Willowmere'],
  farm: ['clovercrest', 'Clovercrest Town'],
  ridge: ['kitewind', 'Kitewind Ridge'],
  city: ['verdigris', 'Verdigris City'],
  offshore: ['driftwreck', 'Driftwreck Bay'],
  taxhaven: ['palmhaven', 'Palmhaven Town'],
  volcano: ['cinderpeak', 'Mt. Cinderpeak'],
  pass: ['hornpass', 'Hornpass'],
  summit: ['frostcrown', 'Frostcrown Town'],
  lake: ['mirrormere', 'Mirrormere Lake'],
  festival: ['fanfare_fields', 'Fanfare Fields'],
  twofold: ['twinpetal', 'Twinpetal Town'],
  blossom: ['petalfall', 'Petalfall Vale'],
  margins: ['rootwater', 'Rootwater Marsh'],
  vintage: ['grapevine_hills', 'Grapevine Hills'],
  bullion: ['goldvine', 'Goldvine Town'],
  flattax: ['saltpan_flats', 'Saltpan Flats'],
  sporewood: ['puffcap', 'Puffcap Woods'],
  marketcap: ['capshade', 'Capshade Town'],
  fallquarter: ['russetwood', 'Russetwood'],
  hypergrowth: ['tanglewild', 'Tanglewild Jungle'],
  spread: ['prism_chasm', 'Prism Chasm'],
  mintshaft: ['glimmershaft', 'Glimmershaft Town'],
  darkpool: ['gloomwater', 'Gloomwater Pool'],
  frozen: ['rimefrost', 'Rimefrost Caves'],
  shoals: ['conchshell', 'Conchshell Shoals'],
  portfolio: ['kelpport', 'Kelpport City'],
  bottomline: ['abyssal_trench', 'Abyssal Trench'],
  pressing: ['vinyl_works', 'Vinyl Works'],
  serverfarm: ['circuit_terraces', 'Circuit Terraces'],
  upside: ['nimbus', 'Nimbus City'],
  bubbleland: ['fizzpop', 'Fizzpop Fair'],
  bracket: ['skygarden', 'Skygarden Walk'],
  ath: ['zenith_steps', 'Zenith Steps'],
  closingbell: ['bellwether_rise', 'Bellwether Rise'],
};
// rooms whose id holds a renamed location's old id (Inside Twinpetal Market)
const ROOMS = { int_twofold_market: ['int_twinpetal_market', 'Inside Twinpetal Market'] };
const MAP = new Map(Object.entries({ ...LOCATIONS, ...ROOMS }).map(([a, [b]]) => [a, b]));
const ID = /^[a-z0-9_]+$/;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = ids =>
  [...ids]
    .sort((a, b) => b.length - a.length)
    .map(esc)
    .join('|');
// an id as a token: not inside a longer [A-Za-z0-9_] run (w:sundown*, road:a-b, postcards/sundown.webp, maps.sundown)
const tokenRe = ids => new RegExp(`(?<![A-Za-z0-9_])(?:${alt(ids)})(?![A-Za-z0-9_])`, 'g');
const mapTokens = (s, ids = MAP.keys()) => s.replace(tokenRe(ids), m => MAP.get(m));

// ------------------------------------------------------------------------------------------------------------ data
// where the data holds a location or map id (apply's list; verify works it out the other way round, from NOT_IDS)
function renameData(D) {
  const id = v => (typeof v === 'string' && MAP.has(v) ? MAP.get(v) : v);
  const keys = o => {
    if (!o || typeof o !== 'object') return;
    const r = Object.fromEntries(Object.entries(o).map(([k, v]) => [MAP.has(k) ? MAP.get(k) : k, v]));
    if (Object.keys(r).length !== Object.keys(o).length) throw new Error('two keys became one');
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, r);
  };
  for (const r of D.locations)
    for (const k of ['id', 'mapId', 'lift', 'pool', 'shop', 'boutique']) if (k in r) r[k] = id(r[k]);
  keys(D.maps);
  for (const sc of Object.values(D.maps)) {
    if ('locationId' in sc) sc.locationId = id(sc.locationId);
    for (const p of sc.props || [])
      for (const k of ['room', 'to', 'shop']) if (typeof p[k] === 'string') p[k] = id(p[k]);
  }
  for (const L of D.roads) {
    const J = L[3];
    if (!J) continue;
    J.from = id(J.from);
    J.to = id(J.to);
    if (J.id) J.id = J.id.replace(/^road:([a-z0-9_]+)-([a-z0-9_]+)$/, (m, a, b) => `road:${id(a)}-${id(b)}`);
  }
  keys(D.pools);
  keys(D.shops);
  const lore = D.lore || {};
  keys(lore.locations);
  keys(lore.chat);
  for (const g of lore.legends || []) {
    g.locationId = id(g.locationId);
    if (typeof g.unlock === 'string') g.unlock = g.unlock.replace(/^location:(.*)$/, (m, a) => `location:${id(a)}`);
  }
  for (const c of lore.clues || []) if (c.at) c.at.scene = id(c.at.scene);
  const rules = D.rules || {};
  if (rules.start) rules.start.locationId = id(rules.start.locationId);
  for (const g of rules.legends || []) g.scene = id(g.scene);
  if (D.scenery && Array.isArray(D.scenery.flags)) D.scenery.flags = D.scenery.flags.map(id);
  return D;
}

// the paths where a string or key equal to an old id is something else (verify's list)
const NOT_IDS = {
  values: [
    /^\.locations\[\d+\]\.(t|biome|battleStage|mood)$/, // the ground type, biome, battle stage and colour mood
    /^\.trainers\.[^.]+\.battleStage$/,
    /^\.battleStages\.[^.]+\.(wall|art|far)$/,
    /^\.scenery\.props\.[^.]+\.tags\[\d+\]$/, // where a prop grows
    /^\.scenery\.life\.[^.]+\.where$/,
    /^\.maps\.[^.]+\.(far|waterKind|biome)$/,
    /^\.maps\.[^.]+\.shots\[\d+\]\.label$/, // a test picture's name
    /^\.maps\.[^.]+\.waters\[\d+\]\.k$/, // a kind of water
  ],
  keys: [
    /^\.battleStages$/,
    /^\.moods$/,
    /^\.fishing$/, // by kind of water
    /^\.moves\.[^.]+\.fx$/, // spread: a move that hits every foe
    /^\.maps\.[^.]+\.(a04park|lab|stations)$/,
  ],
  // ids inside a string: a road's id and a legend's unlock
  composite: [/^\.roads\[\d+\]\[3\]\.id$/, /^\.lore\.legends\[\d+\]\.unlock$/],
};
function renameDataByComplement(D) {
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (MAP.has(v) && !NOT_IDS.values.some(r => r.test(path))) return MAP.get(v);
      if (NOT_IDS.composite.some(r => r.test(path))) return mapTokens(v);
      return v;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === 'object') {
      const out = {},
        renameKeys = !NOT_IDS.keys.some(r => r.test(path));
      for (const [k, x] of Object.entries(v)) {
        const k2 = renameKeys && MAP.has(k) ? MAP.get(k) : k;
        if (k2 in out) throw new Error(`${path}: two keys became ${k2}`);
        out[k2] = walk(x, `${path}.${k2}`);
      }
      return out;
    }
    return v;
  };
  return walk(D, '');
}

// writes the data as the Studio does: only the files that changed, and removes the files of what is gone
function saveData(D) {
  const { index, files } = PB_DATA.split(D);
  const texts = { 'index.json': PB_DATA.text(index) };
  for (const [p, v] of Object.entries(files)) texts[p] = PB_DATA.text(v);
  const out = [];
  for (const [p, t] of Object.entries(texts)) {
    const f = join(DATA, p);
    if (existsSync(f) && readFileSync(f, 'utf8') === t) continue;
    writeFile(p, t);
    out.push(`wrote ${p}`);
  }
  for (const dir of readdirSync(DATA, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'schema'))
    for (const f of readdirSync(join(DATA, dir.name)))
      if (f.endsWith('.json') && !(`${dir.name}/${f}` in texts)) {
        unlinkSync(join(DATA, dir.name, f));
        out.push(`removed ${dir.name}/${f}`);
      }
  return out;
}

// ------------------------------------------------------------------------------------------------------------- art
// art named by a location's id: [folder, extension]
const ART = [
  ['game/art/map/mini', '.png'],
  ['game/art/postcards', '.webp'],
  ['game/art/scene/flags', '.png'],
];
function artMoves() {
  const out = [];
  for (const [dir, ext] of ART)
    for (const [a, b] of MAP)
      if (existsSync(join(ROOT, dir, a + ext))) {
        if (existsSync(join(ROOT, dir, b + ext))) throw new Error(`${dir}/${b}${ext} exists`);
        out.push([`${dir}/${a}${ext}`, `${dir}/${b}${ext}`]);
      }
  return out;
}

// ------------------------------------------------------------------------------------------------------------ code
// every place the code names a location or map id, and nothing else. Each rule says how many changes it makes.
//   quoted: every string that is exactly an old id ('x', "x" or `x`), but inside what an `except` pattern matches
//   strings: these quoted strings, the ids inside them renamed (labels and paths named by a map)
//   snip: this text (`count` times), the ids inside it renamed (or `replace`, where a change is not a renamed token)
//   tokens: every token of these ids in the file (where each one is the id)
//   block: every id token between `from` and the first `to` after it
const ALL = 'all';
const CODE = [
  // the game
  { file: 'game/js/self-test.js', tokens: ['sundown', 'longgrass', 'grotto'], n: 18 },
  // musicFor: the map ids holding mall or food were mall and foodcourt
  { file: 'game/js/sound.js', snip: '/mall|food/.test(id', replace: '/lanternhall|pepperpot/.test(id', count: 2 },
  { file: 'game/js/sound.js', snip: "id === 'city'", n: 1 },
  { file: 'game/js/walk/ground-draw.js', block: { from: 'const FLOWER_SET_BY_LOCATION = {', to: '};' }, n: 15 },
  // the checks
  {
    file: 'tools/check-quick.py',
    quoted: ALL,
    except: [/fl\['ridge'\]/g, /lab\['ridge'\]/g],
    n: 41,
  },
  { file: 'tools/check-quick.py', snip: '--scenes=city,pond', n: 2 },
  { file: 'tools/check-quick.py', snip: 'road:sundown-hedgerow', n: 1 },
  {
    file: 'tools/check-quick.py',
    strings: [
      'sundown-stairs',
      'city-canal',
      'city-stairs',
      'ridge-bridge',
      'pond-falls',
      'mall-escalators',
      'grotto-cascade',
      'canyon-arch',
      'life-pond',
      'v34-city',
      'v37-sundown',
      'a02-terrace-pass',
      'scene/flags/sundown.png',
      'w:sundown*',
    ],
    n: 15,
  },
  { file: 'tools/check-quick.py', snip: "startsWith('w:longgrass')", n: 1 },
  { file: 'tools/check-quick.py', snip: 'gameData.maps.ridge.props', n: 1 },
  { file: 'tools/check-quick.py', snip: 'flagPicturePath(gameData.maps.sundown)', n: 1 },
  { file: 'tools/check-quick.py', snip: 'flagPicturePath(gameData.maps.longgrass)', n: 1 },
  { file: 'tools/check-quick.py', snip: 'LOCATION_BY_ID.sundown.node', count: 5, n: 5 },
  { file: 'tools/check-quick.py', snip: '?test=1&scene=pond', n: 1 },
  { file: 'tools/check-quick.py', snip: 'gameData.maps.pond.props', n: 1 },
  { file: 'tools/check-game.py', quoted: ALL, except: [/\['grass', 'mall'\]/g], n: 2 },
  {
    file: 'tools/check-game.py',
    strings: [
      'sundown-stairs',
      'city-canal',
      'city-stairs',
      'ridge-bridge',
      'pond-falls',
      'mall-escalators',
      'grotto-cascade',
      'canyon-arch',
    ],
    n: 8,
  },
  // the alpha 0.4 rename of the places (its tables are keyed by id; the old-name check reads OLD and NEEDS_THE)
  { file: 'tools/rename-places.py', quoted: ALL, n: 87 },
  {
    file: 'tools/rename-places.py',
    strings: ['lore/locations/city/known', 'lore/chat/marketcap/0/4', 'locations/canyon/gateText'],
    n: 3,
  },
  // the build tools that read or write a map by its id
  { file: 'tools/build-airship.py', snip: "D['maps'].get('city')", n: 1 },
  { file: 'tools/build-flags.py', block: { from: 'TOWNS = dict(', to: 'default=' }, n: 6 },
  { file: 'tools/build-flags.py', snip: "if name in ('sundown', 'farm', 'lake')", n: 3 },
  { file: 'tools/build-interiors.py', tokens: ['int_twofold_market'], n: 3 },
  { file: 'tools/legacy/build-landmarks-v47.py', quoted: ALL, except: [/\['canyon', 'route'\]/g], n: 12 },
  { file: 'tools/legacy/build-life-v47.py', quoted: ALL, except: [/sc\.get\('biome'\) == 'city'/g], n: 4 },
  { file: 'tools/legacy/build-life-v47.py', snip: 'legacy/build-life-v47.py sundown', n: 1 },
  { file: 'tools/build-map-minis.py', snip: 'build-map-minis.py city sundown', n: 2 },
  { file: 'tools/legacy/build-places-v46.py', quoted: ALL, n: 57 },
  { file: 'tools/legacy/build-places-v46.py', snip: 'legacy/build-places-v46.py sundown farm', n: 2 },
  { file: 'tools/build-postcards.py', quoted: ALL, n: 14 },
  { file: 'tools/build-postcards.py', snip: 'build-postcards.py city sundown', n: 2 },
  {
    file: 'tools/legacy/build-regions-v47.py',
    quoted: ALL,
    except: [/\b(far|biome|area|waterKind|mood)='[a-z_]+'/g, /'battleStage': '[a-z_]+'/g],
    n: 334,
  },
  {
    file: 'tools/build-scenes.py',
    quoted: ALL,
    except: [/\b(far|waterKind)='[a-z_]+'/g, /\('Mall floor', 'mall'/g],
    n: 36,
  },
  {
    file: 'tools/build-solarpunk.py',
    quoted: ALL,
    except: [/\['(town|cave)'[^\]]*\]/g, /'pond': \[/g],
    n: 15,
  },
  { file: 'tools/build-solarpunk.py', strings: ['city: the park would go at x 11-58, z 26-39'], n: 1 },
  { file: 'tools/legacy/build-v28.py', quoted: ALL, n: 6 },
  { file: 'tools/legacy/build-v28.py', strings: ['sundown: your house at'], n: 1 },
  { file: 'tools/fix-marigold-stream.py', quoted: ALL, n: 2 },
  { file: 'tools/grow-wild.py', snip: 'grow-wild.py longgrass pond', n: 2 },
  { file: 'tools/migrate-places.py', snip: "'road:sundown-longgrass', 'Route 1', 'sundown', 'longgrass'", n: 4 },
];
// changes verify accepts that are not an old id becoming its new one
const EXTRA = [['game/js/sound.js', 'food', 'pepperpot', 2]];

function applyRule(text, r) {
  let n = 0;
  const sub = (s, ids) =>
    s.replace(tokenRe(ids || MAP.keys()), m => {
      n++;
      return MAP.get(m);
    });
  if (r.tokens) text = sub(text, r.tokens);
  else if (r.block) {
    const a = text.indexOf(r.block.from),
      b = a < 0 ? -1 : text.indexOf(r.block.to, a + r.block.from.length);
    if (a < 0 || b < 0 || text.indexOf(r.block.from, a + 1) >= 0)
      throw new Error(`${r.file}: no one block ${r.block.from}`);
    text = text.slice(0, a) + sub(text.slice(a, b)) + text.slice(b);
  } else if (r.snip) {
    const parts = text.split(r.snip);
    if (parts.length - 1 !== (r.count || 1))
      throw new Error(`${r.file}: "${r.snip}" found ${parts.length - 1} times, want ${r.count || 1}`);
    const rep = r.replace ?? sub(r.snip);
    if (r.replace) n = r.count || 1;
    else n *= r.count || 1;
    text = parts.join(rep);
  } else if (r.strings) {
    const re = new RegExp(`(['"\`])(${alt(r.strings)})\\1`, 'g');
    text = text.replace(re, (m, q, s) => q + sub(s) + q);
  } else if (r.quoted) {
    const ids = r.quoted === ALL ? [...MAP.keys()] : r.quoted;
    const held = [];
    for (const e of r.except || []) for (const m of text.matchAll(e)) held.push([m.index, m.index + m[0].length]);
    const re = new RegExp(`(['"\`])(${alt(ids)})\\1`, 'g');
    text = text.replace(re, (m, q, s, at) => {
      if (held.some(([a, b]) => at < b && at + m.length > a)) return m;
      n++;
      return q + MAP.get(s) + q;
    });
  }
  if (r.n != null && n !== r.n) {
    const msg = `${r.file}: ${n} changes, want ${r.n} (${JSON.stringify(r).slice(0, 120)})`;
    if (!process.argv.includes('--counts')) throw new Error(msg);
    console.log(msg);
  }
  return text;
}

function changedLines(file, a, b) {
  const x = a.split('\n'),
    y = b.split('\n'),
    out = [];
  if (x.length !== y.length) throw new Error(`${file}: the number of lines changed`);
  for (let i = 0; i < x.length; i++)
    if (x[i] !== y[i])
      out.push(`  ${file}:${i + 1}\n    - ${x[i].trim().slice(0, 200)}\n    + ${y[i].trim().slice(0, 200)}`);
  return out;
}

// --------------------------------------------------------------------------------------------------------- commands
async function apply(dry) {
  const report = [];
  // the data
  const D = renameData(readGameData());
  const check = renameDataByComplement(readGameData());
  if (JSON.stringify(D) !== JSON.stringify(check))
    throw new Error('the two lists of id paths disagree (renameData vs NOT_IDS)');
  // the code
  const texts = new Map();
  for (const r of CODE) {
    const t0 = texts.get(r.file) ?? readFileSync(join(ROOT, r.file), 'utf8');
    texts.set(r.file, applyRule(t0, r));
  }
  for (const [f, t] of texts) report.push(...changedLines(f, readFileSync(join(ROOT, f), 'utf8'), t));
  const moves = artMoves();
  if (dry) {
    console.log(report.join('\n'));
    console.log(`${texts.size} code files; ${moves.length} art files to move; data checked (both lists agree)`);
    return;
  }
  for (const [f, t] of texts) {
    // the game's and the Studio's scripts are kept in Prettier's style (a longer id can wrap a line)
    const opts = /^(game|studio)\/.*\.js$/.test(f) && { ...(await prettier.resolveConfig(join(ROOT, f))), filepath: f };
    writeFileSync(join(ROOT, f), opts ? await prettier.format(t, opts) : t);
  }
  for (const [a, b] of moves) git('mv', a, b);
  const w = saveData(D);
  console.log(`${texts.size} code files, ${moves.length} art files moved, data: ${w.length} files written or removed`);
}

function dataAt(rev) {
  const read = p => JSON.parse(git('show', `${rev}:game/data/${p}`));
  return PB_DATA.assemble(read('index.json'), read);
}

function verify(base) {
  const problems = [],
    notes = [];
  // the map: one to one, plain ids, none of them in use before
  const news = [...MAP.values()];
  if (new Set(news).size !== news.length) problems.push('two old ids become the same new id');
  for (const [a, b] of MAP) if (!ID.test(b) || MAP.has(b)) problems.push(`bad new id ${a} -> ${b}`);
  const old = dataAt(base),
    now = dataAt('');
  const seen = new Map();
  const count = v => {
    if (typeof v === 'string') seen.set(v, (seen.get(v) || 0) + 1);
    else if (Array.isArray(v)) v.forEach(count);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        seen.set(k, (seen.get(k) || 0) + 1);
        count(x);
      }
  };
  count(old);
  for (const b of news) if (seen.get(b)) problems.push(`${b} was already used in the data (${seen.get(b)} times)`);
  // the data
  const mapped = renameDataByComplement(old);
  if (JSON.stringify(mapped) !== JSON.stringify(now)) {
    const flat = (v, p, out) => {
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flat(x, `${p}.${k}`, out);
      else out.set(p, JSON.stringify(v));
      return out;
    };
    const A = flat(mapped, '', new Map()),
      B = flat(now, '', new Map());
    const diff = [...new Set([...A.keys(), ...B.keys()])].filter(k => A.get(k) !== B.get(k));
    problems.push(
      `the data differs from ${base} with the id map applied, at ${diff.length} paths: ${diff.slice(0, 6).join(', ')}`
    );
  } else notes.push(`data: equal to ${base} with the id map applied (key order included)`);
  if (JSON.stringify(renameData(dataAt(base))) !== JSON.stringify(now)) problems.push('apply would make other data');
  const left = new Map();
  const walk = (v, p) => {
    if (typeof v === 'string') {
      if (MAP.has(v))
        left.set(
          p
            .replace(/\[\d+\]/g, '[]')
            .replace(/^\.(maps|trainers|battleStages|scenery\.props|scenery\.life)\.[^.]+/, '.$1.*'),
          v
        );
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  walk(now, '');
  notes.push(`data: strings still equal to an old id (not ids): ${[...new Set(left.keys())].join(', ')}`);
  // the files
  const rows = git('diff', '--cached', '-M', '--name-status', base)
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('\t'));
  const stem = p => p.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  const code = [];
  let moved = 0,
    data = 0;
  for (const [st, a, b = a] of rows) {
    if (a.startsWith('game/data/')) {
      data++;
      if (st[0] === 'R' && !(a.replace(/[^/]*$/, '') === b.replace(/[^/]*$/, '') && MAP.get(stem(a)) === stem(b)))
        problems.push(`${a} -> ${b}: not a move by the map`);
      else if (st[0] !== 'R' && st !== 'M') problems.push(`${st} ${a}: a data file added or removed`);
    } else if (a.startsWith('game/art/')) {
      if (st !== 'R100' || MAP.get(stem(a)) !== stem(b) || a.replace(/[^/]*$/, '') !== b.replace(/[^/]*$/, ''))
        problems.push(`${st} ${a} -> ${b}: art changed, not moved by the map`);
      else moved++;
    } else if (st === 'A' && a === 'tools/rename-ids.mjs') continue;
    else if (st !== 'M') problems.push(`${st} ${a}: a file added, removed or moved`);
    else code.push(a);
  }
  notes.push(`files: ${data} data files changed or moved by the map, ${moved} art files moved byte for byte`);
  // the code: tokens
  const extra = new Map(EXTRA.map(([f, a, b, n]) => [`${f} ${a} ${b}`, n]));
  const lines = [];
  for (const f of code) {
    const x = git('show', `${base}:${f}`),
      y = git('show', `:${f}`);
    // words and single characters; white space aside (Prettier may wrap a line that a longer id made too long)
    const tok = s => s.match(/[A-Za-z0-9_]+|[^A-Za-z0-9_\s]/g) || [];
    const [tx, ty] = [tok(x), tok(y)];
    if (tx.length !== ty.length) {
      problems.push(`${f}: a different number of tokens`);
      continue;
    }
    const by = new Map();
    for (let i = 0; i < tx.length; i++)
      if (tx[i] !== ty[i]) {
        const k = `${tx[i]} ${ty[i]}`;
        by.set(k, (by.get(k) || 0) + 1);
      }
    for (const [k, n] of by) {
      const [a, b] = k.split(' ');
      if (MAP.get(a) === b) continue;
      if (extra.get(`${f} ${k}`) === n) continue;
      problems.push(`${f}: ${a} -> ${b} (${n}x) is not the id map`);
    }
    lines.push(`${f}: ${[...by].map(([k, n]) => `${k.replace(' ', ' -> ')}${n > 1 ? ' x' + n : ''}`).join(', ')}`);
    lines.push(
      ...git('diff', '--cached', '-U0', base, '--', f)
        .split('\n')
        .filter(l => /^[-+]/.test(l) && !/^(---|\+\+\+) /.test(l))
        .map(l => `    ${l[0]} ${l.slice(1).trim().slice(0, 200)}`)
    );
  }
  // the quoted old ids left in the code (each is something else: a battle stage, a biome, a tag, a far backdrop...)
  const leftCode = new Map();
  const files = git('ls-files', 'game/js', 'studio/js', 'tools')
    .split('\n')
    .filter(f => /\.(m?js|py)$/.test(f) && f !== 'tools/rename-ids.mjs');
  const qre = new RegExp(`(['"\`])(${alt(MAP.keys())})\\1`, 'g');
  for (const f of files) {
    const t = readFileSync(join(ROOT, f), 'utf8');
    for (const m of t.matchAll(qre)) {
      const k = `${f}`;
      if (!leftCode.has(k)) leftCode.set(k, new Map());
      leftCode.get(k).set(m[2], (leftCode.get(k).get(m[2]) || 0) + 1);
    }
  }
  console.log('code: every changed token is an old id that became its new id\n' + lines.join('\n'));
  console.log(
    'code: quoted old ids left (not ids):\n' +
      [...leftCode]
        .map(([f, m]) => `  ${f}: ${[...m].map(([k, n]) => (n > 1 ? `${k} x${n}` : k)).join(', ')}`)
        .join('\n')
  );
  console.log(notes.join('\n'));
  if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`verified: ${MAP.size} ids, ${code.length} code files`);
}

// the quick check's pictures named by a map id: scene-w:<id>* (every walk scene) and the ones named in the checks
const CLOSEUPS = ['sundown-stairs', 'city-canal', 'city-stairs', 'ridge-bridge', 'pond-falls', 'mall-escalators'];
const PICTURES = {
  'life-pond': 'life-willowmere',
  'v34-city': 'v34-verdigris',
  'v37-sundown': 'v37-marigold',
  'a02-terrace-pass': 'a02-terrace-hornpass',
  ...Object.fromEntries(
    [...CLOSEUPS, 'grotto-cascade', 'canyon-arch'].map(l => [`closeup-${l}`, `closeup-${mapTokens(l)}`])
  ),
};
function baseline(dir) {
  let n = 0;
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(scene-w:)([a-z0-9_]+)(\*\.webp)$/),
      s = f.replace(/\.webp$/, '');
    const to = m && MAP.has(m[2]) ? m[1] + MAP.get(m[2]) + m[3] : PICTURES[s] ? PICTURES[s] + '.webp' : null;
    if (!to) continue;
    renameSync(join(dir, f), join(dir, to));
    n++;
  }
  console.log(`${n} pictures renamed in ${dir}`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'map')
    for (const [a, [b, name]] of Object.entries({ ...LOCATIONS, ...ROOMS })) console.log(`${a} -> ${b} (${name})`);
  else if (cmd === 'apply') await apply(rest.includes('--dry'));
  else if (cmd === 'verify') verify(rest.includes('--base') ? rest[rest.indexOf('--base') + 1] : 'HEAD');
  else if (cmd === 'baseline') baseline(rest[0] || join(ROOT, 'validation', 'quick-baseline'));
  else throw new Error('usage: node tools/rename-ids.mjs map|apply [--dry]|verify [--base <rev>]|baseline [<dir>]');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
