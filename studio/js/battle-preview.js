'use strict';
/* ================= POCKET BILLIES STUDIO · battle preview =================
   Runs the game's own battle stage (game/js/battle-stage.js) inside the Studio, fed by the Studio's unsaved data and art,
   so moves, backdrops and new billionaires can be checked without starting the game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, scArt, scD } from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { COIN_ART, artLoad, hexA } from '../../game/js/art.js';
import { setRigParts } from '../../game/js/skeleton-rig.js';
import {
  AREAS,
  BATTLE_STAGE_ART,
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
  sideTop,
} from '../../game/js/battle-stage.js';
import { mapHub, walkView } from '../../game/js/walk-view.js';
import { mountWalkView } from '../../game/js/walk-view-gl.js';
import { battleGLAttach, battleGLStop } from '../../game/js/battle-3d.js';
import { esc } from './game-stand-ins.js';
import {
  ACTS,
  SECTIONS,
  ST,
  after,
  card,
  fColor,
  fRange,
  fSel,
  go,
  moveOpts,
  peopleOpts,
  render,
  spOpts,
} from './studio-app.js';
import { atlasGet, atlasPath, rigFor } from './sprites.js';
import { AMBS } from './world-rules-art.js';
/* eslint-disable no-func-assign */
expose({
  BP: [() => BP],
  battleFreeArea: [() => battleFreeArea, v => ((battleFreeArea = v), provide({ battleFreeArea }))],
  battleLayoutChanged: [() => battleLayoutChanged, v => ((battleLayoutChanged = v), provide({ battleLayoutChanged }))],
  bpApplyBackdrop: [() => bpApplyBackdrop, v => (bpApplyBackdrop = v)],
  bpDefaults: [() => bpDefaults, v => (bpDefaults = v)],
  bpEv: [() => bpEv],
  bpMove: [() => bpMove, v => (bpMove = v)],
  bpScene: [() => bpScene, v => (bpScene = v)],
  bpStart: [() => bpStart, v => (bpStart = v)],
  hudHit: [() => hudHit, v => ((hudHit = v), provide({ hudHit }))],
  hudPop: [() => hudPop, v => ((hudPop = v), provide({ hudPop }))],
});
/* eslint-enable no-func-assign */
provide({ battleFreeArea, battleLayoutChanged, hudHit, hudPop });
/* to-module: end */
setRigParts((sp, gold, k) => rigFor(sp, k === 1 ? 'front' : 'back', !!gold));
const BP = {
  stage: 'backdrop',
  area: null,
  me: null,
  foe: null,
  meGold: false,
  foeGold: false,
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
  const q = battleStageToCss(sideTop(si));
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
function bpDefaults() {
  const D = ST.D,
    ids = D.lines.flatMap(L => L.names.map((n, i) => L.id + i)).filter(id => ST.rigs[id]);
  if (!BP.area || !D.backdrops[BP.area]) BP.area = D.route[0].area || Object.keys(D.backdrops)[0];
  if (!BP.me || !ST.rigs[BP.me]) BP.me = (D.rules.start.starters[0] || D.lines[0].id) + '0';
  if (!BP.foe || !ST.rigs[BP.foe]) BP.foe = ids[3] || ids[0];
  if (!BP.move || !D.moves[BP.move]) BP.move = Object.keys(D.moves)[1];
}
const bpEv = () => ({
  s: [
    { sp: BP.me, gold: BP.meGold, st: null },
    { sp: BP.foe, gold: BP.foeGold, st: null },
  ],
});
SECTIONS.preview = () => {
  const D = ST.D;
  bpDefaults();
  const A = D.backdrops[BP.area],
    p = `backdrops.${BP.area}`;
  after(bpStart);
  const opt = (arr, v) =>
    arr.map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
  return `<div class="ed-col solo bp"><div class="ed-head"><div><h2>Battle preview</h2><p class="sub">The game’s real battle stage, using your unsaved changes. Art you replaced under Art files appears here after you save.</p></div></div>
 <div class="bp-wrap"><div class="bp-stage" id="battle" data-layout="landscape"><div class="bstage" id="stage"><div class="cam" id="camWorld"><canvas id="cvWorld"></canvas></div><div class="cam" id="camFg"><canvas id="cvFg"></canvas></div><div class="bloom" id="bloom"></div><div class="vign"></div><div class="flash" id="flash"></div><div class="pops" id="pops"></div></div><div class="bp-loading" id="bpLoad">Loading the stage…</div></div>
 <aside class="bp-ctl">
  ${card(
    'Who’s fighting',
    `<label class="fld"><span>Your Billie (back view)</span><select data-bp="me">${opt(spOpts(), BP.me)}</select></label><label class="fld chk"><input type="checkbox" data-bp="meGold" ${BP.meGold ? 'checked' : ''}><span>Golden</span></label>
   <label class="fld"><span>Opponent (front view)</span><select data-bp="foe">${opt(spOpts(), BP.foe)}</select></label><label class="fld chk"><input type="checkbox" data-bp="foeGold" ${BP.foeGold ? 'checked' : ''}><span>Golden</span></label>
   <div class="seg-row"><button class="btn sm" data-act="bp" data-x="wild">Wild appears</button><button class="btn sm" data-act="bp" data-x="trainer">Trainer intro</button><select data-bp="who" class="sm">${opt(peopleOpts(), BP.who)}</select></div>
   <div class="seg-row"><button class="btn sm" data-act="bp" data-x="enter0">Send yours out</button><button class="btn sm" data-act="bp" data-x="enter1">Send theirs out</button><button class="btn sm" data-act="bp" data-x="recall">Recall</button></div>`
  )}
  ${card(
    'Moves',
    `<label class="fld"><span>Move</span><select data-bp="move">${opt(moveOpts(), BP.move)}</select></label><label class="fld"><span>Outcome</span><select data-bp="res">${opt(
      [
        ['hit', 'Normal hit'],
        ['se', 'Super effective'],
        ['nve', 'Not very effective'],
        ['crit', 'Critical hit'],
        ['miss', 'Miss'],
        ['blocked', 'Blocked by Guard'],
      ],
      BP.res
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
    `<label class="fld"><span>Where the battle happens</span><select data-bp="stage"><option value="backdrop" ${BP.stage === 'backdrop' ? 'selected' : ''}>A painted backdrop (classic)</option>${Object.entries(
      D.scenes || {}
    )
      .map(
        ([k, s]) =>
          `<option value="${esc(k)}" ${BP.stage === k ? 'selected' : ''}>Walk scene: ${esc(s.name || k)}</option>`
      )
      .join(
        ''
      )}</select></label><p class="help">In the game, battles happen in the walk scene where you stand; the painted backdrops are used when players choose the classic stage.</p>`
  )}
  ${card(
    'Backdrop',
    `<label class="fld"><span>Battle backdrop</span><select data-bp="area">${opt(
      Object.entries(D.backdrops).map(([k, v]) => [k, v.name || k]),
      BP.area
    )}</select></label>
   <div class="grid colors">${fColor('Sky top', `${p}.sky.0`)}${fColor('Sky middle', `${p}.sky.1`)}${fColor('Sky horizon', `${p}.sky.2`)}${fColor('Haze', `${p}.fog`)}</div>${fRange('Haze distance', `${p}.fogD`, { min: 10, max: 300, step: 5 })}${fSel('In the air', `${p}.amb`, AMBS)}
   <p class="help">Changes apply live. Ground, walls and far land are picked under World & encounters → Battle backdrops.</p>`
  )}
 </aside></div></div>`;
};
async function bpStart() {
  const D = ST.D;
  if (!$('#cvWorld')) return;
  const load = $('#bpLoad');
  if (load) load.hidden = false;
  try {
    const art = D.backdrops[BP.area];
    if (BP._art !== BP.area + (art.art || '') + (art.wall || '') + (art.far || '') + (art.indoor || '')) {
      delete BATTLE_STAGE_ART[BP.area];
      BP._art = BP.area + (art.art || '') + (art.wall || '') + (art.far || '') + (art.indoor || '');
    }
    await Promise.all([
      battleStagePrepare(BP.area),
      artLoad(COIN_ART),
      atlasGet(atlasPath(BP.me, 'back', BP.meGold)),
      atlasGet(atlasPath(BP.foe, 'front', BP.foeGold)),
    ]);
  } catch (e) {
    if (load) load.textContent = 'Couldn’t load this stage: ' + e.message;
    return;
  }
  if (!$('#cvWorld')) return;
  battleStage.lockQ = true;
  battleStage.q.lvl = 0;
  if (battleStage.gl && typeof battleGLStop === 'function') {
    battleGLStop();
    battleStage.gl = false;
  }
  battleStageStart(BP.area);
  if (BP.stage !== 'backdrop' && ST.D.scenes && ST.D.scenes[BP.stage] && typeof battleGLAttach === 'function') {
    await bpScene();
  }
  if (load) load.hidden = true;
  if (!BP.ro)
    BP.ro = new ResizeObserver(() => {
      if (battleStage.on && ST.sec === 'preview' && $('#battle')) battleStageResize();
    });
  BP.ro.disconnect();
  BP.ro.observe($('#battle'));
  Object.assign(battleStage.s[0], { sp: BP.me, gold: BP.meGold, show: true, sc: 1, a: 1 });
  Object.assign(battleStage.s[1], { sp: BP.foe, gold: BP.foeGold, show: true, sc: 1, a: 1 });
  battleStage.oil = BP.shock;
}
/* the engine stage: the chosen walk scene, mounted on its own canvas inside the battle stage */
async function bpScene() {
  const id = BP.stage,
    sc = ST.D.scenes[id],
    C = scD();
  await Promise.all(scArt(C).map(p => atlasGet('art/' + p).catch(() => null)));
  const host = $('#camWorld');
  if (!host) return;
  let cv = document.createElement('canvas');
  cv.id = 'bpDio';
  host.insertBefore(cv, host.firstChild);
  await mountWalkView(cv, id, {
    state: () => ({ mode: 'roam', roam: true, pos: mapHub(sc), who: null, enc: [], npcs: [], exits: [] }),
    keys: () => false,
    onPick: () => {},
    cap: () => (ST.sec === 'preview' ? 60 : 0),
  });
  if (!walkView.cv || !$('#camWorld')) return;
  const hb = mapHub(sc);
  walkView.pl.x = hb[0];
  walkView.pl.z = hb[1];
  battleStage.gl = battleGLAttach({ detach: true });
  document.body.classList.toggle('battle-3d', !!battleStage.gl);
  battleStageResize();
  drawForegrounds();
}
function bpApplyBackdrop() {
  if (!battleStage.L || battleStage.area !== BP.area) return;
  const A = ST.D.backdrops[BP.area];
  battleStage.skyC = A.sky.map(hexA);
  battleStage.fogC = hexA(A.fog);
  battleStage.floorKey = '';
}
ST.hooks.preview = path => {
  if (path.startsWith('backdrops.')) bpApplyBackdrop();
};
document.addEventListener('change', ev => {
  const el = ev.target,
    k = el.dataset && el.dataset.bp;
  if (!k) return;
  BP[k] = el.type === 'checkbox' ? el.checked : el.value;
  if (['area', 'stage'].includes(k)) {
    render();
    return;
  }
  if (['me', 'foe', 'meGold', 'foeGold'].includes(k)) bpStart();
});
function bpMove(si) {
  const D = ST.D,
    M = D.moves[BP.move],
    fx = M.fx || {},
    onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe,
    an = { k: 'move', si, mid: BP.move };
  if (fx.protect) an.protect = true;
  else if (!onFoe) an.self = true;
  else if (BP.res === 'miss') an.miss = true;
  else if (BP.res === 'blocked') an.blocked = true;
  else if (M.c !== 'X') {
    an.dmg = BP.res === 'crit' ? 48 : BP.res === 'se' ? 56 : BP.res === 'nve' ? 11 : 24;
    an.te = BP.res === 'se' ? 2 : BP.res === 'nve' ? 0.5 : 1;
    an.crit = BP.res === 'crit';
  }
  battleStagePlay(an, bpEv());
  if (onFoe && !an.miss && !an.blocked && fx.status)
    setTimeout(() => battleStagePlay({ k: 'status', si: 1 - si, st: fx.status }, bpEv()), 1100 / battleStage.speed);
}
ACTS.bp = d => {
  if (!battleStage.L) return;
  const x = d.x,
    ev = bpEv(),
    later = (ms, f) => setTimeout(f, ms / battleStage.speed);
  const reset = () => {
    Object.assign(battleStage.s[0], {
      sp: BP.me,
      gold: BP.meGold,
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
      sp: BP.foe,
      gold: BP.foeGold,
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
      battleStagePlay({ k: 'trainerIn', who: BP.who }, ev);
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
      bpMove(0);
      break;
    case 'move1':
      reset();
      bpMove(1);
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
      BP.shock = !battleStage.oil;
      if (BP.shock) battleStagePlay({ k: 'market' }, ev);
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
ACTS.bpFoe = d => {
  BP.foe = d.sp;
  go('preview');
};
ACTS.bpMove = d => {
  BP.move = d.id;
  go('preview');
  setTimeout(() => ACTS.bp({ x: 'move0' }), 900);
};
ACTS.bpArea = d => {
  BP.area = d.k;
  go('preview');
};
