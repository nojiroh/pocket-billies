'use strict';
/* ================= FRIEND TRADES (the online track, ON-4) =================
   The Firestore side of logic/trade.js (docs/phases/online-track.md, ON-4): a friend's row has Trade, the Billie
   sheet has "Trade…", and the trade sheet shows both sides of the pair's one offer, offers/<a>_<b>, live.
   - Each side puts in up to 3 things (team or storage Billies, ready eggs, spare parts) and says Ready; a change to
     either side's give clears both (the version moves). Both ready: each presses Trade! and its game writes its save
     without its things in one batch with its "gave" mark. Once both gave, each game checks what came (legalBilly,
     legalEgg, legalPart) and writes its save with them, with its "received" mark; what fails the check is refused and
     each side takes its own back. A Billie acquired this way may evolve (logic/trade.js tradeAcquire).
   - A page closed midway finishes at the next start: my offers are watched from sign-in (two queries, a == me and
     b == me), and each one's next step runs on its own (receive, take back, delete when done). The save keeps each
     trade once (meta.trades), so nothing is applied twice; a step's save is made on a copy and applied to the live
     save only once the write is in.
   - Friends only, so no Online play needed (as the boards). Not during a run, never during the self-test. The debug
     log gets steps and counts only (no names, no save data). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  accountSaveDoc,
  closeModal,
  modal,
  provide,
  render,
  renderOverlay,
  runEvolution,
  selfTest,
  toast,
} from './hooks.js';
import { ROBOTS, SPECIES } from './game-data.js';
import { graftLook } from './logic/graft-art.js';
import { isRobot } from './logic/fighters.js';
import { billyName, cleanName, newUid } from './logic/rules.js';
import {
  TRADE_CAP,
  offerGone,
  offerId,
  offerNew,
  offerNext,
  offerPatch,
  offerSide,
  tradeAcquire,
  tradeBack,
  tradeGive,
  tradeKey,
  tradeLegal,
  tradeTake,
  tradeThing,
  tradeWhyNot,
} from './logic/trade.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { eggHTML, uiIconHTML } from './art.js';
import { cleanTrainer } from './person-art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { friendShownName, friends, friendsDb, friendsOn } from './friends.js';
/* eslint-disable no-func-assign */
expose({
  TRADE_EVO_MS: [() => TRADE_EVO_MS],
  serverTime: [() => serverTime],
  trade: [() => trade],
  tradeAct: [() => tradeAct, v => (tradeAct = v)],
  tradeAdd: [() => tradeAdd, v => (tradeAdd = v)],
  tradeAdvance: [() => tradeAdvance, v => (tradeAdvance = v)],
  tradeAdvanceAll: [() => tradeAdvanceAll, v => (tradeAdvanceAll = v)],
  tradeDocRead: [() => tradeDocRead, v => (tradeDocRead = v)],
  tradeErrText: [() => tradeErrText, v => (tradeErrText = v)],
  tradeEvolveNext: [() => tradeEvolveNext, v => (tradeEvolveNext = v)],
  tradeFriendSheet: [() => tradeFriendSheet, v => (tradeFriendSheet = v)],
  tradeGiveSet: [() => tradeGiveSet, v => (tradeGiveSet = v)],
  tradeGo: [() => tradeGo, v => (tradeGo = v)],
  tradeHas: [() => tradeHas],
  tradeHistoryHTML: [() => tradeHistoryHTML, v => (tradeHistoryHTML = v)],
  tradeLive: [() => tradeLive],
  tradeMark: [() => tradeMark, v => (tradeMark = v)],
  tradeMe: [() => tradeMe],
  tradeMine: [() => tradeMine],
  tradeName: [() => tradeName],
  tradeNote: [() => tradeNote, v => (tradeNote = v)],
  tradeOffer: [() => tradeOffer],
  tradePickSheet: [() => tradePickSheet, v => (tradePickSheet = v)],
  tradeReady: [() => tradeReady, v => (tradeReady = v)],
  tradeRefresh: [() => tradeRefresh, v => (tradeRefresh = v)],
  tradeRowNote: [() => tradeRowNote, v => ((tradeRowNote = v), provide({ tradeRowNote }))],
  tradeSaveStep: [() => tradeSaveStep, v => (tradeSaveStep = v)],
  tradeSheet: [() => tradeSheet, v => ((tradeSheet = v), provide({ tradeSheet }))],
  tradeStart: [() => tradeStart, v => ((tradeStart = v), provide({ tradeStart }))],
  tradeStop: [() => tradeStop, v => (tradeStop = v)],
  tradeThingHTML: [() => tradeThingHTML, v => (tradeThingHTML = v)],
  tradeUidOf: [() => tradeUidOf, v => (tradeUidOf = v)],
  tradeWrite: [() => tradeWrite, v => (tradeWrite = v)],
});
/* eslint-enable no-func-assign */
provide({ tradeRowNote, tradeSheet, tradeStart });
/* to-module: end */
const TRADE_EVO_MS = 800;
const trade = {
  /** id -> the offer as read (ta / tb in ms) */
  offers: {},
  unsub: [],
  busy: false,
  err: '',
  /** the friend whose trade sheet is open, or '' */
  open: '',
  /** uids of Billies that arrived by trade and evolve by being acquired, waiting for the sheet to be free */
  evo: [],
  evoT: 0,
};

/** whether trades may reach the database now: signed in with friends started, never during the self-test */
const tradeLive = () =>
  typeof friendsOn === 'function' &&
  friendsOn() &&
  friends.on &&
  !!friends.uid &&
  !(typeof selfTest !== 'undefined' && selfTest.on);
const tradeMe = () => ({ u: friends.uid, n: cleanName(cleanTrainer(saveData.avatar, saveData.gender).name, 40) });
function tradeNote(what) {
  if (typeof debugLog !== 'undefined') debugLog.add('online', 'trade: ' + what);
}
/** a refusal's words: Spark's quota, offline, or the rules */
function tradeErrText(e) {
  const c = (e && e.code) || '';
  return c === 'resource-exhausted'
    ? 'Online is busy right now. Try again later.'
    : c === 'unavailable'
      ? 'You’re offline. Try again when you’re back online.'
      : c === 'permission-denied'
        ? 'Trading isn’t open yet: the game’s online rules need updating.'
        : 'The trade didn’t go through. Try again later.';
}
/** the offer between me and a friend, if there is one @param {string} u */
const tradeOffer = u => trade.offers[offerId(friends.uid || '', u)] || null;
/** a friend's name as shown (reports hide it) @param {string} u */
const tradeName = u => friendShownName(u, (friends.data[u] || {}).name, 'your friend');
/** a thing's own uid (an egg's is its Billie's) @param {any} e */
function tradeUidOf(e) {
  try {
    const v = JSON.parse(e.d);
    return e.k === 'e' ? v.egg && v.egg.uid : v.uid;
  } catch {
    return '';
  }
}
/** a thing as drawn: parsed for its look only (never trusted: every word is escaped) @param {any} e */
function tradeThingHTML(e, i = -1, mine = false) {
  let v = null;
  try {
    v = JSON.parse(e.d);
  } catch {
    v = null;
  }
  const m = e.k === 'e' ? v && v.egg : v,
    sp = m && typeof m.sp === 'string' && SPECIES[m.sp] ? m.sp : '';
  let art = '',
    name = 'Something the game can’t read',
    sub = '';
  if (e.k === 'p' && v) {
    const P = ROBOTS.parts[v.id];
    art = uiIconHTML('g-part', 28);
    name = P ? P.name : 'A part';
    sub = `Robot part${v.up ? ` · +${v.up}` : ''}`;
  } else if (e.k === 'e' && sp) {
    art = eggHTML(2, 28);
    name = 'An egg';
    sub = `Hatches into ${SPECIES[sp].name}`;
  } else if (e.k === 'b' && sp) {
    art = rigCanvasHTML(sp, 48, { build: m.build, coat: m.coat, graft: graftLook(m) });
    name = m.nick || SPECIES[sp].name;
    sub = `${SPECIES[sp].name} · Lv ${+m.lvl || 1}${m.ot && m.ot.n ? ` · OT ${m.ot.n}` : ''}`;
  }
  return `<div class="fr-row"><span class="fr-mon">${art}</span><span class="fr-t"><b>${escapeHtml(String(name))}</b><small>${escapeHtml(sub)}</small></span>${mine && i >= 0 ? `<span class="fr-acts"><button class="pb small quiet" data-a="td-rm" data-i="${i}" aria-label="Take ${escapeHtml(String(name))} out">✕</button></span>` : ''}</div>`;
}

/* ---------- watching my offers ---------- */
/** start watching my offers (from sign-in, friends.js initFriends): both queries, and each change steps the offer on */
function tradeStart() {
  if (!tradeLive() || trade.unsub.length) return;
  const db = friendsDb();
  for (const side of ['a', 'b'])
    trade.unsub.push(
      db
        .collection('offers')
        .where(side, '==', friends.uid)
        .limit(50)
        .onSnapshot(
          snap => {
            for (const ch of snap.docChanges()) {
              const id = ch.doc.id;
              if (ch.type === 'removed') delete trade.offers[id];
              else trade.offers[id] = tradeDocRead(ch.doc.data());
            }
            trade.err = '';
            tradeAdvanceAll();
            tradeRefresh();
          },
          e => {
            trade.err = tradeErrText(e);
            tradeNote(`watch refused (${(e && e.code) || 'error'})`);
          }
        )
    );
}
/** stop watching (sign-out) */
function tradeStop() {
  for (const f of trade.unsub) f();
  trade.unsub = [];
  trade.offers = {};
  trade.open = '';
}
/** an offer as read: its times in ms @param {any} d */
function tradeDocRead(d) {
  const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : 0);
  return { ...d, ta: ms(d.ta), tb: ms(d.tb), t: ms(d.t) };
}
function tradeRefresh() {
  if (trade.open && uiState.modal && uiState.modal.cls === 'trade-sheet') tradeSheet(trade.open);
  else if (
    typeof uiState !== 'undefined' &&
    uiState.tab === 'profile' &&
    !uiState.modal &&
    typeof render === 'function'
  )
    render();
}

/* ---------- writing a step ---------- */
const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
/** write a step on the offer (with my save made from `next` in the same batch when there is one)
 * @param {any} o @param {Parameters<typeof offerPatch>[2]} step @param {any} [arg] @param {any} [next] */
async function tradeWrite(o, step, arg = {}, next = null) {
  const p = offerPatch(o, friends.uid, step, { ...arg, now: Date.now() });
  if (typeof p === 'string') throw Object.assign(new Error(p), { code: 'step-' + p });
  const db = friendsDb(),
    ref = db.collection('offers').doc(offerId(o.a, o.b)),
    data = { ...p, t: serverTime() };
  if (step === 'gave') data['t' + offerSide(o, friends.uid)] = serverTime();
  if (!next) return ref.update(data);
  next.savedAt = Date.now();
  const b = db.batch();
  b.set(db.collection('saves').doc(friends.uid), {
    ...accountSaveDoc(),
    json: JSON.stringify(next),
    savedAt: next.savedAt,
  });
  b.update(ref, data);
  return b.commit();
}
/** run a step that changes the save: made on a copy, written, then made again on the live save (the same uids)
 * @param {any} o @param {Parameters<typeof offerPatch>[2]} step @param {(s: any, uid: () => string) => any} apply */
async function tradeSaveStep(o, step, apply) {
  const next = JSON.parse(JSON.stringify(saveData)),
    made = [],
    out = apply(next, () => {
      const u = newUid();
      made.push(u);
      return u;
    });
  if (typeof out === 'string') return out;
  await tradeWrite(o, step, {}, next);
  let i = 0;
  const res = apply(saveData, () => made[i++] || newUid());
  save();
  if (typeof render === 'function') render();
  return res;
}
/** the next step of every offer of mine that runs on its own */
function tradeAdvanceAll() {
  for (const o of Object.values(trade.offers)) tradeAdvance(o);
}
/** one offer's step that needs nobody to press anything: my save caught up with the offer (a page closed midway, an
 * older save picked), receiving once both gave, taking mine back after a close, deleting a finished one @param {any} o */
async function tradeAdvance(o) {
  if (trade.busy || !tradeLive() || saveData.run) return;
  const me = friends.uid,
    s = offerSide(o, me),
    now = Date.now(),
    key = tradeKey(o),
    rec = saveData.meta.trades.find(r => r.k === key),
    st = rec ? rec.st : 'open';
  /* the save behind the offer: apply here what the account already holds */
  if (o['d' + s] && st === 'open') {
    tradeGive(saveData, o, me, now);
    save();
    tradeNote('caught up: gave');
  }
  if (o['r' + s] && st !== 'done') {
    if (typeof tradeTake(saveData, o, me, now) !== 'string') tradeNote('caught up: received');
    save();
  }
  if (o['k' + s] && st !== 'back') {
    tradeBack(saveData, o, me, now);
    save();
    tradeNote('caught up: took back');
  }
  const next = offerNext(o, me, now);
  if (next !== 'take' && next !== 'back' && !offerGone(o)) return;
  trade.busy = true;
  try {
    if (next === 'take') {
      const t = s === 'a' ? 'b' : 'a',
        why = tradeLegal(o['g' + t]);
      if (why) {
        await tradeWrite(o, 'refuse');
        tradeNote(`refused (${why})`);
        toast(
          `What ${tradeName(o[t])} sent didn’t pass the game’s check, so the trade is off: each side gets its own back.`
        );
      } else {
        const came = await tradeSaveStep(o, 'got', (sv, uid) => tradeTake(sv, o, me, now, uid));
        if (Array.isArray(came)) {
          tradeNote(`received ${o['g' + t].length}`);
          toast(`Trade done with ${tradeName(o[t])}! What came is in storage.`);
          for (const m of came) if (tradeAcquire(m)) trade.evo.push(m.uid);
          tradeEvolveNext();
        }
      }
    } else if (next === 'back') {
      await tradeSaveStep(o, 'back', (sv, uid) => tradeBack(sv, o, me, now, uid));
      tradeNote('took back');
      toast('Your side of the trade is back with you.');
    } else if (offerGone(o)) {
      await friendsDb().collection('offers').doc(offerId(o.a, o.b)).delete();
    }
  } catch (e) {
    trade.err = tradeErrText(e);
    tradeNote(`step waits (${(e && e.code) || 'error'})`);
  } finally {
    trade.busy = false;
  }
}
/** an acquired Billie evolves when no sheet is open (one at a time) */
function tradeEvolveNext() {
  clearTimeout(trade.evoT);
  if (!trade.evo.length) return;
  if (uiState.modal) {
    trade.evoT = setTimeout(tradeEvolveNext, TRADE_EVO_MS);
    return;
  }
  const uid = trade.evo.shift(),
    m = saveData.box.find(b => b.uid === uid) || saveData.team.find(b => b.uid === uid);
  if (m && tradeAcquire(m)) runEvolution(m, `${billyName(m)} feels at home with a new trainer.`);
  if (trade.evo.length) trade.evoT = setTimeout(tradeEvolveNext, TRADE_EVO_MS);
}

/* ---------- the player's steps ---------- */
/** what I give now, on the offer with this friend @param {string} u */
const tradeMine = u => {
  const o = tradeOffer(u);
  return o ? o['g' + offerSide(o, friends.uid)] : [];
};
/** put a thing into my side (opening the offer when there is none) @param {string} u @param {'b' | 'e' | 'p'} k
 * @param {string} uid */
async function tradeAdd(u, k, uid) {
  const mine = tradeMine(u);
  if (mine.length >= TRADE_CAP) return toast(`Up to ${TRADE_CAP} things each side.`);
  if (mine.some(e => tradeUidOf(e) === uid)) return;
  const e = tradeThing(saveData, k, uid, tradeMe(), Date.now());
  if (!e) return toast('That can’t go in a trade right now.');
  await tradeGiveSet(u, [...mine, e]);
}
/** my side becomes this give (both readies clear) @param {string} u @param {any[]} give */
async function tradeGiveSet(u, give) {
  if (!tradeLive() || trade.busy) return;
  trade.busy = true;
  const o = tradeOffer(u);
  try {
    if (o && !o.x) await tradeWrite(o, 'give', { give, name: tradeMe().n });
    else {
      /* a closed one goes first; a new one starts at version 1 with a fresh stamp */
      if (o) await friendsDb().collection('offers').doc(offerId(o.a, o.b)).delete();
      const n = offerNew(friends.uid, tradeMe().n, u, give, 'k' + Date.now().toString(36));
      await friendsDb()
        .collection('offers')
        .doc(offerId(friends.uid, u))
        .set({ ...n, t: serverTime() });
      tradeNote('opened');
    }
    trade.err = '';
  } catch (e) {
    trade.err = tradeErrText(e);
    tradeNote(`give refused (${(e && e.code) || 'error'})`);
  } finally {
    trade.busy = false;
    tradeRefresh();
  }
}
/** a step that only marks the offer (ready, not ready, cancel, stale) @param {string} u @param {any} step */
async function tradeMark(u, step) {
  const o = tradeOffer(u);
  if (!o || !tradeLive() || trade.busy) return;
  trade.busy = true;
  try {
    await tradeWrite(o, step);
    trade.err = '';
  } catch (e) {
    trade.err = tradeErrText(e);
    tradeNote(`${step} refused (${(e && e.code) || 'error'})`);
  } finally {
    trade.busy = false;
    tradeRefresh();
  }
}
/** Ready: only when what they give passes the check and mine can all still go @param {string} u */
function tradeReady(u) {
  const o = tradeOffer(u);
  if (!o) return;
  const t = offerSide(o, friends.uid) === 'a' ? 'b' : 'a',
    why = tradeLegal(o['g' + t]);
  if (why) return toast(`What ${tradeName(u)} offers didn’t pass the game’s check (${why}).`);
  if (tradeMine(u).some(e => !tradeHas(e))) return toast('Something of yours can’t go any more. Take it out first.');
  tradeMark(u, 'ok');
}
/** whether a thing of mine is still here and may go @param {any} e */
const tradeHas = e => !tradeWhyNot(saveData, e.k, tradeUidOf(e), Date.now());
/** Trade!: my things leave my save, with my "gave" mark @param {string} u */
async function tradeGo(u) {
  const o = tradeOffer(u);
  if (!o || !tradeLive() || trade.busy) return;
  if (saveData.run) return toast('Trades wait until you’re back in Copperleaf.');
  if (tradeMine(u).some(e => !tradeHas(e))) return toast('Something of yours can’t go any more. Take it out first.');
  trade.busy = true;
  try {
    await tradeSaveStep(o, 'gave', sv => tradeGive(sv, o, friends.uid, Date.now()));
    tradeNote(`gave ${tradeMine(u).length}`);
    trade.err = '';
  } catch (e) {
    trade.err = tradeErrText(e);
    tradeNote(`gave refused (${(e && e.code) || 'error'})`);
  } finally {
    trade.busy = false;
    tradeRefresh();
  }
}

/* ---------- the sheets ---------- */
/** the trade sheet with a friend: both sides, where it stands, what I can do @param {string} u */
function tradeSheet(u) {
  trade.open = u;
  const o = tradeOffer(u),
    nm = escapeHtml(tradeName(u)),
    s = o ? offerSide(o, friends.uid) : 'a',
    t = s === 'a' ? 'b' : 'a',
    mine = o ? o['g' + s] : [],
    theirs = o ? o['g' + t] : [],
    next = o ? offerNext(o, friends.uid, Date.now()) : 'edit',
    edit = next === 'edit',
    readyMe = !!o && o['o' + s] === o.v,
    readyThem = !!o && o['o' + t] === o.v;
  let say = '';
  if (!o) say = `Pick up to ${TRADE_CAP} things to give. ${nm} picks theirs, then you both say Ready.`;
  else if (o.x === 'cancel') say = 'This trade was called off.';
  else if (o.x)
    say =
      o.x === 'refused'
        ? 'A game refused what came, so the trade is off: each side gets its own back.'
        : 'The trade ran out of time: what was sent goes back.';
  else if (next === 'edit')
    say = readyMe
      ? `You’re ready. Waiting for ${nm}.`
      : readyThem
        ? `${nm} is ready. Say Ready when you are.`
        : 'Change your side as you like: any change asks both of you to say Ready again.';
  else if (next === 'give')
    say = o['d' + t] ? `${nm} has sent theirs. Press Trade! to send yours.` : 'You’re both ready. Press Trade!';
  else if (next === 'wait')
    say = `Sent. Waiting for ${nm} to send theirs. If they never do, you can take yours back after 7 days.`;
  else if (next === 'stale') say = `${nm} never sent theirs. You can take yours back.`;
  else if (next === 'take' || next === 'back') say = 'Working on it…';
  else if (next === 'done') say = 'Traded! What came is in storage.';
  const btns = [];
  if (edit && mine.length < TRADE_CAP) btns.push({ l: 'Add something', c: '', f: () => tradePickSheet(u) });
  if (edit && o && mine.length && theirs.length)
    btns.push(
      readyMe
        ? { l: 'Not ready', c: 'quiet', f: () => tradeMark(u, 'unok') }
        : { l: 'Ready', c: 'gold', f: () => tradeReady(u) }
    );
  if (next === 'give' && !o['d' + s]) btns.push({ l: 'Trade!', c: 'gold', f: () => tradeGo(u) });
  if (next === 'stale') btns.push({ l: 'Take mine back', c: 'gold', f: () => tradeMark(u, 'stale') });
  if (edit && o && !o.x) btns.push({ l: 'Call it off', c: 'quiet', f: () => tradeMark(u, 'cancel') });
  btns.push({
    l: 'Close',
    c: 'quiet',
    f: () => {
      trade.open = '';
      closeModal();
    },
  });
  const M = {
    title: `Trade with ${nm}`,
    cls: 'trade-sheet',
    html: `<h3>You give</h3>${mine.map((e, i) => tradeThingHTML(e, i, edit)).join('') || '<p class="note">Nothing yet.</p>'}
<h3>${nm} gives</h3>${theirs.map(e => tradeThingHTML(e)).join('') || '<p class="note">Nothing yet.</p>'}
<p>${say}</p>${saveData.run ? '<p class="note">You’re on a run: trades wait until you’re back in Copperleaf.</p>' : ''}${trade.err ? `<p class="note warn">${escapeHtml(trade.err)}</p>` : ''}`,
    btns,
  };
  if (uiState.modal && uiState.modal.cls === 'trade-sheet') {
    uiState.modal = M;
    renderOverlay();
  } else modal(M);
}
/** the picker: what of mine may go, and why the rest can't @param {string} u */
function tradePickSheet(u) {
  const now = Date.now(),
    taken = new Set(tradeMine(u).map(tradeUidOf)),
    why = {
      run: 'not during a run',
      last: 'your team’s last Billie',
      cooldown: 'traded this week',
      robot: 'robots don’t trade',
      egg: 'not ready yet',
    },
    row = (k, uid, art, name, sub) => {
      const w = taken.has(uid) ? 'already in' : tradeWhyNot(saveData, k, uid, now);
      return `<button class="fr-row" data-a="td-pick" data-u="${escapeHtml(u)}" data-k="${k}" data-id="${escapeHtml(uid)}"${w ? ' disabled' : ''}><span class="fr-mon">${art}</span><span class="fr-t"><b>${escapeHtml(name)}</b><small>${escapeHtml(sub)}${w ? ` · ${escapeHtml(why[w] || w)}` : ''}</small></span></button>`;
    };
  const billies = [...saveData.team, ...saveData.box]
      .filter(m => !isRobot(m))
      .map(m =>
        row(
          'b',
          m.uid,
          rigCanvasHTML(m.sp, 48, { build: m.build, coat: m.coat, graft: graftLook(m) }),
          billyName(m),
          `${SPECIES[m.sp].name} · Lv ${m.lvl}`
        )
      ),
    eggs = saveData.ranch.nursery
      .filter(n => n.egg)
      .map(n => row('e', n.egg.uid, eggHTML(2, 28), 'An egg', 'From the nursery')),
    parts = (saveData.parts || []).map(p =>
      row(
        'p',
        p.uid,
        uiIconHTML('g-part', 28),
        (ROBOTS.parts[p.id] || { name: 'A part' }).name,
        `Robot part${p.up ? ` · +${p.up}` : ''}`
      )
    );
  uiState.modal = null;
  modal({
    title: 'Give what?',
    cls: 'trade-pick',
    html: `<p class="note">A Billie’s held item stays in your bag. A Billie that came by trade waits a week before it can go again.</p>${[...billies, ...eggs, ...parts].join('') || '<p class="note">Nothing to give yet.</p>'}`,
    btns: [{ l: 'Back', c: 'quiet', f: () => tradeSheet(u) }],
  });
}
/** pick a friend to trade a Billie with (the Billie sheet's "Trade…") @param {any} m */
function tradeFriendSheet(m) {
  uiState.modal = null;
  modal({
    title: `Trade ${escapeHtml(billyName(m))}`,
    html: friends.list.length
      ? `<p>With which friend?</p>${friends.list.map(u => `<button class="fr-row" data-a="td-with" data-u="${escapeHtml(u)}" data-id="${escapeHtml(m.uid)}"><span class="fr-t"><b>${escapeHtml(tradeName(u))}</b></span></button>`).join('')}`
      : '<p>Add a friend first (Trainer > Friends): trades are between friends.</p>',
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
/** the Billie sheet's button (null when it can't show: signed out, a robot) @param {any} m */
export function tradeAct(m) {
  if (!tradeLive() || !m || isRobot(m)) return null;
  return {
    ic: 'profile',
    l: 'Trade…',
    f: () => {
      closeModal();
      tradeFriendSheet(m);
    },
  };
}
/** a friend row's mark: they put something in and wait for me @param {string} u */
function tradeRowNote(u) {
  const o = tradeOffer(u);
  if (!o || o.x) return '';
  const next = offerNext(o, friends.uid || '', Date.now());
  return next === 'edit' || next === 'give' ? 'Trade open' : next === 'wait' ? 'Trade sent' : '';
}
/** the Trainer card's trade history (meta.trades) */
export function tradeHistoryHTML() {
  const list = (saveData.meta && saveData.meta.trades) || [];
  if (!list.length) return '';
  const label = t =>
    t.k === 'p'
      ? (ROBOTS.parts[t.sp] || { name: 'a part' }).name
      : `${t.k === 'e' ? 'an egg of ' : ''}${t.nick || (SPECIES[t.sp] ? SPECIES[t.sp].name : 'a Billie')}${t.k === 'b' ? ` Lv ${t.lvl}` : ''}`;
  const st = { open: 'open', gave: 'sent', done: 'done', back: 'called off' };
  return `<section class="tpanel pf-trades"><div class="sec-h"><h2>Trades</h2></div>${list
    .map(
      r =>
        `<div class="fr-row"><span class="fr-t"><b>With ${escapeHtml(friendShownName(r.u, r.n, 'a friend'))} · ${escapeHtml(st[r.st] || r.st)}</b><small>Gave ${escapeHtml(r.gave.map(label).join(', ') || 'nothing')}${r.got.length ? ` · got ${escapeHtml(r.got.map(label).join(', '))}` : ''} · ${escapeHtml(new Date(r.at).toLocaleDateString())}</small></span></div>`
    )
    .join('')}</section>`;
}
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="td-"]');
  if (!el) return;
  const d = el.dataset;
  if (d.a === 'td-open') tradeSheet(d.u);
  else if (d.a === 'td-pick') {
    tradeSheet(d.u);
    tradeAdd(d.u, /** @type {any} */ (d.k), d.id);
  } else if (d.a === 'td-rm') {
    const mine = tradeMine(trade.open);
    tradeGiveSet(
      trade.open,
      mine.filter((e, i) => i !== +d.i)
    );
  } else if (d.a === 'td-with') {
    tradeSheet(d.u);
    tradeAdd(d.u, 'b', d.id);
  }
});
