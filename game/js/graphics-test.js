'use strict';
/* ================= GRAPHICS TEST =================
   Settings → Help → Run the graphics test (and the debug menu). Made to be run by a person, by hand, on their own
   device: it is not part of any check, CI job or hook. It loads only when it starts (settings-screen.js,
   startGraphicsTest), and reaches the game only through what that hands it (G), so it has no imports.
   1. every shader program compiles, with no two inputs on one location (the same check as tools/check-quick.py's
      Shaders step),
   2. each engine dial on its own (game/js/engine/settings.js, ENGINE_SPEC): one scene opened with that dial moved away
      from its default and nothing else changed, so a result names the dial,
   3. each graphics preset (Settings → Graphics: Balanced, Beautiful) and each engine preset (ENGINE_PRESETS),
   each step measuring that frames keep coming, the frame rate, the worst frame and any errors.
   The save is never changed (saving is paused and the save is put back, as in self-test.js), and the player's own
   graphics settings are put back when the test ends, is stopped or fails. The report it saves holds no save data,
   names or movement history: only dial names, numbers, errors and the graphics chip; a last row checks it for names. */

/* the value a dial is tested at: away from its default, so the step shows what that dial changes */
const DIAL_UNSET = { hazeDistance: 40, pitch: 55, height: 14 };
export function graphicsDialValue(row, def) {
  const [key, , a, b] = row;
  if (typeof a === 'number') return def === b ? a : b;
  if (a === 'bool') return typeof def === 'number' ? (def ? 0 : 1) : !def;
  if (a === 'sel') {
    const opts = (b || []).map(o => o[0]).filter(v => v !== def);
    return opts.length ? opts[opts.length - 1] : def;
  }
  if (a === 'color' || a === 'color?') return String(def).toUpperCase() === '#FF4080' ? '#40C0FF' : '#FF4080';
  if (a === 'num?') return def == null ? (DIAL_UNSET[key] ?? 10) : null;
  return def;
}
/* every step of part 2: [group, key, label, value] */
export function graphicsDialSteps(spec, defaults) {
  const out = [];
  for (const [group, , rows] of spec)
    for (const row of rows) {
      const def = defaults[group] ? defaults[group][row[0]] : undefined;
      out.push([group, row[0], row[1], graphicsDialValue(row, def)]);
    }
  return out;
}
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
/* the report: steps, the graphics chip and errors; then the planted-name check, whose result is its last row */
export function graphicsReport(r, names) {
  const report = {
    game: 'Pocket Billies',
    kind: 'graphics',
    format: 1,
    build: r.build ?? null,
    created: r.created,
    seconds: r.seconds,
    stopped: !!r.stopped,
    passed: false,
    scene: r.scene,
    device: r.device || null,
    steps: r.steps.map(s => ({
      step: s.name,
      dial: s.dial,
      value: s.value,
      ok: s.ok,
      notMeasured: s.notMeasured || undefined,
      fps: s.fps,
      worstFrameMs: s.worstMs,
      draws: s.draws,
      frames: s.frames,
      openMs: s.openMs,
      why: s.ok ? undefined : s.why,
    })),
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

const graphicsTest = { on: false, stop: false, report: null };

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
  const slow = G.selfTest.slow || 1,
    sleep = ms => new Promise(r => setTimeout(r, ms * slow));
  /* worked out before anything changes, so nothing can fail between pausing the save and putting it back */
  const dials = graphicsDialSteps(G.ENGINE_SPEC, G.ENGINE_DEFAULTS),
    presets = Object.entries(G.ENGINE_PRESETS),
    total = 1 + 1 + dials.length + 2 + presets.length;
  graphicsTest.on = true;
  graphicsTest.stop = false;
  G.selfTest.on = true; /* the story, postcards and the full test stay out of the way while it runs */
  G.uiState.modal = null;
  G.uiState.mq = [];
  G.renderOverlay();
  const keep = JSON.stringify(G.saveData),
    names = graphicsNames(JSON.parse(keep), G.FIXTURE_NAMES),
    back = { tab: G.uiState.tab, roam: G.uiState.roam, bench: G.uiState.bench },
    realSave = G.save,
    engKeep = G.gameData.engine ? JSON.stringify(G.gameData.engine) : null,
    forceKeep = G.environment ? G.environment.force : null,
    scene = G.gameData.maps && G.gameData.maps.marigold ? 'marigold' : G.uiState.bench?.id || G.walkView.id,
    steps = [],
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
    bar = box.querySelector('.nb-bar i');
  /* the player's graphics settings for one step: the dials as given, nothing of their own */
  const prefs = () => G.saveData.preferences || (G.saveData.preferences = {});
  const setLook = (aim, eng) => {
    const p = prefs();
    p.aim = aim;
    p.effects = 'full';
    p.expert = !!eng;
    p.eng = eng || {};
  };
  const unblock = () => {
    if (G.uiState.modal || G.uiState.mq.length) {
      G.uiState.modal = null;
      G.uiState.mq = [];
      G.renderOverlay();
    }
  };
  /* open the scene from scratch (so dials read while a scene is made count too), then count frames for 2 s */
  const openAndMeasure = async night => {
    if (G.environment) G.environment.force = { time: night ? 22 : 15, weather: 'clear', season: 'summer' };
    unblock();
    const tm = performance.now();
    G.walkView.id = null;
    G.uiState.tab = 'walk';
    G.uiState.bench = { id: scene };
    G.render();
    for (let i = 0; i < 300 && !(G.walkView.ready && G.walkView.id === scene); i++) {
      if (graphicsTest.stop) return null;
      await sleep(50);
    }
    if (!(G.walkView.ready && G.walkView.id === scene))
      throw new Error(`the scene didn’t open in ${Math.round((performance.now() - tm) / 1000)} s`);
    const openMs = Math.round(performance.now() - tm);
    await sleep(500); /* the first frames draw what is new */
    unblock();
    const R = G.walkRenderer,
      f0 = R.frames,
      m0 = performance.now();
    let last = 0,
      worst = 0,
      going = true;
    const tickFrame = t => {
      if (last) worst = Math.max(worst, t - last);
      last = t;
      if (going) requestAnimationFrame(tickFrame);
    };
    requestAnimationFrame(tickFrame);
    /* phase 20: every frame's graphics calls counted meanwhile (engine/gpu-counters.js) */
    G.gpuCountBegin();
    let calls = null;
    try {
      await sleep(2000);
    } finally {
      calls = G.gpuCountEnd();
    }
    going = false;
    const sec = (performance.now() - m0) / 1000,
      frames = R.frames - f0;
    if (G.gpuState.lost) throw new Error('the graphics chip lost the picture (context lost)');
    if (!frames) throw new Error('no frames in 2 s (a black or frozen screen)');
    return {
      openMs,
      frames,
      fps: Math.round((frames / sec) * 10) / 10,
      worstMs: Math.round(worst),
      draws: calls ? calls.dc[0] : null,
    };
  };
  /* one step: what it measured, or why it is a problem; run again if the app went to the background meanwhile */
  let hidden = 0;
  const onVis = () => {
    if (document.hidden) hidden++;
  };
  document.addEventListener('visibilitychange', onVis);
  const step = async (name, extra, fn) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      while (document.hidden && !graphicsTest.stop) await sleep(300);
      if (graphicsTest.stop) return;
      stepEl.textContent = name;
      const h0 = hidden,
        e0 = G.debugLog.err.length;
      const s = Object.assign({ name, ok: true }, extra);
      let timer = null;
      try {
        const r = await Promise.race([
          fn(),
          new Promise((_, rej) => {
            timer = setTimeout(() => rej(new Error('took longer than 30 s')), 30000 * slow);
          }),
        ]);
        if (r && typeof r === 'object') Object.assign(s, r);
        else if (typeof r === 'string') s.note = r;
      } catch (e) {
        s.ok = false;
        s.why = String((e && e.message) || e).slice(0, 200);
      } finally {
        clearTimeout(timer);
      }
      if (graphicsTest.stop) return;
      if (hidden !== h0) {
        if (attempt < 2) continue;
        Object.assign(s, { ok: true, why: undefined, notMeasured: true });
      }
      const ne = G.debugLog.err.slice(e0).filter(x => x.kind !== 'test');
      if (ne.length && !s.notMeasured && s.ok) {
        s.ok = false;
        s.why = 'an error during the step: ' + String(ne[0].msg).slice(0, 200);
      }
      steps.push(s);
      bar.style.width = Math.min(100, (steps.length / total) * 100) + '%';
      return;
    }
  };
  try {
    /* 1. shaders, as tools/check-quick.py checks them */
    await step('Shaders: every program compiles, no clashing inputs', {}, async () => {
      if (!G.gpuState.gl) {
        /* the context is made with the first scene */
        G.uiState.tab = 'walk';
        G.uiState.bench = { id: scene };
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
      return `${n} programs`;
    });
    /* 2. the scene as the game draws it, to compare each dial with; then each dial on its own */
    await step('Game defaults (to compare with)', { dial: null }, () => {
      setLook('sharp', null);
      return openAndMeasure(false);
    });
    for (const [group, key, label, value] of dials) {
      if (graphicsTest.stop) break;
      await step(
        `Dial: ${label} (${group}.${key} = ${JSON.stringify(value)})`,
        { dial: `${group}.${key}`, value },
        () => {
          setLook('sharp', { [group]: { [key]: value } });
          return openAndMeasure(group === 'lights');
        }
      );
    }
    /* 3. the presets: Settings → Graphics, then the engine's */
    for (const [aim, name] of [
      ['smooth', 'Balanced'],
      ['sharp', 'Beautiful'],
    ]) {
      if (graphicsTest.stop) break;
      await step(`Preset: ${name}`, { dial: 'graphics', value: name }, () => {
        setLook(aim, null);
        return openAndMeasure(false);
      });
    }
    for (const [k, P] of presets) {
      if (graphicsTest.stop) break;
      await step(`Engine preset: ${P.name}`, { dial: 'engine preset', value: k }, () => {
        setLook('sharp', JSON.parse(JSON.stringify(P.v)));
        return openAndMeasure(k === 'cave' || k === 'mall');
      });
    }
  } finally {
    document.removeEventListener('visibilitychange', onVis);
    if (G.environment) G.environment.force = forceKeep;
    if (engKeep) G.gameData.engine = JSON.parse(engKeep);
    G.setSaveData(JSON.parse(keep)); /* your save and graphics settings, as they were */
    G.setSave(realSave);
    G.resumeSaving();
    G.walkView.id = null; /* the scene is made again with your own settings */
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
  const errors = G.debugLog.err
    .slice(errs0)
    .filter(e => e.kind !== 'test')
    .map(e => String(e.msg).slice(0, 200));
  const gl = G.debugLog.glInfo ? G.debugLog.glInfo() : {};
  graphicsTest.report = graphicsReport(
    {
      build: G.version,
      created: new Date().toISOString(),
      seconds: Math.round((performance.now() - t0) / 1000),
      stopped: graphicsTest.stop,
      scene,
      /* the graphics chip and the screen; not the browser, language or time zone */
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
      steps,
      errors,
    },
    names
  );
  showGraphicsResults(G, graphicsTest.report);
}

function showGraphicsResults(G, R) {
  const f = v => (v == null ? '–' : v),
    esc = G.escapeHtml;
  const rows = R.steps
    .map(
      s =>
        `<tr><td>${esc(s.step)}${!s.ok && s.why ? `<small class="nb-why">Why: ${esc(s.why)}</small>` : ''}</td><td class="tnum">${f(s.fps)}</td><td class="tnum">${f(s.worstFrameMs)}</td><td class="tnum">${f(s.draws)}</td><td class="${s.notMeasured ? 'nb-skip' : s.ok ? 'nb-ok' : 'nb-bad'}">${s.notMeasured ? 'Not measured' : s.ok ? 'OK' : 'Problem'}</td></tr>`
    )
    .join('');
  G.modal({
    title: R.stopped
      ? 'Graphics test stopped'
      : R.passed
        ? 'Every graphics setting works'
        : 'The graphics test found problems',
    html: `<p class="note">Each graphics setting on its own, in ${esc(R.scene || 'one scene')}. Frames per second (higher is smoother) and the longest frame in milliseconds.</p>
  <table class="nb-table"><thead><tr><th>What</th><th>FPS</th><th>Worst ms</th><th>Draws</th><th>Result</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nothing was measured.</td></tr>'}</tbody></table>
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
