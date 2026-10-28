// VFX track VFX-15: the stage's moods and scars (game/js/logic/battle-stage-look.js, battleAnims.json moods, scars)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGameData } from '../data-files.mjs';
import {
  battleMoodFor,
  scarAdd,
  scarCap,
  scarFadeShare,
  scarKindFor,
  scarSize,
} from '../../game/js/logic/battle-stage-look.js';

const D = readGameData(),
  A = D.battleAnims,
  S = A.scars,
  M = D.moves;
const byType = (t, big) =>
  Object.keys(M).find(id => M[id].t === t && M[id].c !== 'X' && (big ? M[id].p >= A.bigPower : M[id].p < A.bigPower));

test('the decal cap: 12 / 8 / 4 / 0 by quality, the oldest replaced', () => {
  assert.deepEqual(
    [0, 1, 2, 3].map(q => scarCap(S, q)),
    [12, 8, 4, 0]
  );
  assert.equal(scarCap(S, 9), 0, 'past the last quality: the last cap');
  assert.equal(scarCap(S, -1), 12);
  for (const q of [0, 1, 2, 3]) {
    const cap = scarCap(S, q),
      list = [];
    for (let i = 0; i < 30; i++) scarAdd(list, i, cap);
    assert.equal(list.length, cap, `quality ${q} keeps ${cap}`);
    if (cap)
      assert.deepEqual(
        list,
        Array.from({ length: cap }, (_, i) => 30 - cap + i),
        'the newest kept, in order'
      );
  }
  const L = [1, 2, 3];
  assert.equal(scarAdd(L, 4, 0), 3, 'a cap of 0 keeps none');
  assert.deepEqual(L, []);
  assert.equal(scarAdd(L, 'a', 2), 0);
  assert.equal(scarAdd(L, 'b', 2), 0);
  assert.equal(scarAdd(L, 'c', 2), 1, 'past the cap the oldest goes');
  assert.deepEqual(L, ['b', 'c']);
});

test('a scar is 1.2 m across at most', () => {
  for (const k of Object.keys(S.kinds)) {
    assert.ok(scarSize(S, k) > 0 && scarSize(S, k) <= 1.2, k);
    assert.ok(scarSize(S, k) <= S.maxM, k);
  }
  assert.equal(scarSize({ ...S, maxM: 0.5 }, 'sand'), 0.5);
  assert.equal(scarSize(S, 'nothing'), 0);
});

test('which scar a hit leaves', () => {
  assert.equal(scarKindFor(S, { type: 'Fire', w: 0.1 }), 'scorch');
  assert.equal(scarKindFor(S, { type: 'Water', w: 0.1 }), 'puddle');
  assert.equal(scarKindFor(S, { type: 'Ground' }), 'crack');
  assert.equal(scarKindFor(S, { type: 'Grass' }), 'leaf');
  assert.equal(scarKindFor(S, { sandstorm: true }), 'sand');
  assert.equal(scarKindFor(S, { type: 'Electric', w: 0.1 }), null, 'a light hit of another type leaves nothing');
  assert.equal(scarKindFor(S, { type: 'Electric', w: S.heavy }), 'dent', 'a heavy one a dent');
  assert.equal(scarKindFor(S, { type: 'Psychic', ko: true }), 'dent', 'a KO a dent');
  assert.equal(scarKindFor(undefined, { type: 'Fire' }), null);
});

test('scars go in four dithered steps over 400 ms when the battle ends', () => {
  const f = ms => scarFadeShare(ms, S.fadeMs, S.fadeSteps);
  assert.equal(S.fadeMs, 400);
  assert.equal(S.fadeSteps, 4);
  assert.deepEqual([-1, 0, 99, 100, 200, 300, 399, 400, 1000].map(f), [1, 1, 1, 0.75, 0.5, 0.25, 0.25, 0, 0]);
});

test('the battle mood: big moves and super-effective hits darken (20% at most) and tint', () => {
  const fire = byType('Fire', true),
    small = byType('Water', false),
    hit = { dmg: 30, te: 1 };
  const big = battleMoodFor(hit, M[fire], {}, A);
  assert.ok(big && big.dark > 0 && big.dark <= 0.2 && big.tint > 0 && big.col === 'type');
  assert.ok(big.heat > 0, "Fire's big moves add heat");
  assert.equal(battleMoodFor(hit, M[small], {}, A), null, 'a small neutral hit: no mood');
  const se = battleMoodFor({ dmg: 30, te: 2 }, M[small], {}, A);
  assert.ok(se && se.dark > 0 && se.heat === 0, 'super-effective darkens; no heat for Water');
  for (const miss of [{ miss: true }, { blocked: true }, { protect: true }])
    assert.equal(battleMoodFor(miss, M[fire], {}, A), null, 'only a landed move');
  assert.ok(battleMoodFor(hit, M[fire], {}, { ...A, moods: { ...A.moods, dark: 0.9 } }).dark <= 0.2, 'capped at .2');
});

test('the row wave: Psychic and the Bureau; Reduced motion keeps the tint without the motion', () => {
  const psy = byType('Psychic', false),
    psyBig = byType('Psychic', true),
    el = byType('Electric', false);
  assert.equal(battleMoodFor({ dmg: 9 }, M[psy], {}, A).wave, A.moods.wave.px);
  assert.equal(battleMoodFor({ dmg: 9 }, M[psyBig], {}, A).wave, A.moods.wave.bigPx);
  assert.equal(battleMoodFor({ dmg: 9 }, M[el], {}, A), null);
  const bot = battleMoodFor({ dmg: 9 }, M[el], { bureau: true }, A);
  assert.equal(bot.wave, A.moods.wave.px, "a Bureau bot's move waves whatever its type");
  assert.equal(battleMoodFor({ dmg: 9, te: 2 }, M[el], { bureau: true }, A).col, A.moods.bureau, 'in the stamp ink');
  const R = battleMoodFor({ dmg: 9 }, M[psyBig], { reduced: true }, A);
  assert.ok(R.dark > 0 && R.tint > 0, 'the meaning');
  assert.equal(R.wave, 0, 'no wave');
  assert.equal(R.heat, 0);
  assert.ok(R.stepped && R.inMs === 0 && R.outMs === 0, 'stepped, not eased');
  assert.equal(battleMoodFor({ dmg: 9 }, M[psy], { reduced: true }, A), null, 'a small one: only motion, so nothing');
});
