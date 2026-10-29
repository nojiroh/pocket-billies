// @ts-check
'use strict';
/* ================= SOUND LOUDNESS (sound track SND-8a) =================
   How loud a rendered sound is, the way ITU-R BS.1770 measures it: each channel K-weighted (a high shelf of +4 dB
   above ~1.7 kHz, then a high-pass at ~38 Hz, worked out for the render's own sample rate), mean squares over 400 ms
   blocks every 100 ms, gated (blocks under -70 LUFS dropped, then those 10 LU under the rest), summed over the
   channels. Besides the integrated loudness: the loudest 3 s ("short-term" max), the sample peak, (SND-15) the true
   peak (4x oversampled, BS.1770-4 annex 2) and the loudness range (EBU Tech 3342), the level in a phone speaker's band (400 Hz - 6 kHz, unweighted) and the share of the energy between 2 and 6 kHz, where hearing is
   most sensitive and where a bed grates. tools/check-sound.py --loudness puts it in the page as a script and runs it
   on each render (nothing in the game loads it). Plain numbers: no audio; runs in Node
   (tools/test/sound-loudness.test.mjs). */

/**
 * a second-order filter's coefficients (the Audio EQ Cookbook), normalised so a0 = 1
 * @param {'lowpass' | 'highpass' | 'highshelf'} type
 * @param {number} f the corner frequency (Hz)
 * @param {number} q
 * @param {number} rate the sample rate (Hz)
 * @param {number} [gain] a shelf's gain (dB)
 * @returns {number[]} [b0, b1, b2, a1, a2]
 */
export function soundBiquad(type, f, q, rate, gain = 0) {
  const w = (2 * Math.PI * f) / rate,
    cs = Math.cos(w),
    al = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'highshelf') {
    const A = Math.pow(10, gain / 40),
      s = 2 * Math.sqrt(A) * al;
    b0 = A * (A + 1 + (A - 1) * cs + s);
    b1 = -2 * A * (A - 1 + (A + 1) * cs);
    b2 = A * (A + 1 + (A - 1) * cs - s);
    a0 = A + 1 - (A - 1) * cs + s;
    a1 = 2 * (A - 1 - (A + 1) * cs);
    a2 = A + 1 - (A - 1) * cs - s;
  } else {
    const k = type === 'lowpass' ? 1 - cs : 1 + cs;
    b0 = k / 2;
    b1 = type === 'lowpass' ? k : -k;
    b2 = k / 2;
    a0 = 1 + al;
    a1 = -2 * cs;
    a2 = 1 - al;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/**
 * runs a signal through filters one after another
 * @param {ArrayLike<number>} x
 * @param {number[][]} stages each [b0, b1, b2, a1, a2]
 * @returns {Float32Array}
 */
export function soundFilter(x, stages) {
  let y = Float32Array.from(x);
  for (const [b0, b1, b2, a1, a2] of stages) {
    const o = new Float32Array(y.length);
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = y[i],
        r = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = v;
      y2 = y1;
      y1 = r;
      o[i] = r;
    }
    y = o;
  }
  return y;
}

/**
 * BS.1770's K-weighting at any sample rate: the shelf and the high-pass from their analogue prototypes, as libebur128
 * works them out (the cookbook's shelf is a little off the standard's published 48 kHz figures)
 * @param {number} rate
 * @returns {number[][]}
 */
export function soundKWeight(rate) {
  let K = Math.tan((Math.PI * 1681.974450955533) / rate),
    Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20),
    Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = [
    (Vh + (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - Vh)) / a0,
    (Vh - (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - 1)) / a0,
    (1 - K / Q + K * K) / a0,
  ];
  K = Math.tan((Math.PI * 38.13547087602444) / rate);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  return [shelf, [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]];
}

/** power to LUFS (or dB of power when the -0.691 isn't wanted) */
const lufsOf = (/** @type {number} */ ms, k = -0.691) => (ms > 0 ? k + 10 * Math.log10(ms) : -Infinity);

/**
 * mean squares of a signal over windows of n samples, every hop samples
 * @param {Float32Array} y
 * @param {number} n
 * @param {number} hop
 * @returns {number[]}
 */
function windows(y, n, hop) {
  const sum = new Float64Array(y.length + 1);
  for (let i = 0; i < y.length; i++) sum[i + 1] = sum[i] + y[i] * y[i];
  const out = [];
  for (let a = 0; a + n <= y.length; a += hop) out.push((sum[a + n] - sum[a]) / n);
  return out;
}

/* SND-15: the true peak's interpolator (BS.1770-4 annex 2: 4x oversampling, at least 48 taps): the three points
   between two samples, each a Hann-windowed sinc over the 12 samples around it (48 taps over the four phases) */
const TP_PHASES = 4,
  TP_HALF = 6,
  TP_FIR = Array.from({ length: TP_PHASES }, (_, p) =>
    Array.from({ length: 2 * TP_HALF }, (_, j) => {
      const d = p / TP_PHASES - (j - TP_HALF + 1);
      return (d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d)) * (0.5 + 0.5 * Math.cos((Math.PI * d) / TP_HALF));
    })
  );

/**
 * SND-15: a channel's true peak: its samples and the points between them; worked out only next to samples within
 * 6 dB of the sample peak (an inter-sample over is a few dB at most), so a long render costs little
 * @param {Float32Array} c
 * @param {number} peak the channel's sample peak (linear)
 * @returns {number} linear
 */
function truePeakOf(c, peak) {
  let tp = peak;
  const lim = peak * 0.5;
  for (let i = 0; i < c.length; i++) {
    if (Math.abs(c[i]) < lim) continue;
    /* the gaps on either side of the sample: from a-1 to a and from a to a+1 */
    for (let a = Math.max(TP_HALF - 1, i - 1); a <= Math.min(c.length - TP_HALF - 1, i); a++)
      for (let p = 1; p < TP_PHASES; p++) {
        const F = TP_FIR[p];
        let v = 0;
        for (let j = 0; j < F.length; j++) v += F[j] * c[a - TP_HALF + 1 + j];
        if (Math.abs(v) > tp) tp = Math.abs(v);
      }
  }
  return tp;
}

/**
 * SND-15: the loudness range (EBU Tech 3342): the short-term (3 s) levels gated at -70 LUFS and 20 LU under their
 * mean, then the spread from the 10th to the 95th percentile (LU); 0 for a render shorter than 3 s
 * @param {number[]} shorts the 3 s windows' mean squares, summed over the channels
 */
function rangeOf(shorts) {
  const loud = shorts.filter(z => lufsOf(z) > -70);
  if (!loud.length) return 0;
  const rel = lufsOf(loud.reduce((a, b) => a + b, 0) / loud.length) - 20,
    L = loud
      .map(z => lufsOf(z))
      .filter(v => v > rel)
      .sort((x, y) => x - y),
    at = (/** @type {number} */ q) => L[Math.min(L.length - 1, Math.max(0, Math.round(q * (L.length - 1))))];
  return at(0.95) - at(0.1);
}

/**
 * how loud a render is
 * @param {ArrayLike<number>[]} chans the channels (one for mono, two for stereo)
 * @param {number} rate
 * @param {number} [skip] seconds left out at the start (a fade-in)
 * @returns {{lufs: number, short: number, peak: number, tp: number, lra: number, phone: number, share: number, nan: boolean}}
 *   lufs integrated (gated), short the loudest 3 s, peak dBFS, (SND-15) tp the true peak (dBTP), lra the loudness range (LU), phone the 400 Hz-6 kHz band's level (dB of power),
 *   share the part of the energy between 2 and 6 kHz (0..1); -Infinity where silent
 */
export function soundLoudness(chans, rate, skip = 0) {
  const s0 = Math.floor(skip * rate),
    /* SND-15: a typed array's own subarray (the same values; a plain Array copy of a long render was slow) */
    cut = chans.map(c =>
      Float32Array.from(c instanceof Float32Array ? c.subarray(s0) : Array.prototype.slice.call(c, s0))
    ),
    nan = cut.some(c => c.some(v => !Number.isFinite(v))),
    K = soundKWeight(rate),
    k = cut.map(c => soundFilter(c, K)),
    hop = Math.round(0.1 * rate);
  /* the 400 ms blocks, summed over the channels */
  const per = k.map(y => windows(y, Math.round(0.4 * rate), hop)),
    blocks = per[0] ? per[0].map((_, j) => per.reduce((a, w) => a + w[j], 0)) : [];
  const loud = blocks.filter(z => lufsOf(z) > -70),
    mean = (/** @type {number[]} */ L) => L.reduce((a, b) => a + b, 0) / Math.max(1, L.length),
    rel = lufsOf(mean(loud)) - 10,
    gated = loud.filter(z => lufsOf(z) > rel);
  const sper = k.map(y => windows(y, Math.round(3 * rate), hop)),
    shorts = sper[0] ? sper[0].map((_, j) => sper.reduce((a, w) => a + w[j], 0)) : [];
  let peak = 0,
    tp = 0;
  for (const c of cut) {
    let pc = 0;
    for (let i = 0; i < c.length; i++) pc = Math.max(pc, Math.abs(c[i]));
    peak = Math.max(peak, pc);
    if (pc > 0) tp = Math.max(tp, truePeakOf(c, pc));
  }
  /* the phone's band, and the 2-6 kHz share of all the energy (unweighted) */
  const band = (/** @type {number} */ lo, /** @type {number} */ hi) =>
      cut.reduce((a, c) => {
        const y = soundFilter(c, [
          soundBiquad('highpass', lo, Math.SQRT1_2, rate),
          soundBiquad('lowpass', hi, Math.SQRT1_2, rate),
        ]);
        let s = 0;
        for (let i = 0; i < y.length; i++) s += y[i] * y[i];
        return a + s / Math.max(1, y.length);
      }, 0),
    all = cut.reduce((a, c) => {
      let s = 0;
      for (let i = 0; i < c.length; i++) s += c[i] * c[i];
      return a + s / Math.max(1, c.length);
    }, 0);
  return {
    lufs: gated.length ? lufsOf(mean(gated)) : -Infinity,
    short: shorts.length ? lufsOf(Math.max(...shorts)) : lufsOf(mean(blocks)),
    peak: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
    tp: tp > 0 ? 20 * Math.log10(tp) : -Infinity,
    lra: rangeOf(shorts),
    phone: lufsOf(band(400, 6000), 0),
    share: all > 0 ? band(2000, 6000) / all : 0,
    nan,
  };
}
