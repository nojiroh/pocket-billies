'use strict';
/* ================= POCKET BILLIES STUDIO · Kit recipe and Write Billie (Studio plan Phase 5, T5.1) =================
   A kit Billie (one of game/data/kitBuilds.json's forms) is baked from its recipe: which kit part sits on each bone,
   at what size and colour, plus extras (horns, ears, a crest, a shell). Part mode shows the recipe of the species it
   has open. Every change to it bakes at once with the game's own baker (logic/kit-assemble.js kitBakeWhole, the code
   `npm run bake:kits` runs): the recipe, the sheet (a Studio picture), the rig and the line's native parts change
   together as one undo step, so Propose carries all of them and a recipe is never sent without its bake. "Write
   Billie" bakes the recipe as it is again (after a kit part's picture was repainted); it changes nothing when the
   Billie is already as baked. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { kitBakeWhole } from '../../game/js/logic/kit-assemble.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, changed, clone, commit, render, snapshotParts, studioState, toast } from './studio-app.js';
import { artSteps, pictureImage } from './pixel-canvas.js';
import { atlasGet, loadedAtlas, markArt } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  KIT_PARTS_OF: [() => KIT_PARTS_OF],
  KIT_SHEET: [() => KIT_SHEET],
  kitBakeInStudio: [() => kitBakeInStudio, v => (kitBakeInStudio = v)],
  kitColourSelect: [() => kitColourSelect, v => (kitColourSelect = v)],
  kitEdited: [() => kitEdited, v => (kitEdited = v)],
  kitFormOf: [() => kitFormOf, v => (kitFormOf = v)],
  kitKept: [() => kitKept, v => (kitKept = v)],
  kitNum: [() => kitNum],
  kitPixelsOf: [() => kitPixelsOf],
  kitRecipe: [() => kitRecipe],
  kitRecipeHTML: [() => kitRecipeHTML, v => (kitRecipeHTML = v)],
  kitSameShown: [() => kitSameShown, v => (kitSameShown = v)],
  kitShownSp: [() => kitShownSp],
  kitWrite: [() => kitWrite, v => (kitWrite = v)],
  kitWriteShown: [() => kitWriteShown, v => (kitWriteShown = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the recipe of a species' rig, with its index in kitBuilds.json forms; null when there is none or when the Billie
 * is on its placeholder (RO-3b: a bodyPlans.json form owns the rig, so the recipe is kept but not baked) */
export function kitFormOf(sp) {
  const forms = studioState.D?.kitBuilds?.forms || [],
    i = forms.findIndex(f => f.rig === sp);
  return i < 0 || kitKept(sp) ? null : { form: forms[i], i };
}
/** RO-3b: the kept recipe of a Billie on its placeholder, or null */
function kitKept(sp) {
  const P = studioState.D?.bodyPlans?.forms || [];
  return P.some(f => f.rig === sp) ? (studioState.D?.kitBuilds?.forms || []).find(f => f.rig === sp) || null : null;
}
const KIT_SHEET = form => `art/next/billionaires/${form.name}.png`;
/** a picture's pixels, ImageData-shaped (the baker's input) */
const kitPixelsOf = c => c.getContext('2d').getImageData(0, 0, c.width, c.height);
/** do two pictures show the same: size, alpha, and colour where alpha is not 0 (as bake:kits compares) */
function kitSameShown(a, b) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return false;
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
/** bakes a recipe in the browser: the kit parts' pictures (unsaved repaints included) are loaded as the baker asks
 * for them, then it runs again until it has all it needs */
async function kitBakeInStudio(form) {
  const D = studioState.D,
    K = D.partKits,
    got = new Map();
  for (let round = 0; round < 20; round++) {
    const need = new Set();
    const pics = (id, view) => {
      const key = id + '|' + view;
      if (got.has(key)) return got.get(key);
      need.add(key);
      throw Object.assign(new Error('picture not loaded yet'), { kitNeed: true });
    };
    try {
      return kitBakeWhole(D, form, pics);
    } catch (e) {
      if (!e.kitNeed) throw e;
    }
    await Promise.all(
      [...need].map(async key => {
        const [id, view] = key.split('|'),
          file = K.parts[id]?.views?.[view]?.file;
        if (!file) throw new Error(`kit part ${id} has no ${view} picture`);
        got.set(key, kitPixelsOf(await atlasGet('art/' + file)));
      })
    );
  }
  throw new Error('the baker kept asking for pictures');
}
const kitRecipe = { busy: false, serial: 0, error: '' };
/** bakes `form` and writes it with its bake into the Studio's data, rigs and pictures as one undo step. Returns what
 * changed ([] when the Billie was already as baked) */
async function kitWrite(sp, form) {
  const at = kitFormOf(sp);
  if (!at) throw new Error(`${sp} is not a kit Billie`);
  const serial = ++kitRecipe.serial;
  kitRecipe.busy = true;
  kitRecipe.error = '';
  let made;
  try {
    made = await kitBakeInStudio(form);
  } catch (e) {
    if (serial === kitRecipe.serial) {
      kitRecipe.busy = false;
      kitRecipe.error = e.message;
      render();
    }
    throw e;
  }
  if (serial !== kitRecipe.serial || kitFormOf(sp)?.i !== at.i) return null; /* a newer edit took over */
  kitRecipe.busy = false;
  commit(true); /* earlier edits are their own step */
  const S = studioState,
    D = S.D,
    what = [],
    path = KIT_SHEET(form),
    old = loadedAtlas(path) || (await atlasGet(path).catch(() => null)),
    rig = JSON.parse(JSON.stringify(made.rig)),
    L = (D.lines || []).find(l => l.id === form.line),
    steps = [];
  if (JSON.stringify(D.kitBuilds.forms[at.i]) !== JSON.stringify(form)) {
    D.kitBuilds.forms[at.i] = clone(form);
    what.push('recipe');
  }
  if (!old || !kitSameShown(made.sheet, kitPixelsOf(old))) {
    const c = makeCanvas(made.sheet.width, made.sheet.height);
    c.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(made.sheet.data), made.sheet.width, made.sheet.height),
      0,
      0
    );
    steps.push([path, pictureImage(old), pictureImage(c)]);
    markArt(path, c);
    what.push('sheet');
  }
  const rigsChanged = JSON.stringify(S.rigs[form.rig]) !== JSON.stringify(rig);
  if (rigsChanged) {
    S.rigs = { ...S.rigs, [form.rig]: rig };
    window.RIGS = S.rigs;
    what.push('rig');
  }
  if (L && JSON.stringify((L.parts || [])[form.stage]) !== JSON.stringify(made.parts)) {
    L.parts ||= [];
    L.parts[form.stage] = made.parts;
    what.push('native parts');
  }
  if (!what.length) return what;
  if (what.includes('recipe') || what.includes('native parts')) changed(false);
  if (rigsChanged || steps.length) changed(true);
  if (steps.length) artSteps(steps, snapshotParts());
  else commit(true);
  render();
  return what;
}
/* ---------- the recipe in Part mode ---------- */
const KIT_PARTS_OF = (K, kind) =>
  Object.entries(K.parts)
    .filter(([, P]) => (K.slots[P.kind] || P.kind) === (K.slots[kind] || kind))
    .map(([id]) => id)
    .sort();
function kitColourSelect(spec, C, attrs) {
  const custom = Array.isArray(spec) ? JSON.stringify(spec) : '';
  return `<select ${attrs}><option value="" ${spec == null ? 'selected' : ''}>kit’s own</option>${Object.keys(C)
    .map(n => `<option value="${escapeHtml(n)}" ${spec === n ? 'selected' : ''}>${escapeHtml(n)}</option>`)
    .join(
      ''
    )}${custom ? `<option value="${escapeHtml(custom)}" selected>[${escapeHtml(spec.join(', '))}]</option>` : ''}</select>`;
}
const kitNum = (v, attrs, step = 0.05) =>
  `<input type="number" step="${step}" min="0.05" max="4" value="${v}" ${attrs}>`;
/** the recipe card for a species, or '' when it is not a kit Billie */
export function kitRecipeHTML(sp) {
  const at = kitFormOf(sp),
    kept = !at && kitKept(sp);
  if (kept)
    return `<div class="px-sec kit-recipe" data-kit-kept="${escapeHtml(kept.name)}"><h4>Kit recipe <small class="mono">${escapeHtml(kept.name)}</small></h4><p class="help">Kept in kitBuilds.json, not baked: this Billie is on its placeholder (bodyPlans.json). To bring the kit look back, take it out of bodyPlans.json forms and bake again (<span class="mono">npm run bake:kits</span>).</p></div>`;
  if (!at) return '';
  const { form } = at,
    D = studioState.D,
    K = D.partKits,
    C = D.kitBuilds.colours,
    anchors = Object.keys(D.kitBuilds.bake.anchors),
    rows = Object.entries(form.parts)
      .map(
        ([kind, [pid, size, col]]) =>
          `<div class="wbp-row"><span class="wbp-name">${escapeHtml(kind)}</span><select data-kitr="part" data-kind="${escapeHtml(kind)}">${KIT_PARTS_OF(
            K,
            kind
          )
            .map(id => `<option value="${escapeHtml(id)}" ${id === pid ? 'selected' : ''}>${escapeHtml(id)}</option>`)
            .join(
              ''
            )}</select>${kitNum(size, `data-kitr="size" data-kind="${escapeHtml(kind)}" title="size"`)}${kitColourSelect(
            col,
            C,
            `data-kitr="colour" data-kind="${escapeHtml(kind)}" title="colour"`
          )}</div>`
      )
      .join(''),
    extras = (form.extras || [])
      .map(
        ([pid, anchor, size, col, pair], i) =>
          `<div class="wbp-row"><select data-kitr="xpart" data-i="${i}">${Object.keys(K.parts)
            .sort()
            .map(id => `<option value="${escapeHtml(id)}" ${id === pid ? 'selected' : ''}>${escapeHtml(id)}</option>`)
            .join('')}</select><select data-kitr="xanchor" data-i="${i}" title="where it sits">${anchors
            .map(a => `<option ${a === anchor ? 'selected' : ''}>${escapeHtml(a)}</option>`)
            .join('')}</select>${kitNum(size, `data-kitr="xsize" data-i="${i}" title="size"`)}${kitColourSelect(
            col,
            C,
            `data-kitr="xcolour" data-i="${i}" title="colour"`
          )}<label class="chk" title="a mirrored pair"><input type="checkbox" data-kitr="xpair" data-i="${i}" ${pair ? 'checked' : ''}>pair</label><button class="btn sm" data-act="kitExtraDrop" data-i="${i}" title="Take this extra off">✕</button></div>`
      )
      .join(''),
    state = kitRecipe.busy
      ? '<p class="help">Baking…</p>'
      : kitRecipe.error
        ? `<p class="help err">Not baked: ${escapeHtml(kitRecipe.error)}</p>`
        : '';
  return `<div class="px-sec kit-recipe" data-kit-form="${escapeHtml(form.name)}"><h4>Kit recipe <small class="mono">${escapeHtml(form.name)}</small></h4><p class="help">kitBuilds.json. A change here bakes the sheet, the rig and the native parts at once (one undo step), as <span class="mono">npm run bake:kits</span> does.</p><div class="wbp-row"><span class="wbp-name">scale</span>${kitNum(form.scale, 'data-kitr="scale" title="the stage scale (the baker fits it to the stage box)"', 0.01)}</div>${rows}<h4>Extras</h4>${extras || '<p class="help">None.</p>'}<div class="seg-row"><button class="btn sm" data-act="kitExtraAdd">Add an extra</button><button class="btn sm primary" data-act="kitWriteBillie">Write Billie</button></div>${state}</div>`;
}
/** the recipe as the card's fields say, after one field changed */
function kitEdited(form, el) {
  const f = clone(form),
    k = el.dataset.kitr,
    kind = el.dataset.kind,
    i = Number(el.dataset.i),
    v = el.value,
    colour = s => (s === '' ? null : s.startsWith('[') ? JSON.parse(s) : s),
    n = () => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : null;
    };
  if (k === 'scale') {
    if (n() == null) return null;
    f.scale = n();
  } else if (k === 'part') f.parts[kind][0] = v;
  else if (k === 'size') {
    if (n() == null) return null;
    f.parts[kind][1] = n();
  } else if (k === 'colour') f.parts[kind][2] = colour(v);
  else if (k === 'xpart') f.extras[i][0] = v;
  else if (k === 'xanchor') f.extras[i][1] = v;
  else if (k === 'xsize') {
    if (n() == null) return null;
    f.extras[i][2] = n();
  } else if (k === 'xcolour') f.extras[i][3] = colour(v);
  else if (k === 'xpair') f.extras[i][4] = el.checked;
  else return null;
  return f;
}
async function kitWriteShown(sp, form, done) {
  try {
    const what = await kitWrite(sp, form);
    if (what)
      toast(
        what.length
          ? `${done}: ${what.join(', ')} written. Undo takes it all back.`
          : 'Already as baked: nothing changed.'
      );
  } catch (e) {
    toast('Not baked: ' + e.message, 'err');
  }
}
const kitShownSp = el =>
  el.closest('[data-kit-form]') &&
  (studioState.D.kitBuilds.forms.find(f => f.name === el.closest('[data-kit-form]').dataset.kitForm) || {}).rig;
document.addEventListener('change', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.kitr) return;
  const sp = kitShownSp(el),
    at = sp && kitFormOf(sp),
    form = at && kitEdited(at.form, el);
  if (form) kitWriteShown(sp, form, 'Baked');
});
ACTIONS.kitWriteBillie = (d, el) => {
  const sp = kitShownSp(el),
    at = sp && kitFormOf(sp);
  if (at) kitWriteShown(sp, clone(at.form), 'Written');
};
ACTIONS.kitExtraAdd = (d, el) => {
  const sp = kitShownSp(el),
    at = sp && kitFormOf(sp);
  if (!at) return;
  const f = clone(at.form),
    K = studioState.D.partKits,
    first = Object.keys(K.parts).find(id => K.slots[K.parts[id].kind] === 'headExtra');
  f.extras = [...(f.extras || []), [first, Object.keys(studioState.D.kitBuilds.bake.anchors)[0], 0.5, null, false]];
  kitWriteShown(sp, f, 'Extra added');
};
ACTIONS.kitExtraDrop = (d, el) => {
  const sp = kitShownSp(el),
    at = sp && kitFormOf(sp);
  if (!at) return;
  const f = clone(at.form);
  f.extras.splice(Number(d.i), 1);
  if (!f.extras.length) delete f.extras;
  kitWriteShown(sp, f, 'Extra taken off');
};
