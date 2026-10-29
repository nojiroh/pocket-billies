// @ts-check
'use strict';
/* ================= KAPPI'S TIPS ON SCREEN (intro track IN-2) =================
   Kappi is a voice during a run (docs/phases/intro-track.md section 1): a short bubble with Kappi's face that doesn't
   stop anything, closed by a tap or after a few seconds; in a battle the battle's tip card (#btip, opening-fall.js
   battleTip) in Kappi's colours. Kappi doesn't walk with you.
   This file watches the game about twice a second (and right after a throw), tells logic/kappi-tips.js what happened
   and shows what it decides: a world cue first (the Catch or Items button pulses, the choice sheet's picks pulse,
   the arrows of the roads on glow gold), Kappi's line only if the cue didn't help. Settings: Kappi's tips. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, storyRun } from './hooks.js';
import { ITEMS, KAPPI_TIPS, typeEffectiveness } from './game-data.js';
import { billyTypes, maxHp } from './logic/rules.js';
import {
  newTipRun,
  tipBattle,
  tipBattleEnd,
  tipBeaten,
  tipCatch,
  tipFaint,
  tipHold,
  tipMoved,
  tipNext,
  tipNoPyramids,
  tipPlace,
  tipSheet,
} from './logic/kappi-tips.js';
import { runMapNode } from './logic/run-map.js';
import { catchable, fighter, liveActors } from './logic/battle-engine.js';
import { parseLine, plainOf } from './logic/line-markup.js';
import { activeBattle, save, saveData, uiState } from './game-state.js';
import { portraitURL } from './person-art.js';
import { walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { cutscene } from './cutscene/director.js';
import { battleTip } from './opening-fall.js';
/* eslint-disable no-func-assign */
expose({
  KAPPI_CUE_MS: [() => KAPPI_CUE_MS],
  KAPPI_SHEETS: [() => KAPPI_SHEETS],
  KAPPI_SHEET_SETTLE: [() => KAPPI_SHEET_SETTLE],
  kappi: [() => kappi],
  // @ts-expect-error -- replaced on purpose
  kappiBattleTip: [() => kappiBattleTip, v => (kappiBattleTip = v)],
  // @ts-expect-error -- replaced on purpose
  kappiBeaten: [() => kappiBeaten, v => (kappiBeaten = v)],
  // @ts-expect-error -- replaced on purpose
  kappiBubble: [() => kappiBubble, v => (kappiBubble = v)],
  // @ts-expect-error -- replaced on purpose
  kappiBubbleHide: [() => kappiBubbleHide, v => (kappiBubbleHide = v)],
  // @ts-expect-error -- replaced on purpose
  kappiCatch: [() => kappiCatch, v => ((kappiCatch = v), provide({ kappiCatch }))],
  // @ts-expect-error -- replaced on purpose
  kappiCue: [() => kappiCue, v => (kappiCue = v)],
  // @ts-expect-error -- replaced on purpose
  kappiEl: [() => kappiEl, v => (kappiEl = v)],
  // @ts-expect-error -- replaced on purpose
  kappiFainted: [() => kappiFainted, v => (kappiFainted = v)],
  // @ts-expect-error -- replaced on purpose
  kappiHeals: [() => kappiHeals, v => (kappiHeals = v)],
  // @ts-expect-error -- replaced on purpose
  kappiLook: [() => kappiLook, v => (kappiLook = v)],
  // @ts-expect-error -- replaced on purpose
  kappiLow: [() => kappiLow, v => (kappiLow = v)],
  // @ts-expect-error -- replaced on purpose
  kappiOn: [() => kappiOn, v => (kappiOn = v)],
  // @ts-expect-error -- replaced on purpose
  kappiPyramids: [() => kappiPyramids, v => (kappiPyramids = v)],
  // @ts-expect-error -- replaced on purpose
  kappiShow: [() => kappiShow, v => (kappiShow = v)],
  // @ts-expect-error -- replaced on purpose
  kappiShowMs: [() => kappiShowMs, v => (kappiShowMs = v)],
  // @ts-expect-error -- replaced on purpose
  kappiShowing: [() => kappiShowing, v => (kappiShowing = v)],
  // @ts-expect-error -- replaced on purpose
  kappiState: [() => kappiState, v => (kappiState = v)],
  // @ts-expect-error -- replaced on purpose
  kappiTalking: [() => kappiTalking, v => (kappiTalking = v)],
  // @ts-expect-error -- replaced on purpose
  kappiWalking: [() => kappiWalking, v => (kappiWalking = v)],
  // @ts-expect-error -- replaced on purpose
  kappiWaysOn: [() => kappiWaysOn, v => (kappiWaysOn = v)],
  // @ts-expect-error -- replaced on purpose
  kappiWords: [() => kappiWords, v => (kappiWords = v)],
});
/* eslint-enable no-func-assign */
provide({ kappiCatch });
/* to-module: end */
/** the choice sheets whose stall Kappi notices (overlay.js modal cls) */
const KAPPI_SHEETS = ['reward-pick', 'relic-pick', 'event-sheet', 'shop-sheet'];
/** how long a cue pulses (ms), and how long a sheet must have been open before it counts (its opening animation) */
const KAPPI_CUE_MS = 6000,
  KAPPI_SHEET_SETTLE = 700;
/** what the watcher remembers between looks: the run and battle it saw last, the battle's faints so far, whether one
 * of yours was low with a heal in the bag (and how many heals then), the sheet's key and since when it's been open */
const kappi = {
  run: /** @type {any} */ (null),
  st: newTipRun(),
  battle: /** @type {any} */ (null),
  beatenAsked: false,
  faints: 0,
  low: false,
  lowHeals: 0,
  sheetKey: '',
  sheetAt: 0,
  timer: 0,
};

/** Kappi's tips are on (Settings) */
function kappiOn() {
  return ((saveData && saveData.preferences) || {}).kappiTips !== 'off';
}
/** the heals in the bag (items that restore HP) */
function kappiHeals() {
  let n = 0;
  for (const [k, v] of Object.entries(saveData.items || {})) if (v > 0 && ITEMS[k] && ITEMS[k].hp) n += v;
  return n;
}
/** the pyramids in the bag */
function kappiPyramids() {
  let n = 0;
  for (const v of Object.values(saveData.pyramids || {})) n += Math.max(0, v || 0);
  return n;
}
/** the foe out front has a type that beats your lead's (strong against one of its types) */
function kappiBeaten() {
  const lead = fighter(0),
    foe = fighter(1);
  if (!lead || !foe) return null;
  const mine = billyTypes(lead);
  return billyTypes(foe).some(x => typeEffectiveness(x, mine) > 1);
}
/** your side's fainted Billies in this battle */
function kappiFainted(B) {
  const team = (B && B.sides && B.sides[0] && B.sides[0].team) || [];
  return team.filter(m => m && m.hp <= 0).length;
}
/** one of yours out front is under the tip's share of its HP */
function kappiLow() {
  const T = Object.values(KAPPI_TIPS.tips).find(t => t.when === 'potionUnused'),
    share = (T && T.hp) || 0.34;
  return liveActors(0).some(k => {
    const m = fighter(k);
    return m && m.hp > 0 && m.hp < maxHp(m) * share;
  });
}
/** the ways on from this place, as walkView's exits (not back the way you came, not a locked gate) */
function kappiWaysOn() {
  const run = saveData.run,
    st = walkView.st;
  if (!run || !run.map || !st || !st.exits || !saveData.trip) return [];
  const here = run.map.nodes[runMapNode(saveData.trip.node)];
  if (!here) return [];
  return st.exits.filter(
    (/** @type {any} */ e) =>
      !e.locked && here.to.includes(runMapNode(e.to)) && /** @type {any} */ (walkView.sc).exits[e.i]
  );
}
/** you're walking about a run place, with nothing else on screen */
function kappiWalking() {
  return (
    uiState.tab === 'walk' &&
    !uiState.inside &&
    !uiState.bench &&
    !uiState.modal &&
    !activeBattle &&
    !!walkView.ready &&
    !!walkView.sc &&
    !!walkView.pl &&
    !(typeof cutscene !== 'undefined' && cutscene.on) &&
    !(typeof storyRun !== 'undefined' && storyRun.on)
  );
}
/** someone's talking: the talk box is open */
function kappiTalking() {
  const el = document.getElementById('talk');
  return !!el && !el.hidden;
}
/** a tip card or Kappi's bubble is on screen */
function kappiShowing() {
  return !!document.querySelector('#btip.on:not(.off), #ktip.on');
}

/** look at the game once: what happened since the last look, then what to show */
function kappiLook() {
  const run = saveData && saveData.run;
  if (!run || !saveData.started || !saveData.meta) {
    kappi.run = null;
    return;
  }
  const t = performance.now(),
    D = KAPPI_TIPS;
  if (kappi.run !== run) {
    kappi.run = run;
    kappi.st = newTipRun();
    kappi.battle = null;
  }
  const st = kappi.st;
  if (saveData.trip) tipPlace(st, String(saveData.trip.node), t);
  /* a battle starts or ends */
  const B = /** @type {any} */ (activeBattle);
  if (B !== kappi.battle) {
    if (kappi.battle) tipBattleEnd(st, D, { potion: kappi.low && kappiHeals() >= kappi.lowHeals }, t);
    kappi.battle = B;
    kappi.low = false;
    kappi.beatenAsked = false;
    kappi.faints = B ? kappiFainted(B) : 0;
    if (B) tipBattle(st, D, {}, t);
  }
  if (B && !B.over) {
    if (!kappi.beatenAsked) {
      const beaten = kappiBeaten();
      if (beaten !== null) {
        kappi.beatenAsked = true;
        if (beaten) tipBeaten(st, D, t);
      }
    }
    const f = kappiFainted(B);
    for (; kappi.faints < f; kappi.faints++) tipFaint(st, D, t);
    if (!kappi.low && kappiHeals() > 0 && kappiLow()) {
      kappi.low = true;
      kappi.lowHeals = kappiHeals();
    }
  }
  /* walking: nearer a road out, a wild one near with no pyramids */
  const walking = kappiWalking(),
    ways = walking ? kappiWaysOn() : [];
  tipHold(st, walking, t);
  if (walking && ways.length) {
    const pl = walkView.pl;
    tipMoved(
      st,
      D,
      Math.min(
        ...ways.map((/** @type {any} */ e) =>
          Math.hypot(
            pl.x - /** @type {any} */ (walkView.sc).exits[e.i][0],
            pl.z - /** @type {any} */ (walkView.sc).exits[e.i][1]
          )
        )
      ),
      t
    );
  }
  if (walking && kappiPyramids() === 0) {
    const T = Object.values(D.tips).find(x => x.when === 'noPyramids'),
      near = (T && T.near) || 10,
      pl = walkView.pl;
    if ((walkRenderer.encPos || []).some((/** @type {any} */ p) => Math.hypot(p[0] - pl.x, p[1] - pl.z) <= near))
      tipNoPyramids(st, D, t);
  }
  /* a choice sheet: its key changes with a pick or a purchase */
  const M = /** @type {any} */ (uiState.modal),
    sheet = !!(M && KAPPI_SHEETS.includes(M.cls)),
    key = sheet ? `${M.cls}|${saveData.se}|${(run.perks || []).length}|${kappiHeals()}|${kappiPyramids()}` : '';
  if (key !== kappi.sheetKey) {
    kappi.sheetKey = key;
    kappi.sheetAt = t;
  }
  tipSheet(st, key, t);
  /* what to show */
  const inBattle = !!B && !B.over,
    sheetSettled = sheet && t - kappi.sheetAt >= KAPPI_SHEET_SETTLE,
    busy = inBattle
      ? B.phase !== 'choose' || !!uiState.throwing || kappiShowing()
      : kappiTalking() || kappiShowing() || (!walking && !sheetSettled),
    foe = inBattle ? fighter(1) : null,
    show = tipNext(st, D, {
      t,
      on: kappiOn(),
      seen: saveData.meta.tipsSeen || {},
      busy,
      battle: inBattle,
      sheet: sheetSettled,
      cues: {
        catchButton:
          inBattle &&
          B.kind === 'wild' &&
          !!foe &&
          catchable(foe) &&
          kappiPyramids() > 0 &&
          foe.hp > 0 &&
          foe.hp <= maxHp(foe) / 2,
        itemsButton: inBattle && kappi.low && kappiHeals() > 0,
        sheetPulse: sheetSettled,
        roadMarker: walking && ways.length > 0,
      },
    });
  if (show) kappiShow(show, ways);
}
/** a cue or Kappi's line, as logic/kappi-tips.js tipNext decided @param {import('./logic/kappi-tips.js').TipShow} show
 * @param {any[]} ways */
function kappiShow(show, ways) {
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `Kappi's ${show.kind === 'say' ? 'tip' : 'cue'}: ${show.id}`);
  if (show.kind === 'cue') return kappiCue(/** @type {string} */ (show.cue), ways);
  const seen = saveData.meta.tipsSeen || (saveData.meta.tipsSeen = {});
  seen[show.id] = 1;
  save();
  const text = String(show.line || '').replace(/\s*#l:[0-9a-f]+$/, '');
  const B = /** @type {any} */ (activeBattle);
  if (B && !B.over) kappiBattleTip(text);
  else kappiBubble(text);
}
/** a world cue for a few seconds: a button that pulses, the sheet's picks, the roads on @param {string} cue
 * @param {any[]} ways */
function kappiCue(cue, ways) {
  if (cue === 'roadMarker') {
    walkView.exitPulse = { until: performance.now() + KAPPI_CUE_MS * 1.5, to: ways.map(e => e.to) };
    return;
  }
  const el =
    cue === 'sheetPulse'
      ? document.getElementById('ov')
      : /** @type {HTMLElement | null} */ (document.getElementById('acts'));
  if (!el) return;
  el.dataset.kcue = cue === 'catchButton' ? 'bcoins' : cue === 'itemsButton' ? 'bitems' : 'sheet';
  setTimeout(() => delete el.dataset.kcue, KAPPI_CUE_MS);
}
/** the line's words with its bold and italic (logic/line-markup.js parseLine), as text nodes: a line is never HTML
 * @param {HTMLElement} el @param {string} text */
function kappiWords(el, text) {
  const P = parseLine(text);
  el.textContent = '';
  if (!P.runs.length) return void (el.textContent = P.plain);
  let at = 0;
  for (const r of P.runs) {
    if (r.from > at) el.append(P.plain.slice(at, r.from));
    const tag = r.fx.b ? 'b' : r.fx.i ? 'i' : 'span',
      s = document.createElement(tag);
    s.textContent = P.plain.slice(r.from, r.to);
    el.append(s);
    at = r.to;
  }
  if (at < P.plain.length) el.append(P.plain.slice(at));
}
/** how long Kappi's bubble stays: showS, a little longer for a long line (ms) @param {string} plain */
function kappiShowMs(plain) {
  return Math.max(((KAPPI_TIPS.showS ?? 4) * 1000) | 0, plain.length * 50);
}
/** Kappi's bubble in the world: Kappi's face and skin (talkSkins.json kappi), at the top of the screen, never in the
 * way: a tap closes it, or it goes by itself @param {string} text */
function kappiBubble(text) {
  let el = /** @type {HTMLElement & { _t?: number }} */ (document.getElementById('ktip'));
  if (!el) {
    el = document.createElement('div');
    el.id = 'ktip';
    el.className = 'ktip';
    el.setAttribute('role', 'status');
    const box = kappiEl('div', 'talk-box px ktip-box', el),
      txt = kappiEl('div', 'talk-txt');
    box.dataset.skin = 'kappi';
    box.dataset.side = 'left';
    box.style.setProperty('--talk-clip', 'var(--clip-bubbleSoft)');
    box.style.setProperty('--talk-edge', 'var(--edge-bubbleSoft)');
    const face = /** @type {HTMLImageElement} */ (kappiEl('img', 'pxi tr-face', kappiEl('span', 'ktip-face', box)));
    face.alt = '';
    box.append(txt);
    kappiEl('p', 'talk-who', txt).textContent = 'Kappi';
    kappiEl('p', 'talk-line', txt);
    kappiEl('span', 'talk-deco', box).setAttribute('aria-hidden', 'true');
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      kappiBubbleHide();
    });
    document.body.appendChild(el);
  }
  const img = /** @type {HTMLImageElement} */ (el.querySelector('.ktip-face img'));
  /* each time: the face is drawn once Kappi's art is in (person-art.js caches it) */
  if (typeof portraitURL === 'function') {
    img.src = portraitURL('kappi');
    img.width = 44;
  }
  kappiWords(/** @type {HTMLElement} */ (el.querySelector('.talk-line')), text);
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(kappiBubbleHide, kappiShowMs(plainOf(text)));
}
/** a new element of a class, put in a parent when one is given @param {string} tag @param {string} cls
 * @param {HTMLElement} [into] */
function kappiEl(tag, cls, into) {
  const e = document.createElement(tag);
  e.className = cls;
  if (into) into.append(e);
  return e;
}
/** Kappi's bubble goes */
function kappiBubbleHide() {
  const el = /** @type {(HTMLElement & { _t?: number }) | null} */ (document.getElementById('ktip'));
  if (!el) return;
  clearTimeout(el._t);
  el.classList.remove('on');
}
/** Kappi's line in a battle: the battle's tip card (opening-fall.js battleTip) in Kappi's colours, for a few seconds
 * @param {string} text */
function kappiBattleTip(text) {
  battleTip('kappi', plainOf(text), null, false);
  const el = /** @type {(HTMLElement & { _t?: number }) | null} */ (document.getElementById('btip'));
  if (!el) return;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('off'), kappiShowMs(plainOf(text)));
}
/** a pyramid thrown (battle.js finishThrow): caught or not, then a look at once @param {boolean} caught */
function kappiCatch(caught) {
  if (!saveData.run || kappi.run !== saveData.run) kappiLook();
  if (kappi.run) tipCatch(kappi.st, KAPPI_TIPS, caught, performance.now());
}
/** the debug menu and the checks: this run's counters, and forgetting the tips seen @param {boolean} [forget] */
function kappiState(forget) {
  if (forget && saveData.meta) saveData.meta.tipsSeen = {};
  return { st: kappi.st, seen: (saveData.meta && saveData.meta.tipsSeen) || {}, on: kappiOn() };
}

/* about twice a second, while the page is open */
if (typeof window !== 'undefined' && !kappi.timer) kappi.timer = /** @type {any} */ (setInterval(kappiLook, 500));
