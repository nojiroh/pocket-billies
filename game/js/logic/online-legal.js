// @ts-check
'use strict';
/* ================= ONLINE LEGAL (the online track, ON-1) =================
   Whether a Billie, an egg or a robot part could come from a fair game, checked before anything leaves a save and
   again when it arrives (docs/phases/online-track.md). Firebase stays on Spark (no server code), so this is the one
   check: it can't prove a Billie was caught fairly, only that its stored facts are ones the game makes (as Pokémon
   HOME's legality check). A Billie's stats come from its stored facts alone (rules.js stat: species, level, sizes,
   splice, Augments, its abomination or Unstable roll), so checking those checks its stats.
   - onlineCopy: what goes online of a Billie: only the facts below, with full HP, no status, the XP of its level and
     no held item (items aren't traded; the owner, 2026-10-26). ON-4: its Showcase ribbons go too (the owner).
   - legalBilly / legalEgg / legalPart: '' when legal, else the first reason (a short word for the debug log).
   - Moves: its line's (any level: a tutor teaches the line's above its level), the moves of its types that some line
     learns (a tutor's), its Augments' (augMoves), and for a quirk egg one move some line learns (a parent's).
   - Robots are not traded (only their parts are). Tests: tools/test/online-legal.test.mjs. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  COATS,
  GENES,
  LINES,
  LINE_BY_ID,
  MOVES,
  ROBOTS,
  RULES,
  SPECIES,
  STATUS_NAMES,
  STAT_IDS,
} from '../game-data.js';
import { augFit, augMoves } from './augments.js';
import { graftFit, graftStability } from './genes.js';
import { robotRules } from './fighters.js';
import { billyTypes, cleanName, geneData, maxHp, maxLevel, moveSlotCount, partSlots, xpFor } from './rules.js';
import { ribbonsShapeOk } from './meta-state.js';
import { augShapeOk, billiesOk, graftShapeOk } from './saves.js';
/* eslint-disable no-func-assign */
expose({
  LEGAL_NAME_MOST: [() => LEGAL_NAME_MOST],
  LEGAL_NICK_MOST: [() => LEGAL_NICK_MOST],
  LEGAL_UID_MOST: [() => LEGAL_UID_MOST],
  ONLINE_BILLY_KEYS: [() => ONLINE_BILLY_KEYS],
  // @ts-expect-error -- replaced on purpose
  legalBankLimits: [() => legalBankLimits, v => (legalBankLimits = v)],
  // @ts-expect-error -- replaced on purpose
  legalBilly: [() => legalBilly, v => (legalBilly = v)],
  // @ts-expect-error -- replaced on purpose
  legalEgg: [() => legalEgg, v => (legalEgg = v)],
  legalLearnedBySome: [() => legalLearnedBySome, v => (legalLearnedBySome = v)],
  // @ts-expect-error -- replaced on purpose
  legalMoves: [() => legalMoves, v => (legalMoves = v)],
  // @ts-expect-error -- replaced on purpose
  legalPart: [() => legalPart, v => (legalPart = v)],
  legalPlain: [() => legalPlain],
  legalSomeLineLearns: [() => legalSomeLineLearns],
  legalText: [() => legalText],
  legalWhole: [() => legalWhole],
  // @ts-expect-error -- replaced on purpose
  onlineCopy: [() => onlineCopy, v => (onlineCopy = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the facts of a Billie that go online, and nothing else */
export const ONLINE_BILLY_KEYS = [
  'uid',
  'sp',
  'lvl',
  'xp',
  'hp',
  'status',
  'sTurns',
  'moves',
  'coat',
  'nick',
  'met',
  'evoNo',
  'alpha',
  'build',
  'mut',
  'graft',
  'unstable',
  'aug',
  'ot',
  'traded',
  'ribbons',
];
export const LEGAL_NICK_MOST = 16,
  LEGAL_NAME_MOST = 40,
  LEGAL_UID_MOST = 128;

export const legalPlain = v => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__');
export const legalText = (v, n) => typeof v === 'string' && v.length <= n;
export const legalWhole = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** a Billie as it goes online (onlineCopy's rules above), stamped with its original trainer `me` when it has none;
 * a robot gets none @param {any} m @param {{ u: string, n: string }} [me] @returns {any} */
export function onlineCopy(m, me) {
  if (!m || m.kind === 'robot') return null;
  /** @type {any} */
  const c = {};
  for (const k of ONLINE_BILLY_KEYS) if (m[k] !== undefined) c[k] = JSON.parse(JSON.stringify(m[k]));
  c.xp = xpFor(c.lvl);
  c.status = null;
  c.sTurns = 0;
  c.hp = maxHp(c);
  /* its original trainer: the first player it went online from, kept wherever it goes */
  if (!c.ot && me && me.u)
    c.ot = { u: String(me.u).slice(0, LEGAL_UID_MOST), n: cleanName(me.n || '', LEGAL_NAME_MOST) };
  return c;
}

/* every move some line learns, made once */
/** @type {Set<string> | null} */
export let legalLearnedBySome = null;
export const legalSomeLineLearns = () =>
  legalLearnedBySome || (legalLearnedBySome = new Set(LINES.flatMap(L => (L.learn || []).map(([, mv]) => mv))));

/** the moves a Billie may know (above) without a quirk's one more @param {any} m */
export function legalMoves(m) {
  const S = SPECIES[m.sp],
    L = LINE_BY_ID[S.line],
    out = new Set((L.learn || []).map(([, mv]) => mv)),
    types = new Set(S.types);
  /* a splice's types count too: a tutor teaches by the types it has */
  if (m.graft || m.aug) for (const t of billyTypes(m)) types.add(t);
  for (const mv of legalSomeLineLearns()) if (MOVES[mv] && types.has(MOVES[mv].t)) out.add(mv);
  if (m.aug) for (const mv of augMoves(geneData(), m.sp, augFit(geneData(), m.sp, m.aug))) out.add(mv);
  return out;
}

/** the highest Stability limit any Gene Bank level gives, and the lowest (genes.json bank.levels) */
export function legalBankLimits() {
  const L = (GENES.bank && GENES.bank.levels) || [],
    base = GENES.stability.limit;
  return L.length
    ? { low: Math.min(...L.map(l => l.limit)), high: Math.max(...L.map(l => l.limit)) }
    : { low: base, high: base };
}

/** '' when a Billie as it arrives (onlineCopy's shape) is one the game makes, else why not @param {any} m */
export function legalBilly(m) {
  if (!legalPlain(m)) return 'shape';
  if (m.kind === 'robot') return 'robot';
  if (Object.keys(m).some(k => !ONLINE_BILLY_KEYS.includes(k))) return 'keys';
  if (!legalText(m.uid, 64) || !m.uid) return 'uid';
  const S = typeof m.sp === 'string' && Object.hasOwn(SPECIES, m.sp) ? SPECIES[m.sp] : null;
  if (!S || !LINE_BY_ID[S.line]) return 'species';
  if (!legalWhole(m.lvl, 1, maxLevel())) return 'level';
  if (!Number.isFinite(m.xp) || m.xp < xpFor(m.lvl) || (m.lvl < maxLevel() && m.xp >= xpFor(m.lvl + 1))) return 'xp';
  if (m.status != null && !STATUS_NAMES[m.status]) return 'status';
  if (!legalWhole(m.sTurns ?? 0, 0, 99)) return 'status';
  if (typeof m.nick !== 'string' || m.nick.length > LEGAL_NICK_MOST || cleanName(m.nick, LEGAL_NICK_MOST) !== m.nick)
    return 'nick';
  /* sizes: every slot, a known size; an abomination's are all S or L */
  const sizes = (RULES.parts && RULES.parts.sizes) || {};
  if (m.build != null) {
    if (!legalPlain(m.build)) return 'build';
    const slots = partSlots();
    if (Object.keys(m.build).length !== slots.length || slots.some(k => !Object.hasOwn(sizes, m.build[k])))
      return 'build';
  }
  /* coat: a known one; a regional form's coat only on its own form */
  if (m.coat != null) {
    const C = typeof m.coat === 'string' && Object.hasOwn(COATS, m.coat) ? COATS[m.coat] : null;
    if (!C || (C.form && S.coat !== m.coat)) return 'coat';
  }
  /* a risky egg's mark */
  if (m.mut != null) {
    const u = m.mut;
    if (!legalPlain(u) || (u.k !== 'quirk' && u.k !== 'abom')) return 'mark';
    if (u.k === 'quirk' && Object.keys(u).some(k => k !== 'k')) return 'mark';
    if (u.k === 'abom') {
      if (!STAT_IDS.includes(u.up) || !STAT_IDS.includes(u.down) || u.up === u.down) return 'mark';
      if (!legalText(u.name, LEGAL_NAME_MOST) || cleanName(u.name, LEGAL_NAME_MOST) !== u.name) return 'mark';
      if (m.build && partSlots().some(k => m.build[k] === 'M')) return 'build';
    }
  }
  /* splice and Augments: shapes the save allows, every slot still fitting, within what some Gene Bank allows */
  if (!graftShapeOk(m.graft) || !augShapeOk(m.aug)) return 'splice';
  const D = geneData(),
    g = m.graft ? graftFit(D, m.sp, m.graft) : null,
    a = m.aug ? augFit(D, m.sp, m.aug) : null;
  if (m.graft && (!g || Object.keys(g).length !== Object.keys(m.graft).length)) return 'splice';
  if (m.aug) {
    if (!a || Object.keys(a).length !== Object.keys(m.aug).length) return 'augment';
    const most = robotRules().maxUpgrade;
    for (const p of Object.values(m.aug)) if (!ROBOTS.parts[p.id] || !legalWhole(p.up ?? 0, 0, most)) return 'augment';
  }
  const lim = legalBankLimits();
  if (g || a) {
    const st = graftStability(D, m.sp, g, lim.high, a);
    if (st.refused) return 'splice';
    if (m.unstable != null) {
      const u = m.unstable;
      if (graftStability(D, m.sp, g, lim.low, a).cost <= lim.low) return 'unstable';
      if (!legalPlain(u) || !STAT_IDS.includes(u.up) || !STAT_IDS.includes(u.down) || u.up === u.down)
        return 'unstable';
      if (!legalText(u.name, LEGAL_NAME_MOST) || cleanName(u.name, LEGAL_NAME_MOST) !== u.name) return 'unstable';
    }
  } else if (m.unstable != null) return 'unstable';
  /* moves: 1 to the slots, no repeats, each one it may know; a quirk egg may bring one more some line learns */
  if (!Array.isArray(m.moves) || !m.moves.length || m.moves.length > moveSlotCount()) return 'moves';
  if (new Set(m.moves).size !== m.moves.length || m.moves.some(k => typeof k !== 'string' || !MOVES[k])) return 'moves';
  const ok = legalMoves(m),
    other = m.moves.filter(k => !ok.has(k));
  if (other.length > (m.mut && m.mut.k === 'quirk' ? 1 : 0) || other.some(k => !legalSomeLineLearns().has(k)))
    return 'moves';
  /* HP after the stats are known to be fair */
  if (!legalWhole(m.hp, 0, maxHp(m))) return 'hp';
  if (m.alpha != null && typeof m.alpha !== 'boolean') return 'alpha';
  if (m.evoNo != null && !legalWhole(m.evoNo, 1, m.lvl)) return 'evolution';
  if (
    m.met != null &&
    (!legalPlain(m.met) || !Number.isFinite(m.met.t) || !['string', 'number'].includes(typeof m.met.n))
  )
    return 'met';
  if (m.met != null && typeof m.met.n === 'string' && m.met.n.length > 64) return 'met';
  if (m.ot != null && (!legalPlain(m.ot) || !legalText(m.ot.u, LEGAL_UID_MOST) || !legalText(m.ot.n, LEGAL_NAME_MOST)))
    return 'trainer';
  if (m.ot != null && cleanName(m.ot.n, LEGAL_NAME_MOST) !== m.ot.n) return 'trainer';
  if (
    m.traded != null &&
    (!legalPlain(m.traded) || !Number.isFinite(m.traded.at) || !legalText(m.traded.from, LEGAL_UID_MOST))
  )
    return 'traded';
  /* ON-4: Showcase ribbons travel with the Billie (cosmetic: a shape check, as the save's) */
  if (!ribbonsShapeOk(m.ribbons)) return 'ribbons';
  /* and never looser than the save's own check: what arrives must load */
  return billiesOk([m]) ? '' : 'save';
}

/** '' when a nursery egg (ranch.nursery's { a, b, mode, at, ready, egg }) could come from the ranch, else why not;
 * its parents' uids are its owner's, so only the egg and its times are checked @param {any} n */
export function legalEgg(n) {
  if (!legalPlain(n) || !legalPlain(n.egg)) return 'shape';
  if (n.mode !== 'safe' && n.mode !== 'risky') return 'mode';
  const B = RULES.ranch && RULES.ranch.breed;
  if (!B) return 'breeding';
  if (!Number.isFinite(n.at) || !Number.isFinite(n.ready) || n.ready < n.at || n.ready - n.at > B.hours * 3600e3 * 1.01)
    return 'time';
  if (n.egg.lvl !== B.lvl) return 'level';
  if (n.mode === 'safe' && n.egg.mut != null) return 'mark';
  return legalBilly(n.egg);
}

/** '' when a robot part ({ uid, id, up }) is one the game makes, else why not @param {any} p */
export function legalPart(p) {
  if (!legalPlain(p) || Object.keys(p).some(k => !['uid', 'id', 'up'].includes(k))) return 'shape';
  if (!legalText(p.uid, 64) || !p.uid) return 'uid';
  if (typeof p.id !== 'string' || !Object.hasOwn(ROBOTS.parts, p.id)) return 'part';
  if (!legalWhole(p.up ?? 0, 0, robotRules().maxUpgrade)) return 'upgrade';
  return '';
}
