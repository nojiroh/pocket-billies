'use strict';
/* ================= DEBUG LOG =================
   Quietly records what helps fix problems on a particular device: frame rates per screen and scene, slow frames,
   errors, the loading screen's timings, the device and graphics chip, and a small picture of the scene every few
   seconds. Settings → Export debug log saves it as one JSON file (or shares it on phones). Settings → Run the full
   test (selftest.js) plays through everything for about two minutes, stress-tests the device and adds the results.
   Nothing here leaves the device unless the player exports it. No save data, names or step history are included. */
const NW_BUILD = PB_VERSION;
/* phase 04d: what the log reads and wraps in the game's modules. log.js runs before them (it catches their errors),
   so js/log-names.js (made by tools/to-module.mjs, the last module of the page) fills this in once they have loaded:
   a getter for each name, and a setter (the module's own setX) for each function the log wraps. Until then it is
   empty, as the names were before the modules ran. */
const GAME = {};
const NWLOG = {
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
NWLOG.now = () => Math.round(performance.now() - NWLOG.t0);
NWLOG.add = (kind, msg, data) => {
  const L = NWLOG.ev;
  L.push(Object.assign({ t: NWLOG.now(), kind, msg: String(msg).slice(0, 300) }, data || {}));
  if (L.length > NWLOG.max.ev) L.splice(0, L.length - NWLOG.max.ev);
};
NWLOG.error = (kind, msg, stack) => {
  const L = NWLOG.err,
    m = String(msg).slice(0, 500),
    last = L[L.length - 1];
  if (last && last.msg === m) {
    last.n = (last.n || 1) + 1;
    return;
  }
  L.push({ t: NWLOG.now(), kind, msg: m, stack: stack ? String(stack).slice(0, 1500) : undefined });
  if (L.length > NWLOG.max.err) L.splice(0, L.length - NWLOG.max.err);
};
addEventListener(
  'error',
  e => {
    NWLOG.error(
      'error',
      e.message || (e.target && e.target.src ? 'Failed to load ' + e.target.src : 'error'),
      e.error && e.error.stack
    );
  },
  true
);
addEventListener('unhandledrejection', e => {
  const r = e.reason;
  NWLOG.error('promise', (r && r.message) || String(r), r && r.stack);
});
for (const k of ['error', 'warn']) {
  const o = console[k].bind(console);
  console[k] = (...a) => {
    try {
      NWLOG.error(
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
document.addEventListener('visibilitychange', () => NWLOG.add('visibility', document.hidden ? 'hidden' : 'visible'));
addEventListener('resize', () => {
  clearTimeout(NWLOG._rz);
  NWLOG._rz = setTimeout(() => NWLOG.add('resize', `${innerWidth}x${innerHeight}`), 400);
});
/* v33: what the game was busy with. Costly jobs leave a mark (what, when, how long); a slow frame or a long task is
   put down to the marks it overlaps, so the log can say "building the ground: 180 ms" instead of just "slow". */
NWLOG.marks = [];
NWLOG.causes = {};
NWLOG.slow = [];
NWLOG.prof = {};
NWLOG.mark = (label, t0, t1) => {
  const M = NWLOG.marks,
    L = M[M.length - 1];
  if (L && L[2] === label && t0 - L[1] < 3) {
    L[1] = Math.max(L[1], t1);
    return;
  }
  /* runs of small jobs of one kind add up */ if (t1 - t0 < 0.25) return;
  M.push([t0, t1, label]);
  if (M.length > 600) M.splice(0, M.length - 600);
};
NWLOG.blame = (t0, t1) => {
  const by = {},
    iv = [];
  for (const [a, b, l] of NWLOG.marks) {
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
NWLOG.cause = (label, ms) => {
  const c = NWLOG.causes[label] || (NWLOG.causes[label] = { n: 0, ms: 0, max: 0 });
  c.n++;
  c.ms += ms;
  c.max = Math.max(c.max, ms);
};
/* section timings inside a frame (CPU side), averaged per second into the samples */
NWLOG.time = (sec, ms) => {
  const p = NWLOG.prof[sec] || (NWLOG.prof[sec] = { n: 0, ms: 0, max: 0 });
  p.n++;
  p.ms += ms;
  if (ms > p.max) p.max = ms;
};
/* called by the frame scheduler for every task it runs */
NWLOG.task = (name, work, ts) => {
  let a = NWLOG.acc.get(name);
  if (!a) {
    a = { n: 0, w: 0, max: 0, long: 0, last: 0, gapMax: 0 };
    NWLOG.acc.set(name, a);
  }
  a.n++;
  a.w += work;
  if (work > a.max) a.max = work;
  if (work > 33) {
    a.long++;
    const t1 = performance.now(),
      why = NWLOG.blame(t1 - work - 2, t1 + 1) || 'drawing';
    NWLOG.cause(why.replace(/ \d+ ms.*$/, ''), work);
    const L = NWLOG.slow;
    L.push({
      t: NWLOG.now(),
      task: name,
      ms: Math.round(work),
      why,
      view: typeof GAME.B !== 'undefined' && GAME.B ? 'battle' : typeof GAME.U !== 'undefined' ? GAME.U.tab : '-',
      scene: typeof GAME.DIO !== 'undefined' ? GAME.DIO.id : null,
    });
    if (L.length > 60) L.shift();
  }
  if (a.last) {
    const g = ts - a.last;
    if (g > a.gapMax) a.gapMax = g;
  }
  a.last = ts;
  if (ts - NWLOG.secT >= 1000) {
    NWLOG.flush(ts);
  }
};
NWLOG.ctx = () => {
  const c = {};
  try {
    c.view = typeof GAME.B !== 'undefined' && GAME.B ? 'battle' : typeof GAME.U !== 'undefined' ? GAME.U.tab : '-';
    if (typeof GAME.DIO !== 'undefined' && GAME.DIO.id) c.scene = GAME.DIO.id;
    if (typeof GAME.DGL !== 'undefined') c.gl = GAME.DGL.on ? 1 : 0;
    if (typeof GAME.DIO !== 'undefined') c.res = Math.round((GAME.DIO.R || 1) * 100) / 100;
    if (typeof GAME.SC !== 'undefined' && GAME.SC.q) c.bq = GAME.SC.q.lvl;
    if (typeof GAME.DIO !== 'undefined' && GAME.DIO.held) c.held = GAME.DIO.held;
    if (typeof GAME.DGL !== 'undefined' && GAME.DGL.on) {
      c.q = GAME.DGL.qe || 0;
      if (GAME.DGL.cullOf) c.cull = [GAME.DGL.culled, GAME.DGL.cullOf];
      if (GAME.DGL.gridSkip) c.grid = GAME.DGL.gridSkip;
      if (GAME.DGL.shHit !== undefined || GAME.DGL.shMiss !== undefined) {
        c.shc = [GAME.DGL.shHit || 0, GAME.DGL.shMiss || 0];
        GAME.DGL.shHit = GAME.DGL.shMiss = 0;
      }
    }
    if (typeof GAME.EGL !== 'undefined' && GAME.EGL.gpuMs)
      c.gpu = [Math.round(GAME.EGL.gpuMs * 10) / 10, Math.round(GAME.EGL.gpuMax || 0)];
    if (NWLOG.bench && NWLOG.bench.step) c.bench = NWLOG.bench.step;
  } catch (e) {}
  return c;
};
NWLOG.flush = ts => {
  const dt = NWLOG.secT ? ts - NWLOG.secT : 1000;
  NWLOG.secT = ts;
  const c = NWLOG.ctx(),
    tasks = {};
  for (const [k, a] of NWLOG.acc) {
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
  const s = Object.assign({ t: NWLOG.now() }, c, { tasks });
  const pr = {};
  for (const [k, p] of Object.entries(NWLOG.prof)) {
    if (p.n) pr[k] = [Math.round((p.ms / p.n) * 10) / 10, Math.round(p.max)];
    p.n = p.ms = p.max = 0;
  }
  if (Object.keys(pr).length) s.prof = pr;
  if (performance.memory) s.mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
  NWLOG.samples.push(s);
  if (NWLOG.samples.length > NWLOG.max.samples) NWLOG.samples.splice(0, NWLOG.samples.length - NWLOG.max.samples);
  /* a fresh picture of the scene now and then (reading the picture back stalls the GPU for a frame, so not often) */
  if (!NWLOG.shotT) NWLOG.shotT = ts - 45000;
  if (ts - NWLOG.shotT > 60000) {
    NWLOG.shotT = ts;
    NWLOG.snap();
  }
};
/* the WebGL scene can only be read inside the frame that drew it, so it is captured there (diorama-gl.js) */
NWLOG.snap = () => {
  try {
    if (typeof GAME.DGL !== 'undefined' && GAME.DGL.on && GAME.DIO.cv && GAME.DIO.ready) {
      GAME.DGL.snapReq = 1;
      return;
    }
    const cv =
      typeof GAME.B !== 'undefined' && GAME.B ? document.getElementById('cvWorld') : document.getElementById('dio');
    if (cv && cv.width && !cv.hidden) NWLOG.keepShot(cv, null);
  } catch (e) {}
};
NWLOG.keepShot = (cv, over) => {
  try {
    const k = Math.min(1, 640 / Math.max(cv.width, cv.height)),
      c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cv.width * k));
    c.height = Math.max(1, Math.round(cv.height * k));
    const x = c.getContext('2d');
    x.drawImage(cv, 0, 0, c.width, c.height);
    if (over) x.drawImage(over, 0, 0, c.width, c.height);
    NWLOG.shot = {
      t: NWLOG.now(),
      what:
        typeof GAME.B !== 'undefined' && GAME.B
          ? 'battle'
          : (typeof GAME.DIO !== 'undefined' && GAME.DIO.id) || 'scene',
      jpeg: c.toDataURL('image/jpeg', 0.72),
    };
  } catch (e) {
    NWLOG.shot = { t: NWLOG.now(), error: String(e.message || e) };
  }
};
/* one summary line per task and scene: average, worst second and slow frames */
NWLOG.summary = (from = 0) => {
  const g = {},
    held = {};
  for (const s of NWLOG.samples) {
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
NWLOG.device = () => {
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
NWLOG.glInfo = () => {
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
  if (typeof GAME.DGL !== 'undefined') {
    o.sceneRenderer = GAME.DGL.on ? 'webgl' : 'canvas';
    o.webglFailed = !!(typeof GAME.EGL !== 'undefined' && GAME.EGL.fail);
    o.contextLost = !!(typeof GAME.EGL !== 'undefined' && GAME.EGL.lost);
    o.frames = GAME.DGL.frames;
  }
  /* alpha 0.4: the helper threads: the ground painter's (paint.js) and the bump maps' (engine/core.js) */
  try {
    if (typeof GAME.pwState === 'function') o.groundPainter = GAME.pwState();
    if (typeof GAME.EGL_NW !== 'undefined')
      o.bumpHelper = GAME.EGL_NW.w ? 'on' : GAME.EGL_NW.bad ? 'off' : 'not started';
  } catch (e) {}
  return o;
};
NWLOG.state = () => {
  const s = {};
  try {
    const p = GAME.S.preferences || {};
    s.preferences = {
      theme: p.theme || 'system',
      motion: p.motion || 'system',
      fps: p.fps || 60,
      effects: p.effects || 'full',
      tilt: p.tilt !== false,
    };
    s.started = !!GAME.S.started;
    s.tab = GAME.U.tab;
    s.battle = !!GAME.B;
    s.stop = GAME.S.route ? GAME.S.route.node : null;
    s.trip = GAME.S.route ? GAME.S.route.plan.slice() : [];
    s.tripProgress = GAME.S.route ? GAME.S.route.prog : 0;
    s.scene = typeof GAME.DIO !== 'undefined' ? GAME.DIO.id : null;
    s.team = GAME.S.team ? GAME.S.team.length : 0;
    s.encounters = GAME.S.queue ? GAME.S.queue.length : 0;
    s.badges = (GAME.S.seats || []).length;
    s.visited = Object.keys(GAME.S.visited || {}).length;
    s.frameHz = GAME.FRAME.hz;
    s.fpsCap = GAME.userFps();
  } catch (e) {
    s.error = String(e.message || e);
  }
  return s;
};
/* v30: more to go on: the hour and weather, every setting, the scene's contents, caches, memory, long tasks,
   how long frames take, and the GPU's extensions */
NWLOG.long = { n: 0, total: 0, max: 0, last: [] };
try {
  new PerformanceObserver(l => {
    for (const e of l.getEntries()) {
      const L = NWLOG.long;
      L.n++;
      L.total += e.duration;
      L.max = Math.max(L.max, e.duration);
      const why =
        NWLOG.blame(e.startTime, e.startTime + e.duration) || 'unknown (script or layout outside the marked jobs)';
      L.last.push([Math.round(e.startTime - NWLOG.t0), Math.round(e.duration), why]);
      if (L.last.length > 40) L.last.shift();
    }
  }).observe({ type: 'longtask', buffered: true });
} catch (e) {}
NWLOG.more = () => {
  const o = {};
  const t = (k, f) => {
    try {
      o[k] = f();
    } catch (e) {
      o[k] = 'error: ' + String(e.message || e).slice(0, 80);
    }
  };
  t('account', () => (typeof GAME.ACC !== 'undefined' && GAME.ACC.user ? 'signed in' : 'this browser'));
  t('preferences', () => Object.assign({}, GAME.S.preferences || {}));
  t('saveBytes', () => JSON.stringify(GAME.S).length);
  t('time', () =>
    typeof GAME.ENV !== 'undefined'
      ? {
          on: GAME.ENV.on,
          hour: +GAME.ENV.tod.toFixed(2),
          weather: GAME.ENV.weather,
          season: GAME.ENV.season,
          climate: GAME.ENV.climate,
          night: +(GAME.ENV.night || 0).toFixed(2),
          lamps: +(GAME.ENV.lampK || 0).toFixed(2),
          forced: GAME.ENV.force || null,
        }
      : null
  );
  t('scene', () => {
    if (typeof GAME.DIO === 'undefined' || !GAME.DIO.sc) return null;
    const sc = GAME.DIO.sc;
    return {
      id: GAME.DIO.id,
      size: [sc.w, sc.h],
      props: (sc.props || []).length,
      life: typeof GAME.LIFE !== 'undefined' ? GAME.LIFE.list.map(c => c.k).join(' ') : '',
      folk: (GAME.DIO.folk || []).length,
      water: (GAME.DIO.water || []).length,
      ladders: (sc.props || []).filter(p => p.act === 'climb').length,
      resolution: GAME.DIO.R,
      inside: GAME.U.inside ? GAME.U.inside.id : null,
      room: !!sc.room,
    };
  });
  t('caches', () => ({
    people: typeof GAME.TR_CACHE !== 'undefined' ? GAME.TR_CACHE.size : null,
    lifeFrames: typeof GAME.LIFE !== 'undefined' ? GAME.LIFE.cut.size : null,
    normalsWaiting: typeof GAME.EGL !== 'undefined' && GAME.EGL.normQ ? GAME.EGL.normQ.length : null,
    targets: typeof GAME.EGL !== 'undefined' ? Object.keys(GAME.EGL.fb || {}).length : null,
    prints: typeof GAME.DGL !== 'undefined' && GAME.DGL.prints ? GAME.DGL.prints.length : 0,
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
    count: NWLOG.long.n,
    totalMs: Math.round(NWLOG.long.total),
    maxMs: Math.round(NWLOG.long.max),
    last: NWLOG.long.last,
  }));
  t('slowFramesBy', () =>
    Object.fromEntries(
      Object.entries(NWLOG.causes)
        .sort((a, b) => b[1].ms - a[1].ms)
        .slice(0, 16)
        .map(([k, v]) => [k, { frames: v.n, totalMs: Math.round(v.ms), worstMs: Math.round(v.max) }])
    )
  );
  t('slowFrames', () => NWLOG.slow.slice(-30));
  t('frameMs', () =>
    typeof GAME.DGL !== 'undefined' && GAME.DGL.hist
      ? {
          under8: GAME.DGL.hist[0],
          under16: GAME.DGL.hist[1],
          under33: GAME.DGL.hist[2],
          under66: GAME.DGL.hist[3],
          under133: GAME.DGL.hist[4],
          over133: GAME.DGL.hist[5],
        }
      : null
  );
  t('glExtensions', () =>
    typeof GAME.EGL !== 'undefined' && GAME.EGL.gl ? GAME.EGL.gl.getSupportedExtensions() : null
  );
  t('audio', () =>
    typeof GAME.AUD !== 'undefined' && GAME.AUD.ctx
      ? {
          state: GAME.AUD.ctx.state,
          rate: GAME.AUD.ctx.sampleRate,
          song: GAME.AUD.song ? GAME.AUD.song.name : null,
          worldBeds: typeof GAME.AMB !== 'undefined' ? Object.keys(GAME.AMB.beds).length : 0,
        }
      : null
  );
  t('today', () =>
    typeof GAME.chalToday === 'function' && GAME.S.started
      ? { challenges: GAME.chalToday().list.map(c => [c.k, c.have, c.need, c.claimed]), stamps: GAME.stampCount() }
      : null
  );
  return o;
};
NWLOG.build = () => ({
  game: 'Pocket Billies',
  kind: 'debug-log',
  format: 1,
  build: NW_BUILD,
  dataVersion: (GAME.GD.meta && GAME.GD.meta.version) || null,
  artVersion: (GAME.GD.meta && GAME.GD.meta.artVersion) || 0,
  created: new Date().toISOString(),
  uptimeSec: Math.round(NWLOG.now() / 1000),
  device: NWLOG.device(),
  graphics: NWLOG.glInfo(),
  state: NWLOG.state(),
  more: NWLOG.more(),
  load: NWLOG.load,
  summary: NWLOG.summary(),
  bench: (NWLOG.bench && NWLOG.bench.result) || null,
  errors: NWLOG.err,
  events: NWLOG.ev,
  samples: NWLOG.samples,
  screenshot: NWLOG.shot,
});
/* save it: the share sheet on phones (send it to yourself, or to Files), a download elsewhere, the clipboard as a last resort */
async function exportDebugLog() {
  /* take a current picture first: the WebGL scene hands it over on its next frame */
  if (typeof GAME.DGL !== 'undefined' && GAME.DGL.on && typeof GAME.DIO !== 'undefined' && GAME.DIO.ready) {
    const t0 = NWLOG.shot && NWLOG.shot.t;
    NWLOG.snap();
    for (let i = 0; i < 25 && GAME.DGL.snapReq; i++) await new Promise(r => setTimeout(r, 60));
  }
  let data;
  try {
    data = JSON.stringify(NWLOG.build());
  } catch (e) {
    GAME.toast('Couldn’t build the debug log: ' + (e.message || e));
    return;
  }
  const d = new Date(),
    pad = n => String(n).padStart(2, '0'),
    name = `pocket-billies-debug-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  NWLOG.add('export', name);
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
NWLOG.hook = () => {
  if (NWLOG.hooked) return;
  NWLOG.hooked = true;
  const wrap = (name, fn) => {
    const o = GAME[name];
    if (typeof o !== 'function') return;
    GAME[name] = function (...a) {
      try {
        fn(...a);
      } catch (e) {}
      return o.apply(this, a);
    };
  };
  let lastTab = null;
  wrap('render', () => {
    const v = typeof GAME.B !== 'undefined' && GAME.B ? 'battle' : GAME.U.tab;
    if (v !== lastTab) {
      lastTab = v;
      NWLOG.add('screen', v);
    }
  });
  wrap('newBattle', kind =>
    NWLOG.add('battle', `start ${kind}${typeof GAME.areaKey === 'function' ? ' at ' + GAME.areaKey() : ''}`)
  );
  wrap('endBattle', () => NWLOG.add('battle', 'end ' + ((GAME.B && GAME.B.over) || '')));
  wrap('dioMount', (cv, id, opt) => NWLOG.add('scene', `mount ${id}`));
  wrap('setTrip', j =>
    NWLOG.add('travel', `trip to ${typeof GAME.ROUTE !== 'undefined' && GAME.ROUTE[j] ? GAME.ROUTE[j].name : j}`)
  );
  wrap('openShop', id => NWLOG.add('shop', id));
  wrap('mapMount', () => NWLOG.add('map', 'open'));
  /* v33: costly jobs leave marks (see NWLOG.blame) */
  const timed = (name, label) => {
    const o = GAME[name];
    if (typeof o !== 'function' || o.__nwT) return;
    const f = function (...a) {
      const t0 = performance.now();
      try {
        return o.apply(this, a);
      } finally {
        NWLOG.mark(label, t0, performance.now());
      }
    };
    f.__nwT = 1;
    GAME[name] = f;
  };
  for (const [n, l] of [
    ['dioMount', 'opening a scene'],
    ['dioPrepare', 'preparing a scene'],
    ['render', 'drawing the menus'],
    ['renderOv', 'drawing a window'],
    ['save', 'saving'],
    ['p3dBuild', 'building a solid prop'],
    ['p3dTreeBuild', 'building a 3D tree'],
    ['mmBuild', 'building a map miniature'],
    ['eglPrograms', 'compiling shaders'],
    ['eglFinish', 'finishing a shader'],
    ['eglNormal', 'working out a bump map'],
    ['eglNormWork', 'handing bump maps to the helper'],
    ['dglGroundAO', 'shading the ground'],
    ['dglBuildGrass', 'planting the grass'],
    ['bldItems', 'building 3D buildings'],
    ['openBattle', 'opening a battle'],
    ['scStart', 'setting up the battle stage'],
    ['scResize', 'laying out the battle'],
    ['paintActions', 'drawing the battle menu'],
    ['humanFrames', 'drawing a person'],
    ['mglRender', 'drawing the map'],
    ['csStart', 'starting the opening'],
    ['openDressing', 'opening the dressing room'],
    ['artPixels', 'reading a picture'],
  ])
    timed(n, l);
  /* the renderer's own sections, timed every frame */
  for (const [n, l, m] of [
    ['dglItems', 'items'],
    ['dglShadowPass', 'shadows'],
    ['dglSprites', 'sprites'],
    ['dglGrass', 'grass'],
    ['p3dDraw', 'solid props'],
    ['bldDraw', 'buildings'],
    ['eglPost', 'post'],
    ['dglGround', 'ground'],
    ['dglReflPass', 'reflections'],
    ['dglWater', 'water'],
    ['dglFxPass', 'effects'],
    /* alpha 0.2: the rest of a frame's work, so a slow frame names it (a slow frame used to say only "drawing") */
    ['dglRingUpdate', 'near ring', 'painting the ground nearby'],
    ['dglGrassWork', 'grass rows', 'planting the grass'],
    ['dioPlayer', 'walking', 'moving you'],
    ['dioFolkTick', 'folk', 'moving the townsfolk'],
    ['lifeStep', 'animals', 'moving the animals'],
  ]) {
    const o = GAME[n];
    if (typeof o !== 'function' || o.__nwP) continue;
    const f = function (...a) {
      const t0 = performance.now();
      try {
        return o.apply(this, a);
      } finally {
        const d = performance.now() - t0;
        NWLOG.time(l, d);
        if (d > 12) NWLOG.mark(m || 'drawing ' + l, t0, t0 + d);
      }
    };
    f.__nwP = 1;
    GAME[n] = f;
  }
};
/* v33: everything a test needs to explain a result: what's on screen, what the renderer is doing, what went wrong lately */
NWLOG.diag = (since = 0) => {
  const o = {};
  const t = (k, f) => {
    try {
      o[k] = f();
    } catch (e) {
      o[k] = '?';
    }
  };
  t('view', () =>
    typeof GAME.B !== 'undefined' && GAME.B
      ? `battle ${GAME.B.kind}/${GAME.B.fmt || 'single'} (${GAME.B.phase})`
      : typeof GAME.U !== 'undefined'
        ? GAME.U.tab
        : '-'
  );
  t('scene', () => (typeof GAME.DIO !== 'undefined' ? GAME.DIO.id + (GAME.DIO.ready ? '' : ' (loading)') : null));
  t('renderer', () =>
    typeof GAME.DGL !== 'undefined'
      ? GAME.DGL.on
        ? `webgl q${GAME.DGL.q || 0} res ${Math.round((GAME.DIO.R || 1) * 100)}% · ${GAME.DGL.frames} frames`
        : 'canvas'
      : '-'
  );
  t('drawn', () =>
    typeof GAME.DGL !== 'undefined' && GAME.DGL.on
      ? {
          skipped: GAME.DGL.cullOf ? `${GAME.DGL.culled}/${GAME.DGL.cullOf}` : null,
          buildings: typeof GAME.BLD !== 'undefined' ? GAME.BLD.drawn : null,
          solid: typeof GAME.P3D !== 'undefined' ? GAME.P3D.drawn : null,
          grass: GAME.DGL.grassDrawn || null,
        }
      : null
  );
  t('slow', () =>
    NWLOG.slow
      .filter(x => x.t >= since)
      .map(x => `${x.ms} ms (${x.why})`)
      .slice(-6)
  );
  t('long', () =>
    NWLOG.long.last
      .filter(x => x[0] >= since)
      .map(x => `${x[1]} ms (${x[2]})`)
      .slice(-6)
  );
  t('errors', () =>
    NWLOG.err
      .filter(x => x.t >= since)
      .map(
        x =>
          x.msg.slice(0, 160) +
          (x.stack ? ' @ ' + String(x.stack).split('\n').slice(1, 2).join('').trim().slice(0, 120) : '')
      )
      .slice(-5)
  );
  t('events', () =>
    NWLOG.ev
      .filter(x => x.t >= since)
      .slice(-5)
      .map(x => x.kind + ': ' + x.msg)
  );
  t('mb', () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
  return o;
};
/* the full test (Settings → Run the full test) is in selftest.js */
