'use strict';
/* ================= POCKET BILLIES STUDIO · engine =================
   Every dial of the 3D renderer (game/js/engine/settings.js): lens blur, chromatic aberration, bloom, the sun,
   shadows, lights, haze, grass, water, camera and quality. Set them for the whole game, or override them for one walk
   scene. The live preview runs the game's renderer on your unsaved values, so every change shows immediately. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
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
import { rebuildFromSettings } from '../../game/js/walk/map-cache.js';
import { adaptQuality, setAdaptQuality } from '../../game/js/walk/quality-cull.js';
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
  captureLookPreview: [() => captureLookPreview, v => (captureLookPreview = v)],
  engineData: [() => engineData],
  engineDialHTML: [() => engineDialHTML, v => (engineDialHTML = v)],
  engineEditor: [() => engineEditor],
  engineEditorMapId: [() => engineEditorMapId],
  engineGroupHTML: [() => engineGroupHTML, v => (engineGroupHTML = v)],
  enginePresetsHTML: [() => enginePresetsHTML, v => (enginePresetsHTML = v)],
  engineScopePath: [() => engineScopePath],
  engineSettingsHTML: [() => engineSettingsHTML, v => (engineSettingsHTML = v)],
  formatDialValue: [() => formatDialValue],
  inheritedDialValue: [() => inheritedDialValue, v => (inheritedDialValue = v)],
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
   <button class="btn sm" id="engCmp" title="Hold to see the built-in look without any of your settings">Hold to compare</button></div>
  <div class="sc-pv eng-pv"><canvas id="engPv" data-keep="walk-gl"></canvas><div class="sc-pv-load" id="engPvLoad">Loading…</div></div>
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
