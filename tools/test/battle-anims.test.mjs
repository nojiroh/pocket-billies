// VFX track VFX-8: a move's animation as data (game/js/logic/battle-anims.js, game/data/battleAnims.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGameData } from '../data-files.mjs';
import {
  BATTLE_ANIM_OUTCOMES,
  battleAnimFor,
  battleAnimLogLine,
  battleAnimPreviewEvent,
  battleAnimTimeline,
  flashGate,
  hitTier,
  koAhead,
  redShare,
} from '../../game/js/logic/battle-anims.js';

const D = readGameData(),
  A = D.battleAnims,
  MOVES = D.moves,
  OUTCOMES = BATTLE_ANIM_OUTCOMES;
/** a move event for an outcome, as the Studio's Battle effects (and tools/look-battle-anims.py) build it (VFX-12: one
 * function, logic/battle-anims.js) */
const moveAn = (mid, res, si = 0) => battleAnimPreviewEvent(mid, MOVES[mid], si, res);
/** what battle-stage.js's case 'move' returned before VFX-8, by outcome and category */
function legacyDurHit(an, M) {
  if (an.miss) return { dur: 760, hit: 999 };
  if (an.protect) return { dur: 700, hit: 0 };
  if (an.blocked) return { dur: 740, hit: 999 };
  return { H: { dur: 880, hit: 200 }, S: { dur: 1060, hit: 500 }, X: { dur: 1000, hit: 600 } }[M.c];
}

test('every move in 8 outcomes, on the 3D stage and off it, keeps the time it had (VFX-8 changes no timing)', () => {
  let n = 0;
  for (const mid of Object.keys(MOVES))
    for (const res of OUTCOMES)
      for (const gl of [true, false]) {
        const an = moveAn(mid, res),
          T = battleAnimTimeline(an, MOVES[mid], { gl, q: 0, speed: 1 }, A);
        assert.deepEqual({ dur: T.dur, hit: T.hit }, legacyDurHit(an, MOVES[mid]), `${mid} ${res}`);
        n++;
      }
  assert.equal(n, Object.keys(MOVES).length * 16);
  assert.equal(Object.keys(MOVES).length, 122);
});

test('the family: a move’s own anim when it lands, else its outcome’s or category’s default', () => {
  const H = Object.keys(MOVES).find(k => MOVES[k].c === 'H'),
    M = { ...MOVES[H] };
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, A), { id: 'legacy_hit', kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'miss'), M, A), { id: 'legacy_miss', kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'blocked'), M, A), { id: 'legacy_blocked', kind: 'family' });
  M.anim = 'legacy_cast';
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, A), { id: 'legacy_cast', kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'miss'), M, A), { id: 'legacy_miss', kind: 'family' }, 'a miss is a miss');
  const S = { ...A, scenes: { big: A.families.legacy_hit } };
  M.anim = 'big';
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, S), { id: 'big', kind: 'scene' });
  M.anim = 'nosuch';
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, A), { id: 'legacy_hit', kind: 'family' });
  const G = Object.keys(MOVES).find(k => MOVES[k].fx && MOVES[k].fx.protect);
  assert.equal(battleAnimFor(moveAn(G, 'hit'), MOVES[G], A).id, 'legacy_guard');
  assert.equal(battleAnimFor(moveAn(H, 'hit'), M, null), null);
});

test('hit tiers', () => {
  assert.equal(hitTier({ k: 'move' }), 'none');
  assert.equal(hitTier({ k: 'move', dmg: 5, te: 0.5 }), 'resisted');
  assert.equal(hitTier({ k: 'move', dmg: 5 }), 'neutral');
  assert.equal(hitTier({ k: 'move', dmg: 5, te: 2 }), 'super');
  assert.equal(hitTier({ k: 'move', dmg: 5, te: 4 }), 'super4');
  assert.equal(hitTier({ k: 'move', dmg: 5, te: 2, crit: true }), 'crit');
  assert.equal(hitTier({ k: 'move', dmg: 5, miss: true }), 'none');
});

test('the 8 preview outcomes land in their tiers (VFX-12)', () => {
  const H = Object.keys(MOVES).find(k => MOVES[k].c === 'H' && !(MOVES[k].fx || {}).protect),
    tiers = OUTCOMES.map(r => hitTier(moveAn(H, r)));
  assert.deepEqual(tiers, ['neutral', 'super', 'super4', 'resisted', 'crit', 'crit', 'none', 'none']);
  assert.ok(moveAn(H, 'miss').miss && moveAn(H, 'blocked').blocked);
  assert.deepEqual(moveAn(H, 'hit', 1), { k: 'move', si: 1, ti: 0, mid: H, dmg: 24, te: 1, crit: false });
  const G = Object.keys(MOVES).find(k => (MOVES[k].fx || {}).protect);
  if (G) assert.ok(moveAn(G, 'miss').protect && !moveAn(G, 'miss').miss, 'Guard is always a protect');
});

test('a KO ahead: the target faints before the next move; the last when no one comes in after and nothing moves', () => {
  const mv = (si, ti, o = {}) => ({ an: { k: 'move', si, ti, mid: 'x', ...o } }),
    E = [mv(0, 1), { an: { k: 'faint', si: 1 } }];
  assert.deepEqual(koAhead(E, 0), { ko: true, si: [1], last: true });
  assert.deepEqual(koAhead([mv(0, 1), { an: null }, { an: { k: 'alphaPhase' } }, { an: { k: 'faint', si: 1 } }], 0), {
    ko: true,
    si: [1],
    last: true,
  });
  assert.deepEqual(koAhead([...E, { an: { k: 'enter', si: 1 } }], 0), { ko: true, si: [1], last: false });
  assert.deepEqual(koAhead([...E, { an: { k: 'enter', si: 0 } }], 0).last, true, 'your side coming in is no foe');
  assert.deepEqual(koAhead([...E, mv(2, 3)], 0).last, false, 'the battle goes on');
  assert.deepEqual(koAhead([mv(0, 1), mv(1, 0), { an: { k: 'faint', si: 1 } }], 0).ko, false, 'after the next move');
  assert.deepEqual(koAhead([mv(0, 1), { an: { k: 'faint', si: 3 } }], 0).ko, false, 'another foe');
  assert.deepEqual(koAhead([mv(0, 1, { spread: true }), { an: { k: 'faint', si: 3 } }], 0).si, [3], 'spread');
  assert.deepEqual(koAhead([{ an: { k: 'faint', si: 1 } }], 0).ko, false, 'not a move');
});

test('gates, repeats, a skip’s classes and the order steps start in', () => {
  const big = Object.keys(MOVES).find(k => MOVES[k].c === 'S' && MOVES[k].p >= 80),
    small = Object.keys(MOVES).find(k => MOVES[k].c === 'S' && (MOVES[k].p || 0) < 80),
    kinds = (mid, ctx, res = 'hit') => battleAnimTimeline(moveAn(mid, res), MOVES[mid], ctx, A).steps.map(s => s.do);
  assert.equal(kinds(big, { gl: true }).filter(k => k === 'camTo').length, 2, 'the sweep on the 3D stage');
  assert.equal(kinds(big, { gl: false }).filter(k => k === 'camTo').length, 0);
  assert.equal(kinds(big, { gl: true, reduced: true }).filter(k => k === 'camTo').length, 0, 'none under Reduced');
  assert.equal(kinds(big, { gl: true }).filter(k => k === 'handheld').length, 1);
  assert.equal(kinds(big, { gl: true }, 'miss').filter(k => k === 'handheld').length, 0, 'not on a miss');
  assert.equal(kinds(small, { gl: true }).filter(k => k === 'handheld').length, 0);
  const T = battleAnimTimeline(moveAn(small, 'hit'), MOVES[small], {}, A),
    lob = T.steps.filter(s => s.do === 'lob');
  assert.deepEqual(
    lob.map(s => [s.at, s.i, s.sync]),
    Array.from({ length: 9 }, (_, i) => [160 + 34 * i, i, false])
  );
  assert.equal(T.steps[0].do, 'focus');
  assert.equal(T.steps[0].sync, true);
  assert.equal(T.steps.find(s => s.do === 'hit').skip, 'info');
  assert.equal(
    T.steps.filter(s => s.do === 'focus').every(s => s.skip === 'run'),
    true
  );
  assert.equal(T.steps.find(s => s.do === 'ring').skip, 'drop');
  const beams = Object.keys(MOVES).filter(k => MOVES[k].c === 'S' && kinds(k, {}).includes('beam'));
  assert.deepEqual([...new Set(beams.map(k => MOVES[k].t))].sort(), ['Electric', 'Psychic', 'Water']);
  const miss = battleAnimTimeline(moveAn(small, 'miss'), MOVES[small], {}, A).steps.filter(s => s.do === 'fling');
  assert.deepEqual(
    miss.map(s => [s.at, s.sync]),
    [0, 45, 90, 135, 180, 225].map(t => [t, false])
  );
  const X = Object.keys(MOVES).find(k => MOVES[k].c === 'X' && !moveAn(k, 'hit').self && !moveAn(k, 'hit').protect),
    Xs = Object.keys(MOVES).find(k => moveAn(k, 'hit').self);
  assert.ok(kinds(X, {}).includes('blink'));
  assert.ok(!kinds(Xs, {}).includes('blink'), 'a move on itself makes nobody dizzy');
});

test('the Faster variant, the quality and the cap on extra time', () => {
  const H = Object.keys(MOVES).find(k => MOVES[k].c === 'H' && (MOVES[k].p || 0) < A.longPower),
    L = Object.keys(MOVES).find(k => MOVES[k].c === 'H' && (MOVES[k].p || 0) >= A.longPower),
    fam = A.families.legacy_hit,
    B = {
      ...A,
      families: {
        ...A.families,
        legacy_hit: { ...fam, dur: 2000, short: { dur: 500, hit: 150, steps: [{ do: 'dust', at: 10, maxQ: 1 }] } },
      },
    };
  const T = battleAnimTimeline(moveAn(H, 'hit'), MOVES[H], { speed: 1 }, B);
  assert.equal(T.dur, 880, 'a normal move is never longer than its default family');
  assert.equal(T.variant, 'full');
  assert.equal(battleAnimTimeline(moveAn(L, 'hit'), MOVES[L], { speed: 1 }, B).dur, 880 + 500);
  assert.equal(battleAnimTimeline(moveAn(L, 'hit'), MOVES[L], { speed: 1, reduced: true }, B).dur, 880);
  const F = battleAnimTimeline(moveAn(H, 'hit'), MOVES[H], { speed: 2.2 }, B);
  assert.equal(F.variant, 'short');
  assert.deepEqual([F.dur, F.hit], [500, 150]);
  assert.ok(F.steps.some(s => s.do === 'dust'));
  assert.ok(!battleAnimTimeline(moveAn(H, 'hit'), MOVES[H], { speed: 2.2, q: 2 }, B).steps.some(s => s.do === 'dust'));
  assert.equal(battleAnimTimeline(moveAn(H, 'hit'), MOVES[H], { speed: 2.2 }, A).variant, 'full', 'none to play');
});

test('the flash limiter: 3 in any second, 333 ms apart, no saturated red', () => {
  const R = A.flashes,
    L = { times: [] },
    at = [0, 100, 333, 666, 999, 1100, 1332, 1700],
    got = at.map(t => flashGate(L, t, '#FFFFFF', R));
  assert.deepEqual(got, ['full', 'gap', 'full', 'full', 'rate', 'full', 'gap', 'full']);
  for (let i = 0; i < at.length; i++) {
    const win = at.filter((t, j) => got[j] === 'full' && t <= at[i] && at[i] - t < 1000);
    assert.ok(win.length <= 3);
  }
  assert.equal(flashGate({ times: [] }, 0, '#FF1010', R), 'red');
  assert.equal(flashGate({ times: [] }, 0, '#5A1030', R), 'full', 'the Alpha’s dark flash is not saturated red');
  assert.ok(redShare('#FF0000') === 1 && redShare('#FFFFFF') < 0.34 && redShare('nope') === 0);
});

test('the debug log line names the move, its family, tier and variant, nothing else', () => {
  const H = Object.keys(MOVES).find(k => MOVES[k].c === 'H'),
    T = battleAnimTimeline(moveAn(H, 'crit'), MOVES[H], { q: 1 }, A);
  assert.equal(battleAnimLogLine(H, T, 1, []), `${H} family:legacy_hit crit full q1${T.long ? ' long' : ''}`);
  assert.match(battleAnimLogLine(H, T, 1, ['gap', 'red']), / held:gap,red$/);
  assert.equal(battleAnimLogLine(H, null, 0, []), `${H} none`);
});

test('every move x outcome’s timeline (snapshot)', t => {
  const out = {};
  for (const mid of Object.keys(MOVES))
    for (const res of OUTCOMES) {
      const T = battleAnimTimeline(moveAn(mid, res), MOVES[mid], { gl: true, q: 0, speed: 1 }, A);
      out[`${mid} ${res}`] =
        `${T.id} ${T.tier} ${T.dur}/${T.hit} ${T.steps.map(s => `${s.do}@${s.at}${s.sync ? '' : '+'}`).join(' ')}`;
    }
  t.assert.snapshot(out);
});
