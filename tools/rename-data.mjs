// Phase 05: renames a key or a section of the game data (game/data) and checks the data changed in nothing else.
//
//   node tools/rename-data.mjs key <selector> <old> <new> [--dry]   the key <old> of every object the selector finds
//   node tools/rename-data.mjs section <old> <new> [--dry]          a top-level section (its file or folder too)
//   node tools/rename-data.mjs value <selector>[,<selector>...] <old> <new> [--dry]
//                                                                   the string value <old> where the selectors point
//   node tools/rename-data.mjs verify key|section|value ... [--base <rev>]  the staged data (git add -A first) against <rev>
//
// A selector starts at a section and walks: .name (a key), .* (every value of an object), [] (every element of a
// list). scenery.props.* is every prop of the catalogue, scenes.* every map, scenes.*.props[] every prop placed on a
// map, route[] every location. In value mode the selector points at the values themselves: partKits.parts.*.slot is
// every part's slot, partKits.socketRules.*[] every slot a socket rule lists; a value is renamed only where it is the
// whole string, and never into a value already used there. A key keeps its place among its object's keys; the files are written as the game, the
// Studio and the build write them (game/js/data-files.js). The code that reads the key is renamed with
// tools/rename.mjs prop, in the same commit.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, PB_DATA, readGameData, writeFile } from './data-files.mjs';

const ROOT = join(import.meta.dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

// the selector's steps: ['scenery', '.props', '.*'] etc.
function steps(sel) {
  const m = sel.match(/^[A-Za-z_$][\w$]*|\.\*|\.[A-Za-z_$][\w$]*|\[\]/g);
  if (!m || m.join('') !== sel) throw new Error(`a selector like scenes.*.props[], not ${sel}`);
  return m;
}

// every object the selector reaches in the game data D
function select(D, sel) {
  let at = [D];
  for (const s of steps(sel)) {
    const next = [];
    for (const v of at) {
      if (v === null || typeof v !== 'object') continue;
      if (s === '.*') next.push(...Object.values(v));
      else if (s === '[]') {
        if (Array.isArray(v)) next.push(...v);
      } else {
        const k = s.startsWith('.') ? s.slice(1) : s;
        if (Object.hasOwn(v, k)) next.push(v[k]);
      }
    }
    at = next;
  }
  return at.filter(v => v && typeof v === 'object' && !Array.isArray(v));
}

// the object with the key renamed in its place
function renamed(o, a, b) {
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k === a ? b : k] = v;
  return out;
}

// renames the key in place (the parents keep the same objects, rebuilt key by key)
function renameKey(D, sel, a, b) {
  const objs = select(D, sel);
  let n = 0;
  for (const o of objs)
    if (Object.hasOwn(o, a)) {
      if (Object.hasOwn(o, b)) throw new Error(`an object at ${sel} has both ${a} and ${b}`);
      const r = renamed(o, a, b);
      for (const k of Object.keys(o)) delete o[k];
      Object.assign(o, r);
      n++;
    }
  return { objects: objs.length, renamed: n };
}

// every place (object or list, and its key or index) the selector points at
function places(D, sel) {
  let at = [[{ D }, 'D']];
  for (const s of steps(sel)) {
    const next = [];
    for (const [o, k] of at) {
      const v = o[k];
      if (v === null || typeof v !== 'object') continue;
      if (s === '.*') for (const kk of Object.keys(v)) next.push([v, Array.isArray(v) ? Number(kk) : kk]);
      else if (s === '[]') {
        if (Array.isArray(v)) v.forEach((_, i) => next.push([v, i]));
      } else {
        const kk = s.startsWith('.') ? s.slice(1) : s;
        if (!Array.isArray(v) && Object.hasOwn(v, kk)) next.push([v, kk]);
      }
    }
    at = next;
  }
  return at;
}

// renames the string value a to b wherever the selectors (comma-separated) point
function renameValue(D, sels, a, b) {
  const at = sels.split(',').flatMap(sel => places(D, sel));
  if (at.some(([o, k]) => o[k] === b)) throw new Error(`${b} is already a value at ${sels}`);
  let n = 0;
  for (const [o, k] of at)
    if (o[k] === a) {
      o[k] = b;
      n++;
    }
  return { places: at.length, renamed: n };
}

// how many strings anywhere in the data are exactly v (what a value rename left elsewhere)
function countValue(v, x) {
  if (x === v) return 1;
  if (x === null || typeof x !== 'object') return 0;
  let n = 0;
  for (const y of Object.values(x)) n += countValue(v, y);
  return n;
}

function renameSection(D, a, b) {
  if (!Object.hasOwn(D, a)) throw new Error(`no section ${a}`);
  if (Object.hasOwn(D, b)) throw new Error(`a section ${b} exists`);
  const r = renamed(D, a, b);
  for (const k of Object.keys(D)) delete D[k];
  Object.assign(D, r);
}

// writes the data as write-data.mjs does: only the files that changed, and removes the files of what is gone
function save(D) {
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
  for (const dir of readdirSync(DATA, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'schema'))
    for (const f of readdirSync(join(DATA, dir.name)))
      if (f.endsWith('.json') && !(`${dir.name}/${f}` in texts)) {
        unlinkSync(join(DATA, dir.name, f));
        gone++;
      }
  for (const f of readdirSync(DATA).filter(f => f.endsWith('.json') && !(f in texts))) {
    unlinkSync(join(DATA, f));
    gone++;
  }
  return { wrote, gone };
}

// the game data at a revision (the index's files, read with git show), or the staged files with base ':'
function dataAt(rev) {
  const read = p => JSON.parse(git('show', `${rev}:game/data/${p}`));
  return PB_DATA.assemble(read('index.json'), read);
}

// the same JSON, keys in the same order
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function verify(rule, base) {
  const [kind, ...args] = rule;
  const old = dataAt(base),
    now = dataAt('');
  if (kind === 'key') {
    const [sel, a, b] = args;
    const r = renameKey(old, sel, a, b);
    if (!same(old, now)) throw new Error(`the data differs from ${base} in more than ${sel}: ${a} -> ${b}`);
    return `${r.renamed} of ${r.objects} objects at ${sel}: ${a} -> ${b}, nothing else changed`;
  }
  if (kind === 'value') {
    const [sel, a, b] = args;
    const r = renameValue(old, sel, a, b);
    if (!same(old, now)) throw new Error(`the data differs from ${base} in more than the value ${a} -> ${b} at ${sel}`);
    return `${r.renamed} of ${r.places} places at ${sel}: ${a} -> ${b}, nothing else changed`;
  }
  if (kind === 'section') {
    const [a, b] = args;
    renameSection(old, a, b);
    if (!same(old, now)) throw new Error(`the data differs from ${base} in more than the section ${a} -> ${b}`);
    return `section ${a} -> ${b}, nothing else changed`;
  }
  throw new Error('verify key|section|value ...');
}

function main(argv) {
  const dry = argv.includes('--dry');
  const bi = argv.indexOf('--base');
  const base = bi >= 0 ? argv[bi + 1] : 'HEAD';
  const args = argv.filter((a, i) => a !== '--dry' && (bi < 0 || (i !== bi && i !== bi + 1)));
  const [cmd, ...rest] = args;
  if (cmd === 'verify') return console.log(verify(rest, base));
  const D = readGameData();
  if (cmd === 'key') {
    if (rest.length !== 3) throw new Error('key <selector> <old> <new>');
    const r = renameKey(D, ...rest);
    if (!r.renamed) throw new Error(`no object at ${rest[0]} has the key ${rest[1]} (${r.objects} objects there)`);
    const w = dry ? { wrote: '-', gone: '-' } : save(D);
    console.log(`${rest[1]} -> ${rest[2]} in ${r.renamed} of ${r.objects} objects at ${rest[0]}; ${w.wrote} file(s) written`);
  } else if (cmd === 'value') {
    if (rest.length !== 3) throw new Error('value <selector>[,<selector>...] <old> <new>');
    const r = renameValue(D, ...rest);
    if (!r.renamed) throw new Error(`no place at ${rest[0]} holds ${rest[1]} (${r.places} places there)`);
    const left = countValue(rest[1], D);
    const w = dry ? { wrote: '-', gone: '-' } : save(D);
    console.log(`${rest[1]} -> ${rest[2]} in ${r.renamed} of ${r.places} places at ${rest[0]}; ${w.wrote} file(s) written`);
    if (left) console.log(`note: ${left} other string(s) in the data are exactly ${rest[1]} (not renamed)`);
  } else if (cmd === 'section') {
    if (rest.length !== 2) throw new Error('section <old> <new>');
    renameSection(D, ...rest);
    const w = dry ? { wrote: '-', gone: '-' } : save(D);
    console.log(`section ${rest[0]} -> ${rest[1]}; ${w.wrote} file(s) written, ${w.gone} removed`);
  } else throw new Error('usage: node tools/rename-data.mjs key|section|value|verify ... (see the top of the file)');
}

try {
  main(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
