'use strict';
/* ================= WALK SPRITES =================
   Phase 20 (stage B): the pictures standing in the scene (drawSprites), box faces, turning blades, clock hands, flat
   items, the title's town rise and tap targets, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { loadingScreen, provide, reducedMotion, requestAsker } from '../hooks.js';
import { clamp } from '../util.js';
import { pictureFacing } from '../logic/prop-turn.js';
import { filterInto } from '../engine/frame-lists.js';
import { makeCanvas } from '../art.js';
import {
  actionLabel,
  actionSpot,
  approachPoint,
  artImage,
  climbStartEnd,
  propShown,
  walkData,
  walkView,
  worldToScreen,
} from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { SURFACE_MATERIALS, bindGridQuad, bindQuad, gpuState, imageTexture, normalize3 } from '../engine/webgl.js';
import { FIXED_BACK, FIXED_RIGHT, walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { setSpriteUniforms, useWalkProgram, worldCurveDrop } from './draw-common.js';
import { frameBudgetLeft } from './quality-cull.js';
import { foliageAmount, setPropLookUniforms } from './prop-look.js';
/* eslint-disable no-func-assign */
expose({
  BOX_INFO_CACHE: [() => BOX_INFO_CACHE],
  IMAGE_IDS: [() => IMAGE_IDS],
  SILHOUETTE_AMOUNT: [() => SILHOUETTE_AMOUNT],
  SILHOUETTE_PULL: [() => SILHOUETTE_PULL],
  SILHOUETTE_TINT: [() => SILHOUETTE_TINT],
  SPRITE_LIST: [() => SPRITE_LIST],
  TURNED_BACK: [() => TURNED_BACK],
  TURNED_RIGHT: [() => TURNED_RIGHT],
  addHitTarget: [() => addHitTarget, v => (addHitTarget = v)],
  boxInfo: [() => boxInfo, v => (boxInfo = v)],
  byImageId: [() => byImageId],
  drawBoxFaces: [() => drawBoxFaces, v => setDrawBoxFaces(v)],
  drawClockHands: [() => drawClockHands, v => (drawClockHands = v)],
  drawFlatItem: [() => drawFlatItem, v => (drawFlatItem = v)],
  drawPlayerSilhouette: [() => drawPlayerSilhouette, v => setDrawPlayerSilhouette(v)],
  drawRotatingBlades: [() => drawRotatingBlades, v => (drawRotatingBlades = v)],
  drawSprites: [() => drawSprites, v => setDrawSprites(v)],
  imageId: [() => imageId, v => (imageId = v)],
  imageIdCount: [() => imageIdCount, v => (imageIdCount = v)],
  landmarkTilt: [() => landmarkTilt, v => (landmarkTilt = v)],
  spriteDrawn: [() => spriteDrawn],
  startTownRise: [() => startTownRise, v => (startTownRise = v)],
  townRiseAmount: [() => townRiseAmount, v => (townRiseAmount = v)],
  useFxProgram: [() => useFxProgram, v => (useFxProgram = v)],
});
/* eslint-enable no-func-assign */
export function setDrawBoxFaces(v) {
  drawBoxFaces = v; // eslint-disable-line no-func-assign
  provide({ drawBoxFaces });
}
export function setDrawPlayerSilhouette(v) {
  drawPlayerSilhouette = v; // eslint-disable-line no-func-assign
  provide({ drawPlayerSilhouette });
}
export function setDrawSprites(v) {
  drawSprites = v; // eslint-disable-line no-func-assign
  provide({ drawSprites });
}
/* to-module: end */
const IMAGE_IDS = new WeakMap();
let imageIdCount = 0;
function imageId(im) {
  let n = IMAGE_IDS.get(im);
  if (n === undefined) {
    n = ++imageIdCount;
    IMAGE_IDS.set(im, n);
  }
  return n;
}
/* alpha 0.4.1: the title's town springs up out of the loading screen (startTownRise from js/boot.js) */
export function startTownRise(load) {
  if (reducedMotion || typeof walkView === 'undefined') return;
  walkRenderer.rise = { t0: performance.now(), c: null, load: !!load, seen: new WeakMap() };
}
/* how far up a thing has grown (0 to a little over 1). While the game loads, a ring round the middle of the view widens
   with the loading and each thing starts to grow when the ring reaches it */
function townRiseAmount(it) {
  const R = walkRenderer.rise,
    now = performance.now();
  if (!R.c) {
    let c = null;
    try {
      const fr = walkView.director && walkView.director.frame ? walkView.director.frame() : null;
      c = fr && fr.center;
    } catch (e) {}
    R.c = c || [walkView.pl.x, walkView.pl.z];
  }
  const f = typeof loadingScreen !== 'undefined' && loadingScreen.el ? loadingScreen.f : 1,
    key = it.p || it.f || it,
    d = Math.hypot(it.x - R.c[0], it.z - R.c[1]);
  let t0 = R.seen.get(key);
  if (t0 == null) {
    if (R.load && d > 4 + f * 48) return 0;
    t0 = now + (R.load ? 0 : d * 50);
    R.seen.set(key, t0);
  }
  if (f >= 1 && !R.done) R.done = now;
  if (R.done && now - R.done > 3500) {
    walkRenderer.rise = null;
    return 1;
  }
  const t = (now - t0) / 1000;
  if (t <= 0) return 0;
  if (t >= 0.55) return 1;
  const k = t / 0.55,
    c = 1.7;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}
/* phase 20 C2: the sprite pass's list and a turned picture's axes, kept from frame to frame (engine/frame-lists.js) */
const SPRITE_LIST = [],
  TURNED_RIGHT = new Float32Array(3),
  TURNED_BACK = new Float32Array(3),
  spriteDrawn = it => !(it.flat || it.vol || it.vis === false),
  byImageId = (a, b) => imageId(a.im) - imageId(b.im);
export function drawSprites(C, items, X, hits, labels, PPU) {
  const gl = gpuState.gl,
    p = useWalkProgram('sprite', C, X),
    U = p.U,
    P = walkView.pl,
    sc = walkView.sc,
    sun = X.sun;
  bindQuad();
  if (U.uWave) gl.uniform3f(U.uWave, 0, 0, 0);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, engineSetting('color', 'outlines') ?? 1);
  const sh = normalize3([sun.dir[0], 0, sun.dir[2]]);
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform1f(U.uDZ, 0);
  gl.uniform3fv(U.uSunH, sh);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNrm, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uCurveOn, 1);
  gl.uniform1f(U.uEmit, 0);
  gl.uniform1f(U.uFlipN, 1);
  gl.uniform1f(U.uFixed, 0);
  const me = worldToScreen(C, P.x, 0.9, P.z);
  if (walkRenderer.bfade) walkRenderer.bfade.clear();
  else walkRenderer.bfade = new Map();
  const sd = sun.dir,
    sl = Math.hypot(sd[0] * C.right[0] + sd[2] * C.right[2], sd[1]) || 1,
    selfD = [(sd[0] * C.right[0] + sd[2] * C.right[2]) / sl, -sd[1] / sl],
    selfK =
      sd[1] > 0.05 && (engineSetting('shadows', 'selfShade') ?? 0.7) > 0
        ? (engineSetting('shadows', 'selfShade') ?? 0.7) * engineSetting('shadows', 'strength') * Math.min(1, sd[1] * 4)
        : 0;
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  /* v32: drawn grouped by picture (fewer texture switches); depth decides what is in front, so order doesn't matter */
  const L = filterInto(items, spriteDrawn, SPRITE_LIST);
  L.sort(byImageId);
  for (const it of L) {
    if (it.vox) {
      if (!it.far) addHitTarget(it, C, hits, labels, PPU);
      /* phase 09: a modelled clock tower keeps its moving hands (pictures on its modelled face) */
      if (it.M && it.M.hands && !it.far && !it.layer) drawClockHands(p, it, C, X);
      continue;
    }
    const T = imageTexture(it.im);
    if (!T) continue;
    const s = it.mpp,
      hM = -it.oy * s;
    let fade = it.fade ?? 1;
    if (me && !walkRenderer.bt && !it.person && it.k === 'prop' && hM > 1.6) {
      const q = worldToScreen(C, it.x, 0, it.z);
      if (q && q.d < me.d - 0.3) {
        const half = it.w * s * 0.5 * q.s,
          top = q.y - hM * q.s;
        if (me.x > q.x - half && me.x < q.x + half && me.y > top && me.y < q.y) fade = 0.4;
      }
    }
    const rk = walkRenderer.rise ? townRiseAmount(it) : 1;
    if (rk < 0.002 && !it.person) continue;
    if (it.bld3) {
      walkRenderer.bfade.set(it, fade * Math.min(1, rk));
      addHitTarget(it, C, hits, labels, PPU);
      continue;
    }
    {
      /* phase 09 batch 8: a model's picture layer may face another way than the front (yaw, radians: pi/2 the right
         side, pi the back), a tower's windows on every face */
      const ro = pictureFacing(it) /* phase 09 batch 9: and the placement's turn (logic/prop-turn.js) */,
        cr = Math.cos(ro),
        sr = Math.sin(ro);
      if (ro) {
        TURNED_RIGHT[0] = cr;
        TURNED_RIGHT[2] = sr;
        TURNED_BACK[0] = sr;
        TURNED_BACK[2] = -cr;
      }
      gl.uniform3fv(U.uRight, it.fixed ? (ro ? TURNED_RIGHT : FIXED_RIGHT) : C.right);
      gl.uniform3fv(U.uBack, it.fixed ? (ro ? TURNED_BACK : FIXED_BACK) : C.back);
    }
    gl.uniform1f(U.uFixed, it.fixed && it.plane ? 1 : 0);
    /* phase 09 batch 1: a tree's leaf clumps take no shadows from the shadow map (their crown's own shadow would
       stripe them); the crown shades itself instead (uSelf) */
    if (U.uNoRecv) gl.uniform1f(U.uNoRecv, it.noRecv ? 1 : 0);
    gl.uniform1f(U.uFlipN, it.flip || 1);
    setPropLookUniforms(U, it.lk);
    const mt = SURFACE_MATERIALS[it.mat] || SURFACE_MATERIALS[it.person ? 'cloth' : 'plain'];
    gl.uniform4f(U.uMat, mt.spec, mt.shin, mt.transl, mt.wrap);
    if (U.uFol) {
      const f = foliageAmount(it);
      gl.uniform2f(U.uFol, f[0], f[1]);
    }
    if (U.uSelf) {
      const k =
        selfK > 0 && it.k === 'prop' && !it.fixed && !it.far && hM > 1.2 && foliageAmount(it)[0] > 0 ? selfK : 0;
      gl.uniform3f(U.uSelf, k, selfD[0] * (it.flip || 1), selfD[1]);
    }
    gl.uniform1f(U.uEmit, it.glow ? it.glow * 1.6 : 0);
    gl.uniform1f(U.uFade, fade);
    gl.uniform1f(U.uRim, it.person ? 0.4 : 0.12);
    gl.uniform1f(U.uLit, it.glow ? Math.max(0, 1 - it.glow) : it.far ? 0.75 : 1);
    gl.uniform1f(U.uShade, it.person ? 0.45 : it.far ? 0.3 : 0.55);
    gl.uniform3f(U.uBaseP, it.x, it.y, it.z);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T.n);
    setSpriteUniforms(p, it, null, it.z, rk);
    if (it.wave) {
      gl.uniform3fv(U.uWave, it.wave);
      bindGridQuad();
      gl.drawArrays(gl.TRIANGLES, 0, gpuState.gridN);
      gl.uniform3f(U.uWave, 0, 0, 0);
      bindQuad();
      continue;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /* trees get a second picture crossing the first, so a turned camera sees a crown, not a cut-out's edge */
    if (it.cross && Math.abs(C.yaw) > 0.04) {
      gl.uniform3f(U.uRight, 0, 0, it.flip > 0 ? 1 : -1);
      gl.uniform3f(U.uBack, -1, 0, 0);
      gl.uniform1f(U.uFixed, 0);
      gl.uniform1f(U.uFade, fade * Math.min(1, Math.abs(C.yaw) * 4));
      setSpriteUniforms(p, it);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (it.M && it.M.blades) {
      const b = it.M.blades,
        BT = imageTexture(artImage(b.img));
      if (BT)
        drawRotatingBlades(
          p,
          it,
          b,
          BT,
          (reducedMotion ? 0 : walkView.t / 1100) * (sc.wind || 1) * engineSetting('grass', 'wind'),
          C,
          X
        );
    }
    if (it.M && it.M.hands && !it.far && !it.layer) drawClockHands(p, it, C, X);
    if (it.far || it.layer) continue;
    addHitTarget(it, C, hits, labels, PPU);
  }
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform1f(U.uEmit, 0);
  gl.uniform1f(U.uFade, 1);
  /* phase 20 C4: the flat things as one group on the fx program, then back to the sprite program once */
  let fp = null;
  for (const it of items) {
    if (!it.flat || it.vis === false || it.vox) continue; /* phase 09: a flat prop drawn as a model (stepping stones) */
    const T = imageTexture(it.im);
    if (!T) continue;
    drawFlatItem((fp = fp || useFxProgram(C, X)), it, T);
  }
  if (fp) gl.useProgram(p.p);
}
/* ---------- buildings in 3D: side walls and a roof top behind the front picture ----------
   Worked out once per picture: where the walls stand at the base, which rows reach each wall (so a gable or an
   awning shapes the side), the wall colour just inside each edge and the roof colour at the eaves. */
const BOX_INFO_CACHE = new WeakMap();
/* terrain TR-3: your silhouette through rock. Where ground cuts the camera's line to you (walk/camera.js rockK), you
   are drawn again as a flat dithered tint wherever something clearly nearer the camera hides you (depth GREATER, the
   picture pulled 0.6 m toward the eye so the ground at your feet doesn't count); nothing is written to depth. Off on
   flat ground, indoors, in battle and with Engine > Camera > "Your silhouette through rock" off */
const SILHOUETTE_TINT = [0.16, 0.27, 0.55],
  SILHOUETTE_AMOUNT = 0.55,
  SILHOUETTE_PULL = 0.6;
export function drawPlayerSilhouette(C, items, X) {
  const sc = walkView.sc,
    k = C.rockK || 0;
  if (walkRenderer.bt || !sc || sc.indoor || sc.room || k < 0.01 || !engineSetting('camera', 'silhouette')) return 0;
  const it = items.find(i => i.k === 'me');
  if (!it || !it.im) return 0;
  const T = imageTexture(it.im);
  if (!T) return 0;
  const gl = gpuState.gl,
    p = useWalkProgram('sprite', C, X),
    U = p.U;
  bindQuad();
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform1f(U.uDZ, 0);
  gl.uniform1f(U.uCurveOn, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uFade, 1);
  if (U.uWave) gl.uniform3f(U.uWave, 0, 0, 0);
  gl.uniform4f(U.uGhost, SILHOUETTE_TINT[0], SILHOUETTE_TINT[1], SILHOUETTE_TINT[2], SILHOUETTE_AMOUNT * k);
  gl.uniform4f(U.uGhostV, C.eye[0], C.eye[1], C.eye[2], SILHOUETTE_PULL);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  setSpriteUniforms(p, it);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.GREATER);
  gl.depthMask(false);
  gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.uniform4f(U.uGhost, 0, 0, 0, 0);
  gl.uniform4f(U.uGhostV, 0, 0, 0, 0);
  return 1;
}
function boxInfo(im) {
  let B = BOX_INFO_CACHE.get(im);
  if (B !== undefined) return B;
  B = null;
  try {
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      c = makeCanvas(w, h),
      x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, w, h).data,
      A = (X, Y) => d[(Y * w + X) * 4 + 3] > 127;
    const yb = Math.min(h - 1, Math.round(h * 0.88));
    let xl = 0,
      xr = w - 1;
    while (xl < w && !A(xl, yb)) xl++;
    while (xr > 0 && !A(xr, yb)) xr--;
    if (xr - xl < 8) {
      BOX_INFO_CACHE.set(im, null);
      return null;
    }
    let ye = yb;
    while (ye > 0 && A(xl + 2, ye - 1) && A(xr - 2, ye - 1)) ye--;
    const T = makeCanvas(16, h),
      tx = T.getContext('2d'),
      img = tx.createImageData(16, h),
      px = (X, Y) => {
        const k = (Y * w + X) * 4;
        return [d[k], d[k + 1], d[k + 2]];
      };
    for (let y = 0; y < h; y++)
      for (const [side, col0] of [
        [0, xl],
        [1, xr],
      ]) {
        const inX = side ? col0 - 2 : col0 + 2;
        if (inX < 0 || inX >= w || !A(inX, y)) continue;
        const c0 = px(inX, y);
        for (let i = 0; i < 8; i++) {
          const k = (y * 16 + side * 8 + i) * 4,
            shade = (i % 4 === 0 ? 0.86 : 1) * (side ? 0.92 : 0.84);
          img.data[k] = c0[0] * shade;
          img.data[k + 1] = c0[1] * shade;
          img.data[k + 2] = c0[2] * shade;
          img.data[k + 3] = 255;
        }
      }
    tx.putImageData(img, 0, 0);
    /* v32 audit: the top was one colour read just above the box's top edge, often a see-through pixel, so sofas, counters
    and kiosks had black tops. Now the top shows the picture's own top band (the rows a 3/4 drawing gives its top), the
    back edge from the top row and the front from a few rows down; see-through and outline pixels take the band's average */
    const top0 = (() => {
        const cx = Math.round((xl + xr) / 2);
        for (let y = 0; y < h; y++) if (A(cx, y)) return y;
        return ye;
      })(),
      K = Math.max(2, Math.min(10, Math.round((yb - top0) * 0.3))),
      RW = Math.max(1, xr - xl + 1),
      R = makeCanvas(RW, K),
      rx = R.getContext('2d'),
      rd = rx.createImageData(RW, K);
    let ar = 0,
      ag = 0,
      ab = 0,
      an = 0;
    const ok = (X, Y) => {
      if (X < 0 || Y < 0 || X >= w || Y >= h || !A(X, Y)) return null;
      const c0 = px(X, Y);
      return c0[0] * 0.3 + c0[1] * 0.59 + c0[2] * 0.11 > 38 ? c0 : null;
    };
    for (let j = 0; j < K; j++)
      for (let i = 0; i < RW; i++) {
        const c0 = ok(xl + i, top0 + 1 + j);
        if (c0) {
          ar += c0[0];
          ag += c0[1];
          ab += c0[2];
          an++;
        }
      }
    const avg = an ? [ar / an, ag / an, ab / an] : px(Math.round((xl + xr) / 2), Math.min(h - 1, ye + 2));
    for (let j = 0; j < K; j++)
      for (let i = 0; i < RW; i++) {
        let col0 = null;
        for (let yy = top0 + 1 + (K - 1 - j); yy < Math.min(h, top0 + 1 + K + 4) && !col0; yy++) col0 = ok(xl + i, yy);
        const c0 = col0 || avg,
          k2 = (j * RW + i) * 4,
          sh2 = 0.93;
        rd.data[k2] = c0[0] * sh2;
        rd.data[k2 + 1] = c0[1] * sh2;
        rd.data[k2 + 2] = c0[2] * sh2;
        rd.data[k2 + 3] = 255;
      }
    rx.putImageData(rd, 0, 0);
    B = { xl, xr, ye, h, side: T, roof: R };
  } catch (e) {
    B = null;
  }
  BOX_INFO_CACHE.set(im, B);
  return B;
}
export function drawBoxFaces(C, items, X) {
  const gl = gpuState.gl;
  let p = null;
  for (const it of items) {
    if (
      it.k !== 'prop' ||
      it.layer ||
      it.far ||
      it.bld3 ||
      !it.M ||
      !it.M.box ||
      it.flat ||
      it.mat !== 'building' ||
      it.vis === false ||
      it.vol ||
      it.vox /* phase 09: a prop drawn as a 3D model gets no box made from its picture */ ||
      Math.abs(+it.p.rot || 0) > 5 /* phase 09 batch 9: nor one turned more than a few degrees (a standee) */
    )
      continue;
    if (walkRenderer.bt && walkRenderer.bt.hide && walkRenderer.bt.hide.has(it.p)) continue;
    if (!BOX_INFO_CACHE.has(it.im) && !frameBudgetLeft()) continue;
    const B = boxInfo(it.im);
    if (!B) continue;
    if (!p) {
      p = useWalkProgram('face', C, X);
      bindQuad();
      gl.uniform1i(p.U.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
    }
    const s = it.mpp,
      f = it.flip,
      D = it.M.box[1] * (it.p.s || 1),
      xa = it.x + (it.ox + B.xl) * s * f,
      xb = it.x + (it.ox + B.xr + 1) * s * f,
      XL = Math.min(xa, xb),
      XR = Math.max(xa, xb),
      top = -it.oy * s,
      H = B.h * s,
      eave = (-it.oy - B.ye) * s,
      y0 = it.y;
    const ST = imageTexture(B.side, { noNormal: true }),
      RT = imageTexture(B.roof, { noNormal: true });
    if (!ST || !RT) continue;
    const mat = SURFACE_MATERIALS.building;
    gl.uniform1f(p.U.uSpec, mat.spec * 0.5);
    setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    gl.bindTexture(gl.TEXTURE_2D, ST.t);
    /* left wall (faces -x) and right wall (faces +x); the picture's left half of the texture belongs to its left edge */
    const lu = f > 0 ? 0 : 0.5,
      ru = f > 0 ? 0.5 : 0;
    gl.uniform3f(p.U.uO, XL, y0 + top, it.z);
    gl.uniform3f(p.U.uA, 0, 0, D);
    gl.uniform3f(p.U.uB, 0, -H, 0);
    gl.uniform4f(p.U.uUV, lu, 0, 0.5, 1);
    gl.uniform3f(p.U.uN, -1, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.uniform3f(p.U.uO, XR, y0 + top, it.z);
    gl.uniform3f(p.U.uA, 0, 0, D);
    gl.uniform4f(p.U.uUV, ru, 0, 0.5, 1);
    gl.uniform3f(p.U.uN, 1, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, RT.t);
    gl.uniform3f(p.U.uO, XL, y0 + eave, it.z);
    gl.uniform3f(p.U.uA, XR - XL, 0, 0);
    gl.uniform3f(p.U.uB, 0, 0, D);
    gl.uniform4f(p.U.uUV, f > 0 ? 0 : 1, 0, f > 0 ? 1 : -1, 1);
    gl.uniform3f(p.U.uN, 0, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
/* phase 20 C4: the fx program's camera and light are the same for every blade, clock hand and flat thing in a frame: sent
   the first time it is bound with this frame's camera and light context, after that it is only switched to (the shadow
   map units it reads are bound with the same frame's maps by every lit program) */
function useFxProgram(C, X) {
  const fp = gpuState.P.fx;
  if (fp.lastC === C && fp.lastX === X) {
    gpuState.gl.useProgram(fp.p);
    return fp;
  }
  useWalkProgram('fx', C, X);
  fp.lastC = C;
  fp.lastX = X;
  return fp;
}
export function drawRotatingBlades(p, it, b, BT, rot, C, X, lift) {
  const gl = gpuState.gl,
    s = it.mpp,
    lf = lift || 0,
    cx = it.x + C.right[0] * b.x * s * it.flip - C.fwd[0] * lf,
    cz = it.z + C.right[2] * b.x * s * it.flip - C.fwd[2] * lf,
    cy = it.y - b.y * s,
    bs = b.w * s,
    c = Math.cos(rot),
    sn = Math.sin(rot),
    fp = useFxProgram(C, X);
  const R = C.right,
    r2 = [R[0] * c, sn, R[2] * c],
    u2 = [-R[0] * sn, c, -R[2] * sn];
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, BT.t);
  gl.uniform3f(fp.U.uP, cx, cy + worldCurveDrop(it.x, it.z), cz);
  gl.uniform3fv(fp.U.uRight, r2);
  gl.uniform3fv(fp.U.uUp, u2);
  gl.uniform2f(fp.U.uS, bs, bs);
  gl.uniform4f(fp.U.uUV, 0, 0, 1, 1);
  gl.uniform4f(fp.U.uCol, 1, 1, 1, 1);
  gl.uniform1f(fp.U.uGlow, 0);
  gl.uniform1f(fp.U.uLitFx, 1);
  gl.uniform1i(fp.U.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.useProgram(p.p);
}
/* v47: a clock's hands (Sundown's clock tower), each a picture turned about its middle to the time on the surface: the
   device's own clock, so the tower is always right. Lifted a few centimetres toward the camera, off the face. */
function drawClockHands(p, it, C, X) {
  const d = new Date(),
    sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
  for (const h of it.M.hands) {
    const T = imageTexture(artImage(h.img));
    if (T) drawRotatingBlades(p, it, h, T, -((sec % h.per) / h.per) * Math.PI * 2, C, X, 0.06);
  }
}
/* v47: how far the camera tilts up for the landmarks near you: a thing marked "landmark" in the catalogue (the clock
   tower, the giant tree, the crane...) between 2 and 18 metres ahead and within 8 to the side, by how far its top
   rises above what the camera shows anyway (about 5 m); up to 11 degrees */
export function landmarkTilt(P, sc) {
  if (!sc || sc.indoor || !P || reducedMotion) return 0;
  const C0 = walkData().sc;
  let L = walkRenderer.lmL;
  if (!L || L.sc !== sc)
    L = walkRenderer.lmL = {
      sc,
      list: (sc.props || []).filter(p => {
        const M = C0.props[p.k];
        return M && M.landmark;
      }),
    };
  let best = 0;
  for (const p of L.list) {
    if (typeof propShown === 'function' && !propShown(p)) continue;
    const M = C0.props[p.k],
      dz = p.z - P.z,
      dx = Math.abs(p.x - P.x);
    if (dz < 2 || dz > 18 || dx > 8) continue;
    const hm = (-M.oy / 34) * (p.s || 1),
      k = Math.min(1, (dz - 2) / 3) * Math.min(1, (18 - dz) / 6) * Math.min(1, (8 - dx) / 4);
    best = Math.max(best, k * clamp((hm - 5) * 1.6, 0, 11));
  }
  return best;
}
function drawFlatItem(fp, it, T) {
  const gl = gpuState.gl,
    U = fp.U,
    s = it.mpp,
    w = it.w * s,
    h = it.h * s,
    cx = it.x + (it.ox * s + w / 2) * it.flip,
    cz = it.z - (it.oy * s + h / 2) * 0.95;
  /* v22: lily pads on water bob and turn a little */ const wet = /lily/.test((it.p && it.p.k) || '') && !reducedMotion,
    ph = (walkView.t || 0) / 1000 + it.x * 1.3 + it.z * 0.7,
    an = wet ? Math.sin(ph * 0.45) * 0.07 : 0,
    bob = wet ? Math.sin(ph * 1.2) * 0.012 : 0;
  gl.uniform3f(U.uP, cx, standingHeightAt(it.x, it.z) + 0.04 + bob + worldCurveDrop(it.x, it.z), cz);
  gl.uniform3f(U.uRight, it.flip * Math.cos(an), 0, Math.sin(an));
  gl.uniform3f(U.uUp, -Math.sin(an) * it.flip, 0, Math.cos(an));
  gl.uniform2f(U.uS, w, h * 0.95);
  gl.uniform4f(U.uUV, 0, 0, 1, 1);
  gl.uniform4f(U.uCol, 1, 1, 1, 1);
  gl.uniform1f(U.uGlow, 0);
  gl.uniform1f(U.uLitFx, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  gl.uniform1i(U.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
export function addHitTarget(it, C, hits, labels, PPU) {
  const q = worldToScreen(C, it.x, 0, it.z);
  if (!q) return;
  const s = it.mpp,
    k = q.s * s,
    box = {
      x0: q.x + Math.min(it.ox * k * it.flip, (it.ox + it.w) * k * it.flip),
      x1: q.x + Math.max(it.ox * k * it.flip, (it.ox + it.w) * k * it.flip),
      y0: q.y + it.oy * k,
      y1: q.y + 4,
    };
  /* alpha 0.4.1: a tall thing you can tap (an airship station with its mast, a tower) answers only round its foot, so a
    tap on the ground behind its mast, or under the airship moored above, walks you there instead of to the station */
  if (it.k === 'prop' && it.p.act && -it.oy * s > 3.2) {
    const ps = it.p.s || 1;
    box.y0 = Math.max(box.y0, q.y - 2.8 * ps * q.s);
    if (it.M && it.M.box) {
      const hw = ((it.M.box[0] * ps) / 2 + 0.3) * q.s;
      box.x0 = Math.max(box.x0, q.x - hw);
      box.x1 = Math.min(box.x1, q.x + hw);
    }
  }
  if (it.k === 'prop' && it.p.act) {
    const go =
      it.p.act === 'climb' && typeof climbStartEnd === 'function' ? climbStartEnd(it.p) : actionSpot(it.p, it.M, PPU);
    hits.push({ k: 'act', act: it.p.act, p: it.p, ...box, z: q.d, go, look: [it.p.x, it.p.z] });
    const lb = actionLabel(it.p, it.M);
    if (lb) labels.push({ k: 'act', x: q.x, y: box.y0 - 4, t: lb, act: lb === 'Closed' ? 'closed' : it.p.act });
  } else if (it.k === 'buddy') {
    hits.push({ k: 'buddy', ...box, z: q.d - 0.5 });
  } else if (it.k === 'pet') {
    hits.push({ k: 'npc', n: it.n, ...box, z: q.d + 0.2, go: approachPoint(it.x, it.z), look: [it.x, it.z] });
  } else if (it.k === 'encm') {
    hits.push({ k: 'enc', e: it.e, ...box, z: q.d, go: approachPoint(it.x, it.z), look: [it.x, it.z] });
    if (it.e.alpha) labels.push({ k: 'bang', x: q.x, y: box.y0 - 6, col: '#FF3B6B' });
  } else if (it.k === 'npc') {
    hits.push({
      k: 'npc',
      n: it.n,
      ...box,
      x0: q.x - 18 * k,
      x1: q.x + 18 * k,
      z: q.d,
      go: approachPoint(it.x, it.z),
      look: [it.x, it.z],
    });
    if (!it.n.done) labels.push({ k: 'bang', x: q.x, y: box.y0, col: it.n.col || '#D9434B' });
  } else if (it.k === 'folk') {
    hits.push({ k: 'folk', f: it.f, ...box, x0: q.x - 16 * k, x1: q.x + 16 * k, z: q.d });
    if (typeof requestAsker === 'function' && it.f === requestAsker() && !(it.f.sayT > 0))
      labels.push({ k: 'bang', x: q.x, y: box.y0 - 2, col: '#E2B92C' });
    if (it.f.sayT > 0) labels.push({ k: 'say', x: q.x, y: box.y0 - 2, t: it.f.say, a: Math.min(1, it.f.sayT * 3) });
  } else if (it.k === 'enc') {
    const by = box.y0 - 8 - Math.abs(Math.sin(walkView.t / 380 + it.x)) * 4;
    hits.push({
      k: 'enc',
      e: it.e,
      x0: box.x0 - 14,
      x1: box.x1 + 14,
      y0: by - 22,
      y1: q.y + 4,
      z: q.d,
      go: approachPoint(it.x, it.z),
      look: [it.x, it.z],
    });
    labels.push({ k: 'enc', x: q.x, y: by, e: it.e });
  }
}
