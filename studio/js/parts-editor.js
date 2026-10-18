'use strict';
/* ================= POCKET BILLIES STUDIO · Parts (phase 16) =================
   rules.json "parts": how likely each size is, how big it is drawn, how heavy it is, each slot's share of the weight,
   and what weight and Prime do to the stats. A preview puts any Billie in any build and shows its weight and stat
   changes with the game's own formulas (game/js/logic/parts.js). Which slot a bone is: Billies → skeleton builder,
   "Part slot". */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  partsPrime,
  partsPrimeOdds,
  partsStatFactor,
  partsWeightRatio,
  weightClass,
} from '../../game/js/logic/parts.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, SECTIONS, card, grid, numberField, render, studioState } from './studio-app.js';
import { previewsDirty, spritePreviewHTML } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  PARTS_SIZE_LABELS: [() => PARTS_SIZE_LABELS],
  PARTS_SLOT_LABELS: [() => PARTS_SLOT_LABELS],
  partsChecksHTML: [() => partsChecksHTML, v => (partsChecksHTML = v)],
  partsPreviewSpecies: [() => partsPreviewSpecies, v => (partsPreviewSpecies = v)],
  partsReadoutHTML: [() => partsReadoutHTML, v => (partsReadoutHTML = v)],
  partsSel: [() => partsSel],
  partsSpeciesWeight: [() => partsSpeciesWeight, v => (partsSpeciesWeight = v)],
  pct: [() => pct],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const PARTS_SLOT_LABELS = { head: 'Head', body: 'Body', front: 'Front', back: 'Back', sig: 'Signature' };
const PARTS_SIZE_LABELS = { S: 'Small', M: 'Normal', L: 'Large' };
const partsSel = () => {
  const s = studioState.sel;
  if (!s.partsBuild) s.partsBuild = {};
  return s;
};
function partsPreviewSpecies(D) {
  const out = [];
  for (const L of D.lines || []) (L.names || []).forEach((n, i) => out.push([L.id + i, `${n} (${L.id})`]));
  return out;
}
function partsSpeciesWeight(D, sp) {
  const m = /^(.*?)(\d+)$/.exec(sp || ''),
    L = m && (D.lines || []).find(x => x.id === m[1]);
  if (!L) return 0;
  const wt = Array.isArray(L.wt) ? L.wt[Math.min(+m[2], L.wt.length - 1)] : L.wt;
  return +wt || 10;
}
const pct = f => `${f >= 1 ? '+' : '−'}${Math.abs(Math.round((f - 1) * 100))}%`;
function partsReadoutHTML() {
  const D = studioState.D,
    P = D.rules.parts,
    S = partsSel(),
    b = Object.fromEntries(P.slots.map(k => [k, S.partsBuild[k] || 'M'])),
    w = partsWeightRatio(P, b),
    kg = Math.round(partsSpeciesWeight(D, S.partsSp) * w * 10) / 10,
    prime = partsPrime(P, b);
  return `<div class="parts-read"><p><b>${kg} kg</b> · ${weightClass(kg)} · weight ×${w.toFixed(3)}${prime ? ' · <b class="parts-prime">Prime</b>' : ''}</p>
  <p>Attack and Sp. Atk <b>${pct(partsStatFactor(P, b, 'lev'))}</b> · Speed <b>${pct(partsStatFactor(P, b, 'hus'))}</b> · Defense, Sp. Def and HP <b>${pct(partsStatFactor(P, b, 'law'))}</b></p></div>`;
}
function partsChecksHTML(P) {
  const odds = Object.values(P.sizes).reduce((a, s) => a + (+s.odds || 0), 0),
    share = P.slots.reduce((a, k) => a + (+P.share[k] || 0), 0),
    out = [];
  if (Math.abs(odds - 1) > 0.001) out.push(`The size chances add up to ${Math.round(odds * 100)}%, not 100%.`);
  if (Math.abs(share - 1) > 0.001) out.push(`The weight shares add up to ${Math.round(share * 100)}%, not 100%.`);
  if (P.sizes.M && (P.sizes.M.scale !== 1 || P.sizes.M.weight !== 1))
    out.push('Normal (M) should be drawn at 1 and weigh 1, so a Prime Billie is its species’ own size and weight.');
  return out.length
    ? `<div class="parts-warn">${out.map(t => `<p>⚠ ${escapeHtml(t)}</p>`).join('')}</div>`
    : `<p class="help">Wild Billies are Prime about <b>1 in ${Math.round(1 / Math.max(1e-6, partsPrimeOdds(P)))}</b> times.</p>`;
}
SECTIONS.parts = () => {
  const D = studioState.D,
    P = D.rules && D.rules.parts;
  if (!P)
    return card(
      'Parts',
      '<p class="help">rules.json has no "parts" yet. Pull the latest game data (phase 16) and reload the Studio.</p>'
    );
  const S = partsSel(),
    list = partsPreviewSpecies(D);
  if (!list.some(([id]) => id === S.partsSp)) S.partsSp = list[0] && list[0][0];
  const sizes = Object.keys(P.sizes);
  const sizeRows = sizes
    .map(
      (z, i) =>
        `<div class="parts-size"><b>${escapeHtml(PARTS_SIZE_LABELS[z] || z)} (${escapeHtml(z)})</b>${grid(
          numberField('Chance', `rules.parts.sizes.${z}.odds`, {
            min: 0,
            max: 1,
            step: 0.01,
            help: i ? '' : '0 to 1, for wild Billies and eggs',
          }),
          numberField('Drawn at', `rules.parts.sizes.${z}.scale`, { min: 0.5, max: 2, step: 0.05, unit: '×' }),
          numberField('Weighs', `rules.parts.sizes.${z}.weight`, { min: 0.2, max: 3, step: 0.05, unit: '×' })
        )}</div>`
    )
    .join('');
  const shares = grid(
    ...P.slots.map(k =>
      numberField(PARTS_SLOT_LABELS[k] || k, `rules.parts.share.${k}`, { min: 0, max: 1, step: 0.05 })
    )
  );
  const effects = grid(
    numberField('Attack follows weight', 'rules.parts.attackExp', {
      step: 0.05,
      help: 'Attack and Sp. Atk × weight to this power (0.5: 25% heavier hits about 12% harder)',
    }),
    numberField('Speed follows weight', 'rules.parts.speedExp', {
      step: 0.05,
      help: 'Speed × weight to this power (negative: heavier is slower)',
    }),
    numberField('Most it can change', 'rules.parts.cap', {
      min: 0,
      max: 1,
      step: 0.01,
      help: 'Each stat moves at most this much from weight (0.2 = 20%)',
    }),
    numberField('Prime bonus', 'rules.parts.primeBonus', {
      min: 0,
      max: 1,
      step: 0.01,
      help: 'Every stat of a Prime Billie (all parts Normal) × 1 + this',
    })
  );
  const pick = `<label class="fld"><span>Billie</span><select id="partsSp">${list.map(([id, n]) => `<option value="${escapeHtml(id)}" ${id === S.partsSp ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label>`;
  const slots = P.slots
    .map(
      k =>
        `<div class="parts-slot"><small>${escapeHtml(PARTS_SLOT_LABELS[k] || k)}</small><div class="seg">${sizes
          .map(
            z =>
              `<button class="btn sm ${(S.partsBuild[k] || 'M') === z ? 'primary' : ''}" data-act="partsSize" data-k="${escapeHtml(k)}" data-z="${escapeHtml(z)}">${escapeHtml(z)}</button>`
          )
          .join('')}</div></div>`
    )
    .join('');
  const build = Object.fromEntries(P.slots.map(k => [k, S.partsBuild[k] || 'M']));
  const preview = `<div class="parts-prev">${['front', 'back']
    .map(v => spritePreviewHTML({ sp: S.partsSp, view: v, build, cls: 'big' }))
    .join('')}</div>`;
  return `<div class="ed-col parts-ed"><div class="ed-head"><div><small class="mono">rules.json → parts</small><h2>Parts</h2></div></div>
  ${card('Try a build', `${pick}<div class="parts-slots">${slots}</div><div class="seg-row"><button class="btn sm" data-act="partsRoll">Roll like a wild one</button><button class="btn sm" data-act="partsPrime">All Normal (Prime)</button></div>${preview}<div id="partsRead">${partsReadoutHTML()}</div>`, { sub: 'Every Billie has a size for each slot. Wild ones and eggs roll theirs; starters and trainers are all Normal, which is Prime.' })}
  ${card('Sizes', sizeRows + `<div id="partsChecks">${partsChecksHTML(P)}</div>`)}
  ${card('Weight shares', shares, { sub: 'How much of a Billie’s weight each slot carries. They should add up to 1.' })}
  ${card('What weight does', effects)}
  </div>`;
};
studioState.hooks.parts = () => {
  const P = studioState.D.rules.parts,
    r = document.getElementById('partsRead'),
    c = document.getElementById('partsChecks');
  if (r) r.innerHTML = partsReadoutHTML();
  if (c) c.innerHTML = partsChecksHTML(P);
  previewsDirty();
};
ACTIONS.partsSize = d => {
  partsSel().partsBuild[d.k] = d.z;
  render();
};
ACTIONS.partsPrime = () => {
  partsSel().partsBuild = {};
  render();
};
ACTIONS.partsRoll = () => {
  const P = studioState.D.rules.parts,
    sizes = Object.entries(P.sizes),
    tot = sizes.reduce((a, [, s]) => a + (+s.odds || 0), 0) || 1,
    b = {};
  for (const k of P.slots) {
    let r = Math.random() * tot;
    b[k] = sizes[sizes.length - 1][0];
    for (const [z, s] of sizes)
      if ((r -= +s.odds || 0) <= 0) {
        b[k] = z;
        break;
      }
  }
  partsSel().partsBuild = b;
  render();
};
document.addEventListener('change', ev => {
  if (ev.target && ev.target.id === 'partsSp') {
    partsSel().partsSp = ev.target.value;
    render();
  }
});
