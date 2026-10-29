'use strict';
/* ================= THE MINIMAP (UI track UI-8) =================
   The bottom bar's middle tile (<pb-nav-bar>, slot "map"): the ground you walk on, north up, centred on you, a few
   times a second. Tapping it opens the Map tab (the bar does that). Shown (the owner's choices, 2026-10-26): the
   ground by kind (grass, encounter grass, roads, water, sand, rock, snow, forest walls), the buildings' roofs, an icon
   on each facility you can use (clinic, shop, lab, ranch, Gene Bank, workshop, the station, home: never on plain
   houses, so it stays calm), trainers not yet beaten, and the wild Billies out in the grass. No doors, exits or
   arrows. Indoors, the room's floor alone.
   The ground is painted once per view at 1 px a metre (tiles: row 0 is the north edge) into a small canvas and scaled
   up without smoothing, so it reads as pixels beside the 32 px art; only the marks are drawn each time. Colours are
   the theme's roles mixed (uiTheme.json), so light, dark and every preset follow with no colours of its own.
   While you walk a few seconds the bar goes compact (owner's choice); it comes back when you stop. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { TRAINERS } from './game-data.js';
import { turnedBounds } from './logic/prop-turn.js';
import { runIconURL } from './ui-run-kit.js';
import { activeBattle, saveData, uiState } from './game-state.js';
import { frameTask } from './frame-scheduler.js';
import { walkData, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
/* eslint-disable no-func-assign */
expose({
  MINIMAP_ICONS: [() => MINIMAP_ICONS],
  MINIMAP_KIND_BY_TILE: [() => MINIMAP_KIND_BY_TILE],
  minimap: [() => minimap],
  minimapCanvas: [() => minimapCanvas, v => (minimapCanvas = v)],
  minimapCompact: [() => minimapCompact, v => (minimapCompact = v)],
  minimapCss: [() => minimapCss],
  minimapDials: [() => minimapDials, v => (minimapDials = v)],
  minimapDraw: [() => minimapDraw, v => (minimapDraw = v)],
  minimapIcon: [() => minimapIcon, v => (minimapIcon = v)],
  minimapMix: [() => minimapMix],
  minimapOK: [() => minimapOK, v => (minimapOK = v)],
  minimapPaint: [() => minimapPaint, v => (minimapPaint = v)],
  minimapPalette: [() => minimapPalette, v => (minimapPalette = v)],
  minimapRole: [() => minimapRole, v => (minimapRole = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the minimap's state: its canvas, the painted ground and the key it was painted for */
const minimap = {
  cv: /** @type {HTMLCanvasElement | null} */ (null),
  ground: /** @type {HTMLCanvasElement | null} */ (null),
  key: '',
  look: '',
  pal: /** @type {Record<string, number[]>} */ ({}),
  icons: /** @type {Record<string, HTMLImageElement>} */ ({}),
  /** the facilities' icons in place metres: [{icon, x, z}] */
  marks: /** @type {{icon: string, x: number, z: number}[]} */ ([]),
  /** when the walk started (ms, 0 standing), when it stopped */
  walkT: 0,
  stopT: 0,
  draws: 0,
};

/** the dials (uiTheme.json minimap, written as --minimap-* by the theme; tokens.css holds the defaults): metres
 * across the tile's shorter side (UI-8b: top to bottom on the wide tile; the same in both sizes, so going compact only
 * scales the picture), ms of walking before the bar
 * goes compact and of standing before it comes back, and which marks show */
function minimapDials() {
  const cs = getComputedStyle(/** @type {HTMLCanvasElement} */ (minimap.cv)),
    num = (/** @type {string} */ k, /** @type {number} */ d) => {
      const v = parseFloat(cs.getPropertyValue(k));
      return Number.isFinite(v) ? v : d;
    };
  return {
    span: Math.max(8, num('--minimap-span', 44)),
    compactAfter: num('--minimap-compact-after', 2500),
    fullAfter: num('--minimap-full-after', 700),
    facilities: num('--minimap-facilities', 1) > 0,
    trainers: num('--minimap-trainers', 1) > 0,
    billies: num('--minimap-billies', 1) > 0,
  };
}
/** a facility's icon (art/ui) by what its door does (scenery props' act) */
const MINIMAP_ICONS = {
  clinic: 'heart',
  shop: 'shop',
  stall: 'shop',
  lab: 'research',
  ranch: 'leaf',
  pasture: 'leaf',
  genebank: 'dna',
  workshop: 'scrap',
  station: 'flag',
  fly: 'flag',
  home: 'house',
};
/** the ground's kinds by tile (scenery.json terrains); anything else is plain grass */
const MINIMAP_KIND_BY_TILE = {
  t: 'tall',
  w: 'water',
  d: 'water',
  s: 'sand',
  S: 'sand',
  N: 'sand',
  r: 'rock',
  k: 'rock',
};
Object.assign(MINIMAP_KIND_BY_TILE, { j: 'rock', W: 'rock', n: 'snow', I: 'snow', R: 'marsh', D: 'marsh' });

/** the canvas the bar shows in its tile (made once; the bar puts it in its slot) */
export function minimapCanvas() {
  if (!minimap.cv) {
    const cv = document.createElement('canvas');
    cv.slot = 'map';
    cv.className = 'minimap';
    cv.setAttribute('aria-hidden', 'true');
    minimap.cv = cv;
  }
  return minimap.cv;
}

/** a colour role of the theme as [r, g, b] (the page resolves the variable, mixes and all) @param {string} role */
function minimapRole(role) {
  const cv = /** @type {HTMLCanvasElement} */ (minimap.cv);
  cv.style.color = `var(${role})`;
  const c = getComputedStyle(cv).color,
    n = (c.match(/[\d.]+/g) || []).map(Number);
  cv.style.color = '';
  /* rgb(r, g, b) or color(srgb r g b) (0-1) */
  return c.startsWith('color(') ? n.slice(0, 3).map(v => Math.round(v * 255)) : n.slice(0, 3);
}
/** a share t of colour b over a */
const minimapMix = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) =>
  a.map((v, i) => Math.round(v + (b[i] - v) * t));
const minimapCss = (/** @type {number[]} */ c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/** the palette, from the theme's roles; remade when the theme changes */
function minimapPalette() {
  const surface = minimapRole('--c-surface'),
    text = minimapRole('--c-text'),
    text2 = minimapRole('--c-text2'),
    goldA = minimapRole('--c-gold-a'),
    goldB = minimapRole('--c-gold-b'),
    danger = minimapRole('--c-danger'),
    teal = minimapRole('--c-hp-ok'),
    /* UI-12: the palette's own grass and water (uiTheme.json mapGrass, mapWater), so a blue or purple palette keeps a
       green map; without them primary and the HP teal, as before */
    grassHue = minimapRole('--c-map-grass, var(--c-primary)'),
    waterHue = minimapRole('--c-map-water, var(--c-hp-ok)');
  minimap.pal = {
    surface,
    text,
    goldA,
    goldB,
    danger,
    teal,
    grass: minimapMix(surface, grassHue, 0.34),
    tall: minimapMix(surface, grassHue, 0.62),
    road: minimapMix(surface, goldA, 0.42),
    water: minimapMix(surface, waterHue, 0.55),
    sand: minimapMix(surface, goldA, 0.22),
    rock: minimapMix(surface, text2, 0.38),
    snow: minimapMix(surface, text2, 0.06),
    marsh: minimapMix(minimapMix(surface, grassHue, 0.4), text2, 0.3),
    wall: minimapMix(minimapMix(surface, grassHue, 0.7), text, 0.35),
    roof: minimapMix(text, surface, 0.18),
  };
}

/** paint the view's ground: one pixel a metre, north up, roofs on the buildings */
function minimapPaint() {
  const sc = walkView.sc,
    terr = (walkData().sc && walkData().sc.terrains) || {},
    props = (walkData().sc && walkData().sc.props) || {},
    P = minimap.pal,
    W = Math.max(1, sc.w | 0),
    H = Math.max(1, sc.h | 0);
  const g = minimap.ground || (minimap.ground = document.createElement('canvas'));
  g.width = W;
  g.height = H;
  const c = /** @type {CanvasRenderingContext2D} */ (g.getContext('2d')),
    img = c.createImageData(W, H),
    px = img.data,
    kinds = /** @type {Record<string, number[]>} */ ({});
  const kindOf = (/** @type {string} */ ch) => {
    if (kinds[ch]) return kinds[ch];
    const T = terr[ch] || {};
    const k =
      MINIMAP_KIND_BY_TILE[ch] || (T.walk === false ? 'wall' : T.paved || 'pcmbaqhe'.includes(ch) ? 'road' : 'grass');
    return (kinds[ch] = P[k]);
  };
  const tiles = sc.tiles || [];
  for (let j = 0; j < H; j++) {
    const row = tiles[j] || '';
    for (let i = 0; i < W; i++) {
      const col = kindOf(row[i] || sc.edge || 'g'),
        o = (j * W + i) * 4;
      px[o] = col[0];
      px[o + 1] = col[1];
      px[o + 2] = col[2];
      px[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  /* the countryside round a seamless place (outside its walkable rectangles) is shown paler */
  if (Array.isArray(sc.inside) && sc.inside.length) {
    c.save();
    c.beginPath();
    c.rect(0, 0, W, H);
    for (const r of sc.inside) c.rect(r[0], H - r[3], r[2] - r[0], r[3] - r[1]);
    c.fillStyle = minimapCss(P.surface, 0.4);
    c.fill('evenodd');
    c.restore();
  }
  /* the buildings' roofs (a door and a box): their footprint runs north from the door */
  const marks = [];
  c.fillStyle = minimapCss(P.roof);
  for (const p of sc.props || []) {
    const M = props[p.k];
    if (!M || !M.box) continue;
    const w = M.box[0] * (p.s || 1),
      d = M.box[1] * (p.s || 1),
      R = turnedBounds(p, -w / 2, -0.1, w / 2, d);
    c.fillRect(
      Math.round(R[0]),
      Math.round(H - R[3]),
      Math.max(1, Math.round(R[2] - R[0])),
      Math.max(1, Math.round(R[3] - R[1]))
    );
    const icon = MINIMAP_ICONS[p.act || M.act];
    if (icon) marks.push({ icon, x: (R[0] + R[2]) / 2, z: (R[1] + R[3]) / 2 });
  }
  minimap.marks = marks;
}

/** a facility icon's picture (loaded once) @param {string} k */
function minimapIcon(k) {
  let im = minimap.icons[k];
  if (!im) {
    im = minimap.icons[k] = new Image();
    im.src = runIconURL(k);
  }
  return im.complete && im.naturalWidth ? im : null;
}

/** may it draw now: the bar shown, a walk view ready and nothing borrowing it */
function minimapOK() {
  const cv = minimap.cv;
  return (
    !!cv &&
    cv.isConnected &&
    !document.hidden &&
    !(/** @type {any} */ (cv.parentElement).hidden) &&
    walkView.ready &&
    !!walkView.sc &&
    !!walkView.pl &&
    !walkView.director &&
    !walkRenderer.bt &&
    !activeBattle
  );
}

/** the bar compact while you walk (a few seconds in), full again once you stop; never with Settings' "Shrink the bar
    while walking" off (preferences.navShrink) */
function minimapCompact(/** @type {number} */ now, /** @type {ReturnType<typeof minimapDials>} */ D) {
  const nav = /** @type {any} */ (minimap.cv && minimap.cv.parentElement);
  if (!nav) return;
  if ((saveData.preferences || {}).navShrink === 'off') {
    minimap.walkT = minimap.stopT = 0;
    if (nav.compact) nav.compact = false;
    return;
  }
  const walking = uiState.tab === 'walk' && !!walkView.pl && !!walkView.pl.walk;
  if (walking) {
    minimap.stopT = 0;
    if (!minimap.walkT) minimap.walkT = now;
  } else {
    minimap.walkT = 0;
    if (!minimap.stopT) minimap.stopT = now;
  }
  const want = nav.compact
    ? !(minimap.stopT && now - minimap.stopT >= D.fullAfter)
    : !!(minimap.walkT && now - minimap.walkT >= D.compactAfter);
  if (want !== !!nav.compact) nav.compact = want;
}

/** one picture: the ground round you, then the facilities, trainers, wild Billies and you */
function minimapDraw(now = performance.now()) {
  if (!minimap.cv || !minimap.cv.isConnected) return false;
  const D = minimapDials();
  minimapCompact(now, D);
  if (!minimapOK()) return false;
  const cv = /** @type {HTMLCanvasElement} */ (minimap.cv),
    dpr = Math.min(2, window.devicePixelRatio || 1),
    cw = cv.clientWidth,
    ch = cv.clientHeight;
  if (!cw || !ch) return false;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
  }
  const cs = getComputedStyle(cv),
    look =
      cs.getPropertyValue('--c-surface') +
      cs.getPropertyValue('--c-map-grass') +
      document.documentElement.dataset.theme;
  if (look !== minimap.look) {
    minimap.look = look;
    minimapPalette();
    minimap.key = '';
  }
  const sc = walkView.sc,
    key = `${walkView.id}|${sc.w}x${sc.h}|${(sc.props || []).length}|${sc.roomRect || ''}`;
  if (key !== minimap.key) {
    minimap.key = key;
    minimapPaint();
  }
  const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')),
    W = cv.width,
    H = cv.height,
    /* UI-8b: metres per pixel from the shorter side, so the wide tile keeps span top to bottom and shows more across */
    S = Math.min(W, H),
    s = S / D.span,
    Pl = walkView.pl,
    P = minimap.pal,
    /* a place's metres on the canvas (north up: z grows upward) */
    toX = (/** @type {number} */ x) => W / 2 + (x - Pl.x) * s,
    toY = (/** @type {number} */ z) => H / 2 - (z - Pl.z) * s;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false;
  c.fillStyle = minimapCss(P.grass);
  c.fillRect(0, 0, W, H);
  c.drawImage(/** @type {HTMLCanvasElement} */ (minimap.ground), toX(0), toY(sc.h), sc.w * s, sc.h * s);
  /* indoors: the room's floor alone */
  const RR = sc.roomRect;
  if (RR) {
    c.beginPath();
    c.rect(0, 0, W, H);
    c.rect(toX(RR[0]), toY(RR[1] + RR[3]), RR[2] * s, RR[3] * s);
    c.fillStyle = minimapCss(P.surface);
    c.fill('evenodd');
  }
  /* the marks keep their size in metres (a 120 px side makes unit the device pixel ratio) */
  const unit = Math.max(1, S / 120),
    inView = (/** @type {number} */ x, /** @type {number} */ y, m = 8 * unit) =>
      x > -m && y > -m && x < W + m && y < H + m;
  /* the facilities' icons, upright and the same size at any zoom */
  if (!RR && D.facilities) {
    const icon = Math.round((S >= 100 * dpr ? 16 : 11) * dpr);
    for (const m of minimap.marks || []) {
      const x = toX(m.x),
        y = toY(m.z),
        im = minimapIcon(m.icon);
      if (im && inView(x, y)) c.drawImage(im, Math.round(x - icon / 2), Math.round(y - icon / 2), icon, icon);
    }
  }
  /* trainers you haven't beaten: a diamond in the danger colour */
  const dot = Math.max(5, 6 * unit);
  for (const id of D.trainers ? Object.keys(walkView.npcAt || {}) : []) {
    const base = id.replace(/~b$/, '');
    if (!TRAINERS[base] || saveData.flags[base]) continue;
    const at = walkView.npcAt[id],
      x = toX(at[0]),
      y = toY(at[1]);
    if (!inView(x, y)) continue;
    c.save();
    c.translate(x, y);
    c.rotate(Math.PI / 4);
    c.fillStyle = minimapCss(P.surface);
    c.fillRect(-dot / 2 - unit, -dot / 2 - unit, dot + 2 * unit, dot + 2 * unit);
    c.fillStyle = minimapCss(P.danger);
    c.fillRect(-dot / 2, -dot / 2, dot, dot);
    c.restore();
  }
  /* the wild Billies out in the world: a round dot (pins stay round) */
  for (const e of D.billies ? walkRenderer.encPos || [] : []) {
    const x = toX(e[0]),
      y = toY(e[1]);
    if (!inView(x, y)) continue;
    c.beginPath();
    c.arc(x, y, dot / 2 + unit, 0, Math.PI * 2);
    c.fillStyle = minimapCss(P.surface);
    c.fill();
    c.beginPath();
    c.arc(x, y, dot / 2, 0, Math.PI * 2);
    c.fillStyle = minimapCss(P.teal);
    c.fill();
  }
  /* you: a gold chevron in the middle, pointing the way you face */
  const turn = { up: 0, sideR: 0.5, down: 1, side: 1.5 }[Pl.dir] || 0,
    r = Math.max(6, 7 * unit);
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(turn * Math.PI);
  c.beginPath();
  c.moveTo(0, -r);
  c.lineTo(r * 0.8, r * 0.8);
  c.lineTo(0, r * 0.35);
  c.lineTo(-r * 0.8, r * 0.8);
  c.closePath();
  c.lineWidth = 2 * unit;
  c.strokeStyle = minimapCss(P.text);
  c.stroke();
  const gold = c.createLinearGradient(0, -r, 0, r);
  gold.addColorStop(0, minimapCss(P.goldA));
  gold.addColorStop(1, minimapCss(P.goldB));
  c.fillStyle = gold;
  c.fill();
  c.restore();
  /* north */
  c.font = `${Math.round(12 * dpr)}px ${getComputedStyle(cv).getPropertyValue('--font-voice') || 'sans-serif'}`;
  c.textAlign = 'right';
  c.textBaseline = 'top';
  c.fillStyle = minimapCss(P.text, 0.75);
  c.fillText('N', W - 5 * dpr, 4 * dpr);
  minimap.draws++;
  return true;
}

/* a few times a second, on the page's one frame loop (frame-scheduler.js) */
frameTask(
  'minimap',
  ts => {
    try {
      minimapDraw(ts);
    } catch (e) {
      if (typeof debugLog !== 'undefined') debugLog.add('error', 'minimap: ' + ((e && e.message) || e));
    }
  },
  () => 5
);
