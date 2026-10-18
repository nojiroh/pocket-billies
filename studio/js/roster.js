'use strict';
/* ================= ROSTER BOARD (v35) =================
   The 117 billionaires of the big art update as cards: name, line, stage, parody target, types, the design line, and
   four checkboxes for how far its art is (silhouette approved, piece sheet drawn, rigged, portrait). Lives in
   gamedata.roster; the game ignores it until v38 when the new species replace the old ones.
   The board also opens the silhouette check: the new piece sheet (art/next/billionaires/<id>.png), else a study
   (art/next/starters/<id>.png), else the current rig, drawn black at 24 px beside its neighbours. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $, $$ } from '../../game/js/util.js';
import { cnv } from '../../game/js/art.js';
import { drawRig } from '../../game/js/skeleton-rig.js';
import { esc } from './shims.js';
import { ACTS, SECTIONS, ST, after, changed, commit, render } from './core.js';
import { downloadCanvas, loadImage, rigFor } from './sprites.js';
import { skNeutral } from './skeleton.js';
/* eslint-disable no-func-assign */
expose({
  RO: [() => RO],
  RO_KINDS: [() => RO_KINDS],
  RO_SIL: [() => RO_SIL],
  roCard: [() => roCard, v => (roCard = v)],
  roList: [() => roList, v => (roList = v)],
  roMountSil: [() => roMountSil, v => (roMountSil = v)],
  roSheetSil: [() => roSheetSil, v => (roSheetSil = v)],
  roSilSheet: [() => roSilSheet, v => (roSilSheet = v)],
  roSilhouette: [() => roSilhouette, v => (roSilhouette = v)],
  roSpId: [() => roSpId, v => (roSpId = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const RO = { filter: 'all', q: '', kind: '' };
const RO_KINDS = {
  starter: 'Starter',
  legendary: 'Legendary',
  line3: 'Three stages',
  line2: 'Two stages',
  single: 'Single',
};
function roList() {
  const L = ST.D.roster || [];
  return L.filter(
    e =>
      (RO.kind ? e.kind === RO.kind : true) &&
      (RO.filter === 'todo'
        ? !Object.values(e.state || {}).every(Boolean)
        : RO.filter === 'done'
          ? Object.values(e.state || {}).every(Boolean)
          : true) &&
      (!RO.q || (e.name + ' ' + e.parody + ' ' + e.line + ' ' + e.design).toLowerCase().includes(RO.q.toLowerCase()))
  );
}
function roCard(e, i) {
  const idx = (ST.D.roster || []).indexOf(e),
    st = e.state || {},
    done = Object.values(st).filter(Boolean).length,
    ty = (e.types || [])
      .map(t => {
        const T = (ST.D.types || []).find(x => x.id === t);
        return `<span class="ro-type" style="background:${T ? T.color : '#888'};color:${T ? T.text : '#fff'}">${esc(t)}</span>`;
      })
      .join('');
  return `<div class="ro-card ${done === 4 ? 'done' : ''}" data-ro-id="${esc(e.id)}"><div class="ro-head"><span class="ro-no">#${e.no}</span><b>${esc(e.name)}</b><span class="ro-stage">${RO_KINDS[e.kind] || e.kind}${e.kind === 'starter' || e.kind === 'line3' || e.kind === 'line2' ? ' · stage ' + e.stage + (e.split ? ' ' + e.split : '') : ''}</span></div>
  <div class="ro-sil"><canvas class="ro-silc" data-sp="${esc(e.id)}" width="48" height="48"></canvas>${ty}</div>
  <p class="ro-par">Parody of <b>${esc(e.parody)}</b> · line <code>${esc(e.line)}</code></p>
  <p class="ro-des" contenteditable="plaintext-only" data-ro-des="${idx}" spellcheck="false">${esc(e.design)}</p>
  <div class="ro-state">${['silhouette', 'sheet', 'rig', 'portrait'].map(k => `<label class="fld chk sm"><input type="checkbox" data-p="roster.${idx}.state.${k}" data-k="bool" ${st[k] ? 'checked' : ''}><span>${k}</span></label>`).join('')}</div></div>`;
}
SECTIONS.roster = () => {
  const L = ST.D.roster || [];
  if (!L.length)
    return `<div class="ed-col solo"><h2>Roster board</h2><p class="help">No roster in this game data. Version 35 adds it (117 Billies for the big art update).</p></div>`;
  const all = L.length,
    done = L.filter(e => Object.values(e.state || {}).every(Boolean)).length,
    sil = L.filter(e => e.state && e.state.silhouette).length,
    sheets = L.filter(e => e.state && e.state.sheet).length;
  after(roMountSil);
  return `<div class="ed-col solo ro"><div class="ed-head"><h2>Roster board</h2><div class="seg-row">${['all', 'todo', 'done'].map(f => `<button class="seg ${RO.filter === f ? 'on' : ''}" data-act="roFilter" data-f="${f}">${f === 'all' ? 'All' : f === 'todo' ? 'To do' : 'Done'}</button>`).join('')}</div>
  <select data-act="roKind" id="roKind"><option value="">Every kind</option>${Object.entries(RO_KINDS)
    .map(([k, n]) => `<option value="${k}" ${RO.kind === k ? 'selected' : ''}>${n}</option>`)
    .join('')}</select>
  <input id="roQ" placeholder="Search name, parody, line…" value="${esc(RO.q)}"><span class="grow"></span><button class="btn" data-act="roSheet">Silhouette sheet</button><button class="btn" data-act="roExport">Export CSV</button></div>
  <p class="help">${all} Billies · ${sil} silhouettes approved · ${sheets} piece sheets drawn · ${done} complete. Tick a box when that step is done; the design line is editable. A piece sheet goes in <code>art/next/billionaires/&lt;id&gt;.png</code> with its layout <code>&lt;id&gt;.json</code> (Skeleton builder → Import piece sheet).</p>
  <div class="ro-grid">${roList().map(roCard).join('')}</div></div>`;
};
ACTS.roFilter = d => {
  RO.filter = d.f;
  render();
};
ACTS.roSheet = () => roSilSheet();
ACTS.roExport = () => {
  const L = ST.D.roster || [];
  const csv =
    'no,name,line,stage,kind,parody,types,design,silhouette,sheet,rig,portrait\n' +
    L.map(e =>
      [
        e.no,
        e.name,
        e.line,
        e.stage + (e.split || ''),
        e.kind,
        e.parody,
        (e.types || []).join('/'),
        '"' + (e.design || '').replace(/"/g, '""') + '"',
        ...['silhouette', 'sheet', 'rig', 'portrait'].map(k => (e.state && e.state[k] ? 1 : 0)),
      ].join(',')
    ).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'roster.csv';
  a.click();
};
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'roQ') {
    RO.q = el.value;
    const g = $('.ro-grid');
    if (g) {
      g.innerHTML = roList().map(roCard).join('');
      roMountSil();
    }
  }
  if (el.dataset && el.dataset.roDes != null) {
    const e = (ST.D.roster || [])[+el.dataset.roDes];
    if (e) {
      e.design = el.textContent;
      changed();
      commit();
    }
  }
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'roKind') {
    RO.kind = ev.target.value;
    render();
  }
});
/* the silhouette: the new sheet's front body pieces stacked (a layout file says where they go), else the old rig's
   neutral pose, else a question mark */
const RO_SIL = new Map();
/* a roster id (emberox) is the sheet's name; the species id the rigs use is line + stage (musk0) */
function roSpId(id) {
  const e = (ST.D.roster || []).find(x => x.id === id);
  if (!e) return id;
  const L = (ST.D.lines || []).find(l => l.id === e.line);
  if (!L) return id;
  const i = L.names.findIndex(n => n === e.name);
  return i >= 0 ? L.id + i : id;
}
async function roSilhouette(id, size = 24) {
  if (RO_SIL.has(id + size)) return RO_SIL.get(id + size);
  let src = null;
  try {
    const im = await loadImage('../game/art/next/billionaires/' + id + '.png');
    const lay = await fetch('../game/art/next/billionaires/' + id + '.json')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    src = roSheetSil(im, lay);
  } catch (e) {}
  if (!src) {
    try {
      const im = await loadImage('../game/art/next/starters/' + id + '.png');
      const c = cnv(im.width, im.height);
      c.getContext('2d').drawImage(im, 0, 0);
      src = c;
    } catch (e) {}
  }
  if (!src) {
    const R = rigFor(roSpId(id), 'front', false);
    if (R) {
      const c = cnv(R.BW, R.BH),
        x = c.getContext('2d');
      drawRig(x, R, skNeutral(), 'front');
      src = c;
    }
  }
  if (!src) {
    const c = cnv(size, size),
      x = c.getContext('2d');
    x.fillStyle = '#8a8a9a';
    x.font = `700 ${size * 0.8}px sans-serif`;
    x.textAlign = 'center';
    x.fillText('?', size / 2, size * 0.8);
    RO_SIL.set(id + size, c);
    return c;
  }
  /* crop to content, scale into size x size, black */
  const w = src.width,
    h = src.height,
    d = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 60) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const c = cnv(size, size),
    x = c.getContext('2d');
  if (x1 >= x0) {
    const cw = x1 - x0 + 1,
      ch = y1 - y0 + 1,
      k = Math.min(size / cw, size / ch),
      dw = Math.max(1, Math.round(cw * k)),
      dh = Math.max(1, Math.round(ch * k));
    x.imageSmoothingEnabled = false;
    x.drawImage(src, x0, y0, cw, ch, Math.floor((size - dw) / 2), size - dh, dw, dh);
    const id2 = x.getImageData(0, 0, size, size),
      q = id2.data;
    for (let i = 0; i < q.length; i += 4) {
      const a = q[i + 3];
      q[i] = q[i + 1] = q[i + 2] = 24;
      q[i + 3] = a > 90 ? 255 : 0;
    }
    x.putImageData(id2, 0, 0);
  }
  RO_SIL.set(id + size, c);
  return c;
}
function roSheetSil(im, lay) {
  if (!lay || !lay.pieces) return null;
  const c = cnv(lay.w || im.width, lay.h || im.height),
    x = c.getContext('2d');
  for (const p of lay.pieces) {
    if (p.group && p.group !== 'front') continue;
    if (p.face) continue;
    x.drawImage(im, p.x, p.y, p.w, p.h, p.px ?? p.x, p.py ?? p.y, p.w, p.h);
  }
  return c;
}
function roMountSil() {
  $$('.ro-silc').forEach(c => {
    const id = c.dataset.sp;
    roSilhouette(id, 24).then(s => {
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, 48, 48);
      x.drawImage(s, 0, 0, 48, 48);
    });
  });
}
async function roSilSheet() {
  const L = roList();
  const cols = 12,
    cell = 30,
    rows = Math.ceil(L.length / cols),
    c = cnv(cols * cell + 8, rows * (cell + 12) + 8),
    x = c.getContext('2d');
  x.fillStyle = '#e8e4dc';
  x.fillRect(0, 0, c.width, c.height);
  x.font = '8px sans-serif';
  x.fillStyle = '#333';
  x.textAlign = 'center';
  for (let i = 0; i < L.length; i++) {
    const s = await roSilhouette(L[i].id, 24),
      cx = 4 + (i % cols) * cell,
      cy = 4 + Math.floor(i / cols) * (cell + 12);
    x.drawImage(s, cx + 3, cy + 3);
    x.fillText(L[i].name.slice(0, 7), cx + cell / 2, cy + cell + 8);
  }
  const m = $('#modal');
  m.innerHTML = `<div class="pxed" role="dialog" aria-modal="true" aria-label="Silhouette sheet"><header class="px-top"><b>Silhouette sheet · ${L.length} at 24 px</b><span class="grow"></span><button class="btn" data-act="roSheetSave">Download</button><button class="btn primary" data-act="roSheetClose">Close</button></header><div class="px-stage" style="overflow:auto"><canvas id="roSheetCv"></canvas></div></div>`;
  const cv = $('#roSheetCv');
  cv.width = c.width * 3;
  cv.height = c.height * 3;
  const cx2 = cv.getContext('2d');
  cx2.imageSmoothingEnabled = false;
  cx2.drawImage(c, 0, 0, cv.width, cv.height);
  RO.sheetCanvas = c;
}
ACTS.roSheetSave = () => {
  if (RO.sheetCanvas) downloadCanvas(RO.sheetCanvas, 'silhouettes.png');
};
ACTS.roSheetClose = () => {
  $('#modal').innerHTML = '';
};
