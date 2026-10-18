/* Pocket Billies: the ground painter's helper thread.
   alpha 0.4: painting the ground was the biggest cause of slow frames in the 14 Oct logs (iPad, Android phone and a
   Windows laptop alike): the 16 m squares of the near ring as you walk, and a view's whole distant ground when it
   opens. The very same painter (paintGroundSteps and its helpers, sent to the worker as their source text, so there is one
   copy of the code) now runs on a Web Worker. The main thread hands it a view once and the tile pictures once, then
   asks for rectangles and gets the pixels back, the near ring's with their smaller sizes (mipmaps) made there too.
   Where workers aren't allowed (or one fails), painting stays on the main thread, a slice at a time, as before.
   A generator waiting on the worker yields PAINT_WORKER_WAIT (walk-view.js): the loops that step it stop for the frame. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { clamp } from './util.js';
import { hexA, pk, pkh } from './art.js';
import {
  GROUND_BORDER_M,
  PAINT_WORKER_WAIT,
  TONE_AMOUNT,
  TONE_DARK,
  TONE_DIRECTIONS,
  TONE_LIGHT,
  TONE_NONE,
  applyGroundTone,
  bigTilesOn,
  clipSegmentToRect,
  groundKey,
  groundTileFolder,
  groundToneAt,
  hash2d,
  paintGroundSteps,
  pathWearAmountFn,
  pathWearFn,
  pathWearLines,
  plainTileIndex,
  scaleColor,
  stableCells,
  stepCellsJoined,
  stepCornerHeight,
  stepGrid,
  stepGridCorners,
  tileSetPixels,
  valueNoise2d,
  walkData,
  walkView,
  worldPatchTilesOn,
} from './walk-view.js';
import { eng } from './engine/settings.js';
import { TERRAIN_MATERIALS } from './walk-view-gl.js';
import { wrNear } from './seamless-world.js';
/* eslint-disable no-func-assign */
expose({
  PW: [() => PW],
  PW_KEEP: [() => PW_KEEP],
  PW_KINDS: [() => PW_KINDS],
  PW_MAIN: [() => PW_MAIN],
  pwAll: [() => pwAll, v => ((pwAll = v), provide({ pwAll }))],
  pwCtxId: [() => pwCtxId, v => (pwCtxId = v)],
  pwOn: [() => pwOn, v => ((pwOn = v), provide({ pwOn }))],
  pwPaint: [() => pwPaint, v => ((pwPaint = v), provide({ pwPaint }))],
  pwSendCtx: [() => pwSendCtx, v => (pwSendCtx = v)],
  pwSendTiles: [() => pwSendTiles, v => (pwSendTiles = v)],
  pwSettle: [() => pwSettle, v => ((pwSettle = v), provide({ pwSettle }))],
  pwSource: [() => pwSource, v => (pwSource = v)],
  pwState: [() => pwState, v => (pwState = v)],
  pwWake: [() => pwWake, v => (pwWake = v)],
  pwWorker: [() => pwWorker, v => (pwWorker = v)],
});
/* eslint-enable no-func-assign */
provide({ pwAll, pwOn, pwPaint, pwSettle });
/* to-module: end */
const PW = {
  w: null,
  bad: false,
  why: '',
  id: 0,
  jobs: new Map(),
  ids: new Map(),
  ctxN: 0,
  sent: new Map(),
  tiles: new Map(),
  gen: '',
  sync: 0,
  done: 0,
  local: 0,
  fails: 0,
  ms: 0,
  waiters: [],
  last: '',
};
provide({ PW }); /* to-module */
const PW_KEEP = 4,
  PW_KINDS = new WeakMap();
/* the helper's own part: the views it holds, the tile pictures, a queue (nearest square first; one dropped before it
   starts is skipped) and the small sizes of a picture */
const PW_MAIN = `var TERRAIN_MATERIALS;let CTX=null;const CTXS=new Map(),TILES=new Map(),Q=[],GONE=new Set();let busy=false;
/* (stand-ins for walk-view.js's own, from what the main thread handed over) */
var walkData=()=>({sc:CTX.C}),bigTilesOn=()=>!!CTX.next,worldPatchTilesOn=()=>!!CTX.t47,stepGrid=sc=>CTX.E,mapBridges=()=>null,
 tileSetPixels=(T,TP)=>TILES.get(TP+'|'+T.tile+'|'+(T.vars||[]).join(','))||[null];
function pwMips(s,W,H,n){const out=[];for(let k=0;k<n&&W>1&&H>1;k++){const w=W>>1,h=H>>1,d=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++){const r0=(y*2)*W*4,r1=r0+W*4;for(let x=0;x<w;x++){const a=r0+x*8,c=r1+x*8,o=(y*w+x)*4;
  d[o]=(s[a]+s[a+4]+s[c]+s[c+4]+2)>>2;d[o+1]=(s[a+1]+s[a+5]+s[c+1]+s[c+5]+2)>>2;d[o+2]=(s[a+2]+s[a+6]+s[c+2]+s[c+6]+2)>>2;d[o+3]=(s[a+3]+s[a+7]+s[c+3]+s[c+7]+2)>>2}}
 out.push(d);s=d;W=w;H=h}return out}
function run(){busy=false;if(!Q.length)return;Q.sort((a,b)=>a.pr-b.pr);const m=Q.shift();if(GONE.delete(m.id)){postMessage({id:m.id,gone:1});if(Q.length){busy=true;setTimeout(run,0)}return}
 try{const c=CTXS.get(m.ctx);if(!c){postMessage({id:m.id,miss:1})}else{CTXS.delete(m.ctx);CTXS.set(m.ctx,c);CTX=c;TERRAIN_MATERIALS=c.mat||undefined;const t0=performance.now(),it=paintGroundSteps(c.sc,m.o);let r=it.next();while(!r.done)r=it.next();
  const v=r.value,tr=[v.px.buffer];if(v.nrm)tr.push(v.nrm.buffer);let mips=null,nmips=null;
  if(m.mips){mips=pwMips(new Uint8Array(v.px.buffer),v.w,v.h,30);for(const L of mips)tr.push(L.buffer);if(v.nrm){nmips=pwMips(v.nrm,v.nw,v.nh,30);for(const L of nmips)tr.push(L.buffer)}}
  postMessage({id:m.id,r:v,mips,nmips,ms:performance.now()-t0},tr)}}
 catch(e){postMessage({id:m.id,err:String(e&&e.stack||e).slice(0,400)})}
 if(Q.length){busy=true;setTimeout(run,0)}}
onmessage=ev=>{const m=ev.data;
 if(m.t==='ctx'){CTXS.delete(m.id);CTXS.set(m.id,m.ctx);while(CTXS.size>${PW_KEEP})CTXS.delete(CTXS.keys().next().value);return}
 if(m.t==='tiles'){if(m.gen!==TILES.gen){TILES.clear();TILES.gen=m.gen}for(const [k,L] of m.L)TILES.set(k,L);return}
 if(m.t==='cancel'){if(Q.some(q=>q.id===m.id))GONE.add(m.id);return}
 if(m.t==='prio'){for(const q of Q)if(q.id===m.id)q.pr=m.pr;return}
 if(m.t==='paint'){Q.push(m);if(!busy){busy=true;setTimeout(run,0)}}};`;
/* the worker's source: the painter and everything it calls, as written in walk-view.js (and wrNear, seamless-world.js) */
function pwSource() {
  const fns = [
    hash2d,
    valueNoise2d,
    groundToneAt,
    applyGroundTone,
    scaleColor,
    plainTileIndex,
    stableCells,
    pathWearLines,
    clipSegmentToRect,
    pathWearAmountFn,
    pathWearFn,
    stepGridCorners,
    stepCornerHeight,
    stepCellsJoined,
    paintGroundSteps,
    wrNear,
  ];
  const consts = {
    GROUND_BORDER_M,
    TONE_DIRECTIONS,
    TONE_DARK,
    TONE_LIGHT,
    TONE_AMOUNT,
    TONE_NONE,
  };
  return [
    'const clamp=' + clamp.toString() + ';',
    'const hexA=' + hexA.toString() + ';',
    'const pk=' + pk.toString() + ';',
    'const pkh=' + pkh.toString() + ';',
    ...Object.entries(consts).map(([k, v]) => `const ${k}=${JSON.stringify(v)};`),
    ...fns.map(f => f.toString()),
    PW_MAIN,
  ].join('\n');
}
function pwOn() {
  return !!pwWorker();
}
function pwWorker() {
  if (PW.w || PW.bad) return PW.w;
  if (typeof Worker === 'undefined' || (typeof eng === 'function' && eng('quality', 'paintWorker') === false)) {
    PW.bad = true;
    PW.why = typeof Worker === 'undefined' ? 'no workers here' : 'turned off';
    return null;
  }
  try {
    const u = URL.createObjectURL(new Blob([pwSource()], { type: 'text/javascript' })),
      W = new Worker(u);
    W.onmessage = ev => {
      const m = ev.data,
        j = PW.jobs.get(m.id);
      PW.jobs.delete(m.id);
      if (j) {
        j.done = true;
        if (m.r) {
          j.r = m.r;
          j.r.mips = m.mips;
          j.r.nmips = m.nmips;
          PW.done++;
          PW.ms += m.ms || 0;
        } else if (m.miss) {
          j.miss = 1;
        } else if (m.err) {
          j.err = m.err;
          PW.fails++;
          PW.last = m.err;
        }
      }
      pwWake();
    };
    W.onerror = e => {
      PW.bad = true;
      PW.why = 'the helper stopped: ' + ((e && e.message) || 'error');
      PW.w = null;
      for (const j of PW.jobs.values()) {
        j.done = true;
        j.err = 'worker';
      }
      PW.jobs.clear();
      pwWake();
      if (typeof NWLOG !== 'undefined') NWLOG.add('webgl', 'ground painter helper: ' + PW.why);
    };
    PW.w = W;
    PW.gen = '';
  } catch (e) {
    PW.bad = true;
    PW.why = 'not allowed here (' + String((e && e.message) || e).slice(0, 80) + ')';
  }
  return PW.w;
}
function pwWake() {
  const L = PW.waiters;
  PW.waiters = [];
  for (const f of L) f();
}
/* for async callers (buildGroundAsync): wait for the helper's next answer (or a tenth of a second) */
function pwSettle() {
  return new Promise(res => {
    PW.waiters.push(res);
    setTimeout(res, 100);
  });
}
/* a view's id with the helper: its ground key (tiles, sizes, heights, art) and its own id */
function pwCtxId(sc) {
  const key = (sc.id || '') + '|' + (sc === walkView.sc && walkView.gkey ? walkView.gkey : groundKey(sc));
  let id = PW.ids.get(key);
  if (id == null) {
    id = ++PW.ctxN;
    PW.ids.set(key, id);
    if (PW.ids.size > 64) PW.ids.delete(PW.ids.keys().next().value);
  }
  return id;
}
function pwSendCtx(id, sc) {
  if (PW.sent.has(id)) {
    PW.sent.delete(id);
    PW.sent.set(id, 1);
    return;
  }
  const C = walkData().sc,
    E = stepGrid(sc);
  const S = sc.stable
    ? {
        scenes: sc.stable.scenes.map(r => ({
          id: r.id,
          x: r.x,
          z: r.z,
          w: r.w,
          h: r.h,
          clip: r.clip,
          salt: r.salt,
          hub: r.hub,
          exits: r.exits,
          worn: r.worn,
        })),
        roads: (sc.stable.roads || []).map(q => ({
          o: q.o,
          salt: q.salt,
          R: { legs: ((q.R && q.R.legs) || []).map(s => ({ a: s.a, b: s.b, u0: s.u0 })) },
        })),
      }
    : null;
  const ctx = {
    C: { terrains: C.terrains, tile: C.tile },
    sc: {
      w: sc.w,
      h: sc.h,
      tiles: sc.tiles,
      edge: sc.edge,
      hub: sc.hub || null,
      exits: sc.exits || [],
      worn: sc.worn || null,
      stable: S,
    },
    E: E ? { s: 'w', m0: 'w', w: E.w, h: E.h, H: E.H, M: E.M } : null,
    t47: worldPatchTilesOn(),
    next: bigTilesOn(),
    mat: typeof TERRAIN_MATERIALS !== 'undefined' ? TERRAIN_MATERIALS : null,
  };
  PW.w.postMessage({ t: 'ctx', id, ctx });
  PW.sent.set(id, 1);
  while (PW.sent.size > PW_KEEP) PW.sent.delete(PW.sent.keys().next().value);
}
/* the tile pictures of every kind the view shows, at TP pixels a metre (sent once; again when the art changes).
   false while a picture hasn't loaded: that rectangle is painted here meanwhile, as before */
function pwSendTiles(sc, TP) {
  const C = walkData().sc,
    gen = (typeof dioArtVer === 'function' ? dioArtVer() : 0) + '|' + groundTileFolder() + '|' + (bigTilesOn() ? 1 : 0);
  if (gen !== PW.gen) {
    PW.gen = gen;
    PW.tiles.clear();
  }
  let kinds = PW_KINDS.get(sc.tiles);
  if (!kinds) {
    kinds = new Set();
    for (const row of sc.tiles || []) for (let i = 0; i < row.length; i++) kinds.add(row[i]);
    PW_KINDS.set(sc.tiles, kinds);
  }
  kinds = new Set(kinds).add(sc.edge);
  const L = [];
  let ok = true;
  for (const ch of kinds) {
    const T = C.terrains[ch];
    if (!T) continue;
    const k = TP + '|' + T.tile + '|' + (T.vars || []).join(',');
    if (PW.tiles.get(k) === 2) continue;
    const set = tileSetPixels(T, TP),
      full = set.every(Boolean);
    if (!full) {
      ok = false;
      continue;
    }
    L.push([k, set]);
    PW.tiles.set(k, 2);
  }
  if (L.length) PW.w.postMessage({ t: 'tiles', gen, L });
  return ok;
}
/* paint a rectangle of a view's ground (the options of paintGroundSteps): on the helper when it can, here otherwise */
function* pwPaint(sc, o) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const W = PW.sync ? null : pwWorker();
    if (!W || !sc || !sc.tiles) break;
    let id, job, cid;
    try {
      cid = pwCtxId(sc);
      pwSendCtx(cid, sc);
      if (!pwSendTiles(sc, o.TP)) break;
      id = ++PW.id;
      job = { done: false };
      PW.jobs.set(id, job);
      if (o.rec) {
        o.rec.id = id;
        o.pr = o.rec.pr;
      }
      W.postMessage({
        t: 'paint',
        id,
        ctx: cid,
        pr: o.pr || 0,
        mips: !!o.mips,
        o: { TP: o.TP, rect: o.rect, margin: o.margin, nhalf: !!o.nhalf, normals: o.normals },
      });
    } catch (e) {
      PW.fails++;
      PW.last = String((e && e.message) || e);
      break;
    }
    try {
      while (!job.done) yield PAINT_WORKER_WAIT;
    } finally {
      if (!job.done) {
        PW.jobs.delete(id);
        if (PW.w) PW.w.postMessage({ t: 'cancel', id });
      }
    }
    if (job.r) return job.r;
    if (job.miss) {
      PW.sent.delete(cid);
      continue;
    }
    /* the helper had let the view go: hand it over again */ break;
  }
  PW.local++;
  return yield* paintGroundSteps(sc, o);
}
/* several paintings at once (the squares round where you will come in): all are queued on the helper together */
function* pwAll(G) {
  const L = G.slice();
  try {
    while (L.length) {
      let moved = false;
      for (let k = L.length - 1; k >= 0; k--) {
        const r = L[k].next();
        if (r.done) {
          L.splice(k, 1);
          moved = true;
        } else if (r.value !== PAINT_WORKER_WAIT) moved = true;
      }
      if (L.length) yield moved ? undefined : PAINT_WORKER_WAIT;
    }
  } finally {
    for (const g of L)
      try {
        g.return();
      } catch (e) {}
  }
}
/* for the debug log */
export function pwState() {
  return {
    helper: PW.w ? 'on' : PW.bad ? 'off: ' + PW.why : 'not started',
    painted: PW.done,
    here: PW.local,
    failed: PW.fails,
    avgMs: PW.done ? Math.round(PW.ms / PW.done) : 0,
    last: PW.last || undefined,
  };
}
