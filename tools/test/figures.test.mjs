// Characters track CH-2: the figure baker (game/js/figures.js) against a stand-in WebGL2 context: what one bake sends,
// the pictures it keeps, how many it bakes a frame, and a lost context (the baker's own) and its return. No graphics.
import './figure-kit-data.mjs';
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
            clearRect: () => {},
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

/* a fresh baker on a stand-in document; the engine's dials at their defaults (density 48 since CH-3b, 16 turns, the
   outline) */
const PPM = 48;
function freshBaker(opts) {
  const D = fakeDocument(opts),
    B = G.figureBaker;
  Object.assign(B, { cv: null, gl: null, ready: false, lost: 0, failed: '', fb: null, size: [0, 0], res: new Map() });
  Object.assign(B, {
    bakes: 0,
    ms: 0,
    losses: 0,
    frame: -1,
    frameBakes: 0,
    bytes: 0,
    busts: 0,
    bustMs: 0,
    bustAt: -1e9,
  });
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
    const S = G.cardSize(PPM, 13 * G.TILT_STEP);
    assert.deepEqual([im.width, im.height, im.ax, im.ay, im.ppm, im.noNormal], [S.w, S.h, S.ax, S.ay, PPM, true]);
    assert.ok(G.personPicture(im), 'counted as a person’s picture (logic/person-view.js)');
    const calls = D.made.gl.calls,
      draws = calls.filter(c => c[0] === 'drawArrays');
    assert.deepEqual(
      draws.map(c => c.slice(1)),
      [
        ['TRIANGLES', 0, G.figureMesh(G.mannequinFigure()).count],
        ['TRIANGLES', 0, G.figureMesh(G.mannequinFigure()).count],
        ['TRIANGLES', 0, 6],
      ],
      'the figure from the light (CH-3b: its own shadows), the figure, then the outline pass'
    );
    const J = calls.find(c => c[0] === 'uniformMatrix4fv' && c[1] === 'uJ');
    assert.equal(J[3].length, G.figureGpuMesh(G.mannequinFigure()).slots.length * 16, 'a matrix for each moving part');
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
    assert.equal(
      D.made.gl.programs(),
      progs + 3,
      'its three programs made again (the figure, its shadow, the outline)'
    );
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
  const was2 = G.artImg,
    wasChoice = G.figureChoice;
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
    assert.ok(im && im.ppm === PPM, 'a person’s picture at the dial’s pixels a metre');
    const S = G.cardSize(PPM, 13 * G.TILT_STEP, file.extent);
    assert.deepEqual([im.width, im.height], [S.w, S.h], 'as big as its extent');
    const calls = D.made.gl.calls;
    assert.deepEqual(
      calls.filter(c => c[0] === 'drawElements').map(c => c.slice(1)),
      [
        ['TRIANGLES', file.counts.triangles * 3, 'UNSIGNED_SHORT', 0],
        ['TRIANGLES', file.counts.triangles * 3, 'UNSIGNED_SHORT', 0],
      ],
      'from the light, then as seen'
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
    /* in battle: at FIGURE_BATTLE_PPM (96), square to the level camera, the throw by how far through it the battle is (you
       as the stand-in: Engine > People > Your figure; CH-3b's default is your own look) */
    G.figureChoice = () => 'rogue';
    G.gpuState.fr++;
    const T = {},
      bp = G.figureBattlePicture(T, 0, 0, 'throw', 0.5);
    assert.ok(bp && bp.ppm === G.FIGURE_BATTLE_PPM && bp.figure === 'rogue');
    const S0 = G.cardSize(G.FIGURE_BATTLE_PPM, 0, file.extent);
    assert.deepEqual([bp.width, bp.height], [S0.w, S0.h], 'no tilt: the card as tall as the figure');
    const J = calls.filter(c => c[0] === 'uniformMatrix4fv' && c[1] === 'uJ').pop()[3],
      want = G.meshClipMatrices(
        Fig.clips.throw,
        Math.floor(0.5 * Fig.clips.throw.frames),
        file.joints.length,
        G.FIGURE_BATTLE_PPM
      );
    assert.ok(
      J.every((v, k) => Math.abs(v - want[k]) < 1e-5),
      'the throw half way through'
    );
    G.gpuState.fr++;
    assert.ok(G.figureBattlePicture({}, 1, 0, null, 0), 'the rival, idle');
  } finally {
    G.document.createElement = was;
    G.artImg = was2;
    G.figureChoice = wasChoice;
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

test('figures: everyone their own figure (CH-3b): look:<who>, you by your look, Kappi the capybara', () => {
  const was3 = [G.lookOf, G.figureChoice, G.figureItems, G.figureStyle],
    W = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/wardrobe.json'), 'utf8')),
    looks = {
      me: { body: {}, skin: '#E6B08A', wear: { hair: 'hair_short', top: 'tee' } },
      clerk: { body: {}, skin: '#E6B08A', wear: { hair: 'hair_bun', top: 'longsleeve', glasses: 'glasses_round' } },
      kappi: { name: 'Kappi', creature: { rig: 'kappi', ht: 0.8 } },
    };
  try {
    const D = freshBaker();
    G.lookOf = who => looks[who === 'boy' || who === 'girl' ? 'me' : who];
    G.figureItems = () => W.items;
    G.figureChoice = () => 'look';
    /* a direction with designs of its own builds everyone its way (its name after '@') */
    G.figureStyle = () => 'gnight';
    assert.match(G.figureFor('clerk'), /^look:clerk#[0-9a-z]+@gnight$/);
    assert.match(G.figureFor('me'), /^look:me#[0-9a-z]+@gnight$/);
    G.figureStyle = () => 'pixel';
    /* CH-5: named by what each is built from (their look, figure choice and the kit's revision) */
    const clerk = G.figureFor('clerk');
    assert.match(clerk, /^look:clerk#[0-9a-z]+$/);
    assert.match(G.figureFor('folk:12'), /^look:folk:12#[0-9a-z]+$/);
    const me = G.figureFor('boy');
    assert.ok(me.startsWith('look:me#'));
    assert.equal(G.figureFor('girl'), me, 'boy, girl and me are your look');
    looks.me = { ...looks.me, wear: { ...looks.me.wear, top: 'tank' } };
    assert.notEqual(G.figureFor('me'), me, 'a new look, a new figure');
    /* CH-5: the Studio's kit data (an edit): everyone is a new figure; the game's again: the same names as before */
    const kit = structuredClone(G.GAMEDATA.figureKit);
    kit.heads.round.jaw += 0.1;
    G.figureKitUse(kit);
    assert.notEqual(G.figureFor('clerk'), clerk, 'an edited kit, a new figure');
    assert.equal(G.figureReport().kit.endsWith(' (own)'), true);
    G.figureKitUse(null);
    assert.equal(G.figureFor('clerk'), clerk, 'the game’s kit again');
    G.figureChoice = () => 'mannequin';
    assert.equal(G.figureFor('me'), 'mannequin', 'or the spike’s figure you picked');
    /* built by the kit, baked as a person's picture; Kappi on four legs */
    const im = G.figurePersonPicture({}, clerk, 0, 'idle', 0, Math.PI);
    assert.ok(im && im.ppm === PPM && im.figure === clerk);
    assert.ok(im.x.fills.length >= 6, 'a face: eyes, glints, irises, a mouth, glasses');
    assert.ok(G.FIGURE_DEFS[clerk].F.kit, 'the head and build the kit chose');
    G.gpuState.fr++;
    assert.ok(G.figurePersonPicture({}, 'look:kappi', 0, 'walk', 0.6, Math.PI));
    assert.ok(G.FIGURE_DEFS['look:kappi'].F.parts.some(p => p.id === 'legBR'));
    /* the card fits a cheer's raised arms */
    const ext = G.FIGURE_DEFS[clerk].ext;
    assert.ok(ext.top > G.FIGURE_DEFS[clerk].F.height, `${ext.top}`);
    assert.ok(D.made.gl.calls.some(c => c[0] === 'drawArrays'));
  } finally {
    G.document.createElement = was;
    [G.lookOf, G.figureChoice, G.figureItems, G.figureStyle] = was3;
    for (const k of Object.keys(G.FIGURE_DEFS)) if (k.startsWith('look:')) delete G.FIGURE_DEFS[k];
  }
});

test('figures: you as you picked (CH-7): a direction keeps its extras but not its jacket or palette on you', () => {
  const was3 = [G.lookOf, G.figureChoice, G.figureItems, G.figureStyle],
    W = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/wardrobe.json'), 'utf8')),
    look = {
      body: {},
      skin: '#E6B08A',
      hair: '#2B6CB0',
      wear: { hair: 'hair_short', top: 'tee' },
      colors: { tee: ['#C8323C'] },
    };
  try {
    freshBaker();
    G.lookOf = () => look;
    G.figureItems = () => W.items;
    G.figureChoice = () => 'look';
    G.figureStyle = () => 'gnight';
    const built = who => {
      const name = G.figureFor(who);
      G.gpuState.fr++;
      assert.ok(G.figurePersonPicture({}, name, 0, 'idle', 0, Math.PI), who);
      return G.FIGURE_DEFS[name].F;
    };
    const me = built('me'),
      other = built('marina');
    /* the direction's cast puts a denim jacket on Marina and once did on you: no longer */
    assert.ok(
      other.parts.some(p => p.col === 'outer'),
      'Marina wears her direction’s jacket'
    );
    assert.ok(!me.parts.some(p => p.col === 'outer'), 'you wear no outer: none was picked');
    /* its extras stay (goggles, gloves) */
    assert.ok(me.parts.length > 0 && me.exact && !other.exact);
    /* your colours as picked: the direction's palette and saturation leave them be, everyone else's are pulled */
    const LK = G.FIGURE_LOOKS.gnight,
      base = (F, k) => {
        const P = G.figurePalette(F, [k], LK.ramp, LK),
          M = G.figurePalette({ ...F, exact: true }, [k], LK.ramp, LK);
        return [Array.from(P.slice(6, 9)), Array.from(M.slice(6, 9))];
      };
    const [mine, mineRaw] = base(me, 'top');
    assert.deepEqual(mine, mineRaw);
    assert.deepEqual(mine.map(Math.round), [200, 50, 60], 'the tee’s red as picked');
    const [theirs, theirsRaw] = base(other, 'top');
    assert.notDeepEqual(theirs, theirsRaw, 'the rest of the cast keep the direction’s palette');
  } finally {
    G.document.createElement = was;
    [G.lookOf, G.figureChoice, G.figureItems, G.figureStyle] = was3;
    for (const k of Object.keys(G.FIGURE_DEFS)) if (k.startsWith('look:')) delete G.FIGURE_DEFS[k];
  }
});

test('CH-4: the snapshot service: a UI picture baked once in the studio light, then kept', () => {
  const look = G.engineContext.look;
  try {
    freshBaker();
    G.engineContext.look = { people: { figure: 'mannequin', style: 'pixel' } };
    const a = G.figureSnapshot('me', { crop: 'whole', turn: 1 });
    assert.ok(a && a.figure === 'mannequin', 'your figure (here the mannequin) as a canvas');
    assert.equal(a.ppm, G.FIGURE_PORTRAIT_PPM);
    assert.equal(G.figureReport().bakes, 1);
    assert.equal(G.figureSnapshot('me', { crop: 'whole', turn: 1 }), a, 'kept');
    assert.equal(G.figureReport().bakes, 1);
    assert.notEqual(G.figureSnapshot('me', { crop: 'whole', turn: 0 }), a, 'another turn, another picture');
    assert.equal(G.figureReport().bakes, 2);
  } finally {
    G.engineContext.look = look;
    G.document.createElement = was;
  }
});

/* ---------- DL-6: the talk's close-ups ---------- */
test('figures: a close-up: the rest pose first, kept by stepped head angle, the nearest shown until baked', () => {
  try {
    const D = freshBaker(),
      B = G.figureBaker,
      next = () => (B.bustAt = -1e9);
    const rest = G.figureBustPicture('mannequin', { yaw: 10, pitch: 0, roll: 0 });
    assert.ok(rest, 'a picture at once');
    assert.deepEqual(rest.head, { yaw: 0, pitch: 0, roll: 0 }, 'the rest pose before the angle asked for');
    assert.deepEqual([rest.width, rest.height], [G.BUST_PX, G.BUST_PX]);
    assert.equal(rest.x.fills.length, 0, 'no face on the kept picture');
    assert.ok(rest.face && rest.face.F && rest.face.J, 'what the face needs, kept on it');
    /* within the gap: no bake, the nearest kept */
    assert.equal(G.figureBustPicture('mannequin', { yaw: 10, pitch: 0, roll: 0 }), rest);
    assert.equal(G.figureReport().bustBakes, 1);
    next();
    const turned = G.figureBustPicture('mannequin', { yaw: 10, pitch: 0, roll: 0 });
    assert.notEqual(turned, rest);
    assert.deepEqual(turned.head, { yaw: 12, pitch: 0, roll: 0 });
    next();
    assert.equal(G.figureBustPicture('mannequin', { yaw: 11.9, pitch: 1, roll: -2 }), turned, 'the same step');
    /* the head's matrix differs between the two, the body's not */
    /* each bake sends them twice (CH-3b: the shadow pass, then the picture); a code figure's moving parts only (its
       mesh's slots) */
    const uJ = D.made.gl.calls.filter(c => c[0] === 'uniformMatrix4fv' && c[1] === 'uJ').map(c => c[3]),
      F = G.mannequinFigure(),
      slots = [...B.res.values()][0].slots,
      at = id => {
        const i = F.parts.findIndex(p => p.id === id);
        return (slots ? slots.indexOf(i) : i) * 16;
      };
    assert.equal(uJ.length, 4);
    assert.ok(at('head') >= 0 && at('torso') >= 0);
    uJ.splice(0, 1);
    uJ.splice(1, 1);
    assert.deepEqual(uJ[0].slice(at('torso'), at('torso') + 16), uJ[1].slice(at('torso'), at('torso') + 16));
    assert.notDeepEqual(uJ[0].slice(at('head'), at('head') + 16), uJ[1].slice(at('head'), at('head') + 16));
    /* seen level: the clip matrix of a tilt of 0 */
    const R = G.figureReport();
    assert.deepEqual([R.busts, R.bustBakes], [2, 2]);
    assert.ok(R.bustMs >= 0 && R.bakes === 2, 'counted with the bakes too');
    G.figureCacheClear();
    assert.equal(G.figureReport().busts, 0);
  } finally {
    G.document.createElement = was;
  }
});

test('CH-5: the Studio’s figure preview: built once per edit with its own kit data, turned, the old one let go', () => {
  try {
    const D = freshBaker(),
      W = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/wardrobe.json'), 'utf8')),
      kit = structuredClone(G.GAMEDATA.figureKit),
      look = { body: {}, skin: '#E6B08A', wear: { hair: 'hair_bun', top: 'tee', hat: 'hat_cap' } },
      o = { look, items: W.items, kit, who: 'clerk', figure: { head: 'square', build: 'round' }, rev: 1 };
    const a = G.figurePreview({ ...o, turn: 1 });
    assert.ok(a && a.ppm === 64 && a.figure === 'preview:clerk:1@pixel');
    assert.deepEqual(a.kit, { head: 'square', build: 'round', bust: a.kit.bust }, 'the head and build asked for');
    assert.ok(a.ms >= 0);
    const built = G.figurePreviewState.def;
    /* another turn, a close-up: the same figure, baked again */
    const b = G.figurePreview({ ...o, turn: 0.25, ppm: 120 });
    assert.ok(b && b !== a);
    assert.equal(G.figurePreviewState.def, built, 'not built again for a turn');
    assert.equal(G.figureBaker.res.size, 1, 'one mesh at one detail');
    /* an edit (the Studio counts it): built again with the edited kit, the old mesh let go */
    kit.accessories.hat_cap.rows = kit.accessories.hat_cap.rows.slice(0, 1);
    const c = G.figurePreview({ ...o, rev: 2 });
    assert.ok(c && c.figure === 'preview:clerk:2@pixel');
    assert.notEqual(G.figurePreviewState.def, built);
    assert.ok(!G.figurePreviewState.def.F.parts.some(p => p.id === 'peak'), 'the edited cap has no peak');
    assert.ok(built.F.parts.some(p => p.id === 'peak'));
    assert.deepEqual(
      [...G.figureBaker.res.keys()].map(k => k.split('|')[0]),
      ['preview:clerk:2@pixel']
    );
    assert.ok(
      D.made.gl.calls.some(x => x[0] === 'deleteBuffer'),
      'the old mesh’s buffer freed'
    );
    G.figurePreviewForget();
    assert.equal(G.figureBaker.res.size, 0);
  } finally {
    G.document.createElement = was;
  }
});

test('figures: a close-up’s face is painted on a copy, with the talk’s eyes and mouth', () => {
  try {
    const D = freshBaker(),
      im = G.figureBustPicture('mannequin', null),
      out = D.createElement('canvas');
    G.figureBustFace(out, im, { eyes: 'open', mouth: 'shut' });
    assert.deepEqual([out.width, out.height], [im.width, im.height]);
    const open = out.x.fills.length;
    assert.equal(open, 7, 'two eyes, two glints, a mouth, two blushes');
    out.x.fills.length = 0;
    G.figureBustFace(out, im, { eyes: 'shut', mouth: 'open' });
    assert.equal(out.x.fills.length, 5, 'no glints with the eyes shut');
    assert.equal(im.x.fills.length, 0, 'the kept picture untouched');
    assert.equal(G.figureReport().bustBakes, 1, 'a face costs no bake');
  } finally {
    G.document.createElement = was;
  }
});

test('figures: CH-6 the one talking moves their mouth with their line’s expression; nobody else does', async () => {
  const { figureFaceFor } = await import('../../game/js/figures.js');
  const H = await import('../../game/js/hooks.js'),
    real = H.talkBox,
    /* the dialogue box's state (talk.js talkBox), a stand-in */
    talkBox = { on: false, cur: null, por: null },
    at = G.walkRenderer.talkAt;
  H.provide({ talkBox });
  try {
    talkBox.on = true;
    talkBox.cur = { who: 'broker', text: 'Hello there, friend', n: 3, typing: true };
    talkBox.por = { who: 'broker', expr: 'happy', t: 0 };
    G.walkRenderer.talkAt = { x: 5, z: 5, t: 0 };
    const f = figureFaceFor('broker', 5.2, 5);
    assert.equal(f.expr, 'happy');
    assert.ok(Number.isInteger(f.talk));
    /* someone else with the same look further off, another person, you: no */
    assert.equal(figureFaceFor('broker', 9, 9), null);
    assert.equal(figureFaceFor('concierge', 5, 5), null);
    assert.equal(figureFaceFor('boy', 5, 5, true), null);
    /* an actor (no place) by who they are; your own line by 'me' */
    assert.equal(figureFaceFor('broker').expr, 'happy');
    talkBox.cur = { who: 'me', text: 'Hi.', n: 3, typing: true };
    talkBox.por = { who: 'me', expr: null, t: 0 };
    const me = figureFaceFor('boy', 0, 0, true);
    assert.ok(me && me.talk === undefined, 'a full stop rests the mouth');
    /* the line typed out: the expression stays, the mouth rests; the box shut: nothing */
    talkBox.cur = { who: 'broker', text: 'Hello', n: 5, typing: false };
    talkBox.por = { who: 'broker', expr: 'sad', t: 0 };
    assert.deepEqual(figureFaceFor('broker', 5, 5), { expr: 'sad' });
    talkBox.on = false;
    assert.equal(figureFaceFor('broker', 5, 5), null);
  } finally {
    H.provide({ talkBox: real });
    G.walkRenderer.talkAt = at;
  }
});

test('figures: CH-6 a face mark is left out where something nearer covers it (a brim over the eyes)', async () => {
  const figureMarkClip = G.figureMarkClip;
  const { FIGURE_MARK_HIDE, figureMarkHidden } = await import('../../game/js/logic/figure-pose.js');
  const S = { w: 4, h: 3 },
    depth = new Uint8Array(S.w * S.h * 4),
    /* the picture's depth alpha at (x, y from the top), rows from the bottom as read back */
    put = (x, y, a) => (depth[((S.h - 1 - y) * S.w + x) * 4 + 3] = Math.round(a * 255)),
    d = 0.5;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) put(x, y, d);
  put(1, 0, d + FIGURE_MARK_HIDE + 0.02);
  const calls = [],
    x = { fillRect: (...a) => calls.push(a) };
  /* nothing in front of the bottom row: one rect */
  figureMarkClip(x, depth, S, d).fillRect(0, 2, 4, 1);
  assert.deepEqual(calls, [[0, 2, 4, 1]]);
  calls.length = 0;
  /* the brim at (1, 0): the top row painted round it */
  figureMarkClip(x, depth, S, d).fillRect(0, 0, 3, 1);
  assert.deepEqual(calls, [
    [0, 0, 1, 1],
    [2, 0, 1, 1],
  ]);
  /* the face itself (a little nearer than the smooth surface the mark sits on) doesn't hide it */
  assert.equal(figureMarkHidden(d + FIGURE_MARK_HIDE * 0.5, d), false);
  assert.equal(figureMarkHidden(0.9, undefined), false);
});
test('figures: every head angle of a figure kept in each style (45 each)', () => {
  try {
    freshBaker();
    const B = G.figureBaker;
    for (const n of ['mannequin'])
      for (const st of ['pixel', 'smooth']) {
        /* the rest pose first (it would be baked before any other angle) */
        B.bustAt = -1e9;
        G.figureBustPicture(n, null, st);
        for (let y = -12; y <= 12; y += 6)
          for (let p = -8; p <= 8; p += 8)
            for (let r = -8; r <= 8; r += 8) {
              B.bustAt = -1e9;
              G.figureBustPicture(n, { yaw: y, pitch: p, roll: r }, st);
            }
      }
    assert.equal(G.figureReport().busts, 90);
    assert.ok(90 <= G.FIGURE_BUST_MAX);
  } finally {
    G.document.createElement = was;
  }
});

/* ---------- CH-7: your look as a figure (game/js/figure-looks.js) ---------- */
await import('../../game/js/figure-looks.js');

test('CH-7: a look’s shape names its mesh; colours and the face are painted on it, and every mesh agrees', async () => {
  const { kitBuild, lookFigure } = await import('../../game/js/logic/figure-kit.js'),
    W = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/wardrobe.json'), 'utf8')),
    look = {
      body: {},
      build: 'average',
      skin: '#E6B08A',
      hair: '#5A3A2A',
      eyes: '#3F8A63',
      wear: { hair: 'hair_short', top: 'tee', bottom: 'jeans', shoes: 'sneakers', eyes: 'eyes_round' },
      colors: {},
    },
    painted = {
      ...look,
      skin: '#7A4A34',
      hair: '#C8323C',
      eyes: '#112233',
      colors: { tee: ['#123456'] },
      wear: { ...look.wear, eyes: 'eyes_sleepy', brows: 'brows_thick', mouth: 'mouth_grin', glasses: 'glasses_round' },
    };
  assert.equal(G.figureLookShape(painted), G.figureLookShape(look), 'colours, skin and the face: the same shape');
  assert.notEqual(G.figureLookShape({ ...look, build: 'round' }), G.figureLookShape(look));
  assert.notEqual(G.figureLookShape({ ...look, wear: { ...look.wear, hat: 'hat_cap' } }), G.figureLookShape(look));
  assert.notEqual(
    G.figureLookShape({ ...look, wear: { ...look.wear, facial: 'facial_beard' } }),
    G.figureLookShape(look)
  );
  /* the claim the shape key rests on: the kit's mesh is the same for both (its vertices and colour slots) */
  const mesh = L => kitBuild(lookFigure(L, W.items, { name: 'me', figure: { head: 'hero' } }), 0.6);
  const a = mesh(look),
    b = mesh(painted);
  assert.deepEqual(b.colours, a.colours);
  assert.ok(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer)), 'the same vertices');
});

test('CH-7: a look as a picture: whole and cropped, a new colour paints without a build, forgotten on close', () => {
  const was3 = [G.figureItems, G.figureStyle],
    W = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/wardrobe.json'), 'utf8')),
    look = {
      body: {},
      build: 'average',
      skin: '#E6B08A',
      hair: '#5A3A2A',
      eyes: '#3F8A63',
      wear: { hair: 'hair_short', top: 'tee', bottom: 'jeans', shoes: 'sneakers' },
      colors: {},
    };
  try {
    freshBaker();
    G.figureLooksForget();
    G.figureItems = () => W.items;
    G.figureStyle = () => 'pixel';
    const L = G.figureLooks,
      im = G.figureLookPicture(look, { ppm: 64 });
    assert.ok(im && im.ppm === 64 && im.figure.startsWith('dress:'), 'your look, baked (built on the page in Node)');
    assert.equal(L.builds, 1);
    /* a colour: painted on the same mesh, no second build; another top: a new figure */
    assert.ok(G.figureLookPicture({ ...look, colors: { tee: ['#123456'] } }, { ppm: 64 }));
    assert.equal(L.builds, 1, 'a colour costs no build');
    assert.ok(G.figureLookPicture({ ...look, wear: { ...look.wear, top: 'tank' } }, { ppm: 64 }));
    assert.equal(L.builds, 2);
    /* crops: each a canvas the size of its box at the density, cut round the ground point */
    const F = L.defs.values().next().value.F,
      ext = L.defs.values().next().value.ext;
    for (const crop of ['head', 'face', 'body', 'legs', 'feet', 'bust']) {
      const C = G.figureLookCrop(F, ext, crop);
      assert.ok(C.x1 > C.x0 && C.y1 > C.y0 && C.y0 >= -0.05 && C.y1 <= ext.top + 0.05, crop);
      const c = G.figureLookPicture(look, { ppm: 64, crop });
      assert.equal(c.width, Math.max(4, Math.round((C.x1 - C.x0) * 64)), crop);
    }
    const head = G.figureLookCrop(F, ext, 'head'),
      legs = G.figureLookCrop(F, ext, 'legs');
    assert.ok(head.y0 > legs.y1, 'the head above the legs');
    /* tiles: their own (lower) detail, kept, at most one baked every FIGURE_LOOK_GAP ms */
    L.tileAt = -Infinity;
    const t = G.figureLookPicture(look, { tile: true, crop: 'head' });
    assert.ok(t && t.figure.endsWith(':t'));
    assert.ok(G.figureLookKept(look, { crop: 'head' }));
    assert.equal(G.figureLookPicture(look, { tile: true, crop: 'head' }), t, 'kept');
    assert.equal(G.figureLookPicture(look, { tile: true, crop: 'body' }), null, 'the next tile waits its turn');
    /* the report and the forgetting: no figure, mesh or buffer of the room's left */
    const R = G.figureLooksReport();
    assert.equal(R.builds, 3);
    assert.ok(R.pictures === 1 && R.kept === 3 && R.bakes >= 9);
    G.figureLooksForget();
    assert.equal(G.figureLooksReport().kept, 0);
    assert.ok(![...G.figureBaker.res.keys()].some(k => k.startsWith('dress:')));
    assert.ok(![...G.figureMeshes.done.keys()].some(k => k.startsWith('dress:')));
  } finally {
    G.document.createElement = was;
    [G.figureItems, G.figureStyle] = was3;
  }
});

test('CH-7: tiles are built one at a time; the look you wear goes first; at most FIGURE_LOOK_KEEP kept', () => {
  const was3 = [G.figureItems, G.figureStyle, G.figureMeshGet, G.figureMeshBuilding],
    W = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/wardrobe.json'), 'utf8')),
    look = { body: {}, build: 'average', wear: { hair: 'hair_short', top: 'tee' }, colors: {} },
    tops = ['tee', 'tank', 'hoodie', 'sweater'];
  try {
    freshBaker();
    G.figureLooksForget();
    G.figureItems = () => W.items;
    G.figureStyle = () => 'pixel';
    /* a helper thread that hasn't finished anything yet */
    const asked = [];
    G.figureMeshGet = key => (asked.push(key), null);
    G.figureMeshBuilding = key => asked.includes(key);
    for (const top of tops) G.figureLookPicture({ ...look, wear: { ...look.wear, top } }, { tile: true });
    assert.equal(asked.length, 1, 'one tile’s build at a time');
    G.figureLookPicture({ ...look, wear: { ...look.wear, top: 'tank' } }, {});
    assert.equal(asked.length, 2, 'the look you wear doesn’t wait for the tiles');
    [, , G.figureMeshGet, G.figureMeshBuilding] = was3;
    /* builds done (on the page here): every tile in, the longest unused let go past the keep */
    G.figureLooks.tileAt = -Infinity;
    const many = Object.keys(W.items).filter(id => W.items[id].slot === 'top' || W.items[id].slot === 'bottom');
    for (const id of many) {
      G.figureLooks.tileAt = -Infinity;
      const L2 = { ...look, wear: { ...look.wear, [W.items[id].slot]: id } };
      assert.ok(G.figureLookPicture(L2, { tile: true, crop: 'body' }), id);
    }
    assert.ok(many.length > G.FIGURE_LOOK_KEEP);
    assert.equal(G.figureLooksReport().kept, G.FIGURE_LOOK_KEEP);
    assert.ok([...G.figureBaker.res.keys()].filter(k => k.startsWith('dress:')).length <= G.FIGURE_LOOK_KEEP);
  } finally {
    G.document.createElement = was;
    [G.figureItems, G.figureStyle, G.figureMeshGet, G.figureMeshBuilding] = was3;
    G.figureLooksForget();
  }
});
