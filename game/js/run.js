'use strict';
/* ================= THE RUN ON THE PAGE (roguelite track RL-8) =================
   The run loop as the player meets it: starting a run at Copperleaf's airship mast, the checkpoints it saves, a
   reload picking it up where it was, giving up, and the end (the payout screen is run-payout.js). The rules it plays
   by are logic/run-loop.js, logic/run-map.js and logic/run-state.js; the run's world is run-world.js.
   RL-9b: the start sheet picks who comes from home (the team or storage, rules.json run.home by Bracket) and packs a
   bag from Copperleaf's (run.pack); the rest stay. Storage stays in Copperleaf during a run (logic/rules.js
   allBillies, toBox, toTeam, addBilly): a Billie caught while
   the party is full waits in runCatch, never in the save (a team of seven can't be saved), until one is released. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  closeModal,
  labMilestones,
  mapIdAt,
  modal,
  provide,
  relicPickOpen,
  render,
  renderOverlay,
  runPayoutOpen,
  toast,
} from './hooks.js';
import { COINS, ITEMS, RELICS, RULES, START_NODE, TRAINERS, UNLOCK_DATA } from './game-data.js';
import { billyName, formatNumber, healAll, plural } from './logic/rules.js';
import { ranchNow } from './logic/ranch-clock.js';
import { ranchStop } from './logic/ranch.js';
import { runByTier, runEnd } from './logic/run-state.js';
import { runArrive, runBack, runMapNode, runNext } from './logic/run-map.js';
import { runArriveFx, runBattleExtra, runRelease, runReleasePays } from './logic/run-loop.js';
import { fxOfRun, fxPayoutRates, fxRunPrice } from './logic/effects.js';
import {
  BATTLE_RULES,
  battleHost,
  battleSay,
  joinNames,
  liveActors,
  newBattle,
  sayBattleFx,
} from './logic/battle-engine.js';
import { runUnlocks } from './logic/unlocks.js';
import { runStartOn, runStartPlan } from './logic/run-start.js';
import { isLiteMap, loadMapFile } from './map-files.js';
import { activeBattle, escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { coinHTML } from './art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { itemIcon } from './battle.js';
import { JINGLES, jingle } from './sound.js';
import { standByMast, startAirshipFlight } from './airship.js';
import { runWorld, runWorldData, runWorldSync } from './run-world.js';
/* eslint-disable no-func-assign */
expose({
  RUN_HINTS: [() => RUN_HINTS],
  runArrivedFx: [() => runArrivedFx, v => (runArrivedFx = v)],
  runArrivedHint: [() => runArrivedHint, v => (runArrivedHint = v)],
  runBattleAgain: [() => runBattleAgain, v => (runBattleAgain = v)],
  runBattleStart: [() => runBattleStart, v => ((runBattleStart = v), provide({ runBattleStart }))],
  runCatch: [() => runCatch],
  runClinicEach: [() => runClinicEach],
  runEndHome: [() => runEndHome, v => (runEndHome = v)],
  runFoeRef: [() => runFoeRef],
  runGiveUp: [() => runGiveUp, v => ((runGiveUp = v), provide({ runGiveUp }))],
  runHint: [() => runHint, v => ((runHint = v), provide({ runHint }))],
  runHomeList: [() => runHomeList],
  runJump: [() => runJump, v => ((runJump = v), provide({ runJump }))],
  runOver: [() => runOver, v => ((runOver = v), provide({ runOver }))],
  runPackStep: [() => runPackStep, v => (runPackStep = v)],
  runPickDefault: [() => runPickDefault, v => (runPickDefault = v)],
  runPickNow: [() => runPickNow, v => (runPickNow = v)],
  runPickTap: [() => runPickTap, v => (runPickTap = v)],
  runReleasePick: [() => runReleasePick, v => (runReleasePick = v)],
  runReleaseSheet: [() => runReleaseSheet, v => ((runReleaseSheet = v), provide({ runReleaseSheet }))],
  runResume: [() => runResume, v => (runResume = v)],
  runSeedRoll: [() => runSeedRoll, v => (runSeedRoll = v)],
  runStartSheet: [() => runStartSheet, v => ((runStartSheet = v), provide({ runStartSheet }))],
  runStartable: [() => runStartable, v => ((runStartable = v), provide({ runStartable }))],
  runTakeOff: [() => runTakeOff, v => ((runTakeOff = v), provide({ runTakeOff }))],
});
/* eslint-enable no-func-assign */
provide({
  runBattleStart,
  runGiveUp,
  runHint,
  runJump,
  runOver,
  runReleaseSheet,
  runStartSheet,
  runStartable,
  runTakeOff,
});
/* to-module: end */
/** a Billie caught on a run while the party was full, waiting for the release sheet (page state only) */
const runCatch = { m: /** @type {any} */ (null) };
provide({ runCatch }); /* to-module */
/** the sheet after a catch with a full party: who leaves the party, the new one included. One caught on the run is
 * paid as Research at the end (logic/run-loop.js runRelease); one from Copperleaf only leaves the party */
function runReleaseSheet() {
  const m = runCatch.m;
  if (!m || !saveData.run) return null;
  const all = saveData.team.concat([m]),
    row = (o, i) =>
      `<button class="pickrow" data-a="mact" data-i="${i}">${rigCanvasHTML(o.sp, 40, { build: o.build, coat: o.coat })}<span class="pr-t"><b>${escapeHtml(billyName(o))}</b><small>Lv ${o.lvl}${o === m ? ', just caught' : ''}${runReleasePays(saveData.run, o) ? '' : ', from Copperleaf: comes home at the end'}</small></span></button>`;
  return {
    title: 'Your party is full',
    lock: true,
    html: `<p>Six can travel on a run. Pick who leaves the party. A Billie caught on the run is paid for in Research at the end.</p><div class="list">${all.map(row).join('')}</div>`,
    acts: all.map(o => ({ f: () => runReleasePick(o) })),
    btns: [],
  };
}
/** the release sheet's choice: that Billie leaves the party; the new one joins unless it was the one let go */
function runReleasePick(o) {
  const m = runCatch.m;
  if (!m || !saveData.run) return;
  runCatch.m = null;
  if (o === m) {
    if (runReleasePays(saveData.run, m)) saveData.run.released.push({ sp: m.sp, lvl: m.lvl });
  } else {
    runRelease(saveData, o);
    saveData.team.push(m);
    if (saveData.buddy === o.uid) saveData.buddy = saveData.team[0].uid;
  }
  save();
  closeModal();
  render();
  toast(`${billyName(o)} left the party.`);
}

/* ---------- the end ---------- */
/** the run is over (won: the boss beaten; lost: the party fainted, or given up): the payout phase is saved at once
 * (a reload opens the payout screen again), then the payout screen (run-payout.js) */
function runOver(won) {
  const run = saveData.run;
  if (!run || run.at.phase === 'payout') return;
  run.at = { phase: 'payout', battle: -1, won: won ? 1 : 0 };
  saveNow();
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `the run ended (${won ? 'won' : 'lost'}) on day ${run.clock}`);
  runPayoutOpen();
}
/** give up the run (the Map tab, the landing's mast): it ends as a loss, after a yes */
export function runGiveUp() {
  if (!saveData.run || saveData.run.at.phase === 'payout' || activeBattle) return;
  modal({
    title: 'Give up the run?',
    html: '<p>The run ends as a loss. You keep one Billie of your choice, and what you found turns into Research.</p>',
    btns: [
      {
        l: 'Give up',
        c: 'red',
        f: () => {
          uiState.modal = null;
          runOver(false);
        },
      },
      { l: 'Keep going', c: 'quiet', f: closeModal },
    ],
  });
}
/** the payout screen's "Fly home": the run pays out and ends (logic/run-state.js runEnd: the hub's working fields
 * back, the kept Billies with their gains), the hub's world goes back in, everyone is healed and you stand by
 * Copperleaf's mast @param {boolean} won @param {string[]} keep @param {(id: string) => number} itemPrice */
export function runEndHome(won, keep, itemPrice) {
  if (!saveData.run) return;
  /* RL-12: the Loopholes' payout rows, read before the run ends */
  const rates = fxPayoutRates(fxOfRun(saveData.run, RELICS), RULES.run.payout),
    pay = runEnd(saveData, { won, keep }, rates, itemPrice);
  /* a move waiting to be learned names a Billie by its uid, which a run's copy shares with the hub's */
  uiState.learnQ = [];
  runCatch.m = null;
  runWorldSync();
  healAll();
  uiState.tab = 'walk';
  const home = saveData.trip.node,
    stand = () => standByMast(home);
  if (typeof isLiteMap === 'function' && isLiteMap(mapIdAt(home)))
    loadMapFile(mapIdAt(home)).then(() => {
      if (stand()) render();
    });
  else stand();
  saveNow();
  closeModal();
  render();
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `back in the hub: +${pay.capital} Research, +${pay.seals} Crests, +${pay.scrap} Scrap`);
  toast(
    `+${formatNumber(pay.capital)} Research${pay.scrap ? `, ${formatNumber(pay.scrap)} Scrap` : ''}${pay.seals ? ` and ${plural(pay.seals, 'Crest')}` : ''}. You have ${formatNumber(saveData.meta.capital)} Research.`
  );
  /* RL-11: milestones the run has met (ended runs, wins), each with its own toast after this one */
  if (typeof labMilestones === 'function') labMilestones();
}

/* ---------- a reload picks the run up ---------- */
/** once the world shows after boot: a run at its payout opens the payout screen again */
export function runResume() {
  const run = saveData.run;
  if (!run) return;
  if (run.at.phase === 'payout') runPayoutOpen();
  /* RL-12: a mini-boss's pick not answered yet (the offer was saved before it showed) */
  else if (run.offer && run.at.phase === 'walk') relicPickOpen();
  /* killed mid-battle: the same battle again, from its seed (the owner's answer, roguelite-track.md 8.7) */
  if (run.at.phase === 'battle') runBattleAgain();
  /* killed mid-flight: you are on the landing (runArrive ran before the flight) */
  if (run.at.phase === 'fly') {
    run.at.phase = 'walk';
    standByMast(saveData.trip.node);
    save();
    render();
  }
}

/* ---------- the start, at Copperleaf's airship mast ---------- */
/** may a run start now: a game under way, no run on, someone at home (the team or storage: the travellers leave
    healed), no battle */
function runStartable() {
  return !!saveData.started && !saveData.run && saveData.team.length + saveData.box.length > 0 && !activeBattle;
}
/** a new run's seed: 10 letters and digits (the one draw a run takes from Math.random: everything after it comes
 * from the seed) */
function runSeedRoll() {
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let k = 0; k < 10; k++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
/** RL-9b: who may come from home: the team, then storage */
const runHomeList = () => [...saveData.team, ...saveData.box];
/** the mast's first pick: the buddy, else the lead, else the first in storage */
function runPickDefault() {
  const all = runHomeList(),
    m = all.find(b => b.uid === saveData.buddy) || all[0];
  return m ? m.uid : null;
}
/** the start sheet's choice as it stands (uiState.runPick, runPack), kept to what is at home, what the bag holds and
 * the Bracket's counts (rules.json run.home, run.pack): the Billies from home (the default pick when none), the pack
 * and how many things are in it @param {number} [tier] */
function runPickNow(tier = 1) {
  const all = runHomeList(),
    cap = runByTier(RULES.run.home, tier),
    most = runByTier(RULES.run.pack, tier);
  let home = (uiState.runPick || []).filter(u => all.some(m => m.uid === u)).slice(0, cap);
  if (!home.length) home = [runPickDefault()].filter(u => !!u);
  const pack = { items: {}, coins: {} };
  let n = 0;
  for (const kind of ['items', 'coins'])
    for (const [k, v] of Object.entries((uiState.runPack || {})[kind] || {})) {
      const take = Math.max(0, Math.min(v, saveData[kind][k] || 0, most - n));
      if (!take) continue;
      pack[kind][k] = take;
      n += take;
    }
  return { home, pack, n, cap, most };
}
/** a card tapped: that Billie comes (with one place, in place of the one picked; with more, in or out) */
function runPickTap(uid) {
  const P = runPickNow();
  uiState.runPick =
    P.cap === 1 ? [uid] : P.home.includes(uid) ? P.home.filter(u => u !== uid) : [...P.home, uid].slice(-P.cap);
  runStartSheet();
}
/** a pack row's − or +: one thing more or less of it, within what the bag holds and the pack's room */
function runPackStep(kind, k, d) {
  const P = runPickNow(),
    now = P.pack[kind][k] || 0,
    next = Math.max(0, Math.min(saveData[kind][k] || 0, now + d, now + P.most - P.n));
  uiState.runPack = P.pack;
  uiState.runPack[kind][k] = next;
  runStartSheet();
}
/** the sheet before a run: who comes from home, what you pack from Copperleaf's bag, what the airship adds, how it
 * ends. Opened again in place on every tap (the same sheet: no new scrim, the scroll kept) */
export function runStartSheet() {
  if (!runStartable()) return;
  const S = RULES.run.start,
    P = runPickNow(),
    gifts = [
      plural(S.se, 'Money'),
      ...Object.entries(S.coins).map(([k, n]) => `${n} ${COINS[k] ? COINS[k].n : k}${n === 1 ? '' : 's'}`),
      ...Object.entries(S.items).map(([k, n]) => `${n} ${ITEMS[k] ? ITEMS[k].n : k}${n === 1 ? '' : 's'}`),
    ],
    trains = uid => !!(saveData.ranch && saveData.ranch.trainees.some(t => t.uid === uid)),
    card = m =>
      `<pb-pick-card data-u="${m.uid}" heading="${escapeHtml(billyName(m))}" sub="Lv ${m.lvl} · ${saveData.team.includes(m) ? 'team' : trains(m.uid) ? 'training' : 'storage'}"${P.home.includes(m.uid) ? ' selected' : ''}><span slot="art">${rigCanvasHTML(m.sp, 64, { build: m.build, coat: m.coat })}</span></pb-pick-card>`,
    things = [
      ...Object.keys(ITEMS)
        .filter(k => saveData.items[k] > 0)
        .map(k => ['items', k, ITEMS[k].n, itemIcon(k, 30)]),
      ...Object.keys(COINS)
        .filter(k => saveData.coins[k] > 0)
        .map(k => ['coins', k, COINS[k].n, coinHTML(k, 30)]),
    ],
    row = ([kind, k, name, icon]) => {
      const n = P.pack[kind][k] || 0,
        have = saveData[kind][k];
      return `<div class="bag-row k-card run-pack-row"><span class="bag-ic">${icon}</span><span class="bag-t"><b>${escapeHtml(name)}</b><small>${formatNumber(have)} in the bag</small></span><button class="pb" data-pk="${kind}" data-k="${escapeHtml(k)}" data-d="-1" aria-label="One ${escapeHtml(name)} less"${n ? '' : ' disabled'}>−</button><b class="bag-n tnum">${n}</b><button class="pb" data-pk="${kind}" data-k="${escapeHtml(k)}" data-d="1" aria-label="One ${escapeHtml(name)} more"${n < have && P.n < P.most ? '' : ' disabled'}>+</button></div>`;
    },
    trained = P.home.filter(trains);
  const html = `<p>The airship flies you out to the wild lands past the island: a road of places, a town before each mini-boss, and a boss at the end.</p><h3>Who comes from home</h3><p class="note">${plural(P.cap, 'Billie')} from home at Bracket I. The rest stay at the ranch; on the run you catch wild ones.${trained.length ? ' Training stops while it is away (what it banked comes along).' : ''}</p><div class="bx-grid">${runHomeList().map(card).join('')}</div><h3>Pack the bag <small class="tnum">${P.n} of ${P.most}</small></h3>${things.length ? `<div class="bag-list px">${things.map(row).join('')}</div>` : '<p class="note">Copperleaf’s bag is empty.</p>'}<p>The airship adds ${escapeHtml(gifts.join(', '))}.</p><p class="note">Every place you walk into takes a day. Beat the boss to win: everyone comes home with what they learned, and the bag goes into Copperleaf’s. If your whole party faints, the run is over: you keep one Billie, and the bag turns into Research.</p>`;
  const was = uiState.modal && uiState.modal.cls === 'fly-sheet run-start' ? uiState.modal : null,
    sheet = document.querySelector('#ov .sheet'),
    body = document.querySelector('#ov .sheet .body'),
    scroll = was && sheet ? [sheet.scrollTop, body ? body.scrollTop : 0] : null;
  const M = was || { title: 'Start a run', cls: 'fly-sheet run-start' };
  Object.assign(M, {
    html,
    btns: [
      {
        l: 'Take off',
        c: 'gold',
        dis: !P.home.length,
        f: () => runTakeOff(undefined, undefined, undefined, runPickNow()),
      },
      {
        l: 'Not now',
        c: 'quiet',
        f: () => {
          uiState.runPick = uiState.runPack = null;
          closeModal();
        },
      },
    ],
    _afterRan: false,
    after: () => {
      for (const c of document.querySelectorAll('#ov pb-pick-card'))
        c.addEventListener('pb-pick', () => runPickTap(/** @type {HTMLElement} */ (c).dataset.u));
      for (const b of document.querySelectorAll('#ov [data-pk]'))
        b.addEventListener('click', () => {
          const d = /** @type {HTMLElement} */ (b).dataset;
          runPackStep(d.pk, d.k, Number(d.d));
        });
      const sh = document.querySelector('#ov .sheet'),
        bd = document.querySelector('#ov .sheet .body');
      if (scroll && sh) sh.scrollTop = scroll[0];
      if (scroll && bd) bd.scrollTop = scroll[1];
    },
  });
  /* in place of the mast's sheet (closeModal would let a waiting window in first) */
  uiState.modal = M;
  renderOverlay();
}
/**
 * Take off on a run, in one tick: the run on the save with its map (logic/run-start.js runStartPlan, runStartOn), its world
 * (runWorldSync; a world that can't be made leaves the run), day 1 on the landing (runArrive) in phase 'fly', saved
 * with the account at once, then the airship's free flight from Copperleaf (it starts after the world goes in, which
 * would stop it, and is told where from: runArrive has moved the trip already). A reload mid-flight is on the landing.
 * RL-9b: `pick` is who comes from home and what is packed (the start sheet's runPickNow); left out (the debug menu, the
 * tests), the default pick alone and nothing packed. A Billie training at the ranch stops (its bank collected) and
 * everyone at home is healed first (the hub's healing is free), so the travellers leave healed.
 * @param {string} [seed] @param {Partial<import('../types/game-data').RunMapRules>} [map] the map's rules changed (the
 * debug menu's short run) @param {string[]} [mods] the run's mods (the debug menu's mountains run: RUN_MOD_MOUNTAINS)
 * @param {{ home: string[], pack: { items: Record<string, number>, coins: Record<string, number> } }} [pick]
 */
export function runTakeOff(seed, map, mods, pick) {
  if (!runStartable()) return;
  const P = pick || { home: [runPickDefault()].filter(u => !!u), pack: { items: {}, coins: {} } };
  if (!P.home.length) return;
  uiState.runPick = uiState.runPack = null;
  closeModal();
  const s = saveData,
    sd = seed || runSeedRoll(),
    data = runWorldData();
  /* RL-11: the shop and biome unlocks it starts with; its map draws only the biomes open to it (Studio plan T2.1: one
     start for every run, logic/run-start.js) */
  const plan = runStartPlan(
    sd,
    { ...data, unlockData: UNLOCK_DATA },
    { unlocks: runUnlocks(s, UNLOCK_DATA), map, mods }
  );
  if (RULES.ranch && s.ranch)
    for (const uid of P.home) ranchStop(s, uid, ranchNow(s, Date.now(), RULES.ranch).now, RULES.ranch, toast);
  healAll();
  runStartOn(s, plan, { home: P.home, pack: P.pack });
  uiState.learnQ = [];
  runCatch.m = null;
  runWorldSync();
  if (!s.run || runWorld.seed !== sd) return;
  runArrive(s, 0, data);
  s.visited[s.trip.node] = 1;
  s.run.at.phase = 'fly';
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `a run starts: ${s.run.map.nodes.length} places`);
  startAirshipFlight(s.trip.node, { free: true, from: START_NODE });
  /* SND-4: the run's first bookend, the title's motif as the airship leaves the mast (the payout is the other) */
  if (typeof jingle === 'function' && JINGLES.motif) jingle(JINGLES.motif);
}

/* ---------- arrivals ---------- */
/** the debug menu's "Go there" on a run: walked as you would, one linked place at a time (runArrive: a day each, the
 * path, what the map shows), the shortest way there over the map's links; Copperleaf can't be walked to on a run.
 * Returns whether it got there @param {number} n the world node */
export function runJump(n) {
  const run = saveData.run;
  if (!run || !run.map) return false;
  const map = run.map,
    to = runMapNode(n),
    from = runMapNode(saveData.trip.node);
  if (!map.nodes[to] || !map.nodes[from]) return false;
  const prev = new Map([[from, -1]]),
    q = [from];
  while (q.length && !prev.has(to)) {
    const i = /** @type {number} */ (q.shift());
    for (const j of [...runNext(map, i), ...runBack(map, i)])
      if (!prev.has(j)) {
        prev.set(j, i);
        q.push(j);
      }
  }
  if (!prev.has(to)) return false;
  const way = [];
  for (let i = to; i !== from; i = prev.get(i)) way.unshift(i);
  for (const i of way) {
    if (!runArrive(saveData, i, runWorldData())) return false;
    saveData.visited[saveData.trip.node] = 1;
  }
  return true;
}

/* ---------- a run's battles ---------- */
/** what a run battle needs to start again after a reload: its kind, format and foe as it began (copies), and what
 * the page gave it (the encounter, the trainer, the stage, a fish) */
const runFoeRef = (kind, foe, extra = {}) => ({
  kind,
  fmt: extra.fmt || 'single',
  team: JSON.parse(JSON.stringify(foe)),
  ...(extra.qid ? { qid: String(extra.qid) } : {}),
  ...(extra.tid ? { tid: extra.tid } : {}),
  ...(extra.area ? { area: extra.area } : {}),
  ...(extra.fished ? { fished: 1 } : {}),
});
/* Every battle the page starts goes through newBattle: on a run (not a test's own fight, which brings its host) it
   gets its seed (logic/run-loop.js runBattleSeed: its place and its number in the run) and the forecast's weather;
   as it begins, the save holds it (run.at phase 'battle', its number and its foe) and goes to the account at once;
   then the battle carries runK and nothing is written until it ends (game-state.js saveHeld). A battle started again
   after a reload (phase 'battle' already) keeps its number, so it draws the same chances. The engine's newBattle
   asks for it (runBattleStart, through hooks.js) */
function runBattleStart(kind, foe, extra) {
  const run = saveData.run,
    i = run && run.map ? runMapNode(saveData.trip.node) : -1;
  if (!run || !run.map || !run.map.nodes[i] || run.at.phase === 'payout' || (extra && extra.host)) return null;
  const again = run.at.phase === 'battle',
    k = again ? run.at.battle : run.battleN,
    ref = again && run.at.foe ? run.at.foe : runFoeRef(kind, foe, extra);
  return {
    extra: {
      ...extra,
      /* its seed, the forecast's weather and (RL-12) the Loopholes held: none, no fx, the battle as before
         (logic/run-loop.js runBattleExtra, which the run's simulation plays too) */
      ...runBattleExtra(run, i, k, RULES.env, fxOfRun(run, RELICS)),
    },
    begun: b => {
      if (!again) run.battleN = k + 1;
      run.at = { phase: 'battle', battle: k, foe: ref };
      saveNow();
      b.runK = k;
      if (typeof debugLog !== 'undefined') debugLog.add('battle', `run battle ${k}${again ? ' started again' : ''}`);
    },
  };
}
/** a reload in the middle of a run's battle: the same battle again, from its start (its foe as it began, its seed) */
function runBattleAgain() {
  const run = saveData.run,
    A = run && run.at.foe,
    T = A && A.tid ? TRAINERS[A.tid] : null;
  if (!run || !A || (A.tid && !T) || !saveData.team.some(m => m.hp > 0)) {
    if (run && run.at.phase === 'battle') run.at = { phase: 'walk', battle: -1 };
    save();
    return;
  }
  if (
    !newBattle(A.kind, JSON.parse(JSON.stringify(A.team)), {
      fmt: A.fmt,
      area: A.area,
      ...(A.qid ? { qid: A.qid } : {}),
      ...(T ? { tid: A.tid, foeName: T.name, T } : {}),
      ...(A.fished ? { fished: 1 } : {}),
    })
  )
    return;
  if (T && T.market) activeBattle.market = { k: 'sand', n: T.market.n || BATTLE_RULES.shockTurns };
  battleSay(
    T ? `${T.name} is ready to battle again.` : 'The battle starts again.',
    T ? { k: 'trainerIn', who: T.who } : { k: 'wild' }
  );
  const K = liveActors(0);
  K.forEach((kk, n) => battleSay(n ? '' : `Go, ${joinNames(K)}!`, { k: 'enter', si: kk, quiet: n > 0 }));
  sayBattleFx();
  battleHost().open();
}

/* ---------- Loopholes on the walk (RL-12, logic/effects.js) ---------- */
/** a run town's clinic: $ a hurt Billie, with the Loopholes' heal price rows */
export const runClinicEach = () => fxRunPrice(saveData.run, RELICS, 'heal', RULES.run.healCost);
/** walking into a place on a run: a Loophole's heal row heals the team (before the arrival's save) */
export function runArrivedFx() {
  const gained = runArriveFx(saveData, RELICS);
  if (gained > 0) toast(`Your Loopholes paid out: your team healed ${formatNumber(gained)} HP.`);
}

/* ---------- hints, on a player's first run only ---------- */
/** the first run's hints, each shown once (run.hints) as a toast */
const RUN_HINTS = {
  landing: run =>
    `Day 1 of the run. Walk north into the next place: each place you walk into takes a day. The boss waits at the far end; the deadline is day ${run.deadline}.`,
  map: () => 'The map shows the places ahead and their weather. A ? is further on. The boss is always shown.',
  town: () =>
    `A town: its clinic heals for ${plural(runClinicEach(), 'Money')} a Billie, and its shop has new stock every day.`,
  miniboss: () => 'A mini-boss blocks the way north. Beat them to go on.',
  boss: () => 'The boss. Beat it and the run is won.',
  relic: () =>
    `Loopholes last the run: hold up to ${RULES.run.relics.cap}. The Loopholes tab shows what each one does; town shops sell them too.`,
};
/** show a first-run hint once (nothing on a later run, or once shown) @param {keyof typeof RUN_HINTS} id */
export function runHint(id) {
  const run = saveData.run;
  if (!run || (saveData.meta && saveData.meta.runs) || run.hints[id] || !RUN_HINTS[id]) return;
  run.hints[id] = 1;
  toast(RUN_HINTS[id](run));
}
/** a run's place walked into: its type's hint */
export function runArrivedHint() {
  const run = saveData.run,
    node = run && run.map && run.map.nodes[runMapNode(saveData.trip.node)];
  if (node && ['town', 'miniboss', 'boss'].includes(node.type)) runHint(/** @type {any} */ (node.type));
}
