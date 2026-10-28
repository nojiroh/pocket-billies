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

    ld = d.get('load') or {}
    if ld: print(f"Load: {num(ld.get('ms'))} ms, {ld.get('files')} files" + (f", FAILED: {ld.get('failed')}" if ld.get('failed') else ''))

    rows = [(k, v) for k, v in (d.get('summary') or {}).items() if isinstance(v, dict) and 'fpsAvg' in v]
    if rows:
        print('Frame rates by screen (fps avg / 10th percentile / worst; CPU ms avg / 90th; slow frames):')
        for k, v in sorted(rows, key=lambda r: -(r[1].get('seconds') or 0)):
            print(f"  {k[:38]:38s} {num(v.get('seconds')):>4s} s  {num(v.get('fpsAvg'), 1):>5s} / {num(v.get('fpsP10')):>3s} / "
                  f"{num(v.get('fpsWorst')):>3s}  CPU {num(v.get('cpuMsAvg'), 1):>6s} / {num(v.get('cpuMsP90'), 1):>6s}  "
                  f"slow {num(v.get('slowFrames'))}  {v.get('renderer')} res {v.get('resolution')}")
    by = (d.get('more') or {}).get('slowFramesBy') or {}
    if by:
        print('Slow frames by cause (frames, total ms, worst ms):')
        for cause, v in sorted(by.items(), key=lambda kv: -(kv[1].get('totalMs') or 0))[:8]:
            print(f"  {cause[:44]:44s} {num(v.get('frames')):>5s} {num(v.get('totalMs')):>8s} {num(v.get('worstMs')):>6s}")
    h = d.get('hitches') or {}
    if h: print(f"Hitches over {h.get('overMs')} ms: {h.get('count')} in {h.get('frames')} frames, {num(h.get('totalMs'))} ms in all, "
                f"worst {num(h.get('maxMs'))} ms; by size {h.get('by')}")

    bench = d.get('bench')
    res = bench.get('result') if isinstance(bench, dict) else None
    if res:
        phases = res.get('phases') or []
        bad = [p for p in phases if not p.get('ok')]
        print(f"Full test ({res.get('kind')}): {'passed' if res.get('passed') else 'PROBLEMS'}"
              f"{', stopped' if res.get('stopped') else ''}, {num(res.get('seconds'))} s, {len(phases)} steps, {len(bad)} not ok")
        for p in bad[:12]:
            print(f"  x {p.get('name')}: {(p.get('note') or p.get('why') or p.get('detail') or '')[:150]}")
        slow = sorted((p for p in phases if p.get('worstFrameMs')), key=lambda p: -p['worstFrameMs'])[:5]
        if slow: print('  worst frames: ' + '; '.join(f"{p.get('name')} {num(p.get('worstFrameMs'))} ms" for p in slow))
        if res.get('stress'): print(f"  stress: {json.dumps(res.get('stress'))[:200]}")
    elif bench is not None:
        print(f"Full test: no result ({json.dumps(bench)[:120]})")
    else:
        print('Full test: not run in this page')

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
