// @ts-check
'use strict';
/* ================= BATTLE STATE (roguelite track RL-4) =================
   The battle as data: what a fighter's place on the field holds (newFieldState) and the battle object itself
   (makeBattle), apart from the engine that plays it (battle-engine.js). Logic only: no DOM, runs in Node
   (tools/test/battle-state.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ITEMS, RULES, STAT_IDS } from '../game-data.js';
import { rngFn } from './rng.js';
import { fxOfBillie, fxStages } from './effects.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  addAct: [() => addAct, v => (addAct = v)],
  // @ts-expect-error -- replaced on purpose
  makeBattle: [() => makeBattle, v => (makeBattle = v)],
  newFieldState: [() => newFieldState],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* a fighter's place on the field, fresh: stat stages, turns in, a type override, protection, the last move */
export const newFieldState = () => ({
  st: Object.fromEntries(STAT_IDS.filter(k => k !== 'hp').map(k => [k, 0])),
  turnsIn: 0,
  ov: null,
  ovT: 0,
  protect: false,
  last: null,
  holdN: 0,
  hyped: 0,
  down: false,
});
/* the side's first fighter, read and set as side.act (older code, one fighter a side); hidden from JSON */
export function addAct(sd) {
  Object.defineProperty(sd, 'act', {
    get() {
      return this.f[0].act;
    },
    set(v) {
      this.f[0].act = v;
    },
    enumerable: false,
  });
}
/* the battle object. kind: 'wild' or 'trainer'; team: side 0 (the save's team itself in ordinary play, so the Team
   tab sees live HP; a copy for a fight that must not touch the save); foe: side 1; extra: fields laid over it (fmt,
   foeName, seed, host, bag, buddy, ...). fmt: 'single', 'double' (two a side) or 'alpha' (up to three of yours
   against one Alpha). Those of yours who can still fight take the field in team order. null when none can. */
export function makeBattle(kind, team, foe, extra) {
  const able = team.map((m, i) => i).filter(i => team[i].hp > 0);
  if (!able.length) return null;
  const fmt = (extra && extra.fmt) || 'single',
    n0 = Math.min(able.length, fmt === 'double' ? 2 : fmt === 'alpha' ? (RULES.battle.alphaTeam ?? 3) : 1),
    n1 = fmt === 'double' ? Math.min(2, foe.length) : 1;
  const fighters = (n, list) =>
    Array.from({ length: n }, (_, sl) => ({ act: list[sl], on: list[sl] != null, v: newFieldState(), down: false }));
  const b = Object.assign(
    {
      kind,
      fmt,
      events: [],
      ev: 0,
      phase: 'playing',
      market: null,
      over: null,
      needSwitch: [],
      foeName: '',
      lead: team[able[0]].uid,
      turn: 0,
      plan: [],
      cur: 0,
      sides: [
        { team, f: fighters(n0, able), stones: false, slipstream: false, held: [], mail: [], roar: null },
        {
          team: foe,
          f: fighters(
            n1,
            foe.map((m, i) => i)
          ),
          stones: false,
          slipstream: false,
          held: [],
          mail: [],
          roar: null,
        },
      ],
    },
    extra,
    { fmt }
  );
  addAct(b.sides[0]);
  addAct(b.sides[1]);
  /* RL-12: a run's Perks (b.fx, logic/effects.js): stat stages for yours on the field as it starts */
  if (b.fx) {
    const up = fxStages(b.fx),
      most = RULES.battle.stageMax;
    for (const f of b.sides[0].f)
      if (f.on) for (const s in up) f.v.st[s] = Math.max(-most, Math.min(most, (f.v.st[s] || 0) + up[s]));
  }
  /* RL-12c: a held item's stat stages for each fighter on the field as it starts (doSwitch for those coming in) */
  for (const sd of b.sides)
    for (const f of sd.f) {
      const up = f.on ? fxStages(fxOfBillie(sd.team[f.act], ITEMS)) : {},
        most = RULES.battle.stageMax;
      for (const s in up) f.v.st[s] = Math.max(-most, Math.min(most, (f.v.st[s] || 0) + up[s]));
    }
  /* RL-4: a battle with a seed draws its chances from its own stream (battle-engine.js battleRoll) */
  if (b.seed != null && !b.rng) b.rng = rngFn(String(b.seed), 'battle');
  return b;
}
