'use strict';
/* ================= UNIT CARDS (phase 06, session 06-2) =================
   One card, one row and one Build tab for anything you field: Billies now, bots in phase 17. A screen turns what it
   shows into a "unit" (billyUnit; a botUnit comes with phase 17) and draws it with these, so both look and behave the
   same (docs/phases/06-plan.md "The new opening" table, "Bots").
   The markup lives in the page, not in a component's shadow DOM, because the sprites are rig canvases that the page's
   draw loop finds there. Looks: css/units.css, on the tokens. Every name and text goes through escapeHtml. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { MOVES } from './game-data.js';
import { weightClass } from './logic/parts.js';
import {
  ROBOT_SLOTS,
  isRobot,
  robotAttackFactor,
  robotGemDef,
  robotPartDef,
  robotSpeedFactor,
  robotWeight,
  speciesOf,
} from './logic/fighters.js';
import {
  billyBuild,
  billyName,
  billyWeight,
  buildLean,
  formatNumber,
  isPrime,
  maxHp,
  partBroken,
} from './logic/rules.js';
import { escapeHtml, saveData } from './game-state.js';
import { uiIconHTML } from './art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { needsCare, plateVars, typeBadgeHTML } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  BILLY_SLOT_NAMES: [() => BILLY_SLOT_NAMES],
  BOT_SLOT_TITLES: [() => BOT_SLOT_TITLES],
  SIZE_KEYS: [() => SIZE_KEYS],
  SIZE_WORDS: [() => SIZE_WORDS],
  billyUnit: [() => billyUnit, v => ((billyUnit = v), provide({ billyUnit }))],
  unitBalanceHTML: [() => unitBalanceHTML, v => (unitBalanceHTML = v)],
  unitBotBuildHTML: [() => unitBotBuildHTML, v => ((unitBotBuildHTML = v), provide({ unitBotBuildHTML }))],
  unitBotSlotsHTML: [() => unitBotSlotsHTML, v => (unitBotSlotsHTML = v)],
  unitBuildHTML: [() => unitBuildHTML, v => ((unitBuildHTML = v), provide({ unitBuildHTML }))],
  unitCarryHTML: [() => unitCarryHTML, v => ((unitCarryHTML = v), provide({ unitCarryHTML }))],
  unitHeroHTML: [() => unitHeroHTML, v => ((unitHeroHTML = v), provide({ unitHeroHTML }))],
  unitHpHTML: [() => unitHpHTML, v => (unitHpHTML = v)],
  unitOpenRowHTML: [() => unitOpenRowHTML, v => ((unitOpenRowHTML = v), provide({ unitOpenRowHTML }))],
  unitRowHTML: [() => unitRowHTML, v => ((unitRowHTML = v), provide({ unitRowHTML }))],
  unitTagsHTML: [() => unitTagsHTML, v => (unitTagsHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ billyUnit, unitBotBuildHTML, unitBuildHTML, unitCarryHTML, unitHeroHTML, unitOpenRowHTML, unitRowHTML });
/* to-module: end */
/** @typedef {{
 *   kind: 'billy' | 'bot', id: string, name: string, sub: string, lvl: number, types: string[],
 *   hp: number, max: number, art: (px: number) => string, plate: string, down: boolean,
 *   lead: boolean, buddy: boolean, prime: boolean, care: boolean,
 *   build: Record<string, string>, kg: number, wclass: string, slotNames: Record<string, string>
 * }} Unit */

const SIZE_KEYS = ['S', 'M', 'L'];
const SIZE_WORDS = { S: 'Small', M: 'Normal', L: 'Large' };
const BILLY_SLOT_NAMES = { head: 'Head', body: 'Body', front: 'Front', back: 'Back', sig: 'Signature' };

/** a Billie as a unit @returns {Unit} */
function billyUnit(m) {
  /* phase 17 merged: robots are fighters too; speciesOf gives a robot its own made-up species (name, types) */
  const s = speciesOf(m),
    bot = isRobot(m),
    b = bot ? {} : billyBuild(m),
    kg = bot ? robotWeight(m.fit) : billyWeight(m);
  return {
    kind: bot ? 'bot' : 'billy',
    id: m.uid,
    name: billyName(m),
    sub: m.nick ? s.name : '',
    lvl: m.lvl,
    types: s.types,
    hp: m.hp,
    max: maxHp(m),
    art: px => rigCanvasHTML(m.sp, px, { gold: m.gold, build: m.build }),
    plate: plateVars(m),
    down: m.hp <= 0,
    lead: saveData.team[0] === m,
    buddy: saveData.buddy === m.uid,
    prime: !bot && isPrime(b),
    care: needsCare(m),
    build: b,
    kg,
    wclass: weightClass(kg),
    slotNames: BILLY_SLOT_NAMES,
  };
}

function unitHpHTML(u) {
  const p = u.max ? Math.max(0, u.hp / u.max) : 0;
  return `<span class="u-hp${p < 0.25 ? ' low' : p < 0.5 ? ' mid' : ''}" role="meter" aria-label="HP" aria-valuemin="0" aria-valuemax="${u.max}" aria-valuenow="${u.hp}"><i style="width:${p * 100}%"></i></span><span class="u-hpn tnum">${u.hp}/${u.max}</span>`;
}
function unitTagsHTML(u) {
  return `${u.lead ? '<span class="u-tag lead">Lead</span>' : ''}${u.buddy ? `<span class="u-tag bud">${uiIconHTML('heart', 11)} Buddy</span>` : ''}${u.prime ? '<span class="u-tag prime">Prime</span>' : ''}`;
}

/** the lead's big card at the top of a team */
function unitHeroHTML(u) {
  return `<pb-panel class="u-hero m-enter" depth="raised"><button class="u-stage m-press" data-a="mon" data-u="${escapeHtml(u.id)}" style="${u.plate}" aria-label="${escapeHtml(u.name)}, details"><span class="u-tags">${unitTagsHTML(u)}</span><span class="u-art m-idle" style="--phase:0">${u.art(132)}</span></button>
  <div class="u-head"><h2>${escapeHtml(u.name)}</h2><span class="u-lv tnum">Lv ${u.lvl}</span></div>${u.sub ? `<div class="u-sub">${escapeHtml(u.sub)}</div>` : ''}
  <div class="u-types">${u.types.map(typeBadgeHTML).join('')}</div>
  <div class="u-hprow">${unitHpHTML(u)}</div>
  <div class="u-acts">${u.care ? `<button class="pb small green" data-a="mheal" data-u="${escapeHtml(u.id)}">${uiIconHTML('heart', 14)} Heal</button>` : ''}<button class="pb small quiet" data-a="mon" data-u="${escapeHtml(u.id)}">Details</button></div></pb-panel>`;
}

/** one row in a team or a list: tap for details */
function unitRowHTML(u, i, act = 'mon', label = 'details') {
  return `<button class="u-row m-press m-enter${u.down ? ' down' : ''}" style="--i:${i}" data-a="${act}" data-u="${escapeHtml(u.id)}" aria-label="${escapeHtml(u.name)}, level ${u.lvl}, ${label}"><span class="u-spr" style="${u.plate}"><span class="m-idle" style="--phase:${((i * 0.37) % 1).toFixed(2)}">${u.art(64)}</span></span>
  <span class="u-mid"><span class="u-head"><b>${escapeHtml(u.name)}</b><span class="u-lv tnum">Lv ${u.lvl}</span></span><span class="u-types">${u.types.map(typeBadgeHTML).join('')}${u.buddy ? `<i class="u-heart" title="Buddy">${uiIconHTML('heart', 12)}</i>` : ''}${u.prime ? '<span class="u-tag prime">Prime</span>' : ''}</span></span>
  <span class="u-right">${unitHpHTML(u)}</span></button>`;
}

/** the open spots after a team's rows */
function unitOpenRowHTML(n, note, btn) {
  return `<div class="u-row u-open"><span class="u-plus" aria-hidden="true">+</span><span class="u-mid"><b>${n === 1 ? '1 open spot' : `${n} open spots`}</b><span class="u-note">${escapeHtml(note)}</span></span>${btn || ''}</div>`;
}

/** which way a build leans: Speed on the left, Attack on the right */
function unitBalanceHTML(L) {
  const pct = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.round(Math.abs(v) * 100)}%`;
  return `<div class="u-bal" role="img" aria-label="Speed ${pct(L.speed)}, attack ${pct(L.attack)}"><span class="u-bal-k">Speed</span><span class="u-bal-track"><i style="left:${(50 + L.lean * 50).toFixed(1)}%"></i></span><span class="u-bal-k">Attack</span>
  <span class="u-bal-n tnum ${L.speed > 0 ? 'up' : L.speed < 0 ? 'dn' : ''}">${pct(L.speed)}</span><span></span><span class="u-bal-n tnum r ${L.attack > 0 ? 'up' : L.attack < 0 ? 'dn' : ''}">${pct(L.attack)}</span></div>`;
}

/** a unit's Build tab: each slot with its size marked on an S M L dial, the weight and its balance, Prime */
function unitBuildHTML(u, slots) {
  const L = buildLean(u.build);
  return `<div class="u-build">
  <div class="u-build-h"><b>Build</b><span class="tnum">${formatNumber(u.kg)} kg · ${escapeHtml(u.wclass)}</span></div>
  <ul class="u-slots">${slots
    .map(k => {
      const sz = u.build[k] || 'M';
      return `<li><span class="u-slot-n">${escapeHtml(u.slotNames[k] || k)}</span><span class="u-dial" role="img" aria-label="${escapeHtml(SIZE_WORDS[sz] || sz)}">${SIZE_KEYS.map(z => `<span class="${z === sz ? 'on' : ''}${z === sz && z !== 'M' ? ' off-size' : ''}">${z}</span>`).join('')}</span></li>`;
    })
    .join('')}</ul>
  ${unitBalanceHTML(L)}
  <p class="u-prime ${L.prime ? 'yes' : ''}">${L.prime ? `<span class="u-tag prime">Prime</span> Every part at its own normal size: a little stronger at everything.` : `Not Prime: ${L.off === 1 ? '1 part' : `${L.off} parts`} off normal size. Bigger parts hit harder but slow it down.`}</p></div>`;
}

/* ---------- robots (phase 17 merged, 06-3): the same build view, in slots ---------- */
/** weight against what the legs carry: Speed and Attack, like a Billie's balance */
function unitCarryHTML(fit) {
  const w = robotWeight(fit),
    carry = (robotPartDef(fit.legs.id) || {}).carry || 100,
    sf = robotSpeedFactor(fit),
    af = robotAttackFactor(fit),
    pct = f => `${f > 1 ? '+' : f < 1 ? '−' : '±'}${Math.round(Math.abs(f - 1) * 100)}%`,
    at = Math.max(0, Math.min(1, w / carry / 1.5));
  return `<div class="u-carry" role="img" aria-label="${w} kilograms, the legs carry ${carry}: speed ${pct(sf)}, attack ${pct(af)}"><div class="u-carry-h"><b>Weight</b><span class="tnum">${formatNumber(w)} kg · legs carry ${formatNumber(carry)} kg</span></div><span class="u-carry-track"><i class="u-carry-cap" style="left:${((1 / 1.5) * 100).toFixed(1)}%"></i><i class="u-carry-at${w > carry ? ' over' : ''}" style="left:${(at * 100).toFixed(1)}%"></i></span><div class="u-carry-n"><span class="tnum ${sf > 1 ? 'up' : sf < 1 ? 'dn' : ''}">Speed ${pct(sf)}</span><span class="tnum ${af > 1 ? 'up' : af < 1 ? 'dn' : ''}">Attack ${pct(af)}</span></div></div>`;
}
const BOT_SLOT_TITLES = { torso: 'Torso', armL: 'Left arm', armR: 'Right arm', legs: 'Legs', gem: 'Gem' };
/** one row per slot: part, type, the move it gives, broken or damaged */
function unitBotSlotsHTML(m) {
  const fit = m.fit;
  return `<ul class="u-slots u-bot-slots">${[...ROBOT_SLOTS, 'gem']
    .map(k => {
      const P = k === 'gem' ? robotGemDef(m.gem) : robotPartDef(fit[k].id),
        mv = k === 'torso' ? null : MOVES[P.move],
        brk = k !== 'torso' && k !== 'gem' && partBroken(m, k),
        dmg = !brk && k !== 'torso' && k !== 'gem' && ((m.partDmg && m.partDmg[k]) || 0) > 0;
      return `<li><span class="u-slot-n">${BOT_SLOT_TITLES[k]}</span><span class="u-part"><b>${escapeHtml(P.name)}</b><span class="u-part-m">${typeBadgeHTML(P.type)}${mv ? `<span>${escapeHtml(mv.n)}</span>` : ''}${brk ? '<span class="u-brk">Broken</span>' : dmg ? '<span class="u-brk dmg">Damaged</span>' : ''}</span></span></li>`;
    })
    .join('')}</ul>`;
}
/** a robot's Build tab */
function unitBotBuildHTML(m) {
  return `<div class="u-build"><div class="u-build-h"><b>Build</b><span class="tnum">Lv ${m.lvl}</span></div>${unitBotSlotsHTML(m)}${unitCarryHTML(m.fit)}<p class="u-prime">Refit it in the Workshop on your Team screen: every part gives its move and its type.</p></div>`;
}
