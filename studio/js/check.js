'use strict';
/* ================= POCKET BILLIES STUDIO · checks =================
   The game repairs or skips anything broken when it loads, but these checks point at it first. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  legacyLineIds,
  legacyLineIdsRead,
  musicCheckFindings,
  provide,
  uiRulesCheckLine,
} from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { formProblems, lineSpeciesIds } from '../../game/js/logic/forms.js';
import { uiThemeContrast } from '../../game/js/logic/ui-theme.js';
import { storyFindings } from '../../game/js/logic/story-checks.js';
import { animFor } from '../../game/js/body-plan-animation.js';
import { boneSlot } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import { UI_ROLE_LABELS } from '../../game/js/logic/ui-dials.js';
import { RIG_NEUTRAL_POSE, rigGeo } from '../../game/js/logic/rig-joints.js';
import {
  dataBanter,
  dataBattleRules,
  dataBiomes,
  dataBosses,
  dataBuildings,
  dataCameraStops,
  dataCurrencies,
  dataEvents,
  dataFactions,
  dataFieldMoves,
  dataGenes,
  dataHeldItems,
  dataModifiers,
  dataNodeTypes,
  dataPerks,
  dataQuests,
  dataRanchRules,
  dataRegions,
  dataRelations,
  dataResidents,
  dataRewards,
  dataRigs,
  dataRoadFindings,
  dataRobotProblems,
  dataRobots,
  dataRunClock,
  dataRunLoop,
  dataRunMapRules,
  dataRunPayout,
  dataRunScene,
  dataSceneFindings,
  dataSetPieces,
  dataShowcase,
  dataSpeciesKind,
  dataSquareRules,
  dataUnlocks,
} from '../../game/js/logic/data-checks.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
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
import { atlasPath, loadedAtlas, pickFile } from './sprites.js';
import { wmlSeaShare } from './worldmap-look.js';
/* eslint-disable no-func-assign */
expose({
  CHECK_FILE_SECTIONS: [() => CHECK_FILE_SECTIONS],
  STUDIO_DATA_FAMILIES: [() => STUDIO_DATA_FAMILIES],
  checkFilePlace: [() => checkFilePlace, v => (checkFilePlace = v)],
  checkTimer: [() => checkTimer, v => (checkTimer = v)],
  renderCheckList: [() => renderCheckList, v => (renderCheckList = v)],
  runCheck: [() => runCheck, v => ((runCheck = v), provide({ runCheck }))],
  scheduleCheck: [() => scheduleCheck, v => ((scheduleCheck = v), provide({ scheduleCheck }))],
});
/* eslint-enable no-func-assign */
provide({ runCheck, scheduleCheck });
/* to-module: end */
/* Studio plan T1.3 (owner, 2026-10-22): an 'error' is what check-data (CI) fails on, and it blocks Propose; everything
   else the Check finds is a 'warn' (shown, never blocking), however much the game has to work around it. An error here
   matches one of check-data's rules: a schema (lines need names, a trainer a team), its references (moves, wild pool
   and trainer species, a stop's map and pool, ground, props, the islands, the UI look's contrast, the story), or a
   family of logic/data-checks.js */
export function runCheck() {
  const D = studioState.D,
    P = [],
    err = (msg, go, sel) => P.push({ lvl: 'error', msg, go, sel }),
    warn = (msg, go, sel) => P.push({ lvl: 'warn', msg, go, sel });
  const types = new Set(D.types.map(t => t.id)),
    /* RO-1: a line's regional forms are species too (logic/forms.js) */
    sp = new Set(D.lines.flatMap(L => lineSpeciesIds(L))),
    moves = D.moves,
    items = D.items,
    pyramids = D.pyramids;
  /* phase 16: a Billie from a line moved to game/data/legacy is stood in for by the game, so it is one warning per
     section, not an error per place. T1.3: check-data's rule (logic/data-checks.js dataSpeciesKind), with the legacy
     line ids the Legacy section reads; until they are read (or if they can't be), any name like walton0 whose line
     isn't loaded counts as legacy, as before, and a note says so */
  const legacyIds = legacyLineIds(),
    speciesKind = dataSpeciesKind(
      D.lines,
      (legacyIds || []).map(id => ({ id }))
    ),
    looksLegacy = id => typeof id === 'string' && /^[a-z]+\d+$/.test(id) && !D.lines.some(L => id.startsWith(L.id)),
    isLegacyRef = id => (legacyIds ? speciesKind(id) === 'legacy' : looksLegacy(id)),
    legacyRefs = {},
    missingSp = (id, msg, go, sel, lvl = err) => {
      if (!isLegacyRef(id)) return lvl(msg, go, sel);
      (legacyRefs[go] = legacyRefs[go] || { go, sel, ids: new Set() }).ids.add(id);
    };
  if (!legacyIds)
    legacyLineIdsRead().then(ids => {
      if (ids) scheduleCheck();
    });
  if (!D.types.length) warn('There are no types.', 'types');
  const tid = new Set();
  D.types.forEach(t => {
    if (tid.has(t.id)) warn(`Two types are called ${t.id}.`, 'types');
    tid.add(t.id);
    [...t.strong, ...t.weak].forEach(x => {
      if (!types.has(x)) warn(`${t.id} lists unknown type ${x}.`, 'types');
    });
  });
  for (const [k, M] of Object.entries(moves)) {
    if (M.t !== 'None' && !types.has(M.t)) warn(`Move ${M.n} has unknown type ${M.t}.`, 'moves', { move: k });
    if (M.c !== 'X' && !M.p && !(M.fx && M.fx.vary))
      warn(`Move ${M.n} does damage but has no power.`, 'moves', { move: k });
    if (!M.n) warn(`Move ${k} has no name.`, 'moves', { move: k });
  }
  const ids = new Set();
  D.lines.forEach(L => {
    if (ids.has(L.id)) warn(`Two Billie lines use the id ${L.id}.`, 'billionaires', { line: L.id });
    ids.add(L.id);
    const g = { line: L.id };
    if (!L.names.length) err(`Line ${L.id} has no stages.`, 'billionaires', g);
    for (const p of formProblems(L, D.coats || {}, [...types])) err(`Line ${L.id}: ${p}.`, 'billionaires', g);
    L.names.forEach((n, i) => {
      const id = L.id + i;
      if (!n) err(`${L.id} stage ${i + 1} has no name.`, 'billionaires', g);
      if (!studioState.rigs[id])
        warn(`${n || id} has no skeleton, so it can’t be drawn.`, 'billionaires', { line: L.id, stage: i });
      else
        ['front', 'back'].forEach(v => {
          if (!studioState.rigs[id][v]) warn(`${n} has no ${v} view.`, 'billionaires', { line: L.id, stage: i });
        });
      ['front', 'back'].forEach(v => {
        const path = atlasPath(id, v);
        if (!studioState.artDirty.has(path) && !studioState.files.some(f => f.path === path))
          warn(`${n}: missing art file ${path}.`, 'billionaires', { line: L.id, stage: i });
      });
      const ts = L.types[i] || [];
      if (!ts.length) warn(`${n} has no type.`, 'billionaires', g);
      ts.forEach(t => {
        if (t !== 'None' && !types.has(t)) warn(`${n} has unknown type ${t}.`, 'billionaires', g);
      });
    });
    if (!L.learn.length) warn(`${L.names[0]} learns no moves.`, 'billionaires', g);
    L.learn.forEach(([lv, m]) => {
      if (!moves[m]) err(`${L.names[0]} learns a move that doesn’t exist (${m}).`, 'billionaires', g);
    });
    if (!L.learn.some(([lv]) => lv <= 1))
      warn(`${L.names[0]} learns nothing at level 1, so a fresh one may have only one move.`, 'billionaires', g);
    if (!D.rarities[L.rar]) warn(`${L.names[0]} has unknown rarity ${L.rar}.`, 'billionaires', g);
    (L.evo || []).slice(0, L.names.length - 1).forEach((e, i) => {
      if (e && e.k === 'item' && !items[e.item || 'bell'])
        warn(`${L.names[i]} evolves with an item that doesn’t exist.`, 'billionaires', g);
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
      if (!sp.has(id))
        missingSp(id, `Fishing in ${k} lists ${id}, which doesn’t exist.`, 'world', { wtab: 'fishing' }, warn);
    });
  }
  /* phase 10, session 5: the world map's look (worldmap.json) and each place's landmark */
  const WM = D.worldmap,
    TR = (D.scenery && D.scenery.terrains) || {};
  (D.locations || []).forEach((r, i) => {
    const M = D.maps && D.maps[r.mapId];
    if (r.landmark && M && M.props && !M.props.some(q => q.k === r.landmark))
      warn(`Stop ${i + 1}, ${r.name}: its landmark ${r.landmark} isn’t in its walk scene (it still shows).`, 'hub', {
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
    /* RL-8b: an island world (sea.island) is mostly sea on purpose */
    if (sh != null && !(WM.sea && WM.sea.island > 0) && (sh < 0.3 || sh > 0.5))
      warn(`World map look: ${Math.round(sh * 100)}% of the bowl is sea; between 30% and 50% reads best.`, 'world', {
        wtab: 'look',
      });
  }
  const people = new Set(Array.isArray(D.people) ? D.people.map(x => x.id) : Object.keys(D.people || {}));
  const seats = new Set(
    Object.values(D.trainers || {})
      .filter(T => T.seat)
      .map(T => T.seat.id)
  );
  D.locations.forEach((r, i) => {
    const g = { stop: i };
    if (!D.pools[r.pool]) (r.pool ? err : warn)(`${r.name} uses wild pool ${r.pool}, which doesn’t exist.`, 'hub', g);
    if (r.battleStage && !D.battleStages[r.battleStage]) warn(`${r.name} uses an unknown battle backdrop.`, 'hub', g);
    if (r.shop && !(D.shops || {})[r.shop]) warn(`${r.name} uses a shop that doesn’t exist.`, 'hub', g);
    if (r.gate && !seats.has(r.gate))
      warn(`${r.name} is locked behind a badge nobody awards (${r.gate}). It could never open.`, 'hub', g);
  });
  for (const [k, T] of Object.entries(D.trainers || {})) {
    const g = { trainer: k };
    if (!T.tutorial && !T.miniboss && !D.locations[T.node])
      err(`${T.name} stands on a stop that doesn’t exist.`, 'trainers', g);
    if (!T.team.length) err(`${T.name} has no team.`, 'trainers', g);
    T.team.forEach(e => {
      /* a robot (sp robot) is checked by its parts, below (data-checks.js dataRobotProblems, as check-data does) */
      if (e.sp !== 'robot' && !/^@rival\d?$/.test(e.sp) && !sp.has(e.sp))
        missingSp(e.sp, `${T.name} uses ${e.sp}, which doesn’t exist.`, 'trainers', g);
    });
    if (!D.people[T.who]) warn(`${T.name} uses an unknown look.`, 'trainers', g);
    if (T.seat) {
      for (const c in T.seat.pyramids || {})
        if (!pyramids[c]) warn(`${T.name}’s badge gives an unknown pyramid.`, 'trainers', g);
      for (const it in T.seat.items || {})
        if (!items[it]) warn(`${T.name}’s badge gives an unknown item.`, 'trainers', g);
    }
  }
  const seatIds = Object.values(D.trainers || {})
    .filter(T => T.seat)
    .map(T => T.seat.id);
  if (new Set(seatIds).size !== seatIds.length) warn('Two badges share an id.', 'trainers');
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
  const R = D.rules;
  R.start.starters.forEach(l => {
    if (!sp.has(l + '0')) warn(`Starter ${l} doesn’t exist.`, 'rules');
    if (!sp.has(R.start.rival[l])) warn(`The rival has no valid pick for starter ${l}.`, 'rules');
  });
  /* phase 16: parts */
  const PR = R.parts;
  if (!PR) warn('Rules have no part sizes (parts); every Billie is drawn at its normal size.', 'parts');
  else {
    const odds = Object.values(PR.sizes || {}).reduce((a, s) => a + (+s.odds || 0), 0),
      share = (PR.slots || []).reduce((a, k) => a + (+(PR.share || {})[k] || 0), 0);
    if (Math.abs(odds - 1) > 0.001)
      warn(`Part rules: the chances add up to ${Math.round(odds * 100)}%, not 100%.`, 'parts');
    if (Math.abs(share - 1) > 0.001)
      warn(`Part rules: the weight shares add up to ${Math.round(share * 100)}%, not 100%.`, 'parts');
    if (!PR.sizes || !PR.sizes.M) warn('Part rules: there is no normal size (M), so no Billie can be Prime.', 'parts');
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
  if (!types.has(R.battle.shockType)) warn('The sandstorm type doesn’t exist.', 'rules');
  if (!types.has(R.battle.spinType)) warn('The Soak type doesn’t exist.', 'rules');
  /* T1.3: the scene and road checks are logic/data-checks.js's, so check-data (CI) runs them too */
  for (const f of [...dataSceneFindings(D, PB_DATA.road), ...dataRoadFindings(D, PB_DATA.road)])
    (f.lvl === 'error' ? err : warn)(f.msg, f.go, f.sel);
  if (!legacyIds && Object.keys(legacyRefs).length)
    warn(
      'The parked world (game/data/legacy) isn’t read yet, so Billies named like a legacy line are taken to be one. Open Legacy to read it.',
      'legacy'
    );
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
  /* UI-3b: the UI rules (game/js/logic/ui-lint.js on the game's files), one line; Show me lists every value. UI-6: an
     error when a rule is over its ceiling. T1.3: a warning, since it is the code's (npm run lint), not check-data's */
  const rules = uiRulesCheckLine();
  if (rules) P.push({ lvl: rules.over ? 'warn' : 'info', msg: rules.msg, go: 'ui', sel: { uiRules: 1 } });
  /* SND-3: the music (music-editor.js): a rule naming no song, a song nothing plays; a note on the cries */
  for (const f of musicCheckFindings()) P.push(f);
  /* Studio plan T1.3: check-data's own checks (logic/data-checks.js), in its words, file first. The UI look's family
     is left out: its Studio version is above, in the Studio's words. A family that stops on data in a shape it doesn't
     expect says so (check-data's schema check would refuse that data) */
  for (const [what, family] of STUDIO_DATA_FAMILIES) {
    let found;
    try {
      found = family(D);
    } catch (e) {
      found = [['', `the ${what} checks stopped: ${e.message}`]];
    }
    for (const [where, msg] of found) err(where ? `${where}: ${msg}` : msg, ...checkFilePlace(where));
  }
  /* Studio plan Phase 5 (T5.3): the rigs hold together, as check-data checks them; a sheet not loaded yet is checked
     against the rig's own size */
  try {
    const P0 = RIG_NEUTRAL_POSE,
      size = sheet => {
        const c = loadedAtlas('art/' + sheet);
        return c ? [c.width, c.height] : null;
      },
      geoOf = (M, view) => rigGeo(M, view, animFor(M.plan, M.q || {})(P0, view === 'back') || {}, P0);
    for (const [where, msg] of dataRigs(studioState.rigs, size, geoOf)) err(`${where}: ${msg}`, 'workbench');
  } catch (e) {
    err(`The rig checks stopped: ${e.message}`);
  }
  for (const [k, T] of Object.entries(D.trainers || {}))
    for (const m of T.team || [])
      if (m.sp === 'robot')
        for (const msg of dataRobotProblems(D, m.robot)) err(`${T.name || k} ${msg}.`, 'trainers', { trainer: k });
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
/* T1.3: the families of logic/data-checks.js the Check runs, in check-data's order */
const STUDIO_DATA_FAMILIES = /** @type {[string, (D: any) => [string, string][]][]} */ ([
  ['battle rules', dataBattleRules],
  ['run payout', dataRunPayout],
  ['ranch', dataRanchRules],
  ['square', dataSquareRules],
  ['run map', dataRunMapRules],
  ['run clock', dataRunClock],
  ['run scene', dataRunScene],
  ['run loop', dataRunLoop],
  ['robot', dataRobots],
  ['biome', dataBiomes],
  ['camera', dataCameraStops],
  ['region', dataRegions],
  ['field move', dataFieldMoves],
  ['set piece', dataSetPieces],
  ['modifier', dataModifiers],
  ['faction', dataFactions],
  ['boss', dataBosses],
  ['held item', dataHeldItems],
  ['gene', dataGenes],
  ['quest', dataQuests],
  ['resident', dataResidents],
  ['node type', dataNodeTypes],
  ['relic', dataPerks],
  ['event', dataEvents],
  ['banter', dataBanter],
  ['relations', dataRelations],
  ['showcase', dataShowcase],
  ['reward', dataRewards],
  ['currency', dataCurrencies],
  ['building', dataBuildings],
  ['unlock', dataUnlocks],
]);
/** T1.3: the section (and selection) a data file's problem opens with Show me. Phase 4's editors add theirs (relics,
 * unlocks, buildings, currencies, node types, biomes have no section yet, so their problems have no Show me) */
const CHECK_FILE_SECTIONS = {
  'rules.json': ['rules'],
  'robots.json': ['robots'],
  'uiTheme.json': ['ui'],
  'pools.json': ['world', { wtab: 'pools' }],
  'locations.json': ['hub'],
  'roads.json': ['hub'],
};
/** @param {string} where a file as check-data names it @returns {[string?, object?]} */
function checkFilePlace(where) {
  const [dir, file] = where.split('/');
  if (file && dir === 'trainers') return ['trainers', { trainer: file.replace(/\.json$/, '') }];
  if (file && dir === 'maps') return ['scenes', { scene: file.replace(/\.json$/, '') }];
  return /** @type {[string?, object?]} */ (CHECK_FILE_SECTIONS[where] || []);
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
  return `<div class="ed-col solo"><div class="ed-head"><h2>Check</h2><div class="seg-row"><button class="btn" data-act="exportData">Download game data</button><button class="btn" data-act="importData">Load game data from a file</button><button class="btn" data-act="studioTest" title="Opens and edits every section, times the Studio’s own work and lists the slowest spots (about 90 s; nothing is saved)">Run the Studio test</button></div></div>
 ${card('Problems', `<ul class="checks" id="checkList"></ul>`, {
   sub: 'Problems fail the game data check every proposal must pass, so Propose waits until they are fixed. Notes are things the game works around: worth a look, never in the way.',
 })}
</div>`;
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
