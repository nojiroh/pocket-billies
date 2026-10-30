// Assets track AS-2: the sky train halt on every run's landing (logic/halt.js, mapgen.js's landing block, the
// catalogue's train_halt from tools/build-halt.py), on the game's own data: a run's landing has the halt where the
// airship's mast stood, labelled, with where you stand by it at the foot of its steps; the run's train is parked at
// its platform the way the ride home leaves one at Skyline Station (logic/train-path.js), turned with the halt; the
// first run's landing has the wreck instead.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules } from './setup-real.mjs';

const H = modules.halt,
  TP = modules['train-path'],
  CAT = GAME_DATA.scenery.props,
  { runWorldData } = modules['run-world-data'];

test('the halt is a model laid out as the station: its stand at the foot of its steps, in front of it', () => {
  const M = CAT.train_halt;
  assert.ok(M && M.model, 'no train_halt model');
  assert.equal(M.ppm, 48, 'painted at 48 px/m');
  assert.deepEqual(M.stand, [0, -1.4]);
  assert.ok(M.stand[1] < TP.TRAIN_PLATFORM.foot + 0.5, 'you stand before the steps');
  assert.ok(M.box[1] > TP.TRAIN_RIDE.track + TP.TRAIN_RIDE.half, 'the track lies on its footprint');
});

test('which prop is the halt: act fly and a stand (the old airship station had none)', () => {
  const sc = {
    props: [
      { k: 'airship_station', act: 'fly' },
      { k: 'train_halt', act: 'fly', x: 1, z: 2 },
    ],
  };
  assert.equal(H.haltOf(sc, CAT).k, 'train_halt');
  assert.equal(H.haltOf({ props: [{ k: 'airship_station', act: 'fly' }] }, CAT), null);
  assert.equal(H.haltOf({ props: [{ k: 'train_halt' }] }, CAT), null, 'a halt that does nothing is scenery');
});

test('the run’s train: its region theme’s, else the fallback', () => {
  const D = runWorldData(),
    themes = D.region.regions.themes;
  for (const [id, T] of Object.entries(themes)) assert.equal(H.haltTrainKey({ region: { theme: id } }, D), T.train.k);
  assert.equal(H.haltTrainKey({ region: { theme: 'nowhere' } }, D), H.HALT_TRAIN_FALLBACK);
  assert.equal(H.haltTrainKey(null, D), H.HALT_TRAIN_FALLBACK);
});

test('the parked train stands where the ride home leaves one at the platform, turned with the halt', () => {
  for (const rot of [0, 90, -45, 180]) {
    const h = { x: 50, z: 20, ...(rot ? { rot } : {}) },
      F = TP.trainFrame(h, 0),
      [tx, tz] = TP.trainAt(F, TP.TRAIN_RIDE.stop, TP.TRAIN_RIDE.track),
      q = H.haltTrainPlace(h),
      th = (q.rot * Math.PI) / 180;
    /* its base point half a train's width in front of the track's line, its middle over the stop */
    assert.ok(Math.abs(q.x - Math.sin(th) * TP.TRAIN_RIDE.half - tx) < 0.02, `rot ${rot}: x`);
    assert.ok(Math.abs(q.z + Math.cos(th) * TP.TRAIN_RIDE.half - tz) < 0.02, `rot ${rot}: z`);
    assert.ok(
      Math.abs(Math.atan2(Math.sin(th - (rot * Math.PI) / 180), Math.cos(th - (rot * Math.PI) / 180))) < 1e-3,
      `rot ${rot}: along the track`
    );
  }
  const sc = { props: [{ k: 'train_halt', act: 'fly', x: 10, z: 10 }] };
  H.haltTrainPark(sc, 'train_lakeland', CAT);
  H.haltTrainPark(sc, 'train_lakeland', CAT);
  assert.equal(sc.props.filter(p => p.parked).length, 1, 'parked once');
  assert.equal(H.haltTrainPark({ props: [] }, 'train_lakeland', CAT), null, 'no halt, no train');
  assert.equal(H.haltTrainPark(sc, 'no_such_train', CAT), null);
});

/** a run's places on the game's data (the prepared first run when first) */
function scenes(first) {
  const s = fn('newSave')();
  s.started = true;
  s.starter = data.RULES.start.starters[0];
  hooks.provide({ saveData: s, activeBattle: null });
  s.team.push(fn('makeBilly')(s.starter + '0', data.RULES.start.starterLevel));
  const D = { ...runWorldData(), unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings } },
    S = modules['run-start'],
    run = first ? S.runStartPrepared(s, D) : (S.runStartOn(s, S.runStartPlan('HALTTEST01', D, {}), {}), s.run);
  return { run, scenes: modules['run-scenes'].runScenesMake(run, runWorldData()) };
}

test('a run’s landing has the halt, labelled, its stand clear, and the run’s train parked at it', () => {
  const { run, scenes: S } = scenes(false),
    L = S[0],
    h = H.haltOf(L, CAT);
  assert.ok(h, 'no halt on the landing');
  assert.equal(h.k, 'train_halt');
  assert.equal(h.label, 'Sky train halt');
  assert.ok(!L.props.some(p => p.k === 'airship_station'), 'the airship station is gone from the landing');
  const T = L.props.filter(p => p.parked);
  assert.equal(T.length, 1, 'one train parked');
  assert.equal(T[0].k, H.haltTrainKey(run, runWorldData()));
  assert.deepEqual([T[0].x, T[0].z], [H.haltTrainPlace(h).x, H.haltTrainPlace(h).z]);
  for (const sc of S.slice(1)) assert.ok(!sc.props.some(p => p.parked), 'only the landing has the train');
});

test('the first run’s landing: the wreck by the halt, no train parked', () => {
  const L = scenes(true).scenes[0];
  assert.ok(H.haltOf(L, CAT), 'no halt on the first run’s landing');
  assert.ok(
    L.props.some(p => p.k === 'train_wreck'),
    'no wreck'
  );
  assert.ok(!L.props.some(p => p.parked), 'the train crashed: none parked');
});

test('the crash scene keeps off the halt: no spot or crash prop on its footprint, the halt never cleared while filming', () => {
  const L = scenes(true).scenes[0],
    h = H.haltOf(L, CAT),
    [bw, bd] = CAT.train_halt.box,
    on = ([x, z]) => x > -bw / 2 && x < bw / 2 && z > -0.1 && z < bd;
  for (const [k, p] of Object.entries(GAME_DATA.firstRun.crash.spots)) assert.ok(!on(p), `spot ${k} on the halt`);
  for (const q of GAME_DATA.firstRun.crash.props) assert.ok(!on(q.at), `${q.k} on the halt`);
  const C = GAME_DATA.cutscenes.crash,
    cleared = modules['cutscene-set'].cutsceneCleared(C, [{ k: 'train_halt', x: 0, z: 0 }], CAT, [0, 0]);
  assert.equal(cleared.size, 0, 'the crash scene clears the halt away while filming');
  assert.ok(L.props.includes(h), 'the halt stays on the crash site');
});
