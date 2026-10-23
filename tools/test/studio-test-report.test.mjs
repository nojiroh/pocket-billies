// Studio track ST-T: the Studio self-test's rules (game/js/logic/studio-test-report.js): stats, the "Look here first"
// list, the comparison between runs, file paths without the GitHub owner, and the privacy check. The test itself runs
// in the Studio (studio/js/studio-test.js); this file never runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDIO_TEST_FORMAT,
  studioTestChangedPaths,
  studioTestCompare,
  studioTestFilePath,
  studioTestFindings,
  studioTestMetrics,
  studioTestPrivacyProblems,
  studioTestStats,
} from '../../game/js/logic/studio-test-report.js';

const section = (id, extra = {}) => ({
  id,
  open: { ms: 40, html: 20, dom: 15, after: 5, previews: 0 },
  beside: null,
  frames: { n: 60, avg: 16.7, p50: 16.7, p95: 18, max: 20 },
  loops: [],
  conn: 10,
  longTasks: { n: 0, ms: 0 },
  edit: null,
  ...extra,
});
const report = (extra = {}) => ({
  kind: 'studio-test',
  format: STUDIO_TEST_FORMAT,
  seconds: 80,
  sections: [section('moves'), section('types')],
  undo: { max: 80, snapMB: 1, fullMB: 80 },
  tools: {},
  leaks: { heapMB: [100, 110], nodes: [1000, 1050], loops: [], intervals: [1, 1] },
  errors: [],
  ...extra,
});

test('stats: p50, p95 and worst of a list of times, ignoring what is not a number', () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.deepEqual(studioTestStats(v), { n: 100, avg: 50.5, p50: 51, p95: 96, max: 100 });
  assert.deepEqual(studioTestStats([NaN, 3, Infinity]), { n: 1, avg: 3, p50: 3, p95: 3, max: 3 });
  assert.deepEqual(studioTestStats([]), { n: 0, avg: 0, p50: 0, p95: 0, max: 0 });
});

test('a report with every number under its limit has nothing to look at', () => {
  assert.deepEqual(studioTestFindings(report()), []);
});

test('a slow section is named with its slowest part first', () => {
  const r = report({
    sections: [section('scenes', { open: { ms: 900, html: 100, dom: 700, after: 90, previews: 10 } })],
  });
  const f = studioTestFindings(r);
  assert.equal(f.length, 1);
  assert.equal(f[0].lvl, 'high');
  assert.equal(f[0].area, 'scenes');
  assert.match(
    f[0].text,
    /^Opens in 900 ms \(putting it on the page 700 ms, building the HTML 100 ms, the after-draw steps 90 ms/
  );
});

test('the undo copy is reported once for every edit, from the slowest, and the full undo by its size', () => {
  const edit = (snapMs, snapMB) => ({
    ms: snapMs + 10,
    snapMs,
    snapMB,
    checkMs: 5,
    sendMs: 2,
    undoMs: 30,
    redoMs: 30,
    back: true,
  });
  const r = report({
    sections: [section('moves', { edit: edit(120, 6.5) }), section('types', { edit: edit(80, 6.5) })],
    undo: { max: 80, snapMB: 6.5, lastMB: 13, edits: 2, stepsMB: 507, fullMB: 520 },
  });
  const f = studioTestFindings(r);
  const copy = f.filter(x => x.area === 'every edit');
  assert.equal(copy.length, 1);
  assert.match(copy[0].text, /6\.5 MB\) in up to 120 ms/);
  assert.equal(f[0].area, 'undo', 'the undo (high) comes first');
  assert.equal(
    f[0].text,
    'The undo holds 520 MB after the test’s 2 edits: the data once (13 MB) and what each edit changed (507 MB)'
  );
});

test('the undo as measured: under its limit, nothing to look at', () => {
  const r = report({ undo: { max: 80, snapMB: 2.7, lastMB: 5.4, edits: 14, stepsMB: 1.2, fullMB: 6.6 } });
  assert.deepEqual(
    studioTestFindings(r).filter(x => x.area === 'undo'),
    []
  );
});

test('errors and data that did not come back come before everything else', () => {
  const r = report({
    sections: [
      section('scenes', { open: { ms: 5000, html: 0, dom: 0, after: 0, previews: 0 } }),
      section('moves', { edit: { ms: 1, snapMs: 0, back: false } }),
    ],
    errors: [{ where: 'robots', msg: 'x is undefined' }],
  });
  const f = studioTestFindings(r);
  assert.deepEqual(
    f.slice(0, 2).map(x => x.area),
    ['robots', 'moves']
  );
  assert.equal(f[2].area, 'scenes');
});

test('frames are judged only when there were enough of them', () => {
  const slow = { n: 60, avg: 40, p50: 40, p95: 70, max: 90 };
  assert.equal(
    studioTestFindings(report({ sections: [section('preview', { frames: slow, loops: ['frameLoop'] })] }))[0].text,
    'Frames are slow while it is open: p95 70 ms, worst 90 ms (loops: frameLoop)'
  );
  assert.deepEqual(studioTestFindings(report({ sections: [section('preview', { frames: { ...slow, n: 3 } })] })), []);
});

test('leaks: a loop left running, memory and elements kept on the second pass', () => {
  const r = report({ leaks: { heapMB: [100, 400], nodes: [1000, 2500], loops: ['rbAnimate'], intervals: [1, 3] } });
  const t = studioTestFindings(r).map(x => x.text);
  assert.ok(t.includes('Memory grew by 300 MB on the second pass'));
  assert.ok(t.includes('The page kept 1500 more elements on the second pass'));
  assert.ok(t.includes('The animation loop rbAnimate kept running after its section was left'));
  assert.ok(t.includes('2 timers kept running after their section was left'));
});

test('the comparison lists what moved by enough, biggest first, and nothing for another format', () => {
  const a = report(),
    b = report({
      sections: [
        section('moves', { open: { ms: 400, html: 0, dom: 0, after: 0, previews: 0 } }),
        section('types', { conn: 12 }),
      ],
      seconds: 60,
    });
  const c = studioTestCompare(a, b);
  assert.deepEqual(
    c.map(x => [x.key, x.before, x.after, x.worse]),
    [
      ['moves opens (ms)', 40, 400, true],
      ['the whole run (s)', 80, 60, false],
    ]
  );
  assert.equal(c[0].change, 900);
  assert.deepEqual(studioTestCompare(a, { ...b, format: STUDIO_TEST_FORMAT + 1 }), []);
  assert.deepEqual(studioTestCompare(null, b), []);
});

test('metrics name each number the same way in every run', () => {
  const m = studioTestMetrics(report());
  assert.equal(m['moves opens (ms)'], 40);
  assert.equal(m['types frame p95 (ms)'], 18);
  assert.equal(m['undo after the edits (MB)'], 80);
  assert.ok(!('moves beside (ms)' in m), 'a section that does not open beside has no number for it');
});

test('a file path keeps no host, query or GitHub owner', () => {
  assert.equal(
    studioTestFilePath(
      'https://api.github.com/repos/someone/pocket-billies/contents/game/data/maps/copperleaf.json?ref=main'
    ),
    'game/data/maps/copperleaf.json'
  );
  assert.equal(
    studioTestFilePath('https://someone.github.io/pocket-billies/studio/js/map-editor.js'),
    'studio/js/map-editor.js'
  );
  assert.equal(
    studioTestFilePath('http://127.0.0.1:8000/game/art/coins/penny_32.png#x'),
    'game/art/coins/penny_32.png'
  );
  assert.equal(studioTestFilePath('https://fonts.example.com/css/font%20face.woff2'), 'font face.woff2');
  assert.equal(studioTestFilePath(''), '');
});

test('the privacy check finds a token or a planted name, and passes a clean report', () => {
  const clean = JSON.stringify(report());
  assert.deepEqual(studioTestPrivacyProblems(clean, ['Quillonda']), []);
  assert.deepEqual(studioTestPrivacyProblems(clean.replace('moves', 'ghp_abcdefgh1234'), []), ['a GitHub token']);
  assert.deepEqual(studioTestPrivacyProblems(clean.replace('moves', 'github_pat_11AAAAAAAA_x'), []), [
    'a GitHub token',
  ]);
  assert.deepEqual(studioTestPrivacyProblems(clean.replace('moves', 'Quillonda'), ['Quillonda']), [
    'the planted text Quillonda',
  ]);
});

test('a high finding comes before a mid one even when the mid one is further past its first limit', () => {
  const r = report({
    sections: [
      section('preview', { frames: { n: 60, avg: 40, p50: 40, p95: 70, max: 90 } }),
      section('moves', { conn: 390 }),
    ],
  });
  const f = studioTestFindings(r);
  assert.deepEqual(
    f.map(x => [x.area, x.lvl]),
    [
      ['preview', 'high'],
      ['moves', 'mid'],
    ]
  );
  assert.ok(f[1].over > f[0].over, 'the mid row is further past its first limit');
});

test('opening a section that changes the data outside an edit fails the run, naming the section and the paths', () => {
  const before = { D: { people: { boy: { hair: '#000' }, chosen: { look: {} } }, moves: { a: 1 } }, R: {} },
    after = {
      D: { people: { boy: { hair: '#000', look: {} }, chosen: { look: {} } }, moves: { a: 1 }, extra: [] },
      R: {},
    };
  assert.deepEqual(studioTestChangedPaths(before, after), ['D.extra', 'D.people.boy']);
  assert.deepEqual(studioTestChangedPaths(before, before), []);
  const many = { D: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, { v: i }])) };
  assert.equal(studioTestChangedPaths({ D: {} }, many, 3).length, 3, 'a long list is cut');
  const f = studioTestFindings(report({ sections: [section('people', { outside: ['D.people.boy'] })] }));
  assert.equal(f.length, 1);
  assert.equal(f[0].lvl, 'high');
  assert.equal(f[0].area, 'people');
  assert.equal(f[0].text, 'Opening people changed the data outside an edit: D.people.boy');
});
