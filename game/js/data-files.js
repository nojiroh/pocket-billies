// @ts-check
'use strict';
/* Phase 04b: the game data is many JSON files in game/data/ instead of one gamedata.js.
   - index.json says which files there are and in which order: `keys` is the order of the top-level sections; the
     sections in `split` have one file per entry in a folder of the same name (maps/<id>.json, lines/<id>.json, ...),
     in the order of their `ids`; every other section is one file, <section>.json.
   - The build (tools/build-data.mjs, npm run data) puts them back together as data/gamedata.js for the game.
   - The game itself, when data/gamedata.js isn't there (the repository served as it is), reads the files with this
     script (js/data-fallback.js).
   - The Studio reads and writes the files with this script, so a change to one map changes one file.
   This file is shared by all three: the browser (self.PB_DATA) and Node (tools/build-data.mjs runs it in a sandbox). */
/** @import { DataFiles, DataIndex, GameData } from '../types/game-data' */
self.PB_DATA = (() => {
  // the sections with a file per entry: an array (each entry has an id) or an object (the key is the id)
  /** @type {DataFiles['SPLIT']} */
  const SPLIT = { lines: 'array', people: 'object', trainers: 'object', maps: 'object', cutscenes: 'object' };
  const ID = /^[a-z0-9_]+$/;

  // index.json -> [{ section, id, path }] in load order
  /** @param {DataIndex} index */
  function files(index) {
    /** @type {ReturnType<DataFiles['files']>} */
    const out = [];
    for (const key of index.keys) {
      const s = index.split && index.split[key];
      if (s) for (const id of s.ids) out.push({ section: key, id, path: `${key}/${id}.json` });
      else out.push({ section: key, id: null, path: `${key}.json` });
    }
    return out;
  }

  // read(path) -> the parsed file; returns the whole game data, sections and entries in the index's order
  /** @param {DataIndex} index @param {(path: string) => any} read @returns {GameData} */
  function assemble(index, read) {
    /** @type {any} */
    const D = {};
    for (const key of index.keys) {
      const s = index.split && index.split[key];
      if (!s) {
        D[key] = read(`${key}.json`);
        continue;
      }
      if (s.array) D[key] = s.ids.map(id => read(`${key}/${id}.json`));
      else {
        D[key] = {};
        for (const id of s.ids) D[key][id] = read(`${key}/${id}.json`);
      }
    }
    return D;
  }

  // the whole game data -> { index, files: { path: value } }
  /** @param {Record<string, any>} D */
  function split(D) {
    /** @type {DataIndex} */
    const index = { keys: Object.keys(D), split: {} },
      /** @type {Record<string, unknown>} */
      out = {};
    for (const key of index.keys) {
      const kind = SPLIT[key],
        v = D[key];
      if (!kind) {
        out[`${key}.json`] = v;
        continue;
      }
      const entries = kind === 'array' ? v.map(e => [e && e.id, e]) : Object.entries(v);
      /** @type {string[]} */
      const ids = [];
      for (const [id, e] of entries) {
        if (typeof id !== 'string' || !ID.test(id))
          throw new Error(`${key}: the id ${JSON.stringify(id)} can't be a file name`);
        if (ids.includes(id)) throw new Error(`${key}: the id ${id} is there twice`);
        ids.push(id);
        out[`${key}/${id}.json`] = e;
      }
      index.split[key] = kind === 'array' ? { array: true, ids } : { ids };
    }
    return { index, files: out };
  }

  /* The files' layout: JSON indented by one space, but short values and lists of numbers on one line, so a map's
     grids are one row per line and a prop is one line. Parsing it gives back exactly the same data. */
  const flat = v => v === null || typeof v !== 'object';
  function inline(v) {
    if (flat(v)) return true;
    const kids = Array.isArray(v) ? v : Object.values(v);
    if (Array.isArray(v) && kids.every(k => k === null || typeof k === 'number' || typeof k === 'boolean')) return true;
    return kids.every(k => flat(k) || (Array.isArray(k) && k.every(flat))) && JSON.stringify(v).length <= 120;
  }
  /** @param {any} v @param {string} [pad] @returns {string} */
  function format(v, pad = '') {
    if (inline(v)) return JSON.stringify(v);
    const p = pad + ' ';
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '[\n' + v.map(k => p + format(k, p)).join(',\n') + '\n' + pad + ']';
    }
    const ks = Object.keys(v).filter(k => v[k] !== undefined);
    if (!ks.length) return '{}';
    return '{\n' + ks.map(k => p + JSON.stringify(k) + ': ' + format(v[k], p)).join(',\n') + '\n' + pad + '}';
  }
  const text = v => format(v) + '\n';

  // phase 08b: the roads between places. roads.json is a list of typed links,
  //   { id, name, kind: 'seam' | 'lift', a: { map, exit }, b: { map, exit } }
  // a seam joins two places' edges at the exits; a lift (no exits) is the glass lift between them.
  // each end naming a place by its map (the place's mapId, or its id when it has none; either is found) and the edge
  // exit it leaves by.
  // The Studio and the tools read and change roads only through these (the game through game-data.js ROADS); they
  // speak of a place as its position in D.locations (a node), as the rest of the data does.
  /** @param {any} D @param {string} map */
  const placeOf = (D, map) => (D.locations || []).findIndex(/** @param {any} r */ r => r.mapId === map || r.id === map);
  /** @param {any} D @param {number} node */
  const mapOf = (D, node) => (D.locations[node] ? D.locations[node].mapId || D.locations[node].id : null);
  /** @param {any} D @param {any} l @returns {import('../types/game-data').RoadView} */
  function road(D, l) {
    const A = l.a || {},
      B = l.b || {};
    return {
      a: placeOf(D, A.map),
      b: placeOf(D, B.map),
      exitA: A.exit || null,
      exitB: B.exit || null,
      id: l.id || null,
      name: l.name || null,
      kind: l.kind || 'seam',
    };
  }
  // one end of a road: its place (a node; null keeps it) and the exit it leaves by (undefined keeps it, null clears it)
  /** @param {any} D @param {any} l @param {'a' | 'b'} end @param {number | null} node @param {string | null} [exit] */
  function setRoadEnd(D, l, end, node, exit) {
    const E = l[end] || (l[end] = {});
    if (node != null) E.map = mapOf(D, node);
    if (exit === undefined) return;
    if (exit) E.exit = exit;
    else delete E.exit;
  }
  // a new road from place a to place b, added to D.roads; its exits are set with setRoadEnd
  /** @param {any} D @param {number} a @param {number} b */
  function addRoad(D, a, b) {
    const l = { kind: 'seam', a: { map: mapOf(D, a) }, b: { map: mapOf(D, b) } };
    (D.roads || (D.roads = [])).push(l);
    return l;
  }

  // phase 08b: a building's door leads to a room: the one set on the building (p.room), else the one made for its kind
  // of building (scenery.json, the kind's room), else the one for what it does. The rooms to try, in that order (the
  // first that exists is the one); the game's door link is walk-view.js doorLinkOf. HB-5: 'enter' has no room of its
  // own: it walks into the room set on the building or its kind (an inn, a library, the Workshop), else nothing
  /** @type {Record<string, string>} */
  const ROOM_BY_USE = {
    shop: 'int_shop',
    clinic: 'int_clinic',
    lab: 'int_lab',
    house: 'int_house',
    ranch: 'int_barn',
    enter: '',
  };
  /** does a door that does this (its act) lead into a room? @param {string | null | undefined} act */
  function opensRoom(act) {
    return !!act && Object.prototype.hasOwnProperty.call(ROOM_BY_USE, act);
  }
  /** @param {any} p @param {any} M @param {string | null} act @returns {string[]} */
  function doorRooms(p, M, act) {
    const out = [];
    if (p) {
      if (p.room) out.push(p.room);
      if (M && M.room) out.push(M.room);
    }
    if (act && ROOM_BY_USE[act]) out.push(ROOM_BY_USE[act]);
    return out;
  }

  return { SPLIT, files, assemble, split, format, text, road, setRoadEnd, addRoad, ROOM_BY_USE, opensRoom, doorRooms };
})();
