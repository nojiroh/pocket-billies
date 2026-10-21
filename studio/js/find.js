'use strict';
/* ================= POCKET BILLIES STUDIO · find =================
   alpha 0.4.1: one search box for the whole Studio (Ctrl+K, or the Find button). It knows every engine dial, every
   numbered setting on the Rules, Types, Items and Jobs pages, every section, and the things you edit: Billies, moves,
   items, coins, trainers, shops, people, places, route stops and props. Pick a result and the Studio opens it, scrolls
   to the setting and makes it blink. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { noteConnectionsField } from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { ENGINE_SPEC } from '../../game/js/engine/settings.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, SECTIONS, SECTION_LIST, clone, openSection, studioState, toast } from './studio-app.js';
import { engineEditor, refreshEngineSettings } from './engine-editor.js';
/* eslint-disable no-func-assign */
expose({
  FIND_KIND_LABELS: [() => FIND_KIND_LABELS],
  buildSearchIndex: [() => buildSearchIndex, v => (buildSearchIndex = v)],
  fieldSelector: [() => fieldSelector],
  findClose: [() => findClose, v => (findClose = v)],
  findEngine: [() => findEngine, v => (findEngine = v)],
  findField: [() => findField, v => (findField = v)],
  findFlash: [() => findFlash, v => (findFlash = v)],
  findMark: [() => findMark, v => (findMark = v)],
  findOpen: [() => findOpen, v => (findOpen = v)],
  findPageFields: [() => findPageFields, v => (findPageFields = v)],
  findPick: [() => findPick, v => (findPick = v)],
  findRun: [() => findRun, v => (findRun = v)],
  findShow: [() => findShow, v => (findShow = v)],
  findState: [() => findState],
  normalizeForFind: [() => normalizeForFind],
  searchIndex: [() => searchIndex, v => (searchIndex = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const findState = { idx: null, key: '', res: [], at: 0, q: '' };
const normalizeForFind = s =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
/* ---- going to things ---- */
export function findFlash(sel, tries = 0) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) {
    if (tries < 25) setTimeout(() => findFlash(sel, tries + 1), 80);
    return;
  }
  const d = el.closest('details');
  if (d && !d.open) d.open = true;
  const box = el.closest('.fld,.eng-f,.item-row,label,.lrow') || el;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  box.classList.remove('find-hit');
  void box.offsetWidth;
  box.classList.add('find-hit');
  setTimeout(() => box.classList.remove('find-hit'), 2400);
  const f = el.matches('input,select,textarea') ? el : el.querySelector('input,select,textarea');
  if (f)
    setTimeout(() => {
      try {
        f.focus({ preventScroll: true });
      } catch (e) {}
    }, 350);
  if (typeof noteConnectionsField === 'function') noteConnectionsField(el.dataset.p || el.dataset.path || '');
}
export const fieldSelector = p => `[data-p="${CSS.escape(p)}"],[data-path="${CSS.escape(p)}"]`;
export function findField(sec, p, sel) {
  if (studioState.sec !== sec || sel) openSection(sec, sel);
  findFlash(fieldSelector(p));
}
export function findEngine(g, k) {
  engineEditor.scope = 'game';
  engineEditor.open[g] = 1;
  if (studioState.sec === 'engine') refreshEngineSettings();
  else openSection('engine');
  findFlash(fieldSelector(`engine.defaults.${g}.${k}`));
}
/* ---- the index ---- */
function findPageFields(sec, add) {
  const S = SECTIONS[sec];
  if (!S) return;
  const keep = studioState.after,
    keepSel = clone(studioState.sel);
  let html = '';
  try {
    studioState.after = [];
    html = S();
  } catch (e) {
    html = '';
  } finally {
    studioState.after = keep;
    studioState.sel = keepSel;
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  const nav = (SECTION_LIST.find(n => n[0] === sec) || [])[1] || sec,
    seen = new Set();
  div.querySelectorAll('[data-p]').forEach(el => {
    const p = el.dataset.p;
    if (!p || seen.has(p)) return;
    seen.add(p);
    const lab = el.closest('label,.fld');
    if (!lab) return;
    const t = lab.querySelector('span');
    let label = (t ? t.textContent : lab.textContent).replace(/\s+/g, ' ').trim();
    if (!label || label.length > 70) return;
    const card = el.closest('section.card'),
      ct = card && card.querySelector('header h3'),
      help = lab.querySelector('.help');
    add(
      label,
      nav + (ct ? ' › ' + ct.textContent.trim() : ''),
      'setting',
      () => findField(sec, p),
      (help ? help.textContent : '') + ' ' + p
    );
  });
}
export function buildSearchIndex() {
  const D = studioState.D,
    E = [],
    add = (label, where, kind, fn, extra = '') => {
      if (label)
        E.push({
          label: String(label),
          where,
          kind,
          fn,
          t: normalizeForFind(label),
          x: normalizeForFind(where + ' ' + extra),
        });
    };
  SECTION_LIST.forEach(([k, n, d]) => add(n, 'Section', 'section', () => openSection(k), d));
  if (typeof ENGINE_SPEC !== 'undefined')
    ENGINE_SPEC.forEach(([g, t, F]) =>
      F.forEach(f => {
        const typ = typeof f[2] === 'string' ? f[2] : 'range',
          help = typ === 'range' ? f[5] : typ === 'sel' ? '' : f[3];
        add(f[1], 'Engine › ' + t, 'setting', () => findEngine(g, f[0]), (help || '') + ` ${g}.${f[0]}`);
      })
    );
  ['rules', 'types', 'items', 'jobs'].forEach(s => findPageFields(s, add));
  (D.lines || []).forEach(L =>
    L.names.forEach((n, st) =>
      add(
        n,
        `Billy · ${L.id}${st}${((L.types && L.types[st]) || []).length ? ' · ' + L.types[st].join('/') : ''}`,
        'billy',
        () => openSection('billionaires', { line: L.id, stage: st }),
        L.id
      )
    )
  );
  Object.entries(D.moves || {}).forEach(([k, M]) =>
    add(M.n, `Move · ${M.t || ''}`, 'move', () => openSection('moves', { move: k }), k)
  );
  Object.entries(D.items || {}).forEach(([k, I]) =>
    add(I.n, 'Item', 'item', () => findField('items', `items.${k}.n`), k + ' ' + (I.d || ''))
  );
  Object.entries(D.coins || {}).forEach(([k, I]) =>
    add(I.n, 'Tax coin', 'item', () => findField('items', `coins.${k}.n`), k)
  );
  Object.entries(D.trainers || {}).forEach(([k, T]) =>
    add(
      T.name || k,
      'Trainer' + (T.battleStage ? ' · ' + T.battleStage : ''),
      'trainer',
      () => openSection('trainers', { trainer: k }),
      k
    )
  );
  Object.entries(D.shops || {}).forEach(([k, S]) =>
    add(S.name || k, 'Shop' + (S.keeper ? ' · ' + S.keeper : ''), 'shop', () => openSection('shops', { shop: k }), k)
  );
  Object.keys(D.people || {}).forEach(k =>
    add(k, 'Look (People)', 'person', () => openSection('people', { person: k }))
  );
  Object.entries(D.maps || {}).forEach(([k, s]) =>
    add(
      s.name || k,
      `Walk scene · ${s.kind || (s.room ? 'room' : 'place')}`,
      'scene',
      () => openSection('scenes', { scene: k }),
      k
    )
  );
  (D.locations || []).forEach((r, i) =>
    add(
      r.name,
      `Route stop ${i + 1}${r.town ? ' · town' : ''}`,
      'stop',
      () => openSection('world', { wtab: 'route', stop: i }),
      r.id || ''
    )
  );
  Object.entries((D.scenery || {}).props || {}).forEach(([k, P]) =>
    add(
      P.name || k,
      'Prop' + ((P.tags || []).length ? ' · ' + P.tags.slice(0, 3).join(', ') : ''),
      'prop',
      () => {
        openSection('scenes');
        if (ACTIONS.scEditProp) ACTIONS.scEditProp({ k });
      },
      k
    )
  );
  return E;
}
function searchIndex() {
  const key = studioState.undo.length + '|' + (studioState.last || '').length;
  if (!findState.idx || findState.key !== key) {
    findState.idx = buildSearchIndex();
    findState.key = key;
  }
  return findState.idx;
}
const FIND_KIND_LABELS = {
  section: 'Section',
  setting: 'Setting',
  billy: 'Billy',
  move: 'Move',
  item: 'Item',
  trainer: 'Trainer',
  shop: 'Shop',
  person: 'Look',
  scene: 'Place',
  stop: 'Stop',
  prop: 'Prop',
};
export function findRun(q) {
  const n = normalizeForFind(q).trim(),
    W = n.split(/\s+/).filter(Boolean);
  if (!W.length) return [];
  const out = [];
  for (const e of searchIndex()) {
    let s = 0,
      ok = true;
    for (const w of W) {
      const a = e.t.indexOf(w);
      if (a >= 0) {
        s += a === 0 ? 6 : e.t[a - 1] === ' ' ? 4 : 2;
      } else if (e.x.includes(w)) s += 0.6;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (e.t === n) s += 10;
    if (e.kind === 'setting' || e.kind === 'section') s += 0.5;
    out.push([s, e]);
  }
  return out
    .sort((a, b) => b[0] - a[0] || a[1].label.length - b[1].label.length)
    .slice(0, 40)
    .map(x => x[1]);
}
/* ---- the box ---- */
function findOpen() {
  if ($('#find')) return;
  const w = document.createElement('div');
  w.id = 'find';
  w.innerHTML = `<div class="find-scrim"></div><div class="find-box" role="dialog" aria-label="Find"><input id="findQ" type="search" placeholder="Find a setting, a Billy, a move, a place… (try “shadow”, “god rays”, “step”)" autocomplete="off" value="${escapeHtml(findState.q)}"><div class="find-list" id="findL"></div><div class="find-foot"><kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close</div></div>`;
  document.body.appendChild(w);
  const q = $('#findQ');
  q.focus();
  q.select();
  findShow();
  q.addEventListener('input', () => {
    findState.q = q.value;
    findState.at = 0;
    findShow();
  });
  q.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      findState.at = Math.min(findState.res.length - 1, findState.at + 1);
      findMark();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      findState.at = Math.max(0, findState.at - 1);
      findMark();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      findPick(findState.at);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      findClose();
    }
  });
  w.querySelector('.find-scrim').onclick = findClose;
  $('#findL').addEventListener('click', ev => {
    const r = ev.target.closest('[data-i]');
    if (r) findPick(+r.dataset.i);
  });
}
function findClose() {
  const w = $('#find');
  if (w) w.remove();
}
function findShow() {
  const L = $('#findL');
  if (!L) return;
  findState.res = findRun(findState.q);
  L.innerHTML = findState.q.trim()
    ? findState.res.length
      ? findState.res
          .map(
            (e, i) =>
              `<button class="find-r ${i === findState.at ? 'on' : ''}" data-i="${i}"><span class="find-k k-${e.kind}">${FIND_KIND_LABELS[e.kind] || e.kind}</span><b>${escapeHtml(e.label)}</b><small>${escapeHtml(e.where)}</small></button>`
          )
          .join('')
      : '<p class="help find-none">Nothing found. Try another word.</p>'
    : `<p class="help find-none">Type part of a name. Settings are found by their label and by what their help text says, so “night”, “shadow” or “coin” all work.</p>`;
}
function findMark() {
  $$('#findL .find-r').forEach((b, i) => {
    b.classList.toggle('on', i === findState.at);
    if (i === findState.at) b.scrollIntoView({ block: 'nearest' });
  });
}
function findPick(i) {
  const e = findState.res[i];
  if (!e) return;
  findClose();
  try {
    e.fn();
  } catch (err) {
    toast('Couldn’t open that: ' + err.message, 'err');
  }
}
ACTIONS.find = () => findOpen();
document.addEventListener('keydown', ev => {
  const mod = ev.ctrlKey || ev.metaKey;
  if (mod && ev.key.toLowerCase() === 'k') {
    ev.preventDefault();
    $('#find') ? findClose() : findOpen();
    return;
  }
  if (
    ev.key === '/' &&
    !mod &&
    !ev.target.closest('input,textarea,select,[contenteditable]') &&
    !$('#dlg').innerHTML &&
    !$('#modal').innerHTML &&
    !$('#find')
  ) {
    ev.preventDefault();
    findOpen();
  }
});
addEventListener('load', () => {
  const a = $('.top-acts');
  if (a && !$('#findBtn'))
    a.insertAdjacentHTML(
      'afterbegin',
      `<button class="tb find-btn" id="findBtn" data-act="find" title="Find any setting or thing (Ctrl+K or /)">⌕ Find <kbd>Ctrl K</kbd></button>`
    );
});
