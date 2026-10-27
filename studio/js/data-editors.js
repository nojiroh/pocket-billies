'use strict';
/* ================= POCKET BILLIES STUDIO · editors ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  BODY_TEMPLATES,
  PLAN_INFO,
  artPaint,
  artPicSrc,
  loadWardrobe,
  makeBlankBody,
  musicCryCardHTML,
  musicCryTidy,
  neutralPose,
  openSkeleton,
  trainerRunHTML,
  wardrobeEditor,
} from '../../game/js/hooks.js';
import { $, $$ } from '../../game/js/util.js';
import { ART_CACHE, ICON_ATLAS, iconURL, makeCanvas } from '../../game/js/art.js';
import {
  bodySliders,
  cleanLook,
  forgetPersonLooks,
  lookFromOld,
  personSheet,
  wornColors,
} from '../../game/js/person-art.js';
import { drawRig, rigPose } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import { renameTypeIn } from '../../game/js/logic/type-rename.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  colorField,
  dialog,
  formatThousands,
  grid,
  itemOptions,
  moveOptions,
  numberField,
  openSection,
  pathPrefix,
  peopleOptions,
  pyramidOptions,
  rangeField,
  render,
  selectField,
  speciesName,
  speciesOptions,
  statOptions,
  statusOptions,
  studioState,
  textField,
  toast,
  typeChipHTML,
  typeOptions,
  uniqueKey,
  updateTopBar,
  writePath,
} from './studio-app.js';
import { conditionField, scriptField } from './story-editor.js';
import {
  ATLAS_CACHE,
  atlasGet,
  atlasPath,
  fileToCanvas,
  hueShift,
  loadedAtlas,
  markArt,
  mountPreviews,
  openPixelEditor,
  pickFile,
  playSpritePreviewAction,
  rigFor,
  spritePreviewHTML,
} from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  EVOLUTION_KINDS: [() => EVOLUTION_KINDS],
  FX_ICONS: [() => FX_ICONS],
  ITEM_ICONS: [() => ITEM_ICONS],
  MOVE_CATEGORIES: [() => MOVE_CATEGORIES],
  PASSIVES: [() => PASSIVES],
  RARITY_LABELS: [() => RARITY_LABELS],
  SIDE_LIST_RENDERERS: [() => SIDE_LIST_RENDERERS],
  STAGE_LABEL: [() => STAGE_LABEL],
  baseStats: [() => baseStats, v => (baseStats = v)],
  cloneSpeciesArt: [() => cloneSpeciesArt, v => (cloneSpeciesArt = v)],
  evolutionRowHTML: [() => evolutionRowHTML, v => (evolutionRowHTML = v)],
  iconSpriteHTML: [() => iconSpriteHTML, v => (iconSpriteHTML = v)],
  lineIndexOf: [() => lineIndexOf],
  personLook: [() => personLook, v => (personLook = v)],
  personPreviewHTML: [() => personPreviewHTML, v => (personPreviewHTML = v)],
  poolName: [() => poolName],
  poolPercent: [() => poolPercent],
  pyramidArtHTML: [() => pyramidArtHTML, v => (pyramidArtHTML = v)],
  refsTo: [() => refsTo, v => (refsTo = v)],
  removeRefs: [() => removeRefs, v => (removeRefs = v)],
  selectedLineIndex: [() => selectedLineIndex],
  statsCard: [() => statsCard, v => (statsCard = v)],
  trainerRobotHTML: [() => trainerRobotHTML, v => (trainerRobotHTML = v)],
  whereCard: [() => whereCard, v => (whereCard = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const STAGE_LABEL = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'];
export const RARITY_LABELS = {
  starter: 'Starter',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythical: 'Mythical',
};
const lineIndexOf = id => studioState.D.lines.findIndex(l => l.id === id);
export const selectedLineIndex = () => {
  const D = studioState.D;
  let i = lineIndexOf(studioState.sel.line);
  if (i < 0) {
    i = 0;
    studioState.sel.line = D.lines[0] && D.lines[0].id;
  }
  return i;
};
document.addEventListener('input', ev => {
  const s = ev.target.closest('[data-search]');
  if (!s) return;
  studioState.sel[s.dataset.search] = s.value;
  const box = document.getElementById(s.dataset.list);
  if (box && SIDE_LIST_RENDERERS[s.dataset.search]) {
    box.innerHTML = SIDE_LIST_RENDERERS[s.dataset.search]();
    mountPreviews(box);
  }
});
const SIDE_LIST_RENDERERS = {};
/* ================= BILLIONAIRES ================= */
function baseStats(L, st) {
  const D = studioState.D;
  if (L.base && L.base[st]) return L.base[st];
  const tot = (D.rarities[L.rar] || D.rarities.common).totals,
    T = tot[Math.min(st, tot.length - 1)],
    sum = L.prof.reduce((a, b) => a + b, 0) || 1;
  return L.prof.map(w => Math.round((T * w) / sum));
}
SIDE_LIST_RENDERERS.lq = () => {
  const D = studioState.D,
    q = (studioState.sel.lq || '').toLowerCase(),
    cur = studioState.sel.line;
  return (
    D.lines
      .map((l, i) => ({ l, i }))
      .filter(
        ({ l }) =>
          !q ||
          l.id.includes(q) ||
          l.names.some(n => n.toLowerCase().includes(q)) ||
          l.types.flat().some(t => t.toLowerCase().includes(q))
      )
      .map(
        ({ l, i }) =>
          `<button class="lcard ${l.id === cur ? 'on' : ''}" data-act="pickLine" data-id="${l.id}"><span class="lno">${String(D.lines.slice(0, i).reduce((a, x) => a + x.names.length, 0) + 1).padStart(3, '0')}</span>${spritePreviewHTML({ sp: l.id + '0', still: 1, cls: 'thumb' })}<span class="lt"><b>${escapeHtml(l.names[0])}</b><small>${escapeHtml(l.names.slice(1).join(' → ')) || 'Does not evolve'}</small><span class="row">${[...new Set(l.types.flat())].map(typeChipHTML).join('')}</span></span></button>`
      )
      .join('') || '<p class="help">No matches.</p>'
  );
};
SECTIONS.billionaires = () => {
  const D = studioState.D,
    li = selectedLineIndex(),
    L = D.lines[li],
    p = `lines.${li}`,
    st = Math.min(studioState.sel.stage || 0, L.names.length - 1),
    sp = L.id + st,
    coat = studioState.sel.billyCoat || '';
  studioState.sel.stage = st;
  const stageTabs = L.names
    .map(
      (n, i) =>
        `<button class="seg ${i === st ? 'on' : ''}" data-act="stage" data-i="${i}">${STAGE_LABEL[i]}: ${escapeHtml(n)}</button>`
    )
    .join('');
  const prev = `<div class="prev-row"><figure>${spritePreviewHTML({ sp, view: 'front', coat, cls: 'big' })}<figcaption>Front (foes, Field Guide)</figcaption></figure><figure>${spritePreviewHTML({ sp, view: 'back', coat, cls: 'big' })}<figcaption>Back (your side in battle)</figcaption></figure></div>
  <div class="seg-row">${['attack', 'cast', 'hurt', 'cheer', 'buff', 'dizzy', 'faint'].map(a => `<button class="seg sm" data-act="anim" data-a="${a}">${a}</button>`).join('')}<span class="grow"></span><label class="fld inline"><span>Coat</span><select id="billyCoat"><option value="">None</option>${Object.entries(
    studioState.D.coats || {}
  )
    .map(
      ([k, c]) => `<option value="${escapeHtml(k)}" ${k === coat ? 'selected' : ''}>${escapeHtml(c.name || k)}</option>`
    )
    .join('')}</select></label></div>
  <div class="seg-row"><button class="btn primary" data-act="pixels" data-sp="${sp}">Edit pixels and skeleton</button><button class="btn" data-act="skeleton" data-sp="${sp}">Skeleton builder</button><button class="btn" data-act="wbsOpen" data-sp="${sp}" title="Its pictures’ boxes, pivots and draw order on the Art workbench (Part mode)">Parts on the workbench</button><button class="btn" data-act="recolor" data-sp="${sp}">Recolor this stage…</button><button class="btn" data-act="bpFoe" data-sp="${sp}">See it in battle</button>${studioState.rigs[sp] ? '' : '<span class="warn">No skeleton for this stage: it can’t be drawn.</span>'}</div>`;
  const tsel = i => {
    const ts = L.types[st] || [];
    return `<label class="fld"><span>${i ? 'Second type' : 'Type'}</span><select data-p="${p}.types.${st}.${i}" data-k="sel" ${i ? 'data-opt="1"' : ''} data-rr="1">${i ? '<option value="">None</option>' : ''}${typeOptions(
      true
    )
      .map(([k, n]) => `<option value="${k}" ${ts[i] === k ? 'selected' : ''}>${n}</option>`)
      .join('')}</select></label>`;
  };
  const ident =
    grid(
      textField('Name', `${p}.names.${st}`, { max: 24 }),
      textField('Field Guide category', `${p}.cat.${st}`, { ph: 'Founder Billie' }),
      tsel(0),
      tsel(1),
      numberField('Height', `${p}.ht.${st}`, { unit: 'm', step: 0.1 }),
      numberField('Weight', `${p}.wt.${st}`, { unit: 'kg', step: 0.1 }),
      textField('Habitat', `${p}.hab.${st}`),
      textField('Diet', `${p}.diet.${st}`)
    ) +
    textField('Field notes', `${p}.bio.${st}`, {
      area: 1,
      help: 'Shown in the Field Guide and when it hatches or evolves.',
    }) +
    textField('Handwritten note', `${p}.note.${st}`, {
      area: 1,
      rows: 2,
      help: 'The red margin note in the Field Guide, visible after you catch one.',
    });
  const stats = statsCard(L, li) + musicCryCardHTML(L, li, st);
  const learn = `<table class="tbl"><thead><tr><th>At Lv</th><th>Move</th><th></th><th></th></tr></thead><tbody>${L.learn
    .map(([lv, mv], i) => {
      const M = D.moves[mv];
      return `<tr><td><input type="number" min="1" max="100" data-p="${p}.learn.${i}.0" data-k="num" value="${lv}"></td><td><select data-p="${p}.learn.${i}.1" data-k="sel" data-rr="1">${moveOptions()
        .map(([k, n]) => `<option value="${k}" ${k === mv ? 'selected' : ''}>${escapeHtml(n)}</option>`)
        .join(
          ''
        )}</select></td><td>${M ? `${typeChipHTML(M.t)} <small>${M.p ? M.p + ' power' : 'status'}</small>` : '<span class="warn">missing move</span>'}</td><td><button class="x" data-act="learnDel" data-i="${i}" title="Remove">✕</button></td></tr>`;
    })
    .join('')}</tbody></table>
  <div class="seg-row"><button class="btn" data-act="learnAdd">Add a move</button><button class="btn subtle" data-act="learnSort">Sort by level</button></div>`;
  const evo =
    L.names.length < 2
      ? '<p class="help">A single-stage Billie. Add a stage below to make it evolve.</p>'
      : L.names
          .slice(0, -1)
          .map((n, i) => evolutionRowHTML(L, li, i))
          .join('');
  const where = whereCard(L, li);
  return `<div class="split"><aside class="list-col"><div class="list-head"><input type="search" placeholder="Search name, id or type" data-search="lq" data-list="lineList" value="${escapeHtml(studioState.sel.lq || '')}"><button class="btn primary" data-act="newLine">+ New Billie</button></div><div class="llist" id="lineList">${SIDE_LIST_RENDERERS.lq()}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${escapeHtml(L.id)} · ${RARITY_LABELS[L.rar] || L.rar}</small><h2>${escapeHtml(L.names.join(' → '))}</h2></div><div class="seg-row"><button class="btn subtle" data-act="lineMove" data-d="-1" title="Earlier in the Field Guide">↑</button><button class="btn subtle" data-act="lineMove" data-d="1" title="Later in the Field Guide">↓</button><button class="btn subtle" data-act="lineDup">Duplicate</button><button class="btn danger" data-act="lineDel">Delete</button></div></div>
 <div class="seg-row tabs">${stageTabs}<button class="seg add" data-act="stageAdd" title="Add an evolution stage (copies the last stage’s art)">+ Stage</button>${L.names.length > 1 ? `<button class="seg" data-act="stageDel" title="Remove the last stage">− Last stage</button>` : ''}</div>
 ${card('Sprite', prev, { cls: 'sprite-card' })}${card(`${STAGE_LABEL[st]} details`, ident)}${stats}${card('Moves it learns', learn, { sub: 'Moves unlock when it reaches that level. It keeps the last ' + (D.rules.progression.moveSlots || 4) + ' it learned unless you choose.' })}
 ${card('Evolution', evo)}${where}</div></div>`;
};
function statsCard(L, li) {
  const D = studioState.D,
    p = `lines.${li}`,
    stats = D.stats,
    rows = L.names
      .map((n, st) => {
        const b = baseStats(L, st);
        return `<tr><th>${escapeHtml(n)}</th>${b.map(v => `<td>${v}</td>`).join('')}<td><b>${b.reduce((a, c) => a + c, 0)}</b></td></tr>`;
      })
      .join('');
  const table = `<table class="tbl stats" id="statTable"><thead><tr><th></th>${stats.map(s => `<th>${escapeHtml(s.name)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
  const body = L.base
    ? `<p class="help">Exact numbers for each stage. Rarity and the profile below are ignored.</p><table class="tbl stats"><thead><tr><th></th>${stats.map(s => `<th>${escapeHtml(s.name)}</th>`).join('')}</tr></thead><tbody>${L.names.map((n, st) => `<tr><th>${escapeHtml(n)}</th>${stats.map((s, k) => `<td><input type="number" min="1" max="255" data-p="${p}.base.${st}.${k}" data-k="num" value="${(L.base[st] || [])[k] ?? ''}"></td>`).join('')}</tr>`).join('')}</tbody></table><button class="btn subtle" data-act="baseOff">Go back to a balanced profile</button>`
    : grid(
        selectField(
          'Rarity',
          `${p}.rar`,
          Object.keys(D.rarities).map(k => [k, RARITY_LABELS[k] || k]),
          { rr: 1, help: 'Sets the total stat points per stage and the base catch rate.' }
        )
      ) +
      `<div class="sliders">${stats.map((s, k) => rangeField(s.name, `${p}.prof.${k}`, { min: 0.3, max: 1.8, step: 0.05, showKey: 'mul', show: v => (+v).toFixed(2) })).join('')}</div>${table}<button class="btn subtle" data-act="baseOn">Type exact numbers instead</button>`;
  return card('Stats', body, {
    sub: 'Higher weights shift points into that stat. Totals come from the rarity.',
    id: 'statsCard',
  });
}
studioState.hooks.billionaires = path => {
  const cry = path.match(/^lines\.(\d+)\.cry\./);
  if (cry) musicCryTidy(+cry[1]);
  const m = path.match(/^lines\.(\d+)\.types\.(\d+)\.(\d)$/);
  if (m) {
    const L = studioState.D.lines[+m[1]],
      a = L.types[+m[2]];
    L.types[+m[2]] = (a || []).filter(Boolean);
    if (!L.types[+m[2]].length) L.types[+m[2]] = ['None'];
  }
  if (/^lines\.\d+\.(prof|rar|base)/.test(path)) {
    const li = selectedLineIndex(),
      L = studioState.D.lines[li],
      t = $('#statTable');
    if (t && !L.base) {
      const tmp = document.createElement('div');
      tmp.innerHTML = statsCard(L, li);
      const n = tmp.querySelector('#statTable');
      if (n) t.replaceWith(n);
    }
  }
  if (/^lines\.\d+\.names\./.test(path)) {
    const box = $('#lineList');
    if (box) {
      box.innerHTML = SIDE_LIST_RENDERERS.lq();
      mountPreviews(box);
    }
  }
};
const EVOLUTION_KINDS = [
  ['lvl', 'Reaches a level'],
  ['item', 'Use an item on it'],
  ['donate', 'Give away items'],
  ['merge', 'Combine two'],
  ['idle', 'Rest a day in storage'],
  ['streak', 'Win battles in a row as lead'],
  ['rename', 'New nickname'],
];
function evolutionRowHTML(L, li, i) {
  const p = `lines.${li}.evo.${i}`,
    e = (L.evo || [])[i] || { k: 'lvl', at: 16 },
    k = e.k;
  const D = studioState.D;
  const f = {
    lvl: () => numberField('At level', `${p}.at`, { min: 2, max: 100, step: 1 }),
    item: () =>
      selectField('Item', `${p}.item`, itemOptions()) +
      numberField('Minimum level', `${p}.min`, { min: 1, max: 100, step: 1 }),
    donate: () =>
      numberField('Items to give away', `${p}.n`, { min: 1, max: 50, step: 1 }) +
      numberField('Minimum level', `${p}.min`, { min: 1, max: 100, step: 1 }),
    merge: () => numberField('Minimum level', `${p}.min`, { min: 1, max: 100, step: 1 }),
    idle: () =>
      numberField('Time in storage', `${p}.ms`, { unit: 'hours', scale: 3600000, step: 1 }) +
      numberField('Minimum level', `${p}.min`, { min: 1, max: 100, step: 1 }),
    streak: () =>
      numberField('Wins in a row', `${p}.n`, { min: 1, max: 30, step: 1 }) +
      numberField('Minimum level', `${p}.min`, { min: 1, max: 100, step: 1 }),
    rename: () => numberField('Minimum level', `${p}.min`, { min: 1, max: 100, step: 1 }),
  };
  return `<div class="evo-row"><span class="evo-a">${escapeHtml(L.names[i])} <b>→</b> ${escapeHtml(L.names[i + 1])}</span>${grid(selectField('How', `${p}.k`, EVOLUTION_KINDS, { rr: 1 }), (f[k] || f.lvl)())}</div>`;
}
function whereCard(L, li) {
  const D = studioState.D,
    ids = L.names.map((n, i) => L.id + i),
    rows = [];
  for (const [pk, P] of Object.entries(D.pools))
    P.list.forEach(([id, w], j) => {
      if (ids.includes(id))
        rows.push(
          `<tr><td>Wild · ${escapeHtml(poolName(pk))}</td><td>${escapeHtml(speciesName(id))}</td><td><input type="number" min="1" data-p="pools.${pk}.list.${j}.1" data-k="num" value="${w}"></td><td>${poolPercent(P, j)}</td><td><button class="x" data-act="whereDel" data-kind="pools" data-k="${pk}" data-j="${j}">✕</button></td></tr>`
        );
    });
  for (const [ek, E] of Object.entries(D.eggs))
    E.list.forEach(([id, w], j) => {
      if (ids.includes(id))
        rows.push(
          `<tr><td>Egg · ${ek} km</td><td>${escapeHtml(speciesName(id))}</td><td><input type="number" min="1" data-p="eggs.${ek}.list.${j}.1" data-k="num" value="${w}"></td><td>${poolPercent(E, j)}</td><td><button class="x" data-act="whereDel" data-kind="eggs" data-k="${ek}" data-j="${j}">✕</button></td></tr>`
        );
    });
  const add = `<div class="seg-row"><select id="whereTo">${Object.keys(D.pools)
    .map(k => `<option value="pools:${k}">Wild · ${escapeHtml(poolName(k))}</option>`)
    .join('')}${Object.keys(D.eggs)
    .map(k => `<option value="eggs:${k}">Egg · ${k} km</option>`)
    .join(
      ''
    )}</select><select id="whereSp">${ids.map((id, i) => `<option value="${id}">${escapeHtml(L.names[i])}</option>`).join('')}</select><button class="btn" data-act="whereAdd">Add</button></div>`;
  return card(
    'Where to find it',
    `${rows.length ? `<table class="tbl"><thead><tr><th>Where</th><th>Stage</th><th>Weight</th><th>Chance</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="help">Not found in the wild or in eggs yet. Trainers can still use it.</p>'}${add}`,
    { sub: 'Weight is relative to everything else in that list.' }
  );
}
const poolName = k => {
  const r = studioState.D.locations.filter(x => x.pool === k).map(x => x.name);
  return r.length ? `${k} (${r.join(', ')})` : k;
};
const poolPercent = (P, j) => {
  const t = P.list.reduce((a, b) => a + (+b[1] || 0), 0);
  return t ? Math.round(((+P.list[j][1] || 0) / t) * 100) + '%' : '—';
};
ACTIONS.pickLine = d => {
  studioState.sel.line = d.id;
  studioState.sel.stage = 0;
  render();
};
ACTIONS.stage = d => {
  studioState.sel.stage = +d.i;
  render();
};
ACTIONS.anim = d => {
  $$('canvas.spr-prev.big').forEach(c => playSpritePreviewAction(c, d.a));
};
ACTIONS.pixels = d => openPixelEditor(d.sp, 'front');
ACTIONS.skeleton = d => openSkeleton(d.sp, 'front');
ACTIONS.learnAdd = () => {
  const L = studioState.D.lines[selectedLineIndex()],
    last = L.learn[L.learn.length - 1];
  L.learn.push([Math.min(100, (last ? last[0] : 1) + 4), Object.keys(studioState.D.moves)[0]]);
  changed();
  render();
};
ACTIONS.learnDel = d => {
  const L = studioState.D.lines[selectedLineIndex()];
  L.learn.splice(+d.i, 1);
  changed();
  render();
};
ACTIONS.learnSort = () => {
  const L = studioState.D.lines[selectedLineIndex()];
  L.learn.sort((a, b) => a[0] - b[0]);
  changed();
  render();
};
ACTIONS.baseOn = () => {
  const L = studioState.D.lines[selectedLineIndex()];
  L.base = L.names.map((n, st) => baseStats(L, st).slice());
  changed();
  render();
};
ACTIONS.baseOff = async () => {
  if (!(await ask('Switch back to rarity totals and the stat profile? The exact numbers will be lost.', 'Switch back')))
    return;
  delete studioState.D.lines[selectedLineIndex()].base;
  changed();
  render();
};
ACTIONS.whereDel = d => {
  studioState.D[d.kind][d.k].list.splice(+d.j, 1);
  changed();
  render();
};
ACTIONS.whereAdd = () => {
  const [kind, k] = $('#whereTo').value.split(':'),
    sp = $('#whereSp').value;
  studioState.D[kind][k].list.push([sp, 15]);
  changed();
  render();
};
ACTIONS.lineMove = d => {
  const D = studioState.D,
    i = selectedLineIndex(),
    j = i + +d.d;
  if (j < 0 || j >= D.lines.length) return;
  [D.lines[i], D.lines[j]] = [D.lines[j], D.lines[i]];
  changed();
  render();
};
ACTIONS.lineDel = async () => {
  const D = studioState.D,
    i = selectedLineIndex(),
    L = D.lines[i],
    ids = L.names.map((n, k) => L.id + k);
  const refs = refsTo(ids);
  if (
    !(await ask(
      `Delete ${escapeHtml(L.names.join(' → '))}? ${refs.length ? `It’s used in ${refs.length} place${refs.length > 1 ? 's' : ''} (${escapeHtml(refs.slice(0, 4).join('; '))}${refs.length > 4 ? '…' : ''}); those entries are removed too. ` : ''}Its art files stay on disk.`,
      'Delete'
    ))
  )
    return;
  D.lines.splice(i, 1);
  ids.forEach(id => {
    delete studioState.rigs[id];
  });
  removeRefs(ids);
  studioState.sel.line = (D.lines[Math.max(0, i - 1)] || {}).id;
  changed();
  changed(true);
  render();
};
function refsTo(ids) {
  const D = studioState.D,
    out = [];
  for (const [k, P] of Object.entries(D.pools)) if (P.list.some(([id]) => ids.includes(id))) out.push('wild pool ' + k);
  for (const [k, E] of Object.entries(D.eggs))
    if (E.list.some(([id]) => ids.includes(id))) out.push(D.eggs[k].need / 1000 + ' km egg');
  for (const [k, T] of Object.entries(D.trainers || {}))
    if (T.team.some(e => ids.includes(e.sp))) out.push('trainer ' + T.name);
  if (Object.values(D.rules.start.rival).some(v => ids.includes(v))) out.push('rival picks');
  return out;
}
function removeRefs(ids) {
  const D = studioState.D;
  for (const P of Object.values(D.pools)) P.list = P.list.filter(([id]) => !ids.includes(id));
  for (const E of Object.values(D.eggs)) E.list = E.list.filter(([id]) => !ids.includes(id));
  for (const T of Object.values(D.trainers || {})) T.team = T.team.filter(e => !ids.includes(e.sp));
  for (const k in D.rules.start.rival) if (ids.includes(D.rules.start.rival[k])) delete D.rules.start.rival[k];
  D.rules.start.starters = D.rules.start.starters.filter(l => !ids.includes(l + '0'));
}
/* ---------- copying art between species (new billionaires, new stages, duplicates) ---------- */
async function cloneSpeciesArt(fromId, toId, hue = 0, sat = 1) {
  studioState.rigs[toId] = clone(studioState.rigs[fromId]);
  for (const view of ['front', 'back']) {
    const src = await atlasGet(atlasPath(fromId, view)).catch(() => null);
    if (!src) continue;
    markArt(atlasPath(toId, view), hueShift(src, hue, sat));
  }
}
ACTIONS.stageAdd = async () => {
  const D = studioState.D,
    L = D.lines[selectedLineIndex()],
    n = L.names.length;
  if (n >= 4) return toast('Four stages is the most a line can have.');
  const from = L.id + (n - 1),
    to = L.id + n;
  if (!studioState.rigs[from]) return toast('The last stage has no skeleton to copy.', 'err');
  await cloneSpeciesArt(from, to, 25);
  const keys = ['names', 'cat', 'ht', 'wt', 'hab', 'diet', 'bio', 'note'];
  keys.forEach(k => {
    L[k] = L[k] || [];
    L[k][n] =
      k === 'names'
        ? L.names[n - 1] + ' Prime'
        : k === 'ht' || k === 'wt'
          ? +(L[k][n - 1] * 1.4).toFixed(1)
          : L[k][n - 1];
  });
  L.types[n] = (L.types[n - 1] || ['None']).slice();
  L.evo = L.evo || [];
  L.evo[n - 1] = { k: 'lvl', at: Math.min(100, ((L.evo[n - 2] || {}).at || 16) + 20) };
  if (L.base) L.base[n] = L.base[n - 1].map(v => Math.round(v * 1.2));
  const tot = D.rarities[L.rar].totals;
  if (tot.length <= n) tot.push(Math.round(tot[tot.length - 1] * 1.15));
  changed();
  changed(true);
  studioState.sel.stage = n;
  render();
  toast('Stage added with recolored art from the previous stage. Edit its pixels next.');
};
ACTIONS.stageDel = async () => {
  const D = studioState.D,
    L = D.lines[selectedLineIndex()],
    n = L.names.length - 1,
    id = L.id + n;
  if (
    !(await ask(
      `Remove ${escapeHtml(L.names[n])}? Anything that uses it is updated. Its art files stay on disk.`,
      'Remove stage'
    ))
  )
    return;
  ['names', 'cat', 'ht', 'wt', 'hab', 'diet', 'bio', 'note', 'types'].forEach(k => {
    if (Array.isArray(L[k])) L[k].length = Math.min(L[k].length, n);
  });
  if (L.evo) L.evo.length = Math.min(L.evo.length, n - 1);
  if (L.base) L.base.length = n;
  delete studioState.rigs[id];
  removeRefs([id]);
  studioState.sel.stage = n - 1;
  changed();
  changed(true);
  render();
};
ACTIONS.lineDup = async () => {
  const D = studioState.D,
    L = D.lines[selectedLineIndex()],
    id = uniqueKey(L.id, k => D.lines.some(l => l.id === k));
  const N = clone(L);
  N.id = id;
  N.names = N.names.map(n => n + ' II');
  for (let i = 0; i < L.names.length; i++) await cloneSpeciesArt(L.id + i, id + i, 40);
  D.lines.splice(selectedLineIndex() + 1, 0, N);
  studioState.sel.line = id;
  changed();
  changed(true);
  render();
  toast('Duplicated with shifted colors.');
};
ACTIONS.recolor = async d => {
  const sp = d.sp;
  const srcs = {};
  for (const v of ['front', 'back']) srcs[v] = await atlasGet(atlasPath(sp, v)).catch(() => null);
  const html = `<p class="help">Rotate the colors of both sheets of this stage. Skin tones and greys are kept unless you untick that.</p><div class="prev-row"><canvas id="rcPrev" class="spr-prev big"></canvas></div>
  <label class="fld range"><span>Hue <output id="rcH">0°</output></span><input type="range" id="rcHue" min="-180" max="180" value="0"></label><label class="fld range"><span>Saturation <output id="rcS">100%</output></span><input type="range" id="rcSat" min="0" max="200" value="100"></label><label class="fld chk"><input type="checkbox" id="rcSkin" checked><span>Keep skin tones</span></label>`;
  const show = () => {
    const h = +$('#rcHue').value,
      s = +$('#rcSat').value / 100,
      k = $('#rcSkin').checked;
    $('#rcH').textContent = h + '°';
    $('#rcS').textContent = Math.round(s * 100) + '%';
    const R = rigFor(sp, 'front');
    if (!R) return;
    const tmp = hueShift(srcs.front, h, s, k);
    const c = $('#rcPrev');
    c.width = R.BW;
    c.height = R.BH;
    const meta = studioState.rigs[sp].front,
      cut = ([x, y, w, h2]) => {
        const q = makeCanvas(w, h2);
        q.getContext('2d').drawImage(tmp, x, y, w, h2, 0, 0, w, h2);
        return q;
      },
      imgs = meta.imgs.map(e => {
        const n = Object.keys(e.f);
        if (n.length === 1 && n[0] === 'main') return { ox: e.ox, oy: e.oy, c: cut(e.f.main) };
        const v = {};
        n.forEach(m => (v[m] = cut(e.f[m])));
        return { ox: e.ox, oy: e.oy, v, c: v.idle || v[n[0]] };
      });
    const R2 = { ...R, bones: meta.bones.map(b => Object.assign({}, b, { img: b.i >= 0 ? imgs[b.i] : null })) };
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    drawRig(x, R2, rigPose(null, 0, 0, 1), 'front');
  };
  setTimeout(() => {
    ['rcHue', 'rcSat', 'rcSkin'].forEach(id => $('#' + id).addEventListener('input', show));
    show();
  }, 30);
  const ok = await dialog('Recolor ' + escapeHtml(speciesName(sp)), html, [
    { l: 'Cancel', v: false },
    {
      l: 'Apply',
      c: 'primary',
      f: () => ({ h: +$('#rcHue').value, s: +$('#rcSat').value / 100, k: $('#rcSkin').checked }),
    },
  ]);
  if (!ok) return;
  for (const v of ['front', 'back']) if (srcs[v]) markArt(atlasPath(sp, v), hueShift(srcs[v], ok.h, ok.s, ok.k));
  render();
  toast('Recolored. Save to game to keep it.');
};
/* ---------- new billionaire wizard ---------- */
ACTIONS.newLine = async () => {
  const D = studioState.D;
  const blanks = Object.keys(BODY_TEMPLATES);
  const html = `<p class="help">Start from a <b>blank body</b> to design a new shape from scratch, or copy an existing Billie’s skeleton, animations and recolored art. Either way it works in the game right away.</p>
 <label class="fld"><span>Start from</span><select id="nwFrom"><optgroup label="Blank body (new shape)">${blanks.map(k => `<option value="blank:${k}">${k} · ${PLAN_INFO[k]}</option>`).join('')}</optgroup><optgroup label="Copy a Billie">${D.lines.map(l => `<option value="${l.id}">${escapeHtml(l.names.join(' → '))}</option>`).join('')}</optgroup></select></label><div class="prev-row"><canvas id="nwPrev" class="spr-prev big"></canvas></div>
 <div class="grid"><label class="fld"><span>Name of the first stage</span><input id="nwName" type="text" maxlength="24" placeholder="Venturo"></label><label class="fld"><span>Type</span><select id="nwType">${typeOptions()
   .map(([k, n]) => `<option>${k}</option>`)
   .join('')}</select></label>
 <label class="fld"><span>Rarity</span><select id="nwRar">${Object.keys(D.rarities)
   .filter(k => k !== 'starter')
   .map(k => `<option value="${k}">${RARITY_LABELS[k] || k}</option>`)
   .join('')}</select></label>
 <label class="fld nw-copy"><span>Color shift <output id="nwH">60°</output></span><input id="nwHue" type="range" min="-180" max="180" value="60"></label>
 <label class="fld nw-blank"><span>Body color</span><input id="nwCol" type="color" value="#6FA8DC"></label><label class="fld nw-blank"><span>Stages</span><select id="nwStages"><option value="1">1 (doesn’t evolve)</option><option value="2">2</option><option value="3" selected>3</option></select></label></div>`;
  const tmpId = '__nwprev';
  const draw = (R, meta, sheet) => {
    const c = $('#nwPrev');
    if (!c || !R) return;
    c.width = R.BW;
    c.height = R.BH;
    const cut = ([x, y, w, hh]) => {
        const q = makeCanvas(w, hh);
        q.getContext('2d').drawImage(sheet, x, y, w, hh, 0, 0, w, hh);
        return q;
      },
      imgs = meta.imgs.map(e => {
        const n = Object.keys(e.f);
        if (n.length === 1 && n[0] === 'main') return { ox: e.ox, oy: e.oy, c: cut(e.f.main) };
        const v = {};
        n.forEach(m => (v[m] = cut(e.f[m])));
        return { ox: e.ox, oy: e.oy, v, c: v.idle || v[n[0]] };
      });
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    drawRig(
      x,
      { ...R, bones: meta.bones.map(b => Object.assign({}, b, { img: b.i >= 0 ? imgs[b.i] : null })) },
      neutralPose(),
      'front'
    );
  };
  const show = () => {
    const from = $('#nwFrom').value,
      h = +$('#nwHue').value,
      blank = from.startsWith('blank:');
    $$('.nw-copy').forEach(e => (e.hidden = blank));
    $$('.nw-blank').forEach(e => (e.hidden = !blank));
    $('#nwH').textContent = h + '°';
    if (blank) {
      const saved = { rigs: studioState.rigs[tmpId], dirty: new Map(studioState.artDirty) };
      makeBlankBody(tmpId, from.slice(6), $('#nwCol').value);
      const R = rigFor(tmpId, 'front');
      draw(R, studioState.rigs[tmpId].front, loadedAtlas(atlasPath(tmpId, 'front')));
      delete studioState.rigs[tmpId];
      for (const k of [...studioState.artDirty.keys()])
        if (k.includes(tmpId)) {
          studioState.artDirty.delete(k);
          ATLAS_CACHE.delete(k);
        }
      updateTopBar();
      return;
    }
    atlasGet(atlasPath(from + '0', 'front'))
      .then(src => {
        const R = rigFor(from + '0', 'front');
        if (!R) return;
        draw(R, studioState.rigs[from + '0'].front, hueShift(src, h));
      })
      .catch(() => {});
  };
  setTimeout(() => {
    $('#nwFrom').addEventListener('change', () => {
      const v = $('#nwFrom').value;
      if (!v.startsWith('blank:')) {
        const L = D.lines.find(l => l.id === v);
        $('#nwType').value = (L.types[0] || [studioState.D.types[0].id])[0];
      }
      show();
    });
    $('#nwHue').addEventListener('input', show);
    $('#nwCol').addEventListener('input', show);
    show();
  }, 30);
  const r = await dialog(
    'New Billie',
    html,
    [
      { l: 'Cancel', v: false },
      {
        l: 'Create',
        c: 'primary',
        f: m => {
          const name = $('#nwName').value.trim();
          if (!name) {
            $('#nwName').focus();
            toast('Give it a name first.');
            return false;
          }
          return {
            from: $('#nwFrom').value,
            name,
            type: $('#nwType').value,
            rar: $('#nwRar').value,
            hue: +$('#nwHue').value,
            col: $('#nwCol').value,
            stages: +$('#nwStages').value,
          };
        },
      },
    ],
    'wide'
  );
  if (!r) return;
  const id = uniqueKey(r.name, k => D.lines.some(l => l.id === k) || !!studioState.rigs[k + '0']);
  let N;
  if (r.from.startsWith('blank:')) {
    const plan = r.from.slice(6),
      n = r.stages,
      sfx = ['', 'ster', 'zilla'],
      mv = Object.keys(D.moves).filter(k => D.moves[k].t === r.type);
    N = {
      id,
      names: Array.from({ length: n }, (_, i) => r.name + sfx[i]),
      types: Array.from({ length: n }, () => [r.type]),
      prof: [1, 1, 1, 1, 1, 1],
      rar: r.rar,
      learn: [[1, 'handshake'], ...mv.slice(0, 4).map((k, i) => [1 + i * 6, k])],
      cat: Array.from({ length: n }, () => `${r.name} Billie`),
      ht: Array.from({ length: n }, (_, i) => +(0.6 + i * 0.5).toFixed(1)),
      wt: Array.from({ length: n }, (_, i) => 10 + i * 30),
      hab: Array.from({ length: n }, () => 'Somewhere expensive'),
      diet: Array.from({ length: n }, () => 'Other people’s money'),
      bio: Array.from({ length: n }, () => 'A brand-new Billie. Write its field notes here.'),
      note: Array.from({ length: n }, () => ''),
      evo: Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({ k: 'lvl', at: 16 + i * 20 })),
    };
    for (let i = 0; i < n; i++) makeBlankBody(id + i, plan, r.col, [1, 1.18, 1.36][i]);
  } else {
    const T = D.lines.find(l => l.id === r.from);
    toast('Copying art…');
    N = clone(T);
    N.id = id;
    N.rar = r.rar;
    N.names = T.names.map((n, i) => (i === 0 ? r.name : r.name + (i === 1 ? 'ster' : 'zilla')));
    N.types = T.types.map(() => [r.type]);
    N.cat = T.cat.map(() => `${r.name} Billie`);
    N.bio = T.bio.map(() => 'A brand-new Billie. Write its field notes here.');
    N.note = T.note.map(() => '');
    delete N.catchRate;
    for (let i = 0; i < T.names.length; i++) await cloneSpeciesArt(T.id + i, id + i, r.hue);
  }
  const firstMyth = D.lines.findIndex(l => l.rar === 'mythical');
  D.lines.splice(firstMyth < 0 ? D.lines.length : firstMyth, 0, N);
  const pool = Object.keys(D.pools)[0];
  D.pools[pool].list.push([id + '0', 10]);
  studioState.sel.line = id;
  studioState.sel.stage = 0;
  changed();
  changed(true);
  render();
  toast(`${r.name} created and added to the ${pool} pool. Paint it, then save to game.`, 'ok');
  if (r.from.startsWith('blank:')) setTimeout(() => openSkeleton(id + '0', 'front'), 300);
};
/* ================= MOVES ================= */
const MOVE_CATEGORIES = [
  ['H', 'Physical · Attack vs Defense'],
  ['S', 'Special · Sp. Atk vs Sp. Def'],
  ['X', 'Status · no damage'],
];
SIDE_LIST_RENDERERS.mq = () => {
  const D = studioState.D,
    q = (studioState.sel.mq || '').toLowerCase(),
    cur = studioState.sel.move;
  return Object.entries(D.moves)
    .filter(([k, m]) => !q || k.includes(q) || m.n.toLowerCase().includes(q) || m.t.toLowerCase().includes(q))
    .sort((a, b) => a[1].t.localeCompare(b[1].t) || a[1].n.localeCompare(b[1].n))
    .map(
      ([k, m]) =>
        `<button class="lcard slim ${k === cur ? 'on' : ''}" data-act="pickMove" data-id="${k}">${typeChipHTML(m.t)}<span class="lt"><b>${escapeHtml(m.n)}</b><small>${m.c === 'X' ? 'Status' : (m.p || 'varies') + ' power'} · ${m.a || 100}%</small></span></button>`
    )
    .join('');
};
SECTIONS.moves = () => {
  const D = studioState.D;
  if (!D.moves[studioState.sel.move]) studioState.sel.move = Object.keys(D.moves)[0];
  const k = studioState.sel.move,
    M = D.moves[k],
    p = `moves.${k}`,
    fx = M.fx || {},
    users = D.lines.filter(L => L.learn.some(([, m]) => m === k));
  const st = (obj, base, label) =>
    `<div class="stagebox"><b>${label}</b>${statOptions()
      .map(
        ([s, n]) =>
          `<label class="mini"><span>${escapeHtml(n)}</span><input type="number" min="-6" max="6" step="1" data-p="${base}.${s}" data-k="num" data-opt="1" value="${obj && obj[s] != null ? obj[s] : ''}" placeholder="0"></label>`
      )
      .join('')}</div>`;
  const fxB = `<div class="fxgrid">
  ${selectField('Causes a status', `${p}.fx.status`, statusOptions(), { none: 'Nothing', opt: 1, help: 'Paralyzed: may lose turns, slower. Asleep: can’t act for 2–4 turns, easier to catch. Burned: loses HP each turn, weaker Attack.' })}
  ${numberField('Status chance', `${p}.fx.chance`, { unit: '%', opt: 1, min: 1, max: 100, step: 1, help: 'For damaging moves. Leave empty for always.' })}
  ${st(fx.tgtStage, `${p}.fx.tgtStage`, 'Changes the target’s stats')}${st(fx.selfStage, `${p}.fx.selfStage`, 'Changes its own stats')}
  ${numberField('Self change chance', `${p}.fx.selfChance`, { unit: '%', opt: 1, min: 1, max: 100, step: 1, help: 'Chance for the self effects above and below.' })}
  ${selectField('Causes its own status', `${p}.fx.selfStatus`, statusOptions(), { none: 'Nothing', opt: 1 })}
  ${checkboxField('Hits every foe in double and Alpha battles', `${p}.fx.spread`, { num: 1, help: 'A little weaker for it (Rules → Moves that hit every foe).' })}  ${numberField('Heals itself', `${p}.fx.heal`, { opt: 1, min: 0, max: 1, step: 0.05, help: 'Fraction of its max HP (0.5 = half).' })}${numberField('Drains', `${p}.fx.drain`, { opt: 1, min: 0, max: 1, step: 0.05, help: 'Heals this fraction of the damage dealt.' })}
  ${numberField('Extra critical stages', `${p}.fx.crit`, { opt: 1, min: 0, max: 3, step: 1 })}${numberField('Misses cost', `${p}.fx.missCost`, { opt: 1, min: 0, max: 1, step: 0.05, help: 'Fraction of its own max HP lost on a miss (crash).' })}
  ${selectField(
    'Power changes with',
    `${p}.fx.vary`,
    [
      ['dyn', 'Target’s HP (more = stronger)'],
      ['short', 'Target’s missing HP (less = stronger)'],
    ],
    { none: 'Fixed power', opt: 1 }
  )}
  ${checkboxField('Blocks one attack (fails twice in a row)', `${p}.fx.protect`, { num: 1 })}${checkboxField('Delayed attack (lands a few turns later)', `${p}.fx.delay`, { num: 1 })}${checkboxField('Doubles each turn it’s used in a row', `${p}.fx.hold`, { num: 1 })}
  ${checkboxField('Confuses the target (it may hit itself)', `${p}.fx.hype`, { num: 1 })}${checkboxField(`Soak: turns the target ${escapeHtml(D.rules.battle.spinType)} type`, `${p}.fx.spin`, { num: 1 })}${checkboxField('Removes the target’s stat boosts', `${p}.fx.wipe`, { num: 1 })}${checkboxField('Fork: takes the target’s types for a few turns', `${p}.fx.copyTypes`, { num: 1 })}
  ${checkboxField('Robots: aims at a part the attacker picks', `${p}.fx.aim`, { num: 1, help: 'Phase 17. On a robot the player (or the computer) picks the arm or legs to hit.' })}${numberField('Robots: part damage ×', `${p}.fx.breaker`, { opt: 1, min: 0.5, max: 4, step: 0.25, help: 'A robot part it hits loses this many times the usual damage.' })}${numberField('Robots: repairs its parts', `${p}.fx.repair`, { opt: 1, min: 0, max: 1, step: 0.05, help: 'Fixes this share of each of its own parts’ HP (1 = all).' })}
  ${checkboxField('Scatters sharp stones on the other side', `${p}.fx.stones`, { num: 1 })}${checkboxField(`Starts a sandstorm (${escapeHtml(D.rules.battle.shockType)} moves hit harder)`, `${p}.fx.market`, { num: 1 })}</div>`;
  return `<div class="split"><aside class="list-col"><div class="list-head"><input type="search" placeholder="Search moves" data-search="mq" data-list="moveList" value="${escapeHtml(studioState.sel.mq || '')}"><button class="btn primary" data-act="moveNew">+ New move</button></div><div class="llist" id="moveList">${SIDE_LIST_RENDERERS.mq()}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${escapeHtml(k)}</small><h2>${escapeHtml(M.n)}</h2></div><div class="seg-row"><button class="btn" data-act="bpMove" data-id="${escapeHtml(k)}" title="Play this move on the battle stage">▶ Preview animation</button><button class="btn subtle" data-act="moveDup">Duplicate</button><button class="btn danger" data-act="moveDel">Delete</button></div></div>
 ${card('Basics', grid(textField('Name', `${p}.n`, { max: 28 }), selectField('Type', `${p}.t`, typeOptions(true), { rr: 1 }), selectField('Kind', `${p}.c`, MOVE_CATEGORIES, { rr: 1 }), numberField('Power', `${p}.p`, { opt: 1, min: 0, max: 250, step: 5, help: M.c === 'X' ? 'Status moves usually have no power.' : '' }), numberField('Accuracy', `${p}.a`, { unit: '%', min: 0, max: 100, step: 5, help: '0 means it never misses.' }), numberField('Priority', `${p}.pr`, { opt: 1, min: -3, max: 5, step: 1, help: 'Higher goes first. Guard uses 4.' })) + textField('Description', `${p}.d`, { area: 1, rows: 2 }))}
 ${card('Effects', fxB, { sub: 'Leave anything empty to switch it off.' })}
 ${card(
   'Learned by',
   users.length
     ? `<div class="chips">${users
         .map(
           L =>
             `<button class="tag" data-act="gotoLine" data-id="${L.id}">${escapeHtml(L.names[0])} at Lv ${L.learn
               .filter(([, m]) => m === k)
               .map(([lv]) => lv)
               .join(', ')}</button>`
         )
         .join('')}</div>`
     : '<p class="help">No Billie learns this yet. Add it from a Billie’s move list.</p>'
 )}</div></div>`;
};
studioState.hooks.moves = path => {
  const m = path.match(/^moves\.([^.]+)\.fx\.(tgtStage|selfStage)\./);
  if (m) {
    const o = studioState.D.moves[m[1]].fx[m[2]];
    if (o && !Object.values(o).some(v => v)) delete studioState.D.moves[m[1]].fx[m[2]];
  }
  const f = path.match(/^moves\.([^.]+)\.fx\./);
  if (f) {
    const M = studioState.D.moves[f[1]];
    if (M.fx && !Object.keys(M.fx).length) delete M.fx;
  }
  if (/^moves\.[^.]+\.n$/.test(path)) {
    const b = $('#moveList');
    if (b) b.innerHTML = SIDE_LIST_RENDERERS.mq();
  }
};
ACTIONS.pickMove = d => {
  studioState.sel.move = d.id;
  render();
};
ACTIONS.gotoLine = d => {
  openSection('billionaires', { line: d.id, stage: 0 });
};
ACTIONS.moveNew = () => {
  const D = studioState.D,
    k = uniqueKey('newmove', x => !!D.moves[x]);
  D.moves[k] = { n: 'New Move', t: 'None', c: 'H', p: 50, a: 100, d: 'Describe what it does.' };
  studioState.sel.move = k;
  changed();
  render();
};
ACTIONS.moveDup = () => {
  const D = studioState.D,
    k = uniqueKey(studioState.sel.move, x => !!D.moves[x]);
  D.moves[k] = clone(D.moves[studioState.sel.move]);
  D.moves[k].n += ' II';
  studioState.sel.move = k;
  changed();
  render();
};
ACTIONS.moveDel = async () => {
  const D = studioState.D,
    k = studioState.sel.move,
    users = D.lines.filter(L => L.learn.some(([, m]) => m === k));
  if (
    !(await ask(
      `Delete ${escapeHtml(D.moves[k].n)}?${users.length ? ` ${users.length} Billie${users.length > 1 ? 's' : ''} learn it; it’s removed from their lists.` : ''}`,
      'Delete'
    ))
  )
    return;
  users.forEach(L => {
    L.learn = L.learn.filter(([, m]) => m !== k);
    if (!L.learn.length) L.learn = [[1, 'handshake']];
  });
  delete D.moves[k];
  studioState.sel.move = null;
  changed();
  render();
};
/* ================= TYPES ================= */
const PASSIVES = [
  ['', 'No ability'],
  ['slipstream', 'Slipstream: switches out once per battle without losing the turn'],
  ['wildmind', 'Wild Mind: damage swings wildly'],
  ['regrowth', 'Regrowth: restores a little HP each turn'],
  ['alloy', 'Alloy: +10% damage for each teammate of the same type'],
  ['livewire', 'Live Wire: higher critical-hit chance'],
  ['kindling', 'Kindling: Attack rises every turn it stays in'],
  ['partingroar', 'Parting Roar: when it faints, the next teammate in gets +1 Attack and Sp. Atk'],
  ['bedrock', 'Bedrock: holds on at 1 HP from full once a battle; not hurt by sharp stones'],
  ['undertow', 'Undertow: its moves of this type hit harder at a third of its HP or less'],
];
/* Studio plan T6.3: an icon cut from the loaded icon atlas by CSS (scaled, pixelated), so a first open of Types does
   not encode a PNG per particle icon (toDataURL took most of its 0.5-2.7 s); iconURL while the atlas is not loaded */
function iconSpriteHTML(key, scale, alt) {
  const im = ART_CACHE.img[ICON_ATLAS],
    r = ARTMAN.icons[key];
  if (!r || !im || !im.naturalWidth) return `<img src="${iconURL(key, scale)}" alt="${escapeHtml(alt)}">`;
  return `<span class="pix" role="img" aria-label="${escapeHtml(alt)}" style="display:inline-block;width:${r[2] * scale}px;height:${r[3] * scale}px;background:url('${im.src}') -${r[0] * scale}px -${r[1] * scale}px / ${im.naturalWidth * scale}px ${im.naturalHeight * scale}px no-repeat;image-rendering:pixelated"></span>`;
}
const FX_ICONS = [
  'bit',
  'up',
  'vcoin',
  'gem',
  'drop',
  'cbox',
  'coin',
  'bubble',
  'bolt',
  'dollar',
  'spark',
  'star',
  'brick',
  'pow',
  'heart',
  'plus',
  'excl',
  'sheet',
  'zz',
  'down',
];
SECTIONS.types = () => {
  const D = studioState.D,
    T = D.types;
  const matrix = `<div class="mx-wrap"><table class="mx"><thead><tr><th class="corner">Attack ↓ / Defend →</th>${T.map(t => `<th>${typeChipHTML(t.id)}</th>`).join('')}</tr></thead><tbody>${T.map(
    (a, i) =>
      `<tr><th>${typeChipHTML(a.id)}</th>${T.map(b => {
        const s = a.strong.includes(b.id),
          w = a.weak.includes(b.id);
        return `<td><button class="mxc ${s ? 's' : w ? 'w' : ''}" data-act="mx" data-a="${i}" data-b="${escapeHtml(b.id)}" title="${a.id} → ${b.id}">${s ? '2×' : w ? '½' : '·'}</button></td>`;
      }).join('')}</tr>`
  ).join(
    ''
  )}</tbody></table></div><p class="help">Click a cell to cycle normal → super effective (2×) → not very effective (½×).</p>`;
  const rows = T.map(
    (
      t,
      i
    ) => `<div class="type-row">${typeChipHTML(t.id)}${grid(textField('Name', `types.${i}.id`, { max: 14, help: 'Renaming updates every move, Billie and rule that uses it.' }), colorField('Color', `types.${i}.color`), colorField('Text color', `types.${i}.text`), selectField('Ability', `types.${i}.passive`, PASSIVES), textField('Ability name', `types.${i}.passiveName`, { max: 20, help: 'What the player reads in the Guide and in battle.' }), textField('What it does', `types.${i}.passiveText`, { area: 1, rows: 2, help: 'One sentence for the Guide.' }))}
  <div class="fxpick"><span>Battle particles</span>${FX_ICONS.map(k => `<button class="icb ${(t.fx || []).includes(k) ? 'on' : ''}" data-act="typeFx" data-i="${i}" data-k="${k}" title="${k}">${iconSpriteHTML(k, 2, k)}</button>`).join('')}</div><button class="btn danger subtle" data-act="typeDel" data-i="${i}">Delete type</button></div>`
  ).join('');
  return `<div class="ed-col solo"><div class="ed-head"><h2>Types</h2><button class="btn primary" data-act="typeNew">+ New type</button></div>${card('Matchups', matrix)}${card('Types', rows + `<div class="type-row">${typeChipHTML('None')}${grid(colorField('Normal color', 'untyped.color'), colorField('Normal text', 'untyped.text'))}</div>`, { sub: 'Each type can have one ability. Abilities and their numbers are tuned under Rules → Battle.' })}</div>`;
};
ACTIONS.mx = d => {
  const t = studioState.D.types[+d.a],
    b = d.b;
  const s = t.strong.includes(b),
    w = t.weak.includes(b);
  t.strong = t.strong.filter(x => x !== b);
  t.weak = t.weak.filter(x => x !== b);
  if (!s && !w) t.strong.push(b);
  else if (s) t.weak.push(b);
  changed();
  render();
};
ACTIONS.typeFx = d => {
  const t = studioState.D.types[+d.i];
  t.fx = t.fx || [];
  const k = d.k;
  t.fx = t.fx.includes(k) ? t.fx.filter(x => x !== k) : t.fx.concat(k);
  changed();
  render();
};
ACTIONS.typeNew = () => {
  const D = studioState.D,
    id = uniqueKey('New', k => D.types.some(t => t.id.toLowerCase() === k));
  D.types.push({
    id: id[0].toUpperCase() + id.slice(1),
    color: '#7A6AB0',
    text: '#FFFFFF',
    strong: [],
    weak: [],
    passive: '',
    fx: ['spark', 'star'],
  });
  changed();
  render();
};
ACTIONS.typeDel = async d => {
  const D = studioState.D,
    t = D.types[+d.i];
  if (
    !(await ask(`Delete the ${escapeHtml(t.id)} type? Moves of this type become Normal and Billies lose it.`, 'Delete'))
  )
    return;
  renameTypeIn(D, t.id, null);
  D.types.splice(+d.i, 1);
  changed();
  render();
};
studioState.hooks.types = (path, v) => {
  const m = path.match(/^types\.(\d+)\.id$/);
  if (m) {
    const t = studioState.D.types[+m[1]];
    const old = studioState._typeOld || null;
  }
};
document.addEventListener('focusin', ev => {
  const p = ev.target.dataset && ev.target.dataset.p;
  if (p && /^types\.\d+\.id$/.test(p)) ev.target.dataset.old = ev.target.value;
});
document.addEventListener('change', ev => {
  const el = ev.target,
    p = el.dataset && el.dataset.p;
  if (p && /^types\.\d+\.id$/.test(p)) {
    const old = el.dataset.old,
      nu = el.value.trim();
    if (old && nu && old !== nu) {
      if (studioState.D.types.filter(t => t.id === nu).length > 1) {
        toast('Another type already has that name.', 'err');
        writePath(p, old);
        el.value = old;
        return;
      }
      renameTypeIn(studioState.D, old, nu);
      changed();
      render();
    }
  }
});
/* ================= ITEMS & PYRAMIDS ================= */
const ITEM_ICONS = Object.keys(ARTMAN.icons)
  .filter(k => k.startsWith('i_'))
  .map(k => k.slice(2));
SECTIONS.items = () => {
  const D = studioState.D;
  const items = Object.entries(D.items)
    .map(([k, I]) => {
      const p = `items.${k}`;
      return `<div class="item-row"><div class="item-ic">${I.img ? `<img src="../game/art/${escapeHtml(I.img)}" width="40" height="40" class="pix">` : `<img src="${iconURL('i_' + (I.icon || k), 3)}" class="pix" alt="">`}<small class="mono">${escapeHtml(k)}</small></div>
  <div>${grid(
    textField('Name', `${p}.n`, { max: 24 }),
    numberField('Shop price (Moneys)', `${p}.price`, { min: 0, step: 10 }),
    checkboxField('Sold in the Shop', `${p}.mint`, { help: 'Untick to make it a town-shop special.' }),
    selectField(
      'Icon',
      `${p}.icon`,
      ITEM_ICONS.map(i => [i, i]),
      { rr: 1 }
    )
  )}
  ${grid(numberField('Restores HP', `${p}.hp`, { opt: 1, min: 0, step: 5 }), numberField('Restores everyone', `${p}.hpAll`, { opt: 1, min: 0, step: 5, help: 'Heals the whole team at once.' }), selectField('Cures', `${p}.cure`, [['any', 'Any status'], ...statusOptions()], { none: 'Nothing', opt: 1 }), numberField('Revives at', `${p}.revive`, { opt: 1, min: 0, max: 1, step: 0.05, help: 'Fraction of max HP after fainting (1 = full).' }), checkboxField('Evolution item (not used in battle)', `${p}.evoItem`, { num: 1 }), numberField('Repairs robot parts', `${p}.repair`, { opt: 1, min: 0, max: 1, step: 0.05, help: 'Phase 17: fixes this share of each part of one robot (1 = all).' }))}
  ${textField('Description', `${p}.d`, { area: 1, rows: 2 })}<div class="seg-row"><button class="btn subtle" data-act="itemImg" data-k="${k}">Upload a custom icon</button>${I.img ? `<button class="btn subtle" data-act="itemImgOff" data-k="${k}">Use an atlas icon</button>` : ''}<span class="grow"></span><button class="btn danger subtle" data-act="itemDel" data-k="${k}">Delete</button></div></div></div>`;
    })
    .join('');
  const pyramids = Object.entries(D.pyramids)
    .map(([k, C]) => {
      const p = `pyramids.${k}`;
      return `<div class="item-row"><div class="item-ic"><img src="${escapeHtml(artPicSrc(`coins/${k}_32.png`))}" width="40" height="40" class="pix" onerror="this.style.opacity=.2"><small class="mono">${escapeHtml(k)}</small></div><div>${pyramidArtHTML(k)}${grid(textField('Name', `${p}.n`), numberField('Catch multiplier', `${p}.m`, { min: 0, max: 10, step: 0.1, help: '0 means it always catches.' }), numberField('Shop price (Moneys)', `${p}.price`, { min: 0, step: 10, help: '0 means it can’t be bought.' }), numberField('Badges needed', `${p}.need`, { opt: 1, min: 0, max: 8, step: 1 }))}${textField('Description', `${p}.d`, { area: 1, rows: 2 })}</div></div>`;
    })
    .join('');
  return `<div class="ed-col solo"><div class="ed-head"><h2>Items & pyramids</h2><button class="btn primary" data-act="itemNew">+ New item</button></div>${card('Items', items, { sub: 'An item can combine effects, like the Full Remedy (cure + heal).' })}${card('Pyramids', pyramids, { sub: 'Each pyramid has two icons, art/coins/<id>_16.png and _32.png, each drawn at its own size (never scaled), and a 3D model (art/coins/<id>.json, thrown in battle), which is not edited here. tools/build-pyramids.py drew them all: running it again draws over edits made here.' })}</div>`;
};
/* SA-2a: a pyramid's two icons at their own size and larger, each with Edit pixels (Done comes back here) */
function pyramidArtHTML(k) {
  return `<div class="seg-row pyr-art">${[16, 32]
    .map(n => {
      const rel = `coins/${k}_${n}.png`,
        src = escapeHtml(artPicSrc(rel));
      return `<figure class="pyr-fig"><span class="seg-row"><img class="pix" src="${src}" width="${n}" height="${n}" alt=""><img class="pix" src="${src}" width="${n * (n === 16 ? 4 : 2)}" height="${n * (n === 16 ? 4 : 2)}" alt=""></span><figcaption>${n} px <button class="btn sm" data-act="pyrPaint" data-p="art/${escapeHtml(rel)}">Edit pixels</button></figcaption></figure>`;
    })
    .join('')}</div>`;
}
ACTIONS.pyrPaint = d => artPaint(d.p, { label: 'Items & pyramids', fn: () => openSection('items') });
ACTIONS.itemNew = () => {
  const D = studioState.D,
    k = uniqueKey('item', x => !!D.items[x]);
  D.items[k] = { n: 'New Item', price: 200, hp: 30, d: 'Restores 30 HP.', icon: 'potion', mint: true };
  changed();
  render();
};
ACTIONS.itemDel = async d => {
  const D = studioState.D;
  if (!(await ask(`Delete ${escapeHtml(D.items[d.k].n)}? It’s removed from shops and starting items.`, 'Delete')))
    return;
  delete D.items[d.k];
  Object.values(D.shops || {}).forEach(s => (s.stock = s.stock.filter(w => w.item !== d.k)));
  delete D.rules.start.items[d.k];
  changed();
  render();
};
ACTIONS.itemImg = async d => {
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f);
  if (c.width > 64 || c.height > 64) return toast('Use a small pixel icon (16×16 works best).', 'err');
  const path = `art/items/${d.k}.png`;
  markArt(path, c);
  studioState.D.items[d.k].img = path.slice(4);
  changed();
  render();
  toast('Icon added. Save to game to keep it.');
};
ACTIONS.itemImgOff = d => {
  delete studioState.D.items[d.k].img;
  changed();
  render();
};
/* ================= SHOPS ================= */
SECTIONS.shops = () => {
  const D = studioState.D,
    S = (D.shops = D.shops || {});
  const ks = Object.keys(S);
  if (!S[studioState.sel.shop]) studioState.sel.shop = ks[0];
  const k = studioState.sel.shop,
    sh = S[k];
  const list = ks
    .map(
      x =>
        `<button class="lcard slim ${x === k ? 'on' : ''}" data-act="pickShop" data-id="${x}"><span class="lt"><b>${escapeHtml(S[x].name)}</b><small>${S[x].kind === 'wardrobe' ? 'Boutique · ' : ''}${escapeHtml(
          D.locations
            .filter(r => r.shop === x || r.boutique === x)
            .map(r => r.name)
            .join(', ') || 'Not placed on the route'
        )}</small></span></button>`
    )
    .join('');
  if (!sh)
    return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="shopNew">+ New shop</button><button class="btn" data-act="boutiqueNew">+ New boutique</button></div></aside><div class="ed-col"><p class="help">No shops yet. Legacy: shops.json is the old world’s town shops; a run’s towns stock from the run rules (rules.json run.shop, in the Run Lab).</p></div></div>`;
  const wardrobe = sh.kind === 'wardrobe',
    p = `shops.${k}`,
    stock = (sh.stock || [])
      .map((w, i) => {
        const isC = !!w.coin,
          key = w.coin || w.item,
          base = isC ? (D.pyramids[key] || {}).price : (D.items[key] || {}).price;
        return `<tr><td><select data-act-sel="stockKind" data-i="${i}">${[
          ['item', 'Item'],
          ['coin', 'Pyramid'],
        ]
          .map(([v, n]) => `<option value="${v}" ${(isC ? 'coin' : 'item') === v ? 'selected' : ''}>${n}</option>`)
          .join('')}</select></td>
  <td><select data-p="${p}.stock.${i}.${isC ? 'coin' : 'item'}" data-k="sel" data-rr="1">${(isC ? pyramidOptions() : itemOptions()).map(([v, n]) => `<option value="${v}" ${v === key ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></td><td><input type="number" min="0" step="10" data-p="${p}.stock.${i}.price" data-k="num" data-opt="1" value="${w.price ?? ''}" placeholder="${base ?? ''}"></td><td><small>${base != null ? `Shop price: ${base} Moneys` : ''}</small></td>
  <td><button class="x" data-act="stockMove" data-i="${i}" data-d="-1">↑</button><button class="x" data-act="stockDel" data-i="${i}">✕</button></td></tr>`;
      })
      .join('');
  return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="shopNew">+ New shop</button><button class="btn" data-act="boutiqueNew">+ New boutique</button></div><div class="llist">${list}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${escapeHtml(k)}</small><h2>${escapeHtml(sh.name)}</h2></div><button class="btn danger" data-act="shopDel">Delete</button></div>
 ${card('Shop', `<div class="keeper"><div class="person-prev">${personPreviewHTML(sh.who)}</div><div>${grid(textField('Shop name', `${p}.name`), textField('Keeper', `${p}.keeper`), selectField('Keeper’s look', `${p}.who`, peopleOptions(), { rr: 1, help: 'Edit looks under Looks.' }))}${textField('Greeting', `${p}.greeting`, { area: 1, rows: 2 })}${textField('Thank-you lines (one per line)', '@thanks.' + k, { area: 1, rows: 3, ph: 'Leave empty for the default lines.' })}</div></div>`)}
 ${
   wardrobe
     ? card(
         'Clothes and hair',
         `<div class="wd-shoplist">${
           Object.entries((D.wardrobe || {}).items || {})
             .filter(([i, it]) => it.shop === k)
             .map(
               ([i, it]) =>
                 `<button class="chk-chip" data-act="wdGo" data-k="${escapeHtml(i)}">${escapeHtml(it.name)} · ${formatThousands(it.price || 0)} Moneys</button>`
             )
             .join('') || '<span class="help">Nothing yet.</span>'
         }</div>`,
         {
           sub: 'A boutique sells wardrobe items: pick “Sold at” for an item under Wardrobe. Players try things on in the dressing room and buy what they wear.',
         }
       )
     : card(
         'Stock',
         `<table class="tbl"><thead><tr><th>Kind</th><th>What</th><th>Price (Moneys)</th><th></th><th></th></tr></thead><tbody>${stock}</tbody></table><div class="seg-row"><button class="btn" data-act="stockAdd">Add to the shelves</button></div>`,
         { sub: 'Leave the price empty to use the normal Shop price. Pyramids that need badges stay locked here too.' }
       )
 }
 ${card(
   'Where it is',
   `<p class="help">Open on: ${escapeHtml(
     D.locations
       .filter(r => r.shop === k || r.boutique === k)
       .map(r => r.name)
       .join(', ') || 'nowhere yet'
   )}. Choose a shop or boutique for a stop under World & encounters.</p>`
 )}</div></div>`;
};
/* thank-you lines are stored as an array; edit them as text (Studio plan F20: their own prefix, @thanks.; lore's
   lists of lines have @lines.) */
pathPrefix(
  '@thanks.',
  k => {
    const s = studioState.D.shops[k];
    return s && s.thanks ? s.thanks.join('\n') : '';
  },
  (k, v) => {
    const s = studioState.D.shops[k];
    const a = String(v || '')
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);
    if (a.length) s.thanks = a;
    else delete s.thanks;
  }
);
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.actSel === 'stockKind') {
    const w = studioState.D.shops[studioState.sel.shop].stock[+el.dataset.i];
    if (el.value === 'coin') {
      delete w.item;
      w.coin = Object.keys(studioState.D.pyramids)[0];
    } else {
      delete w.coin;
      w.item = Object.keys(studioState.D.items)[0];
    }
    delete w.price;
    changed();
    render();
  }
});
ACTIONS.pickShop = d => {
  studioState.sel.shop = d.id;
  render();
};
ACTIONS.stockAdd = () => {
  studioState.D.shops[studioState.sel.shop].stock.push({ item: Object.keys(studioState.D.items)[0] });
  changed();
  render();
};
ACTIONS.stockDel = d => {
  studioState.D.shops[studioState.sel.shop].stock.splice(+d.i, 1);
  changed();
  render();
};
ACTIONS.stockMove = d => {
  const a = studioState.D.shops[studioState.sel.shop].stock,
    i = +d.i,
    j = i - 1;
  if (j < 0) return;
  [a[i], a[j]] = [a[j], a[i]];
  changed();
  render();
};
ACTIONS.boutiqueNew = () => {
  const D = studioState.D,
    k = uniqueKey('boutique', x => !!(D.shops || {})[x]);
  D.shops = D.shops || {};
  D.shops[k] = {
    name: 'New Boutique',
    keeper: 'Shopkeeper',
    who: Object.keys(D.people)[0],
    kind: 'wardrobe',
    greeting: 'Try anything on!',
  };
  studioState.sel.shop = k;
  changed();
  render();
};
ACTIONS.shopNew = () => {
  const D = studioState.D,
    k = uniqueKey('shop', x => !!(D.shops || {})[x]);
  D.shops = D.shops || {};
  D.shops[k] = {
    name: 'New Shop',
    keeper: 'Shopkeeper',
    who: Object.keys(D.people)[0],
    greeting: 'Welcome in!',
    stock: [{ item: Object.keys(D.items)[0] }],
  };
  studioState.sel.shop = k;
  changed();
  render();
};
ACTIONS.shopDel = async () => {
  const D = studioState.D,
    k = studioState.sel.shop;
  if (!(await ask(`Delete ${escapeHtml(D.shops[k].name)}? Route stops that used it lose their shop.`, 'Delete')))
    return;
  delete D.shops[k];
  D.locations.forEach(r => {
    if (r.shop === k) delete r.shop;
    if (r.boutique === k) delete r.boutique;
  });
  studioState.sel.shop = null;
  changed();
  render();
};
/* ================= PEOPLE =================
   Rivals, shopkeepers and the professor are dressed from the wardrobe, like players. */
function personLook(k) {
  const P = studioState.D.people[k];
  if (!P) return null;
  if (!P.look) P.look = cleanLook(lookFromOld(P));
  return P.look;
}
function personPreviewHTML(who) {
  if (!studioState.D.people[who]) return '<p class="help">Unknown look.</p>';
  try {
    const f = personSheet(who, 'front'),
      b = personSheet(who, 'back');
    return `<span class="spr slow tr-por" style="width:${Math.round((132 * f.w) / f.h)}px;height:132px"><img src="${f.url}" alt=""></span><span class="spr slow tr-por" style="width:${Math.round((99 * b.w) / b.h)}px;height:99px"><img src="${b.url}" alt=""></span>`;
  } catch (e) {
    return '';
  }
}
SECTIONS.people = () => {
  const D = studioState.D,
    ks = Object.keys(D.people);
  if (!D.people[studioState.sel.person]) studioState.sel.person = ks[0];
  const k = studioState.sel.person,
    P = D.people[k],
    W = D.wardrobe;
  /* every person has a look (person.schema.json); opening the section never writes to the data (Studio plan F14) */
  const L = P.look || cleanLook(null),
    p = `people.${k}.look`;
  /* an item's colours not set yet show the ones it is drawn with, without writing them (Studio plan F14) */
  const shown = cleanLook(L);
  afterRender(() => {
    if (typeof loadWardrobe === 'function' && !wardrobeEditor.loaded)
      loadWardrobe().then(() => {
        forgetPersonLooks();
        const b = $('#personPrev');
        if (b) b.innerHTML = personPreviewHTML(k);
      });
  });
  const used = [
    ...Object.values(D.trainers || {})
      .filter(T => T.who === k)
      .map(T => 'trainer ' + T.name),
    ...Object.values(D.shops || {})
      .filter(s => s.who === k)
      .map(s => s.keeper),
  ];
  const list = ks
    .map(
      x =>
        `<button class="lcard slim ${x === k ? 'on' : ''}" data-act="pickPerson" data-id="${x}"><span class="lt"><b>${escapeHtml(x)}</b></span></button>`
    )
    .join('');
  const wear = W.slots
    .map(s => {
      const id = (L.wear || {})[s.id],
        it = id && W.items[id],
        worn = it ? wornColors(shown, id) : [];
      return `<div class="wd-prow">${selectField(
        s.name,
        `${p}.wear.${s.id}`,
        Object.entries(W.items)
          .filter(([i, x]) => x.slot === s.id)
          .map(([i, x]) => [i, x.name]),
        { none: s.empty ? 'None' : undefined, opt: s.empty, rr: 1 }
      )}
  ${it ? `<div class="grid colors">${it.colors.map((c, ci) => (it.slot === 'hair' || it.slot === 'eyes' || (it.link && it.link[String(ci + 1)]) ? '' : colorField(c[0], `${p}.colors.${id}.${ci}`, { def: worn[ci] }))).join('')}</div>` : ''}</div>`;
    })
    .join('');
  return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="personNew">+ New look</button></div><div class="llist">${list}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><h2>${escapeHtml(k)}</h2><small>${used.length ? 'Used by ' + escapeHtml(used.join(', ')) : k === 'boy' || k === 'girl' ? 'Old default player look (players create their own now)' : 'Not used yet'}</small></div>${['boy', 'girl', 'chosen'].includes(k) ? '' : '<button class="btn danger" data-act="personDel">Delete</button>'}</div>
 ${card(
   'Look',
   `<div class="keeper"><div class="person-prev" id="personPrev">${personPreviewHTML(k)}</div><div>${grid(colorField('Skin', `${p}.skin`), colorField('Hair', `${p}.hair`), colorField('Eyes', `${p}.eyes`))}
   <div class="grid">${bodySliders()
     .map(s =>
       rangeField(s.name, `${p}.body.${s.k}`, {
         min: s.min,
         max: s.max,
         step: 0.01,
         def: s.def,
         show: v => (+v).toFixed(2),
       })
     )
     .join('')}</div></div></div>`,
   { sub: 'Dressed from the Wardrobe; edit the clothes themselves there.' }
 )}
 ${card('Wearing', `<div class="wd-pgrid">${wear}</div>`)}</div></div>`;
};
studioState.hooks.people = path => {
  if (/^people\./.test(path)) {
    forgetPersonLooks();
    const b = $('#personPrev');
    if (b) b.innerHTML = personPreviewHTML(studioState.sel.person);
  }
};
ACTIONS.pickPerson = d => {
  studioState.sel.person = d.id;
  render();
};
ACTIONS.personNew = () => {
  const D = studioState.D,
    k = uniqueKey('npc', x => !!D.people[x]);
  D.people[k] = { look: clone(personLook('chosen') || cleanLook(null)) };
  studioState.sel.person = k;
  changed();
  render();
};
ACTIONS.personDel = async () => {
  const D = studioState.D,
    k = studioState.sel.person;
  if (
    !(await ask(`Delete the look “${escapeHtml(k)}”? Anyone using it falls back to Professor Chosen’s look.`, 'Delete'))
  )
    return;
  delete D.people[k];
  studioState.sel.person = null;
  changed();
  render();
};
ACTIONS.wdGo = d => {
  wardrobeEditor.sel = d.k;
  openSection('wardrobe');
};
/* ================= JOBS ================= */
SECTIONS.jobs = () => {
  const D = studioState.D;
  const rows = Object.entries(D.jobs)
    .map(([k, J]) => {
      const p = `jobs.${k}`,
        kind = J.out[0];
      return `<div class="item-row"><div class="item-ic"><small class="mono">${escapeHtml(k)}</small></div><div>${grid(
        textField('Job title', `${p}.n`),
        textField('Where', `${p}.where`),
        `<label class="fld"><span>Pays in</span><select data-act-sel="jobKind" data-k="${k}">${[
          ['item', 'Items'],
          ['coin', 'Pyramids'],
          ['se', 'Moneys'],
        ]
          .map(([v, n]) => `<option value="${v}" ${kind === v ? 'selected' : ''}>${n}</option>`)
          .join('')}</select></label>`,
        kind === 'se' ? '' : selectField('Which', `${p}.out.1`, kind === 'item' ? itemOptions() : pyramidOptions()),
        numberField('Amount per pay', `${p}.out.2`, { min: 1, step: 1 }),
        textField('Pay label', `${p}.pay`, { help: 'Shown when hiring, like “1 Potion”.' })
      )}${textField('What it did (after the Billie’s name)', `${p}.quip`, { help: '“Hoodini made 40 lattes. Most were wrong.”' })}<button class="btn danger subtle" data-act="jobDel" data-k="${k}">Delete job</button></div></div>`;
    })
    .join('');
  return `<div class="ed-col solo"><div class="ed-head"><h2>Jobs</h2><button class="btn primary" data-act="jobNew">+ New job</button></div>${card('Jobs', rows, { sub: 'Legacy: kept for the ranch (phase 12). The game has no jobs, so nothing here is used.' })}</div>`;
};
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.actSel === 'jobKind') {
    const J = studioState.D.jobs[el.dataset.k];
    const v = el.value;
    J.out = [
      v,
      v === 'se' ? 'se' : v === 'item' ? Object.keys(studioState.D.items)[0] : Object.keys(studioState.D.pyramids)[0],
      J.out[2] || 1,
    ];
    changed();
    render();
  }
});
ACTIONS.jobNew = () => {
  const D = studioState.D,
    k = uniqueKey('job', x => !!D.jobs[x]);
  D.jobs[k] = { n: 'New job', where: 'Somewhere', out: ['se', 'se', 100], pay: '$100', quip: 'worked a full shift.' };
  changed();
  render();
};
ACTIONS.jobDel = async d => {
  if (!(await ask('Delete this job? Anyone working it keeps working until the shift ends.', 'Delete'))) return;
  delete studioState.D.jobs[d.k];
  changed();
  render();
};
/* ================= TRAINERS ================= */
SECTIONS.trainers = () => {
  const D = studioState.D,
    TR = (D.trainers = D.trainers || {}),
    ks = Object.keys(TR);
  if (!TR[studioState.sel.trainer]) studioState.sel.trainer = ks[0];
  const k = studioState.sel.trainer,
    T = TR[k];
  const list = ks
    .map(
      x =>
        `<button class="lcard slim ${x === k ? 'on' : ''}" data-act="pickTrainer" data-id="${x}"><span class="lt"><b>${escapeHtml(TR[x].name)}</b><small>${TR[x].tutorial ? 'The opening' : TR[x].miniboss ? 'Mini-boss' : escapeHtml((D.locations[TR[x].node] || {}).name || '?')}${TR[x].seat ? ' · Badge' : ''}${TR[x].blocks ? ' · blocks the road' : ''}</small></span></button>`
    )
    .join('');
  if (!T)
    return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="trainerNew">+ New trainer</button></div></aside><div class="ed-col"></div></div>`;
  const p = `trainers.${k}`,
    spo = [
      ['@rival', 'Rival pick (beats the player’s starter)'],
      ['@rival1', 'Rival pick, evolved once'],
      ['@rival2', 'Rival pick, evolved twice'],
      ['robot', 'A robot (pick its gem and parts)'],
      ...speciesOptions(),
    ];
  const team = T.team
    .map(
      (e, i) =>
        `<tr><td><select data-p="${p}.team.${i}.sp" data-k="sel" data-rr="1">${spo.map(([v, n]) => `<option value="${v}" ${v === e.sp ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>${trainerRobotHTML(e, `${p}.team.${i}`)}</td><td><input type="number" min="1" max="100" data-p="${p}.team.${i}.lvl" data-k="num" value="${e.lvl}"></td><td><button class="x" data-act="teamDel" data-i="${i}">✕</button></td></tr>`
    )
    .join('');
  const seat = T.seat
    ? grid(
        textField('Badge id', `${p}.seat.id`, { help: 'Route gates refer to this.' }),
        textField('Title', `${p}.seat.title`),
        selectField('Pyramid shown', `${p}.seat.coin`, pyramidOptions())
      ) +
      `<div class="grid">${Object.keys(D.pyramids)
        .map(c => numberField(`${D.pyramids[c].n} reward`, `${p}.seat.pyramids.${c}`, { opt: 1, min: 0, step: 1 }))
        .join('')}${Object.keys(D.items)
        .map(it => numberField(`${D.items[it].n} reward`, `${p}.seat.items.${it}`, { opt: 1, min: 0, step: 1 }))
        .join('')}</div>` +
      textField('Reward text', `${p}.seat.rewardText`, { help: 'Read as “You earned 1,200 Moneys, …”.' }) +
      textField('What it unlocks', `${p}.seat.unlockText`, { area: 1, rows: 2 }) +
      `<button class="btn danger subtle" data-act="seatOff">Remove the badge</button>`
    : `<p class="help">Beating this trainer doesn’t award a badge.</p><button class="btn" data-act="seatOn">Award a badge</button>`;
  return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="trainerNew">+ New trainer</button></div><div class="llist">${list}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${escapeHtml(k)}</small><h2>${escapeHtml(T.name)}</h2></div><button class="btn danger" data-act="trainerDel">Delete</button></div>
 ${trainerRunHTML(k, T)}
 ${card(
   'Who and where',
   `<div class="keeper"><div class="person-prev">${personPreviewHTML(T.who)}</div><div>${grid(
     textField('Name', `${p}.name`),
     selectField('Look', `${p}.who`, peopleOptions(), { rr: 1 }),
     T.miniboss
       ? ''
       : selectField(
           'Stands at',
           `${p}.node`,
           D.locations.map((r, i) => [i, `${i + 1}. ${r.name}`]),
           { num: 1, rr: 1 }
         ),
     selectField(
       'Battle backdrop',
       `${p}.battleStage`,
       Object.entries(D.battleStages).map(([b, v]) => [b, v.name || b])
     ),
     numberField(T.miniboss ? 'Reward (Moneys), outside runs only' : 'Reward (Moneys)', `${p}.reward`, {
       min: 0,
       step: 50,
     }),
     selectField(
       'First-win egg',
       `${p}.egg`,
       Object.keys(D.eggs).map(e => [e, e + ' km']),
       { num: 1, none: 'None', opt: 1 }
     )
   )}
  ${checkboxField('Double battle: two of theirs against two of yours', `${p}.double`, { help: 'Needs at least two Billies on their team.' })}${selectField(
    'Companion beside them in the world',
    `${p}.pet`,
    [
      ['', 'Sometimes (decided by their name)'],
      ['true', 'Always: their first Billie'],
      ['false', 'Never'],
    ]
  )}
  ${checkboxField('Story battle only (the opening): stands on no stop, and losing costs nothing', `${p}.tutorial`, { rr: 1, help: 'Blake’s first battle, right after you choose your starter. Hazel gives tips during it.' })}${checkboxField('Mini-boss: stands on no stop (the runs’ mini-boss pool)', `${p}.miniboss`, { rr: 1, help: 'The eight badge leaders. A run picks its mini-bosses from them (roguelite track RL-13).' })}${checkboxField('Blocks the road until beaten', `${p}.blocks`, { rr: 1 })}${T.blocks ? grid(textField('Blocking headline', `${p}.blockTitle`), textField('Blocking text', `${p}.blockText`)) : ''}${textField('Hint before the battle', `${p}.hint`, { area: 1, rows: 2, opt: 1 })}</div></div>`
 )}
 ${card('Team', `<table class="tbl"><thead><tr><th>Billie</th><th>Lv</th><th></th></tr></thead><tbody>${team}</tbody></table><div class="seg-row"><button class="btn" data-act="teamAdd">Add a Billie</button></div>`, { sub: 'They send them out in this order.' })}
 ${card(
   'Dialogue',
   scriptField(
     'What they say before the battle: their script, one line each, two spaces per level (it ends with battle ' +
       k +
       ')',
     'trainer:' + k,
     { rows: 10 }
   ) +
     checkboxField('Runs up to you the first time you come where they wait', `${p}.runsUp`) +
     grid(
       conditionField('Only there when', `${p}.when`, 'trainer:' + k, 'when', {
         ph: 'always',
         help: 'A condition (docs/SCRIPTS.md), e.g. met_juniper and !rival0',
       }),
       conditionField('Gone when', `${p}.unless`, 'trainer:' + k, 'unless', { ph: 'never' })
     ) +
     grid(
       textField('When you win', `${p}.win`),
       textField('When you lose', `${p}.lose`),
       selectField(
         'Only turns up after you beat',
         `${p}.after`,
         Object.entries(D.trainers)
           .filter(([x]) => x !== k)
           .map(([x, t]) => [x, t.name + ' (' + x + ')']),
         { opt: 1, none: 'Always there' }
       )
     )
 )}
 ${card('Sandstorm', T.market ? grid(numberField('Lasts', `${p}.market.n`, { unit: 'turns', min: 1, max: 20, step: 1 })) + textField('Announcement', `${p}.marketText`, { area: 1, rows: 2 }) + '<button class="btn danger subtle" data-act="marketOff">No sandstorm</button>' : `<p class="help">The battle starts in clear weather.</p><button class="btn" data-act="marketOn">Start the battle in a sandstorm</button>`)}
 ${card('Badge', seat)}</div></div>`;
};
ACTIONS.pickTrainer = d => {
  studioState.sel.trainer = d.id;
  render();
};
/* phase 17: a trainer's robot: its gem and a part for each slot (robots.json). Picking "A robot" fills in the first
   of each; picking a Billie again drops them */
function trainerRobotHTML(e, p) {
  const R = studioState.D.robots || { parts: {}, gems: {} };
  if (e.sp !== 'robot') {
    if (e.robot) delete e.robot;
    return '';
  }
  const first = kind => (Object.entries(R.parts).find(([, P]) => P.slot === kind) || [])[0];
  if (!e.robot)
    e.robot = {
      gem: Object.keys(R.gems)[0],
      torso: first('torso'),
      armL: first('arm'),
      armR: first('arm'),
      legs: first('legs'),
    };
  const opts = (k, kind) =>
    (kind === 'gem' ? Object.entries(R.gems) : Object.entries(R.parts).filter(([, P]) => P.slot === kind))
      .map(
        ([id, P]) =>
          `<option value="${escapeHtml(id)}" ${e.robot[k] === id ? 'selected' : ''}>${escapeHtml(P.name)}</option>`
      )
      .join('');
  return `<div class="tr-robot">${[
    ['gem', 'gem', 'Gem'],
    ['torso', 'torso', 'Torso'],
    ['armL', 'arm', 'Left arm'],
    ['armR', 'arm', 'Right arm'],
    ['legs', 'legs', 'Legs'],
  ]
    .map(
      ([k, kind, l]) =>
        `<label class="mini"><span>${l}</span><select data-p="${p}.robot.${k}" data-k="sel">${opts(k, kind)}</select></label>`
    )
    .join('')}</div>`;
}
ACTIONS.teamAdd = () => {
  const T = studioState.D.trainers[studioState.sel.trainer];
  T.team.push({ sp: studioState.D.lines[0].id + '0', lvl: (T.team[T.team.length - 1] || { lvl: 10 }).lvl });
  changed();
  render();
};
ACTIONS.teamDel = d => {
  studioState.D.trainers[studioState.sel.trainer].team.splice(+d.i, 1);
  changed();
  render();
};
ACTIONS.seatOn = () => {
  const T = studioState.D.trainers[studioState.sel.trainer];
  const n = Object.values(studioState.D.trainers).filter(t => t.seat).length + 1;
  T.seat = {
    id: uniqueKey(T.name, k => Object.values(studioState.D.trainers).some(t => t.seat && t.seat.id === k)),
    title: `Badge ${n} of 8`,
    coin: 'gold_pyramid',
    pyramids: { capstone: 1 },
    items: {},
    rewardText: 'a Capstone',
    unlockText: '',
  };
  changed();
  render();
};
ACTIONS.seatOff = () => {
  studioState.D.trainers[studioState.sel.trainer].seat = null;
  changed();
  render();
};
ACTIONS.marketOn = () => {
  const T = studioState.D.trainers[studioState.sel.trainer];
  T.market = { k: 'sand', n: studioState.D.rules.battle.shockTurns || 5 };
  T.marketText = `The arena is caught in a sandstorm. ${studioState.D.rules.battle.shockType} moves hit harder, and everyone else takes a little damage each turn.`;
  changed();
  render();
};
ACTIONS.marketOff = () => {
  const T = studioState.D.trainers[studioState.sel.trainer];
  T.market = null;
  delete T.marketText;
  changed();
  render();
};
ACTIONS.trainerNew = () => {
  const D = studioState.D,
    k = uniqueKey('trainer', x => !!D.trainers[x]);
  D.trainers[k] = {
    name: 'New Trainer',
    who: Object.keys(D.people).find(p => !['boy', 'girl'].includes(p)) || 'chosen',
    battleStage: 'grass',
    node: 0,
    blocks: false,
    team: [{ sp: D.lines[0].id + '0', lvl: 8 }],
    reward: 300,
    egg: null,
    market: null,
    lines: ['“Let’s see what your team can do.”'],
    win: '“Well played.”',
    lose: '“Better luck next time.”',
    hint: '',
    seat: null,
  };
  studioState.sel.trainer = k;
  changed();
  render();
};
ACTIONS.trainerDel = async () => {
  const D = studioState.D,
    k = studioState.sel.trainer,
    T = D.trainers[k];
  if (
    !(await ask(
      `Delete ${escapeHtml(T.name)}?${T.seat ? ' Route gates that need this badge would stay locked, so they are opened.' : ''}`,
      'Delete'
    ))
  )
    return;
  if (T.seat)
    D.locations.forEach(r => {
      if (r.gate === T.seat.id) {
        delete r.gate;
        delete r.gateText;
      }
    });
  delete D.trainers[k];
  studioState.sel.trainer = null;
  changed();
  render();
};
/* studio track ST-0: preview a Billie in a coat (Coats section) */
document.addEventListener('change', ev => {
  if (ev.target && ev.target.id === 'billyCoat') {
    studioState.sel.billyCoat = ev.target.value;
    render();
  }
});
