// Studio plan Phase 5 (T5.1): bakes the kit Billies from their recipes (game/data/kitBuilds.json) with the game's
// own baker (game/js/logic/kit-assemble.js), as tools/build-kit-billies.py did. For each form it writes what changed:
// - game/art/next/billionaires/<name>.png, the sheet (written only when a shown pixel differs: alpha, and colour
//   where alpha is not 0), and <name>.json, its piece layout;
// - its rig in game/art/next/rigs-next.js (the file is written as the Studio writes it, and only when a rig changed);
// - the stage's native parts in game/data/lines/<line>.json "parts".
// Nothing is written for a recipe that bakes as committed, so a run on an unchanged tree changes no file.
//
//   node tools/bake-kit-billies.mjs                    bake every form, write what changed
//   node tools/bake-kit-billies.mjs --only=emberox,... only these forms
//   node tools/bake-kit-billies.mjs --check            write nothing; list what would change (exit 1 if anything)
//
// Unlike the Python builder it draws no preview sheet (docs/samples/kit-billies.png).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { DATA, PB_DATA, readJson, ROOT, writeFile } from './data-files.mjs';
import { encodePng, readPng } from './test/png.mjs';
import { kitBakeForm, kitNativeParts } from '../game/js/logic/kit-assemble.js';

const ART = join(ROOT, 'game', 'art');
const SHEETS = join(ART, 'next', 'billionaires');
const RIGS = join(ART, 'next', 'rigs-next.js');

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

/** bakes the forms and returns what changed, writing it unless `check` */
export function bakeKitBillies({ only = null, check = false, log = console.log } = {}) {
  const K = readJson('partKits.json'),
    B = readJson('kitBuilds.json'),
    R = readJson('rules.json'),
    cache = new Map(),
    pics = (id, view) => {
      const key = id + '|' + view;
      if (!cache.has(key)) cache.set(key, readPng(join(ART, K.parts[id].views[view].file)));
      return cache.get(key);
    },
    forms = only ? B.forms.filter(f => only.includes(f.name)) : B.forms,
    changed = [],
    { head, rigs } = readRigs();
  if (only)
    for (const n of only) if (!B.forms.some(f => f.name === n)) throw new Error(`no form ${n} in kitBuilds.json`);
  let rigsChanged = false;
  /** @type {Record<string, any>} */
  const lines = {};
  for (const form of forms) {
    const made = kitBakeForm(K, form, B.colours, pics, B.bake),
      what = [],
      png = join(SHEETS, `${form.name}.png`),
      lay = join(SHEETS, `${form.name}.json`);
    if (!existsSync(png) || !sameShown(made.sheet, readPng(png))) {
      what.push('sheet');
      if (!check) writeFileSync(png, encodePng(made.sheet));
    }
    const layout = JSON.parse(JSON.stringify(made.layout));
    if (!existsSync(lay) || !same(JSON.parse(readFileSync(lay, 'utf8')), layout)) {
      what.push('layout');
      if (!check) writeFileSync(lay, JSON.stringify(layout));
    }
    const rig = JSON.parse(JSON.stringify(made.rig));
    if (!same(rigs[form.rig], rig)) {
      what.push('rig');
      rigs[form.rig] = rig;
      rigsChanged = true;
    }
    const L = (lines[form.line] ||= readJson(`lines/${form.line}.json`)),
      parts = kitNativeParts(form, K.slots, R.parts.slots);
    if (form.stage >= L.names.length)
      throw new Error(`${form.name}: stage ${form.stage}, ${form.line} has ${L.names.length}`);
    L.parts ||= [];
    if (!same(L.parts[form.stage], parts)) {
      what.push('parts');
      L.parts[form.stage] = parts;
      L._changed = true;
    }
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

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
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
