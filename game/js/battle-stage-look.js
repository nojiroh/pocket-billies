'use strict';
/* ================= THE BATTLE STAGE'S LOOK (VFX track VFX-15) =================
   The stage reacts: a battle mood over the place's (a big move or a super-effective hit darkens the stage a little and
   tints it to the move's type; Psychic's and the Bureau's moves swing the picture's rows; Fire's big moves shimmer),
   tweened on the stage clock (so hit-stop holds it and the battle speed scales it), never longer than the move; the
   weather's look in battle (the sun's warmth and shafts, the Sandstorm's strength and its gust); and the scars a hit
   leaves (walk/battle-scars.js draws them). battle-3d.js hands battleStageLookFrame() to the renderer each frame:
   engine/post-effects.js's grade pass (darken, tint, warmth, the row wave, heat), walk/effects.js (the cheap shafts)
   and walk/fountains-weather.js (splashes, settling, the sand). The picks are logic/battle-stage-look.js's, the
   numbers battleAnims.json's `moods`, `weather` and `scars`. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { BATTLE_ANIMS, TYPE_GLOW, battleWeather, provide, reducedMotion } from './hooks.js';
import { battleMoodFor } from './logic/battle-stage-look.js';
import { hexToRgb } from './art.js';
import { battleStage, battleStageKit } from './battle-stage.js';
/* eslint-disable no-func-assign */
expose({
  battleMoodPlay: [() => battleMoodPlay, v => ((battleMoodPlay = v), provide({ battleMoodPlay }))],
  battleSandGust: [() => battleSandGust, v => (battleSandGust = v)],
  battleStageLookFrame: [() => battleStageLookFrame, v => (battleStageLookFrame = v)],
  battleStageLookReset: [
    () => battleStageLookReset,
    v => ((battleStageLookReset = v), provide({ battleStageLookReset })),
  ],
  rgb01: [() => rgb01],
  stageLook: [() => stageLook],
});
/* eslint-enable no-func-assign */
provide({ battleMoodPlay, battleStageLookReset });
/* to-module: end */
/** the stage's look now: the mood's darken, tint (its colour 0..1) and row wave (whole CSS pixels), heat, and the
 * Sandstorm's gust (times more streaks, over 1). Tweened on the stage clock (battleStage.tws) */
const stageLook = { dark: 0, tint: 0, col: [1, 1, 1], wave: 0, heat: 0, gust: 0 };
const rgb01 = (/** @type {string} */ h) => {
  const c = typeof h === 'string' && h[0] === '#' ? hexToRgb(h) : [255, 255, 255],
    m = Math.max(1, c[0], c[1], c[2]);
  /* its hue at full brightness, so a dark type colour tints without darkening more */
  return [c[0] / m, c[1] / m, c[2] / m];
};
/** VFX-15: the mood a move brings (battle-anim-run.js battleAnimPlay, with the move's timeline T): in over inMs to
 * the hit, held, out over outMs to the move's end; stepped under Reduced motion. Nothing is added to the move's time.
 * c: the runner's (its sides and type) */
function battleMoodPlay(an, M, c, T) {
  const s = battleStage.s[c.si],
    bureau = !!(s && typeof s.sp === 'string' && s.sp.startsWith('bot:')),
    m = battleMoodFor(an, M, { reduced: !!reducedMotion, bureau }, BATTLE_ANIMS);
  if (!m) return null;
  const L = stageLook,
    tw = battleStageKit.tween,
    dur = Math.max(2, T.dur),
    at = Math.min(dur - 1, T.hit >= 999 ? 0 : T.hit),
    inMs = Math.max(1, Math.min(m.inMs, at)),
    outMs = Math.max(1, Math.min(m.outMs, dur - at - 1)),
    from = at - inMs,
    off = dur - outMs;
  L.col = rgb01(m.col === 'type' ? TYPE_GLOW[M.t] : m.col);
  for (const [k, v] of [
    ['dark', m.dark],
    ['tint', m.tint],
    ['wave', m.wave],
    ['heat', m.heat],
  ]) {
    if (!v) continue;
    tw(L, k, v, inMs, 'out', from);
    tw(L, k, 0, outMs, 'in', off);
  }
  return m;
}
/** VFX-15: the Sandstorm starts (battle-stage.js case 'market'): a gust, then its steady streaks */
function battleSandGust() {
  const W = BATTLE_ANIMS.weather;
  if (!W || reducedMotion) return;
  stageLook.gust = W.sand.gust - 1;
  battleStageKit.tween(stageLook, 'gust', 0, W.sand.gustMs, 'in');
}
/** VFX-15: a new battle starts with the stage as the place has it */
function battleStageLookReset() {
  Object.assign(stageLook, { dark: 0, tint: 0, wave: 0, heat: 0, gust: 0 });
}
/** what the renderer reads this frame (battle-3d.js battle3dFrame): the mood, the sun's warmth and shafts (the
 * battle's sunny weather), the Sandstorm (0 none, 1 steady, more in a gust); the wave's phase on the stage clock */
export function battleStageLookFrame() {
  const L = stageLook,
    W = BATTLE_ANIMS.weather,
    O = BATTLE_ANIMS.moods,
    wx = typeof battleWeather === 'function' ? battleWeather() : null,
    sun = !!(W && wx && wx.k === 'sunny');
  return {
    dark: L.dark,
    tint: L.tint,
    col: L.col,
    wave: reducedMotion ? 0 : L.wave,
    waveRow: O ? O.wave.rowPx : 4,
    wavePhase: O ? battleStage.t * O.wave.speed : 0,
    heat: reducedMotion ? 0 : L.heat,
    warm: sun ? W.sunny.warm : 0,
    rays: sun ? W.sunny.rays : 1,
    sand: battleStage.oil ? 1 + (reducedMotion ? 0 : L.gust) : 0,
  };
}
