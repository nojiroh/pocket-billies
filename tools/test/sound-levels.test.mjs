// Sound track SND-1: the gain each sound bus gets from Settings → Sound (game/js/audio/levels.js). The module is pure,
// so it loads in plain Node; sound.js applies these numbers to the Web Audio buses. No audio here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= globalThis;
const { bedDuck, mixTrim, soundLevel, soundLevels } = await import('../../game/js/audio/levels.js');
const { duckAt, duckPoints, mixDuck } = await import('../../game/js/logic/sound-duck.js');
const MIX = JSON.parse(
  (await import('node:fs')).readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8')
).mix;

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('with no preferences each bus has the level the sliders show by default', () => {
  for (const prefs of [undefined, null, {}]) {
    const L = soundLevels(prefs);
    /* SND-15: the defaults near the top (music 0.8, sound effects 1, world and ambience 0.75) */
    near(L.master, 0.9);
    near(L.music, 0.8 * 0.8);
    near(L.sfx, 1);
    near(L.world, 0.75 * 0.75);
    near(L.amb, 0.75 * 0.75 * 0.9);
  }
  assert.equal(soundLevel({}, 'music'), 0.8);
});

test('a slider value is squared, and 0 is silent', () => {
  const L = soundLevels({ master: 0.5, music: 0.5, sfx: 0.5, world: 0.5, amb: 0.5 });
  near(L.master, 0.9 * 0.25);
  near(L.music, 0.25);
  near(L.sfx, 0.25);
  near(L.world, 0.25);
  near(L.amb, 0.25 * 0.9);
  const Z = soundLevels({ master: 1, music: 0, sfx: 0, world: 0, amb: 0 });
  assert.deepEqual([Z.music, Z.sfx, Z.world, Z.amb], [0, 0, 0, 0]);
  near(Z.master, 0.9);
});

test('mute silences the master bus and keeps every level', () => {
  const prefs = { master: 0.7, music: 0.3, sfx: 0.6, world: 0.2, amb: 0.4 },
    on = soundLevels(prefs),
    off = soundLevels({ ...prefs, mute: true });
  assert.equal(off.master, 0);
  for (const k of ['music', 'sfx', 'world', 'amb']) assert.equal(off[k], on[k], k);
  assert.equal(soundLevel({ ...prefs, mute: true }, 'master'), 0.7);
});

test('a level stored as text, as a slider hands it over, reads as its number', () => {
  near(soundLevels({ music: '0.4' }).music, 0.16);
  assert.equal(soundLevel({ sfx: '0' }, 'sfx'), 0);
});

test("SND-6: the trims are music.json's mix (SND-15: set so each bus keeps its level against the music)", () => {
  for (const prefs of [undefined, { master: 0.7, music: 0.3, amb: 0.9 }, { mute: 1 }]) {
    const A = soundLevels(prefs),
      B = soundLevels(prefs, MIX);
    for (const k of ['master', 'music']) near(A[k], B[k]);
  }
  /* SND-15: at the new defaults every bus stands to the music as it did at the old ones (0.55, 0.8, 0.5, 0.5), within
     0.1 dB */
  const now = soundLevels({}, MIX),
    was = soundLevels({ music: 0.55, sfx: 0.8, world: 0.5, amb: 0.5 }, { ...MIX, sfx: 1, world: 1, amb: 0.9 });
  for (const k of ['sfx', 'world', 'amb'])
    assert.ok(Math.abs(20 * Math.log10(now[k] / now.music / (was[k] / was.music))) < 0.1, k);
  near(soundLevels({}, { music: 0.5 }).music, 0.8 * 0.8 * 0.5);
  near(soundLevels({}, { master: 1 }).master, 1);
  assert.equal(mixTrim({}, 'amb'), 0.9);
  assert.equal(mixTrim(null, 'master'), 0.9);
});

test("SND-6: the beds come down by the mix's dB while a four-voice song plays, not otherwise", () => {
  near(bedDuck({ bedsUnderSong: -3 }, true), Math.pow(10, -3 / 20));
  near(bedDuck({ bedsUnderSong: -3 }, false), 1);
  near(bedDuck({}, true), 1);
  near(bedDuck(MIX, true), Math.pow(10, MIX.bedsUnderSong / 20));
  assert.ok(MIX.bedsUnderSong === -3);
});

test('each bus has its own mute, which silences only that bus and keeps its level', () => {
  const prefs = { master: 0.7, music: 0.3, sfx: 0.6, world: 0.2, amb: 0.4 },
    on = soundLevels(prefs);
  for (const k of ['music', 'sfx', 'world', 'amb']) {
    const off = soundLevels({ ...prefs, mutes: { [k]: true } });
    assert.equal(off[k], 0, k);
    for (const o of ['master', 'music', 'sfx', 'world', 'amb'])
      if (o !== k) assert.equal(off[o], on[o], `${k} muted ${o}`);
    assert.equal(soundLevel({ ...prefs, mutes: { [k]: true } }, k), prefs[k]);
  }
  near(soundLevels({ ...prefs, mutes: { music: false } }).music, on.music);
});

// SND-15: the ducks (audio/levels.js mixDuck, duckAt, duckPoints)
test('SND-15: a dip comes over its attack, holds to its end and goes over its release', () => {
  const d = { t0: 1, end: 2, g: 0.5, a: 0.2, r: 1 };
  assert.equal(duckAt(d, 0.5), 1);
  near(duckAt(d, 1.1), 0.75);
  assert.equal(duckAt(d, 1.5), 0.5);
  near(duckAt(d, 2.5), 0.75);
  assert.equal(duckAt(d, 3.5), 1);
  /* shorter than its attack: held at the bottom until the attack is over */
  assert.equal(duckAt({ t0: 0, end: 0.05, g: 0.2, a: 0.1, r: 1 }, 0.1), 0.2);
});

test('SND-15: overlapping dips take the lower gain at every corner, from now on', () => {
  const P = duckPoints(
    [
      { t0: 0, end: 2, g: 0.5, a: 0.1, r: 0.5 },
      { t0: 1, end: 1.5, g: 0.2, a: 0.1, r: 0.5 },
    ],
    0.5
  );
  assert.deepEqual(P[0], [0.5, 0.5], 'now: the first dip holds');
  const at = t => P.find(p => Math.abs(p[0] - t) < 1e-9)[1];
  near(at(1.1), 0.2);
  near(at(1.5), 0.2);
  near(at(2), 0.5, 'the second has come back past the first');
  near(at(2.5), 1);
  assert.ok(
    P.every((p, i) => i === 0 || p[0] > P[i - 1][0]),
    'in time order'
  );
});

test('SND-15: mixDuck reads music.json mix duck in dB; a kind left out ducks nothing', () => {
  const D = mixDuck({ duck: { cry: { music: -6, beds: -12, attack: 0.03, release: 0.5 } } }, 'cry');
  assert.ok(Math.abs(D.music - 0.5012) < 1e-4 && Math.abs(D.beds - 0.2512) < 1e-4, `${D.music} ${D.beds}`);
  assert.equal(D.a, 0.03);
  assert.equal(D.r, 0.5);
  const N = mixDuck({}, 'talk');
  assert.equal(N.music, 1);
  assert.equal(N.beds, 1);
});
