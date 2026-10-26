'use strict';
/* ================= POCKET BILLIES STUDIO · camera (camera track CAM-4a) =================
   Every dial of the walking camera in one place, in folders (game/js/engine/settings.js CAMERA_FOLDERS): framing,
   zoom, the zoom's feel, follow, moments, visibility and the island orbit. The data stays where the Engine section kept
   it (engine.defaults.camera, a scene's look.camera) and a scene's own `cam` (tilt, height, width shown). Beside it the
   Engine section's live preview, with the camera's real numbers (tilt, height, distance, field of view, metres across,
   how big an art pixel comes out), frames the shape of a phone or a desktop, a zoom slider, a snapshot to hold against,
   the camera guides and Play moment. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { walkView } from '../../game/js/walk-view.js';
import { CAMERA_FOLDERS, ENGINE_SPEC, engineSetting } from '../../game/js/engine/settings.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { zoomLimits } from '../../game/js/walk/camera.js';
import { escapeHtml } from './game-stand-ins.js';
import { cameraReadout, crispScale, gameRenderWidth } from '../../game/js/logic/camera-readout.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  changed,
  clone,
  commit,
  readPath,
  studioState,
  toast,
  writePath,
} from './studio-app.js';
import {
  applyEngineEnvironment,
  engineData,
  engineDialHTML,
  engineEditor,
  engineEditorMapId,
  enginePreviewBoxHTML,
  engineScopePath,
  mountEnginePreview,
  refreshEngineSettings,
} from './engine-editor.js';
/* eslint-disable no-func-assign */
expose({
  CAMERA_FRAMES: [() => CAMERA_FRAMES],
  cameraEditor: [() => cameraEditor],
  cameraFolderHTML: [() => cameraFolderHTML, v => (cameraFolderHTML = v)],
  cameraHold: [() => cameraHold, v => (cameraHold = v)],
  cameraPlaces: [() => cameraPlaces, v => (cameraPlaces = v)],
  cameraPreviewBarsHTML: [() => cameraPreviewBarsHTML, v => (cameraPreviewBarsHTML = v)],
  cameraReadoutHTML: [() => cameraReadoutHTML, v => (cameraReadoutHTML = v)],
  cameraScope: [() => cameraScope],
  cameraSettingsHTML: [() => cameraSettingsHTML, v => (cameraSettingsHTML = v)],
  cameraSpec: [() => cameraSpec],
  countSet: [() => countSet],
  mountCameraSection: [() => mountCameraSection, v => (mountCameraSection = v)],
  sceneCameraHTML: [() => sceneCameraHTML, v => (sceneCameraHTML = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const cameraEditor = {
  /* the preview's shape: fill, portrait, landscape, desktop */
  frame: 'fill',
  /* a snapshot of the camera dials to hold against ({game, scene}), or null (hold shows the built-in camera) */
  snap: null,
  /* while the compare button is held: the dials put aside */
  held: null,
  readT: 0,
};
/* the reference screens of the frames (CSS pixels and pixel ratio), for how big an art pixel comes out there */
const CAMERA_FRAMES = [
  ['fill', 'Fill', null],
  ['portrait', 'Phone portrait', [393, 852, 3]],
  ['landscape', 'Phone landscape', [852, 393, 3]],
  ['desktop', 'Desktop', [1920, 1080, 1]],
];
const cameraSpec = () => (ENGINE_SPEC.find(G => G[0] === 'camera') || ['camera', 'Camera', []])[2];
/* the camera section edits the whole game or one scene; the world map's scope is the Engine section's only */
const cameraScope = () => {
  if (engineEditor.scope === 'map') engineEditor.scope = 'game';
  return engineEditor.scope;
};
const countSet = o => Object.keys((o && o.camera) || {}).length;
/* the scene's own camera (map.schema.json `cam`): its tilt, height and width shown, under the dials */
function sceneCameraHTML() {
  const id = engineEditorMapId(),
    c = (studioState.D.maps[id] || {}).cam || {},
    row = (k, label, help) =>
      `<div class="eng-f ${c[k] != null ? 'own' : ''}" data-path="maps.${escapeHtml(id)}.cam.${k}"><span class="eng-lab">${escapeHtml(label)}</span><input type="number" data-p="maps.${escapeHtml(id)}.cam.${k}" data-k="num" data-opt="1" step="any" value="${c[k] == null ? '' : c[k]}" placeholder="built-in"><small class="help">${escapeHtml(help)}</small></div>`;
  return `<div class="cam-scene"><h4>This scene’s own camera</h4>${row('pitch', 'Tilt (degrees)', 'Blank: 34. The dials’ tilt adjustment is added to it.')}${row('h', 'Height (m)', 'Blank: 9. Times the Distance dial.')}${row('fov', 'Width shown', 'Blank: 1. Above 1 the scene shows less, so it looks closer.')}</div>`;
}
function cameraFolderHTML([id, title, keys]) {
  const spec = cameraSpec(),
    fields = keys.map(k => spec.find(f => f[0] === k)).filter(Boolean),
    set = fields.filter(f => readPath(`${engineScopePath()}.camera.${f[0]}`) !== undefined).length,
    open = engineEditor.camOpen[id];
  return `<section class="card eng-g ${open ? 'open' : ''}" data-cam-folder="${id}"><header><button class="eng-gh" data-act="camOpen" data-f="${id}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${escapeHtml(title)}</h3>${set ? `<span class="badge">${set} set</span>` : ''}</button>${set ? `<button class="btn sm subtle" data-act="camResetF" data-f="${id}">Reset</button>` : ''}</header>
 ${open ? `<div class="card-b eng-fields">${fields.map(f => engineDialHTML('camera', f)).join('')}${id === 'framing' ? sceneCameraHTML() : ''}</div>` : ''}</section>`;
}
function cameraSettingsHTML() {
  const sc = cameraScope(),
    sid = engineEditorMapId(),
    S = sid ? studioState.D.maps[sid] : null,
    nGame = countSet(engineData().defaults),
    nScene = countSet(S && S.look);
  return `<div class="card eng-scope"><div class="card-b"><div class="seg-row"><button class="seg ${sc === 'game' ? 'on' : ''}" data-act="engScope" data-s="game">Whole game${nGame ? ` · ${nGame}` : ''}</button><button class="seg ${sc === 'scene' ? 'on' : ''}" data-act="engScope" data-s="scene">Only ${escapeHtml(S ? S.name || sid : 'this scene')}${nScene ? ` · ${nScene}` : ''}</button></div>
 <p class="help">${sc === 'scene' ? 'These override the game’s camera for this one scene. A dial you haven’t touched follows the game.' : 'The walking camera in every scene, unless a scene overrides it. Light, blur and color are in Engine.'}</p>
 <div class="seg-row"><button class="btn sm subtle" data-act="camClear">Clear the camera set here</button>${sc === 'scene' && nScene ? '<button class="btn sm subtle" data-act="camPromote">Use these for the whole game</button>' : ''}</div></div></div>
 ${CAMERA_FOLDERS.map(cameraFolderHTML).join('')}`;
}
engineEditor.camHTML = cameraSettingsHTML;
studioState.hooks.camera = (p, v) => {
  if (studioState.hooks.engine) studioState.hooks.engine(p, v);
};
function cameraPreviewBarsHTML() {
  const [zMin, zMax] = zoomLimits(),
    z = typeof walkRenderer !== 'undefined' ? walkRenderer.zoomT : 1;
  return `<div class="eng-pvbar cam-bar">Frame ${CAMERA_FRAMES.map(([k, n]) => `<button class="seg ${cameraEditor.frame === k ? 'on' : ''}" data-act="camFrame" data-k="${k}">${n}</button>`).join('')}</div>
  <div class="eng-pvbar cam-bar"><label class="fld cam-zoom"><span>Your zoom <output id="camZoomV">${z.toFixed(2)}</output></span><input type="range" id="camZoom" min="${zMin}" max="${zMax}" step="0.01" value="${z}"></label><button class="btn sm" data-act="camZoomReset" title="Back to zoom 1, the scene’s own framing (R in the game)">Zoom 1</button></div>
  <div class="eng-pvbar cam-bar"><button class="btn sm" id="camSnapBtn" data-act="camSnap" title="Keeps the camera dials as they are now, to hold against later">${cameraEditor.snap ? 'Snapshot again' : 'Snapshot'}</button><button class="btn sm" id="camCmp" title="Hold to see the camera as it was at the snapshot (or the built-in camera, without a snapshot); light and blur stay as they are">${cameraEditor.snap ? 'Hold: snapshot' : 'Hold: built-in'}</button>
   <button class="btn sm ${engineEditor.guides ? 'on' : ''}" id="engGuidesBtn" data-act="engGuides" title="Draws the camera's dead and soft zones (drag their edges), its aim, the look-ahead, the points of interest and the camera zones on the preview">Camera guides</button></div>
  <div class="eng-pvbar cam-bar" title="CAM-2: plays one of the camera's moments in the preview, as if it happened (a talk or a boss 3 m up the screen)">Play moment ${[
    ['talk', 'Talk'],
    ['encounter', 'Encounter'],
    ['boss', 'Boss'],
    ['idle', 'Standing still'],
  ]
    .map(([k, n]) => `<button class="btn sm" data-act="engMoment" data-m="${k}">${n}</button>`)
    .join('')}</div>`;
}
SECTIONS.camera = () => {
  const sid = engineEditorMapId();
  cameraScope();
  if (!sid)
    return `<div class="ed-col solo"><h2>Camera</h2><p class="help">Add a walk scene first; the preview needs one.</p></div>`;
  afterRender(mountEnginePreview);
  afterRender(applyEngineEnvironment);
  afterRender(mountCameraSection);
  const opts = Object.entries(studioState.D.maps)
    .map(
      ([k, s]) => `<option value="${escapeHtml(k)}" ${k === sid ? 'selected' : ''}>${escapeHtml(s.name || k)}</option>`
    )
    .join('');
  return `<div class="eng-split"><div class="eng-set" id="engSet">${cameraSettingsHTML()}</div>
 <div class="eng-side"><div class="card"><div class="card-b"><div class="eng-pvbar"><label class="fld"><span>Preview scene</span><select id="engScene">${opts}</select></label></div>
  ${cameraPreviewBarsHTML()}
  ${enginePreviewBoxHTML('cam-pv frame-' + cameraEditor.frame)}
  <div class="cam-read" id="camRead">–</div>
  <p class="help">Click the ground to walk, drag to turn, Ctrl+scroll to zoom (as in the game). The numbers are the camera’s now: the tilt down, the camera’s height above where it aims and its distance, the field of view up and down, the metres shown across where it aims, and how many of the game’s drawing pixels one art pixel (1/32 m) covers there; on a phone or desktop frame, on that screen.</p></div></div></div></div>`;
};
/* ---- the readout, the zoom slider and the compare button ---- */
function cameraReadoutHTML() {
  const C = walkView.C;
  if (typeof walkRenderer === 'undefined' || !walkRenderer.on || !C || !C.gl) return 'Starting…';
  const R = cameraReadout(C),
    I = walkRenderer.camInfo,
    F = CAMERA_FRAMES.find(f => f[0] === cameraEditor.frame),
    px = v => {
      const c = crispScale(v);
      return `<b class="${c.crisp ? 'cam-crisp' : ''}" title="${c.crisp ? `Crisp: ${c.n} whole pixels an art pixel` : `Between whole pixels (${c.n} is nearest)`}">${v.toFixed(2)}</b>`;
    };
  let screen = '';
  if (F && F[2]) {
    const [w, h, dpr] = F[2],
      rw = gameRenderWidth(w, h, dpr, engineSetting('quality', 'resolution'));
    screen = ` · on a ${escapeHtml(F[1].toLowerCase())} (${w}×${h}, ${dpr}x) ${px((R.artPx * rw) / C.rw)} px`;
  }
  const zoom = I && I.zoom != null ? I.zoom : walkRenderer.zoom;
  return `Tilt <b>${R.tilt.toFixed(1)}°</b> · height <b>${R.height.toFixed(1)} m</b> · distance <b>${R.dist.toFixed(1)} m</b> · field of view <b>${R.vfov.toFixed(1)}°</b> · <b>${R.across.toFixed(1)} m</b> across<br>An art pixel: here ${px(R.artPx)} px${screen} · zoom <b>${walkRenderer.zoom.toFixed(2)}</b>${Math.abs(zoom - walkRenderer.zoom) > 0.005 ? ` (with the moments <b>${zoom.toFixed(2)}</b>)` : ''}${I && I.moment ? ` · moment <b>${escapeHtml(I.moment)}</b>` : ''}`;
}
function mountCameraSection() {
  clearInterval(cameraEditor.readT);
  cameraEditor.readT = setInterval(() => {
    const el = $('#camRead');
    if (!el || studioState.sec !== 'camera') {
      clearInterval(cameraEditor.readT);
      cameraEditor.readT = 0;
      return;
    }
    el.innerHTML = cameraReadoutHTML();
    /* the slider follows the zoom when something else (a pinch, the wheel, R) changes it */
    const s = $('#camZoom'),
      o = $('#camZoomV');
    if (s && document.activeElement !== s && typeof walkRenderer !== 'undefined') {
      s.value = String(walkRenderer.zoomT);
      if (o) o.textContent = walkRenderer.zoomT.toFixed(2);
    }
  }, 250);
  const s = $('#camZoom');
  if (s)
    s.oninput = () => {
      walkRenderer.zoomT = +s.value;
      const o = $('#camZoomV');
      if (o) o.textContent = (+s.value).toFixed(2);
    };
  const b = $('#camCmp');
  if (b) {
    b.onpointerdown = () => cameraHold(true);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => cameraHold(false)));
  }
}
/* the two places camera dials live for the preview: the game's and the preview scene's */
function cameraPlaces() {
  const D = engineData(),
    S = studioState.D.maps[engineEditorMapId()];
  return { D: D.defaults || (D.defaults = {}), S };
}
/* hold: the camera dials of the snapshot (or none: the built-in camera) stand in until let go; nothing is saved */
function cameraHold(on) {
  const b = $('#camCmp');
  if (on && !cameraEditor.held) {
    const { D, S } = cameraPlaces(),
      snap = cameraEditor.snap;
    cameraEditor.held = { game: D.camera, scene: S && S.look ? S.look.camera : undefined, S };
    D.camera = snap ? clone(snap.game || {}) : {};
    if (S && S.look) S.look.camera = snap && snap.scene ? clone(snap.scene) : {};
    if (b) b.classList.add('on');
  } else if (!on && cameraEditor.held) {
    const { D } = cameraPlaces(),
      H = cameraEditor.held;
    if (H.game === undefined) delete D.camera;
    else D.camera = H.game;
    if (H.S && H.S.look) {
      if (H.scene === undefined) delete H.S.look.camera;
      else H.S.look.camera = H.scene;
    }
    cameraEditor.held = null;
    if (b) b.classList.remove('on');
  }
}
/* ---- actions ---- */
ACTIONS.camOpen = d => {
  engineEditor.camOpen[d.f] = !engineEditor.camOpen[d.f];
  refreshEngineSettings();
};
ACTIONS.camResetF = d => {
  const F = CAMERA_FOLDERS.find(f => f[0] === d.f),
    base = readPath(`${engineScopePath()}.camera`);
  if (!F || !base) return;
  for (const k of F[2]) delete base[k];
  if (!Object.keys(base).length) writePath(`${engineScopePath()}.camera`, undefined);
  changed();
  commit(true);
  refreshEngineSettings();
};
ACTIONS.camClear = async () => {
  if (!readPath(`${engineScopePath()}.camera`)) return toast('No camera dial is set here.');
  if (
    !(await ask(
      `Clear every camera dial set on ${engineEditor.scope === 'scene' ? 'this scene' : 'the whole game'}?`,
      'Clear'
    ))
  )
    return;
  writePath(`${engineScopePath()}.camera`, undefined);
  changed();
  commit(true);
  refreshEngineSettings();
};
ACTIONS.camPromote = async () => {
  const cam = readPath(`${engineScopePath()}.camera`);
  if (!cam) return;
  if (!(await ask('Copy this scene’s camera dials to the whole game and clear them from the scene?', 'Copy'))) return;
  const D = engineData().defaults || (engineData().defaults = {});
  D.camera = Object.assign(D.camera || {}, cam);
  writePath(`${engineScopePath()}.camera`, undefined);
  changed();
  commit(true);
  engineEditor.scope = 'game';
  refreshEngineSettings();
};
ACTIONS.camFrame = d => {
  cameraEditor.frame = d.k;
  const box = $('.cam-pv');
  if (box) box.className = `sc-pv eng-pv cam-pv frame-${d.k}`;
  document
    .querySelectorAll('[data-act="camFrame"]')
    .forEach(el => el.classList.toggle('on', /** @type {HTMLElement} */ (el).dataset.k === d.k));
};
ACTIONS.camZoomReset = () => {
  walkRenderer.zoomT = 1;
};
ACTIONS.camSnap = () => {
  const { D, S } = cameraPlaces();
  cameraEditor.snap = {
    game: clone(D.camera || {}),
    scene: S && S.look && S.look.camera ? clone(S.look.camera) : null,
  };
  const b = $('#camSnapBtn'),
    c = $('#camCmp');
  if (b) b.textContent = 'Snapshot again';
  if (c) c.textContent = 'Hold: snapshot';
  toast('Snapshot kept: hold “Hold: snapshot” to compare.');
};
