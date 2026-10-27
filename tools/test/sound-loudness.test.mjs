// Sound track SND-8a: the loudness meter (tools/sound-loudness.mjs) that tools/check-sound.py --loudness uses:
// BS.1770's K-weighting at any rate, gated integrated loudness, the 3 s maximum, the peak, the phone band and the
// 2-6 kHz share.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { soundKWeight, soundLoudness } from '../sound-loudness.mjs';

const sine = (f, a, sec, rate) =>
  Float32Array.from({ length: Math.round(sec * rate) }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / rate));
const near = (a, b, d, what) => assert.ok(Math.abs(a - b) <= d, `${what}: ${a} not within ${d} of ${b}`);

test("K-weighting at 48 kHz has BS.1770's published coefficients", () => {
  const [s, h] = soundKWeight(48000);
  [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585].forEach((v, i) =>
    near(s[i], v, 1e-6, 'shelf ' + i)
  );
  [1, -2, 1, -1.99004745483398, 0.99007225036621].forEach((v, i) => near(h[i], v, 1e-5, 'high-pass ' + i));
});

test('a full-scale 997 Hz sine on one channel reads -3.01 LUFS, at 48 and 44.1 kHz', () => {
  for (const rate of [48000, 44100]) {
    const L = soundLoudness([sine(997, 1, 5, rate)], rate, 0.5);
    near(L.lufs, -3.01, 0.05, rate + ' Hz');
    near(L.short, -3.01, 0.05, rate + ' Hz short-term');
    near(L.peak, 0, 0.01, 'peak');
    assert.equal(L.nan, false);
  }
});

test('the same sine on both channels is 3 LU louder; 20 dB down is 20 LU down', () => {
  const r = 44100,
    one = soundLoudness([sine(997, 1, 4, r)], r, 0.5).lufs;
  near(soundLoudness([sine(997, 1, 4, r), sine(997, 1, 4, r)], r, 0.5).lufs - one, 3.01, 0.02, 'stereo');
  near(soundLoudness([sine(997, 0.1, 4, r)], r, 0.5).lufs - one, -20, 0.02, '-20 dB');
});

test('gating: silence after a sound leaves its loudness as it was; all silence is -Infinity', () => {
  const r = 44100,
    a = sine(997, 0.5, 3, r),
    b = new Float32Array(r * 6);
  b.set(a);
  near(soundLoudness([b], r).lufs, soundLoudness([a], r).lufs, 0.3, 'gated');
  assert.equal(soundLoudness([new Float32Array(r * 2)], r).lufs, -Infinity);
});

test('the phone band and the 2-6 kHz share: a 100 Hz hum is outside both, a 3 kHz whistle inside both', () => {
  const r = 44100,
    hum = soundLoudness([sine(100, 0.5, 2, r)], r, 0.5),
    whistle = soundLoudness([sine(3000, 0.5, 2, r)], r, 0.5);
  assert.ok(whistle.share > 0.7 && hum.share < 0.01, `shares ${whistle.share}, ${hum.share}`);
  assert.ok(whistle.phone - hum.phone > 20, `phone ${whistle.phone} against ${hum.phone}`);
});

test('a NaN is reported', () => {
  const d = sine(997, 0.5, 1, 44100);
  d[100] = NaN;
  assert.equal(soundLoudness([d], 44100).nan, true);
});
