'use strict';
/* ================= RIG: billionaires assembled from atlas images (art/billionaires/*.png) and skeletons (art/rigs.js) ================= */
/* ---- matrices ---- */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { B, RM, SP, provide } from './hooks.js';
import { clamp, rnd } from './util.js';
import { frameTask, userFps } from './frame-scheduler.js';
import { ART_CACHE, artImg, artLoad, artReady, artURL, makeCanvas } from './art.js';
import { animFor } from './body-plan-animation.js';
/* eslint-disable no-func-assign */
expose({
  KBACK: [() => KBACK],
  RIGBOX: [() => RIGBOX],
  RIGC: [() => RIGC],
  RIGDOM: [() => RIGDOM],
  RIG_POSES: [() => RIG_POSES],
  bustHTML: [() => bustHTML, v => (bustHTML = v)],
  drawDomRig: [() => drawDomRig, v => (drawDomRig = v)],
  drawRig: [() => drawRig, v => ((drawRig = v), provide({ drawRig }))],
  mMul: [() => mMul],
  mR: [() => mR],
  mS: [() => mS],
  mT: [() => mT],
  rigAtlas: [() => rigAtlas, v => (rigAtlas = v)],
  rigAudit: [() => rigAudit, v => (rigAudit = v)],
  rigFrame: [() => rigFrame, v => (rigFrame = v)],
  rigMatrices: [() => rigMatrices, v => (rigMatrices = v)],
  rigParts: [() => rigParts, v => setRigParts(v)],
  rigPose: [() => rigPose, v => (rigPose = v)],
  rigPreload: [() => rigPreload, v => (rigPreload = v)],
  rigTick: [() => rigTick, v => (rigTick = v)],
  rigTint: [() => rigTint, v => (rigTint = v)],
  setRigParts: [() => setRigParts, v => (setRigParts = v)],
  sm: [() => sm],
  sprHTML: [() => sprHTML, v => (sprHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ drawRig });
/* to-module: end */
const mMul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const mT = (x, y) => [1, 0, 0, 1, x, y],
  mR = a => {
    const c = Math.cos(a),
      s = Math.sin(a);
    return [c, s, -s, c, 0, 0];
  },
  mS = (x, y) => [x, 0, 0, y, 0, 0];
/* ---- skeleton drawing ---- */
/* bone world matrices for a pose; a bone animates by its role (b.a) or, by default, its name */
export function rigMatrices(R, P, view) {
  const back = view === 'back',
    k = R.k,
    A = R.anim(P, back) || {},
    A0 = P.prev && R.lag ? R.anim(P.prev, back) || {} : null;
  const root = A.root || {};
  let M = mT(R.cx, R.base);
  if (back) M = mMul(M, mS(-1, 1));
  M = mMul(M, mT(((P.x || 0) + (root.dx || 0)) * k, ((P.y || 0) + (root.dy || 0)) * k));
  if (P.r || root.r) {
    const pv = R.tipX || 0;
    M = mMul(M, mT(pv * k, 0));
    M = mMul(M, mR((P.r || 0) + (root.r || 0)));
    M = mMul(M, mT(-pv * k, 0));
  }
  M = mMul(M, mS((P.sx || 1) * (root.sx || 1), (P.sy || 1) * (root.sy || 1)));
  const W = { root: M },
    list = [];
  for (const b of R.bones) {
    const pm = W[b.par || 'root'] || M,
      a = (b.lag && A0 ? A0 : A)[b.a || b.n] || {};
    if (a.hide) {
      W[b.n] = pm;
      continue;
    }
    let m = mMul(pm, mT(b.at[0] * k, b.at[1] * k));
    if (a.dx || a.dy) m = mMul(m, mT((a.dx || 0) * k, (a.dy || 0) * k));
    const r = (b.rr || 0) + (a.r || 0);
    if (r) m = mMul(m, mR(r));
    if (a.sx || a.sy) m = mMul(m, mS(a.sx || 1, a.sy || 1));
    W[b.n] = m;
    const img = back && b.imgB ? b.imgB : b.img;
    if (!img || (back && b.hideB)) continue;
    const z = back && b.zb != null ? b.zb : b.z;
    list.push([z, m, img, a.v || (b.face ? P.face : null) || (img.v && P.sq && img.v[P.sq] ? P.sq : null), a.al, b]);
  }
  list.sort((p, q) => p[0] - q[0]);
  return { W, list };
}
export function drawRig(ctx, R, P, view) {
  const { list } = rigMatrices(R, P, view);
  for (const [z, m, img, v, al] of list) {
    const c = v && img.v ? img.v[v] || img.v.idle || img.c : img.c;
    ctx.setTransform(m[0], m[1], m[2], m[3], Math.round(m[4]), Math.round(m[5]));
    if (al != null) ctx.globalAlpha = al;
    ctx.drawImage(c, img.ox, img.oy);
    if (al != null) ctx.globalAlpha = 1;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
export function rigTint(ctx, w, h, col, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
const sm = x => x * x * (3 - 2 * x);
/* ---- shared pose channels (design space faces left: forward is -x) ---- */
export function rigPose(act, tau, t, seed) {
  const P = {
    act,
    tau,
    t,
    seed,
    x: 0,
    y: 0,
    r: 0,
    sx: 1,
    sy: 1,
    body: 0,
    bdy: 0,
    head: 0,
    hdx: 0,
    hdy: 0,
    aL: 0,
    aR: 0,
    lL: 0,
    lR: 0,
    tail: 0,
    flap: 1,
    open: 0,
    face: 'idle',
    hov: { dx: 0, dy: 0, r: 0 },
    k: 0,
  };
  const ph = (a, b) => clamp((tau - a) / (b - a), 0, 1);
  const br = Math.sin(t / 640 + seed);
  P.sy = 1 + 0.018 * br;
  P.sx = 1 - 0.01 * br;
  P.hdy = br > 0.45 ? -0.6 : 0;
  P.head = 0.05 * Math.sin(t / 1400 + seed * 2);
  P.aL = 0.07 * Math.sin(t / 800 + seed);
  P.aR = -0.07 * Math.sin(t / 800 + seed + 1.2);
  P.tail = 0.16 * Math.sin(t / 560 + seed);
  P.hov.dy = Math.sin(t / 480 + seed) * 2;
  P.hov.r = 0.08 * Math.sin(t / 900 + seed);
  if ((t + seed * 997) % 4300 < 130) P.face = 'blink';
  const lk = (t + seed * 1500) % 9000;
  if (lk < 700) {
    P.head += 0.13 * Math.sin((lk / 700) * Math.PI);
    if (lk > 200 && lk < 520) P.face = 'happy';
  }
  switch (act) {
    case 'attack': {
      const w = sm(ph(0, 150)),
        s = sm(ph(150, 240)),
        r = sm(ph(300, 580)),
        q = 1 - r;
      P.k = s * q;
      P.sq = w > 0.5 && s < 0.3 ? 'squash' : s > 0.5 && r < 0.5 ? 'stretch' : null;
      P.x = (3 * w - 12 * s) * q;
      P.body = (0.1 * w - 0.3 * s) * q;
      P.head += (0.08 * w - 0.2 * s) * q;
      P.aL += (-0.7 * w + 2.3 * s) * q;
      P.aR += (0.4 * w - 0.6 * s) * q;
      P.lL = 0.3 * s * q;
      P.lR = -0.2 * s * q;
      P.tail += 0.6 * s * q;
      P.flap = 1 + 2 * s * q;
      P.open = s * q;
      if (s > 0.15 && r < 0.6) P.face = 'shout';
      break;
    }
    case 'cast': {
      const u = sm(ph(0, 220)),
        r = sm(ph(560, 820)),
        q = u * (1 - r);
      P.k = q;
      P.aL += (2.4 + 0.25 * Math.sin(tau / 70)) * q;
      P.aR -= (2.4 + 0.25 * Math.sin(tau / 70 + 1)) * q;
      P.hdy -= 2 * q;
      P.head *= 1 - q;
      P.bdy = -q;
      P.y = -2 * q * Math.abs(Math.sin(tau / 160));
      P.flap = 1 + 1.6 * q;
      P.open = q * 0.6;
      if (q > 0.3) P.face = 'shout';
      break;
    }
    case 'hurt': {
      const e = Math.exp(-tau / 150) * (tau < 700 ? 1 : 0);
      P.k = e;
      P.sq = e > 0.45 ? 'squash' : null;
      P.x = 5 * e;
      P.head += 0.4 * e;
      P.body = 0.2 * e;
      P.aL += 1 * e * Math.sin(tau / 38);
      P.aR -= 1 * e * Math.sin(tau / 38 + 1);
      P.hdx = 2 * e;
      P.tail -= 0.5 * e;
      if (tau < 520) P.face = 'hurt';
      break;
    }
    case 'faint': {
      const q = sm(ph(0, 650)),
        w = sm(ph(0, 160));
      P.k = q;
      P.sq = w > 0.5 && q < 0.6 ? 'squash' : null;
      P.r = 1.2 * sm(ph(120, 620));
      P.body = -0.1 * w;
      P.head = 0.35 * q;
      P.lL = -0.3 * q;
      P.lR = 0.15 * q;
      P.aL = -0.9 * q;
      P.aR = 1.1 * q;
      P.flap = 1 - q;
      P.fall = sm(ph(80, 600));
      P.face = 'hurt';
      break;
    }
    case 'cheer': {
      const q = tau < 900 ? 1 : 0;
      P.k = q;
      P.sq = q && Math.abs(Math.sin(((tau / 150) * Math.PI) / 2)) > 0.7 ? 'stretch' : null;
      P.aL += (2.2 + 0.35 * Math.sin(tau / 75)) * q;
      P.aR -= (2.2 + 0.35 * Math.sin(tau / 75 + 1.4)) * q;
      P.y = -Math.abs(Math.sin(((tau / 150) * Math.PI) / 2)) * 6 * q;
      P.flap = 1 + q;
      P.tail += 0.5 * Math.sin(tau / 60) * q;
      if (q) P.face = 'happy';
      break;
    }
    case 'buff': {
      const q = tau < 760 ? sm(ph(0, 140)) : 0,
        pump = Math.sin(tau / 95) * 0.3;
      P.k = q;
      P.aL += (1.9 + pump) * q;
      P.aR -= (1.9 + pump) * q;
      P.bdy = -q;
      P.hdy -= q;
      P.sx *= 1 + 0.05 * q;
      P.sy *= 1 + 0.04 * q;
      if (q) P.face = 'happy';
      break;
    }
    case 'block': {
      const q = tau < 700 ? sm(ph(0, 120)) : 0;
      P.k = q;
      P.aL += 1.3 * q;
      P.aR += 1.1 * q;
      P.hdy += q;
      P.body = 0.06 * q;
      P.sy *= 1 - 0.04 * q;
      break;
    }
    case 'dizzy': {
      const q = tau < 800 ? 1 : 0;
      P.k = q;
      P.head += 0.28 * Math.sin(tau / 85) * q;
      P.body = 0.07 * Math.sin(tau / 120) * q;
      P.aL += 0.3 * Math.sin(tau / 90) * q;
      P.aR -= 0.3 * Math.sin(tau / 90 + 2) * q;
      if (q) P.face = 'hurt';
      break;
    }
    case 'enter': {
      const q = 1 - sm(ph(100, 600));
      P.k = q;
      P.aL += 1.2 * q;
      P.aR -= 1.2 * q;
      P.flap = 1 + q;
      if (tau < 500) P.face = 'happy';
      break;
    }
    /* v34: walking, looped (tau runs on). Front and back views only: the body plan decides what moves (body-plan-animation.js reads P.wk) */
    case 'walk': {
      const c = (tau / (P.wper || 560)) * Math.PI * 2,
        sn = Math.sin(c);
      P.wk = c;
      P.sq = Math.cos(c) > 0.8 ? 'squash' : null;
      P.y = -Math.abs(Math.cos(c)) * 2.4;
      P.body += 0.045 * sn;
      P.aL += -0.32 * sn;
      P.aR += -0.32 * sn;
      P.tail += 0.3 * sn;
      P.flap = 1.7;
      P.head += 0.03 * Math.sin(c * 2);
      P.hov.dy *= 0.4;
      break;
    }
    case 'smug': {
      const q = tau < 1000 ? 1 : 0;
      P.k = q;
      P.aL += (2.2 + 0.3 * Math.sin(tau / 70)) * q;
      P.head -= 0.15 * q;
      if (q) P.face = 'happy';
      break;
    }
  }
  return P;
}

/* v36: the pose for a rig on its clock. A rig with clock:12 (the new piece sheets) steps on a 12 fps grid: calm poses
   hold on twos, impacts snap on ones; the face cycles at 4 fps; lagging pieces (tail, hair, cape) get the pose one tick
   earlier through P.prev. A rig without a clock gets the plain 60 fps pose, as before. */
export function rigFrame(R, act, tau, t, seed) {
  if (!R || !R.clock) return rigPose(act, tau, t, seed);
  const tk = 1000 / R.clock,
    snap = act === 'attack' || act === 'hurt',
    q = snap ? tk : tk * 2,
    qt = Math.floor(tau / q) * q,
    qT = Math.floor(t / q) * q;
  const P = rigPose(act, qt, qT, seed);
  const fq = Math.floor(t / 250) * 250;
  P.face = rigPose(act, qt, fq, seed).face;
  if (R.lag) P.prev = rigPose(act, Math.max(0, qt - tk), qT - tk, seed);
  return P;
}
/* v36c: an audit of a rig's motion: for every pose, which pieces move and by how much (pixels of pivot travel plus
   rotation in pixels at the piece's size) over its run. The Studio shows it beside the skeleton; the quick check
   fails a species whose legs, head or tail never move. */
const RIG_POSES = ['idle', 'walk', 'attack', 'cast', 'hurt', 'faint', 'cheer', 'buff', 'dizzy'];
export function rigAudit(sp, view = 'front') {
  const R = rigParts(sp, false, view === 'back' ? KBACK : 1);
  if (!R) return null;
  const out = {};
  for (const act of RIG_POSES) {
    const dur = act === 'walk' ? 560 : act === 'idle' ? 1600 : 1100,
      n = 12,
      mv = {};
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const tau = (i * dur) / n,
        P = rigFrame(R, act === 'idle' ? null : act, act === 'idle' ? 0 : tau, act === 'idle' ? tau : 1000 + tau, 1);
      const { W, list } = rigMatrices(R, P, view);
      const cur = {};
      for (const [z, m, img, v, al, b] of list) {
        const w = Math.max(img.c.width, img.c.height) / 2;
        cur[b.n] = [m[4], m[5], Math.atan2(m[1], m[0]) * w, v || ''];
      }
      if (prev)
        for (const k in cur) {
          const a = prev[k],
            c = cur[k];
          if (!a) continue;
          mv[k] = (mv[k] || 0) + Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.abs(c[2] - a[2]) + (c[3] !== a[3] ? 2 : 0);
        }
      prev = cur;
    }
    out[act] = Object.fromEntries(Object.entries(mv).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  }
  const bones = R.bones.filter(b => b.img).map(b => b.n),
    still = bones.filter(b => RIG_POSES.every(a => !(out[a][b] > 0.5)));
  return { plan: R.plan, clock: R.clock || 0, bones, poses: out, still };
} /* v38: a bone without a picture (the hover bone of fish and fliers) is not audited */
export const RIGBOX = { w: 112, h: 104 },
  KBACK = 1.4;
const RIGC = {};
/* v36: the new piece sheets (art/next/billionaires, rigs in art/next/rigs-next.js) hold both views on one picture */
if (typeof window !== 'undefined' && window.RIGS_NEXT) {
  window.RIGS = window.RIGS || {};
  for (const k in window.RIGS_NEXT) if (!window.RIGS[k]) window.RIGS[k] = window.RIGS_NEXT[k];
}
export function rigAtlas(sp, gold, view) {
  const m = typeof RIGS !== 'undefined' && RIGS[sp] && RIGS[sp][view];
  if (m && m.sheet) return gold ? m.sheet.replace(/\.png$/, '_gold.png') : m.sheet;
  return `billionaires/${sp}${view === 'back' ? '_back' : ''}${gold ? '_gold' : ''}.png`;
}
export function rigParts(sp, gold, k = 1) {
  const view = k === 1 ? 'front' : 'back',
    key = sp + (gold ? 'g' : '') + view;
  if (RIGC[key]) return RIGC[key];
  const meta = RIGS[sp] && RIGS[sp][view];
  if (!meta) return null;
  const path = rigAtlas(sp, gold, view);
  artImg(path);
  if (!artReady(path)) return null;
  const atlas = ART_CACHE.img[path];
  const cut = ([x, y, w, h]) => {
    const c = makeCanvas(w, h);
    c.getContext('2d').drawImage(atlas, x, y, w, h, 0, 0, w, h);
    return c;
  };
  const imgs = meta.imgs.map(e => {
    const names = Object.keys(e.f);
    if (names.length === 1 && names[0] === 'main') return { ox: e.ox, oy: e.oy, c: cut(e.f.main) };
    const v = {};
    names.forEach(n => (v[n] = cut(e.f[n])));
    return { ox: e.ox, oy: e.oy, v, c: v.idle || v[names[0]] };
  });
  const bones = meta.bones.map(b => Object.assign({}, b, { img: b.i >= 0 ? imgs[b.i] : null }));
  return (RIGC[key] = {
    k: meta.k,
    BW: meta.BW,
    BH: meta.BH,
    cx: meta.cx,
    base: meta.base,
    tipX: meta.tipX,
    plan: meta.plan,
    geo: meta.geo,
    bones,
    anim: animFor(meta.plan, meta.q),
    clock: meta.clock || 0,
    lag: bones.some(b => b.lag),
  });
}
/* phase 04d: the Studio's battle preview draws its own billionaires (studio/js/battle-preview.js) */
export function setRigParts(v) {
  rigParts = v; // eslint-disable-line no-func-assign
  provide({ rigParts });
}
export function rigPreload(list) {
  return artLoad(list.map(([sp, gold, k]) => rigAtlas(sp, gold, k === 1 ? 'front' : 'back')));
}
/* ---- DOM animator: every <canvas class="rig"> on screen ---- */
const RIGDOM = { vis: new Set(), nodes: new Set(), io: null, mo: null, last: 0 };
export function sprHTML(sp, size, o = {}) {
  const w = Math.round(size * 1.25),
    h = Math.round((w * RIGBOX.h) / RIGBOX.w),
    st = SP[sp] ? (SP[sp].rar === 'mythical' ? 2 : SP[sp].stage) : 2,
    f = [1.3, 1.1, 1][st];
  return `<canvas class="rig${o.sil ? ' sil' : ''}" width="${RIGBOX.w * 2}" height="${RIGBOX.h * 2}" data-sp="${sp}" data-g="${o.gold ? 1 : 0}" data-v="${o.view || 'front'}"${o.still || o.sil ? ' data-still="1"' : ''}${o.act ? ` data-act="${o.act}"` : ''} style="width:${w}px;height:${h}px;margin:${-Math.round((h - size) / 2)}px ${-Math.round((w - size) / 2)}px;transform:scale(${f});transform-origin:50% 94%" aria-hidden="true"></canvas>`;
}
/* v39: the 64x64 bust from a species' piece sheet (rig meta "portrait"), as an <img> cropped by CSS; falls back to the
   rest-pose rig for a species without one */
export function bustHTML(sp, size, o = {}) {
  const R = RIGS[sp] && RIGS[sp].front,
    pr = R && R.portrait,
    sh = R && R.sheet;
  if (!pr || !sh) return sprHTML(sp, size, o);
  const k = size / 64,
    [x, y, w, h] = pr,
    W = R.size ? R.size[0] : 512,
    H = R.size ? R.size[1] : 512;
  return `<span class="bust${o.sil ? ' sil' : ''}" style="width:${size}px;height:${size}px;background-image:url('${artURL(o.gold ? sh.replace(/\.png$/, '_gold.png') : sh)}');background-position:${-x * k}px ${-y * k}px;background-size:${W * k}px ${H * k}px" aria-hidden="true"></span>`;
}
function drawDomRig(c, ts) {
  const sp = c.dataset.sp;
  if (!SP[sp]) return;
  const R = rigParts(sp, c.dataset.g === '1', 1);
  if (!R) return;
  const x = c.getContext('2d');
  if (c._seed == null) {
    c._seed = rnd() * 6;
    if (c.dataset.act) c._act = { k: c.dataset.act, t0: ts };
  }
  x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  const a = c._act;
  let act = a && ts - a.t0 < 1100 ? a.k : null;
  const P = rigFrame(R, act, a ? ts - a.t0 : 0, c.dataset.still || RM ? 0 : Math.floor(ts / 50) * 50, c._seed);
  if (R.BW === c.width && R.BH === c.height) drawRig(x, R, P, c.dataset.v);
  else {
    /* v36: a rig on another canvas size (the new 96/128 px sheets, k=1) is drawn to its own size, then placed with its base line on the box's base line at 2 px a pixel */
    const b = RIGDOM.buf || (RIGDOM.buf = makeCanvas(1, 1));
    if (b.width !== R.BW || b.height !== R.BH) {
      b.width = R.BW;
      b.height = R.BH;
    }
    const bx = b.getContext('2d');
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.clearRect(0, 0, b.width, b.height);
    bx.imageSmoothingEnabled = false;
    drawRig(bx, R, P, c.dataset.v);
    const z = 2 / R.k;
    x.drawImage(
      b,
      Math.round(c.width / 2 - R.cx * z),
      Math.round((c.height * 200) / 208 - R.base * z),
      R.BW * z,
      R.BH * z
    );
  }
  if (c.classList.contains('sil')) rigTint(x, c.width, c.height, '#000000', 1);
  c._drawn = 1;
}
function rigTick(ts) {
  RIGDOM.last = ts;
  if (!RIGDOM.mo) {
    if ('IntersectionObserver' in window)
      RIGDOM.io = new IntersectionObserver(es =>
        es.forEach(e => {
          if (e.isIntersecting) RIGDOM.vis.add(e.target);
          else RIGDOM.vis.delete(e.target);
        })
      );
    const scan = root => {
      if (!root.querySelectorAll) return;
      const list = [
        ...(root.matches && root.matches('canvas.rig') ? [root] : []),
        ...root.querySelectorAll('canvas.rig'),
      ];
      list.forEach(c => {
        if (RIGDOM.nodes.has(c)) return;
        RIGDOM.nodes.add(c);
        if (RIGDOM.io) RIGDOM.io.observe(c);
        else RIGDOM.vis.add(c);
      });
    };
    scan(document);
    if ('MutationObserver' in window) {
      RIGDOM.mo = new MutationObserver(es => es.forEach(e => e.addedNodes.forEach(scan)));
      RIGDOM.mo.observe(document.body, { childList: true, subtree: true });
    } else RIGDOM.mo = { fallback: scan };
  }
  if (RIGDOM.mo.fallback) RIGDOM.mo.fallback(document);
  for (const c of RIGDOM.nodes) {
    if (!c.isConnected) {
      RIGDOM.nodes.delete(c);
      RIGDOM.vis.delete(c);
      if (RIGDOM.io) RIGDOM.io.unobserve(c);
      continue;
    }
    if (!RIGDOM.vis.has(c)) continue;
    if ((!c.dataset.still && !RM) || !c._drawn) drawDomRig(c, ts);
  }
}
frameTask('rig', rigTick, () => (B ? 4 : Math.min(60, userFps() / 2)));
document.addEventListener(
  'pointerdown',
  ev => {
    const card = ev.target.closest('button,.buddy,.slot,.dex,.enc');
    const c = card ? card.querySelector('canvas.rig') : ev.target.closest('canvas.rig');
    if (c && !c.dataset.still) c._act = { k: 'cheer', t0: performance.now() };
  },
  { passive: true }
);
