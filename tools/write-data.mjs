// Phase 04b: writes the whole game data (JSON on stdin) as the data files in game/data, in the same layout and format
// as the Studio writes them (game/js/data-files.js). Only files whose content changed are written; the file of an
// entry that is gone is removed. tools/gamedata.py's save() runs this, so the Python build tools need no copy of the
// layout.
//   node tools/write-data.mjs < data.json
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, PB_DATA, writeFile } from './data-files.mjs';

const D = JSON.parse(readFileSync(0, 'utf8'));
const { index, files } = PB_DATA.split(D);
const texts = { 'index.json': PB_DATA.text(index) };
for (const [p, v] of Object.entries(files)) texts[p] = PB_DATA.text(v);
let wrote = 0,
  gone = 0;
for (const [p, t] of Object.entries(texts)) {
  const f = join(DATA, p);
  if (existsSync(f) && readFileSync(f, 'utf8') === t) continue;
  writeFile(p, t);
  wrote++;
}
for (const dir of Object.keys(PB_DATA.SPLIT)) {
  if (!existsSync(join(DATA, dir))) continue;
  for (const f of readdirSync(join(DATA, dir)))
    if (f.endsWith('.json') && !(`${dir}/${f}` in texts)) {
      unlinkSync(join(DATA, dir, f));
      gone++;
    }
}
const old = readdirSync(DATA).filter(f => f.endsWith('.json') && !(f in texts));
for (const f of old) {
  unlinkSync(join(DATA, f));
  gone++;
}
console.log(`game data: ${wrote} file(s) written, ${gone} removed`);
