// SP-1 (slow tier): every kit recipe grafted with every distinct donor part per slot (one donor for each part id)
// bakes with kitBakeWhole and fits the stage box. Prints the bake times (Node, this machine), the numbers the phone's
// debug log is read against.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPng } from './png.mjs';
import { modules, ROOT } from './setup-real.mjs';

const G = modules['graft-art'];
const { kitBakeWhole } = modules['kit-assemble'];
const read = (/** @type {string} */ f) => JSON.parse(readFileSync(join(ROOT, 'game/data', f), 'utf8'));
const K = read('partKits.json'),
  B = read('kitBuilds.json'),
  D = { partKits: K, kitBuilds: B, rules: read('rules.json') };
const cache = new Map();
const pics = (/** @type {string} */ id, /** @type {string} */ view) => {
  const key = id + '|' + view;
  if (!cache.has(key)) cache.set(key, readPng(join(ROOT, 'game/art', K.parts[id].views[view].file)));
  return cache.get(key);
};

test('graft-art sweep: every recipe with every distinct donor part per slot bakes and fits', () => {
  const ms = [],
    bad = [];
  let bytes = 0;
  for (const base of B.forms)
    for (const slot of G.GRAFT_SLOTS) {
      const kind = G.graftKind(K, base, slot),
        seen = new Set();
      for (const donor of G.graftDonors(B, K, base.rig, slot)) {
        const pid = G.geneSplit(donor).part;
        if (seen.has(pid)) continue;
        seen.add(pid);
        const f = G.graftForm(B, K, base.rig, { [slot]: donor }),
          t = performance.now();
        try {
          const made = kitBakeWhole(D, f, pics);
          ms.push(performance.now() - t);
          bytes = Math.max(bytes, made.sheet.width * made.sheet.height * 4);
        } catch (e) {
          bad.push(`${f.name}: ${/** @type {Error} */ (e).message}`);
        }
      }
    }
  ms.sort((a, b) => a - b);
  console.log(
    `# graft sweep: ${ms.length} bakes, median ${ms[ms.length >> 1].toFixed(1)} ms, 95th ${ms[Math.floor(ms.length * 0.95)].toFixed(1)} ms, max ${ms.at(-1).toFixed(1)} ms, biggest sheet ${(bytes / 1024).toFixed(0)} KB`
  );
  assert.deepEqual(bad, []);
  assert.ok(ms.length > 500);
});
