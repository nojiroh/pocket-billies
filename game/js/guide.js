'use strict';
/* ================= GUIDE ================= */
/* UI-5: the Guide (the guide tab: the list, an entry's page, its Lore tab), moved from ui.js as it was; its buttons in guideAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { render } from './hooks.js';
import {
  DEX_ORDER,
  LINE_BY_ID,
  LOCATIONS,
  PASSIVE_INFO,
  POOLS,
  SPECIES,
  SPECIES_FORMS,
  STAT_IDS,
  STAT_NAMES,
  TYPES,
  TYPE_COLORS,
  typeEffectiveness,
} from './game-data.js';
import { dexCaught, dexSeen, evolutionHint, evolutionItemName, formatNumber } from './logic/rules.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { pyramidURL } from './art.js';
import { bustHTML, rigCanvasHTML } from './skeleton-rig.js';
import { loreBook, renderLore } from './lore.js';
import { renderPostcards } from './postcards.js';
import { progressBarHTML, typeBadgeHTML } from './ui-bits.js';
import { toast } from './overlay.js';
/* eslint-disable no-func-assign */
expose({
  RARITY_NAMES: [() => RARITY_NAMES],
  TRACKS: [() => TRACKS],
  dexStatus: [() => dexStatus, v => (dexStatus = v)],
  evolutionMethod: [() => evolutionMethod, v => (evolutionMethod = v)],
  guideAction: [() => guideAction, v => (guideAction = v)],
  guideTabs: [() => guideTabs, v => (guideTabs = v)],
  renderDexEntry: [() => renderDexEntry, v => (renderDexEntry = v)],
  renderGuide: [() => renderGuide, v => (renderGuide = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const RARITY_NAMES = { starter: 'Starter', common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythical: 'Mythical' };
const TRACKS = {
  biped: 'Two neat footprints, evenly spaced',
  quad: 'Four tidy paw prints',
  flyer: 'None. Prefers not to touch the ground',
  fish: 'None. Floats at shoulder height',
  serpent: 'A single elegant S',
  worm: 'Small, many, polite',
  octo: 'Eight wet circles',
  blob: 'A glossy puddle',
  shell: 'A slow, shiny trail',
};
function dexStatus(id) {
  return dexCaught(id) ? 'got' : dexSeen(id) ? 'seen' : 'none';
}
function guideTabs() {
  const t = uiState.guideTab || 'dex';
  return `<div class="seg guide-tabs" role="tablist" aria-label="Field Guide">${[
    ['dex', 'Billies'],
    ['lore', 'Lore'],
    ['cards', 'Postcards'],
  ]
    .map(
      ([k, n]) =>
        `<button class="${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-a="guidetab" data-k="${k}">${n}</button>`
    )
    .join('')}</div>`;
}
export function renderGuide() {
  if (uiState.dex && SPECIES[uiState.dex] && dexSeen(uiState.dex)) return renderDexEntry(uiState.dex);
  if (uiState.guideTab === 'cards' && typeof renderPostcards === 'function')
    return `<header class="bar"><div><div class="sub">Greetings from every town you’ve walked into</div><h1 class="where">Postcards</h1></div></header>${guideTabs()}${renderPostcards()}`;
  if (uiState.guideTab === 'lore' && typeof renderLore === 'function')
    return `<header class="bar"><div><div class="sub">The world, the story, the people</div><h1 class="where">Lore</h1></div></header>${guideTabs()}${renderLore()}`;
  const seen = DEX_ORDER.filter(dexSeen).length,
    got = DEX_ORDER.filter(dexCaught).length,
    f = uiState.dexF || 'all';
  const list = DEX_ORDER.filter(id => {
    const st = dexStatus(id);
    if (f === 'got') return st === 'got';
    if (f === 'miss') return st !== 'got';
    if (TYPES.includes(f)) return dexSeen(id) && SPECIES[id].types.includes(f);
    return true;
  });
  const chips =
    [
      ['all', 'All'],
      ['got', 'Caught'],
      ['miss', 'Missing'],
    ]
      .map(([k, l]) => `<button class="fchip k-btn${f === k ? ' on' : ''}" data-a="dexf" data-f="${k}">${l}</button>`)
      .join('') +
    TYPES.map(
      t =>
        `<button class="fchip k-btn tdot${f === t ? ' on' : ''}" data-a="dexf" data-f="${t}" style="--tc:${TYPE_COLORS[t][0]}" aria-label="${t}"><i></i>${t}</button>`
    ).join('');
  return `<header class="bar"><div><div class="sub">Professor Chosen’s records</div><h1 class="where">Field Guide</h1></div></header>${guideTabs()}
 <section class="ledsum paper px k-panel"><div class="ls-row"><div><span class="ls-k">Seen</span><b class="tnum">${seen}</b></div><div><span class="ls-k">Caught</span><b class="tnum">${got}</b></div><div><span class="ls-k">Total</span><b class="tnum">${DEX_ORDER.length}</b></div></div>${progressBarHTML(got / DEX_ORDER.length, 'gold')}<p class="hand">Keep walking. They are out there.</p></section>
 <div class="fchips">${chips}</div>
 <ol class="ledger paper px k-panel">${
   list
     .map(id => {
       const s = SPECIES[id],
         st = dexStatus(id),
         sn = st !== 'none';
       return `<li><button class="lrow ${st}" data-a="dex" data-s="${id}" aria-label="${sn ? s.name : 'Unknown'}, number ${s.no}"><span class="lno tnum">${String(s.no).padStart(3, '0')}</span><span class="lspr">${sn ? bustHTML(id, 46) : bustHTML(id, 46, { sil: 1, still: 1 })}</span><span class="ltx"><b>${sn ? escapeHtml(s.name) : 'Unknown'}</b><small>${sn ? escapeHtml(s.cat) : '—'}</small></span><span class="ltypes">${sn ? s.types.map(t => `<i style="--tc:${TYPE_COLORS[t][0]}" title="${t}"></i>`).join('') : ''}</span><span class="lst">${st === 'got' ? `<img class="pxi" src="${pyramidURL('pyramid')}" width="18" height="18" alt="Caught">` : st === 'seen' ? '<em>seen</em>' : ''}</span></button></li>`;
     })
     .join('') || '<li class="lempty">No entries match.</li>'
 }</ol>`;
}
function evolutionMethod(e) {
  if (!e) return '';
  switch (e.k) {
    case 'lvl':
      return `Lv ${e.at}`;
    case 'split':
      return `Lv ${e.at}, Build or Hype`;
    case 'item':
      return `${evolutionItemName(e)} at Lv ${e.min}`;
    case 'acquire':
      return `Traded at Lv ${e.min}, or ${evolutionItemName(e)}`;
    case 'donate':
      return `Give away ${e.n} items`;
    case 'merge':
      return 'Combine two';
    case 'rename':
      return `Nickname at Lv ${e.min}`;
    case 'idle':
      return 'One idle day';
    case 'streak':
      return `${e.n}-day walk streak`;
  }
  return '';
}
function renderDexEntry(id) {
  const s = SPECIES[id],
    got = dexCaught(id),
    L = LINE_BY_ID[s.line],
    D = (RIGS[id] && RIGS[id].front) || {},
    idx = DEX_ORDER.indexOf(id);
  const seenList = DEX_ORDER.filter(dexSeen),
    si = seenList.indexOf(id),
    prev = seenList[si - 1],
    next = seenList[si + 1];
  const where = [
    ...new Set(
      Object.keys(POOLS)
        .filter(p => POOLS[p].list.some(([x]) => x === id))
        .map(p => LOCATIONS.find(r => r.pool === p))
        .filter(Boolean)
        .map(r => r.name)
    ),
  ];
  /* RL-10: a line's first stage hatches from a pair bred at the ranch */
  const bred = SPECIES[id] && SPECIES[id].line + '0' === id;
  const strong = TYPES.filter(x => s.types.some(t => typeEffectiveness(t, [x]) > 1)),
    weak = TYPES.filter(x => typeEffectiveness(x, s.types) > 1),
    res = TYPES.filter(x => typeEffectiveness(x, s.types) < 1);
  /* RF-3: what its types do in battle (types.json passiveName, passiveText) */
  const abilities = s.types
    .filter(t => PASSIVE_INFO[t] && PASSIVE_INFO[t].name)
    .map(t => `<tr><td>${escapeHtml(PASSIVE_INFO[t].name)}</td><td>${escapeHtml(PASSIVE_INFO[t].text)}</td></tr>`)
    .join('');
  const tot = s.base.reduce((a, b) => a + b, 0),
    mx = Math.max(...s.base);
  const chain = L.names
    .map((n, st) => {
      const sid = L.id + st,
        sn = dexSeen(sid),
        prev = L.split && st === 3 ? L.id + '1' : L.id + (st - 1);
      return `${st ? `<span class="evarrow"><i>→</i><small>${escapeHtml(L.split && st >= 2 ? (st === 2 ? 'Build path' : 'Hype path') : evolutionMethod(SPECIES[prev].evo))}</small></span>` : ''}<button class="evnode k-card${sid === id ? ' cur' : ''}" data-a="dex" data-s="${sid}" ${sn ? '' : 'disabled'}>${sn ? rigCanvasHTML(sid, 44) : rigCanvasHTML(sid, 44, { sil: 1, still: 1 })}<small>${sn ? escapeHtml(n) : '???'}</small></button>`;
    })
    .join('');
  /* RO-1: its regional forms, each seen or not (they have no page of their own) */
  const forms = (SPECIES_FORMS[id] || [])
    .map(fid => {
      const F = SPECIES[fid],
        fs = !!saveData.seen[fid];
      return `<div class="evnode k-card">${fs ? rigCanvasHTML(fid, 44, { coat: F.coat }) : rigCanvasHTML(fid, 44, { sil: 1, still: 1 })}<small>${fs ? escapeHtml(F.name) : '???'}</small>${fs ? `<span class="row">${F.types.map(typeBadgeHTML).join('')}</span>` : ''}</div>`;
    })
    .join('');
  const bg = TYPE_COLORS[s.types[0]][0],
    bg2 = TYPE_COLORS[s.types[s.types.length - 1]][0];
  return `<header class="bar dexbar"><button class="pb small quiet" data-a="dexback">‹ Guide</button><div class="dexnav"><button class="pb small quiet" data-a="dex" data-s="${prev || ''}" ${prev ? '' : 'disabled'} aria-label="Previous entry">‹</button><span class="tnum">No. ${String(s.no).padStart(3, '0')}</span><button class="pb small quiet" data-a="dex" data-s="${next || ''}" ${next ? '' : 'disabled'} aria-label="Next entry">›</button></div></header>
 <article class="dexpage">
  <div class="plate px k-panel" style="--c1:${bg};--c2:${bg2}"><div class="plate-sky"></div><div class="plate-floor"></div><div class="plate-spr">${rigCanvasHTML(id, 150, { act: 'enter' })}</div><span class="cattag">${escapeHtml(s.cat)}</span><span class="stamp ${got ? 'got' : 'seen'}">${got ? 'Caught' : 'Seen'}</span><span class="specno tnum">Specimen ${String(s.no).padStart(3, '0')}/${String(DEX_ORDER.length).padStart(3, '0')}</span></div>
  <h2 class="dexname">${escapeHtml(s.name)}</h2><p class="row">${s.types.map(typeBadgeHTML).join('')}<span class="note rar">${RARITY_NAMES[s.rar] || ''}</span></p>
  <div class="vitals">${[
    ['Height', typeof s.ht === 'number' ? s.ht.toFixed(1) + ' m' : s.ht],
    ['Weight', typeof s.wt === 'number' ? (s.wt >= 1000 ? formatNumber(s.wt) : s.wt) + ' kg' : s.wt],
    ['Habitat', s.hab],
    ['Diet', s.diet],
  ]
    .map(([k, v]) => `<div class="vit px k-card"><span>${k}</span><b>${escapeHtml(String(v))}</b></div>`)
    .join('')}</div>
  <section class="paper px k-panel notes"><h3>Field notes</h3>${got ? `<p>${escapeHtml(s.blurb)}</p><p class="hand red">${escapeHtml(s.note)}</p>` : `<p>${escapeHtml(s.blurb.split('. ')[0])}. <span class="redact">██████ ████ ███████ ██</span></p><p class="hand">Catch one to complete this entry.</p>`}</section>
  <section class="paper px k-panel"><h3>Base stats</h3>${got ? `<table class="bsheet"><tbody>${STAT_IDS.map((k, i) => `<tr><td>${STAT_NAMES[k]}</td><td class="tnum">${s.base[i]}</td><td><span class="bbar" style="--w:${((s.base[i] / mx) * 100).toFixed(0)}%"></span></td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="tnum">${tot}</td><td></td></tr></tbody></table>` : `<p class="note">Catch one to see its stats.</p>`}</section>
  <section class="paper px k-panel lin"><h3>Evolution</h3><div class="chain">${chain}</div><p class="note">${escapeHtml(evolutionHint({ sp: id, lvl: 0 }))}</p></section>
  ${forms ? `<section class="paper px k-panel lin"><h3>Regional forms</h3><div class="chain">${forms}</div></section>` : ''}
  <section class="paper px k-panel"><h3>Type matchups</h3><table class="expo"><tbody><tr><td>Strong against</td><td>${strong.map(typeBadgeHTML).join('') || '—'}</td></tr><tr><td>Weak to</td><td>${weak.map(typeBadgeHTML).join('') || '—'}</td></tr><tr><td>Resists</td><td>${res.map(typeBadgeHTML).join('') || '—'}</td></tr></tbody></table></section>
  <section class="paper px k-panel"><h3>Abilities</h3><table class="expo"><tbody>${abilities || '<tr><td>None</td><td>—</td></tr>'}</tbody></table></section>
  <section class="paper px k-panel"><h3>Where to look</h3><table class="expo"><tbody><tr><td>Found at</td><td>${where.length ? escapeHtml(where.join(', ')) : 'Not found in the wild'}</td></tr><tr><td>Hatches from</td><td>${bred ? 'A pair bred at the ranch' : '—'}</td></tr><tr><td>Tracks</td><td>${escapeHtml(TRACKS[D.plan] || 'Unremarkable')}</td></tr></tbody></table></section>
  ${got ? `<div class="sig"><span class="sigline">${escapeHtml(s.name)}</span><small>Recorded by Kappi. Signed by the Chosen.</small></div>` : ''}
 </article>`;
}
/* the Guide's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function guideAction(a, d) {
  switch (a) {
    case 'dex': {
      if (!d.s) break;
      if (!dexSeen(d.s)) {
        toast('Not seen yet. Keep walking.');
        break;
      }
      uiState.dex = d.s;
      uiState.lastTab = 'guide';
      render();
      scrollTo(0, 0);
      break;
    }
    case 'dexback':
      uiState.dex = null;
      render();
      scrollTo(0, 0);
      break;
    case 'dexf':
      uiState.dexF = d.f;
      render();
      break;
    case 'guidetab':
      uiState.guideTab = d.k;
      render();
      scrollTo(0, 0);
      break;
    case 'loresec':
      uiState.loreSec = d.k;
      render();
      break;
    case 'lorebook':
      loreBook(d.k);
      break;
  }
}
