// @ts-check
'use strict';
/* ================= UI DIALS (UI track, UI-3) =================
   The Studio's UI section edits game/data/uiTheme.json through these dials, the way the Engine section edits
   engine.json through ENGINE_SPEC: a table of groups, each a list of dials (a key, a label, a kind and its range).
   A group's dials are either shared by light and dark (`dials`) or set per side (`sideDials`, shown side by side).
   Only the colour and shape groups can be set for one screen (uiTheme.json overrides). The ranges are the schema's
   (tools/test/ui-dials.test.mjs keeps them equal). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { uiThemeCss } from './ui-theme.js';
/* eslint-disable no-func-assign */
expose({
  UI_DIALS: [() => UI_DIALS],
  UI_DIAL_ALSO: [() => UI_DIAL_ALSO],
  UI_FAMILY_LABELS: [() => UI_FAMILY_LABELS],
  UI_LAYERS: [() => UI_LAYERS],
  UI_NUDGE: [() => UI_NUDGE],
  UI_ROLE_LABELS: [() => UI_ROLE_LABELS],
  UI_SHADOW_DIALS: [() => UI_SHADOW_DIALS],
  dialEase: [() => dialEase],
  dialPx: [() => dialPx],
  dialShare: [() => dialShare],
  // @ts-expect-error -- replaced on purpose
  uiCount: [() => uiCount, v => (uiCount = v)],
  // @ts-expect-error -- replaced on purpose
  uiDialList: [() => uiDialList, v => (uiDialList = v)],
  uiDialReach: [() => uiDialReach],
  // @ts-expect-error -- replaced on purpose
  uiDialVars: [() => uiDialVars, v => (uiDialVars = v)],
  // @ts-expect-error -- replaced on purpose
  uiDiffCount: [() => uiDiffCount, v => (uiDiffCount = v)],
  // @ts-expect-error -- replaced on purpose
  uiGet: [() => uiGet, v => (uiGet = v)],
  uiGrade: [() => uiGrade],
  // @ts-expect-error -- replaced on purpose
  uiNudge: [() => uiNudge, v => (uiNudge = v)],
  // @ts-expect-error -- replaced on purpose
  uiPresetId: [() => uiPresetId, v => (uiPresetId = v)],
  // @ts-expect-error -- replaced on purpose
  uiPresetValues: [() => uiPresetValues, v => (uiPresetValues = v)],
  // @ts-expect-error -- replaced on purpose
  uiPrune: [() => uiPrune, v => (uiPrune = v)],
  uiScopeGroups: [() => uiScopeGroups],
  uiScopePath: [() => uiScopePath],
  // @ts-expect-error -- replaced on purpose
  uiSheetVars: [() => uiSheetVars, v => (uiSheetVars = v)],
  // @ts-expect-error -- replaced on purpose
  uiVarDials: [() => uiVarDials, v => (uiVarDials = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{k: string, label: string, kind: string, min?: number, max?: number, step?: number, unit?: string,
 *   options?: [string, string][], help?: string, alpha?: boolean, fams?: boolean}} UiDial */
/** @typedef {{id: string, title: string, screen?: boolean, help?: string, dials?: UiDial[], sideDials?: UiDial[],
 *   readOnly?: boolean}} UiGroup */

export const dialPx = (/** @type {string} */ k, /** @type {string} */ label, max = 96, help = '') =>
  /** @type {UiDial} */ ({ k, label, kind: 'range', min: 0, max, step: 1, unit: 'px', help });
export const dialShare = (/** @type {string} */ k, /** @type {string} */ label, help = '') =>
  /** @type {UiDial} */ ({ k, label, kind: 'range', min: 0, max: 1, step: 0.01, unit: '%', help });
/** the eight numbers of a shadow pair (depth per side, and the drop shadows) */
export const UI_SHADOW_DIALS = /** @type {UiDial[]} */ ([
  dialPx('raisedY', 'Raised: how far down', 40, 'Cards and buttons: how far the big shadow falls.'),
  dialPx('raisedBlur', 'Raised: blur', 60),
  dialShare('raisedAlpha', 'Raised: strength'),
  dialShare('raisedNear', 'Raised: near shadow', 'The small, sharp shadow right under the part.'),
  dialPx('floatY', 'Floating: how far down', 40, 'Sheets, toasts and the bottom bar.'),
  dialPx('floatBlur', 'Floating: blur', 60),
  dialShare('floatAlpha', 'Floating: strength'),
  dialShare('floatNear', 'Floating: near shadow'),
]);

/** the colour roles, in the order the Studio shows them */
export const UI_ROLE_LABELS = /** @type {[string, string, string][]} */ ([
  ['ground', 'Ground', 'Behind everything.'],
  ['surface', 'Surface', 'Solid cards, and the glass’s colour.'],
  ['text', 'Text', ''],
  ['text2', 'Quiet text', 'Hints, captions, second lines.'],
  ['line', 'Lines', 'Rules and borders (can be see-through: #rrggbbaa).'],
  ['primary', 'Primary', 'The green: success, primary marks.'],
  ['goldA', 'Gold, top', 'The main action’s gradient.'],
  ['goldB', 'Gold, bottom', 'The main action’s gradient, and gold marks.'],
  ['danger', 'Danger', 'Errors, damage, the red.'],
  ['hpOk', 'HP healthy', 'Teal, so primary, the Grass pill and HP stay apart.'],
  ['hpMid', 'HP under half', ''],
  ['hpLow', 'HP under a quarter', ''],
]);
/** the shape families: id, the Studio's name, and whether it is a long hexagon (cut at both ends, no corners to pick) */
export const UI_FAMILY_LABELS = /** @type {[string, string, boolean][]} */ ([
  ['panel', 'Panels and sheets', false],
  ['card', 'Cards', false],
  ['button', 'Buttons', false],
  ['action', 'The main action', true],
  ['tab', 'Tabs', false],
  ['toast', 'Toasts', true],
  ['bubble', 'The dialogue bubble', false],
]);
export const dialEase = (/** @type {string} */ k, /** @type {string} */ label, help = '') =>
  /** @type {UiDial} */ ({ k, label, kind: 'ease', help });

/** the groups, in the Studio's order @type {UiGroup[]} */
export const UI_DIALS = [
  {
    id: 'color',
    title: 'Colours',
    screen: true,
    help: 'Light and dark side by side. A text colour shows how well it reads on the ground and on a surface.',
    sideDials: UI_ROLE_LABELS.map(([k, label, help]) => ({ k, label, kind: 'color', alpha: k === 'line', help })),
  },
  {
    id: 'surface',
    title: 'Surface (the glass)',
    help: 'Blur only on panels, sheets and bars; at most three blurred surfaces a screen.',
    dials: [
      { k: 'blur', label: 'Blur', kind: 'range', min: 0, max: 40, step: 1, unit: 'px' },
      { k: 'saturate', label: 'Saturation behind', kind: 'range', min: 0, max: 3, step: 0.05, unit: '×' },
    ],
    sideDials: [
      dialShare('glass', 'Glass opacity'),
      dialShare('highlight', 'Top highlight', 'The 1 px light line inside a glass panel’s top.'),
      dialShare('edgeHi', 'Edge line, light', 'The edge line round the angular parts, on top.'),
      dialShare('edgeLo', 'Edge line, dark', 'Its dark side below, in the shadow colour.'),
      { k: 'shadowTint', label: 'Shadow colour', kind: 'tint', help: 'Text (this side’s text colour) or a colour.' },
    ],
  },
  {
    id: 'depth',
    title: 'Depth (glass panels)',
    help: 'Three depths: flat (inside a panel: no shadow), raised and floating.',
    sideDials: UI_SHADOW_DIALS,
  },
  {
    id: 'drop',
    title: 'Drop shadows (angular parts)',
    help: 'The cut parts can’t take a box shadow, so they cast these, in each side’s shadow colour.',
    dials: UI_SHADOW_DIALS,
  },
  {
    id: 'shape',
    title: 'Shape',
    screen: true,
    help: 'Cut 45° corners; rounded and square are there to compare. Round stays round: portraits, pills, pins, toggles.',
    dials: [
      dialPx('cutSm', 'Small cut', 32, 'Quiet buttons.'),
      dialPx('cutMd', 'Medium cut', 32, 'Cards and tabs.'),
      dialPx('cutLg', 'Large cut', 48, 'Panels, sheets and the main action.'),
      {
        k: 'slant',
        label: 'Slant',
        kind: 'range',
        min: 0,
        max: 30,
        step: 1,
        unit: '°',
        help: 'The selection bar and the slanted chips.',
      },
      { k: 'stepped', label: 'Stepped like pixel art', kind: 'bool' },
      { k: 'step', label: 'Pixels per step', kind: 'range', min: 1, max: 16, step: 1, unit: 'px' },
      { k: 'families', label: 'Each family', kind: 'families', fams: true },
    ],
  },
  {
    id: 'space',
    title: 'Space',
    help: 'One scale: panels breathe at step 5, sections at step 6.',
    dials: [
      ...Array.from({ length: 7 }, (_, i) => dialPx(`s${i + 1}`, `Step ${i + 1}`, 96)),
      dialPx('gutter', 'Screen margin', 48),
    ],
  },
  {
    id: 'type',
    title: 'Type',
    help: 'The voice font names things (headings, buttons, numbers); the prose font is for long text. Jersey 15 has one weight: emphasis by size and colour.',
    dials: [
      {
        k: 'voice',
        label: 'Voice font',
        kind: 'sel',
        options: [
          ['Jersey 15', 'Jersey 15'],
          ['Pixelify Sans', 'Pixelify Sans'],
        ],
      },
      {
        k: 'prose',
        label: 'Prose font',
        kind: 'sel',
        options: [
          ['Oxanium', 'Oxanium'],
          ['Chakra Petch', 'Chakra Petch'],
        ],
      },
      {
        k: 'voiceScale',
        label: 'Voice font size',
        kind: 'range',
        min: 0.5,
        max: 2,
        step: 0.01,
        unit: '×',
        help: 'Jersey 15 runs small: 1.18 draws it 18% larger.',
      },
      {
        k: 'scale',
        label: 'Text sizes',
        kind: 'range',
        min: 0.5,
        max: 2,
        step: 0.01,
        unit: '×',
        help: 'Every size on the scale (caption, body, title, screen).',
      },
      { k: 'lineHeight', label: 'Line height (long text)', kind: 'range', min: 1, max: 2.5, step: 0.05, unit: '' },
    ],
  },
  {
    id: 'motion',
    title: 'Motion',
    help: 'Three speeds and their eases. With reduced motion the game fades instead (try it in the preview).',
    dials: [
      { k: 'fast', label: 'Fast', kind: 'range', min: 0, max: 2000, step: 10, unit: 'ms', help: 'Presses, toggles.' },
      { k: 'base', label: 'Base', kind: 'range', min: 0, max: 2000, step: 10, unit: 'ms', help: 'Most changes.' },
      {
        k: 'slow',
        label: 'Slow',
        kind: 'range',
        min: 0,
        max: 4000,
        step: 10,
        unit: 'ms',
        help: 'Screen changes, sheets.',
      },
      {
        k: 'stagger',
        label: 'Stagger',
        kind: 'range',
        min: 0,
        max: 500,
        step: 5,
        unit: 'ms',
        help: 'Between rows coming in.',
      },
      dialEase('easeOut', 'Ease out', 'Things arriving.'),
      dialEase('easeIn', 'Ease in', 'Things leaving.'),
      dialEase('spring', 'Spring', 'Pops and bounces.'),
    ],
  },
  { id: 'layers', title: 'Layers', readOnly: true, help: 'What sits on what (tokens.css). Read only.' },
];

/** the layer scale as tokens.css has it (kept equal by tools/test/ui-dials.test.mjs) */
export const UI_LAYERS = /** @type {[string, number, string][]} */ ([
  ['--z-below', -1, 'Under its own part (the shapes’ shadow layers)'],
  ['--z-battle', 10, 'The battle'],
  ['--z-scene', 20, 'Cutscene people over the dressing room'],
  ['--z-sheet', 30, 'Scrims, the talk layer'],
  ['--z-hud', 40, 'Joystick, d-pad, toasts, battle tips'],
  ['--z-float', 45, 'The dressing room, floating kit panels'],
  ['--z-wipe', 50, 'The screen-change wipe'],
  ['--z-tool', 60, 'Debug tools and fishing mode'],
  ['--z-veil', 85, 'The lift’s veil'],
  ['--z-top', 2147483000, 'The no-WebGL notice'],
]);

/** a value at a dotted path inside an object @param {any} o @param {string} rel */
export function uiGet(o, rel) {
  let a = o;
  for (const k of rel.split('.')) {
    if (a == null || typeof a !== 'object') return undefined;
    a = a[k];
  }
  return a;
}
/** every dial's place inside a look, for Find and the checks: {group, side, path, label, dial}
 * (the shape families' own dials included) */
export function uiDialList() {
  const out = [];
  for (const G of UI_DIALS) {
    for (const d of G.dials || []) {
      if (d.kind === 'families')
        for (const [f, n, hex] of UI_FAMILY_LABELS)
          for (const k of hex ? ['kind', 'size', 'radius'] : ['kind', 'size', 'corners', 'radius'])
            out.push({ group: G.id, side: '', path: `shape.families.${f}.${k}`, label: `${n}: ${k}`, dial: d });
      else out.push({ group: G.id, side: '', path: `${G.id}.${d.k}`, label: d.label, dial: d });
    }
    for (const d of G.sideDials || [])
      for (const side of ['light', 'dark'])
        out.push({ group: G.id, side, path: `${G.id}.${side}.${d.k}`, label: `${d.label} (${side})`, dial: d });
  }
  return out;
}
/** where a level keeps its values: the whole game's look, or one screen's override @param {string} scope */
export const uiScopePath = scope => (scope === 'game' ? 'uiTheme.defaults' : `uiTheme.overrides.${scope}`);
/** the groups a level shows: every group for the whole game, colours and shape (and layers) for a screen
 * @param {string} scope */
export const uiScopeGroups = scope => UI_DIALS.filter(G => scope === 'game' || G.screen || G.readOnly);
/** empty objects and undefined values taken out, at every depth (lists are kept as they are) @param {any} o */
export function uiPrune(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) uiPrune(v);
    if (v === undefined || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) delete o[k];
  }
  return o;
}
/** how many values an object sets (a list counts once) @param {any} o @returns {number} */
export function uiCount(o) {
  if (o == null) return 0;
  if (typeof o !== 'object' || Array.isArray(o)) return 1;
  return Object.values(o).reduce((a, v) => a + uiCount(v), 0);
}
/** how many values differ between two looks (a dial set in one and not the other counts) @param {any} a @param {any} b
 * @returns {number} */
export function uiDiffCount(a, b) {
  const ob = (/** @type {any} */ v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!ob(a) || !ob(b))
    return JSON.stringify(a) === JSON.stringify(b) ? 0 : Math.max(1, ob(a) ? uiCount(a) : ob(b) ? uiCount(b) : 1);
  let n = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) n += uiDiffCount(a[k], b[k]);
  return n;
}
/** a WCAG grade for a contrast ratio @param {number} r */
export const uiGrade = r => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'fail');
/** what a preset writes onto a level: everything but its name; a screen takes only colours and shapes
 * @param {any} preset @param {string} scope */
export function uiPresetValues(preset, scope) {
  if (!preset) return {};
  /** @type {any} */
  const out = {};
  for (const [k, v] of Object.entries(preset))
    if (k !== 'name' && (scope === 'game' || k === 'color' || k === 'shape')) out[k] = JSON.parse(JSON.stringify(v));
  return out;
}
/** a preset id from a name, not one already taken @param {string} name @param {Record<string, unknown>} taken */
export function uiPresetId(name, taken) {
  const base =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^[^a-z]+|_+$/g, '') || 'look';
  let id = base,
    n = 2;
  while (taken[id]) id = `${base}_${n++}`;
  return id;
}

/* UI-3b: which CSS variables a dial writes, found by moving it and comparing the sheets (logic/ui-theme.js), so the
   answer follows the writer and never needs a table of its own. The Studio's inspect and Connections read it. */
export const UI_NUDGE = /** @type {Record<string, string>} */ ({
  cut: 'rounded',
  rounded: 'cut',
  square: 'cut',
  cutSm: 'cutLg',
  cutMd: 'cutLg',
  cutLg: 'cutSm',
  text: '#123456',
});
/** another value of the same kind @param {any} v @param {UiDial} [d] */
export function uiNudge(v, d) {
  if (typeof v === 'boolean') return !v;
  if (typeof v === 'number') return Math.round((v + Math.max(1, Math.abs(v) * 0.37) + 0.37) * 100) / 100;
  if (Array.isArray(v)) {
    if (v.every(x => typeof x === 'number')) return v.map(x => Math.round((x + 0.07) * 100) / 100);
    return v.length === 4 ? ['tl'] : ['tl', 'tr', 'br', 'bl'];
  }
  if (typeof v === 'string') {
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v))
      return '#' + v.slice(1, 7).replace(/./g, c => (15 - parseInt(c, 16)).toString(16)) + v.slice(7);
    const o = d && d.options && d.options.find(([x]) => x !== v);
    if (o) return o[0];
    return UI_NUDGE[v] || v + 'x';
  }
  return v;
}
/** the custom properties a sheet sets: {"block|--name": value} (the block: the selectors it sits in) */
export function uiSheetVars(css) {
  /** @type {Record<string, string>} */
  const out = {};
  const stack = [];
  for (const m of css.matchAll(/([^{};]*)\{|\}|(--[\w-]+)\s*:\s*([^;{}]*);/g)) {
    if (m[0] === '}') stack.pop();
    else if (m[0].endsWith('{')) stack.push(m[1].trim());
    else out[stack.join(' ') + '|' + m[2]] = m[3].trim();
  }
  return out;
}
/** the variables a dial writes in the whole game's look (empty when it does nothing in this look: a corner list on a
 * rounded family) @param {any} theme uiTheme.json @param {string} rel the dial's place inside a look */
export function uiDialVars(theme, rel) {
  if (!theme || !theme.defaults) return [];
  const before = uiSheetVars(uiThemeCss(theme)),
    t = JSON.parse(JSON.stringify(theme)),
    keys = rel.split('.'),
    entry = uiDialList().find(e => e.path === rel);
  let o = t.defaults;
  for (const k of keys.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
  o[keys[keys.length - 1]] = uiNudge(uiGet(theme.defaults, rel), entry && entry.dial);
  const after = uiSheetVars(uiThemeCss(t)),
    names = new Set();
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (before[k] !== after[k]) names.add(k.slice(k.indexOf('|') + 1));
  return [...names].sort();
}
/** dials that act through something other than a variable, and the variable whose parts they change: the voice
 * font's size is its @font-face's size-adjust, on every part in --font-voice */
export const UI_DIAL_ALSO = /** @type {Record<string, string[]>} */ ({ 'type.voiceScale': ['--font-voice'] });
/** what a dial changes, for inspect and Connections: the variables it writes, or the one it acts through
 * @param {any} theme @param {string} rel */
export const uiDialReach = (theme, rel) => {
  const v = uiDialVars(theme, rel);
  return v.length ? v : UI_DIAL_ALSO[rel] || [];
};
/** every variable the dials write, and the dials that write it: {"--name": [rel, ...]} @param {any} theme */
export function uiVarDials(theme) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const e of uiDialList()) for (const v of uiDialReach(theme, e.path)) (out[v] = out[v] || []).push(e.path);
  return out;
}
