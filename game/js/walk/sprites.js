'use strict';
/* ================= WALK SPRITES =================
   Phase 20 (stage B): the pictures standing in the scene (drawSprites), box faces, turning blades, clock hands, flat
   items, the title's town rise and tap targets, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { loadingScreen, provide, questMarked, reducedMotion, talkBox } from '../hooks.js';
import { clamp } from '../util.js';
import { pictureFacing, pictureRight } from '../logic/prop-turn.js';
import { hiddenEase, outlineColour } from '../logic/occlude.js';
import { INTEREST_DEFAULTS } from '../logic/camera-interest.js';
import { gpuTag } from '../engine/gpu-counters.js';
import { filterInto } from '../engine/frame-lists.js';
import { makeCanvas } from '../art.js';
import { lookOf, wardrobeData } from '../person-art.js';
import {
  LABEL_GOLD,
  actionLabel,
  actionSpot,
  approachPoint,
  artImage,
  climbStartEnd,
  doorOf,
  propShown,
  walkData,
  walkView,
  worldToScreen,
} from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import {
  SURFACE_MATERIALS,
  bindGridQuad,
  bindQuad,
  ensurePrograms,
  gpuState,
  imageTexture,
  normalize3,
} from '../engine/webgl.js';
import {
  SPRITE_INSTANCE_STRIDE,
  bindSpriteInstances,
  packSpriteInstance,
  spriteMaterialTable,
  uploadSpriteInstances,
} from '../engine/sprite-instances.js';
import { FIXED_BACK, FIXED_RIGHT, walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { SPRITE_INSTANCE_SHADERS } from './walk-shaders.js';
import { setSpriteGeometry, setSpriteUniforms, spriteGeometry, useWalkProgram, worldCurveDrop } from './draw-common.js';
import { frameBudgetLeft } from './quality-cull.js';
import { foliageAmount, setPropLookUniforms } from './prop-look.js';
/* eslint-disable no-func-assign */
expose({
  BOX_INFO_CACHE: [() => BOX_INFO_CACHE],
  DOOR_INTEREST: [() => DOOR_INTEREST],
  IMAGE_IDS: [() => IMAGE_IDS],
  OUTLINE_COLOURS: [() => OUTLINE_COLOURS],
  REFLECTION_MATERIALS: [() => REFLECTION_MATERIALS],
  REFLECTION_RECORDS: [() => REFLECTION_RECORDS],
  SILHOUETTE_AMOUNT: [() => SILHOUETTE_AMOUNT],
  SILHOUETTE_PULL: [() => SILHOUETTE_PULL],
  SILHOUETTE_TINT: [() => SILHOUETTE_TINT],
  SPRITE_FRAME: [() => SPRITE_FRAME],
  SPRITE_LIST: [() => SPRITE_LIST],
  SPRITE_RECORDS: [() => SPRITE_RECORDS],
  SPRITE_RUN: [() => SPRITE_RUN],
  addHitTarget: [() => addHitTarget, v => (addHitTarget = v)],
  boxInfo: [() => boxInfo, v => (boxInfo = v)],
  byImageId: [() => byImageId],
  copySpriteLook: [() => copySpriteLook, v => (copySpriteLook = v)],
  drawBoxFaces: [() => drawBoxFaces, v => setDrawBoxFaces(v)],
  drawClockHands: [() => drawClockHands, v => (drawClockHands = v)],
  drawFlatItem: [() => drawFlatItem, v => (drawFlatItem = v)],
  drawPlayerSilhouette: [() => drawPlayerSilhouette, v => setDrawPlayerSilhouette(v)],
  drawReflectionRuns: [() => drawReflectionRuns, v => ((drawReflectionRuns = v), provide({ drawReflectionRuns }))],
  drawRotatingBlades: [() => drawRotatingBlades, v => (drawRotatingBlades = v)],
  drawSpriteRuns: [() => drawSpriteRuns, v => (drawSpriteRuns = v)],
  drawSpriteWave: [() => drawSpriteWave, v => (drawSpriteWave = v)],
  drawSprites: [() => drawSprites, v => setDrawSprites(v)],
  easeHidden: [() => easeHidden, v => (easeHidden = v)],
  flushSpriteRun: [() => flushSpriteRun, v => (flushSpriteRun = v)],
  hideQuery: [() => hideQuery],
  imageId: [() => imageId, v => (imageId = v)],
  imageIdCount: [() => imageIdCount, v => (imageIdCount = v)],
  interestPoints: [() => interestPoints, v => (interestPoints = v)],
  landmarkTilt: [() => landmarkTilt, v => (landmarkTilt = v)],
  newSpriteRecord: [() => newSpriteRecord, v => (newSpriteRecord = v)],
  outlineColourOf: [() => outlineColourOf, v => (outlineColourOf = v)],
  personWho: [() => personWho, v => (personWho = v)],
  readHideQueries: [() => readHideQueries, v => (readHideQueries = v)],
  reflectionRecord: [() => reflectionRecord, v => (reflectionRecord = v)],
  setSpriteCrossRecord: [() => setSpriteCrossRecord, v => (setSpriteCrossRecord = v)],
  setSpriteRecord: [() => setSpriteRecord, v => (setSpriteRecord = v)],
  setSpriteShadeUniforms: [
    () => setSpriteShadeUniforms,
    v => ((setSpriteShadeUniforms = v), provide({ setSpriteShadeUniforms })),
  ],
  sortByPicture: [() => sortByPicture, v => ((sortByPicture = v), provide({ sortByPicture }))],
  spriteDrawList: [() => spriteDrawList, v => (spriteDrawList = v)],
  spriteDrawn: [() => spriteDrawn],
  spriteFrame: [() => spriteFrame, v => ((spriteFrame = v), provide({ spriteFrame }))],
  spriteHasParts: [() => spriteHasParts],
  spriteInstanceProgram: [() => spriteInstanceProgram, v => (spriteInstanceProgram = v)],
  spriteInstanceState: [() => spriteInstanceState],
  spriteInstancesReady: [() => spriteInstancesReady, v => (spriteInstancesReady = v)],
  spriteRecord: [() => spriteRecord, v => setSpriteRecord(v)],
  spriteRecordAt: [() => spriteRecordAt, v => (spriteRecordAt = v)],
  spriteSelfShade: [() => spriteSelfShade, v => (spriteSelfShade = v)],
  spriteSideEffects: [() => spriteSideEffects, v => (spriteSideEffects = v)],
  startTownRise: [() => startTownRise, v => (startTownRise = v)],
  talkPartner: [() => talkPartner, v => (talkPartner = v)],
  townRiseAmount: [() => townRiseAmount, v => (townRiseAmount = v)],
  useFxProgram: [() => useFxProgram, v => (useFxProgram = v)],
});
/* eslint-enable no-func-assign */
provide({ drawReflectionRuns, setSpriteShadeUniforms, sortByPicture, spriteFrame });
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
/* phase 20 C2: the sprite pass's list, kept from frame to frame (engine/frame-lists.js) */
const SPRITE_LIST = [],
  spriteDrawn = it => !(it.flat || it.vol || it.vis === false),
  byImageId = (a, b) => imageId(a.im) - imageId(b.im);
/* phase 20 E1: the pictures the sprite pass draws, grouped by picture (v32: fewer texture switches; depth decides what
   is in front, so order matters only where two pictures share a plane): imageId's first-seen order, then item order */
function spriteDrawList(items) {
  return filterInto(items, spriteDrawn, SPRITE_LIST).sort(byImageId);
}
/* a list of pictures in the same order (the reflection's) */
function sortByPicture(L) {
  return L.sort(byImageId);
}
/* phase 20 E1: what the pass works out once a frame: the camera, how much a crown shades itself and toward where (the
   sun across the picture), and how much a tree's crossing picture shows (by the camera's turn) */
const SPRITE_FRAME = { C: null, selfK: 0, selfD: [0, 0], crossK: 0 };
function spriteFrame(C, sun) {
  const F = SPRITE_FRAME,
    sd = sun.dir,
    sl = Math.hypot(sd[0] * C.right[0] + sd[2] * C.right[2], sd[1]) || 1,
    ss = engineSetting('shadows', 'selfShade') ?? 0.7;
  F.C = C;
  F.selfD[0] = (sd[0] * C.right[0] + sd[2] * C.right[2]) / sl;
  F.selfD[1] = -sd[1] / sl;
  F.selfK = sd[1] > 0.05 && ss > 0 ? ss * engineSetting('shadows', 'strength') * Math.min(1, sd[1] * 4) : 0;
  F.crossK = Math.abs(Math.sin(C.yaw || 0));
  return F;
}
/* alpha 0.4.1: how much a tree's crown shades itself (props over 1.2 m that are leaves, facing the camera, not far) */
function spriteSelfShade(it, F) {
  return F.selfK > 0 && it.k === 'prop' && !it.fixed && !it.far && -it.oy * it.mpp > 1.2 && foliageAmount(it)[0] > 0
    ? F.selfK
    : 0;
}
/* phase 20 E3: the season on leaves, a crown's self-shade and noRecv for a picture drawn outside the pass (the
   reflection's) */
function setSpriteShadeUniforms(U, it, F) {
  const gl = gpuState.gl,
    f = foliageAmount(it);
  if (U.uFol) gl.uniform2f(U.uFol, f[0], f[1]);
  if (U.uSelf) gl.uniform3f(U.uSelf, spriteSelfShade(it, F), F.selfD[0] * (it.flip || 1), F.selfD[1]);
  if (U.uNoRecv) gl.uniform1f(U.uNoRecv, it.noRecv ? 1 : 0);
}
/* phase 20 E1: one picture's draw as values, the uniforms it is drawn with, in a record kept from frame to frame. mode:
   'model' (a model: no picture; its hit target and clock hands), 'front' (a 3D building's front, drawn with its walls),
   'none' (no texture yet, or not risen yet), 'wave' (a flag, on the grid quad), 'quad'. A tree's crossing picture is
   its own record (cr, drawn when crossOn) */
function newSpriteRecord(cross) {
  return {
    it: null,
    mode: 'none',
    T: null,
    x: 0,
    y: 0,
    z: 0,
    ox: 0,
    oy: 0,
    w: 0,
    h: 0,
    uv: new Float32Array([0, 0, 1, 1]),
    flip: 1,
    slope: 0,
    shear: 0,
    right: new Float32Array(3),
    back: new Float32Array(3),
    fixed: 0,
    noRecv: 0,
    flipN: 1,
    lk: null,
    mt: null,
    fol: [0, 0],
    self: [0, 0, 0],
    emit: 0,
    fade: 1,
    rim: 0,
    lit: 1,
    shade: 0,
    dz: 0,
    wave: null,
    rk: 1,
    crossOn: false,
    cr: cross ? newSpriteRecord(false) : null,
    inst: 0,
    cam: false,
  };
}
const SPRITE_RECORDS = [];
function spriteRecordAt(i) {
  return SPRITE_RECORDS[i] || (SPRITE_RECORDS[i] = newSpriteRecord(true));
}
function spriteRecord(it, F, r) {
  r.it = it;
  r.crossOn = false;
  if (it.vox) return (r.mode = 'model');
  const T = (r.T = imageTexture(it.im));
  if (!T) return (r.mode = 'none');
  /* player visibility: a picture covering you is thinned out already (walk/quality-cull.js coverItems) */
  const fade = (r.fade = it.fade ?? 1),
    rk = (r.rk = walkRenderer.rise ? townRiseAmount(it) : 1);
  if (rk < 0.002 && !it.person) return (r.mode = 'none');
  if (it.bld3) return (r.mode = 'front');
  const C = F.C;
  /* phase 09 batch 8: a model's picture layer may face another way than the front (yaw, radians: pi/2 the right side,
     pi the back), a tower's windows on every face; phase 09 batch 9: and the placement's turn (logic/prop-turn.js) */
  if (it.fixed) {
    const ro = pictureFacing(it);
    if (ro) {
      const cr = Math.cos(ro),
        sr = Math.sin(ro);
      r.right[0] = cr;
      r.right[1] = 0;
      r.right[2] = sr;
      r.back[0] = sr;
      r.back[1] = 0;
      r.back[2] = -cr;
    } else {
      r.right.set(FIXED_RIGHT);
      r.back.set(FIXED_BACK);
    }
  } else {
    r.right.set(C.right);
    r.back.set(C.back);
  }
  r.fixed = it.fixed && it.plane ? 1 : 0;
  /* phase 09 batch 1: a tree's leaf clumps take no shadows from the shadow map (their crown's own shadow would stripe
     them); the crown shades itself instead (self) */
  r.noRecv = it.noRecv ? 1 : 0;
  r.flipN = it.flip || 1;
  r.lk = it.lk;
  r.mt = SURFACE_MATERIALS[it.mat] || SURFACE_MATERIALS[it.person ? 'cloth' : 'plain'];
  const f = foliageAmount(it);
  r.fol[0] = f[0];
  r.fol[1] = f[1];
  r.self[0] = spriteSelfShade(it, F);
  r.self[1] = F.selfD[0] * (it.flip || 1);
  r.self[2] = F.selfD[1];
  r.emit = it.glow ? it.glow * 1.6 : 0;
  r.rim = it.person ? 0.4 : 0.12;
  r.lit = it.glow ? Math.max(0, 1 - it.glow) : it.far ? 0.75 : 1;
  r.shade = it.person ? 0.45 : it.far ? 0.3 : 0.55;
  spriteGeometry(r, it, it.z, rk);
  /* phase 09 batch 10: a model's picture layer may be pulled toward the eye (prop-models.js eyeward) */
  r.dz = it.eyeward ? -it.eyeward : 0;
  r.wave = it.wave || null;
  if (it.wave) return (r.mode = 'wave');
  /* trees get a second picture crossing the first, so a turned camera sees a crown, not a cut-out's edge (IS-1: by the
     sine of the turn, so a camera looking south, as an orbiting one does, sees the first picture face on again and the
     second edge-on fades out). It keeps the first's look, at its full height and with no pull toward the eye */
  if (it.cross && F.crossK > 0.04) {
    const c = r.cr;
    r.crossOn = true;
    copySpriteLook(c, r);
    c.right[0] = 0;
    c.right[1] = 0;
    c.right[2] = it.flip > 0 ? 1 : -1;
    c.back[0] = -1;
    c.back[1] = 0;
    c.back[2] = 0;
    c.fixed = 0;
    c.fade = fade * Math.min(1, F.crossK * 4);
    c.dz = 0;
    spriteGeometry(c, it);
  }
  return (r.mode = 'quad');
}
/* the values a crossing picture keeps from its tree's record */
function copySpriteLook(c, r) {
  c.it = r.it;
  c.mode = 'quad';
  c.T = r.T;
  c.noRecv = r.noRecv;
  c.flipN = r.flipN;
  c.lk = r.lk;
  c.mt = r.mt;
  c.fol[0] = r.fol[0];
  c.fol[1] = r.fol[1];
  c.self[0] = r.self[0];
  c.self[1] = r.self[1];
  c.self[2] = r.self[2];
  c.emit = r.emit;
  c.rim = r.rim;
  c.lit = r.lit;
  c.shade = r.shade;
  c.rk = 1;
  c.wave = null;
}
/* phase 20 E1: a record's uniforms, in the order the pass sent them before the records */
function setSpriteRecord(p, r) {
  const gl = gpuState.gl,
    U = p.U,
    it = r.it,
    mt = r.mt;
  gl.uniform3fv(U.uRight, r.right);
  gl.uniform3fv(U.uBack, r.back);
  gl.uniform1f(U.uFixed, r.fixed);
  if (U.uNoRecv) gl.uniform1f(U.uNoRecv, r.noRecv);
  gl.uniform1f(U.uFlipN, r.flipN);
  setPropLookUniforms(U, r.lk);
  gl.uniform4f(U.uMat, mt.spec, mt.shin, mt.transl, mt.wrap);
  if (U.uFol) gl.uniform2f(U.uFol, r.fol[0], r.fol[1]);
  if (U.uSelf) gl.uniform3f(U.uSelf, r.self[0], r.self[1], r.self[2]);
  gl.uniform1f(U.uEmit, r.emit);
  gl.uniform1f(U.uFade, r.fade);
  gl.uniform1f(U.uRim, r.rim);
  gl.uniform1f(U.uLit, r.lit);
  gl.uniform1f(U.uShade, r.shade);
  gl.uniform3f(U.uBaseP, it.x, it.y, it.z);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.T.t);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, r.T.n);
  setSpriteGeometry(p, r);
  if (r.dz) gl.uniform1f(U.uDZ, r.dz);
}
/* a crossing picture's: only what differs from its tree's */
function setSpriteCrossRecord(p, c) {
  const gl = gpuState.gl,
    U = p.U;
  gl.uniform3f(U.uRight, c.right[0], c.right[1], c.right[2]);
  gl.uniform3f(U.uBack, c.back[0], c.back[1], c.back[2]);
  gl.uniform1f(U.uFixed, c.fixed);
  gl.uniform1f(U.uFade, c.fade);
  setSpriteGeometry(p, c);
}
/* phase 20 E2: what the pass does for a picture besides drawing it, in the order it always did: a model's hit target
   and clock hands, a 3D building front's fade (its walls are drawn with it, drawBoxFaces) and hit target, a picture's
   turning blades, clock hands and hit target (not for far pictures or a model's layers). A flag does none of these */
function spriteSideEffects(p, r, C, X, hits, labels, PPU, sc) {
  const it = r.it;
  if (r.mode === 'model') {
    if (!it.far) addHitTarget(it, C, hits, labels, PPU);
    /* phase 09: a modelled clock tower keeps its moving hands (pictures on its modelled face) */
    if (it.M && it.M.hands && !it.far && !it.layer) drawClockHands(p, it, C, X);
    return;
  }
  if (r.mode === 'front') {
    walkRenderer.bfade.set(it, r.fade * Math.min(1, r.rk));
    addHitTarget(it, C, hits, labels, PPU);
    return;
  }
  if (r.mode !== 'quad') return;
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
  if (it.far || it.layer) return;
  addHitTarget(it, C, hits, labels, PPU);
}
/* a flag: cloth that ripples (the sprite program's grid quad, uWave) */
function drawSpriteWave(p, r) {
  const gl = gpuState.gl,
    U = p.U;
  setSpriteRecord(p, r);
  gl.uniform3fv(U.uWave, r.wave);
  bindGridQuad();
  gl.drawArrays(gl.TRIANGLES, 0, gpuState.gridN);
  gl.uniform3f(U.uWave, 0, 0, 0);
  if (r.dz) gl.uniform1f(U.uDZ, 0);
  bindQuad();
}
/* ---------- phase 20 E7-E8: the pictures as instances (Engine > Quality "Pictures in batches") ----------
   The same records, packed into one buffer a frame (engine/sprite-instances.js), drawn as runs: each run is the
   pictures next to each other in the pass's order that share a texture, a tree's crossing picture the instance after
   its tree, so the pictures are drawn in the order they always were. A flag (the sprite program's grid quad) and a
   picture with turning blades or clock hands (drawn right after it) end a run. If the program does not build on this
   device the pass keeps one draw a picture (the debug log says so). */
const spriteInstanceState = { bad: null };
/* is the instanced program on and built (built on first use if the precompile list did not start it) */
function spriteInstancesReady() {
  if (!engineSetting('quality', 'spriteInstances')) return false;
  const gl = gpuState.gl;
  if (spriteInstanceState.bad === gl) return false;
  if (!gpuState.P.spriteI)
    try {
      ensurePrograms(SPRITE_INSTANCE_SHADERS);
    } catch (e) {
      spriteInstanceState.bad = gl;
      console.error(e);
      if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'pictures in batches off: ' + e.message);
      return false;
    }
  return true;
}
function spriteInstanceProgram(C, X, sh) {
  if (!spriteInstancesReady()) return null;
  const gl = gpuState.gl,
    ip = useWalkProgram('spriteI', C, X),
    U = ip.U;
  gl.uniform3fv(U.uCamRight, C.right);
  gl.uniform3fv(U.uCamBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform3fv(U.uSunH, sh);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNrm, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uCurveOn, 1);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, engineSetting('color', 'outlines') ?? 1);
  gl.uniform4fv(U.uMats, spriteMaterialTable());
  return ip;
}
/* the run being gathered: its texture, first instance, instance count, counter tag; on: the instanced program is the
   one in use */
const SPRITE_RUN = { T: null, first: 0, n: 0, tag: 0, on: false };
function flushSpriteRun(ip) {
  const R = SPRITE_RUN;
  if (!R.n) return;
  const gl = gpuState.gl;
  if (!R.on) {
    gl.useProgram(ip.p);
    R.on = true;
  }
  gpuTag(R.tag);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, R.T.t);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, R.T.n);
  bindSpriteInstances(R.first);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, R.n);
  gl.bindVertexArray(null);
  R.n = 0;
}
/* a picture whose blades or clock hands are drawn right after it */
const spriteHasParts = it => !!(it.M && (it.M.blades || (it.M.hands && !it.far && !it.layer)));
function drawSpriteRuns(p, ip, F, L, C, X, hits, labels, PPU, sc) {
  const gl = gpuState.gl,
    R = SPRITE_RUN;
  let k = 0;
  for (let i = 0; i < L.length; i++) {
    const r = spriteRecordAt(i);
    spriteRecord(L[i], F, r);
    r.inst = k;
    if (r.mode !== 'quad') continue;
    packSpriteInstance(k++, r, !r.it.fixed);
    if (r.crossOn) packSpriteInstance(k++, r.cr, false);
  }
  uploadSpriteInstances(k * SPRITE_INSTANCE_STRIDE);
  R.n = 0;
  R.on = true;
  for (let i = 0; i < L.length; i++) {
    const r = spriteRecordAt(i),
      it = r.it,
      tag = it.voxImg || it.vox ? 'modelPic' : 0;
    if (r.mode === 'quad') {
      if (R.n && R.T !== r.T) flushSpriteRun(ip);
      if (!R.n) {
        R.T = r.T;
        R.first = r.inst;
        R.tag = tag;
      }
      R.n += r.crossOn ? 2 : 1;
      if (spriteHasParts(it)) flushSpriteRun(ip);
    } else if (r.mode === 'wave') {
      flushSpriteRun(ip);
      if (R.on) gl.useProgram(p.p);
      R.on = false;
      gpuTag(tag);
      drawSpriteWave(p, r);
    } else if (r.mode === 'model' && spriteHasParts(it)) flushSpriteRun(ip);
    gpuTag(tag);
    /* blades and hands leave the sprite program in use */
    if (spriteHasParts(it) && r.mode !== 'none' && r.mode !== 'front' && r.mode !== 'wave') R.on = false;
    spriteSideEffects(p, r, C, X, hits, labels, PPU, sc);
  }
  flushSpriteRun(ip);
  /* the pass ends on the sprite program (its uniforms are put back after the pictures) */
  if (R.on) gl.useProgram(p.p);
  R.on = false;
}
export function drawSprites(C, items, X, hits, labels, PPU) {
  const gl = gpuState.gl,
    p = useWalkProgram('sprite', C, X),
    U = p.U,
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
  if (walkRenderer.bfade) walkRenderer.bfade.clear();
  else walkRenderer.bfade = new Map();
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  const F = spriteFrame(C, sun),
    L = spriteDrawList(items),
    ip = spriteInstanceProgram(C, X, sh);
  if (ip) drawSpriteRuns(p, ip, F, L, C, X, hits, labels, PPU, sc);
  else
    for (let i = 0; i < L.length; i++) {
      const it = L[i],
        r = spriteRecordAt(i);
      /* R1 measure: a model's picture layers (and a modelled clock's hands) counted apart (engine/gpu-counters.js) */
      gpuTag(it.voxImg || it.vox ? 'modelPic' : 0);
      const mode = spriteRecord(it, F, r);
      if (mode === 'wave') drawSpriteWave(p, r);
      else if (mode === 'quad') {
        setSpriteRecord(p, r);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (r.dz) gl.uniform1f(U.uDZ, 0);
        if (r.crossOn) {
          setSpriteCrossRecord(p, r.cr);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      }
      spriteSideEffects(p, r, C, X, hits, labels, PPU, sc);
    }
  gpuTag(0);
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
/* terrain TR-3, then player visibility: your silhouette wherever something hides you (rock, a building, a tree, a
   model). You are drawn again as a flat dithered tint wherever something clearly nearer the camera hides you (depth
   GREATER, the picture pulled 0.8 m toward the eye so the ground at your feet, grass and low things right by you don't
   count); nothing is written to depth. A first, invisible draw of the whole picture is an occlusion query: its answer
   (a frame or two late) says whether anything hides you at all, eased into walkRenderer.hidK (0-1), which turns on
   the see-through circle (draw-common.js rockUniformsFor). Off indoors, in battle and with Engine > Camera >
   "Your outline when hidden" off */
const SILHOUETTE_TINT = [0.16, 0.27, 0.55],
  SILHOUETTE_AMOUNT = 0.55,
  SILHOUETTE_PULL = 0.8;
/* player visibility: the outline's colour is the colour of the top someone wears (logic/occlude.js outlineColour
   lifts a dark one), looked up at most once a second for each person ('me', a person's id, 'folk:<seed>') */
const OUTLINE_COLOURS = new Map();
function outlineColourOf(who) {
  const now = performance.now(),
    e = OUTLINE_COLOURS.get(who);
  if (e && now - e.t < 1000) return e.c;
  let hex = null;
  try {
    const L = lookOf(who),
      top = L && L.wear && L.wear.top,
      I = top && wardrobeData() && wardrobeData().items[top];
    hex = (top && L.colors[top] && L.colors[top][0]) || (I && I.colors && I.colors[0] && I.colors[0][1]) || null;
  } catch (err) {
    hex = null;
  }
  const c = outlineColour(hex) || SILHOUETTE_TINT;
  OUTLINE_COLOURS.set(who, { t: now, c });
  return c;
}
/* the occlusion queries in flight, oldest first (made on gpuState.gl; a lost context drops them) */
const hideQuery = { gl: null, q: /** @type {WebGLQuery[]} */ ([]), at: 0 };
function readHideQueries(gl) {
  if (hideQuery.gl !== gl) ((hideQuery.gl = gl), (hideQuery.q = []));
  const Q = hideQuery.q;
  try {
    while (Q.length && gl.getQueryParameter(Q[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = Q.shift();
      walkRenderer.hidT = gl.getQueryParameter(q, gl.QUERY_RESULT) ? 1 : 0;
      gl.deleteQuery(q);
    }
  } catch (e) {
    hideQuery.q = [];
  }
}
function easeHidden(on) {
  const now = performance.now(),
    dt = Math.min(0.1, Math.max(0, (now - (hideQuery.at || now)) / 1000));
  hideQuery.at = now;
  if (!on) walkRenderer.hidT = 0;
  walkRenderer.hidK = hiddenEase(walkRenderer.hidK || 0, on ? walkRenderer.hidT || 0 : 0, dt);
}
/* player visibility: the one you are talking to (walkRenderer.talkAt marks where) shows the same way, in their top's
   colour, while the conversation is open; it doesn't count toward your hidden amount */
function talkPartner(items) {
  const ta = walkRenderer.talkAt;
  if (!talkBox || !talkBox.on || !ta) return null;
  let best = null,
    bd = 1.5;
  for (const it of items)
    if ((it.k === 'npc' || it.k === 'folk') && it.im) {
      const d = Math.hypot(it.x - ta.x, it.z - ta.z);
      if (d < bd) ((bd = d), (best = it));
    }
  return best;
}
function personWho(it) {
  return it.k === 'me' ? 'me' : it.n ? it.n.who : it.f ? 'folk:' + it.f.seed : null;
}
export function drawPlayerSilhouette(C, items, X) {
  const sc = walkView.sc;
  if (walkRenderer.bt || !sc || sc.indoor || sc.room || !engineSetting('camera', 'silhouette'))
    return (easeHidden(false), 0);
  const it = items.find(i => i.k === 'me');
  const T = it && it.im && imageTexture(it.im);
  if (!T) return (easeHidden(false), 0);
  const gl = gpuState.gl,
    p = useWalkProgram('sprite', C, X),
    U = p.U;
  readHideQueries(gl);
  bindQuad();
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform1f(U.uDZ, 0);
  gl.uniform1f(U.uCurveOn, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uFade, 1);
  if (U.uWave) gl.uniform3f(U.uWave, 0, 0, 0);
  gl.uniform4f(U.uGhostV, C.eye[0], C.eye[1], C.eye[2], SILHOUETTE_PULL);
  gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.GREATER);
  gl.depthMask(false);
  gl.disable(gl.BLEND);
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  setSpriteUniforms(p, it);
  /* the query: every pixel of you, nothing drawn; one in flight at a time is plenty */
  if (hideQuery.q.length < 2) {
    const q = gl.createQuery();
    gl.colorMask(false, false, false, false);
    gl.uniform4f(U.uGhost, 0, 0, 0, 1);
    gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
    gl.colorMask(true, true, true, true);
    hideQuery.q.push(q);
  }
  const ow = +(engineSetting('camera', 'outline') ?? 1) || 0,
    fill = Math.max(0.001, +(engineSetting('camera', 'outlineFill') ?? 0.25));
  if (U.uGhostE) gl.uniform1f(U.uGhostE, ow);
  const ghost = who => {
    const tint = ow > 0 ? outlineColourOf(who) : SILHOUETTE_TINT;
    gl.uniform4f(U.uGhost, tint[0], tint[1], tint[2], ow > 0 ? fill : SILHOUETTE_AMOUNT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  ghost('me');
  const pt = talkPartner(items),
    PT = pt && imageTexture(pt.im);
  if (PT) {
    gl.bindTexture(gl.TEXTURE_2D, PT.t);
    setSpriteUniforms(p, pt);
    ghost(personWho(pt));
  }
  if (U.uGhostE) gl.uniform1f(U.uGhostE, 0);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.uniform4f(U.uGhost, 0, 0, 0, 0);
  gl.uniform4f(U.uGhostV, 0, 0, 0, 0);
  easeHidden(true);
  return walkRenderer.hidT ? 1 : 0;
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
/* island track IS-1: `yaw` is the way the camera faces (0, north, everywhere but an orbiting island); a landmark counts
   when it stands ahead along that way */
export function landmarkTilt(P, sc, yaw = 0) {
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
  const fx = Math.sin(yaw),
    fz = Math.cos(yaw);
  for (const p of L.list) {
    if (typeof propShown === 'function' && !propShown(p)) continue;
    const M = C0.props[p.k],
      ox = p.x - P.x,
      oz = p.z - P.z,
      dz = ox * fx + oz * fz,
      dx = Math.abs(ox * fz - oz * fx);
    if (dz < 2 || dz > 18 || dx > 8) continue;
    const hm = (-M.oy / 34) * (p.s || 1),
      k = Math.min(1, (dz - 2) / 3) * Math.min(1, (18 - dz) / 6) * Math.min(1, (8 - dx) / 4);
    best = Math.max(best, k * clamp((hm - 5) * 1.6, 0, 11));
  }
  return best;
}
/* CAM-2: the scene's points of interest (logic/camera-interest.js), kept per scene: a catalogue entry's `interest`
   ({weight, radius, zoom, pull}, any of them), else a landmark's default, else a door that counts; props not
   shown now (propShown) are left out when asked */
/* the doors that count: where you buy, heal or work (a run town's shop and clinic, the hub's lab and ranch) */
const DOOR_INTEREST = ['shop', 'clinic', 'lab', 'ranch'];
export function interestPoints(sc) {
  if (!sc) return [];
  const C0 = walkData().sc;
  let L = walkRenderer.intL;
  if (!L || L.sc !== sc) {
    const list = [];
    (sc.props || []).forEach((p, i) => {
      const M = C0.props[p.k];
      if (!M) return;
      const door = DOOR_INTEREST.includes(p.act) && !!M.door,
        base = M.landmark ? INTEREST_DEFAULTS.landmark : door ? INTEREST_DEFAULTS.door : null;
      if (!base && !M.interest) return;
      list.push({ p, door, pt: { id: `${p.k}#${i}`, ...INTEREST_DEFAULTS.landmark, ...base, ...M.interest } });
    });
    L = walkRenderer.intL = { sc, list };
  }
  /* where each is, read now (the seamless world moves the props when it re-anchors) */
  const out = [];
  for (const o of L.list) {
    if (typeof propShown === 'function' && !propShown(o.p)) continue;
    const at = o.door ? doorOf(o.p).at : [+o.p.x, +o.p.z];
    out.push({ ...o.pt, x: at[0], z: at[1] });
  }
  return out;
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
  } else if (it.k === 'ranchBilly') {
    hits.push({ k: 'ranchBilly', uid: it.uid, ...box, z: q.d - 0.3 });
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
    /* RL-12b: a route trainer's "!" only once it has spotted you */
    if (!it.n.done && (!it.n.route || walkView.spotted[it.n.id]))
      labels.push({ k: 'bang', x: q.x, y: box.y0, col: it.n.col || '#D9434B' });
    /* TW-3: a quest giver's gold "!" while their town's offer is open */ else if (
      it.n.talk &&
      it.n.talk.quest &&
      typeof questMarked === 'function' &&
      questMarked(it.n.talk)
    )
      labels.push({ k: 'bang', x: q.x, y: box.y0, col: LABEL_GOLD });
  } else if (it.k === 'folk') {
    hits.push({ k: 'folk', f: it.f, ...box, x0: q.x - 16 * k, x1: q.x + 16 * k, z: q.d });
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
/* ---------- phase 20 E10: the reflection's pictures as instances ----------
   The values the reflection's own loop (walk/water.js reflectionPass) sends: the picture's right as it turns
   (pictureRight), the camera's back, no fade, rim or emit, its fixed lighting (uMat 0, 1, 0, .15 for every picture:
   the material table filled with it), the season and self-shade as the main pass (E3). Drawn in runs as the main pass
   is, on the mirrored camera RC with no world curve. */
const REFLECTION_RECORDS = [],
  REFLECTION_MATERIALS = new Float32Array(32);
for (let i = 0; i < 8; i++) REFLECTION_MATERIALS.set([0, 1, 0, 0.15], i * 4);
function reflectionRecord(it, F, C, r) {
  r.it = it;
  r.crossOn = false;
  const T = (r.T = imageTexture(it.im));
  if (!T) return (r.mode = 'none');
  const R = pictureRight(it, C.right);
  r.cam = R === C.right;
  r.right.set(R);
  r.back.set(C.back);
  r.fixed = 0;
  r.noRecv = it.noRecv ? 1 : 0;
  r.flipN = 1;
  r.lk = it.lk;
  r.mt = SURFACE_MATERIALS.plain;
  const f = foliageAmount(it);
  r.fol[0] = f[0];
  r.fol[1] = f[1];
  r.self[0] = spriteSelfShade(it, F);
  r.self[1] = F.selfD[0] * (it.flip || 1);
  r.self[2] = F.selfD[1];
  r.emit = 0;
  r.fade = 1;
  r.rim = 0;
  r.lit = 1;
  r.shade = 0.3;
  spriteGeometry(r, it);
  r.dz = 0;
  r.wave = null;
  return (r.mode = 'quad');
}
/* the reflection's pictures (already in the main pass's order) on the mirrored camera RC; C is the frame's camera */
function drawReflectionRuns(RC, C, X, pics, F) {
  if (!spriteInstancesReady()) return false;
  const gl = gpuState.gl,
    ip = useWalkProgram('spriteI', RC, X),
    U = ip.U,
    R = SPRITE_RUN;
  gl.uniform3fv(U.uCamRight, C.right);
  gl.uniform3fv(U.uCamBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform3f(U.uSunH, 0, 0, 0);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNrm, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uCurveOn, 0);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, 0);
  gl.uniform4fv(U.uMats, REFLECTION_MATERIALS);
  let k = 0;
  for (let i = 0; i < pics.length; i++) {
    const r = REFLECTION_RECORDS[i] || (REFLECTION_RECORDS[i] = newSpriteRecord(false));
    reflectionRecord(pics[i], F, C, r);
    r.inst = k;
    if (r.mode === 'quad') packSpriteInstance(k++, r, r.cam);
  }
  uploadSpriteInstances(k * SPRITE_INSTANCE_STRIDE);
  R.n = 0;
  R.on = true;
  for (let i = 0; i < pics.length; i++) {
    const r = REFLECTION_RECORDS[i];
    if (r.mode !== 'quad') continue;
    if (R.n && R.T !== r.T) flushSpriteRun(ip);
    if (!R.n) {
      R.T = r.T;
      R.first = r.inst;
      R.tag = r.it.voxImg ? 'modelPic' : 0;
    }
    R.n++;
  }
  flushSpriteRun(ip);
  R.on = false;
  return true;
}
