// @ts-check
'use strict';
/* ================= THE SKY TRAIN HALT (assets track AS-2) =================
   Every run's landing has a sky train halt where the airship's mast stood (mapgen.js MAPGEN_HUB_BUILDINGS, the
   catalogue's train_halt: tools/build-halt.py). Its platform is laid out as Skyline Station's, so the sky train's way
   (logic/train-path.js) works in its frame too: the run's train comes down over its track and sets down at its
   platform (halt-arrival.js), and stays parked there for the run. Here: which prop is the halt, the run's train, and
   where the parked train stands. Logic only: no DOM, runs in Node (tools/test/halt.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { TRAIN_RIDE, trainFrame, trainHomeAt, trainPlace } from './train-path.js';
/* eslint-disable no-func-assign */
expose({
  HALT_TRAIN_FALLBACK: [() => HALT_TRAIN_FALLBACK],
  // @ts-expect-error -- replaced on purpose
  haltOf: [() => haltOf, v => (haltOf = v)],
  haltTear: [() => haltTear],
  // @ts-expect-error -- replaced on purpose
  haltTrainKey: [() => haltTrainKey, v => (haltTrainKey = v)],
  // @ts-expect-error -- replaced on purpose
  haltTrainPark: [() => haltTrainPark, v => (haltTrainPark = v)],
  // @ts-expect-error -- replaced on purpose
  haltTrainPlace: [() => haltTrainPlace, v => (haltTrainPlace = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the train when a run's region names none (train-ride.js TRAIN_FALLBACK, HB-7's answer) */
export const HALT_TRAIN_FALLBACK = 'train_greenbelt';

/** a scene's halt: its first prop that flies you home (act 'fly') and says where you stand by it (its catalogue's
 * stand: the halt has one, the airship's station had none), or null @param {any} scene
 * @param {Record<string, any>} cat the scenery catalogue's props */
export function haltOf(scene, cat) {
  return (
    ((scene && scene.props) || []).find(
      (/** @type {any} */ p) => p.act === 'fly' && cat[p.k] && Array.isArray(cat[p.k].stand)
    ) || null
  );
}

/** the run's sky train (a catalogue key): its region's theme's (regions.json themes.<id>.train), else the fallback;
 * always one the catalogue has, or '' when it has neither @param {any} run @param {any} data runWorldData()'s
 * region and scenery */
export function haltTrainKey(run, data) {
  const th = run && run.region && run.region.theme,
    R = data && data.region && data.region.regions,
    T = th && R && R.themes ? R.themes[th] : null,
    cat = (data && data.scenery && data.scenery.props) || {},
    k = T && T.train && T.train.k;
  return k && cat[k] ? k : cat[HALT_TRAIN_FALLBACK] ? HALT_TRAIN_FALLBACK : '';
}

/** the point the train's way home would start from (logic/train-path.js trainHomeAt's tear): over the halt, high up,
 * so only its last beats, straight down and off, are filmed (the run has no portal on its landing)
 * @param {import('./train-path.js').TrainFrame} F @returns {[number, number, number]} */
export const haltTear = F => [F.x, F.z, F.y0 + TRAIN_RIDE.hover * 4];

/** where the run's train stands parked at a halt (placed at x, z, turned rot degrees, its rails' line at the halt's
 * level) @param {{ x: number, z: number, rot?: number }} halt */
export function haltTrainPlace(halt) {
  const F = trainFrame(halt, 0),
    q = trainPlace(trainHomeAt(F, haltTear(F), Infinity).at, 0),
    r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100;
  return { x: r2(q.x), z: r2(q.z), rot: r2(q.rot) };
}

/** the run's train parked at the scene's halt (once: one put down before is moved), marked `parked`; returns it, or
 * null when the scene has no halt or the catalogue no such train @param {any} scene @param {string} key
 * @param {Record<string, any>} cat */
export function haltTrainPark(scene, key, cat) {
  const h = haltOf(scene, cat);
  if (!h || !key || !cat[key]) return null;
  scene.props = scene.props.filter((/** @type {any} */ p) => !p.parked);
  const at = haltTrainPlace(h),
    p = { k: key, x: at.x, z: at.z, ...(at.rot ? { rot: at.rot } : {}), parked: 1 };
  scene.props.push(p);
  return p;
}
