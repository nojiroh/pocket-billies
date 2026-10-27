#!/usr/bin/env python3
"""The load check (load track LD-0, docs/phases/load-track.md): boots the built site the way a phone gets it and says
where the page held its frames. Two boots on a phone-sized page with the game's own graphics (not the checks' low
ones): a new player to the title, and a reload in the middle of a run (?fixture=run) until the run's loading screen
lifts; each then sits still for a while. It reads the debug log's boot timeline and hitch list (every frame held over
33 ms, with what was marked meanwhile and, from Chrome, the scripts that held it) and the shaders compiled late.

    python3 tools/check-load.py                  # both boots, on dist/ (built first when missing)
    python3 tools/check-load.py --build          # run npm run build first
    python3 tools/check-load.py --only=cold      # one boot: cold, run or moves
    python3 tools/check-load.py --only=moves     # LD-5: on the run fixture, a seam crossed, the Map tab, a battle
    python3 tools/check-load.py --site=game      # the source folder instead of the build (modules unbundled)
    python3 tools/check-load.py --sit=20         # seconds to sit after each boot (default 15)
    python3 tools/check-load.py --max-hitches=0  # fail when more frames than this were held once the loader was gone

Software drawing (no graphics chip here or on CI) makes every frame several times slower than a phone: the numbers
rank the causes, the owner's exported debug log gives the real ones. A note, not a gate, until LD-6 sets
--max-hitches in CI. The reports go to validation/load/<boot>.json (no pictures, no save data, no names)."""
import json, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import LAUNCH, ROOT, log, new_page, serve, until  # noqa: E402

ARGS = sys.argv[1:]
arg = lambda k, d=None: next((a.split('=', 1)[1] for a in ARGS if a.startswith(f'--{k}=')), d)
ONLY = arg('only', 'cold,run,moves').split(',')
SIT = float(arg('sit', 15))
MAX = arg('max-hitches')
SITE = ROOT / ('dist' if arg('site', 'dist') == 'dist' else arg('site'))
OUT = ROOT / 'validation' / 'load'
# a boot: its URL, what says it is done, the most it may take (software drawing)
BOOTS = {
    'cold': ('game/index.html', "typeof titleScreen!=='undefined'&&titleScreen.on&&!document.getElementById('loader')", 240),
    'run': ('game/index.html?fixture=run',
            "typeof runLoad!=='undefined'&&runLoad.ready&&!document.getElementById('runload')&&!document.getElementById('loader')", 300),
}
BOOTS['moves'] = (BOOTS['run'][0], BOOTS['run'][1] + "&&!(gpuState.pend&&gpuState.pend.size)", BOOTS['run'][2])
# LD-5: the moves, each with the held frames from its start until it has settled (the hitch list cleared first)


def moves(pg):
    """on the run fixture once it has loaded: a seam crossed into the next place, the Map tab opened and closed, a wild
    battle started: each one's held frames over 33 ms (the hitch list's), longest first"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('check_fast', Path(__file__).with_name('check-fast.py'))
    cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)
    out = {}

    def measure(name, act, settle):
        pg.evaluate("debugLog.hitch.list.length=0;0")
        act()
        if not until(pg, settle, 240): log(f'{name}: did not settle in 240 s')
        pg.wait_for_timeout(2000)
        out[name] = pg.evaluate("debugLog.hitch.list.map(h=>[h.ms,h.why,h.screen])")

    n1 = pg.evaluate("runWorldNode(runNext(saveData.run.map, 0)[0])")
    measure('seam', lambda: cf.walk_over(pg, n1, pg.evaluate('RULES.run.seamIn') + 6),
            f"walkView.ready&&walkView.id==='w:'+LOCATIONS[{n1}].mapId+'*'")
    measure('map tab', lambda: pg.evaluate(cf.nav_tap('map')),
            "typeof worldBowl!=='undefined'&&worldBowl.on&&worldBowl.frames>=10")
    measure('back from the map', lambda: pg.evaluate(cf.nav_tap('map')), "walkView.ready&&walkRenderer.on")
    measure('battle', lambda: pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();startWild(encountersHere()[0]);0"),
            "!!activeBattle&&activeBattle.phase==='choose'")
    return out


REPORT = """(()=>({boot: debugLog.bootReport(), hitches: debugLog.hitchReport(),
  late: typeof gpuState!=='undefined'&&gpuState.pcl?{counts: gpuState.pcl, names: gpuState.pclNames}:null,
  load: debugLog.load, longTasks: {n: debugLog.long.n, maxMs: Math.round(debugLog.long.max)},
  events: debugLog.ev.filter(e=>e.kind==='load').map(e=>e.t+' '+e.msg)}))()"""


def gone_at(R):
    """when the loader went (ms since the page was asked for), the start of what the goal counts"""
    return next((t for n, t in R['boot']['stages'] if n == 'loader gone'), None)


def show(name, R, secs):
    S = R['boot']['stages']
    log(f'{name}: ready in {secs:.1f} s; the timeline (ms since the page was asked for):')
    print('   ' + ' · '.join(f'{n} {t}' for n, t in S), flush=True)
    H, g = R['hitches'], gone_at(R)
    after = [h for h in H['list'] if g is not None and h['t'] >= g]
    print(f"   held frames over {H['overMs']} ms: {H['count']} of {H['frames']} ({H['by']}), the longest {H['maxMs']} ms; "
          f"{len(after)} after the loader went", flush=True)
    for h in sorted(H['list'], key=lambda h: -h['ms'])[:8]:
        sc = '; ' + ', '.join(f'{s[1]} {s[0]} ms' for s in h['scripts'][:2]) if h.get('scripts') else ''
        print(f"     {h['ms']:>6} ms at {h['t']:>6} on the {h['screen']} ({h['stage']}): {h['why'][:90]}{sc[:120]}", flush=True)
    if R['late']: print(f"   shaders compiled late: {R['late']['counts']} {R['late']['names'][-6:]}", flush=True)
    return len(after)


def main():
    if '--build' in ARGS or (SITE.name == 'dist' and not (SITE / 'game' / 'index.html').exists()):
        log('building the site (npm run build)'); subprocess.run(['npm', 'run', 'build'], cwd=ROOT, check=True)
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = serve(SITE)
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=LAUNCH)
        for name in ONLY:
            url, done, sec = BOOTS[name]
            errs = []
            ctx, pg = new_page(b, errs, width=390, height=844, mobile=True, low=False, timeout=sec * 1000)
            t = time.time(); pg.goto(f'{base}/{url}')
            if not until(pg, done, sec): bad.append(f'{name}: not ready in {sec} s'); ctx.close(); continue
            secs = time.time() - t
            pg.wait_for_timeout(SIT * 1000)
            if name == 'moves':
                M = moves(pg)
                (OUT / 'moves.json').write_text(json.dumps(M, indent=1))
                for k, L in M.items():
                    L = sorted(L, key=lambda h: -h[0])
                    print(f"   {k}: {len(L)} held frames" + ''.join(f"\n     {h[0]:>6} ms on the {h[2]}: {h[1][:110]}" for h in L[:5]), flush=True)
                if errs: bad.append(f'{name}: page errors: {errs[:3]}')
                ctx.close(); continue
            R = pg.evaluate(REPORT)
            (OUT / f'{name}.json').write_text(json.dumps(R, indent=1))
            n = show(name, R, secs)
            if errs: bad.append(f'{name}: page errors: {errs[:3]}')
            if MAX is not None and n > int(MAX): bad.append(f'{name}: {n} held frames after the loader (at most {MAX})')
            ctx.close()
        b.close()
    srv.shutdown()
    for x in bad: log('FAIL ' + x)
    log(f'reports in {OUT.relative_to(ROOT)}/')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
