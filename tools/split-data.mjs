// Phase 04b, run once: splits game/data/gamedata.js (the single file the Studio used to write) into the data files
// (game/data/index.json, <section>.json, <section>/<id>.json). Checks that putting them back together gives the same
// data in the same order before it writes anything.
//   node tools/split-data.mjs [path/to/gamedata.js]
import { readFileSync } from 'node:fs';
import { DATA, PB_DATA, writeFile } from './data-files.mjs';
import { join } from 'node:path';

const src = readFileSync(process.argv[2] || join(DATA, 'gamedata.js'), 'utf8');
const at = src.indexOf('window.GAMEDATA=');
if (at < 0) throw new Error('window.GAMEDATA= not found');
const D = JSON.parse(
  src
    .slice(at + 'window.GAMEDATA='.length)
    .trim()
    .replace(/;\s*$/, '')
);

const { index, files } = PB_DATA.split(D);
const texts = Object.fromEntries(Object.entries(files).map(([p, v]) => [p, PB_DATA.text(v)]));
const back = PB_DATA.assemble(index, p => JSON.parse(texts[p]));
// same values in the same order (the assembled objects come from the sandbox, so compare their JSON)
if (JSON.stringify(back) !== JSON.stringify(D)) throw new Error('the files do not give back the same data');

writeFile('index.json', PB_DATA.text(index));
for (const [p, t] of Object.entries(texts)) writeFile(p, t);
console.log(`${Object.keys(texts).length + 1} files written to game/data/`);
