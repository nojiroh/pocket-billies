// @ts-check
'use strict';
/* ================= TRADE (the online track, ON-4) =================
   Friend trades of ranch Billies, ready nursery eggs and spare robot parts, up to TRADE_CAP each side
   (docs/phases/online-track.md). Firebase stays on Spark, so there is no server: each game moves its own things and
   firebase/firestore.rules checks the order of the steps on the offer, offers/<a>_<b> (a < b). This file is the
   rules' twin: offerPatch makes exactly the writes the rules allow, and the save's side of each step.
   - An offer: { a, b, na, nb, ga, gb, oa, ob, da, db, ta, tb, ra, rb, ka, kb, x, by, v, k } (t, the server's time,
     is the page's). g_: a side's give, each thing { k: 'b' | 'e' | 'p', d: its online copy as JSON text }; o_: the
     version that side agreed to (0: none); d_: gave (t_ its time in ms); r_: received; k_: took back; x: '' or
     cancel / refused / stale, by whom; v: the gives' version; k: the offer's own stamp.
   - Steps: a give change moves v (so no old ok stands); both oks on v lock it; each side gives (its save without
     the things, in one batch with d_), then receives (its save with the other side's, with r_); closing: cancel
     before anyone gave, refused (what came failed legalBilly / legalEgg / legalPart) while the other side hasn't
     received, stale 7 days after an unanswered give; after a close, a side that gave takes its things back (k_).
   - The save's side is applied once per trade: meta.trades keeps each trade by its key (the offer's id and stamp)
     with what was given and got, so a page closed midway finishes at the next start without doing anything twice.
   - What can go: a Billie of the team or storage (never during a run, never a robot, never the team's last one, not
     within TRADE_COOLDOWN_MS of arriving by trade), a ready nursery egg, a spare part (a worn one is on its Billie
     and goes with it). A Billie's held item stays in your bag. What arrives: a Billie into storage marked traded
     { at, from } (it keeps its original trainer and ribbons); an egg into the nursery; a part into your parts. A uid
     you already have gets a new one.
   Logic only: no DOM, runs in Node (tools/test/trade.test.mjs). */
/** @import { SaveData, Billy } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { SPECIES } from '../game-data.js';
import { isRobot } from './fighters.js';
import { newUid } from './rules.js';
import { legalBilly, legalEgg, legalPart, onlineCopy } from './online-legal.js';
/* eslint-disable no-func-assign */
expose({
  TRADE_CAP: [() => TRADE_CAP],
  TRADE_COOLDOWN_MS: [() => TRADE_COOLDOWN_MS],
  TRADE_HISTORY_MOST: [() => TRADE_HISTORY_MOST],
  TRADE_STALE_MS: [() => TRADE_STALE_MS],
  TRADE_TEXT_MOST: [() => TRADE_TEXT_MOST],
  // @ts-expect-error -- replaced on purpose
  arrive: [() => arrive, v => (arrive = v)],
  offerGone: [() => offerGone],
  offerId: [() => offerId],
  // @ts-expect-error -- replaced on purpose
  offerNew: [() => offerNew, v => (offerNew = v)],
  // @ts-expect-error -- replaced on purpose
  offerNext: [() => offerNext, v => (offerNext = v)],
  // @ts-expect-error -- replaced on purpose
  offerPatch: [() => offerPatch, v => (offerPatch = v)],
  offerSide: [() => offerSide],
  otherSide: [() => otherSide],
  ownBilly: [() => ownBilly],
  // @ts-expect-error -- replaced on purpose
  tradeAcquire: [() => tradeAcquire, v => (tradeAcquire = v)],
  // @ts-expect-error -- replaced on purpose
  tradeBack: [() => tradeBack, v => (tradeBack = v)],
  // @ts-expect-error -- replaced on purpose
  tradeGive: [() => tradeGive, v => (tradeGive = v)],
  tradeKey: [() => tradeKey],
  // @ts-expect-error -- replaced on purpose
  tradeLabel: [() => tradeLabel, v => (tradeLabel = v)],
  // @ts-expect-error -- replaced on purpose
  tradeLegal: [() => tradeLegal, v => (tradeLegal = v)],
  // @ts-expect-error -- replaced on purpose
  tradeRead: [() => tradeRead, v => (tradeRead = v)],
  // @ts-expect-error -- replaced on purpose
  tradeRecord: [() => tradeRecord, v => (tradeRecord = v)],
  // @ts-expect-error -- replaced on purpose
  tradeTake: [() => tradeTake, v => (tradeTake = v)],
  // @ts-expect-error -- replaced on purpose
  tradeThing: [() => tradeThing, v => (tradeThing = v)],
  // @ts-expect-error -- replaced on purpose
  tradeWhyNot: [() => tradeWhyNot, v => (tradeWhyNot = v)],
  // @ts-expect-error -- replaced on purpose
  uidsOf: [() => uidsOf, v => (uidsOf = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const TRADE_CAP = 3,
  /** a Billie that arrived by trade can't go again for a week (Pokémon GO's guard against re-rolling) */
  TRADE_COOLDOWN_MS = 7 * 86400e3,
  /** an answered-never give can be closed after a week, and taken back */
  TRADE_STALE_MS = 7 * 86400e3,
  /** the trades meta.trades remembers */
  TRADE_HISTORY_MOST = 20,
  /** one thing's JSON text at most (the rules' cap) */
  TRADE_TEXT_MOST = 16000;

/** the pair's offer id: the two uids, the smaller first @param {string} u @param {string} v */
export const offerId = (u, v) => (u < v ? `${u}_${v}` : `${v}_${u}`);
/** which side of the offer I am: 'a', 'b', or '' when it isn't mine @param {any} o @param {string} me */
export const offerSide = (o, me) => (o && o.a === me ? 'a' : o && o.b === me ? 'b' : '');
export const otherSide = s => (s === 'a' ? 'b' : 'a');
/** the key a trade is kept under in meta.trades @param {any} o */
export const tradeKey = o => `${offerId(o.a, o.b)}:${o.k}`;

/** a new offer from me to a friend with my give (the page adds t); null when the give is too long
 * @param {string} me @param {string} myName @param {string} friend @param {any[]} give @param {string} k */
export function offerNew(me, myName, friend, give, k) {
  if (!Array.isArray(give) || give.length > TRADE_CAP || me === friend) return null;
  const [a, b] = me < friend ? [me, friend] : [friend, me],
    s = me === a ? 'a' : 'b',
    o = /** @type {any} */ ({ a, b, na: '', nb: '', ga: [], gb: [], oa: 0, ob: 0 });
  Object.assign(o, { da: false, db: false, ta: 0, tb: 0, ra: false, rb: false, ka: false, kb: false });
  Object.assign(o, { x: '', by: '', v: 1, k: String(k).slice(0, 32) });
  o['n' + s] = String(myName).slice(0, 40);
  o['g' + s] = give;
  return o;
}

/** what I do next with an offer: 'edit' (nobody gave: change my give, ok it, or cancel), 'give' (both ok on this
 * version: my give can go), 'wait' (I gave, they haven't), 'take' (both gave: what came can be checked and taken),
 * 'done' (I received), 'stale' (I gave long ago and they never did: I may close it), 'back' (closed after I gave:
 * mine come back), 'closed' (nothing left for me), or '' (not my offer)
 * @param {any} o @param {string} me @param {number} now */
export function offerNext(o, me, now) {
  const s = offerSide(o, me);
  if (!s) return '';
  const t = otherSide(s);
  if (o.x) return o['d' + s] && !o['k' + s] && (o.x === 'refused' || o.x === 'stale') ? 'back' : 'closed';
  if (o['r' + s]) return 'done';
  if (o['d' + s] && o['d' + t]) return 'take';
  if (o['d' + s]) return now - o['t' + s] > TRADE_STALE_MS ? 'stale' : 'wait';
  if (o.da || o.db) return 'give';
  return o.oa === o.v && o.ob === o.v && o.ga.length && o.gb.length ? 'give' : 'edit';
}

/** the fields a step changes on the offer (the page adds t, and the server's time for ta / tb on 'gave'), or why the
 * rules would refuse it: the rules' twin (firebase/firestore.rules offers)
 * @param {any} o the offer as it stands @param {string} me
 * @param {'give' | 'ok' | 'unok' | 'gave' | 'got' | 'cancel' | 'refuse' | 'stale' | 'back'} step
 * @param {{ give?: any[], name?: string, now?: number }} [arg] @returns {Record<string, any> | string} */
export function offerPatch(o, me, step, arg = {}) {
  const s = offerSide(o, me);
  if (!s) return 'party';
  const t = otherSide(s),
    nobodyGave = !o.x && !o.da && !o.db;
  switch (step) {
    case 'give': {
      if (!nobodyGave) return 'locked';
      const g = arg.give || [];
      if (!Array.isArray(g) || g.length > TRADE_CAP) return 'cap';
      if (g.some(e => !e || !['b', 'e', 'p'].includes(e.k) || typeof e.d !== 'string' || e.d.length > TRADE_TEXT_MOST))
        return 'shape';
      return { ['g' + s]: g, ['n' + s]: String(arg.name ?? o['n' + s]).slice(0, 40), v: o.v + 1 };
    }
    case 'ok':
      return nobodyGave ? { ['o' + s]: o.v } : 'locked';
    case 'unok':
      return nobodyGave ? { ['o' + s]: 0 } : 'locked';
    case 'gave':
      if (o.x) return 'closed';
      if (o.oa !== o.v || o.ob !== o.v || !o.ga.length || !o.gb.length) return 'open';
      return o['d' + s] ? 'twice' : { ['d' + s]: true, ['t' + s]: arg.now ?? 0 };
    case 'got':
      if (o.x) return 'closed';
      if (!o['d' + s] || !o['d' + t]) return 'early';
      return o['r' + s] ? 'twice' : { ['r' + s]: true };
    case 'cancel':
      return nobodyGave ? { x: 'cancel', by: me } : 'locked';
    case 'refuse':
      if (o.x) return 'closed';
      return o['d' + t] && !o['r' + t] && !o['r' + s] ? { x: 'refused', by: me } : 'late';
    case 'stale':
      if (o.x) return 'closed';
      if (!o['d' + s] || o['d' + t]) return 'late';
      return (arg.now ?? 0) - o['t' + s] > TRADE_STALE_MS ? { x: 'stale', by: me } : 'early';
    case 'back':
      if (o.x !== 'refused' && o.x !== 'stale') return 'open';
      return o['d' + s] && !o['k' + s] ? { ['k' + s]: true } : 'twice';
  }
  return 'step';
}

/** whether the offer can be deleted (the rules' delete): both received, cancelled, or closed with every giver's
 * things back @param {any} o */
export const offerGone = o =>
  (o.ra && o.rb) || o.x === 'cancel' || ((o.x === 'refused' || o.x === 'stale') && (!o.da || o.ka) && (!o.db || o.kb));

/* ---------- the save's side ---------- */

/** the Billie of yours with this uid (team or storage) @param {SaveData} s @param {string} uid */
export const ownBilly = (s, uid) => s.team.find(m => m.uid === uid) || s.box.find(m => m.uid === uid) || null;

/** why a thing can't go in a trade, or '' when it can
 * @param {SaveData} s @param {'b' | 'e' | 'p'} k @param {string} uid @param {number} now */
export function tradeWhyNot(s, k, uid, now) {
  if (s.run) return 'run';
  if (k === 'b') {
    const m = ownBilly(s, uid);
    if (!m) return 'missing';
    if (isRobot(m)) return 'robot';
    if (s.team.includes(m) && s.team.length <= 1) return 'last';
    if (m.traded && now - m.traded.at < TRADE_COOLDOWN_MS) return 'cooldown';
    return '';
  }
  if (k === 'e') {
    const n = s.ranch.nursery.find(x => x.egg && x.egg.uid === uid);
    if (!n) return 'missing';
    return now >= n.ready ? '' : 'egg';
  }
  if (k === 'p') return (s.parts || []).some(p => p.uid === uid) ? '' : 'missing';
  return 'kind';
}

/** a thing as it goes in an offer ({ k, d: its online copy as JSON text }), or null when it can't go: a Billie's
 * online copy (onlineCopy, stamped with me as its original trainer when it has none); an egg's nursery entry with
 * its Billie's copy, unstamped (whoever hatches it is its trainer); a part as it is
 * @param {SaveData} s @param {'b' | 'e' | 'p'} k @param {string} uid @param {{ u: string, n: string }} me
 * @param {number} now */
export function tradeThing(s, k, uid, me, now) {
  if (tradeWhyNot(s, k, uid, now)) return null;
  /** @type {any} */
  let d = null;
  if (k === 'b') d = onlineCopy(ownBilly(s, uid), me);
  else if (k === 'e') {
    const n = /** @type {any} */ (s.ranch.nursery.find(x => x.egg && x.egg.uid === uid));
    d = { a: n.a, b: n.b, mode: n.mode, at: n.at, ready: n.ready, egg: onlineCopy(n.egg) };
  } else {
    const p = /** @type {any} */ ((s.parts || []).find(q => q.uid === uid));
    d = { uid: p.uid, id: p.id, up: p.up || 0 };
  }
  const text = JSON.stringify(d);
  return d && text.length <= TRADE_TEXT_MOST ? { k, d: text } : null;
}

/** a thing read back from an offer: its value, or a reason word when it isn't one the game makes @param {any} e
 * @returns {{ k: 'b' | 'e' | 'p', v: any } | string} */
export function tradeRead(e) {
  if (!e || typeof e.d !== 'string' || e.d.length > TRADE_TEXT_MOST) return 'shape';
  let v;
  try {
    v = JSON.parse(e.d);
  } catch {
    return 'json';
  }
  const why = e.k === 'b' ? legalBilly(v) : e.k === 'e' ? legalEgg(v) : e.k === 'p' ? legalPart(v) : 'kind';
  return why || { k: e.k, v };
}

/** '' when every thing of a give is one the game makes, else the first reason @param {any[]} give */
export function tradeLegal(give) {
  if (!Array.isArray(give) || give.length > TRADE_CAP) return 'cap';
  for (const e of give) {
    const r = tradeRead(e);
    if (typeof r === 'string') return r;
  }
  return '';
}

/** what the history keeps of a thing: its kind, species (a part: its id), level (a part: its upgrade), nickname
 * @param {any} e @returns {{ k: string, sp: string, lvl: number, nick?: string }} */
export function tradeLabel(e) {
  const r = tradeRead(e);
  if (typeof r === 'string') return { k: e && e.k ? String(e.k).slice(0, 1) : '?', sp: '?', lvl: 0 };
  const v = r.k === 'e' ? r.v.egg : r.v;
  if (r.k === 'p') return { k: 'p', sp: v.id, lvl: v.up || 0 };
  return v.nick ? { k: r.k, sp: v.sp, lvl: v.lvl, nick: v.nick } : { k: r.k, sp: v.sp, lvl: v.lvl };
}

/** the trade's record in meta.trades, made when it's first needed @param {SaveData} s @param {any} o
 * @param {string} me @param {number} now */
export function tradeRecord(s, o, me, now) {
  const key = tradeKey(o),
    list = s.meta.trades,
    had = list.find(x => x.k === key);
  if (had) return had;
  const t = otherSide(offerSide(o, me)),
    /** @type {import('../../types/save-data').MetaTrade} */
    r = {
      k: key,
      at: Math.max(0, Math.floor(now)),
      u: String(o[t]).slice(0, 128),
      n: String(o['n' + t]).slice(0, 40),
      st: 'open',
      gave: [],
      got: [],
    };
  list.unshift(r);
  list.length = Math.min(list.length, TRADE_HISTORY_MOST);
  return r;
}

/** my give leaves the save (step 'gave'): each thing by its uid, from wherever it is; a Billie's held item stays in
 * the bag. Once per trade (meta.trades); false when it was done already @param {SaveData} s @param {any} o
 * @param {string} me @param {number} now */
export function tradeGive(s, o, me, now) {
  const r = tradeRecord(s, o, me, now);
  if (r.st !== 'open') return false;
  const give = o['g' + offerSide(o, me)];
  for (const e of give) {
    /* by uid, whether or not it passes the check: it's mine, and it leaves */
    let x;
    try {
      x = { k: e.k, v: JSON.parse(e.d) };
    } catch {
      continue;
    }
    if (!x.v || typeof x.v !== 'object') continue;
    if (x.k === 'b') {
      const m = ownBilly(s, x.v.uid);
      if (m && m.held) s.items[m.held] = (s.items[m.held] || 0) + 1;
      s.team = s.team.filter(q => q.uid !== x.v.uid);
      s.box = s.box.filter(q => q.uid !== x.v.uid);
      s.ranch.pens = s.ranch.pens.filter(u => u !== x.v.uid);
      s.ranch.trainees = s.ranch.trainees.filter(t => t.uid !== x.v.uid);
    } else if (x.k === 'e')
      s.ranch.nursery = s.ranch.nursery.filter(n => !n.egg || !x.v.egg || n.egg.uid !== x.v.egg.uid);
    else if (x.k === 'p') s.parts = (s.parts || []).filter(p => p.uid !== x.v.uid);
  }
  r.gave = give.map(tradeLabel);
  r.st = 'gave';
  return true;
}

/** every uid the save uses (Billies, eggs, parts, worn parts) @param {SaveData} s */
export function uidsOf(s) {
  const out = new Set();
  for (const m of [...s.team, ...s.box, ...s.ranch.nursery.map(n => n.egg)]) {
    if (!m) continue;
    out.add(m.uid);
    for (const p of Object.values(/** @type {any} */ (m).aug || {})) out.add(p.uid);
  }
  for (const p of s.parts || []) out.add(p.uid);
  return out;
}

/** things arrive in the save: each one checked again (a thing that fails stops the whole give: nothing is taken);
 * a Billie to storage, marked traded from `from`; an egg to the nursery; a part to your parts; a uid you have gets a
 * new one. Returns the Billies that arrived (the page offers an `acquire` evolution, tradeAcquire), [] when it was
 * done already, or why not @param {SaveData} s @param {any[]} give @param {string} from @param {number} now
 * @param {() => string} [uidMaker] @returns {Billy[] | string} */
export function arrive(s, give, from, now, uidMaker = newUid) {
  const read = give.map(tradeRead),
    bad = read.find(x => typeof x === 'string');
  if (bad) return /** @type {string} */ (bad);
  const have = uidsOf(s),
    fresh = u => {
      if (!have.has(u)) {
        have.add(u);
        return u;
      }
      let n = uidMaker();
      while (have.has(n)) n = uidMaker();
      have.add(n);
      return n;
    },
    at = Math.max(0, Math.floor(now)),
    /** @type {Billy[]} */
    came = [];
  for (const x of /** @type {{ k: string, v: any }[]} */ (read)) {
    if (x.k === 'p') {
      s.parts.push({ uid: fresh(x.v.uid), id: x.v.id, up: x.v.up || 0 });
      continue;
    }
    const m = x.k === 'e' ? x.v.egg : x.v;
    m.uid = fresh(m.uid);
    for (const p of Object.values(m.aug || {})) /** @type {any} */ (p).uid = fresh(/** @type {any} */ (p).uid);
    if (x.k === 'e') {
      s.ranch.nursery.push({ a: x.v.a, b: x.v.b, mode: x.v.mode, at: x.v.at, ready: x.v.ready, egg: m });
      continue;
    }
    m.traded = { at, from: String(from).slice(0, 128) };
    m.boxedAt = at;
    s.box.push(m);
    s.seen[m.sp] = 1;
    s.caught[m.sp] = 1;
    came.push(m);
  }
  return came;
}

/** the other side's give arrives (step 'got'), once per trade @param {SaveData} s @param {any} o @param {string} me
 * @param {number} now @param {() => string} [uidMaker] @returns {Billy[] | string} the Billies that came, or why
 * not ('twice' when it was done already) */
export function tradeTake(s, o, me, now, uidMaker) {
  const r = tradeRecord(s, o, me, now),
    side = offerSide(o, me);
  if (r.st === 'done' || r.st === 'back') return 'twice';
  const t = otherSide(side),
    came = arrive(s, o['g' + t], o[t], now, uidMaker);
  if (typeof came === 'string') return came;
  r.got = o['g' + t].map(tradeLabel);
  if (!r.gave.length) r.gave = o['g' + side].map(tradeLabel);
  r.st = 'done';
  return came;
}

/** my give comes back after a refused or stale close (step 'back'), once per trade; as the online copies (full HP,
 * the XP of their level), no traded mark @param {SaveData} s @param {any} o @param {string} me @param {number} now
 * @param {() => string} [uidMaker] @returns {boolean | string} */
export function tradeBack(s, o, me, now, uidMaker) {
  const r = tradeRecord(s, o, me, now);
  if (r.st === 'back' || r.st === 'done') return false;
  const came = arrive(s, o['g' + offerSide(o, me)], me, now, uidMaker);
  if (typeof came === 'string') return came;
  for (const m of came) delete m.traded;
  r.st = 'back';
  return true;
}

/** whether a Billie that just arrived by trade evolves by being acquired (its species' evolution is `acquire` and
 * it has the level) @param {any} m */
export function tradeAcquire(m) {
  const S = m && SPECIES[m.sp],
    e = S && S.evo;
  return !!(e && e.k === 'acquire' && S.next && m.lvl >= (e.min || 1));
}
