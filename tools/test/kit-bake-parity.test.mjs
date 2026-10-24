// Studio plan Phase 5, T5.1: every kit Billie bakes as committed. Each of the 24 recipes in game/data/kitBuilds.json is
// baked with game/js/logic/kit-assemble.js (kitBakeWhole, as `npm run bake:kits` and the Studio bake) and compared with
// the repository: the sheet (game/art/next/billionaires/<name>.png, alpha exactly and colour where a pixel shows), the
// rig (game/art/next/rigs-next.js, both views, values and key order) and the stage's native parts
// (game/data/lines/<line>.json "parts"). The committed art was the Python builder's output byte for byte (Pillow
// 12.3.0) when this test was written, and stayed equal until the builder retired (Phase 5, session 3), so the JS baker
// is that builder. A recipe or a kit part's picture changed without a bake fails here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { readPng } from './png.mjs';
import { modules, ROOT } from './setup-real.mjs';

const A = modules['kit-assemble'];
const K = JSON.parse(readFileSync(join(ROOT, 'game/data/partKits.json'), 'utf8'));
const B = JSON.parse(readFileSync(join(ROOT, 'game/data/kitBuilds.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(join(ROOT, 'game/data/rules.json'), 'utf8'));
const RIGS = (() => {
  const box = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'game/art/next/rigs-next.js'), 'utf8'), box);
  return box.window.RIGS_NEXT;
})();
const cache = new Map();
const pics = (id, view) => {
  const key = id + '|' + view;
  if (!cache.has(key)) cache.set(key, readPng(join(ROOT, 'game/art', K.parts[id].views[view].file)));
  return cache.get(key);
};

/** the first few differences between two JSON values, as paths */
function jsonDiff(a, b, path = '', out = []) {
  if (out.length > 4) return out;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) {
    out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} vs ${JSON.stringify(b)?.slice(0, 80)}`);
    return out;
  }
  if (a && typeof a === 'object') {
    const ka = Object.keys(a),
      kb = Object.keys(b);
    if (ka.join() !== kb.join()) out.push(`${path}: keys ${ka} vs ${kb}`);
    for (const k of ka) if (k in b) jsonDiff(a[k], b[k], `${path}.${k}`, out);
    return out;
  }
  if (a !== b) out.push(`${path}: ${a} vs ${b}`);
  return out;
}
/** where two pictures differ: size, or the first pixel and how many */
function pixelDiff(made, ref) {
  if (made.width !== ref.width || made.height !== ref.height)
    return `size ${made.width}x${made.height} vs ${ref.width}x${ref.height}`;
  let first = null,
    n = 0;
  for (let i = 0; i < ref.data.length; i += 4) {
    const bad =
      made.data[i + 3] !== ref.data[i + 3] ||
      (ref.data[i + 3] &&
        (made.data[i] !== ref.data[i] || made.data[i + 1] !== ref.data[i + 1] || made.data[i + 2] !== ref.data[i + 2]));
    if (bad) {
      n++;
      if (!first) {
        const p = i / 4;
        first = `(${p % ref.width}, ${Math.floor(p / ref.width)}) ${[...made.data.subarray(i, i + 4)]} vs ${[...ref.data.subarray(i, i + 4)]}`;
      }
    }
  }
  return n ? `${n} pixels, first at ${first}` : '';
}

test('every kit Billie bakes as committed (the retired Python builder, number for number)', () => {
  const problems = [];
  assert.equal(B.forms.length, 51);
  for (const form of B.forms) {
    const where = `${form.name} (${form.rig})`;
    let made;
    try {
      made = A.kitBakeWhole({ partKits: K, kitBuilds: B, rules: RULES }, form, pics);
    } catch (e) {
      problems.push(`${where}: ${e.stack.split('\n').slice(0, 3).join(' / ')}`);
      continue;
    }
    const sheet = pixelDiff(made.sheet, readPng(join(ROOT, `game/art/next/billionaires/${form.name}.png`)));
    if (sheet) problems.push(`${where} sheet: ${sheet}`);
    for (const d of jsonDiff(JSON.parse(JSON.stringify(made.rig)), RIGS[form.rig], 'rig'))
      problems.push(`${where} ${d}`);
    const line = JSON.parse(readFileSync(join(ROOT, `game/data/lines/${form.line}.json`), 'utf8'));
    for (const d of jsonDiff(made.parts, line.parts[form.stage], 'parts')) problems.push(`${where} ${d}`);
  }
  assert.deepEqual(problems, []);
});
