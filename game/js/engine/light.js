'use strict';
/* ================= ENGINE LIGHT =================
   The sun (direction, color, clouds), the per-frame light context every lit shader reads, the sun shadow map, the
   contact-shadow list and the point lights. The sun comes from the top left by default, the same side the pixel art is
   painted from, so shadows fall back and to the right. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { environment, environmentSun } from '../hooks.js';
import { clamp } from '../util.js';
import { walkView } from '../walk-view.js';
import { ENG_CTX, engHex, engineSetting } from './settings.js';
import { EGL, M4, eglTarget, v3c, v3n } from './webgl.js';
/* eslint-disable no-func-assign */
expose({
  EGL_SH_DIRS: [() => EGL_SH_DIRS],
  eglLampShadowBegin: [() => eglLampShadowBegin, v => (eglLampShadowBegin = v)],
  eglLightCtx: [() => eglLightCtx, v => (eglLightCtx = v)],
  eglLightU: [() => eglLightU, v => (eglLightU = v)],
  eglPickLights: [() => eglPickLights, v => (eglPickLights = v)],
  eglSH: [() => eglSH, v => (eglSH = v)],
  eglShadowBegin: [() => eglShadowBegin, v => (eglShadowBegin = v)],
  eglShadowEnd: [() => eglShadowEnd, v => (eglShadowEnd = v)],
  eglSun: [() => eglSun, v => (eglSun = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export function eglSun(indoor) {
  const deg = Math.PI / 180;
  let a = engineSetting('sun', 'angle'),
    h = engineSetting('sun', 'height'),
    warm = 0,
    col = engHex('sun', 'color', '#FFF0D8');
  /* v26: the time of day and the moon (environment.js), while a walk scene draws */
  if (!indoor && typeof environment !== 'undefined' && ENG_CTX.env && (environment.on || environment.force)) {
    const e = environmentSun(a, h, col);
    a = e.a;
    h = e.h;
    col = e.col;
  } else if (engineSetting('sun', 'clock') && !indoor) {
    const d = new Date(),
      t = d.getHours() + d.getMinutes() / 60,
      ph = Math.sin(((t - 6) / 24) * Math.PI * 2);
    h = clamp(h * (0.55 + 0.45 * ph) + 8, 14, 85);
    a = a + (t - 13) * 6;
    warm = clamp(0.6 - ph * 0.6, 0, 1);
  }
  const ch = Math.cos(h * deg),
    toSun = v3n([-Math.cos(a * deg) * ch, Math.sin(h * deg), -Math.sin(a * deg) * ch]);
  let k = engineSetting('sun', 'strength');
  if (warm) col = [col[0], col[1] * (1 - warm * 0.12), col[2] * (1 - warm * 0.3)];
  if (indoor) k *= 0.75;
  return {
    dir: toSun,
    travel: [-toSun[0], -toSun[1], -toSun[2]],
    col: col.map(v => v * k * 0.72),
    pulse:
      (0.85 + 0.15 * Math.sin((typeof walkView !== 'undefined' ? walkView.t : 0) / 9000)) *
      engineSetting('sun', 'innerSun'),
    height: h,
    indoor,
  };
}
/* v43: the sky as nine spherical-harmonic coefficients. Radiance by direction: the sky's zenith colour overhead easing
   to its horizon colour, the ground's bounce below, and a broad lobe of the sun's colour round the sun (what a clear
   sky adds on that side); projected on fixed directions, convolved for irradiance in the shader (shAmb) */
const EGL_SH_DIRS = (() => {
  const N = 64,
    o = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N,
      r = Math.sqrt(1 - y * y),
      a = i * 2.399963;
    o.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return o;
})();
function eglSH(top, hor, gnd, sun, lobe = 1) {
  const c = Array.from({ length: 9 }, () => [0, 0, 0]),
    N = EGL_SH_DIRS.length,
    w = (4 * Math.PI) / N,
    sd = sun.dir,
    sc = sun.col.map(v => v * lobe);
  for (const d of EGL_SH_DIRS) {
    const [x, y, z] = d;
    let L;
    if (y > 0) {
      const k = Math.pow(y, 0.55);
      L = [hor[0] + (top[0] - hor[0]) * k, hor[1] + (top[1] - hor[1]) * k, hor[2] + (top[2] - hor[2]) * k];
    } else {
      const k = 0.6 - 0.4 * y;
      L = [gnd[0] * k, gnd[1] * k, gnd[2] * k];
    }
    const sl = Math.pow(Math.max(0, x * sd[0] + y * sd[1] + z * sd[2]), 3) * 0.16;
    L = [L[0] + sc[0] * sl, L[1] + sc[1] * sl, L[2] + sc[2] * sl];
    const Y = [
      0.282095,
      0.488603 * y,
      0.488603 * z,
      0.488603 * x,
      1.092548 * x * y,
      1.092548 * y * z,
      0.315392 * (3 * z * z - 1),
      1.092548 * x * z,
      0.546274 * (x * x - y * y),
    ];
    for (let i = 0; i < 9; i++) {
      c[i][0] += L[0] * Y[i] * w;
      c[i][1] += L[1] * Y[i] * w;
      c[i][2] += L[2] * Y[i] * w;
    }
  }
  const f = new Float32Array(27);
  c.forEach((v, i) => f.set(v, i * 3));
  return f;
}
/* everything the lit shaders need this frame; built by a view, then handed to eglLightU for each program */
export function eglLightCtx(o) {
  const hz = o.haze,
    tint = o.tint;
  const shT = engHex('shadows', 'tint', '#40507E'),
    lum = shT[0] * 0.3 + shT[1] * 0.59 + shT[2] * 0.11 || 0.3,
    hue = engineSetting('shadows', 'hue') ?? 0.6,
    shTint = shT.map(v => clamp((v / lum) * (0.35 + 0.5 * hue) + (0.6 - 0.32 * hue), 0, 2)),
    shLift = shT.map(v => (v / lum) * 0.035 * hue);
  const sky = engHex('sun', 'ambientSky', o.ambTop),
    gnd = engHex('sun', 'ambientGround', o.ambBot);
  const shK = engineSetting('sun', 'shAmbient') ?? 1,
    hor = o.ambHor || sky.map((v, i) => v * 0.85 + gnd[i] * 0.15);
  return {
    eye: o.eye,
    sun: o.sun,
    ambTop: sky,
    ambBot: gnd,
    ambK: engineSetting('sun', 'ambient'),
    fogSun: o.indoor ? 0 : (engineSetting('air', 'sunFog') ?? 0.6),
    sh: shK > 0 ? eglSH(sky, hor, gnd, o.sun, o.noSunLobe ? 0 : 1) : null,
    shK,
    fog: hz,
    fogStart: o.fogStart,
    fogD: o.fogD,
    tint: tint ? tint : [1, 1, 1],
    tintAmt: tint ? (o.indoor ? 0.3 : 0.5) : 0,
    mist: o.mist,
    mistY: o.mistY,
    valley:
      o.valley && engineSetting('air', 'valleyMist') > 0
        ? [o.valley[0], o.valley[1] * engineSetting('air', 'valleyMist')]
        : [0, 0],
    time: o.time,
    shStr: engineSetting('shadows', 'strength'),
    shSoft: engineSetting('shadows', 'softness'),
    shTint,
    cloudSh: o.indoor ? 0 : engineSetting('sun', 'cloudShadows'),
    cloudCov: engineSetting('sun', 'clouds') ?? 0.45,
    cloudSpd: engineSetting('sun', 'cloudSpeed'),
    contact: engineSetting('shadows', 'contact'),
    shLift,
    shPx: engineSetting('shadows', 'pixel') ? 16 : 0,
    roomB: o.roomB || [0, 0, 0, 0],
    roomDim: o.roomDim || 0,
    shadow: o.shadow || null,
    lite: !!o.lite,
    lights: o.lights || [],
    ao: o.ao || [],
    curve: o.curve || [0, 0, 0, 1e9],
    season: o.season || [0, 0, 0, 0],
  };
}
export function eglLightU(p, X) {
  const gl = EGL.gl,
    U = p.U;
  if (!U.uEye && !U.uCurve) return;
  if (U.uCurve) {
    gl.uniform3f(U.uCurve, X.curve[0], X.curve[1], X.curve[2]);
    gl.uniform1f(U.uCurveD0, X.curve[3]);
  }
  if (!U.uEye) return;
  if (U.uFogSun) gl.uniform1f(U.uFogSun, X.fogSun || 0);
  if (U.uSH) {
    if (X.sh) {
      gl.uniform3fv(U.uSH, X.sh);
      gl.uniform1f(U.uSHK, X.shK);
    } else gl.uniform1f(U.uSHK, 0);
  }
  gl.uniform3fv(U.uEye, X.eye);
  gl.uniform3fv(U.uSunDir, X.sun.dir);
  gl.uniform3fv(U.uSunCol, X.sun.col);
  gl.uniform3fv(U.uAmbTop, X.ambTop);
  gl.uniform3fv(U.uAmbBot, X.ambBot);
  if (U.uAmbK) gl.uniform1f(U.uAmbK, X.ambK);
  gl.uniform3fv(U.uFogCol, X.fog);
  gl.uniform1f(U.uFogStart, X.fogStart);
  gl.uniform1f(U.uFogD, X.fogD);
  if (U.uTint) {
    gl.uniform3fv(U.uTint, X.tint);
    gl.uniform1f(U.uTintAmt, X.tintAmt);
  }
  if (U.uRoomDim) {
    gl.uniform4fv(U.uRoomB, X.roomB || [0, 0, 0, 0]);
    gl.uniform1f(U.uRoomDim, X.roomDim || 0);
  }
  if (U.uMist) {
    gl.uniform1f(U.uMist, X.mist);
    gl.uniform1f(U.uMistY, X.mistY);
  }
  if (U.uValley) gl.uniform2fv(U.uValley, X.valley || [0, 0]);
  if (U.uSeason) gl.uniform4fv(U.uSeason, X.season || [0, 0, 0, 0]);
  if (U.uFol) gl.uniform2f(U.uFol, 0, 0);
  if (U.uTime) gl.uniform1f(U.uTime, X.time);
  if (U.uShStr) {
    gl.uniform1f(U.uShStr, X.shStr);
    gl.uniform3fv(U.uShTint, X.shTint);
    gl.uniform1f(U.uCloudSh, X.cloudSh);
    gl.uniform1f(U.uCloudSpd, X.cloudSpd);
    if (U.uCloudCov) gl.uniform1f(U.uCloudCov, X.cloudCov ?? 0.45);
    gl.uniform1f(U.uContact, X.contact);
  }
  if (U.uShPx) gl.uniform1f(U.uShPx, X.shPx || 0);
  if (U.uShLift) gl.uniform3fv(U.uShLift, X.shLift || [0, 0, 0]);
  /* the shadow samplers: every one of them is always given its own unit (a sampler left at unit 0 next to a plain
    sampler2D there makes the card refuse the draw), with the frame's maps or a stand-in depth texture */
  const S = X.shadow;
  if (U.uShadow != null || U.uShadowD != null || U.uShadow2 != null || U.uLampSh0 != null) {
    const D0 = (S ? S.d : EGL.fb.shadow ? EGL.fb.shadow.d : null) || EGL.depthStub,
      bindD = (u, t, cmp) => {
        gl.activeTexture(gl.TEXTURE0 + u);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.bindSampler(u, cmp ? EGL.samp.cmp : EGL.samp.raw);
      };
    bindD(6, D0, 1);
    bindD(7, D0, 0);
    gl.uniform1i(U.uShadow, 6);
    gl.uniform1i(U.uShadowD, 7);
    if (S) {
      gl.uniformMatrix4fv(U.uShadowM, false, S.vp);
      gl.uniform1f(U.uShadowOn, 1);
      if (U.uShLite) gl.uniform1f(U.uShLite, X.lite ? 1 : 0);
      gl.uniform2f(U.uShadowTexel, 1 / S.size, 1 / S.size);
      if (U.uShPen) gl.uniform1f(U.uShPen, S.pen);
    } else gl.uniform1f(U.uShadowOn, 0);
    /* v43: the second cascade (the whole view at a coarser texel) on 10/11, the two lamps' maps on 12/13 */
    if (U.uShadow2 != null) {
      const F = S && S.far;
      bindD(10, F ? F.d : D0, 1);
      bindD(11, F ? F.d : D0, 0);
      gl.uniform1i(U.uShadow2, 10);
      gl.uniform1i(U.uShadowD2, 11);
      if (F) {
        gl.uniformMatrix4fv(U.uShadowM2, false, F.vp);
        gl.uniform1f(U.uShadow2On, 1);
        gl.uniform2f(U.uShadowTexel2, 1 / F.size, 1 / F.size);
        gl.uniform1f(U.uShPen2, F.pen);
      } else gl.uniform1f(U.uShadow2On, 0);
    }
    if (U.uLampSh0 != null) {
      const LS = (S && X.lampSh) || [];
      for (let i = 0; i < 2; i++) {
        const M = LS[i];
        bindD(12 + i, M ? M.d : D0, 1);
        gl.uniform1i(i ? U.uLampSh1 : U.uLampSh0, 12 + i);
        if (M) gl.uniformMatrix4fv(i ? U.uLampM1 : U.uLampM0, false, M.vp);
      }
      gl.uniform1i(U.uNLS, LS.length);
    }
    gl.activeTexture(
      gl.TEXTURE0
    ); /* back to unit 0: a texture made or uploaded later must not land on a shadow unit (v44) */
  }
  /* v30: the light and occlusion lists are packed once per frame, not once per program (fewer allocations on phones) */
  if (U.uLP) {
    if (!X._lp) {
      const lp = new Float32Array(64),
        lc = new Float32Array(64),
        L = X.lights;
      L.forEach((l, i) => {
        lp.set([l.p[0], l.p[1], l.p[2], l.front ? -l.r : l.r], i * 4);
        lc.set([l.c[0], l.c[1], l.c[2], 1], i * 4);
      });
      X._lp = lp;
      X._lc = lc;
    }
    gl.uniform4fv(U.uLP, X._lp);
    gl.uniform4fv(U.uLC, X._lc);
    gl.uniform1i(U.uNL, X.lights.length);
  }
  if (U.uAO) {
    if (!X._ao) {
      const a = new Float32Array(256);
      X.ao.forEach((b, i) => a.set(b, i * 4));
      X._ao = a;
    }
    gl.uniform4fv(U.uAO, X._ao);
    gl.uniform1i(U.uNAO, X.ao.length);
  }
}
/* a sun shadow map covering a rectangle of the world; returns what eglLightCtx needs */
export function eglShadowBegin(cx, cz, radius, sun, res, name = 'shadow') {
  const gl = EGL.gl,
    S = eglTarget(name, res, res, { depthOnly: true }),
    tr = sun.travel,
    dist = 60;
  /* v19: the centre moves in whole shadow-map texels (seen from the sun), so shadow edges stand still while the camera moves */
  {
    const f = v3n(tr),
      upR = Math.abs(tr[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0],
      rt = v3n(v3c(f, upR)),
      up = v3c(rt, f),
      tw = (2 * radius) / res,
      a = cx * rt[0] + cz * rt[2],
      b = cx * up[0] + cz * up[2],
      da = Math.round(a / tw) * tw - a,
      db = Math.round(b / tw) * tw - b;
    const dx = rt[0] * da + up[0] * db,
      dy = rt[1] * da + up[1] * db,
      dz = rt[2] * da + up[2] * db,
      t = Math.abs(f[1]) > 0.05 ? -dy / f[1] : 0;
    cx += dx + f[0] * t;
    cz += dz + f[2] * t;
  }
  const eye = [cx - tr[0] * dist, -tr[1] * dist + 2, cz - tr[2] * dist];
  const view = M4.look(eye, [cx, 0, cz], Math.abs(tr[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]),
    depth = 140,
    proj = M4.ortho(-radius, radius, -radius, radius, 1, depth),
    vp = M4.mul(proj, view);
  gl.bindSampler(6, null);
  gl.bindSampler(7, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, res, res);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND);
  gl.colorMask(false, false, false, false);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.1, 2);
  /* penumbra in texels per unit of depth gap: wider for a softer (or lower) sun */
  const texelWorld = (2 * radius) / res,
    pen = (depth * 0.03 * engineSetting('shadows', 'softness')) / texelWorld;
  return { d: S.d, vp, size: res, pen, radius, cx, cz };
}
/* v43: a lamp's shadow map: a wide-angled camera at the lamp looking straight down; what stands under the lamp throws
   its shadow outward on the ground. Perspective, so the texel is finest right under the lamp. */
export function eglLampShadowBegin(pos, res, name) {
  const gl = EGL.gl,
    S = eglTarget(name, res, res, { depthOnly: true }),
    view = M4.look(pos, [pos[0], pos[1] - 1, pos[2]], [0, 0, 1]),
    proj = M4.persp(2.55, 1, 0.25, 24),
    vp = M4.mul(proj, view);
  gl.bindSampler(12, null);
  gl.bindSampler(13, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, res, res);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND);
  gl.colorMask(false, false, false, false);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.5, 3);
  return { d: S.d, vp, size: res, pen: 0, radius: 12, p: pos, lamp: true };
}
export function eglShadowEnd() {
  const gl = EGL.gl;
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.colorMask(true, true, true, true);
}
/* point lights: the nearest few, faded in and out at the limit so they never pop */
export function eglPickLights(L, cx, cz, max = 16) {
  L.forEach(l => (l.d = Math.hypot(l.p[0] - cx, l.p[2] - cz) * (l.front ? 1.5 : 1)));
  /* alpha 0.4: a window's soft light counts as farther off than a lamp, so the lamps round you are always lit */ L.sort(
    (a, b) => a.d - b.d
  );
  const out = L.slice(0, max);
  if (L.length > max) {
    const edge = L[max].d,
      fade = Math.max(2, edge * 0.15);
    out.forEach(l => {
      const k = clamp((edge - l.d) / fade, 0, 1);
      if (k < 1) l.c = l.c.map(v => v * k);
    });
  }
  return out;
}
