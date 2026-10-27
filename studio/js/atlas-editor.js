'use strict';
/* ================= POCKET BILLIES STUDIO · the icon atlas (Studio art track SA-2b) =================
   The small icons (items, battle particles, map marks) are cut from one sheet, art/icons/icons.png, by the
   rectangles in art/manifest.js (logic/atlas-rects.js). Here the sheet is shown with every rectangle on it: pick one
   (on the sheet or in the list) to move it (drag, or the arrow keys), resize it (drag its lower right corner, or
   Shift and the arrow keys), type its numbers, rename it, delete it or add one. Each change is one step of the
   Studio's undo, saved as art/manifest.js's text (Propose sends it). A rename changes the data that names the key in
   the same step (items' icons, types' battle particles); a key the code names as a word is only listed (a hint).
   The sheet's pixels are painted in the Art browser's painter (Done comes back), the rectangles drawn over it.
   It is the Art browser's section (`art`) while open (artBrowser.atlas), as the ground tile set is. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { ICON_CACHE } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  atlasFreeSpot,
  atlasKeyOk,
  atlasProblems,
  atlasRename,
  atlasRenameData,
  atlasUses,
  manifestParse,
  manifestText,
} from '../../game/js/logic/atlas-rects.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  dialog,
  openSection,
  render,
  snapshotParts,
  studioState,
  toast,
} from './studio-app.js';
import { textStep } from './pixel-canvas.js';
import { atlasGet, loadedAtlas, loadedText, textGet } from './sprites.js';
import { artBrowser, artCodeRefsLoad, artPaint } from './art-browser.js';
/* eslint-disable no-func-assign */
expose({
  AT_MAN: [() => AT_MAN],
  AT_SHEET: [() => AT_SHEET],
  artSectionAtlasBefore: [() => artSectionAtlasBefore],
  atlasAskKey: [() => atlasAskKey, v => (atlasAskKey = v)],
  atlasAt: [() => atlasAt, v => (atlasAt = v)],
  atlasCommit: [() => atlasCommit, v => (atlasCommit = v)],
  atlasDraw: [() => atlasDraw, v => (atlasDraw = v)],
  atlasEd: [() => atlasEd],
  atlasEditorHTML: [() => atlasEditorHTML, v => (atlasEditorHTML = v)],
  atlasMan: [() => atlasMan, v => (atlasMan = v)],
  atlasOpen: [() => atlasOpen, v => (atlasOpen = v)],
  atlasOverlay: [() => atlasOverlay, v => ((atlasOverlay = v), provide({ atlasOverlay }))],
  atlasPickedHTML: [() => atlasPickedHTML, v => (atlasPickedHTML = v)],
  mountAtlasEditor: [() => mountAtlasEditor, v => (mountAtlasEditor = v)],
});
/* eslint-enable no-func-assign */
provide({ atlasOverlay });
/* to-module: end */
const AT_SHEET = 'art/icons/icons.png',
  AT_MAN = 'art/manifest.js';
const atlasEd = { key: '', q: '', zoom: 3, drag: null, memo: { text: '', man: null } };

/* the manifest as it is now (unsaved, else as loaded), parsed once per text */
function atlasMan() {
  const t = loadedText(AT_MAN) || '';
  if (atlasEd.memo.text !== t) atlasEd.memo = { text: t, man: t ? manifestParse(t) : null };
  return atlasEd.memo.man;
}
async function atlasOpen(key = '') {
  try {
    await Promise.all([textGet(AT_MAN), atlasGet(AT_SHEET), artCodeRefsLoad()]);
  } catch (e) {
    return toast('Could not load the icon atlas: ' + e.message, 'err');
  }
  Object.assign(artBrowser, { atlas: true, icon: '', tiles: false, edit: '', sel: AT_SHEET, at: 'icons', q: '' });
  if (key) atlasEd.key = key;
  if (studioState.sec !== 'art') openSection('art');
  else render();
}

/* writes the rectangles: one step (from `before`, the text when a drag started); `parts` when the data changed too */
function atlasCommit(icons, before = loadedText(AT_MAN), parts) {
  const text = manifestText({ ...atlasMan(), icons });
  textStep(AT_MAN, before, text, parts);
}
/* the game's own icons follow the manifest at once (art.js iconCanvas reads window.ARTMAN; its cache is cleared) */
document.addEventListener('studio-text', ev => {
  if (!ev.detail || ev.detail.path !== AT_MAN) return;
  try {
    window.ARTMAN = manifestParse(loadedText(AT_MAN));
  } catch (e) {
    return;
  }
  for (const k of Object.keys(ICON_CACHE)) delete ICON_CACHE[k];
  if (artBrowser.atlas && studioState.sec === 'art' && !atlasEd.drag) render();
});

/* ---------- the section ---------- */
const artSectionAtlasBefore = SECTIONS.art;
SECTIONS.art = () => (artBrowser.atlas ? atlasEditorHTML() : artSectionAtlasBefore());
function atlasEditorHTML() {
  const man = atlasMan(),
    sheet = loadedAtlas(AT_SHEET);
  if (!man || !sheet) {
    artBrowser.atlas = false;
    return artSectionAtlasBefore();
  }
  afterRender(mountAtlasEditor);
  const icons = man.icons,
    keys = Object.keys(icons),
    q = atlasEd.q.toLowerCase(),
    shown = keys.filter(k => !q || k.toLowerCase().includes(q)),
    probs = atlasProblems(icons, sheet.width, sheet.height),
    k = icons[atlasEd.key] ? atlasEd.key : '';
  const list = shown
    .map(
      n =>
        `<button class="at-key${n === k ? ' on' : ''}${probs.some(p => p.key === n) ? ' bad' : ''}" data-act="atPick" data-k="${escapeHtml(n)}">${escapeHtml(n)}</button>`
    )
    .join('');
  const prob = probs.length
    ? `<ul class="at-probs">${probs.map(p => `<li><b>${escapeHtml(p.key)}</b> ${escapeHtml(p.msg)}</li>`).join('')}</ul>`
    : '<p class="help">Every rectangle is on the sheet, none overlapping.</p>';
  return `<div class="ed-col solo"><div class="ed-head"><h2>Icon atlas</h2><button class="btn" data-act="atAdd">Add a rectangle…</button><button class="btn" data-act="atClose">Back to the Art browser</button></div>
  <p class="help mono">${AT_SHEET} · ${AT_MAN}${studioState.textDirty.has(AT_MAN) ? ' · edited, not saved' : ''} · ${keys.length} rectangles</p>
  <div class="at-wrap"><div class="at-main">${card(
    `The sheet (${sheet.width} × ${sheet.height})`,
    `<div class="seg-row"><label class="fld"><span>Zoom</span><select id="atZoom">${[2, 3, 4, 6]
      .map(z => `<option value="${z}"${z === atlasEd.zoom ? ' selected' : ''}>${z}×</option>`)
      .join('')}</select></label><button class="btn sm" data-act="atPaint">Edit pixels</button></div>
    <div class="at-stage"><canvas class="pix at-cv" id="atCv" tabindex="0"></canvas></div>
    <p class="help">Click a rectangle to pick it; drag to move it, drag its lower right corner to resize. Arrow keys move the picked one a pixel (Shift: resize).</p>${prob}`
  )}</div>
  <aside class="at-side">${card(
    'Rectangles',
    `<input type="search" id="atQ" class="ab-q" placeholder="Search keys" value="${escapeHtml(atlasEd.q)}" autocomplete="off"><div class="at-keys">${list}</div>`
  )}${k ? card(escapeHtml(k), atlasPickedHTML(k, icons[k])) : ''}</aside></div></div>`;
}
function atlasPickedHTML(k, r) {
  const D = studioState.D,
    uses = atlasUses(k, D),
    code = ((artBrowser.code && artBrowser.code.atlas) || {})[k] || [];
  const fields = ['x', 'y', 'w', 'h']
    .map(
      (l, i) =>
        `<label class="fld"><span>${l}</span><input type="number" class="at-num" data-i="${i}" min="${i < 2 ? 0 : 1}" step="1" value="${r[i]}"></label>`
    )
    .join('');
  const used = uses.length
    ? `<ul class="ab-refs">${uses.map(u => `<li><b>${escapeHtml(u.kind)}</b> ${escapeHtml(u.at)}</li>`).join('')}</ul>`
    : '<p class="help">Nothing in the data names it.</p>';
  const hint = code.length
    ? `<p class="help">The code names the word <code>${escapeHtml(k)}</code> at ${code
        .slice(0, 6)
        .map(c => `<code>${escapeHtml(c)}</code>`)
        .join(
          ', '
        )}${code.length > 6 ? ` and ${code.length - 6} more` : ''}: maybe this icon, maybe another thing of that name.</p>`
    : '';
  return `<div class="grid at-fields">${fields}</div>
  <div class="seg-row at-cut">${[1, 2, 4].map(s => `<canvas class="pix at-prev" data-s="${s}" width="${r[2] * s}" height="${r[3] * s}"></canvas>`).join('')}</div>
  <h4>Used by</h4>${used}${hint}
  <div class="seg-row"><button class="btn sm" data-act="atRename">Rename…</button><button class="btn sm" data-act="atDelete">Delete</button></div>`;
}

/* ---------- drawing ---------- */
function atlasDraw() {
  const cv = $('#atCv'),
    sheet = loadedAtlas(AT_SHEET),
    man = atlasEd.drag ? atlasEd.drag.man : atlasMan();
  if (!cv || !sheet || !man) return;
  const z = atlasEd.zoom,
    probs = new Set(atlasProblems(man.icons, sheet.width, sheet.height).map(p => p.key));
  cv.width = sheet.width * z;
  cv.height = sheet.height * z;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(sheet, 0, 0, cv.width, cv.height);
  x.lineWidth = 1;
  for (const [k, r] of Object.entries(man.icons)) {
    const on = k === atlasEd.key;
    x.strokeStyle = on ? '#ff9a1f' : probs.has(k) ? '#ff2d55' : 'rgba(64,200,255,.7)';
    x.lineWidth = on ? 2 : 1;
    x.strokeRect(r[0] * z + 0.5, r[1] * z + 0.5, r[2] * z - 1, r[3] * z - 1);
    if (on) x.fillStyle = 'rgba(255,154,31,.15)';
    if (on) x.fillRect(r[0] * z, r[1] * z, r[2] * z, r[3] * z);
  }
  const r = man.icons[atlasEd.key];
  document.querySelectorAll('canvas.at-prev').forEach(c => {
    if (!r) return;
    const s = +c.dataset.s;
    c.width = r[2] * s;
    c.height = r[3] * s;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(sheet, r[0], r[1], r[2], r[3], 0, 0, r[2] * s, r[3] * s);
  });
}
/* the rectangles over the sheet in the Art browser's painter (pixel-canvas overlay, in picture pixels) */
function atlasOverlay() {
  const man = atlasMan();
  if (!man) return '';
  return Object.values(man.icons)
    .map(
      r =>
        `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="none" stroke="rgba(64,200,255,.8)" stroke-width=".1"/>`
    )
    .join('');
}

/* ---------- picking, dragging and keys ---------- */
function atlasAt(icons, x, y) {
  const hit = ([, r]) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
  const E = Object.entries(icons);
  return (E.find(e => e[0] === atlasEd.key && hit(e)) || E.find(hit) || [''])[0];
}
function mountAtlasEditor() {
  const cv = $('#atCv');
  atlasDraw();
  const q = $('#atQ');
  if (q) {
    let t = 0;
    q.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        atlasEd.q = q.value;
        render();
        const n = $('#atQ');
        if (n) {
          n.focus();
          n.setSelectionRange(n.value.length, n.value.length);
        }
      }, 200);
    });
  }
  $('#atZoom').addEventListener('change', e => {
    atlasEd.zoom = +e.target.value;
    atlasDraw();
  });
  document.querySelectorAll('input.at-num').forEach(inp =>
    inp.addEventListener('change', () => {
      const icons = { ...atlasMan().icons },
        r = [...icons[atlasEd.key]];
      r[+inp.dataset.i] = Math.max(+inp.dataset.i < 2 ? 0 : 1, Math.round(+inp.value || 0));
      icons[atlasEd.key] = r;
      atlasCommit(icons);
    })
  );
  if (!cv) return;
  const at = ev => {
    const b = cv.getBoundingClientRect(),
      z = atlasEd.zoom * (b.width / cv.width || 1);
    return [(ev.clientX - b.left) / z, (ev.clientY - b.top) / z];
  };
  cv.addEventListener('pointerdown', ev => {
    const man = atlasMan(),
      [fx, fy] = at(ev),
      k = atlasAt(man.icons, Math.floor(fx), Math.floor(fy));
    if (!k) return;
    const r = man.icons[k],
      corner = fx >= r[0] + r[2] - 1.2 && fy >= r[1] + r[3] - 1.2;
    atlasEd.key = k;
    atlasEd.drag = {
      k,
      corner,
      from: [fx, fy],
      r0: [...r],
      before: loadedText(AT_MAN),
      man: { ...man, icons: { ...man.icons } },
    };
    cv.setPointerCapture(ev.pointerId);
    atlasDraw();
  });
  cv.addEventListener('pointermove', ev => {
    const d = atlasEd.drag;
    if (!d) return;
    const [fx, fy] = at(ev),
      dx = Math.round(fx - d.from[0]),
      dy = Math.round(fy - d.from[1]),
      r = d.corner
        ? [d.r0[0], d.r0[1], Math.max(1, d.r0[2] + dx), Math.max(1, d.r0[3] + dy)]
        : [Math.max(0, d.r0[0] + dx), Math.max(0, d.r0[1] + dy), d.r0[2], d.r0[3]];
    d.man.icons[d.k] = r;
    atlasDraw();
  });
  const up = () => {
    const d = atlasEd.drag;
    if (!d) return;
    atlasEd.drag = null;
    if (String(d.man.icons[d.k]) !== String(d.r0)) atlasCommit(d.man.icons, d.before);
    else render();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('keydown', ev => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    const icons = { ...atlasMan().icons },
      r = icons[atlasEd.key];
    if (!dir || !r) return;
    ev.preventDefault();
    icons[atlasEd.key] = ev.shiftKey
      ? [r[0], r[1], Math.max(1, r[2] + dir[0]), Math.max(1, r[3] + dir[1])]
      : [Math.max(0, r[0] + dir[0]), Math.max(0, r[1] + dir[1]), r[2], r[3]];
    atlasCommit(icons);
    afterRender(() => {
      const c = $('#atCv');
      if (c) c.focus();
    });
  });
}

/* ---------- actions ---------- */
ACTIONS.atOpen = () => atlasOpen();
ACTIONS.atClose = () => {
  artBrowser.atlas = false;
  render();
};
ACTIONS.atPick = d => {
  atlasEd.key = d.k;
  render();
};
ACTIONS.atPaint = () => artPaint(AT_SHEET, { label: 'Icon atlas', fn: () => atlasOpen(atlasEd.key) });
/* a key for a new or renamed rectangle: asked, checked (letters, digits and _; not taken) */
async function atlasAskKey(title, start = '', extra = '') {
  return dialog(
    title,
    `<label class="fld"><span>Key</span><input type="text" id="atKey" maxlength="40" value="${escapeHtml(start)}"></label>${extra}`,
    [
      { l: 'Cancel', v: null },
      {
        l: 'OK',
        c: 'primary',
        f: m => {
          const k = (m.querySelector('#atKey').value || '').trim();
          if (!atlasKeyOk(k)) return (toast('A key is letters, digits and _, starting with a letter.'), false);
          if (atlasMan().icons[k]) return (toast(`There is a rectangle ${k} already.`), false);
          const w = m.querySelector('#atW'),
            h = m.querySelector('#atH');
          return w ? { k, w: Math.max(1, +w.value | 0), h: Math.max(1, +h.value | 0) } : { k };
        },
      },
    ]
  );
}
ACTIONS.atAdd = async () => {
  const a = await atlasAskKey(
    'Add a rectangle',
    '',
    `<div class="grid"><label class="fld"><span>Width</span><input type="number" id="atW" min="1" value="8"></label><label class="fld"><span>Height</span><input type="number" id="atH" min="1" value="8"></label></div><p class="help">It goes in the first free place on the sheet; paint the icon there with Edit pixels. An item’s icon is <code>i_</code> and the item’s icon name.</p>`
  );
  if (!a) return;
  const sheet = loadedAtlas(AT_SHEET),
    spot = atlasFreeSpot(atlasMan().icons, sheet.width, sheet.height, a.w, a.h);
  if (!spot)
    return toast(
      `No free ${a.w}×${a.h} place on the sheet: make the sheet bigger first (Replace… in the Art browser).`
    );
  atlasEd.key = a.k;
  atlasCommit({ ...atlasMan().icons, [a.k]: [spot[0], spot[1], a.w, a.h] });
};
ACTIONS.atRename = async () => {
  const from = atlasEd.key,
    code = ((artBrowser.code && artBrowser.code.atlas) || {})[from] || [];
  const a = await atlasAskKey(
    'Rename ' + escapeHtml(from),
    from,
    `<p class="help">The data that names it follows (items’ icons, types’ battle particles).${code.length ? ` The code names the word at ${code.length} place${code.length > 1 ? 's' : ''} (${code.slice(0, 3).map(escapeHtml).join(', ')}…): those stay as they are.` : ''}</p>`
  );
  if (!a) return;
  const icons = atlasRename(atlasMan().icons, from, a.k),
    uses = atlasUses(from, studioState.D);
  if (uses.length) {
    if (atlasRenameData(studioState.D, from, a.k) < 0)
      return toast('Items use it as their icon: an item icon’s key starts with i_.', 'err');
    changed(false);
    atlasEd.key = a.k;
    atlasCommit(icons, loadedText(AT_MAN), snapshotParts());
  } else {
    atlasEd.key = a.k;
    atlasCommit(icons);
  }
  toast(
    `Renamed to ${a.k}${uses.length ? `, and ${uses.length} place${uses.length > 1 ? 's' : ''} in the data` : ''}.`
  );
};
ACTIONS.atDelete = async () => {
  const k = atlasEd.key,
    uses = atlasUses(k, studioState.D),
    code = ((artBrowser.code && artBrowser.code.atlas) || {})[k] || [];
  if (uses.length) return toast(`${k} is used by ${uses.map(u => u.at).join(', ')}: change those first.`, 'err');
  if (
    code.length &&
    !(await ask(
      `The code names the word ${escapeHtml(k)} (${code.slice(0, 3).map(escapeHtml).join(', ')}). Delete the rectangle anyway?`,
      'Delete'
    ))
  )
    return;
  const icons = { ...atlasMan().icons };
  delete icons[k];
  atlasEd.key = '';
  atlasCommit(icons);
};
