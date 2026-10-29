// Dialogue track DL-1: every spoken string in game/data reads with no markup errors (logic/line-markup.js), and every
// script parses with the markup checks sayLine now makes. Strings with no tag-shaped bracket are not looked at.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, data, fn } from './setup-real.mjs';
import { parseLine } from '../../game/js/logic/line-markup.js';
import { withoutId } from '../../game/js/logic/script-parse.js';

/** a tag-shaped bracket: [name], [/name], [name=value] */
const TAG_SHAPED = /\[\/?[a-z]+(=[^\]\s]*)?\]/;
/** descriptions that name a script word in brackets, not lines (story.json `kept`: "[once] options") */
const NOT_LINES = new Set(['story.json kept']);

/** a line as a script holds it, without its indent, line id, entry or option mark and option conditions */
function lineOf(s) {
  let [t] = withoutId(s.trim()),
    m;
  t = t.replace(/^[->]\s*/, '');
  while ((m = /^\[(if\s+[^\]]*|once)\]\s*/.exec(t))) t = t.slice(m[0].length);
  return t;
}

test('every string in game/data with a tag in it parses with no markup errors', () => {
  const files = readdirSync(join(ROOT, 'game/data'), { recursive: true }).filter(
    f => typeof f === 'string' && f.endsWith('.json') && !f.startsWith('schema')
  );
  const bad = [];
  let seen = 0;
  const walk = (v, where) => {
    if (NOT_LINES.has(where)) return;
    if (typeof v === 'string') {
      for (const l of v.split('\n'))
        if (TAG_SHAPED.test(l)) {
          seen++;
          const e = parseLine(lineOf(l)).errors;
          if (e.length) bad.push(`${where}: ${l.trim()}: ${e.join('; ')}`);
        }
    } else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, where.includes(' ') ? where : `${where} ${k}`);
  };
  for (const f of files) walk(JSON.parse(readFileSync(join(ROOT, 'game/data', f), 'utf8')), f);
  assert.ok(seen >= 100, `only ${seen} lines with a tag found: the search is broken`);
  assert.deepEqual(bad, []);
});

test('every script in the game data parses, markup included', () => {
  const parseScript = fn('parseScript'),
    all = fn('scriptsOf')(data.gameData);
  assert.ok(all.length >= 10, `only ${all.length} scripts`);
  const bad = [];
  for (const s of all)
    try {
      parseScript(s.lines);
    } catch (e) {
      bad.push(`${s.id} (${s.where}) line ${e.line}: ${e.message}`);
    }
  assert.deepEqual(bad, []);
});
