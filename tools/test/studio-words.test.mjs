// Clean-up track, lane S (docs/phases/cleanup-track.md): the Studio never says "placeholder", "AI" or "Claude". It
// covers the Studio's files (studio/**), its guide (docs/STUDIO.md) and the data names it shows: the Billie cries'
// names (game/data/lines/*.json), the robot parts' blurbs (robots.json `d`), the run regions' name parts
// (regions.json) and the body plans (bodyPlans.json). HTML's own placeholder (the grey hint in an empty box) is the
// browser's name for it, so `placeholder=` attributes, `placeholder:` keys and `.placeholder` properties are taken
// out before looking.
// The music step waits (cleanup-track.md section 7): music.json, studio/js/music-editor.js and
// game/js/logic/music-studio.js are not looked at until it lands; then they join here.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));
// the music step's files (cleanup-track.md, lane S, "The music step")
const MUSIC = new Set(['studio/js/music-editor.js']);
// and its line in docs/STUDIO.md (Music & sound)
const MUSIC_LINES = ['cries and Billie cries still named "placeholder".'];
const TEXT = /\.(js|mjs|html|css|json|md)$/;

/** every text file under a folder, as repo paths */
const walk = dir =>
  readdirSync(join(ROOT, dir)).flatMap(n => {
    const p = `${dir}/${n}`;
    return statSync(join(ROOT, p)).isDirectory() ? walk(p) : TEXT.test(n) ? [p] : [];
  });

/** the words this test refuses; in code and pages (html) after HTML's own placeholder (attribute, field option key,
 * property) is taken out. Data names have no such hint, so nothing is taken out of them. */
function badWords(text, html = true) {
  const t = !html
    ? text
    : text
        .replace(/\bplaceholder\s*=/gi, '')
        .replace(/\bplaceholder\s*:/g, '')
        .replace(/\.placeholder\b/g, '');
  const out = [];
  for (const re of [/\bplaceholders?\b/gi, /\bAI\b/g, /\bClaude\b/gi])
    for (const m of t.matchAll(re)) out.push(t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40));
  return out;
}

/** [where, the text around a refused word] for every hit */
const hits = (list, html = true) =>
  list.flatMap(([where, text]) => badWords(String(text), html).map(s => `${where}: …${s}…`));

test('the Studio files and docs/STUDIO.md say no "placeholder", "AI" or "Claude"', () => {
  const files = [...walk('studio'), 'docs/STUDIO.md'].filter(f => !MUSIC.has(f));
  assert.ok(files.length > 50, 'the Studio was not found');
  const text = f => MUSIC_LINES.reduce((t, line) => t.replace(line, ''), read(f));
  assert.deepEqual(hits(files.map(f => [f, text(f)])), []);
});

test('the data names the Studio shows say no "placeholder", "AI" or "Claude"', () => {
  const dir = 'game/data/lines';
  /** @type {[string, unknown][]} */
  const names = [];
  for (const f of readdirSync(join(ROOT, dir)).filter(n => n.endsWith('.json'))) {
    const L = json(`${dir}/${f}`);
    for (const c of L.cry || []) names.push([`${dir}/${f} cry`, c && c.name]);
  }
  const robots = json('game/data/robots.json');
  for (const [id, p] of Object.entries(robots.parts || {})) names.push([`robots.json parts.${id}.d`, p && p.d]);
  names.push(['regions.json names', JSON.stringify(json('game/data/regions.json').names)]);
  names.push(['bodyPlans.json', read('game/data/bodyPlans.json')]);
  assert.ok(names.filter(([w]) => w.endsWith(' cry')).length > 40, 'the cries were not found');
  assert.ok(
    names.some(([w]) => w.startsWith('robots.json')),
    'the robot parts were not found'
  );
  assert.deepEqual(hits(names, false), []);
});

test('the guard itself: it finds the words and leaves the HTML hint alone', () => {
  assert.equal(badWords('<input placeholder="Find…"> {ph: "x", placeholder: "y"} el.placeholder = ""').length, 0);
  assert.equal(badWords('a placeholder Billie').length, 1);
  assert.equal(badWords('Placeholders.').length, 1);
  assert.equal(badWords('and AI generators').length, 1);
  assert.equal(badWords('AIR, said, maintain').length, 0);
  assert.equal(badWords("(Claude's draft)").length, 1);
  assert.equal(badWords('placeholder: a hoot', false).length, 1);
});
