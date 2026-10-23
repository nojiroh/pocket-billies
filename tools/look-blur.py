#!/usr/bin/env python3
"""Camera track CAM-3: pictures of the diorama blur, for picture notes (nothing is judged here; software drawing can't
judge a look). Opens Copperleaf (?fixture=town) with the game's own graphics, phone sized, stands at home and takes a
picture per lens setting: the tilt of the sharp zone at 0 (the slab before CAM-3), 0.5, 0.7 and 1, the edge blur, the
Miniature look, the player's slider at Off, Low and Strong, the cheap blur slow phones get, and the blur heatmap the
Studio's blur guides show. The numbers go to validation/look-blur/notes.json.

    python3 tools/look-blur.py                  # every picture, in validation/look-blur/
    python3 tools/look-blur.py --only=tilt      # only the pictures whose names hold these words
    python3 tools/look-blur.py --out=DIR        # somewhere else (a "before" set from another worktree)

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-blur'))

# (name, the game's lens dials on top of its own, page set-up before the picture)
SHOTS = [
    ('1-tilt-0', {'focusTilt': 0}, ''),
    ('2-tilt-0.5', {'focusTilt': 0.5}, ''),
    ('3-tilt-0.7', {'focusTilt': 0.7}, ''),
    ('4-tilt-1', {'focusTilt': 1}, ''),
    ('5-edge', {'focusTilt': 0.7, 'edgeBlur': 0.8}, ''),
    ('6-miniature', {'focusTilt': 1, 'focusBand': 0.35, 'blurFar': 1.8, 'blurNear': 0.7, 'blur': 2.2, 'miniature': 0.8}, ''),
    ('7-slider-off', {}, 'saveData.preferences.blur=0'),
    ('7-slider-low', {}, 'saveData.preferences.blur=0.5'),
    ('7-slider-strong', {}, 'saveData.preferences.blur=1.5'),
    # the slowest setting: automatic quality on but held at step 4 (its next step put off)
    ('8-cheap', {}, 'gameData.engine.defaults.quality.auto=true;walkRenderer.adaptT=1e15;walkRenderer.q=4'),
    # the Studio's Blur heatmap (green sharp, yellow, red full), at the game's own lens and at the Miniature preset
    ('9-heatmap', {}, 'walkView.opt.dofView=true'),
    ('9-heatmap-miniature', {'focusTilt': 1, 'focusBand': 0.35, 'blurFar': 1.8, 'blurNear': 0.7, 'blur': 2.2, 'miniature': 0.8}, 'walkView.opt.dofView=true'),
]


# a walkable spot 6-14 m from home toward the camera (home is under the parked airship), the first one found
OPEN_SPOT = """(() => {
  const P = walkView.pl, C = walkView.C, f = [C.tgt[0] - C.eye[0], C.tgt[2] - C.eye[2]], l = Math.hypot(f[0], f[1]);
  for (let r = 6; r <= 14; r += 1)
    for (const s of [0, 1.5, -1.5, 3, -3]) {
      const x = P.x - (f[0] / l) * r + (f[1] / l) * s, z = P.z - (f[1] / l) * r - (f[0] / l) * s;
      if (isWalkable(x, z)) return [x, z];
    }
  return null;
})()"""


def settle(pg, at, frames=8):
    """you at a spot, the camera and the focus snapped there (no glide), then a few frames (full graphics in software
    drawing are slow: waited on by frames, not time)"""
    pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={at[0]};P.z={at[1]};P.route=null;P.yv=null;walkRenderer.camT=null;walkRenderer.focus=null;return 0}})()")
    f0 = pg.evaluate('walkRenderer.frames')
    if not CF.until(pg, f'walkRenderer.frames>={f0 + frames}', 300): raise Exception(f'{pg.evaluate("walkView.id")} isn’t drawing')


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    srv, base = CF.serve(CF.GAME)
    errs, notes = [], {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=CF.LAUNCH)
        ctx, pg = CF.open_game(b, None, errs, low=False)
        pg.set_viewport_size({'width': 540, 'height': 960})
        pg.goto(base + '/index.html?fixture=town')
        CF.drawing(pg)
        if not CF.until(pg, "!document.getElementById('loader')", 60): raise Exception('the loading screen never went')
        pg.evaluate("uiState.modal=null;uiState.mq=[];renderOverlay();0")
        # the quality fixed at the top (software drawing is slow: left to itself it would drop the blur's quality)
        pg.evaluate("(()=>{const D=gameData.engine.defaults;D.quality=Object.assign({},D.quality||{},{auto:false});return 0})()")
        lens0 = pg.evaluate("Object.assign({}, gameData.engine.defaults.lens || {})")
        home = pg.evaluate(OPEN_SPOT)
        if not home: raise Exception('no open spot in front of home')
        notes['spot'] = home
        for name, lens, setup in SHOTS:
            if ONLY and not any(w in name for w in ONLY): continue
            pg.evaluate(f"(()=>{{gameData.engine.defaults.lens=Object.assign({{}},{json.dumps(lens0)},{json.dumps(lens)});gameData.engine.defaults.quality.auto=false;walkRenderer.adaptT=0;walkRenderer.q=0;walkView.R=1;saveData.preferences.blur=1;walkView.opt.dofView=false;{setup};return 0}})()")
            settle(pg, home)
            notes[name] = pg.evaluate("({focus: +(walkRenderer.focus || 0).toFixed(2), q: walkRenderer.q, R: walkView.R, lens: walkRenderer.lensInfo || null})")
            pg.screenshot(path=str(OUT / f'{name}.png'))
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes))


if __name__ == '__main__':
    main()
