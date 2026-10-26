// Studio plan Phase 5 (T5.1): bakes the kit Billies from their recipes (game/data/kitBuilds.json) with the game's
// own baker (game/js/logic/kit-assemble.js), as the retired tools/build-kit-billies.py did. For each form it writes what changed:
// - game/art/next/billionaires/<name>.png, the sheet (written only when a shown pixel differs: alpha, and colour
//   where alpha is not 0);
// - its rig in game/art/next/rigs-next.js (the file is written as the Studio writes it, and only when a rig changed);
// - the stage's native parts in game/data/lines/<line>.json "parts" (not for a regional form's recipe: it is only a look).
// Nothing is written for a recipe that bakes as committed, so a run on an unchanged tree changes no file.
// Roster track RO-3b: a recipe whose rig is a placeholder Billie's (game/data/bodyPlans.json forms) is kept on disk but
// not baked or written: its sheet, rig and line parts stay the placeholder's. To bring a kit look back, take the
// Billie out of bodyPlans.json forms and bake again. tools/test/kit-bake.json keeps every recipe's bake as fingerprints
// (written by --fingerprints), so the kit baker stays checked while its art is not committed.
//
//   node tools/bake-kit-billies.mjs                    bake every form, write what changed
//   node tools/bake-kit-billies.mjs --only=emberox,... only these forms
//   node tools/bake-kit-billies.mjs --check            write nothing; list what would change (exit 1 if anything)
//   node tools/bake-kit-billies.mjs --fingerprints     write tools/test/kit-bake.json (every recipe, placeholders too)
//
// Unlike the Python builder it draws no preview sheet and no piece layout (<name>.json): the rig holds all a layout did.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { DATA, PB_DATA, readJson, ROOT, writeFile } from './data-files.mjs';
import { encodePng, readPng } from './test/png.mjs';
import { kitBakeWhole } from '../game/js/logic/kit-assemble.js';

const ART = join(ROOT, 'game', 'art');
const SHEETS = join(ART, 'next', 'billionaires');
const RIGS = join(ART, 'next', 'rigs-next.js');
const PRINTS = join(ROOT, 'tools', 'test', 'kit-bake.json');

/** the rigs a placeholder Billie owns (bodyPlans.json forms): the kit baker leaves them alone */
export const placeholderRigs = () => new Set((readJson('bodyPlans.json').forms || []).map(f => f.rig));

/** a bake as fingerprints: the sheet's shown pixels (size, alpha, colour where alpha is not 0) and the rig */
export function kitFingerprint(made) {
  const { width, height, data } = made.sheet,
    shown = Buffer.from(data);
  for (let i = 0; i < shown.length; i += 4) if (!shown[i + 3]) shown[i] = shown[i + 1] = shown[i + 2] = 0;
  const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 32);
  return {
    sheet: `${width}x${height} ${sha(shown)}`,
    rig: sha(JSON.stringify(JSON.parse(JSON.stringify(made.rig)))),
  };
}

/** do two pictures show the same: same size, same alpha, same colour where alpha is not 0 */
export function sameShown(a, b) {
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i + 3] !== b.data[i + 3]) return false;
    if (
      b.data[i + 3] &&
      (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2])
    )
      return false;
  }
  return true;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** rigs-next.js as its header and its rigs */
function readRigs() {
  const text = readFileSync(RIGS, 'utf8'),
    at = text.indexOf('window.RIGS_NEXT=');
  const box = { window: {} };
  vm.runInNewContext(text, box);
  return { head: text.slice(0, at), rigs: box.window.RIGS_NEXT };
}

/** the kit parts' pictures as the baker asks for them, each read once */
function kitPics(K) {
  const cache = new Map();
  return (id, view) => {
    const key = id + '|' + view;
    if (!cache.has(key)) cache.set(key, readPng(join(ART, K.parts[id].views[view].file)));
    return cache.get(key);
  };
}

/** bakes the forms and returns what changed, writing it unless `check` */
export function bakeKitBillies({ only = null, check = false, log = console.log } = {}) {
  const K = readJson('partKits.json'),
    B = readJson('kitBuilds.json'),
    data = { partKits: K, kitBuilds: B, rules: readJson('rules.json') },
    pics = kitPics(K),
    forms = only ? B.forms.filter(f => only.includes(f.name)) : B.forms,
    changed = [],
    kept = placeholderRigs(),
    { head, rigs } = readRigs();
  if (only)
    for (const n of only) if (!B.forms.some(f => f.name === n)) throw new Error(`no form ${n} in kitBuilds.json`);
  let rigsChanged = false;
  /** @type {Record<string, any>} */
  const lines = {};
  for (const form of forms) {
    if (kept.has(form.rig)) {
      log(`${form.rig.padEnd(12)} ${form.name.padEnd(13)} kept: on its placeholder (bodyPlans.json)`);
      continue;
    }
    const made = kitBakeWhole(data, form, pics),
      what = [],
      png = join(SHEETS, `${form.name}.png`);
    if (!existsSync(png) || !sameShown(made.sheet, readPng(png))) {
      what.push('sheet');
      if (!check) writeFileSync(png, encodePng(made.sheet));
    }
    const rig = JSON.parse(JSON.stringify(made.rig));
    if (!same(rigs[form.rig], rig)) {
      what.push('rig');
      rigs[form.rig] = rig;
      rigsChanged = true;
    }
    /* RO-2c: a regional form's recipe is only a look: the line's native parts come from its own recipe */
    if (!form.form) {
      const L = (lines[form.line] ||= readJson(`lines/${form.line}.json`)),
        parts = made.parts;
      if (form.stage >= L.names.length)
        throw new Error(`${form.name}: stage ${form.stage}, ${form.line} has ${L.names.length}`);
      L.parts ||= [];
      if (!same(L.parts[form.stage], parts)) {
        what.push('parts');
        L.parts[form.stage] = parts;
        L._changed = true;
      }
    } else if (form.stage >= readJson(`lines/${form.line}.json`).names.length)
      throw new Error(`${form.name}: stage ${form.stage}, ${form.line} has fewer stages`);
    if (form.scale !== made.k) what.push(`(fit ${made.k})`);
    log(`${form.rig.padEnd(12)} ${form.name.padEnd(13)} ${what.length ? what.join(', ') : 'as committed'}`);
    if (what.some(w => !w.startsWith('('))) changed.push(`${form.name}: ${what.join(', ')}`);
  }
  if (rigsChanged && !check) writeFileSync(RIGS, head + 'window.RIGS_NEXT=' + JSON.stringify(rigs) + ';\n');
  for (const [id, L] of Object.entries(lines))
    if (L._changed && !check) {
      delete L._changed;
      writeFile(`lines/${id}.json`, PB_DATA.text(L));
    }
  return changed;
}

/** every recipe baked (placeholders' too) as fingerprints, by form name */
export function kitFingerprints() {
  const K = readJson('partKits.json'),
    B = readJson('kitBuilds.json'),
    data = { partKits: K, kitBuilds: B, rules: readJson('rules.json') },
    pics = kitPics(K);
  return Object.fromEntries(B.forms.map(f => [f.name, kitFingerprint(kitBakeWhole(data, f, pics))]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (process.argv.includes('--fingerprints')) {
      const prints = kitFingerprints();
      writeFileSync(PRINTS, JSON.stringify(prints, null, 1) + '\n');
      console.log(`${Object.keys(prints).length} kit bakes written as fingerprints to tools/test/kit-bake.json`);
      process.exit(0);
    }
    const o = process.argv.find(a => a.startsWith('--only=')),
      check = process.argv.includes('--check'),
      changed = bakeKitBillies({ only: o ? o.slice(7).split(',').filter(Boolean) : null, check });
    if (!changed.length) console.log('every kit Billie bakes as committed');
    else if (check) {
      console.log(`${changed.length} kit Billie(s) would change (node tools/bake-kit-billies.mjs writes them)`);
      process.exit(1);
    } else
      console.log(
        `${changed.length} kit Billie(s) baked and written (under ${DATA.replace(ROOT + '/', '')} and game/art)`
      );
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
