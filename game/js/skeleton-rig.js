'use strict';
/* ================= RIG: billionaires assembled from atlas images (art/billionaires/*.png) and skeletons (art/rigs.js) ================= */
/* ---- matrices ---- */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { COATS, GENES, ROBOTS, RULES, SPECIES, activeBattle, gameData, provide, reducedMotion } from './hooks.js';
import { clamp, random } from './util.js';
import { kitBakeWhole } from './logic/kit-assemble.js';
import { geneSplit, graftForm, graftLookSplit, graftParse, graftPlaceholder } from './logic/graft-art.js';
import { robotJoint, robotSingleLegs } from './logic/robot-joints.js';
import { coatArt, coatColorMap, coatRecolor } from './logic/coats.js';
import { frameTask, userFps } from './frame-scheduler.js';
import { ART_CACHE, artImg, artLoad, artReady, artURL, makeCanvas } from './art.js';
import { robotArmCanvas, robotArtFiles, robotLegsCanvas, robotRig } from './robot-art.js';
import { animFor } from './body-plan-animation.js';
/* eslint-disable no-func-assign */
expose({
  AUG_BONES: [() => AUG_BONES],
  BONE_SLOT_RULES: [() => BONE_SLOT_RULES],
  COAT_ATLASES: [() => COAT_ATLASES],
  GRAFT_BAKES: [() => GRAFT_BAKES],
  GRAFT_KEEP: [() => GRAFT_KEEP],
  GRAFT_PIXELS: [() => GRAFT_PIXELS],
  GROUNDED: [() => GROUNDED],
  RIG_BACK_VIEW: [() => RIG_BACK_VIEW],
  RIG_CANVAS_SIZE: [() => RIG_CANVAS_SIZE],
  RIG_PARTS_CACHE: [() => RIG_PARTS_CACHE],
  RIG_POSES: [() => RIG_POSES],
  affineMultiply: [() => affineMultiply],
  affineRotate: [() => affineRotate],
  affineScale: [() => affineScale],
  affineTranslate: [() => affineTranslate],
  augPicture: [() => augPicture, v => (augPicture = v)],
  augRigParts: [() => augRigParts, v => (augRigParts = v)],
  augScaled: [() => augScaled, v => (augScaled = v)],
  boneSlot: [() => boneSlot, v => (boneSlot = v)],
  buildCode: [() => buildCode, v => (buildCode = v)],
  buildFromCode: [() => buildFromCode, v => (buildFromCode = v)],
  buildScales: [() => buildScales, v => (buildScales = v)],
  bustHTML: [() => bustHTML, v => (bustHTML = v)],
  coatAtlas: [() => coatAtlas, v => (coatAtlas = v)],
  coatAtlasURL: [() => coatAtlasURL, v => (coatAtlasURL = v)],
  coatRigData: [() => coatRigData, v => setCoatRigData(v)],
  coatsForRigs: [() => coatsForRigs],
  drawDomRig: [() => drawDomRig, v => (drawDomRig = v)],
  drawRig: [() => drawRig, v => ((drawRig = v), provide({ drawRig }))],
  graftBake: [() => graftBake, v => (graftBake = v)],
  graftBakePlaceholder: [() => graftBakePlaceholder, v => (graftBakePlaceholder = v)],
  graftBytes: [() => graftBytes],
  graftForget: [() => graftForget, v => (graftForget = v)],
  graftKeep: [() => graftKeep, v => (graftKeep = v)],
  graftPartPixels: [() => graftPartPixels, v => (graftPartPixels = v)],
  graftPlaceholderForm: [() => graftPlaceholderForm],
  graftPlaceholderRig: [() => graftPlaceholderRig],
  graftReport: [() => graftReport],
  graftRigParts: [() => graftRigParts, v => (graftRigParts = v)],
  graftStats: [() => graftStats],
  rigAtlas: [() => rigAtlas, v => (rigAtlas = v)],
  rigAudit: [() => rigAudit, v => (rigAudit = v)],
  rigBuildScales: [() => rigBuildScales, v => (rigBuildScales = v)],
  rigCanvasAnimator: [() => rigCanvasAnimator],
  rigCanvasHTML: [() => rigCanvasHTML, v => (rigCanvasHTML = v)],
  rigFrame: [() => rigFrame, v => (rigFrame = v)],
  rigFrameKey: [() => rigFrameKey, v => (rigFrameKey = v)],
  rigFromMeta: [() => rigFromMeta, v => (rigFromMeta = v)],
  rigMatrices: [() => rigMatrices, v => (rigMatrices = v)],
  rigParts: [() => rigParts, v => setRigParts(v)],
  rigPose: [() => rigPose, v => (rigPose = v)],
  rigPreload: [() => rigPreload, v => (rigPreload = v)],
  rigTick: [() => rigTick, v => (rigTick = v)],
  rigTint: [() => rigTint, v => (rigTint = v)],
  robotRigData: [() => robotRigData, v => setRobotRigData(v)],
  robotRigParts: [() => robotRigParts, v => (robotRigParts = v)],
  setCoatRigData: [() => setCoatRigData, v => (setCoatRigData = v)],
  setRigParts: [() => setRigParts, v => (setRigParts = v)],
  setRobotRigData: [() => setRobotRigData, v => (setRobotRigData = v)],
  smoothStepUnclamped: [() => smoothStepUnclamped],
});
/* eslint-enable no-func-assign */
provide({ drawRig });
/* to-module: end */
const affineMultiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const affineTranslate = (x, y) => [1, 0, 0, 1, x, y],
  affineRotate = a => {
    const c = Math.cos(a),
      s = Math.sin(a);
    return [c, s, -s, c, 0, 0];
  },
  affineScale = (x, y) => [x, 0, 0, y, 0, 0];
/* ---- parts (phase 16): which slot a bone belongs to, and how big a build draws it ---- */
/* by name; the Studio's skeleton builder can set b.slot on a bone instead. A bone with no slot (ears on a head, a
   spark on a tail) takes its parent's size; effects (cloud, dust, puddle, fly) stay as they are */
const BONE_SLOT_RULES = [
  [/^(head|mane|face)$/, 'head'],
  [/^(torso|body|abdomen|shell|coil|pot)$/, 'body'],
  [/^(legF[FN]|arm[LR]|wing[LR]|claw[LR]|leaf[LR]\d|leg[LR][01]|n\d)$/, 'front'],
  [/^(legB[FN]|leg[LR]|thigh[LR]|foot[LR]|l\d|leg[LR][23])$/, 'back'],
  [/^(tail|plume\d|spark\d?|bird\d|jet|tree|mound|pebble|stone\d|gull[LR])$/, 'sig'],
];
export function boneSlot(b) {
  if (b.slot !== undefined) return b.slot || null;
  for (const [re, sl] of BONE_SLOT_RULES) if (re.test(b.n)) return sl;
  return null;
}
/* the slots that stand on the ground: legs (and a quad's front legs) */
const GROUNDED = { quad: ['front', 'back'], insect: ['front', 'back'], crab: ['front', 'back'] };
/** a build ({ head: 'L', ... }) as draw scales per slot, or null when it changes nothing */
function buildScales(build) {
  if (!build || typeof RULES === 'undefined' || !RULES.parts) return null;
  const S = RULES.parts.sizes,
    out = {};
  let any = false;
  for (const k of RULES.parts.slots) {
    out[k] = (S[build[k]] || S.M).scale;
    if (out[k] !== 1) any = true;
  }
  return any ? out : null;
}
/* each bone's scale, and how far the figure must rise so its feet stay on the ground line */
function rigBuildScales(R, SZ) {
  const S = { root: 1 },
    Y = { root: 0 },
    Y0 = { root: 0 },
    ground = GROUNDED[R.plan] || ['back'];
  let low = -Infinity,
    low0 = -Infinity;
  for (const b of R.bones) {
    const ps = S[b.par || 'root'] ?? 1,
      sl = boneSlot(b),
      sc = sl && SZ[sl] != null ? SZ[sl] : ps;
    S[b.n] = sc;
    Y[b.n] = (Y[b.par || 'root'] ?? 0) + b.at[1] * R.k * ps;
    Y0[b.n] = (Y0[b.par || 'root'] ?? 0) + b.at[1] * R.k;
    const img = b.img;
    if (img && ground.includes(sl)) {
      const c = img.c || (img.v && Object.values(img.v)[0]),
        bottom = img.oy + (c ? c.height : 0);
      low = Math.max(low, Y[b.n] + bottom * sc);
      low0 = Math.max(low0, Y0[b.n] + bottom);
    }
  }
  return { S, lift: low > -Infinity && low0 > -Infinity ? low - low0 : 0 };
}
/* ---- skeleton drawing ---- */
/* bone world matrices for a pose; a bone animates by its role (b.a) or, by default, its name. P.build (phase 16) draws
   each part at its size: the piece scales around its pivot and what hangs on it moves out with it */
export function rigMatrices(R, P, view) {
  const back = view === 'back',
    k = R.k,
    A = R.anim(P, back) || {},
    A0 = P.prev && R.lag ? R.anim(P.prev, back) || {} : null;
  const root = A.root || {},
    SZ = buildScales(P.build),
    BS = SZ ? rigBuildScales(R, SZ) : null;
  let M = affineTranslate(R.cx, R.base - (BS ? BS.lift : 0));
  if (back) M = affineMultiply(M, affineScale(-1, 1));
  M = affineMultiply(M, affineTranslate(((P.x || 0) + (root.dx || 0)) * k, ((P.y || 0) + (root.dy || 0)) * k));
  if (P.r || root.r) {
    const pv = R.tipX || 0;
    M = affineMultiply(M, affineTranslate(pv * k, 0));
    M = affineMultiply(M, affineRotate((P.r || 0) + (root.r || 0)));
    M = affineMultiply(M, affineTranslate(-pv * k, 0));
  }
  M = affineMultiply(M, affineScale((P.sx || 1) * (root.sx || 1), (P.sy || 1) * (root.sy || 1)));
  const W = { root: M },
    list = [];
  for (const b of R.bones) {
    const pm = W[b.par || 'root'] || M,
      a = (b.lag && A0 ? A0 : A)[b.a || b.n] || {};
    if (a.hide) {
      W[b.n] = pm;
      continue;
    }
    const ps = BS ? (BS.S[b.par || 'root'] ?? 1) : 1;
    let m = affineMultiply(pm, affineTranslate(b.at[0] * k * ps, b.at[1] * k * ps));
    if (a.dx || a.dy) m = affineMultiply(m, affineTranslate((a.dx || 0) * k, (a.dy || 0) * k));
    const r = (b.rr || 0) + (a.r || 0);
    if (r) m = affineMultiply(m, affineRotate(r));
    if (a.sx || a.sy) m = affineMultiply(m, affineScale(a.sx || 1, a.sy || 1));
    W[b.n] = m;
    const img = back && b.imgB ? b.imgB : b.img;
    if (!img || (back && b.hideB)) continue;
    const z = back && b.zb != null ? b.zb : b.z,
      sc = BS ? BS.S[b.n] : 1;
    list.push([
      z,
      sc !== 1 ? affineMultiply(m, affineScale(sc, sc)) : m,
      img,
      a.v || (b.face ? P.face : null) || (img.v && P.sq && img.v[P.sq] ? P.sq : null),
      /* phase 17: a robot's broken parts (P.dim, bone names) are drawn faint */
      P.dim && P.dim.includes(b.n) ? 0.3 : a.al,
      b,
    ]);
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
const smoothStepUnclamped = x => x * x * (3 - 2 * x);
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
      const w = smoothStepUnclamped(ph(0, 150)),
        s = smoothStepUnclamped(ph(150, 240)),
        r = smoothStepUnclamped(ph(300, 580)),
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
      const u = smoothStepUnclamped(ph(0, 220)),
        r = smoothStepUnclamped(ph(560, 820)),
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
      const q = smoothStepUnclamped(ph(0, 650)),
        w = smoothStepUnclamped(ph(0, 160));
      P.k = q;
      P.sq = w > 0.5 && q < 0.6 ? 'squash' : null;
      P.r = 1.2 * smoothStepUnclamped(ph(120, 620));
      P.body = -0.1 * w;
      P.head = 0.35 * q;
      P.lL = -0.3 * q;
      P.lR = 0.15 * q;
      P.aL = -0.9 * q;
      P.aR = 1.1 * q;
      P.flap = 1 - q;
      P.fall = smoothStepUnclamped(ph(80, 600));
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
      const q = tau < 760 ? smoothStepUnclamped(ph(0, 140)) : 0,
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
      const q = tau < 700 ? smoothStepUnclamped(ph(0, 120)) : 0;
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
      const q = 1 - smoothStepUnclamped(ph(100, 600));
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
/* phase 20 R3 (the battle lane): rigFrame's stepping as one string. Two frames with the same key get the same pose and
   face, so the battle keeps the canvas it drew instead of drawing and uploading it again (battle-stage.js actorBuffer,
   quality.rigReuse). Every rig has a clock today (12: a pose every 167 ms, attack and hurt every 83 ms, the face every
   250 ms); one without is posed at the time it's given, so its key holds that time. tools/test/rig-frame-key.test.mjs */
export function rigFrameKey(R, act, tau, t, seed) {
  if (!R || !R.clock) return `${act}|${tau}|${t}|${seed}`;
  const tk = 1000 / R.clock,
    q = act === 'attack' || act === 'hurt' ? tk : tk * 2;
  return `${act}|${Math.floor(tau / q)}|${Math.floor(t / q)}|${Math.floor(t / 250)}|${seed}`;
}
/* v36c: an audit of a rig's motion: for every pose, which pieces move and by how much (pixels of pivot travel plus
   rotation in pixels at the piece's size) over its run. The Studio shows it beside the skeleton; the quick check
   fails a species whose legs, head or tail never move. */
const RIG_POSES = ['idle', 'walk', 'attack', 'cast', 'hurt', 'faint', 'cheer', 'buff', 'dizzy'];
export function rigAudit(sp, view = 'front') {
  const R = rigParts(sp, view === 'back' ? RIG_BACK_VIEW : 1);
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
export const RIG_CANVAS_SIZE = { w: 112, h: 104 },
  RIG_BACK_VIEW = 1.4;
const RIG_PARTS_CACHE = {};
/* v36: the new piece sheets (art/next/billionaires, rigs in art/next/rigs-next.js) hold both views on one picture */
if (typeof window !== 'undefined' && window.RIGS_NEXT) {
  window.RIGS = window.RIGS || {};
  for (const k in window.RIGS_NEXT) if (!window.RIGS[k]) window.RIGS[k] = window.RIGS_NEXT[k];
}
/* RO-1: a regional form is drawn with its base stage's rig (its coat recolours it) */
if (typeof window !== 'undefined' && window.RIGS && typeof SPECIES !== 'undefined' && SPECIES)
  for (const [id, S] of Object.entries(SPECIES))
    if (S.formOf && !window.RIGS[id] && window.RIGS[S.formOf]) window.RIGS[id] = window.RIGS[S.formOf];
export function rigAtlas(sp, view, coat) {
  const own = coat ? coatArt(coatsForRigs()[coat], sp, view) : null;
  if (own) return own;
  const m = typeof RIGS !== 'undefined' && RIGS[sp] && RIGS[sp][view];
  if (m && m.sheet) return m.sheet;
  return `billionaires/${sp}${view === 'back' ? '_back' : ''}.png`;
}
/* studio track ST-0: a coat recolours the sheet once (logic/coats.js) unless the coat has its own picture for it; the
   game hands over coats.json as COATS, the Studio its own copy (setCoatRigData) */
let coatRigData = null;
const COAT_ATLASES = new Map();
const coatsForRigs = () => coatRigData || (typeof COATS !== 'undefined' ? COATS : null) || {};
export function setCoatRigData(D) {
  coatRigData = D;
  COAT_ATLASES.clear();
  for (const k of Object.keys(RIG_PARTS_CACHE)) if (k.includes('#')) delete RIG_PARTS_CACHE[k];
}
export function coatAtlas(img, path, sp, view, coat) {
  const C = coat && coatsForRigs()[coat];
  if (!C || !img || coatArt(C, sp, view)) return img;
  const key = path + '#' + coat,
    had = COAT_ATLASES.get(key);
  if (had && had.src === img) return had.c;
  /* LD-1: a canvas kept in memory (willReadFrequently), so reading it back doesn't stall on the graphics chip */
  const c = makeCanvas(img.width, img.height),
    x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height),
    pal = typeof window !== 'undefined' ? window.NW_PALETTE : null;
  coatRecolor(im.data, coatColorMap(C, pal), pal);
  x.putImageData(im, 0, 0);
  COAT_ATLASES.set(key, { src: img, c, url: '' });
  return c;
}
/* the recoloured sheet as a URL for a CSS bust, once the sheet has loaded (until then the plain sheet) */
function coatAtlasURL(path, sp, view, coat) {
  const C = coat && coatsForRigs()[coat];
  if (!C || coatArt(C, sp, view) || !artReady(path)) return artURL(path);
  coatAtlas(ART_CACHE.img[path], path, sp, view, coat);
  const e = COAT_ATLASES.get(path + '#' + coat);
  return e.url || (e.url = e.c.toDataURL());
}
export function rigParts(sp, k = 1, coat, graft) {
  const view = k === 1 ? 'front' : 'back',
    key = sp + view + (coat ? '#' + coat : '') + (graft ? '~' + graft : '');
  if (RIG_PARTS_CACHE[key]) return RIG_PARTS_CACHE[key];
  /* phase 17: a robot is drawn from its parts */
  if (typeof sp === 'string' && sp.startsWith('bot:')) return robotRigParts(sp, k);
  /* SP-5: a look code with Augments: its rig, then the bot parts on their bones */
  if (graft && graft.includes('+')) return augRigParts(sp, k, coat, graft, key);
  if (graft) return graftRigParts(sp, view, coat, graft, key);
  const meta = RIGS[sp] && RIGS[sp][view];
  if (!meta) return null;
  const path = rigAtlas(sp, view, coat);
  artImg(path);
  if (!artReady(path)) return null;
  const atlas = coatAtlas(ART_CACHE.img[path], path, sp, view, coat);
  return (RIG_PARTS_CACHE[key] = rigFromMeta(meta, atlas));
}
/* studio plan T5.6: a rig put together from one view of its metadata (rigs-next.js) and its sheet: the pieces cut
   out, the bones given their pictures, its clock and lag. The game's rigParts and the Studio's previews (sprites.js
   rigFor, on the Studio's own rigs and pictures) both use it, so both animate the same way. */
export function rigFromMeta(meta, atlas) {
  /* at least 1 x 1: a box the Studio is editing can be empty for a moment (no rig in the game has one) */
  const cut = ([x, y, w, h]) => {
    const c = makeCanvas(Math.max(1, w), Math.max(1, h));
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
  return {
    k: meta.k,
    BW: meta.BW,
    BH: meta.BH,
    cx: meta.cx,
    base: meta.base,
    tipX: meta.tipX,
    plan: meta.plan,
    geo: meta.geo,
    bones,
    anim: animFor(meta.plan, meta.q || {}),
    clock: meta.clock || 0,
    lag: bones.some(b => b.lag),
  };
}
/* phase 17: a robot's rig, drawn from its parts (robot-art.js); the game hands over robots.json as ROBOTS, the Studio
   its own copy (setRobotRigData). While its pictures load it is drawn with stand-ins and asked for again. */
export function robotRigParts(sp, k = 1) {
  const key = sp + (k === 1 ? 'front' : 'back');
  if (RIG_PARTS_CACHE[key]) return RIG_PARTS_CACHE[key];
  const R = robotRig(sp, robotRigData || (typeof ROBOTS !== 'undefined' ? ROBOTS : null), k);
  if (!R) return null;
  Object.assign(R, { anim: animFor(R.plan, R.q), lag: false });
  if (!R.wait) RIG_PARTS_CACHE[key] = R;
  return R;
}
/* phase 17: the Studio draws robots from the robots.json it is editing; after an edit, the robots are drawn again */
let robotRigData = null;
export function setRobotRigData(D) {
  robotRigData = D;
  for (const k of Object.keys(RIG_PARTS_CACHE)) if (k.startsWith('bot:')) delete RIG_PARTS_CACHE[k];
}
/* phase 04d: the Studio's battle preview draws its own billionaires (studio/js/battle-preview.js) */
export function setRigParts(v) {
  rigParts = v; // eslint-disable-line no-func-assign
  provide({ rigParts });
}
export function rigPreload(list) {
  /* phase 17: a robot loads its parts' pictures */
  const D = robotRigData || (typeof ROBOTS !== 'undefined' ? ROBOTS : null);
  /* SP-1: a grafted Billie is baked (its parts' pictures loaded first), so a battle bakes while it loads */
  const bakes = list
    .map(([sp, , , graft]) => [sp, graftLookSplit(graft).graft])
    .filter(([sp, graft]) => graft && !String(sp).startsWith('bot:'))
    .map(([sp, graft]) => graftBake(sp, graft));
  /* SP-5: and the pictures of the Augments it wears */
  const augArt = list.flatMap(([, , , graft]) =>
    Object.values(graftLookSplit(graft).aug || {}).flatMap(id => {
      const P = D && D.parts[id];
      return P && P.art ? [P.art.img, P.art.imgB].filter(Boolean) : [];
    })
  );
  return Promise.all([
    artLoad(
      list
        .flatMap(([sp, k, coat]) =>
          String(sp).startsWith('bot:') ? robotArtFiles(sp, D) : [rigAtlas(sp, k === 1 ? 'front' : 'back', coat)]
        )
        .concat(augArt)
    ),
    ...bakes,
  ]).then(([loaded]) => loaded);
}
/* ---- SP-1: grafted Billies, baked at runtime ----
   A Billie wearing another species' part (logic/graft-art.js) is baked from its species' kit recipe with the donor's
   part (kitBakeWhole, the baker `npm run bake:kits` and the Studio use), once per species and graft, kept for the
   last GRAFT_KEEP of them. Until its bake is done rigParts gives null (as for a sheet still loading); a bake that fails
   draws the plain species. Each bake's times and sizes go to the debug log (graftReport) for the art spike's verdict:
   runtime baking on the phone, or grafts baked offline. RO-3c: a placeholder Billie (bodyPlans.json) is grafted by
   slot across body plans from its donors' baked sheets and rigs instead (graftPlaceholder). */
const GRAFT_KEEP = 12;
const GRAFT_BAKES = new Map(); /* sp~graft -> { wait, rig, sheet, bytes, bad, keys: its rigParts cache keys } */
const GRAFT_PIXELS = new Map(); /* a kit part's picture path -> its pixels */
export const graftReport = () => {
  const S = graftStats,
    ms = S.ms.slice().sort((a, b) => a - b);
  return {
    bakes: ms.length,
    failed: S.bad,
    medianMs: ms.length ? ms[ms.length >> 1] : null,
    maxMs: ms.length ? ms[ms.length - 1] : null,
    loadMaxMs: S.loadMs.length ? Math.max(...S.loadMs) : null,
    keptKB: Math.round(graftBytes() / 1024),
    peakKB: Math.round(S.peak / 1024),
    last: S.last.slice(-8),
  };
};
const graftStats = { ms: [], loadMs: [], bad: 0, peak: 0, last: [] };
const graftBytes = () => [...GRAFT_BAKES.values()].reduce((n, e) => n + (e.bytes || 0), 0);
function graftPartPixels(path) {
  let p = GRAFT_PIXELS.get(path);
  if (p) return p;
  const im = ART_CACHE.img[path],
    c = makeCanvas(im.naturalWidth, im.naturalHeight),
    x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  p = { width: d.width, height: d.height, data: d.data };
  GRAFT_PIXELS.set(path, p);
  return p;
}
/* bake a species with a graft (a graft code): load its parts' pictures, then bake in a task of its own */
function graftBake(sp, graft) {
  const id = sp + '~' + graft,
    had = GRAFT_BAKES.get(id);
  if (had) {
    GRAFT_BAKES.delete(id); /* most recently used last */
    GRAFT_BAKES.set(id, had);
    return had.wait;
  }
  const e = { wait: null, rig: null, sheet: null, bytes: 0, bad: false, keys: [] };
  GRAFT_BAKES.set(id, e);
  while (GRAFT_BAKES.size > GRAFT_KEEP) graftForget(GRAFT_BAKES.keys().next().value);
  const g = graftParse(graft) || {},
    fail = err => {
      e.bad = true;
      graftStats.bad++;
      if (typeof debugLog !== 'undefined') debugLog.add('graft', `bake failed: ${sp} ${graft}: ${err}`);
    };
  /* RO-3c: a placeholder Billie is grafted by slot from its donors' baked sheets (logic/graft-art.js); SP-2: a slot
     holds a Gene id ("part@donor"), the donor its rig (a bare species id, as the debug menu sets, is the donor too) */
  const donors = Object.fromEntries(Object.entries(g).map(([slot, v]) => [slot, (geneSplit(v) || { donor: v }).donor]));
  if ([sp, ...Object.values(donors)].some(graftPlaceholderRig))
    return (e.wait = graftBakePlaceholder(id, e, sp, graft, donors, fail));
  const K = gameData.partKits,
    form = graftForm(gameData.kitBuilds, K, sp, g);
  if (!form) {
    fail('no recipe or no fitting part');
    return (e.wait = Promise.resolve());
  }
  const ids = [...Object.values(form.parts).map(p => p[0]), ...(form.extras || []).map(x => x[0])],
    paths = [...new Set(ids.flatMap(pid => ['front', 'back'].map(v => K.parts[pid].views[v].file)))],
    t0 = performance.now();
  e.wait = artLoad(paths)
    .then(() => new Promise(res => setTimeout(res, 0)))
    .then(() => {
      if (GRAFT_BAKES.get(id) !== e) return; /* forgotten while its pictures loaded */
      const t1 = performance.now();
      try {
        const made = kitBakeWhole({ partKits: K, kitBuilds: gameData.kitBuilds, rules: RULES }, form, (pid, view) =>
          graftPartPixels(K.parts[pid].views[view].file)
        );
        graftKeep(e, sp, graft, made, t0, t1);
      } catch (err) {
        fail(err && err.message);
      }
    });
  return e.wait;
}
/* RO-3c: a species whose rig is a placeholder (bodyPlans.json), and its form there */
const graftPlaceholderRig = sp =>
  !!(typeof RIGS !== 'undefined' && RIGS[sp] && RIGS[sp].front && RIGS[sp].front.placeholder);
const graftPlaceholderForm = sp => ((gameData.bodyPlans && gameData.bodyPlans.forms) || []).find(f => f.rig === sp);
/* RO-3c: a placeholder Billie grafted from its donors' sheets and rigs; a kit Billie with a placeholder donor (or the
   other way round) isn't grafted */
function graftBakePlaceholder(id, e, sp, graft, g, fail) {
  const all = [sp, ...Object.values(g)];
  if (!all.every(s => graftPlaceholderRig(s) && graftPlaceholderForm(s))) {
    fail('a kit Billie and a placeholder one, or no placeholder form');
    return Promise.resolve();
  }
  const t0 = performance.now();
  return artLoad([...new Set(all.map(s => RIGS[s].front.sheet))])
    .then(() => new Promise(res => setTimeout(res, 0)))
    .then(() => {
      if (GRAFT_BAKES.get(id) !== e) return; /* forgotten while its pictures loaded */
      const t1 = performance.now(),
        baked = s => ({ form: graftPlaceholderForm(s), rig: RIGS[s], sheet: graftPartPixels(RIGS[s].front.sheet) });
      try {
        const made = graftPlaceholder(
          gameData.bodyPlans,
          gameData.kitBuilds.bake,
          baked(sp),
          Object.fromEntries(Object.entries(g).map(([slot, d]) => [slot, baked(d)]))
        );
        graftKeep(e, sp, graft, made, t0, t1, all.map(s => RIGS[s].front.plan).join('<'));
      } catch (err) {
        fail(err && err.message);
      }
    });
}
/* a bake done: its sheet as a canvas, its rig, and its times and sizes for the debug log */
function graftKeep(e, sp, graft, made, t0, t1, plans) {
  const c = makeCanvas(made.sheet.width, made.sheet.height);
  c.getContext('2d').putImageData(new ImageData(made.sheet.data, made.sheet.width, made.sheet.height), 0, 0);
  const ms = Math.round(performance.now() - t1),
    loadMs = Math.round(t1 - t0);
  /* the sheet, and the pieces rigFromMeta cuts from it for each view */
  e.bytes =
    c.width * c.height * 4 +
    ['front', 'back'].reduce(
      (n, v) =>
        n + made.rig[v].imgs.reduce((m, im) => m + Object.values(im.f).reduce((q, [, , w, h]) => q + w * h * 4, 0), 0),
      0
    );
  Object.assign(e, { rig: made.rig, sheet: c });
  graftStats.ms.push(ms);
  graftStats.loadMs.push(loadMs);
  graftStats.peak = Math.max(graftStats.peak, graftBytes());
  graftStats.last.push({
    sp,
    graft,
    ms,
    loadMs,
    w: c.width,
    h: c.height,
    kb: Math.round(e.bytes / 1024),
    ...(plans ? { plans } : {}),
  });
  if (graftStats.last.length > 24) graftStats.last.shift();
  if (typeof debugLog !== 'undefined')
    debugLog.add('graft', `baked ${sp} ${graft}: ${ms} ms (pictures ${loadMs} ms), ${c.width}x${c.height}`, {
      ms,
      loadMs,
      kb: Math.round(e.bytes / 1024),
      ...(plans ? { plans } : {}),
    });
}
function graftForget(id) {
  for (const k of GRAFT_BAKES.get(id).keys) delete RIG_PARTS_CACHE[k];
  for (const k of COAT_ATLASES.keys()) if (k.startsWith(`graft:${id}#`)) COAT_ATLASES.delete(k);
  GRAFT_BAKES.delete(id);
}
function graftRigParts(sp, view, coat, graft, key) {
  const e = GRAFT_BAKES.get(sp + '~' + graft);
  if (!e) {
    graftBake(sp, graft);
    return null;
  }
  if (e.bad) return rigParts(sp, view === 'front' ? 1 : RIG_BACK_VIEW, coat);
  if (!e.rig) return null;
  const atlas = coatAtlas(e.sheet, `graft:${sp}~${graft}`, sp, view, coat);
  e.keys.push(key);
  return (RIG_PARTS_CACHE[key] = rigFromMeta(e.rig[view], atlas));
}
/* ---- SP-5: Augments drawn on a Billie ----
   A Billie wearing a bot part keeps its own rig (plain or grafted); the bone the Augment's slot is (the front's arm
   on its side, the back's legs) takes the part's picture instead (robots.json art.img, art.imgB for the back; a
   stand-in from its colour while it has none), scaled to the Billie's own limb and hung from the part's joint
   (logic/robot-joints.js), so it moves as the limb did. Treads and a hover skirt are one piece under both hips. The
   battle stage dims a broken one as it dims a robot's (ROBOT_PART_BONES). */
/** the bones an Augment's slot is drawn on @param {string} slot */
const AUG_BONES = slot =>
  slot === 'back'
    ? ['legL', 'legR']
    : [
        (typeof GENES !== 'undefined' && GENES.augment.slots.front && GENES.augment.slots.front.side) === 'L'
          ? 'armL'
          : 'armR',
      ];
/** a part's picture for a view, null while it loads (a stand-in when it has none) @param {any} P @param {string} view */
function augPicture(P, view) {
  const path = (view === 'back' && P.art.imgB) || P.art.img;
  if (!path) return P.slot === 'legs' ? robotLegsCanvas(P) : robotArmCanvas(P);
  artImg(path);
  return artReady(path) ? ART_CACHE.img[path] : null;
}
/** a picture scaled by s, pixel for pixel @param {any} im @param {number} s */
function augScaled(im, s) {
  const c = makeCanvas(Math.max(1, Math.round(im.width * s)), Math.max(1, Math.round(im.height * s))),
    x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(im, 0, 0, c.width, c.height);
  return c;
}
function augRigParts(sp, k, coat, code, key) {
  const view = k === 1 ? 'front' : 'back',
    { graft, aug } = graftLookSplit(code),
    base = rigParts(sp, k, coat, graft || undefined),
    D = robotRigData || (typeof ROBOTS !== 'undefined' ? ROBOTS : null);
  if (!base || !aug || !D) return base;
  const bones = base.bones.map(b => ({ ...b })),
    by = Object.fromEntries(bones.map(b => [b.n, b]));
  for (const [slot, id] of Object.entries(aug)) {
    const P = D.parts[id],
      names = AUG_BONES(slot).filter(n => by[n]);
    if (!P || !names.length) continue;
    const pic = augPicture(P, view);
    if (!pic) return base; /* drawn plain until its picture loads, then asked for again (not kept) */
    const legs = P.slot === 'legs',
      own = names.map(n => by[n].img && by[n].img.c).find(Boolean),
      /* the size of the limb it replaces: the Billie's own picture's height, a little more */
      s = own ? Math.max(0.2, (own.height * 1.15) / pic.height) : 1,
      c = augScaled(pic, s),
      size = /** @type {[number, number]} */ ([pic.width, pic.height]),
      J = robotJoint(
        legs ? 'legs' : 'arm',
        P.art.joints,
        view,
        { front: size, back: size },
        { front: true, back: true }
      ),
      img = { ox: -Math.round(J.pivot[0] * s), oy: -Math.round(J.pivot[1] * s), c };
    if (legs && robotSingleLegs(P) && names.length > 1) {
      /* one piece under both hips: on the left leg's bone, moved to the middle; the right leg drawn by it */
      const L = by[names[0]],
        R = by[names[1]];
      L.img = { ...img, ox: img.ox + Math.round((R.at[0] - L.at[0]) / 2) };
      R.img = null;
    } else for (const n of names) by[n].img = img;
  }
  const out = { ...base, bones };
  return (RIG_PARTS_CACHE[key] = out);
}
/* ---- DOM animator: every <canvas class="rig"> on screen ---- */
const rigCanvasAnimator = { vis: new Set(), nodes: new Set(), io: null, mo: null, last: 0 };
/* a build as a short code for a data attribute ("MLSMM", in RULES.parts.slots order), and back */
export function buildCode(build) {
  if (!build || typeof RULES === 'undefined' || !RULES.parts) return '';
  return RULES.parts.slots.map(k => (/^[A-Z]{1,2}$/.test(build[k]) ? build[k] : 'M')[0]).join('');
}
function buildFromCode(code) {
  if (!code || typeof RULES === 'undefined' || !RULES.parts) return null;
  const out = {};
  RULES.parts.slots.forEach((k, i) => (out[k] = RULES.parts.sizes[code[i]] ? code[i] : 'M'));
  return out;
}
export function rigCanvasHTML(sp, size, o = {}) {
  const w = Math.round(size * 1.25),
    h = Math.round((w * RIG_CANVAS_SIZE.h) / RIG_CANVAS_SIZE.w),
    st = SPECIES[sp] ? (SPECIES[sp].rar === 'mythical' ? 2 : SPECIES[sp].stage) : 2,
    f = [1.3, 1.1, 1][st];
  return `<canvas class="rig${o.sil ? ' sil' : ''}" width="${RIG_CANVAS_SIZE.w * 2}" height="${RIG_CANVAS_SIZE.h * 2}" data-sp="${sp}"${o.coat ? ` data-coat="${o.coat}"` : ''} data-v="${o.view || 'front'}"${o.build ? ` data-b="${buildCode(o.build)}"` : ''}${o.graft ? ` data-g="${o.graft}"` : ''}${o.still || o.sil ? ' data-still="1"' : ''}${o.act ? ` data-act="${o.act}"` : ''} style="width:${w}px;height:${h}px;margin:${-Math.round((h - size) / 2)}px ${-Math.round((w - size) / 2)}px;transform:scale(${f});transform-origin:50% 94%" aria-hidden="true"></canvas>`;
}
/* v39: the 64x64 bust from a species' piece sheet (rig meta "portrait"), as an <img> cropped by CSS; falls back to the
   rest-pose rig for a species without one */
export function bustHTML(sp, size, o = {}) {
  const R = RIGS[sp] && RIGS[sp].front,
    pr = R && R.portrait,
    sh = R && R.sheet;
  if (!pr || !sh) return rigCanvasHTML(sp, size, o);
  const own = o.coat ? rigAtlas(sp, 'front', o.coat) : sh,
    url = own !== sh ? artURL(own) : o.coat ? coatAtlasURL(sh, sp, 'front', o.coat) : artURL(sh);
  const k = size / 64,
    [x, y, w, h] = pr,
    W = R.size ? R.size[0] : 512,
    H = R.size ? R.size[1] : 512;
  return `<span class="bust${o.sil ? ' sil' : ''}" style="width:${size}px;height:${size}px;background-image:url('${url}');background-position:${-x * k}px ${-y * k}px;background-size:${W * k}px ${H * k}px" aria-hidden="true"></span>`;
}
function drawDomRig(c, ts) {
  const sp = c.dataset.sp;
  if (!sp.startsWith('bot:') && !(SPECIES && SPECIES[sp])) return;
  const R = rigParts(sp, c.dataset.v === 'back' ? RIG_BACK_VIEW : 1, c.dataset.coat, c.dataset.g);
  if (!R) return;
  const x = c.getContext('2d');
  if (c._seed == null) {
    c._seed = random() * 6;
    if (c.dataset.act) c._act = { k: c.dataset.act, t0: ts };
  }
  x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  const a = c._act;
  let act = a && ts - a.t0 < 1100 ? a.k : null;
  const P = rigFrame(
    R,
    act,
    a ? ts - a.t0 : 0,
    c.dataset.still || reducedMotion ? 0 : Math.floor(ts / 50) * 50,
    c._seed
  );
  if (c.dataset.b) P.build = buildFromCode(c.dataset.b);
  if (R.BW === c.width && R.BH === c.height) drawRig(x, R, P, c.dataset.v);
  else {
    /* v36: a rig on another canvas size (the new 96/128 px sheets, k=1) is drawn to its own size, then placed with its base line on the box's base line at 2 px a pixel */
    const b = rigCanvasAnimator.buf || (rigCanvasAnimator.buf = makeCanvas(1, 1));
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
  rigCanvasAnimator.last = ts;
  if (!rigCanvasAnimator.mo) {
    if ('IntersectionObserver' in window)
      rigCanvasAnimator.io = new IntersectionObserver(es =>
        es.forEach(e => {
          if (e.isIntersecting) rigCanvasAnimator.vis.add(e.target);
          else rigCanvasAnimator.vis.delete(e.target);
        })
      );
    const scan = root => {
      if (!root.querySelectorAll) return;
      const list = [
        ...(root.matches && root.matches('canvas.rig') ? [root] : []),
        ...root.querySelectorAll('canvas.rig'),
      ];
      list.forEach(c => {
        if (rigCanvasAnimator.nodes.has(c)) return;
        rigCanvasAnimator.nodes.add(c);
        if (rigCanvasAnimator.io) rigCanvasAnimator.io.observe(c);
        else rigCanvasAnimator.vis.add(c);
      });
    };
    scan(document);
    if ('MutationObserver' in window) {
      rigCanvasAnimator.mo = new MutationObserver(es => es.forEach(e => e.addedNodes.forEach(scan)));
      rigCanvasAnimator.mo.observe(document.body, { childList: true, subtree: true });
    } else rigCanvasAnimator.mo = { fallback: scan };
  }
  if (rigCanvasAnimator.mo.fallback) rigCanvasAnimator.mo.fallback(document);
  for (const c of rigCanvasAnimator.nodes) {
    if (!c.isConnected) {
      rigCanvasAnimator.nodes.delete(c);
      rigCanvasAnimator.vis.delete(c);
      if (rigCanvasAnimator.io) rigCanvasAnimator.io.unobserve(c);
      continue;
    }
    if (!rigCanvasAnimator.vis.has(c)) continue;
    if ((!c.dataset.still && !reducedMotion) || !c._drawn) drawDomRig(c, ts);
  }
}
/* 0.1.0 alpha: the pose moves in 50 ms steps (drawDomRig), so 20 redraws a second show the same motion; it was 30-60,
   which cost a phone's menus for nothing */
frameTask('rig', rigTick, () => (activeBattle ? 4 : Math.min(20, userFps() / 2)));
document.addEventListener(
  'pointerdown',
  ev => {
    const card = ev.target.closest('button,.buddy,.slot,.dex,.enc');
    const c = card ? card.querySelector('canvas.rig') : ev.target.closest('canvas.rig');
    if (c && !c.dataset.still) c._act = { k: 'cheer', t0: performance.now() };
  },
  { passive: true }
);
