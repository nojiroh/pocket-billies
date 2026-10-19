'use strict';
/* ================= POCKET BILLIES STUDIO · Coats (studio track ST-0) =================
   coats.json: a coat is a recolour of a Billie's art, in place of the old Golden sheets. Swap whole palette ramps
   (every shade of "ember" becomes the same shade of "indigo", art/next/palette.js), then exact colours; or give a
   species its own hand-painted sheet. How often a coat turns up in the wild, in eggs and on the line (empty: never).
   The preview recolours with the game's own code (game/js/logic/coats.js). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { coatColorMap, coatRecolor } from '../../game/js/logic/coats.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  ask,
  card,
  changed,
  dialog,
  grid,
  numberField,
  render,
  studioState,
  textField,
  toast,
} from './studio-app.js';
import {
  atlasGet,
  atlasPath,
  coatsChanged,
  downloadCanvas,
  fileToCanvas,
  markArt,
  pickFile,
  spritePreviewHTML,
} from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  coatArtHTML: [() => coatArtHTML, v => (coatArtHTML = v)],
  coatArtPath: [() => coatArtPath],
  coatEdit: [() => coatEdit],
  coatRampRows: [() => coatRampRows, v => (coatRampRows = v)],
  coatSwapRows: [() => coatSwapRows, v => (coatSwapRows = v)],
  coatsData: [() => coatsData],
  coatsSel: [() => coatsSel],
  coatsSpeciesList: [() => coatsSpeciesList, v => (coatsSpeciesList = v)],
  paletteRamps: [() => paletteRamps],
  rampSelect: [() => rampSelect, v => (rampSelect = v)],
  rampStrip: [() => rampStrip],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const coatsSel = () => studioState.sel;
const coatsData = () => studioState.D.coats || (studioState.D.coats = {});
const paletteRamps = () => (window.NW_PALETTE && window.NW_PALETTE.ramps) || {};
function coatsSpeciesList(D) {
  const out = [];
  for (const L of D.lines || []) (L.names || []).forEach((n, i) => out.push([L.id + i, n]));
  return out;
}
const rampStrip = r =>
  `<span class="coat-ramp">${(paletteRamps()[r] || []).map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
function rampSelect(cls, val, extra = '') {
  return `<select class="${cls}" ${extra}>${Object.keys(paletteRamps())
    .map(r => `<option value="${escapeHtml(r)}" ${r === val ? 'selected' : ''}>${escapeHtml(r)}</option>`)
    .join('')}</select>`;
}
function coatRampRows(id, C) {
  const rows = Object.entries(C.ramps || {})
    .map(
      ([a, b]) =>
        `<div class="coat-row">${rampSelect('coat-from', a, `data-coat="${id}" data-from="${escapeHtml(a)}"`)}${rampStrip(a)}<span class="coat-arrow">→</span><select data-p="coats.${id}.ramps.${a}" data-k="sel">${Object.keys(
          paletteRamps()
        )
          .map(r => `<option value="${escapeHtml(r)}" ${r === b ? 'selected' : ''}>${escapeHtml(r)}</option>`)
          .join(
            ''
          )}</select>${rampStrip(b)}<button class="btn sm subtle" data-act="coatRampDel" data-k="${escapeHtml(a)}" title="Stop swapping this ramp">✕</button></div>`
    )
    .join('');
  return `${rows || '<p class="help">No ramps swapped yet.</p>'}<button class="btn sm" data-act="coatRampAdd">+ Swap a ramp</button>`;
}
function coatSwapRows(id, C) {
  const rows = Object.entries(C.swap || {})
    .map(
      ([a, b]) =>
        `<div class="coat-row"><input type="color" class="coat-swap-from" data-coat="${id}" data-from="${escapeHtml(a)}" value="${escapeHtml(a)}"><code>${escapeHtml(a)}</code><span class="coat-arrow">→</span><input type="color" data-p="coats.${id}.swap.${a}" data-k="color" value="${escapeHtml(b)}"><code>${escapeHtml(b)}</code><button class="btn sm subtle" data-act="coatSwapDel" data-k="${escapeHtml(a)}" title="Remove this swap">✕</button></div>`
    )
    .join('');
  return `${rows || '<p class="help">No exact colours swapped. Use these for colours off the palette.</p>'}<button class="btn sm" data-act="coatSwapAdd">+ Swap a colour</button>`;
}
function coatArtHTML(id, C, sp) {
  const own = (C.art && C.art[sp]) || {};
  return ['front', 'back']
    .map(
      v =>
        `<div class="coat-row"><b>${v === 'front' ? 'Front' : 'Back'}</b>${
          own[v]
            ? `<code>${escapeHtml(own[v])}</code><button class="btn sm" data-act="coatArtDl" data-v="${v}">Download</button><button class="btn sm" data-act="coatArtUl" data-v="${v}">Upload</button><button class="btn sm subtle" data-act="coatArtDel" data-v="${v}">Use the recolour</button>`
            : `<span class="help">The recolour.</span><button class="btn sm" data-act="coatArtMake" data-v="${v}">Paint my own</button>`
        }</div>`
    )
    .join('');
}
SECTIONS.coats = () => {
  const D = studioState.D,
    coats = coatsData(),
    S = coatsSel(),
    ids = Object.keys(coats),
    list = coatsSpeciesList(D);
  if (!ids.includes(S.coat)) S.coat = ids[0];
  if (!list.some(([k]) => k === S.coatSp)) S.coatSp = list[0] && list[0][0];
  const side = `<div class="list-col"><div class="seg-row"><button class="btn sm primary" data-act="coatAdd">+ New coat</button></div>${ids
    .map(
      k =>
        `<button class="lcard ${k === S.coat ? 'on' : ''}" data-act="coatPick" data-id="${escapeHtml(k)}"><b>${escapeHtml(coats[k].name || k)}</b><small class="mono">${escapeHtml(k)}</small></button>`
    )
    .join('')}</div>`;
  if (!S.coat)
    return `<div class="split">${side}<div class="ed-col">${card('Coats', '<p class="help">No coats yet. A coat recolours a Billie’s art; add one to start.</p>')}</div></div>`;
  const id = S.coat,
    C = coats[id],
    p = `coats.${id}`,
    view = S.coatView || 'front';
  const pick = `<label class="fld"><span>Billie</span><select id="coatSp">${list.map(([k, n]) => `<option value="${escapeHtml(k)}" ${k === S.coatSp ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></label><div class="seg-row">${['front', 'back'].map(v => `<button class="seg ${v === view ? 'on' : ''}" data-act="coatView" data-v="${v}">${v === 'front' ? 'Front' : 'Back'}</button>`).join('')}</div>`;
  const preview = `<div class="prev-row"><figure>${spritePreviewHTML({ sp: S.coatSp, view, cls: 'big' })}<figcaption>Normal</figcaption></figure><figure>${spritePreviewHTML({ sp: S.coatSp, view, coat: id, cls: 'big' })}<figcaption>${escapeHtml(C.name || id)}</figcaption></figure></div>`;
  return `<div class="split">${side}<div class="ed-col"><div class="ed-head"><div><small class="mono">coats.json → ${escapeHtml(id)}</small><h2>${escapeHtml(C.name || id)}</h2><p class="sub">A recolour of every Billie’s art. Players see its name before the Billie’s: “a wild ${escapeHtml(C.name || id)} Emberox”.</p></div><button class="btn subtle" data-act="coatDel">Delete coat</button></div>
  ${card('Preview', pick + preview)}
  ${card('Name', grid(textField('Name', `${p}.name`, { max: 24 })))}
  ${card('Ramps', `<div id="coatRamps">${coatRampRows(id, C)}</div>`, { sub: 'Every shade of a palette ramp becomes the same shade of another. Art drawn a little off the palette follows the nearest shade.' })}
  ${card('Exact colours', `<div id="coatSwaps">${coatSwapRows(id, C)}</div>`, { sub: 'One colour to another, after the ramps.' })}
  ${card('How often', grid(numberField('In the wild: 1 in', `${p}.odds.wild`, { min: 2, step: 1, opt: 1, help: 'Empty: never' }), numberField('From eggs: 1 in', `${p}.odds.egg`, { min: 2, step: 1, opt: 1, help: 'Empty: never' }), numberField('On the line: 1 in', `${p}.odds.fish`, { min: 2, step: 1, opt: 1, help: 'Empty: never' })))}
  ${card(`Own picture for ${escapeHtml((list.find(([k]) => k === S.coatSp) || [])[1] || S.coatSp)}`, coatArtHTML(id, C, S.coatSp), { sub: 'A hand-painted sheet in place of the recolour, for this Billie only. It starts as the recolour; download it, paint it in any app, upload it back (same size).' })}
  </div></div>`;
};
studioState.hooks.coats = () => coatsChanged();
const coatEdit = f => {
  f(coatsData()[coatsSel().coat]);
  coatsChanged();
  changed();
  render();
};
ACTIONS.coatPick = d => {
  coatsSel().coat = d.id;
  render();
};
ACTIONS.coatView = d => {
  coatsSel().coatView = d.v;
  render();
};
ACTIONS.coatAdd = async () => {
  const name = await dialog(
    'New coat',
    '<label class="fld"><span>Name, as players see it</span><input type="text" id="coatName" maxlength="24" placeholder="Midnight"></label>',
    [
      { l: 'Cancel', v: null },
      { l: 'Add', c: 'primary', f: m => (m.querySelector('#coatName').value || '').trim() || false },
    ]
  );
  if (!name) return;
  const coats = coatsData();
  let id =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'coat';
  if (!/^[a-z]/.test(id)) id = 'c_' + id;
  while (coats[id]) id += '_2';
  coats[id] = { name: name.slice(0, 24), ramps: {} };
  coatsSel().coat = id;
  coatsChanged();
  changed();
  render();
};
ACTIONS.coatDel = async () => {
  const S = coatsSel(),
    C = coatsData()[S.coat];
  if (
    !C ||
    !(await ask(`Delete ${escapeHtml(C.name || S.coat)}? Billies already wearing it go back to normal.`, 'Delete'))
  )
    return;
  delete coatsData()[S.coat];
  S.coat = null;
  coatsChanged();
  changed();
  render();
};
ACTIONS.coatRampAdd = () =>
  coatEdit(C => {
    const R = (C.ramps = C.ramps || {}),
      free = Object.keys(paletteRamps()).find(r => !R[r]);
    if (free) R[free] = free;
  });
ACTIONS.coatRampDel = d => coatEdit(C => delete C.ramps[d.k]);
ACTIONS.coatSwapAdd = () =>
  coatEdit(C => {
    const S = (C.swap = C.swap || {});
    let c = '#000000';
    for (let i = 0; S[c]; i++) c = '#' + (i + 1).toString(16).padStart(6, '0');
    S[c] = c;
  });
ACTIONS.coatSwapDel = d => coatEdit(C => delete C.swap[d.k]);
/* the hand-painted sheet: next/coats/<species>_<coat>[_back].png, starting as the recolour */
const coatArtPath = (sp, id, v) => `next/coats/${sp}_${id}${v === 'back' ? '_back' : ''}.png`;
ACTIONS.coatArtMake = async d => {
  const S = coatsSel(),
    id = S.coat,
    sp = S.coatSp,
    base = await atlasGet(atlasPath(sp, d.v)).catch(() => null);
  if (!base) return toast('This Billie has no sheet for that view.', 'err');
  const c = makeCanvas(base.width, base.height),
    x = c.getContext('2d');
  x.drawImage(base, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height),
    pal = window.NW_PALETTE;
  coatRecolor(im.data, coatColorMap(coatsData()[id], pal), pal);
  x.putImageData(im, 0, 0);
  const path = coatArtPath(sp, id, d.v);
  markArt('art/' + path, c);
  coatEdit(C => {
    C.art = C.art || {};
    C.art[sp] = Object.assign(C.art[sp] || {}, { [d.v]: path });
  });
  toast('Your own sheet starts as the recolour. Download it, paint it, upload it back.');
};
ACTIONS.coatArtDel = d =>
  coatEdit(C => {
    const sp = coatsSel().coatSp;
    if (!C.art || !C.art[sp]) return;
    delete C.art[sp][d.v];
    if (!Object.keys(C.art[sp]).length) delete C.art[sp];
    if (!Object.keys(C.art).length) delete C.art;
  });
ACTIONS.coatArtDl = async d => {
  const S = coatsSel(),
    path = coatsData()[S.coat].art[S.coatSp][d.v],
    c = await atlasGet('art/' + path).catch(() => null);
  if (c) downloadCanvas(c, path.split('/').pop());
};
ACTIONS.coatArtUl = async d => {
  const S = coatsSel(),
    path = coatsData()[S.coat].art[S.coatSp][d.v],
    f = await pickFile('image/png');
  if (!f) return;
  const up = await fileToCanvas(f),
    base = await atlasGet(atlasPath(S.coatSp, d.v)).catch(() => null);
  if (base && (up.width !== base.width || up.height !== base.height))
    return toast(`That picture is ${up.width}×${up.height}; the sheet is ${base.width}×${base.height}.`, 'err');
  markArt('art/' + path, up);
  coatsChanged();
  render();
};
document.addEventListener('change', ev => {
  const t = ev.target;
  if (!t) return;
  if (t.id === 'coatSp') {
    coatsSel().coatSp = t.value;
    render();
  } else if (t.classList.contains('coat-from')) {
    /* a ramp row's first ramp changed: the swap moves to the new key */
    coatEdit(C => {
      const to = C.ramps[t.dataset.from];
      delete C.ramps[t.dataset.from];
      C.ramps[t.value] = to;
    });
  } else if (t.classList.contains('coat-swap-from')) {
    coatEdit(C => {
      const to = C.swap[t.dataset.from];
      delete C.swap[t.dataset.from];
      C.swap[t.value.toUpperCase()] = to;
    });
  }
});
