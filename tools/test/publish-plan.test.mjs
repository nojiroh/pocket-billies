// Studio plan Phase 0: the Studio's publish decisions (game/js/logic/publish-plan.js): what a confirmed send may mark
// as saved, the branch name, the files a proposal shares with main's new commits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const P = modules['publish-plan'];

test('a confirmed send marks saved only what is still as it was sent', () => {
  const staged = {
    dataText: 'D1',
    rigsText: 'R1',
    art: [
      { path: 'art/a.png', ver: 3 },
      { path: 'art/b.png', ver: 1 },
    ],
  };
  assert.deepEqual(
    P.publishConfirm(staged, { dataText: 'D1', rigsText: 'R1', art: { 'art/a.png': 3, 'art/b.png': 1 } }),
    {
      data: true,
      rigs: true,
      art: ['art/a.png', 'art/b.png'],
    }
  );
  // edited during the send: data changed, a picture painted again, a picture taken back
  assert.deepEqual(
    P.publishConfirm(staged, { dataText: 'D2', rigsText: 'R1', art: { 'art/a.png': 4, 'art/b.png': null } }),
    {
      data: false,
      rigs: true,
      art: [],
    }
  );
});

test('nothing staged is never confirmed', () => {
  const staged = { dataText: null, rigsText: null, art: [] };
  assert.equal(P.publishEmpty(staged), true);
  assert.deepEqual(P.publishConfirm(staged, { dataText: null, rigsText: null, art: {} }), {
    data: false,
    rigs: false,
    art: [],
  });
  assert.equal(P.publishEmpty({ dataText: null, rigsText: 'R', art: [] }), false);
});

test('the files a proposal shares with main, sorted and once each', () => {
  assert.deepEqual(
    P.publishOverlap(
      ['game/data/b.json', 'game/data/a.json', 'game/data/b.json'],
      ['game/data/b.json', 'game/data/a.json', 'x']
    ),
    ['game/data/a.json', 'game/data/b.json']
  );
  assert.deepEqual(P.publishOverlap(['game/data/a.json'], []), []);
});

test('a branch name has the second and a random tail, and only safe letters', () => {
  const d = new Date(Date.UTC(2026, 9, 22, 20, 5, 9));
  assert.equal(P.publishBranchName('nojiroh', d, 'Q7zx'), 'studio/nojiroh-20261022-200509-q7zx');
  assert.equal(P.publishBranchName('a b/..c', d, ''), 'studio/abc-20261022-200509');
  assert.notEqual(P.publishBranchName('x', d, 'aaaa'), P.publishBranchName('x', d, 'bbbb'));
});
