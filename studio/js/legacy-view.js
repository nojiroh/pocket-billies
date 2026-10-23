'use strict';
/* ================= LEGACY WORLD (roguelite track RL-5) =================
   The old world outside the hub, parked in game/data/legacy (its own legacy/index.json, in the game data's layout):
   shown here read-only. It is never put in the Studio's data (studioState.D): Save writes every key of that and
   removes what isn't there, so nothing parked is saved, undone, sent to the game or deleted from here. Copy into game
   brings one of its maps back as a walk scene of its own (no place, no roads), in one undo step. Legacy data isn't
   covered by tools/check-data-text.py, so every text shown here is escaped. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  card,
  changed,
  clone,
  commit,
  dialog,
  openSection,
  render,
  sectionShown,
  studioState,
  toast,
} from './studio-app.js';
import { githubDataText, githubMode } from './github.js';
/* eslint-disable no-func-assign */
expose({
  legacyJson: [() => legacyJson],
  legacyLoad: [() => legacyLoad, v => (legacyLoad = v)],
  legacyText: [() => legacyText, v => (legacyText = v)],
  legacyView: [() => legacyView],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const legacyView = { data: null, loading: null, error: '' };

/** a file of game/data/legacy as text: from the site the Studio is served from (beside the game), else from GitHub
    when signed in @param {string} path */
async function legacyText(path) {
  try {
    const r = await fetch('../game/data/legacy/' + path, { cache: 'no-cache' });
    if (r.ok) return await r.text();
  } catch (e) {}
  if (githubMode.on && githubMode.token) return githubDataText('legacy/' + path);
  throw new Error(`game/data/legacy/${path} could not be read`);
}
const legacyJson = async (/** @type {string} */ path) => JSON.parse(await legacyText(path));

/* the parked world without its maps (a map is read when it is copied) */
export function legacyLoad() {
  if (legacyView.data || legacyView.loading) return legacyView.loading;
  legacyView.error = '';
  legacyView.loading = (async () => {
    try {
      const ix = await legacyJson('index.json'),
        split = ix.split || {},
        out = { mapIds: (split.maps || {}).ids || [], lines: (split.lines || {}).ids || [], trainers: {} };
      await Promise.all(ix.keys.filter(k => !split[k]).map(async k => (out[k] = await legacyJson(k + '.json'))));
      await Promise.all(
        ((split.trainers || {}).ids || []).map(async id => (out.trainers[id] = await legacyJson(`trainers/${id}.json`)))
      );
      legacyView.data = out;
    } catch (e) {
      legacyView.error = e.message || String(e);
    }
    legacyView.loading = null;
    if (sectionShown('legacy')) render();
  })();
  return legacyView.loading;
}

SECTIONS.legacy = () => {
  const L = legacyView.data;
  if (!L) {
    if (!legacyView.error && !legacyView.loading) legacyLoad();
    return card(
      'The parked world',
      legacyView.error
        ? `<p class="help">It couldn’t be read: ${escapeHtml(legacyView.error)}</p><button class="btn" data-act="legacyRetry">Try again</button>`
        : '<p class="help">Reading game/data/legacy…</p>'
    );
  }
  const places = L.locations || [],
    roads = L.roads || [],
    here = (/** @type {number} */ i) =>
      Object.values(L.trainers)
        .filter(T => T.node === i)
        .map(T => escapeHtml(T.name))
        .join(', '),
    /* a road's other end by its place's name: a parked place's, else the game's (Copperleaf), else the map id */
    nameOf = (/** @type {string} */ map) =>
      (places.find(l => l.mapId === map) || (studioState.D.locations || []).find(l => l.mapId === map) || {}).name ||
      map,
    roadsOf = (/** @type {any} */ l) =>
      roads
        .filter(r => (r.a && r.a.map) === l.mapId || (r.b && r.b.map) === l.mapId)
        .map(r => {
          const other = (r.a && r.a.map) === l.mapId ? r.b && r.b.map : r.a && r.a.map;
          return `${escapeHtml(nameOf(other))} (${escapeHtml(r.name || r.id)})`;
        });
  const rows = places
    .map((l, i) => {
      const R = roadsOf(l);
      return `<tr><td class="mono">${i}</td><td><b>${escapeHtml(l.name)}</b><br><small>${escapeHtml(l.kind || '')}${l.region ? ' · ' + escapeHtml(l.region) : ''}${l.gate ? ' · gate ' + escapeHtml(l.gate) : ''}</small></td><td><small>${here(i) || '—'}</small></td><td><small>${R.length ? R.join(', ') : '—'}</small></td><td><button class="btn" data-act="legacyCopy" data-id="${escapeHtml(l.mapId)}" title="Bring its map into the game as a scene of its own">Copy into game</button></td></tr>`;
    })
    .join('');
  const count = (/** @type {any} */ v) => (Array.isArray(v) ? v.length : v ? Object.keys(v).length : 0);
  return (
    card(
      'The parked world',
      `<p class="help">The places outside the hub, parked in <code>game/data/legacy</code> (roguelite track RL-5): kept for reference and reuse, never loaded by the game, never saved from here. ${places.length} places and their maps, ${roads.length} roads, ${count(L.trainers)} trainers, ${count(L.shops)} shops, ${count(L.jobs)} jobs, ${count((L.lore || {}).locations)} places’ lore and ${L.lines.length} old Billie lines. The eight badge leaders stayed in the game as mini-bosses.</p><p class="help"><b>Copy into game</b> brings a place’s map back as a walk scene of its own, without its place or its roads; anything its people say that names a trainer, place or flag the game no longer has shows in the Check. One Undo takes it back; Ctrl+S saves it.</p>`
    ) +
    card(
      'Places',
      `<table class="tbl"><thead><tr><th>Old stop</th><th>Place</th><th>Trainers there</th><th>Roads to</th><th></th></tr></thead><tbody>${rows}</tbody></table>`,
      { sub: 'A place’s old stop is its number in legacy/locations.json (its trainers stand by it).' }
    )
  );
};
ACTIONS.legacyRetry = () => {
  legacyView.error = '';
  legacyLoad();
  render();
};
ACTIONS.legacyCopy = async (/** @type {{ id: string }} */ d) => {
  const D = studioState.D;
  let M;
  try {
    M = await legacyJson(`maps/${d.id}.json`);
  } catch (e) {
    toast(`Couldn’t read the map ${d.id}: ${e.message}`, 'bad');
    return;
  }
  const name = await dialog(
    'Copy into game',
    `<label class="fld"><span>Scene id</span><input id="lgName" value="${escapeHtml(d.id)}"></label><p class="help">${escapeHtml(M.name || d.id)} becomes a walk scene of its own (kind ${escapeHtml(M.kind || '?')}): no place and no roads, its old ones stay parked. Its people’s scripts may name trainers, places or flags the game no longer has: the Check lists them.</p>`,
    [
      { l: 'Cancel', v: null },
      { l: 'Copy', c: 'primary', f: () => $('#lgName').value.trim() },
    ]
  );
  if (name == null) return;
  /* a map id keeps underscores and its length (uniqueKey makes short keys: tallgrass_meadow became tallgrassmea) */
  const base =
      (name || d.id)
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '') || d.id,
    sc = clone(M);
  let id = base;
  for (let i = 2; D.maps[id]; i++) id = base + '_' + i;
  delete sc.locationId;
  D.maps[id] = sc;
  studioState.sel.scene = id;
  changed();
  commit(true);
  openSection('scenes');
  toast(`Copied ${id} into the game as a scene of its own. Ctrl+S saves it.`);
};
