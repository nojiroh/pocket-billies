// Characters track CH-2: the figure baker (game/js/figures.js) against a stand-in WebGL2 context: what one bake sends,
// the pictures it keeps, how many it bakes a frame, and a lost context (the baker's own) and its return. No graphics.
import assert from 'node:assert/strict';
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
  Object.assign(B, { cv: null, gl: null, ready: false, lost: 0, failed: '', fb: null, size: [0, 0] });
  Object.assign(B, { bakes: 0, ms: 0, losses: 0, frame: -1, frameBakes: 0 });
  G.figureCacheClear();
  G.document.createElement = D.createElement;
  G.gpuState.fr = 1000;
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
