'use strict';
/* Phase 04b: data/gamedata.js is generated from the data files (tools/build-data.mjs) by `npm run dev`,
   `npm run build` and the quick check. Where nobody generated it (the repository served as it is, e.g. GitHub Pages
   before it deploys the build), this reads the data files themselves, in order, before data.js needs them. Slower
   (one request per file), so it says so in the console and the debug log. */
if (!window.GAMEDATA) {
  const get = path => {
    const x = new XMLHttpRequest();
    x.open('GET', 'data/' + path, false);
    x.send();
    if (x.status !== 200 && x.status !== 0) throw new Error(`data/${path}: ${x.status}`);
    return JSON.parse(x.responseText);
  };
  try {
    const t0 = performance.now();
    window.GAMEDATA = PB_DATA.assemble(get('index.json'), get);
    window.GAMEDATA_FROM_FILES = Math.round(performance.now() - t0);
    const m = `data/gamedata.js is missing: read the data files instead (${window.GAMEDATA_FROM_FILES} ms)`;
    console.warn('[gamedata] ' + m);
    if (typeof NWLOG !== 'undefined') NWLOG.add('data', m);
  } catch (e) {
    console.error('[gamedata] ' + e.message);
  }
}
