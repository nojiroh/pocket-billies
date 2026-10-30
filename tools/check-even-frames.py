#!/usr/bin/env python3
"""FL-4's headless counts (docs/phases/fluid-track.md, FL-4 even frames): each arm in a fresh page, the session's
switches off and then on (quality.shadowCells, shadowHold, grassAhead, freeTicks). Counted, not timed: a headless
browser draws in software, so milliseconds are notes only.

    python3 tools/check-even-frames.py

On the run fixture (phone sized, the game's own graphics): the walk to the next place's seam and across it, then 8 s
standing. Per arm:
- the far shadow map: drawn again (miss), laid down from its cache (hit), held (FL-4's hold);
- the grass: whether the next place was planted ahead (on: before the crossing) and kept at the crossing, the longest single
  grass call on the page (a note);
- the free ticks asked for (on) and the page's errors.
Gates (exit status 1): no page errors in either arm; with the switches on the next place's grass planted ahead, the far
map drawn again no more often than with them off, and the free ticks asked for."""
import importlib.util, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import GAME, LAUNCH, log, new_page, serve, until  # noqa: E402

SWITCHES = ['shadowCells', 'shadowHold', 'grassAhead', 'freeTicks']
SET = """(on => {
  const E = (gameData.engine = gameData.engine || {}), D = (E.defaults = E.defaults || {});
  D.quality = { ...(D.quality || {}), %s };
  return 0;
})"""
WATCH = """(() => {
  const W = (window.__even = { miss: 0, hit: 0, held: 0, frames: 0, grassMax: 0 });
  const wrapTime = name => {
    const f = window[name];
    window[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { W.grassMax = Math.max(W.grassMax, performance.now() - t); } };
  };
  wrapTime('grassWork'); wrapTime('buildGrass');
  const f = window.fittedShadowPass;
  window.fittedShadowPass = function (...a) {
    const R = walkRenderer, h = R.shHit || 0, m = R.shMiss || 0, d = R.shHeld || 0;
    try { return f.apply(this, a); } finally {
      W.hit += Math.max(0, (R.shHit || 0) - h); W.miss += Math.max(0, (R.shMiss || 0) - m); W.held += Math.max(0, (R.shHeld || 0) - d);
      W.frames++;
    }
  };
  return 0;
})()"""


def arm(b, base, on, cf):
    errs = []
    ctx, pg = new_page(b, errs, width=390, height=844, mobile=True, low=False, timeout=300000)
    pg.goto(base + '/index.html?fixture=run')
    ok = until(pg, "typeof runLoad!=='undefined'&&runLoad.ready&&!document.getElementById('runload')&&!document.getElementById('loader')&&walkView.ready", 300)
    if not ok: raise Exception('the run fixture never got ready')
    pg.evaluate(SET % ', '.join(f'{k}: on' for k in SWITCHES) + f'({str(on).lower()})')
    pg.evaluate(WATCH)
    pg.evaluate("window.__ticks0 = typeof freeTicks!=='undefined' ? freeTicks.asked : 0;0")
    pg.wait_for_timeout(4000)
    n1 = pg.evaluate("runWorldNode(runNext(saveData.run.map, 0)[0])")
    # the next place is prepared as you near its seam (seamlessPrepareAhead): walk there, wait for its ground
    cf.walk_over(pg, n1, -3)
    # headless frames come about once a second: the next view's preparation pushed along from the page (as check-fast's
    # SEAM_PREP), 150 ms of work every 0.3 s, until its grass is planted ahead (on) or 40 s
    nid = pg.evaluate(f"'w:'+mapIdAt({n1})+'*'")
    for _ in range(130):
        pg.evaluate(f"seamlessGetReady('{nid}', false);groundPrepWork(150);navPrepWork(150);0")
        pg.wait_for_timeout(300)
        if pg.evaluate("debugLog.ev.some(e=>/planted .* grass ahead/.test(e.msg))"): break
    pg.evaluate("window.__builds=0;const f=window.buildGrass;window.buildGrass=function(...a){window.__builds++;return f.apply(this,a)};0")
    ahead_before = pg.evaluate("debugLog.ev.filter(e=>/planted .* grass ahead/.test(e.msg)).length")
    cf.walk_over(pg, n1, pg.evaluate('RULES.run.seamIn') + 6)
    until(pg, f"walkView.ready&&walkView.id==='w:'+LOCATIONS[{n1}].mapId+'*'", 240)
    pg.wait_for_timeout(8000)
    W = pg.evaluate("window.__even")
    W['ahead'] = ahead_before
    W['grassNow'] = pg.evaluate("!!walkRenderer.grass")
    W['builds'] = pg.evaluate("window.__builds")
    W['ticks'] = pg.evaluate("(typeof freeTicks!=='undefined' ? freeTicks.asked : 0) - window.__ticks0")
    W['events'] = pg.evaluate("debugLog.ev.filter(e=>/planted|prepared/.test(e.msg)).map(e=>e.msg).slice(-6)")
    ctx.close()
    return W, errs


def main():
    from playwright.sync_api import sync_playwright
    spec = importlib.util.spec_from_file_location('check_fast', Path(__file__).with_name('check-fast.py'))
    cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)
    srv, base = serve(GAME)
    fails, R = [], {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=LAUNCH)
        for on in (False, True):
            W, errs = arm(b, base, on, cf)
            R[on] = W
            name = 'on' if on else 'off'
            log(f"switches {name}: far map drawn again {W['miss']}, from its cache {W['hit']}, held {W['held']} "
                f"({W['frames']} far passes); grass planted ahead before the crossing: {W['ahead']}, "
                f"the longest grass call {W['grassMax']:.1f} ms (a note), grass on screen: {W['grassNow']}, planted again after the crossing {W['builds']}; free ticks asked {W['ticks']}")
            for e in W['events']: print('     ' + e[:140], flush=True)
            if errs: fails.append(f'{name}: page errors: {errs[:3]}')
    if R[True]['ahead'] < 1: fails.append('on: the next place was not planted ahead before the crossing')
    elif R[True]['builds'] > 0: fails.append('on: the grass planted ahead was planted again after the crossing')
    if R[True]['miss'] * R[False]['frames'] > R[False]['miss'] * max(1, R[True]['frames']) * 1.1 + R[False]['frames']:
        fails.append('on: the far map was drawn again more often than off')
    if R[True]['ticks'] < 1: fails.append('on: no free tick asked for')
    for f in fails: log('FAIL ' + f)
    if not fails: log('ok: every gate')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
