'use strict';
/* ================= POCKET BILLIES STUDIO · core =================
   State, server calls, undo, form fields bound to paths in the game data, navigation, toasts and dialogs. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  artStepPut,
  draftNow,
  draftSoon,
  legacyLineIdsRead,
  mountPreviews,
  provide,
  runCheck,
  scheduleCheck,
  spriteCacheClear,
} from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { ICON_ATLAS, artLoad } from '../../game/js/art.js';
import { battleStageStop } from '../../game/js/battle-stage.js';
import { engineContext } from '../../game/js/engine/settings.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  HISTORY_ORDER,
  historyBytes,
  historyCommit,
  historyParts,
  historyPartsData,
  historyRedo,
  historyUndo,
} from '../../game/js/logic/history.js';
import { publishConfirm, publishEmpty } from '../../game/js/logic/publish-plan.js';
/* eslint-disable no-func-assign */
expose({
  ACTIONS: [() => ACTIONS],
  LIVE_UPDATE_CHANNEL: [() => LIVE_UPDATE_CHANNEL],
  PANE2_REFUSED: [() => PANE2_REFUSED],
  RANGE_FORMATS: [() => RANGE_FORMATS],
  SAVE_REPLACER: [() => SAVE_REPLACER],
  SECTIONS: [() => SECTIONS],
  SECTION_GROUPS: [() => SECTION_GROUPS],
  SECTION_LIST: [() => SECTION_LIST],
  STUDIO_SERVER_KEY: [() => STUDIO_SERVER_KEY],
  afterRender: [() => afterRender],
  api: [() => api, v => setApi(v)],
  ask: [() => ask],
  besideRefusal: [() => besideRefusal, v => (besideRefusal = v)],
  blurField: [() => blurField],
  boot: [() => boot, v => (boot = v)],
  card: [() => card],
  changed: [() => changed, v => (changed = v)],
  checkBeforeSave: [() => checkBeforeSave, v => (checkBeforeSave = v)],
  checkboxField: [() => checkboxField, v => (checkboxField = v)],
  clone: [() => clone],
  coinOptions: [() => coinOptions],
  colorField: [() => colorField, v => (colorField = v)],
  commit: [() => commit, v => (commit = v)],
  confirmStaged: [() => confirmStaged, v => (confirmStaged = v)],
  dialog: [() => dialog, v => (dialog = v)],
  fieldOutputId: [() => fieldOutputId],
  foldedSectionGroups: [() => foldedSectionGroups],
  formatThousands: [() => formatThousands],
  grid: [() => grid],
  helpHTML: [() => helpHTML],
  itemOptions: [() => itemOptions],
  moveOptions: [() => moveOptions],
  numberField: [() => numberField, v => (numberField = v)],
  onField: [() => onField, v => (onField = v)],
  openSection: [() => openSection, v => (openSection = v)],
  paneRoot: [() => paneRoot],
  peopleOptions: [() => peopleOptions],
  rangeField: [() => rangeField, v => (rangeField = v)],
  readField: [() => readField, v => (readField = v)],
  readPath: [() => readPath, v => setReadPath(v)],
  redo: [() => redo, v => (redo = v)],
  render: [() => render, v => setRender(v)],
  renderPane: [() => renderPane, v => (renderPane = v)],
  renderSide: [() => renderSide, v => (renderSide = v)],
  renderingPane: [() => renderingPane, v => (renderingPane = v)],
  restore: [() => restore, v => (restore = v)],
  restoreParts: [() => restoreParts, v => (restoreParts = v)],
  saveAll: [() => saveAll, v => setSaveAll(v)],
  sectionShown: [() => sectionShown],
  selectField: [() => selectField, v => (selectField = v)],
  setApi: [() => setApi, v => (setApi = v)],
  setReadPath: [() => setReadPath, v => (setReadPath = v)],
  setRender: [() => setRender, v => (setRender = v)],
  setSaveAll: [() => setSaveAll, v => (setSaveAll = v)],
  setToast: [() => setToast, v => (setToast = v)],
  setWritePath: [() => setWritePath, v => (setWritePath = v)],
  snapshot: [() => snapshot],
  snapshotParts: [() => snapshotParts],
  speciesName: [() => speciesName],
  speciesOptions: [() => speciesOptions],
  stageChanges: [() => stageChanges, v => (stageChanges = v)],
  statOptions: [() => statOptions],
  statusOptions: [() => statusOptions],
  studioBroadcast: [() => studioBroadcast, v => (studioBroadcast = v)],
  studioProbe: [() => studioProbe],
  studioState: [() => studioState],
  textField: [() => textField, v => (textField = v)],
  toast: [() => toast, v => setToast(v)],
  typeChipHTML: [() => typeChipHTML],
  typeOptions: [() => typeOptions],
  undo: [() => undo, v => (undo = v)],
  uniqueKey: [() => uniqueKey],
  updateTopBar: [() => updateTopBar, v => (updateTopBar = v)],
  writePath: [() => writePath, v => setWritePath(v)],
  writeStaged: [() => writeStaged, v => (writeStaged = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const studioState = {
  D: null,
  rigs: null,
  files: [],
  sec: 'billionaires',
  sec2: null /* studio track ST-1: the section in the second pane, or none */,
  sel: {},
  dirty: false,
  rigsDirty: false,
  artDirty: new Map(),
  undo: [],
  redo: [],
  snapT: null,
  last: null,
  /** Studio plan T2.2: the run data as the Studio loaded it (boot) @type {any} */
  loaded: null,
  hooks: {},
  after: [],
};
provide({ studioState }); /* to-module */
/* studio track ST-T: the Studio self-test's timings of the Studio's own work (studio/js/studio-test.js). `on` is the
   test's recorder while it runs and null otherwise, so a normal session pays one check per draw or edit */
export const studioProbe = { on: null };
const STUDIO_SERVER_KEY = window.STUDIO_KEY;
export async function api(path, opt = {}) {
  const r = await fetch('/api/' + path, {
    ...opt,
    headers: { 'X-Studio-Key': STUDIO_SERVER_KEY, ...(opt.headers || {}) },
  });
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  if (!r.ok) throw new Error((j && j.error) || r.statusText);
  return j;
}
/* phase 04d: github.js takes the GitHub route, connections.js redraws the links */
export function setApi(v) {
  api = v; // eslint-disable-line no-func-assign
  provide({ api });
}
export const clone = o => JSON.parse(JSON.stringify(o));
export const formatThousands = n => Number(n).toLocaleString('en-US');
export const uniqueKey = (base, taken) => {
  let k =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12) || 'new';
  if (!taken(k)) return k;
  let i = 2;
  while (taken(k + i)) i++;
  return k + i;
};
/* ---------- paths ---------- */
export function readPath(path, o) {
  if (o === undefined) {
    if (path.startsWith('@rigs.')) {
      o = studioState.rigs;
      path = path.slice(6);
    } else o = studioState.D;
  }
  if (path === '') return o;
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}
/* phase 04d: data-editors.js and lore-editor.js read and write fields their own way */
export function setReadPath(v) {
  readPath = v; // eslint-disable-line no-func-assign
  provide({ readPath });
}
export function writePath(path, val, o) {
  if (o === undefined) {
    if (path.startsWith('@rigs.')) {
      o = studioState.rigs;
      path = path.slice(6);
    } else o = studioState.D;
  }
  const ks = path.split('.');
  let a = o;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = ks[i];
    if (a[k] == null || typeof a[k] !== 'object') a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    a = a[k];
  }
  const k = ks[ks.length - 1];
  if (val === undefined) {
    if (Array.isArray(a)) a[k] = undefined;
    else delete a[k];
  } else a[k] = val;
}
/* phase 04d: data-editors.js and lore-editor.js read and write fields their own way */
export function setWritePath(v) {
  writePath = v; // eslint-disable-line no-func-assign
  provide({ writePath });
}
/* ---------- undo / dirty ---------- */
/* caches kept on the data (keys starting with _, as the height cache's clock in a map) are left out, as saving does:
   otherwise the snapshot changes on its own and an undo only takes that back. The whole data as one text: the
   self-test's before and after (restore puts it back) */
export const snapshot = () =>
  JSON.stringify({ D: studioState.D, R: studioState.rigs }, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v));
/* Studio plan T1.2: the data as the undo holds it, one text per entry (logic/history.js historyParts) */
export const snapshotParts = () => historyParts(studioState.D, studioState.rigs);
export function commit(now) {
  clearTimeout(studioState.snapT);
  studioState.snapT = null;
  const go = () => {
    studioState.snapT = null; /* T1.5: null when no commit is pending */
    const P = studioProbe.on,
      a = P ? performance.now() : 0,
      parts = snapshotParts(),
      b = P ? performance.now() : 0,
      top = studioState.undo[studioState.undo.length - 1];
    if (historyCommit(studioState, parts)) updateTopBar();
    if (P) {
      let chars = 0;
      for (const v of parts.values()) chars += v.length;
      const step = studioState.undo[studioState.undo.length - 1];
      /* bytes: what this edit's undo step holds, as the browser stores it */
      const bytes = step !== top ? historyBytes(step, undefined, true) : 0;
      P('commit', { snapMs: b - a, chars, bytes, ms: performance.now() - a });
    }
  };
  if (now) go();
  else studioState.snapT = setTimeout(go, 450);
}
export function changed(rigs) {
  if (rigs) {
    studioState.rigsDirty = true;
    studioState.rigVer = (studioState.rigVer || 0) + 1;
  } else studioState.dirty = true;
  commit();
  updateTopBar();
  scheduleCheck();
  if (!rigs) studioBroadcast();
}
/* v29: live update. A game tab open from this Studio (a test run, or the game on the same address) gets your scenes,
   props and engine settings (Project Story S3: and the story and trainers) half a second after each change, before
   you save; UI-3: and the UI's look; Studio plan T2.6: and the run's rules, place types, Loopholes, unlocks and items
   (a test run only applies those) */
const LIVE_UPDATE_CHANNEL = (() => {
  try {
    const c = new BroadcastChannel('networth-studio');
    c.onmessage = ev => {
      if (ev.data && ev.data.type === 'hello') studioBroadcast();
    };
    return c;
  } catch (e) {
    return null;
  }
})();
export function studioBroadcast() {
  if (!LIVE_UPDATE_CHANNEL || !studioState.D) return;
  clearTimeout(studioBroadcast.t);
  studioBroadcast.t = setTimeout(() => {
    const P = studioProbe.on,
      a = P ? performance.now() : 0;
    try {
      LIVE_UPDATE_CHANNEL.postMessage({
        type: 'data',
        D: {
          maps: studioState.D.maps,
          scenery: studioState.D.scenery,
          engine: studioState.D.engine,
          story: studioState.D.story,
          trainers: studioState.D.trainers,
          /* phase 10, session 5: the world map's look and each place's landmark */
          worldmap: studioState.D.worldmap,
          landmarks: Object.fromEntries((studioState.D.locations || []).map(l => [l.id, l.landmark || ''])),
          /* UI-3: the UI's look (the game writes it as its theme sheet) */
          uiTheme: studioState.D.uiTheme,
          /* Studio plan T2.6: what a run is made of, for a test run (Play this seed); game data only, never a save */
          rules: studioState.D.rules,
          nodeTypes: studioState.D.nodeTypes,
          relics: studioState.D.relics,
          unlocks: studioState.D.unlocks,
          items: studioState.D.items,
        },
      });
    } catch (e) {}
    if (P) P('send', { ms: performance.now() - a });
  }, 500);
}
const blurField = () => {
  const a = document.activeElement;
  if (a && a !== document.body && a.blur) a.blur();
}; /* lets a half-typed field commit before the data is swapped */
export function undo() {
  blurField();
  commit(true);
  const u = historyUndo(studioState);
  if (!u) return toast('Nothing to undo.');
  if (u.kind === 'art') {
    artStepPut(u.step, u.put);
    if (u.parts) restoreParts(u.parts);
    updateTopBar();
  } else restoreParts(u.put);
  toast('Undone.');
}
export function redo() {
  blurField();
  const u = historyRedo(studioState);
  if (!u) return toast('Nothing to redo.');
  if (u.kind === 'art') {
    artStepPut(u.step, u.put);
    if (u.parts) restoreParts(u.parts);
    updateTopBar();
  } else restoreParts(u.put);
  toast('Redone.');
}
export function restore(s) {
  const P = studioProbe.on,
    a = P ? performance.now() : 0;
  const o = JSON.parse(s);
  const b = P ? performance.now() : 0;
  studioState.D = o.D;
  studioState.rigs = o.R;
  studioState.dirty = true;
  studioState.rigsDirty = true;
  window.RIGS = studioState.rigs;
  spriteCacheClear();
  render();
  updateTopBar();
  scheduleCheck();
  if (P) P('restore', { parseMs: b - a, ms: performance.now() - a });
}
/* Studio plan T1.2: an undo or redo puts back only the parts it holds (logic/history.js has already put them in
   `last`); a change to the keys or their order (@order) rebuilds the whole data from `last` */
function restoreParts(put) {
  const P = studioProbe.on,
    a = P ? performance.now() : 0,
    S = studioState;
  let data = false,
    rigs = false;
  if (HISTORY_ORDER in put) {
    const o = historyPartsData(S.last);
    S.D = o.D;
    S.rigs = o.R;
    data = rigs = true;
  } else
    for (const name of Object.keys(put)) {
      const v = JSON.parse(put[name]);
      if (name.startsWith('R/')) {
        S.rigs[name.slice(2)] = v;
        rigs = true;
        continue;
      }
      const i = name.indexOf('/', 2),
        k = i < 0 ? name.slice(2) : name.slice(2, i);
      if (i < 0) S.D[k] = v;
      else S.D[k][Array.isArray(S.D[k]) ? +name.slice(i + 1) : name.slice(i + 1)] = v;
      data = true;
    }
  const b = P ? performance.now() : 0;
  if (data) S.dirty = true;
  if (rigs) {
    S.rigsDirty = true;
    window.RIGS = S.rigs;
  }
  spriteCacheClear();
  render();
  updateTopBar();
  scheduleCheck();
  if (P) P('restore', { parseMs: b - a, parts: Object.keys(put).length, ms: performance.now() - a });
}
export function updateTopBar() {
  $('#dirty').hidden = !(studioState.dirty || studioState.rigsDirty || studioState.artDirty.size);
  /* an edit whose commit is pending can be undone too */
  $('#undoBtn').disabled = !studioState.undo.length && studioState.snapT == null;
  $('#redoBtn').disabled = !studioState.redo.length;
  draftSoon(); /* T1.1: what is pending is kept in this browser 2 s later (drafts.js) */
}
/* ---------- save ----------
   Studio plan Phase 0: a save stages what it will send (stageChanges), sends it (writeStaged, which throws on the
   first error) and only then marks saved what is still as it was sent (confirmStaged, logic/publish-plan.js). A failed
   save leaves everything unsaved; a picture painted or data edited during the send stays unsaved. */
export const SAVE_REPLACER = (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v);
/** Studio plan T1.3: the Check before a save. An error (what check-data, and so CI, fails on) refuses it: the dialog
 * names the first few and Show me opens the Check. Warnings never stop a save. true to go on */
export async function checkBeforeSave() {
  await legacyLineIdsRead(); /* the legacy-species rule needs the parked lines (an error if read, else the old rule) */
  const errs = runCheck().filter(p => p.lvl === 'error');
  if (!errs.length) return true;
  const n = errs.length,
    list = errs
      .slice(0, 5)
      .map(p => `<li>${escapeHtml(p.msg)}</li>`)
      .join('');
  const go = await dialog(
    n === 1 ? 'Fix 1 problem first' : `Fix ${n} problems first`,
    `<p>${n === 1 ? 'This would fail' : 'These would fail'} the game data check every proposal must pass, so nothing is sent. Your changes stay here, unsaved.</p><ul class="checks">${list}</ul>${n > 5 ? `<p>And ${n - 5} more in the Check.</p>` : ''}`,
    [
      { l: 'Close', v: null },
      { l: 'Show me', c: 'primary', v: 'show' },
    ]
  );
  if (go === 'show') openSection('check');
  return false;
}
/** what a save will send, without marking anything saved: each unsaved picture with its version, the rigs' text, the
 * data's text (with meta.artVersion one up when pictures go too; the data itself changes only on confirm) */
export function stageChanges() {
  const S = studioState,
    art = [...S.artDirty].map(([path, c]) => ({ path, c, ver: c._ver || 0 })),
    artVersion = art.length ? (S.D.meta.artVersion || 0) + 1 : null;
  let dataText = null;
  if (S.dirty || art.length) {
    const meta = S.D.meta;
    if (artVersion != null) S.D.meta = { ...meta, artVersion };
    try {
      dataText = JSON.stringify(S.D, SAVE_REPLACER);
    } finally {
      S.D.meta = meta;
    }
  }
  return { art, artVersion, dataText, rigsText: S.rigsDirty ? JSON.stringify(S.rigs) : null };
}
/** sends a stage through api(): pictures, rigs, data. Throws on the first failure (on GitHub nothing has left yet) */
export async function writeStaged(staged) {
  for (const a of staged.art) {
    const blob = await new Promise(r => a.c.toBlob(r, a.path.endsWith('.webp') ? 'image/webp' : 'image/png', 0.85));
    if (!blob) throw new Error(`${a.path} could not be turned into a picture.`);
    await api('file?path=' + encodeURIComponent(a.path), { method: 'POST', body: blob });
  }
  if (staged.rigsText != null) await api('rigs', { method: 'POST', body: staged.rigsText });
  if (staged.dataText != null) await api('gamedata', { method: 'POST', body: staged.dataText });
}
/** after the server took a stage: marks saved what is still as it was sent */
export function confirmStaged(staged) {
  const S = studioState;
  if (staged.artVersion != null) S.D.meta.artVersion = Math.max(S.D.meta.artVersion || 0, staged.artVersion);
  const ok = publishConfirm(staged, {
    dataText: staged.dataText != null ? JSON.stringify(S.D, SAVE_REPLACER) : null,
    rigsText: staged.rigsText != null ? JSON.stringify(S.rigs) : null,
    art: Object.fromEntries(staged.art.map(a => [a.path, S.artDirty.get(a.path) === a.c ? a.c._ver || 0 : null])),
  });
  if (ok.data) S.dirty = false;
  if (ok.rigs) S.rigsDirty = false;
  for (const p of ok.art) S.artDirty.delete(p);
  updateTopBar();
  draftNow(); /* T1.1: the draft goes (or keeps only what is still unsaved) at once, not 2 s later */
  return ok;
}
export async function saveAll() {
  const btn = $('#saveBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    if (!(await checkBeforeSave())) return;
    const staged = stageChanges();
    if (publishEmpty(staged)) return toast('Everything was already saved.', 'ok');
    await writeStaged(staged);
    confirmStaged(staged);
    toast('Saved to the game. Reload the game tab to see the changes.', 'ok');
  } catch (e) {
    toast('Save failed: ' + e.message + ' Nothing was marked saved: save again.', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save to game';
  }
}
/* phase 04d: github.js takes the GitHub route, connections.js redraws the links */
export function setSaveAll(v) {
  saveAll = v; // eslint-disable-line no-func-assign
  provide({ saveAll });
}
/* ---------- toasts & dialogs ---------- */
export function toast(t, k = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + k;
  el.textContent = t;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}
/* phase 04d: github.js takes the GitHub route, connections.js redraws the links */
function setToast(v) {
  toast = v; // eslint-disable-line no-func-assign
  provide({ toast });
}
export function dialog(title, html, btns, cls = '') {
  return new Promise(res => {
    const m = $('#dlg');
    m.innerHTML = `<div class="scrim"><div class="dlg ${cls}" role="dialog" aria-modal="true"><h2>${title}</h2><div class="dlg-body">${html}</div><div class="dlg-btns">${btns.map((b, i) => `<button class="btn ${b.c || ''}" data-dlg="${i}">${b.l}</button>`).join('')}</div></div></div>`;
    const close = v => {
      m.innerHTML = '';
      document.removeEventListener('keydown', kd);
      res(v);
    };
    const kd = e => {
      if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', kd);
    m.querySelectorAll('[data-dlg]').forEach(
      b =>
        (b.onclick = () => {
          const B = btns[+b.dataset.dlg];
          const v = B.f ? B.f(m) : B.v !== undefined ? B.v : +b.dataset.dlg;
          if (B.f && v === false) return;
          close(v);
        })
    );
    const f = m.querySelector('input,select,textarea,button');
    if (f) f.focus();
  });
}
export const ask = (msg, yes = 'OK', no = 'Cancel', title = 'Are you sure?') =>
  dialog(title, `<p>${msg}</p>`, [
    { l: no, v: false },
    { l: yes, c: 'primary', v: true },
  ]);
/* ---------- fields bound to the data ---------- */
const helpHTML = s => (s ? `<small class="help">${s}</small>` : '');
export const fieldOutputId = p => 'f_' + p.replace(/[^a-z0-9]/gi, '_');
export function numberField(label, p, o = {}) {
  let v = readPath(p);
  if (v != null && o.scale) v = +(v / o.scale).toFixed(4);
  return `<label class="fld ${o.cls || ''}"><span>${label}</span><span class="numw"><input type="number" data-p="${p}" data-k="num" ${o.scale ? `data-scale="${o.scale}"` : ''} ${o.opt ? 'data-opt="1"' : ''} value="${v == null ? '' : v}" ${o.min != null ? `min="${o.min}"` : ''} ${o.max != null ? `max="${o.max}"` : ''} step="${o.step || 'any'}" placeholder="${o.ph || ''}">${o.unit ? `<em>${o.unit}</em>` : ''}</span>${helpHTML(o.help)}</label>`;
}
export function rangeField(label, p, o = {}) {
  const v = readPath(p) ?? o.def ?? 0;
  return `<label class="fld range ${o.cls || ''}"><span>${label} <output id="${fieldOutputId(p)}">${o.show ? o.show(v) : v}</output></span><input type="range" data-p="${p}" data-k="num" data-show="${o.showKey || ''}" value="${v}" min="${o.min}" max="${o.max}" step="${o.step || 1}">${helpHTML(o.help)}</label>`;
}
export function textField(label, p, o = {}) {
  const v = readPath(p) ?? '';
  return o.area
    ? `<label class="fld wide ${o.cls || ''}"><span>${label}</span><textarea data-p="${p}" data-k="text" rows="${o.rows || 3}" ${o.opt ? 'data-opt="1"' : ''} placeholder="${escapeHtml(o.ph || '')}">${escapeHtml(v)}</textarea>${helpHTML(o.help)}</label>`
    : `<label class="fld ${o.cls || ''}"><span>${label}</span><input type="text" data-p="${p}" data-k="text" ${o.opt ? 'data-opt="1"' : ''} value="${escapeHtml(v)}" placeholder="${escapeHtml(o.ph || '')}" ${o.max ? `maxlength="${o.max}"` : ''}>${helpHTML(o.help)}</label>`;
}
export function selectField(label, p, opts, o = {}) {
  const v = readPath(p);
  return `<label class="fld ${o.cls || ''}"><span>${label}</span><select data-p="${p}" data-k="${o.num ? 'num' : 'sel'}" ${o.opt ? 'data-opt="1"' : ''} ${o.rr ? 'data-rr="1"' : ''}>${o.none ? `<option value="">${o.none}</option>` : ''}${opts.map(([k, n]) => `<option value="${escapeHtml(k)}" ${String(v) === String(k) ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>${helpHTML(o.help)}</label>`;
}
export function checkboxField(label, p, o = {}) {
  const v = readPath(p);
  return `<label class="fld chk ${o.cls || ''}"><input type="checkbox" data-p="${p}" data-k="bool" ${o.num ? 'data-num="1"' : ''} ${o.rr ? 'data-rr="1"' : ''} ${v ? 'checked' : ''}><span>${label}</span>${helpHTML(o.help)}</label>`;
}
export function colorField(label, p, o = {}) {
  const v = readPath(p) || o.def || '#000000'; /* o.def: shown when the data has none, not written */
  return `<label class="fld color ${o.cls || ''}"><span>${label}</span><span class="colw"><input type="color" data-p="${p}" data-k="color" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'}"><input type="text" data-p="${p}" data-k="color" value="${escapeHtml(v)}" maxlength="7" class="hex"></span>${helpHTML(o.help)}</label>`;
}
export const card = (title, body, o = {}) =>
  `<section class="card ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}><header><h3>${title}</h3>${o.acts || ''}</header>${o.sub ? `<p class="sub">${o.sub}</p>` : ''}<div class="card-b">${body}</div></section>`;
export const grid = (...f) => `<div class="grid">${f.join('')}</div>`;
/* input → data */
function readField(el) {
  const k = el.dataset.k;
  if (k === 'bool') return el.dataset.num ? (el.checked ? 1 : undefined) : el.checked;
  if (k === 'num') {
    if (el.value === '' && el.dataset.opt) return undefined;
    const n = parseFloat(el.value);
    if (!Number.isFinite(n)) return undefined;
    return el.dataset.scale ? Math.round(n * +el.dataset.scale) : n;
  }
  if (k === 'color') {
    /* UI-3: a colour that may be see-through (data-a): #rrggbbaa in its text field; the picker keeps the alpha it had */
    if (el.dataset.a && el.type === 'color') return el.value.toUpperCase() + (el.dataset.alpha || '');
    const ok = el.dataset.a ? /^#[0-9a-f]{6}([0-9a-f]{2})?$/i : /^#[0-9a-f]{6}$/i;
    return ok.test(el.value) ? el.value.toUpperCase() : undefined;
  }
  if ((k === 'text' || k === 'sel') && el.value === '' && el.dataset.opt) return undefined;
  return el.value;
}
function onField(ev) {
  const el = ev.target;
  if (!el.dataset || !el.dataset.p) return;
  const v = readField(el);
  if (v === undefined && el.dataset.k === 'color') return;
  if (v === undefined && el.dataset.k === 'num' && !el.dataset.opt) return;
  writePath(el.dataset.p, v);
  if (el.dataset.k === 'color') {
    $$(`[data-p="${el.dataset.p}"]`).forEach(o => {
      if (o === el) return;
      /* a colour picker holds #rrggbb only: the alpha byte stays beside it */
      if (o.type === 'color') {
        o.value = v.slice(0, 7);
        if (o.dataset.a) o.dataset.alpha = v.slice(7);
      } else o.value = v;
    });
  }
  const out = document.getElementById(fieldOutputId(el.dataset.p));
  if (out) out.textContent = el.dataset.show && RANGE_FORMATS[el.dataset.show] ? RANGE_FORMATS[el.dataset.show](v) : v;
  changed(el.dataset.p.startsWith('@rigs'));
  const hk = studioState.hooks[studioState.sec];
  if (hk) hk(el.dataset.p, v);
  if (el.dataset.rr && ev.type === 'change') render();
}
const RANGE_FORMATS = { pct: v => Math.round(v * 100) + '%', x: v => '×' + (+v).toFixed(2), mul: v => (+v).toFixed(2) };
/* ---------- navigation ---------- */
export const SECTION_LIST = [
  ['billionaires', 'Billies', 'The creatures: names, stats, moves, evolution, sprite art'],
  ['roster', 'Roster board', 'The Billies in the game and how far their art is'],
  ['parts', 'Parts', 'Part sizes, weight and Prime Billies'],
  ['coats', 'Coats', 'Recolours of a Billie’s art, and how often each turns up'],
  ['workbench', 'Art workbench', 'Cut sheets into parts (drop a PNG anywhere); parts, pixels and models next'],
  ['robots', 'Robots', 'Robot parts, gems, their pictures and the rules behind them'],
  ['moves', 'Moves', 'Attacks and their effects'],
  ['preview', 'Battle preview', 'Watch moves, backdrops and Billies on the real battle stage'],
  ['types', 'Types', 'Colors, matchups and type abilities'],
  ['items', 'Items & coins', 'Shop goods, tax coins'],
  ['shops', 'Town shops', 'Keepers and what they sell'],
  ['world', 'World & encounters', 'Route stops, who appears where, eggs, map'],
  ['scenes', 'Walk scenes', 'Towns and routes on the Walk screen: ground, props and camera'],
  ['hub', 'Hub island', 'The hub’s island: an orbit view, its ground, coast, zones and pivot, and the ground lock'],
  ['props', 'Props', 'Every prop: its picture, 3D model, leaves, variants, and where it stands'],
  ['engine', 'Engine', 'Light, shadows, blur, color and camera of the 3D scenes'],
  ['wardrobe', 'Wardrobe', 'Trainer body, hairstyles, faces and clothes'],
  ['trainers', 'Trainers', 'Rivals and arena leaders'],
  ['lore', 'Lore & story', 'The world, the story, people, places, legends, clues, books and what people say'],
  ['story', 'Story scripts', 'The story’s own scripts (story.json), its flags, start presets and quests'],
  ['people', 'People', 'Looks for trainers and shopkeepers'],
  ['jobs', 'Jobs', 'What working Billies earn (not in the game until the ranch)'],
  ['rules', 'Rules', 'Every number that tunes the game'],
  ['ui', 'UI look', 'The menus’ look: colours, glass, shapes, space, type and motion, for the game or one screen'],
  ['art', 'Art files', 'Browse and replace any image'],
  ['music', 'Music & sound', 'Play and edit the songs, where each one plays, and the jingles'],
  ['check', 'Check & backups', 'Problems, backups and restore'],
  ['legacy', 'Legacy world', 'The places parked outside the hub, read-only: copy a map into the game'],
  ['runlab', 'Run Lab', 'A run’s map from its seed, as the game makes it, on your unsaved data'],
];
/* alpha 0.4.1: the sections in five groups that fold away; the one you're in always shows. The descriptions show as
   a tooltip and under the section you're in, so the list is short enough to see at once */
const SECTION_GROUPS = [
  [
    'Billies & battles',
    ['billionaires', 'parts', 'workbench', 'coats', 'robots', 'roster', 'moves', 'preview', 'types'],
  ],
  ['World & places', ['scenes', 'hub', 'props', 'engine', 'world']],
  ['People & story', ['trainers', 'people', 'wardrobe', 'lore', 'story']],
  ['Money', ['items', 'shops', 'jobs']],
  ['Game', ['rules', 'ui', 'art', 'check']],
  /* SND-3: the songs, the where table and the jingles (music-editor.js); the cries are on the Billies page */
  ['Sound', ['music']],
  /* Studio plan Phase 2: runs (T2.2's Run Lab; the run rules editor and Phase 4's roguelite editors join it) */
  ['Runs', ['runlab']],
  /* RL-5: the old world outside the hub, parked in game/data/legacy (legacy-view.js) */
  ['Legacy', ['legacy']],
];
const foldedSectionGroups = (() => {
  try {
    return JSON.parse(localStorage.getItem('studio-fold') || '{}');
  } catch (e) {
    return {};
  }
})();
export function renderSide() {
  const N = Object.fromEntries(SECTION_LIST.map(n => [n[0], n])),
    used = new Set(SECTION_GROUPS.flatMap(g => g[1])),
    G = SECTION_GROUPS.concat([['More', SECTION_LIST.map(n => n[0]).filter(k => !used.has(k))]]).filter(g =>
      g[1].some(k => N[k])
    );
  $('#side').innerHTML =
    G.map(([t, L]) => {
      const has = L.includes(studioState.sec),
        shut = foldedSectionGroups[t] && !has;
      return `<div class="nav-g ${shut ? 'shut' : ''}"><button class="nav-gh" data-act="navFold" data-g="${escapeHtml(t)}" aria-expanded="${!shut}"><span>${shut ? '▸' : '▾'}</span>${escapeHtml(t)}</button>${
        shut
          ? ''
          : L.filter(k => N[k])
              .map(k => {
                const [, n, d] = N[k],
                  why = besideRefusal(k);
                return `<div class="nav-row"><button class="nav ${studioState.sec === k ? 'on' : studioState.sec2 === k ? 'on2' : ''}" data-act="go" data-s="${k}" title="${escapeHtml(d)} (Shift-click: open beside)"><b>${n}</b>${studioState.sec === k ? `<small>${d}</small>` : ''}</button><button class="nav-beside" data-act="openBeside" data-s="${k}" ${why ? `disabled title="${escapeHtml(why)}"` : `title="Open ${escapeHtml(n)} beside this section"`}>⇥</button></div>`;
              })
              .join('')
      }</div>`;
    }).join('') +
    `<div class="side-foot"><small><kbd>Ctrl K</kbd> finds any setting · <kbd>Ctrl L</kbd> shows connections · <kbd>Ctrl S</kbd> saves · <kbd>?</kbd> lists the keys.<br>Saves go to <code>game/data</code> and <code>game/art</code>, with backups in <code>backups/</code>.</small></div>`;
}
/* studio track ST-1: the second pane shows any section but the ones with a 3D view (IS-6a: Hub island too) (they share one) and the one in
   the first pane (its ids would clash); why not, or '' */
export const PANE2_REFUSED = { scenes: 1, hub: 1, props: 1, engine: 1, preview: 1 };
export function besideRefusal(s) {
  if (PANE2_REFUSED[s]) return 'Has a 3D view, so it only opens on the left';
  if (s === studioState.sec) return 'Already open on the left';
  return '';
}
export function openSection(s, sel) {
  if (studioState.sec === 'preview' && s !== 'preview' && typeof battleStageStop === 'function') battleStageStop();
  if (typeof engineContext !== 'undefined') engineContext.bypass = false;
  /* the second pane's section moves to the first: the two swap (or the second pane closes, for a 3D one) */
  if (studioState.sec2 === s) studioState.sec2 = PANE2_REFUSED[studioState.sec] ? null : studioState.sec;
  studioState.sec = s;
  if (sel) Object.assign(studioState.sel, sel);
  renderSide();
  render();
  $('#main').scrollTop = 0;
  try {
    history.replaceState(null, '', '#' + s);
  } catch (e) {}
}
export const SECTIONS = {};
export const ACTIONS = {};
ACTIONS.navFold = d => {
  foldedSectionGroups[d.g] = !foldedSectionGroups[d.g];
  try {
    localStorage.setItem('studio-fold', JSON.stringify(foldedSectionGroups));
  } catch (e) {}
  renderSide();
};
/* studio track ST-1: whether a section is on screen, in either pane */
export const sectionShown = k => studioState.sec === k || studioState.sec2 === k;
/* studio track ST-1: a section draws into a pane (#main); paneRoot() is the pane being drawn, for afterRender */
let renderingPane = null;
export const paneRoot = () => renderingPane || $('#main');
export function render() {
  renderPane($('#main'), studioState.sec);
}
export function renderPane(m, sec) {
  const S = SECTIONS[sec];
  if (!S) return;
  renderingPane = m;
  try {
    studioState.after = [];
    const P = studioProbe.on,
      t0 = P ? performance.now() : 0;
    const html = S();
    const t1 = P ? performance.now() : 0;
    m.innerHTML = html;
    const t2 = P ? performance.now() : 0;
    studioState.after.forEach(f => f());
    const t3 = P ? performance.now() : 0;
    mountPreviews(m);
    if (P)
      P('render', { sec, pane: m.id, html: t1 - t0, dom: t2 - t1, after: t3 - t2, previews: performance.now() - t3 });
  } finally {
    renderingPane = null;
  }
}
/* phase 04d: github.js takes the GitHub route, connections.js redraws the links */
export function setRender(v) {
  render = v; // eslint-disable-line no-func-assign
  provide({ render });
}
export const afterRender = f => {
  studioState.after.push(f);
};
/* ---------- events ---------- */
document.addEventListener('input', ev => {
  if (ev.target.closest('.pane,#modal,#dlg')) onField(ev);
});
document.addEventListener('change', ev => {
  if (ev.target.closest('.pane,#modal,#dlg') && ev.target.dataset.p) {
    onField(ev);
    commit(true);
  }
});
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (a === 'go' && ev.shiftKey && ACTIONS.openBeside && !besideRefusal(el.dataset.s))
    return ACTIONS.openBeside(el.dataset);
  if (a === 'go') return openSection(el.dataset.s);
  if (a === 'undo') return undo();
  if (a === 'redo') return redo();
  if (a === 'save') return saveAll();
  if (a === 'goCheck') return openSection('check');
  if (a === 'play') {
    window.open('../game/index.html?debug', 'networth-game');
    return;
  }
  const f = ACTIONS[a];
  if (f) {
    ev.preventDefault();
    f(el.dataset, el, ev);
  }
});
document.addEventListener('keydown', ev => {
  const mod = ev.ctrlKey || ev.metaKey;
  if (!mod) return;
  const k = ev.key.toLowerCase();
  if (k === 's') {
    ev.preventDefault();
    saveAll();
  } else if (k === 'z' && !ev.target.closest('input[type=text],textarea') && !$('.pxed')) {
    ev.preventDefault();
    ev.shiftKey ? redo() : undo();
  } else if (k === 'y' && !$('.pxed')) {
    ev.preventDefault();
    redo();
  }
});
addEventListener('beforeunload', e => {
  if (studioState.dirty || studioState.rigsDirty || studioState.artDirty.size) {
    e.preventDefault();
    e.returnValue = '';
  }
});
/* ---------- helpers for lists of things ---------- */
export const typeOptions = none =>
  (none ? [['None', 'Normal']] : []).concat(studioState.D.types.map(t => [t.id, t.id]));
export const speciesOptions = () =>
  studioState.D.lines.flatMap(L => L.names.map((n, i) => [L.id + i, `${n} (${L.id}${i})`]));
export const moveOptions = () =>
  Object.keys(studioState.D.moves)
    .sort((a, b) => studioState.D.moves[a].n.localeCompare(studioState.D.moves[b].n))
    .map(k => [k, `${studioState.D.moves[k].n} · ${studioState.D.moves[k].t}`]);
export const itemOptions = () => Object.keys(studioState.D.items).map(k => [k, studioState.D.items[k].n]);
export const coinOptions = () => Object.keys(studioState.D.coins).map(k => [k, studioState.D.coins[k].n]);
export const peopleOptions = () => Object.keys(studioState.D.people).map(k => [k, k]);
export const statusOptions = () => studioState.D.statuses.map(s => [s.id, s.name]);
export const statOptions = () => studioState.D.stats.filter(s => s.id !== 'hp').map(s => [s.id, s.name]);
export const speciesName = id => {
  const L = studioState.D.lines.find(l => id && id.startsWith(l.id) && /^\d+$/.test(id.slice(l.id.length)));
  return L ? L.names[+id.slice(L.id.length)] || id : id;
};
export const typeChipHTML = t => {
  const T = studioState.D.types.find(x => x.id === t);
  const c = T ? [T.color, T.text] : [studioState.D.untyped.color, studioState.D.untyped.text];
  return `<span class="chip" style="background:${c[0]};color:${c[1]}">${t === 'None' ? 'Normal' : escapeHtml(t)}</span>`;
};
/* ---------- boot ---------- */
export async function boot() {
  try {
    performance.mark('studio-boot');
    const [D, R, F] = await Promise.all([api('gamedata'), api('rigs'), api('files?dir='), artLoad([ICON_ATLAS])]);
    performance.mark('studio-data-loaded');
    studioState.D = D;
    /* Studio plan T2.2: the run data as loaded, for the Run Lab's "beside the loaded data" */
    studioState.loaded = clone({
      rules: D.rules,
      nodeTypes: D.nodeTypes,
      biomes: D.biomes,
      unlocks: D.unlocks,
      buildings: D.buildings,
    });
    studioState.rigs = R;
    if (window.RIGS_NEXT) for (const k in window.RIGS_NEXT) if (!R[k]) R[k] = window.RIGS_NEXT[k];
    window.RIGS = R;
    studioState.files = F;
    studioState.last = snapshotParts();
    const h = location.hash.slice(1);
    if (SECTION_LIST.some(n => n[0] === h)) studioState.sec = h;
    renderSide();
    render();
    updateTopBar();
    scheduleCheck(true);
    performance.mark('studio-first-draw');
  } catch (e) {
    $('#main').innerHTML =
      `<div class="loading err"><h2>The Studio couldn’t load the game data</h2><p>${escapeHtml(e.message)}</p><p>From the game's site: check your connection and reload; if it says the sign-in expired, sign out and in again.</p></div>`;
  }
}
addEventListener('load', boot);
