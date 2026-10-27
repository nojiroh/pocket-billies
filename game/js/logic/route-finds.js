// @ts-check
'use strict';
/* ================= ROUTE FINDS AND CUT BRAMBLES (routes track RT-4b) =================
   What a run route's hard corners hold, as Pokémon's item balls and Cut trees (the owner, 2026-10-25 and 2026-10-27):
   - finds: rules.json run.finds.perRoute of them on a route place's free dead ends and pockets, else its clearings
     (routeRareSpots' rule:
     6 m from the trainers, 4 m from the set pieces, not under a forest's canopy; not the rarer one's), a pyramid on
     the ground (scenery find_pyramid). Each is a card of the reward pick (rewards.json): about `rare` of them one of
     the rare cards (`rareCards`: a Max Revive, a Gold Pyramid, the Shining Stone), else a small one (an item or a
     candy) by its weight. You pick one up by walking onto it, once a run (the run's flag `find.<node>.<k>`; its `unless` reads it, so it goes);
   - brambles: at most `brambles` a route place, a row of bush_bramble across the mouth mapgen marked (logic/mapgen.js
     mapgenMouths: shuts the spot off and nothing that must stay open) in front of the rarer one's spot or a find's.
     Tapping one asks for Cut as the side area's obstacle does (field-moves.js); used, the whole row goes for the run
     (its flag `cut.<node>.<spot>`, read by the condition `opened:cut.<node>.<spot>` in each bramble's `unless`).
   Put into the run's scenes as props once its trainers and the rarer ones' spots are known (run-world.js), every time
   the world is made from the same seed the same. Logic only: no DOM, no Date, no Math.random
   (tools/test/route-finds.test.mjs). */
/** @import { Run } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { rngFrom } from './rng.js';
import { runNodeSeed } from './run-map.js';
import { routeUnderCanopy } from './route-trainers.js';
/* eslint-disable no-func-assign */
expose({
  ROUTE_FIND_REACH: [() => ROUTE_FIND_REACH],
  ROUTE_FIND_SPOTS: [() => ROUTE_FIND_SPOTS],
  // @ts-expect-error -- replaced on purpose
  routeFindAt: [() => routeFindAt, v => ((routeFindAt = v), provide({ routeFindAt }))],
  // @ts-expect-error -- replaced on purpose
  routeFindCard: [() => routeFindCard, v => (routeFindCard = v)],
  // @ts-expect-error -- replaced on purpose
  routeFindGive: [() => routeFindGive, v => ((routeFindGive = v), provide({ routeFindGive }))],
  // @ts-expect-error -- replaced on purpose
  routeFindsPlace: [() => routeFindsPlace, v => (routeFindsPlace = v)],
});
/* eslint-enable no-func-assign */
provide({ routeFindAt, routeFindGive });
/* to-module: end */
/** the spot kinds a find lies on, the hard ones first: a clearing only when no dead end or pocket is free (most dead
 * ends lie under a forest's canopy, where the camera can't see a pyramid) */
export const ROUTE_FIND_SPOTS = ['deadend', 'pocket', 'clearing'];
/** how near (m) you walk to a find to pick it up */
export const ROUTE_FIND_REACH = 0.8;

/** @typedef {{ kind: string, item?: string, pyramid?: string, n?: number, weight?: number }} FindCard */
/** @typedef {{ perRoute: [number, number], rare: number, rareCards: string[], brambles: number }} FindRules */

/** a find's card from the reward pick's cards (rewards.json): one of `rareCards` (by their weights) with the chance
 * `rare`, else a small one, an item or a candy that is no rare card, by its weight
 * @param {{ next: () => number }} g @param {Record<string, FindCard>} cards @param {FindRules} F @returns {string} */
export function routeFindCard(g, cards, F) {
  const rare = F.rareCards.filter(k => cards[k]),
    small = Object.keys(cards).filter(
      k => !rare.includes(k) && (cards[k].kind === 'item' || cards[k].kind === 'candy')
    ),
    pickOf = (/** @type {string[]} */ L) => {
      const sum = L.reduce((a, k) => a + (cards[k].weight || 1), 0);
      let r = g.next() * sum;
      for (const k of L) if ((r -= cards[k].weight || 1) < 0) return k;
      return L[L.length - 1];
    };
  return g.next() < F.rare && rare.length ? pickOf(rare) : pickOf(small);
}

/**
 * RT-4b: each run route's finds and its bramble row, put into its scene as props ({ k, x, z, find, card } and
 * { k: 'bush_bramble', act: 'field', move: 'cut', cut, unless }, both marked `rt4b`; those already there are put
 * again, so making the world twice gives one set). On the places routeRareSpots fills, after it.
 * @param {Run} run @param {Record<string, any>} trainers the run's route trainers (routeTrainersPlace)
 * @param {any[]} scenes the run's scenes by node @param {Record<number, [number, number]>} rare routeRareSpots'
 * @param {{ rules: FindRules, cards: Record<string, FindCard> }} D
 * @returns {Record<number, { finds: string[], cut: string }>} what each place got (the debug log's)
 */
export function routeFindsPlace(run, trainers, scenes, rare, D) {
  /** @type {Record<number, [number, number][]>} */
  const stand = {};
  for (const T of Object.values(trainers))
    if (T.route && T.runNode != null && T.route.at) {
      (stand[T.runNode] ||= []).push(T.route.at);
      if (T.route.mate) stand[T.runNode].push(T.route.mate);
    }
  /** @type {Record<number, { finds: string[], cut: string }>} */
  const out = {};
  const F = D.rules;
  if (!run.map || !F) return out;
  for (const ni of Object.keys(stand)) {
    const i = +ni,
      sc = scenes[i];
    if (!sc || !sc.props) continue;
    sc.props = sc.props.filter((/** @type {any} */ p) => !p.rt4b);
    const g = rngFrom(runNodeSeed(run.seed, i), 'route|finds'),
      spots = sc.spots || [],
      pieces = sc.pieces || [],
      canopy = sc.props.filter((/** @type {any} */ q) => /canopy/.test(q.k)),
      R = rare[i],
      isRare = (/** @type {any} */ p) => !!R && Math.hypot(R[0] - p.x, R[1] - p.z) < 0.5,
      free = spots.filter(
        (/** @type {any} */ p) =>
          ROUTE_FIND_SPOTS.includes(p.kind) &&
          !isRare(p) &&
          stand[i].every(t => Math.hypot(t[0] - p.x, t[1] - p.z) > 6) &&
          pieces.every((/** @type {any} */ q) => Math.hypot(q.x - p.x, q.z - p.z) > 4) &&
          canopy.every((/** @type {any} */ q) => !routeUnderCanopy(q, p))
      );
    /* a shuffle on the place's own stream, the dead ends and pockets before the clearings, then as many as perRoute
       draws, 6 m apart */
    for (let n = free.length - 1; n > 0; n--) {
      const m = g.int(0, n);
      [free[n], free[m]] = [free[m], free[n]];
    }
    free.sort((a, b) => +(a.kind === 'clearing') - +(b.kind === 'clearing'));
    const want = g.int(F.perRoute[0], F.perRoute[1]),
      took = /** @type {any[]} */ ([]);
    for (const p of free) {
      if (took.length >= want) break;
      if (took.every(q => Math.hypot(q.x - p.x, q.z - p.z) > 6)) took.push(p);
    }
    const finds = took.map((p, k) => {
      const card = routeFindCard(g, D.cards, F);
      const flag = `find.${i}.${k}`;
      sc.props.push({ k: 'find_pyramid', x: p.x, z: p.z, find: flag, card, unless: `opened:${flag}`, rt4b: 1 });
      return card;
    });
    /* the bramble row: in front of the rarer one or a find, where mapgen found a mouth */
    const guard = spots.filter((/** @type {any} */ p) => p.mouth && (isRare(p) || took.includes(p)));
    let cut = '';
    if (F.brambles > 0 && guard.length) {
      const sp = guard[g.int(0, guard.length - 1)],
        key = `cut.${i}.${spots.indexOf(sp)}`;
      /* the label (Cut) over the middle one only, not over every bramble of the row */
      sp.mouth.forEach(([/** @type {number} */ x, /** @type {number} */ z], /** @type {number} */ n) =>
        sc.props.push({
          k: 'bush_bramble',
          x,
          z,
          act: 'field',
          move: 'cut',
          cut: key,
          unless: `opened:${key}`,
          rt4b: 1,
          ...(n === sp.mouth.length >> 1 ? { label: 'Cut' } : {}),
        })
      );
      cut = key;
    }
    if (finds.length || cut) out[i] = { finds, cut };
  }
  return out;
}

/** the find you are passing at (x, z): the first find prop within ROUTE_FIND_REACH whose flag is not set, or null
 * @param {any} sc @param {number} x @param {number} z @param {Record<string, any>} flags the run's flags
 * @returns {{ card: string, flag: string } | null} */
export function routeFindAt(sc, x, z, flags) {
  for (const p of (sc && sc.props) || []) {
    if (!p.find || Math.hypot(p.x - x, p.z - z) > ROUTE_FIND_REACH) continue;
    if (!(flags || {})[p.find]) return { card: p.card, flag: p.find };
  }
  return null;
}

/** a find's card into the bag: its item, or its pyramids, `n` of them (1 when not given); the id and count given, or
 * null for a card that is neither @param {{ items: Record<string, number>, pyramids: Record<string, number> }} s
 * @param {FindCard | undefined} c @returns {{ id: string, pyramid: boolean, n: number } | null} */
export function routeFindGive(s, c) {
  if (!c) return null;
  const n = c.n || 1;
  if (c.pyramid) {
    s.pyramids[c.pyramid] = (s.pyramids[c.pyramid] || 0) + n;
    return { id: c.pyramid, pyramid: true, n };
  }
  if (!c.item) return null;
  s.items[c.item] = (s.items[c.item] || 0) + n;
  return { id: c.item, pyramid: false, n };
}
