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
import {
  adaptQuality,
  mountWalkView,
  rebuildFromSettings,
  setAdaptQuality,
  walkRenderer,
} from '../../game/js/walk-view-gl.js';
import { esc } from './game-stand-ins.js';
import {
  ACTS,
  SECTIONS,
  after,
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
  uidKey,
  writePath,
} from './studio-app.js';
import { atlasGet } from './sprites.js';
import { scArt, scD, scExitNames } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  ENS: [() => ENS],
  engBase: [() => engBase],
  engD: [() => engD],
  engField: [() => engField, v => (engField = v)],
  engFmt: [() => engFmt],
  engGrab: [() => engGrab, v => (engGrab = v)],
  engGroup: [() => engGroup, v => (engGroup = v)],
  engInherited: [() => engInherited, v => (engInherited = v)],
  engMount: [() => engMount, v => (engMount = v)],
  engPresets: [() => engPresets, v => (engPresets = v)],
  engPrune: [() => engPrune],
  engRefresh: [() => engRefresh],
  engScene: [() => engScene],
  engSettingsHTML: [() => engSettingsHTML, v => (engSettingsHTML = v)],
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
export const ENS = { scope: 'game', scene: null, open: { lens: 1, color: 1, sun: 1, shadows: 1 }, meterT: null };
export const engD = () => studioState.D.engine || (studioState.D.engine = { defaults: {}, presets: {} });
const engScene = () => {
  const S = studioState.D.scenes || {};
  if (!S[ENS.scene])
    ENS.scene = studioState.sel.scene && S[studioState.sel.scene] ? studioState.sel.scene : Object.keys(S)[0] || null;
  return ENS.scene;
};
const engBase = () =>
  ENS.scope === 'scene' ? `scenes.${engScene()}.look` : ENS.scope === 'map' ? 'engine.map' : 'engine.defaults';
/* what a dial would be without the scope being edited */
function engInherited(g, k) {
  if (ENS.scope !== 'game') {
    const d = (engD().defaults || {})[g];
    if (d && d[k] !== undefined) return d[k];
  }
  return ENGINE_DEFAULTS[g][k];
}
export const engFmt = (v, step) => {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v !== 'number') return String(v);
  const t = v.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0);
  return t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
};
function engField(g, f) {
  const [k, label] = f,
    typ = typeof f[2] === 'string' ? f[2] : 'range',
    p = `${engBase()}.${g}.${k}`,
    own = readPath(p),
    inh = engInherited(g, k),
    v = own !== undefined ? own : inh;
  const help = typ === 'range' ? f[5] : typ === 'sel' ? null : f[3],
    reset = `<button class="eng-reset" data-act="engReset" data-p="${p}" title="Back to ${ENS.scope === 'scene' ? 'the game default' : 'the built-in value'} (${esc(engFmt(inh, f[4] || 1))})">↺</button>`;
  let body = '';
  if (typ === 'range')
    body = `<span class="eng-lab">${esc(label)} <output id="${fieldOutputId(p)}">${engFmt(v, f[4])}</output></span><input type="range" data-p="${p}" data-k="num" value="${v}" min="${f[2]}" max="${f[3]}" step="${f[4]}">`;
  else if (typ === 'bool')
    body = `<label class="eng-chk"><input type="checkbox" data-p="${p}" data-k="bool" ${v ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  else if (typ === 'sel')
    body = `<span class="eng-lab">${esc(label)}</span><select data-p="${p}" data-k="${typeof f[3][0][0] === 'number' ? 'num' : 'sel'}">${f[3].map(([a, n]) => `<option value="${a}" ${String(v) === String(a) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  else if (typ === 'color' || typ === 'color?') {
    const ok = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    body = `<span class="eng-lab">${esc(label)}${!ok ? ' <i class="eng-auto">from the scene</i>' : ''}</span><span class="colw"><input type="color" data-p="${p}" data-k="color" value="${ok ? v : '#888888'}"><input type="text" data-p="${p}" data-k="color" value="${ok ? esc(v) : ''}" placeholder="${typ === 'color?' ? 'scene’s own' : ''}" maxlength="7" class="hex"></span>`;
  } else if (typ === 'num?')
    body = `<span class="eng-lab">${esc(label)}</span><input type="number" data-p="${p}" data-k="num" data-opt="1" step="any" value="${v == null ? '' : v}" placeholder="scene’s own">`;
  return `<div class="eng-f ${own !== undefined ? 'own' : ''}" data-path="${p}">${body}${reset}${help ? `<small class="help">${esc(help)}</small>` : ''}</div>`;
}
function engGroup([g, title, fields]) {
  const set = fields.filter(f => readPath(`${engBase()}.${g}.${f[0]}`) !== undefined).length,
    open = ENS.open[g];
  return `<section class="card eng-g ${open ? 'open' : ''}"><header><button class="eng-gh" data-act="engOpen" data-g="${g}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${esc(title)}</h3>${set ? `<span class="badge">${set} set</span>` : ''}</button>${set ? `<button class="btn sm subtle" data-act="engResetG" data-g="${g}">Reset</button>` : ''}</header>
 ${open ? `<div class="card-b eng-fields">${fields.map(f => engField(g, f)).join('')}</div>` : ''}</section>`;
}
function engPresets() {
  const own = engD().presets || {};
  return `<div class="eng-pre">${Object.entries(ENGINE_PRESETS)
    .map(([k, P]) => `<button class="seg" data-act="engPreset" data-k="${k}">${esc(P.name)}</button>`)
    .join('')}
 ${Object.entries(own)
   .map(
     ([k, P]) =>
       `<span class="eng-own"><button class="seg" data-act="engPreset" data-k="${esc(k)}" data-own="1">${esc(P.name || k)}</button><button class="eng-x" data-act="engPresetDel" data-k="${esc(k)}" title="Delete this preset">×</button></span>`
   )
   .join('')}
 <button class="seg add" data-act="engPresetSave">+ Save as preset</button><button class="seg" data-act="engLookPreviews" title="Draws the preview once with each look and shows them side by side">Preview every look</button></div><p class="help">A preset only changes the dials it lists, on ${ENS.scope === 'scene' ? 'this scene' : ENS.scope === 'map' ? 'the map' : 'the whole game'}. Undo takes it back.</p>`;
}
function engSettingsHTML() {
  const sid = engScene(),
    sc = sid ? studioState.D.scenes[sid] : null,
    nScene = sc && sc.look ? Object.values(sc.look).reduce((a, o) => a + Object.keys(o || {}).length, 0) : 0,
    nGame = Object.values(engD().defaults || {}).reduce((a, o) => a + Object.keys(o || {}).length, 0),
    nMap = Object.values(engD().map || {}).reduce((a, o) => a + Object.keys(o || {}).length, 0);
  return `<div class="card eng-scope"><div class="card-b"><div class="seg-row"><button class="seg ${ENS.scope === 'game' ? 'on' : ''}" data-act="engScope" data-s="game">Whole game${nGame ? ` · ${nGame}` : ''}</button><button class="seg ${ENS.scope === 'scene' ? 'on' : ''}" data-act="engScope" data-s="scene">Only ${esc(sc ? sc.name || sid : 'this scene')}${nScene ? ` · ${nScene}` : ''}</button><button class="seg ${ENS.scope === 'map' ? 'on' : ''}" data-act="engScope" data-s="map">World map${nMap ? ` · ${nMap}` : ''}</button></div>
 <p class="help">${ENS.scope === 'map' ? 'These override the game-wide values on the Map tab (lens, color, bloom). The preview here shows a walk scene; open the game to see the map.' : ENS.scope === 'scene' ? 'These override the game-wide values for this one scene. A dial you haven’t touched follows the game.' : 'These apply to every walk scene unless a scene overrides them. A dial you haven’t touched uses the built-in value.'} Dials you’ve set show a ↺ to undo just that one.</p>
 <h4>Presets</h4>${engPresets()}
 <div class="seg-row"><button class="btn sm subtle" data-act="engClear">Clear everything set here</button>${ENS.scope === 'scene' && nScene ? `<button class="btn sm subtle" data-act="engPromote">Use these for the whole game</button>` : ''}</div></div></div>
 ${ENGINE_SPEC.map(engGroup).join('')}`;
}
SECTIONS.engine = () => {
  const sid = engScene();
  after(engMount);
  if (!sid)
    return `<div class="ed-col solo"><h2>Engine</h2><p class="help">Add a walk scene first; the preview needs one.</p></div>`;
  const opts = Object.entries(studioState.D.scenes)
    .map(([k, s]) => `<option value="${esc(k)}" ${k === sid ? 'selected' : ''}>${esc(s.name || k)}</option>`)
    .join('');
  return `<div class="eng-split"><div class="eng-set" id="engSet">${engSettingsHTML()}</div>
 <div class="eng-side"><div class="card"><div class="card-b"><div class="eng-pvbar"><label class="fld"><span>Preview scene</span><select id="engScene">${opts}</select></label>
   <button class="btn sm" id="engCmp" title="Hold to see the built-in look without any of your settings">Hold to compare</button></div>
  <div class="sc-pv eng-pv"><canvas id="engPv"></canvas><div class="sc-pv-load" id="engPvLoad">Loading…</div></div>
  <div class="eng-meter" id="engMeter">–</div>
  <p class="help">Click the ground to walk, drag to turn, scroll to zoom. What you see is the game’s own renderer with your unsaved values. Battles happen inside the walk scene, so they follow its look.</p></div></div></div></div>`;
};
async function engMount() {
  const cv = $('#engPv'),
    id = engScene();
  if (!cv || !id) return;
  const C = scD();
  await Promise.all(scArt(C).map(p => atlasGet('art/' + p).catch(() => null)));
  if (!$('#engPv')) return;
  walkView.pl.t = -1;
  mountWalkView(cv, id, {
    state: () => ({
      mode: 'roam',
      roam: true,
      pos: ENS.pos && ENS.pos[0] === id ? ENS.pos[1] : mapHub(studioState.D.scenes[id]),
      who: 'boy',
      enc: [
        { id: 'pv1', lvl: 5 },
        { id: 'pv2', lvl: 7 },
      ],
      npcs: [],
      exits: typeof scExitNames === 'function' ? scExitNames(id) : [],
    }),
    onMove: (x, z) => {
      ENS.pos = [id, [x, z]];
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
    ENS.scene = e.target.value;
    render();
  };
  const b = $('#engCmp'),
    on = v => {
      engineContext.bypass = v;
      b.classList.toggle('on', v);
    };
  b.onpointerdown = () => on(true);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => on(false)));
  clearInterval(ENS.meterT);
  ENS.meterT = setInterval(() => {
    const m = $('#engMeter');
    if (!m || studioState.sec !== 'engine') {
      clearInterval(ENS.meterT);
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
    clearTimeout(ENS.rbT);
    ENS.rbT = setTimeout(() => {
      if (typeof rebuildFromSettings === 'function') rebuildFromSettings();
    }, 350);
  }
};
export const engRefresh = () => {
  const s = $('#engSet');
  if (s) {
    const y = $('#main').scrollTop;
    s.innerHTML = engSettingsHTML();
    $('#main').scrollTop = y;
  }
};
const engPrune = () => {
  const base = readPath(engBase());
  if (!base) return;
  for (const g of Object.keys(base)) {
    for (const k of Object.keys(base[g] || {})) if (base[g][k] === undefined) delete base[g][k];
    if (!base[g] || !Object.keys(base[g]).length) delete base[g];
  }
  if (ENS.scope !== 'game' && !Object.keys(base).length) writePath(engBase(), undefined);
};
ACTS.engScope = d => {
  ENS.scope = d.s;
  engRefresh();
};
ACTS.engOpen = d => {
  ENS.open[d.g] = !ENS.open[d.g];
  engRefresh();
};
ACTS.engReset = d => {
  writePath(d.p, undefined);
  engPrune();
  changed();
  commit(true);
  engRefresh();
};
ACTS.engResetG = d => {
  writePath(`${engBase()}.${d.g}`, undefined);
  engPrune();
  changed();
  commit(true);
  engRefresh();
};
ACTS.engClear = async () => {
  if (!readPath(engBase())) return toast('Nothing is set here.');
  if (
    !(await ask(`Clear every engine setting on ${ENS.scope === 'scene' ? 'this scene' : 'the whole game'}?`, 'Clear'))
  )
    return;
  writePath(engBase(), ENS.scope === 'game' ? {} : undefined);
  changed();
  commit(true);
  engRefresh();
};
ACTS.engPromote = async () => {
  const look = readPath(engBase());
  if (!look) return;
  if (!(await ask('Copy this scene’s settings to the whole game and clear them from the scene?', 'Copy'))) return;
  const d = engD().defaults || (engD().defaults = {});
  for (const [g, o] of Object.entries(look)) {
    d[g] = Object.assign(d[g] || {}, o);
  }
  writePath(engBase(), undefined);
  changed();
  commit(true);
  ENS.scope = 'game';
  engRefresh();
};
ACTS.engPreset = d => {
  const P = d.own ? (engD().presets || {})[d.k] : ENGINE_PRESETS[d.k];
  if (!P) return;
  for (const [g, o] of Object.entries(P.v || {}))
    for (const [k, v] of Object.entries(o))
      if (ENGINE_DEFAULTS[g] && k in ENGINE_DEFAULTS[g]) writePath(`${engBase()}.${g}.${k}`, v);
  changed();
  commit(true);
  engRefresh();
  toast(`${P.name || d.k} applied${ENS.scope === 'scene' ? ' to this scene' : ''}.`);
};
ACTS.engPresetSave = async () => {
  const cur = readPath(engBase());
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
  const ps = engD().presets || (engD().presets = {}),
    k = uidKey(name, x => !!ps[x] || !!ENGINE_PRESETS[x]);
  ps[k] = { name, v: clone(cur) };
  changed();
  commit(true);
  engRefresh();
  toast('Preset saved.');
};
ACTS.engPresetDel = async d => {
  if (!(await ask(`Delete the preset “${(engD().presets[d.k] || {}).name || d.k}”?`, 'Delete'))) return;
  delete engD().presets[d.k];
  changed();
  commit(true);
  engRefresh();
};

/* v29: look previews. The preview is drawn once with each preset (nothing is changed), then they're shown side by side;
   click one to apply it */
function engGrab() {
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
ACTS.engLookPreviews = async () => {
  if (!$('#engPv')) return;
  const own = engD().presets || {},
    all = [
      ...Object.entries(ENGINE_PRESETS).map(([k, P]) => [k, P, 0]),
      ...Object.entries(own).map(([k, P]) => [k, P, 1]),
    ],
    keep = clone(readPath(engBase()) || {}),
    out = [];
  toast('Drawing each look…');
  try {
    for (const [k, P, o] of all) {
      writePath(engBase(), clone(keep));
      for (const [g, v] of Object.entries(P.v || {}))
        for (const [kk, vv] of Object.entries(v))
          if (ENGINE_DEFAULTS[g] && kk in ENGINE_DEFAULTS[g]) writePath(`${engBase()}.${g}.${kk}`, vv);
      await new Promise(r => setTimeout(r, 650));
      out.push([k, P, o, await engGrab()]);
    }
  } finally {
    writePath(engBase(), Object.keys(keep).length ? keep : ENS.scope === 'game' ? {} : undefined);
  }
  const cur = await engGrab();
  await dialog(
    'Every look on this scene',
    `<div class="eng-looks">${cur ? `<figure><img src="${cur}" alt="As it is now"><figcaption>As it is now</figcaption></figure>` : ''}${out.map(([k, P, o, u]) => `<figure class="eng-look" data-act="engPreset" data-k="${esc(k)}" ${o ? 'data-own="1"' : ''} role="button" tabindex="0">${u ? `<img src="${u}" alt="${esc(P.name || k)}">` : '<div class="help">No picture</div>'}<figcaption>${esc(P.name || k)}</figcaption></figure>`).join('')}</div><p class="help">Click a look to apply it (Undo takes it back).</p>`,
    [{ l: 'Close', v: null }]
  );
};
