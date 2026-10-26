// @ts-check
'use strict';
/* ================= BATTLE REWARDS (roguelite track RL-8) =================
   What the end of a battle pays or costs, worked out without the page, so a run's simulation (and a run's own rules)
   can reach it: the outcome (a battle called off at the turn cap ends as walking away from a wild Billie and as a
   loss to a trainer), the fee for losing, the prize money for wild Billies (RL-10: no egg drops any more), and a
   trainer's reward, first win and badge. battle.js endBattle applies them and shows the sheets. Moved out of
   endBattle as it was (tools/test/battle-rewards.test.mjs). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { GENES, ITEMS, PERKS, RULES } from '../game-data.js';
import { geneWords } from './genes.js';
import { billyGraft, dropEncounter, findBilly, geneData, wildPrize } from './rules.js';
import { META_GENES, META_MAX } from './meta-state.js';
import { fieldBadgeKey } from './run-side.js';
import { runFragileDrop } from './run-loop.js';
import { fxMoney, fxOfBillie, fxSplice } from './effects.js';
import { perkOfferMake } from './perks.js';
import { rewardDataGame, rewardOfferMake } from './rewards.js';
import { battleRoll } from './battle-engine.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  battleMoneyFx: [() => battleMoneyFx, v => (battleMoneyFx = v)],
  battleOutcome: [() => battleOutcome],
  // @ts-expect-error -- replaced on purpose
  battleRewards: [() => battleRewards, v => (battleRewards = v)],
  // @ts-expect-error -- replaced on purpose
  battleSettle: [() => battleSettle, v => (battleSettle = v)],
  // @ts-expect-error -- replaced on purpose
  battleSettleWin: [() => battleSettleWin, v => (battleSettleWin = v)],
  // @ts-expect-error -- replaced on purpose
  spliceSample: [() => spliceSample, v => (spliceSample = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the battle's end as endBattle reads it: the turn cap's draw is walking away (wild) or a loss (a trainer)
 * @param {string} kind @param {string | null} over @returns {string | null} */
export const battleOutcome = (kind, over) => (over === 'draw' ? (kind === 'wild' ? 'ran' : 'lose') : over);
/**
 * What a battle that has ended pays and costs. `rules` defaults to the game's. RL-10: it draws no chance any more
 * (a wild win's egg drop, the one roll it took, is gone: eggs come from the ranch); `roll`, the battle's chance, is
 * still taken so every caller's arguments keep their places.
 * @param {{ kind: string, over: string | null, T?: any, tid?: string, foe: { lvl: number }[], fx?: any[] }} b b.fx: a run's
 *   Perks (logic/effects.js), which change the money a win pays
 * @param {{ se: number, flags: Record<string, number>, seats: string[], run?: any }} s
 * @param {(() => number) | null} roll unused since RL-10
 * @param {{ battle: { loseFee: number } }} [rules]
 * @returns {{ o: string | null, fee: number, prize: number, reward: number, first: boolean,
 *   seat: null | { id: string, nu: boolean, pyramids: Record<string, number>, items: Record<string, number> } }}
 */
export function battleRewards(b, s, roll, rules = RULES) {
  const o = battleOutcome(b.kind, b.over),
    out = { o, fee: 0, prize: 0, reward: 0, first: false, seat: /** @type {any} */ (null) };
  /* RL-8: on a run a loss ends the run (no fee) and wins no badge */
  const run = !!s.run;
  if (o === 'lose' && !run) out.fee = Math.floor(s.se * rules.battle.loseFee);
  if (b.kind === 'wild' && o === 'win') {
    out.prize = fxMoney(
      b.fx,
      b.foe.reduce((a, m) => a + wildPrize(m.lvl), 0)
    );
  }
  if (b.kind === 'trainer' && o === 'win' && b.T) {
    out.reward = fxMoney(b.fx, b.T.reward || 0);
    out.first = !s.flags[b.tid || ''];
    const st = b.T.seat;
    if (st && !run)
      out.seat = { id: st.id, nu: !s.seats.includes(st.id), pyramids: st.pyramids || {}, items: st.items || {} };
  }
  return out;
}

/** RL-12c: the rows that change a battle's money: the run's (b.fx) and the money rows of the held items of yours still
 * standing (null with none) @param {any} b */
export function battleMoneyFx(b) {
  const held = b.sides[0].team
    .filter((/** @type {any} */ m) => m.hp > 0)
    .flatMap((/** @type {any} */ m) => (fxOfBillie(m, ITEMS) || []).filter(f => f.kind === 'money'));
  return held.length ? [...(b.fx || []), ...held] : b.fx;
}

/* Studio plan T3.2: what an ended battle does to the save, the same on the page (battle.js endBattle, which shows the
   sheets, seats and the tutorial) and in a run's simulation (logic/run-sim.js) */
/**
 * The battle has ended: what it pays (battleRewards, with the battle's Perks), and on the save: a run battle's
 * checkpoint back to walking, the Hype counter (wins) of everyone standing on a win, a wild encounter gone, the lead's
 * streak (one more on a win, 0 on a loss). RL-13: the "Fainted is gone" challenge takes the fainted out of the run.
 * Returns the pay, the run when it was a run battle (b.runK), and the Billies that left it (`gone`).
 * @param {any} b the battle @param {any} s the save it was fought on (saveData)
 */
export function battleSettle(b, s) {
  const pay = battleRewards(
      { kind: b.kind, over: b.over, T: b.T, tid: b.tid, foe: b.sides[1].team, fx: battleMoneyFx(b) },
      s,
      battleRoll
    ),
    o = pay.o,
    lead = findBilly(b.lead),
    run = s.run && b.runK != null ? s.run : null;
  if (run) run.at = { phase: 'walk', battle: -1 };
  /* v36: the Hype counter */
  if (o === 'win') for (const m of s.team) if (m.hp > 0) m.wins = (m.wins || 0) + 1;
  if (b.kind === 'wild') dropEncounter(b.qid);
  /* RL-13: the "Fainted is gone" challenge: the fainted leave the run (logic/run-loop.js) */
  const gone = run ? runFragileDrop(s) : [];
  if (lead) {
    if (o === 'win') lead.streak = (lead.streak || 0) + 1;
    else if (o === 'lose') lead.streak = 0;
  }
  return { pay, run, gone };
}
/**
 * A win's money and marks (after battleSettle; not for the opening's tutorial battle): a wild win's prize, a
 * trainer's reward and flag, and on a run (`run`) a mini-boss beaten makes the next pick of Perks (RL-12b: a route
 * trainer the next reward pick)
 * (logic/perks.js perkOfferMake, saved on the run before it shows). RL-R2: on a run, the first win over a leader
 * of a type keeps that type's badge for good (s.meta.badges; `pay.badge` names the type, for the sheet).
 * @param {any} b @param {any} s @param {{ o: string | null, prize: number, reward: number, badge?: string }} pay
 * @param {any} run
 */
export function battleSettleWin(b, s, pay, run) {
  if (pay.o !== 'win') return;
  if (b.kind === 'wild' && pay.prize > 0) s.se += pay.prize;
  /* SP-3: a spliced wild Billie knocked out leaves DNA and a sample of its Genes (caught, it keeps them) */
  if (b.kind === 'wild' && b.sides) Object.assign(pay, spliceSample(b.sides[1].team, s, b.fx));
  if (b.kind === 'trainer') {
    s.se += pay.reward;
    if (run && b.T && (b.T.runFoe === 'miniboss' || b.T.runFoe === 'boss') && b.T.type && s.meta) {
      const key = fieldBadgeKey(b.T.type),
        badges = s.meta.badges || (s.meta.badges = {});
      if (!badges[key]) {
        badges[key] = 1;
        pay.badge = b.T.type;
      }
    }
    if (run && b.T && b.T.runFoe === 'miniboss') perkOfferMake(run, PERKS, RULES.run.perks);
    /* RL-12b: a route trainer (or the rival) leaves a reward pick (logic/rewards.js), saved with the battle's end */
    if (run && b.T && (b.T.runFoe === 'route' || b.T.runFoe === 'rival'))
      rewardOfferMake(run, b.tid, rewardDataGame(s.team));
    s.flags[b.tid] = 1;
  }
}

/** SP-3: the beaten wild Billies' splices sampled: each spliced one banks DNA at once (genes.json wild.dna, a Graft's
 * or a Chimera's: meta, kept even if the run is lost), and each of its Genes not in s.meta.genes yet joins it (the
 * library SP-4's Gene Bank opens; a Gene is its id, "shark_tailfin@zuck2"). Returns the DNA and the new Genes in words
 * for the sheet. SP-6: a run's dna rows (Perks) multiply the DNA @param {any[]} foes @param {any} s
 * @param {any[] | null} [fx] the battle's run rows (logic/effects.js) @returns {{ dna: number, sampled: { gene: string, words: string }[] }} */
export function spliceSample(foes, s, fx) {
  const W = GENES.wild.dna,
    /** @type {{ gene: string, words: string }[]} */
    sampled = [];
  let dna = 0;
  for (const m of foes) {
    const g = billyGraft(m);
    if (!g) continue;
    dna += Object.keys(g).length > 1 ? W.chimera : W.graft;
    const lib = s.meta.genes || (s.meta.genes = []);
    for (const [slot, gene] of Object.entries(g)) {
      if (lib.includes(gene) || lib.length >= META_GENES) continue;
      lib.push(gene);
      sampled.push({ gene, words: geneWords(geneData(), slot, gene) });
    }
  }
  if (dna && fx) dna = Math.round(dna * fxSplice(fx, 'dna'));
  if (dna) s.meta.dna = Math.min(META_MAX, (s.meta.dna || 0) + dna);
  return { dna, sampled };
}
