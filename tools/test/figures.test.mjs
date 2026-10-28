// Characters track CH-2: the figure baker (game/js/figures.js) against a stand-in WebGL2 context: what one bake sends,
// the pictures it keeps, how many it bakes a frame, and a lost context (the baker's own) and its return. No graphics.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import './walk-renderer.mjs';

const G = globalThis;

/* a WebGL2 stand-in that compiles and links everything, records every call, and loses its context on demand */
function fakeGl(cv) {
  const calls = [],
    uniforms = new Map(),
    copy = a => (ArrayBuffer.isView(a) || Array.isArray(a) ? Array.from(a) : a);
  let lost = false,
    progs = 0;
  const own = {
    calls,
    isContextLost: () => lost,
    getShaderParameter: () => true,
    getProgramParameter: (p, k) => (k === 'ACTIVE_UNIFORMS' ? p.u.length : true),
    createShader: t => ({ t, src: '' }),
    shaderSource: (s, src) => (s.src = src),
    attachShader: (p, s) => p.sh.push(s),
    createProgram: () => (progs++, { sh: [], u: [] }),
    linkProgram: p => {
      /* the uniforms its shaders declare, as the driver would list them (arrays with [0]) */
      const src = p.sh.map(s => s.src).join('\n');
      for (const m of src.matchAll(/uniform\s+\w+\s+([^;]+);/g))
        for (const d of m[1].split(',')) p.u.push(d.includes('[') ? d.trim().replace(/\[\d+\]/, '[0]') : d.trim());
      uniforms.set(p, p.u);
    },
    getActiveUniform: (p, i) => ({ name: p.u[i] }),
    getUniformLocation: (p, n) => n.replace(/\[0\]$/, ''),
    getAttribLocation: (p, n) => ['aP', 'aN', 'aJ', 'aC', 'aQ'].indexOf(n),
    getExtension: k =>
      k === 'WEBGL_lose_context'
        ? {
            loseContext() {
              lost = true;
              cv.fire('webglcontextlost');
            },
            restoreContext() {
              lost = false;
              cv.fire('webglcontextrestored');
            },
          }
        : null,
  };
  const gl = new Proxy(own, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z_0-9]+$/.test(k)) return k;
      return (...args) => {
        calls.push([k, ...args.map(copy)]);
        return { k };
      };
    },
  });
  gl.programs = () => progs;
  return gl;
}
/* document.createElement('canvas') for the baker (webgl2) and for the pictures (2d) */
function fakeDocument(opts = {}) {
  const made = { gl: null, pictures: [] };
  const createElement = () => {
    const on = {};
    const cv = {
      width: 300,
      height: 150,
      style: {},
      addEventListener: (k, f) => (on[k] ||= []).push(f),
      fire: (k, e = { preventDefault() {} }) => (on[k] || []).forEach(f => f(e)),
      getContext(type) {
        if (type === 'webgl2') return opts.noGl ? null : (made.gl ||= Object.assign(fakeGl(cv), { cv }));
        if (type === '2d') {
          made.pictures.push(cv);
          return (cv.x ||= {
            draws: [],
            fills: [],
            fillStyle: '',
            drawImage: (...a) => cv.x.draws.push(a),
            fillRect: (...a) => cv.x.fills.push([cv.x.fillStyle, ...a]),
            imageSmoothingEnabled: true,
          });
        }
        return null;
      },
    };
    return cv;
  };
  return { made, createElement };
}

/* a fresh baker on a stand-in document; the engine's dials at their defaults (density 32, 16 turns, the outline) */
function freshBaker(opts) {
  const D = fakeDocument(opts),
    B = G.figureBaker;
  Object.assign(B, { cv: null, gl: null, ready: false, lost: 0, failed: '', fb: null, size: [0, 0], res: new Map() });
  Object.assign(B, { bakes: 0, ms: 0, losses: 0, frame: -1, frameBakes: 0, bytes: 0 });
  G.figureCacheClear();
  G.document.createElement = D.createElement;
  G.gpuState.fr = 1000;
  /* the frame's one-off work budget (walk/quality-cull.js), plenty unless a test spends it */
  G.walkRenderer.budT = performance.now();
  G.walkRenderer.budMs = 1e9;
  return D;
}
const was = G.document.createElement;
const TILT = (26 * Math.PI) / 180;

test('figures: one bake draws the mannequin and its outline, and gives a person’s picture', () => {
  try {
    const D = freshBaker(),
      rec = {},
      im = G.figurePicture(rec, 'mannequin', 'idle', 0, Math.PI, 0, TILT);
    assert.ok(im, 'a picture');
    const S = G.cardSize(32, 13 * G.TILT_STEP);
    assert.deepEqual([im.width, im.height, im.ax, im.ay, im.ppm, im.noNormal], [S.w, S.h, S.ax, S.ay, 32, true]);
    assert.ok(G.personPicture(im), 'counted as a person’s picture (logic/person-view.js)');
    const calls = D.made.gl.calls,
      draws = calls.filter(c => c[0] === 'drawArrays');
    assert.deepEqual(
      draws.map(c => c.slice(1)),
      [
        ['TRIANGLES', 0, G.figureMesh(G.mannequinFigure()).count],
        ['TRIANGLES', 0, 6],
      ],
      'the figure, then the outline pass'
    );
    const J = calls.find(c => c[0] === 'uniformMatrix4fv' && c[1] === 'uJ');
    assert.equal(J[3].length, G.mannequinFigure().parts.length * 16, 'a matrix for each part');
    const out = calls.find(c => c[0] === 'uniform1f' && c[1] === 'uOut');
    assert.equal(out[2], 1, 'the outline on');
    /* copied from the bottom rows of the baker's canvas */
    const d = im.x.draws[0];
    assert.deepEqual(d.slice(1), [0, D.made.gl.cv.height - S.h, S.w, S.h, 0, 0, S.w, S.h]);
    assert.equal(G.figureReport().bakes, 1);
    assert.equal(G.figureReport().pictures, 1);
    /* facing the camera: its face painted on, in whole pixels; from behind none */
    assert.equal(im.x.fills.length, 7, 'two eyes, two glints, a mouth, two blushes');
    assert.ok(im.x.fills.every(f => /^rgb\(\d+,\d+,\d+\)$/.test(f[0]) && f.slice(1).every(Number.isInteger)));
    G.gpuState.fr++;
    assert.equal(G.figurePicture({}, 'mannequin', 'idle', 0, 0, 0, TILT).x.fills.length, 0);
  } finally {
    G.document.createElement = was;
  }
});

test('figures: a picture is kept: the same view, pose and dials bake once', () => {
  try {
    freshBaker();
    const a = G.figurePicture({}, 'mannequin', 'walk', 3, 0.4, 0, TILT);
    G.gpuState.fr++;
    const b = G.figurePicture({}, 'mannequin', 'walk', 3, 0.41, 0, TILT + 0.001);
    assert.equal(a, b, 'the same steps');
    assert.equal(G.figureReport().bakes, 1);
    const c = G.figurePicture({}, 'mannequin', 'walk', 4, 0.4, 0, TILT);
    assert.notEqual(c, a);
    assert.equal(G.figureReport().bakes, 2);
    assert.equal(G.figurePicture({}, 'nobody', 'idle', 0, 0, 0, TILT), null, 'only known figures');
  } finally {
    G.document.createElement = was;
  }
});

test('figures: at most four bakes a frame; a person keeps their last picture meanwhile', () => {
  try {
    freshBaker();
    const rec = {},
      got = [];
    for (let f = 0; f < 6; f++) got.push(G.figurePicture(rec, 'mannequin', 'idle', f, Math.PI, 0, TILT));
    assert.equal(G.figureReport().bakes, 4);
    assert.equal(got[4], got[3], 'the fifth waits on the fourth');
    assert.equal(got[5], got[3]);
    assert.equal(G.figurePicture({}, 'mannequin', 'idle', 9, Math.PI, 0, TILT), null, 'someone with none yet: none');
    G.gpuState.fr++;
    assert.notEqual(G.figurePicture(rec, 'mannequin', 'idle', 4, Math.PI, 0, TILT), got[3], 'baked the next frame');
  } finally {
    G.document.createElement = was;
  }
});

test('figures: with the frame’s work budget spent, one bake a frame', () => {
  try {
    freshBaker();
    G.walkRenderer.budMs = -1;
    const rec = {};
    for (let f = 0; f < 4; f++) G.figurePicture(rec, 'mannequin', 'idle', f, Math.PI, 0, TILT);
    assert.equal(G.figureReport().bakes, 1);
    G.gpuState.fr++;
    G.figurePicture(rec, 'mannequin', 'idle', 1, Math.PI, 0, TILT);
    assert.equal(G.figureReport().bakes, 2, 'the next frame bakes the next one');
  } finally {
    G.document.createElement = was;
  }
});

test('figures: the baker’s lost context bakes nothing, and bakes again once it is back', async () => {
  try {
    const D = freshBaker(),
      rec = {},
      a = G.figurePicture(rec, 'mannequin', 'idle', 0, Math.PI, 0, TILT);
    assert.ok(a);
    const progs = D.made.gl.programs();
    assert.equal(G.figureBakerLose(0), true);
    assert.equal(G.figureReport().lost, 1);
    G.gpuState.fr++;
    assert.equal(G.figurePicture(rec, 'mannequin', 'idle', 1, Math.PI, 0, TILT), a, 'the last picture while lost');
    assert.equal(G.figureReport().bakes, 1);
    await new Promise(ok => setTimeout(ok, 5));
    assert.equal(G.figureReport().lost, 0, 'restored');
    G.gpuState.fr++;
    const b = G.figurePicture(rec, 'mannequin', 'idle', 1, Math.PI, 0, TILT);
    assert.ok(b && b !== a, 'baked again');
    assert.equal(D.made.gl.programs(), progs + 2, 'its two programs made again');
    assert.equal(G.figureReport().losses, 1);
    /* the pictures baked before the loss are plain canvases, still kept */
    assert.equal(G.figurePicture({}, 'mannequin', 'idle', 0, Math.PI, 0, TILT), a);
  } finally {
    G.document.createElement = was;
  }
});

test('figures: no WebGL2 for the baker: no pictures, no throw, the reason in the report', () => {
  try {
    freshBaker({ noGl: true });
    assert.equal(G.figurePicture({}, 'mannequin', 'idle', 0, Math.PI, 0, TILT), null);
    assert.equal(G.figureReport().failed, 'no WebGL2 context');
    assert.equal(G.figurePicture({}, 'mannequin', 'idle', 1, Math.PI, 0, TILT), null);
  } finally {
    G.document.createElement = was;
    G.figureBaker.failed = '';
  }
});

test('figures: at most 600 pictures kept, the longest unused going first', () => {
  try {
    freshBaker();
    const first = G.figurePicture({}, 'mannequin', 'idle', 0, Math.PI, 0, TILT);
    for (let i = 1; i <= 600; i++) {
      G.gpuState.fr++;
      G.figurePicture(
        {},
        'mannequin',
        'walk',
        i % 8,
        /* 8 frames by 16 turns by 5 tilts: 600 views, none twice */
        (Math.floor(i / 8) % 16) * (Math.PI / 8),
        0,
        TILT + Math.floor(i / 128) * G.TILT_STEP * 2
      );
      if (i === 300) {
        G.gpuState.fr++;
        assert.equal(G.figurePicture({}, 'mannequin', 'idle', 0, Math.PI, 0, TILT), first, 'used again: kept longer');
      }
    }
    const R = G.figureReport();
    assert.equal(R.pictures, 600);
    G.gpuState.fr++;
    assert.equal(G.figurePicture({}, 'mannequin', 'idle', 0, Math.PI, 0, TILT), first, 'still kept');
  } finally {
    G.document.createElement = was;
  }
});

test('figures: a figure made from a model (the stand-in): its triangles by index, its texture, a joint each', () => {
  const was2 = G.artImg;
  try {
    const D = freshBaker(),
      file = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/art/figures/rogue.json'), 'utf8'));
    G.artImg = () => ({ complete: true, naturalWidth: 128, naturalHeight: 128 });
    const Fig = G.figureFromFile('rogue', file);
    assert.equal(Fig.kind, 'mesh');
    assert.equal(Fig.data.length, file.counts.vertices * 9);
    assert.equal(Fig.index.length, file.counts.triangles * 3);
    assert.equal(Fig.clips.walk.mats.length, file.clips.walk.frames * file.joints.length * 12);
    G.FIGURE_DEFS.rogue = Fig;
    const im = G.figurePersonPicture({}, 'rogue', 0, 'idle', 0, Math.PI);
    assert.ok(im && im.ppm === 32, 'a person’s picture at 32 px a metre');
    const S = G.cardSize(32, 13 * G.TILT_STEP, file.extent);
    assert.deepEqual([im.width, im.height], [S.w, S.h], 'as big as its extent');
    const calls = D.made.gl.calls;
    assert.deepEqual(
      calls.filter(c => c[0] === 'drawElements').map(c => c.slice(1)),
      [['TRIANGLES', file.counts.triangles * 3, 'UNSIGNED_SHORT', 0]]
    );
    assert.equal(calls.find(c => c[0] === 'uniformMatrix4fv' && c[1] === 'uJ')[3].length, file.joints.length * 16);
    assert.equal(calls.find(c => c[0] === 'uniform1f' && c[1] === 'uTexOn')[2], 1, 'coloured by its texture');
    assert.ok(
      calls.some(c => c[0] === 'texImage2D'),
      'its texture in the baker'
    );
    assert.equal(im.x.fills.length, 0, 'its face is in its texture');
    /* the plain 3D figure: smooth, no outline, at 128 px a metre */
    G.gpuState.fr++;
    const B = G.figurePersonPicture({}, 'rogue', 0, 'idle', 0, Math.PI, 'smooth');
    assert.equal(B.ppm, 128);
    const outs = calls.filter(c => c[0] === 'uniform1f' && c[1] === 'uOut');
    assert.equal(outs[outs.length - 1][2], 0, 'no outline');
    const sm = calls.filter(c => c[0] === 'uniform1f' && c[1] === 'uSmooth');
    assert.equal(sm[sm.length - 1][2], 1);
    /* an act it has, and one it hasn't: the idle */
    G.gpuState.fr++;
    assert.ok(G.figurePersonPicture({}, 'rogue', 0, 'cheer', 0, Math.PI));
    assert.ok(G.figurePersonPicture({}, 'rogue', 0, 'dance', 0, Math.PI));
    /* in battle: at 64 px a metre, square to the level camera, the throw by how far through it the battle is */
    G.gpuState.fr++;
    const T = {},
      bp = G.figureBattlePicture(T, 0, 0, 'throw', 0.5);
    assert.ok(bp && bp.ppm === 64 && bp.figure === 'rogue');
    const S0 = G.cardSize(64, 0, file.extent);
    assert.deepEqual([bp.width, bp.height], [S0.w, S0.h], 'no tilt: the card as tall as the figure');
    const J = calls.filter(c => c[0] === 'uniformMatrix4fv' && c[1] === 'uJ').pop()[3],
      want = G.meshClipMatrices(Fig.clips.throw, Math.floor(0.5 * Fig.clips.throw.frames), file.joints.length, 64);
    assert.ok(
      J.every((v, k) => Math.abs(v - want[k]) < 1e-5),
      'the throw half way through'
    );
    G.gpuState.fr++;
    assert.ok(G.figureBattlePicture({}, 1, 0, null, 0), 'the rival, idle');
  } finally {
    G.document.createElement = was;
    G.artImg = was2;
    delete G.FIGURE_DEFS.rogue;
  }
});

test('figures: a model’s file is fetched once, and none is drawn until it is in', () => {
  try {
    freshBaker();
    delete G.FIGURE_DEFS.rogue;
    assert.equal(G.figurePersonPicture({}, 'rogue', 0, 'idle', 0, Math.PI), null, 'loading');
    assert.equal(G.FIGURE_DEFS.rogue, null);
    assert.equal(G.figurePersonPicture({}, 'nobody', 0, 'idle', 0, Math.PI), null);
    assert.equal(G.FIGURE_DEFS.nobody, false);
  } finally {
    G.document.createElement = was;
    delete G.FIGURE_DEFS.rogue;
    delete G.FIGURE_DEFS.nobody;
  }
});

test('figures: at most 48 MB of pictures kept: big plain 3D pictures go sooner', () => {
  try {
    freshBaker();
    /* the mannequin's plain 3D pictures are about 0.19 MB each: 400 of them would be 74 MB */
    for (let i = 0; i < 400; i++) {
      G.gpuState.fr++;
      G.figurePicture(
        {},
        'mannequin',
        'walk',
        i % 8,
        (Math.floor(i / 8) % 16) * (Math.PI / 8),
        0,
        TILT + Math.floor(i / 128) * G.TILT_STEP * 2,
        'smooth'
      );
    }
    const R = G.figureReport();
    assert.ok(R.mb <= 48 && R.mb > 46, `${R.mb} MB`);
    assert.ok(R.pictures < 300, `${R.pictures} pictures`);
    G.figureCacheClear();
    assert.equal(G.figureReport().mb, 0);
  } finally {
    G.document.createElement = was;
  }
});
