'use strict';
/* ================= WALK FOUNTAINS AND WEATHER =================
   Phase 20 (stage B): fountain basins and their water, rain and snow, footprints and the animals' effects, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { LIFE_KIND, SOLID_PROP_PARTS, ambientLife, reducedMotion } from '../hooks.js';
import { isWalkable, terrainAt, walkView } from '../walk-view.js';
import { engineContext, engineSetting } from '../engine/settings.js';
import { freeMesh, gpuState, normalize3, uploadMesh, windGustAt } from '../engine/webgl.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { addRipple, waterAt } from './water.js';
/* eslint-disable no-func-assign */
expose({
  FOOTPRINT_COLORS: [() => FOOTPRINT_COLORS],
  addFootprint: [() => addFootprint, v => (addFootprint = v)],
  drawFootprints: [() => drawFootprints, v => (drawFootprints = v)],
  drawFountainEffects: [() => drawFountainEffects, v => (drawFountainEffects = v)],
  drawLifeEffects: [() => drawLifeEffects, v => (drawLifeEffects = v)],
  drawWeather: [() => drawWeather, v => (drawWeather = v)],
  gatherFountainBasins: [() => gatherFountainBasins, v => (gatherFountainBasins = v)],
  updateBasinMeshes: [() => updateBasinMeshes, v => (updateBasinMeshes = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* v31: water in fountains and wells. Each solid prop built from parts gets a disc of real water on every flat part (a
   basin), a jet from its top and a curtain spilling over each upper bowl into the one below, with splashes and rings */
export function gatherFountainBasins(items) {
  const L = [];
  if (typeof SOLID_PROP_PARTS === 'undefined' || (engineSetting('water', 'fountains') ?? true) === false) {
    updateBasinMeshes(L);
    return;
  }
  for (const it of items) {
    if (it.k !== 'prop' || !it.vol || it.far || it.layer || !it.p) continue;
    const parts = (it.M && it.M.parts) || SOLID_PROP_PARTS[it.p.k];
    if (!parts) continue;
    const fl = parts.filter(q => q.k === 'flat' && q.r);
    if (!fl.length) continue;
    const s = it.mpp,
      f = it.flip || 1,
      X = px => it.x + (it.ox + px) * s * f,
      Y = py => it.y - (it.oy + py) * s;
    const B = fl
      .map(q => {
        const hw = (q.r[2] - q.r[0]) / 2,
          dd = q.d != null ? q.d / 2 : hw;
        return {
          x: X((q.r[0] + q.r[2]) / 2),
          y: Y(q.y ?? q.r[3]) + 0.012,
          z: it.z,
          rx: hw * s * 0.88,
          rz: Math.min(hw, dd) * s * 0.88,
        };
      })
      .sort((a, b) => b.y - a.y);
    const tp = parts.reduce((a, q) => (q.r && (!a || q.r[1] < a.r[1]) ? q : a), null),
      well = /well/.test(it.p.k + ' ' + ((it.M && it.M.group) || ''));
    if (well)
      for (const q of B) {
        q.y -= 0.16;
        q.rx *= 0.96;
        q.rz *= 0.96;
      }
    L.push({
      p: it.p,
      B,
      well,
      spout: !well && B.length > 1 && tp ? [X((tp.r[0] + tp.r[2]) / 2), Y(tp.r[1] + 2), it.z] : null,
    });
  }
  updateBasinMeshes(L);
}
function updateBasinMeshes(L) {
  const key =
    walkView.id +
    '|' +
    L.map(b => b.B.map(q => [q.x, q.y, q.z, q.rx].map(v => v.toFixed(2)).join(',')).join(';')).join('/');
  walkRenderer.basinL = L;
  walkRenderer.basinP = new Set(L.map(b => b.p));
  if (walkRenderer.basinKey === key) return;
  walkRenderer.basinKey = key;
  freeMesh(walkRenderer.basin);
  walkRenderer.basin = null;
  if (!L.length) return;
  const V = [],
    I = [],
    N = 40,
    RS = [
      [0, 0, 0.95],
      [0.55, 0.04, 0.85],
      [0.8, 0.3, 0.65],
      [0.93, 0.62, 0.45],
      [1, 0.95, 0.3],
    ];
  for (const b of L)
    for (const q of b.B) {
      const b0 = V.length / 8;
      for (let r = 0; r < RS.length; r++) {
        const [fr, sh, dp] = RS[r];
        for (let k = 0; k < (r ? N : 1); k++) {
          const a = (k / N) * Math.PI * 2;
          V.push(
            q.x + Math.cos(a) * q.rx * fr,
            q.y,
            q.z + Math.sin(a) * q.rz * fr,
            b.well ? sh * 0.5 : sh,
            0,
            0,
            b.well ? 1 : dp,
            b.well ? 2 : 0
          );
        }
      }
      const ring = r => (r ? b0 + 1 + (r - 1) * N : b0);
      for (let k = 0; k < N; k++) {
        const k1 = (k + 1) % N;
        I.push(b0, ring(1) + k, ring(1) + k1);
        for (let r = 1; r < RS.length - 1; r++) {
          const a0 = ring(r) + k,
            a1 = ring(r) + k1,
            c0 = ring(r + 1) + k,
            c1 = ring(r + 1) + k1;
          I.push(a0, c0, a1, a1, c0, c1);
        }
      }
    }
  walkRenderer.basin = uploadMesh(
    new Float32Array(V),
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aShore', 1, 12],
      ['aUV', 2, 16],
      ['aDK', 2, 24],
    ],
    32
  );
}
export function drawFountainEffects(quad, t, rm, dt) {
  const L = walkRenderer.basinL;
  if (!L || !L.length) return;
  const T = t * rm,
    col = [0.93, 0.98, 1];
  for (const b of L) {
    const B = b.B;
    if (b.well) {
      if (rm && Math.random() < dt * 0.25) {
        const q = B[0],
          a = Math.random() * 6.3,
          r = Math.random() * 0.5;
        addRipple(q.x + Math.cos(a) * q.rx * r, q.z + Math.sin(a) * q.rz * r, 0.35);
      }
      continue;
    }
    if (!b.spout) continue;
    const [sx, sy, sz] = b.spout,
      u = B[0],
      lo = B[B.length - 1],
      sd = sx * 3.1 + sz * 1.7;
    /* the jet: a thin rising column, then arcs falling back into the top bowl */
    for (let n = 0; n < 6; n++) {
      const ph = (T / 700 + n / 6) % 1;
      quad(
        'spray',
        n % 4,
        sx + Math.sin(n * 2.1 + sd) * 0.02,
        sy + ph * 0.32,
        sz,
        0.1,
        0.13,
        0.9 * (1 - ph * 0.4),
        col
      );
    }
    for (let k = 0; k < 7; k++) {
      const an = (k / 7) * Math.PI * 2 + sd;
      for (let n = 0; n < 7; n++) {
        const ph = (T / 900 + n / 7 + k * 0.13) % 1,
          r = u.rx * 0.62 * ph,
          y = sy + 0.3 + 0.12 * 4 * ph * (1 - ph) - (sy + 0.3 - u.y) * ph * ph;
        quad(
          'spray',
          (n + k) % 4,
          sx + Math.cos(an) * r,
          y,
          sz + (Math.sin(an) * r * u.rz) / u.rx,
          0.09,
          0.09,
          0.9 * (1 - ph * 0.3),
          col
        );
      }
    }
    /* the curtain over each bowl's lip into the next one down, and its splashes */
    for (let i = 0; i < B.length - 1; i++) {
      const a = B[i],
        c = B[i + 1],
        H = a.y - c.y;
      for (let k = 0; k < 16; k++) {
        const an = (k / 16) * Math.PI * 2 + sd * 0.3;
        for (let n = 0; n < 5; n++) {
          const ph = (T / 650 + n / 5 + k * 0.29) % 1,
            r = 1.02 + 0.18 * ph;
          quad(
            'spray',
            (n + k) % 4,
            a.x + Math.cos(an) * a.rx * r,
            a.y - H * ph * ph,
            a.z + Math.sin(an) * a.rz * r,
            0.08,
            0.14,
            0.8,
            col
          );
        }
        const ph2 = (T / 420 + k * 0.37) % 1,
          lx = a.x + Math.cos(an) * a.rx * 1.2,
          lz = a.z + Math.sin(an) * a.rz * 1.2;
        quad(
          'spray',
          k % 4,
          lx,
          c.y + 0.02 + ph2 * 0.12,
          lz,
          0.14 + ph2 * 0.12,
          0.09 + ph2 * 0.07,
          (1 - ph2) * 0.7,
          col
        );
      }
      if (rm && Math.random() < dt * 2.2) {
        const an = Math.random() * 6.3;
        addRipple(a.x + Math.cos(an) * a.rx * 1.2, a.z + Math.sin(an) * a.rz * 1.2, 0.4);
      }
    }
    if (rm && Math.random() < dt * 1.2) {
      const an = Math.random() * 6.3;
      addRipple(u.x + Math.cos(an) * u.rx * 0.6, u.z + Math.sin(an) * u.rz * 0.6, 0.3);
    }
  }
}
/* smoke, spray, sparks, sparkles, butterflies, leaves, kicked-up grass; lamps, windows and fires as small bright cores
   (the bloom turns them into glows) */
/* v26: rain, snow and falling ash around you (environment.js says how much); drops splash on the ground and ring the water */
export function drawWeather(quad, glows, U, R, Up, dt, rm) {
  const gl = gpuState.gl,
    E = environment,
    BT = walkRenderer.bt,
    P = BT ? { x: BT.center[0], z: BT.center[1] } : walkView.pl,
    k = engineSetting('air', 'weather') * (walkView.R < 0.75 ? 0.5 : 1);
  /* alpha 0.4: while a front passes, the rain is as heavy as it will be (or was) but only on its side of the curtain */
  const Cu = E.curtain,
    inC = x => !Cu || (Cu.into ? Cu.dir * (x - P.x) < Cu.e * 11 : Cu.dir * (x - P.x) > Cu.e * 11);
  const rain = Math.min(1.6, Cu ? Cu.rain : E.rain) * k,
    snow = (Cu ? Cu.snow : E.snow) * k,
    ash = (Cu ? Cu.ash : E.ash) * k;
  if (rain + snow + ash < 0.03) {
    if (walkRenderer.wx) walkRenderer.wx.p.length = 0;
    return;
  }
  const W = walkRenderer.wx || (walkRenderer.wx = { p: [], sp: [] }),
    nR = Math.round(130 * rain),
    nS = Math.round(110 * snow),
    nA = Math.round(80 * ash),
    n = nR + nS + nA,
    wind = (walkView.sc.wind || 1) * (0.35 + E.storm * 0.9),
    sp = rm ? 1 : 0.2;
  const home = q => {
    for (let t = 0; t < 6; t++) {
      q.x = P.x + (Math.random() - 0.5) * 22;
      if (inC(q.x)) break;
    }
    q.z = P.z - 5 + Math.random() * 19;
    q.y = standingHeightAt(q.x, q.z) + 3 + Math.random() * 5;
  };
  while (W.p.length < n) {
    const q = { ph: Math.random() * 6.3 };
    home(q);
    q.y -= Math.random() * 4;
    W.p.push(q);
  }
  if (W.p.length > n) W.p.length = n;
  gl.uniform3f(U.uRight, R[0], R[1], R[2]);
  const lean = normalize3([wind * 0.22, 1, 0]);
  for (let i = 0; i < n; i++) {
    const q = W.p[i],
      kd = i < nR ? 0 : i < nR + nS ? 1 : 2;
    if (Math.abs(q.x - P.x) > 12 || q.z < P.z - 6.5 || q.z > P.z + 15) home(q);
    if (Cu && !inC(q.x)) {
      home(q);
      if (!inC(q.x)) continue;
    }
    const gy = standingHeightAt(q.x, q.z);
    if (kd === 0) {
      q.y -= 9 * dt * sp;
      q.x += wind * 1.8 * dt * sp;
      if (q.y < gy) {
        if (Math.random() < 0.35 && W.sp.length < 40) W.sp.push({ x: q.x, z: q.z, y: gy, a: 0 });
        home(q);
        continue;
      }
      gl.uniform3f(U.uUp, lean[0], lean[1], lean[2]);
      quad('spray', 0, q.x, q.y, q.z, 0.04, 0.5, 0.55, [0.8, 0.86, 1]);
    } else {
      const fall = kd === 1 ? 1.05 : 0.7;
      q.y -= fall * dt * sp;
      q.x += (Math.sin(walkView.t * 0.0011 + q.ph) * 0.45 + wind * 0.5) * dt * sp;
      q.z += Math.cos(walkView.t * 0.0009 + q.ph * 1.3) * 0.2 * dt * sp;
      if (q.y < gy) {
        home(q);
        continue;
      }
      gl.uniform3f(U.uUp, Up[0], Up[1], Up[2]);
      if (kd === 1) quad('spray', 1, q.x, q.y, q.z, 0.075, 0.075, 0.9, [0.98, 0.99, 1]);
      else if (i % 7 === 0) glows.push([q.x, q.y, q.z, 0.045, [1, 0.5, 0.18], 1.4]);
      else quad('spray', 1, q.x, q.y, q.z, 0.065, 0.065, 0.75, [0.3, 0.27, 0.26]);
    }
  }
  gl.uniform3f(U.uUp, Up[0], Up[1], Up[2]);
  for (let i = W.sp.length - 1; i >= 0; i--) {
    const s = W.sp[i];
    s.a += dt;
    if (s.a > 0.28) {
      W.sp.splice(i, 1);
      continue;
    }
    const f = s.a / 0.28;
    quad('spray', 2, s.x, s.y + 0.04 + f * 0.06, s.z, 0.1 + f * 0.14, 0.05 + f * 0.05, (1 - f) * 0.45, [0.85, 0.9, 1]);
  }
  if (rain > 0 && walkRenderer.wgrid && !reducedMotion && Math.random() < dt * rain * 18) {
    const x = P.x + (Math.random() - 0.5) * 16,
      z = P.z - 3 + Math.random() * 12,
      g = waterAt(x, z);
    if (g && g.dep > 0) addRipple(x, z, 0.3);
  }
}
/* v27: footprints in snow, sand, ash and mud (and anywhere after rain): yours and the animals', fading in half a minute */
const FOOTPRINT_COLORS = {
  n: [0.62, 0.68, 0.86],
  s: [0.58, 0.46, 0.3],
  z: [0.16, 0.14, 0.14],
  u: [0.3, 0.21, 0.14],
  o: [0.3, 0.2, 0.13],
  k: [0.3, 0.28, 0.36],
  /* v47: wet sand, mud, coral sand, ember ash, salt, cloud floor */ S: [0.45, 0.36, 0.22],
  D: [0.24, 0.16, 0.1],
  N: [0.74, 0.6, 0.52],
  Z: [0.15, 0.12, 0.12],
  4: [0.78, 0.76, 0.72],
  U: [0.68, 0.74, 0.88],
};
function addFootprint(x, z, a, paw) {
  const sc = walkView.sc;
  if (!sc || (sc.indoor && sc.far !== 'cave')) return;
  let ch = terrainAt(x, z),
    col = FOOTPRINT_COLORS[ch];
  const E = typeof environment !== 'undefined' && environment.on ? environment : null;
  if (!col && E && !sc.indoor && E.sk && E.sk[3] > 0.3 && !/[wdbe]/.test(ch)) col = FOOTPRINT_COLORS.n;
  if (!col && E && !sc.indoor && E.wet > 0.5 && !/[wdb]/.test(ch)) col = [0.34, 0.36, 0.42];
  if (!col) return;
  const P = walkRenderer.prints || (walkRenderer.prints = []);
  P.push({ x, z, y: standingHeightAt(x, z), a, paw, age: 0, col });
  if (P.length > 140) P.splice(0, P.length - 140);
}
export function drawFootprints(quad, U, R, Up, dt) {
  const pl = walkView.pl,
    gl = gpuState.gl;
  if (walkRenderer.printId !== walkView.id) {
    walkRenderer.printId = walkView.id;
    walkRenderer.prints = [];
    walkRenderer.lastPrint = null;
  }
  if (pl.walk && !pl.yv) {
    const L = walkRenderer.lastPrint;
    if (!L || Math.hypot(pl.x - L[0], pl.z - L[1]) > 0.36) {
      const a = L ? Math.atan2(pl.z - L[1], pl.x - L[0]) : 0,
        side = (walkRenderer.printSide = -(walkRenderer.printSide || 1));
      addFootprint(pl.x - Math.sin(a) * 0.08 * side, pl.z + Math.cos(a) * 0.08 * side, a, 0);
      walkRenderer.lastPrint = [pl.x, pl.z];
    }
  }
  if (typeof ambientLife !== 'undefined')
    for (const c of ambientLife.list) {
      const K = LIFE_KIND[c.k];
      if (!K || K.fly || c.k === 'car' || c.k === 'duck' || c.hide > 0 || c.st === 'idle') continue;
      if (!c._lp || Math.hypot(c.x - c._lp[0], c.z - c._lp[1]) > 0.3) {
        addFootprint(c.x, c.z, Math.atan2(c.tz - c.z, c.tx - c.x), 1);
        c._lp = [c.x, c.z];
      }
    }
  const P = walkRenderer.prints;
  if (!P || !P.length) return;
  for (let i = P.length - 1; i >= 0; i--) {
    if ((P[i].age += dt) > 30) P.splice(i, 1);
  }
  for (const q of P) {
    const ca = Math.cos(q.a),
      sa = Math.sin(q.a);
    gl.uniform3f(U.uRight, sa, 0, -ca);
    gl.uniform3f(U.uUp, ca, 0, sa);
    const f = Math.min(1, (30 - q.age) / 8);
    quad('print', q.paw, q.x, q.y + 0.015, q.z, q.paw ? 0.12 : 0.15, q.paw ? 0.14 : 0.22, 0.7 * f, q.col);
  }
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
}
/* v47: a living world, in the effects pass. Bees round the hives by day; fireflies over the grass on warm nights
   (glowing moths in the Spore Forest); in autumn, leaves skittering along the streets in the wind. Each is a handful
   of sprites near you, so they cost next to nothing. */
export function drawLifeEffects(quad, glows, t, rm, dt, sc, C0) {
  const L = walkView.life;
  if (!L) return;
  const P = walkView.pl,
    E = typeof environment !== 'undefined' && engineContext.env ? environment : null,
    night = E ? E.night : 0,
    ss = E ? E.season : 'summer';
  if (!L.hv) {
    L.hv = [];
    L.gr = [];
    for (const p of sc.props || []) {
      const M = C0.props[p.k];
      if (!M) continue;
      const g = M.group || p.k;
      if (/beehive/.test(g)) L.hv.push(p);
      else if (/tallgrass|bush|fern|flower|reeds|cattail|mushroom/.test(g)) L.gr.push(p);
    }
    L.gr = L.gr.filter((_, i) => i % 3 === 0);
  }
  /* bees */ if (night < 0.5 && !(E && E.rain > 0.3))
    L.hv.forEach((p, h) => {
      if (Math.hypot(p.x - P.x, p.z - P.z) > 18) return;
      for (let n = 0; n < 5; n++) {
        const a = (t * rm) / (380 + n * 55) + n * 1.3 + h,
          r = 0.45 + 0.35 * Math.sin((t * rm) / 900 + n * 2),
          x = p.x + Math.cos(a) * r,
          z = p.z - 0.2 + Math.sin(a * 1.3) * r * 0.6;
        quad(
          'bee',
          Math.floor((t * rm) / 60 + n) % 2,
          x,
          standingHeightAt(x, z) + 0.5 + 0.3 * Math.sin(a * 2.1 + n),
          z,
          0.15,
          0.12,
          1
        );
      }
    });
  /* fireflies (warm nights) or glowing moths (a mushroom wood) near you */ const moth = /spore|mushroom/.test(
    String(sc.biome || sc.far || '')
  );
  if (night > 0.45 && (moth || ss === 'summer' || ss === 'spring') && !(E && E.rain > 0.3) && L.gr.length) {
    const near = L.gr.filter(p => Math.abs(p.x - P.x) < 14 && Math.abs(p.z - P.z) < 12).slice(0, 14),
      k = Math.min(1, (night - 0.45) * 3);
    near.forEach((p, i) => {
      const sd = p.x * 3.1 + p.z * 1.7,
        x = p.x + Math.sin((t * rm) / 2300 + sd) * 1.2,
        z = p.z - 0.3 + Math.cos((t * rm) / 2900 + sd * 1.3) * 0.8,
        y = standingHeightAt(x, z) + 0.5 + 0.4 * Math.sin((t * rm) / 1700 + sd),
        bl = Math.max(0, Math.sin((t * rm) / (moth ? 900 : 600) + sd * 5));
      if (moth) {
        quad('moth', Math.floor((t * rm) / 90 + i) % 2, x, y + 0.2, z, 0.22, 0.16, 0.9 * k);
        glows.push([x, y + 0.2, z, 0.16, [0.55, 0.85, 1], 1.2 * k]);
      } else if (bl > 0.25) {
        glows.push([x, y, z, 0.11, [0.85, 1, 0.35], 2.2 * bl * k]);
        glows.push([x, y, z, 0.035, [1, 1, 0.7], 4 * bl * k]);
      }
    });
  }
  /* autumn leaves along the ground, blown across the paving near you */ if (ss === 'autumn' && rm && L.tr.length) {
    const W = (sc.wind || 1) * (0.7 + windGustAt(P.x, P.z, t * rm)),
      sk = L.sk || (L.sk = []);
    if (sk.length < 7 && Math.random() < dt * 1.6) {
      const a = Math.random() * 6.283,
        r = 3 + Math.random() * 7,
        x = P.x + Math.cos(a) * r,
        z = P.z + Math.sin(a) * r * 0.7;
      if (isWalkable(x, z))
        sk.push({
          x,
          z,
          life: 0,
          max: 2.5 + Math.random() * 2.5,
          vx: (0.6 + Math.random() * 0.6) * W,
          vz: (Math.random() - 0.5) * 0.25,
          fr: Math.floor(Math.random() * 3),
        });
    }
    for (let i = sk.length - 1; i >= 0; i--) {
      const q = sk[i];
      q.life += dt;
      if (q.life > q.max) {
        sk.splice(i, 1);
        continue;
      }
      const gust = 0.6 + 0.6 * Math.max(0, Math.sin(t / 700 + i * 2));
      q.x += q.vx * gust * dt;
      q.z += q.vz * dt;
      const hop = Math.max(0, Math.sin(q.life * 7 + i)) * 0.06 * gust,
        a = Math.min(1, q.life * 3, (q.max - q.life) * 2);
      quad(
        'leaf',
        (q.fr + Math.floor(q.life * 6)) % 3,
        q.x,
        standingHeightAt(q.x, q.z) + 0.04 + hop,
        q.z,
        0.15,
        0.15,
        a
      );
    }
  }
  /* v47: dust kicked up from dry ground as you walk (earth, paths, dirt, sand, gravel, scrap, ash), not when it is wet or snowy */
  {
    const ch = typeof terrainAt === 'function' ? terrainAt(P.x, P.z) : 'g',
      du = L.du || (L.du = []);
    if (P.walk && rm && /[ApusNvxzZ4]/.test(ch) && !(E && (E.wet > 0.35 || (E.sk && E.sk[3] > 0.3)))) {
      L.duT = (L.duT || 0) - dt;
      if (L.duT <= 0 && du.length < 10) {
        L.duT = 0.16 + Math.random() * 0.1;
        du.push({
          x: P.x + (Math.random() - 0.5) * 0.3,
          z: P.z - 0.05,
          a: 0,
          m: 0.55 + Math.random() * 0.3,
          c: /[zZ]/.test(ch) ? [0.62, 0.6, 0.62] : ch === 'x' ? [0.7, 0.62, 0.52] : [0.88, 0.8, 0.64],
        });
      }
    }
    for (let i = du.length - 1; i >= 0; i--) {
      const q = du[i];
      q.a += dt;
      if (q.a > q.m) {
        du.splice(i, 1);
        continue;
      }
      const f = q.a / q.m;
      quad(
        'smoke',
        Math.min(3, Math.floor(f * 4)),
        q.x,
        standingHeightAt(q.x, q.z) + 0.06 + f * 0.22,
        q.z,
        0.2 + f * 0.32,
        0.2 + f * 0.32,
        0.4 * (1 - f),
        q.c
      );
    }
  }
}
