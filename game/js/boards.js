'use strict';
/* ================= FRIENDS' BOARDS AND GHOSTS (the online track, ON-2) =================
   The Firestore side of logic/run-record.js (docs/phases/online-track.md, ON-2): each player's ghosts/<uid>
   { name, last, day, week, x, fast }, written by its owner alone and read by their friends (firebase/firestore.rules),
   never listed. One read per friend refreshes every board and every ghost, kept for BOARDS_KEEP_MS (Spark's daily
   quota). Friends only (the owner, 2026-10-26): nothing here needs Online play, and a blocked player never shows.
   - boardsPost: a finished run's record goes into my document (the first daily or weekly attempt, the best per
     Expedition, the fastest win, the last run as my ghost). Offline or refused, it waits in this browser (one list per
     account, at most BOARDS_WAIT) and goes out the next time friends start.
   - boardsGhost: at take-off, the friend whose last run waits on the run's ghost node (logic/run-record.js ghostPick).
   - boardsHTML: the boards on the Trainer screen, under Friends: Today, This week, each Expedition, Fastest; mine
     among my friends'. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { account, provide, render, selfTest } from './hooks.js';
import { SPECIES } from './game-data.js';
import { plural } from './logic/rules.js';
import { expeditionNumeral } from './logic/modifiers.js';
import { boardDay, boardWeek } from './logic/daily.js';
import { boardRows, ghostDocNext, ghostDocRead, ghostPick, validRunRecord } from './logic/run-record.js';
import { escapeHtml, saveData } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { friendShownName, friends, friendsDb, friendsOn, refreshFriends } from './friends.js';
/* eslint-disable no-func-assign */
expose({
  BOARDS_KEEP_MS: [() => BOARDS_KEEP_MS],
  BOARDS_WAIT: [() => BOARDS_WAIT],
  BOARD_TABS: [() => BOARD_TABS],
  boardLine: [() => boardLine],
  boardTabName: [() => boardTabName],
  boards: [() => boards],
  boardsFetch: [() => boardsFetch, v => ((boardsFetch = v), provide({ boardsFetch }))],
  boardsGet: [() => boardsGet, v => (boardsGet = v)],
  boardsGhost: [() => boardsGhost, v => ((boardsGhost = v), provide({ boardsGhost }))],
  boardsHTML: [() => boardsHTML, v => (boardsHTML = v)],
  boardsLive: [() => boardsLive],
  boardsPayoutHTML: [() => boardsPayoutHTML, v => ((boardsPayoutHTML = v), provide({ boardsPayoutHTML }))],
  boardsPost: [() => boardsPost, v => ((boardsPost = v), provide({ boardsPost }))],
  boardsRowsHTML: [() => boardsRowsHTML, v => (boardsRowsHTML = v)],
  boardsRowsNow: [() => boardsRowsNow, v => (boardsRowsNow = v)],
  boardsWaitKey: [() => boardsWaitKey],
  boardsWaitSet: [() => boardsWaitSet, v => (boardsWaitSet = v)],
  boardsWaiting: [() => boardsWaiting, v => (boardsWaiting = v)],
});
/* eslint-enable no-func-assign */
provide({ boardsFetch, boardsGhost, boardsPayoutHTML, boardsPost });
/* to-module: end */
const BOARDS_KEEP_MS = 10 * 60000,
  BOARDS_WAIT = 5,
  BOARD_TABS = ['day', 'week', 'x1', 'x2', 'x3', 'x4', 'x5', 'fast'];
const boards = {
  /** uid -> the ghosts/<uid> document read through ghostDocRead (mine under my uid) */
  docs: {},
  at: 0,
  busy: null,
  tab: 'day',
};

/** the key this browser keeps an account's records waiting under @param {string} uid */
const boardsWaitKey = uid => 'pb-boards-wait-' + uid;
function boardsWaiting(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(boardsWaitKey(uid)) || '[]');
    return Array.isArray(v) ? v.filter(r => validRunRecord(r)).slice(-BOARDS_WAIT) : [];
  } catch (e) {
    return [];
  }
}
function boardsWaitSet(uid, list) {
  try {
    if (list.length) localStorage.setItem(boardsWaitKey(uid), JSON.stringify(list.slice(-BOARDS_WAIT)));
    else localStorage.removeItem(boardsWaitKey(uid));
  } catch (e) {}
}

/** whether boards may reach the database now: signed in with friends started, and never during the self-test (it
 * must send nothing: CLAUDE.md) */
const boardsLive = () =>
  typeof friendsOn === 'function' &&
  friendsOn() &&
  friends.on &&
  !!friends.uid &&
  !(typeof selfTest !== 'undefined' && selfTest.on);
/** one ghosts/<uid> read: [uid, the document read through ghostDocRead], or null (none, refused, offline)
 * @param {string} u */
function boardsGet(u) {
  try {
    return friendsDb()
      .collection('ghosts')
      .doc(u)
      .get()
      .then(s => (s.exists ? [u, ghostDocRead(s.data())] : null))
      .catch(() => null);
  } catch (e) {
    return Promise.resolve(null);
  }
}
/** read my document and my friends' (not the blocked), at most every BOARDS_KEEP_MS unless `force`; a friend whose
 * document isn't open to me yet (they haven't added me back) is left out. Resolves when done, never throws */
function boardsFetch(force) {
  if (!boardsLive()) return Promise.resolve();
  if (boards.busy) return boards.busy;
  if (!force && Date.now() - boards.at < BOARDS_KEEP_MS) return Promise.resolve();
  const who = [friends.uid, ...friends.list.filter(u => !friends.blocked.includes(u))];
  boards.busy = Promise.all(who.map(boardsGet)).then(got => {
    boards.docs = Object.fromEntries(got.filter(x => !!x));
    boards.at = Date.now();
    boards.busy = null;
    if (typeof debugLog !== 'undefined')
      debugLog.add('online', `boards: ${got.filter(x => !!x).length} of ${who.length} read`);
    if (typeof refreshFriends === 'function') refreshFriends();
  });
  return boards.busy;
}

/** post a finished run's record (logic/run-record.js runRecord) to my ghosts/<uid>, after any still waiting; what
 * can't go now waits in this browser. Signed out: nothing is kept (there is no account to post it to) */
async function boardsPost(rec) {
  if (!boardsLive()) return;
  const uid = friends.uid,
    list = [...boardsWaiting(uid), ...(rec && validRunRecord(rec) ? [rec] : [])];
  if (!list.length) return;
  boardsWaitSet(uid, list);
  const name = (saveData.avatar && saveData.avatar.name) || (account.user && account.user.name) || 'Trainer';
  try {
    const ref = friendsDb().collection('ghosts').doc(uid),
      s = await ref.get();
    let doc = s.exists ? s.data() : null;
    for (const r of list) doc = ghostDocNext(doc, r, name, Date.now());
    await ref.set(doc);
    boardsWaitSet(uid, []);
    boards.docs[uid] = ghostDocRead(doc);
    if (typeof debugLog !== 'undefined') debugLog.add('online', `boards: ${list.length} run(s) posted`);
    if (typeof refreshFriends === 'function') refreshFriends();
  } catch (e) {
    if (typeof debugLog !== 'undefined') debugLog.add('online', `boards: post waits (${(e && e.code) || 'offline'})`);
  }
}

/** the friend whose last run waits on a new run's ghost node, from what was read (boardsFetch); null when none
 * @param {string} seed */
function boardsGhost(seed) {
  if (!friends.on || !friends.uid) return null;
  const docs = friends.list
    .filter(u => boards.docs[u] && !friends.blocked.includes(u))
    .map(u => ({ u, doc: { ...boards.docs[u], name: friendShownName(u, boards.docs[u].name, 'Friend') } }));
  return ghostPick(docs, seed, friends.blocked);
}

/** a board's name on its tab @param {string} b */
const boardTabName = b =>
  b === 'day'
    ? 'Today'
    : b === 'week'
      ? 'This week'
      : b === 'fast'
        ? 'Fastest'
        : `Expedition ${expeditionNumeral(Number(b.slice(1)))}`;

/** a board entry in words: "Won · 9 places · 2 leaders · 7 days" @param {any} e */
const boardLine = e =>
  `${e.won ? 'Won' : 'Lost'} · ${plural(e.cleared, 'place')} · ${plural(e.leaders, 'leader')} · ${plural(e.days, 'day')}`;

/** one board's rows: mine and my friends' (never a blocked player), best first @param {string} b @param {number} now */
function boardsRowsNow(b, now) {
  const docs = Object.entries(boards.docs)
      .filter(([u]) => u === friends.uid || (friends.list.includes(u) && !friends.blocked.includes(u)))
      .map(([u, doc]) => ({ u, doc })),
    n = b === 'day' ? boardDay(now) : b === 'week' ? boardWeek(now) : 0;
  return boardRows(docs, b, n);
}

/** the rows as list items (a board's own, or the payout screen's) @param {{ u: string, name: string, e: any }[]} rows */
function boardsRowsHTML(rows) {
  return rows
    .map((r, k) => {
      const me = r.u === friends.uid,
        name = me ? 'You' : friendShownName(r.u, r.name, 'Friend'),
        S = SPECIES[r.e.lead];
      return `<div class="fr-row bd-row${me ? ' bd-me' : ''}"><b class="bd-rank tnum">${k + 1}</b><span class="fr-t"><b>${escapeHtml(name)}</b><small>${escapeHtml(boardLine(r.e))}</small></span>${S ? `<span class="fr-mon">${rigCanvasHTML(r.e.lead, 40)}</span>` : ''}</div>`;
    })
    .join('');
}

/** the boards on the Trainer screen (signed in only): tabs, then the board; read when shown (cached) */
export function boardsHTML() {
  if (typeof friendsOn !== 'function' || !friendsOn() || !friends.on) return '';
  boardsFetch(false);
  const now = Date.now(),
    tab = BOARD_TABS.includes(boards.tab) ? boards.tab : 'day',
    rows = boardsRowsNow(tab, now),
    tabs = BOARD_TABS.map(
      b =>
        `<button class="fchip k-btn${b === tab ? ' on' : ''}" data-a="bd-tab" data-b="${b}" aria-pressed="${b === tab}">${escapeHtml(boardTabName(b))}</button>`
    ).join(''),
    empty =
      tab === 'day'
        ? 'Nobody has played today’s daily run yet. Start it at Skyline Station.'
        : tab === 'week'
          ? 'Nobody has played this week’s run yet. Start it at Skyline Station.'
          : 'No runs here yet.';
  return `<section class="tpanel pf-boards"><div class="sec-h"><h2>Friends’ boards</h2></div><div class="fchips">${tabs}</div>${rows.length ? boardsRowsHTML(rows) : `<p class="note">${boards.busy && !boards.at ? 'Looking…' : empty}</p>`}<p class="note">Ranked by won, then places cleared, leaders beaten and fewest days. Only your friends and you.</p></section>`;
}

/** the payout screen's board for a daily or weekly run (its day or week; '' for any other run or with no account)
 * @param {{ k: 'd' | 'w', n: number } | undefined} board */
function boardsPayoutHTML(board) {
  if (!board || typeof friendsOn !== 'function' || !friendsOn() || !friends.on) return '';
  const docs = Object.entries(boards.docs)
      .filter(([u]) => u === friends.uid || (friends.list.includes(u) && !friends.blocked.includes(u)))
      .map(([u, doc]) => ({ u, doc })),
    rows = boardRows(docs, board.k === 'd' ? 'day' : 'week', board.n);
  return `<h3>${board.k === 'd' ? 'Today’s daily' : 'This week’s run'}: your friends</h3>${rows.length ? boardsRowsHTML(rows) : '<p class="note">None of your friends has played it yet.</p>'}`;
}

document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a="bd-tab"]');
  if (!el) return;
  boards.tab = el.dataset.b;
  if (typeof render === 'function') render();
});
