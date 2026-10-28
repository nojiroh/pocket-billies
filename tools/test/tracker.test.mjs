// Sound track SND-3: the tracker's composer (game/js/audio/tracker.js trackerCompose) with a written hook and a
// countermelody. With neither, a song composes as before (the fingerprints, tools/check-sound.py, hold the sound).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// the tracker is a page module, not logic: it exports only what pages import, so its composer is read through the
// test globals (game/js/test-globals.js), turned on before it loads
globalThis.window = globalThis;
globalThis.PB_TEST_GLOBALS = true;
await import('../../game/js/audio/tracker.js');
const { trackerArc, trackerCompose, trackerCreate, trackerNight, trackerRecipe, trackerTense } = /** @type {any} */ (
  globalThis
);

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
// town's recipe without its written lines (SND-4 gave it a placeholder hook): the tests write their own
const town = Object.fromEntries(
  Object.entries(MUSIC.songs.town).filter(([k]) => !['hook', 'counter', 'hookName'].includes(k))
);

test('an empty hook and counter change nothing', () => {
  const a = trackerCompose(town),
    b = trackerCompose({ ...town, hook: [], counter: [] });
  assert.deepEqual(b.notes, a.notes);
  assert.ok(b.counterNotes.every(n => n === null));
});

test('a hook takes bars 1-2 and their repeat in bars 5-6; bars 3-4 answer it; 7-8 stay', () => {
  const hook = [
    [0, 72, 4],
    [4, 74, 4],
    [8, 76, 8],
    [16, 79, 16],
    [40, 60, 4],
  ];
  const a = trackerCompose(town),
    b = trackerCompose({ ...town, hook });
  const at = (C, from, to) =>
    C.notes
      .slice(from, to)
      .map((n, i) => (n ? [from + i, ...n] : null))
      .filter(Boolean);
  const want = [
    [0, 72, 4],
    [4, 74, 4],
    [8, 76, 8],
    [16, 79, 16],
  ];
  assert.deepEqual(at(b, 0, 32), want, 'a note past bar 2 is left out');
  assert.deepEqual(
    at(b, 64, 96),
    want.map(([s, m, l]) => [s + 64, m, l])
  );
  assert.deepEqual(b.notes.slice(96), a.notes.slice(96));
  /* SND-4: bars 3-4 keep the hook's rhythm, each note on the nearest tone of the bar's chord (town: bar 3 is IV, F A C
     in C; bar 4 is V, G B D) */
  assert.deepEqual(at(b, 32, 64), [
    [32, 72, 4],
    [36, 72, 4],
    [40, 77, 8],
    [48, 79, 16],
  ]);
});

test('bars 3-4 answer a hook already on the new chord with the same note; a tie goes down', () => {
  /* town bar 3 is IV (F A C): C stays C; G is as near F as A, and goes down to F */
  const b = trackerCompose({
    ...town,
    hook: [
      [0, 72, 8],
      [8, 67, 8],
    ],
  });
  assert.deepEqual(b.notes[32], [72, 8]);
  assert.deepEqual(b.notes[40], [65, 8]);
});

test('a countermelody sits beside the lead in bars 1-2, answers in 3-4, again in 5-6', () => {
  const b = trackerCompose({ ...town, counter: [[2, 64, 6]] });
  assert.deepEqual(b.counterNotes[2], [64, 6]);
  assert.deepEqual(b.counterNotes[66], [64, 6]);
  assert.equal(b.counterNotes.filter(Boolean).length, 3, 'bars 1-2, the answer in 3-4, the repeat in 5-6');
  assert.deepEqual(b.counterNotes[34], [65, 6], 'E answers on F, the nearest tone of town bar 3 (IV: F A C)');
  assert.deepEqual(b.notes, trackerCompose(town).notes);
  assert.deepEqual(b.counterBars, [true, false, true, false, true, false, false, false]);
});

test('the composer does not change the recipe it is given', () => {
  const R = structuredClone({ ...town, hook: [[0, 72, 4]] });
  trackerCompose(R);
  assert.deepEqual(R, { ...town, hook: [[0, 72, 4]] });
});

test('the night version: written changes win; with none, 8 bpm slower, a fourth down, soft drums', () => {
  const n = trackerNight(town);
  assert.equal(n.bpm, town.bpm - 8);
  assert.equal(n.key, town.key - 5);
  assert.equal(n.drums, 'soft');
  assert.equal('night' in n, false);
  assert.equal(trackerNight({ ...MUSIC.songs.cave, night: undefined }).drums, 'none', 'no drums stay none');
  const w = trackerNight({ ...town, night: { bpm: 90 } });
  assert.equal(w.bpm, 90);
  assert.equal(w.key, town.key, 'a written night changes only what it names');
  assert.equal(trackerNight({ ...town, night: false }), null);
});

test('at night a written hook and counter move with the key', () => {
  const n = trackerNight({ ...town, hook: [[0, 72, 4]], counter: [[0, 64, 4]] });
  assert.deepEqual(n.hook, [[0, 67, 4]]);
  assert.deepEqual(n.counter, [[0, 59, 4]]);
  assert.equal(trackerNight(town).hook, undefined);
});

// SND-5: intros and the drums held until the throw
test('an intro lasts the bars its notes reach (one or two), and only steps 0-31 count', () => {
  assert.equal(trackerCompose(town).introSteps, 0);
  const a = trackerCompose({
    ...town,
    intro: [
      [0, 76, 2],
      [14, 64, 2],
    ],
  });
  assert.equal(a.introSteps, 16);
  assert.deepEqual(a.introNotes[0], [76, 2]);
  const b = trackerCompose({
    ...town,
    intro: [
      [0, 76, 2],
      [30, 64, 6],
      [40, 60, 2],
    ],
  });
  assert.equal(b.introSteps, 32);
  assert.deepEqual(b.introNotes[30], [64, 2], "a note is cut at the intro's end");
  assert.deepEqual(trackerCompose({ ...town, intro: [[0, 76, 2]] }).notes, trackerCompose(town).notes);
});

test('trackerRecipe: the song, its night version, null for what does not exist', () => {
  const songs = { town };
  assert.equal(trackerRecipe(songs, 'town'), town);
  assert.deepEqual(trackerRecipe(songs, 'town@night'), trackerNight(town));
  assert.equal(trackerRecipe(songs, 'nosuch'), null);
  assert.equal(trackerRecipe(songs, 'town@nosuch'), null);
  assert.equal(trackerRecipe({ town: { ...town, night: false } }, 'town@night'), null);
});

/** a context that does nothing: every node and param takes any call; the clock is set by hand */
function fakeContext() {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() });
  const c = new Proxy(
    { currentTime: 0, sampleRate: 8000 },
    {
      get: (t, k) =>
        k in t ? t[k] : k === 'createBuffer' ? () => ({ getChannelData: () => new Float32Array(8) }) : any(),
    }
  );
  return c;
}
/** what a song plays over its first `steps` steps: [step, voice] (lead, drum) */
function playFor(D, o, steps, after) {
  const c = fakeContext(),
    T = trackerCreate(c, {}, { songs: { s: D } }),
    out = [];
  let step = 0;
  T.synthVoice = (bus, v) => out.push([T.song.step, 'voice', v.type]);
  T.synthNoise = () => out.push([T.song.step, 'drum']);
  T.synthKick = () => out.push([T.song.step, 'drum']);
  T.play('s', o);
  clearInterval(T.timer);
  const spb = 60 / D.bpm / 4;
  for (; step < steps; step++) {
    if (after && step === after.at) after.do(T);
    c.currentTime = T.song.next - 0.13;
    T.tick();
  }
  return out;
}

test('with an intro asked for, the intro plays first on the lead alone, then the song from its start', () => {
  const D = {
      ...town,
      drums: 'drive',
      intro: [
        [0, 76, 1],
        [1, 75, 1],
        [2, 74, 1],
      ],
    },
    out = playFor(D, { intro: true }, 20);
  const intro = out.filter(([st]) => st < 0);
  assert.equal(intro.length, 3, 'three intro notes, nothing else');
  assert.ok(intro.every(([, k, type]) => k === 'voice' && type === D.lead));
  assert.ok(
    out.some(([st, k]) => st >= 0 && k === 'drum'),
    'the drums come with the song'
  );
  assert.ok(!playFor(D, {}, 4).some(([st]) => st < 0), 'no intro unless asked');
});

test('held drums stay out until drumsIn (the throw)', () => {
  const D = { ...town, drums: 'drive' };
  assert.ok(!playFor(D, { hold: true }, 24).some(([, k]) => k === 'drum'));
  const out = playFor(D, { hold: true }, 24, { at: 8, do: T => T.drumsIn() });
  assert.ok(out.some(([, k]) => k === 'drum'));
  assert.ok(!out.some(([st, k]) => k === 'drum' && st < 8));
});

test('the tense version (the red zone): written changes win; with none, 16 bpm faster, march drums, the pedal bass', () => {
  const w = MUSIC.songs.wild,
    t = trackerTense(w);
  assert.equal(t.bpm, w.bpm + 16);
  assert.equal(t.drums, 'march');
  assert.equal(t.bass, 'pedal');
  assert.equal(t.key, w.key);
  assert.deepEqual(t.hook, w.hook, 'the hook stays');
  assert.equal(
    trackerTense({ ...w, tense: { bpm: 170 } }).drums,
    w.drums,
    'a written tense changes only what it names'
  );
  assert.equal(trackerTense({ ...w, tense: false }), null);
  assert.deepEqual(trackerRecipe({ wild: w }, 'wild@tense'), t);
});

test('a song that takes over a held one keeps the drums out until the throw', () => {
  const c = fakeContext(),
    T = trackerCreate(c, {}, { songs: { a: { ...town, drums: 'drive' }, b: { ...town, drums: 'drive', bpm: 120 } } });
  T.play('a', { hold: true });
  T.play('b');
  clearInterval(T.timer);
  assert.ok(T.song.hold);
  T.drumsIn();
  assert.equal(T.song.hold, 0);
});

test('the run arc: a band changes the recipe; arc: false leaves it; parts stack (meadow@late@night)', () => {
  const band = { name: 'late', row: [6, 8], changes: { drums: 'march', arpOctave: 1, counterAuto: true } },
    run = { arc: [band] },
    m = MUSIC.songs.meadow;
  const a = trackerArc(m, band);
  assert.equal(a.drums, 'march');
  assert.equal(a.arpOctave, 1);
  assert.equal(trackerArc({ ...m, arc: false }, band).drums, m.drums);
  assert.deepEqual(trackerRecipe({ meadow: m }, 'meadow@late', run), a);
  assert.deepEqual(trackerRecipe({ meadow: m }, 'meadow@late@night', run), trackerNight(a));
  assert.equal(trackerRecipe({ meadow: m }, 'meadow@nosuch', run), null);
  assert.equal(trackerRecipe({ meadow: m }, 'meadow@late'), null, 'no arc given, no band');
});

test('counterAuto: a counter from the hook, each note a chord tone at least a third below; a written counter wins', () => {
  const hook = [
      [0, 72, 4],
      [16, 76, 4],
    ],
    D = trackerCompose({ ...town, hook, counterAuto: true });
  for (const st of [0, 16]) {
    const [c] = D.counterNotes[st],
      h = D.notes[st][0];
    assert.ok(c <= h - 3 && c > h - 15, `step ${st}: ${c} under ${h}`);
    const ch = town.prog[st / 16],
      tones = [0, 2, 4].map(x => D.deg(ch + x) % 12);
    assert.ok(tones.includes(c % 12), `step ${st}: ${c} is a chord tone`);
  }
  const w = trackerCompose({ ...town, hook, counter: [[0, 60, 4]], counterAuto: true });
  assert.deepEqual(w.counterNotes[0], [60, 4]);
  assert.ok(
    trackerCompose({ ...town, counterAuto: true }).counterNotes.every(n => n === null),
    'no hook, no counter'
  );
});

test('restart starts a playing song again (a new battle with the same song); without it the song plays on', () => {
  const c = fakeContext(),
    T = trackerCreate(c, {}, { songs: { a: { ...town, intro: [[0, 76, 4]] } } });
  const first = T.play('a');
  assert.equal(T.play('a', { intro: true }), first);
  const again = T.play('a', { intro: true, hold: true, restart: true });
  clearInterval(T.timer);
  assert.notEqual(again, first);
  assert.equal(again.step, -16, 'from its intro');
  assert.ok(again.hold);
});

test('SND-8b: a song with echo 0 sends nothing to the echo; one with none written sends 0.15', () => {
  const leadEcho = D => {
    const c = fakeContext(),
      T = trackerCreate(c, {}, { songs: { s: D } }),
      out = [];
    T.synthVoice = (bus, v) => v.type === D.lead && out.push(v.echo);
    T.synthNoise = T.synthKick = () => {};
    T.play('s');
    clearInterval(T.timer);
    for (let i = 0; i < 32; i++) {
      c.currentTime = T.song.next - 0.13;
      T.tick();
    }
    return [...new Set(out)];
  };
  const plain = { ...town };
  delete plain.echo;
  assert.deepEqual(leadEcho({ ...town, echo: 0 }), [0]);
  assert.deepEqual(leadEcho(plain), [0.15]);
});

/** a context whose gains record what is scheduled on them: [method, value, time] */
function recordingContext() {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() }),
    gains = [];
  const param = () => {
    const p = { value: 0, calls: [] };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues', 'setTargetAtTime'])
      p[m] = (...a) => p.calls.push([m, ...a]);
    return p;
  };
  const c = new Proxy(
    { currentTime: 0, sampleRate: 8000, gains },
    {
      get: (t, k) =>
        k in t
          ? t[k]
          : k === 'createBuffer'
            ? () => ({ getChannelData: () => new Float32Array(8) })
            : k === 'createGain'
              ? () => {
                  const g = { gain: param(), to: [], connect: n => g.to.push(n), disconnect: () => (g.to = []) };
                  gains.push(g);
                  return g;
                }
              : any(),
    }
  );
  return c;
}

test("SND-8b: a song's echo send moves with its fader (the fade-in, a jingle's duck, a stop)", () => {
  const c = recordingContext(),
    T = trackerCreate(c, {}, { songs: { s: town } }),
    sg = T.play('s');
  clearInterval(T.timer);
  assert.ok(sg.echo.to.includes(T.echoIn), 'the send goes to the echo');
  const moves = n => n.gain.calls.map(([m, v]) => [m, v]);
  assert.deepEqual(moves(sg.echo), moves(sg.gain), 'the fade-in');
  assert.deepEqual(moves(sg.gain).at(-1), ['linearRampToValueAtTime', 1]);
  T.jingle([[72, 4]], 150, 'p25', {});
  assert.deepEqual(moves(sg.echo), moves(sg.gain), 'the duck');
  assert.ok(moves(sg.echo).some(([m, v]) => m === 'linearRampToValueAtTime' && v === 0.15));
  T.stop();
  assert.deepEqual(moves(sg.echo), moves(sg.gain), 'the stop');
  assert.deepEqual(moves(sg.echo).at(-1), ['linearRampToValueAtTime', 0]);
  // the song's voices send their echo to the song's send, not straight to the echo
  const c2 = fakeContext(),
    T2 = trackerCreate(c2, {}, { songs: { s: town } }),
    to = [];
  T2.synthVoice = (bus, v) => v.echo && to.push(v.echoTo);
  T2.synthNoise = T2.synthKick = () => {};
  const sg2 = T2.play('s');
  clearInterval(T2.timer);
  for (let i = 0; i < 32; i++) {
    c2.currentTime = T2.song.next - 0.13;
    T2.tick();
  }
  assert.ok(to.length && to.every(n => n === sg2.echo));
});

test("SND-8b: a jingle echoes on the effects' own echo; on the music bus (Settings' test) on the music's", () => {
  const c = recordingContext(),
    music = { name: 'music' },
    fx = { name: 'fx' },
    T = trackerCreate(c, music, { fx }),
    to = [];
  assert.ok(T.echoFx && T.echoFx !== T.echoIn);
  T.synthVoice = (bus, v) => v.echo && to.push(v.echoTo);
  T.jingle([[72, 4]], 150, 'p25', fx);
  T.jingle([[72, 4]], 150, 'p25', music);
  assert.deepEqual(to, [T.echoFx, T.echoIn]);
  assert.equal(trackerCreate(recordingContext(), music).echoFx, null, 'no effects bus, no effects echo');
});

test("SND-8b: a song's trim (dB) is its fader's top; a jingle ducks it to 0.15 of that; none written is exactly 1", () => {
  const c = recordingContext(),
    T = trackerCreate(c, {}, { songs: { up: { ...town, trim: 6 }, plain: town } }),
    tops = n => n.gain.calls.filter(([m]) => m === 'linearRampToValueAtTime').map(([, v]) => Math.round(v * 1e4) / 1e4);
  const sg = T.play('up');
  clearInterval(T.timer);
  const lv = Math.round(Math.pow(10, 6 / 20) * 1e4) / 1e4;
  assert.deepEqual(tops(sg.gain), [lv]);
  T.jingle([[72, 4]], 150, 'p25', {});
  assert.deepEqual(tops(sg.echo), [lv, Math.round(0.15 * lv * 1e4) / 1e4, Math.round(0.15 * lv * 1e4) / 1e4, lv]);
  const p = T.play('plain');
  clearInterval(T.timer);
  assert.equal(p.level, 1);
  assert.equal(trackerNight({ ...town, trim: 6 }).trim, 6, 'the night version keeps it');
});

/** a context that makes real buffers and records the sources and gains it makes (the bank's tests) */
function bankContext(rate) {
  const made = { sources: [], gains: [] },
    param = () => {
      const p = { value: 0, calls: [] };
      for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues', 'setTargetAtTime'])
        p[m] = (...a) => p.calls.push([m, ...a]);
      return p;
    },
    node = () => ({
      to: [],
      connect(n) {
        this.to.push(n);
      },
      disconnect() {},
    });
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() });
  const t = {
    currentTime: 0,
    sampleRate: rate,
    made,
    createBuffer: (ch, n, r) => {
      const d = Array.from({ length: ch }, () => new Float32Array(n));
      return { length: n, sampleRate: r, getChannelData: i => d[i], copyToChannel: (a, i) => d[i].set(a) };
    },
    createBufferSource: () => {
      const s = {
        ...node(),
        playbackRate: param(),
        started: null,
        start: at => (s.started = at),
        stop: at => (s.stopped = at),
      };
      made.sources.push(s);
      return s;
    },
    createGain: () => {
      const g = { ...node(), gain: param() };
      made.gains.push(g);
      return g;
    },
  };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : any()) });
}
const { soundBakeBank, SOUND_BAKE_BUDGET } = /** @type {any} */ (globalThis);

test('SND-9: the bank bakes in slices, once per rate; bankReady resolves when every zone is in', async () => {
  const c = bankContext(22050),
    T = trackerCreate(c, {}, {}),
    slices = soundBakeBank.slices;
  await T.bankReady('harp');
  const E = soundBakeBank.entries.get('harp@22050');
  assert.ok(E.zones.every(Boolean));
  assert.ok(soundBakeBank.slices - slices > 1, 'more than one slice');
  for (const z of E.zones) assert.equal(z.buffer.sampleRate, 22050, "a buffer at the context's own rate");
  /* a second context at the same rate bakes nothing again */
  const zones = soundBakeBank.zones,
    T2 = trackerCreate(bankContext(22050), {}, {});
  await T2.bankReady(['harp']);
  assert.equal(soundBakeBank.zones, zones);
  /* the stats say what the debug log needs */
  const S = T.bankStats();
  assert.ok(S.instruments.includes('harp@22050 10/10'));
  assert.ok(S.slices > 0 && S.sliceMaxMs >= 0 && S.lastSlicesMs.length > 0 && S.mb > 0);
  /* an instrument that doesn't exist is null, not an error */
  assert.deepEqual(await T.bankReady('nothing'), [null]);
});

test('SND-9: sampleVoice is one buffer source and one gain, the nearest zone moved to the note, its loop held', async () => {
  const c = bankContext(16000),
    T = trackerCreate(c, {}, {}),
    out = {};
  assert.equal(T.sampleVoice(out, { inst: 'harp', midi: 60, t: 0, dur: 1 }), null, 'nothing baked yet');
  await T.bankReady('harp');
  const s0 = c.made.sources.length,
    g0 = c.made.gains.length,
    started = T.started,
    v = T.sampleVoice(out, { inst: 'harp', midi: 61, t: 1, dur: 2, vol: 0.3 });
  assert.equal(c.made.sources.length - s0, 1);
  assert.equal(c.made.gains.length - g0, 1);
  assert.equal(T.started, started + 1);
  const E = soundBakeBank.entries.get('harp@16000'),
    Z = E.zones.find(z => z.lo <= 61 && z.hi >= 61);
  assert.equal(v.source.buffer, Z.buffer);
  assert.ok(Math.abs(v.source.playbackRate.value - Math.pow(2, (61 - Z.root) / 12)) < 1e-12);
  assert.ok(v.source.loop && v.source.loopStart === Z.loopStart && v.source.loopEnd === Z.loopEnd);
  assert.deepEqual(v.source.to, [v.gain]);
  assert.deepEqual(v.gain.to, [out]);
  assert.equal(v.source.started, 1);
  assert.ok(v.source.stopped > 3);
  /* the gain: its level, then the pluck's tail once the loop starts, then the release at the note's end */
  const calls = v.gain.gain.calls;
  assert.deepEqual(calls[0], ['setValueAtTime', 0.3, 1]);
  assert.equal(calls.at(-1)[0], 'setTargetAtTime');
  assert.equal(calls.at(-1)[2], 3);
});

test('SND-9: past the budget the least recently played zone goes; a note there plays from the nearest and bakes it again', async () => {
  /* the earlier tests' zones are older than these: only this test's count */
  soundBakeBank.entries.clear();
  const c = bankContext(12000),
    T = trackerCreate(c, {}, {});
  await T.bankReady('harp');
  const E = soundBakeBank.entries.get('harp@12000');
  /* play every zone but the lowest, so the lowest is the one played longest ago */
  for (const z of E.zones.slice(1)) T.sampleVoice({}, { inst: 'harp', midi: z.root, t: 0, dur: 0.1 });
  const other = soundBakeBank.other,
    low = E.zones[0];
  const bank = () =>
    [...soundBakeBank.entries.values()].reduce((a, e) => a + e.zones.reduce((b, z) => b + (z ? z.bytes : 0), 0), 0);
  try {
    /* the other buffers fill the budget but for less than the bank holds: something must go */
    const room = SOUND_BAKE_BUDGET - bank() + 1;
    soundBakeBank.other = () => room;
    const dropped = soundBakeBank.dropped;
    /* baking one more zone (a fresh rate's single zone) prunes */
    E.zones[E.zones.length - 1] = null;
    await T.bankReady('harp');
    assert.ok(soundBakeBank.dropped > dropped);
    assert.equal(E.zones[0], null, 'the least recently played zone went');
    soundBakeBank.other = () => 0;
    const v = T.sampleVoice({}, { inst: 'harp', midi: low.root, t: 0, dur: 0.1 });
    assert.ok(v && v.source.buffer !== low.buffer, 'the nearest zone left plays it');
    await T.bankReady('harp');
    assert.ok(E.zones[0], 'and the dropped zone is baked again');
  } finally {
    soundBakeBank.other = other;
  }
});
