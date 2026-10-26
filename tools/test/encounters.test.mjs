// RL-12b: logic/encounters.js, a run's events on the game's data: which event a place holds (the same for the same
// run, kept, of its biome, none twice a run), when an option is open and what a closed one says, what each event
// command does to the save, and the foes an event or a route meets (the region's Billies, at the place's level).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const X = modules.encounters,
  { runStartOn, runStartPlan } = modules['run-start'],
  { runUnlocks } = modules.unlocks,
  { validRun } = modules['run-state'],
  E = GAME_DATA.events,
  SPECIES = hooks.SPECIES,
  RUN = GAME_DATA.rules.run,
  UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: GAME_DATA.scenery,
    rules: RUN,
    unlockData: UNLOCK_DATA,
    region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
  };

/** a save on a run of this seed, as the mast starts it */
function onRun(seed = 'ENCOUNTER1') {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', 12));
  hooks.provide({ saveData: s });
  runStartOn(s, runStartPlan(seed, DATA, { unlocks: runUnlocks(s, UNLOCK_DATA) }), { home: [s.team[0].uid] });
  return s;
}

test('encounters: a place holds the same event for the same run, kept; a played one is not drawn again', () => {
  const a = onRun().run,
    b = onRun().run,
    n = a.map.nodes.length;
  for (let i = 0; i < n; i++) assert.equal(X.eventAt(a, i, E), X.eventAt(b, i, E));
  const id = X.eventAt(a, 2, E);
  assert.ok(E.events[id], 'an event of events.json');
  assert.equal(a.enc.node['2'], id);
  X.eventPlayed(a, id, 2);
  assert.equal(X.eventAt(a, 2, E), '');
  assert.ok(!X.eventPool(a, E, undefined).includes(id));
  assert.equal(validRun(a), true);
  /* a biome-only event stays out of other biomes */
  const E2 = structuredClone(E);
  for (const ev of Object.values(E2.events)) ev.biomes = ['lake'];
  assert.deepEqual(X.eventPool(b, E2, 'meadow'), []);
  /* (SP-6: but the ones with a `when`, read with no holds given) */
  assert.equal(X.eventPool(b, E2, 'lake').length, Object.values(E.events).filter(ev => !ev.when).length);
  assert.equal(X.eventPool(b, E2, 'lake', () => true).length, Object.keys(E.events).length);
  /* SP-6: an event's `when`: in the pool only while it holds; with no holds given it is left out */
  const E3 = { ...E, events: { only: { ...E.events[id], when: 'genes >= 1' } } };
  assert.deepEqual(X.eventPool(b, E3, 'lake'), []);
  assert.deepEqual(
    X.eventPool(b, E3, 'lake', () => false),
    []
  );
  assert.deepEqual(
    X.eventPool(b, E3, 'lake', c => c === 'genes >= 1'),
    ['only']
  );
});

test('encounters: an option is open when its need holds and the Moneys are there; a closed one says why', () => {
  const items = GAME_DATA.items,
    st = (o, holds = () => true, money = 0) => X.eventOptionState(o, holds, money, items);
  assert.deepEqual(st({ text: 'a', then: [] }), { ok: true, why: '' });
  assert.deepEqual(
    st({ text: 'a', need: 'type:Psychic', then: [] }, () => false),
    { ok: false, why: 'Needs a Psychic Billie' }
  );
  assert.equal(st({ text: 'a', need: 'item:nerve_tonic', then: [] }, () => false).why, 'Needs a Nerve Tonic');
  assert.equal(st({ text: 'a', need: 'team >= 2', needText: 'Two, please', then: [] }, () => false).why, 'Two, please');
  assert.deepEqual(
    st({ text: 'a', cost: 200, then: [] }, () => true, 199),
    { ok: false, why: 'Needs 200 Moneys' }
  );
  assert.equal(st({ text: 'a', cost: 200, then: [] }, () => true, 200).ok, true);
  /* SP-6: a DNA price, after the Moneys */
  assert.deepEqual(
    X.eventOptionState({ text: 'a', dna: 8, then: [] }, () => true, 0, items, 7),
    {
      ok: false,
      why: 'Needs 8 DNA',
    }
  );
  assert.equal(X.eventOptionState({ text: 'a', dna: 8, then: [] }, () => true, 0, items, 8).ok, true);
  assert.equal(X.eventOptionState({ text: 'a', dna: 8, then: [] }, () => true, 0, items).ok, false);
  assert.deepEqual(
    X.encChanges({ se: 5, dna: 10, items: {}, pyramids: {} }, { se: 5, dna: 2, items: {}, pyramids: {} }),
    [['dna', -8]]
  );
  for (const [need, words] of [
    ['badges', 'Needs a badge'],
    ['badge:Water', 'Needs the Water Badge'],
    ['type:Fire >= 2', 'Needs 2 Fire Billies'],
    ['money >= 50', 'Needs 50 Moneys'],
    ['dna >= 8', 'Needs 8 DNA'],
    ['genes', 'Needs a Gene'],
    ['genes >= 3', 'Needs 3 Genes'],
    ['spliced >= 1', 'Needs a spliced Billie'],
    ['met_juniper', 'Not now'],
  ])
    assert.equal(X.needWords(need, items), words);
});

test('encounters: Moneys, hurt, heal and status change the team as the commands say', () => {
  const s = onRun(),
    maxHp = fn('maxHp'),
    m = s.team[0];
  s.se = 100;
  assert.equal(X.encMoney(s, -250), -100);
  assert.equal(s.se, 0);
  X.encMoney(s, 300);
  assert.equal(s.se, 300);
  const top = maxHp(m);
  X.encHurt(s.team, 0.5, maxHp);
  assert.equal(m.hp, top - Math.ceil(top * 0.5));
  X.encHurt(s.team, 1, maxHp);
  assert.equal(m.hp, 1, 'never past 1 HP');
  X.encHeal(s.team, 0.25, maxHp);
  assert.equal(m.hp, 1 + Math.ceil(top * 0.25));
  X.encHeal(s.team, undefined, maxHp);
  assert.equal(m.hp, top);
  assert.equal(X.encStatus(s.team, 'slp'), 1);
  assert.equal(m.status, 'slp');
  assert.equal(X.encStatus(s.team, 'brn'), 0, 'one status at a time');
  m.hp = 0;
  assert.equal(X.encHeal(s.team, 1, maxHp), 0, 'a fainted one stays down');
});

test('encounters: loot, Perks and the Billie drawn come from the events stream, the same for the same run', () => {
  const a = onRun().run,
    b = onRun().run;
  assert.deepEqual(X.encLoot(a, E, 'auction', 3), X.encLoot(b, E, 'auction', 3));
  const got = X.encLoot(a, E, 'common', 5);
  assert.equal(
    Object.values(got).reduce((x, y) => x + y, 0),
    5
  );
  for (const k of Object.keys(got)) assert.ok(E.loot.common[k]);
  assert.equal(a.enc.n, 2);
  const PERKS = GAME_DATA.perks,
    rule = RUN.perks,
    rare = X.encPerk(a, 'rare', PERKS, rule);
  assert.equal(PERKS[rare].rarity, 'rare');
  const some = Object.keys(PERKS)[0];
  assert.equal(X.encPerk(a, some, PERKS, rule), some);
  a.perks.push(some);
  assert.equal(X.encPerk(a, some, PERKS, rule), '', 'a Perk held is not offered again');
  a.perks = Object.keys(PERKS);
  assert.equal(X.encPerk(a, undefined, PERKS, rule), '', 'none left');
});

test('encounters: a class foe and a wild one are the region’s Billies at the place’s level, the same for the same run', () => {
  const s = onRun(),
    run = s.run,
    i = run.map.nodes.findIndex(n => n.row === 2),
    o = { classes: E.classes, species: SPECIES, rules: RUN, up: 1, salt: 'route|0', reward: 300, foe: 'route' },
    F = X.encClassFoe(run, i, 'run_x', 'hustle_coach', o),
    top = X.encPlaceLevel(run, i, RUN) + 1;
  assert.deepEqual(F, X.encClassFoe(onRun().run, i, 'run_x', 'hustle_coach', o));
  assert.equal(F.name, 'Hustle Coach');
  assert.ok(F.team.length >= E.classes.hustle_coach.team[0] && F.team.length <= E.classes.hustle_coach.team[1]);
  assert.equal(F.team.at(-1).lvl, top);
  for (const b of F.team) assert.ok(run.region.dex.includes(b.sp), b.sp);
  const w = X.encWildFoe(run, i, SPECIES, RUN, 2);
  assert.equal(w.lvl, X.encPlaceLevel(run, i, RUN) + 2);
  assert.ok(run.region.dex.includes(w.sp));
  assert.equal(SPECIES[w.sp].stage, 0, 'a first stage under level 16');
});

test('encounters: the summary of what changed', () => {
  assert.deepEqual(
    X.encChanges(
      { se: 100, items: { potion: 1 }, pyramids: { pyramid: 2 } },
      { se: 50, items: { potion: 2, revive: 1 }, pyramids: { pyramid: 5 } }
    ),
    [
      ['money', -50],
      ['potion', 1],
      ['revive', 1],
      ['coin:pyramid', 3],
    ]
  );
});

test('RL-13: a route trainer never fields a final form under level 32, a Billie with no evolutions included', () => {
  const E = modules.encounters,
    S = data.SPECIES,
    at8 = E.encDexAt({}, S, 8),
    at40 = E.encDexAt({}, S, 40);
  for (const sp of ['altman0', 'arnault0', 'cuban1', 'hughes2']) {
    assert.ok(!at8.includes(sp), `${sp} at level 8`);
    assert.ok(at40.includes(sp), `${sp} at level 40`);
  }
});
