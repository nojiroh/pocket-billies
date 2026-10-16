'use strict';
/* ================= THE OPENING CUTSCENE =================
   Starts with New game on the title screen. v47: first the fall (opening.js): the surface, the crust, the inner sky.
   Then Sundown, filmed with the walk-scene engine (diorama-gl.js DIO.director hook): you wake in the dust outside
   Professor Hazel's lab, seen through your own eyes, and she comes running. You can't remember your name, so you
   make yourself up in the dressing room; she tells you about billionaires and throws three coins that pop open into
   the starters. Pick one, and her other student Blake runs in, takes the one that beats yours and battles you on the
   spot (opening.js battleTutor, story.js storyAfterRival).
   If the cutscene can't run or stops, the older step-by-step intro in ui.js runs instead. */
const CS = {
  on: false,
  run: 0,
  skip: false,
  waits: [],
  cam: null,
  actors: {},
  stars: [],
  coins: [],
  fx: [],
  lights: [],
  items: [],
  parts: [],
  hide: null,
  sel: 0,
  choosing: false,
  say: null,
  por: { who: null, expr: null, t: 0 },
  flashes: [],
  center: [10.1, 12.3],
  ui: null,
};
const CS_SPOT = {
  door: [7.4, 15.4],
  hazel: [9.3, 13.25],
  me: [11.05, 12.95],
  meFrom: [14.6, 12.4],
  stars: [
    [8.8, 11.55],
    [10.15, 11.2],
    [11.5, 11.55],
  ],
  blake: [12.55, 12.7],
  blakeFrom: [16.4, 12.1],
};
const csNow = () => performance.now();
/* v46: where the opening scene is filmed: in front of the lab's door, wherever the lab stands in Sundown */
function csPlace(sc) {
  let o = [0, 0];
  CS.dy = 0;
  const C0 = dioData().sc,
    L = ((sc && sc.props) || []).find(p => p.act === 'lab');
  if (L) {
    const M = C0.props[L.k] || {},
      dx = (((M.door && M.door.x) || 0) / (C0.ppu || 34)) * (L.s || 1) * (L.f ? -1 : 1);
    o = [L.x + dx - CS_SPOT.door[0], L.z - CS_SPOT.door[1]];
    /* alpha 0.4: the shots were framed for a lab on ground half a metre up (Marigold Town's); they rise and fall with the ground at the door */
    if (typeof dioH === 'function') CS.dy = dioH(L.x + dx, L.z - 0.6) - 0.5;
  }
  CS.o = o;
  const sh = p => [p[0] + o[0], p[1] + o[1]];
  CS.A = {
    door: sh(CS_SPOT.door),
    hazel: sh(CS_SPOT.hazel),
    me: sh(CS_SPOT.me),
    meFrom: sh(CS_SPOT.meFrom),
    stars: CS_SPOT.stars.map(sh),
    blake: sh(CS_SPOT.blake),
    blakeFrom: sh(CS_SPOT.blakeFrom),
  };
  CS.center = sh([10.1, 12.3]);
  return o;
}
const csEase = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/* v47b: the opening (and the title behind it) is filmed in the same view of Sundown the game then walks in: the town
   with the first stretch of each road. So nothing is built again between the title, the opening, Blake's battle
   and your first steps (it was a pause of most of a second as the battle began) */
function csSceneId() {
  const id = sceneIdAt(START_NODE);
  try {
    const v = typeof wrRoamView === 'function' ? wrRoamView(START_NODE, null) : null;
    if (v && v.id && dioScene(v.id)) return v.id;
  } catch (e) {
    console.error(e);
  }
  return id;
}
function csWanted() {
  return (
    typeof eglOK === 'function' &&
    !EGL.fail &&
    eglOK() &&
    typeof sceneIdAt === 'function' &&
    !!dioScene(sceneIdAt(START_NODE))
  );
}
/* alpha 0.4: the start's name, for the opening's caption (Copperleaf Town) */
const csStartName = () =>
  typeof placeFull === 'function' && ROUTE[START_NODE] ? placeFull(ROUTE[START_NODE]) : 'the Hollow Earth';

/* ---------- timing helpers: everything resolves at once while skipping ---------- */
function csWait(ms) {
  if (CS.skip || !CS.on) return Promise.resolve();
  return new Promise(r => {
    const id = setTimeout(done, ms);
    function done() {
      clearTimeout(id);
      CS.waits = CS.waits.filter(f => f !== done);
      r();
    }
    CS.waits.push(done);
  });
}
function csFlush() {
  const w = CS.waits.slice();
  CS.waits = [];
  w.forEach(f => f());
  if (TALK.cur && CS.on) TALK.cur.done();
}
function csSkip() {
  if (!CS.on || CS.choosing || CS.dressing) return;
  CS.skip = true;
  csFlush();
}
/* ---------- the camera: eye, target, field of view and a width that must stay in frame (phones) ---------- */
function csCamNow() {
  const c = CS.cam;
  if (!c) return null;
  const k = c.dur && !CS.skip && !RM ? csEase(clamp((csNow() - c.t0) / c.dur, 0, 1)) : 1,
    L = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
  return {
    eye: L(c.a.eye, c.b.eye),
    tgt: L(c.a.tgt, c.b.tgt),
    fov: c.a.fov + (c.b.fov - c.a.fov) * k,
    w: (c.a.w || 0) + ((c.b.w || 0) - (c.a.w || 0)) * k,
  };
}
function csShot(K, ms = 0) {
  K = Object.assign({ fov: 40, w: 0 }, K);
  /* v46: the shots were framed for the lab's door at CS_SPOT.door; they move with the lab (csPlace) */ if (
    !K.abs &&
    CS.o
  ) {
    const o = CS.o,
      dy = CS.dy || 0;
    K.eye = [K.eye[0] + o[0], K.eye[1] + dy, K.eye[2] + o[1]];
    K.tgt = [K.tgt[0] + o[0], K.tgt[1] + dy, K.tgt[2] + o[1]];
  }
  const a = csCamNow() || K;
  CS.cam = { a, b: K, t0: csNow(), dur: ms };
  return csWait(ms);
}
/* ---------- actors ---------- */
function csActor(id, who, at, dir) {
  CS.actors[id] = { id, who, x: at[0], z: at[1], dir: dir || 'down', walk: null, act: null, actT: 0 };
  return CS.actors[id];
}
function csWalk(id, to, ms) {
  const a = CS.actors[id];
  a.walk = { x0: a.x, z0: a.z, x1: to[0], z1: to[1], t0: csNow(), dur: ms };
  a.dir = dioDirOf(to[0] - a.x, to[1] - a.z);
  return csWait(ms);
}
function csAct(id, act, ms) {
  const a = CS.actors[id];
  a.act = act;
  a.actT = csNow();
  return csWait(ms || 0).then(() => {
    if (ms) a.act = null;
  });
}
function csPersonItem(a, t, C0) {
  let im;
  const now = csNow();
  if (a.walk) {
    const k = CS.skip || RM ? 1 : clamp((now - a.walk.t0) / a.walk.dur, 0, 1);
    a.x = a.walk.x0 + (a.walk.x1 - a.walk.x0) * k;
    a.z = a.walk.z0 + (a.walk.z1 - a.walk.z0) * k;
    if (k >= 1) a.walk = null;
  }
  if (a.walk) {
    const set = owFrames(a.who)[a.dir] || owFrames(a.who).down;
    im = set.cyc ? set.cyc[Math.floor(t / 110) % 6] : set[1 + (Math.floor(t / 150) % 2)];
  } else if (a.act === 'throw') im = humanPose(a.who, 'front', 'throw', clamp((now - a.actT) / 700, 0, 1));
  else if (a.act === 'cheer' || a.act === 'react') im = humanPose(a.who, 'front', a.act, 0, now - a.actT);
  else im = (owFrames(a.who)[a.dir] || owFrames(a.who).down)[0];
  return dglPerson('actor', im, a.x, a.z, C0, {});
}
/* the starter billionaires, drawn with their rigs every frame */
function csStarItem(s, t) {
  const R = rigParts(s.sp, false, 1);
  if (!R) return null;
  if (!s.buf) s.buf = cnv(R.BW, R.BH);
  const b = s.buf;
  if (b.width !== R.BW || b.height !== R.BH) {
    b.width = R.BW;
    b.height = R.BH;
  }
  const x = b.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, b.width, b.height);
  const tau = csNow() - s.actT,
    ak = s.act && tau < 1200 ? s.act : null;
  drawRig(x, R, rigFrame(R, ak, tau, Math.floor(t / 16) * 16, s.seed), 'front');
  if (s.white > 0) rigTint(x, b.width, b.height, '#FFFFFF', s.white);
  b.__v = (b.__v || 0) + 1;
  const G = R.geo,
    pop = s.pop >= 1 ? 1 : s.pop <= 0 ? 0 : 1 + Math.sin(s.pop * Math.PI) * 0.25 - (1 - s.pop) * 0.9,
    mpp = (0.88 / (G.base - G.top)) * Math.max(0.01, pop),
    y = dioH(s.x, s.z) + (s.hop || 0);
  return {
    k: 'rig',
    im: b,
    x: s.x,
    z: s.z,
    y,
    mpp,
    ox: -G.cx,
    oy: -G.base,
    w: R.BW,
    h: R.BH,
    flip: s.flip,
    shear: 0,
    sh: pop > 0.3 ? Math.max(0.25, G.hw * mpp) : 0,
    aoR: Math.max(0.25, G.hw * mpp * 0.9),
    fade: clamp(s.a, 0, 1),
    person: 1,
  };
}
/* ---------- what the engine draws: DIO.director.frame ---------- */
function csFrame() {
  if (!CS.on) return null;
  const t = DIO.t,
    C0 = dioData().sc,
    items = CS.items,
    parts = CS.parts,
    lights = CS.lights,
    now = csNow();
  items.length = 0;
  parts.length = 0;
  lights.length = 0;
  for (const a of Object.values(CS.actors)) if (!a.hidden) items.push(csPersonItem(a, t, C0));
  CS.stars.forEach((s, i) => {
    if (s.popT) {
      s.pop = CS.skip ? 1 : clamp((now - s.popT) / 420, 0, 1);
      s.white = Math.max(0, 1 - (now - s.popT) / 300);
    }
    if (s.leave) {
      const k = clamp((now - s.leave) / 500, 0, 1);
      s.a = 1 - k;
      s.hop = Math.sin(k * Math.PI) * 0.4;
    }
    if (s.pop > 0 && s.a > 0) {
      const it = csStarItem(s, t);
      if (it) items.push(it);
    }
    if (CS.choosing && i === CS.sel)
      lights.push({ p: [s.x, 0.35 + dioH(s.x, s.z), s.z - 0.2], r: 1.7, c: [0.55, 0.48, 0.3] });
  });
  const coin = dioImg('coins/penny_32.png');
  for (const c of CS.coins) {
    const k = CS.skip ? 1 : clamp((now - c.t0) / c.dur, 0, 1);
    if (k >= 1) {
      if (!c.landed) {
        c.landed = 1;
        c.onLand();
      }
      continue;
    }
    const x = c.a[0] + (c.b[0] - c.a[0]) * k,
      z = c.a[2] + (c.b[2] - c.a[2]) * k,
      y = c.a[1] + (c.b[1] - c.a[1]) * k + Math.sin(k * Math.PI) * 1.25,
      sp = Math.abs(Math.cos(k * 14));
    if (dioOk(coin)) parts.push({ im: coin, x, y, z, w: 0.24 * Math.max(0.15, sp), h: 0.24, a: 1, glow: false });
    lights.push({ p: [x, y, z], r: 1.1, c: [0.5, 0.4, 0.12] });
  }
  const spark = typeof partSpr === 'function' ? partSpr('sparkle') : null;
  CS.fx = CS.fx.filter(f => now - f.t0 < f.life);
  for (const f of CS.fx) {
    const k = (now - f.t0) / f.life;
    if (spark && spark.width > 1)
      parts.push({
        im: spark,
        x: f.x + f.vx * k,
        y: f.y + f.vy * k - 0.5 * k * k,
        z: f.z + f.vz * k,
        w: 0.18 * (1 - k * 0.5),
        h: 0.18 * (1 - k * 0.5),
        a: 1 - k,
        glow: true,
      });
  }
  CS.flashes = CS.flashes.filter(f => now - f.t0 < 500);
  for (const f of CS.flashes) {
    const k = 1 - (now - f.t0) / 500;
    lights.push({ p: f.p, r: 2.6, c: [1.4 * k, 1.2 * k, 0.7 * k] });
  }
  if (typeof landFrame === 'function') landFrame(now, parts);
  const K = csCamNow() || { eye: [17, 14, -6], tgt: [17, 0, 12], fov: 42, w: 0 },
    sway = RM ? 0 : 1,
    look = {
      eye: [K.eye[0] + Math.sin(now / 2300) * 0.04 * sway, K.eye[1] + Math.sin(now / 1700) * 0.025 * sway, K.eye[2]],
      tgt: K.tgt,
      fov: K.fov,
      w: K.w,
    };
  const fd = Math.hypot(K.tgt[0] - K.eye[0], K.tgt[1] - K.eye[1], K.tgt[2] - K.eye[2]);
  csPortraitTick(now);
  return {
    look,
    items,
    lights,
    parts,
    hide: CS.hide,
    focus: fd,
    blur: fd < 6 ? 0.45 : 0.2,
    center: [K.tgt[0], K.tgt[2]],
    cut: 2.6,
  };
}
function csSparkle(p, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    CS.fx.push({
      x: p[0],
      y: p[1],
      z: p[2],
      vx: Math.cos(a) * 0.7,
      vy: 0.6 + Math.random() * 0.6,
      vz: Math.sin(a) * 0.4,
      t0: csNow(),
      life: 500 + Math.random() * 300,
    });
  }
}

/* ---------- the overlay: letterbox, caption, dialogue, starter picker ---------- */
function csHTML() {
  return `<div class="cs-bars" aria-hidden="true"><i></i><i></i></div>
 <div class="cs-cap" id="csCap" aria-live="polite"><small></small><b></b></div>
 <button class="cs-skip pb small quiet" data-a="cs-skip">Skip ›</button>
 <div class="cs-pick px" id="csPick" hidden></div>
 <div class="cs-fade" id="csFade"></div>`;
}
function csCaption(sub, title, ms = 3200) {
  const c = $('#csCap');
  if (!c || CS.skip) return;
  c.querySelector('small').textContent = sub;
  c.querySelector('b').textContent = title;
  c.classList.add('on');
  setTimeout(() => c.classList.remove('on'), ms);
}
/* one line of dialogue in the shared dialogue box (talk.js) */
function csSay(who, text, expr) {
  if (CS.skip || !CS.on) return Promise.resolve();
  const pr = talkLine(who, text, expr, { cs: true });
  CS.say = TALK.cur;
  return pr.then(() => {
    if (CS.say && !CS.say.typing) CS.say = null;
  });
}
function csHideDlg() {
  talkHide();
  CS.say = null;
}
/* v47: waking up: the picture starts blurred and bright and sharpens; the letterbox closes like eyelids to blink */
function csBlink() {
  if (CS.skip || RM || !CS.on) return Promise.resolve();
  document.body.classList.add('cs-blink');
  return csWait(170).then(() => {
    document.body.classList.remove('cs-blink');
    return csWait(240);
  });
}
function csPortraitTick() {}
function csTap(ev) {
  if (!CS.on) return;
  if (ev && ev.target.closest && ev.target.closest('button,input,.cs-pick')) return;
  if (TALK.cur) TALK.cur.tap();
}

/* ---------- the starter picker ---------- */
function csPickHTML() {
  const pk = CS.pickList,
    l = pk[CS.sel],
    s = SP[l + '0'],
    t = s.types[0],
    st = TYPES.filter(x => eff(t, [x]) > 1),
    wk = TYPES.filter(x => eff(x, [t]) > 1);
  return `<div class="cs-pk-top"><button class="mbtn" data-a="cs-prev" aria-label="Previous">‹</button><div class="cs-pk-name"><small>${CS.sel + 1} of ${pk.length}</small><b>${esc(s.name)}</b><span class="row">${chip(t)}</span></div><button class="mbtn" data-a="cs-next" aria-label="Next">›</button></div>
 <p class="sd">${esc(s.blurb)}</p><p class="sd">Strong against ${st.join(' and ') || 'nothing in particular'}. Weak to ${wk.join(' and ') || 'nothing in particular'}.</p>
 ${CS.confirm ? `<div class="racts"><button class="pb quiet" data-a="cs-no">Not yet</button><button class="pb gold" data-a="cs-yes">Yes, ${esc(s.name)}!</button></div>` : `<button class="pb gold wide" data-a="cs-choose">Choose ${esc(s.name)}</button>`}`;
}
function csPickFocus() {
  const s = CS.stars[CS.sel];
  if (!s) return;
  s.act = 'cheer';
  s.actT = csNow();
  csShot(
    {
      eye: [s.x * 0.6 + (10.15 + (CS.o || [0, 0])[0]) * 0.4 + 0.1, 1.35 + (CS.dy || 0), s.z - 3.6],
      tgt: [s.x, 0.55 + (CS.dy || 0), s.z + 0.2],
      fov: 36,
      w: 2.6,
      abs: 1,
    },
    650
  );
  const p = $('#csPick');
  if (p) p.innerHTML = csPickHTML();
}
function csChoose() {
  return new Promise(res => {
    CS.choosing = true;
    CS.confirm = false;
    CS.pickRes = res;
    const p = $('#csPick');
    p.hidden = false;
    document.body.classList.add('cs-choosing');
    csPickFocus();
    if (CS.test)
      setTimeout(() => {
        csPickSel(1);
        setTimeout(() => {
          if (CS.pickRes) {
            const r = CS.pickRes;
            CS.pickRes = null;
            r(CS.pickList[CS.sel]);
          }
        }, 900);
      }, 900);
  });
}
function csPickSel(d) {
  if (!CS.choosing) return;
  CS.sel = (CS.sel + d + CS.pickList.length) % CS.pickList.length;
  CS.confirm = false;
  csPickFocus();
}

/* ---------- the script ---------- */
async function csStart() {
  if (CS.on) return;
  const id = csSceneId();
  CS.on = true;
  CS.run++;
  const run = CS.run;
  CS.skip = false;
  CS.actors = {};
  CS.stars = [];
  CS.coins = [];
  CS.fx = [];
  CS.flashes = [];
  CS.cam = null;
  CS.sel = 1;
  CS.choosing = false;
  CS.hide = null;
  CS.rival = false;
  if (typeof LAND !== 'undefined') LAND.bits = [];
  CS.pickList = RULES.start.starters.filter(l => SP[l + '0']);
  let el = $('#cs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cs';
    el.className = 'cs';
    document.body.appendChild(el);
  }
  el.innerHTML = csHTML();
  el.hidden = false;
  document.body.classList.add('in-cs');
  $('#app').innerHTML = '';
  updateNav(false);
  const pre = Promise.all([
    rigPreload(CS.pickList.map(l => [l + '0', false, 1])),
    artLoad(['coins/penny_32.png']),
    dioPrepare(id),
  ]).catch(() => {});
  /* v47: the fall, from the surface down to Sundown (opening.js); it ends on a white screen */
  if (typeof fallPlay === 'function' && !CS.test) {
    try {
      await fallPlay(run);
    } catch (e) {
      console.error(e);
      const f = $('#csFade');
      if (f) f.classList.add('on');
    }
  } else {
    const f = $('#csFade');
    if (f) f.classList.add('on');
  }
  if (!CS.skip && !CS.test) document.body.classList.add('cs-dazed'); /* blurred already while the screen is white */
  if (!CS.on || CS.run !== run) return;
  await pre;
  if (!CS.on || CS.run !== run) return;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  cv.hidden = false;
  cv.setAttribute('aria-label', 'Opening scene in ' + csStartName());
  DIO.director = { frame: csFrame };
  await dioMount(cv, id, {
    state: () => ({ who: null, npcs: [], enc: [], mode: 'line' }),
    keys: () => false,
    active: () => false,
    onPick: () => {},
    cap: () => (document.hidden ? 1 : DR.on ? 4 : Math.min(60, userFps())),
  });
  if (!CS.on || CS.run !== run) return;
  if (!DGL.on || !DIO.ready || !DIO.cv) {
    csAbort();
    return;
  }
  cv = DIO.cv;
  cv.classList.add('in');
  const sc = DIO.sc,
    C0 = dioData().sc,
    o = csPlace(sc);
  const eyes = [
    [12.6, 6.2],
    [10.5, 8.4],
    [10.4, 8.0],
    [10.15, 7.3],
  ].map(e => [e[0] + o[0], e[1] + o[1]]);
  /* out of the way while filming: what stands where it all happens, on Blake's way in, or right in front of a camera */
  const seg = (x, z, a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      k = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k);
  };
  CS.hide = new Set(
    (sc.props || []).filter(p => {
      const M = C0.props[p.k];
      return (
        M &&
        !M.flat &&
        ((p.x > 7.9 + o[0] && p.x < 12.9 + o[0] && p.z > 9.6 + o[1] && p.z < 13.9 + o[1]) ||
          seg(p.x, p.z, CS.A.blakeFrom, CS.A.blake) < 1.1 ||
          (!M.box && eyes.some(e => Math.hypot(p.x - e[0], p.z - e[1]) < 2.3)))
      );
    })
  );
  if (typeof NWLOG !== 'undefined') NWLOG.add('scene', 'opening cutscene');
  if (typeof music === 'function') music('hazel');
  /* the town's ground is laid and drawn before the white fades */
  const f0 = DGL.frames,
    t0 = performance.now();
  while (CS.on && CS.run === run && !(DGL.gtex && DGL.frames >= f0 + 3) && performance.now() - t0 < 15000)
    await new Promise(r => setTimeout(r, 120));
  try {
    await csScript(run);
  } catch (e) {
    console.error(e);
    if (typeof NWLOG !== 'undefined') NWLOG.add('error', 'cutscene: ' + (e.message || e));
    if (CS.on && CS.run === run) csAbort();
  }
}
async function csScript(run) {
  const alive = () => CS.on && CS.run === run,
    A = CS.A || CS_SPOT,
    O = CS.o || [0, 0],
    M = A.me,
    gy = dioH(M[0], M[1]),
    body = document.body,
    fade = $('#csFade');
  const pov = (h, tgt, fov, ms) => csShot({ eye: [M[0] + 0.06, gy + h, M[1] - 0.32], tgt, fov, w: 1.3, abs: 1 }, ms);
  /* 1. you wake in the dust outside the lab, the papers that fell with you still coming down */
  pov(0.4, [M[0] + 2.4, gy + 3.9, M[1] + 5.4], 58);
  if (typeof landBurst === 'function') landBurst(M[0], M[1]);
  if (CS.skip) body.classList.remove('cs-dazed');
  if (fade) fade.classList.remove('on');
  setTimeout(() => {
    if (alive()) csCaption('The Hollow Earth', csStartName(), 3400);
  }, 1400);
  await csWait(1700);
  await csBlink();
  await csWait(420);
  await csBlink();
  if (!alive()) return;
  body.classList.add('cs-waking');
  body.classList.remove('cs-dazed');
  const dy = dioH(A.door[0], A.door[1]);
  pov(0.62, [A.door[0], dy + 1.25, A.door[1]], 52, 3200);
  await csWait(2600);
  if (!alive()) return;
  /* 2. the Professor comes running */
  const hy = dioH(A.hazel[0], A.hazel[1]);
  csActor('gini', 'gini', A.door, 'down');
  pov(0.78, [A.hazel[0], hy + 1.08, A.hazel[1]], 58, 1900);
  await csWalk('gini', A.hazel, 1500);
  CS.actors.gini.dir = 'down';
  if (!alive()) return;
  await csSay('gini', 'Oh! Another one! Are you all right? That was quite a landing.', 'surprised');
  await csSay(
    'gini',
    'You came down through the crust. Things do, now and then. Mostly furniture. You’re the first this week who can talk.'
  );
  await csSay('gini', 'Can you tell me your name?');
  if (!alive()) return;
  csHideDlg();
  await csWait(1300);
  await csSay('gini', 'No? Nothing at all?', 'surprised');
  await csSay('gini', 'Classic fall-related amnesia. Very common down here. It usually comes back, a bit at a time.');
  await csSay('gini', 'Let’s start with what we can see. Sit up, let me get a good look at you.', 'happy');
  if (!alive()) return;
  body.classList.remove('cs-dazed', 'cs-blink');
  /* 3. make yourself up (skipping stops here) */
  CS.skip = false;
  csHideDlg();
  CS.dressing = true;
  body.classList.add('cs-dress');
  await new Promise(r => {
    openDressing({
      mode: 'intro',
      noBack: true,
      look: U.trainerDraft || TR_PRESETS[Math.floor(Math.random() * TR_PRESETS.length)],
      done: r,
    });
    if (CS.test)
      setTimeout(() => {
        if (DR.on) drSave();
      }, 1500);
  });
  CS.dressing = false;
  body.classList.remove('cs-dress', 'cs-waking');
  if (!alive()) return;
  U.avatarDraft = cleanLook(U.trainerDraft || TR_PRESETS[0]);
  U.trainerDraft = U.avatarDraft;
  /* 4. on your feet */
  csActor('me', 'me', M, 'side');
  CS.actors.gini.dir = 'sideR';
  csShot({ eye: [10.4, 1.75, 8.0], tgt: [10.2, 1.05, 12.9], fov: 40, w: 3.8 });
  csAct('me', 'react', 900);
  if (!alive()) return;
  const nm = trainerLook('me').name || 'Trainer';
  await csSay('gini', `${nm}? It suits you. If it isn’t your name, it is now.`, 'happy');
  await csSay('gini', 'I’m Professor Hazel. I study Billies, the most common wildlife here in the Hollow Earth.');
  await csSay(
    'gini',
    'Clones of the richest people up top. A lab backed them up and filled the gaps with animals, then shipped the results down here. They went wild.'
  );
  await csSay(
    'gini',
    'They live in the long grass, in caves and canyons, even in the malls. Walk, and they come to you. Tax them with a coin, train a team, earn badges from the arena leaders.'
  );
  await csSay(
    'gini',
    'Nobody should walk the Hollow Earth alone. Luckily for you, I have three of them right here.',
    'happy'
  );
  if (!alive()) return;
  csHideDlg();
  /* 5. three coins, three billionaires */
  CS.actors.gini.dir = 'down';
  CS.actors.me.dir = 'down';
  csShot({ eye: [10.15, 1.5, 7.3], tgt: [10.15, 0.7, 11.9], fov: 40, w: 4.4 }, 900);
  await csWait(500);
  csAct('gini', 'throw', 900);
  await csWait(380);
  if (typeof sfx === 'function') sfx('throw');
  CS.pickList.forEach((l, i) => {
    const p = A.stars[i],
      s = {
        sp: l + '0',
        x: p[0],
        z: p[1],
        pop: 0,
        a: 1,
        act: null,
        actT: 0,
        seed: i * 1.7 + 0.4,
        flip: i === 0 ? -1 : 1,
        white: 0,
      };
    CS.stars.push(s);
    CS.coins.push({
      a: [CS.actors.gini.x + 0.2, dioH(A.hazel[0], A.hazel[1]) + 1.35, CS.actors.gini.z - 0.1],
      b: [p[0], dioH(p[0], p[1]) + 0.1, p[1]],
      t0: csNow() + i * 140,
      dur: 650,
      onLand() {
        const y = dioH(p[0], p[1]) + 0.3;
        s.popT = csNow();
        if (typeof sfx === 'function') sfx('pop');
        s.act = 'enter';
        s.actT = csNow();
        CS.flashes.push({ p: [p[0], y + 0.2, p[1]], t0: csNow() });
        if (!CS.skip) csSparkle([p[0], y, p[1]], 12);
        if (typeof buzz === 'function') buzz(8);
      },
    });
  });
  await csWait(1300);
  CS.coins.forEach(c => {
    if (!c.landed) {
      c.landed = 1;
      c.onLand();
    }
  });
  CS.coins = [];
  if (!alive()) return;
  await csSay(
    'gini',
    'Three Billies, three types. Each one beats one of the others. Take a good look before you choose!'
  );
  csHideDlg();
  CS.skip = false;
  /* 6. pick one */
  const l = await csChoose();
  if (!alive()) return;
  CS.choosing = false;
  document.body.classList.remove('cs-choosing');
  $('#csPick').hidden = true;
  const si = CS.pickList.indexOf(l),
    star = CS.stars[si],
    sp = SP[l + '0'];
  star.act = 'cheer';
  star.actT = csNow();
  CS.stars.forEach((s, i) => {
    if (i !== si) s.leave = csNow() + i * 90;
  });
  csShot(
    {
      eye: [10.4 + O[0], 1.45 + (CS.dy || 0), 8.0 + O[1]],
      tgt: [(star.x + A.me[0]) / 2, 0.85 + (CS.dy || 0), 12.2 + O[1]],
      fov: 40,
      w: 3.6,
      abs: 1,
    },
    900
  );
  csAct('me', 'cheer', 1300);
  await csWait(900);
  await csSay('gini', `${sp.name}! ${nm} and ${sp.name}. I like the sound of that.`, 'happy');
  if (!alive()) return;
  /* 7. Blake runs in, takes the one that beats yours, and wants a battle right now */
  const T0 = TRAINERS.blake0;
  if (!T0) {
    await csSay('gini', 'Now go and walk! Every step counts. Come back and see me any time.', 'happy');
    if (!alive()) return;
    csHideDlg();
    if (fade) fade.classList.add('on');
    await new Promise(r => setTimeout(r, RM ? 50 : 700));
    if (!alive()) return;
    csEnd(l);
    return;
  }
  csHideDlg();
  csActor('rival', T0.who || 'chad', A.blakeFrom, 'side');
  const by = dioH(A.blake[0], A.blake[1]);
  csShot(
    {
      eye: [(A.hazel[0] + A.blake[0]) / 2, by + 1.9, A.me[1] - 5.2],
      tgt: [(A.hazel[0] + A.blake[0]) / 2, by + 1, A.me[1]],
      fov: 40,
      w: 5.9,
      abs: 1,
    },
    1100
  );
  if (typeof music === 'function') music('rival');
  const run1 = csWalk('rival', A.blake, 1500),
    BL = blakeHello(l);
  CS.actors.me.dir = 'sideR';
  CS.actors.gini.dir = 'sideR';
  await csSay(BL[0][0], BL[0][1]);
  await run1;
  CS.actors.rival.dir = 'side';
  if (!alive()) return;
  for (const [w, t] of BL.slice(1)) {
    await csSay(w, t);
    if (!alive()) return;
  }
  csHideDlg();
  CS.rival = true;
  csAct('rival', 'cheer', 800);
  await csWait(700);
  if (fade) {
    fade.style.background = '#0B0912';
    fade.classList.add('on');
  }
  await new Promise(r => setTimeout(r, RM ? 50 : 600));
  if (!alive()) return;
  csEnd(l);
}
function csTeardown() {
  talkHide();
  CS.on = false;
  CS.run++;
  CS.skip = false;
  csFlush();
  CS.choosing = false;
  CS.dressing = false;
  DIO.director = null;
  DGL.bt = null;
  DGL.camT = null;
  DGL.focus = null;
  const el = $('#cs');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
  if (typeof FALL !== 'undefined') {
    cancelAnimationFrame(FALL.raf);
    if (FALL.cv) {
      FALL.cv.remove();
      FALL.cv = null;
    }
  }
  if (typeof LAND !== 'undefined') LAND.bits = [];
  document.body.classList.remove('in-cs', 'cs-choosing', 'cs-dress', 'cs-falling', 'cs-dazed', 'cs-waking', 'cs-blink');
  if (DIO.cv) dioStop();
}
function csEnd(l) {
  if (CS.test) {
    CS.test = false;
    csTeardown();
    const d = CS.testDone;
    CS.testDone = null;
    if (d) d();
    return;
  }
  const rival = CS.rival;
  csTeardown();
  startGame(l, { rival });
}
/* no WebGL after all: the step-by-step intro */
function csAbort() {
  csTeardown();
  U.intro = 1;
  render();
}

document.addEventListener('click', ev => {
  if (!CS.on) return;
  const el = ev.target.closest('[data-a]');
  const a = el && el.dataset.a;
  if (!a) {
    if (ev.target.closest('#cs')) csTap(ev);
    return;
  }
  switch (a) {
    case 'cs-skip':
      csSkip();
      break;
    case 'cs-prev':
      csPickSel(-1);
      break;
    case 'cs-next':
      csPickSel(1);
      break;
    case 'cs-choose':
      CS.confirm = true;
      $('#csPick').innerHTML = csPickHTML();
      break;
    case 'cs-no':
      CS.confirm = false;
      $('#csPick').innerHTML = csPickHTML();
      break;
    case 'cs-yes':
      if (CS.pickRes) {
        const r = CS.pickRes;
        CS.pickRes = null;
        r(CS.pickList[CS.sel]);
      }
      break;
  }
});
document.addEventListener('keydown', ev => {
  if (!CS.on || CS.dressing) return;
  if (ev.key === 'Escape') {
    csSkip();
    return;
  }
  if (CS.choosing) {
    if (ev.key === 'ArrowLeft') csPickSel(-1);
    else if (ev.key === 'ArrowRight') csPickSel(1);
    return;
  }
});
/* tapping a billionaire in the scene picks it */
document.addEventListener('pointerup', ev => {
  if (
    !CS.on ||
    !CS.choosing ||
    !DIO.C ||
    !DIO.cv ||
    (ev.target !== DIO.cv && ev.target.id !== 'dioui' && !ev.target.classList.contains('cs'))
  )
    return;
  const r = DIO.cv.getBoundingClientRect(),
    sx = ((ev.clientX - r.left) / r.width) * DIO.cv.width,
    sy = ((ev.clientY - r.top) / r.height) * DIO.cv.height;
  let best = -1,
    bd = 1e9;
  CS.stars.forEach((s, i) => {
    const q = dioProj(DIO.C, s.x, 0.45, s.z);
    if (!q) return;
    const d = Math.hypot(q.x - sx, q.y - sy);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best >= 0 && bd < DIO.cv.height * 0.18 && best !== CS.sel) {
    CS.sel = best;
    CS.confirm = false;
    csPickFocus();
  }
});
