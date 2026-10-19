'use strict';
/* ================= WORLD MAP TEST (phase 10) =================
   Settings → Help → "Run the world map test", and the debug menu's "Bowl map test": checks the bowl world map
   (world-bowl.js) on this device, by hand. It is not part of
   any check, CI job or hook: in a headless browser the bowl is drawn in software and the frame numbers mean nothing.
   1. the bowl's shaders compile and link,
   2. the Map tab opens as the bowl and keeps drawing,
   3. every place has a spot on the bowl (Pearlantis under Kelpport) and the whole-bowl view shows them,
   4. tapping each place's pin opens that place's card,
   5. dragging, pinching, turning and tilting never take the camera below the rim line or out of the bowl,
   6. Home brings the camera back over where you are,
   7. the frame rate and the time each frame takes: the whole bowl, close up while turning, and while panning,
   8. no errors were logged while it ran.
   Your save is never changed (saving is paused while it runs, as in the full test) and the map is put back as it
   was. The report holds no save data and no names: only place ids from the game's data, numbers and errors. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { $ } from './util.js';
import { LOCATIONS } from './game-data.js';
import { BOWL_RIM_HEIGHT } from './logic/bowl.js';
import {
  BOWL_CAMERA,
  bowlCamHome,
  bowlCamOverview,
  bowlCamPan,
  bowlCamProject,
  bowlCamTurn,
  bowlCamView,
  bowlCamZoom,
  bowlToGpu,
} from './logic/bowl-camera.js';
import { activeBattle, escapeHtml, pauseSaving, resumeSaving, saveData, uiState } from './game-state.js';
import { ensurePrograms, gpuState } from './engine/webgl.js';
import {
  WORLD_BOWL_SHADERS,
  worldBowl,
  worldBowlPick,
  worldMap,
  worldMapHeight,
  worldMapReset,
  worldMapWidth,
} from './world-bowl.js';
import { closeModal, modal, render, toast } from './ui.js';
import { selfTest, shareReportFile } from './self-test.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_TEST_MEASURE_MS: [() => BOWL_TEST_MEASURE_MS],
  bowlMapTest: [() => bowlMapTest],
  bowlMapTestReport: [() => bowlMapTestReport, v => (bowlMapTestReport = v)],
  bowlMapTestShow: [() => bowlMapTestShow, v => (bowlMapTestShow = v)],
  bowlTestFrames: [() => bowlTestFrames, v => (bowlTestFrames = v)],
  bowlTestMeasure: [() => bowlTestMeasure, v => (bowlTestMeasure = v)],
  bowlTestWait: [() => bowlTestWait],
  exportBowlMapReport: [() => exportBowlMapReport, v => (exportBowlMapReport = v)],
  runBowlMapTest: [() => runBowlMapTest, v => ((runBowlMapTest = v), provide({ runBowlMapTest }))],
});
/* eslint-enable no-func-assign */
provide({ runBowlMapTest });
/* to-module: end */
const bowlMapTest = { on: false, stop: false, result: null };

const BOWL_TEST_MEASURE_MS = 3000;
const bowlTestWait = ms => new Promise(r => setTimeout(r, ms));
/* wait until the bowl has drawn n more frames (or give up after ms) */
async function bowlTestFrames(n, ms = 3000) {
  const f0 = worldBowl.frames,
    t0 = performance.now();
  worldBowl.dirty = true;
  while (worldBowl.frames < f0 + n && performance.now() - t0 < ms) {
    worldBowl.dirty = true;
    await new Promise(r => requestAnimationFrame(r));
  }
  return worldBowl.frames - f0;
}
/* frames per second, the worst gap between frames and the time a frame takes to draw (CPU), over ms */
async function bowlTestMeasure(ms) {
  const f0 = worldBowl.frames;
  await bowlTestWait(ms);
  const n = Math.min(worldBowl.frames - f0, worldBowl.ts.length),
    ts = worldBowl.ts.slice(-n),
    dm = worldBowl.ms.slice(-n);
  if (n < 3) return { frames: n, fps: null, worstMs: null, drawMs: null };
  let worst = 0;
  for (let i = 1; i < ts.length; i++) worst = Math.max(worst, ts[i] - ts[i - 1]);
  const r1 = v => Math.round(v * 10) / 10;
  return {
    frames: n,
    fps: r1(((ts.length - 1) * 1000) / (ts[ts.length - 1] - ts[0])),
    worstMs: Math.round(worst),
    drawMs: r1(dm.reduce((a, b) => a + b, 0) / dm.length),
  };
}

async function runBowlMapTest() {
  if (bowlMapTest.on || selfTest.on) return;
  if (typeof activeBattle !== 'undefined' && activeBattle) {
    toast('Finish the battle first.');
    return;
  }
  if (!saveData.started) {
    toast('Start a game first.');
    return;
  }
  bowlMapTest.on = true;
  bowlMapTest.stop = false;
  selfTest.on = true; /* the full test's guards (friends, saving, pop-ups) hold for this test too */
  pauseSaving();
  const back = { tab: uiState.tab, sel: uiState.mapSel, cam: worldBowl.cam },
    T0 = performance.now(),
    errs0 = debugLog.err.length,
    steps = [];
  const box = document.createElement('div');
  box.className = 'nw-bench px glass';
  box.innerHTML =
    '<b>Bowl map test</b><span class="nb-step">Getting ready…</span><span class="nb-bar"><i></i></span><button class="pb small quiet" type="button">Stop</button>';
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => {
    bowlMapTest.stop = true;
  };
  const stepEl = box.querySelector('.nb-step'),
    bar = box.querySelector('.nb-bar i'),
    TOTAL = 8;
  const step = async (name, fn) => {
    if (bowlMapTest.stop) return;
    stepEl.textContent = name;
    bar.style.width = `${Math.round((steps.length / TOTAL) * 100)}%`;
    const t = performance.now();
    let ok = true,
      note = '';
    try {
      const r = await fn();
      if (r === false) ok = false;
      else if (r && typeof r === 'object' && 'ok' in r) {
        ok = r.ok;
        note = r.note;
      } else note = r == null ? '' : String(r);
    } catch (e) {
      ok = false;
      note = (e && e.message) || String(e);
    }
    steps.push({ name, ok, note, ms: Math.round(performance.now() - t) });
    if (typeof debugLog !== 'undefined') debugLog.add('bowltest', `${ok ? 'ok' : 'FAIL'} ${name}: ${note}`);
  };
  const W = () => worldMapWidth,
    H = () => worldMapHeight,
    still = s => {
      worldBowl.goal = null;
      worldBowl.cam = s;
      worldBowl.dirty = true;
    },
    measures = {};
  try {
    await step('The bowl’s shaders compile', () => {
      ensurePrograms(WORLD_BOWL_SHADERS);
      const miss = Object.keys(WORLD_BOWL_SHADERS).filter(k => !gpuState.P || !gpuState.P[k]);
      if (miss.length) return { ok: false, note: `missing: ${miss.join(', ')}` };
      return `${Object.keys(WORLD_BOWL_SHADERS).join(' and ')} compiled and linked`;
    });
    await step('The Map tab opens as the bowl', async () => {
      uiState.mapSel = null;
      uiState.tab = 'map';
      render();
      const t = performance.now();
      while (!worldBowl.on && performance.now() - t < 4000) await bowlTestWait(100);
      if (!worldBowl.on) return { ok: false, note: 'no WebGL here: the map shows the Places list' };
      const n = await bowlTestFrames(10, 4000),
        r = worldMap.cv.getBoundingClientRect(),
        open = [0.2, 0.3, 0.4, 0.5].some(fy =>
          [0.3, 0.5, 0.7].some(fx => document.elementFromPoint(innerWidth * fx, innerHeight * fy) === worldMap.cv)
        );
      if (r.height < innerHeight * 0.9 || !open)
        return { ok: false, note: `touches don't reach the map (its layer is ${Math.round(r.height)} px high)` };
      return n >= 10
        ? `opened in ${Math.round(performance.now() - t)} ms, drawing`
        : { ok: false, note: `${n} frames in 4 s` };
    });
    if (!worldBowl.on) bowlMapTest.stop = true;
    await step('Every place is on the bowl', async () => {
      const S = worldBowl.spots || [],
        bad = LOCATIONS.filter(
          (l, i) => !S[i] || !isFinite(S[i].x) || !isFinite(S[i].y) || Math.hypot(S[i].x, S[i].y) > 1
        );
      if (S.length !== LOCATIONS.length || bad.length)
        return {
          ok: false,
          note: `${S.length} spots for ${LOCATIONS.length} places; off the bowl: ${bad.map(l => l.id).join(', ')}`,
        };
      still(bowlCamOverview(worldBowl.cam.yaw));
      await bowlTestFrames(2);
      const v = bowlCamView(worldBowl.cam, W(), H()),
        seen = S.filter(s => {
          const q = bowlCamProject(v, bowlToGpu(s.x, s.y, s.h));
          return q && q.x >= 0 && q.x <= W() && q.y >= 0 && q.y <= H();
        }).length,
        under = S.filter(s => s.under).length;
      return `${S.length} places (${under} under another); ${seen} on screen in the whole-bowl view`;
    });
    await step('Tapping each place opens its card', async () => {
      const r = worldMap.cv.getBoundingClientRect(),
        miss = [];
      for (let i = 0; i < LOCATIONS.length && !bowlMapTest.stop; i++) {
        const s = worldBowl.spots[i];
        uiState.mapSel = null;
        worldBowl.sel = null;
        still(bowlCamHome(s.x, s.y, worldBowl.cam.yaw));
        await bowlTestFrames(2);
        const m = (worldBowl.marks || []).find(k => k.i === i);
        if (!m) {
          miss.push(`${LOCATIONS[i].id} (no pin)`);
          continue;
        }
        worldBowlPick({ clientX: r.left + m.top.x, clientY: r.top + (m.top.y + m.base.y) / 2 });
        const card = $('#mapcard');
        if (uiState.mapSel !== i)
          miss.push(`${LOCATIONS[i].id} (got ${uiState.mapSel == null ? 'nothing' : LOCATIONS[uiState.mapSel].id})`);
        else if (!card || !card.textContent.includes(LOCATIONS[i].name)) miss.push(`${LOCATIONS[i].id} (card)`);
      }
      uiState.mapSel = null;
      return miss.length
        ? { ok: false, note: `${LOCATIONS.length - miss.length} of ${LOCATIONS.length}; missed ${miss.join(', ')}` }
        : `all ${LOCATIONS.length} places`;
    });
    await step('The camera stays above the rim', async () => {
      const limit = BOWL_RIM_HEIGHT + BOWL_CAMERA.eyeAboveRim - 1e-6;
      let low = Infinity,
        far = 0,
        n = 0,
        s = bowlCamHome(0, 0);
      const moves = [
        c => bowlCamZoom(c, 0.5),
        c => bowlCamTurn(c, 0.7, -0.6),
        c => bowlCamPan(c, bowlCamView(c, W(), H()), 220, -160),
        c => bowlCamZoom(c, 3),
        c => bowlCamTurn(c, -1.3, 0.9),
        c => bowlCamPan(c, bowlCamView(c, W(), H()), -400, 300),
        c => bowlCamZoom(c, 0.2),
        c => bowlCamTurn(c, 0.2, -2),
      ];
      for (let k = 0; k < 48 && !bowlMapTest.stop; k++) {
        s = moves[k % moves.length](s);
        still(s);
        await bowlTestFrames(1);
        const v = bowlCamView(worldBowl.cam, W(), H());
        low = Math.min(low, v.C[1]);
        far = Math.max(far, Math.hypot(worldBowl.cam.tx, worldBowl.cam.ty));
        n++;
      }
      const note = `${n} moves; lowest eye ${low.toFixed(3)} (the rim line is ${limit.toFixed(3)}); farthest target ${far.toFixed(2)}`;
      return low >= limit && far <= BOWL_CAMERA.targetMax + 1e-6 ? note : { ok: false, note };
    });
    await step('Home brings the camera back over you', async () => {
      still(bowlCamOverview(worldBowl.cam.yaw + 2));
      await bowlTestFrames(2);
      const t = performance.now();
      worldMapReset();
      while (worldBowl.goal && performance.now() - t < 4000) await bowlTestWait(50);
      const me = worldBowl.spots[saveData.trip.node],
        d = Math.hypot(worldBowl.cam.tx - me.x, worldBowl.cam.ty - me.y),
        note = `${Math.round(performance.now() - t)} ms to settle over ${LOCATIONS[saveData.trip.node].id}, ${d.toFixed(3)} off`;
      return d < 0.01 ? note : { ok: false, note };
    });
    await step('Frame rate', async () => {
      const me = worldBowl.spots[saveData.trip.node];
      still(bowlCamOverview(worldBowl.cam.yaw));
      worldBowl.bench = { turn: 0.25 };
      measures.wholeBowl = await bowlTestMeasure(BOWL_TEST_MEASURE_MS);
      still(bowlCamZoom(bowlCamHome(me.x, me.y), 0.45));
      worldBowl.bench = { turn: 0.6 };
      measures.closeTurning = await bowlTestMeasure(BOWL_TEST_MEASURE_MS);
      worldBowl.bench = { turn: 0 };
      still(bowlCamHome(me.x, me.y));
      const t0 = performance.now(),
        pan = setInterval(() => {
          const k = (performance.now() - t0) / 1000;
          worldBowl.cam = bowlCamPan(
            worldBowl.cam,
            bowlCamView(worldBowl.cam, W(), H()),
            Math.cos(k * 2) * 18,
            Math.sin(k * 2) * 18
          );
        }, 16);
      try {
        measures.panning = await bowlTestMeasure(BOWL_TEST_MEASURE_MS);
      } finally {
        clearInterval(pan);
        worldBowl.bench = null;
      }
      const f = (k, m) => `${k} ${m.fps ?? '–'} fps (worst gap ${m.worstMs ?? '–'} ms, ${m.drawMs ?? '–'} ms to draw)`,
        all = Object.values(measures);
      const note = [
        f('whole bowl', measures.wholeBowl),
        f('close up turning', measures.closeTurning),
        f('panning', measures.panning),
      ].join('; ');
      return all.every(m => m.fps != null) ? note : { ok: false, note: 'frames stopped coming: ' + note };
    });
    await step('No errors while it ran', () => {
      const E = debugLog.err.slice(errs0);
      return E.length
        ? {
            ok: false,
            note: E.slice(0, 5)
              .map(e => e.msg)
              .join(' | '),
          }
        : 'none';
    });
  } finally {
    worldBowl.bench = null;
    worldBowl.goal = null;
    if (back.cam) worldBowl.cam = back.cam;
    uiState.mapSel = back.sel;
    uiState.tab = back.tab;
    render();
    box.remove();
    resumeSaving();
    selfTest.on = false;
    bowlMapTest.on = false;
  }
  bowlMapTest.result = {
    stopped: bowlMapTest.stop,
    seconds: Math.round((performance.now() - T0) / 1000),
    steps,
    measures,
    screen: { w: worldMapWidth, h: worldMapHeight, dpr: devicePixelRatio || 1 },
  };
  bowlMapTestShow();
}

function bowlMapTestShow() {
  const R = bowlMapTest.result;
  if (!R) return;
  const failed = R.steps.filter(s => !s.ok).length,
    rows = R.steps
      .map(
        s =>
          `<tr><td>${s.ok ? '✓' : '✗'}</td><td>${escapeHtml(s.name)}<small>${escapeHtml(s.note || '')}</small></td></tr>`
      )
      .join('');
  modal({
    title: R.stopped
      ? 'Bowl map test stopped'
      : failed
        ? `Bowl map test: ${failed} failed`
        : 'Bowl map test: all passed',
    html: `<table class="nb-table"><tbody>${rows || '<tr><td colspan="2">Nothing ran.</td></tr>'}</tbody></table><p class="note">${R.seconds} s on a ${R.screen.w}×${R.screen.h} screen. Your save wasn't changed.</p>`,
    btns: [
      {
        l: 'Save the report',
        c: 'gold',
        f: () => {
          closeModal();
          exportBowlMapReport();
        },
      },
      { l: 'Close', c: 'quiet', f: closeModal },
    ],
  });
}
/* the report: the steps, the numbers and the device; no save data, no names */
function bowlMapTestReport() {
  const R = bowlMapTest.result;
  if (!R) return null;
  return {
    game: 'Pocket Billies',
    kind: 'bowl-map',
    format: 1,
    build: typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : null,
    created: new Date().toISOString(),
    device: debugLog.device ? debugLog.device() : null,
    graphics: debugLog.glInfo ? debugLog.glInfo() : null,
    ...R,
  };
}
function exportBowlMapReport() {
  const r = bowlMapTestReport();
  if (!r) {
    toast('Run the bowl map test first.');
    return;
  }
  const d = new Date(),
    pad = n => String(n).padStart(2, '0');
  return shareReportFile(
    JSON.stringify(r, null, 1),
    `pocket-billies-bowl-map-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`,
    'Pocket Billies bowl map test'
  );
}
