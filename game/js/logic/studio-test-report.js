// @ts-check
'use strict';
/* ================= STUDIO SELF-TEST REPORT (studio track ST-T) =================
   The Studio self-test's rules, as numbers in and words out: a set of times as p50/p95/worst, the "Look here first"
   list made from a report, the change from an earlier run, a resource's address cut down to its file path, and the
   check that a report holds no token and no planted name. Logic only: no DOM, runs in Node
   (tools/test/studio-test-report.test.mjs). studio/js/studio-test.js makes the report; docs/phases/studio-self-test.md
   says what is in it. On no page: the test imports it when it starts. */

/** the report format: a change to its shape adds one, and the comparison only compares the same format (2: the
    undo's size is measured, Studio plan T1.2) */
export const STUDIO_TEST_FORMAT = 2;

/** where a number starts to matter (mid) and where it is the first thing to fix (high) */
export const STUDIO_TEST_LIMITS = {
  openMs: [150, 500] /* opening a section */,
  besideMs: [150, 500] /* opening it in the second pane */,
  frameP95: [33, 66] /* a frame, at the 95th percentile, while the section is open */,
  editMs: [100, 300] /* one edit, from the field to the undo step */,
  snapMs: [50, 200] /* the undo's copy of the data, per edit */,
  undoMs: [150, 500] /* undo or redo */,
  undoMB: [100, 400] /* what the undo holds after the test's edits */,
  checkMs: [50, 200] /* the Check, which runs after every edit */,
  sendMs: [20, 100] /* the live update to a game tab, per edit */,
  connMs: [100, 400] /* the Connections drawer's work for a section */,
  findMs: [100, 400] /* Find's index, rebuilt after every edit */,
  toolMs: [300, 1000] /* opening a tool, generating a map, slicing a sheet */,
  saveMs: [300, 1000] /* building what Save or Propose writes */,
  longMs: [200, 1000] /* long tasks while a section is open, in all */,
  heapGrowMB: [50, 200] /* memory kept after every section was opened twice */,
  nodesGrow: [0.3, 1] /* page elements kept after every section was opened twice, as a share */,
  dataMs: [3000, 10000] /* loading the game data */,
};

const LEVELS = { high: 0, mid: 1, low: 2 };
const round1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;

/** a list of times as numbers that compare: count, average, p50, p95 and worst (each to 0.1) */
export function studioTestStats(/** @type {number[]} */ values) {
  const v = values.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  const at = (/** @type {number} */ q) => v[Math.min(v.length - 1, Math.floor(q * v.length))];
  return {
    n: v.length,
    avg: round1(v.reduce((a, b) => a + b, 0) / v.length),
    p50: round1(at(0.5)),
    p95: round1(at(0.95)),
    max: round1(v[v.length - 1]),
  };
}

/** high, mid or nothing for a number against its limits */
function level(/** @type {number | null | undefined} */ v, /** @type {number[]} */ [mid, high]) {
  if (v == null || !Number.isFinite(v)) return null;
  return v >= high ? 'high' : v >= mid ? 'mid' : null;
}
const ms = (/** @type {number} */ v) => `${Math.round(v)} ms`;
const mb = (/** @type {number} */ v) => `${round1(v)} MB`;

/**
 * The "Look here first" list: one row per number past its limit, the worst first (high before mid, then by how far
 * past its limit it is). Each row: lvl, area (a section id or a tool), text in plain words, and `over` (the number
 * divided by its mid limit, for the order).
 * @param {any} r a report from studio/js/studio-test.js
 */
export function studioTestFindings(r) {
  /** @type {{ lvl: string, area: string, text: string, over: number }[]} */
  const out = [];
  const L = STUDIO_TEST_LIMITS;
  const add = (
    /** @type {string} */ area,
    /** @type {number | null | undefined} */ v,
    /** @type {number[]} */ lim,
    /** @type {string} */ text
  ) => {
    const lvl = level(v, lim);
    if (lvl) out.push({ lvl, area, text, over: /** @type {number} */ (v) / lim[0] });
  };
  for (const e of r.errors || [])
    out.push({ lvl: 'high', area: e.where || 'studio', text: `An error: ${e.msg}`, over: 1e9 });
  for (const s of r.sections || []) {
    if (s.edit && s.edit.back === false)
      out.push({ lvl: 'high', area: s.id, text: 'An edit and its undo did not bring the data back', over: 1e9 });
    if (s.outside && s.outside.length)
      out.push({
        lvl: 'high',
        area: s.id,
        text: `Opening ${s.id} changed the data outside an edit: ${s.outside.join(', ')}`,
        over: 1e9,
      });
    if (s.open) {
      const o = s.open,
        parts = [
          ['building the HTML', o.html],
          ['putting it on the page', o.dom],
          ['the after-draw steps', o.after],
          ['the previews', o.previews],
        ]
          .filter(p => p[1] >= 1)
          .sort((a, b) => b[1] - a[1])
          .map(p => `${p[0]} ${ms(p[1])}`);
      add(s.id, o.ms, L.openMs, `Opens in ${ms(o.ms)}${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }
    add(s.id, s.beside, L.besideMs, `Opens in the second pane in ${ms(s.beside)}`);
    if (s.frames && s.frames.n >= 10)
      add(
        s.id,
        s.frames.p95,
        L.frameP95,
        `Frames are slow while it is open: p95 ${ms(s.frames.p95)}, worst ${ms(s.frames.max)}${s.loops && s.loops.length ? ` (loops: ${s.loops.join(', ')})` : ''}`
      );
    if (s.longTasks) add(s.id, s.longTasks.ms, L.longMs, `${s.longTasks.n} long tasks, ${ms(s.longTasks.ms)} in all`);
    add(s.id, s.conn, L.connMs, `The Connections drawer takes ${ms(s.conn)} to work out`);
    if (s.edit) {
      const e = s.edit;
      add(s.id, e.ms, L.editMs, `One edit takes ${ms(e.ms)} (the undo copy ${ms(e.snapMs || 0)})`);
      add(s.id, Math.max(e.undoMs || 0, e.redoMs || 0), L.undoMs, `Undo takes ${ms(e.undoMs)}, redo ${ms(e.redoMs)}`);
    }
  }
  /* the costs every edit pays, wherever it is made: reported once, from the slowest edit */
  const edits = (r.sections || []).map((/** @type {any} */ s) => s.edit).filter(Boolean);
  const worst = (/** @type {string} */ k) => Math.max(0, ...edits.map((/** @type {any} */ e) => e[k] || 0));
  if (edits.length) {
    add(
      'every edit',
      worst('snapMs'),
      L.snapMs,
      `Every edit turns all the game data into text for the undo (${mb(worst('snapMB'))}) in up to ${ms(worst('snapMs'))}`
    );
    add('every edit', worst('checkMs'), L.checkMs, `The Check runs after every edit and takes ${ms(worst('checkMs'))}`);
    add(
      'every edit',
      worst('sendMs'),
      L.sendMs,
      `The live update to a game tab takes up to ${ms(worst('sendMs'))} per edit`
    );
  }
  if (r.undo)
    add(
      'undo',
      r.undo.fullMB,
      L.undoMB,
      `The undo holds ${mb(r.undo.fullMB)} after the test’s ${r.undo.edits} edits: the data once (${mb(r.undo.lastMB)}) and what each edit changed (${mb(r.undo.stepsMB)})`
    );
  const T = r.tools || {};
  if (T.find)
    add(
      'find',
      T.find.buildMs,
      L.findMs,
      `Find rebuilds its index (${T.find.entries} entries) in ${ms(T.find.buildMs)} after every edit`
    );
  for (const [k, name] of [
    ['pixel', 'The pixel editor opens'],
    ['skeleton', 'The skeleton builder opens'],
    ['mapgen', 'Generating a map takes'],
    ['slice', 'Slicing a sheet takes'],
  ])
    if (T[k]) add(k, T[k].ms, L.toolMs, `${name} in ${ms(T[k].ms)}`);
  if (T.check) add('check', T.check.ms, L.checkMs, `The Check takes ${ms(T.check.ms)} (${T.check.problems} findings)`);
  if (T.save) add('save', T.save.ms, L.saveMs, `Save builds ${mb(T.save.mb)} in ${ms(T.save.ms)}`);
  if (T.propose)
    add('propose', T.propose.ms, L.saveMs, `Propose builds ${T.propose.files} files in ${ms(T.propose.ms)}`);
  const K = r.leaks || {};
  for (const loop of K.loops || [])
    out.push({
      lvl: 'mid',
      area: 'leaks',
      text: `The animation loop ${loop} kept running after its section was left`,
      over: 1.5,
    });
  if (K.heapMB && K.heapMB.length === 2)
    add(
      'leaks',
      K.heapMB[1] - K.heapMB[0],
      L.heapGrowMB,
      `Memory grew by ${mb(K.heapMB[1] - K.heapMB[0])} on the second pass`
    );
  if (K.nodes && K.nodes[0] > 0)
    add(
      'leaks',
      (K.nodes[1] - K.nodes[0]) / K.nodes[0],
      L.nodesGrow,
      `The page kept ${K.nodes[1] - K.nodes[0]} more elements on the second pass`
    );
  if (K.intervals && K.intervals[1] > K.intervals[0])
    out.push({
      lvl: 'mid',
      area: 'leaks',
      text: `${K.intervals[1] - K.intervals[0]} timers kept running after their section was left`,
      over: 1.2,
    });
  if (r.load)
    add(
      'loading',
      r.load.dataMs,
      L.dataMs,
      `Loading the game data took ${ms(r.load.dataMs)} (${r.load.data ? r.load.data.n : '?'} files)`
    );
  return out.sort(
    (a, b) => LEVELS[/** @type {'high'} */ (a.lvl)] - LEVELS[/** @type {'high'} */ (b.lvl)] || b.over - a.over
  );
}

/**
 * Studio plan T1.5: where two copies of the data differ, as paths three levels deep (`D.people.boy`), sorted, at most
 * `max`. The self-test compares the data after a section opened with the last undo state: a section that writes to
 * the data without an edit makes the next edit's undo take that write back too.
 */
export function studioTestChangedPaths(/** @type {any} */ a, /** @type {any} */ b, max = 8) {
  /** @type {string[]} */
  const out = [];
  const walk = (
    /** @type {any} */ x,
    /** @type {any} */ y,
    /** @type {string} */ path,
    /** @type {number} */ depth
  ) => {
    const ox = x !== null && typeof x === 'object',
      oy = y !== null && typeof y === 'object';
    if (!ox || !oy || depth === 0 || Array.isArray(x) !== Array.isArray(y)) {
      if (JSON.stringify(x) !== JSON.stringify(y)) out.push(path);
      return;
    }
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
    for (const k of keys) walk(x[k], y[k], path ? path + '.' + k : k, depth - 1);
  };
  walk(a, b, '', 3);
  return out.sort().slice(0, max);
}

/** the numbers of a report that compare between runs, by a stable name */
export function studioTestMetrics(/** @type {any} */ r) {
  /** @type {Record<string, number>} */
  const m = {};
  const put = (/** @type {string} */ k, /** @type {any} */ v) => {
    if (typeof v === 'number' && Number.isFinite(v)) m[k] = v;
  };
  for (const s of r.sections || []) {
    put(`${s.id} opens (ms)`, s.open && s.open.ms);
    put(`${s.id} beside (ms)`, s.beside);
    if (s.frames && s.frames.n >= 10) put(`${s.id} frame p95 (ms)`, s.frames.p95);
    put(`${s.id} connections (ms)`, s.conn);
    if (s.edit) {
      put(`${s.id} edit (ms)`, s.edit.ms);
      put(`${s.id} undo (ms)`, s.edit.undoMs);
    }
  }
  if (r.undo) put('undo after the edits (MB)', r.undo.fullMB);
  const T = r.tools || {};
  put('find index (ms)', T.find && T.find.buildMs);
  for (const k of ['pixel', 'skeleton', 'mapgen', 'slice', 'check', 'save', 'propose'])
    put(`${k} (ms)`, T[k] && T[k].ms);
  if (r.load) put('loading the data (ms)', r.load.dataMs);
  put('the whole run (s)', r.seconds);
  return m;
}

/**
 * What changed from an earlier run: every number that moved by at least `share` of its old value and by at least
 * `least` (ms or MB), the biggest moves first. `worse` is true when it went up (every number here is a cost).
 * Reports of another kind or format give nothing.
 */
export function studioTestCompare(/** @type {any} */ before, /** @type {any} */ now, share = 0.2, least = 5) {
  if (!before || !now || before.kind !== now.kind || before.format !== now.format) return [];
  const a = studioTestMetrics(before),
    b = studioTestMetrics(now),
    out = [];
  for (const k of Object.keys(b)) {
    if (!(k in a)) continue;
    const d = b[k] - a[k];
    if (Math.abs(d) < least || Math.abs(d) < share * Math.max(Math.abs(a[k]), 1e-9)) continue;
    out.push({
      key: k,
      before: round1(a[k]),
      after: round1(b[k]),
      change: a[k] ? round1((d / a[k]) * 100) : null,
      worse: d > 0,
    });
  }
  return out.sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before));
}

/**
 * A resource's address as a file path the report may keep: no host, no query, no GitHub owner. The game's and the
 * Studio's files keep their path from game/ or studio/ on; anything else keeps its file name only.
 */
export function studioTestFilePath(/** @type {string} */ url) {
  let p = String(url || '');
  const q = p.search(/[?#]/);
  if (q >= 0) p = p.slice(0, q);
  const c = p.indexOf('/contents/');
  if (c >= 0) p = p.slice(c + '/contents/'.length);
  else p = p.replace(/^[a-z]+:\/\/[^/]*/i, '');
  try {
    p = decodeURIComponent(p);
  } catch (e) {
    /* kept as it is */
  }
  const m = p.match(/(?:^|\/)((?:game|studio)\/.*)$/);
  if (m) return m[1];
  const parts = p.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** what in a report's JSON must not be there: a GitHub token, or one of the planted strings. Empty when clean */
export function studioTestPrivacyProblems(/** @type {string} */ json, /** @type {string[]} */ planted = []) {
  const out = [];
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,})/.test(json)) out.push('a GitHub token');
  for (const s of planted) if (s && json.includes(s)) out.push(`the planted text ${s}`);
  return out;
}
