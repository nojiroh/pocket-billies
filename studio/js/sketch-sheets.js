'use strict';
/* ================= POCKET BILLIES STUDIO · Sketch Billies and their drawing sheets (roster track RO-3a) =========
   A sketch Billie (one of game/data/bodyPlans.json's forms) is painted from its body plan and baked with the
   game's own baker (logic/sketch-art.js, as `npm run bake:sketches` does). Its drawing sheet (a column per
   picture, a row per view, on magenta) downloads, gets drawn on in any app and uploads back: the cells are cut by the
   same layout (at any whole scale), stored as art/next/sketches/<name>.png, and the Billie baked again (sheet and
   rig, one undo step). A body plan's sheet holds every Billie on that plan (a sample before any is), and splits back
   the same way. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { sketchBake, sketchCellsWith, sketchSheet, sketchSheetCut } from '../../game/js/logic/sketch-art.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, changed, commit, render, snapshotParts, studioState, toast } from './studio-app.js';
import { artSteps, pictureImage } from './pixel-canvas.js';
import { atlasGet, downloadCanvas, fileToCanvas, markArt, pickFile } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  SKETCH_DRAWN: [() => SKETCH_DRAWN],
  SKETCH_SHEET: [() => SKETCH_SHEET],
  sketchCanvas: [() => sketchCanvas, v => (sketchCanvas = v)],
  sketchCells: [() => sketchCells, v => (sketchCells = v)],
  sketchDownload: [() => sketchDownload, v => (sketchDownload = v)],
  sketchFormFrom: [() => sketchFormFrom],
  sketchFormOf: [() => sketchFormOf, v => (sketchFormOf = v)],
  sketchPanelHTML: [() => sketchPanelHTML, v => (sketchPanelHTML = v)],
  sketchPixels: [() => sketchPixels],
  sketchSheetForms: [() => sketchSheetForms, v => (sketchSheetForms = v)],
  sketchUi: [() => sketchUi],
  sketchUpload: [() => sketchUpload, v => (sketchUpload = v)],
  sketchWrite: [() => sketchWrite, v => (sketchWrite = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const SKETCH_DRAWN = name => `art/next/sketches/${name}.png`;
const SKETCH_SHEET = name => `art/next/billionaires/${name}.png`;
const sketchUi = { plan: 'biped', scale: 1 };
/** the sketch recipe of a species' rig */
export function sketchFormOf(sp) {
  return (studioState.D?.bodyPlans?.forms || []).find(f => f.rig === sp) || null;
}
const sketchPixels = c => c.getContext('2d').getImageData(0, 0, c.width, c.height);
function sketchCanvas(p) {
  const c = makeCanvas(p.width, p.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}
/** a form's cells: painted, with its stored drawing (this session's or the repository's) on top */
async function sketchCells(P, form) {
  const drawn = await atlasGet(SKETCH_DRAWN(form.name)).catch(() => null);
  return sketchCellsWith(P, form, drawn ? sketchSheetCut(P, [form], sketchPixels(drawn))[form.name] : null);
}
/** the forms a sheet holds: a Billie's, or every one on a plan (a sample when none is) */
function sketchSheetForms(P, what) {
  if (what.plan) {
    const forms = P.forms.filter(f => f.plan === what.plan);
    return {
      forms: forms.length
        ? forms
        : [
            {
              name: `sample-${what.plan}`,
              rig: `sample-${what.plan}`,
              plan: what.plan,
              colours: { main: '#c8794a', accent: '#f2c14e' },
            },
          ],
      named: true,
      file: `${what.plan}-plan.png`,
      sample: !forms.length,
    };
  }
  return { forms: [what.form], named: false, file: `${what.form.name}.png`, sample: false };
}
async function sketchDownload(what) {
  const P = studioState.D.bodyPlans,
    { forms, named, file } = sketchSheetForms(P, what),
    cells = {};
  for (const f of forms) cells[f.name] = await sketchCells(P, f);
  downloadCanvas(sketchCanvas(sketchSheet(P, forms, cells, named, sketchUi.scale)), file);
}
/** bakes forms from their cells and writes the stored drawings, sheets and rigs as one undo step */
async function sketchWrite(P, list) {
  commit(true);
  const S = studioState,
    D = S.D.kitBuilds.bake,
    steps = [];
  let rigs = null;
  for (const { form, cells, store } of list) {
    const made = sketchBake(P, form, D, cells);
    if (store) {
      const path = SKETCH_DRAWN(form.name),
        old = await atlasGet(path).catch(() => null),
        c = sketchCanvas(sketchSheet(P, [form], { [form.name]: cells }));
      steps.push([path, old && pictureImage(old), pictureImage(c)]);
      markArt(path, c);
    }
    const path = SKETCH_SHEET(form.name),
      old = await atlasGet(path).catch(() => null),
      c = sketchCanvas(made.sheet);
    steps.push([path, old && pictureImage(old), pictureImage(c)]);
    markArt(path, c);
    const rig = JSON.parse(JSON.stringify(made.rig));
    if (JSON.stringify(S.rigs[form.rig]) !== JSON.stringify(rig)) (rigs ||= { ...S.rigs })[form.rig] = rig;
  }
  if (rigs) {
    S.rigs = rigs;
    window.RIGS = S.rigs;
  }
  changed(true);
  artSteps(steps, snapshotParts());
  render();
}
async function sketchUpload(what) {
  const P = studioState.D.bodyPlans,
    { forms, named, sample } = sketchSheetForms(P, what);
  if (sample)
    return toast(`No Billie is on the ${what.plan} plan yet: there is nothing to store its drawing in.`, 'err');
  const f = await pickFile('image/png');
  if (!f) return;
  let cut;
  try {
    cut = sketchSheetCut(P, forms, sketchPixels(await fileToCanvas(f)), named);
  } catch (e) {
    return toast('Not read: ' + e.message, 'err');
  }
  await sketchWrite(
    P,
    forms.map(form => ({ form, cells: sketchCellsWith(P, form, cut[form.name]), store: true }))
  );
  toast(`${forms.map(x => x.name).join(', ')}: drawing stored and baked. Undo takes it back.`);
}
/** the card in Part mode: the Billie's own sheet (when it is a sketch Billie) and the body plans' sheets */
export function sketchPanelHTML(sp) {
  const P = studioState.D?.bodyPlans;
  if (!P) return '';
  const form = sketchFormOf(sp),
    scale = `<label class="help">drawn at <select data-sketch="scale">${[1, 2, 4, 8]
      .map(k => `<option value="${k}" ${k === sketchUi.scale ? 'selected' : ''}>${k}×</option>`)
      .join('')}</select></label>`,
    own = form
      ? `<h4>Sketch Billie <small class="mono">${escapeHtml(form.name)}</small></h4><p class="help">bodyPlans.json, on the <b>${escapeHtml(form.plan)}</b> plan. Download its drawing sheet, draw over the cells in any app (magenta stays clear; keep the labels and the grid where they are; a cell left magenta keeps its sketch), upload it back: it is stored and the Billie baked again.</p><div class="seg-row"><button class="btn sm" data-act="sketchDownload">Download drawing sheet</button><button class="btn sm" data-act="sketchUpload">Upload drawing sheet</button><button class="btn sm primary" data-act="sketchWrite">Write Billie</button></div>`
      : '';
  return `<div class="px-sec sketch-sheets" data-sketch-sp="${escapeHtml(sp)}">${own}<h4>Body plan sheets</h4><p class="help">Every Billie on a plan in one sheet: two rows each (front, back). Upload splits it back per Billie.</p><div class="seg-row"><select data-sketch="plan">${Object.keys(
    P.plans
  )
    .map(p => `<option ${p === sketchUi.plan ? 'selected' : ''}>${escapeHtml(p)}</option>`)
    .join(
      ''
    )}</select>${scale}<button class="btn sm" data-act="sketchPlanDownload">Download</button><button class="btn sm" data-act="sketchPlanUpload">Upload</button></div></div>`;
}
document.addEventListener('change', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.sketch) return;
  if (el.dataset.sketch === 'plan') sketchUi.plan = el.value;
  if (el.dataset.sketch === 'scale') sketchUi.scale = Number(el.value) || 1;
});
const sketchFormFrom = el => sketchFormOf(el.closest('[data-sketch-sp]')?.dataset.sketchSp || '');
ACTIONS.sketchDownload = (d, el) => {
  const form = sketchFormFrom(el);
  if (form) sketchDownload({ form });
};
ACTIONS.sketchUpload = (d, el) => {
  const form = sketchFormFrom(el);
  if (form) sketchUpload({ form });
};
ACTIONS.sketchWrite = async (d, el) => {
  const form = sketchFormFrom(el),
    P = studioState.D.bodyPlans;
  if (!form) return;
  try {
    await sketchWrite(P, [{ form, cells: await sketchCells(P, form), store: false }]);
    toast(`${form.name} baked. Undo takes it back.`);
  } catch (e) {
    toast('Not baked: ' + e.message, 'err');
  }
};
ACTIONS.sketchPlanDownload = () => sketchDownload({ plan: sketchUi.plan });
ACTIONS.sketchPlanUpload = () => sketchUpload({ plan: sketchUi.plan });
