'use strict';
/* ================= THE BATTLE SOUNDS' PLAYER (VFX track VFX-19) =================
   Plays a battle sound's play list (logic/battle-sounds.js battleSoundPlays) on a tracker (audio/tracker.js): a tone
   through synthVoice, or, when it names a baked instrument the bank has (SND-11's, once on main), through sampleShot;
   a noise through synthNoise (its own random start, as every noise has; nothing more random here). A voice with echo
   sends that much to echoTo (the effects' echo, T.echoFx: SND-8b). Knows nothing of the game: the game (audio/
   battle-sounds.js) and the Studio's Sounds tab call it with their tracker, the bus and the time to start at. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  battleVoiceHz: [() => battleVoiceHz],
  battleVoicesPlay: [() => battleVoicesPlay, v => (battleVoicesPlay = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a midi note's frequency (tracker.js midiToFrequency's sum, kept here so this needs nothing of the page) */
const battleVoiceHz = (/** @type {number} */ m) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * plays P from t (the context's seconds) into out
 * @param {any} T the tracker
 * @param {AudioNode} out
 * @param {import('../logic/battle-sounds.js').BattlePlay[]} P
 * @param {number} t
 * @param {{echoTo?: AudioNode | null}} [o]
 */
export function battleVoicesPlay(T, out, P, t, o = {}) {
  for (const p of P) {
    const at = t + p.at;
    if (p.kind === 'noise') {
      T.synthNoise(out, { t: at, dur: p.dur, vol: p.vol, lp: p.lp, hp: p.hp, bp: p.bp, q: p.q });
      continue;
    }
    /* a baked note sits about four times under a synth voice's level (a placeholder trim until the listening pass) */
    if (
      p.inst &&
      typeof T.sampleShot === 'function' &&
      T.sampleShot(out, { inst: p.inst, midi: p.midi, t: at, vol: p.vol * 4 })
    )
      continue;
    T.synthVoice(out, {
      type: p.type,
      freq: battleVoiceHz(p.midi),
      t: at,
      dur: p.dur,
      vol: p.vol,
      slide: p.slide === 1 ? 0 : p.slide,
      vib: p.vib,
      /* no echo without a send of its own: the tracker would send it to the music's */
      echo: o.echoTo ? p.echo : 0,
      echoTo: o.echoTo || null,
    });
  }
}
