'use strict';
/* ================= POCKET BILLIES STUDIO · connections =================
   alpha 0.4.1: a drawer (the Connections button, or Ctrl+L) that shows how the thing you are editing hangs together
   with the rest of the game, as a small map: what it uses on the left, what uses it on the right. Click any box to
   go there.
   - a Billy, move, item, trainer, shop, place, route stop or prop: found by looking through all the game data for
     its id, both ways
   - an engine dial: where its value comes from (built in, the whole game, a scene's own look, presets), which dials
     it needs to do anything, which dials only matter when it is on, and when the game's automatic quality turns it off */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { ENGINE_DEFAULTS, ENGINE_PRESETS, ENGINE_SPEC } from '../../game/js/engine/settings.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, openSection, render, setRender, speciesName, studioState } from './studio-app.js';
import { selectedLineIndex } from './data-editors.js';
import { currentMapId, mapEditor } from './map-editor.js';
import { engineData, engineEditor, formatDialValue } from './engine-editor.js';
import { uiDialConnections } from './ui-inspect.js';
import { fieldSelector, findEngine, findField, findFlash } from './find.js';
/* eslint-disable no-func-assign */
expose({
  DIALS_OFF_BY_QUALITY: [() => DIALS_OFF_BY_QUALITY],
  DIAL_NEEDS: [() => DIAL_NEEDS],
  PROSE_KEYS: [() => PROSE_KEYS],
  allDataIds: [() => allDataIds, v => (allDataIds = v)],
  connectionGraph: [() => connectionGraph, v => (connectionGraph = v)],
  connectionMapHTML: [() => connectionMapHTML, v => (connectionMapHTML = v)],
  connectionNode: [() => connectionNode, v => (connectionNode = v)],
  connectionNodeHTML: [() => connectionNodeHTML],
  connectionsDrawer: [() => connectionsDrawer],
  connectionsHTML: [() => connectionsHTML, v => (connectionsHTML = v)],
  connectionsTarget: [() => connectionsTarget, v => (connectionsTarget = v)],
  dialConnections: [() => dialConnections, v => (dialConnections = v)],
  dialLabel: [() => dialLabel],
  drawConnectionLines: [() => drawConnectionLines, v => (drawConnectionLines = v)],
  noteConnectionsField: [
    () => noteConnectionsField,
    v => ((noteConnectionsField = v), provide({ noteConnectionsField })),
  ],
  recordOwningPath: [() => recordOwningPath, v => (recordOwningPath = v)],
  recordPath: [() => recordPath, v => (recordPath = v)],
  refreshConnections: [() => refreshConnections, v => (refreshConnections = v)],
  walkDataStrings: [() => walkDataStrings, v => (walkDataStrings = v)],
});
/* eslint-enable no-func-assign */
provide({ noteConnectionsField });
/* to-module: end */
const connectionsDrawer = { open: false, field: '' };
/* engine dials that need another one to be on; and the quality step (or device) that turns them off */
const DIAL_NEEDS = {
  'lens.bokeh': ['lens.blur'],
  'lens.focusBand': ['lens.blur'],
  'lens.blurFar': ['lens.blur'],
  'lens.blurNear': ['lens.blur'],
  'color.bloomThreshold': ['color.bloom'],
  'color.bloomSize': ['color.bloom'],
  'color.gradeAmount': ['color.grade'],
  'sun.shaftLength': ['sun.shafts'],
  'sun.cloudSpeed': ['sun.clouds', 'sun.cloudShadows'],
  'sun.cloudShadows': ['sun.clouds'],
  'sun.shafts': ['sun.strength'],
  'sun.glare': ['sun.strength'],
  'air.godRays': ['sun.strength', 'quality.shadowMap'],
  'air.lightsInAir': ['lights.brightness'],
  'air.hazeStart': ['air.haze'],
  'air.mistHeight': ['air.mist'],
  'shadows.softness': ['shadows.strength'],
  'shadows.tint': ['shadows.strength'],
  'shadows.hue': ['shadows.strength'],
  'shadows.nearRadius': ['shadows.cascades'],
  'shadows.lampShadows': ['lights.brightness'],
  'shadows.aoRadius': ['shadows.ao'],
  'shadows.aoKind': ['shadows.ao'],
  'shadows.strength': ['sun.strength', 'quality.shadowMap'],
  'lights.pools': ['lights.brightness'],
  'lights.glow': ['lights.brightness'],
  'lights.flicker': ['lights.brightness'],
  'lights.windowsDay': ['lights.windowLight'],
  'world.voxelChunky': ['world.voxelProps'],
  'world.voxelLowPoly': ['world.voxelProps'],
  'world.treeDetail': ['world.solidTrees'],
  'world.treeCount': ['world.solidTrees'],
  'world.reliefShade': ['world.relief'],
  'grass.height': ['grass.density'],
  'grass.wind': ['grass.density'],
  'grass.gusts': ['grass.wind'],
  'grass.bend': ['grass.density'],
  'water.foam': ['water.ripples'],
  'water.rings': ['water.ripples'],
  'camera.zoomMin': ['camera.zoomMax'],
  'camera.leadSmooth': ['camera.lead'],
  'camera.leadSide': ['camera.lead'],
  'camera.softW': ['camera.deadW'],
  'camera.softH': ['camera.deadH'],
};
const DIALS_OFF_BY_QUALITY = {
  'shadows.ao': 'step 1',
  'shadows.aoRadius': 'step 1',
  'shadows.aoKind': 'step 1',
  'lens.blur': 'step 4 (and step 1 makes it rougher)',
  'lens.bokeh': 'step 4',
  'lens.focusBand': 'step 4',
  'lens.blurFar': 'step 4',
  'lens.blurNear': 'step 4',
  'sun.shafts': 'step 3 (kept on when the processor, not the graphics chip, is the slow part)',
  'sun.shaftLength': 'step 3',
  'air.godRays': 'step 3 (kept on when the processor is the slow part)',
  'air.lightsInAir': 'step 3',
  'color.bloom': 'step 3 makes it smaller',
  'quality.shadowMap': 'step 2 halves it',
  'shadows.cascades': 'battles on slow devices',
  'lens.grain': 'Reduced animation',
};
const dialLabel = gk => {
  const [g, k] = gk.split('.');
  const G = (typeof ENGINE_SPEC !== 'undefined' ? ENGINE_SPEC : []).find(x => x[0] === g),
    f = G && G[2].find(x => x[0] === k);
  return f ? `${f[1]} (${G[1]})` : gk;
};
/* ---- what is selected ---- */
function connectionsTarget() {
  const D = studioState.D,
    s = studioState.sec,
    f = connectionsDrawer.field;
  if (s === 'engine' && /\.(defaults|map)\.|^maps\.[^.]+\.look\./.test(f)) {
    const m = f.match(/(?:defaults|map|look)\.([^.]+)\.([^.]+)$/);
    if (m) return { kind: 'dial', id: m[1] + '.' + m[2] };
  }
  if (s === 'billionaires') {
    const i = typeof selectedLineIndex === 'function' ? selectedLineIndex() : 0,
      L = D.lines[i];
    if (L) {
      const st = Math.min(studioState.sel.stage || 0, L.names.length - 1);
      return { kind: 'billy', id: L.id + st, line: L.id };
    }
  }
  if (s === 'moves' && studioState.sel.move) return { kind: 'move', id: studioState.sel.move };
  if (s === 'trainers' && studioState.sel.trainer) return { kind: 'trainer', id: studioState.sel.trainer };
  if (s === 'shops' && studioState.sel.shop) return { kind: 'shop', id: studioState.sel.shop };
  if (s === 'people' && studioState.sel.person) return { kind: 'person', id: studioState.sel.person };
  if (s === 'scenes') {
    if (typeof mapEditor !== 'undefined' && mapEditor.sel != null) {
      const sc = D.maps[currentMapId()],
        p = sc && sc.props[mapEditor.sel];
      if (p) return { kind: 'prop', id: p.k };
    }
    return { kind: 'scene', id: currentMapId() };
  }
  if (s === 'world' && studioState.sel.stop != null && D.locations[studioState.sel.stop])
    return { kind: 'stop', id: studioState.sel.stop };
  const m = f.match(/^(items|coins)\.([^.]+)\./);
  if (s === 'items' && m) return { kind: m[1] === 'items' ? 'item' : 'coin', id: m[2] };
  /* UI-3b: a UI look dial, on the whole game or one screen */
  if (s === 'ui' && f) {
    const m = f.match(/^uiTheme\.(?:defaults|overrides\.([^.]+))\.(.+)$/);
    if (m) return { kind: 'uidial', id: m[2], scope: m[1] || 'game' };
  }
  if (f) return { kind: 'field', id: f };
  return null;
}
/* ---- names and ways to go to things ---- */
function connectionNode(kind, id) {
  const D = studioState.D;
  switch (kind) {
    case 'billy': {
      const L = D.lines.find(l => id.startsWith(l.id) && /^\d+$/.test(id.slice(l.id.length)));
      return {
        kind,
        id,
        label: speciesName(id),
        sub: 'Billy',
        go: () =>
          openSection('billionaires', { line: L ? L.id : studioState.sel.line, stage: L ? +id.slice(L.id.length) : 0 }),
      };
    }
    case 'move':
      return {
        kind,
        id,
        label: (D.moves[id] || {}).n || id,
        sub: 'Move',
        go: () => openSection('moves', { move: id }),
      };
    case 'item':
      return {
        kind,
        id,
        label: (D.items[id] || {}).n || id,
        sub: 'Item',
        go: () => findField('items', `items.${id}.n`),
      };
    case 'coin':
      return {
        kind,
        id,
        label: (D.coins[id] || {}).n || id,
        sub: 'Tax coin',
        go: () => findField('items', `coins.${id}.n`),
      };
    case 'trainer':
      return {
        kind,
        id,
        label: (D.trainers[id] || {}).name || id,
        sub: 'Trainer',
        go: () => openSection('trainers', { trainer: id }),
      };
    case 'shop':
      return {
        kind,
        id,
        label: (D.shops[id] || {}).name || id,
        sub: 'Shop',
        go: () => openSection('shops', { shop: id }),
      };
    case 'person':
      return { kind, id, label: id, sub: 'Look', go: () => openSection('people', { person: id }) };
    case 'scene':
      return {
        kind,
        id,
        label: (D.maps[id] || {}).name || id,
        sub: 'Walk scene',
        go: () => openSection('scenes', { scene: id }),
      };
    case 'stop':
      return {
        kind,
        id,
        label: (D.locations[id] || {}).name || 'Stop ' + (+id + 1),
        sub: 'Route stop ' + (+id + 1),
        go: () => openSection('world', { wtab: 'route', stop: +id }),
      };
    case 'pool':
      return { kind, id, label: id, sub: 'Wild encounters', go: () => openSection('world', { wtab: 'pools' }) };
    case 'prop':
      return {
        kind,
        id,
        label: ((D.scenery.props || {})[id] || {}).name || id,
        sub: 'Prop',
        go: () => {
          openSection('scenes');
          if (ACTIONS.scEditProp) ACTIONS.scEditProp({ k: id });
        },
      };
    case 'type':
      return { kind, id, label: id, sub: 'Type', go: () => openSection('types') };
    case 'rules':
      return { kind, id, label: 'Rules', sub: id, go: () => findField('rules', id) };
    case 'dial':
      return {
        kind,
        id,
        label: dialLabel(id),
        sub: 'Engine dial',
        go: () => {
          const [g, k] = id.split('.');
          findEngine(g, k);
        },
      };
    default:
      return { kind, id, label: String(id), sub: kind, go: null };
  }
}
/* every id the data knows, by kind */
function allDataIds() {
  const D = studioState.D,
    m = new Map(),
    put = (id, kind) => {
      if (typeof id === 'string' && id.length >= 3 && !m.has(id)) m.set(id, kind);
    };
  D.lines.forEach(L => L.names.forEach((n, i) => put(L.id + i, 'billy')));
  Object.keys(D.moves || {}).forEach(k => put(k, 'move'));
  Object.keys(D.items || {}).forEach(k => put(k, 'item'));
  Object.keys(D.coins || {}).forEach(k => put(k, 'coin'));
  Object.keys(D.trainers || {}).forEach(k => put(k, 'trainer'));
  Object.keys(D.shops || {}).forEach(k => put(k, 'shop'));
  Object.keys(D.maps || {}).forEach(k => put(k, 'scene'));
  Object.keys(D.pools || {}).forEach(k => put(k, 'pool'));
  Object.keys((D.scenery || {}).props || {}).forEach(k => put(k, 'prop'));
  return m;
}
const PROSE_KEYS = /^(n|name|d|desc|say|text|lines|win|lose|greeting|blurb|label|note|help|title|story|body|q|a)$/;
/* where a path in the data belongs: the record that holds it */
function recordOwningPath(path) {
  const p = path.split('.');
  switch (p[0]) {
    case 'lines': {
      const L = studioState.D.lines[+p[1]];
      return L ? ['billy', L.id + '0'] : null;
    }
    case 'moves':
      return ['move', p[1]];
    case 'items':
      return ['item', p[1]];
    case 'coins':
      return ['coin', p[1]];
    case 'trainers':
      return ['trainer', p[1]];
    case 'shops':
      return ['shop', p[1]];
    case 'people':
      return ['person', p[1]];
    case 'maps':
      return ['scene', p[1]];
    case 'locations':
      return ['stop', p[1]];
    case 'pools':
      return ['pool', p[1]];
    case 'rules':
      return ['rules', p.slice(0, 3).join('.')];
    case 'scenery':
      return p[1] === 'props' ? ['prop', p[2]] : null;
    default:
      return null;
  }
}
function walkDataStrings(o, path, f) {
  if (o == null) return;
  if (typeof o === 'string') {
    f(o, path);
    return;
  }
  if (typeof o !== 'object') return;
  if (Array.isArray(o)) o.forEach((v, i) => walkDataStrings(v, path + '.' + i, f));
  else
    for (const k in o) {
      if (k[0] === '_' || PROSE_KEYS.test(k)) continue;
      walkDataStrings(o[k], path ? path + '.' + k : k, f);
    }
}
function recordPath(kind, id) {
  const D = studioState.D;
  switch (kind) {
    case 'billy': {
      const L = D.lines.find(l => id.startsWith(l.id));
      return L ? ['lines.' + D.lines.indexOf(L), L] : null;
    }
    case 'move':
      return ['moves.' + id, D.moves[id]];
    case 'item':
      return ['items.' + id, D.items[id]];
    case 'coin':
      return ['coins.' + id, D.coins[id]];
    case 'trainer':
      return ['trainers.' + id, D.trainers[id]];
    case 'shop':
      return ['shops.' + id, D.shops[id]];
    case 'person':
      return ['people.' + id, D.people[id]];
    case 'scene':
      return ['maps.' + id, Object.assign({}, D.maps[id], { props: undefined, ground: undefined, heights: undefined })];
    case 'stop':
      return ['locations.' + id, D.locations[id]];
    case 'prop':
      return ['scenery.props.' + id, (D.scenery.props || {})[id]];
    default:
      return null;
  }
}
function connectionGraph(cur) {
  const D = studioState.D,
    ids = allDataIds(),
    uses = new Map(),
    usedBy = new Map(),
    key = (k, i) => k + ':' + i;
  const ownIds = new Set([String(cur.id)]);
  if (cur.kind === 'billy') {
    const L = D.lines.find(l => cur.id.startsWith(l.id));
    if (L) L.names.forEach((n, i) => ownIds.add(L.id + i));
  }
  const R = recordPath(cur.kind, cur.id);
  if (R)
    walkDataStrings(R[1], R[0], v => {
      const k = ids.get(v);
      if (k && !ownIds.has(v)) uses.set(key(k, v), [k, v]);
    });
  if (cur.kind === 'billy') {
    const L = D.lines.find(l => cur.id.startsWith(l.id));
    if (L) new Set(L.types.flat()).forEach(t => uses.set('type:' + t, ['type', t]));
  }
  if (cur.kind === 'scene') {
    D.locations.forEach((r, i) => {
      if (r.mapId === cur.id) uses.delete('stop:' + i);
    });
  }
  const self = R ? R[0] : '';
  for (const root of ['lines', 'moves', 'items', 'coins', 'trainers', 'shops', 'maps', 'locations', 'pools', 'rules']) {
    walkDataStrings(D[root], root, (v, path) => {
      if (!ownIds.has(v) || (self && (path === self || path.startsWith(self + '.')))) return;
      const o = recordOwningPath(path);
      if (o && !(o[0] === cur.kind && String(o[1]) === String(cur.id))) usedBy.set(key(o[0], o[1]), [o[0], o[1]]);
    });
  }
  if (cur.kind === 'prop') {
    Object.entries(D.maps || {}).forEach(([k, s]) => {
      if ((s.props || []).some(p => p.k === cur.id)) usedBy.set('scene:' + k, ['scene', k]);
    });
  }
  if (cur.kind === 'scene') {
    const stops = D.locations.map((r, i) => (r.mapId === cur.id ? i : -1)).filter(i => i >= 0);
    stops.forEach(i => usedBy.set('stop:' + i, ['stop', i]));
    (D.roads || []).forEach(L => {
      const l = PB_DATA.road(D, L),
        a = stops.includes(l.a) ? l.b : stops.includes(l.b) ? l.a : null;
      if (a == null || !D.locations[a]) return;
      const s = D.locations[a].mapId;
      if (s && s !== cur.id) uses.set('scene:' + s, ['scene', s]);
    });
    const kinds = new Set((D.maps[cur.id].props || []).map(p => p.k));
    [...kinds].slice(0, 24).forEach(k => uses.set('prop:' + k, ['prop', k]));
  }
  if (cur.kind === 'stop') {
    const r = D.locations[cur.id];
    if (r) {
      if (r.mapId) uses.set('scene:' + r.mapId, ['scene', r.mapId]);
      if (r.pool) uses.set('pool:' + r.pool, ['pool', r.pool]);
      if (r.shop) uses.set('shop:' + r.shop, ['shop', r.shop]);
    }
    (D.roads || []).forEach(L => {
      const l = PB_DATA.road(D, L),
        a = l.a === +cur.id ? l.b : l.b === +cur.id ? l.a : null;
      if (a != null && D.locations[a]) uses.set('stop:' + a, ['stop', a]);
    });
  }
  return {
    uses: [...uses.values()].map(([k, i]) => connectionNode(k, i)),
    usedBy: [...usedBy.values()].map(([k, i]) => connectionNode(k, i)),
  };
}
function dialConnections(gk) {
  const [g, k] = gk.split('.'),
    D = engineData(),
    built = (ENGINE_DEFAULTS[g] || {})[k],
    game = ((D.defaults || {})[g] || {})[k],
    map = ((D.map || {})[g] || {})[k];
  const scenes = Object.entries(studioState.D.maps || {})
    .filter(([s, v]) => v.look && v.look[g] && v.look[g][k] !== undefined)
    .map(([s, v]) => ({
      kind: 'scene',
      id: s,
      label: v.name || s,
      sub: 'This place: ' + formatDialValue(v.look[g][k], 0.01),
      go: () => {
        engineEditor.scope = 'scene';
        engineEditor.scene = s;
        studioState.sel.scene = s;
        engineEditor.open[g] = 1;
        openSection('engine');
        findFlash(fieldSelector(`maps.${s}.look.${g}.${k}`));
      },
    }));
  const pre = [
    ...Object.entries(ENGINE_PRESETS)
      .filter(([n, P]) => P.v && P.v[g] && P.v[g][k] !== undefined)
      .map(([n, P]) => ({
        kind: 'preset',
        id: n,
        label: 'Look: ' + (P.name || n),
        sub: 'sets it to ' + formatDialValue(P.v[g][k], 0.01),
        go: () => openSection('engine'),
      })),
  ];
  const chain = [
    { kind: 'src', id: 'b', label: 'Built in', sub: formatDialValue(built, 0.01), go: null },
    {
      kind: 'src',
      id: 'g',
      label: 'Whole game',
      sub: game !== undefined ? formatDialValue(game, 0.01) : 'not set (built in)',
      go: () => findEngine(g, k),
      on: game !== undefined,
    },
  ];
  if (map !== undefined)
    chain.push({
      kind: 'src',
      id: 'm',
      label: 'World map',
      sub: formatDialValue(map, 0.01),
      go: () => {
        engineEditor.scope = 'map';
        engineEditor.open[g] = 1;
        openSection('engine');
      },
    });
  const needs = (DIAL_NEEDS[gk] || []).map(x => connectionNode('dial', x)),
    feeds = Object.entries(DIAL_NEEDS)
      .filter(([a, L]) => L.includes(gk))
      .map(([a]) => connectionNode('dial', a));
  return { chain, scenes, pre, needs, feeds, qoff: DIALS_OFF_BY_QUALITY[gk] || null };
}
/* ---- drawing ---- */
const connectionNodeHTML = (n, cls = '') =>
  `<button class="lk-n k-${n.kind} ${cls} ${n.on ? 'on' : ''}" ${n.go ? '' : 'disabled'} data-lk="${escapeHtml(n.kind + ':' + n.id)}"><b>${escapeHtml(n.label)}</b>${n.sub ? `<small>${escapeHtml(n.sub)}</small>` : ''}</button>`;
function connectionMapHTML(left, mid, right, lt, rt) {
  return `<div class="lk-map"><svg class="lk-svg"></svg><div class="lk-col lk-l"><h5>${lt}</h5>${left.length ? left.map(n => connectionNodeHTML(n)).join('') : '<p class="help">Nothing</p>'}</div><div class="lk-col lk-m">${connectionNodeHTML(mid, 'lk-me')}</div><div class="lk-col lk-r"><h5>${rt}</h5>${right.length ? right.map(n => connectionNodeHTML(n)).join('') : '<p class="help">Nothing</p>'}</div></div>`;
}
export function connectionsHTML() {
  const cur = connectionsTarget();
  connectionsDrawer.nodes = new Map();
  const keep = L => {
    L.forEach(n => connectionsDrawer.nodes.set(n.kind + ':' + n.id, n));
    return L;
  };
  if (!cur)
    return `<p class="help">Pick something to edit (a Billy, a move, a place, a prop…) or click into a setting, and its connections show here.</p>`;
  if (cur.kind === 'dial') {
    const I = dialConnections(cur.id),
      me = connectionNode('dial', cur.id);
    keep([...I.chain, ...I.scenes, ...I.pre, ...I.needs, ...I.feeds]);
    return `<h4>${escapeHtml(me.label)}</h4><p class="help">Where its value comes from. The last one that sets it wins: a place’s own look beats the whole game, which beats the built-in value.</p>
  <div class="lk-chain">${I.chain.map(n => connectionNodeHTML(n)).join('<span class="lk-arrow">→</span>')}${I.scenes.length ? `<span class="lk-arrow">→</span><div class="lk-stack">${I.scenes.map(n => connectionNodeHTML(n)).join('')}</div>` : ''}</div>
  ${I.pre.length ? `<h5>Looks that change it</h5><div class="lk-row">${I.pre.map(n => connectionNodeHTML(n)).join('')}</div>` : ''}
  ${connectionMapHTML(I.needs, me, I.feeds, 'It needs', 'Only matters when it’s on')}
  ${I.qoff ? `<p class="lk-q"><b>Automatic quality</b> turns this off on slow devices: ${escapeHtml(I.qoff)}. Your Studio preview always shows it at full quality.</p>` : ''}`;
  }
  if (cur.kind === 'uidial') {
    const I = uiDialConnections(cur.id, cur.scope),
      me = { kind: 'uidial', id: cur.id, label: I.label, sub: 'UI look', go: null };
    keep([...I.chain, ...I.pre, ...I.vars, ...I.parts]);
    return `<h4>${escapeHtml(I.label)}</h4><p class="help">Where its value comes from: a screen that sets it beats the whole game on that screen. Then what it writes and the parts in the preview that read it (click one to see it there).</p>
  <div class="lk-chain">${I.chain.map(n => connectionNodeHTML(n)).join('<span class="lk-arrow">→</span>')}</div>
  ${I.pre.length ? `<h5>Presets that set it</h5><div class="lk-row">${I.pre.map(n => connectionNodeHTML(n)).join('')}</div>` : ''}
  ${connectionMapHTML(I.vars, me, I.parts, 'It writes', 'Parts in the preview that read it')}${I.more ? `<p class="help">And ${I.more} more parts.</p>` : ''}`;
  }
  if (cur.kind === 'field') {
    const o = recordOwningPath(cur.id);
    return `<h4>${escapeHtml(cur.id)}</h4><p class="help">This setting belongs to ${o ? escapeHtml(connectionNode(o[0], o[1]).label) : 'the game'}. Pick a whole thing (a Billy, a move, a place) to see what it is connected to, or use Find (Ctrl+K).</p>`;
  }
  const me = connectionNode(cur.kind, cur.id),
    G = connectionGraph(cur);
  keep([me, ...G.uses, ...G.usedBy]);
  return `<h4>${escapeHtml(me.label)}</h4>${connectionMapHTML(G.uses, me, G.usedBy, 'It uses', 'Used by')}<p class="help">Found by looking for its id everywhere in the game data. Click a box to open it.</p>`;
}
function drawConnectionLines() {
  const map = $('#lnkB .lk-map');
  if (!map) return;
  const svg = map.querySelector('.lk-svg'),
    R = map.getBoundingClientRect(),
    me = map.querySelector('.lk-me');
  if (!me) return;
  const M = me.getBoundingClientRect();
  svg.setAttribute('width', R.width);
  svg.setAttribute('height', map.scrollHeight);
  let d = '';
  map.querySelectorAll('.lk-l .lk-n').forEach(n => {
    const b = n.getBoundingClientRect(),
      x1 = b.right - R.left,
      y1 = b.top + b.height / 2 - R.top,
      x2 = M.left - R.left,
      y2 = M.top + M.height / 2 - R.top;
    d += `<path d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}"/>`;
  });
  map.querySelectorAll('.lk-r .lk-n').forEach(n => {
    const b = n.getBoundingClientRect(),
      x2 = b.left - R.left,
      y2 = b.top + b.height / 2 - R.top,
      x1 = M.right - R.left,
      y1 = M.top + M.height / 2 - R.top;
    d += `<path d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}"/>`;
  });
  svg.innerHTML = d;
}
function refreshConnections() {
  if (!connectionsDrawer.open) return;
  let d = $('#lnk');
  if (!d) {
    d = document.createElement('aside');
    d.id = 'lnk';
    d.innerHTML = `<header><h3>Connections</h3><button class="lk-x" data-act="links" title="Close (Ctrl+L)">×</button></header><div class="lk-b" id="lnkB"></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', ev => {
      const b = ev.target.closest('[data-lk]');
      if (!b) return;
      const n = connectionsDrawer.nodes && connectionsDrawer.nodes.get(b.dataset.lk);
      if (n && n.go) {
        n.go();
        setTimeout(refreshConnections, 60);
      }
    });
  }
  $('#lnkB').innerHTML = (() => {
    try {
      return connectionsHTML();
    } catch (e) {
      return `<p class="help">Couldn’t work out the connections: ${escapeHtml(e.message)}</p>`;
    }
  })();
  requestAnimationFrame(drawConnectionLines);
}
function noteConnectionsField(p) {
  if (p) connectionsDrawer.field = p;
  clearTimeout(connectionsDrawer.t);
  connectionsDrawer.t = setTimeout(refreshConnections, 120);
}
ACTIONS.links = () => {
  connectionsDrawer.open = !connectionsDrawer.open;
  document.body.classList.toggle('lnk-open', connectionsDrawer.open);
  if (connectionsDrawer.open) refreshConnections();
  else {
    const d = $('#lnk');
    if (d) d.remove();
  }
};
document.addEventListener('focusin', ev => {
  const el = ev.target.closest && ev.target.closest('[data-p],[data-path]');
  if (el && ev.target.closest('.pane'))
    noteConnectionsField(el.dataset.p || (el.closest('[data-path]') && el.closest('[data-path]').dataset.path));
});
document.addEventListener('keydown', ev => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'l') {
    ev.preventDefault();
    ACTIONS.links();
  }
});
addEventListener('resize', () => {
  if (connectionsDrawer.open) drawConnectionLines();
});
addEventListener('load', () => {
  const a = $('.top-acts');
  if (a && !$('#lnkBtn')) {
    const f = $('#findBtn');
    (f || a.firstChild).insertAdjacentHTML(
      f ? 'afterend' : 'beforebegin',
      `<button class="tb" id="lnkBtn" data-act="links" title="How the thing you are editing connects to the rest of the game (Ctrl+L)">⌘ Connections</button>`
    );
  }
  /* follow the Studio: a new section or a new pick redraws the drawer */
  const r0 = render;
  setRender(function () {
    r0.apply(this, arguments);
    if (connectionsDrawer.open) noteConnectionsField();
  });
});
