// Project Story S2: line ids. Every line of dialogue and every choice option in a story script ends with a short id,
// " #l:3fa9", that stays with the line when its text is edited or it moves: the debug log, the Studio and later a
// translation can point at it, and once / cycle / seq / [once] without a key remember by it (docs/SCRIPTS.md).
//   npm run story:ids           gives every line without an id one (and a second copy of an id a new one)
//   node tools/story-ids.mjs --check    only lists what is missing or doubled (check-data.mjs runs this)
// The scripts: a map's people (maps/<id>.json), a trainer (trainers/<id>.json), story.json scripts.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, PB_DATA } from './data-files.mjs';
import { giveLineIds as giveIds, lineIdProblems, lineKind } from '../game/js/logic/story-checks.js';

export { lineIdProblems, lineKind };
/** every script in the data: { id, file, lines, put(lines) } */
export function storyScripts(dir = DATA) {
  const out = [];
  const json = p => JSON.parse(readFileSync(join(dir, p), 'utf8'));
  for (const f of readdirSync(join(dir, 'maps'))
    .filter(f => f.endsWith('.json'))
    .sort()) {
    const p = 'maps/' + f,
      M = json(p);
    for (const P of M.people || [])
      if (P.script) out.push({ id: 'person:' + P.id, file: p, data: M, lines: P.script, put: L => (P.script = L) });
  }
  for (const f of readdirSync(join(dir, 'trainers'))
    .filter(f => f.endsWith('.json'))
    .sort()) {
    const p = 'trainers/' + f,
      T = json(p);
    if (T.script)
      out.push({ id: 'trainer:' + f.slice(0, -5), file: p, data: T, lines: T.script, put: L => (T.script = L) });
  }
  const S = json('story.json');
  for (const [k, v] of Object.entries(S.scripts || {}))
    out.push({ id: 'story:' + k, file: 'story.json', data: S, lines: v.script, put: L => (v.script = L) });
  return out;
}
/** gives each line without an id (or with an id seen before) a new one; returns how many */
export const giveLineIds = scripts => giveIds(scripts, seed => createHash('sha1').update(seed).digest('hex'));

if (import.meta.url === `file://${process.argv[1]}`) {
  const scripts = storyScripts();
  if (process.argv.includes('--check')) {
    const P = lineIdProblems(scripts);
    for (const p of P) console.log(`${p.script}, line ${p.line + 1}: ${p.problem}`);
    console.log(P.length ? `${P.length} line id problem(s)` : `line ids: ${scripts.length} scripts, all fine`);
    process.exit(P.length ? 1 : 0);
  }
  const n = giveLineIds(scripts);
  const files = new Map(scripts.map(s => [s.file, s.data]));
  for (const [p, v] of files) {
    const t = PB_DATA.text(v);
    if (readFileSync(join(DATA, p), 'utf8') !== t) writeFileSync(join(DATA, p), t);
  }
  console.log(`line ids: ${n} new, in ${scripts.length} scripts`);
}
