#!/usr/bin/env python3
"""Song fingerprints (sound track SND-2): proves a change to the music code is silent, or shows what it changed.

    python3 tools/check-sound.py              # compare with validation/sound-baseline/ (fails on any difference)
    python3 tools/check-sound.py --baseline   # write the baseline (only when a change to the sound is on purpose)
    python3 tools/check-sound.py --only=meadow,victory   # only these songs, jingles or cries

It opens the game page in a headless browser and renders, through an OfflineAudioContext, 8 bars of every song (by day,
and at night: the night version once the game has them (SND-4), with the pad), every jingle and every species' cry, through the game's own sound code: initSound builds
its buses on the offline context (a stand-in AudioContext hands it over), then the song, jingle or cry is asked for as
the game asks for it. Math.random is seeded for each render (the drums' noise uses it), and the context's clock is
held still while the notes are scheduled, so one tick schedules all 8 bars. Each render is written as the loudness (RMS)
of each 50 ms window. Nothing is heard and nothing in game/ is changed.

SND-5: a song also renders its intro ('intro': the intro, then the song, as a battle starts it) and the variants
sound.js musicParts names for it ('tense' for a battle song, 'mid' and 'late' for a run's songs), each as
long as the recipe that plays (tracker.js trackerRecipe). On code without them, only day and night.

SND-6: a species' cry also renders its low-HP version ('<id>@low', when sound.js has cryPlay), the four UI sounds
render into ui.json (when sound.js has uiSound), and a jingle renders at its own tempo and wave as the game plays it
(sound.js jinglePlay, music.json jingles' bpm and wave); on code without them, as before.

SND-8a: --loudness adds a loudness report after the comparison (it never changes the exit status; its ceilings only
warn until SND-15). On a page of its own, in stereo at default sliders, it renders every song's day version and the
world sounds (tools/sound-loudness.mjs, put in the page, measures each, BS.1770 K-weighted): each bed alone at a distance, birds, steps
on a lawn, and three made-up scenes (Copperleaf's square, a route in the rain, a meadow at night), as the Sound Test
plays them (sound.js ambiencePreviewTick). Beds are reported with the beds' duck under a four-voice song (music.json
mix bedsUnderSong) and in LU under the route song; on code without ambiencePreviewTick (before SND-8a) the beds'
gains are set as updateAmbience would set them.

    python3 tools/check-sound.py --loudness               # the comparison, then the report
    python3 tools/check-sound.py --loudness --only=route  # the report for those songs (and every world sound)

SND-10: the report adds every water recipe (soundscape.json `water`) at 1, 3 and 10 m (a fall at its height), as the
Sound Test plays them; its banks are baked once before the jobs. A water row warns over either ceiling (its level 12 LU
under the route song, its loudest 3 s 8 LU under).

SND-14: and nature's rows (soundscape.json `nature`, as the Sound Test plays them: nature-here.js naturePreviewTick):
rain by how hard it falls, on a roof and indoors, thunder near and far, wind and gusts, birds by the hour, insects,
frogs, fires by size, the town's life, rooms by kind, steps on each surface. A bed row warns over either ceiling, an
event row (thunder, birds, insects, frogs, the town, steps) over the events'.

SND-17: a jingle naming an ensemble (music.json jingles' `ensemble`) renders once more on it ('<name>@ensemble' in
jingles.json: GB Sounds off, its notes baked first); every other jingle part, as every song part, with GB Sounds on,
so it stays today's 8-bit jingle.

SND-13: a song whose ensemble has layers (music.json ensembles, a part's `layer` or `dim`) renders once more for each
layer in play ('layer:walk', 'layer:rain', ... 'layer:intensity3', and 'layer:<name>@night' on a night version with an
ensemble of its own; sound.js musicParts): GB Sounds off, its notes and its layers' baked first, the layer levels as
logic/music-layers.js MUSIC_LAYER_TESTS gives them from the first step. Every other part hears no layer levels, so its
layer parts stay silent and nothing is dimmed: today's sound. --loudness adds each layered render's row against the
ensemble's.

SND-15: --loudness gives each row its true peak (dBTP, 4x oversampled) and each song its loudness range (LRA, EBU Tech
3342); adds effect rows (a cry of each base, talk, the buttons and VFX-19's battle sounds, their loudest 3 s against the route song); and checks
the targets: the route song as it plays (its ensemble) within 1 LU of -18 LUFS at the default sliders, every song's
and jingle's true peak under -1 dBTP (a warning, as the ceilings). Its pages stop drawing, as the fingerprints' do.

SND-9: beside each RMS array, a brightness fingerprint (`zc:<part>` in the same file): the zero crossings in each 50 ms
window, so a change of timbre at the same loudness shows too (a brighter sound crosses zero more often). A crossing
counts when the signal passes from under -0.0001 to over +0.0001 or back (so a near-silent tail's rounding never
counts), and a window quieter than 0.0001 RMS counts 0. A baseline without brightness compares the RMS alone and says
how many brightness arrays it lacks (written with --baseline).

VFX-19: every battle sound (music.json battle: each move family with its hit at its family's hit, each type layer, the
hurt sounds, the recall, the throw and catch) renders into battle.json as it is heard alone (audio/battle-sounds.js
battleSoundPreviewPlay), on code that has them.

A window may differ by 1% (or 0.0001) before it counts as changed; a brightness window by 2% (or 2 crossings). The
baseline is committed: SND-4 and SND-5 write it again on purpose, like the picture baseline."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import NO_ACCOUNTS, TEST_GLOBALS, serve, until  # noqa: E402  (TC-4: the browser checks' shared helpers)

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
BASE = ROOT / 'validation' / 'sound-baseline'
RATE = 44100
WINDOW = 0.05
REL, ABS = 0.01, 1e-4
ZC_REL, ZC_ABS = 0.02, 2   # SND-9: a brightness window's tolerance
ZC = 'zc:'               # SND-9: a brightness array's key is the part's with this in front

# SND-12c: the game page stops drawing once its sound code is loaded: its frames (the title's live scene, drawn in
# software here) took over 3 of the container's 4 cores and left the renders a quarter of one. No sound code waits on
# a frame (the bank bakes in setTimeout slices), so the renders' numbers are the same
NO_DRAW = "() => { window.requestAnimationFrame = () => 0; }"

# runs in the page. Works on the code before and after the tracker split: it only uses sound.js's initSound, music,
# jingle, soundEffect, soundEngine, SONGS and JINGLES, plus the tick (sound.js's musicTick, or the tracker's tick)
RENDER = r"""async ({jobs, rate, win}) => {
  const songs = SONGS, jingles = JINGLES;   /* sound.js's names: the songs' recipes, the jingles' note lists */
  const real = Math.random, AC = window.AudioContext, E = soundEngine;
  /* each job is scheduled alone (with Math.random seeded the same), then all of them render at once */
  /* SND-11: a song's ensemble renders (parts 'ensemble' and 'ensemble-night') play with GB Sounds off, their notes and
     the reverb baked first on a tracker of their own at this rate (the bank is shared); every other part with GB Sounds
     on, so it is today's sound whatever the song's ensemble */
  const ens = p => p === 'ensemble' || p === 'ensemble-night' || (!!p && p.startsWith('layer:'));
  /* SND-13: a layer part's levels ('layer:walk@night': the walk test on the night version) */
  const layerOf = p => (p && p.startsWith('layer:') ? MUSIC_LAYER_TESTS[p.slice(6).split('@')[0]] : null);
  const nightPart = p => p === 'ensemble-night' || (!!p && p.startsWith('layer:') && p.endsWith('@night'));
  const prefs = typeof saveData !== 'undefined' && saveData ? saveData.preferences : null;
  let T0 = null, last = null;
  const prepare = async (name, night, kind) => {
    const play = night ? musicVariant(name, 1) : name;
    /* SND-12: each song's ensemble bakes in a bank of its own: the page renders every song, and their longer forms and
       layers together outgrow the bank's budget (the game bakes one place at a time). A zone is the same numbers every
       time it is baked, so emptying the bank changes no render, only the time */
    if (last !== name + '|' + kind && typeof soundBakeBank !== 'undefined')
      for (const B of soundBakeBank.entries.values()) if (!B.queued.size) B.zones.fill(null);
    last = name + '|' + kind;
    if (!T0) { const oc0 = new OfflineAudioContext(1, rate, rate);
      T0 = trackerCreate(oc0, oc0.destination, { songs, run: MUSIC.run, instruments: MUSIC.instruments, ensembles: MUSIC.ensembles }); }
    /* SND-17: a jingle's ensemble ('jingles' <name>@ensemble), its notes baked the same way */
    if (kind === 'jingle') {
      if (!(await T0.jinglePrepare(MUSIC.jingles[name])) || !T0.jingleReady(MUSIC.jingles[name])) throw new Error('the ensemble of the jingle ' + name + ' did not bake');
      return;
    }
    if (!(await T0.prepare(play)) || !T0.ensembleReady(play)) throw new Error('the ensemble of ' + play + ' did not bake (the budget?)');
    /* SND-13: and every layer's parts */
    if (kind === 'layer') await T0.layersPrepare(play, MUSIC_LAYER_NAMES);
  };
  const schedule = ({kind, name, night, part}) => {
    let seed = 0x5eed;
    Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let len = 1, spb = 0;
    /* SND-4: at night the game asks for the song's night version (sound.js musicVariant), which can be slower: the
       render is as long as the recipe that plays (tracker.js trackerNight) */
    const extra = part && part !== 'day' && part !== 'night' && part !== 'intro' && !ens(part),
      play = extra ? name + '@' + part : kind === 'song' && (night || nightPart(part)) && typeof musicVariant === 'function' ? musicVariant(name, 1) : name;
    let steps = 0;
    /* SND-5: the recipe as the tracker makes it (variants, the intro's bars) when the code has trackerRecipe */
    if (kind === 'song' && typeof trackerRecipe === 'function') {
      const D = trackerCompose(trackerRecipe(songs, play, typeof MUSIC !== 'undefined' ? MUSIC.run : undefined));
      steps = D.steps + (part === 'intro' ? D.introSteps || 0 : 0);
      spb = 60 / D.bpm / 4; len = 0.08 + steps * spb + 1.5; }
    else if (kind === 'song') { const D = play !== name ? trackerNight(songs[name]) : songs[name];
      spb = 60 / D.bpm / 4; steps = D.prog.length * 16; len = 0.08 + steps * spb + 1.5; }
    else if (kind === 'jingle') {
      /* SND-6: a jingle's own tempo (music.json jingles bpm), 150 when it has none */
      const J = typeof MUSIC !== 'undefined' && MUSIC.jingles[name], bpm = (typeof jinglePlay === 'function' && J && J.bpm) || 150;
      len = 0.05 + jingles[name].reduce((a, [, l]) => a + l, 0) * 60 / bpm / 4 + 1.2;
      /* SND-17: on its ensemble, as long as its longest line, and its baked notes' tails (a bell rings 1.6 s) */
      if (ens(part)) len = 0.05 + musicJingleParts(J, MUSIC.ensembles[J.ensemble], { instruments: MUSIC.instruments }).steps * 60 / bpm / 4 + 2; }
    /* VFX-19: a battle sound lasts 1.5 s at most (battle-sounds.test.mjs), then its release and echo */
    else if (kind === 'battle') len = 2.5;
    const oc = new OfflineAudioContext(1, Math.ceil(len * rate), rate);
    let now = 0;
    Object.defineProperty(oc, 'currentTime', { get: () => now, configurable: true });
    Object.defineProperty(oc, 'state', { get: () => 'running', configurable: true });
    if (E.timer) clearInterval(E.timer);
    Object.assign(E, { ctx: null, waves: {}, song: null, want: null, timer: null, voices: [], jingle: 0,
      L: layerOf(part) ? { drums: 1, pad: night ? 1 : 0, layers: layerOf(part) } : { drums: 1, pad: night ? 1 : 0 } });
    window.AudioContext = function () { return oc; };
    if (prefs) saveData.preferences = Object.assign({}, prefs, { gbSounds: !ens(part) });
    try {
      if (!initSound()) throw new Error('initSound failed on the offline context');
      if (kind === 'song') {
        if (part === 'intro') music(play, { intro: true }); else music(play);
        if (!E.song) throw new Error('no song started for ' + play);
        now = 0.08 + (steps - 0.5) * spb - 0.14;
        if (typeof musicTick === 'function') musicTick(); else E.tracker.tick();
      } else if (kind === 'jingle') { if (typeof jinglePlay === 'function') jinglePlay(name); else jingle(jingles[name]); }
      else if (kind === 'ui') uiSound(name);
      else if (kind === 'battle') battleSoundPreviewPlay(name);
      else if (part === 'low') cryPlay(name, true);
      else soundEffect('cry', { sp: name });
    } finally {
      if (E.timer) clearInterval(E.timer);
      Object.assign(E, { ctx: null, song: null, want: null, timer: null, voices: [], jingle: 0 });
      window.AudioContext = AC; Math.random = real;
      if (prefs) saveData.preferences = prefs;
    }
    delete oc.currentTime; delete oc.state;
    return oc;
  };
  /* the RMS of each window and (SND-9) its zero crossings, with a little hysteresis so rounding near silence never counts */
  const prints = buf => {
    const d = buf.getChannelData(0), n = Math.round(win * rate), out = [], zc = [], EPS = 1e-4;
    let side = 0;
    for (let i = 0; i < d.length; i += n) {
      let s = 0, z = 0; const e = Math.min(d.length, i + n);
      for (let j = i; j < e; j++) {
        const x = d[j];
        s += x * x;
        if (x > EPS) { if (side < 0) z++; side = 1; } else if (x < -EPS) { if (side > 0) z++; side = -1; }
      }
      const r = Math.sqrt(s / (e - i));
      out.push(Math.round(r * 1e5) / 1e5);
      zc.push(r < EPS ? 0 : z);
    }
    return [out, zc];
  };
  const ctxs = [];
  for (const j of jobs) { if (ens(j.part)) await prepare(j.name, nightPart(j.part), layerOf(j.part) ? 'layer' : j.kind); ctxs.push(schedule(j)); }
  /* SND-11: the reverb's impulse goes into its convolver a moment after a song starts (a promise): let it */
  await new Promise(r => setTimeout(r, 0));
  return (await Promise.all(ctxs.map(c => c.startRendering()))).map(prints);
}"""


# SND-8a: the loudness report. Each job renders 12 s (a song: its 8 bars) in stereo on its own offline context through
# the game's code, then tools/sound-loudness.mjs measures it in the page (only the numbers come back)
LOUD = r"""async ({jobs, rate}) => {
  const soundLoudness = window.__soundLoudness;
  const real = Math.random, AC = window.AudioContext, E = soundEngine, wait = window.setTimeout;
  /* what updateAmbience set on code before SND-8a: [range m, gain] by source, else a fixed gain */
  const OLD = { stream: [10, 0.5], falls: [14, 0.7], sea: [8, 0.6], pond: [6, 0.22], lava: [10, 0.5], fountain: [9, 0.45], fire: [7, 0.35] },
    FIXED = { sea_coast: ['sea', 0.35], rain: ['rain', 0.42], wind: ['wind', 0.4], leaves: ['leaves', 0.22], crickets: ['crickets', 0.11], town: ['town', 0.13], cave: ['cave', 0.3], room: ['room', 0.16] };
  const out = [];
  /* SND-10: the water's banks baked once at this rate before the jobs (a job's own slices never run: its setTimeout
     is stopped); every later context at the rate plays them from the tracker's bank */
  if (typeof SOUNDSCAPE !== 'undefined' && SOUNDSCAPE.banks && typeof trackerCreate === 'function') {
    const oc0 = new OfflineAudioContext(2, rate, rate), T0 = trackerCreate(oc0, oc0.destination, {});
    if (T0.bankAdd) { T0.bankAdd(SOUNDSCAPE.banks); await T0.bankReady(Object.keys(SOUNDSCAPE.banks)); }
  }
  for (const job of jobs) {
    let seed = 0x5eed;
    Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let len = job.len || 12, steps = 0, spb = 0;
    /* SND-11: a song row with GB Sounds on (today's sound), an ensemble row (job.ens) with it off, baked first */
    if (job.ens) {
      const oc0 = new OfflineAudioContext(2, rate, rate),
        T1 = trackerCreate(oc0, oc0.destination, { songs: SONGS, run: MUSIC.run, instruments: MUSIC.instruments, ensembles: MUSIC.ensembles });
      /* SND-17: a jingle's ensemble row */
      if (job.jingle) { if (!(await T1.jinglePrepare(MUSIC.jingles[job.jingle]))) throw new Error('no ensemble for the jingle ' + job.jingle); }
      else if (!(await T1.prepare(job.song))) throw new Error('no ensemble for ' + job.song);
      /* SND-13: a layered row: every layer's parts baked too */
      if (job.layers) await T1.layersPrepare(job.song, MUSIC_LAYER_NAMES);
    }
    if (job.song) {
      const D = trackerCompose(trackerRecipe(SONGS, job.song, MUSIC.run));
      steps = D.steps; spb = 60 / D.bpm / 4; len = 0.08 + steps * spb + 1.5;
    }
    const oc = new OfflineAudioContext(2, Math.ceil(len * rate), rate);
    let now = 0;
    Object.defineProperty(oc, 'currentTime', { get: () => now, configurable: true });
    Object.defineProperty(oc, 'state', { get: () => 'running', configurable: true });
    if (E.timer) clearInterval(E.timer);
    Object.assign(E, { ctx: null, waves: {}, song: null, want: null, timer: null, voices: [], jingle: 0,
      L: job.layers ? { drums: 1, pad: 0, layers: MUSIC_LAYER_TESTS[job.layers] } : { drums: 1, pad: 0 } });
    const prefs = saveData.preferences, amb = Object.assign({}, ambience);
    saveData.preferences = (job.song || job.jingle) && !job.ens ? { gbSounds: true } : {};
    window.AudioContext = function () { return oc; };
    window.setTimeout = () => 0;   /* the one-shots' disconnects would cut a render short */
    try {
      if (!initSound()) throw new Error('initSound failed on the offline context');
      if (job.song) {
        music(job.song);
        now = 0.08 + (steps - 0.5) * spb - 0.14;
        E.tracker.tick();
      } else if (job.jingle) {
        jinglePlay(job.jingle);
      } else if (job.fx) {
        /* SND-15: effects at their times: [s, soundEffect's name, its options] (a cry, talk's blips) or [s, 'ui', name] */
        for (const [at, name, o] of job.fx) { now = at; if (name === 'ui') uiSound(o); else if (name === 'battle') battleSoundPreviewPlay(o); else soundEffect(name, o); }
      } else {
        Object.assign(ambience, { bus: null, amb: null, lpA: null, lpW: null, beds: {}, flash: 0, arrive: -9, id: null, lastCall: 0, ev: {}, birdAt: null });
        if (!initAmbience()) throw new Error('initAmbience failed on the offline context');
        ambience.arrive = -9; applyAmbienceVolume();
        const beds = job.beds.filter(([k]) => k !== 'birds' && k !== 'steps');
        if (typeof ambiencePreviewTick === 'function')
          for (now = 0; now < len; now += 0.2) ambiencePreviewTick(job.beds, now);
        else {
          for (const [k, d] of beds) {
            const [bed, v] = OLD[k] ? [k, d < OLD[k][0] ? Math.pow(1 - d / OLD[k][0], 1.6) * OLD[k][1] : 0] : FIXED[k];
            const b = ambience.beds[bed];
            if (b) b.g.gain.value = Math.max(b.g.gain.value, v);
          }
          if (job.beds.some(([k]) => k === 'birds'))
            for (now = 0; now < len; now += 0.2) if (Math.random() < 0.06) playBirdCall(now, ['lark', 'lark', 'song'][Math.floor(Math.random() * 3)]);
        }
        if (job.beds.some(([k]) => k === 'steps'))
          for (now = 0.5; now < len; now += 0.35) soundEffect('step', { ter: 'g' });
      }
    } finally {
      if (E.timer) clearInterval(E.timer);
      Object.assign(E, { ctx: null, song: null, want: null, timer: null, voices: [], jingle: 0 });
      window.AudioContext = AC; Math.random = real; window.setTimeout = wait;
      saveData.preferences = prefs;
    }
    delete oc.currentTime; delete oc.state;
    await new Promise(r => wait.call(window, r, 0));
    const buf = await oc.startRendering();
    Object.assign(ambience, amb);
    /* a song's fade-in and a bed's first second left out; a jingle whole (SND-17) */
    const L = soundLoudness([buf.getChannelData(0), buf.getChannelData(1)], rate, job.jingle || job.fx ? 0 : job.song ? 0.5 : 1);
    out.push(Object.fromEntries(Object.entries(L).map(([k, v]) => [k, typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v])));
  }
  return out;
}"""

# the world sounds the report renders: each bed alone (a fire at 2 m), and three made-up scenes (Copperleaf's square
# hears the fountain's water recipe at 3 m since SND-10)
LOUD_BEDS = [('rain', [['rain', 0]]), ('wind (storm)', [['wind', 0]]), ('leaves (woods)', [['leaves', 0]]),
             ('crickets', [['crickets', 0]]), ('town murmur', [['town', 0]]), ('cave', [['cave', 0]]), ('room', [['room', 0]]),
             ('fire 2 m', [['fire', 2]]), ('sea, the coast', [['sea_coast', 0]]),
             ('birds', [['birds', 0]]), ('steps (lawn)', [['steps', 0]])]   # SND-10: the water is the water rows'
# SND-14: nature (soundscape.json `nature`, nature-here.js naturePreviewTick): rain by how hard it falls (0.3 light, 1,
# 1.6 a storm's), on a roof 1 m from its eaves and indoors; thunder at 0.6 and 4 km; the wind's gusts and a storm's;
# birds at dawn and noon, the owl; insects, frogs at 3 m; fires by size; steps on each surface; the town's life; rooms
LOUD_NATURE = [('light rain', [['rain', 0, 0.3]]), ('heavy rain', [['rain', 0, 1.6]]), ('rain on a roof 1 m', [['roof', 1, 1]]),
               ('rain indoors', [['roofIn', 0, 1]]), ('thunder 0.6 km', [['thunder', 0, 0.6]]), ('thunder 4 km', [['thunder', 0, 4]]),
               ('breeze and gusts', [['gusts', 0]]), ('wind in a forest', [['gusts', 0], ['leaves', 0]]),
               ('dawn chorus', [['birds', 0, 6]]), ('birds at noon', [['birds', 0, 13]]), ('owl', [['owl', 0]]),
               ('grasshoppers', [['grasshopper', 0]]), ('cicadas', [['cicada', 0]]), ('frogs 3 m', [['frogs', 3]]),
               ('fireplace 2 m', [['fire', 2, 0.55]]), ('campfire 2 m', [['fire', 2, 1]]), ('bonfire 3 m', [['fire', 3, 2]]),
               ('town life', [['townLife', 0]])] + \
              [(f'room: {k}', [['roomTone', 0, k]]) for k in ('house', 'inn', 'library', 'lab', 'workshop', 'barn')] + \
              [(f'steps: {k}', [['steps', 0, k]]) for k in ('grass', 'sand', 'dirt', 'gravel', 'stone', 'wood', 'snow', 'mud', 'wet', 'carpet')]
# rows that are events (their loudest 3 s against the events' ceiling), not beds
LOUD_EVENTS = ('birds', 'steps (lawn)', 'thunder', 'dawn chorus', 'birds at noon', 'owl', 'grasshoppers', 'cicadas', 'frogs', 'town life', 'steps:')
LOUD_SCENES = [('Copperleaf square', [['sea_coast', 0], ['fountain', 3], ['townLife', 0], ['birds', 0]]),
               ('a route in rain', [['rain', 0], ['gusts', 0], ['leaves', 0]]), ('a meadow at night', [['crickets', 0], ['leaves', 0]])]
CEILING_BED, CEILING_EVENT = -12, -8   # LU under the route song (design rule 7: beds at least 12 under, events 8)
TARGET_LUFS, TARGET_WITHIN, TARGET_TP = -18, 1, -1   # SND-15: the music's loudness at default sliders and the peaks' ceiling


def loud_effects(pg):
    """SND-15: the effect rows: (name, [[s, effect, options]...], seconds): a cry of each base (the first species by id
    that has it), Kappi's and a townsperson's talk (a blip every 84 ms for 3 s, as talk.js types), the buttons, and
    VFX-19's battle sounds"""
    cries = pg.evaluate("Object.keys(MUSIC.cries.bases).map(b => [b, Object.keys(SPECIES).sort().find(s => cryRecipe(s, (SPECIES[s] || {}).cry, MUSIC.cries.bases).base === b)]).filter(x => x[1])")
    talk = [round(0.05 + i * 0.084, 3) for i in range(36)]
    rows = [(f'cry ({b}: {sp})', [[0.05, 'cry', {'sp': sp}]], 3) for b, sp in cries]
    rows += [(f'talk ({w})', [[t, 'blip', {'who': w}] for t in talk], 4) for w in ('kappi', 'folk3')]
    rows += [('buttons', [[0.05 + 0.4 * i, 'ui', u] for i, u in enumerate(['select', 'confirm', 'cancel', 'cant', 'sheet', 'toast'])], 3.5)]
    # VFX-19's battle sounds (music.json battle), each as heard alone (battleSoundPreviewPlay), on code that has them
    battle = pg.evaluate("typeof battleSoundPreviewPlay === 'function' && MUSIC.battle ? battleSoundNames(MUSIC.battle) : []")
    rows += [(f'battle {n}', [[0.05, 'battle', n]], 2.5) for n in battle]
    return rows
# SND-10: every water recipe (soundscape.json `water`) at 1, 3 and 10 m, a fall at its height; both ceilings apply (its
# bed's integrated level and its events' loudest 3 s)
WATER_AT = (1, 3, 10)
WATER_HEIGHT = {'fallSmall': 1.5, 'fallTall': 6, 'plunge': 6}


def loud_page(b, base):
    """a page of its own for loudness renders, the measure put in it; (context, page, its errors)"""
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_init_script(TEST_GLOBALS); ctx.add_init_script(NO_ACCOUNTS)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base + '/index.html')
    if not until(pg, "typeof soundEngine!=='undefined'&&typeof initSound==='function'&&typeof gameData!=='undefined'&&typeof initAmbience==='function'", 120):
        raise Exception('the game page never loaded its sound code')
    # SND-15: the loudness pages stop drawing too (SND-12c's NO_DRAW): their renders waited on the title's live scene,
    # drawn in software, between jobs; no number moves
    pg.evaluate(NO_DRAW)
    src = (ROOT / 'tools' / 'sound-loudness.mjs').read_text().replace('export function', 'function')
    pg.evaluate('(() => {' + src + '\nwindow.__soundLoudness = soundLoudness;})()')
    return ctx, pg, errs


def loudness(b, base, only=None):
    """the loudness report's lines (every song's day version, the world sounds), and its warnings"""
    ctx, pg, errs = loud_page(b, base)
    try:
        songs = [s for s in pg.evaluate("Object.keys(SONGS)") if not only or s in only or s == 'route']
        duck = pg.evaluate("Math.round(20*Math.log10(bedDuck(MUSIC.mix,true))*100)/100")
        water = pg.evaluate("typeof SOUNDSCAPE!=='undefined'&&SOUNDSCAPE.water?Object.keys(SOUNDSCAPE.water):[]")
        rows_w = [(f'{w} {d} m', [[w, d, WATER_HEIGHT.get(w, 0)]]) for w in water for d in WATER_AT]
        nature = LOUD_NATURE if pg.evaluate("typeof naturePreviewTick==='function'") else []   # SND-14
        # SND-11: each song whose day version names an ensemble, once more as its ensemble
        ens = pg.evaluate("Object.keys(SONGS).filter(s => { const D = trackerRecipe(SONGS, s, MUSIC.run); return D && D.ensemble && D.ensemble !== 'gb' && MUSIC.ensembles && MUSIC.ensembles[D.ensemble]; })") if pg.evaluate("typeof MUSIC !== 'undefined' && !!MUSIC.ensembles") else []
        ens = [s for s in ens if s in songs]
        # SND-17: each jingle naming an ensemble, as its 8-bit version and on its ensemble
        jens = pg.evaluate("typeof musicJingleParts === 'function' ? Object.keys(MUSIC.jingles).filter(j => { const J = MUSIC.jingles[j]; return J.ensemble && J.ensemble !== 'gb' && MUSIC.ensembles[J.ensemble]; }) : []")
        jens = [j for j in jens if not only or j in only]
        # SND-13: each ensemble's layers in play (musicParts' layer:<name> parts), against the ensemble as written
        lay = [(s, p) for s in ens for p in pg.evaluate("s => musicParts(s).filter(p => p.startsWith('layer:'))", s)]
        lay_jobs = [{'song': pg.evaluate("s => musicVariant(s, 1)", s) if p.endswith('@night') else s, 'ens': True, 'layers': p[6:].split('@')[0]} for s, p in lay]
        jobs = [{'song': s} for s in songs] + [{'song': s, 'ens': True} for s in ens] + lay_jobs + [{'beds': B} for _, B in LOUD_BEDS + nature + LOUD_SCENES + rows_w]
        res = []
        for i in range(0, len(jobs), 6):
            res += pg.evaluate(LOUD, {'jobs': jobs[i:i + 6], 'rate': RATE})
        if errs: raise Exception('page errors: ' + ' | '.join(errs[:3]))
    finally:
        ctx.close()
    # SND-17: the jingles on a page of their own (a page slows as its renders pile up, and their zones would push the
    # water's banks out of the bank); SND-15: and the effects (a cry of each base, talk, the buttons)
    ctx, pg, errs = loud_page(b, base)
    try:
        fx = loud_effects(pg)
        jobs = [{'jingle': j} for j in jens] + [{'jingle': j, 'ens': True} for j in jens] + [{'fx': F, 'len': n} for _, F, n in fx]
        for i in range(0, len(jobs), 6):
            res += pg.evaluate(LOUD, {'jobs': jobs[i:i + 6], 'rate': RATE})
        if errs: raise Exception('page errors: ' + ' | '.join(errs[:3]))
    finally:
        ctx.close()
    S = dict(zip(songs, res[:len(songs)]))
    SE = dict(zip(ens, res[len(songs):len(songs) + len(ens)]))
    SL = list(zip(lay, res[len(songs) + len(ens):len(songs) + len(ens) + len(lay)]))
    ref = S['route']['lufs']
    lines = [f'loudness at default sliders, stereo, K-weighted (LUFS; LU against the route song, {ref:.1f} LUFS; beds {duck:+.1f} dB under a song)',
             '  songs (day):']
    lines += [f'    {s:12} {L["lufs"]:7.1f} LUFS {L["lufs"] - ref:+6.1f} LU   max 3 s {L["short"]:6.1f}   peak {L["peak"]:6.1f} dBFS {L.get("tp", 0):6.1f} dBTP   LRA {L.get("lra", 0):4.1f}' for s, L in sorted(S.items(), key=lambda x: -x[1]['lufs'])]
    if SE:
        lines.append('  songs (SND-11: as their ensemble, against their gb version):')
        lines += [f'    {s:12} {L["lufs"]:7.1f} LUFS {L["lufs"] - ref:+6.1f} LU   max 3 s {L["short"]:6.1f}   peak {L["peak"]:6.1f} dBFS {L.get("tp", 0):6.1f} dBTP   LRA {L.get("lra", 0):4.1f}   {L["lufs"] - S[s]["lufs"]:+5.1f} LU on gb' for s, L in SE.items()]
    if SL:
        lines.append('  songs (SND-13: each layer in play, against the ensemble as written):')
        lines += [f'    {s + " " + p:28} {L["lufs"]:7.1f} LUFS {L["lufs"] - ref:+6.1f} LU   peak {L["peak"]:6.1f} dBFS {L.get("tp", 0):6.1f} dBTP   {L["lufs"] - SE[s]["lufs"]:+5.1f} LU on the ensemble' for (s, p), L in SL]
    warn = [f'{s} {p}: NaN in the render' for (s, p), L in SL if L.get('nan')]
    if jens:
        J0, J1 = res[len(res) - len(fx) - 2 * len(jens):len(res) - len(fx) - len(jens)], res[len(res) - len(fx) - len(jens):len(res) - len(fx)]
        lines.append('  jingles (SND-17: on their ensemble, against their 8-bit version):')
        lines += [f'    {j:12} {b["lufs"]:7.1f} LUFS {b["lufs"] - ref:+6.1f} LU   peak {b["peak"]:6.1f} dBFS {b.get("tp", 0):6.1f} dBTP   {b["lufs"] - a["lufs"]:+5.1f} LU on the 8-bit ({a["lufs"]:.1f})' for j, a, b in zip(jens, J0, J1)]
        warn += [f'jingle {j}: NaN in the render' for j, b in zip(jens, J1) if b.get('nan')]
    if fx:
        lines.append('  effects (SND-15: a cry of each base, talk, the buttons; the loudest 3 s against the route song):')
        lines += [f'    {n:20} {L["short"] - ref:+6.1f} LU   max 3 s {L["short"]:6.1f} LUFS   peak {L["peak"]:6.1f} dBFS {L.get("tp", 0):6.1f} dBTP' for (n, _, _), L in zip(fx, res[len(res) - len(fx):])]
        warn += [f'{n}: NaN in the render' for (n, _, _), L in zip(fx, res[len(res) - len(fx):]) if L.get('nan')]
    # SND-15: the targets: the music near -18 LUFS at default sliders (the route song as its ensemble), every true peak
    # under -1 dBTP
    R = SE.get('route', S['route'])
    lines.insert(1, f'  target: the route song {R["lufs"]:.1f} LUFS (as it plays, {TARGET_LUFS} wanted, within {TARGET_WITHIN}); true peaks under {TARGET_TP} dBTP')
    if abs(R['lufs'] - TARGET_LUFS) > TARGET_WITHIN: warn.append(f'the route song at {R["lufs"]:.1f} LUFS, not within {TARGET_WITHIN} of {TARGET_LUFS}')
    for what, D in (('song', S), ('ensemble', SE)):
        warn += [f'{what} {k}: true peak {L["tp"]:.1f} dBTP, over {TARGET_TP}' for k, L in D.items() if L.get('tp', -99) > TARGET_TP]
    if jens: warn += [f'jingle {j}: true peak {L["tp"]:.1f} dBTP, over {TARGET_TP}' for j, L in zip(jens, J0 + J1) if L.get('tp', -99) > TARGET_TP]
    at = len(songs) + len(ens) + len(lay)
    for title, rows in (('world sounds', LOUD_BEDS), ('nature (SND-14)', nature), ('scenes', LOUD_SCENES), ('water (SND-10: each recipe at 1, 3 and 10 m)', rows_w)):
        if not rows: continue
        lines.append(f'  {title}:')
        for (name, B), L in zip(rows, res[at:at + len(rows)]):
            lu, mx = L['lufs'] + duck - ref, L['short'] + duck - ref
            event = name.startswith(LOUD_EVENTS)
            lines.append(f'    {name:20} {lu:+6.1f} LU   max 3 s {mx:+6.1f}   phone band {L["phone"] + duck:6.1f} dB   2-6 kHz {L["share"] * 100:4.0f} %   peak {L["peak"] + duck:6.1f}')
            if L.get('nan'): warn.append(f'{name}: NaN in the render')
            if title in ('world sounds', 'nature (SND-14)') and (mx if event else lu) > (CEILING_EVENT if event else CEILING_BED):
                warn.append(f'{name}: {(mx if event else lu):+.1f} LU, over the ceiling of {CEILING_EVENT if event else CEILING_BED} LU')
            if title.startswith('nature') and not event and mx > CEILING_EVENT:
                warn.append(f'{name}: its loudest 3 s {mx:+.1f} LU, over the event ceiling of {CEILING_EVENT} LU')
            if title.startswith('water'):
                if lu > CEILING_BED: warn.append(f'{name}: {lu:+.1f} LU, over the bed ceiling of {CEILING_BED} LU')
                if mx > CEILING_EVENT: warn.append(f'{name}: its loudest 3 s {mx:+.1f} LU, over the event ceiling of {CEILING_EVENT} LU')
        at += len(rows)
    return lines, warn


def render_all(pg, only=None):
    """{file name: {part: [rms, ...]}} for every song (day and night), jingle, cry (and its low-HP version), UI sound and (VFX-19) battle sound"""
    N = pg.evaluate("({ songs: Object.keys(SONGS), jingles: Object.keys(JINGLES), cries: (gameData.lines || []).flatMap(L => L.names.map((n, i) => L.id + i)),"
                    " jens: typeof musicJingleParts === 'function' ? Object.keys(JINGLES).filter(j => { const J = MUSIC.jingles[j]; return J && J.ensemble && J.ensemble !== 'gb' && MUSIC.ensembles && MUSIC.ensembles[J.ensemble]; }) : [],"
                    " low: typeof cryPlay === 'function', ui: typeof uiSound === 'function' && typeof UI_SOUND_NAMES !== 'undefined' ? UI_SOUND_NAMES : [],"
                    " battle: typeof battleSoundPreviewPlay === 'function' && MUSIC.battle ? battleSoundNames(MUSIC.battle) : [],"
                    " parts: Object.fromEntries(Object.keys(SONGS).map(s => [s, ['day', 'night'].concat(typeof musicParts === 'function' ? musicParts(s) : [])])) })")
    keep = lambda n: not only or n in only
    jobs = [(s, p, {'kind': 'song', 'name': s, 'night': p == 'night', 'part': p}) for s in N['songs'] if keep(s) for p in N['parts'][s]]
    jobs += [(file, n, {'kind': kind, 'name': n, 'night': False}) for kind, file in (('jingle', 'jingles'), ('cry', 'cries'), ('ui', 'ui'), ('battle', 'battle')) for n in N[file] if keep(n)]
    # SND-17: each jingle naming an ensemble, once more on it (GB Sounds off, its notes baked first), beside it in jingles.json
    jobs += [('jingles', n + '@ensemble', {'kind': 'jingle', 'name': n, 'night': False, 'part': 'ensemble'}) for n in N['jens'] if keep(n)]
    # SND-6: each cry's low-HP version, beside it in cries.json
    if N['low']: jobs += [('cries', n + '@low', {'kind': 'cry', 'name': n, 'night': False, 'part': 'low'}) for n in N['cries'] if keep(n)]
    out = {}
    for i in range(0, len(jobs), 12):   # in batches, so a page never holds every render at once
        part = jobs[i:i + 12]
        res = pg.evaluate(RENDER, {'jobs': [j[2] for j in part], 'rate': RATE, 'win': WINDOW})
        for (file, key, _), (r, zc) in zip(part, res):
            out.setdefault(file, {})[key] = r
            out[file][ZC + key] = zc   # SND-9: the brightness, beside the RMS
    return out


def differences(now, only=None):
    """what changed against the baseline, as short lines; and (SND-9) how many brightness arrays the baseline lacks"""
    bad, missing = [], 0
    for file, parts in now.items():
        f = BASE / f'{file}.json'
        if not f.exists(): bad.append(f'{file}: not in the baseline'); continue
        was = json.loads(f.read_text())
        for part, a in parts.items():
            b = was.get(part)
            bright = part.startswith(ZC)
            if b is None and bright: missing += 1; continue
            if b is None: bad.append(f'{file} {part}: not in the baseline'); continue
            if len(a) != len(b): bad.append(f'{file} {part}: {len(a)} windows, the baseline has {len(b)}'); continue
            rel, tol = (ZC_REL, ZC_ABS) if bright else (REL, ABS)
            off = [i for i, (x, y) in enumerate(zip(a, b)) if abs(x - y) > max(tol, rel * max(x, y))]
            if off:
                i = off[0]; bad.append(f'{file} {part}: {len(off)} of {len(a)} windows differ, first at {i * WINDOW:.2f} s ({b[i]} -> {a[i]})')
    if not only:
        gone = sorted(p.stem for p in BASE.glob('*.json') if p.stem not in now)
        bad += [f'{g}: in the baseline, not rendered now' for g in gone]
    return bad, missing


def run(b, base, write=False, only=None):
    """renders on a page of the browser b served at base; returns (problems, a summary line)"""
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_init_script(TEST_GLOBALS); ctx.add_init_script(NO_ACCOUNTS)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html')
        if not until(pg, "typeof soundEngine!=='undefined'&&typeof initSound==='function'&&typeof gameData!=='undefined'", 120):
            raise Exception('the game page never loaded its sound code')
        pg.evaluate(NO_DRAW)
        t = time.time(); now = render_all(pg, only); dt = round(time.time() - t, 1)
        count = sum(1 for p in now.values() for k in p if not k.startswith(ZC))
        if write:
            BASE.mkdir(parents=True, exist_ok=True)
            for file, parts in now.items():
                (BASE / f'{file}.json').write_text(json.dumps(parts, separators=(',', ':')) + '\n')
            return [], f'wrote {count} fingerprints with their brightness in {len(now)} files ({dt} s)'
        bad, missing = differences(now, only)
        note = f'; brightness not in the baseline for {missing} (write it with --baseline)' if missing else ', with brightness'
        return bad, f'{count} fingerprints{note}, {len(bad)} changed ({dt} s)'
    finally:
        ctx.close()


def main():
    import subprocess
    from playwright.sync_api import sync_playwright
    args = sys.argv[1:]
    only = next((a.split('=', 1)[1].split(',') for a in args if a.startswith('--only=')), None)
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True, capture_output=True)
    srv, base = serve(GAME)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        report = None
        try:
            bad, line = run(b, base, '--baseline' in args, only)
            if '--loudness' in args: report = loudness(b, base, only)
        finally:
            b.close()
    srv.shutdown()
    print(line)
    for x in bad[:40]: print('  CHANGED', x)
    if '--loudness' in args:
        print('\n'.join(report[0]))
        for w in report[1]: print('  WARN', w)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
