'use strict';
/* ================= LIFE IN THE WALK SCENES (v17) =================
   Ducks paddling on ponds, pigeons pecking on the city squares (they fly off when you come close), chickens and sheep
   wandering their yards, cars driving round the city streets (they stop for you and for each other).
   A scene lists them in "life": [{k:'duck',n:4}, {k:'pigeon',n:6,area:[x0,z0,x1,z1]}, {k:'car',n:3,path:[[x,z],...]}].
   Frame strips come from art/scene/life/ (tools/build-scene-props.py); both renderers draw them like people.
   v27: rabbits and squirrels that bolt when you come close, frogs on the bank that leap into the water, seagulls
   that wheel overhead, mountain goats, cats sunning themselves in town, crabs scuttling sideways on the beach and
   lizards on warm rock. Flags on a kind: flee (how close you may come), hop (bounds along), fly (takes off like a
   pigeon, frames 2-3), shore (lives at the water's edge), side (walks sideways). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, sfxAt } from './hooks.js';
import { clamp } from './util.js';
import { cnv } from './art.js';
import { DIO, dioData, dioFree, dioHash, dioImg, dioOk, dioPoly, dioPolyAt, dioStepOK } from './diorama.js';
import { dglRing, dioGroundH, dioH, dioHRaw } from './diorama-gl.js';
/* eslint-disable no-func-assign */
expose({
  LIFE: [() => LIFE],
  LIFE_FRAMES: [() => LIFE_FRAMES],
  LIFE_KIND: [() => LIFE_KIND],
  dioHRawSafe: [() => dioHRawSafe, v => (dioHRawSafe = v)],
  lifeFrame: [() => lifeFrame, v => (lifeFrame = v)],
  lifeInit: [() => lifeInit, v => (lifeInit = v)],
  lifeKey: [() => lifeKey, v => (lifeKey = v)],
  lifeMeta: [() => lifeMeta, v => (lifeMeta = v)],
  lifePaths: [() => lifePaths, v => ((lifePaths = v), provide({ lifePaths }))],
  lifeRnd: [() => lifeRnd, v => (lifeRnd = v)],
  lifeShift: [() => lifeShift, v => (lifeShift = v)],
  lifeShore: [() => lifeShore, v => (lifeShore = v)],
  lifeSprites: [() => lifeSprites, v => ((lifeSprites = v), provide({ lifeSprites }))],
  lifeStep: [() => lifeStep, v => setLifeStep(v)],
  lifeTarget: [() => lifeTarget, v => (lifeTarget = v)],
});
/* eslint-enable no-func-assign */
provide({ lifePaths, lifeSprites, lifeStep });
export function setLifeStep(v) {
  lifeStep = v; // eslint-disable-line no-func-assign
  provide({ lifeStep });
}
/* to-module: end */
export const LIFE = { id: null, key: '', list: [], cut: new Map() };
provide({ LIFE }); /* to-module */
const LIFE_KIND = {
  duck: { s: 0.62, speed: 0.35, sh: 0.22 },
  pigeon: { s: 0.62, speed: 0.7, sh: 0.16 },
  chicken: { s: 0.75, speed: 0.8, sh: 0.2 },
  sheep: { s: 0.95, speed: 0.35, sh: 0.42 },
  car: { s: 1, speed: 3.6, sh: 1.1 },
  rabbit: { s: 0.62, speed: 1.3, sh: 0.2, flee: 2.6, hop: 1 },
  squirrel: { s: 0.55, speed: 1.9, sh: 0.15, flee: 2.2 },
  frog: { s: 0.5, speed: 1.2, sh: 0.1, flee: 1.5, hop: 1, shore: 1 },
  gull: { s: 0.8, speed: 0.8, sh: 0.2, flee: 2.4, fly: 1 },
  goat: { s: 1, speed: 0.45, sh: 0.45 },
  cat: { s: 0.7, speed: 0.55, sh: 0.25 },
  crab: { s: 0.55, speed: 0.8, sh: 0.12, flee: 1.4, side: 1 },
  lizard: { s: 0.6, speed: 2.2, sh: 0.08, flee: 1.8 },
  /* v47: crows in the scrap yard (they lift off like pigeons, a little sooner) */ crow: {
    s: 0.66,
    speed: 0.6,
    sh: 0.17,
    flee: 2.6,
  },
};
provide({ LIFE_KIND }); /* to-module */
const LIFE_FRAMES = k => {
  const m = lifeMeta(k);
  return m ? m.frames || 1 : 1;
};
function lifeMeta(k) {
  const C = dioData().sc;
  return (C.life || {})[k] || null;
}
function lifePaths(sc) {
  const out = [];
  for (const L of sc.life || []) {
    if (L.k === 'car')
      ['car_red', 'car_blue', 'car_yellow', 'car_mint'].forEach(k => {
        const m = lifeMeta(k);
        if (m) out.push(m.img);
      });
    else {
      const m = lifeMeta(L.k);
      if (m) out.push(m.img);
    }
  }
  return out;
}
/* one frame of a strip as its own canvas (cached) */
function lifeFrame(key, i) {
  const m = lifeMeta(key);
  if (!m) return null;
  const im = dioImg(m.img);
  if (!dioOk(im)) return null;
  const ck = key + '|' + i;
  let c = LIFE.cut.get(ck);
  if (c && c.__src === im) return c;
  c = cnv(m.w, m.h);
  c.getContext('2d').drawImage(im, i * m.w, 0, m.w, m.h, 0, 0, m.w, m.h);
  c.__src = im;
  c.__mat = 'plain';
  LIFE.cut.set(ck, c);
  return c;
}
function lifeRnd(a, b) {
  return dioHash(a * 131 + 7, b * 71 + 3);
}
function lifeKey(sc) {
  return JSON.stringify(sc.life || []) + '|' + (DIO.water || []).length;
}
function lifeInit() {
  const sc = DIO.sc;
  LIFE.id = DIO.id;
  LIFE.key = lifeKey(sc);
  LIFE.list = [];
  let n = 0;
  const water = DIO.water || [];
  for (const L of sc.life || []) {
    const K = LIFE_KIND[L.k];
    if (!K) continue;
    for (let i = 0; i < (L.n || 1); i++) {
      n++;
      const r = a => lifeRnd(n, a);
      let x, z;
      if (L.k === 'duck') {
        if (!water.length) break;
        const w = water[Math.floor(r(1) * water.length)];
        x = w[0] + r(2) - 0.5;
        z = w[1] + r(3) - 0.5;
      } else if (LIFE_KIND[L.k].shore) {
        if (!water.length) break;
        const p = lifeShore(r(1), r(2));
        if (!p) break;
        x = p[0];
        z = p[1];
      } else if (L.k === 'car') {
        if (!L.path || L.path.length < 2) break;
        const P = dioPoly(L.loop !== false ? [...L.path, L.path[0]] : L.path);
        const d = (P.L * i) / (L.n || 1);
        const q = dioPolyAt(P, d);
        x = q.x;
        z = q.z;
        LIFE.list.push({
          k: 'car',
          key: ['car_red', 'car_blue', 'car_yellow', 'car_mint'][(n + i) % 4],
          x,
          z,
          P,
          d,
          v: K.speed * (0.85 + r(4) * 0.3),
          dx: q.dx,
          dz: q.dz,
          t: 0,
        });
        continue;
      } else {
        const A = L.area || [1, 1, sc.w - 1, sc.h - 1];
        for (let k = 0; k < 30; k++) {
          x = A[0] + (A[2] - A[0]) * lifeRnd(n * 7 + k, 5);
          z = A[1] + (A[3] - A[1]) * lifeRnd(n * 11 + k, 9);
          if (dioFree(x, z)) break;
        }
      }
      LIFE.list.push({
        k: L.k,
        key: L.k,
        x,
        z,
        area: L.area,
        tx: x,
        tz: z,
        wait: r(6) * 3,
        st: 'idle',
        t: r(7) * 5,
        alt: 0,
        flip: r(8) < 0.5 ? 1 : -1,
        fr: 0,
      });
    }
  }
}
/* a dry spot right next to the water (frogs) */
function lifeShore(a, b) {
  const W = DIO.water || [];
  if (!W.length) return null;
  for (let k = 0; k < 40; k++) {
    const w = W[Math.floor(((a * 977.13 + k * 0.618034) % 1) * W.length)];
    if (!w) continue;
    for (const r of [0.9, 1.4, 2.1])
      for (let j = 0; j < 8; j++) {
        const an = (b + j / 8) * 6.283,
          x = w[0] + Math.cos(an) * r,
          z = w[1] + Math.sin(an) * r;
        if (dioFree(x, z)) return [x, z];
      }
  }
  return null;
}
function lifeTarget(c) {
  if (LIFE_KIND[c.k].shore && Math.random() < 0.7) {
    const p = lifeShore(Math.random(), Math.random());
    if (p && Math.hypot(p[0] - c.x, p[1] - c.z) < 5) {
      c.tx = p[0];
      c.tz = p[1];
      return;
    }
  }
  const sc = DIO.sc;
  if (c.k === 'duck') {
    const W = DIO.water;
    for (let k = 0; k < 12; k++) {
      const w = W[Math.floor(Math.random() * W.length)];
      if (Math.hypot(w[0] - c.x, w[1] - c.z) < 5) {
        c.tx = w[0] + Math.random() - 0.5;
        c.tz = w[1] + Math.random() - 0.5;
        return;
      }
    }
    return;
  }
  const A = c.area || [c.x - 3, c.z - 3, c.x + 3, c.z + 3];
  for (let k = 0; k < 12; k++) {
    const x = clamp(c.x + (Math.random() - 0.5) * 4, A[0], A[2]),
      z = clamp(c.z + (Math.random() - 0.5) * 3, A[1], A[3]);
    if (dioFree(x, z)) {
      c.tx = x;
      c.tz = z;
      return;
    }
  }
}
/* v43: a seamless shift between composites moves the animals along instead of starting them over */
export function lifeShift(dx, dz, id) {
  for (const a of LIFE.list) {
    a.x += dx;
    a.z += dz;
    if (a.tx != null) {
      a.tx += dx;
      a.tz += dz;
    }
    if (a.area) a.area = [a.area[0] + dx, a.area[1] + dz, a.area[2] + dx, a.area[3] + dz];
    if (a.P && a.P.p) a.P = dioPoly(a.P.p.map(([x, z]) => [x + dx, z + dz]));
  }
  LIFE.id = id;
  LIFE.key = DIO.sc ? lifeKey(DIO.sc) : LIFE.key;
}
export function lifeStep(dt) {
  const sc = DIO.sc;
  if (!sc) return;
  /* the water may only be known a few frames after the scene opens: ducks and frogs join then */ if (
    LIFE.id !== DIO.id ||
    LIFE.key !== lifeKey(sc)
  )
    lifeInit();
  if (!LIFE.list.length) return;
  const P = DIO.pl;
  for (const c of LIFE.list) {
    const K = LIFE_KIND[c.k];
    c.t += dt;
    if (c.k === 'car') {
      /* stop for you, and for the car in front */
      const q = dioPolyAt(c.P, c.d),
        hl = Math.hypot(q.dx, q.dz) || 1,
        hx = q.dx / hl,
        hz = q.dz / hl;
      let blocked = false;
      const ahead = (x, z, r) => {
        const vx = x - c.x,
          vz = z - c.z,
          f = vx * hx + vz * hz,
          s = Math.abs(-vx * hz + vz * hx);
        return f > 0 && f < r && s < 1.3;
      };
      if (ahead(P.x, P.z, 3.2)) blocked = true;
      for (const o of LIFE.list) if (o !== c && o.k === 'car' && ahead(o.x, o.z, 4.2)) blocked = true;
      c.v0 = c.v0 ?? c.v;
      c.cur = c.cur ?? c.v;
      c.cur += ((blocked ? 0 : c.v) - c.cur) * Math.min(1, dt * (blocked ? 6 : 1.5));
      c.d = (c.d + c.cur * dt) % c.P.L;
      const n = dioPolyAt(c.P, c.d);
      c.x = n.x;
      c.z = n.z;
      c.dx = n.dx;
      c.dz = n.dz;
      continue;
    }
    const dp = Math.hypot(P.x - c.x, P.z - c.z);
    if (c.hide > 0) {
      c.hide -= dt;
      if (c.hide <= 0) {
        const p = lifeShore(Math.random(), Math.random());
        if (p) {
          c.x = p[0];
          c.z = p[1];
        }
        c.st = 'idle';
        c.wait = 2;
      }
      continue;
    }
    if (K.fly && c.st === 'idle' && Math.random() < dt * 0.04) {
      c.wait = -1;
      c.st = 'fly';
      c.ft = 0;
      const a = Math.random() * 6.283;
      c.vx = Math.cos(a) * 2.2;
      c.vz = Math.sin(a) * 1.4;
      c.flip = c.vx > 0 ? -1 : 1;
    }
    /* v47: a duck paddles away from you, keeping to the water */
    if (c.k === 'duck' && dp < 1.7 && c.st !== 'run') {
      const W = DIO.water || [];
      let best = null,
        bs = -1;
      for (let k = 0; k < 24 && W.length; k++) {
        const w = W[Math.floor(Math.random() * W.length)],
          d = Math.hypot(w[0] - c.x, w[1] - c.z),
          away = Math.hypot(w[0] - P.x, w[1] - P.z);
        if (d < 4.5 && away > bs) {
          bs = away;
          best = w;
        }
      }
      if (best && bs > dp) {
        c.st = 'run';
        c.tx = best[0];
        c.tz = best[1];
        if (typeof sfxAt === 'function' && Math.random() < 0.5) sfxAt('call', c.x, c.z, { k: 'duck' });
      }
    }
    if ((c.k === 'pigeon' || c.k === 'crow' || K.fly) && c.st !== 'fly' && c.st !== 'land' && dp < (K.flee || 2.1)) {
      /* off they go */ const a = Math.atan2(c.z - P.z, c.x - P.x) + (Math.random() - 0.5);
      c.st = 'fly';
      c.ft = 0;
      c.vx = Math.cos(a) * 3.2;
      c.vz = Math.sin(a) * 2.2;
      c.flip = c.vx > 0 ? -1 : 1;
    }
    if (c.st === 'fly') {
      c.ft += dt;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.alt = Math.min(K.fly ? 4.5 : 3.2, c.alt + dt * 3);
      c.fr = (K.fly ? 2 : 3) + (Math.floor(c.t * (K.fly ? 5 : 10)) % 2);
      if (K.fly) {
        /* a gull wheels */ const a = Math.atan2(c.vz, c.vx) + dt * 0.9;
        const sp = Math.hypot(c.vx, c.vz);
        c.vx = Math.cos(a) * sp;
        c.vz = Math.sin(a) * sp;
        c.flip = c.vx > 0 ? -1 : 1;
      }
      if (c.ft > (K.fly ? 4 + Math.random() * 3 : 1.6)) {
        const A = c.area || [1, 1, sc.w - 1, sc.h - 1];
        c.tx = A[0] + (A[2] - A[0]) * Math.random();
        c.tz = A[1] + (A[3] - A[1]) * Math.random();
        c.st = 'land';
      }
      continue;
    }
    if (c.st === 'land') {
      const vx = c.tx - c.x,
        vz = c.tz - c.z,
        l = Math.hypot(vx, vz);
      c.fr = (K.fly ? 2 : 3) + (Math.floor(c.t * (K.fly ? 5 : 10)) % 2);
      if (l < 0.2 || !isFinite(l)) {
        c.st = 'idle';
        c.alt = 0;
        c.wait = 2 + Math.random() * 3;
      } else {
        const s = Math.min(l, 3 * dt);
        c.x += (vx / l) * s;
        c.z += (vz / l) * s;
        c.alt = Math.max(0, Math.min(c.alt, l * 0.8));
        c.flip = vx > 0 ? -1 : 1;
      }
      continue;
    }
    /* chickens hurry away from you */
    if (((c.k === 'chicken' && dp < 1.5) || (K.flee && !K.fly && dp < K.flee)) && c.st !== 'run') {
      c.st = 'run';
      const a = Math.atan2(c.z - P.z, c.x - P.x),
        far = K.flee ? 3.2 : 2;
      c.tx = c.x + Math.cos(a) * far;
      c.tz = c.z + Math.sin(a) * far;
      /* a frog leaps into the water instead */ if (K.shore) {
        const W = DIO.water || [];
        let best = null,
          bd = 4;
        for (const w of W) {
          const d = Math.hypot(w[0] - c.x, w[1] - c.z);
          if (d < bd) {
            bd = d;
            best = w;
          }
        }
        if (best) {
          c.tx = best[0];
          c.tz = best[1];
          c.dive = 1;
        }
      } else if (!dioFree(c.tx, c.tz)) {
        c.tx = c.x + Math.cos(a + 1.2) * far;
        c.tz = c.z + Math.sin(a + 1.2) * far;
        if (!dioFree(c.tx, c.tz)) {
          c.tx = c.x;
          c.tz = c.z;
        }
      }
      if (typeof sfxAt === 'function') sfxAt('scurry', c.x, c.z, { k: c.k });
    }
    if (c.st === 'idle') {
      c.wait -= dt;
      c.alt = K.fly ? c.alt : 0;
      c.fr =
        c.k === 'duck'
          ? Math.floor(c.t * 2.2) % 4
          : (c.k === 'pigeon' || c.k === 'crow' || c.k === 'chicken' || c.k === 'sheep') &&
              Math.sin(c.t * 1.7 + c.x) > 0.3
            ? 2
            : LIFE_FRAMES(c.k) > 3 && !K.fly && Math.sin(c.t * 1.3 + c.x) > 0.35
              ? 3
              : 0;
      if (typeof sfxAt === 'function' && Math.random() < dt * 0.018) sfxAt('call', c.x, c.z, { k: c.k });
      if (c.wait <= 0) {
        lifeTarget(c);
        c.st = 'walk';
      }
      continue;
    }
    const vx = c.tx - c.x,
      vz = c.tz - c.z,
      l = Math.hypot(vx, vz),
      sp = K.speed * (c.st === 'run' ? 2.6 : 1);
    if (l < 0.08) {
      c.st = 'idle';
      c.wait = 1 + Math.random() * (c.k === 'sheep' ? 6 : 3);
      continue;
    }
    const s = Math.min(l, sp * dt),
      nx = c.x + (vx / l) * s,
      nz = c.z + (vz / l) * s;
    if (
      c.k === 'duck' ||
      c.dive ||
      (typeof dioStepOK === 'function' ? dioStepOK(c.x, c.z, nx, nz, true) : dioFree(nx, nz))
    ) {
      c.x = nx;
      c.z = nz;
    } else {
      c.st = 'idle';
      c.wait = 0.5;
    }
    if (c.dive && l < 0.3) {
      /* plop */ c.dive = 0;
      c.hide = 4 + Math.random() * 5;
      c.st = 'idle';
      if (typeof dglRing === 'function') dglRing(c.x, c.z, 0.6);
      if (typeof sfxAt === 'function') sfxAt('plop', c.x, c.z);
      continue;
    }
    if (Math.abs(vx) > 0.02 && !K.side) c.flip = vx > 0 ? -1 : 1;
    if (K.hop) {
      const ph = (c.t * (c.st === 'run' ? 3.4 : 2.2)) % 1;
      c.alt = Math.sin(ph * Math.PI) * (c.k === 'frog' ? 0.22 : 0.16);
      c.fr = ph < 0.15 || ph > 0.85 ? 1 : 2;
    } else
      c.fr =
        c.k === 'duck'
          ? Math.floor(c.t * 3) % 4
          : LIFE_FRAMES(c.k) > 2 && !K.fly && c.k !== 'chicken' && c.k !== 'sheep' && c.k !== 'pigeon' && c.k !== 'crow'
            ? 1 + (Math.floor(c.t * (c.st === 'run' ? 10 : 5)) % 2)
            : Math.floor(c.t * (c.st === 'run' ? 10 : 5)) % 2;
  }
}
/* what to draw: {im,x,z,y,s,flip,sh} in metres */
function lifeSprites() {
  const out = [],
    PPU = dioData().sc.ppu || 34;
  for (const c of LIFE.list) {
    const K = LIFE_KIND[c.k];
    let i = c.fr || 0,
      flip = c.flip || 1;
    if (c.k === 'car') {
      if (Math.abs(c.dx) >= Math.abs(c.dz)) {
        i = 0;
        flip = c.dx > 0 ? -1 : 1;
      } else i = c.dz < 0 ? 1 : 2;
    }
    if (c.hide > 0) continue;
    i = i % LIFE_FRAMES(c.key);
    const im = lifeFrame(c.key, i);
    if (!im) continue;
    let y = dioH(c.x, c.z);
    if (c.k === 'duck') y = (typeof dioGroundH === 'function' ? dioGroundH(c.x, c.z) : dioHRawSafe(c.x, c.z)) - 0.1;
    out.push({ c, im, x: c.x, z: c.z, y: y + (c.alt || 0), mpp: K.s / PPU, flip, sh: c.alt > 0.3 ? 0 : K.sh });
  }
  return out;
}
function dioHRawSafe(x, z) {
  return typeof dioHRaw === 'function' ? dioHRaw(DIO.sc, x, z) : 0;
}
