'use strict';
/* ================= POCKET BILLIES STUDIO · battle effects (the battle preview) =================
   Runs the game's own battle stage (game/js/battle-stage.js) inside the Studio, fed by the Studio's unsaved data and art,
   so moves, backdrops and new billionaires can be checked without starting the game.
   VFX-12: grown into the Battle effects editor (Creatures). Pick a move (in one of the 8 outcomes the look tool films)
   or an event and play it on the real stage at any speed, quality, motion setting and Flashes; its steps (the
   runner's timeline, logic/battle-anims.js battleAnimTimeline) show on a 24 fps scrubber that seeks by playing the
   clip again on a clock of its own, frame by frame, to the cell picked (as tools/look-battle-anims.py films it). Panes
   below the stage tune battleAnims.json (budgets, Part 1's smears; ramps and sprite cells when VFX-10 adds them),
   saved like any section; later steps add theirs to battleFxPanes. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, sceneryArtPaths, sceneryCatalog } from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { smearDialsSet } from '../../game/js/logic/smear.js';
import {
  BATTLE_ANIM_OUTCOMES,
  battleAnimOutcome,
  battleAnimPreviewEvent,
  battleAnimTimeline,
} from '../../game/js/logic/battle-anims.js';
import { frameScheduler } from '../../game/js/frame-scheduler.js';
import { PYRAMID_ART, artLoad } from '../../game/js/art.js';
import { robotArtFiles } from '../../game/js/robot-art.js';
import { robotRigParts, setRigParts, setRobotRigData } from '../../game/js/skeleton-rig.js';
import {
  AREAS,
  actorTop,
  battleStage,
  battleStageCatch,
  battleStageFocus,
  battleStagePlay,
  battleStagePrepare,
  battleStageResize,
  battleStageStart,
  battleStageToCss,
  camAt,
  camHome,
  drawForegrounds,
} from '../../game/js/battle-stage.js';
import { battleAnim } from '../../game/js/battle-anim-run.js';
import { mapHub, walkView } from '../../game/js/walk-view.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { battle3dAttach, battle3dStop } from '../../game/js/battle-3d.js';
import { escapeHtml, saveData, setReducedMotion } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  card,
  drawSoon,
  grid,
  moveOptions,
  numberField,
  openSection,
  peopleOptions,
  render,
  selectField,
  speciesOptions,
  studioState,
} from './studio-app.js';
import { atlasGet, atlasPath, rigFor } from './sprites.js';
import { AMBIENT_PARTICLES } from './world-rules-art.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_FX_CELL: [() => BATTLE_FX_CELL],
  BATTLE_FX_EVENTS: [() => BATTLE_FX_EVENTS],
  BATTLE_FX_EVENT_MS: [() => BATTLE_FX_EVENT_MS],
  BATTLE_FX_MOTION: [() => BATTLE_FX_MOTION],
  BATTLE_FX_OUTCOMES: [() => BATTLE_FX_OUTCOMES],
  BATTLE_FX_PX: [() => BATTLE_FX_PX],
  BATTLE_FX_SPEEDS: [() => BATTLE_FX_SPEEDS],
  battleFreeArea: [() => battleFreeArea, v => ((battleFreeArea = v), provide({ battleFreeArea }))],
  battleFx: [() => battleFx],
  battleFxApply: [() => battleFxApply, v => (battleFxApply = v)],
  battleFxCellsHTML: [() => battleFxCellsHTML, v => (battleFxCellsHTML = v)],
  battleFxClean: [() => battleFxClean, v => (battleFxClean = v)],
  battleFxCtx: [() => battleFxCtx],
  battleFxDrawTimeline: [() => battleFxDrawTimeline, v => (battleFxDrawTimeline = v)],
  battleFxHoldable: [() => battleFxHoldable, v => (battleFxHoldable = v)],
  battleFxMoveTimeline: [() => battleFxMoveTimeline, v => (battleFxMoveTimeline = v)],
  battleFxPanes: [() => battleFxPanes],
  battleFxPause: [() => battleFxPause, v => (battleFxPause = v)],
  battleFxPlay: [() => battleFxPlay, v => (battleFxPlay = v)],
  battleFxRampsHTML: [() => battleFxRampsHTML, v => (battleFxRampsHTML = v)],
  battleFxSeek: [() => battleFxSeek, v => (battleFxSeek = v)],
  battleFxShowTime: [() => battleFxShowTime, v => (battleFxShowTime = v)],
  battleFxSpan: [() => battleFxSpan, v => (battleFxSpan = v)],
  battleFxStart: [() => battleFxStart, v => (battleFxStart = v)],
  battleFxStep: [() => battleFxStep, v => (battleFxStep = v)],
  battleFxStepName: [() => battleFxStepName],
  battleFxStepSpan: [() => battleFxStepSpan, v => (battleFxStepSpan = v)],
  battleFxWhatHTML: [() => battleFxWhatHTML, v => (battleFxWhatHTML = v)],
  battleLayoutChanged: [() => battleLayoutChanged, v => ((battleLayoutChanged = v), provide({ battleLayoutChanged }))],
  battlePreview: [() => battlePreview],
  battlePreviewDefaults: [() => battlePreviewDefaults, v => (battlePreviewDefaults = v)],
  battlePreviewEvent: [() => battlePreviewEvent],
  battlePreviewFighters: [() => battlePreviewFighters, v => (battlePreviewFighters = v)],
  battlePreviewLeave: [() => battlePreviewLeave, v => ((battlePreviewLeave = v), provide({ battlePreviewLeave }))],
  battlePreviewPlay: [() => battlePreviewPlay, v => (battlePreviewPlay = v)],
  battlePreviewReset: [() => battlePreviewReset, v => (battlePreviewReset = v)],
  bfxEntries: [() => bfxEntries],
  bfxNum: [() => bfxNum],
  coatOptions: [() => coatOptions],
  fighterOptions: [() => fighterOptions],
  hudHit: [() => hudHit, v => ((hudHit = v), provide({ hudHit }))],
  hudPop: [() => hudPop, v => ((hudPop = v), provide({ hudPop }))],
  isRobotFighter: [() => isRobotFighter],
  loadFighterArt: [() => loadFighterArt],
  mountBattlePreviewMap: [() => mountBattlePreviewMap, v => (mountBattlePreviewMap = v)],
  playBattlePreviewMove: [() => playBattlePreviewMove, v => (playBattlePreviewMove = v)],
  robotFighterOk: [() => robotFighterOk, v => (robotFighterOk = v)],
  robotOptions: [() => robotOptions, v => (robotOptions = v)],
  startBattlePreview: [() => startBattlePreview, v => (startBattlePreview = v)],
});
/* eslint-enable no-func-assign */
provide({ battleFreeArea, battleLayoutChanged, battlePreviewLeave, hudHit, hudPop });
/* to-module: end */
setRigParts((sp, k, coat) =>
  String(sp).startsWith('bot:') ? robotRigParts(sp, k) : rigFor(sp, k === 1 ? 'front' : 'back', coat)
);
/* studio track ST-5: robots can fight in the preview too: the trainers' robots and the Robots section's Try a build */
const isRobotFighter = sp => String(sp).startsWith('bot:');
function robotFighterOk(sp) {
  const R = studioState.D.robots,
    a = String(sp).slice(4).split('.');
  return !!(R && a.length === 5 && R.gems[a[0]] && a.slice(1).every(id => R.parts[id]));
}
function robotOptions() {
  const R = studioState.D.robots,
    out = new Map(),
    label = (a, who) =>
      `Robot: ${a
        .slice(1)
        .map(id => R.parts[id].short || R.parts[id].name)
        .join(' · ')}, ${R.gems[a[0]].name} (${who})`;
  const add = (sp, who) => {
    if (robotFighterOk(sp) && !out.has(sp)) out.set(sp, label(sp.slice(4).split('.'), who));
  };
  const B = studioState.sel.rbBuild;
  if (B) add(`bot:${B.gem}.${B.torso}.${B.armL}.${B.armR}.${B.legs}`, 'Try a build');
  for (const T of Object.values(studioState.D.trainers || {}))
    for (const m of T.team || [])
      if (m.sp === 'robot' && m.robot) {
        const r = m.robot;
        add(`bot:${r.gem}.${r.torso}.${r.armL}.${r.armR}.${r.legs}`, T.name);
      }
  return [...out];
}
const fighterOptions = () => [...speciesOptions(), ...robotOptions()];
/* what a fighter's picture needs: a Billie's sheet, a robot's part pictures */
const loadFighterArt = (sp, view) =>
  isRobotFighter(sp) ? artLoad(robotArtFiles(sp, studioState.D.robots)) : atlasGet(atlasPath(sp, view));
const coatOptions = () => [
  ['', 'No coat'],
  ...Object.entries(studioState.D.coats || {}).map(([k, c]) => [k, c.name || k]),
];
export const battlePreview = {
  /* VFX-12: a walk scene (battlePreviewDefaults picks one): battles only draw there since phase 06-3 */
  stage: null,
  area: null,
  me: null,
  foe: null,
  meCoat: '',
  foeCoat: '',
  move: null,
  res: 'hit',
  who: 'chad',
  started: false,
  shock: false,
  /* VFX-12: the Battle effects editor's clip (a move or an event, and who plays it) and how it plays */
  clip: 'move',
  ev: 'heal',
  side: 0,
  speed: 1,
  q: 0,
  motion: 'full',
  flashes: true,
};
function battleFreeArea(vw, vh) {
  return { x: 0, y: 0, w: vw, h: vh };
}
function battleLayoutChanged(L) {
  const bl = $('#bloom');
  if (bl) {
    const s = 70 * L.u;
    bl.style.width = bl.style.height = s + 'px';
    bl.style.left = L.fx + 162 * L.u - s / 2 + 'px';
    bl.style.top = L.fy + 34 * L.u - s / 2 + 'px';
    bl.hidden = !!AREAS[battleStage.area].indoor;
  }
}
function hudPop(si, text, kind) {
  const L = $('#pops');
  if (!L || !battleStage.L) return;
  const q = battleStageToCss(actorTop(si));
  if (!q) return;
  const e = document.createElement('div');
  e.className = 'pop ' + kind;
  e.textContent = text;
  e.style.left = q.x + 'px';
  e.style.top = q.y + 'px';
  L.appendChild(e);
  setTimeout(() => e.remove(), 1400);
}
function hudHit(ti, an) {
  if (an.dmg) hudPop(ti, '−' + an.dmg, 'dmg' + (an.te > 1 ? ' se' : '') + (an.crit ? ' crit' : ''));
}
function battlePreviewDefaults() {
  const D = studioState.D,
    ids = D.lines.flatMap(L => L.names.map((n, i) => L.id + i)).filter(id => studioState.rigs[id]);
  if (!battlePreview.area || !D.battleStages[battlePreview.area])
    battlePreview.area = D.locations[0].battleStage || Object.keys(D.battleStages)[0];
  const ok = sp => !!sp && (isRobotFighter(sp) ? robotFighterOk(sp) : !!studioState.rigs[sp]);
  if (!ok(battlePreview.me)) battlePreview.me = (D.rules.start.starters[0] || D.lines[0].id) + '0';
  if (!ok(battlePreview.foe)) battlePreview.foe = ids[3] || ids[0];
  if (!battlePreview.move || !D.moves[battlePreview.move]) battlePreview.move = Object.keys(D.moves)[1];
  const maps = D.maps || {};
  if (battlePreview.stage !== 'backdrop' && !maps[battlePreview.stage])
    battlePreview.stage = maps.copperleaf ? 'copperleaf' : Object.keys(maps)[0] || 'backdrop';
  if (!BATTLE_ANIM_OUTCOMES.includes(battlePreview.res)) battlePreview.res = 'hit';
}
const battlePreviewEvent = () => ({
  s: [
    { sp: battlePreview.me, coat: battlePreview.meCoat || null, st: null },
    { sp: battlePreview.foe, coat: battlePreview.foeCoat || null, st: null },
  ],
});
/* VFX-12: the 8 outcomes (logic/battle-anims.js BATTLE_ANIM_OUTCOMES), the events, the speeds (the game's Normal, Fast
   and Faster, slow motion and the quick check's 4x), the motion settings */
const BATTLE_FX_OUTCOMES = {
  hit: 'Normal hit',
  se: 'Super effective (×2)',
  x4: 'Super effective (×4)',
  nve: 'Not very effective',
  crit: 'Critical hit',
  secrit: 'Super-effective crit',
  miss: 'Miss',
  blocked: 'Blocked by Guard',
};
const BATTLE_FX_EVENTS = [
  ['heal', 'Heal'],
  ['statup', 'Stat up'],
  ['statdn', 'Stat down'],
  ['par', 'Paralyzed'],
  ['slp', 'Asleep'],
  ['brn', 'Burned'],
  ['hype', 'Confusion'],
  ['hurt', 'Status damage'],
  ['lvl', 'Level up'],
  ['shock', 'Sandstorm'],
  ['faint1', 'They faint'],
  ['faint0', 'Yours faints'],
  ['wild', 'Wild appears'],
  ['trainer', 'Trainer intro'],
  ['enter0', 'Send yours out'],
  ['enter1', 'Send theirs out'],
  ['recall', 'Recall'],
  ['catch', 'Throw: caught'],
  ['escape', 'Throw: breaks free'],
];
const BATTLE_FX_SPEEDS = [
  [0.25, '¼×'],
  [0.5, '½×'],
  [1, 'Normal'],
  [1.6, 'Fast'],
  [2.2, 'Faster'],
  [4, '4×'],
];
const BATTLE_FX_MOTION = [
  ['full', 'Full'],
  ['calm', 'Calm'],
  ['reduced', 'Reduced'],
];
/* an event's clip has no steps in the data yet (VFX-14 and VFX-16 add them): the scrubber runs this long */
const BATTLE_FX_EVENT_MS = 2400;
/** one 24 fps cell (logic/smear.js SMEAR_STEP: hits step at 24 fps, loops at 12) */
const BATTLE_FX_CELL = 1000 / 24;
/** VFX-12: the panes under the stage, each { id, title, sub?, html(A, D) }: what later steps tune adds a pane here
 * (VFX-13's tier table, VFX-15's moods and scars, VFX-11's families and kits). A is battleAnims.json (the unsaved
 * data); a field's path is `battleAnims.<key>` (studio-app.js numberField and the others), so it saves, undoes and
 * goes into a draft like any section's */
const battleFxPanes = [];
/** VFX-12: the editor's playing state: the clip playing (its move event or event key), its timeline, when it started
 * on the stage clock, how long it runs, whether the stage is held (paused) and the frame function a seek steps */
export const battleFx = { clip: null, T: null, t0: 0, dur: 0, at: 0, paused: false, frame: null, raf: 0 };

/* VFX-12: the Play card's move or event fields (a switch between them redraws only these, not the stage) */
function battleFxWhatHTML() {
  const opt = (arr, v) =>
    arr
      .map(
        ([k, n]) =>
          `<option value="${escapeHtml(k)}" ${String(k) === String(v) ? 'selected' : ''}>${escapeHtml(n)}</option>`
      )
      .join('');
  return battlePreview.clip === 'move'
    ? `<label class="fld"><span>Move</span><select data-bp="move">${opt(moveOptions(), battlePreview.move)}</select></label><label class="fld"><span>Outcome</span><select data-bp="res">${opt(Object.entries(BATTLE_FX_OUTCOMES), battlePreview.res)}</select></label>`
    : `<label class="fld"><span>Event</span><select data-bp="ev">${opt(BATTLE_FX_EVENTS, battlePreview.ev)}</select></label><select data-bp="who" class="sm" aria-label="The trainer (Trainer intro)">${opt(peopleOptions(), battlePreview.who)}</select>`;
}
SECTIONS.preview = () => {
  const D = studioState.D;
  battlePreviewDefaults();
  const p = `battleStages.${battlePreview.area}`;
  afterRender(startBattlePreview);
  afterRender(battleFxDrawTimeline);
  const opt = (arr, v) =>
      arr
        .map(
          ([k, n]) =>
            `<option value="${escapeHtml(k)}" ${String(k) === String(v) ? 'selected' : ''}>${escapeHtml(n)}</option>`
        )
        .join(''),
    seg = (k, arr) =>
      arr
        .map(
          ([v, n]) =>
            `<button class="seg sm ${String(battlePreview[k]) === String(v) ? 'on' : ''}" data-act="bfxSet" data-k="${k}" data-v="${escapeHtml(v)}" aria-pressed="${String(battlePreview[k]) === String(v)}">${escapeHtml(n)}</button>`
        )
        .join('');
  return `<div class="ed-col solo bp"><div class="ed-head"><div><h2>Battle effects</h2><p class="sub">The game’s real battle stage, using your unsaved changes: play a move or an event at any speed, quality, motion setting and Flashes, step through it a 24 fps cell at a time, and tune battleAnims.json below. Art you replaced in the Art browser appears here after you save.</p></div></div>
 <div class="bp-wrap"><div class="bp-main"><div class="bp-stage" id="battle" data-layout="landscape"><div class="bstage" id="stage"><div class="cam" id="camWorld"><canvas id="cvWorld"></canvas></div><div class="cam" id="camFg"><canvas id="cvFg"></canvas></div><div class="bloom" id="bloom"></div><div class="vign"></div><div class="flash" id="flash"></div><div class="pops" id="pops"></div></div><div class="bp-loading" id="bpLoad">Loading the stage…</div></div>
 <section class="card bfx-player" id="bfxPlayer"><div class="seg-row"><button class="btn sm primary" data-act="bfxPlay" data-side="0" title="Play it from your side">▶ You</button><button class="btn sm primary" data-act="bfxPlay" data-side="1" title="Play it from their side">▶ They</button><button class="btn sm" data-act="bfxPause" id="bfxPause" title="Hold the stage (or go on)">❚❚</button><button class="btn sm" data-act="bfxStep" data-d="-1" title="One 24 fps cell back">◀ cell</button><button class="btn sm" data-act="bfxStep" data-d="1" title="One 24 fps cell on">cell ▶</button><output id="bfxTime" class="mono">0 ms</output></div>
  <div class="bfx-tl" id="bfxTl"></div></section>
 <div class="bfx-panes">${battleFxPanes.map(P => card(P.title, P.html(D.battleAnims || {}, D), { sub: P.sub, cls: 'bfx-pane', id: 'bfxPane-' + P.id })).join('')}</div></div>
 <aside class="bp-ctl">
  ${card(
    'Play',
    `<div class="seg-row" role="group" aria-label="What plays">${seg('clip', [
      ['move', 'A move'],
      ['event', 'An event'],
    ])}</div>
   <div id="bfxWhat">${battleFxWhatHTML()}</div>
   <div class="bfx-set"><span class="help">Speed</span><div class="seg-row">${seg('speed', BATTLE_FX_SPEEDS)}</div>
   <span class="help">Quality</span><div class="seg-row">${seg(
     'q',
     [0, 1, 2, 3].map(q => [q, q === 0 ? '0 best' : String(q)])
   )}</div>
   <span class="help">Motion</span><div class="seg-row">${seg('motion', BATTLE_FX_MOTION)}</div>
   <span class="help">Flashes</span><div class="seg-row">${seg('flashes', [
     [true, 'On'],
     [false, 'Off'],
   ])}</div>
   <span class="help">Camera</span><div class="seg-row">${['wide', 'foe', 'me'].map(f => `<button class="seg sm" data-act="bp" data-x="cam-${f}">${f}</button>`).join('')}</div></div>`
  )}
  ${card(
    'Who’s fighting',
    `<label class="fld"><span>Your Billie or robot (back view)</span><select data-bp="me">${opt(fighterOptions(), battlePreview.me)}</select></label><label class="fld"><span>Its coat</span><select data-bp="meCoat">${opt(coatOptions(), battlePreview.meCoat)}</select></label>
   <label class="fld"><span>Opponent (front view)</span><select data-bp="foe">${opt(fighterOptions(), battlePreview.foe)}</select></label><label class="fld"><span>Its coat</span><select data-bp="foeCoat">${opt(coatOptions(), battlePreview.foeCoat)}</select></label>`
  )}
  ${card(
    'Stage',
    `<label class="fld"><span>Where the battle happens</span><select data-bp="stage">${Object.entries(D.maps || {})
      .map(
        ([k, s]) =>
          `<option value="${escapeHtml(k)}" ${battlePreview.stage === k ? 'selected' : ''}>Walk scene: ${escapeHtml(s.name || k)}</option>`
      )
      .join(
        ''
      )}<option value="backdrop" ${battlePreview.stage === 'backdrop' ? 'selected' : ''}>No walk scene (the painted backdrop is gone: a dark stage)</option></select></label><p class="help">In the game, battles happen in the walk scene where you stand.</p>`
  )}
  ${card(
    'Backdrop',
    `<label class="fld"><span>Battle backdrop</span><select data-bp="area">${opt(
      Object.entries(D.battleStages).map(([k, v]) => [k, v.name || k]),
      battlePreview.area
    )}</select></label>
   ${selectField('In the air', `${p}.amb`, AMBIENT_PARTICLES)}
   <p class="help">Changes apply live. A backdrop is now its name, indoors or not, and what floats in the air.</p>`
  )}
 </aside></div></div>`;
};
async function startBattlePreview() {
  const D = studioState.D;
  if (!$('#cvWorld')) return;
  setRobotRigData(D.robots);
  /* VFX-12: a stage already running takes new fighters at once; its restart below waits on loading (and, in a walk
     scene drawn in software, on slow frames) */
  if (battleStage.on && battleStage.s) battlePreviewFighters();
  const load = $('#bpLoad');
  if (load) load.hidden = false;
  try {
    await Promise.all([
      battleStagePrepare(battlePreview.area),
      artLoad(PYRAMID_ART),
      loadFighterArt(battlePreview.me, 'back'),
      loadFighterArt(battlePreview.foe, 'front'),
    ]);
  } catch (e) {
    if (load) load.textContent = 'Couldn’t load this stage: ' + e.message;
    return;
  }
  if (!$('#cvWorld')) return;
  battleStage.lockQ = true;
  battleStage.q.lvl = 0;
  if (battleStage.gl && typeof battle3dStop === 'function') {
    battle3dStop();
    battleStage.gl = false;
  }
  battleStageStart(battlePreview.area);
  battleFxHoldable();
  /* VFX-12: the fighters stand before the walk scene mounts (it takes a while; what reads them needn't wait) */
  battlePreviewFighters();
  if (
    battlePreview.stage !== 'backdrop' &&
    studioState.D.maps &&
    studioState.D.maps[battlePreview.stage] &&
    typeof battle3dAttach === 'function'
  ) {
    await mountBattlePreviewMap();
  }
  if (load) load.hidden = true;
  /* VFX-12: the section may have been left while the walk scene mounted */
  if (!$('#battle')) return;
  if (!battlePreview.ro)
    battlePreview.ro = new ResizeObserver(() => {
      if (battleStage.on && studioState.sec === 'preview' && $('#battle')) battleStageResize();
    });
  battlePreview.ro.disconnect();
  battlePreview.ro.observe($('#battle'));
  battlePreviewFighters();
}
function battlePreviewFighters() {
  Object.assign(battleStage.s[0], {
    sp: battlePreview.me,
    coat: battlePreview.meCoat || null,
    show: true,
    sc: 1,
    a: 1,
  });
  Object.assign(battleStage.s[1], {
    sp: battlePreview.foe,
    coat: battlePreview.foeCoat || null,
    show: true,
    sc: 1,
    a: 1,
  });
  battleStage.oil = battlePreview.shock;
}
/* the engine stage: the chosen walk scene, mounted on its own canvas inside the battle stage */
async function mountBattlePreviewMap() {
  const id = battlePreview.stage,
    sc = studioState.D.maps[id],
    C = sceneryCatalog();
  await Promise.all(sceneryArtPaths(C).map(p => atlasGet('art/' + p).catch(() => null)));
  const host = $('#camWorld');
  if (!host) return;
  let cv = document.createElement('canvas');
  cv.id = 'bpDio';
  host.insertBefore(cv, host.firstChild);
  await mountWalkView(cv, id, {
    state: () => ({ mode: 'roam', roam: true, pos: mapHub(sc), who: null, enc: [], npcs: [], exits: [] }),
    keys: () => false,
    onPick: () => {},
    cap: () => (studioState.sec === 'preview' ? 60 : 0),
  });
  if (!walkView.cv || !$('#camWorld')) return;
  const hb = mapHub(sc);
  walkView.pl.x = hb[0];
  walkView.pl.z = hb[1];
  battleStage.gl = battle3dAttach({ detach: true });
  document.body.classList.toggle('battle-3d', !!battleStage.gl);
  battleStageResize();
  drawForegrounds();
}
document.addEventListener('change', ev => {
  const el = ev.target,
    k = el.dataset && el.dataset.bp;
  if (!k) return;
  battlePreview[k] = el.type === 'checkbox' ? el.checked : el.value;
  if (['area', 'stage'].includes(k)) {
    render();
    return;
  }
  if (['me', 'foe', 'meCoat', 'foeCoat'].includes(k)) startBattlePreview();
  /* VFX-12: a new move, outcome or event: its steps */
  if (['move', 'res', 'ev'].includes(k)) {
    battleFx.clip = null;
    battleFxDrawTimeline();
  }
});
function playBattlePreviewMove(si) {
  const D = studioState.D,
    M = D.moves[battlePreview.move],
    fx = M.fx || {},
    an = battleAnimPreviewEvent(battlePreview.move, M, si, battlePreview.res),
    r = battleStagePlay(an, battlePreviewEvent());
  if (!an.self && !an.protect && !an.miss && !an.blocked && fx.status)
    setTimeout(
      () => battleStagePlay({ k: 'status', si: 1 - si, st: fx.status }, battlePreviewEvent()),
      1100 / battleStage.speed
    );
  return { an, r };
}
/* the fighters as they were, and nothing left of the last clip on them */
function battlePreviewReset() {
  for (const [i, sp, coat] of [
    [0, battlePreview.me, battlePreview.meCoat],
    [1, battlePreview.foe, battlePreview.foeCoat],
  ])
    Object.assign(battleStage.s[i], {
      sp,
      coat: coat || null,
      show: true,
      sc: 1,
      a: 1,
      white: 0,
      dark: 0,
      oy: 0,
      ox: 0,
      act: null,
      blinkUntil: 0,
      lunge: null,
      trail: null,
    });
}
/* an event (the Effects buttons before VFX-12, now the editor's events) */
function battlePreviewPlay(x) {
  const ev = battlePreviewEvent(),
    later = (ms, f) => setTimeout(f, ms / battleStage.speed);
  switch (x) {
    case 'wild':
      battlePreviewReset();
      battleStage.s[0].show = false;
      battleStagePlay({ k: 'wild' }, ev);
      later(1350, () => battleStagePlay({ k: 'enter', si: 0 }, ev));
      break;
    case 'trainer':
      battlePreviewReset();
      battleStage.s[0].show = battleStage.s[1].show = false;
      battleStagePlay({ k: 'trainerIn', who: battlePreview.who }, ev);
      later(1250, () => battleStagePlay({ k: 'enter', si: 1 }, ev));
      later(2300, () => battleStagePlay({ k: 'enter', si: 0 }, ev));
      break;
    case 'enter0':
      battleStagePlay({ k: 'enter', si: 0 }, ev);
      break;
    case 'enter1':
      battleStagePlay({ k: 'enter', si: 1 }, ev);
      break;
    case 'recall':
      battleStagePlay({ k: 'recall', si: 0 }, ev);
      later(900, () => battleStagePlay({ k: 'enter', si: 0 }, ev));
      break;
    case 'move0':
      battlePreviewReset();
      playBattlePreviewMove(0);
      break;
    case 'move1':
      battlePreviewReset();
      playBattlePreviewMove(1);
      break;
    case 'heal':
      battleStagePlay({ k: 'heal', si: 0, amt: 18 }, ev);
      break;
    case 'statup':
      battleStagePlay({ k: 'stat', si: 0, up: true }, ev);
      break;
    case 'statdn':
      battleStagePlay({ k: 'stat', si: 1, up: false }, ev);
      break;
    case 'par':
    case 'slp':
    case 'brn':
      battleStagePlay({ k: 'status', si: 1, st: x }, ev);
      break;
    case 'hype':
      battleStagePlay({ k: 'hype', si: 1 }, ev);
      break;
    case 'hurt':
      battleStagePlay({ k: 'hurt', si: 1, fx: 'brn', dmg: 7 }, ev);
      break;
    case 'lvl':
      battleStagePlay({ k: 'lvl' }, ev);
      break;
    case 'shock':
      battlePreview.shock = !battleStage.oil;
      if (battlePreview.shock) battleStagePlay({ k: 'market' }, ev);
      else battleStagePlay({ k: 'marketEnd' }, ev);
      break;
    case 'faint1':
      battleStagePlay({ k: 'faint', si: 1 }, ev);
      later(1600, battlePreviewReset);
      break;
    case 'faint0':
      battleStagePlay({ k: 'faint', si: 0 }, ev);
      later(1600, battlePreviewReset);
      break;
    case 'catch':
    case 'escape':
      battlePreviewReset();
      battleStageCatch('pyramid', { caught: x === 'catch', w: x === 'catch' ? 3 : 1 }, false, ok => {
        if (ok) later(600, battlePreviewReset);
      });
      break;
  }
}
ACTIONS.bp = d => {
  if (!battleStage.L) return;
  const x = d.x;
  if (x.startsWith('cam-')) {
    battleStageFocus(x.slice(4));
    if (x === 'cam-wide') camHome(400);
    else camAt(x === 'cam-foe' ? 1 : 0, 0.45, 0.15, 0, 400);
    return;
  }
  if (x.startsWith('speed-')) {
    battlePreview.speed = +x.slice(6);
    battleStage.speed = battlePreview.speed;
    return;
  }
  battlePreviewPlay(x);
};

/* ---------- VFX-12: the Battle effects editor: how it plays, the clip, the scrubber ---------- */
/** the stage's settings from the editor's: speed, the quality (held), motion (Reduced; Calm as the game's
 * data-motion), Flashes (the Studio's stand-in save), and Part 1's dials from the unsaved data */
function battleFxApply() {
  battleStage.speed = +battlePreview.speed || 1;
  battleStage.lockQ = true;
  battleStage.q.lvl = +battlePreview.q || 0;
  setReducedMotion(battlePreview.motion === 'reduced');
  const root = document.documentElement;
  if (battlePreview.motion === 'calm') root.dataset.motion = 'calm';
  else if (root.dataset.motion === 'calm') delete root.dataset.motion;
  saveData.preferences = saveData.preferences || {};
  if (battlePreview.flashes) delete saveData.preferences.flashes;
  else saveData.preferences.flashes = 'off';
  const A = studioState.D.battleAnims;
  if (A && A.smears) smearDialsSet(A.smears);
}
/** leaving the section: the Studio's own settings back (no Reduced motion, Calm or Flashes off left behind) */
function battlePreviewLeave() {
  cancelAnimationFrame(battleFx.raf);
  battleFx.paused = false;
  battleFx.clip = null;
  setReducedMotion(false);
  if (document.documentElement.dataset.motion === 'calm') delete document.documentElement.dataset.motion;
  if (saveData.preferences) delete saveData.preferences.flashes;
}
/** the stage's frame task, held while battleFx.paused (a seek steps it by hand: battleFx.frame) */
function battleFxHoldable() {
  const T = frameScheduler.tasks.get('scene');
  if (!T || T.fn.bfx) return;
  const real = T.fn;
  battleFx.frame = real;
  T.fn = Object.assign((ts, dt) => (battleFx.paused ? undefined : real(ts, dt)), { bfx: 1 });
}
/** nothing left of the last clip: tweens, timed steps, particles, shake, hit-stop, the impact frame, the flash, the
 * camera home and wide, the fighters as they were */
function battleFxClean() {
  const S = battleStage;
  S.tws.length = 0;
  S.evs.length = 0;
  S.parts.length = 0;
  S.impact = null;
  S.ca = null;
  S.shk = 0;
  S.hold = 0;
  S.coin = null;
  S.ring = null;
  battleAnim.flashes.times.length = 0;
  battleAnim.cur = null;
  Object.assign(S.drift, { w: 0, tq: -1, x: 0, y: 0, z: 0, yaw: 0, hz: 0 });
  S.hand.a = 0;
  S.camT = 0;
  camHome(0);
  battleStageFocus('wide', true);
  const pops = $('#pops'),
    fl = $('#flash');
  if (pops) pops.innerHTML = '';
  if (fl) {
    fl.style.transition = 'none';
    fl.style.opacity = 0;
  }
  battlePreviewReset();
}
/** the stage a timeline is built for: the editor's settings */
const battleFxCtx = () => ({
  gl: !!battleStage.gl,
  reduced: battlePreview.motion === 'reduced',
  q: +battlePreview.q || 0,
  speed: +battlePreview.speed || 1,
});
/** the picked move's event and timeline from side si (null for an event: its steps aren't data yet) */
function battleFxMoveTimeline(si) {
  const D = studioState.D,
    M = D.moves[battlePreview.move];
  if (battlePreview.clip !== 'move' || !M || !D.battleAnims) return null;
  const an = battleAnimPreviewEvent(battlePreview.move, M, si, battlePreview.res);
  return battleAnimTimeline(an, M, battleFxCtx(), D.battleAnims);
}
/** when a step starts (its `at` and any delay of its own) and about how long it lasts, stage ms */
function battleFxStepSpan(S) {
  const start = (S.at || 0) + (typeof S.delay === 'number' ? S.delay : 0),
    len =
      S.do === 'lunge'
        ? Math.max(S.dur || 0, (S.backAt || 0) + (S.backDur || 0))
        : S.do === 'dodge'
          ? (S.backAt || 0) + (S.backDur || 0)
          : [S.d, S.ms, S.life, S.dur].find(v => typeof v === 'number') || 0;
  return [start, len];
}
/** how far the scrubber runs: past the timeline's dur to its last step's end (the camera comes home after it) */
function battleFxSpan(T) {
  if (!T) return BATTLE_FX_EVENT_MS;
  let end = T.dur;
  for (const S of T.steps) {
    const [a, l] = battleFxStepSpan(S);
    end = Math.max(end, a + l);
  }
  return Math.ceil(end / BATTLE_FX_CELL) * BATTLE_FX_CELL;
}
/** plays the picked clip from side si on the stage (now: on whatever clock performance.now and setTimeout are) */
function battleFxStart(si) {
  battleFxApply();
  battleFxClean();
  battleFx.side = si;
  battleFx.t0 = battleStage.t;
  if (battlePreview.clip === 'move' && studioState.D.moves[battlePreview.move]) {
    battleFx.T = battleFxMoveTimeline(si);
    playBattlePreviewMove(si);
  } else {
    battleFx.T = null;
    battlePreviewPlay(battlePreview.ev);
  }
  battleFx.clip = `${battlePreview.clip}:${battlePreview.clip === 'move' ? battlePreview.move + ':' + battlePreview.res : battlePreview.ev}:${si}`;
  battleFx.dur = battleFxSpan(battleFx.T);
}
/** plays it live, the scrubber following */
export function battleFxPlay(si) {
  if (!battleStage.L || !battleStage.on) return false;
  battleFxHoldable();
  battleFx.paused = false;
  battleFxStart(si);
  battleFxDrawTimeline();
  cancelAnimationFrame(battleFx.raf);
  const follow = () => {
    if (!battleFx.clip || battleFx.paused) return;
    battleFx.at = Math.min(battleFx.dur, battleStage.t - battleFx.t0);
    battleFxShowTime();
    if (battleStage.t - battleFx.t0 < battleFx.dur + 300) battleFx.raf = requestAnimationFrame(follow);
  };
  battleFx.raf = requestAnimationFrame(follow);
  return true;
}
/** holds the stage (or lets it go on) */
export function battleFxPause(on = !battleFx.paused) {
  battleFxHoldable();
  battleFx.paused = on;
  const b = $('#bfxPause');
  if (b) b.classList.toggle('on', on);
  if (!on && battleFx.clip) {
    const go = () => {
      if (!battleFx.clip || battleFx.paused) return;
      battleFx.at = Math.min(battleFx.dur, battleStage.t - battleFx.t0);
      battleFxShowTime();
      if (battleStage.t - battleFx.t0 < battleFx.dur + 300) battleFx.raf = requestAnimationFrame(go);
    };
    battleFx.raf = requestAnimationFrame(go);
  }
}
/** the clip at ms (stage ms), held: it plays again from its start on a clock of its own, the stage's frame stepped by
 * hand 16 ms at a time (performance.now and setTimeout read that clock meanwhile, as tools/look-battle-anims.py films
 * it), to the first frame at or past ms. Effects draw from a stream seeded per event (battleFxSeed), so it looks the
 * same each time. Timers still due run later in real time; times kept in real time move with the clock */
export function battleFxSeek(ms) {
  if (!battleStage.L || !battleStage.on) return false;
  battleFxHoldable();
  if (!battleFx.frame) return false;
  cancelAnimationFrame(battleFx.raf);
  battleFx.paused = true;
  const b = $('#bfxPause');
  if (b) b.classList.add('on');
  const pn = performance.now,
    st = window.setTimeout,
    t00 = pn.call(performance),
    timers = [];
  let vt = t00;
  performance.now = () => vt;
  window.setTimeout = (fn, d) => {
    timers.push({ t: vt + (+d || 0), fn });
    return 0;
  };
  try {
    battleFxStart(battleFx.side || 0);
    const want = Math.max(0, Math.min(ms, battleFx.dur));
    for (let n = 0; battleStage.t - battleFx.t0 < want - 0.01 && n < 6000; n++) {
      vt += 16;
      timers.sort((x, y) => x.t - y.t);
      while (timers.length && timers[0].t <= vt) timers.shift().fn();
      battleFx.frame(vt, 16);
    }
  } finally {
    performance.now = pn;
    window.setTimeout = st;
  }
  const now = pn.call(performance),
    move = t => now + (t - vt);
  for (const T of timers) setTimeout(T.fn, Math.max(0, T.t - vt) / 1);
  const S = battleStage;
  S.hold = S.hold > vt ? move(S.hold) : 0;
  if (S.ca) S.ca.t0 = move(S.ca.t0);
  if (S.impact) S.impact.t0 = move(S.impact.t0);
  battleAnim.flashes.times = battleAnim.flashes.times.map(move);
  battleFx.at = battleStage.t - battleFx.t0;
  battleFxShowTime();
  return true;
}
/** one 24 fps cell on (d 1) or back (d -1) from where the scrubber is */
function battleFxStep(d) {
  const c = Math.round(battleFx.at / BATTLE_FX_CELL) + d;
  return battleFxSeek(Math.max(0, c) * BATTLE_FX_CELL);
}
/** the scrubber, the time and the playhead where the clip is */
function battleFxShowTime() {
  const out = $('#bfxTime'),
    sc = $('#bfxScrub'),
    hd = $('#bfxHead'),
    at = Math.max(0, battleFx.at || 0);
  if (out) out.textContent = `${Math.round(at)} ms · cell ${Math.floor(at / BATTLE_FX_CELL + 1e-6)}`;
  if (sc && document.activeElement !== sc) sc.value = String(at);
  if (hd) hd.style.left = `calc(var(--bfx-lbl) + ${(at / BATTLE_FX_CELL) * BATTLE_FX_PX}px)`;
}
/** pixels a cell on the timeline */
const BATTLE_FX_PX = 12;
/** a step's name on the timeline */
const battleFxStepName = S =>
  [S.do, S.on, S.pose, S.color, S.pop].filter(v => typeof v === 'string' && v).join(' ') +
  (S.types ? ` (${S.types.join(', ')})` : '');
/** the timeline of the picked clip: a summary, a ruler of 24 fps cells, the scrubber, a row per step (its repeats as
 * ticks on one row), the hit and the move's time marked */
function battleFxDrawTimeline() {
  const box = $('#bfxTl');
  if (!box) return;
  const T = battleFx.clip ? battleFx.T : battleFxMoveTimeline(battlePreview.side || 0),
    span = battleFx.clip ? battleFx.dur : battleFxSpan(T),
    cells = Math.round(span / BATTLE_FX_CELL),
    W = cells * BATTLE_FX_PX,
    x = ms => (ms / BATTLE_FX_CELL) * BATTLE_FX_PX,
    rows = [];
  if (T)
    for (const S of T.steps) {
      const [a, l] = battleFxStepSpan(S),
        last = rows[rows.length - 1];
      if (S.i > 0 && last && last.do === S.do) {
        last.ticks.push(a);
        last.end = Math.max(last.end, a + l);
        continue;
      }
      rows.push({ do: S.do, name: battleFxStepName(S), a, end: a + l, ticks: [a], sync: S.sync, skip: S.skip });
    }
  const A = studioState.D.battleAnims || {},
    M = studioState.D.moves[battlePreview.move],
    cap =
      T && A.maxMs && M
        ? A.maxMs[battleAnimOutcome(battleAnimPreviewEvent(battlePreview.move, M, 0, battlePreview.res), M)]
        : null,
    sum = T
      ? `<b>${escapeHtml(T.kind)}: ${escapeHtml(T.id)}</b> · tier ${escapeHtml(T.tier)} · ${T.variant}${T.long ? ' · long' : ''} · ${T.dur} ms (most ${cap ?? '?'}${T.long ? ` + ${A.extraMs}` : ''}) · hit ${T.hit >= 999 ? 'none' : T.hit + ' ms'} · ${T.steps.length} steps · ${cells} cells`
      : battlePreview.clip === 'move'
        ? 'No animation in battleAnims.json for this move'
        : `An event: its steps aren’t data yet (VFX-14 and VFX-16 make them so); the scrubber runs ${BATTLE_FX_EVENT_MS} ms`;
  box.innerHTML = `<p class="bfx-sum">${sum}</p><div class="bfx-scroll"><div class="bfx-body" style="--bfx-lbl:150px;width:calc(150px + ${W}px)">
  <div class="bfx-row bfx-ruler"><span class="bfx-lbl">cells (24 fps)</span><span class="bfx-bars" style="width:${W}px">${Array.from(
    { length: cells + 1 },
    (_, i) => (i % 6 === 0 ? `<em style="left:${i * BATTLE_FX_PX}px">${Math.round(i * BATTLE_FX_CELL)}</em>` : '')
  ).join('')}</span></div>
  <div class="bfx-row"><label class="bfx-lbl" for="bfxScrub">scrub</label><input type="range" id="bfxScrub" min="0" max="${span}" step="${BATTLE_FX_CELL}" value="${Math.min(span, battleFx.at || 0)}" style="width:${W}px" aria-label="Where the clip is, a 24 fps cell a step"></div>
  ${rows
    .map(
      r =>
        `<div class="bfx-row" title="${escapeHtml(r.name)}${r.sync ? ' (at once)' : ''}; a skip: ${r.skip}"><span class="bfx-lbl">${escapeHtml(r.name)}${r.ticks.length > 1 ? ` ×${r.ticks.length}` : ''}</span><span class="bfx-bars" style="width:${W}px"><i class="bfx-bar ${escapeHtml(r.do)}" style="left:${x(r.a)}px;width:${Math.max(2, x(r.end - r.a))}px"></i>${r.ticks.length > 1 ? r.ticks.map(t => `<b style="left:${x(t)}px"></b>`).join('') : ''}</span></div>`
    )
    .join('')}
  ${T && T.hit < 999 ? `<i class="bfx-mark hit" style="left:calc(150px + ${x(T.hit)}px)" title="the hit: the plates repaint"></i>` : ''}${T ? `<i class="bfx-mark dur" style="left:calc(150px + ${x(T.dur)}px)" title="the line may move on"></i>` : ''}<i class="bfx-head" id="bfxHead"></i></div></div>`;
  battleFxShowTime();
}
document.addEventListener('input', ev => {
  if (ev.target && ev.target.id === 'bfxScrub') battleFxSeek(+ev.target.value);
});
ACTIONS.bfxSet = d => {
  const k = d.k,
    v = d.v;
  battlePreview[k] = k === 'speed' || k === 'q' ? +v : k === 'flashes' ? v === 'true' : v;
  if (k === 'clip') {
    const w = $('#bfxWhat');
    if (w) w.innerHTML = battleFxWhatHTML();
  }
  $$(`[data-act="bfxSet"][data-k="${k}"]`).forEach(b => {
    const on = b.dataset.v === String(battlePreview[k]);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (battleStage.on) battleFxApply();
  /* the timeline follows (Faster's variant, the quality, Reduced motion's gates); a held clip is shown again so */
  const held = battleFx.clip && battleFx.paused ? battleFx.at : null;
  battleFx.clip = null;
  if (held != null && battleFxSeek(held)) battleFxDrawTimeline();
  else battleFxDrawTimeline();
};
ACTIONS.bfxPlay = d => {
  battlePreview.side = +d.side || 0;
  battleFxPlay(battlePreview.side);
};
ACTIONS.bfxPause = () => battleFxPause();
ACTIONS.bfxStep = d => {
  if (!battleFx.clip) battleFxStart(battlePreview.side || 0);
  battleFxStep(+d.d || 0);
  battleFxDrawTimeline();
};
/* a field in a pane: Part 1's dials take it at once, the timeline follows */
studioState.hooks.preview = path => {
  if (!String(path).startsWith('battleAnims.')) return;
  const A = studioState.D.battleAnims;
  if (A && A.smears) smearDialsSet(A.smears);
  drawSoon('bfxTimeline', battleFxDrawTimeline);
};

/* ---------- VFX-12: the panes (battleFxPanes) ---------- */
const bfxNum = (label, path, o = {}) =>
  numberField(label, path, { step: o.step || 'any', min: o.min, max: o.max, help: o.help, unit: o.unit });
battleFxPanes.push(
  {
    id: 'timing',
    title: 'Timing and flashes',
    sub: 'How long a move may play and the full-screen flash limiter. Shown, not tuned: no move gets longer (the owner’s rule; maxMs holds the times before VFX-8).',
    html: A =>
      A.maxMs
        ? `<div class="bfx-tw"><table class="bfx-t"><tr><th>Most a move plays (ms)</th>${Object.keys(A.maxMs)
            .map(k => `<th>${escapeHtml(k)}</th>`)
            .join('')}</tr><tr><td></td>${Object.values(A.maxMs)
            .map(v => `<td>${v}</td>`)
            .join(
              ''
            )}</tr></table></div><p class="help">A signature scene or a move of power ${A.longPower}+ may add ${A.extraMs} ms (none under Reduced motion); Faster (speed ${A.shortSpeed}+) plays a family’s short variant; the power80 gate opens at power ${A.bigPower}. Full-screen flashes: at most ${A.flashes.perSecond} in any second, ${A.flashes.gapMs} ms apart, none whose red share is ${A.flashes.redShare}+.</p>`
        : '<p class="help">battleAnims.json has no timing.</p>',
  },
  {
    id: 'budgets',
    title: 'Budgets',
    sub: 'By the battle’s quality, 0 the best (the Quality buttons above pick one to play at). They never grow as the quality drops (the Check says so).',
    html: A =>
      A.budgets
        ? `<div class="bfx-tw"><table class="bfx-t bfx-q"><tr><th></th>${[0, 1, 2, 3].map(q => `<th>q${q}</th>`).join('')}</tr>${[
            ['particles', 'Particles alive (ambient: a quarter)'],
            ['burst', 'A burst’s most'],
            ['lights', 'Effect lights (3 slots)'],
          ]
            .map(
              ([k, n]) =>
                `<tr><th>${n}</th>${[0, 1, 2, 3].map(q => `<td>${bfxNum('', `battleAnims.budgets.${k}.${q}`, { step: 1, min: 0 })}</td>`).join('')}</tr>`
            )
            .join(
              ''
            )}</table></div>${grid(bfxNum('Effect lights on a phone, at most', 'battleAnims.budgets.lightsPhone', { step: 1, min: 0, max: 3 }), bfxNum('Battle lights in all', 'battleAnims.budgets.lightsAll', { step: 1, min: 0, max: 8 }))}`
        : '<p class="help">No budgets in battleAnims.json.</p>',
  },
  {
    id: 'smears',
    title: 'Smears (Part 1)',
    sub: 'The afterimages, the motion-line ribbon and the stretch of a throw, and a lunge’s (VFX-1..VFX-5). They change the stage at once; play a move (a lunge) or Throw: caught (an event) to see them.',
    html: A => {
      const S = A.smears;
      if (!S) return '<p class="help">No smears in battleAnims.json.</p>';
      const looks = (k, name) =>
        `<h4>${name}</h4>${(S[k] || [])
          .map((_, i) =>
            grid(
              bfxNum(`Copy ${i + 1}: drawn`, `battleAnims.smears.${k}.${i}.fade`, {
                step: 0.05,
                min: 0,
                max: 1,
                help: i ? '' : 'newest first; how much of it the dither keeps',
              }),
              bfxNum('brighter by', `battleAnims.smears.${k}.${i}.glow`, { step: 0.05, min: 0, max: 2 })
            )
          )
          .join('')}`;
      return `${looks('ghosts', 'A throw’s afterimages')}${looks('lungeGhosts', 'A lunge’s afterimages')}
       <h4>The ribbon</h4>${grid(
         bfxNum('Places it runs along', 'battleAnims.smears.ribbon.cells', {
           step: 1,
           min: 2,
           max: 12,
           help: '24 a second',
         }),
         bfxNum('Half width at its head', 'battleAnims.smears.ribbon.half', { step: 0.01, min: 0, max: 1, unit: 'm' }),
         bfxNum('Twist with the tumble', 'battleAnims.smears.ribbon.twist', { step: 0.05, min: 0, max: 1 }),
         bfxNum('Brightness', 'battleAnims.smears.ribbon.bright', { step: 0.05, min: 1, max: 2 }),
         bfxNum('White core', 'battleAnims.smears.ribbon.core', {
           step: 0.05,
           min: 0,
           max: 1,
           help: 'share of its width',
         }),
         bfxNum('Tail frayed in flight', 'battleAnims.smears.ribbon.fray', { step: 0.05, min: 0, max: 1 }),
         bfxNum('Erosion steps', 'battleAnims.smears.ribbon.steps', {
           step: 1,
           min: 1,
           max: 8,
           help: 'one a cell once it stops',
         })
       )}
       <h4>A dash’s ribbon</h4>${grid(
         bfxNum('Half width', 'battleAnims.smears.dashRibbon.half', {
           step: 0.01,
           min: 0,
           max: 1,
           help: 'share of the Billie’s height',
         }),
         bfxNum('At least', 'battleAnims.smears.dashRibbon.min', { step: 0.01, min: 0, max: 1, unit: 'm' }),
         bfxNum('At most', 'battleAnims.smears.dashRibbon.max', { step: 0.01, min: 0, max: 1, unit: 'm' })
       )}
       <h4>The stretch</h4>${grid(
         bfxNum('From a pace of', 'battleAnims.smears.stretch.pace', {
           step: 0.05,
           min: 1,
           max: 2,
           help: 'times the throw’s mean speed',
         }),
         bfxNum('Dragged back', 'battleAnims.smears.stretch.k', {
           step: 0.05,
           min: 0,
           max: 1,
           help: 'share of the way to the place a cell ago',
         }),
         bfxNum('At most', 'battleAnims.smears.stretch.max', { step: 0.05, min: 0, max: 2, unit: 'm' })
       )}
       <h4>A lunge’s lean</h4>${grid(
         bfxNum('Lean per px/ms', 'battleAnims.smears.lean.k', { step: 0.05, min: 0, max: 4 }),
         bfxNum('At most', 'battleAnims.smears.lean.max', { step: 0.01, min: 0, max: 0.6 }),
         bfxNum('Moving back home', 'battleAnims.smears.lean.back', {
           step: 0.05,
           min: 0,
           max: 1,
           help: 'share of the lean',
         })
       )}`;
    },
  },
  {
    id: 'ramps',
    title: 'Ramps',
    sub: 'A type’s colours for the effect art’s eight greys, and its light (battleAnims.json ramps).',
    html: A => battleFxRampsHTML(A.ramps),
  },
  {
    id: 'cells',
    title: 'Sprite cells',
    sub: 'The effect art’s strips: cells, frames, size and anchor (battleAnims.json sprites; the pictures in game/art/battle/anims/).',
    html: A => battleFxCellsHTML(A.sprites),
  }
);
/** a section's entries, whether it is a map by id or a list (each with an id) */
const bfxEntries = v =>
  Array.isArray(v)
    ? v.map((x, i) => [String((x && (x.id || x.key || x.name)) || i), x])
    : v && typeof v === 'object'
      ? Object.entries(v)
      : [];
/** VFX-10's ramps, when they are there: each one's colours as swatches, its other words beside them */
function battleFxRampsHTML(R) {
  const L = bfxEntries(R);
  if (!L.length)
    return '<p class="help">No ramps in battleAnims.json yet: VFX-10 (the effect art) adds them, a ramp per type (eight greys mapped to colours, and its light). They show here once it has.</p>';
  return `<div class="bfx-list">${L.map(([k, v]) => {
    const hexes = [],
      words = [];
    JSON.stringify(v, (kk, vv) => {
      if (typeof vv === 'string' && /^#[0-9a-f]{6}$/i.test(vv)) hexes.push(vv);
      else if (kk && (typeof vv === 'string' || typeof vv === 'number')) words.push(`${kk} ${vv}`);
      return vv;
    });
    if (typeof v === 'string' && !hexes.length) words.push(v);
    /* VFX-10's ramp may name an NW_PALETTE ramp (game/art/next/palette.js): its colours */
    const named = v && typeof v === 'object' && typeof v.ramp === 'string' ? v.ramp : typeof v === 'string' ? v : null,
      pal = typeof window !== 'undefined' && window.NW_PALETTE && window.NW_PALETTE.ramps;
    if (named && pal && Array.isArray(pal[named])) hexes.unshift(...pal[named]);
    return `<div class="bfx-ramp"><b>${escapeHtml(k)}</b><span class="bfx-sw">${hexes.map(h => `<i style="background:${h}" title="${h}"></i>`).join('')}</span><small>${escapeHtml(words.join(' · '))}</small></div>`;
  }).join('')}</div>`;
}
/** VFX-10's sprite strips, when they are there: each one's numbers and its picture */
function battleFxCellsHTML(S) {
  const L = bfxEntries(S);
  if (!L.length)
    return '<p class="help">No sprite cells in battleAnims.json yet: VFX-10 (the effect art) adds the strips (sparks, bursts, rings, the beam’s caps…). They show here once it has; repaint one in the Art browser (Edit pixels).</p>';
  return `<div class="bfx-list">${L.map(([k, v]) => {
    const o = v && typeof v === 'object' ? v : {},
      nums = Object.entries(o)
        .filter(([, x]) => typeof x === 'number' || (Array.isArray(x) && x.every(n => typeof n === 'number')))
        .map(([a, b]) => `${a} ${Array.isArray(b) ? b.join('×') : b}`),
      file = typeof o.file === 'string' ? o.file : typeof o.path === 'string' ? o.path : `battle/anims/${k}.png`;
    return `<div class="bfx-cell"><img class="bfx-strip" src="../game/art/${escapeHtml(file.replace(/^art\//, ''))}" alt="" loading="lazy"><b>${escapeHtml(k)}</b><small>${escapeHtml(nums.join(' · '))}</small></div>`;
  }).join('')}</div>`;
}
/* shortcuts from other sections */
ACTIONS.bpFoe = d => {
  battlePreview.foe = d.sp;
  openSection('preview');
};
ACTIONS.bpMove = d => {
  battlePreview.move = d.id;
  battlePreview.clip = 'move';
  openSection('preview');
  /* VFX-12: plays once the stage (a walk scene) is up */
  const t0 = performance.now(),
    go = () => {
      if (studioState.sec !== 'preview') return;
      const L = $('#bpLoad');
      if (battleStage.on && battleStage.L && L && L.hidden) battleFxPlay(0);
      else if (performance.now() - t0 < 30000) setTimeout(go, 300);
    };
  setTimeout(go, 300);
};
ACTIONS.bpArea = d => {
  battlePreview.area = d.k;
  openSection('preview');
};
