// HB-2: logic/run-load.js, what the run's loading screen waits on: the bar's share by weight, a stage ready once (its
// time kept), every stage ready lifting it, the cap lifting it with the waiting stages marked late, and the debug
// log's line (stage names and ms only).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runLoadNew, runLoadPart, runLoadShare, runLoadDone, runLoadTick, runLoadSummary } = modules['run-load'];
const DEFS = [
  { id: 'map', label: 'The landing', w: 3 },
  { id: 'models', label: 'Buildings', w: 1 },
];

test('run load: the share goes by weight, a stage keeps the time it was first ready', () => {
  const L = runLoadNew('take-off', DEFS, 1000);
  assert.equal(runLoadShare(L), 0);
  runLoadPart(L, 'models', 0.5, 1100);
  assert.equal(runLoadShare(L), 0.125);
  runLoadPart(L, 'models', 1, 1200);
  runLoadPart(L, 'models', 0.2, 1300);
  runLoadPart(L, 'nothing', 1, 1300);
  assert.equal(L.stages[1].f, 1, 'a share never goes back');
  assert.equal(L.stages[1].ms, 200);
  assert.equal(runLoadShare(L), 0.25);
  assert.equal(runLoadDone(L), false);
  assert.equal(runLoadTick(L, 1400, 20000), '');
  runLoadPart(L, 'map', 1, 1500);
  assert.equal(runLoadDone(L), true);
  assert.equal(runLoadTick(L, 1600, 20000), 'ready');
  assert.equal(L.ms, 600);
  runLoadPart(L, 'map', 0, 9000);
  assert.equal(runLoadTick(L, 99999, 20000), 'ready', 'an ended loading stays as it ended');
  assert.equal(runLoadSummary(L, { scenes: 14 }), 'take-off 600 ms: map 500, models 200; scenes 14');
});

test('run load: the cap lifts it and marks the stages still waiting late', () => {
  const L = runLoadNew('resume', DEFS, 0);
  runLoadPart(L, 'map', 1, 300);
  runLoadPart(L, 'models', 0.4, 400);
  assert.equal(runLoadTick(L, 19999, 20000), '');
  assert.equal(runLoadTick(L, 20000, 20000), 'capped');
  assert.deepEqual(
    L.stages.map(s => s.late),
    [false, true]
  );
  assert.equal(runLoadSummary(L), 'resume 20000 ms: map 300, models late 40%; capped');
  assert.equal(runLoadTick(runLoadNew('x', DEFS, 0), 1e9, 0), '', 'no cap: it waits');
});

test('run load: rules.json has the cap (the owner: 20 s)', () => {
  assert.equal(GAME_DATA.rules.run.load.capMs, 20000);
});
