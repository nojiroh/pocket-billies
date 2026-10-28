// @ts-check
'use strict';
/* ================= SOUNDSCAPE (sound track SND-10) =================
   Where the world's water sounds come from and what they do, as numbers (sound.js and audio/soundscape-player.js play
   them; the recipes are data, game/data/soundscape.json `water`):
   - water cells: from the renderer's water grid (each half metre's kind, as drawn: a river through the sea is a river)
     or, with none, from the scene's tiles and kinds; each one metre cell's kind, whether it runs, whether it is a shore;
   - emitters: still water laps at its shores; running water sounds along its cells, a brook, a river or rapids by the
     river line's width and rapids; a river's spring; placed falls by their height, with their plunge pool; the
     automatic cascades; fountains. Each emitter plays its kind's recipe (soundscape.json `kinds`);
   - buckets per recipe (logic/ambience-sound.js ambienceBuckets), so the nearest few are found by looking only near
     you, never by a scan of every water cell;
   - how loud and how bright a voice is at a distance: a point falls 6 dB a doubling, a line or a shore less; air
     takes the highs away, so far water is a soft low rumble and near water bright;
   - events: bubbles from a baked bank (radius, rise, level and pan at random, a minimum gap), laps at a bank, the
     surf's waves on the tide. Seeded: never Math.random.
   Logic only: plays nothing; runs in Node (tools/test/soundscape.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ambienceBuckets } from './ambience-sound.js';
/* eslint-disable no-func-assign */
expose({
  SOUNDSCAPE_APART: [() => SOUNDSCAPE_APART],
  // @ts-expect-error -- replaced on purpose
  soundscapeAir: [() => soundscapeAir, v => (soundscapeAir = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeBubbles: [() => soundscapeBubbles, v => (soundscapeBubbles = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeCells: [() => soundscapeCells, v => (soundscapeCells = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeCellsFromTiles: [() => soundscapeCellsFromTiles, v => (soundscapeCellsFromTiles = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeEmitters: [() => soundscapeEmitters, v => (soundscapeEmitters = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeFallRecipe: [() => soundscapeFallRecipe, v => (soundscapeFallRecipe = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeFindings: [() => soundscapeFindings, v => (soundscapeFindings = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeHeight: [() => soundscapeHeight, v => (soundscapeHeight = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeLaps: [() => soundscapeLaps, v => (soundscapeLaps = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeLevel: [() => soundscapeLevel, v => (soundscapeLevel = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeMidi: [() => soundscapeMidi, v => (soundscapeMidi = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeNearest: [() => soundscapeNearest, v => (soundscapeNearest = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapePreview: [() => soundscapePreview, v => (soundscapePreview = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeTide: [() => soundscapeTide, v => (soundscapeTide = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeVoices: [() => soundscapeVoices, v => (soundscapeVoices = v)],
  // @ts-expect-error -- replaced on purpose
  soundscapeWaves: [() => soundscapeWaves, v => (soundscapeWaves = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {[number, number, string, number, number]} SoundscapeCell a metre of water: [x, z, kind, shore 0/1, runs 0/1]
 * @typedef {[number, number, number]} SoundscapeEmitter where a recipe sounds: [x, z, height (m, falls; else 0)]
 * @typedef {{recipe: string, at?: 'shore' | 'all'}} SoundscapeKind a water kind's recipe, and which of its cells
 *   sound: its shores (still water laps at the bank) or all of them (thinned to half, a checkerboard)
 * @typedef {{type: 'bubbles', bank: string, rate: number, rMin: number, rMax: number, gamma?: number,
 *   xi?: number, beta?: number, level: number, gap?: number, pan?: number}} SoundscapeBubbleSpec
 *   bubbles at random (a Poisson rate a second, never closer than gap s): radii in mm between rMin and rMax, more of
 *   the small ones (r^-gamma), each played from the bank (a drop's or a bubble's rise) at its pitch (3 / r Hz), its
 *   level (r / rMax)^1.5 times a random^beta (most quiet, a few loud), panned within +-pan
 * @typedef {{type: 'laps', every: number[], gain: number, f?: number, plip?: number, bank?: string}} SoundscapeLapSpec
 *   laps at a bank: a soft low wash every every[0]-every[1] s, now and then (plip, a chance) a small bubble after it
 * @typedef {{type: 'waves', every: number[], rise: number[], fall: number[], peak: number[], fizz?: number,
 *   bank?: string}} SoundscapeWaveSpec
 *   the surf (after PortAudio's ocean shore): each wave rises over rise s while a low-pass opens, falls about fall
 *   times as long while a high-pass closes, peaks at random within peak, a new one every every s, overlapping; the
 *   tide makes them bigger and more often; foam fizzes as each draws back
 * @typedef {SoundscapeBubbleSpec | SoundscapeLapSpec | SoundscapeWaveSpec} SoundscapeEvent
 * @typedef {{range: number, line?: boolean, voices?: number, trim: number, send?: number,
 *   layers: import('./ambience-sound.js').AmbienceLayer[], texture?: {bank: string, rate: number, gain: number},
 *   events?: SoundscapeEvent[], byHeight?: boolean}} SoundscapeRecipe
 *   a water sound: heard within range m (a line or a shore falls off slower), the nearest `voices` of it play; its
 *   trim (from the loudness report), reverb send, bed layers, a baked texture and events
 * @typedef {{about?: string, kinds: Record<string, SoundscapeKind>, running: {brook: string, river: string,
 *   rapids: string, spring: string, riverWidth: number, near: number}, falls: {small: string, tall: string,
 *   tallFrom: number, pool: string, sheet: string}, fountain: string, wake?: string, rainOnWater?: string,
 *   banks?: Record<string, any>, water: Record<string, SoundscapeRecipe>}} SoundscapeWater
 *   game/data/soundscape.json's water half (its `beds` are logic/ambience-sound.js's)
 */

/**
 * what is wrong with soundscape.json's water (tools/check-data.mjs): a water kind with no recipe, a recipe or bank
 * named that doesn't exist, a drift on a filter a layer hasn't got
 * @param {SoundscapeWater} S
 * @param {string[]} kinds every water kind (logic/water-kinds.js WATER_KINDS)
 * @returns {string[]}
 */
export function soundscapeFindings(S, kinds) {
  const out = [],
    W = S.water || {},
    banks = S.banks || {},
    rec = (/** @type {string} */ id, /** @type {string} */ where) => {
      if (!W[id]) out.push(`${where}: no water recipe "${id}"`);
    };
  for (const k of kinds) if (!S.kinds[k]) out.push(`kinds: the water kind "${k}" has no recipe`);
  for (const [k, K] of Object.entries(S.kinds)) {
    if (!kinds.includes(k)) out.push(`kinds.${k}: no such water kind`);
    rec(K.recipe, `kinds.${k}`);
  }
  for (const k of ['brook', 'river', 'rapids', 'spring']) rec(/** @type {any} */ (S.running)[k], `running.${k}`);
  for (const k of ['small', 'tall', 'pool', 'sheet']) rec(/** @type {any} */ (S.falls)[k], `falls.${k}`);
  for (const k of ['fountain', 'wake', 'rainOnWater']) {
    const v = /** @type {any} */ (S)[k];
    if (v != null) rec(v, k);
  }
  for (const [id, R] of Object.entries(W)) {
    if (R.texture && (!banks[R.texture.bank] || banks[R.texture.bank].kind !== 'babble'))
      out.push(`water.${id}: its texture's bank "${R.texture.bank}" is no babble bank`);
    for (const E of R.events || [])
      if ('bank' in E && E.bank && (!banks[E.bank] || banks[E.bank].kind !== 'bubble'))
        out.push(`water.${id}: its ${E.type}' bank "${E.bank}" is no bubble bank`);
    R.layers.forEach((L, i) => {
      for (const D of L.drift || [])
        if (D.on !== 'gain' && !(D.on >= 0 && D.on < L.filters.length))
          out.push(`water.${id}: layer ${i} drifts filter ${D.on}, which it hasn't got`);
    });
    if (!R.layers.length && !R.texture && !(R.events || []).length) out.push(`water.${id}: makes no sound`);
  }
  return out;
}

/** metres apart two voices of one recipe must be (so a second voice is another place, not the same river) */
export const SOUNDSCAPE_APART = 8;

/**
 * a metre of each piece of water from the renderer's water grid (half-metre cells: walk/ground-mesh.js `wgrid`), each
 * 1 m cell's kind by the half-metre cell just past its centre, whether it runs (the flow map's channel, else a running kind) and whether
 * it is a shore (a cell beside it dry)
 * @param {{W2: number, H2: number, dep: ArrayLike<number>, kind: ArrayLike<number>}} G
 * @param {string[]} names the kinds by index (walk/water-data.js WATER_KIND_LOOKS' keys)
 * @param {ArrayLike<number> | null} [cls] the flow map's class per half-metre cell (1 running, 2 its estuary)
 * @param {(k: string) => boolean} [runs] does a kind run (stream, rapids, canal) when there is no flow map
 * @returns {SoundscapeCell[]}
 */
export function soundscapeCells(G, names, cls, runs) {
  const out = [],
    { W2, H2, dep, kind } = G,
    wet = (/** @type {number} */ i, /** @type {number} */ j) =>
      i >= 0 && j >= 0 && i < W2 && j < H2 && dep[j * W2 + i] > 0;
  for (let j = 1; j < H2; j += 2)
    for (let i = 1; i < W2; i += 2) {
      if (!wet(i, j)) continue;
      const q = j * W2 + i,
        k = names[kind[q]] || 'pond',
        run = cls ? cls[q] === 1 || cls[q] === 2 : runs ? runs(k) : false,
        shore = !wet(i - 2, j) || !wet(i + 2, j) || !wet(i, j - 2) || !wet(i, j + 2);
      out.push(/** @type {SoundscapeCell} */ ([i * 0.5, j * 0.5, k, shore ? 1 : 0, run ? 1 : 0]));
    }
  return out;
}

/**
 * the same from a scene's tiles alone (no renderer: tools, or before the ground is built): `w` and `d` are water, the
 * kind from kindAt (logic/wading.js wadeKindAt), a running kind runs
 * @param {{w: number, h: number, tiles?: string[]}} sc
 * @param {(x: number, z: number) => string} kindAt
 * @param {(k: string) => boolean} runs
 * @returns {SoundscapeCell[]}
 */
export function soundscapeCellsFromTiles(sc, kindAt, runs) {
  const rows = sc.tiles || [],
    W = sc.w,
    H = sc.h,
    wet = (/** @type {number} */ i, /** @type {number} */ j) => {
      const c = (rows[H - 1 - j] || '')[i];
      return c === 'w' || c === 'd';
    },
    out = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!wet(i, j)) continue;
      const x = i + 0.5,
        z = j + 0.5,
        k = kindAt(x, z),
        shore = !wet(i - 1, j) || !wet(i + 1, j) || !wet(i, j - 1) || !wet(i, j + 1);
      out.push(/** @type {SoundscapeCell} */ ([x, z, k, shore ? 1 : 0, runs(k) ? 1 : 0]));
    }
  return out;
}

/**
 * a placed fall's recipe by its height: a small fall under tallFrom metres, else a tall one
 * @param {SoundscapeWater} S
 * @param {number} h
 * @returns {string}
 */
export function soundscapeFallRecipe(S, h) {
  return h >= S.falls.tallFrom ? S.falls.tall : S.falls.small;
}

/**
 * where each recipe sounds in a scene: {recipe: [[x, z, h], ...]}
 * @param {SoundscapeWater} S
 * @param {SoundscapeCell[]} cells
 * @param {{streams?: {pts: number[][], w?: number | number[], src?: string, rapids?: number[][]}[],
 *   falls?: {x: number, z: number, dir?: number[], h?: number, pool?: number}[]}} sc
 * @param {{sheets?: ArrayLike<number>[], fountains?: number[][]}} [o] the automatic cascades ([x, y, z, h, ...],
 *   walk/ground-mesh.js `falls`) and the fountains' places
 * @returns {Record<string, SoundscapeEmitter[]>}
 */
export function soundscapeEmitters(S, cells, sc, o = {}) {
  /** @type {Record<string, SoundscapeEmitter[]>} */
  const E = {};
  const add = (/** @type {string} */ k, /** @type {number} */ x, /** @type {number} */ z, h = 0) =>
    (E[k] || (E[k] = [])).push([x, z, h]);
  /* the river lines, sampled every metre: brook or river by width, rapids where they run */
  const R = S.running,
    line = [];
  for (const L of sc.streams || []) {
    const P = L.pts || [];
    let len = 0;
    const seg = [];
    for (let i = 1; i < P.length; i++) {
      const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      seg.push(d);
      len += d;
    }
    let at = 0;
    for (let i = 1; i < P.length; i++) {
      const n = Math.max(1, Math.ceil(seg[i - 1]));
      for (let s = 0; s < n; s++) {
        const f = s / n,
          t = (at + seg[i - 1] * f) / (len || 1),
          w = Array.isArray(L.w) ? L.w[i - 1] + (L.w[i] - L.w[i - 1]) * f : L.w || 0,
          rap = (L.rapids || []).some(([a, b]) => t >= a && t <= b);
        line.push([
          P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f,
          P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f,
          rap ? R.rapids : w >= R.riverWidth ? R.river : R.brook,
        ]);
      }
      at += seg[i - 1];
    }
    if (L.src === 'spring' && P.length) add(R.spring, P[0][0], P[0][1]);
  }
  const LB = line.length ? ambienceBuckets(line, 4) : null;
  /** @type {(x: number, z: number) => string | null} */
  const lineAt = (x, z) => {
    if (!LB) return null;
    let best = null,
      bd = R.near;
    for (let i = Math.floor((x - R.near) / 4); i <= Math.floor((x + R.near) / 4); i++)
      for (let j = Math.floor((z - R.near) / 4); j <= Math.floor((z + R.near) / 4); j++)
        for (const p of LB.map.get((i + 32768) * 65536 + (j + 32768)) || []) {
          const d = Math.hypot(p[0] - x, p[1] - z);
          if (d <= bd) ((bd = d), (best = /** @type {any} */ (p)[2]));
        }
    return best;
  };
  /* half the metres (a checkerboard, so a one-metre strip keeps half its cells) sound for running water, `all` kinds and
     rain on water (every surface but lava and ice) */
  const rain = S.rainOnWater;
  for (const [x, z, k, shore, run] of cells) {
    const K = S.kinds[k];
    const half = (Math.floor(x) + Math.floor(z)) % 2 === 0;
    if (rain && k !== 'lava' && k !== 'ice' && half) add(rain, x, z);
    if (run) {
      /* running water: the line's own recipe near a line, else the kind's (a canal, rapids painted as a kind) */
      const r = lineAt(x, z) || (K && K.at === 'all' ? K.recipe : R.brook);
      if (half) add(r, x, z);
      continue;
    }
    if (!K) continue;
    if (K.at === 'all') {
      if (half) add(K.recipe, x, z);
    } else if (shore) add(K.recipe, x, z);
  }
  /* placed falls by height (the falling sheet a little past the lip), their plunge pools; the automatic cascades */
  for (const F of sc.falls || []) {
    const d = F.dir || [0, -1],
      h = F.h || 2;
    add(soundscapeFallRecipe(S, h), F.x + d[0] * 0.6, F.z + d[1] * 0.6, h);
    if (F.pool) add(S.falls.pool, F.x + d[0] * (F.pool + 0.25), F.z + d[1] * (F.pool + 0.25), h);
  }
  for (const q of o.sheets || []) add(S.falls.sheet, q[0], q[2], q[3] || 0.5);
  for (const f of o.fountains || []) add(S.fountain, f[0], f[1]);
  return E;
}

/**
 * a fall's loudness and reach by its height: a 3 m fall as its recipe, a 12 m one 1.6 times as loud (4 dB; the loudness
 * report keeps it near the ceiling) and heard 1.8 times as far, a half-metre cascade half as loud
 * @param {number} h
 * @returns {{gain: number, reach: number}}
 */
export function soundscapeHeight(h) {
  const k = Math.sqrt(Math.max(0.1, h) / 3);
  return { gain: Math.min(1.6, Math.max(0.4, k)), reach: Math.min(1.8, Math.max(0.7, k)) };
}

/**
 * how loud water is at d metres within range: a point source falls 6 dB a doubling past 2 m, a line or a shore 3.6 dB,
 * and everything fades to nothing at the range's edge
 * @param {number} d
 * @param {number} range
 * @param {boolean} [line]
 * @returns {number}
 */
export function soundscapeLevel(d, range, line) {
  if (d >= range) return 0;
  const k = line ? 0.6 : 1,
    e = d / range;
  return Math.pow(Math.min(1, 2 / Math.max(2, d)), k) * (1 - e * e);
}

/**
 * the air's low-pass at d metres (Hz): near water bright, far water a soft low rumble
 * @param {number} d
 * @returns {number}
 */
export function soundscapeAir(d) {
  return Math.max(900, 16000 / (1 + Math.max(0, d) / 4));
}

/**
 * the nearest k emitters within range of (x, z), each at least apart metres from the ones before it (so a second
 * voice is somewhere else), nearest first; with line, each one's place is the level-weighted middle of the emitters
 * round it (a river or a shore you walk beside sounds in front of you, not from its one nearest cell)
 * @param {{size: number, map: Map<number, ArrayLike<number>[]>}} B buckets of SoundscapeEmitter
 * @param {number} x
 * @param {number} z
 * @param {number} range
 * @param {number} k
 * @param {boolean} [line]
 * @returns {{x: number, z: number, d: number, h: number}[]}
 */
export function soundscapeNearest(B, x, z, range, k, line) {
  const s = B.size,
    near = [];
  for (let i = Math.floor((x - range) / s); i <= Math.floor((x + range) / s); i++)
    for (let j = Math.floor((z - range) / s); j <= Math.floor((z + range) / s); j++)
      for (const c of B.map.get((i + 32768) * 65536 + (j + 32768)) || []) {
        const d = Math.hypot(c[0] - x, c[1] - z);
        if (d <= range) near.push({ c, d });
      }
  near.sort((a, b) => a.d - b.d);
  const out = [];
  for (const { c, d } of near) {
    if (out.length >= k) break;
    if (out.some(o => Math.hypot(o.cx - c[0], o.cz - c[1]) < SOUNDSCAPE_APART)) continue;
    let px = c[0],
      pz = c[1];
    if (line) {
      /* the level-weighted middle of this emitter's neighbours within 6 m of it */
      let sx = 0,
        sz = 0,
        sw = 0;
      for (const n of near) {
        if (Math.hypot(n.c[0] - c[0], n.c[1] - c[1]) > 6) continue;
        const w = soundscapeLevel(n.d, range, true);
        sx += n.c[0] * w;
        sz += n.c[1] * w;
        sw += w;
      }
      if (sw > 0) ((px = sx / sw), (pz = sz / sw));
    }
    out.push({ x: px, z: pz, d, h: c[2] || 0, cx: c[0], cz: c[1] });
  }
  return out.map(({ x, z, d, h }) => ({ x, z, d, h }));
}

/**
 * the voices to play near (x, z): for each recipe with emitters, its nearest few, each with its level (distance, and
 * a fall's height) and how far it is (for the air); levels under 0.001 left out
 * @param {SoundscapeWater} S
 * @param {Record<string, {size: number, map: Map<number, ArrayLike<number>[]>}>} buckets by recipe
 * @param {number} x
 * @param {number} z
 * @returns {{recipe: string, k: number, x: number, z: number, d: number, level: number}[]}
 */
export function soundscapeVoices(S, buckets, x, z) {
  const out = [];
  for (const [id, B] of Object.entries(buckets)) {
    const R = S.water[id];
    if (!R) continue;
    /* a fall heard further by its height: look as far as the tallest could be heard */
    const far = R.range * (R.byHeight ? 1.8 : 1),
      near = soundscapeNearest(B, x, z, far, R.voices || 1, !!R.line);
    near.forEach((v, k) => {
      const H = R.byHeight ? soundscapeHeight(v.h) : { gain: 1, reach: 1 },
        level = soundscapeLevel(v.d, R.range * H.reach, !!R.line) * H.gain;
      if (level > 0.001) out.push({ recipe: id, k, x: v.x, z: v.z, d: v.d, level });
    });
  }
  return out;
}

/**
 * the voices a list of water recipes at distances would play (the Sound test and the loudness report): [recipe,
 * metres, height (a fall's, m)]; recipes not in the water table left out
 * @param {SoundscapeWater} S
 * @param {Array<[string, number, number?]>} list
 * @returns {{recipe: string, k: number, d: number, level: number, pan: number}[]}
 */
export function soundscapePreview(S, list) {
  const out = [];
  for (const [id, d, h] of list) {
    const R = S.water[id];
    if (!R) continue;
    const H = R.byHeight ? soundscapeHeight(h || 3) : { gain: 1, reach: 1 };
    out.push({ recipe: id, k: 0, d, level: soundscapeLevel(d, R.range * H.reach, !!R.line) * H.gain, pan: 0 });
  }
  return out;
}

/**
 * a bubble's pitch as midi: radius r mm rings at 3 / r Hz (1 mm: 3 kHz)
 * @param {number} rMm
 * @returns {number}
 */
export function soundscapeMidi(rMm) {
  return 69 + 12 * Math.log2(3000 / rMm / 440);
}

/**
 * bubbles due in [t0, t1): from where st left off (st.next), Poisson at E.rate a second times rate, never closer than
 * E.gap; each its bank, pitch (midi), playback rate (+-4 %), gain and pan
 * @param {SoundscapeBubbleSpec} E
 * @param {{next?: number}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @param {number} [rate] the rate's multiplier (rain on water: the rain's strength)
 * @returns {{t: number, bank: string, midi: number, rate: number, gain: number, pan: number}[]}
 */
export function soundscapeBubbles(E, st, t0, t1, r, rate = 1) {
  const out = [],
    lam = E.rate * rate,
    g1 = 1 - (E.gamma ?? 2),
    pois = () => Math.max(E.gap || 0, -Math.log(1 - r()) / lam);
  if (!(lam > 0)) return out;
  if (st.next == null || st.next < t0) st.next = t0 + pois();
  while (st.next < t1) {
    const u = r(),
      rad =
        Math.abs(g1) < 1e-6
          ? E.rMin * Math.pow(E.rMax / E.rMin, u)
          : Math.pow(Math.pow(E.rMin, g1) + u * (Math.pow(E.rMax, g1) - Math.pow(E.rMin, g1)), 1 / g1),
      gain = Math.pow(rad / E.rMax, 1.5) * Math.pow(r(), E.beta ?? 3) * E.level,
      pan = (r() * 2 - 1) * (E.pan ?? 0.35),
      pr = 0.96 + r() * 0.08;
    if (gain > 0.002) out.push({ t: st.next, bank: E.bank, midi: soundscapeMidi(rad), rate: pr, gain, pan });
    st.next += pois();
  }
  return out;
}

/**
 * laps at a bank due in [t0, t1): a soft low wash (attack a, decay d, low-pass f) every every[0]-every[1] s, and now
 * and then (plip) a small bubble just after it
 * @param {SoundscapeLapSpec} E
 * @param {{next?: number}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @returns {{t: number, a: number, d: number, f: number, gain: number, pan: number, plip: {bank: string, midi: number, gain: number} | null}[]}
 */
export function soundscapeLaps(E, st, t0, t1, r) {
  const out = [];
  if (st.next == null || st.next < t0) st.next = t0 + r() * E.every[0];
  while (st.next < t1) {
    const v = 0.5 + r() * 0.5,
      plip = E.bank && r() < (E.plip ?? 0) ? { bank: E.bank, midi: soundscapeMidi(3 + r() * 3), gain: 0.25 * v } : null;
    out.push({
      t: st.next,
      a: 0.08 + r() * 0.07,
      d: 0.35 + r() * 0.35,
      f: (E.f || 380) * (0.85 + r() * 0.3),
      gain: E.gain * v,
      pan: (r() * 2 - 1) * 0.3,
      plip,
    });
    st.next += E.every[0] + r() * (E.every[1] - E.every[0]);
  }
  return out;
}

/**
 * the tide's height now, 0 low to 1 high: two highs a day at 9:00 and 21:00 (walk/sea-tide.js's cycle)
 * @param {number} hour 0-24
 * @returns {number}
 */
export function soundscapeTide(hour) {
  return 0.5 + 0.5 * Math.cos(((hour - 9) / 12) * 2 * Math.PI);
}

/**
 * the surf's waves due in [t0, t1): each rises over A s, falls over D s, peaks at peak; the tide (0-1) and a storm (0-1)
 * make them bigger and closer together
 * @param {SoundscapeWaveSpec} E
 * @param {{next?: number}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @param {number} [tide]
 * @param {number} [storm]
 * @returns {{t: number, A: number, D: number, peak: number, pan: number, fizz: number}[]}
 */
export function soundscapeWaves(E, st, t0, t1, r, tide = 0.5, storm = 0) {
  const out = [],
    big = 0.75 + 0.25 * tide + 0.5 * storm,
    often = 1 / (0.85 + 0.3 * tide + 0.6 * storm);
  if (st.next == null || st.next < t0) st.next = t0 + r() * E.every[0];
  while (st.next < t1) {
    const A = E.rise[0] + r() * (E.rise[1] - E.rise[0]),
      D = A * (E.fall[0] + r() * (E.fall[1] - E.fall[0])),
      peak = Math.min(1.4, (E.peak[0] + r() * (E.peak[1] - E.peak[0])) * big);
    out.push({ t: st.next, A, D, peak, pan: (r() * 2 - 1) * 0.35, fizz: (E.fizz ?? 0) * peak });
    st.next += (E.every[0] + r() * (E.every[1] - E.every[0])) * often;
  }
  return out;
}
