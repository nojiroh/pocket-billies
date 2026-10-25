#!/usr/bin/env python3
"""Pictures of Copperleaf's pasture fence, for picture notes (hub track HB-6; nothing is judged here). Opens Copperleaf
(?fixture=town) with the game's own graphics, phone sized, and looks at the pasture from a free camera: from four sides
a little above the fence, close along the fence, at the gate, and from above. The numbers (where each camera stood,
how many fence props there are) go to validation/look-pasture/notes.json.

    python3 tools/look-pasture.py                # every picture, in validation/look-pasture/
    python3 tools/look-pasture.py --out=DIR      # somewhere else (a "before" set from another worktree)
    python3 tools/look-pasture.py --only=gate    # only the pictures whose names hold these words

Run `npm run data` first (the page reads game/data/gamedata.js). Uses the browser checks' page set-up
(tools/browser_check.py: the clock, no accounts, the test globals), without the low graphics. Nothing is sent
anywhere."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import browser_check as CF  # noqa: E402
ARGS = sys.argv[1:]
ONLY = next((a.split('=', 1)[1].split(',') for a in ARGS if a.startswith('--only=')), None)
OUT = Path(next((a.split('=', 1)[1] for a in ARGS if a.startswith('--out=')), ROOT / 'validation' / 'look-pasture'))

# the pasture: its zone's middle and size, its gate, how many fence props stand in it
FIND = """(() => {
  const sc = walkView.sc, Z = (sc.zones || []).find(z => z.k === 'pasture');
  if (!Z) return null;
  const xs = Z.poly.map(p => p[0]), zs = Z.poly.map(p => p[1]),
    mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
    r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2,
    g = (sc.props || []).find(p => p.act === 'pasture'),
    n = {};
  for (const p of sc.props || []) if (/^fence/.test(p.k) && Math.abs(p.x - mid[0]) < r + 2 && Math.abs(p.z - mid[1]) < r + 2) n[p.k] = (n[p.k] || 0) + 1;
  return { mid, r, y: standingHeightAt(mid[0], mid[1]), gate: g ? [g.x, g.z] : null, fence: n };
})()"""


# everything on the page but the walk view's canvas (and what holds it) hidden: the cards, labels and buttons
HIDE_HUD = """(()=>{const cv=walkView.cv;for(const el of document.body.querySelectorAll('*'))
 if(el!==cv&&!el.contains(cv))el.style.setProperty('visibility','hidden','important');
 for(let e=cv;e;e=e.parentElement)e.style.setProperty('visibility','visible','important');return 0})()"""


def views(P):
    """(name, eye, target, fov): four sides at 40 degrees down, two low views along the fence, the gate, from above"""
    (mx, mz), r, y = P['mid'], P['r'], P['y']
    out = []
    for nm, dx, dz in (('1-from-south', 0, -1), ('2-from-east', 1, 0), ('3-from-north', 0, 1), ('4-from-west', -1, 0)):
        d = r + 12
        out.append((nm, [mx + dx * d, y + d * 0.75, mz + dz * d], [mx, y, mz], 50))
    # low along the fence from two corners: the posts' heights, the rails' tilt
    out.append(('5-low-sw', [mx - r - 3, y + 1.6, mz - r - 3], [mx, y + 0.5, mz], 45))
    out.append(('6-low-ne', [mx + r + 3, y + 1.6, mz + r + 3], [mx, y + 0.5, mz], 45))
    if P['gate']:
        gx, gz = P['gate']
        ax, az = gx - mx, gz - mz
        L = max(0.1, (ax * ax + az * az) ** 0.5)
        out.append(('7-gate', [gx + ax / L * 7, y + 2.6, gz + az / L * 7], [gx, y + 0.4, gz], 50))
    out.append(('8-above', [mx, y + r * 2.6, mz - r * 0.35], [mx, y, mz], 50))
    return out


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
        pg.evaluate("(()=>{environment.force=Object.assign({},environment.force||{},{time:15,weather:'clear'});walkRenderer.adaptT=0;walkRenderer.q=0;walkView.R=1;return 0})()")
        # no depth of field (it focuses on you, so the pasture blurs); put back after
        pg.evaluate("(()=>{const p=saveData.preferences=saveData.preferences||{};window.__pref={expert:p.expert,eng:p.eng};p.expert=true;p.eng={lens:{blur:0,bokeh:0}};return 0})()")
        P = pg.evaluate(FIND)
        if not P: raise Exception('Copperleaf has no pasture zone')
        notes['pasture'] = P
        # stand by the pasture so its props are near (culling and the shadow map follow you)
        pg.evaluate(f"(()=>{{const q=walkablePointNear({P['mid'][0]},{P['mid'][1]}),L=walkView.pl;L.x=q[0];L.z=q[1];L.route=null;return 0}})()")
        for name, eye, tgt, fov in views(P):
            if ONLY and not any(w in name for w in ONLY): continue
            pg.evaluate(f"walkView.opt.look=()=>({{eye:{json.dumps(eye)},tgt:{json.dumps(tgt)},fov:{fov}}})")
            f0 = pg.evaluate('walkRenderer.frames')
            if not CF.until(pg, f'walkRenderer.frames>={f0 + 12}', 300): raise Exception('stopped drawing')
            pg.evaluate(HIDE_HUD)
            pg.screenshot(path=str(OUT / f'{name}.png'))
            notes[name] = {'eye': [round(v, 1) for v in eye], 'tgt': [round(v, 1) for v in tgt]}
            print(name, flush=True)
        pg.evaluate('delete walkView.opt.look')
        pg.evaluate("(()=>{const p=saveData.preferences;p.expert=window.__pref.expert;p.eng=window.__pref.eng;return 0})()")
        ctx.close(); b.close()
    srv.shutdown()
    notes['errors'] = errs[:6]
    (OUT / 'notes.json').write_text(json.dumps(notes, indent=2))
    print(json.dumps(notes['pasture']), f'page errors: {len(errs)}')


if __name__ == '__main__':
    main()
