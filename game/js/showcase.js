'use strict';
/* ================= THE SHOWCASE (the online track, ON-3) =================
   The Firestore side of logic/showcase.js (docs/phases/online-track.md, ON-3): share a Billie's look, browse, vote,
   the weekly theme's ribbons, and the moderator's view. firebase/firestore.rules guards every write.
   - Sharing (the Billie sheet's "Share to the Showcase"): one of three slots, showcase/<uid>_<slot>; a full set
     replaces one of them (delete, then the new one). Needs Online play: an entry is seen by everyone.
   - Browsing (the Trainer screen): New, This week's theme (by votes), Last week's winners, Friends, Yours. Pages of
     SHOW_PAGE, kept for SHOW_KEEP_MS (Spark's daily read quota). Everyone's tabs need Online play; Friends and Yours
     don't (friends only, as the boards). Never a blocked player's, a hidden entry or one the game can't draw.
   - Votes: the vote and the entry's count in one batch (the entry read fresh first, so the count is the server's).
   - Ribbons: when a week whose theme held an entry of mine is over, the week's winners are read once and my winning
     Billies get their ribbon (logic/showcase.js showAward).
   - Moderation (Debug > Moderation, the moderator's account only: the rules refuse anyone else): reports by target,
     clear one, hide or show an entry again.
   Nothing here runs during the self-test, and the debug log gets counts only (no names, no save data). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, provide, render, selfTest, toast } from './hooks.js';
import { SHOWCASE, SPECIES } from './game-data.js';
import { graftLook } from './logic/graft-art.js';
import { billyName, cleanName, plural } from './logic/rules.js';
import { SHOW_NAME_MOST, SHOW_PAGE, SHOW_SLOTS } from './logic/meta-state.js';
import { REPORT_REASONS, onlinePlayOn } from './logic/online.js';
import { boardWeek } from './logic/daily.js';
import {
  ribbonName,
  showAward,
  showEntry,
  showHidden,
  showId,
  showLook,
  showReportTarget,
  showSlotFree,
  showTheme,
  showThemeFits,
  showValid,
  showVoteId,
  showVoteKey,
  showVoteSet,
  showWeekRange,
  showWinners,
} from './logic/showcase.js';
import { escapeHtml, save, saveData } from './game-state.js';
import { cleanTrainer } from './person-art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { refreshDebugMenu } from './debug-menu.js';
import { blockPlayer, friends, friendsDb, friendsOn } from './friends.js';
/* eslint-disable no-func-assign */
expose({
  SHOW_GLOBAL_TABS: [() => SHOW_GLOBAL_TABS],
  SHOW_KEEP_MS: [() => SHOW_KEEP_MS],
  SHOW_RETRY_MS: [() => SHOW_RETRY_MS],
  SHOW_TABS: [() => SHOW_TABS],
  SHOW_TAB_NAMES: [() => SHOW_TAB_NAMES],
  showDrawable: [() => showDrawable, v => (showDrawable = v)],
  showEntries: [() => showEntries, v => (showEntries = v)],
  showErrText: [() => showErrText, v => (showErrText = v)],
  showFetch: [() => showFetch, v => (showFetch = v)],
  showFind: [() => showFind],
  showGlobal: [() => showGlobal],
  showLive: [() => showLive],
  showMine: [() => showMine],
  showModAct: [() => showModAct, v => (showModAct = v)],
  showModHTML: [() => showModHTML, v => ((showModHTML = v), provide({ showModHTML }))],
  showModLoad: [() => showModLoad, v => (showModLoad = v)],
  showModTarget: [() => showModTarget, v => (showModTarget = v)],
  showMoreSheet: [() => showMoreSheet, v => (showMoreSheet = v)],
  showMyName: [() => showMyName],
  showNote: [() => showNote, v => (showNote = v)],
  showNow: [() => showNow],
  showRefresh: [() => showRefresh, v => (showRefresh = v)],
  showReport: [() => showReport, v => (showReport = v)],
  showRibbonsCheck: [() => showRibbonsCheck, v => (showRibbonsCheck = v)],
  showRibbonsHTML: [() => showRibbonsHTML, v => (showRibbonsHTML = v)],
  showRowHTML: [() => showRowHTML, v => (showRowHTML = v)],
  showShare: [() => showShare, v => (showShare = v)],
  showShareSheet: [() => showShareSheet, v => (showShareSheet = v)],
  showSlotsSync: [() => showSlotsSync, v => (showSlotsSync = v)],
  showTakeDown: [() => showTakeDown, v => (showTakeDown = v)],
  showVote: [() => showVote, v => (showVote = v)],
  showWeekQuery: [() => showWeekQuery, v => (showWeekQuery = v)],
  showcase: [() => showcase],
  showcaseAct: [() => showcaseAct, v => (showcaseAct = v)],
  showcaseHTML: [() => showcaseHTML, v => (showcaseHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ showModHTML });
/* to-module: end */
const SHOW_KEEP_MS = 10 * 60000,
  SHOW_RETRY_MS = 60000,
  SHOW_TABS = ['new', 'theme', 'last', 'friends', 'mine'],
  SHOW_GLOBAL_TABS = ['new', 'theme', 'last'];
const showcase = {
  tab: 'theme',
  /** tab -> { list, at, end (the last document read, for "Show more"), done (no more to read) } */
  pages: {},
  busy: {},
  err: '',
  /** the weeks whose ribbons are being looked at now, and when they last were (a refusal waits SHOW_KEEP_MS) */
  awarding: false,
  ribAt: 0,
  /** the moderator's view: the reports read, and entries by id */
  mod: { list: null, entries: {}, hidden: null, err: '', busy: false },
};

/** whether the Showcase may reach the database now: signed in with friends started, never during the self-test */
const showLive = () =>
  typeof friendsOn === 'function' &&
  friendsOn() &&
  friends.on &&
  !!friends.uid &&
  !(typeof selfTest !== 'undefined' && selfTest.on);
/** whether everyone's entries may show: Online play on (Settings > Save; off by default) */
const showGlobal = () => showLive() && onlinePlayOn(saveData.preferences);
const showNow = () => boardWeek(Date.now());
const showMine = () => saveData.meta.show;
const showMyName = () => cleanName(cleanTrainer(saveData.avatar, saveData.gender).name, SHOW_NAME_MOST) || 'Trainer';
function showNote(what) {
  if (typeof debugLog !== 'undefined') debugLog.add('online', 'showcase: ' + what);
}
/** a refusal's words: Spark's quota, offline, or the rules */
function showErrText(e) {
  const c = (e && e.code) || '';
  return c === 'resource-exhausted'
    ? 'Online is busy right now. Try again later.'
    : c === 'unavailable'
      ? 'You’re offline. Try again when you’re back online.'
      : c === 'permission-denied'
        ? 'The Showcase isn’t open yet: the game’s online rules need updating.'
        : 'The Showcase didn’t answer. Try again later.';
}
function showRefresh() {
  if (typeof render === 'function') render();
}

/** whether an entry read with its id can be drawn (logic/showcase.js showValid on its fields) @param {any} e */
function showDrawable(e) {
  const { id, ...rest } = e;
  return !!id && !showValid(rest);
}
/** documents read as entries: { id, ...data }, only those the game can draw, not hidden, not a blocked player's */
function showEntries(snap) {
  const out = [];
  for (const d of snap.docs) {
    const e = Object.assign({ id: d.id }, d.data());
    if (
      !showDrawable(e) ||
      showHidden(e) ||
      friends.blocked.includes(e.u) ||
      d.id !== `${e.u}_${d.id.split('_').pop()}`
    )
      continue;
    out.push(e);
  }
  return out;
}
/** a week's theme entries by votes (the sort key's range: no index to set up) @param {number} w */
function showWeekQuery(w) {
  const [lo, hi] = showWeekRange(w);
  return friendsDb()
    .collection('showcase')
    .where('wv', '>=', lo)
    .where('wv', '<', hi)
    .orderBy('wv', 'desc')
    .limit(SHOW_PAGE);
}
/** read a tab (cached SHOW_KEEP_MS unless `more` or `force`); resolves when done, never throws */
function showFetch(tab, more = false, force = false) {
  if (!showLive() || (SHOW_GLOBAL_TABS.includes(tab) && !showGlobal())) return Promise.resolve();
  if (showcase.busy[tab]) return showcase.busy[tab];
  const P = showcase.pages[tab];
  if (P && !more && !force && Date.now() - P.at < SHOW_KEEP_MS) return Promise.resolve();
  if (more && (!P || P.done || !P.end)) return Promise.resolve();
  const db = friendsDb(),
    col = db.collection('showcase');
  let go;
  if (tab === 'new' || tab === 'theme' || tab === 'last') {
    let q =
      tab === 'new' ? col.orderBy('k', 'desc').limit(SHOW_PAGE) : showWeekQuery(showNow() - (tab === 'last' ? 1 : 0));
    if (more) q = q.startAfter(P.end);
    go = q
      .get()
      .then(s => ({ list: showEntries(s), end: s.docs[s.docs.length - 1] || null, done: s.size < SHOW_PAGE }));
  } else if (tab === 'friends') {
    const who = friends.list.filter(u => !friends.blocked.includes(u)),
      parts = [];
    for (let i = 0; i < who.length; i += 10) parts.push(who.slice(i, i + 10));
    go = Promise.all(parts.map(p => col.where('u', 'in', p).limit(SHOW_PAGE).get())).then(all => ({
      list: all.flatMap(showEntries).sort((a, b) => b.k - a.k),
      end: null,
      done: true,
    }));
  } else {
    go = Promise.all(
      Array.from({ length: SHOW_SLOTS }, (_, i) =>
        col
          .doc(showId(friends.uid, i))
          .get()
          .then(d => (d.exists ? Object.assign({ id: d.id }, d.data()) : null))
      )
    ).then(got => ({
      list: got.filter(e => e && showDrawable(e)),
      end: null,
      done: true,
    }));
  }
  showcase.busy[tab] = go
    .then(r => {
      const old = more && P ? P.list : [];
      showcase.pages[tab] = { list: [...old, ...r.list], at: Date.now(), end: r.end, done: r.done };
      showcase.err = '';
      showNote(`${tab}: ${r.list.length} read`);
      if (tab === 'mine') showSlotsSync(r.list);
    })
    .catch(e => {
      showcase.err = showErrText(e);
      showNote(`${tab}: refused (${(e && e.code) || 'offline'})`);
      /* what was read stays; a refusal is tried again after SHOW_RETRY_MS, not at every redraw */
      if (!more)
        showcase.pages[tab] = {
          list: P ? P.list : [],
          at: Date.now() - SHOW_KEEP_MS + SHOW_RETRY_MS,
          end: null,
          done: true,
        };
    })
    .finally(() => {
      showcase.busy[tab] = null;
      showRefresh();
    });
  return showcase.busy[tab];
}
/** my slots as the database has them: an entry deleted elsewhere (another device, the moderator's clean-up) frees its
 * slot here too @param {any[]} list */
function showSlotsSync(list) {
  const M = showMine(),
    keep = M.s.filter(x => list.some(e => e.id === showId(friends.uid, x.i) && e.k === x.k));
  if (keep.length !== M.s.length) {
    M.s = keep;
    save();
  }
}

/* ---------- ribbons ---------- */
/** when a week whose theme held an entry of mine is over, read its winners once and give my ribbons */
async function showRibbonsCheck() {
  if (!showLive() || showcase.awarding || Date.now() - showcase.ribAt < SHOW_KEEP_MS) return;
  const M = showMine(),
    last = showNow() - 1,
    weeks = [...new Set(M.s.filter(x => x.th && x.w > M.rw && x.w <= last).map(x => x.w))].sort((a, b) => a - b);
  if (!weeks.length) {
    if (M.rw < last) {
      M.rw = last;
      save();
    }
    return;
  }
  showcase.awarding = true;
  showcase.ribAt = Date.now();
  try {
    const billies = [...saveData.team, ...saveData.box, ...(saveData.run ? saveData.run.start.team : [])];
    for (const w of weeks) {
      const s = await showWeekQuery(w).get(),
        list = s.docs.map(d => Object.assign({ id: d.id }, d.data())),
        got = showAward(M, billies, showWinners(list, w, SHOWCASE), friends.uid, w);
      for (const r of got)
        toast(
          `${r.nick || (SPECIES[r.sp] ? SPECIES[r.sp].name : 'Your Billie')} won the ${ribbonName(r, SHOWCASE)} ribbon in the Showcase!`
        );
      showNote(`ribbons for week ${w}: ${got.length}`);
    }
    if (M.rw < last) M.rw = last;
    save();
  } catch (e) {
    showNote(`ribbons wait (${(e && e.code) || 'offline'})`);
  }
  showcase.awarding = false;
  showRefresh();
}

/* ---------- sharing ---------- */
/** the Billie sheet's button (null when it can't show: signed out, a robot) @param {any} m */
export function showcaseAct(m) {
  if (!showLive() || !m || m.kind === 'robot') return null;
  return {
    ic: 'spark',
    l: 'Share to the Showcase',
    f: () => {
      closeModal();
      showShareSheet(m);
    },
  };
}
/** the share sheet: what goes online, this week's theme, and a slot (or which of mine to replace) @param {any} m */
function showShareSheet(m) {
  if (!showGlobal()) {
    modal({
      title: 'Share to the Showcase',
      html: '<p>The Showcase shows your Billie to every player. Turn on Online play first (Settings > Save).</p>',
      btns: [{ l: 'OK', c: 'gold', f: closeModal }],
    });
    return;
  }
  const w = showNow(),
    T = showTheme(w, SHOWCASE),
    fits = showThemeFits(T, m),
    M = showMine(),
    free = showSlotFree(M),
    name = escapeHtml(billyName(m));
  const slotBtns =
    free >= 0
      ? [{ l: 'Share it', c: 'gold', f: () => showShare(m, free) }]
      : M.s.map(x => {
          const b = [...saveData.team, ...saveData.box].find(o => o.uid === x.b);
          return {
            l: `Replace ${escapeHtml(b ? billyName(b) : 'an older entry')}`,
            c: 'quiet',
            f: () => showShare(m, x.i),
          };
        });
  modal({
    title: `Share ${name}?`,
    html: `<div class="ms-plate">${rigCanvasHTML(m.sp, 96, { build: m.build, coat: m.coat, graft: graftLook(m) })}</div>
<p>Every player with Online play on sees ${name}’s look, its nickname, its level and your name. Nothing else goes: it stays yours.</p>
<p>This week’s theme is <b>${escapeHtml(T.name)}</b>: ${escapeHtml(T.d)} ${fits ? `${name} fits it and enters the vote.` : `${name} doesn’t fit it, so it shows under New and Friends only.`}</p>
${free >= 0 ? `<p class="note">You have ${plural(SHOW_SLOTS - M.s.length, 'free slot')} of ${SHOW_SLOTS}.</p>` : `<p class="note">Your ${SHOW_SLOTS} slots are full: pick one to replace (its votes go with it).</p>`}`,
    btns: [...slotBtns, { l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
/** put a Billie into one of my slots (replacing what is there) @param {any} m @param {number} slot */
async function showShare(m, slot) {
  closeModal();
  const w = showNow(),
    T = showTheme(w, SHOWCASE),
    k = Date.now(),
    { e, why } = showEntry(m, { u: friends.uid, name: showMyName() }, w, k, T);
  if (!e) {
    toast(`${billyName(m)} can’t go to the Showcase (${why}).`);
    showNote(`share refused by the legality check: ${why}`);
    return;
  }
  const M = showMine(),
    ref = friendsDb().collection('showcase').doc(showId(friends.uid, slot));
  try {
    if (M.s.some(x => x.i === slot)) await ref.delete();
    else {
      /* a slot this save doesn't know of (made on another device) is cleared first */
      const old = await ref.get();
      if (old.exists) await ref.delete();
    }
    await ref.set(e);
    M.s = [...M.s.filter(x => x.i !== slot), { i: slot, k, w, th: e.th, b: m.uid }];
    save();
    delete showcase.pages.mine;
    delete showcase.pages.new;
    if (e.th) delete showcase.pages.theme;
    showcase.tab = 'mine';
    toast(`${billyName(m)} is in the Showcase${e.th ? ` for ${T.name}` : ''}. See it on the Trainer screen.`);
    showNote('shared one');
  } catch (err) {
    toast(showErrText(err));
    showNote(`share refused (${(err && err.code) || 'offline'})`);
  }
  showRefresh();
}
/** take one of my entries down @param {string} id */
async function showTakeDown(id) {
  const slot = +id.split('_').pop(),
    M = showMine();
  try {
    await friendsDb().collection('showcase').doc(id).delete();
    M.s = M.s.filter(x => x.i !== slot);
    save();
    for (const t of SHOW_TABS)
      if (showcase.pages[t]) showcase.pages[t].list = showcase.pages[t].list.filter(e => e.id !== id);
    toast('Taken down.');
  } catch (e) {
    toast(showErrText(e));
  }
  showRefresh();
}

/* ---------- votes ---------- */
/** the entry as read in any tab @param {string} id */
const showFind = id => {
  for (const t of SHOW_TABS) {
    const e = showcase.pages[t] && showcase.pages[t].list.find(x => x.id === id);
    if (e) return e;
  }
  return null;
};
/** give (k 1) or take back (k -1) my vote: the entry read fresh, then the vote and its count in one batch
 * @param {string} id @param {1 | -1} k */
async function showVote(id, k) {
  const e = showFind(id);
  if (!e || !showLive() || e.u === friends.uid) return;
  const db = friendsDb(),
    ref = db.collection('showcase').doc(id),
    key = showVoteKey(id, e.k),
    vref = db.collection('votes').doc(showVoteId(id, e.k, friends.uid));
  try {
    const s = await ref.get();
    if (!s.exists || s.data().k !== e.k) throw Object.assign(new Error('gone'), { code: 'not-found' });
    const cur = s.data(),
      b = db.batch();
    if (k > 0) b.set(vref, { e: id, k: e.k, by: friends.uid, t: Date.now() });
    else b.delete(vref);
    b.update(ref, { v: cur.v + k, wv: cur.wv > 0 ? cur.wv + k : cur.wv });
    await b.commit();
    for (const t of SHOW_TABS) {
      const x = showcase.pages[t] && showcase.pages[t].list.find(o => o.id === id);
      if (x) Object.assign(x, { v: cur.v + k, wv: cur.wv > 0 ? cur.wv + k : cur.wv });
    }
    showVoteSet(showMine(), key, k > 0);
    save();
  } catch (err) {
    const code = (err && err.code) || '';
    /* a vote this save forgot (another device), or one already taken back: the save follows the database */
    if (code === 'permission-denied') {
      const had = await vref
        .get()
        .then(d => d.exists)
        .catch(() => null);
      if (had !== null) {
        showVoteSet(showMine(), key, had);
        save();
      }
      toast(
        e.w !== showNow()
          ? 'Voting on that week is closed.'
          : had
            ? 'You voted for it already.'
            : 'That vote didn’t count.'
      );
    } else if (code === 'not-found') toast('That entry was taken down.');
    else toast(showErrText(err));
  }
  showRefresh();
}

/* ---------- block and report ---------- */
/** report an entry once: the count, my report and the entry's own count in one batch @param {string} id
 * @param {string} reason */
async function showReport(id, reason) {
  const e = showFind(id);
  if (!e || !REPORT_REASONS.includes(reason) || e.u === friends.uid) return;
  const db = friendsDb(),
    ref = db.collection('reports').doc(showReportTarget(id, e.k)),
    mine = ref.collection('by').doc(friends.uid),
    eref = db.collection('showcase').doc(id);
  try {
    const [cur, es] = await Promise.all([ref.get(), eref.get()]),
      b = db.batch();
    b.set(ref, cur.exists ? { n: (cur.data().n || 0) + 1, ok: cur.data().ok || 0 } : { n: 1, ok: 0 });
    b.set(mine, { reason, t: Date.now() });
    if (es.exists && es.data().k === e.k) b.update(eref, { r: (es.data().r || 0) + 1 });
    await b.commit();
    toast('Thanks. The report went to the game’s moderator.');
  } catch (err) {
    toast(
      err && err.code === 'permission-denied'
        ? 'You reported it already.'
        : 'The report didn’t go through. Try again later.'
    );
  }
}
function showMoreSheet(id) {
  const e = showFind(id);
  if (!e) return;
  const why = { name: 'Its name', picture: 'Its look', cheating: 'Cheating', other: 'Something else' };
  modal({
    title: escapeHtml(e.nick || (SPECIES[e.sp] ? SPECIES[e.sp].name : 'Entry')),
    html: `<p>Shared by ${escapeHtml(e.name)}. Report it to the game’s moderator (an entry three players report is hidden until the moderator looks at it), or block ${escapeHtml(e.name)}: you won’t see their entries, and they can’t add you.</p>`,
    btns: [
      ...REPORT_REASONS.map(k => ({
        l: `Report: ${why[k] || k}`,
        c: 'quiet',
        f: () => {
          closeModal();
          showReport(id, k);
        },
      })),
      {
        l: `Block ${escapeHtml(e.name)}`,
        c: 'quiet',
        f: () => {
          closeModal();
          for (const t of SHOW_TABS)
            if (showcase.pages[t]) showcase.pages[t].list = showcase.pages[t].list.filter(x => x.u !== e.u);
          if (typeof blockPlayer === 'function') blockPlayer(e.u, e.name);
        },
      },
      { l: 'Back', c: 'gold', f: closeModal },
    ],
  });
}

/* ---------- the Trainer screen ---------- */
const SHOW_TAB_NAMES = {
  new: 'New',
  theme: 'This week',
  last: 'Last week',
  friends: 'Friends',
  mine: 'Yours',
};
/** one entry as a row: its look, names, theme, votes and what I can do @param {any} e @param {number} [place] */
function showRowHTML(e, place = -1) {
  const look = showLook(e),
    S = SPECIES[e.sp],
    mine = e.u === friends.uid,
    open = e.w === showNow(),
    voted = showMine().v.includes(showVoteKey(e.id, e.k)),
    T = SHOWCASE.themes.find(t => t.id === e.th),
    title = e.nick || S.name,
    by = `${S.name} · Lv ${e.lvl} · by ${mine ? 'you' : e.name}${e.ot && e.ot !== e.name ? ` (first trained by ${e.ot})` : ''}`,
    vote = mine
      ? `<button class="pb small quiet" data-a="sc-down" data-id="${escapeHtml(e.id)}">Take down</button>`
      : open
        ? `<button class="pb small${voted ? '' : ' gold'}" data-a="sc-vote" data-id="${escapeHtml(e.id)}" aria-pressed="${voted}">${voted ? 'Voted' : 'Vote'}</button>`
        : '';
  return `<div class="fr-row">${place >= 0 ? `<b class="bd-rank tnum">${escapeHtml(SHOWCASE.ribbons[place] || '')}</b>` : ''}<span class="fr-mon">${rigCanvasHTML(look.sp, 56, { build: look.build, coat: look.coat, graft: graftLook(look) })}</span><span class="fr-t"><b>${escapeHtml(title)}</b><small>${escapeHtml(by)}</small><small>${T ? `${escapeHtml(T.name)} · ` : ''}${plural(e.v, 'vote')}${open ? '' : ' (closed)'}</small></span>${vote}${mine ? '' : `<button class="pb small quiet" data-a="sc-more" data-id="${escapeHtml(e.id)}" aria-label="Report or block">…</button>`}</div>`;
}
/** the ribbons this save won (meta.show.rib), newest first; '' for none */
function showRibbonsHTML() {
  const R = showMine().rib;
  if (!R.length) return '';
  return `<p class="note">Ribbons won: ${R.slice()
    .reverse()
    .map(
      r =>
        `${escapeHtml(r.nick || (SPECIES[r.sp] ? SPECIES[r.sp].name : 'a Billie'))}, ${escapeHtml(ribbonName(r, SHOWCASE))}`
    )
    .join('; ')}.</p>`;
}
/** the Showcase on the Trainer screen (signed in only; the ribbons won show signed out too) */
export function showcaseHTML() {
  const rib = showRibbonsHTML();
  if (!showLive())
    return rib ? `<section class="tpanel"><div class="sec-h"><h2>Showcase</h2></div>${rib}</section>` : '';
  showRibbonsCheck();
  const tab = SHOW_TABS.includes(showcase.tab) ? showcase.tab : 'theme',
    global = SHOW_GLOBAL_TABS.includes(tab),
    w = showNow(),
    T = showTheme(tab === 'last' ? w - 1 : w, SHOWCASE);
  if (!global || showGlobal()) showFetch(tab);
  const P = showcase.pages[tab],
    list = P ? P.list : [],
    tabs = SHOW_TABS.map(
      t =>
        `<button class="fchip k-btn${t === tab ? ' on' : ''}" data-a="sc-tab" data-b="${t}" aria-pressed="${t === tab}">${SHOW_TAB_NAMES[t]}</button>`
    ).join(''),
    head =
      tab === 'theme'
        ? `<p class="note">This week’s theme: <b>${escapeHtml(T.name)}</b>. ${escapeHtml(T.d)} The top ${SHOWCASE.ribbons.length} on Sunday night (UTC) win a ribbon.</p>`
        : tab === 'last'
          ? `<p class="note">Last week’s theme: <b>${escapeHtml(T.name)}</b>. Voting is closed.</p>`
          : tab === 'mine'
            ? `<p class="note">Share a Billie from its sheet (Share to the Showcase). Up to ${SHOW_SLOTS} at a time.</p>`
            : '',
    places = tab === 'last' ? showWinners(list, w - 1, SHOWCASE) : [],
    rows = list
      .map(e => {
        const p = places.find(x => x.id === e.id);
        return showRowHTML(e, p ? p.p : -1);
      })
      .join(''),
    body =
      global && !showGlobal()
        ? '<p class="note">Turn on Online play (Settings > Save) to see everyone’s Billies. Friends and Yours work without it.</p>'
        : showcase.err && !list.length
          ? `<p class="note">${escapeHtml(showcase.err)}</p>`
          : list.length
            ? rows +
              (P && !P.done
                ? `<button class="pb small quiet" data-a="sc-more-page" data-b="${tab}">Show more</button>`
                : '')
            : `<p class="note">${showcase.busy[tab] ? 'Looking…' : tab === 'mine' ? 'Nothing shared yet.' : 'No entries here yet.'}</p>`;
  return `<section class="tpanel pf-boards"><div class="sec-h"><h2>Showcase</h2></div><div class="fchips">${tabs}</div>${head}${body}${rib}</section>`;
}

/* ---------- the moderator's view (Debug > Moderation) ---------- */
/** the reports and hidden entries, read when asked (the rules let the moderator alone list them) */
async function showModLoad() {
  if (!showLive()) return;
  const M = showcase.mod,
    db = friendsDb();
  M.busy = true;
  M.err = '';
  try {
    const [rs, hs] = await Promise.all([
      db.collection('reports').limit(50).get(),
      db.collection('showcase').where('hid', '==', true).limit(SHOW_PAGE).get(),
    ]);
    M.list = rs.docs
      .map(d => Object.assign({ id: d.id }, d.data()))
      .filter(r => (r.n || 0) > (r.ok || 0))
      .sort((a, b) => b.n - b.ok - (a.n - a.ok));
    M.hidden = hs.docs.map(d => Object.assign({ id: d.id }, d.data()));
    const ids = [
      ...new Set(M.list.filter(r => r.id.startsWith('show_')).map(r => r.id.slice(5).split('_').slice(0, 2).join('_'))),
    ];
    const got = await Promise.all(ids.map(id => db.collection('showcase').doc(id).get()));
    M.entries = Object.fromEntries(got.filter(d => d.exists).map(d => [d.id, Object.assign({ id: d.id }, d.data())]));
    showNote(`moderation: ${M.list.length} open, ${M.hidden.length} hidden`);
  } catch (e) {
    M.err =
      e && e.code === 'permission-denied'
        ? 'Only the moderator’s account reads reports (the uid in firestore.rules, published).'
        : showErrText(e);
  }
  M.busy = false;
  if (typeof refreshDebugMenu === 'function') refreshDebugMenu();
}
/** a report target in words, and the entry it names (its stamp must match) @param {any} r */
function showModTarget(r) {
  if (r.id.startsWith('user_')) return { what: `Player ${r.id.slice(5)} (their name)`, e: null };
  const parts = r.id.slice(5).split('_'),
    id = parts.slice(0, 2).join('_'),
    e = showcase.mod.entries[id];
  return { what: `Entry ${id}`, e: e && String(e.k) === parts[2] ? e : null };
}
function showModHTML() {
  const M = showcase.mod;
  if (!showLive()) return '<p class="note">Sign in with the moderator’s account to moderate.</p>';
  const load = `<div class="dbg-row"><button class="pb small" data-a="sc-mod-load">${M.list ? 'Read reports again' : 'Read reports'}</button></div>`;
  if (M.busy) return load + '<p class="note">Reading…</p>';
  if (M.err) return load + `<p class="note">${escapeHtml(M.err)}</p>`;
  if (!M.list) return load + '<p class="note">Reports past what you last cleared, and the entries you hid.</p>';
  const row = r => {
    const { what, e } = showModTarget(r),
      look = e ? showLook(e) : null;
    return `<div class="fr-row">${look && SPECIES[look.sp] ? `<span class="fr-mon">${rigCanvasHTML(look.sp, 48, { build: look.build, coat: look.coat, graft: graftLook(look) })}</span>` : ''}<span class="fr-t"><b>${escapeHtml(e ? `${e.nick || (SPECIES[e.sp] ? SPECIES[e.sp].name : String(e.sp))} by ${e.name}` : what)}</b><small>${plural(r.n - (r.ok || 0), 'new report')}, ${r.n} in all${e && e.hid ? ' · hidden' : ''}</small></span><button class="pb small quiet" data-a="sc-mod-ok" data-id="${escapeHtml(r.id)}">Clear</button>${e && !e.hid ? `<button class="pb small red" data-a="sc-mod-hide" data-id="${escapeHtml(r.id)}">Hide entry</button>` : ''}</div>`;
  };
  const hid = (M.hidden || [])
    .map(
      e =>
        `<div class="fr-row"><span class="fr-t"><b>${escapeHtml(e.nick || (SPECIES[e.sp] ? SPECIES[e.sp].name : e.sp))} by ${escapeHtml(e.name)}</b><small>Hidden</small></span><button class="pb small quiet" data-a="sc-mod-show" data-id="${escapeHtml(e.id)}">Show again</button></div>`
    )
    .join('');
  return `${load}${M.list.length ? M.list.map(row).join('') : '<p class="note">No open reports.</p>'}${hid ? `<p class="note">Hidden entries:</p>${hid}` : ''}<p class="note">Clear: the reports so far no longer count (a player’s name or an entry shows again). Hide: the entry is hidden for everyone until you show it again.</p>`;
}
/** the moderator's buttons @param {string} a @param {string} rid a report target or (sc-mod-show) an entry id */
async function showModAct(a, rid) {
  const db = friendsDb(),
    M = showcase.mod;
  try {
    if (a === 'sc-mod-show') {
      await db.collection('showcase').doc(rid).update({ hid: false });
    } else {
      const r = (M.list || []).find(x => x.id === rid);
      if (!r) return;
      const { e } = showModTarget(r),
        b = db.batch();
      b.update(db.collection('reports').doc(rid), { ok: r.n });
      if (e) b.update(db.collection('showcase').doc(e.id), a === 'sc-mod-hide' ? { hid: true, ok: e.r } : { ok: e.r });
      await b.commit();
    }
    toast('Done.');
  } catch (err) {
    toast(err && err.code === 'permission-denied' ? 'Only the moderator’s account can do that.' : showErrText(err));
  }
  showModLoad();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="sc-"]');
  if (!el) return;
  const a = el.dataset.a,
    id = el.dataset.id || '';
  if (a === 'sc-tab') {
    showcase.tab = el.dataset.b;
    showRefresh();
  } else if (a === 'sc-more-page') showFetch(el.dataset.b, true);
  else if (a === 'sc-vote') showVote(id, showMine().v.includes(showVoteKey(id, (showFind(id) || {}).k)) ? -1 : 1);
  else if (a === 'sc-down') showTakeDown(id);
  else if (a === 'sc-more') showMoreSheet(id);
  else if (a === 'sc-mod-load') showModLoad();
  else if (a === 'sc-mod-ok' || a === 'sc-mod-hide' || a === 'sc-mod-show') showModAct(a, id);
});
