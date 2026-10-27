// Studio plan Phase 1 (T1.1): the Studio's local drafts (game/js/logic/draft-record.js): a draft holds only what is
// pending, a stored one is checked whole before a restore, and a restore reads the draft's files over the loaded ones.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const R = modules['draft-record'];
const blob = { size: 4 }; // stands in for a Blob: the record only carries it
const draft = (over = {}) =>
  R.draftRecord({
    key: 'nojiroh/pocket-billies@main',
    base: 'abc123',
    login: 'nojiroh',
    time: 1700000000000,
    files: { 'meta.json': '{"a":1}\n', 'maps/copperleaf.json': '{}\n' },
    rigsText: '{"r":1}',
    art: [{ path: 'art/next/parts/front/a.png', blob }],
    ...over,
  });

test('a draft survives a round trip through storage, as a copy', () => {
  const d = draft(),
    back = R.draftParse(structuredClone({ ...d, art: [] }));
  assert.equal(d.v, R.DRAFT_VERSION);
  assert.deepEqual(back, { ...d, art: [] });
  assert.deepEqual(R.draftParse(d), d);
  assert.notEqual(R.draftParse(d).files, d.files);
});

test('a stored draft with anything off is refused whole', () => {
  const d = draft();
  for (const bad of [
    null,
    'text',
    { ...d, v: 0 },
    { ...d, v: 2 },
    { ...d, base: 1 },
    { ...d, time: NaN },
    { ...d, files: [] },
    { ...d, files: { '../x.json': '{}' } },
    { ...d, files: { 'meta.txt': '{}' } },
    { ...d, files: { 'meta.json': 3 } },
    { ...d, rigsText: {} },
    { ...d, art: {} },
    { ...d, art: [{ path: 'art/a.png' }] },
    { ...d, art: [{ path: 'game/js/x.js', blob }] },
    { ...d, art: [{ path: 'art/../x.png', blob }] },
    { ...d, texts: {} },
    { ...d, texts: [{ path: 'art/ui/bag.svg' }] },
    { ...d, texts: [{ path: 'art/ui/bag.png', text: '' }] },
    { ...d, texts: [{ path: 'art/rigs.js', text: '' }] },
    { ...d, texts: [{ path: 'art/../x.svg', text: '' }] },
  ])
    assert.equal(R.draftParse(bad), null, JSON.stringify(bad));
});

test('what a draft holds, in words', () => {
  assert.equal(R.draftSummary(draft()), '2 data files, the skeletons and 1 picture');
  assert.equal(R.draftSummary(draft({ files: {}, rigsText: null })), '1 picture');
  assert.equal(R.draftSummary(draft({ files: { 'index.json': '{}' }, rigsText: null, art: [] })), '0 data files');
  assert.equal(R.draftSummary(draft({ files: { 'a.json': '{}' }, art: [] })), '1 data file and the skeletons');
  assert.equal(R.draftEmpty(draft({ files: {}, rigsText: null, art: [] })), true);
  assert.equal(R.draftEmpty(draft({ files: {}, art: [] })), false);
});

test('SA-2b: text files ride in a draft, and a draft kept before them still reads', () => {
  const svg = { path: 'art/ui/bag.svg', text: '<svg/>' },
    d = draft({ texts: [svg, { path: 'art/manifest.js', text: 'window.ARTMAN={};\n' }] });
  assert.deepEqual(R.draftParse(structuredClone({ ...d, art: [] })).texts, d.texts);
  assert.equal(R.draftSummary(d), '2 data files, the skeletons, 1 picture and 2 text files');
  assert.equal(R.draftSummary(draft({ files: {}, rigsText: null, art: [], texts: [svg] })), '1 text file');
  assert.equal(R.draftEmpty(draft({ files: {}, rigsText: null, art: [], texts: [svg] })), false);
  const old = structuredClone({ ...draft(), art: [] });
  delete old.texts;
  assert.deepEqual(R.draftParse(old).texts, []);
});

test('a restore reads the draft’s file, else the loaded one, and refuses a file neither has', () => {
  const files = { 'meta.json': 'new' },
    base = { 'meta.json': 'old', 'rules.json': 'rules' };
  assert.equal(R.draftFileText(files, base, 'meta.json'), 'new');
  assert.equal(R.draftFileText(files, base, 'rules.json'), 'rules');
  assert.throws(() => R.draftFileText(files, base, 'maps/gone.json'), /maps\/gone\.json/);
  assert.throws(() => R.draftFileText(files, base, 'constructor'), /constructor/);
});
