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
