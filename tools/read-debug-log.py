#!/usr/bin/env python3
"""Tooling 2026-10-27: a one-screen summary of a debug log exported from the game (Settings -> Help, the debug menu or
the full test's results window: pocket-billies-debug-<date>.json), so Claude reads this instead of the whole file
(the per-second samples are most of it: 172 KB after a 3-minute session). The log's own picture is saved as a JPEG
that Claude can look at. Read-only: it changes nothing in the repo and sends nothing anywhere.

    python3 tools/read-debug-log.py <log.json> [--out=DIR]   # the picture goes to DIR (validation/debug-log/)
    python3 tools/read-debug-log.py - < log.json             # a log pasted or piped in

What the fields mean: game/js/debug-log.js (build(), diag()) and docs/TESTING.md, "The in-game full test and the debug
log". The debug-log skill (.claude/skills/debug-log) says how to read a log.
"""
import base64, json, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARGS = [a for a in sys.argv[1:] if not a.startswith('--out=')]
OUT = Path(next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--out=')), ROOT / 'validation' / 'debug-log'))


def num(v, nd=0):
    """a number shortened for reading, '?' when the log has none"""
    if isinstance(v, bool) or not isinstance(v, (int, float)): return '?' if v is None else str(v)
    return f'{v:.{nd}f}' if nd else f'{round(v)}'


def flat(v, keys=None, n=8):
    """a dict's plain values as k=v (lists by their length), at most n; keys picks them in order"""
    if not isinstance(v, dict): return str(v)
    ks = [k for k in (keys or v.keys()) if k in v and not isinstance(v[k], dict)][:n]
    return ', '.join(f"{k} {len(v[k]) if isinstance(v[k], list) else v[k]}" for k in ks)


def audio(a):
    """SND-15: the sound's lines (sound.js soundDebugLines): the context, glitches, beds and sources, the bank, the
    reverb, the water, nature, the music's ensemble and layers, and the mix (the master chain's cut, the levels, the
    ducks, the audio session)"""
    if not a: print('Audio: none in this log (sound never started)'); return
    st = a.get('states') or []
    print(f"Audio: {a.get('state')} at {a.get('rate')} Hz, song {a.get('song')}, late steps {a.get('lateSteps')}, "
          f"sources a minute {a.get('sourcesLastMinute')}, beds live {len(a.get('liveBeds') or {})} of {a.get('worldBeds')} "
          f"({a.get('liveSources')} sources), latency {flat(a.get('latencyMs'))} ms"
          + (f"; states {', '.join(str(x.get('at')) + ' s ' + str(x.get('state')) for x in st[-4:])}" if st else ''))
    for k, keys in (('bank', ['mb', 'withOtherMb', 'zones', 'dropped', 'bakeMs', 'sliceMaxMs', 'stepMaxMs']),
                    ('reverb', ['bakeMs', 'readyMs', 'setMs', 'place', 'sec']), ('water', None), ('nature', None)):
        if a.get(k): print(f"  {k}: {flat(a[k], keys)}")
    e = a.get('ensemble') or {}
    if e: print(f"  music: {e.get('song')} on {e.get('ensemble')} playing {e.get('playing')}, GB Sounds {e.get('gbSounds')}, "
                f"section {flat(e.get('section'))}, last jingle {flat(e.get('jingle'))}")
    m = a.get('mix') or {}
    if m:
        print(f"  mix: cut now {flat(m.get('cut'))} dB, most this minute {flat(m.get('cutMost'))} dB, make-up {m.get('makeup')} dB; "
              f"levels {flat(m.get('levels'))}")
        print(f"       ducks {flat((m.get('ducks') or {}).get('music'))} (music), {flat((m.get('ducks') or {}).get('beds'))} (beds); "
              f"under way {m.get('ducking')}; session {m.get('session')}, play when silenced {m.get('playSilenced')}")


def screen_of(s):
    """the summary's name for a sample's screen (debug-log.js summary())"""
    v = s.get('view')
    return f"walk:{s.get('scene') or '?'}" if v == 'walk' else ('battle' if v == 'battle' else str(v or '-'))


def ctx_lines(c):
    """a failed step's context (debug-log.js diag()), a few short lines"""
    if not isinstance(c, dict): return []
    out = [f"ctx: {c.get('view')} | scene {c.get('scene')} | {c.get('renderer')}"
           + (f" | at {c['at']}" if c.get('at') else '')]
    for k in ('refused', 'errors', 'slow', 'long', 'events'):
        v = c.get(k)
        if v: out.append(f"{k}: {json.dumps(v)[:220]}")
    return out


def main():
    if not ARGS: print(__doc__); sys.exit(2)
    src = sys.stdin.read() if ARGS[0] == '-' else Path(ARGS[0]).read_text(encoding='utf-8')
    d = json.loads(src)
    if d.get('kind') != 'debug-log': print(f"warning: kind is {d.get('kind')!r}, not 'debug-log'")
    name = 'stdin' if ARGS[0] == '-' else Path(ARGS[0]).name
    print(f"{name}: {d.get('game')} {d.get('build')} (deploy {d.get('deploy') or '-'}, data {d.get('dataVersion')}, "
          f"art {d.get('artVersion')}, format {d.get('format')}), made {d.get('created')}, page up {num(d.get('uptimeSec'))} s")

    dv, g = d.get('device') or {}, d.get('graphics') or {}
    print(f"Device: {'phone' if dv.get('mobile') else 'not a phone'}, screen {dv.get('screen')}, viewport {dv.get('viewport')}, "
          f"DPR {dv.get('dpr')}, {dv.get('cores')} cores, {dv.get('memoryGB')} GB, {dv.get('platform')}; "
          f"{(dv.get('userAgent') or '?')[:110]}")
    print(f"Graphics: {g.get('renderer')} | WebGL2 {g.get('webgl2')}, max texture {g.get('maxTexture')}, high precision "
          f"{g.get('precisionHigh')}, float targets {g.get('floatTargets')}, mediump {g.get('mediump')}, scene "
          f"{g.get('sceneRenderer')}, WebGL failed {g.get('webglFailed')}, context lost {g.get('contextLost')}")
    for key, v in g.items():   # a helper of the renderer's that keeps failing (the ground painter's worker, ...)
        if isinstance(v, dict) and v.get('failed'):
            print(f"  ! {key}: {v.get('failed')} failed of {v.get('here', '?')}; last: "
                  f"{str(v.get('last') or '').splitlines()[0][:160]}")
    mem = (d.get('more') or {}).get('memoryMB') or {}
    if mem: print(f"Memory: JS heap {mem.get('used')} of {mem.get('total')} MB (limit {mem.get('limit')})")
    # characters track: people (walk-view-gl.js peopleReport) and, with Figures on, the figures' numbers (figures.js
    # figureReport): the baker, CH-4's meshes on the helper thread and the live atlas
    ppl = (d.get('more') or {}).get('people')
    if isinstance(ppl, dict):
        print(f"People: {ppl.get('drawn')} drawn, {ppl.get('draws')} draws {json.dumps(ppl.get('byPass') or {})}, "
              f"{ppl.get('textures')} pictures {ppl.get('mb')} MB")
        fg = ppl.get('figures')
        if isinstance(fg, dict):
            # CH-3c: whether Figures and Everyone else were on, and whose figure you were (a phone log names it)
            print(f"  figures: {'ON' if fg.get('on') else 'off'}, everyone else {'on' if fg.get('folk') else 'off'}, you {fg.get('figure')}, kit {fg.get('kit')}, "
                  f"style {fg.get('style')}, {fg.get('density')} px/m, {fg.get('bakes')} baked ({num(fg.get('ms'))} ms), "
                  f"{fg.get('pictures')} kept {fg.get('mb')} MB, lost {fg.get('losses')}" + (f", FAILED {fg.get('failed')}" if fg.get('failed') else ''))
            m = fg.get('meshes') or {}
            if m: print(f"  meshes: thread {m.get('thread')}, {m.get('builds')} built ({num(m.get('ms'))} ms), {m.get('page')} on the page "
                        f"({num(m.get('pageMs'))} ms), {m.get('waiting')} waiting, {m.get('kept')} kept {m.get('mb')} MB")
            mv = fg.get('moves') or {}
            if mv: print('  moves (person-ticks): ' + ', '.join(f'{k} {v}' for k, v in mv.items()))
            a = fg.get('atlas') or {}
            if a: print(f"  atlas: {'on' if a.get('on') else 'off'}, {a.get('people')} people in {a.get('cells')} cells ({a.get('use')} of it), "
                        f"{a.get('draws')} drawn ({num(a.get('ms'))} ms; {a.get('faceDraws', 0)} for a face: talking, blinks, expressions), {a.get('rows')} ramp rows, full {a.get('full')}"
                        + (f", FAILED {a.get('failed')}" if a.get('failed') else ''))

    audio(((d.get('more') or {}).get('audio')))

    pp = d.get('previousPage') or {}
    if pp.get('endedUnexpectedly') or pp.get('endedInBackground'):
        L = pp.get('last') or {}
        print(f"PREVIOUS PAGE ENDED {'UNEXPECTEDLY' if pp.get('endedUnexpectedly') else 'in the background'} "
              f"(this page: {(d.get('boot') or {}).get('navigation') or '?'}): after {num(L.get('up'))} s, scene {L.get('scene')}, "
              f"test step {L.get('test')!r}, graphics {num(L.get('gmb'))} MB {json.dumps(L.get('kinds') or {})}, "
              f"{num(L.get('fps'))} fps, q{L.get('q')} res {L.get('res')}, {num(L.get('hz'))} Hz")

    ld = d.get('load') or {}
    if ld: print(f"Load: {num(ld.get('ms'))} ms, {ld.get('files')} files" + (f", FAILED: {ld.get('failed')}" if ld.get('failed') else ''))

    rows = [(k, v) for k, v in (d.get('summary') or {}).items() if isinstance(v, dict) and 'fpsAvg' in v]
    if rows:
        # TD-1: seconds of play, and (+N) seconds spent loading the place, which the averages leave out
        print('Frame rates by screen (seconds of play +loading; fps avg / 10th percentile / worst; CPU ms avg / 90th; slow frames):')
        for k, v in sorted(rows, key=lambda r: -(r[1].get('seconds') or 0)):
            ld = f"+{num(v.get('loadingSeconds'))}" if v.get('loadingSeconds') else ''
            print(f"  {k[:38]:38s} {num(v.get('seconds')):>4s}{ld:>5s} s  {num(v.get('fpsAvg'), 1):>5s} / {num(v.get('fpsP10')):>3s} / "
                  f"{num(v.get('fpsWorst')):>3s}  CPU {num(v.get('cpuMsAvg'), 1):>6s} / {num(v.get('cpuMsP90'), 1):>6s}  "
                  f"slow {num(v.get('slowFrames'))}  {v.get('renderer')} res {v.get('resolution')}")
    by = (d.get('more') or {}).get('slowFramesBy') or {}
    if by:
        # TD-1: each slow frame counts towards every cause it overlapped (share: its part of those frames, in frames)
        print('Slow frames by cause (frames it took part in, share in frames, its ms, its most in one frame):')
        for cause, v in sorted(by.items(), key=lambda kv: -(kv[1].get('totalMs') or 0))[:8]:
            print(f"  {cause[:44]:44s} {num(v.get('frames')):>5s} {num(v.get('share'), 1) if 'share' in v else '-':>6s} "
                  f"{num(v.get('totalMs')):>8s} {num(v.get('worstMs')):>6s}")
    h = d.get('hitches') or {}
    if h: print(f"Hitches over {h.get('overMs')} ms: {h.get('count')} in {h.get('frames')} frames, {num(h.get('totalMs'))} ms in all, "
                f"worst {num(h.get('maxMs'))} ms; by size {h.get('by')}")
    # FL-1b: frames over the set rate's slot (plus half a refresh), which the 36 ms line can't see at 60 fps
    if h and 'missed' in h: print(f"Frames over the set rate's slot ({h.get('missedOverMs')} ms): {h.get('missed')}")
    # FL-1b: the once-a-second getError's time (ms), from the samples that have it
    ge = [s.get('glErr') for s in (d.get('samples') or []) if isinstance(s, dict) and isinstance(s.get('glErr'), (int, float))]
    if ge: print(f"getError once a second: {len(ge)} samples, mean {sum(ge) / len(ge):.2f} ms, worst {max(ge):.2f} ms")
    # FL-6: taps from touch to paint (Event Timing) and the long frames' rendering and style and layout time
    ui = d.get('ui') or {}
    tp, lf = ui.get('taps') or {}, ui.get('longFrames') or {}
    if tp.get('count'):
        print(f"Taps (touch to paint, over 16 ms): {tp.get('count')}, worst {num(tp.get('maxMs'))} ms, over 100 ms: {tp.get('over100')}")
        for r in (tp.get('last') or [])[-6:]:
            if isinstance(r, list) and len(r) >= 8:
                print(f"  {num(r[1]):>4s} ms {str(r[3])[:12]:12s} {str(r[4])[:16]:16s} wait {r[5]}, handlers {r[6]}, paint {r[7]}")
    pt = ui.get('paint') or {}
    if pt.get('count'):
        print(f"Taps, click to paint (every tap): {pt.get('count')}, mean {pt.get('meanMs')} ms, worst {pt.get('maxMs')} ms")
        for r in (pt.get('last') or [])[-6:]:
            if isinstance(r, list) and len(r) >= 4: print(f"  {num(r[1]):>4s} ms {str(r[2])[:12]:12s} {str(r[3])[:16]}")
    if lf.get('count'): print(f"Long frames: {lf.get('count')}, rendering {lf.get('renderMs')} ms and style and layout {lf.get('styleMs')} ms on average, "
                             f"style and layout at most {lf.get('maxStyleMs')} ms")

    # the full test's result: build() stores it as `bench` itself (TD-1); `bench.result` is kept for older logs
    bench = d.get('bench')
    res = (bench if 'phases' in bench else bench.get('result')) if isinstance(bench, dict) else None
    if res:
        phases = res.get('phases') or []
        bad = [p for p in phases if not p.get('ok')]
        print(f"Full test ({res.get('kind')}): {'passed' if res.get('passed') else 'PROBLEMS'}"
              f"{', stopped' if res.get('stopped') else ''}, {num(res.get('seconds'))} s, {len(phases)} steps, {len(bad)} not ok")
        for p in bad[:12]:
            print(f"  x {p.get('name')}: {(p.get('note') or '')[:150]}")
            if p.get('why') and p.get('why') != p.get('note'): print(f"      why: {str(p.get('why'))[:200]}")
            for line in ctx_lines(p.get('ctx')): print('      ' + line)
        slow = sorted((p for p in phases if p.get('worstFrameMs')), key=lambda p: -p['worstFrameMs'])[:5]
        if slow: print('  worst frames: ' + '; '.join(f"{p.get('name')} {num(p.get('worstFrameMs'))} ms" for p in slow))
        if res.get('stress'): print(f"  stress: {json.dumps(res.get('stress'))[:200]}")
    elif bench is not None:
        print(f"Full test: no result ({json.dumps(bench)[:120]})")
    else:
        print('Full test: not run in this page')

    gm = (d.get('more') or {}).get('gpuMemory') or {}
    kinds = gm.get('kinds') if isinstance(gm, dict) else None
    if isinstance(kinds, dict) and kinds:
        tot = sum((v or {}).get('mb') or 0 for v in kinds.values() if isinstance(v, dict))
        parts = sorted(((k, v) for k, v in kinds.items() if isinstance(v, dict)), key=lambda kv: -((kv[1].get('mb')) or 0))
        print(f"Graphics memory (estimate) {num(tot)} MB: " + ', '.join(
            f"{k} {num(v.get('mb'))}" + (f" ({v.get('dropped')} dropped)" if v.get('dropped') else '') for k, v in parts))
        if gm.get('lateCompiles'): print(f"  late compiles: {', '.join(map(str, gm['lateCompiles']))[:200]}")

    samples = d.get('samples') or []
    peak = {}
    for s in samples:
        if isinstance(s.get('gmb'), (int, float)):
            k = screen_of(s)
            peak[k] = max(peak.get(k, 0), s['gmb'])
    if peak:
        print('Graphics memory peak by screen (MB): ' + ', '.join(f"{k} {v}" for k, v in sorted(peak.items(), key=lambda kv: -kv[1])[:8]))
    tl, prev = [], None
    for s in samples:
        cur = (s.get('q'), s.get('res'))
        if cur != prev and (cur[0] is not None or cur[1] is not None):
            tl.append(f"{num((s.get('t') or 0) / 1000)} s q{cur[0] if cur[0] is not None else '?'} res {cur[1] if cur[1] is not None else '?'}")
            prev = cur
    if tl: print(f"Quality and resolution ({len(tl)} changes): " + '; '.join(tl[:10] + (['...'] + tl[-3:] if len(tl) > 13 else tl[10:])))
    # FL-3a: the frame controller's steps (quality.controller on): CPU level, half rate, fence lag, its last step
    ct, prevc = [], None
    for s in samples:
        if 'qc' not in s: continue
        c = s.get('ctl') or {}
        cur = (s.get('qc'), s.get('half'), c.get('t'))
        if cur != prevc:
            ct.append(f"{num((s.get('t') or 0) / 1000)} s cpu {s.get('qc')}{' half rate' if s.get('half') else ''} lag {s.get('lag')}" + (f" ({c.get('act')} {c.get('lever')}: {c.get('why')})" if c else ''))
            prevc = cur
    if ct: print(f"Frame controller ({len(ct)} changes): " + '; '.join(ct[:10] + (['...'] + ct[-3:] if len(ct) > 13 else ct[10:])))

    ev = [e for e in (d.get('events') or []) if e.get('kind') in ('visibility', 'webgl')]
    if ev:
        print(f"Visibility and graphics-context events ({len(ev)}): " + '; '.join(
            f"{num((e.get('t') or 0) / 1000)} s {e.get('kind')} {e.get('msg')}" for e in ev[-12:]))

    errs = d.get('errors') or []
    warn = [e for e in errs if str(e.get('kind', '')).endswith('warn')]
    real = [e for e in errs if e not in warn]
    for label, group in (('Errors', real), ('Warnings', warn)):
        if not group: continue
        c = Counter((str(e.get('kind')), str(e.get('msg') or '').splitlines()[0][:120] if e.get('msg') else '') for e in group)
        print(f"{label}: {len(group)} ({len(c)} different)")
        for (kind, msg), n in c.most_common(8 if label == 'Errors' else 4):
            print(f"  {n:>3d}x {kind}: {msg}")
        if label == 'Errors' and real[-1].get('stack'):
            print('  last stack: ' + ' | '.join(str(real[-1]['stack']).splitlines()[:3])[:240])

    shot = d.get('screenshot') or {}
    jpeg = shot.get('jpeg') or ''
    if jpeg.startswith('data:image/jpeg;base64,'):
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / (Path(name).stem + '.jpg')
        path.write_bytes(base64.b64decode(jpeg.split(',', 1)[1]))
        print(f"Picture: {shot.get('what')} at {num((shot.get('t') or 0) / 1000)} s -> {path}")
    else:
        print('Picture: none in this log')


if __name__ == '__main__':
    main()
