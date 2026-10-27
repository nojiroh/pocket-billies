// @ts-check
'use strict';
/* ================= SIDE AREAS AND FIELD MOVES (roguelite track RL-R2) =================
   The owner: "it has to be a bit like he's in Pokémon". Some runs hide a side area behind a field move (Surf, Rock
   Smash, Cut: fieldMoves.json). Its obstacle stands at the north exit of a place on the main path (a shore, a cracked
   boulder, a thorny tree); it opens for a Billie of the move's type once that type's badge is kept (meta.badges), and
   then you walk through, by a seam, into the area's first place. rules.json run.side decides, from the run's seed:
   - a detour (most runs): 2-4 places (routes, a leader of its own, then a town: WM-2) all at the next row's level; the
     last place's way out (a one-way link: a current, a tunnel, a trail) sets you down on a place of the next row
     of the main path, the one the obstacle's place leads to;
   - or an alternate path (a few runs): 2-3 places alongside the main path's rows, ending at its own mini-boss and
     the town after it (WM-2: the leader first, as on the main path) and coming back by its way out to the main
     path's next row; or, now and then, ending at a boss of its own, a town before it (the run is won there, as at
     the main boss).
   Never both on one run. A side area's places come after the main path's in run.map.nodes, marked `side: 1`, linked
   one to the next (`to`) in a chain, and run.map.side says the rest: its kind, move, name, the place with the
   obstacle (`from`), where the way out goes (`to`, -1 for an alternate path's own boss), its places in order, its
   leader (a trainer id: a leader the region didn't pick, leaning to the region's types and away from the move's own,
   so the area can win you a new badge), its own species (whole lines the region's dex left out, in their base
   variety) and, once the obstacle is open, `open: 1`.
   The main map is made as before (run-map.js runMapMake); the side is added after it, from streams of its own, so a
   run's main path and everything keyed by it stay the same with or without a side. The map checks and the seed sweep
   (data-checks.js) look at main maps; the side has its own (runSideProblems).
   Logic only: no DOM, runs in Node (tools/test/run-side.test.mjs). Every table comes in as an argument. */
/** @import { RunMap, RunNode, RunSide } from '../../types/save-data' */
/** @import { FieldMove, RunSideRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  RUN_SIDE_KINDS: [() => RUN_SIDE_KINDS],
  RUN_SIDE_MOD: [() => RUN_SIDE_MOD],
  fieldBadgeKey: [() => fieldBadgeKey],
  // @ts-expect-error -- replaced on purpose
  fieldMoveState: [() => fieldMoveState, v => ((fieldMoveState = v), provide({ fieldMoveState }))],
  fieldMoveText: [() => fieldMoveText],
  // @ts-expect-error -- replaced on purpose
  runSideAdd: [() => runSideAdd, v => (runSideAdd = v)],
  // @ts-expect-error -- replaced on purpose
  runSideDex: [() => runSideDex, v => (runSideDex = v)],
  // @ts-expect-error -- replaced on purpose
  runSideForce: [() => runSideForce, v => (runSideForce = v)],
  // @ts-expect-error -- replaced on purpose
  runSideLeader: [() => runSideLeader, v => (runSideLeader = v)],
  // @ts-expect-error -- replaced on purpose
  runSideLinked: [() => runSideLinked, v => (runSideLinked = v)],
  runSideMain: [() => runSideMain],
  // @ts-expect-error -- replaced on purpose
  runSideOpen: [() => runSideOpen, v => (runSideOpen = v)],
  // @ts-expect-error -- replaced on purpose
  runSideProblems: [() => runSideProblems, v => (runSideProblems = v)],
  // @ts-expect-error -- replaced on purpose
  runSideTypes: [() => runSideTypes, v => (runSideTypes = v)],
});
/* eslint-enable no-func-assign */
provide({ fieldMoveState });
/* to-module: end */
/** the kinds of side area: a detour off the main path and back, or an alternate path alongside it */
export const RUN_SIDE_KINDS = ['detour', 'alt'];
/** the debug menu's run mod that forces a side area: `dbg_side_<kind>_<move>` (dbg_side_detour_cut) */
export const RUN_SIDE_MOD = 'dbg_side_';
/** a kept badge's key in meta.badges: the type's id in lower case ('Water' -> 'water') @param {string} type */
export const fieldBadgeKey = type => String(type || '').toLowerCase();
/** the side area a run's mods force ({ kind, move }), or null @param {string[]} mods */
export function runSideForce(mods) {
  for (const m of mods || []) {
    if (!m.startsWith(RUN_SIDE_MOD)) continue;
    const [kind, ...rest] = m.slice(RUN_SIDE_MOD.length).split('_');
    if (RUN_SIDE_KINDS.includes(kind) && rest.length) return { kind, move: rest.join('_') };
  }
  return null;
}
/** is a map node on the main path (not a side area's place) @param {RunNode} node */
export const runSideMain = node => !node.side;

/**
 * @typedef {{ id: string, names: string[], types: string[][] }} SideLine a line as the region reads it (run-region.js)
 * @typedef {{ rules: RunSideRules, moves: Record<string, FieldMove>, lean?: Record<string, number>,
 *   lines?: SideLine[], dex?: string[], leaders?: { id: string, type: string }[], used?: string[],
 *   force?: { kind: string, move: string } | null }} RunSideData
 * lean: the region theme's types (a move of them is likelier, a leader of them too); lines and dex: the game's lines
 * and the region's dex (the side's species are lines it left out); leaders: every mini-boss leader and its type;
 * used: the leaders the region already picked
 */
/** the node types of a side area's places, in order: a detour's `n` places, an alternate path's `n` (WM-2: its
 * leader, then the town as on the main path; a detour of 2 has no town), or one ending at a boss of its own (a town
 * before it) @param {string} kind @param {number} n @param {boolean} boss @returns {string[]} */
export function runSideTypes(kind, n, boss) {
  if (kind === 'alt' && boss)
    return n <= 2 ? (n === 1 ? ['boss'] : ['town', 'boss']) : [...Array(n - 2).fill('route'), 'town', 'boss'];
  if (n <= 2) return n === 1 ? ['miniboss'] : kind === 'alt' ? ['miniboss', 'town'] : ['route', 'miniboss'];
  return [...Array(n - 2).fill('route'), 'miniboss', 'town'];
}
/** the side's species: up to two whole lines the region's dex left out, drawn leaning to the move's type, each in
 * its base variety (null when the dex holds every line: the side then shares the region's)
 * @param {string} seed @param {SideLine[]} lines @param {string[]} dex @param {string} type */
export function runSideDex(seed, lines, dex, type) {
  const g = rngFrom(seed, 'side|dex'),
    inDex = new Set(dex),
    /* a line is in the region when any of its varieties' species is: its base ids are id + stage, a form's start
       with the line's id too (forms.js formSpeciesId) */
    left = lines.filter(L => ![...inDex].some(sp => sp.startsWith(L.id)));
  /** @type {string[]} */
  const out = [];
  let pool = left;
  for (let k = 0; k < 2 && pool.length; k++) {
    const W = Object.fromEntries(pool.map(L => [L.id, 1 + (L.types.flat().includes(type) ? 2 : 0)])),
      id = g.pick(W),
      L = /** @type {SideLine} */ (pool.find(l => l.id === id));
    pool = pool.filter(l => l !== L);
    out.push(...L.names.map((_, st) => L.id + st));
  }
  return out.length ? out : null;
}
/** the side's leader: one the region didn't pick, leaning to the region's types and away from the move's own (its
 * badge is held already), else any; null with none @param {string} seed @param {RunSideData} S @param {string} type */
export function runSideLeader(seed, S, type) {
  const all = S.leaders || [],
    free = all.filter(L => !(S.used || []).includes(L.id)),
    from = free.length ? free : all,
    other = from.filter(L => L.type !== type),
    pool = other.length ? other : from;
  if (!pool.length) return null;
  const lean = S.lean || {};
  return rngFrom(seed, 'side|leader').pick(Object.fromEntries(pool.map(L => [L.id, 1 + (lean[L.type] || 0)])));
}
/**
 * add a side area to a run's main map (after runMapMake): which kind (or none), which move, where, its places and
 * the rest of run.map.side. Changes nothing when the roll says none or nothing fits. Returns the side or null
 * @param {string} seed @param {RunMap} map @param {RunSideData} S @returns {RunSide | null}
 */
export function runSideAdd(seed, map, S) {
  const R = S.rules,
    moves = S.moves || {};
  if (!R || map.side || !map.nodes.length) return null;
  const force = S.force && moves[S.force.move] && RUN_SIDE_KINDS.includes(S.force.kind) ? S.force : null;
  /* the kind: a detour, an alternate path or none, from one draw */
  const u = rngFrom(seed, 'side|kind').next(),
    kind = force ? force.kind : u < R.detour ? 'detour' : u < R.detour + R.alt ? 'alt' : '';
  if (!kind) return null;
  /* the move, by weight, leaning to the region's types */
  const lean = S.lean || {},
    W = Object.fromEntries(
      Object.entries(R.moves || {})
        .filter(([k, w]) => moves[k] && w > 0)
        .map(([k, w]) => [k, w + (lean[moves[k].type] ? R.lean : 0)])
    );
  if (!force && !Object.keys(W).length) return null;
  const move = force ? force.move : rngFrom(seed, 'side|move').pick(W),
    M = moves[move],
    g = rngFrom(seed, 'side|shape'),
    last = Math.max(...map.nodes.map(n => n.row)),
    span = kind === 'detour' ? R.places : R.altRows,
    n = g.int(span[0], span[1]),
    boss = kind === 'alt' && g.next() < R.altBoss,
    /** a main node's index by row and lane order */
    byRow = (/** @type {number} */ row) => map.nodes.flatMap((nd, i) => (nd.row === row && runSideMain(nd) ? [i] : [])),
    /* where the obstacle can stand: a route or town (else any place but the landing's row and the boss), with room
       for the side after it */
    fits = (/** @type {number} */ i) => {
      const nd = map.nodes[i],
        r = nd.row;
      if (r < 1 || nd.type === 'boss' || nd.type === 'landing') return false;
      if (kind === 'detour') return r + 1 <= last - 1 && nd.to.length > 0;
      if (boss) return r === last - n;
      return r + n + 1 <= last;
    },
    plain = map.nodes.flatMap((nd, i) => (fits(i) && ['route', 'town'].includes(nd.type) ? [i] : [])),
    any = map.nodes.flatMap((nd, i) => (fits(i) ? [i] : [])),
    spots = plain.length ? plain : any;
  if (!spots.length) return null;
  const from = spots[rngFrom(seed, 'side|from').int(0, spots.length - 1)],
    r = map.nodes[from].row,
    types = runSideTypes(kind, n, boss),
    rows = types.map((_, k) => (kind === 'detour' ? r + 1 : r + 1 + k)),
    /* the way out: a detour to the place the obstacle's place leads to first; an alternate path to the first place
       of the row after its last; none past its own boss */
    to = boss ? -1 : kind === 'detour' ? map.nodes[from].to[0] : byRow(rows[rows.length - 1] + 1)[0],
    zones = map.nodes.some(nd => nd.zone !== undefined),
    first = map.nodes.length,
    /** @type {number[]} */
    places = [];
  types.forEach((type, k) => {
    const row = rows[k],
      /** @type {RunNode} */
      node = { type, row, lane: 0, to: k + 1 < types.length ? [first + k + 1] : [], seen: 0, biome: M.biome, side: 1 };
    if (zones) {
      const z = byRow(Math.min(row, last))
        .map(i => map.nodes[i].zone)
        .find(v => v !== undefined);
      node.zone = z !== undefined ? z : /** @type {number} */ (map.nodes[from].zone);
    }
    places.push(map.nodes.length);
    map.nodes.push(node);
  });
  const leader = runSideLeader(seed, S, M.type),
    dex = S.lines && S.dex ? runSideDex(seed, S.lines, S.dex, M.type) : null,
    /** @type {RunSide} */
    side = {
      kind,
      move,
      name: M.areas[rngFrom(seed, 'side|name').int(0, M.areas.length - 1)],
      from,
      to,
      nodes: places,
    };
  if (leader) side.leader = leader;
  if (dex) side.dex = dex;
  map.side = side;
  return side;
}
/** whether you can walk from map node `here` to `i` by the side area: the obstacle's place and the first side place
 * (both ways, once it is open; the walk asks the field move first), along the chain both ways, and from the last place
 * out to `to` (one way: the way out) @param {RunMap} map @param {number} here @param {number} i @returns {boolean} */
export function runSideLinked(map, here, i) {
  const S = map.side;
  if (!S || here < 0) return false;
  const at = S.nodes.indexOf(here),
    go = S.nodes.indexOf(i);
  if (here === S.from && go === 0) return !!S.open;
  if (at === 0 && i === S.from) return true;
  if (at >= 0 && go >= 0 && Math.abs(at - go) === 1) return true;
  return at === S.nodes.length - 1 && i === S.to;
}
/** the obstacle is open: the side's places show on the world map. Returns whether it changed @param {RunMap} map */
export function runSideOpen(map) {
  const S = map.side;
  if (!S || S.open) return false;
  S.open = 1;
  for (const i of S.nodes) map.nodes[i].seen = 2;
  return true;
}
/**
 * what the obstacle says and whether it opens, Pokémon's way: without the type's badge kept, needBadge; with it but
 * no Billie of the type in the team, needType; with both, ask (and `billie`, the team's first of the type, uses it)
 * @param {FieldMove} M @param {Record<string, number> | undefined} badges meta.badges
 * @param {{ name: string, types: string[] }[]} team the team's Billies standing (their names and types)
 * @returns {{ state: 'needBadge' | 'needType' | 'ask', billie: string }}
 */
export function fieldMoveState(M, badges, team) {
  if (!(badges || {})[fieldBadgeKey(M.type)]) return { state: 'needBadge', billie: '' };
  const B = team.find(m => m.types.includes(M.type));
  return B ? { state: 'ask', billie: B.name } : { state: 'needType', billie: '' };
}
/** a field move's line with its {badge} and {billie} filled in @param {FieldMove} M
 * @param {'look' | 'needBadge' | 'needType' | 'ask' | 'used' | 'out'} which @param {string} [billie] */
export const fieldMoveText = (M, which, billie = '') =>
  String(M[which] || '')
    .replaceAll('{badge}', `${M.type} Badge`)
    .replaceAll('{billie}', billie);
provide({ fieldMoveText }); /* to-module */
/** what is wrong with a map's side area, as sentences (none for a map without one): its places come after the main
 * path's, are marked and chained, its obstacle stands on the main path below its first place's row, its way out
 * goes to a main place of the row it comes back to (a detour's: the row after its obstacle's; an alternate path's:
 * the row after its last; none past its own boss), its leader last or right before its town at the end
 * @param {RunMap} map @returns {string[]} */
export function runSideProblems(map) {
  const S = map.side,
    out = /** @type {string[]} */ ([]);
  if (!S) return out;
  const N = map.nodes,
    last = Math.max(...N.filter(runSideMain).map(n => n.row)),
    F = N[S.from];
  if (!F || F.side) out.push(`the side's obstacle stands on place ${S.from}, not on the main path`);
  if (!S.nodes.length) out.push('the side has no places');
  S.nodes.forEach((i, k) => {
    const nd = N[i];
    if (!nd || !nd.side) return out.push(`side place ${i} is not marked as a side place`);
    const next = S.nodes[k + 1];
    if (JSON.stringify(nd.to) !== JSON.stringify(next === undefined ? [] : [next]))
      out.push(`side place ${i} doesn't lead on to the next one alone`);
    if (N.some(m => runSideMain(m) && m.to.includes(i))) out.push(`side place ${i} is reached from the main path`);
  });
  if (N.some((nd, i) => nd.side && !S.nodes.includes(i))) out.push('a place is marked as a side place but not listed');
  if (F && S.nodes.length && N[S.nodes[0]] && N[S.nodes[0]].row !== F.row + 1)
    out.push("the side's first place is not on the row after its obstacle's");
  const end = N[S.nodes[S.nodes.length - 1]];
  if (S.to === -1) {
    if (!end || end.type !== 'boss' || end.row !== last)
      out.push('an alternate path with no way out must end at a boss');
  } else {
    const T = N[S.to];
    if (!T || T.side) out.push(`the side's way out goes to place ${S.to}, not the main path`);
    /* a detour's places stand at its next row's level: its way out goes to that row; an alternate path's to the row
       after its last */
    else if (F && T.row !== (S.kind === 'detour' ? F.row + 1 : end ? end.row + 1 : -1))
      out.push("the side's way out doesn't go back to the main path's next row");
  }
  /* WM-2: its leader last, or right before its town at the end */
  const lead = N[S.nodes[S.nodes.length - (end && end.type === 'town' ? 2 : 1)]];
  if (!lead || !['miniboss', 'boss'].includes(lead.type))
    out.push("the side's leader is not its last place or right before its town at the end");
  return out;
}
