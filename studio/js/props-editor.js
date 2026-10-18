'use strict';
/* ================= POCKET BILLIES STUDIO · Props (phase 09 batch 1) =================
   Every prop in one place, apart from the walk scenes: a list you can search and filter (new style, trees, bushes,
   rocks, buildings, lamps and furniture, flat), and for the prop you pick everything about it: its variants (shown
   on the turntable one by one), where it stands, the prop editor (picture, base point, effects, layers, settings,
   variety and wear), its 3D model (shapes, limbs, domes, picture layers) with its leaves as one picture to paint,
   and the pixel editor. The turntable here draws in the plain look: no blur, bloom, grade, haze, weather or time of
   day, so a prop is judged as it is. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  card,
  changed,
  commit,
  dialog,
  openSection,
  render,
  studioState,
  toast,
} from './studio-app.js';
import { atlasGet } from './sprites.js';
import {
  mapEditor,
  mountSceneryPixelEditor,
  openSceneryPixelEditor,
  sceneryArtPaths,
  sceneryCatalog,
  sceneryPixelCardHTML,
} from './map-editor.js';
import { mountPropTurntable, propEditor, propEditorCardHTML } from './prop-editor.js';
/* eslint-disable no-func-assign */
expose({
  PROP_FAMILIES: [() => PROP_FAMILIES],
  mountProps: [() => mountProps, v => (mountProps = v)],
  propFamilyOf: [() => propFamilyOf, v => (propFamilyOf = v)],
  propPlacements: [() => propPlacements, v => (propPlacements = v)],
  propVariantsHTML: [() => propVariantsHTML, v => (propVariantsHTML = v)],
  propWhereHTML: [() => propWhereHTML, v => (propWhereHTML = v)],
  propsListHTML: [() => propsListHTML, v => (propsListHTML = v)],
  propsSel: [() => propsSel],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const PROP_FAMILIES = [
  ['', 'All'],
  ['next', 'New style'],
  ['tree', 'Trees'],
  ['bush', 'Bushes & plants'],
  ['rock', 'Rocks'],
  ['building', 'Buildings'],
  ['thing', 'Lamps & furniture'],
  ['flat', 'Flat'],
];
const propsSel = () => {
  const s = studioState.sel;
  if (s.propsQ === undefined) s.propsQ = '';
  if (s.propsF === undefined) s.propsF = '';
  return s;
};
function propFamilyOf(k, M) {
  const g = ((M.group || '') + ' ' + k).toLowerCase();
  if (M.build || M.box) return 'building';
  if (/tree|oak|pine|palm|birch|willow|beech|maple|elm|larch|rowan|hazel|poplar|chestnut/.test(g)) return 'tree';
  if (/rock|boulder|stone|pebble|crystal|basalt/.test(g)) return 'rock';
  if (
    /bush|hedge|grass|flower|fern|reed|mushroom|clover|tulip|iris|lily|lupin|thistle|nettle|heather|moss|bracken/.test(
      g
    )
  )
    return 'bush';
  if (M.flat) return 'flat';
  return 'thing';
}
/* where each prop stands: scene id -> how many, for every scene in the game data */
function propPlacements() {
  const D = studioState.D,
    out = new Map();
  for (const [id, sc] of Object.entries(D.maps || {}))
    for (const p of sc.props || (sc._lite && sc._lite.props) || []) {
      const k = typeof p === 'string' ? p : p.k;
      if (!out.has(k)) out.set(k, new Map());
      const m = out.get(k);
      m.set(id, (m.get(id) || 0) + 1);
    }
  return out;
}
function propsListHTML(C, where) {
  const S = propsSel(),
    q = S.propsQ.trim().toLowerCase(),
    list = Object.entries(C.props)
      .filter(([k, M]) => {
        if (q && !(k.toLowerCase().includes(q) || (M.name || '').toLowerCase().includes(q))) return false;
        if (!S.propsF) return true;
        if (S.propsF === 'next') return k.startsWith('next_') || !!M.ppm;
        return propFamilyOf(k, M) === S.propsF;
      })
      .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
  const rows = list
    .map(([k, M]) => {
      const n = [...(where.get(k) || new Map()).values()].reduce((a, b) => a + b, 0),
        badges = [
          M.model ? '<span class="pr-b pr-3d">3D</span>' : '',
          M.ppm ? '<span class="pr-b pr-new">32 px/m</span>' : '',
          M.variants && M.variants.length ? `<span class="pr-b">${M.variants.length + 1} looks</span>` : '',
        ].join('');
      return `<button class="lrow ${mapEditor.ped === k ? 'on' : ''}" data-act="propsPick" data-k="${escapeHtml(k)}"><b>${escapeHtml(M.name || k)} ${badges}</b><small>${escapeHtml(k)} · ${n ? `placed ${n}×` : 'placed nowhere'}</small></button>`;
    })
    .join('');
  return `<div class="side-list props-list"><input class="props-q" id="propsQ" placeholder="Search props…" value="${escapeHtml(S.propsQ)}">
  <div class="seg-row">${PROP_FAMILIES.map(([v, n]) => `<button class="seg sm ${S.propsF === v ? 'on' : ''}" data-act="propsFam" data-f="${v}">${n}</button>`).join('')}</div>
  <p class="help">${list.length} of ${Object.keys(C.props).length} props</p>${rows || '<p class="help">No prop matches.</p>'}
  <div class="seg-row"><button class="btn sm" data-act="scNewProp">+ New blank prop</button><button class="btn sm" data-act="scImportProp">+ Prop from PNG</button></div></div>`;
}
function propVariantsHTML(k, M) {
  const V = M.variants || [];
  const look = (i, name, img) =>
    `<button class="seg ${(propEditor.v || 0) === i ? 'on' : ''}" data-act="propsVar" data-i="${i}" title="${escapeHtml(img || '')}">${escapeHtml(name)}</button>`;
  return card(
    'Looks (variants)',
    `<p class="help">One prop, several looks: a placement picks one with its variant number (v). A look can have its own picture and size, its own 3D model, or the same model with colours and pictures swapped (an autumn tree's leaves). Pick one to see it on the turntable.</p>
    <div class="seg-row">${look(0, M.name || k, M.img)}${V.map((v, i) => look(i + 1, v.name || 'Look ' + (i + 1), v.img)).join('')}</div>
    ${
      propEditor.v && V[propEditor.v - 1]
        ? `<p class="help">Look ${propEditor.v}: ${[
            V[propEditor.v - 1].img ? 'picture ' + escapeHtml(V[propEditor.v - 1].img) : '',
            V[propEditor.v - 1].model ? 'model ' + escapeHtml(String(V[propEditor.v - 1].model)) : '',
            V[propEditor.v - 1].swap ? Object.keys(V[propEditor.v - 1].swap).length + ' swaps' : '',
          ]
            .filter(Boolean)
            .join(' · ')}</p><div class="seg-row">${
            V[propEditor.v - 1].img
              ? `<button class="btn sm" data-act="propsVarPx">Paint this look's picture</button>`
              : ''
          }<button class="btn sm subtle danger" data-act="propsVarDel">Remove this look</button></div>`
        : ''
    }
    <div class="seg-row"><button class="btn sm subtle" data-act="propsVarAdd">+ A look from another prop…</button></div>`
  );
}
function propWhereHTML(k, where) {
  const m = where.get(k);
  if (!m || !m.size)
    return card('Where it stands', '<p class="help">Placed in no scene yet. Place it from Walk scenes.</p>');
  const D = studioState.D;
  return card(
    'Where it stands',
    `<div class="seg-row">${[...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(
        ([id, n]) =>
          `<button class="btn sm subtle" data-act="propsGoScene" data-k="${escapeHtml(id)}">${escapeHtml((D.maps[id] && D.maps[id].name) || id)} · ${n}</button>`
      )
      .join('')}</div>`
  );
}
SECTIONS.props = () => {
  const C = sceneryCatalog(),
    where = propPlacements(),
    k = mapEditor.ped && C.props[mapEditor.ped] ? mapEditor.ped : null,
    M = k ? C.props[k] : null;
  afterRender(mountProps);
  const right = M
    ? `${propVariantsHTML(k, M)}${propWhereHTML(k, where)}${propEditorCardHTML(k)}${mapEditor.pe ? sceneryPixelCardHTML() : ''}`
    : card(
        'Props',
        '<p class="help">Pick a prop on the left. Everything about it opens here: its looks, where it stands, its picture and base point, effects and layers, its 3D model and leaves, and the pixel editor. The turntable shows it in the plain look, with no graphic effects.</p>'
      );
  return `<div class="props-sec"><aside class="props-side">${propsListHTML(C, where)}</aside><div class="props-main">${right}</div></div>`;
};
async function mountProps() {
  const q = document.getElementById('propsQ');
  if (q)
    q.addEventListener('input', () => {
      propsSel().propsQ = q.value;
      const pos = q.selectionStart;
      render();
      const q2 = document.getElementById('propsQ');
      if (q2) {
        q2.focus();
        q2.setSelectionRange(pos, pos);
      }
    });
  if (!mapEditor.ped) return;
  await Promise.all(sceneryArtPaths().map(p => atlasGet('art/' + p).catch(() => null)));
  if (studioState.sec !== 'props') return;
  mountPropTurntable();
  if (mapEditor.pe) mountSceneryPixelEditor();
}
ACTIONS.propsPick = d => {
  mapEditor.ped = d.k;
  mapEditor.pe = null;
  propEditor.v = 0;
  propEditor.sel = null;
  propEditor.layer = null;
  propEditor.zoom = 0;
  propEditor.tool = 'move';
  propEditor.sc = null;
  render();
};
ACTIONS.propsFam = d => {
  propsSel().propsF = d.f;
  render();
};
ACTIONS.propsVar = d => {
  propEditor.v = +d.i || 0;
  propEditor.sc = null;
  render();
};
ACTIONS.propsVarPx = () => {
  const M = sceneryCatalog().props[mapEditor.ped],
    V = M && M.variants && M.variants[propEditor.v - 1];
  if (V && V.img) openSceneryPixelEditor('art/' + V.img, { kind: 'prop', k: mapEditor.ped, layer: 'variant' });
};
ACTIONS.propsVarDel = () => {
  const M = sceneryCatalog().props[mapEditor.ped];
  if (!M || !M.variants || !propEditor.v) return;
  M.variants.splice(propEditor.v - 1, 1);
  if (!M.variants.length) delete M.variants;
  propEditor.v = 0;
  propEditor.sc = null;
  changed();
  commit(true);
  render();
};
/* a new look from another prop: its picture, size and model (placements of that prop are not changed) */
ACTIONS.propsVarAdd = async () => {
  const C = sceneryCatalog(),
    k = mapEditor.ped,
    M = C.props[k];
  if (!M) return;
  const opts = Object.entries(C.props)
      .filter(([x]) => x !== k)
      .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]))
      .map(([x, P]) => `<option value="${escapeHtml(x)}">${escapeHtml(P.name || x)} (${escapeHtml(x)})</option>`)
      .join(''),
    from = await dialog(
      'Add a look',
      `<label class="fld"><span>The prop whose picture, size and model become a new look</span><select id="pvFrom">${opts}</select></label>`,
      [
        { l: 'Cancel', v: false },
        { l: 'Add', c: 'primary', f: () => document.getElementById('pvFrom').value },
      ]
    ),
    F = from && C.props[from];
  if (!from) return;
  if (!F || from === k) return toast('No prop with that key.', 'err');
  const V = { name: F.name || from };
  for (const f of ['img', 'w', 'h', 'ox', 'oy', 'shadow', 'model']) if (F[f] !== undefined) V[f] = F[f];
  (M.variants || (M.variants = [])).push(V);
  propEditor.v = M.variants.length;
  propEditor.sc = null;
  changed();
  commit(true);
  render();
};
ACTIONS.propsGoScene = d => {
  mapEditor.ped = null;
  mapEditor.pe = null;
  openSection('scenes');
  if (typeof ACTIONS.scPick === 'function') ACTIONS.scPick({ k: d.k });
};
