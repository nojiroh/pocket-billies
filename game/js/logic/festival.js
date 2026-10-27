// @ts-check
'use strict';
/* ================= COPPERLEAF'S FESTIVALS (hub track HB-10e) =================
   Which festival is on in Copperleaf (festivals.json, the owner's answers 2026-10-27): at most one, a milestone first
   (while its condition holds: your first win, your tenth run), then a seasonal one by the calendar (a week from its
   MM-DD), then a market day (every few returns). The date is the ranch clock's (logic/ranch-clock.js: a clock turned
   back stands still at the save's mark, a phone ahead of the server counts at the server's pace when signed in, and
   offline it is the phone's own), read on the phone's calendar (its time zone passed in).
   Each time a festival is on is an occasion (`at`: the year a date festival began, or meta.runs for the others): the
   festival market's wares are counted per occasion in meta.fest, so a festival's stock comes back next year (or next
   market day) and not on a reload. What it sells is paid in festivals.json `cur` (Scrap) and goes into the bag for the
   next run, as the fountain's Hi-Potion does (logic/fountain-wish.js).
   Logic only: no DOM, no Date.now, no Math.random (tools/test/festival.test.mjs). */
/** @import { Meta } from '../../types/save-data' */
/** @import { Festival, FestivalsData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  DAY: [() => DAY],
  FEST_ORDER: [() => FEST_ORDER],
  // @ts-expect-error -- replaced on purpose
  festBuy: [() => festBuy, v => (festBuy = v)],
  // @ts-expect-error -- replaced on purpose
  festDate: [() => festDate, v => (festDate = v)],
  // @ts-expect-error -- replaced on purpose
  festDateOn: [() => festDateOn, v => (festDateOn = v)],
  // @ts-expect-error -- replaced on purpose
  festNext: [() => festNext, v => (festNext = v)],
  // @ts-expect-error -- replaced on purpose
  festStock: [() => festStock, v => (festStock = v)],
  // @ts-expect-error -- replaced on purpose
  festivalOn: [() => festivalOn, v => (festivalOn = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ y: number, m: number, d: number, day: number }} FestDate  a calendar day (month 1-12) and its day
 * number (days since 1970-01-01) */
/** @typedef {{ id: string, F: Festival, at: number }} FestOn  the festival on, and its occasion */

/** which kind goes first when two would be on at once */
export const FEST_ORDER = Object.freeze({ milestone: 0, date: 1, market: 2 });
export const DAY = 86400000;

/** the phone's calendar day at a time: ms since 1970 (the ranch clock's) less the phone's time zone offset (minutes,
 * as Date's getTimezoneOffset: + west of Greenwich) @param {number} ms @param {number} [tzMin]
 * @returns {FestDate} */
export function festDate(ms, tzMin = 0) {
  const day = Math.floor((ms - (Number.isFinite(tzMin) ? tzMin : 0) * 60000) / DAY),
    t = new Date(day * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), day };
}

/** the occasion of a date festival on this day: the year its week began, or null when it isn't on (a week that
 * starts late in December runs on into January) @param {Festival} F @param {FestDate} D @returns {number | null} */
export function festDateOn(F, D) {
  if (F.kind !== 'date' || !F.from) return null;
  const [m, d] = F.from.split('-').map(Number);
  for (const y of [D.y, D.y - 1]) {
    const start = Math.floor(Date.UTC(y, m - 1, d) / DAY);
    if (D.day >= start && D.day < start + (F.days || 1)) return y;
  }
  return null;
}

/** the festival on now in Copperleaf, or null: a milestone whose condition holds, then a date festival in its week,
 * then a market day (meta.runs a multiple of its `every`, after the first run); in festivals.json's order within a
 * kind @param {FestivalsData | null | undefined} FS festivals.json @param {Meta} meta @param {FestDate} D today
 * @param {(cond: string) => boolean} holds whether a condition holds now @returns {FestOn | null} */
export function festivalOn(FS, meta, D, holds) {
  const all = Object.entries((FS && FS.festivals) || {}),
    runs = meta.runs || 0;
  for (const kind of /** @type {(keyof typeof FEST_ORDER)[]} */ (Object.keys(FEST_ORDER)))
    for (const [id, F] of all) {
      if (F.kind !== kind) continue;
      if (kind === 'milestone' && F.when && holds(F.when)) return { id, F, at: runs };
      if (kind === 'date') {
        const y = festDateOn(F, D);
        if (y != null) return { id, F, at: y };
      }
      if (kind === 'market' && runs > 0 && F.every && runs % F.every === 0) return { id, F, at: runs };
    }
  return null;
}

/** the festival market's wares this occasion: each with how many are left
 * @param {FestOn} on @param {Meta} meta @returns {{ i: number, ware: Festival['stock'][number], left: number }[]} */
export function festStock(on, meta) {
  const M = meta.fest && meta.fest.id === on.id && meta.fest.at === on.at ? meta.fest.got : {};
  return on.F.stock.map((ware, i) => ({ i, ware, left: Math.max(0, ware.n - (M[i] || 0)) }));
}

/** buy one of the festival market's wares: pay in `cur`, put it in the bag (an item) or the pyramids (a coin), count
 * it on this occasion. 'ok', 'gone' (none left this time) or 'poor' (not enough to pay)
 * @param {{ meta: Meta, items?: Record<string, number>, pyramids?: Record<string, number> }} s
 * @param {FestOn} on @param {number} i the ware's place in the stock @param {string} cur festivals.json cur
 * @returns {'ok' | 'gone' | 'poor'} */
export function festBuy(s, on, i, cur) {
  const W = festStock(on, s.meta)[i];
  if (!W || W.left <= 0) return 'gone';
  const M = /** @type {any} */ (s.meta);
  if ((M[cur] || 0) < W.ware.price) return 'poor';
  M[cur] -= W.ware.price;
  if (!(s.meta.fest && s.meta.fest.id === on.id && s.meta.fest.at === on.at))
    s.meta.fest = { id: on.id, at: on.at, got: {} };
  s.meta.fest.got[i] = (s.meta.fest.got[i] || 0) + 1;
  if (W.ware.coin) {
    const P = s.pyramids || (s.pyramids = {});
    P[W.ware.coin] = (P[W.ware.coin] || 0) + 1;
  } else if (W.ware.item) {
    const B = s.items || (s.items = {});
    B[W.ware.item] = (B[W.ware.item] || 0) + 1;
  }
  return 'ok';
}

/** what is coming (the notice board): each date festival's days until it begins (within a year, the one on now
 * left out) and the returns until the next market day @param {FestivalsData | null | undefined} FS
 * @param {Meta} meta @param {FestDate} D @returns {{ id: string, F: Festival, days?: number, runs?: number }[]} */
export function festNext(FS, meta, D) {
  /** @type {{ id: string, F: Festival, days?: number, runs?: number }[]} */
  const out = [];
  for (const [id, F] of Object.entries((FS && FS.festivals) || {})) {
    if (F.kind === 'date' && F.from && festDateOn(F, D) == null) {
      const [m, d] = F.from.split('-').map(Number);
      let start = Math.floor(Date.UTC(D.y, m - 1, d) / DAY);
      if (start <= D.day) start = Math.floor(Date.UTC(D.y + 1, m - 1, d) / DAY);
      out.push({ id, F, days: start - D.day });
    }
    if (F.kind === 'market' && F.every) {
      const runs = meta.runs || 0,
        r = F.every - (runs % F.every);
      out.push({ id, F, runs: r });
    }
  }
  return out.sort((a, b) => (a.days ?? (a.runs || 0) * 1000) - (b.days ?? (b.runs || 0) * 1000));
}
