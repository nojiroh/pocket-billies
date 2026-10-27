'use strict';
/* ================= WALK SHADOWS =================
   Phase 20 (stage B): the sun's two shadow maps, the lamps' shadow maps and the shadow sprites, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  buildingFrontPicture,
  buildingGuard,
  buildingState,
  buildingsOn,
  drawBuildingShadows,
  drawGroundDepth,
  drawPropModelShadows,
  drawSolidPropShadows,
  drawStructureShadows,
  propModelMesh,
  provide,
  roomFloorOf,
} from '../hooks.js';
import { pictureRight, placedTurn } from '../logic/prop-turn.js';
import { personPicture } from '../logic/person-view.js';
import { gpuPass, gpuTag } from '../engine/gpu-counters.js';
import { filterInto } from '../engine/frame-lists.js';
import { walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { ensurePrograms, gpuState, imageTexture, normalize3, renderTarget } from '../engine/webgl.js';
import { beginLampShadow, beginSunShadow, endShadow, frameBlockStale } from '../engine/light.js';
import { LIGHT_HOLD_M } from '../engine/light-pick.js';
import {
  SPRITE_INSTANCE_STRIDE,
  bindSpriteInstances,
  packShadowInstance,
  uploadSpriteInstances,
} from '../engine/sprite-instances.js';
import { FIXED_RIGHT, walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { WALK_SHADERS } from './walk-shaders.js';
import { spriteGeometry, worldCurveArgs } from './draw-common.js';
import { screenRay } from './camera.js';
/* eslint-disable no-func-assign */
expose({
  LAMP_SHADOWED: [() => LAMP_SHADOWED],
  SHADOW_INSTANCE_DECLS: [() => SHADOW_INSTANCE_DECLS],
  SHADOW_INSTANCE_IN: [() => SHADOW_INSTANCE_IN],
  SHADOW_INSTANCE_SHADERS: [() => SHADOW_INSTANCE_SHADERS],
  SHADOW_LISTS: [() => SHADOW_LISTS],
  SHADOW_QUADS: [() => SHADOW_QUADS],
  drawShadowSprites: [() => drawShadowSprites, v => (drawShadowSprites = v)],
  drawShadowSpritesInstanced: [() => drawShadowSpritesInstanced, v => (drawShadowSpritesInstanced = v)],
  fittedShadowPass: [() => fittedShadowPass, v => (fittedShadowPass = v)],
  lampShadowMaps: [() => lampShadowMaps, v => (lampShadowMaps = v)],
  pickShadowLamps: [() => pickShadowLamps, v => (pickShadowLamps = v)],
  shadowCasterSignature: [() => shadowCasterSignature, v => (shadowCasterSignature = v)],
  shadowHoldsStill: [() => shadowHoldsStill, v => (shadowHoldsStill = v)],
  shadowInstanceState: [() => shadowInstanceState],
  shadowInstanceVertex: [() => shadowInstanceVertex, v => (shadowInstanceVertex = v)],
  shadowInstancesReady: [() => shadowInstancesReady, v => (shadowInstancesReady = v)],
  shadowMapArea: [() => shadowMapArea, v => (shadowMapArea = v)],
  shadowPass: [() => shadowPass, v => setShadowPass(v)],
  shadowQuad: [() => shadowQuad, v => (shadowQuad = v)],
  shadowSpriteQuads: [() => shadowSpriteQuads, v => (shadowSpriteQuads = v)],
});
/* eslint-enable no-func-assign */
export function setShadowPass(v) {
  shadowPass = v; // eslint-disable-line no-func-assign
  provide({ shadowPass });
}
/* to-module: end */
/* v19: the shadow map covers the ground the camera sees (plus a margin for tall things just outside), not the whole
   scene, so its texels are smaller where it matters; the radius moves in 2 m steps */
function shadowMapArea(C) {
  const sc = walkView.sc,
    full = [sc.w / 2, sc.h / 2, Math.hypot(sc.w, sc.h) / 2 + 6];
  if (!C || !engineSetting('shadows', 'fit')) return full;
  const P = walkView.pl,
    y0 = standingHeightAt(P.x, P.z),
    X = [],
    Z = [];
  for (const [sx, sy] of [
    [0, 0],
    [C.rw, 0],
    [0, C.rh],
    [C.rw, C.rh],
    [C.rw / 2, C.rh / 2],
  ]) {
    const r = screenRay(C, sx, sy);
    const t = r.d[1] < -0.02 ? Math.min(55, (y0 - r.o[1]) / r.d[1]) : 55;
    X.push(r.o[0] + r.d[0] * t);
    Z.push(r.o[2] + r.d[2] * t);
  }
  const x0 = Math.max(-6, Math.min(...X)),
    x1 = Math.min(sc.w + 6, Math.max(...X)),
    z0 = Math.max(-6, Math.min(...Z)),
    z1 = Math.min(sc.h + 6, Math.max(...Z));
  if (!(x1 > x0 && z1 > z0)) return full;
  const rad = Math.ceil((Math.hypot(x1 - x0, z1 - z0) / 2 + 6) / 2) * 2;
  return rad >= full[2] ? full : [(x0 + x1) / 2, (z0 + z1) / 2, Math.max(12, rad)];
}
/* v34: a shadow cache. Things that never move (the ground, buildings, rocks, still props) are drawn into a second
   depth map and kept there; each frame that copy is laid down first and only moving things (people, billionaires,
   swaying trees, boats) are drawn on top. The square the map covers moves in 3 m steps so the copy stays usable while
   you walk; the sun's slow travel or any change to the scene draws it again. */
/* v43: two cascades. The far map is the fitted view as before (cached for what never moves); the near map is a tight
   square round you at a finer texel, drawn every frame from the things in it, so shadows near you are crisp */
/* phase 20 C2: the shadow passes' lists of what they draw, refilled in place each frame (engine/frame-lists.js) */
const SHADOW_LISTS = { near: [], far: [], stat: [], dyn: [], lamp: [] };
export function shadowPass(items0, sun, C) {
  gpuPass('shadowFar');
  const far = fittedShadowPass(items0, sun, C);
  if (
    !(engineSetting('shadows', 'cascades') ?? true) ||
    (walkRenderer.bt && (engineSetting('quality', 'battleLite') ?? true))
  )
    return far;
  const P = walkView.pl,
    R = engineSetting('shadows', 'nearRadius') ?? 13,
    res = Math.min(1024, engineSetting('quality', 'shadowMap')),
    gl = gpuState.gl,
    items = filterInto(
      items0,
      it => Math.hypot(it.x - P.x, it.z - P.z) < R + (it.w || 32) * (it.mpp || 0.03) + 3,
      SHADOW_LISTS.near
    );
  gpuPass('shadowNear');
  const SH = beginSunShadow(P.x, P.z, R, sun, res, 'shadowN', Math.round(P.yv ?? standingHeightAt(P.x, P.z))),
    ca = worldCurveArgs();
  {
    const p = gpuState.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    drawGroundDepth(p, walkView.sc);
  }
  drawShadowSprites(SH, items, sun, ca);
  if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, items);
  if (typeof drawStructureShadows === 'function') drawStructureShadows(SH);
  if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, items);
  if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, items);
  endShadow();
  SH.far = far;
  return SH;
}
/* phase 20 C5: the lamps shadowed last frame. With quality.stableLights on a lit lamp is the same object from frame to
   frame (engine/light-pick.js), so one shadowed counts LIGHT_HOLD_M nearer and two equal lamps don't trade the shadow
   maps; off, the lights are made new each frame and none ever matches. */
const LAMP_SHADOWED = [];
/* the n lamps of L that throw shadows (hanging high, not a window's light, within 22 m of (x, z)), nearest first */
function pickShadowLamps(L, x, z, n) {
  /* Lamp shadows hold (shadows.lampFix): high above the ground where it stands (above sea level before), never a pool */
  const fix = !!engineSetting('shadows', 'lampFix'),
    dist = l => Math.hypot(l.p[0] - x, l.p[2] - z) - (LAMP_SHADOWED.includes(l) ? LIGHT_HOLD_M : 0),
    cand = n
      ? L.filter(
          l =>
            !l.front &&
            !(fix && l.pool) &&
            (fix ? l.p[1] - standingHeightAt(l.p[0], l.p[2]) : l.p[1]) > 1.6 &&
            l.r >= 3 &&
            Math.hypot(l.p[0] - x, l.p[2] - z) < 22
        )
          .sort((a, b) => dist(a) - dist(b))
          .slice(0, n)
      : [];
  LAMP_SHADOWED.length = 0;
  for (const l of cand) LAMP_SHADOWED.push(l);
  return cand;
}
/* v43: shadow maps for the two nearest lamps after dark (the ones that hang high: street lamps, lanterns, windows don't
   count). The lamps are moved to the front of the light list so the shader knows which they are. */
export function lampShadowMaps(items, X, dark) {
  const n = Math.min(2, engineSetting('shadows', 'lampShadows') ?? 2),
    L = X.lights,
    P = walkView.pl,
    cand = pickShadowLamps(L, P.x, P.z, n);
  if (!cand.length) return;
  X.lights = cand.concat(L.filter(l => !cand.includes(l)));
  frameBlockStale(X);
  X.lampSh = [];
  const gl = gpuState.gl,
    ca = worldCurveArgs();
  cand.forEach((l, i) => {
    gpuPass(i ? 'lamp1' : 'lamp0');
    const SH = beginLampShadow([l.p[0], l.p[1] + 0.2, l.p[2]], 512, 'lamp' + i),
      near = filterInto(
        items,
        it =>
          Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 13 &&
          it.p !== l.own &&
          !(it.k === 'prop' && it.M && it.M.glow && Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 0.6),
        SHADOW_LISTS.lamp
      ); /* alpha 0.4: nor its own post (it.p!==l.own): the lamp's picture turned black in its own light's shadow */
    {
      const p = gpuState.P.shadowG;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
      gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(p.U.uCurveD0, ca[3]);
      drawGroundDepth(p, walkView.sc);
    }
    drawShadowSprites(SH, near, null, ca, l.p);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, near);
    if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, near);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, near);
    endShadow();
    X.lampSh.push(SH);
  });
}
/* the sprites of a shadow pass, each turned to face the sun (fixed ones and buildings as they stand); for a lamp, each
   turned to face the lamp. Phase 20 R3: rest, the far map's still part: a prop the wind sways at its rest. Phase 20 R4:
   always as instances (below); the one-draw-a-picture loop lives on in tools/test/shadow-loops-ref.mjs as the tests'
   reference. Returns how many pictures weren't loaded yet */
function drawShadowSprites(SH, L, sun, ca, lamp, rest) {
  if (!shadowInstancesReady()) return 0;
  return drawShadowSpritesInstanced(SH, L, sun, ca, lamp, rest);
}
function fittedShadowPass(items0, sun, C) {
  const sc = walkView.sc,
    res =
      walkView.R < 0.8 || (walkRenderer.q || 0) >= 2
        ? Math.min(1024, engineSetting('quality', 'shadowMap'))
        : engineSetting('quality', 'shadowMap'),
    gl = gpuState.gl;
  let fit = shadowMapArea(C);
  const cache = (engineSetting('quality', 'shadowCache') ?? true) && !walkRenderer.bt && !!gl.blitFramebuffer;
  if (cache) fit = [Math.round(fit[0] / 3) * 3, Math.round(fit[1] / 3) * 3, fit[2] + 3];
  const items = filterInto(
    items0,
    it => Math.hypot(it.x - fit[0], it.z - fit[1]) < fit[2] + (it.w || 32) * (it.mpp || 0.03) + 4,
    SHADOW_LISTS.far
  );
  const SH = beginSunShadow(fit[0], fit[1], fit[2], sun, res);
  const ca = worldCurveArgs(),
    curve = P => {
      gl.uniform3f(P.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(P.U.uCurveD0, ca[3]);
    };
  const solid = engineSetting('shadows', 'buildings'),
    tr = sun.travel;
  /* phase 20 R3: models whose mesh holds still are cached too (F8, shadowHoldsStill), and so is what only the wind
     sways, drawn at its rest (E11, the owner's option a); within the near map (13 m) shadows sway as before */
  const fs = cache,
    still = fs
      ? it => shadowHoldsStill(it) || (it.k === 'prop' && !it.vol && !it.vox && it.rest !== undefined)
      : shadowHoldsStill,
    stat = cache ? filterInto(items, still, SHADOW_LISTS.stat) : items,
    dyn = cache
      ? filterInto(items, it => !still(it), SHADOW_LISTS.dyn)
      : ((SHADOW_LISTS.dyn.length = 0), SHADOW_LISTS.dyn);
  const q = v => Math.round(v * 500);
  const key = cache
    ? [
        fit.join(','),
        q(tr[0]),
        q(tr[1]),
        q(tr[2]),
        res,
        walkView.id,
        stat.length,
        stat.length ? stat[0].x + stat[stat.length - 1].z : 0,
        walkRenderer.itemGen || 0,
        solid ? 1 : 0,
        walkRenderer.mesh && walkRenderer.mesh.n,
        roomFloorOf(sc) ? sc.roomScene.id : '',
        sc.heights ? sc.heights.length : 0,
        typeof buildingsOn === 'function' && buildingsOn() ? 1 : 0,
        typeof buildingState !== 'undefined' ? buildingState.made || 0 : 0,
        shadowCasterSignature(stat),
      ].join('|')
    : '';
  const SF = gpuState.fb.shadow;
  let hit = false;
  if (cache && walkRenderer.shKey === key && gpuState.fb.shadowS && gpuState.fb.shadowS.w === res) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, gpuState.fb.shadowS.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SF.f);
    gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
    hit = true;
    walkRenderer.shHit = (walkRenderer.shHit || 0) + 1;
  }
  let miss = 0;
  /* phase 20 R3: the same pictures' loop as the near map's (sun set, no lamp) */
  const sprites = (L, rest) => {
    miss += drawShadowSprites(SH, L, sun, ca, null, rest);
  };
  if (!hit) {
    let p = gpuState.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    drawGroundDepth(p, sc);
    sprites(stat, fs);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, stat);
    if (typeof drawStructureShadows === 'function') drawStructureShadows(SH);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, stat);
    if (cache) {
      const S2 = renderTarget('shadowS', res, res, { depthOnly: true });
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, SF.f);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S2.f);
      gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
      gl.viewport(0, 0, res, res);
      walkRenderer.shKey = miss ? '' : key;
      walkRenderer.shMiss = (walkRenderer.shMiss || 0) + 1;
    }
  }
  if (cache) {
    sprites(dyn);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, dyn);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, dyn);
  }
  if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, items);
  endShadow();
  return SH;
}
/* ---------- phase 20 R3 (E9): the shadow pictures as instances (the only path since R4) ----------
   A shadow map keeps depth only (no colour, no blending, one depth offset for all, LEQUAL), so the order its pictures
   are drawn in can't change it: they are grouped by picture over the whole pass, one draw each. Each instance is a
   quad as the old one-at-a-time loop set it (base, offset and size, the share shown, flip, shear, its right along the
   ground), in the sprite instances' layout (engine/sprite-instances.js packShadowInstance; the other bytes unread).
   The program is the shadow one with those uniforms read from the instance. If it does not build on this device the
   maps draw no picture shadows (the debug log says so). */
const SHADOW_INSTANCE_DECLS =
    'in vec2 aC;uniform mat4 uVP;uniform vec3 uBase,uRight;uniform vec4 uOff,uUV;uniform float uFlip,uShear;',
  SHADOW_INSTANCE_IN =
    'layout(location=0) in vec2 aC;layout(location=1) in vec3 iBase;layout(location=2) in vec4 iOff;layout(location=3) in vec4 iAxes;layout(location=4) in vec4 iBend;layout(location=11) in uvec4 iFlags;uniform mat4 uVP;\n' +
    '#define uBase iBase\n#define uRight vec3(iAxes.x,0.,iAxes.y)\n#define uOff iOff\n#define uUV vec4(0.,0.,1.,iBend.w)\n' +
    '#define uFlip ((iFlags.x&8u)!=0u?-1.:1.)\n#define uShear iBend.y\n';
function shadowInstanceVertex(vs) {
  if (vs.split(SHADOW_INSTANCE_DECLS).length !== 2) throw new Error('shadowI: the shadow vertex shader changed');
  return vs.replace(SHADOW_INSTANCE_DECLS, SHADOW_INSTANCE_IN);
}
export const SHADOW_INSTANCE_SHADERS = {
  shadowI: [shadowInstanceVertex(WALK_SHADERS.shadow[0]), WALK_SHADERS.shadow[1]],
};
const shadowInstanceState = { bad: null };
/* is the instanced program built (built on first use if the precompile list did not start it) */
function shadowInstancesReady() {
  const gl = gpuState.gl;
  if (shadowInstanceState.bad === gl) return false;
  if (!gpuState.P.shadowI)
    try {
      ensurePrograms(SHADOW_INSTANCE_SHADERS);
    } catch (e) {
      shadowInstanceState.bad = gl;
      console.error(e);
      if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'picture shadows off: ' + e.message);
      return false;
    }
  return true;
}
/* a pass's quads, kept from frame to frame (C2: nothing made per frame once they have grown): each a texture, its
   tag, the picture's group (its texture's first-met number) and the values packShadowInstance packs; a group's tag is
   its first quad's (a picture is a model's layer or it isn't) */
const SHADOW_QUADS = { list: [], n: 0, groups: new Map(), count: [], tags: [], order: [] };
function shadowQuad(T, it, right, z, x, rest) {
  const Q = SHADOW_QUADS;
  let q = Q.list[Q.n];
  if (!q)
    Q.list[Q.n] = q = {
      T: null,
      tag: 0,
      g: 0,
      x: 0,
      y: 0,
      z: 0,
      ox: 0,
      oy: 0,
      w: 0,
      h: 0,
      rx: 0,
      rz: 0,
      shear: 0,
      shown: 1,
      flip: 1,
      uv: [0, 0, 1, 1],
      slope: 0,
    };
  Q.n++;
  spriteGeometry(q, it, z);
  if (x !== undefined) q.x = x;
  q.shown = q.uv[3];
  if (rest && it.rest !== undefined) q.shear = it.rest;
  q.T = T;
  q.tag = it.voxImg ? 'modelPic' : personPicture(it.im) ? 'person' : 0;
  q.rx = right[0];
  q.rz = right[2];
  let g = Q.groups.get(T);
  if (g === undefined) {
    g = Q.groups.size;
    Q.groups.set(T, g);
    Q.count[g] = 0;
    Q.tags[g] = q.tag;
  }
  q.g = g;
  Q.count[g]++;
}
/* the quads drawShadowSprites would draw, the same items skipped and missed; the number missed */
function shadowSpriteQuads(L, sun, lamp, rest) {
  const solid = engineSetting('shadows', 'buildings'),
    tr = sun ? sun.travel : [0, -1, 0],
    h = normalize3([tr[0], 0, tr[2]]),
    Rs0 = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]],
    Q = SHADOW_QUADS,
    R = [0, 0, 0];
  Q.n = 0;
  Q.groups.clear();
  let miss = 0;
  for (const it of L) {
    if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
    if (it.k === 'prop' && !(it.sh > 0)) continue;
    if (it.layer && it.M.box) continue;
    const T = imageTexture(it.im);
    if (!T) {
      miss++;
      continue;
    }
    let Rs = Rs0;
    if (lamp) {
      const dx = it.x - lamp[0],
        dz = it.z - lamp[2],
        l = Math.hypot(dx, dz);
      if (l >= 0.3) {
        R[0] = dz / l;
        R[2] = -dx / l;
        Rs = R;
      }
    }
    if (it.bld3) {
      let F = null;
      buildingGuard(() => {
        F = imageTexture(buildingFrontPicture(it.im, it.M.build, it.M));
      });
      if (F) shadowQuad(F.t, it, FIXED_RIGHT);
      else miss++;
      continue;
    }
    if (it.plane && !(solid && it.M && it.M.box)) {
      shadowQuad(T.t, it, it.fixed ? pictureRight(it, FIXED_RIGHT) : FIXED_RIGHT, it.z, undefined, rest);
      continue;
    }
    if (solid && it.M && it.M.box) {
      const ta = placedTurn(it.p),
        tc = Math.cos(ta),
        ts = Math.sin(ta),
        d = it.M.box[1] * (it.p.s || 1),
        n = 6;
      R[0] = tc;
      R[2] = ts;
      for (let i = 0; i < n; i++) {
        const k = (d * i) / (n - 1);
        shadowQuad(T.t, it, R, it.z + k * tc, ta ? it.x - k * ts : undefined);
      }
      continue;
    }
    shadowQuad(T.t, it, Rs, it.z, undefined, rest);
  }
  return miss;
}
function drawShadowSpritesInstanced(SH, L, sun, ca, lamp, rest) {
  const miss = shadowSpriteQuads(L, sun, lamp, rest),
    Q = SHADOW_QUADS,
    G = Q.groups.size;
  if (!Q.n) return miss;
  /* the quads in group order (a counting sort: each group's first instance, then each quad's place) */
  const first = Q.order;
  let at = 0;
  for (let g = 0; g < G; g++) {
    first[g] = at;
    at += Q.count[g];
  }
  for (let i = 0; i < Q.n; i++) {
    const q = Q.list[i];
    packShadowInstance(first[q.g]++, q);
  }
  uploadSpriteInstances(Q.n * SPRITE_INSTANCE_STRIDE);
  const gl = gpuState.gl,
    p = gpuState.P.shadowI;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(p.U.uTex, 0);
  /* each group from its first instance (first[g] now points past it) */
  for (const [T, g] of Q.groups) {
    const n = Q.count[g],
      f = first[g] - n;
    gpuTag(Q.tags[g]);
    gl.bindTexture(gl.TEXTURE_2D, T);
    bindSpriteInstances(f);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
  }
  gpuTag(0);
  gl.bindVertexArray(null);
  return miss;
}
/* ---------- phase 20 R3 (F8): models in the far map's cache (Engine > Quality "Models in the shadow cache") ----------
   A model's shadow is its mesh, which never sways (only its leaf pictures do): a tree whose leaves sway is cached
   like any still prop. A model that moves is not: one that bobs (moored, or rocking on the water), tumbles, has
   turning parts (sails, propellers) or moves along a path; without the setting those were cached when the prop was
   otherwise still, so their far shadows stood still. Everything else as before. */
function shadowHoldsStill(it) {
  if (it.k !== 'prop' || it.vol) return false;
  if (!it.vox) return !!it.still;
  if (it.bobs || it.spin || (it.p && it.p.moving) || (it.M && it.M.bob)) return false;
  const m = typeof propModelMesh === 'function' ? propModelMesh(it.voxPath, it.vox) : null;
  return !!m && !(m.spins && m.spins.length);
}
/* which items the cached map holds: a number from each one's place and whether it is a model, in order, so a model
   that finished loading (it was its picture before) or an item gone or added draws the cache again */
function shadowCasterSignature(L) {
  let h = L.length | 0;
  for (const it of L) {
    h = Math.imul(h ^ Math.round(it.x * 64), 0x01000193) | 0;
    h = Math.imul(h ^ Math.round(it.z * 64), 0x01000193) | 0;
    h = Math.imul(h ^ (it.vox ? 7 : 3), 0x01000193) | 0;
  }
  return (h >>> 0).toString(36);
}
