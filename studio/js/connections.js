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
import { esc } from './game-stand-ins.js';
import { ACTS, ST, go, render, setRender, spName } from './studio-app.js';
import { curLine } from './data-editors.js';
import { SCN, scId } from './scenes.js';
import { ENS, engD, engFmt } from './engine-editor.js';
import { findEngine, findField, findFlash, findSel } from './find.js';
/* eslint-disable no-func-assign */
expose({
  ENG_NEEDS: [() => ENG_NEEDS],
  ENG_QOFF: [() => ENG_QOFF],
  LNK: [() => LNK],
  LNK_TEXT: [() => LNK_TEXT],
  engLabel: [() => engLabel],
  linkCur: [() => linkCur, v => (linkCur = v)],
  linkNote: [() => linkNote, v => ((linkNote = v), provide({ linkNote }))],
  linkRefresh: [() => linkRefresh, v => (linkRefresh = v)],
  lnkBox: [() => lnkBox],
  lnkDial: [() => lnkDial, v => (lnkDial = v)],
  lnkGraph: [() => lnkGraph, v => (lnkGraph = v)],
  lnkHTML: [() => lnkHTML, v => (lnkHTML = v)],
  lnkIds: [() => lnkIds, v => (lnkIds = v)],
  lnkLines: [() => lnkLines, v => (lnkLines = v)],
  lnkMap: [() => lnkMap, v => (lnkMap = v)],
  lnkNode: [() => lnkNode, v => (lnkNode = v)],
  lnkOwner: [() => lnkOwner, v => (lnkOwner = v)],
  lnkRecord: [() => lnkRecord, v => (lnkRecord = v)],
  lnkWalk: [() => lnkWalk, v => (lnkWalk = v)],
});
/* eslint-enable no-func-assign */
provide({ linkNote });
/* to-module: end */
const LNK = { open: false, field: '' };
/* engine dials that need another one to be on; and the quality step (or device) that turns them off */
const ENG_NEEDS = {
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
};
const ENG_QOFF = {
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
const engLabel = gk => {
  const [g, k] = gk.split('.');
  const G = (typeof ENGINE_SPEC !== 'undefined' ? ENGINE_SPEC : []).find(x => x[0] === g),
    f = G && G[2].find(x => x[0] === k);
  return f ? `${f[1]} (${G[1]})` : gk;
};
/* ---- what is selected ---- */
function linkCur() {
  const D = ST.D,
    s = ST.sec,
    f = LNK.field;
  if (s === 'engine' && /\.(defaults|map)\.|^scenes\.[^.]+\.look\./.test(f)) {
    const m = f.match(/(?:defaults|map|look)\.([^.]+)\.([^.]+)$/);
    if (m) return { kind: 'dial', id: m[1] + '.' + m[2] };
  }
  if (s === 'billionaires') {
    const i = typeof curLine === 'function' ? curLine() : 0,
      L = D.lines[i];
    if (L) {
      const st = Math.min(ST.sel.stage || 0, L.names.length - 1);
      return { kind: 'billy', id: L.id + st, line: L.id };
    }
  }
  if (s === 'moves' && ST.sel.move) return { kind: 'move', id: ST.sel.move };
  if (s === 'trainers' && ST.sel.trainer) return { kind: 'trainer', id: ST.sel.trainer };
  if (s === 'shops' && ST.sel.shop) return { kind: 'shop', id: ST.sel.shop };
  if (s === 'people' && ST.sel.person) return { kind: 'person', id: ST.sel.person };
  if (s === 'scenes') {
    if (typeof SCN !== 'undefined' && SCN.sel != null) {
      const sc = D.scenes[scId()],
        p = sc && sc.props[SCN.sel];
      if (p) return { kind: 'prop', id: p.k };
    }
    return { kind: 'scene', id: scId() };
  }
  if (s === 'world' && ST.sel.stop != null && D.route[ST.sel.stop]) return { kind: 'stop', id: ST.sel.stop };
  const m = f.match(/^(items|coins)\.([^.]+)\./);
  if (s === 'items' && m) return { kind: m[1] === 'items' ? 'item' : 'coin', id: m[2] };
  if (f) return { kind: 'field', id: f };
  return null;
}
/* ---- names and ways to go to things ---- */
function lnkNode(kind, id) {
  const D = ST.D;
  switch (kind) {
    case 'billy': {
      const L = D.lines.find(l => id.startsWith(l.id) && /^\d+$/.test(id.slice(l.id.length)));
      return {
        kind,
        id,
        label: spName(id),
        sub: 'Billy',
        go: () => go('billionaires', { line: L ? L.id : ST.sel.line, stage: L ? +id.slice(L.id.length) : 0 }),
      };
    }
    case 'move':
      return { kind, id, label: (D.moves[id] || {}).n || id, sub: 'Move', go: () => go('moves', { move: id }) };
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
        go: () => go('trainers', { trainer: id }),
      };
    case 'shop':
      return { kind, id, label: (D.shops[id] || {}).name || id, sub: 'Shop', go: () => go('shops', { shop: id }) };
    case 'person':
      return { kind, id, label: id, sub: 'Look', go: () => go('people', { person: id }) };
    case 'scene':
      return {
        kind,
        id,
        label: (D.scenes[id] || {}).name || id,
        sub: 'Walk scene',
        go: () => go('scenes', { scene: id }),
      };
    case 'stop':
      return {
        kind,
        id,
        label: (D.route[id] || {}).name || 'Stop ' + (+id + 1),
        sub: 'Route stop ' + (+id + 1),
        go: () => go('world', { wtab: 'route', stop: +id }),
      };
    case 'pool':
      return { kind, id, label: id, sub: 'Wild encounters', go: () => go('world', { wtab: 'pools' }) };
    case 'prop':
      return {
        kind,
        id,
        label: ((D.scenery.props || {})[id] || {}).name || id,
        sub: 'Prop',
        go: () => {
          go('scenes');
          if (ACTS.scEditProp) ACTS.scEditProp({ k: id });
        },
      };
    case 'type':
      return { kind, id, label: id, sub: 'Type', go: () => go('types') };
    case 'rules':
      return { kind, id, label: 'Rules', sub: id, go: () => findField('rules', id) };
    case 'dial':
      return {
        kind,
        id,
        label: engLabel(id),
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
function lnkIds() {
  const D = ST.D,
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
  Object.keys(D.scenes || {}).forEach(k => put(k, 'scene'));
  Object.keys(D.pools || {}).forEach(k => put(k, 'pool'));
  Object.keys((D.scenery || {}).props || {}).forEach(k => put(k, 'prop'));
  return m;
}
const LNK_TEXT = /^(n|name|d|desc|say|text|lines|win|lose|greeting|blurb|label|note|help|title|story|body|q|a)$/;
/* where a path in the data belongs: the record that holds it */
function lnkOwner(path) {
  const p = path.split('.');
  switch (p[0]) {
    case 'lines': {
      const L = ST.D.lines[+p[1]];
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
    case 'scenes':
      return ['scene', p[1]];
    case 'route':
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
function lnkWalk(o, path, f) {
  if (o == null) return;
  if (typeof o === 'string') {
    f(o, path);
    return;
  }
  if (typeof o !== 'object') return;
  if (Array.isArray(o)) o.forEach((v, i) => lnkWalk(v, path + '.' + i, f));
  else
    for (const k in o) {
      if (k[0] === '_' || LNK_TEXT.test(k)) continue;
      lnkWalk(o[k], path ? path + '.' + k : k, f);
    }
}
function lnkRecord(kind, id) {
  const D = ST.D;
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
      return [
        'scenes.' + id,
        Object.assign({}, D.scenes[id], { props: undefined, ground: undefined, heights: undefined }),
      ];
    case 'stop':
      return ['route.' + id, D.route[id]];
    case 'prop':
      return ['scenery.props.' + id, (D.scenery.props || {})[id]];
    default:
      return null;
  }
}
function lnkGraph(cur) {
  const D = ST.D,
    ids = lnkIds(),
    uses = new Map(),
    usedBy = new Map(),
    key = (k, i) => k + ':' + i;
  const ownIds = new Set([String(cur.id)]);
  if (cur.kind === 'billy') {
    const L = D.lines.find(l => cur.id.startsWith(l.id));
    if (L) L.names.forEach((n, i) => ownIds.add(L.id + i));
  }
  const R = lnkRecord(cur.kind, cur.id);
  if (R)
    lnkWalk(R[1], R[0], v => {
      const k = ids.get(v);
      if (k && !ownIds.has(v)) uses.set(key(k, v), [k, v]);
    });
  if (cur.kind === 'billy') {
    const L = D.lines.find(l => cur.id.startsWith(l.id));
    if (L) new Set(L.types.flat()).forEach(t => uses.set('type:' + t, ['type', t]));
  }
  if (cur.kind === 'scene') {
    D.route.forEach((r, i) => {
      if (r.scene === cur.id) uses.delete('stop:' + i);
    });
  }
  const self = R ? R[0] : '';
  for (const root of ['lines', 'moves', 'items', 'coins', 'trainers', 'shops', 'scenes', 'route', 'pools', 'rules']) {
    lnkWalk(D[root], root, (v, path) => {
      if (!ownIds.has(v) || (self && (path === self || path.startsWith(self + '.')))) return;
      const o = lnkOwner(path);
      if (o && !(o[0] === cur.kind && String(o[1]) === String(cur.id))) usedBy.set(key(o[0], o[1]), [o[0], o[1]]);
    });
  }
  if (cur.kind === 'prop') {
    Object.entries(D.scenes || {}).forEach(([k, s]) => {
      if ((s.props || []).some(p => p.k === cur.id)) usedBy.set('scene:' + k, ['scene', k]);
    });
  }
  if (cur.kind === 'scene') {
    const stops = D.route.map((r, i) => (r.scene === cur.id ? i : -1)).filter(i => i >= 0);
    stops.forEach(i => usedBy.set('stop:' + i, ['stop', i]));
    (D.links || []).forEach(l => {
      const a = stops.includes(l[0]) ? l[1] : stops.includes(l[1]) ? l[0] : null;
      if (a == null || !D.route[a]) return;
      const s = D.route[a].scene;
      if (s && s !== cur.id) uses.set('scene:' + s, ['scene', s]);
    });
    const kinds = new Set((D.scenes[cur.id].props || []).map(p => p.k));
    [...kinds].slice(0, 24).forEach(k => uses.set('prop:' + k, ['prop', k]));
  }
  if (cur.kind === 'stop') {
    const r = D.route[cur.id];
    if (r) {
      if (r.scene) uses.set('scene:' + r.scene, ['scene', r.scene]);
      if (r.pool) uses.set('pool:' + r.pool, ['pool', r.pool]);
      if (r.shop) uses.set('shop:' + r.shop, ['shop', r.shop]);
    }
    (D.links || []).forEach(l => {
      const a = l[0] === +cur.id ? l[1] : l[1] === +cur.id ? l[0] : null;
      if (a != null && D.route[a]) uses.set('stop:' + a, ['stop', a]);
    });
  }
  return {
    uses: [...uses.values()].map(([k, i]) => lnkNode(k, i)),
    usedBy: [...usedBy.values()].map(([k, i]) => lnkNode(k, i)),
  };
}
function lnkDial(gk) {
  const [g, k] = gk.split('.'),
    D = engD(),
    built = (ENGINE_DEFAULTS[g] || {})[k],
    game = ((D.defaults || {})[g] || {})[k],
    map = ((D.map || {})[g] || {})[k];
  const scenes = Object.entries(ST.D.scenes || {})
    .filter(([s, v]) => v.look && v.look[g] && v.look[g][k] !== undefined)
    .map(([s, v]) => ({
      kind: 'scene',
      id: s,
      label: v.name || s,
      sub: 'This place: ' + engFmt(v.look[g][k], 0.01),
      go: () => {
        ENS.scope = 'scene';
        ENS.scene = s;
        ST.sel.scene = s;
        ENS.open[g] = 1;
        go('engine');
        findFlash(findSel(`scenes.${s}.look.${g}.${k}`));
      },
    }));
  const pre = [
    ...Object.entries(ENGINE_PRESETS)
      .filter(([n, P]) => P.v && P.v[g] && P.v[g][k] !== undefined)
      .map(([n, P]) => ({
        kind: 'preset',
        id: n,
        label: 'Look: ' + (P.name || n),
        sub: 'sets it to ' + engFmt(P.v[g][k], 0.01),
        go: () => go('engine'),
      })),
  ];
  const chain = [
    { kind: 'src', id: 'b', label: 'Built in', sub: engFmt(built, 0.01), go: null },
    {
      kind: 'src',
      id: 'g',
      label: 'Whole game',
      sub: game !== undefined ? engFmt(game, 0.01) : 'not set (built in)',
      go: () => findEngine(g, k),
      on: game !== undefined,
    },
  ];
  if (map !== undefined)
    chain.push({
      kind: 'src',
      id: 'm',
      label: 'World map',
      sub: engFmt(map, 0.01),
      go: () => {
        ENS.scope = 'map';
        ENS.open[g] = 1;
        go('engine');
      },
    });
  const needs = (ENG_NEEDS[gk] || []).map(x => lnkNode('dial', x)),
    feeds = Object.entries(ENG_NEEDS)
      .filter(([a, L]) => L.includes(gk))
      .map(([a]) => lnkNode('dial', a));
  return { chain, scenes, pre, needs, feeds, qoff: ENG_QOFF[gk] || null };
}
/* ---- drawing ---- */
const lnkBox = (n, cls = '') =>
  `<button class="lk-n k-${n.kind} ${cls} ${n.on ? 'on' : ''}" ${n.go ? '' : 'disabled'} data-lk="${esc(n.kind + ':' + n.id)}"><b>${esc(n.label)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</button>`;
function lnkMap(left, mid, right, lt, rt) {
  return `<div class="lk-map"><svg class="lk-svg"></svg><div class="lk-col lk-l"><h5>${lt}</h5>${left.length ? left.map(n => lnkBox(n)).join('') : '<p class="help">Nothing</p>'}</div><div class="lk-col lk-m">${lnkBox(mid, 'lk-me')}</div><div class="lk-col lk-r"><h5>${rt}</h5>${right.length ? right.map(n => lnkBox(n)).join('') : '<p class="help">Nothing</p>'}</div></div>`;
}
function lnkHTML() {
  const cur = linkCur();
  LNK.nodes = new Map();
  const keep = L => {
    L.forEach(n => LNK.nodes.set(n.kind + ':' + n.id, n));
    return L;
  };
  if (!cur)
    return `<p class="help">Pick something to edit (a Billy, a move, a place, a prop…) or click into a setting, and its connections show here.</p>`;
  if (cur.kind === 'dial') {
    const I = lnkDial(cur.id),
      me = lnkNode('dial', cur.id);
    keep([...I.chain, ...I.scenes, ...I.pre, ...I.needs, ...I.feeds]);
    return `<h4>${esc(me.label)}</h4><p class="help">Where its value comes from. The last one that sets it wins: a place’s own look beats the whole game, which beats the built-in value.</p>
  <div class="lk-chain">${I.chain.map(n => lnkBox(n)).join('<span class="lk-arrow">→</span>')}${I.scenes.length ? `<span class="lk-arrow">→</span><div class="lk-stack">${I.scenes.map(n => lnkBox(n)).join('')}</div>` : ''}</div>
  ${I.pre.length ? `<h5>Looks that change it</h5><div class="lk-row">${I.pre.map(n => lnkBox(n)).join('')}</div>` : ''}
  ${lnkMap(I.needs, me, I.feeds, 'It needs', 'Only matters when it’s on')}
  ${I.qoff ? `<p class="lk-q"><b>Automatic quality</b> turns this off on slow devices: ${esc(I.qoff)}. Your Studio preview always shows it at full quality.</p>` : ''}`;
  }
  if (cur.kind === 'field') {
    const o = lnkOwner(cur.id);
    return `<h4>${esc(cur.id)}</h4><p class="help">This setting belongs to ${o ? esc(lnkNode(o[0], o[1]).label) : 'the game'}. Pick a whole thing (a Billy, a move, a place) to see what it is connected to, or use Find (Ctrl+K).</p>`;
  }
  const me = lnkNode(cur.kind, cur.id),
    G = lnkGraph(cur);
  keep([me, ...G.uses, ...G.usedBy]);
  return `<h4>${esc(me.label)}</h4>${lnkMap(G.uses, me, G.usedBy, 'It uses', 'Used by')}<p class="help">Found by looking for its id everywhere in the game data. Click a box to open it.</p>`;
}
function lnkLines() {
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
function linkRefresh() {
  if (!LNK.open) return;
  let d = $('#lnk');
  if (!d) {
    d = document.createElement('aside');
    d.id = 'lnk';
    d.innerHTML = `<header><h3>Connections</h3><button class="lk-x" data-act="links" title="Close (Ctrl+L)">×</button></header><div class="lk-b" id="lnkB"></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', ev => {
      const b = ev.target.closest('[data-lk]');
      if (!b) return;
      const n = LNK.nodes && LNK.nodes.get(b.dataset.lk);
      if (n && n.go) {
        n.go();
        setTimeout(linkRefresh, 60);
      }
    });
  }
  $('#lnkB').innerHTML = (() => {
    try {
      return lnkHTML();
    } catch (e) {
      return `<p class="help">Couldn’t work out the connections: ${esc(e.message)}</p>`;
    }
  })();
  requestAnimationFrame(lnkLines);
}
function linkNote(p) {
  if (p) LNK.field = p;
  clearTimeout(LNK.t);
  LNK.t = setTimeout(linkRefresh, 120);
}
ACTS.links = () => {
  LNK.open = !LNK.open;
  document.body.classList.toggle('lnk-open', LNK.open);
  if (LNK.open) linkRefresh();
  else {
    const d = $('#lnk');
    if (d) d.remove();
  }
};
document.addEventListener('focusin', ev => {
  const el = ev.target.closest && ev.target.closest('[data-p],[data-path]');
  if (el && ev.target.closest('#main'))
    linkNote(el.dataset.p || (el.closest('[data-path]') && el.closest('[data-path]').dataset.path));
});
document.addEventListener('keydown', ev => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'l') {
    ev.preventDefault();
    ACTS.links();
  }
});
addEventListener('resize', () => {
  if (LNK.open) lnkLines();
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
    if (LNK.open) linkNote();
  });
});
