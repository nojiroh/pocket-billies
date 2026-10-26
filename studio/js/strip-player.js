'use strict';
/* ================= POCKET BILLIES STUDIO · frame strips played (Studio art track SA-2a) =================
   A picture the game animates as a row of frames (the walk effects, the animals and cars: logic/frame-strips.js) plays
   here as the game shows it, frame by frame, nearest-neighbour: in the Art browser's picture panel, and beside the
   pixel canvas while it is painted (it draws from the canvas being edited, so a stroke shows on the next frame).
   One requestAnimationFrame loop for every player on the page, as sprites.js's previews; Play/Pause, a step, the
   speed (frames a second, kept in this browser) and the scale. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { escapeHtml } from './game-stand-ins.js';
import { stripFrameAt } from '../../game/js/logic/frame-strips.js';
import { ACTIONS } from './studio-app.js';
import { atlasGet, loadedAtlas } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  STRIP_FPS_KEY: [() => STRIP_FPS_KEY],
  STRIP_PLAYERS: [() => STRIP_PLAYERS],
  drawStrip: [() => drawStrip, v => (drawStrip = v)],
  mountStripPlayers: [() => mountStripPlayers, v => (mountStripPlayers = v)],
  stripFpsKept: [() => stripFpsKept, v => (stripFpsKept = v)],
  stripFrameNow: [() => stripFrameNow, v => (stripFrameNow = v)],
  stripLoop: [() => stripLoop, v => (stripLoop = v)],
  stripPlayer: [() => stripPlayer],
  stripPlayerHTML: [() => stripPlayerHTML, v => (stripPlayerHTML = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the players on the page, and their shared state */
const STRIP_PLAYERS = new Set();
const STRIP_FPS_KEY = 'pb-strip-fps';
const stripPlayer = { playing: true, fps: stripFpsKept(), scale: 4, step: 0, running: false };

function stripFpsKept() {
  try {
    const v = +localStorage.getItem(STRIP_FPS_KEY);
    if (v >= 1 && v <= 30) return v;
  } catch (e) {}
  return 8;
}

/** the player's canvas and its controls for a picture whose frames are known (a Strip of logic/frame-strips.js) */
export function stripPlayerHTML(path, strip) {
  const P = stripPlayer,
    about =
      strip.from === 'life'
        ? `${escapeHtml(strip.name || '')}${strip.where ? ' · lives in ' + escapeHtml(strip.where) : ''} · scenery.life`
        : 'walk effect · walk-view.js EFFECT_FRAMES';
  return `<div class="sp-wrap"><div class="ab-thumb sp-stage"><canvas class="pix sp-cv" data-strip="${escapeHtml(JSON.stringify({ p: path, w: strip.w, h: strip.h, n: strip.n }))}" width="${strip.w}" height="${strip.h}" style="width:${strip.w * P.scale}px;height:${strip.h * P.scale}px"></canvas></div>
  <div class="seg-row sp-bar"><button class="btn sm" data-act="spPlay">${P.playing ? 'Pause' : 'Play'}</button><button class="btn sm" data-act="spStep" title="Next frame">Step ›</button><label class="sp-fps">Speed <input type="range" class="sp-fps-in" min="1" max="30" step="1" value="${P.fps}"> <span class="sp-fps-v">${P.fps}</span> fps</label><select class="sp-scale" title="Scale">${[2, 4, 8].map(s => `<option value="${s}"${s === P.scale ? ' selected' : ''}>${s}x</option>`).join('')}</select><span class="help sp-frame"></span></div>
  <p class="help">${strip.n} frames of ${strip.w}×${strip.h} px · ${about}</p></div>`;
}

/** starts the players under root: their controls and the loop */
export function mountStripPlayers(root = document) {
  root.querySelectorAll('canvas.sp-cv').forEach(c => {
    if (c._sp) return;
    c._sp = JSON.parse(c.dataset.strip);
    STRIP_PLAYERS.add(c);
    if (!c._sp.loading) {
      c._sp.loading = 1;
      atlasGet(c._sp.p)
        .then(() => drawStrip(c, performance.now()))
        .catch(() => c.classList.add('missing'));
    }
  });
  root.querySelectorAll('.sp-fps-in').forEach(i =>
    i.addEventListener('input', () => {
      stripPlayer.fps = +i.value;
      try {
        localStorage.setItem(STRIP_FPS_KEY, String(stripPlayer.fps));
      } catch (e) {}
      root.querySelectorAll('.sp-fps-v').forEach(v => (v.textContent = String(stripPlayer.fps)));
    })
  );
  root.querySelectorAll('.sp-scale').forEach(s =>
    s.addEventListener('change', () => {
      stripPlayer.scale = +s.value;
      for (const c of STRIP_PLAYERS) {
        c.style.width = c._sp.w * stripPlayer.scale + 'px';
        c.style.height = c._sp.h * stripPlayer.scale + 'px';
      }
    })
  );
  if (!stripPlayer.running) {
    stripPlayer.running = true;
    requestAnimationFrame(stripLoop);
  }
}

/* the frame a player shows now: on the clock while playing, else where the steps left it */
function stripFrameNow(o, ts) {
  if (!stripPlayer.playing) return stripPlayer.step % o.n;
  return (stripFrameAt(ts / 1000, stripPlayer.fps, o.n) + stripPlayer.step) % o.n;
}
function drawStrip(c, ts) {
  const o = c._sp,
    src = loadedAtlas(o.p);
  if (!src) return;
  const f = stripFrameNow(o, ts),
    x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(src, f * o.w, 0, o.w, o.h, 0, 0, o.w, o.h);
  if (o.shown !== f) {
    o.shown = f;
    o.frames = (o.frames || 0) + 1;
    const lab = c.closest('.sp-wrap') && c.closest('.sp-wrap').querySelector('.sp-frame');
    if (lab) lab.textContent = `frame ${f + 1} of ${o.n}`;
  }
}
function stripLoop(ts) {
  let any = false;
  for (const c of STRIP_PLAYERS) {
    if (!c.isConnected) {
      STRIP_PLAYERS.delete(c);
      continue;
    }
    any = true;
    drawStrip(c, ts);
  }
  if (any) requestAnimationFrame(stripLoop);
  else stripPlayer.running = false;
}

ACTIONS.spPlay = () => {
  const P = stripPlayer;
  /* pausing keeps the frame that shows; playing goes on from it */
  const c = [...STRIP_PLAYERS][0];
  if (P.playing && c) P.step = stripFrameNow(c._sp, performance.now());
  P.playing = !P.playing;
  document.querySelectorAll('[data-act="spPlay"]').forEach(b => (b.textContent = P.playing ? 'Pause' : 'Play'));
};
ACTIONS.spStep = () => {
  const P = stripPlayer;
  if (P.playing) {
    const c = [...STRIP_PLAYERS][0];
    if (c) P.step = stripFrameNow(c._sp, performance.now());
    P.playing = false;
    document.querySelectorAll('[data-act="spPlay"]').forEach(b => (b.textContent = 'Play'));
  }
  P.step++;
};
