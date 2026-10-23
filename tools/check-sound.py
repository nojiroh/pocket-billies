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
sound.js musicParts names for it ('tense' for a battle song, 'mid', 'late' and 'deadline' for a run's songs), each as
long as the recipe that plays (tracker.js trackerRecipe). On code without them, only day and night.

SND-6: a species' cry also renders its low-HP version ('<id>@low', when sound.js has cryPlay), the four UI sounds
render into ui.json (when sound.js has uiSound), and a jingle renders at its own tempo and wave as the game plays it
(sound.js jinglePlay, music.json jingles' bpm and wave); on code without them, as before.

A window may differ by 1% (or 0.0001) before it counts as changed. The baseline is committed: SND-4 and SND-5 write it
again on purpose, like the picture baseline."""
import json, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game'
BASE = ROOT / 'validation' / 'sound-baseline'
RATE = 44100
WINDOW = 0.05
REL, ABS = 0.01, 1e-4

# runs in the page. Works on the code before and after the tracker split: it only uses sound.js's initSound, music,
# jingle, soundEffect, soundEngine, SONGS and JINGLES, plus the tick (sound.js's musicTick, or the tracker's tick)
RENDER = r"""async ({jobs, rate, win}) => {
  const songs = SONGS, jingles = JINGLES;   /* sound.js's names: the songs' recipes, the jingles' note lists */
  const real = Math.random, AC = window.AudioContext, E = soundEngine;
  /* each job is scheduled alone (with Math.random seeded the same), then all of them render at once */
  const schedule = ({kind, name, night, part}) => {
    let seed = 0x5eed;
    Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let len = 1, spb = 0;
    /* SND-4: at night the game asks for the song's night version (sound.js musicVariant), which can be slower: the
       render is as long as the recipe that plays (tracker.js trackerNight) */
    const extra = part && part !== 'day' && part !== 'night' && part !== 'intro',
      play = extra ? name + '@' + part : kind === 'song' && night && typeof musicVariant === 'function' ? musicVariant(name, 1) : name;
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
      len = 0.05 + jingles[name].reduce((a, [, l]) => a + l, 0) * 60 / bpm / 4 + 1.2; }
    const oc = new OfflineAudioContext(1, Math.ceil(len * rate), rate);
    let now = 0;
    Object.defineProperty(oc, 'currentTime', { get: () => now, configurable: true });
    Object.defineProperty(oc, 'state', { get: () => 'running', configurable: true });
    if (E.timer) clearInterval(E.timer);
    Object.assign(E, { ctx: null, waves: {}, song: null, want: null, timer: null, voices: [], jingle: 0,
      L: { drums: 1, pad: night ? 1 : 0 } });
    window.AudioContext = function () { return oc; };
    try {
      if (!initSound()) throw new Error('initSound failed on the offline context');
      if (kind === 'song') {
        if (part === 'intro') music(play, { intro: true }); else music(play);
        if (!E.song) throw new Error('no song started for ' + play);
        now = 0.08 + (steps - 0.5) * spb - 0.14;
        if (typeof musicTick === 'function') musicTick(); else E.tracker.tick();
      } else if (kind === 'jingle') { if (typeof jinglePlay === 'function') jinglePlay(name); else jingle(jingles[name]); }
      else if (kind === 'ui') uiSound(name);
      else if (part === 'low') cryPlay(name, true);
      else soundEffect('cry', { sp: name });
    } finally {
      if (E.timer) clearInterval(E.timer);
      Object.assign(E, { ctx: null, song: null, want: null, timer: null, voices: [], jingle: 0 });
      window.AudioContext = AC; Math.random = real;
    }
    delete oc.currentTime; delete oc.state;
    return oc;
  };
  const rms = buf => {
    const d = buf.getChannelData(0), n = Math.round(win * rate), out = [];
    for (let i = 0; i < d.length; i += n) {
      let s = 0; const e = Math.min(d.length, i + n);
      for (let j = i; j < e; j++) s += d[j] * d[j];
      out.push(Math.round(Math.sqrt(s / (e - i)) * 1e5) / 1e5);
    }
    return out;
  };
  const ctxs = jobs.map(schedule);
  return (await Promise.all(ctxs.map(c => c.startRendering()))).map(rms);
}"""


def render_all(pg, only=None):
    """{file name: {part: [rms, ...]}} for every song (day and night), jingle, cry (and its low-HP version) and UI sound"""
    N = pg.evaluate("({ songs: Object.keys(SONGS), jingles: Object.keys(JINGLES), cries: (gameData.lines || []).flatMap(L => L.names.map((n, i) => L.id + i)),"
                    " low: typeof cryPlay === 'function', ui: typeof uiSound === 'function' && typeof UI_SOUND_NAMES !== 'undefined' ? UI_SOUND_NAMES : [],"
                    " parts: Object.fromEntries(Object.keys(SONGS).map(s => [s, ['day', 'night'].concat(typeof musicParts === 'function' ? musicParts(s) : [])])) })")
    keep = lambda n: not only or n in only
    jobs = [(s, p, {'kind': 'song', 'name': s, 'night': p == 'night', 'part': p}) for s in N['songs'] if keep(s) for p in N['parts'][s]]
    jobs += [(file, n, {'kind': kind, 'name': n, 'night': False}) for kind, file in (('jingle', 'jingles'), ('cry', 'cries'), ('ui', 'ui')) for n in N[file] if keep(n)]
    # SND-6: each cry's low-HP version, beside it in cries.json
    if N['low']: jobs += [('cries', n + '@low', {'kind': 'cry', 'name': n, 'night': False, 'part': 'low'}) for n in N['cries'] if keep(n)]
    out = {}
    for i in range(0, len(jobs), 12):   # in batches, so a page never holds every render at once
        part = jobs[i:i + 12]
        res = pg.evaluate(RENDER, {'jobs': [j[2] for j in part], 'rate': RATE, 'win': WINDOW})
        for (file, key, _), r in zip(part, res): out.setdefault(file, {})[key] = r
    return out


def differences(now, only=None):
    """what changed against the baseline, as short lines"""
    bad = []
    for file, parts in now.items():
        f = BASE / f'{file}.json'
        if not f.exists(): bad.append(f'{file}: not in the baseline'); continue
        was = json.loads(f.read_text())
        for part, a in parts.items():
            b = was.get(part)
            if b is None: bad.append(f'{file} {part}: not in the baseline'); continue
            if len(a) != len(b): bad.append(f'{file} {part}: {len(a)} windows, the baseline has {len(b)}'); continue
            off = [i for i, (x, y) in enumerate(zip(a, b)) if abs(x - y) > max(ABS, REL * max(x, y))]
            if off:
                i = off[0]; bad.append(f'{file} {part}: {len(off)} of {len(a)} windows differ, first at {i * WINDOW:.2f} s ({b[i]} -> {a[i]})')
    if not only:
        gone = sorted(p.stem for p in BASE.glob('*.json') if p.stem not in now)
        bad += [f'{g}: in the baseline, not rendered now' for g in gone]
    return bad


def run(b, base, write=False, only=None):
    """renders on a page of the browser b served at base; returns (problems, a summary line)"""
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_init_script('window.PB_TEST_GLOBALS=true')
    ctx.add_init_script("Object.defineProperty(window,'PB_FIREBASE',{get(){return null},set(){},configurable:false})")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(base + '/index.html')
        end = time.time() + 120
        while not pg.evaluate("typeof soundEngine!=='undefined'&&typeof initSound==='function'&&typeof gameData!=='undefined'"):
            if time.time() > end: raise Exception('the game page never loaded its sound code')
            time.sleep(.3)
        t = time.time(); now = render_all(pg, only); dt = round(time.time() - t, 1)
        count = sum(len(p) for p in now.values())
        if write:
            BASE.mkdir(parents=True, exist_ok=True)
            for file, parts in now.items():
                (BASE / f'{file}.json').write_text(json.dumps(parts, separators=(',', ':')) + '\n')
            return [], f'wrote {count} fingerprints in {len(now)} files ({dt} s)'
        bad = differences(now, only)
        return bad, f'{count} fingerprints, {len(bad)} changed ({dt} s)'
    finally:
        ctx.close()


def main():
    import subprocess
    from playwright.sync_api import sync_playwright
    args = sys.argv[1:]
    only = next((a.split('=', 1)[1].split(',') for a in args if a.startswith('--only=')), None)
    subprocess.run(['node', str(ROOT / 'tools' / 'build-data.mjs')], check=True, capture_output=True)
    srv, base = _serve()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        try:
            bad, line = run(b, base, '--baseline' in args, only)
        finally:
            b.close()
    srv.shutdown()
    print(line)
    for x in bad[:40]: print('  CHANGED', x)
    sys.exit(1 if bad else 0)


def _serve():
    import socket, threading
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = ThreadingHTTPServer(('127.0.0.1', port), partial(Quiet, directory=str(GAME)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}'


if __name__ == '__main__':
    main()
