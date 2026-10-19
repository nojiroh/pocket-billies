'use strict';
/* ================= POCKET BILLIES STUDIO · World map look (phase 10, session 5) =================
   game/data/worldmap.json: the world map's sea (how much, how rough, the rise to the rim, a seed, and brush strokes that
   force land or sea), the relief per kind of place, each region's ground (between places, wet lowland, dry slopes,
   high ground) and trees, and each kind of place's own ground. A picture of the bowl from above is worked out with the
   game's own logic (game/js/logic/bowl.js, bowl-things.js) as you edit; "Open the 3D bowl" opens the game's world map
   with your unsaved changes. Every edit is a data edit: one step of the Studio's one undo (studio track ST-2), a brush
   stroke included. World & encounters → World map look. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import {
  bowlCoastAt,
  bowlGridHeight,
  bowlGroundGrid,
  bowlReliefFeatures,
  bowlSeaInput,
  bowlSpotOf,
  bowlSun,
  bowlWaterLevel,
  bowlWetAt,
  bowlXY,
} from '../../game/js/logic/bowl.js';
import { bowlClumps, bowlLandmarkPick } from '../../game/js/logic/bowl-things.js';
import { artURL } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  afterRender,
  ask,
  card,
  changed,
  commit,
  grid,
  numberField,
  rangeField,
  readPath,
  render,
  studioBroadcast,
  studioState,
  toast,
  writePath,
} from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  WML_PIC: [() => WML_PIC],
  WML_REGION_PARTS: [() => WML_REGION_PARTS],
  WML_TREES: [() => WML_TREES],
  WML_TREE_NAMES: [() => WML_TREE_NAMES],
  wml: [() => wml],
  wmlBind: [() => wmlBind, v => (wmlBind = v)],
  wmlChips: [() => wmlChips, v => (wmlChips = v)],
  wmlData: [() => wmlData],
  wmlDraw: [() => wmlDraw, v => (wmlDraw = v)],
  wmlGround: [() => wmlGround, v => (wmlGround = v)],
  wmlPoint: [() => wmlPoint, v => (wmlPoint = v)],
  wmlRoads: [() => wmlRoads, v => (wmlRoads = v)],
  wmlSeaShare: [() => wmlSeaShare, v => (wmlSeaShare = v)],
  wmlTerrains: [() => wmlTerrains],
  worldMapLookTab: [() => worldMapLookTab, v => ((worldMapLookTab = v), provide({ worldMapLookTab }))],
});
/* eslint-enable no-func-assign */
provide({ worldMapLookTab });
/* to-module: end */
const WML_PIC = 440; /* the preview's pixels across */
const WML_TREES = ['round', 'cone', 'tall', 'mushroom', 'palm', 'bush', 'crystal', 'dry'];
const WML_TREE_NAMES = {
  round: 'Round',
  cone: 'Pines',
  tall: 'Tall',
  mushroom: 'Mushrooms',
  palm: 'Palms',
  bush: 'Bushes',
  crystal: 'Crystals',
  dry: 'Dry scrub',
};
const WML_REGION_PARTS = [
  ['ground', 'Ground between places'],
  ['wet', 'Wet lowland'],
  ['dry', 'Dry slopes'],
  ['high', 'High ground'],
];
/* the brush and the preview's state (kept off the data, so it is not saved and not undone) */
const wml = { tool: 'look', r: 0.03, stroke: null, hover: false, key: '', pic: null, share: null, ms: 0 };
const wmlData = () => studioState.D.worldmap;

/* ---------- the picture from above, with the game's own logic ---------- */
function wmlRoads(D) {
  return (D.roads || [])
    .map(l => PB_DATA.road(D, l))
    .filter(r => r.kind === 'seam')
    .map(r => [r.a, r.b]);
}
/* works the ground out again only when what it depends on changed */
function wmlGround() {
  const D = studioState.D,
    W = wmlData(),
    key = JSON.stringify([W, D.locations.map(l => [l.bowl, l.t, l.region, l.mapId]), D.roads]);
  if (wml.key === key && wml.pic) return wml.pic;
  const t0 = performance.now(),
    roads = wmlRoads(D),
    mapOf = l => (D.maps && D.maps[l.mapId]) || null,
    S = bowlSeaInput(D.locations, roads, mapOf, 1000, W.sea),
    G = bowlGroundGrid(bowlReliefFeatures(D.locations, W.relief), 200, S),
    byId = id => D.locations.find(l => l.id === id),
    spots = D.locations.map(l => {
      const s = bowlSpotOf(l, byId),
        [x, y] = bowlXY(s.a, s.r);
      return { x, y, under: s.under };
    }),
    places = D.locations
      .map((l, i) => ({ l, s: spots[i] }))
      .filter(q => !q.s.under)
      .map(({ l, s }) => {
        const m = mapOf(l);
        return { x: s.x, y: s.y, reach: m ? Math.hypot(m.w, m.h) / 2000 : 0.06, region: l.region || 'starter', l };
      }),
    trees = Object.fromEntries(Object.entries(W.regions).map(([k, R]) => [k, R.trees])),
    rel = (x, y) => bowlGridHeight(G, x, y) - bowlWaterLevel(x, y),
    clumps = bowlClumps(G, places, S.roads, rel, undefined, trees);
  let sea = 0,
    all = 0;
  for (let j = 0; j <= G.n; j++)
    for (let i = 0; i <= G.n; i++) {
      const x = -1 + (2 * i) / G.n,
        y = -1 + (2 * j) / G.n;
      if (x * x + y * y > 1) continue;
      all++;
      if (G.c[j * (G.n + 1) + i] > 0) sea++;
    }
  wml.key = key;
  wml.share = sea / all;
  wml.pic = { G, S, spots, places, clumps, rel };
  wml.ms = Math.round(performance.now() - t0);
  return wml.pic;
}
/* how much of the bowl is sea, painting included (the Studio check warns outside 30-50%) */
export function wmlSeaShare() {
  if (!wmlData()) return null;
  wmlGround();
  return wml.share;
}
/* the picture: sea by depth, land by wetness and height with hill shading from the slanted sun, rivers, routes,
   clumps, landmarks and the places' names */
function wmlDraw() {
  const cv = $('#wmlPic');
  if (!cv || !wmlData()) return;
  const P = wmlGround(),
    { G, rel } = P,
    N = WML_PIC,
    x = cv.getContext('2d'),
    img = x.createImageData(N, N),
    sun = bowlSun();
  for (let py = 0; py < N; py++)
    for (let px = 0; px < N; px++) {
      const bx = ((px + 0.5) / N) * 2 - 1,
        by = 1 - ((py + 0.5) / N) * 2,
        o = (py * N + px) * 4;
      if (bx * bx + by * by > 1) {
        img.data[o + 3] = 0;
        continue;
      }
      const c = bowlCoastAt(G, bx, by),
        h = rel(bx, by);
      let col;
      if (c > 0) {
        const d = Math.min(1, -h / 0.03);
        col = [60 - 40 * d, 150 - 80 * d, 190 - 60 * d];
      } else {
        const wet = bowlWetAt(G, bx, by),
          e = 0.004,
          sx = (rel(bx + e, by) - rel(bx - e, by)) / (2 * e),
          sy = (rel(bx, by + e) - rel(bx, by - e)) / (2 * e),
          lit = Math.max(0.55, Math.min(1.35, 1 - (sx * sun.dir[0] + sy * sun.dir[1]) * 1.6));
        col = [158 - 70 * wet, 145 - 10 * wet, 92 - 20 * wet];
        if (c > -0.006 && h < 0.006) col = [214, 200, 150];
        if (h > 0.085) col = [236, 238, 244];
        col = col.map(v => v * lit);
      }
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  x.clearRect(0, 0, N, N);
  x.putImageData(img, 0, 0);
  const at = (bx, by) => [((bx + 1) / 2) * N, ((1 - by) / 2) * N];
  /* rivers, routes, clumps */
  x.lineCap = 'round';
  x.strokeStyle = '#3f86c9';
  x.lineWidth = 1.5;
  for (const r of G.rivers || []) {
    x.beginPath();
    r.forEach(([a, b], k) => (k ? x.lineTo(...at(a, b)) : x.moveTo(...at(a, b))));
    x.stroke();
  }
  for (const [ax, ay, bx, by] of P.S.roads) {
    x.strokeStyle = '#3a2a1a';
    x.lineWidth = 3.5;
    x.beginPath();
    x.moveTo(...at(ax, ay));
    x.lineTo(...at(bx, by));
    x.stroke();
    x.strokeStyle = '#f2e2b8';
    x.lineWidth = 1.6;
    x.stroke();
  }
  x.fillStyle = 'rgba(30,70,30,.8)';
  for (const t of P.clumps) {
    const [u, v] = at(t.x, t.y);
    x.fillRect(u - 0.8, v - 0.8, 1.6, 1.6);
  }
  /* the places and their landmarks */
  const D = studioState.D,
    A = (D.scenery && D.scenery.props) || {};
  x.font = '10px system-ui, sans-serif';
  x.textAlign = 'center';
  P.places.forEach(q => {
    const [u, v] = at(q.x, q.y),
      lm = bowlLandmarkPick(q.l, D.maps && D.maps[q.l.mapId], A);
    x.fillStyle = q.l.town ? '#d9482b' : '#fff';
    x.strokeStyle = '#222';
    x.lineWidth = 1;
    x.beginPath();
    x.arc(u, v, q.l.town ? 3.5 : 2.6, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.fillStyle = '#111';
    /* names for towns and the picked stop only, so the picture stays readable; ▲ marks a landmark */
    if (q.l.town || D.locations[studioState.sel.stop] === q.l) x.fillText(q.l.name + (lm ? ' ▲' : ''), u, v - 6);
    else if (lm) x.fillText('▲', u, v - 5);
  });
  /* the brush strokes, faint, and the one being drawn */
  const strokes = [...(wmlData().sea.paint || []), ...(wml.stroke ? [wml.stroke] : [])];
  for (const s of strokes) {
    x.strokeStyle = s.land ? 'rgba(120,200,90,.55)' : 'rgba(40,110,220,.55)';
    x.lineWidth = Math.max(2, (s.r * N) / 1);
    x.beginPath();
    s.pts.forEach(([a, b], k) => (k ? x.lineTo(...at(a, b)) : x.moveTo(...at(a, b))));
    if (s.pts.length === 1) x.lineTo(...at(s.pts[0][0] + 1e-4, s.pts[0][1]));
    x.stroke();
  }
  const o = $('#wmlShare');
  if (o)
    o.textContent = `${Math.round(wml.share * 100)}% of the bowl is sea (painting included); ${(G.rivers || []).length} rivers, ${P.clumps.length} trees in clumps; worked out in ${wml.ms} ms`;
}

/* ---------- the brush ---------- */
function wmlPoint(ev) {
  const cv = $('#wmlPic'),
    r = cv.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * 2 - 1, 1 - ((ev.clientY - r.top) / r.height) * 2];
}
function wmlBind() {
  const cv = $('#wmlPic');
  if (!cv) return;
  wmlDraw();
  cv.onpointerenter = () => (wml.hover = true);
  cv.onpointerleave = () => (wml.hover = false);
  cv.onpointerdown = ev => {
    if (wml.tool === 'look') return;
    const p = wmlPoint(ev);
    cv.setPointerCapture(ev.pointerId);
    if (wml.tool === 'remove') {
      const S = wmlData().sea,
        before = (S.paint || []).length;
      S.paint = (S.paint || []).filter(s => !s.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < s.r + 0.01));
      if (S.paint.length !== before) {
        changed();
        commit(true);
        wmlDraw();
      }
      return;
    }
    wml.stroke = { land: wml.tool === 'land', r: wml.r, pts: [p.map(v => Math.round(v * 1000) / 1000)] };
    wmlDraw();
  };
  cv.onpointermove = ev => {
    if (!wml.stroke) return;
    const p = wmlPoint(ev),
      L = wml.stroke.pts[wml.stroke.pts.length - 1];
    if (Math.hypot(p[0] - L[0], p[1] - L[1]) < wml.r / 3) return;
    wml.stroke.pts.push(p.map(v => Math.round(v * 1000) / 1000));
    wmlDraw();
  };
  cv.onpointerup = () => {
    if (!wml.stroke) return;
    const S = wmlData().sea;
    (S.paint = S.paint || []).push(wml.stroke);
    wml.stroke = null;
    /* one stroke, one step of the undo */
    changed();
    commit(true);
    wmlDraw();
  };
  /* the other cards' fields change the data: draw again a moment later */
  const root = cv.closest('.ed-col');
  if (root)
    root.addEventListener('input', () => {
      clearTimeout(wml.t);
      wml.t = setTimeout(wmlDraw, 350);
    });
}
/* keys while the pointer is over the picture (as the map editor's since ST-2), so they never fight a field */
document.addEventListener('keydown', ev => {
  if (!wml.hover || ev.ctrlKey || ev.metaKey || ev.altKey || !$('#wmlPic')) return;
  const t = { v: 'look', l: 'land', w: 'sea', x: 'remove' }[ev.key.toLowerCase()];
  if (t) {
    wml.tool = t;
    ev.preventDefault();
    render();
  } else if (ev.key === '[' || ev.key === ']') {
    wml.r = Math.max(0.005, Math.min(0.12, wml.r * (ev.key === ']' ? 1.25 : 0.8)));
    ev.preventDefault();
    render();
  }
});
ACTIONS.wmlTool = d => {
  wml.tool = d.t;
  render();
};
ACTIONS.wmlClear = async () => {
  const S = wmlData().sea;
  if (!(S.paint || []).length || !(await ask(`Remove all ${S.paint.length} brush strokes?`, 'Remove'))) return;
  S.paint = [];
  changed();
  commit(true);
  render();
};
ACTIONS.wmlOpen3d = () => {
  studioBroadcast();
  window.open('../game/index.html?test=1&place=copperleaf&tab=map&draft=1', 'networth-game');
  toast('Opening the world map in the game with your unsaved changes. Nothing there is saved.');
};

/* ---------- terrain chips ---------- */
const wmlTerrains = () => (studioState.D.scenery && studioState.D.scenery.terrains) || {};
function wmlChips(path) {
  const T = wmlTerrains(),
    s = readPath(path) || '';
  return `<div class="wml-chips">${s
    .split('')
    .map(
      (c, i) =>
        `<span class="wml-chip" title="${escapeHtml((T[c] && T[c].name) || c)}"><img src="${escapeHtml(artURL(T[c] ? T[c].tile : ''))}" alt="" width="16" height="16"><b>${escapeHtml((T[c] && T[c].name) || c)}</b><button class="x" data-act="wmlKeyDel" data-p="${escapeHtml(path)}" data-i="${i}" title="Remove">×</button><button class="x" data-act="scEditTile" data-c="${escapeHtml(c)}" title="Edit pixels (the shared pixel canvas)">✎</button></span>`
    )
    .join(
      ''
    )}<select class="wml-add" data-wml-add="${escapeHtml(path)}"><option value="">+ add</option>${Object.entries(T)
    .map(([k, t]) => `<option value="${escapeHtml(k)}">${escapeHtml(t.name || k)}</option>`)
    .join('')}</select></div>`;
}
ACTIONS.wmlKeyDel = d => {
  const s = readPath(d.p) || '';
  if (s.length < 2) return toast('Keep at least one ground.');
  writePath(d.p, s.slice(0, +d.i) + s.slice(+d.i + 1));
  changed();
  render();
};
document.addEventListener('change', ev => {
  const el = ev.target.closest && ev.target.closest('[data-wml-add]');
  if (!el || !el.value) return;
  writePath(el.dataset.wmlAdd, (readPath(el.dataset.wmlAdd) || '') + el.value);
  changed();
  render();
});
ACTIONS.wmlTree = d => {
  const R = wmlData().regions[d.r],
    has = R.trees.includes(d.t);
  if (has && R.trees.length < 2) return toast('A region keeps at least one kind of tree.');
  R.trees = has ? R.trees.filter(t => t !== d.t) : [...R.trees, d.t];
  changed();
  render();
};

/* ---------- the tab ---------- */
function worldMapLookTab() {
  const W = wmlData();
  if (!W) return card('World map look', '<p class="warn">game/data/worldmap.json is missing.</p>');
  const tools = [
    ['look', 'Look', 'V'],
    ['land', 'Land brush', 'L'],
    ['sea', 'Sea brush', 'W'],
    ['remove', 'Remove strokes', 'X'],
  ];
  afterRender(wmlBind);
  const pic = `<div class="wml-top"><canvas id="wmlPic" class="wml-pic tool-${wml.tool}" width="${WML_PIC}" height="${WML_PIC}"></canvas><div class="wml-side"><div class="seg-row">${tools
    .map(
      ([k, n, key]) =>
        `<button class="seg ${wml.tool === k ? 'on' : ''}" data-act="wmlTool" data-t="${k}" title="${n} (${key} over the picture)">${n}</button>`
    )
    .join(
      ''
    )}</div><p class="help">Brush size ${Math.round(wml.r * 1000)} m ([ and ] over the picture). A stroke forces land or sea where it passes; the places' own ground and the routes always stay dry. Each stroke is one step of Undo.</p><p class="help" id="wmlShare"></p><div class="seg-row"><button class="btn" data-act="wmlOpen3d">Open the 3D bowl</button><button class="btn danger subtle" data-act="wmlClear">Remove all strokes (${(W.sea.paint || []).length})</button></div></div></div>`;
  const sea = grid(
    rangeField('Sea, before painting', 'worldmap.sea.share', {
      min: 0.1,
      max: 0.7,
      step: 0.01,
      help: 'The share of the bowl under water; the coast is drawn so this much is sea.',
    }),
    rangeField('Coast roughness', 'worldmap.sea.rough', {
      min: 0,
      max: 2,
      step: 0.05,
      help: '0 hugs the places; higher gives bays and headlands.',
    }),
    rangeField('Land rising to the rim', 'worldmap.sea.rimLand', {
      min: 0,
      max: 1,
      step: 0.01,
      help: 'High: an inland sea with land all round; 0: the sea may reach the rim.',
    }),
    rangeField('Sea depth', 'worldmap.sea.depth', {
      min: 0.005,
      max: 0.08,
      step: 0.001,
      help: 'In bowl radii (0.035 is 35 m).',
    }),
    numberField('Coast seed', 'worldmap.sea.seed', {
      step: 1,
      min: 0,
      max: 9999,
      help: 'Another coast with the same settings.',
    })
  );
  const kinds = Object.keys(W.relief.kinds),
    relief =
      grid(
        numberField('Relief at most', 'worldmap.relief.max', {
          step: 0.005,
          min: 0,
          max: 0.3,
          help: 'Bowl radii (0.1 is 100 m).',
        }),
        numberField('Other kinds: height', 'worldmap.relief.default.0', { step: 0.002 }),
        numberField('Other kinds: reach', 'worldmap.relief.default.1', { step: 0.005 })
      ) +
      `<table class="tbl wml-kinds"><thead><tr><th>Kind of place</th><th>Height (below 0 a dip)</th><th>Reach</th><th>Its own ground round it</th></tr></thead><tbody>${kinds
        .map(
          k =>
            `<tr><td>${escapeHtml(k)}</td><td>${numberField('', `worldmap.relief.kinds.${k}.0`, { step: 0.002 })}</td><td>${numberField('', `worldmap.relief.kinds.${k}.1`, { step: 0.005 })}</td><td>${W.kinds[k] != null ? wmlChips(`worldmap.kinds.${k}`) : '<small>its region’s</small>'}</td></tr>`
        )
        .join('')}</tbody></table>`;
  const regions = Object.entries(W.regions)
    .map(
      ([r, R]) =>
        `<div class="wml-region"><h4>${escapeHtml(r)}</h4>${WML_REGION_PARTS.map(([f, n]) => `<div class="wml-row"><span>${n}</span>${wmlChips(`worldmap.regions.${r}.${f}`)}</div>`).join('')}<div class="wml-row"><span>Trees in clumps</span><div class="wml-chips">${WML_TREES.map(
          t =>
            `<button class="chip ${R.trees.includes(t) ? 'on' : ''}" data-act="wmlTree" data-r="${escapeHtml(r)}" data-t="${t}">${WML_TREE_NAMES[t]}</button>`
        ).join('')}</div></div></div>`
    )
    .join('');
  return (
    card('The bowl from above', pic, {
      sub: 'Worked out with the game’s own code as you edit: sea and land, rivers, routes, trees in clumps, places (▲ has a landmark). The game draws the same ground in 3D.',
    }) +
    card('The sea', sea) +
    card('Relief', relief, {
      sub: 'Each kind of place lifts or lowers the ground round it (locations “Map landmarks”).',
    }) +
    card('Regions', regions, {
      sub: 'The ground between places by region: patches of its grounds, wet lowland near water, dry slopes, high ground; and the trees in its clumps. Places without a region use starter. ✎ edits a ground’s pixels.',
    })
  );
}
