'use strict';
/* ================= STUDIO SELF-TEST (studio track ST-T) =================
   Check → Run the Studio test, or studio/?selftest. A test of the Studio itself, not the game: it opens
   every section (both panes), makes an edit in each that has a field and undoes it, opens the tools, opens everything
   a second time, and times all of it, for the sessions that make the Studio faster (docs/phases/studio-self-test.md).
   About 90 seconds, on a desktop browser or an iPad.
   It loads only when it starts (studio-test-start.js), and reaches the Studio only through what that hands it (G),
   so its only import is the report's rules (game/js/logic/studio-test-report.js).
   While it runs, Save and Propose do nothing and every server call that writes is refused. At the end the data, the
   undo history, the unsaved marks, the open sections and the selection are put back as they were. The report holds
   numbers, section ids and data paths only: no token, no GitHub name (a last row checks it). */
import {
  STUDIO_TEST_FORMAT,
  studioTestChangedPaths,
  studioTestCompare,
  studioTestFilePath,
  studioTestFindings,
  studioTestPrivacyProblems,
  studioTestStats,
} from '../../game/js/logic/studio-test-report.js';

const LAST_KEY = 'studio-test-last';
/* the sections with a 3D view get longer to settle before their frames count (they share one viewport) */
const SETTLE_MS = 300,
  SETTLE_3D_MS = 2000,
  MEASURE_MS = 1000,
  MEASURE_3D_MS = 2000,
  /* the live update and the Check run 500 ms after an edit; this waits for both */
  AFTER_EDIT_MS = 650;
/* the section the second pane opens beside, and the one the leak check rests on: light, with no preview */
const QUIET_SECTION = 'jobs';

const now = () => performance.now();
const r1 = v => Math.round(v * 10) / 10;
const wait = ms => new Promise(res => setTimeout(res, ms));

export async function runStudioTest(G, opts = {}) {
  const S = G.studioState;
  if (G.studioProbe.running) return null;
  G.studioProbe.running = true;
  const t0 = now(),
    errors = [],
    probe = [],
    report = {
      kind: 'studio-test',
      format: STUDIO_TEST_FORMAT,
      build: typeof PB_VERSION === 'string' ? PB_VERSION : '',
      mode: G.githubOn ? 'github' : 'local',
      seconds: 0,
      stopped: false,
      passed: false,
      restored: false,
      device: deviceInfo(G),
      load: loadInfo(),
      sections: [],
      undo: null,
      tools: {},
      leaks: {},
      errors,
      findings: [],
      privacy: [],
    };
  let where = 'start',
    stop = false;
  const ui = progressUI(() => (stop = true));
  const step = (label, i, n) => {
    where = label;
    ui.set(label, i, n);
  };
  const fail = (w, e) => errors.push({ where: w, msg: String((e && e.message) || e).slice(0, 300) });

  /* ---- what is put back at the end ---- */
  const keep = {
    snap: G.snapshot(),
    undo: S.undo.slice(),
    redo: S.redo.slice(),
    last: S.last && new Map(S.last) /* undo and redo change it in place */,
    dirty: S.dirty,
    rigsDirty: S.rigsDirty,
    artDirty: new Map(S.artDirty),
    sel: cloneSel(S.sel),
    sec: S.sec,
    sec2: S.sec2,
    hash: location.hash,
  };
  /* ---- the guards: nothing is written, every error is caught ---- */
  const api0 = G.api,
    save0 = G.saveAll,
    calls = { n: 0, ms: 0 };
  G.setApi(async (path, o = {}) => {
    if (o.method && o.method !== 'GET') throw new Error('The Studio test is running: nothing is written');
    const a = now();
    try {
      return await api0(path, o);
    } finally {
      calls.n++;
      calls.ms += now() - a;
    }
  });
  G.setSaveAll(async () => G.toast('The Studio test is running: nothing is saved.'));
  const onError = ev => fail(where, ev.error || ev.message);
  const onRejection = ev => fail(where, ev.reason);
  addEventListener('error', onError);
  addEventListener('unhandledrejection', onRejection);
  const err0 = console.error;
  console.error = (...a) => {
    fail(where, a.map(x => (x && x.message) || String(x)).join(' '));
    err0.apply(console, a);
  };
  /* ---- what is watched: the animation loops, the timers, long tasks, the probe ---- */
  const watch = watchFrames();
  const timers = watchTimers();
  const longTasks = [];
  let lto = null;
  try {
    lto = new PerformanceObserver(l => l.getEntries().forEach(e => longTasks.push([e.startTime, e.duration])));
    lto.observe({ type: 'longtask' });
  } catch (e) {
    lto = null; /* Safari has no long tasks */
  }
  G.studioProbe.on = (kind, d) => probe.push({ kind, t: now(), ...d });
  const probeSince = (kind, t) => probe.filter(p => p.kind === kind && p.t >= t);

  try {
    const keys = G.SECTION_LIST.map(n => n[0]).filter(k => G.SECTIONS[k]);
    const total = keys.length * 2 + 9; /* first pass, second pane, eight tools, second pass */
    let i = 0;
    /* the leak check's starting point: the quiet section, its loops and memory */
    G.openSection(QUIET_SECTION);
    await frames(2);
    await wait(400);
    const base = {
      loops: watch.names(400),
      tasks: [...G.frameScheduler.tasks.keys()],
      heap: heapMB(),
      nodes: nodeCount(),
      timers: timers.live(),
    };

    /* ---- 1. every section in the first pane: open, frames, connections, an edit ---- */
    for (const k of keys) {
      if (stop) break;
      step(`Opening ${k}`, i++, total);
      const row = { id: k };
      report.sections.push(row);
      const big = !!G.PANE2_REFUSED[k];
      try {
        const a = now();
        G.openSection(k);
        const b = now();
        void document.body.offsetHeight; /* the layout, which the browser would otherwise do at the next frame */
        const c = now();
        await frames(2);
        const rd = probeSince('render', a).filter(p => p.pane === 'main');
        const sum = f => r1(rd.reduce((n, p) => n + p[f], 0));
        row.open = {
          ms: r1(c - a),
          html: sum('html'),
          dom: sum('dom'),
          after: sum('after'),
          previews: sum('previews'),
          layout: r1(c - b),
          shown: r1(now() - a),
        };
        row.nodes = nodeCount();
        await wait(big ? SETTLE_3D_MS : SETTLE_MS);
        const calls0 = calls.n;
        const f = await measure(G, watch, big ? MEASURE_3D_MS : MEASURE_MS);
        Object.assign(row, f);
        row.longTasks = longIn(longTasks, a, now());
        row.api = calls.n - calls0;
        row.conn = timeIt(() => G.connectionsHTML());
        row.outside = await outsideEdit(G);
        if (stop) break;
        step(`An edit in ${k}`, i, total);
        row.edit = await editOnce(G, k, probeSince);
      } catch (e) {
        fail(k, e);
      }
    }
    /* ---- 2. the second pane ---- */
    if (!stop) {
      step('The second pane', i++, total);
      G.openSection(QUIET_SECTION);
      await frames(1);
      for (const row of report.sections) {
        if (stop) break;
        if (G.PANE2_REFUSED[row.id] || row.id === QUIET_SECTION) continue;
        try {
          const a = now();
          G.ACTIONS.openBeside({ s: row.id });
          void document.body.offsetHeight;
          row.beside = r1(now() - a);
          await frames(1);
        } catch (e) {
          fail(row.id + ' beside', e);
        }
      }
      if (G.ACTIONS.paneClose) G.ACTIONS.paneClose();
    }
    /* ---- 3. the tools ---- */
    if (!stop) {
      step('Tools: Find, the Check, Save and Propose', i++, total);
      await tools(
        G,
        report.tools,
        fail,
        () => stop,
        n => step(`Tools: ${n}`, i++, total)
      );
    }
    /* ---- 4. everything a second time, then the quiet section again: what is still there ---- */
    if (!stop) {
      for (const row of report.sections) {
        if (stop) break;
        step(`Opening ${row.id} again`, i++, total);
        try {
          const a = now();
          G.openSection(row.id);
          void document.body.offsetHeight;
          row.again = r1(now() - a);
          await frames(2);
        } catch (e) {
          fail(row.id + ' again', e);
        }
      }
      G.openSection(QUIET_SECTION);
      await frames(2);
      await wait(400);
      const loops = watch.names(400).filter(n => !base.loops.includes(n)),
        tasks = [...G.frameScheduler.tasks.keys()].filter(n => !base.tasks.includes(n)).map(n => 'task ' + n);
      const h = heapMB();
      report.leaks = {
        heapMB: base.heap != null && h != null ? [base.heap, h] : null,
        nodes: [base.nodes, nodeCount()],
        loops: loops.concat(tasks),
        intervals: [base.timers, timers.live()],
      };
    }
    /* ---- the undo, measured (Studio plan T1.2): the data it holds once (`last`), and the step each of the test's
       edits added (each is undone straight away, so they are added up here as if all were kept). Bytes as the
       browser stores the texts: 1 a character unless one is past U+00FF ---- */
    const commits = probe.filter(p => p.kind === 'commit');
    const snapMB = commits.length ? r1(commits[commits.length - 1].chars / 1e6) : r1(keep.snap.length / 1e6);
    const edited = report.sections.filter(s => s.edit && s.edit.stepBytes != null),
      lastMB = G.historyPartsBytes(S.last, true) / 1e6,
      stepsMB = edited.reduce((n, s) => n + s.edit.stepBytes, 0) / 1e6;
    report.undo = {
      max: G.HISTORY_STEPS,
      snapMB,
      lastMB: r1(lastMB),
      edits: edited.length,
      stepsMB: r1(stepsMB),
      fullMB: r1(lastMB + stepsMB),
      stepsBefore: keep.undo.length,
      beforeMB: r1(keep.undo.reduce((n, s) => n + G.historyBytes(s), 0) / 1e6),
    };
  } catch (e) {
    fail(where, e);
  } finally {
    report.stopped = stop;
    /* ---- everything back as it was ---- */
    G.studioProbe.on = null;
    watch.off();
    timers.off();
    if (lto) lto.disconnect();
    removeEventListener('error', onError);
    removeEventListener('unhandledrejection', onRejection);
    console.error = err0;
    try {
      if (G.snapshot() !== keep.snap) G.restore(keep.snap);
      S.undo = keep.undo;
      S.redo = keep.redo;
      S.last = keep.last;
      S.dirty = keep.dirty;
      S.rigsDirty = keep.rigsDirty;
      S.artDirty = keep.artDirty;
      S.sel = keep.sel;
      if (G.ACTIONS.paneClose) G.ACTIONS.paneClose();
      G.openSection(keep.sec);
      if (keep.sec2 && G.ACTIONS.openBeside) G.ACTIONS.openBeside({ s: keep.sec2 });
      history.replaceState(null, '', keep.hash || '#' + keep.sec);
      G.updateTopBar();
      G.studioBroadcast();
      report.restored = G.snapshot() === keep.snap;
    } catch (e) {
      fail('putting things back', e);
    }
    G.setApi(api0);
    G.setSaveAll(save0);
    G.studioProbe.running = false;
    ui.close();
  }
  report.seconds = r1((now() - t0) / 1000);
  report.passed =
    !errors.length &&
    report.restored &&
    !stop &&
    report.sections.every(s => (!s.edit || s.edit.back !== false) && !(s.outside && s.outside.length));
  report.findings = studioTestFindings(report);
  report.privacy = studioTestPrivacyProblems(JSON.stringify(report), opts.planted || []);
  if (report.privacy.length) report.passed = false;
  let before = null;
  try {
    before = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
  } catch (e) {
    before = null;
  }
  const changes = studioTestCompare(before, report);
  try {
    if (!report.stopped) localStorage.setItem(LAST_KEY, JSON.stringify(report));
  } catch (e) {
    /* a full or blocked storage keeps no last run */
  }
  G.studioProbe.last = report;
  if (!opts.quiet) showReport(G, report, changes, before);
  return report;
}

/* ---------- Studio plan T1.5: what opening a section wrote to the data without an edit ----------
   Once the section has settled and no commit is pending, the data must be the last undo state. A difference would
   ride along with the next edit, and that edit's undo would take it back too (F14). The paths that differ are
   reported, then committed, so each cause is named once. */
async function outsideEdit(G) {
  const S = G.studioState;
  for (let i = 0; i < 20 && S.snapT != null; i++) await wait(100);
  const now = G.snapshotParts();
  if (S.last == null || !G.historyDiff(S.last, now)) return [];
  const paths = studioTestChangedPaths(G.historyPartsData(S.last), G.historyPartsData(now));
  G.commit(true);
  return paths;
}

/* ---------- one edit, through the Studio's own field code, then undo, redo, undo ---------- */
async function editOnce(G, k, probeSince) {
  const pane = document.getElementById('main');
  const el =
    [...pane.querySelectorAll('input[type=number][data-p]')].find(
      e => e.value !== '' && !e.disabled && e.offsetParent
    ) ||
    [...pane.querySelectorAll('input[type=text][data-p]')].find(
      e => !e.disabled && e.offsetParent && !e.classList.contains('hex')
    );
  if (!el) return null;
  const before = G.snapshot(),
    path = el.dataset.p;
  if (el.type === 'number') {
    const v = +el.value,
      st = +el.step || 1,
      up = el.max === '' || v + st <= +el.max;
    el.value = String(up ? v + st : v - st);
  } else el.value = el.value + ' x';
  const a = now();
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  const ms = now() - a;
  const com = probeSince('commit', a).pop();
  await wait(AFTER_EDIT_MS);
  /* the bytes of the undo step the edit added (its commit may be the debounced one, after the wait) */
  const stepBytes = probeSince('commit', a).reduce((n, c) => n + (c.bytes || 0), 0);
  const chk = probeSince('check', a).pop(),
    send = probeSince('send', a).pop();
  const u0 = now();
  G.undo();
  const u1 = now();
  G.redo();
  const u2 = now();
  G.undo();
  await frames(1);
  return {
    path: path.replace(/[^\w.@-]/g, ''),
    ms: r1(ms),
    snapMs: com ? r1(com.snapMs) : null,
    snapMB: com ? r1(com.chars / 1e6) : null,
    stepBytes,
    checkMs: chk ? r1(chk.ms) : null,
    sendMs: send ? r1(send.ms) : null,
    undoMs: r1(u1 - u0),
    redoMs: r1(u2 - u1),
    back: G.snapshot() === before,
  };
}

/* ---------- the tools ---------- */
async function tools(G, T, fail, stopped, step) {
  const S = G.studioState,
    D = S.D;
  const run = async (name, f) => {
    if (stopped()) return;
    step(name);
    try {
      await f();
    } catch (e) {
      fail(name, e);
    }
  };
  await run('find', () => {
    const a = now(),
      idx = G.buildSearchIndex(),
      b = now();
    G.findRun('copperleaf');
    T.find = { buildMs: r1(b - a), entries: idx.length, queryMs: r1(now() - b) };
  });
  await run('check', () => {
    const a = now(),
      P = G.runCheck();
    T.check = { ms: r1(now() - a), problems: P.length };
  });
  await run('save', () => {
    const a = now(),
      s = JSON.stringify(D, (key, v) => (key[0] === '_' && key.length > 1 ? undefined : v));
    T.save = { ms: r1(now() - a), mb: r1(s.length / 1e6) };
  });
  await run('propose', () => {
    if (typeof PB_DATA === 'undefined') return;
    const a = now(),
      { index, files } = PB_DATA.split(D);
    let n = 1,
      chars = PB_DATA.text(index).length;
    for (const v of Object.values(files)) {
      chars += PB_DATA.text(v).length;
      n++;
    }
    T.propose = { ms: r1(now() - a), files: n, mb: r1(chars / 1e6) };
  });
  await run('mapgen', () => {
    const a = now();
    G.mapgenScene(G.mapgenParams({ seed: 20261021 }), { scenery: G.sceneryCatalog(), biomes: D.biomes || {} });
    T.mapgen = { ms: r1(now() - a) };
  });
  await run('slice', () => {
    const img = testSheet(512, 512),
      a = now(),
      L = G.sheetIslands(img, { gap: 1, conn: 8 });
    T.slice = { ms: r1(now() - a), pieces: L.length };
  });
  const sp = D.lines && D.lines[0] ? D.lines[0].id + '0' : null;
  if (sp) {
    await run('pixel', async () => {
      const a = now();
      await G.openPixelEditor(sp, 'front');
      await until(() => document.querySelector('.pxed #pxCv'), 8000);
      await frames(2);
      T.pixel = { ms: r1(now() - a) };
      const x = document.querySelector('.pxed [data-pe=close]');
      if (x) x.click();
      await frames(1);
    });
    await run('skeleton', async () => {
      const a = now();
      await G.openSkeleton(sp, 'front');
      await until(() => document.querySelector('.pxed.skel'), 8000);
      await frames(2);
      T.skeleton = { ms: r1(now() - a) };
      const x = document.querySelector('.pxed.skel [data-sk=close]');
      if (x) x.click();
      await frames(1);
    });
  }
}
/* a made-up sheet: 64 coloured squares on a clear ground, the same every run */
function testSheet(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let gy = 0; gy < 8; gy++)
    for (let gx = 0; gx < 8; gx++)
      for (let y = gy * 64 + 8; y < gy * 64 + 56; y++)
        for (let x = gx * 64 + 8; x < gx * 64 + 56; x++) {
          const i = (y * w + x) * 4;
          data[i] = gx * 30;
          data[i + 1] = gy * 30;
          data[i + 2] = 120;
          data[i + 3] = 255;
        }
  return { width: w, height: h, data };
}

/* ---------- frames ---------- */
/* every animation-frame callback is timed by its function's name, so a loop shows up wherever it runs */
function watchFrames() {
  const raf0 = window.requestAnimationFrame;
  /** @type {Map<string, {ms: number, n: number, at: number}>} */
  const by = new Map();
  window.requestAnimationFrame = function (cb) {
    return raf0.call(window, ts => {
      const a = now();
      try {
        cb(ts);
      } finally {
        const k = cb.name || 'anonymous',
          e = by.get(k) || { ms: 0, n: 0, at: 0 };
        e.ms += now() - a;
        e.n++;
        e.at = now();
        by.set(k, e);
      }
    });
  };
  return {
    raf0,
    by,
    /* the loops that ran in the last `ms` */
    names: ms =>
      [...by]
        .filter(([, e]) => now() - e.at <= ms)
        .map(([k]) => k)
        .sort(),
    off: () => {
      window.requestAnimationFrame = raf0;
    },
  };
}
const frames = n =>
  new Promise(res => {
    const go = () => (n-- <= 0 ? res() : requestAnimationFrame(go));
    go();
  });
/* about `ms` of frames: their times, the loops and frame tasks that ran and what they cost, the graphics calls */
async function measure(G, watch, ms) {
  const deltas = [],
    snap0 = new Map([...watch.by].map(([k, e]) => [k, { ...e }]));
  const tasks = new Map(),
    wrapped = [];
  for (const [name, t] of G.frameScheduler.tasks) {
    const fn = t.fn;
    t.fn = (...a) => {
      const s = now();
      try {
        return fn(...a);
      } finally {
        const e = tasks.get(name) || { ms: 0, n: 0 };
        e.ms += now() - s;
        e.n++;
        tasks.set(name, e);
      }
    };
    wrapped.push([t, fn]);
  }
  let gpu = null;
  try {
    G.gpuCountBegin();
  } catch (e) {
    /* no counters */
  }
  const end = now() + ms;
  let last = 0;
  await new Promise(res => {
    const go = ts => {
      if (last) deltas.push(ts - last);
      last = ts;
      if (now() >= end) res();
      else watch.raf0.call(window, go);
    };
    watch.raf0.call(window, go);
  });
  try {
    gpu = G.gpuCountEnd();
  } catch (e) {
    gpu = null;
  }
  for (const [t, fn] of wrapped) t.fn = fn;
  const loops = [],
    loopMs = {};
  for (const [k, e] of watch.by) {
    const e0 = snap0.get(k) || { ms: 0, n: 0 };
    if (e.n > e0.n) {
      loops.push(k);
      loopMs[k] = r1((e.ms - e0.ms) / (e.n - e0.n));
    }
  }
  const out = {
    frames: studioTestStats(deltas),
    loops: loops.sort(),
    loopMs,
    tasks: Object.fromEntries([...tasks].map(([k, e]) => [k, r1(e.ms / e.n)])),
    gpu:
      gpu && gpu.frames
        ? {
            draws: gpu.dc[0],
            instances: gpu.dc[1],
            programs: gpu.dc[2],
            textures: gpu.dc[3],
            uploadKB: gpu.up,
            passes: gpu.dcp,
            frames: gpu.frames,
          }
        : null,
  };
  const gs = G.gpuState;
  if (gs && gs.gl && gs.gpuMs) out.gpuMs = r1(gs.gpuMs);
  return out;
}

/* ---------- timers left running ---------- */
function watchTimers() {
  const si = window.setInterval,
    ci = window.clearInterval,
    live = new Set();
  window.setInterval = function (...a) {
    const id = si.apply(window, a);
    live.add(id);
    return id;
  };
  window.clearInterval = function (id) {
    live.delete(id);
    return ci.call(window, id);
  };
  return {
    live: () => live.size,
    off: () => {
      window.setInterval = si;
      window.clearInterval = ci;
    },
  };
}

/* ---------- small helpers ---------- */
function timeIt(f) {
  const a = now();
  try {
    f();
  } catch (e) {
    return null;
  }
  return r1(now() - a);
}
async function until(f, ms) {
  const end = now() + ms;
  while (!f()) {
    if (now() > end) throw new Error('timed out');
    await wait(50);
  }
}
function longIn(L, a, b) {
  const x = L.filter(([s]) => s >= a && s <= b);
  return { n: x.length, ms: r1(x.reduce((n, [, d]) => n + d, 0)) };
}
const nodeCount = () => document.getElementsByTagName('*').length;
function heapMB() {
  const m = performance.memory;
  return m && m.usedJSHeapSize ? r1(m.usedJSHeapSize / 1048576) : null;
}
function cloneSel(sel) {
  try {
    return structuredClone(sel);
  } catch (e) {
    return Object.assign({}, sel);
  }
}
function deviceInfo(G) {
  const d = {
    screen: [screen.width, screen.height],
    window: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    cores: navigator.hardwareConcurrency || null,
    memoryGB: navigator.deviceMemory || null,
    gpu: null,
    timers: false,
  };
  try {
    const gl = G.gpuState && G.gpuState.gl;
    if (gl) {
      const x = gl.getExtension('WEBGL_debug_renderer_info');
      d.gpu = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).slice(0, 120);
      d.timers = !!gl.getExtension('EXT_disjoint_timer_query_webgl2');
    }
  } catch (e) {
    /* no graphics chip details */
  }
  return d;
}
/* loading: the marks boot and the GitHub read leave, and the browser's resource timing (files cut to their paths) */
function loadInfo() {
  const mark = n => {
      const e = performance.getEntriesByName(n, 'mark')[0];
      return e ? e.startTime : null;
    },
    span = (a, b) => (mark(a) != null && mark(b) != null ? r1(mark(b) - mark(a)) : null);
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const kind = p =>
    /\.js$/.test(p)
      ? 'scripts'
      : /\.json$/.test(p) || p.startsWith('game/data/')
        ? 'data'
        : /\.(png|webp|jpe?g|gif)$/.test(p)
          ? 'art'
          : 'other';
  const groups = {};
  const rows = res.map(e => {
    const p = studioTestFilePath(e.name),
      kb = (e.transferSize || e.encodedBodySize || 0) / 1024;
    const g = (groups[kind(p)] = groups[kind(p)] || { n: 0, kb: 0, ms: 0 });
    g.n++;
    g.kb += kb;
    g.ms = Math.max(g.ms, e.responseEnd);
    return { file: p, ms: r1(e.duration), kb: r1(kb) };
  });
  for (const g of Object.values(groups)) {
    g.kb = Math.round(g.kb);
    g.ms = Math.round(g.ms);
  }
  return {
    pageMs: nav ? r1(nav.domContentLoadedEventEnd) : null,
    loadMs: nav ? r1(nav.loadEventEnd) : null,
    dataMs: span('studio-boot', 'studio-data-loaded'),
    readMs: span('studio-boot', 'studio-data-read'),
    assembleMs: span('studio-data-read', 'studio-data-assembled'),
    firstDrawMs: span('studio-data-loaded', 'studio-first-draw'),
    ...groups,
    resources: res.length,
    slowest: rows.sort((a, b) => b.ms - a.ms).slice(0, 10),
  };
}

/* ---------- on screen ---------- */
function progressUI(onStop) {
  const el = document.createElement('div');
  el.id = 'stTest';
  el.className = 'st-run';
  el.innerHTML = `<b>Studio test</b><span class="st-what">Starting…</span><progress max="1" value="0"></progress><button class="btn sm" data-st="stop">Stop</button>`;
  document.body.appendChild(el);
  el.querySelector('[data-st=stop]').onclick = onStop;
  const kd = e => {
    if (e.key === 'Escape') onStop();
  };
  addEventListener('keydown', kd);
  return {
    set: (t, i, n) => {
      el.querySelector('.st-what').textContent = t;
      const p = el.querySelector('progress');
      p.max = n;
      p.value = i;
    },
    close: () => {
      removeEventListener('keydown', kd);
      el.remove();
    },
  };
}
function showReport(G, r, changes, before) {
  const esc = G.escapeHtml,
    ms = v => (v == null ? '' : Math.round(v)),
    m = document.getElementById('modal');
  const head = r.passed
    ? `<p class="st-ok">Passed in ${r.seconds} s: no errors, every edit came back with its undo, and everything is back as it was.</p>`
    : `<p class="st-bad">${r.stopped ? 'Stopped.' : 'Not passed.'} ${r.errors.length} errors${r.restored ? '' : '; the data did not come back exactly (reload the Studio without saving)'}${r.privacy.length ? '; the report holds ' + esc(r.privacy.join(', ')) : ''}.</p>`;
  const find = r.findings.length
    ? `<ol class="st-find">${r.findings.map(f => `<li class="${f.lvl}"><b>${esc(f.area)}</b> ${esc(f.text)}</li>`).join('')}</ol>`
    : '<p class="help">Nothing past its limit.</p>';
  const rows = r.sections
    .slice()
    .sort((a, b) => ((b.open && b.open.ms) || 0) - ((a.open && a.open.ms) || 0))
    .map(
      s =>
        `<tr><td>${esc(s.id)}</td><td>${ms(s.open && s.open.ms)}</td><td>${ms(s.open && s.open.html)}</td><td>${ms(s.open && s.open.dom)}</td><td>${ms(s.open && s.open.after)}</td><td>${ms(s.beside)}</td><td>${ms(s.again)}</td><td>${s.frames ? ms(s.frames.p50) + ' / ' + ms(s.frames.p95) : ''}</td><td>${s.gpu ? s.gpu.draws : ''}</td><td>${s.nodes || ''}</td><td>${ms(s.conn)}</td><td>${s.edit ? ms(s.edit.ms) + ' / ' + ms(s.edit.undoMs) : ''}</td></tr>`
    )
    .join('');
  const T = r.tools,
    tool = (n, v) =>
      v
        ? `<tr><td>${n}</td><td>${esc(
            Object.entries(v)
              .map(([k, x]) => `${k} ${x}`)
              .join(', ')
          )}</td></tr>`
        : '';
  const cmp = before
    ? changes.length
      ? `<table class="tbl"><thead><tr><th>What</th><th>Before</th><th>Now</th><th></th></tr></thead><tbody>${changes
          .slice(0, 30)
          .map(
            c =>
              `<tr class="${c.worse ? 'worse' : 'better'}"><td>${esc(c.key)}</td><td>${c.before}</td><td>${c.after}</td><td>${c.change == null ? '' : (c.change > 0 ? '+' : '') + c.change + ' %'}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="help">Nothing moved by more than 20 % since the last run.</p>'
    : '<p class="help">The first run in this browser: the next one shows what changed.</p>';
  m.innerHTML = `<div class="scrim"><div class="dlg st-report" role="dialog" aria-modal="true" aria-label="Studio test"><h2>Studio test</h2><div class="dlg-body">${head}
<h3>Look here first</h3>${find}
<h3>Since the last run</h3>${cmp}
<h3>Sections (ms; frames p50 / p95; edit / undo)</h3><div class="st-scroll"><table class="tbl"><thead><tr><th>Section</th><th>Open</th><th>HTML</th><th>Page</th><th>After</th><th>Beside</th><th>Again</th><th>Frames</th><th>Draws</th><th>Elements</th><th>Links</th><th>Edit</th></tr></thead><tbody>${rows}</tbody></table></div>
<h3>Tools, undo and loading</h3><table class="tbl"><tbody>${tool('Find', T.find)}${tool('Check', T.check)}${tool('Save (built)', T.save)}${tool('Propose (built)', T.propose)}${tool('Map generator', T.mapgen)}${tool('Sheet slicing', T.slice)}${tool('Pixel editor', T.pixel)}${tool('Skeleton builder', T.skeleton)}${tool('Undo', r.undo)}${tool('Loading', { dataMs: r.load.dataMs, readMs: r.load.readMs, assembleMs: r.load.assembleMs, firstDrawMs: r.load.firstDrawMs, resources: r.load.resources })}</tbody></table>
${r.errors.length ? `<h3>Errors</h3><ul>${r.errors.map(e => `<li><b>${esc(e.where)}</b> ${esc(e.msg)}</li>`).join('')}</ul>` : ''}
</div><div class="dlg-btns"><button class="btn" data-st="copy">Copy</button><button class="btn" data-st="save">Download the report</button><button class="btn primary" data-st="close">Close</button></div></div></div>`;
  const json = JSON.stringify(r, null, 1);
  m.querySelector('[data-st=close]').onclick = () => (m.innerHTML = '');
  m.querySelector('[data-st=copy]').onclick = () =>
    navigator.clipboard.writeText(json).then(
      () => G.toast('Copied.', 'ok'),
      () => G.toast('Couldn’t copy.', 'err')
    );
  m.querySelector('[data-st=save]').onclick = () => {
    const a = document.createElement('a'),
      d = new Date(),
      p = n => String(n).padStart(2, '0');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `pocket-billies-studio-test-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
}
