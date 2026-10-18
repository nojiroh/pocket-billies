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
self.PB_DATA = (() => {
  // the sections with a file per entry: an array (each entry has an id) or an object (the key is the id)
  const SPLIT = { lines: 'array', people: 'object', trainers: 'object', maps: 'object' };
  const ID = /^[a-z0-9_]+$/;

  // index.json -> [{ section, id, path }] in load order
  function files(index) {
    const out = [];
    for (const key of index.keys) {
      const s = index.split && index.split[key];
      if (s) for (const id of s.ids) out.push({ section: key, id, path: `${key}/${id}.json` });
      else out.push({ section: key, id: null, path: `${key}.json` });
    }
    return out;
  }

  // read(path) -> the parsed file; returns the whole game data, sections and entries in the index's order
  function assemble(index, read) {
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
  function split(D) {
    const index = { keys: Object.keys(D), split: {} },
      out = {};
    for (const key of index.keys) {
      const kind = SPLIT[key],
        v = D[key];
      if (!kind) {
        out[`${key}.json`] = v;
        continue;
      }
      const entries = kind === 'array' ? v.map(e => [e && e.id, e]) : Object.entries(v);
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

  return { SPLIT, files, assemble, split, format, text };
})();
