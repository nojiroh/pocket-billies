'use strict';
/* ================= THE RUN ON THE PAGE (roguelite track RL-8) =================
   The run loop as the player meets it: starting a run at Copperleaf's airship mast, the checkpoints it saves, a
   reload picking it up where it was, giving up, and the end (the payout screen is run-payout.js). The rules it plays
   by are logic/run-loop.js, logic/run-map.js and logic/run-state.js; the run's world is run-world.js.
   Storage stays in Copperleaf during a run (logic/rules.js allBillies, toBox, toTeam, addBilly): a Billie caught while
   the party is full waits in runCatch, never in the save (a team of seven can't be saved), until one is released. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, mapIdAt, modal, provide, render, runPayoutOpen, toast } from './hooks.js';
import { COINS, ITEMS, RULES, START_NODE } from './game-data.js';
import { billyName, formatNumber, healAll, plural } from './logic/rules.js';
import { runBegin, runEnd } from './logic/run-state.js';
import { runArrive, runBack, runMapNode, runMapStart, runNext } from './logic/run-map.js';
import { MAPGEN_VERSION } from './logic/mapgen.js';
import { runGive, runRelease, runReleasePays } from './logic/run-loop.js';
import { isLiteMap, loadMapFile } from './map-files.js';
import { activeBattle, escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { standByMast, startAirshipFlight } from './airship.js';
import { runWorld, runWorldData, runWorldSync } from './run-world.js';
/* eslint-disable no-func-assign */
expose({
  runCatch: [() => runCatch],
  runEndHome: [() => runEndHome, v => (runEndHome = v)],
  runGiveUp: [() => runGiveUp, v => ((runGiveUp = v), provide({ runGiveUp }))],
  runJump: [() => runJump, v => ((runJump = v), provide({ runJump }))],
  runOver: [() => runOver, v => (runOver = v)],
  runReleasePick: [() => runReleasePick, v => (runReleasePick = v)],
  runReleaseSheet: [() => runReleaseSheet, v => ((runReleaseSheet = v), provide({ runReleaseSheet }))],
  runResume: [() => runResume, v => (runResume = v)],
  runSeedRoll: [() => runSeedRoll, v => (runSeedRoll = v)],
  runStartSheet: [() => runStartSheet, v => ((runStartSheet = v), provide({ runStartSheet }))],
  runStartable: [() => runStartable, v => ((runStartable = v), provide({ runStartable }))],
  runTakeOff: [() => runTakeOff, v => (runTakeOff = v)],
});
/* eslint-enable no-func-assign */
provide({ runGiveUp, runJump, runReleaseSheet, runStartSheet, runStartable });
/* to-module: end */
/** a Billie caught on a run while the party was full, waiting for the release sheet (page state only) */
const runCatch = { m: /** @type {any} */ (null) };
provide({ runCatch }); /* to-module */
/** the sheet after a catch with a full party: who leaves the party, the new one included. One caught on the run is
 * paid as Capital at the end (logic/run-loop.js runRelease); one from Copperleaf only leaves the party */
function runReleaseSheet() {
  const m = runCatch.m;
  if (!m || !saveData.run) return null;
  const all = saveData.team.concat([m]),
    row = (o, i) =>
      `<button class="pickrow" data-a="mact" data-i="${i}">${rigCanvasHTML(o.sp, 40, { build: o.build, coat: o.coat })}<span class="pr-t"><b>${escapeHtml(billyName(o))}</b><small>Lv ${o.lvl}${o === m ? ', just taxed' : ''}${runReleasePays(saveData.run, o) ? '' : ', from Copperleaf: comes home at the end'}</small></span></button>`;
  return {
    title: 'Your party is full',
    lock: true,
    html: `<p>Six can travel on a run. Pick who leaves the party. A Billie caught on the run is paid for in Capital at the end.</p><div class="list">${all.map(row).join('')}</div>`,
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
    html: '<p>The run ends as a loss. You keep one Billie of your choice, and what you found turns into Capital.</p>',
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
  const pay = runEnd(saveData, { won, keep }, RULES.run.payout, itemPrice);
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
    debugLog.add('scene', `back in the hub: +${pay.capital} Capital, +${pay.seals} Seals`);
  toast(
    `+${formatNumber(pay.capital)} Capital${pay.seals ? ` and ${plural(pay.seals, 'Audit Seal')}` : ''}. You have ${formatNumber(saveData.meta.capital)} Capital.`
  );
}

/* ---------- a reload picks the run up ---------- */
/** once the world shows after boot: a run at its payout opens the payout screen again */
export function runResume() {
  const run = saveData.run;
  if (!run) return;
  if (run.at.phase === 'payout') runPayoutOpen();
  /* killed mid-flight: you are on the landing (runArrive ran before the flight) */
  if (run.at.phase === 'fly') {
    run.at.phase = 'walk';
    standByMast(saveData.trip.node);
    save();
    render();
  }
}

/* ---------- the start, at Copperleaf's airship mast ---------- */
/** may a run start now: a game under way, no run on, someone on the team who can fight, no battle */
function runStartable() {
  return !!saveData.started && !saveData.run && saveData.team.some(m => m.hp > 0) && !activeBattle;
}
/** a new run's seed: 10 letters and digits (the one draw a run takes from Math.random: everything after it comes
 * from the seed) */
function runSeedRoll() {
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let k = 0; k < 10; k++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
/** the sheet before a run: what you take, what you are given, how it ends */
function runStartSheet() {
  if (!runStartable()) return;
  const S = RULES.run.start,
    gifts = [
      `$${formatNumber(S.se)}`,
      ...Object.entries(S.coins).map(([k, n]) => `${n} ${COINS[k] ? COINS[k].n : k}${n === 1 ? '' : 's'}`),
      ...Object.entries(S.items).map(([k, n]) => `${n} ${ITEMS[k] ? ITEMS[k].n : k}${n === 1 ? '' : 's'}`),
    ];
  /* in place of the mast's sheet (closeModal would let a waiting window in first) */
  uiState.modal = null;
  modal({
    title: 'Start a run',
    cls: 'fly-sheet',
    html: `<p>The airship flies you out to the wild lands past the island: a road of places, a town before each mini-boss, and a boss at the end.</p><p>Your team comes along; storage stays here. You set off with ${escapeHtml(gifts.join(', '))}.</p><p class="note">Every place you walk into takes a day. Beat the boss to win. If your whole party faints, the run is over. Either way, what you bring back turns into Capital.</p>`,
    btns: [
      { l: 'Take off', c: 'gold', f: () => runTakeOff() },
      { l: 'Not now', c: 'quiet', f: closeModal },
    ],
  });
}
/**
 * Take off on a run, in one tick: the run on the save (runBegin, with run.start), its map (runMapStart), its world
 * (runWorldSync; a world that can't be made leaves the run), day 1 on the landing (runArrive) in phase 'fly', saved
 * with the account at once, then the airship's free flight from Copperleaf (it starts after the world goes in, which
 * would stop it, and is told where from: runArrive has moved the trip already). A reload mid-flight is on the landing.
 * @param {string} [seed] @param {Partial<import('../types/game-data').RunMapRules>} [map] the map's rules changed (the
 * debug menu's short run)
 */
function runTakeOff(seed, map) {
  if (!runStartable()) return;
  closeModal();
  const s = saveData,
    sd = seed || runSeedRoll(),
    data = runWorldData();
  runBegin(s, runGive(sd, 1, MAPGEN_VERSION, RULES.run.start));
  uiState.learnQ = [];
  runCatch.m = null;
  runMapStart(
    /** @type {any} */ (s.run),
    map ? { ...data, rules: { ...data.rules, map: { ...data.rules.map, ...map } } } : data
  );
  runWorldSync();
  if (!s.run || runWorld.seed !== sd) return;
  runArrive(s, 0, data);
  s.visited[s.trip.node] = 1;
  s.run.at.phase = 'fly';
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `a run starts: ${s.run.map.nodes.length} places`);
  startAirshipFlight(s.trip.node, { free: true, from: START_NODE });
}

/* ---------- arrivals ---------- */
/** the debug menu's "Go there" on a run: walked as you would, one linked place at a time (runArrive: a day each, the
 * path, what the map shows), the shortest way there over the map's links; Copperleaf can't be walked to on a run.
 * Returns whether it got there @param {number} n the world node */
function runJump(n) {
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
