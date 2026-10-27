'use strict';
/* ================= POCKET BILLIES STUDIO · the UI icons (Studio art track SA-2b) =================
   The interface icons are art/ui/<name>.svg: 36 x 36 pixel art in fixed colours, the "block and split" look. Since
   SA-2b these SVG files are the source (tools/build-ui-icons.py retired, decision 6). Here an icon is edited three ways,
   each change one step of the Studio's undo and saved as text (Propose sends it):
   - its pixels on the shared pixel canvas (an icon in the pixel format: logic/svg-pixels.js writes the same text back);
   - Shade as a block: a front painted flat on 34 x 34 gets the set's block side, split and seams (logic/icon-block.js);
   - its text, checked as you type, for an SVG drawn any other way.
   A live preview shows it at the game's sizes on light and dark panels, and beside the other icons. An unsaved icon
   shows in the Studio's own previews too (art.js uiIconURL reads window.NW_ART).
   It is the Art browser's section (`art`) while open (artBrowser.icon), as the ground tile set is. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelKeyAction } from '../../game/js/logic/pixel-ops.js';
import { pixelsToSvg, svgProblem, svgToPixels } from '../../game/js/logic/svg-pixels.js';
import {
  ICON_FRONT,
  ICON_PALETTE,
  ICON_RAMPS,
  ICON_SIZE,
  iconBlock,
  iconFamily,
} from '../../game/js/logic/icon-block.js';
import { ACTIONS, SECTIONS, afterRender, card, dialog, openSection, render, studioState, toast } from './studio-app.js';
import {
  drawPixelCanvas,
  pixelCanvas,
  pixelCanvasAct,
  pixelCanvasColor,
  pixelCanvasDeselect,
  pixelCanvasPanel,
  pixelCanvasPanelHTML,
  pixelCanvasToolsHTML,
  textStep,
} from './pixel-canvas.js';
import { loadedText, pickFile, svgDataUrl, textGet } from './sprites.js';
import { artBrowser, artPictures } from './art-browser.js';
/* eslint-disable no-func-assign */
expose({
  ICON_BOX: [() => ICON_BOX],
  artSectionBefore: [() => artSectionBefore],
  iconDrawPreviews: [() => iconDrawPreviews, v => (iconDrawPreviews = v)],
  iconEd: [() => iconEd],
  iconEditOpen: [() => iconEditOpen, v => (iconEditOpen = v)],
  iconEditorHTML: [() => iconEditorHTML, v => (iconEditorHTML = v)],
  iconNames: [() => iconNames, v => (iconNames = v)],
  iconPath: [() => iconPath],
  iconPicture: [() => iconPicture, v => (iconPicture = v)],
  iconReplace: [() => iconReplace, v => ((iconReplace = v), provide({ iconReplace }))],
  iconSetText: [() => iconSetText, v => (iconSetText = v)],
  iconShowUnsaved: [() => iconShowUnsaved, v => (iconShowUnsaved = v)],
  iconSrc: [() => iconSrc],
  iconSwatches: [() => iconSwatches, v => (iconSwatches = v)],
  iconText: [() => iconText],
  iconTextNote: [() => iconTextNote, v => (iconTextNote = v)],
  iconWritePixels: [() => iconWritePixels, v => (iconWritePixels = v)],
  mountIconEditor: [() => mountIconEditor, v => (mountIconEditor = v)],
  svgParseProblem: [() => svgParseProblem, v => (svgParseProblem = v)],
});
/* eslint-enable no-func-assign */
provide({ iconReplace });
/* to-module: end */
/* the open icon and the painter's state */
const iconEd = {
  /** the text box's own text while it doesn't parse (else the icon's text) */
  draft: null,
  pc: null,
  keep: {},
  tool: 'pen',
  color: '#C8492F',
  hue: '',
  canvas: null,
  t: 0,
};
const ICON_BOX = 36;
const iconPath = name => `art/ui/${name}.svg`;
/* the icons in the file list, and any made here and not saved */
function iconNames() {
  const out = new Set();
  for (const p of artPictures()) {
    const m = /^art\/ui\/([\w-]+)\.svg$/.exec(p);
    if (m) out.add(m[1]);
  }
  for (const p of studioState.textDirty.keys()) {
    const m = /^art\/ui\/([\w-]+)\.svg$/.exec(p);
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}
/* the text now, '' while it isn't loaded */
const iconText = name => loadedText(iconPath(name)) || '';

/* opens an icon (loads its text first) */
async function iconEditOpen(name) {
  try {
    await textGet(iconPath(name));
  } catch (e) {
    return toast('Could not load ' + iconPath(name), 'err');
  }
  Object.assign(artBrowser, { icon: name, tiles: false, atlas: false, edit: '', sel: iconPath(name), at: 'ui', q: '' });
  Object.assign(iconEd, { draft: null, pc: null, canvas: null });
  if (studioState.sec !== 'art') openSection('art');
  else render();
}

/* ---------- the pixels: the icon's picture, drawn from its text (null when it isn't in the pixel format) ---------- */
function iconPicture(name) {
  const px = svgToPixels(iconText(name));
  if (px.error) return null;
  let c = iconEd.canvas;
  if (!c || c.width !== px.w || c.height !== px.h) c = iconEd.canvas = makeCanvas(px.w, px.h);
  c.getContext('2d').putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
  return c;
}
/* the picture's pixels as the icon's text: one step of the undo */
function iconWritePixels(name, c) {
  const im = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  iconSetText(name, pixelsToSvg(im.data, c.width, c.height));
}
function iconSetText(name, text) {
  const path = iconPath(name),
    was = loadedText(path);
  textStep(path, was, text);
}

/* ---------- the section ---------- */
const artSectionBefore = SECTIONS.art;
SECTIONS.art = () => (artBrowser.icon ? iconEditorHTML() : artSectionBefore());
function iconEditorHTML() {
  const name = artBrowser.icon,
    text = iconText(name),
    px = svgToPixels(text),
    path = iconPath(name);
  afterRender(mountIconEditor);
  const sizes = [14, 22, 36, 108]
    .map(
      s =>
        `<span class="ic-size"><img class="pix" data-ic="1" alt="" style="width:${s}px;height:${s}px"><small>${s} px</small></span>`
    )
    .join('');
  const others = iconNames()
    .map(
      n =>
        `<button class="ic-other${n === name ? ' on' : ''}" data-act="icOpen" data-n="${escapeHtml(n)}" title="${escapeHtml(n)}"><img class="pix" ${n === name ? 'data-ic="1"' : `src="${escapeHtml(iconSrc(n))}"`} alt="" width="22" height="22"></button>`
    )
    .join('');
  const paint = px.error
    ? `<p class="help warn">This icon isn’t drawn as pixels (${escapeHtml(px.error)}), so it is edited as text only.</p>`
    : `<div class="sc-pe" id="icPe"><div class="sc-pe-bar">${pixelCanvasToolsHTML()}<span class="colw"><input type="color" id="icColor" value="${iconEd.color}"></span></div>
  <div class="sc-pe-body"><div class="sc-pe-stage" id="icStage"></div><div class="sc-pe-side">${pixelCanvasPanelHTML()}
  <h4>Shade as a block</h4><p class="help">Paint the front flat in the top left 34 × 34 pixels, then shade it as every icon is: a 2 px block side to the lower right, paler above the 45° split, a lit top and left edge and a seam where two colours meet. Run it on a flat front only.</p>
  <div class="seg-row"><label class="fld"><span>One colour</span><select id="icHue"><option value="">No (each colour its own)</option>${Object.keys(
    ICON_RAMPS
  )
    .map(h => `<option value="${h}"${h === iconEd.hue ? ' selected' : ''}>${h}</option>`)
    .join('')}</select></label><button class="btn sm" data-act="icShade">Shade as a block</button></div>
  <div class="seg-row ic-swatches">${iconSwatches()}</div></div></div></div>`;
  const draft = iconEd.draft != null ? iconEd.draft : text;
  return `<div class="ed-col solo"><div class="ed-head"><h2>Icon: ${escapeHtml(name)}</h2><button class="btn" data-act="icNew">New icon…</button><button class="btn" data-act="icClose">Back to the Art browser</button></div>
  <p class="help mono">${escapeHtml(path)}${studioState.textDirty.has(path) ? ' · edited, not saved' : ''}</p>
  <div class="ic-wrap"><div class="ic-main">${card('Pixels', paint)}
  ${card('Text', `<textarea id="icText" class="mono ic-text" rows="8" spellcheck="false">${escapeHtml(draft)}</textarea><p class="help" id="icTextNote">${escapeHtml(iconTextNote(draft))}</p>`)}</div>
  <aside class="ic-side">${card('As the game shows it', `<div class="ic-panels"><div class="ic-panel ic-light">${sizes}</div><div class="ic-panel ic-dark">${sizes}</div></div><p class="help">The menus mostly draw icons at 14-22 px, on both themes in the same colours.</p>`)}
  ${card('Beside the others', `<div class="ic-others">${others}</div>`)}</aside></div></div>`;
}
/* the set's colours to paint with: the palette and the one-colour ramps */
function iconSwatches() {
  const cols = [...Object.values(ICON_PALETTE), ...Object.values(ICON_RAMPS).flat()];
  return [...new Set(cols)]
    .map(c => `<button class="ic-sw" data-act="icColor" data-c="${c}" title="${c}" style="background:${c}"></button>`)
    .join('');
}
/* what the text box says about its text: '' is fine */
function iconTextNote(text) {
  const bad = svgProblem(text) || svgParseProblem(text);
  if (bad) return 'Not used yet: ' + bad;
  const px = svgToPixels(text);
  return px.error ? 'Fine, but not in the pixel format, so the pixels can’t be painted.' : 'In the pixel format.';
}
/* the browser's own parse: '' when it reads */
function svgParseProblem(text) {
  try {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.nodeName !== 'svg') return 'it doesn’t read as SVG.';
  } catch (e) {
    return 'it doesn’t read as SVG.';
  }
  return '';
}
/* an icon's picture for an <img>: the unsaved text, else the file */
const iconSrc = name => {
  const p = iconPath(name);
  return studioState.textDirty.has(p) ? svgDataUrl(studioState.textDirty.get(p).text) : `../game/${p}`;
};

/* ---------- drawing and painting ---------- */
function iconDrawPreviews() {
  const src = svgDataUrl(iconText(artBrowser.icon));
  document.querySelectorAll('img[data-ic]').forEach(im => (im.src = src));
}
function mountIconEditor() {
  const name = artBrowser.icon,
    st = $('#icStage');
  iconDrawPreviews();
  const ta = $('#icText');
  if (ta)
    ta.addEventListener('input', () => {
      clearTimeout(iconEd.t);
      iconEd.t = setTimeout(() => {
        const t = ta.value,
          note = $('#icTextNote'),
          bad = svgProblem(t) || svgParseProblem(t);
        iconEd.draft = bad ? t : null;
        if (note) note.textContent = iconTextNote(t);
        if (!bad && t !== iconText(name)) iconSetText(name, t);
      }, 400);
    });
  const hue = $('#icHue');
  if (hue) hue.addEventListener('change', () => (iconEd.hue = hue.value));
  if (!st) return;
  const c = iconPicture(name);
  if (!c) return;
  const P = pixelCanvas(st, {
    get: () => iconEd.canvas,
    tool: iconEd.tool,
    color: iconEd.color,
    /* no path: the picture is the icon's text, written here as one text step a stroke */
    changed: P => iconWritePixels(name, P.o.get()),
    toolChanged: P => (iconEd.tool = P.tool),
    colorChanged: P => {
      iconEd.color = P.color;
      const k = $('#icColor');
      if (k) k.value = P.color;
    },
    overlay: () =>
      `<rect x="0" y="0" width="34" height="34" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".12" stroke-dasharray=".5 .5"/>`,
    drawn: P => {
      iconEd.keep = {
        zoom: P.zoom,
        showGrid: P.showGrid,
        symMode: P.symMode,
        symShift: P.symShift,
        lock: P.lock,
        showOff: P.showOff,
      };
    },
  });
  Object.assign(P, { zoom: 12, showGrid: true }, iconEd.keep);
  iconEd.pc = P;
  pixelCanvasPanel(P, $('#icPe'));
  drawPixelCanvas(P);
  const col = $('#icColor');
  col.addEventListener('input', () => pixelCanvasColor(P, col.value));
}
/* an undo or redo of the icon's text draws it again (the canvas from the text, the box with it) */
document.addEventListener('studio-text', ev => {
  const p = ev.detail && ev.detail.path,
    m = p && /^art\/ui\/([\w-]+)\.svg$/.exec(p);
  if (m) iconShowUnsaved(m[1]);
  if (!artBrowser.icon || studioState.sec !== 'art' || p !== iconPath(artBrowser.icon)) return;
  iconEd.draft = null;
  const ta = $('#icText'),
    t = iconText(artBrowser.icon);
  if (ta && ta.value !== t && document.activeElement !== ta) ta.value = t;
  const note = $('#icTextNote');
  if (note) note.textContent = iconTextNote(t);
  if (iconEd.pc && iconEd.pc.cv.isConnected && iconPicture(artBrowser.icon)) drawPixelCanvas(iconEd.pc);
  else if (!svgToPixels(t).error !== !!$('#icStage')) render();
  iconDrawPreviews();
});
/* the Studio's own previews of the game's menus draw an unsaved icon (art.js uiIconURL reads window.NW_ART) */
function iconShowUnsaved(name) {
  const p = iconPath(name),
    A = (window.NW_ART = window.NW_ART || {});
  if (studioState.textDirty.has(p)) A[`ui/${name}.svg`] = svgDataUrl(studioState.textDirty.get(p).text);
  else delete A[`ui/${name}.svg`];
}

/* ---------- actions ---------- */
ACTIONS.icOpen = d => iconEditOpen(d.n);
ACTIONS.icClose = () => {
  artBrowser.icon = '';
  iconEd.pc = null;
  render();
};
ACTIONS.icColor = d => {
  if (iconEd.pc) pixelCanvasColor(iconEd.pc, d.c);
};
/* the front (top left 34 x 34) as painted, shaded as a block: one step */
ACTIONS.icShade = () => {
  const name = artBrowser.icon,
    c = iconEd.canvas;
  if (!c) return;
  const im = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
    hex = i => '#' + [0, 1, 2].map(k => im[i + k].toString(16).toUpperCase().padStart(2, '0')).join(''),
    front = Array.from({ length: ICON_FRONT }, (_, y) =>
      Array.from({ length: ICON_FRONT }, (_, x) => {
        const i = (y * c.width + x) * 4;
        return im[i + 3] >= 128 ? hex(i) : '';
      })
    );
  if (!front.some(r => r.some(Boolean))) return toast('Paint the front first (the top left 34 × 34 pixels).');
  const out = iconBlock(front, iconFamily(iconEd.hue)),
    data = new Uint8ClampedArray(ICON_SIZE * ICON_SIZE * 4);
  out.forEach((row, y) =>
    row.forEach((h, x) => {
      if (!h) return;
      const i = (y * ICON_SIZE + x) * 4;
      data.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], i);
    })
  );
  iconSetText(name, pixelsToSvg(data, ICON_SIZE, ICON_SIZE));
  toast('Shaded as a block. Ctrl Z takes it back.');
};
/* a new icon: blank or a copy of the open one, saved with the next proposal */
ACTIONS.icNew = async () => {
  const name = await dialog(
    'New icon',
    `<label class="fld"><span>Name (lower case, digits and -)</span><input type="text" id="icNewName" maxlength="32" placeholder="lantern"></label>
    <label class="chk"><input type="checkbox" id="icNewCopy"> Start as a copy of ${escapeHtml(artBrowser.icon)}</label>
    <p class="help">The game finds an icon by its name (uiIconHTML('lantern')). The unit test counts the set (51 now): its owner raises that count when the new icon goes in.</p>`,
    [
      { l: 'Cancel', v: null },
      {
        l: 'Make it',
        c: 'primary',
        f: m => {
          const n = (m.querySelector('#icNewName').value || '').trim();
          if (!/^[a-z][a-z0-9-]*$/.test(n) || iconNames().includes(n)) {
            toast(iconNames().includes(n) ? `There is an icon ${n} already.` : 'Lower case letters, digits and -.');
            return false;
          }
          return { n, copy: m.querySelector('#icNewCopy').checked };
        },
      },
    ]
  );
  if (!name) return;
  const text = name.copy
    ? iconText(artBrowser.icon)
    : pixelsToSvg(new Uint8ClampedArray(ICON_BOX * ICON_BOX * 4), ICON_BOX, ICON_BOX);
  textStep(iconPath(name.n), null, text);
  iconEditOpen(name.n);
};
/* Ctrl K and the Art browser: an SVG picked from a file (Replace…) */
async function iconReplace(path) {
  const f = await pickFile('image/svg+xml,.svg');
  if (!f) return;
  const t = await f.text(),
    bad = svgProblem(t) || svgParseProblem(t);
  if (bad) return toast('Not replaced: ' + bad, 'err');
  await textGet(path).catch(() => null);
  textStep(path, loadedText(path), t);
  toast('Replaced in the Studio. Propose changes sends it.');
  render();
}
/* the painter's keys while the pointer is over it (as the Art browser's) */
document.addEventListener(
  'keydown',
  ev => {
    const pe = $('#icPe'),
      P = iconEd.pc;
    if (!pe || !P || !P.cv.isConnected || !pe.matches(':hover') || $('#dlg').innerHTML) return;
    if (ev.target.closest('input,select,textarea')) return;
    const a = pixelKeyAction(ev);
    if (!a || a === 'undo' || a === 'redo' || a === 'onion') return;
    if (a === 'deselect' ? !pixelCanvasDeselect(P) : !pixelCanvasAct(P, a)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  },
  true
);
