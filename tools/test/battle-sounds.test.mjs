// VFX track VFX-19: the battle's sounds (game/js/logic/battle-sounds.js) on the game's own data (music.json battle,
// battleAnims.json): every family and type kit has a sound, the play lists, the hurt kinds, the findings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BATTLE_SOUND_CATCH,
  BATTLE_SOUND_HURT,
  BATTLE_SOUND_PITCH,
  battleHurtKind,
  battleMoveSound,
  battleSoundFamily,
  battleSoundFindings,
  battleSoundGet,
  battleSoundLength,
  battleSoundNames,
  battleSoundPlays,
  battleSoundPreview,
} from '../../game/js/logic/battle-sounds.js';
import { MUSIC_CHOICES } from '../../game/js/logic/music-studio.js';

const json = f => JSON.parse(readFileSync(new URL('../../game/data/' + f, import.meta.url), 'utf8'));
const MUSIC = json('music.json'),
  B = MUSIC.battle,
  A = json('battleAnims.json'),
  MOVES = json('moves.json'),
  S = json('schema/music.schema.json');
const families = Object.keys(A.families).filter(k => !k.startsWith('legacy_')),
  kits = Object.keys(A.types).filter(k => k !== 'about');

test('every move family and type kit has a sound, and nothing else', () => {
  assert.equal(families.length, 16);
  assert.deepEqual(Object.keys(B.families).sort(), [...families].sort());
  assert.deepEqual(Object.keys(B.types).sort(), [...kits].sort());
  assert.deepEqual(Object.keys(B.hurt).sort(), [...BATTLE_SOUND_HURT].sort());
  assert.deepEqual(Object.keys(B.catch).sort(), [...BATTLE_SOUND_CATCH].sort());
  assert.ok(B.recall && B.recall.voices.length);
  assert.deepEqual(
    battleSoundFindings(B, { families, types: kits }).filter(f => f.lvl !== 'info'),
    []
  );
});

test('the hurt and catch lists, the Studio’s choices and the schema agree', () => {
  const P = S.properties.battle.properties;
  assert.deepEqual(P.hurt.propertyNames.enum, BATTLE_SOUND_HURT);
  assert.deepEqual(P.catch.propertyNames.enum, BATTLE_SOUND_CATCH);
  assert.deepEqual(
    MUSIC_CHOICES.battleHurt.map(c => c[0]),
    BATTLE_SOUND_HURT
  );
  assert.deepEqual(
    MUSIC_CHOICES.battleCatch.map(c => c[0]),
    BATTLE_SOUND_CATCH
  );
  const noise = S.$defs.battleVoice.oneOf[1].properties.noise.properties;
  assert.deepEqual(
    MUSIC_CHOICES.noise.map(c => c[0]).sort(),
    Object.keys(noise)
      .filter(k => k !== 'q')
      .sort()
  );
});

test('a sound as a play list: tones over its pitch, noises with their filters, its echo on each', () => {
  const P = battleSoundPlays({
    pitch: 70,
    wave: 'p12',
    echo: 0.3,
    voices: [
      { at: 0.1, note: 2, len: 0.2 },
      { at: 0, note: -1, len: 0.1, wave: 'sine', vol: 0.1, slide: 0.5, vib: 2, inst: 'harp' },
      { at: 0.05, noise: { bp: 900, q: 2 }, dur: 0.3 },
    ],
  });
  assert.deepEqual(P[0], {
    kind: 'tone',
    at: 0.1,
    midi: 72,
    type: 'p12',
    dur: 0.2,
    vol: 0.06,
    slide: 1,
    vib: 0,
    echo: 0.3,
  });
  assert.equal(P[1].type, 'sine');
  assert.equal(P[1].inst, 'harp');
  assert.deepEqual(P[2], { kind: 'noise', at: 0.05, dur: 0.3, vol: 0.12, lp: 0, hp: 0, bp: 900, q: 2, echo: 0.3 });
  assert.equal(battleSoundLength(P), 0.35);
  assert.equal(battleSoundPlays({ wave: 'p25', voices: [{ at: 0, note: 0, len: 1 }] })[0].midi, BATTLE_SOUND_PITCH);
  assert.deepEqual(battleSoundPlays(null), []);
});

test('a move sound: the family’s and the type’s cast and hit; the preview puts the hit after the cast', () => {
  const M = battleMoveSound(B, 'shot', 'Electric');
  assert.equal(M.any, true);
  assert.equal(M.cast.length, B.families.shot.cast.length + B.types.Electric.cast.length);
  assert.equal(M.hit.length, B.families.shot.hit.length + B.types.Electric.hit.length);
  assert.equal(battleMoveSound(B, 'nope', 'Fire').any, false);
  assert.ok(battleMoveSound(B, 'nope', 'Fire').hit.length);
  const pre = battleSoundPreview(B.families.shot, 0.5);
  assert.ok(pre.some(p => p.at >= 0.5));
  assert.ok(battleSoundLength(pre) <= 2);
});

test('every sound by its name is there, and lasts a second and a half at most', () => {
  const names = battleSoundNames(B);
  assert.equal(names.length, 16 + kits.length + 4 + 1 + 5);
  for (const n of names) {
    const S0 = battleSoundGet(B, n);
    assert.ok(S0, n);
    const L = battleSoundLength(battleSoundPreview(S0, 0.6));
    assert.ok(L > 0 && L <= 1.5, `${n}: ${L}`);
  }
  assert.equal(battleSoundGet(B, 'recall'), B.recall);
  assert.equal(battleSoundGet(B, 'hurt.nope'), null);
});

test('every move finds its family; a miss is still cast', () => {
  const list = Array.isArray(MOVES) ? MOVES : Object.values(MOVES);
  for (const M of list) if (M && M.c) assert.ok(B.families[battleSoundFamily(M, A)], M.id || M.n);
  assert.equal(battleSoundFamily({ c: 'S', anim: 'nope' }, A), A.defaults.S);
  assert.equal(battleSoundFamily({ c: 'H', anim: 'scene1' }, { ...A, scenes: { scene1: { family: 'dive' } } }), 'dive');
  assert.equal(battleSoundFamily(null, A), null);
});

test('which hurt sound an event plays', () => {
  assert.equal(battleHurtKind({ k: 'hurt', fx: 'brn', dmg: 5 }), 'burn');
  assert.equal(battleHurtKind({ k: 'hurt', fx: 'spread', dmg: 5 }), 'spread');
  assert.equal(battleHurtKind({ k: 'hurt', fx: 'mail', dmg: 5 }), 'delayed');
  assert.equal(battleHurtKind({ k: 'hurt', dmg: 5 }), 'recoil');
  assert.equal(battleHurtKind({ k: 'hurt', fx: 'stones', dmg: 5 }), 'recoil');
  assert.equal(battleHurtKind({ k: 'hurt', fx: 'block', dmg: 0 }), null);
  assert.equal(battleHurtKind({ k: 'hurt', dmg: 0 }), null);
  assert.equal(battleHurtKind({ k: 'move' }), null);
});

test('the findings: a family or type that isn’t one, a missing one, placeholders', () => {
  const F = battleSoundFindings(
    { families: { charge: { wave: 'p25', cast: [] }, bogus: { wave: 'p25' } }, types: {} },
    { families: ['charge', 'dash'], types: ['Fire'] }
  );
  assert.ok(F.some(f => f.lvl === 'error' && /bogus/.test(f.msg)));
  assert.ok(F.some(f => f.lvl === 'warn' && /dash/.test(f.msg)));
  assert.ok(F.some(f => f.lvl === 'warn' && /Fire/.test(f.msg)));
  const P = battleSoundFindings(B, { families, types: kits }).find(f => f.lvl === 'info');
  assert.ok(P && /placeholder battle sounds/.test(P.msg));
});
