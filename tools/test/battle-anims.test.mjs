// VFX track VFX-8: a move's animation as data (game/js/logic/battle-anims.js, game/data/battleAnims.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGameData } from '../data-files.mjs';
import { readFileSync } from 'node:fs';
import {
  BATTLE_ANIM_OUTCOMES,
  battleAnimFor,
  battleAnimFrame,
  battleIconSprite,
  battleRampColors,
  battleAnimLogLine,
  battleAnimPreviewEvent,
  battleAnimTimeline,
  battleKitFor,
  battleKitRoles,
  battleKitSteps,
  battlePartOffset,
  battlePathAt,
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

/* VFX-11: the gates, repeats and variants below were written against the legacy families: they run on a move with
   no anim of its own, with the legacy families as the defaults (as before VFX-11). VFX-13 took them out of the game's
   data (nothing named them): they are a fixture here */
const LEGACY = JSON.parse(
    readFileSync(new URL('./fixtures/battle-anims-legacy.json', import.meta.url), 'utf8')
  ).families,
  L = {
    ...A,
    families: { ...A.families, ...LEGACY },
    defaults: { ...A.defaults, H: 'legacy_hit', S: 'legacy_cast', X: 'legacy_status', protect: 'legacy_guard' },
  };
const bare = mid => {
  const { anim: _a, ...M } = MOVES[mid];
  return M;
};

test('every move in 8 outcomes, on the 3D stage and off it, plays no longer than it did (VFX-11: at most maxMs; VFX-17: a scene + extraMs)', () => {
  let n = 0;
  for (const mid of Object.keys(MOVES))
    for (const res of OUTCOMES)
      for (const gl of [true, false])
        for (const speed of [1, 2.2]) {
          const an = moveAn(mid, res),
            T = battleAnimTimeline(an, MOVES[mid], { gl, q: 0, speed }, A),
            old = legacyDurHit(an, MOVES[mid]);
          assert.ok(
            T.dur <= old.dur + (T.kind === 'scene' ? A.extraMs : 0),
            `${mid} ${res}: ${T.dur} ms, over ${old.dur}`
          );
          assert.ok(T.hit === 999 || T.hit <= T.dur, `${mid} ${res}: hits after it ends`);
          assert.equal(T.hit === 999, old.hit === 999, `${mid} ${res}: a hit where there was none, or none`);
          n++;
        }
  assert.equal(n, Object.keys(MOVES).length * 32);
  assert.equal(Object.keys(MOVES).length, 122);
});

test('VFX-11: every move names one of the 16 families, the table’s counts', () => {
  const count = {};
  /* VFX-17: a move with a scene counts under the family its scene falls back to */
  for (const M of Object.values(MOVES)) {
    const f = A.scenes[M.anim] ? A.scenes[M.anim].family : M.anim;
    count[f] = (count[f] || 0) + 1;
  }
  assert.deepEqual(count, {
    charge: 6,
    dash: 6,
    dive: 6,
    strike: 13,
    slash: 5,
    quake: 5,
    flurry: 5,
    shot: 16,
    beam: 7,
    breath: 4,
    wave: 13,
    storm: 8,
    buff: 8,
    hex: 13,
    guard: 2,
    heal: 5,
  });
  /* the outcome families (a miss's whiff, a block) keep today's one timing, as the legacy ones did */
  for (const [id, F] of Object.entries(A.families))
    if (!id.startsWith('legacy_') && id !== 'whiff' && id !== 'blocked')
      assert.ok(F.short, `${id} has a short variant`);
});

test('the family: a move’s own anim when it lands, else its outcome’s or category’s default', () => {
  const H = Object.keys(MOVES).find(k => MOVES[k].c === 'H'),
    M = bare(H);
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, A), { id: 'strike', kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), MOVES[H], A), { id: MOVES[H].anim, kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'miss'), M, A), { id: 'whiff', kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'blocked'), M, A), { id: 'blocked', kind: 'family' });
  M.anim = 'legacy_cast';
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, L), { id: 'legacy_cast', kind: 'family' });
  assert.deepEqual(battleAnimFor(moveAn(H, 'miss'), M, L), { id: 'whiff', kind: 'family' }, 'a miss is a miss');
  const S = { ...A, scenes: { big: LEGACY.legacy_hit } };
  M.anim = 'big';
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, S), { id: 'big', kind: 'scene' });
  M.anim = 'nosuch';
  assert.deepEqual(battleAnimFor(moveAn(H, 'hit'), M, A), { id: 'strike', kind: 'family' });
  const G = Object.keys(MOVES).find(k => MOVES[k].fx && MOVES[k].fx.protect);
  assert.equal(battleAnimFor(moveAn(G, 'hit'), MOVES[G], A).id, 'guard');
  assert.equal(battleAnimFor(moveAn(G, 'hit'), bare(G), L).id, 'legacy_guard');
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
    kinds = (mid, ctx, res = 'hit') => battleAnimTimeline(moveAn(mid, res), bare(mid), ctx, L).steps.map(s => s.do);
  assert.equal(kinds(big, { gl: true }).filter(k => k === 'camTo').length, 2, 'the sweep on the 3D stage');
  assert.equal(kinds(big, { gl: false }).filter(k => k === 'camTo').length, 0);
  assert.equal(kinds(big, { gl: true, reduced: true }).filter(k => k === 'camTo').length, 0, 'none under Reduced');
  assert.equal(kinds(big, { gl: true }).filter(k => k === 'handheld').length, 1);
  assert.equal(kinds(big, { gl: true }, 'miss').filter(k => k === 'handheld').length, 0, 'not on a miss');
  assert.equal(kinds(small, { gl: true }).filter(k => k === 'handheld').length, 0);
  const T = battleAnimTimeline(moveAn(small, 'hit'), bare(small), {}, L),
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
  const miss = battleAnimTimeline(moveAn(small, 'miss'), bare(small), {}, L).steps.filter(s => s.do === 'fling');
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
    Lg = Object.keys(MOVES).find(k => MOVES[k].c === 'H' && (MOVES[k].p || 0) >= A.longPower),
    fam = LEGACY.legacy_hit,
    B = {
      ...L,
      families: {
        ...L.families,
        legacy_hit: { ...fam, dur: 2000, short: { dur: 500, hit: 150, steps: [{ do: 'dust', at: 10, maxQ: 1 }] } },
      },
    };
  const T = battleAnimTimeline(moveAn(H, 'hit'), bare(H), { speed: 1 }, B);
  assert.equal(T.dur, 880, 'a normal move is never longer than its default family');
  assert.equal(T.variant, 'full');
  assert.equal(battleAnimTimeline(moveAn(Lg, 'hit'), bare(Lg), { speed: 1 }, B).dur, 880 + 500);
  assert.equal(battleAnimTimeline(moveAn(Lg, 'hit'), bare(Lg), { speed: 1, reduced: true }, B).dur, 880);
  const F = battleAnimTimeline(moveAn(H, 'hit'), bare(H), { speed: 2.2 }, B);
  assert.equal(F.variant, 'short');
  assert.deepEqual([F.dur, F.hit], [500, 150]);
  assert.ok(F.steps.some(s => s.do === 'dust'));
  assert.ok(!battleAnimTimeline(moveAn(H, 'hit'), bare(H), { speed: 2.2, q: 2 }, B).steps.some(s => s.do === 'dust'));
  assert.equal(battleAnimTimeline(moveAn(H, 'hit'), bare(H), { speed: 2.2 }, L).variant, 'full', 'none to play');
  assert.equal(
    battleAnimTimeline(moveAn(H, 'hit'), MOVES[H], { speed: 2.2 }, A).variant,
    'short',
    'VFX-11: every family has one'
  );
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
  assert.equal(battleAnimLogLine(H, T, 1, []), `${H} family:${MOVES[H].anim} crit full q1${T.long ? ' long' : ''}`);
  assert.match(battleAnimLogLine(H, T, 1, ['gap', 'red']), / held:gap,red$/);
  assert.equal(battleAnimLogLine(H, null, 0, []), `${H} none`);
});

test('every move x outcome’s timeline (snapshot)', t => {
  const out = {};
  for (const mid of Object.keys(MOVES))
    for (const res of OUTCOMES) {
      const T = battleAnimTimeline(moveAn(mid, res), MOVES[mid], { gl: true, q: 0, speed: 1 }, A);
      out[`${mid} ${res}`] =
        `${T.id}/${T.kit} ${T.tier} ${T.dur}/${T.hit} ${T.steps.map(s => `${s.do}${s.spr ? ':' + [s.spr].flat().join('|') : ''}@${s.at}${s.sync ? '' : '+'}`).join(' ')}`;
    }
  t.assert.snapshot(out);
});

// VFX-10: the effect art's timing and colour
test('a strip steps at 12 fps, an impact its first two frames at 24 fps', () => {
  const S = { frames: 5 };
  assert.deepEqual(
    [0, 82, 84, 250, 333, 1000].map(t => battleAnimFrame({ ...S, impact: true }, t)),
    [0, 1, 2, 4, 4, 4]
  );
  assert.deepEqual(
    [0, 40, 43, 83, 84].map(t => battleAnimFrame({ frames: 4, impact: true }, t)),
    [0, 0, 1, 1, 2]
  );
  assert.equal(battleAnimFrame({ frames: 4, fps: 6 }, 170), 1);
  assert.equal(battleAnimFrame({ frames: 1 }, 500), 0);
});
test('a strip that loops plays round; one that does not ends with its life', () => {
  assert.deepEqual(
    [0, 84, 334, 420].map(t => battleAnimFrame({ frames: 4, loop: true }, t, 2000)),
    [0, 1, 0, 1]
  );
  /* 4 frames at 12 fps take 333 ms: a 1000 ms life holds frame 0 until 667 ms */
  assert.deepEqual(
    [0, 600, 667, 760, 999].map(t => battleAnimFrame({ frames: 4 }, t, 1000)),
    [0, 0, 0, 1, 3]
  );
  assert.equal(battleAnimFrame({ frames: 4 }, 2000, 1000), 3);
});
test('ramps: 7 steps from the palette and a white core; light "type" is the type glow', () => {
  const pal = { ember: ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#000008'] };
  assert.deepEqual(battleRampColors({ ramp: 'ember', light: 'type' }, pal, '#FFFFFF', '#E0603A'), {
    steps: ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#FFFFFF'],
    light: '#E0603A',
  });
  assert.equal(battleRampColors({ ramp: 'nope', light: '#FFFFFF' }, pal, '#FFFFFF'), null);
  assert.equal(battleRampColors({ ramp: [...pal.ember], light: '#123456' }, {}, '#FFFFFF').light, '#123456');
});
test("the game's ramps: every type has one, every ramp resolves against NW_PALETTE, the schema's names are the palette's", () => {
  const js = readFileSync(new URL('../../game/art/next/palette.js', import.meta.url), 'utf8'),
    pal = JSON.parse(js.slice(js.indexOf('=') + 1, js.lastIndexOf(';'))).ramps,
    names = Object.keys(pal).filter(k => Array.isArray(pal[k])),
    schema = JSON.parse(
      readFileSync(new URL('../../game/data/schema/battleAnims.schema.json', import.meta.url), 'utf8')
    );
  assert.deepEqual(schema.properties.ramps.additionalProperties.properties.ramp.oneOf[0].enum, names);
  for (const t of [...D.types.map(t => t.id), 'None'])
    assert.ok(battleRampColors(A.ramps[t], pal, A.colors.white), `${t} has a ramp`);
  for (const [id, R] of Object.entries(A.ramps)) assert.ok(battleRampColors(R, pal, A.colors.white), `${id} resolves`);
});
test('icons drawn as strips: a typed particle takes its type ramp, an untyped one the icon ramp', () => {
  assert.deepEqual(battleIconSprite(A, 'spark', 'Grass'), { sprite: 'spark', ramp: 'Grass' });
  assert.deepEqual(battleIconSprite(A, 'spark'), { sprite: 'spark', ramp: 'Electric' });
  assert.deepEqual(battleIconSprite(A, 'spark', 'Dynasty'), { sprite: 'spark', ramp: 'Electric' });
  assert.equal(battleIconSprite(A, 'cog', 'Steel'), null);
  for (const t of D.types) for (const k of t.fx || []) battleIconSprite(A, k, t.id);
});
test('the data check flags a sprite whose anchor is outside its cell, an effect of 2 frames and an icon with no sprite', async () => {
  const { dataBattleAnims } = await import('../../game/js/logic/data-checks.js');
  const B = structuredClone(A);
  B.sprites.spark.anchor = [9, 3];
  B.sprites.star.frames = 2;
  B.iconSprites.spark.sprite = 'nope';
  delete B.ramps.Fire;
  const out = dataBattleAnims({ ...D, battleAnims: B }).map(p => p[1]);
  assert.ok(out.some(w => w.startsWith('sprites.spark.anchor')));
  assert.ok(out.some(w => w.startsWith('sprites.star: an effect has 3 to 8 frames')));
  assert.ok(out.some(w => w.startsWith('iconSprites.spark.sprite')));
  assert.ok(out.some(w => w === 'ramps: no ramp for the type "Fire"'));
  assert.deepEqual(dataBattleAnims(D), []);
});

// VFX-11: the type kits and the paths things fly on
test('a move plays in its type’s kit; a Bureau bot’s in the Bureau’s; an unknown type in None’s', () => {
  assert.equal(battleKitFor(A, 'Fire').id, 'Fire');
  assert.equal(battleKitFor(A, 'Fire', true).id, 'Bureau');
  assert.equal(battleKitFor(A, 'Dynasty').id, 'None');
  assert.equal(battleKitFor({ ...A, types: undefined }, 'Fire'), null);
  for (const t of [...D.types.map(t => t.id), 'None', 'Bureau']) {
    const K = A.types[t];
    for (const sp of [K.shot, K.impact, K.small, ...K.bits]) assert.ok(A.sprites[sp], `${t}: ${sp}`);
    assert.ok(K.light.ms <= 300, `${t}: a light lasts 300 ms at most (Budgets)`);
  }
  const T = battleAnimTimeline(moveAn('post3am', 'hit'), MOVES.post3am, {}, A);
  assert.equal(T.kit, 'Fire');
  assert.equal(battleAnimTimeline(moveAn('post3am', 'hit'), MOVES.post3am, { bureau: true }, A).kit, 'Bureau');
});
test('kit steps play at their family step’s time, on its Billie, behind both gates; roles name the kit’s sprites', () => {
  const K = {
      ...A.types.None,
      hit: [
        { do: 'ring', at: 20, color: 'kit' },
        { do: 'shake', if: ['power80'] },
      ],
    },
    G = new Set(['H', 'dmg']),
    L2 = battleKitSteps(
      [{ do: 'kit', part: 'hit', at: 100, on: 'target', if: ['dmg'], each: 1 }, { do: 'hit' }],
      K,
      G,
      'None',
      0
    );
  assert.deepEqual(L2, [
    { do: 'ring', at: 120, color: 'kit', on: 'target', if: ['dmg'], each: 1 },
    { do: 'shake', on: 'target', at: 100, if: ['dmg', 'power80'], each: 1 },
    { do: 'hit' },
  ]);
  assert.deepEqual(battleKitSteps([{ do: 'kit', part: 'hit', if: ['!dmg'] }], K, G, 'None', 0), [], 'its gate fails');
  assert.deepEqual(battleKitSteps([{ do: 'kit', part: 'cast' }], K, G, 'None', 0), [], 'no cast steps');
  const F = A.types.Fire;
  assert.deepEqual(battleKitRoles({ do: 'impact', spr: 'impact' }, F), { do: 'impact', spr: F.impact, ramp: 'Fire' });
  assert.equal(battleKitRoles({ do: 'spray', spr: 'bits' }, F).spr, F.bits);
  assert.equal(battleKitRoles({ do: 'rise', spr: 'plus', ramp: 'heal' }, F).ramp, 'heal', 'a step’s own ramp wins');
  assert.equal(battleKitRoles({ do: 'projectile', spr: 'shot', path: 'kit' }, A.types.Electric).path, 'zigzag');
  assert.equal(battleKitRoles({ do: 'impact', spr: 'bits' }, A.types.Dragon).ramp2, 'Fire', 'Dragon’s two-tone');
  assert.deepEqual(battleKitRoles({ do: 'ring' }, F), { do: 'ring' }, 'a step that draws no sprite');
});
test('the new gates: drain, heal, drop, spread, aim, a Bureau bot', () => {
  const has = (mid, gate, an = moveAn(mid, 'hit'), ctx = {}) =>
    battleAnimTimeline(an, { ...MOVES[mid], anim: 'legacy_hit' }, ctx, {
      ...A,
      families: { legacy_hit: { dur: 100, hit: 50, steps: [{ do: 'shake', if: [gate] }] } },
      intro: [],
    }).steps.length === 1;
  assert.ok(has('harvest', 'drain') && !has('disrupt', 'drain'));
  assert.ok(has('deepdrill', 'heal') && has('rerecord', 'heal'));
  assert.ok(has('snub', 'drop') && !has('rebrand', 'drop'), 'a stat it lowers on the foe');
  assert.ok(has('headline', 'spread', { ...moveAn('headline', 'hit'), spread: true }) && !has('headline', 'spread'));
  assert.ok(has('augerbore', 'aim', { ...moveAn('augerbore', 'hit'), part: 'armL' }) && !has('augerbore', 'aim'));
  assert.ok(!has('lawsuit', 'aim', { ...moveAn('lawsuit', 'hit'), part: 'armL' }), 'a move that doesn’t aim');
  assert.ok(has('post3am', 'bureau', moveAn('post3am', 'hit'), { bureau: true }) && !has('post3am', 'bureau'));
});
test('paths start at a and end at b; an arc rises, a zigzag and a spiral leave the line, a stamp falls onto b', () => {
  const a = [0, 1, 0],
    b = [4, 1, 2],
    near = (p, q) => p.every((v, i) => Math.abs(v - q[i]) < 1e-9);
  for (const kind of ['straight', 'arc', 'zigzag', 'spiral', 'wave']) {
    const P = { kind, a, b, h: 1, amp: 0.5, turns: 2 };
    assert.ok(near(battlePathAt(P, 0), a), `${kind} starts at a`);
    assert.ok(near(battlePathAt(P, 1), b), `${kind} ends at b`);
    assert.ok(near(battlePathAt(P, 2), b), `${kind} holds at b`);
  }
  assert.ok(near(battlePathAt({ a, b }, 0.5), [2, 1, 1]), 'straight');
  assert.equal(battlePathAt({ kind: 'arc', a, b, h: 1 }, 0.5)[1], 2, 'an arc is h higher in its middle');
  const z = battlePathAt({ kind: 'zigzag', a, b, amp: 0.5, turns: 2 }, 0.25);
  assert.ok(!near(z, battlePathAt({ a, b }, 0.25)), 'a zigzag leaves the line');
  const sp = battlePathAt({ kind: 'spiral', a, b, amp: 0.5, turns: 1 }, 0.25);
  assert.ok(Math.abs(sp[1] - 1 - 0.5 * Math.sin(Math.PI / 4)) < 1e-9, 'a spiral goes round the line');
  assert.deepEqual(battlePathAt({ kind: 'stamp', a, b, h: 3 }, 0), [4, 4, 2]);
  assert.deepEqual(battlePathAt({ kind: 'stamp', a, b, h: 3 }, 1), [4, 1, 2]);
});
test('an aimed move hits its part where the stage drops a broken one', () => {
  assert.deepEqual(battlePartOffset('armL'), [-0.3, null]);
  assert.deepEqual(battlePartOffset('armR'), [0.3, null]);
  assert.deepEqual(battlePartOffset('legs'), [0, 0.25]);
  assert.deepEqual(battlePartOffset('torso'), [0, null]);
  assert.deepEqual(battlePartOffset(undefined), [0, null]);
});
test('every family’s strips are sprites and its kit roles resolve in every kit; spread steps play on each foe', () => {
  for (const [id, F] of Object.entries(A.families))
    for (const V of [F, F.short].filter(Boolean))
      for (const S of V.steps)
        for (const t of Object.keys(A.types).filter(k => k !== 'about')) {
          const R = battleKitRoles(S, A.types[t]);
          for (const sp of [R.spr].flat().filter(Boolean)) assert.ok(A.sprites[sp], `${id} in ${t}: ${sp}`);
        }
  const T = battleAnimTimeline({ ...moveAn('headline', 'hit'), spread: true }, MOVES.headline, {}, A);
  assert.ok(
    T.steps.some(s => s.do === 'impact' && s.each),
    'Surge Wave hits each foe'
  );
});
