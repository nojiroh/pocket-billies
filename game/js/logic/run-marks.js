// @ts-check
'use strict';
/* ================= RUN MARKS (UI track UI-4) =================
   The run map's node markers as data: one outline per node type on a 100 x 100 box (ui-track.md "Meaning, lightly":
   diamond boss, hexagon town, chevron route, slanted event; RL-14 a cog for a scrapyard), the colour role each type and state takes, and a canvas
   painter for the bowl, which draws its pins on a 2D canvas (world-bowl.js worldBowlPin), not in the page. The kit's
   <pb-node> (js/ui-run-kit.js) draws the same outlines as SVG, so a marker reads the same on the bowl and in a list.
   UI-8c (Badges, the owner's pick): each place is also a 36 px pixel icon in art/ui (node-<shape>.svg, painted in the
   Studio's icon editor on these outlines), with node-check and node-lock for done and locked places. runMarkLook names
   the icon, its badge and its size; runMarkPixels turns the icon's pixels into the state's picture (the gold rim where
   you stand, done dimmed, locked grey), which the bowl draws (world-bowl.js worldBowlRunPin). runMarkDraw stays as the
   flat shape the bowl draws until an icon has loaded.
   Logic only: no DOM, runs in Node (tools/test/run-marks.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RUN_MARK_ART: [() => RUN_MARK_ART],
  RUN_MARK_SHAPES: [() => RUN_MARK_SHAPES],
  RUN_MARK_SIZES: [() => RUN_MARK_SIZES],
  RUN_MARK_STATES: [() => RUN_MARK_STATES],
  RUN_MARK_TONES: [() => RUN_MARK_TONES],
  RUN_MARK_TYPES: [() => RUN_MARK_TYPES],
  // @ts-expect-error -- replaced on purpose
  runMarkClip: [() => runMarkClip, v => (runMarkClip = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkDraw: [() => runMarkDraw, v => (runMarkDraw = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkGrey: [() => runMarkGrey, v => (runMarkGrey = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkLook: [() => runMarkLook, v => (runMarkLook = v)],
  // @ts-expect-error -- replaced on purpose
  runMarkPixels: [() => runMarkPixels, v => (runMarkPixels = v)],
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
  // RL-S2: the rival: a shield, point down
  rival: [
    [6, 6],
    [94, 6],
    [94, 56],
    [50, 98],
    [6, 56],
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
  rival: 'danger',
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
    /* UI-8c: the pixel icon (art/ui), the corner badge drawn over it, and its size on the map in CSS px */
    icon: `node-${shown}`,
    badge: state === 'visited' ? 'node-check' : state === 'locked' ? 'node-lock' : '',
    size: state === 'current' ? RUN_MARK_SIZES.current : RUN_MARK_SIZES.seen,
  };
}
/** UI-8c: a place's icon size on the map in CSS px (18 and 22 before; the owner's phone check may move them) */
export const RUN_MARK_SIZES = { seen: 28, current: 34 };
/** UI-8c: the icons' grid, how far the gold rim reaches past it (two art pixels), its colours (the set's golds), how
 * much a done place fades */
export const RUN_MARK_ART = {
  grid: 36,
  rim: 2,
  rimFill: [255, 224, 138],
  rimEdge: [176, 122, 30],
  dim: 0.62,
};
/** UI-8c: a locked place's grey for one colour (light kept, a touch of blue) @param {number} r @param {number} g
 * @param {number} b @returns {[number, number, number]} */
export function runMarkGrey(r, g, b) {
  const k = Math.round((0.3 * r + 0.59 * g + 0.11 * b) * 0.82 + 30);
  return [k, k, Math.min(255, k + 6)];
}
/** UI-8c: a place's picture for its state, from its icon's pixels (RGBA, grid x grid) and its badge's (or null). The
 * picture is (grid + 2 rim) square so the rim fits round it: where you stand a gold rim two art pixels wide follows the
 * icon's outline (its own edge darker); done places fade; locked ones turn grey; the badge goes on top unfaded.
 * @param {ArrayLike<number>} icon @param {ArrayLike<number> | null} badge @param {string} state
 * @returns {{ w: number, h: number, data: Uint8ClampedArray }} */
export function runMarkPixels(icon, badge, state) {
  const N = RUN_MARK_ART.grid,
    R = RUN_MARK_ART.rim,
    W = N + 2 * R,
    out = new Uint8ClampedArray(W * W * 4),
    solid = (/** @type {number} */ x, /** @type {number} */ y) =>
      x >= 0 && y >= 0 && x < N && y < N && icon[(y * N + x) * 4 + 3] >= 128,
    put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number[]} */ c, a = 255) => {
      const i = (y * W + x) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = a;
    };
  if (state === 'current') {
    /* the rim: every picture pixel within two art pixels of the icon (corners rounded off), its outer edge darker */
    const ring = new Uint8Array(W * W),
      on = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < W && y < W && ring[y * W + x];
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++)
        for (let dy = -R; dy <= R && !ring[y * W + x]; dy++)
          for (let dx = -R; dx <= R; dx++)
            if (Math.abs(dx) + Math.abs(dy) <= R + 1 && solid(x - R + dx, y - R + dy)) {
              ring[y * W + x] = 1;
              break;
            }
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++)
        if (ring[y * W + x])
          put(
            x,
            y,
            !on(x + 1, y) || !on(x - 1, y) || !on(x, y + 1) || !on(x, y - 1)
              ? RUN_MARK_ART.rimEdge
              : RUN_MARK_ART.rimFill
          );
  }
  const fade = state === 'visited' ? RUN_MARK_ART.dim : 1,
    grey = state === 'locked';
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      if (badge && badge[i + 3] >= 128) {
        put(x + R, y + R, [badge[i], badge[i + 1], badge[i + 2]]);
        continue;
      }
      if (icon[i + 3] < 128) continue;
      const c = grey ? runMarkGrey(icon[i], icon[i + 1], icon[i + 2]) : [icon[i], icon[i + 1], icon[i + 2]];
      /* faded over whatever is under it (the rim never is: a done place isn't where you stand) */
      put(x + R, y + R, c, Math.round(255 * fade));
    }
  return { w: W, h: W, data: out };
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
