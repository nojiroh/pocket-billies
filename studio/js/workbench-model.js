'use strict';
/* ================= POCKET BILLIES STUDIO · Art workbench, Model mode (studio track ST-7) =================
   A 3D model from Blender, Blockbench, MagicaVoxel or an AI generator made into a prop: drop a .glb, a .gltf (with its
   .bin and pictures), an .obj (with its .mtl and pictures) or a .vox anywhere on the Studio, or open one here.
   - Read by hand in the logic (logic/model-gltf.js, model-obj.js, model-vox.js) and made into the game's mesh format
     v2 (logic/model-mesh.js): its own texture, parts with their pivots, spins and joints. Height (or scale), the turn,
     which way is up, standing on the ground and centred are settings; changing one builds it again from the file.
   - Shown in the game's own renderer on a turntable (a scene and a prop of its own, never saved: __modelpv and
     __model_pv), drawn as the game draws the prop.
   - The checks: texel density (the art is 32 px/m; "Resample to 32 px/m" scales the texture by nearest pixel), a
     palette texture (most faces one colour: "Bake to 32 px/m" gives it a texture of our own, logic/model-bake.js),
     more than 2,000 triangles.
   - Parts: each part can spin (an axis and turns a second, as the airship's propellers) or keep a joint (an axis and
     turn limits, kept for posing); Blender's custom properties (extras.pb) fill them in on import.
   - Write to game: the model (art/scene/models/<key>.json, a text file Save and Propose changes send), its texture
     (<key>.png beside it), its picture for 3D off and the far view (art/scene/props/<key>.png, baked as RP-1's props
     are) and the prop in the scenery catalogue; three steps of the undo. A .vox becomes a voxel prop as the Props
     section's import makes it.
   - The texture is painted on the shared pixel canvas once the model is written (so every stroke is a step of the
     Studio's undo and saves with it), the faces' outlines over it; clicking the model's picture beside it finds the
     texel. Props' 3D model panel opens a written model here ("Open in Model mode"). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { frameStop, frameTask } from '../../game/js/frame-scheduler.js';
import { artLoad, makeCanvas, setArtLoad } from '../../game/js/art.js';
import { setWalkData, walkData, walkView } from '../../game/js/walk-view.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { buildingArt } from '../../game/js/buildings.js';
import { invalidatePropModel, loadPropModelRecipe, propModelState } from '../../game/js/prop-models.js';
import { escapeHtml } from './game-stand-ins.js';
import { readGltf } from '../../game/js/logic/model-gltf.js';
import { readObj } from '../../game/js/logic/model-obj.js';
import {
  MODEL_DENSITY_BINS,
  modelAtlasPixels,
  modelBuild,
  modelCheckLines,
  modelDensity,
  modelFaces,
  modelResample,
} from '../../game/js/logic/model-mesh.js';
import { voxParse, voxRawLayer, voxSource } from '../../game/js/logic/model-vox.js';
import { modelBakePicture, modelBakeTexture } from '../../game/js/logic/model-bake.js';
import {
  ACTIONS,
  afterRender,
  ask,
  changed,
  commit,
  openSection,
  paneRoot,
  render,
  sectionShown,
  studioState,
  toast,
} from './studio-app.js';
import {
  artSteps,
  drawPixelCanvas,
  pictureImage,
  pixelCanvas,
  pixelCanvasFit,
  pixelCanvasPanel,
  pixelCanvasPanelHTML,
  pixelCanvasToolsHTML,
  textStep,
} from './pixel-canvas.js';
import { ATLAS_CACHE, atlasGet, loadedAtlas, markArt, textAsLoaded, textGet } from './sprites.js';
import { mapEditor, sceneryArtPaths, sceneryCatalog } from './map-editor.js';
import { wbPixelsCanvas, workbench } from './workbench.js';
/* eslint-disable no-func-assign */
expose({
  WBM_AXES: [() => WBM_AXES],
  WBM_EXT: [() => WBM_EXT],
  WBM_KEY: [() => WBM_KEY],
  WBM_PV: [() => WBM_PV],
  wbModel: [() => wbModel],
  wbModelFiles: [() => wbModelFiles, v => ((wbModelFiles = v), provide({ wbModelFiles }))],
  wbModelOpenProp: [() => wbModelOpenProp, v => (wbModelOpenProp = v)],
  wbModelSection: [() => wbModelSection, v => ((wbModelSection = v), provide({ wbModelSection }))],
  wbmApplyEdits: [() => wbmApplyEdits, v => (wbmApplyEdits = v)],
  wbmAxisKey: [() => wbmAxisKey],
  wbmBuild: [() => wbmBuild, v => (wbmBuild = v)],
  wbmChecked: [() => wbmChecked, v => (wbmChecked = v)],
  wbmDecode: [() => wbmDecode, v => (wbmDecode = v)],
  wbmFreeKey: [() => wbmFreeKey, v => (wbmFreeKey = v)],
  wbmHistHTML: [() => wbmHistHTML, v => (wbmHistHTML = v)],
  wbmInput: [() => wbmInput, v => (wbmInput = v)],
  wbmIsModelFile: [() => wbmIsModelFile],
  wbmMount: [() => wbmMount, v => (wbmMount = v)],
  wbmMountPreview: [() => wbmMountPreview, v => (wbmMountPreview = v)],
  wbmMountTexture: [() => wbmMountTexture, v => (wbmMountTexture = v)],
  wbmOpenHTML: [() => wbmOpenHTML, v => (wbmOpenHTML = v)],
  wbmPartsHTML: [() => wbmPartsHTML, v => (wbmPartsHTML = v)],
  wbmPickDraw: [() => wbmPickDraw, v => (wbmPickDraw = v)],
  wbmPixels: [() => wbmPixels],
  wbmPreview: [() => wbmPreview],
  wbmPreviewEntry: [() => wbmPreviewEntry],
  wbmRead: [() => wbmRead, v => (wbmRead = v)],
  wbmRegister: [() => wbmRegister, v => (wbmRegister = v)],
  wbmScene: [() => wbmScene, v => (wbmScene = v)],
  wbmShown: [() => wbmShown],
  wbmSideHTML: [() => wbmSideHTML, v => (wbmSideHTML = v)],
  wbmTexPath: [() => wbmTexPath],
  wbmTextureHTML: [() => wbmTextureHTML, v => (wbmTextureHTML = v)],
  wbmWrite: [() => wbmWrite, v => (wbmWrite = v)],
});
/* eslint-enable no-func-assign */
provide({ wbModelFiles, wbModelSection });
/* to-module: end */
const WBM_EXT = /\.(glb|gltf|obj|vox)$/i;
const WBM_PV = 'scene/models/__model_pv';
const WBM_KEY = /^[a-z][a-z0-9_]{1,47}$/;
const wbModel = {
  files: null /* file name -> bytes, the model and what lies beside it */,
  main: '',
  kind: '' /* 'import' (a file), 'vox', or 'saved' (a written v2 model opened from Props) */,
  src: null,
  vox: null,
  pix: [] /* each source picture's pixels (null if it couldn't be read) */,
  o: { height: 0, scale: 1, yaw: 0, upZ: false, ground: true, centre: true },
  key: '',
  name: '',
  rec: null,
  warnings: [],
  tex: null /* the texture now: a canvas */,
  D: null /* the density check */,
  edits: {} /* a part's spin and joint set here, by its name */,
  locked: '' /* 'resampled' or 'baked': building again from the file drops it */,
  view: 'model',
  pickYaw: 0,
  pick: null,
  hl: null /* the texel found by clicking the model */,
  written: '' /* the key once written */,
  pending: false /* changed since it was written */,
  spin: true,
  err: '',
};
const wbmShown = () => workbench.mode === 'model' && studioState.sec === 'workbench';
/* the written texture, painted in place; not while the model has changes not written yet (a bake, a rebuild, a part's
   spin: the texture or its faces differ from the written ones) */
const wbmTexPath = () =>
  wbModel.written && !wbModel.pending && wbModel.rec && wbModel.rec.tex ? 'art/' + wbModel.rec.tex : '';
const wbmPixels = c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  return { width: c.width, height: c.height, data: d.data };
};
/** the bytes of every file dropped or picked */
async function wbmRead(list) {
  const out = {};
  for (const f of list) out[f.name] = new Uint8Array(await f.arrayBuffer());
  return out;
}
async function wbmDecode(im) {
  if (!im.bytes || !im.bytes.length) return null;
  try {
    const bm = await createImageBitmap(new Blob([im.bytes], { type: im.mime }));
    const c = makeCanvas(bm.width, bm.height);
    c.getContext('2d').drawImage(bm, 0, 0);
    return wbmPixels(c);
  } catch {
    return null;
  }
}
/** a free prop key from a file name */
function wbmFreeKey(base) {
  const props = sceneryCatalog().props;
  let k =
    String(base)
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^[^a-z]+|_+$/g, '')
      .slice(0, 40) || 'model';
  if (!/^[a-z]/.test(k)) k = 'model_' + k;
  let n = k,
    i = 2;
  while (props[n]) n = `${k}_${i++}`;
  return n;
}
/* ---------- in ---------- */
/** files dropped or picked: the first model among them is read, the rest are what it names beside it */
async function wbModelFiles(list) {
  const files = await wbmRead(list),
    names = Object.keys(files),
    main =
      names.find(n => /\.glb$/i.test(n)) ||
      names.find(n => /\.gltf$/i.test(n)) ||
      names.find(n => /\.obj$/i.test(n)) ||
      names.find(n => /\.vox$/i.test(n));
  if (!main) return toast('Drop a .glb, .gltf, .obj or .vox (with the files it needs beside it).', 'err');
  Object.assign(wbModel, {
    files,
    main,
    kind: /\.vox$/i.test(main) ? 'vox' : 'import',
    src: null,
    vox: null,
    pix: [],
    o: { height: 0, scale: /\.vox$/i.test(main) ? 1 / 32 : 1, yaw: 0, upZ: false, ground: true, centre: true },
    key: wbmFreeKey(main),
    name: main.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '),
    edits: {},
    locked: '',
    view: 'model',
    hl: null,
    written: '',
    pending: false,
    err: '',
  });
  try {
    if (wbModel.kind === 'vox') {
      wbModel.vox = voxParse(files[main]);
      wbModel.src = voxSource(wbModel.vox, wbModel.key);
    } else {
      wbModel.src = /\.obj$/i.test(main) ? readObj(files, main) : readGltf(files, main);
      wbModel.pix = await Promise.all(wbModel.src.images.map(wbmDecode));
      wbModel.src.images.forEach((im, i) => {
        if (im.bytes.length && !wbModel.pix[i]) wbModel.src.warnings.push(`${im.name} couldn't be read as a picture.`);
      });
    }
    if (wbModel.src.unitsHint === 'blockbench') wbModel.o.scale = 1 / 16;
    wbmBuild();
  } catch (e) {
    wbModel.err = e.message;
    wbModel.rec = null;
  }
  workbench.mode = 'model';
  if (!sectionShown('workbench')) openSection('workbench');
  else render();
}
/** the model built again from its file with the settings and the parts' edits */
function wbmBuild() {
  if (!wbModel.src) return;
  const sizes = wbModel.pix.map(p => (p ? [p.width, p.height] : null)),
    B = modelBuild(wbModel.src, sizes, {
      ...wbModel.o,
      height: wbModel.o.height > 0 ? wbModel.o.height : undefined,
      key: wbModel.key,
      name: wbModel.name,
      src: wbModel.main,
    });
  wbModel.rec = B.rec;
  wbModel.warnings = B.warnings;
  wbModel.pending = !!wbModel.written;
  wbModel.locked = '';
  wbModel.tex = null;
  if (B.atlas) {
    const P = modelAtlasPixels(B.atlas, wbModel.pix);
    wbModel.tex = wbPixelsCanvas(P);
  }
  wbmApplyEdits();
  wbmChecked();
}
/** a part's spin and joint as set here, on every piece of it (a big part is cut in pieces of 65,535 vertices) */
function wbmApplyEdits() {
  for (const p of wbModel.rec.parts || []) {
    const e = wbModel.edits[p.name.replace(/ \(\d+\)$/, '')];
    if (!e) continue;
    if ('spin' in e) {
      if (e.spin) p.spin = e.spin;
      else delete p.spin;
    }
    if ('joint' in e) {
      if (e.joint) p.joint = e.joint;
      else delete p.joint;
    }
  }
}
/** the checks and the preview after any change */
function wbmChecked() {
  const R = wbModel.rec;
  wbModel.D = wbModel.tex
    ? modelDensity(modelFaces(R), wbModel.tex.width, wbModel.tex.height, wbmPixels(wbModel.tex))
    : null;
  wbModel.pick = null;
  wbmRegister();
}
/* ---------- the preview: a prop and a scene of its own, never saved ---------- */
const wbmPreviewEntry = () => {
  const R = wbModel.rec;
  if (!R) return null;
  return {
    name: wbModel.name || 'Model',
    img: WBM_PV + '_pic.png',
    ox: wbModel.picOx || 0,
    oy: wbModel.picOy || 0,
    shadow: 1,
    sway: 0,
    flat: 0,
    model: WBM_PV + '.json',
    ppm: 32,
    vary: { rot: 0, lean: 0 },
  };
};
function wbmRegister() {
  const R = wbModel.rec;
  if (!R) return;
  const pv = { ...R, tex: R.tex || wbModel.tex ? WBM_PV + '.png' : undefined };
  if (!pv.tex) delete pv.tex;
  if (wbModel.tex) ATLAS_CACHE.set('art/' + WBM_PV + '.png', wbModel.tex);
  const pic = modelBakePicture(R, wbModel.tex ? wbmPixels(wbModel.tex) : null);
  wbModel.picOx = pic.ox;
  wbModel.picOy = pic.oy;
  wbModel.picture = wbPixelsCanvas(pic.pixels);
  ATLAS_CACHE.set('art/' + WBM_PV + '_pic.png', wbModel.picture);
  propModelState.recipes.set(WBM_PV + '.json', pv);
  invalidatePropModel(WBM_PV + '.json', true);
  if (wbmPreview.sc) wbmPreview.sc.props[0].k = '__model_pv';
}
const wbmPreview = { sc: null };
/* the preview's pictures live only in the Studio (ATLAS_CACHE): never fetched */
{
  const base = artLoad;
  setArtLoad(paths => base(paths.filter(p => !p.startsWith(WBM_PV))));
}
{
  const base = walkData;
  setWalkData(() => {
    const d = base();
    if (!wbModel.rec || !wbmPreview.sc) return d;
    return {
      ...d,
      scenes: Object.assign({}, d.scenes, { __modelpv: wbmPreview.sc }),
      sc: { ...d.sc, props: Object.assign({}, d.sc.props, { __model_pv: wbmPreviewEntry() }) },
    };
  });
}
function wbmScene() {
  const C = sceneryCatalog(),
    T = C.terrains,
    tk = Object.keys(T).find(c => /grass/i.test(T[c].name)) || Object.keys(T)[0] || 'g',
    B = wbModel.rec ? wbModel.rec.box : [-1, 0, -1, 1, 2, 1],
    wide = Math.max(B[3] - B[0], B[5] - B[2]),
    tall = B[4] - B[1],
    w = Math.max(12, Math.ceil(wide + 8));
  return {
    name: 'Model turntable',
    w,
    h: 12,
    edge: tk,
    tiles: Array.from({ length: 12 }, () => tk.repeat(w)),
    props: [{ k: '__model_pv', x: w / 2, z: 6.5 }],
    hub: [w / 2, 4.2],
    exits: [],
    folk: 0,
    indoor: 0,
    wind: 1,
    sky: ['#8CC6E6', '#BFE3EE', '#F4E8C8'],
    haze: '#EAD9C0',
    hazeD: 70,
    cam: { pitch: 20, h: Math.max(2.6, tall * 0.85 + 1.4), fov: 0.9 },
    blur: 0,
    plain: 1,
  };
}
async function wbmMountPreview() {
  const cv = paneRoot().querySelector('#wbmPv');
  if (!cv || !wbModel.rec) return;
  await Promise.all(sceneryArtPaths().map(p => atlasGet('art/' + p).catch(() => null)));
  if (!cv.isConnected || !wbmShown()) return;
  wbmPreview.sc = wbmScene();
  walkView.id = null;
  mountWalkView(cv, '__modelpv', {
    state: () => ({ mode: 'roam', roam: true, pos: wbmPreview.sc.hub, who: null, enc: [], npcs: [], exits: [] }),
    keys: () => false,
    onPick: () => {},
    onMove: () => {},
    cap: () => (wbmShown() ? 40 : 0),
  }).then(() => {
    const l = paneRoot().querySelector('#wbmPvLoad');
    if (l) l.hidden = true;
  });
  frameTask('wbmSpin', () => {
    if (!wbmShown()) {
      frameStop('wbmSpin');
      return;
    }
    if (wbModel.spin && !walkRenderer.drag) walkRenderer.yawT = Math.sin(performance.now() / 2600) * 0.9;
  });
}
/* ---------- the section ---------- */
function wbModelSection(head) {
  const R = wbModel.rec;
  afterRender(wbmMount);
  if (!wbModel.main && !R)
    return `<div class="wb wbm">${head}<div class="wb-body"><aside class="list-col wb-list">${wbmOpenHTML()}</aside><div class="wb-mid wb-empty"><div class="wb-drop"><b>Drop a model here</b><span>A .glb, or a .gltf with its .bin and pictures, an .obj with its .mtl and pictures, or a MagicaVoxel .vox. Anywhere on the Studio works.</span></div></div><aside class="px-side wb-side"><div class="px-sec"><p class="help">Blender, Blockbench, MagicaVoxel and AI generators all export glTF. Keep it under 2,000 triangles and paint it at 32 pixels to the metre (the airship's and the ground's art).</p></div></aside></div></div>`;
  if (!R)
    return `<div class="wb wbm">${head}<div class="wb-body"><aside class="list-col wb-list">${wbmOpenHTML()}</aside><div class="wb-mid wb-empty"><div class="wb-drop"><b>${escapeHtml(wbModel.main)} can't be read</b><span>${escapeHtml(wbModel.err)}</span></div></div><aside class="px-side wb-side"></aside></div></div>`;
  const tabs = `<div class="seg-row wb-tools"><button class="seg ${wbModel.view === 'model' ? 'on' : ''}" data-act="wbmView" data-v="model">Model</button><button class="seg ${wbModel.view === 'texture' ? 'on' : ''}" data-act="wbmView" data-v="texture" ${wbModel.tex ? '' : 'disabled title="No texture: colours only"'}>Texture</button><span class="grow"></span>${wbModel.view === 'model' ? `<label class="chk"><input type="checkbox" data-wbm="spin" ${wbModel.spin ? 'checked' : ''}> Turn slowly</label>` : ''}</div>`;
  const mid =
    wbModel.view === 'texture' && wbModel.tex
      ? `<div class="wb-mid wbm-mid">${tabs}${wbmTextureHTML()}</div>`
      : `<div class="wb-mid wbm-mid">${tabs}<div class="sc-pv wbm-pv"><canvas id="wbmPv" data-keep="walk-gl"></canvas><div class="sc-pv-load" id="wbmPvLoad">Loading…</div></div><div class="wbm-pic"><img alt="The prop's picture" id="wbmPic"><p class="help">The picture the game shows with 3D props off and far away, baked from the model (${wbModel.picture ? `${wbModel.picture.width} × ${wbModel.picture.height} px` : '…'}).</p></div></div>`;
  return `<div class="wb wbm">${head}<div class="wb-body"><aside class="list-col wb-list">${wbmOpenHTML()}${wbmPartsHTML()}</aside>${mid}<aside class="px-side wb-side">${wbmSideHTML()}</aside></div></div>`;
}
function wbmOpenHTML() {
  const files = wbModel.files ? Object.keys(wbModel.files) : [];
  return `<div class="seg-row"><button class="btn sm primary" data-act="wbmOpen">Open a model…</button></div>${
    files.length
      ? `<div class="px-sec"><h4>Files</h4>${files.map(f => `<p class="help mono">${f === wbModel.main ? '<b>' : ''}${escapeHtml(f)}${f === wbModel.main ? '</b>' : ''}</p>`).join('')}</div>`
      : wbModel.kind === 'saved'
        ? `<div class="px-sec"><h4>Model</h4><p class="help mono">art/scene/models/${escapeHtml(wbModel.key)}.json</p></div>`
        : ''
  }`;
}
const WBM_AXES = [
  ['x', [1, 0, 0], 'across (x)'],
  ['y', [0, 1, 0], 'up (y)'],
  ['z', [0, 0, 1], 'front to back (z)'],
];
const wbmAxisKey = a => {
  if (!a) return 'y';
  const k = WBM_AXES.find(([, v]) => v.every((q, i) => Math.abs(q - Math.abs(a[i])) < 0.01));
  return k ? k[0] : 'custom';
};
function wbmPartsHTML() {
  const R = wbModel.rec,
    seen = new Set();
  const rows = (R.parts || [])
    .map((p, i) => {
      const base = p.name.replace(/ \(\d+\)$/, '');
      if (seen.has(base)) return '';
      seen.add(base);
      const sp = p.spin,
        jt = p.joint,
        parent = p.parent >= 0 && R.parts[p.parent] ? R.parts[p.parent].name : '',
        axis = (k, v) =>
          `<select data-wbm-part="${i}" data-k="${k}">${WBM_AXES.map(([a, , n]) => `<option value="${a}" ${wbmAxisKey(v) === a ? 'selected' : ''}>${n}</option>`).join('')}${wbmAxisKey(v) === 'custom' ? '<option value="custom" selected>as imported</option>' : ''}</select>`;
      return `<div class="px-sec wbm-part"><b>${escapeHtml(base)}</b><small class="help">${p.ni / 3} triangles${parent ? ` · hangs from ${escapeHtml(parent)}` : ''} · pivot ${p.pivot.map(v => v.toFixed(2)).join(', ')} m</small>
  <label class="chk"><input type="checkbox" data-wbm-part="${i}" data-k="spin" ${sp ? 'checked' : ''}> Spins</label>${sp ? `<div class="grid"><label class="fld"><span>Axis</span>${axis('spinA', sp.a)}</label><label class="fld"><span>Turns a second</span><input type="number" step="0.1" value="${sp.rps}" data-wbm-part="${i}" data-k="rps"></label></div>` : ''}
  <label class="chk"><input type="checkbox" data-wbm-part="${i}" data-k="joint" ${jt ? 'checked' : ''}> Joint (kept for posing)</label>${jt ? `<div class="grid"><label class="fld"><span>Axis</span>${axis('jointA', jt.a)}</label><label class="fld"><span>From (°)</span><input type="number" step="5" value="${jt.min}" data-wbm-part="${i}" data-k="min"></label><label class="fld"><span>To (°)</span><input type="number" step="5" value="${jt.max}" data-wbm-part="${i}" data-k="max"></label></div>` : ''}</div>`;
    })
    .join('');
  return `<div class="wbm-parts"><h4>Parts</h4><p class="help">Each node of the file is a part, turning about its pivot (the node's origin). A spin turns all the time, as the airship's propellers do; a joint is kept for posing (drawn at rest).</p>${rows}</div>`;
}
function wbmSideHTML() {
  const R = wbModel.rec,
    D = wbModel.D,
    imported = wbModel.kind !== 'saved',
    lines = [...(wbModel.warnings || []).map(t => ({ level: 'warn', text: t })), ...modelCheckLines(R, D)];
  const B = R.box,
    size = `${(B[3] - B[0]).toFixed(2)} × ${(B[4] - B[1]).toFixed(2)} × ${(B[5] - B[2]).toFixed(2)} m`;
  const num = (k, label, step, help) =>
    `<label class="fld"><span>${label}</span><input type="number" step="${step}" value="${+wbModel.o[k] || 0}" data-wbm="${k}" ${imported ? '' : 'disabled'}>${help ? `<small class="help">${help}</small>` : ''}</label>`;
  const settings =
    wbModel.kind === 'vox'
      ? `<div class="px-sec"><h4>Size</h4><p class="help">A voxel prop is 32 voxels to the metre (a voxel a texel), standing on its base point: ${size}.</p></div>`
      : imported
        ? `<div class="px-sec"><h4>Size and turn</h4><div class="grid">${num('height', 'Height (m)', 0.1, '0: as the file is, times the scale')}${num('scale', 'Scale (file units to m)', 0.01, wbModel.kind === 'vox' ? '1/32: a voxel a texel' : '')}<label class="fld"><span>Turn (°)</span><select data-wbm="yaw">${[0, 90, 180, 270].map(a => `<option value="${a}" ${+wbModel.o.yaw === a ? 'selected' : ''}>${a}°</option>`).join('')}</select></label><label class="fld"><span>Up is</span><select data-wbm="upZ"><option value="" ${wbModel.o.upZ ? '' : 'selected'}>y (glTF, Blender export)</option><option value="1" ${wbModel.o.upZ ? 'selected' : ''}>z (some OBJ exports)</option></select></label></div>
  <label class="chk"><input type="checkbox" data-wbm="ground" ${wbModel.o.ground ? 'checked' : ''}> Stands on the ground (its lowest point at 0)</label><label class="chk"><input type="checkbox" data-wbm="centre" ${wbModel.o.centre ? 'checked' : ''}> Centred on its base point</label>${wbModel.locked ? `<p class="help">The texture was ${wbModel.locked}: changing these builds the model again from the file and drops that. <button class="btn sm subtle" data-act="wbmRebuild">Start again from the file</button></p>` : ''}</div>`
        : `<div class="px-sec"><h4>Written model</h4><p class="help">Size and turn come from the file it was imported from; import that again to change them. Spins, joints and the texture are edited here.</p></div>`;
  const checks = `<div class="px-sec"><h4>Checks</h4><p class="help">${R.tris} triangles · ${R.parts.length} part${R.parts.length === 1 ? '' : 's'} · ${size}${wbModel.tex ? ` · texture ${wbModel.tex.width} × ${wbModel.tex.height} px` : ' · colours only'}</p>${lines.map(l => `<p class="wbm-check ${l.level}">${escapeHtml(l.text)}</p>`).join('')}${D && !D.isPalette && D.median ? wbmHistHTML(D) : ''}<div class="seg-row">${D && D.fix !== 1 ? `<button class="btn sm" data-act="wbmResample">Resample to 32 px/m (×${D.fix.toFixed(2)})</button>` : ''}${D && D.isPalette ? `<button class="btn sm" data-act="wbmBake">Bake to 32 px/m</button>` : ''}</div></div>`;
  const write = `<div class="px-sec"><h4>Write to game</h4><div class="grid"><label class="fld"><span>Prop key</span><input type="text" value="${escapeHtml(wbModel.key)}" data-wbm="key" ${wbModel.written ? 'disabled' : ''}></label><label class="fld"><span>Name</span><input type="text" value="${escapeHtml(wbModel.name)}" data-wbm="name"></label></div><button class="btn primary" data-act="wbmWrite">${wbModel.written ? 'Write again' : 'Write to game'}</button><p class="help">${
    wbModel.kind === 'vox'
      ? 'A voxel prop (as the Props section imports a .vox) and its picture.'
      : `art/scene/models/${escapeHtml(wbModel.key)}.json${wbModel.tex ? ' and .png' : ''}, its picture in art/scene/props, and the prop in the catalogue. Save or Propose changes sends them.`
  }</p>${wbModel.written ? `<button class="btn sm subtle" data-act="wbmProps">Open in Props</button>` : ''}</div>`;
  return settings + checks + write;
}
function wbmHistHTML(D) {
  const max = Math.max(...D.hist, 0.01);
  return `<div class="wbm-hist" title="The surface by texel density (px/m)">${D.hist
    .map((h, i) => {
      const lo = MODEL_DENSITY_BINS[i],
        hi = MODEL_DENSITY_BINS[i + 1],
        ok = lo >= 24 && hi && hi <= 36;
      return `<span class="${ok ? 'ok' : ''}" style="height:${Math.round((h / max) * 100)}%" title="${lo}${hi ? '-' + hi : '+'} px/m: ${Math.round(h * 100)}%"></span>`;
    })
    .join(
      ''
    )}</div><p class="help">The surface by px/m (${MODEL_DENSITY_BINS[0]} to ${MODEL_DENSITY_BINS[MODEL_DENSITY_BINS.length - 1]}+); green is 24-36.</p>`;
}
function wbmTextureHTML() {
  const live = !!wbmTexPath();
  return `<div class="wbm-tex"><div class="wbm-paint"><div class="seg-row wb-tools">${live ? pixelCanvasToolsHTML() : ''}<span class="help">${live ? 'Paint the texture: every stroke shows on the model and is a step of the undo.' : wbModel.pending ? 'Write the model again first: the texture or its faces changed since it was written.' : 'Write the model to the game first: then its texture is a picture of the game, painted with the undo and saved with it.'}${wbModel.hl ? ` Texel ${wbModel.hl[0]}, ${wbModel.hl[1]} marked.` : ''}</span></div><div class="wb-stage" id="wbmTexStage"></div></div><div class="wbm-pickcol"><div><p class="help">Click the model to find its texel.</p><canvas id="wbmPick"></canvas><div class="seg-row"><button class="seg sm" data-act="wbmPickTurn" data-d="-1" title="Turn the model">⟲</button><button class="seg sm" data-act="wbmPickTurn" data-d="1" title="Turn the model">⟳</button></div></div>${live ? `<div id="wbmPanel">${pixelCanvasPanelHTML()}</div>` : ''}</div></div>`;
}
/* ---------- after drawing ---------- */
function wbmMount() {
  if (!wbmShown() && !(studioState.sec2 === 'workbench' && workbench.mode === 'model')) return;
  const root = paneRoot(),
    pic = root.querySelector('#wbmPic');
  if (pic && wbModel.picture) pic.src = wbModel.picture.toDataURL();
  if (wbModel.view === 'model' || !wbModel.tex) wbmMountPreview();
  else wbmMountTexture(root);
}
function wbmMountTexture(root) {
  const st = root.querySelector('#wbmTexStage');
  if (!st) return;
  const path = wbmTexPath(),
    faces = modelFaces(wbModel.rec).filter(f => f.uv);
  const P = pixelCanvas(st, {
    ids: 'wbm',
    get: () => (path ? loadedAtlas(path) : null) || wbModel.tex,
    path: path ? () => path : undefined,
    tool: path ? 'pen' : 'pick',
    overlay: () => {
      const c = (path && loadedAtlas(path)) || wbModel.tex,
        W = c.width,
        H = c.height;
      const d = faces
        .map(f => {
          const q = f.uv.map(([u, v]) => [(u - Math.floor(f.uv[0][0])) * W, (v - Math.floor(f.uv[0][1])) * H]);
          return `M${q[0][0].toFixed(1)} ${q[0][1].toFixed(1)}L${q[1][0].toFixed(1)} ${q[1][1].toFixed(1)}L${q[2][0].toFixed(1)} ${q[2][1].toFixed(1)}Z`;
        })
        .join('');
      const hl = wbModel.hl
        ? `<rect class="wbm-hl" x="${wbModel.hl[0] - 1}" y="${wbModel.hl[1] - 1}" width="3" height="3"/>`
        : '';
      return `<path class="wbm-uv" d="${d}"/>${hl}`;
    },
    changed: () => {
      if (!path) return;
      const c = loadedAtlas(path);
      markArt(path, c);
      wbModel.tex = c;
      wbmPickDraw(root);
    },
  });
  /* the tool bar and the symmetry and palette panel both talk to the canvas */
  if (path) pixelCanvasPanel(P, root.querySelector('.wbm-tex'));
  P.zoom = pixelCanvasFit(P);
  drawPixelCanvas(P);
  wbModel.pc = P;
  wbmPickDraw(root);
}
/** the model's picture beside the texture, turned; clicking it finds the texel */
function wbmPickDraw(root) {
  const cv = root.querySelector('#wbmPick');
  if (!cv || !wbModel.rec) return;
  const tex = wbmTexPath() ? loadedAtlas(wbmTexPath()) : wbModel.tex,
    T = tex ? wbmPixels(tex) : null,
    B = modelBakePicture(wbModel.rec, T, 32, { yaw: (wbModel.pickYaw * Math.PI) / 4, pick: true });
  wbModel.pick = B;
  const scale = Math.max(1, Math.floor(260 / Math.max(B.pixels.width, B.pixels.height)));
  cv.width = B.pixels.width;
  cv.height = B.pixels.height;
  cv.style.width = B.pixels.width * scale + 'px';
  cv.style.height = B.pixels.height * scale + 'px';
  cv.getContext('2d').putImageData(
    new ImageData(new Uint8ClampedArray(B.pixels.data), B.pixels.width, B.pixels.height),
    0,
    0
  );
  cv.onclick = ev => {
    const r = cv.getBoundingClientRect(),
      x = Math.floor(((ev.clientX - r.left) / r.width) * cv.width),
      y = Math.floor(((ev.clientY - r.top) / r.height) * cv.height),
      i = y * cv.width + x,
      u = B.uv ? B.uv[i * 2] : NaN,
      v = B.uv ? B.uv[i * 2 + 1] : NaN;
    if (!Number.isFinite(u)) return toast('No texture there (a plain colour, or nothing).');
    const c = (wbmTexPath() && loadedAtlas(wbmTexPath())) || wbModel.tex;
    wbModel.hl = [Math.floor((u - Math.floor(u)) * c.width), Math.floor((v - Math.floor(v)) * c.height)];
    if (wbModel.pc) {
      wbModel.pc.sel = null;
      drawPixelCanvas(wbModel.pc);
    }
    const h = root.querySelector('.wbm-paint .help');
    if (h) h.textContent = `Texel ${wbModel.hl[0]}, ${wbModel.hl[1]} marked.`;
  };
}
/* ---------- actions ---------- */
ACTIONS.wbmOpen = () => {
  const i = document.createElement('input');
  i.type = 'file';
  i.multiple = true;
  i.accept = '.glb,.gltf,.bin,.obj,.mtl,.vox,.png,.jpg,.jpeg';
  i.onchange = () => wbModelFiles([...i.files]).catch(e => toast('Could not open that: ' + e.message, 'err'));
  i.click();
};
ACTIONS.wbmView = d => {
  wbModel.view = d.v === 'texture' ? 'texture' : 'model';
  render();
};
ACTIONS.wbmPickTurn = d => {
  wbModel.pickYaw = (wbModel.pickYaw + +d.d + 8) % 8;
  wbmPickDraw(paneRoot());
};
ACTIONS.wbmRebuild = () => {
  wbmBuild();
  render();
};
ACTIONS.wbmResample = () => {
  const D = wbModel.D,
    path = wbmTexPath();
  if (!D || D.fix === 1 || !wbModel.tex) return;
  const before = path ? pictureImage(loadedAtlas(path)) : null,
    c = wbPixelsCanvas(modelResample(wbmPixels((path && loadedAtlas(path)) || wbModel.tex), D.fix));
  wbModel.tex = c;
  if (path) {
    markArt(path, c);
    artSteps([[path, before, pictureImage(c)]]);
  }
  wbModel.locked = 'resampled';
  wbmChecked();
  render();
  toast(`Texture scaled ×${D.fix.toFixed(2)}: now ${c.width} × ${c.height} px.`, 'ok');
};
ACTIONS.wbmBake = () => {
  const A = buildingArt(),
    sheet = A && loadedAtlas('art/' + A.detail),
    pal = Object.values((window.NW_PALETTE && window.NW_PALETTE.ramps) || {})
      .filter(Array.isArray)
      .flat();
  let B;
  try {
    B = modelBakeTexture(wbModel.rec, wbModel.tex ? wbmPixels(wbModel.tex) : null, {
      palette: pal,
      sheet: sheet ? wbmPixels(sheet) : null,
      cols: 8,
      cell: sheet ? sheet.width / 8 : 64,
    });
  } catch (e) {
    return toast(e.message, 'err');
  }
  wbModel.rec = B.rec;
  if (wbModel.written && !B.rec.tex) B.rec.tex = `scene/models/${wbModel.key}.png`;
  wbModel.tex = wbPixelsCanvas(B.pixels);
  wbModel.locked = 'baked';
  wbModel.pending = !!wbModel.written;
  wbModel.hl = null;
  wbmChecked();
  render();
  toast(
    `Baked: a ${B.pixels.width} × ${B.pixels.height} px texture at 32 px/m in the game's colours.${wbModel.written ? ' Write again to keep it.' : ''}`,
    'ok'
  );
};
ACTIONS.wbmProps = () => {
  mapEditor.ped = wbModel.written;
  mapEditor.pe = null;
  openSection('props');
};
ACTIONS.wbmWrite = () => wbmWrite().catch(e => toast('Writing failed: ' + e.message, 'err'));
async function wbmWrite() {
  const key = wbModel.key,
    C = sceneryCatalog(),
    old = C.props[key];
  if (!WBM_KEY.test(key))
    return toast('A prop key is lower case letters, digits and _ (starting with a letter).', 'err');
  if (
    old &&
    wbModel.written !== key &&
    !(await ask(`A prop "${key}" exists. Replace its model and picture?`, 'Replace'))
  )
    return;
  const R = wbModel.rec,
    picPath = `art/scene/props/${key}.png`,
    steps = [];
  const art = async (path, c) => {
    const was = loadedAtlas(path) || (old ? await atlasGet(path).catch(() => null) : null);
    markArt(path, c);
    steps.push([path, was ? pictureImage(was) : null, pictureImage(c)]);
  };
  const entry = {
    ...(old || {}),
    name: wbModel.name || key,
    img: picPath.slice(4),
    sway: 0,
    flat: 0,
    shadow: old && old.shadow != null ? old.shadow : 1,
    tags: (old && old.tags) || ['model'],
    group: (old && old.group) || key,
    vary: (old && old.vary) || { rot: 0, lean: 0 },
  };
  if (wbModel.kind === 'vox') {
    const layer = voxRawLayer(wbModel.vox, wbModel.main);
    entry.model = { vpm: 32, layers: [layer] };
  } else {
    const path = `scene/models/${key}.json`,
      rec = { ...R, name: wbModel.name || R.name };
    if (wbModel.tex) {
      rec.tex = `scene/models/${key}.png`;
      const texPath = 'art/' + rec.tex,
        cur = loadedAtlas(texPath);
      if (cur !== wbModel.tex) await art(texPath, wbModel.tex);
    } else delete rec.tex;
    const text = JSON.stringify(rec) + '\n';
    /* the file as the game has it: only a prop that already names it has one (a new key's file isn't fetched) */
    const before =
      textAsLoaded('art/' + path) ??
      (old && old.model === path ? await textGet('art/' + path).catch(() => null) : null);
    if (before !== text) textStep('art/' + path, before, text);
    propModelState.recipes.set(path, rec);
    invalidatePropModel(path, true);
    entry.model = path;
    entry.ppm = 32;
    wbModel.rec = rec;
  }
  const pic = modelBakePicture(wbModel.rec, wbModel.tex ? wbmPixels(wbModel.tex) : null);
  await art(picPath, wbPixelsCanvas(pic.pixels));
  entry.ox = pic.ox;
  entry.oy = pic.oy;
  if (steps.length) artSteps(steps);
  C.props[key] = entry;
  changed();
  commit(true);
  wbModel.written = key;
  wbModel.pending = false;
  wbmChecked();
  render();
  toast(`${key} written: the prop is in the catalogue (Props), its files wait for Save or Propose changes.`, 'ok');
}
/** Props' 3D model panel: a written v2 model opened here (its spins, joints and texture) */
async function wbModelOpenProp(k) {
  const M = sceneryCatalog().props[k];
  if (!M || typeof M.model !== 'string') return;
  const text = await textGet('art/' + M.model).catch(() => null),
    rec = text ? JSON.parse(text) : loadPropModelRecipe(M.model);
  if (!rec || rec.kind !== 'mesh' || rec.v !== 2)
    return toast('Only a model imported in Model mode (mesh v2) opens there.', 'err');
  const tex = rec.tex ? await atlasGet('art/' + rec.tex).catch(() => null) : null;
  Object.assign(wbModel, {
    files: null,
    main: M.model,
    kind: 'saved',
    src: null,
    vox: null,
    pix: [],
    key: k,
    name: M.name || k,
    rec,
    warnings: [],
    tex,
    edits: {},
    locked: '',
    view: 'model',
    hl: null,
    written: k,
    pending: false,
    err: '',
  });
  wbmChecked();
  workbench.mode = 'model';
  openSection('workbench');
}
ACTIONS.wbmOpenProp = d => wbModelOpenProp(d.k).catch(e => toast('Could not open it: ' + e.message, 'err'));
/* ---------- fields ---------- */
function wbmInput(ev) {
  const el = ev.target;
  if (!el.closest || !el.closest('.wbm')) return;
  if (el.dataset.wbm) {
    const k = el.dataset.wbm;
    if (k === 'spin') {
      wbModel.spin = el.checked;
      return;
    }
    if (k === 'key' || k === 'name') {
      wbModel[k] = k === 'key' ? el.value.trim() : el.value;
      return;
    }
    if (ev.type !== 'change') return;
    wbModel.o[k] = el.type === 'checkbox' ? el.checked : k === 'upZ' ? !!el.value : Number(el.value);
    wbmBuild();
    render();
  } else if (el.dataset.wbmPart !== undefined && ev.type === 'change') {
    const p = wbModel.rec.parts[+el.dataset.wbmPart],
      base = p.name.replace(/ \(\d+\)$/, ''),
      e = (wbModel.edits[base] = wbModel.edits[base] || {}),
      k = el.dataset.k,
      ax = v => (WBM_AXES.find(a => a[0] === v) || WBM_AXES[1])[1];
    if (k === 'spin') e.spin = el.checked ? { a: [0, 1, 0], rps: 1.5 } : null;
    else if (k === 'joint') e.joint = el.checked ? { a: [1, 0, 0], min: -30, max: 30 } : null;
    else if (k === 'spinA' && el.value !== 'custom') e.spin = { ...(p.spin || { rps: 1.5 }), a: ax(el.value) };
    else if (k === 'rps') e.spin = { ...(p.spin || { a: [0, 1, 0] }), rps: Number(el.value) || 0 };
    else if (k === 'jointA' && el.value !== 'custom')
      e.joint = { ...(p.joint || { min: -30, max: 30 }), a: ax(el.value) };
    else if (k === 'min' || k === 'max')
      e.joint = { ...(p.joint || { a: [1, 0, 0], min: -30, max: 30 }), [k]: Number(el.value) || 0 };
    wbmApplyEdits();
    wbModel.pending = !!wbModel.written;
    wbmRegister();
    render();
  }
}
document.addEventListener('input', wbmInput);
document.addEventListener('change', wbmInput);
const wbmIsModelFile = f => WBM_EXT.test(f.name);
provide({ wbmIsModelFile }); /* to-module */
