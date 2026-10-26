// Residents track RS-2: the run's resident in real runs' towns (logic/run-quests.js residentPlan, logic/run-scenes.js
// runTownResident on the scenes logic/run-scenes.js makes from the run's seed, the game's own data, as run-world.js
// runWorldPutRun does): the free first one in every town of the first all-town row, anyone else in the one town their
// favour is offered in; on a local spot of the town nobody else stands on; the same run, the same place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const RT = modules['route-trainers'],
  Q = modules['run-quests'],
  { runScenesMake, runTownResident } = modules['run-scenes'],
  { runStartOn, runStartPlan } = modules['run-start'],
  { runUnlocks } = modules.unlocks,
  RUN = GAME_DATA.rules.run,
  R = GAME_DATA.residents,
  UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: GAME_DATA.scenery,
    rules: RUN,
    setPieces: GAME_DATA.setPieces,
    unlockData: UNLOCK_DATA,
    region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
  },
  TD = { classes: GAME_DATA.events.classes, species: hooks.SPECIES, rules: RUN };

function start(seed, residents) {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', 12));
  s.meta.residents = { ...residents };
  hooks.provide({ saveData: s });
  runStartOn(s, runStartPlan(seed, DATA, { unlocks: runUnlocks(s, UNLOCK_DATA) }), { home: [s.team[0].uid] });
  return s;
}
/** the run's world as runWorldPutRun makes it: scenes, route trainers, then the resident */
function world(s) {
  const scenes = runScenesMake(s.run, DATA),
    T = RT.runRouteTrainers(s.run, TD);
  RT.routeTrainersPlace(s.run, T, scenes, TD.classes);
  const D = Q.questDataOf(s.run, scenes, T, GAME_DATA.quests, hooks.SPECIES),
    plan = Q.residentPlan(s, R, D);
  if (plan) for (const i of plan.towns) runTownResident(scenes[i], plan.id, R[plan.id].name);
  return { scenes, plan, D };
}

test('RS-2: the run’s resident stands on a free local spot of their town or towns', () => {
  let others = 0;
  for (let k = 0; k < 4; k++)
    for (const here of [{}, { dottie: 1 }]) {
      const seed = 'RS2TOWN' + k,
        s = start(seed, here),
        { scenes, plan, D } = world(s),
        where = `${seed} ${JSON.stringify(here)}`;
      assert.ok(plan, where);
      if (!here.dottie) assert.ok(plan.id === 'dottie' && plan.towns.length >= 1, `${where}: Dottie`);
      else others += plan.towns.length;
      scenes.forEach((sc, i) => {
        const them = (sc.people || []).filter(p => p.resident);
        assert.equal(them.length, plan.towns.includes(i) ? 1 : 0, `${where}: node ${i}`);
        if (!them.length) return;
        const P = them[0],
          spot = (sc.spots || []).find(x => x.kind === 'local' && Math.hypot(x.x - P.x, x.z - P.z) < 0.01);
        assert.ok(spot, `${where}: on a local spot`);
        assert.equal(P.name, R[plan.id].name);
        assert.ok(!sc.people.some(p => p !== P && Math.hypot(p.x - P.x, p.z - P.z) < 1), `${where}: nobody else on it`);
        if (plan.id !== 'dottie') assert.ok(Q.favourOffer(s.run, i, plan.id, GAME_DATA.quests.favours[plan.id], D));
      });
      assert.deepEqual(world(start(seed, here)).plan, plan, `${where}: the same run, the same place`);
    }
  assert.ok(others >= 3, `someone after Dottie is met in most runs (${others} of 4)`);
});
