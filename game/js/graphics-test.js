'use strict';
/* ================= GRAPHICS TEST =================
   The debug menu → Graphics test. Made to be run by a person, by hand, on their own device: it is not part of any
   check, CI job or hook. It loads only when it starts (settings-screen.js, startGraphicsTest), and reaches the game
   only through what that hands it (G), so it has no imports.
   TD-2 (docs/phases/test-data-track.md): it walks the benchmark path (logic/bench-path.js, G.bench; bench-walk.js,
   G.walk) instead of standing still:
   1. every shader program compiles, with no two inputs on one location (as the full test's Shaders phase checks),
   2. a warm-up lap, unmeasured, then each segment (water, behind the houses, grass, lamps at night, fog, rain, a
      room...) walked as shipped, then once for each engine dial that needs what it shows, at one other value; a dial
      nothing on the path shows is listed with the reason, never as an OK. Automatic quality is off and the resolution
      pinned, so a step measures its dial and nothing else,
   3. the graphics presets (with automatic quality on, as players have them) and each engine preset.
   Graphics memory stays under the 300 MB budget: a step whose guess passes it is skipped as "over budget", and a walk
   that passes it stops and goes back. Every step is saved (localStorage, numbers only), so after a reload the next tap
   on the button offers to resume or to save the partial report.
   The save is never changed (saving is paused and the save is put back, as in self-test.js), and the player's own
   graphics settings are put back when the test ends, is stopped or fails. The report it saves holds no save data,
   names or movement history: only dial names, segment ids, numbers, errors and the graphics chip; a last row checks it
   for names. */

const STATE_KEY = 'pb-gtest';

/* the names the report must never hold: the planted fixture names, the trainer's name and every Billie's nickname */
export function graphicsNames(save, planted) {
  const names = new Set(Object.values(planted || {}));
  if (save && save.avatar && save.avatar.name) names.add(save.avatar.name);
  const walk = v => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(walk);
    for (const [k, x] of Object.entries(v)) {
      if (k === 'nick' && typeof x === 'string') names.add(x);
      else walk(x);
    }
  };
  walk(save);
  return [...names].filter(n => typeof n === 'string' && n.trim().length >= 3);
}
export function graphicsNamesIn(text, names) {
  const t = String(text).toLowerCase();
  return names.filter(n => t.includes(n.toLowerCase()));
}
/* a step's mean frame in ms (1000 / fps: fps is frames over their summed gaps, bench-path.js benchFrameStats). Costs
   and drift are worked from it, not the median (p50): on a phone held to the screen's rate, frames come in whole
   refresh intervals (16.7 / 33.3 / 50 ms at 60 Hz), so the median stays 16.7 while fps falls, and every cost, its
   noise and the drift read 0. The mean moves with the share of frames that miss. */
export const GRAPHICS_COST_FROM = 'mean frame ms (1000 / fps)';
export function graphicsFrameMs(s) {
  return s && typeof s.fps === 'number' && s.fps > 0 ? Math.round((1000 / s.fps) * 100) / 100 : null;
}
/* per dial, what its other value cost over its segment as shipped (ms a frame, from the mean frame), with the
   segment's own wandering (its shipped runs, first and last) so a cost inside it reads as unsure */
export function graphicsCosts(steps) {
  const base = {};
  for (const s of steps) {
    const ms = graphicsFrameMs(s);
    if (s.kind === 'base' && ms != null && !s.drift) (base[s.seg] = base[s.seg] || []).push(ms);
  }
  const r2 = v => Math.round(v * 100) / 100;
  return steps
    .filter(s => s.kind === 'dial' && graphicsFrameMs(s) != null && base[s.seg])
    .map(s => {
      const B = base[s.seg],
        mid = B.reduce((a, b) => a + b, 0) / B.length,
        noise = B.length > 1 ? r2(Math.max(...B) - Math.min(...B)) : null,
        cost = r2(graphicsFrameMs(s) - mid);
      return {
        dial: s.dial,
        seg: s.seg,
        value: s.value,
        shipped: s.shipped,
        cost,
        noise,
        unsure: noise != null && Math.abs(cost) <= noise,
      };
    })
    .sort((a, b) => b.cost - a.cost);
}
/* the heat drift: the open ground's shipped look, each time it was walked again (ms a frame, the mean; its fps too) */
export function graphicsDrift(steps) {
  const R = steps.filter(s => s.kind === 'base' && s.seg === 'open' && graphicsFrameMs(s) != null),
    D = R.map(graphicsFrameMs);
  if (D.length < 2) return null;
  const ch = D[0] ? (D[D.length - 1] - D[0]) / D[0] : 0;
  return {
    first: D[0],
    last: D[D.length - 1],
    fpsFirst: R[0].fps,
    fpsLast: R[R.length - 1].fps,
    runs: D.length,
    change: Math.round(ch * 100),
    drifting: Math.abs(ch) > 0.15,
  };
}
const STEP_KEYS = [
  'kind',
  'seg',
  'dial',
  'value',
  'shipped',
  'preset',
  'drift',
  'ok',
  'notMeasured',
  'notHere',
  'overBudget',
  'reloaded',
  'invalid',
  'frames',
  'fps',
  'p50',
  'p90',
  'p99',
  'worst',
  'jank',
  'cpuMs',
  'fenceLag',
  'draws',
  'instances',
  'programs',
  'gmb',
  'peakMb',
  'guessMb',
  'slow',
  'q',
  'res',
  'seconds',
  'openMs',
  'note',
];
/* the report: conditions, steps, costs and errors; then the planted-name check, whose result is its last row */
export function graphicsReport(r, names) {
  const report = {
    game: 'Pocket Billies',
    kind: 'graphics',
    /* format 4: costs and drift are worked from the mean frame (costFrom), not the median (format 3) */
    format: 4,
    costFrom: GRAPHICS_COST_FROM,
    build: r.build ?? null,
    created: r.created,
    seconds: r.seconds,
    stopped: !!r.stopped,
    passed: false,
    resumed: r.resumed || 0,
    budgetMb: r.budgetMb ?? null,
    res: r.res ?? null,
    groups: r.groups || null,
    device: r.device || null,
    conditions: r.conditions || null,
    steps: r.steps.map(s => {
      const o = { step: s.name };
      for (const k of STEP_KEYS) if (s[k] !== undefined && s[k] !== null) o[k] = s[k];
      if (!s.ok && s.why) o.why = s.why;
      return o;
    }),
    costs: graphicsCosts(r.steps),
    drift: graphicsDrift(r.steps),
    errors: (r.errors || []).slice(0, 12),
  };
  let text = JSON.stringify(report);
  const found = graphicsNamesIn(text, names);
  const check = { step: 'The report holds no names', ok: !found.length };
  if (found.length) {
    /* never let one through: take them out, and say so */
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(found.map(esc).join('|'), 'gi');
    const clean = JSON.parse(text, (k, v) => (typeof v === 'string' ? v.replace(re, '[name]') : v));
    Object.assign(report, clean);
    check.why = `${found.length} name${found.length > 1 ? 's' : ''} found and taken out`;
  }
  report.steps.push(check);
  report.passed = report.steps.every(s => s.ok) && !report.errors.length && !report.stopped;
  return report;
}
/* a step's name in the list */
export function graphicsStepName(p, segName) {
  const v = x => (typeof x === 'boolean' ? (x ? 'on' : 'off') : JSON.stringify(x));
  if (p.kind === 'shaders') return 'Shaders: every program compiles, no clashing inputs';
  if (p.kind === 'notHere') return `${p.label} (${p.dial})`;
  if (p.kind === 'preset') return `Preset: ${p.label}`;
  if (p.kind === 'base') return `${segName}: ${p.label}`;
  return `${segName}: ${p.label} (${p.dial} ${v(p.shipped)} → ${v(p.value)})`;
}

const graphicsTest = { on: false, stop: false, report: null };
const readState = G => {
  try {
    return G.bench.benchStateLoad(localStorage.getItem(STATE_KEY), G.version);
  } catch (e) {
    return null;
  }
};
const writeState = st => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(st));
  } catch (e) {}
};
const dropState = () => {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch (e) {}
};

export async function runGraphicsTest(G) {
  if (graphicsTest.on || G.selfTest.on) return;
  if (G.activeBattle) {
    G.toast('Finish the battle first.');
    return;
  }
  if (!G.saveData.started) {
    G.toast('Start a game first.');
    return;
  }
  const left = readState(G);
  if (left && !left.done) return offerResume(G, left);
  return pickGroups(G);
}

/* after a reload (or a stop): carry on, save what there is, or start again */
function offerResume(G, st) {
  const died = st.running != null ? st.steps.length : null;
  G.modal({
    title: 'The last graphics test didn’t finish',
    html: `<p class="note">It stopped after ${st.steps.length} steps${died != null ? ', while the page reloaded during the next one. That step is marked and skipped, so it can’t reload the page again' : ''}.</p>`,
    btns: [
      { l: 'Resume', c: 'gold', f: () => (G.closeModal(), runPath(G, st)) },
      {
        l: 'Save the partial report',
        c: '',
        f: () => {
          G.closeModal();
          const R = finishReport(G, st, true);
          showGraphicsResults(G, R);
        },
      },
      { l: 'Start again', c: 'quiet', f: () => (G.closeModal(), dropState(), pickGroups(G)) },
    ],
  });
}

/* the groups to run, with the time each takes (the whole path is about 50 minutes) */
function pickGroups(G) {
  const esc = G.escapeHtml,
    B = G.bench,
    groups = G.ENGINE_SPEC.map(([g, label]) => {
      const n = B.benchPlan(G.ENGINE_SPEC, G.ENGINE_DEFAULTS, { groups: [g] });
      return { g, label, min: B.benchMinutes(n), dials: n.filter(p => p.kind === 'dial').length };
    }).filter(x => x.dials);
  const rows = groups
    .map(
      x =>
        `<label class="nb-pick"><input type="checkbox" data-g="${esc(x.g)}" data-min="${x.min}" checked> ${esc(x.label)} <small>${x.dials} settings, about ${x.min} min</small></label>`
    )
    .join('');
  G.modal({
    title: 'Graphics test',
    html: `<p class="note">The test walks a path round the graphics test place: by water, behind houses, through grass, past lamps at night, in fog and rain, into a room. Each setting is walked where it shows. About 15 minutes is a good run; untick groups to shorten it. A run that stops (or reloads the page) can be resumed.</p><div class="nb-picks">${rows}</div><p class="note nb-total"></p>`,
    btns: [
      {
        l: 'Start',
        c: 'gold',
        f: () => {
          const on = [...document.querySelectorAll('.nb-picks input:checked')].map(i => i.dataset.g);
          G.closeModal();
          if (!on.length) return G.toast('Pick at least one group.');
          runPath(G, {
            build: G.version ?? null,
            created: new Date().toISOString(),
            groups: on.length === groups.length ? null : on,
            res: 1,
            at: 0,
            running: null,
            resumed: 0,
            steps: [],
          });
        },
      },
      { l: 'Close', c: 'quiet', f: G.closeModal },
    ],
  });
  const total = () => {
    const el = document.querySelector('.nb-total');
    if (!el) return;
    const m = [...document.querySelectorAll('.nb-picks input:checked')].reduce((a, i) => a + +i.dataset.min, 0);
    el.textContent = `In all about ${m + 2} minutes (with the warm-up lap).`;
  };
  setTimeout(() => {
    total();
    for (const i of document.querySelectorAll('.nb-picks input')) i.onchange = total;
  }, 0);
}

/* the run (new, or resumed from the saved state `st`) */
async function runPath(G, st) {
  if (graphicsTest.on || G.selfTest.on) return;
  const B = G.bench,
    W = G.walk,
    slow = G.selfTest.slow || 1,
    sleep = ms => new Promise(r => setTimeout(r, ms * slow)),
    budget = B.BENCH_BUDGET_MB,
    segs = Object.fromEntries(B.BENCH_SEGMENTS.map(s => [s.id, s])),
    presets = [
      ['aim:smooth', 'Balanced'],
      ['aim:sharp', 'Beautiful'],
      ...Object.entries(G.ENGINE_PRESETS).map(([k, P]) => [k, 'Engine: ' + P.name]),
    ],
    plan = B.benchPlan(G.ENGINE_SPEC, G.ENGINE_DEFAULTS, { groups: st.groups || undefined, presets });
  if (st.at > 0) st.resumed = (st.resumed || 0) + 1;
  /* the step that was running when the page went: marked, never run again */
  if (st.running != null && st.running === st.at && plan[st.at]) {
    const p = plan[st.at];
    st.steps.push({
      ...p,
      name: graphicsStepName(p, (segs[p.seg] || {}).name || p.seg),
      ok: false,
      reloaded: true,
      why: 'the page reloaded during this step',
    });
    st.at++;
  }
  /* a reload during the warm-up lap: that segment's warm-up is skipped from now on, and said so */
  if (st.warmRunning) {
    const seg = segs[st.warmRunning];
    st.skipWarm = [...new Set([...(st.skipWarm || []), st.warmRunning])];
    st.steps.push({
      kind: 'warmup',
      seg: st.warmRunning,
      name: 'Warming up: ' + (seg ? seg.name : st.warmRunning),
      ok: false,
      reloaded: true,
      why: 'the page reloaded during the warm-up walk',
    });
    st.warmRunning = null;
  }
  st.running = null;
  graphicsTest.on = true;
  graphicsTest.stop = false;
  G.selfTest.on = true; /* the story, postcards and the full test stay out of the way while it runs */
  const L = G.debugLog;
  L.bench = Object.assign(L.bench || { result: null }, { step: 'graphics test' });
  G.uiState.modal = null;
  G.uiState.mq = [];
  G.renderOverlay();
  const keep = JSON.stringify(G.saveData),
    back = { tab: G.uiState.tab, roam: G.uiState.roam, bench: G.uiState.bench },
    realSave = G.save,
    engKeep = G.gameData.engine ? JSON.stringify(G.gameData.engine) : null,
    forceKeep = G.environment ? G.environment.force : null,
    errs0 = G.debugLog.err.length,
    t0 = performance.now();
  G.setSave(() => {}); /* nothing the test does reaches your save */
  G.pauseSaving(); /* nor the account or your friends */
  const box = document.createElement('div');
  box.className = 'nw-bench px glass';
  box.innerHTML =
    '<b>Graphics test</b><span class="nb-step">Getting ready…</span><span class="nb-bar"><i></i></span><button class="pb small quiet" type="button">Stop</button>';
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => {
    graphicsTest.stop = true;
  };
  const stepEl = box.querySelector('.nb-step'),
    bar = box.querySelector('.nb-bar i'),
    stop = () => graphicsTest.stop;
  let wl = null;
  const wake = async () => {
    try {
      if (navigator.wakeLock && !document.hidden) wl = await navigator.wakeLock.request('screen');
    } catch (e) {
      wl = null;
    }
  };
  const onVis = () => {
    if (!document.hidden) wake();
  };
  document.addEventListener('visibilitychange', onVis);
  wake();
  /* the player's graphics settings for one step: quality pinned, the segment's own values, then the step's */
  const prefs = () => G.saveData.preferences || (G.saveData.preferences = {});
  const pin = () => ({ quality: { auto: false, resolution: st.res } });
  const setEng = (seg, extra, aim) => {
    const p = prefs(),
      e = pin();
    for (const src of [seg && seg.eng, extra])
      for (const [g, o] of Object.entries(src || {})) e[g] = Object.assign(e[g] || {}, JSON.parse(JSON.stringify(o)));
    p.aim = aim || 'sharp';
    p.effects = 'full';
    p.expert = true;
    p.eng = e;
  };
  const dialEng = p => {
    if (p.kind !== 'dial') return null;
    const [g, k] = p.dial.split('.');
    return { [g]: { [k]: p.value } };
  };
  const rebuild = async sceneId => {
    G.rebuildFromSettings();
    /* the old place is freed now; two frames go by before the new one is made */
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await W.benchOpen(sceneId, stop);
  };
  let grow = 0; /* the most a rebuild has added to graphics memory so far (MB) */
  /* a segment that holds engine values of its own (the figures, the sun's place) is built with them, and the place
     is built again when it is left */
  let prevSeg = null,
    scene = null;
  const enter = async seg => {
    const own = seg.eng || (prevSeg && prevSeg.eng);
    setEng(seg);
    if (scene !== seg.scene) {
      const ms = await W.benchOpen(seg.scene, stop);
      scene = seg.scene;
      prevSeg = seg;
      return ms;
    }
    if (own && prevSeg !== seg) await rebuild(seg.scene);
    prevSeg = seg;
    return 0;
  };
  const save = () => writeState(st);
  const conditions = { start: null, end: null };
  try {
    conditions.start = await W.benchConditions();
    /* 1. shaders (a new run only) */
    if (st.at === 0 && !st.steps.length) {
      stepEl.textContent = 'Shaders';
      const s = { kind: 'shaders', name: graphicsStepName({ kind: 'shaders' }), ok: true };
      try {
        if (!G.gpuState.gl) {
          G.uiState.tab = 'walk';
          G.uiState.bench = { id: 'test_graphics', test: 1 };
          G.render();
          for (let i = 0; i < 200 && !G.gpuState.gl; i++) await sleep(50);
        }
        if (!G.gpuState.gl) throw new Error('no WebGL 2 on this device');
        const bad = [];
        let n = 0;
        for (const S of Object.values(G.shaders)) {
          if (!S) continue;
          for (const [k, v] of Object.entries(S)) {
            n++;
            const c = G.attributeClashes(v[0]);
            if (c.length) bad.push(k + ' clash: ' + c.join(','));
            try {
              if (!G.gpuState.P[k]) G.gpuState.P[k] = G.compileProgram(v, k);
            } catch (e) {
              bad.push(String((e && e.message) || e).slice(0, 160));
            }
          }
        }
        if (bad.length) throw new Error(bad.slice(0, 4).join('; '));
        s.note = `${n} programs`;
      } catch (e) {
        s.ok = false;
        s.why = String((e && e.message) || e).slice(0, 200);
      }
      st.steps.push(s);
      save();
    }
    /* 2. the warm-up lap: every segment the plan walks, once, unmeasured; the resolution comes down a step while the
       place as shipped is already over the budget */
    const walked = [...new Set(plan.filter(p => p.seg).map(p => p.seg))].filter(
      id => !(st.skipWarm || []).includes(id)
    );
    for (const id of walked) {
      if (stop()) break;
      const seg = segs[id];
      stepEl.textContent = 'Warming up: ' + seg.name;
      L.bench.step = 'graphics test: warm-up ' + seg.id;
      L.crumb();
      st.warmRunning = id;
      save();
      await enter(seg);
      let m = await W.benchWalk(seg, { budget, stop, settle: 6000 });
      while (m.peakMb > budget && st.res > 0.5 && !stop()) {
        st.res = Math.round((st.res - 0.25) * 100) / 100;
        G.debugLog.add(
          'bench',
          `graphics test: ${Math.round(m.peakMb)} MB as shipped, the resolution pinned at ${st.res}`
        );
        setEng(seg);
        await rebuild(seg.scene);
        m = await W.benchWalk(seg, { budget, stop, settle: 6000 });
      }
      W.benchWalkEnd();
      st.warmRunning = null;
      save();
    }
    /* 3. the steps */
    for (let i = st.at; i < plan.length && !stop(); i++) {
      const p = plan[i],
        seg = segs[p.seg],
        name = graphicsStepName(p, seg ? seg.name : p.seg),
        s = { ...p, name, ok: true };
      bar.style.width = Math.min(100, (i / plan.length) * 100) + '%';
      stepEl.textContent = name;
      L.bench.step = 'graphics test: ' + (p.dial || p.preset || p.seg) + (p.kind === 'base' ? ' base' : '');
      L.crumb();
      if (p.kind === 'notHere') {
        Object.assign(s, { notMeasured: true, notHere: p.why });
        st.steps.push(s);
        st.at = i + 1;
        save();
        continue;
      }
      /* marked as running before anything happens, so a reload during it is known on the next tap */
      st.running = i;
      save();
      const e0 = G.debugLog.err.length;
      let changed = false;
      try {
        s.openMs = (await enter(seg)) || undefined;
        /* the guess first: a step that would pass the budget is not run */
        const mem = W.benchMemory(),
          from = p.dial === 'quality.resolution' ? st.res : p.shipped,
          guess = B.benchMemoryGuess(mem.kinds, p.dial || '', from, p.value, p.build ? grow : 0);
        s.guessMb = guess;
        if (guess > budget) {
          Object.assign(s, {
            overBudget: true,
            notMeasured: true,
            why: `about ${Math.round(guess)} MB, over the ${budget} MB budget`,
          });
          throw null;
        }
        if (p.kind === 'preset') {
          if (p.preset.startsWith('aim:')) {
            /* Balanced and Beautiful differ only in how automatic quality aims: measured with it on */
            const P = prefs();
            P.aim = p.preset.slice(4);
            P.expert = false;
            P.eng = {};
            s.note = 'automatic quality on, as players have it';
          } else setEng(seg, G.ENGINE_PRESETS[p.preset].v);
        } else setEng(seg, dialEng(p));
        changed = true;
        const before = mem.mb;
        if (p.build) await rebuild(seg.scene);
        if (p.build) grow = Math.max(grow, W.benchMemory().mb - before);
        let m = null;
        for (let attempt = 0; attempt < 3 && !stop(); attempt++) {
          while (document.hidden && !stop()) await sleep(300);
          m = await W.benchWalk(seg, {
            measure: true,
            budget,
            stop,
            settle: p.build || p.kind === 'base' ? 6000 : 2500,
          });
          if (!m.invalid || m.overBudget) break;
        }
        if (m) {
          Object.assign(s, m);
          s.q = G.walkRenderer.on ? G.walkRenderer.qe || 0 : null;
          s.res = G.walkView.R ? Math.round(G.walkView.R * 100) / 100 : null;
          if (m.overBudget)
            Object.assign(s, {
              notMeasured: true,
              why: `passed the ${budget} MB budget (${Math.round(m.peakMb)} MB) and stopped`,
            });
          else if (m.invalid) Object.assign(s, { notMeasured: true, why: m.invalid });
        }
      } catch (e) {
        if (e) {
          s.ok = false;
          s.why = String((e && e.message) || e).slice(0, 200);
        }
      } finally {
        W.benchWalkEnd();
        /* back as shipped for the next step: a step that rebuilt (or ran into the budget) builds the place again */
        if (changed && (p.build || s.overBudget || p.kind === 'preset')) {
          setEng(seg);
          if (!stop()) await rebuild(seg.scene).catch(() => {});
        }
      }
      const ne = G.debugLog.err.slice(e0).filter(x => x.kind !== 'test');
      if (ne.length && s.ok && !s.notMeasured) {
        s.ok = false;
        s.why = 'an error during the step: ' + String(ne[0].msg).slice(0, 200);
      }
      if (G.gpuState.lost) {
        s.ok = false;
        s.why = 'the graphics chip lost the picture (context lost)';
      }
      st.steps.push(s);
      st.at = i + 1;
      st.running = null;
      save();
      if (G.gpuState.lost) break;
    }
    conditions.end = await W.benchConditions();
  } catch (e) {
    G.debugLog.error('test', 'graphics test: ' + String((e && e.message) || e).slice(0, 200), e && e.stack);
  } finally {
    L.bench.step = null;
    document.removeEventListener('visibilitychange', onVis);
    try {
      if (wl) wl.release();
    } catch (e) {}
    W.benchWalkEnd();
    if (G.environment) G.environment.force = forceKeep;
    if (engKeep) G.gameData.engine = JSON.parse(engKeep);
    G.setSaveData(JSON.parse(keep)); /* your save and graphics settings, as they were */
    G.setSave(realSave);
    G.resumeSaving();
    if (G.walkRenderer.on) {
      G.walkRenderer.yawT = 0;
      G.walkRenderer.zoomT = 1;
    }
    G.walkView.id = null; /* the place is made again with your own settings */
    G.rebuildFromSettings();
    G.uiState.bench = back.bench;
    G.uiState.roam = back.roam;
    G.uiState.tab = back.tab;
    G.uiState.modal = null;
    G.uiState.mq = [];
    G.renderOverlay();
    G.render();
    G.selfTest.on = false;
    graphicsTest.on = false;
    box.remove();
  }
  st.seconds = (st.seconds || 0) + Math.round((performance.now() - t0) / 1000);
  st.conditions = conditions;
  st.errors = (st.errors || []).concat(
    G.debugLog.err
      .slice(errs0)
      .filter(e => e.kind !== 'test' || /graphics test/.test(e.msg))
      .map(e => String(e.msg).slice(0, 200))
  );
  const done = st.at >= plan.length;
  if (done) st.done = true;
  save();
  const R = finishReport(G, st, !done || graphicsTest.stop);
  if (done) dropState();
  showGraphicsResults(G, R);
}

function finishReport(G, st, stopped) {
  const gl = G.debugLog.glInfo ? G.debugLog.glInfo() : {},
    names = graphicsNames(G.saveData, G.FIXTURE_NAMES);
  graphicsTest.report = graphicsReport(
    {
      build: G.version,
      created: st.created,
      seconds: st.seconds || 0,
      stopped,
      resumed: st.resumed || 0,
      budgetMb: G.bench.BENCH_BUDGET_MB,
      res: st.res,
      groups: st.groups,
      /* the graphics chip and the screen; the browser by name and version only (conditions), not the language or
         time zone */
      device: {
        mobile: /Mobi|Android|iPhone|iPad/.test(navigator.userAgent),
        screen: `${screen.width}x${screen.height}`,
        dpr: devicePixelRatio,
        cores: navigator.hardwareConcurrency || null,
        webgl2: gl.webgl2,
        vendor: gl.vendor,
        renderer: gl.renderer,
        maxTexture: gl.maxTexture,
        floatTargets: gl.floatTargets,
        timerQuery: gl.timerQuery,
      },
      conditions: st.conditions || null,
      steps: st.steps,
      errors: st.errors || [],
    },
    names
  );
  return graphicsTest.report;
}

function showGraphicsResults(G, R) {
  const f = v => (v == null ? '–' : v),
    esc = G.escapeHtml,
    walked = R.steps.filter(s => s.kind !== 'notHere'),
    notHere = R.steps.filter(s => s.kind === 'notHere'),
    tag = s =>
      s.overBudget
        ? '<td class="nb-skip">Over budget</td>'
        : s.notMeasured
          ? '<td class="nb-skip">Not measured</td>'
          : s.ok
            ? '<td class="nb-ok">OK</td>'
            : '<td class="nb-bad">Problem</td>';
  const rows = walked
    .map(
      s =>
        `<tr><td>${esc(s.step)}${s.why ? `<small class="nb-why">${s.ok ? '' : 'Why: '}${esc(s.why)}</small>` : ''}</td><td class="tnum">${f(s.fps)}</td><td class="tnum">${f(s.p90)}</td><td class="tnum">${f(s.draws)}</td><td class="tnum">${f(s.peakMb == null ? null : Math.round(s.peakMb))}</td>${tag(s)}</tr>`
    )
    .join('');
  const top = (R.costs || []).filter(c => !c.unsure && c.cost > 0.3).slice(0, 8);
  G.modal({
    title: R.stopped
      ? 'Graphics test stopped'
      : R.passed
        ? 'Every graphics setting works'
        : 'The graphics test found problems',
    html: `<p class="note">Each setting walked where it shows, quality pinned at resolution ${f(R.res)}, under a ${f(R.budgetMb)} MB graphics memory budget. FPS (higher is smoother), the 90th-percentile frame in ms, draws a frame and the most graphics memory (MB).</p>
  <table class="nb-table"><thead><tr><th>What</th><th>FPS</th><th>p90 ms</th><th>Draws</th><th>MB</th><th>Result</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Nothing was measured.</td></tr>'}</tbody></table>
  ${top.length ? `<h3>Costliest here</h3><ul class="nb-errs">${top.map(c => `<li>${esc(c.dial)}: +${c.cost} ms a frame</li>`).join('')}</ul>` : ''}
  ${notHere.length ? `<p class="note">${notHere.length} settings can’t be measured on a walk (each with its reason in the report).</p>` : ''}
  ${R.drift && R.drift.drifting ? `<p class="note">The open ground ran at ${f(R.drift.fpsFirst)} FPS at the start and ${f(R.drift.fpsLast)} at the end: frames ${Math.abs(R.drift.change)}% ${R.drift.change > 0 ? 'slower' : 'faster'} (the device may have warmed up).</p>` : ''}
  ${R.errors.length ? `<h3>Errors</h3><ul class="nb-errs">${R.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}<p class="note">Your save and your graphics settings weren't changed. The report holds no save data or names.</p>`,
    btns: [
      {
        l: 'Save the report',
        c: 'gold',
        f: () => {
          G.closeModal();
          saveGraphicsReport(G, R);
        },
      },
      { l: 'Close', c: 'quiet', f: G.closeModal },
    ],
  });
}

async function saveGraphicsReport(G, R) {
  const data = JSON.stringify(R, null, 1),
    d = new Date(),
    pad = n => String(n).padStart(2, '0'),
    name = `pocket-billies-graphics-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  try {
    const file = new File([data], name, { type: 'application/json' });
    if (
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
    ) {
      await navigator.share({ files: [file], title: 'Pocket Billies graphics test' });
      G.toast('Report shared.');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })),
      link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    G.toast('Report saved to your downloads.');
    return;
  } catch (e) {}
  try {
    await navigator.clipboard.writeText(data);
    G.toast('The report was copied. Paste it into a text file.');
  } catch (e) {
    G.toast('This browser can’t save files here.');
  }
}
