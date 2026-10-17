'use strict';
/* ================= CORE ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import { rnd } from './util.js';
import {
  ADJ,
  COINS,
  EGGS,
  EGG_TIERS,
  ITEMS,
  JOBS,
  JOB_STEPS,
  LINES,
  LN,
  MOVES,
  POOLS,
  ROUTE,
  RULES,
  SP,
  START_NODE,
  STATK,
  STEPS_PER_KM,
  TRAINERS,
  eff,
  linkCost,
  trainersAt,
} from './data.js';
/* eslint-disable no-func-assign */
expose({
  ACC_ID: [() => ACC_ID],
  B: [() => B, v => (B = v)],
  BR: [() => BR],
  EGG_SLOTS: [() => EGG_SLOTS],
  JOB_SLOTS: [() => JOB_SLOTS],
  LS: [() => LS],
  LS_ACC: [() => LS_ACC],
  LS_BASE: [() => LS_BASE],
  MAXLV: [() => MAXLV],
  N: [() => N],
  RM: [() => RM, v => (RM = v)],
  S: [() => S, v => (S = v)],
  SAVE_FOUND: [() => SAVE_FOUND],
  SAVE_HOLD: [() => SAVE_HOLD, v => (SAVE_HOLD = v)],
  SAVE_NEW_MSG: [() => SAVE_NEW_MSG],
  SAVE_OLD_MSG: [() => SAVE_OLD_MSG],
  SAVE_VERSION: [() => SAVE_VERSION],
  SLOTS: [() => SLOTS],
  TEAM_MAX: [() => TEAM_MAX],
  U: [() => U],
  addEgg: [() => addEgg, v => (addEgg = v)],
  addMon: [() => addMon, v => (addMon = v)],
  addSteps: [() => addSteps, v => (addSteps = v)],
  allMons: [() => allMons],
  areaPool: [() => areaPool, v => (areaPool = v)],
  assignJob: [() => assignJob, v => (assignJob = v)],
  autoSlot: [() => autoSlot, v => (autoSlot = v)],
  blockerAt: [() => blockerAt, v => (blockerAt = v)],
  canEnter: [() => canEnter],
  canLeave: [() => canLeave],
  canRide: [() => canRide],
  cleanName: [() => cleanName],
  collectJob: [() => collectJob, v => (collectJob = v)],
  emptyJob: [() => emptyJob],
  endShift: [() => endShift, v => (endShift = v)],
  esc: [() => esc],
  evoHint: [() => evoHint, v => (evoHint = v)],
  evoItemName: [() => evoItemName],
  evoReady: [() => evoReady, v => (evoReady = v)],
  evolve: [() => evolve, v => (evolve = v)],
  findMon: [() => findMon],
  flush: [() => flush, v => (flush = v)],
  fmt: [() => fmt],
  fresh: [() => fresh, v => (fresh = v)],
  freshKeep: [() => freshKeep, v => (freshKeep = v)],
  gainXp: [() => gainXp, v => (gainXp = v)],
  gateMsg: [() => gateMsg, v => (gateMsg = v)],
  gateOwner: [() => gateOwner, v => (gateOwner = v)],
  gateText: [() => gateText, v => (gateText = v)],
  hatchEgg: [() => hatchEgg, v => (hatchEgg = v)],
  hatchable: [() => hatchable],
  healAll: [() => healAll, v => (healAll = v)],
  hereStop: [() => hereStop],
  km: [() => km],
  loadSave: [() => loadSave, v => (loadSave = v)],
  lsGet: [() => lsGet, v => (lsGet = v)],
  lsSet: [() => lsSet, v => (lsSet = v)],
  makeMon: [() => makeMon, v => (makeMon = v)],
  maxHp: [() => maxHp],
  migrate: [() => migrate, v => (migrate = v)],
  movesAt: [() => movesAt, v => (movesAt = v)],
  nextBracket: [() => nextBracket],
  nextStop: [() => nextStop],
  pathFrom: [() => pathFrom],
  pickW: [() => pickW, v => (pickW = v)],
  plural: [() => plural],
  rate: [() => rate],
  resumeTrip: [() => resumeTrip, v => (resumeTrip = v)],
  riderName: [() => riderName],
  riderOf: [() => riderOf, v => (riderOf = v)],
  rollDay: [() => rollDay, v => (rollDay = v)],
  routeDists: [() => routeDists, v => (routeDists = v)],
  save: [() => save, v => (save = v)],
  saveAge: [() => saveAge, v => (saveAge = v)],
  saveT: [() => saveT, v => (saveT = v)],
  setTrip: [() => setTrip, v => (setTrip = v)],
  spawn: [() => spawn, v => (spawn = v)],
  splitPath: [() => splitPath, v => (splitPath = v)],
  stat: [() => stat, v => (stat = v)],
  stopTrip: [() => stopTrip, v => (stopTrip = v)],
  taxed: [() => taxed, v => (taxed = v)],
  toBox: [() => toBox, v => (toBox = v)],
  toTeam: [() => toTeam, v => (toTeam = v)],
  today: [() => today],
  traveling: [() => traveling],
  tripTo: [() => tripTo, v => (tripTo = v)],
  uid: [() => uid],
  walkMode: [() => walkMode],
  xpFor: [() => xpFor],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* phase 02: a name the player typed, or that came from a backup file or a friend, loses the characters that could
   end a piece of HTML (< > " & `) and control characters, so it is safe in any page text or attribute */
export const cleanName = (s, max) =>
  String(s == null ? '' : s)
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f<>"&`]/g, '')
    .trim()
    .slice(0, max);
export const fmt = n => Math.floor(n).toLocaleString('en-US');
export const km = st => (st / STEPS_PER_KM).toFixed(1);
export let RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const uid = () => 'm' + Date.now().toString(36) + Math.floor(rnd() * 1e8).toString(36);
export const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
export const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
export function pickW(list) {
  const tot = list.reduce((a, b) => a + b[1], 0);
  let r = rnd() * tot;
  for (const [id, w] of list) {
    r -= w;
    if (r <= 0) return id;
  }
  return list[0][0];
}

/* ---------- state ---------- */
export const xpFor = L => Math.floor(RULES.progression.xpFactor * L * L * L);
export const MAXLV = () => RULES.progression.maxLevel,
  SLOTS = () => RULES.progression.moveSlots,
  TEAM_MAX = () => RULES.progression.teamSize;
const JOB_SLOTS = () => Math.max(1, RULES.jobs.positions || 3);
const emptyJob = () => ({ uid: null, job: null, acc: 0, pend: 0 });
export function fresh() {
  const R = RULES.start,
    coins = {},
    items = {};
  Object.keys(COINS).forEach(k => (coins[k] = 0));
  Object.keys(ITEMS).forEach(k => (items[k] = 0));
  Object.assign(coins, R.coins);
  Object.assign(items, R.items);
  return {
    v: 4,
    saveVersion: SAVE_VERSION,
    gameVersion: PB_VERSION,
    avatar: null,
    preferences: { theme: 'system', motion: 'system', fps: 60, effects: 'full' },
    started: false,
    gender: null,
    starter: null,
    team: [],
    box: [],
    seen: {},
    caught: {},
    se: R.se,
    seFrac: 0,
    coins,
    items,
    day: { date: today(), steps: 0 },
    totalSteps: 0,
    route: { node: START_NODE, prog: 0, plan: [], hold: false },
    mapSeen: null,
    meter: 0,
    queue: [],
    buddy: null,
    buddyRem: 0,
    flags: {},
    seats: [],
    visited: { [START_NODE]: 1 },
    serial: 300,
    eggs: [],
    jobs: Array.from({ length: JOB_SLOTS() }, emptyJob),
    savedAt: 0,
    /* trainer card: ID number, start date (0 = unknown, older saves) and eggs hatched */
    tid: 10000 + Math.floor(rnd() * 90000),
    since: 0,
    hatched: 0,
  };
}
/* a new game on the same device keeps its settings (theme, motion, effects, sound…) */
export function freshKeep() {
  const p = typeof S !== 'undefined' && S && S.preferences,
    f = fresh();
  if (p) f.preferences = Object.assign(f.preferences, JSON.parse(JSON.stringify(p)));
  return f;
}
/* alpha 0.4.1: saves only need to work with this version. A save is filled out with anything new and checked against
   the game data (things the Studio may have removed are dropped), but old formats are no longer converted */
export function migrate(o) {
  if (!o || typeof o !== 'object') return null;
  const f = fresh();
  const s = Object.assign(f, o);
  const zero = obj => Object.fromEntries(Object.keys(obj).map(k => [k, 0]));
  s.coins = Object.assign(zero(COINS), o.coins || {});
  s.items = Object.assign(zero(ITEMS), o.items || {});
  s.flags = o.flags || {};
  const p = (s.preferences = Object.assign(
    { theme: 'system', motion: 'system', fps: 60, effects: 'full' },
    o.preferences || {}
  ));
  if (![30, 60, 90, 120].includes(+p.fps)) p.fps = 60;
  if (p.aim !== 'smooth') p.aim = 'sharp';
  p.effects = 'full';
  p.fps = +p.fps;
  if (!Array.isArray(s.eggs)) s.eggs = [];
  if (!Array.isArray(s.jobs)) s.jobs = [];
  while (s.jobs.length < JOB_SLOTS()) s.jobs.push(emptyJob());
  while (s.jobs.length > JOB_SLOTS()) {
    const j = s.jobs.pop();
    const m = [...(s.team || []), ...(s.box || [])].find(x => x.uid === j.uid);
    if (m) {
      m.job = null;
      m.boxedAt = Date.now();
    }
  }
  if (!SP[s.starter + '0'] && s.started) s.starter = RULES.start.starters.find(l => SP[l + '0']) || LINES[0].id;
  s.team = (s.team || []).filter(m => SP[m.sp]);
  s.box = (s.box || []).filter(m => SP[m.sp]);
  [...s.team, ...s.box].forEach(m => {
    if (m.nick != null) m.nick = cleanName(m.nick, 16);
  });
  if (s.avatar && typeof s.avatar === 'object' && 'name' in s.avatar)
    s.avatar.name = cleanName(s.avatar.name, 18) || 'Trainer';
  [...s.team, ...s.box].forEach(m => {
    m.moves = (m.moves || []).filter(k => MOVES[k]);
    if (!m.moves.length) m.moves = movesAt(SP[m.sp].line, m.lvl);
  });
  for (const key of ['seen', 'caught'])
    if (s[key] && typeof s[key] === 'object') for (const id of Object.keys(s[key])) if (!SP[id]) delete s[key][id];
  s.queue = (s.queue || []).filter(q => SP[q.sp]);
  s.eggs = s.eggs.filter(e => EGGS[e.tier]);
  s.jobs.forEach(j => {
    if (j.job && !JOBS[j.job]) j.job = Object.keys(JOBS)[0] || null;
  });
  if (!s.route || !ROUTE[s.route.node]) s.route = { node: START_NODE, prog: 0, plan: [] };
  s.route.plan = (Array.isArray(s.route.plan) ? s.route.plan : []).filter(x => ROUTE[x]);
  if (s.route.plan.length && !linkCost(s.route.node, s.route.plan[0])) {
    s.route.plan = [];
    s.route.prog = 0;
  }
  s.route.hold = !!s.route.hold;
  if (!s.visited || typeof s.visited !== 'object') s.visited = {};
  s.visited[s.route.node] = 1;
  if (s.started && !s.team.length && !s.box.length) return fresh();
  s.v = 4;
  s.saveVersion = SAVE_VERSION;
  s.gameVersion = PB_VERSION;
  return s;
}
/* phase 02: every save says which save format it is (saveVersion; raise it when old saves can't be read any more).
   A save without one (alpha 0.5 and earlier) or from a newer format is not loaded: the game says so and starts fresh.
   saveAge: null (no save), 'ok', 'old' or 'new'. A newer save is never written over (SAVE_HOLD) */
export const SAVE_VERSION = 1;
let SAVE_HOLD = false;
export function saveAge(o) {
  if (!o || typeof o !== 'object') return null;
  const v = o.saveVersion;
  return v === SAVE_VERSION ? 'ok' : Number.isInteger(v) && v > SAVE_VERSION ? 'new' : 'old';
}
export function loadSave(o) {
  return saveAge(o) === 'ok' ? migrate(o) : null;
}
export const SAVE_OLD_MSG = 'This save is from an older version of the game and can’t be loaded in this one.',
  SAVE_NEW_MSG = 'This save is from a newer version of the game. Reload the page to get the newest version.';
/* alpha 0.4.1: one save per player. Without an account the save lives in this browser (the original key); a player who
   signs in with Google (js/account.js) gets their own save, kept online and copied in this browser under their id */
export const LS_BASE = 'networth-save-v1',
  LS_ACC = 'pb-account';
export const ACC_ID = (() => {
  try {
    return localStorage.getItem(LS_ACC) || '';
  } catch (e) {
    return '';
  }
})();
export const LS = ACC_ID ? LS_BASE + '-u-' + ACC_ID : LS_BASE;
function lsGet() {
  try {
    return JSON.parse(localStorage.getItem(LS) || 'null');
  } catch (e) {
    return null;
  }
}
export function lsSet(o) {
  if (SAVE_HOLD) return;
  try {
    localStorage.setItem(LS, JSON.stringify(o));
  } catch (e) {
    if (typeof U !== 'undefined' && !U.saveWarning) {
      U.saveWarning = true;
      setTimeout(() => toast('Browser storage is full or unavailable. Export a save backup from Settings.'), 0);
    }
  }
}
/* a save here that this version can't load is kept aside in this browser (once), and the title says why it's a new game */
export const SAVE_FOUND = saveAge(lsGet());
if (SAVE_FOUND === 'old' || SAVE_FOUND === 'new')
  try {
    const k = LS + '-set-aside';
    if (localStorage.getItem(k) == null) localStorage.setItem(k, localStorage.getItem(LS));
  } catch (e) {}
if (SAVE_FOUND === 'new') SAVE_HOLD = true;
export let S = loadSave(lsGet()) || fresh();
export let B = null;
export const U = {
  tab: 'walk',
  lastTab: null,
  intro: 0,
  modal: null,
  mq: [],
  learnQ: [],
  toastQ: [],
  toastOn: false,
  evT: null,
  throwing: false,
  disp: { steps: null, se: null },
  seenEnc: new Set(),
  mapSel: null,
};

/* ---------- saving: in this browser, and on the account when signed in (account.js) ---------- */
let saveT = null;
export function save() {
  S.savedAt = Date.now();
  lsSet(S);
  if (!saveT)
    saveT = setTimeout(() => {
      saveT = null;
      flush();
    }, 4000);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveT) {
    clearTimeout(saveT);
    saveT = null;
    flush();
  }
});
export function flush() {
  if (SAVE_HOLD) return;
  if (typeof accFlush === 'function') accFlush();
}

/* ---------- billionaires ---------- */
export function stat(m, k) {
  const b = SP[m.sp].base[STATK.indexOf(k)];
  let v = k === 'hp' ? Math.floor((2 * b * m.lvl) / 100) + m.lvl + 10 : Math.floor((2 * b * m.lvl) / 100) + 5;
  /* v33: an Alpha in battle is much tougher (m.boss); one you caught keeps a little of it (m.alpha) */
  if (m.boss) v = Math.floor(v * (k === 'hp' ? m.boss.hp : m.boss.st));
  else if (m.alpha) v = Math.floor(v * ((RULES.battle && RULES.battle.alphaKeep) ?? 1.08));
  return v;
}
export const maxHp = m => stat(m, 'hp');
function movesAt(lid, lvl) {
  const out = [];
  for (const [lv, mv] of LN[lid].learn) if (lv <= lvl && !out.includes(mv)) out.push(mv);
  return out.slice(-SLOTS());
}
/* alpha 0.5: a Billie remembers where and when it joined you (shown in its details) */
export function makeMon(sp, lvl, o = {}) {
  const m = {
    uid: uid(),
    sp,
    lvl,
    xp: xpFor(lvl),
    hp: 0,
    status: null,
    sTurns: 0,
    moves: movesAt(SP[sp].line, lvl),
    gold: !!o.gold,
    nick: '',
  };
  m.hp = maxHp(m);
  try {
    if (typeof S !== 'undefined' && S && S.route && ROUTE[S.route.node])
      m.met = { n: ROUTE[S.route.node].id || S.route.node, t: Date.now() };
  } catch (e) {}
  return m;
}
export const N = m => m.nick || SP[m.sp].name;
export const allMons = () => S.team.concat(S.box);
export const findMon = id => allMons().find(m => m.uid === id);
export function gainXp(m, amt, say) {
  if (m.lvl >= MAXLV() || amt <= 0) return;
  m.xp += amt;
  while (m.lvl < MAXLV() && m.xp >= xpFor(m.lvl + 1)) {
    const old = maxHp(m);
    m.lvl++;
    if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + maxHp(m) - old);
    say(`${N(m)} grew to level ${m.lvl}.`, { k: 'lvl', uid: m.uid });
    for (const [lv, mv] of LN[SP[m.sp].line].learn) {
      if (lv !== m.lvl || m.moves.includes(mv)) continue;
      if (m.moves.length < SLOTS()) {
        m.moves.push(mv);
        say(`${N(m)} learned ${MOVES[mv].n}.`);
      } else U.learnQ.push({ uid: m.uid, mv });
    }
  }
}
export function evoReady(m) {
  const e = SP[m.sp].evo;
  if (!e) return false;
  if (m.evoNo != null && m.lvl <= m.evoNo) return false;
  switch (e.k) {
    case 'lvl':
    case 'split':
      return m.lvl >= e.at;
    case 'buddy':
      return (m.bsteps || 0) >= e.steps;
    case 'idle':
      return !!m.boxedAt && !m.job && S.box.includes(m) && Date.now() - m.boxedAt >= e.ms && m.lvl >= e.min;
    case 'streak':
      return (m.streak || 0) >= e.n && m.lvl >= e.min;
    default:
      return false;
  }
}
export const evoItemName = e => (ITEMS[e.item || 'bell'] ? ITEMS[e.item || 'bell'].n : 'Shining Stone');
export function evoHint(m) {
  const s = SP[m.sp],
    e = s.evo;
  if (!e) return s.rar === 'mythical' ? 'Does not evolve.' : 'Fully evolved.';
  const nx = SP[s.next],
    nm = S.seen[nx.id] ? nx.name : 'something bigger';
  switch (e.k) {
    case 'lvl':
      return `Evolves at level ${e.at} into ${nm}.`;
    case 'split': {
      const alt = SP[s.alt],
        an = alt && S.seen[alt.id] ? alt.name : 'something else';
      return `Evolves at level ${e.at} into ${nm} or ${an}: ${splitPath(m) === 'A' ? 'the Build path is ahead' : 'the Hype path is ahead'} (${m.wins || 0} battles won, ${km(m.bsteps || 0)} km walked as buddy${m.psteps ? ` + ${km((m.psteps || 0) / 2)} km in the party at half weight` : ''}).`;
    }
    case 'buddy':
      return `Evolves after you walk ${km(e.steps)} km with it as your buddy. ${km(m.bsteps || 0)} of ${km(e.steps)} km so far.`;
    case 'item':
      return `Evolves when you use ${/^[AEIOU]/.test(evoItemName(e)) ? 'an' : 'a'} ${evoItemName(e)}, once it reaches level ${e.min}.`;
    case 'donate':
      return `Evolves after it gives away ${e.n} items, once it reaches level ${e.min}. ${m.donated || 0} of ${e.n} given.`;
    case 'merge':
      return `Evolves by combining with another ${s.name}, once it reaches level ${e.min}.`;
    case 'idle':
      return `Evolves after resting a full day in storage, once it reaches level ${e.min}.`;
    case 'streak':
      return `Evolves after winning ${e.n} battles in a row as your lead, once it reaches level ${e.min}. Streak: ${m.streak || 0}.`;
    case 'rename':
      return `Evolves when you give it a new nickname, once it reaches level ${e.min}.`;
  }
  return '';
}
/* v36: which final a split line takes: Build (A) when the kilometres it walked as your buddy outweigh the battles it won
   (1 km counts as one win), Hype (B) otherwise. A tie goes to Build. */
export function splitPath(m) {
  const wins = m.wins || 0,
    kmW = ((m.bsteps || 0) + (m.psteps || 0) / 2) / STEPS_PER_KM;
  return wins > kmW ? 'B' : 'A';
}
export function evolve(m) {
  if (typeof jingle === 'function') jingle(JINGLES.evolve, 140);
  const old = maxHp(m),
    from = N(m),
    s0 = SP[m.sp];
  m.sp = s0.evo && s0.evo.k === 'split' && s0.alt && splitPath(m) === 'B' ? s0.alt : s0.next;
  if (m.hp > 0) m.hp = Math.max(1, Math.min(maxHp(m), m.hp + maxHp(m) - old));
  S.caught[m.sp] = 1;
  S.seen[m.sp] = 1;
  m.evoNo = null;
  m.streak = 0;
  m.donated = 0;
  return from;
}
export function healAll() {
  if (typeof sfx === 'function') sfx('heal');
  for (const m of allMons()) {
    m.hp = maxHp(m);
    m.status = null;
    m.sTurns = 0;
  }
}
export function toBox(m) {
  const i = S.team.indexOf(m);
  if (i >= 0) S.team.splice(i, 1);
  if (!S.box.includes(m)) S.box.push(m);
  m.boxedAt = Date.now();
}
export function toTeam(m) {
  const i = S.box.indexOf(m);
  if (i >= 0) S.box.splice(i, 1);
  if (!S.team.includes(m)) S.team.push(m);
  m.boxedAt = null;
}
export function addMon(m) {
  S.caught[m.sp] = 1;
  S.seen[m.sp] = 1;
  if (S.team.length < TEAM_MAX()) {
    S.team.push(m);
    return 'team';
  }
  m.boxedAt = Date.now();
  S.box.push(m);
  return 'box';
}

/* ---------- steps ---------- */
export const BR = RULES.steps.brackets.map(b => [b.upTo > 0 ? b.upTo : Infinity, b.rate]).sort((a, b) => a[0] - b[0]);
if (!BR.length || BR[BR.length - 1][0] !== Infinity) BR.push([Infinity, BR.length ? BR[BR.length - 1][1] : 1]);
function taxed(a, b) {
  let se = 0,
    lo = 0;
  for (const [hi, r] of BR) {
    const s = Math.max(a, lo),
      e = Math.min(b, hi);
    if (e > s) se += (e - s) * r;
    lo = hi;
  }
  return se;
}
export const rate = st => {
  for (const [hi, r] of BR) if (st < hi) return r;
  return BR[BR.length - 1][1];
};
export const nextBracket = st => BR.find(([hi]) => st < hi);
export function rollDay() {
  if (S.day.date !== today()) S.day = { date: today(), steps: 0 };
}
function gateOwner(seat) {
  return Object.values(TRAINERS).find(T => T.seat && T.seat.id === seat);
}
export function gateText(n) {
  if (n.gate && !S.seats.includes(n.gate) && n.gateText) return n.gateText;
  if (n.ride && !canRide()) {
    const R = RULES.ride || { minHeight: 1.5 };
    return `To cross ${n.name} you need a Water Billie at least ${R.minHeight || 1.5} m tall in your team to ride on. Quant and Billigator are big enough.`;
  }
  if (n.gateText) return n.gateText;
  const T = gateOwner(n.gate);
  return `${n.name} opens once you earn ${T ? T.name + '’s' : 'another'} badge.`;
}
export function blockerAt(i) {
  return trainersAt(i).find(T => T.blocks && !S.flags[T.id]) || null;
}
/* ---------- travel: a plan of stops to walk to, one link at a time; an empty plan means staying put ---------- */
/* v24: lake and sea roads need a Water billionaire big enough to ride (rules.ride: types, minHeight in metres) */
function riderOf() {
  const R = RULES.ride || { minHeight: 1.5, types: ['Water'] };
  let best = null;
  for (const m of S.team) {
    const sp = SP[m.sp];
    if (!sp || !sp.types.some(t => (R.types || ['Water']).includes(t)) || sp.ht < (R.minHeight || 1.5)) continue;
    if (!best || sp.ht > SP[best.sp].ht) best = m;
  }
  return best;
}
export const canRide = () => !!riderOf();
export const riderName = () => {
  const m = riderOf();
  return m ? m.nick || SP[m.sp].name : '';
};
export const canEnter = n => (!ROUTE[n].gate || S.seats.includes(ROUTE[n].gate)) && (!ROUTE[n].ride || canRide());
const canLeave = (from, to) => !blockerAt(from) || !!S.visited[to];
export const nextStop = () => (S.route.plan.length ? S.route.plan[0] : null);
/* alpha 0.4.1: how you get about (rules.travel). 'walk': you walk yourself, with the joystick, the d-pad or a tap, from
   place to place across their edges, like a classic RPG; the steps you take in the game count as steps (encounters,
   challenges, your buddy). 'steps': your real steps carry you along the roads (the game until 0.4). */
export const walkMode = () => ((typeof RULES !== 'undefined' && RULES.travel) || 'walk') === 'walk';
const traveling = () => !walkMode() && nextStop() != null && !S.route.hold && !gateMsg();
/* why travel can't continue right now (null when it can, or when you're staying) */
export function gateMsg() {
  const node = S.route.node,
    nx = nextStop();
  if (nx == null) return null;
  if (S.route.prog === 0 && !canLeave(node, nx)) {
    const bl = blockerAt(node);
    return bl.blockTitle || `${bl.name} is blocking the way.`;
  }
  if (!canEnter(nx)) return gateText(ROUTE[nx]);
  return null;
}
/* shortest walk (in steps) between stops, entering only stops you may enter; returns {d,prev} */
function routeDists(from) {
  const N = ROUTE.length,
    d = Array(N).fill(Infinity),
    prev = Array(N).fill(-1),
    done = Array(N).fill(false);
  d[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const e of ADJ[u]) {
      if (!canEnter(e.to)) continue;
      if (u !== from && blockerAt(u) && !S.visited[e.to]) continue;
      const nd = d[u] + e.cost;
      if (nd < d[e.to]) {
        d[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }
  return { d, prev };
}
const pathFrom = (prev, to) => {
  const out = [];
  for (let x = to; x >= 0 && prev[x] >= 0; x = prev[x]) out.unshift(x);
  return out;
};
/* steps from where you stand to stop j, and the plan that gets there (turning back on the current link if shorter) */
export function tripTo(j) {
  const r = S.route,
    node = r.node,
    nx = nextStop();
  if (nx == null || r.prog === 0) {
    if (j === node && nx == null) return { steps: 0, plan: [], back: false };
    const D = routeDists(node);
    if (D.d[j] === Infinity) return null;
    return { steps: D.d[j], plan: pathFrom(D.prev, j), back: false };
  }
  const c = linkCost(node, nx),
    A = routeDists(nx),
    Bk = routeDists(node),
    fwd = c - r.prog + A.d[j],
    back = r.prog + Bk.d[j];
  if (fwd === Infinity && back === Infinity) return null;
  return fwd <= back
    ? { steps: fwd, plan: [nx, ...pathFrom(A.prev, j)], back: false }
    : { steps: back, plan: [node, ...pathFrom(Bk.prev, j)], back: true };
}
export function setTrip(j) {
  const t = tripTo(j);
  if (!t) return false;
  const r = S.route;
  if (t.back && nextStop() != null) {
    const nx = nextStop(),
      c = linkCost(r.node, nx);
    r.node = nx;
    r.prog = c - r.prog;
    t.plan.shift();
  }
  r.plan = t.plan;
  r.hold = false;
  if (!r.plan.length) r.prog = 0;
  save();
  return true;
}
export function stopTrip() {
  const r = S.route;
  if (r.prog > 0) {
    r.hold = true;
  } else {
    r.plan = [];
    r.hold = false;
  }
  save();
}
export function resumeTrip() {
  S.route.hold = false;
  save();
}
/* encounters come from where you're headed while you walk, otherwise from where you are */
export const hereStop = () => {
  const nx = nextStop();
  return ROUTE[nx != null && S.route.prog > 0 && !S.route.hold ? nx : S.route.node];
};
export function areaPool() {
  return POOLS[hereStop().pool] || POOLS[Object.keys(POOLS)[0]];
}
export function spawn(gentle, force) {
  const P = areaPool();
  let list = typeof envOdds === 'function' ? envOdds(P.list) : P.list;
  if (gentle) {
    const my = SP[S.starter + '0'].types,
      g = list.filter(([id]) => !SP[id].types.some(t => eff(t, my) > 1));
    if (g.length) list = g;
  }
  const sp = force || pickW(list),
    lvl = P.lv[0] + Math.floor(rnd() * (P.lv[1] - P.lv[0] + 1));
  const q = { id: uid(), sp, lvl, gold: rnd() < 1 / RULES.steps.goldOdds, no: ++S.serial };
  /* v33: now and then an Alpha (once you have two billionaires to stand with your lead) */
  if (
    !gentle &&
    !force &&
    S.team.filter(m => m.job == null).length >= 2 &&
    rnd() < 1 / ((RULES.steps && RULES.steps.alphaOdds) || 45)
  )
    q.alpha = true;
  S.queue.push(q);
  return q;
}
export function addSteps(n, quiet) {
  n = Math.floor(Number(n));
  if (!S.started || !Number.isFinite(n) || n <= 0 || n > 100000) return;
  rollDay();
  const a = S.day.steps,
    b = a + n,
    g = taxed(a, b) + S.seFrac,
    gi = Math.floor(g);
  S.seFrac = g - gi;
  S.se += gi;
  S.day.steps = b;
  S.totalSteps += n;
  const msgs = [];
  if (traveling()) {
    const r = S.route;
    r.prog += n;
    while (r.plan.length && r.prog >= linkCost(r.node, r.plan[0])) {
      r.prog -= linkCost(r.node, r.plan[0]);
      r.node = r.plan.shift();
      S.visited[r.node] = 1;
      msgs.push(r.plan.length ? `You passed through ${ROUTE[r.node].name}.` : `You arrived at ${ROUTE[r.node].name}.`);
      if (typeof U !== 'undefined') U.arrive = r.node;
      /* v43: the walk screen walks you in from the exit */ if (!r.plan.length || gateMsg()) {
        r.prog = 0;
        break;
      }
    }
    if (!r.plan.length) r.prog = 0;
  }
  const every = Math.max(1, RULES.steps.encounterEverySE);
  S.meter += gi;
  let sp = 0;
  while (S.meter >= every) {
    S.meter -= every;
    if (S.queue.length < RULES.steps.maxEncounters) {
      spawn();
      sp++;
    }
  }
  const bud = findMon(S.buddy),
    per = Math.max(1, RULES.progression.buddyStepsPerXp);
  if (bud) bud.bsteps = (bud.bsteps || 0) + n;
  /* v37: the rest of the party walks too, at half weight (for the Build path of a split evolution) */ for (const m of S.team)
    if (m !== bud) m.psteps = (m.psteps || 0) + n;
  S.buddyRem += n;
  const xp = Math.floor(S.buddyRem / per);
  S.buddyRem -= xp * per;
  const notes = [];
  if (bud && xp > 0) gainXp(bud, xp, t => notes.push(t));
  S.eggs.forEach(e => {
    if (e.slot != null) e.prog = Math.min(EGGS[e.tier].need, e.prog + n);
  });
  S.jobs.forEach(j => {
    if (!j.uid) return;
    j.acc += n;
    while (j.acc >= JOB_STEPS) {
      j.acc -= JOB_STEPS;
      if (j.pend < RULES.jobs.maxPending) j.pend++;
    }
  });
  if (!quiet || sp) toast(`+${fmt(n)} steps, +$${fmt(gi)}${sp ? `, ${plural(sp, 'new encounter')}` : ''}`);
  msgs.concat(notes).forEach(t => toast(t));
  save();
  if (!B) {
    render();
    if (typeof onStepsAdded === 'function') onStepsAdded();
    postProcess();
  }
}

/* ---------- Seed Rounds ---------- */
export const EGG_SLOTS = () => Math.max(1, RULES.eggs.slots);
function autoSlot() {
  for (let sl = 0; sl < EGG_SLOTS(); sl++) {
    if (S.eggs.some(e => e.slot === sl)) continue;
    const e = S.eggs.find(e => e.slot == null);
    if (e) e.slot = sl;
  }
}
export function addEgg(tier) {
  if (!EGGS[tier]) return false;
  if (S.eggs.length >= RULES.eggs.capacity) {
    toast('You’re carrying too many eggs. Hatch a few first.');
    return false;
  }
  S.eggs.push({ id: uid(), tier, prog: 0, slot: null });
  autoSlot();
  return true;
}
export const hatchable = () => S.eggs.filter(e => e.slot != null && e.prog >= EGGS[e.tier].need);
export function hatchEgg(e) {
  if (typeof jingle === 'function') jingle(JINGLES.hatch);
  const T = EGGS[e.tier],
    R = RULES.eggs,
    top = e.tier === EGG_TIERS[EGG_TIERS.length - 1];
  let sp = pickW(T.list),
    gold = rnd() < 1 / (top ? R.goldOdds10 : R.goldOdds);
  if (top && SP[R.mythSpecies] && rnd() < 1 / R.mythOdds) {
    sp = R.mythSpecies;
    gold = false;
  }
  const m = makeMon(sp, T.lv, { gold });
  S.eggs = S.eggs.filter(x => x !== e);
  S.hatched = (S.hatched || 0) + 1;
  autoSlot();
  const where = addMon(m);
  save();
  return { m, where };
}

/* ---------- Day Jobs ---------- */
export function assignJob(slot, job, id) {
  const m = findMon(id);
  if (!m || m.job != null) return false;
  if (S.team.includes(m) && S.team.filter(x => x.job == null).length <= 1) return false;
  toBox(m);
  m.boxedAt = null;
  m.job = slot;
  S.jobs[slot] = { uid: id, job, acc: 0, pend: 0 };
  save();
  return true;
}
export function collectJob(slot) {
  const j = S.jobs[slot];
  if (!j.uid || !j.pend) return null;
  const J = JOBS[j.job],
    [kind, key, amt] = J.out,
    n = j.pend;
  j.pend = 0;
  if (kind === 'item') S.items[key] += amt * n;
  else if (kind === 'coin') S.coins[key] += amt * n;
  else S.se += amt * n;
  save();
  const m = findMon(j.uid);
  return `${m ? N(m) : 'Your Billie'} ${J.quip} You collected ${kind === 'se' ? '$' + fmt(amt * n) : `${amt * n} × ${kind === 'item' ? ITEMS[key].n : COINS[key].n}`}.`;
}
export function endShift(slot) {
  const j = S.jobs[slot];
  const msg = collectJob(slot);
  const m = findMon(j.uid);
  if (m) {
    m.job = null;
    m.boxedAt = Date.now();
  }
  S.jobs[slot] = { uid: null, job: null, acc: 0, pend: 0 };
  save();
  return msg;
}
