'use strict';
/* ================= LORE =================
   v47: the world and the story, written once in the game data (lore: tools/build-lore-v47.py and the Studio's Lore
   section) and drawn on everywhere: what unlocks as you go, what people say at each stage of the story, books in rooms,
   the clues to who you were, the Lore page of the Guide and the loading screen's lines.
   An entry's `unlock`: 'start', 'place:<id>' (been there), 'meet:<who>' (met them), 'flag:<name>' (a story flag),
   'badges:<n>'. The stage of the story is the number of badges (9 after the ending). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, provide, storyFlags } from './hooks.js';
import { clamp } from './util.js';
import { GD, ROUTE, TRAINERS } from './data.js';
import { S, U, esc, save } from './core.js';
import { humanHTML } from './trainer.js';
import { DIO, dioBaseId, dioFind, dioFreePt, dioHubOf, dioScene } from './walk-view.js';
import { DGL, dioH } from './walk-view-gl.js';
import { JINGLES, jingle, sfx } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  CLUE_SPOTS: [() => CLUE_SPOTS],
  LORE: [() => LORE],
  clueDraw: [() => clueDraw, v => ((clueDraw = v), provide({ clueDraw }))],
  clueSpotFind: [() => clueSpotFind, v => (clueSpotFind = v)],
  clueSpots: [() => clueSpots, v => (clueSpots = v)],
  dioChatLines: [() => dioChatLines, v => ((dioChatLines = v), provide({ dioChatLines }))],
  loreBook: [() => loreBook, v => (loreBook = v)],
  loreCard: [() => loreCard, v => (loreCard = v)],
  loreChat: [() => loreChat, v => (loreChat = v)],
  loreClue: [() => loreClue, v => (loreClue = v)],
  loreFlags: [() => loreFlags, v => ((loreFlags = v), provide({ loreFlags }))],
  loreLoadingLines: [() => loreLoadingLines, v => (loreLoadingLines = v)],
  loreMet: [() => loreMet, v => (loreMet = v)],
  loreNode: [() => loreNode, v => (loreNode = v)],
  loreOpen: [() => loreOpen, v => (loreOpen = v)],
  loreStage: [() => loreStage, v => (loreStage = v)],
  renderLore: [() => renderLore, v => (renderLore = v)],
});
/* eslint-enable no-func-assign */
provide({ clueDraw, dioChatLines, loreFlags });
/* to-module: end */
export const LORE = () => (typeof GD !== 'undefined' && GD.lore) || {};
export function loreFlags() {
  return typeof storyFlags === 'function' ? storyFlags() : S.story || (S.story = {});
}
function loreStage() {
  return loreFlags().ending ? 9 : (S.seats || []).length;
}
function loreNode(id) {
  return ROUTE.findIndex(r => r.id === id || r.scene === id);
}
function loreMet(k) {
  const F = loreFlags();
  if (F['met_' + k] || S.flags[k]) return true;
  for (const [id, T] of Object.entries(typeof TRAINERS !== 'undefined' ? TRAINERS : {}))
    if (T.who === k && (S.flags[id] || F['met_' + id])) return true;
  return false;
}
function loreOpen(u) {
  if (!u || u === 'start') return true;
  const i = u.indexOf(':'),
    k = u.slice(0, i),
    v = u.slice(i + 1);
  if (k === 'place') {
    const n = loreNode(v);
    return n >= 0 && !!S.visited[n];
  }
  if (k === 'meet') return loreMet(v);
  if (k === 'flag') return !!loreFlags()[v];
  if (k === 'badges') return (S.seats || []).length >= +v;
  return false;
}
/* what people say here now: the lines for the latest stage reached (lore.chat), then the place's own */
function loreChat(place) {
  const C = (LORE().chat || {})[place];
  if (!C) return [];
  const st = loreStage(),
    k = Object.keys(C)
      .filter(k => +k <= st)
      .sort((a, b) => b - a)[0];
  return k != null ? C[k] : [];
}
function dioChatLines(fallback) {
  const sc = (typeof DIO !== 'undefined' && DIO.sc) || {},
    own = sc.chat && sc.chat.length ? sc.chat : fallback,
    L = loreChat(sc.placeId || sc.place);
  return L.length ? L.concat(own) : own;
}
/* a book or paper in a room: its pages one at a time; the Guide keeps the ones you've read */
export function loreBook(id, page = 0) {
  const B = (LORE().books || {})[id];
  if (!B) return;
  const F = loreFlags();
  if (!F['read_' + id]) {
    F['read_' + id] = 1;
    save();
  }
  const n = B.pages.length,
    p = clamp(page, 0, n - 1);
  U.modal = null;
  modal({
    title: esc(B.title),
    cls: 'book-sheet',
    top: `<div class="book-by">${esc(B.by || '')}</div>`,
    html: `<div class="book-page paper px"><p>${esc(B.pages[p])}</p></div><p class="book-n tnum">${p + 1} / ${n}</p>`,
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
  const C = (LORE().clues || []).find(c => c.id === id);
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
    top: `<div class="clue-k">${esc(C.title)}</div>`,
    html: `<p>${esc(C.text)}</p><p class="note">It’s in the Guide, under Lore.</p>`,
    btns: [{ l: 'Keep it', c: 'dark', f: closeModal }],
  });
}
/* where a clue lies (lore.clues[].at: a scene, and the kind of thing it lies beside): worked out once per place, on
   open ground you can walk to, beside the matching prop nearest a short walk from where you arrive */
const CLUE_SPOTS = {};
function clueSpots() {
  if ((typeof U !== 'undefined' && U.inside) || typeof DIO === 'undefined' || !DIO.sc) return [];
  const id = dioBaseId(),
    sc0 = DIO.sc,
    sc = sc0.baseId ? dioScene(sc0.baseId) : sc0,
    o = sc0.baseOff || [0, 0],
    F = loreFlags();
  if (!sc || !id) return [];
  const out = [];
  for (const C of LORE().clues || []) {
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
  const hub = dioHubOf(sc),
    o = (DIO.sc && DIO.sc.baseOff) || [0, 0];
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
      q = dioFreePt(o[0] + pr.x + ux * 1.1, o[1] + pr.z + uz * 1.1);
    if (!q) continue;
    const r = dioFind(o[0] + hub[0], o[1] + hub[1], q[0], q[1]),
      e = r && r[r.length - 1];
    if (!e || Math.hypot(e[0] - q[0], e[1] - q[1]) > 0.6) continue;
    return [q[0] - o[0], q[1] - o[1]];
  }
  return null;
}
/* drawn by the walk scene's effects pass, like the gold stamps but cool white: walk over it to pick it up */
function clueDraw(quad, glows, t) {
  if (typeof S === 'undefined' || !S.started || DGL.bt || U.bench || U.modal) return;
  const P = DIO.pl;
  for (const c of clueSpots()) {
    const y = dioH(c.x, c.z),
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
      if (typeof sfx === 'function') sfx('coin');
      loreClue(c.id);
      return;
    }
  }
}
/* the Lore page of the Guide */
function loreCard(title, text, open, sub) {
  return open
    ? `<article class="lore-card"><h3>${esc(title)}</h3>${sub ? `<small>${esc(sub)}</small>` : ''}<p>${esc(text)}</p></article>`
    : `<article class="lore-card locked"><h3>???</h3><p>Keep walking.</p></article>`;
}
export function renderLore() {
  const L = LORE(),
    st = loreStage(),
    F = loreFlags(),
    sec = U.loreSec || 'story';
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
          ? `<article class="lore-card person">${p.who ? `<span class="lore-face">${typeof humanHTML === 'function' ? humanHTML(p.who, 52) : ''}</span>` : ''}<div><h3>${esc(p.name)}</h3><small>${esc(p.role || '')}</small><p>${esc(p.text)}</p>${p.voice ? `<p class="hand">${esc(p.voice)}</p>` : ''}</div></article>`
          : loreCard('', '', false);
      })
      .join('');
  if (sec === 'places')
    body = ROUTE.map((r, i) => {
      const P = (L.places || {})[r.id];
      if (!P) return '';
      const o = !!S.visited[i];
      return o
        ? `<article class="lore-card"><h3>${esc(r.name)}</h3><p>${esc(P.history)}</p><p><b>Known for</b> ${esc(P.known)}</p><p><b>Landmark</b> ${esc(P.landmark)}</p><p class="hand">${esc(P.legend)}</p></article>`
        : loreCard('', '', false);
    }).join('');
  if (sec === 'legends') body = (L.legends || []).map(g => loreCard(g.title, g.text, loreOpen(g.unlock))).join('');
  if (sec === 'clues') body = (L.clues || []).map(c => loreCard(c.title, c.text, loreOpen(c.unlock))).join('');
  if (sec === 'books') {
    const B = Object.entries(L.books || {}).filter(([k]) => F['read_' + k]);
    body = B.length
      ? B.map(
          ([k, b]) =>
            `<button class="lore-card book" data-a="lorebook" data-k="${k}"><h3>${esc(b.title)}</h3><small>${esc(b.by || '')}</small></button>`
        ).join('')
      : '<p class="hand lore-more">Books and papers you read in rooms collect here.</p>';
  }
  return `<div class="seg lore-tabs">${tabs.map(([k, n]) => `<button class="${k === sec ? 'on' : ''}" data-a="loresec" data-k="${k}">${n}</button>`).join('')}</div><section class="lore">${body}</section>`;
}
/* the loading screen's lines, shuffled once a session */
export function loreLoadingLines() {
  const L = (LORE().loading || []).slice();
  for (let i = L.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [L[i], L[j]] = [L[j], L[i]];
  }
  return L;
}
