// VFX track VFX-18b: signature scenes 3 (game/data/battleAnims.json scenes, VFX-17's primitives)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGameData } from '../data-files.mjs';
import { existsSync } from 'node:fs';
import { battleAnimTimeline, battleEventProps, battleSceneProps } from '../../game/js/logic/battle-anims.js';

const D = readGameData(),
  A = D.battleAnims,
  MOVES = D.moves;
const hitAn = (mid, si = 0) => ({ k: 'move', si, ti: 1 - si, mid, dmg: 30, te: 1 });
/* the batch, each with the family it played before its scene (its fallback) */
const BATCH = {
  cyclone: 'storm',
  giveswings: 'buff',
  statesizedpit: 'quake',
  perfectfold: 'hex',
  harbourfee: 'wave',
  principle: 'buff',
  frontrun: 'dash',
  wrongname: 'wave',
  cleaningfee: 'shot',
  autoplay: 'wave',
  fork: 'hex',
  countstotwo: 'flurry',
  fifteensec: 'shot',
  stakeineverything: 'shot',
  shipdirect: 'shot',
  onehandedbackhand: 'slash',
  greenhydrogen: 'beam',
  quietgift: 'heal',
  kisses: 'charge',
};
const WORDS = ['word_whoosh', 'word_pssht', 'word_dingdong', 'word_thwock', 'word_kaching'];

test('the batch: 19 signature moves each name their scene, falling back to the family they had', () => {
  for (const [id, fam] of Object.entries(BATCH)) {
    assert.ok(MOVES[id] && MOVES[id].sig, `${id} is a signature move`);
    assert.equal(MOVES[id].anim, id);
    assert.equal(A.scenes[id].family, fam, `${id} falls back to ${fam}`);
  }
});

test('times: an attack at most maxMs + 500 ms; a status scene and every short version within maxMs', () => {
  for (const id of Object.keys(BATCH)) {
    const S = A.scenes[id],
      c = MOVES[id].c,
      cap = A.maxMs[c];
    assert.ok(S.dur <= (c === 'X' ? cap : cap + A.extraMs), `${id}: ${S.dur}`);
    assert.ok(S.short.dur <= cap, `${id} short: ${S.short.dur}`);
    for (const reduced of [true, false]) {
      const T = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: true, reduced }, A);
      if (reduced) assert.deepEqual([T.kind, T.id], ['family', BATCH[id]], `${id} under Reduced motion`);
      else assert.deepEqual([T.kind, T.id], ['scene', id]);
      if (reduced) assert.ok(T.dur <= cap, `${id} under Reduced motion: ${T.dur}`);
    }
  }
});

test('with 3D props off a scene with models plays its family; one without plays anyway', () => {
  for (const id of Object.keys(BATCH)) {
    const T = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: false }, A);
    assert.equal(T.kind, battleSceneProps(A, id).length ? 'family' : 'scene', id);
  }
  assert.deepEqual(battleSceneProps(A, 'autoplay'), ['sofa']);
  assert.deepEqual(battleSceneProps(A, 'cyclone'), []);
});

test('a foe’s scene (side 1) and a repeat build their timelines', () => {
  for (const id of Object.keys(BATCH)) {
    const T = battleAnimTimeline(hitAn(id, 1), MOVES[id], { gl: true, props: true }, A);
    assert.equal(T.id, id);
    const R = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: true, seen: true }, A);
    assert.deepEqual([R.variant, R.repeat], ['short', true], id);
  }
});

test('stamps are drawn sound words only (rule 10): the four new words and KA-CHING!', () => {
  for (const w of WORDS) assert.ok(A.sprites[w], w);
  for (const id of Object.keys(BATCH))
    for (const s of [...A.scenes[id].steps, ...A.scenes[id].short.steps])
      if (s.do === 'stamp') assert.ok(WORDS.includes(s.spr), `${id}: ${s.spr}`);
});

test('the bots’ part and gem moves are regular moves: they keep their families, no scene', () => {
  const R = D.robots,
    ids = new Set([...Object.values(R.parts), ...Object.values(R.gems)].map(p => p.move).filter(Boolean));
  assert.ok(ids.size >= 10);
  for (const mid of ids) {
    assert.ok(MOVES[mid], mid);
    assert.ok(!MOVES[mid].sig && A.families[MOVES[mid].anim], `${mid} plays a family`);
  }
});

test('the boss’s own: its shield phase summons barriers (events.bossPhase), within the phase’s 1200 ms', () => {
  const E = A.events.bossPhase;
  assert.deepEqual(battleEventProps(A), ['bureau_barrier']);
  for (const id of battleEventProps(A)) assert.ok(existsSync(`game/art/scene/next/models/${id}.json`), id);
  for (const s of E.steps) {
    assert.equal(s.do, 'prop', 'props only: no stamp against the Bureau, no flash of its own');
    assert.ok(s.at + s.ms + (s.hold || 0) + (s.out ?? 250) <= 1200, 'gone by the phase’s end');
  }
  assert.deepEqual(battleEventProps({}), []);
  assert.equal(
    E.faction,
    D.bosses.bosses.retrieval.faction,
    'its boss is picked by faction (SY-5’s bosses.json faction)'
  );
  assert.ok(
    D.bosses.bosses.retrieval.phases.some(p => p.shield),
    'the Retrieval Unit has a shield phase'
  );
});
