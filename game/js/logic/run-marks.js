// @ts-check
'use strict';
/* ================= RUN MARKS (UI track UI-4) =================
   The run map's node markers as data: one outline per node type on a 100 x 100 box (ui-track.md "Meaning, lightly":
   diamond boss, hexagon town, chevron route, slanted event; RL-14 a cog for a scrapyard), the colour role each type and state takes, and a canvas
   painter for the bowl, which draws its pins on a 2D canvas (world-bowl.js worldBowlPin), not in the page. The kit's
   <pb-node> (js/ui-run-kit.js) draws the same outlines as SVG, so a marker reads the same on the bowl and in a list.
   Logic only: no DOM, runs in Node (tools/test/run-marks.test.mjs). Nothing calls the painter yet (RL-7 does). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RUN_MARK_SHAPES: [() => RUN_MARK_SHAPES],
  RUN_MARK_STATES: [() => RUN_MARK_STATES],
  RUN_MARK_TONES: [() => RUN_MARK_TONES],
  RUN_MARK_TYPES: [() => RUN_MARK_TYPES],
  // @ts-expect-error -- replaced on purpose
  runMarkClip: [() => runMarkClip, v => (runMarkClip = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkDraw: [() => runMarkDraw, v => (runMarkDraw = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkLook: [() => runMarkLook, v => (runMarkLook = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkPoints: [() => runMarkPoints, v => (runMarkPoints = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkShape: [() => runMarkShape, v => (runMarkShape = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the outlines, clockwise from the top, as [x, y] on a 100 x 100 box. A route points forward (up: runs go north) */
export const RUN_MARK_SHAPES = {
  // the landing: a square with its corners cut (where the airship sets you down)
  landing: [
    [28, 4],
    [72, 4],
    [96, 28],
    [96, 72],
    [72, 96],
    [28, 96],
    [4, 72],
    [4, 28],
  ],
  // a route: a chevron pointing forward
  route: [
    [50, 4],
    [96, 46],
    [96, 96],
    [50, 62],
    [4, 96],
    [4, 46],
  ],
  // a town: a hexagon, point up
  town: [
    [50, 2],
    [94, 26],
    [94, 74],
    [50, 98],
    [6, 74],
    [6, 26],
  ],
  // a mini-boss: a diamond with a notch in its top
  miniboss: [
    [36, 4],
    [50, 18],
    [64, 4],
    [98, 50],
    [50, 98],
    [2, 50],
  ],
  // the boss: a diamond
  boss: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
  // an event: a slanted card (the plan's 10° slant reads too faint at pin size; 20 on a 100 box is about 11°)
  event: [
    [22, 10],
    [98, 10],
    [78, 90],
    [2, 90],
  ],
  // a shop: slanted the other way
  shop: [
    [2, 10],
    [78, 10],
    [98, 90],
    [22, 90],
  ],
  // RL-14: a scrapyard: a cog, its four teeth square
  scrapyard: [
    [38, 4],
    [62, 4],
    [62, 18],
    [82, 18],
    [82, 38],
    [96, 38],
    [96, 62],
    [82, 62],
    [82, 82],
    [62, 82],
    [62, 96],
    [38, 96],
    [38, 82],
    [18, 82],
    [18, 62],
    [4, 62],
    [4, 38],
    [18, 38],
    [18, 18],
    [38, 18],
  ],
  // not yet seen ("?" pins, two rows ahead): a small diamond
  unknown: [
    [50, 14],
    [86, 50],
    [50, 86],
    [14, 50],
  ],
};
/** the node types, in the order the gallery shows them */
export const RUN_MARK_TYPES = /** @type {(keyof typeof RUN_MARK_SHAPES)[]} */ (Object.keys(RUN_MARK_SHAPES));
/** the states a marker can be in: seen (its type shown), current (you are here), visited, locked, hidden ("?") */
export const RUN_MARK_STATES = ['seen', 'current', 'visited', 'locked', 'hidden'];
/** each type's colour role (uiTheme.json's roles: primary, gold, danger; surface is the plain card) */
export const RUN_MARK_TONES = {
  landing: 'primary',
  route: 'surface',
  town: 'primary',
  miniboss: 'danger',
  boss: 'danger',
  event: 'gold',
  shop: 'gold',
  scrapyard: 'danger',
  unknown: 'muted',
};

/** a type's outline ('unknown' for a type it doesn't know) @param {string} type */
export function runMarkShape(type) {
  return /** @type {any} */ (RUN_MARK_SHAPES)[type] || RUN_MARK_SHAPES.unknown;
}
/** what a marker draws: its outline (a hidden node shows the "?" diamond whatever its type), its colour role and
 * whether it glows (current) or fades (visited, locked) @param {string} type @param {string} [state] */
export function runMarkLook(type, state = 'seen') {
  const shown = state === 'hidden' ? 'unknown' : type in RUN_MARK_SHAPES ? type : 'unknown';
  return {
    shape: shown,
    points: runMarkShape(shown),
    tone: state === 'locked' ? 'muted' : state === 'current' ? 'gold' : /** @type {any} */ (RUN_MARK_TONES)[shown],
    glow: state === 'current',
    faded: state === 'visited' || state === 'locked',
    glyph: state === 'hidden' ? '?' : state === 'locked' ? 'lock' : state === 'visited' ? 'check' : '',
  };
}
/** the outline as an SVG points list @param {string} type */
export function runMarkPoints(type) {
  return runMarkShape(type)
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}
/** the outline as a CSS clip-path @param {string} type */
export function runMarkClip(type) {
  return `polygon(${runMarkShape(type)
    .map(([x, y]) => `${x}% ${y}%`)
    .join(', ')})`;
}

/** draws a marker centred on (x, y), size px across, on a 2D canvas. colors maps a role (primary, gold, danger,
 * surface, muted) to {fill, edge}; the caller reads them from the look (getComputedStyle) so the marker follows
 * uiTheme.json. Pixel-snapped so the 1 px edge stays sharp next to the 32 px art.
 * @param {any} ctx a CanvasRenderingContext2D (or anything with its path calls)
 * @param {number} x @param {number} y @param {number} size @param {string} type @param {string} state
 * @param {Record<string, {fill: string, edge: string}>} colors */
export function runMarkDraw(ctx, x, y, size, type, state, colors) {
  const look = runMarkLook(type, state),
    c = colors[look.tone] || colors.surface,
    k = size / 100,
    ox = Math.round(x - size / 2) + 0.5,
    oy = Math.round(y - size / 2) + 0.5;
  ctx.save();
  ctx.globalAlpha = look.faded ? 0.55 : 1;
  ctx.beginPath();
  look.points.forEach(([px, py], i) => {
    const sx = Math.round(ox + px * k) + 0.5,
      sy = Math.round(oy + py * k) + 0.5;
    if (i) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
  });
  ctx.closePath();
  if (look.glow) {
    ctx.shadowColor = c.fill;
    ctx.shadowBlur = Math.max(4, size / 4);
  }
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = c.edge;
  ctx.stroke();
  ctx.restore();
  return look;
}
