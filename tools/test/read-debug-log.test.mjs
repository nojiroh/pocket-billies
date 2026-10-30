// Test data track TD-1: tools/read-debug-log.py reads a debug log as game/js/debug-log.js build() writes it. The
// full test's result is `bench` itself (the reader used to look for `bench.result` and always said "no result"). The
// log here is made up, shaped like the owner's 2026-10-29 Firefox log (which stays out of git): numbers only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const READER = fileURLToPath(new URL('../read-debug-log.py', import.meta.url));
const python = spawnSync('python3', ['--version']).status === 0;

const lightLab = {
  name: 'Light lab: the land, a room, props, the air',
  ok: false,
  note: '1 draw calls refused by WebGL (last: drawArrays 1282)',
  why: '1 draw calls refused by WebGL (last: drawArrays 1282)',
  ctx: {
    view: 'walk',
    scene: 'test_light_air',
    renderer: 'webgl q0 res 100% · 900 frames',
    at: 'throw',
    refused: [
      { scene: 'test_light_air', hour: 17.5, pass: 'effects', program: 'fogMarch', call: 'drawArrays', code: 1282 },
    ],
  },
};
const log = {
  game: 'Pocket Billies',
  kind: 'debug-log',
  format: 1,
  build: '0.1.0',
  boot: { navigation: 'reload' },
  previousPage: {
    endedUnexpectedly: true,
    endedInBackground: false,
    last: { up: 600, scene: 'test_graphics', test: 'Dial: shadow map size', gmb: 540, kinds: { ground: 217 }, fps: 9 },
  },
  summary: { 'walk:copperleaf': { seconds: 120, loadingSeconds: 14, fpsAvg: 16.5, fpsP10: 4, fpsWorst: 2 } },
  bench: { kind: 'full', passed: false, seconds: 300, phases: [{ name: 'Shaders', ok: true }, lightLab] },
  more: {
    gpuMemory: { kinds: { ground: { mb: 217, n: 30, dropped: 0 }, targets: { mb: 186, n: 12, dropped: 0 } } },
  },
  samples: [
    { t: 1000, view: 'walk', scene: 'copperleaf', q: 0, res: 1, gmb: 400, tasks: {} },
    { t: 2000, view: 'walk', scene: 'copperleaf', q: 2, res: 0.8, gmb: 540, tasks: {} },
  ],
  events: [{ t: 3000, kind: 'webgl', msg: 'context lost' }],
};
const read = d => spawnSync('python3', [READER, '-'], { input: JSON.stringify(d), encoding: 'utf8' });

test('the reader finds the full test in `bench` and prints the failed step with its context', { skip: !python }, () => {
  const r = read(log);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Full test \(full\): PROBLEMS, 300 s, 2 steps, 1 not ok/);
  assert.match(r.stdout, /x Light lab: the land, a room, props, the air: 1 draw calls refused/);
  assert.match(r.stdout, /ctx: walk \| scene test_light_air/);
  assert.match(r.stdout, /refused: .*fogMarch/);
  assert.match(r.stdout, /Graphics memory \(estimate\) 403 MB: ground 217, targets 186/);
  assert.match(r.stdout, /Graphics memory peak by screen \(MB\): walk:copperleaf 540/);
  assert.match(r.stdout, /Quality and resolution \(2 changes\)/);
  assert.match(r.stdout, /context lost/);
  assert.match(r.stdout, /PREVIOUS PAGE ENDED UNEXPECTEDLY \(this page: reload\): after 600 s, scene test_graphics/);
  assert.match(r.stdout, /walk:copperleaf\s+120 {2}\+14 s\s+16\.5/);
});

test('an older log with `bench.result` still reads', { skip: !python }, () => {
  const r = read({ ...log, bench: { step: null, result: log.bench } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Full test \(full\): PROBLEMS/);
});

/* the two test reports the owner also sends: made up, numbers only (the 2026-10-30 phone report stays out of git) */
test('a Graphics test report reads as a summary: steps, costs and drift', { skip: !python }, () => {
  const r = read({
    game: 'Pocket Billies',
    kind: 'graphics',
    format: 4,
    costFrom: 'mean frame ms (1000 / fps)',
    build: '0.1.0',
    seconds: 1440,
    passed: true,
    device: { renderer: 'Adreno (TM) 750', dpr: 3 },
    conditions: { start: { browser: 'Chrome 155', hz: 60, measuredHz: 60 }, end: null },
    steps: [
      { step: 'Open ground', kind: 'base', seg: 'open', ok: true, fps: 49.9, p50: 16.7, p90: 33.3, draws: 120 },
      { step: 'Open ground: Shadows', kind: 'dial', seg: 'open', ok: true, fps: 40.1, p50: 16.7, p90: 33.3 },
      { step: 'Lagoon (worldMap.lagoon)', kind: 'notHere', ok: true },
    ],
    costs: [{ dial: 'shadows.mapSize', seg: 'open', shipped: 2048, value: 1536, cost: 4.9, noise: 0.4, unsure: false }],
    drift: { first: 20.04, last: 24.21, fpsFirst: 49.9, fpsLast: 41.3, runs: 4, change: 21, drifting: true },
    errors: [],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /not 'debug-log'/);
  assert.match(r.stdout, /Graphics test, Pocket Billies 0\.1\.0 \(format 4\)/);
  assert.match(r.stdout, /browser Chrome 155, hz 60, measuredHz 60/);
  assert.match(r.stdout, /Steps: 3 \(1 can't be measured on a walk, 0 over budget, 0 not ok\)/);
  assert.match(r.stdout, /Costs \(mean frame ms/);
  assert.match(r.stdout, /shadows\.mapSize on open \(2048 -> 1536\): \+4\.9 ms a frame/);
  assert.match(r.stdout, /Drift \(open ground, 4 runs\): 20\.04 -> 24\.21 ms \(49\.9 -> 41\.3 fps\), 21% DRIFTING/);
});

test('a diagnostics report reads as a summary: places, battle and errors', { skip: !python }, () => {
  const r = read({
    game: 'Pocket Billies',
    kind: 'diagnostics',
    format: 2,
    build: '0.1.0',
    seconds: 200,
    passed: false,
    places: [
      { place: 'Copperleaf', opened: 'in 3 s', fps: 42.5, worstFps: 20, worstFrameMs: 90, ok: false, why: 'slow' },
    ],
    battle: { ok: true, fps: 58, worstFps: 50 },
    errors: ['TypeError: x is undefined'],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Diagnostics, Pocket Billies 0\.1\.0 \(format 2\), .*PROBLEMS/);
  assert.match(r.stdout, /x {2}Copperleaf: 42\.5 fps \(worst 20\.0, worst frame 90 ms\).* - slow/);
  assert.match(r.stdout, /Battle: ok, 58\.0 fps/);
  assert.match(r.stdout, /error: TypeError/);
});
