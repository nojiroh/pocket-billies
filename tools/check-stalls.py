#!/usr/bin/env python3
"""FL-1b's headless gates (docs/phases/fluid-track.md): the page's stalls and quick wins, counted (not timed: a
headless browser draws in software, so milliseconds are notes only).

    python3 tools/check-stalls.py

Opens Copperleaf (?fixture=town) phone sized with the checks' page set-up (tools/browser_check.py) and checks:
- behind a full screen the 3D's cap is 1 at once (it was 24 for 0.8 s), also with a window over the screen, and it
  draws at most 6 frames in 5 s, with at most 6 ticks wrapped by the GPU counters (FL-1a's counter change);
- the pixel sky's task ('bg') is off while the walk hides the sky, and on again on a screen that shows it;
- 2 blurred surfaces on the walk tab (uiBlurCount: the two bars; the Actions button's invisible blur is gone);
- the label layer is not cleared while nothing is drawn on it (a window over the walk hides the labels);
- the once-a-second getError's time (each debug-log sample's glErr, a note).
Exit status 1 when a gate fails."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402


def main():
    from playwright.sync_api import sync_playwright
    srv, base = CF.serve(CF.GAME)
    errs, fails, notes = [], [], []

    def gate(ok, what):
        (notes if ok else fails).append(('ok   ' if ok else 'FAIL ') + what)

    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs)
        ctx.set_default_timeout(240000)
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();uiState.tab='walk';render();0")
        CF.frames(pg, 3)

        # the walk hides the pixel sky: its task is off
        gate(not pg.evaluate("frameScheduler.tasks.has('bg')"), "the pixel sky's task is off on the walk")
        blur, blur_all = pg.evaluate('uiBlurCount({bars:false})'), pg.evaluate('uiBlurCount()')
        gate(blur <= 2, f'blurred surfaces while walking besides the bars: {blur} (at most 2; {blur_all} with the bars)')

        # the label layer: a window over the walk hides the labels; after its first frame nothing clears
        # FL-6: a window freezes the world; this one asks for it moving (modal world: true) so frames still come
        pg.evaluate("modal({title:'check',world:true,html:'<p>check</p>'});0")
        CF.frames(pg, 2)
        c0 = pg.evaluate('walkRenderer.uiClears||0')
        CF.frames(pg, 4)
        c1 = pg.evaluate('walkRenderer.uiClears||0')
        gate(c1 == c0, f'label clears with no labels over 4 frames: {c1 - c0} (0)')
        # something drawn on the layer is cleared by the next frame
        pg.evaluate('walkView.x.fillRect(0,0,4,4);0')
        CF.frames(pg, 2)
        c2 = pg.evaluate('walkRenderer.uiClears||0')
        gate(c2 == c1 + 1, f'a drawn layer is cleared once: {c2 - c1} (1)')
        pg.evaluate('closeModal();0')

        # behind a full screen: the cap at once, a window over the screen keeps it, and the frames drawn in 5 s
        pg.evaluate("uiState.tab='team';render();0")
        cap = pg.evaluate('walkView.opt.cap()')
        gate(cap <= 1, f'the 3D cap right after a screen opens: {cap} (at most 1; FL-6: 0.1, frozen)')
        gate(pg.evaluate("frameScheduler.tasks.has('bg')") is False, "the scene behind the screen hides the sky: 'bg' off")
        pg.evaluate("modal({title:'check',html:'<p>check</p>'});0")
        cap = pg.evaluate('walkView.opt.cap()')
        gate(cap <= 1, f'a window over the screen keeps its rate: {cap} (at most 1)')
        pg.evaluate('closeModal();0')
        # each counted (wrapped) tick starts by zeroing gpuCounters.cur (engine/gpu-counters.js countersOn)
        pg.evaluate("(()=>{const c=gpuCounters.cur,f=c.fill;window.__wraps=0;c.fill=function(...a){window.__wraps++;return f.apply(this,a)};return 0})()")
        f0 = pg.evaluate('walkRenderer.frames')
        time.sleep(5)
        n = pg.evaluate('walkRenderer.frames') - f0
        wraps = pg.evaluate('window.__wraps')
        pg.evaluate('delete gpuCounters.cur.fill;0')
        gate(n <= 6, f'frames drawn in 5 s behind a screen: {n} (at most 6)')
        gate(wraps <= 6, f'ticks wrapped by the GPU counters in 5 s behind a screen: {wraps} (at most 6)')
        pg.evaluate("uiState.tab='walk';render();0")
        CF.frames(pg, 2)

        # getError: not asked in play; asked during a test step (its time a note: software drawing)
        ge = pg.evaluate("debugLog.samples.map(s=>s.glErr).filter(v=>typeof v==='number').length")
        gate(ge == 0, f'debug-log samples that asked getError in play: {ge} (0)')
        pg.evaluate("debugLog.bench={step:'check-stalls',result:null};0")
        t0 = pg.evaluate('debugLog.samples.length')
        CF.until(pg, f"debugLog.samples.slice({t0}).filter(s=>typeof s.glErr==='number').length>=3", 60)
        ge = pg.evaluate(f"debugLog.samples.slice({t0}).map(s=>s.glErr).filter(v=>typeof v==='number')")
        pg.evaluate('debugLog.bench=null;0')
        gate(len(ge) >= 3, f'getError asked during a test step: {len(ge)} samples')
        if ge: notes.append(f'note getError: {len(ge)} samples, mean {sum(ge) / len(ge):.3f} ms, worst {max(ge):.3f} ms')
        hr = pg.evaluate('debugLog.hitchReport()')
        notes.append(f"note frames over the slot ({hr.get('missedOverMs')} ms): {hr.get('missed')} of {hr.get('frames')}; "
                     f"hitches over {hr.get('overMs')} ms: {hr.get('count')}")
        b.close()
    srv.shutdown()
    bad = [e for e in errs if 'is in legacy' not in e]
    if bad: fails.append('FAIL page errors: ' + '; '.join(bad[:5]))
    for line in notes + fails: print(line)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
