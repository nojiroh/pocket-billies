'use strict';
/* ================= BATTLE INPUT ================= */
/* UI-5: what a tap or a key does in battle (the battle's buttons in battleAction, called from ui.js's click switch at the same place, and keyboard play), moved from ui.js as it was */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { $, $$ } from './util.js';
import { ITEMS } from './game-data.js';
import { billyName, formatNumber } from './logic/rules.js';
import {
  battleSay,
  catchOfferAnswer,
  checkFaints,
  doSwitch,
  enemyOnly,
  fighter,
  runTurn,
} from './logic/battle-engine.js';
import { activeBattle, save, saveData, uiState } from './game-state.js';
import { battleStage, battleStageFocus, battleStageTargets, camHome } from './battle-stage.js';
import {
  chooseMessage,
  doThrow,
  endBattle,
  paintActions,
  pickMove,
  pickPart,
  pickTarget,
  planBack,
  planNext,
  playTurnEvents,
  showAim,
  tapMessage,
} from './battle.js';
import { tutorPicked } from './opening-fall.js';
/* eslint-disable no-func-assign */
expose({ battleAction: [() => battleAction, v => (battleAction = v)] });
/* eslint-enable no-func-assign */
/* to-module: end */
/* keyboard play in battle: F fight, 1–4 moves, X tax (or C), I items, T team, R run, Esc back, Space/Enter advance */
document.addEventListener('keydown', ev => {
  if (
    !activeBattle ||
    uiState.modal ||
    ev.ctrlKey ||
    ev.metaKey ||
    ev.altKey ||
    /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)
  )
    return;
  const k = ev.key.toLowerCase(),
    ph = activeBattle.phase,
    click = s => {
      const e = $(s);
      if (e && !e.disabled) {
        e.click();
        ev.preventDefault();
      }
    };
  if (ph === 'playing' && (k === ' ' || k === 'enter')) {
    tapMessage();
    ev.preventDefault();
    return;
  }
  if (ph === 'choose') {
    /* phase 06-3: 1-4 pick a move straight from the first menu */
    if (/^[1-9]$/.test(k)) {
      const b = $$('#acts [data-a=bmove]')[+k - 1];
      if (b) b.click();
    } else if (k === 'x' || k === 'c') click('[data-a=bcoins]');
    else if (k === 'i') click('[data-a=bitems]');
    else if (k === 't') click('[data-a=bteam]');
    else if (k === 'r') click('[data-a=brun]');
    else if (k === 'escape' || k === 'backspace') click('#acts [data-a=bback]');
    return;
  }
  if (ph === 'target' && /^[1-9]$/.test(k)) {
    const b = $$('#acts .pick')[+k - 1];
    if (b) {
      b.click();
      ev.preventDefault();
    }
    return;
  }
  if (ph === 'fight' && /^[1-9]$/.test(k)) {
    const b = $$('#acts .mv')[+k - 1];
    if (b) {
      b.click();
      ev.preventDefault();
    }
    return;
  }
  if (ph === 'aim') {
    if (k === ' ' || k === 'enter') click('[data-a=bthrow]');
    else if (k === 'escape') click('[data-a=baimback]');
    return;
  }
  if (ph === 'end' && (k === ' ' || k === 'enter')) click('[data-a=bend]');
  if ((k === 'escape' || k === 'backspace') && ['fight', 'target', 'coins', 'items', 'itemTarget', 'team'].includes(ph))
    click('#acts [data-a=bback]');
});
/* the battle's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function battleAction(a, d) {
  switch (a) {
    case 'adv':
      tapMessage();
      break;
    case 'bfight':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'fight';
        paintActions();
      }
      break;
    case 'bmove':
      /* phase 06-3: the moves are on the first menu too */
      if (activeBattle && (activeBattle.phase === 'fight' || activeBattle.phase === 'choose')) {
        activeBattle.phase = 'fight';
        if (typeof tutorPicked === 'function') tutorPicked();
        pickMove(d.m);
      }
      break;
    case 'btarget':
      if (activeBattle && activeBattle.phase === 'target' && d.t != null) pickTarget(+d.t);
      break;
    case 'bpart':
      if (activeBattle && activeBattle.phase === 'part' && d.p) pickPart(d.p);
      break;
    case 'bcoins':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'coins';
        paintActions();
      }
      break;
    case 'bitems':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'items';
        paintActions();
      }
      break;
    case 'bteam':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'team';
        paintActions();
      }
      break;
    case 'brun':
      if (activeBattle && activeBattle.phase === 'choose') runTurn([{ k: 'run' }]);
      break;
    case 'bback':
      if (activeBattle) {
        if (activeBattle.phase === 'target' && typeof battleStageTargets === 'function') battleStageTargets(null);
        if (activeBattle.phase === 'choose') {
          planBack();
          break;
        }
        /* phase 06-3: the first menu has the moves, so Back always goes there */
        activeBattle.phase = 'choose';
        chooseMessage();
        paintActions();
      }
      break;
    case 'bcoin':
      if (activeBattle && activeBattle.phase === 'coins' && saveData.coins[d.c] > 0) {
        activeBattle.coin = d.c;
        activeBattle.phase = 'aim';
        paintActions();
        showAim();
      }
      break;
    case 'baimback':
      if (activeBattle && !uiState.throwing) {
        battleStage.ring = null;
        camHome(300);
        battleStageFocus('wide');
        activeBattle.phase = 'choose';
        chooseMessage();
        paintActions();
      }
      break;
    case 'bthrow':
      doThrow(false);
      break;
    case 'bitem':
      if (activeBattle && activeBattle.phase === 'items') {
        if (ITEMS[d.it].hpAll) {
          planNext({ who: activeBattle.cur, k: 'item', item: d.it, uid: fighter(activeBattle.cur).uid });
          break;
        }
        activeBattle.item = d.it;
        activeBattle.phase = 'itemTarget';
        paintActions();
      }
      break;
    case 'bitemon':
      if (activeBattle && activeBattle.phase === 'itemTarget')
        planNext({ who: activeBattle.cur, k: 'item', item: activeBattle.item, uid: d.u });
      break;
    case 'bswitch':
      if (!activeBattle) break;
      if (activeBattle.phase === 'team') planNext({ who: activeBattle.cur, k: 'switch', i: +d.i });
      else if (activeBattle.phase === 'switch') {
        const k = activeBattle.needSwitch.shift();
        activeBattle.events = [];
        doSwitch(k ?? 0, +d.i);
        if (!activeBattle.needSwitch.length) checkFaints();
        playTurnEvents();
      }
      break;
    case 'boffer':
      if (activeBattle && activeBattle.phase === 'offer') {
        activeBattle.events = [];
        /* logic/battle-engine.js catchOfferAnswer: yes takes the money and ends it, no raises the Focus Bonus */
        if (d.y === '1') {
          const amt = catchOfferAnswer(true);
          battleSay(`You took $${formatNumber(amt)}. ${billyName(fighter(1))} scampered off.`);
          battleStage.s[1].show = false;
          save();
        } else {
          catchOfferAnswer(false);
          battleSay(`You refused. Focus Bonus ×${+activeBattle.integrity.toFixed(2)} on your next throw.`);
          enemyOnly();
        }
        playTurnEvents();
      }
      break;
    case 'bend':
      if (activeBattle && activeBattle.phase === 'end') endBattle();
      break;
  }
}
