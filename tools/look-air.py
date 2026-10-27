#!/usr/bin/env python3
"""Pictures of the fog in the air, for the air track's notes (docs/phases/air-track.md, AIR-3): nothing is judged here;
software drawing can't judge a look. Opens a place (default copperleaf) at phone size with the game's own graphics,
stands at a few spots and takes a picture of the walk view's canvas for each look: a time of day, a weather and the
Fog in the air dial (fogVolume; 0 is the flat mist as before). The march's state and the fog grid's numbers
(walk/fog-grid.js fogGridReport) go to OUT/notes-<scene>.json.

    python3 tools/look-air.py                        # every look, in validation/look-air/
    python3 tools/look-air.py --only=dawn-fog        # only the looks whose names hold these words
    python3 tools/look-air.py --scene=test_water     # another place
    python3 tools/look-air.py --phone                # an Android user agent (the phone's grid and steps)
    python3 tools/look-air.py --out=DIR              # somewhere else

Run `npm run data` first. Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the
test globals). Nothing is sent anywhere."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_check as CF  # noqa: E402

ROOT = CF.ROOT
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-air'))
SCENE = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--scene=')), 'copperleaf')
PHONE = '--phone' in ARGS
W, H = 390, 760
UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

# (name, hour, weather, fogVolume)
LOOKS = [
    ('noon-clear', 12.5, 'clear', 1), ('noon-clear-off', 12.5, 'clear', 0),
    ('dawn-fog', 6.6, 'fog', 1), ('dawn-fog-off', 6.6, 'fog', 0),
    ('morning-fog', 8.5, 'fog', 1), ('morning-fog-off', 8.5, 'fog', 0),
    ('dusk-fog', 18.6, 'fog', 1),
    ('night-fog', 22.5, 'fog', 1), ('night-fog-off', 22.5, 'fog', 0),
]

HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""


def frames(pg, n=10):
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + n}', 300): raise Exception(f'{SCENE} isn’t drawing')


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes, t0 = [], {'scene': SCENE, 'phone': PHONE, 'shots': []}, time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, **({'user_agent': UA} if PHONE else {}))
        for s in (CF.CLOCK, CF.NO_ACCOUNTS, CF.TEST_GLOBALS): ctx.add_init_script(s)
        ctx.set_default_timeout(240000)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'{base}/index.html?test=1&scene={SCENE}')
        if not CF.until(pg, f"typeof walkView!=='undefined'&&walkView.ready&&walkRenderer.on&&(walkView.sc.baseId||walkView.id)==='{SCENE}'", 240):
            raise Exception(f'{SCENE} never opened')
        pg.evaluate("(()=>{if(typeof uiState!=='undefined'){uiState.modal=null;uiState.mq=[]}const D=gameData.engine.defaults;D.quality=Object.assign({},D.quality||{},{auto:false});return 0})()")
        pg.evaluate(HIDE_HUD)
        for name, hour, weather, fv in LOOKS:
            if ONLY and not any(w in name for w in ONLY): continue
            pg.evaluate(f"""(()=>{{const D=gameData.engine.defaults;D.air=Object.assign({{}},D.air||{{}},{{fogVolume:{fv}}});
             environment.force=Object.assign({{}},environment.force||{{}},{{time:{hour},weather:'{weather}'}});walkRenderer.adaptT=0;walkRenderer.q=0;walkView.R=1;return 0}})()""")
            frames(pg, 40)
            shot = f'{SCENE}-{name}' + ('-phone' if PHONE else '')
            pg.screenshot(path=str(OUT / f'{shot}.png'))
            rep = pg.evaluate("GAME.fogGridReport?GAME.fogGridReport():null")
            notes['shots'].append({'name': shot, 'fogVolume': pg.evaluate("engineSetting('air','fogVolume')"),
                                   'march': rep and rep.get('march'), 'grid': rep and rep.get('size')})
            print(f'[{time.time() - t0:5.0f}s] {shot} {rep and rep.get("march")}', flush=True)
        notes['fogGrid'] = pg.evaluate("GAME.fogGridReport?GAME.fogGridReport():null")
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / f'notes-{SCENE}.json').write_text(json.dumps(notes, indent=2))
    if errs: print('page errors:', errs[:3])


if __name__ == '__main__':
    main()
