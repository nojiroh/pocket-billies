// Buildings track BD-6: a low-poly recipe's triangles as the game builds them (game/js/prop-models.js
// lowPolyFromRecipe), for the Python picture baker (tools/build-props-island.py `bake`), which has no prisms, lathes,
// turns, tilts, tapers or warps of its own. Turning parts are included at rest.
//   node tools/model-mesh.mjs < recipe.json   ->   JSON [[x, y, z, x, y, z, x, y, z, "#rrggbb"], ...]
// Metres as the baker reads them: x across, y back (depth), z up.
import { readFileSync } from 'node:fs';

await import('./test/walk-renderer.mjs');
const { lowPolyFromRecipe } = await import('../game/js/prop-models.js');

const rec = JSON.parse(readFileSync(0, 'utf8'));
const layers = (rec.layers || []).filter(l => l.k !== 'img' && !l.hide).map(l => ({ ...l, spin: undefined }));
const M = lowPolyFromRecipe({ ...rec, layers });
const out = [];
if (M) {
  const i16 = new Int16Array(M.vb),
    u8 = new Uint8Array(M.vb),
    hex = v => v.toString(16).padStart(2, '0');
  for (let t = 0; t < M.ib.length; t += 3) {
    const row = [];
    for (let k = 0; k < 3; k++) {
      const o = M.ib[t + k] * 24;
      row.push(i16[o / 2] / 256, i16[o / 2 + 2] / 256, i16[o / 2 + 1] / 256);
    }
    const o = M.ib[t] * 24;
    row.push('#' + hex(u8[o + 20]) + hex(u8[o + 21]) + hex(u8[o + 22]));
    out.push(row);
  }
}
process.stdout.write(JSON.stringify(out));
