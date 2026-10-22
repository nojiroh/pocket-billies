'use strict';
/* ================= WALK CAMERA =================
   Phase 20 (stage B): the walking, battle and cutscene cameras, the screen ray, zoom and turn limits, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { reducedMotion } from '../hooks.js';
import { clamp } from '../util.js';
import { roomToLocal, roomToWorld, roomYaw } from '../logic/room-turn.js';
import { cameraRiseNeeded } from '../logic/camera-rise.js';
import { orbitStart, orbitStep, wrapAngle } from '../logic/camera-orbit.js';
import { BOB_M, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { matrix4 } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { groundHeightAt, standingHeightAt } from './heights.js';
import { landmarkTilt } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  battleCamera: [() => battleCamera, v => (battleCamera = v)],
  cameraTurnLimit: [() => cameraTurnLimit],
  clampZoom: [() => clampZoom],
  cutsceneCamera: [() => cutsceneCamera, v => (cutsceneCamera = v)],
  freeCameraOn: [() => freeCameraOn],
  orbitOf: [() => orbitOf],
  screenRay: [() => screenRay, v => (screenRay = v)],
  walkCamera: [() => walkCamera, v => (walkCamera = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export function screenRay(C, sx, sy) {
  const nx = (sx / C.rw) * 2 - 1,
    ny = 1 - (sy / C.rh) * 2,
    inv = C.ivp,
    P = (a, b, c) => {
      const x = inv[0] * a + inv[4] * b + inv[8] * c + inv[12],
        y = inv[1] * a + inv[5] * b + inv[9] * c + inv[13],
        z = inv[2] * a + inv[6] * b + inv[10] * c + inv[14],
        w = inv[3] * a + inv[7] * b + inv[11] * c + inv[15];
      return [x / w, y / w, z / w];
    };
  const p0 = P(nx, ny, -1),
    p1 = P(nx, ny, 1),
    d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]],
    l = Math.hypot(...d);
  return { o: p0, d: d.map(v => v / l) };
}
/* ---------- input: taps (focus follows them), two-finger turn and pinch, Ctrl+wheel zoom, Q/E/R, phone tilt ---------- */
/* alpha 0.4.1: a preview that asks for a free camera (the Studio's) turns all the way round, zooms further and zooms with the plain wheel */
/* island track IS-1: the map's orbit (cam.orbit) when the walking camera turns round it: outdoors, not in a room, not the
   Studio's free camera, Engine > Camera > Orbit on */
export const orbitOf = sc =>
    sc &&
    sc.cam &&
    sc.cam.orbit &&
    Array.isArray(sc.cam.orbit.c) &&
    !sc.indoor &&
    !sc.room &&
    !freeCameraOn() &&
    engineSetting('camera', 'orbit') !== false
      ? sc.cam.orbit
      : null,
  freeCameraOn = () => !!(walkView.opt && walkView.opt.freeCam),
  /* while orbiting, your own turn on top of the orbit is the map's `turn` */
  cameraTurnLimit = () => {
    if (freeCameraOn()) return Math.PI;
    const O = orbitOf(walkView.sc);
    return ((O && O.turn != null ? +O.turn : engineSetting('camera', 'turn')) * Math.PI) / 180;
  },
  clampZoom = v =>
    freeCameraOn()
      ? clamp(v, 0.3, 3.2)
      : clamp(v, engineSetting('camera', 'zoomMin'), engineSetting('camera', 'zoomMax'));
/* ---------- camera ---------- */
export function walkCamera(rw, rh, st, dt) {
  const sc = walkView.sc,
    c = sc.cam || {},
    P = walkView.pl,
    k = Math.min(1, dt * 3.2);
  /* island track IS-1: a turn kept from a map with a wider limit is brought inside the island's */
  if (orbitOf(sc)) walkRenderer.yawT = clamp(walkRenderer.yawT, -cameraTurnLimit(), cameraTurnLimit());
  walkRenderer.yaw += (walkRenderer.yawT - walkRenderer.yaw) * Math.min(1, dt * 5);
  /* island track IS-1: on an island the camera's base yaw turns round the middle (logic/camera-orbit.js); your own turn
     (walkRenderer.yaw) is added on top. Elsewhere the base is 0, the north view. A new scene, a cut or a jump of
     more than 8 m starts the orbit where it belongs. */
  const O = orbitOf(sc);
  if (O) {
    let S = walkRenderer.orbit;
    const jump = S && Math.hypot(P.x - S.x, P.z - S.z) > 8;
    if (!S || S.sc !== sc || !walkRenderer.camT || walkView.opt.instant || jump) {
      S = walkRenderer.orbit = Object.assign(orbitStart(O, P.x, P.z, S && S.sc === sc ? S.yaw : 0), { sc });
    } else orbitStep(S, O, P.x, P.z, dt);
    S.x = P.x;
    S.z = P.z;
  } else walkRenderer.orbit = null;
  /* IS-5: in a room turned with its door the base looks in through the door (logic/room-turn.js roomYaw). Going in
     or out the base yaw eases the short way round over a moment instead of jumping (from the orbit's into the room's) */
  const yaw0 = O ? wrapAngle(walkRenderer.orbit.yaw) : sc.room ? wrapAngle(roomYaw(sc.roomFrame)) : 0;
  let baseYaw = yaw0;
  {
    const E = walkRenderer.baseEase;
    const now = performance.now();
    if (E && E.sc !== sc && !walkView.opt.instant && walkRenderer.camT && Math.abs(wrapAngle(yaw0 - E.yaw)) > 0.02)
      walkRenderer.baseEase = { sc, from: E.yaw, t: 0, t0: now, yaw: E.yaw };
    else if (!E || E.sc !== sc) walkRenderer.baseEase = { sc, from: yaw0, t: 1, t0: now, yaw: yaw0 };
    const B = walkRenderer.baseEase;
    if (B.t < 1) {
      B.t = Math.min(1, (now - B.t0) / 700);
      const e = B.t * B.t * (3 - 2 * B.t);
      baseYaw = wrapAngle(B.from + wrapAngle(yaw0 - B.from) * e);
    }
    B.yaw = baseYaw;
  }
  const bf = [Math.sin(baseYaw), Math.cos(baseYaw)];
  walkRenderer.zoom += (walkRenderer.zoomT - walkRenderer.zoom) * Math.min(1, dt * 5);
  const vx = P.x - (walkRenderer.px ?? P.x),
    vz = P.z - (walkRenderer.pz ?? P.z);
  walkRenderer.px = P.x;
  walkRenderer.pz = P.z;
  const sp = Math.hypot(vx, vz) / Math.max(dt, 1e-3),
    ld = P.walk && sp < 12 ? engineSetting('camera', 'lead') : 0,
    vl = Math.max(1e-4, Math.hypot(vx, vz));
  walkRenderer.lead[0] += ((ld ? (vx / vl) * ld : 0) - walkRenderer.lead[0]) * Math.min(1, dt * 1.6);
  walkRenderer.lead[1] += ((ld ? (vz / vl) * ld : 0) - walkRenderer.lead[1]) * Math.min(1, dt * 1.6);
  const tk = engineSetting('camera', 'tilt'),
    tilt = [
      (walkRenderer.tiltX + (walkRenderer.mouse ? walkRenderer.mouse[0] * 0.35 : 0)) * tk,
      (walkRenderer.tiltY + (walkRenderer.mouse ? walkRenderer.mouse[1] * 0.25 : 0)) * tk,
    ];
  const pitch0 = engineSetting('camera', 'pitch') ?? (c.pitch || 34) + engineSetting('camera', 'pitchAdd'),
    h0 = (engineSetting('camera', 'height') ?? (c.h || 9)) * engineSetting('camera', 'distance');
  const hb =
    groundHeightAt(clamp(P.x + bf[0] * 3.5, 0.5, Math.max(0.5, sc.w - 0.5)), Math.min(sc.h - 0.5, P.z + bf[1] * 3.5)) -
    groundHeightAt(P.x, P.z);
  walkRenderer.upT =
    (walkRenderer.upT || 0) + (clamp((hb - 0.8) * 3.2, 0, 9) - (walkRenderer.upT || 0)) * Math.min(1, dt * 2);
  /* v47: the camera looks up at a landmark ahead of you (landmarkTilt), and settles back as you pass */
  walkRenderer.lmT =
    (walkRenderer.lmT || 0) + (landmarkTilt(P, sc, baseYaw) - (walkRenderer.lmT || 0)) * Math.min(1, dt * 2.4);
  /* v46: the camera's height and tilt glide when they change without a cut (into and out of a room laid into the place) */
  if (!walkRenderer.camT || !walkRenderer.cpe || walkView.opt.instant)
    walkRenderer.cpe = [pitch0 + (sc.indoor ? 12 : 0), h0];
  {
    const e = Math.min(1, dt * 3.2);
    walkRenderer.cpe[0] += (pitch0 + (sc.indoor ? 12 : 0) - walkRenderer.cpe[0]) * e;
    walkRenderer.cpe[1] += (h0 - walkRenderer.cpe[1]) * e;
  }
  const pe = walkRenderer.cpe[0],
    he = walkRenderer.cpe[1];
  const pitchDeg0 = pe + (walkRenderer.zoom - 1) * 14 - tilt[1] * 3 + walkRenderer.upT - walkRenderer.lmT,
    yaw = wrapAngle(baseYaw + walkRenderer.yaw + tilt[0] * 0.07);
  let df = (he / Math.sin(((pe - (sc.indoor ? 12 : 0)) * Math.PI) / 180)) * walkRenderer.zoom;
  /* terrain TR-3: on tall ground the camera tilts down further (and comes a little closer) until the line from it to
    your head clears the rock between you; it rises quickly and settles back slowly */
  const tall = !(sc.indoor || sc.room || freeCameraOn() || st.focus),
    riseMax = tall ? +engineSetting('camera', 'rise') || 0 : 0,
    need = tall
      ? cameraRiseNeeded(
          standingHeightAt,
          P.x,
          P.z,
          P.yv ?? standingHeightAt(P.x, P.z),
          yaw,
          pitchDeg0,
          Math.cos((pitchDeg0 * Math.PI) / 180) * df,
          90
        )
      : 0,
    riseT = Math.min(need, riseMax);
  /* terrain TR-3: while ground cuts the line (by more than half a degree) the rock between you and the camera thins
    out (draw-common.js rockUniformsFor); it comes and goes over about a third of a second */
  const rockT = need > 0.5 ? 1 : 0;
  if (!walkRenderer.camT || walkView.opt.instant || walkRenderer.rockK == null) walkRenderer.rockK = rockT;
  else walkRenderer.rockK += (rockT - walkRenderer.rockK) * Math.min(1, dt * 3);
  if (!walkRenderer.camT || walkView.opt.instant || walkRenderer.occT == null) walkRenderer.occT = riseT;
  else walkRenderer.occT += (riseT - walkRenderer.occT) * Math.min(1, dt * (riseT > walkRenderer.occT ? 2.6 : 1.1));
  const occ = walkRenderer.occT,
    pitch = ((pitchDeg0 + occ) * Math.PI) / 180;
  if (riseMax) df *= 1 - 0.15 * Math.min(1, occ / riseMax);
  const visW = Math.min(sc.w * 0.95, Math.max(11, (rw / rh) * 15)) / ((c.fov || 1) * engineSetting('camera', 'fov')),
    half = visW / 2;
  let tx = P.x + walkRenderer.lead[0],
    tz = P.z + walkRenderer.lead[1];
  /* the view leans a little ahead of you (up the screen); IS-1: an orbiting camera is not held inside the scene, the
     sea runs on past its edges */
  const ahead = rw > rh ? 2.0 : 1.0;
  if (O) {
    tx += bf[0] * ahead;
    tz += bf[1] * ahead;
  } else {
    tx = sc.w > visW ? clamp(tx, half - 2, sc.w - half + 2) : sc.w / 2;
    tz = clamp(tz, 0, sc.h - 2) + ahead;
  }
  if (sc.room) {
    /* IS-5: worked out in the room's own metres (a room turned with its door), then put back in the place's */
    const F = sc.roomFrame,
      Rr = (F && F.rect) || sc.roomRect || [0, 0, sc.w, sc.h],
      rx = Rr[0] + Rr[2] / 2,
      rz = Rr[1] + Rr[3] * 0.55,
      Pl = roomToLocal(F, P.x, P.z),
      Tw = roomToWorld(F, rx + (Pl[0] - rx) * 0.25, rz + (Pl[1] - rz) * 0.15);
    tx = Tw[0];
    tz = Tw[1];
  } /* v26: a room stays framed whole */
  if (st.focus) {
    tx = st.focus.x;
    tz = st.focus.z;
  }
  if (walkRenderer.swoop) {
    const sa = rw > rh ? 1 : 0.5;
    tx = walkRenderer.swoop.x + bf[0] * sa;
    tz = walkRenderer.swoop.z + bf[1] * sa;
  }
  if (!walkRenderer.camT || walkView.opt.instant) walkRenderer.camT = [tx, tz, standingHeightAt(tx, tz)];
  const T = walkRenderer.camT;
  T[0] += (tx - T[0]) * k;
  T[1] += (tz - T[1]) * k;
  T[2] += ((P.yv ?? standingHeightAt(P.x, P.z)) - T[2]) * k;
  /* indoors the camera stays inside the room: never farther back than just past the near wall */
  if (sc.indoor && !sc.room) {
    const back = Math.cos(pitch) * df,
      room = T[1] + 1.2;
    if (back > room) df = Math.max(4, room / Math.cos(pitch));
  }
  const bob = P.walk && !reducedMotion ? Math.sin((P.gait || 0) / BOB_M) * 0.025 * engineSetting('camera', 'sway') : 0,
    f = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  let tgt = [T[0], T[2] + bob, T[1]];
  /* v35: pixel-grid camera (Engine > Camera > Pixel grid, off until the new art): when you stand still the camera
    target settles onto the art grid (1/32 m), so still pictures sit on whole pixels and don't shimmer */
  if (
    engineSetting('camera', 'pixelGrid') &&
    !P.walk &&
    !P.route &&
    !st.focus &&
    !walkRenderer.swoop &&
    !reducedMotion
  ) {
    const g = 1 / 32,
      sn = v => Math.round(v / g) * g,
      dx = sn(tgt[0]) - tgt[0],
      dz = sn(tgt[2]) - tgt[2];
    if (Math.abs(dx) < g && Math.abs(dz) < g) {
      tgt = [tgt[0] + dx, sn(tgt[1]), tgt[2] + dz];
    }
  }
  const eye = [tgt[0] - f[0] * df, tgt[1] - f[1] * df, tgt[2] - f[2] * df];
  const hfov = Math.min(1.3, 2 * Math.atan((visW * walkRenderer.zoom) / 2 / df)),
    vfov = 2 * Math.atan((Math.tan(hfov / 2) * rh) / rw);
  const proj = matrix4.persp(vfov, rw / rh, 0.5, 420);
  proj[0] = -proj[0];
  const view = matrix4.look(eye, tgt, [0, 1, 0]),
    vp = matrix4.mul(proj, view);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
    back = [-Math.sin(yaw), 0, -Math.cos(yaw)],
    fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  return {
    gl: 1,
    rw,
    rh,
    vp,
    ivp: matrix4.inv(vp),
    eye,
    tgt,
    right,
    back,
    fwd,
    F: rh / 2 / Math.tan(vfov / 2),
    df,
    near: 0.5,
    far: 420,
    sp: Math.sin(pitch),
    cp: Math.cos(pitch),
    yaw,
    occ,
    rockK: walkRenderer.rockK,
  };
}
/* the battle stage's camera (battle-stage.js battleStageProjectWith) as a matrix: a level pinhole camera with an off-center horizon, in stage pixels */
export function battleCamera(rw, rh, BT) {
  const c = BT.cam,
    L = BT.L,
    O = BT.off,
    ex = c.x + O[0],
    ez = c.z + O[1],
    ey = Math.max(BT.gy + c.y, standingHeightAt(ex, ez) + 0.4),
    e = [ex, ey, ez],
    cs = Math.cos(c.yaw),
    sn = Math.sin(c.yaw),
    r = [cs, 0, -sn],
    f = [sn, 0, cs];
  const n = 0.3,
    fa = 420,
    A = (fa + n) / (fa - n),
    B = (-2 * fa * n) / (fa - n),
    ax = (2 * BT.foc) / L.LW,
    bx = (2 * L.cx) / L.LW - 1,
    ay = (2 * BT.foc) / L.LH,
    by = 1 - (2 * (L.h0 + c.hz)) / L.LH,
    re = r[0] * ex + r[2] * ez,
    fe = f[0] * ex + f[2] * ez;
  const m = new Float32Array(16),
    set = (row, a, b, cc, d) => {
      m[row] = a;
      m[4 + row] = b;
      m[8 + row] = cc;
      m[12 + row] = d;
    };
  set(0, ax * r[0] + bx * f[0], 0, ax * r[2] + bx * f[2], -(ax * re + bx * fe));
  set(1, by * f[0], ay, by * f[2], -ay * ey - by * fe);
  set(2, A * f[0], 0, A * f[2], -A * fe + B);
  set(3, f[0], 0, f[2], -fe);
  return {
    gl: 1,
    rw,
    rh,
    vp: m,
    ivp: matrix4.inv(m),
    eye: e,
    tgt: [ex + f[0] * 4, ey, ez + f[2] * 4],
    right: r,
    back: [-f[0], 0, -f[2]],
    fwd: f,
    F: (BT.foc * rh) / L.LH,
    df: 4,
    near: n,
    far: fa,
    sp: 0,
    cp: 1,
    yaw: c.yaw,
  };
}
/* a free camera for cutscenes: eye, target and vertical field of view in degrees */
export function cutsceneCamera(rw, rh, K) {
  const eye = K.eye.slice(),
    tgt = K.tgt.slice(),
    df = Math.hypot(tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]) || 1,
    vfov0 = ((K.fov || 40) * Math.PI) / 180,
    vfov = K.w ? Math.max(vfov0, 2 * Math.atan(((K.w / 2 / df) * rh) / rw)) : vfov0;
  const proj = matrix4.persp(vfov, rw / rh, 0.3, 420);
  proj[0] = -proj[0];
  const view = matrix4.look(eye, tgt, [0, 1, 0]),
    vp = matrix4.mul(proj, view),
    yaw = Math.atan2(tgt[0] - eye[0], tgt[2] - eye[2]),
    pitch = Math.asin(clamp((eye[1] - tgt[1]) / df, -1, 1));
  return {
    gl: 1,
    rw,
    rh,
    vp,
    ivp: matrix4.inv(vp),
    eye,
    tgt,
    right: [Math.cos(yaw), 0, -Math.sin(yaw)],
    back: [-Math.sin(yaw), 0, -Math.cos(yaw)],
    fwd: [Math.sin(yaw), 0, Math.cos(yaw)],
    F: rh / 2 / Math.tan(vfov / 2),
    df: Math.max(16, df),
    near: 0.3,
    far: 420,
    sp: Math.sin(pitch),
    cp: Math.cos(pitch),
    yaw,
  };
}
