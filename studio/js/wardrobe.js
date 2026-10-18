'use strict';
/* ================= POCKET BILLIES STUDIO · wardrobe =================
   Trainers' body, hairstyles, faces and clothes. Every item is pieces on the trainer skeleton (front, back and side
   views) in one picture, plus a colour-area mask: red, green and blue mark the parts the game recolours.
   Paint pieces right on the body, add pieces to any bone, set colour areas, prices and shops, and watch the trainer
   walk and pose with it. The body section edits the skin pieces, the skeleton and the body sliders. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { frameStop, frameTask } from '../../game/js/frame-scheduler.js';
import { makeCanvas } from '../../game/js/art.js';
import { TR_CACHE, TR_PRESETS, cleanLook, trFrame, trRig, trSliders } from '../../game/js/person-art.js';
import { rigMatrices } from '../../game/js/skeleton-rig.js';
import { esc } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  after,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  colorField,
  commit,
  dialog,
  formatThousands,
  grid,
  numberField,
  render,
  selectField,
  studioState,
  textField,
  toast,
  uniqueKey,
} from './studio-app.js';
import { atlasGet, atlasNow, markArt } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  FACE_EXPRESSIONS: [() => FACE_EXPRESSIONS],
  MASK_AREA_COLORS: [() => MASK_AREA_COLORS],
  WARDROBE_CROPS: [() => WARDROBE_CROPS],
  WARDROBE_VIEWS: [() => WARDROBE_VIEWS],
  addPieceRegion: [() => addPieceRegion, v => (addPieceRegion = v)],
  bindWardrobeCanvas: [() => bindWardrobeCanvas, v => (bindWardrobeCanvas = v)],
  copyWardrobeSheets: [() => copyWardrobeSheets, v => (copyWardrobeSheets = v)],
  currentWardrobeItem: [() => currentWardrobeItem],
  drawWardrobeEditor: [() => drawWardrobeEditor, v => (drawWardrobeEditor = v)],
  drawWardrobeThumbs: [() => drawWardrobeThumbs, v => (drawWardrobeThumbs = v)],
  editedWardrobe: [() => editedWardrobe],
  fillWardrobePixels: [() => fillWardrobePixels, v => (fillWardrobePixels = v)],
  growPiece: [() => growPiece, v => (growPiece = v)],
  loadWardrobe: [() => loadWardrobe, v => ((loadWardrobe = v), provide({ loadWardrobe }))],
  mountWardrobe: [() => mountWardrobe, v => (mountWardrobe = v)],
  pickWardrobeColor: [() => pickWardrobeColor, v => (pickWardrobeColor = v)],
  plotWardrobePixel: [() => plotWardrobePixel, v => (plotWardrobePixel = v)],
  pushWardrobeUndo: [() => pushWardrobeUndo, v => (pushWardrobeUndo = v)],
  wardrobeArtChanged: [() => wardrobeArtChanged, v => (wardrobeArtChanged = v)],
  wardrobeBodyHTML: [() => wardrobeBodyHTML, v => (wardrobeBodyHTML = v)],
  wardrobeEditor: [() => wardrobeEditor],
  wardrobeEditorHTML: [() => wardrobeEditorHTML, v => (wardrobeEditorHTML = v)],
  wardrobeItemHTML: [() => wardrobeItemHTML, v => (wardrobeItemHTML = v)],
  wardrobeJoints: [() => wardrobeJoints, v => (wardrobeJoints = v)],
  wardrobePointerPixel: [() => wardrobePointerPixel, v => (wardrobePointerPixel = v)],
  wardrobePreviewHTML: [() => wardrobePreviewHTML, v => (wardrobePreviewHTML = v)],
  wardrobePreviewLoop: [() => wardrobePreviewLoop, v => (wardrobePreviewLoop = v)],
  wardrobeSheets: [() => wardrobeSheets, v => (wardrobeSheets = v)],
  wardrobeTestLook: [() => wardrobeTestLook, v => (wardrobeTestLook = v)],
});
/* eslint-enable no-func-assign */
provide({ loadWardrobe });
/* to-module: end */
const wardrobeEditor = {
  sel: null,
  view: 'front',
  piece: 0,
  tool: 'pen',
  color: '#2A2238',
  area: 1,
  zoom: 5,
  filter: 'all',
  pvView: 0,
  pvAct: 'walk',
  drag: null,
  undo: [],
  test: null,
  loaded: false,
};
provide({ wardrobeEditor }); /* to-module */
const editedWardrobe = () => studioState.D.wardrobe;
const currentWardrobeItem = () =>
  wardrobeEditor.sel === 'body' ? editedWardrobe().body : editedWardrobe().items[wardrobeEditor.sel];
const WARDROBE_CROPS = new Proxy({}, { get: (t, k) => (editedWardrobe().crops || {})[k] });
const WARDROBE_VIEWS = [
  ['front', 'Front'],
  ['back', 'Back'],
  ['side', 'Side'],
];
function wardrobeTestLook() {
  const L = cleanLook(wardrobeEditor.test || TR_PRESETS[0]);
  if (wardrobeEditor.sel && wardrobeEditor.sel !== 'body') {
    const it = editedWardrobe().items[wardrobeEditor.sel];
    if (it) L.wear[it.slot] = wardrobeEditor.sel;
  }
  return L;
}
async function loadWardrobe() {
  const W = editedWardrobe(),
    P = [W.body.img, W.body.mask];
  for (const it of Object.values(W.items)) P.push(it.img, it.mask);
  await Promise.all(P.map(p => atlasGet('art/' + p).catch(() => null)));
  wardrobeEditor.loaded = true;
}
/* ---------- section ---------- */
SECTIONS.wardrobe = () => {
  const W = editedWardrobe();
  if (!W)
    return `<div class="ed-col solo"><h2>Wardrobe</h2><p class="help">This game data has no wardrobe yet. Run <code>python3 tools/build-trainer-art.py</code>.</p></div>`;
  if (!wardrobeEditor.sel || (wardrobeEditor.sel !== 'body' && !W.items[wardrobeEditor.sel]))
    wardrobeEditor.sel = 'body';
  after(mountWardrobe);
  const slots = W.slots,
    list = Object.entries(W.items)
      .filter(([k, it]) => wardrobeEditor.filter === 'all' || it.slot === wardrobeEditor.filter)
      .sort(
        (a, b) =>
          slots.findIndex(s => s.id === a[1].slot) - slots.findIndex(s => s.id === b[1].slot) ||
          a[1].name.localeCompare(b[1].name)
      );
  const rows = list
    .map(
      ([k, it]) =>
        `<button class="lcard ${wardrobeEditor.sel === k ? 'on' : ''}" data-act="wdPick" data-k="${esc(k)}"><span class="wd-th" data-th="${esc(k)}"></span><span class="lt"><b>${esc(it.name)}</b><small>${esc((slots.find(s => s.id === it.slot) || {}).name || it.slot)}${it.starter ? ' · everyone has it' : it.price ? ` · $${formatThousands(it.price)}${it.shop && studioState.D.shops[it.shop] ? ' · ' + esc(studioState.D.shops[it.shop].name) : ''}` : ''}</small></span></button>`
    )
    .join('');
  return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="wdNew">+ New item</button>
   <select id="wdFilter"><option value="all">All items (${Object.keys(W.items).length})</option>${slots.map(s => `<option value="${s.id}" ${wardrobeEditor.filter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
  <div class="llist"><button class="lcard ${wardrobeEditor.sel === 'body' ? 'on' : ''}" data-act="wdPick" data-k="body"><span class="wd-th" data-th="body"></span><span class="lt"><b>Body &amp; skeleton</b><small>Skin pieces, bones, body sliders</small></span></button>${rows}</div></aside>
 <div class="ed-col">${wardrobeEditor.sel === 'body' ? wardrobeBodyHTML() : wardrobeItemHTML(wardrobeEditor.sel)}</div></div>`;
};
function wardrobeItemHTML(k) {
  const W = editedWardrobe(),
    it = W.items[k],
    p = `wardrobe.items.${k}`,
    shops = Object.entries(studioState.D.shops || {})
      .filter(([s, v]) => v.kind === 'wardrobe')
      .map(([s, v]) => [s, v.name]);
  const used = Object.entries(studioState.D.people || {})
    .filter(([x, P]) => P.look && P.look.wear && Object.values(P.look.wear).includes(k))
    .map(([x]) => x);
  const cols = it.colors
    .map(
      (c, i) =>
        `<div class="wd-col">${grid(
          textField('Colour area ' + (i + 1), `${p}.colors.${i}.0`),
          colorField('Default colour', `${p}.colors.${i}.1`),
          selectField(
            'Follows',
            `${p}.link.${i + 1}`,
            [
              ['hair', 'Hair colour'],
              ['skin', 'Skin colour'],
              ['eyes', 'Eye colour'],
            ],
            { none: 'Its own colour', opt: 1 }
          )
        )}<span class="wd-swatch" style="background:${['#E23C3C', '#2EA84A', '#3A62E0'][i]}">${['red', 'green', 'blue'][i]} in the mask</span>${it.colors.length > 1 ? `<button class="btn sm subtle danger" data-act="wdColDel" data-i="${i}">Remove</button>` : ''}</div>`
    )
    .join('');
  return `<div class="ed-head"><div><small class="mono">${esc(k)}</small><h2>${esc(it.name)}</h2>${used.length ? `<small>Worn by ${esc(used.join(', '))}</small>` : ''}</div><div class="seg-row"><button class="btn subtle" data-act="wdDup">Duplicate</button><button class="btn danger" data-act="wdDel">Delete</button></div></div>
 ${card('Preview', wardrobePreviewHTML(), { sub: 'The trainer from the Studio’s test look wearing this item, drawn by the game’s own renderer.' })}
 ${card(
   'Details',
   grid(
     textField('Name', `${p}.name`, { rr: 1 }),
     selectField(
       'Slot',
       `${p}.slot`,
       W.slots.map(s => [s.id, s.name]),
       { rr: 1 }
     ),
     numberField('Price ($)', `${p}.price`, { min: 0, step: 10, opt: 1 }),
     selectField('Sold at', `${p}.shop`, shops, { none: 'Not sold', opt: 1, rr: 1 }),
     checkboxField('Everyone has it from the start', `${p}.starter`, { rr: 1 })
   )
 )}
 ${card('Colour areas', cols + (it.colors.length < 3 ? `<div class="seg-row"><button class="btn sm" data-act="wdColAdd">+ Add a colour area</button></div>` : ''), { sub: 'Players pick a colour for each area; the shading you painted is kept. Paint the areas with the “Colour area” brush below.' })}
 ${card('Pieces and pixels', wardrobeEditorHTML(it), { sub: 'Each piece sits on one bone and moves with it. Paint on the trainer; the rest of the body is shown faintly for fitting.' })}`;
}
function wardrobeBodyHTML() {
  const W = editedWardrobe();
  const sl = W.sliders
    .map(
      (s, i) =>
        `<tr><td><input type="text" data-p="wardrobe.sliders.${i}.name" data-k="text" value="${esc(s.name)}"></td><td class="mono">${esc(s.k)}</td><td><input type="number" step=".01" data-p="wardrobe.sliders.${i}.min" data-k="num" value="${s.min}"></td><td><input type="number" step=".01" data-p="wardrobe.sliders.${i}.max" data-k="num" value="${s.max}"></td><td><input type="number" step=".01" data-p="wardrobe.sliders.${i}.def" data-k="num" value="${s.def}"></td></tr>`
    )
    .join('');
  const sk = W.skeleton[wardrobeEditor.view]
    .map(
      (b, i) =>
        `<tr><td class="mono">${esc(b.n)}</td><td class="mono">${esc(b.par || '—')}</td><td><input type="number" step=".5" data-p="wardrobe.skeleton.${wardrobeEditor.view}.${i}.at.0" data-k="num" value="${b.at[0]}"></td><td><input type="number" step=".5" data-p="wardrobe.skeleton.${wardrobeEditor.view}.${i}.at.1" data-k="num" value="${b.at[1]}"></td><td><input type="number" step=".1" data-p="wardrobe.skeleton.${wardrobeEditor.view}.${i}.z" data-k="num" value="${b.z}"></td></tr>`
    )
    .join('');
  return `<div class="ed-head"><div><h2>Body &amp; skeleton</h2><small>Shared by every trainer, rival, shopkeeper and townsperson.</small></div></div>
 ${card('Preview', wardrobePreviewHTML(true), { sub: 'Try the sliders: every item stretches with the body.' })}
 ${card('Skin pieces', wardrobeEditorHTML(W.body), { sub: 'Paint skin in the default skin colour; the game recolours it to each trainer’s skin. Clothes are drawn over these.' })}
 ${card('Skeleton · ' + WARDROBE_VIEWS.find(v => v[0] === wardrobeEditor.view)[1], `<table class="tbl"><thead><tr><th>Bone</th><th>Parent</th><th>Across</th><th>Down</th><th>Layer</th></tr></thead><tbody>${sk}</tbody></table>`, { sub: 'Where each joint sits relative to its parent, in pixels, and its drawing layer (higher is in front). The pelvis height comes from the leg length. Switch views above the pixel editor.' })}
 ${card('Body sliders', `<table class="tbl"><thead><tr><th>Name</th><th>Key</th><th>Lowest</th><th>Highest</th><th>Default</th></tr></thead><tbody>${sl}</tbody></table>`, { sub: 'The ranges players get in the dressing room.' })}`;
}
function wardrobePreviewHTML(body) {
  const L = wardrobeTestLook();
  return `<div class="wd-pv"><canvas id="wdPv"></canvas><div class="wd-pvside">
  <div class="seg-row">${[
    ['walk', 'Walk'],
    ['idle', 'Stand'],
    ['throw', 'Throw'],
    ['cheer', 'Cheer'],
    ['react', 'Oh no'],
  ]
    .map(
      ([a, n]) =>
        `<button class="seg sm ${wardrobeEditor.pvAct === a ? 'on' : ''}" data-act="wdAct" data-a="${a}">${n}</button>`
    )
    .join('')}</div>
  <div class="seg-row">${FACE_EXPRESSIONS.map(([k, n]) => `<button class="seg sm ${(wardrobeEditor.pvExpr || '') === k ? 'on' : ''}" data-act="wdExpr" data-e="${k}">${k ? n : 'Normal face'}</button>`).join('')}</div>
  <div class="seg-row"><button class="seg sm" data-act="wdTurn" data-d="-1">‹ Turn</button><button class="seg sm" data-act="wdTurn" data-d="1">Turn ›</button></div>
  ${trSliders()
    .map(
      s =>
        `<label class="fld range"><span>${esc(s.name)} <output>${(+L.body[s.k]).toFixed(2)}</output></span><input type="range" min="${s.min}" max="${s.max}" step=".01" value="${L.body[s.k]}" data-wd-test="${s.k}"></label>`
    )
    .join('')}
  <div class="seg-row"><span class="help">Skin</span>${((editedWardrobe().palettes || {}).skin || []).map(c => `<button class="wd-sw" style="background:${c}" data-act="wdSkin" data-c="${c}" aria-label="${c}"></button>`).join('')}</div></div></div>`;
}
function wardrobeEditorHTML(src) {
  const ps = src.pieces.map((p, i) => [p, i]).filter(([p]) => p.v === wardrobeEditor.view),
    sel = src.pieces[wardrobeEditor.piece];
  if (!sel || sel.v !== wardrobeEditor.view) wardrobeEditor.piece = ps.length ? ps[0][1] : -1;
  const bones = editedWardrobe().skeleton[wardrobeEditor.view].map(b => b.n);
  const tools = [
    ['pen', 'Pencil'],
    ['erase', 'Eraser'],
    ['fill', 'Fill'],
    ['pick', 'Pick'],
    ['area', 'Colour area'],
    ['move', 'Move piece'],
  ]
    .map(
      ([k, n]) =>
        `<button class="seg ${wardrobeEditor.tool === k ? 'on' : ''}" data-act="wdTool" data-t="${k}">${n}</button>`
    )
    .join('');
  const areas =
    wardrobeEditor.sel === 'body'
      ? ''
      : `<span class="px-tools wd-areas">${[
          [1, '#E23C3C'],
          [2, '#2EA84A'],
          [3, '#3A62E0'],
          [0, '#888'],
        ]
          .map(
            ([a, c]) =>
              `<button class="seg sm ${wardrobeEditor.area === a ? 'on' : ''}" data-act="wdArea" data-a="${a}"><i class="wd-dot" style="background:${c}"></i>${a ? 'Area ' + a : 'Fixed colour'}</button>`
          )
          .join('')}</span>`;
  const P = src.pieces[wardrobeEditor.piece];
  return `<div class="seg-row">${WARDROBE_VIEWS.map(([v, n]) => `<button class="seg ${wardrobeEditor.view === v ? 'on' : ''}" data-act="wdView" data-v="${v}">${n}</button>`).join('')}</div>
 <div class="wd-pieces">${ps.map(([p, i]) => `<button class="chk-chip ${i === wardrobeEditor.piece ? 'on' : ''}" data-act="wdPiece" data-i="${i}">${esc(p.b)}${p.x ? ' · ' + esc(p.x) : ''}${p.z != null ? ' · layer ' + p.z : ''}</button>`).join('') || '<span class="help">No pieces in this view yet.</span>'}</div>
 <div class="sc-bar"><span class="px-tools">${tools}</span><span class="colw"><input type="color" id="wdColor" value="${wardrobeEditor.color}"></span><span class="px-tools"><button class="seg" data-act="wdZoom" data-z="-1">−</button><button class="seg" data-act="wdZoom" data-z="1">+</button><button class="seg" data-act="wdUndo" title="Undo">↶</button></span></div>
 ${areas ? `<div class="sc-bar">${areas}<span class="help">Pencil and fill also mark the area you pick here.</span></div>` : ''}
 <div class="wd-stage"><canvas id="wdCv"></canvas></div>
 <div class="seg-row wd-pieceops">${P ? `<span class="help">Selected: <b>${esc(P.b)}</b>, ${P.r[2]}×${P.r[3]} px.</span><label class="fld wd-z"><span>Layer</span><input type="number" step=".05" data-p="${wardrobeEditor.sel === 'body' ? 'wardrobe.body' : 'wardrobe.items.' + wardrobeEditor.sel}.pieces.${wardrobeEditor.piece}.z" data-k="num" data-opt="1" value="${P.z ?? ''}" placeholder="auto"></label><label class="fld wd-z"><span>Shows when</span><select data-p="${wardrobeEditor.sel === 'body' ? 'wardrobe.body' : 'wardrobe.items.' + wardrobeEditor.sel}.pieces.${wardrobeEditor.piece}.x" data-k="sel" data-opt="1">${FACE_EXPRESSIONS.map(([k, n]) => `<option value="${k}" ${(P.x || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="btn sm subtle" data-act="wdPieceX" title="A copy of this piece that only shows with an expression; then repaint it">Copy for an expression</button><button class="btn sm subtle danger" data-act="wdPieceDel">Remove piece</button>` : ''}
  <span class="grow"></span><label class="fld"><span>Add a piece on</span><select id="wdBone">${bones.map(b => `<option>${b}</option>`).join('')}</select></label>
  <button class="btn sm" data-act="wdAdd" data-from="body" title="Starts as the body's shape on that bone, filled with the first colour">Fitted to the body</button><button class="btn sm" data-act="wdAdd" data-from="blank">Blank</button>${wardrobeEditor.view !== 'front' ? `<button class="btn sm subtle" data-act="wdAdd" data-from="front">Copy from front</button>` : ''}</div>`;
}
/* ---------- mount, drawing ---------- */
async function mountWardrobe() {
  if (!wardrobeEditor.loaded) await loadWardrobe();
  if (studioState.sec !== 'wardrobe') return;
  drawWardrobeThumbs();
  drawWardrobeEditor();
  bindWardrobeCanvas();
  const f = $('#wdFilter');
  if (f)
    f.onchange = () => {
      wardrobeEditor.filter = f.value;
      render();
    };
  const c = $('#wdColor');
  if (c)
    c.oninput = () => {
      wardrobeEditor.color = c.value.toUpperCase();
    };
  $$('[data-wd-test]').forEach(
    i =>
      (i.oninput = () => {
        wardrobeEditor.test = wardrobeTestLook();
        wardrobeEditor.test.body[i.dataset.wdTest] = +i.value;
        const o = i.parentElement.querySelector('output');
        if (o) o.textContent = (+i.value).toFixed(2);
      })
  );
  frameTask('wdpv', wardrobePreviewLoop);
}
function drawWardrobeThumbs() {
  $$('[data-th]').forEach(el => {
    const k = el.dataset.th,
      L = cleanLook(TR_PRESETS[0]);
    let u = '';
    try {
      if (k !== 'body') {
        const it = editedWardrobe().items[k];
        if (!it) return;
        L.wear[it.slot] = k;
      }
      const f = trFrame(L, 'front', 'idle', 0, 0),
        crop =
          {
            hair: 'head',
            hat: 'head',
            eyes: 'face',
            brows: 'face',
            mouth: 'face',
            facial: 'face',
            glasses: 'face',
            bottom: 'legs',
            shoes: 'feet',
          }[k === 'body' ? '' : editedWardrobe().items[k].slot] || 'body';
      const [x0, y0, x1, y1] = k === 'body' ? WARDROBE_CROPS.all : WARDROBE_CROPS[crop],
        w = x1 - x0,
        h = y1 - y0,
        c = makeCanvas(w, h);
      c.getContext('2d').drawImage(f, f.ax + x0, f.ay + y0, w, h, 0, 0, w, h);
      u = c.toDataURL();
    } catch (e) {}
    if (u) el.style.backgroundImage = `url(${u})`;
  });
}
function wardrobePreviewLoop(ts) {
  const cv = $('#wdPv');
  if (!cv || !cv.isConnected || studioState.sec !== 'wardrobe') {
    frameStop('wdpv');
    return;
  }
  const r = cv.getBoundingClientRect();
  if (r.width < 10) return;
  const W = Math.round(r.width),
    H = Math.round(r.height);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const x = cv.getContext('2d');
  x.clearRect(0, 0, W, H);
  const L = wardrobeTestLook(),
    [view, mir] = [
      ['front', 0],
      ['side', 0],
      ['back', 0],
      ['side', 1],
    ][wardrobeEditor.pvView],
    a = wardrobeEditor.pvAct;
  let ph = 0;
  if (a === 'walk') ph = (ts / 760) % 1;
  else if (a === 'throw') ph = (ts / 900) % 1;
  try {
    const f = trFrame(L, view, a, ph, ts, mir, wardrobeEditor.pvExpr || undefined),
      s = Math.max(
        1,
        Math.floor(
          Math.min(
            (H * 0.84) / ((editedWardrobe().figure || 74) * 1.18 * L.body.height),
            (W * 0.8) / ((editedWardrobe().figure || 74) * 0.6)
          ) * 2
        ) / 2
      );
    x.imageSmoothingEnabled = false;
    x.fillStyle = 'rgba(20,14,40,.15)';
    x.beginPath();
    x.ellipse(W / 2, H * 0.93, 11 * s, 2.5 * s, 0, 0, 7);
    x.fill();
    x.drawImage(f, Math.round(W / 2 - f.ax * s), Math.round(H * 0.93 - f.ay * s), f.width * s, f.height * s);
  } catch (e) {}
}
/* where each joint sits in the standing pose with default sliders */
function wardrobeJoints(view) {
  const L = cleanLook(TR_PRESETS[0]);
  for (const s of trSliders()) L.body[s.k] = s.def;
  L.body.chest = 1;
  const R = trRig(L, view),
    { W } = rigMatrices(R, { x: 0, y: 0, r: 0, sx: 1, sy: 1, act: 'idle', t: 0, ph: 0 }, 'front');
  const J = {};
  for (const b of editedWardrobe().skeleton[view]) if (W[b.n]) J[b.n] = [W[b.n][4] - R.cx, W[b.n][5] - R.base];
  return J;
}
function wardrobeSheets(src) {
  return [atlasNow('art/' + src.img), atlasNow('art/' + src.mask)];
}
const MASK_AREA_COLORS = [null, [226, 60, 60], [46, 168, 74], [58, 98, 224]];
function drawWardrobeEditor() {
  const cv = $('#wdCv'),
    src = currentWardrobeItem();
  if (!cv || !src) return;
  const J = wardrobeJoints(wardrobeEditor.view),
    Fg = editedWardrobe().figure || 74,
    Z = wardrobeEditor.zoom,
    W = Math.round(Fg * 0.7),
    H = Math.round(Fg * 1.3),
    X0 = -Math.round(W / 2),
    Y0 = -H + 6;
  cv.width = W * Z;
  cv.height = H * Z;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  /* the whole trainer, faint */
  const L = wardrobeTestLook();
  for (const s of trSliders()) L.body[s.k] = s.def;
  L.body.chest = Math.max(0.6, L.body.chest);
  const ex = (src.pieces[wardrobeEditor.piece] || {}).x || '',
    hasX = !!ex && src.pieces.some(p => p.v === wardrobeEditor.view && p.x === ex);
  const f = trFrame(L, wardrobeEditor.view, 'idle', 0, 0, 0, ex || undefined);
  x.globalAlpha = 0.32;
  x.drawImage(f, f.ax + X0, f.ay + Y0, W, H, 0, 0, W * Z, H * Z);
  x.globalAlpha = 1;
  const [img, msk] = wardrobeSheets(src);
  if (!img) return;
  src.pieces.forEach((p, i) => {
    if (p.v !== wardrobeEditor.view || !J[p.b]) return;
    if (hasX ? (p.x || '') !== ex : !!p.x) return;
    const [rx, ry, rw, rh] = p.r,
      px = (J[p.b][0] + p.o[0] - X0) * Z,
      py = (J[p.b][1] + p.o[1] - Y0) * Z;
    x.globalAlpha = i === wardrobeEditor.piece ? 1 : 0.75;
    x.drawImage(img, rx, ry, rw, rh, px, py, rw * Z, rh * Z);
    x.globalAlpha = 1;
    if (i === wardrobeEditor.piece) {
      if (msk && wardrobeEditor.sel !== 'body' && (wardrobeEditor.tool === 'area' || true)) {
        const d = msk.getContext('2d').getImageData(rx, ry, rw, rh).data;
        for (let yy = 0; yy < rh; yy++)
          for (let xx = 0; xx < rw; xx++) {
            const k = (yy * rw + xx) * 4;
            if (d[k + 3] < 128) continue;
            const a = d[k] > 127 ? 1 : d[k + 1] > 127 ? 2 : d[k + 2] > 127 ? 3 : 0;
            if (!a) continue;
            if (wardrobeEditor.tool !== 'area' && (xx + yy) % 3) continue;
            const c = MASK_AREA_COLORS[a];
            x.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${wardrobeEditor.tool === 'area' ? 0.45 : 0.3})`;
            x.fillRect(px + xx * Z, py + yy * Z, Z, Z);
          }
      }
      x.strokeStyle = '#1F6E6F';
      x.lineWidth = 2;
      x.setLineDash([6, 4]);
      x.strokeRect(px - 1, py - 1, rw * Z + 2, rh * Z + 2);
      x.setLineDash([]);
    }
  });
  /* the selected piece's joint */
  const P = src.pieces[wardrobeEditor.piece];
  if (P && J[P.b]) {
    const jx = (J[P.b][0] - X0 + 0.5) * Z,
      jy = (J[P.b][1] - Y0 + 0.5) * Z;
    x.strokeStyle = '#C8323C';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(jx - 7, jy);
    x.lineTo(jx + 7, jy);
    x.moveTo(jx, jy - 7);
    x.lineTo(jx, jy + 7);
    x.stroke();
  }
  wardrobeEditor.geo = { J, X0, Y0, Z };
}
/* ---------- editing pixels ---------- */
function wardrobePointerPixel(ev) {
  const cv = $('#wdCv'),
    r = cv.getBoundingClientRect(),
    G = wardrobeEditor.geo,
    src = currentWardrobeItem(),
    P = src.pieces[wardrobeEditor.piece];
  if (!P || !G || !G.J[P.b]) return null;
  const sx = (((ev.clientX - r.left) / r.width) * cv.width) / G.Z + G.X0,
    sy = (((ev.clientY - r.top) / r.height) * cv.height) / G.Z + G.Y0;
  return { x: Math.floor(sx - G.J[P.b][0] - P.o[0]), y: Math.floor(sy - G.J[P.b][1] - P.o[1]) };
}
/* make the piece cover local pixel (x,y): a bigger region is added at the bottom of the sheet */
function growPiece(src, P, x, y) {
  if (x >= 0 && y >= 0 && x < P.r[2] && y < P.r[3]) return { dx: 0, dy: 0 };
  const pad = 2,
    nx0 = Math.min(0, x - pad),
    ny0 = Math.min(0, y - pad),
    nx1 = Math.max(P.r[2], x + 1 + pad),
    ny1 = Math.max(P.r[3], y + 1 + pad),
    w = nx1 - nx0,
    h = ny1 - ny0;
  if (w > 160 || h > 160) return null;
  let top = 0;
  for (const k of ['img', 'mask']) {
    const c = atlasNow('art/' + src[k]);
    if (!c) continue;
    const H = c.height,
      n = makeCanvas(Math.max(c.width, w + 2), H + h + 1),
      nx = n.getContext('2d');
    nx.drawImage(c, 0, 0);
    nx.drawImage(c, P.r[0], P.r[1], P.r[2], P.r[3], 1 - nx0, H - ny0, P.r[2], P.r[3]);
    markArt('art/' + src[k], n);
    if (k === 'img') top = H;
  }
  P.r = [1, top, w, h];
  P.o = [P.o[0] + nx0, P.o[1] + ny0];
  return { dx: -nx0, dy: -ny0 };
}
function pushWardrobeUndo(src) {
  const [a, b] = wardrobeSheets(src);
  wardrobeEditor.undo.push({
    src,
    img: a.getContext('2d').getImageData(0, 0, a.width, a.height),
    msk: b ? b.getContext('2d').getImageData(0, 0, b.width, b.height) : null,
    pieces: JSON.stringify(src.pieces),
  });
  if (wardrobeEditor.undo.length > 30) wardrobeEditor.undo.shift();
}
function plotWardrobePixel(l) {
  const src = currentWardrobeItem(),
    P = src.pieces[wardrobeEditor.piece];
  if (!P) return;
  if (wardrobeEditor.tool === 'pick') {
    pickWardrobeColor(l);
    return;
  }
  if (wardrobeEditor.tool === 'erase' && (l.x < 0 || l.y < 0 || l.x >= P.r[2] || l.y >= P.r[3])) return;
  if (wardrobeEditor.tool === 'area' && (l.x < 0 || l.y < 0 || l.x >= P.r[2] || l.y >= P.r[3])) return;
  const g = growPiece(src, P, l.x, l.y);
  if (!g) return;
  const [img, msk] = wardrobeSheets(src),
    ix = img.getContext('2d'),
    mx = msk ? msk.getContext('2d') : null,
    px = P.r[0] + l.x + g.dx,
    py = P.r[1] + l.y + g.dy;
  const mark = a => {
    if (!mx) return;
    mx.clearRect(px, py, 1, 1);
    if (a) {
      const c = MASK_AREA_COLORS[a];
      mx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      mx.fillRect(px, py, 1, 1);
    }
  };
  if (wardrobeEditor.tool === 'erase') {
    ix.clearRect(px, py, 1, 1);
    mark(0);
  } else if (wardrobeEditor.tool === 'area') {
    if (!ix.getImageData(px, py, 1, 1).data[3]) return;
    mark(wardrobeEditor.area);
  } else {
    ix.fillStyle = wardrobeEditor.color;
    ix.fillRect(px, py, 1, 1);
    mark(wardrobeEditor.sel === 'body' ? 1 : wardrobeEditor.area);
  }
  wardrobeArtChanged(src);
}
function wardrobeArtChanged(src) {
  markArt('art/' + src.img, atlasNow('art/' + src.img));
  if (src.mask) markArt('art/' + src.mask, atlasNow('art/' + src.mask));
  changed();
  TR_CACHE.clear();
  drawWardrobeEditor();
}
function pickWardrobeColor(l) {
  const src = currentWardrobeItem(),
    P = src.pieces[wardrobeEditor.piece],
    [img, msk] = wardrobeSheets(src);
  if (l.x < 0 || l.y < 0 || l.x >= P.r[2] || l.y >= P.r[3]) return;
  const d = img.getContext('2d').getImageData(P.r[0] + l.x, P.r[1] + l.y, 1, 1).data;
  if (!d[3]) return;
  wardrobeEditor.color =
    '#' +
    [d[0], d[1], d[2]]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  const c = $('#wdColor');
  if (c) c.value = wardrobeEditor.color;
  if (msk) {
    const m = msk.getContext('2d').getImageData(P.r[0] + l.x, P.r[1] + l.y, 1, 1).data;
    wardrobeEditor.area = m[3] < 128 ? 0 : m[0] > 127 ? 1 : m[1] > 127 ? 2 : m[2] > 127 ? 3 : 0;
  }
  wardrobeEditor.tool = 'pen';
  render();
}
function fillWardrobePixels(l) {
  const src = currentWardrobeItem(),
    P = src.pieces[wardrobeEditor.piece];
  if (l.x < 0 || l.y < 0 || l.x >= P.r[2] || l.y >= P.r[3]) return;
  const [img, msk] = wardrobeSheets(src),
    ix = img.getContext('2d'),
    [rx, ry, rw, rh] = P.r,
    D = ix.getImageData(rx, ry, rw, rh),
    d = new Uint32Array(D.data.buffer),
    t = d[l.y * rw + l.x];
  const n = parseInt(wardrobeEditor.color.slice(1), 16),
    col = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
  if (t === col) return;
  const st = [[l.x, l.y]],
    seen = new Uint8Array(rw * rh),
    pts = [];
  while (st.length) {
    const [x, y] = st.pop();
    if (x < 0 || y < 0 || x >= rw || y >= rh) continue;
    const i = y * rw + x;
    if (seen[i] || d[i] !== t) continue;
    seen[i] = 1;
    d[i] = col;
    pts.push(i);
    st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ix.putImageData(D, rx, ry);
  if (msk && wardrobeEditor.sel !== 'body') {
    const mx = msk.getContext('2d');
    for (const i of pts) {
      mx.clearRect(rx + (i % rw), ry + Math.floor(i / rw), 1, 1);
      if (wardrobeEditor.area) {
        const c = MASK_AREA_COLORS[wardrobeEditor.area];
        mx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        mx.fillRect(rx + (i % rw), ry + Math.floor(i / rw), 1, 1);
      }
    }
  }
  wardrobeArtChanged(src);
}
function bindWardrobeCanvas() {
  const cv = $('#wdCv');
  if (!cv || cv._b) return;
  cv._b = 1;
  let down = false;
  cv.addEventListener('pointerdown', ev => {
    const l = wardrobePointerPixel(ev);
    if (!l) return;
    const src = currentWardrobeItem();
    pushWardrobeUndo(src);
    down = true;
    cv.setPointerCapture(ev.pointerId);
    const P = src.pieces[wardrobeEditor.piece];
    if (wardrobeEditor.tool === 'fill') {
      fillWardrobePixels(l);
      down = false;
      return;
    }
    if (wardrobeEditor.tool === 'move') {
      wardrobeEditor.drag = { x: ev.clientX, y: ev.clientY, o: P.o.slice() };
      return;
    }
    plotWardrobePixel(l);
  });
  cv.addEventListener('pointermove', ev => {
    if (!down) return;
    const src = currentWardrobeItem(),
      P = src.pieces[wardrobeEditor.piece];
    if (wardrobeEditor.tool === 'move' && wardrobeEditor.drag) {
      const r = cv.getBoundingClientRect(),
        k = cv.width / r.width / wardrobeEditor.zoom;
      P.o = [
        Math.round(wardrobeEditor.drag.o[0] + (ev.clientX - wardrobeEditor.drag.x) * k),
        Math.round(wardrobeEditor.drag.o[1] + (ev.clientY - wardrobeEditor.drag.y) * k),
      ];
      TR_CACHE.clear();
      drawWardrobeEditor();
      return;
    }
    if (['pen', 'erase', 'area'].includes(wardrobeEditor.tool)) {
      const l = wardrobePointerPixel(ev);
      if (l) plotWardrobePixel(l);
    }
  });
  const up = () => {
    if (down && wardrobeEditor.tool === 'move') {
      changed();
      commit(true);
    }
    down = false;
    wardrobeEditor.drag = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}
/* ---------- pieces ---------- */
function addPieceRegion(src, c, m) {
  const out = [];
  for (const [k, pic] of [
    ['img', c],
    ['mask', m],
  ]) {
    if (!src[k]) continue;
    const s = atlasNow('art/' + src[k]),
      H = s ? s.height : 0,
      W = Math.max(s ? s.width : 0, pic.width + 2),
      n = makeCanvas(W, H + pic.height + 1),
      x = n.getContext('2d');
    if (s) x.drawImage(s, 0, 0);
    x.drawImage(pic, 1, H);
    markArt('art/' + src[k], n);
    out.push(H);
  }
  return [1, out[0], c.width, c.height];
}
ACTIONS.wdAdd = d => {
  const src = currentWardrobeItem(),
    bone = $('#wdBone').value,
    v = wardrobeEditor.view,
    W = editedWardrobe();
  pushWardrobeUndo(src);
  let c, m, o;
  const body = W.body.pieces.find(p => p.v === v && p.b === bone);
  if (d.from === 'front') {
    const P =
      src.pieces.find(p => p.v === 'front' && p.b === bone) ||
      src.pieces.find(p => p.v === 'front' && p.b.slice(0, -1) === bone.slice(0, -1));
    if (!P) return toast('There’s no front piece on that bone to copy.');
    const [a, b] = wardrobeSheets(src);
    c = makeCanvas(P.r[2], P.r[3]);
    c.getContext('2d').drawImage(a, P.r[0], P.r[1], P.r[2], P.r[3], 0, 0, P.r[2], P.r[3]);
    m = makeCanvas(P.r[2], P.r[3]);
    if (b) m.getContext('2d').drawImage(b, P.r[0], P.r[1], P.r[2], P.r[3], 0, 0, P.r[2], P.r[3]);
    o = P.o.slice();
  } else if (d.from === 'body' && body) {
    const bi = atlasNow('art/' + W.body.img),
      [rx, ry, rw, rh] = body.r;
    c = makeCanvas(rw + 2, rh + 2);
    const x = c.getContext('2d');
    x.drawImage(bi, rx, ry, rw, rh, 1, 1, rw, rh);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = wardrobeEditor.sel === 'body' ? W.body.colors[0][1] : src.colors[0][1];
    x.fillRect(0, 0, c.width, c.height);
    /* a little shading so it isn't flat: darker outline */ x.globalCompositeOperation = 'source-over';
    m = makeCanvas(c.width, c.height);
    const mx = m.getContext('2d');
    mx.drawImage(c, 0, 0);
    mx.globalCompositeOperation = 'source-in';
    mx.fillStyle = 'rgb(226,60,60)';
    mx.fillRect(0, 0, c.width, c.height);
    o = [body.o[0] - 1, body.o[1] - 1];
  } else {
    c = makeCanvas(12, 12);
    m = makeCanvas(12, 12);
    o = body ? [body.o[0], body.o[1]] : [-6, -6];
  }
  const r = addPieceRegion(src, c, m),
    p = { v, b: bone, r, o };
  src.pieces.push(p);
  wardrobeEditor.piece = src.pieces.length - 1;
  changed();
  commit(true);
  TR_CACHE.clear();
  render();
};
const FACE_EXPRESSIONS = [
  ['', 'Always (normal face)'],
  ['blink', 'Blinking'],
  ['happy', 'Happy'],
  ['surprised', 'Surprised'],
  ['sad', 'Sad'],
  ['angry', 'Angry'],
  ['talk', 'Talking'],
];
/* expressions: a copy of the selected piece, shown instead of the normal pieces of this item while the face makes that expression */
ACTIONS.wdPieceX = async () => {
  const src = currentWardrobeItem(),
    P = src.pieces[wardrobeEditor.piece];
  if (!P) return;
  const used = new Set(src.pieces.filter(q => q.v === P.v && q.b === P.b).map(q => q.x || ''));
  const free = FACE_EXPRESSIONS.filter(([k]) => k && !used.has(k));
  if (!free.length) return toast('This piece already has every expression.');
  pushWardrobeUndo(src);
  const [a, b] = wardrobeSheets(src),
    c = makeCanvas(P.r[2], P.r[3]);
  c.getContext('2d').drawImage(a, P.r[0], P.r[1], P.r[2], P.r[3], 0, 0, P.r[2], P.r[3]);
  const m = makeCanvas(P.r[2], P.r[3]);
  if (b) m.getContext('2d').drawImage(b, P.r[0], P.r[1], P.r[2], P.r[3], 0, 0, P.r[2], P.r[3]);
  const r = addPieceRegion(src, c, m),
    q = { v: P.v, b: P.b, r, o: P.o.slice(), x: free[0][0] };
  if (P.z != null) q.z = P.z;
  src.pieces.push(q);
  wardrobeEditor.piece = src.pieces.length - 1;
  changed();
  commit(true);
  TR_CACHE.clear();
  render();
  toast(`Added a ${free[0][1].toLowerCase()} copy. Repaint it, or change when it shows.`);
};
ACTIONS.wdPieceDel = async () => {
  const src = currentWardrobeItem();
  if (!(await ask('Remove this piece? Its pixels stay in the picture file but aren’t used.', 'Remove'))) return;
  pushWardrobeUndo(src);
  src.pieces.splice(wardrobeEditor.piece, 1);
  wardrobeEditor.piece = -1;
  changed();
  commit(true);
  TR_CACHE.clear();
  render();
};
ACTIONS.wdUndo = () => {
  const u = wardrobeEditor.undo.pop();
  if (!u) return toast('Nothing to undo in this picture.');
  const src = u.src,
    [a, b] = wardrobeSheets(src);
  for (const [k, cv, data] of [
    ['img', a, u.img],
    ['mask', b, u.msk],
  ]) {
    if (!cv || !data) continue;
    const n = makeCanvas(data.width, data.height);
    n.getContext('2d').putImageData(data, 0, 0);
    markArt('art/' + src[k], n);
  }
  src.pieces.splice(0, src.pieces.length, ...JSON.parse(u.pieces));
  changed();
  TR_CACHE.clear();
  render();
};
/* ---------- items ---------- */
async function copyWardrobeSheets(from, to) {
  for (const k of ['img', 'mask']) {
    const s = await atlasGet('art/' + from[k]).catch(() => null);
    const n = makeCanvas(s ? s.width : 16, s ? s.height : 16);
    if (s) n.getContext('2d').drawImage(s, 0, 0);
    markArt('art/' + to[k], n);
  }
}
ACTIONS.wdNew = async () => {
  const W = editedWardrobe(),
    r = await dialog(
      'New wardrobe item',
      `<div class="grid"><label class="fld"><span>Name</span><input id="wnN" value="New jacket"></label><label class="fld"><span>Slot</span><select id="wnS">${W.slots.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
  <label class="fld"><span>Start from</span><select id="wnF"><option value="">Nothing (paint it from scratch)</option>${Object.entries(
    W.items
  )
    .map(([k, it]) => `<option value="${k}">A copy of ${esc(it.name)}</option>`)
    .join(
      ''
    )}</select></label></div><p class="help">A copy keeps the original’s pieces and colour areas, so you only repaint what changes.</p>`,
      [
        { l: 'Cancel', v: null },
        {
          l: 'Create',
          c: 'primary',
          f: () => ({ n: $('#wnN').value.trim() || 'New item', s: $('#wnS').value, f: $('#wnF').value }),
        },
      ]
    );
  if (!r) return;
  const k = uniqueKey(r.n, x => !!W.items[x]),
    img = `trainer/items/${k}.png`,
    mask = `trainer/items/${k}_m.png`,
    base = r.f && W.items[r.f];
  W.items[k] = base
    ? Object.assign(clone(base), { name: r.n, slot: r.s, img, mask, starter: false })
    : { name: r.n, slot: r.s, img, mask, colors: [['Main', '#3E8FB0']], pieces: [], price: 300 };
  delete W.items[k].tags;
  if (base) await copyWardrobeSheets(base, W.items[k]);
  else {
    markArt('art/' + img, makeCanvas(4, 4));
    markArt('art/' + mask, makeCanvas(4, 4));
  }
  wardrobeEditor.sel = k;
  wardrobeEditor.piece = 0;
  changed();
  commit(true);
  render();
};
ACTIONS.wdDup = async () => {
  const W = editedWardrobe(),
    it = W.items[wardrobeEditor.sel],
    k = uniqueKey(it.name + '2', x => !!W.items[x]),
    n = Object.assign(clone(it), {
      name: it.name + ' (copy)',
      img: `trainer/items/${k}.png`,
      mask: `trainer/items/${k}_m.png`,
      starter: false,
    });
  W.items[k] = n;
  await copyWardrobeSheets(it, n);
  wardrobeEditor.sel = k;
  changed();
  commit(true);
  render();
};
ACTIONS.wdDel = async () => {
  const W = editedWardrobe(),
    k = wardrobeEditor.sel;
  if (
    !(await ask(
      `Delete ${esc(W.items[k].name)}? People wearing it switch to the default for that slot. The picture files stay in art/trainer/items.`,
      'Delete'
    ))
  )
    return;
  delete W.items[k];
  wardrobeEditor.sel = 'body';
  changed();
  commit(true);
  render();
};
ACTIONS.wdPick = d => {
  wardrobeEditor.sel = d.k;
  wardrobeEditor.piece = 0;
  wardrobeEditor.undo = [];
  render();
};
ACTIONS.wdView = d => {
  wardrobeEditor.view = d.v;
  wardrobeEditor.piece = -1;
  render();
};
ACTIONS.wdPiece = d => {
  wardrobeEditor.piece = +d.i;
  render();
};
ACTIONS.wdTool = d => {
  wardrobeEditor.tool = d.t;
  render();
};
ACTIONS.wdArea = d => {
  wardrobeEditor.area = +d.a;
  render();
};
ACTIONS.wdZoom = d => {
  wardrobeEditor.zoom = clamp(wardrobeEditor.zoom + +d.z, 3, 14);
  drawWardrobeEditor();
};
ACTIONS.wdExpr = d => {
  wardrobeEditor.pvExpr = d.e || null;
  $$('[data-act=wdExpr]').forEach(b => b.classList.toggle('on', b.dataset.e === (d.e || '')));
};
ACTIONS.wdAct = d => {
  wardrobeEditor.pvAct = d.a;
  $$('[data-act=wdAct]').forEach(b => b.classList.toggle('on', b.dataset.a === d.a));
};
ACTIONS.wdTurn = d => {
  wardrobeEditor.pvView = (((wardrobeEditor.pvView + +d.d) % 4) + 4) % 4;
};
ACTIONS.wdSkin = d => {
  wardrobeEditor.test = wardrobeTestLook();
  wardrobeEditor.test.skin = d.c;
};
ACTIONS.wdColAdd = () => {
  const it = editedWardrobe().items[wardrobeEditor.sel];
  if (it.colors.length < 3) {
    it.colors.push(['Detail', '#F2EEE4']);
    changed();
    commit(true);
    render();
  }
};
ACTIONS.wdColDel = d => {
  const it = editedWardrobe().items[wardrobeEditor.sel];
  it.colors.splice(+d.i, 1);
  if (it.link) {
    delete it.link[String(+d.i + 1)];
  }
  changed();
  commit(true);
  render();
};
studioState.hooks.wardrobe = () => {
  TR_CACHE.clear();
  drawWardrobeEditor();
};
