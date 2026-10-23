'use strict';
/* ================= ECONOMY (Studio plan Phase 4, T4.4) =================
   One page that lists where each currency comes from and goes (logic/economy-view.js economyLines: the run's rewards,
   wild prizes and Loopholes' money rows; the clinic, run shop wares and shop Loopholes; the payout's rates; the earned
   unlocks' grants, each building's unlock costs and the ranch's), each with a link to the field that sets it, and
   each currency's kept rule. Read-mostly: the numbers are edited where they live. There is no economy data model.
   The money in and out of simulated runs (Phase 3's balance dashboard, T3.4) belongs here too; it has not landed on
   this branch, so a placeholder says so. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { escapeHtml } from './game-stand-ins.js';
import { economyLines } from '../../game/js/logic/economy-view.js';
import { ACTIONS, SECTIONS, SECTION_LIST, card, studioState } from './studio-app.js';
import { findField } from './find.js';
expose({ ECONOMY_SIDES: [() => ECONOMY_SIDES] });
/* to-module: end */
const ECONOMY_SIDES = { in: 'Comes from', turn: 'At the payout', out: 'Goes to' };

SECTIONS.economy = () => {
  const D = studioState.D,
    L = economyLines(D),
    C = D.currencies || {},
    by = Object.keys(C).map(c => [c, L.filter(l => l.currency === c)]);
  const tables = by
    .map(([c, rows]) => {
      const K = C[c] || {},
        body = rows
          .map(
            (/** @type {any} */ l, /** @type {number} */ i) =>
              `<tr data-eco="${escapeHtml(l.path)}"><td class="eco-side">${i && rows[i - 1].side === l.side ? '' : ECONOMY_SIDES[l.side]}</td><td>${escapeHtml(l.what)}</td><td class="mono">${l.unit === '×' ? '×' + l.value : l.value}</td><td><button class="linkish" data-act="ecoGo" data-sec="${escapeHtml(l.section)}" data-path="${escapeHtml(l.path)}" title="${escapeHtml(l.path)}">${escapeHtml((SECTION_LIST.find(n => n[0] === l.section) || [])[1] || l.section)} ›</button></td></tr>`
          )
          .join('');
      return card(
        `${escapeHtml(K.long || K.name || c)} <span class="run-tag${K.kept === 'run' ? ' legacy' : ''}">${K.kept === 'run' ? 'the run’s: gone at the payout' : 'kept between runs'}</span>`,
        `<table class="tbl eco"><tbody>${body || '<tr><td>Nothing in the data gives or takes it.</td></tr>'}</tbody></table>`,
        { sub: escapeHtml(K.about || '') }
      );
    })
    .join('');
  return `<div class="ed-col solo"><div class="ed-head"><div><h2>Economy</h2><p class="sub">Every source and sink of each currency, read from the field that sets it. Click one to edit it where it lives.</p></div></div>
 ${card(
   'Moneys in and out of runs',
   '<p class="help eco-sim" data-eco-sim="none">Not here yet: the simulated runs’ money in and out (Studio plan Phase 3, the balance dashboard T3.4) has not landed. Until then, the Run Lab shows a seed’s rewards, shops and picks.</p>'
 )}
 ${tables}</div>`;
};
/* a field of one Loophole or unlock shows when that one is picked */
ACTIONS.ecoGo = d => {
  const [top, id] = String(d.path).split('.'),
    sel = top === 'relics' ? { relic: id } : top === 'unlocks' ? { unlock: id } : undefined;
  findField(d.sec, d.path, sel);
};
