'use strict';
/* ================= THE BATTLE'S SOUNDS IN THE GAME (VFX track VFX-19) =================
   music.json `battle` (logic/battle-sounds.js) played where the battle asks for it: sound.js battleSoundEffect calls
   battleMoveSoundPlay (a move's family and type layer: the cast as it starts, the hit at its hit), battleHurtSoundPlay
   (a burn, recoil, a spread move's second target, the delayed hit) and battleRecallSoundPlay, and plays the send-out's
   throw and pop through battleCatchSoundPlay; battle-stage.js's catch sounds come here first too. All on the Sound
   effects bus (soundEngine.fx: its slider and SND-15's ducking), the echo to the effects' own (T.echoFx, SND-8b), and
   timed on the stage clock (battle-anim-run.js battleStageAt), so hit-stop and the battle speed hold them and a tap
   that skips drops the ones still to come. Nothing random of its own (a noise's start is the tracker's, as always). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { BATTLE_ANIMS, MOVES, MUSIC } from '../game-data.js';
import { isRobotSp } from '../logic/fighters.js';
import { battleKitFor } from '../logic/battle-anims.js';
import {
  battleHurtKind,
  battleMoveSound,
  battleSoundFamily,
  battleSoundGet,
  battleSoundLength,
  battleSoundPlays,
  battleSoundPreview,
} from '../logic/battle-sounds.js';
import { battleStage } from '../battle-stage.js';
import { battleStageAt } from '../battle-anim-run.js';
import { battleVoicesPlay } from './battle-voices.js';
import { soundEngine, soundLog } from '../sound.js';
/* eslint-disable no-func-assign */
expose({
  battleCatchSoundPlay: [
    () => battleCatchSoundPlay,
    v => ((battleCatchSoundPlay = v), provide({ battleCatchSoundPlay })),
  ],
  battleHurtSoundPlay: [() => battleHurtSoundPlay, v => ((battleHurtSoundPlay = v), provide({ battleHurtSoundPlay }))],
  battleMoveSoundPlay: [() => battleMoveSoundPlay, v => ((battleMoveSoundPlay = v), provide({ battleMoveSoundPlay }))],
  battleRecallSoundPlay: [
    () => battleRecallSoundPlay,
    v => ((battleRecallSoundPlay = v), provide({ battleRecallSoundPlay })),
  ],
  battleSoundAt: [() => battleSoundAt],
  battleSoundOut: [() => battleSoundOut, v => (battleSoundOut = v)],
  battleSoundPreviewPlay: [() => battleSoundPreviewPlay, v => (battleSoundPreviewPlay = v)],
  battleSounds: [() => battleSounds],
});
/* eslint-enable no-func-assign */
provide({ battleCatchSoundPlay, battleHurtSoundPlay, battleMoveSoundPlay, battleRecallSoundPlay });
/* to-module: end */
/** a battle sound's play list now, on the effects bus with the effects' echo; false when no sound can play */
function battleSoundOut(P) {
  if (!P.length || !soundEngine.ctx || soundEngine.ctx.state !== 'running') return false;
  const T = soundEngine.tracker;
  battleVoicesPlay(T, soundEngine.fx, P, soundEngine.ctx.currentTime + 0.005, { echoTo: T.echoFx });
  return true;
}
/** ms on the stage clock (real time when the stage isn't running, as battleStageAt does) */
const battleSoundAt = (ms, f) =>
  typeof battleStageAt === 'function' ? battleStageAt(ms, f) : setTimeout(f, Math.max(0, ms));
const battleSounds = () => (MUSIC && MUSIC.battle) || null;

/** a move's sound: its family's and type layer's cast now, their hit at r.hit when it lands (a miss, a block: the cast
 * alone). The type is the kit the move plays in (a Bureau bot's moves: the Bureau's). True when its family has a
 * sound (a move on itself then plays it instead of the old status blip) */
function battleMoveSoundPlay(an, r) {
  const M = an && MOVES[an.mid],
    B = battleSounds();
  if (!M || !B || !soundEngine.ctx) return false;
  const fam = battleSoundFamily(M, BATTLE_ANIMS),
    s = typeof battleStage !== 'undefined' && battleStage.s[an.si],
    kit = battleKitFor(BATTLE_ANIMS, M.t, !!(s && isRobotSp(s.sp))),
    S = battleMoveSound(B, fam, kit && kit.id);
  if (!S.cast.length && !S.hit.length) return false;
  soundLog(`battle ${fam || '-'} ${kit ? kit.id : '-'}`);
  battleSoundOut(S.cast);
  const hit = r && typeof r.hit === 'number' ? r.hit : 300;
  if (S.hit.length && !an.miss && !an.blocked && hit < 999) battleSoundAt(hit, () => battleSoundOut(S.hit));
  return S.any;
}
/** a hurt event's sound (logic/battle-sounds.js battleHurtKind) at its hit */
function battleHurtSoundPlay(an, r) {
  const k = battleHurtKind(an),
    S = k && battleSoundGet(battleSounds(), 'hurt.' + k);
  if (!S) return false;
  const hit = r && typeof r.hit === 'number' && r.hit < 999 ? r.hit : 0;
  battleSoundAt(hit, () => battleSoundOut(battleSoundPlays(S)));
  return true;
}
/** the recall's beam (VFX-16): its sound as it starts */
function battleRecallSoundPlay() {
  return battleSoundOut(battleSoundPlays(battleSoundGet(battleSounds(), 'recall')));
}
/** a throw or catch sound (throw, pop, land, wobble, seal; battle-stage.js's pyramidLand is land); false when the
 * section has none, so the caller plays its old one */
function battleCatchSoundPlay(k) {
  const S = battleSoundGet(battleSounds(), 'catch.' + (k === 'pyramidLand' ? 'land' : k));
  return !!S && battleSoundOut(battleSoundPlays(S));
}
/** any battle sound by its name (logic/battle-sounds.js battleSoundNames) as it is heard alone, now: a move sound's
 * hit at its family's hit. For tools/check-sound.py's fingerprints and the console. Returns how long it lasts (s) */
function battleSoundPreviewPlay(name) {
  const S = battleSoundGet(battleSounds(), name),
    [g, k] = String(name).split('.'),
    F = g === 'families' && BATTLE_ANIMS.families[k],
    P = battleSoundPreview(S, F && F.hit < 999 ? F.hit / 1000 : 0.3);
  battleSoundOut(P);
  return battleSoundLength(P);
}
