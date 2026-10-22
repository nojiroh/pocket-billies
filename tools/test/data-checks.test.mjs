// Studio plan Phase 1: the shared data checks (game/js/logic/data-checks.js). T1.6: a key starting with `_` in a data
// file is found wherever it is (the Studio's save would drop it).
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  'dataRelics',
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
  D.rules.run.relics.cap = 0;
  found('dataRelics', D, 'run.relics.cap');
  D = copy();
  D.currencies.capital.kept = 'run';
  found('dataCurrencies', D, 'capital.kept');
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
