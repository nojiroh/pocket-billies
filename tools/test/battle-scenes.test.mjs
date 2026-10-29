// VFX track VFX-17: signature scenes (game/js/logic/battle-anims.js, game/data/battleAnims.json scenes)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readGameData } from '../data-files.mjs';
import {
  battleAnimFor,
  battleAnimLogLine,
  battleAnimTimeline,
  battlePropAt,
  battleSceneFallback,
  battleSceneProps,
} from '../../game/js/logic/battle-anims.js';
import { dataBattleAnims } from '../../game/js/logic/data-checks.js';

const D = readGameData(),
  A = D.battleAnims,
  MOVES = D.moves,
  SCENES = Object.keys(A.scenes);
/** a landed move's event, as the Studio's battle preview builds it */
const hitAn = (mid, si = 0) => ({ k: 'move', si, ti: 1 - si, mid, dmg: 30, te: 1 });
const BATCH = [
  'towerdrop',
  'zerotoone',
  'visionfund',
  'thedecision',
  'concretepour',
  'blastfurnace',
  'hallucinate',
  'developers',
  'siu',
  'fullsteam',
  'standardoil',
  'goldencaravan',
];

test('the batch: the 12 signature moves of power 100+ and 6 more each name their scene; nothing else does', () => {
  for (const mid of BATCH) {
    assert.ok(MOVES[mid].sig && MOVES[mid].p >= A.longPower, `${mid} is a signature move of power 100+`);
    assert.equal(MOVES[mid].anim, mid);
  }
  const named = Object.keys(MOVES).filter(k => A.scenes[MOVES[k].anim]);
  assert.ok(named.length >= 18, 'VFX-17’s 18 and the later batches’');
  for (const k of named) assert.ok(MOVES[k].sig, `${k} is a signature move`);
  assert.deepEqual(named.sort(), SCENES.slice().sort());
  for (const k of Object.keys(MOVES)) if (MOVES[k].sig && MOVES[k].p >= A.longPower) assert.ok(named.includes(k), k);
});

test('a scene plays at most its category’s maxMs + 500 ms, its short version within maxMs; it hits before it ends', () => {
  for (const id of SCENES) {
    const S = A.scenes[id],
      M = MOVES[id],
      cap = A.maxMs[M.c];
    assert.ok(S.dur <= cap + A.extraMs, `${id}: ${S.dur} over ${cap + A.extraMs}`);
    assert.ok(S.short.dur <= cap, `${id} short: ${S.short.dur} over ${cap}`);
    for (const V of [S, S.short]) {
      assert.ok(V.hit <= V.dur, `${id}: hits after it ends`);
      const hit = V.steps.find(s => s.do === 'hit');
      assert.ok(hit && hit.at === V.hit, `${id}: its hit step is at its hit`);
    }
    assert.equal(S.family, D.moves[id].anim === id ? S.family : null);
    assert.ok(A.families[S.family], `${id}: falls back to a family`);
  }
});

test('the timeline: a scene on the 3D stage with its models; its family under Reduced motion or with props off', () => {
  const T = battleAnimTimeline(hitAn('towerdrop'), MOVES.towerdrop, { gl: true, props: true, speed: 1 }, A);
  assert.deepEqual([T.kind, T.id, T.variant, T.dur, T.long], ['scene', 'towerdrop', 'full', 1300, true]);
  assert.ok(T.steps.some(s => s.do === 'prop' && s.prop === 'city_tower_slab'));
  const R = battleAnimTimeline(hitAn('towerdrop'), MOVES.towerdrop, { gl: true, props: true, reduced: true }, A);
  assert.deepEqual([R.kind, R.id], ['family', 'dive']);
  assert.ok(R.dur <= A.maxMs.H, 'none longer under Reduced motion');
  const P = battleAnimTimeline(hitAn('towerdrop'), MOVES.towerdrop, { gl: true, props: false }, A);
  assert.deepEqual([P.kind, P.id], ['family', 'dive']);
  /* a scene with no model plays with props off; Reduced motion still takes its family */
  assert.equal(battleAnimTimeline(hitAn('siu'), MOVES.siu, { props: false }, A).kind, 'scene');
  assert.equal(battleAnimTimeline(hitAn('siu'), MOVES.siu, { reduced: true }, A).id, 'dive');
  /* a miss never plays the scene: its family's whiff (VFX-13), else the default miss */
  const miss = battleAnimFor({ ...hitAn('siu'), miss: true, dmg: 0 }, MOVES.siu, A),
    F = A.families[A.scenes.siu.family];
  assert.equal(miss.kind, 'family');
  assert.equal(miss.id, F && F.miss ? A.scenes.siu.family : A.defaults.miss);
  assert.equal(battleSceneFallback(null, {}, A), null);
  for (const id of SCENES) {
    const any = battleAnimTimeline(hitAn(id), MOVES[id], { reduced: true }, A);
    assert.ok(any.dur <= A.maxMs[MOVES[id].c], `${id} under Reduced motion: ${any.dur}`);
  }
});

test('a repeat in the same battle and the Faster speed play the short version: the prop and the hit', () => {
  const T = battleAnimTimeline(hitAn('goldencaravan'), MOVES.goldencaravan, { gl: true, props: true, seen: true }, A);
  assert.deepEqual([T.kind, T.variant, T.repeat, T.dur], ['scene', 'short', true, A.scenes.goldencaravan.short.dur]);
  assert.ok(T.steps.some(s => s.do === 'prop') && T.steps.some(s => s.do === 'hit'));
  assert.match(
    battleAnimLogLine('goldencaravan', T, 0, []),
    /^goldencaravan scene:goldencaravan neutral short repeat q0/
  );
  const F = battleAnimTimeline(hitAn('goldencaravan'), MOVES.goldencaravan, { props: true, speed: 2.2 }, A);
  assert.equal(F.variant, 'short');
  assert.equal(F.repeat, undefined);
  for (const id of SCENES) {
    const S = A.scenes[id],
      first = (S.steps.find(s => s.do === 'hit') || {}).at,
      again = (S.short.steps.find(s => s.do === 'hit') || {}).at;
    assert.ok(again < first, `${id}: the repeat hits sooner (no wind-up)`);
  }
});

test('the scenes’ models exist (game/art/scene/next/models), every scene’s prop steps listed once', () => {
  const all = battleSceneProps(A);
  assert.ok(all.length >= 10);
  assert.equal(new Set(all).size, all.length);
  for (const id of all) assert.ok(existsSync(`game/art/scene/next/models/${id}.json`), id);
  assert.deepEqual(battleSceneProps(A, 'towerdrop'), ['city_tower_slab']);
  assert.deepEqual(battleSceneProps(A, 'siu'), []);
  assert.deepEqual(battleSceneProps(A, 'nope'), []);
});

test('only sound words are stamped (rule 10), each a strip', () => {
  for (const id of SCENES)
    for (const s of [...A.scenes[id].steps, ...A.scenes[id].short.steps])
      if (s.do === 'stamp') assert.ok(/^word_/.test(s.spr) && A.sprites[s.spr], `${id}: ${s.spr}`);
});

test('a summoned model flies from a to b, holds, then erodes in 12 fps steps; a stamp’s fall speeds up', () => {
  const P = { t0: 100, ms: 400, hold: 200, out: 250, path: { kind: 'stamp', a: [0, 3, 0], b: [1, 0, 2], h: 3 } };
  const at = t => battlePropAt(P, t);
  assert.deepEqual([at(100).x, at(100).y, at(100).z], [1, 3, 2]);
  assert.deepEqual([at(500).x, at(500).y, at(500).z], [1, 0, 2]);
  assert.ok(at(150).flying && !at(520).flying);
  assert.ok(at(150).pace < 1 && at(480).pace > 1.3, 'slow at its top, fast as it lands');
  assert.equal(at(650).fade, 1, 'whole while it holds');
  const fades = [701, 790, 870].map(t => at(t).fade);
  assert.ok(Math.abs(fades[0] - 2 / 3) < 1e-9 && Math.abs(fades[1] - 1 / 3) < 1e-9 && fades[2] === 0);
  assert.ok(at(870).gone && !at(790).gone);
  for (let t = 701; t < 960; t += 10)
    assert.ok(
      [1, 2 / 3, 1 / 3, 0].some(v => Math.abs(at(t).fade - v) < 1e-9),
      'stepped'
    );
  const S = { t0: 0, ms: 300, path: { kind: 'straight', a: [0, 0, 0], b: [3, 0, 0] }, yaw: 0.5, turn: 0.5, tumble: 1 };
  assert.ok(Math.abs(battlePropAt(S, 300).yaw - (0.5 + Math.PI)) < 1e-9);
  assert.ok(Math.abs(battlePropAt(S, 300).tum - 2 * Math.PI) < 1e-9);
  assert.equal(battlePropAt({ ...S, ease: 'in' }, 150).x, 0.75);
});

test('the data check: a scene must fall back to a family and fit its moves’ time', () => {
  const bad = structuredClone(D);
  bad.battleAnims.scenes.siu.family = 'nope';
  bad.battleAnims.scenes.towerdrop.dur = 2000;
  bad.battleAnims.scenes.cutto.short.dur = 1200;
  const out = dataBattleAnims(bad).map(p => p[1]);
  assert.ok(out.some(w => /scenes\.siu\.family: no family "nope"/.test(w)));
  assert.ok(out.some(w => /the scene "towerdrop" plays 2000 ms/.test(w)));
  assert.ok(out.some(w => /the scene "cutto"'s short version plays 1200 ms/.test(w)));
  assert.deepEqual(dataBattleAnims(D), []);
});
