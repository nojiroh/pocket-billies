'use strict';
/* ================= POCKET BILLIES STUDIO · wardrobe =================
   Trainers' body, hairstyles, faces and clothes. Every item is pieces on the trainer skeleton (front, back and side
   views) in one picture, plus a colour-area mask: red, green and blue mark the parts the game recolours.
   Paint pieces right on the body, add pieces to any bone, set colour areas, prices and shops, and watch the trainer
   walk and pose with it. The body section edits the skin pieces, the skeleton and the body sliders.
   Studio track ST-6: the pixels are painted on the shared pixel canvas (the item's picture, the trainer faint behind
   the piece): its tools, keys, symmetry and palette, and the Studio's one undo. A stroke marks the colour-area mask
   to match, in the same undo step; the Colour area brush paints the mask only. Pieces no longer grow while painting:
   Grow piece gives one room around it. The trainer beside it shows the pieces on the body; drag one there to move it
   on its bone. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { frameStop, frameTask } from '../../game/js/frame-scheduler.js';
import { makeCanvas } from '../../game/js/art.js';
import {
  LOOK_PRESETS,
  bodySliders,
  cleanLook,
  forgetPersonLooks,
  personFrame,
  personRig,
} from '../../game/js/person-art.js';
import { rigMatrices } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelDiffBox, pixelKeyAction, pixelLine } from '../../game/js/logic/pixel-ops.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  colorField,
  commit,
  dialog,
  drawSoon,
  formatThousands,
  grid,
  numberField,
  render,
  sectionShown,
  selectField,
  studioState,
  textField,
  toast,
  uniqueKey,
} from './studio-app.js';
import {
  artStep,
  artSteps,
  drawPixelCanvas,
  pictureImage,
  pixelCanvas,
  pixelCanvasAct,
  pixelCanvasColor,
  pixelCanvasDeselect,
  pixelCanvasFit,
  pixelCanvasPanel,
  pixelCanvasPanelHTML,
  pixelCanvasToolsHTML,
} from './pixel-canvas.js';
import { atlasGet, loadedAtlas, markArt } from './sprites.js';
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
  loadWardrobe: [() => loadWardrobe, v => ((loadWardrobe = v), provide({ loadWardrobe }))],
  mountWardrobe: [() => mountWardrobe, v => (mountWardrobe = v)],
  mountWardrobePainter: [() => mountWardrobePainter, v => (mountWardrobePainter = v)],
  wardrobeAreaBrush: [() => wardrobeAreaBrush, v => (wardrobeAreaBrush = v)],
  wardrobeAreasSVG: [() => wardrobeAreasSVG, v => (wardrobeAreasSVG = v)],
  wardrobeArtChanged: [() => wardrobeArtChanged, v => (wardrobeArtChanged = v)],
  wardrobeBodyHTML: [() => wardrobeBodyHTML, v => (wardrobeBodyHTML = v)],
  wardrobeEditor: [() => wardrobeEditor],
  wardrobeEditorHTML: [() => wardrobeEditorHTML, v => (wardrobeEditorHTML = v)],
  wardrobeGrowPiece: [() => wardrobeGrowPiece, v => (wardrobeGrowPiece = v)],
  wardrobeItemHTML: [() => wardrobeItemHTML, v => (wardrobeItemHTML = v)],
  wardrobeJoints: [() => wardrobeJoints, v => (wardrobeJoints = v)],
  wardrobeMaskArea: [() => wardrobeMaskArea, v => (wardrobeMaskArea = v)],
  wardrobeMaskFollow: [() => wardrobeMaskFollow, v => (wardrobeMaskFollow = v)],
  wardrobeMaskSet: [() => wardrobeMaskSet, v => (wardrobeMaskSet = v)],
  wardrobeOnion: [() => wardrobeOnion, v => (wardrobeOnion = v)],
  wardrobePaths: [() => wardrobePaths],
  wardrobePieceAt: [() => wardrobePieceAt, v => (wardrobePieceAt = v)],
  wardrobePointerPixel: [() => wardrobePointerPixel, v => (wardrobePointerPixel = v)],
  wardrobePreviewHTML: [() => wardrobePreviewHTML, v => (wardrobePreviewHTML = v)],
  wardrobePreviewLoop: [() => wardrobePreviewLoop, v => (wardrobePreviewLoop = v)],
  wardrobeSheets: [() => wardrobeSheets, v => (wardrobeSheets = v)],
  wardrobeStrokeArea: [() => wardrobeStrokeArea],
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
  zoom: 5 /* the trainer beside the canvas */,
  pc: null /* the shared pixel canvas */,
  pcKeep: null /* its zoom, grid, symmetry and palette lock between drawings */,
  filter: 'all',
  pvView: 0,
  pvAct: 'walk',
  drag: null,
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
  const L = cleanLook(wardrobeEditor.test || LOOK_PRESETS[0]);
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
  afterRender(mountWardrobe);
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
        `<button class="lcard ${wardrobeEditor.sel === k ? 'on' : ''}" data-act="wdPick" data-k="${escapeHtml(k)}"><span class="wd-th" data-th="${escapeHtml(k)}"></span><span class="lt"><b>${escapeHtml(it.name)}</b><small>${escapeHtml((slots.find(s => s.id === it.slot) || {}).name || it.slot)}${it.starter ? ' · everyone has it' : it.price ? ` · ${formatThousands(it.price)} Moneys${it.shop && studioState.D.shops[it.shop] ? ' · ' + escapeHtml(studioState.D.shops[it.shop].name) : ''}` : ''}</small></span></button>`
    )
    .join('');
  return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="wdNew">+ New item</button>
   <select id="wdFilter"><option value="all">All items (${Object.keys(W.items).length})</option>${slots.map(s => `<option value="${s.id}" ${wardrobeEditor.filter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
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
  return `<div class="ed-head"><div><small class="mono">${escapeHtml(k)}</small><h2>${escapeHtml(it.name)}</h2>${used.length ? `<small>Worn by ${escapeHtml(used.join(', '))}</small>` : ''}</div><div class="seg-row"><button class="btn subtle" data-act="wdDup">Duplicate</button><button class="btn danger" data-act="wdDel">Delete</button></div></div>
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
     numberField('Price (Moneys)', `${p}.price`, { min: 0, step: 10, opt: 1 }),
     selectField('Sold at', `${p}.shop`, shops, { none: 'Not sold', opt: 1, rr: 1 }),
     checkboxField('Everyone has it from the start', `${p}.starter`, { rr: 1 })
   )
 )}
 ${card('Colour areas', cols + (it.colors.length < 3 ? `<div class="seg-row"><button class="btn sm" data-act="wdColAdd">+ Add a colour area</button></div>` : ''), { sub: 'Players pick a colour for each area; the shading you painted is kept. Paint the areas with the “Colour area” brush below.' })}
 ${card('Pieces and pixels', wardrobeEditorHTML(it), { sub: 'Each piece sits on one bone and moves with it. Paint the item’s picture; the trainer shows faintly behind the piece picked. Beside it the pieces on the body: drag one there to move it.' })}`;
}
function wardrobeBodyHTML() {
  const W = editedWardrobe();
  const sl = W.sliders
    .map(
      (s, i) =>
        `<tr><td><input type="text" data-p="wardrobe.sliders.${i}.name" data-k="text" value="${escapeHtml(s.name)}"></td><td class="mono">${escapeHtml(s.k)}</td><td><input type="number" step=".01" data-p="wardrobe.sliders.${i}.min" data-k="num" value="${s.min}"></td><td><input type="number" step=".01" data-p="wardrobe.sliders.${i}.max" data-k="num" value="${s.max}"></td><td><input type="number" step=".01" data-p="wardrobe.sliders.${i}.def" data-k="num" value="${s.def}"></td></tr>`
    )
    .join('');
  const sk = W.skeleton[wardrobeEditor.view]
    .map(
      (b, i) =>
        `<tr><td class="mono">${escapeHtml(b.n)}</td><td class="mono">${escapeHtml(b.par || '—')}</td><td><input type="number" step=".5" data-p="wardrobe.skeleton.${wardrobeEditor.view}.${i}.at.0" data-k="num" value="${b.at[0]}"></td><td><input type="number" step=".5" data-p="wardrobe.skeleton.${wardrobeEditor.view}.${i}.at.1" data-k="num" value="${b.at[1]}"></td><td><input type="number" step=".1" data-p="wardrobe.skeleton.${wardrobeEditor.view}.${i}.z" data-k="num" value="${b.z}"></td></tr>`
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
  ${bodySliders()
    .map(
      s =>
        `<label class="fld range"><span>${escapeHtml(s.name)} <output>${(+L.body[s.k]).toFixed(2)}</output></span><input type="range" min="${s.min}" max="${s.max}" step=".01" value="${L.body[s.k]}" data-wd-test="${s.k}"></label>`
    )
    .join('')}
  <div class="seg-row"><span class="help">Skin</span>${((editedWardrobe().palettes || {}).skin || []).map(c => `<button class="wd-sw" style="background:${c}" data-act="wdSkin" data-c="${c}" aria-label="${c}"></button>`).join('')}</div></div></div>`;
}
function wardrobeEditorHTML(src) {
  const ps = src.pieces.map((p, i) => [p, i]).filter(([p]) => p.v === wardrobeEditor.view),
    sel = src.pieces[wardrobeEditor.piece];
  if (!sel || sel.v !== wardrobeEditor.view) wardrobeEditor.piece = ps.length ? ps[0][1] : -1;
  const bones = editedWardrobe().skeleton[wardrobeEditor.view].map(b => b.n);
  const tools = pixelCanvasToolsHTML([['area', 'Colour area', 'A']]);
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
 <div class="wd-pieces">${ps.map(([p, i]) => `<button class="chk-chip ${i === wardrobeEditor.piece ? 'on' : ''}" data-act="wdPiece" data-i="${i}">${escapeHtml(p.b)}${p.x ? ' · ' + escapeHtml(p.x) : ''}${p.z != null ? ' · layer ' + p.z : ''}</button>`).join('') || '<span class="help">No pieces in this view yet.</span>'}</div>
 <div class="wd-pc"><div class="sc-bar wd-bar">${tools}<span class="colw"><input type="color" id="wdColor" value="${wardrobeEditor.color}"></span></div>
 ${areas ? `<div class="sc-bar">${areas}<span class="help">Pencil and fill also mark the area you pick here; the eraser clears it.</span></div>` : ''}
 <div class="wd-paint"><div class="px-stage wd-sheet" id="wdStage"></div><div class="wd-onbody"><h4>On the body</h4><div class="wd-stage"><canvas id="wdCv"></canvas></div><div class="seg-row"><button class="seg sm" data-act="wdZoom" data-z="-1" title="Smaller">−</button><button class="seg sm" data-act="wdZoom" data-z="1" title="Bigger">+</button><label class="chk"><input type="checkbox" id="wdOnion" ${wardrobeEditor.pcKeep?.showOnion === false ? '' : 'checked'}> The trainer behind the piece (O)</label></div><p class="help">Drag the piece here to move it on its bone.</p></div><div class="wd-panel" id="wdPanel">${pixelCanvasPanelHTML()}</div></div></div>
 <div class="seg-row wd-pieceops">${P ? `<span class="help">Selected: <b>${escapeHtml(P.b)}</b>, ${P.r[2]}×${P.r[3]} px.</span><label class="fld wd-z"><span>Layer</span><input type="number" step=".05" data-p="${wardrobeEditor.sel === 'body' ? 'wardrobe.body' : 'wardrobe.items.' + wardrobeEditor.sel}.pieces.${wardrobeEditor.piece}.z" data-k="num" data-opt="1" value="${P.z ?? ''}" placeholder="auto"></label><label class="fld wd-z"><span>Shows when</span><select data-p="${wardrobeEditor.sel === 'body' ? 'wardrobe.body' : 'wardrobe.items.' + wardrobeEditor.sel}.pieces.${wardrobeEditor.piece}.x" data-k="sel" data-opt="1">${FACE_EXPRESSIONS.map(([k, n]) => `<option value="${k}" ${(P.x || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="btn sm subtle" data-act="wdGrow" title="Room to paint around it: 2 pixels on every side (the canvas paints inside the picture only)">Grow piece</button><button class="btn sm subtle" data-act="wdPieceX" title="A copy of this piece that only shows with an expression; then repaint it">Copy for an expression</button><button class="btn sm subtle danger" data-act="wdPieceDel">Remove piece</button>` : ''}
  <span class="grow"></span><label class="fld"><span>Add a piece on</span><select id="wdBone">${bones.map(b => `<option>${b}</option>`).join('')}</select></label>
  <button class="btn sm" data-act="wdAdd" data-from="body" title="Starts as the body's shape on that bone, filled with the first colour">Fitted to the body</button><button class="btn sm" data-act="wdAdd" data-from="blank">Blank</button>${wardrobeEditor.view !== 'front' ? `<button class="btn sm subtle" data-act="wdAdd" data-from="front">Copy from front</button>` : ''}</div>`;
}
/* ---------- mount, drawing ---------- */
async function mountWardrobe() {
  if (!wardrobeEditor.loaded) await loadWardrobe();
  if (!sectionShown('wardrobe')) return;
  drawWardrobeThumbs();
  mountWardrobePainter();
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
      if (wardrobeEditor.pc) pixelCanvasColor(wardrobeEditor.pc, wardrobeEditor.color);
    };
  const on = $('#wdOnion');
  if (on)
    on.onchange = () => {
      const P = wardrobeEditor.pc;
      if (P && P.showOnion !== on.checked) pixelCanvasAct(P, 'onion');
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
/* Studio plan T6.3: each thumbnail is a small canvas in its tile, not a PNG encoded for a background */
function drawWardrobeThumbs() {
  $$('[data-th]').forEach(el => {
    const k = el.dataset.th,
      L = cleanLook(LOOK_PRESETS[0]);
    try {
      if (k !== 'body') {
        const it = editedWardrobe().items[k];
        if (!it) return;
        L.wear[it.slot] = k;
      }
      const f = personFrame(L, 'front', 'idle', 0, 0),
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
      el.replaceChildren(c);
    } catch (e) {}
  });
}
function wardrobePreviewLoop(ts) {
  const cv = $('#wdPv');
  if (!cv || !cv.isConnected || !sectionShown('wardrobe')) {
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
    const f = personFrame(L, view, a, ph, ts, mir, wardrobeEditor.pvExpr || undefined),
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
  const L = cleanLook(LOOK_PRESETS[0]);
  for (const s of bodySliders()) L.body[s.k] = s.def;
  L.body.chest = 1;
  const R = personRig(L, view),
    { W } = rigMatrices(R, { x: 0, y: 0, r: 0, sx: 1, sy: 1, act: 'idle', t: 0, ph: 0 }, 'front');
  const J = {};
  for (const b of editedWardrobe().skeleton[view]) if (W[b.n]) J[b.n] = [W[b.n][4] - R.cx, W[b.n][5] - R.base];
  return J;
}
function wardrobeSheets(src) {
  return [loadedAtlas('art/' + src.img), loadedAtlas('art/' + src.mask)];
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
  for (const s of bodySliders()) L.body[s.k] = s.def;
  L.body.chest = Math.max(0.6, L.body.chest);
  const ex = (src.pieces[wardrobeEditor.piece] || {}).x || '',
    hasX = !!ex && src.pieces.some(p => p.v === wardrobeEditor.view && p.x === ex);
  const f = personFrame(L, wardrobeEditor.view, 'idle', 0, 0, 0, ex || undefined);
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
/* ---------- painting: the item's picture on the shared pixel canvas ---------- */
const wardrobePaths = (src = currentWardrobeItem()) => ({
  img: 'art/' + src.img,
  mask: src.mask ? 'art/' + src.mask : '',
});
/* the piece a pixel of the picture is in (this view's first; fill stays inside it) */
function wardrobePieceAt(src, x, y) {
  const inside = p => x >= p.r[0] && y >= p.r[1] && x < p.r[0] + p.r[2] && y < p.r[1] + p.r[3];
  return src.pieces.find(p => p.v === wardrobeEditor.view && inside(p)) || src.pieces.find(inside) || null;
}
/* the mask's area at a pixel: 1 to 3, 0 for none */
function wardrobeMaskArea(d, k) {
  if (d[k + 3] < 128) return 0;
  return d[k] > 127 ? 1 : d[k + 1] > 127 ? 2 : d[k + 2] > 127 ? 3 : 0;
}
function wardrobeMaskSet(d, k, a) {
  const c = MASK_AREA_COLORS[a];
  d[k] = c ? c[0] : 0;
  d[k + 1] = c ? c[1] : 0;
  d[k + 2] = c ? c[2] : 0;
  d[k + 3] = c ? 255 : 0;
}
/* the area a stroke marks: the body's skin is area 1; an item's the one picked (0: a fixed colour) */
const wardrobeStrokeArea = () => (wardrobeEditor.sel === 'body' ? 1 : wardrobeEditor.area);
/* a stroke ended: every pixel it changed marks the mask (cleared where it erased), in the same undo step */
function wardrobeMaskFollow(P, before, after) {
  const src = currentWardrobeItem(),
    { mask } = wardrobePaths(src),
    m = mask && loadedAtlas(mask),
    box = m && pixelDiffBox(before, after);
  if (!box) return [];
  const mb = m.getContext('2d').getImageData(0, 0, m.width, m.height),
    ma = new ImageData(new Uint8ClampedArray(mb.data), m.width, m.height),
    a = wardrobeStrokeArea(),
    [bx, by, bw, bh] = box;
  for (let y = by; y < by + bh && y < m.height; y++)
    for (let x = bx; x < bx + bw && x < m.width; x++) {
      const i = (y * after.width + x) * 4;
      if (
        before.data[i] === after.data[i] &&
        before.data[i + 1] === after.data[i + 1] &&
        before.data[i + 2] === after.data[i + 2] &&
        before.data[i + 3] === after.data[i + 3]
      )
        continue;
      wardrobeMaskSet(ma.data, (y * m.width + x) * 4, after.data[i + 3] ? a : 0);
    }
  m.getContext('2d').putImageData(ma, 0, 0);
  markArt(mask, m);
  return [[mask, mb, ma]];
}
/* the Colour area brush: paints the mask only, where the picture has a pixel; one undo step when let go */
function wardrobeAreaBrush(P, x, y) {
  const src = currentWardrobeItem(),
    { img, mask } = wardrobePaths(src),
    m = mask && loadedAtlas(mask),
    c = loadedAtlas(img);
  if (!m || !c) {
    toast('This piece has no colour-area mask.');
    return true;
  }
  const mx = m.getContext('2d'),
    before = mx.getImageData(0, 0, m.width, m.height),
    work = mx.getImageData(0, 0, m.width, m.height),
    pic = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
    a = wardrobeEditor.sel === 'body' ? 1 : wardrobeEditor.area;
  let last = [x, y];
  const dab = (px, py) => {
    for (const [qx, qy] of pixelLine(last, [px, py])) {
      if (qx < 0 || qy < 0 || qx >= m.width || qy >= m.height || qx >= c.width || qy >= c.height) continue;
      if (!pic[(qy * c.width + qx) * 4 + 3]) continue;
      wardrobeMaskSet(work.data, (qy * m.width + qx) * 4, a);
    }
    last = [px, py];
    mx.putImageData(work, 0, 0);
    drawPixelCanvas(P);
  };
  dab(x, y);
  return {
    move: (P2, fx, fy) => dab(Math.floor(fx), Math.floor(fy)),
    up: () => {
      artStep(mask, before, work);
      wardrobeArtChanged(src);
    },
  };
}
/* the mask's areas on the picked piece, while the Colour area brush is picked (else a light hatch) */
function wardrobeAreasSVG(src, p) {
  const m = src.mask && loadedAtlas('art/' + src.mask);
  if (!m || !p) return '';
  const [rx, ry, rw, rh] = p.r,
    W = Math.min(rw, m.width - rx),
    H = Math.min(rh, m.height - ry);
  if (W <= 0 || H <= 0) return '';
  const d = m.getContext('2d').getImageData(rx, ry, W, H).data,
    full = wardrobeEditor.tool === 'area';
  let g = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = wardrobeMaskArea(d, (y * W + x) * 4);
      if (!a || (!full && (x + y) % 3)) continue;
      const c = MASK_AREA_COLORS[a];
      g += `<rect class="wd-area" x="${rx + x}" y="${ry + y}" width="1" height="1" style="fill:rgb(${c[0]},${c[1]},${c[2]});fill-opacity:${full ? 0.45 : 0.3}"/>`;
    }
  return g;
}
/* the trainer faint behind the picked piece, lined up with it (as the game puts the piece on its bone) */
function wardrobeOnion(src) {
  const p = src.pieces[wardrobeEditor.piece];
  if (!p || p.v !== wardrobeEditor.view) return null;
  const J = wardrobeJoints(p.v)[p.b];
  if (!J) return null;
  const L = wardrobeTestLook();
  for (const s of bodySliders()) L.body[s.k] = s.def;
  L.body.chest = Math.max(0.6, L.body.chest);
  const f = personFrame(L, p.v, 'idle', 0, 0, 0, p.x || undefined);
  return {
    src: f,
    from: [0, 0, f.width, f.height],
    to: [Math.round(p.r[0] - f.ax - J[0] - p.o[0]), Math.round(p.r[1] - f.ay - J[1] - p.o[1])],
    clip: p.r,
  };
}
function mountWardrobePainter() {
  const st = $('#wdStage'),
    src = currentWardrobeItem();
  if (!st || !src) return;
  const keep = wardrobeEditor.pcKeep || {},
    { img } = wardrobePaths(src);
  const P = pixelCanvas(st, {
    ids: 'wdpc',
    tool: wardrobeEditor.tool === 'move' ? 'pen' : wardrobeEditor.tool,
    color: wardrobeEditor.color,
    get: () => loadedAtlas(wardrobePaths().img),
    path: () => wardrobePaths().img,
    boxAt: (x, y) => wardrobePieceAt(currentWardrobeItem(), x, y)?.r || null,
    focusBox: () => currentWardrobeItem().pieces[wardrobeEditor.piece]?.r || null,
    overlay: () => {
      const S = currentWardrobeItem();
      return (
        S.pieces
          .map((p, i) =>
            p.v === wardrobeEditor.view
              ? `<rect class="wd-piece ${i === wardrobeEditor.piece ? 'on' : ''}" x="${p.r[0]}" y="${p.r[1]}" width="${p.r[2]}" height="${p.r[3]}"/>`
              : ''
          )
          .join('') + (wardrobeEditor.sel === 'body' ? '' : wardrobeAreasSVG(S, S.pieces[wardrobeEditor.piece]))
      );
    },
    onion: () => wardrobeOnion(currentWardrobeItem()),
    hostTool: (P, t, x, y) => {
      if (t === 'area') return wardrobeAreaBrush(P, x, y);
      if (t === 'pick') {
        /* the colour, and the area it is in */
        const S = currentWardrobeItem(),
          m = S.mask && loadedAtlas('art/' + S.mask);
        if (m && wardrobeEditor.sel !== 'body' && x >= 0 && y >= 0 && x < m.width && y < m.height) {
          wardrobeEditor.area = wardrobeMaskArea(m.getContext('2d').getImageData(x, y, 1, 1).data, 0);
          $$('[data-act=wdArea]').forEach(b => b.classList.toggle('on', +b.dataset.a === wardrobeEditor.area));
        }
      }
      return false;
    },
    companions: wardrobeMaskFollow,
    changed: () => wardrobeArtChanged(currentWardrobeItem()),
    toolChanged: P => {
      wardrobeEditor.tool = P.tool;
      drawPixelCanvas(P);
    },
    colorChanged: P => {
      wardrobeEditor.color = P.color;
      const c = $('#wdColor');
      if (c) c.value = P.color.toLowerCase();
    },
    drawn: P => {
      wardrobeEditor.pcKeep = {
        zoom: P.zoom,
        showGrid: P.showGrid,
        symMode: P.symMode,
        symShift: P.symShift,
        lock: P.lock,
        showOff: P.showOff,
        showOnion: P.showOnion,
      };
    },
  });
  Object.assign(P, { showOnion: true, showGrid: true }, keep);
  wardrobeEditor.pc = P;
  pixelCanvasPanel(P, $('.wd-pc'));
  const piece = src.pieces[wardrobeEditor.piece];
  if (!keep.zoom) {
    const c = loadedAtlas(img);
    P.zoom = c ? pixelCanvasFit(P, 2, 8) : 4;
    if (piece) P.zoom = Math.max(P.zoom, clamp(Math.floor(160 / Math.max(piece.r[2], piece.r[3])), 2, 12));
  }
  drawPixelCanvas(P);
  /* the picked piece in the middle of the view */
  if (piece)
    requestAnimationFrame(() => {
      if (!st.isConnected) return;
      const Z = P.zoom,
        r = piece.r;
      st.scrollTo({
        left: r[0] * Z - st.clientWidth / 2 + (r[2] * Z) / 2,
        top: r[1] * Z - st.clientHeight / 2 + (r[3] * Z) / 2,
      });
    });
}
function wardrobeArtChanged(src) {
  const { img, mask } = wardrobePaths(src);
  markArt(img, loadedAtlas(img));
  if (mask) markArt(mask, loadedAtlas(mask));
  changed();
  forgetPersonLooks();
  drawWardrobeEditor();
}
/* Grow piece: the piece copied with `m` pixels of room on every side to a new place at the bottom of its picture and
   mask (the old place stays, unused); the pictures, then the piece, are steps of the undo */
function wardrobeGrowPiece(src, P, m) {
  const w = P.r[2] + 2 * m,
    h = P.r[3] + 2 * m;
  if (w > 160 || h > 160) return toast('That piece is as big as a piece can be (160 px).');
  const steps = [];
  let top = 0;
  for (const k of ['img', 'mask']) {
    const path = src[k] && 'art/' + src[k],
      c = path && loadedAtlas(path);
    if (!c) continue;
    const H = c.height,
      n = makeCanvas(Math.max(c.width, w + 2), H + h + 1),
      nx = n.getContext('2d');
    nx.drawImage(c, 0, 0);
    nx.drawImage(c, P.r[0], P.r[1], P.r[2], P.r[3], 1 + m, H + m, P.r[2], P.r[3]);
    steps.push([path, pictureImage(c), pictureImage(n)]);
    markArt(path, n);
    if (k === 'img') top = H;
  }
  artSteps(steps);
  P.r = [1, top, w, h];
  P.o = [P.o[0] - m, P.o[1] - m];
  changed();
  commit(true);
  forgetPersonLooks();
  render();
}
/* the trainer beside the canvas: drag the picked piece to move it on its bone */
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
function bindWardrobeCanvas() {
  const cv = $('#wdCv');
  if (!cv || cv._b) return;
  cv._b = 1;
  cv.addEventListener('pointerdown', ev => {
    const src = currentWardrobeItem(),
      P = src.pieces[wardrobeEditor.piece];
    if (!P || !wardrobePointerPixel(ev)) return;
    cv.setPointerCapture(ev.pointerId);
    wardrobeEditor.drag = { x: ev.clientX, y: ev.clientY, o: P.o.slice(), moved: false };
  });
  cv.addEventListener('pointermove', ev => {
    const D = wardrobeEditor.drag;
    if (!D) return;
    const P = currentWardrobeItem().pieces[wardrobeEditor.piece],
      r = cv.getBoundingClientRect(),
      k = cv.width / r.width / wardrobeEditor.zoom,
      o = [Math.round(D.o[0] + (ev.clientX - D.x) * k), Math.round(D.o[1] + (ev.clientY - D.y) * k)];
    if (o[0] === P.o[0] && o[1] === P.o[1]) return;
    P.o = o;
    D.moved = true;
    forgetPersonLooks();
    drawWardrobeEditor();
  });
  const up = () => {
    const D = wardrobeEditor.drag;
    wardrobeEditor.drag = null;
    if (!D || !D.moved) return;
    changed();
    commit(true);
    if (wardrobeEditor.pc) drawPixelCanvas(wardrobeEditor.pc);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}
/* the canvas's keys while the pointer is over it */
document.addEventListener(
  'keydown',
  ev => {
    const st = $('#wdStage'),
      P = wardrobeEditor.pc;
    if (!st || !P || !P.cv.isConnected || !st.matches(':hover') || $('#dlg').innerHTML) return;
    if (ev.target.closest('input,select,textarea')) return;
    const a = !ev.ctrlKey && !ev.metaKey && ev.key.toLowerCase() === 'a' ? 'tool:area' : pixelKeyAction(ev);
    if (!a || a === 'undo' || a === 'redo') return;
    if (a === 'deselect' ? !pixelCanvasDeselect(P) : !pixelCanvasAct(P, a)) return;
    if (a === 'onion' && $('#wdOnion')) $('#wdOnion').checked = P.showOnion;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  },
  true
);
/* an undo or redo of the item's pictures: the trainer drawn again */
document.addEventListener('studio-art', ev => {
  const src = sectionShown('wardrobe') && editedWardrobe() && currentWardrobeItem();
  if (!src) return;
  const { img, mask } = wardrobePaths(src);
  if (ev.detail.path !== img && ev.detail.path !== mask) return;
  forgetPersonLooks();
  drawWardrobeEditor();
  if (ev.detail.path === mask && wardrobeEditor.pc?.cv.isConnected) drawPixelCanvas(wardrobeEditor.pc);
});
/* ---------- pieces ---------- */
/* a new piece's pictures at the bottom of the item's picture and mask, one undo step (the piece is the next) */
function addPieceRegion(src, c, m) {
  const out = [],
    steps = [];
  for (const [k, pic] of [
    ['img', c],
    ['mask', m],
  ]) {
    if (!src[k]) continue;
    const s = loadedAtlas('art/' + src[k]),
      H = s ? s.height : 0,
      W = Math.max(s ? s.width : 0, pic.width + 2),
      n = makeCanvas(W, H + pic.height + 1),
      x = n.getContext('2d');
    if (s) x.drawImage(s, 0, 0);
    x.drawImage(pic, 1, H);
    steps.push(['art/' + src[k], s ? pictureImage(s) : null, pictureImage(n)]);
    markArt('art/' + src[k], n);
    out.push(H);
  }
  artSteps(steps);
  return [1, out[0], c.width, c.height];
}
ACTIONS.wdAdd = d => {
  const src = currentWardrobeItem(),
    bone = $('#wdBone').value,
    v = wardrobeEditor.view,
    W = editedWardrobe();
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
    const bi = loadedAtlas('art/' + W.body.img),
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
  forgetPersonLooks();
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
  forgetPersonLooks();
  render();
  toast(`Added a ${free[0][1].toLowerCase()} copy. Repaint it, or change when it shows.`);
};
ACTIONS.wdPieceDel = async () => {
  const src = currentWardrobeItem();
  if (!(await ask('Remove this piece? Its pixels stay in the picture file but aren’t used.', 'Remove'))) return;
  src.pieces.splice(wardrobeEditor.piece, 1);
  wardrobeEditor.piece = -1;
  changed();
  commit(true);
  forgetPersonLooks();
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
      `<div class="grid"><label class="fld"><span>Name</span><input id="wnN" value="New jacket"></label><label class="fld"><span>Slot</span><select id="wnS">${W.slots.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></label>
  <label class="fld"><span>Start from</span><select id="wnF"><option value="">Nothing (paint it from scratch)</option>${Object.entries(
    W.items
  )
    .map(([k, it]) => `<option value="${k}">A copy of ${escapeHtml(it.name)}</option>`)
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
      `Delete ${escapeHtml(W.items[k].name)}? People wearing it switch to the default for that slot. The picture files stay in art/trainer/items.`,
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
ACTIONS.wdArea = d => {
  wardrobeEditor.area = +d.a;
  render();
};
ACTIONS.wdGrow = () => {
  const src = currentWardrobeItem(),
    P = src.pieces[wardrobeEditor.piece];
  if (P) wardrobeGrowPiece(src, P, 2);
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
  forgetPersonLooks();
  drawSoon('wardrobeEditor', drawWardrobeEditor); /* Studio plan T6.1: once per frame, not per event */
};
