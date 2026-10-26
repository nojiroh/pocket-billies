// Roster track RO-3a: bakes the placeholder Billies (game/data/bodyPlans.json forms) with the game's own baker
// (game/js/logic/placeholder-art.js), and moves their drawing sheets out and in.
//
// A Billie's cells are painted placeholders, with the cells of its drawing sheet on top when it has one
// (game/art/next/placeholders/<name>.png, written by --import; a cell left empty keeps its placeholder). The bake
// writes what changed, as bake-kit-billies.mjs does: game/art/next/billionaires/<name>.png and its rig in
// game/art/next/rigs-next.js.
//
//   node tools/bake-placeholders.mjs                         bake every form, write what changed
//   node tools/bake-placeholders.mjs --only=emberox,...      only these forms
//   node tools/bake-placeholders.mjs --check                 write nothing; list what would change (exit 1 if anything)
//   node tools/bake-placeholders.mjs --export=emberox        a Billie's drawing sheet: a column per picture, a row per view
//   node tools/bake-placeholders.mjs --export=plan:quad      a body plan's sheet: two rows per Billie on it (a sample
//                                                             Billie when none is on it yet)
//        [--out=dir] (default tools/art-source/placeholders) [--scale=N] (each pixel as N x N, for drawing big)
//   node tools/bake-placeholders.mjs --import=file.png       a drawn sheet back in: <name>.png is a Billie's,
//        [--for=emberox | --for=plan:quad]                   <plan>-plan.png a plan's (or say which with --for); its
//                                                             cells are stored per Billie, then those Billies baked
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import vm from 'node:vm';
import { readJson, ROOT } from './data-files.mjs';
import { encodePng, readPng } from './test/png.mjs';
import {
  placeholderBake,
  placeholderCellsWith,
  placeholderSheet,
  placeholderSheetCut,
} from '../game/js/logic/placeholder-art.js';

const ART = join(ROOT, 'game', 'art', 'next');
const SHEETS = join(ART, 'billionaires');
const DRAWN = join(ART, 'placeholders');
const RIGS = join(ART, 'rigs-next.js');
const OUT = join(ROOT, 'tools', 'art-source', 'placeholders');

/** do two pictures show the same: same size, same alpha, same colour where alpha is not 0 */
function sameShown(a, b) {
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

/** the data the baker needs */
export function placeholderData() {
  return { P: readJson('bodyPlans.json'), D: readJson('kitBuilds.json').bake };
}
/** a sample Billie on a plan (its sheet before any Billie is on it) */
export const samplePlaceholder = plan => ({
  name: `sample-${plan}`,
  rig: `sample-${plan}`,
  plan,
  colours: { main: '#c8794a', accent: '#f2c14e' },
});
/** a form's cells: painted, with its stored drawing on top */
export function formCells(P, form) {
  const file = join(DRAWN, `${form.name}.png`);
  return placeholderCellsWith(
    P,
    form,
    existsSync(file) ? placeholderSheetCut(P, [form], readPng(file))[form.name] : null
  );
}

function readRigs() {
  const text = readFileSync(RIGS, 'utf8'),
    at = text.indexOf('window.RIGS_NEXT=');
  const box = { window: {} };
  vm.runInNewContext(text, box);
  return { head: text.slice(0, at), rigs: box.window.RIGS_NEXT };
}

/** bakes the forms and returns what changed, writing it unless `check` */
export function bakePlaceholders({ only = null, check = false, log = console.log } = {}) {
  const { P, D } = placeholderData(),
    forms = only ? P.forms.filter(f => only.includes(f.name)) : P.forms,
    changed = [],
    { head, rigs } = readRigs();
  if (only)
    for (const n of only) if (!P.forms.some(f => f.name === n)) throw new Error(`no form ${n} in bodyPlans.json`);
  let rigsChanged = false;
  for (const form of forms) {
    const made = placeholderBake(P, form, D, formCells(P, form)),
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
    log(
      `${form.rig.padEnd(16)} ${form.name.padEnd(16)} ${form.plan.padEnd(8)} ${what.length ? what.join(', ') : 'as committed'}`
    );
    if (what.length) changed.push(`${form.name}: ${what.join(', ')}`);
  }
  if (rigsChanged && !check) writeFileSync(RIGS, head + 'window.RIGS_NEXT=' + JSON.stringify(rigs) + ';\n');
  return changed;
}

/** the forms a sheet holds: a Billie (`emberox`) or a plan (`plan:quad`), and whether its rows are named */
function sheetForms(P, what) {
  if (what.startsWith('plan:')) {
    const plan = what.slice(5);
    if (!P.plans[plan]) throw new Error(`no body plan ${plan} (${Object.keys(P.plans).join(', ')})`);
    const forms = P.forms.filter(f => f.plan === plan);
    return { forms: forms.length ? forms : [samplePlaceholder(plan)], named: true, file: `${plan}-plan.png` };
  }
  const f = P.forms.find(x => x.name === what);
  if (!f) throw new Error(`no form ${what} in bodyPlans.json`);
  return { forms: [f], named: false, file: `${f.name}.png` };
}

/** writes a drawing sheet and returns its path */
export function exportSheet(what, { out = OUT, scale = 1 } = {}) {
  const { P } = placeholderData(),
    { forms, named, file } = sheetForms(P, what),
    cells = Object.fromEntries(forms.map(f => [f.name, formCells(P, f)]));
  mkdirSync(out, { recursive: true });
  const path = join(out, file);
  writeFileSync(path, encodePng(placeholderSheet(P, forms, cells, named, scale)));
  return path;
}

/** reads a drawn sheet, stores its cells per Billie (as a Billie's sheet at scale 1) and returns the Billies */
export function importSheet(path, what = null) {
  const { P } = placeholderData(),
    name = basename(path, '.png');
  what ||= name.endsWith('-plan') ? `plan:${name.slice(0, -5)}` : name;
  const { forms, named } = sheetForms(P, what);
  if (forms.some(f => !P.forms.includes(f))) throw new Error(`no Billie is on ${what.slice(5)} yet: nothing to store`);
  const cut = placeholderSheetCut(P, forms, readPng(path), named);
  mkdirSync(DRAWN, { recursive: true });
  for (const f of forms) {
    const cells = placeholderCellsWith(P, f, cut[f.name]);
    writeFileSync(join(DRAWN, `${f.name}.png`), encodePng(placeholderSheet(P, [f], { [f.name]: cells })));
  }
  return forms.map(f => f.name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => {
    const a = process.argv.find(x => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  try {
    if (arg('export')) {
      console.log(`wrote ${exportSheet(arg('export'), { out: arg('out') || OUT, scale: Number(arg('scale') || 1) })}`);
    } else if (arg('import')) {
      const names = importSheet(arg('import'), arg('for'));
      console.log(`stored ${names.join(', ')} in game/art/next/placeholders`);
      bakePlaceholders({ only: names });
    } else {
      const o = arg('only'),
        check = process.argv.includes('--check'),
        changed = bakePlaceholders({ only: o ? o.split(',').filter(Boolean) : null, check });
      if (!changed.length) console.log('every placeholder Billie bakes as committed');
      else if (check) {
        console.log(
          `${changed.length} placeholder Billie(s) would change (node tools/bake-placeholders.mjs writes them)`
        );
        process.exit(1);
      } else console.log(`${changed.length} placeholder Billie(s) baked and written (under game/art/next)`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
