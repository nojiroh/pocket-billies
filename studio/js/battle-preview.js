'use strict';
/* ================= POCKET BILLIES STUDIO · battle preview =================
   Runs the game's own battle stage (game/js/battle-stage.js) inside the Studio, fed by the Studio's unsaved data and art,
   so moves, backdrops and new billionaires can be checked without starting the game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, sceneryArtPaths, sceneryCatalog } from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { COIN_ART, artLoad } from '../../game/js/art.js';
import { robotRigParts, setRigParts } from '../../game/js/skeleton-rig.js';
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
import { mapHub, walkView } from '../../game/js/walk-view.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { battle3dAttach, battle3dStop } from '../../game/js/battle-3d.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  card,
  moveOptions,
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
  battleFreeArea: [() => battleFreeArea, v => ((battleFreeArea = v), provide({ battleFreeArea }))],
  battleLayoutChanged: [() => battleLayoutChanged, v => ((battleLayoutChanged = v), provide({ battleLayoutChanged }))],
  battlePreview: [() => battlePreview],
  battlePreviewDefaults: [() => battlePreviewDefaults, v => (battlePreviewDefaults = v)],
  battlePreviewEvent: [() => battlePreviewEvent],
  coatOptions: [() => coatOptions],
  hudHit: [() => hudHit, v => ((hudHit = v), provide({ hudHit }))],
  hudPop: [() => hudPop, v => ((hudPop = v), provide({ hudPop }))],
  mountBattlePreviewMap: [() => mountBattlePreviewMap, v => (mountBattlePreviewMap = v)],
  playBattlePreviewMove: [() => playBattlePreviewMove, v => (playBattlePreviewMove = v)],
  startBattlePreview: [() => startBattlePreview, v => (startBattlePreview = v)],
});
/* eslint-enable no-func-assign */
provide({ battleFreeArea, battleLayoutChanged, hudHit, hudPop });
/* to-module: end */
setRigParts((sp, k, coat) =>
  String(sp).startsWith('bot:') ? robotRigParts(sp, k) : rigFor(sp, k === 1 ? 'front' : 'back', coat)
);
const coatOptions = () => [
  ['', 'No coat'],
  ...Object.entries(studioState.D.coats || {}).map(([k, c]) => [k, c.name || k]),
];
const battlePreview = {
  stage: 'backdrop',
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
  if (!battlePreview.me || !studioState.rigs[battlePreview.me])
    battlePreview.me = (D.rules.start.starters[0] || D.lines[0].id) + '0';
  if (!battlePreview.foe || !studioState.rigs[battlePreview.foe]) battlePreview.foe = ids[3] || ids[0];
  if (!battlePreview.move || !D.moves[battlePreview.move]) battlePreview.move = Object.keys(D.moves)[1];
}
const battlePreviewEvent = () => ({
  s: [
    { sp: battlePreview.me, coat: battlePreview.meCoat || null, st: null },
    { sp: battlePreview.foe, coat: battlePreview.foeCoat || null, st: null },
  ],
});
SECTIONS.preview = () => {
  const D = studioState.D;
  battlePreviewDefaults();
  const A = D.battleStages[battlePreview.area],
    p = `battleStages.${battlePreview.area}`;
  afterRender(startBattlePreview);
  const opt = (arr, v) =>
    arr
      .map(([k, n]) => `<option value="${escapeHtml(k)}" ${k === v ? 'selected' : ''}>${escapeHtml(n)}</option>`)
      .join('');
  return `<div class="ed-col solo bp"><div class="ed-head"><div><h2>Battle preview</h2><p class="sub">The game’s real battle stage, using your unsaved changes. Art you replaced under Art files appears here after you save.</p></div></div>
 <div class="bp-wrap"><div class="bp-stage" id="battle" data-layout="landscape"><div class="bstage" id="stage"><div class="cam" id="camWorld"><canvas id="cvWorld"></canvas></div><div class="cam" id="camFg"><canvas id="cvFg"></canvas></div><div class="bloom" id="bloom"></div><div class="vign"></div><div class="flash" id="flash"></div><div class="pops" id="pops"></div></div><div class="bp-loading" id="bpLoad">Loading the stage…</div></div>
 <aside class="bp-ctl">
  ${card(
    'Who’s fighting',
    `<label class="fld"><span>Your Billie (back view)</span><select data-bp="me">${opt(speciesOptions(), battlePreview.me)}</select></label><label class="fld"><span>Its coat</span><select data-bp="meCoat">${opt(coatOptions(), battlePreview.meCoat)}</select></label>
   <label class="fld"><span>Opponent (front view)</span><select data-bp="foe">${opt(speciesOptions(), battlePreview.foe)}</select></label><label class="fld"><span>Its coat</span><select data-bp="foeCoat">${opt(coatOptions(), battlePreview.foeCoat)}</select></label>
   <div class="seg-row"><button class="btn sm" data-act="bp" data-x="wild">Wild appears</button><button class="btn sm" data-act="bp" data-x="trainer">Trainer intro</button><select data-bp="who" class="sm">${opt(peopleOptions(), battlePreview.who)}</select></div>
   <div class="seg-row"><button class="btn sm" data-act="bp" data-x="enter0">Send yours out</button><button class="btn sm" data-act="bp" data-x="enter1">Send theirs out</button><button class="btn sm" data-act="bp" data-x="recall">Recall</button></div>`
  )}
  ${card(
    'Moves',
    `<label class="fld"><span>Move</span><select data-bp="move">${opt(moveOptions(), battlePreview.move)}</select></label><label class="fld"><span>Outcome</span><select data-bp="res">${opt(
      [
        ['hit', 'Normal hit'],
        ['se', 'Super effective'],
        ['nve', 'Not very effective'],
        ['crit', 'Critical hit'],
        ['miss', 'Miss'],
        ['blocked', 'Blocked by Guard'],
      ],
      battlePreview.res
    )}</select></label>
   <div class="seg-row"><button class="btn sm primary" data-act="bp" data-x="move0">You use it</button><button class="btn sm primary" data-act="bp" data-x="move1">They use it</button></div>`
  )}
  ${card(
    'Effects',
    `<div class="seg-row">${[
      ['heal', 'Heal'],
      ['statup', 'Stat up'],
      ['statdn', 'Stat down'],
      ['aud', 'Paralyzed'],
      ['sub', 'Asleep'],
      ['scn', 'Burned'],
      ['hype', 'Confusion'],
      ['hurt', 'Status damage'],
      ['lvl', 'Level up'],
      ['shock', 'Sandstorm'],
      ['faint1', 'They faint'],
      ['faint0', 'Yours faints'],
    ]
      .map(([k, n]) => `<button class="btn sm" data-act="bp" data-x="${k}">${n}</button>`)
      .join('')}</div>
   <div class="seg-row"><button class="btn sm" data-act="bp" data-x="catch">Throw: taxed</button><button class="btn sm" data-act="bp" data-x="escape">Throw: breaks free</button></div>
   <div class="seg-row"><span class="help">Camera</span>${['wide', 'foe', 'me'].map(f => `<button class="seg sm" data-act="bp" data-x="cam-${f}">${f}</button>`).join('')}<span class="help">Speed</span>${[0.5, 1, 2].map(v => `<button class="seg sm ${battleStage.speed === v ? 'on' : ''}" data-act="bp" data-x="speed-${v}">${v}×</button>`).join('')}</div>`
  )}
  ${card(
    'Stage',
    `<label class="fld"><span>Where the battle happens</span><select data-bp="stage"><option value="backdrop" ${battlePreview.stage === 'backdrop' ? 'selected' : ''}>A painted backdrop (classic)</option>${Object.entries(
      D.maps || {}
    )
      .map(
        ([k, s]) =>
          `<option value="${escapeHtml(k)}" ${battlePreview.stage === k ? 'selected' : ''}>Walk scene: ${escapeHtml(s.name || k)}</option>`
      )
      .join('')}</select></label><p class="help">In the game, battles happen in the walk scene where you stand.</p>`
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
  const load = $('#bpLoad');
  if (load) load.hidden = false;
  try {
    await Promise.all([
      battleStagePrepare(battlePreview.area),
      artLoad(COIN_ART),
      atlasGet(atlasPath(battlePreview.me, 'back')),
      atlasGet(atlasPath(battlePreview.foe, 'front')),
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
  if (
    battlePreview.stage !== 'backdrop' &&
    studioState.D.maps &&
    studioState.D.maps[battlePreview.stage] &&
    typeof battle3dAttach === 'function'
  ) {
    await mountBattlePreviewMap();
  }
  if (load) load.hidden = true;
  if (!battlePreview.ro)
    battlePreview.ro = new ResizeObserver(() => {
      if (battleStage.on && studioState.sec === 'preview' && $('#battle')) battleStageResize();
    });
  battlePreview.ro.disconnect();
  battlePreview.ro.observe($('#battle'));
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
});
function playBattlePreviewMove(si) {
  const D = studioState.D,
    M = D.moves[battlePreview.move],
    fx = M.fx || {},
    onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe,
    an = { k: 'move', si, mid: battlePreview.move };
  if (fx.protect) an.protect = true;
  else if (!onFoe) an.self = true;
  else if (battlePreview.res === 'miss') an.miss = true;
  else if (battlePreview.res === 'blocked') an.blocked = true;
  else if (M.c !== 'X') {
    an.dmg =
      battlePreview.res === 'crit' ? 48 : battlePreview.res === 'se' ? 56 : battlePreview.res === 'nve' ? 11 : 24;
    an.te = battlePreview.res === 'se' ? 2 : battlePreview.res === 'nve' ? 0.5 : 1;
    an.crit = battlePreview.res === 'crit';
  }
  battleStagePlay(an, battlePreviewEvent());
  if (onFoe && !an.miss && !an.blocked && fx.status)
    setTimeout(
      () => battleStagePlay({ k: 'status', si: 1 - si, st: fx.status }, battlePreviewEvent()),
      1100 / battleStage.speed
    );
}
ACTIONS.bp = d => {
  if (!battleStage.L) return;
  const x = d.x,
    ev = battlePreviewEvent(),
    later = (ms, f) => setTimeout(f, ms / battleStage.speed);
  const reset = () => {
    Object.assign(battleStage.s[0], {
      sp: battlePreview.me,
      coat: battlePreview.meCoat || null,
      show: true,
      sc: 1,
      a: 1,
      white: 0,
      dark: 0,
      oy: 0,
      ox: 0,
      act: null,
    });
    Object.assign(battleStage.s[1], {
      sp: battlePreview.foe,
      coat: battlePreview.foeCoat || null,
      show: true,
      sc: 1,
      a: 1,
      white: 0,
      dark: 0,
      oy: 0,
      ox: 0,
      act: null,
    });
  };
  if (x.startsWith('cam-')) {
    battleStageFocus(x.slice(4));
    if (x === 'cam-wide') camHome(400);
    else camAt(x === 'cam-foe' ? 1 : 0, 0.45, 0.15, 0, 400);
    return;
  }
  if (x.startsWith('speed-')) {
    battleStage.speed = +x.slice(6);
    $$('[data-x^="speed-"]').forEach(b => b.classList.toggle('on', b.dataset.x === x));
    return;
  }
  switch (x) {
    case 'wild':
      reset();
      battleStage.s[0].show = false;
      battleStagePlay({ k: 'wild' }, ev);
      later(1350, () => battleStagePlay({ k: 'enter', si: 0 }, ev));
      break;
    case 'trainer':
      reset();
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
      reset();
      playBattlePreviewMove(0);
      break;
    case 'move1':
      reset();
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
    case 'aud':
    case 'sub':
    case 'scn':
      battleStagePlay({ k: 'status', si: 1, st: x }, ev);
      break;
    case 'hype':
      battleStagePlay({ k: 'hype', si: 1 }, ev);
      break;
    case 'hurt':
      battleStagePlay({ k: 'hurt', si: 1, fx: 'scn', dmg: 7 }, ev);
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
      later(1600, reset);
      break;
    case 'faint0':
      battleStagePlay({ k: 'faint', si: 0 }, ev);
      later(1600, reset);
      break;
    case 'catch':
    case 'escape':
      reset();
      battleStageCatch('penny', { caught: x === 'catch', w: x === 'catch' ? 3 : 1 }, false, ok => {
        if (ok) later(600, reset);
      });
      break;
  }
};
/* shortcuts from other sections */
ACTIONS.bpFoe = d => {
  battlePreview.foe = d.sp;
  openSection('preview');
};
ACTIONS.bpMove = d => {
  battlePreview.move = d.id;
  openSection('preview');
  setTimeout(() => ACTIONS.bp({ x: 'move0' }), 900);
};
ACTIONS.bpArea = d => {
  battlePreview.area = d.k;
  openSection('preview');
};
