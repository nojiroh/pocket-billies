// @ts-check
'use strict';
/* ===== THE BUREAU IN BATTLE (style track SY-5) =====
   A faction with a look (factions.json `look`; today only the Bureau) shows its paperwork in battle, and only there:
   - stamps, one at a time: RETRIEVED when its bot's hit knocks out one of yours, VOID when you knock out its bot,
     DENIED on your win, PENDING over its boss's win line (the sheet after you beat it);
   - the Notice of Retrieval: while its boss's join intro plays (battle-stage.js 'join'), a form lists the bots that
     lock together as line items, is stamped, and goes before they lock: no added time, and a tap hides it;
   - ID plates: its bots' plates are form paper with a serial number (from the bot's id) and its `property` line.
   Who fights for it: a wild or agent bot whose build is one of its bots (logic/factions.js factionBotOf), or a boss
   whose bosses.json `faction` names it.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { factionBotOf } from './factions.js';
/* eslint-disable no-func-assign */
expose({
  NOTICE_SLOTS: [() => NOTICE_SLOTS],
  // @ts-expect-error -- replaced on purpose
  battleFactionOf: [() => battleFactionOf, v => (battleFactionOf = v)],
  // @ts-expect-error -- replaced on purpose
  factionSerial: [() => factionSerial, v => (factionSerial = v)],
  // @ts-expect-error -- replaced on purpose
  koBy: [() => koBy, v => (koBy = v)],
  // @ts-expect-error -- replaced on purpose
  koStampMoment: [() => koStampMoment, v => (koStampMoment = v)],
  // @ts-expect-error -- replaced on purpose
  noticeOf: [() => noticeOf, v => (noticeOf = v)],
  // @ts-expect-error -- replaced on purpose
  noticeTimes: [() => noticeTimes, v => (noticeTimes = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the bots of a boss, in the order the notice lists them (the leader first) */
export const NOTICE_SLOTS = /** @type {const} */ (['torso', 'armL', 'armR', 'legs']);

/** the faction a fighter in battle fights for (one with a look), and its id there, or null
 * @param {Record<string, any>} factions factions.json factions @param {Record<string, any>} bosses bosses.json bosses
 * @param {{ sp?: string, boss?: any } | null | undefined} x the fighter (a battle snapshot's or the fighter itself)
 * @param {{ boss?: string } | null | undefined} T the battle's trainer, if any
 * @returns {{ faction: string, id: string, look: any } | null} */
export function battleFactionOf(factions, bosses, x, T) {
  if (!x || !factions) return null;
  const D = x.boss && T && T.boss && bosses ? bosses[T.boss] : null;
  if (D && D.faction && factions[D.faction] && factions[D.faction].look)
    return { faction: D.faction, id: /** @type {string} */ (T && T.boss), look: factions[D.faction].look };
  if (typeof x.sp !== 'string' || !x.sp.startsWith('bot:')) return null;
  const w = factionBotOf(factions, x.sp);
  return w && factions[w.faction].look ? { faction: w.faction, id: w.bot, look: factions[w.faction].look } : null;
}

/** a bot's serial number on its plate, the same every time for the same id: 'No. 4821-CO' @param {string} id */
export function factionSerial(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  const letters =
    id
      .replace(/[^a-z]/gi, '')
      .slice(0, 2)
      .toUpperCase() || 'XX';
  return `No. ${1000 + (h % 9000)}-${letters}`;
}

/** who knocked out the fighter whose faint is event i: the attacker of the last hit on it before then (a move, or the
 * spread hit that rode on one), or null when that was no one's hit (a burn, the stones, recoil, a delayed hit)
 * @param {{ an?: any }[]} events the battle's events @param {number} i the faint's @returns {number | null} */
export function koBy(events, i) {
  const ev = events[i],
    si = ev && ev.an && ev.an.si;
  if (si == null) return null;
  for (let j = i - 1; j >= 0; j--) {
    const an = events[j] && events[j].an;
    if (!an) continue;
    if (an.k === 'move' && an.ti === si && an.dmg > 0 && an.si !== si) return an.si;
    if (an.k === 'hurt' && an.si === si && an.dmg > 0) {
      if (an.fx !== 'spread') return null;
      /* a spread hit's move is the nearest move before it */
      for (let m = j - 1; m >= 0; m--) {
        const a2 = events[m] && events[m].an;
        if (a2 && a2.k === 'move') return a2.si !== si ? a2.si : null;
      }
      return null;
    }
  }
  return null;
}

/** the stamp a faint gets (a look.stamps key), or null: 'void' when the fallen fights for the faction, 'retrieved'
 * when one of yours fell to a hit by one that does
 * @param {{ an?: any }[]} events @param {number} i the faint's event @param {(k: number) => number} side 0 yours, 1
 * theirs @param {(k: number) => boolean} ofFaction whether fighter k fights for the faction
 * @returns {'void' | 'retrieved' | null} */
export function koStampMoment(events, i, side, ofFaction) {
  const an = events[i] && events[i].an;
  if (!an || an.k !== 'faint' || an.si == null) return null;
  if (side(an.si) === 1) return ofFaction(an.si) ? 'void' : null;
  const by = koBy(events, i);
  return by != null && side(by) === 1 && ofFaction(by) ? 'retrieved' : null;
}

/** the notice a boss's join intro shows: its title (look.notice), a form number (look.forms, picked by the boss's id),
 * and its bots as line items (bosses.json bots, the leader first), or null without a look or bots
 * @param {any} look @param {any} D a bosses.json boss @param {string} id its id
 * @returns {{ title: string, form: string, lines: string[] } | null} */
export function noticeOf(look, D, id) {
  if (!look || !D || !D.bots) return null;
  const lines = NOTICE_SLOTS.map(k => D.bots[k]).filter(Boolean);
  if (!lines.length) return null;
  const forms = look.forms || [];
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return { title: look.notice || 'Notice', form: forms.length ? forms[h % forms.length] : '', lines };
}

/** when the notice's parts play, in ms from the join's start, all before the bots lock together (lock): it slides up,
 * its lines come in one by one, the stamp comes down, and it slides away so it is gone as they lock
 * @param {number} lock the join's lock time @param {number} n its lines
 * @returns {{ up: number, lines: number[], stamp: number, away: number, gone: number }} */
export function noticeTimes(lock, n) {
  const up = Math.round(lock * 0.12),
    away = Math.round(lock * 0.85),
    stamp = Math.round(lock * 0.52),
    step = n > 1 ? Math.min(110, (stamp - up - 60) / (n - 1)) : 0;
  return {
    up,
    lines: Array.from({ length: n }, (_, i) => Math.round(up + 40 + i * step)),
    stamp,
    away,
    gone: lock,
  };
}
