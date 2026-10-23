// Studio plan T4.4: logic/economy-view.js lists every source and sink of each currency in the game data, each with a
// data path that exists and the value found there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { economyLines } = modules['economy-view'];
const at = (D, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), D);

test('economy: each line reads its value from its path, in currencies.json order, sources first', () => {
  const L = economyLines(GAME_DATA);
  assert.ok(L.length > 20);
  for (const l of L) assert.equal(at(GAME_DATA, l.path), l.value, l.path);
  const order = Object.keys(GAME_DATA.currencies);
  assert.deepEqual([...new Set(L.map(l => l.currency))], order);
  for (const c of order) {
    const sides = L.filter(l => l.currency === c).map(l => l.side);
    assert.deepEqual(
      sides,
      [...sides].sort((a, b) => ['in', 'turn', 'out'].indexOf(a) - ['in', 'turn', 'out'].indexOf(b)),
      c
    );
  }
});

test('economy: the run’s rewards, clinic, shop, Perk prices, payout and unlock costs are all there', () => {
  const paths = new Set(economyLines(GAME_DATA).map(l => l.path)),
    R = GAME_DATA.rules.run;
  for (const k of Object.keys(R.foes)) assert.ok(paths.has(`rules.run.foes.${k}.reward`));
  assert.ok(paths.has('rules.run.healCost') && paths.has('rules.encounters.prizePerLevel'));
  for (const k of Object.keys(R.shop.pick)) assert.ok(paths.has(`items.${k}.price`), k);
  for (const k of Object.keys(R.relics.price)) assert.ok(paths.has(`rules.run.relics.price.${k}`));
  for (const k of Object.keys(R.payout)) assert.ok(paths.has(`rules.run.payout.${k}`));
  for (const [k, U] of Object.entries(GAME_DATA.unlocks)) if (!U.when) assert.ok(paths.has(`unlocks.${k}.cost`), k);
  assert.ok(paths.has('perks.offshore.fx.0.mult'), 'a money Perk');
  const ranch = economyLines(GAME_DATA).find(l => l.path === 'unlocks.ranch_2.cost');
  assert.equal(ranch.currency, 'scrap', 'paid in its building’s currency');
});
