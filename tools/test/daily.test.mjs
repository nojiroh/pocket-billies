// ON-2 (docs/phases/online-track.md): logic/daily.js, the daily and weekly runs every player shares: day and week
// numbers (the same sums as firestore.rules), seeds, the weekly's draw from its own stream, one attempt each.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAY_MS,
  boardDay,
  boardPlan,
  boardPlayed,
  boardSeed,
  boardWeek,
  boardWeekStart,
} from '../../game/js/logic/daily.js';
import { dailySeed } from '../../game/js/logic/rng.js';

const R = {
  daily: { expedition: 1, challenges: [] },
  weekly: { expedition: [2, 3], challenges: ['noheal', 'noperks', 'fragile'], picks: [1, 2] },
};
const at = iso => Date.parse(iso);

test('days turn at 00:00 UTC; the daily seed is logic/rng.js dailySeed', () => {
  assert.equal(boardDay(at('2026-10-26T23:59:59Z')) + 1, boardDay(at('2026-10-27T00:00:00Z')));
  for (const iso of ['2026-10-26T00:00:00Z', '2026-10-26T13:00:00Z', '2027-01-01T23:59:59Z'])
    assert.equal(boardSeed('d', boardDay(at(iso))), dailySeed(at(iso)));
});

test('weeks start on Monday 00:00 UTC; the weekly seed names its Monday', () => {
  /* 2026-10-26 is a Monday */
  const mon = at('2026-10-26T00:00:00Z');
  assert.equal(boardWeek(mon - 1) + 1, boardWeek(mon));
  assert.equal(boardWeek(mon), boardWeek(at('2026-11-01T23:59:59Z')));
  assert.equal(boardWeek(mon) + 1, boardWeek(at('2026-11-02T00:00:00Z')));
  assert.equal(boardWeekStart(boardWeek(mon)), boardDay(mon));
  assert.equal(boardSeed('w', boardWeek(at('2026-10-29T12:00:00Z'))), 'w2026-10-26');
  assert.equal(new Date(boardWeekStart(boardWeek(at('2026-10-29T12:00:00Z'))) * DAY_MS).getUTCDay(), 1);
});

test("a daily is rules.json's, the same all day", () => {
  const a = boardPlan('d', at('2026-10-26T00:00:01Z'), R),
    b = boardPlan('d', at('2026-10-26T23:00:00Z'), R);
  assert.deepEqual(a, b);
  assert.deepEqual(a, {
    board: { k: 'd', n: boardDay(at('2026-10-26T01:00:00Z')) },
    seed: 'd2026-10-26',
    expedition: 1,
    mods: [],
  });
});

test("a weekly draws its Expedition and challenges from the week's stream: the same all week, within the rules", () => {
  const seen = new Set();
  for (let w = 0; w < 60; w++) {
    const t = at('2026-10-26T00:00:00Z') + w * 7 * DAY_MS,
      P = boardPlan('w', t, R);
    assert.deepEqual(boardPlan('w', t + 6 * DAY_MS + 1000, R), P);
    assert.ok(P.expedition >= 2 && P.expedition <= 3);
    assert.ok(P.mods.length >= 1 && P.mods.length <= 2);
    assert.equal(new Set(P.mods).size, P.mods.length);
    assert.deepEqual(
      P.mods,
      R.weekly.challenges.filter(c => P.mods.includes(c))
    );
    seen.add(P.expedition + ':' + P.mods.join());
  }
  assert.ok(seen.size > 3, 'weeks differ');
});

test('one attempt: a board is played once its day or week is marked', () => {
  const B = { k: 'd', n: 20387 };
  assert.equal(boardPlayed(undefined, B), false);
  assert.equal(boardPlayed({ d: 20386, w: 0 }, B), false);
  assert.equal(boardPlayed({ d: 20387, w: 0 }, B), true);
  assert.equal(boardPlayed({ d: 0, w: 20387 }, B), false);
});
