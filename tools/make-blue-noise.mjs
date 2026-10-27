// Air track AIR-4: makes the light-in-air march's blue-noise tile (game/js/logic/blue-noise.js, 64 x 64, seed 1) and
// writes it into BLUE_NOISE_64 there. Run again only if blueNoiseMake changes; tools/test/blue-noise.test.mjs fails
// when the table and the maker disagree.
//
//   node tools/make-blue-noise.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blueNoiseMake } from '../game/js/logic/blue-noise.js';

const F = join(import.meta.dirname, '..', 'game', 'js', 'logic', 'blue-noise.js');
const t0 = Date.now(),
  b64 = Buffer.from(blueNoiseMake(64, 1)).toString('base64'),
  src = readFileSync(F, 'utf8'),
  out = src.replace(/export const BLUE_NOISE_64 = '[^']*';/, `export const BLUE_NOISE_64 = '${b64}';`);
if (out === src && !src.includes(b64)) throw new Error('BLUE_NOISE_64 not found in ' + F);
writeFileSync(F, out);
console.log(`blue noise 64 x 64: ${b64.length} characters in ${Date.now() - t0} ms`);
