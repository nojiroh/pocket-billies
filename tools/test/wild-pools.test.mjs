// Roster track RO-1: the wild pools and the regional forms on the game's own data. Every biome has its own pool of
// real lines (a regional form in place of its base line), so a run never meets a stand-in; the starters and the
// uncommon lines are in every pool, the lines added in RO-2 where their types fit; a form is a species
// per stage with its types swapped, its regional name, its coat and its own next stage; a region's dex cuts a place's
// list (logic/wild-pool.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { data, GAME_DATA, modules, startedSave } from './setup-real.mjs';

const { SPECIES, POOLS, DEX_ORDER, COATS, standInSpecies } = data,
  { formSpeciesId, formTypes, lineSpeciesIds } = modules.forms,
  { wildPoolList } = modules['wild-pool'],
  { runMapStart } = modules['run-map'],
  { newRun } = modules['run-state'],
  { MAPGEN_VERSION } = modules.mapgen,
  { runWorldTables } = modules['run-scenes'],
  { makeBilly, coatPrefix, dexSeen, dexCaught } = modules.rules;
/* the data as read, before the game puts in its stand-ins */
const RAW = readGameData(),
  LINES = RAW.lines,
  REAL = new Set(LINES.flatMap(L => lineSpeciesIds(L))),
  lineOf = (/** @type {string} */ id) => SPECIES[id].line;

test('every biome has its own pool of real first stages; every line is met somewhere', () => {
  const met = new Set(),
    everywhere = LINES.filter(L => L.rar === 'starter' || L.rar === 'uncommon').map(L => L.id);
  assert.ok(everywhere.length >= 7, 'the starters and the uncommon lines');
  for (const [b, B] of Object.entries(RAW.biomes)) {
    const P = RAW.pools[B.pool];
    assert.ok(P, `${b}: pool ${B.pool}`);
    for (const [id, w] of P.list) {
      assert.ok(REAL.has(id), `${b}: ${id} is a real line's (or form's) species`);
      assert.ok(w > 0, `${b}: ${id} has a weight`);
      assert.equal(SPECIES[id].stage, 0, `${b}: ${id} is a first stage`);
    }
    const lines = new Set(P.list.map(([id]) => lineOf(id)));
    for (const id of everywhere) assert.ok(lines.has(id), `${b}: has ${id}, a starter or uncommon line`);
    assert.equal(lines.size, P.list.length, `${b}: a line once (base or form)`);
    lines.forEach(id => met.add(id));
  }
  assert.deepEqual([...met].sort(), LINES.map(L => L.id).sort(), 'every line is in some biome pool');
});

test('RO-2: a rare line is met less often than every common line in the same pool', () => {
  const rar = Object.fromEntries(LINES.map(L => [L.id, L.rar]));
  assert.ok(Object.values(rar).includes('common') && Object.values(rar).includes('rare'), 'common and rare lines');
  for (const B of Object.values(RAW.biomes)) {
    const w = (/** @type {string} */ r) =>
      RAW.pools[B.pool].list.filter(([id]) => rar[lineOf(id)] === r).map(([, n]) => n);
    if (w('rare').length && w('common').length)
      assert.ok(Math.max(...w('rare')) < Math.min(...w('common')), `${B.pool}: every rare below every common`);
  }
});

test('the uncommon lines are met far more often than the starters', () => {
  const rar = Object.fromEntries(LINES.map(L => [L.id, L.rar]));
  for (const B of Object.values(RAW.biomes)) {
    const w = (/** @type {string} */ r) =>
      RAW.pools[B.pool].list.filter(([id]) => rar[lineOf(id)] === r).map(([, n]) => n);
    assert.ok(Math.min(...w('uncommon')) > Math.max(...w('starter')), `${B.pool}: every uncommon above every starter`);
  }
});

test('no run place needs a stand-in: its list is its biome pool, every id the game has', () => {
  const R = GAME_DATA.rules.run,
    start = { team: [], se: 0, items: {}, pyramids: {}, trip: { node: 0, plan: [] }, wild: {}, eggs: [], flags: {} },
    world = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: POOLS,
      scenery: GAME_DATA.scenery,
      rules: R,
    };
  const seen = new Set();
  for (const seed of ['ROONE00001', 'ROONE00002', 'ROONE00003', 'ROONE00004', 'ROONE00005']) {
    const run = newRun(seed, 1, MAPGEN_VERSION, start);
    runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R });
    const W = runWorldTables(run, GAME_DATA.locations[0], world);
    run.map.nodes.forEach((node, i) => {
      const list = W.pools[W.locations[i + 1].pool].list;
      seen.add(node.biome);
      assert.deepEqual(list, RAW.pools[RAW.biomes[node.biome].pool].list, `${seed} node ${i}: its biome's pool`);
      for (const [id] of list) assert.equal(standInSpecies(id), id, `${seed} node ${i}: ${id} stands in for nothing`);
    });
  }
  assert.ok(seen.size >= 3, `several biomes met (${[...seen]})`);
});

test('a regional form: a species per stage, types swapped, the regional name, its coat, its own next stage', () => {
  const withForms = LINES.filter(L => (L.forms || []).length);
  assert.ok(withForms.length >= 4, 'four lines have a form');
  for (const L of withForms)
    for (const F of L.forms)
      L.names.forEach((n, st0) => {
        const id = formSpeciesId(L.id, F.id, st0),
          S = SPECIES[id],
          B = SPECIES[L.id + st0];
        assert.ok(S, id);
        assert.equal(S.name, `${F.name} ${n}`);
        assert.deepEqual(S.types, formTypes(B.types, F.swap));
        assert.equal(S.line, L.id);
        assert.equal(S.stage, B.stage);
        assert.equal(S.no, B.no, 'the base stage’s dex number');
        assert.deepEqual(S.base, B.base, 'the base stage’s stats');
        assert.notEqual(S.base, B.base, 'a copy of them');
        assert.equal(S.formOf, B.id);
        assert.equal(S.coat, F.coat);
        assert.ok(COATS[F.coat] && COATS[F.coat].form, `${F.coat} is a form's coat`);
        assert.equal(S.next, B.next && formSpeciesId(L.id, F.id, st0 + 1));
        assert.ok(!DEX_ORDER.includes(id), 'not a dex entry of its own');
      });
  assert.ok(
    withForms.some(L => L.forms.some(F => L.types.some(ts => formTypes(ts, F.swap).join() !== ts.join()))),
    'a swap changes a type'
  );
});

test('the four drafted forms', () => {
  const pick = (/** @type {string} */ id) => [SPECIES[id].name, SPECIES[id].types.join('/')];
  assert.deepEqual(pick('trump_waterfront1'), ['Waterfront Gildslug', 'Water/Steel']);
  assert.deepEqual(pick('zuck_cloud1'), ['Cloud Feedopus', 'Electric/Flying']);
  assert.deepEqual(pick('swift_folklore0'), ['Folklore Swiftlet', 'Grass/Psychic']);
  assert.deepEqual(pick('kardashian_festival2'), ['Festival Kardashleon', 'Psychic/Ground']);
});

test('a form Billie wears its coat, which puts no word before its name; another coat wins', () => {
  const m = makeBilly('trump_waterfront0', 5);
  assert.equal(m.coat, 'waterfront');
  assert.equal(coatPrefix(m.coat), '');
  assert.equal(makeBilly('trump0', 5).coat, undefined);
  if (COATS.midnight) {
    assert.equal(makeBilly('trump_waterfront0', 5, { coat: 'midnight' }).coat, 'midnight');
    assert.equal(coatPrefix('midnight'), COATS.midnight.name + ' ');
  }
});

test('a region’s dex cuts a place’s list; no dex, or one naming none of it, keeps it whole', () => {
  const list = RAW.pools[RAW.biomes.lake.pool].list;
  assert.deepEqual(wildPoolList(list), list);
  assert.notEqual(wildPoolList(list), list, 'a copy');
  assert.deepEqual(wildPoolList(list, ['zuck0', 'trump_waterfront0', 'nobody0']), [
    ['trump_waterfront0', 28],
    ['zuck0', 26],
  ]);
  assert.deepEqual(wildPoolList(list, ['nobody0']), list);
  assert.deepEqual(wildPoolList(list, []), list);
});

test('the dex counts a base stage as seen or caught when one of its forms is; a form has no entry of its own', () => {
  const s = startedSave('musk0', 5);
  assert.deepEqual(data.SPECIES_FORMS.trump0, ['trump_waterfront0']);
  assert.ok(!dexSeen('trump0') && !dexCaught('trump0'));
  s.seen.trump_waterfront0 = 1;
  assert.ok(dexSeen('trump0') && !dexCaught('trump0'));
  s.caught.trump_waterfront0 = 1;
  assert.ok(dexCaught('trump0'));
  assert.ok(!dexSeen('trump1'), 'only its own stage');
});

test("RL-R1: a region's swap meets a line in the region's variety, a species once, its weights summed", () => {
  const list = [
    ['trump_waterfront0', 20],
    ['zuck0', 10],
    ['zuck_cloud0', 5],
    ['musk0', 3],
  ];
  assert.deepEqual(wildPoolList(list, null, { trump_waterfront0: 'trump0', zuck_cloud0: 'zuck0' }), [
    ['trump0', 20],
    ['zuck0', 15],
    ['musk0', 3],
  ]);
  assert.deepEqual(wildPoolList(list, ['trump0', 'zuck0'], { trump_waterfront0: 'trump0' }), [
    ['trump0', 20],
    ['zuck0', 10],
  ]);
  assert.deepEqual(list[0], ['trump_waterfront0', 20], 'the pool is not changed');
});
