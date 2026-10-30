#!/usr/bin/env python3
"""FL-4b's headless counts (docs/phases/fluid-track.md, the load overlap, LD-5's leftovers): each arm in a fresh page,
the session's switches off and then on (quality.slotBudget, texAge, uploadQueue, meshWorker, placeWarm). Counted, not
timed: a headless browser draws in software, so milliseconds are notes only.

    python3 tools/check-load-overlap.py

On the run fixture (phone sized, the game's own graphics): the walk to the next place's seam (its preparation pushed
along from the page, as check-even-frames.py does), the crossing, then 8 s standing. Per arm:
- the one-off budget the frame used (on: a quarter of the walk's paced slot);
- the pictures: uploads made from a bitmap, held for a later frame, failed; every picture on the card stamped with the
  time it was last used;
- the model meshes built on the helper thread and on the page;
- the next place warmed before the crossing (pictures unpacked, meshes asked for);
- the models drawn after the crossing (the same in both arms: the meshes arrive) and the page's errors.
Gates (exit status 1): no page errors in either arm; with the switches on the budget follows the slot, pictures come
from bitmaps with none failed, every low-poly mesh built on the helper (none on the page), the next place warmed before
the crossing, and as many models drawn after the crossing as with them off."""
import importlib.util, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_check import GAME, LAUNCH, log, new_page, serve, until  # noqa: E402

SWITCHES = ['slotBudget', 'texAge', 'uploadQueue', 'meshWorker', 'placeWarm']
SET = """(on => {
  const E = (gameData.engine = gameData.engine || {}), D = (E.defaults = E.defaults || {});
  D.quality = { ...(D.quality || {}), %s };
  return 0;
})"""
STATE = """(() => {
  const M = propMeshReport(), W = placeWarmReport(), Q = uploadQueue, L = gpuState.texL || new Map();
  return {
    bud: walkRenderer.budSlot || 0, slot: walkSlotMs(),
    up: { asked: Q.asked, bitmaps: Q.bitmaps, held: Q.held, failed: Q.failed },
    stamped: [...L.values()].filter(e => e.ut > 0).length, onCard: L.size,
    meshes: M, warm: W, drawn: propModelState.drawn, lowPoly: propModelState.lowPoly,
  };
})()"""


def arm(b, base, on, cf):
    errs = []
    ctx, pg = new_page(b, errs, width=390, height=844, mobile=True, low=False, timeout=300000)
    pg.goto(base + '/index.html?fixture=run')
    ok = until(pg, "typeof runLoad!=='undefined'&&runLoad.ready&&!document.getElementById('runload')&&!document.getElementById('loader')&&walkView.ready", 300)
    if not ok: raise Exception('the run fixture never got ready')
    pg.evaluate(SET % ', '.join(f'{k}: on' for k in SWITCHES) + f'({str(on).lower()})')
    pg.wait_for_timeout(4000)
    n1 = pg.evaluate("runWorldNode(runNext(saveData.run.map, 0)[0])")
    cf.walk_over(pg, n1, -3)
    # the next view's preparation pushed along from the page (headless frames come about once a second), then its
    # warm-up asked for (seamless-world.js asks once the view ahead is ready while you walk at it; standing here, the
    # page asks) and given time, as the frames of a walk would
    nid = pg.evaluate(f"'w:'+mapIdAt({n1})+'*'")
    for _ in range(130):
        pg.evaluate(f"seamlessGetReady('{nid}', false);groundPrepWork(150);navPrepWork(150);0")
        pg.wait_for_timeout(300)
        if pg.evaluate(f"seamlessGetReady('{nid}', false)"): break
    for _ in range(40):
        pg.evaluate(f"placeWarmFor('{nid}');placeWarmWork(50);0")
        pg.wait_for_timeout(250)
        if not on or pg.evaluate("placeWarmReport().done > 0"): break
    before = pg.evaluate(STATE)
    cf.walk_over(pg, n1, pg.evaluate('RULES.run.seamIn') + 6)
    until(pg, f"walkView.ready&&walkView.id==='w:'+LOCATIONS[{n1}].mapId+'*'", 240)
    pg.wait_for_timeout(8000)
    S = pg.evaluate(STATE)
    # and 8 s later: a mesh still on its way shows here (the count also follows where the camera ended up)
    pg.wait_for_timeout(8000)
    S['later'] = pg.evaluate(STATE)
    S['pos'] = pg.evaluate("[Math.round(walkView.pl.x), Math.round(walkView.pl.z), walkView.id]")
    S['before'] = before
    ctx.close()
    return S, errs


def main():
    from playwright.sync_api import sync_playwright
    spec = importlib.util.spec_from_file_location('check_fast', Path(__file__).with_name('check-fast.py'))
    cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)
    srv, base = serve(GAME)
    fails, R = [], {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=LAUNCH)
        for on in (False, True):
            S, errs = arm(b, base, on, cf)
            R[on] = S
            name = 'on' if on else 'off'
            B, M, W, U = S['before'], S['meshes'], S['warm'], S['up']
            log(f"switches {name}: budget {S['bud']:.1f} ms of a {S['slot']:.1f} ms slot; pictures from bitmaps {U['bitmaps']} of "
                f"{U['asked']} asked, held {U['held']}, failed {U['failed']}; stamped with a time {S['stamped']} of {S['onCard']}; "
                f"model meshes on the helper {M['builds']} ({M['ms']} ms there), on the page {M['page']}; "
                f"warmed before the crossing: {B['warm']['done']} views, {B['warm']['pics']} pictures, {B['warm']['meshes']} meshes; "
                f"models drawn after the crossing {S['drawn']} (low-poly {S['lowPoly']}), 8 s later {S['later']['drawn']}; "
                f"meshes waiting {S['later']['meshes']['waiting']}, ready not taken {S['later']['meshes']['ready']}; at {S['pos']}")
            if errs: fails.append(f'{name}: page errors: {errs[:3]}')
    on, off = R[True], R[False]
    if not (abs(on['bud'] - max(2, min(12, on['slot'] / 4))) < 0.05): fails.append(f"on: the budget {on['bud']} isn't a quarter of the slot {on['slot']}")
    if off['bud']: fails.append('off: the budget followed the slot')
    if on['up']['bitmaps'] < 1 or on['up']['failed']: fails.append('on: pictures did not come from bitmaps, or some failed')
    if off['up']['asked']: fails.append('off: the upload queue made bitmaps')
    if on['stamped'] < on['onCard'] * 0.9: fails.append('on: pictures on the card without a time stamp')
    if on['meshes']['builds'] < 1 or on['meshes']['page']: fails.append('on: model meshes not (all) built on the helper thread')
    if off['meshes']['builds']: fails.append('off: model meshes built on the helper thread')
    if on['before']['warm']['done'] < 1: fails.append('on: the next place was not warmed before the crossing')
    # the meshes arrive: none waiting 16 s after the crossing, and at the same spot as many models drawn
    if on['later']['meshes']['waiting']: fails.append(f"on: {on['later']['meshes']['waiting']} meshes still on the helper 16 s after the crossing")
    if on['pos'] == off['pos'] and on['later']['drawn'] < off['later']['drawn']:
        fails.append(f"on: fewer models drawn after the crossing ({on['later']['drawn']} against {off['later']['drawn']})")
    for f in fails: log('FAIL ' + f)
    if not fails: log('ok: every gate')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
