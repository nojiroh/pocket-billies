'use strict';
/* ================= POCKET BILLIES STUDIO · checks and backups =================
   The game repairs or skips anything broken when it loads, but these checks point at it first. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { decodeBase64Array } from '../../game/js/walk-view.js';
import { esc } from './game-stand-ins.js';
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
  studioState,
  toast,
} from './studio-app.js';
import { atlasPath, pickFile } from './sprites.js';
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
function runCheck() {
  const D = studioState.D,
    P = [],
    err = (msg, go, sel) => P.push({ lvl: 'error', msg, go, sel }),
    warn = (msg, go, sel) => P.push({ lvl: 'warn', msg, go, sel });
  const types = new Set(D.types.map(t => t.id)),
    sp = new Set(D.lines.flatMap(L => L.names.map((n, i) => L.id + i))),
    moves = D.moves,
    items = D.items,
    coins = D.coins;
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
      ['front', 'back'].forEach(v =>
        [0, 1].forEach(gd => {
          const path = atlasPath(id, v, gd);
          if (!studioState.artDirty.has(path) && !studioState.files.some(f => f.path === path))
            err(`${n}: missing art file ${path}.`, 'billionaires', { line: L.id, stage: i });
        })
      );
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
      if (!sp.has(id)) err(`Wild pool ${k} lists ${id}, which doesn’t exist.`, 'world', { wtab: 'pools' });
    });
    if (Pl.lv[0] > Pl.lv[1]) warn(`Wild pool ${k}: lowest level is above the highest.`, 'world', { wtab: 'pools' });
  }
  for (const [k, Pl] of Object.entries(D.fishing || {})) {
    (Pl.list || []).forEach(([id]) => {
      if (!sp.has(id)) err(`Fishing in ${k} lists ${id}, which doesn’t exist.`, 'world', { wtab: 'fishing' });
    });
  }
  /* v46: every scene says what it is, and a place's scene agrees with its place */
  for (const [k, sc] of Object.entries(D.scenes || {})) {
    const kd = sc.kind;
    if (!['town', 'route', 'room', 'test'].includes(kd)) {
      err(`${sc.name || k}: doesn’t say what it is (kind: town, route, room or test).`, 'scenes');
      continue;
    }
    const pl = (D.route || []).find(r => r.scene === k);
    if ((kd === 'town' || kd === 'route') && !pl)
      warn(`${sc.name || k} is a ${kd} scene but no stop uses it.`, 'scenes');
    if (pl && pl.kind && pl.kind !== kd)
      err(`${sc.name || k} is a ${kd} scene but its stop ${pl.name} is a ${pl.kind}.`, 'scenes');
    if (kd === 'room' && !sc.building)
      warn(`${sc.name || k} is a room but doesn’t say which building it’s the inside of.`, 'scenes');
  }
  (D.route || []).forEach((r, i) => {
    if (!['town', 'route'].includes(r.kind))
      err(`Stop ${i + 1}, ${r.name}: doesn’t say whether it’s a town or a route.`, 'world');
  });
  (D.links || []).forEach((L, i) => {
    const J = L[3] || {};
    if (!J.id || !J.from || !J.to)
      warn(`Road ${i + 1} (${(D.route[L[0]] || {}).name} – ${(D.route[L[1]] || {}).name}) has no name yet.`, 'world');
  });
  /* v26: the rooms you walk into */
  const people = new Set(Array.isArray(D.people) ? D.people.map(x => x.id) : Object.keys(D.people || {}));
  for (const k of ['shop', 'clinic', 'lab', 'house'])
    if (!(D.scenes || {})['int_' + k])
      warn(
        `There’s no room to walk into for a ${k} (scene int_${k}), so tapping one opens it straight away.`,
        'scenes'
      );
  for (const [k, sc] of Object.entries(D.scenes || {}))
    if (sc.room && sc.keeper && !String(sc.keeper).startsWith('folk:') && !people.has(sc.keeper))
      err(`${sc.name || k}: the person behind the counter (${sc.keeper}) isn’t in People.`, 'scenes');
  for (const [k, E] of Object.entries(D.eggs))
    E.list.forEach(([id]) => {
      if (!sp.has(id)) err(`The ${k} km egg lists ${id}, which doesn’t exist.`, 'world', { wtab: 'eggs' });
    });
  const seats = new Set(
    Object.values(D.trainers || {})
      .filter(T => T.seat)
      .map(T => T.seat.id)
  );
  D.route.forEach((r, i) => {
    const g = { wtab: 'route', stop: i };
    if (!D.pools[r.pool]) err(`${r.name} uses wild pool ${r.pool}, which doesn’t exist.`, 'world', g);
    if (r.area && !D.backdrops[r.area]) err(`${r.name} uses an unknown battle backdrop.`, 'world', g);
    if (r.shop && !(D.shops || {})[r.shop]) err(`${r.name} uses a shop that doesn’t exist.`, 'world', g);
    if (r.gate && !seats.has(r.gate))
      err(`${r.name} is locked behind a badge nobody awards (${r.gate}). It could never open.`, 'world', g);
    if (i && !(r.cost > 0)) warn(`${r.name} is 0 steps from the previous stop.`, 'world', g);
  });
  for (const [k, T] of Object.entries(D.trainers || {})) {
    const g = { trainer: k };
    if (!D.route[T.node]) err(`${T.name} stands on a stop that doesn’t exist.`, 'trainers', g);
    if (!T.team.length) err(`${T.name} has no team.`, 'trainers', g);
    T.team.forEach(e => {
      if (!/^@rival\d?$/.test(e.sp) && !sp.has(e.sp))
        err(`${T.name} uses ${e.sp}, which doesn’t exist.`, 'trainers', g);
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
    for (const [k, sc] of Object.entries(D.scenes || {}))
      for (const pr of sc.props || [])
        if (pr.act === 'read' && !books[pr.book])
          warn(
            `${sc.name || k}: a ${pr.k} is set to read “${pr.book || '?'}”, a book that isn’t in Lore & story.`,
            'lore',
            { ltab: 'books' }
          );
    for (const c of LO.clues || [])
      if (c.at && c.at.scene && !(D.scenes || {})[c.at.scene])
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
  if (!sp.has(R.eggs.mythSpecies)) warn('The mythical egg species doesn’t exist.', 'rules');
  for (const it in R.start.items) if (!items[it]) warn(`Starting items include unknown ${it}.`, 'rules');
  if (R.battle.subpoenaMin > R.battle.subpoenaMax) warn('Sleep turns: least is above most.', 'rules');
  if (R.catching.offerMin > R.catching.offerMax) warn('Bargain: least is above most.', 'rules');
  if (!types.has(R.battle.shockType)) err('The sandstorm type doesn’t exist.', 'rules');
  if (!types.has(R.battle.spinType)) err('The Soak type doesn’t exist.', 'rules');
  const LK = D.links || [];
  LK.forEach((l, k) => {
    if (!D.route[l[0]] || !D.route[l[1]])
      err(`Road ${k + 1} connects a stop that doesn’t exist.`, 'world', { wtab: 'route' });
    else if (l[0] === l[1]) err(`${D.route[l[0]].name} has a road to itself.`, 'world', { wtab: 'route', stop: l[0] });
    if (!(+l[2] > 0)) warn(`A road from ${(D.route[l[0]] || {}).name} has no step count.`, 'world', { wtab: 'route' });
  });
  if (LK.length) {
    const seen = new Set([0]),
      st = [0];
    while (st.length) {
      const a = st.pop();
      LK.forEach(([x, y]) => {
        const b = x === a ? y : y === a ? x : null;
        if (b != null && !seen.has(b) && D.route[b]) {
          seen.add(b);
          st.push(b);
        }
      });
    }
    D.route.forEach((r, i) => {
      if (!seen.has(i)) warn(`No road leads to ${r.name}.`, 'world', { wtab: 'route', stop: i });
    });
  }
  const SCN = D.scenes || {},
    SY = D.scenery || { terrains: {}, props: {} };
  D.route.forEach((r, i) => {
    if (r.scene && !SCN[r.scene])
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
    const users = D.route.map((r, i) => [r, i]).filter(([r]) => r.scene === k);
    users.forEach(([r, i]) => {
      const n = (D.links || []).filter(l => l[0] === i || l[1] === i).length;
      if (n > (s.exits || []).length)
        warn(
          `${r.name} has ${n} road${n === 1 ? '' : 's'} but its scene ${s.name || k} has ${(s.exits || []).length} exit${(s.exits || []).length === 1 ? '' : 's'}, so some roads share an exit.`,
          'scenes',
          g
        );
      /* v42: the join table names an exit this scene has, and both ends face each other */
      (D.links || []).forEach(l => {
        const J = l[3];
        if (!J) return;
        const end = l[0] === i ? 'a' : l[1] === i ? 'b' : null;
        if (!end || !J[end]) return;
        const e = (s.edgeExits || []).find(q => q.id === J[end]),
          o = end === 'a' ? l[1] : l[0];
        if (!e) {
          warn(
            `${r.name}: the road to ${(D.route[o] || {}).name} leaves by “${J[end]}”, but scene ${s.name || k} has no exit with that name.`,
            'scenes',
            g
          );
          return;
        }
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
  return P;
}
let checkTimer = null;
function scheduleCheck(now) {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(
    () => {
      const P = runCheck(),
        n = P.filter(p => p.lvl === 'error').length,
        w = P.length - n;
      const b = $('#checkCount');
      b.textContent = n || w || '✓';
      b.className = 'badge' + (n ? ' err' : w ? ' warn' : ' ok');
      studioState.lastCheck = P;
      if (studioState.sec === 'check' && !now) renderCheckList();
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
          `<li class="${p.lvl}"><span>${p.lvl === 'error' ? 'Problem' : 'Note'}</span><p>${esc(p.msg)}</p>${p.go ? `<button class="btn sm" data-act="fix" data-i="${i}">Show me</button>` : ''}</li>`
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
  return `<div class="ed-col solo"><div class="ed-head"><h2>Check & backups</h2><div class="seg-row"><button class="btn" data-act="exportData">Download game data</button><button class="btn" data-act="importData">Load game data from a file</button></div></div>
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
              `<tr><td>${groups[b.kind]}</td><td class="mono">${esc(b.name)}</td><td>${new Date(b.mtime * 1000).toLocaleString()}</td><td><button class="btn sm" data-act="restore" data-k="${b.kind}" data-n="${esc(b.name)}">Restore</button></td></tr>`
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
    for (const k of ['types', 'moves', 'lines', 'route', 'rules'])
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
