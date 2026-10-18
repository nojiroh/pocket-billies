'use strict';
/* ================= JOYSTICK AND D-PAD (alpha 0.4.1) =================
   Walking yourself, like a classic RPG. Settings → Moving about:
   - Joystick (the default): put a thumb anywhere on the scene and drag; a stick appears where you touched and you walk
     the way you push it, slowly near the middle, at a run at the rim. Let go and you stop. A tap without a drag is still
     a tap (walk there, open a door, talk). A second finger turns it back into a pinch.
   - D-pad: a fixed eight-way pad in the lower left corner.
   - Tap only: neither; tap where to go.
   Both set walkView.stick {x right, y up, length 0-1}; walk-view.js walks along the camera's own right and forward. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { activeBattle, saveData, uiState } from './game-state.js';
import { walkView } from './walk-view.js';
import { walkRenderer } from './walk-view-gl.js';
import { TALK } from './talk.js';
import { CS } from './cutscene.js';
import { airshipFlight, glassLift } from './airship.js';
/* eslint-disable no-func-assign */
expose({
  JOY: [() => JOY],
  joyAllowed: [() => joyAllowed, v => (joyAllowed = v)],
  joyEl: [() => joyEl, v => (joyEl = v)],
  joyEnd: [() => joyEnd, v => (joyEnd = v)],
  joyPad: [() => joyPad, v => (joyPad = v)],
  joyPref: [() => joyPref, v => (joyPref = v)],
  joySet: [() => joySet, v => (joySet = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const JOY = { id: null, x0: 0, y0: 0, on: false, el: null, knob: null, pad: null, padId: null, quiet: 0 };
function joyPref() {
  return (typeof saveData !== 'undefined' && saveData.preferences && saveData.preferences.control) || 'stick';
}
function joyAllowed() {
  return (
    typeof saveData !== 'undefined' &&
    saveData.started &&
    typeof uiState !== 'undefined' &&
    uiState.tab === 'walk' &&
    !uiState.modal &&
    !uiState.title &&
    !(typeof activeBattle !== 'undefined' && activeBattle) &&
    !(typeof CS !== 'undefined' && CS.on) &&
    typeof walkView !== 'undefined' &&
    walkView.ready &&
    walkView.cv &&
    !walkView.battle &&
    !walkView.director &&
    !(typeof airshipFlight !== 'undefined' && airshipFlight.on) &&
    !(typeof glassLift !== 'undefined' && glassLift.on) &&
    !(typeof TALK !== 'undefined' && TALK.on)
  );
}
function joySet(x, y) {
  if (typeof walkView !== 'undefined') walkView.stick = x || y ? { x, y } : null;
}
function joyEl() {
  if (JOY.el) return JOY.el;
  const e = document.createElement('div');
  e.className = 'joy';
  e.setAttribute('aria-hidden', 'true');
  e.innerHTML = '<i class="joy-knob"></i>';
  document.body.appendChild(e);
  JOY.el = e;
  JOY.knob = e.firstChild;
  return e;
}
function joyEnd() {
  if (JOY.on) {
    JOY.quiet = performance.now();
    if (typeof walkRenderer !== 'undefined') walkRenderer.dragged = true;
  }
  JOY.id = null;
  JOY.on = false;
  joySet(0, 0);
  if (JOY.el) JOY.el.classList.remove('on');
}
document.addEventListener(
  'pointerdown',
  ev => {
    if (joyPref() !== 'stick' || !joyAllowed()) return;
    if (JOY.id != null) {
      joyEnd();
      return;
    } /* a second finger: pinch and turn instead */
    const t = ev.target;
    if (!t || t.id !== 'dio' || ev.button > 0) return;
    JOY.id = ev.pointerId;
    JOY.x0 = ev.clientX;
    JOY.y0 = ev.clientY;
    JOY.on = false;
  },
  true
);
document.addEventListener(
  'pointermove',
  ev => {
    if (ev.pointerId !== JOY.id) return;
    if (!joyAllowed()) {
      joyEnd();
      return;
    }
    const dx = ev.clientX - JOY.x0,
      dy = ev.clientY - JOY.y0,
      d = Math.hypot(dx, dy);
    if (!JOY.on) {
      if (d < 14) return;
      JOY.on = true;
      const e = joyEl();
      e.style.left = JOY.x0 + 'px';
      e.style.top = JOY.y0 + 'px';
      e.classList.add('on');
    }
    const R = 56,
      k = Math.min(1, d / R),
      m = Math.min(d, R);
    joySet((dx / d) * k, (-dy / d) * k);
    JOY.knob.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`;
    ev.preventDefault();
  },
  { capture: true, passive: false }
);
for (const k of ['pointerup', 'pointercancel'])
  document.addEventListener(
    k,
    ev => {
      if (ev.pointerId === JOY.id) joyEnd();
    },
    true
  );
/* a drag that walked you isn't also a tap */
document.addEventListener(
  'click',
  ev => {
    if (performance.now() - JOY.quiet < 350 && ev.target && ev.target.id === 'dio') {
      ev.stopPropagation();
      ev.preventDefault();
    }
  },
  true
);
/* the d-pad */
function joyPad() {
  if (JOY.pad) return JOY.pad;
  const e = document.createElement('div');
  e.className = 'dpad';
  e.setAttribute('role', 'group');
  e.setAttribute('aria-label', 'Walk');
  e.innerHTML = '<b class="u">▲</b><b class="l">◀</b><b class="r">▶</b><b class="d">▼</b><i></i>';
  document.body.appendChild(e);
  JOY.pad = e;
  const at = ev => {
    const r = e.getBoundingClientRect(),
      dx = ev.clientX - (r.left + r.width / 2),
      dy = ev.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) {
      joySet(0, 0);
      return;
    }
    const a = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    joySet(+Math.cos(a).toFixed(3), +Math.sin(a).toFixed(3));
    e.dataset.dir = Math.round(a / (Math.PI / 4));
  };
  e.addEventListener('pointerdown', ev => {
    JOY.padId = ev.pointerId;
    e.setPointerCapture(ev.pointerId);
    at(ev);
    ev.preventDefault();
  });
  e.addEventListener('pointermove', ev => {
    if (ev.pointerId === JOY.padId) at(ev);
  });
  for (const k of ['pointerup', 'pointercancel', 'lostpointercapture'])
    e.addEventListener(k, ev => {
      if (ev.pointerId === JOY.padId) {
        JOY.padId = null;
        joySet(0, 0);
        delete e.dataset.dir;
      }
    });
  return e;
}
setInterval(() => {
  const show = joyPref() === 'dpad' && joyAllowed();
  if (show || JOY.pad) {
    const e = joyPad();
    e.classList.toggle('on', show);
    if (!show && JOY.padId == null && typeof walkView !== 'undefined' && walkView.stick && JOY.id == null) joySet(0, 0);
  }
  if (JOY.id != null && !joyAllowed()) joyEnd();
}, 250);
