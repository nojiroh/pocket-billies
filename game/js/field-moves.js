'use strict';
/* ================= FIELD MOVES ON THE WALK (roguelite track RL-R2) =================
   The owner: "it has to be a bit like he's in Pokémon". A run's side area (logic/run-side.js) waits behind its
   obstacle, a prop on the north road of a place on the main path (act 'field': a bramble, a granite boulder, a
   rowboat at the shore). Tapping it reads as an HM did: without the type's badge kept, "With the Grass Badge, a Grass
   Billie could cut it down"; with the badge but no Billie of the type standing, that; with both, "Would you like to
   use Cut?" in the talk box, as in Pokémon; a yes says "Leafy used Cut!" while the obstacle goes on the map with a
   little burst of leaves (dust for Rock Smash, rings for Surf; its `unless: opened:cut`) and the
   way north opens (run.map.side.open; until then the seam turns you back with the obstacle's words: logic/rules.js
   gateText).
   At the side area's last place its way out (act 'fieldout') takes you back to the main path's next row, a day as any
   arrival (logic/run-map.js runArrive, one way); RL-R2b: as a moment, the picture dipping to dark with the move's
   words on it (fieldMoves.json `travel`) and fading in on the main path. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, toast } from './hooks.js';
import { FIELD_MOVES, LOCATIONS } from './game-data.js';
import { speciesOf } from './logic/fighters.js';
import { billyName } from './logic/rules.js';
import { fieldMoveState, fieldMoveText, runSideOpen } from './logic/run-side.js';
import { runArrive } from './logic/run-map.js';
import { reducedMotion, saveData, saveNow, uiState } from './game-state.js';
import { walkView } from './walk-view.js';
import { addRipple } from './walk/water.js';
import { soundEffect } from './sound.js';
import { talkBox, talkChoose, talkHide, talkLine } from './talk.js';
import { runWorldData } from './run-world.js';
/* eslint-disable no-func-assign */
expose({
  FIELD_TRAVEL_MS: [() => FIELD_TRAVEL_MS],
  fieldBackToast: [() => fieldBackToast],
  fieldBadgeLine: [() => fieldBadgeLine, v => ((fieldBadgeLine = v), provide({ fieldBadgeLine }))],
  fieldMoveBurst: [() => fieldMoveBurst, v => (fieldMoveBurst = v)],
  fieldMoveOpen: [() => fieldMoveOpen, v => (fieldMoveOpen = v)],
  fieldMoveUse: [() => fieldMoveUse, v => (fieldMoveUse = v)],
  fieldSideHere: [() => fieldSideHere, v => (fieldSideHere = v)],
  fieldTeam: [() => fieldTeam],
  fieldWayOut: [() => fieldWayOut, v => (fieldWayOut = v)],
  fieldWayOutGo: [() => fieldWayOutGo, v => (fieldWayOutGo = v)],
  fieldWayOutTravel: [() => fieldWayOutTravel, v => (fieldWayOutTravel = v)],
});
/* eslint-enable no-func-assign */
provide({ fieldBadgeLine });
/* to-module: end */
/** the side area of the run you are on, its field move and whether it is open, or null */
function fieldSideHere() {
  const run = saveData.run,
    S = run && run.map && run.map.side,
    M = S && FIELD_MOVES[S.move];
  return S && M ? { S, M } : null;
}
/** the team's Billies still standing, as fieldMoveState reads them (their names and types) */
const fieldTeam = () =>
  saveData.team.filter(m => m.hp > 0 && speciesOf(m)).map(m => ({ name: billyName(m), types: speciesOf(m).types, m }));
/** tap the obstacle (walk-control.js walkPick, act 'field'): Pokémon's way, in the talk box at the foot of the screen
 * (not a sheet): what it says, then a yes or no when the move can be used. `p` is the prop tapped (where the effect
 * plays) */
export async function fieldMoveOpen(p) {
  const F = fieldSideHere();
  if (!F || F.S.open || talkBox.on) return;
  const team = fieldTeam(),
    st = fieldMoveState(F.M, (saveData.meta || {}).badges, team);
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `field move ${F.S.move}: ${st.state}`);
  if (st.state !== 'ask') {
    const line = fieldMoveText(F.M, st.state);
    await talkLine('me', line, null);
    talkHide();
    return;
  }
  const ask = fieldMoveText(F.M, 'ask');
  await talkLine('me', ask, null);
  const yes = (await talkChoose([{ text: 'Yes' }, { text: 'No' }])) === 0;
  if (!yes) return talkHide();
  const B = team.find(t => t.types.includes(F.M.type));
  await fieldMoveUse(B ? B.m : null, p);
}
/** the move is used: "Leafy used Cut!" in the talk box while the obstacle goes on the map (leaves fly off the bramble,
 * the boulder bursts into dust, the water rings round the boat); the side opens for the rest of the run */
async function fieldMoveUse(m, p) {
  const F = fieldSideHere();
  if (!F) return;
  const used = fieldMoveText(F.M, 'used', m ? billyName(m) : ''),
    said = talkLine('me', used, null);
  fieldMoveBurst(F.M.obstacle, p);
  if (typeof soundEffect === 'function') soundEffect(F.M.obstacle === 'boulder' ? 'crack' : 'whoosh');
  /* the obstacle goes as the burst peaks (its `unless: opened:<move>`: the walk stops drawing and blocking it) */
  await new Promise(res => setTimeout(res, reducedMotion ? 0 : 380));
  if (!runSideOpen(saveData.run.map)) return said.then(talkHide);
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `field move ${F.S.move} used: the side area is open`);
  await said;
  talkHide();
  toast(`The way north is open: ${F.S.name}.`);
}
/** the little animation on the map where the obstacle stands (walk/effects.js draws the bits): leaves for Cut, dust
 * for Rock Smash, rings on the water for Surf @param {string} kind the obstacle @param {any} p the prop */
function fieldMoveBurst(kind, p) {
  if (reducedMotion || !p || !walkView.parts) return;
  const n = kind === 'thorns' ? 26 : 18;
  if (kind === 'shore' && typeof addRipple === 'function')
    for (let k = 0; k < 3; k++) setTimeout(() => addRipple(p.x, p.z, 1 + k * 0.5), k * 160);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4,
      sp = kind === 'boulder' ? 1.6 + Math.random() : 1 + Math.random() * 1.2;
    walkView.parts.push({
      k: kind === 'thorns' ? 'leaf' : 'dust',
      x: p.x + Math.cos(a) * 0.3,
      z: p.z + Math.sin(a) * 0.3,
      y: kind === 'thorns' ? 0.4 + Math.random() * 0.6 : 0.1,
      vx: Math.cos(a) * sp,
      vz: Math.sin(a) * sp,
      vy: kind === 'thorns' ? 1.6 + Math.random() * 1.2 : 0.6 + Math.random() * 0.5,
      life: 0,
      max: kind === 'thorns' ? 1 : 0.8,
      g: kind === 'thorns' ? 3.5 : 0.8,
      fr: i % 3,
    });
  }
}
/** tap the side area's way out (act 'fieldout'): back to the main path (one way), a day */
export async function fieldWayOut() {
  const F = fieldSideHere();
  if (!F || F.S.to < 0 || talkBox.on) return;
  const out = `${fieldMoveText(F.M, 'out')} It only goes one way. Follow it?`;
  await talkLine('me', out, null);
  const yes = (await talkChoose([{ text: 'Yes' }, { text: 'No' }])) === 0;
  talkHide();
  if (yes) await fieldWayOutTravel();
}
/** RL-R2b: how long the way out's moment takes (ms): the dip to dark, the hold with the move's words on it, the
 * fade back in on the main path */
const FIELD_TRAVEL_MS = { dip: 450, hold: 1100, rise: 650 };
/** RL-R2b: the way out as a moment, Pokémon's way (no sheet): the picture dips to dark, the move's own sound and a
 * few words on the dark ("Swept along by the current..."), and it fades in again on the main path (fieldWayOutGo,
 * done behind the dark). Reduced motion: a quick fade alone */
async function fieldWayOutTravel() {
  const F = fieldSideHere();
  if (!F) return;
  const cv = walkView.cv;
  if (!cv || !cv.isConnected) return fieldWayOutGo();
  const quick = reducedMotion,
    T = quick ? { dip: 120, hold: 0, rise: 160 } : FIELD_TRAVEL_MS,
    r = cv.getBoundingClientRect(),
    v = document.createElement('div');
  v.id = 'fieldVeil';
  v.style.cssText =
    'position:fixed;pointer-events:none;background:#07060a;z-index:6;opacity:0;display:flex;align-items:center;' +
    'justify-content:center;color:white;font:inherit;letter-spacing:.04em;text-align:center;padding:0 24px';
  Object.assign(v.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  document.body.appendChild(v);
  const wait = (/** @type {number} */ ms) => new Promise(res => setTimeout(res, ms)),
    /* a fade's end (its transitionend; at most twice its time, so a busy page never holds it) */
    faded = (/** @type {number} */ ms) =>
      new Promise(res => {
        const done = () => (v.removeEventListener('transitionend', done), res(0));
        v.addEventListener('transitionend', done);
        setTimeout(done, ms * 2 + 50);
      }),
    painted = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(0))));
  void v.offsetWidth;
  v.style.transition = `opacity ${T.dip}ms ease-in`;
  v.style.opacity = '1';
  if (typeof soundEffect === 'function') soundEffect(F.M.obstacle === 'boulder' ? 'rumble' : 'whoosh');
  await faded(T.dip);
  /* the words on the dark, drawn before the main path's place is built behind it (that can hold the page a moment) */
  if (!quick && F.M.travel) v.textContent = F.M.travel;
  await painted();
  const t0 = performance.now(),
    back = fieldWayOutGo(true);
  await wait(Math.max(0, T.hold - (performance.now() - t0)));
  v.textContent = '';
  v.style.transition = `opacity ${T.rise}ms ease-out`;
  v.style.opacity = '0';
  await faded(T.rise);
  v.remove();
  if (back) fieldBackToast();
}
/** follow the way out: back on the main path's next row (logic/run-map.js runArrive: a day, one way); `quiet`: no
 * toast (the moment says it once the picture is back) @param {boolean} [quiet] */
export function fieldWayOutGo(quiet) {
  const F = fieldSideHere();
  if (!F) return false;
  if (!runArrive(saveData, F.S.to, runWorldData())) {
    toast('That way isn’t open from here.');
    return false;
  }
  saveData.visited[saveData.trip.node] = 1;
  saveData.mapSeen = null;
  uiState.roam = null;
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `the way out of the side area: day ${saveData.run.clock}`);
  render();
  if (!quiet) fieldBackToast();
  return true;
}
const fieldBackToast = () => toast(`Back on the main path: ${LOCATIONS[saveData.trip.node].name}.`);
/** a badge kept for good (battle.js endBattle, after a run leader's first win): the sheet's line, and what it opens */
function fieldBadgeLine(type) {
  const M = Object.values(FIELD_MOVES).find(x => x.type === type);
  return M
    ? `You'll keep the ${type} Badge for good. ${type} Billies can now use ${M.name} outside battle.`
    : `You'll keep the ${type} Badge for good.`;
}
