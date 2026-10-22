'use strict';
/* ================= POCKET BILLIES STUDIO · engine =================
   Every dial of the 3D renderer (game/js/engine/settings.js): lens blur, chromatic aberration, bloom, the sun,
   shadows, lights, haze, grass, water, camera and quality. Set them for the whole game, or override them for one walk
   scene. The live preview runs the game's renderer on your unsaved values, so every change shows immediately. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { focusBlur, planeDistance } from '../../game/js/logic/lens-focus.js';
import { mapHub, walkView } from '../../game/js/walk-view.js';
import {
  ENGINE_DEFAULTS,
  ENGINE_PRESETS,
  ENGINE_SPEC,
  engineContext,
  engineSetting,
  setEngineDataSource,
} from '../../game/js/engine/settings.js';
import { gpuState, webgl2Supported } from '../../game/js/engine/webgl.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { standingHeightAt } from '../../game/js/walk/heights.js';
import { rebuildFromSettings } from '../../game/js/walk/map-cache.js';
import { adaptQuality, setAdaptQuality } from '../../game/js/walk/quality-cull.js';
import { interestPoints } from '../../game/js/walk/sprites.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  changed,
  clone,
  commit,
  dialog,
  fieldOutputId,
  readPath,
  render,
  studioState,
  toast,
  uniqueKey,
  writePath,
} from './studio-app.js';
import { atlasGet } from './sprites.js';
import { mapExitNames, sceneryArtPaths, sceneryCatalog } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  GUIDE_DIALS: [() => GUIDE_DIALS],
  captureLookPreview: [() => captureLookPreview, v => (captureLookPreview = v)],
  drawBlurGuides: [() => drawBlurGuides, v => (drawBlurGuides = v)],
  drawCameraGuides: [() => drawCameraGuides, v => (drawCameraGuides = v)],
  engineData: [() => engineData],
  engineDialHTML: [() => engineDialHTML, v => (engineDialHTML = v)],
  engineEditor: [() => engineEditor],
  engineEditorMapId: [() => engineEditorMapId],
  engineGroupHTML: [() => engineGroupHTML, v => (engineGroupHTML = v)],
  enginePresetsHTML: [() => enginePresetsHTML, v => (enginePresetsHTML = v)],
  engineScopePath: [() => engineScopePath],
  engineSettingsHTML: [() => engineSettingsHTML, v => (engineSettingsHTML = v)],
  formatDialValue: [() => formatDialValue],
  guideDragTo: [() => guideDragTo, v => (guideDragTo = v)],
  guideEdgeAt: [() => guideEdgeAt, v => (guideEdgeAt = v)],
  guideProject: [() => guideProject, v => (guideProject = v)],
  guideShapes: [() => guideShapes, v => (guideShapes = v)],
  inheritedDialValue: [() => inheritedDialValue, v => (inheritedDialValue = v)],
  mountCameraGuides: [() => mountCameraGuides, v => (mountCameraGuides = v)],
  mountEnginePreview: [() => mountEnginePreview, v => (mountEnginePreview = v)],
  pruneEngineOverrides: [() => pruneEngineOverrides],
  refreshEngineSettings: [() => refreshEngineSettings],
});
/* eslint-enable no-func-assign */
/* to-module: end */
setEngineDataSource(() => (studioState.D ? studioState.D.engine : null));
/* alpha 0.4.1: the Studio's previews show every setting at full effect. The game's automatic quality would step god
   rays, bloom, depth of field and ambient shading off (and lower the resolution) when the preview ran slowly, so a dial
   seemed to do nothing. Here it never steps down. */
if (typeof adaptQuality === 'function')
  setAdaptQuality(function () {
    if (typeof walkRenderer !== 'undefined') walkRenderer.q = 0;
    if (typeof walkView !== 'undefined') walkView.R = 1;
  });
export const engineEditor = {
  scope: 'game',
  scene: null,
  open: { lens: 1, color: 1, sun: 1, shadows: 1 },
  meterT: null,
};
export const engineData = () => studioState.D.engine || (studioState.D.engine = { defaults: {}, presets: {} });
const engineEditorMapId = () => {
  const S = studioState.D.maps || {};
  if (!S[engineEditor.scene])
    engineEditor.scene =
      studioState.sel.scene && S[studioState.sel.scene] ? studioState.sel.scene : Object.keys(S)[0] || null;
  return engineEditor.scene;
};
const engineScopePath = () =>
  engineEditor.scope === 'scene'
    ? `maps.${engineEditorMapId()}.look`
    : engineEditor.scope === 'map'
      ? 'engine.map'
      : 'engine.defaults';
/* what a dial would be without the scope being edited */
function inheritedDialValue(g, k) {
  if (engineEditor.scope !== 'game') {
    const d = (engineData().defaults || {})[g];
    if (d && d[k] !== undefined) return d[k];
  }
  return ENGINE_DEFAULTS[g][k];
}
export const formatDialValue = (v, step) => {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v !== 'number') return String(v);
  const t = v.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0);
  return t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
};
function engineDialHTML(g, f) {
  const [k, label] = f,
    typ = typeof f[2] === 'string' ? f[2] : 'range',
    p = `${engineScopePath()}.${g}.${k}`,
    own = readPath(p),
    inh = inheritedDialValue(g, k),
    v = own !== undefined ? own : inh;
  const help = typ === 'range' ? f[5] : typ === 'sel' ? null : f[3],
    reset = `<button class="eng-reset" data-act="engReset" data-p="${p}" title="Back to ${engineEditor.scope === 'scene' ? 'the game default' : 'the built-in value'} (${escapeHtml(formatDialValue(inh, f[4] || 1))})">↺</button>`;
  let body = '';
  if (typ === 'range')
    body = `<span class="eng-lab">${escapeHtml(label)} <output id="${fieldOutputId(p)}">${formatDialValue(v, f[4])}</output></span><input type="range" data-p="${p}" data-k="num" value="${v}" min="${f[2]}" max="${f[3]}" step="${f[4]}">`;
  else if (typ === 'bool')
    body = `<label class="eng-chk"><input type="checkbox" data-p="${p}" data-k="bool" ${v ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  else if (typ === 'sel')
    body = `<span class="eng-lab">${escapeHtml(label)}</span><select data-p="${p}" data-k="${typeof f[3][0][0] === 'number' ? 'num' : 'sel'}">${f[3].map(([a, n]) => `<option value="${a}" ${String(v) === String(a) ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>`;
  else if (typ === 'color' || typ === 'color?') {
    const ok = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    body = `<span class="eng-lab">${escapeHtml(label)}${!ok ? ' <i class="eng-auto">from the scene</i>' : ''}</span><span class="colw"><input type="color" data-p="${p}" data-k="color" value="${ok ? v : '#888888'}"><input type="text" data-p="${p}" data-k="color" value="${ok ? escapeHtml(v) : ''}" placeholder="${typ === 'color?' ? 'scene’s own' : ''}" maxlength="7" class="hex"></span>`;
  } else if (typ === 'num?')
    body = `<span class="eng-lab">${escapeHtml(label)}</span><input type="number" data-p="${p}" data-k="num" data-opt="1" step="any" value="${v == null ? '' : v}" placeholder="scene’s own">`;
  return `<div class="eng-f ${own !== undefined ? 'own' : ''}" data-path="${p}">${body}${reset}${help ? `<small class="help">${escapeHtml(help)}</small>` : ''}</div>`;
}
function engineGroupHTML([g, title, fields]) {
  const set = fields.filter(f => readPath(`${engineScopePath()}.${g}.${f[0]}`) !== undefined).length,
    open = engineEditor.open[g];
  return `<section class="card eng-g ${open ? 'open' : ''}"><header><button class="eng-gh" data-act="engOpen" data-g="${g}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${escapeHtml(title)}</h3>${set ? `<span class="badge">${set} set</span>` : ''}</button>${set ? `<button class="btn sm subtle" data-act="engResetG" data-g="${g}">Reset</button>` : ''}</header>
 ${open ? `<div class="card-b eng-fields">${fields.map(f => engineDialHTML(g, f)).join('')}</div>` : ''}</section>`;
}
function enginePresetsHTML() {
  const own = engineData().presets || {};
  return `<div class="eng-pre">${Object.entries(ENGINE_PRESETS)
    .map(([k, P]) => `<button class="seg" data-act="engPreset" data-k="${k}">${escapeHtml(P.name)}</button>`)
    .join('')}
 ${Object.entries(own)
   .map(
     ([k, P]) =>
       `<span class="eng-own"><button class="seg" data-act="engPreset" data-k="${escapeHtml(k)}" data-own="1">${escapeHtml(P.name || k)}</button><button class="eng-x" data-act="engPresetDel" data-k="${escapeHtml(k)}" title="Delete this preset">×</button></span>`
   )
   .join('')}
 <button class="seg add" data-act="engPresetSave">+ Save as preset</button><button class="seg" data-act="engLookPreviews" title="Draws the preview once with each look and shows them side by side">Preview every look</button></div><p class="help">A preset only changes the dials it lists, on ${engineEditor.scope === 'scene' ? 'this scene' : engineEditor.scope === 'map' ? 'the map' : 'the whole game'}. Undo takes it back.</p>`;
}
function engineSettingsHTML() {
  const sid = engineEditorMapId(),
    sc = sid ? studioState.D.maps[sid] : null,
    nScene = sc && sc.look ? Object.values(sc.look).reduce((a, o) => a + Object.keys(o || {}).length, 0) : 0,
    nGame = Object.values(engineData().defaults || {}).reduce((a, o) => a + Object.keys(o || {}).length, 0),
    nMap = Object.values(engineData().map || {}).reduce((a, o) => a + Object.keys(o || {}).length, 0);
  return `<div class="card eng-scope"><div class="card-b"><div class="seg-row"><button class="seg ${engineEditor.scope === 'game' ? 'on' : ''}" data-act="engScope" data-s="game">Whole game${nGame ? ` · ${nGame}` : ''}</button><button class="seg ${engineEditor.scope === 'scene' ? 'on' : ''}" data-act="engScope" data-s="scene">Only ${escapeHtml(sc ? sc.name || sid : 'this scene')}${nScene ? ` · ${nScene}` : ''}</button><button class="seg ${engineEditor.scope === 'map' ? 'on' : ''}" data-act="engScope" data-s="map">World map${nMap ? ` · ${nMap}` : ''}</button></div>
 <p class="help">${engineEditor.scope === 'map' ? 'These override the game-wide values on the Map tab (lens, color, bloom). The preview here shows a walk scene; open the game to see the map.' : engineEditor.scope === 'scene' ? 'These override the game-wide values for this one scene. A dial you haven’t touched follows the game.' : 'These apply to every walk scene unless a scene overrides them. A dial you haven’t touched uses the built-in value.'} Dials you’ve set show a ↺ to undo just that one.</p>
 <h4>Presets</h4>${enginePresetsHTML()}
 <div class="seg-row"><button class="btn sm subtle" data-act="engClear">Clear everything set here</button>${engineEditor.scope === 'scene' && nScene ? `<button class="btn sm subtle" data-act="engPromote">Use these for the whole game</button>` : ''}</div></div></div>
 ${ENGINE_SPEC.map(engineGroupHTML).join('')}`;
}
SECTIONS.engine = () => {
  const sid = engineEditorMapId();
  afterRender(mountEnginePreview);
  if (!sid)
    return `<div class="ed-col solo"><h2>Engine</h2><p class="help">Add a walk scene first; the preview needs one.</p></div>`;
  const opts = Object.entries(studioState.D.maps)
    .map(
      ([k, s]) => `<option value="${escapeHtml(k)}" ${k === sid ? 'selected' : ''}>${escapeHtml(s.name || k)}</option>`
    )
    .join('');
  return `<div class="eng-split"><div class="eng-set" id="engSet">${engineSettingsHTML()}</div>
 <div class="eng-side"><div class="card"><div class="card-b"><div class="eng-pvbar"><label class="fld"><span>Preview scene</span><select id="engScene">${opts}</select></label>
   <button class="btn sm" id="engCmp" title="Hold to see the built-in look without any of your settings">Hold to compare</button>
   <button class="btn sm ${engineEditor.guides ? 'on' : ''}" id="engGuidesBtn" data-act="engGuides" title="Draws the camera's dead and soft zones (drag their edges), its aim, the look-ahead, the points of interest and the camera zones on the preview">Camera guides</button>
   <button class="btn sm ${engineEditor.blurGuides ? 'on' : ''}" id="engBlurBtn" data-act="engBlurGuides" title="CAM-3: tints the ground the blur keeps sharp (the strip round the plane of focus), marks what the focus is on and names the blur's path, tilt and strength">Blur guides</button>
   <button class="btn sm ${engineEditor.heat ? 'on' : ''}" id="engHeatBtn" data-act="engHeat" title="CAM-3: colours the preview by how blurred each pixel is: green sharp, yellow a little, red full">Blur heatmap</button></div>
  <div class="eng-pvbar" title="CAM-2: plays one of the camera's moments in the preview, as if it happened (a talk or a boss 3 m up the screen)">Play moment ${[
    ['talk', 'Talk'],
    ['encounter', 'Encounter'],
    ['boss', 'Boss'],
    ['idle', 'Standing still'],
  ]
    .map(([k, n]) => `<button class="btn sm" data-act="engMoment" data-m="${k}">${n}</button>`)
    .join('')}</div>
  <div class="sc-pv eng-pv"><canvas id="engPv"></canvas><canvas id="engGuides" class="eng-guides" ${engineEditor.guides ? '' : 'hidden'}></canvas><canvas id="engBlur" class="eng-guides" ${engineEditor.blurGuides ? '' : 'hidden'}></canvas><div class="sc-pv-load" id="engPvLoad">Loading…</div></div>
  <div class="eng-meter" id="engMeter">–</div>
  <p class="help">Click the ground to walk, drag to turn, scroll to zoom. What you see is the game’s own renderer with your unsaved values. Battles happen inside the walk scene, so they follow its look.</p></div></div></div></div>`;
};
async function mountEnginePreview() {
  const cv = $('#engPv'),
    id = engineEditorMapId();
  if (!cv || !id) return;
  const C = sceneryCatalog();
  await Promise.all(sceneryArtPaths(C).map(p => atlasGet('art/' + p).catch(() => null)));
  if (!$('#engPv')) return;
  walkView.pl.t = -1;
  mountWalkView(cv, id, {
    state: () => ({
      mode: 'roam',
      roam: true,
      pos: engineEditor.pos && engineEditor.pos[0] === id ? engineEditor.pos[1] : mapHub(studioState.D.maps[id]),
      who: 'boy',
      enc: [
        { id: 'pv1', lvl: 5 },
        { id: 'pv2', lvl: 7 },
      ],
      npcs: [],
      exits: typeof mapExitNames === 'function' ? mapExitNames(id) : [],
    }),
    onMove: (x, z) => {
      engineEditor.pos = [id, [x, z]];
    },
    keys: () => false,
    /* CAM-2: the camera's moments and zones play here, as in the game */
    moments: true,
    onPick: h => {
      if (h.k !== 'ground') toast('That works in the game; here you can only walk.');
    },
    cap: () => (studioState.sec === 'engine' ? 60 : 0),
  }).then(() => {
    const l = $('#engPvLoad');
    if (l) l.hidden = true;
  });
  $('#engScene').onchange = e => {
    engineEditor.scene = e.target.value;
    render();
  };
  const b = $('#engCmp'),
    on = v => {
      engineContext.bypass = v;
      b.classList.toggle('on', v);
    };
  b.onpointerdown = () => on(true);
  mountCameraGuides();
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => on(false)));
  clearInterval(engineEditor.meterT);
  engineEditor.meterT = setInterval(() => {
    const m = $('#engMeter');
    if (!m || studioState.sec !== 'engine') {
      clearInterval(engineEditor.meterT);
      return;
    }
    if (typeof walkRenderer === 'undefined' || !walkRenderer.on) {
      m.textContent =
        typeof gpuState !== 'undefined' && (gpuState.fail || !webgl2Supported())
          ? 'WebGL 2 isn’t available in this browser, so there is no preview.'
          : 'Starting…';
      return;
    }
    const fps = walkRenderer.int ? Math.round(1000 / walkRenderer.int) : 0;
    m.innerHTML = `<b>${fps}</b> fps · <b>${(walkView.slow || 0).toFixed(1)}</b> ms of work per frame · resolution <b>${Math.round((walkView.R || 1) * engineSetting('quality', 'resolution') * 100)}%</b>${gpuState.hdr ? '' : ' · no HDR on this GPU'}`;
  }, 500);
}
/* edits */
studioState.hooks.engine = p => {
  const el = document.querySelector(`.eng-f[data-path="${p}"]`);
  if (el && !el.classList.contains('own')) {
    el.classList.add('own');
  }
  /* alpha 0.4.1: dials the ground, grass, water, trees and solid props are built from rebuild the preview (they showed no change before) */
  const g = String(p).split('.').slice(-2)[0];
  if (['world', 'grass', 'water', 'quality'].includes(g)) {
    clearTimeout(engineEditor.rbT);
    engineEditor.rbT = setTimeout(() => {
      if (typeof rebuildFromSettings === 'function') rebuildFromSettings();
    }, 350);
  }
};
export const refreshEngineSettings = () => {
  const s = $('#engSet');
  if (s) {
    const y = $('#main').scrollTop;
    s.innerHTML = engineSettingsHTML();
    $('#main').scrollTop = y;
  }
};
const pruneEngineOverrides = () => {
  const base = readPath(engineScopePath());
  if (!base) return;
  for (const g of Object.keys(base)) {
    for (const k of Object.keys(base[g] || {})) if (base[g][k] === undefined) delete base[g][k];
    if (!base[g] || !Object.keys(base[g]).length) delete base[g];
  }
  if (engineEditor.scope !== 'game' && !Object.keys(base).length) writePath(engineScopePath(), undefined);
};
ACTIONS.engScope = d => {
  engineEditor.scope = d.s;
  refreshEngineSettings();
};
ACTIONS.engOpen = d => {
  engineEditor.open[d.g] = !engineEditor.open[d.g];
  refreshEngineSettings();
};
ACTIONS.engReset = d => {
  writePath(d.p, undefined);
  pruneEngineOverrides();
  changed();
  commit(true);
  refreshEngineSettings();
};
ACTIONS.engResetG = d => {
  writePath(`${engineScopePath()}.${d.g}`, undefined);
  pruneEngineOverrides();
  changed();
  commit(true);
  refreshEngineSettings();
};
ACTIONS.engClear = async () => {
  if (!readPath(engineScopePath())) return toast('Nothing is set here.');
  if (
    !(await ask(
      `Clear every engine setting on ${engineEditor.scope === 'scene' ? 'this scene' : 'the whole game'}?`,
      'Clear'
    ))
  )
    return;
  writePath(engineScopePath(), engineEditor.scope === 'game' ? {} : undefined);
  changed();
  commit(true);
  refreshEngineSettings();
};
ACTIONS.engPromote = async () => {
  const look = readPath(engineScopePath());
  if (!look) return;
  if (!(await ask('Copy this scene’s settings to the whole game and clear them from the scene?', 'Copy'))) return;
  const d = engineData().defaults || (engineData().defaults = {});
  for (const [g, o] of Object.entries(look)) {
    d[g] = Object.assign(d[g] || {}, o);
  }
  writePath(engineScopePath(), undefined);
  changed();
  commit(true);
  engineEditor.scope = 'game';
  refreshEngineSettings();
};
ACTIONS.engPreset = d => {
  const P = d.own ? (engineData().presets || {})[d.k] : ENGINE_PRESETS[d.k];
  if (!P) return;
  for (const [g, o] of Object.entries(P.v || {}))
    for (const [k, v] of Object.entries(o))
      if (ENGINE_DEFAULTS[g] && k in ENGINE_DEFAULTS[g]) writePath(`${engineScopePath()}.${g}.${k}`, v);
  changed();
  commit(true);
  refreshEngineSettings();
  toast(`${P.name || d.k} applied${engineEditor.scope === 'scene' ? ' to this scene' : ''}.`);
};
ACTIONS.engPresetSave = async () => {
  const cur = readPath(engineScopePath());
  if (!cur || !Object.keys(cur).length) return toast('Set a few dials first; a preset saves the ones you’ve set here.');
  const name = await dialog(
    'Save as preset',
    '<label class="fld"><span>Name</span><input type="text" id="engPN" placeholder="Misty morning"></label>',
    [
      { l: 'Cancel', v: null },
      { l: 'Save', c: 'primary', f: m => (m.querySelector('#engPN').value || '').trim() || false },
    ]
  );
  if (!name) return;
  const ps = engineData().presets || (engineData().presets = {}),
    k = uniqueKey(name, x => !!ps[x] || !!ENGINE_PRESETS[x]);
  ps[k] = { name, v: clone(cur) };
  changed();
  commit(true);
  refreshEngineSettings();
  toast('Preset saved.');
};
ACTIONS.engPresetDel = async d => {
  if (!(await ask(`Delete the preset “${(engineData().presets[d.k] || {}).name || d.k}”?`, 'Delete'))) return;
  delete engineData().presets[d.k];
  changed();
  commit(true);
  refreshEngineSettings();
};

/* v29: look previews. The preview is drawn once with each preset (nothing is changed), then they're shown side by side;
   click one to apply it */
function captureLookPreview() {
  return new Promise(res => {
    if (typeof walkRenderer === 'undefined' || !walkRenderer.on) return res(null);
    let done = false;
    walkRenderer.photoReq = c => {
      done = true;
      if (!c) return res(null);
      const k = Math.min(1, 320 / c.width),
        o = document.createElement('canvas');
      o.width = Math.round(c.width * k);
      o.height = Math.round(c.height * k);
      o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
      res(o.toDataURL('image/jpeg', 0.8));
    };
    setTimeout(() => {
      if (!done) {
        walkRenderer.photoReq = null;
        res(null);
      }
    }, 4000);
  });
}
ACTIONS.engLookPreviews = async () => {
  if (!$('#engPv')) return;
  const own = engineData().presets || {},
    all = [
      ...Object.entries(ENGINE_PRESETS).map(([k, P]) => [k, P, 0]),
      ...Object.entries(own).map(([k, P]) => [k, P, 1]),
    ],
    keep = clone(readPath(engineScopePath()) || {}),
    out = [];
  toast('Drawing each look…');
  try {
    for (const [k, P, o] of all) {
      writePath(engineScopePath(), clone(keep));
      for (const [g, v] of Object.entries(P.v || {}))
        for (const [kk, vv] of Object.entries(v))
          if (ENGINE_DEFAULTS[g] && kk in ENGINE_DEFAULTS[g]) writePath(`${engineScopePath()}.${g}.${kk}`, vv);
      await new Promise(r => setTimeout(r, 650));
      out.push([k, P, o, await captureLookPreview()]);
    }
  } finally {
    writePath(engineScopePath(), Object.keys(keep).length ? keep : engineEditor.scope === 'game' ? {} : undefined);
  }
  const cur = await captureLookPreview();
  await dialog(
    'Every look on this scene',
    `<div class="eng-looks">${cur ? `<figure><img src="${cur}" alt="As it is now"><figcaption>As it is now</figcaption></figure>` : ''}${out.map(([k, P, o, u]) => `<figure class="eng-look" data-act="engPreset" data-k="${escapeHtml(k)}" ${o ? 'data-own="1"' : ''} role="button" tabindex="0">${u ? `<img src="${u}" alt="${escapeHtml(P.name || k)}">` : '<div class="help">No picture</div>'}<figcaption>${escapeHtml(P.name || k)}</figcaption></figure>`).join('')}</div><p class="help">Click a look to apply it (Undo takes it back).</p>`,
    [{ l: 'Close', v: null }]
  );
};
/* ================= CAM-1: the camera's guides on the preview =================
   As Cinemachine's game-view guides: the follow's soft zone (tinted) and dead zone (outlined) drawn on the ground round
   the camera's aim, the aim, you, and the look-ahead as an arrow; a line says the camera's mode and the goals in play.
   Drag a zone's edge to resize it: that writes the Camera dial (Dead zone / Soft zone, width or height) of the scope
   being edited, with undo. */
const GUIDE_DIALS = { dead: ['deadW', 'deadH', 0, 0.6], soft: ['softW', 'softH', 0.1, 1] };
function guideProject(C, w, h, x, y, z) {
  const m = C.vp,
    cx = m[0] * x + m[4] * y + m[8] * z + m[12],
    cy = m[1] * x + m[5] * y + m[9] * z + m[13],
    cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  return cw > 0 ? [(cx / cw / 2 + 0.5) * w, (0.5 - cy / cw / 2) * h] : null;
}
/* the zones' corners on screen, and the aim's point */
function guideShapes(w, h) {
  const C = walkView.C,
    I = walkRenderer.camInfo,
    T = walkRenderer.camT;
  if (!C || !C.vp || !I || !T) return null;
  const R = I.right,
    F = [-R[1], R[0]],
    quad = ([a, f]) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) =>
        guideProject(C, w, h, T[0] + R[0] * a * i + F[0] * f * j, T[2], T[1] + R[1] * a * i + F[1] * f * j)
      ),
    out = { aim: guideProject(C, w, h, T[0], T[2], T[1]), dead: quad(I.dead), soft: quad(I.soft), I, C, T };
  return out.aim && out.dead.every(Boolean) && out.soft.every(Boolean) ? out : null;
}
/* which zone edge is under the pointer (within 8 px): [zone, 'w' for a side edge or 'h' for a top or bottom edge] */
function guideEdgeAt(S, x, y) {
  const near = (a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) < 8;
  };
  for (const z of ['dead', 'soft']) {
    const q = S[z];
    if (near(q[1], q[2]) || near(q[3], q[0])) return [z, 'w'];
    if (near(q[0], q[1]) || near(q[2], q[3])) return [z, 'h'];
  }
  return null;
}
function drawCameraGuides() {
  const g = $('#engGuides');
  if (!g || !engineEditor.guides || studioState.sec !== 'engine') {
    engineEditor.guideRaf = 0;
    return;
  }
  engineEditor.guideRaf = requestAnimationFrame(drawCameraGuides);
  const r = window.devicePixelRatio || 1,
    w = g.clientWidth,
    h = g.clientHeight;
  if (g.width !== Math.round(w * r) || g.height !== Math.round(h * r)) {
    g.width = Math.round(w * r);
    g.height = Math.round(h * r);
  }
  const x = g.getContext('2d');
  x.setTransform(r, 0, 0, r, 0, 0);
  x.clearRect(0, 0, w, h);
  const S = guideShapes(w, h);
  if (!S) return;
  const poly = (q, fill, stroke, dash) => {
    x.beginPath();
    q.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    if (fill) {
      x.fillStyle = fill;
      x.fill();
    }
    x.setLineDash(dash || []);
    x.strokeStyle = stroke;
    x.lineWidth = engineEditor.guideHover && engineEditor.guideHover[0] === (dash ? 'soft' : 'dead') ? 3 : 1.5;
    x.stroke();
    x.setLineDash([]);
  };
  const { I, C, T } = S,
    dot = (p, col, rad) => {
      if (!p) return;
      x.beginPath();
      x.arc(p[0], p[1], rad, 0, Math.PI * 2);
      x.fillStyle = col;
      x.fill();
    };
  poly(S.soft, 'rgba(255, 196, 64, 0.12)', 'rgba(255, 196, 64, 0.9)', [6, 4]);
  poly(S.dead, 'rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.95)');
  const P = walkView.pl,
    feet = T[2],
    you = guideProject(C, w, h, P.x, feet, P.z),
    ahead = guideProject(C, w, h, P.x + I.lead[0], feet, P.z + I.lead[1]);
  if (you && ahead && Math.hypot(ahead[0] - you[0], ahead[1] - you[1]) > 3) {
    const a = Math.atan2(ahead[1] - you[1], ahead[0] - you[0]);
    x.strokeStyle = x.fillStyle = 'rgba(80, 220, 255, 0.95)';
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(you[0], you[1]);
    x.lineTo(ahead[0], ahead[1]);
    x.stroke();
    x.beginPath();
    x.moveTo(ahead[0], ahead[1]);
    x.lineTo(ahead[0] - 9 * Math.cos(a - 0.45), ahead[1] - 9 * Math.sin(a - 0.45));
    x.lineTo(ahead[0] - 9 * Math.cos(a + 0.45), ahead[1] - 9 * Math.sin(a + 0.45));
    x.closePath();
    x.fill();
  }
  /* CAM-2: the points of interest (a ring on the ground, its radius; brighter the more it counts now), the camera
     zones (outlined; the one you stand in filled) and a played moment's spot */
  const ring = (cx, cz, rad, stroke, fill) => {
    const q = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2,
        p = guideProject(C, w, h, cx + Math.cos(a) * rad, feet, cz + Math.sin(a) * rad);
      if (!p) return;
      q.push(p);
    }
    poly(q, fill, stroke, [3, 3]);
  };
  for (const pt of typeof interestPoints === 'function' ? interestPoints(walkView.sc) : []) {
    const top = I.interest && Math.abs(I.interest[2] - pt.x) < 1e-6 && Math.abs(I.interest[3] - pt.z) < 1e-6;
    ring(pt.x, pt.z, pt.radius, `rgba(120, 255, 160, ${top ? 0.95 : 0.45})`, top ? 'rgba(120, 255, 160, 0.10)' : null);
    dot(guideProject(C, w, h, pt.x, feet, pt.z), 'rgba(120, 255, 160, 0.95)', 3);
  }
  ((walkView.sc && walkView.sc.camZones) || []).forEach((zn, i) => {
    const fill = i === I.zone ? 'rgba(181, 126, 220, 0.18)' : null,
      stroke = 'rgba(181, 126, 220, 0.95)';
    if (zn.shape === 'circle') return ring(zn.x, zn.z, zn.r || 0, stroke, fill);
    const q = [
      [zn.x, zn.z],
      [zn.x + (zn.w || 0), zn.z],
      [zn.x + (zn.w || 0), zn.z + (zn.h || 0)],
      [zn.x, zn.z + (zn.h || 0)],
    ].map(([a, b]) => guideProject(C, w, h, a, feet, b));
    if (q.every(Boolean)) poly(q, fill, stroke, [3, 3]);
  });
  const MT = walkRenderer.momentTest;
  if (MT && MT.at) dot(guideProject(C, w, h, MT.at[0], feet, MT.at[1]), 'rgba(255, 90, 200, 1)', 5);
  dot(guideProject(C, w, h, I.goal[0], feet, I.goal[1]), 'rgba(255, 196, 64, 1)', 3.5);
  dot(S.aim, 'rgba(255, 255, 255, 1)', 4);
  dot(you, 'rgba(80, 220, 255, 1)', 4);
  const goals = I.goals
    .filter(([id]) => id !== 'tilt')
    .map(([id, v]) => `${id} ${v.toFixed(2)}`)
    .join(' · ');
  x.font = '12px system-ui, sans-serif';
  x.fillStyle = 'rgba(0, 0, 0, 0.55)';
  const line = `${I.mode}${I.moment ? ' · moment ' + I.moment : ''} · zoom ${walkRenderer.zoom.toFixed(2)}${I.zoom != null && Math.abs(I.zoom - walkRenderer.zoom) > 0.005 ? ' → ' + I.zoom.toFixed(2) : ''}${goals ? ' · ' + goals : ''}`;
  x.fillRect(6, 6, x.measureText(line).width + 12, 20);
  x.fillStyle = '#fff';
  x.fillText(line, 12, 20);
}
/* drag an edge: the zone's share of the screen from how far the pointer is from the aim */
function guideDragTo(ev) {
  const g = $('#engGuides'),
    d = engineEditor.guideDrag;
  if (!g || !d) return;
  const b = g.getBoundingClientRect(),
    S = guideShapes(b.width, b.height);
  if (!S) return;
  const [kw, kh, lo, hi] = GUIDE_DIALS[d[0]],
    k = d[1] === 'w' ? kw : kh,
    share =
      d[1] === 'w'
        ? (2 * Math.abs(ev.clientX - b.left - S.aim[0])) / b.width
        : (2 * Math.abs(ev.clientY - b.top - S.aim[1])) / b.height,
    v = Math.round(Math.max(lo, Math.min(hi, share)) * 100) / 100,
    p = `${engineScopePath()}.camera.${k}`;
  writePath(p, v);
  const el = document.querySelector(`input[data-p="${p}"]`),
    o = document.getElementById(fieldOutputId(p));
  if (el) el.value = v;
  if (o) o.textContent = formatDialValue(v, 0.01);
}
function mountCameraGuides() {
  const box = $('.eng-pv');
  if (!box) return;
  box.addEventListener(
    'pointerdown',
    ev => {
      if (!engineEditor.guides) return;
      const b = box.getBoundingClientRect(),
        S = guideShapes(b.width, b.height),
        e = S && guideEdgeAt(S, ev.clientX - b.left, ev.clientY - b.top);
      if (!e) return;
      ev.stopPropagation();
      ev.preventDefault();
      engineEditor.guideDrag = e;
      box.setPointerCapture(ev.pointerId);
    },
    true
  );
  box.addEventListener(
    'pointermove',
    ev => {
      if (!engineEditor.guides) return;
      if (engineEditor.guideDrag) {
        ev.stopPropagation();
        guideDragTo(ev);
        return;
      }
      const b = box.getBoundingClientRect(),
        S = guideShapes(b.width, b.height),
        e = S && guideEdgeAt(S, ev.clientX - b.left, ev.clientY - b.top);
      engineEditor.guideHover = e;
      box.style.cursor = e ? (e[1] === 'w' ? 'ew-resize' : 'ns-resize') : '';
    },
    true
  );
  const end = ev => {
    if (!engineEditor.guideDrag) return;
    ev.stopPropagation();
    guideDragTo(ev);
    engineEditor.guideDrag = null;
    changed();
    commit(true);
    refreshEngineSettings();
  };
  box.addEventListener('pointerup', end, true);
  box.addEventListener('pointercancel', end, true);
  if (engineEditor.guides && !engineEditor.guideRaf) drawCameraGuides();
  if (engineEditor.blurGuides && !engineEditor.blurRaf) drawBlurGuides();
  walkView.opt.dofView = !!engineEditor.heat;
}
/* CAM-2: "Play moment": a talk or a boss stands 3 m up the screen from you, standing still starts at once, and an
   encounter swoops at a spot 2.5 m up the screen (then lets go, no battle) */
ACTIONS.engMoment = d => {
  const P = walkView.pl,
    I = walkRenderer.camInfo;
  if (!P || !I) return;
  const F = [-I.right[1], I.right[0]],
    at = r => [P.x + F[0] * r, P.z + F[1] * r];
  if (d.m === 'encounter') {
    const e = at(2.5),
      S = {
        x: P.x * 0.6 + e[0] * 0.4,
        z: P.z * 0.6 + e[1] * 0.4,
        px: P.x,
        pz: P.z,
        ex: e[0],
        ez: e[1],
        zoom: engineSetting('camera', 'encZoom'),
        arrived: false,
      };
    walkRenderer.swoop = S;
    setTimeout(
      () => {
        if (walkRenderer.swoop === S) walkRenderer.swoop = null;
      },
      engineSetting('camera', 'encMax') + 600
    );
    return;
  }
  walkRenderer.momentTest = {
    id: d.m,
    at: d.m === 'idle' ? null : at(3),
    until: walkView.t + (d.m === 'idle' ? 6000 : 3500),
  };
};
/* CAM-3: the blur guides. The ground round you, in 1 m cells over 48 m, tinted where the blur keeps it sharp: each
   cell's distance from this frame's plane of focus (walkRenderer.lensPlane) through the blur's own curve
   (logic/lens-focus.js focusBlur, the band and ramps of the 16 m walk reference), so the strip shown is the shader's;
   a dot where the focus is, and a line with the blur's path, what the focus is on, the tilt and the strength */
function drawBlurGuides() {
  const g = $('#engBlur');
  if (!g || !engineEditor.blurGuides || studioState.sec !== 'engine') {
    engineEditor.blurRaf = 0;
    return;
  }
  engineEditor.blurRaf = requestAnimationFrame(drawBlurGuides);
  const r = window.devicePixelRatio || 1,
    w = g.clientWidth,
    h = g.clientHeight;
  if (g.width !== Math.round(w * r) || g.height !== Math.round(h * r)) {
    g.width = Math.round(w * r);
    g.height = Math.round(h * r);
  }
  const x = g.getContext('2d');
  x.setTransform(r, 0, 0, r, 0, 0);
  x.clearRect(0, 0, w, h);
  const C = walkView.C,
    FP = walkRenderer.lensPlane,
    L = walkRenderer.lensInfo,
    P = walkView.pl;
  if (!C || !C.vp || !FP || !L || !P) return;
  const band = 16 * engineSetting('lens', 'focusBand'),
    rampF = 16 * engineSetting('lens', 'blurFar'),
    rampN = 16 * engineSetting('lens', 'blurNear'),
    gy = (/** @type {number} */ px, /** @type {number} */ pz) =>
      typeof standingHeightAt === 'function' ? standingHeightAt(px, pz) : walkRenderer.camT ? walkRenderer.camT[2] : 0,
    cx = Math.round(P.x),
    cz = Math.round(P.z);
  for (let i = -24; i < 24; i++)
    for (let j = -24; j < 24; j++) {
      const a = cx + i + 0.5,
        b = cz + j + 0.5,
        k = focusBlur(planeDistance(FP, [a, gy(a, b), b]), band, rampF, rampN);
      if (k > 0.02) continue;
      const q = [
        [a - 0.5, b - 0.5],
        [a + 0.5, b - 0.5],
        [a + 0.5, b + 0.5],
        [a - 0.5, b + 0.5],
      ].map(([u, v]) => guideProject(C, w, h, u, gy(u, v), v));
      if (!q.every(Boolean)) continue;
      x.beginPath();
      q.forEach((p, n) => (n ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
      x.closePath();
      x.fillStyle = 'rgba(80, 255, 140, 0.22)';
      x.fill();
    }
  const f = guideProject(C, w, h, L.at[0], gy(L.at[0], L.at[1]) + 0.8, L.at[1]);
  if (f) {
    x.beginPath();
    x.arc(f[0], f[1], 5, 0, Math.PI * 2);
    x.fillStyle = 'rgba(80, 255, 140, 1)';
    x.fill();
  }
  const line = `blur ${L.path} · focus on ${L.on} · ${L.focus.toFixed(1)} m · tilt ${L.tilt.toFixed(2)} · strength ${L.blur.toFixed(2)}`;
  x.font = '12px system-ui, sans-serif';
  x.fillStyle = 'rgba(0, 0, 0, 0.55)';
  x.fillRect(6, h - 26, x.measureText(line).width + 12, 20);
  x.fillStyle = '#fff';
  x.fillText(line, 12, h - 12);
}
ACTIONS.engBlurGuides = () => {
  engineEditor.blurGuides = !engineEditor.blurGuides;
  if (engineEditor.blurGuides) engineEditor.open.lens = 1;
  const g = $('#engBlur'),
    b = $('#engBlurBtn');
  if (g) g.hidden = !engineEditor.blurGuides;
  if (b) b.classList.toggle('on', engineEditor.blurGuides);
  if (engineEditor.blurGuides && !engineEditor.blurRaf) drawBlurGuides();
};
ACTIONS.engHeat = () => {
  engineEditor.heat = !engineEditor.heat;
  walkView.opt.dofView = engineEditor.heat;
  const b = $('#engHeatBtn');
  if (b) b.classList.toggle('on', engineEditor.heat);
};
ACTIONS.engGuides = () => {
  engineEditor.guides = !engineEditor.guides;
  /* the zones' dials show beside the guides they draw */
  if (engineEditor.guides) engineEditor.open.camera = 1;
  const g = $('#engGuides'),
    b = $('#engGuidesBtn');
  if (g) g.hidden = !engineEditor.guides;
  if (b) b.classList.toggle('on', engineEditor.guides);
  refreshEngineSettings();
  if (engineEditor.guides && !engineEditor.guideRaf) drawCameraGuides();
};
