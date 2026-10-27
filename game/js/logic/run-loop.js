// @ts-check
'use strict';
/* ================= THE RUN LOOP'S RULES (roguelite track RL-8) =================
   What the run loop works out, kept apart from the page (game/js/run.js, run-payout.js) so a run's simulation plays the
   same rules (tools/test/sim/run-sim.mjs):
   - a run town's clinic: rules.json run.healCost per hurt Billie;
   - a run town's shop: run.shop's `always` wares and `more` drawn by weight, from the town's own stream for the day
     (rngFrom(its node's seed, 'shop|' + day)), so a reload or another device sees the same stock;
   - the run's foes: a mini-boss on each mini-boss node and the boss, each a leader (the trainers with miniboss: true)
     drawn from the node's stream, never one twice in a run, its team's levels set over its row's top wild level
     (run.foes); a copy with its own id, blocking the way east (mini-bosses), with nothing of the hub's (no hub
     script, badge, egg or story conditions; RL-S1: its script is a word picked by the run history, then the battle);
   - a battle's seed (its node's seed and its number in the run), the payout screen's rows, what may be kept.
   Numbers come in as arguments; logic only: no DOM, no Date, no Math.random (tools/test/run-loop.test.mjs). */
/** @import { Run, RunMap, SaveData, Billy } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { encArrive, fxHealShare, fxOfRun, unlockOpen } from '../hooks.js';
import { BANTER, ITEMS, SPECIES, TRAINERS, typeEffectiveness } from '../game-data.js';
import { rngFrom } from './rng.js';
import { battleWeatherOf } from './weather.js';
import { healAll, maxHp, plural, speciesStep } from './rules.js';
import { RIVAL_TRAINER, ghostTeam, rivalTeam } from './rival.js';
import { modBossHp, modFoeLevels, modHas } from './modifiers.js';
import { RUN_DAYS, runHome } from './run-state.js';
import { runNodeSeed, runWeather, runWorldNode } from './run-map.js';
import { runLeaderPicks, runWildLevels } from './run-scenes.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  runArriveFx: [() => runArriveFx, v => (runArriveFx = v)],
  // @ts-expect-error -- replaced on purpose
  runArriveHeal: [() => runArriveHeal, v => (runArriveHeal = v)],
  // @ts-expect-error -- replaced on purpose
  runBattleExtra: [() => runBattleExtra, v => (runBattleExtra = v)],
  runBattleSeed: [() => runBattleSeed],
  // @ts-expect-error -- replaced on purpose
  runBattleWeather: [() => runBattleWeather, v => (runBattleWeather = v)],
  // @ts-expect-error -- replaced on purpose
  runClinic: [() => runClinic, v => (runClinic = v)],
  runFoeId: [() => runFoeId],
  runFoeWinText: [() => runFoeWinText],
  // @ts-expect-error -- replaced on purpose
  runFoes: [() => runFoes, v => (runFoes = v)],
  // @ts-expect-error -- replaced on purpose
  runFragileDrop: [() => runFragileDrop, v => (runFragileDrop = v)],
  // @ts-expect-error -- replaced on purpose
  runHealCost: [() => runHealCost, v => (runHealCost = v)],
  runHurt: [() => runHurt],
  runItemPrice: [() => runItemPrice],
  runKept: [() => runKept],
  // @ts-expect-error -- replaced on purpose
  runLeaderTeam: [() => runLeaderTeam, v => (runLeaderTeam = v)],
  // @ts-expect-error -- replaced on purpose
  runPayoutRows: [() => runPayoutRows, v => (runPayoutRows = v)],
  // @ts-expect-error -- replaced on purpose
  runRelease: [() => runRelease, v => (runRelease = v)],
  runReleasePays: [() => runReleasePays],
  // @ts-expect-error -- replaced on purpose
  runSheetStatus: [() => runSheetStatus, v => (runSheetStatus = v)],
  // @ts-expect-error -- replaced on purpose
  runShopOpen: [() => runShopOpen, v => (runShopOpen = v)],
  // @ts-expect-error -- replaced on purpose
  runShopStock: [() => runShopStock, v => (runShopStock = v)],
  runWareHeals: [() => runWareHeals],
  // @ts-expect-error -- replaced on purpose
  weatherEffectText: [() => weatherEffectText, v => (weatherEffectText = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** is a Billie hurt: below its full HP, fainted, with a status, or (a robot) with a damaged part @param {Billy} m */
export const runHurt = m =>
  m.hp < maxHp(m) || !!m.status || Object.values(m.partDmg || {}).some(d => /** @type {number} */ (d) > 0);
/** RL-12: walking into a place with a heal row (logic/effects.js fxHealShare): every Billie that hasn't fainted gains
 * `share` of its HP (rounded up), never past its full HP; returns the HP gained in all @param {Billy[]} team
 * @param {number} share */
export function runArriveHeal(team, share) {
  let gained = 0;
  if (!(share > 0)) return 0;
  for (const m of team) {
    if (m.hp <= 0) continue;
    const top = maxHp(m),
      to = Math.min(top, m.hp + Math.ceil(top * share));
    gained += to - m.hp;
    m.hp = to;
  }
  return gained;
}
/** Studio plan T3.3: walking into a place on a run (walk-control.js through run.js runArrivedFx, and the run's
 * simulation): the held Perks' heal rows heal the team (runArriveHeal); returns the HP gained (0: none)
 * @param {SaveData} s @param {Record<string, any>} perks perks.json */
export function runArriveFx(s, perks) {
  /* RL-12b: an event's boons count one place down first (logic/run-enc.js) */
  if (s.run) encArrive(s.run);
  const share = fxHealShare(fxOfRun(s.run, perks));
  return share ? runArriveHeal(s.team, share) : 0;
}
/** what a run town's clinic charges to heal the party: `each` per hurt Billie @param {Billy[]} team
 * @param {number} each @returns {{ hurt: number, cost: number }} */
export function runHealCost(team, each) {
  const hurt = team.filter(runHurt).length;
  return { hurt, cost: hurt * each };
}
/** Studio plan T3.2: a run town's clinic, after the player's yes (walk-tab.js clinicHeal, and the run's simulation):
 * when a Billie is hurt and the money is there, pay `each` per hurt Billie and heal everyone (healAll: the save in
 * play, `s`); else nothing changes. Returns what was hurt, what it costs and what was paid (0: nothing done)
 * RL-13: with the "No healing" challenge the clinic is shut and nothing is paid (`shut`)
 * @param {SaveData} s @param {number} each @returns {{ hurt: number, cost: number, paid: number, shut?: boolean }} */
export function runClinic(s, each) {
  const { hurt, cost } = runHealCost(s.team, each);
  /* RL-13: the "No healing" challenge closes the clinics (logic/modifiers.js) */
  if (modHas(s.run, 'noheal')) return { hurt, cost, paid: 0, shut: true };
  if (!hurt || s.se < cost) return { hurt, cost, paid: 0 };
  s.se -= cost;
  healAll();
  return { hurt, cost, paid: cost };
}

/** a run town's wares on a day: `always`, then `more` drawn by weight from `pick` (none twice, none already there),
 * as shop stock rows ({item} or {coin}) @param {Run} run @param {number} i the map node @param {number} day
 * @param {{ always: string[], more: number, pick: Record<string, number> }} rule */
export function runShopStock(run, i, day, rule) {
  const g = rngFrom(runNodeSeed(run.seed, i), 'shop|' + day),
    out = rule.always.slice(),
    left = Object.fromEntries(Object.entries(rule.pick).filter(([w, n]) => n > 0 && !out.includes(w)));
  for (let k = 0; k < rule.more && Object.keys(left).length; k++) {
    const w = g.pick(Object.fromEntries(Object.entries(left).sort()));
    out.push(w);
    delete left[w];
  }
  return out.map(w => (w.startsWith('coin:') ? { coin: w.slice(5) } : { item: w }));
}

/** Studio plan T3.3: a run town's wares on a day as its shop opens them (shop.js openShop, and the run's simulation):
 * runShopStock with only the wares the run has unlocked (its copy, run.unlocks; RL-11)
 * @param {Run} run @param {number} i @param {number} day
 * @param {{ always: string[], more: number, pick: Record<string, number> }} rule
 * @param {import('./unlocks.js').UnlockData} unlockData */
export function runShopOpen(run, i, day, rule, unlockData) {
  const open = unlockOpen(rule.pick, 'shop', run.unlocks, unlockData),
    /* RL-13: the "No healing" challenge takes the healing wares off the shelves (logic/modifiers.js) */
    heals = (/** @type {string} */ w) => runWareHeals(w, ITEMS),
    pick = modHas(run, 'noheal') ? Object.fromEntries(Object.entries(open).filter(([w]) => !heals(w))) : open,
    always = modHas(run, 'noheal') ? rule.always.filter(w => !heals(w)) : rule.always;
  return runShopStock(run, i, day, { ...rule, always, pick });
}
/** RL-13: whether a shop ware (an item id, or 'coin:<id>') heals or revives a Billie (items.json), for the
 * "No healing" challenge @param {string} ware @param {Record<string, any>} items */
export const runWareHeals = (ware, items) => {
  const I = !ware.startsWith('coin:') && items[ware];
  return !!I && !!(I.hp || I.hpAll || I.revive || I.cure);
};

/** a leader's win line without its badge (the run gives none): the sentences naming a Badge left out
 * @param {string} text */
export const runFoeWinText = text => {
  const m = /^“(.*)”$/.exec(text || '');
  if (!m) return text || '';
  const kept = (m[1].match(/[^.!?]+[.!?]+/g) || [m[1]]).map(s => s.trim()).filter(s => !/Badge/.test(s));
  return kept.length ? `“${kept.join(' ')}”` : '';
};
/**
 * RL-13: a run leader's team, built for the run instead of the file's legacy stand-ins: as many Billies as its own
 * team has, at `levels` (its own spread, kept), of species of the leader's type (`type`) — from the region's dex
 * first, then (none there young enough for the level) from every species of that type, each at the stage its level
 * allows (as a wild Billie's: a first stage under 16, no final form under 32, rules.js speciesStep); with
 * none of its type is young enough for the level (Steel has no first stage), its youngest; with none of its type
 * anywhere (a type no line has), its own team's species stay; no species twice while the pool has
 * others. Drawn from the node's stream, so a
 * seed's leaders are the same every time. Its coats and builds are left to the battle, as the file's team is.
 * @param {{ int: (lo: number, hi: number) => number }} g the node's stream ('team')
 * @param {any} T the leader @param {number[]} levels its Billies' levels, lowest first
 * @param {Record<string, any>} species SPECIES @param {string[] | null} dex the region's
 * @returns {{ sp: string, lvl: number }[]}
 */
export function runLeaderTeam(g, T, levels, species, dex) {
  const own = T.team.map((/** @type {any} */ e, /** @type {number} */ k) => ({ ...e, lvl: levels[k] }));
  if (!T.type) return own;
  const ofType = (/** @type {string[]} */ ids) =>
    ids.filter(id => species[id] && (species[id].types || []).includes(T.type));
  const pool = ofType(dex && dex.length ? dex : []),
    every = ofType(Object.keys(species));
  if (!every.length) return own;
  /** @type {string[]} */
  const taken = [];
  return levels.map(lvl => {
    /* the stages the level may field (encounters.js encDexAt has the same rule for route trainers) */
    const fits = (/** @type {string} */ id) =>
        lvl < 16 ? speciesStep(species[id]) === 0 : lvl < 32 ? speciesStep(species[id]) <= 1 : true,
      /* the region's own first; when it has none of the type young enough, every species of the type */
      fit = pool.filter(fits).length ? pool.filter(fits) : every.filter(fits),
      /* none of the type is young enough anywhere: its youngest instead */
      low = Math.min(...every.map(id => speciesStep(species[id]))),
      pick = fit.length ? fit.slice().sort() : every.filter(id => speciesStep(species[id]) === low).sort(),
      /* no species twice while there are others to field */
      left = pick.filter(id => !taken.includes(id)),
      from = left.length ? left : pick,
      sp = from[g.int(0, from.length - 1)];
    taken.push(sp);
    return { sp, lvl };
  });
}
/** a run foe's id: the node's place id and 'foe' @param {number} i */
export const runFoeId = i => `run_${i}_foe`;
/**
 * The run's foes, by id: on each mini-boss node and the boss's, a copy of a leader drawn from the node's stream
 * ('foe'), no leader twice in a run (nodes in order); RL-R1: a run with a region has its leaders (run.region.leaders,
 * picked by its types), in node order, while there are any; RL-R2: a side area's mini-boss or boss its own leader. Its levels: its row's top wild level + run.foes[type].up for its
 * top Billie, the others as far below as in the leader's team (1-100). A mini-boss blocks the way east and fights a
 * double battle; the boss is its leader's top Billie alone, fought as an Alpha (which adds the Alpha's own levels).
 * RL-S2: on each rival node, Blake (trainers/blake.json's name and words) with his team for that meeting
 * (logic/rival.js rivalTeam: against run.rival.lead, one meeting more than the last), at its row's top wild level +
 * run.rival.up; a reward pick after it (battle-rewards.js), never blocking.
 * @param {Run} run
 * @param {{ leaders: any[], rival?: import('../../types/game-data').RivalRules, rules: { foes: Record<'miniboss' | 'boss', { up: number, reward: number }>, rival?: import('../../types/game-data').RivalRules,
 *   ghost?: import('../../types/game-data').GhostRules,
 *   wild: { lv: [number, number], perRow: number } } }} data leaders: the trainer entries with miniboss: true
 * @returns {Record<string, any>}
 */
export function runFoes(run, data) {
  const map = /** @type {RunMap} */ (run.map),
    pool = data.leaders.filter(T => T && T.team && T.team.length).sort((a, b) => (a.id < b.id ? -1 : 1)),
    used = new Set(),
    /* RL-R1: the region's leaders, the mini-bosses in order then the boss (logic/run-region.js) */
    picks = runLeaderPicks(run),
    /** @type {Record<string, any>} */
    out = {};
  /* RL-S2: Blake on each rival node (logic/rival.js), his team growing meeting by meeting */
  const B = TRAINERS[RIVAL_TRAINER],
    RV = data.rules.rival,
    GH = data.rules.ghost,
    lead = run.rival && SPECIES[run.rival.lead] ? SPECIES[run.rival.lead].types || [] : [];
  let met = run.rival ? run.rival.past : 0;
  map.nodes.forEach((node, i) => {
    if (node.type === 'rival' && B && RV) {
      const team = rivalTeam(
        rngFrom(runNodeSeed(run.seed, i), 'team'),
        lead,
        met++,
        runWildLevels(map, i, /** @type {any} */ (data), modFoeLevels(run))[1] + RV.up,
        RV,
        SPECIES,
        (run.region && run.region.dex) || null,
        typeEffectiveness,
        id => speciesStep(SPECIES[id])
      );
      out[runFoeId(i)] = {
        id: runFoeId(i),
        name: B.name,
        who: B.who,
        battleStage: B.battleStage,
        win: B.win,
        lose: B.lose || '',
        reward: RV.reward,
        team,
        node: runWorldNode(i),
        blocks: false,
        runFoe: 'rival',
        runNode: i,
        from: RIVAL_TRAINER,
        /* his word before the battle once banter.json has lines for him (the owner approves them first) */
        script: [
          ...(Object.values(BANTER).some(L => L.who === 'rival') ? ['pick rival'] : []),
          `battle ${runFoeId(i)}`,
        ],
      };
      return;
    }
    /* ON-2: a friend's ghost team (run.ghost, logic/run-record.js): their last run's party, its strongest at the
       row's top wild level + run.ghost.up, the others as far below as they were */
    if (node.type === 'ghost' && run.ghost && GH) {
      const G = run.ghost;
      out[runFoeId(i)] = {
        id: runFoeId(i),
        name: G.n,
        who: GH.who,
        battleStage: 'grass',
        win: `“GG! My ghost will be back stronger.”`,
        lose: `“Not bad for a ghost, right?”`,
        reward: GH.reward,
        team: ghostTeam(G.party, runWildLevels(map, i, /** @type {any} */ (data), modFoeLevels(run))[1] + GH.up),
        node: runWorldNode(i),
        blocks: false,
        runFoe: 'ghost',
        runNode: i,
        from: 'ghost',
        script: [`battle ${runFoeId(i)}`],
      };
      return;
    }
    if (node.type !== 'miniboss' && node.type !== 'boss') return;
    const left = pool.filter(T => !used.has(T.id)),
      from = left.length ? left : pool,
      pick = picks[i],
      want = pool.find(T => T.id === pick);
    if (!from.length) return;
    const T = want || from[rngFrom(runNodeSeed(run.seed, i), 'foe').int(0, from.length - 1)];
    used.add(T.id);
    const F = data.rules.foes[node.type],
      top = runWildLevels(map, i, /** @type {any} */ (data), modFoeLevels(run))[1] + F.up,
      high = Math.max(...T.team.map(e => e.lvl || 1)),
      lv = (/** @type {number} */ l) => Math.max(1, Math.min(100, top - (high - (l || 1)))),
      /* RL-13: the leader's team is built for the run, of its own type (its file's team sets how many and the
         level spread; the region's dex first) */
      team = runLeaderTeam(
        rngFrom(runNodeSeed(run.seed, i), 'team'),
        T,
        T.team.map((/** @type {any} */ e) => lv(e.lvl)),
        SPECIES,
        (run.region && run.region.dex) || null
      ),
      boss = node.type === 'boss';
    out[runFoeId(i)] = {
      id: runFoeId(i),
      name: T.name,
      who: T.who,
      battleStage: T.battleStage,
      ...(T.market ? { market: T.market, marketText: T.marketText } : {}),
      win: runFoeWinText(T.win),
      lose: T.lose || '',
      reward: F.reward,
      team: boss ? [team.reduce((a, e) => (e.lvl > a.lvl ? e : a))] : team,
      node: runWorldNode(i),
      blocks: !boss,
      double: !boss,
      ...(boss ? { alpha: true } : {}),
      /* RL-13: the Expedition's boss HP (effects.js modBossHp) */
      ...(boss && modBossHp(run) !== 1 ? { hpMult: modBossHp(run) } : {}),
      runFoe: node.type,
      runNode: i,
      from: T.id,
      /* RL-S1: a word before the battle, picked by the run history (banter.json leader; story-stage.js) */
      script: ['pick leader', `battle ${runFoeId(i)}`],
      /* RL-R2: its leader's type: the first win over one keeps that type's badge (battle-rewards.js) */
      ...(T.type ? { type: T.type } : {}),
    };
  });
  return out;
}

/** a run battle's seed: its node's seed and its number in the run (run.battleN when it began), the stream the
 * battle draws its chances from (battle-state.js makeBattle) @param {Run} run @param {number} i @param {number} k */
export const runBattleSeed = (run, i, k) => `${runNodeSeed(run.seed, i)}|battle|${k}`;
/** a run place's battle weather on a day: its forecast (clear when not rolled), clear being sunny (a run has no hour),
 * as battle.wx holds it (null when it changes nothing) @param {Run} run @param {number} i the map node
 * @param {number} day @param {any} env rules.json env */
export function runBattleWeather(run, i, day, env) {
  const w = runWeather(run, i, day) || 'clear';
  return battleWeatherOf(w === 'clear' ? 'sunny' : w, env);
}
/** what a battle's weather does to moves, in words, the boosts first: "Water +20%, Fire −20%" ('' when nothing)
 * @param {{ k: string, m: Record<string, number> } | null} wx */
export function weatherEffectText(wx) {
  if (!wx) return '';
  return Object.entries(wx.m)
    .filter(([, v]) => v !== 1)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([t, v]) => `${t} ${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`)
    .join(', ');
}
/** the Actions sheet's run status at map node i: the day, the node's type, and its weather today and
 * tomorrow (the forecast's word and what a battle there would feel; tomorrow left out past the run's last day or when
 * not rolled) @param {Run} run @param {number} i the map node @param {any} env rules.json env
 * @returns {{ day: number, type: string, days: { day: number, w: string, wx: { k: string, m: Record<string, number> } | null }[] } | null} */
export function runSheetStatus(run, i, env) {
  const node = run.map && run.map.nodes[i];
  if (!node) return null;
  const days = [run.clock, run.clock + 1]
    .filter(d => d <= RUN_DAYS)
    .map(d => ({ day: d, w: runWeather(run, i, d), wx: runBattleWeather(run, i, d, env) }))
    .filter(d => d.w);
  return { day: run.clock, type: node.type, days };
}
/** Studio plan T3.2: what a run battle starts with, on the page (run.js runBattleStart) and in the simulation (logic/
 * run-sim.js): its seed, the place's forecast for today as the battle's weather (clear is sunny: a run has no hour),
 * and the Perks' effect rows when any are held (logic/effects.js fxOfRun: null when none)
 * @param {Run} run @param {number} i the map node @param {number} k the battle's number in the run
 * @param {any} env rules.json env @param {any[] | null} fx */
export function runBattleExtra(run, i, k, env, fx) {
  return {
    seed: runBattleSeed(run, i, k),
    wx: runBattleWeather(run, i, run.clock, env),
    ...(fx ? { fx } : {}),
  };
}

/** may this Billie be paid for as released: only one caught on the run (one from home comes back at the end anyway;
 * RL-9b: from the team or storage, run-state.js runHome) @param {Run} run @param {Billy} m */
export const runReleasePays = (run, m) => !runHome(run).includes(m.uid);
/** release a Billie from the run's party (it leaves the team; one caught on the run is paid at the end)
 * @param {SaveData} s @param {Billy} m */
export function runRelease(s, m) {
  const run = /** @type {Run} */ (s.run),
    i = s.team.indexOf(m);
  if (i >= 0) s.team.splice(i, 1);
  if (runReleasePays(run, m)) run.released.push({ sp: m.sp, lvl: m.lvl });
}

/**
 * RL-13: the "Fainted is gone" challenge: after a run battle, every Billie that fainted leaves the run (runRelease:
 * out of the party, paid at the payout when it was caught on the run). Never the last one standing: with the whole
 * party down the run is over anyway and the payout keeps one. Returns those that left (names for the sheet).
 * @param {SaveData} s @returns {Billy[]}
 */
export function runFragileDrop(s) {
  const run = s.run;
  if (!run || !modHas(run, 'fragile') || !s.team.some(m => m.hp > 0)) return [];
  const gone = s.team.filter(m => m.hp <= 0);
  for (const m of gone) runRelease(s, m);
  if (s.team.length && !s.team.some(m => m.uid === s.buddy)) s.buddy = s.team[0].uid;
  return gone;
}
/** Studio plan T3.2: who comes home from a run's end (run-payout.js and the run's simulation): the whole party on a
 * win, else only the one picked (none when it isn't in the party) @param {{ uid: string }[]} team @param {boolean} won
 * @param {string | null} pick @returns {string[]} */
export const runKept = (team, won, pick) =>
  won ? team.map(m => m.uid) : team.filter(m => m.uid === pick).map(m => m.uid);
/** an item's shop price, for the payout's items line (0 for none) @param {string} id */
export const runItemPrice = id => (ITEMS[id] && ITEMS[id].price) || 0;
/** the payout screen's rows from payoutOf's lines: a label, a note and the Research each brings (the win row only on a
 * win; RL-9b: the items row only on a loss, a win takes the bag home) @param {{ lines: { what: string, n: number, research: number }[] }} pay
 * @param {{ money: number, itemShare: number, released: number, node: number }} rates */
export function runPayoutRows(pay, rates) {
  const pct = Math.round(rates.money * 100),
    say = {
      money: (/** @type {number} */ n) => ['Moneys left', `${plural(n, 'Money')} at ${pct}%`],
      items: n => ['Items in the bag', `worth ${plural(n, 'Money')} at ${pct}%`],
      released: n => ['Billies released', `${n} × ${rates.released}`],
      nodes: n => ['Places reached', `${n} × ${rates.node}`],
      win: () => ['The boss beaten', ''],
      fx: n => ['Perks', `${n > 0 ? '+' : ''}${n}%`],
    };
  const won = pay.lines.some(l => l.what === 'win' && l.n > 0);
  return pay.lines
    .filter(l => (l.what !== 'win' || won) && (l.what !== 'items' || !won))
    .map(l => {
      const [label, note] = (say[/** @type {keyof typeof say} */ (l.what)] || (() => [l.what, '']))(l.n);
      return { label, note, value: l.research };
    });
}
