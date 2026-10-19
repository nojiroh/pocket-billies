'use strict';
/* ================= CUTSCENES: THE STAGE =================
   Plays a cutscene's script (logic/script.js runScript) on the director: every command a cutscene may use, read by
   logic/cutscene-set.js the same way the story checks and the Studio read it, and the names in it found in the
   cutscene's file (its spots and shots) or among the people in the scene. The rules (docs/CUTSCENES.md): a line waits
   for the tap and a walk till they arrive (unless nowait); camera moves, poses and captions run on while the next step
   starts; `wait` pauses, for seconds or till someone stops walking. Skipping (the Skip button) makes every wait and
   line pass at once; the dressing room and the starter pick stop it. A cutscene adds commands of its own through
   `extra` (the opening's: opening.js). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { landingBurst } from '../hooks.js';
import { $ } from '../util.js';
import { CUTSCENES, STORY_DATA } from '../game-data.js';
import { CUTSCENE_YOU, cutsceneOffset, cutscenePoint, cutsceneShotAt, cutsceneStep } from '../logic/cutscene-set.js';
import { parseScript } from '../logic/script-parse.js';
import { runScript } from '../logic/script.js';
import { lookOf } from '../person-art.js';
import { directionOf, walkView } from '../walk-view.js';
import { environment } from '../environment.js';
import { standingHeightAt } from '../walk/heights.js';
import { music, soundEffect } from '../sound.js';
import { talkChoose } from '../talk.js';
import {
  cutscene,
  cutsceneAct,
  cutsceneActor,
  cutsceneBlink,
  cutsceneCaption,
  cutsceneHideDialogue,
  cutsceneSay,
  cutsceneShot,
  cutsceneSparkle,
  cutsceneTraffic,
  cutsceneWait,
  cutsceneWalk,
} from './director.js';
/* eslint-disable no-func-assign */
expose({
  cutsceneHidden: [() => cutsceneHidden, v => (cutsceneHidden = v)],
  cutsceneLook: [() => cutsceneLook, v => (cutsceneLook = v)],
  cutscenePlace: [() => cutscenePlace, v => (cutscenePlace = v)],
  cutscenePlayScript: [() => cutscenePlayScript, v => (cutscenePlayScript = v)],
  cutsceneShotNamed: [() => cutsceneShotNamed, v => (cutsceneShotNamed = v)],
  cutsceneStage: [() => cutsceneStage, v => (cutsceneStage = v)],
  nearestProp: [() => nearestProp, v => (nearestProp = v)],
  placeOrFail: [() => placeOrFail],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @import { CutsceneData } from '../../types/game-data' */

/** the person a script names, as the director keys them: you are `me`, a speaker their person id (story.json) */
export function cutsceneLook(name) {
  if (name === CUTSCENE_YOU) return 'me';
  const S = (STORY_DATA && STORY_DATA.speakers) || {};
  return S[name] || name;
}
/** a place by name, in the view: a spot of the cutscene's, someone in the scene, or a place the cutscene named on its
 * own (cutscene.named: the opening's starter) @param {string} name @returns {[number, number] | null} */
function cutscenePlace(name) {
  const C = cutscene.set,
    sp = C && C.spots[name];
  if (sp) return cutscenePoint(sp, cutscene.off);
  const a = cutscene.actors[cutsceneLook(name)];
  if (a) return [a.x, a.z];
  return cutscene.named[name] || null;
}
const placeOrFail = (/** @type {string} */ name) => {
  const p = cutscenePlace(name);
  if (!p) throw new Error(`no spot or person "${name}" in this cutscene`);
  return p;
};
/** a shot in the view, by name; aimed at one place, or between two, when the script says "on"
 * @param {string} name @param {string[]} [on] */
function cutsceneShotNamed(name, on) {
  const C = cutscene.set,
    K = C && C.shots[name];
  if (!K) throw new Error(`no shot "${name}" in this cutscene`);
  let aim = null;
  if (on && on.length) {
    const P = on.map(placeOrFail);
    aim = /** @type {[number, number]} */ ([
      P.reduce((t, p) => t + p[0], 0) / P.length,
      P.reduce((t, p) => t + p[1], 0) / P.length,
    ]);
  }
  return cutsceneShotAt(K, cutscene.off, (x, z) => standingHeightAt(x, z), aim);
}

/** the stage for runScript; `extra` adds a cutscene's own commands (each takes the command's arguments)
 * @param {Record<string, (args: string[]) => any>} [extra] */
function cutsceneStage(extra = {}) {
  const step = (/** @type {string} */ name, /** @type {string[]} */ args) => {
    const S = cutsceneStep({ k: 'cmd', line: 0, name, args });
    if (S.problem) throw new Error(`${name} ${args.join(' ')}: ${S.problem}`);
    return S;
  };
  const actor = (/** @type {string} */ name) => {
    const a = cutscene.actors[cutsceneLook(name)];
    if (!a) throw new Error(`${name} isn't in the scene (actor ${name} at <spot> first)`);
    return a;
  };
  const ms = (/** @type {number | undefined} */ s) => Math.max(0, (s || 0) * 1000);
  return {
    say: (/** @type {{ who: string | null, expr: string | null, text: string }} */ l) =>
      cutsceneSay(l.who ? cutsceneLook(l.who) : null, l.text, l.expr),
    choose: (/** @type {{ text: string }[]} */ ops) => (typeof talkChoose === 'function' ? talkChoose(ops) : 0),
    camera: (/** @type {string[]} */ a) => {
      const S = step('camera', a);
      /* the camera glides on while the script goes on */
      cutsceneShot(cutsceneShotNamed(/** @type {string} */ (S.shot), S.on), ms(S.s));
    },
    actor: (/** @type {string[]} */ a) => {
      const S = step('actor', a),
        who = /** @type {string} */ (S.who),
        look = cutsceneLook(who);
      cutsceneActor(look, look, placeOrFail(/** @type {string} */ (S.spot)), S.dir || 'down', !!S.dark);
    },
    walk: async (/** @type {string[]} */ a) => {
      const S = step('walk', a),
        A = actor(/** @type {string} */ (S.who)),
        to = placeOrFail(/** @type {string} */ (S.spot)),
        /* no time given: a brisk walk, 1.6 m a second */
        t = S.s != null ? ms(S.s) : (Math.hypot(to[0] - A.x, to[1] - A.z) / 1.6) * 1000,
        w = cutsceneWalk(A.id, to, t);
      if (!S.nowait) await w;
    },
    face: (/** @type {string[]} */ a) => {
      const S = step('face', a),
        A = actor(/** @type {string} */ (S.who));
      if (S.dir) A.dir = S.dir;
      else {
        const p = placeOrFail(/** @type {string} */ (S.toward));
        A.dir = directionOf(p[0] - A.x, p[1] - A.z);
      }
    },
    act: (/** @type {string[]} */ a) => {
      const S = step('act', a);
      cutsceneAct(actor(/** @type {string} */ (S.who)).id, S.pose, ms(S.s));
    },
    wait: async (/** @type {string[]} */ a) => {
      const S = step('wait', a);
      if (S.who == null) return cutsceneWait(ms(S.s));
      const A = actor(S.who);
      while (A.walk && cutscene.on && !cutscene.skip) await cutsceneWait(50);
    },
    caption: (/** @type {string[]} */ a) => {
      const S = step('caption', a),
        [small, big] = /** @type {[string, string]} */ (S.text);
      cutsceneCaption(small, big, ms(S.s));
    },
    blink: () => cutsceneBlink(),
    screen: (/** @type {string[]} */ a) => {
      const S = step('screen', a),
        B = document.body.classList;
      if (S.screen === 'dazed') B.add('cs-dazed');
      else if (S.screen === 'waking') {
        B.add('cs-waking');
        B.remove('cs-dazed');
      } else B.remove('cs-dazed', 'cs-blink');
    },
    effect: (/** @type {string[]} */ a) => {
      const S = step('effect', a),
        p = S.at ? placeOrFail(S.at) : cutscenePlace(CUTSCENE_YOU);
      if (!p) return;
      if (S.effect === 'landing') {
        if (typeof landingBurst === 'function') landingBurst(p[0], p[1]);
        if (cutscene.skip) document.body.classList.remove('cs-dazed');
      } else cutsceneSparkle([p[0], standingHeightAt(p[0], p[1]) + 0.3, p[1]], 12);
    },
    hide: (/** @type {string[]} */ a) => {
      const S = step('hide', a);
      if (S.box) cutsceneHideDialogue();
      else if (S.at) cutsceneHidden(nearestProp(S.at), true);
      else actor(/** @type {string} */ (S.who)).hidden = true;
    },
    show: (/** @type {string[]} */ a) => {
      const S = step('show', a);
      if (S.at) cutsceneHidden(nearestProp(S.at), false);
      else actor(/** @type {string} */ (S.who)).hidden = false;
    },
    traffic: (/** @type {string[]} */ a) => {
      const S = step('traffic', a),
        L = cutscene.set && (cutscene.set.lanes || {})[/** @type {string} */ (S.lane)];
      if (!L) throw new Error(`no lane "${S.lane}" in this cutscene`);
      const off = cutscene.off;
      cutsceneTraffic(
        L.map(p => [p[0] + off[0], p[1], p[2] + off[1]]),
        /** @type {string} */ (S.prop),
        /** @type {number} */ (S.s),
        S.count || 1
      );
    },
    fade: (/** @type {string[]} */ a) => {
      const S = step('fade', a),
        f = $('#csFade');
      if (!f) return;
      if (S.colour) f.style.background = S.colour;
      f.classList.toggle('on', S.dir === 'out');
    },
    music: (/** @type {string[]} */ [piece]) => {
      if (typeof music === 'function') music(piece);
    },
    sound: (/** @type {string[]} */ [id]) => {
      if (typeof soundEffect === 'function') soundEffect(id);
    },
    ...extra,
  };
}

/** the prop standing nearest a place (within 3 m), for hide prop / show prop @param {string} name */
function nearestProp(name) {
  const at = placeOrFail(name);
  let best = null,
    bd = 3;
  for (const p of (walkView.sc && walkView.sc.props) || []) {
    const d = Math.hypot(p.x - at[0], p.z - at[1]);
    if (d < bd) [best, bd] = [p, d];
  }
  if (!best) throw new Error(`no prop near ${name}`);
  return best;
}
/** a prop put out of sight while filming, or back @param {any} p @param {boolean} on */
function cutsceneHidden(p, on) {
  if (!cutscene.hide) cutscene.hide = new Set();
  if (on) cutscene.hide.add(p);
  else cutscene.hide.delete(p);
}

/** plays a cutscene's script on the director, already mounted on its map's view; resolves when it is over
 * @param {string} id @param {{ extra?: Record<string, (args: string[]) => any>, slots?: Record<string, () => any>,
 *   save?: any }} [o] */
export async function cutscenePlayScript(id, o = {}) {
  const C = /** @type {CutsceneData | undefined} */ (CUTSCENES[id]);
  if (!C) throw new Error(`no cutscene "${id}" (game/data/cutscenes)`);
  const off = cutsceneOffset(/** @type {any} */ (walkView.sc), C.map);
  if (!off) throw new Error(`cutscene ${id} is filmed on ${C.map}, which isn't in this view`);
  cutscene.set = C;
  cutscene.off = off;
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `cutscene ${id}`);
  /* its own time of day and weather while it plays (the city: night, rain), whatever Settings say; then back */
  const was = environment.force;
  if (C.look) environment.force = { ...(was || {}), ...C.look };
  try {
    await runScript(parseScript(C.script), cutsceneStage(o.extra), {
      save: o.save || { story: {} },
      id: 'cutscene:' + id,
      speaker: C.who || null,
      slots: {
        name: () => lookOf('me').name || 'Trainer',
        ...(o.slots || {}),
      },
    });
  } finally {
    if (C.look) environment.force = was;
  }
}
