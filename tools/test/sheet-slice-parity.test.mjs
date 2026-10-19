// Studio track ST-3: the Studio slices the phase 16 kits exactly as tools/slice-part-kit.py did. Every kit sheet in
// tools/art-source/part-kit is cut with game/js/logic/sheet-slice.js and compared with what the Python slicer wrote
// (game/data/partKits.json and game/art/next/parts): the same parts in the same order, sizes, sockets and manifest,
// and every pixel the same (alpha exactly; colour where the pixel shows).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPng } from './png.mjs';
import { modules, ROOT } from './setup-real.mjs';

const S = modules['sheet-slice'];
const SRC = join(ROOT, 'tools/art-source/part-kit');
const cfg = JSON.parse(readFileSync(join(SRC, 'kits.json'), 'utf8'));
const want = JSON.parse(readFileSync(join(ROOT, 'game/data/partKits.json'), 'utf8')).parts;

test('the kits slice exactly as tools/slice-part-kit.py sliced them', () => {
  const made = {};
  for (const kit of cfg.kits)
    for (const view of ['front', 'back']) {
      const r = S.sheetSliceKit(readPng(join(SRC, `${kit.name}-${view}.png`)), kit, cfg, view);
      assert.equal(r.problem, '', `${kit.name} ${view}`);
      for (const p of r.parts) {
        made[p.id] = S.sheetKitEntry(made[p.id], kit, cfg, p, view);
        const ref = readPng(join(ROOT, 'game/art', want[p.id].views[view].file)),
          where = `${p.id} ${view}`;
        assert.deepEqual([p.img.width, p.img.height], [ref.width, ref.height], where);
        for (let i = 0; i < ref.data.length; i += 4) {
          assert.equal(p.img.data[i + 3], ref.data[i + 3], `${where}: alpha at pixel ${i / 4}`);
          if (ref.data[i + 3])
            assert.deepEqual(
              [...p.img.data.subarray(i, i + 3)],
              [...ref.data.subarray(i, i + 3)],
              `${where}: pixel ${i / 4}`
            );
        }
      }
    }
  assert.equal(JSON.stringify(made), JSON.stringify(want)); // same entries, same order
});
