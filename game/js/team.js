'use strict';
/* ================= TEAM ================= */
/* UI-5: the Team screen (the lead, the party, storage), moved from ui.js as it was; its buttons in teamAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { billyUnit, provide, render, unitHeroHTML, unitOpenRowHTML, unitRowHTML } from './hooks.js';
import { clamp } from './util.js';
import { TYPE_COLORS } from './game-data.js';
import { speciesOf } from './logic/fighters.js';
import { billyName, formatNumber, maxHp, maxLevel, teamSize, xpFor } from './logic/rules.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { workshopSectionHTML } from './workshop.js';
import { statusBadgeHTML } from './ui-bits.js';
/* eslint-disable no-func-assign */
expose({
  BOX_SORTS: [() => BOX_SORTS],
  billyConditionHTML: [() => billyConditionHTML],
  boxSection: [() => boxSection, v => (boxSection = v)],
  meter: [() => meter],
  needsCare: [() => needsCare],
  plateVars: [() => plateVars],
  renderTeam: [() => renderTeam, v => (renderTeam = v)],
  teamAction: [() => teamAction, v => (teamAction = v)],
  xpLeft: [() => xpLeft],
  xpProgress: [() => xpProgress],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- team: the lead up top, the party as cards, then storage ---------- */
export const plateVars = m => {
  const t = speciesOf(m).types;
  return `--c1:${TYPE_COLORS[t[0]][0]};--c2:${TYPE_COLORS[t[t.length - 1]][0]}`;
};
provide({ plateVars }); /* to-module */
export const billyConditionHTML = m =>
  m.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : statusBadgeHTML(m.status);
export const xpProgress = m => {
  if (m.lvl >= maxLevel()) return 1;
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1);
  return clamp((m.xp - a) / (b - a), 0, 1);
};
export const xpLeft = m =>
  m.lvl >= maxLevel() ? 'Max level' : `${formatNumber(xpFor(m.lvl + 1) - m.xp)} to Lv ${m.lvl + 1}`;
export const needsCare = m => m.hp < maxHp(m) || !!m.status;
export const meter = (k, inner, v) => `<div class="tm-meter"><span>${k}</span>${inner}<b class="tnum">${v}</b></div>`;
const BOX_SORTS = [
  ['new', 'Newest'],
  ['lvl', 'Level'],
  ['name', 'Name'],
];
function boxSection() {
  /* RL-8: storage stays in Copperleaf during a run */
  if (saveData.run)
    return '<section class="tpanel tm-box"><div class="sec-h"><h2>Storage</h2></div><div class="empty tm-empty">Storage stays in Copperleaf while you’re on a run. Your party holds six: catch a seventh and one of them leaves.</div></section>';
  const all = saveData.box,
    so = uiState.boxSort || 'new',
    types = [...new Set(all.flatMap(m => speciesOf(m).types))].sort();
  let f = uiState.boxF || 'all';
  if (f !== 'all' && !types.includes(f)) f = 'all';
  let L = all.filter(m => f === 'all' || speciesOf(m).types.includes(f));
  L =
    so === 'lvl'
      ? L.slice().sort((a, b) => b.lvl - a.lvl)
      : so === 'name'
        ? L.slice().sort((a, b) => billyName(a).localeCompare(billyName(b)))
        : L.slice().reverse();
  const full = saveData.team.length >= teamSize();
  const tools =
    all.length > 3
      ? `<div class="fchips tm-tools" role="group" aria-label="Sort and filter storage">${BOX_SORTS.map(([k, l]) => `<button class="fchip k-btn${so === k ? ' on' : ''}" data-a="boxsort" data-k="${k}" aria-pressed="${so === k}">${l}</button>`).join('')}${types.length > 1 ? `<span class="tm-sep" aria-hidden="true"></span><button class="fchip k-btn${f === 'all' ? ' on' : ''}" data-a="boxf" data-f="all" aria-pressed="${f === 'all'}">All types</button>${types.map(t => `<button class="fchip k-btn tdot${f === t ? ' on' : ''}" data-a="boxf" data-f="${t}" style="--tc:${TYPE_COLORS[t][0]}" aria-pressed="${f === t}"><i></i>${t === 'None' ? 'Normal' : t}</button>`).join('')}` : ''}</div>`
      : '';
  return `<section class="tpanel tm-box"><div class="sec-h"><h2>Storage</h2><span class="count tnum">${all.length}</span></div>${
    all.length
      ? `<p class="note">Billies resting here don’t battle. Tap one for details.</p>${tools}
 <div class="bx-grid">${L.map(
   m =>
     `<div class="bx k-card"><button class="bx-main" data-a="mon" data-u="${m.uid}"><span class="bx-spr" style="${plateVars(m)}">${rigCanvasHTML(m.sp, 60, { build: m.build, coat: m.coat })}</span><b>${escapeHtml(billyName(m))}</b><span class="bx-sub tnum">Lv ${m.lvl}<span class="bx-dots">${speciesOf(
       m
     )
       .types.map(t => `<i style="--tc:${TYPE_COLORS[t][0]}" title="${t}"></i>`)
       .join(
         ''
       )}</span></span></button><button class="qk k-btn" data-a="mteam" data-u="${m.uid}">${full ? 'Swap in' : 'To team'}</button></div>`
 ).join('')}</div>`
      : '<div class="empty tm-empty">Storage is empty. When your team is full, new Billies you tax and hatchlings rest here.</div>'
  }</section>`;
}
export function renderTeam() {
  const lead = saveData.team[0],
    rest = saveData.team.slice(1),
    free = saveData.run ? 0 : saveData.box.length,
    open = Math.max(0, teamSize() - saveData.team.length);
  /* phase 06-2: the lead big, the rest as roomy rows (js/unit-card.js), the open spots last */
  const slots = open
    ? unitOpenRowHTML(
        open,
        free ? 'Bring someone back from storage.' : 'Tax more in the grass, or hatch an egg.',
        free ? '<button class="pb small" data-a="tmadd">Add</button>' : ''
      )
    : '';
  return `<header class="bar"><div><div class="sub">${saveData.team.length} of ${teamSize()} on your team</div><h1 class="where">Your team</h1></div></header>
 <div class="u-team">${lead ? unitHeroHTML(billyUnit(lead)) : ''}${rest.length || slots ? `<div class="u-list" aria-label="Party">${rest.map((m, i) => unitRowHTML(billyUnit(m), i)).join('')}${slots}</div>` : ''}<p class="u-hint">Your lead goes first in battle. Tap anyone for details.</p></div>
${workshopSectionHTML()}
 ${boxSection()}`;
}
/* the Team screen's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function teamAction(a, d) {
  switch (a) {
    case 'boxsort':
      uiState.boxSort = d.k;
      render();
      break;
    case 'boxf':
      uiState.boxF = d.f;
      render();
      break;
  }
}
