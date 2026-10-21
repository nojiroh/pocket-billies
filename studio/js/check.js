'use strict';
/* ================= POCKET BILLIES STUDIO · checks and backups =================
   The game repairs or skips anything broken when it loads, but these checks point at it first. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, uiRulesCheckLine } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { uiThemeContrast } from '../../game/js/logic/ui-theme.js';
import { storyFindings } from '../../game/js/logic/story-checks.js';
import { boneSlot } from '../../game/js/skeleton-rig.js';
import { decodeBase64Array } from '../../game/js/walk-view.js';
import { escapeHtml } from './game-stand-ins.js';
import { UI_ROLE_LABELS } from '../../game/js/logic/ui-dials.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  api,
  ask,
  card,
  changed,
  openSection,
  render,
  sectionShown,
  studioProbe,
  studioState,
  toast,
} from './studio-app.js';
import { storyFindingPlace } from './story-editor.js';
import { atlasPath, pickFile } from './sprites.js';
import { wmlSeaShare } from './worldmap-look.js';
/* eslint-disable no-func-assign */
expose({
  checkTimer: [() => checkTimer, v => (checkTimer = v)],
  loadBackups: [() => loadBackups, v => (loadBackups = v)],
  renderCheckList: [() => renderCheckList, v => (renderCheckList = v)],
  runCheck: [() => runCheck, v => ((runCheck = v), provide({ runCheck }))],
  scheduleCheck: [() => scheduleCheck, v => ((scheduleCheck = v), provide({ scheduleCheck }))],
});
/* eslint-enable no-func-assign */
provide({ runCheck, scheduleCheck });
/* to-module: end */
export function runCheck() {
  const D = studioState.D,
    P = [],
    err = (msg, go, sel) => P.push({ lvl: 'error', msg, go, sel }),
    warn = (msg, go, sel) => P.push({ lvl: 'warn', msg, go, sel });
  const types = new Set(D.types.map(t => t.id)),
    sp = new Set(D.lines.flatMap(L => L.names.map((n, i) => L.id + i))),
    moves = D.moves,
    items = D.items,
    coins = D.coins;
  /* phase 16: a Billie from a line moved to game/data/legacy (a name like walton0 whose line isn't loaded) is stood in
     for by the game, so it is one warning per section, not an error per place */
  const legacyRefs = {},
    isLegacyRef = id => typeof id === 'string' && /^[a-z]+\d+$/.test(id) && !D.lines.some(L => id.startsWith(L.id)),
    missingSp = (id, msg, go, sel) => {
      if (!isLegacyRef(id)) return err(msg, go, sel);
      (legacyRefs[go] = legacyRefs[go] || { go, sel, ids: new Set() }).ids.add(id);
    };
  if (!D.types.length) err('There are no types.', 'types');
  const tid = new Set();
  D.types.forEach(t => {
    if (tid.has(t.id)) err(`Two types are called ${t.id}.`, 'types');
    tid.add(t.id);
    [...t.strong, ...t.weak].forEach(x => {
      if (!types.has(x)) warn(`${t.id} lists unknown type ${x}.`, 'types');
    });
  });
  for (const [k, M] of Object.entries(moves)) {
    if (M.t !== 'None' && !types.has(M.t)) err(`Move ${M.n} has unknown type ${M.t}.`, 'moves', { move: k });
    if (M.c !== 'X' && !M.p && !(M.fx && M.fx.vary))
      warn(`Move ${M.n} does damage but has no power.`, 'moves', { move: k });
    if (!M.n) err(`Move ${k} has no name.`, 'moves', { move: k });
  }
  const ids = new Set();
  D.lines.forEach(L => {
    if (ids.has(L.id)) err(`Two Billie lines use the id ${L.id}.`, 'billionaires', { line: L.id });
    ids.add(L.id);
    const g = { line: L.id };
    if (!L.names.length) err(`Line ${L.id} has no stages.`, 'billionaires', g);
    L.names.forEach((n, i) => {
      const id = L.id + i;
      if (!n) err(`${L.id} stage ${i + 1} has no name.`, 'billionaires', g);
      if (!studioState.rigs[id])
        err(`${n || id} has no skeleton, so it can’t be drawn.`, 'billionaires', { line: L.id, stage: i });
      else
        ['front', 'back'].forEach(v => {
          if (!studioState.rigs[id][v]) err(`${n} has no ${v} view.`, 'billionaires', { line: L.id, stage: i });
        });
      ['front', 'back'].forEach(v => {
        const path = atlasPath(id, v);
        if (!studioState.artDirty.has(path) && !studioState.files.some(f => f.path === path))
          err(`${n}: missing art file ${path}.`, 'billionaires', { line: L.id, stage: i });
      });
      const ts = L.types[i] || [];
      if (!ts.length) warn(`${n} has no type.`, 'billionaires', g);
      ts.forEach(t => {
        if (t !== 'None' && !types.has(t)) err(`${n} has unknown type ${t}.`, 'billionaires', g);
      });
    });
    if (!L.learn.length) err(`${L.names[0]} learns no moves.`, 'billionaires', g);
    L.learn.forEach(([lv, m]) => {
      if (!moves[m]) err(`${L.names[0]} learns a move that doesn’t exist (${m}).`, 'billionaires', g);
    });
    if (!L.learn.some(([lv]) => lv <= 1))
      warn(`${L.names[0]} learns nothing at level 1, so a fresh one may have only one move.`, 'billionaires', g);
    if (!D.rarities[L.rar]) err(`${L.names[0]} has unknown rarity ${L.rar}.`, 'billionaires', g);
    (L.evo || []).slice(0, L.names.length - 1).forEach((e, i) => {
      if (e && e.k === 'item' && !items[e.item || 'bell'])
        err(`${L.names[i]} evolves with an item that doesn’t exist.`, 'billionaires', g);
    });
    if (L.prof && L.prof.length !== D.stats.length)
      err(`${L.names[0]}’s stat profile has the wrong number of stats.`, 'billionaires', g);
  });
  for (const [k, Pl] of Object.entries(D.pools)) {
    if (!Pl.list.length) warn(`Wild pool ${k} is empty.`, 'world', { wtab: 'pools' });
    Pl.list.forEach(([id]) => {
      if (!sp.has(id)) missingSp(id, `Wild pool ${k} lists ${id}, which doesn’t exist.`, 'world', { wtab: 'pools' });
    });
    if (Pl.lv[0] > Pl.lv[1]) warn(`Wild pool ${k}: lowest level is above the highest.`, 'world', { wtab: 'pools' });
  }
  for (const [k, Pl] of Object.entries(D.fishing || {})) {
    (Pl.list || []).forEach(([id]) => {
      if (!sp.has(id)) missingSp(id, `Fishing in ${k} lists ${id}, which doesn’t exist.`, 'world', { wtab: 'fishing' });
    });
  }
  /* v46: every scene says what it is, and a place's scene agrees with its place */
  for (const [k, sc] of Object.entries(D.maps || {})) {
    const kd = sc.kind;
    if (!['town', 'route', 'room', 'test'].includes(kd)) {
      err(`${sc.name || k}: doesn’t say what it is (kind: town, route, room or test).`, 'scenes');
      continue;
    }
    const pl = (D.locations || []).find(r => r.mapId === k);
    if ((kd === 'town' || kd === 'route') && !pl)
      warn(`${sc.name || k} is a ${kd} scene but no stop uses it.`, 'scenes');
    if (pl && pl.kind && pl.kind !== kd)
      err(`${sc.name || k} is a ${kd} scene but its stop ${pl.name} is a ${pl.kind}.`, 'scenes');
    if (kd === 'room' && !sc.building)
      warn(`${sc.name || k} is a room but doesn’t say which building it’s the inside of.`, 'scenes');
  }
  (D.locations || []).forEach((r, i) => {
    if (!['town', 'route'].includes(r.kind))
      err(`Stop ${i + 1}, ${r.name}: doesn’t say whether it’s a town or a route.`, 'world');
  });
  /* phase 10, session 5: the world map's look (worldmap.json) and each place's landmark */
  const WM = D.worldmap,
    TR = (D.scenery && D.scenery.terrains) || {};
  (D.locations || []).forEach((r, i) => {
    const M = D.maps && D.maps[r.mapId];
    if (r.landmark && M && M.props && !M.props.some(q => q.k === r.landmark))
      warn(`Stop ${i + 1}, ${r.name}: its landmark ${r.landmark} isn’t in its walk scene (it still shows).`, 'world', {
        wtab: 'route',
        stop: i,
      });
    if (WM && r.region && !WM.regions[r.region])
      warn(
        `Stop ${i + 1}, ${r.name}: region ${r.region} has no ground on the world map (it uses starter’s).`,
        'world',
        {
          wtab: 'look',
        }
      );
  });
  if (WM) {
    for (const [k, R] of Object.entries(WM.regions))
      for (const f of ['ground', 'wet', 'dry', 'high'])
        for (const ch of R[f] || '')
          if (!TR[ch])
            err(`World map look: region ${k} (${f}) names a ground “${ch}” that doesn’t exist.`, 'world', {
              wtab: 'look',
            });
    const sh = typeof wmlSeaShare === 'function' ? wmlSeaShare() : null;
    if (sh != null && (sh < 0.3 || sh > 0.5))
      warn(`World map look: ${Math.round(sh * 100)}% of the bowl is sea; between 30% and 50% reads best.`, 'world', {
        wtab: 'look',
      });
  }
  (D.roads || []).forEach((L, i) => {
    const r = PB_DATA.road(D, L);
    if (!r.id)
      warn(
        `Road ${i + 1} (${(D.locations[r.a] || {}).name} – ${(D.locations[r.b] || {}).name}) has no name yet.`,
        'world'
      );
    /* phase 08b: a road joins two places at an exit of each; without both it joins nothing */
    if (r.kind === 'seam' && (!r.exitA || !r.exitB) && D.locations[r.a] && D.locations[r.b])
      err(
        `The road between ${D.locations[r.a].name} and ${D.locations[r.b].name} doesn’t say which exit it leaves by at ${!r.exitA ? D.locations[r.a].name : D.locations[r.b].name}.`,
        'world',
        { wtab: 'route', stop: !r.exitA ? r.a : r.b }
      );
  });
  /* v26: the rooms you walk into */
  const people = new Set(Array.isArray(D.people) ? D.people.map(x => x.id) : Object.keys(D.people || {}));
  for (const k of ['shop', 'clinic', 'lab', 'house'])
    if (!(D.maps || {})['int_' + k])
      warn(
        `There’s no room to walk into for a ${k} (scene int_${k}), so tapping one opens it straight away.`,
        'scenes'
      );
  for (const [k, sc] of Object.entries(D.maps || {}))
    if (sc.room && sc.keeper && !String(sc.keeper).startsWith('folk:') && !people.has(sc.keeper))
      err(`${sc.name || k}: the person behind the counter (${sc.keeper}) isn’t in People.`, 'scenes');
  for (const [k, E] of Object.entries(D.eggs))
    E.list.forEach(([id]) => {
      if (!sp.has(id))
        missingSp(id, `The ${E.need / 1000} km egg lists ${id}, which doesn’t exist.`, 'world', { wtab: 'eggs' });
    });
  const seats = new Set(
    Object.values(D.trainers || {})
      .filter(T => T.seat)
      .map(T => T.seat.id)
  );
  D.locations.forEach((r, i) => {
    const g = { wtab: 'route', stop: i };
    if (!D.pools[r.pool]) err(`${r.name} uses wild pool ${r.pool}, which doesn’t exist.`, 'world', g);
    if (r.battleStage && !D.battleStages[r.battleStage]) err(`${r.name} uses an unknown battle backdrop.`, 'world', g);
    if (r.shop && !(D.shops || {})[r.shop]) err(`${r.name} uses a shop that doesn’t exist.`, 'world', g);
    if (r.gate && !seats.has(r.gate))
      err(`${r.name} is locked behind a badge nobody awards (${r.gate}). It could never open.`, 'world', g);
  });
  for (const [k, T] of Object.entries(D.trainers || {})) {
    const g = { trainer: k };
    if (!D.locations[T.node]) err(`${T.name} stands on a stop that doesn’t exist.`, 'trainers', g);
    if (!T.team.length) err(`${T.name} has no team.`, 'trainers', g);
    T.team.forEach(e => {
      if (!/^@rival\d?$/.test(e.sp) && !sp.has(e.sp))
        missingSp(e.sp, `${T.name} uses ${e.sp}, which doesn’t exist.`, 'trainers', g);
    });
    if (!D.people[T.who]) warn(`${T.name} uses an unknown look.`, 'trainers', g);
    if (T.seat) {
      for (const c in T.seat.coins || {}) if (!coins[c]) err(`${T.name}’s badge gives an unknown coin.`, 'trainers', g);
      for (const it in T.seat.items || {})
        if (!items[it]) err(`${T.name}’s badge gives an unknown item.`, 'trainers', g);
    }
    if (T.egg && !D.eggs[T.egg]) warn(`${T.name} gives an egg size that doesn’t exist.`, 'trainers', g);
  }
  const seatIds = Object.values(D.trainers || {})
    .filter(T => T.seat)
    .map(T => T.seat.id);
  if (new Set(seatIds).size !== seatIds.length) err('Two badges share an id.', 'trainers');
  /* v47: the lore: books on furniture, where clues lie, people's looks */
  {
    const LO = D.lore || {},
      books = LO.books || {};
    for (const [k, sc] of Object.entries(D.maps || {}))
      for (const pr of sc.props || [])
        if (pr.act === 'read' && !books[pr.book])
          warn(
            `${sc.name || k}: a ${pr.k} is set to read “${pr.book || '?'}”, a book that isn’t in Lore & story.`,
            'lore',
            { ltab: 'books' }
          );
    for (const c of LO.clues || [])
      if (c.at && c.at.scene && !(D.maps || {})[c.at.scene])
        warn(`The clue “${c.title}” lies in a scene that doesn’t exist (${c.at.scene}).`, 'lore', { ltab: 'clues' });
    for (const [k, P] of Object.entries(LO.people || {}))
      if (P.who && !people.has(P.who))
        warn(`${P.name || k} (Lore & story) has a look that isn’t in People.`, 'lore', { ltab: 'people' });
  }
  for (const [k, s] of Object.entries(D.shops || {}))
    (s.stock || []).forEach(w => {
      if (w.item && !items[w.item]) err(`${s.name} sells an item that doesn’t exist.`, 'shops', { shop: k });
      if (w.coin && !coins[w.coin]) err(`${s.name} sells a coin that doesn’t exist.`, 'shops', { shop: k });
    });
  for (const [k, J] of Object.entries(D.jobs)) {
    const [kind, key] = J.out;
    if (kind === 'item' && !items[key]) err(`Job ${J.n} pays an unknown item.`, 'jobs');
    if (kind === 'coin' && !coins[key]) err(`Job ${J.n} pays an unknown coin.`, 'jobs');
  }
  const R = D.rules;
  R.start.starters.forEach(l => {
    if (!sp.has(l + '0')) err(`Starter ${l} doesn’t exist.`, 'rules');
    if (!sp.has(R.start.rival[l])) warn(`The rival has no valid pick for starter ${l}.`, 'rules');
  });
  if (!sp.has(R.eggs.mythSpecies) && !isLegacyRef(R.eggs.mythSpecies))
    warn('The mythical egg species doesn’t exist.', 'rules');
  /* phase 16: parts */
  const PR = R.parts;
  if (!PR) warn('Rules have no part sizes (parts); every Billie is drawn at its normal size.', 'parts');
  else {
    const odds = Object.values(PR.sizes || {}).reduce((a, s) => a + (+s.odds || 0), 0),
      share = (PR.slots || []).reduce((a, k) => a + (+(PR.share || {})[k] || 0), 0);
    if (Math.abs(odds - 1) > 0.001)
      warn(`Part sizes: the chances add up to ${Math.round(odds * 100)}%, not 100%.`, 'parts');
    if (Math.abs(share - 1) > 0.001)
      warn(`Part sizes: the weight shares add up to ${Math.round(share * 100)}%, not 100%.`, 'parts');
    if (!PR.sizes || !PR.sizes.M) err('Part sizes: there is no normal size (M), so no Billie can be Prime.', 'parts');
    D.lines.forEach(L =>
      L.names.forEach((n, i) => {
        const meta = studioState.rigs[L.id + i] && studioState.rigs[L.id + i].front;
        if (!meta) return;
        const has = new Set(meta.bones.map(b => boneSlot(b)).filter(Boolean)),
          miss = (PR.slots || []).filter(k => !has.has(k));
        if (miss.length)
          warn(
            `${n}: no part is its ${miss.join(', ')} slot, so ${miss.length > 1 ? 'those sizes change' : 'that size changes'} only its weight. Set “Part slot” in the skeleton builder.`,
            'billionaires',
            { line: L.id, stage: i }
          );
      })
    );
  }
  for (const it in R.start.items) if (!items[it]) warn(`Starting items include unknown ${it}.`, 'rules');
  if (R.battle.subpoenaMin > R.battle.subpoenaMax) warn('Sleep turns: least is above most.', 'rules');
  if (R.catching.offerMin > R.catching.offerMax) warn('Bargain: least is above most.', 'rules');
  if (!types.has(R.battle.shockType)) err('The sandstorm type doesn’t exist.', 'rules');
  if (!types.has(R.battle.spinType)) err('The Soak type doesn’t exist.', 'rules');
  const LK = (D.roads || []).map(l => PB_DATA.road(D, l));
  LK.forEach((l, k) => {
    if (!D.locations[l.a] || !D.locations[l.b])
      err(`Road ${k + 1} connects a stop that doesn’t exist.`, 'world', { wtab: 'route' });
    else if (l.a === l.b) err(`${D.locations[l.a].name} has a road to itself.`, 'world', { wtab: 'route', stop: l.a });
  });
  if (LK.length) {
    const seen = new Set([0]),
      st = [0];
    while (st.length) {
      const a = st.pop();
      LK.forEach(({ a: x, b: y }) => {
        const b = x === a ? y : y === a ? x : null;
        if (b != null && !seen.has(b) && D.locations[b]) {
          seen.add(b);
          st.push(b);
        }
      });
    }
    D.locations.forEach((r, i) => {
      if (!seen.has(i)) warn(`No road leads to ${r.name}.`, 'world', { wtab: 'route', stop: i });
    });
  }
  const SCN = D.maps || {},
    SY = D.scenery || { terrains: {}, props: {} };
  D.locations.forEach((r, i) => {
    if (r.mapId && !SCN[r.mapId])
      err(`${r.name} uses a walk scene that doesn’t exist.`, 'world', { wtab: 'route', stop: i });
  });
  for (const [k, s] of Object.entries(SCN)) {
    const g = { scene: k },
      bad = new Set();
    (s.tiles || []).forEach(row => {
      for (const ch of row) if (!SY.terrains[ch]) bad.add(ch);
    });
    if (bad.size) err(`Scene ${s.name || k} uses unknown ground ${[...bad].join(', ')}.`, 'scenes', g);
    if ((s.tiles || []).length !== s.h)
      warn(`Scene ${s.name || k} has ${(s.tiles || []).length} rows of ground but is ${s.h} tall.`, 'scenes', g);
    (s.props || []).forEach(p => {
      if (!SY.props[p.k]) err(`Scene ${s.name || k} places an unknown prop (${p.k}).`, 'scenes', g);
    });
    if (!s.hub && (!s.path || s.path.length < 2))
      warn(`Scene ${s.name || k} has no hub (where you stand) and no path.`, 'scenes', g);
    (s.life || []).forEach(L => {
      if (!['duck', 'pigeon', 'chicken', 'sheep', 'car'].includes(L.k))
        warn(`Scene ${s.name || k} lists unknown life (${L.k}).`, 'scenes', g);
      else if (L.k === 'car' && !(L.path && L.path.length > 1))
        warn(`Scene ${s.name || k} has cars without a road to drive along.`, 'scenes', g);
    });
    (s.props || []).forEach(p => {
      if (p.act === 'shop' && p.shop && !(D.shops || {})[p.shop])
        warn(`Scene ${s.name || k} has a shop door for a shop that doesn’t exist (${p.shop}).`, 'scenes', g);
    });
    /* v18: cliffs, stairs and bridges */
    if (s.steps) {
      const raw = typeof decodeBase64Array === 'function' ? decodeBase64Array(s.steps, Int16Array) : null;
      if (raw && raw.length !== s.w * 2 * s.h * 2)
        warn(
          `Scene ${s.name || k}: its cliffs and stairs were made for a different map size. Repaint them with Cliffs & stairs.`,
          'scenes',
          g
        );
    }
    const ter = (x, z) => {
      const row = (s.tiles || [])[s.h - 1 - Math.floor(z)] || '';
      return row[Math.floor(x)] || s.edge;
    };
    (s.bridges || []).forEach((b, n) => {
      const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
      const out = p => p[0] < 0 || p[1] < 0 || p[0] > s.w || p[1] > s.h;
      if (L < 1) warn(`Scene ${s.name || k}: bridge ${n + 1} is shorter than a metre.`, 'scenes', g);
      else if (out(b.a) || out(b.b)) warn(`Scene ${s.name || k}: bridge ${n + 1} runs off the map.`, 'scenes', g);
      else if ('wd'.includes(ter(b.a[0], b.a[1])) || 'wd'.includes(ter(b.b[0], b.b[1])))
        warn(
          `Scene ${s.name || k}: bridge ${n + 1} ends in the water, so nobody can step onto it. Drag it from bank to bank.`,
          'scenes',
          g
        );
    });
    (s.arches || []).forEach((a, n) => {
      if (a.x < 0 || a.z < 0 || a.x > s.w || a.z > s.h)
        warn(`Scene ${s.name || k}: arch ${n + 1} is off the map.`, 'scenes', g);
    });
    (s.waters || []).forEach((r, n) => {
      let wet = false;
      for (let z = Math.floor(r.z); z < r.z + r.h && !wet; z++)
        for (let x = Math.floor(r.x); x < r.x + r.w; x++) {
          const ch = ((s.tiles || [])[s.h - 1 - z] || '')[x];
          if (ch === 'w' || ch === 'd') {
            wet = true;
            break;
          }
        }
      if (!wet) warn(`Scene ${s.name || k}: water rectangle ${n + 1} (${r.k}) covers no water.`, 'scenes', g);
      if (!['pond', 'stream', 'canal', 'spring', 'swamp', 'lake'].includes(r.k))
        warn(`Scene ${s.name || k}: water rectangle ${n + 1} has an unknown kind “${r.k}”.`, 'scenes', g);
    });
    const users = D.locations.map((r, i) => [r, i]).filter(([r]) => r.mapId === k);
    users.forEach(([r, i]) => {
      const n = (D.roads || [])
        .map(l => PB_DATA.road(D, l))
        .filter(l => l.kind === 'seam' && (l.a === i || l.b === i)).length;
      if (n > (s.exits || []).length)
        warn(
          `${r.name} has ${n} road${n === 1 ? '' : 's'} but its scene ${s.name || k} has ${(s.exits || []).length} exit${(s.exits || []).length === 1 ? '' : 's'}, so some roads share an exit.`,
          'scenes',
          g
        );
      /* v42: each link names an exit this scene has (phase 08b: and the two ends face each other) */
      (D.roads || []).forEach(L => {
        const l = PB_DATA.road(D, L),
          end = l.a === i ? 'a' : l.b === i ? 'b' : null,
          id = end === 'a' ? l.exitA : end === 'b' ? l.exitB : null;
        if (!id) return;
        const e = (s.edgeExits || []).find(q => q.id === id),
          o = end === 'a' ? l.b : l.a;
        if (!e) {
          warn(
            `${r.name}: the road to ${(D.locations[o] || {}).name} leaves by “${id}”, but scene ${s.name || k} has no exit with that name.`,
            'scenes',
            g
          );
          return;
        }
        /* phase 08b: and the other end's exit faces it (east to west, north to south), or the places can't join */
        const os = D.maps[(D.locations[o] || {}).mapId],
          oe = os && (os.edgeExits || []).find(q => q.id === (end === 'a' ? l.exitB : l.exitA)),
          OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
        if (end === 'a' && oe && OPP[e.side] !== oe.side)
          err(
            `${r.name}: the road to ${D.locations[o].name} leaves by ${id} (${e.side}), which doesn’t face ${oe.id} (${oe.side}) there, so the two can’t join.`,
            'scenes',
            g
          );
      });
    });
  }
  for (const [k, M] of Object.entries(SY.props || {})) {
    const B = M.build;
    if (!B) continue;
    if (!M.box) warn(`${M.name || k} is a 3D building without a footprint, so it is shown as its picture.`, 'scenes');
    if (B.wall && B.wall[0] >= B.wall[1])
      warn(`${M.name || k}: its 3D walls are the wrong way round (left is right of right).`, 'scenes');
  }
  for (const [k, sh] of Object.entries(D.shops || {}))
    (sh.sells || []).forEach(o => {
      if (!(D.shops || {})[o]) warn(`${sh.name} sells the clothes of a shop that doesn’t exist (${o}).`, 'shops');
    });
  for (const r of Object.values(legacyRefs))
    warn(
      `${r.ids.size} Billie${r.ids.size === 1 ? '' : 's'} named here ${r.ids.size === 1 ? 'is' : 'are'} in legacy (${[...r.ids].slice(0, 4).join(', ')}${r.ids.size > 4 ? '…' : ''}); the game stands in one of the new lines for ${r.ids.size === 1 ? 'it' : 'them'}.`,
      r.go,
      r.sel
    );
  /* UI-3: the UI look's colours read on its ground and surfaces (the check check-data runs, logic/ui-theme.js) */
  if (D.uiTheme && D.uiTheme.defaults)
    for (const f of uiThemeContrast(D.uiTheme)) {
      const role = (UI_ROLE_LABELS.find(r => r[0] === f.fg) || [])[1] || f.fg,
        bg = f.bg === 'ground' ? 'the ground' : 'a surface',
        where = f.where.startsWith('screen:') ? f.where.slice(7) : f.where ? '' : 'game';
      err(
        `UI look${f.where ? ` (${f.where.replace(':', ' ')})` : ''}: ${role} (${f.side}) reads at ${f.ratio.toFixed(2)}:1 on ${bg}, under ${f.min}:1.`,
        'ui',
        where ? { uiFocus: { scope: where, rel: `color.${f.side}.${f.fg}` } } : {}
      );
    }
  /* UI-3b: the UI rules (game/js/logic/ui-lint.js on the game's files), one report line; Show me lists every value */
  const rules = uiRulesCheckLine();
  if (rules) P.push({ lvl: 'info', msg: rules, go: 'ui', sel: { uiRules: 1 } });
  /* Project Story S3: the story checks, the same ones check-data runs (game/js/logic/story-checks.js) */
  try {
    for (const f of storyFindings(D)) {
      const [go, sel] = storyFindingPlace(f, D);
      (f.level === 'problem' ? err : warn)(`Story: ${f.text}`, go, sel);
    }
  } catch (e) {
    err(`The story checks stopped: ${e.message}`, 'story');
  }
  return P;
}
let checkTimer = null;
export function scheduleCheck(now) {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(
    () => {
      const T = studioProbe.on,
        a = T ? performance.now() : 0;
      const P = runCheck(),
        n = P.filter(p => p.lvl === 'error').length,
        w = P.filter(p => p.lvl === 'warn').length; // UI-3b: a report line ('info') is not counted
      const b = $('#checkCount');
      b.textContent = n || w || '✓';
      b.className = 'badge' + (n ? ' err' : w ? ' warn' : ' ok');
      studioState.lastCheck = P;
      if (T) T('check', { ms: performance.now() - a, problems: P.length });
      if (sectionShown('check') && !now) renderCheckList();
    },
    now ? 0 : 500
  );
}
function renderCheckList() {
  const el = $('#checkList');
  if (!el) return;
  const P = runCheck();
  el.innerHTML = P.length
    ? P.map(
        (p, i) =>
          `<li class="${p.lvl}"><span>${p.lvl === 'error' ? 'Problem' : p.lvl === 'info' ? 'Report' : 'Note'}</span><p>${escapeHtml(p.msg)}</p>${p.go ? `<button class="btn sm" data-act="fix" data-i="${i}">Show me</button>` : ''}</li>`
      ).join('')
    : '<li class="ok"><span>All good</span><p>No problems found. The game will load every Billie, move and rule.</p></li>';
  studioState.lastCheck = P;
}
ACTIONS.fix = d => {
  const p = studioState.lastCheck[+d.i];
  if (p) openSection(p.go, p.sel || {});
};
SECTIONS.check = () => {
  afterRender(renderCheckList);
  afterRender(loadBackups);
  return `<div class="ed-col solo"><div class="ed-head"><h2>Check & backups</h2><div class="seg-row"><button class="btn" data-act="exportData">Download game data</button><button class="btn" data-act="importData">Load game data from a file</button><button class="btn" data-act="studioTest" title="Opens and edits every section, times the Studio’s own work and lists the slowest spots (about 90 s; nothing is saved)">Run the Studio test</button></div></div>
 ${card('Problems', `<ul class="checks" id="checkList"></ul>`, { sub: 'Problems are things the game will skip or patch over. Notes are worth a look.' })}
 ${card('Backups', `<p class="help">Every save keeps the previous version in the backups folder. Restoring replaces the current file (which is backed up first). Reload the Studio afterwards.</p><div id="backupList">Loading…</div>`)}</div>`;
};
async function loadBackups() {
  const el = $('#backupList');
  if (!el) return;
  try {
    const B = await api('backups');
    const groups = { data: 'Game data', rigs: 'Skeletons', art: 'Art' };
    el.innerHTML = B.length
      ? `<table class="tbl"><thead><tr><th>Kind</th><th>File</th><th>Saved</th><th></th></tr></thead><tbody>${B.slice(
          0,
          60
        )
          .map(
            b =>
              `<tr><td>${groups[b.kind]}</td><td class="mono">${escapeHtml(b.name)}</td><td>${new Date(b.mtime * 1000).toLocaleString()}</td><td><button class="btn sm" data-act="restore" data-k="${b.kind}" data-n="${escapeHtml(b.name)}">Restore</button></td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="help">No backups yet. They appear after your first save.</p>';
  } catch (e) {
    el.textContent = e.message;
  }
}
ACTIONS.restore = async d => {
  if (studioState.dirty || studioState.rigsDirty || studioState.artDirty.size) {
    if (
      !(await ask('You have unsaved changes. Restoring will reload the Studio and they’ll be lost.', 'Restore anyway'))
    )
      return;
  } else if (!(await ask('Restore this backup? The current file is backed up first.', 'Restore'))) return;
  try {
    const r = await api('restore', { method: 'POST', body: JSON.stringify({ kind: d.k, name: d.n }) });
    studioState.dirty = studioState.rigsDirty = false;
    studioState.artDirty.clear();
    toast('Restored ' + r.restored + '. Reloading…', 'ok');
    setTimeout(() => location.reload(), 800);
  } catch (e) {
    toast(e.message, 'err');
  }
};
ACTIONS.exportData = () => {
  const b = new Blob([JSON.stringify(studioState.D, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v), 1)], {
      type: 'application/json',
    }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'pocket-billies-gamedata.json';
  a.click();
};
ACTIONS.importData = async () => {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    for (const k of ['types', 'moves', 'lines', 'locations', 'rules'])
      if (!o[k]) throw new Error(`That file has no “${k}”.`);
    if (
      !(await ask('Replace the game data in the Studio with this file? Nothing is written until you save.', 'Load it'))
    )
      return;
    studioState.D = o;
    changed();
    render();
    toast('Loaded. Review it, then save to game.');
  } catch (e) {
    toast('Not a Pocket Billies game data file: ' + e.message, 'err');
  }
};
