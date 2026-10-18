// Phase 13: what every logic test file starts with (moved from logic.test.mjs, phase 04e). The logic runs in plain
// Node, with no window, document, storage or WebGL: every module in game/js/logic/ and the data tables it reads
// (game/js/game-data.js) load here, with a small data set of this file's own (not the game's data, so a change made in
// the Studio can't break it).
//
// How the logic gets what it needs, here as on the page:
// - the data tables: game-data.js reads globalThis.GAMEDATA when it loads (on the page, data/gamedata.js puts it on
//   window); this file sets it first, then imports the modules;
// - the save, the battle and the interface state (saveData, activeBattle, uiState), and what the logic tells the
//   page (save, toast, render, openBattle, playTurnEvents...): through game/js/hooks.js, which game-state.js and the
//   interface fill on the page and provide() fills here;
// - random numbers: util.js's random, which is Math.random when util.js loads: seeded here, so every run is the same;
// - PB_VERSION (a new save's gameVersion): from game/version.js.
import { loadLogic } from './load-logic.mjs';

export { LOGIC_DIR, reseed, ROOT } from './load-logic.mjs';

// the data: three types, three lines (five species; a line of one is a final stage: Drip has final-stage stats),
// three locations on two roads, one pool, one trainer
export const FIXTURE = {
  rules: {
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

export const { hooks, said, files, data, modules, logic, fn, startedSave: started } = await loadLogic(FIXTURE);
export const startedSave = (sp = 'sparky0', lvl = 10) => started(sp, lvl);
