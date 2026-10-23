'use strict';
/* ================= WALK CAMERA =================
   Phase 20 (stage B): the walking, battle and cutscene cameras, the screen ray, zoom and turn limits, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { reducedMotion, talkBox } from '../hooks.js';
import { clamp } from '../util.js';
import { roomToLocal, roomToWorld, roomYaw } from '../logic/room-turn.js';
import { cameraRiseNeeded } from '../logic/camera-rise.js';
import { blendGoals, followNew, followStep, leadStep, zoneMetres } from '../logic/camera-follow.js';
import { zoomShape } from '../logic/camera-zoom.js';
import { interestPick, zoneAt } from '../logic/camera-interest.js';
import { MOMENT_DIALS, momentNew, momentStep } from '../logic/camera-moments.js';
import { orbitStart, orbitStep, wrapAngle } from '../logic/camera-orbit.js';
import { BOB_M, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { matrix4 } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { groundHeightAt, standingHeightAt } from './heights.js';
import { interestPoints, landmarkTilt } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  battleCamera: [() => battleCamera, v => (battleCamera = v)],
  cameraTurnLimit: [() => cameraTurnLimit],
  clampZoom: [() => clampZoom],
  cutsceneCamera: [() => cutsceneCamera, v => (cutsceneCamera = v)],
  ease: [() => ease],
  followDirection: [() => followDirection, v => (followDirection = v)],
  freeCameraOn: [() => freeCameraOn],
  moments: [() => moments, v => (moments = v)],
  orbitOf: [() => orbitOf],
  screenRay: [() => screenRay, v => (screenRay = v)],
  walkCamera: [() => walkCamera, v => (walkCamera = v)],
  zoomEnds: [() => zoomEnds, v => (zoomEnds = v)],
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
/* CAM-1: an exact ease toward a value at `rate` a second, the same at any frame rate */
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
/* CAM-2: the zoom curve's ends (Engine > Camera > Zoom curve; logic/camera-zoom.js) */
function zoomEnds() {
  const set = k => engineSetting('camera', k);
  return {
    min: set('zoomMin'),
    max: set('zoomMax'),
    nearPitch: set('zoomNearPitch'),
    nearDist: set('zoomNearDist'),
    nearFov: set('zoomNearFov'),
    farPitch: set('zoomFarPitch'),
    farDist: set('zoomFarDist'),
    farFov: set('zoomFarFov'),
    curve: set('zoomCurve'),
  };
}
/* CAM-1: the way you push, on the ground (x, z; length 0-1): the joystick or d-pad, else the arrow keys, else the way
   you walk (tapping somewhere, the Studio's preview); none when standing, or moving faster than walking or running can
   (a jump to somewhere else) */
function followDirection(P, R, F, vx, vz, sp) {
  if (!P.walk || sp >= 12) return [0, 0];
  const J = walkView.stick,
    K = walkView.keys || {};
  let kx = (K.r ? 1 : 0) - (K.l ? 1 : 0),
    kz = (K.u ? 1 : 0) - (K.d ? 1 : 0),
    km = Math.hypot(kx, kz) ? 1 : 0;
  if (J && Math.hypot(J.x, J.y) > 0.12) {
    kx = J.x;
    kz = J.y;
    km = Math.min(1, Math.hypot(J.x, J.y));
  }
  if (km) {
    const l = Math.hypot(kx, kz) || 1;
    return [((kx * R[0] + kz * F[0]) / l) * km, ((kx * R[1] + kz * F[1]) / l) * km];
  }
  const vl = Math.hypot(vx, vz);
  return vl > 1e-4 ? [vx / vl, vz / vl] : [0, 0];
}
/* CAM-2: this frame's moment (logic/camera-moments.js), from what the walk knows: who talks to you (while the talk box
   is up), where a run's boss stands, the point of interest, whether you walk or run. A Studio preview's free camera has
   none unless it asks (walkView.opt.moments: the Engine preview) */
function moments(sc, P, push, I, dt, snap) {
  /* a new scene starts the moments afresh, but a boss already revealed stays so */
  if (!walkRenderer.mom || walkRenderer.mom.sc !== sc)
    walkRenderer.mom = { ...momentNew(), sc, seen: walkRenderer.mom ? walkRenderer.mom.seen : {} };
  const st = walkRenderer.mom,
    D = /** @type {any} */ ({});
  /* a cut starts the shot afresh: standing still counts from now */
  if (snap) st.still = 0;
  for (const k of Object.keys(MOMENT_DIALS)) D[k] = engineSetting('camera', k) ?? MOMENT_DIALS[k];
  /* who you talk to counts while the talk box is up (it opens a moment after the talk starts); once it is down they
     are forgotten, so a sign or a shop's box later isn't framed toward them */
  const ta = walkRenderer.talkAt;
  if (ta && !talkBox?.on && walkView.t - (ta.t ?? 0) > 1000) walkRenderer.talkAt = null;
  let talk = talkBox?.on && walkRenderer.talkAt && Math.hypot(ta.x - P.x, ta.z - P.z) < 12 ? [ta.x, ta.z] : null,
    boss = walkRenderer.bossAt,
    moving = !!(P.walk || P.route);
  const T = walkRenderer.momentTest;
  if (T && walkView.t > T.until) walkRenderer.momentTest = null;
  else if (T) {
    if (T.id === 'talk') talk = T.at;
    else if (T.id === 'boss') boss = { id: 'test:' + T.until, x: T.at[0], z: T.at[1] };
    else if (T.id === 'idle') {
      moving = false;
      st.still = Math.max(st.still, D.idleDelay);
    }
  }
  if ((freeCameraOn() && !walkView.opt.moments) || sc.indoor || sc.room) return { id: null, goals: [] };
  return momentStep(
    st,
    {
      px: P.x,
      pz: P.z,
      moving,
      running: !!P.running,
      dir: push,
      talk,
      boss,
      interest: I,
      reduced: !!reducedMotion,
    },
    D,
    dt
  );
}
export function walkCamera(rw, rh, st, dt) {
  const sc = walkView.sc,
    c = sc.cam || {},
    P = walkView.pl,
    set = k => engineSetting('camera', k),
    /* a cut: a new scene, a reset (camT = null), or a page asking for no glide */
    snap = !walkRenderer.camT || !walkRenderer.fol || !!walkView.opt.instant,
    feet = P.yv ?? standingHeightAt(P.x, P.z);
  /* island track IS-1: a turn kept from a map with a wider limit is brought inside the island's */
  if (orbitOf(sc)) walkRenderer.yawT = clamp(walkRenderer.yawT, -cameraTurnLimit(), cameraTurnLimit());
  walkRenderer.yaw += (walkRenderer.yawT - walkRenderer.yaw) * ease(5, dt);
  /* island track IS-1: on an island the camera's base yaw turns round the middle (logic/camera-orbit.js); your own turn
     (walkRenderer.yaw) is added on top. Elsewhere the base is 0, the north view. A new scene, a cut or a jump of
     more than 8 m starts the orbit where it belongs. */
  const O = orbitOf(sc);
  if (O) {
    let S = walkRenderer.orbit;
    const jump = S && Math.hypot(P.x - S.x, P.z - S.z) > 8;
    if (!S || S.sc !== sc || snap || jump) {
      S = walkRenderer.orbit = Object.assign(orbitStart(O, P.x, P.z, S && S.sc === sc ? S.yaw : 0), { sc });
    } else orbitStep(S, O, P.x, P.z, dt);
    S.x = P.x;
    S.z = P.z;
  } else walkRenderer.orbit = null;
  /* CAM-1: the base direction (the orbit's, else north) is "up the screen" for the follow, the look-ahead, the ground
     ahead and the landmark tilt. IS-5: in a room turned with its door the base looks in through the door
     (logic/room-turn.js roomYaw). Going in or out the base yaw eases the short way round over a moment instead of
     jumping (from the orbit's into the room's) */
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
  const bf = [Math.sin(baseYaw), Math.cos(baseYaw)],
    turn = wrapAngle(baseYaw + walkRenderer.yaw);
  walkRenderer.zoom += (walkRenderer.zoomT - walkRenderer.zoom) * ease(5, dt);
  if (snap) walkRenderer.fol = followNew(P.x, P.z, feet);
  const fol = walkRenderer.fol;
  const vx = P.x - (walkRenderer.px ?? P.x),
    vz = P.z - (walkRenderer.pz ?? P.z);
  walkRenderer.px = P.x;
  walkRenderer.pz = P.z;
  const sp = Math.hypot(vx, vz) / Math.max(dt, 1e-3),
    /* the screen's right and up, on the ground */
    R = [Math.cos(turn), -Math.sin(turn)],
    F = [-R[1], R[0]],
    push = followDirection(P, R, F, vx, vz, sp),
    lead = leadStep(fol, push, set('lead'), R, set('leadSide'), rh > rw, snap ? 0 : set('leadSmooth'), dt);
  const tk = set('tilt'),
    tilt = [
      (walkRenderer.tiltX + (walkRenderer.mouse ? walkRenderer.mouse[0] * 0.35 : 0)) * tk,
      (walkRenderer.tiltY + (walkRenderer.mouse ? walkRenderer.mouse[1] * 0.25 : 0)) * tk,
    ];
  const pitch0 = set('pitch') ?? (c.pitch || 34) + set('pitchAdd'),
    h0 = (set('height') ?? (c.h || 9)) * set('distance');
  /* v46: the camera's height and tilt glide when the scene's own change without a cut (into and out of a room laid
     into the place) */
  if (snap || !walkRenderer.cpe) walkRenderer.cpe = [pitch0, h0];
  {
    const e = ease(3.2, dt);
    walkRenderer.cpe[0] += (pitch0 - walkRenderer.cpe[0]) * e;
    walkRenderer.cpe[1] += (h0 - walkRenderer.cpe[1]) * e;
  }
  const pe = walkRenderer.cpe[0],
    he = walkRenderer.cpe[1];
  /* CAM-1: one camera goal. Each wish is a goal whose weight ramps in and out (logic/camera-follow.js blendGoals),
     blended into one tilt, turn, distance and aim: the phone's tilt and the mouse (at once), indoors 12 degrees more
     tilt, rising ground just ahead tilts down further (up to 9 degrees), a landmark ahead tilts up to look at it
     (v47, up to 11), a room laid into the place framed whole (v26) and the swoop into a battle (v31) */
  const ahead =
      groundHeightAt(
        clamp(P.x + bf[0] * 3.5, 0.5, Math.max(0.5, sc.w - 0.5)),
        Math.min(sc.h - 0.5, P.z + bf[1] * 3.5)
      ) - groundHeightAt(P.x, P.z),
    goals = [
      { id: 'tilt', w: 1, blend: 0, pitch: -tilt[1] * 3, yaw: tilt[0] * 0.07 },
      { id: 'indoor', w: sc.indoor ? 1 : 0, pitch: 12 },
      { id: 'ahead', w: clamp((ahead - 0.8) * 3.2, 0, 9) / 9, pitch: 9 },
      { id: 'landmark', w: landmarkTilt(P, sc, baseYaw) / 11, pitch: -11 },
    ];
  if (sc.room) {
    /* IS-5: worked out in the room's own metres (a room turned with its door), then put back in the place's */
    const Fr = sc.roomFrame,
      Rr = (Fr && Fr.rect) || sc.roomRect || [0, 0, sc.w, sc.h],
      rx = Rr[0] + Rr[2] / 2,
      rz = Rr[1] + Rr[3] * 0.55,
      Pl = roomToLocal(Fr, P.x, P.z),
      Tw = roomToWorld(Fr, rx + (Pl[0] - rx) * 0.25, rz + (Pl[1] - rz) * 0.15);
    goals.push({ id: 'room', w: 1, blend: 0.15, at: [Tw[0], Tw[1]] });
  }
  const visW = Math.min(sc.w * 0.95, Math.max(11, (rw / rh) * 15)) / ((c.fov || 1) * set('fov')),
    half = visW / 2,
    /* CAM-2: an aim point a little up the screen from (x, z), as the follow's own aim is */
    upAt = (x, z, k = rw > rh ? 2.0 : 1.0) => [x + bf[0] * k, z + bf[1] * k];
  /* CAM-2: the encounter shot: aims between you and the spot and zooms in (Engine > Camera > Encounter zoom), but
     never so far that you and the spot don't both fit */
  const S = walkRenderer.swoop;
  if (S) {
    let zs = S.zoom ?? 1;
    if (S.ex != null && zs < 1) {
      const need = (Math.hypot(S.ex - S.px, S.ez - S.pz) + 2.5) / 0.7 / visW;
      zs = Math.min(1, Math.max(zs, need / Math.max(0.1, walkRenderer.zoom)));
    }
    goals.push({ id: 'swoop', w: 1, blend: 0.15, at: upAt(S.x, S.z, rw > rh ? 1 : 0.5), zoom: zs });
  }
  /* CAM-2: after a battle the camera starts close and pulls back out (it was a jump of the zoom, v31) */
  if (walkRenderer.leaveAt != null) {
    const w = Math.exp(-Math.max(0, walkView.t - walkRenderer.leaveAt) / 200);
    if (w < 1e-3 || snap) walkRenderer.leaveAt = null;
    else goals.push({ id: 'leave', w, blend: 0, zoom: set('leaveZoom') });
  }
  /* CAM-2: the strongest point of interest near you (a landmark, a shop's, clinic's, lab's or ranch's door) leans the
     aim toward it (no more than Engine > Camera > Interest: most lean) and zooms a little */
  const I = !sc.indoor && !sc.room && set('intOn') ? interestPick(interestPoints(sc), P.x, P.z, set('intPull')) : null;
  /* CAM-2: the moments (logic/camera-moments.js): talking, a run's boss, a point of interest, standing still,
     running; at most one at a time. The Studio's "Play moment" stands in for the real thing (walkRenderer.momentTest) */
  const M = moments(sc, P, push, I, dt, snap);
  /* CAM-2: a camera zone you stand in (the scene's camZones, placed in the Studio's Walk scenes editor) */
  const zi = freeCameraOn() && !walkView.opt.moments ? -1 : zoneAt(sc.camZones, P.x, P.z);
  if (zi >= 0) {
    const Zn = sc.camZones[zi],
      off = Zn.at && (Zn.at[0] || Zn.at[1]) ? Zn.at : null;
    goals.push({
      id: 'zone:' + zi,
      w: 1,
      blend: Zn.blend,
      pitch: Zn.tilt || 0,
      zoom: Zn.zoom || 1,
      at: off ? upAt(P.x + off[0], P.z + off[1]) : undefined,
    });
  }
  for (const g of M.goals) {
    if (g.at) g.at = upAt(g.at[0], g.at[1]);
    goals.push(g);
  }
  const G = blendGoals(fol, goals, dt, set('blend'), snap);
  /* CAM-2: one zoom (your pinch times the goals') drives the tilt, distance and field of view along their curves */
  const zoomEff = clamp(
      walkRenderer.zoom * G.zoom,
      Math.min(0.3, walkRenderer.zoom),
      Math.max(walkRenderer.zoom, set('zoomMax') * 1.25)
    ),
    Z = zoomShape(zoomEff, zoomEnds());
  const pitchDeg0 = pe + Z.pitch + G.pitch,
    yaw = wrapAngle(turn + G.yaw);
  let df = (he / Math.sin((pe * Math.PI) / 180)) * Z.dist * G.dist;
  /* terrain TR-3: on tall ground the camera tilts down further (and comes a little closer) until the line from it to
    your head clears the rock between you; it rises quickly and settles back slowly (its own ramp, kept as it was) */
  const tall = !(sc.indoor || sc.room || freeCameraOn()),
    riseMax = tall ? +set('rise') || 0 : 0,
    need = tall
      ? cameraRiseNeeded(
          standingHeightAt,
          P.x,
          P.z,
          feet,
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
  if (snap || walkRenderer.rockK == null) walkRenderer.rockK = rockT;
  else walkRenderer.rockK += (rockT - walkRenderer.rockK) * Math.min(1, dt * 3);
  if (snap || walkRenderer.occT == null) walkRenderer.occT = riseT;
  else walkRenderer.occT += (riseT - walkRenderer.occT) * Math.min(1, dt * (riseT > walkRenderer.occT ? 2.6 : 1.1));
  const occ = walkRenderer.occT,
    pitch = ((pitchDeg0 + occ) * Math.PI) / 180;
  if (riseMax) df *= 1 - 0.15 * Math.min(1, occ / riseMax);
  /* the aim: you and the look-ahead, kept inside the scene, a little up the screen; pulled toward the goals' points.
     IS-1: an orbiting camera is not held inside the scene, the sea runs on past its edges */
  let gx = P.x + lead[0],
    gz = P.z + lead[1];
  const up = rw > rh ? 2.0 : 1.0;
  if (O) {
    gx += bf[0] * up;
    gz += bf[1] * up;
  } else {
    gx = sc.w > visW ? clamp(gx, half - 2, sc.w - half + 2) : sc.w / 2;
    gz = clamp(gz, 0, sc.h - 2) + up;
  }
  if (G.at) {
    gx += (G.at[0] - gx) * G.atW;
    gz += (G.at[1] - gz) * G.atW;
  }
  /* CAM-1: the follow (logic/camera-follow.js): dead and soft zones as shares of the screen, a critically damped
     spring. camT is its aim, so whatever moves or resets camT (a room's door, the seamless world's re-anchor) moves it */
  const shown = visW * Z.dist * Z.fov,
    dead = zoneMetres(set('deadW'), set('deadH'), shown, rw, rh, pitch),
    soft = zoneMetres(set('softW'), set('softH'), shown, rw, rh, pitch);
  if (snap) walkRenderer.camT = [gx, gz, feet];
  [fol.x, fol.z, fol.y] = walkRenderer.camT;
  followStep(
    fol,
    {
      gx,
      gz,
      gy: feet,
      right: R,
      dead,
      soft,
      smooth: snap ? 0 : set('smooth'),
      band: set('band'),
      moving: !!P.walk,
      free: 1 - G.atW,
    },
    dt
  );
  const T = (walkRenderer.camT = [fol.x, fol.z, fol.y]);
  /* CAM-2: the encounter shot has arrived once the swoop is in full and the camera is on its aim */
  if (S) S.arrived = (fol.w.swoop ?? 0) >= 0.95 && Math.hypot(T[0] - gx, T[1] - gz) < 0.2;
  /* CAM-1: what the camera is doing, for the debug log and the Studio's guides */
  walkRenderer.camInfo = {
    mode: freeCameraOn()
      ? 'free'
      : walkRenderer.swoop
        ? 'swoop'
        : O
          ? 'orbit'
          : sc.room
            ? 'room'
            : sc.indoor
              ? 'indoor'
              : 'walk',
    zoom: zoomEff,
    interest: I ? [I.n, I.w, I.at[0], I.at[1]] : null,
    moment: M.id,
    zone: zi,
    goals: G.list,
    goal: [gx, gz],
    lead: [lead[0], lead[1]],
    dead,
    soft,
    right: R,
    move: fol.move,
  };
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
  if (engineSetting('camera', 'pixelGrid') && !P.walk && !P.route && !walkRenderer.swoop && !reducedMotion) {
    const g = 1 / 32,
      sn = v => Math.round(v / g) * g,
      dx = sn(tgt[0]) - tgt[0],
      dz = sn(tgt[2]) - tgt[2];
    if (Math.abs(dx) < g && Math.abs(dz) < g) {
      tgt = [tgt[0] + dx, sn(tgt[1]), tgt[2] + dz];
    }
  }
  const eye = [tgt[0] - f[0] * df, tgt[1] - f[1] * df, tgt[2] - f[2] * df];
  const hfov = Math.min(1.3, 2 * Math.atan((visW * Z.dist) / 2 / df) * Z.fov),
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
