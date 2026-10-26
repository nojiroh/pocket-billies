'use strict';
/* ================= WALK LIGHTING =================
   Phase 20 (stage B): a place's sun, room dimming, lit lamps and windows, and the frame's light context, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { buildingState, frontWindowLight, litWindowFraction } from '../hooks.js';
import { placedTurn, propTurn, turnedPoint } from '../logic/prop-turn.js';
import { nearestFirst, pooledQuad } from '../engine/frame-lists.js';
import { hexToRgb } from '../art.js';
import { hash2d, walkView } from '../walk-view.js';
import { ENGINE_DEFAULTS, engineContext, engineSetting } from '../engine/settings.js';
import { normalize3, smooth01 } from '../engine/webgl.js';
import { lightContext, pickPointLights } from '../engine/light.js';
import { LIGHT_KIND, lightPicker, pickStableLights } from '../engine/light-pick.js';
import { environment, environmentHaze, environmentWindowLit } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { worldCurveArgs, worldCurveDrop } from './draw-common.js';
import { computeFrustum, inFrustum } from './quality-cull.js';
import { skyColors } from './sky.js';
import { roomLights, roomSkyLight } from './rooms.js';
/* eslint-disable no-func-assign */
expose({
  AO_ALL: [() => AO_ALL],
  AO_NEAR: [() => AO_NEAR],
  AO_POOL: [() => AO_POOL],
  BATTLE_LIGHT_PICK: [() => BATTLE_LIGHT_PICK],
  LIGHT_PICK: [() => LIGHT_PICK],
  PHONE_LAMPS: [() => PHONE_LAMPS],
  ROOM_DIM: [() => ROOM_DIM],
  lampLit: [() => lampLit, v => (lampLit = v)],
  lightFrustum: [() => lightFrustum, v => (lightFrustum = v)],
  lightInView: [() => lightInView],
  mapSun: [() => mapSun, v => (mapSun = v)],
  modelWindowLight: [() => modelWindowLight, v => (modelWindowLight = v)],
  pickLights: [() => pickLights, v => (pickLights = v)],
  roomDimming: [() => roomDimming, v => (roomDimming = v)],
  walkLightContext: [() => walkLightContext, v => (walkLightContext = v)],
  windowLit: [() => windowLit, v => (windowLit = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the light context: sky ambient, fog, mist, shadows, contact shadows and the nearest lamps, windows and fires */
/* v43: the light that stands in for the sun in a room: daylight through the windows, from the front at a slant (roomSkyLight
   says how bright and from which side), so shadows fall into the room; it is what the shadow maps are drawn from too */
export function mapSun(sc, sun) {
  if (!sc || !sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return sun;
  const Rk = roomSkyLight(),
    wd = normalize3([Rk.dx * 0.45, 0.6, -0.7]);
  return Object.assign({}, sun, {
    dir: wd,
    travel: [-wd[0], -wd[1], -wd[2]],
    col: Rk.c.map(
      v =>
        v *
        Math.max(0.25, Rk.I) *
        0.3 *
        (engineSetting('lights', 'windowLight') ?? 1) *
        engineSetting('sun', 'strength')
    ),
    indoor: true,
    room: true,
  });
}
/* v46: inside a building laid into the place (seamless-world.js seamlessRoomMap) the town around the room dims over 0.6 s; walking
   out it brightens again over 0.7 s, as your eyes adjust */
const ROOM_DIM = 0.68; /* how far the place round a room dims */
export function roomDimming(sc) {
  const now = performance.now(),
    k0 = ROOM_DIM;
  let R = sc.roomRect,
    k = 0;
  if (R) {
    if (walkRenderer.roomIn !== sc.id) {
      walkRenderer.roomIn = sc.id;
      walkRenderer.roomT0 = now;
      walkRenderer.roomLast = R;
      walkRenderer.roomOutT = 0;
    }
    k = smooth01((now - walkRenderer.roomT0) / 600);
  } else if (walkRenderer.roomIn) {
    walkRenderer.roomIn = null;
    walkRenderer.roomOutT = now;
  }
  if (!R && walkRenderer.roomOutT && walkRenderer.roomLast) {
    const t = (now - walkRenderer.roomOutT) / 700;
    if (t < 1) {
      R = walkRenderer.roomLast;
      k = (1 - smooth01(t)) * 0.7;
    } else walkRenderer.roomOutT = 0;
  }
  return R && k > 0 ? { b: [R[0], R[1], R[0] + R[2], R[1] + R[3]], dim: k0 * k } : null;
}
/* alpha 0.4: how far a lamp is on (0-1). Outdoors with the world's hours each lamp has its own moment as the light
   fails (environment.lampK: dusk, night, a grey storm, fog), so they come on one by one; in a dark place or a room, all on */
export function lampLit(x, z, dark) {
  const sc = walkView.sc,
    E = typeof environment !== 'undefined' && engineContext.env && !sc.indoor ? environment : null;
  if (!E || (sc.tint && sc.tint !== '#000000')) return dark ? 1 : 0;
  const th = 0.16 + 0.3 * hash2d(Math.round(x * 7), Math.round(z * 11));
  return Math.min(1, Math.max(0, (E.lampK - th) / 0.07));
}
/* an old (picture-only) house's window: lit at this hour or not (environment.js environmentWindowLit) */
function windowLit(x, z) {
  return typeof environmentWindowLit === 'function' && typeof environment !== 'undefined' && engineContext.env
    ? environmentWindowLit(x, z, environment.tod)
    : true;
}
/* a low-poly building's windows (its recipe's glass numbers, it.wins from prop-models.js): where each is in the place
   and which way it looks out, which are lit at this hour (each by where it is, as an old house's window) as a bit
   each (on), and how strongly the lit ones shine (k: 1 after dark, the daytime dial by day, none from inside a room) */
export function modelWindowLight(it, dark0) {
  const sc = walkView.sc,
    RR = sc.roomRect,
    out = !!RR && (it.x < RR[0] || it.x > RR[0] + RR[2] || it.z < RR[1] || it.z > RR[1] + RR[3]),
    dOut = RR && typeof environment !== 'undefined' && engineContext.env ? environment.lampK || 0 : 0,
    dark = out ? (dOut > 0.4 ? dOut : 0) : dark0,
    k =
      sc.room && !out ? 0 : (dark ? 1 : engineSetting('lights', 'windowsDay')) * engineSetting('lights', 'brightness'),
    s = (it.p.s || 1) * (it.lk ? it.lk.size : 1),
    f = it.flip || 1,
    ro = propTurn(it),
    cr = Math.cos(ro),
    sr = Math.sin(ro),
    P = [];
  let on = 0;
  for (const w of it.wins) {
    const x = w.p[0] * f * s,
      z = w.p[2] * s,
      nx = w.n[0] * f,
      nz = w.n[2],
      p = [it.x + x * cr - z * sr, it.y + w.p[1] * s, it.z + x * sr + z * cr],
      lit = windowLit(p[0], p[2]);
    if (lit) on |= 1 << w.id;
    P.push({ p, n: [nx * cr - nz * sr, nx * sr + nz * cr], lit });
  }
  return { k, on, P, dark };
}
/* phase 20 C5: the lit lights out of the frame's, with quality.stableLights on kept from frame to frame
   (engine/light-pick.js; the walk and the battle stage each have their own), else the nearest each frame */
const LIGHT_PICK = lightPicker(),
  BATTLE_LIGHT_PICK = lightPicker();
let lightFrustum = null;
const lightInView = l => inFrustum(lightFrustum, l.p[0], l.p[1] + worldCurveDrop(l.p[0], l.p[2]), l.p[2], l.r);
/* phase 20 R2 (D6): a phone (Android, iPhone; as the automatic quality has it) with quality.phoneLamps lights at most 8 */
const PHONE_LAMPS = typeof navigator !== 'undefined' && /Android|iPhone/.test(navigator.userAgent) ? 8 : 16;
function pickLights(L, C, P, BT) {
  const max = Math.max(
    1,
    Math.min(
      engineSetting('quality', 'phoneLamps') ? PHONE_LAMPS : 16,
      Math.round(engineSetting('quality', 'lights') ?? 16)
    )
  );
  if (!engineSetting('quality', 'stableLights')) return pickPointLights(L, P.x, P.z, max);
  const cull = !!C.vp && (engineSetting('quality', 'cull') ?? true);
  if (cull) lightFrustum = computeFrustum(C.vp);
  return pickStableLights(
    BT ? BATTLE_LIGHT_PICK : LIGHT_PICK,
    L,
    P.x,
    P.z,
    performance.now(),
    max,
    cull ? lightInView : null
  );
}
/* phase 20 C2: the contact-shadow blobs, refilled in place each frame (engine/frame-lists.js) */
const AO_POOL = [],
  AO_ALL = [],
  AO_NEAR = [];
export function walkLightContext(C, sun, dark, items, shadow, BT) {
  AO_ALL.length = 0;
  const dark0L = dark;
  /* the low-poly buildings' windows read it (prop-models.js drawLowPolyModels) */
  walkRenderer.dark = dark;
  const sc = walkView.sc,
    t = walkView.t,
    R = C.right,
    P = BT ? { x: BT.center[0], z: BT.center[1] } : walkView.pl,
    lb = engineSetting('lights', 'brightness'),
    flick = engineSetting('lights', 'flicker'),
    winDay = engineSetting('lights', 'windowsDay');
  const L = [],
    ao = AO_ALL,
    RR = sc.roomRect,
    dOut = RR && typeof environment !== 'undefined' && engineContext.env ? environment.lampK || 0 : 0;
  for (const it of items) {
    if (it.k !== 'prop' || it.far || it.layer) continue;
    const M = it.M,
      s = it.mpp,
      ta = placedTurn(it.p) /* phase 09 batch 9: the placement's turn */,
      out = !!RR && (it.x < RR[0] || it.x > RR[0] + RR[2] || it.z < RR[1] || it.z > RR[1] + RR[3]),
      dark = out ? (dOut > 0.4 ? dOut : 0) : dark0L;
    if (!it.flat && it.sh > 0) {
      const box = M.box;
      ao.push(
        box
          ? pooledQuad(
              AO_POOL,
              ao.length,
              /* phase 09 batch 9: under a turned prop's turned footprint (its middle; the soft patch stays square) */
              turnedPoint(it.p, 0, box[1] * 0.5 * (it.p.s || 1))[0],
              turnedPoint(it.p, 0, box[1] * 0.5 * (it.p.s || 1))[1],
              (Math.abs(Math.cos(ta)) * box[0] * 0.62 + Math.abs(Math.sin(ta)) * box[1] * 0.75) * (it.p.s || 1),
              (Math.abs(Math.sin(ta)) * box[0] * 0.62 + Math.abs(Math.cos(ta)) * box[1] * 0.75) * (it.p.s || 1)
            )
          : pooledQuad(AO_POOL, ao.length, it.x, it.z, Math.max(0.25, it.sh * 0.62), Math.max(0.2, it.sh * 0.47))
      );
    }
    /* phase 09 batch 9: a turned prop's lamps and windows sit along its turned front */
    const r0 = ta ? Math.cos(ta) : R[0],
      r2 = ta ? Math.sin(ta) : R[2],
      at = (fx, fy) => [it.x + r0 * fx * s * it.flip, it.y - fy * s, it.z + r2 * fx * s * it.flip];
    /* alpha 0.4: one light per lamp however many glasses it has (a four-lamp lantern took four of the sixteen lights and
     shone four times as bright, so lamps farther off got none), a pool of light on the ground under every lamp that hangs
     high, each lamp coming on at its own moment at dusk, and the windows' light as one soft pool in front of a house
     from its lit ground-floor windows (the upper floors' never reached the ground) */
    const fl = 1 - flick * 0.15 + flick * 0.15 * Math.sin(t / 170 + it.x * 3) * Math.sin(t / 97 + it.z),
      on = lampLit(it.x, it.z, dark),
      pk = (engineSetting('lights', 'pools') ?? 1) * lb,
      G = [],
      inRoom = !!sc.room && !out,
      E = it.bld3 && typeof buildingState !== 'undefined' ? buildingState.mesh.get(it.p) : null;
    let W = null,
      WN = null,
      fi = 0;
    /* a low-poly building's lit ground-floor windows, each pushed out its own way (its glass, not the picture's) */
    if (it.wins) {
      it.winL = modelWindowLight(it, dark0L);
      if (!inRoom)
        for (const q of it.winL.P)
          if (q.lit && q.p[1] - it.y < 2.6) {
            (W || (W = [])).push(q.p);
            (WN || (WN = [0, 0]))[0] += q.n[0];
            WN[1] += q.n[1];
          }
    }
    for (const e of M.fx || []) {
      if (e.k === 'fire')
        L.push({
          p: at(e.x, e.y),
          r: 4.4,
          c: [1.7, 0.8, 0.32].map(v => v * fl * lb * (dark ? 1 : 0.6)),
          src: it.p,
          kind: LIGHT_KIND.fire + fi++,
        });
      else if (e.k === 'window' && !inRoom && !E && !it.wins) {
        const p = at(e.x, e.y);
        if (p[1] - it.y < 2.6 && windowLit(p[0], p[2])) (W || (W = [])).push(p);
      } else if (e.k === 'glow') G.push(at(e.x, e.y));
    }
    if (E && E.fw && !inRoom) {
      const lf = litWindowFraction();
      for (const f of E.fw) if (f[1] - it.y < 2.6 && frontWindowLight(f[3], lf)) (W || (W = [])).push(f);
    }
    const wk = inRoom ? 0 : dark ? 1 : winDay;
    if (W && wk > 0.01) {
      const n = W.length,
        wl = WN && Math.hypot(WN[0], WN[1]),
        fn = E
          ? E.fn
          : wl > 0.01
            ? [WN[0] / wl, WN[1] / wl]
            : [Math.sin(ta), -Math.cos(ta)] /* phase 09 batch 9: out of a turned front */,
        cx = W.reduce((a, q) => a + q[0], 0) / n,
        cz = W.reduce((a, q) => a + q[2], 0) / n;
      L.push({
        p: [cx + fn[0] * 0.5, it.y + 1.2, cz + fn[1] * 0.5],
        r: 2.4 + Math.min(1.6, n * 0.5),
        front: true,
        src: it.p,
        kind: LIGHT_KIND.window,
        c: [1.1, 0.8, 0.45].map(v => v * Math.min(2, 0.7 + n * 0.35) * wk * lb * (dark ? 1 : 0.6)),
      });
    }
    if (G.length) {
      const n = G.length,
        k = on * (M.glowK ?? 1); /* alpha 0.1: a prop's own strength (scenery glowK) */
      if (k > 0.01) {
        const p = [0, 1, 2].map(i => G.reduce((a, q) => a + q[i], 0) / n);
        L.push({
          p,
          r: 3.6 + 0.35 * Math.min(3, n - 1),
          own: it.p,
          src: it.p,
          kind: LIGHT_KIND.glow,
          c: (M.glowCol ? hexToRgb(M.glowCol).map(v => (v / 255) * 1.3) : [1.3, 1.05, 0.7]).map(
            v => v * Math.min(1.6, n) * fl * k * lb
          ),
        });
        if (p[1] - it.y > 1.2 && pk > 0)
          L.push({
            p: [p[0], it.y + 0.35, p[2] + 0.05],
            r: Math.min(4.2, (p[1] - it.y) * 1.25),
            pool: 1,
            src: it.p,
            kind: LIGHT_KIND.glowPool,
            c: [1, 0.8, 0.52].map(v => v * 0.85 * k * pk * Math.min(1.3, n)),
          });
      }
    }
    if (M.glow && on > 0.01) {
      const c = hexToRgb(M.glow.c),
        p = [it.x, it.y + M.glow.y, it.z - 0.1];
      L.push({
        p,
        r: M.glow.r * 2.2,
        own: it.p,
        src: it.p,
        kind: LIGHT_KIND.lamp,
        c: [(c[0] / 255) * 1.3, (c[1] / 255) * 1.3, (c[2] / 255) * 1.3].map(v => v * lb * on),
      });
      /* v34: a lamp up high also lays a pool of light on the ground under it after dark */
      if (M.glow.y > 1.2 && pk > 0)
        L.push({
          p: [it.x, it.y + 0.35, it.z + 0.05],
          r: Math.min(4.2, M.glow.y * 1.25),
          pool: 1,
          src: it.p,
          kind: LIGHT_KIND.lampPool,
          c: [(c[0] / 255) * 0.9 * pk * on, (c[1] / 255) * 0.78 * pk * on, (c[2] / 255) * 0.55 * pk * on],
        });
    }
  }
  for (const it of items)
    if (it.person || it.k === 'enc' || (it.k === 'life' && it.sh > 0))
      ao.push(pooledQuad(AO_POOL, ao.length, it.x, it.z, it.aoR || 0.34, (it.aoR || 0.34) * 0.76));
  if (BT)
    for (let i = 0; i < BT.lights.length; i++) {
      const l = BT.lights[i];
      l.src = BT;
      l.kind = i;
      L.push(l);
    }
  nearestFirst(ao, P.x, P.z, AO_NEAR, 64);
  /* v26: dark caves (and the night) — you carry a lantern */
  const E = typeof environment !== 'undefined' && engineContext.env ? environment : null,
    cave = (sc.dark ?? (sc.indoor && sc.far === 'cave' ? 1 : 0)) * engineSetting('air', 'caveDark'),
    night = E ? E.night : 0,
    lan = Math.max(cave, night * 0.75);
  if (lan > 0.02) {
    const y = standingHeightAt(P.x, P.z) + 1.5;
    L.push({
      p: [P.x, y, P.z - 0.25],
      r: cave > 0.02 ? 6.8 : 5,
      src: 'lantern',
      kind: 0,
      c: [2.5, 1.95, 1.3].map(v => v * lan * (cave > 0.02 ? 1 : 0.55) * lb),
    });
  }
  roomLights(sc, L, lb);
  const lights = pickLights(L, C, P, BT),
    sky = skyColors(sc);
  let hz = hexToRgb(engineSetting('air', 'haze') || sc.haze || (sc.sky || [])[2] || '#EAD9C0').map(v => v / 255);
  if (E && !sc.indoor) hz = environmentHaze(hz);
  const tint = sc.tint && sc.tint !== '#000000' ? hexToRgb(sc.tint).map(v => 0.35 + (v / 255) * 1.3) : null;
  let ambTop = sc.indoor
      ? [0.62, 0.58, 0.52]
      : [0.3 + sky[0][0] * 0.24, 0.32 + sky[0][1] * 0.24, 0.36 + sky[0][2] * 0.28],
    ambBot = sc.indoor ? [0.38, 0.31, 0.25] : [0.3, 0.32, 0.24];
  /* v43: a room is lit by its windows: the daylight comes in from the front at a slant (roomSkyLight says how bright and from which side), warm walls and a dark floor make the ambient, no sun lobe; the lamps do the rest after dark */
  let roomSH = null;
  if (sc.room && (engineSetting('lights', 'roomLight') ?? true) !== false) {
    const Rk = roomSkyLight();
    const wc = sc.wallCol && sc.wallCol[0] ? hexToRgb(sc.wallCol[0]).map(v => v / 255) : [0.78, 0.7, 0.58];
    const wk = 0.3 + 0.2 * Math.max(0.25, Rk.I);
    ambTop = wc.map(v => v * wk);
    ambBot = [0.24, 0.19, 0.15];
    const hor = wc.map(v => v * wk * 0.85);
    roomSH = { top: ambTop, hor, gnd: ambBot };
  }
  const TL = E && !sc.indoor ? E.look : null;
  if (TL) {
    /* 0.1.0 alpha: the time-of-day look's fill light and its colour */
    const gk = 1 + E.grey * 0.12,
      ac = TL.ambientColor;
    ambTop = ambTop.map((v, i) => v * TL.ambient * ac[i] * gk);
    ambBot = ambBot.map((v, i) => v * TL.ambient * ac[i]);
  } else if (E && !sc.indoor) {
    const nk = 1 - night * 0.5,
      gk = 1 + E.grey * 0.12;
    ambTop = ambTop.map((v, i) => v * nk * gk * (i === 2 ? 1 + night * 0.25 : 1));
    ambBot = ambBot.map((v, i) => v * nk * (i === 2 ? 1 + night * 0.2 : 1));
  }
  if (cave > 0) {
    const k = 1 - cave * 0.62;
    ambTop = ambTop.map(v => v * k);
    ambBot = ambBot.map(v => v * k);
    hz = hz.map(v => v * (1 - cave * 0.5));
    sun = Object.assign({}, sun, { col: sun.col.map(v => v * (1 - cave * 0.55)) });
  }
  const fogK = E && !sc.indoor ? (1 - E.fog * 0.45) * (1 - E.rain * 0.22) * (1 - E.snow * 0.3) * (1 - E.ash * 0.2) : 1;
  const ambHor = roomSH
    ? roomSH.hor
    : sc.indoor
      ? ambTop.map((v, i) => v * 0.9 + ambBot[i] * 0.1)
      : [0.3 + sky[2][0] * 0.26, 0.32 + sky[2][1] * 0.26, 0.34 + sky[2][2] * 0.26].map(
          (v, i) => v * (TL ? TL.ambient * TL.ambientColor[i] : E ? 1 - night * 0.5 : 1)
        ); /* v43: the horizon's colour for the sky-shaped ambient */
  const RD = BT ? null : roomDimming(sc);
  return lightContext({
    roomB: RD ? RD.b : null,
    roomDim: RD ? RD.dim : 0,
    eye: C.eye,
    sun,
    ambTop,
    ambBot,
    ambHor,
    noSunLobe: !!roomSH,
    haze: hz,
    fogStart: C.df * engineSetting('air', 'hazeStart') * (E && !sc.indoor ? 1 - E.fog * 0.35 : 1),
    /* HB-8: a director's frame may see further than the walk (BT.hazeK: the train ride's shots out over the sea) */
    fogD:
      (engineSetting('air', 'hazeDistance') ?? (sc.hazeD || 34)) *
      1.15 *
      fogK *
      (TL ? TL.hazeDistance : 1) *
      (BT && BT.hazeK ? BT.hazeK : 1),
    tint,
    valley: walkRenderer.valley || null,
    /* a place with mist of its own: the dial scales it (it was ignored there: 24 of 93 maps) */
    mist:
      sc.mist != null
        ? Math.min(1, sc.mist * (engineSetting('air', 'mist') / (ENGINE_DEFAULTS.air.mist || 0.12))) +
          (E && !sc.indoor ? E.fog * 0.18 : 0)
        : engineSetting('air', 'mist'),
    mistY: (walkRenderer.wlevel || 0) + engineSetting('air', 'mistHeight'),
    time: t,
    indoor: sc.indoor,
    lite: walkView.R < 0.75,
    shadow,
    lights,
    ao: AO_NEAR,
    curve: worldCurveArgs(),
    season: E ? E.sk : [0, 0, 0, 0],
  });
}
