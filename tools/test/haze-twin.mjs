'use strict';
/* ================= HAZE (air track AIR-1) =================
   The JS twin of the haze maths in fogit (engine/webgl.js LIGHT_GLSL) and of the sky's gradient (SKY_GLSL, read by
   the sky shader and by fogit), line for line, so Node tests can check them: tools/test/haze.test.mjs.
   No DOM, no WebGL; only the tests read it. Change both together. */
const mix = (a, b, t) => a * (1 - t) + b * t;
const mix3 = (a, b, t) => a.map((v, i) => mix(v, b[i], typeof t === 'number' ? t : t[i]));
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const len = v => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** the sky's colour at view height e (the sine of the angle above the horizon) from its top, middle and low colours
 * @param {number[]} s0 @param {number[]} s1 @param {number[]} s2 @param {number} e */
export function skyGrad(s0, s1, s2, e) {
  return e < 0.18 ? mix3(s2, s1, smoothstep(-0.05, 0.18, e)) : mix3(s1, s0, smoothstep(0.18, 0.75, e));
}
/** the average of exp(-b*(y-r)) along a straight stretch from height y0 to y1 (Quilez's analytic height fog: the exact
 * integral of an exponential density along a ray), capped at cap; 1 when b is 0
 * @param {number} y0 @param {number} y1 @param {number} r @param {number} b @param {number} cap */
export function airAvg(y0, y1, r, b, cap) {
  const k = clamp(b * (y1 - y0), -30, 30),
    a = Math.exp(clamp(-b * (y0 - r), -30, 30));
  return Math.min(cap, Math.abs(k) < 1e-3 ? a * (1 - k * 0.5) : (a * (1 - Math.exp(-k))) / k);
}
/** how far the air hides a surface at p, per colour channel (0 clear .. 1 all haze), and the colour it takes; the
 * frame's values as the Frame block has them (uFogStart, uFogD, uHazeY...), without fogit's wobble (time 0 terms are
 * passed as wob, 1 for none), its valley mist, tint and room dimming
 * @param {number[]} p @param {any} F */
export function hazeAt(p, F) {
  const eye = F.eye,
    r = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]],
    d = len(r),
    vd = r.map(v => v / Math.max(d, 0.001));
  const tau =
    (Math.max(0, d - F.fogStart) / F.fogD) *
    1.6 *
    airAvg(eye[1] + vd[1] * Math.min(F.fogStart, d), p[1], F.hazeY, F.hazeFall, 3);
  const w = [1 + 0.3 * F.hazeTint, 1, 1 - 0.12 * F.hazeTint];
  let f = w.map(k => 1 - Math.exp(-tau * k));
  const mp = Math.exp(-Math.max(0, p[1] - F.mistY) * 1.4) * smoothstep(4, 22, d),
    mr = Math.min(1, (Math.max(0, d - 4) / 18) * airAvg(eye[1] + vd[1] * Math.min(4, d), p[1], F.mistY, 1.4, 1)),
    m = F.mist * mix(mp, mr, F.mistRay) * (F.wob ?? 1);
  f = f.map(v => clamp(v + m * (1 - v), 0, 1));
  const fb = mix3(
    F.fog,
    F.fog.map((v, i) => Math.max(v + skyGrad(F.skyTop, F.skyMid, F.skyLow, vd[1])[i] - F.skyLow[i], 0)),
    F.hazeSky
  );
  const cs = Math.max(dot(vd, F.sunDir), 0);
  let fc = mix3(
    fb,
    fb.map((v, i) => v * 0.45 + F.sunCol[i] * 0.7),
    Math.pow(cs, 6) * F.fogSun
  );
  fc = mix3(
    fc,
    fc.map((v, i) => v * 0.7 + F.sunCol[i] * 0.4),
    Math.pow(cs, 1.5) * F.skyGlow * 0.35
  );
  return { f, col: fc };
}
