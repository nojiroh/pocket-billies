#!/usr/bin/env python3
"""Player visibility: pictures of you behind buildings and trees in Copperleaf, for picture notes (nothing is judged
here; software drawing can't judge a look). Opens the town fixture (?fixture=town), stands just behind three
buildings and three trees (on the side away from the camera: check-fast.py's BEHIND_SPOTS) and takes a phone-sized
picture at each with the visibility settings off, then with them all on, and the numbers
(validation/behind/notes.json: how hidden you are, the see-through circle's strength).

    python3 tools/look-behind.py            # pictures in validation/behind/
    python3 tools/look-behind.py --full     # with the game's graphics as they are (slow in software drawing)

Uses check-fast.py's page set-up (the clock, no accounts, the test globals and, without --full, the low graphics)."""
import importlib.util, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('check_fast', ROOT / 'tools' / 'check-fast.py')
CF = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CF)
FULL = '--full' in sys.argv[1:]
OUT = ROOT / 'validation' / 'behind'

# Engine > Camera: everything off (as before player visibility, with no fade at all), then the defaults
SHOTS = [
    ('off', {'silhouette': False, 'hideFade': False, 'coverFade': 1}),
    ('on', {'silhouette': True, 'hideFade': True, 'coverFade': 0.4, 'outline': 1}),
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
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        if not CF.until(pg, "!document.getElementById('loader')", 60): raise Exception('the loading screen never went')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
        spots = pg.evaluate(CF.BEHIND_SPOTS)
        if not spots: raise Exception('no reachable spot behind a building or tree')
        for i, s in enumerate(spots):
            for name, d in SHOTS:
                pg.evaluate(f"(()=>{{const e=gameData.engine=gameData.engine||{{}},D=e.defaults=e.defaults||{{}};D.camera=Object.assign({{}},D.camera||{{}},{json.dumps(d)});return 0}})()")
                CF.stand(pg, s['x'], s['z'], 40)
                key = f'{i + 1}-{s["k"]}-{name}'
                notes[key] = pg.evaluate("({x: walkView.pl.x, z: walkView.pl.z, hidden: +(walkRenderer.hidK || 0).toFixed(2), circle: +rockUniformsFor(walkView.C).rock[2].toFixed(2)})")
                pg.screenshot(path=str(OUT / f'{key}.png'))
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes))


if __name__ == '__main__':
    main()
