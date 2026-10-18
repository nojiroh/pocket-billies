'use strict';
/* ================= POCKET BILLIES STUDIO · world, rules, art ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { worldPaint } from '../../game/js/hooks.js';
import { $, clamp } from '../../game/js/util.js';
import { makeCanvas } from '../../game/js/art.js';
import { WILD_TYPE_BOOSTS } from '../../game/js/environment.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  api,
  ask,
  card,
  changed,
  checkboxField,
  clone,
  colorField,
  commit,
  formatThousands,
  grid,
  numberField,
  readPath,
  render,
  selectField,
  speciesName,
  speciesOptions,
  studioState,
  textField,
  toast,
  typeOptions,
  uniqueKey,
} from './studio-app.js';
import { fileToCanvas, loadImage, markArt, mountPreviews, pickFile, spritePreviewHTML } from './sprites.js';
import { RARITY_LABELS } from './data-editors.js';
/* eslint-disable no-func-assign */
expose({
  AMBIENT_PARTICLES: [() => AMBIENT_PARTICLES],
  ART_GROUPS: [() => ART_GROUPS],
  FISHING_WATERS: [() => FISHING_WATERS],
  LOCATION_KINDS: [() => LOCATION_KINDS],
  bindWorldMap: [() => bindWorldMap, v => (bindWorldMap = v)],
  drawWorldMarkers: [() => drawWorldMarkers, v => (drawWorldMarkers = v)],
  locationRoads: [() => locationRoads, v => (locationRoads = v)],
  lonLatToWorldMapXY: [() => lonLatToWorldMapXY, v => (lonLatToWorldMapXY = v)],
  roadsHTML: [() => roadsHTML, v => (roadsHTML = v)],
  weightTable: [() => weightTable, v => (weightTable = v)],
  worldBackdrops: [() => worldBackdrops, v => (worldBackdrops = v)],
  worldEggs: [() => worldEggs, v => (worldEggs = v)],
  worldFishing: [() => worldFishing, v => (worldFishing = v)],
  worldLocations: [() => worldLocations, v => (worldLocations = v)],
  worldMapHTML: [() => worldMapHTML, v => (worldMapHTML = v)],
  worldPools: [() => worldPools, v => (worldPools = v)],
  worldRegions: [() => worldRegions, v => (worldRegions = v)],
  xpCurveText: [() => xpCurveText, v => (xpCurveText = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const LOCATION_KINDS = [
  'city',
  'town',
  'grass',
  'golf',
  'thicket',
  'grotto',
  'canyon',
  'bins',
  'food',
  'mall',
  'pond',
  'farm',
  'ridge',
  'sea',
  'island',
  'volcano',
  'pass',
  'summit',
  'lake',
  'feedl',
  'silicon',
  'spore',
  'trench',
  'vault',
  'spire',
];
function worldMapHTML() {
  return `<div class="wmap" id="wmap"><img src="../game/art/map/world.png?v=${(studioState.D.meta || {}).artVersion || 0}" alt="" draggable="false" id="wmapImg"><svg viewBox="0 0 360 180" preserveAspectRatio="none" id="wmapSvg"></svg></div><p class="help">Drag a marker to move a stop. The painted trail and patches are part of the map art: <button class="linkish" data-act="wtab" data-t="paint">paint them under Map art</button>, where moving a stop can carry its patch along and the trail can be repainted to match.</p>`;
}
function lonLatToWorldMapXY(lon, lat) {
  return [((lon % 360) + 360) % 360, 90 - lat];
}
function drawWorldMarkers() {
  const svg = $('#wmapSvg');
  if (!svg) return;
  const D = studioState.D;
  let h = '';
  const pts = D.locations.map(r => lonLatToWorldMapXY(r.lon || 0, r.lat || 0));
  (D.roads || []).forEach(([a, b]) => {
    if (pts[a] && pts[b])
      h += `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" class="trail"/>`;
  });
  D.regions.forEach((g, i) => {
    if (g.lon == null) return;
    const [x, y] = lonLatToWorldMapXY(g.lon, g.lat || 0);
    h += `<g class="mk reg ${studioState.sel.stop === 'r' + i ? 'on' : ''}" data-mk="r${i}" transform="translate(${x},${y})"><circle r="3.2"/><text y="-5">${escapeHtml(g.name)}</text></g>`;
  });
  D.locations.forEach((r, i) => {
    const [x, y] = pts[i];
    h += `<g class="mk ${r.town ? 'town' : ''} ${studioState.sel.stop === i ? 'on' : ''}" data-mk="${i}" transform="translate(${x},${y})"><circle r="${r.town ? 3.2 : 2.6}"/><text y="-5">${i + 1}. ${escapeHtml(r.name)}</text></g>`;
  });
  svg.innerHTML = h;
}
function bindWorldMap() {
  const svg = $('#wmapSvg');
  if (!svg) return;
  const ed = studioState.artDirty.get('art/map/world.png'),
    im = $('#wmapImg');
  if (ed && im) im.src = ed.toDataURL();
  drawWorldMarkers();
  let drag = null;
  const pos = ev => {
    const r = svg.getBoundingClientRect();
    return [
      clamp(((ev.clientX - r.left) / r.width) * 360, 0, 360),
      clamp(((ev.clientY - r.top) / r.height) * 180, 0, 180),
    ];
  };
  svg.addEventListener('pointerdown', ev => {
    const g = ev.target.closest('[data-mk]');
    if (!g) return;
    drag = g.dataset.mk;
    svg.setPointerCapture(ev.pointerId);
    const v = drag.startsWith('r') ? drag : +drag;
    if (studioState.sel.stop !== v) {
      studioState.sel.stop = v;
      render();
    }
  });
  svg.addEventListener('pointermove', ev => {
    if (drag == null) return;
    const [x, y] = pos(ev),
      lon = Math.round(x > 180 ? x - 360 : x),
      lat = Math.round(90 - y);
    const o = drag.startsWith('r') ? studioState.D.regions[+drag.slice(1)] : studioState.D.locations[+drag];
    o.lon = lon;
    o.lat = lat;
    drawWorldMarkers();
    const a = $(`[data-p$=".lon"]`);
  });
  svg.addEventListener('pointerup', () => {
    if (drag != null) {
      drag = null;
      changed();
      commit(true);
      render();
    }
  });
}
SECTIONS.world = () => {
  const D = studioState.D,
    tab = studioState.sel.wtab || 'route';
  const tabs = [
    ['route', 'Route stops'],
    ['pools', 'Wild encounters'],
    ['fishing', 'Fishing'],
    ['eggs', 'Eggs'],
    ['regions', 'Regions ahead'],
    ['backdrops', 'Battle backdrops'],
    ['paint', 'Map art'],
  ];
  const body = {
    route: worldLocations,
    pools: worldPools,
    fishing: worldFishing,
    eggs: worldEggs,
    regions: worldRegions,
    backdrops: worldBackdrops,
    paint: worldPaint,
  }[tab]();
  return `<div class="ed-col solo"><div class="ed-head"><h2>World & encounters</h2></div><div class="seg-row tabs">${tabs.map(([k, n]) => `<button class="seg ${k === tab ? 'on' : ''}" data-act="wtab" data-t="${k}">${n}</button>`).join('')}</div>${body}</div>`;
};
ACTIONS.wtab = d => {
  studioState.sel.wtab = d.t;
  render();
};
function worldLocations() {
  const D = studioState.D;
  let i = typeof studioState.sel.stop === 'number' ? studioState.sel.stop : 0;
  if (!D.locations[i]) i = 0;
  studioState.sel.stop = i;
  const r = D.locations[i],
    p = `locations.${i}`,
    seatIds = Object.values(D.trainers || {})
      .filter(T => T.seat)
      .map(T => [T.seat.id, `${T.seat.title || T.seat.id} (${T.name})`]);
  let acc = 0;
  const steps = D.locations.map(x => (acc += +x.cost || 0));
  const list = `<table class="tbl route"><thead><tr><th>#</th><th>Stop</th><th>Roads to</th><th>Shop</th><th>Trainers</th><th></th></tr></thead><tbody>${D.locations
    .map(
      (
        x,
        j
      ) => `<tr class="${j === i ? 'on' : ''}"><td>${j + 1}</td><td><button class="linkish" data-act="pickStop" data-i="${j}">${escapeHtml(x.name)}</button>${x.town ? ' <small>town</small>' : ''}${x.gate ? ' <small class="warn">gated</small>' : ''}</td><td><small>${
        locationRoads(j)
          .map(([o, c]) => `${escapeHtml(D.locations[o].name)} (${formatThousands(c)})`)
          .join(', ') || '<span class="warn">no roads</span>'
      }</small></td><td>${x.shop && D.shops[x.shop] ? escapeHtml(D.shops[x.shop].name) : ''}</td><td>${Object.values(
        D.trainers || {}
      )
        .filter(T => T.node === j)
        .map(T => escapeHtml(T.name))
        .join(', ')}</td>
  <td><button class="x" data-act="stopMove" data-i="${j}" data-d="-1" title="Move up">↑</button><button class="x" data-act="stopMove" data-i="${j}" data-d="1" title="Move down">↓</button></td></tr>`
    )
    .join(
      ''
    )}</tbody></table><div class="seg-row"><button class="btn" data-act="stopAdd">Add a stop after the selected one</button><button class="btn danger subtle" data-act="stopDel">Delete the selected stop</button></div>`;
  const ed =
    grid(
      textField('Name', `${p}.name`),
      textField('Route label', `${p}.route`, { help: 'Shown above the name, like “Route 2”.' }),
      checkboxField('Town (free clinic)', `${p}.town`, { num: 1, rr: 1 }),
      selectField(
        'Wild encounters',
        `${p}.pool`,
        Object.keys(D.pools).map(k => [k, k]),
        { help: 'Encounters come from the next stop’s list while you walk toward it.' }
      ),
      selectField(
        'Battle backdrop',
        `${p}.battleStage`,
        Object.entries(D.battleStages).map(([k, v]) => [k, v.name || k])
      ),
      selectField(
        'Walk scene',
        `${p}.mapId`,
        Object.entries(D.maps || {}).map(([k, v]) => [k, v.name || k]),
        { none: 'First scene', opt: 1, help: 'The tilt-shift view on the Walk screen. Edit scenes under Walk scenes.' }
      ),
      selectField(
        'Shop',
        `${p}.shop`,
        Object.keys(D.shops || {})
          .filter(k => D.shops[k].kind !== 'wardrobe')
          .map(k => [k, D.shops[k].name]),
        { none: 'No shop', opt: 1 }
      ),
      selectField(
        'Boutique',
        `${p}.boutique`,
        Object.keys(D.shops || {})
          .filter(k => D.shops[k].kind === 'wardrobe')
          .map(k => [k, D.shops[k].name]),
        { none: 'No boutique', opt: 1, help: 'Clothes and hair; edit what it sells under Wardrobe.' }
      ),
      selectField('Locked until', `${p}.gate`, seatIds, {
        none: 'Always open',
        opt: 1,
        rr: 1,
        help: 'Walking past this point needs that badge.',
      }),
      checkboxField('Water crossing: you ride a Billie', `${p}.ride`, {
        num: 1,
        rr: 1,
        help: 'Needs a Water Billie big enough to ride (Rules → ride). Its walk scene lets you move over water.',
      }),
      selectField(
        'Mood',
        `${p}.mood`,
        Object.entries(D.moods || {}).map(([k, v]) => [k, v.name || k]),
        {
          none: 'None (the plain look)',
          opt: 1,
          help: 'v47: the place’s colour mood: saturation, contrast, warmth and tints, eased in as you walk here. A walk scene can name its own.',
        }
      ),
      selectField(
        'Map landmarks',
        `${p}.t`,
        LOCATION_KINDS.map(k => [k, k])
      ),
      textField('Banner picture', `${p}.banner`, {
        opt: 1,
        ph: 'background/sundown.webp',
        help: 'Optional picture for the route card, inside game/art.',
      }),
      numberField('Longitude', `${p}.lon`, { step: 1 }),
      numberField('Latitude', `${p}.lat`, { step: 1 })
    ) +
    (r.gate ? textField('Locked message', `${p}.gateText`, { opt: 1 }) : '') +
    textField('Description', `${p}.blurb`, { area: 1, rows: 2 });
  afterRender(bindWorldMap);
  return (
    card('The route', list, {
      sub: 'Stops and the roads between them. Players pick where to walk on the world map. Trainers are placed on stops under Trainers.',
    }) +
    card(`${i + 1}. ${escapeHtml(r.name)}`, ed) +
    card('Roads from here', roadsHTML(i), {
      sub: 'Each road is walked in either direction. Steps are how far it is. In the stop’s walk scene, each road leaves through the exit named under “Leaves by”, or, when none is named, the exit that points the same way on the world map.',
    }) +
    card('Map', worldMapHTML())
  );
}
function locationRoads(i) {
  return (studioState.D.roads || [])
    .map((l, k) => (l[0] === i ? [l[1], l[2], k] : l[1] === i ? [l[0], l[2], k] : null))
    .filter(Boolean);
}
function roadsHTML(i) {
  const D = studioState.D,
    R = locationRoads(i),
    opts = D.locations.map((r, j) => [j, `${j + 1}. ${r.name}`]).filter(([j]) => j !== i);
  return `<table class="tbl"><thead><tr><th>Road to</th><th>Steps</th><th>About</th><th>Leaves by</th><th></th></tr></thead><tbody>${R.map(
    ([o, c, k]) => {
      const side = D.roads[k][0] === i ? 1 : 0,
        end = side ? 'a' : 'b',
        J = D.roads[k][3] || {},
        sc = D.maps[(D.locations[i] || {}).mapId],
        ids = ((sc && sc.edgeExits) || []).map(e => e.id);
      return `<tr><td><select data-p="roads.${k}.${side}" data-k="num" data-rr="1">${opts.map(([j, n]) => `<option value="${j}" ${j === o ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select></td><td><input type="number" min="50" step="50" data-p="roads.${k}.2" data-k="num" value="${c}" class="sm-num"></td><td><small>${(c / D.rules.steps.stepsPerKm).toFixed(1)} km</small></td><td><select data-join="${k}" data-end="${end}" title="Which exit of this stop’s scene the road uses (v42 join table); ‘by direction’ matches it by compass bearing as before"><option value="">by direction</option>${ids.map(id => `<option value="${escapeHtml(id)}" ${J[end] === id ? 'selected' : ''}>${escapeHtml(id)}</option>`).join('')}</select></td><td><button class="x" data-act="roadDel" data-k="${k}" title="Remove this road">×</button></td></tr>`;
    }
  ).join('')}</tbody></table>
 <div class="seg-row"><select id="roadTo">${opts
   .filter(([j]) => !R.some(x => x[0] === j))
   .map(([j, n]) => `<option value="${j}">${escapeHtml(n)}</option>`)
   .join('')}</select><button class="btn" data-act="roadAdd" data-i="${i}">+ Add a road</button></div>`;
}
ACTIONS.roadAdd = d => {
  const D = studioState.D,
    i = +d.i,
    j = +$('#roadTo').value;
  if (!Number.isFinite(j) || j === i) return;
  (D.roads || (D.roads = [])).push([i, j, 800]);
  changed();
  commit(true);
  render();
};
document.addEventListener('change', ev => {
  const t = ev.target;
  if (!t || t.dataset.join == null) return;
  const l = studioState.D.roads[+t.dataset.join];
  if (!l) return;
  const J = l[3] || {};
  if (t.value) J[t.dataset.end] = t.value;
  else delete J[t.dataset.end];
  if (J.a || J.b) {
    if (l.length > 3) l[3] = J;
    else l.push(J);
  } else l.length = 3;
  changed();
  commit(true);
  render();
});
ACTIONS.roadDel = d => {
  studioState.D.roads.splice(+d.k, 1);
  changed();
  commit(true);
  render();
};
ACTIONS.pickStop = d => {
  studioState.sel.stop = +d.i;
  render();
};
ACTIONS.stopMove = d => {
  const D = studioState.D,
    i = +d.i,
    j = i + +d.d;
  if (j < 0 || j >= D.locations.length) return;
  [D.locations[i], D.locations[j]] = [D.locations[j], D.locations[i]];
  (D.roads || []).forEach(l => {
    for (const q of [0, 1]) {
      if (l[q] === i) l[q] = j;
      else if (l[q] === j) l[q] = i;
    }
  });
  Object.values(D.trainers || {}).forEach(T => {
    if (T.node === i) T.node = j;
    else if (T.node === j) T.node = i;
  });
  studioState.sel.stop = j;
  changed();
  render();
};
ACTIONS.stopAdd = () => {
  const D = studioState.D,
    i = typeof studioState.sel.stop === 'number' ? studioState.sel.stop : D.locations.length - 1,
    a = D.locations[i],
    b = D.locations[i + 1];
  const n = {
    name: 'New Stop',
    pool: a.pool,
    battleStage: a.battleStage,
    route: a.route,
    t: 'grass',
    blurb: 'Describe this place.',
    lon: b ? Math.round((a.lon + b.lon) / 2) : a.lon + 8,
    lat: b ? Math.round((a.lat + b.lat) / 2) : a.lat,
  };
  D.locations.splice(i + 1, 0, n);
  Object.values(D.trainers || {}).forEach(T => {
    if (T.node > i) T.node++;
  });
  (D.roads || (D.roads = [])).forEach(l => {
    for (const q of [0, 1]) if (l[q] > i) l[q]++;
  });
  D.roads.push([i, i + 1, 800]);
  studioState.sel.stop = i + 1;
  changed();
  render();
};
ACTIONS.stopDel = async () => {
  const D = studioState.D,
    i = studioState.sel.stop;
  if (D.locations.length < 2) return toast('The route needs at least one stop.');
  const T = Object.values(D.trainers || {}).filter(t => t.node === i);
  if (
    !(await ask(
      `Delete ${escapeHtml(D.locations[i].name)}?${T.length ? ` ${T.map(t => escapeHtml(t.name)).join(', ')} move to the previous stop.` : ''}`,
      'Delete'
    ))
  )
    return;
  D.locations.splice(i, 1);
  Object.values(D.trainers || {}).forEach(t => {
    if (t.node >= i) t.node = Math.max(0, t.node - 1);
  });
  D.roads = (D.roads || [])
    .filter(l => l[0] !== i && l[1] !== i)
    .map(l => l.map((v, q) => (q < 2 && v > i ? v - 1 : v)));
  studioState.sel.stop = Math.max(0, i - 1);
  changed();
  render();
};
function weightTable(base, P) {
  const tot = P.list.reduce((a, b) => a + (+b[1] || 0), 0);
  return `<table class="tbl"><thead><tr><th>Billie</th><th>Weight</th><th>Chance</th><th></th></tr></thead><tbody>${P.list
    .map(
      ([id, w], j) =>
        `<tr><td>${spritePreviewHTML({ sp: id, still: 1, cls: 'mini' })} <select data-p="${base}.list.${j}.0" data-k="sel" data-rr="1">${speciesOptions()
          .map(([v, n]) => `<option value="${v}" ${v === id ? 'selected' : ''}>${escapeHtml(n)}</option>`)
          .join(
            ''
          )}</select></td><td><input type="number" min="1" data-p="${base}.list.${j}.1" data-k="num" value="${w}"></td><td>${tot ? Math.round((w / tot) * 100) : 0}%</td><td><button class="x" data-act="wDel" data-b="${base}" data-j="${j}">✕</button></td></tr>`
    )
    .join('')}</tbody></table><button class="btn" data-act="wAdd" data-b="${base}">Add a Billie</button>`;
}
ACTIONS.wDel = d => {
  readPath(d.b).list.splice(+d.j, 1);
  changed();
  render();
};
ACTIONS.wAdd = d => {
  readPath(d.b).list.push([studioState.D.lines[0].id + '0', 10]);
  changed();
  render();
};
function worldPools() {
  const D = studioState.D;
  afterRender(() => mountPreviews($('#main')));
  return (
    Object.entries(D.pools)
      .map(([k, P]) =>
        card(
          `Pool “${escapeHtml(k)}”`,
          grid(
            numberField('Lowest level', `pools.${k}.lv.0`, { min: 1, max: 100, step: 1 }),
            numberField('Highest level', `pools.${k}.lv.1`, { min: 1, max: 100, step: 1 })
          ) + weightTable(`pools.${k}`, P),
          {
            sub: `Used by: ${escapeHtml(
              D.locations
                .filter(r => r.pool === k)
                .map(r => r.name)
                .join(', ') || 'no stop'
            )}`,
            acts: `<button class="btn danger subtle" data-act="poolDel" data-k="${k}">Delete pool</button>`,
          }
        )
      )
      .join('') +
    `<div class="seg-row"><input id="newPool" type="text" placeholder="new pool name"><button class="btn primary" data-act="poolNew">+ New pool</button></div>`
  );
}
/* v25: what bites in each kind of water; levels are added to the place's own wild levels */
const FISHING_WATERS = {
  pond: 'Ponds',
  stream: 'Streams',
  lake: 'Lakes',
  sea: 'The sea',
  canal: 'Canals',
  swamp: 'Swamps',
  spring: 'Springs',
  ice: 'Ice holes',
};
function worldFishing() {
  const D = studioState.D;
  D.fishing = D.fishing || {};
  afterRender(() => mountPreviews($('#main')));
  return (
    `<p class="help">Fishing: stand by water on the Walk screen and tap Fish. What bites depends on the kind of water (set in Walk scenes → Kinds of water). Levels are the place’s own wild levels plus these.</p>` +
    Object.entries(FISHING_WATERS)
      .map(([k, n]) => {
        const P = D.fishing[k];
        if (!P)
          return card(
            n,
            `<button class="btn" data-act="fishAdd" data-k="${k}">+ Fish in ${escapeHtml(n.toLowerCase())}</button>`
          );
        return card(
          n,
          grid(
            numberField('Level bonus, low', `fishing.${k}.lv.0`, { min: 0, max: 20, step: 1 }),
            numberField('Level bonus, high', `fishing.${k}.lv.1`, { min: 0, max: 20, step: 1 })
          ) + weightTable(`fishing.${k}`, P)
        );
      })
      .join('')
  );
}
ACTIONS.fishAdd = d => {
  const D = studioState.D;
  (D.fishing = D.fishing || {})[d.k] = { lv: [0, 2], list: [[D.lines[0].id + '0', 10]] };
  changed();
  render();
};
ACTIONS.poolNew = () => {
  const D = studioState.D,
    k = uniqueKey($('#newPool').value || 'pool', x => !!D.pools[x]);
  D.pools[k] = { lv: [5, 8], list: [[D.lines[0].id + '0', 10]] };
  changed();
  render();
};
ACTIONS.poolDel = async d => {
  const D = studioState.D;
  if (D.locations.some(r => r.pool === d.k))
    return toast('A route stop still uses this pool. Pick another pool for it first.', 'err');
  if (!(await ask('Delete this pool?', 'Delete'))) return;
  delete D.pools[d.k];
  changed();
  render();
};
function worldEggs() {
  const D = studioState.D;
  afterRender(() => mountPreviews($('#main')));
  return Object.entries(D.eggs)
    .map(([k, E]) =>
      card(
        `${k} km egg`,
        grid(
          numberField('Steps to hatch', `eggs.${k}.need`, {
            min: 100,
            step: 100,
            help: `${(E.need / D.rules.steps.stepsPerKm).toFixed(1)} km at ${D.rules.steps.stepsPerKm} steps per km.`,
          }),
          numberField('Hatches at level', `eggs.${k}.lv`, { min: 1, max: 100, step: 1 })
        ) + weightTable(`eggs.${k}`, E),
        { sub: 'Egg art is art/eggs/egg_' + k + '.png (Art files).' }
      )
    )
    .join('');
}
function worldRegions() {
  const D = studioState.D;
  afterRender(bindWorldMap);
  return (
    card(
      'Regions beyond the route',
      D.regions
        .map(
          (g, i) =>
            `<div class="item-row"><div class="item-ic"><small class="mono">${escapeHtml(g.t)}</small></div><div>${grid(
              textField('Name', `regions.${i}.name`),
              selectField(
                'Look',
                `regions.${i}.t`,
                LOCATION_KINDS.concat(['sun']).map(k => [k, k])
              ),
              ...(g.t === 'sun'
                ? []
                : [
                    numberField('Longitude', `regions.${i}.lon`, { step: 1 }),
                    numberField('Latitude', `regions.${i}.lat`, { step: 1 }),
                  ])
            )}${textField('Description', `regions.${i}.blurb`, { area: 1, rows: 2 })}</div></div>`
        )
        .join(''),
      { sub: 'Shown fogged on the world map. The Inner Sun sits at the center.' }
    ) +
    card('Map', worldMapHTML()) +
    card(
      'End of the road',
      textField('Message at the last stop', 'meta.endText', {
        area: 1,
        rows: 2,
        opt: 1,
        ph: 'This is the end of the road for now. The Meadowlands lie ahead.',
      })
    )
  );
}
export const AMBIENT_PARTICLES = [
  ['pollen', 'Pollen'],
  ['spore', 'Spores'],
  ['drip', 'Drips'],
  ['sand', 'Blowing sand'],
  ['dust', 'Sparkling dust'],
  ['none', 'Nothing'],
];
function worldBackdrops() {
  const D = studioState.D,
    grounds = [
      ...new Set(
        studioState.files
          .filter(f => /art\/battle\/[^/]+_ground\.png$/.test(f.path))
          .map(f => f.path.split('/').pop().replace('_ground.png', ''))
      ),
    ],
    fars = [
      ...new Set(
        studioState.files
          .filter(f => /art\/battle\/far_/.test(f.path))
          .map(f => f.path.split('/').pop().replace('far_', '').replace('.png', ''))
      ),
    ],
    walls = [
      ...new Set(
        studioState.files
          .filter(f => /_walls\.png$/.test(f.path))
          .map(f => f.path.split('/').pop().replace('_walls.png', ''))
      ),
    ];
  return Object.entries(D.battleStages)
    .map(([k, b]) => {
      const p = `battleStages.${k}`,
        art = b.art || k;
      return card(
        escapeHtml(b.name || k),
        `<div class="bd-prev" style="background:linear-gradient(${b.sky.join(',')})"><span style="background:${b.fog}"></span><img src="../game/art/battle/${art}_ground.png" alt="" class="pix"></div>` +
          grid(
            textField('Name', `${p}.name`),
            selectField(
              'Ground art',
              `${p}.art`,
              grounds.map(g => [g, g]),
              { none: `Same as id (${k})`, opt: 1 }
            ),
            checkboxField('Indoors', `${p}.indoor`, { num: 1, rr: 1 }),
            b.indoor
              ? selectField(
                  'Walls',
                  `${p}.wall`,
                  walls.map(w => [w, w]),
                  { none: 'None', opt: 1 }
                )
              : selectField(
                  'Far land',
                  `${p}.far`,
                  fars.map(f => [f, f]),
                  { none: 'None', opt: 1 }
                ),
            selectField('In the air', `${p}.amb`, AMBIENT_PARTICLES)
          ) +
          `<div class="grid colors">${colorField('Sky top', `${p}.sky.0`)}${colorField('Sky middle', `${p}.sky.1`)}${colorField('Sky horizon', `${p}.sky.2`)}${colorField('Haze', `${p}.fog`)}${numberField('Haze distance', `${p}.fogD`, { min: 10, max: 300, step: 5, help: 'Smaller is hazier.' })}</div>`,
        {
          sub: `id ${escapeHtml(k)} · used by ${escapeHtml(
            D.locations
              .filter(r => r.battleStage === k)
              .map(r => r.name)
              .concat(
                Object.values(D.trainers || {})
                  .filter(T => T.battleStage === k)
                  .map(T => T.name)
              )
              .join(', ') || 'nothing yet'
          )}`,
          acts: `<button class="btn subtle" data-act="bpArea" data-k="${k}" title="Open it in the battle preview">▶ Preview</button><button class="btn subtle" data-act="bdDup" data-k="${k}">Duplicate</button>`,
        }
      );
    })
    .join('');
}
ACTIONS.bdDup = d => {
  const D = studioState.D,
    k = uniqueKey(d.k + 'b', x => !!D.battleStages[x]);
  D.battleStages[k] = clone(D.battleStages[d.k]);
  D.battleStages[k].name = (D.battleStages[k].name || d.k) + ' (copy)';
  D.battleStages[k].art = D.battleStages[d.k].art || d.k;
  changed();
  render();
};
/* ================= RULES ================= */
SECTIONS.rules = () => {
  const D = studioState.D,
    R = D.rules,
    s = 'rules.start',
    st = 'rules.steps',
    pg = 'rules.progression',
    eg = 'rules.eggs',
    jb = 'rules.jobs',
    bt = 'rules.battle',
    ca = 'rules.catching';
  const starters = `<div class="chips">${D.lines.map(L => `<label class="chk-chip"><input type="checkbox" data-act-chk="starter" value="${L.id}" ${R.start.starters.includes(L.id) ? 'checked' : ''}> ${escapeHtml(L.names[0])}</label>`).join('')}</div>`;
  const rival = R.start.starters
    .map(l =>
      selectField(`Rival’s pick if you choose ${escapeHtml(speciesName(l + '0'))}`, `${s}.rival.${l}`, speciesOptions())
    )
    .join('');
  const xpPrev = `<p class="help" id="xpPrev">${xpCurveText()}</p>`;
  const coinsStart = `<div class="grid">${Object.keys(D.coins)
    .map(c => numberField(D.coins[c].n, `${s}.coins.${c}`, { min: 0, step: 1 }))
    .join('')}${Object.keys(D.items)
    .map(i => numberField(D.items[i].n, `${s}.items.${i}`, { opt: 1, min: 0, step: 1 }))
    .join('')}</div>`;
  const rar = `<div class="grid">${Object.keys(R.catching.rarity)
    .map(k => numberField(`${RARITY_LABELS[k] || k}`, `${ca}.rarity.${k}`, { min: 0, max: 1, step: 0.01 }))
    .join(
      ''
    )}${R.catching.evolved.map((v, i) => numberField(`Evolved stage ${i + 2}`, `${ca}.evolved.${i}`, { min: 0, max: 1, step: 0.01 })).join('')}</div>`;
  const totals = `<div class="grid">${Object.entries(D.rarities)
    .map(([k, v]) =>
      v.totals
        .map((t, i) =>
          numberField(`${RARITY_LABELS[k] || k} · stage ${i + 1}`, `rarities.${k}.totals.${i}`, {
            min: 50,
            max: 900,
            step: 5,
          })
        )
        .join('')
    )
    .join('')}</div>`;
  return `<div class="ed-col solo"><div class="ed-head"><h2>Rules</h2><p class="sub">Every number here changes how the game plays. Defaults match the original game.</p></div>
 ${card(
   'Starting out',
   grid(
     selectField(
       'Where a new game starts',
       `${s}.locationId`,
       (D.locations || []).filter(r => r.town || r.kind === 'town').map(r => [r.id, r.name]),
       { none: 'The first stop', opt: 1 }
     ),
     numberField('Money ($)', `${s}.se`, { min: 0, step: 50 }),
     numberField('Starter’s level', `${s}.starterLevel`, { min: 1, max: 100, step: 1 }),
     numberField('Encounters waiting', `${s}.starterEncounters`, { min: 0, max: 10, step: 1 }),
     selectField(
       'Free egg',
       `${s}.starterEgg`,
       Object.keys(D.eggs).map(k => [k, k + ' km']),
       { num: 1, none: 'None', opt: 1 }
     )
   ) +
     '<h4>Coins and items</h4>' +
     coinsStart +
     '<h4>Starter choices</h4>' +
     starters +
     '<h4>Rival</h4>' +
     grid(rival)
 )}
 ${card(
   'Steps and encounters',
   grid(
     numberField('Steps per km', `${st}.stepsPerKm`, { min: 500, max: 3000, step: 1 }),
     numberField('Wild Billies on a route', `rules.encounters.route`, { min: 0, max: 10, step: 1 }),
     numberField('Wild Billies in a town with tall grass', `rules.encounters.townGrass`, {
       min: 0,
       max: 10,
       step: 1,
       help: 'Towns without tall grass and rooms have none.',
     }),
     numberField('One more wanders over every', `rules.encounters.refillMs`, {
       min: 5000,
       step: 5000,
       unit: 'ms',
       help: 'Of play time, until the place is full again.',
     }),
     numberField('Golden odds: 1 in', `${st}.goldOdds`, { min: 2, step: 1 }),
     numberField('Alpha odds: 1 in', `${st}.alphaOdds`, {
       min: 2,
       step: 1,
       ph: '45',
       help: 'How rare an Alpha is among new encounters (once you have two Billies).',
     }),
     numberField('Rest stop price ($)', `${st}.restCost`, { min: 0, step: 10 }),
     numberField('Prize for beating a wild Billie', `rules.encounters.prizePerLevel`, {
       min: 0,
       step: 1,
       unit: '$ a level',
       help: 'A level 10 Billie pays ten times this.',
     })
   )
 )}
 ${card(
   'Leveling',
   grid(
     numberField('XP curve factor', `${pg}.xpFactor`, {
       min: 0.1,
       max: 3,
       step: 0.05,
       help: 'XP to reach level L = factor × L³.',
     }),
     numberField('Highest level', `${pg}.maxLevel`, { min: 5, max: 250, step: 1 }),
     numberField('Buddy steps per XP', `${pg}.buddyStepsPerXp`, { min: 1, max: 100, step: 1 }),
     numberField('Team size', `${pg}.teamSize`, { min: 1, max: 12, step: 1 }),
     numberField('Move slots', `${pg}.moveSlots`, { min: 1, max: 8, step: 1 }),
     ...R.progression.xpYield.map((v, i) =>
       numberField(`XP for beating stage ${i + 1}`, `${pg}.xpYield.${i}`, { min: 1, step: 5 })
     ),
     numberField('Trainer battle XP bonus', `${pg}.trainerXpMult`, { min: 1, max: 5, step: 0.1, unit: '×' }),
     numberField('Bench XP share', `${pg}.teamXpShare`, {
       min: 0,
       max: 1,
       step: 0.05,
       help: 'Teammates who didn’t fight get this fraction.',
     })
   ) +
     xpPrev +
     '<h4>Stat totals by rarity</h4>' +
     totals
 )}
 ${card(
   'Eggs',
   grid(
     numberField('Eggs carried', `${eg}.capacity`, { min: 1, max: 30, step: 1 }),
     numberField('Incubators', `${eg}.slots`, { min: 1, max: 6, step: 1 }),
     numberField('Golden odds: 1 in', `${eg}.goldOdds`, { min: 2, step: 1 }),
     numberField('Golden odds, biggest egg: 1 in', `${eg}.goldOdds10`, { min: 2, step: 1 }),
     numberField('Mythical odds, biggest egg: 1 in', `${eg}.mythOdds`, { min: 2, step: 1 }),
     selectField('The mythical', `${eg}.mythSpecies`, speciesOptions()),
     numberField('Wild drop chance', `${eg}.dropChance`, { min: 0, max: 1, step: 0.01 })
   ) +
     `<div class="grid">${Object.keys(D.eggs)
       .map(k => numberField(`Drop weight · ${k} km`, `${eg}.dropTiers.${k}`, { opt: 1, min: 0, max: 1, step: 0.05 }))
       .join('')}</div>`
 )}
 ${card(
   'Time and weather',
   grid(
     checkboxField('Billies ignore the hour and the weather', `rules.env.off`, {
       help: 'Off: some come out more at night, in the rain, in the snow and so on (the table below).',
     }),
     checkboxField('Weather doesn’t change battles', `rules.env.battleOff`, {
       help: 'Off: in the rain Water moves hit harder and Fire moves fizzle, at night Psychic and Dragon moves are stronger, and so on (v28).',
     })
   ) +
     `<details class="sub-d"><summary>Who comes out when (how much more often, by type; empty = the built-in value)</summary>${Object.entries(
       typeof WILD_TYPE_BOOSTS !== 'undefined' ? WILD_TYPE_BOOSTS : {}
     )
       .map(
         ([k, F]) =>
           `<h4>${escapeHtml({ night: 'At night', dusk: 'At dusk and dawn', sunny: 'On a fair day', rain: 'In the rain', storm: 'In a thunderstorm', snow: 'In the snow', fog: 'In fog', ash: 'In falling ash' }[k] || k)}</h4><div class="grid">${D.types.map(t => numberField(t.id, `rules.env.likes.${k}.${t.id}`, { opt: 1, min: 0, max: 5, step: 0.05, unit: '×', ph: F[t.id] != null ? String(F[t.id]) : '1' })).join('')}</div>`
       )
       .join('')}</details>`
 )}
 ${card('Riding across water', grid(numberField('Smallest Billie you can ride', `rules.ride.minHeight`, { unit: 'm', min: 0.3, max: 10, step: 0.1, help: 'Its height in the Field Guide. Needed for lake and sea crossings (stops marked as a water crossing).' })))}
 ${card('Jobs', grid(numberField('Steps per pay', `${jb}.stepsPerPay`, { min: 100, step: 100 }), numberField('Pay can pile up to', `${jb}.maxPending`, { min: 1, max: 200, step: 1 }), numberField('Open positions', `${jb}.positions`, { min: 1, max: 8, step: 1 })))}
 ${card(
   'Battle',
   grid(
     numberField('Same-type bonus', `${bt}.stab`, { unit: '×', min: 1, max: 3, step: 0.05 }),
     numberField('Critical damage', `${bt}.critMult`, { unit: '×', min: 1, max: 4, step: 0.05 }),
     ...R.battle.critChances.map((v, i) =>
       numberField(`Critical chance at +${i}`, `${bt}.critChances.${i}`, { min: 0, max: 1, step: 0.005 })
     ),
     numberField('Lowest damage roll', `${bt}.rollMin`, { min: 0.1, max: 1, step: 0.01 }),
     numberField('Status damage: 1 /', `${bt}.drainFraction`, {
       min: 2,
       max: 64,
       step: 1,
       help: 'Burn, sandstorm and Regrowth move this fraction of max HP each turn.',
     }),
     numberField('Sharp stones: 1 /', `${bt}.rentFraction`, { min: 2, max: 64, step: 1 }),
     numberField('Paralysis lost-turn chance', `${bt}.auditSkip`, { min: 0, max: 1, step: 0.05 }),
     numberField('Confusion turns', `${bt}.hypeTurns`, { min: 1, max: 10, step: 1 }),
     numberField('Confusion self-hit chance', `${bt}.hypeSelfHit`, { min: 0, max: 1, step: 0.05 }),
     numberField('Sleep turns, least', `${bt}.subpoenaMin`, { min: 1, max: 10, step: 1 }),
     numberField('Sleep turns, most', `${bt}.subpoenaMax`, { min: 1, max: 10, step: 1 }),
     numberField('Stat stage limit', `${bt}.stageMax`, { min: 1, max: 12, step: 1 }),
     numberField('Trainer smarts', `${bt}.aiSmart`, {
       min: 0,
       max: 1,
       step: 0.05,
       help: 'Chance a trainer picks its best move.',
     }),
     numberField('Losing fee', `${bt}.loseFee`, {
       min: 0,
       max: 1,
       step: 0.01,
       help: 'Fraction of your money paid when your team is wiped out.',
     }),
     numberField('Strongest move power cap (doubling moves)', `${bt}.holdCap`, { min: 40, step: 10 }),
     numberField('Delayed attack turns', `${bt}.mailTurns`, { min: 1, max: 6, step: 1 })
   ) +
     '<h4>Type abilities</h4>' +
     grid(
       numberField('Erratic roll, low', `${bt}.cryptoRollMin`, { min: 0, max: 1, step: 0.05 }),
       numberField('Erratic roll, high', `${bt}.cryptoRollMax`, { min: 1, max: 3, step: 0.05 }),
       numberField('Keen: extra critical stages', `${bt}.mediaCrit`, { min: 0, max: 3, step: 1 }),
       numberField('Kindling: Attack boost per turn', `${bt}.financeRamp`, { min: 0, max: 1, step: 0.01 }),
       numberField('Kindling turns', `${bt}.financeRampTurns`, { min: 1, max: 30, step: 1 }),
       numberField('Alloy bonus per teammate', `${bt}.retailSynergy`, { min: 0, max: 1, step: 0.01 }),
       selectField('Sandstorm type', `${bt}.shockType`, typeOptions()),
       numberField('Sandstorm boost', `${bt}.oilShockMult`, { unit: '×', min: 1, max: 3, step: 0.05 }),
       numberField('Sandstorm turns', `${bt}.shockTurns`, { min: 1, max: 20, step: 1 }),
       selectField('Soak turns the target into', `${bt}.spinType`, typeOptions()),
       numberField('Soak turns', `${bt}.spinTurns`, { min: 1, max: 10, step: 1 })
     ) +
     '<h4>Alphas and team battles</h4>' +
     grid(
       numberField('Alpha HP', `${bt}.alphaHp`, { unit: '×', min: 1, max: 10, step: 0.1, ph: '3' }),
       numberField('Alpha stats', `${bt}.alphaStats`, { unit: '×', min: 1, max: 3, step: 0.05, ph: '1.3' }),
       numberField('Alpha extra levels', `${bt}.alphaLevels`, { min: 0, max: 20, step: 1, ph: '3' }),
       numberField('Alpha moves per turn', `${bt}.alphaActs`, { min: 1, max: 4, step: 1, ph: '2' }),
       numberField('Your Billies against an Alpha', `${bt}.alphaTeam`, { min: 1, max: 3, step: 1, ph: '3' }),
       numberField('Alpha XP', `${bt}.alphaXp`, { unit: '×', min: 1, max: 10, step: 0.5, ph: '3' }),
       numberField('A taxed Alpha keeps', `${bt}.alphaKeep`, {
         unit: '×',
         min: 1,
         max: 1.5,
         step: 0.01,
         ph: '1.08',
         help: 'Its stats compared with others of its kind.',
       }),
       numberField('Alpha shrugs off sleep', `${bt}.alphaSleepResist`, { min: 0, max: 1, step: 0.05, ph: '0.5' }),
       numberField('Moves that hit every foe', `${bt}.spreadMult`, {
         unit: '×',
         min: 0.3,
         max: 1,
         step: 0.05,
         ph: '0.75',
         help: 'Their power when there is more than one foe.',
       })
     )
 )}
 ${card(
   'Taxing',
   '<h4>Base tax rate</h4>' +
     rar +
     grid(
       numberField('HP factor', `${ca}.hpFactor`, {
         min: 0,
         max: 1,
         step: 0.01,
         help: 'At full HP the rate is multiplied by (1 − this).',
       }),
       numberField('Asleep bonus', `${ca}.subpoena`, { unit: '×', min: 1, max: 5, step: 0.1 }),
       numberField('Other status bonus', `${ca}.status`, { unit: '×', min: 1, max: 5, step: 0.1 }),
       numberField('Soak bonus', `${ca}.spin`, { unit: '×', min: 1, max: 3, step: 0.05 }),
       numberField('Perfect ring bonus', `${ca}.ring`, {
         min: 0,
         max: 2,
         step: 0.05,
         help: 'A perfect throw multiplies the odds by 1 + this.',
       }),
       numberField('Lands-on-edge chance', `${ca}.edge`, { min: 0, max: 0.2, step: 0.005 }),
       numberField('Alpha tax rate', `${ca}.alpha`, { unit: '×', min: 0.05, max: 1, step: 0.05, ph: '0.4' }),
       numberField('Copper Coin penalty for luxury lines', `${ca}.luxuryPenny`, {
         unit: '×',
         min: 0,
         max: 1,
         step: 0.05,
       }),
       numberField('Bargain chance', `${ca}.offerChance`, { min: 0, max: 1, step: 0.05 }),
       numberField('Bargain, least ($)', `${ca}.offerMin`, { min: 0, step: 10 }),
       numberField('Bargain, most ($)', `${ca}.offerMax`, { min: 0, step: 10 }),
       numberField('Focus Bonus per refusal', `${ca}.integrityStep`, { unit: '×', min: 1, max: 3, step: 0.05 }),
       numberField('Focus Bonus cap', `${ca}.integrityMax`, { unit: '×', min: 1, max: 5, step: 0.05 })
     ) +
     '<h4>Luxury lines (sneer at Copper Coins)</h4>' +
     `<div class="chips">${D.lines.map(L => `<label class="chk-chip"><input type="checkbox" data-act-chk="luxury" value="${L.id}" ${R.catching.luxury.includes(L.id) ? 'checked' : ''}> ${escapeHtml(L.names[0])}</label>`).join('')}</div>`
 )}</div>`;
};
function xpCurveText() {
  const f = studioState.D.rules.progression.xpFactor;
  return [5, 10, 20, 36, 50, 100].map(L => `Lv ${L}: ${formatThousands(Math.floor(f * L * L * L))} XP`).join(' · ');
}
studioState.hooks.rules = path => {
  if (path.includes('xpFactor')) {
    const e = $('#xpPrev');
    if (e) e.textContent = xpCurveText();
  }
};
document.addEventListener('change', ev => {
  const el = ev.target,
    k = el.dataset.actChk;
  if (!k) return;
  const R = studioState.D.rules,
    arr = k === 'starter' ? R.start.starters : R.catching.luxury,
    v = el.value;
  const i = arr.indexOf(v);
  if (el.checked && i < 0) arr.push(v);
  if (!el.checked && i >= 0) arr.splice(i, 1);
  if (k === 'starter') {
    if (!arr.length) {
      arr.push(v);
      el.checked = true;
      return toast('Keep at least one starter.', 'err');
    }
    if (el.checked && !R.start.rival[v]) R.start.rival[v] = studioState.D.lines[0].id + '0';
  }
  changed();
  commit(true);
  if (k === 'starter') render();
});
/* ================= ART FILES ================= */
const ART_GROUPS = [
  ['billionaires', 'Billies', 'Four sheets per stage. Edit them in Billies → Edit pixels.'],
  ['battle', 'Battle backdrops', 'Ground, far land, walls, props, clouds, foregrounds'],
  ['background', 'Menus and title', 'Title picture, sky, clouds, islands'],
  ['coins', 'Coins', ''],
  ['eggs', 'Eggs', ''],
  ['icons', 'Icon atlas', 'All item and effect icons on one sheet'],
  ['map', 'World map', 'The inside of the sphere (equirectangular)'],
  ['items', 'Custom item icons', ''],
  ['ui', 'Interface icons', '12×12 masks'],
  ['app', 'App icon', ''],
];
SECTIONS.art = () => {
  const g = studioState.sel.agroup || 'battle',
    files = studioState.files.filter(f => f.path.split('/')[1] === g);
  return `<div class="ed-col solo"><div class="ed-head"><h2>Art files</h2><button class="btn" data-act="artRefresh">Refresh list</button></div><div class="seg-row tabs">${ART_GROUPS.map(([k, n]) => `<button class="seg ${k === g ? 'on' : ''}" data-act="agroup" data-g="${k}">${n}</button>`).join('')}</div>
 ${card(
   ART_GROUPS.find(x => x[0] === g)[1],
   `<div class="files">${
     files
       .map(f => {
         const dirty = studioState.artDirty.has(f.path);
         return `<figure class="file"><div class="fthumb"><img src="../game/${f.path}?v=${f.mtime}${dirty ? '&d' : ''}" alt="" loading="lazy" class="pix"></div><figcaption><b title="${escapeHtml(f.path)}">${escapeHtml(f.path.split('/').slice(2).join('/'))}</b><small>${(f.size / 1024).toFixed(1)} KB${dirty ? ' · edited' : ''}</small></figcaption>
  <div class="seg-row"><a class="btn sm" href="../game/${f.path}" download>Download</a>${f.path.endsWith('.svg') ? '' : `<button class="btn sm" data-act="artReplace" data-p="${f.path}">Replace…</button>`}</div></figure>`;
       })
       .join('') || '<p class="help">No files here yet.</p>'
   }</div>`,
   { sub: (ART_GROUPS.find(x => x[0] === g) || [])[2] || '' }
 )}
 ${g === 'background' ? card('Title picture for the web', `<p class="help">The game shows <code>background/sundown.webp</code>, a lighter copy of <code>sundown.png</code>. After replacing sundown.png, rebuild the web copy here.</p><button class="btn primary" data-act="rebuildWebp">Rebuild sundown.webp</button>`) : ''}</div>`;
};
ACTIONS.agroup = d => {
  studioState.sel.agroup = d.g;
  render();
};
ACTIONS.artRefresh = async () => {
  studioState.files = await api('files?dir=');
  render();
};
ACTIONS.artReplace = async d => {
  const f = await pickFile('image/png,image/webp');
  if (!f) return;
  const c = await fileToCanvas(f);
  let old = null;
  try {
    old = await loadImage('../game/' + d.p + '?v=' + Date.now());
  } catch (e) {}
  if (
    old &&
    (old.naturalWidth !== c.width || old.naturalHeight !== c.height) &&
    !(await ask(
      `The new image is ${c.width}×${c.height}; the old one is ${old.naturalWidth}×${old.naturalHeight}. Some art (atlases, textures) must keep its size. Replace anyway?`,
      'Replace'
    ))
  )
    return;
  markArt(d.p, c);
  toast('Replaced in the Studio. Save to game to write it.');
  render();
};
ACTIONS.rebuildWebp = async () => {
  const im = await loadImage('../game/art/background/sundown.png?v=' + Date.now());
  const w = 1280,
    h = Math.round((im.naturalHeight * w) / im.naturalWidth),
    c = makeCanvas(w, h),
    x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(im, 0, 0, w, h);
  markArt('art/background/sundown.webp', c);
  toast('Web copy rebuilt. Save to game to write it.');
};
