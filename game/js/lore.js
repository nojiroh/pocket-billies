'use strict';
/* ================= LORE =================
   v47: the world and the story, written once in the game data (lore: tools/build-lore-v47.py and the Studio's Lore
   section) and drawn on everywhere: what unlocks as you go, what people say at each stage of the story, books in rooms,
   the clues to who you were, the Lore page of the Guide and the loading screen's lines.
   An entry's `unlock`: 'start', 'location:<id>' (been there), 'meet:<who>' (met them), 'flag:<name>' (a story flag),
   'badges:<n>'. The stage of the story is the number of badges (9 after the ending). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, provide, storyFlags } from './hooks.js';
import { clamp } from './util.js';
import { LOCATIONS, TRAINERS, gameData } from './game-data.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { personHTML } from './person-art.js';
import { baseMapId, findPath, mapById, mapHub, walkView, walkablePointNear } from './walk-view.js';
import { standingHeightAt, walkRenderer } from './walk-view-gl.js';
import { JINGLES, jingle, soundEffect } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  CLUE_SPOTS: [() => CLUE_SPOTS],
  clueDraw: [() => clueDraw, v => ((clueDraw = v), provide({ clueDraw }))],
  clueSpotFind: [() => clueSpotFind, v => (clueSpotFind = v)],
  clueSpots: [() => clueSpots, v => (clueSpots = v)],
  loreBook: [() => loreBook, v => (loreBook = v)],
  loreCard: [() => loreCard, v => (loreCard = v)],
  loreChat: [() => loreChat, v => (loreChat = v)],
  loreClue: [() => loreClue, v => (loreClue = v)],
  loreData: [() => loreData],
  loreFlags: [() => loreFlags, v => ((loreFlags = v), provide({ loreFlags }))],
  loreLoadingLines: [() => loreLoadingLines, v => (loreLoadingLines = v)],
  loreMet: [() => loreMet, v => (loreMet = v)],
  loreNode: [() => loreNode, v => (loreNode = v)],
  loreOpen: [() => loreOpen, v => (loreOpen = v)],
  loreStage: [() => loreStage, v => (loreStage = v)],
  mapChatLines: [() => mapChatLines, v => ((mapChatLines = v), provide({ mapChatLines }))],
  renderLore: [() => renderLore, v => (renderLore = v)],
});
/* eslint-enable no-func-assign */
provide({ clueDraw, loreFlags, mapChatLines });
/* to-module: end */
export const loreData = () => (typeof gameData !== 'undefined' && gameData.lore) || {};
export function loreFlags() {
  return typeof storyFlags === 'function' ? storyFlags() : saveData.story || (saveData.story = {});
}
function loreStage() {
  return loreFlags().ending ? 9 : (saveData.seats || []).length;
}
function loreNode(id) {
  return LOCATIONS.findIndex(r => r.id === id || r.scene === id);
}
function loreMet(k) {
  const F = loreFlags();
  if (F['met_' + k] || saveData.flags[k]) return true;
  for (const [id, T] of Object.entries(typeof TRAINERS !== 'undefined' ? TRAINERS : {}))
    if (T.who === k && (saveData.flags[id] || F['met_' + id])) return true;
  return false;
}
function loreOpen(u) {
  if (!u || u === 'start') return true;
  const i = u.indexOf(':'),
    k = u.slice(0, i),
    v = u.slice(i + 1);
  if (k === 'location') {
    const n = loreNode(v);
    return n >= 0 && !!saveData.visited[n];
  }
  if (k === 'meet') return loreMet(v);
  if (k === 'flag') return !!loreFlags()[v];
  if (k === 'badges') return (saveData.seats || []).length >= +v;
  return false;
}
/* what people say here now: the lines for the latest stage reached (lore.chat), then the place's own */
function loreChat(place) {
  const C = (loreData().chat || {})[place];
  if (!C) return [];
  const st = loreStage(),
    k = Object.keys(C)
      .filter(k => +k <= st)
      .sort((a, b) => b - a)[0];
  return k != null ? C[k] : [];
}
function mapChatLines(fallback) {
  const sc = (typeof walkView !== 'undefined' && walkView.sc) || {},
    own = sc.chat && sc.chat.length ? sc.chat : fallback,
    L = loreChat(sc.placeId || sc.locationId);
  return L.length ? L.concat(own) : own;
}
/* a book or paper in a room: its pages one at a time; the Guide keeps the ones you've read */
export function loreBook(id, page = 0) {
  const B = (loreData().books || {})[id];
  if (!B) return;
  const F = loreFlags();
  if (!F['read_' + id]) {
    F['read_' + id] = 1;
    save();
  }
  const n = B.pages.length,
    p = clamp(page, 0, n - 1);
  uiState.modal = null;
  modal({
    title: escapeHtml(B.title),
    cls: 'book-sheet',
    top: `<div class="book-by">${escapeHtml(B.by || '')}</div>`,
    html: `<div class="book-page paper px"><p>${escapeHtml(B.pages[p])}</p></div><p class="book-n tnum">${p + 1} / ${n}</p>`,
    btns: [
      ...(p > 0 ? [{ l: '‹ Back', c: 'quiet', f: () => loreBook(id, p - 1) }] : []),
      ...(p < n - 1
        ? [{ l: 'Next ›', c: 'dark', f: () => loreBook(id, p + 1) }]
        : [{ l: 'Close', c: 'dark', f: closeModal }]),
    ],
  });
}
/* something of yours, found along the way */
export function loreClue(id) {
  const C = (loreData().clues || []).find(c => c.id === id);
  if (!C) return;
  const F = loreFlags(),
    flag = C.unlock && C.unlock.startsWith('flag:') ? C.unlock.slice(5) : 'clue_' + id;
  if (F[flag]) return;
  F[flag] = 1;
  save();
  if (typeof jingle === 'function' && typeof JINGLES !== 'undefined' && JINGLES.item) jingle(JINGLES.item, 120);
  modal({
    title: 'Something of yours',
    cls: 'clue-sheet',
    top: `<div class="clue-k">${escapeHtml(C.title)}</div>`,
    html: `<p>${escapeHtml(C.text)}</p><p class="note">It’s in the Guide, under Lore.</p>`,
    btns: [{ l: 'Keep it', c: 'dark', f: closeModal }],
  });
}
/* where a clue lies (lore.clues[].at: a scene, and the kind of thing it lies beside): worked out once per place, on
   open ground you can walk to, beside the matching prop nearest a short walk from where you arrive */
const CLUE_SPOTS = {};
function clueSpots() {
  if ((typeof uiState !== 'undefined' && uiState.inside) || typeof walkView === 'undefined' || !walkView.sc) return [];
  const id = baseMapId(),
    sc0 = walkView.sc,
    sc = sc0.baseId ? mapById(sc0.baseId) : sc0,
    o = sc0.baseOff || [0, 0],
    F = loreFlags();
  if (!sc || !id) return [];
  const out = [];
  for (const C of loreData().clues || []) {
    const at = C.at;
    if (!at || at.scene !== id) continue;
    const flag = C.unlock && C.unlock.startsWith('flag:') ? C.unlock.slice(5) : 'clue_' + C.id;
    if (F[flag]) continue;
    let p = CLUE_SPOTS[C.id];
    if (p === undefined) {
      p = CLUE_SPOTS[C.id] = clueSpotFind(sc, at);
    }
    if (p) out.push({ id: C.id, x: p[0] + o[0], z: p[1] + o[1] });
  }
  return out;
}
function clueSpotFind(sc, at) {
  if (at.x != null && at.z != null) return [at.x, at.z];
  let re = null;
  try {
    re = new RegExp(at.near || '^$');
  } catch (e) {
    return null;
  }
  const hub = mapHub(sc),
    o = (walkView.sc && walkView.sc.baseOff) || [0, 0];
  const C = (sc.props || [])
    .filter(p => re.test(p.k))
    .sort(
      (a, b) =>
        Math.abs(Math.hypot(a.x - hub[0], a.z - hub[1]) - 11) - Math.abs(Math.hypot(b.x - hub[0], b.z - hub[1]) - 11)
    );
  for (const pr of C.slice(0, 12)) {
    const d = Math.hypot(hub[0] - pr.x, hub[1] - pr.z) || 1,
      ux = (hub[0] - pr.x) / d,
      uz = (hub[1] - pr.z) / d,
      q = walkablePointNear(o[0] + pr.x + ux * 1.1, o[1] + pr.z + uz * 1.1);
    if (!q) continue;
    const r = findPath(o[0] + hub[0], o[1] + hub[1], q[0], q[1]),
      e = r && r[r.length - 1];
    if (!e || Math.hypot(e[0] - q[0], e[1] - q[1]) > 0.6) continue;
    return [q[0] - o[0], q[1] - o[1]];
  }
  return null;
}
/* drawn by the walk scene's effects pass, like the gold stamps but cool white: walk over it to pick it up */
function clueDraw(quad, glows, t) {
  if (typeof saveData === 'undefined' || !saveData.started || walkRenderer.bt || uiState.bench || uiState.modal) return;
  const P = walkView.pl;
  for (const c of clueSpots()) {
    const y = standingHeightAt(c.x, c.z),
      b = 0.1 + Math.sin(t / 260) * 0.05,
      pulse = 0.5 + 0.5 * Math.sin(t / 420);
    quad('sparkle', Math.floor(t / 110) % 4, c.x, y + 0.34 + b, c.z, 0.72, 0.72, 1, [0.86, 0.96, 1]);
    quad(
      'sparkle',
      (Math.floor(t / 110) + 2) % 4,
      c.x + 0.12,
      y + 0.62 + b * 1.5,
      c.z,
      0.34,
      0.34,
      0.8 * pulse,
      [1, 1, 1]
    );
    glows.push([c.x, y + 0.3 + b, c.z, 0.48, [0.6, 0.85, 1], 1.6 + pulse * 1.4]);
    if (P && Math.hypot(P.x - c.x, P.z - c.z) < 0.75) {
      if (typeof soundEffect === 'function') soundEffect('coin');
      loreClue(c.id);
      return;
    }
  }
}
/* the Lore page of the Guide */
function loreCard(title, text, open, sub) {
  return open
    ? `<article class="lore-card"><h3>${escapeHtml(title)}</h3>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}<p>${escapeHtml(text)}</p></article>`
    : `<article class="lore-card locked"><h3>???</h3><p>Keep walking.</p></article>`;
}
export function renderLore() {
  const L = loreData(),
    st = loreStage(),
    F = loreFlags(),
    sec = uiState.loreSec || 'story';
  const tabs = [
    ['story', 'Story'],
    ['world', 'World'],
    ['people', 'People'],
    ['places', 'Places'],
    ['legends', 'Legends'],
    ['clues', 'You'],
    ['books', 'Books'],
  ];
  let body = '';
  if (sec === 'world') body = (L.world || []).map(w => loreCard(w.title, w.text, loreOpen(w.unlock))).join('');
  if (sec === 'story')
    body =
      (L.story || [])
        .filter(c => c.stage <= st)
        .map(c => loreCard(c.title, c.text, true))
        .join('') +
      ((L.story || []).some(c => c.stage > st)
        ? '<p class="hand lore-more">The rest of the road is still ahead of you.</p>'
        : '');
  if (sec === 'people')
    body = Object.entries(L.people || {})
      .map(([k, p]) => {
        const o = loreOpen(p.unlock);
        return o
          ? `<article class="lore-card person">${p.who ? `<span class="lore-face">${typeof personHTML === 'function' ? personHTML(p.who, 52) : ''}</span>` : ''}<div><h3>${escapeHtml(p.name)}</h3><small>${escapeHtml(p.role || '')}</small><p>${escapeHtml(p.text)}</p>${p.voice ? `<p class="hand">${escapeHtml(p.voice)}</p>` : ''}</div></article>`
          : loreCard('', '', false);
      })
      .join('');
  if (sec === 'places')
    body = LOCATIONS.map((r, i) => {
      const P = (L.locations || {})[r.id];
      if (!P) return '';
      const o = !!saveData.visited[i];
      return o
        ? `<article class="lore-card"><h3>${escapeHtml(r.name)}</h3><p>${escapeHtml(P.history)}</p><p><b>Known for</b> ${escapeHtml(P.known)}</p><p><b>Landmark</b> ${escapeHtml(P.landmark)}</p><p class="hand">${escapeHtml(P.legend)}</p></article>`
        : loreCard('', '', false);
    }).join('');
  if (sec === 'legends') body = (L.legends || []).map(g => loreCard(g.title, g.text, loreOpen(g.unlock))).join('');
  if (sec === 'clues') body = (L.clues || []).map(c => loreCard(c.title, c.text, loreOpen(c.unlock))).join('');
  if (sec === 'books') {
    const B = Object.entries(L.books || {}).filter(([k]) => F['read_' + k]);
    body = B.length
      ? B.map(
          ([k, b]) =>
            `<button class="lore-card book" data-a="lorebook" data-k="${k}"><h3>${escapeHtml(b.title)}</h3><small>${escapeHtml(b.by || '')}</small></button>`
        ).join('')
      : '<p class="hand lore-more">Books and papers you read in rooms collect here.</p>';
  }
  return `<div class="seg lore-tabs">${tabs.map(([k, n]) => `<button class="${k === sec ? 'on' : ''}" data-a="loresec" data-k="${k}">${n}</button>`).join('')}</div><section class="lore">${body}</section>`;
}
/* the loading screen's lines, shuffled once a session */
export function loreLoadingLines() {
  const L = (loreData().loading || []).slice();
  for (let i = L.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [L[i], L[j]] = [L[j], L[i]];
  }
  return L;
}
