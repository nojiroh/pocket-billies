'use strict';
/* ================= POCKET BILLIES STUDIO · core =================
   State, server calls, undo, form fields bound to paths in the game data, navigation, toasts and dialogs. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/bridge.js';
import { mountPreviews, provide, runCheck, scheduleCheck, spriteCacheClear } from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { ICON_ATLAS, artLoad } from '../../game/js/art.js';
import { scStop } from '../../game/js/scene.js';
import { ENG_CTX } from '../../game/js/engine/settings.js';
import { esc } from './shims.js';
/* eslint-disable no-func-assign */
expose({
  ACTS: [() => ACTS],
  H: [() => H],
  KEY: [() => KEY],
  NAV: [() => NAV],
  NAV_GROUPS: [() => NAV_GROUPS],
  SECTIONS: [() => SECTIONS],
  SHOW: [() => SHOW],
  SLINK: [() => SLINK],
  ST: [() => ST],
  after: [() => after],
  api: [() => api, v => setApi(v)],
  ask: [() => ask],
  blurField: [() => blurField],
  boot: [() => boot, v => (boot = v)],
  card: [() => card],
  changed: [() => changed, v => (changed = v)],
  chipT: [() => chipT],
  clone: [() => clone],
  coinOpts: [() => coinOpts],
  commit: [() => commit, v => (commit = v)],
  dialog: [() => dialog, v => (dialog = v)],
  fChk: [() => fChk, v => (fChk = v)],
  fColor: [() => fColor, v => (fColor = v)],
  fNum: [() => fNum, v => (fNum = v)],
  fRange: [() => fRange, v => (fRange = v)],
  fSel: [() => fSel, v => (fSel = v)],
  fText: [() => fText, v => (fText = v)],
  fid: [() => fid],
  fmtN: [() => fmtN],
  getP: [() => getP, v => setGetP(v)],
  go: [() => go, v => (go = v)],
  grid: [() => grid],
  itemOpts: [() => itemOpts],
  moveOpts: [() => moveOpts],
  navFold: [() => navFold],
  onField: [() => onField, v => (onField = v)],
  peopleOpts: [() => peopleOpts],
  readField: [() => readField, v => (readField = v)],
  redo: [() => redo, v => (redo = v)],
  render: [() => render, v => setRender(v)],
  renderSide: [() => renderSide, v => (renderSide = v)],
  restore: [() => restore, v => (restore = v)],
  saveAll: [() => saveAll, v => setSaveAll(v)],
  setApi: [() => setApi, v => (setApi = v)],
  setGetP: [() => setGetP, v => (setGetP = v)],
  setP: [() => setP, v => setSetP(v)],
  setRender: [() => setRender, v => (setRender = v)],
  setSaveAll: [() => setSaveAll, v => (setSaveAll = v)],
  setSetP: [() => setSetP, v => (setSetP = v)],
  setToast: [() => setToast, v => (setToast = v)],
  snapshot: [() => snapshot],
  spName: [() => spName],
  spOpts: [() => spOpts],
  statOpts: [() => statOpts],
  statusOpts: [() => statusOpts],
  studioBroadcast: [() => studioBroadcast, v => (studioBroadcast = v)],
  toast: [() => toast, v => setToast(v)],
  typeOpts: [() => typeOpts],
  uidKey: [() => uidKey],
  undo: [() => undo, v => (undo = v)],
  updTop: [() => updTop, v => (updTop = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const ST = {
  D: null,
  rigs: null,
  files: [],
  sec: 'billionaires',
  sel: {},
  dirty: false,
  rigsDirty: false,
  artDirty: new Map(),
  undo: [],
  redo: [],
  snapT: null,
  last: null,
  hooks: {},
  after: [],
};
provide({ ST }); /* to-module */
const KEY = window.STUDIO_KEY;
export async function api(path, opt = {}) {
  const r = await fetch('/api/' + path, { ...opt, headers: { 'X-Studio-Key': KEY, ...(opt.headers || {}) } });
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  if (!r.ok) throw new Error((j && j.error) || r.statusText);
  return j;
}
/* phase 04d: github.js takes the GitHub route, links.js redraws the links */
export function setApi(v) {
  api = v; // eslint-disable-line no-func-assign
  provide({ api });
}
export const clone = o => JSON.parse(JSON.stringify(o));
export const fmtN = n => Number(n).toLocaleString('en-US');
export const uidKey = (base, taken) => {
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
export function getP(path, o) {
  if (o === undefined) {
    if (path.startsWith('@rigs.')) {
      o = ST.rigs;
      path = path.slice(6);
    } else o = ST.D;
  }
  if (path === '') return o;
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}
/* phase 04d: sections.js and lore.js read and write fields their own way */
export function setGetP(v) {
  getP = v; // eslint-disable-line no-func-assign
  provide({ getP });
}
export function setP(path, val, o) {
  if (o === undefined) {
    if (path.startsWith('@rigs.')) {
      o = ST.rigs;
      path = path.slice(6);
    } else o = ST.D;
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
/* phase 04d: sections.js and lore.js read and write fields their own way */
export function setSetP(v) {
  setP = v; // eslint-disable-line no-func-assign
  provide({ setP });
}
/* ---------- undo / dirty ---------- */
const snapshot = () => JSON.stringify({ D: ST.D, R: ST.rigs });
export function commit(now) {
  clearTimeout(ST.snapT);
  const go = () => {
    const s = snapshot();
    if (s === ST.last) return;
    if (ST.last) ST.undo.push(ST.last);
    if (ST.undo.length > 80) ST.undo.shift();
    ST.redo = [];
    ST.last = s;
    updTop();
  };
  if (now) go();
  else ST.snapT = setTimeout(go, 450);
}
export function changed(rigs) {
  if (rigs) {
    ST.rigsDirty = true;
    ST.rigVer = (ST.rigVer || 0) + 1;
  } else ST.dirty = true;
  commit();
  updTop();
  scheduleCheck();
  if (!rigs) studioBroadcast();
}
/* v29: live update. A game tab open from this Studio (a test run, or the game on the same address) gets your scenes,
   props and engine settings half a second after each change, before you save */
const SLINK = (() => {
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
function studioBroadcast() {
  if (!SLINK || !ST.D) return;
  clearTimeout(studioBroadcast.t);
  studioBroadcast.t = setTimeout(() => {
    try {
      SLINK.postMessage({ type: 'data', D: { scenes: ST.D.scenes, scenery: ST.D.scenery, engine: ST.D.engine } });
    } catch (e) {}
  }, 500);
}
const blurField = () => {
  const a = document.activeElement;
  if (a && a !== document.body && a.blur) a.blur();
}; /* lets a half-typed field commit before the data is swapped */
export function undo() {
  blurField();
  commit(true);
  if (!ST.undo.length) return toast('Nothing to undo.');
  ST.redo.push(ST.last);
  ST.last = ST.undo.pop();
  restore(ST.last);
  toast('Undone.');
}
export function redo() {
  blurField();
  if (!ST.redo.length) return toast('Nothing to redo.');
  ST.undo.push(ST.last);
  ST.last = ST.redo.pop();
  restore(ST.last);
  toast('Redone.');
}
function restore(s) {
  const o = JSON.parse(s);
  ST.D = o.D;
  ST.rigs = o.R;
  ST.dirty = true;
  ST.rigsDirty = true;
  window.RIGS = ST.rigs;
  spriteCacheClear();
  render();
  updTop();
  scheduleCheck();
}
export function updTop() {
  $('#dirty').hidden = !(ST.dirty || ST.rigsDirty || ST.artDirty.size);
  $('#undoBtn').disabled = !ST.undo.length && ST.last === snapshot();
  $('#redoBtn').disabled = !ST.redo.length;
}
/* ---------- save ---------- */
export async function saveAll() {
  const btn = $('#saveBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const errs = runCheck().filter(p => p.lvl === 'error');
    if (
      errs.length &&
      !(await ask(
        `There ${errs.length === 1 ? 'is 1 problem' : 'are ' + errs.length + ' problems'} the game can work around, but you’ll probably want to fix ${errs.length === 1 ? 'it' : 'them'}. Save anyway?`,
        'Save anyway',
        'Review problems'
      ))
    ) {
      go('check');
      return;
    }
    let n = 0;
    if (ST.artDirty.size) {
      for (const [path, c] of ST.artDirty) {
        const blob = await new Promise(r => c.toBlob(r, path.endsWith('.webp') ? 'image/webp' : 'image/png', 0.85));
        await api('file?path=' + encodeURIComponent(path), { method: 'POST', body: blob });
        n++;
      }
      ST.artDirty.clear();
      ST.D.meta.artVersion = (ST.D.meta.artVersion || 0) + 1;
      ST.dirty = true;
    }
    if (ST.rigsDirty) {
      await api('rigs', { method: 'POST', body: JSON.stringify(ST.rigs) });
      ST.rigsDirty = false;
      n++;
    }
    if (ST.dirty) {
      await api('gamedata', {
        method: 'POST',
        body: JSON.stringify(ST.D, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v)),
      });
      ST.dirty = false;
      n++;
    }
    toast(n ? 'Saved to the game. Reload the game tab to see the changes.' : 'Everything was already saved.', 'ok');
    updTop();
  } catch (e) {
    toast('Save failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save to game';
  }
}
/* phase 04d: github.js takes the GitHub route, links.js redraws the links */
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
/* phase 04d: github.js takes the GitHub route, links.js redraws the links */
export function setToast(v) {
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
const H = s => (s ? `<small class="help">${s}</small>` : '');
export const fid = p => 'f_' + p.replace(/[^a-z0-9]/gi, '_');
export function fNum(label, p, o = {}) {
  let v = getP(p);
  if (v != null && o.scale) v = +(v / o.scale).toFixed(4);
  return `<label class="fld ${o.cls || ''}"><span>${label}</span><span class="numw"><input type="number" data-p="${p}" data-k="num" ${o.scale ? `data-scale="${o.scale}"` : ''} ${o.opt ? 'data-opt="1"' : ''} value="${v == null ? '' : v}" ${o.min != null ? `min="${o.min}"` : ''} ${o.max != null ? `max="${o.max}"` : ''} step="${o.step || 'any'}" placeholder="${o.ph || ''}">${o.unit ? `<em>${o.unit}</em>` : ''}</span>${H(o.help)}</label>`;
}
export function fRange(label, p, o = {}) {
  const v = getP(p) ?? o.def ?? 0;
  return `<label class="fld range ${o.cls || ''}"><span>${label} <output id="${fid(p)}">${o.show ? o.show(v) : v}</output></span><input type="range" data-p="${p}" data-k="num" data-show="${o.showKey || ''}" value="${v}" min="${o.min}" max="${o.max}" step="${o.step || 1}">${H(o.help)}</label>`;
}
export function fText(label, p, o = {}) {
  const v = getP(p) ?? '';
  return o.area
    ? `<label class="fld wide ${o.cls || ''}"><span>${label}</span><textarea data-p="${p}" data-k="text" rows="${o.rows || 3}" ${o.opt ? 'data-opt="1"' : ''} placeholder="${esc(o.ph || '')}">${esc(v)}</textarea>${H(o.help)}</label>`
    : `<label class="fld ${o.cls || ''}"><span>${label}</span><input type="text" data-p="${p}" data-k="text" ${o.opt ? 'data-opt="1"' : ''} value="${esc(v)}" placeholder="${esc(o.ph || '')}" ${o.max ? `maxlength="${o.max}"` : ''}>${H(o.help)}</label>`;
}
export function fSel(label, p, opts, o = {}) {
  const v = getP(p);
  return `<label class="fld ${o.cls || ''}"><span>${label}</span><select data-p="${p}" data-k="${o.num ? 'num' : 'sel'}" ${o.opt ? 'data-opt="1"' : ''} ${o.rr ? 'data-rr="1"' : ''}>${o.none ? `<option value="">${o.none}</option>` : ''}${opts.map(([k, n]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>${H(o.help)}</label>`;
}
export function fChk(label, p, o = {}) {
  const v = getP(p);
  return `<label class="fld chk ${o.cls || ''}"><input type="checkbox" data-p="${p}" data-k="bool" ${o.num ? 'data-num="1"' : ''} ${o.rr ? 'data-rr="1"' : ''} ${v ? 'checked' : ''}><span>${label}</span>${H(o.help)}</label>`;
}
export function fColor(label, p, o = {}) {
  const v = getP(p) || '#000000';
  return `<label class="fld color ${o.cls || ''}"><span>${label}</span><span class="colw"><input type="color" data-p="${p}" data-k="color" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'}"><input type="text" data-p="${p}" data-k="color" value="${esc(v)}" maxlength="7" class="hex"></span>${H(o.help)}</label>`;
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
    return /^#[0-9a-f]{6}$/i.test(el.value) ? el.value.toUpperCase() : undefined;
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
  setP(el.dataset.p, v);
  if (el.dataset.k === 'color') {
    $$(`[data-p="${el.dataset.p}"]`).forEach(o => {
      if (o !== el) o.value = v;
    });
  }
  const out = document.getElementById(fid(el.dataset.p));
  if (out) out.textContent = el.dataset.show && SHOW[el.dataset.show] ? SHOW[el.dataset.show](v) : v;
  changed(el.dataset.p.startsWith('@rigs'));
  const hk = ST.hooks[ST.sec];
  if (hk) hk(el.dataset.p, v);
  if (el.dataset.rr && ev.type === 'change') render();
}
const SHOW = { pct: v => Math.round(v * 100) + '%', x: v => '×' + (+v).toFixed(2), mul: v => (+v).toFixed(2) };
/* ---------- navigation ---------- */
export const NAV = [
  ['billionaires', 'Billies', 'The creatures: names, stats, moves, evolution, sprite art'],
  ['roster', 'Roster board', 'The 117 new Billies of the big art update and how far each is'],
  ['moves', 'Moves', 'Attacks and their effects'],
  ['preview', 'Battle preview', 'Watch moves, backdrops and Billies on the real battle stage'],
  ['types', 'Types', 'Colors, matchups and type abilities'],
  ['items', 'Items & coins', 'Shop goods, tax coins'],
  ['shops', 'Town shops', 'Keepers and what they sell'],
  ['world', 'World & encounters', 'Route stops, who appears where, eggs, map'],
  ['scenes', 'Walk scenes', 'Towns and routes on the Walk screen: ground, props and camera'],
  ['engine', 'Engine', 'Light, shadows, blur, color and camera of the 3D scenes'],
  ['wardrobe', 'Wardrobe', 'Trainer body, hairstyles, faces and clothes'],
  ['trainers', 'Trainers', 'Rivals and arena leaders'],
  ['lore', 'Lore & story', 'The world, the story, people, places, legends, clues, books and what people say'],
  ['people', 'People', 'Looks for trainers and shopkeepers'],
  ['jobs', 'Jobs', 'What working Billies earn'],
  ['rules', 'Rules', 'Every number that tunes the game'],
  ['art', 'Art files', 'Browse and replace any image'],
  ['check', 'Check & backups', 'Problems, backups and restore'],
];
/* alpha 0.4.1: the sections in five groups that fold away; the one you're in always shows. The descriptions show as
   a tooltip and under the section you're in, so the list is short enough to see at once */
const NAV_GROUPS = [
  ['Billies & battles', ['billionaires', 'roster', 'moves', 'preview', 'types']],
  ['World & places', ['scenes', 'engine', 'world']],
  ['People & story', ['trainers', 'people', 'wardrobe', 'lore']],
  ['Money', ['items', 'shops', 'jobs']],
  ['Game', ['rules', 'art', 'check']],
];
const navFold = (() => {
  try {
    return JSON.parse(localStorage.getItem('studio-fold') || '{}');
  } catch (e) {
    return {};
  }
})();
function renderSide() {
  const N = Object.fromEntries(NAV.map(n => [n[0], n])),
    used = new Set(NAV_GROUPS.flatMap(g => g[1])),
    G = NAV_GROUPS.concat([['More', NAV.map(n => n[0]).filter(k => !used.has(k))]]).filter(g => g[1].some(k => N[k]));
  $('#side').innerHTML =
    G.map(([t, L]) => {
      const has = L.includes(ST.sec),
        shut = navFold[t] && !has;
      return `<div class="nav-g ${shut ? 'shut' : ''}"><button class="nav-gh" data-act="navFold" data-g="${esc(t)}" aria-expanded="${!shut}"><span>${shut ? '▸' : '▾'}</span>${esc(t)}</button>${
        shut
          ? ''
          : L.filter(k => N[k])
              .map(k => {
                const [, n, d] = N[k];
                return `<button class="nav ${ST.sec === k ? 'on' : ''}" data-act="go" data-s="${k}" title="${esc(d)}"><b>${n}</b>${ST.sec === k ? `<small>${d}</small>` : ''}</button>`;
              })
              .join('')
      }</div>`;
    }).join('') +
    `<div class="side-foot"><small><kbd>Ctrl K</kbd> finds any setting · <kbd>Ctrl L</kbd> shows connections · <kbd>Ctrl S</kbd> saves.<br>Saves go to <code>game/data</code> and <code>game/art</code>, with backups in <code>backups/</code>.</small></div>`;
}
export function go(s, sel) {
  if (ST.sec === 'preview' && s !== 'preview' && typeof scStop === 'function') scStop();
  if (typeof ENG_CTX !== 'undefined') ENG_CTX.bypass = false;
  ST.sec = s;
  if (sel) Object.assign(ST.sel, sel);
  renderSide();
  render();
  $('#main').scrollTop = 0;
  try {
    history.replaceState(null, '', '#' + s);
  } catch (e) {}
}
export const SECTIONS = {};
export const ACTS = {};
ACTS.navFold = d => {
  navFold[d.g] = !navFold[d.g];
  try {
    localStorage.setItem('studio-fold', JSON.stringify(navFold));
  } catch (e) {}
  renderSide();
};
export function render() {
  const S = SECTIONS[ST.sec];
  if (!S) return;
  ST.after = [];
  const m = $('#main');
  m.innerHTML = S();
  ST.after.forEach(f => f());
  mountPreviews(m);
}
/* phase 04d: github.js takes the GitHub route, links.js redraws the links */
export function setRender(v) {
  render = v; // eslint-disable-line no-func-assign
  provide({ render });
}
export const after = f => {
  ST.after.push(f);
};
/* ---------- events ---------- */
document.addEventListener('input', ev => {
  if (ev.target.closest('#main,#modal,#dlg')) onField(ev);
});
document.addEventListener('change', ev => {
  if (ev.target.closest('#main,#modal,#dlg') && ev.target.dataset.p) {
    onField(ev);
    commit(true);
  }
});
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (a === 'go') return go(el.dataset.s);
  if (a === 'undo') return undo();
  if (a === 'redo') return redo();
  if (a === 'save') return saveAll();
  if (a === 'goCheck') return go('check');
  if (a === 'play') {
    window.open('../game/index.html?debug', 'networth-game');
    return;
  }
  const f = ACTS[a];
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
  if (ST.dirty || ST.rigsDirty || ST.artDirty.size) {
    e.preventDefault();
    e.returnValue = '';
  }
});
/* ---------- helpers for lists of things ---------- */
export const typeOpts = none => (none ? [['None', 'Normal']] : []).concat(ST.D.types.map(t => [t.id, t.id]));
export const spOpts = () => ST.D.lines.flatMap(L => L.names.map((n, i) => [L.id + i, `${n} (${L.id}${i})`]));
export const moveOpts = () =>
  Object.keys(ST.D.moves)
    .sort((a, b) => ST.D.moves[a].n.localeCompare(ST.D.moves[b].n))
    .map(k => [k, `${ST.D.moves[k].n} · ${ST.D.moves[k].t}`]);
export const itemOpts = () => Object.keys(ST.D.items).map(k => [k, ST.D.items[k].n]);
export const coinOpts = () => Object.keys(ST.D.coins).map(k => [k, ST.D.coins[k].n]);
export const peopleOpts = () => Object.keys(ST.D.people).map(k => [k, k]);
export const statusOpts = () => ST.D.statuses.map(s => [s.id, s.name]);
export const statOpts = () => ST.D.stats.filter(s => s.id !== 'hp').map(s => [s.id, s.name]);
export const spName = id => {
  const L = ST.D.lines.find(l => id && id.startsWith(l.id) && /^\d+$/.test(id.slice(l.id.length)));
  return L ? L.names[+id.slice(L.id.length)] || id : id;
};
export const chipT = t => {
  const T = ST.D.types.find(x => x.id === t);
  const c = T ? [T.color, T.text] : [ST.D.untyped.color, ST.D.untyped.text];
  return `<span class="chip" style="background:${c[0]};color:${c[1]}">${t === 'None' ? 'Normal' : esc(t)}</span>`;
};
/* ---------- boot ---------- */
export async function boot() {
  try {
    const [D, R, F] = await Promise.all([api('gamedata'), api('rigs'), api('files?dir='), artLoad([ICON_ATLAS])]);
    ST.D = D;
    ST.rigs = R;
    if (window.RIGS_NEXT) for (const k in window.RIGS_NEXT) if (!R[k]) R[k] = window.RIGS_NEXT[k];
    window.RIGS = R;
    ST.files = F;
    ST.last = snapshot();
    const h = location.hash.slice(1);
    if (NAV.some(n => n[0] === h)) ST.sec = h;
    renderSide();
    render();
    updTop();
    scheduleCheck(true);
  } catch (e) {
    $('#main').innerHTML =
      `<div class="loading err"><h2>The Studio couldn’t load the game data</h2><p>${esc(e.message)}</p><p>Start the Studio with <b>Start-Studio</b> (or <code>python3 start-studio.py</code>) and keep that window open.</p></div>`;
  }
}
addEventListener('load', boot);
