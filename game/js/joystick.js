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
import { cutscene } from './cutscene.js';
import { airshipFlight, glassLift } from './airship.js';
/* eslint-disable no-func-assign */
expose({
  joystick: [() => joystick],
  joystickAllowed: [() => joystickAllowed, v => (joystickAllowed = v)],
  joystickDpad: [() => joystickDpad, v => (joystickDpad = v)],
  joystickElement: [() => joystickElement, v => (joystickElement = v)],
  joystickEnd: [() => joystickEnd, v => (joystickEnd = v)],
  joystickInput: [() => joystickInput, v => (joystickInput = v)],
  joystickPreference: [() => joystickPreference, v => (joystickPreference = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const joystick = { id: null, x0: 0, y0: 0, on: false, el: null, knob: null, pad: null, padId: null, quiet: 0 };
function joystickPreference() {
  return (typeof saveData !== 'undefined' && saveData.preferences && saveData.preferences.control) || 'stick';
}
function joystickAllowed() {
  return (
    typeof saveData !== 'undefined' &&
    saveData.started &&
    typeof uiState !== 'undefined' &&
    uiState.tab === 'walk' &&
    !uiState.modal &&
    !uiState.title &&
    !(typeof activeBattle !== 'undefined' && activeBattle) &&
    !(typeof cutscene !== 'undefined' && cutscene.on) &&
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
function joystickInput(x, y) {
  if (typeof walkView !== 'undefined') walkView.stick = x || y ? { x, y } : null;
}
function joystickElement() {
  if (joystick.el) return joystick.el;
  const e = document.createElement('div');
  e.className = 'joy';
  e.setAttribute('aria-hidden', 'true');
  e.innerHTML = '<i class="joy-knob"></i>';
  document.body.appendChild(e);
  joystick.el = e;
  joystick.knob = e.firstChild;
  return e;
}
function joystickEnd() {
  if (joystick.on) {
    joystick.quiet = performance.now();
    if (typeof walkRenderer !== 'undefined') walkRenderer.dragged = true;
  }
  joystick.id = null;
  joystick.on = false;
  joystickInput(0, 0);
  if (joystick.el) joystick.el.classList.remove('on');
}
document.addEventListener(
  'pointerdown',
  ev => {
    if (joystickPreference() !== 'stick' || !joystickAllowed()) return;
    if (joystick.id != null) {
      joystickEnd();
      return;
    } /* a second finger: pinch and turn instead */
    const t = ev.target;
    if (!t || t.id !== 'dio' || ev.button > 0) return;
    joystick.id = ev.pointerId;
    joystick.x0 = ev.clientX;
    joystick.y0 = ev.clientY;
    joystick.on = false;
  },
  true
);
document.addEventListener(
  'pointermove',
  ev => {
    if (ev.pointerId !== joystick.id) return;
    if (!joystickAllowed()) {
      joystickEnd();
      return;
    }
    const dx = ev.clientX - joystick.x0,
      dy = ev.clientY - joystick.y0,
      d = Math.hypot(dx, dy);
    if (!joystick.on) {
      if (d < 14) return;
      joystick.on = true;
      const e = joystickElement();
      e.style.left = joystick.x0 + 'px';
      e.style.top = joystick.y0 + 'px';
      e.classList.add('on');
    }
    const R = 56,
      k = Math.min(1, d / R),
      m = Math.min(d, R);
    joystickInput((dx / d) * k, (-dy / d) * k);
    joystick.knob.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`;
    ev.preventDefault();
  },
  { capture: true, passive: false }
);
for (const k of ['pointerup', 'pointercancel'])
  document.addEventListener(
    k,
    ev => {
      if (ev.pointerId === joystick.id) joystickEnd();
    },
    true
  );
/* a drag that walked you isn't also a tap */
document.addEventListener(
  'click',
  ev => {
    if (performance.now() - joystick.quiet < 350 && ev.target && ev.target.id === 'dio') {
      ev.stopPropagation();
      ev.preventDefault();
    }
  },
  true
);
/* the d-pad */
function joystickDpad() {
  if (joystick.pad) return joystick.pad;
  const e = document.createElement('div');
  e.className = 'dpad';
  e.setAttribute('role', 'group');
  e.setAttribute('aria-label', 'Walk');
  e.innerHTML = '<b class="u">▲</b><b class="l">◀</b><b class="r">▶</b><b class="d">▼</b><i></i>';
  document.body.appendChild(e);
  joystick.pad = e;
  const at = ev => {
    const r = e.getBoundingClientRect(),
      dx = ev.clientX - (r.left + r.width / 2),
      dy = ev.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) {
      joystickInput(0, 0);
      return;
    }
    const a = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    joystickInput(+Math.cos(a).toFixed(3), +Math.sin(a).toFixed(3));
    e.dataset.dir = Math.round(a / (Math.PI / 4));
  };
  e.addEventListener('pointerdown', ev => {
    joystick.padId = ev.pointerId;
    e.setPointerCapture(ev.pointerId);
    at(ev);
    ev.preventDefault();
  });
  e.addEventListener('pointermove', ev => {
    if (ev.pointerId === joystick.padId) at(ev);
  });
  for (const k of ['pointerup', 'pointercancel', 'lostpointercapture'])
    e.addEventListener(k, ev => {
      if (ev.pointerId === joystick.padId) {
        joystick.padId = null;
        joystickInput(0, 0);
        delete e.dataset.dir;
      }
    });
  return e;
}
setInterval(() => {
  const show = joystickPreference() === 'dpad' && joystickAllowed();
  if (show || joystick.pad) {
    const e = joystickDpad();
    e.classList.toggle('on', show);
    if (!show && joystick.padId == null && typeof walkView !== 'undefined' && walkView.stick && joystick.id == null)
      joystickInput(0, 0);
  }
  if (joystick.id != null && !joystickAllowed()) joystickEnd();
}, 250);
