// @ts-check
'use strict';
/* ================= NATURE SOUND (sound track SND-14) =================
   The weather, the wild and the town as numbers (game/data/soundscape.json `nature` holds the recipes;
   game/js/nature-here.js reads the place and audio/nature-player.js plays them):
   - rain by how hard it falls: a wash (a bed) that thickens, a low roar under heavy rain, patter (drops on leaves and
     ground, events), and the rain on roofs near buildings and indoors;
   - thunder from the weather's bolt counter (not the visual flash, so it is heard with reduced motion and the flashes
     off): a bolt's distance sets how long after it the thunder comes, and how low, soft and long it rolls;
   - wind by the place and the gusts that roll across the grass (the renderer's own wind field), the leaves with them;
   - birds by the hour: a dawn chorus (still one bird at a time, the gaps short), quiet at noon, an owl at night;
   - insects by the biome and hour (crickets at night, grasshoppers and cicadas by day) and frogs by still water at
     night, in bouts with pauses;
   - a fire by its size, footsteps by the ground, the town's life as rare quiet events, a room's tone by its kind.
   Seeded: never Math.random. Logic only: plays nothing; runs in Node (tools/test/nature-sound.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  natureBetween: [() => natureBetween, v => (natureBetween = v)],
  // @ts-expect-error -- replaced on purpose
  natureBirdWait: [() => natureBirdWait, v => (natureBirdWait = v)],
  // @ts-expect-error -- replaced on purpose
  natureBirds: [() => natureBirds, v => (natureBirds = v)],
  // @ts-expect-error -- replaced on purpose
  natureBouts: [() => natureBouts, v => (natureBouts = v)],
  // @ts-expect-error -- replaced on purpose
  natureCurve: [() => natureCurve, v => (natureCurve = v)],
  // @ts-expect-error -- replaced on purpose
  natureEvery: [() => natureEvery, v => (natureEvery = v)],
  // @ts-expect-error -- replaced on purpose
  natureFindings: [() => natureFindings, v => (natureFindings = v)],
  // @ts-expect-error -- replaced on purpose
  natureFire: [() => natureFire, v => (natureFire = v)],
  // @ts-expect-error -- replaced on purpose
  natureFrogs: [() => natureFrogs, v => (natureFrogs = v)],
  // @ts-expect-error -- replaced on purpose
  natureGust: [() => natureGust, v => (natureGust = v)],
  // @ts-expect-error -- replaced on purpose
  natureInsects: [() => natureInsects, v => (natureInsects = v)],
  // @ts-expect-error -- replaced on purpose
  naturePatter: [() => naturePatter, v => (naturePatter = v)],
  // @ts-expect-error -- replaced on purpose
  natureRain: [() => natureRain, v => (natureRain = v)],
  // @ts-expect-error -- replaced on purpose
  natureRoof: [() => natureRoof, v => (natureRoof = v)],
  // @ts-expect-error -- replaced on purpose
  natureRoom: [() => natureRoom, v => (natureRoom = v)],
  // @ts-expect-error -- replaced on purpose
  natureStep: [() => natureStep, v => (natureStep = v)],
  // @ts-expect-error -- replaced on purpose
  natureStepSurface: [() => natureStepSurface, v => (natureStepSurface = v)],
  // @ts-expect-error -- replaced on purpose
  natureThunder: [() => natureThunder, v => (natureThunder = v)],
  // @ts-expect-error -- replaced on purpose
  natureTown: [() => natureTown, v => (natureTown = v)],
  // @ts-expect-error -- replaced on purpose
  natureWind: [() => natureWind, v => (natureWind = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * a curve through points [[x, y], ...] (x rising), straight between them and flat past the ends
 * @param {number[][]} pts
 * @param {number} x
 * @returns {number}
 */
export function natureCurve(pts, x) {
  if (!pts || !pts.length) return 0;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  return pts[pts.length - 1][1];
}

/**
 * a number between lo and hi at random
 * @param {number[]} span [lo, hi]
 * @param {() => number} r
 * @returns {number}
 */
export function natureBetween(span, r) {
  return span[0] + (span[1] - span[0]) * r();
}

/**
 * the rain's parts by how hard it falls (the weather's rain: 0 none, 1 rain, 1.6 a storm's): the wash's level, the
 * heavy rain's roar, and the patter's drops a second
 * @param {{wash: number[][], heavy: number[][], patter: {rate: number[][]}}} R soundscape.json nature.rain
 * @param {number} rain
 * @returns {{wash: number, heavy: number, patter: number}}
 */
export function natureRain(R, rain) {
  const k = Math.max(0, rain || 0);
  return { wash: natureCurve(R.wash, k), heavy: natureCurve(R.heavy, k), patter: natureCurve(R.patter.rate, k) };
}

/**
 * the rain on roofs: indoors the roof over you (indoor), outdoors the nearest roof (d metres from its eaves; full
 * under them, nothing past range), by how hard it rains
 * @param {{near: number, range: number, level: number, indoor: number}} R soundscape.json nature.rain.roof
 * @param {number | null} d metres to the nearest eaves (null: none near)
 * @param {boolean} indoor
 * @param {number} rain
 * @returns {number}
 */
export function natureRoof(R, d, indoor, rain) {
  const k = Math.min(1.6, Math.max(0, rain || 0));
  if (k < 0.05) return 0;
  const m = Math.sqrt(k / 1.6);
  if (indoor) return R.indoor * m;
  if (d == null || d > R.range) return 0;
  const near = d <= R.near ? 1 : Math.pow(1 - (d - R.near) / (R.range - R.near), 1.6);
  return R.level * near * m;
}

/**
 * patter: drops on leaves and ground near you, a Poisson rate a second; each a few milliseconds of band-passed noise at
 * a random pitch (higher on leaves), mostly quiet, anywhere left to right; now and then a plink from the drop bank
 * @param {{f: number[], q: number[], d: number[], gain: number, leaves: number, plink: number}} P nature.rain.patter
 * @param {{next?: number}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @param {number} rate drops a second
 * @param {number} [leafy] 0-1: how many trees are round you (more drops land on leaves: higher and softer)
 * @returns {Array<{t: number, f: number, q: number, d: number, gain: number, pan: number, plink: boolean}>}
 */
export function naturePatter(P, st, t0, t1, r, rate, leafy = 0) {
  const out = [];
  if (!(rate > 0)) {
    st.next = undefined;
    return out;
  }
  if (st.next == null || st.next < t0) st.next = t0 + (-Math.log(1 - r()) / rate) * r();
  while (st.next < t1) {
    const leaf = r() < leafy * P.leaves;
    out.push({
      t: st.next,
      f: natureBetween(P.f, r) * (leaf ? 1.4 : 1),
      q: natureBetween(P.q, r),
      d: natureBetween(P.d, r),
      gain: P.gain * (0.12 + 0.88 * Math.pow(r(), 3)) * (leaf ? 0.7 : 1),
      pan: (r() * 2 - 1) * 0.8,
      plink: r() < P.plink,
    });
    st.next += -Math.log(1 - r()) / rate;
  }
  return out;
}

/**
 * thunder after a bolt: its distance (km, more of them far than near), the delay (sound at 343 m/s), and its rolls:
 * a near one opens with a soft-edged crack and rolls brighter and louder; a far one is only a low, long, quiet rumble
 * @param {{km: number[], speed: number, nearKm: number, level: number[], lp: number[], rolls: number[], dur: number[],
 *   crack: number, attack: number[]}} T soundscape.json nature.thunder
 * @param {() => number} r
 * @param {number} [km] a distance given (the Sound test's near and far thunder)
 * @returns {{km: number, delay: number, parts: Array<{at: number, a: number, dur: number, gain: number, lp: number}>}}
 */
export function natureThunder(T, r, km) {
  const d = km ?? T.km[0] + (T.km[1] - T.km[0]) * Math.pow(r(), 0.7),
    /* 0 at the far end, 1 at the near end */
    n = Math.max(0, Math.min(1, (T.km[1] - d) / (T.km[1] - T.km[0]))),
    gain = T.level[0] + (T.level[1] - T.level[0]) * n * n,
    lp = T.lp[0] + (T.lp[1] - T.lp[0]) * n * n,
    dur = T.dur[1] - (T.dur[1] - T.dur[0]) * n,
    rolls = Math.round(natureBetween(T.rolls, r)),
    parts = [];
  if (d <= T.nearKm)
    parts.push({ at: 0, a: T.attack[0], dur: 0.6 + r() * 0.4, gain: gain * T.crack, lp: Math.min(2400, lp * 2.2) });
  let at = d <= T.nearKm ? 0.15 + r() * 0.2 : 0;
  for (let i = 0; i < rolls && at < dur; i++) {
    const last = i === rolls - 1;
    parts.push({
      at,
      a: natureBetween(T.attack, r) * (1 + (1 - n)),
      dur: last ? Math.max(1.2, dur - at) : 0.8 + r() * 1.6,
      gain: gain * (i === 0 ? 1 : 0.45 + r() * 0.5) * (1 - (0.4 * at) / dur),
      lp: lp * (1 - (0.35 * at) / dur),
    });
    at += 0.35 + r() * (dur / rolls);
  }
  return { km: Math.round(d * 100) / 100, delay: d / T.speed, parts };
}

/**
 * the wind's level here: a breeze in the open, more in the mountains, in a storm and in snow; the gusts (the
 * renderer's wind field where you stand, windGustAt: about 0 to 2.3) lift and drop it
 * @param {{breeze: number, alpine: number, storm: number, snow: number, gust: number[]}} W soundscape.json nature.wind
 * @param {{storm: number, snow: number, alpine: boolean, open: number, gust: number}} here open: 0 in a room or a
 *   cave, a scene's wind scale outdoors
 * @returns {number}
 */
export function natureWind(W, here) {
  if (!(here.open > 0)) return 0;
  const base = W.breeze * here.open + (here.alpine ? W.alpine : 0) + W.storm * here.storm + W.snow * here.snow;
  return base * natureGust(W, here.gust);
}

/**
 * how much a gust lifts the wind and the leaves: [floor, lift] (the level is floor + lift * gust, the gust capped at 1.6)
 * @param {{gust: number[]}} W
 * @param {number} g the renderer's gust where you stand
 * @returns {number}
 */
export function natureGust(W, g) {
  return W.gust[0] + W.gust[1] * Math.min(1.6, Math.max(0, g || 0));
}

/**
 * birds by the hour: after a call ends, how long until the next may start (still one bird at a time): the wait of the
 * place (town or country) times the hour's (short at dawn, long at noon)
 * @param {{wait: number[], townWait: number[], hours: number[][]}} B soundscape.json nature.birds
 * @param {() => number} r
 * @param {number} hour 0-24
 * @param {boolean} town
 * @returns {number}
 */
export function natureBirdWait(B, r, hour, town) {
  return natureBetween(town ? B.townWait : B.wait, r) * natureCurve(B.hours, hour);
}

/**
 * which birds may call here now: by night the owl alone (none in a town), at dawn the place's own birds with the
 * chorus's singers among them, else the place's
 * @param {{chorus: number[], chorusAdd: string[], owlNight: number}} B
 * @param {string[]} list the place's birds (sound.js BIRD_CALLS by biome)
 * @param {number} hour
 * @param {number} night 0-1
 * @param {boolean} town
 * @returns {string[]}
 */
export function natureBirds(B, list, hour, night, town) {
  if (night >= B.owlNight) return town || !list.length ? [] : ['owl'];
  if (!list.length) return [];
  if (hour >= B.chorus[0] && hour < B.chorus[1]) return [...list, ...B.chorusAdd];
  return list;
}

/**
 * the insects here: crickets at night (their level by the place, none in winter's cold, fewer in the rain), and by day
 * grasshoppers or cicadas by the biome, season and hour
 * @param {{crickets: {gain: number, town: number, winter: number}, day: Record<string, {biomes: string[],
 *   hours: number[], seasons?: string[]}>}} I soundscape.json nature.insects
 * @param {{biome: string, hour: number, night: number, season: string, rain: number, town: boolean}} here
 * @returns {{crickets: number, day: string | null}}
 */
export function natureInsects(I, here) {
  const dry = 1 - Math.min(1, here.rain || 0),
    C = I.crickets,
    crickets = here.night * dry * (here.town ? C.town : C.gain) * (here.season === 'winter' ? C.winter : 1);
  /** @type {string | null} */
  let day = null;
  if (here.night < 0.3 && dry > 0.5 && here.season !== 'winter')
    for (const [k, D] of Object.entries(I.day))
      if (
        D.biomes.includes(here.biome) &&
        here.hour >= D.hours[0] &&
        here.hour < D.hours[1] &&
        (!D.seasons || D.seasons.includes(here.season))
      ) {
        day = k;
        break;
      }
  return { crickets, day };
}

/**
 * bouts with pauses (frogs croaking, grasshoppers chirring): a bout of count calls, step seconds apart, then a gap;
 * each caller's state goes on where it left off (never before t0)
 * @param {Array<{next?: number, left?: number}>} who each caller's state
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @param {{count: number[], step: number[], gap: number[]}} B
 * @returns {Array<{t: number, who: number, gain: number}>}
 */
export function natureBouts(who, t0, t1, r, B) {
  const out = [];
  who.forEach((k, i) => {
    if (k.next == null || k.next < t0) k.next = t0 + r() * B.gap[1] * 0.5;
    while (k.next < t1) {
      if (!(Number(k.left) > 0)) {
        k.left = Math.round(natureBetween(B.count, r));
        k.next += natureBetween(B.gap, r);
        continue;
      }
      out.push({ t: k.next, who: i, gain: 0.75 + r() * 0.25 });
      k.left = Number(k.left) - 1;
      k.next += natureBetween(B.step, r);
    }
  });
  return out;
}

/**
 * one sound at a time with a lockout (cicadas' swells, a room's small sounds): the next due between every[0] and
 * every[1] seconds after the last
 * @param {{next?: number}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @param {number[]} every
 * @returns {number[]}
 */
export function natureEvery(st, t0, t1, r, every) {
  const out = [];
  if (st.next == null || st.next < t0 - every[1]) st.next = t0 + natureBetween(every, r) * r();
  if (st.next < t0) st.next = t0;
  while (st.next < t1) {
    out.push(st.next);
    st.next += natureBetween(every, r);
  }
  return out;
}

/**
 * frogs by still water at night, warm seasons only, quieter in the rain: their level (0 none)
 * @param {{night: number, seasons: string[], rain: number}} F soundscape.json nature.frogs
 * @param {number} night
 * @param {string} season
 * @param {number} rain
 * @returns {number}
 */
export function natureFrogs(F, night, season, rain) {
  if (night < F.night || !F.seasons.includes(season)) return 0;
  return Math.min(1, (night - F.night) / (1 - F.night) + 0.3) * (1 - Math.min(1, rain || 0) * F.rain);
}

/**
 * a fire by its size: the prop's own (soundscape.json nature.fire.sizes by group) times its scale; a bigger fire is
 * heard further, louder and crackles more often
 * @param {{sizes: Record<string, number>, range: number, gain: number, crackle: number}} F
 * @param {string} group
 * @param {number} [scale]
 * @returns {{size: number, range: number, gain: number, crackle: number}}
 */
export function natureFire(F, group, scale = 1) {
  const size = (F.sizes[group] ?? 1) * (scale || 1);
  return {
    size,
    range: F.range * Math.sqrt(size),
    gain: F.gain * Math.pow(size, 0.6),
    crackle: F.crackle * Math.sqrt(size),
  };
}

/**
 * the surface a footstep lands on, from the ground's terrain code (soundscape.json nature.steps.ground: each surface
 * its codes; 'wet' and 'n' snow are what the footstep loop says already); unknown ground is stone
 * @param {{ground: Record<string, string>, fallback: string}} S
 * @param {string} ter
 * @returns {string}
 */
export function natureStepSurface(S, ter) {
  if (ter === 'wet') return 'wet';
  for (const [k, codes] of Object.entries(S.ground)) if (codes.includes(ter)) return k;
  return S.fallback;
}

/**
 * a footstep's sounds on a surface: its hits (soundscape.json nature.steps.surfaces: [at s, type, Hz, Q, dur s, vol,
 * attack s]), each step a little different (its pitch by up to 10 %, its level by up to 2 dB, its hits' timing by a
 * few ms), the feet a little left and right
 * @param {{surfaces: Record<string, number[][] | Array<Array<number | string>>>}} S
 * @param {string} surface
 * @param {() => number} r
 * @param {number} foot 0 or 1
 * @returns {{pan: number, hits: Array<{at: number, type: string, f: number, q: number, dur: number, vol: number,
 *   a: number}>}}
 */
export function natureStep(S, surface, r, foot) {
  const k = 0.9 + r() * 0.2,
    v = Math.pow(10, ((r() * 2 - 1) * 2) / 20),
    pan = foot ? 0.08 : -0.08,
    H = S.surfaces[surface] || S.surfaces.stone || [];
  return {
    pan,
    hits: H.map(h => ({
      at: Number(h[0]) * (0.85 + r() * 0.3),
      type: String(h[1]),
      f: Number(h[2]) * k,
      q: Number(h[3]),
      dur: Number(h[4]),
      vol: Number(h[5]) * v,
      a: Number(h[6] || 0),
    })),
  };
}

/**
 * the town's life: one quiet event at a time (a door, a cart, a far voice, a dog, a bell), the next a while after
 * the last; by night fewer and only some kinds; panned anywhere, most of them far
 * @param {{every: number[], nightEvery: number, kinds: Record<string, {weight: number, night?: number}>}} T
 *   soundscape.json nature.town
 * @param {{next?: number, last?: string}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @param {number} night 0-1
 * @returns {Array<{t: number, kind: string, pan: number, far: number, v: number}>}
 */
export function natureTown(T, st, t0, t1, r, night) {
  const out = [],
    slow = 1 + (T.nightEvery - 1) * night,
    every = [T.every[0] * slow, T.every[1] * slow];
  for (const t of natureEvery(st, t0, t1, r, every)) {
    const L = Object.entries(T.kinds)
      .map(([k, K]) => [k, K.weight * (1 - night + night * (K.night ?? 1)) * (k === st.last ? 0.3 : 1)])
      .filter(([, w]) => Number(w) > 0);
    let w = r() * L.reduce((a, [, x]) => a + Number(x), 0);
    let kind = String(L.length ? L[L.length - 1][0] : '');
    for (const [k, x] of L)
      if ((w -= Number(x)) <= 0) {
        kind = String(k);
        break;
      }
    if (!kind) continue;
    st.last = kind;
    out.push({ t, kind, pan: (r() * 2 - 1) * 0.85, far: 0.3 + r() * 0.7, v: r() });
  }
  return out;
}

/**
 * a room's tone by its kind, from its map id ('int_inn' is an inn); a kind not listed sounds as the default ('_')
 * @param {Record<string, {bed: string, level: number, events?: string, every?: number[]}>} R nature.rooms
 * @param {string | null | undefined} mapId
 * @returns {{kind: string, bed: string, level: number, events?: string, every?: number[]}}
 */
export function natureRoom(R, mapId) {
  const k = String(mapId || '').replace(/^int_/, '');
  for (const [kind, V] of Object.entries(R))
    if (kind !== '_' && (k === kind || k.startsWith(kind + '_'))) return { kind, ...V };
  return { kind: '_', ...R._ };
}

/**
 * what is wrong with a nature section (check:data): the beds it names exist, the rooms have a default, every surface
 * the ground names has hits, curves rise
 * @param {any} S soundscape.json
 * @returns {string[]}
 */
export function natureFindings(S) {
  const N = S && S.nature,
    out = [];
  if (!N) return out;
  const beds = (S.beds && Object.keys(S.beds)) || [];
  for (const [k, R] of Object.entries(N.rooms || {}))
    if (!beds.includes(/** @type {any} */ (R).bed))
      out.push(`nature.rooms.${k}: no bed "${/** @type {any} */ (R).bed}"`);
  if (N.rooms && !N.rooms._) out.push('nature.rooms: no default room "_"');
  for (const b of N.beds ? Object.values(N.beds) : [])
    if (!beds.includes(/** @type {any} */ (b))) out.push(`nature.beds: no bed "${b}"`);
  if (N.steps) {
    for (const k of Object.keys(N.steps.ground || {}))
      if (!(N.steps.surfaces || {})[k]) out.push(`nature.steps.ground.${k}: no surface of that name`);
    if (!(N.steps.surfaces || {})[N.steps.fallback])
      out.push(`nature.steps.fallback: no surface "${N.steps.fallback}"`);
    const seen = new Map();
    for (const [k, codes] of Object.entries(N.steps.ground || {}))
      for (const c of String(codes)) {
        if (seen.has(c)) out.push(`nature.steps.ground: "${c}" is both ${seen.get(c)} and ${k}`);
        seen.set(c, k);
      }
  }
  const rising = (/** @type {string} */ at, /** @type {any} */ pts) => {
    if (!Array.isArray(pts)) return;
    for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[i - 1][0]) out.push(`${at}: its points must rise`);
  };
  if (N.rain) {
    rising('nature.rain.wash', N.rain.wash);
    rising('nature.rain.heavy', N.rain.heavy);
    rising('nature.rain.patter.rate', N.rain.patter && N.rain.patter.rate);
  }
  if (N.birds) rising('nature.birds.hours', N.birds.hours);
  return out;
}
