// Phase 04e: the logic runs in plain Node, with no window, document, storage or WebGL, and a few functions of each
// module give the numbers they give in the game. `npm run check:logic` (node --test, about 0.2 s). The setup (the data,
// the hooks, the seeded random numbers) is in setup-fixture.mjs (phase 13).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { data, files, fn, hooks, LOGIC_DIR, logic, ROOT, said, startedSave } from './setup-fixture.mjs';

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
