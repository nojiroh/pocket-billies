#!/usr/bin/env python3
"""Pictures of the low-poly buildings' windows, for picture notes (nothing is judged here; software drawing can't judge
a look). Opens Copperleaf (?fixture=town) with the game's own graphics, phone sized, stands in front of a building
drawn as a low-poly model with window glass (prop-models.js glassLit) and takes a picture at noon, at dusk and at
night, straight on and from a turned camera. The numbers go to validation/look-windows/notes.json.

    python3 tools/look-windows.py                # every picture, in validation/look-windows/
    python3 tools/look-windows.py --only=night   # only the pictures whose names hold these words
    python3 tools/look-windows.py --out=DIR      # somewhere else (a "before" set from another worktree)
    python3 tools/look-windows.py --prop=shop    # in front of this building (default: the nearest one to home)

Uses the browser checks' page set-up (tools/browser_check.py: the clock, no accounts, the test globals), without the
low graphics."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-windows'))
PROP = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--prop=')), '')

# (name, the hour, the camera's turn in radians)
SHOTS = [
    ('1-noon', 12.5, 0),
    ('2-dusk', 19.6, 0),
    ('3-night', 22.5, 0),
    ('4-night-turned', 22.5, 0.5),
    ('5-dusk-turned', 19.6, -0.5),
]

# a building with picture windows and a model (the catalogue's), and a walkable spot 5-9 m in front of it
FIND = """((want) => {
  const C = walkData().sc.props, P = walkView.pl;
  const ok = p => { const M = C[p.k]; return M && typeof M.model === 'string' && (M.fx || []).some(e => e.k === 'window'); };
  const L = (walkView.sc.props || []).filter(p => ok(p) && (!want || p.k === want))
    .sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  for (const p of L) {
    const r = (p.rot || 0) * Math.PI / 180, f = [Math.sin(r), -Math.cos(r)];
    for (let d = 5; d <= 9; d += 0.5)
      for (const s of [0, 1, -1]) {
        const x = p.x + f[0] * d - f[1] * s, z = p.z + f[1] * d + f[0] * s;
        if (isWalkable(x, z)) return { k: p.k, at: [x, z], prop: [p.x, p.z] };
      }
  }
  return null;
})"""


def settle(pg, at, yaw, frames=10):
    """you at a spot, the camera snapped there at this turn (no glide), then a few frames (waited on by frames: full
    graphics in software drawing are slow)"""
    pg.evaluate(f"(()=>{{const P=walkView.pl;P.x={at[0]};P.z={at[1]};P.route=null;P.yv=null;walkRenderer.yaw=walkRenderer.yawT={yaw};walkRenderer.camT=null;walkRenderer.focus=null;return 0}})()")
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
        pg.evaluate("(()=>{const D=gameData.engine.defaults;D.quality=Object.assign({},D.quality||{},{auto:false});return 0})()")
        spot = pg.evaluate(f"{FIND}({json.dumps(PROP)})")
        if not spot: raise Exception('no building with window glass in Copperleaf')
        notes['spot'] = spot
        for name, hour, yaw in SHOTS:
            if ONLY and not any(w in name for w in ONLY): continue
            pg.evaluate(f"(()=>{{environment.force=Object.assign({{}},environment.force||{{}},{{time:{hour},weather:'clear'}});walkRenderer.adaptT=0;walkRenderer.q=0;walkView.R=1;return 0}})()")
            settle(pg, spot['at'], yaw)
            notes[name] = pg.evaluate("({tod: +environment.tod.toFixed(2), dark: walkRenderer.dark ?? null, lampK: environment.lampK})")
            pg.screenshot(path=str(OUT / f'{name}.png'))
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes))


if __name__ == '__main__':
    main()
