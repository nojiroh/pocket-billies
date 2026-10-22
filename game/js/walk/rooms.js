'use strict';
/* ================= WALK ROOMS =================
   Phase 20 (stage B): a room's box, its daylight, lamps and windows, and drawing its effects and front, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { setPropLookUniforms } from '../hooks.js';
import { clamp } from '../util.js';
import { roomToLocal, roomToWorld, roomVecToWorld } from '../logic/room-turn.js';
import { hexToRgb, makeCanvas } from '../art.js';
import { stepRaiseAt, walkData, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { bindQuad, gpuState, imageTexture } from '../engine/webgl.js';
import { WEATHER_LOOKS, currentLocationMap, environmentState } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { useWalkProgram } from './draw-common.js';
/* eslint-disable no-func-assign */
expose({
  drawRoomEffects: [() => drawRoomEffects, v => (drawRoomEffects = v)],
  drawRoomFront: [() => drawRoomFront, v => (drawRoomFront = v)],
  lampTexture: [() => lampTexture, v => (lampTexture = v)],
  roomAt: [() => roomAt],
  roomBoxOf: [() => roomBoxOf, v => (roomBoxOf = v)],
  roomDir: [() => roomDir],
  roomHeightAt: [() => roomHeightAt],
  roomLamps: [() => roomLamps, v => (roomLamps = v)],
  roomLights: [() => roomLights, v => (roomLights = v)],
  roomOwn: [() => roomOwn],
  roomP: [() => roomP],
  roomSkyLight: [() => roomSkyLight, v => (roomSkyLight = v)],
  roomTexture: [() => roomTexture, v => (roomTexture = v)],
  windowBlocked: [() => windowBlocked, v => (windowBlocked = v)],
  windowLightShare: [() => windowLightShare, v => (windowLightShare = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* IS-5: a room laid in behind a door that doesn't face south is turned with it (seamless-world.js, logic/room-turn.js).
   What's worked out here is in the room's own metres (its door on the near side, its back wall along +z), then put
   into the place's: points with roomAt, directions with roomDir, the place's points back with roomOwn. A room facing
   south has no frame, and all three give back what they're given. */
const roomAt = (sc, x, z) => roomToWorld(sc.roomFrame, x, z),
  roomOwn = (sc, x, z) => roomToLocal(sc.roomFrame, x, z),
  roomDir = (sc, v) => {
    const d = roomVecToWorld(sc.roomFrame, v[0], v[2]);
    return [d[0], v[1], d[1]];
  },
  roomP = (sc, x, y, z) => {
    const w = roomAt(sc, x, z);
    return [w[0], y, w[1]];
  },
  roomHeightAt = (sc, x, z) => standingHeightAt(...roomAt(sc, x, z));
/* v31: rooms lit from outside. The light of the town's hour and weather falls through each window: a bright patch on
   the floor with the panes' cross in it, moving with the sun (warm by day, golden at sunset, blue under the moon), a
   faint dusty shaft from the glass to the floor, the glass itself darkening at night; pendant lamps come on in the
   evening; the floor darkens toward the walls and the walls get a skirting board (in the ground shader) */
export function roomBoxOf(sc) {
  if (walkRenderer.roomBoxId === walkView.id) return walkRenderer.roomBox;
  walkRenderer.roomBoxId = walkView.id;
  walkRenderer.roomBox = null;
  if (!sc.room) return null;
  const Rr = (sc.roomFrame && sc.roomFrame.rect) || sc.roomRect || [0, 0, sc.w, sc.h],
    X0 = Rr[0],
    Z0 = Rr[1],
    W = Rr[2],
    H = Rr[3],
    hi = (x, z) => stepRaiseAt(...roomAt(sc, x, z)) > 1;
  let x0 = X0 + W / 2,
    x1 = X0 + W / 2,
    zb = Z0 + H * 0.5;
  while (x0 > X0 && !hi(x0 - 0.05, Z0 + H * 0.5)) x0 -= 0.05;
  while (x1 < X0 + W && !hi(x1 + 0.05, Z0 + H * 0.5)) x1 += 0.05;
  while (zb < Z0 + H && !hi(X0 + W / 2, zb + 0.05)) zb += 0.05;
  return (walkRenderer.roomBox = [x0, x1, zb]);
}
export function roomSkyLight() {
  const now = performance.now();
  if (walkRenderer.roomSkyT && now - walkRenderer.roomSkyT < 500) return walkRenderer.roomSky;
  walkRenderer.roomSkyT = now;
  let st;
  try {
    st = environmentState(currentLocationMap() || walkView.sc);
  } catch (e) {
    st = { h: 13, rise: 6, set: 20, night: 0, dusk: 0, dawn: 0, wx: 'clear' };
  }
  const W = (typeof WEATHER_LOOKS !== 'undefined' && WEATHER_LOOKS[st.wx]) || {},
    grey = W.grey || 0,
    day = 1 - st.night,
    ph = clamp((st.h - st.rise) / Math.max(1, st.set - st.rise), 0, 1),
    el = Math.sin(ph * Math.PI),
    warm = Math.max(st.dusk, st.dawn * 0.8);
  const dayC = [1, 0.94 - warm * 0.26, 0.8 - warm * 0.46].map(v => v * (1 - grey * 0.78) * (0.5 + 0.5 * el)),
    moonC = [0.42, 0.54, 0.95].map(v => v * 0.42 * (1 - grey * 0.85)),
    c = dayC.map((v, i) => v * day + moonC[i] * st.night);
  const elev = (14 + 48 * el) * day + 45 * st.night,
    dx = (ph - 0.5) * 1.5 * day - 0.35 * st.night;
  return (walkRenderer.roomSky = {
    c,
    I: Math.max(...c),
    tan: Math.tan((elev * Math.PI) / 180),
    dx,
    lamp: clamp(Math.max(st.night, st.dusk * 0.75, grey * 0.55), 0, 1),
    night: st.night,
    dusk: Math.max(st.dusk, st.dawn * 0.6),
    grey,
  });
}
function roomTexture(k) {
  const key = 'roomTex_' + k;
  if (walkRenderer[key]) return walkRenderer[key];
  const N = 64,
    c = makeCanvas(N, N),
    x = c.getContext('2d'),
    d = x.createImageData(N, N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N,
        v = (j + 0.5) / N,
        e = Math.min(u, 1 - u, v, 1 - v),
        soft = k === 'beam' ? Math.min(1, e / 0.22) : Math.min(1, e / 0.07);
      let a = soft;
      if (k === 'pane') {
        const bar = Math.abs(u - 0.5) < 0.035 || Math.abs(v - 0.44) < 0.035;
        if (bar) a *= 0.25;
      }
      if (k === 'beam') a *= 0.7 + 0.3 * Math.sin(u * 9) * 0.5 + 0.15;
      const q = (j * N + i) * 4;
      d.data[q] = d.data[q + 1] = d.data[q + 2] = 255;
      d.data[q + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  x.putImageData(d, 0, 0);
  return (walkRenderer[key] = c);
}
function lampTexture(on) {
  const key = on ? 'lampTexOn' : 'lampTex';
  if (walkRenderer[key]) return walkRenderer[key];
  const c = makeCanvas(14, 18),
    x = c.getContext('2d'),
    P = (col, a, b, w, h) => {
      x.fillStyle = col;
      x.fillRect(a, b, w, h);
    };
  P('#4A3A2A', 6, 9, 2, 7);
  P('#3A2E22', 4, 15, 6, 2);
  P('#6E5A40', 5, 14, 4, 1);
  P(on ? '#FFF1C6' : '#E9DDBE', 4, 0, 6, 1);
  P(on ? '#FFE6A8' : '#DCCBA4', 3, 1, 8, 4);
  P(on ? '#F7CF7E' : '#C9B288', 2, 5, 10, 2);
  P('#9C8052', 2, 7, 10, 1);
  P(on ? '#FFF8DA' : '#B8AA90', 5, 8, 4, 1);
  P(on ? '#FFFFFF' : '#F2EAD6', 4, 1, 2, 3);
  return (walkRenderer[key] = c);
}
/* two lamps on the back wall, one each side, where nothing hangs or stands against it */
function roomLamps(sc) {
  if (walkRenderer.lampsId === walkView.id) return walkRenderer.lamps;
  walkRenderer.lampsId = walkView.id;
  const B = roomBoxOf(sc);
  if (!B) return (walkRenderer.lamps = []);
  const W = B[1] - B[0],
    near = (sc.props || []).map(p => roomOwn(sc, p.x, p.z)).filter(p => p[1] > B[2] - 1.6),
    free = x => near.every(p => Math.abs(p[0] - x) > 0.95),
    out = [];
  for (const side of [
    [0.2, 0.28, 0.12, 0.36, 0.06],
    [0.8, 0.72, 0.88, 0.64, 0.94],
  ]) {
    const f = side.find(f => free(B[0] + W * f));
    out.push(f != null ? [B[0] + W * f, B[2] - 0.06, 2.05] : [B[0] + W * side[0], B[2] - 0.06, 2.75]);
  }
  return (walkRenderer.lamps = out);
}
/* something tall standing right in front of a window (a fridge, a shelf) keeps its light out */
function windowBlocked(sc, w) {
  const C0 = walkData().sc;
  return (sc.props || []).some(p => {
    if (p === w.p || p === w) return false;
    const M = C0.props[p.k];
    if (!M || M.flat || /^wall_|rug/.test(p.k) || -M.oy * (p.s || 1) < 40) return false;
    const a = roomOwn(sc, p.x, p.z),
      b = roomOwn(sc, w.x, w.z);
    return Math.abs(a[0] - b[0]) < 0.75 && a[1] < b[1] - 0.02 && a[1] > b[1] - 1.3;
  });
}
/* alpha 0.1: a room with many windows (it shows its building's own) shares their daylight, as if it had two or so: the
   back wall doesn't wash out to white */
export function windowLightShare(sc) {
  if (walkRenderer.wsP !== sc.props) {
    walkRenderer.wsP = sc.props;
    walkRenderer.ws = Math.min(1, 2.2 / Math.max(1, (sc.props || []).filter(p => /wall_window/.test(p.k)).length));
  }
  return walkRenderer.ws;
}
export function roomLights(sc, L, lb) {
  if (!sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return;
  const R = roomSkyLight(),
    B = roomBoxOf(sc),
    ws = windowLightShare(sc);
  if (!B) return;
  /* alpha 0.4: the wall lamp's light a little out from the wall (it burned the wall white round it) and a soft pool of it on the floor */
  for (const [x, z, ly] of roomLamps(sc))
    if (R.lamp > 0.02) {
      L.push({
        p: roomP(sc, x, roomHeightAt(sc, x, z - 0.9) + ly, z - 0.9),
        r: 6,
        c: [1.4, 1.04, 0.66].map(v => v * R.lamp * lb),
      });
      L.push({
        p: roomP(sc, x, roomHeightAt(sc, x, z - 1.9) + 0.3, z - 1.9),
        r: 3.4,
        pool: 1,
        c: [0.85, 0.64, 0.4].map(v => v * R.lamp * lb),
      });
    }
  for (const p of sc.props || [])
    if (/wall_window/.test(p.k) && R.I > 0.03 && !windowBlocked(sc, p)) {
      const u = 1.9 / Math.max(0.25, R.tan),
        [px, pz] = roomOwn(sc, p.x, p.z);
      L.push({
        p: roomP(sc, px + R.dx * u * 0.6, 0.9, Math.max(0.6, pz - u * 0.7)),
        r: 3.6,
        c: R.c.map(v => v * 1.25 * lb * ws),
      });
    }
}
export function drawRoomEffects(C, U, items, glows, t, rm) {
  const sc = walkView.sc;
  if (!sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return;
  const gl = gpuState.gl,
    R = roomSkyLight(),
    gk = engineSetting('lights', 'glow'),
    ws = windowLightShare(sc);
  const draw = (cv, x, y, z, r, u, sw, sh, col, a) => {
    const T = imageTexture(cv, { noNormal: true });
    if (!T) return;
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.uniform3f(U.uP, ...roomP(sc, x, y, z));
    gl.uniform3fv(U.uRight, roomDir(sc, r));
    gl.uniform3fv(U.uUp, roomDir(sc, u));
    gl.uniform2f(U.uS, sw, sh);
    gl.uniform4f(U.uCol, col[0], col[1], col[2], a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  gl.uniform4f(U.uUV, 0, 0, 1, 1);
  gl.uniform1f(U.uGlow, 0);
  gl.uniform1f(U.uLitFx, 0);
  for (const it of items) {
    if (it.k !== 'prop' || !/wall_window/.test(it.p.k)) continue;
    const s = it.mpp,
      f = it.flip || 1,
      [ix, iz] = roomOwn(sc, it.x, it.z),
      gx0 = ix + (it.ox + 6) * s * f,
      gx1 = ix + (it.ox + 48) * s * f,
      yt = it.y - (it.oy + 5) * s,
      yb = it.y - (it.oy + 41) * s,
      fy = roomHeightAt(sc, ix, iz - 1),
      zw = iz - 0.04,
      cx = (gx0 + gx1) / 2,
      gw = Math.abs(gx1 - gx0),
      gh = yt - yb;
    /* the glass: night, dusk and grey skies show in it */
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (R.night > 0.02)
      draw(
        roomTexture('glass'),
        cx,
        (yt + yb) / 2,
        zw,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        [0.05, 0.07, 0.17],
        0.78 * R.night
      );
    if (R.dusk > 0.05)
      draw(
        roomTexture('glass'),
        cx,
        (yt + yb) / 2,
        zw,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        [1, 0.5, 0.28],
        0.32 * R.dusk * (1 - R.night)
      );
    if (R.grey > 0.05)
      draw(
        roomTexture('glass'),
        cx,
        (yt + yb) / 2,
        zw,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        [0.62, 0.66, 0.72],
        0.35 * R.grey * (1 - R.night)
      );
    if (R.I < 0.03 || windowBlocked(sc, it)) continue;
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    /* where the glass's corners land on the floor along the light */
    const ut = (yt - fy) / R.tan,
      ub = (yb - fy) / R.tan,
      hit = (y, u) => [cx + R.dx * u, fy + 0.012, zw - u],
      T0 = hit(yt, ut),
      B0 = hit(yb, ub),
      vx = T0[0] - B0[0],
      vz = T0[2] - B0[2],
      L = Math.hypot(vx, vz) || 1;
    draw(
      roomTexture('pane'),
      (T0[0] + B0[0]) / 2,
      fy + 0.012,
      (T0[2] + B0[2]) / 2,
      [1, 0, 0],
      [vx / L, 0, vz / L],
      gw,
      L,
      R.c,
      0.62 * ws
    );
    /* the shaft: thin cards parallel to the glass, stepped along the light, the floor hiding what falls below it */
    const n = 9;
    for (let k = 0; k < n; k++) {
      const u = ((k + 0.5) / n) * ut;
      draw(
        roomTexture('beam'),
        cx + R.dx * u,
        (yt + yb) / 2 - R.tan * u,
        zw - u,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        R.c,
        0.055 * (1 - (k / n) * 0.5) * ws
      );
    }
    /* dust turning in the light */
    for (let k = 0; k < 12; k++) {
      const sd = k * 7.31 + ix,
        ph = ((t * rm) / 9000 + k / 12) % 1,
        u = ut * (0.15 + 0.8 * ((k * 0.618) % 1)),
        px = cx + R.dx * u + (((k * 0.37) % 1) - 0.5) * gw * 0.8 + Math.sin(ph * 6.3 + sd) * 0.08,
        py = (yt + yb) / 2 - R.tan * u + (ph - 0.5) * gh * 0.8;
      if (py < fy + 0.05) continue;
      glows.push([
        ...roomP(sc, px, py, zw - u + Math.sin(sd) * 0.1),
        0.012,
        R.c.map(v => v * 1.4 + 0.3),
        0.9 * Math.sin(ph * Math.PI),
      ]);
    }
  }
  /* daylight (or moonlight) spilling in through the open doorway */
  {
    const ex = sc.exits && sc.exits[0] ? roomOwn(sc, sc.exits[0][0], sc.exits[0][1]) : [sc.w / 2, 0.6],
      fy = roomHeightAt(sc, ex[0], 0.8);
    if (R.I > 0.03) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      draw(
        roomTexture('beam'),
        ex[0] + R.dx * 0.3,
        fy + 0.012,
        0.75,
        [1, 0, 0],
        [R.dx * 0.3, 0, 1],
        2.1,
        1.5,
        R.c,
        0.42
      );
    }
  }
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  /* wall lamps, lit in the evening */
  const LT = lampTexture(R.lamp > 0.3);
  for (const [x, z, ly] of roomLamps(sc)) {
    const y = roomHeightAt(sc, x, z - 0.5) + ly;
    draw(LT, x, y, z, [1, 0, 0], [0, 1, 0], 0.33, 0.42, [1, 1, 1], 1);
    if (R.lamp > 0.02) {
      glows.push([...roomP(sc, x, y + 0.06, z - 0.03), 0.07 * gk, [1, 0.86, 0.58], 2.4 * R.lamp]);
      glows.push([...roomP(sc, x, y + 0.25, z), 0.42 * gk, [1, 0.78, 0.45], 0.3 * R.lamp]);
    }
  }
}
/* v31: a room's front wall, cut off low like a doll's house so you see in, with the doorway left open where the exit
   is; its face runs down into the dark under the floor, so the room reads as a box that ends at its door */
export function drawRoomFront(C, X) {
  const sc = walkView.sc;
  if (!sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return;
  const B = roomBoxOf(sc);
  if (!B) return;
  const gl = gpuState.gl;
  const Rr = (sc.roomFrame && sc.roomFrame.rect) || sc.roomRect || [0, 0, sc.w, sc.h],
    ex = sc.exits && sc.exits[0] ? roomOwn(sc, sc.exits[0][0], sc.exits[0][1]) : [Rr[0] + Rr[2] / 2, Rr[1] + 0.6],
    dl = ex[0] - (sc.roomGap || 2) / 2,
    dr = ex[0] + (sc.roomGap || 2) / 2,
    fy = roomHeightAt(sc, Rr[0] + Rr[2] / 2, Rr[1] + 1.5),
    hw = 0.36,
    th = 0.2,
    deep = sc.roomRect ? 0.4 : 3.2,
    zf = Rr[1] - 0.001,
    x0 = B[0] - 0.25,
    x1 = B[1] + 0.25;
  if (walkRenderer.frontKey !== walkView.id) {
    walkRenderer.frontKey = walkView.id;
    const wc = hexToRgb((sc.wallCol || [])[10] || '#D9B79C'),
      c = makeCanvas(1, 32),
      x = c.getContext('2d'),
      rows = 32,
      top = Math.round((hw / (hw + deep)) * rows);
    for (let i = 0; i < rows; i++) {
      const k =
        i < 1 ? 1.4 : i < top ? 1.2 : i < top + 1 ? 0.35 : Math.max(0.05, 0.24 * (1 - (i - top) / (rows - top)));
      x.fillStyle = `rgb(${(wc[0] * k) | 0},${(wc[1] * k) | 0},${(wc[2] * k) | 0})`;
      x.fillRect(0, i, 1, 1);
    }
    const t = makeCanvas(4, 4),
      tx = t.getContext('2d');
    tx.fillStyle = '#6A5848';
    tx.fillRect(0, 0, 4, 4);
    tx.fillStyle = '#8A7662';
    tx.fillRect(0, 0, 4, 1);
    walkRenderer.frontTex = [c, t];
  }
  const F = imageTexture(walkRenderer.frontTex[0], { noNormal: true }),
    T = imageTexture(walkRenderer.frontTex[1], { noNormal: true });
  if (!F || !T) return;
  const p = useWalkProgram('face', C, X);
  bindQuad();
  setPropLookUniforms(p.U, null, [0, 0, 0]);
  gl.uniform1i(p.U.uTex, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1f(p.U.uSpec, 0.05);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  const segs = [
    [x0, dl],
    [dr, x1],
  ].filter(q => q[1] - q[0] > 0.05);
  for (const [a, b] of segs) {
    gl.bindTexture(gl.TEXTURE_2D, F.t);
    gl.uniform4f(p.U.uUV, 0, 0, 1, 1);
    gl.uniform3f(p.U.uO, ...roomP(sc, a, fy + hw, zf));
    gl.uniform3fv(p.U.uA, roomDir(sc, [b - a, 0, 0]));
    gl.uniform3fv(p.U.uB, roomDir(sc, [0, -(hw + deep), 0]));
    gl.uniform3fv(p.U.uN, roomDir(sc, [0, 0, -1]));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.uniform3f(p.U.uO, ...roomP(sc, a, fy + hw, zf));
    gl.uniform3fv(p.U.uA, roomDir(sc, [b - a, 0, 0]));
    gl.uniform3fv(p.U.uB, roomDir(sc, [0, 0, th]));
    gl.uniform3fv(p.U.uN, roomDir(sc, [0, 1, 0]));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /* the wall's end at the doorway */
    const e = a < ex[0] ? b : a;
    gl.bindTexture(gl.TEXTURE_2D, F.t);
    gl.uniform3f(p.U.uO, ...roomP(sc, e, fy + hw, zf));
    gl.uniform3fv(p.U.uA, roomDir(sc, [0, 0, th]));
    gl.uniform3fv(p.U.uB, roomDir(sc, [0, -hw, 0]));
    gl.uniform4f(p.U.uUV, 0, 0, 1, hw / (hw + deep));
    gl.uniform3fv(p.U.uN, roomDir(sc, [a < ex[0] ? 1 : -1, 0, 0]));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* the threshold: a worn stone sill across the doorway */
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  gl.uniform4f(p.U.uUV, 0, 0, 1, 1);
  gl.uniform3f(p.U.uO, ...roomP(sc, dl, fy + 0.025, zf));
  gl.uniform3fv(p.U.uA, roomDir(sc, [dr - dl, 0, 0]));
  gl.uniform3fv(p.U.uB, roomDir(sc, [0, 0, 0.16]));
  gl.uniform3fv(p.U.uN, roomDir(sc, [0, 1, 0]));
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
