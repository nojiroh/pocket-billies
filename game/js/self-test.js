'use strict';
/* ================= FULL TEST =================
   Settings → Run the full test (and the debug menu) plays through everything that draws, for about nine minutes:
   every walk scene (walking, turning and zooming the camera), a battle on the 3D stage and one on a painted stage,
   the world map in 3D and flat, the opening's fall and Blake's first battle, the dressing room and a boutique, the shop, the Team, Guide
   and Trainer screens, then a stress test that keeps adding load (crowds, particles, extra props, maximum quality)
   and measures how far the device keeps up. Your save is not changed: saving is paused and everything is put back
   afterwards. The results go into the debug log. If the app goes to the background (the screen locks), the test waits
   for you and runs that step again. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { clamp } from './util.js';
import { GD, MOVES, ROUTE, RULES, SP, TRAINERS, linkCost, placeKind } from './game-data.js';
import { scenesAll } from './map-files.js';
import { B, S, U, addSteps, esc, makeMon, maxHp, save, setB, setS, setSave, setTrip, spawn } from './game-state.js';
import { FRAME } from './frame-scheduler.js';
import { TR_CACHE } from './person-art.js';
import { DR, closeDressing } from './dressing-room.js';
import { battleStage, battleStageStop } from './battle-stage.js';
import {
  GROUND_CACHE,
  PROP_CLOCK,
  actionSpot,
  climbEnds,
  findPath,
  mapBridges,
  mapById,
  mapHub,
  navCellAt,
  navGrid,
  stepGrid,
  stopWalkView,
  walkData,
  walkTo,
  walkView,
} from './walk-view.js';
import { eng } from './engine/settings.js';
import { EGL, eglAttrClashes } from './engine/webgl.js';
import { EGL_POST_SH } from './engine/post-effects.js';
import { ENV } from './environment.js';
import { WALK_SHADERS, roomDimming, standingHeightAt, walkRenderer } from './walk-view-gl.js';
import { BLD, BLD_SH } from './buildings.js';
import { STR, strHas } from './structures.js';
import { P3D, P3D_SH } from './solid-props.js';
import { VOX } from './prop-models.js';
import { buddyTap, companionSpecies, worldBillies } from './world-billies.js';
import { seamlessRoomMap, seamlessTripView, seamlessWorld } from './seamless-world.js';
import { A, endBattle, liveK, pickMove, pickTarget, startTrainer, startWild, stopTimers, tapMsg } from './battle.js';
import { worldMap } from './world-map.js';
import {
  WORLD_MAP_GL_SHADERS,
  setWorldMapGlRender,
  worldMapGl,
  worldMapGlRender,
  worldMapMinis,
  worldMapMinisOn,
} from './world-map-gl.js';
import { TALK, talkHide } from './talk.js';
import { CS, csTeardown } from './cutscene.js';
import { battleTipHide, fallGL, fallMap } from './opening-fall.js';
import { closeModal, leaveRoom, modal, render, renderOv, sceneIdAt, toast, walkPick } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  DIAGR: [() => DIAGR, v => (DIAGR = v)],
  DIAG_PASSES: [() => DIAG_PASSES],
  STD_EMPTY: [() => STD_EMPTY],
  STEST: [() => STEST],
  diagReport: [() => diagReport, v => (diagReport = v)],
  diagTimersOff: [() => diagTimersOff, v => (diagTimersOff = v)],
  diagTimersOn: [() => diagTimersOn, v => (diagTimersOn = v)],
  exportDiagReport: [() => exportDiagReport, v => (exportDiagReport = v)],
  runDiagTest: [() => runDiagTest, v => ((runDiagTest = v), provide({ runDiagTest }))],
  runFullTest: [() => runFullTest, v => (runFullTest = v)],
  runQuickTest: [() => runQuickTest],
  stDiagScenes: [() => stDiagScenes, v => (stDiagScenes = v)],
  stSceneChecks: [() => stSceneChecks, v => ((stSceneChecks = v), provide({ stSceneChecks }))],
  stSleep: [() => stSleep, v => (stSleep = v)],
  stStats: [() => stStats, v => (stStats = v)],
  testScenes: [() => testScenes, v => ((testScenes = v), provide({ testScenes }))],
});
/* eslint-enable no-func-assign */
provide({ runDiagTest, stSceneChecks, testScenes });
/* to-module: end */
const STEST = { on: false, stop: false };
provide({ STEST }); /* to-module */
function stSleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
/* frame rate of one scheduler task between two moments of the debug log */
function stStats(t0, t1, task) {
  const f = [],
    m = [];
  let slow = 0;
  for (const s of NWLOG.samples) {
    if (s.t < t0 || s.t > t1) continue;
    const v = s.tasks[task];
    if (!v) continue;
    f.push(v.fps);
    m.push(v.ms);
    slow += v.long;
  }
  if (!f.length) return { fpsAvg: null, fpsWorst: null, cpuMs: null, slow: 0, seconds: 0 };
  const avg = a => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  return { fpsAvg: avg(f), fpsWorst: Math.min(...f), cpuMs: avg(m), slow, seconds: f.length };
}
/* v20: the test scenes, and their walking checks (from, to, reach) worked out from the scene data without drawing */
function testScenes() {
  return Object.keys(GD.scenes || {}).filter(k => GD.scenes[k].test);
}
function stSceneChecks(id) {
  const sc = mapById(id);
  if (!sc) return [];
  const keep = [walkView.sc, walkView.nav, walkView.gkey],
    out = [];
  walkView.sc = sc;
  walkView.nav = null;
  walkView.gkey = 'check-' + id;
  try {
    const far = (q, p) => {
      const e = q && q[q.length - 1];
      return !q || Math.hypot(e[0] - p[0], e[1] - p[1]) > 0.9;
    };
    const hub = mapHub(sc),
      G = navGrid(),
      hc = navCellAt(hub[0], hub[1]);
    out.push({ what: 'where you arrive is open ground', reach: true, ok: hc >= 0 && !G.blk[hc] });
    for (const c of sc.checks || []) {
      const got = !far(findPath(c.from[0], c.from[1], c.to[0], c.to[1], c.noHop ? { noHop: true } : {}), c.to);
      out.push({ what: c.what, reach: c.reach, got, ok: got === !!c.reach });
    }
  } finally {
    [walkView.sc, walkView.nav, walkView.gkey] = keep;
  }
  return out;
}
async function runFullTest(mode) {
  const diag = mode === 'diag';
  if (STEST.on) return;
  if (typeof B !== 'undefined' && B) {
    toast('Finish the battle first.');
    return;
  }
  if (!S.started) {
    toast('Start a game first.');
    return;
  }
  if (U.modal) {
    U.modal = null;
    U.mq = [];
    renderOv();
  }
  STEST.on = true;
  STEST.stop = false;
  await scenesAll(); /* phase 04b: every map whole before the test opens them */
  const keep = JSON.stringify(S),
    back = { tab: U.tab, roam: U.roam, node: S.route.node },
    realSave = save,
    engKeep = GD.engine ? JSON.stringify(GD.engine) : null;
  setSave(() => {}); /* nothing the test does reaches your save */
  const box = document.createElement('div');
  box.className = 'nw-bench px glass';
  box.innerHTML =
    '<b>' +
    (diag ? 'Diagnostics' : 'Full test') +
    '</b><span class="nb-step">Getting ready…</span><span class="nb-bar"><i></i></span><button class="pb small quiet" type="button">Stop</button>';
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => {
    STEST.stop = true;
  };
  const stepEl = box.querySelector('.nb-step'),
    bar = box.querySelector('.nb-bar i');
  const scenes = Object.keys(GD.scenes || {}).filter(
      id => mapById(id) && !GD.scenes[id].test && !GD.scenes[id].backup && !id.includes('@')
    ),
    phases = [],
    stress = [],
    errs0 = NWLOG.err.length,
    T0 = NWLOG.now();
  const only0 = STEST.only;
  if (diag) {
    DIAGR = STD_EMPTY();
    scenes.splice(0, scenes.length, ...stDiagScenes());
    STEST.only = ['Shaders', 'Walk: ', 'Device', 'Frame budget', 'Rain and night', 'Battle on the 3D stage', 'Memory'];
  }
  const total = diag
    ? scenes.length * 4 + 1 + 1 + 6 + 10 + 6 + 1
    : scenes.length * 4 + 1 + 5 + 8 + 6 + 5 + 8 + 8 + 6 + 6 + 10 + 8 + 8 + 1 + 40;
  let done = 0;
  const tick = s => {
    done += s;
    bar.style.width = Math.min(100, (done / total) * 100) + '%';
  };
  NWLOG.bench = { step: 'start', result: null };
  NWLOG.add('bench', 'full test start');
  scrollTo(0, 0);
  /* v33: every step reports what it measured, not just OK: how long it took, the frame rate, slow frames and what caused
    them, what the renderer drew, and on a problem what was on screen and the last errors */
  /* v47: the app went to the background mid-step (the screen locked, another app came up): nothing is drawn while it's
    hidden, so that step's numbers mean nothing. The test waits until you're back and runs the step again (twice more at
    most); a step that never got to run in the foreground is listed as not measured, not as a problem. */
  /* and it asks to keep the screen on while it runs, where the browser allows that (a lock lapses while hidden: asked again on return) */
  const wake = async () => {
    try {
      if (navigator.wakeLock && !document.hidden) {
        STEST.wl = await navigator.wakeLock.request('screen');
        NWLOG.add('bench', 'the screen stays on during the test');
      }
    } catch (e) {
      STEST.wl = null;
    }
  };
  let hid = 0;
  const onVis = () => {
    if (document.hidden) {
      hid++;
      NWLOG.add('bench', 'paused: the app is in the background');
    } else wake();
  };
  document.addEventListener('visibilitychange', onVis);
  wake();
  STEST.offVis = () => {
    document.removeEventListener('visibilitychange', onVis);
    try {
      if (STEST.wl) STEST.wl.release();
    } catch (e) {}
    STEST.wl = null;
  };
  const awake = async () => {
    if (!document.hidden) return;
    stepEl.textContent = 'Paused while the app is in the background';
    while (document.hidden && !STEST.stop) await stSleep(300);
    await stSleep(800); /* frames start again */
  };
  const phase = async (name, task, fn, sec, maxSec) => {
    if (STEST.stop) return;
    /* v44b: STEST.only=['light'] runs only the steps whose names hold one of those words (for diagnosis) */ if (
      STEST.only &&
      !STEST.only.some(w => name.toLowerCase().includes(w.toLowerCase()))
    )
      return;
    for (let attempt = 0; ; attempt++) {
      await awake();
      if (STEST.stop) return;
      const h0 = hid;
      stepEl.textContent = name;
      NWLOG.bench.step = name;
      const t0 = NWLOG.now(),
        e0 = NWLOG.err.length,
        w0 = performance.now(),
        mb0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
      let ok = true,
        note = '',
        why = '',
        err = null;
      /* no step may hold the test up: past its time limit it counts as a problem and the test moves on */
      const limit = (maxSec || Math.max(20, sec * 6)) * 1000;
      let timer = null;
      try {
        const r = await Promise.race([
          fn(),
          new Promise((_, rej) => {
            timer = setTimeout(() => {
              STEST.gen = (STEST.gen || 0) + 1;
              /* a step left behind stops at its next check */ rej(
                new Error(`took longer than ${Math.round(limit / 1000)} s, skipped`)
              );
            }, limit);
          }),
        ]);
        if (r === false) ok = false;
        else if (typeof r === 'string') {
          note = r;
        }
      } catch (e) {
        ok = false;
        why = String((e && e.message) || e).slice(0, 240);
        note = why.slice(0, 140);
        err = e;
      } finally {
        clearTimeout(timer);
      }
      await stSleep(300);
      if (hid !== h0 && attempt < 2) {
        NWLOG.add('bench', name + ': the app went to the background, running the step again');
        continue;
      }
      const bg = hid !== h0; /* still interrupted after three tries: not measured */
      if (err && !bg) NWLOG.error('test', name + ': ' + why, err && err.stack);
      const st = stStats(t0, NWLOG.now(), task),
        ne = NWLOG.err.slice(e0).filter(x => x.kind !== 'test');
      if (ne.length && !bg) {
        ok = false;
        why = why || 'an error during the step: ' + ne[0].msg.slice(0, 200);
        note = note || ne[0].msg.slice(0, 140);
      }
      const D = NWLOG.diag(t0),
        slow = NWLOG.slow.filter(x => x.t >= t0),
        by = {};
      for (const x of slow) {
        const k = x.why.replace(/ \d+ ms.*$/, '');
        by[k] = (by[k] || 0) + 1;
      }
      const top = Object.entries(by)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([k, n]) => `${k} ×${n}`)
          .join(', '),
        worst = slow.reduce((a, x) => Math.max(a, x.ms), 0);
      const detail = [
        `${((performance.now() - w0) / 1000).toFixed(1)} s`,
        st.fpsAvg != null ? `${st.fpsAvg} fps (worst ${st.fpsWorst})` : null,
        slow.length
          ? `${slow.length} slow frame${slow.length > 1 ? 's' : ''} up to ${worst} ms${top ? ': ' + top : ''}`
          : 'no slow frames',
        D.drawn && D.drawn.skipped ? `${D.drawn.skipped} skipped` : null,
        mb0 && performance.memory
          ? `${Math.round((performance.memory.usedJSHeapSize - mb0) / 1048576) >= 0 ? '+' : ''}${Math.round((performance.memory.usedJSHeapSize - mb0) / 1048576)} MB`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
      if (bg) {
        ok = true;
        why = '';
        note = 'not measured: the app was in the background every time this step ran';
      } else if (attempt)
        note =
          (note ? note + ' ' : '') + `(run again: the app went to the background ${attempt === 1 ? 'once' : 'twice'})`;
      phases.push(
        Object.assign(
          {
            name,
            task,
            ok,
            note,
            detail,
            why: ok ? undefined : why || 'the check returned a problem',
            ctx: ok ? undefined : D,
            slowCauses: by,
            worstFrameMs: worst || undefined,
            ms: Math.round(performance.now() - w0),
            retries: attempt || undefined,
            notMeasured: bg || undefined,
          },
          st
        )
      );
      tick(sec);
      return;
    }
  };
  /* v31: anything that pops up (a level-up, a request) is closed first: an open window holds the scene at 10 fps, which used to show up as a false 10 fps */
  const unblock = () => {
    if (U.modal || U.mq.length) {
      U.modal = null;
      U.mq = [];
      renderOv();
    }
    if (typeof TALK !== 'undefined' && TALK.on && typeof talkHide === 'function') talkHide();
  };
  const walkAbout = async sec => {
    const end = performance.now() + sec * 1000;
    let k = 0;
    while (performance.now() < end && !STEST.stop) {
      await stSleep(500);
      k++;
      unblock();
      if (walkView.ready && walkView.sc) {
        const sc = walkView.sc,
          hb = mapHub(sc),
          a = k * 1.7,
          r = 3 + (k % 4);
        if (!walkView.pl.route)
          walkTo([clamp(hb[0] + Math.cos(a) * r, 1, sc.w - 1), clamp(hb[1] + Math.sin(a) * r * 0.7, 1, sc.h - 1)]);
        if (typeof walkRenderer !== 'undefined' && walkRenderer.on) {
          walkRenderer.yawT = Math.sin(k * 0.5) * 0.45;
          walkRenderer.zoomT = 1 + Math.sin(k * 0.33) * 0.3;
        }
      }
    }
  };
  try {
    /* 0. shaders: no two inputs share a location (a GPU-specific link failure that once blanked the scenes with buildings) */
    await phase(
      'Shaders',
      'dio',
      async () => {
        const all = Object.assign(
          {},
          typeof WALK_SHADERS !== 'undefined' ? WALK_SHADERS : {},
          typeof BLD_SH !== 'undefined' ? BLD_SH : {},
          typeof EGL_POST_SH !== 'undefined' ? EGL_POST_SH : {},
          typeof WORLD_MAP_GL_SHADERS !== 'undefined' ? WORLD_MAP_GL_SHADERS : {},
          typeof P3D_SH !== 'undefined' ? P3D_SH : {}
        );
        const bad = [];
        for (const [k, v] of Object.entries(all)) {
          const c = eglAttrClashes(v[0]);
          if (c.length) bad.push(k + ': ' + c.join(', '));
        }
        if (bad.length) throw new Error(bad.join('; '));
        if (typeof BLD !== 'undefined' && BLD.fail)
          throw new Error('3D buildings are off on this device: ' + String(BLD.fail).slice(0, 90));
        return Object.keys(all).length + ' shaders';
      },
      1
    );
    /* alpha 0.4, the diagnostics test: the device, and how the automatic quality chose its level and resolution */
    if (diag)
      await phase(
        'Device and quality',
        'dio',
        async () => {
          const g = NWLOG.glInfo ? NWLOG.glInfo() : {},
            ev = (NWLOG.ev || [])
              .filter(e => /quality|resolution/i.test(e.kind + ' ' + (e.msg || '')))
              .slice(-6)
              .map(e => e.msg || e.kind);
          DIAGR.device = {
            device: NWLOG.device ? NWLOG.device() : null,
            graphics: g,
            auto: eng('quality', 'auto') ?? null,
            resolution: typeof walkView !== 'undefined' ? walkView.R : null,
            level: typeof walkRenderer !== 'undefined' ? (walkRenderer.q ?? null) : null,
            screenHz: typeof FRAME !== 'undefined' ? FRAME.hz : null,
            why: ev,
          };
          return `${String(g.renderer || g.gpu || 'graphics unknown').slice(0, 60)} · resolution ×${DIAGR.device.resolution ?? '?'} · quality level ${DIAGR.device.level ?? '?'}${ev.length ? ' · ' + ev.slice(-1)[0] : ''}`;
        },
        1
      );
    /* 1. every walk scene */
    for (const id of scenes) {
      if (STEST.stop) break;
      await phase(
        'Walk: ' + ((mapById(id) || {}).name || id),
        'dio',
        async () => {
          const tm = performance.now();
          U.tab = 'walk';
          U.bench = { id };
          render();
          let open = null;
          for (let i = 0; i < 60 && !(walkView.ready && walkView.id === id); i++) await stSleep(50);
          open = walkView.ready && walkView.id === id ? Math.round(performance.now() - tm) : null;
          await stSleep(Math.max(0, 900 - (performance.now() - tm)));
          const f0 = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
          await walkAbout(3);
          if (!walkView.ready || walkView.id !== id)
            throw new Error(
              `the scene didn’t open (still ${walkView.id || 'nothing'}${walkView.ready ? '' : ', loading'} after ${Math.round((performance.now() - tm) / 1000)} s)`
            );
          if (typeof walkRenderer !== 'undefined' && walkRenderer.on && walkRenderer.frames === f0)
            throw new Error('the scene isn’t drawing (black screen): no frames in 3 s');
          if (id === scenes[0]) NWLOG.snap();
          const g = stGeometry(),
            sc = walkView.sc,
            gl = typeof walkRenderer !== 'undefined' && walkRenderer.on;
          return [
            `opened in ${open != null ? open + ' ms' : 'over 3 s'}`,
            `${(sc.props || []).length} props`,
            gl && typeof BLD !== 'undefined' && BLD.drawn ? `${BLD.drawn} 3D buildings` : '',
            gl && typeof P3D !== 'undefined' && P3D.drawn ? `${P3D.drawn} solid props` : '',
            gl && walkRenderer.grassDrawn ? `${walkRenderer.grassDrawn} grass patches` : '',
            (walkView.folk || []).length ? `${walkView.folk.length} folk` : '',
            typeof worldBillies !== 'undefined' && worldBillies.bud ? 'buddy along' : '',
            g || '',
          ]
            .filter(Boolean)
            .join(', ');
        },
        4
      );
    }
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    }
    /* alpha 0.4, diagnostics: where a frame's time goes in the busiest town (the processor's time for each pass, and the
     graphics chip's own timers where it has them), then what rain and night cost there */
    if (diag)
      await phase(
        'Frame budget: where the time goes',
        'dio',
        async () => {
          const sid = DIAGR.busiest;
          U.bench = { id: sid };
          U.tab = 'walk';
          render();
          for (let i = 0; i < 80 && !(walkView.ready && walkView.id === sid); i++) await stSleep(100);
          await stSleep(900);
          const T = diagTimersOn();
          await walkAbout(4);
          const r = await diagTimersOff(T);
          DIAGR.passes = r;
          return (
            `per frame: ` +
            Object.entries(r.cpu)
              .map(([k, v]) => `${k} ${v} ms`)
              .join(', ') +
            (r.gpu
              ? ` · graphics chip: ` +
                Object.entries(r.gpu)
                  .map(([k, v]) => `${k} ${v} ms`)
                  .join(', ')
              : ' · no graphics-chip timers here')
          );
        },
        6
      );
    if (diag)
      await phase(
        'Rain and night: what they cost',
        'dio',
        async () => {
          const f0 = ENV.force,
            on0 = ENV.on;
          const meas = async force => {
            ENV.on = true;
            ENV.force = force;
            await stSleep(1000);
            const t0 = NWLOG.now();
            await walkAbout(3);
            return stStats(t0, NWLOG.now(), 'dio');
          };
          try {
            const a = await meas({ time: 12.5, weather: 'clear', season: 'summer' }),
              b = await meas({ time: 12.5, weather: 'rain', season: 'summer' }),
              c = await meas({ time: 23, weather: 'clear', season: 'summer' });
            DIAGR.weather = { clear: a, rain: b, night: c };
            return `clear day ${a.fpsAvg} fps (${a.cpuMs} ms), rain ${b.fpsAvg} fps (${b.cpuMs} ms), night ${c.fpsAvg} fps (${c.cpuMs} ms)`;
          } finally {
            ENV.force = f0;
            ENV.on = on0;
          }
        },
        10
      );
    function stGeometry() {
      const sc = walkView.sc;
      if (!sc || (!sc.steps && !sc.bridges)) return;
      const hub = mapHub(sc),
        C0 = walkData().sc,
        bad = [],
        far = (q, p) => {
          const end = q && q[q.length - 1];
          return !q || Math.hypot(end[0] - p[0], end[1] - p[1]) > 1.6;
        };
      for (const e of sc.exits || []) if (far(findPath(hub[0], hub[1], e[0], e[1]), e)) bad.push('an exit');
      for (const p of sc.props || [])
        if (
          p.act &&
          !(
            p.act === 'climb' &&
            typeof climbEnds === 'function' &&
            [climbEnds(p).bot, climbEnds(p).top].some(g => {
              const q = findPath(hub[0], hub[1], g[0], g[1]),
                e = q && q[q.length - 1];
              return e && Math.hypot(e[0] - g[0], e[1] - g[1]) <= 1.6;
            })
          )
        ) {
          const g = actionSpot(p, C0.props[p.k], C0.ppu || 34);
          if (g && far(findPath(hub[0], hub[1], g[0], g[1]), g)) bad.push(p.k);
        }
      for (const b of mapBridges(sc) || []) {
        const A = [b.a[0] - b.ux * 0.4, b.a[1] - b.uz * 0.4],
          Bp = b.pier ? [b.b[0] - b.ux * 0.4, b.b[1] - b.uz * 0.4] : [b.b[0] + b.ux * 0.4, b.b[1] + b.uz * 0.4];
        if (far(findPath(A[0], A[1], Bp[0], Bp[1]), Bp)) bad.push('across a bridge');
      }
      if (bad.length) throw new Error('can’t walk to: ' + [...new Set(bad)].join(', '));
      const E = stepGrid(sc),
        G = navGrid();
      let hops = 0;
      for (let q = 0; q < G.hop.length; q++) if (G.hop[q]) hops++;
      const gl = typeof walkRenderer !== 'undefined' && walkRenderer.on;
      if (gl && typeof strHas === 'function' && strHas(sc) && !STR.mesh && !(typeof BLD !== 'undefined' && BLD.fail))
        throw new Error('bridges and railings aren’t drawn');
      return (
        [
          E ? 'cliffs' : '',
          (sc.bridges || []).length ? `${sc.bridges.length} bridge${sc.bridges.length > 1 ? 's' : ''}` : '',
          hops ? 'ledges' : '',
          gl && walkRenderer.falls && walkRenderer.falls.length ? 'waterfalls' : '',
          (sc.escalators || []).length ? 'escalators' : '',
        ]
          .filter(Boolean)
          .join(', ') + ' walkable'
      );
    }
    /* 1c. v26: night, bad weather and the seasons drawn in town, a room you walk into, and a dark cave */
    if (typeof ENV !== 'undefined' && !STEST.stop)
      await phase(
        'Night, weather, seasons and rooms',
        'dio',
        async () => {
          const sid = GD.scenes.sundown ? 'sundown' : scenes[0],
            f0 = ENV.force,
            out = [];
          try {
            U.tab = 'walk';
            U.bench = { id: sid };
            render();
            await stSleep(900);
            for (const [n, f] of [
              ['night', { time: 23.5, weather: 'clear' }],
              ['a storm', { time: 15, weather: 'storm' }],
              ['snow', { time: 11, weather: 'snow', season: 'winter' }],
              ['autumn', { time: 12, weather: 'clear', season: 'autumn' }],
            ]) {
              if (STEST.stop) break;
              ENV.force = f;
              const f1 = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
              await stSleep(1600);
              if (typeof walkRenderer !== 'undefined' && walkRenderer.on && walkRenderer.frames <= f1)
                throw new Error(n + ': the scene stopped drawing');
              out.push(n);
            }
          } finally {
            ENV.force = f0;
          }
          for (const id of ['int_shop', 'grotto']) {
            if (!GD.scenes[id] || STEST.stop) continue;
            U.bench = { id };
            render();
            await stSleep(1400);
            if (!walkView.ready || walkView.id !== id) throw new Error((GD.scenes[id].name || id) + ' didn’t open');
            out.push(id === 'grotto' ? 'a dark cave' : 'a shop you walk into');
          }
          return out.join(', ');
        },
        5
      );
    /* 2. battles: on the 3D stage where you stand, then on a painted stage */
    /* v41: the wild foe is an ordinary first-stage species (the first stage-1 species used to be the legendary Oilympus since v39) */
    const foeSp =
      Object.keys(SP).find(
        k => SP[k].stage === 0 && SP[k].rar === 'common' && !RULES.start.starters.includes(SP[k].line)
      ) ||
      Object.keys(SP).find(k => SP[k].stage === 0 && SP[k].rar !== 'mythical') ||
      Object.keys(SP)[0];
    const battle = async classic => {
      U.bench = null;
      U.tab = 'walk';
      S.route.node = back.node;
      render();
      await stSleep(600);
      for (let i = 0; i < 40 && !(walkView.ready && walkView.id === sceneIdAt(back.node)); i++) await stSleep(200);
      /* v43: the stage needs the walk scene open */ S.preferences = S.preferences || {};
      const pref = S.preferences.battleStage;
      S.preferences.battleStage = classic ? 'classic' : 'scene';
      S.team.forEach(m => {
        m.hp = maxHp(m);
      });
      const q = { id: 'selftest', sp: foeSp, lvl: 5, gold: false, no: 1 };
      S.queue = [q].concat(S.queue || []);
      startWild(q);
      const g0 = STEST.gen || 0;
      const want = async (ph, ms) => {
        const end = performance.now() + ms;
        while (performance.now() < end) {
          if (!B || (STEST.gen || 0) !== g0) return false;
          if (ph.includes(B.phase)) return true;
          if (B.phase === 'playing') tapMsg();
          await stSleep(150);
        }
        return false;
      };
      const tb = performance.now();
      let ok = await want(['choose'], 45000),
        why = ok ? '' : `the battle never got to the move menu (stuck in ${B ? B.phase : 'no battle'})`;
      const gl = !!battleStage.gl,
        menuMs = Math.round(performance.now() - tb);
      if (ok) {
        const f = document.querySelector('[data-a=bfight]');
        if (f) {
          f.click();
          await stSleep(200);
          const m = document.querySelector('[data-a=bmove]');
          if (m) m.click();
        }
        ok = await want(['choose', 'end', 'switch'], 45000);
        if (!ok) why = 'a move never finished playing';
      }
      stopTimers();
      setB(null);
      battleStageStop();
      S.preferences.battleStage = pref;
      render();
      await stSleep(600);
      if (!ok) throw new Error(why);
      return `${classic ? 'painted stage' : gl ? '3D stage' : '3D stage not available here, painted stage used'}; move menu after ${(menuMs / 1000).toFixed(1)} s`;
    };
    /* v33: team battles: a trainer's double battle and an Alpha in the grass, each played for a turn with every fighter choosing */
    const teamBattle = async kind => {
      U.bench = null;
      U.tab = 'walk';
      S.route.node = back.node;
      render();
      await stSleep(1200);
      S.team.forEach(m => {
        m.hp = maxHp(m);
        m.status = null;
      });
      while (S.team.filter(m => m.job == null).length < 3) S.team.push(makeMon(foeSp, 6));
      if (kind === 'double') {
        const id = Object.keys(TRAINERS).find(
          k => TRAINERS[k].team.length >= 2 && !TRAINERS[k].team.some(m => String(m.sp).startsWith('@'))
        );
        if (!id) return 'no trainer with two Billies';
        startTrainer(id, { talked: true, double: true });
      } else {
        const q = { id: 'selftest-alpha', sp: foeSp, lvl: 5, gold: false, no: 1, alpha: true };
        S.queue = [q].concat(S.queue || []);
        startWild(q);
      }
      const g0 = STEST.gen || 0;
      const want = async (ph, ms) => {
        const end = performance.now() + ms;
        while (performance.now() < end) {
          if (!B || (STEST.gen || 0) !== g0) return false;
          if (ph.includes(B.phase)) return true;
          if (B.phase === 'playing') tapMsg();
          await stSleep(120);
        }
        return false;
      };
      const tb = performance.now();
      if (!(await want(['choose'], 45000))) throw new Error(`never got to the menu (${B ? B.phase : 'no battle'})`);
      const fmt = B.fmt,
        mine = liveK(0).length,
        theirs = liveK(1).length;
      let plates = 0;
      for (let i = 0; i < 40 && plates < mine + theirs; i++) {
        plates = document.querySelectorAll('#plates .bplate:not(.off)').length;
        if (plates < mine + theirs) await stSleep(150);
      } /* a plate shows once its fighter is drawn */
      if (kind === 'double' && (fmt !== 'double' || theirs < 2))
        throw new Error(`expected 2 against 2, got ${mine} against ${theirs} (${fmt})`);
      if (kind === 'alpha' && (fmt !== 'alpha' || mine < 2 || !A(1).boss))
        throw new Error(`expected your team against one Alpha, got ${mine} against ${theirs} (${fmt})`);
      if (plates < mine + theirs) throw new Error(`only ${plates} of ${mine + theirs} nameplates in the scene`);
      let picks = 0,
        aimed = 0;
      while (B && B.phase === 'choose' && picks < 4) {
        const m = A(B.cur),
          mid = m.moves.find(id => MOVES[id] && MOVES[id].c !== 'X') || m.moves[0];
        pickMove(mid);
        picks++;
        if (B.phase === 'target') {
          aimed++;
          pickTarget(liveK(1)[0]);
        }
        await stSleep(80);
      }
      const tt = performance.now();
      if (!(await want(['choose', 'end', 'switch'], 60000)))
        throw new Error(`the turn never finished (${B ? B.phase : 'no battle'})`);
      const turnMs = Math.round(performance.now() - tt),
        lines = B.events.length;
      stopTimers();
      setB(null);
      battleStageStop();
      render();
      await stSleep(600);
      return `${mine} against ${theirs} (${fmt}); ${plates} nameplates; ${picks} picks, ${aimed} aimed; the turn played ${lines} lines in ${(turnMs / 1000).toFixed(1)} s`;
    };
    /* v43: the seamless world: out of Sundown along its road and into the Long Grass, measuring every view change */
    if (typeof seamlessTripView === 'function' && GD.scenes.sundown && !STEST.stop)
      await phase(
        'Road: Marigold Town to Tallgrass Meadow on the ground',
        'dio',
        async () => {
          U.bench = null;
          U.tab = 'walk';
          S.route = { node: 0, prog: 0, plan: [], hold: false };
          {
            const h = mapHub(GD.scenes.sundown);
            U.roam = { id: 'sundown', node: 0, x: h[0], z: h[1] };
          }
          render();
          for (let i = 0; i < 60 && !(walkView.ready && walkView.id === 'w:sundown*'); i++) await stSleep(100);
          if (walkView.id !== 'w:sundown*')
            throw new Error('Marigold Town is not shown with its neighbours (still ' + walkView.id + ')');
          const q0 = S.queue,
            t00 = performance.now() - (NWLOG.t0 || 0);
          S.queue = [];
          setTrip(1);
          render();
          await stSleep(600);
          const views = [walkView.id];
          let unready = 0,
            shifts = 0,
            worst = 0;
          const L0 = NWLOG.ev.length;
          const per = Math.ceil(linkCost(0, 1) / 7) + 5;
          /* alpha 0.2: a road's steps follow its walk */ for (let n = 0; n < 7; n++) {
            addSteps(per, true);
            U.modal = null;
            U.mq = [];
            renderOv();
            render();
            const f0 = walkRenderer.frames,
              t0 = performance.now();
            for (let i = 0; i < 14; i++) {
              await stSleep(100);
              if (!walkView.ready) unready++;
              if (walkView.id !== views[views.length - 1]) {
                views.push(walkView.id);
                shifts++;
              }
            }
            const ms = (performance.now() - t0) / Math.max(1, walkRenderer.frames - f0);
            worst = Math.max(worst, ms);
          }
          for (let i = 0; i < 40 && !(S.route.node === 1 && S.route.prog === 0); i++) await stSleep(100);
          S.queue = q0;
          if (S.route.node !== 1)
            throw new Error('never arrived at Tallgrass Meadow (' + JSON.stringify(S.route) + ')');
          const ev = NWLOG.ev.slice(L0),
            builds = ev.filter(e => /seamless to/.test(e.msg || '')).length,
            onSpot = ev.filter(e => /built on the spot/.test(e.msg || '')).length,
            held = ev.filter(e => /painted .* ahead/.test(e.msg || '')).length;
          /* v46: the worst single frame on the way (the frame log), and whether any view had to be built on the spot */
          const sm = (NWLOG.samples || []).filter(x => x && x.t >= t00),
            wf = sm.length
              ? Math.max(
                  ...sm.map(x => (x.tasks && x.tasks.dio ? Math.max(x.tasks.dio.max || 0, x.tasks.dio.gap || 0) : 0))
                )
              : 0;
          return `${views.join(' → ')}; ${shifts} view changes (${builds} logged, ${held} prepared ahead, ${onSpot} built on the spot), ${unready ? unready + ' unready frames' : 'never unready'}, slowest stretch ${worst.toFixed(0)} ms a frame${wf ? ', worst frame ' + Math.round(wf) + ' ms' : ''}`;
        },
        8,
        120
      );
    /* v46: a room that opens in place: into Sundown's shop and out again, without leaving the town */
    if (typeof seamlessRoomMap === 'function' && GD.scenes.sundown && !STEST.stop)
      await phase(
        'A room that opens in place',
        'dio',
        async () => {
          /* v47: at noon, whatever the clock says: the shop keeps opening hours now */ const f0 =
            typeof ENV !== 'undefined' ? ENV.force : null;
          if (typeof ENV !== 'undefined') {
            ENV.force = Object.assign({}, f0 || {}, { time: 12.5 });
            if (typeof PROP_CLOCK !== 'undefined') PROP_CLOCK.t = 0;
          }
          try {
            U.bench = null;
            U.inside = null;
            U.goingIn = null;
            U.tab = 'walk';
            S.route = { node: 0, prog: 0, plan: [], hold: false };
            U.roam = null;
            render();
            for (let i = 0; i < 60 && !(walkView.ready && walkView.id === 'w:sundown*'); i++) await stSleep(100);
            if (walkView.id !== 'w:sundown*') throw new Error('Marigold Town is not shown (still ' + walkView.id + ')');
            const p = walkView.sc.props.find(p => p.act === 'shop' && p.k === 'shop');
            if (!p) throw new Error('no shop in Marigold Town');
            const C = walkData().sc,
              g = actionSpot(p, C.props[p.k], C.ppu || 34);
            walkView.pl.route = null;
            walkView.pl.x = g[0];
            walkView.pl.z = g[1];
            const t0 = performance.now();
            walkPick({ k: 'act', p, act: 'shop' });
            for (
              let i = 0;
              i < 150 && !(walkView.ready && (walkView.sc.roomOf === 'int_shop' || walkView.id === 'int_shop'));
              i++
            )
              await stSleep(100);
            const ms = performance.now() - t0;
            if (walkView.id === 'int_shop') {
              leaveRoom();
              await stSleep(1500);
              return `the room wasn’t ready in time and opened on its own (${(ms / 1000).toFixed(1)} s)`;
            }
            if (walkView.sc.roomOf !== 'int_shop')
              throw new Error('the shop’s room didn’t open (still ' + walkView.id + ')');
            await stSleep(1200);
            const sc = walkView.sc,
              c = sc.roomCut,
              I = U.inside,
              ex = [sc.exits[0][0] + c[0], sc.exits[0][1] + c[1]],
              off = I && I.door ? Math.hypot(ex[0] - I.door[0], ex[1] - I.door[1]) : 9,
              RD = roomDimming(sc);
            if (off > 0.8) throw new Error(`the room’s doorway is ${off.toFixed(1)} m from the shop’s door`);
            leaveRoom();
            for (let i = 0; i < 60 && !(walkView.ready && walkView.id === 'w:sundown*'); i++) await stSleep(100);
            if (walkView.id !== 'w:sundown*')
              throw new Error('walking out didn’t bring the town back (' + walkView.id + ')');
            return `in ${(ms / 1000).toFixed(1)} s, doorway ${off.toFixed(2)} m from the door, town dimmed ${(RD ? RD.dim : 0).toFixed(2)}, back out at the door`;
          } finally {
            if (typeof ENV !== 'undefined') {
              ENV.force = f0;
              if (typeof PROP_CLOCK !== 'undefined') PROP_CLOCK.t = 0;
            }
          }
        },
        6,
        40
      );
    /* v44: the light lab: the four light test scenes, each drawn for a second; what each kind of renderer drew, the
     lamps' maps at night, and whether WebGL refused a draw (a sampler fed the wrong texture shows as a thing missing) */
    if (GD.scenes.test_light_terrain && typeof EGL !== 'undefined' && EGL.gl && !STEST.stop)
      await phase(
        'Light lab: the land, a room, props, the air',
        'dio',
        async () => {
          const gl = EGL.gl,
            proto = Object.getPrototypeOf(gl),
            ge = proto.getError,
            O = {};
          let refused = 0,
            last = '';
          for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
            O[k] = gl[k];
            const f = proto[k];
            gl[k] = function (...a) {
              const r = f.apply(gl, a);
              const e = ge.call(gl);
              if (e) {
                refused++;
                last = k + ' ' + e;
              }
              return r;
            };
          }
          const out = [];
          try {
            for (const [id, t] of [
              ['test_light_terrain', 17],
              ['test_light_props', 16],
              ['test_light_room', 13],
              ['test_light_room', 23],
              ['test_light_air', 17.5],
            ]) {
              if (STEST.stop) break;
              if (typeof ENV !== 'undefined') ENV.force = { time: t, weather: 'clear', season: 'summer' };
              U.tab = 'walk';
              U.bench = { id, test: 1 };
              render();
              for (let i = 0; i < 60 && !(walkView.ready && walkView.id === id); i++) await stSleep(100);
              if (walkView.id !== id) throw new Error(id + ' did not open');
              /* v44b: wait until the scene has settled: ready, every voxel recipe it uses arrived, then 20 more frames
        (the first frames after a scene opens draw voxel props as their pictures while the recipes load) */
              for (let i = 0; i < 80 && !walkView.ready; i++) await stSleep(100);
              const C0 = walkData().sc.props,
                vk = (walkView.sc.props || [])
                  .filter(p => C0[p.k] && typeof C0[p.k].vox === 'string')
                  .map(p => C0[p.k].vox);
              for (let i = 0; i < 60 && typeof VOX !== 'undefined' && vk.some(k => !VOX.recipes.get(k)); i++)
                await stSleep(100);
              const f0 = walkRenderer.frames;
              for (let i = 0; i < 80 && walkRenderer.frames < f0 + 20; i++) await stSleep(100);
              await stSleep(300);
              const b = typeof BLD !== 'undefined' ? BLD.drawn || 0 : 0,
                v = typeof VOX !== 'undefined' ? VOX.drawn || 0 : 0,
                p = typeof P3D !== 'undefined' ? P3D.drawn || 0 : 0,
                lm = ((walkRenderer.X && walkRenderer.X.lampSh) || []).length,
                sc = walkView.sc;
              /* what the camera can see: a phone held upright sees the middle of the scene only, so the props check counts the
        placed things whose foot is on screen and wants each of those drawn by its renderer */
              const inView = pp => {
                const Cm = walkView.C;
                if (!Cm || !Cm.vp) return true;
                const m = Cm.vp,
                  x = pp.x,
                  z = pp.z,
                  y = standingHeightAt(x, z),
                  X = m[0] * x + m[4] * y + m[8] * z + m[12],
                  Y = m[1] * x + m[5] * y + m[9] * z + m[13],
                  W = m[3] * x + m[7] * y + m[11] * z + m[15];
                return W > 0 && Math.abs(X / W) < 0.92 && Math.abs(Y / W) < 0.92;
              };
              const seen = (sc.props || []).filter(inView),
                wantB = seen.filter(pp => C0[pp.k] && C0[pp.k].build).length,
                wantV = seen.filter(pp => C0[pp.k] && C0[pp.k].vox && pp.vox !== 'card').length;
              if (id === 'test_light_props' && (b < wantB || v < wantV || !wantB))
                throw new Error(
                  `props in view: ${b} of ${wantB} buildings and ${v} of ${wantV} voxel props drawn (${p} solid props)`
                );
              if (id === 'test_light_room' && t === 23 && !lm)
                throw new Error('no lamp shadow map in the room at night');
              out.push(
                `${(sc.name || id).replace(/^Test: /, '')} ${Math.floor(t)}:${t % 1 ? String(Math.round((t % 1) * 60)).padStart(2, '0') : '00'} — ${b} buildings, ${v} voxels, ${p} solids drawn (${seen.length} placed things in view), ${lm} lamp map(s)`
              );
            }
          } finally {
            for (const k in O) gl[k] = O[k];
            if (typeof ENV !== 'undefined') ENV.force = null;
            U.bench = null;
            render();
          }
          if (refused) throw new Error(refused + ' draw calls refused by WebGL (last: ' + last + ')');
          return out.join('; ') + '; no draw call refused';
        },
        6,
        120
      );
    await phase('Battle on the 3D stage', 'scene', () => battle(false), 7, 120);
    await phase('Battle on a painted stage', 'scene', () => battle(true), 5, 120);
    await phase('Double battle with a trainer', 'scene', () => teamBattle('double'), 8, 150);
    await phase('Alpha battle: your team against one', 'scene', () => teamBattle('alpha'), 8, 150);
    /* v47: the opening's fall across the Hollow Earth (the world map's renderer, flying past the Inner Sun), timed */
    if (typeof fallMap === 'function' && !STEST.stop)
      await phase(
        'Opening: falling across the Hollow Earth',
        'map',
        async () => {
          U.bench = null;
          U.inside = null;
          if (typeof walkView !== 'undefined' && walkView.cv) stopWalkView();
          const cv = fallGL();
          if (!cv) {
            U.tab = 'walk';
            render();
            return 'no 3D here: the opening shows the fall as pictures';
          }
          cv.hidden = false;
          cv.classList.add('in');
          CS.on = true;
          CS.run++;
          const run = CS.run,
            fr = [],
            mr = worldMapGlRender;
          let last = performance.now();
          setWorldMapGlRender(t => {
            const n = performance.now();
            fr.push(n - last);
            last = n;
            mr(t);
          });
          try {
            await fallMap(run, 6000);
          } finally {
            setWorldMapGlRender(mr);
            CS.on = false;
            CS.run++;
          }
          U.tab = 'walk';
          render();
          await stSleep(1200);
          if (fr.length < 3) throw new Error(`the fall drew ${fr.length} frames`);
          const a = fr.slice(2),
            avg = a.reduce((x, y) => x + y, 0) / a.length;
          return `${fr.length} frames, ${Math.round(1000 / avg)} fps, worst frame ${Math.round(Math.max(...a))} ms`;
        },
        6,
        40
      );
    /* v47: Blake's first battle: Hazel's first tip shows, a turn plays, and after it Blake and Hazel talk and your team is healed */
    if (TRAINERS.blake0 && !STEST.stop)
      await phase(
        'Opening: Blake’s first battle',
        'scene',
        async () => {
          U.bench = null;
          U.inside = null;
          U.tab = 'walk';
          S.route.node = back.node;
          render();
          await stSleep(1200);
          let od = null;
          try {
            od = localStorage.getItem('nw-opening-done');
          } catch (e) {}
          const story0 = JSON.stringify(S.story || {});
          S.team.forEach(m => {
            m.hp = maxHp(m);
            m.status = null;
          });
          startTrainer('blake0', { talked: true });
          const g0 = STEST.gen || 0,
            want = async (ph, ms) => {
              const end = performance.now() + ms;
              while (performance.now() < end) {
                if (!B || (STEST.gen || 0) !== g0) return false;
                if (ph.includes(B.phase)) return true;
                if (B.phase === 'playing') tapMsg();
                await stSleep(150);
              }
              return false;
            };
          try {
            if (!(await want(['choose'], 45000)))
              throw new Error(`never got to the menu (${B ? B.phase : 'no battle'})`);
            const tip = !!document.querySelector('#btip.on'),
              foe = A(1),
              fm = foe ? foe.moves.join(',') : '';
            pickMove(A(0).moves[0]);
            if (!(await want(['choose', 'end', 'switch'], 60000)))
              throw new Error(`the turn never finished (${B ? B.phase : 'no battle'})`);
            const tip2 = (document.querySelector('#btip') || {}).textContent || '';
            stopTimers();
            B.over = 'win';
            endBattle();
            let said = 0;
            for (let i = 0; i < 120 && !(said && !TALK.on); i++) {
              if (TALK.cur) {
                said++;
                TALK.cur.tap();
              }
              await stSleep(200);
            }
            const st = (S.story || {}).rival0,
              healed = S.team.every(m => m.hp === maxHp(m));
            if (!tip) throw new Error('Hazel’s first tip didn’t show');
            if (!said) throw new Error('nobody spoke after the battle');
            if (st !== 'win') throw new Error('the story didn’t carry on (rival0 ' + st + ')');
            if (!healed) throw new Error('the team wasn’t healed');
            return `tip shown; Blake’s Billie knows ${fm}; after a turn: ${tip2 ? '“' + tip2.replace(/^Professor Hazel/, '').slice(0, 60) + '…”' : 'no new tip'}; ${said} lines after; healed`;
          } finally {
            if (B) {
              stopTimers();
              setB(null);
              battleStageStop();
            }
            talkHide();
            if (typeof battleTipHide === 'function') battleTipHide();
            S.story = JSON.parse(story0);
            U.welcome = null;
            U.modal = null;
            U.mq = [];
            renderOv();
            try {
              if (od == null) localStorage.removeItem('nw-opening-done');
              else localStorage.setItem('nw-opening-done', od);
            } catch (e) {}
            render();
            await stSleep(500);
          }
        },
        10,
        150
      );
    /* v33: the billionaires out in the world: the wild ones move about in the grass, your buddy keeps up, trainers' companions stand by */
    if (typeof worldBillies !== 'undefined')
      await phase(
        'Billies in the world',
        'dio',
        async () => {
          const gid = GD.scenes.longgrass ? 'longgrass' : scenes[0];
          S.queue = (S.queue || []).slice(0, 0);
          for (let i = 0; i < 3; i++) spawn(false);
          U.tab = 'walk';
          U.bench = null;
          const node = ROUTE.findIndex(r => r.scene === gid);
          if (node >= 0) S.route.node = node;
          render();
          for (let i = 0; i < 80 && !(walkView.ready && walkView.id === gid); i++) await stSleep(100);
          await stSleep(1500);
          const p0 = Object.fromEntries(Object.entries(walkView.enc).map(([k, v]) => [k, [v.x, v.z]]));
          await stSleep(8000);
          const moved = Object.entries(walkView.enc).filter(
              ([k, v]) => p0[k] && Math.hypot(v.x - p0[k][0], v.z - p0[k][1]) > 0.3
            ).length,
            shown = Object.keys(worldBillies.mons).length;
          if (moved) throw new Error(moved + ' wild Billie(s) left their spot in 8 s (they should stand still)');
          const P = walkView.pl,
            hb = mapHub(walkView.sc);
          walkTo([clamp(hb[0] + 4, 1, walkView.sc.w - 1), clamp(hb[1] + 2, 1, walkView.sc.h - 1)]);
          await stSleep(3500);
          const b = worldBillies.bud,
            gap = b ? Math.hypot(b.x - P.x, b.z - P.z) : null;
          if (b) buddyTap();
          const said = worldBillies.say;
          const pets = Object.values(TRAINERS).filter(T => companionSpecies(T)).length;
          if (!shown) throw new Error('no Billies shown in the grass (' + (walkView.st.enc || []).length + ' hiding)');
          if (b && gap > 4) throw new Error(`your buddy fell ${gap.toFixed(1)} m behind`);
          return `${shown} in the grass, all still on their spots after 8 s; buddy ${b ? `${gap.toFixed(1)} m behind you, said “${said.slice(0, 60)}”` : 'off'}; ${pets} trainers have a companion`;
        },
        6
      );
    /* 3. the world map, 3D and flat */
    await phase(
      'World map',
      'map',
      async () => {
        U.tab = 'map';
        render();
        await stSleep(3500);
        const fl = document.querySelector('[data-a=mflat]');
        if (fl) {
          fl.click();
          await stSleep(2500);
          fl.click();
        }
        await stSleep(1500);
        U.tab = 'walk';
        render();
        await stSleep(500);
      },
      8
    );
    /* v32: the stops as 3D miniatures, looked at from close by */
    await phase(
      'World map: 3D miniatures up close',
      'map',
      async () => {
        if (typeof worldMapMinisOn !== 'function' || !worldMapMinisOn()) return 'switched off';
        U.tab = 'map';
        render();
        await stSleep(2500);
        if (!worldMap.gl) {
          U.tab = 'walk';
          render();
          return 'the map is in its simple mode here';
        }
        const a0 = worldMap.alt;
        worldMap.alt = 0.035;
        worldMap.tilt = 0.4;
        worldMapGl.altT = null;
        worldMap.dirty = true;
        await stSleep(3000);
        const n = [...worldMapMinis.cache.values()].filter(e => e.m).length;
        worldMap.alt = a0;
        worldMap.tilt = 0.5733;
        worldMap.dirty = true;
        U.tab = 'walk';
        render();
        await stSleep(500);
        return n ? `${n} miniatures built` : false;
      },
      6
    );
    /* v41: what the run left behind: pictures on the graphics card, the ground pictures kept, the JS heap */
    await phase(
      'Memory after the run',
      'dio',
      async () => {
        const vxn = typeof VOX !== 'undefined' ? VOX.meshes.size : 0,
          wn =
            typeof seamlessWorld !== 'undefined'
              ? [...seamlessWorld.cache.keys()].filter(k => k.startsWith('w:')).length
              : 0;
        const mb = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
          tex = typeof EGL !== 'undefined' && EGL.texB ? Math.round(EGL.texB / 1048576) : null,
          ntex = typeof EGL !== 'undefined' && EGL.texL ? EGL.texL.size : null,
          grounds = typeof GROUND_CACHE !== 'undefined' ? GROUND_CACHE.size : null,
          gw =
            typeof GROUND_CACHE !== 'undefined'
              ? [...GROUND_CACHE.values()].reduce((a, g) => a + (g && g.width ? g.width * g.height * 4 : 0), 0)
              : 0,
          lost = typeof EGL !== 'undefined' && EGL.gl && EGL.gl.isContextLost();
        if (lost) throw new Error('the WebGL context was lost during the run');
        return [
          tex != null ? `${tex} MB of pictures on the card (${ntex})` : '',
          grounds != null
            ? `${grounds} ground picture${grounds === 1 ? '' : 's'} kept (${Math.round(gw / 1048576)} MB)`
            : '',
          mb != null ? `JS heap ${mb} MB` : '',
          typeof TR_CACHE !== 'undefined' ? `${TR_CACHE.size} people pictures` : '',
          `${vxn} voxel meshes`,
          `${wn} road views kept`,
        ]
          .filter(Boolean)
          .join(', ');
      },
      1
    );
    /* 7. stress: more and more at once in Sundown, until the device can't keep up (not in the diagnostics test) */
    if (!diag) {
      const sid = GD.scenes.sundown ? 'sundown' : scenes[0],
        sc = mapById(sid),
        folk0 = sc.folk,
        props0 = sc.props,
        eng0 = GD.engine ? GD.engine.defaults : null;
      unblock();
      U.tab = 'walk';
      U.bench = { id: sid };
      render();
      await stSleep(1200);
      unblock();
      const steps = [
        ['Normal', () => {}],
        [
          'A crowd (40 people)',
          () => {
            sc.folk = 40;
          },
        ],
        [
          'Crowd and 600 particles',
          () => {
            for (let i = 0; i < 600; i++)
              walkView.parts.push({
                k: i % 2 ? 'leaf' : 'smoke',
                fr: i % 3,
                x: Math.random() * sc.w,
                y: 2 + Math.random() * 3,
                z: Math.random() * sc.h,
                vx: (Math.random() - 0.5) * 0.6,
                vy: 0.2,
                vz: (Math.random() - 0.5) * 0.6,
                g: 0.15,
                life: 0,
                max: 30,
              });
          },
        ],
        [
          'Plus 150 more trees and rocks',
          () => {
            const pool = ['tree_oak', 'tree_pine', 'tree_birch', 'boulder', 'bush_round', 'tree_oak_deep'].filter(
              k => walkData().sc.props[k]
            );
            sc.props = props0.concat(
              Array.from({ length: 150 }, (_, i) => ({
                k: pool[i % pool.length],
                x: 1 + ((i * 7.31) % (sc.w - 2)),
                z: 1 + ((i * 3.77) % (sc.h - 2)),
                s: 0.8 + (i % 5) * 0.1,
              }))
            );
          },
        ],
        [
          'Plus maximum quality',
          () => {
            GD.engine = GD.engine || {};
            GD.engine.defaults = Object.assign({}, eng0 || {}, {
              quality: { resolution: 1.5, shadowMap: 4096, auto: false },
              grass: { density: 3 },
              lens: { bokeh: 2, blur: 1 },
              shadows: { ao: 1.2 },
            });
          },
        ],
      ];
      const drawing = async () => {
        if (!(typeof walkRenderer !== 'undefined' && walkRenderer.on)) return true;
        const f = walkRenderer.frames;
        await stSleep(1500);
        return walkRenderer.frames > f;
      };
      if (!(await drawing())) {
        stress.push({
          name: 'Skipped: the scene isn’t drawing',
          fpsAvg: null,
          fpsWorst: null,
          cpuMs: null,
          slow: 0,
          seconds: 0,
        });
        NWLOG.error('test', 'Stress test skipped: the scene isn’t drawing');
        steps.length = 0;
      }
      for (const [name, fn] of steps) {
        if (STEST.stop) break;
        stepEl.textContent = 'Stress test: ' + name;
        NWLOG.bench.step = 'stress: ' + name;
        try {
          fn();
        } catch (e) {}
        await stSleep(800);
        await walkAbout(2); /* new people and props are drawn the first time they appear; measure after that */
        let st = null;
        for (let a = 0; a < 3 && !STEST.stop; a++) {
          await awake();
          stepEl.textContent = 'Stress test: ' + name;
          const h0 = hid,
            t0 = NWLOG.now();
          await walkAbout(5);
          st = stStats(t0, NWLOG.now(), 'dio');
          if (hid === h0) break;
          st.notMeasured = a === 2 || undefined;
        } /* v47: measured again after a spell in the background */
        stress.push(Object.assign({ name }, st));
        tick(8);
      }
      sc.folk = folk0;
      sc.props = props0;
      if (GD.engine) GD.engine.defaults = eng0;
      walkView.parts.length = 0;
    }
  } finally {
    STEST.only = only0;
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    }
    if (B) {
      stopTimers();
      setB(null);
      battleStageStop();
    }
    if (typeof CS !== 'undefined' && CS.on) {
      CS.test = false;
      csTeardown();
    }
    if (typeof DR !== 'undefined' && DR.on) closeDressing();
    if (STEST.offVis) {
      STEST.offVis();
      STEST.offVis = null;
    }
    if (engKeep) GD.engine = JSON.parse(engKeep);
    setS(JSON.parse(keep));
    setSave(realSave);
    U.bench = null;
    U.roam = back.roam;
    U.tab = back.tab;
    U.modal = null;
    U.mq = [];
    renderOv();
    render();
    STEST.on = false;
    box.remove();
  }
  const errors = NWLOG.err
      .slice(errs0)
      .filter(e => e.kind !== 'test')
      .map(e => e.msg)
      .slice(0, 12),
    okAll = phases.every(p => p.ok) && !errors.length;
  const keepUp = stress.filter(s => s.fpsAvg != null && s.fpsAvg >= 28).pop();
  NWLOG.bench.step = null;
  NWLOG.bench.result = {
    kind: diag ? 'diagnostics' : 'full',
    diag: diag ? DIAGR : undefined,
    stopped: STEST.stop,
    seconds: Math.round((NWLOG.now() - T0) / 1000),
    passed: okAll,
    phases,
    stress,
    errors,
    device: NWLOG.device ? NWLOG.device() : null,
  };
  NWLOG.add('bench', STEST.stop ? 'stopped' : okAll ? 'passed' : 'problems found');
  const f = v => (v == null ? '–' : v),
    ctxLine = c =>
      c
        ? [
            c.view,
            c.scene && 'scene ' + c.scene,
            c.renderer,
            (c.errors || [])[0],
            (c.slow || []).slice(-1)[0] && 'slow: ' + (c.slow || []).slice(-1)[0],
          ]
            .filter(Boolean)
            .join(' · ')
        : '';
  const rows = phases
    .map(
      p =>
        `<tr><td>${esc(p.name)}${p.note ? `<small>${esc(p.note)}</small>` : ''}${p.detail ? `<small class="nb-det">${esc(p.detail)}</small>` : ''}${!p.ok ? `<small class="nb-why">Why: ${esc(p.why || '')}${p.ctx ? `<br>Where: ${esc(ctxLine(p.ctx))}` : ''}</small>` : ''}</td><td class="tnum">${f(p.fpsAvg)}</td><td class="tnum">${f(p.fpsWorst)}</td><td class="${p.notMeasured ? 'nb-skip' : p.ok ? 'nb-ok' : 'nb-bad'}">${p.notMeasured ? 'Not measured' : p.ok ? 'OK' : 'Problem'}</td></tr>`
    )
    .join('');
  const causes = Object.entries(NWLOG.causes)
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 6);
  const srows = stress
    .map(
      s =>
        `<tr><td>${esc(s.name)}</td><td class="tnum">${f(s.fpsAvg)}</td><td class="tnum">${f(s.fpsWorst)}</td><td class="tnum">${f(s.cpuMs)}</td></tr>`
    )
    .join('');
  modal({
    title: STEST.stop ? 'Test stopped' : okAll ? 'Everything works' : 'The test found problems',
    html: `<p class="note">Frames per second (higher is smoother; most screens show at most 60).</p>
  <table class="nb-table"><thead><tr><th>What</th><th>Average</th><th>Worst</th><th>Result</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nothing was measured.</td></tr>'}</tbody></table>
  ${srows ? `<h3>Stress test</h3><p class="note">${keepUp ? `This device keeps up (28+ frames per second) up to: <b>${esc(keepUp.name)}</b>.` : 'This device struggled from the first step.'}</p><table class="nb-table"><thead><tr><th>Load</th><th>Average</th><th>Worst</th><th>ms per frame</th></tr></thead><tbody>${srows}</tbody></table>` : ''}
  ${causes.length ? `<h3>What made frames slow</h3><p class="note">Every frame over 33 ms, put down to what the game was busy with at the time.</p><table class="nb-table"><thead><tr><th>Busy with</th><th>Frames</th><th>Worst</th></tr></thead><tbody>${causes.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="tnum">${v.n}</td><td class="tnum">${Math.round(v.max)} ms</td></tr>`).join('')}</tbody></table>` : ''}
  ${errors.length ? `<h3>Errors</h3><ul class="nb-errs">${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}<p class="note">Your save wasn't changed. Export the debug log to send these results with your device's details.</p>`,
    btns: diag
      ? [
          {
            l: 'Save the report',
            c: 'gold',
            f: () => {
              closeModal();
              exportDiagReport();
            },
          },
          { l: 'Close', c: 'quiet', f: closeModal },
        ]
      : [
          {
            l: 'Export debug log',
            c: 'gold',
            f: () => {
              closeModal();
              exportDebugLog();
            },
          },
          { l: 'Close', c: 'quiet', f: closeModal },
        ],
  });
}
const runQuickTest = runFullTest;
provide({ runQuickTest }); /* to-module */

/* ================= DIAGNOSTICS TEST (alpha 0.4) =================
   Next to the full test in Settings, about two minutes: the device and how the automatic quality chose its level, six
   places picked from the data to cover the hardest cases (the busiest town, the biggest route, a room, a cave, a place
   you ride across, a new place: time to the first frame and the worst frame), where a frame's time goes, memory after,
   a battle's start, what rain and night cost, and any errors. It saves a compact report made to be read (not the whole
   debug log). Like the full test it leaves your save alone and waits for you if the app goes to the background. */
const STD_EMPTY = () => ({ device: null, busiest: null, places: [], passes: null, weather: null });
let DIAGR = STD_EMPTY();
function runDiagTest() {
  return runFullTest('diag');
}
function stDiagScenes() {
  const sc = GD.scenes,
    ids = Object.keys(sc).filter(id => mapById(id) && !sc[id].test && !sc[id].backup && !id.includes('@')),
    pick = [],
    add = id => {
      if (id && !pick.includes(id)) pick.push(id);
    };
  const kindOf = id => sc[id].kind || (typeof placeKind === 'function' ? placeKind(id) : null);
  const towns = ids.filter(id => kindOf(id) === 'town'),
    routes = ids.filter(id => kindOf(id) === 'route');
  const busiest = towns.slice().sort((a, b) => (sc[b].props || []).length - (sc[a].props || []).length)[0];
  add(busiest);
  add(routes.slice().sort((a, b) => sc[b].w * sc[b].h - sc[a].w * sc[a].h)[0]);
  add(ids.find(id => /^int_/.test(id) && (sc[id].props || []).length > 8));
  add(ids.find(id => (sc[id].under || sc[id].far === 'cave') && kindOf(id) !== 'room'));
  add(ids.find(id => sc[id].ride));
  add(ids.find(id => sc[id].a04pearl) || ids.find(id => sc[id].a04place));
  DIAGR.busiest = busiest;
  DIAGR.places = pick;
  return pick;
}
/* timers round the render passes: the processor's time for each, and the graphics chip's own (EXT_disjoint_timer_query_webgl2) */
const DIAG_PASSES = {
  shadows: ['shadowPass'],
  ground: ['drawGround'],
  grass: ['drawGrass'],
  props: ['drawSprites', 'p3dDraw', 'voxDraw', 'bldDraw', 'drawBoxFaces', 'strDraw'],
  water: ['reflectionPass', 'drawWater'],
  effects: ['effectsPass'],
  'final pass': ['eglPost'],
};
function diagTimersOn() {
  const gl = typeof EGL !== 'undefined' ? EGL.gl : null,
    ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    T = {
      gl,
      ext,
      orig: {},
      cpu: {},
      q: [],
      active: false,
      f0: typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0,
    };
  for (const [grp, names] of Object.entries(DIAG_PASSES)) {
    T.cpu[grp] = 0;
    for (const n of names) {
      // phase 05: through the debug log's view of the modules (window has them only with the test globals on)
      const o = GAME[n];
      if (typeof o !== 'function') continue;
      T.orig[n] = o;
      GAME[n] = function (...a) {
        const t0 = performance.now();
        let q = null;
        if (T.ext && !T.active) {
          try {
            q = gl.createQuery();
            gl.beginQuery(T.ext.TIME_ELAPSED_EXT, q);
            T.active = true;
          } catch (e) {
            q = null;
          }
        }
        try {
          return o.apply(this, a);
        } finally {
          if (q) {
            gl.endQuery(T.ext.TIME_ELAPSED_EXT);
            T.active = false;
            T.q.push([grp, q]);
          }
          T.cpu[grp] += performance.now() - t0;
        }
      };
    }
  }
  return T;
}
async function diagTimersOff(T) {
  for (const [n, o] of Object.entries(T.orig)) GAME[n] = o;
  const frames = Math.max(1, (typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0) - T.f0),
    cpu = {};
  for (const [k, v] of Object.entries(T.cpu)) if (v > 0) cpu[k] = Math.round((v / frames) * 100) / 100;
  let gpu = null;
  if (T.ext && T.q.length) {
    await stSleep(400);
    const sum = {};
    let ok = 0;
    const disj = T.gl.getParameter(T.ext.GPU_DISJOINT_EXT);
    for (const [g, q] of T.q) {
      if (T.gl.getQueryParameter(q, T.gl.QUERY_RESULT_AVAILABLE)) {
        sum[g] = (sum[g] || 0) + T.gl.getQueryParameter(q, T.gl.QUERY_RESULT) / 1e6;
        ok++;
      }
      T.gl.deleteQuery(q);
    }
    if (ok && !disj) {
      gpu = {};
      const per = ok / Object.keys(sum).length;
      for (const [k, v] of Object.entries(sum)) gpu[k] = Math.round((v / Math.max(1, frames)) * 100) / 100;
    }
  }
  return { frames, cpu, gpu };
}
/* the report: what was measured, short, made to be read */
function diagReport() {
  const R = NWLOG.bench && NWLOG.bench.result;
  if (!R) return null;
  const P = R.phases || [];
  const pl = P.filter(p => p.name.startsWith('Walk: ')).map(p => ({
    place: p.name.slice(6),
    opened: p.note,
    fps: p.fpsAvg,
    worstFps: p.fpsWorst,
    worstFrameMs: p.worstFrameMs || null,
    slow: p.slowCauses,
    ok: p.ok,
    why: p.why,
  }));
  const one = n => {
    const p = P.find(q => q.name.startsWith(n));
    return p ? { note: p.note, detail: p.detail, ok: p.ok, why: p.why, fps: p.fpsAvg } : null;
  };
  return {
    game: 'Pocket Billies',
    kind: 'diagnostics',
    format: 1,
    build: typeof NW_BUILD !== 'undefined' ? NW_BUILD : null,
    created: new Date().toISOString(),
    seconds: R.seconds,
    passed: R.passed,
    device: (R.diag || DIAGR).device,
    places: pl,
    frame: (R.diag || DIAGR).passes,
    rainAndNight: (R.diag || DIAGR).weather,
    battle: one('Battle on the 3D stage'),
    memory: one('Memory'),
    errors: R.errors,
  };
}
async function exportDiagReport() {
  const r = diagReport();
  if (!r) {
    toast('Run the diagnostics test first.');
    return;
  }
  const data = JSON.stringify(r, null, 1),
    d = new Date(),
    pad = n => String(n).padStart(2, '0'),
    name = `pocket-billies-diagnostics-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  if (typeof NWLOG !== 'undefined') NWLOG.add('export', name);
  try {
    const f = new File([data], name, { type: 'application/json' });
    if (
      navigator.canShare &&
      navigator.canShare({ files: [f] }) &&
      /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
    ) {
      await navigator.share({ files: [f], title: 'Pocket Billies diagnostics' });
      toast('Report shared.');
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
    toast('Report saved to your downloads.');
    return;
  } catch (e) {}
  try {
    await navigator.clipboard.writeText(data);
    toast('The report was copied. Paste it into a text file.');
  } catch (e) {
    toast('This browser can’t save files here.');
  }
}
