'use strict';
/* ================= v33: BILLIONAIRES OUT IN THE WORLD =================
   Three kinds, all drawn from the same rigs as in battle (front view, or the back when walking away), as lit sprites:
   - the wild ones hiding in the tall grass: each keeps one spot (v46), mostly sunk in the grass with only its top
     showing, turns to face you and now and then hops up for a look round. An Alpha is bigger, glows and is marked in red;
   - your buddy (Make buddy on a billionaire's sheet; your lead if you haven't picked one) follows your path, hops along when you walk,
     potters about when you stop, and reacts when you tap it;
   - world trainers' companions: some trainers have their lead billionaire standing beside them.
   Frames are drawn once into small canvases and kept (an idle loop of 8, a reaction of 9), so nothing is redrawn per
   frame. A species' rig art is loaded the first time it's needed; until then it simply isn't shown. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { areaKey, provide, sceneIdAt, sfx } from './hooks.js';
import { clamp } from './util.js';
import { SP, STATUSN, TRAINERS, rivalSp, trainersAt } from './game-data.js';
import { N, S, U, findMon, maxHp, nextStop, save } from './game-state.js';
import { cnv } from './art.js';
import { KBACK, drawRig, rigFrame, rigParts, rigPreload } from './skeleton-rig.js';
import { battleStagePrepare } from './battle-stage.js';
import { prepareMap, walkView, walkablePointNear, worldToScreen } from './walk-view.js';
import { environment } from './environment.js';
import { standingHeightAt } from './walk-view-gl.js';
/* eslint-disable no-func-assign */
expose({
  BILLY_FRAME_CACHE_MAX: [() => BILLY_FRAME_CACHE_MAX],
  buddyBilly: [() => buddyBilly, v => (buddyBilly = v)],
  buddyItems: [() => buddyItems, v => ((buddyItems = v), provide({ buddyItems }))],
  buddyTap: [() => buddyTap, v => ((buddyTap = v), provide({ buddyTap }))],
  companionItems: [() => companionItems, v => ((companionItems = v), provide({ companionItems }))],
  companionSpecies: [() => companionSpecies, v => (companionSpecies = v)],
  mapsPreparedAhead: [() => mapsPreparedAhead],
  shiftWorldBillies: [() => shiftWorldBillies, v => (shiftWorldBillies = v)],
  warmWorldBillies: [() => warmWorldBillies, v => ((warmWorldBillies = v), provide({ warmWorldBillies }))],
  wildBillyItem: [() => wildBillyItem, v => ((wildBillyItem = v), provide({ wildBillyItem }))],
  worldBillies: [() => worldBillies],
  worldBillyFrame: [() => worldBillyFrame, v => (worldBillyFrame = v)],
  worldBillyGlows: [() => worldBillyGlows, v => ((worldBillyGlows = v), provide({ worldBillyGlows }))],
  worldBillyItem: [() => worldBillyItem, v => ((worldBillyItem = v), provide({ worldBillyItem }))],
  worldBillyLabels: [() => worldBillyLabels, v => ((worldBillyLabels = v), provide({ worldBillyLabels }))],
  worldBillyMetersPerPixel: [() => worldBillyMetersPerPixel, v => (worldBillyMetersPerPixel = v)],
  worldBillyRig: [() => worldBillyRig, v => (worldBillyRig = v)],
});
/* eslint-enable no-func-assign */
provide({
  buddyItems,
  buddyTap,
  companionItems,
  warmWorldBillies,
  wildBillyItem,
  worldBillyGlows,
  worldBillyItem,
  worldBillyLabels,
});
/* to-module: end */
export const worldBillies = {
  cache: new Map(),
  req: new Set(),
  trail: [],
  bud: null,
  react: null,
  say: '',
  sayT: 0,
  lastTap: 0,
  mons: {},
  fx: [],
};
provide({ worldBillies }); /* to-module */
const BILLY_FRAME_CACHE_MAX = 320;
function worldBillyRig(sp, gold, view) {
  if (!SP[sp] || typeof rigParts !== 'function') return null;
  const k = view === 'back' ? KBACK : 1;
  let R = null;
  try {
    R = rigParts(sp, !!gold, k);
  } catch (e) {
    R = null;
  }
  if (R) return R;
  const key = sp + (gold ? 'g' : '') + view;
  if (!worldBillies.req.has(key) && typeof rigPreload === 'function') {
    worldBillies.req.add(key);
    rigPreload([[sp, !!gold, k]]).catch(() => {});
  }
  return null;
}
/* a frame: pose null = idle loop (8 frames over 1.6 s); a named pose plays once over ~0.9 s */
function worldBillyFrame(sp, gold, view, pose, t, seed) {
  const R = worldBillyRig(sp, gold, view);
  if (!R) return null;
  const wk = pose === 'walk',
    n = wk ? 8 : pose ? 9 : 8,
    dur = wk ? 560 : pose ? 900 : 1600,
    fi = pose && !wk ? clamp(Math.floor(t / 100), 0, n - 1) : Math.floor(((((t % dur) + dur) % dur) / dur) * n);
  const key = sp + '|' + (gold ? 1 : 0) + '|' + view + '|' + (pose || '') + '|' + fi + '|' + ((seed % 4) | 0);
  let c = worldBillies.cache.get(key);
  if (c) {
    worldBillies.cache.delete(key);
    worldBillies.cache.set(key, c);
    return c;
  }
  const tD = performance.now();
  c = cnv(R.BW, R.BH);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  try {
    drawRig(x, R, rigFrame(R, pose || null, wk ? fi * (dur / n) : pose ? fi * 100 : 0, fi * (dur / n), seed % 4), view);
  } catch (e) {
    return null;
  }
  c.noNormal = true;
  c.__R = R;
  worldBillies.cache.set(key, c);
  if (typeof NWLOG !== 'undefined') NWLOG.mark('drawing billionaires in the world', tD, performance.now());
  if (worldBillies.cache.size > BILLY_FRAME_CACHE_MAX) {
    const k0 = worldBillies.cache.keys().next().value;
    worldBillies.cache.delete(k0);
  }
  return c;
}
/* metres per rig pixel: a billionaire stands about 0.9 of its listed height, between 0.6 and 2 m */
/* v34: and sized so its pixels sit on the art grid: one art pixel (1/68 m) holds a whole number of quarter rig pixels
   (2, 2.25, 2.5 ...), never off by more than 6% of the height it would otherwise have, so its pixels line up with the
   props' instead of beating against them */
function worldBillyMetersPerPixel(sp, R, big = 1) {
  const h = clamp((SP[sp].ht || 1) * 0.9, 0.6, 2) * big,
    px = Math.max(20, R.geo.base - R.geo.top || R.BH * 0.7),
    m = h / px;
  const r = 1 / (m * 68),
    rq = r >= 1 ? Math.round(r * 4) / 4 : 1 / (Math.round(4 / r) / 4),
    mq = 1 / (rq * 68);
  return Math.abs(mq / m - 1) <= 0.06 ? mq : m;
}
export function worldBillyItem(k, sp, gold, view, pose, t, seed, x, z, o = {}) {
  const im = worldBillyFrame(sp, gold, view, pose, t, seed);
  if (!im) return null;
  const R = im.__R,
    mpp = worldBillyMetersPerPixel(sp, R, o.big || 1),
    gy = standingHeightAt(x, z);
  return Object.assign(
    {
      k,
      im,
      x,
      z,
      y: gy + (o.dy || 0),
      mpp,
      ox: -R.geo.cx,
      oy: -R.geo.base,
      w: R.BW,
      h: R.BH,
      flip: o.flip || 1,
      shear: 0,
      sh: Math.max(0.2, R.geo.hw * mpp * 0.8),
      aoR: Math.max(0.2, R.geo.hw * mpp * 0.7),
      person: 1,
      fade: o.fade ?? 1,
    },
    o.extra || {}
  );
}
/* ---------- the buddy ---------- */
/* your buddy (the one you made buddy on its sheet; it earns XP as you walk), or your lead if you haven't picked one */
export function buddyBilly() {
  if ((S.preferences || {}).buddyWalk === 'off' || !S.team) return null;
  let m = S.buddy && typeof findMon === 'function' ? findMon(S.buddy) : null;
  if (!m) m = S.team[0] || null;
  return m && m.job == null ? m : null;
}
export function shiftWorldBillies(dx, dz) {
  const b = worldBillies.bud;
  if (b) {
    b.x += dx;
    b.z += dz;
    if (b.tx != null) {
      b.tx += dx;
      b.tz += dz;
    }
    b.sc = walkView.id;
  }
  worldBillies.trail = (worldBillies.trail || []).map(q =>
    Array.isArray(q) ? [q[0] + dx, q[1] + dz, ...q.slice(2)] : q
  );
}
function buddyItems(out, t, dt) {
  const P = walkView.pl,
    m = buddyBilly();
  if (!m || U.inside || U.bench || (walkView.st && walkView.st.battle) || !walkView.sc) {
    worldBillies.bud = null;
    return;
  }
  let b = worldBillies.bud;
  if (!b || b.uid !== m.uid || b.sc !== walkView.id) {
    worldBillies.sayT = 0;
    b = worldBillies.bud = {
      uid: m.uid,
      sc: walkView.id,
      x: P.x - 0.9,
      z: P.z - 0.4,
      vx: 0,
      vz: 0,
      flip: 1,
      back: false,
      hop: 0,
      wait: 1,
      tx: null,
      tz: null,
      seed: Math.abs(m.uid.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 997,
    };
    worldBillies.trail = [];
  }
  /* the trail: where you've been, every 0.15 m. The buddy walks it about 1.2 m behind you */
  const T = worldBillies.trail,
    last = T[T.length - 1];
  if (!last || Math.hypot(P.x - last[0], P.z - last[1]) > 0.15) {
    T.push([P.x, P.z]);
    if (T.length > 60) T.shift();
  }
  let gx = b.x,
    gz = b.z,
    acc = 0;
  for (let i = T.length - 1; i > 0; i--) {
    acc += Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]);
    if (acc > 1.2) {
      gx = T[i - 1][0];
      gz = T[i - 1][1];
      break;
    }
  }
  const moving = !!P.route || P.walk > 0;
  if (!moving) {
    /* pottering about while you stand: a short wander now and then, never far */
    b.wait -= dt;
    if (b.wait <= 0 && b.tx == null) {
      const a = Math.random() * 6.283,
        r = 0.6 + Math.random() * 0.7,
        c =
          typeof walkablePointNear === 'function'
            ? walkablePointNear(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r * 0.7)
            : [P.x + Math.cos(a) * r, P.z + Math.sin(a) * r * 0.7];
      b.tx = c[0];
      b.tz = c[1];
      b.wait = 2 + Math.random() * 4;
    }
    if (b.tx != null) {
      gx = b.tx;
      gz = b.tz;
      if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.08) b.tx = null;
    } else {
      gx = b.x;
      gz = b.z;
    }
  } else b.tx = null;
  const dx = gx - b.x,
    dz = gz - b.z,
    d = Math.hypot(dx, dz),
    sp = moving ? Math.max(1.6, d * 2.2) : 0.9;
  if (d > 0.03) {
    const s = Math.min(d, sp * dt);
    b.x += (dx / d) * s;
    b.z += (dz / d) * s;
    if (Math.abs(dx) > 0.02) b.flip = dx > 0 ? -1 : 1;
    b.back = dz > 0.12 && Math.abs(dz) > Math.abs(dx);
    b.hop += dt * 9;
  } else {
    b.back = false;
    const fx = P.x - b.x;
    if (Math.abs(fx) > 0.2) b.flip = fx > 0 ? -1 : 1;
  }
  if (d > 6) {
    b.x = gx;
    b.z = gz;
  } /* left behind (a ladder, a door): catch up at once */
  /* v34: your buddy notices the weather and the hour while you stand: it shakes off the rain, hunkers down at night,
    cheers at the water's edge, now and then */
  if (!moving && !worldBillies.react && typeof environment !== 'undefined' && Math.random() < dt * 0.12) {
    const nearW = (walkView.water || []).some(w => Math.hypot(w[0] - b.x, w[1] - b.z) < 2.2);
    const pz = environment.rain > 0.3 ? 'dizzy' : environment.night > 0.6 ? 'block' : nearW ? 'cheer' : null;
    if (pz) worldBillies.react = { pose: pz, t0: t };
  }
  const R = worldBillies.react,
    rt = R ? t - R.t0 : 0;
  if (R && rt > 900) worldBillies.react = null;
  const pose = worldBillies.react ? worldBillies.react.pose : null;
  const walk = d > 0.03 && !pose,
    dy = 0,
    it = worldBillyItem(
      'buddy',
      m.sp,
      m.gold,
      b.back && !pose ? 'back' : 'front',
      pose || (walk ? 'walk' : null),
      pose ? rt : t + b.seed * 37,
      b.seed,
      b.x,
      b.z,
      { flip: b.flip, dy, big: m.alpha ? 1.12 : 1, extra: { mon: m } }
    );
  if (it) out.push(it);
  if (worldBillies.sayT > 0) worldBillies.sayT = Math.max(0, worldBillies.sayT - dt);
}
/* tapping your buddy: it reacts, and says how it's doing */
export function buddyTap() {
  const m = buddyBilly();
  if (!m) return;
  const now = performance.now();
  if (now - worldBillies.lastTap < 450) return;
  worldBillies.lastTap = now;
  const hp = m.hp / maxHp(m),
    t = walkView.t,
    bond = (m.bond = (m.bond || 0) + 1),
    n = N(m),
    q = (S.queue || []).length;
  const lines =
    hp <= 0
      ? [`${n} has fainted. It needs a rest at a clinic.`]
      : hp < 0.3
        ? [
            `${n} is worn out (HP ${Math.round(hp * 100)}%). A clinic would help.`,
            `${n} leans on you. It’s had a rough day.`,
          ]
        : m.status
          ? [`${n} doesn’t feel great: ${(STATUSN[m.status] || 'unwell').toLowerCase()}.`]
          : [
              `${n} beams at you.`,
              `${n} does a little victory lap.`,
              `${n} checks its portfolio, then looks at you fondly.`,
              q
                ? `${n} sniffs the air. Something’s rustling in the grass.`
                : `${n} hums a jingle about compound interest.`,
              `${n} is itching for a battle.`,
              bond > 20 ? `${n} trusts you completely.` : `${n} seems to like you more each day.`,
            ];
  worldBillies.say = lines[bond % lines.length];
  worldBillies.sayT = 2.6;
  worldBillies.react = { pose: hp < 0.3 || m.status ? 'dizzy' : Math.random() < 0.5 ? 'cheer' : 'smug', t0: t };
  const b = worldBillies.bud;
  if (b)
    for (let i = 0; i < 10; i++)
      worldBillies.fx.push({
        x: b.x + (Math.random() - 0.5) * 0.4,
        z: b.z + (Math.random() - 0.5) * 0.3,
        y: 0.5 + Math.random() * 0.4,
        vy: 0.6 + Math.random() * 0.6,
        age: 0,
        max: 1.1 + Math.random() * 0.5,
        c: i % 3 ? [1, 0.45, 0.62] : [1, 0.86, 0.5],
      });
  if (typeof sfx === 'function') sfx('cry', { sp: m.sp });
  save();
}
/* ---------- world trainers' companions ---------- */
export function companionSpecies(T) {
  const pet = T && (T.pet === 'true' ? true : T.pet === 'false' ? false : T.pet);
  if (!T || !T.team || !T.team.length || pet === false) return null;
  const h =
    String(T.id || T.name)
      .split('')
      .reduce((a, c) => a * 31 + c.charCodeAt(0), 3) >>> 0;
  if (pet !== true && h % 3 === 0) return null;
  const e = T.team[pet && typeof pet === 'number' ? Math.min(T.team.length - 1, pet) : 0];
  let sp = e.sp;
  if (/^@rival\d?$/.test(sp) && typeof rivalSp === 'function') sp = rivalSp(sp);
  return SP[sp] ? sp : null;
}
function companionItems(out, t, npcPos) {
  const P = walkView.pl;
  for (const [n, pos] of npcPos) {
    const T = TRAINERS[n.id],
      sp = companionSpecies(T);
    if (!sp) continue;
    const side = String(n.id).length % 2 ? 1 : -1,
      x = pos[0] + side * 0.85,
      z = pos[1] + 0.15,
      fl = P.x > x ? -1 : 1,
      seed = String(n.id).length * 7;
    const it = worldBillyItem('pet', sp, false, 'front', null, t + seed * 91, seed, x, z, { flip: fl, extra: { n } });
    if (it) out.push(it);
  }
}
/* ---------- the wild ones in the grass ---------- */
/* called per encounter from gatherFrameItems with its spot s (x, z): adds the billionaire, mostly sunk in the grass */
function wildBillyItem(out, e, s, t, dt) {
  if (!e.sp) return;
  const big = e.alpha ? 1.6 : 1;
  let w = worldBillies.mons[e.id];
  if (!w)
    w = worldBillies.mons[e.id] = {
      pop: 2 + Math.random() * 5,
      popT: 0,
      flip: 1,
      seed: e.id.length * 13 + (e.lvl || 1),
    };
  /* v46: it stays on its spot and turns to face you; it peeks up sooner when you come within 3 m */
  const P = typeof walkView !== 'undefined' ? walkView.pl : null,
    dx = P ? P.x - s.x : 0,
    near = P ? Math.hypot(dx, P.z - s.z) : 99;
  if (Math.abs(dx) > 0.3) w.flip = dx > 0 ? -1 : 1;
  if (near < 3 && !w.near) {
    w.near = 1;
    w.pop = Math.min(w.pop, 0.4);
  } else if (near > 4) w.near = 0;
  w.pop -= dt;
  if (w.pop <= 0) {
    w.popT = 0.9;
    w.pop = 4 + Math.random() * 6;
  }
  if (w.popT > 0) w.popT = Math.max(0, w.popT - dt);
  /* how much of it is hidden: a hop shows it whole for a moment */
  const im = worldBillyFrame(
    e.sp,
    e.gold,
    'front',
    w.popT > 0 ? 'cheer' : null,
    w.popT > 0 ? (0.9 - w.popT) * 1000 : t + w.seed * 53,
    w.seed
  );
  if (!im) return;
  const R = im.__R,
    mpp = worldBillyMetersPerPixel(e.sp, R, big),
    H = (R.geo.base - R.geo.top) * mpp;
  const hop = w.popT > 0 ? Math.sin(((0.9 - w.popT) / 0.9) * Math.PI) : 0,
    sink = (e.alpha ? 0.1 : 0.22) * (1 - hop) + 0.03,
    moving = Math.hypot((s.tx ?? s.x) - s.x, (s.tz ?? s.z) - s.z) > 0.05,
    bob = moving ? Math.abs(Math.sin(t / 120)) * 0.05 : Math.sin(t / 500 + w.seed) * 0.015;
  const it = worldBillyItem(
    'encm',
    e.sp,
    e.gold,
    'front',
    w.popT > 0 ? 'cheer' : moving ? 'walk' : null,
    w.popT > 0 ? (0.9 - w.popT) * 1000 : t + w.seed * 53,
    w.seed,
    s.x,
    s.z + 0.05,
    { flip: w.flip, big, dy: -H * sink + hop * 0.32 + bob, extra: { e } }
  );
  /* v34: a Golden one gives itself away: gold glints rise out of the grass where it moves */
  if (e.gold && Math.random() < dt * 5)
    worldBillies.fx.push({
      x: s.x + (Math.random() - 0.5) * 0.5,
      z: s.z + (Math.random() - 0.5) * 0.3,
      y: 0.15 + Math.random() * 0.3,
      vy: 0.35 + Math.random() * 0.4,
      age: 0,
      max: 1 + Math.random() * 0.6,
      c: [1, 0.85, 0.35],
    });
  if (it) {
    it.sh = hop > 0.3 ? it.sh * 0.6 : 0;
    out.push(it);
    if (e.alpha && Math.random() < dt * 7)
      worldBillies.fx.push({
        x: s.x + (Math.random() - 0.5) * H * 0.6,
        z: s.z + (Math.random() - 0.5) * 0.3,
        y: 0.2,
        vy: 0.5 + Math.random() * 0.5,
        age: 0,
        max: 1.2,
        c: Math.random() < 0.5 ? [1, 0.3, 0.45] : [0.7, 0.25, 1],
      });
  }
}
/* glows: buddy hearts and Alpha embers (drawn with the world's glow sprites) */
function worldBillyGlows(glows, dt) {
  const L = worldBillies.fx;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    q.age += dt;
    if (q.age >= q.max) {
      L.splice(i, 1);
      continue;
    }
    q.y += q.vy * dt;
    const a = Math.sin((q.age / q.max) * Math.PI);
    glows.push([q.x, standingHeightAt(q.x, q.z) + q.y, q.z, 0.05, q.c, 1.4 * a]);
  }
}
/* labels: what your buddy just said */
function worldBillyLabels(C, labels) {
  const b = worldBillies.bud;
  if (!b || worldBillies.sayT <= 0 || !worldBillies.say) return;
  const q = worldToScreen(C, b.x, 1.1, b.z);
  if (q) labels.push({ k: 'say', x: q.x, y: q.y - 6, t: worldBillies.say, a: Math.min(1, worldBillies.sayT * 3) });
}
/* species to warm up when a scene opens: the queue, your buddy and the trainers here */
function warmWorldBillies() {
  try {
    const L = [];
    for (const q of S.queue || []) L.push([q.sp, q.gold, 1]);
    const m = buddyBilly();
    if (m) {
      L.push([m.sp, m.gold, 1]);
      L.push([m.sp, m.gold, KBACK]);
    }
    if (typeof trainersAt === 'function')
      for (const T of trainersAt(S.route.node)) {
        const sp = companionSpecies(T);
        if (sp) L.push([sp, false, 1]);
        for (const e of T.team || []) {
          const s2 = /^@rival\d?$/.test(e.sp) && typeof rivalSp === 'function' ? rivalSp(e.sp) : e.sp;
          if (SP[s2]) L.push([s2, false, 1]);
        }
      }
    /* v34: what a battle here would need, loaded now while you walk (a battle used to start by loading it: 4 fps at worst) */
    for (const m of S.team.slice(0, 3)) L.push([m.sp, m.gold, KBACK]);
    if (L.length && typeof rigPreload === 'function')
      setTimeout(
        () =>
          rigPreload(L)
            .then(() => {
              for (const [sp, g, k] of L)
                try {
                  rigParts(sp, !!g, k);
                } catch (e) {}
            })
            .catch(() => {}),
        600
      );
    if (typeof battleStagePrepare === 'function' && typeof areaKey === 'function')
      setTimeout(() => {
        try {
          battleStagePrepare(areaKey()).catch(() => {});
        } catch (e) {}
      }, 1500);
  } catch (e) {}
}
/* v34: on a trip, the next stop is got ready (its pictures loaded, its ground worked out) while you're still walking
   there, so arriving doesn't pay for all of it at once */
const mapsPreparedAhead = new Set();
setInterval(() => {
  try {
    if (typeof S === 'undefined' || !S.started || !S.route || !(S.route.prog > 0) || typeof nextStop !== 'function')
      return;
    const nx = nextStop();
    if (nx == null) return;
    const id = sceneIdAt(nx);
    if (!id || mapsPreparedAhead.has(id) || (typeof walkView !== 'undefined' && walkView.id === id)) return;
    mapsPreparedAhead.add(id);
    if (mapsPreparedAhead.size > 6) mapsPreparedAhead.delete(mapsPreparedAhead.values().next().value);
    const t0 = performance.now();
    prepareMap(id)
      .then(() => {
        if (typeof NWLOG !== 'undefined')
          NWLOG.add('scene', `prepared ${id} ahead (${Math.round(performance.now() - t0)} ms in the background)`);
      })
      .catch(() => mapsPreparedAhead.delete(id));
  } catch (e) {}
}, 4000);
