'use strict';
/* ================= FISHING (v25) =================
   Stand by any water in a walk scene and a Fish button appears. Cast, wait for a bite (tapping too soon scares the
   fish), strike when the float goes under, then reel: hold to lift the green band and keep the fish inside it until
   the line is full. What bites depends on the kind of water (pond, stream, lake, sea, canal, swamp, spring, ice; lava
   has nothing in it) and the place: game data "fishing" lists the billionaires and their weights, and the levels are
   the place's own plus the kind's bonus. A catch starts a wild battle like any other encounter. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import { sfx, startWild, toast, x28Event } from './hooks.js';
import { clamp, rnd } from './util.js';
import { GD, RULES, SP } from './data.js';
import { B, RM, S, U, areaPool, pickW, save, uid } from './core.js';
import { uiIco } from './art.js';
import { DIO, dioTer } from './diorama.js';
import { DGL, DGL_WKIND, dglCurve, dglRing, dglWgAt, dioH } from './diorama-gl.js';
/* eslint-disable no-func-assign */
expose({
  FISH: [() => FISH],
  FISH_KINDS: [() => FISH_KINDS],
  fishCaught: [() => fishCaught, v => (fishCaught = v)],
  fishDraw: [() => fishDraw, v => (fishDraw = v)],
  fishEnd: [() => fishEnd, v => (fishEnd = v)],
  fishKindAt: [() => fishKindAt, v => (fishKindAt = v)],
  fishLoop: [() => fishLoop, v => (fishLoop = v)],
  fishMsg: [() => fishMsg, v => (fishMsg = v)],
  fishPick: [() => fishPick, v => (fishPick = v)],
  fishPoll: [() => fishPoll, v => (fishPoll = v)],
  fishRules: [() => fishRules, v => (fishRules = v)],
  fishSpot: [() => fishSpot, v => (fishSpot = v)],
  fishStart: [() => fishStart, v => (fishStart = v)],
  fishTap: [() => fishTap, v => (fishTap = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FISH = {
  on: false,
  phase: null,
  t0: 0,
  spot: null,
  el: null,
  cv: null,
  raf: 0,
  zone: 0.3,
  zv: 0,
  fishY: 0.5,
  fv: 0,
  prog: 0.3,
  hold: false,
  bite: 0,
  nib: 0,
  q: null,
  msgT: 0,
};
const FISH_KINDS = ['pond', 'stream', 'canal', 'spring', 'swamp', 'lake', 'sea', 'lava', 'ice'];
function fishRules() {
  return Object.assign({ biteMin: 2.5, biteMax: 8, reactTime: 0.9, reelTime: 12, goldOdds: 64 }, RULES.fishing || {});
}
/* the water in front of you (or close beside you): {x,z,y,kind} or null */
function fishSpot() {
  if (
    typeof DIO === 'undefined' ||
    !DIO.sc ||
    !DIO.ready ||
    DIO.battle ||
    DIO.director ||
    (typeof B !== 'undefined' && B)
  )
    return null;
  const P = DIO.pl,
    sc = DIO.sc;
  const wet = (x, z) => {
    if (x < 0 || z < 0 || x >= sc.w || z >= sc.h) return false;
    const c = dioTer(x, z);
    return c === 'w' || c === 'd';
  };
  if (wet(P.x, P.z) && !(typeof DGL !== 'undefined' && DGL.mountOn)) return null;
  const f = { down: [0, -1], up: [0, 1], side: [-1, 0], sideR: [1, 0] }[P.dir] || [0, -1],
    dirs = [f, [f[1], -f[0]], [-f[1], f[0]], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7], [-f[0], -f[1]]];
  for (const [dx, dz] of dirs)
    for (let d = 2.2; d >= 1.0; d -= 0.4) {
      const x = P.x + dx * d,
        z = P.z + dz * d;
      if (!wet(x, z)) continue;
      const kind = fishKindAt(x, z);
      if (kind === 'lava') return null;
      return { x, z, y: dioH(x, z), kind, dir: [dx, dz] };
    }
  return null;
}
function fishKindAt(x, z) {
  if (typeof dglWgAt === 'function') {
    const g = dglWgAt(x, z);
    if (g && typeof DGL_WKIND !== 'undefined' && DGL_WKIND[g.kind]) return DGL_WKIND[g.kind].k;
  }
  const sc = DIO.sc;
  return sc.waterKind || (sc.indoor && sc.far === 'cave' ? 'spring' : sc.far === 'town' ? 'canal' : 'pond');
}
/* what bites: the kind's list, at the place's levels plus the kind's bonus */
function fishPick(kind) {
  const F = (GD.fishing || {})[kind] || (GD.fishing || {}).pond;
  if (!F || !F.list || !F.list.length) return null;
  const list = F.list.filter(([id]) => SP[id]);
  if (!list.length) return null;
  const sp = pickW(list),
    P = areaPool(),
    lv =
      P.lv[0] +
      (F.lv ? F.lv[0] : 0) +
      Math.floor(rnd() * (P.lv[1] + (F.lv ? F.lv[1] : 0) - (P.lv[0] + (F.lv ? F.lv[0] : 0)) + 1));
  return { id: uid(), sp, lvl: Math.max(2, lv), gold: rnd() < 1 / fishRules().goldOdds, no: ++S.serial, fished: 1 };
}
/* the Fish button on the walk screen comes and goes as you walk past water */
function fishPoll() {
  const b = document.querySelector('[data-a=fish]');
  if (!b) return;
  const ok = !FISH.on && U.tab === 'walk' && !U.bench && !!fishSpot();
  if (b.hidden === ok) b.hidden = !ok;
}
setInterval(() => {
  try {
    fishPoll();
  } catch (e) {}
}, 450);
export function fishStart() {
  if (FISH.on) return;
  const sp = fishSpot();
  if (!sp) {
    toast('Walk up to some water first.');
    return;
  }
  const P = DIO.pl;
  Object.assign(FISH, {
    on: true,
    phase: 'cast',
    t0: performance.now(),
    spot: sp,
    zone: 0.35,
    zv: 0,
    fishY: 0.5,
    fv: 0,
    prog: 0.3,
    hold: false,
    nib: 0,
    q: null,
    msgT: 0,
  });
  if (Math.abs(sp.dir[0]) > Math.abs(sp.dir[1])) P.dir = sp.dir[0] > 0 ? 'sideR' : 'side';
  else P.dir = sp.dir[1] > 0 ? 'up' : 'down';
  P.route = null;
  FISH.bite = fishRules().biteMin + rnd() * (fishRules().biteMax - fishRules().biteMin);
  const el = (FISH.el = document.createElement('div'));
  el.className = 'fish-ui';
  el.innerHTML = `<canvas class="fish-cv"></canvas><div class="fish-msg glass" aria-live="polite">Casting…</div>
  <div class="fish-reel" hidden><div class="fr-bar"><div class="fr-zone"></div><div class="fr-fish">${uiIco('fish', 20)}</div></div><div class="fr-prog"><i></i></div></div>
  <div class="fish-acts"><button class="pb small gold fish-tap" data-fish="tap">Strike!</button><button class="pb small glass" data-fish="stop">Stop fishing</button></div>`;
  document.body.appendChild(el);
  FISH.cv = el.querySelector('.fish-cv');
  const down = e => {
      if (e.target.closest('[data-fish=stop]')) return;
      e.preventDefault();
      FISH.hold = true;
      fishTap();
    },
    up = () => {
      FISH.hold = false;
    };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
  el.querySelector('[data-fish=stop]').addEventListener('click', () => fishEnd('You reel in your line.'));
  FISH.key = e => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (e.type === 'keydown') {
        if (!FISH.hold) {
          FISH.hold = true;
          fishTap();
        }
      } else FISH.hold = false;
    } else if (e.key === 'Escape' && e.type === 'keydown') fishEnd('You reel in your line.');
  };
  addEventListener('keydown', FISH.key);
  addEventListener('keyup', FISH.key);
  if (typeof sfx === 'function') sfx('step', { hard: 1 });
  FISH.last = performance.now();
  FISH.raf = requestAnimationFrame(fishLoop);
}
function fishMsg(t) {
  const m = FISH.el && FISH.el.querySelector('.fish-msg');
  if (m && m.textContent !== t) m.textContent = t;
}
function fishTap() {
  const ph = FISH.phase,
    t = (performance.now() - FISH.t0) / 1000;
  if (ph === 'wait') {
    fishEnd('Too soon! The fish swam off.');
    return;
  }
  if (ph === 'bite') {
    FISH.phase = 'reel';
    FISH.t0 = performance.now();
    FISH.q = fishPick(FISH.spot.kind);
    if (!FISH.q) {
      fishEnd('Nothing lives in this water.');
      return;
    }
    const sp = SP[FISH.q.sp],
      hard = clamp(
        0.6 + (sp.stage || 0) * 0.35 + (sp.rar === 'rare' ? 0.4 : sp.rar === 'uncommon' ? 0.2 : 0),
        0.6,
        1.6
      );
    FISH.hard = hard;
    FISH.el.querySelector('.fish-reel').hidden = false;
    FISH.el.querySelector('.fish-tap').textContent = 'Hold to reel';
    fishMsg('Hold to lift the green band. Keep the fish in it!');
    if (typeof dglRing === 'function') dglRing(FISH.spot.x, FISH.spot.z, 1);
  }
}
function fishLoop(ts) {
  if (!FISH.on) return;
  const dt = Math.min(0.05, (ts - FISH.last) / 1000);
  FISH.last = ts;
  const t = (ts - FISH.t0) / 1000,
    R = fishRules();
  if (FISH.phase === 'cast') {
    if (t > 0.7) {
      FISH.phase = 'wait';
      FISH.t0 = ts;
      fishMsg('Waiting for a bite… don’t tap yet.');
      if (typeof dglRing === 'function') dglRing(FISH.spot.x, FISH.spot.z, 0.8);
    }
  } else if (FISH.phase === 'wait') {
    if (t > FISH.bite) {
      FISH.phase = 'bite';
      FISH.t0 = ts;
      fishMsg('A bite! Tap now!');
      if (typeof sfx === 'function') sfx('step', { hard: 1 });
      if (typeof dglRing === 'function') dglRing(FISH.spot.x, FISH.spot.z, 1);
    } else if (rnd() < dt * 0.6) {
      FISH.nib = 0.18;
      if (typeof dglRing === 'function') dglRing(FISH.spot.x, FISH.spot.z, 0.35);
    }
  } else if (FISH.phase === 'bite') {
    if (t > R.reactTime) {
      fishEnd('It got away. Strike faster when the float goes under.');
      return;
    }
  } else if (FISH.phase === 'reel') {
    const hard = FISH.hard || 1;
    FISH.zv += (FISH.hold ? 2.6 : -2.2) * dt;
    FISH.zv *= Math.pow(0.15, dt);
    FISH.zone = clamp(FISH.zone + FISH.zv * dt, 0, 0.7);
    if (FISH.zone <= 0 || FISH.zone >= 0.7) FISH.zv *= -0.3;
    const tgt =
      0.5 + 0.42 * Math.sin(t * 0.9 * hard + 1.3) * Math.sin(t * 0.37 * hard + 0.4) + 0.12 * Math.sin(t * 3.1 * hard);
    FISH.fishY += (clamp(tgt, 0.03, 0.97) - FISH.fishY) * Math.min(1, dt * 2.6 * hard);
    const inZone = FISH.fishY >= FISH.zone && FISH.fishY <= FISH.zone + 0.3;
    FISH.prog = clamp(FISH.prog + (inZone ? 0.32 : -0.22 * hard) * dt, 0, 1);
    const z = FISH.el.querySelector('.fr-zone'),
      f = FISH.el.querySelector('.fr-fish'),
      p = FISH.el.querySelector('.fr-prog i');
    if (z) z.style.bottom = (FISH.zone * 100).toFixed(1) + '%';
    if (f) f.style.bottom = (FISH.fishY * 100).toFixed(1) + '%';
    if (f) f.classList.toggle('in', inZone);
    if (p) p.style.height = (FISH.prog * 100).toFixed(1) + '%';
    if (FISH.prog >= 1) {
      fishCaught();
      return;
    }
    if (FISH.prog <= 0 || t > R.reelTime) {
      fishEnd('The line went slack. It got away!');
      return;
    }
  }
  fishDraw(ts);
  FISH.raf = requestAnimationFrame(fishLoop);
}
/* the rod, the line and the float, drawn over the scene */
function fishDraw(ts) {
  const cv = FISH.cv,
    C = DIO.C;
  if (!cv || !C || !C.vp || !DIO.cv) return;
  const r = DIO.cv.getBoundingClientRect();
  if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) {
    cv.width = Math.round(r.width);
    cv.height = Math.round(r.height);
  }
  cv.style.left = r.left + 'px';
  cv.style.top = r.top + 'px';
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
  const x = cv.getContext('2d');
  x.clearRect(0, 0, cv.width, cv.height);
  const m = C.vp,
    pr = (px, py, pz) => {
      const cx = m[0] * px + m[4] * py + m[8] * pz + m[12],
        cy = m[1] * px + m[5] * py + m[9] * pz + m[13],
        w = m[3] * px + m[7] * py + m[11] * pz + m[15];
      if (w <= 0) return null;
      return [((cx / w) * 0.5 + 0.5) * cv.width, (1 - ((cy / w) * 0.5 + 0.5)) * cv.height];
    };
  const P = DIO.pl,
    S0 = FISH.spot,
    py = (P.yv ?? dioH(P.x, P.z)) + (typeof dglCurve === 'function' ? dglCurve(P.x, P.z) : 0),
    hx = P.x + S0.dir[0] * 0.35,
    hz = P.z + S0.dir[1] * 0.35;
  const tip = [P.x + S0.dir[0] * 1.05, py + 1.75, P.z + S0.dir[1] * 1.05],
    hand = [hx, py + 0.95, hz];
  let k = 1;
  if (FISH.phase === 'cast') k = clamp((ts - FISH.t0) / 700, 0, 1);
  const dip =
    FISH.phase === 'bite' ? 0.12 : FISH.phase === 'reel' ? 0.08 + 0.04 * Math.sin(ts / 90) : FISH.nib > 0 ? 0.05 : 0;
  FISH.nib = Math.max(0, FISH.nib - 0.016);
  const by =
      S0.y +
      (typeof dglCurve === 'function' ? dglCurve(S0.x, S0.z) : 0) +
      0.03 -
      dip +
      (RM ? 0 : Math.sin(ts / 500) * 0.015),
    bob = [
      tip[0] + (S0.x - tip[0]) * k,
      tip[1] + (by - tip[1]) * k + Math.sin(k * Math.PI) * 0.8,
      tip[2] + (S0.z - tip[2]) * k,
    ];
  const a = pr(...hand),
    b = pr(...tip),
    c = pr(...bob);
  if (!a || !b || !c) return;
  const s = Math.max(1, cv.width / 700);
  x.lineCap = 'round';
  x.strokeStyle = '#5A3A24';
  x.lineWidth = 3 * s;
  x.beginPath();
  x.moveTo(a[0], a[1]);
  x.lineTo(b[0], b[1]);
  x.stroke();
  x.strokeStyle = 'rgba(245,245,240,.85)';
  x.lineWidth = 1 * s;
  x.beginPath();
  x.moveTo(b[0], b[1]);
  x.quadraticCurveTo((b[0] + c[0]) / 2, Math.max(b[1], c[1]) + (FISH.phase === 'reel' ? 0 : 18 * s), c[0], c[1]);
  x.stroke();
  if (FISH.phase !== 'bite' || Math.floor(ts / 120) % 2) {
    const r2 = Math.round(3 * s);
    x.fillStyle = '#E8403A';
    x.fillRect(Math.round(c[0] - r2), Math.round(c[1] - r2 * 2), r2 * 2, r2);
    x.fillStyle = '#F4F2EC';
    x.fillRect(Math.round(c[0] - r2), Math.round(c[1] - r2), r2 * 2, r2);
  }
  if (FISH.phase === 'bite') {
    x.fillStyle = '#FFE27A';
    x.font = `bold ${Math.round(22 * s)}px system-ui`;
    x.textAlign = 'center';
    x.fillText('!', c[0], c[1] - 14 * s);
  }
}
function fishCaught() {
  const q = FISH.q;
  fishEnd(null);
  if (!q) return;
  const nm = SP[q.sp].name;
  if (typeof NWLOG !== 'undefined') NWLOG.add('fish', 'caught ' + q.sp);
  S.stats = S.stats || {};
  S.stats.fished = (S.stats.fished || 0) + 1;
  if (typeof x28Event === 'function') x28Event('fish');
  save();
  toast(`You hooked a ${q.gold ? 'Golden ' : ''}${nm}!`);
  setTimeout(() => startWild(q), 350);
}
function fishEnd(msg) {
  FISH.on = false;
  cancelAnimationFrame(FISH.raf);
  if (FISH.el) {
    FISH.el.remove();
    FISH.el = null;
  }
  FISH.cv = null;
  removeEventListener('keydown', FISH.key);
  removeEventListener('keyup', FISH.key);
  if (msg) toast(msg);
  fishPoll();
}
