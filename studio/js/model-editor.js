'use strict';
/* ================= POCKET BILLIES STUDIO · voxel prop builder (v43) =================
   A prop's voxel model is a list of layers: shapes (box, cylinder, sphere, cone, barrel) placed in metres with a
   colour and a texture, raw voxels imported from a MagicaVoxel .vox, and picture layers (a 2D sprite set in the
   model: a sign's face, a flag, a painted front). Everything is edited here with sliders and shows at once on the
   prop editor's turntable, drawn by the game's own renderer. The model lives in the prop's catalogue entry
   (scenery.props.<key>.model), so it saves with the game data; tools/build-vox-props.py wrote the first sixty as files
   and the game reads either. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { makeCanvas } from '../../game/js/art.js';
import { artImage } from '../../game/js/walk-view.js';
import { PROP_MODEL_TEXTURES, invalidatePropModel, loadPropModelRecipe } from '../../game/js/prop-models.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  ask,
  changed,
  checkboxField,
  colorField,
  commit,
  grid,
  numberField,
  rangeField,
  render,
  selectField,
  studioState,
  textField,
  toast,
} from './studio-app.js';
import { fileToCanvas, markArt, pickFile } from './sprites.js';
import { mapEditor, openSceneryPixelEditor, sceneryCatalog } from './map-editor.js';
import { editedProp } from './prop-editor.js';
/* eslint-disable no-func-assign */
expose({
  MODEL_LAYER_KINDS: [() => MODEL_LAYER_KINDS],
  leafSheetSVG: [() => leafSheetSVG, v => (leafSheetSVG = v)],
  leafSheets: [() => leafSheets, v => (leafSheets = v)],
  leavesHTML: [() => leavesHTML, v => (leavesHTML = v)],
  mainPictureColor: [() => mainPictureColor, v => (mainPictureColor = v)],
  modelChanged: [() => modelChanged, v => (modelChanged = v)],
  modelEditor: [() => modelEditor],
  modelEditorHTML: [() => modelEditorHTML, v => ((modelEditorHTML = v), provide({ modelEditorHTML }))],
  modelRecipeOf: [() => modelRecipeOf, v => (modelRecipeOf = v)],
  ownModelRecipe: [() => ownModelRecipe, v => (ownModelRecipe = v)],
});
/* eslint-enable no-func-assign */
provide({ modelEditorHTML });
/* to-module: end */
const modelEditor = { sel: null };
const MODEL_LAYER_KINDS = [
  ['box', 'Box'],
  ['cyl', 'Cylinder'],
  ['sphere', 'Sphere'],
  ['cone', 'Cone'],
  ['barrel', 'Barrel'],
  ['limb', 'Limb (a branch)'],
  ['dome', 'Dome'],
  ['img', 'Picture'],
  ['raw', 'Imported voxels'],
];
function modelRecipeOf(M) {
  if (!M || !M.model) return null;
  if (typeof M.model === 'object') return M.model;
  const r = typeof loadPropModelRecipe === 'function' ? loadPropModelRecipe(M.model) : null;
  return r;
}
/* the recipe is edited in place: a file-based one is pulled into the catalogue entry first */
function ownModelRecipe(M) {
  if (typeof M.model === 'string') {
    const r = modelRecipeOf(M);
    if (!r) return null;
    M.voxFile = M.model;
    M.model = JSON.parse(JSON.stringify(r));
  }
  return M.model;
}
function modelChanged(M) {
  M.voxV = (M.voxV || 0) + 1;
  if (typeof invalidatePropModel === 'function') invalidatePropModel('inline:' + mapEditor.ped + '#' + (M.voxV - 1));
  changed();
  commit(true);
}
function modelEditorHTML(k) {
  const M = sceneryCatalog().props[k],
    b = `scenery.props.${k}.model`;
  if (!M || M.build) return '';
  const rec = modelRecipeOf(M);
  const head = `<h4>3D model</h4>`;
  if (!M.model)
    return `${head}<p class="help">Give this prop a real 3D body: shapes you place with sliders (drawn as low-poly painted with the buildings’ 32 px textures, or as voxels one to a pixel of the art with Engine › World › Props as low-poly off), voxels imported from MagicaVoxel, and pictures set in the model. With the Voxel props dial on, the game draws the model instead of the picture, cel-shaded in the scene's light; the picture stays for the map, the Studio lists and the dial off.</p>
  <div class="seg-row"><button class="btn sm" data-act="vxeNew">Start a model from the picture</button><button class="btn sm subtle" data-act="vxeImport">Import a .vox</button></div>`;
  if (!rec) {
    setTimeout(() => {
      if (mapEditor.ped === k && modelRecipeOf(M)) render();
    }, 400);
    return `${head}<p class="help">Loading ${escapeHtml(String(M.model))}…</p>`;
  }
  if (rec.kind === 'mesh')
    return `<h4>3D model</h4><p class="help">A low-poly model painted with the buildings’ 32 px textures${rec.about ? ' (' + escapeHtml(rec.about) + ')' : ''}. A tool makes its shape, so it isn’t edited here; the turntable shows it as the game draws it.</p>`;
  if (typeof M.model === 'string') ownModelRecipe(M); /* edited in the catalogue entry from here on */
  const L = rec.layers || [],
    names = Object.fromEntries(MODEL_LAYER_KINDS),
    tex = typeof PROP_MODEL_TEXTURES !== 'undefined' ? PROP_MODEL_TEXTURES : [['plain', 'Plain']];
  const rows = L.map((l, i) => {
    const p = `${b}.layers.${i}`,
      on = modelEditor.sel === i,
      kind = l.k || 'box';
    const title = `<div class="vxe-lh"><b>${i + 1}. ${escapeHtml(l.name || names[kind] || kind)}</b><small>${escapeHtml(names[kind] || kind)}</small><span class="grow"></span>
   <button class="btn sm subtle" data-act="vxeSel" data-i="${i}">${on ? 'Close' : 'Edit'}</button><button class="btn sm subtle" data-act="vxeMove" data-i="${i}" data-d="-1" title="Up">↑</button><button class="btn sm subtle" data-act="vxeMove" data-i="${i}" data-d="1" title="Down">↓</button><button class="btn sm subtle" data-act="vxeDup" data-i="${i}" title="Duplicate">⧉</button><button class="btn sm danger subtle" data-act="vxeDel" data-i="${i}">Remove</button></div>`;
    if (!on) return `<div class="vxe-layer ${l.hide ? 'off' : ''}">${title}</div>`;
    const pos = `${rangeField('Across (m)', `${p}.x`, { min: -3, max: 3, step: 0.02, def: 0 })}${rangeField('Depth (m, + is behind)', `${p}.y`, { min: -3, max: 3, step: 0.02, def: 0 })}${rangeField('Up (m)', `${p}.z`, { min: 0, max: 6, step: 0.02, def: 0 })}`;
    let body = '';
    if (kind === 'img')
      body = `${grid(
        textField('Picture', `${p}.img`, { help: 'A path under art/, e.g. scene/props/sign_face.png' }),
        rangeField('Size (metres per 34 px)', `${p}.s`, { min: 0.1, max: 3, step: 0.02, def: 1 }),
        selectField(
          'Facing',
          `${p}.face`,
          [
            ['fixed', 'Stays put (faces the camera at rest)'],
            ['billboard', 'Turns to face the camera'],
          ],
          { opt: 1 }
        ),
        checkboxField('Mirrored', `${p}.flip`, { num: 1 }),
        /* phase 09 batch 1: a tree's leaf clumps, a lantern's glass */
        checkboxField('Casts its shadow', `${p}.shadow`, { num: 1 }),
        selectField(
          'Shadows on it',
          `${p}.recv`,
          [
            ['', 'From everything'],
            ['0', 'None (leaf clumps: the crown shades itself)'],
          ],
          { opt: 1, num: 1 }
        ),
        rangeField('Sways in the wind', `${p}.sway`, { min: 0, max: 2, step: 0.05, def: 1 }),
        rangeField('Glows when the lamps are on', `${p}.glow`, { min: 0, max: 1, step: 0.05, def: 0 }),
        rangeField('Darker (a crown’s core)', `${p}.shade`, { min: 0.4, max: 1, step: 0.02, def: 1 })
      )}${
        l.clip
          ? `<div class="grid">${numberField('Clump: across in the picture (px)', `${p}.clip.0`, { min: 0, max: 400, step: 0.5 })}${numberField('Clump: down in the picture (px)', `${p}.clip.1`, { min: 0, max: 400, step: 0.5 })}${numberField('Clump: radius (px)', `${p}.clip.2`, { min: 2, max: 200, step: 0.5 })}</div>`
          : ''
      }<div class="grid">${pos}</div><div class="seg-row"><button class="btn sm subtle" data-act="vxeImgPick" data-i="${i}">Pick a PNG…</button></div>`;
    else if (kind === 'raw')
      body = `<p class="help">${escapeHtml(String(l.n || '?'))} voxels imported from ${escapeHtml(l.src || 'a .vox')}. Move it with the sliders; its colours are its own.</p><div class="grid">${pos}</div>`;
    else {
      const size =
        kind === 'limb'
          ? `${rangeField('To across (m)', `${p}.x2`, { min: -3, max: 3, step: 0.02, def: 0 })}${rangeField('To depth (m)', `${p}.y2`, { min: -3, max: 3, step: 0.02, def: 0 })}${rangeField('To up (m)', `${p}.z2`, { min: 0, max: 8, step: 0.02, def: 1 })}${rangeField('Radius at the start (m)', `${p}.r`, { min: 0.005, max: 1, step: 0.005, def: 0.1 })}${rangeField('Radius at the end (m)', `${p}.r1`, { min: 0.005, max: 1, step: 0.005, def: 0.07 })}`
          : kind === 'box'
            ? `${rangeField('Width (m)', `${p}.w`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}${rangeField('Depth (m)', `${p}.d`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}${rangeField('Height (m)', `${p}.h`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}`
            : kind === 'sphere'
              ? rangeField('Radius (m)', `${p}.r`, { min: 0.05, max: 3, step: 0.02, def: 0.3 })
              : `${rangeField('Radius (m)', `${p}.r`, { min: 0.03, max: 3, step: 0.01, def: 0.3 })}${numberField('Depth radius (m)', `${p}.ry`, { opt: 1, min: 0.03, max: 3, step: 0.01, help: 'Empty: round. Set it for an oval, or a wheel seen from the side.' })}${rangeField('Height (m)', `${p}.h`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}${kind === 'cone' ? rangeField('Radius at the top (m)', `${p}.r1`, { min: 0, max: 3, step: 0.01, def: 0 }) : ''}${kind === 'barrel' ? rangeField('Bulge', `${p}.bulge`, { min: 0, max: 0.4, step: 0.01, def: 0.15 }) : ''}${numberField('Sides', `${p}.sides`, { opt: 1, min: 3, max: 32, step: 1, help: 'Empty: as many as its size needs. Few for a faceted rock.' })}${kind === 'sphere' || kind === 'dome' ? numberField('Bands', `${p}.rings`, { opt: 1, min: 2, max: 16, step: 1 }) : ''}${rangeField('Lumpy', `${p}.lump`, { min: 0, max: 0.6, step: 0.01, def: 0 })}${checkboxField('Flat faces', `${p}.facet`, { num: 1 })}`;
      body = `<div class="grid">${selectField(
        'Shape',
        `${p}.k`,
        MODEL_LAYER_KINDS.filter(q => !['img', 'raw'].includes(q[0]))
      )}${textField('Name', `${p}.name`, { opt: 1 })}${colorField('Colour', `${p}.col`)}${selectField('Texture', `${p}.tex`, tex, { opt: 1 })}${checkboxField('Hidden', `${p}.hide`, { num: 1 })}</div><div class="grid">${pos}</div><div class="grid">${size}</div>`;
    }
    /* alpha 0.4: a part that turns (a propeller, a windmill's sails, a wheel): about which way, through which point, how fast */
    if (kind !== 'img') {
      const sp = l.spin;
      body +=
        `<div class="seg-row"><button class="btn sm ${sp ? '' : 'subtle'}" data-act="vxeSpin" data-i="${i}">${sp ? 'It turns ✓' : 'Make it turn'}</button></div>` +
        (sp
          ? `<div class="grid">${selectField('Turns about', `${p}.spin.axis`, [
              ['x', 'Across (left–right)'],
              ['y', 'Depth (front–back)'],
              ['z', 'Up (like a carousel)'],
            ])}${rangeField('Turns a second', `${p}.spin.rps`, { min: -4, max: 4, step: 0.1, def: 1.5 })}${rangeField('Pivot across (m)', `${p}.spin.x`, { min: -3, max: 3, step: 0.02, def: 0 })}${rangeField('Pivot depth (m)', `${p}.spin.y`, { min: -3, max: 3, step: 0.02, def: 0 })}${rangeField('Pivot up (m)', `${p}.spin.z`, { min: 0, max: 6, step: 0.02, def: 0 })}</div>`
          : '');
    }
    return `<div class="vxe-layer on ${l.hide ? 'off' : ''}">${title}${body}</div>`;
  }).join('');
  return `${head}${leavesHTML(M, L)}<p class="help">${L.length} layer${L.length === 1 ? '' : 's'}: low-poly with the buildings’ 32 px textures (wood is planks, stone is stone blocks, hay is thatch…), or voxels one to a pixel of the art with Props as low-poly off. Across is left–right, depth is toward the back, up is from the ground at the prop's base point. Everything shows on the turntable as you drag.</p>
  ${rows}<div class="seg-row vxe-add"><span class="help">Add:</span>${['box', 'cyl', 'sphere', 'cone', 'barrel', 'limb', 'dome'].map(q => `<button class="btn sm" data-act="vxeAdd" data-k="${q}">+ ${names[q]}</button>`).join('')}<button class="btn sm" data-act="vxeAdd" data-k="img">+ Picture</button><button class="btn sm subtle" data-act="vxeImport">Import a .vox…</button></div>
  <div class="seg-row"><button class="btn sm subtle" data-act="vxeExport">Download as .json</button><button class="btn sm subtle danger" data-act="vxeOff">Remove the model</button></div>`;
}
/* phase 09 batch 1: a tree's or bush's leaves are one picture, its crown as drawn; the clumps are circles cut from it
   (picture layers with a clip) and the core is the whole picture a shade darker. This section shows each leaf
   picture the model uses, and those its variants swap in (the autumn oak's), with the clumps drawn on it, and opens
   it in the pixel editor or replaces it. Painting it changes every clump at once, on the turntable as you paint. */
function leafSheets(M, L) {
  /* a prop whose model swaps its pictures (the autumn oak: the oak's model, its own leaves) shows its own leaves */
  const sw = path => (M.swap && M.swap[path]) || path,
    own = [...new Set(L.filter(l => l.k === 'img' && (l.clip || l.shade) && l.img).map(l => sw(l.img)))],
    out = own.map(path => ({
      path,
      who: 'This prop',
      clips: L.filter(l => sw(l.img) === path && l.clip).map(l => l.clip),
    }));
  for (const V of M.variants || [])
    for (const [a, b] of Object.entries(V.swap || {}))
      if (own.includes(a) && !out.some(o => o.path === b))
        out.push({ path: b, who: V.name || 'A variant', clips: out.find(o => o.path === a).clips });
  return out;
}
function leafSheetSVG(path, clips) {
  const im = artImage(path);
  if (!im || !(im.naturalWidth || im.width)) {
    setTimeout(() => render(), 500);
    return '<p class="help">Loading the picture…</p>';
  }
  const w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height,
    c = makeCanvas(w, h);
  c.getContext('2d').drawImage(im, 0, 0);
  const z = Math.max(1, Math.min(4, Math.floor(260 / Math.max(w, h))));
  return `<svg class="leaf-sheet" width="${w * z}" height="${h * z}" viewBox="0 0 ${w} ${h}" style="image-rendering:pixelated;background:repeating-conic-gradient(#0001 0 25%,#0000 0 50%) 0 0/8px 8px"><image href="${c.toDataURL()}" width="${w}" height="${h}"/>${clips
    .map(
      q =>
        `<circle cx="${q[0]}" cy="${q[1]}" r="${q[2]}" fill="none" stroke="#fff" stroke-width="${0.6}" stroke-dasharray="2 2" opacity=".85"/>`
    )
    .join('')}</svg>`;
}
function leavesHTML(M, L) {
  const S = leafSheets(M, L);
  if (!S.length) return '';
  return `<div class="vxe-leaves"><h4>Leaves</h4><p class="help">The leaves are one picture per look: the crown as drawn. Each dashed circle is a clump cut from it; paint the picture and every clump changes with it. A clump's circle can be moved in its picture layer below.</p>${S.map(
    o =>
      `<div class="vxe-leaf"><b>${escapeHtml(o.who)}</b> <small>${escapeHtml(o.path)}</small><div>${leafSheetSVG(o.path, o.clips)}</div><div class="seg-row"><button class="btn sm" data-act="vxeLeafPaint" data-path="${escapeHtml(o.path)}">Paint the leaves</button><button class="btn sm subtle" data-act="vxeLeafReplace" data-path="${escapeHtml(o.path)}">Replace from PNG…</button></div></div>`
  ).join('')}</div>`;
}
ACTIONS.vxeLeafPaint = d =>
  openSceneryPixelEditor('art/' + d.path, { kind: 'prop', k: mapEditor.ped, layer: 'leaves' });
ACTIONS.vxeLeafReplace = async d => {
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f);
  if (c.width > 400 || c.height > 400) return toast('Keep pictures under 400×400 pixels.', 'err');
  markArt('art/' + d.path, c);
  render();
};
/* a first model: a box the size of the picture, a third as deep */
ACTIONS.vxeNew = () => {
  const M = editedProp();
  if (!M) return;
  const im = artImage(M.img),
    ppu = sceneryCatalog().ppu || 34,
    w = im ? (im.naturalWidth || im.width) / ppu : 1,
    h = im ? (im.naturalHeight || im.height) / ppu : 1;
  M.model = {
    vpm: 32,
    layers: [
      {
        k: 'box',
        name: 'body',
        x: 0,
        y: 0,
        z: 0,
        w: +w.toFixed(2),
        d: +Math.max(0.2, w * 0.35).toFixed(2),
        h: +h.toFixed(2),
        col: mainPictureColor(M) || '#A08060',
        tex: 'plain',
      },
    ],
  };
  modelEditor.sel = 0;
  modelChanged(M);
  render();
};
function mainPictureColor(M) {
  try {
    const im = artImage(M.img);
    if (!im) return null;
    const c = makeCanvas(8, 8),
      x = c.getContext('2d');
    x.drawImage(im, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3] > 100) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    if (!n) return null;
    const h = v =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  } catch (e) {
    return null;
  }
}
ACTIONS.vxeAdd = d => {
  const M = editedProp(),
    rec = ownModelRecipe(M);
  if (!rec) return;
  const L = rec.layers || (rec.layers = []),
    top = L.reduce((m, l) => Math.max(m, (l.z || 0) + (l.h || (l.r ? 2 * l.r : 0) || 0)), 0),
    k = d.k;
  const base = {
    box: { k: 'box', x: 0, y: 0, z: top, w: 0.5, d: 0.5, h: 0.5 },
    cyl: { k: 'cyl', x: 0, y: 0, z: top, r: 0.25, h: 0.5 },
    sphere: { k: 'sphere', x: 0, y: 0, z: top, r: 0.25 },
    cone: { k: 'cone', x: 0, y: 0, z: top, r: 0.3, r1: 0, h: 0.5 },
    barrel: { k: 'barrel', x: 0, y: 0, z: top, r: 0.3, h: 0.8, bulge: 0.15 },
    limb: { k: 'limb', x: 0, y: 0, z: top, x2: 0.4, y2: 0, z2: top + 1, r: 0.1, r1: 0.06 },
    dome: { k: 'dome', x: 0, y: 0, z: top, r: 0.6, h: 0.5 },
    img: { k: 'img', img: M.img, x: 0, y: -0.01, z: 0, s: 1, face: 'fixed' },
  }[k];
  if (!base) return;
  if (k !== 'img') {
    base.col = (L.find(l => l.col) || {}).col || '#A08060';
    base.tex = 'plain';
  }
  L.push(base);
  modelEditor.sel = L.length - 1;
  modelChanged(M);
  render();
};
ACTIONS.vxeSel = d => {
  modelEditor.sel = modelEditor.sel === +d.i ? null : +d.i;
  render();
};
ACTIONS.vxeMove = d => {
  const M = editedProp(),
    rec = ownModelRecipe(M);
  if (!rec) return;
  const i = +d.i,
    j = i + +d.d;
  if (j < 0 || j >= rec.layers.length) return;
  [rec.layers[i], rec.layers[j]] = [rec.layers[j], rec.layers[i]];
  if (modelEditor.sel === i) modelEditor.sel = j;
  modelChanged(M);
  render();
};
ACTIONS.vxeDup = d => {
  const M = editedProp(),
    rec = ownModelRecipe(M);
  if (!rec) return;
  const i = +d.i,
    c = JSON.parse(JSON.stringify(rec.layers[i]));
  if (c.k !== 'img' && c.k !== 'raw') c.x = +((c.x || 0) + 0.1).toFixed(2);
  rec.layers.splice(i + 1, 0, c);
  modelEditor.sel = i + 1;
  modelChanged(M);
  render();
};
ACTIONS.vxeDel = d => {
  const M = editedProp(),
    rec = ownModelRecipe(M);
  if (!rec) return;
  rec.layers.splice(+d.i, 1);
  modelEditor.sel = null;
  modelChanged(M);
  render();
};
ACTIONS.vxeOff = async () => {
  const M = editedProp();
  if (
    !M ||
    !(await ask(
      'Draw this prop as its picture again? The model is removed from the game data (a file written by tools/build-vox-props.py stays on disk).',
      'Remove'
    ))
  )
    return;
  delete M.model;
  delete M.voxV;
  modelEditor.sel = null;
  changed();
  commit(true);
  render();
};
ACTIONS.vxeExport = () => {
  const M = editedProp(),
    rec = modelRecipeOf(M);
  if (!rec) return;
  const b = new Blob([JSON.stringify(rec)], { type: 'application/json' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `${mapEditor.ped}.json`;
  a.click();
};
ACTIONS.vxeImgPick = async d => {
  const M = editedProp(),
    rec = ownModelRecipe(M),
    k = mapEditor.ped;
  if (!rec) return;
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f);
  if (c.width > 400 || c.height > 400) return toast('Keep pictures under 400×400 pixels.', 'err');
  let n = 1;
  while (studioState.artDirty.has(`art/scene/props/${k}_vox${n}.png`) || artImage(`scene/props/${k}_vox${n}.png`)) n++;
  const path = `scene/props/${k}_vox${n}.png`;
  markArt('art/' + path, c);
  rec.layers[+d.i].img = path;
  modelChanged(M);
  render();
};
/* MagicaVoxel import: SIZE + XYZI + RGBA chunks of the first model; the voxels become one raw layer, centred on the base point */
ACTIONS.vxeImport = async () => {
  const M = editedProp();
  if (!M) return;
  const f = await pickFile('.vox');
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer()),
    dv = new DataView(buf.buffer);
  if (String.fromCharCode(...buf.slice(0, 4)) !== 'VOX ') return toast('That is not a .vox file.', 'err');
  let i = 8,
    size = null,
    xyzi = null,
    pal = null;
  while (i + 12 <= buf.length) {
    const tag = String.fromCharCode(...buf.slice(i, i + 4)),
      n = dv.getInt32(i + 4, true),
      body = i + 12;
    if (tag === 'SIZE' && !size)
      size = [dv.getInt32(body, true), dv.getInt32(body + 4, true), dv.getInt32(body + 8, true)];
    else if (tag === 'XYZI' && !xyzi) {
      const cnt = dv.getInt32(body, true);
      xyzi = [];
      for (let j = 0; j < cnt; j++)
        xyzi.push([buf[body + 4 + j * 4], buf[body + 5 + j * 4], buf[body + 6 + j * 4], buf[body + 7 + j * 4]]);
    } else if (tag === 'RGBA') {
      pal = [];
      for (let j = 0; j < 256; j++) pal.push([buf[body + j * 4], buf[body + j * 4 + 1], buf[body + j * 4 + 2]]);
    }
    i = body + n;
  }
  if (!xyzi) return toast('No voxels found in that file.', 'err');
  if (!pal) {
    pal = [];
    for (let j = 0; j < 256; j++) pal.push([200, 200, 200]);
  }
  const cx = Math.round((size ? size[0] : 0) / 2),
    cy = Math.round((size ? size[1] : 0) / 2);
  let s = '';
  for (const [x, y, z, c] of xyzi) {
    const col = pal[c - 1] || [200, 200, 200];
    s += String.fromCharCode(x, y, z, col[0], col[1], col[2]);
  }
  const rec =
    M.model && typeof M.model === 'object' ? M.model : ownModelRecipe(M) || (M.model = { vpm: 32, layers: [] });
  rec.layers.push({
    k: 'raw',
    name: f.name.replace(/\.vox$/i, ''),
    src: f.name,
    n: xyzi.length,
    vpm: 32,
    x: 0,
    y: 0,
    z: 0,
    ox: -cx,
    oy: -cy,
    oz: 0,
    data: btoa(s),
  });
  modelEditor.sel = rec.layers.length - 1;
  modelChanged(M);
  render();
  toast(`${xyzi.length} voxels imported (${size ? size.join('×') : '?'}).`);
};
/* any slider or field of the model: rebuild the mesh so the turntable follows */
document.addEventListener('input', ev => {
  const t = ev.target;
  if (!t || !t.dataset || !t.dataset.p || !mapEditor.ped) return;
  if (!t.dataset.p.startsWith(`scenery.props.${mapEditor.ped}.model`)) return;
  const M = editedProp();
  if (!M) return;
  clearTimeout(modelEditor.t);
  modelEditor.t = setTimeout(() => {
    M.voxV = (M.voxV || 0) + 1;
    if (typeof invalidatePropModel === 'function') invalidatePropModel('inline:' + mapEditor.ped + '#' + (M.voxV - 1));
  }, 60);
});

/* alpha 0.4: a layer that turns, or stops turning */
ACTIONS.vxeSpin = d => {
  const M = sceneryCatalog().props[mapEditor.ped],
    rec = M && ownModelRecipe(M);
  if (!rec) return;
  const l = rec.layers[+d.i];
  if (!l) return;
  if (l.spin) delete l.spin;
  else
    l.spin = {
      x: +(l.x || 0),
      y: +(l.y || 0),
      z: +((l.z || 0) + (l.h || 2 * (l.r || 0.3)) / 2).toFixed(2),
      axis: 'x',
      rps: 1.5,
    };
  modelChanged(M);
  render();
};
