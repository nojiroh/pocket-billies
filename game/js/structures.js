'use strict';
/* ================= STRUCTURES (v18): railings, bridges, arches, tunnels and escalators =================
   Built from the scene's data and drawn with the 3D buildings' renderer (tiled pixel textures in their own colours,
   sun shadows). Stairs themselves are part of the ground (scene.steps); these are the things around them.
   scene.rails      [{pts:[[x,z],…], kind:'iron'|'wood'|'stone'}]           posts and a hand rail along a line
   scene.bridges    [{a:[x,z], b:[x,z], w, kind:'wood'|'stone'|'rope'}]     a walkable deck between two banks
   scene.arches     [{x, z, w, d, h, dir:'z'|'x', kind:'stone'|'rock'|'brick'}] an arch you walk under; a long one set
                    into a cliff is a tunnel
   scene.escalators [{a:[x,z], b:[x,z], w}]                                 moving steps over a stair (bottom a, top b) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { RM, provide } from './hooks.js';
import { clamp } from './util.js';
import { hexA } from './art.js';
import { DIO, dioBridges, dioImg } from './diorama.js';
import { EGL, eglImg, eglPrograms } from './engine/core.js';
import { DGL_WALL_COL, dglCurveArgs, dglUse, dglWallDefault, dioGroundH, dioH } from './diorama-gl.js';
import { BLD_SH, bldArt, bldGuard } from './buildings.js';
/* eslint-disable no-func-assign */
expose({
  STR: [() => STR],
  STR_KIND: [() => STR_KIND],
  strBuild: [() => strBuild, v => (strBuild = v)],
  strDraw: [() => strDraw, v => ((strDraw = v), provide({ strDraw }))],
  strEnsure: [() => strEnsure, v => (strEnsure = v)],
  strFree: [() => strFree, v => (strFree = v)],
  strHas: [() => strHas, v => (strHas = v)],
  strKey: [() => strKey, v => (strKey = v)],
  strN: [() => strN, v => (strN = v)],
  strShadow: [() => strShadow, v => ((strShadow = v), provide({ strShadow }))],
});
/* eslint-enable no-func-assign */
provide({ strDraw, strShadow });
/* to-module: end */
export const STR = { key: '', mesh: null, parts: [] };
const STR_KIND = {
  iron: { tex: 15, col: [0.27, 0.3, 0.38] },
  wood: { tex: 14, col: [0.6, 0.42, 0.28] },
  stone: { tex: 3, col: [0.68, 0.66, 0.62] },
  rock: { tex: 0, col: [0.52, 0.49, 0.46] },
  brick: { tex: 2, col: [0.7, 0.4, 0.32] },
  rope: { tex: 14, col: [0.66, 0.5, 0.32] },
  glass: { tex: 15, col: [0.62, 0.78, 0.84] },
  metal: { tex: 12, col: [0.6, 0.62, 0.66] },
};
function strKey(sc) {
  return (
    DIO.id +
    '|' +
    JSON.stringify([sc.bridges, sc.rails, sc.arches, sc.escalators]) +
    '|' +
    (sc.stepsV || 0) +
    '|' +
    (sc.steps || '').length +
    '|' +
    (sc.heights || []).length
  );
}
export function strHas(sc) {
  return !!(
    (sc.bridges && sc.bridges.length) ||
    (sc.rails && sc.rails.length) ||
    (sc.arches && sc.arches.length) ||
    (sc.escalators && sc.escalators.length)
  );
}
function strN(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function strBuild(sc) {
  const V = [],
    I = [],
    parts = [];
  let part = null;
  const begin = (kind, box, o = {}) => {
      part = { i0: I.length, n: 0, kind, box, ...o };
      parts.push(part);
    },
    end = () => {
      part.n = I.length - part.i0;
    };
  const wd = dglWallDefault(sc),
    rockCol =
      sc.wallCol && sc.wallCol[wd] ? hexA(sc.wallCol[wd]).map(v => v / 255) : DGL_WALL_COL[wd] || STR_KIND.rock.col;
  const poly = (P, n, uv, K, shade = 1) => {
    const b = V.length / 14,
      k = K === 'rock' ? { tex: 10, col: rockCol } : STR_KIND[K] || STR_KIND.stone,
      tc = [k.tex % 8, Math.floor(k.tex / 8)];
    P.forEach((q, i) =>
      V.push(
        q[0],
        q[1],
        q[2],
        n[0],
        n[1],
        n[2],
        uv[i][0],
        uv[i][1],
        tc[0],
        tc[1],
        0,
        k.col[0] * shade,
        k.col[1] * shade,
        k.col[2] * shade
      )
    );
    for (let i = 1; i < P.length - 1; i++) I.push(b, b + i, b + i + 1);
  };
  /* a box along direction (ux,uz) from point a, len long, wid wide, from y0 to y1 */
  const obox = (ax, az, ux, uz, len, wid, y0, y1, K, ya) => {
    const px = (-uz * wid) / 2,
      pz = (ux * wid) / 2,
      bx = ax + ux * len,
      bz = az + uz * len,
      yb = ya ?? y1;
    const c = [
        [ax - px, az - pz],
        [ax + px, az + pz],
        [bx + px, bz + pz],
        [bx - px, bz - pz],
      ],
      top = [y1, y1, yb, yb],
      h = Math.max(y1, yb) - y0;
    poly(
      c.map((q, i) => [q[0], top[i], q[1]]),
      strN([0, 1, 0]),
      [
        [0, 0],
        [wid, 0],
        [wid, len],
        [0, len],
      ],
      K,
      1.06
    );
    for (let i = 0; i < 4; i++) {
      const A = c[i],
        B = c[(i + 1) % 4],
        dx = B[0] - A[0],
        dz = B[1] - A[1],
        l = Math.hypot(dx, dz) || 1,
        n = [-dz / l, 0, dx / l];
      poly(
        [
          [A[0], y0, A[1]],
          [B[0], y0, B[1]],
          [B[0], top[(i + 1) % 4], B[1]],
          [A[0], top[i], A[1]],
        ],
        n,
        [
          [0, 0],
          [l, 0],
          [l, h],
          [0, h],
        ],
        K
      );
    }
  };
  const G = (x, z) => dioGroundH(x, z),
    Hh = (x, z) => dioH(x, z);
  /* railings: posts and a top rail following the ground (or the deck) */
  const railing = (pts, K, yf, hgt = 0.95) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k],
        b = pts[k + 1],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      const ux = (b[0] - a[0]) / L,
        uz = (b[1] - a[1]) / L,
        n = Math.max(1, Math.round(L / 0.9));
      for (let i = 0; i <= n; i++) {
        if (i === n && k < pts.length - 2) continue;
        const x = a[0] + (ux * L * i) / n,
          z = a[1] + (uz * L * i) / n,
          y = yf(x, z);
        if (K === 'stone') continue;
        obox(x - ux * 0.035, z - uz * 0.035, ux, uz, 0.07, 0.07, y - 0.05, y + hgt, K);
      }
      for (let i = 0; i < n; i++) {
        const xa = a[0] + (ux * L * i) / n,
          za = a[1] + (uz * L * i) / n,
          xb = a[0] + (ux * L * (i + 1)) / n,
          zb = a[1] + (uz * L * (i + 1)) / n;
        if (K === 'stone') {
          obox(
            xa,
            za,
            ux,
            uz,
            L / n,
            0.22,
            Math.min(yf(xa, za), yf(xb, zb)) - 0.1,
            yf(xa, za) + 0.62,
            K,
            yf(xb, zb) + 0.62
          );
        } else {
          obox(
            xa,
            za,
            ux,
            uz,
            L / n,
            0.06,
            yf(xa, za) + hgt - 0.05,
            yf(xa, za) + hgt + 0.02,
            K,
            yf(xb, zb) + hgt + 0.02
          );
          if (K === 'wood')
            obox(
              xa,
              za,
              ux,
              uz,
              L / n,
              0.04,
              yf(xa, za) + hgt * 0.5 - 0.03,
              yf(xa, za) + hgt * 0.5 + 0.02,
              K,
              yf(xb, zb) + hgt * 0.5 + 0.02
            );
        }
      }
    }
  };
  for (const r of sc.rails || []) {
    const P = r.pts || [];
    if (P.length < 2) continue;
    const xs = P.map(p => p[0]),
      zs = P.map(p => p[1]);
    begin('rail', [Math.min(...xs) - 0.3, Math.min(...zs) - 0.3, Math.max(...xs) + 0.3, Math.max(...zs) + 0.3]);
    railing(P, r.kind || 'iron', Hh, r.kind === 'wood' ? 0.85 : 0.95);
    end();
  }
  /* bridges */
  for (const b of dioBridges(sc) || []) {
    const K = b.kind || 'wood',
      ux = b.ux,
      uz = b.uz,
      px = -uz,
      pz = ux,
      w = b.w,
      deck = t => b.ha + (b.hb - b.ha) * t + b.arc * Math.sin(Math.PI * t),
      seg = Math.max(4, Math.round(b.len / 0.5));
    begin('bridge', [
      Math.min(b.a[0], b.b[0]) - w,
      Math.min(b.a[1], b.b[1]) - w,
      Math.max(b.a[0], b.b[0]) + w,
      Math.max(b.a[1], b.b[1]) + w,
    ]);
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg,
        t1 = (i + 1) / seg,
        ax = b.a[0] + ux * b.len * t0,
        az = b.a[1] + uz * b.len * t0,
        gap = K === 'rope' ? 0.06 : 0.01,
        dk = K === 'stone' ? 'stone' : 'wood';
      obox(ax, az, ux, uz, b.len / seg - gap, w, deck(t0) - 0.14, deck(t0) + 0.02, dk, deck(t1) + 0.02);
    }
    const side = s2 =>
        [0, 0.25, 0.5, 0.75, 1].map(t => [
          b.a[0] + ux * b.len * t + px * s2 * (w / 2 - 0.05),
          b.a[1] + uz * b.len * t + pz * s2 * (w / 2 - 0.05),
        ]),
      yAt = (x, z) => {
        const t = clamp(((x - b.a[0]) * ux + (z - b.a[1]) * uz) / b.len, 0, 1);
        return deck(t);
      };
    if (!b.pier)
      for (const s2 of [-1, 1]) {
        if (K === 'stone') railing(side(s2), 'stone', yAt);
        else if (K === 'rope') {
          railing(side(s2), 'rope', yAt, 0.9);
        } else railing(side(s2), 'wood', yAt, 0.85);
      }
    /* alpha 0.4: a jetty: a beam under each edge of the deck and a pair of posts every metre and a half, down into the water */
    if (b.pier) {
      const y = deck(0);
      for (const s2 of [-1, 1])
        obox(
          b.a[0] + px * s2 * (w / 2 - 0.06),
          b.a[1] + pz * s2 * (w / 2 - 0.06),
          ux,
          uz,
          b.len,
          0.12,
          y - 0.3,
          y - 0.12,
          'wood'
        );
      const n = Math.max(2, Math.round(b.len / 1.5));
      for (let i = 0; i <= n; i++) {
        const t = Math.min(1 - 0.04 / b.len, Math.max(0.25 / b.len, i / n));
        for (const s2 of [-1, 1]) {
          const x = b.a[0] + ux * b.len * t + px * s2 * (w / 2 - 0.08),
            z = b.a[1] + uz * b.len * t + pz * s2 * (w / 2 - 0.08);
          obox(x - ux * 0.08, z - uz * 0.08, ux, uz, 0.16, 0.16, G(x, z) - 0.6, y - 0.1, 'wood');
        }
      }
    }
    /* what holds it up: posts into the water for wood and rope, an arched wall each side for stone */
    if (K === 'stone') {
      for (const s2 of [-1, 1]) {
        const n = [px * s2, 0, pz * s2];
        for (let i = 0; i < seg; i++) {
          const t0 = i / seg,
            t1 = (i + 1) / seg,
            xa = b.a[0] + ux * b.len * t0 + (px * s2 * w) / 2,
            za = b.a[1] + uz * b.len * t0 + (pz * s2 * w) / 2,
            xb = b.a[0] + ux * b.len * t1 + (px * s2 * w) / 2,
            zb = b.a[1] + uz * b.len * t1 + (pz * s2 * w) / 2;
          const bot = t => {
            const gx = b.a[0] + ux * b.len * t,
              gz = b.a[1] + uz * b.len * t,
              g = G(gx, gz) - 0.3;
            return g + (deck(t) - 0.4 - g) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
          };
          poly(
            [
              [xa, bot(t0), za],
              [xb, bot(t1), zb],
              [xb, deck(t1) - 0.1, zb],
              [xa, deck(t0) - 0.1, za],
            ],
            n,
            [
              [0, 0],
              [b.len / seg, 0],
              [b.len / seg, 1],
              [0, 1],
            ],
            'stone'
          );
        }
      }
    } else if (!b.pier) {
      const n = Math.max(1, Math.floor(b.len / 2));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        for (const s2 of [-1, 1]) {
          const x = b.a[0] + ux * b.len * t + px * s2 * (w / 2 - 0.1),
            z = b.a[1] + uz * b.len * t + pz * s2 * (w / 2 - 0.1);
          obox(x - ux * 0.07, z - uz * 0.07, ux, uz, 0.14, 0.14, G(x, z) - 0.5, deck(t) - 0.1, 'wood');
        }
      }
      if (K === 'rope')
        for (const t of [0, 1])
          for (const s2 of [-1, 1]) {
            const x = b.a[0] + ux * b.len * t + px * s2 * (w / 2),
              z = b.a[1] + uz * b.len * t + pz * s2 * (w / 2);
            obox(x - ux * 0.08, z - uz * 0.08, ux, uz, 0.16, 0.16, G(x, z) - 0.1, deck(t) + 1.3, 'wood');
          }
    }
    end();
  }
  /* arches and tunnels: two piers and a round vault, deep along the passage */
  for (const a of sc.arches || []) {
    const K = a.kind || 'stone',
      w = a.w || 2.4,
      d = a.d || 1,
      h = a.h || 2.6,
      alongZ = (a.dir || 'z') === 'z',
      y0 = G(a.x, a.z),
      pier = a.pier || (K === 'rock' ? 0.95 : 0.55),
      spring = h - w / 2;
    const ux = alongZ ? 0 : 1,
      uz = alongZ ? 1 : 0,
      px = alongZ ? 1 : 0,
      pz = alongZ ? 0 : 1;
    begin(
      'arch',
      alongZ
        ? [a.x - w / 2 - pier, a.z, a.x + w / 2 + pier, a.z + d]
        : [a.x, a.z - w / 2 - pier, a.x + d, a.z + w / 2 + pier],
      { fadeUnder: 1 }
    );
    /* piers */
    for (const s2 of [-1, 1]) {
      const ox = a.x + px * s2 * (w / 2 + pier / 2),
        oz = a.z + pz * s2 * (w / 2 + pier / 2);
      obox(ox, oz, ux, uz, d, pier, y0 - 0.4, y0 + spring, K);
    }
    /* the vault: segments of a half circle, each a slab along the passage */
    const R = w / 2,
      segs = 10;
    for (let i = 0; i < segs; i++) {
      const a0 = (Math.PI * i) / segs,
        a1 = (Math.PI * (i + 1)) / segs,
        r2 = R + pier,
        cs = (an, r) => [a.x + px * Math.cos(an) * r, y0 + spring + Math.sin(an) * r, a.z + pz * Math.cos(an) * r];
      const i0 = cs(a0, R),
        i1 = cs(a1, R),
        o0 = cs(a0, r2),
        o1 = cs(a1, r2),
        dd = [ux * d, 0, uz * d],
        add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
      const nIn = strN([-(px * Math.cos((a0 + a1) / 2)), -Math.sin((a0 + a1) / 2), -(pz * Math.cos((a0 + a1) / 2))]),
        nOut = [-nIn[0], -nIn[1], -nIn[2]];
      poly(
        [i0, i1, add(i1, dd), add(i0, dd)],
        nIn,
        [
          [0, 0],
          [0.3, 0],
          [0.3, d],
          [0, d],
        ],
        K,
        0.82
      );
      poly(
        [o1, o0, add(o0, dd), add(o1, dd)],
        nOut,
        [
          [0, 0],
          [0.3, 0],
          [0.3, d],
          [0, d],
        ],
        K
      );
      for (const [face, off] of [
        [
          [-ux, 0, -uz],
          [0, 0, 0],
        ],
        [[ux, 0, uz], dd],
      ])
        poly(
          [add(i0, off), add(o0, off), add(o1, off), add(i1, off)],
          face,
          [
            [0, 0],
            [pier, 0],
            [pier, 0.3],
            [0, 0.3],
          ],
          K
        );
    }
    /* built arches get square shoulders and a flat top; a rock arch stays a bare curve */
    if (K !== 'rock') {
      const top = y0 + spring + R + pier + 0.25,
        lo = y0 + spring + R * 0.72,
        wd = R + pier - R * 0.7,
        c = R * 0.7 + wd / 2;
      for (const s2 of [-1, 1]) obox(a.x + px * s2 * c, a.z + pz * s2 * c, ux, uz, d, wd, lo, top, K);
      obox(a.x, a.z, ux, uz, d, 2 * (R + pier) + 0.1, y0 + spring + R + pier - 0.08, top, K);
    }
    end();
  }
  /* escalators: metal steps over the stair cells, glass side panels and black hand rails; the steps scroll upward */
  for (const e of sc.escalators || []) {
    const ax = e.a[0],
      az = e.a[1],
      bx = e.b[0],
      bz = e.b[1],
      L = Math.hypot(bx - ax, bz - az) || 1,
      ux = (bx - ax) / L,
      uz = (bz - az) / L,
      px = -uz,
      pz = ux,
      w = e.w || 1.4,
      n = Math.max(2, Math.round(L / 0.5));
    begin('escalator', [Math.min(ax, bx) - w, Math.min(az, bz) - w, Math.max(ax, bx) + w, Math.max(az, bz) + w], {
      scroll: [ux, uz],
    });
    for (let i = 0; i < n; i++) {
      const x = ax + (ux * L * (i + 0.5)) / n,
        z = az + (uz * L * (i + 0.5)) / n,
        y = G(x, z) + 0.02;
      obox(ax + (ux * L * i) / n, az + (uz * L * i) / n, ux, uz, L / n, w, y - 0.3, y, 'metal');
    }
    for (const s2 of [-1, 1]) {
      const P = [0, 0.5, 1].map(t => [
        ax + ux * L * t + px * s2 * (w / 2 + 0.06),
        az + uz * L * t + pz * s2 * (w / 2 + 0.06),
      ]);
      for (let i = 0; i < 2; i++) {
        const A = P[i],
          B = P[i + 1],
          ya = G(A[0] - px * s2 * 0.2, A[1] - pz * s2 * 0.2),
          yb = G(B[0] - px * s2 * 0.2, B[1] - pz * s2 * 0.2);
        obox(A[0], A[1], ux, uz, L / 2, 0.08, Math.min(ya, yb) - 0.3, ya + 0.85, 'glass', yb + 0.85);
        obox(A[0], A[1], ux, uz, L / 2, 0.1, ya + 0.85, ya + 0.95, 'iron', yb + 0.95);
      }
    }
    end();
  }
  if (!I.length) return { mesh: null, parts: [] };
  const gl = EGL.gl,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(I), gl.STATIC_DRAW);
  let off = 0;
  for (const [l, n] of [
    [0, 3],
    [1, 3],
    [2, 2],
    [3, 3],
    [4, 3],
  ]) {
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, n, gl.FLOAT, false, 56, off * 4);
    gl.vertexAttribDivisor(l, 0);
    off += n;
  }
  gl.bindVertexArray(null);
  return { mesh: { vao, vb, ib, n: I.length }, parts };
}
function strEnsure() {
  const sc = DIO.sc;
  if (!sc || !strHas(sc)) {
    if (STR.mesh) strFree();
    STR.key = '';
    return false;
  }
  const k = strKey(sc);
  if (k === STR.key && STR.mesh) return true;
  strFree();
  const r = strBuild(sc);
  STR.mesh = r.mesh;
  STR.parts = r.parts;
  STR.key = k;
  return !!STR.mesh;
}
function strFree() {
  if (!STR.mesh) return;
  const gl = EGL.gl;
  try {
    gl.deleteVertexArray(STR.mesh.vao);
    gl.deleteBuffer(STR.mesh.vb);
    gl.deleteBuffer(STR.mesh.ib);
  } catch (e) {}
  STR.mesh = null;
  STR.parts = [];
}
function strDraw(C, X) {
  if (typeof bldGuard !== 'function') return;
  bldGuard(() => {
    if (!strEnsure()) return;
    const gl = EGL.gl;
    eglPrograms(BLD_SH);
    const A = bldArt(),
      det = eglImg(dioImg(A.detail), { noNormal: true });
    if (!det) return;
    const p = dglUse('bld', C, X),
      sc = DIO.sc,
      P = DIO.pl,
      t = RM ? 0 : DIO.t / 1000;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, det.t);
    gl.uniform1i(p.U.uDet, 0);
    gl.uniform1f(p.U.uBaseY, -99);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(STR.mesh.vao);
    for (const q of STR.parts) {
      if (!q.n) continue;
      const b = q.box,
        under = q.fadeUnder && P.x > b[0] - 0.2 && P.x < b[2] + 0.2 && P.z > b[1] - 0.2 && P.z < b[3] + 1.2;
      gl.uniform1f(p.U.uFade, under ? 0.35 : 1);
      gl.uniform2f(p.U.uLift, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
      gl.uniform2f(p.U.uScroll, q.scroll ? -q.scroll[0] * t * 0.6 : 0, q.scroll ? (t * 0.6) % 2 : 0);
      gl.drawElements(gl.TRIANGLES, q.n, gl.UNSIGNED_INT, q.i0 * 4);
    }
    gl.uniform2f(p.U.uScroll, 0, 0);
    gl.bindVertexArray(null);
  });
}
function strShadow(SH) {
  if (typeof bldGuard !== 'function') return;
  bldGuard(() => {
    if (!strEnsure()) return;
    const gl = EGL.gl;
    eglPrograms(BLD_SH);
    const p = EGL.P.bshadow;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    const ca = dglCurveArgs(),
      sc = DIO.sc;
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    gl.bindVertexArray(STR.mesh.vao);
    for (const q of STR.parts) {
      if (!q.n) continue;
      const b = q.box;
      gl.uniform2f(p.U.uLift, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
      gl.drawElements(gl.TRIANGLES, q.n, gl.UNSIGNED_INT, q.i0 * 4);
    }
    gl.bindVertexArray(null);
  });
}
