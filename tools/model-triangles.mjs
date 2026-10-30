// The triangles of low-poly recipes as the game makes them (game/js/prop-models.js lowPolyFromRecipe: prisms, lathes,
// tilt, warp and all), for the Python picture bakers (build-civic.py): reads recipe files, writes JSON
// [{tris: [[[x, y, z] x3, '#rrggbb'], ...]}] to stdout, metres with x across, y back (depth), z up, as recipes are.
//   node tools/model-triangles.mjs game/art/scene/next/models/shop.json [...]
import { readFileSync } from 'node:fs';

await import('./test/walk-renderer.mjs');
const { lowPolyFromRecipe } = await import('../game/js/prop-models.js');

const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
const out = process.argv.slice(2).map(file => {
  const M = lowPolyFromRecipe(JSON.parse(readFileSync(file, 'utf8'))),
    i16 = new Int16Array(M.vb),
    u8 = new Uint8Array(M.vb),
    /* a vertex: position (the mesh's up is y, its depth z) and its colour bytes */
    v = i => [
      [i16[i * 12] / 256, i16[i * 12 + 2] / 256, i16[i * 12 + 1] / 256],
      hex(u8[i * 24 + 20], u8[i * 24 + 21], u8[i * 24 + 22]),
    ];
  const tris = [];
  for (let t = 0; t < M.ib.length; t += 3) {
    const a = v(M.ib[t]),
      b = v(M.ib[t + 1]),
      c = v(M.ib[t + 2]);
    tris.push([a[0], b[0], c[0], a[1]]);
  }
  return { file, n: M.tris, tris };
});
process.stdout.write(JSON.stringify(out));
