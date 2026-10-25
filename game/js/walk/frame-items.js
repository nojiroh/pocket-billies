'use strict';
/* ================= WALK FRAME ITEMS =================
   Phase 20 (stage B): what stands in the scene this frame (gatherFrameItems), moved from walk-view-gl.js as it was. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  buddyItems,
  buildingFrontPicture,
  buildingGuard,
  buildingMesh,
  buildingsOn,
  companionItems,
  friendWorldItems,
  lifeSprites,
  pastureItems,
  propModelImageItems,
  provide,
  reducedMotion,
  solidPropLevelOfDetail,
  soundEffectAt,
  tagPropModel,
  tagSolidProp,
  warmWorldBillies,
  wildBillyItem,
  worldBillies,
  worldBillyItem,
} from '../hooks.js';
import { turnedPoint } from '../logic/prop-turn.js';
import { folkFrames, personBattlePose, personWalkFrames, pickWalkFrame, warmPerson } from '../person-art.js';
import {
  WALK_FRAME_M,
  artImage,
  cropGrowth,
  directionOf,
  encounterSpot,
  flagPicturePath,
  imageReady,
  layerAsProp,
  mapHub,
  pointAlongMapPath,
  propShown,
  propWithVariant,
  stepLevelAt,
  tallGrassProps,
  walkView,
  walkablePointNear,
} from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { worldCurveDrop } from './draw-common.js';
import { computeFrustum, inFrustum } from './quality-cull.js';
import {
  alternatePropImage,
  hugSlope,
  propGrid,
  propLook,
  propMaterial,
  rideMountItem,
  stillPropState,
  windLeanAt,
} from './prop-look.js';
/* eslint-disable no-func-assign */
expose({
  SUNKEN_FOOTPRINT_PROPS: [() => SUNKEN_FOOTPRINT_PROPS],
  gatherFrameItems: [() => gatherFrameItems, v => setGatherFrameItems(v)],
  personItem: [() => personItem, v => (personItem = v)],
  propBaseHeight: [() => propBaseHeight, v => ((propBaseHeight = v), provide({ propBaseHeight }))],
});
/* eslint-enable no-func-assign */
provide({ propBaseHeight });
export function setGatherFrameItems(v) {
  gatherFrameItems = v; // eslint-disable-line no-func-assign
  provide({ gatherFrameItems });
}
/* to-module: end */
export function gatherFrameItems(st, C, PPU, C0) {
  const sc = walkView.sc,
    P = walkView.pl,
    t = walkView.t,
    out = [],
    hub = mapHub(sc),
    tg = tallGrassProps(C0),
    wind = engineSetting('grass', 'wind'),
    odt = Math.min(0.1, Math.max(0, (t - (walkRenderer.owT ?? t)) / 1000)),
    ow = typeof worldBillyItem === 'function' && !st.battle && !walkRenderer.bt,
    npcPos = [];
  walkRenderer.owT = t;
  if (ow && worldBillies.warmId !== walkView.id) {
    worldBillies.warmId = walkView.id;
    warmWorldBillies();
  }
  const prop = (p, far) => {
    const M = propWithVariant(p, C0.props[p.k]);
    if (!M || !propShown(p)) return;
    const im = artImage(alternatePropImage(p, M, C0, sc));
    if (!imageReady(im)) return;
    const lk = far ? null : propLook(p, M, sc),
      /* phase 09 batch 1: a prop drawn at its own scale (ppm: pixels to the metre, 32 for the new style) */
      s = ((p.s || 1) / (M.ppm || PPU)) * (lk ? lk.size : 1) * (p.grow != null ? cropGrowth(p) : 1),
      w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height;
    const S = far ? null : stillPropState(p, M, im, sc);
    const y = far ? standingHeightAt(p.x, p.z) : S.y,
      sw = far || !M.sway ? 0 : (M.sway || 0) * windLeanAt(p.x, p.z, reducedMotion ? 0 : t, sc, wind);
    const mat = S ? S.mat : propMaterial(p.k, M);
    im.__mat = mat;
    /* v27: boats and buoys bob and roll on the water; flags, banners and washing flutter in the wind */
    /* the cutscene tools: a placement may float (lift, metres up: a flying car in a cutscene's traffic) and move each
       frame (moving: its shadow is drawn each frame, not cached with the still ones) */
    let y2 = y + (p.lift || 0),
      sw2 = sw;
    if (!far && !reducedMotion) {
      const ph = p.x * 1.3 + p.z * 0.7,
        gk = (sc.wind || 1) * wind;
      if (S.bob) {
        y2 += Math.sin(t / 760 + ph) * 0.05;
        sw2 += Math.sin(t / 1130 + ph) * 0.035;
      } else if (S.flag) sw2 += (Math.sin(t / 230 + ph) * 0.025 + Math.sin(t / 97 + ph * 2) * 0.012) * gk;
    }
    /* v34: a flat picture (a sign, a painted board) stands upright: no random lean, only the wind */
    out.push({
      k: far ? 'farp' : 'prop',
      still: !far && !M.sway && !S.bob && !S.flag && !p.moving,
      lk,
      p,
      M,
      im,
      x: p.x,
      z: p.z,
      y: y2,
      mpp: s,
      ox: M.ox,
      oy: M.oy,
      w,
      h,
      flip: p.f ? -1 : 1,
      shear: sw2 + (lk && !M.box && !M.build && !M.flat ? lk.lean : 0),
      flat: M.flat,
      sh: (p.lift || 0) > 3 ? 0 : (M.shadow || 0) * (p.s || 1),
      far,
      fixed: M.face !== 'billboard',
      mat,
      plane: S ? S.plane : M.face === 'fixed' || !!M.box || mat === 'wood' || mat === 'building',
      cross: !far && S.cross,
      bld3: !far && !!(M.build && M.box) && typeof buildingsOn === 'function' && buildingsOn(),
    });
    if (S && S.spin) out[out.length - 1].spin = S.spin;
    if (!far) hugSlope(out[out.length - 1], C);
    /* v46: a building whose solid or front isn't made yet (a few are made per frame) shows as its picture meanwhile, never as nothing */
    if (!far) {
      const bi = out[out.length - 1];
      if (bi.bld3) {
        let E = null,
          F = null;
        buildingGuard(() => {
          E = buildingMesh(bi);
          if (E && E.walls) F = buildingFrontPicture(bi.im, M.build, M);
        });
        if (!E || !E.walls || !F) bi.bld3 = false;
      }
    }
    /* v43: a prop with a voxel recipe draws as a solid (prop-models.js); its picture layers come along as sprites */
    if (!far && M.model && typeof tagPropModel === 'function') {
      const vi = out[out.length - 1];
      tagPropModel(vi);
      if (vi.vox) propModelImageItems(vi, out);
    }
    /* v43: a flag pole is rigid; its cloth is a separate picture (the town's flag) draped from the top and waved by the wind */
    if (!far && M.flag) {
      const F = M.flag,
        fi = artImage(flagPicturePath(sc)),
        fim = imageReady(fi) ? fi : artImage('scene/flags/default.png');
      if (imageReady(fim)) {
        const fl = p.f ? -1 : 1,
          ps = p.s || 1,
          wv = reducedMotion ? 0 : windLeanAt(p.x, p.z, t, sc, wind);
        out.push({
          k: 'flag',
          p,
          M,
          im: fim,
          /* phase 09 batch 9: on a turned pole the cloth hangs from the turned top */
          x: turnedPoint(p, F.dx * ps * fl, 0)[0],
          z: turnedPoint(p, F.dx * ps * fl, 0)[1],
          y: y + F.h * ps,
          mpp: 1,
          ox: 0,
          oy: -F.fh * ps,
          w: F.w * ps,
          h: F.fh * ps,
          flip: fl,
          shear: 0,
          sh: 0,
          fixed: false,
          mat: 'cloth',
          wave: [0.05 + Math.abs(wv) * 1.1, t / 170 + p.x * 0.7, 0],
        });
      }
    }
    /* extra layers for depth: each one a sprite of its own, dz meters behind (or in front of) the main picture */
    if (!far && M.layers)
      for (const l of M.layers) {
        const li = l.img && artImage(l.img);
        if (!imageReady(li)) continue;
        const LM = layerAsProp(M, l);
        /* alpha 0.4: a layer that swings from a point (the rope swing on the great oak: l.pivot metres up), a slow pendulum
      pushed a little harder by the gusts: it leans one way about the pivot and moves the other, so the pivot stays put */
        let lx = p.x,
          lsh = sw * (l.sway ?? 1);
        if (l.swing && !reducedMotion) {
          const a =
            Math.sin(t / (l.swingT || 720) + p.x * 0.9 + p.z * 0.4) * l.swing * (1 + Math.min(1.5, Math.abs(sw) * 10));
          lsh -= a;
          lx += a * (l.pivot || 3) * (p.s || 1);
        }
        out.push({
          k: 'prop',
          still: !M.sway && !S.bob && !S.flag && !l.swing,
          lk,
          layer: l,
          p,
          M,
          im: li,
          /* phase 09 batch 9: a turned prop's layers stand behind it the way it faces */
          x: turnedPoint(p, lx - p.x, (l.dz || 0) * (p.s || 1))[0],
          z: turnedPoint(p, lx - p.x, (l.dz || 0) * (p.s || 1))[1],
          y,
          mpp: s,
          ox: LM.ox,
          oy: LM.oy,
          w: li.naturalWidth || li.width,
          h: li.naturalHeight || li.height,
          flip: p.f ? -1 : 1,
          shear: lsh,
          flat: LM.flat,
          sh: l.glow || M.box || l.shadow === 0 ? 0 : (M.shadow || 0) * (p.s || 1),
          fixed: l.face !== 'billboard',
          glow: l.glow || 0,
          mat,
          plane: l.face === 'fixed' || !!M.box || mat === 'wood' || mat === 'building',
        });
        li.__mat = mat;
      }
  };
  /* v34: props sit in a grid of 6 m squares; a square well outside the view (8 m of slack for shadows and lamp light)
    isn't looked at at all this frame */
  /* alpha 0.4: in a 3D battle too (it gathered every prop of the place each frame: 6 to 9 ms on a phone) */
  const GR = propGrid(sc),
    F = C.vp && (engineSetting('quality', 'cull') ?? true) ? computeFrustum(C.vp) : null;
  let gs = 0;
  for (const c of GR.cells) {
    if (F && !inFrustum(F, c.x, c.y + worldCurveDrop(c.x, c.z), c.z, c.r + 8)) {
      gs += c.list.length;
      continue;
    }
    for (const p of c.list) prop(p);
  }
  walkRenderer.gridSkip = gs;
  for (const p of walkRenderer.farProps) prop(p, 1);
  /* CAM-2: where a run's boss stands in this place (walk/camera.js, its reveal) */
  walkRenderer.bossAt = null;
  (st.npcs || []).forEach((n, i) => {
    let pos = walkView.npcAt[n.id];
    if (!pos && n.at) pos = walkView.npcAt[n.id] = walkablePointNear(n.at[0], n.at[1]);
    if (!pos) {
      if (!st.mode || st.mode === 'line') {
        const a = pointAlongMapPath(sc, n.t ?? 0.7 + i * 0.08);
        pos = [a.x + (n.dx || 0), a.z + (n.dz ?? 1.5)];
      } else if (n.exit) {
        const dx = hub[0] - n.exit[0],
          dz = hub[1] - n.exit[1],
          l = Math.hypot(dx, dz) || 1;
        pos = walkablePointNear(n.exit[0] + (dx / l) * 2.2, n.exit[1] + (dz / l) * 2.2);
      } else if (sc.npcSpots && sc.npcSpots[i]) pos = sc.npcSpots[i].slice();
      else {
        const a = i * 2.3 + 0.6,
          r = 3.4 + i * 0.9;
        pos = walkablePointNear(hub[0] + Math.cos(a) * r, hub[1] + Math.sin(a) * r * 0.7);
      }
      walkView.npcAt[n.id] = pos;
    }
    const fr = typeof personWalkFrames === 'function' ? personWalkFrames(n.who) : null;
    if (!fr) return;
    warmPerson(n.who);
    const dir =
      Math.hypot(P.x - pos[0], P.z - pos[1]) < 4.5 ? directionOf(P.x - pos[0], P.z - pos[1]) : n.dir || 'down';
    const nset = fr[dir] || fr.down,
      nim = typeof pickWalkFrame === 'function' ? pickWalkFrame(nset, false, 0) : nset[0];
    if (nim) out.push(personItem('npc', nim, pos[0], pos[1], C0, { n }));
    npcPos.push([n, pos]);
    if (n.boss && !n.done) walkRenderer.bossAt = { id: n.id, x: pos[0], z: pos[1] };
  });
  if (ow) {
    companionItems(out, t, npcPos);
    buddyItems(out, t, odt);
    pastureItems(out, t, odt);
    if (typeof friendWorldItems === 'function')
      try {
        friendWorldItems(out, t, C0);
      } catch (e) {}
  }
  const used = [];
  walkRenderer.encPos = [];
  (st.enc || []).forEach(e => {
    let s = walkView.enc[e.id];
    if (!s || s.sc !== walkView.id) {
      const sp = encounterSpot(sc, e.id, used);
      s = walkView.enc[e.id] = { x: sp[0], z: sp[1], tx: sp[0], tz: sp[1], sc: walkView.id };
    }
    /* v46: they keep their spot in the tall grass until you battle them: no wandering. They stay alive in place (a bob,
     the grass swaying round them, a peek now and then, see wildBillyItem) and rustle when you come close */
    s.tx = s.x;
    s.tz = s.z;
    if (!st.battle && !reducedMotion && !walkRenderer.bt) {
      const dd = Math.min(0.1, (t - (s.lt || t)) / 1000);
      s.lt = t;
      const P = walkView.pl;
      if (P && typeof soundEffectAt === 'function' && Math.hypot(P.x - s.x, P.z - s.z) < 4 && Math.random() < dd * 0.25)
        soundEffectAt('rustle', s.x, s.z);
    }
    used.push([s.x, s.z]);
    walkRenderer.encPos.push([s.x, s.z, e.id]);
    const g = tg[Math.abs(Math.round(s.x * 7 + s.z * 3)) % tg.length];
    const im = g && artImage(g.img);
    if (!imageReady(im)) return;
    const moving = Math.hypot((s.tx ?? s.x) - s.x, (s.tz ?? s.z) - s.z) > 0.05,
      ru = moving ? 0.06 * Math.sin(t / 70 + s.x) : 0,
      wv = reducedMotion ? 0 : windLeanAt(s.x, s.z, t, sc, wind);
    out.push({
      k: 'enc',
      e,
      im,
      x: s.x + ru * 0.5,
      z: s.z,
      y: standingHeightAt(s.x, s.z),
      mpp: 1.25 / PPU,
      ox: g.ox,
      oy: g.oy,
      w: im.naturalWidth || im.width,
      h: im.naturalHeight || im.height,
      flip: 1,
      shear: wv + ru,
      sh: 0.5,
    });
    out.push({
      k: 'enc2',
      e,
      im,
      x: s.x + 0.18,
      z: s.z - 0.12,
      y: standingHeightAt(s.x, s.z),
      mpp: 1.1 / PPU,
      ox: g.ox,
      oy: g.oy,
      w: im.naturalWidth || im.width,
      h: im.naturalHeight || im.height,
      flip: -1,
      shear: -(wv * 0.8) - ru * 0.7,
      sh: 0,
    });
    if (ow) wildBillyItem(out, e, s, t, odt);
  });
  if (!st.battle)
    for (const f of walkView.folk) {
      const fr = folkFrames(f.seed);
      if (!fr) continue;
      warmPerson('folk:' + f.seed);
      const set = fr[f.dir] || fr.down;
      let fim =
        typeof pickWalkFrame === 'function'
          ? pickWalkFrame(set, f.walk, Math.floor(t / 110) % 6)
          : f.walk
            ? set.cyc
              ? set.cyc[Math.floor(t / 110) % 6]
              : set[1 + (Math.floor(t / 150) % 2)]
            : set[0];
      /* v47: a wave hello */ if (f.waveT > 0 && typeof personBattlePose === 'function') {
        const w = personBattlePose('folk:' + f.seed, 'front', 'cheer', 0, (1.4 - f.waveT) * 1000);
        if (w) fim = w;
      }
      if (fim) out.push(personItem('folk', fim, f.x, f.z, C0, { f }));
    }
  if (typeof lifeSprites === 'function')
    for (const L of lifeSprites())
      out.push({
        k: 'life',
        im: L.im,
        x: L.x,
        z: L.z,
        y: L.y,
        mpp: L.mpp,
        ox: -L.im.width / 2,
        oy: -L.im.height,
        w: L.im.width,
        h: L.im.height,
        flip: L.flip,
        shear: 0,
        sh: L.sh,
        aoR: Math.max(0.12, L.sh * 0.8),
      });
  if (typeof tagSolidProp === 'function') {
    for (const it of out) if (it.fixed !== false) tagSolidProp(it, PPU);
    if (typeof solidPropLevelOfDetail === 'function')
      solidPropLevelOfDetail(out, C); /* a solid tree has its crown in 3D: its layered crown pictures go */
    const T = new Set(out.filter(it => it.vol && it.vol.tree).map(it => it.p));
    if (T.size) for (let i = out.length - 1; i >= 0; i--) if (out[i].layer && T.has(out[i].p)) out.splice(i, 1);
  }
  if (st.who !== null && typeof personWalkFrames === 'function') {
    const fr = personWalkFrames(st.who),
      set = fr[P.dir] || fr.down;
    const me = personItem(
      'me',
      P.hop
        ? set.cyc
          ? set.cyc[2]
          : set[1]
        : P.walk
          ? set.cyc
            ? set.cyc[Math.floor((P.gait || 0) / WALK_FRAME_M) % 6]
            : set[1 + (Math.floor((P.gait || 0) / (WALK_FRAME_M * 1.36)) % 2)]
          : set[0],
      P.x,
      P.z,
      C0,
      { shear: reducedMotion ? 0 : P.lean || 0 }
    );
    if (P.yv != null && P.yId === walkView.id) me.y = P.yv;
    const mt = rideMountItem(P, t);
    if (mt) {
      out.push(mt.it);
      me.y += mt.lift;
      me.im = set[0];
      me.z -= 0.02;
    }
    out.push(me);
  }
  return out;
}
/* a prop's base height: on a slope the lowest point under it on its own terrace (so it never floats on the downhill
   side), rocks and boulders sunk a little into the ground */
/* alpha 0.2: a rock formation or a hill-built thing with a footprint stands at the lowest point under it (it sinks into the slope, it never hangs over it) */
const SUNKEN_FOOTPRINT_PROPS = /mesa|vault_door|mine_entrance|shipwreck|stilt|spore_mill/;
function propBaseHeight(p, M) {
  const y0 = standingHeightAt(p.x, p.z);
  if (M.box && SUNKEN_FOOTPRINT_PROPS.test(p.k)) {
    const s = p.s || 1,
      bw = (M.box[0] * s) / 2,
      bd = M.box[1] * s,
      lv = stepLevelAt(p.x, p.z);
    let y = y0;
    for (const [x, z] of [
      turnedPoint(p, -bw, -0.05),
      turnedPoint(p, bw, -0.05),
      turnedPoint(p, -bw, bd),
      turnedPoint(p, bw, bd),
    ])
      if (Math.abs(stepLevelAt(x, z) - lv) <= 0.05) y = Math.min(y, standingHeightAt(x, z));
    return y;
  }
  if (M.box || M.flat || M.walk) return y0;
  const r = Math.min(0.45, (M.shadow || 0) * 0.3 * (p.s || 1));
  if (r < 0.08) return y0;
  const s0 = stepLevelAt(p.x, p.z);
  let y = y0;
  for (const [a, b] of [
    [-r, 0],
    [r, 0],
    [0, -r * 0.6],
    [0, r * 0.6],
  ]) {
    if (Math.abs(stepLevelAt(p.x + a, p.z + b) - s0) > 0.05) continue;
    y = Math.min(y, standingHeightAt(p.x + a, p.z + b));
  }
  const g = (M.group || '') + ' ' + p.k;
  return y - (M.sink ?? (/rock|boulder|stone_|pebble|stalag/.test(g) ? 0.07 : 0));
}
export function personItem(k, im, x, z, C0, extra) {
  const mpp = (C0.person || 1.75) / 1.75 / (im.ppm || 42);
  return Object.assign(
    {
      k,
      im,
      x,
      z,
      y: standingHeightAt(x, z),
      mpp,
      ox: -(im.ax ?? 16),
      oy: -(im.ay ?? 40),
      w: im.width,
      h: im.height,
      flip: 1,
      shear: 0,
      sh: 0.38,
      person: 1,
    },
    extra
  );
}
