'use strict';
/* ================= ROBOT ART (phase 17, placeholder) =================
   A robot's picture, drawn from its parts' "art" in robots.json (a colour, a shape and a size), as a rig in the same
   form skeleton-rig.js makes from a Billie's piece sheet: bones (torso, head, armL, armR, legL, legR) with a picture
   each, on the biped body plan, so every place that draws a Billie (the battle stage, the team, the Studio) draws a
   robot too and it moves with the biped poses. A robot's sp names its gem and parts (logic/fighters.js robotSp), so
   the sp alone is enough. These are stand-ins until the modular low-poly parts of the art pipeline (phase 17 task 11):
   flat pixel shapes, 2 px outlines, one highlight and one shadow. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { robotJoint, robotJointComputed, robotSingleLegs } from './logic/robot-joints.js';
import { ART_CACHE, artImg, artReady, makeCanvas } from './art.js';
/* eslint-disable no-func-assign */
expose({
  ROBOT_ART_BASE: [() => ROBOT_ART_BASE],
  ROBOT_ART_SIZE: [() => ROBOT_ART_SIZE],
  ROBOT_PART_BONES: [() => ROBOT_PART_BONES],
  robotArmCanvas: [() => robotArmCanvas, v => (robotArmCanvas = v)],
  robotArtFiles: [() => robotArtFiles, v => (robotArtFiles = v)],
  robotArtParts: [() => robotArtParts, v => (robotArtParts = v)],
  robotBox: [() => robotBox, v => (robotBox = v)],
  robotCanvas: [() => robotCanvas],
  robotHeadCanvas: [() => robotHeadCanvas, v => (robotHeadCanvas = v)],
  robotLegsCanvas: [() => robotLegsCanvas, v => (robotLegsCanvas = v)],
  robotPic: [() => robotPic, v => (robotPic = v)],
  robotRig: [() => robotRig, v => (robotRig = v)],
  robotRound: [() => robotRound, v => (robotRound = v)],
  robotShade: [() => robotShade, v => (robotShade = v)],
  robotTorsoCanvas: [() => robotTorsoCanvas, v => (robotTorsoCanvas = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const ROBOT_ART_SIZE = 96,
  ROBOT_ART_BASE = 90;
/** a colour a share lighter (f > 0) or darker (f < 0) */
function robotShade(hex, f) {
  const n = parseInt(hex.slice(1), 16),
    ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return '#' + ch.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
/* a filled shape with a dark outline, a lit left edge and a shaded right edge */
function robotBox(x, c, l, t, w, h) {
  x.fillStyle = robotShade(c, -0.55);
  x.fillRect(l - 1, t - 1, w + 2, h + 2);
  x.fillStyle = c;
  x.fillRect(l, t, w, h);
  x.fillStyle = robotShade(c, 0.35);
  x.fillRect(l, t, Math.max(1, Math.round(w / 6)), h);
  x.fillRect(l, t, w, 1);
  x.fillStyle = robotShade(c, -0.25);
  x.fillRect(l + w - Math.max(1, Math.round(w / 6)), t, Math.max(1, Math.round(w / 6)), h);
}
/* a rounded body (rows inset at the corners) */
function robotRound(x, c, l, t, w, h) {
  for (let y = 0; y < h; y++) {
    const e = Math.min(y, h - 1 - y),
      inset = e < 3 ? 3 - e : 0;
    x.fillStyle = robotShade(c, -0.55);
    x.fillRect(l + inset - 1, t + y, w - inset * 2 + 2, 1);
  }
  for (let y = 1; y < h - 1; y++) {
    const e = Math.min(y, h - 1 - y),
      inset = e < 3 ? 3 - e : 0;
    x.fillStyle = y < h / 3 ? robotShade(c, 0.2) : y > (h * 2) / 3 ? robotShade(c, -0.2) : c;
    x.fillRect(l + inset, t + y, w - inset * 2, 1);
  }
}
const robotCanvas = (w, h) => {
  const c = makeCanvas(w, h),
    x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
};
/** the torso picture (with the gem on its chest) @returns {HTMLCanvasElement} */
function robotTorsoCanvas(P, gemColor) {
  const A = P.art,
    w = A.w || 28,
    h = A.h || 26,
    [c, x] = robotCanvas(w + 2, h + 2),
    col = A.color;
  if (A.shape === 'barrel') {
    robotRound(x, col, 1, 1, w, h);
    x.fillStyle = robotShade(col, -0.4);
    for (let y = 5; y < h - 3; y += 4) x.fillRect(4, y, w - 6, 1);
  } else if (A.shape === 'slim') {
    for (let y = 0; y < h; y++) {
      const inset = Math.round((y / h) * (w / 4));
      x.fillStyle = robotShade(col, -0.55);
      x.fillRect(inset, y + 1, w - inset * 2 + 2, 1);
      x.fillStyle = y < h / 3 ? robotShade(col, 0.25) : col;
      x.fillRect(inset + 1, y + 1, w - inset * 2, 1);
    }
    x.fillStyle = robotShade(col, 0.4);
    x.fillRect(1, 3, 2, 8);
    x.fillRect(w - 1, 3, 2, 8);
  } else {
    robotBox(x, col, 1, 1, w, h);
    x.fillStyle = robotShade(col, -0.45);
    for (const [px, py] of [
      [3, 3],
      [w - 3, 3],
      [3, h - 2],
      [w - 3, h - 2],
    ])
      x.fillRect(px, py, 1, 1);
  }
  /* the gem: a diamond on the chest */
  const gx = Math.round(w / 2) + 1,
    gy = Math.round(h / 2) - 1;
  x.fillStyle = robotShade(gemColor, -0.5);
  x.fillRect(gx - 3, gy - 1, 7, 3);
  x.fillRect(gx - 1, gy - 3, 3, 7);
  x.fillStyle = gemColor;
  x.fillRect(gx - 2, gy - 1, 5, 3);
  x.fillRect(gx - 1, gy - 2, 3, 5);
  x.fillStyle = robotShade(gemColor, 0.6);
  x.fillRect(gx - 1, gy - 1, 1, 1);
  return c;
}
/** the head picture, in the torso's colour, with a visor @returns {HTMLCanvasElement} */
function robotHeadCanvas(P, gemColor) {
  const col = P.art.color,
    w = P.art.shape === 'slim' ? 12 : 14,
    h = 11,
    [c, x] = robotCanvas(w + 2, h + 4);
  robotBox(x, col, 1, 3, w, h);
  x.fillStyle = robotShade(col, -0.55);
  x.fillRect(Math.round(w / 2), 0, 2, 3);
  x.fillStyle = gemColor;
  x.fillRect(Math.round(w / 2), 0, 2, 1);
  x.fillStyle = '#1A1C24';
  x.fillRect(3, 6, w - 4, 3);
  x.fillStyle = robotShade(gemColor, 0.3);
  x.fillRect(4, 7, 2, 1);
  x.fillRect(w - 4, 7, 2, 1);
  return c;
}
/** an arm: an upper arm, then the tool its shape names @returns {HTMLCanvasElement} */
function robotArmCanvas(P) {
  const A = P.art,
    w = A.w || 10,
    h = A.h || 20,
    [c, x] = robotCanvas(w + 2, h + 2),
    col = A.color,
    up = Math.round(h * 0.45),
    aw = Math.max(4, Math.round(w * 0.5)),
    ax = Math.round((w - aw) / 2) + 1;
  robotBox(x, robotShade(col, -0.1), ax, 1, aw, up);
  const t = up + 1,
    th = h - up;
  switch (A.shape) {
    case 'fist':
      robotBox(x, col, 1, t, w, th);
      x.fillStyle = robotShade(col, -0.4);
      for (let i = 1; i < 4; i++) x.fillRect(1 + Math.round((w * i) / 4), t + 1, 1, 3);
      break;
    case 'drill':
      for (let y = 0; y < th; y++) {
        const half = Math.max(0, Math.round(((th - y) / th) * (w / 2)));
        x.fillStyle = robotShade(col, -0.55);
        x.fillRect(w / 2 + 1 - half - 1, t + y, half * 2 + 2, 1);
        x.fillStyle = y % 3 === 0 ? robotShade(col, 0.35) : col;
        x.fillRect(w / 2 + 1 - half, t + y, half * 2, 1);
      }
      break;
    case 'claw':
      robotBox(x, col, 1, t, w, Math.round(th / 2));
      x.fillStyle = robotShade(col, -0.55);
      x.fillRect(1, t + Math.round(th / 2), 3, Math.round(th / 2));
      x.fillRect(w - 2, t + Math.round(th / 2), 3, Math.round(th / 2));
      x.fillStyle = col;
      x.fillRect(2, t + Math.round(th / 2), 1, Math.round(th / 2) - 1);
      x.fillRect(w - 1, t + Math.round(th / 2), 1, Math.round(th / 2) - 1);
      break;
    case 'coil':
      robotBox(x, robotShade(col, -0.2), ax, t, aw, th);
      x.fillStyle = col;
      for (let y = t + 1; y < t + th - 1; y += 3) x.fillRect(1, y, w, 2);
      x.fillStyle = robotShade(col, 0.6);
      x.fillRect(Math.round(w / 2), t + th - 1, 2, 2);
      break;
    default:
      /* cannon */
      robotBox(x, col, 1, t, w, th);
      x.fillStyle = '#16181F';
      x.fillRect(Math.round(w / 2) - 1, t + th - 3, 4, 3);
  }
  return c;
}
/** one leg (drawn for each side), or for treads and hover the whole undercarriage @returns {HTMLCanvasElement} */
function robotLegsCanvas(P) {
  const A = P.art,
    col = A.color,
    w = A.w || 26,
    h = A.h || 16;
  if (A.shape === 'treads') {
    const [c, x] = robotCanvas(w + 2, h + 2);
    robotRound(x, robotShade(col, -0.2), 1, 1, w, h);
    x.fillStyle = robotShade(col, 0.3);
    for (let i = 0; i < 4; i++) {
      const cx = 4 + Math.round(((w - 6) * i) / 3);
      x.fillRect(cx - 1, Math.round(h / 2) - 1, 3, 3);
    }
    x.fillStyle = robotShade(col, -0.6);
    for (let px = 2; px < w; px += 3) x.fillRect(px, h, 1, 1);
    return c;
  }
  if (A.shape === 'hover') {
    const [c, x] = robotCanvas(w + 2, h + 4);
    for (let y = 0; y < h; y++) {
      const inset = Math.round(((h - y) / h) * 4);
      x.fillStyle = robotShade(col, -0.55);
      x.fillRect(inset, y + 1, w - inset * 2 + 2, 1);
      x.fillStyle = y < h / 2 ? robotShade(col, 0.2) : col;
      x.fillRect(inset + 1, y + 1, w - inset * 2, 1);
    }
    x.fillStyle = robotShade(col, 0.7);
    x.fillRect(3, h + 1, w - 4, 1);
    x.globalAlpha = 0.5;
    x.fillRect(5, h + 2, w - 8, 1);
    return c;
  }
  /* legs: one leg, half the width */
  const lw = Math.max(5, Math.round(w / 2) - 3),
    [c, x] = robotCanvas(lw + 4, h + 2);
  robotBox(x, robotShade(col, -0.1), 2, 1, lw - 1, h - 4);
  robotBox(x, col, 1, h - 3, lw + 2, 3);
  return c;
}
/** the gem and parts named in a robot's sp, from robots.json D, or null */
function robotArtParts(sp, D) {
  const a = typeof sp === 'string' && sp.startsWith('bot:') ? sp.slice(4).split('.') : [];
  if (a.length !== 5 || !D || !D.parts || !D.gems) return null;
  const o = { G: D.gems[a[0]], T: D.parts[a[1]], AL: D.parts[a[2]], AR: D.parts[a[3]], L: D.parts[a[4]] };
  return o.G && o.T && o.AL && o.AR && o.L && o.T.art && o.AL.art && o.AR.art && o.L.art ? o : null;
}
/** the picture files a robot uses (to load before a battle) */
export function robotArtFiles(sp, D) {
  const o = robotArtParts(sp, D);
  if (!o) return [];
  const A = [o.T.art, o.AL.art, o.AR.art, o.L.art],
    out = [...A.flatMap(x => [x.img, x.imgB]), o.T.art.head, o.T.art.headB, o.G.img];
  return [...new Set(out.filter(Boolean))];
}
/* a picture from game/art when it has one and it has loaded; undefined while it loads; null when there is none */
function robotPic(path) {
  if (!path) return null;
  artImg(path);
  return artReady(path) ? ART_CACHE.img[path] : undefined;
}
/** a robot's rig from its sp ('bot:gem.torso.armL.armR.legs'), or null when the data lacks a part. D is robots.json;
 *  k is the view the rig is for (1 front, else back): its joints place the bones.
 *  Each part uses its picture (art.img / art.imgB, a torso's art.head / headB, the gem's img) and, without one, a
 *  stand-in drawn from its colour and shape. The pictures join at their joints (logic/robot-joints.js: stored in
 *  robots.json or worked out from the picture's size): the legs hang from the torso's hips (treads and hover from the
 *  middle one), the head's pivot sits on the neck, each arm hangs from its shoulder, the gem sits in the chest's
 *  socket; the torso stands so the legs' bottom is on the ground.
 *  wait is true while a picture is still loading (the caller draws the rig again later).
 *  The rig has the fields skeleton-rig.js rigParts returns (the caller adds anim). */
export function robotRig(sp, D, k = 1) {
  const o = robotArtParts(sp, D);
  if (!o) return null;
  const { G, T, AL, AR, L } = o;
  let wait = false;
  /* a part's front and back pictures, or the stand-in for both; own: which views draw the part's own picture */
  const pics = (front, back, make) => {
    const f = robotPic(front),
      b = robotPic(back);
    if (f === undefined || b === undefined) wait = true;
    const c = f || make();
    return { f: c, b: b || c, own: { front: !!f, back: !!b } };
  };
  const gemColor = G.color || '#FFFFFF',
    single = robotSingleLegs(L),
    view = k === 1 ? 'front' : 'back';
  const torso = pics(T.art.img, T.art.imgB, () => robotTorsoCanvas(T, gemColor)),
    head = pics(T.art.head, T.art.headB, () => robotHeadCanvas(T, gemColor)),
    armL = pics(AL.art.img, AL.art.imgB, () => robotArmCanvas(AL)),
    armR = pics(AR.art.img, AR.art.imgB, () => robotArmCanvas(AR)),
    leg = pics(L.art.img, L.art.imgB, () => robotLegsCanvas(L)),
    gemPic = robotPic(G.img);
  if (gemPic === undefined) wait = true;
  /* a piece's joint in a view, from its pictures' sizes */
  const joint = (piece, P, stored, v) =>
    robotJoint(piece, stored, v, { front: [P.f.width, P.f.height], back: [P.b.width, P.b.height] }, P.own);
  const J = v => ({
    torso: joint('torso', torso, T.art.joints, v),
    head: joint('head', head, T.art.headJoints, v),
    armL: joint('arm', armL, AL.art.joints, v),
    armR: joint('arm', armR, AR.art.joints, v),
    leg: joint('legs', leg, L.art.joints, v),
  });
  const F = J('front'),
    B = J('back'),
    V = view === 'front' ? F : B;
  /* the stand-in torso has its gem drawn in; a torso picture gets the gem's picture on its chest */
  const ownTorso = !!(T.art.img && torso.f !== undefined && robotPic(T.art.img)),
    tw = torso.f.width,
    /* a socket of the torso, from its pivot (the torso bone's origin), in the view the rig is for */
    at = (Jv, n) => [Jv.torso.sockets[n][0] - Jv.torso.pivot[0], Jv.torso.sockets[n][1] - Jv.torso.pivot[1]],
    /* how high the torso's pivot stands: the legs' bottom on the ground */
    lift = (Jv, legPic) =>
      -(Jv.torso.sockets[single ? 'hip' : 'hipL'][1] - Jv.torso.pivot[1] + legPic.height - Jv.leg.pivot[1]),
    /* a picture's offset from its bone: minus its pivot (0, not -0, at the edge) */
    off = p => [0 - p[0], 0 - p[1]],
    place = (P, j) => ({
      img: { ox: off(j.f.pivot)[0], oy: off(j.f.pivot)[1], c: P.f },
      imgB: { ox: off(j.b.pivot)[0], oy: off(j.b.pivot)[1], c: P.b },
      z: j.f.z,
      zb: j.b.z,
    }),
    of = n => ({ f: F[n], b: B[n] });
  const bones = [
    { n: 'torso', par: 'root', at: [0, lift(V, view === 'front' ? leg.f : leg.b)], ...place(torso, of('torso')) },
    { n: 'head', par: 'torso', at: at(V, 'neck'), ...place(head, of('head')) },
    { n: 'armL', par: 'torso', at: at(V, 'shoulderL'), ...place(armL, of('armL')) },
    { n: 'armR', par: 'torso', at: at(V, 'shoulderR'), ...place(armR, of('armR')) },
    { n: 'legL', par: 'torso', at: at(V, single ? 'hip' : 'hipL'), ...place(leg, of('leg')) },
    single
      ? { n: 'legR', par: 'torso', at: at(V, 'hip'), z: F.leg.z, zb: B.leg.z, img: null }
      : { n: 'legR', par: 'torso', at: at(V, 'hipR'), ...place(leg, of('leg')) },
  ];
  if (ownTorso && gemPic) {
    const g = robotJointComputed('gem', gemPic.width, gemPic.height);
    bones.push({
      n: 'gem',
      par: 'torso',
      at: at(V, 'gem'),
      z: g.z,
      zb: g.z,
      hideB: true,
      img: { ox: off(g.pivot)[0], oy: off(g.pivot)[1], c: gemPic },
    });
  }
  /* the top of the head (2 px of headroom), from the front view, so both views share it */
  const top = ROBOT_ART_BASE + lift(F, leg.f) + at(F, 'neck')[1] - F.head.pivot[1] - 2,
    hw = Math.max(tw / 2 + Math.max(armL.f.width, armR.f.width), leg.f.width / (single ? 2 : 1) + tw / 4);
  return {
    k: 1,
    BW: ROBOT_ART_SIZE,
    BH: ROBOT_ART_SIZE,
    cx: ROBOT_ART_SIZE / 2,
    base: ROBOT_ART_BASE,
    tipX: 0,
    plan: 'biped',
    q: { lift: 0, flapMs: 300 },
    geo: {
      cx: ROBOT_ART_SIZE / 2,
      base: ROBOT_ART_BASE,
      top,
      mid: (top + ROBOT_ART_BASE) / 2,
      hw,
      lift: 0,
      k: 1,
      cy: (top + ROBOT_ART_BASE) / 2,
    },
    bones,
    clock: 12,
    wait,
  };
}
/** which bones a broken robot part dims on the stage */
export const ROBOT_PART_BONES = { armL: ['armL'], armR: ['armR'], legs: ['legL', 'legR'] };
