'use strict';
/* ================= POCKET BILLIES STUDIO · camera (camera track CAM-4a) =================
   Every dial of the walking camera in one place, in folders (game/js/engine/settings.js CAMERA_FOLDERS): framing,
   zoom, the zoom's feel, follow, moments, visibility and the island orbit. The data stays where the Engine section kept
   it (engine.defaults.camera, a scene's look.camera) and a scene's own `cam` (tilt, height, width shown). Beside it the
   Engine section's live preview, with the camera's real numbers (tilt, height, distance, field of view, metres across,
   how big an art pixel comes out), frames the shape of a phone or a desktop, a zoom slider, a snapshot to hold against,
   the camera guides and Play moment.
   CAM-4b: the zoom stops (the whole game's) in the Zoom stops folder: a row per stop, add and remove (3-5), and the
   curve graph (tilt, distance, field of view, blur or look-ahead against zoom; drag a stop's point); the zoom slider
   marks the stops and a button per stop goes there; camera looks (presets of camera dials only) above the folders. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { STOP_VALUES, ZOOM_STOPS, nearestStop, stopShape, stopsProblems } from '../../game/js/logic/camera-zoom.js';
import { walkView } from '../../game/js/walk-view.js';
import { CAMERA_FOLDERS, CAMERA_LOOKS, ENGINE_SPEC, engineSetting } from '../../game/js/engine/settings.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { sceneStartStop, zoomLimits, zoomStops } from '../../game/js/walk/camera.js';
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
  dialog,
  readPath,
  studioState,
  toast,
  uniqueKey,
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
  GRAPH_H: [() => GRAPH_H],
  GRAPH_NAMES: [() => GRAPH_NAMES],
  GRAPH_PAD: [() => GRAPH_PAD],
  GRAPH_W: [() => GRAPH_W],
  STOP_FIELDS: [() => STOP_FIELDS],
  cameraEditor: [() => cameraEditor],
  cameraFolderHTML: [() => cameraFolderHTML, v => (cameraFolderHTML = v)],
  cameraHold: [() => cameraHold, v => (cameraHold = v)],
  cameraLooksHTML: [() => cameraLooksHTML, v => (cameraLooksHTML = v)],
  cameraPlaces: [() => cameraPlaces, v => (cameraPlaces = v)],
  cameraPreviewBarsHTML: [() => cameraPreviewBarsHTML, v => (cameraPreviewBarsHTML = v)],
  cameraReadoutHTML: [() => cameraReadoutHTML, v => (cameraReadoutHTML = v)],
  cameraScope: [() => cameraScope],
  cameraSettingsHTML: [() => cameraSettingsHTML, v => (cameraSettingsHTML = v)],
  cameraSpec: [() => cameraSpec],
  countSet: [() => countSet],
  graphDown: [() => graphDown, v => (graphDown = v)],
  graphFrame: [() => graphFrame, v => (graphFrame = v)],
  graphMove: [() => graphMove, v => (graphMove = v)],
  graphPath: [() => graphPath, v => (graphPath = v)],
  graphUp: [() => graphUp, v => (graphUp = v)],
  graphX: [() => graphX],
  graphY: [() => graphY],
  mountCameraSection: [() => mountCameraSection, v => (mountCameraSection = v)],
  rnd: [() => rnd],
  sceneCameraHTML: [() => sceneCameraHTML, v => (sceneCameraHTML = v)],
  stopFieldChanged: [() => stopFieldChanged, v => (stopFieldChanged = v)],
  stopsCopy: [() => stopsCopy],
  stopsGraphHTML: [() => stopsGraphHTML, v => (stopsGraphHTML = v)],
  writeStops: [() => writeStops, v => (writeStops = v)],
  zoomStopsHTML: [() => zoomStopsHTML, v => (zoomStopsHTML = v)],
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
  /* CAM-4b: the value the curve graph draws, the stops' last problem (a list not written), a drag on the graph */
  graph: 'pitch',
  stopErr: '',
  drag: null,
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
    set =
      fields.filter(f => readPath(`${engineScopePath()}.camera.${f[0]}`) !== undefined).length +
      (id === 'zoom' && readPath(`${engineScopePath()}.camera.stops`) !== undefined ? 1 : 0),
    open = engineEditor.camOpen[id];
  return `<section class="card eng-g ${open ? 'open' : ''}" data-cam-folder="${id}"><header><button class="eng-gh" data-act="camOpen" data-f="${id}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${escapeHtml(title)}</h3>${set ? `<span class="badge">${set} set</span>` : ''}</button>${set ? `<button class="btn sm subtle" data-act="camResetF" data-f="${id}">Reset</button>` : ''}</header>
 ${open ? `<div class="card-b eng-fields">${fields.map(f => engineDialHTML('camera', f)).join('')}${id === 'framing' ? sceneCameraHTML() : ''}${id === 'zoom' ? zoomStopsHTML() : ''}</div>` : ''}</section>`;
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
 ${cameraLooksHTML()}
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
  <div class="eng-pvbar cam-bar"><label class="fld cam-zoom"><span>Your zoom <output id="camZoomV">${z.toFixed(2)}</output></span><input type="range" id="camZoom" min="${zMin}" max="${zMax}" step="0.01" value="${z}" list="camZoomTicks"><datalist id="camZoomTicks">${zoomStops()
    .map(t => `<option value="${t.zoom}" label="${escapeHtml(t.name)}"></option>`)
    .join(
      ''
    )}</datalist></label><button class="btn sm" data-act="camZoomReset" title="Back to zoom 1, the scene’s own framing">Zoom 1</button></div>
  <div class="eng-pvbar cam-bar" title="CAM-4b: goes to a zoom stop, as a two-finger tap or Z does in the game">Stops ${zoomStops()
    .map(
      (t, i) =>
        `<button class="btn sm" data-act="camStopGo" data-i="${i}">${escapeHtml(t.name)}${t.id === sceneStartStop(studioState.D.maps[engineEditorMapId()]).id ? ' ·' : ''}</button>`
    )
    .join('')}<span class="help">· the scene’s starting stop</span></div>
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
  const S = zoomStops(),
    near = S[nearestStop(walkRenderer.zoom, S)];
  return `Tilt <b>${R.tilt.toFixed(1)}°</b> · height <b>${R.height.toFixed(1)} m</b> · distance <b>${R.dist.toFixed(1)} m</b> · field of view <b>${R.vfov.toFixed(1)}°</b> · <b>${R.across.toFixed(1)} m</b> across<br>An art pixel: here ${px(R.artPx)} px${screen} · zoom <b>${walkRenderer.zoom.toFixed(2)}</b>${Math.abs(zoom - walkRenderer.zoom) > 0.005 ? ` (with the moments <b>${zoom.toFixed(2)}</b>)` : ''} · nearest stop <b>${escapeHtml(near.name)}</b>${I && I.moment ? ` · moment <b>${escapeHtml(I.moment)}</b>` : ''}`;
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
    /* CAM-4b: the graph's cursor at the zoom in use */
    const cur = $('#camGCur'),
      S = zoomStops();
    if (cur && typeof walkRenderer !== 'undefined') {
      const x = String(graphX(graphFrame(S, cameraEditor.graph), walkRenderer.zoom));
      cur.setAttribute('x1', x);
      cur.setAttribute('x2', x);
    }
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
  if (d.f === 'zoom' && cameraScope() === 'game') delete base.stops;
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
/* ---- CAM-4b: the zoom stops, the curve graph and the camera looks ---- */
/* the values a stop carries: label, step, the most and least a drag or a field may give */
const STOP_FIELDS = {
  zoom: ['Zoom', 0.01, 0.2, 4],
  pitch: ['Tilt (°)', 0.1, -30, 40],
  dist: ['Distance ×', 0.01, 0.15, 4],
  fov: ['Field of view ×', 0.01, 0.3, 2.5],
  blur: ['Blur ×', 0.05, 0, 3],
  lead: ['Look-ahead ×', 0.05, 0, 3],
};
const GRAPH_NAMES = { pitch: 'Tilt', dist: 'Distance', fov: 'Field of view', blur: 'Blur', lead: 'Look-ahead' };
const GRAPH_W = 320,
  GRAPH_H = 150,
  GRAPH_PAD = 22;
/* the whole game's stops, as the Studio's data has them (a copy to change) */
const stopsCopy = () => clone(zoomStops());
/* writes the whole game's stops if they can be used (else the problem is shown and nothing is written); the default
   stops are written as none */
function writeStops(S, keep) {
  const bad = stopsProblems(S);
  cameraEditor.stopErr = bad[0] || '';
  const el = $('#camStopErr');
  if (el) el.textContent = cameraEditor.stopErr;
  if (bad.length) return false;
  const D = engineData().defaults || (engineData().defaults = {}),
    C = D.camera || (D.camera = {});
  if (JSON.stringify(S) === JSON.stringify(ZOOM_STOPS)) delete C.stops;
  else C.stops = S;
  if (!Object.keys(C).length) delete D.camera;
  changed();
  if (!keep) {
    commit(true);
    refreshEngineSettings();
  }
  return true;
}
const rnd = (v, step) => +(Math.round(v / step) * step).toFixed(4);
/* the graph's axes: zoom across in log zoom; the value up, over the stops and the curve between them */
function graphFrame(S, k) {
  const x0 = Math.log(S[0].zoom * 0.85),
    x1 = Math.log(S[S.length - 1].zoom * 1.15);
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i <= 60; i++) {
    const v = stopShape(Math.exp(x0 + ((x1 - x0) * i) / 60), S)[k];
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = Math.max(hi - lo, k === 'pitch' ? 4 : 0.2),
    mid = (hi + lo) / 2;
  return { x0, x1, lo: mid - span * 0.6, hi: mid + span * 0.6 };
}
const graphX = (F, z) => GRAPH_PAD + ((Math.log(z) - F.x0) / (F.x1 - F.x0)) * (GRAPH_W - 2 * GRAPH_PAD),
  graphY = (F, v) => GRAPH_H - GRAPH_PAD - ((v - F.lo) / (F.hi - F.lo)) * (GRAPH_H - 2 * GRAPH_PAD);
function graphPath(S, k, F) {
  let d = '';
  for (let i = 0; i <= 80; i++) {
    const z = Math.exp(F.x0 + ((F.x1 - F.x0) * i) / 80);
    d += `${i ? 'L' : 'M'}${graphX(F, z).toFixed(1)},${graphY(F, stopShape(z, S)[k]).toFixed(1)}`;
  }
  return d;
}
function stopsGraphHTML(S, ro) {
  const k = cameraEditor.graph,
    F = graphFrame(S, k),
    z = typeof walkRenderer !== 'undefined' ? walkRenderer.zoom : 1,
    f = STOP_FIELDS[k];
  return `<div class="seg-row cam-gsel">${STOP_VALUES.map(v => `<button class="seg ${v === k ? 'on' : ''}" data-act="camGraph" data-k="${v}">${GRAPH_NAMES[v]}</button>`).join('')}</div>
 <svg class="cam-graph ${ro ? 'ro' : ''}" id="camGraph" viewBox="0 0 ${GRAPH_W} ${GRAPH_H}" role="img" aria-label="${GRAPH_NAMES[k]} against zoom">
  <line class="cam-gax" x1="${GRAPH_PAD}" y1="${GRAPH_H - GRAPH_PAD}" x2="${GRAPH_W - GRAPH_PAD}" y2="${GRAPH_H - GRAPH_PAD}"></line>
  <text class="cam-gt" x="2" y="${GRAPH_PAD + 4}">${rnd(F.hi, f[1])}</text><text class="cam-gt" x="2" y="${GRAPH_H - GRAPH_PAD}">${rnd(F.lo, f[1])}</text>
  <line class="cam-gcur" id="camGCur" x1="${graphX(F, z)}" y1="${GRAPH_PAD - 8}" x2="${graphX(F, z)}" y2="${GRAPH_H - GRAPH_PAD}"></line>
  <path class="cam-gline" id="camGLine" d="${graphPath(S, k, F)}"></path>
  ${S.map((t, i) => `<g><circle class="cam-gpt" data-pt="${i}" cx="${graphX(F, t.zoom)}" cy="${graphY(F, t[k])}" r="6"><title>${escapeHtml(t.name)}: zoom ${t.zoom}, ${GRAPH_NAMES[k].toLowerCase()} ${t[k]}</title></circle><text class="cam-gn" data-pn="${i}" x="${graphX(F, t.zoom)}" y="${GRAPH_H - 6}">${escapeHtml(t.name)}</text></g>`).join('')}
 </svg>`;
}
function zoomStopsHTML() {
  const S = zoomStops(),
    ro = cameraScope() !== 'game';
  if (ro)
    return `<div class="cam-stops"><h4>Zoom stops</h4><p class="help">The zoom stops are the whole game’s: switch to Whole game to change them. This scene starts at its own stop (Walk scenes → Starting zoom stop).</p>${stopsGraphHTML(S, true)}</div>`;
  /* a column per stop, a row per value (five stops fit the settings column) */
  const names = S.map(
      (t, i) =>
        `<th><input type="text" data-stop="${i}" data-f="name" value="${escapeHtml(t.name)}" maxlength="16" aria-label="Stop ${i + 1}: name"></th>`
    ).join(''),
    rows = Object.entries(STOP_FIELDS)
      .map(
        ([k, f]) =>
          `<tr><th>${escapeHtml(f[0])}</th>${S.map(
            (t, i) =>
              `<td><input type="number" data-stop="${i}" data-f="${k}" value="${t[k]}" step="${f[1]}" min="${f[2]}" max="${f[3]}" aria-label="${escapeHtml(t.name)}: ${escapeHtml(f[0])}"></td>`
          ).join('')}</tr>`
      )
      .join(''),
    acts = S.map(
      (t, i) =>
        `<td><button class="btn sm" data-act="camStopGo" data-i="${i}" title="The preview goes to this stop">Go</button>${S.length > 3 ? `<button class="eng-x" data-act="camStopDel" data-i="${i}" title="Remove this stop">×</button>` : ''}</td>`
    ).join('');
  return `<div class="cam-stops"><h4>Zoom stops</h4>
 <p class="help">3 to 5 stops in zoom order (below 1 closer, above 1 farther). Between them each value follows a smooth curve that never overshoots; the blur is times the lens blur and the player’s Blur slider. Drag a point on the graph: up and down for its value, sideways for its zoom.</p>
 <div class="cam-stab"><table><thead><tr><th>Name</th>${names}</tr></thead><tbody>${rows}<tr><th></th>${acts}</tr></tbody></table></div>
 <div class="seg-row">${S.length < 5 ? '<button class="btn sm" data-act="camStopAdd" title="A stop in the widest gap, on the curve as it is: the picture doesn’t change">+ Add a stop</button>' : ''}${readPath('engine.defaults.camera.stops') !== undefined ? '<button class="btn sm subtle" data-act="camStopsReset">Back to the built-in stops</button>' : ''}<span class="cam-err" id="camStopErr">${escapeHtml(cameraEditor.stopErr)}</span></div>
 ${stopsGraphHTML(S, false)}</div>`;
}
function cameraLooksHTML() {
  const own = engineData().cameraLooks || {};
  return `<div class="card"><div class="card-b"><h4 class="cam-h">Camera looks</h4><div class="eng-pre">${Object.entries(
    CAMERA_LOOKS
  )
    .map(([k, L]) => `<button class="seg" data-act="camLook" data-k="${k}">${escapeHtml(L.name)}</button>`)
    .join('')}${Object.entries(own)
    .map(
      ([k, L]) =>
        `<span class="eng-own"><button class="seg" data-act="camLook" data-k="${escapeHtml(k)}" data-own="1">${escapeHtml(L.name || k)}</button><button class="eng-x" data-act="camLookDel" data-k="${escapeHtml(k)}" title="Delete this look">×</button></span>`
    )
    .join('')}<button class="seg add" data-act="camLookSave">+ Save as a look</button></div>
 <p class="help">A look sets the camera dials it lists (its tilt, width shown, zoom stops and pull) on ${cameraScope() === 'scene' ? 'this scene; the zoom stops only on the whole game' : 'the whole game'}. Snapshot first to hold it against what you had.</p></div></div>`;
}
/* a field of the stops' table */
function stopFieldChanged(el) {
  const i = +el.dataset.stop,
    k = el.dataset.f,
    S = stopsCopy();
  if (!S[i]) return;
  if (k === 'name') {
    const n = el.value.trim();
    if (!n) return;
    S[i].name = n;
  } else {
    const v = parseFloat(el.value);
    if (!Number.isFinite(v)) return;
    const f = STOP_FIELDS[k];
    S[i][k] = Math.min(f[3], Math.max(f[2], v));
  }
  writeStops(S);
}
/* dragging a stop's point on the graph: its value up and down, its zoom sideways (kept between its neighbours) */
function graphDown(ev) {
  const pt = ev.target.closest && ev.target.closest('.cam-gpt'),
    svg = pt && pt.closest('svg');
  if (!pt || svg.classList.contains('ro') || cameraScope() !== 'game') return;
  ev.preventDefault();
  const S = stopsCopy();
  cameraEditor.drag = { i: +pt.dataset.pt, S, F: graphFrame(S, cameraEditor.graph), svg, pt };
  pt.setPointerCapture(ev.pointerId);
}
function graphMove(ev) {
  const G = cameraEditor.drag;
  if (!G) return;
  const r = G.svg.getBoundingClientRect(),
    x = ((ev.clientX - r.left) / r.width) * GRAPH_W,
    y = ((ev.clientY - r.top) / r.height) * GRAPH_H,
    k = cameraEditor.graph,
    F = G.F,
    S = G.S,
    t = S[G.i],
    fz = STOP_FIELDS.zoom,
    fv = STOP_FIELDS[k],
    lo = G.i ? S[G.i - 1].zoom * 1.03 : fz[2],
    hi = G.i < S.length - 1 ? S[G.i + 1].zoom / 1.03 : fz[3];
  t.zoom = rnd(
    Math.min(hi, Math.max(lo, Math.exp(F.x0 + ((x - GRAPH_PAD) / (GRAPH_W - 2 * GRAPH_PAD)) * (F.x1 - F.x0)))),
    fz[1]
  );
  t[k] = rnd(
    Math.min(fv[3], Math.max(fv[2], F.lo + ((GRAPH_H - GRAPH_PAD - y) / (GRAPH_H - 2 * GRAPH_PAD)) * (F.hi - F.lo))),
    fv[1]
  );
  if (!writeStops(S, true)) return;
  G.pt.setAttribute('cx', String(graphX(F, t.zoom)));
  G.pt.setAttribute('cy', String(graphY(F, t[k])));
  const n = G.svg.querySelector(`[data-pn="${G.i}"]`);
  if (n) n.setAttribute('x', String(graphX(F, t.zoom)));
  const L = G.svg.querySelector('#camGLine');
  if (L) L.setAttribute('d', graphPath(S, k, F));
}
function graphUp() {
  if (!cameraEditor.drag) return;
  cameraEditor.drag = null;
  commit(true);
  refreshEngineSettings();
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('change', ev => {
    const el = /** @type {HTMLInputElement} */ (ev.target);
    if (el && el.dataset && el.dataset.stop != null && studioState.sec === 'camera') stopFieldChanged(el);
  });
  document.addEventListener('pointerdown', ev => studioState.sec === 'camera' && graphDown(ev));
  document.addEventListener('pointermove', graphMove);
  document.addEventListener('pointerup', graphUp);
  document.addEventListener('pointercancel', graphUp);
}
ACTIONS.camGraph = d => {
  cameraEditor.graph = d.k;
  refreshEngineSettings();
};
ACTIONS.camStopGo = d => {
  const t = zoomStops()[+d.i];
  if (t && typeof walkRenderer !== 'undefined') walkRenderer.zoomT = t.zoom;
};
/* a new stop in the widest gap (in log zoom), its values from the curve there: the picture doesn't change */
ACTIONS.camStopAdd = () => {
  const S = stopsCopy();
  if (S.length >= 5) return;
  let at = 0,
    w = -1;
  for (let i = 0; i < S.length - 1; i++) {
    const g = Math.log(S[i + 1].zoom / S[i].zoom);
    if (g > w) {
      w = g;
      at = i;
    }
  }
  const z = rnd(Math.sqrt(S[at].zoom * S[at + 1].zoom), 0.01),
    V = stopShape(z, S),
    ids = new Set(S.map(t => t.id));
  let n = 2;
  while (ids.has('stop' + n)) n++;
  const t = { id: 'stop' + n, name: 'Stop ' + n, zoom: z };
  for (const k of STOP_VALUES) t[k] = rnd(V[k], STOP_FIELDS[k][1] / 10);
  S.splice(at + 1, 0, /** @type {any} */ (t));
  writeStops(S);
};
/* removing a stop a scene starts at: those scenes start at the stop nearest zoom 1 instead */
ACTIONS.camStopDel = async d => {
  const S = stopsCopy(),
    t = S[+d.i];
  if (!t || S.length <= 3) return;
  const users = Object.entries(studioState.D.maps).filter(([, m]) => m && m.cam && m.cam.stop === t.id);
  if (
    !(await ask(
      `Remove the stop “${t.name}”?${users.length ? ` ${users.length} scene${users.length > 1 ? 's start' : ' starts'} at it (${users.map(([k, m]) => escapeHtml(m.name || k)).join(', ')}); they will start at the stop nearest zoom 1.` : ''}`,
      'Remove'
    ))
  )
    return;
  S.splice(+d.i, 1);
  if (writeStops(S, true)) for (const [, m] of users) delete m.cam.stop;
  commit(true);
  refreshEngineSettings();
};
ACTIONS.camStopsReset = async () => {
  if (!(await ask('Put the built-in zoom stops back (Close, Normal, Far)?', 'Put back'))) return;
  writeStops(clone(ZOOM_STOPS));
};
ACTIONS.camLook = d => {
  const L = d.own ? (engineData().cameraLooks || {})[d.k] : CAMERA_LOOKS[d.k];
  if (!L) return;
  const scene = cameraScope() !== 'game';
  for (const [k, v] of Object.entries(L.camera || {}))
    if (k === 'stops') {
      if (!scene) writeStops(clone(v), true);
    } else if (cameraSpec().some(f => f[0] === k)) writePath(`${engineScopePath()}.camera.${k}`, clone(v));
  changed();
  commit(true);
  refreshEngineSettings();
  toast(`${L.name || d.k} applied${scene ? ' to this scene (its zoom stops are the whole game’s: not changed)' : ''}.`);
};
ACTIONS.camLookSave = async () => {
  const cur = clone(readPath(`${engineScopePath()}.camera`) || {});
  if (!Object.keys(cur).length) return toast('Set a few camera dials first; a look saves the ones set here.');
  const name = await dialog(
    'Save as a camera look',
    '<label class="fld"><span>Name</span><input type="text" id="camLN" placeholder="Long shot"></label>',
    [
      { l: 'Cancel', v: null },
      { l: 'Save', c: 'primary', f: m => (m.querySelector('#camLN').value || '').trim() || false },
    ]
  );
  if (!name) return;
  const E = engineData(),
    ls = E.cameraLooks || (E.cameraLooks = {}),
    k = uniqueKey(name, x => !!ls[x] || !!CAMERA_LOOKS[x]);
  ls[k] = { name, camera: cur };
  changed();
  commit(true);
  refreshEngineSettings();
  toast('Camera look saved.');
};
ACTIONS.camLookDel = async d => {
  const ls = engineData().cameraLooks || {};
  if (!(await ask(`Delete the camera look “${(ls[d.k] || {}).name || d.k}”?`, 'Delete'))) return;
  delete ls[d.k];
  if (!Object.keys(ls).length) delete engineData().cameraLooks;
  changed();
  commit(true);
  refreshEngineSettings();
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
