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
import { provide, reducedMotion } from './hooks.js';
import { clamp } from './util.js';
import { hexToRgb } from './art.js';
import { artImage, mapBridges, walkView } from './walk-view.js';
import { ensurePrograms, gpuBuffer, gpuFree, gpuState, gpuVao, imageTexture } from './engine/webgl.js';
import { WALL_COLORS, defaultWallMaterial, groundHeightAt, standingHeightAt } from './walk/heights.js';
import { useWalkProgram, worldCurveArgs } from './walk/draw-common.js';
import { BUILDING_SHADERS, buildingArt, buildingGuard } from './buildings.js';
/* eslint-disable no-func-assign */
expose({
  STRUCTURE_MATERIALS: [() => STRUCTURE_MATERIALS],
  buildStructures: [() => buildStructures, v => (buildStructures = v)],
  drawStructureShadows: [
    () => drawStructureShadows,
    v => ((drawStructureShadows = v), provide({ drawStructureShadows })),
  ],
  drawStructures: [() => drawStructures, v => setDrawStructures(v)],
  ensureStructures: [() => ensureStructures, v => (ensureStructures = v)],
  freeStructures: [() => freeStructures, v => (freeStructures = v)],
  hasStructures: [() => hasStructures, v => (hasStructures = v)],
  structureKey: [() => structureKey, v => (structureKey = v)],
  structureState: [() => structureState],
  unitVector3: [() => unitVector3, v => (unitVector3 = v)],
});
/* eslint-enable no-func-assign */
provide({ drawStructureShadows, drawStructures });
export function setDrawStructures(v) {
  drawStructures = v; // eslint-disable-line no-func-assign
  provide({ drawStructures });
}
/* to-module: end */
export const structureState = { key: '', mesh: null, parts: [] };
provide({ structureState }); /* to-module */
/* route props track RP-2: the props' palette (tools/build-props-batch1.py AIR, the ruins' stones of
   tools/build-props-routes.py), so a bridge, a rail or an arch reads like the models beside it */
const STRUCTURE_MATERIALS = {
  iron: { tex: 12, col: [0.275, 0.329, 0.439] },
  wood: { tex: 14, col: [0.698, 0.463, 0.282] },
  woodD: { tex: 14, col: [0.518, 0.329, 0.235] },
  plank: { tex: 14, col: [0.8, 0.588, 0.376] },
  plankL: { tex: 14, col: [0.839, 0.635, 0.424] },
  stone: { tex: 3, col: [0.667, 0.651, 0.706] },
  stoneL: { tex: 3, col: [0.784, 0.769, 0.831] },
  stoneD: { tex: 3, col: [0.549, 0.525, 0.596] },
  moss: { tex: 16, col: [0.463, 0.667, 0.314] },
  rock: { tex: 0, col: [0.52, 0.49, 0.46] },
  brick: { tex: 2, col: [0.7, 0.4, 0.32] },
  brickD: { tex: 2, col: [0.58, 0.32, 0.27] },
  rope: { tex: 18, col: [0.784, 0.627, 0.376] },
  glass: { tex: 15, col: [0.62, 0.78, 0.84] },
  metal: { tex: 12, col: [0.6, 0.62, 0.66] },
};
function structureKey(sc) {
  return (
    walkView.id +
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
export function hasStructures(sc) {
  return !!(
    (sc.bridges && sc.bridges.length) ||
    (sc.rails && sc.rails.length) ||
    (sc.arches && sc.arches.length) ||
    (sc.escalators && sc.escalators.length)
  );
}
function unitVector3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function buildStructures(sc) {
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
  const wd = defaultWallMaterial(sc),
    rockCol =
      sc.wallCol && sc.wallCol[wd]
        ? hexToRgb(sc.wallCol[wd]).map(v => v / 255)
        : WALL_COLORS[wd] || STRUCTURE_MATERIALS.rock.col;
  const poly = (P, n, uv, K, shade = 1) => {
    const b = V.length / 14,
      k = K === 'rock' ? { tex: 10, col: rockCol } : STRUCTURE_MATERIALS[K] || STRUCTURE_MATERIALS.stone,
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
      unitVector3([0, 1, 0]),
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
  /* RP-2: a square beam of side t between two points [x, y, z] at any slant (a brace, a rope, a hanger) */
  const beam = (p, q, t, K) => {
    const d = unitVector3([q[0] - p[0], q[1] - p[1], q[2] - p[2]]),
      r = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
      u = unitVector3([d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]]),
      v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]],
      L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]),
      c = [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ].map(([a, b]) => [
        (u[0] * a + v[0] * b) * (t / 2),
        (u[1] * a + v[1] * b) * (t / 2),
        (u[2] * a + v[2] * b) * (t / 2),
      ]),
      at = (o, k) => [o[0] + c[k][0], o[1] + c[k][1], o[2] + c[k][2]];
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4,
        n = unitVector3([c[k][0] + c[k2][0], c[k][1] + c[k2][1], c[k][2] + c[k2][2]]);
      poly(
        [at(p, k), at(q, k), at(q, k2), at(p, k2)],
        n,
        [
          [0, 0],
          [L, 0],
          [L, t],
          [0, t],
        ],
        K
      );
    }
  };
  /* RP-2: a pyramid cap on a post (its top at y, s across, h high), as the props' fence and gate posts have */
  const cap = (x, z, y, s, h, K) => {
    const c = [
      [x - s / 2, z - s / 2],
      [x + s / 2, z - s / 2],
      [x + s / 2, z + s / 2],
      [x - s / 2, z + s / 2],
    ];
    for (let k = 0; k < 4; k++) {
      const A = c[k],
        B = c[(k + 1) % 4],
        mx = (A[0] + B[0]) / 2 - x,
        mz = (A[1] + B[1]) / 2 - z;
      poly(
        [
          [A[0], y, A[1]],
          [B[0], y, B[1]],
          [x, y + h, z],
        ],
        unitVector3([mx * h, (s * s) / 4, mz * h]),
        [
          [0, 0],
          [s, 0],
          [s / 2, h],
        ],
        K,
        1.03
      );
    }
  };
  /* RP-2: a light and a dark look of a material for alternate planks, stones and courses */
  const alt = (K, i) =>
    K === 'stone'
      ? ['stone', 'stoneL'][i % 2]
      : K === 'brick'
        ? ['brick', 'brickD'][i % 2]
        : ['plank', 'plankL'][i % 2];
  /* a hash of a number to 0..1, for the moss and the odd darker plank (the same on every build of the scene) */
  const h01 = n => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const G = (x, z) => groundHeightAt(x, z),
    Hh = (x, z) => standingHeightAt(x, z);
  /* railings: posts and a top rail following the ground (or the deck). RP-2: in the props' style: wooden posts with
     pyramid caps and two rails, slim iron posts with finials, a coursed stone wall with a coping and moss, a rope
     that the deck hangs from */
  const railing = (pts, K, yf, hgt = 0.95) => {
    let seed = pts.length ? pts[0][0] * 7.3 + pts[0][1] * 3.1 : 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k],
        b = pts[k + 1],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      const ux = (b[0] - a[0]) / L,
        uz = (b[1] - a[1]) / L,
        n = Math.max(1, Math.round(L / 0.9)),
        at = f => [a[0] + ux * L * f, a[1] + uz * L * f];
      if (K === 'stone') {
        /* two courses of blocks about 0.55 m long, the upper laid half a block along, in three tones; a coping laid
           over them; moss here and there */
        const nb = Math.max(1, Math.round(L / 0.55)),
          tone = v => (v < 0.33 ? 'stoneD' : v < 0.7 ? 'stone' : 'stoneL');
        for (const r of [0, 1])
          for (let i = 0; i <= nb; i++) {
            const f0 = clamp((i - r * 0.5) / nb, 0, 1),
              f1 = clamp((i + 1 - r * 0.5) / nb, 0, 1);
            if (f1 - f0 < 1e-3) continue;
            const [xa, za] = at(f0),
              [xb, zb] = at(f1),
              ya = yf(xa, za),
              yb = yf(xb, zb),
              lo = r ? Math.min(ya, yb) + 0.27 : Math.min(ya, yb) - 0.1,
              hi = r ? 0.55 : 0.28;
            obox(
              xa,
              za,
              ux,
              uz,
              (f1 - f0) * L - 0.02,
              r ? 0.23 : 0.24,
              lo,
              ya + hi,
              tone(h01(seed + i * 2 + r)),
              yb + hi
            );
          }
        for (let i = 0; i < nb; i++) {
          const [xa, za] = at(i / nb),
            [xb, zb] = at((i + 1) / nb),
            ya = yf(xa, za),
            yb = yf(xb, zb);
          obox(xa, za, ux, uz, L / nb, 0.32, ya + 0.55, ya + 0.63, i % 3 ? 'stoneL' : 'stone', yb + 0.63);
          if (h01(seed + i) < 0.18) {
            const [mx, mz] = at((i + 0.3) / nb);
            obox(mx, mz, ux, uz, 0.22, 0.3, yf(mx, mz) + 0.63, yf(mx, mz) + 0.68, 'moss');
          }
        }
        seed += nb;
        continue;
      }
      for (let i = 0; i <= n; i++) {
        if (i === n && k < pts.length - 2) continue;
        const [x, z] = at(i / n),
          y = yf(x, z);
        if (K === 'rope') continue;
        const s = K === 'iron' ? 0.05 : 0.1;
        obox(x - ux * (s / 2), z - uz * (s / 2), ux, uz, s, s, y - 0.05, y + hgt, K === 'iron' ? 'iron' : 'woodD');
        cap(x, z, y + hgt, s + 0.03, K === 'iron' ? 0.07 : 0.06, K === 'iron' ? 'iron' : 'woodD');
      }
      for (let i = 0; i < n; i++) {
        const [xa, za] = at(i / n),
          [xb, zb] = at((i + 1) / n),
          ya = yf(xa, za),
          yb = yf(xb, zb);
        if (K === 'rope') {
          /* the hand rope dips between the hangers; a hanger every 0.6 m down to the deck's edge */
          const m = Math.max(2, Math.round(L / n / 0.3));
          for (let j = 0; j < m; j++) {
            const f0 = (i + j / m) / n,
              f1 = (i + (j + 1) / m) / n,
              [x0, z0] = at(f0),
              [x1, z1] = at(f1),
              d0 = 0.12 * Math.sin((Math.PI * j) / m),
              d1 = 0.12 * Math.sin((Math.PI * (j + 1)) / m);
            beam([x0, yf(x0, z0) + hgt - d0, z0], [x1, yf(x1, z1) + hgt - d1, z1], 0.04, 'rope');
            if (j % 2 === 0) beam([x0, yf(x0, z0) + hgt - d0, z0], [x0, yf(x0, z0) + 0.02, z0], 0.02, 'rope');
          }
          continue;
        }
        if (K === 'iron') {
          obox(xa, za, ux, uz, L / n, 0.05, ya + hgt - 0.04, ya + hgt + 0.02, 'iron', yb + hgt + 0.02);
          obox(
            xa,
            za,
            ux,
            uz,
            L / n,
            0.03,
            ya + hgt * 0.45 - 0.02,
            ya + hgt * 0.45 + 0.01,
            'iron',
            yb + hgt * 0.45 + 0.01
          );
          continue;
        }
        obox(xa, za, ux, uz, L / n, 0.07, ya + hgt - 0.12, ya + hgt - 0.04, 'woodD', yb + hgt - 0.04);
        obox(xa, za, ux, uz, L / n, 0.05, ya + hgt * 0.5 - 0.04, ya + hgt * 0.5 + 0.03, 'wood', yb + hgt * 0.5 + 0.03);
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
  /* bridges. RP-2, in the props' style: a deck of planks across in two tones (now and then a darker one) with small
     gaps, beams under its edges, rails with capped posts, cross-braced trestles; stone: paving in two tones, a coursed
     parapet, a ring of darker voussoirs under each face and the vault's underside */
  for (const b of mapBridges(sc) || []) {
    const K = b.kind || 'wood',
      ux = b.ux,
      uz = b.uz,
      px = -uz,
      pz = ux,
      w = b.w,
      deck = t => b.ha + (b.hb - b.ha) * t + b.arc * Math.sin(Math.PI * t),
      seg = Math.max(4, Math.round(b.len / 0.5)),
      pt = (t, off = 0) => [b.a[0] + ux * b.len * t + px * off, b.a[1] + uz * b.len * t + pz * off],
      seed = b.a[0] * 3.7 + b.a[1] * 1.3;
    begin('bridge', [
      Math.min(b.a[0], b.b[0]) - w,
      Math.min(b.a[1], b.b[1]) - w,
      Math.max(b.a[0], b.b[0]) + w,
      Math.max(b.a[1], b.b[1]) + w,
    ]);
    if (K === 'stone')
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg,
          t1 = (i + 1) / seg,
          [ax, az] = pt(t0);
        obox(ax, az, ux, uz, b.len / seg - 0.01, w, deck(t0) - 0.14, deck(t0) + 0.02, alt('stone', i), deck(t1) + 0.02);
      }
    else {
      const np = Math.max(4, Math.round(b.len / (K === 'rope' ? 0.3 : 0.24))),
        gap = K === 'rope' ? 0.08 : 0.03;
      for (let i = 0; i < np; i++) {
        const t0 = i / np,
          t1 = (i + 1) / np - gap / b.len,
          [ax, az] = pt(t0),
          k2 = h01(seed + i) < 0.12 ? 'wood' : alt('wood', i);
        obox(
          ax,
          az,
          ux,
          uz,
          (t1 - t0) * b.len,
          K === 'rope' ? w - 0.1 : w + 0.06,
          deck(t0) - 0.06,
          deck(t0) + 0.02,
          k2,
          deck(t1) + 0.02
        );
      }
      /* a beam under each edge of the deck */
      for (const s2 of [-1, 1])
        for (let i = 0; i < seg; i++) {
          const t0 = i / seg,
            t1 = (i + 1) / seg,
            [ax, az] = pt(t0, s2 * (w / 2 - 0.1));
          obox(ax, az, ux, uz, b.len / seg, 0.12, deck(t0) - 0.26, deck(t0) - 0.06, 'woodD', deck(t1) - 0.06);
        }
    }
    const side = s2 => [0, 0.25, 0.5, 0.75, 1].map(t => pt(t, s2 * (w / 2 - 0.05))),
      yAt = (x, z) => {
        const t = clamp(((x - b.a[0]) * ux + (z - b.a[1]) * uz) / b.len, 0, 1);
        return deck(t);
      };
    if (!b.pier)
      for (const s2 of [-1, 1]) {
        if (K === 'stone') railing(side(s2), 'stone', yAt);
        else if (K === 'rope') {
          railing(side(s2), 'rope', yAt, 0.9);
        } else {
          railing(side(s2), 'wood', yAt, 0.85);
          /* a stout newel post at each end */
          for (const t of [0, 1]) {
            const [x, z] = pt(t, s2 * (w / 2 - 0.05));
            obox(x - ux * 0.08, z - uz * 0.08, ux, uz, 0.16, 0.16, G(x, z) - 0.1, deck(t) + 1.0, 'woodD');
            cap(x, z, deck(t) + 1.0, 0.2, 0.1, 'woodD');
          }
        }
      }
    /* alpha 0.4: a jetty: a beam under each edge of the deck and a pair of posts every metre and a half, down into the
       water; RP-2: the last pair stands up past the deck as mooring posts with caps */
    if (b.pier) {
      const y = deck(0);
      for (const s2 of [-1, 1]) {
        const [x, z] = pt(0, s2 * (w / 2 - 0.06));
        obox(x, z, ux, uz, b.len, 0.12, y - 0.3, y - 0.12, 'woodD');
      }
      const n = Math.max(2, Math.round(b.len / 1.5));
      for (let i = 0; i <= n; i++) {
        const t = Math.min(1 - 0.04 / b.len, Math.max(0.25 / b.len, i / n));
        for (const s2 of [-1, 1]) {
          const [x, z] = pt(t, s2 * (w / 2 - 0.08)),
            top = i === n ? y + 0.5 : y - 0.1;
          obox(x - ux * 0.08, z - uz * 0.08, ux, uz, 0.16, 0.16, G(x, z) - 0.6, top, 'woodD');
          if (i === n) cap(x, z, top, 0.2, 0.08, 'woodD');
        }
      }
    }
    /* what holds it up: braced posts into the water for wood and rope, an arched wall each side for stone */
    if (K === 'stone') {
      const bot = t => {
        const [gx, gz] = pt(t),
          g = G(gx, gz) - 0.3;
        return g + (deck(t) - 0.4 - g) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
      };
      for (const s2 of [-1, 1]) {
        const n = [px * s2, 0, pz * s2];
        for (let i = 0; i < seg; i++) {
          const t0 = i / seg,
            t1 = (i + 1) / seg,
            [xa, za] = pt(t0, (s2 * w) / 2),
            [xb, zb] = pt(t1, (s2 * w) / 2),
            r0 = Math.min(bot(t0) + 0.34, deck(t0) - 0.1),
            r1 = Math.min(bot(t1) + 0.34, deck(t1) - 0.1);
          /* the ring of voussoirs along the arch, then the spandrel wall up to the deck */
          poly(
            [
              [xa, bot(t0), za],
              [xb, bot(t1), zb],
              [xb, r1, zb],
              [xa, r0, za],
            ],
            n,
            [
              [0, 0],
              [b.len / seg, 0],
              [b.len / seg, 0.34],
              [0, 0.34],
            ],
            i % 2 ? 'stoneD' : 'stone'
          );
          if (deck(t0) - 0.1 > r0 + 0.01 || deck(t1) - 0.1 > r1 + 0.01)
            poly(
              [
                [xa, r0, za],
                [xb, r1, zb],
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
      /* the vault's underside */
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg,
          t1 = (i + 1) / seg,
          [xa, za] = pt(t0, -w / 2),
          [xb, zb] = pt(t1, -w / 2),
          [xc, zc] = pt(t1, w / 2),
          [xd, zd] = pt(t0, w / 2);
        poly(
          [
            [xa, bot(t0), za],
            [xb, bot(t1), zb],
            [xc, bot(t1), zc],
            [xd, bot(t0), zd],
          ],
          [0, -1, 0],
          [
            [0, 0],
            [b.len / seg, 0],
            [b.len / seg, w],
            [0, w],
          ],
          'stoneD'
        );
      }
    } else if (!b.pier) {
      const n = Math.max(1, Math.floor(b.len / 2));
      for (let i = 1; i < n; i++) {
        const t = i / n,
          ends = [];
        for (const s2 of [-1, 1]) {
          const [x, z] = pt(t, s2 * (w / 2 - 0.1));
          obox(x - ux * 0.07, z - uz * 0.07, ux, uz, 0.14, 0.14, G(x, z) - 0.5, deck(t) - 0.1, 'woodD');
          ends.push([x, z]);
        }
        /* a cross brace between the pair, down to the water or a metre below the deck */
        const [[xl, zl], [xr, zr]] = ends,
          lo = Math.max(G(xr, zr), deck(t) - 1.2);
        if (deck(t) - 0.25 - lo > 0.3) beam([xl, deck(t) - 0.25, zl], [xr, lo, zr], 0.06, 'wood');
      }
      if (K === 'rope')
        for (const t of [0, 1])
          for (const s2 of [-1, 1]) {
            const [x, z] = pt(t, (s2 * w) / 2);
            obox(x - ux * 0.08, z - uz * 0.08, ux, uz, 0.16, 0.16, G(x, z) - 0.1, deck(t) + 1.3, 'woodD');
            cap(x, z, deck(t) + 1.3, 0.2, 0.1, 'woodD');
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
      /* RP-2: a built pier in courses of two tones; a rock one stays whole */
      const nc = K === 'rock' ? 1 : Math.max(1, Math.round((spring + 0.4) / 0.42)),
        hc = (spring + 0.4) / nc;
      for (let c = 0; c < nc; c++)
        obox(ox, oz, ux, uz, d, pier, y0 - 0.4 + c * hc, y0 - 0.4 + (c + 1) * hc, K === 'rock' ? K : alt(K, c));
    }
    /* the vault: segments of a half circle, each a slab along the passage */
    const R = w / 2,
      segs = 11;
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
      const nIn = unitVector3([
          -(px * Math.cos((a0 + a1) / 2)),
          -Math.sin((a0 + a1) / 2),
          -(pz * Math.cos((a0 + a1) / 2)),
        ]),
        nOut = [-nIn[0], -nIn[1], -nIn[2]],
        /* RP-2: voussoirs in two tones round a lighter keystone (stone), two brick tones */
        vk = K === 'rock' ? K : K === 'brick' ? alt('brick', i) : i === 5 ? 'stoneL' : i % 2 ? 'stoneD' : 'stone';
      poly(
        [i0, i1, add(i1, dd), add(i0, dd)],
        nIn,
        [
          [0, 0],
          [0.3, 0],
          [0.3, d],
          [0, d],
        ],
        K === 'stone' ? 'stoneD' : K,
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
        vk
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
          vk
        );
    }
    /* built arches get square shoulders and a flat top; a rock arch stays a bare curve */
    if (K !== 'rock') {
      const top = y0 + spring + R + pier + 0.25,
        lo = y0 + spring + R * 0.72,
        wd = R + pier - R * 0.7,
        c = R * 0.7 + wd / 2;
      for (const s2 of [-1, 1]) obox(a.x + px * s2 * c, a.z + pz * s2 * c, ux, uz, d, wd, lo, top, K);
      obox(a.x, a.z, ux, uz, d, 2 * (R + pier) + 0.1, y0 + spring + R + pier - 0.08, top - 0.1, K);
      /* RP-2: a coping a little wider than the wall */
      obox(
        a.x - ux * 0.05,
        a.z - uz * 0.05,
        ux,
        uz,
        d + 0.1,
        2 * (R + pier) + 0.2,
        top - 0.1,
        top,
        K === 'stone' ? 'stoneL' : K
      );
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
  const gl = gpuState.gl,
    vao = gpuVao('meshes');
  gl.bindVertexArray(vao);
  const vb = gpuBuffer('meshes', V.length * 4);
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  const ib = gpuBuffer('meshes', I.length * 4);
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
function ensureStructures() {
  const sc = walkView.sc;
  if (!sc || !hasStructures(sc)) {
    if (structureState.mesh) freeStructures();
    structureState.key = '';
    return false;
  }
  const k = structureKey(sc);
  if (k === structureState.key && structureState.mesh) return true;
  freeStructures();
  const r = buildStructures(sc);
  structureState.mesh = r.mesh;
  structureState.parts = r.parts;
  structureState.key = k;
  return !!structureState.mesh;
}
function freeStructures() {
  if (!structureState.mesh) return;
  gpuFree(structureState.mesh.vao);
  gpuFree(structureState.mesh.vb);
  gpuFree(structureState.mesh.ib);
  structureState.mesh = null;
  structureState.parts = [];
}
export function drawStructures(C, X) {
  if (typeof buildingGuard !== 'function') return;
  buildingGuard(() => {
    if (!ensureStructures()) return;
    const gl = gpuState.gl;
    ensurePrograms(BUILDING_SHADERS);
    const A = buildingArt(),
      det = imageTexture(artImage(A.detail), { noNormal: true });
    if (!det) return;
    const p = useWalkProgram('bld', C, X),
      sc = walkView.sc,
      P = walkView.pl,
      t = reducedMotion ? 0 : walkView.t / 1000;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, det.t);
    gl.uniform1i(p.U.uDet, 0);
    gl.uniform1f(p.U.uBaseY, -99);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(structureState.mesh.vao);
    for (const q of structureState.parts) {
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
function drawStructureShadows(SH) {
  if (typeof buildingGuard !== 'function') return;
  buildingGuard(() => {
    if (!ensureStructures()) return;
    const gl = gpuState.gl;
    ensurePrograms(BUILDING_SHADERS);
    const p = gpuState.P.bshadow;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    const ca = worldCurveArgs(),
      sc = walkView.sc;
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    gl.bindVertexArray(structureState.mesh.vao);
    for (const q of structureState.parts) {
      if (!q.n) continue;
      const b = q.box;
      gl.uniform2f(p.U.uLift, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
      gl.drawElements(gl.TRIANGLES, q.n, gl.UNSIGNED_INT, q.i0 * 4);
    }
    gl.bindVertexArray(null);
  });
}
