'use strict';
/* ================= TIME, WEATHER AND SEASONS (v26) =================
   The walk scenes follow your real clock: mornings are cool and fresh, evenings glow, at night the lamps and windows
   come on under the stars. Each kind of place has its own weather, which changes every few hours (everyone in the same
   kind of place on the same day sees the same sky), and the month sets the season: fresh greens in spring, gold and red
   leaves in autumn, frost in winter.
   Settings → Time of day / Weather / Season can pin any of them. Billionaires notice too: some come out at night,
   others in the rain (rules.env in the game data, editable in the Studio).
   The renderer reads environment through environmentFrame() once a frame; nothing here touches WebGL. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { RM, RULES, S, SP, provide, sceneIdAt } from './hooks.js';
import { clamp } from './util.js';
import { hexA } from './art.js';
import { mapById, walkView } from './walk-view.js';
/* eslint-disable no-func-assign */
expose({
  CLIMATE_WEATHER_ODDS: [() => CLIMATE_WEATHER_ODDS],
  ENVIRONMENT_LIKES: [() => ENVIRONMENT_LIKES],
  PINNED_HOURS: [() => PINNED_HOURS],
  SEASON_BY_MONTH: [() => SEASON_BY_MONTH],
  TIME_OF_DAY_CHOICES: [() => TIME_OF_DAY_CHOICES],
  WEATHER_ENGINE_MODIFIERS: [() => WEATHER_ENGINE_MODIFIERS],
  WEATHER_LOOKS: [() => WEATHER_LOOKS],
  WEATHER_NAMES: [() => WEATHER_NAMES],
  WEATHER_SKY_PALETTES: [() => WEATHER_SKY_PALETTES],
  environment: [() => environment],
  environmentClimate: [() => environmentClimate, v => (environmentClimate = v)],
  environmentFactors: [() => environmentFactors, v => (environmentFactors = v)],
  environmentForecast: [() => environmentForecast, v => (environmentForecast = v)],
  environmentFrame: [() => environmentFrame, v => (environmentFrame = v)],
  environmentHash: [() => environmentHash, v => (environmentHash = v)],
  environmentHere: [() => environmentHere, v => ((environmentHere = v), provide({ environmentHere }))],
  environmentHint: [() => environmentHint, v => (environmentHint = v)],
  environmentHistory: [() => environmentHistory, v => (environmentHistory = v)],
  environmentHour: [() => environmentHour, v => (environmentHour = v)],
  environmentIcon: [() => environmentIcon, v => (environmentIcon = v)],
  environmentLabel: [() => environmentLabel, v => (environmentLabel = v)],
  environmentLikes: [() => environmentLikes, v => (environmentLikes = v)],
  environmentLitFraction: [() => environmentLitFraction, v => (environmentLitFraction = v)],
  environmentMixHex: [() => environmentMixHex, v => (environmentMixHex = v)],
  environmentOdds: [() => environmentOdds, v => ((environmentOdds = v), provide({ environmentOdds }))],
  environmentPreferences: [() => environmentPreferences, v => (environmentPreferences = v)],
  environmentRules: [() => environmentRules, v => (environmentRules = v)],
  environmentSeason: [() => environmentSeason, v => ((environmentSeason = v), provide({ environmentSeason }))],
  environmentSky: [() => environmentSky, v => (environmentSky = v)],
  environmentSmoothstep: [() => environmentSmoothstep],
  environmentState: [() => environmentState, v => ((environmentState = v), provide({ environmentState }))],
  environmentSun: [() => environmentSun, v => ((environmentSun = v), provide({ environmentSun }))],
  environmentWeatherFor: [() => environmentWeatherFor, v => (environmentWeatherFor = v)],
  environmentWindowLit: [() => environmentWindowLit, v => (environmentWindowLit = v)],
  weatherHistory: [() => weatherHistory],
});
/* eslint-enable no-func-assign */
provide({ environmentHere, environmentOdds, environmentSeason, environmentState, environmentSun });
/* to-module: end */
export const environment = {
  on: false,
  force: null,
  id: null,
  tod: 13,
  night: 0,
  dusk: 0,
  dawn: 0,
  grey: 0,
  storm: 0,
  rain: 0,
  snow: 0,
  fog: 0,
  ash: 0,
  cloud: 0.4,
  wet: 0,
  flash: 0,
  season: 'summer',
  weather: 'clear',
  climate: 'mild',
  sk: [0, 0, 0, 0],
  lampK: 0,
  t: 0,
};
provide({ environment }); /* to-module */
const SEASON_BY_MONTH = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
];
const WEATHER_SKY_PALETTES = {
  night: ['#070B22', '#121A3C', '#232B52'],
  dusk: ['#34407E', '#C77C7A', '#FFB070'],
  dawn: ['#6E8ECA', '#EEB2A6', '#FFD4A0'],
  grey: ['#7C8898', '#A0AAB6', '#BEC4CA'],
  storm: ['#40485A', '#5A6272', '#727A86'],
  ash: ['#6A5C58', '#8A7C74', '#A69284'],
};
/* how each weather looks: cloud cover, how grey the sky turns, rain, snow, fog, ash */
export const WEATHER_LOOKS = {
  clear: { cloud: 0.35 },
  cloudy: { cloud: 0.85, grey: 0.5 },
  rain: { cloud: 0.95, grey: 0.72, rain: 1, fog: 0.15 },
  storm: { cloud: 1, grey: 0.9, storm: 1, rain: 1.6, fog: 0.2 },
  fog: { cloud: 0.7, grey: 0.4, fog: 1 },
  snow: { cloud: 0.9, grey: 0.55, snow: 1, fog: 0.25 },
  ash: { cloud: 0.55, grey: 0.35, ash: 1, fog: 0.15 },
};
/* the odds of each weather by kind of place */
const CLIMATE_WEATHER_ODDS = {
  mild: { clear: 50, cloudy: 22, rain: 16, fog: 8, storm: 4 },
  coast: { clear: 46, cloudy: 20, rain: 18, fog: 10, storm: 6 },
  alpine: { clear: 34, cloudy: 16, snow: 40, fog: 10 },
  volcano: { clear: 40, cloudy: 20, ash: 40 },
  dry: { clear: 80, cloudy: 20 },
  none: { clear: 100 },
};
export const WEATHER_NAMES = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  storm: 'Thunderstorm',
  fog: 'Fog',
  snow: 'Snow',
  ash: 'Falling ash',
};
const TIME_OF_DAY_CHOICES = [
  ['real', 'Follow my clock'],
  ['morning', 'Always morning'],
  ['day', 'Always midday'],
  ['evening', 'Always evening'],
  ['night', 'Always night'],
];
const PINNED_HOURS = { morning: 8.2, day: 13, evening: 19.6, night: 23.4 };
/* who comes out when (multiplies a billionaire's odds in the wild by its types) */
export const ENVIRONMENT_LIKES = {
  night: { Psychic: 2, Dragon: 1.6, Steel: 1.2, Grass: 0.8 },
  dusk: { Flying: 1.4, Psychic: 1.2 },
  sunny: { Grass: 1.25, Fire: 1.2 },
  rain: { Water: 1.8, Electric: 1.3, Fire: 0.6 },
  storm: { Electric: 2.2, Water: 1.6, Flying: 0.6 },
  snow: { Steel: 1.5, Water: 1.2, Grass: 0.7 },
  fog: { Psychic: 1.6, Dragon: 1.3 },
  ash: { Fire: 1.8, Ground: 1.4, Water: 0.7 },
};
const environmentSmoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function environmentPreferences() {
  return (typeof S !== 'undefined' && S && S.preferences) || {};
}
function environmentRules() {
  return (typeof RULES !== 'undefined' && RULES && RULES.env) || {};
}
/* the kind of weather a scene gets: its own field, else guessed from what it is */
function environmentClimate(sc) {
  if (!sc) return 'mild';
  if (sc.climate && CLIMATE_WEATHER_ODDS[sc.climate]) return sc.climate;
  if (sc.indoor) return 'none';
  if (sc.waterKind === 'lava' || sc.far === 'volcano' || sc.edge === 'z' || sc.edge === 'j') return 'volcano';
  if (sc.waterKind === 'ice' || sc.far === 'snow' || sc.edge === 'n') return 'alpine';
  if (sc.flatFar || sc.ride || sc.far === 'sea' || sc.waterKind === 'sea') return 'coast';
  if (sc.far === 'canyon' || sc.far === 'desert' || (sc.edge === 's' && !sc.waters)) return 'dry';
  return 'mild';
}
function environmentSeason(d) {
  const p = (environment.force && environment.force.season) || environmentPreferences().season;
  if (p && p !== 'auto') return p;
  return SEASON_BY_MONTH[(d || new Date()).getMonth()];
}
export function environmentHour(d) {
  const f = environment.force && environment.force.time,
    p = f != null ? f : environment.on ? environmentPreferences().time || 'real' : 'day';
  if (typeof p === 'number') return p;
  if (p !== 'real' && PINNED_HOURS[p] != null) return PINNED_HOURS[p];
  d = d || new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function environmentHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
/* today's weather for a kind of place: changes every three hours, the same for everyone */
function environmentWeatherFor(climate, d) {
  const f = environment.force && environment.force.weather;
  if (f) return f;
  const p = environmentPreferences().weather;
  if (p === 'clear' || !environment.on) return 'clear';
  if (p && p !== 'auto' && WEATHER_LOOKS[p]) return p;
  d = d || new Date();
  const odds = Object.assign({}, CLIMATE_WEATHER_ODDS[climate] || CLIMATE_WEATHER_ODDS.mild),
    ss = environmentSeason(d);
  if (climate === 'mild' && ss === 'winter') {
    odds.snow = (odds.rain || 0) * 0.7;
    odds.rain = (odds.rain || 0) * 0.3;
  }
  if (climate === 'mild' && ss === 'summer') {
    odds.clear += 12;
    odds.storm = (odds.storm || 0) + 3;
  }
  const day = Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5),
    blk = Math.floor(d.getHours() / 3),
    r = environmentHash(climate + '|' + day + '|' + blk) * Object.values(odds).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const [k, w] of Object.entries(odds)) {
    acc += w;
    if (r < acc) return k;
  }
  return 'clear';
}
/* everything the renderer needs, eased so weather drifts in and out; a new scene snaps */
/* the hour, the season and the weather for a scene right now (no easing): used for the odds in the wild and the walk card too */
export function environmentState(sc, d) {
  d = d || new Date();
  const h = environmentHour(d),
    ss = environmentSeason(d),
    wk = ss === 'winter' ? 1 : ss === 'summer' ? -0.6 : 0,
    rise = 6 + wk * 1.1,
    set = 20.2 - wk * 1.8,
    clim = environmentClimate(sc),
    wx = sc && sc.indoor ? 'clear' : environmentWeatherFor(clim, d);
  /* 1 at full night, 0 in daylight; dusk and dawn are bells around sunset and sunrise */
  const night =
      1 - environmentSmoothstep(rise - 0.9, rise + 0.7, h) * (1 - environmentSmoothstep(set - 0.5, set + 1.1, h)),
    dusk = Math.exp(-Math.pow((h - set) / 1.0, 2)),
    dawn = Math.exp(-Math.pow((h - rise) / 0.9, 2));
  return { h, ss, rise, set, clim, wx, night, dusk, dawn };
}
/* v47: the share of windows lit at hour h. They come on one at a time from late afternoon and go off one at a time
   late at night (each window has its own moment, from its position), with a few early risers before dawn */
export function environmentLitFraction(h) {
  h = ((h % 24) + 24) % 24;
  const sm = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  if (h < 1.5) h += 24;
  if (h >= 22) return 0.8 - 0.66 * sm(22, 25.5, h);
  if (h < 5) return 0.14;
  if (h < 7) return 0.14 + 0.31 * sm(5, 7, h);
  if (h < 9.5) return 0.45 - 0.27 * sm(7, 9.5, h);
  if (h < 16) return 0.18;
  if (h < 19.5) return 0.18 + 0.62 * sm(16, 19.5, h);
  return 0.8;
}
export function environmentWindowLit(x, z, h) {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v) < environmentLitFraction(h);
}
export function environmentHere() {
  try {
    return typeof sceneIdAt === 'function' && typeof mapById === 'function' && typeof S !== 'undefined' && S.route
      ? mapById(sceneIdAt(S.route.node))
      : null;
  } catch (e) {
    return null;
  }
}
/* v47: what the weather has been doing these past hours, worked out from the weather of each hour (the same for
   everyone): the ground stays wet and the puddles last for a few hours after rain; snow piles up while it snows and
   melts away over the hours after (slowly in the mountains, quickly in the sun) */
const weatherHistory = { key: '', wet: 0, snow: 0 };
function environmentHistory(clim, d) {
  const now = (d || new Date()).getTime(),
    key =
      clim + '|' + Math.floor(now / 3.6e6) + '|' + JSON.stringify(environment.force || 0) + (environment.on ? 1 : 0);
  if (weatherHistory.key === key) return weatherHistory;
  let wet = 0,
    snow = 0;
  if (clim !== 'none')
    for (let k = 36; k >= 1; k--) {
      const w = environmentWeatherFor(clim, new Date(now - k * 3.6e6));
      if (w === 'rain' || w === 'storm') {
        wet = 1;
        snow = Math.max(0, snow - 0.08);
      } else {
        wet = Math.max(0, wet - 0.24);
        if (w === 'snow') snow = Math.min(0.62, snow + 0.09);
        else snow = Math.max(0, snow - (clim === 'alpine' ? 0.012 : w === 'clear' ? 0.06 : 0.03));
      }
    }
  weatherHistory.key = key;
  weatherHistory.wet = wet;
  weatherHistory.snow = snow;
  return weatherHistory;
}
/* everything the renderer needs, eased so weather drifts in and out; a new scene (or a changed setting) snaps */
export function environmentFrame(sc, dt) {
  const p = environmentPreferences(),
    F = environment.force || {},
    f =
      JSON.stringify([F.time, F.season, F.front ? 0 : F.weather]) +
      (p.time || '') +
      (p.season || '') +
      (environment.on ? 1 : 0),
    snap = environment.id !== (sc && sc.name) || environment._f !== f;
  /* alpha 0.4: the weather changing on its own (or in your settings) comes in as a front; a forced weather changes at once, unless it asks for a front (environment.force.front) */ environment.id =
    sc && sc.name;
  environment._f = f;
  const st = environmentState(sc),
    { h, ss, rise, set, clim, wx, night, dusk, dawn } = st,
    W = WEATHER_LOOKS[wx] || WEATHER_LOOKS.clear;
  environment.tod = h;
  environment.season = ss;
  environment.weather = wx;
  environment.climate = clim;
  environment.rise = rise;
  environment.set = set;
  environment.raw = { night, dusk, dawn };
  const inn = sc && sc.indoor ? 0 : 1;
  /* alpha 0.4: weather comes in fronts. When the weather changes while you're in a place, the clouds build first and
    the light dims, then the rain (or snow, or ash) sweeps across the place as a curtain you can see coming; when it
    clears, the back edge of the curtain passes the same way and the light comes back. environment.curtain tells the rain where
    it falls (drawWeather); after rain in daylight a rainbow stands in the sky for a few minutes (environment.rainbow) */
  const now = performance.now() / 1000;
  let Wm = W,
    cur = null;
  if (snap || !environment.wxNow) {
    environment.wxNow = wx;
    environment.front = null;
  } else if (wx !== environment.wxNow) {
    environment.front = {
      w0: environment.wxNow,
      W0: WEATHER_LOOKS[environment.wxNow] || WEATHER_LOOKS.clear,
      t0: now,
      dur: typeof RM !== 'undefined' && RM ? 3 : environmentRules().frontSecs || 75,
      dir: environmentHash(wx + environment.wxNow + Math.floor(now / 600)) < 0.5 ? 1 : -1,
    };
    environment.wxNow = wx;
  }
  const Fr = environment.front;
  if (Fr) {
    const fr = Math.min(1, (now - Fr.t0) / Fr.dur),
      W0 = Fr.W0,
      mx = (a, b, t) => (a || 0) + ((b || 0) - (a || 0)) * t,
      sm = environmentSmoothstep,
      wet0 = (W0.rain || 0) + (W0.snow || 0) + (W0.ash || 0),
      wet1 = (W.rain || 0) + (W.snow || 0) + (W.ash || 0),
      into = wet1 > wet0;
    const fc = into ? sm(0, 0.45, fr) : sm(0.45, 1, fr),
      fg = into ? sm(0.1, 0.6, fr) : sm(0.4, 0.95, fr),
      fp = sm(0.3, 0.9, fr);
    Wm = {
      cloud: mx(W0.cloud, W.cloud, fc),
      grey: mx(W0.grey, W.grey, fg),
      storm: mx(W0.storm, W.storm, fp),
      fog: mx(W0.fog, W.fog, fg),
      rain: mx(W0.rain, W.rain, fp),
      snow: mx(W0.snow, W.snow, fp),
      ash: mx(W0.ash, W.ash, fp),
    };
    if (Math.abs(wet1 - wet0) > 0.05 && fr < 1)
      cur = {
        into,
        dir: Fr.dir,
        e: -1.4 + 2.8 * fp,
        rain: Math.max(W0.rain || 0, W.rain || 0),
        snow: Math.max(W0.snow || 0, W.snow || 0),
        ash: Math.max(W0.ash || 0, W.ash || 0),
      };
    if (fr >= 1) {
      environment.front = null;
      if (!into && (W0.rain || 0) > 0 && !W.rain && night < 0.4) environment.rainbow = 1;
    }
  }
  environment.curtain = cur && inn ? cur : null;
  environment.rainbow = Math.max(0, (environment.rainbow || 0) - dt / 160) * (inn ? 1 : 0);
  /* morning mist: in the mild and coastal places the valleys fill with fog at dawn and it burns off by mid-morning */
  const mist =
    inn && (clim === 'mild' || clim === 'coast') && !(Wm.rain || Wm.snow)
      ? 0.42 * Math.exp(-Math.pow((h - (rise + 0.7)) / 1.1, 2))
      : 0;
  const T = {
    night: night * inn,
    dusk: Math.max(0, dusk - night * 0.3) * inn,
    dawn: Math.max(0, dawn - night * 0.3) * inn,
    cloud: Wm.cloud || 0,
    grey: Wm.grey || 0,
    storm: Wm.storm || 0,
    rain: Wm.rain || 0,
    snow: Wm.snow || 0,
    fog: Math.max(Wm.fog || 0, mist),
    ash: Wm.ash || 0,
  };
  const k = snap ? 1 : Math.min(1, dt * (Fr ? 1.5 : 0.35));
  for (const [a, v] of Object.entries(T))
    environment[a] +=
      (v - environment[a]) * (a === 'night' || a === 'dusk' || a === 'dawn' ? (snap ? 1 : Math.min(1, dt * 2)) : k);
  const HI = environmentHistory(clim),
    wetT = Math.max(environment.rain > 0.3 ? 1 : 0, sc && sc.indoor ? 0 : HI.wet);
  environment.snowHist = sc && sc.indoor ? 0 : HI.snow;
  environment.wet = snap
    ? wetT
    : Math.max(0, Math.min(1, environment.wet + (wetT > environment.wet ? dt * 0.08 : -dt * 0.01)));
  /* lightning: a rare flash in a storm */
  environment.flash = Math.max(0, environment.flash - dt * 3.2);
  if (
    environment.storm > 0.5 &&
    !(typeof RM !== 'undefined' && RM) &&
    document.documentElement.dataset.flash !== 'off' &&
    Math.random() < dt * 0.06
  )
    environment.flash = 1;
  /* the season as four dials for the shaders: autumn colour, spring freshness, winter paleness, snow lying on the ground */
  const son = environment.on || !!(environment.force && environment.force.season),
    snowLie = Math.max(
      clim === 'mild' && ss === 'winter' ? 0.22 : 0,
      environment.snow * 0.55,
      environment.snowHist || 0
    );
  environment.sk = son
    ? [ss === 'autumn' ? 0.8 : 0, ss === 'spring' ? 0.8 : 0, ss === 'winter' ? 0.6 : 0, sc && sc.indoor ? 0 : snowLie]
    : [0, 0, 0, 0];
  environment.lampK = Math.max(
    environment.night,
    environment.dusk * 0.6,
    environment.grey * 0.45,
    environment.fog * 0.5
  );
  return environment;
}
/* colours of the sky (top, middle, horizon) after time and weather */
function environmentMixHex(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}
export function environmentSky(sky, indoor) {
  const c = sky.map(s => s.slice());
  if (indoor) return c;
  const P = k => WEATHER_SKY_PALETTES[k].map(h => hexA(h).map(v => v / 255));
  const du = P('dusk'),
    da = P('dawn'),
    gr = P(environment.storm > 0.5 ? 'storm' : environment.ash > 0.5 ? 'ash' : 'grey'),
    ni = P('night');
  for (let i = 0; i < 3; i++) {
    let v = c[i];
    v = environmentMixHex(v, da[i], environment.dawn * 0.75);
    v = environmentMixHex(v, du[i], environment.dusk * 0.85);
    v = environmentMixHex(v, gr[i], environment.grey * 0.85);
    v = environmentMixHex(
      v,
      ni[i].map(x => x * (1 - environment.grey * 0.25)),
      environment.night * 0.94
    );
    if (environment.flash) v = environmentMixHex(v, [0.9, 0.92, 1], environment.flash * 0.5);
    c[i] = v;
  }
  return c;
}
/* engine dials the time and weather lean on (read through eng(); see settings.js) */
const WEATHER_ENGINE_MODIFIERS = {
  sun: {
    strength: v =>
      environment.on || environment.force ? v * (1 - environment.grey * 0.55) * (1 - environment.fog * 0.25) : v,
    clouds: v => (environment.on || environment.force ? Math.max(v, environment.cloud) : v),
    cloudShadows: v => v * (1 - environment.grey * 0.8),
    shafts: v => v * (1 - environment.grey) * (1 + environment.dusk * 0.8 + environment.dawn * 0.5),
  },
  shadows: {
    strength: v => v * (1 - environment.grey * 0.55 - environment.fog * 0.2),
    softness: v => v * (1 + environment.grey * 1.4),
  },
  lights: { windowsDay: v => Math.max(v, environment.lampK) },
  color: {
    saturation: v => v * (1 - environment.night * 0.22 - environment.grey * 0.14),
    exposure: v =>
      v *
      (1 + environment.night * 0.18 + environment.flash * 0.6) *
      (typeof walkView !== 'undefined' && walkView.sc && walkView.sc.indoor
        ? 1 - environment.grey * 0.12 - environment.storm * 0.06
        : 1),
    warmth: v => v + environment.dusk * 0.22 + environment.dawn * 0.12 - environment.night * 0.12,
    bloom: v => v * (1 + environment.night * 0.5),
  },
  air: {
    mist: v => v + environment.fog * 0.18 + environment.rain * 0.05,
    particles: v => v * (1 - environment.rain * 0.6 - environment.snow * 0.6),
  },
  grass: {
    wind: v => v * (1 + environment.storm * 1.2 + environment.rain * 0.3),
    gusts: v => v * (1 + environment.storm * 1.5 + environment.rain * 0.4),
  },
  world: { groundShine: v => v * (1 + environment.wet * 1.6) },
  water: { ripples: v => v * (1 + environment.rain * 0.7 + environment.storm * 0.8) },
};
provide({ WEATHER_ENGINE_MODIFIERS }); /* to-module */
/* the light of the moment: a low warm sun at dusk, the moon at night */
function environmentSun(a, h, col) {
  const day = 1 - environment.night,
    t = environment.tod;
  if (day > 0.02) {
    const span = Math.max(1, environment.set - environment.rise),
      ph = clamp((t - environment.rise) / span, 0, 1),
      el = Math.sin(ph * Math.PI);
    h = clamp(12 + (h - 12) * el, 12, h);
    a = a + (ph - 0.5) * 70;
  }
  const warm = Math.max(environment.dusk, environment.dawn * 0.7);
  col = [col[0], col[1] * (1 - warm * 0.16), col[2] * (1 - warm * 0.38)];
  /* the moon: from high up front-left, cool and dim */
  const moon = [0.62, 0.72, 1.0];
  col = col.map((v, i) => v * (1 - environment.night) + moon[i] * environment.night * 0.42);
  h = h * (1 - environment.night) + 48 * environment.night;
  a = a * (1 - environment.night) + (a + 40) * environment.night;
  return { a, h, col };
}
/* the odds of meeting each billionaire, tilted by the hour and the weather */
function environmentLikes() {
  const L = Object.assign({}, ENVIRONMENT_LIKES),
    R = environmentRules().likes || {};
  for (const k in R) L[k] = Object.assign({}, L[k] || {}, R[k]);
  return L;
}
/* which of the likes apply where you are now */
function environmentFactors(st) {
  const L = environmentLikes(),
    f = [];
  if (st.night > 0.5) f.push(['night', L.night]);
  else if (st.dusk > 0.4 || st.dawn > 0.4) f.push(['dusk', L.dusk]);
  else if (st.wx === 'clear') f.push(['sunny', L.sunny]);
  if (st.wx !== 'clear' && L[st.wx]) f.push([st.wx, L[st.wx]]);
  return f.filter(x => x[1]);
}
function environmentOdds(list, sc) {
  if (!environment.on || !list || environmentRules().off) return list;
  const sc2 = sc || environmentHere();
  if (sc2 && sc2.indoor) return list;
  const f = environmentFactors(environmentState(sc2));
  if (!f.length) return list;
  return list.map(([id, w]) => {
    const t = (typeof SP !== 'undefined' && SP[id] && SP[id].types) || [];
    let m = 1;
    for (const [, F] of f) for (const ty of t) if (F[ty]) m *= F[ty];
    return [id, w * m];
  });
}
/* a short line for the walk card: “Evening · Rain · Autumn”, its icon, and who is about */
export function environmentLabel(sc) {
  if (!environment.on) return '';
  const st = environmentState(sc || environmentHere()),
    t =
      st.night > 0.5
        ? 'Night'
        : st.dusk > 0.35
          ? 'Evening'
          : st.dawn > 0.35
            ? 'Dawn'
            : st.h < 11
              ? 'Morning'
              : st.h < 14
                ? 'Midday'
                : 'Afternoon';
  const hh = Math.floor(st.h) % 24,
    mm = Math.floor((st.h - Math.floor(st.h)) * 60),
    clock = `${hh}:${String(mm).padStart(2, '0')}`;
  const fc = environmentForecast(sc || environmentHere());
  return `${clock} ${t} · ${WEATHER_NAMES[st.wx] || 'Clear'}${fc ? ' (' + fc + ')' : ''} · ${st.ss[0].toUpperCase() + st.ss.slice(1)}`;
}
/* alpha 0.4: what's coming: the weather of the next few hours where it changes ("rain from 15:00", "clearing by 18:00") */
function environmentForecast(sc) {
  if (!environment.on || (environment.force && environment.force.weather)) return '';
  const s = sc || environmentHere();
  if (!s || s.indoor) return '';
  const clim = environmentClimate(s),
    d = new Date(),
    now = environmentWeatherFor(clim, d);
  for (let k = 1; k <= 2; k++) {
    const t = new Date(d.getTime() + k * 3 * 3.6e6),
      nb = new Date(t.getFullYear(), t.getMonth(), t.getDate(), Math.floor(t.getHours() / 3) * 3),
      w = environmentWeatherFor(clim, nb);
    if (w === now) continue;
    const at = `${nb.getHours()}:00`,
      wet = x => x === 'rain' || x === 'storm' || x === 'snow' || x === 'ash';
    return wet(w)
      ? `${(WEATHER_NAMES[w] || w).toLowerCase()} from ${at}`
      : wet(now)
        ? `clearing by ${at}`
        : `${(WEATHER_NAMES[w] || w).toLowerCase()} from ${at}`;
  }
  return '';
}
export function environmentIcon(sc) {
  const st = environmentState(sc || environmentHere()),
    w = st.wx;
  return w === 'rain' || w === 'storm'
    ? 'rain'
    : w === 'snow'
      ? 'snow'
      : w === 'fog'
        ? 'fog'
        : w === 'ash'
          ? 'ash'
          : w === 'cloudy'
            ? 'cloud'
            : st.night > 0.5
              ? 'moon'
              : 'sun';
}
export function environmentHint(sc) {
  if (!environment.on || environmentRules().off) return '';
  const s = sc || environmentHere();
  if (s && s.indoor) return '';
  const up = new Set();
  for (const [, F] of environmentFactors(environmentState(s)))
    for (const [t, m] of Object.entries(F)) if (m > 1.2) up.add(t);
  return up.size ? `${[...up].join(' and ')} Billies are about.` : '';
}
