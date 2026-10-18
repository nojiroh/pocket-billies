// Phase 04e: the logic runs in plain Node, with no window, document, storage or WebGL: every module in game/js/logic/
// and the data tables it reads (game/js/game-data.js) load here, with a small data set of this file's own (not the
// game's data, so a change made in the Studio can't break it), and a few functions of each give the numbers they give
// in the game. `npm run check:logic` (node --test, about 0.2 s). Phase 13 turns this into the unit tests (Vitest).
//
// How the logic gets what it needs, here as on the page:
// - the data tables: game-data.js reads globalThis.GAMEDATA when it loads (on the page, data/gamedata.js puts it on
//   window); this file sets it first, then imports the modules;
// - the save, the battle and the interface state (saveData, activeBattle, uiState), and what the logic tells the
//   page (save, toast, render, openBattle, playTurnEvents...): through game/js/hooks.js, which game-state.js and the
//   interface fill on the page and provide() fills here;
// - random numbers: util.js's random, which is Math.random when util.js loads: seeded here, so every run is the same;
// - PB_VERSION (a new save's gameVersion): from game/version.js.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
const LOGIC_DIR = 'game/js/logic';

// what the logic may ask the page for through hooks.js (the state, and telling the interface what happened); a logic
// module that reads anything else from there reaches into the browser side, which this file can't stand in for
const SEAMS = new Set([
  'provide',
  'saveData',
  'activeBattle',
  'setActiveBattle',
  'uiState',
  'save',
  'toast',
  'render',
  'showPendingWindows',
  'onStepsAdded',
  'openBattle',
  'playTurnEvents',
  'jingle',
  'JINGLES',
  'soundEffect',
  'environmentOdds',
  'battleWeatherMultiplier',
]);

// the data: three types, three lines (five species; a line of one is a final stage: Drip has final-stage stats),
// three locations on two roads, one pool, one trainer
const FIXTURE = {
  rules: {
    travel: 'walk',
    start: {
      se: 600,
      coins: { penny: 5 },
      items: { potion: 2 },
      starters: ['sparky', 'sprout'],
      rival: { sparky: 'drip0', sprout: 'sparky0', drip: 'sprout0' },
      locationId: 'meadow',
    },
    steps: {
      stepsPerKm: 1000,
      brackets: [
        { upTo: 8000, rate: 1 },
        { upTo: 0, rate: 0.5 },
      ],
      encounterEverySE: 500,
      maxEncounters: 10,
      goldOdds: 512,
      alphaOdds: 45,
    },
    progression: {
      xpFactor: 0.8,
      maxLevel: 100,
      buddyStepsPerXp: 5,
      teamSize: 6,
      moveSlots: 4,
      xpYield: [55, 120, 190],
      trainerXpMult: 1.5,
      teamXpShare: 0.5,
    },
    eggs: { capacity: 8, slots: 2, goldOdds: 512, goldOdds10: 128, mythOdds: 1000, mythSpecies: 'sparky0' },
    jobs: { stepsPerPay: 2000, maxPending: 20, positions: 3 },
    battle: {
      stab: 1.5,
      critChances: [0.0625, 0.125, 0.25, 0.5],
      critMult: 1.5,
      rollMin: 0.85,
      cryptoRollMin: 0.25,
      cryptoRollMax: 1.6,
      mediaCrit: 1,
      financeRamp: 0.1,
      financeRampTurns: 10,
      retailSynergy: 0.1,
      oilShockMult: 1.5,
      drainFraction: 16,
      rentFraction: 8,
      auditSkip: 0.25,
      hypeTurns: 3,
      hypeSelfHit: 0.3333,
      subpoenaMin: 2,
      subpoenaMax: 4,
      stageMax: 6,
      aiSmart: 0.8,
      loseFee: 0.1,
      shockType: 'Ground',
      shockTurns: 5,
      spinType: 'Water',
      spinTurns: 3,
      mailTurns: 2,
      holdCap: 320,
      alphaSleepResist: 0.5,
      spreadMult: 0.75,
    },
    catching: {
      rarity: { starter: 0.45, common: 0.45 },
      evolved: [0.12, 0.05],
      hpFactor: 0.6667,
      subpoena: 2,
      status: 1.5,
      spin: 1.1,
      edge: 0.01,
      luxury: [],
      luxuryPenny: 0.5,
      alpha: 0.4,
    },
    ride: { minHeight: 1.5, types: ['Water'] },
  },
  types: [
    { id: 'Fire', color: '#e0603a', strong: ['Grass'], weak: ['Fire', 'Water'], passive: '' },
    { id: 'Water', color: '#3a86d6', strong: ['Fire'], weak: ['Water', 'Grass'], passive: '' },
    { id: 'Grass', color: '#4e9e42', strong: ['Water'], weak: ['Fire', 'Grass'], passive: '' },
  ],
  untyped: { color: '#8e8b78', text: '#fff', fx: ['pow', 'star'] },
  stats: [
    { id: 'hp', name: 'HP' },
    { id: 'lev', name: 'Attack' },
    { id: 'law', name: 'Defense' },
    { id: 'lob', name: 'Sp. Atk' },
    { id: 'pr', name: 'Sp. Def' },
    { id: 'hus', name: 'Speed' },
  ],
  statuses: [
    { id: 'aud', name: 'Paralyzed' },
    { id: 'sub', name: 'Asleep' },
    { id: 'scn', name: 'Burned' },
  ],
  moves: {
    tackle: { n: 'Tackle', t: 'None', c: 'H', p: 40, a: 100 },
    ember: { n: 'Ember', t: 'Fire', c: 'S', p: 40, a: 100 },
    splash: { n: 'Splash', t: 'Water', c: 'S', p: 40, a: 100 },
  },
  rarities: { starter: { totals: [300, 420, 530] }, common: { totals: [300, 400, 515] } },
  lines: [
    {
      id: 'sparky',
      names: ['Sparky', 'Blazey'],
      types: [['Fire'], ['Fire']],
      prof: [1, 1, 1, 1, 1, 1],
      rar: 'starter',
      learn: [
        [1, 'tackle'],
        [7, 'ember'],
      ],
    },
    {
      id: 'sprout',
      names: ['Sprout', 'Shrub'],
      types: [['Grass'], ['Grass']],
      prof: [1, 1, 1, 1, 1, 1],
      rar: 'common',
      learn: [[1, 'tackle']],
    },
    {
      id: 'drip',
      names: ['Drip'],
      types: [['Water']],
      prof: [1, 1, 1, 1, 1, 1],
      rar: 'common',
      ht: [2],
      learn: [
        [1, 'tackle'],
        [1, 'splash'],
      ],
    },
  ],
  locations: [
    { id: 'home', name: 'Home Town', town: 1, kind: 'town', route: 'Town', pool: 'meadow' },
    { id: 'meadow', name: 'Meadow', kind: 'route', route: 'Route 1', pool: 'meadow' },
    { id: 'lake', name: 'Lake', kind: 'route', route: 'Route 2', pool: 'meadow', ride: 1 },
  ],
  regions: [],
  pools: {
    meadow: {
      lv: [3, 5],
      list: [
        ['sprout0', 60],
        ['drip0', 40],
      ],
    },
  },
  battleStages: { grass: { name: 'Long grass' }, meadow: { name: 'Meadow' } },
  roads: [
    [0, 1, 100],
    [1, 2, 200],
  ],
  eggs: { 2: { need: 100, lv: 5, list: [['sprout0', 1]] } },
  coins: { penny: { n: 'Copper Coin', m: 1 }, tbtf: { n: 'Platinum Coin', m: 0 } },
  items: { potion: { n: 'Potion', hp: 20 }, revive: { n: 'Revive', revive: 0.5 } },
  jobs: { barista: { n: 'Barista', out: ['item', 'potion', 1], quip: 'made forty lattes.' } },
  people: { gini: {} },
  shops: {},
  trainers: { ray: { name: 'Rival Ray', who: 'gini', node: 1, blocks: true, team: [{ sp: '@rival', lvl: 5 }] } },
};

// before anything imports util.js: a seeded Math.random (Park-Miller)
let seed = 12345;
Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// game/version.js is a classic script (self.PB_VERSION = ...): run it on its own
const version = { self: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'game/version.js'), 'utf8'), version);
globalThis.PB_VERSION = version.self.PB_VERSION;
globalThis.GAMEDATA = FIXTURE;

const hooks = await import('../game/js/hooks.js');
const said = [];
const page = {
  uiState: { learnQ: [], mq: [] },
  activeBattle: null,
  setActiveBattle: v => hooks.provide({ activeBattle: v }),
  save: () => said.push('save'),
  toast: t => said.push('toast: ' + t),
  render: () => {},
  showPendingWindows: () => {},
  openBattle: () => said.push('openBattle'),
  playTurnEvents: () => said.push('playTurnEvents'),
};
hooks.provide(page);

const files = readdirSync(join(ROOT, LOGIC_DIR))
  .filter(f => f.endsWith('.js'))
  .map(f => `${LOGIC_DIR}/${f}`);
const data = await import('../game/js/game-data.js');
const modules = {};
for (const f of files) modules[f.slice(LOGIC_DIR.length + 1, -3)] = await import(join(ROOT, f));
const logic = Object.assign({}, data, ...Object.values(modules));
const fn = name => {
  if (typeof logic[name] !== 'function') throw new Error(`no logic module exports ${name}`);
  return logic[name];
};
// a fresh started save with one Billie, handed to the logic as the page would (setSaveData)
function startedSave(sp = 'sparky0', lvl = 10) {
  const s = fn('newSave')();
  s.started = true;
  s.starter = sp.replace(/\d+$/, '');
  hooks.provide({ saveData: s });
  s.team.push(fn('makeBilly')(sp, lvl));
  return s;
}

test('every logic module loads in plain Node, with no browser globals made up for it', () => {
  assert.ok(files.length > 0, `${LOGIC_DIR} has no modules`);
  for (const g of [
    'window',
    'document',
    'localStorage',
    'matchMedia',
    'requestAnimationFrame',
    'WebGL2RenderingContext',
  ])
    assert.equal(typeof globalThis[g], 'undefined', `${g} exists in this Node`);
});

test('the logic reaches the page only through the seams in hooks.js', () => {
  for (const f of [...files, 'game/js/game-data.js']) {
    const m = readFileSync(join(ROOT, f), 'utf8').match(/import \{([^}]*)\} from '\.\.?\/hooks\.js';/);
    const used = m
      ? m[1]
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [];
    const other = used.filter(n => !SEAMS.has(n) && !Object.hasOwn(logic, n));
    assert.deepEqual(other, [], `${f} reads ${other.join(', ')} from hooks.js`);
  }
});

test('data tables: type matchups, species, the start', () => {
  const eff = fn('typeEffectiveness');
  assert.equal(eff('Fire', ['Grass']), 2);
  assert.equal(eff('Fire', ['Water']), 0.5);
  assert.equal(eff('Water', ['Fire', 'Grass']), 1);
  assert.equal(eff('None', ['Grass']), 1);
  assert.deepEqual(data.SPECIES.sparky0.types, ['Fire']);
  assert.equal(data.SPECIES.sparky0.next, 'sparky1');
  assert.deepEqual(data.SPECIES.sparky0.base, [50, 50, 50, 50, 50, 50]); // 300 (starter, stage 1) / 6 even weights
  assert.equal(data.START_NODE, 1); // rules.start.locationId: meadow
  assert.equal(data.roadCost(1, 2), 200);
  assert.deepEqual(data.DATA_WARN, []);
});

test('rules: stats, levels, moves, evolution', () => {
  const m = startedSave('sparky0', 10).team[0];
  assert.equal(fn('xpFor')(10), 800);
  assert.equal(fn('stat')(m, 'hp'), 30); // floor(2*50*10/100) + 10 + 10
  assert.equal(fn('stat')(m, 'lev'), 15); // floor(2*50*10/100) + 5
  assert.equal(m.hp, 30);
  assert.deepEqual(m.moves, ['tackle', 'ember']);
  const notes = [];
  fn('gainXp')(m, fn('xpFor')(16) - m.xp, t => notes.push(t));
  assert.equal(m.lvl, 16);
  assert.equal(notes.filter(t => /grew to level/.test(t)).length, 6);
  assert.equal(fn('canEvolve')(m), true); // the default first evolution: level 16
  assert.equal(fn('evolve')(m), 'Sparky');
  assert.equal(m.sp, 'sparky1');
});

test('rules: steps, trips and gates, encounters', () => {
  const s = startedSave('sparky0', 10);
  assert.equal(fn('hereLocation')().id, 'meadow');
  assert.deepEqual(fn('tripTo')(0), { steps: 100, plan: [0], back: false });
  assert.equal(fn('canEnter')(2), false); // the lake needs a Water Billie big enough to ride
  assert.equal(fn('tripTo')(2), null);
  s.team.push(fn('makeBilly')('drip0', 10)); // 2 m tall
  assert.equal(fn('canEnter')(2), true);
  assert.equal(fn('earningsBetween')(7000, 9000), 1000 + 500);
  const before = s.queue.length,
    q = fn('spawn')();
  assert.equal(s.queue.length, before + 1);
  assert.ok(['sprout0', 'drip0'].includes(q.sp) && q.lvl >= 3 && q.lvl <= 5, JSON.stringify(q));
  assert.equal(
    fn('pickWeighted')([
      ['a', 1],
      ['b', 0],
    ]),
    'a'
  );
});

test('saves: a new save, load checks, migrate, backup check', () => {
  const s = fn('newSave')();
  assert.equal(s.saveVersion, logic.SAVE_VERSION);
  assert.equal(s.gameVersion, globalThis.PB_VERSION);
  assert.equal(s.coins.penny, 5);
  assert.equal(s.items.potion, 2);
  assert.equal(fn('saveAge')(s), 'ok');
  assert.equal(fn('saveAge')({}), 'old');
  assert.equal(fn('saveAge')({ saveVersion: logic.SAVE_VERSION + 1 }), 'new');
  assert.equal(fn('saveAge')(null), null);
  assert.equal(fn('loadSave')({ team: [] }), null);
  const started = startedSave('sparky0', 10);
  started.box.push({ ...fn('makeBilly')('sprout0', 3), sp: 'gone0' }); // a species the Studio removed
  started.team[0].moves = ['tackle', 'nosuchmove'];
  const m = fn('migrate')(JSON.parse(JSON.stringify(started)));
  assert.equal(m.box.length, 0);
  assert.deepEqual(m.team[0].moves, ['tackle']);
  assert.equal(m.saveVersion, logic.SAVE_VERSION);
  const valid = fn('validSave');
  assert.equal(valid(m), true);
  assert.equal(valid(s), false); // not started
  assert.equal(valid({ ...m, team: [{ ...m.team[0], lvl: 101 }] }), false);
  assert.equal(valid(JSON.parse(JSON.stringify(m).replace('"flags":{}', '"flags":{"__proto__":1}'))), false);
});

test('battle: damage, type matchup, status, a turn', () => {
  const s = startedSave('sparky0', 10);
  const foe = fn('makeBilly')('sprout0', 10);
  assert.equal(fn('newBattle')('wild', [foe]), true);
  assert.equal(hooks.activeBattle.kind, 'wild');
  assert.equal(fn('fighter')(0), s.team[0]);
  assert.equal(fn('fighter')(1), foe);
  // Ember (Fire, special, 40) from a level 10 Fire Billie at a Grass one: base (0.4*10+2)*40*15/15/50+2 = 6.8,
  // same type 1.5, super effective 2, a roll of 0.85 to 1, maybe a critical hit (1.5)
  for (let i = 0; i < 50; i++) {
    const r = fn('calcDamage')(0, 1, 'ember');
    assert.equal(r.te, 2);
    const lo = Math.floor(6.8 * 1.5 * 2 * 0.85),
      hi = Math.floor(6.8 * 1.5 * 2 * (r.crit ? 1.5 : 1));
    assert.ok(r.dmg >= lo && r.dmg <= hi, `${r.dmg} not in ${lo}..${hi}`);
  }
  fn('inflict')(1, 'scn');
  assert.equal(foe.status, 'scn');
  assert.ok(hooks.activeBattle.events.some(e => e.t === 'Sprout was burned.'));
  said.length = 0;
  fn('runTurn')([{ who: 0, k: 'move', mid: 'tackle', tk: 1 }]);
  assert.ok(said.includes('playTurnEvents'));
  assert.ok(foe.hp < 30 || s.team[0].hp < 30, 'nobody was hit');
});
