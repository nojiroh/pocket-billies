// Studio plan Phase 1: the shared data checks (game/js/logic/data-checks.js). T1.6: a key starting with `_` in a data
// file is found wherever it is (the Studio's save would drop it).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PB_DATA } from '../data-files.mjs';
import { GAME_DATA, modules } from './setup-real.mjs';

const C = modules['data-checks'];

test('keys starting with _ are found at any depth; a lone _ and array items are not keys', () => {
  assert.deepEqual(C.dataUnderscoreKeys({ a: 1, _b: 2, c: { _d: { e: 1 }, f: [{ _g: 1 }, '_h'] }, _: 3 }), [
    '_b',
    'c._d',
    'c.f.0._g',
  ]);
  assert.deepEqual(C.dataUnderscoreKeys(['_x', 2, null]), []);
  assert.deepEqual(C.dataUnderscoreKeys(null), []);
});

test('the game data has none', () => {
  assert.deepEqual(C.dataUnderscoreKeys(GAME_DATA), []);
});

// T1.3: the families moved from check-data (its own words are guarded by check-data-snapshot.test.mjs): the game data
// passes each, and a planted fault in a copy is found by the family it belongs to
const FAMILIES = [
  'dataBattleRules',
  'dataRunPayout',
  'dataRanchRules',
  'dataRunMapRules',
  'dataRunClock',
  'dataRunScene',
  'dataRunLoop',
  'dataRobots',
  'dataUiTheme',
  'dataBiomes',
  'dataNodeTypes',
  'dataQuests',
  'dataResidents',
  'dataPerks',
  'dataEvents',
  'dataBanter',
  'dataRewards',
  'dataCurrencies',
  'dataBuildings',
  'dataUnlocks',
];
const copy = () => structuredClone(GAME_DATA);
const found = (family, D, text) =>
  assert.ok(
    C[family](D).some(([, what]) => what.includes(text)),
    `${family}: no "${text}" in ${JSON.stringify(C[family](D))}`
  );

test('the game data passes every moved family', () => {
  for (const f of FAMILIES) assert.deepEqual(C[f](GAME_DATA), [], f);
});

test('a planted fault is found by its family, in the file check-data names', () => {
  let D = copy();
  D.rules.battle.turnCap = 3;
  found('dataBattleRules', D, 'turnCap');
  D = copy();
  D.rules.run.payout.itemShare = 2;
  found('dataRunPayout', D, 'itemShare is more than 1');
  D = copy();
  D.rules.ranch.breed.odds.safe = 0.9;
  found('dataRanchRules', D, 'adding up to 1');
  D = copy();
  D.rules.run.map.first = 'nosuch';
  found('dataRunMapRules', D, 'no node type "nosuch"');
  assert.deepEqual(C.dataRunMapRules(D)[0][0], 'rules.json');
  D = copy();
  D.rules.run.typo = 1;
  found('dataRunClock', D, 'run.typo: no such rule');
  D = copy();
  D.rules.run.scene.road.shape.zigzag = 1;
  found('dataRunScene', D, 'no such choice "zigzag"');
  D = copy();
  D.rules.run.shop.always.push('nosuchware');
  found('dataRunLoop', D, 'no such ware "nosuchware"');
  D = copy();
  D.robots.gems[Object.keys(D.robots.gems)[0]].move = 'nosuchmove';
  found('dataRobots', D, 'nosuchmove, no such move');
  D = copy();
  delete D.robots;
  assert.deepEqual(C.dataRobots(D), [['robots.json', 'missing']]);
  D = copy();
  D.biomes.meadow.pool = 'nosuchpool';
  found('dataBiomes', D, 'no pool "nosuchpool"');
  D = copy();
  D.nodeTypes.landing.mark = 'bogus';
  found('dataNodeTypes', D, 'no marker "bogus"');
  D = copy();
  D.rules.run.perks.cap = 0;
  found('dataPerks', D, 'run.perks.cap');
  /* RL-12b: events.json */
  for (const [plant, text] of [
    [E => (E.events.form_27b.options[0].then[0] = 'teleport home'), 'unknown command "teleport"'],
    [E => (E.events.form_27b.options[0].then[0] = 'loot nosuchtable'), 'no loot table "nosuchtable"'],
    [E => (E.events.form_27b.options[0].then[0] = 'give nosuchitem'), 'no item or pyramid "nosuchitem"'],
    [E => (E.events.form_27b.options[0].then[0] = 'foe nosuchclass'), 'no class "nosuchclass"'],
    [E => (E.events.form_27b.options[0].then[0] = 'fx 1 bogus mult=2'), 'no effect kind "bogus"'],
    [E => (E.events.form_27b.options[0].then[0] = 'fx 1 stat stat=hp stages=1'), 'not hp'],
    [E => (E.events.form_27b.options[0].then[0] = 'status bogus'), 'no status "bogus"'],
    [E => (E.events.form_27b.options[0].then[0] = 'wager 100'), '1-99 percent'],
    [E => (E.events.form_27b.options[0].then[0] = 'perk legendary'), 'not a rarity'],
    [E => (E.events.form_27b.options[1].need = 'type:Plastic'), 'no type "Plastic"'],
    [E => (E.events.form_27b.options[1].need = 'typo:Fire'), 'unknown term'],
    [E => (E.events.form_27b.intro[0] = 'money 5'), 'lines only'],
    [E => (E.loot.common.nosuchitem = 1), 'loot.common: no item "nosuchitem"'],
    [E => (E.classes.intern.who = 'nobody'), 'no person "nobody"'],
    /* RS-2: invite only in a resident event, and every resident event invites */
    [E => (E.events.form_27b.options[0].then[0] = 'invite'), 'only a resident event'],
    [
      E => E.events.stranded_cart.options.forEach(o => (o.then = o.then.filter(l => l !== 'invite'))),
      'no option that invites',
    ],
  ]) {
    D = copy();
    plant(D.events);
    found('dataEvents', D, text);
  }
  assert.deepEqual(C.dataEvents(copy()), []);
  /* RL-12b: rewards.json */
  for (const [plant, text] of [
    [R => (R.potions.item = 'nosuchitem'), 'no item "nosuchitem"'],
    [R => (R.step_pyramids.pyramid = 'nosuch'), 'no pyramid "nosuch"'],
    [R => (R.protein_bar.item = 'potion'), 'gives levels'],
    [R => (R.shining_stone.item = 'potion'), 'evoItem'],
    [R => (R.held.item = 'potion'), 'a held card names no item'],
    [R => (R.tutor.item = 'potion'), 'names no item'],
    [R => Object.values(R).forEach(r => r.kind === 'item' && (r.weight = 0)), 'could be empty'],
  ]) {
    D = copy();
    plant(D.rewards);
    found('dataRewards', D, text);
  }
  assert.deepEqual(C.dataRewards(copy()), []);
  // RL-S1: the story director's lines
  for (const [plant, text] of [
    [B => (B.chosen_first.cooldown = 2), 'said once, so no cooldown'],
    [B => (B.leader_badge.when = 'wins >= 1'), 'no leader line without a when'],
    [B => delete B.bureau_lost, 'no bureau line without a when'],
  ]) {
    D = copy();
    plant(D.banter);
    found('dataBanter', D, text);
  }
  // Studio plan T4.1: the code's limits (effects.js FX_LIMIT, FX_STAGES) on a row
  D = copy();
  D.perks.lucky_charm.fx[0].mult = 0.05;
  found('dataPerks', D, "lucky_charm.fx[0].mult: 0.05 is outside the code's limits, 0.1 to 4");
  D = copy();
  D.perks.running_shoes.fx[0].stages = 7;
  found('dataPerks', D, 'running_shoes.fx[0].stages: 7 is not a whole number of stages from -6 to 6');
  D.perks.running_shoes.fx[0].stages = 1.5;
  found('dataPerks', D, 'running_shoes.fx[0].stages: 1.5');
  D = copy();
  D.perks.lucky_charm.fx[0].mult = 4;
  D.perks.clinic_card.fx[0].mult = 0.1;
  assert.deepEqual(C.dataPerks(D), [], 'the limits themselves are allowed');
  D = copy();
  D.currencies.research.kept = 'run';
  found('dataCurrencies', D, 'research.kept');
  D = copy();
  D.buildings.ranch.act = 'nosuchact';
  found('dataBuildings', D, 'act "nosuchact"');
  D = copy();
  const [a, b] = Object.keys(D.unlocks);
  D.unlocks[a].requires = [b];
  D.unlocks[b].requires = [a];
  found('dataUnlocks', D, 'goes round in a circle');
});

test('a family whose schema fails skips what the schema guards', () => {
  const D = copy();
  D.nodeTypes.landing.mark = 'bogus';
  assert.deepEqual(
    C.dataNodeTypes(D, () => false),
    []
  );
});

test("a trainer's robot: a missing gem and a part in the wrong slot", () => {
  const torso = Object.keys(GAME_DATA.robots.parts).find(k => GAME_DATA.robots.parts[k].slot === 'torso');
  assert.deepEqual(C.dataRobotProblems(GAME_DATA, null), ['is a robot with no parts (robot)']);
  const P = C.dataRobotProblems(GAME_DATA, { gem: 'nosuch', torso, armL: torso, armR: 'x', legs: torso });
  assert.ok(P.includes('has robot gem nosuch, no such gem'));
  assert.ok(P.includes(`has ${torso} as armL, but it is a torso part`));
  assert.ok(P.includes('has robot armR x, no such part'));
});

test("one species rule: a loaded line's stages, a legacy line's (by its names, or any stage by its id alone)", () => {
  const kind = C.dataSpeciesKind(
    [{ id: 'nova', names: ['a', 'b'] }],
    [{ id: 'walton', names: ['x', 'y', 'z'] }, { id: 'ford' }]
  );
  assert.equal(kind('nova1'), 'line');
  assert.equal(kind('nova2'), '');
  assert.equal(kind('walton2'), 'legacy');
  assert.equal(kind('walton3'), '');
  assert.equal(kind('ford7'), 'legacy');
  assert.equal(kind('waltn0'), '');
  assert.equal(kind(null), '');
});

test("a relic's stat is one of stats.json's, not hp", () => {
  const D = copy(),
    R = Object.values(D.perks).find(r => r.fx.some(f => f.kind === 'stat')),
    f = R.fx.find(f => f.kind === 'stat');
  for (const [stat, ok] of [
    ['hus', true],
    ['hp', false],
    ['luck', false],
  ]) {
    f.stat = stat;
    assert.equal(!C.dataPerks(D).some(([, w]) => w.includes('.stat: no stat')), ok, stat);
  }
});

// T1.3 step 5: the Studio's scene and road checks, now here (check-data runs them too)
const roadOf = (D, L) => PB_DATA.road(D, L);
const errorsOf = F => F.filter(f => f.lvl === 'error').map(f => `${f.where}: ${f.msg}`);

test('the game data has no scene or road error', () => {
  assert.deepEqual(errorsOf(C.dataSceneFindings(GAME_DATA, roadOf)), []);
  assert.deepEqual(errorsOf(C.dataRoadFindings(GAME_DATA, roadOf)), []);
});

test('a planted unknown ground, a stop with no walk scene and a road to itself are found, with where Show me goes', () => {
  const D = copy(),
    k = D.locations[0].mapId;
  D.maps[k].tiles[0] = '§' + D.maps[k].tiles[0].slice(1);
  D.locations.push({ name: 'Nowhere', kind: 'route', mapId: 'nosuchmap' });
  const F = C.dataSceneFindings(D, roadOf);
  const ground = F.find(f => f.msg.includes('unknown ground §'));
  assert.equal(ground.where, `maps/${k}.json`);
  assert.deepEqual([ground.go, ground.sel], ['scenes', { scene: k }]);
  assert.ok(F.some(f => f.where === 'locations.json' && f.msg.includes('uses a walk scene that doesn’t exist')));
  const R = copy(),
    map = R.locations[0].mapId;
  R.roads = [{ id: 'loop', a: { map, exit: 'e1' }, b: { map, exit: 'e2' } }];
  assert.ok(errorsOf(C.dataRoadFindings(R, roadOf)).some(m => m.includes('has a road to itself')));
});

// RF-2: the catch pyramids' icons and models (art/pyramids), read through a stand-in for the files
test('every catch item has its icons and its model; a missing or empty one is named', () => {
  const ART = join(import.meta.dirname, '../../game/art'),
    disk = (/** @type {string} */ p) => (existsSync(join(ART, p)) ? readFileSync(join(ART, p), 'utf8') : null);
  assert.deepEqual(C.dataCatchArt(GAME_DATA.pyramids, disk), []);
  const gone = (/** @type {string} */ p) => (p === 'coins/gold_pyramid_16.png' ? null : disk(p));
  assert.deepEqual(C.dataCatchArt(GAME_DATA.pyramids, gone), [
    ['pyramids.json', 'gold_pyramid: no icon art/coins/gold_pyramid_16.png (tools/build-pyramids.py)'],
  ]);
  const odd = (/** @type {string} */ p) =>
    p === 'coins/step_pyramid.json' ? '{"layers":[]}' : p === 'coins/capstone.json' ? 'not json' : disk(p);
  assert.deepEqual(C.dataCatchArt(GAME_DATA.pyramids, odd), [
    ['pyramids.json', 'step_pyramid: its model art/coins/step_pyramid.json has no shapes'],
    ['pyramids.json', 'capstone: its model art/coins/capstone.json is not JSON'],
  ]);
});
