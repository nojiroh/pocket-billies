// Studio art track SA-1: the art paths the game's code names, for the Studio's Art browser ("Used by", and the
// unused and legacy searches; logic/art-refs.js). The code builds most of them from a name
// (`scene/flags/${id}.png`, 'postcards/' + id + '.webp'), so each is kept as a pattern: a piece the code fills in is a
// `*` (one folder or file name, never a slash), and a path the code finishes on its own ('postcards/') ends in `*`.
// Read from the game's code and styles (game/js, game/css, game/index.html, game/sw.js and the art folder's own
// scripts); the generated hooks.js and debug-log-names.js are left out, and so are the Art browser's own logic files
// (their comments show patterns as examples). Also the art folder's own JSON files (the model recipes in
// scene/next/models and scene/vox, a sheet's layout): the art paths they name, as `recipes`. Writes
// studio/art-code-refs.json.
//   node tools/art-code-refs.mjs          # write it
//   node tools/art-code-refs.mjs --check  # fail when it is out of date (npm run lint)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
export const OUT = 'studio/art-code-refs.json';
const SKIP = new Set([
  'game/js/hooks.js',
  'game/js/debug-log-names.js',
  'game/js/logic/art-refs.js',
  'game/js/logic/art-search.js',
]);

/** the art folder's top folders (the file tree's, never a list here) */
const tops = () =>
  readdirSync(join(ROOT, 'game/art'), { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();

/** the game's code files, in a fixed order */
function sources() {
  const out = ['game/index.html', 'game/sw.js', 'game/manifest.webmanifest'];
  const walk = (/** @type {string} */ dir, /** @type {RegExp} */ ext) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p, ext);
      else if (ext.test(e.name) && !SKIP.has(p)) out.push(p);
    }
  };
  walk('game/js', /\.js$/);
  walk('game/css', /\.css$/);
  for (const e of readdirSync(join(ROOT, 'game/art'))) if (e.endsWith('.js')) out.push('game/art/' + e);
  return out.sort();
}

/**
 * The art patterns in a file's text: every string literal (quotes or backticks, a template's ${...} as `*`) and
 * every CSS url() that names a path in one of the art folder's top folders.
 * @param {string} text @param {string[]} top
 * @returns {{ p: string, line: number }[]}
 */
export function artPatternsIn(text, top) {
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.|\$\{[^}]*\}|\$(?!\{))*)`|url\(([^)'"]+)\)/g,
    head = new RegExp(`(?:^|/)(?:art/)?((?:${top.join('|')})/.*)$`),
    out = [];
  for (const m of text.matchAll(lit)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/\$\{[^}]*\}/g, '*').replace(/[?#].*$/, '');
    if (/\s/.test(s)) continue;
    const h = head.exec(s);
    if (!h || !(s.startsWith('art/') || s.includes('/art/') || h.index === 0)) continue;
    let p = h[1].replace(/\*+/g, '*');
    if (!/\.\w+$/.test(p) && !p.endsWith('*')) p += '*';
    out.push({ p, line: text.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** every pattern with the places that name it, sorted */
export function artCodeRefs() {
  const top = tops(),
    /** @type {Map<string, string[]>} */ by = new Map();
  for (const f of sources())
    for (const { p, line } of artPatternsIn(readFileSync(join(ROOT, f), 'utf8'), top)) {
      if (!by.has(p)) by.set(p, []);
      const at = `${f}:${line}`;
      if (!by.get(p).includes(at)) by.get(p).push(at);
    }
  return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([p, at]) => ({ p, at }));
}

/** every art file the art folder's JSON files name (the model recipes' decals and leaves), with the files naming it */
export function artRecipeRefs() {
  /** @type {string[]} */
  const json = [],
    /** @type {Set<string>} */ files = new Set();
  const walk = (/** @type {string} */ dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) json.push(p);
      else files.add(p.slice('game/art/'.length));
    }
  };
  walk('game/art');
  /** @type {Map<string, string[]>} */
  const by = new Map();
  for (const f of json.sort())
    for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/"(?:art\/)?([^"\s]+\.(?:png|webp|jpg|svg))"/g))
      if (files.has(m[1])) {
        if (!by.has(m[1])) by.set(m[1], []);
        if (!by.get(m[1]).includes(f)) by.get(m[1]).push(f);
      }
  return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([p, at]) => ({ p, at }));
}

export const artCodeRefsText = () =>
  JSON.stringify(
    {
      about: 'The art paths the game code names (made by tools/art-code-refs.mjs; * is a name the code fills in)',
      refs: artCodeRefs(),
      recipes: artRecipeRefs(),
    },
    null,
    1
  ) + '\n';

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const text = artCodeRefsText(),
    file = join(ROOT, OUT);
  let old = '';
  try {
    old = statSync(file).isFile() ? readFileSync(file, 'utf8') : '';
  } catch (e) {}
  if (process.argv.includes('--check')) {
    if (old !== text) {
      console.error(`art-code-refs: ${OUT} is out of date: run node tools/art-code-refs.mjs`);
      process.exit(1);
    }
    console.log(`art-code-refs: ${relative(ROOT, file)} is up to date (${JSON.parse(text).refs.length} patterns)`);
  } else {
    writeFileSync(file, text);
    console.log(`art-code-refs: wrote ${OUT} (${JSON.parse(text).refs.length} patterns)`);
  }
}
