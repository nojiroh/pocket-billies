// RL-R1: a run's region (game/js/logic/run-region.js) on the tests' own small tables: the same seed makes the same
// region; the zones walk the biome graph over open biomes only, as many as the Expedition says, their rows in range
// (or fitted to a map's given rows); the dex is whole lines, each in one variety, within its size, with every other
// variety swapped to it; the leaders lean to the theme's types; the name is built from its parts.
// run-region-real.test.mjs runs it on the game's data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  runRegionMake,
  runRegionName,
  runRegionThemes,
  runRegionZoneCount,
  runZoneOf,
} from '../../game/js/logic/run-region.js';

const REGIONS = {
  zones: [3, 3, 4, 4, 5],
  rows: [2, 3],
  dex: [6, 9],
  graph: {
    meadow: { lake: 2, thicket: 1 },
    lake: { meadow: 1, thicket: 2 },
    thicket: { meadow: 2, lake: 1, ridge: 1 },
    ridge: { thicket: 1 },
  },
  themes: {
    wet: {
      name: 'Wet',
      start: { lake: 1 },
      biomes: { lake: 3, meadow: 1, thicket: 1 },
      types: { Water: 3, Grass: 1 },
      ends: ['mere'],
      nouns: ['Shores'],
    },
    high: { name: 'High', start: { ridge: 1 }, biomes: { ridge: 3, thicket: 1 }, types: { Rock: 3 } },
  },
  names: { parts: ['Pending', 'Beta', 'Spare Parts'], ends: ['vale'], nouns: ['Basin'], joined: 0.5 },
};
const LINES = [
  { id: 'aqua', names: ['A0', 'A1', 'A2'], types: [['Water'], ['Water'], ['Water']] },
  { id: 'leaf', names: ['L0', 'L1'], types: [['Grass'], ['Grass']] },
  {
    id: 'rock',
    names: ['R0', 'R1', 'R2'],
    types: [['Rock'], ['Rock'], ['Rock']],
    forms: [{ id: 'tide', swap: { Rock: 'Water' } }],
  },
  { id: 'fire', names: ['F0', 'F1'], types: [['Fire'], ['Fire']] },
  { id: 'big', names: ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'], types: [['Fire']] },
];
const LEADERS = [
  { id: 'gill', type: 'Water' },
  { id: 'moss', type: 'Grass' },
  { id: 'cobble', type: 'Rock' },
  { id: 'ember', type: 'Fire' },
];
const DATA = { regions: REGIONS, lines: LINES, leaders: LEADERS };
const ALL = ['meadow', 'lake', 'thicket', 'ridge'];
const seeds = n => Array.from({ length: n }, (_, k) => `RR${k.toString(36).toUpperCase()}SEED`);
const make = (seed, o = {}) => runRegionMake(seed, DATA, { open: ALL, guards: 2, ...o });

test('the same seed makes the same region; other seeds make others', () => {
  const a = make('RLR1SEED');
  assert.deepEqual(make('RLR1SEED'), a);
  const all = seeds(60).map(s => JSON.stringify(make(s)));
  assert.ok(new Set(all).size >= 40, `${new Set(all).size} regions from 60 seeds`);
});

test('a theme rolls only with its start biome and one more of its biomes open', () => {
  assert.deepEqual(runRegionThemes(REGIONS, ALL), { wet: 1, high: 1 });
  assert.deepEqual(runRegionThemes(REGIONS, ['meadow', 'lake', 'thicket']), { wet: 1 });
  assert.deepEqual(runRegionThemes(REGIONS, ['ridge']), {});
  assert.equal(runRegionMake('X', DATA, { open: ['ridge'], guards: 2 }), null);
  for (const s of seeds(40)) assert.equal(make(s, { open: ['meadow', 'lake', 'thicket'] }).theme, 'wet');
});

test('the zones: as many as the Expedition says, rows in range, open biomes only, each next one from the graph', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 9].map(t => runRegionZoneCount(REGIONS, t)),
    [3, 3, 4, 4, 5, 5, 5]
  );
  for (const tier of [1, 3, 5])
    for (const s of seeds(100)) {
      const open = s.charCodeAt(2) % 2 ? ALL : ['meadow', 'lake', 'thicket'],
        G = make(s, { tier, open });
      assert.equal(G.zones.length, runRegionZoneCount(REGIONS, tier), s);
      for (const [k, z] of G.zones.entries()) {
        assert.ok(z.rows >= 2 && z.rows <= 3, `${s}: zone ${k} has ${z.rows} rows`);
        assert.ok(open.includes(z.biome), `${s}: ${z.biome} is open`);
        if (k === 0) assert.ok(REGIONS.themes[G.theme].start[z.biome] > 0, `${s}: starts on a start biome`);
        else {
          const prev = G.zones[k - 1].biome;
          assert.notEqual(z.biome, prev, `${s}: zone ${k} changes biome`);
          assert.ok(REGIONS.graph[prev][z.biome] > 0, `${s}: ${prev} -> ${z.biome} is in the graph`);
        }
      }
    }
});

test("a map's given rows: as many zones as fit them, the rows all used", () => {
  for (const rows of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const G = make('FIT', { rows }),
      sum = G.zones.reduce((n, z) => n + z.rows, 0);
    assert.equal(sum, rows, `${rows} rows`);
    assert.ok(G.zones.length <= 3, `${rows} rows: at most the Expedition's zones`);
    if (rows >= 4)
      assert.ok(
        G.zones.every(z => z.rows >= 2),
        `${rows} rows: every zone two rows or more`
      );
  }
  assert.deepEqual(
    make('FIT', { rows: 5 }).zones.map(z => z.rows),
    [3, 2]
  );
});

test("the zone of a map's row", () => {
  const zones = [{ rows: 3 }, { rows: 2 }, { rows: 3 }];
  assert.deepEqual(
    Array.from({ length: 10 }, (_, r) => runZoneOf(zones, r)),
    [0, 0, 0, 1, 1, 2, 2, 2, 2, 2]
  );
});

test("the dex: whole lines in one variety each, within its size, every other variety swapped to the region's", () => {
  for (const s of seeds(150)) {
    const G = make(s),
      lines = LINES.filter(L => G.dex.includes(L.id + '0') || G.dex.some(sp => sp.startsWith(L.id + '_')));
    assert.ok(G.dex.length >= 6 && G.dex.length <= 9, `${s}: ${G.dex.length} species`);
    assert.ok(!G.dex.some(sp => sp.startsWith('big')), `${s}: a line too big for the dex never goes in`);
    for (const L of lines) {
      const form = G.forms[L.id] || '',
        mine = L.names.map((_, st) => (form ? `${L.id}_${form}${st}` : L.id + st));
      assert.deepEqual(
        G.dex.filter(sp => sp === L.id + sp.slice(-1) || sp.startsWith(L.id + '_')),
        mine,
        `${s}: ${L.id} whole`
      );
      for (const F of L.forms || [])
        L.names.forEach((_, st) => {
          const base = L.id + st,
            other = `${L.id}_${F.id}${st}`;
          assert.equal(G.swap[form ? base : other], mine[st], `${s}: ${L.id}'s other variety is swapped`);
        });
    }
    // the wet theme leans to Water: the rock line, if in, is its tide form (Rock to Water); the high theme keeps it
    if (G.dex.some(sp => sp.startsWith('rock')))
      assert.equal(G.forms.rock || '', G.theme === 'wet' ? 'tide' : '', `${s}: rock's variety for ${G.theme}`);
  }
});

test("the leaders: one per mini-boss and the boss, never twice, of the theme's types while any are left", () => {
  const n = { wet: { gill: 0, moss: 0, cobble: 0, ember: 0 }, high: { gill: 0, moss: 0, cobble: 0, ember: 0 } };
  for (const s of seeds(200)) {
    const G = make(s);
    assert.equal(G.leaders.length, 3, s);
    assert.equal(new Set(G.leaders).size, 3, `${s}: no leader twice`);
    const T = REGIONS.themes[G.theme],
      leaning = LEADERS.filter(L => T.types[L.type]).length;
    G.leaders.forEach((id, k) => {
      n[G.theme][id]++;
      const L = LEADERS.find(q => q.id === id);
      if (k < leaning) assert.ok(T.types[L.type] > 0, `${s}: leader ${k} (${id}) is of a ${G.theme} type`);
    });
    // the first leader is drawn by lean: Water 3 against Grass 1 in a wet region
  }
  assert.ok(n.wet.gill > n.wet.moss / 2, 'Water leans more than Grass');
  // more leaders than leaning ones: the rest come from any leader left
  assert.equal(make('MANY', { guards: 5 }).leaders.length, 4 + 2);
  assert.equal(runRegionMake('NONE', { ...DATA, leaders: [] }, { open: ALL, guards: 2 }).leaders.length, 0);
});

test('the name: a part and a joined ending or a noun; a two-word part takes only a noun', () => {
  const names = new Set();
  for (const s of seeds(200)) {
    const G = make(s),
      T = REGIONS.themes[G.theme],
      ends = (T.ends || []).concat(REGIONS.names.ends),
      nouns = (T.nouns || []).concat(REGIONS.names.nouns),
      ok =
        REGIONS.names.parts.some(p => ends.some(e => G.name === p + e) && !p.includes(' ')) ||
        REGIONS.names.parts.some(p => nouns.some(w => G.name === `${p} ${w}`));
    assert.ok(ok, `${s}: "${G.name}" is built from the parts`);
    assert.ok(!/^Spare Parts[a-z]/.test(G.name), `${s}: "${G.name}"`);
    names.add(G.name);
  }
  assert.ok(names.has('Pendingvale') || names.has('Pendingmere'), 'a joined name');
  assert.ok(
    [...names].some(x => x.includes(' ')),
    'a spaced name'
  );
  assert.equal(runRegionName('S', REGIONS, REGIONS.themes.wet), runRegionName('S', REGIONS, REGIONS.themes.wet));
});
