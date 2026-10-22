'use strict';
/* ================= OVERLAY ================= */
/* UI-5: what lies over every screen: the toast, the inbox and the pop-up (sheet) host, moved from ui.js as they were */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, showPendingWindows } from './hooks.js';
import { $ } from './util.js';
import { TOAST_MS, toastAdd, toastItem, toastTime } from './logic/messages.js';
import { activeBattle, saveData, uiState } from './game-state.js';
/* eslint-disable no-func-assign */
expose({
  closeModal: [() => closeModal, v => ((closeModal = v), provide({ closeModal }))],
  modal: [() => modal, v => ((modal = v), provide({ modal }))],
  nextModal: [() => nextModal, v => (nextModal = v)],
  nextToast: [() => nextToast, v => (nextToast = v)],
  notice: [() => notice, v => (notice = v)],
  openInbox: [() => openInbox, v => (openInbox = v)],
  renderOverlay: [() => renderOverlay, v => setRenderOverlay(v)],
  showToast: [() => showToast, v => (showToast = v)],
  toast: [() => toast, v => ((toast = v), provide({ toast }))],
  toastTimer: [() => toastTimer, v => (toastTimer = v)],
});
/* eslint-enable no-func-assign */
provide({ closeModal, modal, renderOverlay, toast });
export function setRenderOverlay(v) {
  renderOverlay = v; // eslint-disable-line no-func-assign
  provide({ renderOverlay });
}
/* to-module: end */
/* ---------- toasts & modals ---------- */
/* phase 06: one toast at a time under the top bar (<pb-toast id="toast">, js/ui-kit.js); the same message again joins
   the one showing or waiting ("Saved ×2", js/logic/messages.js); a tap or a swipe up dismisses it */
let toastTimer = 0;
export function toast(t) {
  const where = toastAdd(uiState.toastOn, uiState.toastQ, String(t), Date.now());
  if (where === 'showing') {
    showToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(nextToast, TOAST_MS);
  } else if (!uiState.toastOn) nextToast();
}
function nextToast() {
  clearTimeout(toastTimer);
  const t = uiState.toastQ.shift();
  if (!t) {
    uiState.toastOn = false;
    showToast();
    return;
  }
  uiState.toastOn = toastItem(t, Date.now());
  showToast(true);
  toastTimer = setTimeout(nextToast, toastTime(uiState.toastQ.length));
}
/* the pill follows uiState.toastOn (the checks clear it and call renderOverlay); a new toast gets a new element, so it
   drops in again, while a merge only updates the count */
function showToast(fresh) {
  let el = /** @type {any} */ (document.getElementById('toast'));
  const t = uiState.toastOn;
  if (!t) {
    if (el) el.remove();
    return;
  }
  if (el && fresh) {
    el.remove();
    el = null;
  }
  if (!el) {
    el = document.createElement('pb-toast');
    el.id = 'toast';
    el.addEventListener('pb-dismiss', nextToast);
    document.body.appendChild(el);
  }
  el.style.setProperty('--toast-top', document.querySelector('.topbar') ? '70px' : '12px');
  el.text = t.text;
  el.n = t.count;
}
/* phase 06: a notice that can wait (not a choice) goes behind the dot on the portrait instead of opening by itself;
   the same id is kept once; onRead runs when it has been read */
export function notice(n) {
  if (uiState.inbox.some(x => x.id === n.id)) return;
  uiState.inbox.push(n);
  if (saveData.started && !activeBattle && uiState.intro === 0) render();
}
export function openInbox() {
  const L = uiState.inbox.splice(0);
  if (!L.length) return;
  modal({
    title: L.length === 1 ? L[0].title : 'Waiting for you',
    cls: 'inbox-sheet',
    html:
      L.length === 1
        ? `<div class="prose">${L[0].html}</div>`
        : `<ul class="inbox-list">${L.map((n, i) => `<li class="m-enter" style="--i:${i}"><h3>${n.title}</h3><div class="prose">${n.html}</div></li>`).join('')}</ul>`,
    btns: [{ l: 'Got it', c: 'dark', f: closeModal }],
  });
  L.forEach(n => n.onRead && n.onRead());
  render();
}
export function modal(o) {
  uiState.mq.push(o);
  if (!uiState.modal) nextModal();
}
export function nextModal() {
  uiState.modal = uiState.mq.shift() || null;
  renderOverlay();
}
export function closeModal() {
  uiState.modal = null;
  nextModal();
  if (!uiState.modal) showPendingWindows();
}
export function renderOverlay() {
  const ov = $('#ov');
  let h = '';
  const M = uiState.modal;
  if (M)
    h += `<div class="scrim" data-a="scrim"><div class="sheet px ${M.cls || ''}" role="dialog" aria-modal="true" aria-labelledby="mt">${M.top || ''}<h2 id="mt">${M.title}</h2><div class="body">${M.html || ''}</div><div class="btns">${(M.btns || []).map((b, i) => `<button class="pb ${b.c || ''} wide" data-a="mb" data-i="${i}" ${b.dis ? 'disabled' : ''}>${b.l}</button>`).join('')}</div></div></div>`;
  const keep = ov.querySelector('.scrim');
  ov.innerHTML = h;
  const sc = ov.querySelector('.scrim');
  if (sc && keep && M && M === uiState._lastM) sc.classList.add('still');
  uiState._lastM = M;
  showToast();
  if (M && M.after && !M._afterRan) {
    M._afterRan = true;
    M.after();
  }
  if (M && M !== uiState._focusedModal) {
    uiState._focusedModal = M;
    uiState._returnFocus = document.activeElement;
    requestAnimationFrame(() => {
      const e = $('.sheet button,.sheet input,.sheet select');
      if (e) e.focus({ preventScroll: true });
    });
  } else if (!M && uiState._focusedModal) {
    uiState._focusedModal = null;
    if (uiState._returnFocus && uiState._returnFocus.isConnected) uiState._returnFocus.focus({ preventScroll: true });
  }
}
