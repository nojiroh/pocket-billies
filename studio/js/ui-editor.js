'use strict';
/* ================= POCKET BILLIES STUDIO · UI look (UI track, UI-3) =================
   game/data/uiTheme.json, the look of the game's menus: colours (light and dark side by side, each text colour with
   how well it reads), the glass, depth and drop shadows, the shapes, space, type and motion. Works like the Engine
   section: dials in groups, ↺ on a dial, Reset on a group, presets, Hold to compare. Set the look for the whole game,
   or colours and shapes for one screen (uiTheme.json overrides). The dials are a table (game/js/logic/ui-dials.js).

   The preview is the UI gallery (studio/gallery.html) in a frame: the Studio's own page uses the same variable names
   (--line, --text2...), so the game's theme sheet can't go on it. Every change is handed to the frame at once, and
   to an open game tab half a second later (studioBroadcast).

   The whole game's look always holds every value, so its ↺ goes back to the value last saved (or loaded); on a
   screen, ↺ takes the screen's own value away and the dial follows the game again. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  fieldSelector,
  findFlash,
  uiInspect,
  uiInspectMount,
  uiInspectOutline,
  uiInspectPanel,
  uiOverlays,
  uiOverlaysSoon,
  uiRulesHTML,
  uiRulesShow,
} from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { UI_CONTRAST, UI_SCREENS, mergeLook, screenLook, uiRatio, uiThemeLook } from '../../game/js/logic/ui-theme.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  UI_FAMILY_LABELS,
  UI_LAYERS,
  uiCount,
  uiDiffCount,
  uiGet,
  uiGrade,
  uiPresetId,
  uiPresetValues,
  uiPrune,
  uiScopeGroups,
  uiScopePath,
} from '../../game/js/logic/ui-dials.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  changed,
  clone,
  commit,
  dialog,
  fieldOutputId,
  openSection,
  readPath,
  render,
  sectionShown,
  studioState,
  toast,
  writePath,
} from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  UI_VIEWS: [() => UI_VIEWS],
  findUi: [() => findUi, v => (findUi = v)],
  mountUiPreview: [() => mountUiPreview, v => (mountUiPreview = v)],
  refreshUiSettings: [() => refreshUiSettings, v => (refreshUiSettings = v)],
  uiAABadge: [() => uiAABadge, v => (uiAABadge = v)],
  uiAfterEdit: [() => uiAfterEdit, v => (uiAfterEdit = v)],
  uiBase: [() => uiBase],
  uiBeforeNow: [() => uiBeforeNow, v => (uiBeforeNow = v)],
  uiColorHTML: [() => uiColorHTML, v => (uiColorHTML = v)],
  uiColorsHTML: [() => uiColorsHTML, v => (uiColorsHTML = v)],
  uiCompare: [() => uiCompare, v => (uiCompare = v)],
  uiData: [() => uiData],
  uiDialHTML: [() => uiDialHTML, v => (uiDialHTML = v)],
  uiDialState: [() => uiDialState, v => (uiDialState = v)],
  uiDone: [() => uiDone, v => (uiDone = v)],
  uiEditor: [() => uiEditor],
  uiFamiliesHTML: [() => uiFamiliesHTML, v => (uiFamiliesHTML = v)],
  uiFormat: [() => uiFormat],
  uiFrameLoaded: [() => uiFrameLoaded, v => (uiFrameLoaded = v)],
  uiGroupCount: [() => uiGroupCount, v => (uiGroupCount = v)],
  uiGroupHTML: [() => uiGroupHTML, v => (uiGroupHTML = v)],
  uiKept: [() => uiKept],
  uiKeptFrame: [() => uiKeptFrame, v => (uiKeptFrame = v)],
  uiKeptSync: [() => uiKeptSync, v => (uiKeptSync = v)],
  uiLayersHTML: [() => uiLayersHTML, v => (uiLayersHTML = v)],
  uiLevelName: [() => uiLevelName],
  uiLookTo: [() => uiLookTo, v => (uiLookTo = v)],
  uiOverride: [() => uiOverride],
  uiPresetsHTML: [() => uiPresetsHTML, v => (uiPresetsHTML = v)],
  uiPreview: [() => uiPreview, v => (uiPreview = v)],
  uiPreviewDropped: [() => uiPreviewDropped, v => (uiPreviewDropped = v)],
  uiPreviewNow: [() => uiPreviewNow, v => (uiPreviewNow = v)],
  uiPruneHere: [() => uiPruneHere, v => (uiPruneHere = v)],
  uiResetBtn: [() => uiResetBtn],
  uiSaved: [() => uiSaved, v => (uiSaved = v)],
  uiScreenName: [() => uiScreenName],
  uiSettingsHTML: [() => uiSettingsHTML, v => (uiSettingsHTML = v)],
  uiViewSrc: [() => uiViewSrc],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const uiEditor = {
  scope: 'game',
  open: { color: 1 },
  fam: 'panel',
  mode: 'light',
  width: '390px',
  reduced: false,
  text: '',
  /* UI-3b: what the preview shows: the gallery, or a real screen of the game from its fixture (UI_VIEWS) */
  view: 'gallery',
  /* UI-3b: before/after: the saved look beside the unsaved one */
  split: false,
  holding: false,
  saved: null,
  pvT: 0,
};
export const uiData = () => studioState.D.uiTheme;
/* UI-3b: the preview's views: the gallery, and the game's real screens from fixtures (game/js/fixture.js); the payout
   and the run chip join when they exist (RL-8, UI-4) */
export const UI_VIEWS = [
  ['gallery', 'Gallery'],
  ['team', 'Team'],
  ['bag', 'Bag'],
  ['battle', 'Battle'],
  ['talk', 'Dialogue'],
];
/** a view's page: the gallery without its bar, or the game at a fixture (its own save, no account) */
const uiViewSrc = v => (v === 'gallery' ? 'gallery.html?studio=1' : `../game/index.html?fixture=${v}`);
/* the look as last saved: taken when the Studio has nothing unsaved */
function uiSaved() {
  if (!uiEditor.saved || (!studioState.dirty && JSON.stringify(uiEditor.saved) !== JSON.stringify(uiData())))
    uiEditor.saved = clone(uiData());
  return uiEditor.saved;
}
const uiBase = () => uiScopePath(uiEditor.scope);
export const uiScreenName = id => (UI_SCREENS[id] || {}).name || id;
const uiLevelName = () => (uiEditor.scope === 'game' ? 'the whole game' : uiScreenName(uiEditor.scope));
/* a dial's own value at this level, what it would be without it, and what shows */
function uiDialState(rel) {
  const own = readPath(`${uiBase()}.${rel}`);
  const inh =
    uiEditor.scope === 'game' ? uiGet((uiSaved() || {}).defaults, rel) : uiGet((uiData() || {}).defaults, rel);
  const set =
    uiEditor.scope === 'game' ? own !== undefined && JSON.stringify(own) !== JSON.stringify(inh) : own !== undefined;
  return { own, inh, v: own !== undefined ? own : inh, set };
}
const uiFormat = (v, d) => {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v !== 'number') return String(v);
  if (d && d.unit === '%') return Math.round(v * 100) + '%';
  if (d && d.unit === '×') return '×' + v.toFixed(2);
  return `${+v.toFixed(2)}${d && d.unit ? ' ' + d.unit : ''}`;
};
const uiResetBtn = (rel, s) =>
  `<button class="eng-reset" data-act="uiReset" data-r="${rel}" title="${uiEditor.scope === 'game' ? 'Back to the saved value' : 'Follow the whole game again'} (${escapeHtml(uiFormat(s.inh))})">↺</button>`;
/* the contrast badge of a text colour: the worse of the ground and a surface */
function uiAABadge(side, role) {
  const need = (UI_CONTRAST.find(c => c[0] === role) || [])[1];
  if (!need) return '';
  const L = uiEditor.scope === 'game' ? uiThemeLook(uiData()) : screenLook(uiThemeLook(uiData()), uiOverride());
  const pal = ((L && L.color) || {})[side] || {};
  if (!pal[role] || !pal.ground || !pal.surface) return '';
  const g = uiRatio(pal[role], pal.ground),
    s = uiRatio(pal[role], pal.surface),
    r = Math.min(g, s);
  return `<span class="ui-aa ${r >= need ? 'ok' : 'bad'}" data-aa="${side}.${role}" title="On the ground ${g.toFixed(2)}:1, on a surface ${s.toFixed(2)}:1 (needs ${need}:1)">${uiGrade(r)} ${r.toFixed(1)}</span>`;
}
const uiOverride = () => ((uiData() || {}).overrides || {})[uiEditor.scope] || {};
/* one dial; rel is its place inside the look (color.light.text, shape.families.card.kind...) */
function uiDialHTML(d, rel) {
  const p = `${uiBase()}.${rel}`,
    s = uiDialState(rel),
    v = s.v;
  let body = '';
  if (d.kind === 'range')
    body = `<span class="eng-lab">${escapeHtml(d.label)} <output id="${fieldOutputId(p)}">${escapeHtml(uiFormat(v, d))}</output></span><input type="range" data-p="${p}" data-k="num" ${d.unit === '%' ? 'data-show="pct"' : d.unit === '×' ? 'data-show="x"' : ''} value="${v ?? ''}" min="${d.min}" max="${d.max}" step="${d.step}">`;
  else if (d.kind === 'bool')
    body = `<label class="eng-chk"><input type="checkbox" data-p="${p}" data-k="bool" ${v ? 'checked' : ''}><span>${escapeHtml(d.label)}</span></label>`;
  else if (d.kind === 'sel')
    body = `<span class="eng-lab">${escapeHtml(d.label)}</span><select data-p="${p}" data-k="sel">${d.options.map(([a, n]) => `<option value="${escapeHtml(a)}" ${String(v) === a ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>`;
  else if (d.kind === 'color') body = uiColorHTML(p, v, d);
  else if (d.kind === 'tint') {
    const t = v === 'text';
    body = `<span class="eng-lab">${escapeHtml(d.label)}</span><label class="eng-chk"><input type="checkbox" data-act="uiTint" data-r="${rel}" ${t ? 'checked' : ''}><span>This side’s text colour</span></label>${t ? '' : uiColorHTML(p, v, d)}`;
  } else if (d.kind === 'ease')
    body = `<span class="eng-lab">${escapeHtml(d.label)} <output>cubic-bezier</output></span><span class="ui-ease">${[0, 1, 2, 3].map(i => `<input type="number" data-p="${p}.${i}" data-k="num" step="0.05" min="-2" max="3" value="${(v || [])[i] ?? ''}" aria-label="${escapeHtml(d.label)} ${i + 1}">`).join('')}</span>`;
  return `<div class="eng-f ${s.set ? 'own' : ''}" data-path="${p}">${body}${uiResetBtn(rel, s)}${d.help ? `<small class="help">${escapeHtml(d.help)}</small>` : ''}</div>`;
}
function uiColorHTML(p, v, d) {
  const ok = typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v),
    hex = ok ? v : '#888888';
  return `<span class="colw"><input type="color" data-p="${p}" data-k="color" ${d.alpha ? `data-a="1" data-alpha="${hex.slice(7)}"` : ''} value="${hex.slice(0, 7)}" aria-label="${escapeHtml(d.label)}"><input type="text" data-p="${p}" data-k="color" ${d.alpha ? 'data-a="1"' : ''} value="${ok ? escapeHtml(v) : ''}" maxlength="${d.alpha ? 9 : 7}" class="hex" aria-label="${escapeHtml(d.label)}, hex"></span>`;
}
/* the colours: a row a role, light and dark side by side */
function uiColorsHTML(G) {
  return `<table class="ui-cols"><thead><tr><th></th><th>Light</th><th>Dark</th></tr></thead><tbody>${G.sideDials
    .map(
      d =>
        `<tr><th title="${escapeHtml(d.help || '')}">${escapeHtml(d.label)}</th>${['light', 'dark']
          .map(side => {
            const rel = `color.${side}.${d.k}`,
              p = `${uiBase()}.${rel}`,
              s = uiDialState(rel);
            return `<td><div class="eng-f ui-col ${s.set ? 'own' : ''}" data-path="${p}">${uiColorHTML(p, s.v, { ...d, label: `${d.label}, ${side}` })}${uiAABadge(side, d.k)}${uiResetBtn(rel, s)}</div></td>`;
          })
          .join('')}</tr>`
    )
    .join('')}</tbody></table>`;
}
/* the shape families: pick one, then its shape, cut size, corners and radius */
function uiFamiliesHTML() {
  const f = uiEditor.fam,
    hex = (UI_FAMILY_LABELS.find(x => x[0] === f) || [])[2],
    rel = k => `shape.families.${f}.${k}`;
  const corners = uiDialState(rel('corners')),
    cs = corners.v || [];
  return `<div class="ui-fams"><span class="eng-lab">Each family</span><div class="seg-row">${UI_FAMILY_LABELS.map(
    ([k, n]) =>
      `<button class="seg ${k === f ? 'on' : ''}" data-act="uiFam" data-f="${k}">${escapeHtml(n)}${readPath(`${uiBase()}.shape.families.${k}`) !== undefined && uiEditor.scope !== 'game' ? ' •' : ''}</button>`
  ).join('')}</div>
 ${uiDialHTML(
   {
     k: 'kind',
     label: 'Shape',
     kind: 'sel',
     options: [
       ['cut', 'Cut corners'],
       ['rounded', 'Rounded (to compare)'],
       ['square', 'Square (to compare)'],
     ],
   },
   rel('kind')
 )}
 ${uiDialHTML(
   {
     k: 'size',
     label: 'Cut size',
     kind: 'sel',
     options: [
       ['cutSm', 'Small'],
       ['cutMd', 'Medium'],
       ['cutLg', 'Large'],
     ],
   },
   rel('size')
 )}
 ${
   hex
     ? '<p class="help">A long hexagon: cut at both ends, so no corners to pick.</p>'
     : `<div class="eng-f ${corners.set ? 'own' : ''}" data-path="${uiBase()}.${rel('corners')}"><span class="eng-lab">Cut corners</span><span class="ui-corners">${[
         ['tl', 'Top left'],
         ['tr', 'Top right'],
         ['br', 'Bottom right'],
         ['bl', 'Bottom left'],
       ]
         .map(
           ([c, n]) =>
             `<label class="eng-chk"><input type="checkbox" data-act="uiCorner" data-c="${c}" ${cs.includes(c) ? 'checked' : ''}><span>${n}</span></label>`
         )
         .join('')}</span>${uiResetBtn(rel('corners'), corners)}</div>`
 }
 ${uiDialHTML({ k: 'radius', label: 'Radius when rounded', kind: 'range', min: 0, max: 48, step: 1, unit: 'px' }, rel('radius'))}</div>`;
}
function uiLayersHTML() {
  return `<table class="tbl ui-layers"><thead><tr><th>Layer</th><th>z</th><th>What</th></tr></thead><tbody>${UI_LAYERS.map(
    ([n, z, w]) => `<tr><td class="mono">${n}</td><td class="mono">${z}</td><td>${escapeHtml(w)}</td></tr>`
  ).join('')}</tbody></table>`;
}
/* how many dials a group sets here (the whole game: changed since saved) */
function uiGroupCount(G) {
  if (uiEditor.scope === 'game')
    return uiDiffCount(uiGet((uiSaved() || {}).defaults, G.id), uiGet(uiData().defaults, G.id));
  return uiCount(uiOverride()[G.id]);
}
function uiGroupHTML(G) {
  const open = uiEditor.open[G.id],
    n = G.readOnly ? 0 : uiGroupCount(G);
  let body = '';
  if (open) {
    if (G.readOnly) body = uiLayersHTML();
    else if (G.id === 'color') body = uiColorsHTML(G);
    else {
      body = (G.dials || [])
        .map(d => (d.kind === 'families' ? uiFamiliesHTML() : uiDialHTML(d, `${G.id}.${d.k}`)))
        .join('');
      if (G.sideDials)
        body += `<div class="ui-sides">${['light', 'dark']
          .map(
            side =>
              `<div><h4>${side === 'light' ? 'Light' : 'Dark'}</h4>${G.sideDials.map(d => uiDialHTML(d, `${G.id}.${side}.${d.k}`)).join('')}</div>`
          )
          .join('')}</div>`;
    }
  }
  return `<section class="card eng-g ${open ? 'open' : ''}" data-ui-g="${G.id}"><header><button class="eng-gh" data-act="uiOpen" data-g="${G.id}"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>${escapeHtml(G.title)}</h3>${n ? `<span class="badge">${n} ${uiEditor.scope === 'game' ? 'changed' : 'set'}</span>` : ''}</button>${n ? `<button class="btn sm subtle" data-act="uiResetG" data-g="${G.id}">Reset</button>` : ''}</header>
 ${open ? `<div class="card-b eng-fields">${G.help ? `<p class="help">${escapeHtml(G.help)}</p>` : ''}${body}</div>` : ''}</section>`;
}
function uiPresetsHTML() {
  const P = uiData().presets || {};
  return `<div class="eng-pre">${Object.entries(P)
    .map(
      ([k, L]) =>
        `<span class="eng-own"><button class="seg" data-act="uiPreset" data-k="${escapeHtml(k)}">${escapeHtml(L.name || k)}</button><button class="eng-x" data-act="uiPresetDel" data-k="${escapeHtml(k)}" title="Delete this preset">×</button></span>`
    )
    .join(
      ''
    )}<button class="seg add" data-act="uiPresetSave">+ Save as preset</button></div><p class="help">A preset changes the dials it holds, on ${escapeHtml(uiLevelName())}${uiEditor.scope === 'game' ? '' : ' (its colours and shapes only)'}. Presets are data (uiTheme.json), so a content pack can ship a look. Undo takes it back.</p>`;
}
function uiSettingsHTML() {
  const T = uiData(),
    ov = T.overrides || {},
    nGame = uiDiffCount((uiSaved() || {}).defaults, T.defaults);
  return `<div class="card eng-scope"><div class="card-b"><label class="fld"><span>Set the look for</span><select id="uiScope" aria-label="Set the look for"><option value="game" ${uiEditor.scope === 'game' ? 'selected' : ''}>The whole game${nGame ? ` · ${nGame} changed` : ''}</option>${Object.keys(
    UI_SCREENS
  )
    .map(
      k =>
        `<option value="${k}" ${uiEditor.scope === k ? 'selected' : ''}>Only ${escapeHtml(uiScreenName(k))}${ov[k] ? ` · ${uiCount(ov[k])} set` : ''}</option>`
    )
    .join('')}</select></label>
 <p class="help">${uiEditor.scope === 'game' ? 'Every screen, unless a screen sets its own colours or shapes. A dial you’ve changed since the last save shows ↺, which puts it back.' : `Colours and shapes for ${escapeHtml(uiScreenName(uiEditor.scope))} only (its own part of the page; the top and bottom bars and sheets follow the game). A dial you haven’t set follows the whole game; ↺ makes it follow again.`}</p>
 <h4>Presets</h4>${uiPresetsHTML()}
 <div class="seg-row"><button class="btn sm subtle" data-act="uiClear">${uiEditor.scope === 'game' ? 'Back to the saved look' : 'Clear everything set here'}</button>${uiEditor.scope !== 'game' && ov[uiEditor.scope] ? '<button class="btn sm subtle" data-act="uiPromote">Use these for the whole game</button>' : ''}</div></div></div>
 ${uiScopeGroups(uiEditor.scope).map(uiGroupHTML).join('')}${uiRulesHTML()}`;
}
SECTIONS.ui = () => {
  if (!uiData() || !uiData().defaults)
    return `<div class="ed-col solo"><h2>UI look</h2><p class="help">game/data/uiTheme.json is missing, so the game keeps tokens.css’s look.</p></div>`;
  uiSaved();
  const F = studioState.sel.uiFocus;
  if (F) {
    delete studioState.sel.uiFocus;
    uiEditor.scope = F.scope || 'game';
    const g = String(F.rel || '').split('.')[0];
    if (g) uiEditor.open[g] = 1;
    if (g === 'shape' && /^shape\.families\./.test(F.rel)) uiEditor.fam = F.rel.split('.')[2];
    afterRender(() => findFlash(fieldSelector(`${uiBase()}.${F.rel}`)));
  }
  /* UI-3b: the Check's Show me on the rule report */
  if (studioState.sel.uiRules) {
    delete studioState.sel.uiRules;
    uiRulesShow();
  }
  afterRender(mountUiPreview);
  const seg = (g, v, label) =>
    `<button class="seg ${uiEditor[g] === v ? 'on' : ''}" data-act="uiPv" data-g="${g}" data-v="${v}">${label}</button>`;
  return `<div class="eng-split ui-split"><div class="eng-set" id="uiSet">${uiSettingsHTML()}</div>
 <div class="eng-side"><div class="card"><div class="card-b"><div class="ui-pvbar"><div class="seg-row">${seg('mode', 'light', 'Light')}${seg('mode', 'dark', 'Dark')}</div><div class="seg-row">${seg('width', '320px', '320')}${seg('width', '390px', '390')}${seg('width', '760px', 'Wide')}</div>
  <div class="seg-row"><button class="seg ${uiEditor.reduced ? 'on' : ''}" data-act="uiPv" data-g="reduced">Reduced motion</button><select id="uiText" aria-label="Text size (Settings)"><option value="">Text: normal</option><option value="large" ${uiEditor.text === 'large' ? 'selected' : ''}>Text: large</option><option value="xlarge" ${uiEditor.text === 'xlarge' ? 'selected' : ''}>Text: larger</option></select>
  <div class="seg-row ui-ov" title="Mark what breaks the UI rules in the preview"><button class="seg ${uiOverlays.tap ? 'on' : ''}" data-act="uiOverlay" data-k="tap">Under 44 px</button><button class="seg ${uiOverlays.contrast ? 'on' : ''}" data-act="uiOverlay" data-k="contrast">Contrast</button><button class="seg ${uiOverlays.glass ? 'on' : ''}" data-act="uiOverlay" data-k="glass">Glass</button></div>
  <button class="btn sm ${uiEditor.split ? 'on' : ''}" id="uiSplit" data-act="uiSplit" title="The saved look and your unsaved look side by side, scrolled together">Before / after</button>  <button class="btn sm ${uiInspect.on ? 'on' : ''}" id="uiInsp" data-act="uiInspectOn" title="Tap a part in the preview: what it is and which dials reach it">Inspect</button>  <button class="btn sm" id="uiCmp" title="Hold (or hold C) to see the look as last saved">Hold to compare</button><a class="btn sm subtle" href="gallery.html" target="_blank" rel="noopener">Open the gallery</a></div></div>
  <div class="seg-row ui-views">${UI_VIEWS.map(([v, label]) => seg('view', v, label)).join('')}</div>
  <div class="ui-pv-pair ${uiEditor.split ? 'split' : ''}">${uiEditor.split ? `<div class="ui-pv-col"><p class="ui-pv-cap">Before: the saved look</p><div class="ui-pv ui-pv-slot ${uiEditor.view === 'gallery' ? '' : 'game'}" id="uiPvBeforeSlot" ${uiEditor.view === 'gallery' ? '' : `style="width:${uiEditor.width}"`}></div></div>` : ''}<div class="ui-pv-col">${uiEditor.split ? '<p class="ui-pv-cap">After: your unsaved look</p>' : ''}<div class="ui-pv ui-pv-slot ${uiEditor.view === 'gallery' ? '' : 'game'}" id="uiPvSlot" ${uiEditor.view === 'gallery' ? '' : `style="width:${uiEditor.width}"`}></div></div></div>
  <p class="help ui-ov-note" id="uiOvNote" hidden></p>
  <div class="ui-inspect" id="uiInspect" hidden></div>
  <p class="help">${uiEditor.view === 'gallery' ? `The game’s own parts (studio/gallery.html) with your unsaved look${uiEditor.scope === 'game' ? '' : `, as on ${escapeHtml(uiScreenName(uiEditor.scope))}`}` : 'The game itself on this screen (a ready-made game of its own: nothing is saved to yours) with your unsaved look; it takes a few seconds to start'}. An open game tab follows too.</p></div></div></div></div>`;
};
/** hand a look to a preview frame: the gallery takes it whole; a game screen (a fixture) by a message */
function uiLookTo(f, theme) {
  const w = f && f.contentWindow;
  if (!w) return false;
  if (uiEditor.view !== 'gallery') {
    w.postMessage(
      { type: 'uiLook', theme, mode: uiEditor.mode, reduced: uiEditor.reduced, text: uiEditor.text },
      location.origin
    );
    return true;
  }
  if (typeof w.galleryLook !== 'function') return false;
  w.galleryLook(theme, {
    mode: uiEditor.mode,
    width: uiEditor.width,
    reduced: uiEditor.reduced,
    text: uiEditor.text,
    screen: uiEditor.scope === 'game' ? '' : uiEditor.scope,
  });
  return true;
}
/* hand the look to the preview frame */
function uiPreviewNow() {
  if (!uiLookTo($('#uiPv'), uiEditor.holding ? uiSaved() : uiData())) return false;
  /* UI-3b: what inspect shows follows the look */
  if (uiInspect.on) {
    uiInspectOutline();
    uiInspectPanel();
  }
  uiOverlaysSoon();
  uiBeforeNow();
  return true;
}
function uiPreview() {
  cancelAnimationFrame(uiEditor.pvT);
  uiEditor.pvT = requestAnimationFrame(uiPreviewNow);
}
function mountUiPreview() {
  uiKeptFrame(
    'uiPv',
    uiViewSrc(uiEditor.view),
    `${uiEditor.view === 'gallery' ? 'The UI gallery' : 'The game'} with this look`
  );
  if (uiEditor.split) uiKeptFrame('uiPvBefore', uiViewSrc(uiEditor.view), 'The saved look');
  uiPreviewNow();
  uiBeforeNow();
  const b = $('#uiCmp');
  b.onpointerdown = () => uiCompare(true);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => uiCompare(false)));
}
/* UI-3b: the preview frames are kept across the section's redraws (an edit's Undo, a new scope draw the section
   again; a frame made again would load again, and a game screen would start over). Each lives on the page's body,
   laid over its slot in the section (<id>Slot) and clipped to the pane as it scrolls; when the slot goes (another
   section), a game frame is let go. */
const uiKept = new Map();
/** the kept frame with this id, showing src (a new src loads it) */
function uiKeptFrame(id, src, title = '') {
  let f = uiKept.get(id);
  if (!f) {
    f = document.createElement('iframe');
    f.id = id;
    f.className = 'ui-pv-kept';
    f.addEventListener('load', () => uiFrameLoaded(id));
    document.body.appendChild(f);
    uiKept.set(id, f);
  }
  if (title) f.title = title;
  if (f.dataset.src !== src) {
    f.dataset.src = src;
    f.src = src;
  }
  uiKeptSync();
  return f;
}
/** the preview is about to show another page: what inspect picked goes with it */
function uiPreviewDropped() {
  if (typeof uiInspect !== 'undefined') uiInspect.el = null;
}
/** a kept frame has loaded its page: hand it the look */
function uiFrameLoaded(id) {
  if (id === 'uiPv') {
    uiPreviewNow();
    uiInspectMount();
    uiOverlaysSoon();
  } else uiBeforeNow();
}
/** the before frame takes the saved look, and follows the after frame's scroll */
function uiBeforeNow() {
  const f = uiKept.get('uiPvBefore');
  if (!uiEditor.split || !f || !f.dataset.src) return;
  uiLookTo(f, uiSaved());
  const a = $('#uiPv'),
    wa = a && a.contentWindow,
    wb = f.contentWindow;
  if (!wa || !wb || !wa.document) return;
  const doc = wa.document;
  if (uiBeforeNow.doc !== doc) {
    uiBeforeNow.doc = doc;
    // the scroll that matters: the page's, or the game screen's own scroller
    wa.addEventListener(
      'scroll',
      ev => {
        const t = /** @type {any} */ (ev.target),
          wb2 = f.contentWindow;
        if (!wb2 || !wb2.document) return;
        if (t === doc || t === doc.documentElement) wb2.scrollTo(wa.scrollX, wa.scrollY);
        else if (t && t.id) {
          const o = wb2.document.getElementById(t.id);
          if (o) o.scrollTop = t.scrollTop;
        } else if (t && t.className && typeof t.className === 'string') {
          const o = wb2.document.querySelector('.' + t.className.trim().split(/\s+/).join('.'));
          if (o) o.scrollTop = t.scrollTop;
        }
      },
      true
    );
  }
}
/** lay each kept frame over its slot (every frame while one is shown) */
function uiKeptSync() {
  cancelAnimationFrame(uiKeptSync.raf);
  let any = false;
  for (const [id, f] of uiKept) {
    const slot = document.getElementById(id + 'Slot');
    if (!slot || !slot.getClientRects().length) {
      f.style.display = 'none';
      // a game left running in a hidden frame costs the Studio frames: let it go (it starts again when shown)
      if (/fixture=/.test(f.dataset.src || '')) {
        f.dataset.src = '';
        f.src = 'about:blank';
      }
      continue;
    }
    any = true;
    const r = slot.getBoundingClientRect(),
      pane = slot.closest('.pane') || $('#main'),
      c = pane ? pane.getBoundingClientRect() : { top: 0, left: 0, right: innerWidth, bottom: innerHeight },
      clip = [c.top - r.top, r.right - c.right, r.bottom - c.bottom, c.left - r.left].map(x => Math.max(0, x));
    f.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;clip-path:inset(${clip.map(x => x + 'px').join(' ')});visibility:${clip[0] + clip[2] >= r.height ? 'hidden' : 'visible'}`;
  }
  if (any) uiKeptSync.raf = requestAnimationFrame(uiKeptSync);
}
function uiCompare(on) {
  if (uiEditor.holding === on) return;
  uiEditor.holding = on;
  const b = $('#uiCmp');
  if (b) b.classList.toggle('on', on);
  uiPreviewNow();
}
function refreshUiSettings() {
  const s = $('#uiSet');
  if (!s) return;
  const m = s.closest('.pane') || $('#main'),
    y = m.scrollTop;
  s.innerHTML = uiSettingsHTML();
  m.scrollTop = y;
}
/* after any change to the look: the badges, the marks and the preview */
function uiAfterEdit(p) {
  if (p) {
    const el = document.querySelector(`#uiSet .eng-f[data-path="${CSS.escape(p.replace(/\.\d$/, ''))}"]`);
    if (el) el.classList.toggle('own', uiDialState(p.replace(/\.\d$/, '').slice(uiBase().length + 1)).set);
  }
  document.querySelectorAll('#uiSet [data-aa]').forEach(b => {
    const [side, role] = b.dataset.aa.split('.'),
      t = document.createElement('div');
    t.innerHTML = uiAABadge(side, role);
    if (t.firstElementChild) b.replaceWith(t.firstElementChild);
  });
  uiPreview();
}
/* edits through the Studio's own field code (studio-app.js onField writes the data first) */
document.addEventListener('input', ev => {
  const p = ev.target.dataset && ev.target.dataset.p;
  if (p && p.startsWith('uiTheme.') && sectionShown('ui')) uiAfterEdit(p);
});
document.addEventListener('change', ev => {
  /* the level and the preview's text size (the settings are redrawn after edits, so these are found by id) */
  if (ev.target.id === 'uiScope') {
    uiEditor.scope = ev.target.value;
    refreshUiSettings();
    return uiPreview();
  }
  if (ev.target.id === 'uiText') {
    uiEditor.text = ev.target.value;
    return uiPreview();
  }
  const p = ev.target.dataset && ev.target.dataset.p;
  if (p && p.startsWith('uiTheme.') && sectionShown('ui')) {
    if (uiEditor.scope !== 'game') uiPruneHere();
    refreshUiSettings();
    uiPreview();
  }
});
/* a whole edit: changed, one undo step, redrawn */
function uiDone() {
  changed();
  commit(true);
  refreshUiSettings();
  uiPreview();
}
/* empty parts of a screen's override taken away (a screen with nothing set has no override) */
function uiPruneHere() {
  const T = uiData();
  if (!T.overrides) return;
  uiPrune(T.overrides);
}
ACTIONS.uiOpen = d => {
  uiEditor.open[d.g] = !uiEditor.open[d.g];
  refreshUiSettings();
};
ACTIONS.uiFam = d => {
  uiEditor.fam = d.f;
  refreshUiSettings();
};
ACTIONS.uiSplit = () => {
  uiEditor.split = !uiEditor.split;
  render();
};
ACTIONS.uiPv = d => {
  /* UI-3b: another view is another page in the frame */
  if (d.g === 'view') {
    uiEditor.view = d.v;
    uiPreviewDropped();
    render();
    return;
  }
  if (d.g === 'reduced') uiEditor.reduced = !uiEditor.reduced;
  else uiEditor[d.g] = d.v;
  document
    .querySelectorAll('[data-act="uiPv"]')
    .forEach(b =>
      b.classList.toggle('on', b.dataset.g === 'reduced' ? uiEditor.reduced : uiEditor[b.dataset.g] === b.dataset.v)
    );
  /* a game screen's frame takes the width itself (the slot it lies over) */
  for (const sl of document.querySelectorAll('#uiPvSlot, #uiPvBeforeSlot'))
    if (uiEditor.view !== 'gallery') /** @type {HTMLElement} */ (sl).style.width = uiEditor.width;
  uiBeforeNow();
  uiPreviewNow();
};
ACTIONS.uiReset = d => {
  const s = uiDialState(d.r);
  writePath(`${uiBase()}.${d.r}`, uiEditor.scope === 'game' && s.inh !== undefined ? clone(s.inh) : undefined);
  uiPruneHere();
  uiDone();
};
ACTIONS.uiResetG = d => {
  if (uiEditor.scope === 'game') writePath(`${uiBase()}.${d.g}`, clone(uiGet(uiSaved().defaults, d.g)));
  else writePath(`${uiBase()}.${d.g}`, undefined);
  uiPruneHere();
  uiDone();
};
ACTIONS.uiTint = (d, el) => {
  const side = d.r.split('.')[1],
    text = ((uiThemeLook(uiData()).color || {})[side] || {}).text || '#000000';
  writePath(`${uiBase()}.${d.r}`, el.checked ? 'text' : text.slice(0, 7));
  uiDone();
};
ACTIONS.uiCorner = (d, el) => {
  const rel = `shape.families.${uiEditor.fam}.corners`,
    cur = (uiDialState(rel).v || []).slice(),
    order = ['tl', 'tr', 'br', 'bl'];
  const next = el.checked ? [...new Set([...cur, d.c])] : cur.filter(c => c !== d.c);
  writePath(
    `${uiBase()}.${rel}`,
    order.filter(c => next.includes(c))
  );
  uiDone();
};
ACTIONS.uiClear = async () => {
  if (uiEditor.scope === 'game') {
    if (!uiDiffCount(uiSaved().defaults, uiData().defaults)) return toast('Nothing has changed since the last save.');
    if (!(await ask('Put every dial of the whole game back to the saved look?', 'Put back'))) return;
    uiData().defaults = clone(uiSaved().defaults);
  } else {
    if (!uiData().overrides || !uiData().overrides[uiEditor.scope]) return toast('Nothing is set here.');
    if (!(await ask(`Clear everything set for ${uiScreenName(uiEditor.scope)}?`, 'Clear'))) return;
    delete uiData().overrides[uiEditor.scope];
  }
  uiDone();
};
ACTIONS.uiPromote = async () => {
  const ov = uiOverride();
  if (!Object.keys(ov).length) return;
  if (
    !(await ask(
      `Copy ${uiScreenName(uiEditor.scope)}’s colours and shapes to the whole game and clear them from the screen?`,
      'Copy'
    ))
  )
    return;
  uiData().defaults = mergeLook(uiData().defaults, clone(ov));
  delete uiData().overrides[uiEditor.scope];
  uiEditor.scope = 'game';
  uiDone();
};
ACTIONS.uiPreset = d => {
  const P = (uiData().presets || {})[d.k];
  if (!P) return;
  const vals = uiPresetValues(P, uiEditor.scope);
  if (uiEditor.scope === 'game') uiData().defaults = mergeLook(uiData().defaults, vals);
  else {
    const T = uiData();
    T.overrides = T.overrides || {};
    T.overrides[uiEditor.scope] = mergeLook(T.overrides[uiEditor.scope] || {}, vals);
  }
  uiDone();
  toast(`${P.name || d.k} applied to ${uiLevelName()}.`);
};
ACTIONS.uiPresetSave = async () => {
  const cur = uiEditor.scope === 'game' ? uiData().defaults : uiOverride();
  if (!cur || !Object.keys(cur).length)
    return toast('Set a few dials here first; a preset saves what this level sets.');
  const name = await dialog(
    'Save as preset',
    `<label class="fld"><span>Name</span><input type="text" id="uiPN" placeholder="Night market" maxlength="40"></label><p class="help">Saves ${uiEditor.scope === 'game' ? 'the whole look' : `${escapeHtml(uiScreenName(uiEditor.scope))}’s colours and shapes`} as a preset in uiTheme.json.</p>`,
    [
      { l: 'Cancel', v: null },
      { l: 'Save', c: 'primary', f: m => (m.querySelector('#uiPN').value || '').trim() || false },
    ]
  );
  if (!name) return;
  const T = uiData(),
    ps = T.presets || (T.presets = {}),
    k = uiPresetId(name, ps);
  ps[k] = { name, ...clone(cur) };
  uiDone();
  toast('Preset saved.');
};
ACTIONS.uiPresetDel = async d => {
  const P = (uiData().presets || {})[d.k];
  if (!P || !(await ask(`Delete the preset “${P.name || d.k}”?`, 'Delete'))) return;
  delete uiData().presets[d.k];
  uiDone();
};
/* Hold C compares, as the button does */
document.addEventListener('keydown', ev => {
  if (ev.key !== 'c' || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || !sectionShown('ui')) return;
  const t = ev.target;
  if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
  uiCompare(true);
});
document.addEventListener('keyup', ev => {
  if (ev.key === 'c') uiCompare(false);
});
/* Find (Ctrl+K) and the Check's Show me: a dial by its place in the look, on a level */
export function findUi(rel, scope = 'game') {
  if (sectionShown('ui') && studioState.sec === 'ui') {
    studioState.sel.uiFocus = { rel, scope };
    render();
  } else openSection('ui', { uiFocus: { rel, scope } });
}
