// VFX track VFX-18: signature scenes, batch 2 (game/data/battleAnims.json scenes, VFX-17's primitives)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readGameData } from '../data-files.mjs';
import { battleAnimTimeline, battleSceneProps } from '../../game/js/logic/battle-anims.js';

const D = readGameData(),
  A = D.battleAnims,
  MOVES = D.moves;
/** a landed move's event, as the Studio's battle preview builds it */
const hitAn = (mid, si = 0) => ({ k: 'move', si, ti: 1 - si, mid, dmg: MOVES[mid].c === 'X' ? 0 : 30, te: 1 });
/** the batch and the family each move had before its scene */
const BATCH = {
  cudacall: 'breath',
  rollback: 'charge',
  terminalfee: 'hex',
  onemorething: 'shot',
  justdoit: 'dash',
  fastfashion: 'shot',
  sprucedive: 'dive',
  popthecollar: 'hex',
  assemblyline: 'flurry',
  perminute: 'hex',
  imout: 'strike',
  feelinglucky: 'beam',
  charlimit: 'shot',
  shuffleplay: 'wave',
  smartcontract: 'shot',
  buythedip: 'heal',
  insync: 'flurry',
  empirestate: 'slash',
  sundayred: 'strike',
};
const IDS = Object.keys(BATCH);
/** the icons.png cells (game/art/manifest.js) */
const ICONS = JSON.parse(
  readFileSync('game/art/manifest.js', 'utf8')
    .replace(/^window\.ARTMAN=/, '')
    .replace(/;\s*$/, '')
).icons;
const stepsOf = id => [...A.scenes[id].steps, ...A.scenes[id].short.steps];

test('the 19 signature moves name their scene, which falls back to the family each had', () => {
  for (const id of IDS) {
    assert.ok(MOVES[id].sig, `${id} is a signature move`);
    assert.equal(MOVES[id].anim, id);
    assert.equal(A.scenes[id].family, BATCH[id], `${id} falls back to ${BATCH[id]}`);
  }
  /* one block after VFX-17's last scene, in the batch's order */
  const keys = Object.keys(A.scenes),
    at = keys.indexOf('cudacall');
  assert.ok(at > keys.indexOf('billionsserved'));
  assert.deepEqual(keys.slice(at, at + IDS.length), IDS);
});

test('times: a scene within maxMs + 500 ms, a status scene and every short version within maxMs; none longer under Reduced motion', () => {
  for (const id of IDS) {
    const S = A.scenes[id],
      c = MOVES[id].c,
      cap = A.maxMs[c];
    assert.ok(S.dur <= (c === 'X' ? cap : cap + A.extraMs), `${id}: ${S.dur}`);
    assert.ok(S.short.dur <= cap, `${id} short: ${S.short.dur}`);
    assert.ok(S.short.hit < S.hit, `${id}: the repeat lands sooner`);
    const R = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: true, reduced: true }, A);
    assert.deepEqual([R.kind, R.id], ['family', BATCH[id]]);
    assert.ok(R.dur <= cap, `${id} under Reduced motion: ${R.dur}`);
    const T = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: true, speed: 1 }, A);
    assert.deepEqual([T.kind, T.id, T.variant], ['scene', id, 'full']);
    const F = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: true, speed: 2.2 }, A);
    assert.equal(F.variant, 'short', `${id} at Faster`);
  }
});

test('with 3D props off a scene with a model plays its family; one with icons only still plays', () => {
  for (const id of IDS) {
    const P = battleAnimTimeline(hitAn(id), MOVES[id], { gl: true, props: false }, A),
      models = battleSceneProps(A, id);
    for (const m of models) assert.ok(existsSync(`game/art/scene/next/models/${m}.json`), `${id}: ${m}`);
    assert.equal(P.kind, models.length ? 'family' : 'scene', id);
  }
  assert.deepEqual(battleSceneProps(A, 'cudacall'), ['wind_turbine_small']);
  assert.deepEqual(battleSceneProps(A, 'imout'), []);
});

test('rule 10: icons are icons.png cells; stamps are the drawn sound words, and none on a slogan or catchphrase move', () => {
  const words = new Set(['word_whirr', 'word_tick', 'word_click', 'word_fore']);
  for (const id of IDS)
    for (const s of stepsOf(id)) {
      for (const ic of [s.icon || []].flat()) assert.ok(ICONS[ic], `${id}: icon ${ic}`);
      if (s.do === 'stamp') assert.ok(words.has(s.spr) && A.sprites[s.spr], `${id}: ${s.spr}`);
    }
  for (const id of ['justdoit', 'imout', 'feelinglucky', 'onemorething'])
    assert.ok(!stepsOf(id).some(s => s.do === 'stamp'), `${id} stamps nothing`);
});

test('a damaging scene lands its hit step at its hit; a status scene has none, as its family', () => {
  for (const id of IDS)
    for (const V of [A.scenes[id], A.scenes[id].short]) {
      const hit = V.steps.find(s => s.do === 'hit');
      if (MOVES[id].c === 'X') assert.ok(!hit, `${id}: no hit step`);
      else assert.ok(hit && hit.at === V.hit && hit.if.includes('dmg'), id);
    }
});
