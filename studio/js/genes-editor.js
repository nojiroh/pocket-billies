'use strict';
/* ================= POCKET BILLIES STUDIO · Genes (splicing track SP-4) =================
   genes.json: what a spliced part does. Stability (what a foreign part costs, the limit, how far past it is refused)
   and Unstable; each part kind's trait, its word in text and the field move it counts for; the traits' names and
   text (their effect rows stay in the file); the parts with a dominant type or a field move; the wild splices' odds
   and the DNA they pay; the Gene Bank's levels (limit, slots) and a splice's price; an egg's chance to keep a Gene;
   and rules.json's starter-point cost of a splice. Every number is a placeholder until the owner sets it. A splice
   preview bakes any kit Billie with a Gene on a slot (the game's own baker, logic/kit-assemble.js, through Part
   mode's kitBakeInStudio) and shows its Stability, traits, types and price with logic/genes.js. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { kitBakeInStudio } from '../../game/js/hooks.js';
import { graftDonors, graftForm } from '../../game/js/logic/graft-art.js';
import { augBase, augChoices, augMoves, augWords } from '../../game/js/logic/augments.js';
import {
  geneCost,
  geneOf,
  geneWords,
  graftFields,
  graftStability,
  graftTraits,
  graftTypes,
} from '../../game/js/logic/genes.js';
import { makeCanvas } from '../../game/js/art.js';
import { drawRig, rigFrame, rigFromMeta } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import { SECTIONS, card, grid, numberField, render, selectField, studioState, textField } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  GENE_SLOTS: [() => GENE_SLOTS],
  RARITY_OPTS: [() => RARITY_OPTS],
  genesAugText: [() => genesAugText, v => (genesAugText = v)],
  genesBake: [() => genesBake, v => (genesBake = v)],
  genesData: [() => genesData, v => (genesData = v)],
  genesPreview: [() => genesPreview],
  genesPreviewText: [() => genesPreviewText, v => (genesPreviewText = v)],
  genesSel: [() => genesSel],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const GENE_SLOTS = [
  ['front', 'Front'],
  ['back', 'Back'],
  ['sig', 'Tail (signature)'],
];
/** the Studio's data as logic/genes.js reads it (rules.js geneData): the species by id, from the lines */
function genesData() {
  const D = studioState.D,
    species = {};
  for (const L of D.lines || [])
    (L.names || []).forEach((n, i) => {
      species[L.id + i] = {
        name: n,
        line: L.id,
        types: (Array.isArray(L.types && L.types[0]) ? L.types[i] || L.types[0] : L.types) || [],
        wt: Array.isArray(L.wt) ? L.wt[Math.min(i, L.wt.length - 1)] : L.wt,
      };
    });
  return {
    kitBuilds: D.kitBuilds,
    partKits: D.partKits,
    genes: D.genes,
    species,
    parts: D.rules && D.rules.parts,
    /* SP-5: Augments are robots.json parts */
    robots: D.robots,
    robotRules: D.rules && D.rules.robots,
  };
}
const genesSel = () => {
  const s = studioState.sel;
  if (!s.genes) s.genes = { sp: '', slot: 'front', gene: '', aug: '' };
  return s.genes;
};
/** SP-5: an Augment tried on the picked Billie: its slot, Stability, types, move, field move and stats, from the game's
 * logic @param {any} G @param {any} S */
function genesAugText(G, S) {
  if (!S.aug) return '<p class="help">Pick a bot part.</p>';
  const [slot, id] = S.aug.split(':'),
    a = { [slot]: { uid: 'studio', id, up: 0 } },
    st = graftStability(G, S.sp, null, undefined, a),
    types = graftTypes(G, S.sp, null, null, a),
    fields = graftFields(G, S.sp, null, a),
    base = augBase(G, S.sp, a),
    moves = augMoves(G, S.sp, a);
  return `<p><b>${escapeHtml(augWords(G, id))}</b> on the ${slot === 'back' ? 'legs' : 'right arm'} · Stability ${st.cost} of ${st.limit}${st.refused ? ' · <b>refused</b>' : st.unstable ? ' · <b>Unstable</b>' : ''} · ${G.genes.augment.price.fit} Scrap at the Workshop</p><p>Types ${escapeHtml(types.join(' / '))}${moves.length ? ` · move ${escapeHtml(moves.join(', '))}` : ''}${fields.length ? ` · counts for ${escapeHtml(fields.join(', '))}` : ''} · base stats ${escapeHtml(
    Object.entries(base)
      .map(([k, v]) => `+${Math.round(v * 10) / 10} ${k}`)
      .join(', ') || 'none'
  )}</p>`;
}
/** UI-14b: the loot ladder's tiers, for a trait's rarity */
const RARITY_OPTS = [
  ['common', 'Common'],
  ['uncommon', 'Uncommon'],
  ['rare', 'Rare'],
  ['mythical', 'Mythical'],
];
/** the splice preview's words: the Gene's Stability, traits, types and price, from the game's logic */
function genesPreviewText(G, S) {
  if (!S.gene) return '<p class="help">Pick a Gene.</p>';
  const graft = { [S.slot]: S.gene },
    st = graftStability(G, S.sp, graft),
    traits = graftTraits(G, S.sp, graft).map(t => (G.genes.traits[t] ? G.genes.traits[t].name : t)),
    types = graftTypes(G, S.sp, graft, null),
    gene = geneOf(G, S.slot, S.gene),
    P = G.genes.bank && G.genes.bank.price,
    price = P && gene ? P.base + P.perCost * geneCost(G, S.sp, gene) : null;
  return `<p><b>${escapeHtml(geneWords(G, S.slot, S.gene))}</b> · Stability ${st.cost} of ${st.limit}${st.refused ? ' · <b>refused</b>' : st.unstable ? ' · <b>Unstable</b>' : ''}${price != null ? ` · ${price} DNA at the Gene Bank` : ''}</p><p>Traits: ${escapeHtml(traits.join(', ') || 'none')} · types ${escapeHtml(types.join(' / '))}${gene && gene.field ? ` · counts for ${escapeHtml(gene.field)}` : ''}</p>`;
}
const genesPreview = { key: '', busy: false, error: '' };
/** bakes the picked splice and draws it still on the preview canvas (a bake runs once per Billie and Gene) */
async function genesBake() {
  const c = document.getElementById('genesCanvas'),
    G = genesData(),
    S = genesSel();
  if (!c || !S.gene) return;
  const key = `${S.sp}~${S.slot}=${S.gene}`;
  if (genesPreview.key === key && c._drawn) return;
  genesPreview.key = key;
  genesPreview.error = '';
  const form = graftForm(G.kitBuilds, G.partKits, S.sp, { [S.slot]: S.gene });
  if (!form) {
    genesPreview.error = 'That Gene doesn’t fit.';
    return;
  }
  try {
    const made = await kitBakeInStudio(form);
    if (genesPreview.key !== key || !c.isConnected) return;
    const sheet = makeCanvas(made.sheet.width, made.sheet.height);
    sheet
      .getContext('2d')
      .putImageData(new ImageData(new Uint8ClampedArray(made.sheet.data), made.sheet.width, made.sheet.height), 0, 0);
    const R = rigFromMeta(made.rig.front, sheet);
    c.width = R.BW;
    c.height = R.BH;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    drawRig(x, R, rigFrame(R, null, 0, 0, 0), 'front');
    c._drawn = 1;
  } catch (e) {
    genesPreview.error = e.message;
    const t = document.getElementById('genesErr');
    if (t) t.textContent = e.message;
  }
}
SECTIONS.genes = () => {
  const D = studioState.D,
    GN = D.genes;
  if (!GN)
    return card('Genes', '<p class="help">game/data has no genes.json. Pull the latest game data and reload.</p>');
  const G = genesData(),
    S = genesSel(),
    rigs = (D.kitBuilds.forms || []).map(f => f.rig).filter(r => G.species[r]);
  if (!rigs.includes(S.sp)) S.sp = rigs[0] || '';
  const donors = S.sp ? graftDonors(G.kitBuilds, G.partKits, S.sp, S.slot) : [];
  if (S.gene && !donors.includes(S.gene)) S.gene = '';
  const traitOpts = Object.keys(GN.traits).map(t => [t, GN.traits[t].name]),
    fieldOpts = Object.keys((D.fieldMoves && D.fieldMoves.moves) || {}).map(f => [f, D.fieldMoves.moves[f].name || f]),
    typeOpts = (D.types || []).map(t => [t.id, t.id]),
    n = (label, p, o = {}) => numberField(label, p, { step: 1, ...o });
  const stab = grid(
    n('Same line', 'genes.stability.line', { min: 0, max: 20 }),
    n('Same kit', 'genes.stability.kit', { min: 0, max: 20 }),
    n('Another kit', 'genes.stability.other', { min: 0, max: 20 }),
    n('An Augment', 'genes.stability.augment', { min: 0, max: 20 }),
    n('Limit (no Bank)', 'genes.stability.limit', {
      min: 0,
      max: 20,
      help: 'The Gene Bank’s level 1 limit must match',
    }),
    n('Refused past limit +', 'genes.stability.refuse', { min: 1, max: 20 })
  );
  const unstable = grid(
    numberField('One stat ×', 'genes.unstable.up', { min: 1, max: 3, step: 0.05 }),
    numberField('Another ×', 'genes.unstable.down', { min: 0.1, max: 1, step: 0.05 }),
    textField('Name', 'genes.unstable.name', { max: 24 }),
    textField('What it does', 'genes.unstable.d', { area: 1, rows: 2 })
  );
  const kinds = Object.keys(GN.kinds)
    .map(
      k =>
        `<div class="parts-size"><b>${escapeHtml(k)}</b>${grid(
          selectField('Trait', `genes.kinds.${k}.trait`, traitOpts),
          textField('Word', `genes.kinds.${k}.word`, { opt: 1, max: 16, ph: 'not spliced yet' }),
          selectField('Field move', `genes.kinds.${k}.field`, fieldOpts, { none: 'None', opt: 1 })
        )}</div>`
    )
    .join('');
  const traits = Object.keys(GN.traits)
    .map(
      t =>
        `<div class="parts-size"><b>${escapeHtml(t)}</b>${grid(
          textField('Name', `genes.traits.${t}.name`, { max: 24 }),
          textField('What it does', `genes.traits.${t}.d`, { area: 1, rows: 2 }),
          /* UI-14b: the trait's tier on the loot ladder (a Gene that brings it shows it) */
          selectField('Rarity', `genes.traits.${t}.rarity`, RARITY_OPTS)
        )}</div>`
    )
    .join('');
  const parts = Object.keys(GN.parts)
    .map(
      k =>
        `<div class="parts-size"><b>${escapeHtml(k)}</b>${grid(
          selectField('Dominant type', `genes.parts.${k}.type`, typeOpts, { none: 'None', opt: 1 }),
          selectField('Field move', `genes.parts.${k}.field`, fieldOpts, { none: 'None', opt: 1 })
        )}</div>`
    )
    .join('');
  const wild = grid(
    numberField('Graft chance', 'genes.wild.graft', { min: 0, max: 1, step: 0.005 }),
    numberField('Chimera chance', 'genes.wild.chimera', { min: 0, max: 1, step: 0.005 }),
    n('DNA a Graft pays', 'genes.wild.dna.graft', { min: 0 }),
    n('DNA a Chimera pays', 'genes.wild.dna.chimera', { min: 0 })
  );
  /* SP-5: Augments (genes.json augment): the Workshop's numbers and the Escaped specimens' */
  const A = GN.augment,
    augCard = A
      ? `${grid(
          numberField('Share of the part’s stats', 'genes.augment.statShare', { min: 0, max: 2, step: 0.05 }),
          n('Fit: Scrap', 'genes.augment.price.fit', { min: 0 }),
          ...A.price.up.map((_, i) => n(`Upgrade to +${i + 1}: Scrap`, `genes.augment.price.up.${i}`, { min: 0 })),
          numberField('Escaped chance', 'genes.wild.escaped', { min: 0, max: 1, step: 0.001 }),
          numberField('… times next to a scrapyard', 'genes.augment.escapedNear', { min: 0, max: 100, step: 0.5 }),
          n('DNA an Escaped one pays', 'genes.wild.dna.escaped', { min: 0, opt: 1 })
        )}${A.levels
          .map(
            (L, i) =>
              `<div class="parts-size"><b>Workshop level ${i + 1}</b>${grid(
                n('Upgrades to +', `genes.augment.levels.${i}.maxUp`, { min: 0, max: 9 })
              )}<small class="help">Fits: ${escapeHtml(L.slots.join(', '))} (level prices are unlocks.json rows, in Unlocks &amp; hub)</small></div>`
          )
          .join(
            ''
          )}<div class="grid"><label class="fld"><span>Try a bot part on ${escapeHtml(S.sp)}</span><select id="genesAug"><option value="">Pick one</option>${augChoices(
          G,
          S.sp
        )
          .map(
            ([slot, id]) =>
              `<option value="${slot}:${escapeHtml(id)}" ${S.aug === `${slot}:${id}` ? 'selected' : ''}>${escapeHtml(augWords(G, id))} (${slot})</option>`
          )
          .join('')}</select></label></div><div id="genesAugRead">${genesAugText(G, S)}</div>`
      : '';
  const levels = GN.bank.levels
    .map(
      (L, i) =>
        `<div class="parts-size"><b>Level ${i + 1}</b>${grid(
          n('Stability limit', `genes.bank.levels.${i}.limit`, { min: 0, max: 20 })
        )}<small class="help">Splices: ${escapeHtml(L.slots.join(', '))} (the slot list is in genes.json; level prices are unlocks.json rows, in Unlocks &amp; hub)</small></div>`
    )
    .join('');
  const bank = grid(
    n('A splice: DNA', 'genes.bank.price.base', { min: 0 }),
    n('… plus DNA per Stability', 'genes.bank.price.perCost', { min: 0 }),
    numberField('An egg keeps a Gene', 'genes.bank.inherit', {
      min: 0,
      max: 1,
      step: 0.05,
      help: '0 to 1, per parent’s spliced slot',
    }),
    n('Starter points: 1 per Stability', 'rules.run.points.perStability', { min: 1, max: 20, opt: 1 })
  );
  const pick = `<div class="grid"><label class="fld"><span>Billie</span><select id="genesSp">${rigs.map(r => `<option value="${escapeHtml(r)}" ${r === S.sp ? 'selected' : ''}>${escapeHtml(G.species[r].name)} (${escapeHtml(r)})</option>`).join('')}</select></label><label class="fld"><span>Slot</span><select id="genesSlot">${GENE_SLOTS.map(([k, l]) => `<option value="${k}" ${k === S.slot ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fld"><span>Gene</span><select id="genesGene"><option value="">Pick one</option>${donors.map(id => `<option value="${escapeHtml(id)}" ${id === S.gene ? 'selected' : ''}>${escapeHtml(geneWords(G, S.slot, id) || id)} (${escapeHtml(id)})</option>`).join('')}</select></label></div>`;
  const preview = `${pick}<div class="parts-prev"><canvas id="genesCanvas" class="spr-prev big" width="10" height="10"></canvas></div><div id="genesRead">${genesPreviewText(G, S)}</div><p class="help" id="genesErr">${escapeHtml(genesPreview.error)}</p>`;
  setTimeout(genesBake, 0);
  return `<div class="ed-col parts-ed"><div class="ed-head"><div><small class="mono">genes.json</small><h2>Genes</h2></div></div>
  ${card('Try a splice', preview, { sub: 'Any kit Billie with a Gene on a slot, baked with the game’s own baker. Every number below is a placeholder.' })}
  ${card('Stability', stab, { sub: 'What a foreign part costs. Past the limit a Billie is Unstable; past limit + refuse the splice is refused.' })}
  ${card('Unstable', unstable)}
  ${card('Gene Bank', levels + bank, { sub: 'Its levels’ limits, a splice’s price, eggs, and the starter-point cost of a splice.' })}
  ${card('Wild splices', wild, { sub: 'The share of a run place’s wild Billies spliced, and the DNA a beaten one pays.' })}
  ${augCard ? card('Augments', augCard, { sub: 'Bot arms and legs on Billies (the Workshop), and Escaped specimens wearing them. Placeholders.' }) : ''}
  ${card('Part kinds', kinds, { sub: 'The trait each kind brings, its word in battle text, and the field move it counts for.' })}
  ${card('Parts', parts, { sub: 'Parts with a dominant type (the second type) or a field move of their own.' })}
  ${card('Traits', traits, { sub: 'Names and text; their effect rows are in genes.json.' })}
  </div>`;
};
studioState.hooks.genes = () => {
  const r = document.getElementById('genesRead');
  if (r) r.innerHTML = genesPreviewText(genesData(), genesSel());
  const a = document.getElementById('genesAugRead');
  if (a) a.innerHTML = genesAugText(genesData(), genesSel());
};
document.addEventListener('change', ev => {
  const id = ev.target && ev.target.id,
    S = genesSel();
  if (id === 'genesAug') {
    S.aug = ev.target.value;
    render();
    return;
  }
  if (id === 'genesSp' || id === 'genesSlot' || id === 'genesGene') {
    if (id === 'genesSp') S.aug = '';
    if (id === 'genesSp') S.sp = ev.target.value;
    if (id === 'genesSlot') S.slot = ev.target.value;
    if (id === 'genesGene') S.gene = ev.target.value;
    if (id !== 'genesGene') S.gene = '';
    genesPreview.key = '';
    render();
  }
});
