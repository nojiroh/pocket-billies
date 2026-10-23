// Phase 03: game/version.js is the only place the version is written; the game, the Studio, the service worker, the
// debug log and saves read it. README.md's title and the newest CHANGELOG.md entry can't read it, so they are compared
// with it here. (TC-3: was the full check's "Version" step, tools/check-quick.py.)
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { ROOT } from './load-logic.mjs';

const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const box = { self: {} };
vm.runInNewContext(read('game/version.js'), box);
const V = box.self.PB_VERSION;

test('the version is 0.MINOR.PATCH alpha or beta', () => {
  assert.match(V, /^\d+\.\d+\.\d+ (alpha|beta)$/);
});

test("README.md's title and the newest CHANGELOG.md entry name it", () => {
  const title = read('README.md').split('\n')[0];
  assert.ok(title.endsWith(' ' + V), `README.md title says "${title}"`);
  const entry = read('CHANGELOG.md').match(/^## (\S+ \S+)/m);
  assert.equal(entry && entry[1], V, 'the newest CHANGELOG.md entry');
});

test('the game, the Studio and the service worker read version.js', () => {
  for (const f of ['game/index.html', 'studio/index.html'])
    assert.ok(read(f).includes('version.js"'), `${f} loads version.js`);
  assert.ok(read('game/sw.js').includes("importScripts('version.js')"), 'sw.js reads version.js');
});

test('no old version string is left in the code', () => {
  const all = dir =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? all(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []
    );
  const old = [...all('game/js'), 'game/sw.js'].filter(f => /'(?:pocketbillies-)?alpha-0\.\d/.test(read(f)));
  assert.deepEqual(old, []);
});
