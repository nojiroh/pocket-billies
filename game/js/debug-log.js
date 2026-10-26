'use strict';
/* ================= DEBUG LOG =================
   Quietly records what helps fix problems on a particular device: frame rates per screen and scene, slow frames,
   errors, the loading screen's timings, the device and graphics chip, and a small picture of the scene every few
   seconds. Settings → Export debug log saves it as one JSON file (or shares it on phones). Settings → Run the full
   test (self-test.js) plays through everything for about two minutes, stress-tests the device and adds the results.
   Nothing here leaves the device unless the player exports it. No save data or names are included, and no positions: only which places opened and when. */
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
debugLog.gc = { ts: 0, heap: 0, n: 0, freed: 0 }; /* phase 20: see debugLog.task */
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
  /* phase 20: a rough sign of garbage-collection hitches (Chrome only, whose heap figure is coarse and late): a gap of
     more than 45 ms between ticks while the heap shrank */
  if (performance.memory && debugLog.gc.ts !== ts) {
    const G = debugLog.gc,
      h = performance.memory.usedJSHeapSize;
    if (G.ts && ts - G.ts > 45 && h < G.heap) {
      G.n++;
      G.freed += G.heap - h;
    }
    G.ts = ts;
    G.heap = h;
  }
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
      /* phase 20: the point lights in the frame, and how many of them cast a shadow map */
      const X = GAME.walkRenderer.X;
      if (X && X.lights) c.lit = [X.lights.length, (X.lampSh || []).length];
    }
    /* phase 20: one frame's graphics calls, counted once a second (engine/gpu-counters.js): draws, instances, program
       switches, texture binds, uniform calls; the draws of each pass; KB uploaded (textures, buffers) */
    if (typeof GAME.gpuCountSummary === 'function' && performance.now() - GAME.gpuCounters.lastT < 2000) {
      const g = GAME.gpuCountSummary();
      if (g) {
        c.dc = g.dc;
        c.dcp = g.dcp;
        c.up = g.up;
        /* R1 measure: each pass's draws of models and of model pictures (`dct`), and its distinct textures and vertex
           arrays (`dcu`: the fewest draws grouping could reach) */
        if (g.dct && Object.keys(g.dct).length) c.dct = g.dct;
        if (g.dcu) c.dcu = g.dcu;
      }
    }
    if (typeof GAME.gpuState !== 'undefined' && GAME.gpuState.pcl && (GAME.gpuState.pcl[0] || GAME.gpuState.pcl[1]))
      c.pcl = GAME.gpuState.pcl.slice();
    if (typeof GAME.gpuState !== 'undefined' && GAME.gpuState.gpuMs)
      c.gpu = [Math.round(GAME.gpuState.gpuMs * 10) / 10, Math.round(GAME.gpuState.gpuMax || 0)];
    /* phase 20 H3: the graphics card's memory in all, MB (what it holds by kind is in the report's gpuMemory) */
    if (typeof GAME.gpuRes !== 'undefined') {
      let b = 0;
      for (const k in GAME.gpuRes.bytes) b += GAME.gpuRes.bytes[k];
      if (b) c.gmb = Math.round(b / 1048576);
    }
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
  if (debugLog.gc.n) {
    s.alloc = [debugLog.gc.n, Math.round(debugLog.gc.freed / 1048576)];
    debugLog.gc.n = debugLog.gc.freed = 0;
  }
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
    /* SP-1: the grafted Billies baked on this device (skeleton-rig.js graftReport): bake times and memory */
    if (typeof GAME.graftReport === 'function') o.grafts = GAME.graftReport();
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
    s.scene = typeof GAME.walkView !== 'undefined' ? GAME.walkView.id : null;
    s.team = GAME.saveData.team ? GAME.saveData.team.length : 0;
    s.encounters = GAME.encountersHere ? GAME.encountersHere().length : 0;
    /* SP-2: the team's splices (species and data ids, no names): Stability, traits, types */
    if (typeof GAME.spliceReport === 'function') s.splices = GAME.spliceReport();
    s.badges = (GAME.saveData.seats || []).length;
    s.visited = Object.keys(GAME.saveData.visited || {}).length;
    /* RL-7: on a run, where it stands (no names): its seed (to make the same run again), the day, the
       map node you are on, the arrivals so far, and its world's scenes and how long they took to make on this device */
    const run = GAME.saveData.run,
      /* TR-2: the place's land dials are on its map (the drawn scene has no gen) */
      placeMap = (GAME.gameData.maps || {})[(GAME.walkView.sc || {}).baseId || GAME.walkView.id],
      placeLand = (placeMap && placeMap.gen && placeMap.gen.params && placeMap.gen.params.land) || {};
    s.run =
      run && run.map
        ? {
            seed: run.seed,
            day: run.clock,
            node: GAME.saveData.trip.node - 1,
            arrivals: run.path.length,
            nodes: run.map.nodes.length,
            scenes: GAME.runWorld.scenes,
            makeMs: GAME.runWorld.ms,
            /* RL-8: its phase (fly, walk, battle, payout), the battles fought, whether saving is held for a battle, the
               party's size and the run's money (numbers only) */
            phase: run.at.phase,
            battles: run.battleN,
            /* RL-13: the run's Expedition and the highest one open (its challenges are in `mods`) */
            expedition: run.expedition || 1,
            expeditionOpen: (GAME.saveData.meta && GAME.saveData.meta.expedition) || 1,
            held: typeof GAME.saveHeld === 'function' ? GAME.saveHeld() : null,
            party: GAME.saveData.team ? GAME.saveData.team.length : 0,
            money: GAME.saveData.se,
            /* RL-9b: how many Billies came from home and how many things were packed (counts only) */
            home: Array.isArray(run.home) ? run.home.length : null,
            packed: run.pack
              ? [run.pack.items, run.pack.pyramids].reduce(
                  (a, r) => a + Object.values(r || {}).reduce((b, n) => b + (+n || 0), 0),
                  0
                )
              : null,
            /* TR-2: the run's mods (dbg_mountains: the debug menu's mountains run), this place's mountains dial and
               its ground's triangles (the land and the step grid's walls; to weigh frame times against) */
            mods: (run.mods || []).slice(),
            /* Studio plan T2.6: the unlocks the run carries (unlocks.json ids: they choose its biomes and shop wares),
               so the Studio's Run Lab draws this run's map from the log */
            unlocks: (run.unlocks || []).slice(),
            mountains: placeLand.mountains || 0,
            groundTris: GAME.walkRenderer && GAME.walkRenderer.mesh ? Math.round(GAME.walkRenderer.mesh.n / 3) : null,
            /* TR-3: the camera's extra tilt on tall ground right now (degrees) */
            camRise: GAME.walkRenderer && GAME.walkRenderer.occT != null ? +GAME.walkRenderer.occT.toFixed(1) : null,
            /* RL-12: the Perks held (perks.json ids, not names), the pick waiting (how many) and offers made */
            relics: (run.perks || []).slice(),
            offer: run.offer ? run.offer.length : 0,
            offers: run.offerN || 0,
            /* RL-12b: events (ids played, the one playing, draws so far), the boons on, reward picks made and the
               one waiting (how many cards, rerolls), the route trainer walking up */
            events: run.enc
              ? {
                  seen: run.enc.seen.slice(),
                  playing: run.enc.play ? run.enc.play.id + ':' + run.enc.play.opt : null,
                  draws: run.enc.n,
                  boons: run.enc.boons.map(b => b.src + ':' + b.left),
                  rewards: run.enc.rewardN,
                  reward: run.enc.reward ? { cards: run.enc.reward.cards.length, rolls: run.enc.reward.rolls } : null,
                }
              : null,
            spottedBy: GAME.routeSight ? GAME.routeSight.busy || null : null,
            /* RT-2: this place's route trainers: id, the spot kind it stands on, r(equired) or o(ptional), a pair,
               beaten (ids and kinds only) */
            routeTrainers: Object.values(GAME.TRAINERS || {})
              .filter(T => T.route && T.runNode === GAME.saveData.trip.node - 1)
              .map(
                T =>
                  `${T.id}:${T.route.spot || '?'}:${T.route.opt ? 'o' : 'r'}${T.mate ? ':pair' : ''}${GAME.saveData.flags[T.id] ? ':beaten' : ''}`
              ),
            /* RT-3: this place's set pieces (setPieces.json ids) and the spot kind each took */
            pieces: ((placeMap && placeMap.pieces) || []).map((/** @type {any} */ L) => `${L.id}:${L.spot}`),
            /* RT-4: how many habitat points this place has (water, woods), and its wild Billies by habitat (species
               ids, levels, the rarer one marked; read, never stocked here) and where its rarer one waits */
            habitats:
              placeMap && placeMap.habitats
                ? Object.fromEntries(
                    Object.entries(placeMap.habitats).map(([k, L]) => [k, /** @type {any[]} */ (L).length])
                  )
                : null,
            wild: (
              ((GAME.saveData.wild || {})[((GAME.LOCATIONS || [])[GAME.saveData.trip.node] || {}).id] || {}).list || []
            ).map((/** @type {any} */ q) => `${q.sp}:${q.lvl}:${q.rare ? 'rare' : q.hab || 'grass'}`),
            rareAt: ((GAME.LOCATIONS || [])[GAME.saveData.trip.node] || {}).rareAt || null,
          }
        : null;
    /* RL-8: what the runs brought home (numbers only) */
    const meta = GAME.saveData.meta;
    s.meta = meta
      ? {
          runs: meta.runs,
          wins: meta.wins,
          capital: meta.research,
          seals: meta.crests,
          scrap: meta.scrap,
          dna: meta.dna,
          /* SP-3: how many Genes are sampled (the codes are data ids, but a count is enough) */
          genes: (meta.genes || []).length,
          /* RL-11: the unlock ids owned (game data ids, no names) and the buildings' levels */
          unlocks: Object.keys(meta.unlocks || {}).sort(),
          buildings: Object.assign({}, meta.buildings || {}),
          /* RS-1: who lives in Copperleaf (residents.json ids, no names) */
          residents: Object.keys(meta.residents || {}).sort(),
          /* RL-S1: the run history (game data ids and numbers, no names) and the story director's picks */
          history: (meta.history || []).length,
          last: (meta.history || []).length
            ? (h => ({ end: h.end, by: h.by ? [h.by.kind, h.by.id || ''].join(':') : null, row: h.row }))(
                meta.history[meta.history.length - 1]
              )
            : null,
          fresh: Object.assign({}, (GAME.saveData.story && GAME.saveData.story.fresh) || {}),
          pending: (GAME.saveData.story && GAME.saveData.story.pending) || null,
          /* RL-S2 (numbers and ids only): Beans, points with each hub person, the gifts given since the last run, the
             chapter, Blake's last result kept and this run's record of him (the lead's species, meetings, wins) */
          beans: meta.beans || 0,
          rel: Object.assign({}, meta.rel || {}),
          gifted: Object.keys(meta.gifted || {}).filter(k => (meta.gifted || {})[k] === meta.runs),
          chapter: meta.chapter || 1,
          rival: (meta.history || []).length ? meta.history[meta.history.length - 1].rival || null : null,
          runRival: GAME.saveData.run && GAME.saveData.run.rival ? Object.assign({}, GAME.saveData.run.rival) : null,
        }
      : null;
    /* RL-9: the ranch (numbers only): its level, how many train, how long since each started (hours), storage's size */
    const ranch = GAME.saveData.ranch;
    s.ranch = ranch
      ? {
          level: (meta && meta.buildings && meta.buildings.ranch) || 1,
          training: ranch.trainees.length,
          hours: ranch.trainees.map(t => +((Date.now() - t.at) / 3600000).toFixed(1)),
          stored: (GAME.saveData.box || []).length,
          /* RL-10: the nursery (numbers only): each egg's mode and hours left, and how many pairs have bred */
          eggs: (ranch.nursery || []).map(n => [n.mode, +Math.max(0, (n.ready - Date.now()) / 3600000).toFixed(1)]),
          bred: ranch.bred || 0,
          /* RL-10b (numbers only): the income waiting (whole Scrap banked, hours since it was counted; null before it
             started), how far the device's clock is behind the ranch clock's mark (hours; > 0 means turned back), and
             the clock against the server this session (skew in hours, or null when not measured) */
          income: ranch.income
            ? [
                ranch.income.bank,
                ranch.income.lastAt ? +((Date.now() - ranch.income.lastAt) / 3600000).toFixed(1) : null,
              ]
            : null,
          behind: +Math.max(0, ((ranch.seen || 0) - Date.now()) / 3600000).toFixed(2),
          skew: GAME.account && GAME.account.clock === 'known' ? +((GAME.ranchSkew || 0) / 3600000).toFixed(2) : null,
          /* IS-8: how many of them wander in the hub's pasture right now (a count only) */
          pasture:
            typeof GAME.worldBillies !== 'undefined' && GAME.worldBillies.pasture
              ? Object.keys(GAME.worldBillies.pasture.mons).length
              : 0,
        }
      : null;
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
      /* island track IS-1: the orbit camera now (degrees: its yaw, 0 looking north; your turn on top; held still on
         the summit) */
      orbit: (() => {
        const R = typeof GAME.walkRenderer !== 'undefined' ? GAME.walkRenderer : null,
          S = R && R.orbit;
        if (!S) return null;
        const d = v => Math.round(((((v * 180) / Math.PI + 180) % 360) + 360) % 360) - 180;
        return { yaw: d(S.yaw), turn: d(R.yaw || 0), hold: !!S.hold, stickLocked: !!S.lock };
      })(),
    };
  });
  /* CAM-1: what the walking camera is doing: its mode (walk, indoor, room, swoop, free), zoom, turn, tilt, the rise on
     tall ground, the goals in play with their weights, the look-ahead and how far the aim is from its goal (metres).
     CAM-2: the zoom the camera uses (yours times the goals'), the moment (talk, boss, interest, idle, run, or none),
     the points of interest in reach and the strongest's weight, the camera zone you stand in (its index, -1 for none)
     and how long you have stood still (seconds). CAM-4b: the zoom stop nearest and the one last gone to. Player
     visibility: how hidden you are. Only numbers and ids, no names */
  t('camera', () => {
    const W = typeof GAME.walkRenderer !== 'undefined' ? GAME.walkRenderer : null,
      I = W && W.camInfo,
      T = W && W.camT,
      C = typeof GAME.walkView !== 'undefined' ? GAME.walkView.C : null;
    if (!I || !T) return null;
    const r = v => +v.toFixed(2);
    return {
      mode: I.mode,
      zoom: r(W.zoom),
      yaw: C && C.yaw != null ? r((C.yaw * 180) / Math.PI) : null,
      pitch: C && C.sp != null ? r((Math.asin(C.sp) * 180) / Math.PI) : null,
      rise: W.occT != null ? r(W.occT) : null,
      /* player visibility: how hidden you are (0-1: something nearer the camera covers you) */
      hidden: W.hidK != null ? r(W.hidK) : null,
      goals: I.goals.map(([id, w]) => [id, r(w)]),
      lead: [r(I.lead[0]), r(I.lead[1])],
      off: [r(I.goal[0] - T[0]), r(I.goal[1] - T[1])],
      moving: r(I.move),
      zoomEff: I.zoom != null ? r(I.zoom) : null,
      /* CAM-4b: the zoom stop nearest your zoom, and the stop you last went to (a two-finger tap, Z, R, a pull or a
         scene's start; ids only) */
      stop: I.stop ?? null,
      pulled: W.stopAt ?? null,
      moment: I.moment ?? null,
      interest: I.interest ? [I.interest[0], r(I.interest[1])] : null,
      zone: I.zone ?? -1,
      still: W.mom ? r(W.mom.still) : null,
    };
  });
  /* CAM-3: the blur this frame: its path (full, fast, cheap, off), what the focus is on (you, tap, talk, encounter,
     boss, battle), the focus distance, how far the focus leans from you, the tilt, the blur in use and the player's
     slider (no names, no places) */
  t('lens', () => {
    const W = typeof GAME.walkRenderer !== 'undefined' ? GAME.walkRenderer : null,
      L = W && W.lensInfo;
    if (!L) return null;
    const r = v => +(+v).toFixed(2),
      lean = W.focusLean || [0, 0];
    return {
      path: L.path,
      on: L.on,
      focus: r(L.focus),
      lean: [r(lean[0]), r(lean[1])],
      tilt: r(L.tilt),
      blur: r(L.blur),
      slider: r(L.slider),
    };
  });
  t('caches', () => ({
    people: typeof GAME.PERSON_ART_CACHE !== 'undefined' ? GAME.PERSON_ART_CACHE.size : null,
    lifeFrames: typeof GAME.ambientLife !== 'undefined' ? GAME.ambientLife.cut.size : null,
    normalsWaiting: typeof GAME.gpuState !== 'undefined' && GAME.gpuState.normQ ? GAME.gpuState.normQ.length : null,
    targets: typeof GAME.gpuState !== 'undefined' ? Object.keys(GAME.gpuState.fb || {}).length : null,
    prints: typeof GAME.walkRenderer !== 'undefined' && GAME.walkRenderer.prints ? GAME.walkRenderer.prints.length : 0,
  }));
  /* air track AIR-2: the fog grid (walk/fog-grid.js): its size, how often it was built, refilled and rolled, and the
     time per upload and per fill (ms; the uploads' CPU side) */
  t('fogGrid', () => (typeof GAME.fogGridReport === 'function' ? GAME.fogGridReport() : null));
  /* phase 20 H3: the graphics card's memory by kind (engine/webgl.js gpuMemory: MB, objects, objects dropped without
     being freed, the sign of a leak), the picture cap's own count, and how many contexts this session made */
  t('gpuMemory', () =>
    typeof GAME.gpuMemory === 'function'
      ? {
          kinds: GAME.gpuMemory(),
          picturesCapMB: GAME.gpuState.texB ? Math.round(GAME.gpuState.texB / 1048576) : 0,
          trimmed: GAME.gpuState.texTrimmed || 0,
          contexts: GAME.gpuState.made || 0,
          /* H5: the programs compiled after a place had settled (pcl's names): each one a warm-up missed */
          lateCompiles: (GAME.gpuState.pclNames || []).slice(),
        }
      : null
  );
  /* phase 08b: the walking world: map files (loaded, time, failed, whole of all), the views kept, and how crossings
     went (waited for the next view, built on the spot, made ready ahead) */
  t('world', () => {
    const F = typeof GAME.mapFiles !== 'undefined' ? GAME.mapFiles : null,
      W = typeof GAME.seamlessWorld !== 'undefined' ? GAME.seamlessWorld : null,
      maps = typeof GAME.gameData !== 'undefined' ? Object.values(GAME.gameData.maps || {}) : [];
    return {
      mapFiles: F ? { loaded: F.n, ms: Math.round(F.ms), failed: F.failed.length } : null,
      mapsWhole: maps.filter(m => !m._lite).length + ' of ' + maps.length,
      viewsKept: W ? W.cache.size : null,
      crossings: W && W.stats ? Object.fromEntries(Object.entries(W.stats).map(([k, v]) => [k, Math.round(v)])) : null,
    };
  });
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
  return o;
};
debugLog.build = () => ({
  game: 'Pocket Billies',
  kind: 'debug-log',
  format: 1,
  build: BUILD_VERSION,
  /* which deploy (vite.config.js stampBuild: the commit; '' when not the built site) */
  deploy: self.PB_BUILD || '',
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
    ['worldBowlRender', 'drawing the map'],
    ['cutsceneStart', 'starting the opening'],
    ['openDressingRoom', 'opening the dressing room'],
    ['artPixels', 'reading a picture'],
    /* a place's opening hitch was mostly "outside the marked steps": the ground built for the new place, the walkable
       grid, and the debug log's own screenshot (reading the frame back makes the GPU finish it) */
    ['swapMapCache', 'setting up the ground'],
    ['buildGroundMesh', 'building the ground mesh'],
    ['navGrid', 'working out where you can walk'],
    ['screenSnapshot', 'reading the picture back'],
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
    /* phase 20: the diagnostics' and the Graphics test's pass timers (self-test.js DIAGNOSTICS_PASSES) reach a function
       only through this list, so every name there is here too */
    ['drawPropModels', 'models'],
    ['drawBoxFaces', 'box faces'],
    ['drawStructures', 'structures'],
    ['drawPlayerSilhouette', 'silhouette'],
    ['drawPostEffects', 'post'],
    /* CAM-3: the blur and the rest of the post chain, apart (inside drawPostEffects) */
    ['drawDepthOfField', 'blur'],
    ['drawPostRest', 'post rest'],
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
