// @ts-check
'use strict';
/* ================= CUTSCENES: THE SET (logic) =================
   A cutscene is one file, game/data/cutscenes/<id>.json (docs/CUTSCENES.md): the map it is filmed on, its named spots
   and shots, lanes, what is cleared away while filming, and its script. This module reads what a cutscene command
   says (the stage plays it, the story checks and the Studio check it, all from the same reading) and works out where
   things are in the view on screen: a map that is part of a bigger view (a place's hub) has its corner somewhere in
   it, and a shot's heights are above the ground under each point. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CUTSCENE_DIRECTIONS: [() => CUTSCENE_DIRECTIONS],
  CUTSCENE_EFFECTS: [() => CUTSCENE_EFFECTS],
  CUTSCENE_POSES: [() => CUTSCENE_POSES],
  CUTSCENE_SCREENS: [() => CUTSCENE_SCREENS],
  CUTSCENE_YOU: [() => CUTSCENE_YOU],
  NUM: [() => NUM],
  // @ts-expect-error -- replaced on purpose
  cutsceneCleared: [() => cutsceneCleared, v => (cutsceneCleared = v)],
  // @ts-expect-error -- replaced on purpose
  cutsceneNames: [() => cutsceneNames, v => (cutsceneNames = v)],
  // @ts-expect-error -- replaced on purpose
  cutsceneOffset: [() => cutsceneOffset, v => (cutsceneOffset = v)],
  cutscenePoint: [() => cutscenePoint],
  // @ts-expect-error -- replaced on purpose
  cutsceneShotAt: [() => cutsceneShotAt, v => (cutsceneShotAt = v)],
  // @ts-expect-error -- replaced on purpose
  cutsceneStep: [() => cutsceneStep, v => (cutsceneStep = v)],
  num: [() => num],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @import { CutsceneData, CutsceneShot } from '../../types/game-data' */

/** the one who watches: you in a cutscene's lines and commands */
export const CUTSCENE_YOU = 'you';
export const CUTSCENE_DIRECTIONS = ['up', 'down', 'side', 'sideR'];
/** the poses `act` plays (person-art.js battle poses) */
export const CUTSCENE_POSES = ['throw', 'cheer', 'react', 'reach'];
/** `screen`: the look of the whole picture (css/cutscene.css): coming round after the fall, then clear */
export const CUTSCENE_SCREENS = ['dazed', 'waking', 'clear'];
/** `effect`: little things in the scene */
export const CUTSCENE_EFFECTS = ['landing', 'sparkle'];

export const NUM = /^-?\d+(\.\d+)?$/;
/** @param {string | undefined} v */
export const num = v => (v != null && NUM.test(v) ? +v : null);

/** @typedef {{ k: 'cmd', line: number, name: string, args: string[] }} CmdNode */
/** what a cutscene command says, read once: the names it uses (who, spot, shot), its numbers and flags, and a
 * problem if it doesn't read. Commands that aren't the cutscene's own come back with only `name`.
 * @typedef {{ name: string, who?: string, spot?: string, shot?: string, s?: number, nowait?: boolean,
 *   on?: string[], dir?: string, toward?: string, pose?: string, text?: [string, string], screen?: string,
 *   effect?: string, at?: string, box?: boolean, colour?: string, sound?: string, dark?: boolean, prop?: string,
 *   lane?: string, count?: number, problem?: string }} CutsceneStep */
/** @param {CmdNode} n @returns {CutsceneStep} */
export function cutsceneStep(n) {
  const a = n.args,
    out = /** @type {CutsceneStep} */ ({ name: n.name });
  const bad = (/** @type {string} */ p) => Object.assign(out, { problem: p });
  switch (n.name) {
    case 'camera': {
      /* camera <shot> [seconds] [on <name> [<name>]] */
      out.shot = a[0];
      let i = 1;
      if (num(a[1]) != null) out.s = /** @type {number} */ (num(a[i++]));
      if (a[i] === 'on') {
        out.on = a.slice(i + 1);
        if (!out.on.length || out.on.length > 2) return bad('"on" takes one or two names (a spot or someone)');
      } else if (a[i] != null) return bad(`camera ${out.shot}: then seconds or "on", not "${a[i]}"`);
      return out;
    }
    case 'actor': {
      /* actor <who> at <spot> [direction] [silhouette] (a dark figure: who it is stays hidden) */
      const use = 'actor takes: who at spot [direction] [silhouette]';
      if (a[1] !== 'at' || !a[2]) return bad(use);
      Object.assign(out, { who: a[0], spot: a[2] });
      let i = 3;
      if (a[i] != null && a[i] !== 'silhouette') {
        if (!CUTSCENE_DIRECTIONS.includes(a[i])) return bad(`facing ${a[i]}: up, down, side or sideR`);
        out.dir = a[i++];
      }
      if (a[i] === 'silhouette') ((out.dark = true), i++);
      if (a[i] != null) return bad(use);
      return out;
    }
    case 'walk': {
      /* walk <who> <spot> [seconds] [nowait]; "walk <who> beside me" is the walk scene's (story-stage.js) */
      Object.assign(out, { who: a[0], spot: a[1] });
      let i = 2;
      if (num(a[i]) != null) out.s = /** @type {number} */ (num(a[i++]));
      if (a[i] === 'nowait') ((out.nowait = true), i++);
      if (a[i] != null || !out.spot) return bad('walk takes: who spot [seconds] [nowait]');
      return out;
    }
    case 'face':
      /* face <who> <direction | someone> */
      out.who = a[0];
      if (CUTSCENE_DIRECTIONS.includes(a[1])) out.dir = a[1];
      else out.toward = a[1];
      return out;
    case 'act':
      /* act <who> <pose> [seconds] */
      Object.assign(out, { who: a[0], pose: a[1] });
      if (a[2] != null) {
        if (num(a[2]) == null) return bad(`act: seconds is a number, not "${a[2]}"`);
        out.s = /** @type {number} */ (num(a[2]));
      }
      if (!CUTSCENE_POSES.includes(a[1])) return bad(`pose ${a[1]}: ${CUTSCENE_POSES.join(', ')}`);
      return out;
    case 'wait':
      /* wait <seconds> | wait <who> (till they stop walking) */
      if (num(a[0]) != null) out.s = /** @type {number} */ (num(a[0]));
      else out.who = a[0];
      return out;
    case 'caption': {
      /* caption <seconds> <small line> | <big line> */
      out.s = num(a[0]) ?? undefined;
      const t = a.slice(1).join(' '),
        k = t.indexOf('|');
      if (out.s == null || k < 0) return bad('caption takes: seconds small line | big line');
      out.text = [t.slice(0, k).trim(), t.slice(k + 1).trim()];
      return out;
    }
    case 'screen':
      out.screen = a[0];
      if (!CUTSCENE_SCREENS.includes(a[0])) return bad(`screen ${a[0]}: ${CUTSCENE_SCREENS.join(', ')}`);
      return out;
    case 'effect':
      /* effect <name> [at <spot | someone>] */
      out.effect = a[0];
      if (!CUTSCENE_EFFECTS.includes(a[0])) return bad(`effect ${a[0]}: ${CUTSCENE_EFFECTS.join(', ')}`);
      if (a[1] != null) {
        if (a[1] !== 'at' || !a[2] || a.length > 3) return bad('effect takes: name [at spot]');
        out.at = a[2];
      }
      return out;
    case 'hide':
    case 'show':
      /* hide box (the dialogue box) | hide <who> | hide prop <spot> (the prop standing nearest it), and show the same */
      if (a[0] === 'box') {
        if (n.name === 'show') return bad('the dialogue box shows itself with the next line');
        out.box = true;
      } else if (a[0] === 'prop') {
        if (!a[1] || a.length > 2) return bad(`${n.name} prop takes a spot (the prop nearest it)`);
        out.at = a[1];
      } else {
        if (a.length > 1) return bad(`${n.name} takes: box, someone, or prop spot`);
        out.who = a[0];
      }
      return out;
    case 'traffic': {
      /* traffic <lane> <prop> <seconds> [count]: that many of a prop (a flying car) along a lane, end to end in that many
         seconds, again and again, spaced evenly */
      const s_ = num(a[2]),
        c = a[3] == null ? 1 : num(a[3]);
      if (!a[0] || !a[1] || s_ == null || s_ <= 0 || c == null || c < 1 || a.length > 4)
        return bad('traffic takes: lane prop seconds [count]');
      return Object.assign(out, { lane: a[0], prop: a[1], s: s_, count: Math.round(c) });
    }
    case 'fade':
      /* fade in | fade out [#colour] */
      out.dir = a[0] || 'out';
      if (!['in', 'out'].includes(out.dir)) return bad('fade in, or fade out [#colour]');
      if (a[1] != null) {
        if (!/^#[0-9a-fA-F]{6}$/.test(a[1])) return bad(`fade: a colour like #0B0912, not "${a[1]}"`);
        out.colour = a[1];
      }
      return out;
    case 'sound':
      out.sound = a[0];
      return out;
  }
  return out;
}

/** the names a cutscene's script uses, each with its line: spots, shots, and who (to check them against the file and
 * the speakers) @param {any[]} tree the parsed script
 * @returns {{ kind: 'spot' | 'shot' | 'who' | 'lane' | 'prop', name: string, line: number }[]} */
export function cutsceneNames(tree) {
  /** @type {{ kind: 'spot' | 'shot' | 'who' | 'lane' | 'prop', name: string, line: number }[]} */
  const out = [];
  const walk = (/** @type {any[]} */ blk) => {
    for (const n of blk) {
      if (n.k === 'cmd') {
        const S = cutsceneStep(n),
          add = (
            /** @type {'spot' | 'shot' | 'who' | 'lane' | 'prop'} */ kind,
            /** @type {string | undefined} */ name
          ) => name && out.push({ kind, name, line: n.line });
        add('shot', S.shot);
        add('spot', S.spot);
        add('who', S.who);
        add('spot', S.toward);
        add('lane', S.lane);
        add('prop', S.prop);
        for (const x of S.on || []) add('spot', x);
        add('spot', S.at);
      } else if (n.k === 'say') out.push({ kind: 'who', name: n.who || '', line: n.line });
      for (const b of n.clauses || []) walk(b.body);
      for (const o of n.options || []) walk(o.body);
      if (n.body) walk(n.body);
      for (const e of n.entries || []) walk(e);
    }
  };
  walk(tree);
  return out.filter(x => x.name);
}

/* ---------- where things are on screen ---------- */
/** where the cutscene's map has its corner in the view on screen: [0, 0] when the view is the map itself, its part's
 * corner when the view is made of several (seamless-world.js parts), null when the map isn't in it
 * @param {{ id?: string, parts?: { id: string, ox: number, oz: number }[] }} view @param {string} mapId
 * @returns {[number, number] | null} */
export function cutsceneOffset(view, mapId) {
  if (!view) return null;
  if (view.id === mapId) return [0, 0];
  const p = (view.parts || []).find(q => q.id === mapId);
  return p ? [p.ox, p.oz] : view.parts ? null : [0, 0];
}
/** a spot in the view @param {[number, number]} p @param {[number, number]} off @returns {[number, number]} */
export const cutscenePoint = (p, off) => [p[0] + off[0], p[1] + off[1]];
/** a shot in the view: eye and target with their heights put on the ground under them; `on` aims it at a place
 * instead (the target's height kept above the ground there)
 * @param {CutsceneShot} K @param {[number, number]} off @param {(x: number, z: number) => number} ground
 * @param {[number, number] | null} [on]
 * @returns {{ eye: number[], tgt: number[], fov: number, w: number, abs: 1 }} */
export function cutsceneShotAt(K, off, ground, on = null) {
  const P = (/** @type {number[]} */ p, /** @type {[number, number] | null} */ at = null) => {
    const x = at ? at[0] : p[0] + off[0],
      z = at ? at[1] : p[2] + off[1];
    return [x, ground(x, z) + p[1], z];
  };
  return { eye: P(K.eye), tgt: P(K.tgt, on), fov: K.fov ?? 40, w: K.w ?? 0, abs: 1 };
}
/** the props put out of the way while filming: not flat ones, inside an area, near a path between two spots, or (props
 * without a footprint) near a point the camera stands at
 * @param {CutsceneData} C @param {{ k: string, x: number, z: number }[]} props
 * @param {Record<string, { flat?: any, box?: any }>} catalogue @param {[number, number]} off */
export function cutsceneCleared(C, props, catalogue, off) {
  const K = C.clear || {},
    areas = (K.areas || []).map(([a, b, c, d]) => [a + off[0], b + off[1], c + off[0], d + off[1]]),
    paths = (K.paths || [])
      .filter(([a, b]) => C.spots[a] && C.spots[b])
      .map(([a, b]) => [cutscenePoint(C.spots[a], off), cutscenePoint(C.spots[b], off)]),
    eyes = (K.eyes || []).map(e => cutscenePoint(e, off)),
    pw = K.pathWidth ?? 1.1,
    er = K.eyeRadius ?? 2.3;
  const seg = (
    /** @type {number} */ x,
    /** @type {number} */ z,
    /** @type {number[]} */ a,
    /** @type {number[]} */ b
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k);
  };
  return new Set(
    props.filter(p => {
      const M = catalogue[p.k];
      return (
        !!M &&
        !M.flat &&
        (areas.some(([a, b, c, d]) => p.x > a && p.x < c && p.z > b && p.z < d) ||
          paths.some(([a, b]) => seg(p.x, p.z, a, b) < pw) ||
          (!M.box && eyes.some(e => Math.hypot(p.x - e[0], p.z - e[1]) < er)))
      );
    })
  );
}
