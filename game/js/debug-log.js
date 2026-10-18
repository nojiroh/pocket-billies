'use strict';
/* ================= DEBUG LOG =================
   Quietly records what helps fix problems on a particular device: frame rates per screen and scene, slow frames,
   errors, the loading screen's timings, the device and graphics chip, and a small picture of the scene every few
   seconds. Settings → Export debug log saves it as one JSON file (or shares it on phones). Settings → Run the full
   test (self-test.js) plays through everything for about two minutes, stress-tests the device and adds the results.
   Nothing here leaves the device unless the player exports it. No save data, names or step history are included. */
const BUILD_VERSION = PB_VERSION;
/* phase 04d: what the log reads and wraps in the game's modules. debug-log.js runs before them (it catches their errors),
   so js/debug-log-names.js (made by tools/to-module.mjs, the last module of the page) fills this in once they have loaded:
   a getter for each name, and a setter (the module's own setX) for each function the log wraps. Until then it is
   empty, as the names were before the modules ran. */
const GAME = {};
const debugLog = {
  t0: performance.now(),
  ev: [],
  err: [],
  samples: [],
  acc: new Map(),
  secT: 0,
  shot: null,
  shotT: 0,
  load: null,
  bench: null,
  hooked: false,
  max: { ev: 400, err: 120, samples: 900 },
};
debugLog.now = () => Math.round(performance.now() - debugLog.t0);
debugLog.add = (kind, msg, data) => {
  const L = debugLog.ev;
  L.push(Object.assign({ t: debugLog.now(), kind, msg: String(msg).slice(0, 300) }, data || {}));
  if (L.length > debugLog.max.ev) L.splice(0, L.length - debugLog.max.ev);
};
debugLog.error = (kind, msg, stack) => {
  const L = debugLog.err,
    m = String(msg).slice(0, 500),
    last = L[L.length - 1];
  if (last && last.msg === m) {
    last.n = (last.n || 1) + 1;
    return;
  }
  L.push({ t: debugLog.now(), kind, msg: m, stack: stack ? String(stack).slice(0, 1500) : undefined });
  if (L.length > debugLog.max.err) L.splice(0, L.length - debugLog.max.err);
};
addEventListener(
  'error',
  e => {
    debugLog.error(
      'error',
      e.message || (e.target && e.target.src ? 'Failed to load ' + e.target.src : 'error'),
      e.error && e.error.stack
    );
  },
  true
);
addEventListener('unhandledrejection', e => {
  const r = e.reason;
  debugLog.error('promise', (r && r.message) || String(r), r && r.stack);
});
for (const k of ['error', 'warn']) {
  const o = console[k].bind(console);
  console[k] = (...a) => {
    try {
      debugLog.error(
        'console.' + k,
        a
          .map(x => (x && x.message ? x.message : typeof x === 'object' ? JSON.stringify(x).slice(0, 300) : String(x)))
          .join(' '),
        a.find(x => x && x.stack)?.stack
      );
    } catch (e) {}
    o(...a);
  };
}
document.addEventListener('visibilitychange', () => debugLog.add('visibility', document.hidden ? 'hidden' : 'visible'));
addEventListener('resize', () => {
  clearTimeout(debugLog._rz);
  debugLog._rz = setTimeout(() => debugLog.add('resize', `${innerWidth}x${innerHeight}`), 400);
});
/* v33: what the game was busy with. Costly jobs leave a mark (what, when, how long); a slow frame or a long task is
   put down to the marks it overlaps, so the log can say "building the ground: 180 ms" instead of just "slow". */
debugLog.marks = [];
debugLog.causes = {};
debugLog.slow = [];
debugLog.prof = {};
debugLog.mark = (label, t0, t1) => {
  const M = debugLog.marks,
    L = M[M.length - 1];
  if (L && L[2] === label && t0 - L[1] < 3) {
    L[1] = Math.max(L[1], t1);
    return;
  }
  /* runs of small jobs of one kind add up */ if (t1 - t0 < 0.25) return;
  M.push([t0, t1, label]);
  if (M.length > 600) M.splice(0, M.length - 600);
};
debugLog.blame = (t0, t1) => {
  const by = {},
    iv = [];
  for (const [a, b, l] of debugLog.marks) {
    const s = Math.max(a, t0),
      e = Math.min(b, t1);
    if (e > s) {
      by[l] = (by[l] || 0) + e - s;
      iv.push([s, e]);
    }
  }
  /* alpha 0.4: the part of a slow frame no marked step covers (a stall in the graphics driver, a shader built on first use, a picture read back) is named too, so a long frame with small causes says where the rest went */
  iv.sort((x, y) => x[0] - y[0]);
  let cov = 0,
    cs = -1,
    ce = -1;
  for (const [s, e] of iv) {
    if (s > ce) {
      if (ce > cs) cov += ce - cs;
      cs = s;
      ce = e;
    } else if (e > ce) ce = e;
  }
  if (ce > cs) cov += ce - cs;
  const rest = t1 - t0 - cov;
  if (rest > 150 && rest > (t1 - t0) * 0.5) by['outside the marked steps'] = rest;
  const k = Object.keys(by).sort((x, y) => by[y] - by[x]);
  return k.length
    ? k
        .slice(0, 2)
        .map(x => `${x} ${Math.round(by[x])} ms`)
        .join(', ')
    : null;
};
debugLog.cause = (label, ms) => {
  const c = debugLog.causes[label] || (debugLog.causes[label] = { n: 0, ms: 0, max: 0 });
  c.n++;
  c.ms += ms;
  c.max = Math.max(c.max, ms);
};
/* section timings inside a frame (CPU side), averaged per second into the samples */
debugLog.time = (sec, ms) => {
  const p = debugLog.prof[sec] || (debugLog.prof[sec] = { n: 0, ms: 0, max: 0 });
  p.n++;
  p.ms += ms;
  if (ms > p.max) p.max = ms;
};
/* called by the frame scheduler for every task it runs */
debugLog.task = (name, work, ts) => {
  let a = debugLog.acc.get(name);
  if (!a) {
    a = { n: 0, w: 0, max: 0, long: 0, last: 0, gapMax: 0 };
    debugLog.acc.set(name, a);
  }
  a.n++;
  a.w += work;
  if (work > a.max) a.max = work;
  if (work > 33) {
    a.long++;
    const t1 = performance.now(),
      why = debugLog.blame(t1 - work - 2, t1 + 1) || 'drawing';
    debugLog.cause(why.replace(/ \d+ ms.*$/, ''), work);
    const L = debugLog.slow;
    L.push({
      t: debugLog.now(),
      task: name,
      ms: Math.round(work),
      why,
      view:
        typeof GAME.activeBattle !== 'undefined' && GAME.activeBattle
          ? 'battle'
          : typeof GAME.uiState !== 'undefined'
            ? GAME.uiState.tab
            : '-',
      scene: typeof GAME.walkView !== 'undefined' ? GAME.walkView.id : null,
    });
    if (L.length > 60) L.shift();
  }
  if (a.last) {
    const g = ts - a.last;
    if (g > a.gapMax) a.gapMax = g;
  }
  a.last = ts;
  if (ts - debugLog.secT >= 1000) {
    debugLog.flush(ts);
  }
};
debugLog.ctx = () => {
  const c = {};
  try {
    c.view =
      typeof GAME.activeBattle !== 'undefined' && GAME.activeBattle
        ? 'battle'
        : typeof GAME.uiState !== 'undefined'
          ? GAME.uiState.tab
          : '-';
    if (typeof GAME.walkView !== 'undefined' && GAME.walkView.id) c.scene = GAME.walkView.id;
    if (typeof GAME.walkRenderer !== 'undefined') c.gl = GAME.walkRenderer.on ? 1 : 0;
    if (typeof GAME.walkView !== 'undefined') c.res = Math.round((GAME.walkView.R || 1) * 100) / 100;
    if (typeof GAME.battleStage !== 'undefined' && GAME.battleStage.q) c.bq = GAME.battleStage.q.lvl;
    if (typeof GAME.walkView !== 'undefined' && GAME.walkView.held) c.held = GAME.walkView.held;
    if (typeof GAME.walkRenderer !== 'undefined' && GAME.walkRenderer.on) {
      c.q = GAME.walkRenderer.qe || 0;
      if (GAME.walkRenderer.cullOf) c.cull = [GAME.walkRenderer.culled, GAME.walkRenderer.cullOf];
      if (GAME.walkRenderer.gridSkip) c.grid = GAME.walkRenderer.gridSkip;
      if (GAME.walkRenderer.shHit !== undefined || GAME.walkRenderer.shMiss !== undefined) {
        c.shc = [GAME.walkRenderer.shHit || 0, GAME.walkRenderer.shMiss || 0];
        GAME.walkRenderer.shHit = GAME.walkRenderer.shMiss = 0;
      }
    }
    if (typeof GAME.gpuState !== 'undefined' && GAME.gpuState.gpuMs)
      c.gpu = [Math.round(GAME.gpuState.gpuMs * 10) / 10, Math.round(GAME.gpuState.gpuMax || 0)];
    if (debugLog.bench && debugLog.bench.step) c.bench = debugLog.bench.step;
  } catch (e) {}
  return c;
};
debugLog.flush = ts => {
  const dt = debugLog.secT ? ts - debugLog.secT : 1000;
  debugLog.secT = ts;
  const c = debugLog.ctx(),
    tasks = {};
  for (const [k, a] of debugLog.acc) {
    if (!a.n) continue;
    tasks[k] = {
      fps: Math.round((a.n * 1000) / Math.max(1, dt)),
      ms: Math.round((a.w / a.n) * 10) / 10,
      max: Math.round(a.max),
      long: a.long,
      gap: Math.round(a.gapMax),
    };
    a.n = a.w = a.max = a.long = a.gapMax = 0;
  }
  if (!Object.keys(tasks).length) return;
  const s = Object.assign({ t: debugLog.now(), dt: Math.round(dt) }, c, { tasks });
  const pr = {};
  for (const [k, p] of Object.entries(debugLog.prof)) {
    if (p.n) pr[k] = [Math.round((p.ms / p.n) * 10) / 10, Math.round(p.max)];
    p.n = p.ms = p.max = 0;
  }
  if (Object.keys(pr).length) s.prof = pr;
  if (performance.memory) s.mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
  debugLog.samples.push(s);
  if (debugLog.samples.length > debugLog.max.samples)
    debugLog.samples.splice(0, debugLog.samples.length - debugLog.max.samples);
  /* a fresh picture of the scene now and then (reading the picture back stalls the GPU for a frame, so not often) */
  if (!debugLog.shotT) debugLog.shotT = ts - 45000;
  if (ts - debugLog.shotT > 60000) {
    debugLog.shotT = ts;
    debugLog.snap();
  }
};
/* the WebGL scene can only be read inside the frame that drew it, so it is captured there (walk-view-gl.js) */
debugLog.snap = () => {
  try {
    if (typeof GAME.walkRenderer !== 'undefined' && GAME.walkRenderer.on && GAME.walkView.cv && GAME.walkView.ready) {
      GAME.walkRenderer.snapReq = 1;
      return;
    }
    const cv =
      typeof GAME.activeBattle !== 'undefined' && GAME.activeBattle
        ? document.getElementById('cvWorld')
        : document.getElementById('dio');
    if (cv && cv.width && !cv.hidden) debugLog.keepShot(cv, null);
  } catch (e) {}
};
debugLog.keepShot = (cv, over) => {
  try {
    const k = Math.min(1, 640 / Math.max(cv.width, cv.height)),
      c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cv.width * k));
    c.height = Math.max(1, Math.round(cv.height * k));
    const x = c.getContext('2d');
    x.drawImage(cv, 0, 0, c.width, c.height);
    if (over) x.drawImage(over, 0, 0, c.width, c.height);
    debugLog.shot = {
      t: debugLog.now(),
      what:
        typeof GAME.activeBattle !== 'undefined' && GAME.activeBattle
          ? 'battle'
          : (typeof GAME.walkView !== 'undefined' && GAME.walkView.id) || 'scene',
      jpeg: c.toDataURL('image/jpeg', 0.72),
    };
  } catch (e) {
    debugLog.shot = { t: debugLog.now(), error: String(e.message || e) };
  }
};
/* one summary line per task and scene: average, worst second and slow frames */
debugLog.summary = (from = 0) => {
  const g = {},
    held = {};
  for (const s of debugLog.samples) {
    if (s.t < from) continue;
    for (const [k, v] of Object.entries(s.tasks)) {
      if (!['dio', 'scene', 'map'].includes(k)) continue;
      /* v32: seconds the scene was held back on purpose (a window open, another screen, scrolled away) are counted, not averaged in */
      if (k === 'dio' && s.held) {
        held[s.held] = (held[s.held] || 0) + 1;
        continue;
      }
      const key =
        k === 'dio'
          ? `walk:${s.scene || '?'}${s.view && s.view !== 'walk' ? ' (' + s.view + ' tab)' : ''}`
          : k === 'scene'
            ? 'battle'
            : 'map';
      const e = g[key] || (g[key] = { sec: 0, fps: [], ms: [], long: 0, gl: s.gl, res: [] });
      e.sec++;
      e.fps.push(v.fps);
      e.ms.push(v.ms);
      e.long += v.long;
      if (s.res) e.res.push(s.res);
    }
  }
  const out = {};
  for (const [k, e] of Object.entries(g)) {
    const f = e.fps.slice().sort((a, b) => a - b),
      m = e.ms.slice().sort((a, b) => a - b),
      avg = a => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
    out[k] = {
      seconds: e.sec,
      fpsAvg: avg(f),
      fpsWorst: f[0],
      fpsP10: f[Math.floor(f.length * 0.1)],
      cpuMsAvg: avg(m),
      cpuMsP90: m[Math.floor(m.length * 0.9)],
      slowFrames: e.long,
      renderer: k.startsWith('walk') ? (e.gl ? 'webgl' : 'canvas') : 'canvas',
      resolution: avg(e.res),
    };
  }
  if (Object.keys(held).length) out.heldBack = held;
  return out;
};
debugLog.device = () => {
  const n = navigator,
    d = {
      userAgent: n.userAgent,
      platform: n.userAgentData ? n.userAgentData.platform : n.platform,
      mobile: n.userAgentData ? n.userAgentData.mobile : /Mobi|Android|iPhone|iPad/.test(n.userAgent),
      screen: `${screen.width}x${screen.height}`,
      viewport: `${innerWidth}x${innerHeight}`,
      dpr: devicePixelRatio,
      cores: n.hardwareConcurrency,
      memoryGB: n.deviceMemory,
      touch: n.maxTouchPoints,
      language: n.language,
      timeZone: (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
          return null;
        }
      })(),
      orientation: screen.orientation ? screen.orientation.type : null,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      darkMode: matchMedia('(prefers-color-scheme: dark)').matches,
      connection: n.connection ? n.connection.effectiveType : null,
      secure: isSecureContext,
      standalone: matchMedia('(display-mode: standalone)').matches,
    };
  return d;
};
debugLog.glInfo = () => {
  const o = {};
  try {
    const c = document.createElement('canvas'),
      g = c.getContext('webgl2');
    o.webgl2 = !!g;
    const g1 = g || c.getContext('webgl');
    if (g1) {
      const e = g1.getExtension('WEBGL_debug_renderer_info');
      o.vendor = e ? g1.getParameter(e.UNMASKED_VENDOR_WEBGL) : g1.getParameter(g1.VENDOR);
      o.renderer = e ? g1.getParameter(e.UNMASKED_RENDERER_WEBGL) : g1.getParameter(g1.RENDERER);
      o.maxTexture = g1.getParameter(g1.MAX_TEXTURE_SIZE);
      o.maxViewport = Array.from(g1.getParameter(g1.MAX_VIEWPORT_DIMS) || []);
      o.precisionHigh = !!(g1.getShaderPrecisionFormat(g1.FRAGMENT_SHADER, g1.HIGH_FLOAT) || {}).precision;
      if (g) {
        o.maxSamples = g.getParameter(g.MAX_SAMPLES);
        o.floatTargets = !!g.getExtension('EXT_color_buffer_float');
        o.timerQuery = !!g.getExtension('EXT_disjoint_timer_query_webgl2');
      }
      const lose = g1.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch (e) {
    o.error = String(e.message || e);
  }
  if (typeof GAME.walkRenderer !== 'undefined') {
    o.sceneRenderer = GAME.walkRenderer.on ? 'webgl' : 'canvas';
    o.webglFailed = !!(typeof GAME.gpuState !== 'undefined' && GAME.gpuState.fail);
    o.contextLost = !!(typeof GAME.gpuState !== 'undefined' && GAME.gpuState.lost);
    o.frames = GAME.walkRenderer.frames;
  }
  /* alpha 0.4: the helper threads: the ground painter's (ground-paint-worker.js) and the bump maps' (engine/webgl.js) */
  try {
    if (typeof GAME.paintWorkerReport === 'function') o.groundPainter = GAME.paintWorkerReport();
    if (typeof GAME.normalMapWorkerState !== 'undefined')
      o.bumpHelper = GAME.normalMapWorkerState.w ? 'on' : GAME.normalMapWorkerState.bad ? 'off' : 'not started';
  } catch (e) {}
  return o;
};
debugLog.state = () => {
  const s = {};
  try {
    const p = GAME.saveData.preferences || {};
    s.preferences = {
      theme: p.theme || 'system',
      motion: p.motion || 'system',
      fps: p.fps || 60,
      effects: p.effects || 'full',
      tilt: p.tilt !== false,
    };
    s.started = !!GAME.saveData.started;
    s.tab = GAME.uiState.tab;
    s.battle = !!GAME.activeBattle;
    s.stop = GAME.saveData.trip ? GAME.saveData.trip.node : null;
    s.trip = GAME.saveData.trip ? GAME.saveData.trip.plan.slice() : [];
    s.tripProgress = GAME.saveData.trip ? GAME.saveData.trip.prog : 0;
    s.scene = typeof GAME.walkView !== 'undefined' ? GAME.walkView.id : null;
    s.team = GAME.saveData.team ? GAME.saveData.team.length : 0;
    s.encounters = GAME.saveData.queue ? GAME.saveData.queue.length : 0;
    s.badges = (GAME.saveData.seats || []).length;
    s.visited = Object.keys(GAME.saveData.visited || {}).length;
    s.frameHz = GAME.frameScheduler.hz;
    s.fpsCap = GAME.userFps();
  } catch (e) {
    s.error = String(e.message || e);
  }
  return s;
};
/* v30: more to go on: the hour and weather, every setting, the scene's contents, caches, memory, long tasks,
   how long frames take, and the GPU's extensions */
debugLog.long = { n: 0, total: 0, max: 0, last: [] };
try {
  new PerformanceObserver(l => {
    for (const e of l.getEntries()) {
      const L = debugLog.long;
      L.n++;
      L.total += e.duration;
      L.max = Math.max(L.max, e.duration);
      const why =
        debugLog.blame(e.startTime, e.startTime + e.duration) || 'unknown (script or layout outside the marked jobs)';
      L.last.push([Math.round(e.startTime - debugLog.t0), Math.round(e.duration), why]);
      if (L.last.length > 40) L.last.shift();
    }
  }).observe({ type: 'longtask', buffered: true });
} catch (e) {}
debugLog.more = () => {
  const o = {};
  const t = (k, f) => {
    try {
      o[k] = f();
    } catch (e) {
      o[k] = 'error: ' + String(e.message || e).slice(0, 80);
    }
  };
  t('account', () => (typeof GAME.account !== 'undefined' && GAME.account.user ? 'signed in' : 'this browser'));
  t('preferences', () => Object.assign({}, GAME.saveData.preferences || {}));
  t('saveBytes', () => JSON.stringify(GAME.saveData).length);
  t('time', () =>
    typeof GAME.environment !== 'undefined'
      ? {
          on: GAME.environment.on,
          hour: +GAME.environment.tod.toFixed(2),
          weather: GAME.environment.weather,
          season: GAME.environment.season,
          climate: GAME.environment.climate,
          night: +(GAME.environment.night || 0).toFixed(2),
          lamps: +(GAME.environment.lampK || 0).toFixed(2),
          forced: GAME.environment.force || null,
        }
      : null
  );
  t('scene', () => {
    if (typeof GAME.walkView === 'undefined' || !GAME.walkView.sc) return null;
    const sc = GAME.walkView.sc;
    return {
      id: GAME.walkView.id,
      size: [sc.w, sc.h],
      props: (sc.props || []).length,
      life: typeof GAME.ambientLife !== 'undefined' ? GAME.ambientLife.list.map(c => c.k).join(' ') : '',
      folk: (GAME.walkView.folk || []).length,
      water: (GAME.walkView.water || []).length,
      ladders: (sc.props || []).filter(p => p.act === 'climb').length,
      resolution: GAME.walkView.R,
      inside: GAME.uiState.inside ? GAME.uiState.inside.id : null,
      room: !!sc.room,
    };
  });
  t('caches', () => ({
    people: typeof GAME.PERSON_ART_CACHE !== 'undefined' ? GAME.PERSON_ART_CACHE.size : null,
    lifeFrames: typeof GAME.ambientLife !== 'undefined' ? GAME.ambientLife.cut.size : null,
    normalsWaiting: typeof GAME.gpuState !== 'undefined' && GAME.gpuState.normQ ? GAME.gpuState.normQ.length : null,
    targets: typeof GAME.gpuState !== 'undefined' ? Object.keys(GAME.gpuState.fb || {}).length : null,
    prints: typeof GAME.walkRenderer !== 'undefined' && GAME.walkRenderer.prints ? GAME.walkRenderer.prints.length : 0,
  }));
  t('memoryMB', () =>
    performance.memory
      ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1e6),
          total: Math.round(performance.memory.totalJSHeapSize / 1e6),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1e6),
        }
      : null
  );
  t('longTasks', () => ({
    count: debugLog.long.n,
    totalMs: Math.round(debugLog.long.total),
    maxMs: Math.round(debugLog.long.max),
    last: debugLog.long.last,
  }));
  t('slowFramesBy', () =>
    Object.fromEntries(
      Object.entries(debugLog.causes)
        .sort((a, b) => b[1].ms - a[1].ms)
        .slice(0, 16)
        .map(([k, v]) => [k, { frames: v.n, totalMs: Math.round(v.ms), worstMs: Math.round(v.max) }])
    )
  );
  t('slowFrames', () => debugLog.slow.slice(-30));
  t('frameMs', () =>
    typeof GAME.walkRenderer !== 'undefined' && GAME.walkRenderer.hist
      ? {
          under8: GAME.walkRenderer.hist[0],
          under16: GAME.walkRenderer.hist[1],
          under33: GAME.walkRenderer.hist[2],
          under66: GAME.walkRenderer.hist[3],
          under133: GAME.walkRenderer.hist[4],
          over133: GAME.walkRenderer.hist[5],
        }
      : null
  );
  t('glExtensions', () =>
    typeof GAME.gpuState !== 'undefined' && GAME.gpuState.gl ? GAME.gpuState.gl.getSupportedExtensions() : null
  );
  t('audio', () =>
    typeof GAME.soundEngine !== 'undefined' && GAME.soundEngine.ctx
      ? {
          state: GAME.soundEngine.ctx.state,
          rate: GAME.soundEngine.ctx.sampleRate,
          song: GAME.soundEngine.song ? GAME.soundEngine.song.name : null,
          worldBeds: typeof GAME.ambience !== 'undefined' ? Object.keys(GAME.ambience.beds).length : 0,
        }
      : null
  );
  t('today', () =>
    typeof GAME.challengesToday === 'function' && GAME.saveData.started
      ? {
          challenges: GAME.challengesToday().list.map(c => [c.k, c.have, c.need, c.claimed]),
          stamps: GAME.stampCount(),
        }
      : null
  );
  return o;
};
debugLog.build = () => ({
  game: 'Pocket Billies',
  kind: 'debug-log',
  format: 1,
  build: BUILD_VERSION,
  dataVersion: (GAME.gameData.meta && GAME.gameData.meta.version) || null,
  artVersion: (GAME.gameData.meta && GAME.gameData.meta.artVersion) || 0,
  created: new Date().toISOString(),
  uptimeSec: Math.round(debugLog.now() / 1000),
  device: debugLog.device(),
  graphics: debugLog.glInfo(),
  state: debugLog.state(),
  more: debugLog.more(),
  load: debugLog.load,
  summary: debugLog.summary(),
  bench: (debugLog.bench && debugLog.bench.result) || null,
  errors: debugLog.err,
  events: debugLog.ev,
  samples: debugLog.samples,
  screenshot: debugLog.shot,
});
/* save it: the share sheet on phones (send it to yourself, or to Files), a download elsewhere, the clipboard as a last resort */
async function exportDebugLog() {
  /* take a current picture first: the WebGL scene hands it over on its next frame */
  if (
    typeof GAME.walkRenderer !== 'undefined' &&
    GAME.walkRenderer.on &&
    typeof GAME.walkView !== 'undefined' &&
    GAME.walkView.ready
  ) {
    const t0 = debugLog.shot && debugLog.shot.t;
    debugLog.snap();
    for (let i = 0; i < 25 && GAME.walkRenderer.snapReq; i++) await new Promise(r => setTimeout(r, 60));
  }
  let data;
  try {
    data = JSON.stringify(debugLog.build());
  } catch (e) {
    GAME.toast('Couldn’t build the debug log: ' + (e.message || e));
    return;
  }
  const d = new Date(),
    pad = n => String(n).padStart(2, '0'),
    name = `pocket-billies-debug-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  debugLog.add('export', name);
  try {
    const f = new File([data], name, { type: 'application/json' });
    if (
      navigator.canShare &&
      navigator.canShare({ files: [f] }) &&
      /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
    ) {
      await navigator.share({ files: [f], title: 'Pocket Billies debug log' });
      GAME.toast('Debug log shared.');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    GAME.toast('Debug log saved to your downloads.');
    return;
  } catch (e) {}
  try {
    await navigator.clipboard.writeText(data);
    GAME.toast('The debug log was copied. Paste it into a text file.');
  } catch (e) {
    GAME.toast('This browser can’t save files here.');
  }
}
/* hooks into the game, installed once everything has loaded */
debugLog.hook = () => {
  if (debugLog.hooked) return;
  debugLog.hooked = true;
  /* phase 05: a function the log should wrap or time that is gone (renamed, say) is said, not skipped in silence */
  const missing = name => {
    debugLog.add('log', `no function ${name} to wrap`);
    console.error(`Pocket Billies debug log: no function ${name} to wrap`);
  };
  const wrap = (name, fn) => {
    const o = GAME[name];
    if (typeof o !== 'function') return missing(name);
    GAME[name] = function (...a) {
      try {
        fn(...a);
      } catch (e) {}
      return o.apply(this, a);
    };
  };
  let lastTab = null;
  wrap('render', () => {
    const v = typeof GAME.activeBattle !== 'undefined' && GAME.activeBattle ? 'battle' : GAME.uiState.tab;
    if (v !== lastTab) {
      lastTab = v;
      debugLog.add('screen', v);
    }
  });
  wrap('newBattle', kind =>
    debugLog.add(
      'battle',
      `start ${kind}${typeof GAME.battleStageKey === 'function' ? ' at ' + GAME.battleStageKey() : ''}`
    )
  );
  wrap('endBattle', () => debugLog.add('battle', 'end ' + ((GAME.activeBattle && GAME.activeBattle.over) || '')));
  wrap('mountWalkView', (cv, id, opt) => debugLog.add('scene', `mount ${id}`));
  wrap('setTrip', j =>
    debugLog.add(
      'travel',
      `trip to ${typeof GAME.LOCATIONS !== 'undefined' && GAME.LOCATIONS[j] ? GAME.LOCATIONS[j].name : j}`
    )
  );
  wrap('openShop', id => debugLog.add('shop', id));
  wrap('worldMapMount', () => debugLog.add('map', 'open'));
  /* v33: costly jobs leave marks (see debugLog.blame) */
  const timed = (name, label) => {
    const o = GAME[name];
    if (typeof o !== 'function') return missing(name);
    if (o.__nwT) return;
    const f = function (...a) {
      const t0 = performance.now();
      try {
        return o.apply(this, a);
      } finally {
        debugLog.mark(label, t0, performance.now());
      }
    };
    f.__nwT = 1;
    GAME[name] = f;
  };
  for (const [n, l] of [
    ['mountWalkView', 'opening a scene'],
    ['prepareMap', 'preparing a scene'],
    ['render', 'drawing the menus'],
    ['renderOverlay', 'drawing a window'],
    ['save', 'saving'],
    ['buildSolidProp', 'building a solid prop'],
    ['buildSolidTree', 'building a 3D tree'],
    ['worldMapMiniBuild', 'building a map miniature'],
    ['ensurePrograms', 'compiling shaders'],
    ['finishProgramCompile', 'finishing a shader'],
    ['makeNormalMap', 'working out a bump map'],
    ['runNormalMapJobs', 'handing bump maps to the helper'],
    ['groundOcclusion', 'shading the ground'],
    ['buildGrass', 'planting the grass'],
    ['buildingItems', 'building 3D buildings'],
    ['openBattle', 'opening a battle'],
    ['battleStageStart', 'setting up the battle stage'],
    ['battleStageResize', 'laying out the battle'],
    ['paintActions', 'drawing the battle menu'],
    ['personBattleFrames', 'drawing a person'],
    ['worldMapGlRender', 'drawing the map'],
    ['cutsceneStart', 'starting the opening'],
    ['openDressingRoom', 'opening the dressing room'],
    ['artPixels', 'reading a picture'],
  ])
    timed(n, l);
  /* the renderer's own sections, timed every frame */
  for (const [n, l, m] of [
    ['gatherFrameItems', 'items'],
    ['shadowPass', 'shadows'],
    ['drawSprites', 'sprites'],
    ['drawGrass', 'grass'],
    ['drawSolidProps', 'solid props'],
    ['drawBuildings', 'buildings'],
    ['drawPostEffects', 'post'],
    ['drawGround', 'ground'],
    ['reflectionPass', 'reflections'],
    ['drawWater', 'water'],
    ['effectsPass', 'effects'],
    /* alpha 0.2: the rest of a frame's work, so a slow frame names it (a slow frame used to say only "drawing") */
    ['updateNearRing', 'near ring', 'painting the ground nearby'],
    ['grassWork', 'grass rows', 'planting the grass'],
    ['updatePlayer', 'walking', 'moving you'],
    ['updateFolk', 'folk', 'moving the townsfolk'],
    ['lifeStep', 'animals', 'moving the animals'],
  ]) {
    const o = GAME[n];
    if (typeof o !== 'function') {
      missing(n);
      continue;
    }
    if (o.__nwP) continue;
    const f = function (...a) {
      const t0 = performance.now();
      try {
        return o.apply(this, a);
      } finally {
        const d = performance.now() - t0;
        debugLog.time(l, d);
        if (d > 12) debugLog.mark(m || 'drawing ' + l, t0, t0 + d);
      }
    };
    f.__nwP = 1;
    GAME[n] = f;
  }
};
/* v33: everything a test needs to explain a result: what's on screen, what the renderer is doing, what went wrong lately */
debugLog.diag = (since = 0) => {
  const o = {};
  const t = (k, f) => {
    try {
      o[k] = f();
    } catch (e) {
      o[k] = '?';
    }
  };
  t('view', () =>
    typeof GAME.activeBattle !== 'undefined' && GAME.activeBattle
      ? `battle ${GAME.activeBattle.kind}/${GAME.activeBattle.fmt || 'single'} (${GAME.activeBattle.phase})`
      : typeof GAME.uiState !== 'undefined'
        ? GAME.uiState.tab
        : '-'
  );
  t('scene', () =>
    typeof GAME.walkView !== 'undefined' ? GAME.walkView.id + (GAME.walkView.ready ? '' : ' (loading)') : null
  );
  t('renderer', () =>
    typeof GAME.walkRenderer !== 'undefined'
      ? GAME.walkRenderer.on
        ? `webgl q${GAME.walkRenderer.q || 0} res ${Math.round((GAME.walkView.R || 1) * 100)}% · ${GAME.walkRenderer.frames} frames`
        : 'canvas'
      : '-'
  );
  t('drawn', () =>
    typeof GAME.walkRenderer !== 'undefined' && GAME.walkRenderer.on
      ? {
          skipped: GAME.walkRenderer.cullOf ? `${GAME.walkRenderer.culled}/${GAME.walkRenderer.cullOf}` : null,
          buildings: typeof GAME.buildingState !== 'undefined' ? GAME.buildingState.drawn : null,
          solid: typeof GAME.solidPropState !== 'undefined' ? GAME.solidPropState.drawn : null,
          grass: GAME.walkRenderer.grassDrawn || null,
        }
      : null
  );
  t('slow', () =>
    debugLog.slow
      .filter(x => x.t >= since)
      .map(x => `${x.ms} ms (${x.why})`)
      .slice(-6)
  );
  t('long', () =>
    debugLog.long.last
      .filter(x => x[0] >= since)
      .map(x => `${x[1]} ms (${x[2]})`)
      .slice(-6)
  );
  t('errors', () =>
    debugLog.err
      .filter(x => x.t >= since)
      .map(
        x =>
          x.msg.slice(0, 160) +
          (x.stack ? ' @ ' + String(x.stack).split('\n').slice(1, 2).join('').trim().slice(0, 120) : '')
      )
      .slice(-5)
  );
  t('events', () =>
    debugLog.ev
      .filter(x => x.t >= since)
      .slice(-5)
      .map(x => x.kind + ': ' + x.msg)
  );
  t('mb', () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
  return o;
};
/* the full test (Settings → Run the full test) is in self-test.js */
