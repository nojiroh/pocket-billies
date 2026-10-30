'use strict';
/* ================= THE NEXT PLACE WARMED UP (fluid track FL-4b, the load track's LD-5) =================
   Once the view ahead is ready to walk into (its ground built and its walking grid: seamless-world.js), its props'
   pictures are unpacked ahead (engine/webgl.js uploadAhead: a bitmap with the upload queue on, else the browser's
   decode; nothing goes to the graphics card until a picture is drawn, so its bump map's material is set as before)
   and their low-poly meshes asked for on the helper thread (prop-models.js propModelWarm), a few a frame in what is
   left of the frame's one-off budget (walk-view-gl.js). With quality.placeWarm; off, nothing here runs. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { artImage, imageReady, mapById, propWithVariant, walkData, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { uploadAhead } from '../engine/webgl.js';
import { propModelWarm } from '../prop-models.js';
/* eslint-disable no-func-assign */
expose({
  placeWarm: [() => placeWarm],
  placeWarmFor: [() => placeWarmFor, v => (placeWarmFor = v)],
  placeWarmList: [() => placeWarmList, v => (placeWarmList = v)],
  placeWarmReport: [() => placeWarmReport, v => (placeWarmReport = v)],
  placeWarmWork: [() => placeWarmWork, v => ((placeWarmWork = v), provide({ placeWarmWork }))],
});
/* eslint-enable no-func-assign */
provide({ placeWarmWork });
/* to-module: end */
/** the view being warmed, its list of jobs and how far it got; counts for the debug log */
const placeWarm = {
  id: '',
  sc: null,
  /** [kind 'pic' | 'mesh', ...] jobs, made once a view */
  list: /** @type {any[] | null} */ (null),
  i: 0,
  /** recipes still loading go round again, at most this many times */
  again: 0,
  views: 0,
  pics: 0,
  meshes: 0,
  ms: 0,
  done: 0,
};
/** the view ahead is ready (seamless-world.js): warm it next, unless it is the one being warmed or on screen */
export function placeWarmFor(id) {
  if (!id || id === placeWarm.id || id === walkView.id) return;
  if (!engineSetting('quality', 'placeWarm')) return;
  placeWarm.id = id;
  placeWarm.sc = null;
  placeWarm.list = null;
  placeWarm.i = 0;
  placeWarm.again = 0;
  placeWarm.views++;
}
/** the jobs of a view: each prop kind's pictures once, each placed prop's model */
function placeWarmList(sc) {
  const C = walkData().sc,
    seen = new Set(),
    L = [];
  const pic = path => {
    if (path && !seen.has(path)) {
      seen.add(path);
      L.push(['pic', path]);
    }
  };
  for (const p of sc.props || []) {
    const M = propWithVariant(p, C.props[p.k]);
    if (!M) continue;
    pic(M.img);
    for (const l of M.layers || []) pic(l.img);
    if (M.model) L.push(['mesh', p, M]);
  }
  return L;
}
/** a slice of the warming, at most ms; returns the ms it took */
function placeWarmWork(ms) {
  const W = placeWarm;
  if (!W.id || !(ms > 0)) return 0;
  const t0 = performance.now();
  if (!W.list) {
    const sc = mapById(W.id);
    if (!sc || !engineSetting('quality', 'placeWarm')) {
      W.id = '';
      return 0;
    }
    W.sc = sc;
    W.list = placeWarmList(sc);
  }
  const L = W.list;
  while (W.i < L.length && performance.now() - t0 < ms) {
    const j = L[W.i++];
    if (j[0] === 'pic') {
      const im = artImage(j[1]);
      if (imageReady(im) && uploadAhead(im)) W.pics++;
    } else {
      const r = propModelWarm(j[1], j[2]);
      if (r) W.meshes++;
      /* a recipe still loading: once more at the end */ else if (r === null && W.again < L.length) {
        W.again++;
        L.push(j);
      }
    }
  }
  if (W.i >= L.length) {
    W.done++;
    W.id = '';
    W.list = null;
  }
  const dt = performance.now() - t0;
  W.ms += dt;
  return dt;
}
/** the debug log's counts */
export function placeWarmReport() {
  const W = placeWarm;
  return { views: W.views, done: W.done, pics: W.pics, meshes: W.meshes, ms: Math.round(W.ms), now: W.id || '' };
}
