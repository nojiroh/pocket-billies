#!/usr/bin/env python3
"""Terrain TR-3: pictures of the walking camera on tall ground, for picture notes (nothing is judged here; software
drawing can't judge a look). Opens the mountains fixture (?fixture=mountains: the run fixture with the debug menu's
mountains mod, mountains north and south), stands at the reachable spot with the most rock on the camera's side and
takes a phone-sized picture with the TR-3 settings off, then one each with the camera rise, the rock fade and the
silhouette turned on in turn, and the numbers (validation/tall-ground/notes.json).

    python3 tools/look-tall-ground.py            # pictures in validation/tall-ground/
    python3 tools/look-tall-ground.py --full     # with the game's graphics as they are (slow in software drawing)

Uses check-fast.py's page set-up (the clock, no accounts, the test globals and, without --full, the low graphics)
and its tall-ground spot finder."""
import importlib.util, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('check_fast', ROOT / 'tools' / 'check-fast.py')
CF = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CF)
FULL = '--full' in sys.argv[1:]
OUT = ROOT / 'validation' / 'tall-ground'

# the TR-3 settings (Engine > Camera), as the game data's defaults the Studio's engine editor sets
SHOTS = [
    ('1-off', {'rise': 0, 'rockFade': False, 'silhouette': False}),
    ('2-rise', {'rise': 18, 'rockFade': False, 'silhouette': False}),
    ('3-rise-fade', {'rise': 18, 'rockFade': True, 'silhouette': False}),
    ('4-rise-silhouette', {'rise': 18, 'rockFade': False, 'silhouette': True}),
    ('5-all', {'rise': 18, 'rockFade': True, 'silhouette': True}),
]


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
        spot = pg.evaluate(CF.TALL_SPOT)
        if not spot: raise Exception('no reachable spot with rock on the camera side')
        notes['spot'] = spot
        for name, d in SHOTS:
            pg.evaluate(f"(()=>{{const e=gameData.engine=gameData.engine||{{}},D=e.defaults=e.defaults||{{}};D.camera=Object.assign({{}},D.camera||{{}},{json.dumps(d)});return 0}})()")
            CF.stand(pg, spot['x'], spot['z'], 40)
            notes[name] = pg.evaluate("({rise: +(walkRenderer.occT || 0).toFixed(1), rockK: +(walkView.C.rockK || 0).toFixed(2)})")
            pg.screenshot(path=str(OUT / f'{name}.png'))
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes))


if __name__ == '__main__':
    main()
