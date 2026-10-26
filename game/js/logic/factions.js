// @ts-check
'use strict';
/* ================= FACTIONS (roguelite track RL-14) =================
   The runs' enemy factions (factions.json): the Bureau of Lost, Found and Beans and its bots. A bot is a robot
   (phase 17, logic/fighters.js) built from a gem and four robots.json parts; the faction says which builds it fields
   and how often (by weight), where wild ones are met (a run route from a map row on, in some biomes; every wild one in
   a scrapyard), which trainer classes are its agents and how many bots each fields beside its Billies, and what
   beating its bots leaves: a salvage pick of their parts or a stack of Scrap (logic/rewards.js takes it). A bot is
   never caught or taxed (battle-engine.js catchable).
   Logic only: no DOM, no Date, no Math.random (tools/test/factions.test.mjs). */
/** @import { Faction, FactionBot } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  factionBotEntry: [() => factionBotEntry],
  // @ts-expect-error -- replaced on purpose
  factionBotOf: [() => factionBotOf, v => (factionBotOf = v)],
  // @ts-expect-error -- replaced on purpose
  factionBotPick: [() => factionBotPick, v => (factionBotPick = v)],
  factionBotSp: [() => factionBotSp],
  // @ts-expect-error -- replaced on purpose
  factionOfClass: [() => factionOfClass, v => (factionOfClass = v)],
  // @ts-expect-error -- replaced on purpose
  factionWildChance: [() => factionWildChance, v => ((factionWildChance = v), provide({ factionWildChance }))],
});
/* eslint-enable no-func-assign */
provide({ factionWildChance });
/* to-module: end */
/** a bot's sp, as a robot's (fighters.js robotSp: 'bot:<gem>.<torso>.<armL>.<armR>.<legs>') @param {FactionBot} B */
export const factionBotSp = B => 'bot:' + [B.gem, B.torso, B.armL, B.armR, B.legs].join('.');
provide({ factionBotSp }); /* to-module */

/** a bot as a trainer's team entry (game-data.js trainerTeam builds it with new parts; its name is its nickname)
 * @param {FactionBot} B @param {number} lvl */
export const factionBotEntry = (B, lvl) => ({
  sp: 'robot',
  lvl,
  nick: B.name,
  robot: { gem: B.gem, torso: B.torso, armL: B.armL, armR: B.armR, legs: B.legs },
});

/** a bot of the faction, drawn by weight (ids in order, so the draw stays put when the data's order changes)
 * @param {{ pick: (w: Record<string, number>) => string }} g @param {Faction} F @returns {string} */
export function factionBotPick(g, F) {
  return g.pick(
    Object.fromEntries(
      Object.keys(F.bots)
        .sort()
        .filter(k => F.bots[k].weight > 0)
        .map(k => [k, F.bots[k].weight])
    )
  );
}

/** the faction (and its id) whose agents a trainer class is, or null @param {Record<string, Faction>} factions
 * @param {string} cls */
export function factionOfClass(factions, cls) {
  for (const id of Object.keys(factions).sort())
    if (factions[id].agents.classes.includes(cls)) return { id, F: factions[id] };
  return null;
}

/** which faction's bot a robot sp is (its build exactly), or null @param {Record<string, Faction>} factions
 * @param {string} sp @returns {{ faction: string, bot: string, B: FactionBot } | null} */
export function factionBotOf(factions, sp) {
  for (const faction of Object.keys(factions).sort())
    for (const bot of Object.keys(factions[faction].bots).sort()) {
      const B = factions[faction].bots[bot];
      if (factionBotSp(B) === sp) return { faction, bot, B };
    }
  return null;
}

/** the chance a run place's wild one is the faction's bot: every one in a scrapyard; on another place from the map row
 * `fromRow` on, in its biomes; 0 elsewhere (a town's, a waystation's, the landing's too)
 * @param {Faction} F @param {{ type: string, row: number, biome?: string }} node */
export function factionWildChance(F, node) {
  if (node.type === 'scrapyard') return 1;
  if (node.type !== 'route' && node.type !== 'miniboss' && node.type !== 'boss') return 0;
  return node.row >= F.wild.fromRow && F.wild.biomes.includes(node.biome || '') ? F.wild.chance : 0;
}
