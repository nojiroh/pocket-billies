'use strict';
/* ================= POCKET BILLIES STUDIO · Placeholder Billies and their drawing sheets (roster track RO-3a) =========
   A placeholder Billie (one of game/data/bodyPlans.json's forms) is painted from its body plan and baked with the
   game's own baker (logic/placeholder-art.js, as `npm run bake:placeholders` does). Its drawing sheet (a column per
   picture, a row per view, on magenta) downloads, gets drawn on in any app and uploads back: the cells are cut by the
   same layout (at any whole scale), stored as art/next/placeholders/<name>.png, and the Billie baked again (sheet and
   rig, one undo step). A body plan's sheet holds every Billie on that plan (a sample before any is), and splits back
   the same way. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  placeholderBake,
  placeholderCellsWith,
  placeholderSheet,
  placeholderSheetCut,
} from '../../game/js/logic/placeholder-art.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, changed, commit, render, snapshotParts, studioState, toast } from './studio-app.js';
import { artSteps, pictureImage } from './pixel-canvas.js';
import { atlasGet, downloadCanvas, fileToCanvas, markArt, pickFile } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  PH_DRAWN: [() => PH_DRAWN],
  PH_SHEET: [() => PH_SHEET],
  phCanvas: [() => phCanvas, v => (phCanvas = v)],
  phCells: [() => phCells, v => (phCells = v)],
  phDownload: [() => phDownload, v => (phDownload = v)],
  phFormFrom: [() => phFormFrom],
  phPixels: [() => phPixels],
  phSheetForms: [() => phSheetForms, v => (phSheetForms = v)],
  phUpload: [() => phUpload, v => (phUpload = v)],
  phWrite: [() => phWrite, v => (phWrite = v)],
  placeholderFormOf: [() => placeholderFormOf, v => (placeholderFormOf = v)],
  placeholderPanelHTML: [() => placeholderPanelHTML, v => (placeholderPanelHTML = v)],
  placeholderUi: [() => placeholderUi],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const PH_DRAWN = name => `art/next/placeholders/${name}.png`;
const PH_SHEET = name => `art/next/billionaires/${name}.png`;
const placeholderUi = { plan: 'biped', scale: 1 };
/** the placeholder recipe of a species' rig */
export function placeholderFormOf(sp) {
  return (studioState.D?.bodyPlans?.forms || []).find(f => f.rig === sp) || null;
}
const phPixels = c => c.getContext('2d').getImageData(0, 0, c.width, c.height);
function phCanvas(p) {
  const c = makeCanvas(p.width, p.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}
/** a form's cells: painted, with its stored drawing (this session's or the repository's) on top */
async function phCells(P, form) {
  const drawn = await atlasGet(PH_DRAWN(form.name)).catch(() => null);
  return placeholderCellsWith(P, form, drawn ? placeholderSheetCut(P, [form], phPixels(drawn))[form.name] : null);
}
/** the forms a sheet holds: a Billie's, or every one on a plan (a sample when none is) */
function phSheetForms(P, what) {
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
async function phDownload(what) {
  const P = studioState.D.bodyPlans,
    { forms, named, file } = phSheetForms(P, what),
    cells = {};
  for (const f of forms) cells[f.name] = await phCells(P, f);
  downloadCanvas(phCanvas(placeholderSheet(P, forms, cells, named, placeholderUi.scale)), file);
}
/** bakes forms from their cells and writes the stored drawings, sheets and rigs as one undo step */
async function phWrite(P, list) {
  commit(true);
  const S = studioState,
    D = S.D.kitBuilds.bake,
    steps = [];
  let rigs = null;
  for (const { form, cells, store } of list) {
    const made = placeholderBake(P, form, D, cells);
    if (store) {
      const path = PH_DRAWN(form.name),
        old = await atlasGet(path).catch(() => null),
        c = phCanvas(placeholderSheet(P, [form], { [form.name]: cells }));
      steps.push([path, old && pictureImage(old), pictureImage(c)]);
      markArt(path, c);
    }
    const path = PH_SHEET(form.name),
      old = await atlasGet(path).catch(() => null),
      c = phCanvas(made.sheet);
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
async function phUpload(what) {
  const P = studioState.D.bodyPlans,
    { forms, named, sample } = phSheetForms(P, what);
  if (sample)
    return toast(`No Billie is on the ${what.plan} plan yet: there is nothing to store its drawing in.`, 'err');
  const f = await pickFile('image/png');
  if (!f) return;
  let cut;
  try {
    cut = placeholderSheetCut(P, forms, phPixels(await fileToCanvas(f)), named);
  } catch (e) {
    return toast('Not read: ' + e.message, 'err');
  }
  await phWrite(
    P,
    forms.map(form => ({ form, cells: placeholderCellsWith(P, form, cut[form.name]), store: true }))
  );
  toast(`${forms.map(x => x.name).join(', ')}: drawing stored and baked. Undo takes it back.`);
}
/** the card in Part mode: the Billie's own sheet (when it is a placeholder Billie) and the body plans' sheets */
export function placeholderPanelHTML(sp) {
  const P = studioState.D?.bodyPlans;
  if (!P) return '';
  const form = placeholderFormOf(sp),
    scale = `<label class="help">drawn at <select data-ph="scale">${[1, 2, 4, 8]
      .map(k => `<option value="${k}" ${k === placeholderUi.scale ? 'selected' : ''}>${k}×</option>`)
      .join('')}</select></label>`,
    own = form
      ? `<h4>Placeholder Billie <small class="mono">${escapeHtml(form.name)}</small></h4><p class="help">bodyPlans.json, on the <b>${escapeHtml(form.plan)}</b> plan. Download its drawing sheet, draw over the cells in any app (magenta stays clear; keep the labels and the grid where they are; a cell left magenta keeps its placeholder), upload it back: it is stored and the Billie baked again.</p><div class="seg-row"><button class="btn sm" data-act="phDownload">Download drawing sheet</button><button class="btn sm" data-act="phUpload">Upload drawing sheet</button><button class="btn sm primary" data-act="phWrite">Write Billie</button></div>`
      : '';
  return `<div class="px-sec placeholder-sheets" data-ph-sp="${escapeHtml(sp)}">${own}<h4>Body plan sheets</h4><p class="help">Every Billie on a plan in one sheet: two rows each (front, back). Upload splits it back per Billie.</p><div class="seg-row"><select data-ph="plan">${Object.keys(
    P.plans
  )
    .map(p => `<option ${p === placeholderUi.plan ? 'selected' : ''}>${escapeHtml(p)}</option>`)
    .join(
      ''
    )}</select>${scale}<button class="btn sm" data-act="phPlanDownload">Download</button><button class="btn sm" data-act="phPlanUpload">Upload</button></div></div>`;
}
document.addEventListener('change', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.ph) return;
  if (el.dataset.ph === 'plan') placeholderUi.plan = el.value;
  if (el.dataset.ph === 'scale') placeholderUi.scale = Number(el.value) || 1;
});
const phFormFrom = el => placeholderFormOf(el.closest('[data-ph-sp]')?.dataset.phSp || '');
ACTIONS.phDownload = (d, el) => {
  const form = phFormFrom(el);
  if (form) phDownload({ form });
};
ACTIONS.phUpload = (d, el) => {
  const form = phFormFrom(el);
  if (form) phUpload({ form });
};
ACTIONS.phWrite = async (d, el) => {
  const form = phFormFrom(el),
    P = studioState.D.bodyPlans;
  if (!form) return;
  try {
    await phWrite(P, [{ form, cells: await phCells(P, form), store: false }]);
    toast(`${form.name} baked. Undo takes it back.`);
  } catch (e) {
    toast('Not baked: ' + e.message, 'err');
  }
};
ACTIONS.phPlanDownload = () => phDownload({ plan: placeholderUi.plan });
ACTIONS.phPlanUpload = () => phUpload({ plan: placeholderUi.plan });
