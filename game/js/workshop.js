'use strict';
/* ================= WORKSHOP (phase 17 prototype) =================
   Your robots and spare parts, on the Team screen, and the refit sheet: the robot turning in its parts, its types,
   weight against what its legs carry, its stats, and a row per slot (torso, left arm, right arm, legs, gem). Tap a
   slot to see the spare parts that fit it, each with what it would change, and fit one; the part it replaces goes
   back to your parts. Upgrades are free in the prototype (crafting costs come with the workshop's place, phase 12).
   Where the workshop lives in the world is the owner's call: until then it is a panel on the Team screen. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  billyUnit,
  closeModal,
  modal,
  plateVars,
  provide,
  render,
  renderOverlay,
  toast,
  typeBadgeHTML,
  unitCarryHTML,
  unitRowHTML,
} from './hooks.js';
import { MOVES, ROBOTS, STAT_IDS } from './game-data.js';
import {
  ROBOT_SLOTS,
  ROBOT_SLOT_NAMES,
  fitFromIds,
  isRobot,
  partFits,
  robotBase,
  robotGemDef,
  robotPartDef,
  robotRules,
  robotWeight,
  speciesOf,
} from './logic/fighters.js';
import {
  addBilly,
  addPart,
  allBillies,
  billyName,
  buildRobot,
  findBilly,
  fitPart,
  makeRobot,
  maxHp,
  partBroken,
  robotStartLevel,
  stat,
  upgradePart,
} from './logic/rules.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { soundEffect } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  WS_SLOTS: [() => WS_SLOTS],
  giveRobotKit: [() => giveRobotKit, v => ((giveRobotKit = v), provide({ giveRobotKit }))],
  openWorkshop: [() => openWorkshop, v => (openWorkshop = v)],
  robotPartsPanelHTML: [() => robotPartsPanelHTML, v => (robotPartsPanelHTML = v)],
  workshopAction: [() => workshopAction, v => (workshopAction = v)],
  workshopHTML: [() => workshopHTML, v => (workshopHTML = v)],
  workshopRepaint: [() => workshopRepaint, v => (workshopRepaint = v)],
  workshopSectionHTML: [() => workshopSectionHTML, v => (workshopSectionHTML = v)],
  wsCanBuild: [() => wsCanBuild, v => (wsCanBuild = v)],
  wsDeltaHTML: [() => wsDeltaHTML, v => (wsDeltaHTML = v)],
  wsPartDef: [() => wsPartDef],
  wsShortStat: [() => wsShortStat],
  wsSpares: [() => wsSpares, v => (wsSpares = v)],
  wsStars: [() => wsStars],
  wsTitle: [() => wsTitle],
});
/* eslint-enable no-func-assign */
provide({ giveRobotKit });
/* to-module: end */
const WS_SLOTS = ['torso', 'armL', 'armR', 'legs', 'gem'];
const wsTitle = s => ROBOT_SLOT_NAMES[s][0].toUpperCase() + ROBOT_SLOT_NAMES[s].slice(1);
const wsShortStat = { hp: 'HP', lev: 'Atk', law: 'Def', lob: 'SpA', pr: 'SpD', hus: 'Spe' };
const wsPartDef = id => robotPartDef(id) || robotGemDef(id);
const wsStars = up => (up ? `<span class="ws-up" title="Upgrade ${up}">${'+'.repeat(up)}</span>` : '');
/** the spares that fit a slot ('gem' for gems) */
function wsSpares(slot) {
  return saveData.parts.filter(p => (slot === 'gem' ? !!robotGemDef(p.id) : partFits(p.id, slot)));
}
/** can you build a robot from spares: a gem, a torso, two arms and legs? */
function wsCanBuild() {
  return (
    wsSpares('gem').length > 0 &&
    wsSpares('torso').length > 0 &&
    wsSpares('armL').length > 1 &&
    wsSpares('legs').length > 0
  );
}
/** what a part would do to the robot's base stats, as chips (+5 Atk, −3 Spe) */
function wsDeltaHTML(m, slot, p) {
  const gem = slot === 'gem' ? p.id : m.gem,
    fit = slot === 'gem' ? m.fit : { ...m.fit, [slot]: p },
    a = robotBase(m.gem, m.fit),
    b = robotBase(gem, fit),
    out = STAT_IDS.map((k, i) => [k, b[i] - a[i]]).filter(([, d]) => d);
  return out.length
    ? out
        .map(
          ([k, d]) =>
            `<span class="ws-d ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d)} ${wsShortStat[k]}</span>`
        )
        .join('')
    : '<span class="ws-d">No change</span>';
}
/** the Team screen's panel: your robots, your spares, and building one */
export function workshopSectionHTML() {
  const bots = allBillies().filter(isRobot);
  if (!bots.length && !saveData.parts.length) return '';
  const spares = saveData.parts.length;
  return `<section class="tpanel tm-ws"><div class="sec-h"><h2>Workshop</h2><span class="count tnum">${bots.length} robot${bots.length === 1 ? '' : 's'}</span></div><p class="note">Robots battle beside your Billies. Their moves come from their parts: swap an arm and the move changes. A broken part is fixed when you heal.</p>
 <div class="u-list">${bots.map((m, i) => unitRowHTML(billyUnit(m), i, 'wsopen', 'refit')).join('')}</div>
 <p class="note tnum">${spares ? `${spares} spare part${spares === 1 ? '' : 's'}.` : 'No spare parts.'} Parts are found, crafted or won from trainers.</p>${wsCanBuild() ? '<button class="pb small" data-a="wsbuild">Build a robot from spares</button>' : ''}</section>`;
}
/** a robot's parts in its details sheet (in place of a Billie's part sizes) */
function robotPartsPanelHTML(m) {
  const fit = m.fit,
    w = robotWeight(fit),
    carry = robotPartDef(fit.legs.id).carry || 0;
  return `<div class="ms-parts"><div class="ms-parts-h"><b>Parts</b><span class="tnum">${w} kg of ${carry} kg the legs carry</span></div><div class="ms-parts-row">${ROBOT_SLOTS.map(
    k => {
      const P = robotPartDef(fit[k].id),
        brk = k !== 'torso' && partBroken(m, k);
      return `<span class="ms-part${brk ? ' sz-S' : ''}"><small>${escapeHtml(wsTitle(k))}</small><b>${escapeHtml(P.name)}${brk ? ' (broken)' : ''}</b></span>`;
    }
  ).join(
    ''
  )}<span class="ms-part"><small>Gem</small><b>${escapeHtml(robotGemDef(m.gem).name)}</b></span></div><p class="note">Refit it in the Workshop on your Team screen.</p></div>`;
}
/** the refit sheet's body */
function workshopHTML(m) {
  const S = uiState.ws || {},
    fit = m.fit,
    sp = speciesOf(m);
  const rows = WS_SLOTS.map(k => {
    const p = k === 'gem' ? { id: m.gem, up: 0 } : fit[k],
      P = wsPartDef(p.id),
      mv = k === 'torso' ? null : MOVES[P.move],
      dmg = k !== 'torso' && k !== 'gem' && ((m.partDmg && m.partDmg[k]) || 0) > 0,
      brk = k !== 'torso' && k !== 'gem' && partBroken(m, k),
      n = wsSpares(k).length;
    return `<button class="ws-slot${S.slot === k ? ' on' : ''}" data-a="wsslot" data-s="${k}" aria-expanded="${S.slot === k}"><small>${escapeHtml(wsTitle(k))}</small><b>${escapeHtml(P.name)}${wsStars(p.up)}</b><span class="ws-meta">${typeBadgeHTML(P.type)}${mv ? `<span>${escapeHtml(mv.n)}</span>` : ''}${brk ? '<span class="ws-brk">Broken</span>' : dmg ? '<span class="ws-brk dmg">Damaged</span>' : ''}</span><span class="ws-n tnum">${n ? `${n} spare${n === 1 ? '' : 's'}` : ''}</span></button>`;
  }).join('');
  let pick = '';
  if (S.slot) {
    const cur = S.slot === 'gem' ? null : fit[S.slot],
      max = robotRules().maxUpgrade,
      list = wsSpares(S.slot);
    pick = `<div class="ws-pick"><p class="note">${list.length ? `Spare ${escapeHtml(ROBOT_SLOT_NAMES[S.slot])}${S.slot === 'gem' ? 's' : ' parts'} that fit:` : `No spare ${escapeHtml(ROBOT_SLOT_NAMES[S.slot])} parts.`}</p>${list
      .map(p => {
        const P = wsPartDef(p.id),
          mv = P.move && MOVES[P.move];
        return `<div class="ws-cand"><span class="ws-ct"><b>${escapeHtml(P.name)}${wsStars(p.up)}</b><span class="ws-meta">${typeBadgeHTML(P.type)}${mv ? `<span>${escapeHtml(mv.n)}</span>` : ''}${P.wt != null ? `<span class="tnum">${P.wt} kg</span>` : ''}</span><span class="ws-ds">${wsDeltaHTML(m, S.slot, p)}</span></span><button class="pb small" data-a="wsfit" data-p="${p.uid}">Fit</button></div>`;
      })
      .join(
        ''
      )}${cur ? `<div class="ws-upg"><span class="note">Upgrade the fitted ${escapeHtml(ROBOT_SLOT_NAMES[S.slot])} (${cur.up || 0} of ${max}). Free in the prototype.</span><button class="pb small quiet" data-a="wsup" ${(cur.up || 0) >= max ? 'disabled' : ''}>Upgrade</button></div>` : ''}</div>`;
  }
  return `<div class="ws-top"><div class="ws-big" style="${plateVars(m)}">${rigCanvasHTML(m.sp, 112)}</div><div class="ws-info"><p class="row">${sp.types.map(typeBadgeHTML).join('')}<b class="lv tnum">Lv ${m.lvl}</b></p><div class="ws-stats">${STAT_IDS.map(k => `<span><small>${wsShortStat[k]}</small><b class="tnum">${k === 'hp' ? maxHp(m) : stat(m, k)}</b></span>`).join('')}</div></div></div>${unitCarryHTML(fit)}
 <div class="ws-slots">${rows}</div>${pick}`;
}
/** opens the refit sheet for a robot */
function openWorkshop(m) {
  if (!m || !isRobot(m)) return;
  uiState.ws = { uid: m.uid, slot: null };
  modal({
    title: `Refit ${escapeHtml(billyName(m))}`,
    cls: 'ws-sheet',
    html: workshopHTML(m),
    btns: [
      {
        l: 'Done',
        c: 'quiet',
        f: () => {
          uiState.ws = null;
          closeModal();
          render();
        },
      },
    ],
  });
}
function workshopRepaint() {
  const m = uiState.ws && findBilly(uiState.ws.uid);
  if (!m || !uiState.modal || uiState.modal.cls !== 'ws-sheet') return;
  uiState.modal.title = `Refit ${escapeHtml(billyName(m))}`;
  uiState.modal.html = workshopHTML(m);
  renderOverlay();
}
/** the workshop's taps (ui.js hands over data-a="ws…") */
export function workshopAction(a, d) {
  const m = uiState.ws && findBilly(uiState.ws.uid);
  switch (a) {
    case 'wsopen':
      openWorkshop(findBilly(d.u));
      return;
    case 'wsslot':
      if (!m) return;
      uiState.ws.slot = uiState.ws.slot === d.s ? null : d.s;
      workshopRepaint();
      return;
    case 'wsfit':
      if (!m || !uiState.ws.slot) return;
      if (fitPart(m, uiState.ws.slot, d.p)) {
        save();
        if (typeof soundEffect === 'function') soundEffect('tick');
      }
      workshopRepaint();
      return;
    case 'wsup': {
      const s = uiState.ws && uiState.ws.slot;
      if (!m || !s || s === 'gem') return;
      if (upgradePart(m.fit[s])) save();
      workshopRepaint();
      return;
    }
    case 'wsbuild': {
      if (!wsCanBuild()) return;
      const arms = wsSpares('armL');
      const nm = buildRobot(wsSpares('gem')[0].uid, {
        torso: wsSpares('torso')[0].uid,
        armL: arms[0].uid,
        armR: arms[1].uid,
        legs: wsSpares('legs')[0].uid,
      });
      if (!nm) return;
      save();
      render();
      toast(`${billyName(nm)} is built. Swap its parts in its refit sheet.`);
      openWorkshop(nm);
      return;
    }
  }
}
/** the debug menu's robot kit: two built robots on your team and one of every part and gem as spares */
function giveRobotKit() {
  const lv = robotStartLevel();
  addBilly(makeRobot('volt', fitFromIds({ torso: 'vane', armL: 'tesla', armR: 'auger', legs: 'striders' }), lv));
  addBilly(makeRobot('ember', fitFromIds({ torso: 'bulwark', armL: 'clamp', armR: 'cinder', legs: 'treads' }), lv));
  for (const id of [...Object.keys(ROBOTS.parts), ...Object.keys(ROBOTS.gems)]) addPart(id);
  saveData.items.repairkit = (saveData.items.repairkit || 0) + 3;
}
