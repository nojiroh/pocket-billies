'use strict';
/* ================= POCKET BILLIES STUDIO · the shortcut sheet (studio track ST-2) =================
   `?` (outside a text field) lists the Studio's keys: the open tool's first (the pixel editor's come from the same
   table its keys use, logic/pixel-ops.js PIXEL_KEYS), then the rest. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { escapeHtml } from './game-stand-ins.js';
import { PIXEL_KEYS } from '../../game/js/logic/pixel-ops.js';
import { dialog, sectionShown, studioState } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  STUDIO_KEYS: [() => STUDIO_KEYS],
  openShortcutSheet: [() => openShortcutSheet, v => ((openShortcutSheet = v), provide({ openShortcutSheet }))],
  shortcutGroupHTML: [() => shortcutGroupHTML, v => (shortcutGroupHTML = v)],
  shortcutSheetHTML: [() => shortcutSheetHTML, v => (shortcutSheetHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ openShortcutSheet });
/* to-module: end */
const STUDIO_KEYS = [
  {
    name: 'Everywhere',
    keys: [
      ['Ctrl+S', 'Save to game (Propose changes on GitHub)'],
      ['Ctrl+Z', 'Undo: data and pixels, in the order you made them'],
      ['Ctrl+Shift+Z or Ctrl+Y', 'Redo'],
      ['Ctrl+K or /', 'Find any setting or thing'],
      ['Ctrl+L', 'Connections: what this uses and what uses it'],
      ['?', 'This sheet'],
      ['Shift-click a section', 'Open it in the right pane'],
    ],
  },
  {
    name: 'Handles (the edges of lists and panels)',
    keys: [
      ['Tab, then ← →', 'Move the edge 8 px (Shift: 32 px)'],
      ['Home / End', 'Smallest / largest'],
      ['Delete or double-click', 'Back to the preset’s size'],
    ],
  },
  {
    name: 'World map look (over the picture of the bowl)',
    when: () => sectionShown('world') && studioState.sel.wtab === 'look',
    keys: [
      ['V', 'Look (no brush)'],
      ['L', 'Land brush'],
      ['W', 'Sea brush'],
      ['X', 'Remove strokes'],
      ['[ and ]', 'Smaller and bigger brush'],
    ],
  },
  {
    name: 'Walk scenes (the map)',
    when: () => sectionShown('scenes'),
    keys: [
      ['B', 'Paint ground'],
      ['F', 'Fill'],
      ['P', 'Place and move props'],
      ['H', 'Shape the land'],
      ['C', 'Cliffs and stairs'],
      ['X', 'Hub and exits'],
      ['W', 'Edit the path'],
      ['Q', 'Kinds of water'],
      ['E', 'Remove props'],
      ['← → ↑ ↓', 'Nudge the selected prop (Shift: 1 m)'],
      ['Delete', 'Remove the selected prop'],
      ['Ctrl+C / Ctrl+V', 'Copy and paste the selected props'],
      ['Esc', 'Drop the selection or the road being drawn'],
    ],
  },
  {
    name: 'Free camera (pointer over the 3D preview)',
    when: () => sectionShown('scenes'),
    keys: [
      ['C', 'Free camera on or off'],
      ['W A S D', 'Move'],
      ['Q E', 'Turn'],
      ['R F', 'Tilt'],
      ['Page Up / Page Down', 'Rise and sink'],
    ],
  },
  {
    name: 'UI look',
    when: () => sectionShown('ui'),
    keys: [
      ['Hold C', 'Compare: the look as last saved'],
      ['Ctrl+Z', 'Undo a dial, a preset or a reset'],
      ['Ctrl+L', 'Connections: what a dial writes and the parts that read it'],
      ['Inspect', 'Tap a part in the preview: its variables and their dials'],
    ],
  },
  {
    name: 'Skeleton builder',
    when: () => !!$('.pxed.skel'),
    keys: [
      ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
      ['Delete', 'Remove the selected part'],
    ],
  },
];
function shortcutGroupHTML(name, keys) {
  return `<h3>${escapeHtml(name)}</h3><table class="keys">${keys
    .map(
      ([k, t]) =>
        `<tr><th>${k
          .split(/( or |, then |\/ )/)
          .map(p => (/^( or |, then |\/ )$/.test(p) ? escapeHtml(p) : `<kbd>${escapeHtml(p.trim())}</kbd>`))
          .join('')}</th><td>${escapeHtml(t)}</td></tr>`
    )
    .join('')}</table>`;
}
function shortcutSheetHTML() {
  const pixel = !!$('.pxed:not(.skel)') || !!$('#scPe'),
    groups = [];
  const px = ['Pixel canvas (sheets, props and ground tiles)', PIXEL_KEYS.map(k => [k.keys, k.label])];
  if (pixel) groups.push(px);
  for (const g of STUDIO_KEYS) if (g.when && g.when()) groups.push([g.name, g.keys]);
  for (const g of STUDIO_KEYS) if (!g.when) groups.push([g.name, g.keys]);
  if (!pixel) groups.push(px);
  for (const g of STUDIO_KEYS) if (g.when && !g.when()) groups.push([g.name, g.keys]);
  return `<div class="keys-sheet">${groups.map(([n, k]) => `<section>${shortcutGroupHTML(n, k)}</section>`).join('')}</div>`;
}
function openShortcutSheet() {
  if ($('#dlg').innerHTML) return;
  dialog('Keys', shortcutSheetHTML(), [{ l: 'Close', c: 'primary', v: 0 }], 'wide keys-dlg');
}
document.addEventListener('keydown', ev => {
  if (ev.key !== '?' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target;
  if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
  ev.preventDefault();
  openShortcutSheet();
});
