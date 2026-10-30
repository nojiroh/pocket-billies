#!/usr/bin/env python3
"""FL-6b's headless gates (docs/phases/fluid-track.md): the bottom bar's shrink while walking, counted.

    python3 tools/check-nav-glide.py [--note]

Opens Copperleaf (?fixture=town) on a phone-sized touch page, stops every frame task (so the 3D and the minimap add no
work of their own), then shrinks and grows the bar (pb-nav-bar's `compact`) a few times and reads Chrome's own
counters (CDP Performance: RecalcStyleCount, LayoutCount and their times) from the change to 300 ms after it (the
glide is --m-base, 240 ms), against the same window with nothing changed. Checks:
- the glide moves only by transforms: at most 5 style recalculations and 3 layouts each change (the change itself,
  the glide's two reads, the animations starting), however many frames the glide takes;
- the glide runs: the tile, the tabs and the bar's glass have running animations right after the change, and the
  things over the bar (the walk's foot, the d-pad) have a `translate` transition;
- the bar ends where it should: compact a square tile, full the wide one;
- the glass: on a phone the sheet's --g-blur is the 9 px one; with high contrast or reduced transparency asked for,
  every surface blur is gone (uiBlurCount() 0) and the glass is solid.
--note prints the counts and exits 0 (the "before" numbers on an older tree). Exit status 1 when a gate fails."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402

# every frame task stopped (a cap of 0 is a true freeze); their caps kept to put back
FREEZE = "(()=>{window.__caps=window.__caps||new Map();for(const [k,t] of frameScheduler.tasks){if(!__caps.has(k))__caps.set(k,t.cap);t.cap=()=>0}return [...frameScheduler.tasks.keys()]})()"
THAW = "(()=>{for(const [k,c] of (window.__caps||new Map())){const t=frameScheduler.tasks.get(k);if(t)t.cap=c}window.__caps=null;return 0})()"
NAV = "document.querySelector('pb-nav-bar#nav')"
RUNNING = "(()=>{const n=" + NAV + ",r=n.renderRoot;return {own:r.getAnimations().length,page:document.getAnimations().filter(a=>a.transitionProperty==='translate').length}})()"
TILE = "(()=>{const m=" + NAV + ".renderRoot.querySelector('.map').getBoundingClientRect();return [Math.round(m.width),Math.round(m.height)]})()"


def main():
    from playwright.sync_api import sync_playwright
    note = '--note' in sys.argv
    srv, base = CF.serve(CF.GAME)
    errs, fails, notes = [], [], []

    def gate(ok, what):
        (notes if ok or note else fails).append(('ok   ' if ok else ('note ' if note else 'FAIL ')) + what)

    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.new_page(b, errs, width=390, height=844, mobile=True)
        ctx.set_default_timeout(240000)
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0")
        CF.frames(pg, 3)
        tasks = pg.evaluate(FREEZE)
        time.sleep(1.5)
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Performance.enable')

        def metrics():
            m = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
            return [m.get('RecalcStyleCount', 0), m.get('LayoutCount', 0), m.get('RecalcStyleDuration', 0), m.get('LayoutDuration', 0)]

        def window(js):
            a = metrics()
            pg.evaluate(js)
            time.sleep(0.3)
            z = metrics()
            return [z[i] - a[i] for i in range(4)]

        def avg(rows):
            return [sum(r[i] for r in rows) / len(rows) for i in range(4)]

        idle = avg([window('0') for _ in range(4)])
        runs, run_on = [], []
        sizes = {}
        for i in range(6):
            want = 'true' if i % 2 == 0 else 'false'
            a = metrics()
            pg.evaluate(f"{NAV}.compact={want};0")
            pg.evaluate("new Promise(r=>requestAnimationFrame(()=>r(0)))")
            run_on.append(pg.evaluate(RUNNING))
            time.sleep(0.3)
            z = metrics()
            runs.append([z[k] - a[k] for k in range(4)])
            time.sleep(0.2)
            sizes[want] = pg.evaluate(TILE)
        glide = avg(runs)
        fmt = lambda r: f'{r[0]:.1f} style ({r[2] * 1000:.1f} ms), {r[1]:.1f} layout ({r[3] * 1000:.1f} ms)'
        print(f'frame tasks stopped: {", ".join(tasks)}')
        print(f'idle 300 ms: {fmt(idle)}')
        print(f'a change and its 300 ms: {fmt(glide)}')
        gate(glide[0] - idle[0] <= 5, f"style recalculations a change: {glide[0] - idle[0]:.1f} over idle (at most 5: the change, its reads, the animations starting; the old glide added one a frame to the frame's own pass, so its time is the measure: printed above)")
        gate(glide[1] - idle[1] <= 3, f'layouts a change: {glide[1] - idle[1]:.1f} over idle (at most 3)')
        gate(all(r['own'] >= 3 for r in run_on), f'the tile, tabs and glass glide (running animations in the bar): {[r["own"] for r in run_on]}')
        gate(all(r['page'] >= 1 for r in run_on), f'what sits over the bar glides by translate: {[r["page"] for r in run_on]}')
        sq, wide = sizes.get('true'), sizes.get('false')
        gate(bool(sq) and abs(sq[0] - sq[1]) <= 1 and wide and wide[0] > wide[1], f'the tile: compact {sq}, full {wide}')
        pg.evaluate(THAW)

        # the glass: the phone's 9 px, then cleared with high contrast and with reduced transparency
        gb = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--g-blur').trim()")
        gate(gb == 'blur(9px) saturate(1.35)', f"the phone's --g-blur: {gb}")
        pg.evaluate("uiState.tab='team';render();0")
        CF.frames(pg, 1)
        before = pg.evaluate('uiBlurCount()')
        for feat in (('prefers-contrast', 'more'), ('prefers-reduced-transparency', 'reduce')):
            cdp.send('Emulation.setEmulatedMedia', {'features': [{'name': feat[0], 'value': feat[1]}]})
            n = pg.evaluate('uiBlurCount()')
            solid = pg.evaluate("(()=>{const s=getComputedStyle(document.documentElement);return s.getPropertyValue('--g-bg').trim()})()")
            gate(n == 0 and before > 0, f'{feat[0]}: {feat[1]}: blurred surfaces {n} (0; {before} before), --g-bg {solid}')
        cdp.send('Emulation.setEmulatedMedia', {'features': []})
        b.close()
    srv.shutdown()
    bad = [e for e in errs if 'is in legacy' not in e]
    if bad: fails.append('FAIL page errors: ' + '; '.join(bad[:5]))
    for line in notes + fails: print(line)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
