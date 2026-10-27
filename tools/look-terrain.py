#!/usr/bin/env python3
"""Terrain TR-4: pictures of the ground's look by height and steepness, for picture notes (nothing is judged here;
software drawing can't judge a look). Opens the mountains fixture (?fixture=mountains), stands at the reachable spot
with the most rock on the camera's side (check-fast.py's tall-ground spot finder) and takes a phone-sized picture with
the TR-4 switches off, then one with each on in turn, then all three (validation/terrain-look/, not in git).

    python3 tools/look-terrain.py            # pictures in validation/terrain-look/
    python3 tools/look-terrain.py --full     # with the game's graphics as they are (slow in software drawing)

The switches are Engine > World: cliffFaces (the biome's rock and strata on cliffs and steep slopes), snowLine (snow
above the biome's snow line) and cliffEdges (scree and turf edges painted on the ground)."""
import importlib.util, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('check_fast', ROOT / 'tools' / 'check-fast.py')
CF = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CF)
FULL = '--full' in sys.argv[1:]
OUT = ROOT / 'validation' / 'terrain-look'

OFF = {'cliffFaces': False, 'snowLine': False, 'cliffEdges': False}
SHOTS = [
    ('1-off', OFF),
    ('2-cliff-faces', {**OFF, 'cliffFaces': True}),
    ('3-snow-line', {**OFF, 'snowLine': True}),
    ('4-cliff-edges', {**OFF, 'cliffEdges': True}),
    ('5-all', {'cliffFaces': True, 'snowLine': True, 'cliffEdges': True}),
]
# the ground picture is painted once per view: rebuilt after each change (as the Studio's engine editor does)
REPAINT = "(()=>{rebuildFromSettings();return 0})()"


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes = [], {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=not FULL)
        pg.set_viewport_size({'width': 540, 'height': 960})
        pg.goto(base + '/index.html?fixture=mountains')
        CF.drawing(pg)
        if not CF.until(pg, "!document.getElementById('loader')", 60): raise Exception('the loading screen never went')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
        notes['biome'] = pg.evaluate("walkView.sc.biome || null")
        spot = pg.evaluate(CF.TALL_SPOT)
        if not spot: raise Exception('no reachable spot with rock on the camera side')
        notes['spot'] = spot
        for name, d in SHOTS:
            pg.evaluate(f"(()=>{{const e=gameData.engine=gameData.engine||{{}},D=e.defaults=e.defaults||{{}};D.world=Object.assign({{}},D.world||{{}},{json.dumps(d)});return 0}})()")
            pg.evaluate(REPAINT)
            CF.stand(pg, spot['x'], spot['z'], 60)
            pg.screenshot(path=str(OUT / f'{name}.png'))
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes))


if __name__ == '__main__':
    main()
