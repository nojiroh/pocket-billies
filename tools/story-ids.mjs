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

export const LINE_ID = /\s+#l:([0-9a-z]{4,8})$/;
/** what a line of a script is, for ids: 'say' (dialogue), 'option' (> text), or null (a command or a keyword) */
export function lineKind(raw) {
  let s = raw.trim();
  if (s.startsWith('>')) return 'option';
  if (/^-(\s|$)/.test(s)) s = s.slice(1).trim();
  if (!s || /^[a-z][a-z-]*(\s|$)/.test(s)) return null;
  return 'say';
}
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
/** the lines without an id, and the ids used twice: [{ script, line, problem }] */
export function lineIdProblems(scripts) {
  const seen = new Map(),
    out = [];
  for (const sc of scripts)
    sc.lines.forEach((raw, i) => {
      if (typeof raw !== 'string' || !lineKind(raw)) return;
      const m = LINE_ID.exec(raw);
      if (!m) return out.push({ script: sc.id, line: i, problem: 'has no line id (npm run story:ids)' });
      if (seen.has(m[1]))
        out.push({ script: sc.id, line: i, problem: `line id ${m[1]} is also ${seen.get(m[1])} (npm run story:ids)` });
      else seen.set(m[1], `${sc.id} line ${i + 1}`);
    });
  return out;
}
/** gives each line without an id (or with an id seen before) a new one; returns how many */
export function giveLineIds(scripts) {
  const used = new Set();
  for (const sc of scripts) for (const raw of sc.lines) if (LINE_ID.test(raw)) used.add(LINE_ID.exec(raw)[1]);
  const seen = new Set();
  let n = 0;
  for (const sc of scripts) {
    const L = sc.lines.map((raw, i) => {
      if (typeof raw !== 'string' || !lineKind(raw)) return raw;
      const m = LINE_ID.exec(raw);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        return raw;
      }
      const text = m ? raw.slice(0, m.index) : raw.trimEnd();
      let id,
        k = 0;
      do
        id = createHash('sha1')
          .update(`${sc.id}|${i}|${text}|${k++}`)
          .digest('hex')
          .slice(0, k > 50 ? 6 : 4);
      while (used.has(id));
      used.add(id);
      seen.add(id);
      n++;
      return `${text} #l:${id}`;
    });
    sc.put(L);
    sc.lines = L;
  }
  return n;
}

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
