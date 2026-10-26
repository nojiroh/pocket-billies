'use strict';
/* ================= CAMERA ZONES (camera track CAM-2) =================
   The Walk scenes editor's "Camera zones" tool: drag a rectangle (or a circle, from its centre) over the map; standing
   in it, the walking camera takes its zoom, tilt and aim offset (walk/camera.js, logic/camera-interest.js zoneAt).
   Click a zone to pick it and set its numbers in the bar; drag it to move it; right-click (or Alt-click) to remove it.
   The scene keeps them in `camZones` (map.schema.json). map-editor-tools.js hands this file the tool's pointer
   events and drawing. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { zoneHas } from '../../game/js/logic/camera-interest.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, changed, commit, render } from './studio-app.js';
import { currentMap, drawEditorMap, mapEditor } from './map-editor.js';
/* eslint-disable no-func-assign */
expose({
  CZ_COLOUR: [() => CZ_COLOUR],
  camZonePointerDown: [() => camZonePointerDown, v => (camZonePointerDown = v)],
  camZonePointerMove: [() => camZonePointerMove, v => (camZonePointerMove = v)],
  camZonePointerUp: [() => camZonePointerUp, v => (camZonePointerUp = v)],
  camZoneToolBarHTML: [() => camZoneToolBarHTML, v => ((camZoneToolBarHTML = v), provide({ camZoneToolBarHTML }))],
  camZoneUnder: [() => camZoneUnder, v => (camZoneUnder = v)],
  camZonesChanged: [() => camZonesChanged, v => (camZonesChanged = v)],
  drawCamZones: [() => drawCamZones, v => (drawCamZones = v)],
});
/* eslint-enable no-func-assign */
provide({ camZoneToolBarHTML });
/* to-module: end */
mapEditor.czShape = mapEditor.czShape || 'rect';
mapEditor.czSel = mapEditor.czSel ?? -1;
const CZ_COLOUR = '#B57EDC';
/* the zone under the pointer (the last drawn first), -1 for none */
function camZoneUnder(sc, m) {
  const Z = sc.camZones || [];
  for (let i = Z.length - 1; i >= 0; i--) if (zoneHas(Z[i], m.x, m.z)) return i;
  return -1;
}
function camZonesChanged() {
  changed();
  commit(true);
  drawEditorMap();
}
export function camZonePointerDown(sc, m, ev) {
  const n = camZoneUnder(sc, m);
  if (n >= 0 && (ev.button === 2 || ev.altKey)) {
    sc.camZones.splice(n, 1);
    if (!sc.camZones.length) delete sc.camZones;
    mapEditor.czSel = -1;
    camZonesChanged();
    render();
    return true;
  }
  if (n >= 0) {
    const Z = sc.camZones[n];
    mapEditor.czSel = n;
    mapEditor.drag = { k: 'czmove', i: n, a: [m.x, m.z], o: [Z.x, Z.z] };
    render();
    return true;
  }
  mapEditor.drag = { k: 'czdraw', a: [m.x, m.z], b: [m.x, m.z] };
  return true;
}
export function camZonePointerMove(sc, m, D) {
  if (D.k === 'czdraw') {
    D.b = [m.x, m.z];
    drawEditorMap();
    return true;
  }
  if (D.k === 'czmove') {
    const Z = sc.camZones && sc.camZones[D.i];
    if (!Z) return true;
    const snap = v => Math.round(v * 4) / 4;
    Z.x = snap(D.o[0] + m.x - D.a[0]);
    Z.z = snap(D.o[1] + m.z - D.a[1]);
    D.moved = 1;
    drawEditorMap();
    return true;
  }
  return false;
}
export function camZonePointerUp(sc, D) {
  if (D.k === 'czmove') {
    if (D.moved) camZonesChanged();
    return true;
  }
  if (D.k !== 'czdraw') return false;
  const snap = v => Math.round(v * 2) / 2;
  let Z;
  if (mapEditor.czShape === 'circle') {
    const r = snap(Math.hypot(D.b[0] - D.a[0], D.b[1] - D.a[1]));
    if (r >= 0.5) Z = { shape: 'circle', x: snap(D.a[0]), z: snap(D.a[1]), r };
  } else {
    const x0 = snap(Math.min(D.a[0], D.b[0])),
      x1 = snap(Math.max(D.a[0], D.b[0])),
      z0 = snap(Math.min(D.a[1], D.b[1])),
      z1 = snap(Math.max(D.a[1], D.b[1]));
    if (x1 - x0 >= 0.5 && z1 - z0 >= 0.5) Z = { shape: 'rect', x: x0, z: z0, w: x1 - x0, h: z1 - z0 };
  }
  if (!Z) {
    drawEditorMap();
    return true;
  }
  Z.zoom = 0.85;
  (sc.camZones || (sc.camZones = [])).push(Z);
  mapEditor.czSel = sc.camZones.length - 1;
  camZonesChanged();
  render();
  return true;
}
/* the bar under the tools: the shape to draw, and the picked zone's numbers */
function camZoneToolBarHTML() {
  const sc = currentMap(),
    L = (sc && sc.camZones) || [],
    Z = L[mapEditor.czSel],
    num = (k, label, v, step, help) =>
      `<label class="mp-size" title="${escapeHtml(help)}"><span>${label}</span><input type="number" step="${step}" data-cz="${k}" value="${v ?? ''}"></label>`;
  const shapes = [
    ['rect', 'Rectangle'],
    ['circle', 'Circle'],
  ]
    .map(
      ([k, n]) =>
        `<button class="seg ${mapEditor.czShape === k ? 'on' : ''}" data-act="scCzShape" data-k="${k}">${n}</button>`
    )
    .join('');
  const form = Z
    ? `${num('zoom', 'Zoom', Z.zoom ?? 1, 0.01, 'The zoom’s share in the zone (below 1: closer).')}${num('tilt', 'Tilt (°)', Z.tilt ?? 0, 0.5, 'Degrees added to the tilt.')}${num('atx', 'Aim → (m)', Z.at ? Z.at[0] : 0, 0.25, 'The aim moved from you, metres east.')}${num('atz', 'Aim ↑ (m)', Z.at ? Z.at[1] : 0, 0.25, 'The aim moved from you, metres north.')}${num('priority', 'Priority', Z.priority ?? 0, 1, 'Where zones overlap the highest wins.')}${num('blend', 'Blend (s)', Z.blend ?? '', 0.05, 'How long it takes to come in and go (empty: Camera > Follow > Camera goals blend).')}<button class="btn sm subtle" data-act="scCzDel">Remove this zone</button>`
    : `<span class="muted">${L.length ? 'Click a zone to set its numbers.' : 'No camera zones in this scene.'}</span>`;
  return `<div class="sc-hbar">${shapes}${form}</div>`;
}
ACTIONS.scCzShape = d => {
  mapEditor.czShape = d.k;
  render();
};
ACTIONS.scCzDel = () => {
  const sc = currentMap(),
    L = sc && sc.camZones;
  if (!L || !L[mapEditor.czSel]) return;
  L.splice(mapEditor.czSel, 1);
  if (!L.length) delete sc.camZones;
  mapEditor.czSel = -1;
  camZonesChanged();
  render();
};
document.addEventListener('change', ev => {
  const k = ev.target && ev.target.dataset && ev.target.dataset.cz;
  if (!k) return;
  const sc = currentMap(),
    Z = sc && sc.camZones && sc.camZones[mapEditor.czSel];
  if (!Z) return;
  const raw = ev.target.value.trim(),
    v = raw === '' ? null : +raw;
  if (v != null && !Number.isFinite(v)) return;
  if (k === 'atx' || k === 'atz') {
    const at = Z.at ? Z.at.slice() : [0, 0];
    at[k === 'atx' ? 0 : 1] = v || 0;
    if (at[0] || at[1]) Z.at = at;
    else delete Z.at;
  } else if (v == null || (k === 'zoom' && v <= 0) || (k === 'blend' && v < 0)) delete Z[k];
  else Z[k] = v;
  camZonesChanged();
});
/* the zones on the map: faint unless the tool is on, the picked one bright */
export function drawCamZones(x, sc, Z) {
  const on = mapEditor.tool === 'camzone',
    H = sc.h,
    L = sc.camZones || [];
  L.forEach((c, i) => {
    const sel = on && i === mapEditor.czSel;
    x.beginPath();
    if (c.shape === 'circle') x.arc(c.x * Z, (H - c.z) * Z, (c.r || 0) * Z, 0, 7);
    else x.rect(c.x * Z, (H - c.z - (c.h || 0)) * Z, (c.w || 0) * Z, (c.h || 0) * Z);
    x.globalAlpha = on ? (sel ? 0.32 : 0.2) : 0.08;
    x.fillStyle = CZ_COLOUR;
    x.fill();
    x.globalAlpha = 1;
    x.strokeStyle = sel ? '#fff' : CZ_COLOUR;
    x.lineWidth = sel ? 2.5 : on ? 1.5 : 1;
    x.setLineDash(on ? [] : [4, 4]);
    x.stroke();
    x.setLineDash([]);
    if (on) {
      const t = `×${(c.zoom ?? 1).toFixed(2)}${c.tilt ? ` ${c.tilt > 0 ? '+' : ''}${c.tilt}°` : ''}${c.priority ? ` p${c.priority}` : ''}`,
        lx = (c.shape === 'circle' ? c.x - (c.r || 0) * 0.6 : c.x) * Z + 4,
        ly = (H - (c.shape === 'circle' ? c.z + (c.r || 0) * 0.6 : c.z + (c.h || 0))) * Z + 3;
      x.font = '700 11px system-ui';
      x.textAlign = 'left';
      x.textBaseline = 'top';
      x.strokeStyle = 'rgba(0,0,0,.6)';
      x.lineWidth = 3;
      x.strokeText(t, lx, ly);
      x.fillStyle = '#fff';
      x.fillText(t, lx, ly);
    }
  });
  const D = mapEditor.drag;
  if (D && D.k === 'czdraw') {
    x.strokeStyle = '#fff';
    x.lineWidth = 2;
    x.setLineDash([6, 4]);
    x.beginPath();
    if (mapEditor.czShape === 'circle')
      x.arc(D.a[0] * Z, (H - D.a[1]) * Z, Math.hypot(D.b[0] - D.a[0], D.b[1] - D.a[1]) * Z, 0, 7);
    else
      x.rect(
        Math.min(D.a[0], D.b[0]) * Z,
        (H - Math.max(D.a[1], D.b[1])) * Z,
        Math.abs(D.b[0] - D.a[0]) * Z,
        Math.abs(D.b[1] - D.a[1]) * Z
      );
    x.stroke();
    x.setLineDash([]);
  }
}
