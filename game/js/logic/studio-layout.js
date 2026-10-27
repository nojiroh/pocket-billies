// @ts-check
'use strict';
/* ================= STUDIO LAYOUT (studio track ST-1) =================
   The Studio's pane sizes as numbers: the width class of a pane (narrow, wide, ultra), a dragged size kept inside its
   limits, the saved layout read back safely, and the presets. Logic only: no DOM, runs in Node
   (tools/test/studio-layout.test.mjs). studio/js/layout.js puts it on the page. */
/** @typedef {{ nav: number | null, sizes: Record<string, Record<string, number>>, split: number | null, sec2: string | null, preset: string }} StudioLayout */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LAYOUT_LIMITS: [() => LAYOUT_LIMITS],
  LAYOUT_PRESETS: [() => LAYOUT_PRESETS],
  NAV_JOINED: [() => NAV_JOINED],
  PANE_WIDTHS: [() => PANE_WIDTHS],
  STUDIO_WORKSPACES: [() => STUDIO_WORKSPACES],
  // @ts-expect-error -- replaced on purpose
  layoutAdjusted: [() => layoutAdjusted, v => (layoutAdjusted = v)],
  // @ts-expect-error -- replaced on purpose
  layoutClamp: [() => layoutClamp, v => (layoutClamp = v)],
  // @ts-expect-error -- replaced on purpose
  layoutEmpty: [() => layoutEmpty, v => (layoutEmpty = v)],
  // @ts-expect-error -- replaced on purpose
  layoutPreset: [() => layoutPreset, v => (layoutPreset = v)],
  // @ts-expect-error -- replaced on purpose
  layoutRead: [() => layoutRead, v => (layoutRead = v)],
  // @ts-expect-error -- replaced on purpose
  layoutSizes: [() => layoutSizes, v => (layoutSizes = v)],
  // @ts-expect-error -- replaced on purpose
  navJoined: [() => navJoined, v => (navJoined = v)],
  // @ts-expect-error -- replaced on purpose
  navRows: [() => navRows, v => (navRows = v)],
  // @ts-expect-error -- replaced on purpose
  paneWidthClass: [() => paneWidthClass, v => (paneWidthClass = v)],
  // @ts-expect-error -- replaced on purpose
  workspaceOf: [() => workspaceOf, v => (workspaceOf = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* a pane at least this wide (CSS px) gets the class: narrow below the first, wide and ultra from the others. A
   1920 px window gives the pane about 1690 px and a 2560 px window about 2330 px */
export const PANE_WIDTHS = { narrow: 640, wide: 1600, ultra: 2200 };
/* the sizes a person can drag, in px: [smallest, largest]. split is pane 1's share of the two panes */
export const LAYOUT_LIMITS = { 'nav-w': [160, 420], 'list-w': [180, 720], 'side-w': [240, 960], split: [0.2, 0.8] };
/* a preset sets the nav and the list and side widths in every section (and clears the sizes saved per section);
   auto lets them follow the pane's width class */
export const LAYOUT_PRESETS = {
  auto: { name: 'Auto', note: 'Sizes follow the window', sizes: {} },
  compact: {
    name: 'Compact',
    note: 'Small lists and panels (tablets)',
    nav: 200,
    sizes: { 'list-w': 240, 'side-w': 290 },
  },
  wide: { name: 'Wide', note: 'For a 1920 px screen', nav: 232, sizes: { 'list-w': 340, 'side-w': 400 } },
  ultrawide: {
    name: 'Ultrawide',
    note: 'For a 2560 to 3440 px screen',
    nav: 260,
    sizes: { 'list-w': 400, 'side-w': 480 },
  },
  split: {
    name: 'Split',
    note: 'Two sections side by side, ultrawide sizes',
    nav: 232,
    sizes: { 'list-w': 340, 'side-w': 420 },
    split: 0.5,
  },
};

/** the width class of a pane this many px wide ('' between narrow and wide) */
export function paneWidthClass(w) {
  return w < PANE_WIDTHS.narrow ? 'narrow' : w >= PANE_WIDTHS.ultra ? 'ultra' : w >= PANE_WIDTHS.wide ? 'wide' : '';
}

/** a dragged size inside its limits (and below room, the most the pane can give), whole px; null for a size with no limits */
export function layoutClamp(key, v, room = Infinity) {
  const L = LAYOUT_LIMITS[key];
  if (!L || typeof v !== 'number' || !isFinite(v)) return null;
  const hi = Math.max(L[0], Math.min(L[1], room));
  const c = Math.min(hi, Math.max(L[0], v));
  return key === 'split' ? Math.round(c * 1000) / 1000 : Math.round(c);
}

/** an empty layout: no preset, no sizes */
export function layoutEmpty() {
  return /** @type {StudioLayout} */ ({ nav: null, sizes: {}, split: null, sec2: null, preset: 'auto' });
}

/** the saved layout (localStorage text) read back: anything unknown or out of range is dropped, never thrown */
export function layoutRead(text) {
  const out = layoutEmpty();
  let o;
  try {
    o = JSON.parse(text || 'null');
  } catch (e) {
    return out;
  }
  if (!o || typeof o !== 'object') return out;
  out.nav = layoutClamp('nav-w', o.nav);
  out.split = layoutClamp('split', o.split);
  if (typeof o.sec2 === 'string' && /^[a-z0-9_-]{1,40}$/i.test(o.sec2)) out.sec2 = o.sec2;
  if (typeof o.preset === 'string' && LAYOUT_PRESETS[o.preset]) out.preset = o.preset;
  if (o.sizes && typeof o.sizes === 'object')
    for (const sec of Object.keys(o.sizes)) {
      const s = o.sizes[sec];
      if (!/^[a-z0-9_-]{1,40}$/i.test(sec) || !s || typeof s !== 'object') continue;
      for (const k of ['list-w', 'side-w']) {
        const v = layoutClamp(k, s[k]);
        if (v !== null) (out.sizes[sec] = out.sizes[sec] || {})[k] = v;
      }
    }
  return out;
}

/** the layout after picking a preset: its sizes everywhere, the per-section sizes cleared, the split from the preset */
export function layoutPreset(lay, id) {
  const P = LAYOUT_PRESETS[id];
  if (!P) return lay;
  return { nav: P.nav || null, sizes: {}, split: P.split || null, sec2: lay.sec2, preset: id };
}

/** whether sizes were dragged since the preset was picked */
export function layoutAdjusted(lay) {
  const P = LAYOUT_PRESETS[lay.preset];
  return Object.keys(lay.sizes).length > 0 || (lay.nav || null) !== ((P && P.nav) || null);
}

/** the sizes a section shows with: the preset's, then the ones saved for that section */
export function layoutSizes(lay, sec) {
  const P = LAYOUT_PRESETS[lay.preset];
  return Object.assign({}, P ? P.sizes : {}, lay.sizes[sec] || {});
}

/* Studio art track SA-4: the sidebar's workspaces (Blender's idea: a workspace per kind of work), as section keys in
   the order they show. studio/js/studio-app.js's SECTION_LIST names the sections; a section in no workspace shows
   under More, which the Studio self-test reports */
/** @type {[string, string[]][]} */
export const STUDIO_WORKSPACES = [
  ['Game', ['rules', 'check']],
  ['Art', ['art', 'workbench']],
  ['Creatures', ['billionaires', 'roster', 'parts', 'genes', 'coats', 'moves', 'types', 'preview']],
  ['World', ['scenes', 'hub', 'props', 'world', 'engine', 'camera']],
  ['People & story', ['trainers', 'people', 'wardrobe', 'lore', 'story']],
  /* robots join the runs: bots are the runs' enemy faction (VISION.md); items are what a run's shops sell */
  ['Runs', ['runlab', 'relics', 'unlocks', 'economy', 'robots', 'items']],
  ['Sound & UI', ['music', 'ui']],
  ['Legacy', ['legacy']],
];
/* sections that share one row in the sidebar, under the row's own name; each of them shows a switch to the others */
export const NAV_JOINED = [{ name: 'Characters', keys: ['people', 'wardrobe'] }];

/** the joined row a section belongs to, or null */
export function navJoined(key) {
  return NAV_JOINED.find(j => j.keys.includes(key)) || null;
}

/**
 * The sidebar's rows: each workspace with its rows, a joined pair as one row (at its first section's place), the
 * sections no workspace lists under More, workspaces with no known section left out.
 * @param {string[]} keys the sections there are, in SECTION_LIST's order
 * @param {[string, string[]][]} [workspaces]
 * @param {{ name: string, keys: string[] }[]} [joined]
 * @returns {[string, { key: string, keys: string[], name: string | null }[]][]}
 */
export function navRows(keys, workspaces = STUDIO_WORKSPACES, joined = NAV_JOINED) {
  const known = new Set(keys),
    listed = new Set(workspaces.flatMap(w => w[1])),
    all = workspaces.concat([['More', keys.filter(k => !listed.has(k))]]);
  return all
    .map(([t, L]) => {
      /** @type {{ key: string, keys: string[], name: string | null }[]} */
      const rows = [];
      for (const k of L) {
        if (!known.has(k)) continue;
        const j = joined.find(x => x.keys.includes(k));
        if (!j) rows.push({ key: k, keys: [k], name: null });
        else if (!rows.some(r => r.keys.includes(k)))
          rows.push({ key: k, keys: j.keys.filter(x => known.has(x)), name: j.name });
      }
      return /** @type {[string, typeof rows]} */ ([t, rows]);
    })
    .filter(w => w[1].length);
}

/** the workspace a section shows in ('More' when none lists it) */
export function workspaceOf(key, workspaces = STUDIO_WORKSPACES) {
  const w = workspaces.find(x => x[1].includes(key));
  return w ? w[0] : 'More';
}
