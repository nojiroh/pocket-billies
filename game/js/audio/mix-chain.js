'use strict';
/* ================= THE MASTER CHAIN (sound track SND-15) =================
   What every sound goes through last, the game's (sound.js initSound) and the Studio's player alike, so a song sounds
   the same in both: a gentle compressor that glues the mix and keeps its loudness range small, a make-up gain that
   lifts the whole mix to about -18 LUFS at the default sliders (the mobile target, sound-track.md "The research"), and
   a limiter that keeps the true peaks under -1 dBTP. Their settings are music.json mix (`compressor`, `makeup`,
   `limiter`); apply(mix) sets them again after an edit. Knows nothing of the game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({ MIX_CHAIN_DEFAULTS: [() => MIX_CHAIN_DEFAULTS], mixChainMake: [() => mixChainMake, v => (mixChainMake = v)] });
/* eslint-enable no-func-assign */
/* to-module: end */
/* the chain without a mix's say: the glue's and the limiter's settings */
const MIX_CHAIN_DEFAULTS = {
  compressor: { threshold: -30, knee: 12, ratio: 1.4, attack: 0.02, release: 1 },
  makeup: 0,
  limiter: { threshold: -4, release: 0.1 },
};
/**
 * the master chain on context c, into dest (the context's own speakers when left out); connect the master bus to
 * chain.input
 * @param {BaseAudioContext} c
 * @param {any} mix music.json mix
 * @param {AudioNode} [dest]
 */
export function mixChainMake(c, mix, dest) {
  const glue = c.createDynamicsCompressor(),
    makeup = c.createGain(),
    limit = c.createDynamicsCompressor();
  glue.connect(makeup);
  makeup.connect(limit);
  limit.connect(dest || c.destination);
  const chain = {
    input: glue,
    glue,
    makeup,
    limit,
    /** sets every stage from the mix again */
    apply(/** @type {any} */ m) {
      const D = MIX_CHAIN_DEFAULTS,
        C = { ...D.compressor, ...((m && m.compressor) || {}) },
        L = { ...D.limiter, ...((m && m.limiter) || {}) };
      glue.threshold.value = C.threshold;
      glue.knee.value = C.knee;
      glue.ratio.value = C.ratio;
      glue.attack.value = C.attack;
      glue.release.value = C.release;
      makeup.gain.value = Math.pow(10, (m && typeof m.makeup === 'number' ? m.makeup : D.makeup) / 20);
      /* a hard knee at a high ratio, its attack as short as it goes: a limiter (the browser's compressor looks 6 ms
         ahead) */
      limit.threshold.value = L.threshold;
      limit.knee.value = 0;
      limit.ratio.value = 20;
      limit.attack.value = 0.001;
      limit.release.value = L.release;
    },
    /** how hard each stage works now (dB of gain reduction, 0 or less): the debug log's mix line */
    reduction() {
      const r = (/** @type {any} */ n) =>
        Math.round((typeof n.reduction === 'number' ? n.reduction : n.reduction.value) * 10) / 10;
      return { glue: r(glue), limit: r(limit) };
    },
  };
  chain.apply(mix);
  return chain;
}
